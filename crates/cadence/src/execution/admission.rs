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
