//! Shared risk vocabulary and immutable material identity. No workflow consequences.
use crate::store::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

pub const CATEGORIES: [&str; 8] = [
    "auth",
    "migrations",
    "billing",
    "concurrency",
    "destructive",
    "secrets",
    "api_contract",
    "untrusted_input",
];

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum MaterialIdentity {
    Committed { base_id: String, head_id: String },
    Staged { base_id: String, index_id: String },
}

pub fn valid_object_id(id: &str) -> bool {
    matches!(id.len(), 40 | 64)
        && id
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

impl MaterialIdentity {
    pub fn validate(&self) -> Result<()> {
        if !valid_object_id(self.base_id()) || !valid_object_id(self.tip_id()) {
            return Err(Error::Invalid(
                "material requires full immutable object IDs".into(),
            ));
        }
        Ok(())
    }
    pub fn no_range(&self) -> bool {
        matches!(self, Self::Committed { base_id, head_id } if base_id == head_id)
    }

    pub fn base_id(&self) -> &str {
        match self {
            Self::Committed { base_id, .. } | Self::Staged { base_id, .. } => base_id,
        }
    }
    pub fn tip_id(&self) -> &str {
        match self {
            Self::Committed { head_id, .. } => head_id,
            Self::Staged { index_id, .. } => index_id,
        }
    }
}

/// A null policy is an unanswered choice, distinct from an invalid selection.
pub fn configured_surfaces(value: &serde_json::Value) -> Result<Option<Vec<String>>> {
    if value.is_null() {
        return Ok(None);
    }
    let values = value
        .as_array()
        .ok_or_else(|| Error::Policy("invalid effective risk_surface surfaces".into()))?
        .iter()
        .map(|value| {
            value
                .as_str()
                .map(str::to_owned)
                .ok_or_else(|| Error::Policy("invalid effective risk surface".into()))
        })
        .collect::<Result<Vec<_>>>()?;
    validate_surfaces(values).map(Some)
}

pub fn validate_surfaces(values: Vec<String>) -> Result<Vec<String>> {
    let mut unique = BTreeSet::new();
    if values.is_empty()
        || values
            .iter()
            .any(|value| !CATEGORIES.contains(&value.as_str()) || !unique.insert(value.clone()))
    {
        return Err(Error::Invalid("invalid risk surface answer".into()));
    }
    Ok(values)
}

use super::risk_diff::Scan;
use crate::store::{
    model::{self, Decision, DecisionRecord, Evidence, Origin},
    writer::View,
};
use schemars::JsonSchema;
use std::{collections::BTreeMap, num::NonZeroU32};

pub const NAMESPACE: &str = "rail_observations";
const MARKER: &str = "cadence.rail.observation.v1";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ScopeSelection {
    pub phase: NonZeroU32,
    pub occurrence: String,
    pub worker: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Source {
    Committed {
        base: String,
        head: String,
    },
    Staged {
        base: String,
    },
    Execution {
        plan: NonZeroU32,
        dispatch_id: String,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum Apply {
    #[serde(rename = "risk-check")]
    RiskCheck {
        request_id: String,
        scope: ScopeSelection,
        source: Source,
        surfaces: Option<Vec<String>>,
    },
}

impl Apply {
    pub fn request_id(&self) -> &str {
        match self {
            Self::RiskCheck { request_id, .. } => request_id,
        }
    }
    pub fn digest(&self) -> Result<String> {
        Ok(model::digest(&serde_json::to_vec(self)?))
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Scope {
    pub project: String,
    pub planning_root: String,
    pub cycle: String,
    pub occurrence: String,
    pub phase: NonZeroU32,
    pub worker: Option<String>,
    pub plan: Option<NonZeroU32>,
}

pub fn validate_name(value: &str) -> Result<()> {
    if value.is_empty()
        || value.len() > 256
        || !value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"-_.:".contains(&b))
    {
        return Err(Error::Invalid(
            "invalid rail scope or request identity".into(),
        ));
    }
    Ok(())
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Resolution {
    Committed {
        base_id: Option<String>,
        head_id: Option<String>,
    },
    Staged {
        base_id: Option<String>,
        index_id: Option<String>,
    },
}

impl Resolution {
    pub fn material(&self) -> Option<MaterialIdentity> {
        match self {
            Self::Committed {
                base_id: Some(base_id),
                head_id: Some(head_id),
            } => Some(MaterialIdentity::Committed {
                base_id: base_id.clone(),
                head_id: head_id.clone(),
            }),
            Self::Staged {
                base_id: Some(base_id),
                index_id: Some(index_id),
            } => Some(MaterialIdentity::Staged {
                base_id: base_id.clone(),
                index_id: index_id.clone(),
            }),
            _ => None,
        }
    }
    pub fn validate(&self) -> Result<()> {
        let (base, tip) = match self {
            Self::Committed { base_id, head_id } => (base_id, head_id),
            Self::Staged { base_id, index_id } => (base_id, index_id),
        };
        if base.iter().chain(tip).any(|id| !valid_object_id(id)) {
            return Err(Error::Invalid(
                "resolution contains a non-object identity".into(),
            ));
        }
        Ok(())
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum ObservationOutcome {
    Checked,
    Unchecked,
    NoRange,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Observation {
    pub version: u32,
    pub request_id: String,
    pub request_digest: String,
    pub scope: Scope,
    pub source: Source,
    pub resolution: Resolution,
    pub outcome: ObservationOutcome,
    pub surfaces: Vec<String>,
    pub scan: Option<Scan>,
    pub diagnostics: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Confirmation {
    pub generation: u64,
    pub decision_id: String,
    pub observation_digest: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Recorded {
    pub observation: Observation,
    pub confirmation: Confirmation,
}

impl Observation {
    pub fn key(&self) -> Result<String> {
        key(&self.scope, &self.request_id)
    }
    pub fn validate(&self) -> Result<()> {
        validate_name(&self.request_id)?;
        validate_name(&self.scope.occurrence)?;
        if let Some(worker) = &self.scope.worker {
            validate_name(worker)?;
        }
        if self.version != 1
            || self.scope.project.is_empty()
            || self.scope.planning_root.is_empty()
            || self.scope.cycle != "live"
            || (self.request_digest.len() != 64
                || !self.request_digest.bytes().all(|b| b.is_ascii_hexdigit()))
        {
            return Err(Error::Invalid("invalid rail observation identity".into()));
        }
        validate_surfaces(self.surfaces.clone())?;
        self.resolution.validate()?;
        if !matches!(
            (&self.source, &self.resolution),
            (Source::Committed { .. }, Resolution::Committed { .. })
                | (Source::Staged { .. }, Resolution::Staged { .. })
                | (Source::Execution { .. }, Resolution::Committed { .. })
        ) {
            return Err(Error::Invalid("source and resolution kinds differ".into()));
        }
        if let Source::Execution { plan, .. } = &self.source
            && (self.scope.plan != Some(*plan)
                || self.scope.worker.as_deref() != Some(plan.to_string().as_str())
                || self.scope.occurrence != format!("phase-{}-execution", self.scope.phase))
        {
            return Err(Error::Invalid(
                "execution observation scope mismatch".into(),
            ));
        }
        let material = self.resolution.material();
        let no_range = material.as_ref().is_some_and(MaterialIdentity::no_range);
        match (&self.outcome, &self.scan) {
            (ObservationOutcome::NoRange, None) if no_range => {}
            (ObservationOutcome::Checked, Some(scan))
                if !no_range && material.is_some() && scan.checked => {}
            (ObservationOutcome::Unchecked, Some(scan))
                if !no_range
                    && !scan.checked
                    && scan.inconclusive
                    && !scan.empty
                    && scan.matches.is_empty() => {}
            _ => {
                return Err(Error::Invalid(
                    "observation outcome disagrees with material or scan".into(),
                ));
            }
        }
        if let Some(scan) = &self.scan {
            if scan.categories != self.surfaces
                || (scan.empty && (scan.inconclusive || !scan.matches.is_empty()))
            {
                return Err(Error::Invalid("invalid recorded classifier result".into()));
            }
            let mut prior = None;
            for matched in &scan.matches {
                let index = self
                    .surfaces
                    .iter()
                    .position(|value| value == &matched.category)
                    .ok_or_else(|| Error::Invalid("match outside selected surfaces".into()))?;
                if prior.is_some_and(|old| old >= index) || matched.signal.is_empty() {
                    return Err(Error::Invalid("invalid match ordering or signal".into()));
                }
                prior = Some(index);
            }
        }
        Ok(())
    }
}

pub fn key(scope: &Scope, request_id: &str) -> Result<String> {
    Ok(format!(
        "rail-risk-{}",
        model::digest(&serde_json::to_vec(&(scope, request_id))?)
    ))
}

impl Recorded {
    pub fn new(observation: Observation, generation: u64) -> Result<Self> {
        observation.validate()?;
        let confirmation = Confirmation {
            generation,
            decision_id: observation.key()?,
            observation_digest: model::digest(&serde_json::to_vec(&observation)?),
        };
        Ok(Self {
            observation,
            confirmation,
        })
    }
    pub fn validate(&self) -> Result<()> {
        if self.confirmation.generation == 0
            || Self::new(self.observation.clone(), self.confirmation.generation)? != *self
        {
            return Err(Error::Invalid("invalid rail confirmation identity".into()));
        }
        Ok(())
    }
    pub fn decision(&self) -> Result<DecisionRecord> {
        self.validate()?;
        Ok(DecisionRecord {
            version: model::VERSION,
            id: self.confirmation.decision_id.clone(),
            revision: 1,
            origin: Origin {
                source: MARKER.into(),
                original: Evidence::Missing,
            },
            decision: Decision::Gate {
                outcome: if self.observation.outcome == ObservationOutcome::NoRange {
                    "risk-skipped-no-range"
                } else {
                    "risk-observed"
                }
                .into(),
                evidence: Evidence::Text(serde_json::to_string(self)?),
            },
        })
    }
}

pub fn read(data: &serde_json::Value) -> Result<BTreeMap<String, Recorded>> {
    let Some(value) = data.get(NAMESPACE) else {
        return Ok(BTreeMap::new());
    };
    let records: BTreeMap<String, Recorded> = serde_json::from_value(value.clone())?;
    for (key, record) in &records {
        record.validate()?;
        if *key != record.observation.key()? {
            return Err(Error::Invalid("rail observation key mismatch".into()));
        }
    }
    Ok(records)
}

pub fn project(data: &serde_json::Value, record: &Recorded) -> Result<serde_json::Value> {
    record.validate()?;
    let mut records = read(data)?;
    let key = record.observation.key()?;
    if records.get(&key).is_some_and(|old| old != record) {
        return Err(Error::Conflict("rail request identity reused".into()));
    }
    records.insert(key, record.clone());
    let mut result = if data.is_null() {
        serde_json::json!({})
    } else {
        data.clone()
    };
    result
        .as_object_mut()
        .ok_or_else(|| Error::Invalid("rail snapshot is not an object".into()))?
        .insert(NAMESPACE.into(), serde_json::to_value(records)?);
    Ok(result)
}

pub fn confirmed(view: &View, scope: &Scope, request_id: &str) -> Result<Option<Recorded>> {
    let Some(record) = read(&view.snapshot.data)?.remove(&key(scope, request_id)?) else {
        return Ok(None);
    };
    if record.confirmation.generation > view.snapshot.generation
        || !view.decisions.contains(&record.decision()?)
    {
        return Err(Error::Invalid(
            "rail observation lacks confirmed history".into(),
        ));
    }
    Ok(Some(record))
}

/// Captured from the admitted dispatch in the same transaction as its accepted
/// patch. Completion clears `active`, so subsequent consumers need this basis.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExecutionBasis {
    pub version: u32,
    pub phase: u32,
    pub plan: u32,
    pub dispatch_id: String,
    pub plan_set_fingerprint: String,
    pub plan_fingerprint: String,
    pub base_id: String,
    pub commits: Vec<String>,
    pub transition_id: String,
}

pub const EXECUTION_MATERIAL: &str = "rail_execution_material";
pub const NATIVE_EXECUTION_MATERIAL: &str = "native_execution_material";

/// Native evidence commits participate in the same risk range, while the
/// original dispatch and admission remain stable across a gap extension.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NativeExecutionBasis {
    pub schema: String,
    pub task: crate::execution::history::Task,
    pub execution: ExecutionBasis,
    pub source: crate::execution::receipts::SourceMaterial,
}

impl NativeExecutionBasis {
    pub fn new(active: &crate::execution::model::ActiveDispatch, task: crate::execution::history::Task,
        source: crate::execution::receipts::SourceMaterial, transition_id: String) -> Result<Self> {
        if active.phase != task.phase || active.plan != task.plan {
            return Err(Error::Invalid("native material differs from active dispatch".into()));
        }
        let mut commits = source.evidence_commits.clone();
        commits.retain(|sha| sha != &source.completion);
        commits.push(source.completion.clone());
        let execution = ExecutionBasis { version: 1, phase: active.phase, plan: active.plan, dispatch_id: active.id.clone(),
            plan_set_fingerprint: active.plan_set_fingerprint.clone(), plan_fingerprint: active.plan_fingerprint.clone(),
            base_id: active.base_sha.clone(), commits, transition_id };
        execution.validate()?;
        Ok(Self { schema: "native-execution-material-1".into(), task, execution, source })
    }

    pub fn material(&self) -> MaterialIdentity {
        MaterialIdentity::Committed { base_id: self.execution.base_id.clone(), head_id: self.source.completion.clone() }
    }
}

pub fn native_execution_bases(data: &serde_json::Value) -> Result<Vec<NativeExecutionBasis>> {
    let records: Vec<NativeExecutionBasis> = data.get(NATIVE_EXECUTION_MATERIAL).cloned().map(serde_json::from_value).transpose()?.unwrap_or_default();
    let mut seen = BTreeSet::new();
    for record in &records {
        record.execution.validate()?;
        if record.schema != "native-execution-material-1" || record.task.phase != record.execution.phase || record.task.plan != record.execution.plan
            || record.execution.commits.last() != Some(&record.source.completion) || !seen.insert(&record.execution.transition_id) {
            return Err(Error::Invalid("native material identity or encoding differs".into()));
        }
    }
    Ok(records)
}

pub fn project_native_execution_basis(data: &serde_json::Value, basis: &NativeExecutionBasis) -> Result<serde_json::Value> {
    let mut records = native_execution_bases(data)?;
    if let Some(prior) = records.iter().find(|r| r.execution.transition_id == basis.execution.transition_id) {
        if prior != basis { return Err(Error::Conflict("native material identity reused".into())); }
        return Ok(data.clone());
    }
    records.push(basis.clone());
    let mut next = data.clone();
    next.as_object_mut().ok_or_else(|| Error::Invalid("native material snapshot must be an object".into()))?
        .insert(NATIVE_EXECUTION_MATERIAL.into(), serde_json::to_value(records)?);
    native_execution_bases(&next)?;
    Ok(next)
}

impl ExecutionBasis {
    pub fn from_accepted(
        active: &crate::execution::model::ActiveDispatch,
        outcome: &crate::execution::model::PlanOutcome,
    ) -> Result<Self> {
        if active.id != outcome.dispatch_id
            || active.phase != outcome.phase
            || active.plan != outcome.plan
        {
            return Err(Error::Invalid(
                "accepted material differs from dispatch".into(),
            ));
        }
        let result = Self {
            version: 1,
            phase: active.phase,
            plan: active.plan,
            dispatch_id: active.id.clone(),
            plan_set_fingerprint: active.plan_set_fingerprint.clone(),
            plan_fingerprint: active.plan_fingerprint.clone(),
            base_id: active.base_sha.clone(),
            commits: completed_commits(outcome),
            transition_id: outcome.transition_id.clone(),
        };
        result.validate()?;
        Ok(result)
    }
    pub fn validate(&self) -> Result<()> {
        if self.version != 1
            || self.phase == 0
            || self.plan == 0
            || !valid_object_id(&self.base_id)
            || self.commits.iter().any(|id| !valid_object_id(id))
            || [
                &self.dispatch_id,
                &self.plan_set_fingerprint,
                &self.plan_fingerprint,
                &self.transition_id,
            ]
            .iter()
            .any(|id| id.len() != 64 || !id.bytes().all(|b| b.is_ascii_hexdigit()))
        {
            return Err(Error::Invalid(
                "invalid execution risk material basis".into(),
            ));
        }
        Ok(())
    }
}

pub fn completed_commits(outcome: &crate::execution::model::PlanOutcome) -> Vec<String> {
    outcome
        .tasks
        .iter()
        .filter_map(|task| match task {
            crate::execution::model::TaskOutcome::Completed { commit, .. } => Some(commit.clone()),
            _ => None,
        })
        .collect()
}

pub fn execution_bases(data: &serde_json::Value) -> Result<BTreeMap<String, ExecutionBasis>> {
    let Some(value) = data.get(EXECUTION_MATERIAL) else {
        return Ok(BTreeMap::new());
    };
    let bases: BTreeMap<String, ExecutionBasis> = serde_json::from_value(value.clone())?;
    for (key, basis) in &bases {
        basis.validate()?;
        if *key != basis.dispatch_id {
            return Err(Error::Invalid("execution material key mismatch".into()));
        }
    }
    Ok(bases)
}

pub fn project_execution_basis(
    data: &serde_json::Value,
    basis: &ExecutionBasis,
) -> Result<serde_json::Value> {
    basis.validate()?;
    let mut bases = execution_bases(data)?;
    if bases
        .get(&basis.dispatch_id)
        .is_some_and(|old| old != basis)
    {
        return Err(Error::Conflict("execution material identity reused".into()));
    }
    bases.insert(basis.dispatch_id.clone(), basis.clone());
    let mut next = data.clone();
    next.as_object_mut()
        .ok_or_else(|| Error::Invalid("execution material snapshot is not an object".into()))?
        .insert(EXECUTION_MATERIAL.into(), serde_json::to_value(bases)?);
    Ok(next)
}
