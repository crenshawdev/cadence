//! Resident adapter; all writes use the existing session's single store queue.
use cadence::{store::{Error, Result, Storage, writer::Operation}, verification::{audit, completion, human, inputs, model::{Query, Apply}, persistence, runner, status, verdicts, waivers}};
use serde_json::{Value, json};
use std::path::Path;

pub enum Command { Query(Query), Apply(Apply) }

pub async fn execute<I: crate::config::reload::ConfigIo + Clone + Sync>(
    factory: &crate::import::SessionFactory<I>, root: &Path, command: Command,
) -> Result<Value> {
    let result = match command {
        Command::Query(query) => execute_inner(factory, root, query).await,
        Command::Apply(Apply::Run { request }) => {
            let session = factory.first_touch(root).await?;
            session.config()?;
            runner::launch(session.review_store().clone(), root.into(), *request).await
                .map(|receipt| json!({"status":"ok","receipt":receipt}))
        }
        Command::Apply(Apply::Submit { patch }) => {
            let session = factory.first_touch(root).await?;
            session.config()?;
            let view = session.derivation_view().await?;
            use cadence::verification::model::{Patch, SubmitPatch};
            let patch = match *patch {
                SubmitPatch::Legacy(legacy) => {
                    if let Ok(patch) = serde_json::from_value::<Patch>(json!(legacy))
                        && let Some(prior) = verdicts::claims(&view.snapshot.data)?.iter().find(|c| c.patch == patch) {
                        return Ok(prior.answer.clone());
                    }
                    return Ok(cadence::envelope::Refusal::new("typed-content", "verification-submit resolves basis from the retained attempt")
                        .rule("typed-content").slot("patch.basis").value());
                }
                SubmitPatch::Compact(compact) => {
                    let Some(attempt) = persistence::attempt(&view.snapshot.data, None, &compact.attempt)? else {
                        return Ok(cadence::envelope::Refusal::new("verification-attempt", "retained attempt absent")
                            .rule("verification-attempt").slot("patch.attempt").value());
                    };
                    Patch { request_id: compact.request_id, attempt: compact.attempt, items: compact.items, basis: attempt.inputs.basis }
                }
            };
            if let Some(answer) = verdicts::replay(&view.snapshot.data, &patch)? { return Ok(answer); }
            let claim = verdicts::prepare(root, &view.snapshot.data, patch)?;
            let transaction = verdicts::transaction(&view.snapshot.data, &claim)?;
            let written = session.review_store().request(Operation::CompareTransact {
                expected_generation: view.snapshot.generation, expected_integrity: view.snapshot.integrity, transaction,
            }).await;
            written.and_then(|view| verdicts::replay(&view.snapshot.data, &claim.patch)?
                .ok_or_else(|| Error::Invalid("confirmed verification claim absent".into())))
        }
        Command::Apply(Apply::Waive { request_id, submission, approval }) => {
            let request = waivers::Request { request_id, submission: *submission, approval: *approval };
            let session = factory.first_touch(root).await?;
            session.config()?;
            let view = session.derivation_view().await?;
            if let Some(answer) = waivers::replay(&view.snapshot.data, &request)? { return Ok(answer); }
            let claim = waivers::prepare(root, &view.snapshot.data, request)?;
            if claim.answer["status"] != "ok" { return Ok(claim.answer); }
            let transaction = waivers::transaction(&view.snapshot.data, &claim)?;
            let written = session.review_store().request(Operation::CompareTransact {
                expected_generation: view.snapshot.generation, expected_integrity: view.snapshot.integrity, transaction,
            }).await;
            written.and_then(|view| waivers::replay(&view.snapshot.data, &claim.request)?
                .ok_or_else(|| Error::Invalid("confirmed waiver absent".into())))
        }
        Command::Apply(Apply::Human { request_id, submission, approval }) => {
            let request = human::Request { request_id, submission: *submission, approval: *approval };
            let phase = request.submission.phase;
            let session = factory.first_touch(root).await?;
            session.config()?;
            let view = session.derivation_view().await?;
            if let Some(answer) = human::replay(&view.snapshot.data, &request)? { return Ok(answer); }
            let claim = human::prepare(root, &view.snapshot.data, request)?;
            if claim.answer["status"] != "ok" { return Ok(claim.answer); }
            // The preimage is the exact installed UAT.md the claim observed;
            // the writer validates it again before and after every install.
            let expected = cadence::store::filesystem::Filesystem::new(root)?.read(&format!("phase-uat:{phase}"))?;
            let transaction = human::transaction(&view.snapshot.data, &claim, expected)?;
            let written = session.review_store().request(Operation::CompareTransact {
                expected_generation: view.snapshot.generation, expected_integrity: view.snapshot.integrity, transaction,
            }).await;
            written.and_then(|view| human::replay(&view.snapshot.data, &claim.request)?
                .ok_or_else(|| Error::Invalid("confirmed human result absent".into())))
        }
        Command::Apply(Apply::Complete { request_id, attempt, basis, projections }) => {
            let request = completion::Request { request_id, attempt, basis: *basis, projections: *projections };
            let session = factory.first_touch(root).await?;
            session.config()?;
            let view = session.derivation_view().await?;
            if let Some(answer) = completion::replay(&view.snapshot.data, &request)? { return Ok(answer); }
            let claim = completion::prepare(root, &view.snapshot.data, request)?;
            if claim.answer["status"] != "ok" { return Ok(claim.answer); }
            let mut filesystem = cadence::store::filesystem::Filesystem::new(root)?;
            let expected = completion::installed(&claim)?.iter().map(|(target, _)| filesystem.read(target)).collect::<Result<Vec<_>>>()?;
            let transaction = completion::transaction(&view.snapshot.data, &claim, &expected)?;
            let written = session.review_store().request(Operation::CompareTransact {
                expected_generation: view.snapshot.generation, expected_integrity: view.snapshot.integrity, transaction,
            }).await;
            written.and_then(|view| completion::records(&view.snapshot.data)?.iter()
                .any(|r| r.request_id == claim.request.request_id).then_some(claim.answer.clone())
                .ok_or_else(|| Error::Invalid("confirmed completion absent".into())))
        }
    };
    match result {
        Ok(answer) => Ok(answer),
        Err(error) => Ok(super::execution_service::native_error(error)),
    }
}

async fn execute_inner<I: crate::config::reload::ConfigIo + Clone + Sync>(
    factory: &crate::import::SessionFactory<I>, root: &Path, query: Query,
) -> Result<Value> {
    let snapshot = if matches!(query, Query::Read { .. }) && root.join(cadence::store::model::STATE).exists() {
        Some(cadence::store::cache::SharedSnapshot(factory.first_touch(root).await?.shared_derivation_view().await?))
    } else {
        cadence::plan::persistence::read_snapshot(root)?
    };
    let empty = json!({});
    let data = snapshot.as_ref().map(|s| &s.data).unwrap_or(&empty);
    match query {
        Query::Audit { phase, command } => audit::report(root, data, phase, command.as_deref()),
        Query::Read { phase, attempt } => {
            // The requested attempt selects its receipts; the derived rows are
            // always the phase's current judgment, never the selected one's.
            let saved = persistence::latest_attempt(data, phase, attempt.as_deref())?;
            if attempt.is_some() && saved.is_none() {
                return Err(inputs::refuse(phase, "verification-attempt", "attempt", "retained attempt absent"));
            }
            let mut answer = status::report(root, data, phase)?;
            let runs: Vec<_> = runner::records(data)?.into_iter().filter(|r| saved.as_ref().is_some_and(|a| r.attempt == a.id)).collect();
            let unknown: Vec<_> = runs.iter().filter(|r| matches!(r.event, runner::Event::Launch { .. }) && runner::result(&runs, &r.id).is_none()).map(|r| r.id.clone()).collect();
            let claims: Vec<_> = verdicts::claims(data)?.into_iter().filter(|c| saved.as_ref().is_some_and(|a| c.patch.attempt == a.id))
                .map(|c| json!({"request_id":c.patch.request_id,"answer":c.answer})).collect();
            answer["attempt"] = json!(saved.as_ref().map(|a| json!({"schema":a.schema,"id":a.id,"request_id":a.request_id,
                "identity":{"kind":"verification-attempt","phase":phase,"attempt":a.id}})));
            if let Some(a) = &saved {
                let interruption = &data["worker_interruptions"]["verification"][&a.id];
                if !interruption.is_null() {
                    answer["attempt"]["interrupted"] = json!(true);
                    answer["attempt"]["exit"] = interruption.clone();
                }
            }
            answer["runs"] = json!(runs.iter().filter(|r| matches!(r.event, runner::Event::Launch { .. })).map(|r|
                json!({"id":r.id,"identity":{"kind":"run-output","phase":phase,"run":r.id}})).collect::<Vec<_>>());
            answer["unknown_runs"] = json!(unknown);
            answer["claims"] = json!(claims);
            for entry in answer["history"].as_array_mut().into_iter().flatten() {
                let id = entry["attempt"].clone();
                entry.as_object_mut().unwrap().remove("basis");
                entry.as_object_mut().unwrap().remove("truths");
                entry["identity"] = json!({"kind":"verification-attempt","phase":phase,"attempt":id});
            }
            let identity = answer["current"]["attempt"].as_str().or_else(|| saved.as_ref().map(|a| a.id.as_str()))
                .map(|id| json!({"kind":"verification-attempt","phase":phase,"attempt":id}));
            answer["identity"] = json!(identity);
            truncate_observed(&mut answer["truths"], identity.as_ref());
            bound_index(&mut answer);
            Ok(answer)
        }
        Query::Next { phase, request_id } => {
            if phase == 0 { return Err(inputs::refuse(phase, "verification-phase", "phase", "positive integer phase required")); }
            if cadence::context::persistence::saved(data, phase)?.is_none() {
                // Request identity reuse is checked first whenever a store exists.
                if let Some(id) = &request_id { persistence::replay(data, phase, id)?; }
                return Err(inputs::refuse(phase, "native-approved-truths", "context", "native approved truths required"));
            }
            if let Some(id) = &request_id
                && let Some(saved) = persistence::replay(data, phase, id)? {
                return next_answer(factory, root, &saved).await;
            }
            let request_id = match request_id {
                Some(id) => id,
                None => {
                    let observed = inputs::observe(root, data, phase)?;
                    format!("verify-{}", cadence::store::model::digest(&serde_json::to_vec(&observed.basis)?))
                }
            };
            if let Some(saved) = persistence::replay(data, phase, &request_id)? {
                return next_answer(factory, root, &saved).await;
            }
            let mut request = persistence::prepare(root.into(), data, phase, request_id)?;
            let session = factory.first_touch(root).await?;
            let config = session.config()?;
            request.attempt.route = Some(cadence::execution::model::DispatchRoute {
                choice: super::config_service::route_at(&config, &super::config_service::RouteRequest {
                    role: "cad-verifier".into(), phase: std::num::NonZeroU32::new(phase), plan: None, attempt: None,
                }, root)?.choice,
                inputs: super::config_service::routing_inputs(&config),
            });
            let view = session.derivation_view().await?;
            let written = session.review_store().request(Operation::VerificationV1 {
                expected_generation: view.snapshot.generation, expected_integrity: view.snapshot.integrity,
                request: Box::new(request.clone()),
            }).await?;
            let saved = persistence::replay(&written.snapshot.data, phase, &request.attempt.request_id)?
                .ok_or_else(|| Error::Invalid("confirmed verification attempt absent".into()))?;
            inputs::reobserve_external(root, &written.snapshot.data, &saved.inputs, &request.documents)?;
            next_answer(factory, root, &saved).await
        }
    }
}

fn truncate_observed(value: &mut Value, identity: Option<&Value>) {
    match value {
        Value::Array(values) => values.iter_mut().for_each(|v| truncate_observed(v, identity)),
        Value::Object(fields) => {
            if let Some(text) = fields.get("observed").and_then(Value::as_str).filter(|s| s.len() > 2048) {
                let mut end = 2048;
                while !text.is_char_boundary(end) { end -= 1; }
                fields.insert("observed".into(), json!(&text[..end]));
                fields.insert("truncated".into(), json!(true));
                fields.insert("identity".into(), json!(identity));
            }
            fields.values_mut().for_each(|v| truncate_observed(v, identity));
        }
        _ => {}
    }
}

fn bound_index(answer: &mut Value) {
    answer["bound"] = json!(65536);
    answer["incomplete"] = json!(false);
    // Detailed receipts and complete rows are retained under the attempt
    // identity. Keep the largest possible prefix of each index within budget.
    for key in ["claims", "history", "runs", "unknown_runs", "truths", "waivers", "humans"] {
        let mut omitted = 0;
        while answer.to_string().len() > 64512 {
            let Some(rows) = answer[key].as_array_mut().filter(|rows| !rows.is_empty()) else { break; };
            rows.pop();
            omitted += 1;
        }
        if omitted > 0 {
            answer[format!("{key}_omitted")] = json!(omitted);
            answer["incomplete"] = json!(true);
        }
    }
    if answer.to_string().len() > 64512 {
        for key in ["current", "completion"] {
            answer[key] = json!({"truncated":true,"identity":answer["identity"]});
        }
        answer["incomplete"] = json!(true);
    }
    if answer.to_string().len() > 64512 {
        *answer = json!({"status":"ok","schema":"verification-report-1","phase":answer["phase"],
            "bound":65536,"incomplete":true,"identity":answer["identity"],"truncated":true});
    }
}

async fn next_answer<I: crate::config::reload::ConfigIo + Clone + Sync>(
    factory: &crate::import::SessionFactory<I>, root: &Path, saved: &persistence::Attempt,
) -> Result<Value> {
    let phase = saved.inputs.basis.phase;
    let route = match &saved.route {
        Some(route) => route.clone(),
        None => {
            let session = factory.first_touch(root).await?;
            let config = session.config()?;
            cadence::execution::model::DispatchRoute {
                choice: super::config_service::route_at(&config, &super::config_service::RouteRequest {
                    role: "cad-verifier".into(), phase: std::num::NonZeroU32::new(phase), plan: None, attempt: None,
                }, root)?.choice,
                inputs: super::config_service::routing_inputs(&config),
            }
        }
    };
    Ok(json!({"status":"ok","attempt":{"schema":saved.schema,"id":saved.id,"request_id":saved.request_id},
        "identities":{"attempt":{"kind":"verification-attempt","phase":phase,"attempt":saved.id},
            "context":{"kind":"phase-context","phase":phase},
            "plans":saved.inputs.basis.publications.iter().map(|p| json!({"kind":"phase-plan","phase":phase,"plan":p.plan})).collect::<Vec<_>>()},
        "route":route}))
}
