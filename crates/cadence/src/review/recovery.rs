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

/// What recovering an attempt does, decided over one snapshot's records.
#[derive(Debug)]
pub enum Recovery {
    /// Nothing to write: the attempt already has an original or an end.
    Settled(RecoveredAttempt),
    /// The attempt is marked interrupted: the records with that written, and
    /// the answer once they are committed.
    Interrupt { records: serde_json::Value, recovered: RecoveredAttempt },
}

/// An attempt with an original or an end stays as it is; one still in flight
/// becomes interrupted, never an empty success; an accepted attempt with no
/// original is a conflict. The clock is read only when writing.
pub fn decide_recovery(
    mut records: serde_json::Value,
    id: &str,
    clock: &mut impl Clock,
) -> Result<Recovery> {
    let mut attempt: Attempt = persistence::get(&records, "attempts", id)?;
    if attempt.original.is_some()
        || matches!(
            attempt.state,
            AttemptState::Failed | AttemptState::NotSelected | AttemptState::Interrupted
        )
    {
        return Ok(Recovery::Settled(recovered(attempt)));
    }
    if attempt.state == AttemptState::Accepted {
        return Err(Error::Conflict("accepted attempt lacks original".into()));
    }
    attempt.state = AttemptState::Interrupted;
    persistence::put(&mut records, "attempts", id, &attempt)?;
    persistence::insert(&mut records, "recovered_at", id, &clock.now())?;
    Ok(Recovery::Interrupt { records, recovered: recovered(attempt) })
}

pub async fn recover_attempt(
    store: &Store,
    id: &str,
    clock: &mut impl Clock,
) -> Result<RecoveredAttempt> {
    let view = persistence::read(store).await?;
    let records = persistence::records(&view.snapshot.data)?;
    let (records, answer) = match decide_recovery(records, id, clock)? {
        Recovery::Settled(recovered) => return Ok(recovered),
        Recovery::Interrupt { records, recovered } => (records, recovered),
    };
    match persistence::update(store, &view, &format!("recover:{id}"), records).await {
        Ok(_) => Ok(answer),
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
    roster(&persistence::records(&view.snapshot.data)?, fire)
}

/// The required slots of `fire`'s roster, and those still pending: a slot
/// with no attempt, or with any attempt that has not ended.
pub fn roster(records: &serde_json::Value, fire: &str) -> Result<RecoveredRoster> {
    let admission: Admission = persistence::get(records, "admissions", fire)?;
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
