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
