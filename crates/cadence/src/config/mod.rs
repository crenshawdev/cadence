//! Two persisted layers; defaults and migration evidence are never a layer.
pub mod merge;
pub mod reload;
pub mod roles;
pub mod write;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::sync::OnceLock;

pub const RETIRED: [&str; 8] = [
    "parallelization.enabled",
    "parallelization.max_concurrent_agents",
    "parallelization.min_plans_for_parallel",
    "parallelization.use_worktrees",
    "review.triggers.phase_diff.gate",
    "review.triggers.phase_diff.tier",
    "review.triggers.phase_diff.effort",
    "git.auto_close",
];
pub const GLOBAL_ONLY: [&str; 3] = [
    "workflow.test_command",
    "workflow.lint_command",
    "review.key_file",
];

pub fn schema() -> &'static BTreeMap<String, Value> {
    static SCHEMA: OnceLock<BTreeMap<String, Value>> = OnceLock::new();
    SCHEMA
        .get_or_init(|| serde_json::from_str(include_str!("schema.json")).expect("embedded schema"))
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Layer {
    Global,
    Repo,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct Diagnostic {
    pub layer: Layer,
    pub key: String,
    pub reason: String,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct Diagnostics {
    pub scope: Vec<Diagnostic>,
    pub invalid_layer: Vec<Diagnostic>,
    pub migration: Vec<Diagnostic>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct Effective {
    pub raw_global: Option<Value>,
    pub raw_repo: Option<Value>,
    pub global: Value,
    pub repo: Value,
    pub values: Value,
    pub sources: BTreeMap<String, Layer>,
    pub global_intent: bool,
    pub diagnostics: Diagnostics,
}

#[derive(Debug, PartialEq)]
pub struct CaptureReport {
    pub active: usize,
    pub bound: u64,
    pub exceeded: bool,
    pub unit: &'static str,
}

/// A report cannot veto a capture. Revisions and continuation lines are not units.
pub fn capture_report(records: &[cadence::store::model::ItemRecord], bound: u64) -> CaptureReport {
    use cadence::store::model::Disposition;
    let latest: BTreeMap<_, _> = records.iter().map(|r| (&r.id, r)).collect();
    let active = latest
        .values()
        .filter(|r| !r.completed && matches!(r.disposition, Disposition::Captured))
        .count();
    CaptureReport {
        active,
        bound,
        exceeded: active as u64 > bound,
        unit: "items",
    }
}

#[cfg(test)]
mod tests;

pub(crate) fn planning_policy(
    context: &cadence::store::MutationContext<'_>,
    _: &reload::Generation,
) -> cadence::store::Result<()> {
    cadence::store::Policy::validate(&mut cadence::store::writer::PlanningPolicy, context)
}
