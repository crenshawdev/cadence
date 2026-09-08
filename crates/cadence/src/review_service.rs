//! Resident adapter for the independently implemented review units.
use crate::config::{merge, reload::ConfigIo};
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
        host_failure: Option<String>,
        citations: Vec<Value>,
    },
    #[serde(rename = "review-material-append")]
    MaterialAppend {
        manifest: String,
        acquisition: String,
        path: Option<String>,
        label: Option<String>,
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
) -> Answer {
    let request = decode_admission(value)?;
    let session = factory.first_touch(root).await?;
    let store = session.review_store();
    let view = persistence::read(store).await?;
    let records = persistence::records(&view.snapshot.data)?;
    if let Some(replay) = records
        .get("replays")
        .and_then(|r| r.get(&request.replay_key))
    {
        return output(
            "review-admit",
            json!({"fire":replay["fire"],"attempt":replay["attempt"],"replayed":true}),
        );
    }
    validate_paths(&request.target)?;
    let generation = session.config()?;
    let route = super::config_service::route_at(
        &generation,
        &super::config_service::RouteRequest {
            role: "cad-reviewer".into(),
            phase: request.phase,
            plan: request.plan,
            attempt: None,
        },
        root,
    )?;
    let sequence = records["occurrence_sequence"]
        .as_u64()
        .unwrap_or(0)
        .checked_add(1)
        .ok_or_else(|| Error::Invalid("occurrence overflow".into()))?;
    let fire = format!("f{sequence}");
    let manifest_id = format!("m{sequence}");
    let home_path = home_path(&request.home, &fire)?;
    let home = Home {
        kind: request.home.kind,
        id: request.home.id,
        occurrence: String::new(),
    };
    let routing = Routing {
        answer: route.choice.agent.clone(),
        evidence: format!("route:{fire}"),
    };
    let (gate, trigger, selection, saved_routing) = if let Some(trigger) = &request.trigger {
        let name = serde_json::to_value(trigger)?.as_str().unwrap().to_owned();
        let policy = route
            .policy
            .triggers
            .get(&name)
            .ok_or_else(|| Error::Policy("unknown review trigger".into()))?;
        let gate: Gate = serde_json::from_value(json!(policy.gate))?;
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
        if ordinary.policy.gate == Gate::Off {
            return output(
                "review-admit",
                json!({"gate":"off","fire":null,"dispatch":null}),
            );
        }
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
    let project_root = root
        .parent()
        .ok_or_else(|| Error::Invalid("project root unavailable".into()))?;
    let mut source = review::material_io::SourceFiles {
        root: project_root.into(),
    };
    let mut git = review::material_io::SourceGit {
        root: project_root.into(),
    };
    let mut clock = review::material_io::WallClock;
    let (manifest, storage) = acquire_target(
        &fire,
        &manifest_id,
        &request.target,
        request.decision.as_ref(),
        &mut source,
        &mut git,
        &mut clock,
    )?;
    match request.specialist {
        Some(Specialist::Minimalism) => {
            review::specialist::minimalism_request(&manifest, &routing)
                .map_err(|e| Error::Invalid(e.into()))?;
        }
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
            Attempt {
                attempt: format!("{fire}-a{}", index + 1),
                fire: fire.clone(),
                occurrence: String::new(),
                round: request.round,
                slot: choice.clone(),
                fallback_for: None,
                view: MaterialView {
                    view: format!("{fire}-v{}", index + 1),
                    manifest: manifest_id.clone(),
                    entries: manifest.entries.iter().map(|e| e.entry.clone()).collect(),
                },
                requested: RequestedVoice {
                    agent: if choice == "base" {
                        "cad-reviewer".into()
                    } else if local {
                        route.choice.agent.clone()
                    } else {
                        choice.clone()
                    },
                    model,
                    effort: Some(route.choice.rung.clone()),
                    routing: saved_routing.clone(),
                    selection_evidence: routing.evidence.clone(),
                },
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
        })
        .collect();
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
    persistence::insert(&mut data, "routes", &routing.evidence, &route)?;
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
    if session.config()? != generation {
        return Err(Error::Conflict("review routing inputs changed".into()));
    }
    commit_admission(
        contribution,
        persistence::commit(store, &view, transaction),
        admission::acknowledge_admission,
    )
    .await
}

async fn commit_admission<C, V>(
    contribution: C,
    commit: impl std::future::Future<Output = Result<V>>,
    acknowledge: impl FnOnce(&V, C) -> Result<admission::AdmissionReply>,
) -> Answer {
    let committed = commit.await?;
    output("review-admit", acknowledge(&committed, contribution)?)
}

fn acquire_target(
    fire: &str,
    id: &str,
    target: &Target,
    decision: Option<&review::targets::DecisionMaterial>,
    source: &mut impl review::io::MaterialIo,
    git: &mut impl review::io::GitIo,
    clock: &mut impl review::io::Clock,
) -> Result<(Manifest, persistence::MaterialStorage)> {
    match target {
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
    struct InlineSource {
        label: String,
        bytes: Vec<u8>,
    }
    impl review::io::MaterialIo for InlineSource {
        fn read(&mut self, path: &str) -> Result<cadence::store::Observed> {
            if path != self.label {
                return Err(Error::Invalid("unknown inline input".into()));
            }
            Ok(cadence::store::Observed {
                identity: cadence::store::model::digest(&self.bytes),
                bytes: Some(self.bytes.clone()),
                directory_identity: "inline".into(),
            })
        }
        fn list(&mut self, _: &str) -> Result<review::io::DirectoryObservation> {
            Err(Error::Invalid("inline input has no directory".into()))
        }
    }
    for (index, (label, bytes)) in entries.into_iter().enumerate() {
        let mut source = InlineSource {
            label: label.clone(),
            bytes,
        };
        let retained = material::retain_file(
            &format!("{id}-inline-{index}"),
            fire,
            &label,
            &mut source,
            &mut storage,
            clock,
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
    if let Command::Apply(Apply::Admit { request }) = command {
        return admit(factory, root, request).await;
    }
    let session = factory.first_touch(root).await?;
    let store = session.review_store();
    let mut clock = review::material_io::WallClock;
    match command {
        Command::ExecutionHandoff { phase, dispatch } => {
            super::execution_service::review_handoff(factory, root, phase, dispatch.as_deref())
                .await
        }
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
            host_failure,
            citations,
        }) => {
            if let Some(event) = failure_event {
                if launch.is_some()
                    || host_return.is_some()
                    || raw.is_some()
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
            let raw = raw
                .map(|s| review::stream::read_return(s.as_bytes(), 4 * 1024 * 1024))
                .transpose()
                .map_err(|e| Error::Invalid(format!("{e:?}")))?;
            let submitted = review::returns::ReturnSubmission {
                identity: serde_json::from_value(identity)?,
                launch,
                host_return,
                raw: raw.map(|b| review::forward::forward_return(&b).submitted_bytes),
                host_failure,
                citations: serde_json::from_value(json!(citations))?,
            };
            match review::returns::accept_return(store, submitted, &mut clock).await {
                Ok(receipt) => output("review-return", receipt),
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
                return output("review-material-append", entry);
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
            output("review-material-append", entry)
        }
        Command::Apply(Apply::Admit { .. }) => unreachable!(),
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

fn authorize_material_read(
    records: &Value,
    attempt: &Attempt,
    manifest: &Manifest,
    entry: &MaterialEntry,
) -> Result<()> {
    if manifest.fire != attempt.fire || manifest.manifest != attempt.view.manifest {
        return Err(Error::Invalid("foreign material manifest".into()));
    }
    if attempt.view.entries.contains(&entry.entry) && manifest.entries.contains(entry) {
        return Ok(());
    }
    for record in collection::<DeliveryRecord>(records, "deliveries")?.into_values() {
        if record.attempt == attempt.attempt
            && record.delivery.view.manifest == manifest.manifest
            && record.delivery.view.entries.contains(&entry.entry)
            && record.delivery.contents.get(&entry.entry) == entry.content.as_ref()
        {
            review::attempts::delivered_view(records, attempt, &record.delivery.view)?;
            return Ok(());
        }
    }
    Err(Error::Invalid("entry outside retained attempt view".into()))
}

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
        Query::Attempt { attempt } => output(
            "review-attempt",
            review::attempts::read_attempt(store, &attempt).await?,
        ),
        Query::Original { original } => output(
            "review-original",
            review::originals::read_original(store, &original).await?,
        ),
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
            let attempt: Attempt = persistence::get(&records, "attempts", &attempt)?;
            let manifest: Manifest =
                persistence::get(&records, "manifests", &attempt.view.manifest)?;
            let appended = collection::<MaterialEntry>(&records, "appended")?;
            let saved = manifest
                .entries
                .iter()
                .find(|e| e.entry == entry)
                .or_else(|| appended.get(&entry))
                .ok_or_else(|| Error::Invalid("unknown retained entry".into()))?;
            authorize_material_read(&records, &attempt, &manifest, saved)?;
            output(
                "review-material",
                json!({"entry":saved,"bytes":material::read_material(&mut persistence::MaterialStorage::from_records(&records)?,saved)?}),
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
    }
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
        return output(
            "review-next",
            json!({"state":"dispatch","dispatch":review::invoking::local_dispatch(&admission,&attempt),"attempt":attempt,"admission":admission}),
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
        json!({"state":"delivery","completion":completion,"delivery":delivery,"action":action,"deferred":records["deferred"][fire],"admission":admission}),
    )
}

pub async fn execute<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    root: &Path,
    command: Command,
) -> Answer {
    match execute_inner(factory, root, command).await {
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
        if let Envelope::Ok(ref output) = answer {
            if execution_continuation(&output.result) == "continue" {
                continue;
            }
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
    output("review-original", json!({"origin":origin,"raw_bytes":raw}))
}

#[cfg(test)]
#[path = "review_service_tests.rs"]
mod tests;

#[cfg(test)]
mod gap151_adapter_tests {
    use super::*;

    #[tokio::test]
    async fn gap151_commit_confirms_before_exposing_identity() {
        let answer = commit_admission(("f1", "a1"), async { Ok(100) }, |saved, contribution| {
            assert_eq!(*saved, 100);
            Ok(admission::AdmissionReply::Admitted {
                fire: contribution.0.into(),
                attempt: contribution.1.into(),
                replayed: false,
            })
        })
        .await
        .unwrap();
        assert_eq!(
            serde_json::to_value(answer).unwrap(),
            json!({"status":"ok","operation":"review-admit","result":{"fire":"f1","attempt":"a1","replayed":false}})
        );
    }

    #[tokio::test]
    async fn gap151_commit_failure_exposes_no_response() {
        for failure in [
            Error::Conflict("revision".into()),
            Error::Invalid("sync failed".into()),
        ] {
            let answer =
                commit_admission("contribution", async { Err::<(), _>(failure) }, |_, _| {
                    panic!("unconfirmed acknowledgment")
                })
                .await;
            assert!(answer.is_err());
        }
    }

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
    fn gap153_distinct_recorded_view_preserves_original() {
        let (records, attempt, manifest, mut supplied) = input("v2", "e3");
        assert!(
            !validate_material_delivery(&records, &attempt, &manifest, &supplied, "e3", b"old\n")
                .unwrap()
        );
        assert_eq!(
            attempt.view,
            MaterialView {
                view: "v1".into(),
                manifest: "m1".into(),
                entries: vec!["e1".into()]
            }
        );
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
