//! Identity disagreements remain visible; approval never authorizes retargeting.
use super::model::{Answer, Submission, refused};

/// Replacement consent is separate from initial approval and is checked before
/// acquiring a writer, then again against its owned inventory at commit/recovery.
pub fn replacement(
    data: &serde_json::Value,
    submission: &Submission,
    approval: Option<&super::model::Approval>,
    inventory: &super::inventory::Inventory,
) -> cadence::store::Result<()> {
    replacement_inner(data, submission, approval, inventory, false)
}

pub fn replacement_preview(
    data: &serde_json::Value,
    submission: &Submission,
    inventory: &super::inventory::Inventory,
) -> cadence::store::Result<()> {
    replacement_inner(data, submission, None, inventory, true)
}

fn replacement_inner(
    data: &serde_json::Value,
    submission: &Submission,
    approval: Option<&super::model::Approval>,
    inventory: &super::inventory::Inventory,
    preview: bool,
) -> cadence::store::Result<()> {
    use cadence::store::Error;
    // A stale allocation proposal remains an allocation conflict, not a request
    // to replace the concurrent winner.
    if (submission.inventory_basis != inventory.basis || inventory.high_water == u32::MAX)
        && submission.plans.iter().all(|p| p.replacement.is_none())
    {
        return Ok(());
    }
    let phase = submission.phase.get();
    let saved = super::persistence::saved(data, phase)?;
    for entry in &submission.plans {
        let number = entry.target.plan.get();
        if !inventory.occupied.contains(&number) && entry.replacement.is_none() {
            continue;
        }
        let identity = format!("phase {phase} plan {number}");
        let authorized = entry.replacement.as_ref().filter(|a| {
            a.target == entry.target && a.content == entry.content
                && (preview || (a.approved
                    && a.owner.as_ref().is_some_and(|s| !s.trim().is_empty())
                    && a.at.as_ref().is_some_and(|s| !s.trim().is_empty())))
        });
        let initial = approval.is_some_and(|a| super::persistence::approve(submission, a).is_ok());
        let Some(authorized) = authorized.filter(|_| preview || initial) else {
            return Err(Error::Invalid(format!("replacement-authorization: {identity} needs exact identified owner approval of target, old revision/bytes and new content")));
        };
        if admitted(data, phase, number)? {
            return Err(Error::Conflict(format!("admitted-plan: {identity} was admitted to execution; publish additional work at a new approved gap identity")));
        }
        let Some(old) = saved.as_ref().and_then(|o| o.publications.get(&number)) else {
            return Err(Error::Conflict(format!("legacy-read-only: {identity} has no eligible native publication; legacy inputs and consumed aliases require a new gap identity")));
        };
        let bytes = super::render::document(&old.content)?;
        let path = format!("phases/{phase}/PLAN-{number}.md");
        if authorized.old_revision != old.revision
            || authorized.old_document.as_bytes() != bytes
            || inventory.documents.get(&path).map(String::as_bytes) != Some(bytes.as_slice())
        {
            return Err(Error::Conflict(format!("stale-target: {identity} old revision or bytes changed; read the target and obtain fresh approval")));
        }
    }
    Ok(())
}

pub fn admitted(data: &serde_json::Value, phase: u32, plan: u32) -> cadence::store::Result<bool> {
    let Some(execution) = data.get("execution") else { return Ok(false) };
    let execution: cadence::execution::model::ExecutionSnapshot = serde_json::from_value(execution.clone())?;
    Ok(execution.occurrences.values().filter(|o| o.phase == phase).any(|o| {
        o.active.as_ref().is_some_and(|a| a.plan == plan)
            || o.plans.iter().any(|p| p.plan == plan)
            || o.receipts.values().any(|r| r.outcome.plan == plan)
    }))
}

pub fn arguments(raw: &serde_json::Value) -> Option<Answer> {
    // Inspect only destination-bearing contract positions, never authored body
    // text or the plan's source lease. These are forbidden fields, not an API.
    let mut objects = vec![raw, &raw["submission"]];
    if let Some(plans) = raw["submission"]["plans"].as_array() {
        for plan in plans {
            objects.extend([plan, &plan["target"]]);
        }
    }
    for object in objects {
        for field in ["destination", "path", "target_path", "project_root", "root"] {
            if let Some(value) = object.get(field) {
                return Some(refused(
                    "path-confinement",
                    format!(
                        "forbidden {field} {value}; publication derives its canonical PLAN path from the bound phase and plan number"
                    ),
                ));
            }
        }
    }
    None
}

pub fn identities(submission: &Submission) -> Option<Answer> {
    for entry in &submission.plans {
        if entry.content.phase != entry.target.phase
            || entry.content.plan != entry.target.plan
            || entry.target.phase != submission.phase
        {
            return Some(refused(
                "identity-mismatch",
                format!(
                    "submitted phase {} plan {}, target phase {} plan {}, bound phase {}",
                    entry.content.phase,
                    entry.content.plan,
                    entry.target.phase,
                    entry.target.plan,
                    submission.phase
                ),
            ));
        }
    }
    None
}
