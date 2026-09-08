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
    if attempt.launch.as_deref() != Some(&submitted.launch)
        || records["host_launches"][&submitted.launch] != *id
    {
        return Err(invalid(id, "unobserved-host-launch"));
    }
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
