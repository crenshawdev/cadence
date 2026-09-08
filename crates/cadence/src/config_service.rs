use crate::{
    config::{
        self, Layer, merge,
        reload::{ConfigIo, Generation},
        roles,
        write::Update,
    },
    import::SessionFactory,
};
use cadence::{
    envelope::Envelope,
    store::{Error, Result},
};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum Apply {
    #[serde(rename = "config-apply")]
    Batch { layer: Layer, updates: Vec<Update> },
}

#[derive(Clone, Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct RouteRequest {
    pub role: String,
    pub phase: Option<std::num::NonZeroU32>,
    pub plan: Option<std::num::NonZeroU32>,
    pub attempt: Option<std::num::NonZeroU32>,
}

pub enum Command {
    Facts,
    Route(RouteRequest),
    Apply(Apply),
}

#[derive(Debug, PartialEq, Serialize, JsonSchema)]
pub struct Fact {
    pub key: String,
    pub schema: Value,
    pub stored_global: Option<Value>,
    pub stored_repo: Option<Value>,
    pub present_global: bool,
    pub present_repo: bool,
    pub effective: Value,
    pub source: String,
    pub writable_layers: Vec<Layer>,
}

#[derive(Serialize, JsonSchema)]
pub struct Facts {
    pub keys: Vec<Fact>,
    pub global: Option<PathBuf>,
    pub repo: PathBuf,
    pub global_alias: bool,
    pub diagnostics: config::Diagnostics,
}

#[derive(Serialize, JsonSchema)]
#[serde(tag = "operation")]
pub enum Output {
    #[serde(rename = "route")]
    Route { route: Box<roles::Resolution> },
    #[serde(rename = "config-facts")]
    Facts { facts: Facts },
    #[serde(rename = "config-apply")]
    Applied {
        changed_keys: Vec<String>,
        destination: PathBuf,
        requested_layer: Layer,
        facts: Facts,
    },
}

pub type Answer = Result<Envelope<Output>>;

pub fn facts(generation: &Generation) -> Facts {
    let effective = &generation.effective;
    Facts {
        keys: config::schema()
            .iter()
            .filter(|(_, spec)| spec["disposition"] != "dead")
            .map(|(key, spec)| {
                let stored_global = effective
                    .raw_global
                    .as_ref()
                    .and_then(|raw| merge::get(raw, key))
                    .cloned();
                let stored_repo = effective
                    .raw_repo
                    .as_ref()
                    .and_then(|raw| merge::get(raw, key))
                    .cloned();
                Fact {
                    key: key.clone(),
                    schema: spec.clone(),
                    present_global: stored_global.is_some(),
                    present_repo: stored_repo.is_some(),
                    stored_global,
                    stored_repo,
                    effective: merge::get(&effective.values, key)
                        .cloned()
                        .unwrap_or(Value::Null),
                    source: match effective.sources.get(key) {
                        Some(Layer::Global) => "global",
                        Some(Layer::Repo) => "repo",
                        None => "defaults",
                    }
                    .into(),
                    writable_layers: [Layer::Global, Layer::Repo]
                        .into_iter()
                        .filter(|layer| {
                            !(*layer == Layer::Global && spec["repo_only"] == true
                                || *layer == Layer::Repo
                                    && config::GLOBAL_ONLY.contains(&key.as_str()))
                        })
                        .collect(),
                }
            })
            .collect(),
        global: generation
            .global
            .as_ref()
            .map(|input| input.identity.clone())
            .or_else(|| {
                effective
                    .global_intent
                    .then(|| generation.repo.identity.clone())
            }),
        repo: generation.repo.identity.clone(),
        global_alias: effective.global_intent,
        diagnostics: effective.diagnostics.clone(),
    }
}

pub fn refused(code: &str, reason: impl Into<String>) -> Envelope<Output> {
    Envelope::Refused {
        code: code.into(),
        reason: reason.into(),
    }
}

pub async fn execute<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    root: &Path,
    command: Command,
) -> Answer {
    let unavailable = |error: &dyn std::fmt::Display| {
        let paths = factory
            .active_config_paths(root)
            .map(|paths| {
                format!(
                    "repo: {}; global: {}",
                    paths.repo.display(),
                    paths
                        .global
                        .map_or_else(|| "unavailable".into(), |path| path.display().to_string())
                )
            })
            .unwrap_or_else(|failure| failure.to_string());
        refused(
            "config-unavailable",
            format!(
                "{error}; active layers ({paths}); repair the named active file before retrying"
            ),
        )
    };
    let session = match factory.first_touch(root).await {
        Ok(session) => session,
        Err(error) => return Ok(unavailable(&error)),
    };
    let result = match command {
        Command::Route(request) => {
            let generation = match session.config() {
                Ok(generation) => generation,
                Err(error) => return Ok(unavailable(&error)),
            };
            return Ok(match resolve_role(&generation, &request) {
                Ok(route) => Envelope::Ok(Output::Route {
                    route: Box::new(route),
                }),
                Err(Error::Invalid(reason)) => refused("invalid-route", reason),
                Err(error) => unavailable(&error),
            });
        }
        Command::Facts => {
            return Ok(match session.config() {
                Ok(generation) => Envelope::Ok(Output::Facts {
                    facts: facts(&generation),
                }),
                Err(error) => unavailable(&error),
            });
        }
        Command::Apply(Apply::Batch { layer, updates }) => {
            match session.batch_config(layer, &updates).await {
                Ok(written) => session.config().map(|generation| Output::Applied {
                    changed_keys: written.changed_keys,
                    destination: written.destination,
                    requested_layer: written.requested_layer,
                    facts: facts(&generation),
                }),
                Err(error) => Err(error),
            }
        }
    };
    match result {
        Ok(output) => Ok(Envelope::Ok(output)),
        Err(Error::Invalid(reason)) => Ok(refused("invalid-config", reason)),
        Err(Error::Conflict(reason)) => Ok(refused("config-conflict", reason)),
        Err(Error::Policy(reason)) => Ok(unavailable(&reason)),
        Err(error) => Err(error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{Diagnostics, Effective, reload::Input};
    use serde_json::json;

    #[test]
    fn facts_returns_literal_presence_and_default_source_from_supplied_generation() {
        let generation = Generation {
            number: 1,
            global: None,
            repo: Input {
                identity: "/project/.planning/config.v4.json".into(),
                bytes: None,
                stamp: None,
            },
            effective: Effective {
                raw_global: None,
                raw_repo: Some(json!({"roles":{"cad-executor":{"model":null}}})),
                global: json!({}),
                repo: json!({"roles":{"cad-executor":{"model":null}}}),
                values: json!({"roles":{"cad-executor":{"model":null,"effort":"high"}}}),
                sources: [("roles.cad-executor.model".into(), Layer::Repo)].into(),
                global_intent: false,
                diagnostics: Diagnostics::default(),
            },
        };
        let result = facts(&generation);
        let model = result
            .keys
            .iter()
            .find(|fact| fact.key == "roles.cad-executor.model")
            .unwrap();
        assert_eq!(
            (
                model.present_global,
                model.present_repo,
                model.stored_repo.clone(),
                model.effective.clone(),
                model.source.as_str()
            ),
            (false, true, Some(Value::Null), Value::Null, "repo")
        );
        let effort = result
            .keys
            .iter()
            .find(|fact| fact.key == "roles.cad-executor.effort")
            .unwrap();
        assert_eq!(
            (
                effort.present_global,
                effort.present_repo,
                effort.effective.clone(),
                effort.source.as_str()
            ),
            (false, false, json!("high"), "defaults")
        );
    }
}

pub fn role_input(generation: &Generation, request: &RouteRequest) -> Result<roles::Input> {
    if !roles::ROLES.contains(&request.role.as_str()) {
        return Err(Error::Invalid("unknown routing role".into()));
    }
    let effective = &generation.effective;
    let stored = |key: String| {
        let layer = effective.sources.get(&key)?;
        let value = merge::get(
            match layer {
                Layer::Global => &effective.global,
                Layer::Repo => &effective.repo,
            },
            &key,
        )?
        .clone();
        Some(roles::Stored {
            key,
            layer: match layer {
                Layer::Global => "global",
                Layer::Repo => "repo",
            }
            .into(),
            value,
        })
    };
    let effort_key = format!("roles.{}.effort", request.role);
    Ok(roles::Input {
        role: request.role.clone(),
        phase: request.phase.map(|value| value.get()),
        plan: request.plan.map(|value| value.get()),
        attempt: request.attempt.map_or(1, |value| value.get()),
        default_effort: config::schema()[&effort_key]["default"]
            .as_str()
            .ok_or_else(|| Error::Policy("role effort default unavailable".into()))?
            .into(),
        role_effort: stored(effort_key),
        legacy_effort: stored(format!("model.effort.{}", request.role)),
        role_model: stored(format!("roles.{}.model", request.role)),
        legacy_model: stored(format!("model.overrides.{}", request.role)),
        escalate_on_failure: merge::get(&effective.values, "model.escalate_on_failure")
            .and_then(Value::as_bool)
            .ok_or_else(|| Error::Policy("retry policy unavailable".into()))?,
    })
}

pub fn resolve_role(generation: &Generation, request: &RouteRequest) -> Result<roles::Resolution> {
    roles::resolve(&role_input(generation, request)?)
}

#[cfg(test)]
mod routing_inputs_tests {
    use super::*;
    use crate::config::{Diagnostics, Effective, reload::Input};
    use serde_json::json;

    fn generation() -> Generation {
        Generation {
            number: 1,
            global: None,
            repo: Input {
                identity: "/project/.planning/config.v4.json".into(),
                bytes: None,
                stamp: None,
            },
            effective: Effective {
                raw_global: None,
                raw_repo: None,
                global: json!({}),
                repo: json!({}),
                values: json!({"model":{"escalate_on_failure":false},"roles":{"cad-executor":{"model":null,"effort":"high"}}}),
                sources: Default::default(),
                global_intent: false,
                diagnostics: Diagnostics::default(),
            },
        }
    }

    #[test]
    fn routing_inputs_captures_resolved_identities_and_exact_byte_digests() {
        let mut supplied = generation();
        supplied.repo.bytes = Some(b"{}".to_vec());
        supplied.repo.stamp = Some((11, 22, 33));
        supplied.global = Some(Input {
            identity: "/global/config.v4.json".into(),
            bytes: Some(Vec::new()),
            stamp: None,
        });
        supplied.effective.global_intent = true;
        assert_eq!(
            routing_inputs(&supplied),
            cadence::execution::model::ConfigInputs {
                repo: cadence::execution::model::ConfigInput {
                    identity: "/project/.planning/config.v4.json".into(),
                    content: Some(
                        "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a".into()
                    ),
                    stamp: Some((11, 22, 33)),
                },
                global: Some(cadence::execution::model::ConfigInput {
                    identity: "/global/config.v4.json".into(),
                    content: Some(
                        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855".into()
                    ),
                    stamp: None,
                }),
                global_alias: true,
            }
        );
    }

    #[test]
    fn role_input_reads_six_schema_defaults_without_treating_effective_values_as_stored() {
        for (role, effort) in [
            ("cad-planner", "high"),
            ("cad-assumptions-analyzer", "high"),
            ("cad-verifier", "high"),
            ("cad-reviewer", "medium"),
            ("cad-executor", "high"),
            ("cad-plan-checker", "low"),
        ] {
            let request = RouteRequest {
                role: role.into(),
                phase: None,
                plan: None,
                attempt: None,
            };
            let input = role_input(&generation(), &request).unwrap();
            assert_eq!(input.default_effort, effort);
            assert_eq!(input.role_effort, None);
            assert_eq!(input.role_model, None);
            assert_eq!(input.legacy_effort, None);
            assert_eq!(input.legacy_model, None);
            assert_eq!(input.attempt, 1);
            assert!(!input.escalate_on_failure);
        }
    }

    #[test]
    fn role_input_uses_projected_layer_and_source_for_each_winning_leaf() {
        let mut generation = generation();
        generation.effective.global =
            json!({"roles":{"cad-executor":{"model":null,"effort":null}}});
        generation.effective.repo =
            json!({"model":{"overrides":{"cad-executor":"opus"},"effort":{"cad-executor":"max"}}});
        generation.effective.sources = [
            ("roles.cad-executor.model".into(), Layer::Global),
            ("roles.cad-executor.effort".into(), Layer::Global),
            ("model.overrides.cad-executor".into(), Layer::Repo),
            ("model.effort.cad-executor".into(), Layer::Repo),
        ]
        .into();
        let request = RouteRequest {
            role: "cad-executor".into(),
            phase: None,
            plan: None,
            attempt: None,
        };
        let input = role_input(&generation, &request).unwrap();
        assert_eq!(
            input.role_model,
            Some(roles::Stored {
                key: "roles.cad-executor.model".into(),
                layer: "global".into(),
                value: Value::Null
            })
        );
        assert_eq!(
            input.role_effort,
            Some(roles::Stored {
                key: "roles.cad-executor.effort".into(),
                layer: "global".into(),
                value: Value::Null
            })
        );
        assert_eq!(
            input.legacy_model,
            Some(roles::Stored {
                key: "model.overrides.cad-executor".into(),
                layer: "repo".into(),
                value: json!("opus")
            })
        );
        assert_eq!(
            input.legacy_effort,
            Some(roles::Stored {
                key: "model.effort.cad-executor".into(),
                layer: "repo".into(),
                value: json!("max")
            })
        );
    }
}

pub fn routing_inputs(generation: &Generation) -> cadence::execution::model::ConfigInputs {
    let capture = |input: &crate::config::reload::Input| cadence::execution::model::ConfigInput {
        identity: input.identity.clone(),
        content: input.bytes.as_deref().map(cadence::store::model::digest),
        stamp: input.stamp,
    };
    cadence::execution::model::ConfigInputs {
        repo: capture(&generation.repo),
        global: generation.global.as_ref().map(capture),
        global_alias: generation.effective.global_intent,
    }
}
