//! Recover consumer inputs from one authoritative H1–H4 snapshot.
use super::model::{
    Acceptance, Admission, Attempt, AttemptState, DeliveryState, Finding, Manifest, Original,
};
use super::{originals, persistence};
use cadence::store::writer::Store;
use cadence::store::{Error, Result};
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum InputKind {
    Raw,
    Pending,
    Interrupted,
    Failed,
    Unverified,
}
#[derive(Debug, Serialize)]
pub struct RawIdentity {
    pub kind: InputKind,
    pub fire: String,
    pub round: u64,
    pub original: Option<String>,
    pub finding_ids: Vec<String>,
}
#[derive(Debug, Serialize)]
pub struct ReviewInput {
    pub identity: RawIdentity,
    pub revision: u64,
    pub delivery: DeliveryState,
    pub findings: Option<Vec<Finding>>,
    pub admission: Admission,
    pub manifest: Manifest,
    pub attempt: Attempt,
    pub original: Option<Original>,
}

async fn saved_input(store: &Store, id: &str) -> Result<ReviewInput> {
    let view = persistence::read(store).await?;
    let records = persistence::records(&view.snapshot.data)?;
    let attempt: Attempt = persistence::get(&records, "attempts", id)?;
    let admission: Admission = persistence::get(&records, "admissions", &attempt.fire)?;
    let manifest: Manifest = persistence::get(&records, "manifests", &admission.artifact)?;
    if attempt.attempt != id
        || admission.fire != attempt.fire
        || admission.round != attempt.round
        || admission.home.occurrence != attempt.occurrence
        || manifest.fire != admission.fire
        || manifest.manifest != admission.artifact
        || attempt.view.manifest != manifest.manifest
    {
        return Err(Error::Conflict("consumer identity mismatch".into()));
    }
    let original = attempt
        .original
        .as_deref()
        .map(|id| originals::saved_original(&records, id))
        .transpose()?;
    if let Some(original) = &original
        && (original.attempt.as_deref() != Some(id)
            || original.artifact.as_deref() != Some(&manifest.manifest)
            || original.view.as_deref() != Some(&attempt.view.view)
            || original.host_return != attempt.host_return)
    {
        return Err(Error::Conflict("consumer original binding mismatch".into()));
    }
    let findings = original.as_ref().and_then(|o| {
        if o.acceptance == Acceptance::Accepted {
            o.parsed.as_ref().map(|parsed| parsed.findings.clone())
        } else {
            None
        }
    });
    let (kind, delivery) = match attempt.state {
        AttemptState::Accepted => match &findings {
            Some(values) if values.is_empty() => (InputKind::Raw, DeliveryState::AcceptedEmpty),
            Some(_) => (InputKind::Raw, DeliveryState::Accepted),
            None => (InputKind::Unverified, DeliveryState::Interrupted),
        },
        AttemptState::Failed | AttemptState::NotSelected => {
            (InputKind::Failed, DeliveryState::Failed)
        }
        AttemptState::Interrupted | AttemptState::Uncertain => {
            (InputKind::Interrupted, DeliveryState::Interrupted)
        }
        _ => (InputKind::Pending, DeliveryState::Pending),
    };
    let finding_ids = findings
        .as_ref()
        .map(|values| {
            values
                .iter()
                .enumerate()
                .map(|(index, _)| {
                    format!(
                        "{}:{index}",
                        attempt.original.as_deref().unwrap_or_default()
                    )
                })
                .collect()
        })
        .unwrap_or_default();
    Ok(ReviewInput {
        identity: RawIdentity {
            kind,
            fire: admission.fire.clone(),
            round: admission.round,
            original: attempt.original.clone(),
            finding_ids,
        },
        revision: 1,
        delivery,
        findings,
        admission,
        manifest,
        attempt,
        original,
    })
}

pub async fn plan_completion_input(store: &Store, attempt: &str) -> Result<ReviewInput> {
    saved_input(store, attempt).await
}
pub async fn execute_completion_input(store: &Store, attempt: &str) -> Result<ReviewInput> {
    saved_input(store, attempt).await
}
pub async fn report_review_input(store: &Store, attempt: &str) -> Result<ReviewInput> {
    saved_input(store, attempt).await
}
pub async fn deferred_enqueue_input(store: &Store, attempt: &str) -> Result<ReviewInput> {
    saved_input(store, attempt).await
}
pub async fn read_specialist_result(store: &Store, attempt: &str) -> Result<ReviewInput> {
    let input = saved_input(store, attempt).await?;
    if input.admission.specialist.is_none() {
        return Err(Error::Invalid("not a specialist review".into()));
    }
    Ok(input)
}

#[derive(Debug, Serialize)]
pub struct CompletionState {
    pub state: DeliveryState,
    pub findings: Option<Vec<Finding>>,
}
/// Delivery is supplied, not inferred from missing renderings or finding count.
pub fn completion_review_state(
    state: DeliveryState,
    findings: Option<Vec<Finding>>,
) -> CompletionState {
    match state {
        DeliveryState::AcceptedEmpty => CompletionState {
            state: DeliveryState::Accepted,
            findings: Some(vec![]),
        },
        DeliveryState::Accepted | DeliveryState::UsableComplete => {
            CompletionState { state, findings }
        }
        _ => CompletionState {
            state,
            findings: None,
        },
    }
}
