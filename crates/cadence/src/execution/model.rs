use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

pub const EXECUTION_SCHEMA: u32 = 1;
pub const PATCH_SCHEMA: u32 = 1;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TaskSpec {
    pub id: String,
    pub verify: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct ExecutionPlan {
    pub phase: u32,
    pub plan: u32,
    pub requirements: Vec<String>,
    pub files: Vec<String>,
    pub schema: u32,
    pub suite: String,
    pub tasks: Vec<TaskSpec>,
    pub body: String,
    pub fingerprint: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ExecutorRung {
    Fixed,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum BranchPolicy {
    Current,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ReviewPolicy {
    Disabled,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DispatchPolicy {
    pub rung: ExecutorRung,
    pub branch: BranchPolicy,
    pub reviews: ReviewPolicy,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ActiveDispatch {
    pub schema: u32,
    pub id: String,
    pub expected_execution_version: u64,
    pub phase: u32,
    pub plan: u32,
    pub plan_fingerprint: String,
    pub plan_set_fingerprint: String,
    pub requirements: Vec<String>,
    pub tasks: Vec<TaskSpec>,
    pub suite: String,
    pub files: Vec<String>,
    pub policy: DispatchPolicy,
    pub base_sha: String,
    pub prompt_bytes: u64,
    #[serde(default)]
    pub body: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum VerificationDisposition {
    Passed,
    Failed,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CommandReceipt {
    pub command: String,
    pub exit_code: i32,
    pub output_digest: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct VerificationReceipt {
    pub disposition: VerificationDisposition,
    pub commands: Vec<CommandReceipt>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case", deny_unknown_fields)]
pub enum EvidenceReference {
    Commit { sha: String },
    FileLine { path: String, line: u64 },
    Criterion { id: String },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Deviation {
    pub id: String,
    pub text: String,
    pub evidence: Vec<EvidenceReference>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Blocker {
    pub id: String,
    pub text: String,
    pub evidence: Vec<EvidenceReference>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "kebab-case", deny_unknown_fields)]
pub enum TaskOutcome {
    Completed {
        task_id: String,
        commit: String,
        verification: VerificationReceipt,
        evidence: Vec<EvidenceReference>,
    },
    Blocked {
        task_id: String,
        blocker_id: String,
    },
    NotRun {
        task_id: String,
    },
}

impl TaskOutcome {
    pub fn task_id(&self) -> &str {
        match self {
            Self::Completed { task_id, .. }
            | Self::Blocked { task_id, .. }
            | Self::NotRun { task_id } => task_id,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PlanDisposition {
    Complete,
    Blocked,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PlanOutcome {
    pub dispatch_id: String,
    pub phase: u32,
    pub plan: u32,
    pub disposition: PlanDisposition,
    pub tasks: Vec<TaskOutcome>,
    pub deviations: Vec<Deviation>,
    pub blockers: Vec<Blocker>,
    #[serde(default)]
    pub commit_paths: BTreeMap<String, Vec<String>>,
    pub transition_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "kebab-case", deny_unknown_fields)]
pub enum TerminalOutcome {
    Complete {
        phase: u32,
    },
    JudgmentStop {
        dispatch_id: String,
        blocker_ids: Vec<String>,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AppliedReceipt {
    pub dispatch_id: String,
    pub request_digest: String,
    pub transition_id: String,
    pub outcome: PlanOutcome,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExecutionOccurrence {
    pub phase: u32,
    pub plan_set_fingerprint: String,
    pub version: u64,
    pub active: Option<ActiveDispatch>,
    pub plans: Vec<PlanOutcome>,
    pub terminal: Option<TerminalOutcome>,
    pub receipts: BTreeMap<String, AppliedReceipt>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExecutionSnapshot {
    pub schema: u32,
    pub occurrences: BTreeMap<String, ExecutionOccurrence>,
}

impl Default for ExecutionSnapshot {
    fn default() -> Self {
        Self {
            schema: EXECUTION_SCHEMA,
            occurrences: BTreeMap::new(),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PatchKind {
    Executor,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExecutorPatch {
    pub schema: u32,
    pub kind: PatchKind,
    pub dispatch_id: String,
    pub expected_execution_version: u64,
    pub outcome: PlanDisposition,
    pub tasks: Vec<TaskOutcome>,
    pub deviations: Vec<Deviation>,
    pub blockers: Vec<Blocker>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum BoundaryTool {
    CadenceQuery,
    CadenceApply,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BoundaryDecision {
    pub phase: u32,
    pub tool: BoundaryTool,
    pub operation: String,
    pub request_digest: String,
    pub outcome: String,
    pub subject_id: Option<String>,
    pub prompt_bytes: Option<u64>,
    pub response_digest: String,
}
