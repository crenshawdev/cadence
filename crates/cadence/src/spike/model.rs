use crate::{envelope::Refusal, store::{Error, Result}};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{collections::{BTreeMap, BTreeSet}, path::{Component, Path, PathBuf}};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Criterion {
    pub id: String, pub given: String, pub when: String, pub then: String, pub failure: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Observation { pub criterion: String, pub result: String }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Verdict { Validated, Invalidated, Inconclusive }
impl Verdict {
    pub fn word(&self) -> &'static str {
        match self { Self::Validated => "validated", Self::Invalidated => "invalidated", Self::Inconclusive => "inconclusive" }
    }
    fn parse(word: &str) -> Result<Self> {
        match word {
            "validated" => Ok(Self::Validated), "invalidated" => Ok(Self::Invalidated),
            "inconclusive" => Ok(Self::Inconclusive),
            _ => Err(Error::Invalid("verdict must be validated, invalidated, inconclusive".into())),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Status { Open, Closed }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Record {
    pub slug: String, pub root_binding: String, pub version: u64,
    pub question: String, pub decision: String, pub criteria: Vec<Criterion>,
    pub observations: Vec<Observation>, pub verdict: Option<Verdict>,
    pub status: Status, pub throwaway_location: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Open {
    pub request_id: String, pub slug: String, pub expected_version: u64,
    pub question: String, pub decision: String, pub criteria: Vec<Criterion>,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ObservationRequest {
    pub request_id: String, pub slug: String, pub expected_version: u64, pub observation: Observation,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct VerdictRequest {
    pub request_id: String, pub slug: String, pub expected_version: u64,
    pub verdict: String, pub criteria: Vec<String>,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Close {
    pub request_id: String, pub slug: String, pub expected_version: u64, pub throwaway_location: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum Apply {
    #[serde(rename = "spike-open")]
    Open { request: Open },
    #[serde(rename = "spike-observation")]
    Observation { request: ObservationRequest },
    #[serde(rename = "spike-verdict")]
    Verdict { request: VerdictRequest },
    #[serde(rename = "spike-close")]
    Close { request: Close },
}
impl Apply {
    pub fn identity(&self) -> (&str, &str, u64) {
        match self {
            Self::Open { request } => (&request.request_id, &request.slug, request.expected_version),
            Self::Observation { request } => (&request.request_id, &request.slug, request.expected_version),
            Self::Verdict { request } => (&request.request_id, &request.slug, request.expected_version),
            Self::Close { request } => (&request.request_id, &request.slug, request.expected_version),
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Write { pub root_binding: String, pub project: PathBuf, pub apply: Apply }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Receipt { pub root_binding: String, pub apply: Apply, pub answer: Value }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Namespace {
    pub schema: String, pub records: BTreeMap<String, Record>, pub requests: BTreeMap<String, Receipt>,
}

pub fn validate_slug(slug: &str) -> Result<()> { crate::debug::model::validate_slug(slug) }

fn text(value: &str) -> Result<()> {
    if value.trim().is_empty() || value.len() > 16384 {
        return Err(Error::Invalid("spike evidence must be nonblank and at most 16384 bytes".into()));
    }
    Ok(())
}
fn criteria(values: &[Criterion]) -> Result<()> {
    let mut ids = BTreeSet::new();
    if values.is_empty() { return Err(Error::Invalid("ordered criteria are required before experiments".into())); }
    for value in values {
        validate_slug(&value.id)?;
        if !ids.insert(&value.id) { return Err(Error::Invalid("criterion identities must be distinct".into())); }
        for field in [&value.given, &value.when, &value.then, &value.failure] { text(field)?; }
    }
    Ok(())
}

/// Persist only an absolute external location, never a project path or an ancestor.
pub fn external_location(project: &Path, location: &str) -> Result<()> {
    text(location)?;
    let path = Path::new(location);
    if !path.is_absolute() || path.components().any(|p| matches!(p, Component::ParentDir | Component::CurDir))
        || path.starts_with(project) || project.starts_with(path) {
        return Err(Error::Invalid("throwaway location must be an external temporary directory outside the project and .planning/spikes".into()));
    }
    Ok(())
}

pub fn namespace(data: &Value) -> Result<Namespace> {
    let Some(raw) = data.get("spike") else {
        return Ok(Namespace { schema: "spike-1".into(), records: BTreeMap::new(), requests: BTreeMap::new() });
    };
    let saved: Namespace = serde_json::from_value(raw.clone())?;
    if saved.schema != "spike-1" { return Err(Error::Invalid("unsupported spike namespace".into())); }
    for (slug, record) in &saved.records {
        validate_slug(slug)?;
        text(&record.question)?;
        text(&record.decision)?;
        criteria(&record.criteria)?;
        let mut observed = BTreeSet::new();
        for observation in &record.observations {
            text(&observation.result)?;
            if !record.criteria.iter().any(|c| c.id == observation.criterion) || !observed.insert(&observation.criterion) {
                return Err(Error::Invalid("invalid spike observation identity".into()));
            }
        }
        if slug != &record.slug || record.version == 0 || record.root_binding.is_empty()
            || (record.status == Status::Closed) != record.throwaway_location.is_some()
            || record.status == Status::Closed && record.verdict.is_none()
            || record.verdict.is_some() && observed.len() != record.criteria.len() {
            return Err(Error::Invalid("invalid spike record".into()));
        }
    }
    Ok(saved)
}
pub fn answer(record: &Record) -> Value {
    json!({"status":"ok","record":record,"projection":super::render::render(record)})
}
pub fn replay(data: &Value, write: &Write) -> Result<Option<Value>> {
    if let Some(saved) = namespace(data)?.requests.get(write.apply.identity().0) {
        return Ok(Some(if saved.root_binding == write.root_binding && saved.apply == write.apply {
            saved.answer.clone()
        } else { Refusal::new("request-reused", "spike request identity binds different inputs").slot("request.request_id").value() }));
    }
    Ok(None)
}
fn transition(data: &Value, write: &Write) -> Result<Record> {
    let (_, slug, expected) = write.apply.identity();
    validate_slug(slug)?;
    let saved = namespace(data)?;
    let mut record = match &write.apply {
        Apply::Open { request } => {
            text(&request.question)?; text(&request.decision)?; criteria(&request.criteria)?;
            if let Some(prior) = saved.records.get(slug) {
                if prior.question != request.question || prior.decision != request.decision || prior.criteria != request.criteria {
                    return Err(Error::Invalid("spike question, decision and ordered criteria are immutable after open, including after verdict".into()));
                }
                prior.clone()
            } else {
                Record { slug: slug.into(), root_binding: write.root_binding.clone(), version: 0,
                    question: request.question.clone(), decision: request.decision.clone(), criteria: request.criteria.clone(),
                    observations: vec![], verdict: None, status: Status::Open, throwaway_location: None }
            }
        }
        _ => saved.records.get(slug).cloned().ok_or_else(|| Error::Invalid(format!("no spike is named {slug}")))?,
    };
    if record.root_binding != write.root_binding { return Err(Error::Invalid("spike belongs to another project root".into())); }
    if expected != record.version { return Err(Error::Conflict(format!("spike version changed: expected {}, supplied {expected}", record.version))); }
    if matches!(write.apply, Apply::Open { .. }) && record.version > 0 { return Ok(record); }
    if record.status == Status::Closed { return Err(Error::Invalid("spike is already closed".into())); }
    match &write.apply {
        Apply::Open { .. } => {}
        Apply::Observation { request } => {
            if record.verdict.is_some() { return Err(Error::Invalid("observations are frozen after the verdict".into())); }
            text(&request.observation.result)?;
            if !record.criteria.iter().any(|c| c.id == request.observation.criterion) {
                return Err(Error::Invalid("observation names a foreign criterion".into()));
            }
            if record.observations.iter().any(|o| o.criterion == request.observation.criterion) {
                return Err(Error::Invalid("one observed result per criterion is allowed".into()));
            }
            record.observations.push(request.observation.clone());
        }
        Apply::Verdict { request } => {
            let verdict = Verdict::parse(&request.verdict)?;
            if record.verdict.is_some() { return Err(Error::Invalid("spike already has a verdict".into())); }
            if request.criteria != record.criteria.iter().map(|c| c.id.clone()).collect::<Vec<_>>()
                || record.observations.len() != record.criteria.len() {
                return Err(Error::Invalid("verdict requires every ordered criterion identity and one observed result per criterion, with no foreign criteria".into()));
            }
            record.verdict = Some(verdict);
        }
        Apply::Close { request } => {
            if record.verdict.is_none() { return Err(Error::Invalid("close requires a verdict".into())); }
            external_location(&write.project, &request.throwaway_location)?;
            record.throwaway_location = Some(request.throwaway_location.clone());
            record.status = Status::Closed;
        }
    }
    record.version = record.version.checked_add(1).ok_or_else(|| Error::Invalid("spike version exhausted".into()))?;
    Ok(record)
}
pub fn outcome(data: &Value, write: &Write) -> std::result::Result<Record, Value> {
    transition(data, write).map_err(|error| Refusal::new("spike-invalid", error.to_string())
        .slot("request").details(json!({"slug":write.apply.identity().1})).value())
}
pub fn contribute(data: &Value, write: &Write) -> Result<Value> {
    let (id, _, _) = write.apply.identity();
    crate::milestone::model::name(id)?;
    if write.root_binding.is_empty() || replay(data, write)?.is_some() {
        return Err(Error::Invalid("spike write requires a new root-bound request".into()));
    }
    let mut saved = namespace(data)?;
    let response = match outcome(data, write) {
        Ok(record) => { let response = answer(&record); saved.records.insert(record.slug.clone(), record); response }
        Err(refusal) => refusal,
    };
    saved.requests.insert(id.into(), Receipt { root_binding: write.root_binding.clone(), apply: write.apply.clone(), answer: response });
    let mut next = data.clone();
    next["spike"] = serde_json::to_value(saved)?;
    Ok(next)
}
