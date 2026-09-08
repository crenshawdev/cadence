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
