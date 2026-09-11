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

pub fn routing_inputs(generation: &Generation) -> cadence::execution::model::ConfigInputs {
    generation.routing_inputs()
}
