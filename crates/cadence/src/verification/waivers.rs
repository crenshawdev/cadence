//! Owner-only exact-approved truth waivers, retained beside derived judgments.
//!
//! A waiver is an owner event bound to one truth version and the reviewed
//! evidence: the current attempt's complete patch on the current basis. The
//! model may prepare the payload; only the owner's exact approval makes it
//! effective. Reaffirmation, supersession and revocation are further events
//! naming the retained record, never edits. A waived truth is reported as
//! waived beside the met ones, with its derived status and rejected evidence
//! kept visible, and it never raises the met count.
use super::{inputs, model::{Basis, Waiver}, persistence, status, verdicts};
use crate::{execution::receipts::OwnerApproval, store::{Error, Result, model::{digest, DecisionRecord, Decision, Origin, Evidence}}};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{collections::BTreeMap, path::{Path, PathBuf}};

pub const SCHEMA: &str = "verification-waiver-1";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Kind { Waive, Reaffirm, Revoke }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub request_id: String,
    pub submission: Waiver,
    pub approval: OwnerApproval<Waiver>,
}

/// The immutable retained event.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Record {
    pub schema: String,
    pub id: String,
    pub request_id: String,
    pub root_binding: String,
    pub kind: Kind,
    pub submission: Waiver,
    pub approval: OwnerApproval<Waiver>,
    /// The truth row the owner reviewed: attempt, patch, derived status and items.
    pub reviewed: Value,
}

/// What the resident observed when the request arrived; the writer recomputes
/// it on the committing snapshot and refuses a differing claim.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Claim {
    pub schema: String,
    pub root: PathBuf,
    pub root_binding: String,
    pub request: Request,
    pub payload_digest: String,
    pub authority_digest: String,
    pub observed: Option<Basis>,
    pub documents: BTreeMap<String, String>,
    pub unavailable: Option<Value>,
    pub answer: Value,
}

pub fn records(data: &Value) -> Result<Vec<Record>> {
    persistence::attempt_values(data)?;
    Ok(data[persistence::NAMESPACE].get("waivers").cloned().map(serde_json::from_value).transpose()?.unwrap_or_default())
}

pub fn payload_digest(request: &Request) -> Result<String> {
    Ok(digest(&serde_json::to_vec(request)?))
}

pub fn replay(data: &Value, request: &Request) -> Result<Option<Value>> {
    let Some(prior) = records(data)?.into_iter().find(|r| r.request_id == request.request_id) else { return Ok(None) };
    let same = prior.submission == request.submission && prior.approval == request.approval;
    Ok(Some(if same { json!({"status":"ok","receipt":{"schema":SCHEMA,"record":prior}}) } else {
        verdicts::refusal("verification-waiver-reuse", "request_id", &request.request_id,
            "request already names a different waiver payload", json!(payload_digest(request)?), json!(prior.id))
    }))
}

pub fn prepare(root: &Path, data: &Value, request: Request) -> Result<Claim> {
    let phase = request.submission.basis.phase;
    let mut claim = Claim { schema: SCHEMA.into(), root: root.into(), root_binding: inputs::root_binding(root)?,
        payload_digest: payload_digest(&request)?, authority_digest: inputs::authority_digest(data)?, request,
        observed: None, documents: BTreeMap::new(), unavailable: None, answer: Value::Null };
    let observation = (|| -> Result<()> {
        let observed = inputs::observe(root, data, phase)?;
        claim.documents = crate::plan::inventory::read(root, &phase.to_string(), data)?.documents;
        claim.observed = Some(observed.basis);
        Ok(())
    })();
    if let Err(error) = observation { claim.unavailable = Some(verdicts::error_answer(error)); }
    claim.answer = assess(data, &claim)?;
    Ok(claim)
}

/// The latest record for a truth that no later event superseded or revoked.
fn active<'a>(history: &'a [Record], truth: &str) -> Option<&'a Record> {
    history.iter().rfind(|r| r.kind != Kind::Revoke && r.submission.truth.id == truth
        && !history.iter().any(|later| later.submission.supersedes.as_deref() == Some(&r.id)))
}

fn blank(text: &str) -> bool { text.trim().is_empty() || text.len() > 4096 }

fn assess(data: &Value, claim: &Claim) -> Result<Value> {
    let request = &claim.request;
    let submission = &request.submission;
    let approval = &request.approval;
    let denied = |rule: &str, slot: &str, reason: &str, requested: Value, current: Value| {
        Ok(verdicts::refusal(rule, slot, &submission.truth.id, reason, requested, current))
    };
    if request.request_id.trim().is_empty() || request.request_id.len() > 256 {
        return denied("verification-request", "request_id", "bounded nonblank request identity required", json!(request.request_id.len()), json!(256));
    }
    if !approval.approved {
        return denied("verification-approval", "approval.approved", "an owner waiver needs the owner's affirmative approval", json!(approval.approved), json!(true));
    }
    if blank(&approval.owner) {
        return denied("verification-approval", "approval.owner", "approval needs a nonblank owner name", json!(approval.owner), Value::Null);
    }
    if blank(&approval.at) {
        return denied("verification-approval", "approval.at", "approval needs a nonblank reported time", json!(approval.at), Value::Null);
    }
    if approval.submission != *submission {
        return denied("verification-approval", "approval.submission", "approval must echo the exact submission the owner saw",
            json!(digest(&serde_json::to_vec(&approval.submission)?)), json!(digest(&serde_json::to_vec(submission)?)));
    }
    for (slot, value) in [("submission.reason", &submission.reason), ("submission.owner", &submission.owner), ("submission.at", &submission.at)] {
        if blank(value) {
            return denied("verification-waiver", slot, "a waiver carries a nonblank reason, name and date", json!(value), Value::Null);
        }
    }
    let Some(observed) = &claim.observed else {
        return Ok(claim.unavailable.clone().unwrap_or_else(|| verdicts::refusal("verification-inputs", "basis", "", "current verification authority unavailable", Value::Null, Value::Null)));
    };
    let differs = status::differs(&submission.basis, observed)?;
    if let Some(field) = differs.first() {
        let (requested, current) = (serde_json::to_value(&submission.basis)?, serde_json::to_value(observed)?);
        let name = field.trim_start_matches("basis.");
        return denied("verification-basis", field, "waiver basis differs from the current verification basis", requested[name].clone(), current[name].clone());
    }
    let attempts = persistence::attempts(data)?;
    let patches = verdicts::patches(data)?;
    let Some((attempt, patch)) = attempts.iter().rev().filter(|a| a.inputs.basis == *observed)
        .find_map(|a| patches.iter().find(|p| p.attempt == a.id).map(|p| (a, p))) else {
        return denied("verification-attempt", "basis", "no complete verification on the current basis; a waiver is bound to reviewed evidence", Value::Null, json!(observed.source.head));
    };
    let rows = status::rows(attempt, patch)?;
    let Some(row) = rows.iter().find(|r| r.id == submission.truth.id && r.version == submission.truth.version) else {
        return denied("verification-truth", "submission.truth", "truth version is not in the current verification basis",
            json!(submission.truth), json!(observed.truths));
    };
    if row.status == status::Status::Met {
        return denied("verification-truth", "submission.truth", "the truth is met on the current evidence; there is nothing to waive",
            json!(submission.truth), json!("met"));
    }
    let history = records(data)?;
    let active = active(&history, &submission.truth.id);
    let kind = match (&submission.supersedes, submission.revoked) {
        (Some(prior), revoked) => {
            if active.map(|r| &r.id) != Some(prior) {
                return denied("verification-waiver", "submission.supersedes", "supersession must name the retained active waiver for this truth",
                    json!(prior), json!(active.map(|r| &r.id)));
            }
            if revoked { Kind::Revoke } else { Kind::Reaffirm }
        }
        (None, true) => {
            return denied("verification-waiver", "submission.supersedes", "revocation names the retained waiver it revokes", Value::Null, json!(active.map(|r| &r.id)));
        }
        (None, false) => {
            if let Some(prior) = active {
                return denied("verification-waiver", "submission.supersedes", "this truth already has a retained waiver; supersede or revoke it by id",
                    Value::Null, json!(prior.id));
            }
            Kind::Waive
        }
    };
    let record = Record { schema: SCHEMA.into(), id: digest(&serde_json::to_vec(&(&request.request_id, &claim.root_binding, submission))?),
        request_id: request.request_id.clone(), root_binding: claim.root_binding.clone(), kind,
        submission: submission.clone(), approval: approval.clone(),
        reviewed: json!({"attempt":attempt.id,"patch":patch.request_id,"status":row.status,"reason":row.reason,"items":row.items}) };
    Ok(json!({"status":"ok","receipt":{"schema":SCHEMA,"record":record}}))
}

pub fn contribute(data: &Value, binding: &str, claim: &Claim) -> Result<Value> {
    if claim.schema != SCHEMA || claim.root_binding != binding
        || claim.payload_digest != payload_digest(&claim.request)?
        || claim.authority_digest != inputs::authority_digest(data)?
        || replay(data, &claim.request)?.is_some() || claim.answer != assess(data, claim)? {
        return Err(Error::Invalid("waiver claim differs from committing authority or immutable outcome".into()));
    }
    if claim.answer["status"] != "ok" {
        return Err(Error::Invalid("a refused waiver is never retained as an event".into()));
    }
    let record: Record = serde_json::from_value(claim.answer["receipt"]["record"].clone())?;
    let mut history = records(data)?;
    history.push(record);
    let mut next = data.clone();
    if next.get(persistence::NAMESPACE).is_none() {
        next[persistence::NAMESPACE] = json!({"schema":"verification-1","attempts":[]});
    }
    next[persistence::NAMESPACE]["waivers"] = json!(history);
    Ok(next)
}

pub fn decision(claim: &Claim) -> Result<DecisionRecord> {
    Ok(DecisionRecord { version: 1, id: format!("verification-waiver:{}", digest(claim.request.request_id.as_bytes())), revision: 1,
        origin: Origin { source: SCHEMA.into(), original: Evidence::Missing },
        decision: Decision::Gate { outcome: SCHEMA.into(), evidence: Evidence::Text(serde_json::to_string(claim)?) },
        at: crate::store::model::stamped_at() })
}

pub fn transaction(data: &Value, claim: &Claim) -> Result<crate::store::transaction::Transaction> {
    Ok(crate::store::transaction::Transaction { id: format!("truth-waive:{}", digest(claim.request.request_id.as_bytes())),
        items: vec![], decisions: vec![decision(claim)?], snapshot: Some(contribute(data, &claim.root_binding, claim)?), external: vec![] })
}

/// Commit and recovery reobserve the root, source and installed plans the
/// claim was bound to; a changed basis refuses instead of installing.
pub fn reobserve(data: &Value, claim: &Claim) -> Result<()> {
    if inputs::root_binding(&claim.root)? != claim.root_binding {
        return Err(Error::Conflict("waiver claim root changed".into()));
    }
    let attempt = persistence::attempts(data)?.into_iter().find(|a| a.id == claim.answer["receipt"]["record"]["reviewed"]["attempt"])
        .ok_or_else(|| Error::Invalid("waiver reviewed attempt absent".into()))?;
    inputs::reobserve_external(&claim.root, data, &attempt.inputs, &claim.documents)
}

/// One row per retained event, with whether it is effective against the
/// current judgment and, when it is not, the exact reason.
pub fn applicability(data: &Value, phase: u32, current: Option<(&persistence::Attempt, &Basis)>) -> Result<Vec<Value>> {
    let history: Vec<Record> = records(data)?.into_iter().filter(|r| r.submission.basis.phase == phase).collect();
    let mut rows = Vec::new();
    for record in &history {
        let superseded_by = history.iter().find(|later| later.kind == Kind::Reaffirm && later.submission.supersedes.as_deref() == Some(&record.id)).map(|r| r.id.clone());
        let revoked_by = history.iter().find(|later| later.kind == Kind::Revoke && later.submission.supersedes.as_deref() == Some(&record.id)).map(|r| r.id.clone());
        let reviewed = record.reviewed["attempt"].as_str().unwrap_or_default();
        let (effective, reason) = if record.kind == Kind::Revoke { (false, "a revocation is an event, not a waiver".to_owned()) }
            else if let Some(id) = &revoked_by { (false, format!("revoked by {id}")) }
            else if let Some(id) = &superseded_by { (false, format!("superseded by {id}")) }
            else { match current {
                None => (false, "no complete verification on the current basis".into()),
                Some((attempt, basis)) => {
                    let differs = status::differs(&record.submission.basis, basis)?;
                    if !differs.is_empty() { (false, format!("basis differs from current: {}; owner reaffirmation required", differs.join(", "))) }
                    else if reviewed != attempt.id { (false, format!("reviewed attempt {reviewed} is not the current attempt {}", attempt.id)) }
                    else { (true, "effective against the current judgment".into()) }
                }
            } };
        rows.push(json!({"id":record.id,"request_id":record.request_id,"kind":record.kind,"truth":record.submission.truth,
            "owner":record.submission.owner,"at":record.submission.at,"reason_given":record.submission.reason,
            "approved_by":record.approval.owner,"approved_at":record.approval.at,"supersedes":record.submission.supersedes,
            "basis":record.submission.basis,"reviewed":record.reviewed,"effective":effective,"reason":reason,
            "superseded_by":superseded_by,"revoked_by":revoked_by}));
    }
    Ok(rows)
}
