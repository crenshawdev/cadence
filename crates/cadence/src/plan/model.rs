//! Exact caller-owned publication proposals; approval metadata is never frontmatter.
use cadence::execution::model::TaskSpec;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{collections::BTreeMap, num::NonZeroU32};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Identity {
    pub phase: NonZeroU32,
    pub plan: NonZeroU32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Execution {
    pub schema: u32,
    pub suite: String,
    pub tasks: Vec<TaskSpec>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Content {
    pub phase: NonZeroU32,
    pub plan: NonZeroU32,
    pub requirements: Vec<String>,
    pub files: Vec<String>,
    #[serde(default)]
    pub directories: Vec<String>,
    pub execution: Execution,
    /// UTF-8 Markdown, including its original line endings and final newline.
    pub body: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Entry {
    pub target: Identity,
    pub content: Content,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub replacement: Option<ReplacementApproval>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ReplacementApproval {
    pub approved: bool,
    pub owner: Option<String>,
    pub at: Option<String>,
    pub target: Identity,
    pub old_revision: String,
    pub old_document: String,
    pub content: Content,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Submission {
    pub phase: NonZeroU32,
    /// Explicit active-cycle lifetime, established only by approved publication.
    pub occurrence: String,
    pub request_id: String,
    pub inventory_basis: String,
    pub plans: Vec<Entry>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
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
    #[serde(rename = "plan-submit")]
    Submit {
        submission: Submission,
        approval: Option<Approval>,
    },
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Publication {
    pub identity: Identity,
    pub occurrence: String,
    pub revision: String,
    pub content: Content,
    pub approval: Approval,
    pub readiness: Readiness,
    pub history: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum Readiness {
    ProvisionalAuthoring,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Receipt {
    pub payload_digest: String,
    pub results: Vec<Publication>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Occurrence {
    pub id: String,
    pub phase: u32,
    pub cycle: String,
    pub high_water: u32,
    pub consumed: Vec<u32>,
    #[serde(default)]
    pub provenance: BTreeMap<u32, std::collections::BTreeSet<String>>,
    pub publications: BTreeMap<u32, Publication>,
    pub receipts: BTreeMap<String, Receipt>,
}

pub type Answer = cadence::context::model::Answer;

pub fn ok(operation: &str, data: Value) -> Answer {
    cadence::context::model::ok(operation, data)
}

pub fn refused(rule: &str, reason: impl Into<String>) -> Answer {
    Answer::Refused {
        code: "invalid-plan".into(),
        reason: reason.into(),
        rule: rule.into(),
        slot: "submission".into(),
        phase: None,
        entry: None,
        id: None,
    }
}

pub fn contract() -> Value {
    json!(schemars::schema_for!(Apply))
}
