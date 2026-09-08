use crate::{
    config::{
        self, Layer, merge,
        reload::{ConfigIo, Generation},
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

pub enum Command {
    Facts,
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
