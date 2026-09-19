use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::num::NonZeroU32;

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "kebab-case", deny_unknown_fields)]
pub enum Scope {
    Project,
    Directory { selector: String },
    Glob { selector: String },
    CurrentTaskLease {
        phase: NonZeroU32,
        occurrence: String,
        plan: NonZeroU32,
        task: String,
    },
}

#[derive(Clone, Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct SearchRequest {
    pub pattern: String,
    pub scope: Scope,
    pub case_insensitive: Option<bool>,
    pub cursor: Option<String>,
}

/// Which files a scope holds, with a reference to read each one.
#[derive(Clone, Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ListRequest {
    pub scope: Scope,
    pub cursor: Option<String>,
}

/// Which parts of one phase's process records mention a pattern. Answered
/// with identities and parts for `document`, never with bodies.
#[derive(Clone, Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct DocumentSearchRequest {
    pub phase: NonZeroU32,
    pub pattern: String,
    pub case_insensitive: Option<bool>,
}

#[derive(Clone, Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ReadRequest {
    pub location: Option<String>,
    pub file: Option<String>,
    pub unit: Option<String>,
}

#[derive(Clone, Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct DocumentRequest {
    pub identity: DocumentIdentity,
    /// The name of one part returned by the document index.
    pub part: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "kebab-case", deny_unknown_fields)]
pub enum DocumentIdentity {
    ReviewEntry { attempt: String, entry: String },
    Dispatch { id: String },
    RunOutput { phase: NonZeroU32, run: String },
    VerificationAttempt { phase: NonZeroU32, attempt: String },
    PlanDraft { phase: NonZeroU32, plan: NonZeroU32, digest: String },
    ContextDraft { phase: NonZeroU32, digest: String },
    PhaseContext { phase: NonZeroU32 },
    PhasePlan { phase: NonZeroU32, plan: NonZeroU32 },
    PhaseRoadmapRow { phase: NonZeroU32 },
    TaskSummary {
        phase: NonZeroU32,
        occurrence: String,
        plan: NonZeroU32,
        task: String,
    },
    PlannerRound {
        phase: NonZeroU32,
        session_id: String,
        first_turn: String,
        last_turn: String,
    },
}

/// One named span of a file: a function, a heading, a JSON member, or the
/// whole file when it has no grammar. `first_line..=last_line` is 1-based and
/// inclusive; `first_byte..last_byte` is the same span in bytes, including the
/// final newline, so a slice serves exactly the lines the range names.
#[derive(Clone, Debug, Serialize)]
pub struct Unit {
    pub name: String,
    pub bare: String,
    pub kind: &'static str,
    pub first_line: usize,
    pub last_line: usize,
    pub first_byte: usize,
    pub last_byte: usize,
}

impl Unit {
    pub fn range(&self) -> [usize; 2] { [self.first_line, self.last_line] }
}
