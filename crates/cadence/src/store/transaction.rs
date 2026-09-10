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
    NativeTaskV1 {
        request: Box<cadence::execution::history::Request>,
        root_binding: String,
    },
    NativeExecutionDispatchV1 {
        phase: u32,
        decision_id: String,
        inventory: Observed,
    },
    NativeAdmissionV1 {
        request: Box<cadence::execution::admission::Request>,
        root_binding: String,
        inventory: Observed,
    },
    PlanPublication {
        phase: u32,
        inventory: Box<cadence::plan::inventory::Inventory>,
    },
    ContextPublication {
        phase: u32,
    },
    ExecutionFinalizeRiskV1 {
        phase: u32,
        decision_id: String,
        requirements: Vec<cadence::rail::receipts::Requirement>,
    },
    RailReceipt {
        record: Box<cadence::rail::receipts::RecordedFact>,
    },
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

impl IntentKind {
    fn validate_provenance(&self, previous: &Value, proposed: &Value) -> Result<()> {
        preserve_provenance(previous, proposed)
    }
}

pub fn preserve_provenance(previous: &Value, proposed: &Value) -> Result<()> {
    for field in ["import", "source_evidence"] {
        if let Some(value) = previous.get(field)
            && proposed.get(field) != Some(value)
        {
            return Err(Error::Invalid(format!(
                "snapshot replacement changed provenance: {field}"
            )));
        }
    }
    if let Some(current) = previous.get("current") {
        preserve_provenance(current, proposed.get("current").unwrap_or(&Value::Null))?;
    }
    Ok(())
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExternalChange {
    pub target: String,
    pub expected: Observed,
    pub bytes: Vec<u8>,
}

impl ExternalChange {
    pub fn validate(&self, actual: &Observed, replay: bool) -> Result<&[u8]> {
        let installed = replay
            && actual.bytes.as_ref() == Some(&self.bytes)
            && actual.directory_identity == self.expected.directory_identity;
        if actual != &self.expected && !installed {
            return Err(Error::Conflict(format!(
                "pending participant changed: {}",
                self.target
            )));
        }
        Ok(&self.bytes)
    }
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

pub(crate) type Participant = ExternalChange;

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
        let mut context_phase = None;
        let mut plan_targets = Vec::new();
        for participant in &self.participants {
            let known = matches!(
                participant.target.as_str(),
                ITEMS | DECISIONS | STATE | "repo-config" | "global-config"
            );
            let phase = super::filesystem::phase_summary_target(&participant.target)?;
            let context = super::filesystem::phase_context_target(&participant.target)?;
            let plan = super::filesystem::phase_plan_target(&participant.target)?;
            if let Some(identity) = plan {
                plan_targets.push(identity);
            }
            if let Some(context) = context
                && context_phase.replace(context).is_some()
            {
                return Err(Error::Invalid("duplicate context participant".into()));
            }
            if (!known && phase.is_none() && context.is_none() && plan.is_none())
                || !names.insert(participant.target.as_str())
            {
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
        match &self.kind {
            IntentKind::PlanPublication { phase, .. }
                if *phase > 0
                    && !plan_targets.is_empty()
                    && plan_targets.iter().all(|(p, _)| p == phase)
                    && context_phase.is_none()
                    && summary_phase.is_none()
                    && !names.contains("repo-config")
                    && !names.contains("global-config") => {}
            IntentKind::PlanPublication { .. } => {
                return Err(Error::Invalid(
                    "invalid plan publication participants".into(),
                ));
            }
            _ if !plan_targets.is_empty() => {
                return Err(Error::Invalid("PLAN needs its publication intent".into()));
            }
            IntentKind::ContextPublication { phase }
                if *phase > 0
                    && context_phase == Some(*phase)
                    && summary_phase.is_none()
                    && !names.contains("repo-config")
                    && !names.contains("global-config") => {}
            IntentKind::ContextPublication { .. } => {
                return Err(Error::Invalid("invalid context intent participants".into()));
            }
            _ if context_phase.is_some() => {
                return Err(Error::Invalid(
                    "context requires its approved publication intent".into(),
                ));
            }
            _ => {}
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
        if let IntentKind::ExecutionPatch {phase,..}|IntentKind::ExecutionPatchV1 {phase,..}=&self.kind {
            cadence::plan::persistence::require_legacy_execution(&snapshot.data,*phase)?;
        }
        if let Some(previous) = self
            .participants
            .last()
            .and_then(|p| p.expected.bytes.as_deref())
        {
            let previous: Snapshot = serde_json::from_slice(previous)?;
            self.kind
                .validate_provenance(&previous.data, &snapshot.data)?;
            if !matches!(self.kind, IntentKind::NativeTaskV1 { .. })
                && previous.data.get(cadence::execution::history::NAMESPACE) != snapshot.data.get(cadence::execution::history::NAMESPACE)
            {
                return Err(Error::Invalid("native task changes require their versioned intent".into()));
            }
            if !matches!(self.kind,IntentKind::NativeAdmissionV1 {..})
                && previous.data.get(cadence::execution::admission::NAMESPACE)!=snapshot.data.get(cadence::execution::admission::NAMESPACE)
            {
                return Err(Error::Invalid("native admission changes require their versioned intent".into()));
            }
        }
        match self.kind.clone() {
            IntentKind::NativeTaskV1 { request, root_binding } => {
                use cadence::execution::history;
                if names.len() != 3 { return Err(Error::Invalid("native task event cannot change external participants".into())); }
                let state = self.participants.last().expect("state participant");
                if state.expected.directory_identity != root_binding {
                    return Err(Error::Invalid("native task root binding changed".into()));
                }
                let previous: Snapshot = serde_json::from_slice(state.expected.bytes.as_deref()
                    .ok_or_else(|| Error::Invalid("native task requires prior snapshot".into()))?)?;
                let (expected, record) = history::contribute(&previous.data, &root_binding, &request)?;
                let old_items = self.participants.iter().find(|p| p.target == ITEMS).unwrap().expected.bytes.as_deref();
                let old_decisions = self.participants.iter().find(|p| p.target == DECISIONS).unwrap().expected.bytes.as_deref()
                    .ok_or_else(|| Error::Invalid("native task requires previous decisions".into()))?;
                let mut expected_decisions: Vec<DecisionRecord> = model::parse_lines(old_decisions)?;
                expected_decisions.extend(history::decisions(&record)?);
                if snapshot.data != expected || old_items != Some(items)
                    || decisions != model::render_lines(&expected_decisions)?
                    || snapshot.operations != previous.operations
                    || snapshot.generation != previous.generation.checked_add(1).ok_or_else(|| Error::Invalid("generation exhausted".into()))?
                { return Err(Error::Invalid("native task intent differs from validated immutable transition".into())); }
            }
            IntentKind::NativeAdmissionV1 {request,root_binding,inventory} => {
                use cadence::execution::admission;
                if names.len()!=3 {return Err(Error::Invalid("native admission cannot change external participants".into()));}
                let state=self.participants.last().expect("state participant");
                if state.expected.directory_identity!=root_binding {return Err(Error::Invalid("native admission root binding changed".into()));}
                let previous:Snapshot=serde_json::from_slice(state.expected.bytes.as_deref()
                    .ok_or_else(||Error::Invalid("native admission requires prior snapshot".into()))?)?;
                let inventory:cadence::plan::inventory::Inventory=serde_json::from_slice(inventory.bytes.as_deref()
                    .ok_or_else(||Error::Invalid("native admission requires installed inventory".into()))?)?;
                let (expected,record)=admission::contribute(&previous.data,&inventory.documents,&root_binding,&request)?;
                let old_items=self.participants.iter().find(|p|p.target==ITEMS).unwrap().expected.bytes.as_deref();
                let old_decisions=self.participants.iter().find(|p|p.target==DECISIONS).unwrap().expected.bytes.as_deref()
                    .ok_or_else(||Error::Invalid("native admission requires previous decisions".into()))?;
                let mut expected_decisions:Vec<DecisionRecord>=model::parse_lines(old_decisions)?;
                expected_decisions.push(admission::decision(&record)?);
                if snapshot.data!=expected || old_items!=Some(items)
                    || decisions!=model::render_lines(&expected_decisions)?
                    || snapshot.operations!=previous.operations
                    || snapshot.generation!=previous.generation.checked_add(1).ok_or_else(||Error::Invalid("generation exhausted".into()))?
                {return Err(Error::Invalid("native admission intent differs from validated immutable transition".into()));}
            }
            IntentKind::PlanPublication { phase, inventory } => {
                for target in [ITEMS, DECISIONS] {
                    let participant = self
                        .participants
                        .iter()
                        .find(|p| p.target == target)
                        .unwrap();
                    if participant.expected.bytes.as_deref() != Some(participant.bytes.as_slice()) {
                        return Err(Error::Invalid(
                            "plan publication cannot append unrelated records".into(),
                        ));
                    }
                }
                let previous: Snapshot = serde_json::from_slice(
                    self.participants
                        .last()
                        .and_then(|p| p.expected.bytes.as_deref())
                        .ok_or_else(|| {
                            Error::Invalid("plan publication requires prior snapshot".into())
                        })?,
                )?;
                let documents = plan_targets
                    .iter()
                    .map(|(phase, plan)| {
                        let participant = self
                            .participants
                            .iter()
                            .find(|p| p.target == format!("phase-plan:{phase}:{plan}"))
                            .unwrap();
                        cadence::plan::persistence::validate_old_document(&previous.data, *phase, *plan, participant.expected.bytes.as_deref())?;
                        Ok((*plan, participant.bytes.clone()))
                    })
                    .collect::<Result<Vec<_>>>()?;
                cadence::plan::persistence::validate_publication(
                    &previous.data,
                    &snapshot.data,
                    phase,
                    &inventory,
                    &documents,
                )
                .map_err(|e| cadence::plan::limits::disposition(e, Error::Invalid))?;
            }
            IntentKind::ExecutionDispatch { phase } => {
                cadence::plan::persistence::require_legacy_execution(&snapshot.data, phase)?;
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
                let active = occurrence.active.as_ref().unwrap();
                if active.route.is_some()
                    || active.policy.rung != cadence::execution::model::ExecutorRung::Fixed
                {
                    return Err(Error::Invalid(
                        "routed dispatch requires current boundary admission".into(),
                    ));
                }
            }
            IntentKind::ContextPublication { phase } => {
                let previous: Snapshot = serde_json::from_slice(
                    self.participants
                        .last()
                        .and_then(|p| p.expected.bytes.as_deref())
                        .ok_or_else(|| Error::Invalid("context requires prior snapshot".into()))?,
                )?;
                cadence::context::persistence::validate_publication(
                    &previous.data,
                    &snapshot.data,
                    phase,
                    bytes(&format!("phase-context:{phase}"))?,
                )
                .map_err(|error| Error::Invalid(error.to_string()))?;
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
            IntentKind::ExecutionFinalizeRiskV1 { .. }
            | IntentKind::RailReceipt { .. }
            | IntentKind::RailObservation { .. }
            | IntentKind::GuardAudit { .. }
            | IntentKind::BoundaryObservationV1 { .. }
            | IntentKind::ExecutionDispatchV1 { .. }
            | IntentKind::NativeExecutionDispatchV1 { .. }
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
        self.validate_rail_receipt(&snapshot)?;
        self.validate_risk_finalization(&snapshot)?;
        self.validate_rail_observation(&snapshot)?;
        self.validate_guard_audit(&snapshot)?;
        self.validate_boundary_v1(&snapshot, decisions, summary_phase)?;
        Ok(snapshot)
    }
    fn validate_risk_finalization(&self, snapshot: &Snapshot) -> Result<()> {
        let IntentKind::ExecutionFinalizeRiskV1 {
            phase,
            decision_id,
            requirements,
        } = &self.kind
        else {
            return Ok(());
        };
        if self.participants.len() != 4
            || self.participants.iter().any(|p| {
                !matches!(p.target.as_str(), ITEMS | DECISIONS | STATE)
                    && p.target != format!("phase-summary:{phase}")
            })
        {
            return Err(Error::Invalid(
                "invalid risk finalization participants".into(),
            ));
        }
        let participant = |name| {
            self.participants
                .iter()
                .find(|p| p.target == name)
                .ok_or_else(|| Error::Invalid("finalization lacks participant".into()))
        };
        let state = participant(STATE)?;
        let items = participant(ITEMS)?;
        let decisions = participant(DECISIONS)?;
        let old = Snapshot::parse(
            state
                .expected
                .bytes
                .as_deref()
                .ok_or_else(|| Error::Invalid("finalization lacks prior state".into()))?,
            items.expected.bytes.as_deref().unwrap_or_default(),
            decisions.expected.bytes.as_deref().unwrap_or_default(),
        )?;
        let expected = cadence::rail::receipts::finalize_execution(&old.data, *phase, requirements)
            .map_err(super::writer::rail_error)?;
        let records: Vec<DecisionRecord> = model::parse_lines(&decisions.bytes)?;
        let mut old_records: Vec<DecisionRecord> =
            model::parse_lines(decisions.expected.bytes.as_deref().unwrap_or_default())?;
        let decision = records
            .iter()
            .find(|r| &r.id == decision_id)
            .ok_or_else(|| Error::Invalid("finalization lacks decision".into()))?;
        if !matches!(&decision.decision, model::Decision::BoundaryV1(value)
            if value.store_generation == snapshot.generation && !value.terminal
                && value.boundary.tool == cadence::execution::model::BoundaryTool::CadenceQuery
                && value.boundary.receipt == (Receipt::Compact { envelope:Envelope::Ok(Success::Complete {phase:*phase}) }))
        {
            return Err(Error::Invalid("invalid risk finalization decision".into()));
        }
        old_records.push(decision.clone());
        if snapshot.data != expected
            || old.generation.checked_add(1) != Some(snapshot.generation)
            || items.bytes != items.expected.bytes.as_deref().unwrap_or_default()
            || decisions.bytes != model::render_lines(&old_records)?
        {
            return Err(Error::Invalid(
                "risk finalization changed data outside its projection".into(),
            ));
        }
        Ok(())
    }

    fn validate_rail_receipt(&self, snapshot: &Snapshot) -> Result<()> {
        let IntentKind::RailReceipt { record } = &self.kind else {
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
                "rail receipt cannot change external participants".into(),
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
                    "rail receipt cannot adopt partial store".into(),
                ));
            }
        };
        let mut expected: Vec<DecisionRecord> = model::parse_lines(old_decisions)?;
        expected.push(super::writer::rail_fact_record(record)?);
        if items.bytes != old_items
            || decisions.bytes != model::render_lines(&expected)?
            || old.generation.checked_add(1) != Some(snapshot.generation)
            || record.confirmation.generation != snapshot.generation
            || snapshot.operations != old.operations
            || cadence::rail::receipts::read(&old.data)
                .map_err(super::writer::rail_error)?
                .contains_key(&record.fact.key().map_err(super::writer::rail_error)?)
            || snapshot.data
                != cadence::rail::receipts::project(&old.data, record)
                    .map_err(super::writer::rail_error)?
        {
            return Err(Error::Invalid(
                "rail receipt changed data outside its projection".into(),
            ));
        }
        Ok(())
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
            IntentKind::ExecutionDispatchV1 { phase, decision_id }
            | IntentKind::NativeExecutionDispatchV1 { phase, decision_id, .. } => (
                BoundaryScope::Execution { phase: *phase },
                decision_id,
                false,
            ),
            IntentKind::ExecutionFinalizeRiskV1 {
                phase, decision_id, ..
            } => (
                BoundaryScope::Execution { phase: *phase },
                decision_id,
                true,
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
            IntentKind::ExecutionDispatchV1 { phase, .. }
            | IntentKind::NativeExecutionDispatchV1 { phase, .. } => {
                if let IntentKind::NativeExecutionDispatchV1 {inventory,..}=&self.kind {
                    let inventory:cadence::plan::inventory::Inventory=serde_json::from_slice(inventory.bytes.as_deref().ok_or_else(||Error::Invalid("missing native dispatch inventory".into()))?)?;
                    cadence::plan::persistence::require_execution_ready(&snapshot.data,*phase,&inventory.documents)?;
                } else {cadence::plan::persistence::require_legacy_execution(&snapshot.data,*phase)?;}
                let execution = execution_snapshot(snapshot)?;
                let active = execution
                    .occurrences
                    .get(&phase.to_string())
                    .and_then(|o| o.active.as_ref())
                    .ok_or_else(|| {
                        Error::Invalid("dispatch intent lacks active dispatch".into())
                    })?;
                super::writer::validate_routing(active, &records)?;
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
                        envelope: Envelope::Refused { code, .. },
                    } => {
                        code == "risk-pending"
                            && risk_basis.is_some()
                            && occurrence.terminal.is_none()
                            && occurrence.active.is_none()
                            && receipt.outcome.disposition
                                == cadence::execution::model::PlanDisposition::Complete
                    }
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
    kind: &IntentKind,
) -> Result<()> {
    if let IntentKind::NativeTaskV1 {request,root_binding}=kind
        && let cadence::execution::history::Event::Checkpoint {records,..}=&request.event
    {
        for record in records {
            let mut filesystem=super::filesystem::Filesystem::new(&record.scope.planning_root)?;
            if filesystem.read(STATE)?.directory_identity!=*root_binding {
                return Err(Error::Invalid("native checkpoint differs from bound store".into()));
            }
        }
    }
    if let IntentKind::NativeTaskV1 {request,root_binding}=kind
        && let cadence::execution::history::Event::Close(proof)=&request.event
    {
        let mut filesystem=super::filesystem::Filesystem::new(&proof.planning_root)?;
        if filesystem.read(STATE)?.directory_identity!=*root_binding {
            return Err(Error::Invalid("native close project differs from bound store".into()));
        }
        cadence::execution::receipts::reobserve_source(&proof.project,&proof.dispatch,&request.task.task,&proof.source)?;
    }
    if let IntentKind::NativeAdmissionV1 {request,root_binding,inventory}=kind {
        let observed=storage.read(&format!("phase-plan-inventory:{}",request.contract.phase))?;
        if observed!=*inventory || storage.read(STATE)?.directory_identity!=*root_binding {
            return Err(cadence::execution::admission::refuse(request.contract.phase,"admission-inputs-changed","contract.plans","","installed PLAN inventory or root changed before confirmation"));
        }
    }
    if let IntentKind::NativeExecutionDispatchV1 {phase,inventory,..}=kind
        && storage.read(&format!("phase-plan-inventory:{phase}"))?!=*inventory
    {
        return Err(cadence::execution::admission::refuse(*phase,"admission-inputs-changed","contract.plans","","installed PLAN inventory changed before dispatch confirmation"));
    }
    // This entire pass finishes before any participant can change.
    for participant in participants {
        let actual = storage.read(&participant.target)?;
        participant.validate(&actual, replay)?;
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
    validate_all(storage, &participants, false, &kind)?;
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
    let prospective = intent.validate()?;
    let route = match &intent.kind {
        IntentKind::ExecutionDispatchV1 { phase, .. }
        | IntentKind::NativeExecutionDispatchV1 { phase, .. } => execution_snapshot(&prospective)?
            .occurrences
            .get(&phase.to_string())
            .and_then(|occurrence| occurrence.active.as_ref())
            .and_then(|dispatch| dispatch.route.clone()),
        _ => None,
    };
    let bytes = serde_json::to_vec(&intent)?;
    let intent_file = match storage.prepare(INTENT, &bytes) {
        Ok(file) => file,
        Err(error) => {
            dispose(storage, prepared)?;
            return Err(error);
        }
    };
    if let Err(error) =
        validate_all(storage, &intent.participants, false, &intent.kind).and_then(|()| match &route {
            Some(route) => policy.validate_routing_admission(
                &MutationContext {
                    operation: context.operation,
                    snapshot: &prospective,
                },
                &route.inputs,
            ),
            None => policy.validate(context),
        })
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
        let result = validate_all(storage, &intent.participants, true, &intent.kind)
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
    validate_all(storage, &intent.participants, true, &intent.kind)?;
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
    validate_all(storage, &intent.participants, true, &intent.kind)?;
    policy.validate(&MutationContext {
        operation: if matches!(intent.kind, IntentKind::GuardAudit { .. }) {
            "guard_audit_recovery"
        } else {
            "recovery"
        },
        snapshot: &snapshot,
    })?;
    for participant in &intent.participants {
        validate_all(storage, &intent.participants, true, &intent.kind)?;
        let current = storage.read(&participant.target)?;
        if current.bytes.as_ref() == Some(&participant.bytes) {
            // Rename may have completed before its directory sync. Reconfirm
            // both file and directory even when no semantic update is needed.
            storage.resync(&participant.target, &participant.bytes)?;
        } else {
            let file = storage.prepare(&participant.target, &participant.bytes)?;
            let result = validate_all(storage, &intent.participants, true, &intent.kind)
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
    validate_all(storage, &intent.participants, true, &intent.kind)?;
    storage.remove(INTENT)
}

#[cfg(test)]
mod provenance_tests {
    use super::*;
    use serde_json::json;

    fn kind(operation: &str) -> IntentKind {
        let scope = json!({"project":"/project","planning_root":"/project/.planning","cycle":"live",
            "occurrence":"one","phase":8,"worker":null,"plan":null});
        let mut value = json!({"operation":operation});
        match operation {
            "store" => {}
            "execution-dispatch" | "execution-refusal" => value["phase"] = json!(8),
            "execution-dispatch-v1" => {
                value["phase"] = json!(8);
                value["decision_id"] = json!("dispatch");
            }
            "execution-patch" => {
                value["phase"] = json!(8);
                value["render_version"] = json!(1);
                value["summary"] = json!(false);
            }
            "execution-patch-v1" => {
                value["phase"] = json!(8);
                value["decision_id"] = json!("patch");
                value["render_version"] = json!(1);
            }
            "boundary-observation-v1" => {
                value["scope"] = json!({"scope":"execution","phase":8});
                value["decision_id"] = json!("observation");
            }
            "execution-finalize-risk-v1" => {
                value["phase"] = json!(8);
                value["decision_id"] = json!("finalization");
                value["requirements"] = json!([]);
            }
            "guard-audit" => {
                value["audit"] = json!({
                    "event_id":"audit","command_digest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    "cwd":"/project","project":"/project","verb":"commit","branch":null,"policy":null,
                    "outcome":"ask","unavailable":[],"reason":"fixture"
                })
            }
            "rail-observation" => {
                value["record"] = json!({
                    "observation":{"version":1,"request_id":"scan","request_digest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                        "scope":scope,"source":{"kind":"committed","base":"HEAD~1","head":"HEAD"},
                        "resolution":{"kind":"committed","base_id":null,"head_id":null},
                        "outcome":"no-range","surfaces":[],"scan":null,"diagnostics":[]},
                    "confirmation":{"generation":1,"decision_id":"scan","observation_digest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}
                })
            }
            "rail-receipt" => {
                value["record"] = json!({
                    "version":1,"fact":{"operation":"risk-fire","request_id":"fire","fire":{
                        "id":"fire","binding":{"boundary":{"scope":scope,"run_id":"one","after_generation":0},
                            "observation":{"generation":1,"decision_id":"scan","observation_digest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
                            "material":{"kind":"committed","base_id":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","head_id":"cccccccccccccccccccccccccccccccccccccccc"},"surfaces":[]},
                        "review_scope":[],"rearm_of":null}},
                    "confirmation":{"generation":2,"decision_id":"fire","fact_digest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}
                })
            }
            _ => unreachable!(),
        }
        serde_json::from_value(value).unwrap()
    }

    fn previous() -> Value {
        json!({"import":{"complete":true},"source_evidence":[{"source":{"path":"/old/config.json","bytes":[123,125]}}],
            "archive":{"available":true},"cursor":{"phase":8},"execution":{"old":true}})
    }

    macro_rules! variant {
        ($good:ident, $bad:ident, $name:literal) => {
            #[test]
            fn $good() {
                let proposed = json!({"import":{"complete":true},"source_evidence":[{"source":{"path":"/old/config.json","bytes":[123,125]}}],
                    "archive":{"available":true},"cursor":{"phase":8},"execution":{"new":true}});
                assert_eq!(kind($name).validate_provenance(&previous(), &proposed), Ok(()));
            }
            #[test]
            fn $bad() {
                let proposed = json!({"import":{"complete":true},"archive":{"available":true},"cursor":{"phase":8}});
                assert_eq!(kind($name).validate_provenance(&previous(), &proposed),
                    Err(Error::Invalid("snapshot replacement changed provenance: source_evidence".into())));
            }
        };
    }
    variant!(store_retains, store_refuses_loss, "store");
    variant!(
        dispatch_retains,
        dispatch_refuses_loss,
        "execution-dispatch"
    );
    variant!(patch_retains, patch_refuses_loss, "execution-patch");
    variant!(refusal_retains, refusal_refuses_loss, "execution-refusal");
    variant!(
        dispatch_v1_retains,
        dispatch_v1_refuses_loss,
        "execution-dispatch-v1"
    );
    variant!(
        patch_v1_retains,
        patch_v1_refuses_loss,
        "execution-patch-v1"
    );
    variant!(
        observation_retains,
        observation_refuses_loss,
        "boundary-observation-v1"
    );
    variant!(
        finalization_retains,
        finalization_refuses_loss,
        "execution-finalize-risk-v1"
    );
    variant!(audit_retains, audit_refuses_loss, "guard-audit");
    variant!(
        rail_observation_retains,
        rail_observation_refuses_loss,
        "rail-observation"
    );
    variant!(
        rail_receipt_retains,
        rail_receipt_refuses_loss,
        "rail-receipt"
    );

    #[test]
    fn wrapped_evidence_cannot_be_dropped_by_a_flattened_replacement() {
        assert_eq!(
            preserve_provenance(
                &json!({"import":{"complete":true},"current":{"source_evidence":[{"exact":[1,null]}]}}),
                &json!({"import":{"complete":true},"source_evidence":[{"exact":[1,null]}]})
            ),
            Err(Error::Invalid(
                "snapshot replacement changed provenance: source_evidence".into()
            ))
        );
    }
}
