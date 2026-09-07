//! Internal pause request. Durable answers precede dependent Git operations.
use super::derivation_service::{self, Driver};
use crate::{
    config::{
        merge,
        reload::{ConfigIo, Generation},
    },
    import::{Session, SessionFactory},
};
use cadence::{
    evidence::{
        self, Fact, Record, Scope,
        gates::{Disposition, Gate, State},
        persistence,
    },
    pause::{
        self, Capture, Input,
        branch::{self, Integration, Policy},
        git,
    },
    store::{Error, Result, writer::View},
};
use std::path::{Path, PathBuf};

#[derive(Clone, Debug)]
pub enum Response {
    Ready(Box<Capture>),
    Wait(Box<Gate>),
    Refused(String),
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

async fn answer<I: ConfigIo>(
    session: &Session<I>,
    scope: &Scope,
    view: &mut View,
    pending: Gate,
    name: Option<&str>,
) -> Result<Choice> {
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
        return Ok(Choice::Wait(Box::new(pending)));
    };
    let mut question = gate.clone();
    question.state = State::Unanswered;
    if question != pending {
        return Err(Error::Conflict("pause question changed".into()));
    }
    match &gate.state {
        State::Unanswered => Ok(Choice::Wait(Box::new(gate.clone()))),
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
    if session.config()? != config || observe(root, planning, policy).await? != observed {
        return Err(Error::Conflict(
            "pause branch/config changed before continuation".into(),
        ));
    }
    captured.observed.branch = observed.branch.into_bytes();
    Ok(Response::Ready(Box::new(captured)))
}
