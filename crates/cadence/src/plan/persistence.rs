//! Read-only access does not open a store, acquire ownership or recover an intent.
use super::{inventory::Inventory, model::*, render};
use cadence::store::model::digest;
use cadence::store::{Error, Result};
use serde_json::Value;
use serde_json::json;

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

pub fn approve(submission: &Submission, approval: &Approval) -> Result<()> {
    if let Some(refusal) = super::validation::identities(submission) {
        return Err(Error::Invalid(serde_json::to_string(&refusal)?));
    }
    if !approval.approved
        || approval.submission.as_ref() != Some(submission)
        || approval.owner.as_ref().is_none_or(|s| s.trim().is_empty())
        || approval.at.as_ref().is_none_or(|s| s.trim().is_empty())
    {
        return Err(Error::Invalid(
            "exact-submission-approval: owner, time and complete submission required".into(),
        ));
    }
    if submission.request_id.trim().is_empty() || submission.plans.is_empty() {
        return Err(Error::Invalid(
            "publication needs a request identity and plans".into(),
        ));
    }
    Ok(())
}

pub fn payload_digest(submission: &Submission, approval: &Approval) -> Result<String> {
    Ok(digest(&serde_json::to_vec(&(submission, approval))?))
}

/// The durable request receipt precedes inventory, allocation and replacement
/// checks. A retry observes history; it is never a new publication transaction.
pub fn replay(previous: &Value, submission: &Submission, approval: Option<&Approval>) -> Result<Option<Receipt>> {
    let Some(occurrence) = saved(previous, submission.phase.get())? else { return Ok(None) };
    let Some(receipt) = occurrence.receipts.get(&submission.request_id) else { return Ok(None) };
    let digest = approval.map(|a| payload_digest(submission, a)).transpose()?;
    if occurrence.id != submission.occurrence || digest.as_ref() != Some(&receipt.payload_digest) {
        let identities = receipt.results.iter().map(|p| format!("phase {} plan {}", p.identity.phase, p.identity.plan)).collect::<Vec<_>>().join(", ");
        return Err(Error::Conflict(format!("request-id-reuse: request {} in {} is bound to {identities} and its exact approved payload", submission.request_id, occurrence.id)));
    }
    Ok(Some(receipt.clone()))
}

pub fn contribute(
    previous: &Value,
    submission: &Submission,
    approval: &Approval,
    inventory: &Inventory,
) -> Result<(Value, Vec<Publication>)> {
    if let Some(receipt) = replay(previous, submission, Some(approval))? {
        return Ok((previous.clone(), receipt.results));
    }
    approve(submission, approval)?;
    super::validation::replacement(previous, submission, Some(approval), inventory)?;
    validate_candidate(previous, submission, inventory)?;
    let phase = submission.phase.get();
    if cadence::context::persistence::saved(previous, phase)?.is_none() {
        return Err(Error::Invalid(format!(
            "native-approved-truths: phase {phase} needs context-submit"
        )));
    }
    if submission.occurrence != occurrence(previous, phase)? {
        return Err(Error::Conflict(
            "phase occurrence changed; preview and approve again".into(),
        ));
    }
    super::validation::replacement(previous, submission, Some(approval), inventory)?;
    if submission.inventory_basis != inventory.basis {
        return Err(Error::Conflict(
            "inventory precondition changed; preview and approve again".into(),
        ));
    }
    if submission.plans.len() > 64 {
        return Err(Error::Invalid("publication batch exceeds 64 plans".into()));
    }
    let mut occurrence = saved(previous, phase)?.unwrap_or_else(|| Occurrence {
        id: submission.occurrence.clone(),
        phase,
        cycle: "active".into(),
        high_water: inventory.high_water,
        consumed: inventory.occupied.clone(),
        provenance: inventory.provenance.clone(),
        publications: Default::default(),
        receipts: Default::default(),
    });
    if occurrence.receipts.contains_key(&submission.request_id) {
        return Err(Error::Conflict(
            "request identity is already consumed".into(),
        ));
    }
    let mut results = Vec::new();
    let mut high_water = inventory.high_water;
    let mut targets = std::collections::BTreeSet::new();
    for entry in &submission.plans {
        let number = if entry.replacement.is_some() {
            entry.target.plan.get()
        } else {
            high_water = high_water.checked_add(1).ok_or_else(|| Error::Invalid("number-exhaustion".into()))?;
            high_water
        };
        if !targets.insert(number) {
            return Err(Error::Invalid(format!("duplicate publication target: phase {phase} plan {number}")));
        }
        if entry.target.phase.get() != phase || entry.target.plan.get() != number {
            return Err(Error::Conflict(format!(
                "allocation target changed: expected phase {phase} plan {number}, approved {:?}",
                entry.target
            )));
        }
        let bytes = render::document(&entry.content)?;
        cadence::execution::plan::parse_plan(&bytes, phase, number)
            .map_err(|error| Error::Invalid(error.to_string()))?;
        let revision = digest(&bytes);
        let mut history = occurrence.publications.get(&number).map(|p| p.history.clone()).unwrap_or_default();
        history.push(revision.clone());
        let publication = Publication {
            identity: entry.target.clone(),
            occurrence: occurrence.id.clone(),
            revision: revision.clone(),
            content: entry.content.clone(),
            approval: approval.clone(),
            readiness: Readiness::ProvisionalAuthoring,
            history,
            map_revision: if matches!(&entry.content.evidence_map, Some(super::evidence::Map::Attached { .. })) {
                Some(super::map_history::event_id(submission, &entry.target)?)
            } else { None },
        };
        occurrence.publications.insert(number, publication.clone());
        for (number, sources) in &inventory.provenance {
            occurrence.provenance.entry(*number).or_default().extend(sources.iter().cloned());
        }
        occurrence.provenance.entry(number).or_default().insert(format!("publication:{}", submission.request_id));
        occurrence.consumed.extend(&inventory.occupied);
        occurrence.consumed.push(number);
        occurrence.consumed.sort_unstable();
        occurrence.consumed.dedup();
        occurrence.high_water = high_water;
        results.push(publication);
    }
    occurrence.receipts.insert(
        submission.request_id.clone(),
        Receipt {
            payload_digest: payload_digest(submission, approval)?,
            results: results.clone(),
        },
    );
    let mut proposed = previous.clone();
    let object = proposed
        .as_object_mut()
        .ok_or_else(|| Error::Invalid("plan snapshot must be an object".into()))?;
    let namespace = object
        .entry(NAMESPACE)
        .or_insert_with(|| json!({"schema":"plan-1","phases":{}}));
    namespace["phases"][phase.to_string()] = serde_json::to_value(occurrence)?;
    super::map_history::contribute(&mut proposed, submission, approval, &results)?;
    Ok((proposed, results))
}

/// Read-only candidate validation is also required by the committing algebra.
/// It needs no approval and creates neither a session nor a durable reservation.
pub fn validate_candidate(previous: &Value, submission: &Submission, inventory: &Inventory) -> Result<()> {
    if let Some(refusal) = super::validation::identities(submission) {
        return Err(Error::Invalid(serde_json::to_string(&refusal)?));
    }
    let phase = submission.phase.get();
    if cadence::context::persistence::saved(previous, phase)?.is_none() {
        return Err(Diagnostic { rule: "native-approved-truths".into(), slot: "submission.phase".into(),
            phase: Some(phase), entry: None, id: None,
            reason: format!("phase {phase} current native truth authority is absent; use context-submit") }.error());
    }
    if submission.occurrence != occurrence(previous, phase)? {
        return Err(Error::Conflict("phase occurrence changed; preview and approve again".into()));
    }
    if submission.inventory_basis != inventory.basis {
        return Err(Error::Conflict("inventory precondition changed; preview and approve again".into()));
    }
    if submission.plans.is_empty() || submission.plans.len() > 64 || submission.request_id.trim().is_empty() {
        return Err(Error::Invalid("publication needs a request identity and 1 through 64 plans".into()));
    }
    let mut high_water = inventory.high_water;
    let mut targets = std::collections::BTreeSet::new();
    for entry in &submission.plans {
        if entry.content.evidence_map.is_none() {
            return Err(Error::Invalid("evidence-map-mode: new mapless authoring must explicitly choose provisional mode".into()));
        }
        let number = if entry.replacement.is_some() { entry.target.plan.get() } else {
            high_water = high_water.checked_add(1).ok_or_else(|| Error::Invalid("number-exhaustion".into()))?;
            high_water
        };
        if !targets.insert(number) { return Err(Error::Invalid("duplicate publication target".into())); }
        if entry.target.plan.get() != number {
            return Err(Error::Conflict(format!("allocation target changed: expected phase {phase} plan {number}")));
        }
        render::document(&entry.content)?;
    }
    Ok(())
}

/// The expected-old participant is authority-bearing too. Recovery may see the
/// installed new projection, but the intent must still retain the exact old one.
pub fn validate_old_document(previous: &Value, phase: u32, plan: u32, bytes: Option<&[u8]>) -> Result<()> {
    let old = saved(previous, phase)?;
    let expected = old.as_ref().and_then(|o| o.publications.get(&plan))
        .map(|p| render::document(&p.content)).transpose()?;
    if expected.as_deref() != bytes {
        return Err(Error::Conflict(format!("stale-target: phase {phase} plan {plan} expected old publication bytes changed")));
    }
    Ok(())
}

/// Validate the complete namespace delta against its exact approval and the
/// approved inventory. Both initial commit and crash recovery use this algebra.
pub fn validate_publication(
    previous: &Value,
    proposed: &Value,
    phase: u32,
    inventory: &Inventory,
    documents: &[(u32, Vec<u8>)],
) -> Result<()> {
    let old = saved(previous, phase)?;
    let new =
        saved(proposed, phase)?.ok_or_else(|| Error::Invalid("missing plan occurrence".into()))?;
    let receipts: Vec<_> = new
        .receipts
        .iter()
        .filter(|(id, _)| old.as_ref().is_none_or(|o| !o.receipts.contains_key(*id)))
        .collect();
    if receipts.len() != 1 {
        return Err(Error::Invalid(
            "publication needs one allocation receipt".into(),
        ));
    }
    let (_, receipt) = receipts[0];
    let first = receipt
        .results
        .first()
        .ok_or_else(|| Error::Invalid("empty publication receipt".into()))?;
    let approval = &first.approval;
    let submission = approval
        .submission
        .as_ref()
        .ok_or_else(|| Error::Invalid("missing exact plan approval".into()))?;
    let (expected, results) = contribute(previous, submission, approval, inventory)?;
    let expected_documents = results
        .iter()
        .map(|p| Ok((p.identity.plan.get(), render::document(&p.content)?)))
        .collect::<Result<Vec<_>>>()?;
    if expected != *proposed
        || results != receipt.results
        || expected_documents != documents
        || submission.phase.get() != phase
    {
        return Err(Error::Invalid(
            "plan participants differ from approved allocation and snapshot".into(),
        ));
    }
    Ok(())
}
