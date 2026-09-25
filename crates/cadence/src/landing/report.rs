//! Read-only Git and tracker observations; no tracker filing belongs here.
use crate::process::Process;
use super::{authorization, effects, forge, reconcile, model::{Forge, Landing, Publish}};
use crate::store::{Error, Result};
use serde_json::{Value, json};
use std::path::Path;

pub fn done(landing: &Landing) -> Vec<&Value> {
    landing.steps.iter().filter_map(|slot| slot.receipt.as_ref()).collect()
}

pub fn cleanup_action(landing: &Landing, snapshot_generation: u64) -> Option<Value> {
    landing.merge_confirmation.as_ref()?;
    let step = super::cleanup::ORDER.into_iter().find(|step| step.name() == reconcile::next_step(landing))?;
    let slot = landing.steps.iter().find(|slot| slot.step == step)?;
    let request = match &slot.local_intent {
        Some(intent) if intent.failure.is_none() => intent.request.clone(),
        _ => super::model::LocalRequest {
            request_id:crate::milestone::model::identity("landing-local", &landing.root_binding, &format!("{}:{}:{}:{snapshot_generation}", landing.id, step.name(), landing.generation)),
            landing:landing.id.clone(), expected_generation:landing.generation,
        },
    };
    Some(json!({"operation":step.operation(),"request":request}))
}

/// The snapshot generation changes after a retained refusal. A fresh read can
/// then offer a new observation request without changing an effect's identity.
pub fn resume(landing: &Landing, snapshot_generation: u64) -> Option<Value> {
    let step = landing.steps.iter().find(|slot| slot.step.name() == reconcile::next_step(landing))?;
    if step.receipt.is_some() { return None; }
    let auth = step.intent.as_ref().map(|intent| &intent.authorization).or_else(|| {
        landing.authorizations.iter().rev().find(|auth|
            auth.request.inputs.step() == step.step && auth.request.expected_generation == landing.generation)
    })?;
    let request = Publish {
        request_id: crate::milestone::model::identity("landing-resume", &landing.root_binding,
            &format!("{}:{}:{snapshot_generation}", landing.id, auth.id)),
        landing: landing.id.clone(), expected_generation: landing.generation,
        authorization: Some(auth.id.clone()), inputs: Some(auth.request.inputs.clone()),
    };
    authorization::matching(landing, &request, &step.step)?;
    Some(json!({"operation":"land-resume","request":request}))
}

pub fn git(root: &Path, landing: &Landing, process: &mut dyn Process) -> Result<Value> {
    let branch = effects::observe(root, &["symbolic-ref", "--quiet", "--short", "HEAD"], process)?;
    let head = effects::observe(root, &["rev-parse", "HEAD"], process)?;
    let dirty = !effects::observe(root, &["status", "--porcelain", "--untracked-files=normal"], process)?.is_empty();
    let url = effects::observe(root, &["remote", "get-url", "--all", &landing.remote.name], process)?;
    let push_url = effects::observe(root, &["remote", "get-url", "--push", "--all", &landing.remote.name], process)?;
    let source_head = effects::remote_head(root, landing, &format!("refs/heads/{}", landing.source.branch), process)?;
    let base_head = effects::remote_head(root, landing, &format!("refs/heads/{}", landing.base.branch), process)?;
    let comparison = source_head.as_ref().unwrap_or(&landing.base.head);
    let ahead = effects::observe(root, &["rev-list", "--count", &format!("{comparison}..{head}")], process)?
        .parse::<u64>().map_err(|_| Error::Invalid("invalid Git ahead count".into()))?;
    Ok(json!({"branch":branch,"head":head,"dirty":dirty,"ahead":ahead,"ahead_of":comparison,
        "remote":{"name":landing.remote.name,"url":url,"push_url":push_url,"source_head":source_head,"base_head":base_head}}))
}

pub fn tracker(root: &Path, config: &Value, process: &mut dyn Process) -> Value {
    let Some(provider) = config.pointer("/git/forge_provider").and_then(Value::as_str) else {
        return json!({"status":"unconfigured","read_only":true});
    };
    let repo = config.pointer("/git/forge_repo").and_then(Value::as_str).unwrap_or("");
    let host = config.pointer("/git/forge_host").and_then(Value::as_str).unwrap_or(match provider {
        "github" => "github.com", "gitlab" => "gitlab.com", _ => "",
    });
    let forge = Forge { provider: provider.into(), repo: repo.into(), host: host.into() };
    let result = forge::configured(&forge, config).and_then(|_| effects::run(root, &forge::tracker(&forge), process))
        .and_then(|output| serde_json::from_str::<Value>(&output).map_err(Into::into));
    match result {
        Ok(issues) if issues.is_array() => json!({"status":"ok","read_only":true,"forge":forge,"issues":issues,"bounded":true}),
        Ok(_) => json!({"status":"unavailable","read_only":true,"reason":"tracker response is not an issue list"}),
        Err(error) => json!({"status":"unavailable","read_only":true,"reason":error.to_string()}),
    }
}
