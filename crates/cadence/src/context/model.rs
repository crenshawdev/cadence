//! Caller-owned drafts, approved as one complete value.
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct TruthSlots {
    pub id: String,
    #[schemars(required)]
    pub trigger: Option<String>,
    /// One party: the literal separators " and ", " & ", comma and semicolon are refused.
    #[schemars(required)]
    pub observer: Option<String>,
    #[schemars(with = "Verb")]
    pub verb: Option<String>,
    #[schemars(required)]
    pub outcome: Option<String>,
    #[schemars(with = "Kind")]
    pub kind: Option<String>,
    /// Owner attestation, never an internal-name classifier.
    #[schemars(required)]
    pub observable: Option<bool>,
    /// Separate owner attestation; approval or observability cannot imply it.
    #[schemars(required)]
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

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum Kind { Literal, Property }

#[derive(JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum Verb { Sees, Gets, #[serde(rename = "is refused")] IsRefused }

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum Status { Pending, Met, Concerns, Unmet, Waived }

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Truth {
    pub id: String,
    pub phase: u32,
    pub version: u32,
    pub pattern: String,
    pub text: String,
    pub kind: Kind,
    pub status: Status,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ApprovedContext {
    pub submission: Submission,
    pub approval: Approval,
    pub truths: Vec<Truth>,
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
