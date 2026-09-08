use super::{
    Layer, merge,
    reload::Generation,
    roles::ROLES,
    schema,
    write::{Update, validate_update},
};
use cadence::store::{Error, Result, model::digest};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;

pub const FLOOR: &str = "review.triggers.risk_surface.waive_routing_floor";

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum Mode {
    Roles,
    Global,
    NewProject,
    Adopt,
    Suggestion,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Input {
    pub identity: PathBuf,
    pub content: Option<String>,
    pub stamp: Option<(u64, u64, u32)>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Captured {
    pub repo: Input,
    pub global: Option<Input>,
    pub global_alias: bool,
}

impl Captured {
    pub fn from_generation(generation: &Generation) -> Self {
        let capture = |input: &super::reload::Input| Input {
            identity: input.identity.clone(),
            content: input.bytes.as_deref().map(digest),
            stamp: input.stamp,
        };
        Self {
            repo: capture(&generation.repo),
            global: generation.global.as_ref().map(capture),
            global_alias: generation.effective.global_intent,
        }
    }

    pub fn validate(&self, generation: &Generation) -> Result<()> {
        if *self != Self::from_generation(generation) {
            return Err(Error::Conflict("interview config inputs changed".into()));
        }
        Ok(())
    }
}

#[derive(Debug, PartialEq, Serialize, JsonSchema)]
pub struct Subject {
    pub key: String,
    pub purpose: String,
    pub explanation: String,
    pub current: Value,
    pub default: Value,
    pub source: String,
    pub stored_global: Option<Value>,
    pub stored_repo: Option<Value>,
    pub present_global: bool,
    pub present_repo: bool,
    pub constraints: Value,
}

#[derive(Debug, PartialEq, Serialize, JsonSchema)]
pub struct Prepared {
    pub mode: Mode,
    pub first_run: bool,
    pub stored_role_leaves: Vec<String>,
    pub target: Layer,
    pub captured: Captured,
    pub subjects: Vec<Subject>,
}

pub fn prepare(generation: &Generation, mode: Mode) -> Prepared {
    let effective = &generation.effective;
    let global = if effective.global_intent {
        &effective.raw_repo
    } else {
        &effective.raw_global
    };
    let first_run = global.as_ref().and_then(|v| v.get("roles")).is_none();
    let target = if first_run || mode == Mode::Global {
        Layer::Global
    } else {
        Layer::Repo
    };
    let global_values = merge::merge(global.clone(), None, false);
    let shown = if mode == Mode::Global && !effective.global_intent {
        &global_values
    } else {
        effective
    };
    let mut subjects = Vec::new();
    let mut stored_role_leaves = Vec::new();
    for (role, purpose) in ROLES.into_iter().zip([
        "Plan implementation tasks",
        "Analyze assumptions before planning",
        "Verify completed work",
        "Review changes",
        "Implement planned tasks",
        "Check plans before execution",
    ]) {
        for leaf in ["model", "effort"] {
            let key = format!("roles.{role}.{leaf}");
            if global.as_ref().and_then(|v| merge::get(v, &key)).is_some() {
                stored_role_leaves.push(key.clone());
            }
            subjects.push((key, purpose, if leaf == "model" {
                "Model choice affects cost and capability; null inherits the session and cancels an older model pin. Custom model text is stored verbatim; compatibility is resolved at dispatch."
            } else {
                "The starting rung controls requested reasoning effort and cost; higher rungs can cost more. Null selects the role schema default and cancels an older effort pin. Requested effort is not observed effort."
            }));
        }
    }
    subjects.push((FLOOR.into(), "Choose plan-time risk-floor protection", "Keep it for every surface means an explicit empty array []; waivers affect only the plan-time floor, not actual-diff surface selection. A repo waiver can shadow a global answer."));
    Prepared {
        mode,
        first_run,
        stored_role_leaves,
        target,
        captured: Captured::from_generation(generation),
        subjects: subjects
            .into_iter()
            .map(|(key, purpose, explanation)| {
                let spec = &schema()[&key];
                let stored_global = effective
                    .raw_global
                    .as_ref()
                    .and_then(|v| merge::get(v, &key))
                    .cloned();
                let stored_repo = effective
                    .raw_repo
                    .as_ref()
                    .and_then(|v| merge::get(v, &key))
                    .cloned();
                Subject {
                    current: merge::get(&shown.values, &key)
                        .cloned()
                        .unwrap_or(Value::Null),
                    default: spec["default"].clone(),
                    source: match shown.sources.get(&key) {
                        Some(Layer::Repo) => "repo",
                        Some(Layer::Global) => "global",
                        None => "defaults",
                    }
                    .into(),
                    present_global: stored_global.is_some(),
                    present_repo: stored_repo.is_some(),
                    stored_global,
                    stored_repo,
                    constraints: spec.clone(),
                    key,
                    purpose: purpose.into(),
                    explanation: explanation.into(),
                }
            })
            .collect(),
    }
}

pub fn answers(
    generation: &Generation,
    mode: Mode,
    captured: &Captured,
    accepted: bool,
    values: Option<&[Update]>,
) -> Result<(Layer, Vec<Update>)> {
    let prepared = prepare(generation, mode);
    if !accepted || values.is_none() {
        return Ok((prepared.target, vec![]));
    }
    captured.validate(generation)?;
    let values = values.unwrap();
    if values.len() != 13
        || values
            .iter()
            .zip(&prepared.subjects)
            .any(|(answer, subject)| answer.key != subject.key)
    {
        return Err(Error::Invalid(
            "interview requires exactly thirteen ordered answers".into(),
        ));
    }
    let selected_raw = match prepared.target {
        Layer::Global if !generation.effective.global_intent => &generation.effective.raw_global,
        _ => &generation.effective.raw_repo,
    };
    let mut updates = Vec::new();
    for (answer, subject) in values.iter().zip(&prepared.subjects) {
        validate_update(prepared.target, &answer.key, &answer.value)?;
        let empty_pin = answer.key == FLOOR
            && answer.value.as_array().is_some_and(Vec::is_empty)
            && selected_raw.as_ref().and_then(|raw| merge::get(raw, FLOOR)) != Some(&answer.value);
        if prepared.first_run
            || mode == Mode::Global
            || answer.value != subject.current
            || empty_pin
        {
            updates.push(answer.clone());
        }
    }
    Ok((prepared.target, updates))
}

#[derive(Clone, Debug, PartialEq, Serialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Entry {
    Knobs,
    Roles { mode: Mode },
    Surfaces,
    ReviewUnavailable { reason: String },
    Values { layer: Layer, updates: Vec<Update> },
}

pub fn entry(tokens: &[String]) -> Result<Entry> {
    let words = tokens.iter().map(String::as_str).collect::<Vec<_>>();
    match words.as_slice() {
        [] => return Ok(Entry::Knobs),
        ["--roles"] => return Ok(Entry::Roles { mode: Mode::Roles }),
        ["--roles", "--global"] => return Ok(Entry::Roles { mode: Mode::Global }),
        ["--surfaces"] => return Ok(Entry::Surfaces),
        ["--review"] | ["--review", "redetect"] => {
            return Ok(Entry::ReviewUnavailable {
                reason:
                    "Native live-provider setup is unavailable until the review-delivery phase."
                        .into(),
            });
        }
        _ => (),
    }
    let (layer, tokens) = if words.first() == Some(&"--global") {
        (Layer::Global, &words[1..])
    } else {
        (Layer::Repo, words.as_slice())
    };
    if tokens.is_empty() {
        return Err(Error::Invalid(
            "config entry requires key=value tokens".into(),
        ));
    }
    let mut updates = Vec::new();
    for token in tokens {
        let (key, text) = token
            .split_once('=')
            .ok_or_else(|| Error::Invalid("config entry requires key=value tokens".into()))?;
        let spec = schema()
            .get(key)
            .ok_or_else(|| Error::Invalid(format!("unknown config key {key}")))?;
        let value = if text == "null" {
            Value::Null
        } else if matches!(spec["type"].as_str(), Some("string" | "string_or_null"))
            || (spec["type"] == "enum"
                && spec["values"]
                    .as_array()
                    .is_some_and(|allowed| allowed.contains(&Value::String(text.into()))))
        {
            Value::String(text.into())
        } else {
            serde_json::from_str(text)
                .map_err(|_| Error::Invalid(format!("invalid value for {key}")))?
        };
        validate_update(layer, key, &value)?;
        updates.push(Update {
            key: key.into(),
            value,
        });
    }
    super::write::prepare_batch(layer, &serde_json::json!({}), &updates)?;
    Ok(Entry::Values { layer, updates })
}
