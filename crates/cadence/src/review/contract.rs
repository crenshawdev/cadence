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
    BlankField {
        index: usize,
        field: String,
    },
    FieldTooLong {
        index: usize,
        field: String,
        limit: usize,
    },
    InvalidLine {
        index: usize,
        field: String,
        min: u64,
        max: u64,
    },
    InvalidUnicodeScalar {
        index: usize,
        field: String,
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
    let value: Value = serde_json::from_slice(bytes)
        .map_err(|_| unicode_diagnostic(bytes).unwrap_or(ValidationError::MalformedReturn))?;
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
        let text = |name: &str, limit: usize| -> Result<String, ValidationError> {
            let value = field(name)?
                .as_str()
                .ok_or_else(|| shape(Some(index), name))?;
            if value.chars().all(char::is_whitespace) {
                return Err(ValidationError::BlankField {
                    index,
                    field: name.into(),
                });
            }
            if value.chars().count() > limit {
                return Err(ValidationError::FieldTooLong {
                    index,
                    field: name.into(),
                    limit,
                });
            }
            Ok(value.to_owned())
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
            file: text("file", 1024)?,
            line: field("line")?
                .as_u64()
                .filter(|line| (1..=9007199254740991).contains(line))
                .ok_or_else(|| ValidationError::InvalidLine {
                    index,
                    field: "line".into(),
                    min: 1,
                    max: 9007199254740991,
                })?,
            severity,
            claim: text("claim", 2000)?,
            failure_scenario: text("failure_scenario", 2000)?,
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

/// This scanner only locates string tokens and finding-field paths after the
/// real parser refuses a return. Masking lone surrogate escapes lets that same
/// parser confirm the rest of the syntax. Masked values are NEVER admitted or
/// returned: they exist solely to retain a useful refusal location.
fn unicode_diagnostic(bytes: &[u8]) -> Option<ValidationError> {
    enum Frame {
        Object(Option<String>),
        Array(usize),
    }
    let mut stack = Vec::new();
    let mut masked = bytes.to_vec();
    let mut diagnostic = None;
    let mut cursor = 0;
    while cursor < bytes.len() {
        match bytes[cursor] {
            b'{' => stack.push(Frame::Object(None)),
            b'[' => stack.push(Frame::Array(0)),
            b'}' | b']' => {
                stack.pop()?;
            }
            b',' => match stack.last_mut()? {
                Frame::Array(index) => *index += 1,
                Frame::Object(key) => *key = None,
            },
            b'"' => {
                let start = cursor;
                cursor += 1;
                let mut invalid = false;
                while cursor < bytes.len() && bytes[cursor] != b'"' {
                    if bytes[cursor] != b'\\' {
                        cursor += 1;
                        continue;
                    }
                    if let Some(unit) = escaped_unit(bytes, cursor) {
                        if (0xD800..=0xDBFF).contains(&unit)
                            && escaped_unit(bytes, cursor + 6)
                                .is_some_and(|low| (0xDC00..=0xDFFF).contains(&low))
                        {
                            cursor += 12;
                            continue;
                        }
                        if (0xD800..=0xDFFF).contains(&unit) {
                            // U+Fxxx is a scalar; preserve token length/locations.
                            masked[cursor + 2] = b'F';
                            invalid = true;
                        }
                        cursor += 6;
                    } else {
                        cursor += 2;
                    }
                }
                if cursor >= bytes.len() {
                    return None;
                }
                let end = cursor + 1;
                let next = bytes[end..].iter().find(|byte| !byte.is_ascii_whitespace());
                if next == Some(&b':') {
                    let key: String = serde_json::from_slice(&bytes[start..end]).ok()?;
                    if let Some(Frame::Object(current)) = stack.last_mut() {
                        *current = Some(key);
                    }
                } else if invalid
                    && diagnostic.is_none()
                    && let [
                        Frame::Object(Some(envelope)),
                        Frame::Array(index),
                        Frame::Object(Some(field)),
                    ] = stack.as_slice()
                    && envelope == "findings"
                {
                    diagnostic = Some(ValidationError::InvalidUnicodeScalar {
                        index: *index,
                        field: field.clone(),
                    });
                }
            }
            _ => {}
        }
        // The real parser's recursion limit applies to the diagnostic path too.
        if stack.len() > 128 {
            return None;
        }
        cursor += 1;
    }
    diagnostic.as_ref()?;
    serde_json::from_slice::<Value>(&masked).ok()?;
    diagnostic
}

fn escaped_unit(bytes: &[u8], start: usize) -> Option<u16> {
    let token = bytes.get(start..start.checked_add(6)?)?;
    if &token[..2] != b"\\u" {
        return None;
    }
    let digits = std::str::from_utf8(&token[2..]).ok()?;
    u16::from_str_radix(digits, 16).ok()
}

#[cfg(test)]
mod tests {
    use super::unicode_diagnostic;
    use serde_json::json;

    #[test]
    fn scalars_lexical_pair_is_not_lone() {
        let paired = br#"{"findings":[{"claim":"\uD83D\uDE00"}]}"#;
        assert_eq!(unicode_diagnostic(paired), None);
    }
    #[test]
    fn scalars_lexical_escaped_backslash_is_not_surrogate() {
        let escaped_backslash = br#"{"findings":[{"claim":"\\uD800"}]}"#;
        assert_eq!(unicode_diagnostic(escaped_backslash), None);
    }
    #[test]
    fn scalars_lexical_malformed_syntax_stays_malformed() {
        let malformed = br#"{"findings":[{"claim":"\uD800",}]}"#;
        assert_eq!(unicode_diagnostic(malformed), None);
    }
    #[test]
    fn scalars_lexical_low_surrogate_has_field() {
        let lone_low = br#"{"findings":[{"file":"\uDC00"}]}"#;
        assert_eq!(
            serde_json::to_value(unicode_diagnostic(lone_low)).unwrap(),
            json!({"code":"invalid-unicode-scalar","index":0,"field":"file"})
        );
    }
    #[test]
    fn scalars_lexical_second_finding_and_escaped_key() {
        let second = br#"{"findings":[{}, {"cl\u0061im":"\uD800"}]}"#;
        assert_eq!(
            serde_json::to_value(unicode_diagnostic(second)).unwrap(),
            json!({"code":"invalid-unicode-scalar","index":1,"field":"claim"})
        );
    }
    #[test]
    fn scalars_lexical_unrelated_path_has_no_finding_location() {
        let unrelated = br#"{"context":[{"claim":"\uD800"}]}"#;
        assert_eq!(unicode_diagnostic(unrelated), None);
    }
}
