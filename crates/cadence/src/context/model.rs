//! Caller-owned drafts, approved as one complete value.
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct TruthSlots {
    pub id: String,
    pub trigger: Option<String>,
    pub observer: Option<String>,
    pub verb: Option<String>,
    pub outcome: Option<String>,
    pub kind: Option<String>,
    pub observable: Option<bool>,
    pub fixed_oracle: Option<bool>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Decision {
    pub id: String,
    pub text: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Submission {
    pub phase: std::num::NonZeroU32,
    pub title: String,
    pub scope: String,
    pub durable_decisions: Vec<Decision>,
    pub decisions: Vec<Decision>,
    pub assumptions: Vec<String>,
    pub truths: Vec<TruthSlots>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Approval {
    pub approved: bool,
    pub owner: Option<String>,
    pub at: Option<String>,
    pub submission: Option<Submission>,
}

#[derive(Clone, Debug, Deserialize, JsonSchema)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum Apply {
    #[serde(rename = "context-submit")]
    Submit { submission: Submission, approval: Option<Approval> },
}

#[derive(Debug, Serialize, JsonSchema)]
#[serde(tag = "status", rename_all = "kebab-case")]
pub enum Answer {
    Ok { operation: String, #[serde(flatten)] data: serde_json::Map<String, Value> },
    Refused {
        code: String,
        reason: String,
        rule: String,
        slot: String,
        phase: Option<u32>,
        entry: Option<usize>,
        id: Option<String>,
    },
    Unknown { reason: String },
    NotApplicable { reason: String },
}

pub fn ok(operation: &str, data: Value) -> Answer {
    Answer::Ok { operation: operation.into(), data: data.as_object().expect("context output object").clone() }
}

pub fn refused(rule: &str, slot: &str, reason: impl Into<String>, phase: Option<u32>, entry: Option<usize>, id: Option<String>) -> Answer {
    Answer::Refused { code: "invalid-context".into(), reason: reason.into(), rule: rule.into(), slot: slot.into(), phase, entry, id }
}
