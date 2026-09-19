//! The owner's explicit adoption of one ticked phase (D-137). The caller
//! names a phase and a request id and nothing else: the record is computed
//! from the documents through the import's own reader, lands under the
//! adoption namespace through its own intent with the provenance
//! `declared-at-adoption`, and a replay answers from the retained receipt.
use crate::{config::reload::ConfigIo, import::SessionFactory};
use cadence::{
    adoption, derivation::{self, LifecycleStatus}, envelope::Refusal, progress,
    store::{Error, Result, writer::Operation}, verification::completion,
};
use schemars::JsonSchema;
use serde::Deserialize;
use serde_json::{Value, json};
use std::{num::NonZeroU32, path::Path};

pub const RULE: &str = "adoption-declare";

#[derive(Clone, Debug, Deserialize, JsonSchema)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum Apply {
    #[serde(rename = "adoption-declare")]
    Declare { phase: NonZeroU32, request_id: String },
}

/// A request the typed shape did not accept. A phase that is not a canonical
/// positive integer is refused the way every phase-taking operation refuses
/// it; anything else names the arguments.
pub fn malformed(raw: &Value, error: serde_json::Error) -> Value {
    let canonical = raw["phase"].as_u64().is_some_and(|n| n > 0 && u32::try_from(n).is_ok());
    if !canonical {
        return Refusal::new("invalid-phase", "positive integer phase required").rule(RULE).slot("phase").value();
    }
    Refusal::new("invalid-arguments", error.to_string()).rule(RULE).slot("arguments").value()
}

fn refuse(rule: &str, reason: String, phase: u32) -> Refusal {
    Refusal::new(rule, reason).rule(rule).slot("phase").phase(phase)
}

pub async fn execute<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>, root: &Path, apply: Apply,
) -> Result<Value> {
    let Apply::Declare { phase, request_id } = apply;
    let phase = phase.get();
    if request_id.trim().is_empty() {
        return Ok(Refusal::new("invalid-arguments", "request_id is blank").rule(RULE).slot("request_id").phase(phase).value());
    }
    let session = factory.first_touch(root).await?;
    session.config()?;
    let view = session.derivation_view().await?;
    let data = &view.snapshot.data;
    if let Some(receipt) = adoption::receipt(data, &request_id)? {
        return answer(data, phase, &request_id, receipt, true);
    }
    let root = crate::config::reload::identity(root)?;
    let mut io = factory.io();
    let (capture, _guards) = crate::import::observe_documents(&root, &mut io)?;
    let legacy = match derivation::derive(&capture) {
        Ok(legacy) => legacy,
        Err(error) => return Ok(Refusal::new(error.code(), error.to_string()).rule(RULE).slot("roadmap").phase(phase).value()),
    };
    let Some(Ok(parsed)) = &capture.declarations else {
        return Err(Error::Invalid("derived lifecycle without parsed declarations".into()));
    };
    let Some(row) = parsed.phases.iter().find(|row| row.id.address() == phase.to_string()) else {
        return Ok(refuse("declaration-unknown-phase", format!("ROADMAP.md declares no phase {phase}"), phase).value());
    };
    // D-137's three refusals, each naming what it found: the native completion
    // that already decides, the roadmap line that is not ticked, or the derived
    // status the documents already reach. Native authority answers first, since
    // a phase completed through verification is never ticked by hand.
    if let Some((completion, _, _)) = completion::applicable(data, phase)? {
        return Ok(refuse("declaration-native", format!("phase {phase} is completed natively by {}", completion.id), phase)
            .id(completion.id).value());
    }
    if !row.checked {
        return Ok(refuse("declaration-unticked", format!("ROADMAP.md:{} does not tick phase {phase}", row.source_line), phase)
            .entry(row.ordinal).id(format!("ROADMAP.md:{}", row.source_line)).value());
    }
    let overlay = derivation::acceptance_overlay(data).map_err(|error| Error::Invalid(error.to_string()))?;
    let derived = derivation::derive_with(&capture, &overlay).map_err(|error| Error::Invalid(error.to_string()))?;
    if let Some(record) = derived.phases.iter().find(|p| p.id.address() == phase.to_string())
        && record.status == LifecycleStatus::Complete
    {
        let status = progress::render::status(record.status);
        return Ok(refuse("declaration-unneeded", format!("the documents already derive phase {phase} {status}"), phase)
            .id(status).value());
    }
    let declaration = adoption::declarations(&capture, &legacy, data)?.into_iter().find(|d| d.phase == phase)
        .ok_or_else(|| Error::Invalid("declaration absent for a ticked phase the documents derive short of complete".into()))?;
    let root_binding = cadence::verification::inputs::root_binding(&root)?;
    let generation = view.snapshot.generation.checked_add(1).ok_or_else(|| Error::Invalid("generation overflow".into()))?;
    let record = adoption::record(&root_binding, &declaration, adoption::AT_ADOPTION, generation,
        &session.import_manifest().source_generation)?;
    let written = session.review_store().request(Operation::AdoptionDeclareV1 {
        expected_generation: view.snapshot.generation, expected_integrity: view.snapshot.integrity.clone(),
        record: Box::new(record), request_id: request_id.clone(),
    }).await;
    match written {
        Ok(written) => {
            let receipt = adoption::receipt(&written.snapshot.data, &request_id)?
                .ok_or_else(|| Error::Invalid("confirmed adoption receipt absent".into()))?;
            answer(&written.snapshot.data, phase, &request_id, receipt, false)
        }
        Err(Error::Conflict(message)) if message.starts_with("request-id-reuse") => {
            Ok(Refusal::new("request-id-reuse", message).rule(RULE).slot("request_id").phase(phase).value())
        }
        Err(Error::Conflict(message)) => Ok(Refusal::new("inputs-changed", message).rule(RULE).slot("phase").phase(phase).value()),
        Err(error) => Err(error),
    }
}

fn answer(data: &Value, phase: u32, request_id: &str, receipt: adoption::Receipt, replayed: bool) -> Result<Value> {
    if receipt.phase != phase {
        return Ok(Refusal::new("request-id-reuse", format!("request {request_id} already declared phase {}", receipt.phase))
            .rule(RULE).slot("request_id").phase(phase).value());
    }
    let record = adoption::records(data)?.into_iter().find(|r| r.id == receipt.record)
        .ok_or_else(|| Error::Invalid("declared record absent for its receipt".into()))?;
    Ok(json!({"status":"ok","replayed":replayed,"phase":phase,"record":record}))
}
