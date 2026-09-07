//! Pure checked-material comparisons. Observations are supplied by the adapter.
use super::{
    Fact, Record, Scope,
    checker::{Attempt, CheckedMaterial, Checker},
};
use crate::store::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "status", content = "value", rename_all = "snake_case")]
pub enum Observation {
    Read(String),
    Failed(String),
}
pub type Observations = BTreeMap<String, Observation>;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Freshness {
    Current,
    Changed,
    Unavailable,
}

pub fn compare(expected: &[CheckedMaterial], observed: &Observations) -> Freshness {
    if expected.is_empty()
        || expected
            .iter()
            .any(|m| !matches!(observed.get(&m.path), Some(Observation::Read(_))))
    {
        return Freshness::Unavailable;
    }
    if expected
        .iter()
        .all(|m| observed.get(&m.path) == Some(&Observation::Read(m.content_digest.clone())))
    {
        Freshness::Current
    } else {
        Freshness::Changed
    }
}

pub fn checker<'a>(records: &'a [Record], scope: &Scope, id: &str) -> Result<&'a Checker> {
    records
        .iter()
        .find_map(|r| match &r.fact {
            Fact::Checker(c) if r.scope == *scope && c.id == id => Some(c),
            _ => None,
        })
        .ok_or_else(|| Error::Invalid("checker observation not recorded for this work".into()))
}

/// The revision observes only its narrowed material. Other initial inputs keep
/// their original observation, rather than being attributed to the second check.
pub fn basis(records: &[Record], scope: &Scope, id: &str) -> Result<Vec<CheckedMaterial>> {
    let check = checker(records, scope, id)?;
    let mut basis = BTreeMap::new();
    if let Attempt::Revision { previous_check, .. } = &check.attempt {
        let initial = checker(records, scope, previous_check)?;
        if !matches!(initial.attempt, Attempt::Initial) {
            return Err(Error::Invalid(
                "revision must refer to an initial check".into(),
            ));
        }
        for material in &initial.checked_material {
            basis.insert(material.path.clone(), material.clone());
        }
    }
    for material in &check.checked_material {
        basis.insert(material.path.clone(), material.clone());
    }
    Ok(basis.into_values().collect())
}
