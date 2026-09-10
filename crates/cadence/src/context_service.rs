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
    factory: &crate::import::SessionFactory<I>, root: &Path, command: Command,
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
            if let Some(refusal) = cadence::context::validation::validate(&raw) {
                return Ok(refusal);
            }
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
                use cadence::context::{persistence, render};
                use cadence::store::{Error, transaction::{Transaction, ExternalChange}, writer::Operation};
                let context = persistence::approved(submission, approval)?;
                let phase = context.submission.phase.get();
                // This is the approval barrier. Intake, declines and drafts
                // cannot reach first_touch, recovery, directory creation or policy writes.
                let session = factory.first_touch(root).await?;
                let store = session.review_store();
                let view = store.request(Operation::ReadVerified).await?;
                let proposed = persistence::contribute(&view.snapshot.data, &context)?;
                let (reply, receive) = tokio::sync::oneshot::channel();
                store.request(Operation::ObserveContext { phase, reply }).await?;
                let expected = receive.await.map_err(|_| Error::Closed)??;
                let transaction = Transaction {
                    id: format!("context:{}", cadence::store::model::digest(&serde_json::to_vec(&context)?)),
                    items: vec![], decisions: vec![], snapshot: Some(proposed),
                    external: vec![ExternalChange { target: format!("phase-context:{phase}"), expected, bytes: render::document(&context).into_bytes() }],
                };
                store.request(Operation::CompareTransact { expected_generation: view.snapshot.generation, expected_integrity: view.snapshot.integrity, transaction }).await?;
                return Ok(model::ok("context-submit", json!({"phase":phase,"persisted":true})));
            }
            Ok(model::ok("context-submit", json!({"phase":submission.phase,"persisted":false,"validation":"draft"})))
        }
    }
}
