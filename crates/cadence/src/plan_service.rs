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
    _factory: &crate::import::SessionFactory<I>,
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
                json!({"phase":phase,"persisted":false,
                "inventory":inventory,"targets":targets,"occurrence":occurrence,
                "native_truths_approved":approved,"next":if approved {"plan-submit"} else {"context-intake"},
                "native":saved,"legacy_readiness":"legacy-input","readiness":"provisional-authoring",
                "contract":model::contract()}),
            ))
        }
        Command::Apply(raw) => {
            let Apply::Submit {
                submission,
                approval,
            } = match serde_json::from_value(raw) {
                Ok(value) => value,
                Err(error) => return Ok(model::refused("submission", error.to_string())),
            };
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
            Ok(model::refused(
                "publication-unavailable",
                "approved plan publication is not yet enabled",
            ))
        }
    }
}
