use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::num::NonZeroU32;

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
    TaskRecord { slug: String },
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
    CodexRollout { session_id: String },
}
