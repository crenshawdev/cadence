//! Pure inventories preserve supplied evidence addresses without authorizing land.
use super::model::{DeferredMember, Gate};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InventoryEntry {
    pub fire: String,
    pub round: u64,
    pub trigger: Option<String>,
    pub gate: Option<Gate>,
    pub review_rendering: Option<String>,
    pub adjudication_rendering: Option<String>,
    /// Supplied adjudicated entry identity, not inferred from sibling existence.
    pub adjudication: Option<String>,
    pub deferred: Option<DeferredMember>,
}
#[derive(Debug, Serialize)]
pub struct LandingInventory {
    pub unruled: Vec<String>,
    pub adjudicated: Vec<String>,
}

pub fn landing_inventory(entries: &[InventoryEntry]) -> LandingInventory {
    let mut result = LandingInventory {
        unruled: vec![],
        adjudicated: vec![],
    };
    for entry in entries
        .iter()
        .filter(|entry| entry.trigger.as_deref() == Some("risk_surface"))
    {
        let identity = format!("{}/{}", entry.fire, entry.round);
        if entry.adjudication.is_some() {
            result.adjudicated.push(identity);
        } else {
            result.unruled.push(identity);
        }
    }
    result
}

pub fn milestone_review_inputs(entries: &[InventoryEntry]) -> Vec<String> {
    entries
        .iter()
        .filter(|entry| entry.trigger.as_deref() == Some("risk_surface"))
        .flat_map(|entry| [&entry.review_rendering, &entry.adjudication_rendering])
        .filter_map(Clone::clone)
        .collect()
}

pub fn deferred_members(entries: &[InventoryEntry]) -> Vec<DeferredMember> {
    entries
        .iter()
        .filter_map(|entry| entry.deferred.clone())
        .collect()
}
