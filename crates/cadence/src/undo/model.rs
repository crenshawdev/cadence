use crate::{envelope::Refusal, rail::commit, store::{Error, Result}};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{collections::BTreeMap, num::NonZeroU32};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum Mode { Committed, NoCommit }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub request_id: String,
    pub phase: NonZeroU32,
    pub manifest: String,
    pub mode: Mode,
}

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum Apply {
    #[serde(rename = "undo-phase")]
    Phase { request: Request },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Manifest {
    pub id: String,
    pub phase: u32,
    pub root_binding: String,
    pub source: String,
    pub occurrence: String,
    pub hashes: Vec<String>,
    pub provenance: Value,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Undone { pub undo: String, pub manifest: String, pub occurrence: String }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Completed { pub hash: String, pub commit: Option<String>, pub index: String }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Pending { pub hash: String, pub head: String, pub index: String }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Conflict { pub hash: String, pub paths: Vec<String>, pub reason: String }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Record {
    pub id: String,
    pub request: Request,
    pub manifest: Manifest,
    pub completed: Vec<Completed>,
    pub pending: Option<Pending>,
    pub conflict: Option<Conflict>,
    pub state: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Document { pub before: Option<Vec<u8>>, pub after: Vec<u8> }

/// One typed transition. A sealed commit and its progress receipt recover together.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Write {
    pub record: Record,
    pub seal: Option<commit::Seal>,
    pub documents: BTreeMap<String, Document>,
    pub protected: Vec<String>,
    pub on_protected: String,
}

pub fn records(data: &Value) -> Result<BTreeMap<String, Record>> {
    let Some(raw) = data.get("undos") else { return Ok(BTreeMap::new()) };
    if raw["schema"] != "undo-1" { return Err(Error::Invalid("unsupported undo namespace".into())); }
    Ok(serde_json::from_value(raw["records"].clone())?)
}

pub fn marker(record: &Record) -> Undone {
    Undone { undo: record.id.clone(), manifest: record.manifest.id.clone(), occurrence: record.manifest.occurrence.clone() }
}

/// Native and SUMMARY undo share suppression without inventing native history.
pub fn undone(data: &Value, phase: u32) -> Result<bool> {
    if let Some(raw) = data["execution"]["occurrences"].get(phase.to_string())
        && let Some(value) = raw.get("undone").filter(|v| !v.is_null()) {
        let _: Undone = serde_json::from_value(value.clone())?;
        return Ok(true);
    }
    Ok(records(data)?.values().any(|r| r.manifest.phase == phase && r.state == "committed"))
}

pub fn answer(record: &Record) -> Value {
    if let Some(conflict) = &record.conflict {
        let mut answer = Refusal::new("undo-conflict", &conflict.reason).slot("request.manifest")
            .details(json!({"phase":record.manifest.phase,"manifest":record.manifest.id,"hash":conflict.hash,"paths":conflict.paths})).value();
        answer["undo"] = json!(record);
        answer
    } else { json!({"status":"ok","undo":record}) }
}

pub fn contribute(data: &Value, write: &Write) -> Result<Value> {
    let record = &write.record;
    let fail = || Error::Invalid("undo transition differs from its exact manifest and retained progress".into());
    if record.id != crate::milestone::model::identity("undo", &record.manifest.root_binding, &record.request.request_id)
        || record.request.phase.get() != record.manifest.phase || record.request.manifest != record.manifest.id
        || record.manifest.hashes.is_empty() || record.manifest.id != super::manifest::identity(&record.manifest)? {
        return Err(fail());
    }
    let mut saved = records(data)?;
    let before = saved.get(&record.id);
    if let Some(prior) = before {
        if prior.request != record.request || prior.manifest != record.manifest
            || prior.state != "running" || !record.completed.starts_with(&prior.completed)
            || record.completed.len() > prior.completed.len() + 1 { return Err(fail()); }
    } else {
        if !record.completed.is_empty() || record.pending.is_some() || record.state != "running"
            || saved.values().any(|r| r.manifest.phase == record.manifest.phase) { return Err(fail()); }
        match super::manifest::native(data, record.manifest.phase)? {
            Some((occurrence, hashes, provenance)) => {
                let mut exact = Vec::new();
                for hash in hashes { if !exact.contains(&hash) { exact.push(hash); } }
                if record.manifest.source != "execution" || occurrence != record.manifest.occurrence
                    || exact != record.manifest.hashes || provenance != record.manifest.provenance { return Err(fail()); }
            }
            None if record.manifest.source == "SUMMARY" => {},
            None => return Err(fail()),
        }
    }
    if record.completed.len() > record.manifest.hashes.len()
        || record.completed.iter().zip(record.manifest.hashes.iter().rev()).any(|(step, hash)| step.hash != *hash
            || step.commit.is_some() != (record.request.mode == Mode::Committed)) { return Err(fail()); }
    let complete = record.completed.len() == record.manifest.hashes.len();
    match record.state.as_str() {
        "running" if !complete && record.conflict.is_none() => {},
        "conflict" if !complete && record.conflict.as_ref().is_some_and(|c|
            Some(&c.hash) == record.manifest.hashes.iter().rev().nth(record.completed.len())) => {},
        "staged" if complete && record.request.mode == Mode::NoCommit && record.pending.is_none() => {},
        "committed" if complete && record.request.mode == Mode::Committed && record.pending.is_none() => {},
        _ => return Err(fail()),
    }
    let advances = before.is_some_and(|p| record.completed.len() > p.completed.len());
    if advances {
        let pending = before.and_then(|p| p.pending.as_ref()).ok_or_else(fail)?;
        if record.completed.last().is_none_or(|s| s.hash != pending.hash) || record.pending.is_some() { return Err(fail()); }
    }
    match &write.seal {
        Some(seal) if advances && record.request.mode == Mode::Committed
            && record.completed.last().is_some_and(|s| s.commit.as_ref() == Some(&seal.commit.id) && s.index == seal.tree)
            && before.and_then(|p| p.pending.as_ref()).is_some_and(|p| p.head == seal.parent) => {},
        None if !advances || record.request.mode == Mode::NoCommit => {},
        _ => return Err(fail()),
    }
    if record.state != "committed" && !write.documents.is_empty() { return Err(fail()); }
    let mut next = data.clone();
    saved.insert(record.id.clone(), record.clone());
    next["undos"] = json!({"schema":"undo-1","records":saved});
    if record.state == "committed" && record.manifest.source == "execution" {
        let key = record.manifest.phase.to_string();
        let occurrence: crate::execution::model::ExecutionOccurrence = serde_json::from_value(data["execution"]["occurrences"][&key].clone())?;
        if occurrence.undone.is_some() { return Err(fail()); }
        next["execution"]["occurrences"][key]["undone"] = json!(marker(record));
    }
    Ok(next)
}
