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
    records = contribute_delivery(&records, &attempt, &event)?;
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
            | ObservationKind::LaunchFailure
            | ObservationKind::MaterialDelivery(_) => {}
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

fn delivery_key(attempt: &str, view: &str) -> String {
    cadence::store::model::digest(&serde_json::to_vec(&(attempt, view)).expect("string pair"))
}

pub fn delivered_view(
    records: &Value,
    attempt: &Attempt,
    view: &super::model::MaterialView,
) -> Result<super::model::DeliveryRecord> {
    let saved: super::model::DeliveryRecord = persistence::get(
        records,
        "deliveries",
        &delivery_key(&attempt.attempt, &view.view),
    )?;
    let observation: Observation = persistence::get(records, "observations", &saved.observation)?;
    if saved.attempt != attempt.attempt
        || saved.delivery.fire != attempt.fire
        || saved.delivery.view != *view
        || view.manifest != attempt.view.manifest
        || observation.attempt != attempt.attempt
        || observation.kind != ObservationKind::MaterialDelivery(saved.delivery.clone())
    {
        return Err(Error::Invalid("unobserved material delivery".into()));
    }
    Ok(saved)
}

fn contribute_delivery(records: &Value, attempt: &Attempt, event: &Observation) -> Result<Value> {
    use super::model::{DeliveryRecord, Manifest, MaterialEntry};
    let ObservationKind::MaterialDelivery(delivery) = &event.kind else {
        return Ok(records.clone());
    };
    let key = delivery_key(&attempt.attempt, &delivery.view.view);
    let saved = DeliveryRecord {
        observation: event.observation.clone(),
        attempt: attempt.attempt.clone(),
        delivery: delivery.clone(),
    };
    if let Some(prior) = records["deliveries"].get(&key) {
        if *prior == serde_json::to_value(&saved)? {
            return Ok(records.clone());
        }
        return Err(Error::Conflict("delivery membership is immutable".into()));
    }
    if event.attempt != attempt.attempt
        || delivery.fire != attempt.fire
        || delivery.view.manifest != attempt.view.manifest
        || delivery.view.view.is_empty()
        || (delivery.view.view == attempt.view.view && delivery.view != attempt.view)
        || attempt.launch.is_none()
        || records["issued"].get(&attempt.attempt).is_none()
        || records["closures"].get(&attempt.attempt).is_some()
        || matches!(
            attempt.state,
            AttemptState::Accepted | AttemptState::Failed | AttemptState::NotSelected
        )
        || delivery.view.entries.len() != delivery.contents.len()
    {
        return Err(Error::Invalid("ineligible material delivery".into()));
    }
    let manifest: Manifest = persistence::get(records, "manifests", &delivery.view.manifest)?;
    if manifest.fire != attempt.fire {
        return Err(Error::Invalid("foreign delivery manifest".into()));
    }
    let mut unique = std::collections::BTreeSet::new();
    for id in &delivery.view.entries {
        let appended: Option<MaterialEntry> = records["appended"]
            .get(id)
            .cloned()
            .map(serde_json::from_value)
            .transpose()?;
        let entry = manifest
            .entries
            .iter()
            .find(|e| &e.entry == id)
            .or(appended.as_ref())
            .ok_or_else(|| Error::Invalid("delivery entry is not retained".into()))?;
        if !unique.insert(id)
            || entry.content.as_ref() != delivery.contents.get(id)
            || entry.content.is_none()
        {
            return Err(Error::Invalid("delivery content mismatch".into()));
        }
    }
    let mut next = records.clone();
    persistence::insert(&mut next, "deliveries", &key, &saved)?;
    Ok(next)
}

#[cfg(test)]
mod gap153_delivery_tests {
    use super::super::model::{MaterialDelivery, MaterialView};
    use super::*;
    use serde_json::json;

    fn input() -> (Value, Attempt, Observation) {
        let h: Value = serde_json::from_str(include_str!(
            "../../tests/fixtures/phase9/h1-admission.json"
        ))
        .unwrap();
        let mut attempt: Attempt = serde_json::from_value(h["a1"].clone()).unwrap();
        attempt.launch = Some("launch1".into());
        let event = Observation {
            observation: "obs1".into(),
            attempt: "a1".into(),
            launch: None,
            host_return: None,
            kind: ObservationKind::MaterialDelivery(MaterialDelivery {
                fire: "f1".into(),
                view: MaterialView {
                    view: "v1".into(),
                    manifest: "m1".into(),
                    entries: vec!["e1".into()],
                },
                contents: [(
                    "e1".into(),
                    "01d09d19c2139a46aebfb577780d123d7396e97201bc7ead210a2ebff8239dee".into(),
                )]
                .into(),
            }),
            reference: "event:1".into(),
            observed_at: 1,
            host: None,
            model: None,
            usage: attempt.usage.clone(),
            contract: attempt.contract.clone(),
        };
        (
            json!({"manifests":{"m1":h["m1"]},"issued":{"a1":true}}),
            attempt,
            event,
        )
    }
    #[test]
    fn gap153_delivery_contribution_records_exact_membership() {
        let (records, attempt, event) = input();
        let next = contribute_delivery(&records, &attempt, &event).unwrap();
        let saved = &next["deliveries"][delivery_key("a1", "v1")];
        assert_eq!(
            saved["delivery"]["view"],
            json!({"view":"v1","manifest":"m1","entries":["e1"]})
        );
        assert_eq!(saved["observation"], "obs1");
        assert_eq!(records["deliveries"], Value::Null);
    }
    #[test]
    fn gap153_delivery_duplicate_is_append_only_replay() {
        let (mut records, attempt, event) = input();
        let ObservationKind::MaterialDelivery(delivery) = &event.kind else {
            unreachable!()
        };
        records["deliveries"] = json!({delivery_key("a1","v1"): {"observation":"obs1","attempt":"a1","delivery":delivery}});
        records["closures"] = json!({"a1":{"terminal":"accepted"}});
        assert_eq!(
            contribute_delivery(&records, &attempt, &event).unwrap(),
            records
        );
    }
    #[test]
    fn gap153_backdated_original_delivery_after_closure_refuses() {
        let (mut records, mut attempt, event) = input();
        records["closures"] = json!({"a1":{"terminal":"accepted","acknowledged_at":100}});
        attempt.state = AttemptState::Accepted;
        assert!(contribute_delivery(&records, &attempt, &event).is_err());
        assert_eq!(records["deliveries"], Value::Null);
    }
}
