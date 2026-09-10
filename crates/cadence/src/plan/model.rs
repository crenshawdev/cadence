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
    /// Absence is retained only for historical phase-27 publications.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub evidence_map: Option<super::evidence::Map>,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub map_revision: Option<String>,
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

/// Plan refusals extend their own compatible envelope, not context's contract.
#[derive(Debug, Serialize, JsonSchema)]
#[serde(tag = "status", rename_all = "kebab-case")]
pub enum Answer {
    Ok {
        operation: String,
        #[serde(flatten)]
        data: serde_json::Map<String, Value>,
    },
    Refused {
        code: String,
        reason: String,
        rule: String,
        slot: String,
        phase: Option<u32>,
        entry: Option<usize>,
        id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        details: Option<Details>,
    },
    Unknown { reason: String },
    NotApplicable { reason: String },
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(untagged)]
pub enum Details {
    CheckConflict { truth_id: String, truth_version: u32, checks: Vec<CheckConflict> },
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct CheckConflict {
    pub id: String,
    pub origins: Vec<CheckOrigin>,
}

#[derive(Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct CheckOrigin {
    pub phase: u32,
    pub plan: u32,
    pub source: Source,
    pub slot: String,
}

#[derive(Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum Source { Proposed, Saved }

pub fn ok(operation: &str, data: Value) -> Answer {
    Answer::Ok { operation: operation.into(), data: data.as_object().expect("plan output object").clone() }
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
        details: None,
    }
}

pub fn contract() -> Value {
    json!(schemars::schema_for!(Apply))
}

/// Located domain failures survive both the service and transaction algebra.
#[derive(Debug, Serialize, Deserialize)]
pub struct Diagnostic {
    pub rule: String,
    pub slot: String,
    pub phase: Option<u32>,
    pub entry: Option<usize>,
    pub id: Option<String>,
    pub reason: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub details: Option<Details>,
}

impl Diagnostic {
    pub fn error(self) -> cadence::store::Error {
        cadence::store::Error::Invalid(format!("plan-refusal:{}", serde_json::to_string(&self).expect("diagnostic")))
    }

    pub fn answer(self) -> Answer {
        Answer::Refused { code: "invalid-plan".into(), rule: self.rule, slot: self.slot,
            phase: self.phase, entry: self.entry, id: self.id, reason: self.reason, details: self.details }
    }
}
