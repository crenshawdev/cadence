//! Internal pause request. Durable answers precede dependent Git operations.
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
    collections::BTreeSet,
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

#[cfg(test)]
fn pause_barrier(stage: &str) {
    use std::io::Write as _;

    if std::env::var("CADENCE_PAUSE_BARRIER").as_deref() == Ok(stage) {
        println!("PAUSE_BARRIER:{stage}");
        std::io::stdout().flush().expect("pause barrier flush");
        loop {
            std::thread::park();
        }
    }
}

#[cfg(not(test))]
fn pause_barrier(_: &str) {}

fn policy(config: &Generation) -> Result<Policy> {
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

async fn recorded_gate<I: ConfigIo>(
    session: &Session<I>,
    scope: &Scope,
    view: &mut View,
    pending: Gate,
) -> Result<Gate> {
    let records = persistence::read(&view.snapshot.data)?;
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
        return Ok(pending);
    };
    let mut question = gate.clone();
    question.state = State::Unanswered;
    if question != pending {
        return Err(Error::Conflict("pause question changed".into()));
    }
    Ok(gate.clone())
}

async fn answer<I: ConfigIo>(
    session: &Session<I>,
    scope: &Scope,
    view: &mut View,
    pending: Gate,
    name: Option<&str>,
) -> Result<Choice> {
    let gate = recorded_gate(session, scope, view, pending).await?;
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
    let active = &session.import_manifest().active;
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
    let Ok(bytes) = git::run(root, ["show", object.as_str()]) else {
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

async fn prepare_wip<I: ConfigIo>(
    session: &Session<I>,
    view: &View,
    captured: &Capture,
    config: &Generation,
    root: &Path,
    planning: &Path,
) -> Result<Option<git::WipIndex>> {
    let mut ignored = receipt_paths(session, root)?;
    if let Some(path) =
        surface_config_receipt(view, &captured.scope, config, root, &captured.observed.head)?
    {
        ignored.insert(path);
    }
    let planning = planning
        .strip_prefix(root)
        .map_err(|_| Error::Conflict("planning root escaped the repository".into()))?;
    let separate_docs = commit_planning_docs(config)?;
    let stage_paths = captured
        .authorized
        .iter()
        .filter(|path| !ignored.contains(*path))
        .filter(|path| !separate_docs || !path.starts_with(planning))
        .cloned()
        .collect();
    let root = root.to_path_buf();
    let expected = captured.observed.clone();
    let authorized = captured.authorized.clone();
    tokio::task::spawn_blocking(move || {
        git::stage_authorized(&root, &expected, &authorized, &ignored, &stage_paths)
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

fn recorded_resume(
    view: &View,
    captured: &Capture,
    config: &Generation,
) -> Result<Option<(Record, ResumeInvocation)>> {
    for record in persistence::read(&view.snapshot.data)?.into_values() {
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
            && git::committed_file(root, commit, &path)? != expected
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
        move || git::observe(&root)
    })
    .await
    .map_err(|_| Error::Closed)??;
    let expected = observed.clone();
    let staged = tokio::task::spawn_blocking(move || {
        git::stage_authorized(&root, &expected, &paths, &BTreeSet::new(), &paths)
    })
    .await
    .map_err(|_| Error::Closed)??;
    Ok((observed, staged))
}

async fn finalize_pause<I: ConfigIo>(
    session: &Session<I>,
    view: &mut View,
    captured: &Capture,
    invocation: &ResumeInvocation,
    config: &Generation,
    root: &Path,
    planning: &Path,
) -> Result<Response> {
    loop {
        if session.config()? != *config || session.derivation_view().await? != *view {
            return Err(Error::Conflict(
                "pause store/config changed before record commit".into(),
            ));
        }
        verify_participants(root, planning, view, None)?;
        let (observed, staged) =
            stage_final(session, view, captured, config, root, planning).await?;
        if observed.branch != invocation.branch {
            return Err(Error::Conflict(
                "pause branch changed before record commit".into(),
            ));
        }
        let Some(staged) = staged else {
            git::require_clean(root)?;
            verify_participants(root, planning, view, Some(&observed.head))?;
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
        verify_participants(root, planning, view, None)?;
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
            git::commit_guarded(&root_for_commit, &latest, &subject)
        })
        .await
        .map_err(|_| Error::Closed)??;
        if session.derivation_view().await? != *view {
            return Err(Error::Conflict(
                "pause store changed after record commit".into(),
            ));
        }
        verify_participants(root, planning, view, Some(&committed))?;
        git::require_clean(root)?;
        pause_barrier("after-final-commit");
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

async fn override_review<I: ConfigIo>(
    session: &Session<I>,
    view: &mut View,
    scope: &Scope,
    gate: &Gate,
    review: &Review,
) -> Result<String> {
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
    if let Some(recorded) = persistence::read(&view.snapshot.data)?
        .values()
        .find_map(|record| {
            if record.scope == *scope
                && let Fact::Override(recorded) = &record.fact
                && recorded.id == id
            {
                Some(recorded)
            } else {
                None
            }
        })
    {
        return if recorded == &value {
            Ok(id)
        } else {
            Err(Error::Conflict("pause risk override changed".into()))
        };
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

async fn risk_gate<I: ConfigIo>(
    session: &Session<I>,
    view: &mut View,
    captured: &mut Capture,
    config: &Generation,
    root: &Path,
    planning: &Path,
    kind: CommitKind,
) -> Result<Response> {
    let consequence = consequence(config)?;
    if consequence == Consequence::Off {
        captured.risk = Some(Outcome::Off);
        return Ok(Response::Ready(Box::new(captured.clone())));
    }
    let receipts = receipt_paths(session, root)?;
    let initial = git::staged(root, &captured.observed.head, &receipts)?;
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
    let current_index = git::index_id(root)?;
    let prior = prior_blocking(view, &captured.scope, kind)?;
    let mut round = 1;
    let mut base = captured.observed.head.clone();
    let mut force_review = false;
    if let Some(prior) = &prior {
        if prior.fire.index_id == current_index {
            round = prior.fire.round;
            base.clone_from(&prior.fire.base);
            force_review = true;
        } else {
            let gate = recorded_gate(
                session,
                &captured.scope,
                view,
                risk::disposition_question(prior),
            )
            .await?;
            match &gate.state {
                State::Answered(answer)
                    if answer.selected_option.as_deref() == Some("fix")
                        && answer.disposition != Disposition::Stop
                        && prior.fire.round == 1 =>
                {
                    round = 2;
                    base.clone_from(&prior.fire.index_id);
                    force_review = true;
                }
                State::Answered(answer)
                    if answer.selected_option.as_deref() == Some("override")
                        && answer.disposition != Disposition::Stop => {}
                State::Answered(_) | State::Superseded { .. } => {
                    return Ok(Response::Refused(
                        "pause risk disposition stopped or exhausted".into(),
                    ));
                }
                State::Unanswered => return Ok(Response::Wait(Box::new(gate))),
            }
        }
    }
    let staged = git::staged(root, &base, &receipts)?;
    if round == 2
        && let Some(prior) = &prior
        && prior.fire.round == 1
    {
        let paths = |values: &[PathBuf]| {
            values
                .iter()
                .map(|p| p.to_string_lossy().into_owned())
                .collect::<Vec<_>>()
        };
        if !cadence::rail::receipts::narrowed_scope(
            &paths(&prior.fire.authored),
            &paths(&staged.authored),
            false,
        ) {
            return Ok(Response::Refused(
                "risk re-arm must narrow the original authored scope".into(),
            ));
        }
    }
    let scan = risk_diff::scan(Some(&staged.diff), &staged.authored, &surfaces)?;
    let fire = risk::Fire::new(&captured.scope, kind, round, &staged, scan)?;
    if !force_review && fire.scan.matches.is_empty() && !fire.scan.inconclusive {
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
    match consequence {
        Consequence::Off => unreachable!("returned before detection"),
        Consequence::Advisory => {
            captured.risk = Some(Outcome::Advisory(review));
        }
        Consequence::Deferred => {
            let queue = persist_deferred(planning, &captured.scope.phase, &review)?;
            captured.risk = Some(Outcome::Deferred { review, queue });
        }
        Consequence::Blocking if review.permits(consequence) => {
            captured.risk = Some(Outcome::BlockingCleared(review));
        }
        Consequence::Adjudicated if review.permits(consequence) => {
            captured.risk = Some(Outcome::Adjudicated(review));
        }
        Consequence::Blocking | Consequence::Adjudicated => {
            let gate = recorded_gate(
                session,
                &captured.scope,
                view,
                risk::disposition_question(&review),
            )
            .await?;
            let State::Answered(answer) = &gate.state else {
                return Ok(Response::Wait(Box::new(gate)));
            };
            if answer.disposition == Disposition::Stop
                || answer.selected_option.as_deref() == Some("abort")
            {
                return Ok(Response::Refused("pause risk choice stopped".into()));
            }
            match answer.selected_option.as_deref() {
                Some("fix") if review.fire.round == 1 => {
                    return Ok(Response::Refused(
                        "risk fix requested; stage the narrowed fix and repeat pause".into(),
                    ));
                }
                Some("override") => {
                    let id =
                        override_review(session, view, &captured.scope, &gate, &review).await?;
                    captured.risk = Some(Outcome::Overridden {
                        review,
                        override_id: id,
                    });
                }
                _ => {
                    return Ok(Response::Refused(
                        "pause risk choice is not actionable".into(),
                    ));
                }
            }
        }
    }
    Ok(Response::Ready(Box::new(captured.clone())))
}

async fn observe(root: PathBuf, planning: PathBuf, policy: Policy) -> Result<branch::Observed> {
    tokio::task::spawn_blocking(move || branch::observe(&root, &planning, &policy))
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
        git::run(&root, ["check-ref-format", "--branch", &name])?;
        git::run(&root, ["checkout", "-b", &name])?;
        Ok(())
    })
    .await
    .map_err(|_| Error::Closed)?
}

pub async fn execute<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    input: Input,
    driver: &Driver,
) -> Result<Response> {
    let root = PathBuf::from(&input.scope.project);
    let planning = PathBuf::from(&input.scope.planning_root);
    // Capture Git before first-touch migration, lifecycle memo or question writes.
    let git_root = root.clone();
    let original = tokio::task::spawn_blocking(move || git::observe(&git_root))
        .await
        .map_err(|_| Error::Closed)??;
    let (checked, mut view) = derivation_service::checked_query(factory, &planning, driver)
        .await
        .map_err(|e| Error::Conflict(format!("pause lifecycle: {e}")))?;
    let retained = checked.intake().cloned();
    let mut captured =
        tokio::task::spawn_blocking(move || pause::capture(input, retained.as_ref()))
            .await
            .map_err(|_| Error::Closed)??;
    captured.observed = original;
    let session = factory.first_touch(&planning).await?;
    let config = session.config()?;
    if let Some((record, invocation)) = recorded_resume(&view, &captured, &config)? {
        if captured.observed.branch != invocation.branch {
            return Err(Error::Conflict(
                "pause branch changed after its resume record".into(),
            ));
        }
        let operation = format!("pause-resume:{}", record.key()?);
        view = session.commit_evidence(&view, &operation, &record).await?;
        pause_barrier("after-record");
        return finalize_pause(
            &session,
            &mut view,
            &captured,
            &invocation,
            &config,
            &root,
            &planning,
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
                    &session, &config, &root, &planning, &policy, &observed, name,
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
                    &session, &config, &root, &planning, &policy, &observed, name,
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
            &session, &config, &root, &planning, &policy, &observed, name,
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
    let wip = prepare_wip(&session, &view, &captured, &config, &root, &planning).await?;
    let response = risk_gate(
        &session,
        &mut view,
        &mut captured,
        &config,
        &root,
        &planning,
        CommitKind::Wip,
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
            tokio::task::spawn_blocking(move || git::commit_wip(&root, &wip, &description))
                .await
                .map_err(|_| Error::Closed)??;
        ready.wip = Some(committed);
        pause_barrier("after-wip");
    }
    if session.config()? != config {
        return Err(Error::Conflict(
            "pause config changed before resume persistence".into(),
        ));
    }
    let record_observation = {
        let root = root.clone();
        tokio::task::spawn_blocking(move || git::observe(&root))
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
    pause_barrier("after-record");
    finalize_pause(
        &session,
        &mut view,
        &ready,
        &invocation,
        &config,
        &root,
        &planning,
    )
    .await
}
