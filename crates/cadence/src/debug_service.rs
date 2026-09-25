use cadence::process::Process;
use crate::{config::reload::ConfigIo, import::SessionFactory};
use cadence::{debug::model::{self, Apply, Status}, envelope::{Envelope, Refusal}, rail::{git, receipts, risk},
    store::{Error, Result, writer::{Operation, Store}}};
use serde_json::{Value, json};
use std::path::Path;

pub enum Command { List, Read { slug: String }, Apply(Apply) }

pub async fn execute<I: ConfigIo + Clone + Sync>(factory: &SessionFactory<I>, root: &Path, command: Command, process: &mut (dyn Process + Send)) -> Result<Value> {
    let slug = match &command { Command::List => None, Command::Read { slug } => Some(slug.clone()),
        Command::Apply(apply) => Some(apply.identity().1.to_owned()) };
    Ok(match execute_inner(factory, root, command, process).await {
        Ok(answer) => answer,
        Err(error) => Refusal::new("debug-unavailable", error.to_string()).slot("slug").details(json!({"slug":slug})).value(),
    })
}

async fn execute_inner<I: ConfigIo + Clone + Sync>(factory: &SessionFactory<I>, root: &Path, command: Command, process: &mut (dyn Process + Send)) -> Result<Value> {
    if !matches!(command, Command::Apply(_)) {
        // Continuation has no configuration dependency, including in a stopped
        // copy. The shared Store reader verifies all three journal files.
        let pending = || match std::fs::symlink_metadata(root.join(".store-intent.json")) {
            Ok(_) => Err(cadence::store::Error::Conflict("pending Store intent requires recovery".into())),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(error.into()),
        };
        pending()?;
        let snapshot = cadence::store::cache::read(root)?;
        pending()?;
        let mut data = snapshot.map(|s| s.data.clone()).unwrap_or_else(|| json!({}));
        if model::namespace(&data)?.records.values().any(|r| r.review.as_ref().is_some_and(|r| r.fire.is_some())) {
            let session = factory.first_touch(root).await?;
            data = cadence::debug::review::synchronize(session.review_store(), root).await?.snapshot.data;
        }
        let data = &data;
        return match command {
            Command::List => Ok(json!({"status":"ok","records":model::namespace(data)?.records.into_values()
                .filter(|r| r.status == Status::Open).collect::<Vec<_>>()})),
            Command::Read { slug } => {
                model::validate_slug(&slug)?;
                Ok(model::namespace(data)?.records.get(&slug).map(model::answer).unwrap_or_else(|| model::unknown(&slug)))
            }
            Command::Apply(_) => unreachable!("read branch"),
        };
    }
    let session = factory.first_touch(root).await?;
    let store = session.review_store();
    let view = cadence::debug::review::synchronize(store, root).await?;
    let data = &view.snapshot.data;
    match command {
        Command::List | Command::Read { .. } => unreachable!("read before config"),
        Command::Apply(apply) => {
            let mut write = model::Write { root_binding: cadence::verification::inputs::root_binding(root)?, apply,
                recall: None, review: None, coordinating: false, consult_policy: None, consult_situation: None, consult_result: None };
            if let Some(answer) = model::replay(data, &write)? { return Ok(answer); }
            cadence::milestone::model::name(write.apply.identity().0)?;
            let generation = session.config()?;
            write.consult_policy = consult_policy(&generation.effective.values);
            if matches!(write.apply, Apply::Consult { .. }) {
                return consult(store, &generation.effective.values, write).await;
            }
            if let Apply::Open { request } = &write.apply
                && model::outcome(data, &write).is_ok() {
                let recalled = super::recall::resident::answer(&session, root, &request.symptom, None, None, &mut None).await?;
                write.recall = Some(serde_json::from_value(serde_json::to_value(recalled)?)?);
            }
            if matches!(write.apply, Apply::Resolve { .. }) && model::outcome(data, &write).is_ok()
                && let Some(refusal) = coordinate(factory, root, store, &mut write, process).await? {
                return Ok(refusal);
            }
            persist(store, write).await
        }
    }
}

async fn persist(store: &Store, write: model::Write) -> Result<Value> {
    let view = store.request(Operation::ReadVerified).await?;
    let response = match model::outcome(&view.snapshot.data, &write) {
        Ok(record) => model::response(&record, &write), Err(refusal) => refusal,
    };
    store.request(Operation::DebugV1 { expected_generation: view.snapshot.generation,
        expected_integrity: view.snapshot.integrity.clone(), write: Box::new(write) }).await?;
    Ok(response)
}

fn refusal(code: &str, reason: impl Into<String>, slug: &str) -> Value {
    Refusal::new(code, reason).slot("slug").details(json!({"slug":slug})).value()
}

/// Each side effect has an immutable request identity. The debug coordination
/// write reserves the caller input and admission key before the shared service
/// allocates a fire; a restart can finish either journal join without rescanning.
async fn coordinate<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>, root: &Path, store: &Store, write: &mut model::Write,
    process: &mut (dyn Process + Send),
) -> Result<Option<Value>> {
    let slug = write.apply.identity().1.to_owned();
    let project = root.parent().ok_or_else(|| Error::Invalid("planning root lacks project".into()))?;
    let (resolved, diagnostics) = git::resolve(project, &risk::Source::Staged { base: "HEAD".into() }, process);
    let Some(material) = resolved.material() else {
        return Ok(Some(refusal("unresolved-material", diagnostics.join("; "), &slug)));
    };
    let paths = git::changed_paths(project, &material, process)?;
    if paths.is_empty() {
        return Ok(Some(refusal("debug-empty-index", "empty index: stage the approved fix before resolve", &slug)));
    }
    let session = factory.first_touch(root).await?;
    let config = session.config()?;
    let surfaces = crate::config::merge::get(&config.effective.values, "review.triggers.risk_surface.surfaces")
        .ok_or_else(|| Error::Policy("missing risk selection".into())).and_then(risk::configured_surfaces)?;
    let Some(surfaces) = surfaces else {
        return Ok(Some(refusal("unanswered-surfaces", "risk surface selection is unanswered", &slug)));
    };
    let view = store.request(Operation::ReadVerified).await?;
    let saved = model::namespace(&view.snapshot.data)?;
    let record = saved.records.get(&slug).ok_or_else(|| Error::Invalid("debug record disappeared".into()))?;
    if let Some(review) = record.review.as_ref().filter(|r| !r.history.is_empty()) {
        if !cadence::debug::review::current(review, &material, &surfaces) {
            return Ok(Some(refusal("debug-material-changed", "staged material differs from the exact debug review receipt", &slug)));
        }
        let (current, _) = git::resolve(project, &risk::Source::Staged { base: "HEAD".into() }, process);
        if current.material().as_ref() != Some(&material) || session.config()? != config {
            return Ok(Some(refusal("debug-material-changed", "staged material or risk configuration changed during resolve", &slug)));
        }
        write.review = Some(review.clone());
        return Ok(None);
    }
    if record.review.as_ref().is_some_and(|review| review.material != material
        && (review.fire.is_some() || view.snapshot.data["review"]["replays"].get(&review.admission_request_id).is_some())) {
        return Ok(Some(refusal("debug-material-changed", "staged material differs from the pending debug fire", &slug)));
    }
    let identity = cadence::store::model::digest(&serde_json::to_vec(&(&write.root_binding, &slug, &material, &surfaces))?);
    let source = risk::Source::Staged { base: material.base_id().into() };
    let selection = risk::ScopeSelection::RootDebug { kind: risk::RootDebugKind::RootDebug, occurrence: slug.clone() };
    let observation_id = format!("debug-risk-{identity}");
    let scan = match super::rail_service::apply(factory, root, risk::Apply::RiskCheck {
        request_id: observation_id.clone(), scope: selection, source: source.clone(), surfaces: None,
    }).await? {
        Envelope::Ok(record) => record,
        Envelope::Refused { code, reason } => return Ok(Some(refusal(&code, reason, &slug))),
        other => return Ok(Some(refusal("debug-risk-unavailable", serde_json::to_string(&other)?, &slug))),
    };
    if scan.observation.resolution.material().as_ref() != Some(&material)
        || scan.observation.surfaces != surfaces {
        return Ok(Some(refusal("debug-material-changed", "risk observation differs from current staged material or surfaces", &slug)));
    }
    if scan.observation.outcome != risk::ObservationOutcome::Checked {
        return Ok(Some(refusal("debug-risk-unchecked", "staged material could not be risk-checked", &slug)));
    }
    if scan.observation.scan.as_ref().is_none_or(|scan| scan.empty) {
        return Ok(Some(refusal("debug-empty-index", "empty index: no scannable staged fix", &slug)));
    }
    let mut review = model::Review { occurrence: slug.clone(), material: material.clone(),
        observation: observation_id, admission_request_id: format!("debug-review-{identity}"), fire: None,
        history: vec![], pending_fires: vec![], settled: false };
    if let Some(prior) = &record.review {
        review.fire = prior.fire.clone();
    }
    if receipts::requires_review(&scan) {
        // Save the exact admission key before crossing the shared admission boundary.
        write.review = Some(review.clone());
        write.coordinating = true;
        let staged = persist(store, write.clone()).await?;
        write.coordinating = false;
        if staged["status"] != "ok" { return Ok(Some(staged)); }
        let request = json!({"replay_key":review.admission_request_id,"caller":"debug","trigger":"risk_surface",
            "specialist":null,"project":project.to_string_lossy(),"cycle":"live",
            "home":{"kind":"root-debug","id":slug},"discriminator":review.occurrence,
            "phase":null,"plan":null,"anchor":null,"round":1,
            "target":{"kind":"staged-tree","base":material.base_id(),"index":material.tip_id(),"head":null},
            "risk_observation":review.observation});
        let admitted = super::review_service::admit(factory, root, request,
            super::review_service::AdmissionResolution::Refresh).await?;
        let fire = match admitted {
            Envelope::Ok(output) if output.result["fire"].is_string() => output.result["fire"].as_str().unwrap().to_owned(),
            Envelope::Ok(output) => return Ok(Some(Refusal::new("debug-review-unavailable", "risk review has not admitted a fire")
                .slot("slug").details(json!({"slug":slug,"admission":output.result})).value())),
            Envelope::Refused { code, reason } => return Ok(Some(refusal(&code, reason, &slug))),
            other => return Ok(Some(refusal("debug-review-unavailable", serde_json::to_string(&other)?, &slug))),
        };
        review.fire = Some(fire.clone());
        write.review = Some(review.clone());
        write.coordinating = true;
        let joined = persist(store, write.clone()).await?;
        write.coordinating = false;
        if joined["status"] != "ok" { return Ok(Some(joined)); }
        let view = store.request(Operation::ReadVerified).await?;
        let boundary = super::rail_service::receipt_boundary(&view, scan.observation.scope.clone(), &source)?;
        let fire_record = receipts::Fire { id: fire.clone(), binding: receipts::Binding::new(boundary, &scan)?,
            review_scope: paths.into_iter().map(|p| p.into_os_string().into_string()
                .map_err(|_| Error::Invalid("non-UTF-8 risk path".into())))
                .collect::<Result<std::collections::BTreeSet<_>>>()?.into_iter().collect(), rearm_of: None };
        match super::rail_service::receipt(factory, root, super::rail_service::ReceiptCommand::Submit(
            receipts::Apply::Fire { request_id: format!("debug-fire-{identity}"), fire: Box::new(fire_record) }
        ),
        process,).await? {
            Envelope::Ok(_) => review.fire = Some(fire),
            Envelope::Refused { code, reason } => return Ok(Some(refusal(&code, reason, &slug))),
            other => return Ok(Some(refusal("debug-risk-unavailable", serde_json::to_string(&other)?, &slug))),
        }
    } else {
        let view = store.request(Operation::ReadVerified).await?;
        let boundary = super::rail_service::receipt_boundary(&view, scan.observation.scope.clone(), &source)?;
        let assessment = receipts::assess(&receipts::Requirement { boundary, material: material.clone(),
            surfaces: surfaces.clone() }, &view.snapshot.data)?;
        if !assessment.permits_continuation {
            return Ok(Some(Refusal::new("debug-risk-pending", "current staged risk evidence has not cleared")
                .slot("slug").details(json!({"slug":slug,"assessment":assessment})).value()));
        }
    }
    let (current, _) = git::resolve(project, &risk::Source::Staged { base: "HEAD".into() }, process);
    if current.material().as_ref() != Some(&material) || session.config()? != config {
        return Ok(Some(refusal("debug-material-changed", "staged material or risk configuration changed during resolve", &slug)));
    }
    if review.fire.is_some() {
        let view = cadence::debug::review::synchronize(store, root).await?;
        review = model::namespace(&view.snapshot.data)?.records[&slug].review.clone()
            .ok_or_else(|| Error::Invalid("debug review disappeared".into()))?;
    }
    write.review = Some(review);
    Ok(None)
}

fn consult_policy(values: &Value) -> Option<model::ConsultPolicy> {
    let get = |key: &str| crate::config::merge::get(values, key);
    if get("review.consult.enabled").and_then(Value::as_bool) != Some(true) { return None; }
    let tier = get("review.consult.tier").and_then(Value::as_str).unwrap_or("flagship");
    let preferred = get("review.reviewers").and_then(Value::as_array).into_iter().flatten().filter_map(Value::as_str);
    for provider in preferred.chain(["openai", "gemini", "deepseek"]) {
        if cadence::review::provider::Provider::parse(provider).is_none() { continue; }
        if let Some(model) = get(&format!("review.providers.{provider}.tiers.{tier}"))
            .and_then(Value::as_str).filter(|m| !m.trim().is_empty()) {
            return Some(model::ConsultPolicy { threshold: get("review.consult.attempt_threshold").and_then(Value::as_u64).unwrap_or(3),
                provider: provider.into(), model: model.into(),
                effort: get("review.consult.effort").and_then(Value::as_str).unwrap_or("high").into() });
        }
    }
    None
}

async fn consult(store: &Store, values: &Value, mut write: model::Write) -> Result<Value> {
    use cadence::review::provider;
    let Apply::Consult { request } = &write.apply else { unreachable!("consult route") };
    if request.decision == model::ConsultDecision::Decline { return persist(store, write).await; }
    let slug = request.slug.clone();
    let offer_id = request.offer.clone();
    let view = store.request(Operation::ReadVerified).await?;
    if let Some(replay) = model::replay(&view.snapshot.data, &write)? { return Ok(replay); }
    let saved = model::namespace(&view.snapshot.data)?;
    let Some(record) = saved.records.get(&slug) else { return Ok(model::unknown(&slug)); };
    write.coordinating = true;
    write.consult_situation = Some(provider::consult::situation(record).map_err(Error::Invalid)?);
    if let Err(refusal) = model::outcome(&view.snapshot.data, &write) { return Ok(refusal); }
    // The accepted intent is the single spend reservation. It remains pending
    // if work is canceled, the process exits or result persistence fails.
    let intent = persist(store, write.clone()).await?;
    if intent["status"] != "ok" { return Ok(intent); }
    let record: model::Record = serde_json::from_value(intent["record"].clone())?;
    let offer = record.consults.iter().find(|offer| offer.id == offer_id).ok_or_else(|| Error::Invalid("missing accepted consult".into()))?;
    let get = |key: &str| crate::config::merge::get(values, key);
    let defaults = provider::Settings::default();
    let settings = provider::Settings {
        key_file: get("review.key_file").and_then(Value::as_str).map(str::to_owned),
        max_prompt_tokens: get("review.max_prompt_tokens").and_then(Value::as_u64).unwrap_or(defaults.max_prompt_tokens),
        request_timeout_ms: get("review.request_timeout_ms").and_then(Value::as_u64).unwrap_or(defaults.request_timeout_ms),
    };
    let environment = provider::delivery::Environment::default();
    write.consult_result = Some(provider::consult::run(offer, &settings, &environment).await);
    write.coordinating = false;
    persist(store, write).await
}
