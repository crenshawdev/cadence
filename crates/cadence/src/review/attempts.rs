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

/// The receipt for `event` as `records` hold it. An observation id saved with
/// different content is a reused identity and is refused.
pub fn receipt(records: &Value, event: &Observation, replayed: bool) -> Result<ObservationReceipt> {
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
    validate_observation(&event)?;
    let view = persistence::read(store).await?;
    let records = match decide_observation(persistence::records(&view.snapshot.data)?, &event, clock)? {
        Recording::Replay(receipt) => return Ok(*receipt),
        Recording::Contribute(records) => records,
    };
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

/// An observation this binary can record at all: never a launch failure,
/// which needs a return identity, and never an empty or oversized reference.
pub fn validate_observation(event: &Observation) -> Result<()> {
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
    Ok(())
}

/// What recording an observation does, decided over one snapshot's records.
pub enum Recording {
    /// Already saved: its receipt, replayed.
    Replay(Box<ObservationReceipt>),
    /// New: the records with the observation contributed, to commit.
    Contribute(Value),
}

/// Replay an observation already saved, or contribute a new one to `records`.
/// The clock is read only for a new observation.
pub fn decide_observation(records: Value, event: &Observation, clock: &mut impl Clock) -> Result<Recording> {
    if records
        .get("observations")
        .and_then(|values| values.get(&event.observation))
        .is_some()
    {
        return receipt(&records, event, true).map(|receipt| Recording::Replay(Box::new(receipt)));
    }
    contribute_observation(records, event, clock.now()).map(Recording::Contribute)
}

fn contribute_observation(mut records: Value, event: &Observation, at: u64) -> Result<Value> {
    let mut attempt: Attempt = persistence::get(&records, "attempts", &event.attempt)?;
    records = contribute_delivery(&records, &attempt, event)?;
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
        &at,
    )?;
    persistence::put(&mut records, "attempts", &event.attempt, &attempt)?;
    Ok(records)
}

fn delivery_key(attempt: &str, view: &str) -> String {
    cadence::store::model::digest(&serde_json::to_vec(&(attempt, view)).expect("string pair"))
}

/// The host-independent exit report and the Claude stop hook share the same
/// Interrupted observation reducer. A terminal return is never undone.
pub fn worker_exit(records: &Value, report: &crate::execution::runner::WorkerExit,
    id: &str, at: u64) -> Result<(Value, bool)> {
    let refuse = || crate::execution::admission::refuse(report.phase, "exit-target", "review", id,
        "exit must name an issued local review attempt in this phase");
    let attempt: Attempt = persistence::get(records, "attempts", id).map_err(|_| refuse())?;
    let admission: super::model::Admission = persistence::get(records, "admissions", &attempt.fire).map_err(|_| refuse())?;
    if records["issued"].get(id).is_none()
        || admission.home.kind == super::model::HomeKind::Phase && admission.home.id != report.phase.to_string()
        || super::provider::Provider::parse(&attempt.requested.agent).is_some() {
        return Err(refuse());
    }
    let event = Observation { observation: format!("worker-exit:{}", report.request_id),
        attempt: id.into(), launch: None, host_return: None, kind: ObservationKind::Interrupted,
        reference: serde_json::to_string(report)?, observed_at: at, host: Some(report.host.clone()),
        model: None, usage: super::model::Usage { input: None, output: None, cost: None, currency: None }, contract: attempt.contract };
    let next = contribute_observation(records.clone(), &event, at)?;
    let saved: Attempt = persistence::get(&next, "attempts", id)?;
    Ok((next, saved.state == AttemptState::Interrupted))
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

    /// Attempt a1 issued and running for the phase 14 admission f1.
    fn running_attempt() -> Value {
        let fixture: Value = serde_json::from_str(include_str!("../../tests/fixtures/phase9/h1-admission.json")).unwrap();
        let mut admission = fixture["H"].clone();
        admission["home"]["id"] = json!("14");
        json!({"attempts":{"a1":fixture["a1"]},"admissions":{"f1":admission},"issued":{"a1":true}})
    }

    fn exit_report(request_id: &str) -> crate::execution::runner::WorkerExit {
        crate::execution::runner::WorkerExit { request_id: request_id.into(), phase: 14,
            host: "codex exec".into(), outcome: crate::execution::runner::WorkerOutcome::Failed,
            detail: Some("host exited".into()), dispatch: None, attempt: None, review: Some("a1".into()) }
    }

    #[test]
    fn a_worker_exit_interrupts_a_running_attempt_and_records_its_observation() {
        let (next, interrupted) = worker_exit(&running_attempt(), &exit_report("exit-review"), "a1", 100).unwrap();
        assert!(interrupted);
        assert_eq!(next["attempts"]["a1"]["state"], "interrupted");
        assert_eq!(next["observations"]["worker-exit:exit-review"]["kind"], "interrupted");
        assert_eq!(next["observation_recorded_at"]["worker-exit:exit-review"], 100);
        assert_eq!(next["closures"], Value::Null);
    }

    #[test]
    fn a_worker_exit_after_a_terminal_return_leaves_state_and_original_unchanged() {
        let mut returned = running_attempt();
        returned["attempts"]["a1"]["state"] = json!("accepted");
        returned["attempts"]["a1"]["original"] = json!("original-1");
        let (next, interrupted) = worker_exit(&returned, &exit_report("exit-after-return"), "a1", 101).unwrap();
        assert!(!interrupted);
        assert_eq!(next["attempts"]["a1"]["state"], "accepted");
        assert_eq!(next["attempts"]["a1"]["original"], "original-1");
    }

    #[test]
    fn a_worker_exit_naming_an_unknown_attempt_is_refused() {
        assert!(worker_exit(&running_attempt(), &exit_report("exit-after-return"), "unknown", 101).is_err());
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
