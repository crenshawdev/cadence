//! Owner-confirmed local effects. The service journals each intent before launch.
use crate::process::Process;
use super::{effects::{self, Invocation}, forge, model::{ConfirmMerge, Confirmation, Landing, LocalIntent, LocalRequest, Step}};
use crate::{envelope::Refusal, milestone::model, rail::branch, store::{Error, Result}};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::path::Path;

pub const ORDER: [Step; 4] = [Step::Checkout, Step::Pull, Step::Tag, Step::Reap];

/// A local cleanup failure carrying the wire code when a gate names one.
pub struct Failure {
    pub code: Option<&'static str>,
    pub error: Error,
}

impl From<Error> for Failure {
    fn from(error: Error) -> Self { Self { code:None, error } }
}

pub fn receipt<'a>(landing: &'a Landing, step: &Step) -> Option<&'a Value> {
    landing.steps.iter().find(|slot| slot.step == *step).and_then(|slot| slot.receipt.as_ref())
}

pub fn refuse(landing: &Landing, step: &Step, code: &str, reason: impl Into<String>) -> Value {
    Refusal::new(code, reason).slot("request").details(json!({"landing":landing.id,"step":step.name(),
        "source":landing.source,"base":landing.base})).value()
}

pub fn confirm(root: &Path, landing: &mut Landing, request: &ConfirmMerge, config: &Value, process: &mut dyn Process) -> Result<Value> {
    for value in [&request.request_id, &request.owner, &request.at] { model::name(value)?; }
    if request.landing != landing.id || request.expected_generation != landing.generation
        || request.source != landing.source || request.base != landing.base || request.remote != landing.remote {
        return Err(Error::Invalid("merge confirmation must echo the current landing version, source, base and remote".into()));
    }
    if landing.merge_confirmation.is_some() { return Err(Error::Invalid("landing already has an owner merge confirmation".into())); }
    let merge = receipt(landing, &Step::Merge).ok_or_else(|| Error::Invalid("merge confirmation requires a merge-effect receipt".into()))?;
    if merge["inputs"]["forge"] != serde_json::to_value(&request.merged.forge)? || merge["inputs"]["pr"] != request.merged.pr
        || request.merged.pr == 0 || !oid(&request.merged.commit) {
        return Err(Error::Invalid("merged PR/commit identity differs from the landing merge".into()));
    }
    validate_refs(landing)?;
    if let Some(release) = &landing.release
        && request.tag.as_ref().is_none_or(|tag| tag.name != release.tag) {
        return Err(Error::Invalid("merge confirmation must retain the confirmed release tag".into()));
    }
    if let Some(tag) = &request.tag {
        model::name(&tag.name)?;
        model::name(&tag.message)?;
        if tag.name.starts_with('-') || !effects::valid_ref(&format!("refs/tags/{}", tag.name)) {
            return Err(Error::Invalid("invalid annotated tag identity".into()));
        }
    }
    forge::configured(&request.merged.forge, config)?;
    let pull = forge::read_pull(root, landing, &request.merged.forge, Some(request.merged.pr), process)?
        .ok_or_else(|| Error::Invalid("confirmed PR is unavailable".into()))?;
    if forge::pull_state(root, landing, &request.merged.forge, &pull, process)? != "MERGED" {
        return Err(Error::Invalid("confirmed PR is not merged".into()));
    }
    // Forge variants can omit the merge hash; when supplied it must agree.
    for key in ["merge_commit_sha", "merge_commit_id"] {
        if let Some(commit) = pull[key].as_str() && commit != request.merged.commit {
            return Err(Error::Invalid("owner merge commit differs from the forge's merged commit".into()));
        }
    }
    if effects::remote_head(root, landing, &format!("refs/heads/{}", landing.base.branch), process)?.as_deref() != Some(&request.merged.commit) {
        return Err(Error::Invalid("confirmed merge commit differs from the recorded remote/base tip".into()));
    }
    let confirmation = Confirmation { id:model::identity("landing-merge-confirmation", &landing.root_binding, &request.request_id), request:request.clone() };
    landing.merge_confirmation = Some(confirmation.clone());
    landing.generation += 1;
    Ok(json!({"status":"ok","confirmation":confirmation,"landing":landing,"next_step":"checkout"}))
}

fn oid(value: &str) -> bool { matches!(value.len(), 40 | 64) && value.bytes().all(|b| b.is_ascii_hexdigit()) }

fn validate_refs(landing: &Landing) -> Result<()> {
    if landing.source.branch == landing.base.branch || [&landing.source.branch, &landing.base.branch].iter()
        .any(|name| name.starts_with('-') || !effects::valid_ref(&format!("refs/heads/{name}"))) {
        return Err(Error::Invalid("cleanup needs distinct valid source and base branches".into()));
    }
    Ok(())
}

pub fn gate(landing: &Landing, request: &LocalRequest, step: &Step) -> Option<Value> {
    if landing.merge_confirmation.is_none() {
        return Some(refuse(landing, step, "landing-merge-confirmation-required", "the owner's merge confirmation is required before local cleanup"));
    }
    if request.expected_generation != landing.generation {
        return Some(refuse(landing, step, "landing-generation", "local cleanup requires the current landing generation"));
    }
    for predecessor in ORDER.iter().take_while(|s| *s != step) {
        if receipt(landing, predecessor).is_none_or(|r| r["state"] != "done" && r["state"] != "skipped") {
            let mut value = refuse(landing, step, "landing-predecessor-required", format!("missing {} done or explicit-skip receipt", predecessor.name()));
            value["details"]["predecessor"] = json!(predecessor.name());
            return Some(value);
        }
    }
    if receipt(landing, step).is_some() {
        return Some(refuse(landing, step, "landing-step-complete", "step already has a receipt; replay its original request"));
    }
    None
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct State {
    pub branch: String,
    pub head: String,
    pub source: Option<String>,
    pub base: String,
    pub index: String,
    pub worktree: String,
    pub tag: Option<String>,
    pub tag_target: Option<String>,
    pub tag_message: Option<String>,
}

fn reference(root: &Path, name: &str, process: &mut dyn Process) -> Result<Option<String>> {
    let output = effects::observe(root, &["for-each-ref", "--format=%(refname) %(objectname)", "--", name], process)?;
    for line in output.lines() {
        let (reference, sha) = line.split_once(' ').ok_or_else(|| Error::Invalid("invalid local ref observation".into()))?;
        if reference == name {
            if !oid(sha) { return Err(Error::Invalid("invalid local ref object".into())); }
            return Ok(Some(sha.into()));
        }
    }
    Ok(None)
}

pub fn observe(root: &Path, landing: &Landing, process: &mut dyn Process) -> Result<State> {
    validate_refs(landing)?;
    let mut state = State {
        branch:effects::observe(root, &["symbolic-ref", "--quiet", "--short", "HEAD"], process)?,
        head:effects::observe(root, &["rev-parse", "--verify", "HEAD^{commit}"], process)?,
        source:reference(root, &format!("refs/heads/{}", landing.source.branch), process)?,
        base:reference(root, &format!("refs/heads/{}", landing.base.branch), process)?.ok_or_else(|| Error::Invalid("local base branch is missing".into()))?,
        index:effects::observe(root, &["diff", "--cached", "--raw", "--no-ext-diff"], process)?,
        worktree:effects::observe(root, &["status", "--porcelain", "--untracked-files=normal"], process)?,
        tag:None, tag_target:None, tag_message:None,
    };
    if let Some(tag) = landing.merge_confirmation.as_ref().and_then(|c| c.request.tag.as_ref()) {
        let name = format!("refs/tags/{}", tag.name);
        state.tag = reference(root, &name, process)?;
        if let Some(object) = &state.tag
            && effects::observe(root, &["cat-file", "-t", object], process)? == "tag" {
            state.tag_target = Some(effects::observe(root, &["rev-parse", "--verify", &format!("{object}^{{commit}}")], process)?);
            let annotation = effects::observe(root, &["cat-file", "-p", object], process)?;
            state.tag_message = annotation.split_once("\n\n").map(|(_, message)| message.into());
        }
    }
    Ok(state)
}

fn clean(state: &State) -> Result<()> {
    if !state.index.is_empty() || !state.worktree.is_empty() {
        return Err(Error::Invalid("local cleanup requires a clean index and worktree".into()));
    }
    Ok(())
}

pub fn remote_matches(root: &Path, landing: &Landing, process: &mut dyn Process) -> Result<()> {
    for args in [vec!["remote", "get-url", "--all", &landing.remote.name], vec!["remote", "get-url", "--push", "--all", &landing.remote.name]] {
        if effects::observe(root, &args, process)? != landing.remote.url { return Err(Error::Invalid("recorded remote URL changed".into())); }
    }
    Ok(())
}

pub fn tag_push_matches(root: &Path, landing: &Landing, inputs: &super::model::ExternalInput, process: &mut dyn Process) -> Result<bool> {
    remote_matches(root, landing, process)?;
    let super::model::ExternalInput::TagPush { tag, head } = inputs else { return Ok(false); };
    let Some(saved) = receipt(landing, &Step::Tag) else { return Ok(false); };
    let confirmation = landing.merge_confirmation.as_ref().unwrap();
    Ok(saved["state"] == "done" && saved["confirmation"] == confirmation.id
        && confirmation.request.tag.as_ref().is_some_and(|selected| selected.name == *tag)
        && saved["actual"]["tag"] == *head
        && reference(root, &format!("refs/tags/{tag}"), process)?.as_deref() == Some(head))
}

pub fn skipped(landing: &Landing, step: &Step) -> bool {
    landing.merge_confirmation.as_ref().is_some_and(|c| match step {
        Step::Tag => c.request.tag.is_none(), Step::Reap => !c.request.reap, _ => false,
    })
}

pub fn prepare(root: &Path, landing: &Landing, request: &LocalRequest, step: &Step, config: &Value, process: &mut dyn Process) -> std::result::Result<LocalIntent, Failure> {
    let confirmation = landing.merge_confirmation.as_ref().ok_or_else(|| Error::Invalid("merge confirmation missing".into()))?;
    remote_matches(root, landing, process)?;
    let before = observe(root, landing, process)?;
    clean(&before)?;
    let mut intended = before.clone();
    if before.source.as_deref() != Some(&landing.source.head) { return Err(Error::Invalid("recorded source branch changed or disappeared".into()).into()); }
    let merged = &confirmation.request.merged.commit;
    let args = match step {
        Step::Checkout => {
            if before.branch != landing.source.branch || before.head != landing.source.head || before.base != landing.base.head {
                return Err(Error::Invalid("checkout source or local base differs from the recorded identity".into()).into());
            }
            intended.branch = landing.base.branch.clone(); intended.head = before.base.clone();
            vec!["checkout".into(), "--no-guess".into(), landing.base.branch.clone(), "--".into()]
        }
        Step::Pull => {
            if before.branch != landing.base.branch || before.head != landing.base.head || before.base != landing.base.head {
                return Err(Error::Invalid("pull requires the recorded checked-out base".into()).into());
            }
            if effects::remote_head(root, landing, &format!("refs/heads/{}", landing.base.branch), process)?.as_deref() != Some(merged) {
                return Err(Error::Invalid("remote/base moved since owner merge confirmation".into()).into());
            }
            intended.head = merged.clone(); intended.base = merged.clone();
            vec!["pull".into(), "--ff-only".into(), "--no-rebase".into(), "--no-autostash".into(), "--".into(), landing.remote.url.clone(), landing.base.branch.clone()]
        }
        Step::Tag => {
            require_pulled(landing, &before)?;
            let tag = confirmation.request.tag.as_ref().ok_or_else(|| Error::Invalid("tag selection is an explicit skip".into()))?;
            effects::observe(root, &["check-ref-format", &format!("refs/tags/{}", tag.name)], process)?;
            if before.tag.is_some() { return Err(Error::Invalid(format!("tag {} already exists", tag.name)).into()); }
            if let Some(release) = &landing.release { crate::milestone::release::validate_tag(root, release, &tag.name, process)?; }
            intended.tag_target = Some(merged.clone()); intended.tag_message = Some(tag.message.trim_end().into());
            vec!["tag".into(), "-a".into(), "--cleanup=verbatim".into(), "-m".into(), tag.message.clone(), "--".into(), tag.name.clone(), merged.clone()]
        }
        Step::Reap => {
            reap_gate(root, landing, &before, config, process)?;
            require_pulled(landing, &before)?;
            intended.source = None;
            vec!["branch".into(), "-d".into(), "--".into(), landing.source.branch.clone()]
        }
        _ => return Err(Error::Invalid("not a local cleanup step".into()).into()),
    };
    Ok(LocalIntent { request:request.clone(), step:step.clone(), confirmation:confirmation.id.clone(),
        invocation:Invocation { program:"git".into(), args }, before, intended, actual:None, failure:None })
}

fn require_pulled(landing: &Landing, state: &State) -> Result<()> {
    let pull = receipt(landing, &Step::Pull).ok_or_else(|| Error::Invalid("pull receipt missing".into()))?;
    if state.branch != landing.base.branch || state.head != state.base || pull["actual"]["base"] != state.base {
        return Err(Error::Invalid("current base differs from the pulled base identity".into()));
    }
    Ok(())
}

pub fn reap_gate(root: &Path, landing: &Landing, state: &State, config: &Value, process: &mut dyn Process) -> std::result::Result<(), Failure> {
    if branch::protected_branches(config.pointer("/git/protected_branches")).contains(&landing.source.branch) {
        return Err(Failure { code:Some("landing-reap-protected"),
            error:Error::Policy(format!("protected source branch {} cannot be reaped", landing.source.branch)) });
    }
    if state.branch == landing.source.branch {
        return Err(Failure { code:Some("landing-reap-checked-out"), error:Error::Invalid("source branch is currently checked out".into()) });
    }
    if state.source.as_deref() != Some(&landing.source.head) {
        return Err(Failure { code:Some("landing-reap-moved"), error:Error::Invalid("source tip changed incompatibly".into()) });
    }
    // This subprocess interrogates real Git ancestry immediately before deletion.
    effects::observe(root, &["merge-base", "--is-ancestor", state.source.as_deref().unwrap(), &state.base], process)
        .map_err(|error| Failure { code:Some("landing-reap-uncontained"), error })?;
    Ok(())
}

pub fn present(intent: &LocalIntent, actual: &State) -> bool {
    let mut expected = intent.intended.clone();
    if intent.step == Step::Tag {
        if actual.tag.is_none() { return false; }
        expected.tag = actual.tag.clone();
    }
    actual == &expected
}

pub fn retry(root: &Path, landing: &Landing, intent: &LocalIntent, config: &Value, process: &mut dyn Process) -> std::result::Result<(State, bool), Failure> {
    remote_matches(root, landing, process)?;
    let actual = observe(root, landing, process)?;
    clean(&actual)?;
    if present(intent, &actual) { return Ok((actual, true)); }
    if actual != intent.before { return Err(Error::Invalid("local refs, index or branch differ from the retained cleanup intent".into()).into()); }
    let prepared = prepare(root, landing, &intent.request, &intent.step, config, process)?;
    if prepared.invocation != intent.invocation || prepared.intended != intent.intended {
        return Err(Error::Invalid("cleanup retry differs from its retained intent".into()).into());
    }
    Ok((actual, false))
}

pub fn complete(landing: &mut Landing, step: &Step, intended: &State, actual: &State, provenance: &str) -> Value {
    let predecessors: Vec<_> = ORDER.iter().take_while(|s| *s != step).filter_map(|s| receipt(landing, s).map(|r| r["id"].clone())).collect();
    let receipt = json!({"id":model::identity("landing-step-receipt", &landing.root_binding, &format!("{}:{}", landing.id, step.name())),
        "landing":landing.id,"generation":landing.generation,"step":step.name(),
        "confirmation":landing.merge_confirmation.as_ref().unwrap().id,"predecessors":predecessors,
        "state":if skipped(landing, step) { "skipped" } else { "done" },
        "source":landing.source,"base":landing.base,"remote":landing.remote,
        "intended":intended,"actual":actual,"provenance":{"kind":provenance}});
    landing.steps.iter_mut().find(|slot| slot.step == *step).unwrap().receipt = Some(receipt.clone());
    landing.generation += 1;
    json!({"status":"ok","landing":landing,"receipt":receipt,"done":super::report::done(landing),"next_step":super::reconcile::next_step(landing)})
}

pub fn failure(root: &Path, landing: &Landing, step: &Step, error: &Error, process: &mut dyn Process) -> Value {
    failure_body(root, landing, step, "landing-cleanup-discrepancy", error, process)
}

pub fn refused(root: &Path, landing: &Landing, step: &Step, failure: &Failure, process: &mut dyn Process) -> Value {
    failure_body(root, landing, step, failure.code.unwrap_or("landing-cleanup-discrepancy"), &failure.error, process)
}

fn failure_body(root: &Path, landing: &Landing, step: &Step, code: &str, error: &Error, process: &mut dyn Process) -> Value {
    let state = observe(root, landing, process).ok();
    let source = json!({"branch":landing.source.branch,"head":state.as_ref().and_then(|s| s.source.as_ref())});
    let base = json!({"branch":landing.base.branch,"head":state.as_ref().map(|s| &s.base)});
    Refusal::new(code,
        format!("{} refused for source {} and base {}: {error}", step.name(), source, base)).slot("request")
        .details(json!({"landing":landing.id,"step":step.name(),"source":source,"base":base})).value()
}
