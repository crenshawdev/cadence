//! The capture operation (D-144): one typed item appended to the journal with
//! its kind and its declared phase, the bound reported on every receipt and
//! never enforced, and not one document byte written.
use crate::{config::reload::ConfigIo, import::SessionFactory};
use cadence::{
    capture::{self, Kind},
    envelope::Refusal,
    store::{Error, Result, model::ItemRecord, writer::Operation},
};
use schemars::JsonSchema;
use serde::Deserialize;
use serde_json::{Value, json};
use std::path::Path;

pub const RULE: &str = capture::RULE;

#[derive(Clone, Debug, Deserialize, JsonSchema)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum Apply {
    #[serde(rename = "capture")]
    Capture {
        request_id: String,
        kind: Kind,
        text: String,
        #[serde(default)]
        phase: Option<u32>,
    },
}

fn refuse(reason: impl Into<String>, slot: &str) -> Refusal {
    Refusal::new(RULE, reason).rule(RULE).slot(slot)
}

/// A request the typed shape did not accept. The slot the caller got wrong is
/// named the way an accepted request's refusals name theirs, so a malformed
/// kind reads like a rejected kind rather than a parser error.
pub fn malformed(raw: &Value, error: serde_json::Error) -> Value {
    if !raw["kind"].as_str().is_some_and(|kind| Kind::words().contains(&kind)) {
        return refuse(format!("kind is one of {}", Kind::words().join(", ")), "kind").value();
    }
    if !raw["text"].is_string() {
        return refuse("text is a string", "text").value();
    }
    if raw.get("phase").is_some_and(|phase| !phase.as_u64().is_some_and(|n| n > 0 && u32::try_from(n).is_ok())) {
        return refuse("positive integer phase required", "phase").value();
    }
    refuse(error.to_string(), "arguments").value()
}

/// The receipt for one captured item: the record itself, and the capture
/// report as it stood when that record landed. The report is a function of the
/// journal up to and including the item, so a replay answers what the first
/// call answered instead of what is true now.
fn receipt(items: &[ItemRecord], id: &str, bound: u64, replayed: bool) -> Result<Value> {
    let index = items
        .iter()
        .position(|item| item.id == id)
        .ok_or_else(|| Error::Invalid("captured item absent from its own journal".into()))?;
    let report = crate::config::capture_report(&items[..=index], bound);
    Ok(json!({"status":"ok","replayed":replayed,"item":items[index],
        "captures":{"active":report.active,"bound":report.bound,"exceeded":report.exceeded}}))
}

pub async fn execute<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    root: &Path,
    apply: Apply,
) -> Result<Value> {
    let Apply::Capture { request_id, kind, text, phase } = apply;
    if request_id.trim().is_empty() {
        return Ok(refuse("request_id is blank", "request_id").value());
    }
    if let Some(reason) = capture::text_refusal(&text) {
        return Ok(refuse(reason, "text").value());
    }
    if phase.is_some() && !kind.takes_phase() {
        return Ok(refuse(format!("a {} is about no phase", kind.word()), "phase").value());
    }
    let session = factory.first_touch(root).await?;
    // A phase the roadmap does not declare is refused by its own address, so
    // the owner can see which number was wrong.
    if let Some(phase) = phase {
        let identity = crate::config::reload::identity(root)?;
        let mut io = factory.io();
        let (observed, _guards) = crate::import::observe_documents(&identity, &mut io)?;
        let declared = match observed.declarations.as_ref().and_then(|d| d.as_ref().ok()) {
            Some(parsed) => parsed.phases.iter().any(|row| row.id.address() == phase.to_string()),
            None => false,
        };
        if !declared {
            return Ok(refuse(format!("ROADMAP.md declares no phase {phase}"), "phase")
                .phase(phase)
                .id(phase.to_string())
                .value());
        }
    }
    let bound = session.capture_report().await?.bound;
    let record = capture::record(&request_id, kind, &text, phase);
    let view = session.review_store().request(Operation::Read).await?;
    if view.items.iter().any(|item| item.id == record.id) {
        return receipt(&view.items, &record.id, bound, true);
    }
    let id = record.id.clone();
    let written = session.review_store().request(Operation::AppendItem(record)).await?;
    receipt(&written.items, &id, bound, false)
}
