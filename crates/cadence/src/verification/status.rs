//! Truth status is derived from every current item verdict; no role writes one.
//!
//! A truth's row reduces the verdicts of every canonical item its exact version
//! is associated with, through the retained coherent map the attempt was
//! dispatched from. The current judgment is the latest complete patch whose
//! full basis equals the basis observed now; every other complete attempt is
//! historical and keeps its rows, reasons and identities unchanged.
use crate::process::Process;
use super::{inputs, model::{Basis, Patch, Verdict}, persistence::{self, Attempt}, verdicts, waivers};
use crate::store::{Error, Result};
use serde::Serialize;
use serde_json::{Value, json};
use std::{collections::BTreeMap, path::Path};

pub const SCHEMA: &str = "verification-report-1";
pub const LEGACY: &str = "historical classification only; never native evidence";
const NO_ATTEMPT: &str = "no verification attempt";
const UNAVAILABLE: &str = "current verification inputs unavailable";
const NOT_CURRENT: &str = "no complete verification on the current basis";
const CURRENT: &str = "complete patch on the current basis";
const OPEN: &str = "attempt has no complete patch";
const PENDING: &str = "no complete applicable verification";
const BASIS_FIELDS: [&str; 11] = ["project", "root_binding", "phase", "occurrence", "context_digest", "truths",
    "publications", "map_digest", "admission_digests", "execution_digest", "source"];

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Status { Pending, Met, Concerns, Unmet, Waived }

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct ItemRow {
    pub id: String,
    pub kind: String,
    pub item_revision: String,
    pub verdict: Verdict,
    pub observed: String,
    pub runs: Vec<String>,
    pub reasons: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct TruthRow {
    pub id: String,
    pub version: u32,
    pub text: String,
    pub status: Status,
    pub reason: String,
    pub items: Vec<ItemRow>,
}

/// The design's table: any rejected or not seen item wins as unmet; otherwise an
/// observation caps at concerns; otherwise met. No items means nothing to reduce.
pub fn reduce(items: &[ItemRow]) -> (Status, String) {
    let negative: Vec<_> = items.iter().filter(|i| i.verdict != Verdict::Accepted).map(|i| i.id.as_str()).collect();
    if items.is_empty() { (Status::Pending, "no evidence item".into()) }
    else if !negative.is_empty() { (Status::Unmet, format!("rejected or not seen: {}", negative.join(", "))) }
    else if items.iter().any(|i| i.kind == "observation") {
        (Status::Concerns, "every item accepted and at least one is an observation".into())
    } else { (Status::Met, "every item accepted and none is an observation".into()) }
}

/// One row per truth the attempt was dispatched with, over the complete patch.
pub fn rows(attempt: &Attempt, patch: &Patch) -> Result<Vec<TruthRow>> {
    let map = &attempt.inputs.map;
    let items = map["items"].as_array().ok_or_else(|| Error::Invalid("retained canonical items absent".into()))?;
    let associations = map["associations"].as_array().ok_or_else(|| Error::Invalid("retained associations absent".into()))?;
    let truths = map["truths"].as_array().ok_or_else(|| Error::Invalid("retained truths absent".into()))?;
    let mut rows = Vec::new();
    for truth in truths {
        let (id, version) = (&truth["id"], &truth["version"]);
        let mut reasons: BTreeMap<String, Vec<String>> = BTreeMap::new();
        for edge in associations.iter().filter(|a| a["truth_id"] == *id && a["truth_version"] == *version) {
            let item = edge["origin"]["item_id"].as_str().unwrap_or_default().to_owned();
            let reason = edge["reason"].as_str().unwrap_or_default().to_owned();
            let list = reasons.entry(item).or_default();
            if !list.contains(&reason) { list.push(reason); }
        }
        let mut judged = Vec::new();
        for (item_id, reasons) in reasons {
            let definition = items.iter().find(|i| i["id"] == item_id)
                .ok_or_else(|| Error::Invalid(format!("associated item {item_id} is not canonical")))?;
            let verdict = patch.items.iter().find(|v| v.id == item_id)
                .ok_or_else(|| Error::Invalid(format!("complete patch lacks item {item_id}")))?;
            judged.push(ItemRow { id: item_id, kind: definition["kind"].as_str().unwrap_or_default().into(),
                item_revision: definition["item_revision"].as_str().unwrap_or_default().into(),
                verdict: verdict.verdict.clone(), observed: verdict.observed.clone(), runs: verdict.runs.clone(), reasons });
        }
        let (status, reason) = reduce(&judged);
        rows.push(TruthRow { id: id.as_str().unwrap_or_default().into(), version: version.as_u64().unwrap_or_default() as u32,
            text: truth["text"].as_str().unwrap_or_default().into(), status, reason, items: judged });
    }
    Ok(rows)
}

pub fn differs(requested: &Basis, current: &Basis) -> Result<Vec<String>> {
    let (requested, current) = (serde_json::to_value(requested)?, serde_json::to_value(current)?);
    Ok(BASIS_FIELDS.iter().filter(|f| requested[**f] != current[**f]).map(|f| format!("basis.{f}")).collect())
}

/// The current judgment: what a dispatch would observe now, every retained
/// attempt with its complete patch, and the one attempt that is current.
pub struct Judgment {
    pub observed: Option<Basis>,
    pub unavailable: Option<Value>,
    pub attempts: Vec<Attempt>,
    pub complete: Vec<Option<Patch>>,
    pub current: Option<usize>,
}

impl Judgment {
    pub fn current(&self) -> Option<(&Attempt, &Patch)> {
        self.current.map(|i| (&self.attempts[i], self.complete[i].as_ref().expect("complete")))
    }
}

pub fn judgment(root: &Path, data: &Value, phase: u32, process: &mut dyn Process) -> Result<Judgment> {
    let attempts: Vec<Attempt> = persistence::phase_attempts(data, phase)?;
    let patches = verdicts::patches(data)?;
    let complete: Vec<Option<Patch>> = attempts.iter().map(|a| patches.iter().find(|p| p.attempt == a.id).cloned()).collect();
    let (observed, unavailable) = match inputs::observe(root, data, phase, process) {
        Ok(observed) => (Some(observed.basis), None),
        Err(error) => (None, Some(verdicts::error_answer(error))),
    };
    let current = observed.as_ref().and_then(|basis| (0..attempts.len()).rev()
        .find(|i| complete[*i].is_some() && attempts[*i].inputs.basis == *basis));
    Ok(Judgment { observed, unavailable, attempts, complete, current })
}

/// Effective waivers are shown beside the derived rows: the row keeps its
/// derived status, reason and items, and gains the owner's attribution.
pub fn overlay(truths: &mut Value, applicable: &[Value]) {
    for row in truths.as_array_mut().into_iter().flatten() {
        let Some(waiver) = applicable.iter().find(|w| w["effective"] == true
            && w["truth"]["id"] == row["id"] && w["truth"]["version"] == row["version"]) else { continue };
        if row["status"] == "met" { continue }
        row["derived"] = row["status"].clone();
        row["status"] = json!(Status::Waived);
        row["waiver"] = json!({"id":waiver["id"],"request_id":waiver["request_id"],"owner":waiver["owner"],
            "at":waiver["at"],"reason":waiver["reason_given"]});
    }
}

pub fn counts(truths: &Value) -> Value {
    let count = |status: &str| truths.as_array().map(|rows| rows.iter().filter(|r| r["status"] == status).count()).unwrap_or_default();
    json!({"met":count("met"),"concerns":count("concerns"),"unmet":count("unmet"),"pending":count("pending"),"waived":count("waived")})
}

/// The owner-visible report for one phase. Reading observes the current basis
/// exactly as a dispatch would; it writes nothing and repairs nothing.
pub fn report(root: &Path, data: &Value, phase: u32, process: &mut dyn Process) -> Result<Value> {
    let context = crate::context::persistence::saved(data, phase)?
        .ok_or_else(|| inputs::refuse(phase, "native-approved-truths", "context", "native approved truths required"))?;
    let judged = judgment(root, data, phase, process)?;
    let Judgment { observed, unavailable, attempts, complete, .. } = &judged;
    let current = judged.current();
    let mut history = Vec::new();
    for (attempt, patch) in attempts.iter().zip(complete) {
        let rows = match patch { Some(patch) => rows(attempt, patch)?, None => vec![] };
        let differs = observed.as_ref().map(|basis| differs(&attempt.inputs.basis, basis)).transpose()?.unwrap_or_default();
        let (applicability, reason) = match (patch, &observed) {
            (None, _) => ("open", OPEN.to_owned()),
            (Some(_), None) => ("historical", UNAVAILABLE.to_owned()),
            (Some(_), Some(_)) if !differs.is_empty() => ("historical", format!("basis differs from current: {}", differs.join(", "))),
            (Some(_), Some(_)) => match current {
                Some((c, _)) if c.id == attempt.id => ("current", CURRENT.to_owned()),
                Some((c, _)) => ("historical", format!("superseded by attempt {}", c.id)),
                None => ("historical", NOT_CURRENT.to_owned()),
            },
        };
        history.push(json!({"attempt":attempt.id,"request_id":attempt.request_id,"applicability":applicability,"reason":reason,
            "application":patch.as_ref().map(|_| "accepted"),"patch":patch.as_ref().map(|p| &p.request_id),"basis":attempt.inputs.basis,
            "differs":differs,"truths":rows}));
    }
    let mut truths = match current {
        Some((attempt, patch)) => serde_json::to_value(rows(attempt, patch)?)?,
        None => {
            let mut truths: Vec<_> = context.truths.iter().collect();
            truths.sort_by(|a, b| (&a.id, a.version).cmp(&(&b.id, b.version)));
            json!(truths.iter().map(|t| json!({"id":t.id,"version":t.version,"text":t.text,"status":Status::Pending,
                "reason":PENDING,"items":[]})).collect::<Vec<_>>())
        }
    };
    let applicable = waivers::applicability(data, phase, current.map(|(a, _)| (a, &a.inputs.basis)))?;
    overlay(&mut truths, &applicable);
    let counts = counts(&truths);
    let completion = match super::completion::applicable(data, phase)? {
        Some((record, applies, reason)) => json!({"status":if applies { record.label.as_str() } else { "incomplete" },
            "applicable":applies,"reason":reason,"record":record}),
        None => json!({"status":"incomplete","applicable":false,"reason":"no completion recorded","record":null}),
    };
    let waived = counts["waived"].as_u64().unwrap_or_default();
    let advice = (waived > 1).then(|| format!("revisit the plan: {waived} truths are waived"));
    let reason = match (&current, &unavailable, attempts.is_empty()) {
        (_, _, true) => NO_ATTEMPT,
        (Some(_), _, _) => CURRENT,
        (None, Some(_), _) => UNAVAILABLE,
        (None, None, _) => NOT_CURRENT,
    };
    Ok(json!({"status":"ok","schema":SCHEMA,"phase":phase,
        "current":{"applicable":current.is_some(),"attempt":current.map(|(a, _)| &a.id),"patch":current.map(|(_, p)| &p.request_id),
            "reason":reason,"verified_at":current.map(|(a, _)| &a.inputs.basis),"observed":observed,"unavailable":unavailable},
        "truths":truths,"counts":counts,"waivers":applicable,"advice":advice,"history":history,
        "humans":super::human::items_with(data, phase, super::human::observed_document(root, phase).as_deref())?,
        "completion":completion,
        "legacy":{"summary_document":root.join(format!("phases/{phase}/SUMMARY.md")).is_file(),
            "uat_document":root.join(format!("phases/{phase}/UAT.md")).is_file(),"authority":LEGACY}}))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(id: &str, kind: &str, verdict: Verdict) -> ItemRow {
        ItemRow { id: id.into(), kind: kind.into(), item_revision: "r1".into(), verdict,
            observed: "seen".into(), runs: vec![], reasons: vec!["because".into()] }
    }

    #[test]
    fn reduction_follows_the_design_table() {
        assert_eq!(reduce(&[]), (Status::Pending, "no evidence item".to_owned()));
        assert_eq!(reduce(&[item("check/A", "check", Verdict::Accepted), item("artifact/x", "artifact", Verdict::Accepted)]),
            (Status::Met, "every item accepted and none is an observation".to_owned()));
        assert_eq!(reduce(&[item("check/A", "check", Verdict::Accepted), item("observation/o", "observation", Verdict::Accepted)]),
            (Status::Concerns, "every item accepted and at least one is an observation".to_owned()));
        assert_eq!(reduce(&[item("check/A", "check", Verdict::Accepted), item("link/l", "link", Verdict::Rejected),
            item("observation/o", "observation", Verdict::NotSeen)]),
            (Status::Unmet, "rejected or not seen: link/l, observation/o".to_owned()));
    }
}
