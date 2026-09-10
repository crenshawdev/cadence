//! Native admission validates approved authority and installed bytes together.
use super::{allocation, model::ExecutionPlan};
use crate::{plan::{self, associations::Contribution, map_history::Revision}, store::{Error, Result, model::digest}};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Binding {
    pub plan: u32,
    pub publication_request: String,
    pub content_revision: String,
    pub map_revision: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Contract {
    pub phase: u32,
    pub occurrence: String,
    pub plans: Vec<Binding>,
    pub allocation: Vec<allocation::Assignment>,
}

#[derive(Clone, Debug)]
pub struct Validated {
    pub plans: Vec<ExecutionPlan>,
    pub maps: Vec<Revision>,
}

pub const NAMESPACE: &str = "native_admissions";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub request_id: String,
    pub expected_set_version: u64,
    pub contract: Contract,
}

/// Each extension retains the complete approved union it validated. Original
/// records and receipts are never rewritten when the current set advances.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Record {
    pub schema: String,
    pub root_binding: String,
    pub set_version: u64,
    pub request_digest: String,
    pub request: Request,
}

pub fn records(data: &Value, phase: u32) -> Result<Vec<Record>> {
    let Some(namespace) = data.get(NAMESPACE) else {return Ok(vec![])};
    if namespace["schema"] != "native-admissions-1" {return Err(refuse(phase,"admission-schema",NAMESPACE,"","unsupported native admission namespace"));}
    namespace["phases"].get(phase.to_string()).cloned().map(serde_json::from_value).transpose()
        .map(|records|records.unwrap_or_default()).map_err(Error::from)
}

pub fn request_digest(request: &Request) -> Result<String> {
    Ok(digest(&super::boundary::canonical_bytes(request).map_err(|e|Error::Invalid(e.to_string()))?))
}

pub fn replay(data: &Value, root_binding: &str, request: &Request) -> Result<Option<Record>> {
    let records=records(data,request.contract.phase)?;
    if let Some(record)=records.iter().find(|r|r.request.request_id==request.request_id) {
        if record.root_binding!=root_binding || record.request_digest!=request_digest(request)? || record.request!=*request {
            return Err(refuse(request.contract.phase,"admission-request-reuse","request_id",&request.request_id,"request identity already names another payload or root"));
        }
        return Ok(Some(record.clone()));
    }
    Ok(None)
}

pub fn contribute(data: &Value, documents: &BTreeMap<String,String>, root_binding: &str, request: &Request) -> Result<(Value,Record)> {
    if let Some(record)=replay(data,root_binding,request)? {return Ok((data.clone(),record))}
    let phase=request.contract.phase;
    if request.request_id.trim().is_empty() || root_binding.is_empty() {
        return Err(refuse(phase,"admission-request","request_id",&request.request_id,"request and bound root required"));
    }
    let mut prior=records(data,phase)?;
    let version=prior.last().map_or(0,|r|r.set_version);
    if request.expected_set_version!=version {
        return Err(refuse(phase,"admission-set-version","expected_set_version",&request.request_id,format!("expected current set version {version}")));
    }
    validate(data,documents,&request.contract)?;
    if let Some(old)=prior.last() {
        if old.root_binding!=root_binding || old.request.contract.occurrence!=request.contract.occurrence {
            return Err(refuse(phase,"admission-occurrence","contract.occurrence","","extension must retain the same bound root and occurrence"));
        }
        for binding in &old.request.contract.plans {
            if !request.contract.plans.contains(binding) {
                return Err(refuse(phase,"admitted-plan","contract.plans",&binding.plan.to_string(),"extension must preserve each admitted publication identity and exact authority"));
            }
        }
        for assignment in &old.request.contract.allocation {
            if !request.contract.allocation.contains(assignment) {
                return Err(refuse(phase,"admission-reassignment","contract.allocation",&assignment.task,"extension cannot move or rewrite an existing task/check owner"));
            }
        }
        if request.contract.plans.len()<=old.request.contract.plans.len() {
            return Err(refuse(phase,"admission-extension","contract.plans","","extension requires a new approved gap identity"));
        }
    }
    let record=Record {schema:"native-admission-1".into(),root_binding:root_binding.into(),
        set_version:version.checked_add(1).ok_or_else(||refuse(phase,"admission-set-version","expected_set_version","","set version exhausted"))?,
        request_digest:request_digest(request)?,request:request.clone()};
    prior.push(record.clone());
    let mut proposed=data.clone();
    let namespace=proposed.as_object_mut().ok_or_else(||Error::Invalid("snapshot must be an object".into()))?
        .entry(NAMESPACE).or_insert_with(||serde_json::json!({"schema":"native-admissions-1","phases":{}}));
    namespace["phases"][phase.to_string()]=serde_json::to_value(prior)?;
    Ok((proposed,record))
}

pub fn decision(record:&Record) -> Result<crate::store::model::DecisionRecord> {
    use crate::store::model::{DecisionRecord,Decision,Origin,Evidence};
    Ok(DecisionRecord {version:1,id:format!("native-admission:{}:{}:{}",record.request.contract.phase,record.set_version,record.request_digest),
        revision:1,origin:Origin {source:"native-admission-1".into(),original:Evidence::Missing},
        decision:Decision::Gate {outcome:"native-admission-1".into(),evidence:Evidence::Text(serde_json::to_string(record)?)} })
}

pub fn refuse(phase: u32, rule: &str, slot: &str, id: &str, reason: impl Into<String>) -> Error {
    plan::model::Diagnostic { rule: rule.into(), slot: slot.into(), phase: Some(phase),
        entry: None, id: (!id.is_empty()).then(|| id.into()), reason: reason.into(), details: None }.error()
}

/// Inspect schema positions before serde discards their location. Domain
/// checks still compare every positive identity and revision to authority.
pub fn decode(raw: Value) -> Result<Contract> {
    let phase = raw["phase"].as_u64().and_then(|n| u32::try_from(n).ok()).unwrap_or(0);
    let shape = |slot: &str, id: &str| refuse(phase, "admission-shape", slot, id, "missing or malformed typed execution contract field");
    if !raw.is_object() { return Err(shape("contract", "")); }
    for field in ["phase", "occurrence", "plans", "allocation"] {
        let valid = match field {
            "phase" => raw[field].as_u64().is_some_and(|n| u32::try_from(n).is_ok()),
            "occurrence" => raw[field].is_string(),
            _ => raw[field].is_array(),
        };
        if !valid { return Err(shape(&format!("contract.{field}"), "")); }
    }
    for (index, binding) in raw["plans"].as_array().expect("array").iter().enumerate() {
        for field in ["plan", "publication_request", "content_revision", "map_revision"] {
            let valid = if field == "plan" { binding[field].as_u64().is_some_and(|n| u32::try_from(n).is_ok()) }
                else { binding[field].is_string() };
            if !valid { return Err(shape(&format!("contract.plans[{index}].{field}"), &binding["plan"].to_string())); }
        }
    }
    for (index, assignment) in raw["allocation"].as_array().expect("array").iter().enumerate() {
        let task = assignment["task"].as_str().unwrap_or("");
        for field in ["plan", "task", "checks"] {
            let valid = match field {
                "plan" => assignment[field].as_u64().is_some_and(|n| u32::try_from(n).is_ok()),
                "task" => assignment[field].is_string(), _ => assignment[field].is_array(),
            };
            if !valid { return Err(shape(&format!("contract.allocation[{index}].{field}"), task)); }
        }
        for (n, check) in assignment["checks"].as_array().expect("array").iter().enumerate() {
            for field in ["id", "item_revision"] {
                if !check[field].is_string() {
                    return Err(shape(&format!("contract.allocation[{index}].checks[{n}].{field}"), check["id"].as_str().unwrap_or(task)));
                }
            }
        }
    }
    serde_json::from_value(raw).map_err(|_| shape("contract", ""))
}

/// `documents` is the checked installed PLAN inventory from the same bound
/// root; writers reobserve it before confirmation. No test is run or required
/// to exist, and no execution receipt or style preset participates here.
pub fn validate(data: &Value, documents: &BTreeMap<String, String>, contract: &Contract) -> Result<Validated> {
    let phase = contract.phase;
    if phase == 0 { return Err(refuse(phase, "admission-identity", "contract.phase", "", "phase must be positive")); }
    let context = crate::context::persistence::saved(data, phase)?
        .ok_or_else(|| refuse(phase, "native-approved-truths", "context", "", "native approved truths and retained slots required"))?;
    if context.truths.is_empty() || context.submission.phase.get() != phase
        || crate::context::validation::validate(&serde_json::json!({"submission":context.submission})).is_some()
        || !crate::context::persistence::approved(context.submission.clone(), context.approval.clone())
            .is_ok_and(|approved| approved == context)
    {
        return Err(refuse(phase, "native-approved-truths", "context.approval", "", "nonempty approved versioned truths must equal their retained slots"));
    }
    let current = plan::persistence::saved(data, phase)?
        .ok_or_else(|| refuse(phase, "publication-authority", "contract.plans", "", "native current publication set required"))?;
    if current.id != contract.occurrence {
        return Err(refuse(phase, "admission-occurrence", "contract.occurrence", "", "requested publication occurrence is stale"));
    }
    // Legacy projections cannot be silently omitted from the authoritative set.
    for path in documents.keys() {
        if path.starts_with(&format!("phases/{phase}/PLAN"))
            && !current.publications.keys().any(|n| path == &format!("phases/{phase}/PLAN-{n}.md"))
        {
            return Err(refuse(phase, "mixed-plan-set", path, path, "unretained legacy PLAN alongside native publications"));
        }
    }
    let mut seen = BTreeSet::new();
    for (index, binding) in contract.plans.iter().enumerate() {
        let slot = format!("contract.plans[{index}]");
        if binding.plan == 0 || !seen.insert(binding.plan) || !current.publications.contains_key(&binding.plan) {
            return Err(refuse(phase, "admission-plan", &format!("{slot}.plan"), &binding.plan.to_string(), "unknown or repeated plan identity"));
        }
        let publication = &current.publications[&binding.plan];
        let request = publication.approval.submission.as_ref().map(|s| s.request_id.as_str());
        for (field, matches) in [
            ("publication_request", Some(binding.publication_request.as_str()) == request),
            ("content_revision", binding.content_revision == publication.revision),
            ("map_revision", Some(&binding.map_revision) == publication.map_revision.as_ref()),
        ] {
            if !matches { return Err(refuse(phase, "admission-binding", &format!("{slot}.{field}"), &binding.plan.to_string(), "requested authority differs from current publication")); }
        }
    }
    if current.publications.is_empty() || seen.len() != current.publications.len() {
        return Err(refuse(phase, "admission-plan-set", "contract.plans", "", "admission must cover the whole current phase union"));
    }
    let mut plans = Vec::new();
    let mut maps = Vec::new();
    let mut contributions = Vec::new();
    for (number, publication) in &current.publications {
        plan::persistence::validate_retained(data, phase, publication)?;
        let map = plan::map_view::checked_map(data, phase, publication)?;
        let path = format!("phases/{phase}/PLAN-{number}.md");
        let bytes = documents.get(&path).ok_or_else(|| refuse(phase, "installed-plan", &path, &number.to_string(), "installed PLAN is missing"))?;
        if digest(bytes.as_bytes()) != publication.revision {
            return Err(refuse(phase, "installed-plan", &path, &number.to_string(), "installed PLAN bytes drifted from approved content revision"));
        }
        let parsed = super::plan::parse_plan(bytes.as_bytes(), phase, *number)
            .map_err(|e| refuse(phase, "execution-structure", &path, &number.to_string(), e.to_string()))?;
        contributions.push(Contribution { plan: *number, entry: None, items: map.items.clone() });
        maps.push(map);
        plans.push(parsed);
    }
    plan::associations::validate_union(&context, phase, &contributions, true)?;
    allocation::validate(phase, &plans, &maps, &contract.allocation)?;
    Ok(Validated { plans, maps })
}
