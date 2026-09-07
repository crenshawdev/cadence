//! Native routing facts. Pure validation and projection; no ambient observation.
pub mod checkpoint;
pub mod persistence;

use crate::store::{Error, Result};
use serde::{Deserialize, Serialize};

pub const VERSION: u32 = 1;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Scope {
    pub project: String,
    pub planning_root: String,
    pub cycle: String,
    pub occurrence: String,
    pub phase: String,
    pub plan: String,
    pub report: String,
}

impl Scope {
    pub fn validate(&self) -> Result<()> {
        for (name, value) in [
            ("project", &self.project),
            ("planning_root", &self.planning_root),
            ("cycle", &self.cycle),
            ("occurrence", &self.occurrence),
            ("phase", &self.phase),
            ("plan", &self.plan),
            ("report", &self.report),
        ] {
            nonblank(name, value)?;
        }
        Ok(())
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub enum Fact {
    Checkpoint(checkpoint::Checkpoint),
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Record {
    pub version: u32,
    pub scope: Scope,
    pub fact: Fact,
}

impl Record {
    pub fn validate(&self) -> Result<()> {
        if self.version != VERSION {
            return Err(Error::Invalid("unsupported native evidence version".into()));
        }
        self.scope.validate()?;
        match &self.fact {
            Fact::Checkpoint(value) => value.validate(),
        }
    }
    pub fn key(&self) -> Result<String> {
        let (kind, id) = match &self.fact {
            Fact::Checkpoint(value) => ("checkpoint", &value.id),
        };
        Ok(crate::store::model::digest(&serde_json::to_vec(&(
            &self.scope,
            kind,
            id,
        ))?))
    }
}

pub(crate) fn nonblank(name: &str, value: &str) -> Result<()> {
    if value.trim().is_empty() {
        Err(Error::Invalid(format!("missing {name}")))
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests;
