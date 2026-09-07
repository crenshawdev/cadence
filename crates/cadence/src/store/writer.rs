use super::model::{self, DECISIONS, DecisionRecord, ITEMS, ItemRecord, STATE, Snapshot};
use super::{Error, MutationContext, Observed, Policy, Result, Storage};
use serde_json::Value;
use std::collections::BTreeMap;
use tokio::sync::{mpsc, oneshot};

#[derive(Clone, Debug, PartialEq)]
pub struct View {
    pub items: Vec<ItemRecord>,
    pub decisions: Vec<DecisionRecord>,
    pub snapshot: Snapshot,
}

/// Owner-serialized precondition; this does not compare-and-swap Markdown files.
pub const STALE_SNAPSHOT: &str = "conditional snapshot precondition changed";

pub enum Operation {
    Read,
    ReadVerified,
    CompareRewriteSnapshot {
        expected_generation: u64,
        expected_integrity: String,
        data: Value,
    },
    CompareTransact {
        expected_generation: u64,
        expected_integrity: String,
        transaction: super::transaction::Transaction,
    },
    Transact(super::transaction::Transaction),
    AppendItem(ItemRecord),
    AppendDecision(DecisionRecord),
    RewriteSnapshot(Value),
}

struct Request {
    operation: Operation,
    reply: oneshot::Sender<Result<View>>,
    #[cfg(test)]
    id: String,
}

#[cfg(test)]
type BeforeReply = Box<dyn FnMut(&str) -> Result<()> + Send>;

#[derive(Clone)]
pub struct Store {
    requests: mpsc::Sender<Request>,
}

impl Store {
    pub async fn open<S: Storage, P: Policy>(storage: S, policy: P) -> Result<Self> {
        Self::open_inner(
            storage,
            policy,
            #[cfg(test)]
            None,
        )
        .await
    }

    #[cfg(test)]
    pub async fn open_observed_for_test<S: Storage, P: Policy>(
        storage: S,
        policy: P,
        before_reply: BeforeReply,
    ) -> Result<Self> {
        Self::open_inner(storage, policy, Some(before_reply)).await
    }

    async fn open_inner<S: Storage, P: Policy>(
        storage: S,
        policy: P,
        #[cfg(test)] mut before_reply: Option<BeforeReply>,
    ) -> Result<Self> {
        let (requests, mut receiver) = mpsc::channel::<Request>(32);
        let (ready, completion) = oneshot::channel();
        std::thread::Builder::new()
            .name("cadence-store".into())
            .spawn(move || {
                let mut writer = match Writer::open(storage, policy) {
                    Ok(writer) => {
                        let _ = ready.send(Ok(()));
                        writer
                    }
                    Err(error) => {
                        let _ = ready.send(Err(error));
                        return;
                    }
                };
                while let Some(request) = receiver.blocking_recv() {
                    let result = writer.execute(request.operation);
                    finish_reply(
                        request.reply,
                        result,
                        #[cfg(test)]
                        &request.id,
                        #[cfg(test)]
                        &mut before_reply,
                    );
                }
            })?;
        completion.await.map_err(|_| Error::Closed)??;
        Ok(Self { requests })
    }

    pub async fn request(&self, operation: Operation) -> Result<View> {
        self.enqueue(
            operation,
            #[cfg(test)]
            String::new(),
        )
        .await
    }

    #[cfg(test)]
    pub async fn request_identified_for_test(
        &self,
        id: &str,
        operation: Operation,
    ) -> Result<View> {
        self.enqueue(operation, id.to_string()).await
    }

    async fn enqueue(&self, operation: Operation, #[cfg(test)] id: String) -> Result<View> {
        let (reply, completion) = oneshot::channel();
        self.requests
            .send(Request {
                operation,
                reply,
                #[cfg(test)]
                id,
            })
            .await
            .map_err(|_| Error::Closed)?;
        completion.await.map_err(|_| Error::Closed)?
    }
}

/// All acknowledgement scheduling goes through this function. The cfg(test)
/// marker and actual send are one completion operation, including if that
/// operation is moved earlier by a future change.
fn finish_reply(
    reply: oneshot::Sender<Result<View>>,
    result: Result<View>,
    #[cfg(test)] id: &str,
    #[cfg(test)] before_reply: &mut Option<BeforeReply>,
) {
    #[cfg(test)]
    let result = if result.is_ok() && !id.is_empty() {
        match before_reply.as_mut().map(|hook| hook(id)).transpose() {
            Ok(_) => result,
            Err(error) => Err(error),
        }
    } else {
        result
    };
    // Canceled callers do not cancel admitted work. A lost reply is not an ack.
    let _ = reply.send(result);
}

struct Writer<S: Storage, P: Policy> {
    storage: S,
    policy: P,
    view: View,
    observed: BTreeMap<String, Observed>,
    failed: Option<Error>,
}

impl<S: Storage, P: Policy> Writer<S, P> {
    fn open(mut storage: S, mut policy: P) -> Result<Self> {
        super::transaction::recover(&mut storage, &mut policy)?;
        let mut observed = BTreeMap::new();
        for name in [ITEMS, DECISIONS, STATE] {
            observed.insert(name.to_string(), storage.read(name)?);
        }
        let items_bytes = observed[ITEMS].bytes.as_deref().unwrap_or_default();
        let decision_bytes = observed[DECISIONS].bytes.as_deref().unwrap_or_default();
        let snapshot = match observed[STATE].bytes.as_deref() {
            Some(bytes) if observed.values().all(|file| file.bytes.is_some()) => {
                Snapshot::parse(bytes, items_bytes, decision_bytes)?
            }
            Some(_) => return Err(Error::Conflict("owned generation lost a store file".into())),
            None if observed.values().all(|file| file.bytes.is_none()) => {
                Snapshot::new(0, b"", b"", Value::Null)?
            }
            None => return Err(Error::Conflict("owned records lack a snapshot".into())),
        };
        let items = model::parse_lines(items_bytes)?;
        let decisions = model::parse_lines(decision_bytes)?;
        model::validate_items(&items)?;
        model::validate_decisions(&decisions)?;
        Ok(Self {
            storage,
            policy,
            observed,
            view: View {
                items,
                decisions,
                snapshot,
            },
            failed: None,
        })
    }

    fn execute(&mut self, operation: Operation) -> Result<View> {
        if let Some(error) = &self.failed {
            return Err(error.clone());
        }
        // Attempt preconditions are not logical transaction content. In particular,
        // an acknowledged/recovered retry must be recognized before the stale gate.
        let (operation, expected) = match operation {
            Operation::CompareTransact {
                expected_generation,
                expected_integrity,
                transaction,
            } => (
                Operation::Transact(transaction),
                Some((expected_generation, expected_integrity)),
            ),
            other => (other, None),
        };
        let mut next = self.view.clone();
        let mut external = Vec::new();
        let mut operations = next.snapshot.operations.clone();
        let operation_name = match operation {
            Operation::Read => return Ok(next),
            Operation::ReadVerified => {
                self.revalidate()?;
                return Ok(next);
            }
            Operation::CompareRewriteSnapshot {
                expected_generation,
                expected_integrity,
                data,
            } => {
                self.revalidate()?;
                if expected_generation != self.view.snapshot.generation
                    || expected_integrity != self.view.snapshot.integrity
                {
                    return Err(Error::Conflict(STALE_SNAPSHOT.into()));
                }
                next.snapshot.data = data;
                "rewrite_snapshot"
            }
            Operation::Transact(transaction) => {
                if transaction.id.trim().is_empty() {
                    return Err(Error::Invalid("empty operation identity".into()));
                }
                let fingerprint = transaction.fingerprint()?;
                if let Some(prior) = operations.get(&transaction.id) {
                    self.revalidate()?;
                    return if *prior == fingerprint {
                        Ok(next)
                    } else {
                        Err(Error::Conflict(
                            "operation identity reused for different content".into(),
                        ))
                    };
                }
                if let Some((generation, integrity)) = expected {
                    self.revalidate()?;
                    if generation != self.view.snapshot.generation
                        || integrity != self.view.snapshot.integrity
                    {
                        return Err(Error::Conflict(STALE_SNAPSHOT.into()));
                    }
                }
                operations.insert(transaction.id, fingerprint);
                next.items.extend(transaction.items);
                next.decisions.extend(
                    transaction
                        .decisions
                        .into_iter()
                        .map(super::decisions::normalize),
                );
                model::validate_items(&next.items)?;
                model::validate_decisions(&next.decisions)?;
                if let Some(data) = transaction.snapshot {
                    next.snapshot.data = data;
                }
                external = transaction.external;
                "transaction"
            }
            Operation::CompareTransact { .. } => unreachable!("unwrapped above"),
            Operation::AppendItem(item) => {
                next.items.push(item);
                model::validate_items(&next.items)?;
                "append_item"
            }
            Operation::AppendDecision(record) => {
                next.decisions.push(super::decisions::normalize(record));
                model::validate_decisions(&next.decisions)?;
                "append_decision"
            }
            Operation::RewriteSnapshot(data) => {
                next.snapshot.data = data;
                "rewrite_snapshot"
            }
        };
        self.revalidate()?;
        self.policy.validate(&MutationContext {
            operation: operation_name,
            snapshot: &self.view.snapshot,
        })?;
        let items = model::render_lines(&next.items)?;
        let decisions = model::render_lines(&next.decisions)?;
        let generation = self
            .view
            .snapshot
            .generation
            .checked_add(1)
            .ok_or_else(|| Error::Invalid("generation overflow".into()))?;
        next.snapshot = Snapshot::new(generation, &items, &decisions, next.snapshot.data)?
            .with_operations(operations)?;
        let state = next.snapshot.render()?;
        let mut participants = Vec::new();
        for change in external {
            if !matches!(change.target.as_str(), "repo-config" | "global-config") {
                return Err(Error::Invalid("unknown external participant".into()));
            }
            participants.push(super::transaction::Participant {
                target: change.target,
                expected: change.expected,
                bytes: change.bytes,
            });
        }
        for (name, bytes) in [(ITEMS, items), (DECISIONS, decisions), (STATE, state)] {
            participants.push(super::transaction::Participant {
                target: name.into(),
                expected: self.observed[name].clone(),
                bytes,
            });
        }
        if let Err(error) = super::transaction::commit(
            &mut self.storage,
            &mut self.policy,
            &MutationContext {
                operation: operation_name,
                snapshot: &self.view.snapshot,
            },
            participants,
        ) {
            self.failed = Some(error.clone());
            return Err(error);
        }
        for name in [ITEMS, DECISIONS, STATE] {
            self.observed.insert(name.into(), self.storage.read(name)?);
        }
        self.view = next;
        Ok(self.view.clone())
    }

    fn revalidate(&mut self) -> Result<()> {
        for (name, expected) in &self.observed {
            if self.storage.read(name)? != *expected {
                return Err(Error::Conflict(format!("externally changed store: {name}")));
            }
        }
        Ok(())
    }
}
