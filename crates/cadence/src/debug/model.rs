use crate::{envelope::Refusal, store::{Error, Result}};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::BTreeMap;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum HypothesisState { Untested, Testing, Refuted, Confirmed }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Hypothesis { pub id: String, pub description: String, pub rank_reason: String, pub state: HypothesisState }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Observation { pub test: String, pub result: String, pub rules_in: Vec<String>, pub rules_out: Vec<String> }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Attempt { pub description: String, pub result: String }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Reproduction { pub test: String, pub result: String, pub passed: bool }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Resolution { pub description: String, pub reproduction: Reproduction }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Status { Open, Resolved }

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RecallSnapshot {
    pub backend: String,
    pub results: Vec<RecallHit>,
    pub total: usize,
    pub incomplete: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RecallHit {
    pub score: f64,
    pub snippet: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phase: Option<u32>,
    pub provenance: Value,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Record {
    pub slug: String, pub root_binding: String, pub version: u64,
    pub symptom: String, pub hypotheses: Vec<Hypothesis>, pub observations: Vec<Observation>,
    pub attempts: Vec<Attempt>, pub attempt_count: u64, pub status: Status, pub resolution: Option<Resolution>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recall: Option<RecallSnapshot>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub review: Option<Review>,
    #[serde(default)]
    pub epoch: u64,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub consults: Vec<Consult>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Angle { pub hypothesis: String, pub rationale: String, pub how_to_check: String }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConsultState { Offered, Declined, Accepted, Completed, Failed }

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Consult {
    pub id: String, pub epoch: u64, pub offered_by: String,
    pub provider: String, pub model: String, pub effort: String,
    pub state: ConsultState, pub request_id: Option<String>,
    pub situation: Option<String>, pub angles: Vec<Angle>,
    pub evidence: Option<Value>, pub failure: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ConsultPolicy {
    pub threshold: u64, pub provider: String, pub model: String, pub effort: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ConsultResult { pub angles: Vec<Angle>, pub evidence: Option<Value>, pub failure: Option<String> }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum ConsultDecision { Accept, Decline }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ConsultRequest {
    pub request_id: String, pub slug: String, pub expected_version: u64,
    pub offer: String, pub epoch: u64, pub decision: ConsultDecision,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Review {
    pub occurrence: String,
    pub material: crate::rail::risk::MaterialIdentity,
    pub observation: String,
    pub admission_request_id: String,
    pub fire: Option<String>,
    #[serde(default)]
    pub history: Vec<super::review::FireReview>,
    #[serde(default)]
    pub pending_fires: Vec<String>,
    #[serde(default)]
    pub settled: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Open {
    pub request_id: String,
    pub slug: String,
    pub expected_version: u64,
    pub symptom: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct HypothesisRequest {
    pub request_id: String,
    pub slug: String,
    pub expected_version: u64,
    pub hypothesis: Hypothesis,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ObservationRequest {
    pub request_id: String,
    pub slug: String,
    pub expected_version: u64,
    pub observation: Observation,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct AttemptRequest {
    pub request_id: String,
    pub slug: String,
    pub expected_version: u64,
    pub attempt: Attempt,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Resolve {
    pub request_id: String,
    pub slug: String,
    pub expected_version: u64,
    pub resolution: String,
    pub reproduction: Reproduction,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum Apply {
    #[serde(rename = "debug-open")]
    Open { request: Open },
    #[serde(rename = "debug-hypothesis")]
    Hypothesis { request: HypothesisRequest },
    #[serde(rename = "debug-observation")]
    Observation { request: ObservationRequest },
    #[serde(rename = "debug-attempt")]
    Attempt { request: AttemptRequest },
    #[serde(rename = "debug-consult")]
    Consult { request: ConsultRequest },
    #[serde(rename = "debug-resolve")]
    Resolve { request: Resolve },
}
impl Apply {
    pub fn identity(&self) -> (&str, &str, u64) {
        match self {
            Self::Open { request } => (&request.request_id, &request.slug, request.expected_version),
            Self::Hypothesis { request } => (&request.request_id, &request.slug, request.expected_version),
            Self::Observation { request } => (&request.request_id, &request.slug, request.expected_version),
            Self::Attempt { request } => (&request.request_id, &request.slug, request.expected_version),
            Self::Consult { request } => (&request.request_id, &request.slug, request.expected_version),
            Self::Resolve { request } => (&request.request_id, &request.slug, request.expected_version),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Write {
    pub root_binding: String,
    pub apply: Apply,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recall: Option<RecallSnapshot>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub review: Option<Review>,
    /// Persist coordination before admission without completing the caller request.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub coordinating: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub consult_policy: Option<ConsultPolicy>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub consult_situation: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub consult_result: Option<ConsultResult>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Receipt { pub root_binding: String, pub apply: Apply, pub answer: Value }

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Namespace {
    pub schema: String,
    pub records: BTreeMap<String, Record>,
    pub requests: BTreeMap<String, Receipt>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub pending_requests: BTreeMap<String, Apply>,
}
pub fn namespace(data: &Value) -> Result<Namespace> {
    let Some(raw) = data.get("debug") else {
        return Ok(Namespace { schema: "debug-1".into(), records: BTreeMap::new(), requests: BTreeMap::new(), pending_requests: BTreeMap::new() });
    };
    let saved: Namespace = serde_json::from_value(raw.clone())?;
    if saved.schema != "debug-1" { return Err(Error::Invalid("unsupported debug namespace".into())); }
    for (slug, record) in &saved.records {
        validate_slug(slug)?;
        if slug != &record.slug || record.version == 0 || record.root_binding.is_empty()
            || record.attempt_count != record.attempts.len() as u64
            || (record.status == Status::Resolved) != record.resolution.is_some() {
            return Err(Error::Invalid("invalid debug record".into()));
        }
    }
    Ok(saved)
}
pub fn validate_slug(slug: &str) -> Result<()> {
    if slug.is_empty() || slug.len() > 80 || !slug.as_bytes()[0].is_ascii_lowercase()
        || slug.ends_with('-') || !slug.bytes().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'-') {
        return Err(Error::Invalid("slug must be 1..80 lowercase letters, digits or hyphens, starting with a letter and ending without a hyphen".into()));
    }
    Ok(())
}
fn text(value: &str) -> Result<()> {
    if value.trim().is_empty() || value.len() > 16384 { return Err(Error::Invalid("debug evidence must be nonblank and at most 16384 bytes".into())); }
    Ok(())
}
pub fn answer(record: &Record) -> Value {
    json!({"status":"ok","record":record,"projection":super::render::render(record)})
}
pub fn unknown(slug: &str) -> Value {
    Refusal::new("debug-unknown", format!("no debug session is named {slug}")).slot("slug").details(json!({"slug":slug})).value()
}
pub fn replay(data: &Value, write: &Write) -> Result<Option<Value>> {
    let (id, _, _) = write.apply.identity();
    if namespace(data)?.pending_requests.get(id).is_some_and(|pending| *pending != write.apply) {
        return Ok(Some(Refusal::new("request-reused", "debug request identity binds different inputs").slot("request.request_id").value()));
    }
    if matches!(write.apply, Apply::Consult { .. }) && write.consult_result.is_none()
        && namespace(data)?.pending_requests.contains_key(id) {
        return Ok(Some(Refusal::new("debug-consult-pending", "accepted consult has no durable result; do not repeat the external spend")
            .slot("request.request_id").value()));
    }
    if let Some(saved) = namespace(data)?.requests.get(id) {
        return Ok(Some(if saved.root_binding == write.root_binding && saved.apply == write.apply { saved.answer.clone() }
            else { Refusal::new("request-reused", "debug request identity binds different inputs").slot("request.request_id").value() }));
    }
    Ok(None)
}

/// The Store and recovery rebuild this same transition; no caller supplies record bytes.
pub fn transition(data: &Value, write: &Write) -> Result<std::result::Result<Record, Value>> {
    let (_, slug, expected) = write.apply.identity();
    let saved = namespace(data)?;
    if let Err(error) = validate_slug(slug) {
        return Ok(Err(Refusal::new("debug-slug", error.to_string()).slot("request.slug").details(json!({"slug":slug})).value()));
    }
    let mut record = match &write.apply {
        Apply::Open { request } => {
            if saved.records.contains_key(slug) { return Ok(Err(Refusal::new("debug-exists", "debug session already exists").slot("request.slug").details(json!({"slug":slug})).value())); }
            text(&request.symptom)?;
            Record { slug: slug.into(), root_binding: write.root_binding.clone(), version: 0,
                symptom: request.symptom.clone(), hypotheses: vec![], observations: vec![], attempts: vec![],
                attempt_count: 0, status: Status::Open, resolution: None, recall: write.recall.clone(), review: None, epoch: 0, consults: vec![] }
        }
        _ => match saved.records.get(slug) { Some(record) => record.clone(), None => return Ok(Err(unknown(slug))) },
    };
    if record.root_binding != write.root_binding { return Ok(Err(Refusal::new("debug-root", "debug mutation belongs to another project root").slot("request.slug").value())); }
    if write.consult_result.is_some() {
        return finish_consult(record, write, &saved);
    }
    if expected != record.version {
        return Ok(Err(Refusal::new("debug-version", "debug version changed").slot("request.expected_version")
            .details(json!({"slug":slug,"expected":record.version,"supplied":expected})).value()));
    }
    if record.status != Status::Open { return Ok(Err(Refusal::new("debug-resolved", "debug session is already resolved").slot("request.slug").value())); }
    if let Some(review) = &write.review {
        review.material.validate()?;
        if review.occurrence != slug || !matches!(write.apply, Apply::Resolve { .. }) {
            return Err(Error::Invalid("debug review requires its resolve occurrence".into()));
        }
        record.review = Some(review.clone());
    }
    // Resolve re-derives its gate from this transaction's preimage. A fire or
    // consequence arriving after service coordination cannot be overwritten by
    // an earlier projection supplied in the internal write.
    if matches!(write.apply, Apply::Resolve { .. }) && record.review.as_ref().is_some_and(|r| r.fire.is_some()) {
        let mut current = saved;
        current.records.insert(slug.into(), record);
        let mut projected = data.clone();
        projected["debug"] = serde_json::to_value(current)?;
        let refreshed = super::review::contribute(&projected, &write.root_binding)?;
        record = namespace(&refreshed)?.records.remove(slug).ok_or_else(|| Error::Invalid("debug record disappeared".into()))?;
    }
    if write.coordinating && !matches!(write.apply, Apply::Consult { .. }) { return Ok(Ok(record)); }
    match &write.apply {
        Apply::Open { .. } => {},
        Apply::Hypothesis { request } => {
            let hypothesis = &request.hypothesis;
            validate_slug(&hypothesis.id)?; text(&hypothesis.description)?; text(&hypothesis.rank_reason)?;
            if let Some(prior) = record.hypotheses.iter_mut().find(|h| h.id == hypothesis.id) {
                *prior = hypothesis.clone();
            } else { record.hypotheses.push(hypothesis.clone()); }
        }
        Apply::Observation { request } => {
            let observation = &request.observation;
            text(&observation.test)?; text(&observation.result)?;
            let mut selected = std::collections::BTreeSet::new();
            for id in observation.rules_in.iter().chain(&observation.rules_out) {
                if !selected.insert(id) || !record.hypotheses.iter().any(|h| &h.id == id) {
                    return Ok(Err(Refusal::new("debug-hypothesis", "observation must name distinct existing hypotheses").slot("request.observation").details(json!({"hypothesis":id})).value()));
                }
            }
            for hypothesis in &mut record.hypotheses {
                if observation.rules_in.contains(&hypothesis.id) { hypothesis.state = HypothesisState::Confirmed; }
                if observation.rules_out.contains(&hypothesis.id) { hypothesis.state = HypothesisState::Refuted; }
            }
            if !record.observations.contains(observation) {
                record.epoch = record.epoch.checked_add(1).ok_or_else(|| Error::Invalid("debug epoch exhausted".into()))?;
            }
            record.observations.push(observation.clone());
        }
        Apply::Attempt { request } => {
            text(&request.attempt.description)?; text(&request.attempt.result)?;
            record.attempts.push(request.attempt.clone());
        }
        Apply::Consult { request } => {
            let Some(offer) = record.consults.iter_mut().find(|o| o.id == request.offer && o.epoch == request.epoch) else {
                return Ok(Err(Refusal::new("debug-consult-offer", "unknown consult offer").slot("request.offer").value()));
            };
            if offer.epoch != record.epoch || offer.state != ConsultState::Offered {
                return Ok(Err(Refusal::new("debug-consult-offer", "consult offer is no longer available in this epoch").slot("request.offer").value()));
            }
            offer.request_id = Some(request.request_id.clone());
            match request.decision {
                ConsultDecision::Decline => offer.state = ConsultState::Declined,
                ConsultDecision::Accept => {
                    if !write.coordinating || write.consult_situation.is_none() {
                        return Err(Error::Invalid("consult acceptance requires retained intent and payload".into()));
                    }
                    offer.state = ConsultState::Accepted;
                    offer.situation = write.consult_situation.clone();
                }
            }
        }
        Apply::Resolve { request } => {
            text(&request.resolution)?; text(&request.reproduction.test)?; text(&request.reproduction.result)?;
            if record.review.as_ref().is_some_and(|review| review.fire.is_some() && !review.settled) {
                record.version = record.version.checked_add(1).ok_or_else(|| Error::Invalid("debug version exhausted".into()))?;
                return Ok(Ok(record));
            }
            if request.reproduction.passed {
                record.status = Status::Resolved;
                record.resolution = Some(Resolution { description: request.resolution.clone(), reproduction: request.reproduction.clone() });
            } else {
                record.attempts.push(Attempt { description: request.resolution.clone(),
                    result: format!("{}: {}", request.reproduction.test, request.reproduction.result) });
            }
        }
    }
    record.attempt_count = record.attempts.len() as u64;
    if let Some(policy) = &write.consult_policy
        && record.status == Status::Open
        && !matches!(write.apply, Apply::Consult { .. })
        && !record.consults.iter().any(|offer| offer.epoch == record.epoch)
        && (record.attempt_count >= policy.threshold || (!record.hypotheses.is_empty()
            && record.hypotheses.iter().all(|h| h.state == HypothesisState::Refuted))) {
        let id = format!("consult-{}-{}", record.slug, record.epoch);
        record.consults.push(Consult { id, epoch: record.epoch, offered_by: write.apply.identity().0.into(),
            provider: policy.provider.clone(), model: policy.model.clone(), effort: policy.effort.clone(),
            state: ConsultState::Offered, request_id: None, situation: None, angles: vec![], evidence: None, failure: None });
    }
    record.version = record.version.checked_add(1).ok_or_else(|| Error::Invalid("debug version exhausted".into()))?;
    Ok(Ok(record))
}
pub fn contribute(data: &Value, write: &Write) -> Result<Value> {
    let (id, _, _) = write.apply.identity();
    crate::milestone::model::name(id)?;
    if write.root_binding.is_empty() || replay(data, write)?.is_some() { return Err(Error::Invalid("debug write requires a new root-bound request".into())); }
    let mut saved = namespace(data)?;
    let response = match outcome(data, write) {
        Ok(record) => {
            let response = response(&record, write);
            saved.records.insert(record.slug.clone(), record);
            response
        }
        Err(refusal) => refusal,
    };
    if write.coordinating {
        saved.pending_requests.insert(id.into(), write.apply.clone());
    } else {
        saved.pending_requests.remove(id);
        saved.requests.insert(id.into(), Receipt { root_binding: write.root_binding.clone(), apply: write.apply.clone(), answer: response });
    }
    let mut next = data.clone();
    next["debug"] = serde_json::to_value(saved)?;
    Ok(next)
}

pub fn response(record: &Record, write: &Write) -> Value {
    if !write.coordinating && matches!(write.apply, Apply::Resolve { .. })
        && let Some(review) = record.review.as_ref().filter(|review| !review.settled)
        && let Some(fire) = review.fire.as_ref() {
        return Refusal::new("debug-review-pending", format!("debug resolve waits for risk fire {fire}"))
            .slot("fire").details(json!({"slug":record.slug,"fire":fire,"pending_fires":review.pending_fires,"record":record})).value();
    }
    answer(record)
}

pub fn outcome(data: &Value, write: &Write) -> std::result::Result<Record, Value> {
    transition(data, write).unwrap_or_else(|error| Err(Refusal::new("debug-invalid", error.to_string())
        .slot("request").details(json!({"slug":write.apply.identity().1})).value()))
}

fn finish_consult(mut record: Record, write: &Write, saved: &Namespace) -> Result<std::result::Result<Record, Value>> {
    let Apply::Consult { request } = &write.apply else { return Err(Error::Invalid("consult result requires acceptance".into())); };
    if saved.pending_requests.get(&request.request_id) != Some(&write.apply) {
        return Err(Error::Invalid("consult result requires exact accepted intent".into()));
    }
    let offer = record.consults.iter_mut().find(|o| o.id == request.offer && o.epoch == request.epoch
        && o.state == ConsultState::Accepted && o.request_id.as_ref() == Some(&request.request_id))
        .ok_or_else(|| Error::Invalid("consult result has no accepted offer".into()))?;
    let result = write.consult_result.as_ref().unwrap();
    offer.angles = result.angles.clone(); offer.evidence = result.evidence.clone(); offer.failure = result.failure.clone();
    offer.state = if result.failure.is_some() { ConsultState::Failed } else { ConsultState::Completed };
    record.version = record.version.checked_add(1).ok_or_else(|| Error::Invalid("debug version exhausted".into()))?;
    Ok(Ok(record))
}
