//! A phase's first approval lives alongside the store's other domain records.
use super::{model::*, render};
use cadence::store::{Error, Result};
use serde_json::{Value, json};

pub const NAMESPACE: &str = "context";

pub fn approved(submission: Submission, approval: Approval) -> Result<ApprovedContext> {
    if !approval.approved || approval.submission.as_ref() != Some(&submission)
        || approval.owner.as_ref().is_none_or(|s| s.trim().is_empty())
        || approval.at.as_ref().is_none_or(|s| s.trim().is_empty()) {
        return Err(Error::Invalid("incomplete context approval".into()));
    }
    let truths = submission.truths.iter().map(|slots| Ok(Truth {
        id: slots.id.clone(), phase: submission.phase.get(), version: 1, pattern: "when".into(),
        text: render::sentence(slots)?,
        kind: serde_json::from_value(json!(slots.kind))?, status: Status::Pending,
    })).collect::<Result<Vec<_>>>()?;
    Ok(ApprovedContext { submission, approval, truths })
}

pub fn saved(data: &Value, phase: u32) -> Result<Option<ApprovedContext>> {
    let Some(namespace) = data.get(NAMESPACE) else { return Ok(None); };
    if namespace["schema"] != "context-1" { return Err(Error::Invalid("unsupported context namespace".into())); }
    namespace["phases"].get(phase.to_string()).cloned().map(serde_json::from_value).transpose().map_err(Error::from)
}

pub fn contribute(data: &Value, context: &ApprovedContext) -> Result<Value> {
    if saved(data, context.submission.phase.get())?.is_some() {
        return Err(Error::Conflict("native context already approved; revision is unavailable".into()));
    }
    let mut proposed = data.clone();
    let object = proposed.as_object_mut().ok_or_else(|| Error::Invalid("context needs a snapshot object".into()))?;
    let namespace = object.entry(NAMESPACE).or_insert_with(|| json!({"schema":"context-1","phases":{}}));
    namespace["phases"][context.submission.phase.to_string()] = serde_json::to_value(context)?;
    Ok(proposed)
}

/// Both the initial commit and restart recovery check that the participant is
/// exactly the document derived from this approval, and not another writer.
pub fn validate_publication(previous: &Value, proposed: &Value, phase: u32, bytes: &[u8]) -> Result<()> {
    let context = saved(proposed, phase)?.ok_or_else(|| Error::Invalid("context participant lacks approval".into()))?;
    if context.submission.phase.get() != phase
        || approved(context.submission.clone(), context.approval.clone())? != context
        || render::document(&context).as_bytes() != bytes
        || contribute(previous, &context)? != *proposed {
        return Err(Error::Invalid("context participant differs from approved snapshot".into()));
    }
    Ok(())
}
