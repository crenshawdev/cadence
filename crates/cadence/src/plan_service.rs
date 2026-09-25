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
    EvidenceRead { phase: u32 },
    Read { phase: String, count: Option<u32>, submission: Option<Box<model::Submission>> },
    Apply(Value),
}

pub async fn execute<I: crate::config::reload::ConfigIo + Clone + Sync>(
    factory: &crate::import::SessionFactory<I>,
    root: &Path,
    command: Command,
) -> Result<Answer> {
    if let Command::EvidenceRead { phase } = command {
        return cadence::plan::map_view::read(root, phase);
    }
    let observed = persistence::read_snapshot(root)?;
    let empty = json!({});
    let data = observed.as_ref().map(|s| &s.data).unwrap_or(&empty);
    match command {
        Command::EvidenceRead { .. } => unreachable!("evidence read observes its own inputs"),
        Command::Read { phase, count, submission } => {
            if let Some(submission) = submission {
                if count.is_some() || submission.phase.to_string() != phase {
                    return Ok(model::refused("preview-scope", "complete submission must match phase and cannot accompany count"));
                }
                return match complete_preview(root, data, *submission) {
                    Ok(answer) => Ok(answer),
                    Err(error) => path_error(error),
                };
            }
            let inventory = match inventory::read(root, &phase, data) {
                Ok(value) => value,
                Err(error) => return Ok(model::refused("inventory", error.to_string())),
            };
            let native = phase
                .parse::<std::num::NonZeroU32>()
                .ok()
                .filter(|n| n.to_string() == phase);
            let approved = native
                .map(|n| cadence::context::persistence::saved(data, n.get()))
                .transpose()?
                .flatten()
                .is_some();
            let saved = native
                .map(|n| persistence::saved(data, n.get()))
                .transpose()?
                .flatten();
            let occurrence = native
                .map(|n| persistence::occurrence(data, n.get()))
                .transpose()?;
            let map_history = native.map(|n| cadence::plan::map_history::view(data, n.get()))
                .transpose()?.unwrap_or_default();
            let plans = inventory.occupied.iter().filter_map(|number| {
                let canonical = format!("phases/{phase}/PLAN-{number}.md");
                let bare = format!("phases/{phase}/PLAN.md");
                let document = inventory.documents.get(&canonical).or_else(|| {
                    if *number == 1 { inventory.documents.get(&bare) } else { None }
                })?;
                let publication = saved.as_ref().and_then(|o| o.publications.get(number));
                let identity = native.map_or(Value::Null, |phase| {
                    json!({"kind":"phase-plan","phase":phase,"plan":number})
                });
                Some(json!({"identity":identity,
                    "classification":if publication.is_some() {"native-publication"} else {"legacy-input"},
                    "revision":publication.map(|value| value.revision.clone())
                        .unwrap_or_else(|| cadence::store::model::digest(document.as_bytes())),
                    "map_revision":publication.and_then(|value| value.map_revision.clone()),
                    "occurrence":publication.map(|value| value.occurrence.clone()),
                    "publication_request":publication.and_then(|value| value.approval.submission.as_ref())
                        .map(|submission| submission.request_id.clone()),
                    "tasks":publication.map(|value| &value.content.execution.tasks)}))
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
            let inventory = json!({"occupied":inventory.occupied,"high_water":inventory.high_water,
                "basis":inventory.basis});
            let native = saved.as_ref().map(|saved| {
                let publications = saved.publications.iter().map(|(number, publication)| {
                    (number.to_string(), json!({"identity":{"kind":"phase-plan","phase":publication.identity.phase,
                        "plan":publication.identity.plan},"occurrence":publication.occurrence,
                        "revision":publication.revision,"map_revision":publication.map_revision,
                        "readiness":publication.readiness,
                        "publication_request":publication.approval.submission.as_ref().map(|submission| &submission.request_id),
                        "tasks":publication.content.execution.tasks}))
                }).collect::<serde_json::Map<_, _>>();
                json!({"id":saved.id,"phase":saved.phase,"cycle":saved.cycle,
                    "high_water":saved.high_water,"consumed":saved.consumed,"publications":publications})
            });
            Ok(model::ok(
                "plan-read",
                json!({"phase":phase,"persisted":false,"plans":plans,
                "inventory":inventory,"targets":targets,"occurrence":occurrence,
                "native_truths_approved":approved,"next":if approved {"plan-submit"} else {"context-intake"},
                "native":native,"map_history":map_history,"legacy_readiness":"legacy-input","readiness":"provisional-authoring",
                "contract":model::contract()}),
            ))
        }
        Command::Apply(raw) => {
            if let Some(refusal) = cadence::plan::validation::arguments(&raw) {
                return Ok(refusal);
            }
            if let Some(refusal) = cadence::plan::associations::malformed_version(&raw) {
                return Ok(refusal.answer());
            }
            if let Some(refusal) = cadence::plan::limits::malformed(&raw) {
                return Ok(refusal.answer());
            }
            // The typed-content rule waits for the replay check below: a request
            // acknowledged before phase 32 carries a body and answers its receipt.
            let typed_refusal = cadence::plan::validation::typed_content(&raw);
            let Apply::Submit {
                phase,
                submission,
                approval,
            } = match serde_json::from_value(raw) {
                Ok(value) => value,
                Err(error) => return Ok(model::refused("submission", error.to_string())),
            };
            let held = if submission.is_none() || approval.as_ref().is_some_and(|value|
                value.approved && value.submission_digest.is_some()) {
                let Some(phase) = phase.or_else(|| submission.as_ref().map(|value| value.phase)) else {
                    return Ok(model::refused("submission", "digest approval needs phase"));
                };
                let Some(digest) = approval.as_ref().and_then(|value| value.submission_digest.as_ref()) else {
                    return Ok(model::refused("submission", "missing submission needs approval.submission_digest"));
                };
                let drafts = cadence::import::drafts(root)?;
                let drafts = drafts.lock()
                    .map_err(|_| cadence::store::Error::Invalid("drafts unavailable".into()))?;
                let held = drafts.plans.get(&(phase.get(), digest.clone()));
                if let Some(held) = held {
                    if approval.as_ref().is_some_and(|value| value.approved)
                        && let Some(newest_digest) = drafts.newest_plan.get(&phase.get()).filter(|newest| *newest != digest)
                        && let Some(newest) = drafts.plans.get(&(phase.get(), newest_digest.clone()))
                    {
                        let targets = newest.submission.plans.iter().chain(&held.submission.plans)
                            .map(|entry| entry.target.plan).collect::<std::collections::BTreeSet<_>>();
                        for plan in &targets {
                            let current = newest.submission.plans.iter().zip(&newest.documents)
                                .find(|(entry, _)| entry.target.plan == *plan).map(|(_, document)| document);
                            let previous = held.submission.plans.iter().zip(&held.documents)
                                .find(|(entry, _)| entry.target.plan == *plan).map(|(_, document)| document);
                            let part = match (current, previous) {
                                (Some(current), Some(previous)) => current.first_difference(previous),
                                (Some(document), None) | (None, Some(document)) =>
                                    document.parts.first().map(|part| part.selector.clone()),
                                (None, None) => None,
                            };
                            if part.is_some() {
                                return Ok(Answer::DraftRefused { code: "stale-draft".into(),
                                    identity: json!({"kind":"plan-draft","phase":phase,
                                        "plan":plan,"digest":newest_digest}), part });
                            }
                        }
                        // Submission metadata can change without changing any rendered part.
                        return Ok(Answer::DraftRefused { code: "stale-draft".into(),
                            identity: newest.documents.first().map_or_else(
                                || json!({"kind":"phase-plan","phase":phase}),
                                |document| json!(document.identity)), part: None });
                    }
                } else if submission.is_none() {
                    return Ok(Answer::DraftRefused { code: "unknown-draft".into(),
                        identity: json!({"kind":"phase-plan","phase":phase}), part: None });
                }
                held.cloned()
            } else { None };
            let Some(submission) = submission.or_else(|| held.as_ref().map(|draft| draft.submission.clone())) else {
                return Ok(model::refused("unknown-draft", "held plan draft is absent"));
            };
            if phase.is_some_and(|phase| phase != submission.phase) {
                return Ok(model::refused("submission", "phase must match submission.phase"));
            }
            let approval = match approval.map(|a| persistence::bound(data, &submission, a)).transpose() {
                Ok(value) => value,
                Err(error) => return path_error(error),
            };
            match persistence::replay(data, &submission, approval.as_ref()) {
                Ok(Some(receipt)) => return replay_answer(root, data, receipt),
                Ok(None) => {}
                Err(error) => return path_error(error),
            }
            if let Some(refusal) = typed_refusal {
                return Ok(refusal);
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
            let inventory = match inventory::read(root, &submission.phase.to_string(), data) {
                Ok(value) => value,
                Err(error) => return Ok(model::refused("inventory", error.to_string())),
            };
            if let Err(error) = cadence::plan::validation::replacement(data, &submission, approval.as_ref(), &inventory) {
                return path_error(error);
            }
            let Some(approval) = approval.filter(|a| a.approved) else {
                // A draft is a digest, not a validated candidate: the complete
                // preview and the approved publication validate the union.
                hold(root, data, &submission)?;
                return Ok(model::ok(
                    "plan-submit",
                    json!({"persisted":false,"validation":"draft",
                        "submission_digest":persistence::submission_digest(&submission)?,
                        "documents":documents(data, &submission)?}),
                ));
            };
            if approval.owner.as_ref().is_none_or(|s| s.trim().is_empty())
                || approval.at.as_ref().is_none_or(|s| s.trim().is_empty())
                || !persistence::binds(&submission, &approval)?
            {
                return Ok(model::refused(
                    "exact-submission-approval",
                    "approval needs owner, reported time and the exact submission, as a copy or as the submission_digest a draft answer reports",
                ));
            }
            if cadence::context::persistence::saved(data, submission.phase.get())?.is_none() {
                return Ok(model::Diagnostic {
                    details: None,
                    rule: "native-approved-truths".into(), slot: "submission.phase".into(),
                    phase: Some(submission.phase.get()), entry: None, id: None,
                    reason: format!("phase {} current native truth authority is absent; use context-intake and context-submit", submission.phase),
                }.answer());
            }
            if let Err(error) = persistence::contribute(data, &submission, &approval, &inventory) {
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
                    bytes: match held.as_ref().and_then(|draft| draft.documents.iter().find(|document|
                        matches!(&document.identity, cadence::read::model::DocumentIdentity::PlanDraft { plan, .. }
                            if *plan == result.identity.plan))) {
                        Some(document) => document.bytes(),
                        None => cadence::plan::render::document(&result.content)?,
                    },
                });
            }
            // Seed only the missing active requirement rows as Pending, in the
            // same confirmed transaction, against the exact observed preimage.
            let mut seeded = Vec::new();
            {
                use cadence::store::Storage;
                let expected = match cadence::store::filesystem::Filesystem::new(root)?.read("requirements") {
                    Ok(observed) => observed,
                    Err(error) => return path_error(error),
                };
                let declared = persistence::declared_requirements(&results);
                match cadence::verification::projections::seeded_requirements(expected.bytes.as_deref(), submission.phase.get(), &declared) {
                    Ok(Some((bytes, ids))) => {
                        seeded = ids;
                        external.push(cadence::store::transaction::ExternalChange { target: "requirements".into(), expected, bytes });
                    }
                    Ok(None) => {}
                    Err(error) => return path_error(error),
                }
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
                    json!({"persisted":true,"results":publication_answers(&results)?,"coverage":coverage,"requirements":{"seeded":seeded}}),
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

fn documents(data: &Value, submission: &model::Submission) -> Result<Vec<Value>> {
    submission.plans.iter().map(|entry| {
        let bytes = persistence::rendered_document(data, &entry.content)?;
        Ok(json!({"identity":entry.target,"revision":cadence::store::model::digest(&bytes)}))
    }).collect()
}

fn publication_answers(publications: &[model::Publication]) -> Result<Vec<Value>> {
    publications.iter().map(|publication| {
        let mut answer = json!({
            "identity":publication.identity, "revision":publication.revision,
            "readiness":publication.readiness,
            "content_digest":cadence::store::model::digest(&serde_json::to_vec(&publication.content)?),
        });
        if let Some(revision) = &publication.map_revision {
            answer["map_revision"] = json!(revision);
        }
        Ok(answer)
    }).collect()
}

fn hold(root: &Path, data: &Value, submission: &model::Submission) -> Result<()> {
    let digest = persistence::submission_digest(submission)?;
    let documents = submission.plans.iter().map(|entry|
        cadence::read::document::plan_draft(data, &entry.content, &digest)).collect::<Result<Vec<_>>>()?;
    let drafts = cadence::import::drafts(root)?;
    let mut drafts = drafts.lock()
        .map_err(|_| cadence::store::Error::Invalid("drafts unavailable".into()))?;
    drafts.plans.insert((submission.phase.get(), digest.clone()), cadence::import::PlanDraft {
        submission: submission.clone(), documents,
    });
    drafts.newest_plan.insert(submission.phase.get(), digest);
    Ok(())
}

fn complete_preview(root: &Path, data: &Value, submission: model::Submission) -> Result<Answer> {
    use cadence::plan::validation;
    let inventory = inventory::read(root, &submission.phase.to_string(), data)?;
    for entry in &submission.plans {
        cadence::store::filesystem::validate_plan_path(root, entry.target.phase.get(), entry.target.plan.get())?;
        if let Some(replacement) = &entry.replacement
            && replacement.content != entry.content
        {
            return Ok(model::refused("replacement-authorization", "replacement must name the same proposed content"));
        }
    }
    validation::replacement_preview(data, &submission, &inventory)?;
    persistence::validate_candidate(data, &submission, &inventory)?;
    let coverage = cadence::plan::associations::validate(data, &submission)?;
    hold(root, data, &submission)?;
    Ok(model::ok("plan-read", json!({"persisted":false,
        "submission_digest":persistence::submission_digest(&submission)?,"documents":documents(data, &submission)?,
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
        "payload_digest":receipt.payload_digest,"results":publication_answers(&receipt.results)?,"projections":projections})))
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
