//! Strict public vocabulary. Declaring an operation does not implement it.
use crate::execution::{admission::Binding, allocation::Check, receipts::OwnerApproval};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct TruthVersion {
    pub id: String,
    pub version: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Source {
    pub head: String,
    pub tree: String,
    pub index_digest: String,
    pub material_digest: String,
}

/// Every contributing content revision and the complete coherent map identity.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Basis {
    pub project: String,
    pub root_binding: String,
    pub phase: u32,
    pub occurrence: String,
    pub context_digest: String,
    pub truths: Vec<TruthVersion>,
    pub publications: Vec<Binding>,
    pub map_digest: String,
    pub admission_digests: Vec<String>,
    pub execution_digest: String,
    pub source: Source,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Verdict { Accepted, Rejected, NotSeen }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ItemVerdict {
    pub id: String,
    pub item_revision: String,
    pub verdict: Verdict,
    pub observed: String,
    pub runs: Vec<String>,
}

/// One complete phase-attempt patch; no aggregate verdict or writing arm.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Patch {
    pub request_id: String,
    pub attempt: String,
    pub basis: Basis,
    pub items: Vec<ItemVerdict>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Run {
    pub request_id: String,
    pub attempt: String,
    pub basis: Basis,
    pub item: Check,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Waiver {
    pub truth: TruthVersion,
    pub basis: Basis,
    pub reason: String,
    pub owner: String,
    pub at: String,
    pub supersedes: Option<String>,
    pub revoked: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum HumanOutcome { Passed, Failed, Skipped }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct HumanResult {
    pub phase: u32,
    pub occurrence: String,
    pub id: String,
    pub reply: String,
    pub outcome: HumanOutcome,
    pub owner: String,
    pub at: String,
    pub supersedes: Option<String>,
}

/// Query vocabulary is kept separate from caller-authored item judgments.
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum Query {
    #[serde(rename = "verify-next")]
    Next { phase: u32, request_id: Option<String> },
    #[serde(rename = "verification-read")]
    Read { phase: u32, attempt: Option<String> },
    /// Read-only; `command` selects the cad-audit view or its cad-coverage alias.
    #[serde(rename = "verification-audit")]
    Audit { phase: u32, command: Option<String> },
}

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum Apply {
    #[serde(rename = "verification-run")]
    Run { request: Box<Run> },
    #[serde(rename = "verification-submit")]
    Submit { patch: Box<Patch> },
    #[serde(rename = "truth-waive")]
    Waive { request_id: String, submission: Box<Waiver>, approval: Box<OwnerApproval<Waiver>> },
    #[serde(rename = "verification-human-result")]
    Human { request_id: String, submission: Box<HumanResult>, approval: Box<OwnerApproval<HumanResult>> },
    #[serde(rename = "verification-complete")]
    Complete { request_id: String, attempt: String, basis: Box<Basis>, projections: Box<Projections> },
}

/// The caller's expected projection preimages: the digest of ROADMAP.md and,
/// when it exists, REQUIREMENTS.md as the owner last read them. A stale
/// digest refuses completion instead of rewriting a document the owner has
/// not seen.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Projections {
    pub roadmap: String,
    pub requirements: Option<String>,
}
