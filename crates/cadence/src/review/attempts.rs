//! Saved H3 attempts, including requested identity and explicit unknown facts.
use super::model::Attempt;
use super::persistence;
use cadence::store::Result;
use cadence::store::writer::Store;

pub async fn read_attempt(store: &Store, attempt: &str) -> Result<Attempt> {
    persistence::get(
        &persistence::records(&persistence::read(store).await?.snapshot.data)?,
        "attempts",
        attempt,
    )
}

use super::binding::bind_host_return;
use super::io::Clock;
use super::model::{AttemptState, Observation, ObservationKind};
use cadence::store::Error;
use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Debug, Serialize)]
pub struct ObservationReceipt {
    pub attempt: Attempt,
    pub observation: String,
    pub replayed: bool,
    pub terminal_count: usize,
    pub durable_usage_observation_count: usize,
}

fn receipt(records: &Value, event: &Observation, replayed: bool) -> Result<ObservationReceipt> {
    let saved: Observation = persistence::get(records, "observations", &event.observation)?;
    if &saved != event {
        return Err(Error::Conflict("observation identity reused".into()));
    }
    let attempt: Attempt = persistence::get(records, "attempts", &event.attempt)?;
    let durable_usage_observation_count = records
        .get("observations")
        .and_then(Value::as_object)
        .map_or(0, |observations| {
            observations
                .values()
                .filter(|observation| {
                    observation["attempt"] == event.attempt
                        && ["input", "output", "cost"]
                            .iter()
                            .any(|field| !observation["usage"][field].is_null())
                })
                .count()
        });
    Ok(ObservationReceipt {
        terminal_count: persistence::terminal_count(records, &event.attempt),
        attempt,
        observation: event.observation.clone(),
        replayed,
        durable_usage_observation_count,
    })
}

fn merge<T: Clone + PartialEq>(
    saved: &mut Option<T>,
    observed: &Option<T>,
    field: &str,
) -> Result<()> {
    if let Some(observed) = observed {
        if saved.as_ref().is_some_and(|saved| saved != observed) {
            return Err(Error::Conflict(format!("conflicting observed {field}")));
        }
        *saved = Some(observed.clone());
    }
    Ok(())
}

/// Actual host events use binary-issued attempt IDs, never caller voice labels.
/// Late observations enrich the attempt but leave closure and originals intact.
pub async fn record_observation(
    store: &Store,
    event: Observation,
    clock: &mut impl Clock,
) -> Result<ObservationReceipt> {
    if event.kind == ObservationKind::LaunchFailure {
        return Err(Error::Invalid(
            "launch-failure-requires-return-identity".into(),
        ));
    }
    if event.observation.is_empty()
        || event.reference.is_empty()
        || event.reference.chars().count() > 4096
    {
        return Err(Error::Invalid(
            "invalid observation reference or identity".into(),
        ));
    }
    let view = persistence::read(store).await?;
    let mut records = persistence::records(&view.snapshot.data)?;
    if records
        .get("observations")
        .and_then(|values| values.get(&event.observation))
        .is_some()
    {
        return receipt(&records, &event, true);
    }
    let mut attempt: Attempt = persistence::get(&records, "attempts", &event.attempt)?;
    let bindings: BTreeMap<String, String> = records
        .get("host_returns")
        .cloned()
        .map(serde_json::from_value)
        .transpose()?
        .unwrap_or_default();
    if let Some(host_return) = &event.host_return {
        bind_host_return(&bindings, host_return, &event.attempt)
            .map_err(|error| Error::Conflict(serde_json::to_string(&error).unwrap_or_default()))?;
        persistence::insert(&mut records, "host_returns", host_return, &event.attempt)?;
    }
    if let Some(launch) = &event.launch {
        if launch.is_empty() {
            return Err(Error::Invalid("empty host launch".into()));
        }
        persistence::insert(&mut records, "host_launches", launch, &event.attempt)?;
    }
    merge(&mut attempt.launch, &event.launch, "launch")?;
    merge(&mut attempt.host_return, &event.host_return, "host-return")?;
    merge(&mut attempt.observed_host, &event.host, "host")?;
    merge(&mut attempt.observed_model, &event.model, "model")?;
    merge(&mut attempt.usage.input, &event.usage.input, "input usage")?;
    merge(
        &mut attempt.usage.output,
        &event.usage.output,
        "output usage",
    )?;
    merge(&mut attempt.usage.cost, &event.usage.cost, "cost")?;
    merge(
        &mut attempt.usage.currency,
        &event.usage.currency,
        "currency",
    )?;
    if !matches!(
        attempt.state,
        AttemptState::Accepted | AttemptState::Failed | AttemptState::NotSelected
    ) {
        match event.kind {
            ObservationKind::Interrupted => attempt.state = AttemptState::Interrupted,
            ObservationKind::Launch | ObservationKind::Return => {
                attempt.state = AttemptState::ObservedRunning
            }
            ObservationKind::Usage
            | ObservationKind::HostFacts
            | ObservationKind::LaunchFailure => {}
        }
    }
    attempt.observations.push(event.observation.clone());
    persistence::insert(&mut records, "observations", &event.observation, &event)?;
    persistence::insert(
        &mut records,
        "observation_recorded_at",
        &event.observation,
        &clock.now(),
    )?;
    persistence::put(&mut records, "attempts", &event.attempt, &attempt)?;
    let committed = match persistence::update(
        store,
        &view,
        &format!("observation:{}", event.observation),
        records,
    )
    .await
    {
        Ok(committed) => committed,
        Err(Error::Conflict(_)) => {
            let winner = persistence::read(store).await?;
            return receipt(&persistence::records(&winner.snapshot.data)?, &event, true);
        }
        Err(error) => return Err(error),
    };
    receipt(
        &persistence::records(&committed.snapshot.data)?,
        &event,
        false,
    )
}
