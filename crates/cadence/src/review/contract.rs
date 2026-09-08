//! H4-1 checks supplied returns, not the truth or settlement of their findings.
use super::model::{Finding, Findings, Severity};
use serde::Serialize;
use serde_json::Value;

pub const RETURN_BYTE_CAP: usize = 4 * 1024 * 1024;
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "code", rename_all = "kebab-case")]
pub enum ValidationError {
    MalformedReturn,
    ReturnTooLarge {
        limit: usize,
    },
    InvalidShape {
        #[serde(skip_serializing_if = "Option::is_none")]
        index: Option<usize>,
        field: String,
    },
    MissingField {
        #[serde(skip_serializing_if = "Option::is_none")]
        index: Option<usize>,
        field: String,
    },
    UnknownField {
        #[serde(skip_serializing_if = "Option::is_none")]
        index: Option<usize>,
        field: String,
    },
    TooManyFindings {
        limit: usize,
        actual: usize,
    },
    InvalidSeverity {
        index: usize,
        field: String,
        actual: Value,
    },
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "state", rename_all = "kebab-case")]
pub enum ReturnClassification {
    Usable { findings: Findings },
    Failed { reason: String },
}
pub fn classify_return(bytes: Option<&[u8]>) -> ReturnClassification {
    match bytes {
        None => ReturnClassification::Failed {
            reason: "missing-return".into(),
        },
        Some(bytes) => match validate_findings(bytes) {
            Ok(findings) => ReturnClassification::Usable { findings },
            Err(ValidationError::MalformedReturn) => ReturnClassification::Failed {
                reason: "malformed-return".into(),
            },
            Err(_) => ReturnClassification::Failed {
                reason: "invalid-return".into(),
            },
        },
    }
}
pub fn validate_findings(bytes: &[u8]) -> Result<Findings, ValidationError> {
    if bytes.len() > RETURN_BYTE_CAP {
        return Err(ValidationError::ReturnTooLarge {
            limit: RETURN_BYTE_CAP,
        });
    }
    let value: Value =
        serde_json::from_slice(bytes).map_err(|_| ValidationError::MalformedReturn)?;
    let envelope = value.as_object().ok_or_else(|| shape(None, "findings"))?;
    for field in envelope.keys() {
        if field != "findings" {
            return Err(ValidationError::UnknownField {
                index: None,
                field: field.clone(),
            });
        }
    }
    let values = envelope
        .get("findings")
        .ok_or_else(|| missing(None, "findings"))?
        .as_array()
        .ok_or_else(|| shape(None, "findings"))?;
    if values.len() > 100 {
        return Err(ValidationError::TooManyFindings {
            limit: 100,
            actual: values.len(),
        });
    }
    let mut findings = Vec::with_capacity(values.len());
    for (index, value) in values.iter().enumerate() {
        let fields = value
            .as_object()
            .ok_or_else(|| shape(Some(index), "findings"))?;
        for field in fields.keys() {
            if !["file", "line", "severity", "claim", "failure_scenario"].contains(&field.as_str())
            {
                return Err(ValidationError::UnknownField {
                    index: Some(index),
                    field: field.clone(),
                });
            }
        }
        let field = |name: &str| fields.get(name).ok_or_else(|| missing(Some(index), name));
        let text = |name: &str| -> Result<String, ValidationError> {
            field(name)?
                .as_str()
                .map(str::to_owned)
                .ok_or_else(|| shape(Some(index), name))
        };
        let severity = match field("severity")?.as_str() {
            Some("blocker") => Severity::Blocker,
            Some("high") => Severity::High,
            Some("medium") => Severity::Medium,
            Some("low") => Severity::Low,
            _ => {
                return Err(ValidationError::InvalidSeverity {
                    index,
                    field: "severity".into(),
                    actual: field("severity")?.clone(),
                });
            }
        };
        findings.push(Finding {
            file: text("file")?,
            line: field("line")?
                .as_u64()
                .ok_or_else(|| shape(Some(index), "line"))?,
            severity,
            claim: text("claim")?,
            failure_scenario: text("failure_scenario")?,
        });
    }
    Ok(Findings { findings })
}
fn shape(index: Option<usize>, field: &str) -> ValidationError {
    ValidationError::InvalidShape {
        index,
        field: field.into(),
    }
}
fn missing(index: Option<usize>, field: &str) -> ValidationError {
    ValidationError::MissingField {
        index,
        field: field.into(),
    }
}
