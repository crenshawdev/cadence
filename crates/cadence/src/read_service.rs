//! Resident-facing transport for the read domain; no MCP types enter the domain.
use cadence::process::Process;
use cadence::read::{Query, ReadDomain};
use serde_json::Value;

use cadence::envelope::Refusal;
use std::{collections::BTreeMap, path::{Path, PathBuf}};

pub fn execute(
    domains: &mut BTreeMap<PathBuf, ReadDomain>,
    planning_root: &Path,
    query: Query,
    process: &mut dyn Process,
) -> Value {
    let root = planning_root.to_path_buf();
    let domain = domains.entry(root.clone()).or_insert_with(|| {
        ReadDomain::new(&root).expect("startup-bound planning root has a canonical project")
    });
    domain.query(query, process)
}

pub fn unavailable(reason: impl Into<String>) -> Value {
    // D-145: the read layer serves the startup-bound project.
    Refusal::new("read-unavailable", reason).rule("bound-project").slot("project").value()
}
