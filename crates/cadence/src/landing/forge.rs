//! Explicit API endpoints keep forge effects limited to the authorized step.
use crate::process::Process;
use super::{effects::Invocation, model::{ExternalInput, Forge, Landing}};
use crate::store::{Error, Result};
use serde_json::Value;
use std::path::Path;

pub fn validate(forge: &Forge) -> Result<()> {
    let safe = |part: &str| !part.is_empty() && part != "." && part != ".." && !part.starts_with('-')
        && part.bytes().all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b));
    if !matches!(forge.provider.as_str(), "github" | "gitlab" | "forgejo")
        || forge.repo.len() > 200 || forge.repo.split('/').count() < 2 || !forge.repo.split('/').all(safe)
        || forge.host.len() > 253 || !forge.host.split(':').all(|part| part.split('.').all(safe)) {
        return Err(Error::Invalid("forge requires a supported provider, explicit repository and host".into()));
    }
    Ok(())
}

pub fn configured(forge: &Forge, config: &Value) -> Result<()> {
    validate(forge)?;
    let host = config.pointer("/git/forge_host").and_then(Value::as_str).unwrap_or(match forge.provider.as_str() {
        "github" => "github.com", "gitlab" => "gitlab.com", _ => "",
    });
    if config.pointer("/git/forge_provider").and_then(Value::as_str) != Some(&forge.provider)
        || config.pointer("/git/forge_repo").and_then(Value::as_str) != Some(&forge.repo) || host != forge.host {
        return Err(Error::Invalid("authorized forge differs from effective configuration".into()));
    }
    Ok(())
}

fn api(forge: &Forge, method: &str, endpoint: String, fields: Vec<(&str, String)>) -> Invocation {
    let tea = forge.provider == "forgejo";
    let program = match forge.provider.as_str() { "github" => "gh", "gitlab" => "glab", _ => "tea" };
    let mut args = vec!["api".into(), "--method".into(), method.into()];
    args.extend([if tea { "--login" } else { "--hostname" }.into(), forge.host.clone()]);
    for (key, value) in fields {
        let flag = if tea || key == "should_remove_source_branch" { "--field" } else { "--raw-field" };
        args.extend([flag.into(), format!("{key}={value}")]);
    }
    args.push(endpoint);
    Invocation { program: program.into(), args }
}

pub fn mutation(landing: &Landing, inputs: &ExternalInput) -> Result<Invocation> {
    match inputs {
        ExternalInput::Open { forge, title, body } => {
            let (endpoint, fields) = if forge.provider == "gitlab" {
                (format!("projects/{}/merge_requests", forge.repo.replace('/', "%2F")), vec![
                    ("source_branch", landing.source.branch.clone()), ("target_branch", landing.base.branch.clone()),
                    ("title", title.clone()), ("description", body.clone())])
            } else {
                (format!("repos/{}/pulls", forge.repo), vec![("head", landing.source.branch.clone()),
                    ("base", landing.base.branch.clone()), ("title", title.clone()), ("body", body.clone())])
            };
            Ok(api(forge, "POST", endpoint, fields))
        }
        ExternalInput::Merge { forge, pr } => {
            let (method, endpoint, fields) = match forge.provider.as_str() {
                "gitlab" => ("PUT", format!("projects/{}/merge_requests/{pr}/merge", forge.repo.replace('/', "%2F")),
                    vec![("sha", landing.source.head.clone()), ("should_remove_source_branch", "false".into())]),
                "forgejo" => ("POST", format!("repos/{}/pulls/{pr}/merge", forge.repo),
                    vec![("Do", "merge".into()), ("head_commit_id", landing.source.head.clone())]),
                _ => ("PUT", format!("repos/{}/pulls/{pr}/merge", forge.repo),
                    vec![("sha", landing.source.head.clone()), ("merge_method", "merge".into())]),
            };
            Ok(api(forge, method, endpoint, fields))
        }
        _ => Err(Error::Invalid("step is not a forge mutation".into())),
    }
}

pub fn tracker(forge: &Forge) -> Invocation {
    let endpoint = if forge.provider == "gitlab" {
        format!("projects/{}/issues?state=opened&per_page=100", forge.repo.replace('/', "%2F"))
    } else { format!("repos/{}/issues?state=open&limit=100", forge.repo) };
    api(forge, "GET", endpoint, vec![])
}

fn parameter(value: &str) -> String {
    value.bytes().map(|b| if b.is_ascii_alphanumeric() || b"-._~".contains(&b) {
        (b as char).to_string()
    } else { format!("%{b:02X}") }).collect()
}

fn pulls(forge: &Forge) -> String {
    if forge.provider == "gitlab" { format!("projects/{}/merge_requests", parameter(&forge.repo)) }
    else { format!("repos/{}/pulls", forge.repo) }
}

fn get(root: &Path, forge: &Forge, endpoint: String, process: &mut dyn Process) -> Result<Value> {
    serde_json::from_str(&super::effects::run(root, &api(forge, "GET", endpoint, vec![]), process)?).map_err(Into::into)
}

pub fn number(forge: &Forge, value: &Value) -> Result<u64> {
    let key = if forge.provider == "gitlab" { "iid" } else { "number" };
    value[key].as_u64().filter(|n| *n > 0).ok_or_else(|| Error::Invalid(format!("remote PR has invalid {key}: {}", value[key])))
}

/// Discover across all states: a closed or moved PR is a discrepancy, not absence.
pub fn read_pull(root: &Path, landing: &Landing, forge: &Forge, identity: Option<u64>, process: &mut dyn Process) -> Result<Option<Value>> {
    let endpoint = pulls(forge);
    let identity = if let Some(identity) = identity { identity } else {
        let filter = match forge.provider.as_str() {
            "github" => format!("&head={}", parameter(&format!("{}:{}", forge.repo.split('/').next().unwrap(), landing.source.branch))),
            "gitlab" => format!("&source_branch={}", parameter(&landing.source.branch)),
            // Gitea has no head filter. Inspect every returned head locally.
            _ => String::new(),
        };
        let limit = if forge.provider == "forgejo" { "limit" } else { "per_page" };
        let mut candidates = Vec::new();
        let mut complete = false;
        for page in 1..=10 {
            let values = get(root, forge, format!("{endpoint}?state=all&{limit}=100&page={page}{filter}"), process)?;
            let values = values.as_array().ok_or_else(|| Error::Invalid("remote PR list is not an array".into()))?;
            for value in values {
                if forge.provider == "forgejo" {
                    let head = value["head"]["ref"].as_str().ok_or_else(|| Error::Invalid("remote PR list has no head ref".into()))?;
                    if head != landing.source.branch { continue; }
                }
                candidates.push(number(forge, value)?);
            }
            // Gitea may cap limit below the requested size. Only an empty
            // page proves completion there; never infer absence from its cap.
            if values.is_empty() || (forge.provider != "forgejo" && values.len() < 100) {
                complete = true;
                break;
            }
        }
        if !complete || candidates.len() > 1 {
            return Err(Error::Invalid(format!("ambiguous remote PR list; complete={complete}, identities={candidates:?}")));
        }
        let Some(identity) = candidates.first() else { return Ok(None); };
        *identity
    };
    let value = get(root, forge, format!("{endpoint}/{identity}"), process)?;
    if number(forge, &value)? != identity {
        return Err(Error::Invalid(format!("remote PR identity differs from {identity}: {value}")));
    }
    Ok(Some(value))
}

pub fn pull_state(root: &Path, landing: &Landing, forge: &Forge, value: &Value, process: &mut dyn Process) -> Result<&'static str> {
    let matches = if forge.provider == "gitlab" {
        let project = get(root, forge, format!("projects/{}", parameter(&forge.repo)), process)?;
        project["path_with_namespace"] == forge.repo && project["id"].as_u64().is_some_and(|id| id > 0)
            && value["source_project_id"] == project["id"] && value["target_project_id"] == project["id"]
            && value["source_branch"] == landing.source.branch && value["sha"] == landing.source.head
            && value["target_branch"] == landing.base.branch
    } else {
        value["head"]["repo"]["full_name"] == forge.repo && value["base"]["repo"]["full_name"] == forge.repo
            && value["head"]["ref"] == landing.source.branch && value["head"]["sha"] == landing.source.head
            && value["base"]["ref"] == landing.base.branch && value["base"]["sha"] == landing.base.head
    };
    if !matches {
        return Err(Error::Invalid(format!("remote PR repository/head/base mismatch; expected repo {}, source {:?}, base {:?}; observed {value}",
            forge.repo, landing.source, landing.base)));
    }
    match (forge.provider.as_str(), value["state"].as_str(), value["merged"].as_bool()) {
        ("gitlab", Some("merged"), _) | (_, Some("closed"), Some(true)) => Ok("MERGED"),
        ("gitlab", Some("opened"), _) | (_, Some("open"), Some(false)) => Ok("OPEN"),
        _ => Err(Error::Invalid(format!("remote PR state is unknown or closed-unmerged: {value}"))),
    }
}
