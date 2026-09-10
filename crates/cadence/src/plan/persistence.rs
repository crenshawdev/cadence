//! Read-only access does not open a store, acquire ownership or recover an intent.
use super::model::Occurrence;
use cadence::store::{Error, Result};
use serde_json::Value;

pub const NAMESPACE: &str = "plan_publications";
pub use cadence::context::persistence::read_snapshot;

pub fn saved(data: &Value, phase: u32) -> Result<Option<Occurrence>> {
    let Some(namespace) = data.get(NAMESPACE) else {
        return Ok(None);
    };
    if namespace["schema"] != "plan-1" {
        return Err(Error::Invalid(
            "unsupported plan publication namespace".into(),
        ));
    }
    namespace["phases"]
        .get(phase.to_string())
        .cloned()
        .map(serde_json::from_value)
        .transpose()
        .map_err(Error::from)
}

/// This lifetime is explicitly limited to the active planning cycle. A closed
/// cycle cannot silently reset the retained occurrence or consumed numbers.
pub fn occurrence(data: &Value, phase: u32) -> Result<String> {
    if let Some(saved) = saved(data, phase)? {
        return Ok(saved.id);
    }
    Ok(format!("active-cycle:phase:{phase}"))
}

/// Publication ownership is an identity property, independent of mutable file
/// bytes and execution fingerprints. Until activation lands, a retained native
/// member cannot be admitted as legacy by deleting or changing its projection.
pub fn require_execution_ready(data: &Value, phase: u32) -> Result<()> {
    if let Some(occurrence) = saved(data, phase)?
        && let Some(publication) = occurrence.publications.values().next()
    {
        return Err(Error::Conflict(format!(
            "provisional-authoring: phase {} plan {} in occurrence {} is authoring-only; execution requires phases 28, 29 and 12",
            publication.identity.phase, publication.identity.plan, occurrence.id
        )));
    }
    Ok(())
}
