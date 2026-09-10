//! Native evidence is recorded separately from historical executor receipts.
use super::allocation::Check;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Material {
    pub commit: String,
    pub tree: String,
    pub test_file: String,
    pub test_digest: String,
    pub command: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum Stage { Red, Green, Verify }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Launch {
    pub run_id: String,
    pub check: Option<Check>,
    pub stage: Stage,
    pub material: Material,
    pub launched_at: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "kebab-case", deny_unknown_fields)]
pub enum Disposition { Exited { code: i32 }, Signaled { signal: i32 }, LaunchFailed { reason: String } }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Capture {
    pub bytes: Vec<u8>,
    pub digest: String,
    pub complete: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "class", rename_all = "kebab-case", deny_unknown_fields)]
pub enum Observation {
    Unknown,
    ResultsObserved { summary: Summary },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "runner", rename_all = "kebab-case", deny_unknown_fields)]
pub enum Summary {
    Cargo { failed: bool },
    Unittest { failed: bool, failures: u64, errors: u64 },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct RunResult {
    pub run_id: String,
    pub disposition: Disposition,
    pub stdout: Capture,
    pub stderr: Capture,
    pub observed_at: u64,
    pub observation: Observation,
    pub material_unchanged: bool,
}

impl RunResult {
    /// Both streams belong to the output identity; neither can be substituted.
    pub fn output_identity(&self) -> String {
        crate::store::model::digest(format!("{}\n{}", self.stdout.digest, self.stderr.digest).as_bytes())
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Inspection {
    pub check: Check,
    pub test_digest: String,
    pub evidence: Vec<String>,
    pub no_subject_stub: bool,
}

/// Approval echoes the exact payload, following native context/plan approval.
/// A caller's role label alone is never an approval.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct OwnerApproval<T> {
    pub approved: bool,
    pub owner: String,
    pub at: String,
    pub submission: T,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct OwnerStatement {
    pub submission: Inspection,
    pub approval: OwnerApproval<Inspection>,
    pub supersedes: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum Interpretation { RedEligible, GreenEligible }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Classification {
    pub run_id: String,
    pub output_identity: String,
    pub check: Check,
    pub interpretation: Interpretation,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct OwnerClassification {
    pub submission: Classification,
    pub approval: OwnerApproval<Classification>,
}
