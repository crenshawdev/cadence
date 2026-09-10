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
    Read { phase: String, count: Option<u32> },
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
        Command::Read { phase, count } => {
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
                    json!({"persisted":true,"results":results}),
                )),
                Err(error) => path_error(error),
            }
        }
    }
}

fn path_error(error: cadence::store::Error) -> Result<Answer> {
    match error {
        cadence::store::Error::Io(_) | cadence::store::Error::Closed => Err(error),
        _ => Ok(model::refused(
            if error.to_string().contains("replacement-authorization") {
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
