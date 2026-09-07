//! Permission belongs to persisted work identity, never a process or a clock.
use super::{Fact, Record, Scope, nonblank};
use crate::store::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum Occurrence {
    Fulfilled { completion: String },
    Superseded { by: String },
}
impl Occurrence {
    pub fn validate(&self, scope: &Scope) -> Result<()> {
        match self {
            Self::Fulfilled { completion } => nonblank("occurrence completion", completion),
            Self::Superseded { by } => {
                nonblank("superseding occurrence", by)?;
                if by == &scope.occurrence {
                    return Err(Error::Invalid("occurrence cannot supersede itself".into()));
                }
                Ok(())
            }
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Permission {
    Absent,
    Pending,
    Fulfilled,
    Superseded,
}
impl Permission {
    pub fn active(&self) -> bool {
        self == &Self::Pending
    }
}

/// Recording the original grant establishes pending work. Preserving a pause
/// creates that grant; only an explicit resume completion ends the occurrence.
pub fn permission(records: &[Record], scope: &Scope, override_id: &str) -> Permission {
    if !records
        .iter()
        .any(|r| r.scope == *scope && matches!(&r.fact, Fact::Override(o) if o.id == override_id))
    {
        return Permission::Absent;
    }
    match records.iter().find_map(|r| {
        if r.scope == *scope {
            match &r.fact {
                Fact::Occurrence(state) => Some(state),
                _ => None,
            }
        } else {
            None
        }
    }) {
        Some(Occurrence::Fulfilled { .. }) => Permission::Fulfilled,
        Some(Occurrence::Superseded { .. }) => Permission::Superseded,
        None => Permission::Pending,
    }
}

pub(crate) fn validate_transition(
    records: &BTreeMap<String, Record>,
    record: &Record,
) -> Result<()> {
    if !matches!(record.fact, Fact::Occurrence(_) | Fact::Override(_)) {
        return Ok(());
    }
    if records
        .values()
        .any(|r| r.scope == record.scope && matches!(r.fact, Fact::Occurrence(_)))
    {
        return Err(Error::Conflict(
            "work occurrence already fulfilled or superseded".into(),
        ));
    }
    if matches!(record.fact, Fact::Occurrence(_))
        && !records
            .values()
            .any(|r| r.scope == record.scope && matches!(r.fact, Fact::Override(_)))
    {
        return Err(Error::Invalid(
            "occurrence transition lacks its pending grant".into(),
        ));
    }
    Ok(())
}
