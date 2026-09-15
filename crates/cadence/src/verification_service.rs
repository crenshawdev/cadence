//! Resident adapter; all writes use the existing session's single store queue.
use cadence::{store::{Error, Result, Storage, writer::Operation}, verification::{audit, completion, human, inputs, model::{Query, Apply}, persistence, render, runner, status, verdicts, waivers}};
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
            if let Some(answer) = verdicts::replay(&view.snapshot.data, &patch)? { return Ok(answer); }
            let claim = verdicts::prepare(root, &view.snapshot.data, *patch)?;
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
        Some(factory.first_touch(root).await?.derivation_view().await?.snapshot)
    } else {
        cadence::plan::persistence::read_snapshot(root)?
    };
    let data = snapshot.as_ref().map(|s| s.data.clone()).unwrap_or_else(|| json!({}));
    match query {
        Query::Audit { phase, command } => audit::report(root, &data, phase, command.as_deref()),
        Query::Read { phase, attempt } => {
            // The requested attempt selects its receipts; the derived rows are
            // always the phase's current judgment, never the selected one's.
            let saved = persistence::attempts(&data)?.into_iter().rev()
                .find(|a| a.inputs.basis.phase == phase && attempt.as_ref().is_none_or(|id| a.id == *id));
            if attempt.is_some() && saved.is_none() {
                return Err(inputs::refuse(phase, "verification-attempt", "attempt", "retained attempt absent"));
            }
            let mut answer = status::report(root, &data, phase)?;
            let runs: Vec<_> = runner::records(&data)?.into_iter().filter(|r| saved.as_ref().is_some_and(|a| r.attempt == a.id)).collect();
            let unknown: Vec<_> = runs.iter().filter(|r| matches!(r.event, runner::Event::Launch { .. }) && runner::result(&runs, &r.id).is_none()).map(|r| r.id.clone()).collect();
            let claims: Vec<_> = verdicts::claims(&data)?.into_iter().filter(|c| saved.as_ref().is_some_and(|a| c.patch.attempt == a.id))
                .map(|c| json!({"request_id":c.patch.request_id,"answer":c.answer})).collect();
            answer["attempt"] = json!(saved);
            answer["runs"] = json!(runs);
            answer["unknown_runs"] = json!(unknown);
            answer["claims"] = json!(claims);
            answer["report"] = json!(render::text(&answer));
            Ok(answer)
        }
        Query::Next { phase, request_id } => {
            if phase == 0 { return Err(inputs::refuse(phase, "verification-phase", "phase", "positive integer phase required")); }
            if cadence::context::persistence::saved(&data, phase)?.is_none() {
                // Request identity reuse is checked first whenever a store exists.
                if let Some(id) = &request_id { persistence::replay(&data, phase, id)?; }
                return Err(inputs::refuse(phase, "native-approved-truths", "context", "native approved truths required"));
            }
            if let Some(id) = &request_id
                && let Some(saved) = persistence::replay(&data, phase, id)? {
                return Ok(json!({"status":"ok","attempt":saved}));
            }
            let request_id = match request_id {
                Some(id) => id,
                None => {
                    let observed = inputs::observe(root, &data, phase)?;
                    format!("verify-{}", cadence::store::model::digest(&serde_json::to_vec(&observed.basis)?))
                }
            };
            if let Some(saved) = persistence::replay(&data, phase, &request_id)? {
                return Ok(json!({"status":"ok","attempt":saved}));
            }
            let request = persistence::prepare(root.into(), &data, phase, request_id)?;
            let session = factory.first_touch(root).await?;
            session.config()?;
            let view = session.derivation_view().await?;
            let written = session.review_store().request(Operation::VerificationV1 {
                expected_generation: view.snapshot.generation, expected_integrity: view.snapshot.integrity,
                request: Box::new(request.clone()),
            }).await?;
            let saved = persistence::replay(&written.snapshot.data, phase, &request.attempt.request_id)?
                .ok_or_else(|| Error::Invalid("confirmed verification attempt absent".into()))?;
            inputs::reobserve_external(root, &saved.inputs, &request.documents)?;
            Ok(json!({"status":"ok","attempt":saved}))
        }
    }
}
