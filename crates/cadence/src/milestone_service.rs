use cadence::process::Process;
use crate::{config::reload::ConfigIo, import::SessionFactory};
use cadence::envelope::Refusal;
use cadence::{milestone::{model::{self, Apply, Close, Receipt, Selection, State}, preflight}, store::{Error, Result}};
use serde_json::{Value, json};
use std::path::Path;

pub enum Command {
    Read { occurrence: String, selection: Selection },
    Apply(Apply),
}

pub async fn execute<I: ConfigIo + Clone + Sync>(factory: &SessionFactory<I>, root: &Path, command: Command, process: &mut (dyn Process + Send)) -> Result<Value> {
    match execute_inner(factory, root, command, process).await {
        Ok(answer) => Ok(answer),
        Err(error) => Ok(model::refuse("milestone-unavailable", error.to_string())),
    }
}

async fn audits<I: ConfigIo + Clone + Sync>(factory: &SessionFactory<I>, root: &Path, selection: &Selection, process: &mut (dyn Process + Send)) -> Result<Vec<Value>> {
    let mut answers = Vec::new();
    for phase in &selection.phases {
        let audit = super::verification_service::execute(factory, root,
            super::verification_service::Command::Query(cadence::verification::model::Query::Audit {
                phase: phase.get(), command: Some("cad-audit".into()),
            }),
            process,).await?;
        answers.push(json!({"phase":phase.get(),"audit":audit}));
    }
    Ok(answers)
}

async fn execute_inner<I: ConfigIo + Clone + Sync>(factory: &SessionFactory<I>, root: &Path, command: Command, process: &mut (dyn Process + Send)) -> Result<Value> {
    match &command {
        Command::Apply(Apply::Release { request }) => return release_propose(factory, root, request.clone(), process).await,
        Command::Apply(Apply::ReleaseConfirm { request }) => return release_confirm(factory, root, request.clone(), process).await,
        _ => {},
    }
    if let Command::Apply(Apply::Prune { request }) = command {
        return execute_prune(factory, root, request, process).await;
    }
    let session = factory.first_touch(root).await?;
    let store = session.review_store();
    let view = session.derivation_view().await?;
    let binding = cadence::verification::inputs::root_binding(root)?;
    let mut records = model::records::<Close>(&view.snapshot.data, "milestones")?;
    for (id, close) in &records.records {
        if close.id != *id || close.root_binding != binding || close.id != model::identity("milestone", &binding, &close.occurrence) {
            return Err(Error::Invalid("milestone record root or identity mismatch".into()));
        }
        close.selection.validate()?;
    }
    let (occurrence, selection, request) = match command {
        Command::Read { occurrence, selection } => (occurrence, selection, None),
        Command::Apply(Apply::Close { request }) => (request.occurrence.clone(), request.selection.clone(), Some(request)),
        Command::Apply(Apply::Prune { .. }) => unreachable!("prune is routed before document derivation"),
        Command::Apply(Apply::Release { .. } | Apply::ReleaseConfirm { .. }) => unreachable!("release routed before derivation"),
    };
    let id = model::identity("milestone", &binding, &occurrence);
    let prior = records.records.get(&id).cloned();
    if request.is_none() && let Some(close) = &prior {
        if close.selection != selection {
            return Ok(Refusal::new("milestone-selection", "a ready close has an immutable phase selection and label")
                .slot("selection").details(json!({"close":close.id,"selection":close.selection})).value());
        }
        let prunes = model::records::<cadence::milestone::prune::Prune>(&view.snapshot.data, cadence::milestone::prune::NAMESPACE)?;
        if let Some(prune) = prunes.records.values().find(|p| p.request.close == close.id) {
            return Ok(json!({"status":"ok","read_only":true,"close":close,"identity":id,"generation":close.generation,
                "occurrence":occurrence,"selection":selection,"prune":cadence::milestone::prune::answer(prune)["prune"],
                "recovery":"committed; retry returns the retained receipt","next":"landing requires a separate owner choice",
                "actions":{"prune":{"operation":"milestone-prune","request":prune.request}}}));
        }
    }
    let raw = request.as_ref().map(serde_json::to_value).transpose()?;
    if let (Some(request), Some(raw)) = (&request, &raw)
        && let Some(answer) = model::replay(&records, &binding, &request.request_id, raw)? { return Ok(answer); }
    let validation = model::name(&occurrence).and_then(|_| selection.validate());
    let answer = if let Err(error) = validation {
        model::refuse("invalid-arguments", error.to_string())
    } else if request.as_ref().is_some_and(|r| model::reused(&records, &binding, &r.request_id)) {
        model::refuse("request-reused", "request_id already binds different milestone inputs")
    } else {
        let preflight = preflight::collect(store, &view, &selection).await;
        match preflight {
            Err(error) => model::refuse("milestone-unavailable", error.to_string()),
            Ok(unsettled) => {
                let generation = prior.as_ref().map_or(0, |c| c.generation);
                if let Some(request) = &request {
                    if model::name(&request.request_id).is_err() {
                        model::refuse("invalid-arguments", "request_id must be nonblank bounded text")
                    } else if !unsettled.is_empty() {
                        let mut refusal = Refusal::new("milestone-unsettled", "selected phases retain unsettled records")
                            .details(json!({"unsettled":unsettled})).value();
                        // Keep the plan 1 caller's top-level unsettled list available.
                        refusal["unsettled"] = refusal["details"]["unsettled"].clone();
                        refusal
                    } else if request.expected_generation != generation {
                        Refusal::new("milestone-generation", "expected generation does not match the current milestone generation")
                            .details(json!({"expected_generation":request.expected_generation,"generation":generation})).value()
                    } else if let Some(close) = &prior {
                        if close.selection != selection { model::refuse("milestone-selection", "a ready close has an immutable phase selection and label") }
                        else { json!({"status":"ok","close":close}) }
                    } else {
                        let mut incomplete = Vec::new();
                        for phase in &selection.phases {
                            if !cadence::verification::completion::applicable(&view.snapshot.data, phase.get())?
                                .is_some_and(|(_, applies, _)| applies) { incomplete.push(phase.get()); }
                        }
                        if !incomplete.is_empty() {
                            Refusal::new("milestone-incomplete", "selected phases need current native completion")
                                .details(json!({"phases":incomplete})).value()
                        } else {
                            // Reading existing audits is not a new audit verdict. Prune is
                            // a later operation; this record changes no authored document.
                            let audit = audits(factory, root, &selection, process).await?;
                            if audit.iter().any(|a| a["audit"]["status"] != "ok") {
                                Refusal::new("milestone-audit-unavailable", "selected phases need available audit reports")
                                    .details(json!({"audits":audit})).value()
                            } else {
                                let close = Close { id: id.clone(), root_binding: binding.clone(), occurrence: occurrence.clone(), generation: 1,
                                    selection: selection.clone(), state: State::Ready };
                                records.records.insert(id.clone(), close.clone());
                                json!({"status":"ok","close":close})
                            }
                        }
                    }
                } else {
                    let audit = audits(factory, root, &selection, process).await?;
                    let action = json!({"operation":"milestone-close","request":{
                        "request_id":model::identity("close", &binding, &format!("{occurrence}:{}:{generation}:{}", cadence::store::model::digest(&serde_json::to_vec(&selection)?), view.snapshot.generation)),
                        "occurrence":occurrence,"expected_generation":generation,"selection":selection}});
                    let mut actions = json!({"close":action});
                    if let Some(close) = &prior {
                        actions["prune"] = json!({"operation":"milestone-prune","request":{
                            "request_id":model::identity("prune-request",&binding,&close.id),"close":close.id,
                            "expected_generation":close.generation,"selection":close.selection}});
                    }
                    json!({"status":"ok","read_only":true,"close":prior,"identity":id,"generation":generation,
                        "occurrence":occurrence,"selection":selection,"audits":audit,"unsettled":unsettled,
                        "next":if prior.is_some(){"milestone-prune after the owner's explicit choice"}else{"milestone-close"},
                        "actions":actions})
                }
            }
        }
    };
    if let (Some(request), Some(raw)) = (request, raw) {
        model::persist(store, &view, "milestones", &mut records, Receipt { root_binding: binding, request_id: request.request_id, request: raw, answer }).await
    } else { Ok(answer) }
}

async fn execute_prune<I: ConfigIo + Clone + Sync>(factory: &SessionFactory<I>, root: &Path, request: model::PruneRequest, process: &mut (dyn Process + Send)) -> Result<Value> {
    use cadence::{milestone::prune::{self, Prune, NAMESPACE}, store::writer::Operation};
    let session = factory.first_touch(root).await?;
    let store = session.review_store();
    let view = store.request(Operation::ReadVerified).await?;
    let binding = cadence::verification::inputs::root_binding(root)?;
    let mut records = model::records::<Prune>(&view.snapshot.data, NAMESPACE)?;
    let raw = serde_json::to_value(&request)?;
    if let Some(answer) = model::replay(&records, &binding, &request.request_id, &raw)? { return Ok(answer); }
    let refusal = if model::reused(&records, &binding, &request.request_id) {
        Some(model::refuse("request-reused", "request_id already binds different prune inputs"))
    } else if let Err(error) = prune::require_close(&view.snapshot.data, &binding, &request) {
        Some(Refusal::new("prune-close-identity", error.to_string()).slot("request.close")
            .details(json!({"close":request.close,"expected_generation":request.expected_generation,"selection":request.selection})).value())
    } else if let Some(prior) = records.records.values().find(|p| p.request.close == request.close) {
        Some(Refusal::new("prune-exists", "retry the identified prune request").slot("request.close")
            .details(json!({"id":prior.id,"request":prior.request})).value())
    } else {
        let current = session.derivation_view().await?;
        let unsettled = preflight::collect(store, &current, &request.selection).await?;
        if !unsettled.is_empty() {
            Some(Refusal::new("milestone-unsettled", "selected phases retain unsettled records").details(json!({"unsettled":unsettled})).value())
        } else {
            let config = session.config()?;
            let protected = cadence::rail::branch::protected_branches(config.effective.values.pointer("/git/protected_branches"));
            let on_protected = config.effective.values.pointer("/git/on_protected").and_then(Value::as_str).unwrap_or("ask").to_owned();
            match prune::freeze(root, &view.snapshot.data, &binding, request.clone(), protected, on_protected, process) {
                Ok(prune) => {
                    let answer = prune::answer(&prune);
                    store.request(Operation::MilestonePruneV1 {expected_generation:view.snapshot.generation,
                        expected_integrity:view.snapshot.integrity.clone(),prune:Box::new(prune)}).await?;
                    return Ok(answer);
                }
                Err(error) => Some(Refusal::new("prune-preflight", error.to_string()).slot("request.close")
                    .details(json!({"close":request.close})).value()),
            }
        }
    };
    model::persist(store, &view, NAMESPACE, &mut records, Receipt {root_binding:binding,
        request_id:request.request_id,request:raw,answer:refusal.expect("all successful branches return")}).await
}

async fn release_propose<I: ConfigIo + Clone + Sync>(factory: &SessionFactory<I>, root: &Path, request: cadence::milestone::release::Request, process: &mut (dyn Process + Send)) -> Result<Value> {
    use cadence::{milestone::release::{self, Report, NAMESPACE}, store::writer::Operation};
    let session = factory.first_touch(root).await?;
    let store = session.review_store();
    let view = store.request(Operation::ReadVerified).await?;
    let binding = cadence::verification::inputs::root_binding(root)?;
    let raw = serde_json::to_value(&request)?;
    let mut records = model::records::<Report>(&view.snapshot.data,NAMESPACE)?;
    if let Some(answer) = model::replay(&records,&binding,&request.request_id,&raw)? { return Ok(answer); }
    let answer = if model::reused(&records,&binding,&request.request_id) {
        model::refuse("request-reused","request_id already binds different release inputs")
    } else {
        match release::observe(root.parent().ok_or_else(|| Error::Invalid("missing project".into()))?,&binding,request.clone(), process) {
            Err(error) => Refusal::new("release-input",error.to_string()).slot("request").details(json!({"manifest":request.manifest})).value(),
            Ok(report) => {
                if let Some(collision) = release::collision(&report.tags,&request.version,&request.tag) {
                    Refusal::new("release-collision",format!("release version {} already has tag {}",request.version,collision.tag))
                        .slot("request.version").details(json!({"collision":collision,"release":report})).value()
                } else if let Err(error) = release::landing(&view.snapshot.data,&binding,&request,&report.head) {
                    model::refuse("release-landing",error.to_string())
                } else {
                    records.records.insert(report.id.clone(),report.clone());
                    json!({"status":"ok","release":report,"next":"milestone-release-confirm with owner, at, release and digest"})
                }
            }
        }
    };
    model::persist(store,&view,NAMESPACE,&mut records,Receipt {root_binding:binding,request_id:request.request_id,request:raw,answer}).await
}

async fn release_confirm<I: ConfigIo + Clone + Sync>(factory: &SessionFactory<I>, root: &Path, request: cadence::milestone::release::Confirm, process: &mut (dyn Process + Send)) -> Result<Value> {
    use cadence::{milestone::release::{self, Report, NAMESPACE}, store::writer::Operation};
    let session = factory.first_touch(root).await?;
    let store = session.review_store();
    let view = store.request(Operation::ReadVerified).await?;
    let binding = cadence::verification::inputs::root_binding(root)?;
    let mut records = model::records::<Report>(&view.snapshot.data,NAMESPACE)?;
    let raw = serde_json::to_value(&request)?;
    if let Some(answer) = model::replay(&records,&binding,&request.request_id,&raw)? { return Ok(answer); }
    let report = records.records.get(&request.release).cloned();
    let answer = if model::reused(&records,&binding,&request.request_id) {
        model::refuse("request-reused","request_id already binds different release inputs")
    } else if [&request.request_id,&request.owner,&request.at].iter().any(|s| model::name(s).is_err())
        || report.as_ref().is_none_or(|r| r.root_binding != binding || r.digest != request.digest) {
        model::refuse("release-confirmation","attributed confirmation must name the exact release id and digest")
    } else {
        let report = report.unwrap();
        let project = root.parent().ok_or_else(|| Error::Invalid("missing project".into()))?;
        match release::reobserve(project,&report, process).and_then(|()| release::landing(&view.snapshot.data,&binding,&report.request,&report.head).map(|_| ())) {
            Err(error) => model::refuse("release-basis-changed",error.to_string()),
            Ok(()) => {
                let config = session.config()?;
                let protected = cadence::rail::branch::protected_branches(config.effective.values.pointer("/git/protected_branches"));
                let on_protected = config.effective.values.pointer("/git/on_protected").and_then(Value::as_str).unwrap_or("ask").to_owned();
                match release::freeze(root,report,request.clone(),protected,on_protected, process) {
                    Err(error) => model::refuse("release-preflight",error.to_string()),
                    Ok(write) => {
                        let answer = release::answer(&write);
                        store.request(Operation::MilestoneReleaseV1 {expected_generation:view.snapshot.generation,
                            expected_integrity:view.snapshot.integrity.clone(),write:Box::new(write)}).await?;
                        return Ok(answer);
                    }
                }
            }
        }
    };
    model::persist(store,&view,NAMESPACE,&mut records,Receipt {root_binding:binding,request_id:request.request_id,request:raw,answer}).await
}
