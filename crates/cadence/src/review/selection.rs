//! Selection over saved admission and observations; no reviewer transport.
use super::contract::{ReturnClassification, classify_return};
use super::model::{AttemptState, Selection, Usage};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Supplied terminal bytes are classified by the frozen H4-1 validator.
/// Absence of a record means unattempted; absence of bytes on an accepted
/// observation is a failed return, never an empty successful review.
#[derive(Clone, Debug, Deserialize)]
pub struct AttemptOutcome {
    pub attempt: String,
    pub state: AttemptState,
    pub raw: Option<String>,
    pub usage: Option<Usage>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Completion {
    Incomplete,
    UsableComplete,
    CompleteWithFailure,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct NextSelection {
    pub request: Option<String>,
    pub not_selected: Vec<String>,
    pub state: Completion,
}

fn outcome(attempt: &AttemptOutcome) -> Completion {
    match attempt.state {
        AttemptState::Accepted => {
            match classify_return(attempt.raw.as_deref().map(str::as_bytes)) {
                ReturnClassification::Usable { .. } => Completion::UsableComplete,
                ReturnClassification::Failed { .. } => Completion::CompleteWithFailure,
            }
        }
        AttemptState::Failed => Completion::CompleteWithFailure,
        _ => Completion::Incomplete,
    }
}

/// FIRST visits the admitted order, requesting at most one unattempted choice.
/// A running/interrupted/uncertain attempt waits for recovery, not redispatch.
/// The fallback is checked against its saved outcome just like any other work.
pub fn select_next(
    selection: &Selection,
    attempts: &BTreeMap<String, AttemptOutcome>,
) -> NextSelection {
    let mut next = NextSelection {
        request: None,
        not_selected: vec![],
        state: Completion::Incomplete,
    };
    for (index, choice) in selection.choices.iter().enumerate() {
        let Some(attempt) = attempts.get(choice) else {
            next.request = Some(choice.clone());
            return next;
        };
        match outcome(attempt) {
            Completion::UsableComplete => {
                next.not_selected = selection.choices[index + 1..].to_vec();
                next.state = Completion::UsableComplete;
                return next;
            }
            Completion::Incomplete => return next,
            Completion::CompleteWithFailure => {}
        }
    }
    next.state = match &selection.fallback {
        Some(fallback) => match attempts.get(fallback) {
            Some(attempt) => outcome(attempt),
            None => {
                next.request = Some(fallback.clone());
                Completion::Incomplete
            }
        },
        None => Completion::CompleteWithFailure,
    };
    next
}

/// Failure does not erase spent usage. No observation means explicit unknowns.
pub fn attempt_usage(attempt: &AttemptOutcome) -> Usage {
    attempt.usage.clone().unwrap_or(Usage {
        input: None,
        output: None,
        cost: None,
        currency: None,
    })
}
