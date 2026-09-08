//! H4 acceptance: exact input, immutable originals, and one durable closure.
use super::binding::{self, BindingError, ReturnIdentity};
use super::contract::{self, ReturnClassification};
use super::io::Clock;
use super::model::{
    Acceptance, Admission, Attempt, AttemptState, Citation, Closure, Finding, FindingId, Original,
    SelectionMode, SourceReference,
};
use super::persistence;
use super::selection::{self, AttemptOutcome, NextSelection};
use cadence::store::writer::Store;
use cadence::store::{Error, Result as StoreResult};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ReturnSubmission {
    pub identity: ReturnIdentity,
    pub launch: String,
    pub host_return: Option<String>,
    pub raw: Option<Vec<u8>>,
    pub host_failure: Option<String>,
    pub citations: Vec<Option<SourceReference>>,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum ReturnError {
    Binding(BindingError),
    Conflict {
        code: String,
        attempt: String,
        original: String,
    },
    Delivery {
        code: String,
        attempt: String,
        acknowledged: bool,
    },
    Invalid {
        code: String,
        attempt: String,
    },
}
fn delivery(attempt: &str) -> ReturnError {
    ReturnError::Delivery {
        code: "delivery-write-failed".into(),
        attempt: attempt.into(),
        acknowledged: false,
    }
}
fn invalid(attempt: &str, code: &str) -> ReturnError {
    ReturnError::Invalid {
        code: code.into(),
        attempt: attempt.into(),
    }
}
fn conflict(attempt: &str, original: &str) -> ReturnError {
    ReturnError::Conflict {
        code: "conflicting-return".into(),
        attempt: attempt.into(),
        original: original.into(),
    }
}

#[derive(Debug, Serialize)]
pub struct ReturnReceipt {
    pub attempt: String,
    pub original: Option<String>,
    pub terminal: AttemptState,
    pub replayed: bool,
    pub originals: Option<Vec<Finding>>,
    pub durable_terminal_count: usize,
    pub next_selection: Option<NextSelection>,
}

fn next_selection(records: &Value, admission: &Admission) -> StoreResult<Option<NextSelection>> {
    if admission.selection.mode != SelectionMode::Single {
        return Ok(None);
    }
    let saved: BTreeMap<String, Attempt> = records
        .get("attempts")
        .cloned()
        .map(serde_json::from_value)
        .transpose()?
        .unwrap_or_default();
    let mut outcomes = BTreeMap::new();
    for attempt in saved
        .values()
        .filter(|attempt| attempt.fire == admission.fire)
    {
        if attempt.state == AttemptState::Intended
            && records["issued"].get(&attempt.attempt).is_none()
        {
            continue;
        }
        let raw = match &attempt.original {
            Some(id) => {
                let original: Original = persistence::get(records, "originals", id)?;
                String::from_utf8(original.raw).ok()
            }
            None => None,
        };
        outcomes.insert(
            attempt.slot.clone(),
            AttemptOutcome {
                attempt: attempt.attempt.clone(),
                state: attempt.state.clone(),
                raw,
                usage: Some(attempt.usage.clone()),
            },
        );
    }
    Ok(Some(selection::select_next(
        &admission.selection,
        &outcomes,
    )))
}

fn receipt(
    records: &Value,
    admission: &Admission,
    attempt: &Attempt,
    replayed: bool,
) -> StoreResult<ReturnReceipt> {
    let closure: Closure = persistence::get(records, "closures", &attempt.attempt)?;
    let originals = match &closure.original {
        Some(id) => {
            let original: Original = persistence::get(records, "originals", id)?;
            original.parsed.map(|parsed| parsed.findings)
        }
        None => None,
    };
    Ok(ReturnReceipt {
        attempt: attempt.attempt.clone(),
        original: closure.original,
        terminal: closure.terminal,
        replayed,
        originals,
        durable_terminal_count: persistence::terminal_count(records, &attempt.attempt),
        next_selection: next_selection(records, admission)?,
    })
}

fn replay(
    records: &Value,
    admission: &Admission,
    attempt: &Attempt,
    submitted: &ReturnSubmission,
) -> Result<ReturnReceipt, ReturnError> {
    if let Some(id) = &attempt.original {
        let original: Original =
            persistence::get(records, "originals", id).map_err(|_| delivery(&attempt.attempt))?;
        let citations: Vec<_> = original
            .citations
            .iter()
            .map(|citation| citation.submitted.clone())
            .collect();
        let submitted_citations = if submitted.citations.is_empty() {
            vec![None; citations.len()]
        } else {
            submitted.citations.clone()
        };
        if submitted.raw.as_ref() != Some(&original.raw)
            || submitted.host_failure.is_some()
            || original.host_return != submitted.host_return
            || citations != submitted_citations
        {
            return Err(conflict(&attempt.attempt, id));
        }
    } else {
        let saved: ReturnSubmission = persistence::get(records, "failed_returns", &attempt.attempt)
            .map_err(|_| delivery(&attempt.attempt))?;
        if serde_json::to_value(saved).ok() != serde_json::to_value(submitted).ok() {
            return Err(invalid(&attempt.attempt, "conflicting-return"));
        }
    }
    receipt(records, admission, attempt, true).map_err(|_| delivery(&attempt.attempt))
}

/// Receives unchanged bounded bytes after host identity was observed. A failed
/// write never returns a completion acknowledgment, even when recovery may
/// subsequently finish a pending store intent.
pub async fn accept_return(
    store: &Store,
    submitted: ReturnSubmission,
    clock: &mut impl Clock,
) -> Result<ReturnReceipt, ReturnError> {
    let id = &submitted.identity.attempt;
    let view = persistence::read(store).await.map_err(|_| delivery(id))?;
    let mut records = persistence::records(&view.snapshot.data).map_err(|_| delivery(id))?;
    let admission: Admission = persistence::get(&records, "admissions", &submitted.identity.fire)
        .map_err(|_| invalid(id, "unknown-fire"))?;
    let mut attempt: Attempt =
        persistence::get(&records, "attempts", id).map_err(|_| invalid(id, "unknown-attempt"))?;
    binding::bind_return(&admission, &attempt, &submitted.identity)
        .map_err(ReturnError::Binding)?;
    validate_return_launch(&records, &attempt, &submitted)?;
    if let Some(host_return) = &submitted.host_return {
        let bindings = serde_json::from_value(records["host_returns"].clone())
            .map_err(|_| invalid(id, "unobserved-host-return"))?;
        binding::bind_host_return(&bindings, host_return, id).map_err(ReturnError::Binding)?;
        if attempt.host_return.as_ref() != Some(host_return)
            || records["host_returns"][host_return] != *id
        {
            return Err(invalid(id, "unobserved-host-return"));
        }
    } else if submitted.raw.is_some() {
        return Err(invalid(id, "unobserved-host-return"));
    }
    if records
        .get("closures")
        .and_then(|values| values.get(id))
        .is_some()
    {
        return replay(&records, &admission, &attempt, &submitted);
    }
    if matches!(
        attempt.state,
        AttemptState::Accepted | AttemptState::Failed | AttemptState::NotSelected
    ) {
        return Err(invalid(id, "missing-terminal-closure"));
    }
    if admission.contract.validator != "H4-1" || attempt.contract != admission.contract {
        return Err(invalid(id, "unsupported-return-contract"));
    }
    if submitted
        .raw
        .as_ref()
        .is_some_and(|raw| raw.len() > contract::RETURN_BYTE_CAP)
    {
        return Err(invalid(id, "return-too-large"));
    }
    let classified = match &submitted.host_failure {
        Some(reason) => ReturnClassification::Failed {
            reason: reason.clone(),
        },
        None => contract::classify_return(submitted.raw.as_deref()),
    };
    let now = clock.now();
    match classified {
        ReturnClassification::Usable { findings } => {
            if !submitted.citations.is_empty()
                && submitted.citations.len() != findings.findings.len()
            {
                return Err(invalid(id, "citation-count-mismatch"));
            }
            let sequence = records
                .get("original_sequence")
                .and_then(Value::as_u64)
                .unwrap_or(0)
                .checked_add(1)
                .ok_or_else(|| invalid(id, "original-sequence-overflow"))?;
            let original_id = format!("o{sequence}");
            let raw = submitted
                .raw
                .clone()
                .ok_or_else(|| invalid(id, "missing-return"))?;
            let citations = (0..findings.findings.len())
                .map(|index| {
                    let reference = submitted.citations.get(index).cloned().flatten();
                    Citation {
                        finding: FindingId {
                            original: original_id.clone(),
                            index,
                        },
                        unresolved_reason: reference.is_none().then(|| "not-supplied".into()),
                        submitted: reference,
                    }
                })
                .collect();
            let closure = Closure {
                attempt: id.clone(),
                original: Some(original_id.clone()),
                terminal: AttemptState::Accepted,
                acknowledged_at: now,
            };
            let original = Original {
                original: original_id.clone(),
                content: cadence::store::model::digest(&raw),
                contract: admission.contract.clone(),
                raw,
                parsed: Some(findings),
                attempt: Some(id.clone()),
                host_return: submitted.host_return.clone(),
                artifact: Some(admission.artifact.clone()),
                view: Some(attempt.view.view.clone()),
                acceptance: Acceptance::Accepted,
                closure: Some(closure),
                citations,
            };
            persistence::insert(&mut records, "originals", &original_id, &original)
                .map_err(|_| delivery(id))?;
            records["original_sequence"] = serde_json::json!(sequence);
            attempt.original = Some(original_id);
            attempt.state = AttemptState::Accepted;
        }
        ReturnClassification::Failed { reason } => {
            attempt.state = AttemptState::Failed;
            attempt.failure = Some(reason);
            persistence::insert(&mut records, "failed_returns", id, &submitted)
                .map_err(|_| delivery(id))?;
        }
    }
    let closure = Closure {
        attempt: id.clone(),
        original: attempt.original.clone(),
        terminal: attempt.state.clone(),
        acknowledged_at: now,
    };
    persistence::insert(&mut records, "closures", id, &closure).map_err(|_| delivery(id))?;
    persistence::put(&mut records, "attempts", id, &attempt).map_err(|_| delivery(id))?;
    let committed = match persistence::update(store, &view, &format!("return:{id}"), records).await
    {
        Ok(committed) => committed,
        Err(Error::Conflict(_)) => {
            let winner = persistence::read(store).await.map_err(|_| delivery(id))?;
            let records = persistence::records(&winner.snapshot.data).map_err(|_| delivery(id))?;
            let attempt = persistence::get(&records, "attempts", id).map_err(|_| delivery(id))?;
            return replay(&records, &admission, &attempt, &submitted);
        }
        Err(_) => return Err(delivery(id)),
    };
    receipt(
        &persistence::records(&committed.snapshot.data).map_err(|_| delivery(id))?,
        &admission,
        &attempt,
        false,
    )
    .map_err(|_| delivery(id))
}

fn validate_return_launch(
    records: &Value,
    attempt: &Attempt,
    submitted: &ReturnSubmission,
) -> Result<(), ReturnError> {
    if submitted.launch.is_empty()
        || attempt.launch.as_deref() != Some(&submitted.launch)
        || records["host_launches"][&submitted.launch] != attempt.attempt
    {
        return Err(invalid(&attempt.attempt, "unobserved-host-launch"));
    }
    Ok(())
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LaunchFailureSubmission {
    pub identity: ReturnIdentity,
    pub event: super::model::Observation,
    pub reason: String,
}

fn project_launch_failure(
    records: &Value,
    submitted: &LaunchFailureSubmission,
    now: u64,
) -> Result<(Value, bool), ReturnError> {
    use super::model::{ObservationKind, Usage};
    let id = &submitted.identity.attempt;
    let admission: Admission = persistence::get(records, "admissions", &submitted.identity.fire)
        .map_err(|_| invalid(id, "unknown-fire"))?;
    let mut attempt: Attempt =
        persistence::get(records, "attempts", id).map_err(|_| invalid(id, "unknown-attempt"))?;
    binding::bind_return(&admission, &attempt, &submitted.identity)
        .map_err(ReturnError::Binding)?;
    let event = &submitted.event;
    if records["issued"].get(id).is_none() {
        return Err(invalid(id, "unissued-attempt"));
    }
    if event.kind != ObservationKind::LaunchFailure
        || event.attempt != *id
        || event.observation.is_empty()
        || event.observation.len() > 4096
        || event.reference.trim().is_empty()
        || event.reference.chars().count() > 4096
        || submitted.reason.trim().is_empty()
        || submitted.reason.chars().count() > 4096
        || event.launch.is_some()
        || event.host_return.is_some()
        || event.host.is_some()
        || event.model.is_some()
        || attempt.launch.is_some()
        || attempt.host_return.is_some()
        || attempt.original.is_some()
        || event.contract != attempt.contract
        || attempt.contract != admission.contract
    {
        return Err(invalid(id, "invalid-launch-failure"));
    }
    if records["closures"].get(id).is_some() {
        let saved: LaunchFailureSubmission = persistence::get(records, "launch_failures", id)
            .map_err(|_| invalid(id, "conflicting-return"))?;
        if saved != *submitted {
            return Err(invalid(id, "conflicting-return"));
        }
        return Ok((records.clone(), true));
    }
    if !matches!(
        attempt.state,
        AttemptState::Intended | AttemptState::Interrupted
    ) {
        return Err(invalid(id, "invalid-launch-failure-state"));
    }
    fn merge<T: Clone + PartialEq>(old: &Option<T>, new: &Option<T>) -> Option<Option<T>> {
        if old.is_some() && new.is_some() && old != new {
            None
        } else {
            Some(new.clone().or_else(|| old.clone()))
        }
    }
    attempt.usage = Usage {
        input: merge(&attempt.usage.input, &event.usage.input)
            .ok_or_else(|| invalid(id, "conflicting-usage"))?,
        output: merge(&attempt.usage.output, &event.usage.output)
            .ok_or_else(|| invalid(id, "conflicting-usage"))?,
        cost: merge(&attempt.usage.cost, &event.usage.cost)
            .ok_or_else(|| invalid(id, "conflicting-usage"))?,
        currency: merge(&attempt.usage.currency, &event.usage.currency)
            .ok_or_else(|| invalid(id, "conflicting-usage"))?,
    };
    attempt.state = AttemptState::Failed;
    attempt.failure = Some(submitted.reason.clone());
    attempt.observations.push(event.observation.clone());
    let mut next = records.clone();
    persistence::insert(&mut next, "observations", &event.observation, event)
        .map_err(|_| invalid(id, "conflicting-observation"))?;
    persistence::insert(
        &mut next,
        "observation_recorded_at",
        &event.observation,
        &now,
    )
    .map_err(|_| delivery(id))?;
    persistence::insert(&mut next, "launch_failures", id, submitted).map_err(|_| delivery(id))?;
    persistence::insert(
        &mut next,
        "closures",
        id,
        &Closure {
            attempt: id.clone(),
            original: None,
            terminal: AttemptState::Failed,
            acknowledged_at: now,
        },
    )
    .map_err(|_| delivery(id))?;
    persistence::put(&mut next, "attempts", id, &attempt).map_err(|_| delivery(id))?;
    Ok((next, false))
}

fn acknowledge_launch_failure(
    submitted: &LaunchFailureSubmission,
    committed: StoreResult<Value>,
    replayed: bool,
) -> Result<ReturnReceipt, ReturnError> {
    let id = &submitted.identity.attempt;
    let records = committed.map_err(|_| delivery(id))?;
    let saved: LaunchFailureSubmission =
        persistence::get(&records, "launch_failures", id).map_err(|_| delivery(id))?;
    if saved != *submitted {
        return Err(invalid(id, "conflicting-return"));
    }
    let admission = persistence::get(&records, "admissions", &submitted.identity.fire)
        .map_err(|_| delivery(id))?;
    let attempt: Attempt = persistence::get(&records, "attempts", id).map_err(|_| delivery(id))?;
    let closure: Closure = persistence::get(&records, "closures", id).map_err(|_| delivery(id))?;
    if attempt.state != AttemptState::Failed
        || attempt.original.is_some()
        || closure.terminal != AttemptState::Failed
        || closure.original.is_some()
    {
        return Err(delivery(id));
    }
    receipt(&records, &admission, &attempt, replayed).map_err(|_| delivery(id))
}

pub async fn accept_launch_failure(
    store: &Store,
    submitted: LaunchFailureSubmission,
    clock: &mut impl Clock,
) -> Result<ReturnReceipt, ReturnError> {
    let id = &submitted.identity.attempt;
    let view = persistence::read(store).await.map_err(|_| delivery(id))?;
    let records = persistence::records(&view.snapshot.data).map_err(|_| delivery(id))?;
    let (next, replayed) = project_launch_failure(&records, &submitted, clock.now())?;
    let committed = if replayed {
        Ok(records)
    } else {
        match persistence::update(store, &view, &format!("launch-failure:{id}"), next).await {
            Ok(view) => persistence::records(&view.snapshot.data),
            Err(Error::Conflict(_)) => persistence::read(store)
                .await
                .and_then(|v| persistence::records(&v.snapshot.data)),
            Err(error) => Err(error),
        }
    };
    acknowledge_launch_failure(&submitted, committed, replayed)
}

#[cfg(test)]
mod gap152_tests {
    use super::*;
    use serde_json::json;

    fn submitted() -> LaunchFailureSubmission {
        serde_json::from_value(json!({
            "identity":{"fire":"f1","occurrence":"occ1","artifact":"m1","view":"v1","attempt":"a1","round":1},
            "reason":"unavailable", "event":{"observation":"obs1","attempt":"a1","launch":null,"host_return":null,
                "kind":"launch-failure","reference":"event:1","observed_at":100,"host":null,"model":null,
                "usage":{"input":null,"output":null,"cost":null,"currency":null},
                "contract":{"schema":"review-1","interpretation":"H1-H5","validator":"H4-1"}}
        })).unwrap()
    }
    fn records(failed: bool) -> Value {
        let h: Value = serde_json::from_str(include_str!(
            "../../tests/fixtures/phase9/h1-admission.json"
        ))
        .unwrap();
        let mut a = h["a1"].clone();
        if failed {
            a["state"] = json!("failed");
            a["failure"] = json!("unavailable");
            a["observations"] = json!(["obs1"]);
        }
        let mut records = json!({"schema":"review-1","admissions":{"f1":h["H"]},"attempts":{"a1":a},"issued":{"a1":true}});
        if failed {
            records["launch_failures"] = json!({"a1":submitted()});
            records["observations"] = json!({"obs1":submitted().event});
            records["observation_recorded_at"] = json!({"obs1":100});
            records["closures"] = json!({"a1":{"attempt":"a1","original":null,"terminal":"failed","acknowledged_at":100}});
        }
        records
    }

    #[test]
    fn gap152_failure_projection_preserves_unknowns_and_usage() {
        for usage in [
            json!({"input":null,"output":null,"cost":null,"currency":null}),
            json!({"input":7,"output":3,"cost":null,"currency":null}),
        ] {
            let input = records(false);
            let mut failure = submitted();
            failure.event.usage = serde_json::from_value(usage.clone()).unwrap();
            let (next, replayed) = project_launch_failure(&input, &failure, 100).unwrap();
            assert!(!replayed);
            assert_eq!(next["attempts"]["a1"]["state"], "failed");
            assert_eq!(next["attempts"]["a1"]["failure"], "unavailable");
            assert_eq!(next["attempts"]["a1"]["usage"], usage);
            for field in [
                "original",
                "launch",
                "host_return",
                "observed_host",
                "observed_model",
            ] {
                assert_eq!(next["attempts"]["a1"][field], Value::Null);
            }
            assert_eq!(next["closures"]["a1"]["acknowledged_at"], 100);
            assert_eq!(input["attempts"]["a1"]["state"], "intended");
        }
    }

    #[test]
    fn gap152_acknowledgment_requires_confirmed_failure() {
        let receipt = acknowledge_launch_failure(&submitted(), Ok(records(true)), false).unwrap();
        assert_eq!(receipt.terminal, AttemptState::Failed);
        assert_eq!(receipt.durable_terminal_count, 1);
        assert_eq!(receipt.original, None);
        let error = acknowledge_launch_failure(
            &submitted(),
            Err(Error::Invalid("sync failed".into())),
            false,
        )
        .unwrap_err();
        assert_eq!(
            serde_json::to_value(error).unwrap(),
            json!({"code":"delivery-write-failed","attempt":"a1","acknowledged":false})
        );
    }

    #[test]
    fn gap152_identical_failure_replays_without_mutation() {
        let input = records(true);
        let (next, replayed) = project_launch_failure(&input, &submitted(), 999).unwrap();
        assert!(replayed);
        assert_eq!(next, input);
        let receipt = acknowledge_launch_failure(&submitted(), Ok(input), replayed).unwrap();
        assert!(receipt.replayed);
        assert_eq!(receipt.durable_terminal_count, 1);
    }

    #[test]
    fn gap152_conflicting_failure_refuses_without_mutation() {
        let input = records(true);
        let original = input.clone();
        let mut failure = submitted();
        failure.reason = "different".into();
        let error = project_launch_failure(&input, &failure, 100).unwrap_err();
        assert_eq!(
            serde_json::to_value(error).unwrap()["code"],
            "conflicting-return"
        );
        assert_eq!(input, original);
    }

    #[test]
    fn gap152_unissued_mismatched_and_uncertain_inputs_refuse() {
        let mut input = records(false);
        input["issued"] = json!({});
        assert_eq!(
            serde_json::to_value(project_launch_failure(&input, &submitted(), 100).unwrap_err())
                .unwrap()["code"],
            "unissued-attempt"
        );
        let input = records(false);
        for field in ["fire", "occurrence", "artifact", "view", "attempt", "round"] {
            let mut failure = serde_json::to_value(submitted()).unwrap();
            failure["identity"][field] = if field == "round" {
                json!(2)
            } else {
                json!("foreign")
            };
            assert!(
                project_launch_failure(&input, &serde_json::from_value(failure).unwrap(), 100)
                    .is_err()
            );
        }
        let mut failure = submitted();
        failure.event.kind = super::super::model::ObservationKind::Interrupted;
        assert_eq!(
            serde_json::to_value(project_launch_failure(&input, &failure, 100).unwrap_err())
                .unwrap()["code"],
            "invalid-launch-failure"
        );
        assert_eq!(input["closures"], Value::Null);
    }

    #[test]
    fn gap152_raw_return_still_requires_observed_launch() {
        let input = records(false);
        let attempt: Attempt = serde_json::from_value(input["attempts"]["a1"].clone()).unwrap();
        let raw = ReturnSubmission {
            identity: submitted().identity,
            launch: "unbound".into(),
            host_return: None,
            raw: Some(b"{\"findings\":[]}".to_vec()),
            host_failure: None,
            citations: vec![],
        };
        assert_eq!(
            serde_json::to_value(validate_return_launch(&input, &attempt, &raw).unwrap_err())
                .unwrap()["code"],
            "unobserved-host-launch"
        );
    }

    #[test]
    fn gap152_selection_omits_unissued_choices_and_reaches_fallback() {
        let mut input = records(true);
        let mut b = input["attempts"]["a1"].clone();
        b["attempt"] = json!("a2");
        b["slot"] = json!("B");
        b["state"] = json!("intended");
        input["attempts"]["a2"] = b;
        let admission: Admission =
            serde_json::from_value(input["admissions"]["f1"].clone()).unwrap();
        assert_eq!(
            next_selection(&input, &admission)
                .unwrap()
                .unwrap()
                .request
                .as_deref(),
            Some("B")
        );
        let mut exhausted = records(true);
        let mut b = exhausted["attempts"]["a1"].clone();
        b["attempt"] = json!("a2");
        b["slot"] = json!("B");
        exhausted["attempts"]["a2"] = b;
        exhausted["issued"]["a2"] = json!(true);
        assert_eq!(
            next_selection(&exhausted, &admission)
                .unwrap()
                .unwrap()
                .request
                .as_deref(),
            Some("local")
        );
    }
}
