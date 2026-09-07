//! Pause captures work separately from the durable evidence and Git mutations.
pub mod branch;
pub mod git;
pub mod risk;
pub mod risk_diff;

use crate::{
    derivation::ValidatedIntake,
    evidence::Scope,
    store::{Error, Result},
};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeSet,
    path::{Component, Path, PathBuf},
};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Phase {
    pub identity: String,
    pub name: String,
    pub total: u64,
    pub provenance: String,
}

#[derive(Clone, Debug)]
pub struct Input {
    pub scope: Scope,
    pub phase: Option<Phase>,
    pub sentence: Option<String>,
    /// Repository-relative file paths explicitly authorized by the caller.
    pub authorized: BTreeSet<PathBuf>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Capture {
    pub scope: Scope,
    pub phase: Phase,
    pub sentence: String,
    pub authorized: BTreeSet<PathBuf>,
    pub observed: git::Observation,
    pub risk: Option<risk::Outcome>,
    pub wip: Option<String>,
}

pub fn capture(input: Input, retained: Option<&ValidatedIntake>) -> Result<Capture> {
    let phase = input
        .phase
        .or_else(|| {
            let prior = retained?.cursor().provenance();
            let normalized =
                crate::derivation::normalize_imported_cursor(&prior.original_cursor).ok()?;
            if matches!(
                normalized,
                crate::derivation::CompatibilityCursor::Unavailable(_)
            ) {
                return None;
            }
            Some(Phase {
                identity: prior.phase?.address(),
                name: prior.name.clone()?,
                total: prior.total?,
                provenance: serde_json::to_string(prior).ok()?,
            })
        })
        .ok_or_else(|| Error::Invalid("missing pause phase and name/total provenance".into()))?;
    for value in [&phase.identity, &phase.name, &phase.provenance] {
        if value.trim().is_empty() {
            return Err(Error::Invalid("missing pause phase provenance".into()));
        }
    }
    let sentence = input
        .sentence
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| Error::Invalid("missing pause note".into()))?;
    if sentence.contains(['\r', '\n']) {
        return Err(Error::Invalid("pause requires one exact line".into()));
    }
    let mut scope = input.scope;
    if scope.phase.is_empty() {
        scope.phase.clone_from(&phase.identity);
    }
    scope.validate()?;
    if scope.phase != phase.identity {
        return Err(Error::Invalid(
            "pause phase differs from occurrence scope".into(),
        ));
    }
    let project = Path::new(&scope.project);
    let planning = Path::new(&scope.planning_root);
    if !project.is_absolute() || planning.parent() != Some(project) {
        return Err(Error::Invalid(
            "pause requires an absolute repository and planning root".into(),
        ));
    }
    for path in &input.authorized {
        validate_path(path)?;
    }
    let observed = git::observe(project)?;
    Ok(Capture {
        scope,
        phase,
        sentence,
        authorized: input.authorized,
        observed,
        risk: None,
        wip: None,
    })
}

pub(crate) fn validate_path(path: &Path) -> Result<()> {
    if path.as_os_str().is_empty()
        || path
            .components()
            .any(|c| !matches!(c, Component::Normal(name) if name != ".git"))
    {
        return Err(Error::Invalid(format!(
            "invalid authorized file path: {path:?}"
        )));
    }
    Ok(())
}

impl Capture {
    pub fn unrelated(&self) -> BTreeSet<PathBuf> {
        self.observed
            .changes
            .iter()
            .flat_map(|c| std::iter::once(c.path.clone()).chain(c.original.clone()))
            .filter(|path| !self.authorized.contains(path))
            .collect()
    }
    pub fn originally_clean(&self) -> bool {
        self.observed.changes.is_empty()
    }
}

#[cfg(test)]
mod tests;
