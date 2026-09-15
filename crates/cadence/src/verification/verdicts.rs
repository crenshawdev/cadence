//! Complete immutable claims, separately retained application outcomes and verdicts.
use super::{inputs, model::{Patch, Source, Verdict}, persistence, runner};
use crate::store::{Error, Result, model::{digest, DecisionRecord, Decision, Origin, Evidence}};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{collections::{BTreeMap, BTreeSet}, path::{Path, PathBuf}};

pub const SCHEMA: &str = "verification-claim-1";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Claim {
    pub schema: String,
    pub root: PathBuf,
    pub root_binding: String,
    pub patch: Patch,
    pub payload_digest: String,
    pub authority_digest: String,
    pub runs_digest: String,
    pub map_digest: Option<String>,
    pub source: Option<Source>,
    pub documents: BTreeMap<String, String>,
    pub unavailable: Option<Value>,
    pub answer: Value,
}

pub fn claims(data: &Value) -> Result<Vec<Claim>> {
    persistence::attempts(data)?;
    Ok(data[persistence::NAMESPACE].get("claims").cloned().map(serde_json::from_value).transpose()?.unwrap_or_default())
}

pub fn patches(data: &Value) -> Result<Vec<Patch>> {
    persistence::attempts(data)?;
    Ok(data[persistence::NAMESPACE].get("patches").cloned().map(serde_json::from_value).transpose()?.unwrap_or_default())
}

pub fn refusal(rule: &str, slot: &str, id: &str, reason: &str, requested: Value, current: Value) -> Value {
    // Caller-controlled identities remain bounded even in diagnostic answers.
    fn bounded(value: Value) -> Value {
        if value.to_string().len() <= 8192 { value }
        else { json!({"digest":digest(value.to_string().as_bytes()),"omitted":"value exceeds diagnostic bound"}) }
    }
    json!({"status":"refused","rule":rule,"slot":slot,"id":id.chars().take(256).collect::<String>(),
        "reason":reason,"details":{"requested":bounded(requested),"current":bounded(current)}})
}

pub(crate) fn error_answer(error: Error) -> Value {
    if let Error::Invalid(text) | Error::Conflict(text) = &error
        && let Some(encoded) = text.strip_prefix("plan-refusal:")
        && let Ok(diagnostic) = serde_json::from_str::<crate::plan::model::Diagnostic>(encoded) {
        return serde_json::to_value(diagnostic.answer()).expect("diagnostic");
    }
    refusal("verification-inputs", "basis", "", "current verification authority unavailable", json!(error.to_string().chars().take(1024).collect::<String>()), Value::Null)
}

pub fn replay(data: &Value, patch: &Patch) -> Result<Option<Value>> {
    if let Some(prior) = claims(data)?.iter().find(|c| c.patch.request_id == patch.request_id) {
        return Ok(Some(if prior.patch == *patch { prior.answer.clone() } else {
            refusal("verification-request-reuse", "request_id", &patch.request_id,
                "request already names a different original claim", json!(digest(&serde_json::to_vec(patch)?)), json!(prior.payload_digest))
        }));
    }
    Ok(None)
}

pub fn prepare(root: &Path, data: &Value, patch: Patch) -> Result<Claim> {
    let phase = patch.basis.phase;
    let mut claim = Claim { schema: SCHEMA.into(), root: root.into(), root_binding: inputs::root_binding(root)?,
        payload_digest: digest(&serde_json::to_vec(&patch)?), authority_digest: inputs::authority_digest(data)?,
        runs_digest: digest(&serde_json::to_vec(&runner::records(data)?)?), patch,
        map_digest: None, source: None, documents: BTreeMap::new(), unavailable: None, answer: Value::Null };
    let observation = (|| -> Result<()> {
        let map = serde_json::to_value(crate::plan::map_view::read(root, phase)?)?;
        claim.map_digest = map["input_digest"].as_str().map(str::to_owned);
        claim.documents = crate::plan::inventory::read(root, &phase.to_string(), data)?.documents;
        claim.source = Some(inputs::source(root.parent().ok_or_else(|| Error::Invalid("project root absent".into()))?)?);
        // Revalidate all original execution evidence and owner statements too.
        inputs::observe(root, data, phase)?;
        Ok(())
    })();
    if let Err(error) = observation { claim.unavailable = Some(error_answer(error)); }
    claim.answer = assess(data, &claim)?;
    Ok(claim)
}

fn assess(data: &Value, claim: &Claim) -> Result<Value> {
    let patch = &claim.patch;
    let denied = |rule, slot: &str, id: &str, reason, requested, current| refusal(rule, slot, id, reason, requested, current);
    if patch.request_id.trim().is_empty() || patch.request_id.len() > 256 || serde_json::to_vec(patch)?.len() > 262144 {
        return Ok(denied("verification-request", "request_id", "", "bounded nonblank claim required", json!(patch.request_id), Value::Null));
    }
    let Some(attempt) = persistence::attempts(data)?.into_iter().find(|a| a.id == patch.attempt) else {
        return Ok(denied("verification-attempt", "attempt", "", "retained attempt absent", json!(patch.attempt), Value::Null));
    };
    let requested = serde_json::to_value(&patch.basis)?;
    let retained = serde_json::to_value(&attempt.inputs.basis)?;
    for field in ["project", "root_binding", "phase", "occurrence", "context_digest", "truths", "publications",
        "map_digest", "admission_digests", "execution_digest", "source"] {
        if requested[field] != retained[field] {
            return Ok(denied("verification-basis", &format!("basis.{field}"), "", "patch differs from dispatched input", requested[field].clone(), retained[field].clone()));
        }
    }
    if claim.root.parent() != Some(Path::new(&patch.basis.project)) {
        return Ok(denied("verification-basis", "basis.project", "", "attempt belongs to another project", json!(patch.basis.project), json!(claim.root.parent())));
    }
    if claim.map_digest.as_deref() != Some(&patch.basis.map_digest) {
        return Ok(denied("verification-basis", "basis.map_digest", "", "dispatched map is historical", json!(patch.basis.map_digest), json!(claim.map_digest)));
    }
    if claim.source.as_ref() != Some(&patch.basis.source) {
        return Ok(denied("verification-basis", "basis.source", "", "dispatched source is historical or ambiguous", json!(patch.basis.source), json!(claim.source)));
    }
    if let Some(answer) = &claim.unavailable { return Ok(answer.clone()); }
    if inputs::authority_digest(data)? != attempt.inputs.authority_digest {
        return Ok(denied("verification-basis", "basis", "", "dispatched authority is historical", json!(attempt.inputs.authority_digest), json!(claim.authority_digest)));
    }
    let expected = attempt.inputs.map["items"].as_array().ok_or_else(|| Error::Invalid("retained canonical items absent".into()))?;
    let runs = runner::records(data)?;
    let mut seen = BTreeSet::new();
    for (index, item) in patch.items.iter().enumerate() {
        let slot = format!("items[{index}]");
        let Some(saved) = expected.iter().find(|i| i["id"] == item.id) else {
            return Ok(denied("verification-item", &format!("{slot}.id"), &item.id, "item is not in the dispatched canonical map", json!(item.id), Value::Null));
        };
        if !seen.insert(&item.id) {
            return Ok(denied("verification-item", &format!("{slot}.id"), &item.id, "duplicate canonical item", json!(item.id), json!("one verdict")));
        }
        if saved["item_revision"] != item.item_revision {
            return Ok(denied("verification-item", &format!("{slot}.item_revision"), &item.id, "item revision differs", json!(item.item_revision), saved["item_revision"].clone()));
        }
        if item.observed.trim().is_empty() || item.observed.len() > 16384 {
            return Ok(denied("verification-observed", &format!("{slot}.observed"), &item.id, "bounded nonblank observed evidence required", json!(item.observed.len()), json!(16384)));
        }
        if (saved["kind"] != "check" && !item.runs.is_empty())
            || (saved["kind"] == "check" && item.verdict == Verdict::Accepted && item.runs.is_empty()) {
            return Ok(denied("verification-run", &format!("{slot}.runs"), &item.id, "accepted checks require their own independent run", json!(item.runs), Value::Null));
        }
        let mut unique = BTreeSet::new();
        for id in &item.runs {
            let launch = runs.iter().find(|r| r.id == *id && r.attempt == patch.attempt);
            let latest = runs.iter().rev().find(|r| r.attempt == patch.attempt && matches!(&r.event,
                runner::Event::Launch { request, .. } if request.item.id == item.id));
            let valid = unique.insert(id) && launch == latest && launch.is_some_and(|r| matches!(&r.event,
                runner::Event::Launch { request, .. } if request.basis == patch.basis && request.item.id == item.id && request.item.item_revision == item.item_revision))
                && runner::result(&runs, id).is_some_and(|r| r.attempt == patch.attempt && matches!(&r.event,
                    runner::Event::Result { result, source_after, .. } if result.material_unchanged && source_after.as_ref() == Some(&patch.basis.source)
                        && (item.verdict != Verdict::Accepted || runner::acceptable(result))));
            if !valid {
                return Ok(denied("verification-run", &format!("{slot}.runs"), &item.id, "current independent check result required; executor, foreign, failed, Unknown and zero-test results cannot pass", json!(id), json!(latest.map(|r| &r.id))));
            }
        }
    }
    if let Some(missing) = expected.iter().find(|i| !seen.iter().any(|id| i["id"] == **id)) {
        return Ok(denied("verification-item", "items", missing["id"].as_str().unwrap_or(""), "complete patch must name every canonical item; use explicit not_seen", Value::Null, missing["id"].clone()));
    }
    if patches(data)?.iter().any(|p| p.attempt == patch.attempt) {
        return Ok(denied("verification-attempt-complete", "attempt", "", "attempt already has its immutable complete patch", json!(patch.attempt), json!(patch.attempt)));
    }
    Ok(json!({"status":"ok","receipt":{"schema":"verification-patch-1","application":"accepted","patch":patch}}))
}

pub fn contribute(data: &Value, binding: &str, claim: &Claim) -> Result<Value> {
    if claim.schema != SCHEMA || claim.root_binding != binding
        || claim.payload_digest != digest(&serde_json::to_vec(&claim.patch)?)
        || claim.authority_digest != inputs::authority_digest(data)?
        || claim.runs_digest != digest(&serde_json::to_vec(&runner::records(data)?)?)
        || replay(data, &claim.patch)?.is_some() || claim.answer != assess(data, claim)? {
        return Err(Error::Invalid("verification claim differs from committing authority or immutable outcome".into()));
    }
    let mut history = claims(data)?;
    history.push(claim.clone());
    let mut next = data.clone();
    if next.get(persistence::NAMESPACE).is_none() {
        next[persistence::NAMESPACE] = json!({"schema":"verification-1","attempts":[]});
    }
    next[persistence::NAMESPACE]["claims"] = json!(history);
    if claim.answer["status"] == "ok" {
        let mut completed = patches(data)?;
        completed.push(claim.patch.clone());
        next[persistence::NAMESPACE]["patches"] = json!(completed);
    }
    Ok(next)
}

pub fn decision(claim: &Claim) -> Result<DecisionRecord> {
    Ok(DecisionRecord { version: 1, id: format!("verification-claim:{}", digest(claim.patch.request_id.as_bytes())), revision: 1,
        origin: Origin { source: SCHEMA.into(), original: Evidence::Missing },
        decision: Decision::Gate { outcome: SCHEMA.into(), evidence: Evidence::Text(serde_json::to_string(claim)?) } })
}

pub fn transaction(data: &Value, claim: &Claim) -> Result<crate::store::transaction::Transaction> {
    Ok(crate::store::transaction::Transaction { id: format!("verification-submit:{}", digest(claim.patch.request_id.as_bytes())),
        items: vec![], decisions: vec![decision(claim)?], snapshot: Some(contribute(data, &claim.root_binding, claim)?), external: vec![] })
}

/// All external inputs and exact root participants are checked during commit
/// and recovery. Historical refusals never install effective verdicts.
pub fn reobserve(data: &Value, claim: &Claim) -> Result<()> {
    if inputs::root_binding(&claim.root)? != claim.root_binding {
        return Err(Error::Conflict("verification claim root changed".into()));
    }
    if claim.answer["status"] == "ok" {
        let attempt = persistence::attempts(data)?.into_iter().find(|a| a.id == claim.patch.attempt)
            .ok_or_else(|| Error::Invalid("claim attempt absent".into()))?;
        inputs::reobserve_external(&claim.root, &attempt.inputs, &claim.documents)?;
    }
    Ok(())
}
