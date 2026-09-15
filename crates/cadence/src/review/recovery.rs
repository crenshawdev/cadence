//! Recovery records uncertainty; absence never becomes an empty successful voice.
use super::io::Clock;
use super::model::{Admission, Attempt, AttemptState, DeliveryState, Finding};
use super::{originals, persistence};
use cadence::store::writer::Store;
use cadence::store::{Error, Result};
use serde::Serialize;
use std::collections::BTreeMap;

#[derive(Debug, Serialize)]
pub struct RecoveredAttempt {
    pub attempt: String,
    pub delivery: DeliveryState,
    pub original: Option<String>,
}
fn recovered(attempt: Attempt) -> RecoveredAttempt {
    let delivery = match attempt.state {
        AttemptState::Accepted => DeliveryState::Accepted,
        AttemptState::Failed | AttemptState::NotSelected => DeliveryState::Failed,
        _ => DeliveryState::Interrupted,
    };
    RecoveredAttempt {
        attempt: attempt.attempt,
        delivery,
        original: attempt.original,
    }
}

pub async fn recover_attempt(
    store: &Store,
    id: &str,
    clock: &mut impl Clock,
) -> Result<RecoveredAttempt> {
    let view = persistence::read(store).await?;
    let mut records = persistence::records(&view.snapshot.data)?;
    let mut attempt: Attempt = persistence::get(&records, "attempts", id)?;
    if attempt.original.is_some()
        || matches!(
            attempt.state,
            AttemptState::Failed | AttemptState::NotSelected | AttemptState::Interrupted
        )
    {
        return Ok(recovered(attempt));
    }
    if attempt.state == AttemptState::Accepted {
        return Err(Error::Conflict("accepted attempt lacks original".into()));
    }
    attempt.state = AttemptState::Interrupted;
    persistence::put(&mut records, "attempts", id, &attempt)?;
    persistence::insert(&mut records, "recovered_at", id, &clock.now())?;
    match persistence::update(store, &view, &format!("recover:{id}"), records).await {
        Ok(_) => Ok(recovered(attempt)),
        Err(Error::Conflict(_)) => {
            let winner = persistence::read(store).await?;
            let saved: Attempt = persistence::get(
                &persistence::records(&winner.snapshot.data)?,
                "attempts",
                id,
            )?;
            if saved.state == AttemptState::Interrupted
                || saved.original.is_some()
                || saved.state == AttemptState::Failed
            {
                Ok(recovered(saved))
            } else {
                Err(Error::Conflict("attempt changed during recovery".into()))
            }
        }
        Err(error) => Err(error),
    }
}

/// Reconstruct the exact saved finding array without consulting a rendering.
pub async fn recover_original(store: &Store, id: &str) -> Result<Option<Vec<Finding>>> {
    let view = persistence::read(store).await?;
    let original = originals::saved_original(&persistence::records(&view.snapshot.data)?, id)?;
    Ok(original.parsed.map(|parsed| parsed.findings))
}

#[derive(Debug, Serialize)]
pub struct RecoveredRoster {
    pub required: Vec<String>,
    pub pending: Vec<String>,
}
pub async fn read_roster(store: &Store, fire: &str) -> Result<RecoveredRoster> {
    let view = persistence::read(store).await?;
    let records = persistence::records(&view.snapshot.data)?;
    let admission: Admission = persistence::get(&records, "admissions", fire)?;
    let attempts: BTreeMap<String, Attempt> = records
        .get("attempts")
        .cloned()
        .map(serde_json::from_value)
        .transpose()?
        .unwrap_or_default();
    let pending = admission
        .roster
        .required
        .iter()
        .filter(|slot| {
            let saved: Vec<_> = attempts
                .values()
                .filter(|attempt| attempt.fire == fire && &attempt.slot == *slot)
                .collect();
            saved.is_empty()
                || saved.iter().any(|attempt| {
                    !matches!(
                        attempt.state,
                        AttemptState::Accepted | AttemptState::Failed | AttemptState::NotSelected
                    )
                })
        })
        .cloned()
        .collect();
    Ok(RecoveredRoster {
        required: admission.roster.required,
        pending,
    })
}
