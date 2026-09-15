//! Versioned attempts own their namespace and immutable journal records.
use super::inputs::{self, Inputs, refuse};
use crate::store::{Error, Result, model::{digest, DecisionRecord, Decision, Origin, Evidence}};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{collections::BTreeMap, path::PathBuf};

pub const NAMESPACE: &str = "verification";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Attempt {
    pub schema: String,
    pub id: String,
    pub request_id: String,
    pub inputs: Inputs,
    pub prompt: String,
    pub prompt_digest: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub root: PathBuf,
    pub attempt: Attempt,
    pub documents: BTreeMap<String, String>,
}

pub fn attempts(data: &Value) -> Result<Vec<Attempt>> {
    let Some(namespace) = data.get(NAMESPACE) else { return Ok(vec![]); };
    if namespace["schema"] != "verification-1" { return Err(Error::Invalid("unsupported verification namespace".into())); }
    Ok(serde_json::from_value(namespace["attempts"].clone())?)
}

pub fn replay(data: &Value, phase: u32, request_id: &str) -> Result<Option<Attempt>> {
    let saved = attempts(data)?.into_iter().find(|a| a.request_id == request_id);
    if saved.as_ref().is_some_and(|a| a.inputs.basis.phase != phase) {
        return Err(refuse(phase, "verification-request-reuse", "request_id", "request already names another phase"));
    }
    Ok(saved)
}

pub fn prepare(root: PathBuf, data: &Value, phase: u32, request_id: String) -> Result<Request> {
    if request_id.trim().is_empty() || request_id.len() > 256 {
        return Err(refuse(phase, "verification-request", "request_id", "bounded nonblank request identity required"));
    }
    let inputs = inputs::observe(&root, data, phase)?;
    let documents = crate::plan::inventory::read(&root, &phase.to_string(), data)?.documents;
    let prompt = super::dispatch::prompt(&inputs, &documents)?;
    let id = digest(&serde_json::to_vec(&(&request_id, &inputs.basis))?);
    Ok(Request { root, attempt: Attempt { schema: "verification-attempt-1".into(), id, request_id,
        inputs, prompt_digest: digest(prompt.as_bytes()), prompt }, documents })
}

pub fn contribute(data: &Value, root_binding: &str, request: &Request) -> Result<Value> {
    let attempt = &request.attempt;
    let phase = attempt.inputs.basis.phase;
    if let Some(prior) = replay(data, phase, &attempt.request_id)? {
        return if prior == *attempt { Ok(data.clone()) }
            else { Err(refuse(phase, "verification-request-reuse", "request_id", "attempt payload changed")) };
    }
    if phase == 0 || attempt.schema != "verification-attempt-1" || attempt.request_id.trim().is_empty()
        || attempt.inputs.basis.root_binding != root_binding
        || attempt.inputs.authority_digest != inputs::authority_digest(data)?
        || attempt.prompt_digest != digest(attempt.prompt.as_bytes())
        || attempt.prompt != super::dispatch::prompt(&attempt.inputs, &request.documents)?
        || attempt.id != digest(&serde_json::to_vec(&(&attempt.request_id, &attempt.inputs.basis))?) {
        return Err(refuse(phase, "verification-inputs", "attempt", "attempt differs from its complete committing authority"));
    }
    let mut saved = attempts(data)?;
    saved.push(attempt.clone());
    let mut next = data.clone();
    if next.get(NAMESPACE).is_none() { next[NAMESPACE] = json!({"schema":"verification-1"}); }
    next[NAMESPACE]["attempts"] = json!(saved);
    Ok(next)
}

pub fn decision(attempt: &Attempt) -> Result<DecisionRecord> {
    Ok(DecisionRecord { version: 1, id: format!("verification-attempt:{}", attempt.id), revision: 1,
        origin: Origin { source: "verification-attempt-1".into(), original: Evidence::Missing },
        decision: Decision::Gate { outcome: "verification-attempt-1".into(), evidence: Evidence::Text(serde_json::to_string(attempt)?) } })
}
