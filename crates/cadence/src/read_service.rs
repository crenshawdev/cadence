//! Resident-facing transport for the read domain; no MCP types enter the domain.
use cadence::read::{Query, ReadDomain};
use serde_json::{Value, json};
use std::{collections::BTreeMap, path::{Path, PathBuf}};

pub fn execute(domains: &mut BTreeMap<PathBuf, ReadDomain>, planning_root: &Path, query: Query) -> Value {
    let root = planning_root.to_path_buf();
    let domain = domains.entry(root.clone()).or_insert_with(|| {
        ReadDomain::new(&root).expect("startup-bound planning root has a canonical project")
    });
    domain.query(query)
}

pub fn unavailable(reason: impl Into<String>) -> Value {
    json!({"status":"refused","code":"read-unavailable","rule":"D-145","slot":"project","reason":reason.into()})
}
