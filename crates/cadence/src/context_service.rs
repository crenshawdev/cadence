//! Intake and drafts never open a session or acquire a writer.
use cadence::context::model::{self, Answer, Apply};
use cadence::store::Result;
use serde_json::{Value, json};
use std::path::Path;

pub enum Command {
    Intake(u32),
    Apply(Value),
}

fn read_optional(path: &Path) -> Result<Option<String>> {
    match std::fs::read_to_string(path) {
        Ok(text) => Ok(Some(text)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.into()),
    }
}

pub async fn execute<I: crate::config::reload::ConfigIo + Clone + Sync>(
    _factory: &crate::import::SessionFactory<I>, root: &Path, command: Command,
) -> Result<Answer> {
    match command {
        Command::Intake(phase) => Ok(model::ok("context-intake", json!({
            "phase":phase,
            "context":read_optional(&root.join(format!("phases/{phase}/CONTEXT.md")))?,
            "roadmap":read_optional(&root.join("ROADMAP.md"))?,
            "contract":schemars::schema_for!(Apply),
            "persisted":false
        }))),
        Command::Apply(raw) => {
            let Apply::Submit { submission, approval } = match serde_json::from_value(raw) {
                Ok(value) => value,
                Err(error) => return Ok(model::refused("submission", "submission", error.to_string(), None, None, None)),
            };
            if let Some(approval) = approval.filter(|value| value.approved) {
                if approval.owner.as_ref().is_none_or(|s| s.trim().is_empty())
                    || approval.at.as_ref().is_none_or(|s| s.trim().is_empty())
                    || approval.submission.as_ref() != Some(&submission)
                {
                    return Ok(model::refused("exact-set-approval", "approval", "approval needs owner, time and the exact complete submission", Some(submission.phase.get()), None, None));
                }
                return Ok(model::refused("publication-unavailable", "approval", "approved publication is not available", Some(submission.phase.get()), None, None));
            }
            Ok(model::ok("context-submit", json!({"phase":submission.phase,"persisted":false,"validation":"draft"})))
        }
    }
}
