//! Public execution answers and their versioned canonical receipt contract.
//! This module uses no runtime, filesystem or transport.
use super::model::{ActiveDispatch, BoundaryTool};
use crate::envelope::Envelope;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

pub const ENVELOPE_CODEC: u32 = 1;
pub const MAX_COMPACT_BYTES: usize = 16 * 1024;
pub const MAX_REASON_BYTES: usize = 1024;

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "scope", rename_all = "kebab-case", deny_unknown_fields)]
pub enum BoundaryScope {
    RootRefusal,
    Execution { phase: u32 },
}

impl BoundaryScope {
    pub fn valid(&self) -> bool {
        !matches!(self, Self::Execution { phase: 0 })
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "outcome", rename_all = "kebab-case", deny_unknown_fields)]
pub enum Success {
    Dispatch {
        dispatch: Box<ActiveDispatch>,
        prompt: String,
    },
    NextPlan {
        phase: u32,
        plan: u32,
    },
    Complete {
        phase: u32,
    },
    JudgmentStop {
        phase: u32,
        dispatch_id: String,
        blocker_ids: Vec<String>,
    },
}

pub type ExecutionEnvelope = Envelope<Success>;
pub type Answer = Result<ExecutionEnvelope, Failure>;

/// An unconfirmed operation cannot be represented as a recorded refusal.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Failure {
    Store,
    Closed,
    Confirmation,
    LegacyExecution,
    Encoding,
}

impl std::fmt::Display for Failure {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Store => "execution store or controlling policy is unavailable",
            Self::Closed => "execution resident is closed",
            Self::Confirmation => "execution answer could not be confirmed",
            Self::LegacyExecution => "cross-format native execution resume is unsupported",
            Self::Encoding => "execution envelope encoding is invalid",
        })
    }
}
impl std::error::Error for Failure {}

/// Legacy service representation, retained until new-format writer admission
/// is available. Its serialized bytes remain the legacy digest preimage.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "outcome", rename_all = "kebab-case")]
pub enum Response {
    Dispatch {
        dispatch: Box<ActiveDispatch>,
        prompt: String,
    },
    NextPlan {
        phase: u32,
        plan: u32,
    },
    Complete {
        phase: u32,
    },
    JudgmentStop {
        phase: u32,
        dispatch_id: String,
        blocker_ids: Vec<String>,
    },
    Refused {
        phase: u32,
        code: String,
        reason: String,
    },
}

impl Response {
    pub fn label(&self) -> String {
        match self {
            Self::Dispatch { .. } => "dispatch".into(),
            Self::NextPlan { .. } => "next-plan".into(),
            Self::Complete { .. } => "complete".into(),
            Self::JudgmentStop { .. } => "judgment-stop".into(),
            Self::Refused { code, .. } => format!("refused:{code}"),
        }
    }
}

impl Response {
    pub fn into_envelope(self) -> ExecutionEnvelope {
        match self {
            Self::Dispatch { dispatch, prompt } => {
                Envelope::Ok(Success::Dispatch { dispatch, prompt })
            }
            Self::NextPlan { phase, plan } => Envelope::Ok(Success::NextPlan { phase, plan }),
            Self::Complete { phase } => Envelope::Ok(Success::Complete { phase }),
            Self::JudgmentStop {
                phase,
                dispatch_id,
                blocker_ids,
            } => Envelope::Ok(Success::JudgmentStop {
                phase,
                dispatch_id,
                blocker_ids,
            }),
            Self::Refused { code, reason, .. } => Envelope::Refused { code, reason },
        }
    }
}

pub fn terminal_envelope() -> ExecutionEnvelope {
    Envelope::Refused {
        code: "log-bound".into(),
        reason: "the boundary scope reached its 256-transition limit".into(),
    }
}

pub fn outcome(envelope: &ExecutionEnvelope) -> String {
    match envelope {
        Envelope::Ok(Success::Dispatch { .. }) => "dispatch".into(),
        Envelope::Ok(Success::NextPlan { .. }) => "next-plan".into(),
        Envelope::Ok(Success::Complete { .. }) => "complete".into(),
        Envelope::Ok(Success::JudgmentStop { .. }) => "judgment-stop".into(),
        Envelope::Refused { code, .. } => format!("refused:{code}"),
        Envelope::Unknown { code, .. } => format!("unknown:{code}"),
        Envelope::NotApplicable { code, .. } => format!("not-applicable:{code}"),
    }
}

/// Object ordering is explicit even if serde_json changes its map backend.
/// String serialization deliberately uses serde_json's UTF-8 escaping.
pub fn canonical_bytes<T: Serialize>(input: &T) -> Result<Vec<u8>, Failure> {
    fn write(value: &Value, out: &mut Vec<u8>) -> Result<(), Failure> {
        match value {
            Value::Object(object) => {
                out.push(b'{');
                for (index, (key, value)) in object
                    .iter()
                    .collect::<BTreeMap<_, _>>()
                    .into_iter()
                    .enumerate()
                {
                    if index > 0 {
                        out.push(b',');
                    }
                    serde_json::to_writer(&mut *out, key).map_err(|_| Failure::Encoding)?;
                    out.push(b':');
                    write(value, out)?;
                }
                out.push(b'}');
            }
            Value::Array(array) => {
                out.push(b'[');
                for (index, value) in array.iter().enumerate() {
                    if index > 0 {
                        out.push(b',');
                    }
                    write(value, out)?;
                }
                out.push(b']');
            }
            Value::Number(number) if !number.is_i64() && !number.is_u64() => {
                return Err(Failure::Encoding);
            }
            _ => serde_json::to_writer(&mut *out, value).map_err(|_| Failure::Encoding)?,
        }
        Ok(())
    }
    let value = serde_json::to_value(input).map_err(|_| Failure::Encoding)?;
    let mut bytes = Vec::new();
    write(&value, &mut bytes)?;
    Ok(bytes)
}

pub fn envelope_digest(envelope: &ExecutionEnvelope) -> Result<String, Failure> {
    Ok(crate::store::model::digest(&canonical_bytes(envelope)?))
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "receipt", rename_all = "kebab-case", deny_unknown_fields)]
pub enum Receipt {
    Compact {
        envelope: ExecutionEnvelope,
    },
    Dispatch {
        dispatch_id: String,
        prompt_bytes: u64,
    },
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PreparedAnswer {
    pub envelope: ExecutionEnvelope,
    pub receipt: Receipt,
    pub response_digest: String,
}

impl PreparedAnswer {
    pub fn new(mut envelope: ExecutionEnvelope) -> Result<Self, Failure> {
        match &mut envelope {
            Envelope::Refused { reason, .. }
            | Envelope::Unknown { reason, .. }
            | Envelope::NotApplicable { reason, .. } => {
                let mut end = reason.len().min(MAX_REASON_BYTES);
                while !reason.is_char_boundary(end) {
                    end -= 1;
                }
                reason.truncate(end);
            }
            Envelope::Ok(_) => {}
        }
        let dispatch = matches!(envelope, Envelope::Ok(Success::Dispatch { .. }));
        if !dispatch && canonical_bytes(&envelope)?.len() > MAX_COMPACT_BYTES {
            envelope = Envelope::Refused {
                code: "response-too-large".into(),
                reason: "the execution answer exceeds the 16384-byte compact envelope limit".into(),
            };
        }
        let receipt = match &envelope {
            Envelope::Ok(Success::Dispatch { dispatch, prompt }) => {
                if dispatch.prompt_bytes != prompt.len() as u64 {
                    return Err(Failure::Encoding);
                }
                Receipt::Dispatch {
                    dispatch_id: dispatch.id.clone(),
                    prompt_bytes: dispatch.prompt_bytes,
                }
            }
            _ => Receipt::Compact {
                envelope: envelope.clone(),
            },
        };
        Ok(Self {
            response_digest: envelope_digest(&envelope)?,
            envelope,
            receipt,
        })
    }

    pub fn too_large(&self) -> bool {
        matches!(&self.envelope, Envelope::Refused { code, .. } if code == "response-too-large")
    }
}

/// This is a distinct wire contract. No field is defaulted into a legacy
/// decision, operation fingerprint, snapshot or intent integrity preimage.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BoundaryV1 {
    pub codec: u32,
    pub scope: BoundaryScope,
    pub tool: BoundaryTool,
    pub operation: String,
    pub request_digest: String,
    pub outcome: String,
    pub subject_id: Option<String>,
    pub response_digest: String,
    pub receipt: Receipt,
}

impl BoundaryV1 {
    pub fn new(
        scope: BoundaryScope,
        tool: BoundaryTool,
        operation: String,
        request_digest: String,
        subject_id: Option<String>,
        answer: &PreparedAnswer,
    ) -> Self {
        Self {
            codec: ENVELOPE_CODEC,
            scope,
            tool,
            operation,
            request_digest,
            outcome: outcome(&answer.envelope),
            subject_id,
            response_digest: answer.response_digest.clone(),
            receipt: answer.receipt.clone(),
        }
    }
}

impl BoundaryV1 {
    pub fn identity(&self) -> Result<String, Failure> {
        Ok(crate::store::model::digest(&canonical_bytes(&(
            "boundary-envelope-v1",
            self,
        ))?))
    }

    pub fn terminal(scope: BoundaryScope) -> Result<Self, Failure> {
        let request =
            crate::store::model::digest(&canonical_bytes(&("boundary-terminal-v1", &scope))?);
        Ok(Self::new(
            scope,
            BoundaryTool::CadenceQuery,
            "log-bound".into(),
            request,
            None,
            &PreparedAnswer::new(terminal_envelope())?,
        ))
    }

    pub fn validate(&self, terminal: bool) -> Result<(), Failure> {
        let digest = |value: &str| {
            value.len() == 64
                && value
                    .bytes()
                    .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
        };
        if self.codec != ENVELOPE_CODEC
            || !self.scope.valid()
            || !digest(&self.request_digest)
            || !digest(&self.response_digest)
            || self
                .subject_id
                .as_ref()
                .is_some_and(|id| id.trim().is_empty())
            || (!terminal
                && self.operation
                    != match self.tool {
                        BoundaryTool::CadenceQuery => "execute-next",
                        BoundaryTool::CadenceApply => "executor",
                    })
        {
            return Err(Failure::Encoding);
        }
        if terminal {
            if *self != Self::terminal(self.scope.clone())? {
                return Err(Failure::Encoding);
            }
        } else if self.outcome == "refused:log-bound" {
            return Err(Failure::Encoding);
        }
        match &self.receipt {
            Receipt::Dispatch {
                dispatch_id,
                prompt_bytes,
            } => {
                if !matches!(self.scope, BoundaryScope::Execution { .. })
                    || self.tool != BoundaryTool::CadenceQuery
                    || self.outcome != "dispatch"
                    || self.subject_id.as_ref() != Some(dispatch_id)
                    || *prompt_bytes == 0
                {
                    return Err(Failure::Encoding);
                }
            }
            Receipt::Compact { envelope } => {
                if matches!(envelope, Envelope::Ok(Success::Dispatch { .. }))
                    || (self.scope == BoundaryScope::RootRefusal
                        && !matches!(envelope, Envelope::Refused { .. }))
                {
                    return Err(Failure::Encoding);
                }
                if let Envelope::Ok(success) = envelope {
                    let phase = match success {
                        Success::NextPlan { phase, plan } if *plan > 0 => *phase,
                        Success::Complete { phase } => *phase,
                        Success::JudgmentStop {
                            phase,
                            dispatch_id,
                            blocker_ids,
                        } if self.subject_id.as_ref() == Some(dispatch_id)
                            && !blocker_ids.is_empty()
                            && blocker_ids.iter().all(|id| !id.trim().is_empty()) =>
                        {
                            *phase
                        }
                        _ => return Err(Failure::Encoding),
                    };
                    if self.scope != (BoundaryScope::Execution { phase }) {
                        return Err(Failure::Encoding);
                    }
                } else {
                    let (code, reason) = match envelope {
                        Envelope::Refused { code, reason }
                        | Envelope::Unknown { code, reason }
                        | Envelope::NotApplicable { code, reason } => (code, reason),
                        _ => unreachable!(),
                    };
                    if code.is_empty()
                        || !code
                            .bytes()
                            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
                        || reason.trim().is_empty()
                    {
                        return Err(Failure::Encoding);
                    }
                }
                let answer = PreparedAnswer::new(envelope.clone())?;
                if answer.envelope != *envelope
                    || self.outcome != outcome(envelope)
                    || self.response_digest != answer.response_digest
                {
                    return Err(Failure::Encoding);
                }
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn canonical_public_fixtures_cover_every_arm_and_success_variant() {
        // Literal UTF-8 JSON and SHA-256 values computed independently of Rust
        // response serialization are the byte and digest oracles.
        let fixtures = [
            (
                r##"{"outcome":"complete","phase":6,"status":"ok"}"##,
                "7c3c2c28db9457a1f97cd60983d796bab8bba8fe4187674cc9ad615ca6b1b179",
            ),
            (
                r##"{"outcome":"next-plan","phase":6,"plan":2,"status":"ok"}"##,
                "ffea5931fd38ca7efaa0fa9872a7a8415be3e84f868a3da549d2301a92181dae",
            ),
            (
                r##"{"blocker_ids":["B2","B1"],"dispatch_id":"d1","outcome":"judgment-stop","phase":6,"status":"ok"}"##,
                "d394b2a4f164eecd9592a46d157b7a2978e456304f56bacd8f801a3343666b90",
            ),
            (
                r##"{"code":"invalid-phase","reason":"phase must be positive","status":"refused"}"##,
                "6914d5f0a8f7869ca24286a3432df51d4114d9f9f3163293e2d0be6f8f1148c7",
            ),
            (
                r##"{"code":"missing-input","reason":"unreadable","status":"unknown"}"##,
                "08f68c180ee923c3e6e6be575a196c82a80b66f794a560d74ae9b313918797fc",
            ),
            (
                r##"{"code":"no-phase","reason":"absent","status":"not-applicable"}"##,
                "fab7cae5aa2c77831de7d74499bad248f2251095d9813a8e4e39566ed454c4ff",
            ),
            (
                r##"{"code":"log-bound","reason":"the boundary scope reached its 256-transition limit","status":"refused"}"##,
                "dbf0572cace415f2802f207056eafe427501f99eb793bd9551d6b114477b4ab9",
            ),
            (
                r##"{"dispatch":{"base_sha":"base","body":"体","expected_execution_version":1,"files":["src/a.rs"],"id":"d1","phase":6,"plan":1,"plan_fingerprint":"f","plan_set_fingerprint":"s","policy":{"branch":"current","reviews":"disabled","rung":"fixed"},"prompt_bytes":3,"requirements":["AC1"],"schema":1,"suite":"suite","tasks":[{"id":"T1","verify":["verify"]}]},"outcome":"dispatch","prompt":"体","status":"ok"}"##,
                "be9b2252281adc092fe110c20ddbc06d6063b987188839ca77c134aaceb7c604",
            ),
        ];
        for (expected, expected_digest) in fixtures {
            let envelope: ExecutionEnvelope = serde_json::from_str(expected).unwrap();
            let answer = PreparedAnswer::new(envelope).unwrap();
            assert_eq!(
                canonical_bytes(&answer.envelope).unwrap(),
                expected.as_bytes()
            );
            assert_eq!(answer.response_digest, expected_digest);
            match answer.receipt {
                Receipt::Compact { envelope } => assert_eq!(envelope, answer.envelope),
                Receipt::Dispatch {
                    dispatch_id,
                    prompt_bytes,
                } => {
                    assert_eq!(dispatch_id, "d1");
                    assert_eq!(prompt_bytes, 3);
                }
            }
        }
    }

    #[test]
    fn terminal_is_one_stable_public_envelope() {
        let expected = r#"{"code":"log-bound","reason":"the boundary scope reached its 256-transition limit","status":"refused"}"#;
        assert_eq!(
            canonical_bytes(&terminal_envelope()).unwrap(),
            expected.as_bytes()
        );
        assert_eq!(
            PreparedAnswer::new(terminal_envelope()).unwrap(),
            PreparedAnswer::new(terminal_envelope()).unwrap()
        );
    }

    #[test]
    fn canonical_unicode_escaping_and_integral_numbers_are_exact() {
        let source = r#"{"z":18446744073709551615,"b":-2147483648,"a":"日本語/\"\\\n\t\u0000é"}"#;
        let expected = r#"{"a":"日本語/\"\\\n\t\u0000é","b":-2147483648,"z":18446744073709551615}"#;
        assert_eq!(
            canonical_bytes(&serde_json::from_str::<Value>(source).unwrap()).unwrap(),
            expected.as_bytes()
        );
        assert!(canonical_bytes(&json!(1.5)).is_err());
        assert!(canonical_bytes(&json!(1.0)).is_err());
        assert_ne!(
            canonical_bytes(&json!("é")).unwrap(),
            canonical_bytes(&json!("e\u{301}")).unwrap()
        );
    }

    #[test]
    fn canonical_nested_key_permutations_ignore_order_but_arrays_and_facts_do_not() {
        let left: Value =
            serde_json::from_str(r#"{"z":[{"b":2,"a":1},3],"a":{"c":0,"b":1}}"#).unwrap();
        let right: Value =
            serde_json::from_str(r#"{"a":{"b":1,"c":0},"z":[{"a":1,"b":2},3]}"#).unwrap();
        assert_eq!(
            canonical_bytes(&left).unwrap(),
            canonical_bytes(&right).unwrap()
        );
        let mut changed = right;
        changed["z"].as_array_mut().unwrap().reverse();
        assert_ne!(
            crate::store::model::digest(&canonical_bytes(&left).unwrap()),
            crate::store::model::digest(&canonical_bytes(&changed).unwrap())
        );
        let fixture = json!({"status":"refused","code":"a","reason":"no","id":"D1"});
        for key in ["status", "code", "id"] {
            let mut changed = fixture.clone();
            changed[key] = json!("different");
            assert_ne!(
                crate::store::model::digest(&canonical_bytes(&fixture).unwrap()),
                crate::store::model::digest(&canonical_bytes(&changed).unwrap())
            );
        }
    }

    #[test]
    fn binary_reasons_truncate_on_utf8_boundaries_before_hashing() {
        for status in ["refused", "unknown", "not-applicable"] {
            let mut fixture = json!({"status":status,"code":"a","reason":"x".repeat(1023) + "体"});
            let envelope: ExecutionEnvelope = serde_json::from_value(fixture.clone()).unwrap();
            let answer = PreparedAnswer::new(envelope).unwrap();
            fixture["reason"] = json!("x".repeat(1023));
            assert_eq!(serde_json::to_value(&answer.envelope).unwrap(), fixture);
            assert_eq!(
                answer.response_digest,
                crate::store::model::digest(&canonical_bytes(&fixture).unwrap())
            );
        }
    }

    #[test]
    fn compact_limit_preserves_ids_or_replaces_whole_answer_before_mutation() {
        let envelope = |id: String| {
            Envelope::Ok(Success::JudgmentStop {
                phase: 6,
                dispatch_id: "d1".into(),
                blocker_ids: vec![id],
            })
        };
        let overhead = canonical_bytes(&envelope(String::new())).unwrap().len();
        let exact =
            PreparedAnswer::new(envelope("x".repeat(MAX_COMPACT_BYTES - overhead))).unwrap();
        assert_eq!(
            canonical_bytes(&exact.envelope).unwrap().len(),
            MAX_COMPACT_BYTES
        );
        assert!(!exact.too_large());
        let oversized =
            PreparedAnswer::new(envelope("x".repeat(MAX_COMPACT_BYTES - overhead + 1))).unwrap();
        assert!(oversized.too_large());
        assert!(matches!(oversized.receipt, Receipt::Compact { .. }));
    }

    #[test]
    fn dispatch_receipt_contains_references_and_never_prompt_or_body() {
        let fixture = json!({"schema":1,"id":"d1","expected_execution_version":1,
            "phase":6,"plan":1,"plan_fingerprint":"f","plan_set_fingerprint":"s",
            "requirements":[],"tasks":[],"suite":"suite","files":[],
            "policy":{"rung":"fixed","branch":"current","reviews":"disabled"},
            "base_sha":"base","prompt_bytes":20000,"body":"private body"});
        let dispatch = serde_json::from_value(fixture).unwrap();
        let answer = PreparedAnswer::new(Envelope::Ok(Success::Dispatch {
            dispatch,
            prompt: "p".repeat(20000),
        }))
        .unwrap();
        assert_eq!(
            serde_json::to_value(&answer.receipt).unwrap(),
            json!({"receipt":"dispatch","dispatch_id":"d1","prompt_bytes":20000})
        );
        assert!(!answer.too_large());
    }

    #[test]
    fn public_conversion_precedes_receipt_and_legacy_hash_is_not_canonical() {
        let response = Response::NextPlan { phase: 6, plan: 2 };
        let legacy = crate::store::model::digest(&serde_json::to_vec(&response).unwrap());
        let answer = PreparedAnswer::new(response.into_envelope()).unwrap();
        assert_ne!(legacy, answer.response_digest);
        assert_eq!(
            canonical_bytes(&answer.envelope).unwrap(),
            br#"{"outcome":"next-plan","phase":6,"plan":2,"status":"ok"}"#
        );
    }
}
