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

pub enum Operation {
    Read,
    AppendItem(ItemRecord),
    AppendDecision(DecisionRecord),
    RewriteSnapshot(Value),
}

struct Request {
    operation: Operation,
    reply: oneshot::Sender<Result<View>>,
}

#[derive(Clone)]
pub struct Store {
    requests: mpsc::Sender<Request>,
}

impl Store {
    pub async fn open<S: Storage, P: Policy>(storage: S, policy: P) -> Result<Self> {
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
                    // Canceled callers do not cancel operations admitted to the queue.
                    // There is exactly one send site, after all disk confirmation.
                    let _ = request.reply.send(result);
                }
            })?;
        completion.await.map_err(|_| Error::Closed)??;
        Ok(Self { requests })
    }

    pub async fn request(&self, operation: Operation) -> Result<View> {
        let (reply, completion) = oneshot::channel();
        self.requests
            .send(Request { operation, reply })
            .await
            .map_err(|_| Error::Closed)?;
        completion.await.map_err(|_| Error::Closed)?
    }
}

struct Writer<S: Storage, P: Policy> {
    storage: S,
    policy: P,
    view: View,
    observed: BTreeMap<String, Observed>,
    failed: Option<Error>,
}

impl<S: Storage, P: Policy> Writer<S, P> {
    fn open(mut storage: S, policy: P) -> Result<Self> {
        let mut observed = BTreeMap::new();
        for name in [ITEMS, DECISIONS, STATE] {
            observed.insert(name.to_string(), storage.read(name)?);
        }
        let items_bytes = observed[ITEMS].bytes.as_deref().unwrap_or_default();
        let decision_bytes = observed[DECISIONS].bytes.as_deref().unwrap_or_default();
        let snapshot = match observed[STATE].bytes.as_deref() {
            Some(bytes) => Snapshot::parse(bytes, items_bytes, decision_bytes)?,
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
        let mut next = self.view.clone();
        let operation_name = match operation {
            Operation::Read => return Ok(next),
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
        next.snapshot = Snapshot::new(generation, &items, &decisions, next.snapshot.data)?;
        let state = next.snapshot.render()?;
        for (name, bytes) in [(ITEMS, items), (DECISIONS, decisions), (STATE, state)] {
            if self.observed[name].bytes.as_ref() == Some(&bytes) {
                continue;
            }
            let result = (|| {
                let prepared = self.storage.prepare(name, &bytes)?;
                let installed = self.storage.install(&prepared);
                self.storage.discard(prepared)?;
                installed?;
                self.storage.confirm(name, &bytes)
            })();
            match result {
                Ok(observed) => {
                    self.observed.insert(name.to_string(), observed);
                }
                Err(error) => {
                    self.failed = Some(error.clone());
                    return Err(error);
                }
            }
        }
        self.view = next;
        Ok(self.view.clone())
    }
}
