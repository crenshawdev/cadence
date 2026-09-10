//! One explicit closing owner per canonical check revision across the set.
use super::{admission::refuse, model::ExecutionPlan};
use crate::{plan::{evidence::Item, map_history::Revision}, store::Result};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Check {
    pub id: String,
    pub item_revision: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Assignment {
    pub plan: u32,
    pub task: String,
    pub checks: Vec<Check>,
}

pub fn validate(phase: u32, plans: &[ExecutionPlan], maps: &[Revision], assignments: &[Assignment]) -> Result<()> {
    let tasks: BTreeSet<_> = plans.iter().flat_map(|p| p.tasks.iter().map(move |t| (p.plan, t.id.as_str()))).collect();
    let mut items = BTreeMap::new();
    for map in maps {
        for item in &map.items {
            items.insert(item.id(), (item, &map.item_revisions[item.id()]));
        }
    }
    let mut assigned = BTreeSet::new();
    let mut owners = BTreeSet::new();
    for (index, assignment) in assignments.iter().enumerate() {
        let slot = format!("contract.allocation[{index}]");
        let key = (assignment.plan, assignment.task.as_str());
        if !tasks.contains(&key) || !assigned.insert(key) {
            return Err(refuse(phase, "allocation-task", &slot, &assignment.task,
                format!("plan {} task {} is unknown or assigned twice", assignment.plan, assignment.task)));
        }
        for (n, check) in assignment.checks.iter().enumerate() {
            let slot = format!("{slot}.checks[{n}]");
            let Some((item, revision)) = items.get(check.id.as_str()) else {
                return Err(refuse(phase, "allocation-item", &format!("{slot}.id"), &check.id, "unknown check item"));
            };
            if !matches!(item, Item::Check { .. }) {
                return Err(refuse(phase, "allocation-kind", &format!("{slot}.id"), &check.id, "artifact, link or observation cannot own a check receipt"));
            }
            if **revision != check.item_revision {
                return Err(refuse(phase, "allocation-revision", &format!("{slot}.item_revision"), &check.id, "stale check revision"));
            }
            if !owners.insert(check.id.as_str()) {
                return Err(refuse(phase, "allocation-owner", &slot, &check.id, "canonical check revision has two owners, including shared aliases"));
            }
        }
    }
    if let Some((plan, task)) = tasks.difference(&assigned).next() {
        return Err(refuse(phase, "allocation-task", "contract.allocation", task,
            format!("plan {plan} task {task} needs an explicit assignment, possibly empty")));
    }
    for (id, (item, _)) in items {
        if matches!(item, Item::Check { .. }) && !owners.contains(id) {
            return Err(refuse(phase, "allocation-check", "contract.allocation", id, "current check has no closing owner"));
        }
    }
    Ok(())
}
