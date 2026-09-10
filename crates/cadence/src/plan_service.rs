//! Provisional plan authoring; every intake and draft is strictly read-only.
use cadence::{
    plan::{
        inventory,
        model::{self, Answer, Apply},
        persistence,
    },
    store::Result,
};
use serde_json::{Value, json};
use std::path::Path;

pub enum Command {
    Read { phase: String, count: Option<u32>, submission: Option<Box<model::Submission>> },
    Apply(Value),
}

pub async fn execute<I: crate::config::reload::ConfigIo + Clone + Sync>(
    factory: &crate::import::SessionFactory<I>,
    root: &Path,
    command: Command,
) -> Result<Answer> {
    let observed = persistence::read_snapshot(root)?;
    let data = observed
        .as_ref()
        .map(|s| s.data.clone())
        .unwrap_or_else(|| json!({}));
    match command {
        Command::Read { phase, count, submission } => {
            if let Some(submission) = submission {
                if count.is_some() || submission.phase.to_string() != phase {
                    return Ok(model::refused("preview-scope", "complete submission must match phase_address and cannot accompany count"));
                }
                return match complete_preview(root, &data, *submission) {
                    Ok(answer) => Ok(answer),
                    Err(error) => path_error(error),
                };
            }
            let inventory = match inventory::read(root, &phase, &data) {
                Ok(value) => value,
                Err(error) => return Ok(model::refused("inventory", error.to_string())),
            };
            let native = phase
                .parse::<std::num::NonZeroU32>()
                .ok()
                .filter(|n| n.to_string() == phase);
            let approved = native
                .map(|n| cadence::context::persistence::saved(&data, n.get()))
                .transpose()?
                .flatten()
                .is_some();
            let saved = native
                .map(|n| persistence::saved(&data, n.get()))
                .transpose()?
                .flatten();
            let occurrence = native
                .map(|n| persistence::occurrence(&data, n.get()))
                .transpose()?;
            let plans = inventory.occupied.iter().filter_map(|number| {
                let canonical = format!("phases/{phase}/PLAN-{number}.md");
                let bare = format!("phases/{phase}/PLAN.md");
                let document = inventory.documents.get(&canonical).or_else(|| {
                    if *number == 1 { inventory.documents.get(&bare) } else { None }
                })?;
                let publication = saved.as_ref().and_then(|o| o.publications.get(number));
                Some(json!({"identity":{"phase":native.map(|p| p.get()),"plan":number},
                    "phase_address":phase,"document":document,
                    "classification":if publication.is_some() {"native-publication"} else {"legacy-input"},
                    "publication":publication}))
            }).collect::<Vec<_>>();
            let mut targets = Vec::new();
            if let Some(count) = count {
                if native.is_none() {
                    return Ok(model::refused(
                        "native-identity",
                        "publication needs a canonical positive integer phase",
                    ));
                }
                if count == 0 || count > 64 {
                    return Ok(model::refused(
                        "batch-size",
                        "preview needs between 1 and 64 plans",
                    ));
                }
                for offset in 1..=count {
                    let Some(plan) = inventory.high_water.checked_add(offset) else {
                        return Ok(model::refused(
                            "number-exhaustion",
                            "phase plan numbers are exhausted",
                        ));
                    };
                    targets.push(json!({"phase":native.unwrap(), "plan":plan}));
                }
            }
            Ok(model::ok(
                "plan-read",
                json!({"phase":phase,"persisted":false,"plans":plans,
                "inventory":inventory,"targets":targets,"occurrence":occurrence,
                "native_truths_approved":approved,"next":if approved {"plan-submit"} else {"context-intake"},
                "native":saved,"legacy_readiness":"legacy-input","readiness":"provisional-authoring",
                "contract":model::contract()}),
            ))
        }
        Command::Apply(raw) => {
            if let Some(refusal) = cadence::plan::validation::arguments(&raw) {
                return Ok(refusal);
            }
            let Apply::Submit {
                submission,
                approval,
            } = match serde_json::from_value(raw) {
                Ok(value) => value,
                Err(error) => return Ok(model::refused("submission", error.to_string())),
            };
            match persistence::replay(&data, &submission, approval.as_ref()) {
                Ok(Some(receipt)) => return replay_answer(root, &data, receipt),
                Ok(None) => {}
                Err(error) => return path_error(error),
            }
            if approval.as_ref().is_some_and(|a| a.approved) {
                if let Some(refusal) = cadence::plan::validation::identities(&submission) {
                    return Ok(refusal);
                }
                for entry in &submission.plans {
                    if let Err(error) = cadence::store::filesystem::validate_plan_path(root, entry.target.phase.get(), entry.target.plan.get()) {
                        return path_error(error);
                    }
                }
            }
            let inventory = match inventory::read(root, &submission.phase.to_string(), &data) {
                Ok(value) => value,
                Err(error) => return Ok(model::refused("inventory", error.to_string())),
            };
            if let Err(error) = cadence::plan::validation::replacement(&data, &submission, approval.as_ref(), &inventory) {
                return path_error(error);
            }
            let Some(approval) = approval.filter(|a| a.approved) else {
                return Ok(model::ok(
                    "plan-submit",
                    json!({"persisted":false,"validation":"draft","submission":submission}),
                ));
            };
            if approval.owner.as_ref().is_none_or(|s| s.trim().is_empty())
                || approval.at.as_ref().is_none_or(|s| s.trim().is_empty())
                || approval.submission.as_ref() != Some(&submission)
            {
                return Ok(model::refused(
                    "exact-submission-approval",
                    "approval needs owner, reported time and the exact complete submission",
                ));
            }
            if cadence::context::persistence::saved(&data, submission.phase.get())?.is_none() {
                return Ok(model::refused(
                    "native-approved-truths",
                    format!(
                        "phase {} needs native approved truths; use context-intake and context-submit",
                        submission.phase
                    ),
                ));
            }
            if let Err(error) = persistence::contribute(&data, &submission, &approval, &inventory) {
                return path_error(error);
            }
            let roadmap = std::fs::read_to_string(root.join("ROADMAP.md"))?;
            let lifecycle = cadence::derivation::parse_roadmap(&roadmap)
                .map_err(|e| cadence::store::Error::Invalid(format!("{e:?}")))?;
            if lifecycle.cycle != cadence::derivation::Cycle::Live {
                return Ok(model::refused(
                    "active-cycle",
                    "publication into another or archived cycle needs explicit resolution",
                ));
            }
            // Exact approval, native membership and read-only preconditions all
            // precede first_touch. Only the confirmed transaction acknowledges.
            let session = factory.first_touch(root).await?;
            let store = session.review_store();
            let view = store
                .request(cadence::store::writer::Operation::ReadVerified)
                .await?;
            match persistence::replay(&view.snapshot.data, &submission, Some(&approval)) {
                Ok(Some(receipt)) => return replay_answer(root, &view.snapshot.data, receipt),
                Ok(None) => {}
                Err(error) => return path_error(error),
            }
            let inventory = match inventory::read(root, &submission.phase.to_string(), &view.snapshot.data) {
                Ok(value) => value,
                Err(error) => return Ok(model::refused("inventory", error.to_string())),
            };
            let (proposed, results) = match persistence::contribute(
                &view.snapshot.data,
                &submission,
                &approval,
                &inventory,
            ) {
                Ok(value) => value,
                Err(error) => return path_error(error),
            };
            let mut external = Vec::new();
            for result in &results {
                let (reply, receive) = tokio::sync::oneshot::channel();
                store
                    .request(cadence::store::writer::Operation::ObservePlan {
                        phase: result.identity.phase.get(),
                        plan: result.identity.plan.get(),
                        reply,
                    })
                    .await?;
                let expected = match receive.await.map_err(|_| cadence::store::Error::Closed)? {
                    Ok(value) => value,
                    Err(error) => return path_error(error),
                };
                if let Err(error) = persistence::validate_old_document(&view.snapshot.data, result.identity.phase.get(), result.identity.plan.get(), expected.bytes.as_deref()) {
                    return path_error(error);
                }
                external.push(cadence::store::transaction::ExternalChange {
                    target: format!(
                        "phase-plan:{}:{}",
                        result.identity.phase, result.identity.plan
                    ),
                    expected,
                    bytes: cadence::plan::render::document(&result.content)?,
                });
            }
            let transaction = cadence::store::transaction::Transaction {
                id: format!("plan:{}:{}", submission.occurrence, submission.request_id),
                items: vec![],
                decisions: vec![],
                snapshot: Some(proposed),
                external,
            };
            let coverage = cadence::plan::associations::validate(&view.snapshot.data, &submission)?;
            match store
                .request(cadence::store::writer::Operation::CompareTransact {
                    expected_generation: view.snapshot.generation,
                    expected_integrity: view.snapshot.integrity,
                    transaction,
                })
                .await
            {
                Ok(_) => Ok(model::ok(
                    "plan-submit",
                    json!({"persisted":true,"results":results,"coverage":coverage}),
                )),
                Err(error) => {
                    // Another approved request may have won after our owned
                    // read. Resolve its historical result, without constructing
                    // another transaction fingerprint or retargeting a number.
                    if let Some(latest) = persistence::read_snapshot(root)? {
                        match persistence::replay(&latest.data, &submission, Some(&approval)) {
                            Ok(Some(receipt)) => return replay_answer(root, &latest.data, receipt),
                            Ok(None) => {}
                            Err(error) => return path_error(error),
                        }
                    }
                    path_error(error)
                }
            }
        }
    }
}

fn complete_preview(root: &Path, data: &Value, mut submission: model::Submission) -> Result<Answer> {
    use cadence::plan::{render, validation};
    let inventory = inventory::read(root, &submission.phase.to_string(), data)?;
    let saved = persistence::saved(data, submission.phase.get())?;
    let mut documents = Vec::new();
    for entry in &mut submission.plans {
        cadence::store::filesystem::validate_plan_path(root, entry.target.phase.get(), entry.target.plan.get())?;
        if let Some(replacement) = &entry.replacement
            && replacement.content != entry.content
        {
            return Ok(model::refused("replacement-authorization", "replacement must name the same proposed content"));
        }
        entry.content.body = render::normalize(&entry.content)?;
        if let Some(replacement) = &mut entry.replacement { replacement.content = entry.content.clone(); }
        let bytes = render::document(&entry.content)?;
        let old = saved.as_ref().and_then(|s| s.publications.get(&entry.target.plan.get()));
        let old_section = old.map(|p| render::old_section(&p.content.body)).transpose()?.flatten();
        let section = match &entry.content.evidence_map {
            Some(map @ cadence::plan::evidence::Map::Attached { .. }) => Some(render::section(map)?),
            _ => None,
        };
        documents.push(json!({"identity":entry.target,"revision":cadence::store::model::digest(&bytes),
            "document":String::from_utf8(bytes).expect("UTF-8 document"),"old_section":old_section,"section":section}));
    }
    validation::replacement_preview(data, &submission, &inventory)?;
    persistence::validate_candidate(data, &submission, &inventory)?;
    let coverage = cadence::plan::associations::validate(data, &submission)?;
    Ok(model::ok("plan-read", json!({"persisted":false,"submission":submission,"documents":documents,
        "readiness":"provisional-authoring","coverage":coverage})))
}

fn replay_answer(root: &Path, data: &Value, receipt: model::Receipt) -> Result<Answer> {
    let mut projections = Vec::new();
    for historical in &receipt.results {
        let phase = historical.identity.phase.get();
        let plan = historical.identity.plan.get();
        let current = persistence::saved(data, phase)?;
        let current = current.as_ref().and_then(|o| o.publications.get(&plan));
        let status = if cadence::store::filesystem::validate_plan_path(root, phase, plan).is_err() {
            "drifted"
        } else {
            match std::fs::read(root.join(format!("phases/{phase}/PLAN-{plan}.md"))) {
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => "missing",
                Err(error) => return Err(error.into()),
                Ok(bytes) => match current {
                    Some(current) if cadence::store::model::digest(&bytes) == current.revision => {
                        if current.revision == historical.revision { "installed" } else { "newer-authorized" }
                    }
                    _ => "drifted",
                },
            }
        };
        projections.push(json!({"identity":historical.identity,"status":status,
            "current_revision":current.map(|p| &p.revision)}));
    }
    Ok(model::ok("plan-submit", json!({"persisted":true,"replayed":true,
        "results":receipt.results,"projections":projections})))
}

fn path_error(error: cadence::store::Error) -> Result<Answer> {
    if let cadence::store::Error::Invalid(message) | cadence::store::Error::Conflict(message) = &error
        && let Some(diagnostic) = message.strip_prefix("plan-refusal:")
    {
        let diagnostic: model::Diagnostic = serde_json::from_str(diagnostic)?;
        return Ok(diagnostic.answer());
    }
    match error {
        cadence::store::Error::Io(_) | cadence::store::Error::Closed => Err(error),
        _ => Ok(model::refused(
            if error.to_string().contains("evidence-map-section") {
                "evidence-map-section"
            } else if error.to_string().contains("evidence-map-mode") {
                "evidence-map-mode"
            } else if error.to_string().contains("request-id-reuse") {
                "request-id-reuse"
            } else if error.to_string().contains("replacement-authorization") {
                "replacement-authorization"
            } else if error.to_string().contains("stale-target") {
                "stale-target"
            } else if error.to_string().contains("admitted-plan") {
                "admitted-plan"
            } else if error.to_string().contains("legacy-read-only") {
                "legacy-read-only"
            } else if error.to_string().contains("path-confinement") {
                "path-confinement"
            } else if error.to_string().contains("number-exhaustion") {
                "number-exhaustion"
            } else if error.to_string().contains("inventory precondition changed")
                || error.to_string().contains("allocation target changed")
                || error
                    .to_string()
                    .contains("conditional snapshot precondition changed")
            {
                "allocation-conflict"
            } else {
                "publication"
            },
            error.to_string(),
        )),
    }
}
