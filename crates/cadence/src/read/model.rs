use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::num::NonZeroU32;

#[derive(Clone, Debug, Deserialize, JsonSchema)]
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
    PhaseDocuments { phase: NonZeroU32 },
}

#[derive(Clone, Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct SearchRequest {
    pub pattern: String,
    pub scope: Scope,
    pub case_insensitive: Option<bool>,
    pub cursor: Option<String>,
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
    pub part: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "kebab-case", deny_unknown_fields)]
pub enum DocumentIdentity {
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

#[derive(Clone, Debug, Serialize)]
pub struct Unit {
    pub name: String,
    pub bare: String,
    pub kind: String,
    pub first_line: usize,
    pub last_line: usize,
    pub first_byte: usize,
    pub last_byte: usize,
}

impl Unit {
    pub fn range(&self) -> [usize; 2] { [self.first_line, self.last_line] }
}
