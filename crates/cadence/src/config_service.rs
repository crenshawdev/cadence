use crate::{
    config::{
        self, Layer, interview, merge,
        reload::{ConfigIo, Generation},
        roles,
        write::Update,
    },
    import::{Session, SessionFactory, SourceEvidence, SourceGuard},
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
    #[serde(rename = "config-interview-apply")]
    Interview {
        mode: interview::Mode,
        captured: interview::Captured,
        accepted: bool,
        answers: Option<Vec<Update>>,
    },
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
    Entry(Vec<String>),
    Interview(interview::Mode),
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
    pub retirement: Retirement,
    pub interview: interview::Prepared,
}

#[derive(Debug, PartialEq, Serialize, JsonSchema)]
pub struct RetiredValue {
    pub value: Value,
    pub layer: Layer,
    pub path: PathBuf,
    pub global_alias: Option<PathBuf>,
    pub origin: String,
}

#[derive(Debug, PartialEq, Serialize, JsonSchema)]
pub struct Retirement {
    pub message: String,
    pub originals: Vec<RetiredValue>,
    pub evidence: String,
}

pub fn retirement(generation: &Generation, snapshot: Option<&Value>) -> Retirement {
    let mut originals = Vec::new();
    for (layer, raw, input) in [
        (
            Layer::Global,
            &generation.effective.raw_global,
            generation.global.as_ref(),
        ),
        (
            Layer::Repo,
            &generation.effective.raw_repo,
            Some(&generation.repo),
        ),
    ] {
        if let (Some(value), Some(input)) = (raw.as_ref().and_then(|raw| raw.get("stakes")), input)
        {
            originals.push(RetiredValue {
                value: value.clone(),
                layer,
                path: input.identity.clone(),
                global_alias: (layer == Layer::Repo && generation.effective.global_intent)
                    .then(|| generation.repo.identity.clone()),
                origin: "active".into(),
            });
        }
    }
    let mut evidence_available = false;
    let mut evidence_invalid = false;
    let mut current = snapshot;
    let mut manifest = None;
    while let Some(data) = current {
        manifest = data.get("import").or(manifest);
        if let Some(evidence) = data.get("source_evidence") {
            match serde_json::from_value::<Vec<SourceEvidence>>(evidence.clone()) {
                Ok(sources) => {
                    evidence_available = true;
                    let guards: Vec<SourceGuard> = manifest
                        .and_then(|value| value.get("sources"))
                        .cloned()
                        .and_then(|value| serde_json::from_value(value).ok())
                        .unwrap_or_default();
                    for source in sources {
                        if source.generation != source.source.generation() {
                            evidence_invalid = true;
                            continue;
                        }
                        let stored = guards
                            .iter()
                            .find(|guard| guard.path == Path::new(&source.source.path));
                        let repo = guards.first();
                        let layer = source.layer.or_else(|| {
                            stored.map(|guard| {
                                if repo.is_some_and(|repo| repo.identity == guard.identity) {
                                    Layer::Repo
                                } else {
                                    Layer::Global
                                }
                            })
                        });
                        let Ok(raw) = serde_json::from_slice::<Value>(&source.source.bytes) else {
                            evidence_invalid |= layer.is_some();
                            continue;
                        };
                        let Some(value) = raw.get("stakes") else {
                            continue;
                        };
                        let Some(layer) = layer else {
                            evidence_invalid = true;
                            continue;
                        };
                        let alias = source.global_alias.or_else(|| {
                            (layer == Layer::Repo)
                                .then(|| {
                                    guards
                                        .iter()
                                        .find(|guard| {
                                            repo.is_some_and(|repo| {
                                                guard.identity == repo.identity
                                                    && guard.path != repo.path
                                            })
                                        })
                                        .map(|guard| guard.path.clone())
                                })
                                .flatten()
                        });
                        let original = RetiredValue {
                            value: value.clone(),
                            layer,
                            path: source.source.path.into(),
                            global_alias: alias,
                            origin: "preserved".into(),
                        };
                        if !originals.contains(&original) {
                            originals.push(original);
                        }
                    }
                }
                Err(_) => evidence_invalid = true,
            }
        }
        current = data.get("current");
    }
    Retirement {
        message: "The stakes level is retired. Ordinary role questions use current settings; no equivalent spending profile is inferred.".into(),
        originals,
        evidence: if evidence_available && !evidence_invalid { "available" } else { "unavailable" }.into(),
    }
}

#[derive(Serialize, JsonSchema)]
#[serde(tag = "operation")]
pub enum Output {
    #[serde(rename = "config-entry")]
    Entry {
        entry: interview::Entry,
        facts: Facts,
    },
    #[serde(rename = "route")]
    Route { route: Box<Route> },
    #[serde(rename = "config-facts")]
    Facts { facts: Facts },
    #[serde(rename = "config-interview-apply")]
    Unchanged { facts: Facts },
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
    interview_facts(generation, interview::Mode::Roles)
}

pub fn interview_facts(generation: &Generation, mode: interview::Mode) -> Facts {
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
        retirement: retirement(generation, None),
        interview: interview::prepare(generation, mode),
    }
}

async fn session_facts<I: ConfigIo>(session: &Session<I>, mode: interview::Mode) -> Result<Facts> {
    let generation = session.config()?;
    let view = session
        .request(cadence::store::writer::Operation::Read)
        .await?;
    Ok(observed_facts(&generation, Some(&view.snapshot.data), mode))
}

pub fn observed_facts(
    generation: &Generation,
    snapshot: Option<&Value>,
    mode: interview::Mode,
) -> Facts {
    let mut facts = if mode == interview::Mode::Roles {
        facts(generation)
    } else {
        interview_facts(generation, mode)
    };
    facts.retirement = retirement(generation, snapshot);
    facts
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
    let entry = if let Command::Entry(tokens) = &command {
        match interview::entry(tokens) {
            Ok(interview::Entry::ReviewUnavailable { reason }) => {
                return Ok(refused("review-setup-unavailable", reason));
            }
            Ok(entry) => Some(entry),
            Err(error) => return Ok(refused("invalid-config", error.to_string())),
        }
    } else {
        None
    };
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
    if let Command::Apply(Apply::Interview {
        accepted, answers, ..
    }) = &command
        && (!accepted || answers.is_none())
    {
        return Ok(match factory.observe_config(root) {
            Ok((generation, snapshot)) => Envelope::Ok(Output::Unchanged {
                facts: observed_facts(&generation, snapshot.as_ref(), interview::Mode::Roles),
            }),
            Err(error) => unavailable(&error),
        });
    }
    let session = match factory.first_touch(root).await {
        Ok(session) => session,
        Err(error) => return Ok(unavailable(&error)),
    };
    let result = match command {
        Command::Entry(_) => {
            let entry = entry.expect("entry prepared before session acquisition");
            let mode = match entry {
                interview::Entry::Roles { mode } => mode,
                _ => interview::Mode::Roles,
            };
            return Ok(match session_facts(&session, mode).await {
                Ok(facts) => Envelope::Ok(Output::Entry { entry, facts }),
                Err(error) => unavailable(&error),
            });
        }
        Command::Route(request) => {
            let generation = match session.config() {
                Ok(generation) => generation,
                Err(error) => return Ok(unavailable(&error)),
            };
            return Ok(match route_at(&generation, &request, root) {
                Ok(route) => Envelope::Ok(Output::Route {
                    route: Box::new(route),
                }),
                Err(Error::Invalid(reason)) => refused("invalid-route", reason),
                Err(error) => unavailable(&error),
            });
        }
        Command::Interview(mode) => {
            return Ok(match session_facts(&session, mode).await {
                Ok(facts) => Envelope::Ok(Output::Facts { facts }),
                Err(error) => unavailable(&error),
            });
        }
        Command::Facts => {
            return Ok(
                match session_facts(&session, interview::Mode::Roles).await {
                    Ok(facts) => Envelope::Ok(Output::Facts { facts }),
                    Err(error) => unavailable(&error),
                },
            );
        }
        Command::Apply(Apply::Interview {
            mode,
            captured,
            accepted,
            answers,
        }) => {
            match session
                .interview_config(mode, captured, accepted, answers.as_deref())
                .await
            {
                Ok(Some(written)) => {
                    session_facts(&session, interview::Mode::Roles)
                        .await
                        .map(|facts| Output::Applied {
                            changed_keys: written.changed_keys,
                            destination: written.destination,
                            requested_layer: written.requested_layer,
                            facts,
                        })
                }
                Ok(None) => session_facts(&session, interview::Mode::Roles)
                    .await
                    .map(|facts| Output::Unchanged { facts }),
                Err(error) => Err(error),
            }
        }
        Command::Apply(Apply::Batch { layer, updates }) => {
            match session.batch_config(layer, &updates).await {
                Ok(written) => session_facts(&session, interview::Mode::Roles)
                    .await
                    .map(|facts| Output::Applied {
                        changed_keys: written.changed_keys,
                        destination: written.destination,
                        requested_layer: written.requested_layer,
                        facts,
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

    fn gap_persisted(root: &Path, repo_bytes: &[u8], global: Option<&Path>) {
        use sha2::{Digest, Sha256};
        std::fs::create_dir_all(root).unwrap();
        let active = root.join("config.v4.json");
        std::fs::write(&active, repo_bytes).unwrap();
        let empty = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        let mut snapshot = json!({"version":1,"generation":1,"items_digest":empty,"decisions_digest":empty,
            "data":{"import":{"format":1,"complete":true,"source_generation":"fixture","sources":[],
                "active":{"global":global,"repo":active},"created":[],"warnings":[]}},
            "operations":{},"integrity":""});
        snapshot["integrity"] = json!(format!(
            "{:x}",
            Sha256::digest(serde_json::to_vec(&snapshot).unwrap())
        ));
        std::fs::write(
            root.join("state.json"),
            serde_json::to_vec(&snapshot).unwrap(),
        )
        .unwrap();
        std::fs::write(root.join("items.jsonl"), b"").unwrap();
        std::fs::write(root.join("decisions.jsonl"), b"").unwrap();
    }

    #[tokio::test]
    async fn phase8_gap_guard_grouped_apply_stays_usable() {
        let tree = tempfile::tempdir().unwrap();
        let root = tree.path().join("project/.planning");
        gap_persisted(&root, b"{}", None);
        let factory = SessionFactory::new(None, std::sync::Arc::new(config::planning_policy));
        let input = Command::Apply(Apply::Batch {
            layer: Layer::Repo,
            updates: vec![Update {
                key: "roles.cad-executor.model".into(),
                value: json!("sonnet"),
            }],
        });
        let result = execute(&factory, &root, input).await.unwrap();
        let (status, changed_keys) = match result {
            Envelope::Ok(Output::Applied { changed_keys, .. }) => ("ok", changed_keys),
            other => panic!(
                "unexpected apply: {}",
                serde_json::to_string(&other).unwrap()
            ),
        };
        assert_eq!((status, changed_keys, std::fs::read(root.join("config.v4.json")).unwrap()),
            ("ok", vec!["roles.cad-executor.model".to_owned()], b"{\n  \"roles\": {\n    \"cad-executor\": {\n      \"model\": \"sonnet\"\n    }\n  }\n}".to_vec()));
    }

    fn gap_answers() -> Vec<Update> {
        serde_json::from_str(
            r#"[
            {"key":"roles.cad-planner.model","value":null},
            {"key":"roles.cad-planner.effort","value":"high"},
            {"key":"roles.cad-assumptions-analyzer.model","value":null},
            {"key":"roles.cad-assumptions-analyzer.effort","value":"high"},
            {"key":"roles.cad-verifier.model","value":null},
            {"key":"roles.cad-verifier.effort","value":"high"},
            {"key":"roles.cad-reviewer.model","value":null},
            {"key":"roles.cad-reviewer.effort","value":"medium"},
            {"key":"roles.cad-executor.model","value":"opus"},
            {"key":"roles.cad-executor.effort","value":"xhigh"},
            {"key":"roles.cad-plan-checker.model","value":null},
            {"key":"roles.cad-plan-checker.effort","value":"low"},
            {"key":"review.triggers.risk_surface.waive_routing_floor","value":[]}
        ]"#,
        )
        .unwrap()
    }

    #[derive(Clone)]
    struct GapAbsentIo;
    impl ConfigIo for GapAbsentIo {
        fn read(&mut self, path: &Path) -> Result<Input> {
            Ok(Input {
                identity: path.into(),
                bytes: None,
                stamp: None,
            })
        }
    }

    async fn gap_no_answer(
        accepted: bool,
        answers: Option<Vec<Update>>,
    ) -> (&'static str, Vec<String>, bool, bool) {
        let tree = tempfile::tempdir().unwrap();
        let root = tree.path().join("project/.planning");
        let global = tree.path().join("global/config.json");
        let mutations = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let observed = mutations.clone();
        let factory = SessionFactory::with_io(
            Some(global.clone()),
            GapAbsentIo,
            std::sync::Arc::new(config::planning_policy),
        )
        .with_probe(std::sync::Arc::new(move |stage, path| {
            observed
                .lock()
                .unwrap()
                .push(format!("{stage:?}:{}", path.display()));
            Ok(())
        }));
        let stale_capture = interview::Captured {
            repo: interview::Input {
                identity: "/stale/config.v4.json".into(),
                content: Some("stale".into()),
                stamp: Some((1, 2, 3)),
            },
            global: None,
            global_alias: false,
        };
        let input = Command::Apply(Apply::Interview {
            mode: interview::Mode::Suggestion,
            captured: stale_capture,
            accepted,
            answers,
        });
        let result = execute(&factory, &root, input).await.unwrap();
        let variant = match result {
            Envelope::Ok(Output::Unchanged { .. }) => "Unchanged",
            _ => "other",
        };
        let observations = mutations.lock().unwrap().clone();
        (
            variant,
            observations,
            root.exists(),
            global.parent().unwrap().exists(),
        )
    }

    #[tokio::test]
    async fn phase8_gap_unanswered_suggestion_has_zero_writes() {
        assert_eq!(
            gap_no_answer(true, None).await,
            ("Unchanged", vec![], false, false)
        );
    }

    #[tokio::test]
    async fn phase8_gap_declined_suggestion_has_zero_writes() {
        assert_eq!(
            gap_no_answer(false, Some(gap_answers())).await,
            ("Unchanged", vec![], false, false)
        );
    }

    fn gap_capture(path: &Path, bytes: &[u8]) -> interview::Input {
        use sha2::{Digest, Sha256};
        use std::os::unix::fs::MetadataExt;
        let metadata = std::fs::metadata(path).unwrap();
        interview::Input {
            identity: path.into(),
            content: Some(format!("{:x}", Sha256::digest(bytes))),
            stamp: Some((metadata.dev(), metadata.ino(), metadata.mode())),
        }
    }

    #[tokio::test]
    async fn phase8_gap_accepted_entries_store_identical_literal_bytes() {
        const ACCEPTED_REPO: &[u8] = b"{\n  \"roles\": {\n    \"cad-executor\": {\n      \"model\": \"opus\",\n      \"effort\": \"xhigh\"\n    }\n  },\n  \"review\": {\n    \"triggers\": {\n      \"risk_surface\": {\n        \"waive_routing_floor\": []\n      }\n    }\n  }\n}";
        for mode in [
            interview::Mode::NewProject,
            interview::Mode::Adopt,
            interview::Mode::Suggestion,
        ] {
            let tree = tempfile::tempdir().unwrap();
            let root = tree.path().join("project/.planning");
            let global = tree.path().join("global/config.v4.json");
            std::fs::create_dir_all(global.parent().unwrap()).unwrap();
            std::fs::write(&global, b"{\"roles\":{}}").unwrap();
            gap_persisted(&root, b"{}", Some(&global));
            let captured = interview::Captured {
                repo: gap_capture(&root.join("config.v4.json"), b"{}"),
                global: Some(gap_capture(&global, b"{\"roles\":{}}")),
                global_alias: false,
            };
            let factory = SessionFactory::new(
                Some(global.with_file_name("config.json")),
                std::sync::Arc::new(config::planning_policy),
            );
            let input = Command::Apply(Apply::Interview {
                mode,
                captured,
                accepted: true,
                answers: Some(gap_answers()),
            });
            let _result = execute(&factory, &root, input).await.unwrap();
            assert_eq!(
                (
                    std::fs::read(root.join("config.v4.json")).unwrap(),
                    std::fs::read(&global).unwrap()
                ),
                (ACCEPTED_REPO.to_vec(), b"{\"roles\":{}}".to_vec()),
                "{mode:?}"
            );
        }
    }

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

#[derive(Debug, PartialEq, Serialize, JsonSchema)]
pub struct Route {
    #[serde(flatten)]
    pub choice: roles::Resolution,
    pub generation: u64,
    pub config_diagnostics: config::Diagnostics,
    pub policy: config::policy::Policy,
    pub floor: config::floor::Scope,
    pub deep_verification: bool,
}

pub fn resolve_route(generation: &Generation, request: &RouteRequest) -> Result<Route> {
    let policy = config::policy::resolve(&generation.effective)?;
    Ok(Route {
        choice: resolve_role(generation, request)?,
        generation: generation.number,
        config_diagnostics: generation.effective.diagnostics.clone(),
        policy,
        floor: config::floor::Scope::pending(&request.role, request.phase.map(|phase| phase.get())),
        deep_verification: false,
    })
}

pub fn route_at(
    generation: &Generation,
    request: &RouteRequest,
    planning_root: &Path,
) -> Result<Route> {
    let route = resolve_route(generation, request)?;
    let scope = config::floor::read(
        planning_root,
        &request.role,
        request.phase.map(|phase| phase.get()),
        request.plan.map(|plan| plan.get()),
        &route.policy.floor_categories,
    )?;
    Ok(route.with_scope(scope))
}

impl Route {
    pub fn with_scope(mut self, scope: config::floor::Scope) -> Self {
        let recommendation = config::floor::recommend(&scope, &self.policy.waived_categories);
        self.deep_verification = recommendation.deep_verification;
        self.policy = self.policy.with_floor(self.deep_verification);
        self.floor = scope;
        self.floor.reasons = recommendation.reasons;
        self
    }
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
    generation.routing_inputs()
}

#[cfg(test)]
mod retirement_tests {
    use super::*;
    use crate::config::reload::Input;
    use serde_json::json;

    fn generation() -> Generation {
        Generation {
            number: 1,
            global: Some(Input {
                identity: "/today/global/config.v4.json".into(),
                bytes: None,
                stamp: None,
            }),
            repo: Input {
                identity: "/today/project/.planning/config.v4.json".into(),
                bytes: None,
                stamp: None,
            },
            effective: merge::merge(None, None, false),
        }
    }

    fn source(path: &str, bytes: &[u8]) -> Value {
        json!({"source":{"path":path,"bytes":bytes},
            "generation":cadence::store::model::digest(bytes),"label":"non_effective_original_source"})
    }

    fn snapshot(bytes: &[u8]) -> Value {
        json!({"import":{"sources":[
            {"path":"/old/project/config.json","identity":"/old/project/config.json","content":null},
            {"path":"/old/global/config.json","identity":"/old/global/config.json","content":null}
        ]},"source_evidence":[source("/old/global/config.json", bytes)]})
    }

    macro_rules! exact_value {
        ($name:ident, $bytes:literal, $expected:expr) => {
            #[test]
            fn $name() {
                assert_eq!(
                    retirement(&generation(), Some(&snapshot($bytes))).originals,
                    vec![RetiredValue {
                        value: $expected,
                        layer: Layer::Global,
                        path: "/old/global/config.json".into(),
                        global_alias: None,
                        origin: "preserved".into()
                    }]
                );
            }
        };
    }
    exact_value!(
        retired_string_is_exact,
        br#"{"stakes":"high"}"#,
        json!("high")
    );
    exact_value!(
        unknown_retired_string_is_exact,
        br#"{"stakes":"unrecognized"}"#,
        json!("unrecognized")
    );
    exact_value!(
        retired_object_is_exact,
        br#"{"stakes":{"unknown":[1,null]}}"#,
        json!({"unknown":[1,null]})
    );
    exact_value!(retired_number_is_exact, br#"{"stakes":12.5}"#, json!(12.5));
    exact_value!(retired_null_is_present, br#"{"stakes":null}"#, Value::Null);
    exact_value!(
        retired_array_is_exact,
        br#"{"stakes":[1,"x",null]}"#,
        json!([1, "x", null])
    );
    exact_value!(
        retired_boolean_is_exact,
        br#"{"stakes":false}"#,
        json!(false)
    );

    #[test]
    fn distinct_originals_keep_their_historical_layer_and_path() {
        let mut snapshot = snapshot(br#"{"stakes":"global-original"}"#);
        snapshot["source_evidence"]
            .as_array_mut()
            .unwrap()
            .push(source(
                "/old/project/config.json",
                br#"{"stakes":{"repo":true}}"#,
            ));
        assert_eq!(retirement(&generation(), Some(&snapshot)), Retirement {
            message: "The stakes level is retired. Ordinary role questions use current settings; no equivalent spending profile is inferred.".into(),
            originals: vec![
                RetiredValue { value: json!("global-original"), layer: Layer::Global, path: "/old/global/config.json".into(), global_alias: None, origin: "preserved".into() },
                RetiredValue { value: json!({"repo":true}), layer: Layer::Repo, path: "/old/project/config.json".into(), global_alias: None, origin: "preserved".into() },
            ], evidence: "available".into(),
        });
    }

    #[test]
    fn collapsed_original_is_shown_once_with_its_preserved_global_alias() {
        let snapshot = json!({"import":{"sources":[
            {"path":"/old/project/config.json","identity":"/old/project/config.json","content":null},
            {"path":"/old/global-link.json","identity":"/old/project/config.json","content":null}
        ]},"source_evidence":[source("/old/project/config.json", br#"{"stakes":null}"#)]});
        assert_eq!(
            retirement(&generation(), Some(&snapshot)).originals,
            vec![RetiredValue {
                value: Value::Null,
                layer: Layer::Repo,
                path: "/old/project/config.json".into(),
                global_alias: Some("/old/global-link.json".into()),
                origin: "preserved".into(),
            }]
        );
    }

    #[test]
    fn wrapped_original_evidence_is_read_without_normalizing_the_snapshot() {
        let snapshot =
            json!({"import":{"sources":[]},"current":snapshot(br#"{"stakes":{"wrapped":true}}"#)});
        assert_eq!(
            retirement(&generation(), Some(&snapshot)).originals,
            vec![RetiredValue {
                value: json!({"wrapped":true}),
                layer: Layer::Global,
                path: "/old/global/config.json".into(),
                global_alias: None,
                origin: "preserved".into(),
            }]
        );
    }

    #[test]
    fn missing_historical_evidence_is_unavailable_without_reconstructing_originals() {
        assert_eq!(retirement(&generation(), Some(&json!({"import":{"complete":true}}))), Retirement {
            message: "The stakes level is retired. Ordinary role questions use current settings; no equivalent spending profile is inferred.".into(),
            originals: vec![], evidence: "unavailable".into(),
        });
    }

    #[test]
    fn active_raw_stakes_is_disclosed_without_becoming_preserved_evidence() {
        let mut generation = generation();
        generation.effective.raw_repo = Some(json!({"stakes":{"active":[1,null]}}));
        assert_eq!(
            retirement(&generation, None).originals,
            vec![RetiredValue {
                value: json!({"active":[1,null]}),
                layer: Layer::Repo,
                path: "/today/project/.planning/config.v4.json".into(),
                global_alias: None,
                origin: "active".into(),
            }]
        );
    }

    #[test]
    fn damaged_source_evidence_is_unavailable() {
        let mut snapshot = snapshot(br#"{"stakes":"original"}"#);
        snapshot["source_evidence"][0]["generation"] = json!("wrong-digest");
        assert_eq!(
            retirement(&generation(), Some(&snapshot)).evidence,
            "unavailable"
        );
    }
    #[test]
    fn original_with_lost_layer_identity_is_unavailable() {
        let snapshot =
            json!({"source_evidence":[source("/old/config.json", br#"{"stakes":"original"}"#)]});
        assert_eq!(
            retirement(&generation(), Some(&snapshot)).evidence,
            "unavailable"
        );
    }
}
