use super::model::{self, DECISIONS, DecisionRecord, ITEMS, ItemRecord, STATE, Snapshot, VERSION};
use super::{Error, MutationContext, Observed, Policy, Result, Storage};
use cadence::envelope::Envelope;
use cadence::execution::boundary::{BoundaryScope, Receipt, Success};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeSet;

pub const INTENT: &str = ".store-intent.json";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "operation", rename_all = "kebab-case", deny_unknown_fields)]
pub(crate) enum IntentKind {
    RailObservation {
        record: Box<cadence::rail::risk::Recorded>,
    },
    GuardAudit {
        audit: super::writer::audit::Audit,
    },
    Store,
    BoundaryObservationV1 {
        scope: BoundaryScope,
        decision_id: String,
    },
    ExecutionDispatchV1 {
        phase: u32,
        decision_id: String,
    },
    ExecutionPatchV1 {
        phase: u32,
        decision_id: String,
        render_version: u32,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        risk_basis: Option<Box<cadence::rail::risk::ExecutionBasis>>,
    },
    ExecutionDispatch {
        phase: u32,
    },
    ExecutionPatch {
        phase: u32,
        render_version: u32,
        summary: bool,
    },
    ExecutionRefusal {
        phase: u32,
    },
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExternalChange {
    pub target: String,
    pub expected: Observed,
    pub bytes: Vec<u8>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Transaction {
    /// Stable caller identity, e.g. a digest of the frozen import source set.
    pub id: String,
    pub items: Vec<ItemRecord>,
    pub decisions: Vec<DecisionRecord>,
    pub snapshot: Option<Value>,
    pub external: Vec<ExternalChange>,
}

impl Transaction {
    pub fn fingerprint(&self) -> Result<String> {
        // Preconditions describe a particular attempt, not the logical import.
        // A retry after recovery has different installed identities.
        Ok(model::digest(&serde_json::to_vec(&(
            &self.items,
            &self.decisions,
            &self.snapshot,
            self.external
                .iter()
                .map(|p| (&p.target, &p.bytes))
                .collect::<Vec<_>>(),
        ))?))
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct Participant {
    pub target: String,
    pub expected: Observed,
    pub bytes: Vec<u8>,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Intent {
    version: u32,
    kind: IntentKind,
    participants: Vec<Participant>,
    integrity: String,
}

impl Intent {
    fn digest(&self) -> Result<String> {
        Ok(model::digest(&serde_json::to_vec(&(
            self.version,
            &self.kind,
            &self.participants,
        ))?))
    }

    fn validate(&self) -> Result<Snapshot> {
        if self.version != VERSION || self.integrity != self.digest()? {
            return Err(Error::Conflict("invalid operation intent integrity".into()));
        }
        let mut names = BTreeSet::new();
        let mut summary_phase = None;
        for participant in &self.participants {
            let known = matches!(
                participant.target.as_str(),
                ITEMS | DECISIONS | STATE | "repo-config" | "global-config"
            );
            let phase = super::filesystem::phase_summary_target(&participant.target)?;
            if (!known && phase.is_none()) || !names.insert(participant.target.as_str()) {
                return Err(Error::Invalid(
                    "invalid or duplicate intent participant".into(),
                ));
            }
            if let Some(phase) = phase
                && summary_phase.replace(phase).is_some()
            {
                return Err(Error::Invalid(
                    "invalid or duplicate intent participant".into(),
                ));
            }
        }
        if self.participants.last().map(|value| value.target.as_str()) != Some(STATE) {
            return Err(Error::Invalid(
                "snapshot must be the final intent participant".into(),
            ));
        }
        match self.kind.clone() {
            IntentKind::Store if summary_phase.is_some() => {
                return Err(Error::Invalid(
                    "store intent cannot render a phase summary".into(),
                ));
            }
            IntentKind::ExecutionDispatch { phase } | IntentKind::ExecutionRefusal { phase }
                if phase == 0 || summary_phase.is_some() =>
            {
                return Err(Error::Invalid(
                    "invalid execution intent participants".into(),
                ));
            }
            IntentKind::ExecutionPatch {
                phase,
                render_version,
                summary,
            } if phase == 0
                || render_version != cadence::execution::render::SUMMARY_RENDER_VERSION
                || summary != summary_phase.is_some()
                || summary_phase.is_some_and(|summary_phase| summary_phase != phase) =>
            {
                return Err(Error::Invalid("invalid execution render intent".into()));
            }
            _ => {}
        }
        let bytes = |name| {
            self.participants
                .iter()
                .find(|p| p.target == name)
                .map(|p| p.bytes.as_slice())
                .ok_or_else(|| Error::Invalid("intent lacks semantic target".into()))
        };
        let items = bytes(ITEMS)?;
        let decisions = bytes(DECISIONS)?;
        model::validate_items(&model::parse_lines(items)?)?;
        model::validate_decisions(&model::parse_lines(decisions)?)?;
        let snapshot = Snapshot::parse(bytes(STATE)?, items, decisions)?;
        match self.kind.clone() {
            IntentKind::ExecutionDispatch { phase } => {
                let execution = execution_snapshot(&snapshot)?;
                let occurrence =
                    execution
                        .occurrences
                        .get(&phase.to_string())
                        .ok_or_else(|| {
                            Error::Invalid("dispatch intent lacks its execution occurrence".into())
                        })?;
                if occurrence.phase != phase || occurrence.active.is_none() {
                    return Err(Error::Invalid("invalid dispatch intent projection".into()));
                }
            }
            IntentKind::ExecutionPatch {
                phase,
                summary: true,
                ..
            } => {
                let execution = execution_snapshot(&snapshot)?;
                let rendered = cadence::execution::render::render_phase_summary(&execution, phase)
                    .map_err(|error| Error::Invalid(error.to_string()))?;
                let target = format!("phase-summary:{phase}");
                if bytes(&target)? != rendered {
                    return Err(Error::Invalid(
                        "phase summary differs from the execution projection".into(),
                    ));
                }
            }
            IntentKind::RailObservation { .. }
            | IntentKind::GuardAudit { .. }
            | IntentKind::BoundaryObservationV1 { .. }
            | IntentKind::ExecutionDispatchV1 { .. }
            | IntentKind::ExecutionPatchV1 { .. }
            | IntentKind::Store
            | IntentKind::ExecutionRefusal { .. }
            | IntentKind::ExecutionPatch { summary: false, .. } => {}
        }
        if let IntentKind::ExecutionDispatch { phase }
        | IntentKind::ExecutionPatch { phase, .. }
        | IntentKind::ExecutionRefusal { phase } = self.kind.clone()
        {
            let decisions: Vec<DecisionRecord> = model::parse_lines(decisions)?;
            if !decisions.iter().any(|record| {
                matches!(
                    record.decision,
                    model::Decision::Boundary {
                        phase: decision_phase,
                        store_generation,
                        ..
                    } if decision_phase == phase && store_generation == snapshot.generation
                )
            }) {
                return Err(Error::Invalid(
                    "execution intent lacks its generation boundary decision".into(),
                ));
            }
        }
        self.validate_rail_observation(&snapshot)?;
        self.validate_guard_audit(&snapshot)?;
        self.validate_boundary_v1(&snapshot, decisions, summary_phase)?;
        Ok(snapshot)
    }
    fn validate_rail_observation(&self, snapshot: &Snapshot) -> Result<()> {
        let IntentKind::RailObservation { record } = &self.kind else {
            return Ok(());
        };
        record.validate().map_err(super::writer::rail_error)?;
        if self.participants.len() != 3
            || self
                .participants
                .iter()
                .any(|p| !matches!(p.target.as_str(), ITEMS | DECISIONS | STATE))
        {
            return Err(Error::Invalid(
                "rail observation cannot change external participants".into(),
            ));
        }
        let participant = |name| self.participants.iter().find(|p| p.target == name).unwrap();
        let items = participant(ITEMS);
        let decisions = participant(DECISIONS);
        let state = participant(STATE);
        let old_items = items.expected.bytes.as_deref().unwrap_or_default();
        let old_decisions = decisions.expected.bytes.as_deref().unwrap_or_default();
        let old = match state.expected.bytes.as_deref() {
            Some(bytes) => Snapshot::parse(bytes, old_items, old_decisions)?,
            None if items.expected.bytes.is_none() && decisions.expected.bytes.is_none() => {
                Snapshot::new(0, b"", b"", Value::Null)?
            }
            _ => {
                return Err(Error::Invalid(
                    "rail observation cannot adopt partial store".into(),
                ));
            }
        };
        let mut expected: Vec<DecisionRecord> = model::parse_lines(old_decisions)?;
        expected.push(super::writer::rail_record(record)?);
        if items.bytes != old_items
            || decisions.bytes != model::render_lines(&expected)?
            || old.generation.checked_add(1) != Some(snapshot.generation)
            || record.confirmation.generation != snapshot.generation
            || snapshot.operations != old.operations
            || cadence::rail::risk::read(&old.data)
                .map_err(super::writer::rail_error)?
                .contains_key(
                    &record
                        .observation
                        .key()
                        .map_err(super::writer::rail_error)?,
                )
            || snapshot.data
                != cadence::rail::risk::project(&old.data, record)
                    .map_err(super::writer::rail_error)?
        {
            return Err(Error::Invalid(
                "rail observation changed data outside its projection".into(),
            ));
        }
        Ok(())
    }

    fn validate_guard_audit(&self, snapshot: &Snapshot) -> Result<()> {
        let IntentKind::GuardAudit { audit } = &self.kind else {
            return Ok(());
        };
        if self.participants.len() != 3
            || self
                .participants
                .iter()
                .any(|p| !matches!(p.target.as_str(), ITEMS | DECISIONS | STATE))
        {
            return Err(Error::Invalid(
                "guard audit cannot change external participants".into(),
            ));
        }
        let participant = |name| self.participants.iter().find(|p| p.target == name).unwrap();
        let items = participant(ITEMS);
        let decisions = participant(DECISIONS);
        let state = participant(STATE);
        let old_items = items.expected.bytes.as_deref().unwrap_or_default();
        let old_decisions = decisions.expected.bytes.as_deref().unwrap_or_default();
        let old = match state.expected.bytes.as_deref() {
            Some(bytes) => Snapshot::parse(bytes, old_items, old_decisions)?,
            None if items.expected.bytes.is_none() && decisions.expected.bytes.is_none() => {
                Snapshot::new(0, b"", b"", Value::Null)?
            }
            _ => {
                return Err(Error::Invalid(
                    "guard audit cannot adopt partial store".into(),
                ));
            }
        };
        let mut expected: Vec<DecisionRecord> = model::parse_lines(old_decisions)?;
        expected.push(audit.record()?);
        if items.bytes != old_items
            || decisions.bytes != model::render_lines(&expected)?
            || old.generation.checked_add(1) != Some(snapshot.generation)
            || snapshot.operations != old.operations
            || snapshot.data != super::writer::audit::project(&old, audit)?
        {
            return Err(Error::Invalid(
                "guard audit changed data outside its projection".into(),
            ));
        }
        Ok(())
    }
    fn validate_boundary_v1(
        &self,
        snapshot: &Snapshot,
        decisions: &[u8],
        summary_phase: Option<u32>,
    ) -> Result<()> {
        let (scope, id, summary) = match &self.kind {
            IntentKind::BoundaryObservationV1 { scope, decision_id } => {
                (scope.clone(), decision_id, false)
            }
            IntentKind::ExecutionDispatchV1 { phase, decision_id } => (
                BoundaryScope::Execution { phase: *phase },
                decision_id,
                false,
            ),
            IntentKind::ExecutionPatchV1 {
                phase,
                decision_id,
                render_version,
                ..
            } => {
                if *render_version != cadence::execution::render::SUMMARY_RENDER_VERSION {
                    return Err(Error::Invalid("unsupported boundary render version".into()));
                }
                (
                    BoundaryScope::Execution { phase: *phase },
                    decision_id,
                    true,
                )
            }
            _ => return Ok(()),
        };
        if !scope.valid()
            || summary != summary_phase.is_some()
            || summary_phase.is_some_and(|phase| scope != (BoundaryScope::Execution { phase }))
            || self.participants.len() != if summary { 4 } else { 3 }
            || self
                .participants
                .iter()
                .any(|p| matches!(p.target.as_str(), "repo-config" | "global-config"))
        {
            return Err(Error::Invalid(
                "invalid boundary intent participants".into(),
            ));
        }
        let records: Vec<DecisionRecord> = model::parse_lines(decisions)?;
        let value = records
            .iter()
            .find_map(|record| match &record.decision {
                model::Decision::BoundaryV1(value)
                    if &record.id == id
                        && value.boundary.scope == scope
                        && value.store_generation == snapshot.generation =>
                {
                    Some(value)
                }
                _ => None,
            })
            .ok_or_else(|| Error::Invalid("intent lacks its exact boundary decision".into()))?;
        if records.iter().any(|record| {
            matches!(&record.decision,
            model::Decision::BoundaryV1(value) if value.store_generation > snapshot.generation)
        }) {
            return Err(Error::Invalid(
                "boundary generation exceeds snapshot".into(),
            ));
        }
        if let Some(evidence) = &value.boundary.lease_refusal {
            if !matches!(self.kind, IntentKind::BoundaryObservationV1 { .. }) {
                return Err(Error::Invalid(
                    "lease refusal intent must be an observation".into(),
                ));
            }
            let execution = execution_snapshot(snapshot)?;
            let active = execution
                .occurrences
                .get(&evidence.paths.phase.to_string())
                .and_then(|o| o.active.as_ref())
                .ok_or_else(|| Error::Invalid("lease refusal intent lacks open dispatch".into()))?;
            evidence
                .validate_active(active)
                .map_err(|e| Error::Invalid(e.to_string()))?;
        }
        match &self.kind {
            IntentKind::ExecutionDispatchV1 { phase, .. } => {
                let execution = execution_snapshot(snapshot)?;
                let active = execution
                    .occurrences
                    .get(&phase.to_string())
                    .and_then(|o| o.active.as_ref())
                    .ok_or_else(|| {
                        Error::Invalid("dispatch intent lacks active dispatch".into())
                    })?;
                if active.phase != *phase
                    || value.terminal
                    || value.boundary.receipt
                        != (Receipt::Dispatch {
                            dispatch_id: active.id.clone(),
                            prompt_bytes: active.prompt_bytes,
                        })
                {
                    return Err(Error::Invalid("dispatch intent receipt mismatch".into()));
                }
            }
            IntentKind::ExecutionPatchV1 {
                phase, risk_basis, ..
            } => {
                let execution = execution_snapshot(snapshot)?;
                let occurrence =
                    execution
                        .occurrences
                        .get(&phase.to_string())
                        .ok_or_else(|| {
                            Error::Invalid("patch intent lacks execution occurrence".into())
                        })?;
                let subject =
                    value.boundary.subject_id.as_ref().ok_or_else(|| {
                        Error::Invalid("patch intent lacks receipt identity".into())
                    })?;
                let receipt = occurrence
                    .receipts
                    .get(subject)
                    .ok_or_else(|| Error::Invalid("patch intent lacks execution receipt".into()))?;
                if let Some(basis) = risk_basis {
                    let state = self
                        .participants
                        .iter()
                        .find(|p| p.target == STATE)
                        .unwrap();
                    let old: Snapshot =
                        serde_json::from_slice(state.expected.bytes.as_deref().ok_or_else(
                            || Error::Invalid("execution basis lacks prior snapshot".into()),
                        )?)?;
                    let active = execution_snapshot(&old)?
                        .occurrences
                        .get(&phase.to_string())
                        .and_then(|o| o.active.clone())
                        .ok_or_else(|| {
                            Error::Invalid("execution basis lacks prior dispatch".into())
                        })?;
                    let expected = cadence::rail::risk::ExecutionBasis::from_accepted(
                        &active,
                        &receipt.outcome,
                    )
                    .map_err(super::writer::rail_error)?;
                    let projected =
                        cadence::rail::risk::project_execution_basis(&old.data, &expected)
                            .map_err(super::writer::rail_error)?;
                    if **basis != expected
                        || snapshot.data.get(cadence::rail::risk::EXECUTION_MATERIAL)
                            != projected.get(cadence::rail::risk::EXECUTION_MATERIAL)
                    {
                        return Err(Error::Invalid(
                            "execution basis differs from accepted material".into(),
                        ));
                    }
                }
                let answer_matches = match &value.boundary.receipt {
                    Receipt::Compact {
                        envelope:
                            Envelope::Ok(Success::Complete {
                                phase: answer_phase,
                            }),
                    } => {
                        answer_phase == phase
                            && matches!(
                                occurrence.terminal,
                                Some(cadence::execution::model::TerminalOutcome::Complete { .. })
                            )
                    }
                    Receipt::Compact {
                        envelope:
                            Envelope::Ok(Success::NextPlan {
                                phase: answer_phase,
                                ..
                            }),
                    } => {
                        answer_phase == phase
                            && receipt.outcome.disposition
                                == cadence::execution::model::PlanDisposition::Complete
                    }
                    Receipt::Compact {
                        envelope:
                            Envelope::Ok(Success::JudgmentStop {
                                phase: answer_phase,
                                dispatch_id,
                                blocker_ids,
                            }),
                    } => {
                        answer_phase == phase
                            && dispatch_id == subject
                            && matches!(&occurrence.terminal,
                            Some(cadence::execution::model::TerminalOutcome::JudgmentStop { blocker_ids: stored, .. }) if stored == blocker_ids)
                    }
                    _ => false,
                };
                if !answer_matches || value.terminal {
                    return Err(Error::Invalid("patch intent answer mismatch".into()));
                }
                let rendered = cadence::execution::render::render_phase_summary(&execution, *phase)
                    .map_err(|error| Error::Invalid(error.to_string()))?;
                if !self
                    .participants
                    .iter()
                    .any(|p| p.target == format!("phase-summary:{phase}") && p.bytes == rendered)
                {
                    return Err(Error::Invalid(
                        "phase summary differs from execution projection".into(),
                    ));
                }
            }
            _ => {}
        }
        Ok(())
    }
}

fn execution_snapshot(snapshot: &Snapshot) -> Result<cadence::execution::model::ExecutionSnapshot> {
    let value = snapshot
        .data
        .get("execution")
        .cloned()
        .ok_or_else(|| Error::Invalid("execution intent lacks its projection".into()))?;
    serde_json::from_value(value).map_err(Error::from)
}

fn validate_all<S: Storage>(
    storage: &mut S,
    participants: &[Participant],
    replay: bool,
) -> Result<()> {
    // This entire pass finishes before any participant can change.
    for participant in participants {
        let actual = storage.read(&participant.target)?;
        let intended = replay
            && actual.bytes.as_ref() == Some(&participant.bytes)
            && actual.directory_identity == participant.expected.directory_identity;
        if actual != participant.expected && !intended {
            return Err(Error::Conflict(format!(
                "pending participant changed: {}",
                participant.target
            )));
        }
    }
    Ok(())
}

fn dispose<S: Storage>(
    storage: &mut S,
    prepared: Vec<(String, Vec<u8>, S::Prepared)>,
) -> Result<()> {
    let mut first = None;
    for (_, _, file) in prepared {
        if let Err(error) = storage.discard(file) {
            first.get_or_insert(error);
        }
    }
    first.map_or(Ok(()), Err)
}

pub(crate) fn commit<S: Storage, P: Policy>(
    storage: &mut S,
    policy: &mut P,
    context: &MutationContext<'_>,
    kind: IntentKind,
    participants: Vec<Participant>,
) -> Result<()> {
    if storage.read(INTENT)?.bytes.is_some() {
        return Err(Error::Conflict(
            "pending operation requires recovery".into(),
        ));
    }
    validate_all(storage, &participants, false)?;
    let mut prepared = Vec::new();
    for participant in &participants {
        if participant.expected.bytes.as_ref() == Some(&participant.bytes) {
            continue;
        }
        match storage.prepare(&participant.target, &participant.bytes) {
            Ok(file) => {
                prepared.push((participant.target.clone(), participant.bytes.clone(), file))
            }
            Err(error) => {
                dispose(storage, prepared)?;
                return Err(error);
            }
        }
    }
    let mut intent = Intent {
        version: VERSION,
        kind,
        participants,
        integrity: String::new(),
    };
    intent.integrity = intent.digest()?;
    intent.validate()?;
    let bytes = serde_json::to_vec(&intent)?;
    let intent_file = match storage.prepare(INTENT, &bytes) {
        Ok(file) => file,
        Err(error) => {
            dispose(storage, prepared)?;
            return Err(error);
        }
    };
    if let Err(error) =
        validate_all(storage, &intent.participants, false).and_then(|()| policy.validate(context))
    {
        storage.discard(intent_file)?;
        dispose(storage, prepared)?;
        return Err(error);
    }
    let installed = storage.install(&intent_file);
    storage.discard(intent_file)?;
    if let Err(error) = installed.and_then(|()| storage.confirm(INTENT, &bytes).map(|_| ())) {
        dispose(storage, prepared)?;
        return Err(error);
    }
    let mut remaining = prepared.into_iter();
    while let Some((target, bytes, file)) = remaining.next() {
        // Check all participants again immediately before each replacement.
        let result = validate_all(storage, &intent.participants, true)
            .and_then(|()| storage.install(&file))
            .and_then(|()| storage.confirm(&target, &bytes).map(|_| ()));
        storage.discard(file)?;
        if let Err(error) = result {
            dispose(storage, remaining.collect())?;
            return Err(error);
        }
    }
    // Snapshot is the final semantic participant and holds completion receipts.
    // Removing the intent and syncing its directory is part of completion.
    validate_all(storage, &intent.participants, true)?;
    storage.remove(INTENT)
}

pub(crate) fn recover<S: Storage, P: Policy>(storage: &mut S, policy: &mut P) -> Result<()> {
    let Some(bytes) = storage.read(INTENT)?.bytes else {
        return Ok(());
    };
    let intent: Intent = serde_json::from_slice(&bytes)?;
    if serde_json::from_slice::<Value>(&bytes)? != serde_json::to_value(&intent)? {
        return Err(Error::Invalid("unknown operation intent fields".into()));
    }
    let snapshot = intent.validate()?;
    validate_all(storage, &intent.participants, true)?;
    policy.validate(&MutationContext {
        operation: if matches!(intent.kind, IntentKind::GuardAudit { .. }) {
            "guard_audit_recovery"
        } else {
            "recovery"
        },
        snapshot: &snapshot,
    })?;
    for participant in &intent.participants {
        validate_all(storage, &intent.participants, true)?;
        let current = storage.read(&participant.target)?;
        if current.bytes.as_ref() == Some(&participant.bytes) {
            // Rename may have completed before its directory sync. Reconfirm
            // both file and directory even when no semantic update is needed.
            storage.resync(&participant.target, &participant.bytes)?;
        } else {
            let file = storage.prepare(&participant.target, &participant.bytes)?;
            let result = validate_all(storage, &intent.participants, true)
                .and_then(|()| storage.install(&file))
                .and_then(|()| {
                    storage
                        .confirm(&participant.target, &participant.bytes)
                        .map(|_| ())
                });
            storage.discard(file)?;
            result?;
        }
    }
    validate_all(storage, &intent.participants, true)?;
    storage.remove(INTENT)
}
