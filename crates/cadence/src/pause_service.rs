//! Internal pause request. Durable answers precede dependent Git operations.
use cadence::process::Process;
use super::derivation_service::{self, Driver};
use crate::{
    config::{
        Layer, merge,
        reload::{ConfigIo, Generation},
    },
    import::{Session, SessionFactory},
};
use cadence::{
    evidence::{
        self, Fact, Record, Scope,
        gates::{Disposition, Gate, State},
        overrides::{Authorization, Meaning, Override, ReviewReceipt, SettledCounts},
        persistence,
    },
    pause::{
        self, Capture, Input, ResumeInvocation,
        branch::{self, Integration, Policy},
        git,
        risk::{self, CommitKind, Consequence, Outcome, Review},
    },
    rail::risk_diff,
    store::{Error, Result, writer::View},
};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Component, Path, PathBuf},
};

#[derive(Clone, Debug)]
pub enum Response {
    Ready(Box<Capture>),
    Review(Box<RiskNeed>),
    Wait(Box<Gate>),
    Refused(String),
}

#[derive(Clone, Debug)]
pub struct RiskNeed {
    pub gate: Gate,
    pub fire: risk::Fire,
}

#[derive(serde::Serialize)]
struct PauseDeliveryRequest<'a> {
    fire: &'a str,
    attempt: &'a str,
    fields: [&'static str; 5],
}

fn pause_delivery_request(delivery: &risk::ModernDelivery) -> PauseDeliveryRequest<'_> {
    PauseDeliveryRequest {
        fire: &delivery.fire,
        attempt: &delivery.attempt,
        fields: ["file", "line", "severity", "claim", "failure_scenario"],
    }
}

/// New pause admissions enter the same native producer boundary as other
/// ordinary reviews. This does not grant historical raw-result clearance.
pub async fn modern_admission(
    resident: &super::recall::Resident,
    planning: &Path,
    request: serde_json::Value,
) -> super::review_service::Answer {
    use super::review_service::{Apply, Command};
    use cadence::envelope::Envelope;
    let target =
        serde_json::from_value::<cadence::review::model::Target>(request["target"].clone());
    if request["caller"] != "pause"
        || request["trigger"] != "risk_surface"
        || !request["specialist"].is_null()
    {
        return Ok(super::review_service::refused(
            "modern pause requires the ordinary risk_surface trigger",
        ));
    }
    match target.and_then(|target| risk::modern_target(&target).map_err(serde::de::Error::custom)) {
        Ok(()) => {}
        Err(error) => return Ok(super::review_service::refused(error.to_string())),
    }
    let mut answer = resident
        .review(planning, Command::Apply(Apply::Admit { request }))
        .await?;
    if matches!(&answer, Envelope::Ok(output) if matches!(output.result["action"].as_str(), Some("ask-surfaces" | "wait-for-evidence" | "no-review")))
    {
        return Ok(answer);
    }
    if let Envelope::Ok(output) = &mut answer
        && let (Some(fire), Some(attempt)) = (
            output.result["fire"].as_str(),
            output.result["attempt"].as_str(),
        )
    {
        let delivery = risk::ModernDelivery {
            fire: fire.into(),
            attempt: attempt.into(),
            findings: vec![],
        };
        output.result["delivery_request"] =
            serde_json::to_value(pause_delivery_request(&delivery))?;
    }
    Ok(answer)
}

/// The branch policy every git-touching operation reads from the effective
/// configuration; task-open shares it rather than reading the keys twice.
pub(crate) fn policy(config: &Generation) -> Result<Policy> {
    let values = &config.effective.values;
    let string = |key| {
        merge::get(values, key)
            .and_then(serde_json::Value::as_str)
            .map(str::to_owned)
            .ok_or_else(|| Error::Policy(format!("missing effective {key}")))
    };
    let protected = merge::get(values, "git.protected_branches")
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| Error::Policy("missing effective protected branches".into()))?
        .iter()
        .map(|v| {
            v.as_str()
                .map(str::to_owned)
                .ok_or_else(|| Error::Policy("invalid protected branch".into()))
        })
        .collect::<Result<_>>()?;
    Ok(Policy {
        protected,
        on_protected: string("git.on_protected")?,
        base: merge::get(values, "git.base_branch")
            .and_then(serde_json::Value::as_str)
            .map(str::to_owned),
        integration: string("git.integration_branch")?,
        auto_branch: string("git.auto_branch")?,
    })
}

enum Choice {
    Proceed,
    Create(String),
    Wait(Box<Gate>),
    Stop,
}

/// The recorded question in this occurrence that `pending` repeats, if any.
/// A recorded question that no longer reads the same refuses.
fn existing_gate(
    records: &BTreeMap<String, Record>,
    scope: &Scope,
    pending: &Gate,
) -> Result<Option<Gate>> {
    let existing = records.values().find_map(|record| {
        if record.scope == *scope
            && let Fact::Gate(gate) = &record.fact
            && gate.id == pending.id
        {
            Some(gate)
        } else {
            None
        }
    });
    let Some(gate) = existing else {
        return Ok(None);
    };
    let mut question = gate.clone();
    question.state = State::Unanswered;
    if question != *pending {
        return Err(Error::Conflict("pause question changed".into()));
    }
    Ok(Some(gate.clone()))
}

async fn recorded_gate<I: ConfigIo>(
    session: &Session<I>,
    scope: &Scope,
    view: &mut View,
    pending: Gate,
) -> Result<Gate> {
    if let Some(gate) = existing_gate(&persistence::read(&view.snapshot.data)?, scope, &pending)? {
        return Ok(gate);
    }
    let operation = format!("{}:{}", scope.occurrence, pending.id);
    *view = session
        .commit_evidence(
            view,
            &operation,
            &Record {
                version: evidence::VERSION,
                scope: scope.clone(),
                fact: Fact::Gate(pending.clone()),
            },
        )
        .await?;
    Ok(pending)
}

/// What a branch question's state tells pause to do. `name` is the branch the
/// caller already chose; otherwise creation takes the operator's adjustment.
fn choice(gate: Gate, name: Option<&str>) -> Result<Choice> {
    match &gate.state {
        State::Unanswered => Ok(Choice::Wait(Box::new(gate))),
        State::Superseded { .. } => Ok(Choice::Stop),
        State::Answered(answer) => {
            if answer.disposition == Disposition::Stop
                || answer.selected_option.as_deref() == Some("abort")
            {
                return Ok(Choice::Stop);
            }
            match answer.selected_option.as_deref() {
                Some("proceed") => Ok(Choice::Proceed),
                Some("create") => {
                    let name = name
                        .or(answer.adjustment.as_deref())
                        .filter(|n| !n.trim().is_empty())
                        .ok_or_else(|| {
                            Error::Invalid(
                                "branch creation requires the operator's branch name".into(),
                            )
                        })?;
                    Ok(Choice::Create(name.into()))
                }
                _ => Ok(Choice::Stop),
            }
        }
    }
}

async fn answer<I: ConfigIo>(
    session: &Session<I>,
    scope: &Scope,
    view: &mut View,
    pending: Gate,
    name: Option<&str>,
) -> Result<Choice> {
    choice(recorded_gate(session, scope, view, pending).await?, name)
}

fn consequence(config: &Generation) -> Result<Consequence> {
    match merge::get(
        &config.effective.values,
        "review.triggers.risk_surface.gate",
    )
    .and_then(serde_json::Value::as_str)
    {
        Some("off") => Ok(Consequence::Off),
        Some("advisory") => Ok(Consequence::Advisory),
        Some("deferred") => Ok(Consequence::Deferred),
        Some("blocking") => Ok(Consequence::Blocking),
        Some("adjudicated") => Ok(Consequence::Adjudicated),
        _ => Err(Error::Policy(
            "missing effective risk_surface consequence".into(),
        )),
    }
}

fn configured_surfaces(config: &Generation) -> Result<Option<Vec<String>>> {
    let Some(value) = merge::get(
        &config.effective.values,
        "review.triggers.risk_surface.surfaces",
    ) else {
        return Err(Error::Policy(
            "missing effective risk_surface surfaces".into(),
        ));
    };
    cadence::rail::risk::configured_surfaces(value)
}

fn surfaces_from_answer(gate: &Gate) -> Result<Option<Vec<String>>> {
    let State::Answered(answer) = &gate.state else {
        return Ok(None);
    };
    if answer.disposition == Disposition::Stop || answer.selected_option.as_deref() == Some("abort")
    {
        return Err(Error::Policy("risk surface choice stopped".into()));
    }
    let values = match answer.selected_option.as_deref() {
        Some("all") => risk::CATEGORIES
            .iter()
            .map(|value| (*value).into())
            .collect(),
        Some("choose") => serde_json::from_str::<Vec<String>>(
            answer
                .adjustment
                .as_deref()
                .ok_or_else(|| Error::Invalid("risk surface choice lacks its JSON list".into()))?,
        )
        .map_err(|_| Error::Invalid("risk surface choice is not a JSON string array".into()))?,
        Some(option)
            if option.starts_with("surfaces:") && gate.options.iter().any(|o| o.id == option) =>
        {
            option["surfaces:".len()..]
                .split(',')
                .map(str::to_owned)
                .collect()
        }
        _ => {
            return Err(Error::Invalid(
                "risk surface choice is not actionable".into(),
            ));
        }
    };
    risk::validate_surfaces(values).map(Some)
}

fn receipt_paths<I: ConfigIo>(session: &Session<I>, root: &Path) -> Result<BTreeSet<PathBuf>> {
    let root = fs::canonicalize(root)?;
    let active = session.active_paths();
    let configs: BTreeSet<_> = std::iter::once(&active.repo)
        .chain(active.global.iter())
        .cloned()
        .collect();
    session
        .import_manifest()
        .created
        .iter()
        .filter(|path| !configs.contains(*path))
        .map(|path| {
            let path = path
                .strip_prefix(&root)
                .map_err(|_| Error::Conflict("store receipt escaped the repository".into()))?
                .to_path_buf();
            if path.as_os_str().is_empty()
                || path.components().any(
                    |component| !matches!(component, Component::Normal(name) if name != ".git"),
                )
            {
                return Err(Error::Conflict("invalid store receipt path".into()));
            }
            Ok(path)
        })
        .collect()
}

fn repo_path(root: &Path, path: &Path) -> Result<PathBuf> {
    let root = fs::canonicalize(root)?;
    let path = path
        .strip_prefix(&root)
        .map_err(|_| Error::Conflict("pause-owned path escaped the repository".into()))?
        .to_path_buf();
    if path.as_os_str().is_empty()
        || path
            .components()
            .any(|component| !matches!(component, Component::Normal(name) if name != ".git"))
    {
        return Err(Error::Conflict("invalid pause-owned path".into()));
    }
    Ok(path)
}

fn surface_config_receipt(
    view: &View,
    scope: &Scope,
    config: &Generation,
    root: &Path,
    head: &str,
    process: &mut (dyn Process + Send),
) -> Result<Option<PathBuf>> {
    let answer = persistence::read(&view.snapshot.data)?
        .values()
        .find_map(|record| {
            if record.scope == *scope
                && let Fact::Gate(gate) = &record.fact
                && gate.id.starts_with("pause-risk-surfaces-")
                && matches!(gate.state, State::Answered(_))
            {
                Some(surfaces_from_answer(gate))
            } else {
                None
            }
        })
        .transpose()?
        .flatten();
    let Some(answer) = answer else {
        return Ok(None);
    };
    let path = repo_path(root, &config.repo.identity)?;
    let Some(path_text) = path.to_str() else {
        return Ok(None);
    };
    let object = format!("{head}:{path_text}");
    let Ok(bytes) = git::run(root, ["show", object.as_str()], process) else {
        return Ok(None);
    };
    let mut raw: serde_json::Value = serde_json::from_slice(&bytes)?;
    merge::set(
        &mut raw,
        "review.triggers.risk_surface.surfaces",
        serde_json::to_value(answer)?,
    );
    let expected = serde_json::to_vec_pretty(&raw)?;
    Ok((config.repo.bytes.as_deref() == Some(expected.as_slice())).then_some(path))
}

fn commit_planning_docs(config: &Generation) -> Result<bool> {
    merge::get(&config.effective.values, "planning.commit_docs")
        .and_then(serde_json::Value::as_bool)
        .ok_or_else(|| Error::Policy("missing effective planning.commit_docs".into()))
}

/// The authorized paths the WIP commit stages: never an ignored receipt, and no
/// planning document when planning documents are committed on their own.
fn stage_paths(
    authorized: &BTreeSet<PathBuf>,
    ignored: &BTreeSet<PathBuf>,
    planning: &Path,
    separate_docs: bool,
) -> BTreeSet<PathBuf> {
    authorized
        .iter()
        .filter(|path| !ignored.contains(*path))
        .filter(|path| !separate_docs || !path.starts_with(planning))
        .cloned()
        .collect()
}

async fn prepare_wip<I: ConfigIo>(
    session: &Session<I>,
    view: &View,
    captured: &Capture,
    config: &Generation,
    root: &Path,
    planning: &Path,
    process: &mut (dyn Process + Send),
) -> Result<Option<git::WipIndex>> {
    let mut ignored = receipt_paths(session, root)?;
    if let Some(path) =
        surface_config_receipt(view, &captured.scope, config, root, &captured.observed.head, process)?
    {
        ignored.insert(path);
    }
    let planning = planning
        .strip_prefix(root)
        .map_err(|_| Error::Conflict("planning root escaped the repository".into()))?;
    let stage_paths = stage_paths(&captured.authorized, &ignored, planning, commit_planning_docs(config)?);
    let root = root.to_path_buf();
    let expected = captured.observed.clone();
    let authorized = captured.authorized.clone();
    tokio::task::spawn_blocking(move || {
        git::stage_authorized(&root, &expected, &authorized, &ignored, &stage_paths, &mut cadence::process::System)
    })
    .await
    .map_err(|_| Error::Closed)?
}

fn config_identity(config: &Generation) -> Result<String> {
    Ok(cadence::store::model::digest(&serde_json::to_vec(&(
        &config.repo.identity,
        &config.repo.bytes,
        config
            .global
            .as_ref()
            .map(|input| (&input.identity, &input.bytes)),
    ))?))
}

fn resume_record(
    captured: &Capture,
    observed: &git::Observation,
    config: &Generation,
) -> Result<Record> {
    let invocation = ResumeInvocation {
        version: 1,
        action: "pause".into(),
        phase: captured.phase.clone(),
        preserved_head: observed.head.clone(),
        branch: observed.branch.clone(),
        config: config_identity(config)?,
    };
    Ok(Record {
        version: evidence::VERSION,
        scope: captured.scope.clone(),
        fact: Fact::Override(Override {
            id: "pause-resume".into(),
            reason: captured.sentence.clone(),
            authorization: Authorization::Invocation {
                id: format!("pause:{}", captured.scope.occurrence),
                invocation: serde_json::to_string(&invocation)?,
            },
            meaning: Meaning::PausedNext {
                sentence: captured.sentence.clone(),
            },
        }),
    })
}

/// The resume this capture already recorded in its occurrence, if any. One that
/// no longer matches the capture or the config refuses.
fn recorded_resume(
    records: BTreeMap<String, Record>,
    captured: &Capture,
    config: &Generation,
) -> Result<Option<(Record, ResumeInvocation)>> {
    for record in records.into_values() {
        if record.scope != captured.scope {
            continue;
        }
        let Fact::Override(value) = &record.fact else {
            continue;
        };
        if value.id != "pause-resume" {
            continue;
        }
        let Authorization::Invocation { id, invocation } = &value.authorization else {
            return Err(Error::Conflict(
                "recorded pause resume authorization changed".into(),
            ));
        };
        let Meaning::PausedNext { sentence } = &value.meaning else {
            return Err(Error::Conflict(
                "recorded pause resume meaning changed".into(),
            ));
        };
        let invocation: ResumeInvocation = serde_json::from_str(invocation)
            .map_err(|_| Error::Conflict("recorded pause provenance is unusable".into()))?;
        if value.reason != captured.sentence
            || sentence != &captured.sentence
            || id != &format!("pause:{}", captured.scope.occurrence)
            || invocation.version != 1
            || invocation.action != "pause"
            || invocation.phase != captured.phase
            || invocation.config != config_identity(config)?
        {
            return Err(Error::Conflict("recorded pause resume changed".into()));
        }
        return Ok(Some((record, invocation)));
    }
    Ok(None)
}

fn deferred_receipts(
    view: &View,
    scope: &Scope,
    planning: &Path,
    root: &Path,
) -> Result<BTreeSet<PathBuf>> {
    let mut paths = BTreeSet::new();
    for record in persistence::read(&view.snapshot.data)?.values() {
        if record.scope != *scope {
            continue;
        }
        let Fact::AcceptedResult(result) = &record.fact else {
            continue;
        };
        let Ok(review) = serde_json::from_str::<Review>(&result.evidence_text) else {
            continue;
        };
        if Review::parse(result, &review.fire).is_err() {
            continue;
        }
        for (path, _) in deferred_artifacts(planning, &scope.phase, &review)? {
            paths.insert(repo_path(root, &path)?);
        }
    }
    Ok(paths)
}

fn final_paths<I: ConfigIo>(
    session: &Session<I>,
    view: &View,
    captured: &Capture,
    config: &Generation,
    root: &Path,
    planning: &Path,
) -> Result<BTreeSet<PathBuf>> {
    let mut paths = session
        .import_manifest()
        .created
        .iter()
        .map(|path| repo_path(root, path))
        .collect::<Result<BTreeSet<_>>>()?;
    let planning_relative = planning
        .strip_prefix(root)
        .map_err(|_| Error::Conflict("planning root escaped the repository".into()))?;
    paths.extend(
        captured
            .authorized
            .iter()
            .filter(|path| path.starts_with(planning_relative))
            .cloned(),
    );
    if consequence(config)? == Consequence::Deferred {
        paths.extend(deferred_receipts(view, &captured.scope, planning, root)?);
    }
    Ok(paths)
}

fn verify_participants(
    root: &Path,
    planning: &Path,
    view: &View,
    commit: Option<&str>,
    process: &mut (dyn Process + Send),
) -> Result<()> {
    let planning = planning
        .strip_prefix(root)
        .map_err(|_| Error::Conflict("planning root escaped the repository".into()))?;
    for (name, expected) in persistence::confirmed_participants(view)? {
        let path = planning.join(name);
        if fs::read(root.join(&path))? != expected {
            return Err(Error::Conflict(format!(
                "confirmed store participant changed: {}",
                path.display()
            )));
        }
        if let Some(commit) = commit
            && git::committed_file(root, commit, &path, process)? != expected
        {
            return Err(Error::Conflict(format!(
                "pause commit lacks confirmed store participant: {}",
                path.display()
            )));
        }
    }
    Ok(())
}

async fn stage_final<I: ConfigIo>(
    session: &Session<I>,
    view: &View,
    captured: &Capture,
    config: &Generation,
    root: &Path,
    planning: &Path,
) -> Result<(git::Observation, Option<git::WipIndex>)> {
    let paths = final_paths(session, view, captured, config, root, planning)?;
    let root = root.to_path_buf();
    let observed = tokio::task::spawn_blocking({
        let root = root.clone();
        move || git::observe(&root, &mut cadence::process::System)
    })
    .await
    .map_err(|_| Error::Closed)??;
    let expected = observed.clone();
    let staged = tokio::task::spawn_blocking(move || {
        git::stage_authorized(&root, &expected, &paths, &BTreeSet::new(), &paths, &mut cadence::process::System)
    })
    .await
    .map_err(|_| Error::Closed)??;
    Ok((observed, staged))
}

#[allow(clippy::too_many_arguments)]
async fn finalize_pause<I: ConfigIo>(
    session: &Session<I>,
    view: &mut View,
    captured: &Capture,
    invocation: &ResumeInvocation,
    config: &Generation,
    root: &Path,
    planning: &Path,
    process: &mut (dyn Process + Send),
) -> Result<Response> {
    loop {
        if session.config()? != *config || session.derivation_view().await? != *view {
            return Err(Error::Conflict(
                "pause store/config changed before record commit".into(),
            ));
        }
        verify_participants(root, planning, view, None, process)?;
        let (observed, staged) =
            stage_final(session, view, captured, config, root, planning).await?;
        if observed.branch != invocation.branch {
            return Err(Error::Conflict(
                "pause branch changed before record commit".into(),
            ));
        }
        let Some(staged) = staged else {
            git::require_clean(root, process)?;
            verify_participants(root, planning, view, Some(&observed.head), process)?;
            return Ok(Response::Ready(Box::new(captured.clone())));
        };
        if observed.head != invocation.preserved_head {
            return Err(Error::Conflict(
                "pause record base changed before its commit".into(),
            ));
        }

        let mut guarded = captured.clone();
        guarded.observed = observed;
        let response = risk_gate(
            session,
            view,
            &mut guarded,
            config,
            root,
            planning,
            CommitKind::ResumeRecord,
            process,
        )
        .await?;
        if !matches!(response, Response::Ready(_)) {
            return Ok(response);
        }
        if session.config()? != *config || session.derivation_view().await? != *view {
            return Err(Error::Conflict(
                "pause store/config changed during record guard".into(),
            ));
        }
        verify_participants(root, planning, view, None, process)?;
        let (_, latest) = stage_final(session, view, captured, config, root, planning).await?;
        let Some(latest) = latest else {
            return Err(Error::Conflict(
                "pause record disappeared before its commit".into(),
            ));
        };
        if latest.index_id != staged.index_id {
            continue;
        }

        let subject = format!("docs: pause at phase {}", captured.phase.identity);
        let root_for_commit = root.to_path_buf();
        let committed = tokio::task::spawn_blocking(move || {
            git::commit_guarded(&root_for_commit, &latest, &subject, &mut cadence::process::System)
        })
        .await
        .map_err(|_| Error::Closed)??;
        if session.derivation_view().await? != *view {
            return Err(Error::Conflict(
                "pause store changed after record commit".into(),
            ));
        }
        verify_participants(root, planning, view, Some(&committed), process)?;
        git::require_clean(root, process)?;
        return Ok(Response::Ready(Box::new(captured.clone())));
    }
}

fn accepted(
    view: &View,
    scope: &Scope,
    fire: &risk::Fire,
) -> Result<Option<cadence::evidence::results::AcceptedResult>> {
    Ok(persistence::read(&view.snapshot.data)?
        .values()
        .find_map(|record| {
            if record.scope == *scope
                && let Fact::AcceptedResult(result) = &record.fact
                && result.id == fire.id
                && result.contract == risk::CONTRACT
            {
                Some(result.clone())
            } else {
                None
            }
        }))
}

fn prior_blocking(view: &View, scope: &Scope, kind: CommitKind) -> Result<Option<Review>> {
    let records = persistence::read(&view.snapshot.data)?;
    let mut reviews = records.values().filter_map(|record| {
        if record.scope != *scope {
            return None;
        }
        let Fact::AcceptedResult(result) = &record.fact else {
            return None;
        };
        if result.contract != risk::CONTRACT {
            return None;
        }
        let review: Review = serde_json::from_str(&result.evidence_text).ok()?;
        let review = Review::parse(result, &review.fire).ok()?;
        (review.fire.commit_kind == kind && review.blocking()).then_some(review)
    });
    Ok(reviews
        .next()
        .into_iter()
        .chain(reviews)
        .max_by_key(|review| review.fire.round))
}

fn write_same(path: &Path, bytes: &[u8]) -> Result<()> {
    if let Ok(current) = fs::read(path) {
        return if current == bytes {
            Ok(())
        } else {
            Err(Error::Conflict(format!(
                "pause risk artifact changed: {}",
                path.display()
            )))
        };
    }
    fs::write(path, bytes)?;
    Ok(())
}

fn deferred_artifacts(
    planning: &Path,
    phase: &str,
    review: &Review,
) -> Result<[(PathBuf, Vec<u8>); 2]> {
    if review.fire.index_id.len() < 12
        || !review
            .fire
            .index_id
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit())
        || review.fire.round == 0
    {
        return Err(Error::Invalid("invalid deferred review identity".into()));
    }
    let home = planning.join("phases").join(phase);
    let short = &review.fire.index_id[..12];
    let suffix = if review.fire.round > 1 {
        format!("-r{}", review.fire.round)
    } else {
        String::new()
    };
    let discriminator = format!("pause-{short}");
    let review_path = home.join(format!("REVIEW-risk_surface-{discriminator}{suffix}.md"));
    let review_bytes = serde_json::to_vec_pretty(&serde_json::json!({
        "findings": review.findings,
    }))?;
    let queue_name = format!("DEFERRED-risk_surface-{discriminator}{suffix}.json");
    let queue_path = home.join(&queue_name);
    let queue_bytes = serde_json::to_vec_pretty(&serde_json::json!({
        "phase": phase,
        "trigger": "risk_surface",
        "discriminator": discriminator,
        "round": review.fire.round,
        "findings": review.findings,
        "payload": review_path.strip_prefix(planning).unwrap_or(&review_path),
    }))?;
    Ok([(review_path, review_bytes), (queue_path, queue_bytes)])
}

fn persist_deferred(planning: &Path, phase: &str, review: &Review) -> Result<PathBuf> {
    let home = planning.join("phases").join(phase);
    if !home.is_dir() {
        return Err(Error::Conflict(
            "pause risk phase directory is unavailable".into(),
        ));
    }
    let [review, queue] = deferred_artifacts(planning, phase, review)?;
    write_same(&review.0, &review.1)?;
    write_same(&queue.0, &queue.1)?;
    queue
        .0
        .strip_prefix(planning)
        .map(Path::to_path_buf)
        .map_err(|_| Error::Conflict("deferred queue escaped the planning root".into()))
}

/// The occurrence-scoped Review override an answered disposition question
/// records: its head names the staged index the review saw.
fn override_value(scope: &Scope, gate: &Gate, review: &Review) -> Result<Override> {
    let State::Answered(answer) = &gate.state else {
        return Err(Error::Invalid("risk override lacks its answer".into()));
    };
    let authorization = answer.authorization_id.clone().ok_or_else(|| {
        Error::Invalid("risk override answer lacks authorization identity".into())
    })?;
    let id = format!("pause-risk-override-{}", review.fire.id);
    let survivors = review
        .findings
        .len()
        .try_into()
        .map_err(|_| Error::Invalid("too many risk findings".into()))?;
    let reason = answer
        .adjustment
        .clone()
        .unwrap_or_else(|| answer.actual_response.clone());
    if !cadence::rail::receipts::consequence_permits(
        &cadence::rail::receipts::Consequence::Override {
            reason: reason.clone(),
        },
    ) {
        return Err(Error::Invalid(
            "risk override requires a nonblank reason".into(),
        ));
    }
    let value = Override {
        id: id.clone(),
        reason,
        authorization: Authorization::Answer {
            id: authorization,
            question_id: gate.id.clone(),
        },
        meaning: Meaning::Review(ReviewReceipt {
            base: review.fire.base.clone(),
            head: format!("index:{}", review.fire.index_id),
            trigger: "risk_surface".into(),
            plan: Some(scope.plan.clone()),
            correlation: review.fire.id.clone(),
            round: (review.fire.round > 1).then_some(review.fire.round),
            anchor: None,
            finding_record: review.finding_record.clone(),
            settled: SettledCounts {
                survivors,
                downgraded: 0,
                refuted: 0,
            },
        }),
    };
    Ok(value)
}

/// Whether this occurrence already recorded `value`. A different override
/// under the same id refuses.
fn override_recorded(
    records: &BTreeMap<String, Record>,
    scope: &Scope,
    value: &Override,
) -> Result<bool> {
    let recorded = records.values().find_map(|record| {
        if record.scope == *scope
            && let Fact::Override(recorded) = &record.fact
            && recorded.id == value.id
        {
            Some(recorded)
        } else {
            None
        }
    });
    match recorded {
        None => Ok(false),
        Some(recorded) if recorded == value => Ok(true),
        Some(_) => Err(Error::Conflict("pause risk override changed".into())),
    }
}

async fn override_review<I: ConfigIo>(
    session: &Session<I>,
    view: &mut View,
    scope: &Scope,
    gate: &Gate,
    review: &Review,
) -> Result<String> {
    let value = override_value(scope, gate, review)?;
    let id = value.id.clone();
    if override_recorded(&persistence::read(&view.snapshot.data)?, scope, &value)? {
        return Ok(id);
    }
    *view = session
        .commit_evidence(
            view,
            &format!("{}:{id}", scope.occurrence),
            &Record {
                version: evidence::VERSION,
                scope: scope.clone(),
                fact: Fact::Override(value),
            },
        )
        .await?;
    Ok(id)
}

/// Where a fire starts: its round, the base it is measured from, and whether
/// it goes to review even when its scan matches nothing.
#[derive(Debug, PartialEq, Eq)]
struct Arm {
    round: u32,
    base: String,
    force_review: bool,
}

impl Arm {
    fn first(head: &str) -> Self {
        Self { round: 1, base: head.into(), force_review: false }
    }

    /// The prior blocking review's staged index is still what is staged.
    fn repeat(prior: &Review) -> Self {
        Self { round: prior.fire.round, base: prior.fire.base.clone(), force_review: true }
    }
}

#[derive(Debug, PartialEq, Eq)]
enum Rearm {
    Arm(Arm),
    Wait,
    Refused,
}

/// The next fire after a blocking review whose staged index has changed since,
/// by the operator's answer to its disposition question. A fix re-arms once, as
/// round 2 measured from the first round's index.
fn rearm(prior: &Review, state: &State, head: &str) -> Rearm {
    match state {
        State::Answered(answer)
            if answer.selected_option.as_deref() == Some("fix")
                && answer.disposition != Disposition::Stop
                && prior.fire.round == 1 =>
        {
            Rearm::Arm(Arm { round: 2, base: prior.fire.index_id.clone(), force_review: true })
        }
        State::Answered(answer)
            if answer.selected_option.as_deref() == Some("override")
                && answer.disposition != Disposition::Stop =>
        {
            Rearm::Arm(Arm::first(head))
        }
        State::Answered(_) | State::Superseded { .. } => Rearm::Refused,
        State::Unanswered => Rearm::Wait,
    }
}

/// A re-armed fire must review less than the round it re-arms.
fn narrows(prior: &Review, authored: &[PathBuf]) -> bool {
    let paths = |values: &[PathBuf]| {
        values
            .iter()
            .map(|p| p.to_string_lossy().into_owned())
            .collect::<Vec<_>>()
    };
    cadence::rail::receipts::narrowed_scope(&paths(&prior.fire.authored), &paths(authored), false)
}

/// A fire clears without review when nothing forces one and its scan was
/// conclusive and matched nothing.
fn clears(fire: &risk::Fire, force_review: bool) -> bool {
    !force_review && fire.scan.matches.is_empty() && !fire.scan.inconclusive
}

/// What a usable recorded review settles under the configured consequence.
#[derive(Debug, PartialEq, Eq)]
enum Settle {
    Ready(Outcome),
    /// Its queue files are written before pause continues.
    Defer(Review),
    /// Findings that wait on the operator's disposition.
    Dispose(Review),
}

fn settle(consequence: Consequence, review: Review) -> Settle {
    match consequence {
        Consequence::Off => Settle::Ready(Outcome::Off),
        Consequence::Advisory => Settle::Ready(Outcome::Advisory(review)),
        Consequence::Deferred => Settle::Defer(review),
        Consequence::Blocking if review.permits(consequence) => {
            Settle::Ready(Outcome::BlockingCleared(review))
        }
        Consequence::Adjudicated if review.permits(consequence) => {
            Settle::Ready(Outcome::Adjudicated(review))
        }
        Consequence::Blocking | Consequence::Adjudicated => Settle::Dispose(review),
    }
}

#[derive(Debug, PartialEq, Eq)]
enum Disposed {
    Wait,
    Refused(&'static str),
    Override,
}

/// What the answer to a review's disposition question tells pause to do.
fn disposed(state: &State, review: &Review) -> Disposed {
    let State::Answered(answer) = state else {
        return Disposed::Wait;
    };
    if answer.disposition == Disposition::Stop || answer.selected_option.as_deref() == Some("abort")
    {
        return Disposed::Refused("pause risk choice stopped");
    }
    match answer.selected_option.as_deref() {
        Some("fix") if review.fire.round == 1 => {
            Disposed::Refused("risk fix requested; stage the narrowed fix and repeat pause")
        }
        Some("override") => Disposed::Override,
        _ => Disposed::Refused("pause risk choice is not actionable"),
    }
}

#[allow(clippy::too_many_arguments)]
async fn risk_gate<I: ConfigIo>(
    session: &Session<I>,
    view: &mut View,
    captured: &mut Capture,
    config: &Generation,
    root: &Path,
    planning: &Path,
    kind: CommitKind,
    process: &mut (dyn Process + Send),
) -> Result<Response> {
    let consequence = consequence(config)?;
    if consequence == Consequence::Off {
        captured.risk = Some(Outcome::Off);
        return Ok(Response::Ready(Box::new(captured.clone())));
    }
    let receipts = receipt_paths(session, root)?;
    let initial = git::staged(root, &captured.observed.head, &receipts, process)?;
    if initial.authored.is_empty() {
        let scan = risk_diff::scan(Some(&initial.diff), &initial.authored, &[])?;
        let fire = risk::Fire::new(&captured.scope, kind, 1, &initial, scan)?;
        captured.risk = Some(Outcome::Clear(fire));
        return Ok(Response::Ready(Box::new(captured.clone())));
    }
    let Some(surfaces) = configured_surfaces(config)? else {
        let structural = cadence::rail::surfaces::detect(root, None)?;
        let gate = recorded_gate(
            session,
            &captured.scope,
            view,
            risk::surfaces_question(&captured.scope, &structural)?,
        )
        .await?;
        let Some(surfaces) = surfaces_from_answer(&gate)? else {
            return Ok(Response::Wait(Box::new(gate)));
        };
        *view = session
            .set_config(
                Layer::Repo,
                "review.triggers.risk_surface.surfaces",
                serde_json::to_value(surfaces)?,
            )
            .await?;
        return Ok(Response::Refused(
            "risk surfaces recorded; repeat pause against the new config generation".into(),
        ));
    };
    let current_index = git::index_id(root, process)?;
    let prior = prior_blocking(view, &captured.scope, kind)?;
    let arm = match &prior {
        None => Arm::first(&captured.observed.head),
        Some(prior) if prior.fire.index_id == current_index => Arm::repeat(prior),
        Some(prior) => {
            let gate = recorded_gate(
                session,
                &captured.scope,
                view,
                risk::disposition_question(prior),
            )
            .await?;
            match rearm(prior, &gate.state, &captured.observed.head) {
                Rearm::Arm(arm) => arm,
                Rearm::Refused => {
                    return Ok(Response::Refused(
                        "pause risk disposition stopped or exhausted".into(),
                    ));
                }
                Rearm::Wait => return Ok(Response::Wait(Box::new(gate))),
            }
        }
    };
    let staged = git::staged(root, &arm.base, &receipts, process)?;
    if arm.round == 2
        && let Some(prior) = &prior
        && prior.fire.round == 1
        && !narrows(prior, &staged.authored)
    {
        return Ok(Response::Refused(
            "risk re-arm must narrow the original authored scope".into(),
        ));
    }
    let scan = risk_diff::scan(Some(&staged.diff), &staged.authored, &surfaces)?;
    let fire = risk::Fire::new(&captured.scope, kind, arm.round, &staged, scan)?;
    if clears(&fire, arm.force_review) {
        captured.risk = Some(Outcome::Clear(fire));
        return Ok(Response::Ready(Box::new(captured.clone())));
    }
    let gate = recorded_gate(session, &captured.scope, view, risk::review_question(&fire)).await?;
    let Some(result) = accepted(view, &captured.scope, &fire)? else {
        return Ok(Response::Review(Box::new(RiskNeed { gate, fire })));
    };
    let review = match Review::parse(&result, &fire) {
        Ok(review) => review,
        Err(_) => {
            return Ok(Response::Refused(
                "risk_surface review result is unusable".into(),
            ));
        }
    };
    match settle(consequence, review) {
        Settle::Ready(outcome) => captured.risk = Some(outcome),
        Settle::Defer(review) => {
            let queue = persist_deferred(planning, &captured.scope.phase, &review)?;
            captured.risk = Some(Outcome::Deferred { review, queue });
        }
        Settle::Dispose(review) => {
            let gate = recorded_gate(
                session,
                &captured.scope,
                view,
                risk::disposition_question(&review),
            )
            .await?;
            match disposed(&gate.state, &review) {
                Disposed::Wait => return Ok(Response::Wait(Box::new(gate))),
                Disposed::Refused(reason) => return Ok(Response::Refused(reason.into())),
                Disposed::Override => {
                    let id =
                        override_review(session, view, &captured.scope, &gate, &review).await?;
                    captured.risk = Some(Outcome::Overridden {
                        review,
                        override_id: id,
                    });
                }
            }
        }
    }
    Ok(Response::Ready(Box::new(captured.clone())))
}

async fn observe(root: PathBuf, planning: PathBuf, policy: Policy) -> Result<branch::Observed> {
    tokio::task::spawn_blocking(move || branch::observe(&root, &planning, &policy, &mut cadence::process::System))
        .await
        .map_err(|_| Error::Closed)?
}

async fn create<I: ConfigIo>(
    session: &Session<I>,
    config: &Generation,
    root: &Path,
    planning: &Path,
    policy: &Policy,
    expected: &branch::Observed,
    name: String,
) -> Result<()> {
    if &session.config()? != config {
        return Err(Error::Conflict("pause config changed".into()));
    }
    if observe(root.into(), planning.into(), policy.clone()).await? != *expected {
        return Err(Error::Conflict("pause branch inputs changed".into()));
    }
    let root = root.to_path_buf();
    tokio::task::spawn_blocking(move || {
        git::run(&root, ["check-ref-format", "--branch", &name], &mut cadence::process::System)?;
        git::run(&root, ["checkout", "-b", &name], &mut cadence::process::System)?;
        Ok(())
    })
    .await
    .map_err(|_| Error::Closed)?
}

pub async fn execute<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    input: Input,
    driver: &Driver,
    process: &mut (dyn Process + Send),
) -> Result<Response> {
    let root = PathBuf::from(&input.scope.project);
    let planning = PathBuf::from(&input.scope.planning_root);
    // Capture Git before first-touch migration, lifecycle memo or question writes.
    let git_root = root.clone();
    let original = tokio::task::spawn_blocking(move || git::observe(&git_root, &mut cadence::process::System))
        .await
        .map_err(|_| Error::Closed)??;
    let (checked, mut view) = derivation_service::checked_query(factory, &planning, driver)
        .await
        .map_err(|e| Error::Conflict(format!("pause lifecycle: {e}")))?;
    let mut captured = pause::capture(input, checked.intake(), original)?;
    let session = factory.first_touch(&planning).await?;
    let config = session.config()?;
    if let Some((record, invocation)) =
        recorded_resume(persistence::read(&view.snapshot.data)?, &captured, &config)?
    {
        if captured.observed.branch != invocation.branch {
            return Err(Error::Conflict(
                "pause branch changed after its resume record".into(),
            ));
        }
        let operation = format!("pause-resume:{}", record.key()?);
        view = session.commit_evidence(&view, &operation, &record).await?;
        return finalize_pause(
            &session,
            &mut view,
            &captured,
            &invocation,
            &config,
            &root,
            &planning,
            process,
        )
        .await;
    }
    let policy = policy(&config)?;
    let mut observed = observe(root.clone(), planning.clone(), policy.clone()).await?;
    if let Some(gate) = branch::protected(&policy, &observed)? {
        match answer(&session, &captured.scope, &mut view, gate, None).await? {
            Choice::Wait(gate) => return Ok(Response::Wait(gate)),
            Choice::Stop => return Ok(Response::Refused("pause branch choice stopped".into())),
            Choice::Create(name) => {
                create(
                    &session, &config, &root, &planning, &policy, &observed, name
                )
                .await?;
                observed = observe(root.clone(), planning.clone(), policy.clone()).await?;
            }
            Choice::Proceed => (),
        }
    }
    for gate in branch::base(&policy, &observed)? {
        match answer(&session, &captured.scope, &mut view, gate, None).await? {
            Choice::Wait(gate) => return Ok(Response::Wait(gate)),
            Choice::Stop => return Ok(Response::Refused("pause base choice stopped".into())),
            Choice::Create(name) => {
                create(
                    &session, &config, &root, &planning, &policy, &observed, name
                )
                .await?;
                // A new branch requires a new observation before other questions.
                return Ok(Response::Refused(
                    "branch created; repeat pause to check the new branch".into(),
                ));
            }
            Choice::Proceed => (),
        }
    }
    let integration = branch::integration(&policy, &observed)?;
    let create_name = match integration {
        Integration::Stay => None,
        Integration::Create(name) => Some(name),
        Integration::Ask(gate, name) => {
            match answer(&session, &captured.scope, &mut view, *gate, name.as_deref()).await? {
                Choice::Wait(gate) => return Ok(Response::Wait(gate)),
                Choice::Stop => {
                    return Ok(Response::Refused("pause integration choice stopped".into()));
                }
                Choice::Create(name) => Some(name),
                Choice::Proceed => None,
            }
        }
    };
    if let Some(name) = create_name {
        create(
            &session, &config, &root, &planning, &policy, &observed, name
        )
        .await?;
        observed = observe(root.clone(), planning.clone(), policy.clone()).await?;
    }
    if session.config()? != config
        || observe(root.clone(), planning.clone(), policy.clone()).await? != observed
    {
        return Err(Error::Conflict(
            "pause branch/config changed before continuation".into(),
        ));
    }
    captured.observed.branch = observed.branch.into_bytes();
    let wip = prepare_wip(&session, &view, &captured, &config, &root, &planning, process).await?;
    let response = risk_gate(
        &session,
        &mut view,
        &mut captured,
        &config,
        &root,
        &planning,
        CommitKind::Wip,
        process,
    )
    .await?;
    let Response::Ready(mut ready) = response else {
        return Ok(response);
    };
    if let Some(wip) = wip {
        if session.config()? != config {
            return Err(Error::Conflict(
                "pause config changed before WIP commit".into(),
            ));
        }
        let root = root.clone();
        let description = ready.phase.name.clone();
        let committed =
            tokio::task::spawn_blocking(move || git::commit_wip(&root, &wip, &description, &mut cadence::process::System))
                .await
                .map_err(|_| Error::Closed)??;
        ready.wip = Some(committed);
    }
    if session.config()? != config {
        return Err(Error::Conflict(
            "pause config changed before resume persistence".into(),
        ));
    }
    let record_observation = {
        let root = root.clone();
        tokio::task::spawn_blocking(move || git::observe(&root, &mut cadence::process::System))
            .await
            .map_err(|_| Error::Closed)??
    };
    let record = resume_record(&ready, &record_observation, &config)?;
    let Fact::Override(value) = &record.fact else {
        unreachable!("pause resume is an override")
    };
    let Authorization::Invocation { invocation, .. } = &value.authorization else {
        unreachable!("pause resume is an invocation")
    };
    let invocation: ResumeInvocation = serde_json::from_str(invocation)?;
    let operation = format!("pause-resume:{}", record.key()?);
    view = session.commit_evidence(&view, &operation, &record).await?;
    finalize_pause(
        &session,
        &mut view,
        &ready,
        &invocation,
        &config,
        &root,
        &planning,
        process,
    )
    .await
}

#[cfg(test)]
mod gate_tests {
    use super::{Choice, choice, existing_gate};
    use cadence::evidence::{
        Fact, Record, Scope,
        gates::{Answer, Disposition, Gate, OptionChoice, Purpose, State},
    };
    use cadence::store::Error;
    use std::collections::BTreeMap;

    fn scope(occurrence: &str) -> Scope {
        Scope {
            project: "/project".into(),
            planning_root: "/project/.planning".into(),
            cycle: "cycle".into(),
            occurrence: occurrence.into(),
            phase: "1".into(),
            plan: "PLAN.md".into(),
            report: "reports/plan-1.md".into(),
        }
    }

    fn question() -> Gate {
        Gate {
            id: "pause-protected-abc".into(),
            purpose: Purpose::Decision,
            checkpoint_id: None,
            question: "Pause on a protected branch?".into(),
            need: "Pause on a protected branch?".into(),
            options: ["create", "proceed", "abort"]
                .map(|id| OptionChoice { id: id.into(), text: id.into() })
                .into(),
            state: State::Unanswered,
        }
    }

    fn answered(option: Option<&str>, adjustment: Option<&str>, disposition: Disposition) -> Gate {
        Gate {
            state: State::Answered(Answer {
                question_id: "pause-protected-abc".into(),
                actual_response: "as chosen".into(),
                selected_option: option.map(str::to_owned),
                adjustment: adjustment.map(str::to_owned),
                disposition,
                authorization_id: None,
            }),
            ..question()
        }
    }

    fn records(entries: &[(&str, Gate)]) -> BTreeMap<String, Record> {
        entries
            .iter()
            .enumerate()
            .map(|(key, (occurrence, gate))| {
                let record = Record { version: 1, scope: scope(occurrence), fact: Fact::Gate(gate.clone()) };
                (key.to_string(), record)
            })
            .collect()
    }

    #[test]
    fn an_unanswered_question_waits_on_itself() {
        let Ok(Choice::Wait(gate)) = choice(question(), None) else { panic!("a wait") };
        assert_eq!(*gate, question());
    }

    #[test]
    fn a_superseded_question_stops() {
        let gate = Gate { state: State::Superseded { by: "later".into() }, ..question() };
        assert!(matches!(choice(gate, None), Ok(Choice::Stop)));
    }

    #[test]
    fn proceed_proceeds() {
        let gate = answered(Some("proceed"), None, Disposition::Approve);
        assert!(matches!(choice(gate, None), Ok(Choice::Proceed)));
    }

    #[test]
    fn create_takes_the_callers_name_before_the_operators() {
        let gate = answered(Some("create"), Some("operator/branch"), Disposition::Adjust);
        let Ok(Choice::Create(name)) = choice(gate.clone(), Some("cadence/v1.3.0")) else { panic!("a create") };
        assert_eq!(name, "cadence/v1.3.0");
        let Ok(Choice::Create(name)) = choice(gate, None) else { panic!("a create") };
        assert_eq!(name, "operator/branch");
    }

    #[test]
    fn create_without_a_branch_name_is_refused() {
        for adjustment in [None, Some("  ")] {
            let gate = answered(Some("create"), adjustment, Disposition::Adjust);
            assert!(matches!(choice(gate, None), Err(Error::Invalid(_))), "{adjustment:?}");
        }
    }

    #[test]
    fn abort_a_stop_disposition_or_an_unknown_option_stops() {
        for gate in [
            answered(Some("abort"), None, Disposition::Approve),
            answered(Some("proceed"), None, Disposition::Stop),
            answered(Some("create"), Some("work"), Disposition::Stop),
            answered(Some("configure"), None, Disposition::Approve),
            answered(None, None, Disposition::Approve),
        ] {
            assert!(matches!(choice(gate.clone(), None), Ok(Choice::Stop)), "{gate:?}");
        }
    }

    // An answer belongs to the occurrence that recorded it: the same question
    // in another pause occurrence is asked afresh.
    #[test]
    fn a_question_recorded_only_in_another_occurrence_is_not_found() {
        let answered = answered(Some("proceed"), None, Disposition::Approve);
        assert_eq!(existing_gate(&records(&[]), &scope("pause-2"), &question()), Ok(None));
        assert_eq!(existing_gate(&records(&[("pause-1", answered)]), &scope("pause-2"), &question()), Ok(None));
    }

    #[test]
    fn the_recorded_question_comes_back_with_its_answer_or_still_unanswered() {
        let answered = answered(Some("proceed"), None, Disposition::Approve);
        let found = existing_gate(&records(&[("pause-1", answered.clone())]), &scope("pause-1"), &question());
        assert_eq!(found, Ok(Some(answered)));
        let found = existing_gate(&records(&[("pause-1", question())]), &scope("pause-1"), &question());
        assert_eq!(found, Ok(Some(question())));
    }

    #[test]
    fn a_recorded_question_that_now_reads_differently_is_refused() {
        let changed = Gate { need: "A different need".into(), ..question() };
        let found = existing_gate(&records(&[("pause-1", changed)]), &scope("pause-1"), &question());
        assert!(matches!(found, Err(Error::Conflict(_))), "{found:?}");
    }
}

#[cfg(test)]
mod risk_tests {
    use super::{
        Arm, Disposed, Rearm, Settle, clears, deferred_artifacts, disposed, narrows, override_recorded,
        override_value, rearm, settle, surfaces_from_answer,
    };
    use cadence::evidence::{
        Fact, Record, Scope,
        gates::{Answer, Disposition, Gate, OptionChoice, Purpose, State},
        overrides::{Authorization, Meaning},
    };
    use cadence::pause::risk::{CATEGORIES, CommitKind, Consequence, Finding, Fire, Outcome, Review, Severity};
    use cadence::rail::risk_diff::{Match, Scan};
    use cadence::store::Error;
    use std::collections::BTreeMap;
    use std::path::{Path, PathBuf};

    const BASE: &str = "1111111111111111111111111111111111111111";
    const INDEX: &str = "abcdef0123456789abcdef0123456789abcdef01";
    const HEAD: &str = "3333333333333333333333333333333333333333";

    fn scope(occurrence: &str) -> Scope {
        Scope {
            project: "/project".into(),
            planning_root: "/project/.planning".into(),
            cycle: "cycle".into(),
            occurrence: occurrence.into(),
            phase: "3".into(),
            plan: "PLAN.md".into(),
            report: "reports/plan-1.md".into(),
        }
    }

    fn scan(matches: usize, inconclusive: bool) -> Scan {
        Scan {
            checked: true,
            categories: vec!["destructive".into()],
            matches: (0..matches)
                .map(|_| Match { category: "destructive".into(), signal: "changed line: a DROP statement".into() })
                .collect(),
            inconclusive,
            empty: false,
        }
    }

    fn fire(round: u32, authored: &[&str]) -> Fire {
        Fire {
            id: "pause-risk-f".into(),
            commit_kind: CommitKind::Wip,
            round,
            base: BASE.into(),
            staged: true,
            head_id: None,
            index_id: INDEX.into(),
            scope: authored.iter().map(PathBuf::from).collect(),
            authored: authored.iter().map(PathBuf::from).collect(),
            scan: scan(1, false),
        }
    }

    fn finding(number: u32, severity: Severity) -> Finding {
        Finding {
            number,
            severity,
            file: "src/db.rs".into(),
            line: 4,
            claim: "drops a table".into(),
            fix: "keep the table".into(),
        }
    }

    fn review(round: u32, findings: Vec<Finding>) -> Review {
        Review { version: 1, fire: fire(round, &["src/db.rs", "src/api.rs"]), finding_record: "record-1".into(), findings }
    }

    fn answered(option: &str, adjustment: Option<&str>, disposition: Disposition) -> State {
        State::Answered(Answer {
            question_id: "q".into(),
            actual_response: "as answered".into(),
            selected_option: Some(option.into()),
            adjustment: adjustment.map(str::to_owned),
            disposition,
            authorization_id: Some("auth-1".into()),
        })
    }

    fn gate(options: &[&str], state: State) -> Gate {
        Gate {
            id: "pause-risk-f-disposition".into(),
            purpose: Purpose::Decision,
            checkpoint_id: None,
            question: "q".into(),
            need: "n".into(),
            options: options.iter().map(|id| OptionChoice { id: (*id).into(), text: (*id).into() }).collect(),
            state,
        }
    }

    #[test]
    fn fix_on_a_first_round_rearms_once_as_round_two_from_its_index() {
        assert_eq!(
            rearm(&review(1, vec![]), &answered("fix", None, Disposition::Approve), HEAD),
            Rearm::Arm(Arm { round: 2, base: INDEX.into(), force_review: true })
        );
    }

    #[test]
    fn fix_after_the_rearm_is_spent_refuses() {
        assert_eq!(rearm(&review(2, vec![]), &answered("fix", None, Disposition::Approve), HEAD), Rearm::Refused);
    }

    #[test]
    fn an_override_answer_starts_a_first_round_fire_from_head() {
        assert_eq!(
            rearm(&review(1, vec![]), &answered("override", None, Disposition::Approve), HEAD),
            Rearm::Arm(Arm { round: 1, base: HEAD.into(), force_review: false })
        );
    }

    #[test]
    fn a_stopped_aborted_or_superseded_disposition_refuses() {
        for state in [
            answered("fix", None, Disposition::Stop),
            answered("override", None, Disposition::Stop),
            answered("abort", None, Disposition::Approve),
            State::Superseded { by: "later".into() },
        ] {
            assert_eq!(rearm(&review(1, vec![]), &state, HEAD), Rearm::Refused, "{state:?}");
        }
    }

    #[test]
    fn an_unanswered_disposition_waits() {
        assert_eq!(rearm(&review(1, vec![]), &State::Unanswered, HEAD), Rearm::Wait);
    }

    #[test]
    fn the_same_staged_index_is_reviewed_again_as_its_round() {
        assert_eq!(Arm::repeat(&review(2, vec![])), Arm { round: 2, base: BASE.into(), force_review: true });
    }

    #[test]
    fn a_rearm_must_review_a_part_of_what_the_first_round_reviewed() {
        let prior = review(1, vec![]);
        assert!(narrows(&prior, &["src/db.rs".into()]));
        assert!(!narrows(&prior, &["src/db.rs".into(), "src/new.rs".into()]));
        assert!(!narrows(&prior, &[]));
    }

    #[test]
    fn only_an_unforced_conclusive_scan_with_no_match_clears() {
        let with = |matches, inconclusive| Fire { scan: scan(matches, inconclusive), ..fire(1, &["a"]) };
        assert!(clears(&with(0, false), false));
        assert!(!clears(&with(1, false), false));
        assert!(!clears(&with(0, true), false));
        assert!(!clears(&with(0, false), true));
    }

    #[test]
    fn off_and_advisory_continue_with_the_review_reported() {
        let blocking = review(1, vec![finding(1, Severity::Blocker)]);
        assert_eq!(settle(Consequence::Off, blocking.clone()), Settle::Ready(Outcome::Off));
        assert_eq!(settle(Consequence::Advisory, blocking.clone()), Settle::Ready(Outcome::Advisory(blocking)));
    }

    #[test]
    fn deferred_writes_the_review_to_the_queue() {
        let blocking = review(1, vec![finding(1, Severity::Blocker)]);
        assert_eq!(settle(Consequence::Deferred, blocking.clone()), Settle::Defer(blocking));
    }

    #[test]
    fn blocking_clears_on_a_review_without_blocker_or_high_findings() {
        for findings in [vec![], vec![finding(1, Severity::Medium), finding(2, Severity::Low)]] {
            let review = review(1, findings);
            assert_eq!(settle(Consequence::Blocking, review.clone()), Settle::Ready(Outcome::BlockingCleared(review)));
        }
    }

    #[test]
    fn blocking_findings_wait_on_a_disposition() {
        for severity in [Severity::Blocker, Severity::High] {
            let review = review(1, vec![finding(1, severity)]);
            assert_eq!(settle(Consequence::Blocking, review.clone()), Settle::Dispose(review));
        }
    }

    #[test]
    fn adjudicated_clears_only_a_review_with_no_findings() {
        let clean = review(1, vec![]);
        assert_eq!(settle(Consequence::Adjudicated, clean.clone()), Settle::Ready(Outcome::Adjudicated(clean)));
        let low = review(1, vec![finding(1, Severity::Low)]);
        assert_eq!(settle(Consequence::Adjudicated, low.clone()), Settle::Dispose(low));
    }

    #[test]
    fn a_disposition_not_yet_answered_waits() {
        assert_eq!(disposed(&State::Unanswered, &review(1, vec![])), Disposed::Wait);
    }

    #[test]
    fn a_stopped_or_aborted_disposition_refuses_as_stopped() {
        for state in [answered("override", None, Disposition::Stop), answered("abort", None, Disposition::Approve)] {
            assert_eq!(disposed(&state, &review(1, vec![])), Disposed::Refused("pause risk choice stopped"));
        }
    }

    #[test]
    fn fix_refuses_until_the_narrowed_fix_is_staged_and_is_not_offered_after_it() {
        let fix = answered("fix", None, Disposition::Approve);
        assert_eq!(
            disposed(&fix, &review(1, vec![])),
            Disposed::Refused("risk fix requested; stage the narrowed fix and repeat pause")
        );
        assert_eq!(disposed(&fix, &review(2, vec![])), Disposed::Refused("pause risk choice is not actionable"));
    }

    #[test]
    fn override_records_an_override() {
        assert_eq!(disposed(&answered("override", None, Disposition::Approve), &review(1, vec![])), Disposed::Override);
    }

    #[test]
    fn an_override_is_a_review_receipt_whose_head_names_the_staged_index() {
        let review = review(1, vec![finding(1, Severity::High), finding(2, Severity::Low)]);
        let gate = gate(&["fix", "override", "abort"], answered("override", Some("accepted risk"), Disposition::Adjust));
        let value = override_value(&scope("pause-1"), &gate, &review).unwrap();
        assert_eq!(value.id, "pause-risk-override-pause-risk-f");
        assert_eq!(value.reason, "accepted risk");
        assert_eq!(
            value.authorization,
            Authorization::Answer { id: "auth-1".into(), question_id: "pause-risk-f-disposition".into() }
        );
        let Meaning::Review(receipt) = value.meaning else { panic!("a review receipt") };
        assert_eq!(receipt.head, format!("index:{INDEX}"));
        assert_eq!(receipt.base, BASE);
        assert_eq!(receipt.trigger, "risk_surface");
        assert_eq!(receipt.correlation, "pause-risk-f");
        assert_eq!(receipt.plan.as_deref(), Some("PLAN.md"));
        assert_eq!(receipt.round, None);
        assert_eq!(receipt.settled.survivors, 2);
    }

    #[test]
    fn a_second_round_override_names_its_round_and_takes_the_answer_as_its_reason() {
        let gate = gate(&["override", "abort"], answered("override", None, Disposition::Approve));
        let value = override_value(&scope("pause-1"), &gate, &review(2, vec![])).unwrap();
        assert_eq!(value.reason, "as answered");
        let Meaning::Review(receipt) = value.meaning else { panic!("a review receipt") };
        assert_eq!(receipt.round, Some(2));
    }

    #[test]
    fn an_override_needs_an_answer_its_authorization_and_a_reason() {
        let review = review(1, vec![]);
        let unanswered = gate(&[], State::Unanswered);
        let mut unauthorized = gate(&[], answered("override", Some("why"), Disposition::Adjust));
        if let State::Answered(answer) = &mut unauthorized.state {
            answer.authorization_id = None;
        }
        let blank = gate(&[], answered("override", Some("  "), Disposition::Adjust));
        for gate in [unanswered, unauthorized, blank] {
            assert!(matches!(override_value(&scope("pause-1"), &gate, &review), Err(Error::Invalid(_))), "{gate:?}");
        }
    }

    fn overrides(entries: &[(&str, super::Override)]) -> BTreeMap<String, Record> {
        entries
            .iter()
            .enumerate()
            .map(|(key, (occurrence, value))| {
                (key.to_string(), Record { version: 1, scope: scope(occurrence), fact: Fact::Override(value.clone()) })
            })
            .collect()
    }

    #[test]
    fn an_override_belongs_to_its_occurrence() {
        let gate = gate(&["override"], answered("override", Some("why"), Disposition::Adjust));
        let value = override_value(&scope("pause-1"), &gate, &review(1, vec![])).unwrap();
        assert_eq!(override_recorded(&overrides(&[]), &scope("pause-1"), &value), Ok(false));
        assert_eq!(override_recorded(&overrides(&[("pause-1", value.clone())]), &scope("pause-1"), &value), Ok(true));
        assert_eq!(override_recorded(&overrides(&[("pause-1", value.clone())]), &scope("pause-2"), &value), Ok(false));
    }

    #[test]
    fn a_different_override_under_the_same_id_is_refused() {
        let gate = gate(&["override"], answered("override", Some("why"), Disposition::Adjust));
        let value = override_value(&scope("pause-1"), &gate, &review(1, vec![])).unwrap();
        let changed = super::Override { reason: "another reason".into(), ..value.clone() };
        let found = override_recorded(&overrides(&[("pause-1", changed)]), &scope("pause-1"), &value);
        assert!(matches!(found, Err(Error::Conflict(_))), "{found:?}");
    }

    fn surfaces(option: &str, adjustment: Option<&str>) -> Gate {
        gate(&["all", "surfaces:auth,billing", "choose", "abort"], answered(option, adjustment, Disposition::Approve))
    }

    #[test]
    fn an_unanswered_surfaces_question_names_no_surfaces() {
        assert_eq!(surfaces_from_answer(&gate(&["all"], State::Unanswered)), Ok(None));
    }

    #[test]
    fn all_is_every_category() {
        let every: Vec<String> = CATEGORIES.iter().map(|value| (*value).into()).collect();
        assert_eq!(surfaces_from_answer(&surfaces("all", None)), Ok(Some(every)));
    }

    #[test]
    fn an_offered_set_is_its_listed_surfaces() {
        assert_eq!(
            surfaces_from_answer(&surfaces("surfaces:auth,billing", None)),
            Ok(Some(vec!["auth".into(), "billing".into()]))
        );
    }

    #[test]
    fn choose_takes_the_supplied_json_list() {
        assert_eq!(
            surfaces_from_answer(&surfaces("choose", Some(r#"["migrations"]"#))),
            Ok(Some(vec!["migrations".into()]))
        );
    }

    #[test]
    fn a_set_not_offered_or_a_choice_without_its_list_is_refused() {
        for gate in [
            surfaces("surfaces:auth", None),
            surfaces("choose", None),
            surfaces("choose", Some("auth")),
            surfaces("choose", Some(r#"["not-a-surface"]"#)),
        ] {
            assert!(surfaces_from_answer(&gate).is_err(), "{gate:?}");
        }
    }

    #[test]
    fn abort_or_a_stop_is_a_stopped_surfaces_choice() {
        let stopped = gate(&["all"], answered("all", None, Disposition::Stop));
        for gate in [surfaces("abort", None), stopped] {
            assert!(matches!(surfaces_from_answer(&gate), Err(Error::Policy(_))), "{gate:?}");
        }
    }

    #[test]
    fn a_deferred_review_is_one_queue_member_with_its_finding_count() {
        let review = review(1, vec![finding(1, Severity::High), finding(2, Severity::Low)]);
        let [(review_path, _), (queue_path, bytes)] = deferred_artifacts(Path::new("/project/.planning"), "3", &review).unwrap();
        assert_eq!(review_path, Path::new("/project/.planning/phases/3/REVIEW-risk_surface-pause-abcdef012345.md"));
        assert_eq!(queue_path, Path::new("/project/.planning/phases/3/DEFERRED-risk_surface-pause-abcdef012345.json"));
        let name = queue_path.file_name().unwrap().to_str().unwrap();
        let member = cadence::next_action::observations::queue_member(
            queue_path.clone(),
            "3",
            name,
            serde_json::from_slice(&bytes).unwrap(),
        )
        .expect("the queue observation accepts it");
        assert_eq!((member.trigger.as_str(), member.round, member.findings), ("risk_surface", 1, 2));
    }

    #[test]
    fn a_second_round_deferral_carries_its_round_in_both_names() {
        let [(review_path, _), (queue_path, bytes)] =
            deferred_artifacts(Path::new("/p/.planning"), "3", &review(2, vec![])).unwrap();
        assert!(review_path.ends_with("REVIEW-risk_surface-pause-abcdef012345-r2.md"), "{review_path:?}");
        assert!(queue_path.ends_with("DEFERRED-risk_surface-pause-abcdef012345-r2.json"), "{queue_path:?}");
        let name = queue_path.file_name().unwrap().to_str().unwrap();
        let member = cadence::next_action::observations::queue_member(
            queue_path.clone(),
            "3",
            name,
            serde_json::from_slice(&bytes).unwrap(),
        )
        .expect("the queue observation accepts it");
        assert_eq!(member.round, 2);
    }

    #[test]
    fn a_deferral_needs_a_hex_index_and_a_round() {
        let short = Review { fire: Fire { index_id: "abc".into(), ..fire(1, &["a"]) }, ..review(1, vec![]) };
        let not_hex = Review { fire: Fire { index_id: "z".repeat(40), ..fire(1, &["a"]) }, ..review(1, vec![]) };
        let no_round = review(0, vec![]);
        for review in [short, not_hex, no_round] {
            assert!(deferred_artifacts(Path::new("/p/.planning"), "3", &review).is_err(), "{review:?}");
        }
    }
}

#[cfg(test)]
mod record_tests {
    use super::{config_identity, recorded_resume, resume_record, stage_paths};
    use crate::config::{merge, reload::{Generation, Input}};
    use cadence::evidence::{
        Fact, Scope,
        overrides::{Authorization, Meaning},
    };
    use cadence::pause::{Capture, Phase, ResumeInvocation, git::Observation};
    use cadence::store::Error;
    use serde_json::json;
    use std::collections::{BTreeMap, BTreeSet};
    use std::path::{Path, PathBuf};

    const HEAD: &str = "1111111111111111111111111111111111111111";
    const NOTE: &str = "  verify the fix on the device  ";

    fn set(values: &[&str]) -> BTreeSet<PathBuf> {
        values.iter().map(PathBuf::from).collect()
    }

    #[test]
    fn an_ignored_receipt_is_never_staged() {
        let staged = stage_paths(&set(&["src/lib.rs", ".planning/state.json"]), &set(&[".planning/state.json"]), Path::new(".planning"), false);
        assert_eq!(staged, set(&["src/lib.rs"]));
    }

    #[test]
    fn planning_documents_stay_out_of_the_wip_when_they_are_committed_separately() {
        let authorized = set(&["src/lib.rs", ".planning/phases/3/NOTES.md"]);
        assert_eq!(stage_paths(&authorized, &set(&[]), Path::new(".planning"), true), set(&["src/lib.rs"]));
        assert_eq!(stage_paths(&authorized, &set(&[]), Path::new(".planning"), false), authorized);
    }

    fn scope(occurrence: &str) -> Scope {
        Scope {
            project: "/project".into(),
            planning_root: "/project/.planning".into(),
            cycle: "cycle".into(),
            occurrence: occurrence.into(),
            phase: "3".into(),
            plan: "PLAN.md".into(),
            report: "reports/plan-1.md".into(),
        }
    }

    fn capture(occurrence: &str, sentence: &str, phase: &str) -> Capture {
        let observed = Observation { head: HEAD.into(), branch: b"work".to_vec(), index: vec![], changes: vec![] };
        Capture {
            scope: scope(occurrence),
            phase: Phase { identity: "3".into(), name: phase.into(), total: 7, provenance: "roadmap".into() },
            sentence: sentence.into(),
            authorized: BTreeSet::new(),
            observed,
            risk: None,
            wip: None,
        }
    }

    fn config(repo: &[u8], global: Option<&[u8]>) -> Generation {
        let input = |path: &str, bytes: &[u8]| Input { identity: path.into(), bytes: Some(bytes.to_vec()), stamp: None };
        Generation {
            number: 1,
            global: global.map(|bytes| input("/home/u/.claude/cadence/config.v4.json", bytes)),
            repo: input("/project/.planning/config.v4.json", repo),
            effective: merge::merge(None, Some(json!({})), false),
        }
    }

    fn observed_after_wip() -> Observation {
        Observation { head: "2".repeat(40), branch: b"work".to_vec(), index: vec![], changes: vec![] }
    }

    #[test]
    fn the_resume_record_carries_the_exact_note_and_its_invocation() {
        let config = config(b"{}", None);
        let record = resume_record(&capture("pause-1", NOTE, "Work"), &observed_after_wip(), &config).unwrap();
        assert_eq!(record.scope, scope("pause-1"));
        let Fact::Override(value) = record.fact else { panic!("an override") };
        assert_eq!(value.id, "pause-resume");
        assert_eq!(value.reason, NOTE);
        assert_eq!(value.meaning, Meaning::PausedNext { sentence: NOTE.into() });
        let Authorization::Invocation { id, invocation } = value.authorization else { panic!("an invocation") };
        assert_eq!(id, "pause:pause-1");
        let invocation: ResumeInvocation = serde_json::from_str(&invocation).unwrap();
        assert_eq!((invocation.version, invocation.action.as_str()), (1, "pause"));
        assert_eq!(invocation.phase, capture("pause-1", NOTE, "Work").phase);
        assert_eq!(invocation.preserved_head, "2".repeat(40));
        assert_eq!(invocation.branch, b"work");
        assert_eq!(invocation.config, config_identity(&config).unwrap());
    }

    #[test]
    fn the_config_identity_changes_with_either_layers_bytes() {
        let identity = |repo: &[u8], global: Option<&[u8]>| config_identity(&config(repo, global)).unwrap();
        assert_eq!(identity(b"{}", None), identity(b"{}", None));
        assert_ne!(identity(b"{}", None), identity(b"{\"a\":1}", None));
        assert_ne!(identity(b"{}", None), identity(b"{}", Some(b"{}")));
        assert_ne!(identity(b"{}", Some(b"{}")), identity(b"{}", Some(b"{\"b\":2}")));
    }

    fn recorded(records: &[cadence::evidence::Record]) -> BTreeMap<String, cadence::evidence::Record> {
        records.iter().enumerate().map(|(key, record)| (key.to_string(), record.clone())).collect()
    }

    #[test]
    fn nothing_recorded_is_no_resume() {
        assert_eq!(recorded_resume(recorded(&[]), &capture("pause-1", NOTE, "Work"), &config(b"{}", None)), Ok(None));
    }

    // A retry after the record landed finds it and goes on to the final commit
    // rather than committing a second WIP.
    #[test]
    fn the_resume_this_capture_recorded_is_found_again() {
        let config = config(b"{}", None);
        let captured = capture("pause-1", NOTE, "Work");
        let record = resume_record(&captured, &observed_after_wip(), &config).unwrap();
        let Some((found, invocation)) = recorded_resume(recorded(std::slice::from_ref(&record)), &captured, &config).unwrap() else {
            panic!("the recorded resume")
        };
        assert_eq!(found, record);
        assert_eq!(invocation.preserved_head, "2".repeat(40));
    }

    #[test]
    fn a_resume_recorded_in_another_occurrence_is_not_this_ones() {
        let config = config(b"{}", None);
        let other = resume_record(&capture("pause-2", NOTE, "Work"), &observed_after_wip(), &config).unwrap();
        assert_eq!(recorded_resume(recorded(&[other]), &capture("pause-1", NOTE, "Work"), &config), Ok(None));
    }

    #[test]
    fn a_recorded_resume_that_no_longer_matches_is_refused() {
        let recorded_config = config(b"{}", None);
        let record = resume_record(&capture("pause-1", NOTE, "Work"), &observed_after_wip(), &recorded_config).unwrap();
        for (captured, current) in [
            (capture("pause-1", "another note", "Work"), recorded_config.clone()),
            (capture("pause-1", NOTE, "Renamed"), recorded_config.clone()),
            (capture("pause-1", NOTE, "Work"), config(b"{\"a\":1}", None)),
        ] {
            let found = recorded_resume(recorded(std::slice::from_ref(&record)), &captured, &current);
            assert!(matches!(found, Err(Error::Conflict(_))), "{found:?}");
        }
    }
}
