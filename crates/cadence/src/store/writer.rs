use super::model::{self, DECISIONS, DecisionRecord, ITEMS, ItemRecord, STATE, Snapshot};
use super::{Error, MutationContext, Observed, Policy, Result, Storage};
use cadence::envelope::Envelope;
use cadence::execution::boundary::{
    BoundaryScope, BoundaryV1, ExecutionEnvelope, Failure, Receipt, Success, envelope_digest,
};
use cadence::execution::model::{
    ActiveDispatch, BoundaryDecision, BoundaryTool, EXECUTION_SCHEMA, ExecutionOccurrence,
    ExecutionSnapshot, ExecutorPatch, PlanDisposition, TerminalOutcome,
};
use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;
use std::sync::Arc;
use tokio::sync::{mpsc, oneshot};

#[path = "../guard/audit.rs"]
pub mod audit;

#[derive(Clone, Debug, PartialEq)]
pub struct View {
    pub items: Vec<ItemRecord>,
    pub decisions: Vec<DecisionRecord>,
    pub snapshot: Snapshot,
}

/// Owner-serialized precondition; this does not compare-and-swap Markdown files.
pub const STALE_SNAPSHOT: &str = "conditional snapshot precondition changed";

#[derive(Clone, Debug, Serialize)]
pub enum BoundaryChange {
    Issue {
        change: Box<BoundaryChange>,
        id: String,
        issue: cadence::execution::model::DispatchIssue,
    },
    Observe,
    FinalizeRisk {
        phase: u32,
        requirements: Vec<cadence::rail::receipts::Requirement>,
    },
    Dispatch {
        plan_set_fingerprint: String,
        dispatch: ActiveDispatch,
    },
    Reissue {
        issue_dispatch_id: String,
        dispatch: ActiveDispatch,
    },
    Patch {
        patch: ExecutorPatch,
        commit_paths: BTreeMap<String, Vec<String>>,
        #[serde(skip_serializing_if = "Vec::is_empty")]
        staged_paths: Vec<String>,
        render_version: u32,
        complete_phase: bool,
    },
}

pub type InputCheck = Box<dyn FnMut() -> Result<()> + Send>;

pub enum Operation {
    VerificationRunV1 {
        expected_generation: u64,
        expected_integrity: String,
        record: Box<cadence::verification::runner::Record>,
    },
    VerificationV1 {
        expected_generation: u64,
        expected_integrity: String,
        request: Box<cadence::verification::persistence::Request>,
    },
    /// The owner's explicit adoption of one ticked phase: the record the
    /// service computed from the documents, retained under its request id.
    AdoptionDeclareV1 {
        expected_generation: u64,
        expected_integrity: String,
        record: Box<cadence::adoption::Record>,
        request_id: String,
    },
    NativeTaskV1 {
        expected_generation: u64,
        expected_integrity: String,
        request: Box<cadence::execution::history::Request>,
    },
    NativePlanV1 {
        expected_generation: u64,
        expected_integrity: String,
        request: Box<cadence::execution::history::PlanRequest>,
    },
    NativeAdmissionV1 {
        expected_generation: u64,
        expected_integrity: String,
        request: Box<cadence::execution::admission::Request>,
    },
    ObservePlan {
        phase: u32,
        plan: u32,
        reply: oneshot::Sender<Result<Observed>>,
    },
    /// Captures the dedicated participant after approval, under store ownership.
    ObserveContext {
        phase: u32,
        reply: oneshot::Sender<Result<Observed>>,
    },
    CheckedTransact {
        check: InputCheck,
        transaction: Option<super::transaction::Transaction>,
    },
    RailReceipt {
        expected_generation: u64,
        expected_integrity: String,
        record: Box<cadence::rail::receipts::RecordedFact>,
    },
    RailObservation {
        expected_generation: u64,
        expected_integrity: String,
        record: Box<cadence::rail::risk::Recorded>,
    },
    GuardAudit(audit::Audit),
    BoundaryV1 {
        expected_generation: u64,
        expected_integrity: String,
        operation_id: String,
        decision: BoundaryV1,
        change: Box<BoundaryChange>,
    },
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
        dispatch: Box<ActiveDispatch>,
        decision: BoundaryDecision,
    },
    ApplyExecutionPatch {
        expected_generation: u64,
        expected_integrity: String,
        operation_id: String,
        patch: ExecutorPatch,
        commit_paths: BTreeMap<String, Vec<String>>,
        staged_paths: Vec<String>,
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
    shared: Option<oneshot::Sender<Result<Arc<View>>>>,
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
                    if let Some(reply) = request.shared {
                        let result = writer.refresh().map(|()| writer.view.clone());
                        let _ = reply.send(result);
                        continue;
                    }
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

    pub async fn shared_view(&self) -> Result<Arc<View>> {
        let (reply, completion) = oneshot::channel();
        let (unused, _) = oneshot::channel();
        self.requests.send(Request { operation: Operation::ReadVerified, reply: unused,
            shared: Some(reply), #[cfg(test)] id: String::new() }).await.map_err(|_| Error::Closed)?;
        completion.await.map_err(|_| Error::Closed)?
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
                shared: None,
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

struct CheckedPolicy<P> {
    policy: P,
    check: Option<InputCheck>,
}

impl<P: Policy> Policy for CheckedPolicy<P> {
    fn validate(&mut self, context: &MutationContext<'_>) -> Result<()> {
        if let Some(check) = &mut self.check {
            check()?;
        }
        self.policy.validate(context)
    }

    fn validate_routing_admission(
        &mut self,
        context: &MutationContext<'_>,
        inputs: &cadence::execution::model::ConfigInputs,
    ) -> Result<()> {
        if let Some(check) = &mut self.check {
            check()?;
        }
        self.policy.validate_routing_admission(context, inputs)
    }
}

struct Writer<S: Storage, P: Policy> {
    storage: S,
    policy: CheckedPolicy<P>,
    view: Arc<View>,
    identity: Option<super::cache::Identity>,
    observed: BTreeMap<String, Observed>,
    failed: Option<Error>,
}

impl<S: Storage, P: Policy> Writer<S, P> {
    fn open(mut storage: S, mut policy: P) -> Result<Self> {
        let _ownership = storage.acquire()?;
        super::transaction::recover(&mut storage, &mut policy)?;
        let identity = storage.root().map(super::cache::identity).transpose()?;
        let (view, observed) = Self::observe(&mut storage)?;
        if identity != storage.root().map(super::cache::identity).transpose()? {
            return Err(Error::Conflict("store changed while opening".into()));
        }
        let mut writer = Self {
            storage,
            policy: CheckedPolicy {
                policy,
                check: None,
            },
            observed,
            identity,
            view: Arc::new(view),
            failed: None,
        };
        writer.repair_snapshot()?;
        writer.publish()?;
        Ok(writer)
    }

    /// GH-262: what the parse restored from the decisions log is persisted as
    /// its own generation, under its own intent, so every later write starts
    /// from a snapshot that matches its log. The view keeps the ids so the
    /// answer that opened the store can say so.
    fn repair_snapshot(&mut self) -> Result<()> {
        let repaired = self.view.snapshot.repaired.clone();
        if repaired.is_empty() {
            return Ok(());
        }
        let mut operations = self.view.snapshot.operations.clone();
        operations.insert(super::transaction::snapshot_repair_operation(self.next_generation()?),
            model::digest(&serde_json::to_vec(&repaired)?));
        let next = self.view.as_ref().clone();
        self.persist(next, operations, Vec::new(), "snapshot_repair",
            super::transaction::IntentKind::SnapshotRepairV1 { repaired: repaired.clone() })?;
        Arc::make_mut(&mut self.view).snapshot.repaired = repaired;
        Ok(())
    }

    fn observe(storage: &mut S) -> Result<(View, BTreeMap<String, Observed>)> {
        let observed = Self::read_files(storage)?;
        let view = Self::parse(&observed)?;
        Ok((view, observed))
    }

    fn read_files(storage: &mut S) -> Result<BTreeMap<String, Observed>> {
        let mut observed = BTreeMap::new();
        for name in [ITEMS, DECISIONS, STATE] {
            observed.insert(name.to_string(), storage.read(name)?);
        }
        Ok(observed)
    }

    /// The view of the bytes read. Parsing is the cost of an operation on a
    /// large store (GH-261), so `execute` parses only bytes it has not seen.
    fn parse(observed: &BTreeMap<String, Observed>) -> Result<View> {
        #[cfg(test)]
        PARSES.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
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
        if decisions.iter().any(|record| {
            matches!(&record.decision,
            model::Decision::BoundaryV1(value) if value.store_generation > snapshot.generation)
        }) {
            return Err(Error::Invalid(
                "boundary generation exceeds snapshot".into(),
            ));
        }
        Ok(View {
            items,
            decisions,
            snapshot,
        })
    }

    fn publish(&self) -> Result<()> {
        if let (Some(root), Some(identity)) = (self.storage.root(), &self.identity) {
            super::cache::publish(root, identity.clone(), self.view.clone())?;
        }
        Ok(())
    }

    fn refresh(&mut self) -> Result<()> {
        let _ownership = self.storage.acquire()?;
        self.refresh_owned()
    }

    fn refresh_owned(&mut self) -> Result<()> {
        if let Some(error) = &self.failed { return Err(error.clone()); }
        if let Err(error) = super::transaction::recover(&mut self.storage, &mut self.policy) {
            // Recovery can install participants just like commit. A failed
            // attempt requires a replacement owner, not a retry on this writer.
            self.failed = Some(error.clone());
            return Err(error);
        }
        let identity = self.storage.root().map(super::cache::identity).transpose()?;
        if identity.is_some() && identity == self.identity {
            return Ok(());
        }
        let observed = Self::read_files(&mut self.storage)?;
        if identity != self.storage.root().map(super::cache::identity).transpose()? {
            return Err(Error::Conflict("store changed while reading".into()));
        }
        if observed != self.observed {
            let view = Self::parse(&observed)?;
            if view.snapshot.generation <= self.view.snapshot.generation
                || !view.items.starts_with(&self.view.items)
                || !view.decisions.starts_with(&self.view.decisions)
                || self.observed.iter().any(|(name, previous)| {
                    observed[name].directory_identity != previous.directory_identity
                })
            {
                return Err(Error::Conflict(
                    "externally changed store generation".into(),
                ));
            }
            self.view = Arc::new(view);
            self.observed = observed;
            self.identity = identity.clone();
            self.repair_snapshot()?;
            self.publish()?;
            return Ok(());
        }
        self.identity = identity;
        self.publish()?;
        Ok(())
    }

    fn execute(&mut self, operation: Operation) -> Result<View> {
        if let Some(error) = &self.failed {
            return Err(error.clone());
        }
        // Unverified reads expose the last confirmed view, even if external
        // bytes have since changed. Only verified reads and writes refresh it.
        if matches!(operation, Operation::Read) {
            return Ok(self.view.as_ref().clone());
        }
        let _ownership = self.storage.acquire()?;
        self.refresh_owned()?;
        match operation {
            Operation::VerificationRunV1 { expected_generation, expected_integrity, record } =>
                self.verification_run(expected_generation, &expected_integrity, *record),
            Operation::VerificationV1 { expected_generation, expected_integrity, request } =>
                self.verification(expected_generation, &expected_integrity, *request),
            Operation::AdoptionDeclareV1 { expected_generation, expected_integrity, record, request_id } =>
                self.adoption_declare(expected_generation, &expected_integrity, *record, request_id),
            Operation::NativeTaskV1 { expected_generation, expected_integrity, request } =>
                self.native_task(expected_generation, &expected_integrity, *request),
            Operation::NativePlanV1 { expected_generation, expected_integrity, request } =>
                self.native_plan(expected_generation, &expected_integrity, *request),
            Operation::NativeAdmissionV1 {expected_generation,expected_integrity,request} =>
                self.native_admission(expected_generation,&expected_integrity,*request),
            Operation::CheckedTransact {
                mut check,
                transaction,
            } => {
                check()?;
                self.policy.check = Some(check);
                let result = self.execute_store(
                    transaction.map_or(Operation::ReadVerified, Operation::Transact),
                );
                self.policy.check = None;
                result
            }
            Operation::RailReceipt {
                expected_generation,
                expected_integrity,
                record,
            } => self.rail_receipt(expected_generation, &expected_integrity, *record),
            Operation::RailObservation {
                expected_generation,
                expected_integrity,
                record,
            } => self.rail_observation(expected_generation, &expected_integrity, *record),
            Operation::GuardAudit(audit) => self.guard_audit(audit),
            Operation::BoundaryV1 {
                expected_generation,
                expected_integrity,
                operation_id,
                decision,
                change,
            } => self.boundary_v1(
                expected_generation,
                &expected_integrity,
                &operation_id,
                decision,
                *change,
            ),
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
                *dispatch,
                decision,
            ),
            Operation::ApplyExecutionPatch {
                expected_generation,
                expected_integrity,
                operation_id,
                patch,
                commit_paths,
                staged_paths,
                decision,
                render_version,
                complete_phase,
            } => self.apply_execution_patch(
                expected_generation,
                &expected_integrity,
                &operation_id,
                patch,
                commit_paths,
                staged_paths,
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
        let mut next = self.view.as_ref().clone();
        let mut external = Vec::new();
        let mut operations = next.snapshot.operations.clone();
        let mut verification_claim = None;
        let operation_name = match operation {
            Operation::ObservePlan { phase, plan, reply } => {
                self.revalidate()?;
                self.policy.validate(&MutationContext {
                    operation: "plan_prepare",
                    snapshot: &self.view.snapshot,
                })?;
                let result = self.storage.read(&format!("phase-plan:{phase}:{plan}"));
                let _ = reply.send(result);
                return Ok(next);
            }
            Operation::ObserveContext { phase, reply } => {
                self.revalidate()?;
                self.policy.validate(&MutationContext {
                    operation: "context_prepare",
                    snapshot: &self.view.snapshot,
                })?;
                let result = if phase == 0 {
                    Err(Error::Invalid("context needs a positive phase".into()))
                } else {
                    self.storage.read(&format!("phase-context:{phase}"))
                };
                let _ = reply.send(result);
                return Ok(next);
            }
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
                verification_claim = self.verification_claim(&transaction)?;
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
            Operation::CheckedTransact { .. }
            | Operation::VerificationRunV1 { .. }
            | Operation::VerificationV1 { .. }
            | Operation::AdoptionDeclareV1 { .. }
            | Operation::RailReceipt { .. }
            | Operation::RailObservation { .. }
            | Operation::GuardAudit(..)
            | Operation::BoundaryV1 { .. }
            | Operation::NativeAdmissionV1 { .. }
            | Operation::NativeTaskV1 { .. }
            | Operation::NativePlanV1 { .. }
            | Operation::AdmitExecution { .. }
            | Operation::ApplyExecutionPatch { .. }
            | Operation::RecordExecutionRefusal { .. } => {
                unreachable!("execution operations are handled before store operations")
            }
        };
        let mut participants = Vec::new();
        let mut context_phase = None;
        let mut plan_phase = None;
        let mut plan_documents = Vec::new();
        let mut requirements: Option<super::transaction::ExternalChange> = None;
        for change in external {
            let plan_target = super::filesystem::phase_plan_target(&change.target)?;
            if let Some((phase, plan)) = plan_target {
                if plan_phase.is_some_and(|old| old != phase) {
                    return Err(Error::Invalid(
                        "plan publication requires same-phase targets".into(),
                    ));
                }
                cadence::plan::persistence::validate_old_document(&self.view.snapshot.data, phase, plan, change.expected.bytes.as_deref())?;
                plan_phase = Some(phase);
                plan_documents.push((plan, change.bytes.clone()));
            }
            let phase = super::filesystem::phase_context_target(&change.target)?;
            if let Some(phase) = phase {
                if context_phase.replace(phase).is_some() {
                    return Err(Error::Invalid("duplicate context participant".into()));
                }
                cadence::context::persistence::validate_publication(
                    &self.view.snapshot.data,
                    &next.snapshot.data,
                    phase,
                    &change.bytes,
                )
                .map_err(|error| Error::Invalid(error.to_string()))?;
            }
            let uat_phase = super::filesystem::phase_uat_target(&change.target)?;
            if let Some(uat_phase) = uat_phase {
                // UAT.md is installed only by its human result intent, and only
                // as the render of the snapshot that intent commits.
                match &verification_claim {
                    Some(super::transaction::IntentKind::VerificationHumanV1 { claim, .. })
                        if claim.request.submission.phase == uat_phase =>
                    {
                        let rendered = cadence::verification::projections::uat(&next.snapshot.data, uat_phase)?;
                        if rendered.map(String::into_bytes).as_ref() != Some(&change.bytes) {
                            return Err(Error::Invalid("UAT participant differs from the native render".into()));
                        }
                    }
                    _ => return Err(Error::Invalid("UAT.md needs its human result intent".into())),
                }
            }
            let projection = super::filesystem::projection_target(&change.target);
            if projection.is_some() {
                match &verification_claim {
                    // Completion installs exactly its own rendered projections.
                    Some(super::transaction::IntentKind::VerificationCompleteV1 { claim, .. }) => {
                        let installed = cadence::verification::completion::installed(claim)?;
                        if installed.iter().find(|(target, _)| *target == change.target).map(|(_, bytes)| bytes) != Some(&change.bytes) {
                            return Err(Error::Invalid("projection participant differs from the completion render".into()));
                        }
                    }
                    None if change.target == "requirements" && requirements.is_none() => requirements = Some(change.clone()),
                    _ => return Err(Error::Invalid("projection participant needs its owning intent".into())),
                }
            }
            if phase.is_none()
                && plan_target.is_none()
                && uat_phase.is_none()
                && projection.is_none()
                && !matches!(change.target.as_str(), "repo-config" | "global-config")
            {
                return Err(Error::Invalid("unknown external participant".into()));
            }
            change.validate(&self.storage.read(&change.target)?, false)?;
            if change.target == "global-config"
                && let Some(data) = next.snapshot.data.as_object_mut()
            {
                // The store is the global layer's only writer; its record of
                // the bytes lets a relocated home prove the layer is the same.
                // The import manifest is history and is never touched.
                let layers = data
                    .entry("layers")
                    .or_insert_with(|| Value::Object(Default::default()));
                if let Some(layers) = layers.as_object_mut() {
                    layers.insert(
                        "global_content".into(),
                        Value::String(model::digest(&change.bytes)),
                    );
                }
            }
            participants.push(super::transaction::Participant {
                target: change.target,
                expected: change.expected,
                bytes: change.bytes,
            });
        }
        let plan_intent = if let Some(phase) = plan_phase {
            if context_phase.is_some()
                || participants.len() != plan_documents.len() + usize::from(requirements.is_some())
                || next.items != self.view.items
                || next.decisions != self.view.decisions
            {
                return Err(Error::Invalid("mixed plan publication participants".into()));
            }
            // The trace seed is recomputed from the exact preimage this writer
            // observes now; a differing participant or a missing seed refuses.
            let preimage = self.storage.read("requirements")?;
            if let Some(change) = &requirements
                && change.expected != preimage
            {
                return Err(Error::Conflict("pending participant changed: requirements".into()));
            }
            let seeded = cadence::plan::persistence::seeded_requirements(
                &self.view.snapshot.data, &next.snapshot.data, phase, preimage.bytes.as_deref())?;
            if requirements.as_ref().map(|c| c.bytes.as_slice()) != seeded.as_ref().map(|(bytes, _)| bytes.as_slice()) {
                return Err(Error::Invalid("requirements-projection: REQUIREMENTS.md participant differs from seeding the observed preimage".into()));
            }
            let seeded_ids = seeded.map(|(_, ids)| ids);
            let observed = self
                .storage
                .read(&format!("phase-plan-inventory:{phase}"))?;
            let inventory = cadence::plan::inventory::with_records(
                serde_json::from_slice(
                    observed
                        .bytes
                        .as_deref()
                        .ok_or_else(|| Error::Invalid("missing plan inventory".into()))?,
                )?,
                &phase.to_string(),
                &self.view.snapshot.data,
            )
            .map_err(|e| Error::Conflict(e.to_string()))?;
            cadence::plan::persistence::validate_publication(
                &self.view.snapshot.data,
                &next.snapshot.data,
                phase,
                &inventory,
                &plan_documents,
            )
            .map_err(|e| cadence::plan::limits::disposition(e, Error::Conflict))?;
            Some(super::transaction::IntentKind::PlanPublication {
                phase,
                inventory: Box::new(inventory),
                requirements: seeded_ids,
            })
        } else {
            None
        };
        self.persist(
            next,
            operations,
            participants,
            operation_name,
            if let Some(intent) = verification_claim {
                intent
            } else { plan_intent.unwrap_or(match context_phase {
                Some(phase) => super::transaction::IntentKind::ContextPublication { phase },
                None => super::transaction::IntentKind::Store,
            }) },
        )
    }

    /// A verification claim transaction carries exactly one decision whose
    /// source names its claim kind. The claim is recomputed on the committing
    /// snapshot, root, source and installed plans included, and a differing
    /// claim, transaction identity or fingerprint is a conflict, never a write.
    fn verification_claim(&self, transaction: &super::transaction::Transaction) -> Result<Option<super::transaction::IntentKind>> {
        use cadence::verification::{completion, human, verdicts, waivers};
        use super::transaction::{IntentKind, Transaction};
        let Some(record) = transaction.decisions.iter().find(|d| matches!(d.origin.source.as_str(),
            verdicts::SCHEMA | waivers::SCHEMA | human::SCHEMA | completion::SCHEMA)) else {
            return Ok(None);
        };
        let external: Vec<_> = transaction.external.iter().map(|c| c.target.as_str()).collect();
        let encoded_claim = match &record.decision {
            model::Decision::Gate { evidence: model::Evidence::Text(encoded), .. } => encoded,
            _ => return Err(Error::Invalid("verification claim encoding invalid".into())),
        };
        let expected_external: Vec<String> = match record.origin.source.as_str() {
            human::SCHEMA => {
                let claim: human::Claim = serde_json::from_str(encoded_claim)?;
                vec![format!("phase-uat:{}", claim.request.submission.phase)]
            }
            completion::SCHEMA => {
                let claim: completion::Claim = serde_json::from_str(encoded_claim)?;
                completion::installed(&claim)?.into_iter().map(|(target, _)| target).collect()
            }
            _ => vec![],
        };
        if transaction.decisions.len() != 1 || !transaction.items.is_empty() || external != expected_external {
            return Err(Error::Invalid("verification claim transaction carries exactly one claim and its own participants".into()));
        }
        let model::Decision::Gate { evidence: model::Evidence::Text(encoded), .. } = &record.decision else {
            return Err(Error::Invalid("verification claim encoding invalid".into()));
        };
        let root_binding = self.observed[STATE].directory_identity.clone();
        let data = &self.view.snapshot.data;
        let same = |expected: Transaction| -> Result<bool> {
            Ok(transaction.fingerprint()? == expected.fingerprint()? && transaction.id == expected.id)
        };
        let intent = match record.origin.source.as_str() {
            verdicts::SCHEMA => {
                let claim: verdicts::Claim = serde_json::from_str(encoded)?;
                let current = verdicts::prepare(&claim.root, data, claim.patch.clone())?;
                if claim != current || !same(verdicts::transaction(data, &claim)?)? || claim.root_binding != root_binding {
                    return Err(Error::Conflict("verification claim changed at committing snapshot".into()));
                }
                IntentKind::VerificationSubmitV1 { root_binding, claim: Box::new(claim) }
            }
            waivers::SCHEMA => {
                let claim: waivers::Claim = serde_json::from_str(encoded)?;
                let current = waivers::prepare(&claim.root, data, claim.request.clone())?;
                if claim != current || !same(waivers::transaction(data, &claim)?)? || claim.root_binding != root_binding {
                    return Err(Error::Conflict("waiver claim changed at committing snapshot".into()));
                }
                IntentKind::VerificationWaiverV1 { root_binding, claim: Box::new(claim) }
            }
            human::SCHEMA => {
                let claim: human::Claim = serde_json::from_str(encoded)?;
                let current = human::prepare(&claim.root, data, claim.request.clone())?;
                let expected = transaction.external.first().map(|c| c.expected.clone())
                    .ok_or_else(|| Error::Invalid("human result lacks its UAT participant".into()))?;
                if claim != current || !same(human::transaction(data, &claim, expected)?)? || claim.root_binding != root_binding {
                    return Err(Error::Conflict("human result claim changed at committing snapshot".into()));
                }
                IntentKind::VerificationHumanV1 { root_binding, claim: Box::new(claim) }
            }
            completion::SCHEMA => {
                let claim: completion::Claim = serde_json::from_str(encoded)?;
                let current = completion::prepare(&claim.root, data, claim.request.clone())?;
                let expected: Vec<_> = transaction.external.iter().map(|c| c.expected.clone()).collect();
                if claim != current || !same(completion::transaction(data, &claim, &expected)?)? || claim.root_binding != root_binding {
                    return Err(Error::Conflict("completion claim changed at committing snapshot".into()));
                }
                IntentKind::VerificationCompleteV1 { root_binding, claim: Box::new(claim) }
            }
            _ => unreachable!("matched claim sources"),
        };
        Ok(Some(intent))
    }

    fn verification_run(&mut self, generation: u64, integrity: &str, record: cadence::verification::runner::Record) -> Result<View> {
        use cadence::verification::runner;
        let binding = self.observed[STATE].directory_identity.clone();
        if let Some(prior) = runner::records(&self.view.snapshot.data)?.iter().find(|r| r.id == record.id) {
            return if prior == &record && model::retained(&self.view.decisions, &runner::decision(prior)?) { Ok(self.view.as_ref().clone()) }
                else { Err(Error::Invalid("verification run request reused".into())) };
        }
        self.check_expected(generation, integrity)?;
        runner::reobserve_launch(&self.view.snapshot.data, &record)?;
        let mut next = self.view.as_ref().clone();
        next.snapshot.data = runner::contribute(&next.snapshot.data, &binding, &record)?;
        next.decisions.push(runner::decision(&record)?);
        self.persist(next, self.view.snapshot.operations.clone(), Vec::new(), "verification_run",
            super::transaction::IntentKind::VerificationRunV1 { record: Box::new(record), root_binding: binding })
    }

    /// The owner's explicit adoption of one ticked phase: the record lands
    /// under the adoption namespace through its own intent, at the generation
    /// it names, and only while ROADMAP.md still holds the bytes it was read
    /// from. A request id already answered replays; a reused one conflicts.
    fn adoption_declare(&mut self, generation: u64, integrity: &str, record: cadence::adoption::Record, request_id: String) -> Result<View> {
        use cadence::adoption;
        let binding = self.observed[STATE].directory_identity.clone();
        if let Some(prior) = adoption::receipt(&self.view.snapshot.data, &request_id)? {
            return if prior.record == record.id { Ok(self.view.as_ref().clone()) }
                else { Err(Error::Conflict("request-id-reuse: adoption request already names another record".into())) };
        }
        self.check_expected(generation, integrity)?;
        if record.root_binding != binding {
            return Err(Error::Invalid("declared record root binding differs from the bound store".into()));
        }
        if record.import_generation != self.next_generation()? {
            return Err(Error::Invalid("declared record names a generation other than its commit".into()));
        }
        let roadmap = self.storage.read("roadmap")?;
        if roadmap.bytes.as_deref().map(model::digest).as_deref() != Some(record.roadmap.digest.as_str()) {
            return Err(Error::Conflict("ROADMAP.md changed after the declaration was computed".into()));
        }
        let mut next = self.view.as_ref().clone();
        next.snapshot.data = adoption::declare(&next.snapshot.data, &record, &request_id)?;
        self.persist(next, self.view.snapshot.operations.clone(), Vec::new(), "adoption_declare",
            super::transaction::IntentKind::AdoptionDeclareV1 { record: Box::new(record), request_id, root_binding: binding })
    }

    fn verification(&mut self, generation: u64, integrity: &str, request: cadence::verification::persistence::Request) -> Result<View> {
        use cadence::verification::{inputs, persistence};
        let root_binding = self.observed[STATE].directory_identity.clone();
        if let Some(prior) = persistence::replay(&self.view.snapshot.data,
            request.attempt.inputs.basis.phase, &request.attempt.request_id)? {
            if prior != request.attempt || !model::retained(&self.view.decisions, &persistence::decision(&prior)?) {
                return Err(Error::Invalid("verification replay differs from retained attempt or journal".into()));
            }
            return Ok(self.view.as_ref().clone());
        }
        self.check_expected(generation, integrity)?;
        let current = inputs::observe(&request.root, &self.view.snapshot.data, request.attempt.inputs.basis.phase)?;
        if current != request.attempt.inputs { return Err(Error::Conflict("verification inputs changed at committing snapshot".into())); }
        let mut next = self.view.as_ref().clone();
        next.snapshot.data = persistence::contribute(&next.snapshot.data, &root_binding, &request)?;
        next.decisions.push(persistence::decision(&request.attempt)?);
        self.persist(next, self.view.snapshot.operations.clone(), Vec::new(), "verification",
            super::transaction::IntentKind::VerificationV1 { request: Box::new(request), root_binding })
    }

    fn native_task(&mut self, generation: u64, integrity: &str, request: cadence::execution::history::Request) -> Result<View> {
        use cadence::execution::history;
        let root_binding = self.observed[STATE].directory_identity.clone();
        if let Some(record) = history::replay(&self.view.snapshot.data, &request)? {
            if !history::decisions(&record)?.iter().all(|decision| model::retained(&self.view.decisions, decision)) {
                return Err(Error::Invalid("native task receipt lacks its immutable event".into()));
            }
            return Ok(self.view.as_ref().clone());
        }
        self.check_expected(generation, integrity)?;
        let (data, record) = history::contribute(&self.view.snapshot.data, &root_binding, &request)?;
        let mut next = self.view.as_ref().clone();
        next.snapshot.data = data;
        next.decisions.extend(history::decisions(&record)?);
        let participants = self.native_summary_participants(&next, request.task.phase)?;
        self.persist(next, self.view.snapshot.operations.clone(), participants, "native_task",
            super::transaction::IntentKind::NativeTaskV1 { request: Box::new(request), root_binding })
    }

    fn native_plan(&mut self, generation: u64, integrity: &str, request: cadence::execution::history::PlanRequest) -> Result<View> {
        use cadence::execution::history;
        let root_binding = self.observed[STATE].directory_identity.clone();
        if let Some(record) = history::plan_replay(&self.view.snapshot.data, &request)? {
            if !model::retained(&self.view.decisions, &history::plan_decision(&record)?) {
                return Err(Error::Invalid("native plan receipt lacks its immutable event".into()));
            }
            return Ok(self.view.as_ref().clone());
        }
        self.check_expected(generation, integrity)?;
        let (data, record) = history::plan_contribute(&self.view.snapshot.data, &root_binding, &request)?;
        let mut next = self.view.as_ref().clone();
        next.snapshot.data = data;
        next.decisions.push(history::plan_decision(&record)?);
        if let Some(outcome) = plan_routing_outcome(&self.view.snapshot.data, &self.view.decisions, &record) {
            next.decisions.push(outcome);
        }
        let participants = self.native_summary_participants(&next, request.plan.phase)?;
        self.persist(next, self.view.snapshot.operations.clone(), participants, "native_plan",
            super::transaction::IntentKind::NativePlanV1 { request: Box::new(request), root_binding })
    }

    fn native_summary_participants(&mut self, next: &View, phase: u32) -> Result<Vec<super::transaction::Participant>> {
        let key = cadence::execution::render::NATIVE_SUMMARIES;
        let name = phase.to_string();
        if next.snapshot.data[key]["phases"][&name] == self.view.snapshot.data[key]["phases"][&name] { return Ok(vec![]); }
        let bytes = next.snapshot.data[key]["phases"][&name].as_str()
            .ok_or_else(|| Error::Invalid("native summary is absent".into()))?.as_bytes().to_vec();
        let target = format!("phase-summary:{phase}");
        Ok(vec![super::transaction::Participant { expected: self.storage.read(&target)?, target, bytes }])
    }

    fn native_admission(&mut self, generation:u64, integrity:&str, request:cadence::execution::admission::Request) -> Result<View> {
        use cadence::execution::admission;
        let root_binding=self.observed[STATE].directory_identity.clone();
        if let Some(record)=admission::replay(&self.view.snapshot.data,&request)? {
            if !model::retained(&self.view.decisions, &admission::decision(&record)?) {
                return Err(Error::Invalid("native admission receipt lacks its immutable event".into()));
            }
            return Ok(self.view.as_ref().clone());
        }
        self.check_expected(generation,integrity)?;
        let inventory=self.storage.read(&format!("phase-plan-inventory:{}",request.contract.phase))?;
        let parsed:cadence::plan::inventory::Inventory=serde_json::from_slice(inventory.bytes.as_deref()
            .ok_or_else(||Error::Invalid("missing plan inventory".into()))?)?;
        let (data,record)=admission::contribute(&self.view.snapshot.data,&parsed.documents,&root_binding,&request)?;
        let mut next=self.view.as_ref().clone(); next.snapshot.data=data; next.decisions.push(admission::decision(&record)?);
        self.persist(next,self.view.snapshot.operations.clone(),Vec::new(),"native_admission",
            super::transaction::IntentKind::NativeAdmissionV1 {request:Box::new(request),root_binding,inventory})
    }

    fn boundary_v1(
        &mut self,
        expected_generation: u64,
        expected_integrity: &str,
        operation_id: &str,
        decision: BoundaryV1,
        change: BoundaryChange,
    ) -> Result<View> {
        let (change, issue) = match change {
            BoundaryChange::Issue { change, id, issue } => (*change, Some((id, issue))),
            change => (change, None),
        };
        self.revalidate()?;
        self.policy.validate(&MutationContext {
            operation: "boundary_v1",
            snapshot: &self.view.snapshot,
        })?;
        require_current_execution(&self.view).map_err(boundary_error)?;
        let native_inventory=if let BoundaryChange::Dispatch {dispatch,..}=&change
            && cadence::plan::persistence::saved(&self.view.snapshot.data,dispatch.phase)?.is_some_and(|o|!o.publications.is_empty())
        {
            let observed=self.storage.read(&format!("phase-plan-inventory:{}",dispatch.phase))?;
            let inventory:cadence::plan::inventory::Inventory=serde_json::from_slice(observed.bytes.as_deref().ok_or_else(||Error::Invalid("missing native inventory".into()))?)?;
            cadence::plan::persistence::require_execution_ready(&self.view.snapshot.data,dispatch.phase,&inventory.documents)?;
            Some(observed)
        } else {None};
        if !decision.scope.valid() {
            return Err(Error::Invalid("invalid boundary scope".into()));
        }
        if terminal_v1(&self.view, &decision.scope).is_some() {
            return Ok(self.view.as_ref().clone());
        }
        decision.validate(false).map_err(boundary_error)?;
        if operation_id.trim().is_empty() {
            return Err(Error::Invalid("empty operation identity".into()));
        }
        let fingerprint = operation_fingerprint(&("boundary-operation-v1", &decision, &change))?;
        if let Some(prior) = self.view.snapshot.operations.get(operation_id) {
            return if *prior == fingerprint {
                Ok(self.view.as_ref().clone())
            } else {
                Err(Error::Conflict(
                    "operation identity reused for different content".into(),
                ))
            };
        }
        let id = decision.identity().map_err(boundary_error)?;
        if self.view.decisions.iter().any(|record| record.id == id) {
            // A distinct caller ID cannot turn the same answer into another mutation.
            return if matches!(change, BoundaryChange::Observe) {
                Ok(self.view.as_ref().clone())
            } else {
                Err(Error::Conflict(
                    "boundary decision already admitted under another operation".into(),
                ))
            };
        }
        let count = self.view.decisions.iter().filter(|record| matches!(&record.decision,
            model::Decision::BoundaryV1(value) if value.boundary.scope == decision.scope && !value.terminal)).count();
        if count >= 256 {
            let terminal = BoundaryV1::terminal(decision.scope).map_err(boundary_error)?;
            let record = record_v1(terminal, self.next_generation()?, true)?;
            let kind = super::transaction::IntentKind::BoundaryObservationV1 {
                scope: match &record.decision {
                    model::Decision::BoundaryV1(value) => value.boundary.scope.clone(),
                    _ => unreachable!(),
                },
                decision_id: record.id.clone(),
            };
            let mut next = self.view.as_ref().clone();
            next.decisions.push(record);
            model::validate_decisions(&next.decisions)?;
            return self.persist(
                next,
                self.view.snapshot.operations.clone(),
                Vec::new(),
                "boundary_terminal_v1",
                kind,
            );
        }
        self.check_expected(expected_generation, expected_integrity)?;
        if let Some(evidence) = &decision.lease_refusal {
            if !matches!(change, BoundaryChange::Observe) {
                return Err(Error::Invalid(
                    "lease refusal must be an observation".into(),
                ));
            }
            let execution = execution_snapshot(&self.view.snapshot.data)?;
            let active = execution
                .occurrences
                .get(&evidence.paths.phase.to_string())
                .and_then(|o| o.active.as_ref())
                .ok_or_else(|| Error::Invalid("lease refusal lacks its open dispatch".into()))?;
            evidence.validate_active(active).map_err(boundary_error)?;
        }
        let mut next = self.view.as_ref().clone();
        let mut participants = Vec::new();
        let kind = match change {
            BoundaryChange::Issue { .. } => return Err(Error::Invalid("nested dispatch issue".into())),
            BoundaryChange::FinalizeRisk {
                phase,
                requirements,
            } => {
                if decision.scope != (BoundaryScope::Execution { phase })
                    || decision.tool != BoundaryTool::CadenceQuery
                    || decision.receipt
                        != (Receipt::Compact {
                            envelope: Envelope::Ok(Success::Complete { phase }),
                        })
                {
                    return Err(Error::Invalid("invalid risk finalization boundary".into()));
                }
                next.snapshot.data = cadence::rail::receipts::finalize_execution(
                    &next.snapshot.data,
                    phase,
                    &requirements,
                )
                .map_err(rail_error)?;
                let execution = execution_snapshot(&next.snapshot.data)?;
                let target = format!("phase-summary:{phase}");
                participants.push(super::transaction::Participant {
                    expected: self.storage.read(&target)?,
                    target,
                    bytes: cadence::execution::render::render_phase_summary(&execution, phase)
                        .map_err(|e| Error::Invalid(e.to_string()))?,
                });
                super::transaction::IntentKind::ExecutionFinalizeRiskV1 {
                    phase,
                    decision_id: id.clone(),
                    requirements,
                }
            }
            BoundaryChange::Observe => super::transaction::IntentKind::BoundaryObservationV1 {
                scope: decision.scope.clone(),
                decision_id: id.clone(),
            },
            BoundaryChange::Dispatch {
                plan_set_fingerprint,
                dispatch,
            } => {
                let phase = dispatch.phase;
                if let Some(routing) = routing_decision(&dispatch)? {
                    next.decisions.push(routing);
                }
                if decision.scope != (BoundaryScope::Execution { phase })
                    || decision.tool != BoundaryTool::CadenceQuery
                    || decision.receipt
                        != (Receipt::Dispatch {
                            dispatch_id: dispatch.id.clone(),
                            prompt_bytes: None,
                            prompt_digest: dispatch.prompt_digest.clone(),
                        })
                    || plan_set_fingerprint != dispatch.plan_set_fingerprint
                {
                    return Err(Error::Invalid("dispatch boundary identity mismatch".into()));
                }
                let mut execution = execution_snapshot(&next.snapshot.data)?;
                let occurrence = execution
                    .occurrences
                    .entry(phase.to_string())
                    .or_insert_with(|| ExecutionOccurrence {
                        phase,
                        plan_set_fingerprint,
                        version: dispatch.expected_execution_version,
                        active: None,
                        plans: Vec::new(),
                        terminal: None,
                        receipts: BTreeMap::new(), issues: BTreeMap::new(),
                    });
                let (occurrence, _) =
                    cadence::execution::dispatch::admit_dispatch(occurrence, dispatch)
                        .map_err(|error| Error::Conflict(error.to_string()))?;
                execution.occurrences.insert(phase.to_string(), occurrence);
                install_execution(&mut next.snapshot.data, execution)?;
                match native_inventory {
                    Some(inventory)=>super::transaction::IntentKind::NativeExecutionDispatchV1 {phase,decision_id:id.clone(),inventory},
                    None=>super::transaction::IntentKind::ExecutionDispatchV1 {phase,decision_id:id.clone()},
                }
            }
            BoundaryChange::Reissue {
                issue_dispatch_id,
                dispatch,
            } => {
                let phase = dispatch.phase;
                if decision.scope != (BoundaryScope::Execution { phase })
                    || decision.tool != BoundaryTool::CadenceQuery
                    || decision.receipt
                        != (Receipt::Dispatch {
                            dispatch_id: issue_dispatch_id.clone(),
                            prompt_bytes: None,
                            prompt_digest: if issue.is_some() { String::new() } else { dispatch.prompt_digest.clone() },
                        })
                    || dispatch.issue_digest.len() != 64
                    || !dispatch.issue_digest.bytes().all(|byte| byte.is_ascii_hexdigit())
                    || (!dispatch.prompt_digest.is_empty() && crate::store::model::digest(dispatch.prompt.as_bytes()) != dispatch.prompt_digest)
                {
                    return Err(Error::Invalid("dispatch re-issue boundary identity mismatch".into()));
                }
                let mut execution = execution_snapshot(&next.snapshot.data)?;
                let active = execution
                    .occurrences
                    .get_mut(&phase.to_string())
                    .and_then(|occurrence| occurrence.active.as_mut())
                    .ok_or_else(|| Error::Invalid("dispatch re-issue lacks an active dispatch".into()))?;
                let mut expected = active.clone();
                expected.prompt = dispatch.prompt.clone();
                expected.prompt_digest = dispatch.prompt_digest.clone();
                expected.issue_digest = dispatch.issue_digest.clone();
                if expected != dispatch {
                    return Err(Error::Invalid("dispatch re-issue changed admitted identity".into()));
                }
                *active = dispatch;
                install_execution(&mut next.snapshot.data, execution)?;
                super::transaction::IntentKind::NativeExecutionReissueV1 {
                    phase,
                    decision_id: id.clone(),
                    issue_dispatch_id,
                }
            }
            BoundaryChange::Patch {
                patch,
                commit_paths,
                staged_paths,
                render_version,
                complete_phase,
            } => {
                let BoundaryScope::Execution { phase } = decision.scope else {
                    return Err(Error::Invalid("patch lacks execution scope".into()));
                };
                cadence::plan::persistence::require_legacy_execution(&self.view.snapshot.data,phase)?;
                let risk_pending = matches!(&decision.receipt, Receipt::Compact {
                    envelope: Envelope::Refused { code, .. }
                } if code == "risk-pending")
                    && !complete_phase
                    && patch.outcome == PlanDisposition::Complete;
                if render_version != cadence::execution::render::SUMMARY_RENDER_VERSION
                    || decision.tool != BoundaryTool::CadenceApply
                    || decision.subject_id.as_ref() != Some(&patch.dispatch_id)
                    || (!risk_pending
                        && !matches!(
                            &decision.receipt,
                            Receipt::Compact {
                                envelope: Envelope::Ok(_)
                            }
                        ))
                    || (complete_phase && patch.outcome != PlanDisposition::Complete)
                {
                    return Err(Error::Invalid("invalid execution patch operation".into()));
                }
                let application =
                    cadence::execution::patch::apply_executor_patch(&next.snapshot.data, &patch)
                        .map_err(|error| Error::Invalid(error.to_string()))?;
                let application = cadence::execution::patch::attach_commit_paths(
                    application,
                    &commit_paths,
                    &staged_paths,
                )
                .map_err(|error| Error::Invalid(error.to_string()))?;
                if application.outcome.phase != phase
                    || application.disposition
                        == cadence::execution::patch::ApplicationDisposition::Replay
                {
                    return Err(Error::Conflict(
                        "patch replay lacks its original operation".into(),
                    ));
                }
                let active = execution_snapshot(&next.snapshot.data)?
                    .occurrences
                    .get(&phase.to_string())
                    .and_then(|o| o.active.clone())
                    .ok_or_else(|| {
                        Error::Invalid("accepted risk material lacks dispatch base".into())
                    })?;
                let basis = cadence::rail::risk::ExecutionBasis::from_accepted(
                    &active,
                    &application.outcome,
                )
                .map_err(rail_error)?;
                next.snapshot.data =
                    cadence::rail::risk::project_execution_basis(&application.data, &basis)
                        .map_err(rail_error)?;
                let mut execution = execution_snapshot(&next.snapshot.data)?;
                if complete_phase {
                    let occurrence = execution
                        .occurrences
                        .get_mut(&phase.to_string())
                        .ok_or_else(|| {
                            Error::Invalid("patch execution occurrence is absent".into())
                        })?;
                    if occurrence.terminal.is_some() {
                        return Err(Error::Conflict(
                            "execution occurrence is already terminal".into(),
                        ));
                    }
                    occurrence.terminal = Some(TerminalOutcome::Complete { phase });
                }
                install_execution(&mut next.snapshot.data, execution.clone())?;
                // P9: a schema-1 patch answers the dispatch, so the routing
                // decision's outcome edge names the boundary record that took it.
                if let Some(outcome) = routing_outcome(&self.view.decisions, &patch.dispatch_id, &id) {
                    next.decisions.push(outcome);
                }
                let target = format!("phase-summary:{phase}");
                participants.push(super::transaction::Participant {
                    expected: self.storage.read(&target)?,
                    target,
                    bytes: cadence::execution::render::render_phase_summary(&execution, phase)
                        .map_err(|error| Error::Invalid(error.to_string()))?,
                });
                super::transaction::IntentKind::ExecutionPatchV1 {
                    phase,
                    decision_id: id.clone(),
                    render_version,
                    risk_basis: Some(Box::new(basis)),
                }
            }
        };
        if let Some((issue_id, issue)) = issue {
            let BoundaryScope::Execution { phase } = decision.scope else {
                return Err(Error::Invalid("dispatch issue lacks execution scope".into()));
            };
            let mut execution = execution_snapshot(&next.snapshot.data)?;
            let occurrence = execution.occurrences.get_mut(&phase.to_string())
                .ok_or_else(|| Error::Invalid("dispatch issue lacks occurrence".into()))?;
            let active = occurrence.active.as_ref()
                .ok_or_else(|| Error::Invalid("dispatch issue lacks active dispatch".into()))?;
            if issue.binding != cadence::execution::dispatch::issue_binding(&next.snapshot.data, active)?
                || issue.issue_digest != cadence::execution::dispatch::binding_digest(&issue.binding)?
                || issue.issue_digest != active.issue_digest
                || issue.operational["dispatch_id"] != issue_id
                || decision.subject_id.as_ref() != Some(&issue_id)
            { return Err(Error::Invalid("dispatch issue binding mismatch".into())); }
            if occurrence.issues.insert(issue_id, issue).is_some() {
                return Err(Error::Conflict("dispatch issue already exists".into()));
            }
            install_execution(&mut next.snapshot.data, execution)?;
        }
        next.decisions
            .push(record_v1(decision, self.next_generation()?, false)?);
        model::validate_decisions(&next.decisions)?;
        let mut operations = next.snapshot.operations.clone();
        operations.insert(operation_id.to_owned(), fingerprint);
        self.persist(next, operations, participants, "boundary_v1", kind)
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
        self.revalidate()?;
        cadence::plan::persistence::require_legacy_execution(
            &self.view.snapshot.data,
            dispatch.phase,
        )?;
        if dispatch.route.is_some()
            || dispatch.policy.rung != cadence::execution::model::ExecutorRung::Fixed
        {
            return Err(Error::Invalid(
                "routed dispatch requires current boundary admission".into(),
            ));
        }
        if decision.phase != dispatch.phase
            || decision.subject_id.as_deref() != Some(dispatch.id.as_str())
            || decision.prompt_digest.as_ref() != Some(&dispatch.prompt_digest)
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
        cadence::plan::persistence::require_legacy_execution(&self.view.snapshot.data,decision.phase)?;
        let admission = self.boundary_admission(&decision)?;
        if matches!(admission, BoundaryAdmission::Replay) {
            self.revalidate()?;
            return Ok(self.view.as_ref().clone());
        }
        if matches!(admission, BoundaryAdmission::Terminal(_)) {
            return self.persist_terminal(admission, decision.phase);
        }
        self.check_expected(expected_generation, expected_integrity)?;

        let mut next = self.view.as_ref().clone();
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
                receipts: BTreeMap::new(), issues: BTreeMap::new(),
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
        staged_paths: Vec<String>,
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
        let fingerprint = if staged_paths.is_empty() {
            operation_fingerprint(&(
                "execution-patch",
                &patch,
                &commit_paths,
                &decision,
                render_version,
                complete_phase,
            ))?
        } else {
            operation_fingerprint(&(
                "execution-patch-staged-v1",
                &patch,
                &commit_paths,
                &staged_paths,
                &decision,
                render_version,
                complete_phase,
            ))?
        };
        if let Some(view) = self.execution_replay(operation_id, &fingerprint, decision.phase)? {
            return Ok(view);
        }
        let admission = self.boundary_admission(&decision)?;
        if matches!(admission, BoundaryAdmission::Replay) {
            self.revalidate()?;
            return Ok(self.view.as_ref().clone());
        }
        if matches!(admission, BoundaryAdmission::Terminal(_)) {
            return self.persist_terminal(admission, decision.phase);
        }
        self.check_expected(expected_generation, expected_integrity)?;

        let application =
            cadence::execution::patch::apply_executor_patch(&self.view.snapshot.data, &patch)
                .map_err(|error| Error::Invalid(error.to_string()))?;
        let application = cadence::execution::patch::attach_commit_paths(
            application,
            &commit_paths,
            &staged_paths,
        )
        .map_err(|error| Error::Invalid(error.to_string()))?;
        if application.disposition == cadence::execution::patch::ApplicationDisposition::Replay {
            self.revalidate()?;
            return Ok(self.view.as_ref().clone());
        }
        if application.outcome.phase != decision.phase {
            return Err(Error::Invalid("patch boundary phase mismatch".into()));
        }
        let mut next = self.view.as_ref().clone();
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
            return Ok(self.view.as_ref().clone());
        }
        if matches!(admission, BoundaryAdmission::Terminal(_)) {
            return self.persist_terminal(admission, decision.phase);
        }
        self.check_expected(expected_generation, expected_integrity)?;
        let mut next = self.view.as_ref().clone();
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
            return Ok(Some(self.view.as_ref().clone()));
        }
        if let Some(prior) = self.view.snapshot.operations.get(operation_id).cloned() {
            self.revalidate()?;
            return if prior == fingerprint {
                Ok(Some(self.view.as_ref().clone()))
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
        let mut next = self.view.as_ref().clone();
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

    fn rail_receipt(
        &mut self,
        expected_generation: u64,
        expected_integrity: &str,
        record: cadence::rail::receipts::RecordedFact,
    ) -> Result<View> {
        use cadence::rail::receipts;
        record.validate().map_err(rail_error)?;
        if let Some(old) = receipts::read(&self.view.snapshot.data)
            .map_err(rail_error)?
            .remove(&record.fact.key().map_err(rail_error)?)
        {
            return if old == record && model::retained(&self.view.decisions, &rail_fact_record(&record)?) {
                Ok(self.view.as_ref().clone())
            } else {
                Err(Error::Conflict("receipt request identity reused".into()))
            };
        }
        self.check_expected(expected_generation, expected_integrity)?;
        if record.confirmation.generation != self.next_generation()? {
            return Err(Error::Invalid(
                "receipt confirmation generation mismatch".into(),
            ));
        }
        let mut next = self.view.as_ref().clone();
        next.snapshot.data = receipts::project(&next.snapshot.data, &record).map_err(rail_error)?;
        next.decisions.push(rail_fact_record(&record)?);
        self.persist(
            next,
            self.view.snapshot.operations.clone(),
            Vec::new(),
            "rail_receipt",
            super::transaction::IntentKind::RailReceipt {
                record: Box::new(record),
            },
        )
    }

    fn rail_observation(
        &mut self,
        generation: u64,
        integrity: &str,
        record: cadence::rail::risk::Recorded,
    ) -> Result<View> {
        use cadence::rail::risk;
        record.validate().map_err(rail_error)?;
        if let Some(old) = risk::read(&self.view.snapshot.data)
            .map_err(rail_error)?
            .remove(&record.observation.key().map_err(rail_error)?)
        {
            return if old == record && model::retained(&self.view.decisions, &rail_record(&record)?) {
                Ok(self.view.as_ref().clone())
            } else {
                Err(Error::Conflict("rail request identity reused".into()))
            };
        }
        self.check_expected(generation, integrity)?;
        if record.confirmation.generation != self.next_generation()? {
            return Err(Error::Invalid(
                "rail confirmation generation mismatch".into(),
            ));
        }
        let mut next = self.view.as_ref().clone();
        next.snapshot.data = risk::project(&next.snapshot.data, &record).map_err(rail_error)?;
        next.decisions.push(rail_record(&record)?);
        model::validate_decisions(&next.decisions)?;
        self.persist(
            next,
            self.view.snapshot.operations.clone(),
            Vec::new(),
            "rail_observation",
            super::transaction::IntentKind::RailObservation {
                record: Box::new(record),
            },
        )
    }

    fn guard_audit(&mut self, audit: audit::Audit) -> Result<View> {
        let record = audit.record()?;
        if let Some(prior) = self.view.decisions.iter().find(|r| r.id == record.id) {
            return if audit.same_event(&audit::from_record(prior)?) {
                Ok(self.view.as_ref().clone())
            } else {
                Err(Error::Conflict(
                    "guard event identity reused for different command".into(),
                ))
            };
        }
        let mut next = self.view.as_ref().clone();
        next.snapshot.data = audit::project(&self.view.snapshot, &audit)?;
        next.decisions.push(record);
        model::validate_decisions(&next.decisions)?;
        self.persist(
            next,
            self.view.snapshot.operations.clone(),
            Vec::new(),
            "guard_audit",
            super::transaction::IntentKind::GuardAudit { audit },
        )
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
        let (snapshot, state) = Snapshot::sealed(generation, &items, &decisions, next.snapshot.data, operations)?;
        next.snapshot = snapshot;
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
            &next.snapshot,
            intent_kind,
            participants,
        ) {
            if error != Error::Conflict("routing inputs changed before admission".into()) {
                self.failed = Some(error.clone());
            }
            return Err(error);
        }
        let identity = self.storage.root().map(super::cache::identity).transpose()?;
        for name in [ITEMS, DECISIONS, STATE] {
            self.observed.insert(name.into(), self.storage.read(name)?);
        }
        if identity != self.storage.root().map(super::cache::identity).transpose()? {
            return Err(Error::Conflict("store changed after commit".into()));
        }
        self.identity = identity;
        self.view = Arc::new(next);
        self.publish()?;
        Ok(self.view.as_ref().clone())
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

pub(super) fn rail_error(error: cadence::store::Error) -> Error {
    Error::Invalid(error.to_string())
}

pub(super) fn rail_record(record: &cadence::rail::risk::Recorded) -> Result<DecisionRecord> {
    // The process-crash target compiles the writer in its own module. Decode the
    // shared record's wire shape just as the boundary adapter does for evidence.
    Ok(serde_json::from_value(serde_json::to_value(
        record.decision().map_err(rail_error)?,
    )?)?)
}

pub(super) fn rail_fact_record(
    record: &cadence::rail::receipts::RecordedFact,
) -> Result<DecisionRecord> {
    // The process-crash target compiles the writer in its own module. Decode the
    // shared record's wire shape just as the boundary adapter does for evidence.
    Ok(serde_json::from_value(serde_json::to_value(
        record.decision().map_err(rail_error)?,
    )?)?)
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
            prompt_digest: decision.prompt_digest.clone(),
            response_digest: decision.response_digest.clone(),
            terminal: false,
        },
        at: model::stamped_at(),
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
            prompt_digest: None,
            response_digest: identity,
            terminal: true,
        },
        at: model::stamped_at(),
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

fn boundary_error(error: Failure) -> Error {
    Error::Invalid(error.to_string())
}

fn record_v1(
    boundary: BoundaryV1,
    store_generation: u64,
    terminal: bool,
) -> Result<DecisionRecord> {
    boundary.validate(terminal).map_err(boundary_error)?;
    Ok(DecisionRecord {
        version: model::VERSION,
        id: boundary.identity().map_err(boundary_error)?,
        revision: 1,
        origin: model::Origin {
            source: "execution-boundary-v1".into(),
            original: model::Evidence::Missing,
        },
        decision: model::Decision::BoundaryV1(model::BoundaryRecordV1 {
            boundary,
            store_generation,
            terminal,
        }),
        at: model::stamped_at(),
    })
}

pub fn require_current_execution(view: &View) -> std::result::Result<(), Failure> {
    if view
        .decisions
        .iter()
        .any(|record| matches!(record.decision, model::Decision::Boundary { .. }))
    {
        return Err(Failure::LegacyExecution);
    }
    if let Some(occurrences) = view
        .snapshot
        .data
        .get("execution")
        .and_then(|value| value.get("occurrences"))
        .and_then(Value::as_object)
    {
        for key in occurrences.keys() {
            if !view.decisions.iter().any(|record| {
                matches!(&record.decision,
                model::Decision::BoundaryV1(value) if matches!(value.boundary.scope,
                    BoundaryScope::Execution { phase } if phase.to_string() == *key))
            }) {
                return Err(Failure::LegacyExecution);
            }
        }
    }
    if let Some(occurrences) = view
        .snapshot
        .data
        .get("execution")
        .and_then(|value| value.get("occurrences"))
        .and_then(Value::as_object)
    {
        for occurrence in occurrences.values() {
            if let Some(active) = occurrence.get("active").filter(|active| !active.is_null())
                && (active.get("route").is_some_and(|route| !route.is_null())
                    || matches!(
                        active["policy"]["rung"].as_str(),
                        Some("low" | "medium" | "high" | "xhigh" | "max")
                    ))
            {
                let dispatch: ActiveDispatch =
                    serde_json::from_value(active.clone()).map_err(|_| Failure::RoutingEvidence)?;
                validate_routing(&dispatch, &view.decisions)
                    .map_err(|_| Failure::RoutingEvidence)?;
                if !view.decisions.iter().any(|record| {
                    matches!(&record.decision, model::Decision::BoundaryV1(value)
                        if !value.terminal
                            && value.store_generation <= view.snapshot.generation
                            && value.boundary.scope == (BoundaryScope::Execution { phase: dispatch.phase })
                            && value.boundary.tool == BoundaryTool::CadenceQuery
                            && value.boundary.subject_id.as_ref() == Some(&dispatch.id)
                            && matches!(&value.boundary.receipt, Receipt::Dispatch { dispatch_id, .. }
                                if dispatch_id == &dispatch.id))
                }) {
                    return Err(Failure::RoutingEvidence);
                }
            }
        }
    }

    Ok(())
}

pub fn terminal_v1<'a>(view: &'a View, scope: &BoundaryScope) -> Option<ConfirmedBoundary<'a>> {
    view.decisions
        .iter()
        .find_map(|record| match &record.decision {
            model::Decision::BoundaryV1(value)
                if &value.boundary.scope == scope && value.terminal =>
            {
                Some(ConfirmedBoundary {
                    id: &record.id,
                    value,
                })
            }
            _ => None,
        })
}

pub struct ConfirmedBoundary<'a> {
    pub id: &'a str,
    pub value: &'a model::BoundaryRecordV1,
}

impl ConfirmedBoundary<'_> {
    pub fn envelope(
        &self,
        dispatch: Option<ExecutionEnvelope>,
    ) -> std::result::Result<ExecutionEnvelope, Failure> {
        self.value.boundary.validate(self.value.terminal)?;
        let envelope = match &self.value.boundary.receipt {
            Receipt::Compact { envelope } => envelope.clone(),
            Receipt::Dispatch {
                dispatch_id,
                prompt_digest,
                ..
            } => {
                let Some(envelope @ Envelope::Ok(Success::Dispatch { .. })) = dispatch else {
                    return Err(Failure::Confirmation);
                };
                if let Envelope::Ok(Success::Dispatch { dispatch_id: id, prompt_digest: digest, .. }) = &envelope
                    && (id != dispatch_id || digest.as_deref().unwrap_or_default() != prompt_digest)
                {
                    return Err(Failure::Confirmation);
                }
                envelope
            }
        };
        if envelope_digest(&envelope)? != self.value.boundary.response_digest {
            return Err(Failure::Confirmation);
        }
        Ok(envelope)
    }

    /// Confirm the old prompt-bearing envelope against its original receipt,
    /// then project the public identities without rewriting historical bytes.
    pub fn historical_dispatch(&self, dispatch: &ActiveDispatch, prompt: &str)
        -> std::result::Result<ExecutionEnvelope, Failure>
    {
        self.value.boundary.validate(self.value.terminal)?;
        let Receipt::Dispatch { dispatch_id, prompt_bytes, prompt_digest } = &self.value.boundary.receipt else {
            return Err(Failure::Confirmation);
        };
        if dispatch_id != &dispatch.id
            || prompt_bytes.is_some_and(|bytes| bytes != prompt.len() as u64)
            || (!prompt_digest.is_empty() && (dispatch.prompt_digest != *prompt_digest
                || crate::store::model::digest(prompt.as_bytes()) != *prompt_digest))
        { return Err(Failure::Confirmation); }
        let retained = serde_json::json!({"status":"ok","outcome":"dispatch","dispatch":dispatch,"prompt":prompt});
        if crate::store::model::digest(&cadence::execution::boundary::canonical_bytes(&retained)?)
            != self.value.boundary.response_digest { return Err(Failure::Confirmation); }
        Ok(Envelope::Ok(Success::dispatch(dispatch)))
    }
}

pub fn confirmed_boundary<'a>(
    view: &'a View,
    expected: &BoundaryV1,
) -> std::result::Result<ConfirmedBoundary<'a>, Failure> {
    if let Some(terminal) = terminal_v1(view, &expected.scope) {
        return Ok(terminal);
    }
    let id = expected.identity()?;
    view.decisions
        .iter()
        .find_map(|record| match &record.decision {
            model::Decision::BoundaryV1(value)
                if record.id == id
                    && value.boundary == *expected
                    && value.store_generation <= view.snapshot.generation =>
            {
                Some(ConfirmedBoundary {
                    id: &record.id,
                    value,
                })
            }
            _ => None,
        })
        .ok_or(Failure::Confirmation)
}

pub fn routing_decision(dispatch: &ActiveDispatch) -> Result<Option<DecisionRecord>> {
    use super::model::{Decision, DecisionRecord, Evidence, Origin};
    cadence::execution::dispatch::validate_route_choice(dispatch)
        .map_err(|error| Error::Invalid(error.to_string()))?;
    let Some(route) = &dispatch.route else {
        return Ok(None);
    };
    let mut choice = serde_json::json!({"agent": route.choice.agent, "rung": route.choice.rung});
    if let Some(model) = &route.choice.model {
        choice["model"] = serde_json::json!(model);
    }
    Ok(Some(super::decisions::normalize(DecisionRecord {
        version: 1,
        id: format!("routing:{}", dispatch.id),
        revision: 1,
        origin: Origin {
            source: "native-routing".into(),
            original: Evidence::Missing,
        },
        decision: Decision::Routing {
            choice: serde_json::to_string(&choice)?,
            config_provenance: [
                ("dispatch_id".into(), Evidence::Text(dispatch.id.clone())),
                (
                    "route".into(),
                    Evidence::Text(serde_json::to_string(route)?),
                ),
            ]
            .into(),
            requested_effort: Evidence::Text(route.choice.rung.clone()),
            observed_effort: Evidence::Missing,
            receipt: Evidence::Missing,
        },
        at: super::model::stamped_at(),
    })))
}

pub fn validate_routing(dispatch: &ActiveDispatch, records: &[DecisionRecord]) -> Result<()> {
    if let Some(expected) = routing_decision(dispatch)? {
        let saved: Vec<&DecisionRecord> =
            records.iter().filter(|record| record.id == expected.id).collect();
        let ok = match saved.as_slice() {
            [issued] => issued.same_record(&expected),
            [issued, outcome] => issued.same_record(&expected) && answers(outcome, &expected),
            _ => false,
        };
        if !ok {
            return Err(Error::Invalid(
                "dispatch lacks its exact routing decision".into(),
            ));
        }
    }
    Ok(())
}

/// P9: the later revision fills the outcome edge and changes nothing else.
fn answers(outcome: &DecisionRecord, issued: &DecisionRecord) -> bool {
    use super::model::{Decision, Evidence};
    let mut edge = outcome.clone();
    let Decision::Routing {
        observed_effort,
        receipt,
        ..
    } = &mut edge.decision
    else {
        return false;
    };
    if *observed_effort != Evidence::Missing || receipt.is_missing() {
        return false;
    }
    *receipt = Evidence::Missing;
    edge.revision = 1;
    outcome.revision == 2 && edge.same_record(issued)
}

/// The dispatch a phase is running, from the state the writer is working from.
fn active_dispatch_id(data: &Value, phase: u32) -> Option<String> {
    data.get("execution")?
        .get("occurrences")?
        .get(phase.to_string())?
        .get("active")?
        .get("id")?
        .as_str()
        .map(str::to_owned)
}

/// P9: the routing decision the writer recorded when the dispatch was issued
/// gains its second revision once the plan it routed has an outcome. The
/// receipt is the identity of the record that answered the dispatch; the
/// observed effort stays Missing, because no host ever reported one.
pub fn routing_outcome(
    decisions: &[DecisionRecord],
    dispatch_id: &str,
    receipt: &str,
) -> Option<DecisionRecord> {
    use super::model::{Decision, Evidence};
    let id = format!("routing:{dispatch_id}");
    let mut record = decisions.iter().rev().find(|record| record.id == id)?.clone();
    if record.revision != 1 || receipt.trim().is_empty() {
        return None;
    }
    let Decision::Routing { receipt: edge, .. } = &mut record.decision else {
        return None;
    };
    if !edge.is_missing() {
        return None;
    }
    *edge = Evidence::Text(receipt.to_owned());
    record.revision = 2;
    record.at = super::model::stamped_at();
    Some(record)
}

/// The same edge, for a plan that completed through the native family.
pub fn plan_routing_outcome(
    previous: &Value,
    decisions: &[DecisionRecord],
    record: &cadence::execution::history::PlanRecord,
) -> Option<DecisionRecord> {
    if !matches!(
        record.request.event,
        cadence::execution::history::PlanEvent::Completion(_)
    ) {
        return None;
    }
    let dispatch = active_dispatch_id(previous, record.request.plan.phase)?;
    let receipt = format!(
        "native-plan:{}:{}",
        record.request.plan.phase, record.request_digest
    );
    routing_outcome(decisions, &dispatch, &receipt)
}

pub struct PlanningPolicy;

impl Policy for PlanningPolicy {
    fn validate(&mut self, _: &MutationContext<'_>) -> Result<()> {
        Ok(())
    }
}

/// Test-only count of snapshot and log parses by the writer, so a test can
/// pin how many times the store's bytes are parsed, not how long it takes.
#[cfg(test)]
pub(crate) static PARSES: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);

#[cfg(test)]
mod observe_tests {
    use super::*;
    use std::sync::atomic::Ordering;

    fn document_data(scope: &str) -> Value {
        serde_json::json!({"context":{"schema":"context-1","phases":{"1":{
            "submission":{"phase":1,"title":"Cache fixture","scope":scope,
                "durable_decisions":[],"decisions":[],"assumptions":[],"truths":[]},
            "approval":{"approved":true,"owner":"fixture","at":"2026-09-18","submission":null},
            "truths":[]}}}})
    }

    fn document_scope(root: &std::path::Path) -> String {
        let identity = cadence::read::model::DocumentIdentity::PhaseContext { phase: 1.try_into().unwrap() };
        cadence::read::document::resolve(root, &identity).unwrap().parts.into_iter()
            .find(|part| part.selector == "scope").unwrap().body
    }

    #[test]
    fn document_reads_parse_once_and_observe_resident_and_external_writes() {
        use cadence::context::persistence::READ_PARSES;
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path();
        let initial = Snapshot::new(1, b"", b"", document_data("first")).unwrap();
        std::fs::write(root.join(STATE), initial.render().unwrap()).unwrap();
        std::fs::write(root.join(ITEMS), b"").unwrap();
        std::fs::write(root.join(DECISIONS), b"").unwrap();
        let before = READ_PARSES.with(|count| count.get());
        let start = std::time::Instant::now();
        assert_eq!(document_scope(root), "first\n");
        let first = start.elapsed();
        let start = std::time::Instant::now();
        assert_eq!(document_scope(root), "first\n");
        let second = start.elapsed();
        eprintln!("fixture document read: first={first:?}, second={second:?}");
        assert_eq!(READ_PARSES.with(|count| count.get()) - before, 1,
            "consecutive document parts must reuse one verified snapshot parse");
        tokio::runtime::Builder::new_current_thread().build().unwrap().block_on(async {
            let store = Store::open(super::super::filesystem::Filesystem::new(root).unwrap(), PlanningPolicy).await.unwrap();
            let written = store.request(Operation::RewriteSnapshot(document_data("resident write"))).await.unwrap();
            assert_eq!(document_scope(root), "resident write\n");
            let external = Snapshot::new(written.snapshot.generation + 1,
                &std::fs::read(root.join(ITEMS)).unwrap(), &std::fs::read(root.join(DECISIONS)).unwrap(),
                document_data("external write")).unwrap();
            std::fs::write(root.join(STATE), external.render().unwrap()).unwrap();
            assert_eq!(document_scope(root), "external write\n");
            assert_eq!(document_scope(root), "external write\n");
        });
    }

    #[test]
    fn shared_reads_use_the_writer_view_and_recheck_all_store_file_identities() {
        use super::super::cache;
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path();
        tokio::runtime::Builder::new_current_thread().build().unwrap().block_on(async {
            let store = Store::open(super::super::filesystem::Filesystem::new(root).unwrap(), PlanningPolicy).await.unwrap();
            assert!(cache::read(root).unwrap().is_none(), "an empty writer must not manufacture a snapshot");
            store.request(Operation::RewriteSnapshot(document_data("first"))).await.unwrap();
            let first = store.shared_view().await.unwrap();
            let second = store.shared_view().await.unwrap();
            assert!(Arc::ptr_eq(&first, &second), "resident reads must borrow the same view");
            assert!(Arc::ptr_eq(&first, &cache::read(root).unwrap().unwrap().0),
                "document reads must borrow the writer's verified view");
            let path = root.join(STATE);
            let modified = std::fs::metadata(&path).unwrap().modified().unwrap();
            let external = Snapshot::new(first.snapshot.generation + 1, b"", b"", document_data("other")).unwrap().render().unwrap();
            assert_eq!(external.len() as u64, std::fs::metadata(&path).unwrap().len());
            let replacement = root.join("replacement.json");
            std::fs::write(&replacement, external).unwrap();
            std::fs::File::options().write(true).open(&replacement).unwrap()
                .set_times(std::fs::FileTimes::new().set_modified(modified)).unwrap();
            std::fs::rename(replacement, &path).unwrap();
            assert_eq!(document_scope(root), "other\n", "same size and mtime replacement must invalidate");
            let current = store.shared_view().await.unwrap();
            assert_eq!(current.snapshot.data, document_data("other"));
            assert!(Arc::ptr_eq(&current, &cache::read(root).unwrap().unwrap().0));
            for file in [STATE, ITEMS, DECISIONS] {
                let path = root.join(file);
                let original = std::fs::read(&path).unwrap();
                std::fs::write(&path, b"corrupt").unwrap();
                assert!(cache::read(root).is_err(), "a changed {file} must not return the cached view");
                std::fs::write(path, original).unwrap();
                assert_eq!(document_scope(root), "other\n");
            }
        });
    }

    // GH-261: an operation on a store whose bytes have not changed since the
    // writer last read them reuses the view it holds. On this project's
    // store the parse is 630ms, before every verified read and every write.
    #[test]
    fn unchanged_store_bytes_are_parsed_once() {
        let temp = tempfile::tempdir().unwrap();
        tokio::runtime::Builder::new_current_thread().build().unwrap().block_on(async {
            let store = Store::open(super::super::filesystem::Filesystem::new(temp.path()).unwrap(), PlanningPolicy).await.unwrap();
            let view = store.request(Operation::ReadVerified).await.unwrap();
            let written = store.request(Operation::CompareRewriteSnapshot {
                expected_generation: view.snapshot.generation, expected_integrity: view.snapshot.integrity.clone(),
                data: serde_json::json!({"value": 1}) }).await.unwrap();
            assert_eq!(written.snapshot.generation, view.snapshot.generation + 1);
            let before = PARSES.load(Ordering::SeqCst);
            for _ in 0..3 {
                assert_eq!(store.request(Operation::ReadVerified).await.unwrap(), written);
            }
            let again = store.request(Operation::CompareRewriteSnapshot {
                expected_generation: written.snapshot.generation, expected_integrity: written.snapshot.integrity.clone(),
                data: serde_json::json!({"value": 2}) }).await.unwrap();
            assert_eq!(again.snapshot.generation, written.snapshot.generation + 1);
            assert_eq!(store.request(Operation::ReadVerified).await.unwrap(), again);
            assert_eq!(PARSES.load(Ordering::SeqCst) - before, 0, "the writer re-parsed bytes it had already read");
            // Bytes changed under the writer: the next operation parses once.
            std::fs::write(temp.path().join(model::DECISIONS), b"{\"not\":\"a decision\"}\n").unwrap();
            let changed = store.request(Operation::ReadVerified).await;
            assert!(changed.is_err(), "{changed:?}");
            assert_eq!(PARSES.load(Ordering::SeqCst) - before, 1);
        });
    }

    // GH-261: the work one write does, pinned by count. The new snapshot is
    // walked twice (once to seal it, once when the transaction re-checks the
    // bytes it is about to install), the intent is digested once, and the
    // previous snapshot is parsed once.
    #[test]
    fn one_write_walks_the_snapshot_twice_digests_the_intent_once_and_parses_the_previous_once() {
        use super::super::transaction::{INTENT_DIGESTS, PREVIOUS_PARSES};
        let temp = tempfile::tempdir().unwrap();
        tokio::runtime::Builder::new_current_thread().build().unwrap().block_on(async {
            let store = Store::open(super::super::filesystem::Filesystem::new(temp.path()).unwrap(), PlanningPolicy).await.unwrap();
            let view = store.request(Operation::ReadVerified).await.unwrap();
            let first = store.request(Operation::CompareRewriteSnapshot {
                expected_generation: view.snapshot.generation, expected_integrity: view.snapshot.integrity.clone(),
                data: serde_json::json!({"value": 1}) }).await.unwrap();
            let before = (model::SNAPSHOT_SERIALIZATIONS.load(Ordering::SeqCst), INTENT_DIGESTS.load(Ordering::SeqCst), PREVIOUS_PARSES.load(Ordering::SeqCst));
            let second = store.request(Operation::CompareRewriteSnapshot {
                expected_generation: first.snapshot.generation, expected_integrity: first.snapshot.integrity.clone(),
                data: serde_json::json!({"value": 2}) }).await.unwrap();
            assert_eq!(second.snapshot.generation, first.snapshot.generation + 1);
            let after = (model::SNAPSHOT_SERIALIZATIONS.load(Ordering::SeqCst), INTENT_DIGESTS.load(Ordering::SeqCst), PREVIOUS_PARSES.load(Ordering::SeqCst));
            assert_eq!((after.0 - before.0, after.1 - before.1, after.2 - before.2), (2, 1, 1),
                "(snapshot serializations, intent digests, previous parses)");
        });
    }

    // GH-261: the writer already holds the snapshot whose bytes it sealed, so
    // the write path must not parse those bytes back into the same snapshot.
    #[test]
    fn one_write_parses_the_new_state_zero_times() {
        use super::super::transaction::NEW_STATE_PARSES;
        let temp = tempfile::tempdir().unwrap();
        tokio::runtime::Builder::new_current_thread().build().unwrap().block_on(async {
            let store = Store::open(super::super::filesystem::Filesystem::new(temp.path()).unwrap(), PlanningPolicy).await.unwrap();
            let view = store.request(Operation::ReadVerified).await.unwrap();
            let before = NEW_STATE_PARSES.load(Ordering::SeqCst);
            let written = store.request(Operation::CompareRewriteSnapshot {
                expected_generation: view.snapshot.generation, expected_integrity: view.snapshot.integrity.clone(),
                data: serde_json::json!({"value": 1}) }).await.unwrap();
            assert_eq!(written.snapshot.generation, view.snapshot.generation + 1);
            assert_eq!(NEW_STATE_PARSES.load(Ordering::SeqCst) - before, 0,
                "the write path parsed the snapshot it had just sealed");
        });
    }
}
