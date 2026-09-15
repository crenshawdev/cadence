//! Bash decisions use a short-lived writer, independent of the resident queue.
use cadence::rail::branch::{self, Permission};
use cadence::store::model::digest;
use cadence::store::writer::audit::{self, Audit, Outcome, PolicyEvidence, Verb};
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

/// Linear bounded scan. Unsupported shell structure declines the entire input.
fn verb(command: &str) -> Option<Verb> {
    let mut quote = None;
    let mut word = String::new();
    let mut started = false;
    let mut words = Vec::new();
    let mut push = false;
    let mut commit = false;
    let mut chars = command.chars();
    let finish_word = |word: &mut String, started: &mut bool, words: &mut Vec<String>| {
        if *started {
            words.push(std::mem::take(word));
            *started = false;
        }
    };
    let segment = |words: &mut Vec<String>, push: &mut bool, commit: &mut bool| {
        if words
            .first()
            .is_some_and(|head| head == "git" || head.ends_with("/git"))
        {
            let mut i = 1;
            while i < words.len() {
                let word = &words[i];
                if matches!(
                    word.as_str(),
                    "-C" | "-c"
                        | "--git-dir"
                        | "--work-tree"
                        | "--namespace"
                        | "--exec-path"
                        | "--config-env"
                ) {
                    i += 2;
                } else if word.starts_with('-') {
                    i += 1;
                } else {
                    *push |= word == "push";
                    *commit |= word == "commit";
                    break;
                }
            }
        }
        words.clear();
    };
    while let Some(ch) = chars.next() {
        if ch == '\0' {
            return None;
        }
        if quote == Some('\'') {
            if ch == '\'' {
                quote = None;
            } else {
                word.push(ch);
            }
            continue;
        }
        if ch == '\\' {
            let escaped = chars.next()?;
            if escaped != '\n' {
                word.push(escaped);
                started = true;
            }
            continue;
        }
        if matches!(ch, '$' | '`') {
            return None;
        }
        if quote == Some('"') {
            if ch == '"' {
                quote = None;
            } else {
                word.push(ch);
            }
            continue;
        }
        match ch {
            '\'' | '"' => {
                quote = Some(ch);
                started = true;
            }
            ';' | '|' | '&' | '\n' => {
                finish_word(&mut word, &mut started, &mut words);
                segment(&mut words, &mut push, &mut commit);
            }
            '(' | ')' | '{' | '}' | '<' | '>' => return None,
            '#' if !started => return None,
            ch if ch.is_ascii_whitespace() => finish_word(&mut word, &mut started, &mut words),
            ch => {
                word.push(ch);
                started = true;
            }
        }
    }
    if quote.is_some() {
        return None;
    }
    finish_word(&mut word, &mut started, &mut words);
    segment(&mut words, &mut push, &mut commit);
    if push {
        Some(Verb::Push)
    } else if commit {
        Some(Verb::Commit)
    } else {
        None
    }
}

fn unavailable(input: impl Into<String>, reason: impl Into<String>) -> audit::Unavailable {
    audit::Unavailable {
        input: input.into(),
        reason: reason.into(),
    }
}

fn read_policy(
    planning: &Path,
    global: Option<PathBuf>,
    prior: Option<&cadence::store::writer::View>,
) -> (PolicyEvidence, Vec<audit::Unavailable>) {
    use crate::config::{
        merge,
        reload::{self, ConfigIo, FileIo, Paths},
    };
    let previous = prior.and_then(audit::denial_policy);
    let imported = prior.is_some_and(|v| v.snapshot.data["import"]["complete"] == true)
        || planning.join("config.v4.json").exists();
    let legacy = Paths {
        repo: planning.join("config.json"),
        global,
    };
    let paths = if imported {
        crate::config::write::active_paths(&legacy).unwrap_or(legacy)
    } else {
        legacy
    };
    let mut failures = Vec::new();
    let mut provenance = std::collections::BTreeMap::new();
    let mut layer = |label: &str, path: &Path, required: bool| -> Option<serde_json::Value> {
        let input_name = format!("{label} config {}", path.display());
        provenance.insert(format!("layer.{label}.path"), path.display().to_string());
        let read = reload::identity(path).and_then(|path| FileIo.read(&path));
        match read {
            Ok(input) => match input.bytes {
                Some(bytes) => {
                    provenance.insert(format!("layer.{label}.digest"), digest(&bytes));
                    match serde_json::from_slice::<serde_json::Value>(&bytes) {
                        Ok(value) if value.is_object() => Some(value),
                        _ => {
                            failures.push(unavailable(
                                input_name,
                                "controlling layer is malformed or not an object",
                            ));
                            None
                        }
                    }
                }
                None => {
                    provenance.insert(format!("layer.{label}.digest"), "absent".into());
                    if required
                        || previous
                            .as_ref()
                            .and_then(|p| p.provenance.get(&format!("layer.{label}.digest")))
                            .is_some_and(|d| d != "absent")
                    {
                        failures.push(unavailable(
                            input_name,
                            "previously controlling layer is missing",
                        ));
                    }
                    None
                }
            },
            Err(_) => {
                failures.push(unavailable(input_name, "controlling layer cannot be read"));
                None
            }
        }
    };
    let global = paths
        .global
        .as_deref()
        .filter(|path| reload::identity(path).ok() != reload::identity(&paths.repo).ok())
        .and_then(|path| layer("global", path, false));
    let repo = layer("repo", &paths.repo, imported);
    let effective = merge::merge(global, repo, false);
    if let Err(error) = reload::validate_effective(&effective) {
        failures.push(unavailable("merged config", error.to_string()));
    }
    let values = &effective.values;
    let protected = branch::protected_branches(merge::get(values, "git.protected_branches"));
    let on_protected = merge::get(values, "git.on_protected")
        .and_then(serde_json::Value::as_str)
        .filter(|value| matches!(*value, "ask" | "refuse" | "allow"))
        .unwrap_or("ask")
        .to_owned();
    let hard_fail = merge::get(values, "git.guard_hard_fail").and_then(serde_json::Value::as_bool)
        == Some(true);
    provenance.extend(
        effective
            .sources
            .iter()
            .filter(|(key, _)| key.starts_with("git."))
            .map(|(key, layer)| (key.clone(), format!("{layer:?}"))),
    );
    (
        PolicyEvidence {
            complete: failures.is_empty(),
            provenance,
            protected,
            on_protected,
            hard_fail,
        },
        failures,
    )
}

fn branch_observation(cwd: &Path) -> (Option<String>, Vec<audit::Unavailable>) {
    let observed = std::process::Command::new("git")
        .current_dir(cwd)
        .env_remove("GIT_DIR")
        .env_remove("GIT_WORK_TREE")
        .env_remove("GIT_COMMON_DIR")
        .env_remove("GIT_NAMESPACE")
        .args(["symbolic-ref", "--quiet", "--short", "HEAD"])
        .stdin(std::process::Stdio::null())
        .output();
    match observed {
        Ok(output) if output.status.success() => {
            if let Ok(name) = String::from_utf8(output.stdout) {
                let name = name.trim_end_matches('\n');
                if !name.is_empty() {
                    return (Some(name.into()), vec![]);
                }
            }
            (
                None,
                vec![unavailable(
                    "branch",
                    "current branch is empty or unreadable",
                )],
            )
        }
        Ok(output) if output.status.code() == Some(1) => (
            None,
            vec![unavailable(
                "branch",
                "current branch is unresolvable or HEAD is detached",
            )],
        ),
        _ => (
            None,
            vec![unavailable("Git", "Git cannot read the cwd repository")],
        ),
    }
}

fn regular_text(path: &Path) -> Option<String> {
    use std::io::Read;
    use std::os::unix::fs::{MetadataExt, OpenOptionsExt};
    let mut file = std::fs::OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_NOFOLLOW)
        .open(path)
        .ok()?;
    let metadata = file.metadata().ok()?;
    if !metadata.is_file() || metadata.mode() & 0o444 == 0 || metadata.len() > 4096 {
        return None;
    }
    let mut bytes = Vec::new();
    file.by_ref().take(4097).read_to_end(&mut bytes).ok()?;
    if bytes.len() > 4096 {
        return None;
    }
    String::from_utf8(bytes).ok()
}

/// Current symbolic identity only; a previous branch observation is never reused.
fn symbolic_head(cwd: &Path) -> Option<String> {
    let cwd = std::fs::canonicalize(cwd).ok()?;
    for directory in cwd.ancestors() {
        let dotgit = directory.join(".git");
        let metadata = match std::fs::symlink_metadata(&dotgit) {
            Ok(m) => m,
            Err(_) => continue,
        };
        let gitdir = if metadata.is_dir() {
            dotgit
        } else if metadata.is_file() {
            let text = regular_text(&dotgit)?;
            let target = text.strip_prefix("gitdir: ")?.trim_end_matches('\n');
            std::fs::canonicalize(directory.join(target)).ok()?
        } else {
            return None;
        };
        let text = regular_text(&gitdir.join("HEAD"))?;
        let name = text
            .strip_prefix("ref: refs/heads/")?
            .trim_end_matches('\n');
        if name.is_empty()
            || name.starts_with(['/', '-'])
            || name.ends_with(['/', '.'])
            || name.contains("..")
            || name.contains("//")
            || name.contains("@{")
            || name
                .chars()
                .any(|c| c.is_control() || c.is_whitespace() || "~^:?*[\\".contains(c))
            || name
                .split('/')
                .any(|part| part.starts_with('.') || part.ends_with(".lock"))
        {
            return None;
        }
        return Some(name.into());
    }
    None
}

fn commit_decision(
    audit: &mut Audit,
    policy: PolicyEvidence,
    mut failures: Vec<audit::Unavailable>,
    prior: Option<&cadence::store::writer::View>,
) -> bool {
    let torn = !failures.is_empty();
    let (branch, observation_failures) = branch_observation(&audit.cwd);
    let observed = observation_failures.is_empty();
    failures.extend(observation_failures);
    let branch = branch.or_else(|| symbolic_head(&audit.cwd));
    let cached = prior.and_then(audit::denial_policy);
    let current_denies = observed
        && branch.as_deref().is_some_and(|name| {
            branch::permission(&policy.protected, &policy.on_protected, name)
                == Ok(Permission::Deny)
        });
    let failure_denies = !failures.is_empty()
        && branch.as_deref().is_some_and(|name| {
            (policy.hard_fail && policy.protected.iter().any(|p| p == name))
                || (torn
                    && cached
                        .as_ref()
                        .is_some_and(|p| p.hard_fail && p.protected.iter().any(|p| p == name)))
        });
    audit.outcome = if current_denies || failure_denies {
        Outcome::Deny
    } else if torn {
        Outcome::Ask
    } else if !observed {
        Outcome::FailurePass
    } else if branch.as_deref().is_some_and(|name| {
        branch::permission(&policy.protected, &policy.on_protected, name) == Ok(Permission::Ask)
    }) {
        Outcome::Ask
    } else {
        Outcome::Pass
    };
    audit.reason = match audit.outcome {
        Outcome::Deny if failure_denies => format!("Cadence rail: git.guard_hard_fail=true denies a commit on provably protected branch {:?} while guard inputs are unavailable.", branch),
        Outcome::Deny => format!("Cadence rail: git.on_protected=refuse denies a commit on protected branch {:?}.", branch),
        Outcome::Ask => format!("Cadence rail: permission is required before this commit on branch {:?}.", branch),
        Outcome::FailurePass => "Cadence guard failure: command proceeds without a Cadence permission veto; this is not policy approval.".into(),
        Outcome::Pass => "Cadence protected-branch policy supplies no permission veto.".into(),
    };
    if torn {
        audit.reason.push_str(" The protected-branch list or controlling settings are unavailable: the branch rails are deciding with defaults rather than the user's settings. Fix the named layer or approve deliberately.");
    }
    for failure in &failures {
        audit.reason.push_str(&format!(
            " Unavailable {}: {}.",
            failure.input, failure.reason
        ));
    }
    if !failures.is_empty() {
        eprintln!("{}", audit.reason);
    }
    audit.branch = branch;
    audit.unavailable = failures;
    // A changed denial snapshot is a recorded policy observation, with no allow
    // response that could bypass the host's remaining permission checks.
    let confirm_policy =
        policy.complete && (policy.hard_fail || cached.as_ref().is_some_and(|p| p != &policy));
    audit.policy = Some(Box::new(policy));
    audit.outcome != Outcome::Pass || confirm_policy
}

fn respond(receipt: &Audit) -> ExitCode {
    match receipt.outcome {
        Outcome::Ask => super::write_decision("ask", &receipt.reason),
        Outcome::Deny => super::write_decision("deny", &receipt.reason),
        Outcome::Pass | Outcome::FailurePass => ExitCode::SUCCESS,
    }
}
fn audit_failed(audit: &Audit, error: impl std::fmt::Display) -> ExitCode {
    eprintln!(
        "cadence guard failure: audit storage/confirmation unavailable: {error}; decision was not confirmed durably. {}",
        audit.reason
    );
    if audit.outcome == Outcome::Deny {
        respond(audit)
    } else {
        ExitCode::SUCCESS
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
    let planning = project.join(".planning");
    let global = std::env::var_os("CADENCE_GLOBAL_CONFIG")
        .map(PathBuf::from)
        .or_else(|| {
            std::env::var_os("HOME")
                .map(|home| PathBuf::from(home).join(".claude/cadence/config.json"))
        })
        .filter(|path| !path.as_os_str().is_empty());
    let factory =
        crate::import::SessionFactory::new(global.clone(), std::sync::Arc::new(|_, _| Ok(())));
    let mut audit = Audit {
        event_id: audit::event_identity(event.session_id.as_deref(), event.tool_use_id.as_deref()),
        command_digest: digest(event.tool_input.command.as_bytes()), cwd: event.cwd,
        project: project.clone(), verb, branch: None, policy: None, outcome: Outcome::Ask,
        unavailable: vec![], reason: "Cadence rail: every Bash git push requires permission. Approve only if you are deliberately publishing.".into(),
    };
    let runtime = match tokio::runtime::Builder::new_current_thread().build() {
        Ok(runtime) => runtime,
        Err(error) => return audit_failed(&audit, error),
    };
    let prior = runtime.block_on(audit::confirmed(&planning)).ok();
    // Host redelivery replays the confirmed answer even after its policy changes.
    if let Some(record) = prior.as_ref().and_then(|view| {
        view.decisions
            .iter()
            .find(|record| Some(&record.id) == audit.id().ok().as_ref())
    }) && let Ok(receipt) = audit::from_record(record)
        && audit.same_event(&receipt)
    {
        return respond(&receipt);
    }
    if audit.verb == Verb::Commit {
        let (policy, failures) = read_policy(&planning, global, prior.as_ref());
        if !commit_decision(&mut audit, policy, failures, prior.as_ref()) {
            return ExitCode::SUCCESS;
        }
    }
    let id = audit.id().expect("serializable audit identity");
    match runtime.block_on(factory.guard_audit(&planning, audit.clone())) {
        Ok(view) => match view
            .decisions
            .iter()
            .find(|record| record.id == id)
            .ok_or_else(|| cadence::store::Error::Invalid("confirmed guard receipt missing".into()))
            .and_then(audit::from_record)
        {
            Ok(receipt) => respond(&receipt),
            Err(error) => audit_failed(&audit, error),
        },
        Err(error) => audit_failed(&audit, error),
    }
}
