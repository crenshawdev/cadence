use super::model::{self, DECISIONS, DecisionRecord, ITEMS, ItemRecord, STATE, Snapshot};
use super::{Error, MutationContext, Observed, Policy, Result, Storage};
use cadence::execution::model::{
    ActiveDispatch, BoundaryDecision, BoundaryTool, EXECUTION_SCHEMA, ExecutionOccurrence,
    ExecutionSnapshot, ExecutorPatch, PlanDisposition, TerminalOutcome,
};
use serde::Serialize;
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
    AdmitExecution {
        expected_generation: u64,
        expected_integrity: String,
        operation_id: String,
        plan_set_fingerprint: String,
        dispatch: ActiveDispatch,
        decision: BoundaryDecision,
    },
    ApplyExecutionPatch {
        expected_generation: u64,
        expected_integrity: String,
        operation_id: String,
        patch: ExecutorPatch,
        commit_paths: BTreeMap<String, Vec<String>>,
        decision: BoundaryDecision,
        render_version: u32,
        complete_phase: bool,
    },
    RecordExecutionRefusal {
        expected_generation: u64,
        expected_integrity: String,
        operation_id: String,
        decision: BoundaryDecision,
    },
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
        match operation {
            Operation::AdmitExecution {
                expected_generation,
                expected_integrity,
                operation_id,
                plan_set_fingerprint,
                dispatch,
                decision,
            } => self.admit_execution(
                expected_generation,
                &expected_integrity,
                &operation_id,
                &plan_set_fingerprint,
                dispatch,
                decision,
            ),
            Operation::ApplyExecutionPatch {
                expected_generation,
                expected_integrity,
                operation_id,
                patch,
                commit_paths,
                decision,
                render_version,
                complete_phase,
            } => self.apply_execution_patch(
                expected_generation,
                &expected_integrity,
                &operation_id,
                patch,
                commit_paths,
                decision,
                render_version,
                complete_phase,
            ),
            Operation::RecordExecutionRefusal {
                expected_generation,
                expected_integrity,
                operation_id,
                decision,
            } => self.record_execution_refusal(
                expected_generation,
                &expected_integrity,
                &operation_id,
                decision,
            ),
            other => self.execute_store(other),
        }
    }

    fn execute_store(&mut self, operation: Operation) -> Result<View> {
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
            Operation::AdmitExecution { .. }
            | Operation::ApplyExecutionPatch { .. }
            | Operation::RecordExecutionRefusal { .. } => {
                unreachable!("execution operations are handled before store operations")
            }
        };
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
        self.persist(
            next,
            operations,
            participants,
            operation_name,
            super::transaction::IntentKind::Store,
        )
    }

    #[allow(clippy::too_many_arguments)]
    fn admit_execution(
        &mut self,
        expected_generation: u64,
        expected_integrity: &str,
        operation_id: &str,
        plan_set_fingerprint: &str,
        dispatch: ActiveDispatch,
        decision: BoundaryDecision,
    ) -> Result<View> {
        if decision.phase != dispatch.phase
            || decision.subject_id.as_deref() != Some(dispatch.id.as_str())
            || decision.prompt_bytes != Some(dispatch.prompt_bytes)
            || plan_set_fingerprint != dispatch.plan_set_fingerprint
        {
            return Err(Error::Invalid("dispatch boundary identity mismatch".into()));
        }
        let fingerprint = operation_fingerprint(&(
            "execution-dispatch",
            plan_set_fingerprint,
            &dispatch,
            &decision,
        ))?;
        if let Some(view) = self.execution_replay(operation_id, &fingerprint, decision.phase)? {
            return Ok(view);
        }
        let admission = self.boundary_admission(&decision)?;
        if matches!(admission, BoundaryAdmission::Replay) {
            self.revalidate()?;
            return Ok(self.view.clone());
        }
        if matches!(admission, BoundaryAdmission::Terminal(_)) {
            return self.persist_terminal(admission, decision.phase);
        }
        self.check_expected(expected_generation, expected_integrity)?;

        let mut next = self.view.clone();
        let mut execution = execution_snapshot(&next.snapshot.data)?;
        let key = dispatch.phase.to_string();
        let occurrence = execution
            .occurrences
            .entry(key)
            .or_insert_with(|| ExecutionOccurrence {
                phase: dispatch.phase,
                plan_set_fingerprint: plan_set_fingerprint.to_owned(),
                version: dispatch.expected_execution_version,
                active: None,
                plans: Vec::new(),
                terminal: None,
                receipts: BTreeMap::new(),
            });
        let (occurrence, _) = cadence::execution::dispatch::admit_dispatch(occurrence, dispatch)
            .map_err(|error| Error::Conflict(error.to_string()))?;
        execution
            .occurrences
            .insert(occurrence.phase.to_string(), occurrence);
        install_execution(&mut next.snapshot.data, execution)?;
        append_admitted_boundary(&mut next, admission)?;
        let mut operations = next.snapshot.operations.clone();
        operations.insert(operation_id.to_owned(), fingerprint);
        self.persist(
            next,
            operations,
            Vec::new(),
            "execution_dispatch",
            super::transaction::IntentKind::ExecutionDispatch {
                phase: decision.phase,
            },
        )
    }

    #[allow(clippy::too_many_arguments)]
    fn apply_execution_patch(
        &mut self,
        expected_generation: u64,
        expected_integrity: &str,
        operation_id: &str,
        patch: ExecutorPatch,
        commit_paths: BTreeMap<String, Vec<String>>,
        decision: BoundaryDecision,
        render_version: u32,
        complete_phase: bool,
    ) -> Result<View> {
        if render_version != cadence::execution::render::SUMMARY_RENDER_VERSION
            || decision.subject_id.as_deref() != Some(patch.dispatch_id.as_str())
            || (complete_phase && patch.outcome != PlanDisposition::Complete)
        {
            return Err(Error::Invalid("invalid execution patch operation".into()));
        }
        let fingerprint = operation_fingerprint(&(
            "execution-patch",
            &patch,
            &commit_paths,
            &decision,
            render_version,
            complete_phase,
        ))?;
        if let Some(view) = self.execution_replay(operation_id, &fingerprint, decision.phase)? {
            return Ok(view);
        }
        let admission = self.boundary_admission(&decision)?;
        if matches!(admission, BoundaryAdmission::Replay) {
            self.revalidate()?;
            return Ok(self.view.clone());
        }
        if matches!(admission, BoundaryAdmission::Terminal(_)) {
            return self.persist_terminal(admission, decision.phase);
        }
        self.check_expected(expected_generation, expected_integrity)?;

        let application =
            cadence::execution::patch::apply_executor_patch(&self.view.snapshot.data, &patch)
                .map_err(|error| Error::Invalid(error.to_string()))?;
        let application =
            cadence::execution::patch::attach_commit_paths(application, &commit_paths)
                .map_err(|error| Error::Invalid(error.to_string()))?;
        if application.disposition == cadence::execution::patch::ApplicationDisposition::Replay {
            self.revalidate()?;
            return Ok(self.view.clone());
        }
        if application.outcome.phase != decision.phase {
            return Err(Error::Invalid("patch boundary phase mismatch".into()));
        }
        let mut next = self.view.clone();
        next.snapshot.data = application.data;
        let mut execution = execution_snapshot(&next.snapshot.data)?;
        if complete_phase {
            let occurrence = execution
                .occurrences
                .get_mut(&decision.phase.to_string())
                .ok_or_else(|| Error::Invalid("patch execution occurrence is absent".into()))?;
            if occurrence.terminal.is_some() {
                return Err(Error::Conflict(
                    "execution occurrence is already terminal".into(),
                ));
            }
            occurrence.terminal = Some(TerminalOutcome::Complete {
                phase: decision.phase,
            });
        }
        install_execution(&mut next.snapshot.data, execution.clone())?;
        append_admitted_boundary(&mut next, admission)?;
        let summary = cadence::execution::render::render_phase_summary(&execution, decision.phase)
            .map_err(|error| Error::Invalid(error.to_string()))?;
        let summary_target = format!("phase-summary:{}", decision.phase);
        let summary_expected = self.storage.read(&summary_target)?;
        let mut operations = next.snapshot.operations.clone();
        operations.insert(operation_id.to_owned(), fingerprint);
        self.persist(
            next,
            operations,
            vec![super::transaction::Participant {
                target: summary_target,
                expected: summary_expected,
                bytes: summary,
            }],
            "execution_patch",
            super::transaction::IntentKind::ExecutionPatch {
                phase: decision.phase,
                render_version,
                summary: true,
            },
        )
    }

    fn record_execution_refusal(
        &mut self,
        expected_generation: u64,
        expected_integrity: &str,
        operation_id: &str,
        decision: BoundaryDecision,
    ) -> Result<View> {
        let fingerprint = operation_fingerprint(&("execution-refusal", &decision))?;
        if let Some(view) = self.execution_replay(operation_id, &fingerprint, decision.phase)? {
            return Ok(view);
        }
        let admission = self.boundary_admission(&decision)?;
        if matches!(admission, BoundaryAdmission::Replay) {
            self.revalidate()?;
            return Ok(self.view.clone());
        }
        if matches!(admission, BoundaryAdmission::Terminal(_)) {
            return self.persist_terminal(admission, decision.phase);
        }
        self.check_expected(expected_generation, expected_integrity)?;
        let mut next = self.view.clone();
        append_admitted_boundary(&mut next, admission)?;
        let mut operations = next.snapshot.operations.clone();
        operations.insert(operation_id.to_owned(), fingerprint);
        self.persist(
            next,
            operations,
            Vec::new(),
            "execution_refusal",
            super::transaction::IntentKind::ExecutionRefusal {
                phase: decision.phase,
            },
        )
    }

    fn execution_replay(
        &mut self,
        operation_id: &str,
        fingerprint: &str,
        phase: u32,
    ) -> Result<Option<View>> {
        if operation_id.trim().is_empty() {
            return Err(Error::Invalid("empty operation identity".into()));
        }
        if terminal_boundary(&self.view.decisions, phase).is_some() {
            self.revalidate()?;
            return Ok(Some(self.view.clone()));
        }
        if let Some(prior) = self.view.snapshot.operations.get(operation_id).cloned() {
            self.revalidate()?;
            return if prior == fingerprint {
                Ok(Some(self.view.clone()))
            } else {
                Err(Error::Conflict(
                    "operation identity reused for different content".into(),
                ))
            };
        }
        Ok(None)
    }

    fn boundary_admission(&self, decision: &BoundaryDecision) -> Result<BoundaryAdmission> {
        let record = boundary_record(decision, self.next_generation()?)?;
        if self
            .view
            .decisions
            .iter()
            .any(|prior| prior.id == record.id)
        {
            return Ok(BoundaryAdmission::Replay);
        }
        let count = self
            .view
            .decisions
            .iter()
            .filter(|record| {
                matches!(
                    record.decision,
                    model::Decision::Boundary {
                        phase,
                        terminal: false,
                        ..
                    } if phase == decision.phase
                )
            })
            .count();
        if count >= 256 {
            return Ok(BoundaryAdmission::Terminal(terminal_record(
                decision.phase,
                self.next_generation()?,
            )?));
        }
        Ok(BoundaryAdmission::Proceed(record))
    }

    fn persist_terminal(&mut self, admission: BoundaryAdmission, phase: u32) -> Result<View> {
        let BoundaryAdmission::Terminal(record) = admission else {
            return Err(Error::Invalid("terminal boundary record is absent".into()));
        };
        let mut next = self.view.clone();
        next.decisions.push(record);
        model::validate_decisions(&next.decisions)?;
        self.persist(
            next,
            self.view.snapshot.operations.clone(),
            Vec::new(),
            "execution_log_bound",
            super::transaction::IntentKind::ExecutionRefusal { phase },
        )
    }

    fn check_expected(&mut self, generation: u64, integrity: &str) -> Result<()> {
        self.revalidate()?;
        if generation != self.view.snapshot.generation || integrity != self.view.snapshot.integrity
        {
            return Err(Error::Conflict(STALE_SNAPSHOT.into()));
        }
        Ok(())
    }

    fn persist(
        &mut self,
        mut next: View,
        operations: BTreeMap<String, String>,
        mut participants: Vec<super::transaction::Participant>,
        operation_name: &'static str,
        intent_kind: super::transaction::IntentKind,
    ) -> Result<View> {
        self.revalidate()?;
        self.policy.validate(&MutationContext {
            operation: operation_name,
            snapshot: &self.view.snapshot,
        })?;
        let items = model::render_lines(&next.items)?;
        let decisions = model::render_lines(&next.decisions)?;
        let generation = self.next_generation()?;
        next.snapshot = Snapshot::new(generation, &items, &decisions, next.snapshot.data)?
            .with_operations(operations)?;
        let state = next.snapshot.render()?;
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
            intent_kind,
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

    fn next_generation(&self) -> Result<u64> {
        self.view
            .snapshot
            .generation
            .checked_add(1)
            .ok_or_else(|| Error::Invalid("generation overflow".into()))
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

enum BoundaryAdmission {
    Proceed(DecisionRecord),
    Replay,
    Terminal(DecisionRecord),
}

fn append_admitted_boundary(next: &mut View, admission: BoundaryAdmission) -> Result<()> {
    let BoundaryAdmission::Proceed(record) = admission else {
        return Err(Error::Invalid("boundary decision was not admitted".into()));
    };
    next.decisions.push(record);
    model::validate_decisions(&next.decisions)
}

fn boundary_record(decision: &BoundaryDecision, store_generation: u64) -> Result<DecisionRecord> {
    if decision.phase == 0 {
        return Err(Error::Invalid("boundary phase must be positive".into()));
    }
    let id = model::digest(&serde_json::to_vec(&("boundary", decision))?);
    let record = DecisionRecord {
        version: model::VERSION,
        id,
        revision: 1,
        origin: model::Origin {
            source: "execution-boundary".into(),
            original: model::Evidence::Missing,
        },
        decision: model::Decision::Boundary {
            phase: decision.phase,
            tool: match decision.tool {
                BoundaryTool::CadenceQuery => "cadence-query",
                BoundaryTool::CadenceApply => "cadence-apply",
            }
            .into(),
            operation: decision.operation.clone(),
            request_digest: decision.request_digest.clone(),
            outcome: decision.outcome.clone(),
            subject_id: decision.subject_id.clone(),
            store_generation,
            prompt_bytes: decision.prompt_bytes,
            response_digest: decision.response_digest.clone(),
            terminal: false,
        },
    };
    model::validate_decisions(std::slice::from_ref(&record))?;
    Ok(record)
}

fn terminal_record(phase: u32, store_generation: u64) -> Result<DecisionRecord> {
    let identity = model::digest(format!("execution-log-bound:{phase}").as_bytes());
    let record = DecisionRecord {
        version: model::VERSION,
        id: identity.clone(),
        revision: 1,
        origin: model::Origin {
            source: "execution-boundary".into(),
            original: model::Evidence::Missing,
        },
        decision: model::Decision::Boundary {
            phase,
            tool: "cadence-boundary".into(),
            operation: "execution".into(),
            request_digest: identity.clone(),
            outcome: "log-bound".into(),
            subject_id: None,
            store_generation,
            prompt_bytes: None,
            response_digest: identity,
            terminal: true,
        },
    };
    model::validate_decisions(std::slice::from_ref(&record))?;
    Ok(record)
}

fn terminal_boundary(decisions: &[DecisionRecord], phase: u32) -> Option<&DecisionRecord> {
    decisions.iter().find(|record| {
        matches!(
            record.decision,
            model::Decision::Boundary {
                phase: record_phase,
                terminal: true,
                ..
            } if record_phase == phase
        )
    })
}

fn operation_fingerprint(value: &impl Serialize) -> Result<String> {
    Ok(model::digest(&serde_json::to_vec(value)?))
}

fn execution_snapshot(data: &Value) -> Result<ExecutionSnapshot> {
    let object = data
        .as_object()
        .ok_or_else(|| Error::Invalid("snapshot data must be an object".into()))?;
    match object.get("execution") {
        Some(value) => serde_json::from_value(value.clone()).map_err(Error::from),
        None => Ok(ExecutionSnapshot::default()),
    }
}

fn install_execution(data: &mut Value, execution: ExecutionSnapshot) -> Result<()> {
    if execution.schema != EXECUTION_SCHEMA {
        return Err(Error::Invalid("unsupported execution schema".into()));
    }
    let mut stored = serde_json::to_value(execution)?;
    if let Some(occurrences) = stored.get_mut("occurrences").and_then(Value::as_object_mut) {
        for occurrence in occurrences.values_mut() {
            if let Some(active) = occurrence.get_mut("active").and_then(Value::as_object_mut) {
                active.remove("body");
            }
        }
    }
    data.as_object_mut()
        .ok_or_else(|| Error::Invalid("snapshot data must be an object".into()))?
        .insert("execution".into(), stored);
    Ok(())
}
