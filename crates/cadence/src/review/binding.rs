//! Pure identity checks. A requested voice label is never host participation.
use super::model::{Admission, Attempt};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReturnIdentity {
    pub fire: String,
    pub occurrence: String,
    pub artifact: String,
    pub view: String,
    pub attempt: String,
    pub round: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(untagged)]
pub enum BindingError {
    Identity {
        code: String,
        fire: String,
        field: String,
    },
    HostReturn {
        code: String,
        #[serde(rename = "return")]
        host_return: String,
        bound_attempt: String,
        submitted_attempt: String,
    },
}

pub fn bind_return(
    admission: &Admission,
    attempt: &Attempt,
    submitted: &ReturnIdentity,
) -> Result<(), BindingError> {
    let mismatch = [
        (
            "fire",
            submitted.fire != admission.fire || attempt.fire != admission.fire,
        ),
        (
            "occurrence",
            submitted.occurrence != admission.home.occurrence
                || attempt.occurrence != admission.home.occurrence,
        ),
        (
            "artifact",
            submitted.artifact != admission.artifact || attempt.view.manifest != admission.artifact,
        ),
        ("view", submitted.view != attempt.view.view),
        ("attempt", submitted.attempt != attempt.attempt),
        (
            "round",
            submitted.round != admission.round || attempt.round != admission.round,
        ),
    ]
    .into_iter()
    .find(|(_, differs)| *differs);
    match mismatch {
        Some((field, _)) => Err(BindingError::Identity {
            code: format!("{field}-mismatch"),
            fire: admission.fire.clone(),
            field: field.into(),
        }),
        None => Ok(()),
    }
}

/// The host bridge supplies actual launch/return events with the binary-issued
/// attempt. Persistence keeps this binding after terminal acceptance.
pub fn bind_host_return(
    bindings: &BTreeMap<String, String>,
    host_return: &str,
    attempt: &str,
) -> Result<(), BindingError> {
    if let Some(bound) = bindings.get(host_return)
        && bound != attempt
    {
        return Err(BindingError::HostReturn {
            code: "host-return-conflict".into(),
            host_return: host_return.into(),
            bound_attempt: bound.clone(),
            submitted_attempt: attempt.into(),
        });
    }
    if host_return.is_empty() || attempt.is_empty() {
        return Err(BindingError::Identity {
            code: "missing-host-binding".into(),
            fire: String::new(),
            field: "host_return".into(),
        });
    }
    Ok(())
}
