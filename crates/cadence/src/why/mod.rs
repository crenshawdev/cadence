//! "Why is this code like this", answered from the record: the git chain for
//! one path or line, joined to the phase, task, decision, deviation and review
//! record on disk and, for a phase a close pruned, to the same record read out
//! of git history (D-139). The rendered `text` is byte-identical to the frozen
//! 3.x renderer, cadence-core/bin/lib/why-render.mjs, which is the oracle the
//! owner checks against.

pub mod corpus;
pub mod git;
pub mod instructions;
pub mod render;

use serde::Serialize;

/// Where a recovered phase directory was read from: the prune commit, its
/// parent, and the tree under that parent.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Recovered {
    pub prune: String,
    pub parent: String,
    pub tree: String,
}

/// One index row as an entry carries it: the directory's own label,
/// milestone and phase, plus the commits table's cells verbatim.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Brief {
    pub label: String,
    pub milestone: Option<String>,
    pub phase: Option<String>,
    pub plan: String,
    pub task: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recovered: Option<Recovered>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slug: Option<String>,
}

/// Which decisions a resolved commit's task cites, and how.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct DecisionJoin {
    /// `task`, `plan`, `phase` or `absent`.
    pub scope: &'static str,
    pub ids: Vec<String>,
    pub lines: Vec<String>,
}

/// One surviving adjudication finding, as the renderer prints it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Finding {
    pub claim: String,
    pub failure_scenario: String,
    pub counter_evidence: Option<String>,
    pub fix_commit: Option<String>,
    pub file: Option<String>,
    pub line: Option<i64>,
    pub severity: Option<String>,
    pub base_id: Option<String>,
    pub head_id: Option<String>,
    pub record: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct ReviewJoin {
    pub records: usize,
    pub findings: Vec<Finding>,
    pub unresolved: Vec<Finding>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct DeclaringTask {
    pub ordinal: usize,
    pub title: String,
    pub declaration: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct DeclaredJoin {
    pub plan_file: Option<String>,
    pub tasks: Vec<DeclaringTask>,
}

/// A resolved commit with every record edge hung off it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Resolved {
    #[serde(flatten)]
    pub brief: Brief,
    pub decision: DecisionJoin,
    pub deviation: Vec<String>,
    pub review: ReviewJoin,
    pub declared: DeclaredJoin,
}

/// The close a pruned commit sits under.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Close {
    pub commit: String,
    pub label: Option<String>,
    pub date: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct ArchiveRow {
    pub origin: String,
    pub text: String,
}

/// The named gap under an unresolved commit.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Gap {
    pub close: Option<Close>,
    pub scope: Option<String>,
    pub paths: Vec<String>,
    pub archive: Vec<ArchiveRow>,
}

/// The one attach point every record edge hangs off.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "state", rename_all = "kebab-case")]
pub enum Join {
    Resolved(Box<Resolved>),
    Ambiguous { matches: Vec<Brief> },
    Unresolved {
        #[serde(skip_serializing_if = "Option::is_none")]
        gap: Option<Gap>,
    },
}

/// One chain entry with its join.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Entry {
    pub sha: String,
    pub date: String,
    #[serde(skip)]
    pub at: i64,
    pub subject: String,
    pub join: Join,
}
