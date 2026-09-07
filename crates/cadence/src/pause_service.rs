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
        self, Capture, Input,
        branch::{self, Integration, Policy},
        git,
        risk::{self, CommitKind, Consequence, Outcome, Review},
        risk_diff,
    },
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
    if value.is_null() {
        return Ok(None);
    }
    let values = value
        .as_array()
        .ok_or_else(|| Error::Policy("invalid effective risk_surface surfaces".into()))?
        .iter()
        .map(|value| {
            value
                .as_str()
                .map(str::to_owned)
                .ok_or_else(|| Error::Policy("invalid effective risk surface".into()))
        })
        .collect::<Result<Vec<_>>>()?;
    risk::validate_surfaces(values).map(Some)
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

fn persist_deferred(planning: &Path, phase: &str, review: &Review) -> Result<PathBuf> {
    let home = planning.join("phases").join(phase);
    if !home.is_dir() {
        return Err(Error::Conflict(
            "pause risk phase directory is unavailable".into(),
        ));
    }
    let short = review
        .fire
        .index_id
        .get(..12)
        .unwrap_or(&review.fire.index_id);
    let suffix = if review.fire.round > 1 {
        format!("-r{}", review.fire.round)
    } else {
        String::new()
    };
    let discriminator = format!("pause-{short}");
    let review_path = home.join(format!("REVIEW-risk_surface-{discriminator}{suffix}.md"));
    write_same(
        &review_path,
        &serde_json::to_vec_pretty(&serde_json::json!({
            "findings": review.findings,
        }))?,
    )?;
    let queue_name = format!("DEFERRED-risk_surface-{discriminator}{suffix}.json");
    let queue_path = home.join(&queue_name);
    let queue = serde_json::to_vec_pretty(&serde_json::json!({
        "phase": phase,
        "trigger": "risk_surface",
        "discriminator": discriminator,
        "round": review.fire.round,
        "findings": review.findings,
        "payload": review_path.strip_prefix(planning).unwrap_or(&review_path),
    }))?;
    write_same(&queue_path, &queue)?;
    Ok(Path::new("phases").join(phase).join(queue_name))
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
    let value = Override {
        id: id.clone(),
        reason: answer
            .adjustment
            .clone()
            .unwrap_or_else(|| answer.actual_response.clone()),
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
        let gate = recorded_gate(
            session,
            &captured.scope,
            view,
            risk::surfaces_question(&captured.scope)?,
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
        Consequence::Blocking if !review.blocking() => {
            captured.risk = Some(Outcome::BlockingCleared(review));
        }
        Consequence::Adjudicated if review.findings.is_empty() => {
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
    risk_gate(
        &session,
        &mut view,
        &mut captured,
        &config,
        &root,
        &planning,
        CommitKind::Wip,
    )
    .await
}
