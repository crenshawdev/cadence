//! Contracted facts about a review, independent of detection and provider dispatch.
use super::risk::{self, MaterialIdentity, ObservationOutcome, Recorded, Scope};
use crate::store::{Error, Result};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

/// The native admission/signoff boundary, never reconstructed from report prose.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Boundary {
    pub scope: Scope,
    pub run_id: String,
    pub after_generation: u64,
}

impl Boundary {
    pub fn contains(&self, record: &Recorded) -> bool {
        let run = match &record.observation.source {
            risk::Source::Execution { dispatch_id, .. } => dispatch_id,
            _ => &record.observation.scope.occurrence,
        };
        record.observation.scope == self.scope
            && *run == self.run_id
            && record.confirmation.generation > self.after_generation
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Binding {
    pub boundary: Boundary,
    pub observation: risk::Confirmation,
    pub material: MaterialIdentity,
    pub surfaces: Vec<String>,
}

impl Binding {
    pub fn new(boundary: Boundary, record: &Recorded) -> Result<Self> {
        record.validate()?;
        if !boundary.contains(record) {
            return Err(invalid("scan is outside the current run/signoff boundary"));
        }
        Ok(Self {
            boundary,
            observation: record.confirmation.clone(),
            material: record
                .observation
                .resolution
                .material()
                .ok_or_else(|| invalid("scan has no exact material identity"))?,
            surfaces: record.observation.surfaces.clone(),
        })
    }

    pub fn matches(&self, record: &Recorded) -> bool {
        Self::new(self.boundary.clone(), record).is_ok_and(|binding| binding == *self)
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Fire {
    pub id: String,
    pub binding: Binding,
    /// Sorted, unique paths actually covered by this review. The resident obtains
    /// the original scope from the immutable diff, not a caller's declaration.
    pub review_scope: Vec<String>,
    pub rearm_of: Option<String>,
}

impl Fire {
    pub fn validate(&self, record: &Recorded) -> Result<()> {
        risk::validate_name(&self.id)?;
        if !self.binding.matches(record) || !requires_review(record) {
            return Err(invalid("fire requires its exact checked risk observation"));
        }
        if self.review_scope.windows(2).any(|pair| pair[0] >= pair[1])
            || self
                .review_scope
                .iter()
                .any(|path| !crate::execution::patch::safe_relative_path(path))
        {
            return Err(invalid(
                "review scope must contain unique sorted relative paths",
            ));
        }
        if let Some(original) = &self.rearm_of {
            risk::validate_name(original)?;
            if original == &self.id {
                return Err(invalid("fire cannot re-arm itself"));
            }
        }
        Ok(())
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "kebab-case", deny_unknown_fields)]
pub enum Consequence {
    Adjudication {
        passed: bool,
        evidence_id: String,
    },
    Rearm {
        next_fire: Box<Fire>,
    },
    GatePass {
        evidence_id: String,
    },
    Override {
        reason: String,
    },
    Deferral {
        pending_id: String,
        permits_continuation: bool,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Receipt {
    pub id: String,
    /// Full equality includes the absent head on staged material, scan generation,
    /// selected surfaces and the original/re-armed review scope.
    pub fire: Fire,
    pub consequence: Consequence,
}

impl Receipt {
    pub fn validate(&self, fire: &Fire) -> Result<()> {
        risk::validate_name(&self.id)?;
        if self.fire != *fire {
            return Err(invalid("receipt does not name the exact fire"));
        }
        match &self.consequence {
            Consequence::Override { reason } if reason.trim().is_empty() => {
                Err(invalid("override requires a nonblank reason"))
            }
            Consequence::Adjudication { evidence_id, .. }
            | Consequence::GatePass { evidence_id } => risk::validate_name(evidence_id),
            Consequence::Deferral { pending_id, .. } => risk::validate_name(pending_id),
            Consequence::Rearm { next_fire } => validate_rearm(fire, next_fire),
            _ => Ok(()),
        }
    }
}

pub fn validate_rearm(original: &Fire, next: &Fire) -> Result<()> {
    if original.rearm_of.is_some()
        || next.rearm_of.as_ref() != Some(&original.id)
        || next.id == original.id
        || next.binding.boundary != original.binding.boundary
        || next.binding.surfaces != original.binding.surfaces
        || next.binding.observation.generation <= original.binding.observation.generation
        || next.binding.material.base_id() != original.binding.material.base_id()
        || std::mem::discriminant(&next.binding.material)
            != std::mem::discriminant(&original.binding.material)
        || next.review_scope.is_empty()
        || next
            .review_scope
            .iter()
            .any(|path| !original.review_scope.contains(path))
    {
        return Err(invalid(
            "one re-arm requires its original fire and narrowed material scope",
        ));
    }
    Ok(())
}

pub fn requires_review(record: &Recorded) -> bool {
    record.observation.outcome == ObservationOutcome::Checked
        && record
            .observation
            .scan
            .as_ref()
            .is_some_and(|scan| scan.checked && (scan.inconclusive || !scan.matches.is_empty()))
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Requirement {
    pub boundary: Boundary,
    pub material: MaterialIdentity,
    pub surfaces: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum State {
    Missing,
    Stale,
    Unchecked,
    Unfired,
    Pending,
    Clear,
    Skipped,
    Settled,
    Deferred,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Status {
    pub state: State,
    pub permits_continuation: bool,
    pub observation: Option<risk::Confirmation>,
    pub pending_fires: Vec<String>,
    pub deferred_work: Vec<String>,
}

/// Assess current material plus *every* fire in the current boundary. An older
/// receipt cannot clear a newer scan, even if the endpoints happen to be equal.
pub fn status(
    wanted: &Requirement,
    records: &[Recorded],
    fires: &[Fire],
    receipts: &[Receipt],
) -> Result<Status> {
    wanted.material.validate()?;
    risk::validate_surfaces(wanted.surfaces.clone())?;
    risk::validate_name(&wanted.boundary.run_id)?;
    validate_history(records, fires, receipts)?;
    let relevant: Vec<_> = records
        .iter()
        .filter(|r| wanted.boundary.contains(r))
        .collect();
    let current = relevant
        .iter()
        .max_by_key(|r| r.confirmation.generation)
        .copied();
    let mut answer = Status {
        state: State::Missing,
        permits_continuation: false,
        observation: current.map(|r| r.confirmation.clone()),
        pending_fires: Vec::new(),
        deferred_work: Vec::new(),
    };
    let Some(current) = current else {
        return Ok(answer);
    };
    if current.observation.resolution.material().as_ref() != Some(&wanted.material)
        || current.observation.surfaces != wanted.surfaces
    {
        answer.state = if current.observation.outcome == ObservationOutcome::Unchecked {
            State::Unchecked
        } else {
            State::Stale
        };
        return Ok(answer);
    }
    if current.observation.outcome == ObservationOutcome::Unchecked {
        answer.state = State::Unchecked;
        return Ok(answer);
    }
    let relevant_fires: Vec<_> = fires
        .iter()
        .filter(|fire| fire.binding.boundary == wanted.boundary)
        .collect();
    if requires_review(current) && !relevant_fires.iter().any(|f| f.binding.matches(current)) {
        answer.state = State::Unfired;
        return Ok(answer);
    }
    for fire in relevant_fires {
        let receipt = receipts.iter().find(|r| r.fire == *fire);
        let permits = match receipt.map(|r| &r.consequence) {
            Some(Consequence::GatePass { .. } | Consequence::Override { .. }) => true,
            Some(Consequence::Adjudication { passed, .. }) => *passed,
            Some(Consequence::Deferral {
                pending_id,
                permits_continuation,
            }) => {
                answer.deferred_work.push(pending_id.clone());
                *permits_continuation
            }
            Some(Consequence::Rearm { next_fire }) => {
                // This only accounts for the original review. The new fire must
                // itself be submitted and its consequence examined in this loop.
                fires.contains(next_fire)
            }
            None => false,
        };
        if !permits {
            answer.pending_fires.push(fire.id.clone());
        }
    }
    answer.pending_fires.sort();
    answer.deferred_work.sort();
    answer.deferred_work.dedup();
    answer.permits_continuation = answer.pending_fires.is_empty();
    answer.state = if !answer.permits_continuation {
        State::Pending
    } else if !answer.deferred_work.is_empty() {
        State::Deferred
    } else if current.observation.outcome == ObservationOutcome::NoRange {
        State::Skipped
    } else if requires_review(current) {
        State::Settled
    } else {
        State::Clear
    };
    Ok(answer)
}

/// Strict facts only; text in a reviewer report never reaches this algebra.
pub fn validate_history(records: &[Recorded], fires: &[Fire], receipts: &[Receipt]) -> Result<()> {
    let mut observations = BTreeSet::new();
    for record in records {
        record.validate()?;
        if !observations.insert(&record.confirmation.decision_id) {
            return Err(invalid("duplicate observation identity"));
        }
    }
    let mut ids = BTreeSet::new();
    for fire in fires {
        if !ids.insert(&fire.id) {
            return Err(invalid("duplicate fire identity"));
        }
        let record = records
            .iter()
            .find(|r| fire.binding.matches(r))
            .ok_or_else(|| invalid("fire names an unknown observation"))?;
        fire.validate(record)?;
        if let Some(original) = &fire.rearm_of {
            let parent = fires
                .iter()
                .find(|f| &f.id == original)
                .ok_or_else(|| invalid("unknown original fire"))?;
            validate_rearm(parent, fire)?;
            if !receipts.iter().any(|r| r.fire == *parent
                && matches!(&r.consequence, Consequence::Rearm { next_fire } if **next_fire == *fire))
            { return Err(invalid("re-armed fire lacks its original consequence")); }
        }
    }
    let mut ids = BTreeSet::new();
    let mut settled = BTreeSet::new();
    for receipt in receipts {
        if !ids.insert(&receipt.id) || !settled.insert(&receipt.fire.id) {
            return Err(invalid(
                "duplicate receipt or multiple consequences for one fire",
            ));
        }
        let fire = fires
            .iter()
            .find(|f| f.id == receipt.fire.id)
            .ok_or_else(|| invalid("receipt names an unknown fire"))?;
        receipt.validate(fire)?;
        if let Consequence::Rearm { next_fire } = &receipt.consequence {
            let record = records
                .iter()
                .find(|r| next_fire.binding.matches(r))
                .ok_or_else(|| invalid("re-arm names an unknown scan"))?;
            next_fire.validate(record)?;
        }
    }
    Ok(())
}

fn invalid(message: &str) -> Error {
    Error::Invalid(message.into())
}

pub const NAMESPACE: &str = "rail_receipts";
const MARKER: &str = "cadence.rail.receipt.v1";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Query {
    pub scope: risk::ScopeSelection,
    pub source: risk::Source,
    pub surfaces: Option<Vec<String>>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Report {
    pub requirement: Requirement,
    pub assessment: Status,
    pub current_observation: Option<Recorded>,
    pub review_scope: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum Apply {
    #[serde(rename = "risk-fire")]
    Fire { request_id: String, fire: Box<Fire> },
    #[serde(rename = "risk-consequence")]
    Consequence {
        request_id: String,
        receipt: Box<Receipt>,
    },
}

impl Apply {
    pub fn request_id(&self) -> &str {
        match self {
            Self::Fire { request_id, .. } | Self::Consequence { request_id, .. } => request_id,
        }
    }
    pub fn fire(&self) -> &Fire {
        match self {
            Self::Fire { fire, .. } => fire,
            Self::Consequence { receipt, .. } => &receipt.fire,
        }
    }
    pub fn key(&self) -> Result<String> {
        Ok(format!(
            "rail-receipt-{}",
            crate::store::model::digest(&serde_json::to_vec(&(
                &self.fire().binding.boundary.scope,
                self.request_id()
            ))?)
        ))
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct FactConfirmation {
    pub generation: u64,
    pub decision_id: String,
    pub fact_digest: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct RecordedFact {
    pub version: u32,
    pub fact: Apply,
    pub confirmation: FactConfirmation,
}

impl RecordedFact {
    pub fn new(fact: Apply, generation: u64) -> Result<Self> {
        risk::validate_name(fact.request_id())?;
        if generation <= fact.fire().binding.observation.generation {
            return Err(invalid("receipt must follow its observation"));
        }
        let confirmation = FactConfirmation {
            generation,
            decision_id: fact.key()?,
            fact_digest: crate::store::model::digest(&serde_json::to_vec(&fact)?),
        };
        Ok(Self {
            version: 1,
            fact,
            confirmation,
        })
    }
    pub fn validate(&self) -> Result<()> {
        if *self != Self::new(self.fact.clone(), self.confirmation.generation)? {
            return Err(invalid("invalid receipt confirmation identity"));
        }
        Ok(())
    }
    pub fn decision(&self) -> Result<crate::store::model::DecisionRecord> {
        use crate::store::model::{Decision, DecisionRecord, Evidence, Origin, VERSION};
        self.validate()?;
        Ok(DecisionRecord {
            version: VERSION,
            id: self.confirmation.decision_id.clone(),
            revision: 1,
            origin: Origin {
                source: MARKER.into(),
                original: Evidence::Missing,
            },
            decision: Decision::Gate {
                outcome: match self.fact {
                    Apply::Fire { .. } => "risk-fired",
                    Apply::Consequence { .. } => "risk-consequence",
                }
                .into(),
                evidence: Evidence::Text(serde_json::to_string(self)?),
            },
        })
    }
}

pub fn read(data: &serde_json::Value) -> Result<std::collections::BTreeMap<String, RecordedFact>> {
    let Some(value) = data.get(NAMESPACE) else {
        return Ok(Default::default());
    };
    let records: std::collections::BTreeMap<String, RecordedFact> =
        serde_json::from_value(value.clone())?;
    for (key, record) in &records {
        record.validate()?;
        if *key != record.fact.key()? {
            return Err(invalid("receipt key mismatch"));
        }
    }
    Ok(records)
}

pub fn history(data: &serde_json::Value) -> Result<(Vec<Recorded>, Vec<Fire>, Vec<Receipt>)> {
    let observations = risk::read(data)?.into_values().collect::<Vec<_>>();
    let mut fires = Vec::new();
    let mut receipts = Vec::new();
    for record in read(data)?.into_values() {
        match record.fact {
            Apply::Fire { fire, .. } => fires.push(*fire),
            Apply::Consequence { receipt, .. } => receipts.push(*receipt),
        }
    }
    validate_history(&observations, &fires, &receipts)?;
    Ok((observations, fires, receipts))
}

pub fn confirmed_history(view: &crate::store::writer::View) -> Result<()> {
    for record in risk::read(&view.snapshot.data)?.values() {
        if record.confirmation.generation > view.snapshot.generation
            || !view.decisions.contains(&record.decision()?)
        {
            return Err(invalid("scan lacks confirmed durable history"));
        }
    }
    for record in read(&view.snapshot.data)?.values() {
        if record.confirmation.generation > view.snapshot.generation
            || !view.decisions.contains(&record.decision()?)
        {
            return Err(invalid("receipt lacks confirmed durable history"));
        }
    }
    history(&view.snapshot.data)?;
    Ok(())
}

pub fn project(data: &serde_json::Value, record: &RecordedFact) -> Result<serde_json::Value> {
    record.validate()?;
    let mut records = read(data)?;
    let key = record.fact.key()?;
    if records.get(&key).is_some_and(|old| old != record) {
        return Err(Error::Conflict("receipt request identity reused".into()));
    }
    // Ordering matters: a consequence cannot retroactively invent its fire, and a
    // re-armed fire cannot invent its original re-arm authorization.
    let (_, fires, _) = history(data)?;
    if let Apply::Consequence { receipt, .. } = &record.fact {
        let fire = fires
            .iter()
            .find(|f| **f == receipt.fire)
            .ok_or_else(|| invalid("consequence names an unknown fire"))?;
        receipt.validate(fire)?;
    }
    records.insert(key, record.clone());
    let mut next = data.clone();
    next.as_object_mut()
        .ok_or_else(|| invalid("receipt snapshot is not an object"))?
        .insert(NAMESPACE.into(), serde_json::to_value(records)?);
    history(&next)?;
    Ok(next)
}

pub fn assess(wanted: &Requirement, data: &serde_json::Value) -> Result<Status> {
    let (records, fires, receipts) = history(data)?;
    status(wanted, &records, &fires, &receipts)
}

/// Conditional finalization only changes the terminal field. Accepted task and
/// patch receipts remain immutable, including their original pending answer.
pub fn finalize_execution(
    data: &serde_json::Value,
    phase: u32,
    requirements: &[Requirement],
) -> Result<serde_json::Value> {
    use crate::execution::model::{ExecutionSnapshot, PlanDisposition, TerminalOutcome};
    let mut execution: ExecutionSnapshot = serde_json::from_value(
        data.get("execution")
            .ok_or_else(|| invalid("finalization lacks execution evidence"))?
            .clone(),
    )?;
    let occurrence = execution
        .occurrences
        .get_mut(&phase.to_string())
        .ok_or_else(|| invalid("finalization lacks an execution occurrence"))?;
    if occurrence.active.is_some()
        || occurrence.terminal.is_some()
        || occurrence.plans.is_empty()
        || occurrence
            .plans
            .iter()
            .any(|p| p.disposition != PlanDisposition::Complete)
        || requirements.len() != occurrence.plans.len()
    {
        return Err(invalid(
            "finalization requires exactly all accepted complete plans",
        ));
    }
    let bases = risk::execution_bases(data)?;
    let mut seen = BTreeSet::new();
    for outcome in &occurrence.plans {
        let requirement = requirements
            .iter()
            .find(|r| r.boundary.run_id == outcome.dispatch_id)
            .ok_or_else(|| invalid("finalization lacks a completed material requirement"))?;
        if !seen.insert(&requirement.boundary.run_id) {
            return Err(invalid("duplicate finalization requirement"));
        }
        let basis = bases
            .get(&outcome.dispatch_id)
            .ok_or_else(|| invalid("finalization lacks accepted material identity"))?;
        let scope = &requirement.boundary.scope;
        let expected = MaterialIdentity::Committed {
            base_id: basis.base_id.clone(),
            head_id: basis.commits.last().unwrap_or(&basis.base_id).clone(),
        };
        if scope.phase.get() != phase
            || scope.plan.map(|p| p.get()) != Some(outcome.plan)
            || scope.worker.as_deref() != Some(outcome.plan.to_string().as_str())
            || scope.cycle != "live"
            || scope.occurrence != format!("phase-{phase}-execution")
            || basis.phase != phase
            || basis.plan != outcome.plan
            || basis.plan_set_fingerprint != occurrence.plan_set_fingerprint
            || basis.transition_id != outcome.transition_id
            || basis.commits != risk::completed_commits(outcome)
            || requirement.material != expected
            || !assess(requirement, data)?.permits_continuation
        {
            return Err(invalid("current completed material is not settled"));
        }
    }
    occurrence.terminal = Some(TerminalOutcome::Complete { phase });
    let mut next = data.clone();
    next.as_object_mut()
        .ok_or_else(|| invalid("execution snapshot is not an object"))?
        .insert("execution".into(), serde_json::to_value(execution)?);
    Ok(next)
}
