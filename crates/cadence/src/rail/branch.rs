//! Protected-branch permission, independent of branch workflow.
use crate::store::{Error, Result};
use serde_json::Value;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Permission {
    Pass,
    Ask,
    Deny,
}

pub fn protected_branches(value: Option<&Value>) -> Vec<String> {
    let defaults = || vec!["main".into(), "master".into()];
    match value {
        Some(Value::String(name)) if !name.trim().is_empty() => vec![name.clone()],
        Some(Value::Array(names)) if names.is_empty() => vec![],
        Some(Value::Array(names)) => {
            let names: Vec<_> = names
                .iter()
                .filter_map(Value::as_str)
                .filter(|name| !name.trim().is_empty())
                .map(str::to_owned)
                .collect();
            if names.is_empty() { defaults() } else { names }
        }
        _ => defaults(),
    }
}

pub fn permission(protected: &[String], on_protected: &str, branch: &str) -> Result<Permission> {
    if !protected.iter().any(|name| name == branch) {
        return Ok(Permission::Pass);
    }
    match on_protected {
        "allow" => Ok(Permission::Pass),
        "ask" => Ok(Permission::Ask),
        "refuse" | "deny" => Ok(Permission::Deny),
        _ => Err(Error::Policy("invalid protected-branch policy".into())),
    }
}
