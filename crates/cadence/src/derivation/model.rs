use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LifecycleStatus {
    Unplanned,
    Planned,
    Executed,
    Complete,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Cycle {
    Live,
    Closed,
}

/// Numeric identity uses the frozen reader's binary64 Number semantics.
#[derive(Clone, Copy, Debug, PartialEq, PartialOrd, Serialize, Deserialize)]
#[serde(transparent)]
pub struct PhaseId(pub(crate) f64);

impl PhaseId {
    pub fn number(self) -> f64 {
        self.0
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct UatCounts {
    pub pass: usize,
    pub fail: usize,
    pub pending: usize,
    pub skipped: usize,
    pub blocked: usize,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct UatItem {
    pub status: Option<String>,
    pub reason: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ParsedUat {
    pub items: Vec<UatItem>,
    pub counts: UatCounts,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct PhaseRecord {
    pub id: PhaseId,
    pub name: String,
    pub plans: Vec<String>,
    pub status: LifecycleStatus,
    pub uat: Option<UatCounts>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Lifecycle {
    pub cycle: Cycle,
    pub current: Option<PhaseId>,
    pub total: usize,
    pub phases: Vec<PhaseRecord>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum InputFailureCategory {
    PermissionDenied,
    NotDirectory,
    InvalidPath,
    SymlinkLoop,
    OtherIo,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct InputFailure {
    pub path: PathBuf,
    pub category: InputFailureCategory,
    pub diagnostic: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Observation<T> {
    Present(T),
    Absent,
    Failed(InputFailure),
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct RoadmapPhase {
    pub id: PhaseId,
    pub name: String,
    pub description: String,
    pub checked: bool,
    /// One-based line in the normalized document.
    pub source_line: usize,
    /// Zero-based textual order before numeric sorting.
    pub ordinal: usize,
    /// Shared observation address, relative to the planning root.
    pub relative_path: PathBuf,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ParsedRoadmap {
    pub cycle: Cycle,
    pub phases: Vec<RoadmapPhase>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PhaseObservation {
    pub relative_path: PathBuf,
    /// Listing outcome with only admitted basenames, in lexical order.
    pub plans: Observation<Vec<String>>,
    pub summary: Observation<()>,
    pub uat: Observation<Vec<u8>>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct CapturedInputs {
    pub root: PathBuf,
    pub root_probe: Observation<()>,
    pub roadmap: Observation<Vec<u8>>,
    pub declarations: Option<Result<ParsedRoadmap, DerivationError>>,
    /// One entry per distinct address, in first declaration order.
    pub phases: Vec<PhaseObservation>,
}

/// Further consistency and memo refusals extend this shared error vocabulary.
#[non_exhaustive]
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum DerivationError {
    InvalidStatus {
        source: String,
        original_status: String,
    },
    MissingPlanningRoot {
        path: PathBuf,
    },
    MissingRoadmap {
        path: PathBuf,
    },
    InvalidRoadmap {
        detail: String,
    },
    InputFailure(InputFailure),
    InputsChanged,
}

impl DerivationError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidStatus { .. } => "invalid-status",
            Self::MissingPlanningRoot { .. } => "missing-planning-root",
            Self::MissingRoadmap { .. } => "missing-roadmap",
            Self::InvalidRoadmap { .. } => "invalid-roadmap",
            Self::InputFailure(_) => "input-error",
            Self::InputsChanged => "inputs-changed",
        }
    }
}

impl std::fmt::Display for DerivationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {self:?}", self.code())
    }
}
impl std::error::Error for DerivationError {}

/// Untouched compatibility evidence, including fields from unavailable input.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct CursorProvenance {
    pub source: String,
    pub original_cursor: serde_json::Value,
    pub source_bytes: Option<Vec<u8>>,
    pub phase: Option<PhaseId>,
    pub total: Option<u64>,
    pub name: Option<String>,
    pub original_status: Option<String>,
    pub next: Option<String>,
    pub updated: Option<String>,
    pub original_fields: Option<serde_json::Value>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum CompatibilityCursor {
    Unavailable(CursorProvenance),
    Assertion {
        status: LifecycleStatus,
        provenance: CursorProvenance,
    },
    Held(CursorProvenance),
}

impl CompatibilityCursor {
    pub fn provenance(&self) -> &CursorProvenance {
        match self {
            Self::Unavailable(p) | Self::Held(p) | Self::Assertion { provenance: p, .. } => p,
        }
    }
}
