//! A phase's first approval lives alongside the store's other domain records.
use super::{model::*, render};
use cadence::store::{Error, Result, model::digest};
use serde_json::{Value, json};

pub const NAMESPACE: &str = "context";

/// The digest a draft answer reports and an approval may carry instead of
/// the copy: the exact typed submission, serialized once by the binary.
pub fn submission_digest(submission: &Submission) -> Result<String> {
    Ok(digest(&serde_json::to_vec(submission)?))
}

/// True when the approval binds this exact submission, by copy or by digest.
pub fn binds(submission: &Submission, approval: &Approval) -> Result<bool> {
    Ok(approval.submission.as_ref() == Some(submission)
        || approval.submission_digest.as_deref() == Some(submission_digest(submission)?.as_str()))
}

/// The approval as it is recorded: the copy filled and the wire digest
/// dropped, so digest- and copy-bound contexts read back identically.
pub fn bound(submission: &Submission, approval: Approval) -> Result<Approval> {
    if !binds(submission, &approval)? {
        return Ok(approval);
    }
    Ok(Approval {
        submission: Some(submission.clone()),
        submission_digest: None,
        ..approval
    })
}

fn truths(submission: &Submission) -> Result<Vec<Truth>> {
    submission
        .truths
        .iter()
        .map(|slots| {
            Ok(Truth {
                id: slots.id.clone(),
                phase: submission.phase.get(),
                version: 1,
                pattern: "when".into(),
                text: render::sentence(slots)?,
                kind: serde_json::from_value(json!(slots.kind))?,
                status: Status::Pending,
            })
        })
        .collect()
}

/// Render the candidate bytes without manufacturing an approval record.
pub fn rendered(submission: &Submission) -> Result<String> {
    Ok(render::document(&ApprovedContext {
        submission: submission.clone(),
        approval: Approval {
            approved: false,
            owner: None,
            at: None,
            submission: None,
            submission_digest: None,
        },
        truths: truths(submission)?,
    }))
}

pub fn approved(submission: Submission, approval: Approval) -> Result<ApprovedContext> {
    if !approval.approved
        || approval.submission.as_ref() != Some(&submission)
        || approval.owner.as_ref().is_none_or(|s| s.trim().is_empty())
        || approval.at.as_ref().is_none_or(|s| s.trim().is_empty())
    {
        return Err(Error::Invalid("incomplete context approval".into()));
    }
    let truths = truths(&submission)?;
    Ok(ApprovedContext {
        submission,
        approval,
        truths,
    })
}

pub fn saved(data: &Value, phase: u32) -> Result<Option<ApprovedContext>> {
    let Some(namespace) = data.get(NAMESPACE) else {
        return Ok(None);
    };
    if namespace["schema"] != "context-1" {
        return Err(Error::Invalid("unsupported context namespace".into()));
    }
    namespace["phases"]
        .get(phase.to_string())
        .cloned()
        .map(serde_json::from_value)
        .transpose()
        .map_err(Error::from)
}

pub fn contribute(data: &Value, context: &ApprovedContext) -> Result<Value> {
    if let Some(refusal) = super::validation::identities(
        &context.submission,
        saved(data, context.submission.phase.get())?.as_ref(),
    ) {
        return Err(Error::Conflict(serde_json::to_string(&refusal)?));
    }
    if saved(data, context.submission.phase.get())?.is_some() {
        return Err(Error::Conflict(
            "native context already approved; revision is unavailable".into(),
        ));
    }
    let mut proposed = data.clone();
    let object = proposed
        .as_object_mut()
        .ok_or_else(|| Error::Invalid("context needs a snapshot object".into()))?;
    let namespace = object
        .entry(NAMESPACE)
        .or_insert_with(|| json!({"schema":"context-1","phases":{}}));
    namespace["phases"][context.submission.phase.to_string()] = serde_json::to_value(context)?;
    Ok(proposed)
}

/// Both the initial commit and restart recovery check that the participant is
/// exactly the document derived from this approval, and not another writer.
pub fn validate_publication(
    previous: &Value,
    proposed: &Value,
    phase: u32,
    bytes: &[u8],
) -> Result<()> {
    let context = saved(proposed, phase)?
        .ok_or_else(|| Error::Invalid("context participant lacks approval".into()))?;
    if let Some(refusal) = super::validation::validate(&json!({"submission":context.submission})) {
        return Err(Error::Invalid(serde_json::to_string(&refusal)?));
    }
    if context.submission.phase.get() != phase
        || approved(context.submission.clone(), context.approval.clone())? != context
        || render::document(&context).as_bytes() != bytes
        || contribute(previous, &context)? != *proposed
    {
        return Err(Error::Invalid(
            "context participant differs from approved snapshot".into(),
        ));
    }
    Ok(())
}

pub fn operation_id(context: &ApprovedContext) -> Result<String> {
    Ok(format!(
        "context:{}",
        cadence::store::model::digest(&serde_json::to_vec(context)?)
    ))
}

/// Read a verified shared snapshot without acquiring ownership or recovering.
pub fn read_snapshot(root: &std::path::Path) -> Result<Option<cadence::store::cache::SharedSnapshot>> {
    cadence::store::cache::read(root)
}

#[cfg(test)]
thread_local! { pub(crate) static READ_PARSES: std::cell::Cell<usize> = const { std::cell::Cell::new(0) }; }
