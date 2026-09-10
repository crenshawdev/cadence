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

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct OwnerInput {
    pub request_id: String,
    pub task: super::history::Task,
    pub attempt: String,
    pub expected_version: u64,
    pub statement: OwnerStatement,
}

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum OwnerApply {
    /// Records the owner's inspection; validates its binding, not its truth.
    #[serde(rename = "execution-owner-attest")]
    Attest { request: OwnerInput },
}

pub fn validate_approval<T: PartialEq>(submission: &T, approval: &OwnerApproval<T>) -> bool {
    approval.approved && !approval.owner.trim().is_empty() && !approval.at.trim().is_empty() && approval.submission == *submission
}

pub fn validate_inspection(records: &[super::history::Record], task: &super::history::Task, statement: &OwnerStatement) -> crate::store::Result<()> {
    use super::history::Event;
    let inspection = &statement.submission;
    let refuse = |reason: &str| super::admission::refuse(task.phase, "owner-inspection", "statement", &inspection.check.id, reason);
    if !validate_approval(inspection, &statement.approval) {
        return Err(refuse("actual attributed/timed owner approval must echo the exact inspection payload"));
    }
    if inspection.evidence.is_empty() || inspection.test_digest.is_empty() {
        return Err(refuse("inspection requires exact test material and inspected run evidence"));
    }
    let mut seen = std::collections::BTreeSet::new();
    for reference in &inspection.evidence {
        if !seen.insert(reference) { return Err(refuse("ambiguous repeated inspection reference")); }
        let launch = records.iter().find_map(|r| match &r.request.event {
            Event::Launch(launch) if r.request.task == *task && &launch.run_id == reference => Some(launch), _ => None,
        }).ok_or_else(|| refuse("inspection reference has no retained launch for this task"))?;
        if launch.check.as_ref() != Some(&inspection.check) || launch.material.test_digest != inspection.test_digest
            || !records.iter().any(|r| r.request.task == *task && matches!(&r.request.event, Event::Result(result) if &result.run_id == reference)) {
            return Err(refuse("inspection revision, test material or observed evidence is stale"));
        }
    }
    if let Some(supersedes) = &statement.supersedes
        && !records.iter().any(|r| r.request.task == *task && r.request.request_id == *supersedes
            && matches!(&r.request.event, Event::OwnerStatement(prior) if prior.submission.check == inspection.check)) {
        return Err(refuse("superseding statement must link its prior statement"));
    }
    Ok(())
}

pub fn owner_eligible(statement: &OwnerStatement, check: &Check, test_digest: &str, evidence: &[String]) -> bool {
    validate_approval(&statement.submission, &statement.approval) && statement.submission.no_subject_stub
        && statement.submission.check == *check && statement.submission.test_digest == test_digest
        && statement.submission.evidence == evidence
}
