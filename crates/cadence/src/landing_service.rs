use cadence::process::Process;
use crate::{config::reload::ConfigIo, import::SessionFactory};
use cadence::{envelope::Refusal, landing::{authorization, cleanup, effects, reconcile, report, model::{Apply, Authorization, Intent, Landing, LocalRequest, Publish, Step}},
    milestone::model::{self, Receipt, Records}, store::{Error, Result, transaction::Transaction, writer::{Operation, Store, View}}};
use serde_json::{Value, json};
use std::path::Path;

pub enum Command { Read { landing: String }, Apply(Box<Apply>) }

pub async fn execute<I: ConfigIo + Clone + Sync>(factory: &SessionFactory<I>, root: &Path, command: Command, process: &mut (dyn Process + Send)) -> Result<Value> {
    match execute_inner(factory, root, command, process).await {
        Ok(answer) => Ok(answer),
        Err(error) => Ok(model::refuse("landing-unavailable", error.to_string())),
    }
}

async fn execute_inner<I: ConfigIo + Clone + Sync>(factory: &SessionFactory<I>, root: &Path, command: Command, process: &mut (dyn Process + Send)) -> Result<Value> {
    let session = factory.first_touch(root).await?;
    let store = session.review_store();
    let mut view = session.derivation_view().await?;
    let binding = cadence::verification::inputs::root_binding(root)?;
    let project = root.parent().ok_or_else(|| Error::Invalid("planning root lacks project".into()))?;
    let mut records = model::records::<Landing>(&view.snapshot.data, "landings")?;
    for (id, landing) in &records.records {
        if landing.id != *id || landing.root_binding != binding || landing.id != model::identity("landing", &binding, &landing.occurrence) {
            return Err(Error::Invalid("landing record root or identity mismatch".into()));
        }
    }
    let apply = match command {
        Command::Read { landing } => return Ok(match records.records.get(&landing) {
            None => model::refuse("landing-unknown", landing),
            Some(record) => {
                let config = session.config()?;
                let git = match report::git(project, record, process) { Ok(value) => value,
                    Err(error) => json!({"status":"unavailable","reason":error.to_string()}) };
                let actions: Vec<_> = record.authorizations.iter().filter(|a| a.request.expected_generation == record.generation)
                    .filter(|a| record.steps.iter().any(|s| s.step == a.request.inputs.step() && s.receipt.is_none() && s.intent.is_none()))
                    .map(|a| action(record, a)).collect();
                json!({"status":"ok","read_only":true,"landing":record,"git":git,
                    "done":report::done(record),"next_step":reconcile::next_step(record),
                    "resume":report::resume(record, view.snapshot.generation),
                    "cleanup":report::cleanup_action(record, view.snapshot.generation),
                    "tracker":report::tracker(project, &config.effective.values, process),"actions":actions,
                    "unsettled":cadence::review::consumers::unruled_members(store).await?,
                    "refusals":records.receipts.values().filter(|r| r.answer["status"] == "refused"
                        && r.request["request"]["landing"] == landing).collect::<Vec<_>>()})
            }
        }),
        Command::Apply(apply) => *apply,
    };
    let raw = serde_json::to_value(&apply)?;
    let request_id = match &apply {
        Apply::Start { request } => &request.request_id,
        Apply::Authorize { request } => &request.request_id,
        Apply::ConfirmMerge { request } => &request.request_id,
        Apply::Checkout { request } | Apply::Pull { request } | Apply::Tag { request } | Apply::Reap { request } => &request.request_id,
        Apply::Publish { request } | Apply::Open { request } | Apply::Merge { request } | Apply::TagPush { request } | Apply::Resume { request } => &request.request_id,
    };
    if let Some(answer) = model::replay(&records, &binding, request_id, &raw)? { return Ok(answer); }
    let intent_reused = records.records.values().flat_map(|l| &l.steps).filter_map(|s| s.intent.as_ref())
        .any(|i| i.request.request_id == *request_id && (serde_json::to_value(&i.request).ok().as_ref() != raw.get("request")
            || i.operation.as_deref().unwrap_or(i.authorization.request.inputs.step().operation()) != raw["operation"]));
    let local_reused = records.records.values().flat_map(|l| &l.steps).filter_map(|s| s.local_intent.as_ref())
        .any(|i| i.request.request_id == *request_id && (serde_json::to_value(&i.request).ok().as_ref() != raw.get("request")
            || i.step.operation() != raw["operation"]));
    let answer = if model::reused(&records, &binding, request_id) || intent_reused || local_reused {
        model::refuse("request-reused", "request_id already binds different landing inputs")
    } else if model::name(request_id).is_err() {
        model::refuse("invalid-arguments", "request_id must be nonblank bounded text")
    } else { match &apply {
        Apply::Start { request } => {
            let valid = [&request.occurrence, &request.source.branch, &request.base.branch, &request.remote.name, &request.remote.url]
                .iter().all(|s| model::name(s).is_ok() && !s.starts_with('-'))
                && [&request.source.head, &request.base.head].iter().all(|h| matches!(h.len(), 40 | 64) && h.bytes().all(|b| b.is_ascii_hexdigit()));
            let candidate = Landing::new(binding.clone(), request);
            let prior = records.records.get(&candidate.id);
            let generation = prior.map_or(0, |p| p.generation);
            if !valid { model::refuse("invalid-arguments", "landing requires named branches and remote, and exact source/base commit hashes") }
            else if request.expected_generation != generation {
                Refusal::new("landing-generation", "expected generation does not match the current landing generation")
                    .details(json!({"generation":generation,"expected_generation":request.expected_generation})).value()
            } else if let Some(prior) = prior {
                if prior.source != request.source || prior.base != request.base || prior.remote != request.remote {
                    model::refuse("landing-inputs", "landing source, base and remote are immutable")
                } else { json!({"status":"ok","landing":prior}) }
            } else {
                records.records.insert(candidate.id.clone(), candidate.clone());
                json!({"status":"ok","landing":candidate})
            }
        }
        Apply::Authorize { request } => match records.records.get_mut(&request.landing) {
            None => authorization::refuse("landing-unknown", "landing does not exist", &request.landing, &request.inputs.step()),
            Some(landing) => match authorization::validate(request, landing) {
                Err(error) => authorization::refuse("landing-authorization-inputs", error.to_string(), &landing.id, &request.inputs.step()),
                Ok(()) => {
                    let authorization = Authorization { id: model::identity("landing-authorization", &binding, &request.request_id), request: request.clone() };
                    landing.authorizations.push(authorization.clone());
                    json!({"status":"ok","authorization":authorization,"landing":landing,"action":action(landing, &authorization)})
                }
            },
        },
        Apply::ConfirmMerge { request } => match records.records.get_mut(&request.landing) {
            None => model::refuse("landing-unknown", &request.landing),
            Some(landing) => {
                let config = session.config()?;
                match cleanup::confirm(project, landing, request, &config.effective.values, process) {
                    Ok(answer) => answer,
                    Err(error) => model::refuse("landing-confirmation-inputs", error.to_string()),
                }
            }
        },
        Apply::Checkout { request } | Apply::Pull { request } | Apply::Tag { request } | Apply::Reap { request } => {
            let step = match &apply { Apply::Checkout { .. } => Step::Checkout, Apply::Pull { .. } => Step::Pull,
                Apply::Tag { .. } => Step::Tag, _ => Step::Reap };
            let config = session.config()?;
            local_effect(store, &mut view, &mut records, project, request, &step, &config.effective.values, process).await?
        }
        Apply::Publish { request } | Apply::Open { request } | Apply::Merge { request } | Apply::TagPush { request } | Apply::Resume { request } => {
            let step = match &apply { Apply::Publish { .. } => Step::Publish, Apply::Open { .. } => Step::Open,
                Apply::Merge { .. } => Step::Merge, Apply::Resume { .. } => request.inputs.as_ref().map(|i| i.step()).unwrap_or(Step::Publish),
                _ => Step::TagPush };
            // No Git or forge observation happens before this all-home gate.
            let unsettled = cadence::review::consumers::unruled_members(store).await?;
            if !unsettled.is_empty() {
                let mut refusal = authorization::refuse("landing-unsettled", "unruled deferred members forbid external steps", &request.landing, &step);
                refusal["details"]["unsettled"] = json!(unsettled);
                refusal["unsettled"] = refusal["details"]["unsettled"].clone();
                refusal
            } else {
                let config = session.config()?;
                effect(store, &mut view, &mut records, project,
                    StepRequest { request, step: &step, resume: matches!(&apply, Apply::Resume { .. }) }, &config.effective.values,
                    process,).await?
            }
        }
    }};
    let receipt = Receipt { root_binding: binding, request_id: request_id.clone(), request: raw, answer };
    model::persist(store, &view, "landings", &mut records, receipt).await
}

fn action(landing: &Landing, authorization: &Authorization) -> Value {
    json!({"operation":authorization.request.inputs.step().operation(),"request":{
        "request_id":model::identity("landing-step", &landing.root_binding, &authorization.id),
        "landing":landing.id,"expected_generation":landing.generation,"authorization":authorization.id,"inputs":authorization.request.inputs}})
}

async fn persist_intent(store: &Store, view: &View, records: &Records<Landing>, landing: &str, request_id: &str) -> Result<View> {
    let mut data = view.snapshot.data.clone();
    data["landings"] = serde_json::to_value(records)?;
    store.request(Operation::CompareTransact { expected_generation:view.snapshot.generation, expected_integrity:view.snapshot.integrity.clone(),
        transaction:Transaction { id:format!("landing-intent:{landing}:{request_id}"),
            items:vec![], decisions:vec![], snapshot:Some(data), external:vec![] } }).await?;
    store.request(Operation::ReadVerified).await
}

struct StepRequest<'a> { request: &'a Publish, step: &'a Step, resume: bool }

/// An integration-test caller can kill the real writer after a named effect.
/// Release builds ignore the variable.
fn exit_after_effect(step: &Step) { if cfg!(debug_assertions) && std::env::var("CADENCE_LANDING_EXIT_AFTER_EFFECT").ok().as_deref() == Some(step.name()) { std::process::exit(86); } }

#[allow(clippy::too_many_arguments)]
async fn local_effect(store: &Store, view: &mut View, records: &mut Records<Landing>, project: &Path,
    request: &LocalRequest, step: &Step, config: &Value,
    process: &mut (dyn Process + Send),) -> Result<Value> {
    let Some(landing) = records.records.get(&request.landing) else { return Ok(model::refuse("landing-unknown", &request.landing)); };
    if let Some(refusal) = cleanup::gate(landing, request, step) { return Ok(refusal); }
    let slot = landing.steps.iter().position(|slot| slot.step == *step).unwrap();
    if cleanup::skipped(landing, step) {
        let state = match cleanup::observe(project, landing, process) {
            Ok(state) => state, Err(error) => return Ok(cleanup::failure(project, landing, step, &error, process)),
        };
        return Ok(cleanup::complete(records.records.get_mut(&request.landing).unwrap(), step, &state, &state, "explicit-skip"));
    }
    let intent = if let Some(intent) = &landing.steps[slot].local_intent {
        if intent.request != *request && (intent.failure.is_none() || intent.request.landing != request.landing
            || intent.request.expected_generation != request.expected_generation) {
            return Ok(cleanup::refuse(landing, step, "landing-cleanup-intent", "retry the exact retained local request"));
        }
        match cleanup::retry(project, landing, intent, config, process) {
            Ok((actual, true)) => {
                let intended = intent.intended.clone();
                records.records.get_mut(&request.landing).unwrap().steps[slot].local_intent.as_mut().unwrap().actual = Some(actual.clone());
                return Ok(cleanup::complete(records.records.get_mut(&request.landing).unwrap(), step, &intended, &actual, "reconciled"));
            }
            Ok((_, false)) => intent.clone(),
            Err(failure) => return Ok(cleanup::refused(project, landing, step, &failure, process)),
        }
    } else {
        match cleanup::prepare(project, landing, request, step, config, process) {
            Ok(intent) => intent, Err(failure) => return Ok(cleanup::refused(project, landing, step, &failure, process)),
        }
    };
    records.records.get_mut(&request.landing).unwrap().steps[slot].local_intent = Some(intent.clone());
    *view = persist_intent(store, view, records, &request.landing, &request.request_id).await?;
    let landing = records.records.get_mut(&request.landing).unwrap();
    // Re-observe after journaling: a changed branch/index cannot ride the intent.
    let before = cleanup::observe(project, landing, process)?;
    if before != intent.before { return Ok(cleanup::failure(project, landing, step, &Error::Invalid("local state changed before invocation".into()), process)); }
    if *step == Step::Reap && let Err(failure) = cleanup::reap_gate(project, landing, &before, config, process) {
        return Ok(cleanup::refused(project, landing, step, &failure, process));
    }
    if let Err(error) = effects::run(project, &intent.invocation, process) {
        landing.steps[slot].local_intent.as_mut().unwrap().failure = Some(error.to_string());
        landing.steps[slot].local_intent.as_mut().unwrap().actual = cleanup::observe(project, landing, process).ok();
        return Ok(cleanup::failure(project, landing, step, &error, process));
    }
    exit_after_effect(step);
    let actual = cleanup::observe(project, landing, process)?;
    landing.steps[slot].local_intent.as_mut().unwrap().actual = Some(actual.clone());
    if !cleanup::present(&intent, &actual) {
        let error = Error::Invalid("actual local effect differs from intended refs".into());
        landing.steps[slot].local_intent.as_mut().unwrap().failure = Some(error.to_string());
        return Ok(cleanup::failure(project, landing, step, &error, process));
    }
    Ok(cleanup::complete(landing, step, &intent.intended, &actual, "executed"))
}

async fn effect(store: &Store, view: &mut View, records: &mut Records<Landing>, project: &Path,
    input: StepRequest<'_>, config: &Value,
    process: &mut (dyn Process + Send),) -> Result<Value> {
    let StepRequest { request, step, resume } = input;
    let refuse = |code, reason| authorization::refuse(code, reason, &request.landing, step);
    let Some(landing) = records.records.get(&request.landing) else {
        return Ok(refuse("landing-unknown", "landing does not exist".to_owned()));
    };
    let slot = landing.steps.iter().position(|s| s.step == *step).ok_or_else(|| Error::Invalid("landing step missing".into()))?;
    // A completed step keeps its original grant, even though completion advanced
    // the landing generation. This path can only return that existing receipt.
    if resume && let Some(receipt) = &landing.steps[slot].receipt {
        let mut original = landing.clone();
        original.generation = receipt["generation"].as_u64().ok_or_else(|| Error::Invalid("step receipt generation missing".into()))?;
        let mut bound = request.clone();
        bound.expected_generation = original.generation;
        if request.expected_generation != landing.generation
            || authorization::matching(&original, &bound, step).is_none_or(|a| receipt["authorization"] != a.id) {
            return Ok(refuse("landing-authorization-required", "completed step requires its retained exact authorization and current landing version".into()));
        }
        return Ok(json!({"status":"ok","landing":landing,"receipt":receipt,
            "done":report::done(landing),"next_step":reconcile::next_step(landing)}));
    }
    let Some(auth) = authorization::matching(landing, request, step).cloned() else {
        return Ok(refuse("landing-authorization-required", "an exact owner authorization for this landing version and step is required".into()));
    };
    if !resume && landing.steps[slot].intent.is_some() && landing.steps[slot].receipt.is_none() {
        return Ok(refuse("landing-reconciliation-required", "a retained step intent may already have run; do not retry it".into()));
    }
    if landing.steps[slot].receipt.is_some() {
        return Ok(refuse("landing-step-complete", "this step already has a receipt; read or replay its original request".into()));
    }
    let source_matches = if *step == Step::TagPush && landing.merge_confirmation.is_some() {
        cleanup::tag_push_matches(project, landing, &auth.request.inputs, process)
    } else { effects::source_matches(project, landing, process) };
    match source_matches {
        Ok(true) => {},
        Ok(false) => return Ok(refuse("landing-source-changed", "source branch, head or remote differs from authorization".into())),
        Err(error) => return Ok(refuse("landing-source-changed", error.to_string())),
    }
    let mut absence = None;
    if resume {
        if let Some(intent) = &landing.steps[slot].intent
            && intent.authorization != auth {
            return Ok(refuse("landing-authorization-required", "resume must retain the exact authorization of the interrupted step".into()));
        }
        if let Err(error) = effects::policy(landing, &auth.request.inputs, config) {
            return Ok(refuse("landing-preflight", error.to_string()));
        }
        match reconcile::read(project, landing, &auth.request.inputs, config, process) {
            Err(error) => return Ok(refuse("landing-reconciliation-discrepancy", error.to_string())),
            Ok(reconcile::Observation::Present { result, proof }) => {
                let landing = records.records.get_mut(&request.landing).unwrap();
                let provenance = json!({"kind":"reconciled","request_id":request.request_id,
                    "intent_request_id":landing.steps[slot].intent.as_ref().map(|i| &i.request.request_id)});
                return Ok(complete(landing, slot, &auth, result, proof, provenance));
            }
            Ok(reconcile::Observation::Absent { proof }) => absence = Some(proof),
        }
    }
    let invocation = match effects::prepare(project, landing, &auth.request.inputs, config, process) {
        Ok(invocation) => invocation,
        Err(error) => return Ok(refuse("landing-preflight", error.to_string())),
    };
    if let Some(intent) = &landing.steps[slot].intent
        && intent.invocation != invocation {
        return Ok(refuse("landing-reconciliation-discrepancy", "prepared command differs from the retained intent".into()));
    }
    records.records.get_mut(&request.landing).unwrap().steps[slot].intent = Some(Intent {
        request:request.clone(), operation:Some(if resume { "land-resume" } else { step.operation() }.into()),
        authorization:auth.clone(), invocation:invocation.clone(), failure:None });
    *view = persist_intent(store, view, records, &request.landing, &request.request_id).await?;
    let result = effects::perform(project, &invocation, &auth.request, process);
    let landing = records.records.get_mut(&request.landing).unwrap();
    match result {
        Err(error) => {
            landing.steps[slot].intent.as_mut().unwrap().failure = Some(error.to_string());
            Ok(refuse("landing-reconciliation-required", error.to_string()))
        }
        Ok(result) => {
            exit_after_effect(step);
            Ok(complete(landing, slot, &auth, result, Value::Null,
                json!({"kind":"executed","request_id":request.request_id,"prior_remote_observation":absence})))
        }
    }
}

fn complete(landing: &mut Landing, slot: usize, auth: &Authorization, result: Value, proof: Value, provenance: Value) -> Value {
    let step = landing.steps[slot].step.name();
    let receipt = json!({"id":model::identity("landing-step-receipt", &landing.root_binding, &format!("{}:{step}", landing.id)),
        "landing":landing.id,"generation":landing.generation,"authorization":auth.id,"step":step,
        "source":landing.source,"base":landing.base,"remote":landing.remote,"inputs":auth.request.inputs,
        "result":result,"proof":proof,"provenance":provenance});
    landing.steps[slot].receipt = Some(receipt.clone());
    landing.generation += 1;
    json!({"status":"ok","landing":landing,"receipt":receipt,
        "done":report::done(landing),"next_step":reconcile::next_step(landing)})
}
