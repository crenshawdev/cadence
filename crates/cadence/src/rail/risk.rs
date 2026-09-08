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

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum MaterialIdentity {
    Committed { base_id: String, head_id: String },
    Staged { base_id: String, index_id: String },
}

impl MaterialIdentity {
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
    Committed { base: String, head: String },
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
#[serde(deny_unknown_fields)]
pub struct Resolution {
    pub base_id: Option<String>,
    pub head_id: Option<String>,
    pub index_id: Option<String>,
}

impl Resolution {
    pub fn material(&self) -> Option<MaterialIdentity> {
        match (&self.base_id, &self.head_id, &self.index_id) {
            (Some(base_id), Some(head_id), None) => Some(MaterialIdentity::Committed {
                base_id: base_id.clone(),
                head_id: head_id.clone(),
            }),
            (Some(base_id), None, Some(index_id)) => Some(MaterialIdentity::Staged {
                base_id: base_id.clone(),
                index_id: index_id.clone(),
            }),
            _ => None,
        }
    }
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
    pub scan: Scan,
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
        validate_surfaces(self.scan.categories.clone())?;
        if self.scan.checked && self.resolution.material().is_none() {
            return Err(Error::Invalid(
                "checked scan lacks immutable material".into(),
            ));
        }
        if !self.scan.checked && (!self.scan.inconclusive || self.scan.empty) {
            return Err(Error::Invalid(
                "unchecked observation cannot be clean".into(),
            ));
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
                outcome: "risk-observed".into(),
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
