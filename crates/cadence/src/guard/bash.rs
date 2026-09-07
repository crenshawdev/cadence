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
    let mut audit = Audit {
        event_id: audit::event_identity(event.session_id.as_deref(), event.tool_use_id.as_deref()),
        command_digest: digest(event.tool_input.command.as_bytes()),
        cwd: event.cwd, project: project.clone(), verb, branch: None, policy: None,
        outcome: Outcome::Ask, unavailable: vec![],
        reason: "Cadence rail: every Bash git push requires permission. Approve only if you are deliberately publishing.".into(),
    };
    if audit.verb == Verb::Commit {
        let Ok(config) = factory.guard_config(&project.join(".planning")) else {
            return ExitCode::SUCCESS;
        };
        let observed = std::process::Command::new("git")
            .current_dir(&audit.cwd)
            .args(["symbolic-ref", "--quiet", "--short", "HEAD"])
            .stdin(std::process::Stdio::null())
            .output();
        let Ok(observed) = observed else {
            return ExitCode::SUCCESS;
        };
        if !observed.status.success() {
            return ExitCode::SUCCESS;
        }
        let Ok(name) = String::from_utf8(observed.stdout) else {
            return ExitCode::SUCCESS;
        };
        let name = name.trim_end_matches('\n').to_owned();
        if name.is_empty() {
            return ExitCode::SUCCESS;
        }
        let values = &config.effective.values;
        let protected =
            branch::protected_branches(crate::config::merge::get(values, "git.protected_branches"));
        let on_protected = crate::config::merge::get(values, "git.on_protected")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("ask");
        let permission = branch::permission(&protected, on_protected, &name);
        audit.outcome = match permission {
            Ok(Permission::Ask) => Outcome::Ask,
            Ok(Permission::Deny) => Outcome::Deny,
            _ => return ExitCode::SUCCESS,
        };
        audit.reason = format!(
            "Cadence rail: {name:?} is a protected branch; git.on_protected={on_protected}. Create a task branch or obtain permission to commit here."
        );
        audit.branch = Some(name);
        audit.policy = Some(PolicyEvidence {
            complete: true,
            protected,
            on_protected: on_protected.into(),
            hard_fail: crate::config::merge::get(values, "git.guard_hard_fail")
                .and_then(serde_json::Value::as_bool)
                .unwrap_or(false),
            provenance: config
                .effective
                .sources
                .iter()
                .filter(|(key, _)| key.starts_with("git."))
                .map(|(key, layer)| (key.clone(), format!("{layer:?}")))
                .collect(),
        });
    }
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
