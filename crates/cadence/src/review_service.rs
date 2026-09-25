//! Resident adapter for the independently implemented review units.
use crate::config::{
    merge,
    reload::{ConfigIo, Generation},
};
use crate::import::SessionFactory;
use cadence::envelope::Envelope;
use cadence::review::{
    self, admission, consumers, deferred, material, model::*, persistence, selection,
};
use cadence::store::{Error, Result, writer::Store};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{collections::BTreeMap, num::NonZeroU32, path::Path};

#[derive(Clone, Debug, Deserialize, JsonSchema)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum Query {
    #[serde(rename = "review-next")]
    Next { fire: String },
    #[serde(rename = "review-admission")]
    Admission { fire: String },
    #[serde(rename = "review-material")]
    Material { attempt: String, entry: String },
    #[serde(rename = "review-original")]
    Original { original: String },
    #[serde(rename = "review-attempt")]
    Attempt { attempt: String },
    #[serde(rename = "review-roster")]
    Roster { fire: String },
    #[serde(rename = "review-inventory")]
    Inventory {},
    #[serde(rename = "review-deferred")]
    Deferred {},
    #[serde(rename = "review-consumer")]
    Consumer {
        consumer: String,
        attempt: Option<String>,
        supplied: Option<Value>,
    },
    /// Resolve one explicit review target (D-133): `command` is cad-review or
    /// one of its three aliases, `arguments` the whitespace-split tokens. The
    /// answer carries the exact admission request to submit unchanged.
    #[serde(rename = "review-select")]
    Select {
        command: String,
        arguments: Vec<String>,
        replay_key: Option<String>,
    },
}

#[derive(Clone, Debug, Deserialize, JsonSchema)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum Apply {
    #[serde(rename = "review-admit")]
    Admit { request: Value },
    #[serde(rename = "review-observation")]
    Observation { observation: Value },
    #[serde(rename = "review-return")]
    Return {
        identity: Value,
        launch: Option<String>,
        failure_event: Option<Value>,
        host_return: Option<String>,
        raw: Option<String>,
        findings: Option<Vec<review::model::Finding>>,
        host_failure: Option<String>,
        citations: Vec<Value>,
    },
    #[serde(rename = "review-material-append")]
    MaterialAppend {
        manifest: String,
        acquisition: String,
        path: Option<String>,
        label: Option<String>,
        #[serde(default)]
        bytes: Vec<u8>,
        delivered: Option<Value>,
    },
    #[serde(rename = "review-enqueue")]
    Enqueue { fire: String },
}

pub enum Command {
    ExecutionHandoff {
        phase: Option<u32>,
        dispatch: Option<String>,
    },
    Query(Query),
    Apply(Apply),
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct Output {
    pub operation: String,
    pub result: Value,
}
pub type Answer = Result<Envelope<Output>>;

pub fn refused(reason: impl Into<String>) -> Envelope<Output> {
    Envelope::Refused {
        code: "invalid-review-operation".into(),
        reason: reason.into(),
    }
}

/// Validate the supplied array before serde discards the indexed field path.
pub fn typed_return_refusal(request: &Value) -> Option<Value> {
    if request["operation"] != "review-return" { return None; }
    let findings = request.get("findings")?;
    let bytes = serde_json::to_vec(&json!({"findings":findings})).ok()?;
    let error = review::contract::validate_findings(&bytes).err()?;
    let diagnostic = serde_json::to_value(&error).ok()?;
    let field = diagnostic["field"].as_str().unwrap_or("findings");
    let slot = match diagnostic["index"].as_u64() {
        Some(index) if field != "findings" => format!("findings[{index}].{field}"),
        Some(index) => format!("findings[{index}]"),
        None => "findings".into(),
    };
    Some(cadence::envelope::Refusal::new("invalid-return", format!("{error:?}"))
        // H4-1: review-return findings must satisfy the admitted contract.
        .rule("return-shape").slot(slot).value())
}
fn output(operation: &str, result: impl Serialize) -> Answer {
    Ok(Envelope::Ok(Output {
        operation: operation.into(),
        result: serde_json::to_value(result)?,
    }))
}
fn collection<T: serde::de::DeserializeOwned>(
    records: &Value,
    family: &str,
) -> Result<BTreeMap<String, T>> {
    Ok(records
        .get(family)
        .cloned()
        .map(serde_json::from_value)
        .transpose()?
        .unwrap_or_default())
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct AdmissionRequest {
    replay_key: String,
    caller: String,
    trigger: Option<review::policy::OrdinaryTrigger>,
    specialist: Option<Specialist>,
    project: String,
    cycle: String,
    home: HomeInput,
    discriminator: String,
    phase: Option<NonZeroU32>,
    plan: Option<NonZeroU32>,
    anchor: Option<String>,
    round: u64,
    target: Target,
    decision: Option<review::targets::DecisionMaterial>,
    risk_observation: Option<String>,
    /// A review-select decision binding: the document, its digest and the
    /// resolved line span. When present the binary resolves the decision from
    /// the document again and refuses a supplied paragraph that differs.
    #[serde(default)]
    selection: Option<Value>,
}

pub(super) enum AdmissionResolution {
    Refresh,
    Supplied {
        generation: Box<Generation>,
        route: Box<super::config_service::Route>,
        gate: Gate,
    },
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct HomeInput {
    kind: HomeKind,
    id: String,
}
fn decode_admission(value: Value) -> Result<AdmissionRequest> {
    let request: AdmissionRequest = serde_json::from_value(value)?;
    if request.replay_key.is_empty()
        || request.project.is_empty()
        || request.cycle.is_empty()
        || request.discriminator.is_empty()
        || request.round == 0
        || request.trigger.is_some() == request.specialist.is_some()
        || request.plan.is_some() && request.phase.is_none()
    {
        return Err(Error::Invalid("incomplete review admission".into()));
    }
    Ok(request)
}
fn home_path(home: &HomeInput, fire: &str) -> Result<String> {
    if home.id.is_empty()
        || !home
            .id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(Error::Invalid("invalid review home".into()));
    }
    Ok(match home.kind {
        HomeKind::Phase => format!("phases/{}", home.id),
        HomeKind::Task => format!("tasks/{}", home.id),
        _ => format!("reviews/{fire}"),
    })
}
fn target_paths(target: &Target) -> Vec<&str> {
    match target {
        Target::NamedFile { path, .. } | Target::Directory { path, .. } => vec![path],
        Target::Diagnosis { paths, .. } => paths.iter().map(String::as_str).collect(),
        _ => vec![],
    }
}
fn validate_paths(target: &Target) -> Result<()> {
    for path in target_paths(target) {
        if path.is_empty()
            || Path::new(path).is_absolute()
            || Path::new(path)
                .components()
                .any(|c| matches!(c, std::path::Component::ParentDir))
        {
            return Err(Error::Invalid(
                "review target must be project-relative".into(),
            ));
        }
    }
    Ok(())
}

pub(super) async fn admit<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    root: &Path,
    value: Value,
    resolution: AdmissionResolution,
) -> Answer {
    let request = decode_admission(value)?;
    let session = factory.first_touch(root).await?;
    let store = session.review_store();
    let view = persistence::read(store).await?;
    let records = persistence::records(&view.snapshot.data)?;
    if let Some(replay) = replayed(&records, &request.replay_key) {
        return output("review-admit", replay);
    }
    validate_paths(&request.target)?;
    validate_selection(root, &request)?;
    let minimalism = request.specialist == Some(Specialist::Minimalism);
    let (generation, route, supplied_gate, refresh) = match supplied(&request, resolution)? {
        Some((generation, route, gate)) => (Some(generation), Some(route), Some(gate), false),
        None => {
            let generation = if minimalism {
                None
            } else {
                Some(session.config()?)
            };
            let route = generation
                .as_ref()
                .map(|generation| {
                    super::config_service::route_at(
                        generation,
                        &super::config_service::RouteRequest {
                            role: "cad-reviewer".into(),
                            phase: request.phase,
                            plan: request.plan,
                            attempt: None,
                        },
                        root,
                    )
                })
                .transpose()?;
            (generation, route, None, true)
        }
    };
    let sequence = records["occurrence_sequence"]
        .as_u64()
        .unwrap_or(0)
        .checked_add(1)
        .ok_or_else(|| Error::Invalid("occurrence overflow".into()))?;
    let fire = format!("f{sequence}");
    let manifest_id = format!("m{sequence}");
    let home_path = home_path(&request.home, &fire)?;
    let home = Home {
        kind: request.home.kind.clone(),
        id: request.home.id.clone(),
        occurrence: String::new(),
    };
    let Ordinary {
        routing,
        gate,
        trigger,
        selection,
        saved_routing,
    } = ordinary(&request, route.as_ref(), supplied_gate, &fire, &home)?;
    let observed = if request.trigger == Some(review::policy::OrdinaryTrigger::RiskSurface)
        && gate != Some(Gate::Off)
    {
        Some(admission_risk_observation(
            &request,
            root,
            &view,
            &route
                .as_ref()
                .ok_or_else(|| Error::Policy("ordinary routing unavailable".into()))?
                .policy
                .surfaces,
        )?)
    } else {
        None
    };
    let debug_dispatch = matches!((&gate, &observed), (Some(gate), Some((observation, true)))
        if review::policy::debug_risk_review_action(gate, observation, true) == review::policy::RiskAction::Dispatch);
    let policy_trigger = request.trigger.clone();
    let policy_gate = gate.clone();
    let admission = || async {
        let project_root = root
            .parent()
            .ok_or_else(|| Error::Invalid("project root unavailable".into()))?;
        let mut source = review::material_io::SourceFiles {
            root: project_root.into(),
        };
        let mut git = review::material_io::SourceGit {
            root: project_root.into(),
            process: Box::new(cadence::process::System),
        };
        let mut clock = review::material_io::WallClock;
        let (manifest, storage) = acquire_target(
            &fire,
            &manifest_id,
            &request.target,
            request.decision.as_ref(),
            &view.snapshot.data,
            &mut source,
            &mut git,
            &mut clock,
        )?;
        match request.specialist {
            Some(Specialist::Decision) if !matches!(manifest.target, Target::Decision { .. }) => {
                return Err(Error::Invalid("decision target required".into()));
            }
            Some(Specialist::Diagnosis) if !matches!(manifest.target, Target::Diagnosis { .. }) => {
                return Err(Error::Invalid("diagnosis target required".into()));
            }
            _ => {}
        }
        let choices = selection.choices.clone();
        let attempts = choices
            .iter()
            .enumerate()
            .map(|(index, choice)| {
                let requested = requested_voice(request.specialist.as_ref(), &manifest, || {
                    let route = route
                        .as_ref()
                        .ok_or_else(|| Error::Policy("ordinary routing unavailable".into()))?;
                    let generation = generation.as_ref().ok_or_else(|| {
                        Error::Policy("ordinary configuration unavailable".into())
                    })?;
                    let routing = routing
                        .as_ref()
                        .ok_or_else(|| Error::Policy("ordinary routing unavailable".into()))?;
                    let local = choice == "claude-subagent" || choice == "base";
                    let model = if local {
                        route.choice.model.clone()
                    } else {
                        trigger
                            .as_ref()
                            .and_then(|trigger| route.policy.triggers.get(trigger))
                            .and_then(|policy| {
                                merge::get(
                                    &generation.effective.values,
                                    &format!("review.providers.{choice}.tiers.{}", policy.tier),
                                )
                                .and_then(Value::as_str)
                                .map(str::to_owned)
                            })
                    };
                    Ok(RequestedVoice {
                        agent: if choice == "base" {
                            "cad-reviewer".into()
                        } else if local {
                            route.choice.agent.clone()
                        } else {
                            choice.clone()
                        },
                        model,
                        effort: if local {
                            Some(route.choice.rung.clone())
                        } else {
                            trigger.as_ref().and_then(|name| route.policy.triggers.get(name))
                                .map(|policy| policy.effort.clone())
                        },
                        routing: saved_routing.clone(),
                        selection_evidence: routing.evidence.clone(),
                    })
                })?;
                Ok(intended_attempt(&fire, index, choice, request.round, &manifest_id, &manifest, requested))
            })
            .collect::<Result<Vec<_>>>()?;
        let admitted = Admission {
            fire: fire.clone(),
            replay_key: request.replay_key,
            scope: Scope {
                project: request.project,
                root: project_root.to_string_lossy().into(),
                cycle: request.cycle,
            },
            home,
            caller: request.caller,
            trigger,
            specialist: request.specialist,
            discriminator: request.discriminator,
            plan: request.plan.map(|n| n.to_string()),
            anchor: request.anchor,
            round: request.round,
            artifact: manifest_id,
            gate,
            selection,
            routing: saved_routing,
            roster: Roster {
                required: choices,
                completion: CompletionRule::AllRequiredTerminal,
            },
            contract: Contract::current(),
            settlement: Settlement::Pending,
        };
        let mut transaction = persistence::transaction(&view, &format!("admit:{fire}"));
        let mut data = records;
        if let (Some(routing), Some(route)) = (&routing, &route) {
            persistence::insert(&mut data, "routes", &routing.evidence, route)?;
            if let Some(generation) = &generation {
                let settings = provider_settings(&generation.effective.values)?;
                persistence::insert(&mut data, "provider_settings", &fire, &settings)?;
            }
        } else {
            let selected = review::specialist::minimalism_selection(&manifest)
                .map_err(|e| Error::Invalid(e.into()))?;
            persistence::insert(
                &mut data,
                "specialist_requests",
                &format!("minimalism:{}", manifest.manifest),
                &selected,
            )?;
        }
        persistence::contribute(&view, &mut transaction, data)?;
        let contribution = admission::contribute_admission(
            &view,
            &mut transaction,
            admission::PendingAdmission {
                admission: admitted,
                attempts,
                manifest,
                material: storage,
                home_path,
            },
            &mut clock,
        )?;
        if refresh
            && let Some(generation) = &generation
            && session.config()? != *generation
        {
            return Err(Error::Conflict("review routing inputs changed".into()));
        }
        commit_admission(
            contribution,
            persistence::commit(store, &view, transaction),
            admission::acknowledge_admission,
        )
        .await
    };
    if debug_dispatch { admission().await }
    else { admit_with_policy(policy_trigger, policy_gate, observed.map(|(observation, _)| observation), admission).await }
}

/// The provider settings an admission records from the config: the key file,
/// the prompt cap, the request timeout (the configured one, capped at the
/// default and the default when none is set) and the fixed work,
/// acknowledgment and attempt budgets.
fn provider_settings(values: &Value) -> Result<Value> {
    let defaults = review::provider::Settings::default();
    let settings = review::provider::Settings {
        key_file: merge::get(values, "review.key_file").and_then(Value::as_str).map(str::to_owned),
        max_prompt_tokens: merge::get(values, "review.max_prompt_tokens")
            .and_then(Value::as_u64).filter(|value| *value > 0).unwrap_or(defaults.max_prompt_tokens),
        request_timeout_ms: merge::get(values, "review.request_timeout_ms")
            .and_then(Value::as_u64).map(review::provider::transport::effective_timeout).unwrap_or(defaults.request_timeout_ms),
    };
    let mut settings = serde_json::to_value(settings)?;
    settings["provider_work_timeout_ms"] = json!(review::provider::transport::PROVIDER_WORK_TIMEOUT_MS);
    settings["acknowledgment_budget_ms"] = json!(review::provider::transport::ACKNOWLEDGMENT_BUDGET_MS);
    settings["attempt_budget_ms"] = json!(review::provider::transport::ATTEMPT_BUDGET_MS);
    Ok(settings)
}

/// The answer for a replay key already recorded: its saved fire and attempt,
/// replayed. Nothing else about the request is consulted.
fn replayed(records: &Value, replay_key: &str) -> Option<Value> {
    records
        .get("replays")
        .and_then(|replays| replays.get(replay_key))
        .map(|replay| json!({"fire":replay["fire"],"attempt":replay["attempt"],"replayed":true}))
}

/// The generation, route and gate a supplied resolution carries, taken as
/// given so routing is not resolved again. Only an execute diff handoff may
/// supply them. None when the admission resolves from the current config.
fn supplied(
    request: &AdmissionRequest,
    resolution: AdmissionResolution,
) -> Result<Option<(Generation, super::config_service::Route, Gate)>> {
    match resolution {
        AdmissionResolution::Refresh => Ok(None),
        AdmissionResolution::Supplied {
            generation,
            route,
            gate,
        } => {
            if request.caller != "execute"
                || request.trigger != Some(review::policy::OrdinaryTrigger::Diff)
                || request.specialist.is_some()
                || !matches!(&request.target, Target::CommittedRange { .. })
            {
                return Err(Error::Invalid(
                    "supplied resolution requires execute diff handoff".into(),
                ));
            }
            Ok(Some((*generation, *route, gate)))
        }
    }
}

/// What an admission records from its route.
struct Ordinary {
    /// The route's answer, with its evidence under the fire.
    routing: Option<Routing>,
    gate: Option<Gate>,
    trigger: Option<String>,
    selection: Selection,
    /// The routing saved on the admission: only an ordinary trigger has one.
    saved_routing: Option<Routing>,
}

/// The routing, gate, trigger and selection an admission records from its
/// route. An ordinary trigger records the supplied gate when there is one,
/// else the trigger's own; a request without a trigger reviews once with the
/// base reviewer and records no gate.
fn ordinary(
    request: &AdmissionRequest,
    route: Option<&super::config_service::Route>,
    supplied_gate: Option<Gate>,
    fire: &str,
    home: &Home,
) -> Result<Ordinary> {
    let routing = route.map(|route| Routing {
        answer: route.choice.agent.clone(),
        evidence: format!("route:{fire}"),
    });
    let (gate, trigger, selection, saved_routing) = if let Some(trigger) = &request.trigger {
        let route = route.ok_or_else(|| Error::Policy("ordinary routing unavailable".into()))?;
        let routing = routing
            .as_ref()
            .ok_or_else(|| Error::Policy("ordinary routing unavailable".into()))?;
        let name = serde_json::to_value(trigger)?.as_str().unwrap().to_owned();
        let policy = route
            .policy
            .triggers
            .get(&name)
            .ok_or_else(|| Error::Policy("unknown review trigger".into()))?;
        let gate: Gate = match supplied_gate {
            Some(gate) => gate,
            None => serde_json::from_value(json!(policy.gate))?,
        };
        let selected = Selection {
            mode: serde_json::from_value(json!(route.policy.mode))?,
            choices: policy.reviewers.clone(),
            fallback: Some("claude-subagent".into()),
        };
        let resolved = review::policy::ResolvedOrdinary {
            trigger: trigger.clone(),
            gate,
            routing: routing.clone(),
            selection: selected,
            floor_elevated: route.deep_verification,
            home: home.clone(),
        };
        let ordinary = match request.caller.as_str() {
            "manual-plan" => review::policy::manual_plan_request(resolved),
            "automatic-plan" => review::policy::automatic_plan_request(resolved),
            "task" => review::policy::task_review_request(resolved),
            "execute" => review::policy::execute_review_request(resolved),
            "debug" => review::policy::debug_review_request(resolved),
            "verify" => review::policy::verify_review_request(resolved),
            "pause" => review::policy::ordinary_request("pause", resolved),
            _ => return Err(Error::Invalid("unsupported ordinary caller".into())),
        };
        (
            Some(ordinary.policy.gate),
            Some(name),
            ordinary.policy.selection,
            Some(routing.clone()),
        )
    } else {
        (
            None,
            None,
            Selection {
                mode: SelectionMode::Single,
                choices: vec!["base".into()],
                fallback: None,
            },
            None,
        )
    };
    Ok(Ordinary {
        routing,
        gate,
        trigger,
        selection,
        saved_routing,
    })
}

/// A new attempt as admission creates it: intended, with the voice it
/// requested and nothing observed yet.
fn intended_attempt(
    fire: &str,
    index: usize,
    slot: &str,
    round: u64,
    manifest_id: &str,
    manifest: &Manifest,
    requested: RequestedVoice,
) -> Attempt {
    Attempt {
        attempt: format!("{fire}-a{}", index + 1),
        fire: fire.into(),
        occurrence: String::new(),
        round,
        slot: slot.into(),
        fallback_for: None,
        view: MaterialView {
            view: format!("{fire}-v{}", index + 1),
            manifest: manifest_id.into(),
            entries: manifest.entries.iter().map(|e| e.entry.clone()).collect(),
        },
        requested,
        observed_host: None,
        observed_model: None,
        launch: None,
        host_return: None,
        state: AttemptState::Intended,
        failure: None,
        original: None,
        observations: vec![],
        usage: Usage {
            input: None,
            output: None,
            cost: None,
            currency: None,
        },
        contract: Contract::current(),
    }
}

fn requested_voice(
    specialist: Option<&Specialist>,
    manifest: &Manifest,
    ordinary: impl FnOnce() -> Result<RequestedVoice>,
) -> Result<RequestedVoice> {
    if specialist == Some(&Specialist::Minimalism) {
        return review::specialist::minimalism_voice(manifest)
            .map_err(|e| Error::Invalid(e.into()));
    }
    ordinary()
}

pub async fn admit_with_policy<F: std::future::Future<Output = Answer>>(
    trigger: Option<review::policy::OrdinaryTrigger>,
    gate: Option<Gate>,
    observation: Option<review::policy::DetectorObservation>,
    admit: impl FnOnce() -> F,
) -> Answer {
    let policy =
        review::policy::admission_policy(trigger.as_ref(), gate.as_ref(), observation.as_ref());
    if policy.action != review::policy::RiskAction::Dispatch {
        return output("review-admit", policy);
    }
    admit().await
}

fn admission_risk_observation(
    request: &AdmissionRequest,
    root: &Path,
    view: &cadence::store::writer::View,
    answer: &crate::config::policy::SurfaceAnswer,
) -> Result<(review::policy::DetectorObservation, bool)> {
    use cadence::rail::risk;
    use review::policy::DetectorObservation;
    let surfaces = match answer {
        crate::config::policy::SurfaceAnswer::Unanswered => {
            return Ok((DetectorObservation::Unanswered, false));
        }
        crate::config::policy::SurfaceAnswer::Invalid { reason } => {
            return Err(Error::Policy(reason.clone()));
        }
        crate::config::policy::SurfaceAnswer::Answered { categories } => categories,
    };
    let material = match &request.target {
        Target::CommittedRange { base, head } | Target::PhaseRange { base, head, .. } => {
            risk::MaterialIdentity::Committed {
                base_id: base.clone(),
                head_id: head.clone(),
            }
        }
        Target::StagedTree { base, index, .. } => risk::MaterialIdentity::Staged {
            base_id: base.clone(),
            index_id: index.clone(),
        },
        _ => return Ok((DetectorObservation::Inconclusive, false)),
    };
    let scope = if let Some(phase) = request.phase {
        risk::Scope::Phase {
            project: request.project.clone(), planning_root: root.to_string_lossy().into(),
            cycle: request.cycle.clone(), occurrence: request.discriminator.clone(),
            phase, worker: request.plan.map(|n| n.to_string()), plan: request.plan,
        }
    } else if request.caller == "debug" && request.home.kind == HomeKind::RootDebug
        && request.home.id == request.discriminator && request.plan.is_none()
        && matches!(request.target, Target::StagedTree { head: None, .. }) {
        let records = cadence::debug::model::namespace(&view.snapshot.data)?;
        let record = records.records.get(&request.discriminator)
            .ok_or_else(|| Error::Invalid("foreign-risk-evidence".into()))?;
        if record.root_binding != cadence::verification::inputs::root_binding(root)?
            || root.parent().is_none_or(|project| project.to_string_lossy() != request.project) {
            return Err(Error::Invalid("foreign-risk-evidence".into()));
        }
        risk::Scope::RootDebug {
            project: request.project.clone(), planning_root: root.to_string_lossy().into(),
            cycle: request.cycle.clone(), occurrence: request.discriminator.clone(),
            kind: risk::RootDebugKind::RootDebug,
        }
    } else {
        return if request.risk_observation.is_some() { Err(Error::Invalid("foreign-risk-evidence".into())) }
            else { Ok((DetectorObservation::Inconclusive, false)) };
    };
    let records = risk::read(&view.snapshot.data)?;
    let latest = records
        .values()
        .filter(|r| {
            r.observation.scope == scope
                && r.observation.surfaces == *surfaces
                && r.observation.resolution.material().as_ref() == Some(&material)
        })
        .max_by_key(|r| r.confirmation.generation);
    let selected = match &request.risk_observation {
        Some(id) => {
            let selected = records
                .values()
                .find(|r| r.observation.scope == scope && r.observation.request_id == *id);
            if selected.is_none() && records.values().any(|r| r.observation.request_id == *id) {
                return Err(Error::Invalid("foreign-risk-evidence".into()));
            }
            selected
        }
        None => latest,
    };
    let evidence = selected.map(|record| review::policy::RiskEvidence {
        observation: &record.observation,
        confirmed: risk::confirmed(view, &scope, &record.observation.request_id)
            .ok()
            .flatten()
            .as_ref()
            == Some(record),
        current: latest.is_some_and(|latest| latest.confirmation == record.confirmation),
    });
    let checked_debug = matches!(scope, risk::Scope::RootDebug { .. }) && evidence.as_ref().is_some_and(|e|
        e.confirmed && e.current && e.observation.surfaces == *surfaces
        && e.observation.outcome == risk::ObservationOutcome::Checked
        && e.observation.scan.as_ref().is_some_and(|scan| scan.checked));
    let observed = review::policy::detector_observation(&scope, &material, Some(surfaces), evidence)
        .map_err(|e| Error::Invalid(e.into()))?;
    Ok((observed, checked_debug))
}

async fn commit_admission<C, V>(
    contribution: C,
    commit: impl std::future::Future<Output = Result<V>>,
    acknowledge: impl FnOnce(&V, C) -> Result<admission::AdmissionReply>,
) -> Answer {
    let committed = commit.await?;
    output("review-admit", acknowledge(&committed, contribution)?)
}

/// A review-select decision binding is re-resolved from the document at
/// admission; a caller cannot substitute its own paragraph for the selection.
fn validate_selection(root: &Path, request: &AdmissionRequest) -> Result<()> {
    let Some(selection) = &request.selection else { return Ok(()) };
    let Target::Decision { selected, .. } = &request.target else {
        return Err(Error::Invalid("selection binds decision targets only".into()));
    };
    let document = selection["document"]
        .as_str()
        .ok_or_else(|| Error::Invalid("selection names no document".into()))?;
    let project_root = root
        .parent()
        .ok_or_else(|| Error::Invalid("project root unavailable".into()))?;
    let mut source = review::material_io::SourceFiles {
        root: project_root.into(),
    };
    let bytes = review::io::MaterialIo::read(&mut source, document)?
        .bytes
        .ok_or_else(|| Error::Invalid(format!("selected document {document} is absent")))?;
    if selection["digest"] != json!(cadence::store::model::digest(&bytes)) {
        return Err(Error::Invalid(format!(
            "selected document {document} changed since selection"
        )));
    }
    let (lines, text) = review::selection::decision_lines(&bytes, selected)
        .map_err(|refusal| Error::Invalid(refusal.reason))?;
    let utf8 = |bytes: Vec<u8>| {
        String::from_utf8(bytes).map_err(|_| Error::Invalid("selected document is not UTF-8".into()))
    };
    let resolved = review::targets::DecisionMaterial {
        decision: selected.clone(),
        text: utf8(text)?,
        context: utf8(bytes)?,
    };
    if selection["lines"] != json!(lines) || request.decision.as_ref() != Some(&resolved) {
        return Err(Error::Invalid(
            "selected decision differs from the resolved document".into(),
        ));
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn acquire_target(
    fire: &str,
    id: &str,
    target: &Target,
    decision: Option<&review::targets::DecisionMaterial>,
    data: &Value,
    source: &mut impl review::io::MaterialIo,
    git: &mut impl review::io::GitIo,
    clock: &mut impl review::io::Clock,
) -> Result<(Manifest, persistence::MaterialStorage)> {
    match target {
        // A phase's native plan slices and locked context are resolved by the
        // binary again here; the label carries no material of its own.
        Target::InlineText { label } => {
            let phase = label
                .strip_prefix("plan:")
                .and_then(|n| n.parse::<u32>().ok())
                .filter(|n| *n > 0)
                .ok_or_else(|| Error::Invalid("inline text targets are selected through review-select".into()))?;
            let entries = review::selection::plan_material(data, phase, source)
                .map_err(|refusal| Error::Invalid(refusal.reason))?;
            retain_inline(
                fire,
                id,
                target.clone(),
                entries.into_iter().map(|(_, path, bytes)| (path, bytes)).collect(),
                clock,
            )
        }
        Target::Decision { selected, .. } => {
            let value = decision
                .ok_or_else(|| Error::Invalid("decision text and context required".into()))?;
            if &value.decision != selected {
                return Err(Error::Invalid("selected decision mismatch".into()));
            }
            let owned = review::targets::decision_review_target(
                &value.decision,
                &value.text,
                &value.context,
            );
            retain_inline(
                fire,
                id,
                target.clone(),
                vec![
                    ("decision".into(), owned.text.into_bytes()),
                    ("context".into(), owned.context.into_bytes()),
                ],
                clock,
            )
        }
        Target::Diagnosis {
            paths,
            reported,
            cause,
        } => {
            let owned = review::targets::diagnosis_target(paths, reported, cause);
            let mut material = vec![
                ("reported".into(), owned.reported.into_bytes()),
                ("cause".into(), owned.cause.into_bytes()),
            ];
            for path in &owned.entries {
                material.push((
                    path.clone(),
                    source
                        .read(path)?
                        .bytes
                        .ok_or_else(|| Error::Io(format!("missing diagnosis source: {path}")))?,
                ));
            }
            retain_inline(fire, id, target.clone(), material, clock)
        }
        _ => admission::acquire_material(fire, id, target, source, git, clock),
    }
}
fn retain_inline(
    fire: &str,
    id: &str,
    target: Target,
    entries: Vec<(String, Vec<u8>)>,
    clock: &mut impl review::io::Clock,
) -> Result<(Manifest, persistence::MaterialStorage)> {
    let mut manifest = Manifest {
        manifest: id.into(),
        fire: fire.into(),
        contract: Contract::current(),
        target,
        entries: vec![],
    };
    let mut storage = persistence::MaterialStorage::default();
    for (index, (label, bytes)) in entries.into_iter().enumerate() {
        let observed = cadence::store::Observed {
            identity: cadence::store::model::digest(&bytes),
            bytes: Some(bytes),
            directory_identity: "inline".into(),
        };
        let retained = material::retain_file(
            &format!("{id}-inline-{index}"),
            fire,
            &label,
            Ok(observed),
            &mut storage,
            clock.now(),
        )?;
        manifest.entries.extend(retained.manifest.entries);
    }
    Ok((manifest, storage))
}

async fn execute_inner<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    root: &Path,
    command: Command,
) -> Answer {
    let command = match command {
        Command::Apply(Apply::Admit { request }) => {
            return admit(factory, root, request, AdmissionResolution::Refresh).await;
        }
        Command::ExecutionHandoff { phase, dispatch } => {
            return super::execution_service::review_handoff(
                factory,
                root,
                phase,
                dispatch.as_deref(),
            )
            .await;
        }
        command => command,
    };
    let session = factory.first_touch(root).await?;
    let store = session.review_store();
    let mut clock = review::material_io::WallClock;
    match command {
        Command::Query(query) => query_saved(store, root, query).await,
        Command::Apply(Apply::Observation { observation }) => output(
            "review-observation",
            review::attempts::record_observation(
                store,
                serde_json::from_value(observation)?,
                &mut clock,
            )
            .await?,
        ),
        Command::Apply(Apply::Return {
            identity,
            launch,
            failure_event,
            host_return,
            raw,
            findings,
            host_failure,
            citations,
        }) => {
            if let Some(event) = failure_event {
                if launch.is_some()
                    || host_return.is_some()
                    || raw.is_some()
                    || findings.is_some()
                    || !citations.is_empty()
                {
                    return Err(Error::Invalid(
                        "launch failure cannot carry return identity or raw findings".into(),
                    ));
                }
                let submitted = review::returns::LaunchFailureSubmission {
                    identity: serde_json::from_value(identity)?,
                    event: serde_json::from_value(event)?,
                    reason: host_failure.ok_or_else(|| {
                        Error::Invalid("definite launch failure reason required".into())
                    })?,
                };
                return match review::returns::accept_launch_failure(store, submitted, &mut clock)
                    .await
                {
                    Ok(receipt) => output("review-return", receipt),
                    Err(error) => output("review-return", error),
                };
            }
            let launch = launch.ok_or_else(|| Error::Invalid("unobserved-host-launch".into()))?;
            if let Some(raw) = &raw {
                let view = persistence::read(store).await?;
                let records = persistence::records(&view.snapshot.data)?;
                let saved = records["attempts"][identity["attempt"].as_str().unwrap_or("")]["original"].as_str()
                    .and_then(|id| persistence::get::<review::model::Original>(&records, "originals", id).ok());
                if findings.is_some() || saved.is_none_or(|original| original.raw != raw.as_bytes()) {
                    return Ok(Envelope::Refused { code: "typed-content".into(),
                        reason: "review-return requires typed findings; raw is only accepted for an exact retained replay".into() });
                }
            }
            let raw = raw
                .map(|s| review::stream::read_return(s.as_bytes(), 4 * 1024 * 1024))
                .transpose()
                .map_err(|e| Error::Invalid(format!("{e:?}")))?;
            let raw = match findings {
                Some(findings) => {
                    let bytes = serde_json::to_vec(&review::model::Findings { findings })?;
                    review::contract::validate_findings(&bytes)
                        .map_err(|error| Error::Invalid(format!("{error:?}")))?;
                    Some(bytes)
                }
                None => raw,
            };
            let submitted = review::returns::ReturnSubmission {
                identity: serde_json::from_value(identity)?,
                launch,
                host_return,
                raw,
                host_failure,
                citations: serde_json::from_value(json!(citations))?,
            };
            match review::returns::accept_return(store, submitted, &mut clock).await {
                Ok(receipt) => {
                    cadence::debug::review::synchronize(store, root).await?;
                    output("review-return", receipt)
                },
                Err(error) => output("review-return", error),
            }
        }
        Command::Apply(Apply::Enqueue { fire }) => {
            match deferred::enqueue_deferred(store, &fire, &mut clock).await {
                Ok(value) => output("review-enqueue", value),
                Err(error) => output("review-enqueue", error),
            }
        }
        Command::Apply(Apply::MaterialAppend {
            manifest,
            acquisition,
            path,
            label,
            bytes,
            delivered,
        }) => {
            let view = persistence::read(store).await?;
            let mut records = persistence::records(&view.snapshot.data)?;
            let saved: Manifest = persistence::get(&records, "manifests", &manifest)?;
            let mut storage = persistence::MaterialStorage::from_records(&records)?;
            let supplied: Option<(String, MaterialView)> =
                delivered.map(serde_json::from_value).transpose()?;
            let entry_id = format!(
                "{manifest}-extra-{}",
                cadence::store::model::digest(acquisition.as_bytes())
            );
            let original_delivery = if let Some((attempt, material_view)) = &supplied {
                let bound: Attempt = persistence::get(&records, "attempts", attempt)?;
                validate_material_delivery(
                    &records,
                    &bound,
                    &saved,
                    material_view,
                    &entry_id,
                    &bytes,
                )?
            } else {
                false
            };
            if let Some(prior) = records["appended"].get(&entry_id) {
                let entry: MaterialEntry = serde_json::from_value(prior.clone())?;
                if entry.acquisition != acquisition
                    || entry.path != path
                    || entry.label != label
                    || entry.content.as_deref() != Some(&cadence::store::model::digest(&bytes))
                {
                    return Err(Error::Conflict("appended acquisition is immutable".into()));
                }
                return output("review-material-append", material::entry_metadata(&entry)?);
            }
            let entry = material::append_material(
                &saved,
                material::AdditionalMaterial {
                    entry: entry_id,
                    role: MaterialRole::Supporting,
                    path,
                    label,
                    side: Side::Snapshot,
                    acquisition,
                    bytes,
                },
                supplied
                    .as_ref()
                    .filter(|_| original_delivery)
                    .map(|(attempt, view)| material::DeliveredMaterial { attempt, view }),
                &mut storage,
                &mut clock,
            )?;
            storage.contribute(&mut records)?;
            persistence::insert(&mut records, "appended", &entry.entry, &entry)?;
            persistence::update(store, &view, "material-append", records).await?;
            output("review-material-append", material::entry_metadata(&entry)?)
        }
        Command::Apply(Apply::Admit { .. }) => unreachable!(),
        Command::ExecutionHandoff { .. } => unreachable!(),
    }
}

fn validate_material_delivery(
    records: &Value,
    attempt: &Attempt,
    manifest: &Manifest,
    supplied: &MaterialView,
    entry: &str,
    bytes: &[u8],
) -> Result<bool> {
    if attempt.fire != manifest.fire
        || supplied.manifest != manifest.manifest
        || (supplied.view == attempt.view.view && supplied != &attempt.view)
    {
        return Err(Error::Invalid("unobserved material delivery".into()));
    }
    let saved = review::attempts::delivered_view(records, attempt, supplied)?;
    if !saved.delivery.view.entries.iter().any(|id| id == entry)
        || saved.delivery.contents.get(entry) != Some(&cadence::store::model::digest(bytes))
    {
        return Err(Error::Invalid("delivered content mismatch".into()));
    }
    Ok(supplied == &attempt.view)
}

#[cfg(test)]
use material::authorize_material_read;

async fn query_saved(store: &Store, root: &Path, query: Query) -> Answer {
    match query {
        Query::Original { original } if original.starts_with("historical:") => {
            historical_input(root, original.strip_prefix("historical:").unwrap())
        }
        Query::Consumer {
            consumer,
            attempt: Some(path),
            supplied: None,
        } if consumer == "historical-pause" => historical_input(root, &path),
        Query::Admission { fire } => output(
            "review-admission",
            admission::read_admission(store, &fire).await?,
        ),
        Query::Attempt { attempt } => {
            let view = persistence::read(store).await?;
            let records = persistence::records(&view.snapshot.data)?;
            let mut saved = serde_json::to_value(persistence::get::<Attempt>(&records, "attempts", &attempt)?)?;
            if let Some(evidence) = records["provider_evidence"].get(&attempt) {
                saved["provider_evidence"] = evidence.clone();
            }
            output("review-attempt", saved)
        }
        Query::Original { original } => {
            let mut value = serde_json::to_value(review::originals::read_original(store, &original).await?)?;
            value["record"].as_object_mut().unwrap().remove("raw");
            output("review-original", value)
        }
        Query::Roster { fire } => {
            let view = persistence::read(store).await?;
            let records = persistence::records(&view.snapshot.data)?;
            let attempts: Vec<Attempt> = collection::<Attempt>(&records, "attempts")?
                .into_values()
                .filter(|a| a.fire == fire)
                .collect();
            output(
                "review-roster",
                json!({"roster":review::recovery::read_roster(store, &fire).await?,"attempts":attempts}),
            )
        }
        Query::Material { attempt, entry } => {
            let view = persistence::read(store).await?;
            let records = persistence::records(&view.snapshot.data)?;
            let saved = material::authorized_entry(&records, &attempt, &entry)?;
            material::read_material(&mut persistence::MaterialStorage::from_records(&records)?, &saved)?;
            output(
                "review-material",
                json!({"entry":material::entry_metadata(&saved)?,"identity":{"kind":"review-entry","attempt":attempt,"entry":entry}}),
            )
        }
        Query::Deferred {} => output(
            "review-deferred",
            deferred::enumerate_deferred(store).await?,
        ),
        Query::Inventory {} => {
            let view = persistence::read(store).await?;
            output(
                "review-inventory",
                json!({"records":persistence::records(&view.snapshot.data)?,"deferred":deferred::enumerate_deferred(store).await?}),
            )
        }
        Query::Consumer {
            consumer,
            attempt,
            supplied,
        } => {
            if let Some(supplied) = supplied {
                let supplied: ConsumerView = serde_json::from_value(supplied)?;
                let value = match consumer.as_str() {
                    "execute-fix" => review::views::execute_fix_input(&supplied)?,
                    "planned-task-fix" => review::views::planned_task_fix_input(&supplied)?,
                    "view" => review::views::consumer_view(&supplied),
                    _ => return Err(Error::Invalid("unknown supplied-view consumer".into())),
                };
                return output("review-consumer", value);
            }
            if matches!(consumer.as_str(), "landing" | "milestone") {
                let view = persistence::read(store).await?;
                let records = persistence::records(&view.snapshot.data)?;
                let mut entries = Vec::new();
                for admission in collection::<Admission>(&records, "admissions")?.into_values() {
                    let saved_views: Vec<ConsumerView> = records
                        .get("views")
                        .and_then(|v| v.get(&admission.fire))
                        .cloned()
                        .map(serde_json::from_value)
                        .transpose()?
                        .unwrap_or_default();
                    let settled = saved_views.iter().find(|v| v.kind == ViewKind::Settled);
                    let raw = saved_views.iter().find(|v| v.kind == ViewKind::Raw);
                    let queued: Option<deferred::QueuedMember> = records
                        .get("deferred")
                        .and_then(|v| v.get(&admission.fire))
                        .cloned()
                        .map(serde_json::from_value)
                        .transpose()?;
                    entries.push(review::inventory::InventoryEntry {
                        fire: admission.fire,
                        round: admission.round,
                        trigger: admission.trigger,
                        gate: admission.gate,
                        review_rendering: raw.and_then(|v| v.rendering.clone()),
                        adjudication_rendering: settled.and_then(|v| v.rendering.clone()),
                        adjudication: settled.and_then(|v| v.adjudication.clone()),
                        deferred: queued.map(|q| q.record),
                    });
                }
                return if consumer == "landing" {
                    output(
                        "review-consumer",
                        review::inventory::landing_inventory(&entries),
                    )
                } else {
                    output(
                        "review-consumer",
                        json!({"renderings":review::inventory::milestone_review_inputs(&entries),"entries":entries,"records":records}),
                    )
                };
            }
            let attempt =
                attempt.ok_or_else(|| Error::Invalid("consumer attempt required".into()))?;
            let input = match consumer.as_str() {
                "plan-completion" => consumers::plan_completion_input(store, &attempt).await?,
                "execute-completion" => {
                    consumers::execute_completion_input(store, &attempt).await?
                }
                "report" => consumers::report_review_input(store, &attempt).await?,
                "deferred-enqueue" => consumers::deferred_enqueue_input(store, &attempt).await?,
                "specialist" => consumers::read_specialist_result(store, &attempt).await?,
                _ => return Err(Error::Invalid("unknown review consumer".into())),
            };
            output("review-consumer", input)
        }
        Query::Next { fire } => next(store, &fire).await,
        Query::Select {
            command,
            arguments,
            replay_key,
        } => {
            let view = persistence::read(store).await?;
            select(root, &view.snapshot.data, &command, &arguments, replay_key)
        }
    }
}

/// Resolve the selection against the real files and the snapshot, and hand
/// back the exact review-admit request. Read-only: nothing is admitted here.
fn select(
    root: &Path,
    data: &Value,
    command: &str,
    arguments: &[String],
    replay_key: Option<String>,
) -> Answer {
    let project_root = root
        .parent()
        .ok_or_else(|| Error::Invalid("project root unavailable".into()))?;
    let mut source = review::material_io::SourceFiles {
        root: project_root.into(),
    };
    let selected = match review::selection::select(command, arguments, &mut source, data) {
        Ok(selected) => selected,
        Err(refusal) => {
            return Ok(Envelope::Refused {
                code: refusal.code.into(),
                reason: refusal.reason,
            });
        }
    };
    let kind = selected.kind;
    let (caller, trigger, specialist) = match kind {
        review::selection::Kind::Decision => ("cad-review", Value::Null, json!("decision")),
        review::selection::Kind::Minimalism => ("cad-review", Value::Null, json!("minimalism")),
        review::selection::Kind::Plan => ("manual-plan", json!("plan"), Value::Null),
    };
    let home = match selected.phase {
        Some(phase) => json!({"kind":"phase","id":phase.to_string()}),
        None => json!({"kind":"root-inline","id":format!("select-{}", &selected.discriminator[..16])}),
    };
    let admission = json!({
        "replay_key":replay_key.unwrap_or_else(|| format!("review-select:{}", selected.discriminator)),
        "caller":caller,"trigger":trigger,"specialist":specialist,
        "project":project_root.to_string_lossy(),"cycle":"live","home":home,
        "discriminator":selected.discriminator,"phase":selected.phase,"plan":null,"anchor":null,"round":1,
        "target":selected.target,"decision":selected.decision,"risk_observation":null,"selection":selected.selection,
    });
    output(
        "review-select",
        json!({"command":command,"canonical":review::selection::CANONICAL,"kind":kind,"aliases":[kind.alias()],
            "target":selected.target,"material":selected.material,"intent":review::instructions::intent_for(kind),
            "discriminator":selected.discriminator,"admission":admission}),
    )
}

pub(super) async fn next(store: &Store, fire: &str) -> Answer {
    let view = persistence::read(store).await?;
    let mut records = persistence::records(&view.snapshot.data)?;
    let admission: Admission = persistence::get(&records, "admissions", fire)?;
    let attempts: Vec<Attempt> = collection::<Attempt>(&records, "attempts")?
        .into_values()
        .filter(|a| a.fire == fire)
        .collect();
    let mut outcomes = BTreeMap::new();
    for a in &attempts {
        if a.state == AttemptState::Intended && records["issued"].get(&a.attempt).is_none() {
            continue;
        }
        // Selection advances only on the existing durable acknowledgment, for
        // providers and local returns alike. A terminal-looking attempt alone
        // is not permission to issue its successor.
        if matches!(a.state, AttemptState::Accepted | AttemptState::Failed)
            && records["closures"].get(&a.attempt).is_none()
        {
            return Err(Error::Invalid("missing-terminal-closure".into()));
        }
        let raw = match &a.original {
            Some(id) => Some(
                String::from_utf8(review::originals::read_original(store, id).await?.raw_bytes)
                    .map_err(|_| Error::Invalid("saved raw return is not UTF-8".into()))?,
            ),
            None => None,
        };
        outcomes.insert(
            a.slot.clone(),
            selection::AttemptOutcome {
                attempt: a.attempt.clone(),
                state: a.state.clone(),
                raw,
                usage: Some(a.usage.clone()),
            },
        );
    }
    let mut fallback_for = None;
    let (requested, completion, not_selected) = if admission.selection.mode == SelectionMode::Single
    {
        let selected = selection::select_next(&admission.selection, &outcomes);
        (selected.request, selected.state, selected.not_selected)
    } else {
        let roster = selection::dispatch_roster(&selection::PanelAdmission {
            combination: admission.selection.mode.clone(),
            slots: admission
                .roster
                .required
                .iter()
                .map(|voice| selection::RequiredSlot {
                    voice: voice.clone(),
                    fallback: admission.selection.fallback.clone().filter(|f| f != voice),
                })
                .collect(),
        });
        let mut slots = BTreeMap::new();
        let mut request = None;
        for voice in &roster.required_requests {
            match outcomes.get(voice) {
                None => {
                    if request.is_none() {
                        request = Some(voice.clone());
                    }
                }
                Some(primary) => {
                    let fallback_slot = format!("{voice}:fallback");
                    let fallback = outcomes.get(&fallback_slot).cloned();
                    if primary.state == AttemptState::Failed
                        && roster.fallbacks[voice].is_some()
                        && fallback.is_none()
                        && request.is_none()
                    {
                        request = Some(fallback_slot);
                        fallback_for = Some(voice.clone());
                    }
                    slots.insert(
                        voice.clone(),
                        selection::SlotOutcome {
                            primary: primary.clone(),
                            fallback,
                        },
                    );
                }
            }
        }
        (
            request,
            selection::delivery_completion(&roster, &slots),
            vec![],
        )
    };
    if let Some(slot) = requested {
        let attempt = match attempts.iter().find(|a| a.slot == slot) {
            Some(attempt) => attempt.clone(),
            None => {
                let mut attempt = attempts
                    .first()
                    .ok_or_else(|| Error::Invalid("empty saved roster".into()))?
                    .clone();
                // A provider's fenced entries belong to that provider attempt.
                // The local host receives the retained admission view, not
                // another attempt's private transformed delivery.
                if let Some(source) = records["provider_payloads"][&attempt.attempt].get("source_view") {
                    attempt.view = serde_json::from_value(source.clone())?;
                }
                let route: cadence::execution::model::RoleResolution = serde_json::from_value({
                    let mut route =
                        records["routes"][&attempt.requested.selection_evidence].clone();
                    for field in [
                        "generation",
                        "config_diagnostics",
                        "policy",
                        "floor",
                        "deep_verification",
                    ] {
                        route
                            .as_object_mut()
                            .ok_or_else(|| Error::Invalid("missing saved route".into()))?
                            .remove(field);
                    }
                    route
                })?;
                attempt.attempt = format!("{fire}-a{}", attempts.len() + 1);
                attempt.slot = slot;
                attempt.fallback_for = fallback_for;
                attempt.requested.agent = route.agent;
                attempt.requested.model = route.model;
                attempt.requested.effort = Some(route.rung);
                attempt.view.view = format!("{}-view", attempt.attempt);
                attempt.state = AttemptState::Intended;
                attempt.launch = None;
                attempt.host_return = None;
                attempt.original = None;
                attempt.observed_host = None;
                attempt.observed_model = None;
                attempt.failure = None;
                attempt.observations.clear();
                attempt.usage = Usage {
                    input: None,
                    output: None,
                    cost: None,
                    currency: None,
                };
                persistence::insert(&mut records, "attempts", &attempt.attempt, &attempt)?;
                attempt
            }
        };
        persistence::insert(
            &mut records,
            "issued",
            &attempt.attempt,
            &json!({"attempt":attempt.attempt,"state":"issued"}),
        )?;
        persistence::update(store, &view, &format!("issue:{}", attempt.attempt), records).await?;
        if review::provider::Provider::parse(&attempt.requested.agent).is_some() {
            let environment = review::provider::delivery::Environment::default();
            let owned_store = store.clone();
            let attempt_id = attempt.attempt.clone();
            tokio::spawn(async move {
                if let Err(error) = review::provider::delivery::run(owned_store, attempt_id, environment).await {
                    eprintln!("provider delivery: {}", review::provider::diagnostics::excerpt(&error.to_string()));
                }
            });
            return output("review-next", json!({"state":"pending","attempt":attempt,"admission":admission,
                "guidance":PROVIDER_POLL_GUIDANCE}));
        }
        return output(
            "review-next",
            json!({"state":"dispatch","dispatch":review::invoking::local_dispatch(&admission,&attempt),"attempt":attempt,"admission":admission,
                "guidance":"WAIT: run this local dispatch once. Read retained material through document review-entry identities and their bounded parts. Forward actual launch and return events with cadence_apply review-observation; submit the unchanged five-field findings array with review-return using this admission/attempt identity, launch and host_return. For definite launch failure, use failure_event and host_failure without launch or findings. For missing or malformed host output, report host_failure without findings. Wait for the durable review-return digest/count acknowledgment, then poll review-next."}),
        );
    }
    let mut changed = false;
    for mut attempt in attempts {
        if not_selected.contains(&attempt.slot)
            && attempt.state == AttemptState::Intended
            && records["issued"].get(&attempt.attempt).is_none()
        {
            attempt.state = AttemptState::NotSelected;
            persistence::put(&mut records, "attempts", &attempt.attempt, &attempt)?;
            changed = true;
        }
    }
    if changed {
        persistence::update(store, &view, "not-selected", records.clone()).await?;
    }
    let delivery = match completion {
        selection::Completion::Incomplete => DeliveryState::Pending,
        selection::Completion::UsableComplete => DeliveryState::UsableComplete,
        selection::Completion::CompleteWithFailure => DeliveryState::CompleteWithFailure,
    };
    let action = admission
        .gate
        .as_ref()
        .map(|gate| review::policy::ordinary_gate_action(gate, &delivery, &admission.settlement));
    output(
        "review-next",
        json!({"state":"delivery","completion":completion,"delivery":delivery,"action":action,"deferred":records["deferred"][fire],"admission":admission,
            "guidance":PROVIDER_POLL_GUIDANCE}),
    )
}

const PROVIDER_POLL_GUIDANCE: &str = "Provider work belongs to the resident binary. Poll cadence_query review-next with the same fire while pending; canceling a poll does not cancel or restart a paid request. Wait for durable closure before advancing. If local dispatch is returned, run it once and follow its WAIT/observation/unchanged-return acknowledgment contract. After a killed binary, interrupted or uncertain work requires recovery, never automatic resend.";

pub async fn execute<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    root: &Path,
    command: Command,
) -> Answer {
    let inner = execute_inner(factory, root, command).await;
    match inner {
        Err(Error::Invalid(reason)) => Ok(refused(reason)),
        answer => answer,
    }
}

pub(super) fn execution_continuation(delivery: &Value) -> &'static str {
    match delivery["action"].as_str() {
        Some("continue" | "off") => "continue",
        Some("enqueue-before-continuation") if !delivery["deferred"].is_null() => "continue",
        Some("wait-for-settlement") => "wait-for-settlement",
        _ => "wait-for-delivery",
    }
}

pub async fn pending_execution(store: &Store, phase: u32) -> Answer {
    let view = persistence::read(store).await?;
    let records = persistence::records(&view.snapshot.data)?;
    for admission in collection::<Admission>(&records, "admissions")?
        .into_values()
        .filter(|a| {
            a.caller == "execute"
                && a.home.kind == HomeKind::Phase
                && a.home.id == phase.to_string()
        })
    {
        let answer = next(store, &admission.fire).await?;
        if let Envelope::Ok(ref output) = answer
            && execution_continuation(&output.result) == "continue"
        {
            continue;
        }
        return Ok(answer);
    }
    output("review-handoff", json!({"pending":false}))
}

fn historical_input(root: &Path, path: &str) -> Answer {
    use review::history::{HistoricalFiles, HistoricalIo};
    let raw = HistoricalFiles { root: root.into() }.read(path)?;
    struct RetainedBytes(Vec<u8>);
    impl HistoricalIo for RetainedBytes {
        fn read(&mut self, _: &str) -> std::io::Result<Vec<u8>> {
            Ok(self.0.clone())
        }
    }
    let origin = review::history::read_pause_origin(&mut RetainedBytes(raw.clone()), path)?;
    output("review-original", json!({"origin":origin,"content":cadence::store::model::digest(&raw)}))
}

#[cfg(test)]
#[path = "review_service_tests.rs"]
mod tests;

#[cfg(test)]
mod gap151_adapter_tests {
    use super::*;

    #[test]
    fn gap151_continuation_projects_delivery_responses() {
        for (delivery, expected) in [
            (json!({"state":"pending"}), "wait-for-delivery"),
            (
                json!({"action":"continue","delivery":"accepted","gate":"advisory"}),
                "continue",
            ),
            (
                json!({"action":"enqueue-before-continuation","deferred":null}),
                "wait-for-delivery",
            ),
            (
                json!({"action":"enqueue-before-continuation","deferred":{"fire":"f1"}}),
                "continue",
            ),
            (
                json!({"action":"wait-for-settlement","gate":"blocking"}),
                "wait-for-settlement",
            ),
            (
                json!({"action":"wait-for-settlement","gate":"adjudicated"}),
                "wait-for-settlement",
            ),
        ] {
            assert_eq!(execution_continuation(&delivery), expected);
        }
    }
}

#[cfg(test)]
mod gap153_service_tests {
    use super::*;

    fn input(view: &str, entry: &str) -> (Value, Attempt, Manifest, MaterialView) {
        let h: Value =
            serde_json::from_str(include_str!("../tests/fixtures/phase9/h1-admission.json"))
                .unwrap();
        let mut attempt: Attempt = serde_json::from_value(h["a1"].clone()).unwrap();
        attempt.state = AttemptState::Accepted;
        attempt.launch = Some("launch1".into());
        let manifest = serde_json::from_value(h["m1"].clone()).unwrap();
        let supplied = MaterialView {
            view: view.into(),
            manifest: "m1".into(),
            entries: vec![entry.into()],
        };
        let delivery = MaterialDelivery {
            fire: "f1".into(),
            view: supplied.clone(),
            contents: [(entry.into(), cadence::store::model::digest(b"old\n"))].into(),
        };
        let key = cadence::store::model::digest(format!("[\"a1\",\"{view}\"]").as_bytes());
        let event = Observation {
            observation: "obs1".into(),
            attempt: "a1".into(),
            launch: None,
            host_return: None,
            kind: ObservationKind::MaterialDelivery(delivery.clone()),
            reference: "event:1".into(),
            observed_at: 100,
            host: None,
            model: None,
            usage: attempt.usage.clone(),
            contract: attempt.contract.clone(),
        };
        let records = json!({"deliveries":{key:{"observation":"obs1","attempt":"a1","delivery":delivery}},"observations":{"obs1":event},
            "closures":{"a1":{"terminal":"accepted","acknowledged_at":100}}});
        (records, attempt, manifest, supplied)
    }
    #[test]
    fn gap153_forged_original_membership_refuses_without_mutation() {
        let (records, attempt, manifest, mut supplied) = input("v1", "e1");
        supplied.entries.push("e4".into());
        let prior = records.clone();
        assert!(
            validate_material_delivery(&records, &attempt, &manifest, &supplied, "e4", b"old\n")
                .is_err()
        );
        assert_eq!(records, prior);
    }
    #[test]
    fn gap153_manifest_attempt_and_unrecorded_delivery_refuse() {
        let (records, attempt, manifest, supplied) = input("v2", "e3");
        let mut foreign = supplied.clone();
        foreign.manifest = "foreign".into();
        assert!(
            validate_material_delivery(&records, &attempt, &manifest, &foreign, "e3", b"old\n")
                .is_err()
        );
        let mut other = attempt.clone();
        other.attempt = "a2".into();
        assert!(
            validate_material_delivery(&records, &other, &manifest, &supplied, "e3", b"old\n")
                .is_err()
        );
        let mut absent = records.clone();
        absent["deliveries"] = json!({});
        assert!(
            validate_material_delivery(&absent, &attempt, &manifest, &supplied, "e3", b"old\n")
                .is_err()
        );
    }
    #[test]
    fn gap153_a_distinct_recorded_view_validates_but_is_not_the_original() {
        let (records, attempt, manifest, supplied) = input("v2", "e3");
        assert!(
            !validate_material_delivery(&records, &attempt, &manifest, &supplied, "e3", b"old\n")
                .unwrap()
        );
    }

    #[test]
    fn a_supplied_view_with_an_entry_outside_the_recorded_delivery_is_refused() {
        let (records, attempt, manifest, mut supplied) = input("v2", "e3");
        supplied.entries.push("e4".into());
        assert!(
            validate_material_delivery(&records, &attempt, &manifest, &supplied, "e3", b"old\n")
                .is_err()
        );
    }
    #[test]
    fn gap153_read_requires_authoritative_delivered_membership() {
        let (records, attempt, manifest, _) = input("v2", "e3");
        let mut entry = manifest.entries[0].clone();
        entry.entry = "e4".into();
        entry.attempt = Some("a1".into());
        assert!(authorize_material_read(&records, &attempt, &manifest, &entry).is_err());
        entry.entry = "e3".into();
        assert!(authorize_material_read(&records, &attempt, &manifest, &entry).is_ok());
    }
}

#[cfg(test)]
mod gap155_voice_tests {
    use super::*;
    #[test]
    fn gap155_minimalism_ignores_pinned_and_failed_ordinary_routes() {
        let manifest = Manifest {
            manifest: "m1".into(),
            fire: "f1".into(),
            contract: Contract::current(),
            target: Target::NamedFile {
                path: "a.rs".into(),
                head: None,
            },
            entries: vec![],
        };
        for ordinary in [
            Ok(RequestedVoice {
                agent: "panel".into(),
                model: Some("opus".into()),
                effort: Some("high".into()),
                routing: Some(Routing {
                    answer: "panel".into(),
                    evidence: "ordinary".into(),
                }),
                selection_evidence: "ordinary".into(),
            }),
            Err(Error::Policy("ordinary routing unavailable".into())),
        ] {
            let voice =
                requested_voice(Some(&Specialist::Minimalism), &manifest, || ordinary).unwrap();
            assert_eq!(
                serde_json::to_value(voice).unwrap(),
                json!({"agent":"cad-reviewer","model":null,"effort":null,
                "routing":null,"selection_evidence":"minimalism:m1"})
            );
        }
    }
}
