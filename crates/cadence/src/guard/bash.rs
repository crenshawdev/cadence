//! Bash decisions use a short-lived writer, independent of the resident queue.
use cadence::store::model::digest;
use cadence::store::writer::audit::{self, Audit, Outcome, Verb};
use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

#[derive(Deserialize)]
struct Event {
    tool_name: String,
    cwd: PathBuf,
    tool_input: Input,
    #[serde(default)]
    hook_event_name: Option<String>,
    #[serde(default)]
    session_id: Option<String>,
    #[serde(default)]
    tool_use_id: Option<String>,
}
#[derive(Deserialize)]
struct Input {
    command: String,
}

fn project(cwd: &Path) -> Option<PathBuf> {
    if !cwd.is_absolute() {
        return None;
    }
    let cwd = std::fs::canonicalize(cwd).ok()?;
    if !cwd.is_dir() {
        return None;
    }
    for directory in cwd.ancestors() {
        if directory.join(".planning").is_dir() {
            return Some(directory.into());
        }
        if std::fs::symlink_metadata(directory.join(".git")).is_ok() {
            return None;
        }
    }
    None
}

fn verb(command: &str) -> Option<Verb> {
    let mut words = command.split_ascii_whitespace();
    let head = words.next()?;
    if head != "git" && !head.ends_with("/git") {
        return None;
    }
    match words.next()? {
        "push" => Some(Verb::Push),
        _ => None,
    }
}

pub(super) fn run(bytes: &[u8]) -> ExitCode {
    let Ok(event) = serde_json::from_slice::<Event>(bytes) else {
        return ExitCode::SUCCESS;
    };
    if event.tool_name != "Bash"
        || event
            .hook_event_name
            .as_deref()
            .is_some_and(|name| name != "PreToolUse")
    {
        return ExitCode::SUCCESS;
    }
    let Some(verb) = verb(&event.tool_input.command) else {
        return ExitCode::SUCCESS;
    };
    let Some(project) = project(&event.cwd) else {
        return ExitCode::SUCCESS;
    };
    let global = std::env::var_os("CADENCE_GLOBAL_CONFIG")
        .map(PathBuf::from)
        .or_else(|| {
            std::env::var_os("HOME")
                .map(|home| PathBuf::from(home).join(".claude/cadence/config.json"))
        })
        .filter(|path| !path.as_os_str().is_empty());
    let factory = crate::import::SessionFactory::new(global, std::sync::Arc::new(|_, _| Ok(())));
    let audit = Audit {
        event_id: audit::event_identity(event.session_id.as_deref(), event.tool_use_id.as_deref()),
        command_digest: digest(event.tool_input.command.as_bytes()),
        cwd: event.cwd, project: project.clone(), verb, branch: None, policy: None,
        outcome: Outcome::Ask, unavailable: vec![],
        reason: "Cadence rail: every Bash git push requires permission. Approve only if you are deliberately publishing.".into(),
    };
    let runtime = match tokio::runtime::Builder::new_current_thread().build() {
        Ok(runtime) => runtime,
        Err(error) => {
            eprintln!(
                "cadence guard failure: audit runtime unavailable: {error}; command proceeds without a recorded decision"
            );
            return ExitCode::SUCCESS;
        }
    };
    let id = audit.id().expect("serializable audit identity");
    match runtime.block_on(factory.guard_audit(&project.join(".planning"), audit)) {
        Ok(view) => {
            let receipt = view
                .decisions
                .iter()
                .find(|record| record.id == id)
                .ok_or_else(|| {
                    cadence::store::Error::Invalid("confirmed guard receipt missing".into())
                })
                .and_then(audit::from_record);
            match receipt {
                Ok(receipt) => match receipt.outcome {
                    Outcome::Ask => super::write_decision("ask", receipt.reason),
                    Outcome::Deny => super::write_decision("deny", receipt.reason),
                    Outcome::Pass | Outcome::FailurePass => ExitCode::SUCCESS,
                },
                Err(error) => {
                    eprintln!("cadence guard failure: audit confirmation unavailable: {error}");
                    ExitCode::SUCCESS
                }
            }
        }
        Err(error) => {
            eprintln!(
                "cadence guard failure: audit storage unavailable: {error}; command proceeds without a recorded decision"
            );
            ExitCode::SUCCESS
        }
    }
}
