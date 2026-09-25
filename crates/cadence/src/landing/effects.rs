//! Binary-owned subprocesses. Callers journal the invocation before launch.
use super::model::{Authorize, ExternalInput, Landing, Step};
use crate::{rail::branch, store::{Error, Result}};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use crate::process::{Launch, Process};
use std::{path::Path, time::Duration};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Invocation { pub program: String, pub args: Vec<String> }

const OUTPUT_BOUND: usize = 65_536;

/// One owned subprocess: its own group so a descendant cannot outlive it, a
/// minute to finish, and a bounded capture of what it said.
pub fn run(root: &Path, invocation: &Invocation, process: &mut dyn Process) -> Result<String> {
    let launch = invocation_launch(root, invocation);
    let output = if invocation.program == "git" {
        crate::git_process::run(&launch, process)?
    } else {
        process.run(&launch)?
    };
    if !output.success() || !output.complete() {
        return Err(Error::Invalid(format!("{} returned {}; output exceeded bound: {}; {}",
            invocation.program, output.status, !output.complete(),
            String::from_utf8_lossy(&output.stderr))));
    }
    String::from_utf8(output.stdout).map_err(|_| Error::Invalid("subprocess output is not UTF-8".into()))
}

fn invocation_launch(root: &Path, invocation: &Invocation) -> Launch {
    let launch = if invocation.program == "git" {
        crate::git_process::launch(crate::git_process::Caller::LandingGit)
    } else {
        Launch::new(&invocation.program).timeout(Duration::from_secs(60)).own_group()
    };
    launch
            .args(&invocation.args)
            .cwd(root)
            .own_group()
            .env("GIT_TERMINAL_PROMPT", "0")
            .env("GH_PROMPT_DISABLED", "1")
            .env("GIT_OPTIONAL_LOCKS", "0")
            .limit(OUTPUT_BOUND)
}

pub fn observe(root: &Path, args: &[&str], process: &mut dyn Process) -> Result<String> {
    run(root, &Invocation { program: "git".into(), args: args.iter().map(|s| (*s).into()).collect() }, process)
        .map(|s| s.trim_end().into())
}

pub fn valid_ref(name: &str) -> bool {
    name.starts_with("refs/") && !name.ends_with('.') && !name.contains("..") && !name.contains("@{")
        && !name.chars().any(|c| c.is_control() || " ~^:?*[\\".contains(c))
        && name.split('/').all(|part| !part.is_empty() && !part.starts_with('.') && !part.ends_with(".lock"))
}

pub fn source_matches(root: &Path, landing: &Landing, process: &mut dyn Process) -> Result<bool> {
    Ok(observe(root, &["symbolic-ref", "--quiet", "--short", "HEAD"], process)? == landing.source.branch
        && observe(root, &["rev-parse", "--verify", "HEAD^{commit}"], process)? == landing.source.head
        && observe(root, &["rev-parse", "--verify", "--end-of-options", &format!("refs/heads/{}^{{commit}}", landing.source.branch)], process)? == landing.source.head
        && observe(root, &["remote", "get-url", "--push", "--all", &landing.remote.name], process)? == landing.remote.url
        && observe(root, &["remote", "get-url", "--all", &landing.remote.name], process)? == landing.remote.url)
}

pub fn remote_head(root: &Path, landing: &Landing, reference: &str, process: &mut dyn Process) -> Result<Option<String>> {
    let output = observe(root, &["ls-remote", "--refs", "--", &landing.remote.url, reference], process)?;
    let mut found = None;
    for line in output.lines() {
        let (sha, name) = line.split_once('\t').ok_or_else(|| Error::Invalid(format!("malformed remote ref: {line}")))?;
        if name != reference || found.is_some() || !matches!(sha.len(), 40 | 64) || !sha.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err(Error::Invalid(format!("ambiguous remote ref {reference}: {output}")));
        }
        found = Some(sha.to_owned());
    }
    Ok(found)
}

pub fn policy(landing: &Landing, inputs: &ExternalInput, config: &Value) -> Result<()> {
    let step = inputs.step();
    let target = if step == Step::Merge { &landing.base.branch } else { &landing.source.branch };
    let protected = branch::protected_branches(config.pointer("/git/protected_branches"));
    let policy = config.pointer("/git/on_protected").and_then(Value::as_str).unwrap_or("ask");
    // Ask is fulfilled by the exact owner authorization already required here.
    if branch::permission(&protected, policy, target)? == branch::Permission::Deny {
        return Err(Error::Policy(format!("protected branch {target} forbids this step")));
    }
    for branch in [&landing.source.branch, &landing.base.branch] {
        if !valid_ref(&format!("refs/heads/{branch}")) { return Err(Error::Invalid("invalid landing branch".into())); }
    }
    Ok(())
}

pub fn prepare(root: &Path, landing: &Landing, inputs: &ExternalInput, config: &Value, process: &mut dyn Process) -> Result<Invocation> {
    policy(landing, inputs, config)?;
    match inputs {
        ExternalInput::Push => Ok(Invocation { program: "git".into(), args: vec!["push".into(), "--porcelain".into(), "--".into(),
            landing.remote.url.clone(), format!("{}:refs/heads/{}", landing.source.head, landing.source.branch)] }),
        ExternalInput::TagPush { tag, head } => {
            let reference = format!("refs/tags/{tag}");
            if observe(root, &["rev-parse", "--verify", "--end-of-options", &reference], process)? != *head {
                return Err(Error::Invalid("tag object changed since authorization".into()));
            }
            Ok(Invocation { program: "git".into(), args: vec!["push".into(), "--porcelain".into(), "--".into(),
                landing.remote.url.clone(), format!("{head}:{reference}")] })
        }
        ExternalInput::Open { forge, .. } => {
            if !landing.steps.iter().any(|s| s.step == Step::Publish && s.receipt.is_some())
                || remote_head(root, landing, &format!("refs/heads/{}", landing.source.branch), process)?.as_deref() != Some(&landing.source.head) {
                return Err(Error::Invalid("opening requires the recorded push and its exact remote source head".into()));
            }
            super::forge::configured(forge, config)?;
            require_base(root, landing, process)?;
            super::forge::mutation(landing, inputs)
        }
        ExternalInput::Merge { forge, pr } => {
            let open = landing.steps.iter().find(|s| s.step == Step::Open).and_then(|s| s.receipt.as_ref())
                .ok_or_else(|| Error::Invalid("merge requires the recorded PR identity".into()))?;
            if open["result"]["number"].as_u64().or_else(|| open["result"]["iid"].as_u64()) != Some(*pr)
                || open["inputs"]["forge"] != serde_json::to_value(forge)? {
                return Err(Error::Invalid("merge identity differs from the recorded PR".into()));
            }
            super::forge::configured(forge, config)?;
            require_base(root, landing, process)?;
            super::forge::mutation(landing, inputs)
        }
    }
}

fn require_base(root: &Path, landing: &Landing, process: &mut dyn Process) -> Result<()> {
    if remote_head(root, landing, &format!("refs/heads/{}", landing.base.branch), process)?.as_deref() != Some(&landing.base.head) {
        return Err(Error::Invalid("remote base differs from the authorized base commit".into()));
    }
    Ok(())
}

pub fn perform(root: &Path, invocation: &Invocation, authorization: &Authorize, process: &mut dyn Process) -> Result<Value> {
    let output = run(root, invocation, process)?;
    match &authorization.inputs {
        ExternalInput::Push | ExternalInput::TagPush { .. } => Ok(json!({"output":output})),
        ExternalInput::Open { forge, .. } => {
            let result: Value = serde_json::from_str(&output)?;
            if result["number"].as_u64().or_else(|| result["iid"].as_u64()).is_none_or(|id| id == 0) {
                return Err(Error::Invalid("forge did not return a PR identity; reconciliation required".into()));
            }
            let (head, base) = if forge.provider == "gitlab" { (&result["sha"], &result["target_branch"]) }
                else { (&result["head"]["sha"], &result["base"]["ref"]) };
            if head != &authorization.source.head || base != &authorization.base.branch {
                return Err(Error::Invalid("created PR differs from the authorized source or base; reconciliation required".into()));
            }
            Ok(result)
        }
        ExternalInput::Merge { forge, .. } => {
            // Gitea's successful merge is HTTP 200 with an empty response body.
            if forge.provider == "forgejo" && output.trim().is_empty() { return Ok(json!({"merged":true})); }
            let result: Value = serde_json::from_str(&output)?;
            if result["merged"] != true && result["state"] != "merged" {
                return Err(Error::Invalid("forge did not confirm merge; reconciliation required".into()));
            }
            Ok(result)
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn landing_git_is_registered_and_gh_keeps_its_existing_bound() {
        for program in ["git", "gh"] {
            let invocation = super::Invocation { program: program.into(), args: vec!["status".into()] };
            let launch = super::invocation_launch(std::path::Path::new("/project"), &invocation);
            assert_eq!(launch.git_caller(), if program == "git" { Some(crate::git_process::Caller::LandingGit) } else { None });
            assert_eq!(launch.timeout, Some(std::time::Duration::from_secs(60)));
            assert!(launch.own_group);
            assert_eq!(launch.limit, 65_536);
            assert_eq!(launch.args, ["status"]);
            assert_eq!(launch.cwd.as_deref(), Some(std::path::Path::new("/project")));
        }
    }
}
