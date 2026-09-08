use super::{Effective, Layer, merge, reload::validate_effective, schema};
use cadence::{rail::risk, store::Result};
use schemars::JsonSchema;
use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum SurfaceAnswer {
    Unanswered,
    Invalid { reason: String },
    Answered { categories: Vec<String> },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, JsonSchema)]
pub struct Trigger {
    pub gate: String,
    pub gate_source: Option<Layer>,
    pub reviewers: Vec<String>,
    pub tier: String,
    pub effort: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, JsonSchema)]
pub struct Policy {
    pub mode: String,
    pub triggers: BTreeMap<String, Trigger>,
    pub surfaces: SurfaceAnswer,
    pub floor_categories: Vec<String>,
    pub waived_categories: Vec<String>,
    pub reasons: Vec<String>,
    pub diagnostics: Vec<String>,
}

pub fn resolve(effective: &Effective) -> Result<Policy> {
    validate_effective(effective)?;
    let get = |key: &str| merge::get(&effective.values, key).unwrap_or(&Value::Null);
    let string = |key: &str| get(key).as_str().unwrap_or_default().to_owned();
    let list = |key: &str| -> Vec<String> {
        get(key)
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
            .map(str::to_owned)
            .collect()
    };
    let surfaces = match risk::configured_surfaces(get("review.triggers.risk_surface.surfaces")) {
        Ok(None) => SurfaceAnswer::Unanswered,
        Ok(Some(categories)) => SurfaceAnswer::Answered { categories },
        Err(error) => SurfaceAnswer::Invalid {
            reason: error.to_string(),
        },
    };
    let floor_categories = match &surfaces {
        SurfaceAnswer::Answered { categories } => categories.clone(),
        _ => risk::CATEGORIES
            .iter()
            .map(|category| (*category).into())
            .collect(),
    };
    let mut policy = Policy {
        mode: string("review.mode"), triggers: BTreeMap::new(), surfaces, floor_categories,
        waived_categories: list("review.triggers.risk_surface.waive_routing_floor"),
        reasons: vec!["Reviewer eligibility uses configured model IDs only; no provider availability or review execution is observed.".into()],
        diagnostics: vec![],
    };
    for (key, spec) in schema() {
        let Some(trigger) = key
            .strip_prefix("review.triggers.")
            .and_then(|key| key.strip_suffix(".gate"))
        else {
            continue;
        };
        if spec["disposition"] == "dead" {
            continue;
        }
        let tier = string(&format!("review.triggers.{trigger}.tier"));
        let mut reviewers = vec![];
        for reviewer in list("review.reviewers") {
            let setting = format!("review.providers.{reviewer}.tiers.{tier}");
            if reviewer == "claude-subagent"
                || get(&setting)
                    .as_str()
                    .is_some_and(|model| !model.trim().is_empty())
            {
                reviewers.push(reviewer);
            } else {
                policy.diagnostics.push(format!("{trigger}: dropped {reviewer}; {setting} has no nonblank model ID at tier {tier}"));
            }
        }
        if reviewers.is_empty() {
            reviewers.push("claude-subagent".into());
            policy.reasons.push(format!("{trigger}: no configured reviewer qualifies at tier {tier}; falling back to claude-subagent"));
        }
        policy.triggers.insert(
            trigger.into(),
            Trigger {
                gate: string(key),
                gate_source: effective.sources.get(key).copied(),
                reviewers,
                tier,
                effort: string(&format!("review.triggers.{trigger}.effort")),
            },
        );
    }
    Ok(policy)
}
