//! The task record type and the `task-open` / `task-close` request shapes.
//!
//! The record is defined here for both homes: a treeless run composes it in
//! memory and calls it unrecorded; a rooted run (plan 2) persists it to the
//! store and renders it. Nothing in this module touches the store.
use crate::{
    envelope::Refusal,
    rail::risk_diff::Scan,
    store::{Error, Result},
};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

pub const RECORD_SCHEMA: &str = "task-1";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    Inline,
    Planned,
}

/// Whether a planning root exists, decided by the task boundary from the
/// root path itself and never inferred from an unrelated missing file.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Root {
    Absent { path: String },
    Present { path: String },
}

impl Root {
    pub fn classify(root: &Path) -> Result<Self> {
        let path = root.to_string_lossy().into_owned();
        match std::fs::symlink_metadata(root) {
            Ok(metadata) if metadata.is_dir() => Ok(Self::Present { path }),
            Ok(_) => Err(Error::Invalid(format!("planning root is not a directory: {path}"))),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(Self::Absent { path }),
            Err(error) => Err(Error::Io(format!("planning root {path}: {error}"))),
        }
    }
    pub fn path(&self) -> &str {
        match self {
            Self::Absent { path } | Self::Present { path } => path,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Commit {
    pub id: String,
    pub subject: String,
    pub files: Vec<String>,
}

/// The risk disposition done states. `blocked` is the one that is not done.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Risk {
    /// HEAD did not move: nothing landed, so nothing was scanned.
    Skipped,
    /// The range was scanned against the answered surfaces and held nothing.
    Clear { surfaces: Vec<String>, gate: String, scan: Scan },
    /// The range matched (or was inconclusive) under a gate that blocks done.
    Blocked { surfaces: Vec<String>, gate: String, scan: Scan, matched: Vec<String> },
    /// The range matched under a gate that states the match without blocking.
    Advisory { surfaces: Vec<String>, gate: String, scan: Scan, matched: Vec<String> },
}

/// Whether the record reached durable storage.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Recording {
    Unrecorded { reason: String },
    Recorded { path: String, revision: String },
}

/// The task record. Under a planning root plan 2 persists and renders it;
/// without one it is composed for the answer and never written.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Record {
    pub schema: String,
    pub slug: String,
    pub mode: Mode,
    pub description: String,
    pub token: String,
    pub root: Root,
    pub branch: String,
    pub start: String,
    pub head: String,
    pub commits: Vec<Commit>,
    pub files: Vec<String>,
    pub risk: Risk,
    pub report: String,
    pub recording: Recording,
}

/// One step of a planned task: an id, what it does, and how it is verified.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct PlanTask {
    pub id: String,
    pub action: String,
    pub verify: String,
}

/// One planned task's recorded outcome, named by the plan step id.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Outcome {
    pub task: String,
    pub result: String,
}

/// Open a task: explicit identity, inline or planned; never phase 0. A planned
/// task carries its small ordered plan, rendered to PLAN.md under a root.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Open {
    pub request_id: String,
    pub slug: String,
    pub mode: Mode,
    pub description: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub plan: Option<Vec<PlanTask>>,
}

/// What shipped, as text or as a file the caller wrote.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub enum Report {
    Text { text: String },
    File { path: String },
}

/// Close a task: the run token from open, the report, and the per-run risk
/// surface answer a treeless run has nowhere to persist.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Close {
    pub request_id: String,
    pub slug: String,
    pub token: String,
    pub report: Report,
    pub surfaces: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub outcomes: Option<Vec<Outcome>>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum Apply {
    #[serde(rename = "task-open")]
    Open { request: Open },
    #[serde(rename = "task-close")]
    Close { request: Close },
}

impl Apply {
    pub fn request_id(&self) -> &str {
        match self {
            Self::Open { request } => &request.request_id,
            Self::Close { request } => &request.request_id,
        }
    }
    pub fn slug(&self) -> &str {
        match self {
            Self::Open { request } => &request.slug,
            Self::Close { request } => &request.slug,
        }
    }
}

pub fn validate_slug(slug: &str) -> Result<()> {
    crate::debug::model::validate_slug(slug)
}

pub fn validate_description(description: &str) -> Result<()> {
    if description.trim().is_empty() || description.len() > 4096 {
        return Err(Error::Invalid("task description must be nonblank and at most 4096 bytes".into()));
    }
    Ok(())
}

pub fn validate_report(text: &str) -> Result<()> {
    if text.trim().is_empty() || text.len() > 65536 {
        return Err(Error::Invalid("task report must be nonblank and at most 65536 bytes".into()));
    }
    Ok(())
}

/// The reason a treeless record is unrecorded, in words.
pub fn unrecorded(root: &Root) -> Recording {
    Recording::Unrecorded { reason: format!("no planning root at {}: git is the record", root.path()) }
}

/// Compose the disposition from a scan and the configured gate. The rule for
/// what fires is the receipts rail's; only the gate's consequence is decided here.
pub fn disposition(scan: Scan, surfaces: Vec<String>, gate: &str) -> Risk {
    if !crate::rail::receipts::scan_requires_review(&scan) {
        return Risk::Clear { surfaces, gate: gate.into(), scan };
    }
    let matched = scan.matches.iter().map(|m| m.category.clone()).collect();
    match gate {
        "blocking" | "adjudicated" => Risk::Blocked { surfaces, gate: gate.into(), scan, matched },
        _ => Risk::Advisory { surfaces, gate: gate.into(), scan, matched },
    }
}

pub fn done(record: &Record) -> Value {
    json!({"status":"ok","outcome":"done","ephemeral":matches!(record.root, Root::Absent { .. }),"record":record})
}

pub fn blocked(record: &Record, transient: Value) -> Value {
    let Risk::Blocked { matched, scan, gate, .. } = &record.risk else {
        unreachable!("blocked answer needs a blocked disposition")
    };
    let signals = scan.matches.iter().map(|m| format!("{}: {}", m.category, m.signal)).collect::<Vec<_>>();
    let cause = if signals.is_empty() { "inconclusive scan".to_owned() } else { signals.join("; ") };
    Refusal::new("risk-blocked", format!("risk surface {} matched in {}..{} ({cause}); the {gate} gate refuses done",
            matched.join(", "), record.start, record.head))
        .rule("risk-gate").slot("request")
        .details(json!({"record":record,"transient":transient}))
        .value()
}

pub fn missing_file(path: &str, root: &Root) -> Value {
    Refusal::new("missing-file", format!("report file does not exist: {path}"))
        .rule("task-boundary").slot("request.report.path")
        .details(json!({"path":path,"root":root}))
        .value()
}

pub fn unknown_task(slug: &str, token: &str) -> Value {
    Refusal::new("unknown-task", format!("no open task named {slug} with token {token} in this resident"))
        .slot("request.token").details(json!({"slug":slug,"token":token})).value()
}

pub fn invalid(reason: impl Into<String>, slug: &str) -> Value {
    Refusal::new("task-invalid", reason).slot("request").details(json!({"slug":slug})).value()
}

pub fn reused() -> Value {
    Refusal::new("request-reused", "task request identity binds different inputs").slot("request.request_id").value()
}

pub fn validate_plan(plan: &[PlanTask]) -> Result<()> {
    if plan.is_empty() { return Err(Error::Invalid("a planned task needs at least one plan step".into())); }
    let mut ids = std::collections::BTreeSet::new();
    for step in plan {
        validate_slug(&step.id)?;
        if !ids.insert(&step.id) { return Err(Error::Invalid("plan step identities must be distinct".into())); }
        for field in [&step.action, &step.verify] {
            if field.trim().is_empty() || field.len() > 4096 {
                return Err(Error::Invalid("plan step action and verify must be nonblank and at most 4096 bytes".into()));
            }
        }
    }
    Ok(())
}

/// The reason a rooted record reached durable storage, named by its projection.
pub fn recorded(path: &str, revision: &str) -> Recording {
    Recording::Recorded { path: path.into(), revision: revision.into() }
}

pub fn done_recorded(record: &Record) -> Value {
    json!({"status":"ok","outcome":"done","ephemeral":false,"record":record})
}

// ---- Rooted store persistence (plan 2, D-209) ----
//
// A rooted task record is a store record under `data["task"]`, rendered to
// `.planning/tasks/<slug>/RECORD.md` (and PLAN.md beside it for a planned
// task). The 14 authored historical directories are never store records and
// this namespace never enumerates or overwrites them.

pub const NAMESPACE: &str = "task";
pub const STORE_SCHEMA: &str = "task-store-1";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StoreStatus { Open, Done }

/// One rooted task's durable record: the plan (planned tasks only), and the
/// close record once the task is done.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StoreRecord {
    pub slug: String,
    pub mode: Mode,
    pub description: String,
    pub status: StoreStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub plan: Option<Vec<PlanTask>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub record: Option<Record>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub outcomes: Option<Vec<Outcome>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StoreReceipt { pub request_id: String, pub answer: Value }

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StoreNamespace {
    pub schema: String,
    pub records: BTreeMap<String, StoreRecord>,
    pub requests: BTreeMap<String, StoreReceipt>,
}

/// The two rooted operations that persist: a planned open (installs PLAN.md)
/// and a close (installs RECORD.md). An inline open persists nothing.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum StoreApply {
    PlanOpen { request_id: String, slug: String, description: String, plan: Vec<PlanTask> },
    Close { request_id: String, slug: String, record: Box<Record>, outcomes: Option<Vec<Outcome>> },
}
impl StoreApply {
    pub fn request_id(&self) -> &str {
        match self { Self::PlanOpen { request_id, .. } | Self::Close { request_id, .. } => request_id }
    }
    pub fn slug(&self) -> &str {
        match self { Self::PlanOpen { slug, .. } | Self::Close { slug, .. } => slug }
    }
}

/// The store write for a rooted task: the owning root, the project, and the
/// operation. The record is composed from real git observations by the service
/// and carried here; the store and recovery replay these exact bytes.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Write {
    pub root_binding: String,
    pub project: PathBuf,
    pub apply: StoreApply,
}

pub fn store_namespace(data: &Value) -> Result<StoreNamespace> {
    let Some(raw) = data.get(NAMESPACE) else {
        return Ok(StoreNamespace { schema: STORE_SCHEMA.into(), records: BTreeMap::new(), requests: BTreeMap::new() });
    };
    let saved: StoreNamespace = serde_json::from_value(raw.clone())?;
    if saved.schema != STORE_SCHEMA { return Err(Error::Invalid("unsupported task namespace".into())); }
    for (slug, record) in &saved.records {
        validate_slug(slug)?;
        if slug != &record.slug
            || (record.mode == Mode::Planned) != record.plan.is_some()
            || (record.status == StoreStatus::Done) != record.record.is_some() {
            return Err(Error::Invalid("invalid task store record".into()));
        }
    }
    Ok(saved)
}

/// The single projection this record installs now: RECORD.md once the task is
/// done, otherwise the planned PLAN.md.
pub fn store_projection(record: &StoreRecord) -> Result<(String, Vec<u8>)> {
    Ok(match &record.record {
        Some(_) => (format!("task:{}", record.slug), super::render::record_markdown(record).into_bytes()),
        None => (format!("task-plan:{}", record.slug), super::render::plan_markdown(record).into_bytes()),
    })
}

pub fn store_answer(record: &StoreRecord) -> Value {
    json!({"status":"ok","record":record})
}

pub fn store_replay(data: &Value, write: &Write) -> Result<Option<Value>> {
    if let Some(saved) = store_namespace(data)?.requests.get(write.apply.request_id()) {
        return Ok(Some(saved.answer.clone()));
    }
    Ok(None)
}

/// The record this apply produces, without touching the store. The Store and
/// recovery rebuild this same transition; no caller supplies the record bytes
/// past this write.
pub fn store_outcome(data: &Value, write: &Write) -> Result<StoreRecord> {
    let saved = store_namespace(data)?;
    match &write.apply {
        StoreApply::PlanOpen { slug, description, plan, .. } => {
            validate_slug(slug)?;
            validate_description(description)?;
            validate_plan(plan)?;
            if saved.records.contains_key(slug) {
                return Err(Error::Invalid("task is already open under this root".into()));
            }
            Ok(StoreRecord { slug: slug.clone(), mode: Mode::Planned, description: description.clone(),
                status: StoreStatus::Open, plan: Some(plan.clone()), record: None, outcomes: None })
        }
        StoreApply::Close { slug, record, outcomes, .. } => {
            validate_slug(slug)?;
            if slug != &record.slug { return Err(Error::Invalid("close slug differs from its record".into())); }
            let (mode, plan) = match saved.records.get(slug) {
                Some(prior) if prior.status == StoreStatus::Done =>
                    return Err(Error::Invalid("task is already done under this root".into())),
                Some(prior) => (prior.mode, prior.plan.clone()),
                None => (record.mode, None),
            };
            if record.mode != mode { return Err(Error::Invalid("close mode differs from the open task".into())); }
            match (mode, outcomes) {
                (Mode::Planned, Some(outcomes)) => {
                    let ids: std::collections::BTreeSet<&str> = plan.iter().flatten().map(|s| s.id.as_str()).collect();
                    let mut seen = std::collections::BTreeSet::new();
                    for outcome in outcomes {
                        if outcome.result.trim().is_empty() || outcome.result.len() > 16384 {
                            return Err(Error::Invalid("planned outcome result must be nonblank and at most 16384 bytes".into()));
                        }
                        if !ids.contains(outcome.task.as_str()) || !seen.insert(outcome.task.as_str()) {
                            return Err(Error::Invalid("each planned outcome names a distinct plan step".into()));
                        }
                    }
                    if seen.len() != ids.len() {
                        return Err(Error::Invalid("a planned close records one outcome per plan step".into()));
                    }
                }
                (Mode::Planned, None) => return Err(Error::Invalid("a planned close records its outcomes".into())),
                (Mode::Inline, Some(_)) => return Err(Error::Invalid("an inline close records no outcomes".into())),
                (Mode::Inline, None) => {}
            }
            Ok(StoreRecord { slug: slug.clone(), mode, description: record.description.clone(),
                status: StoreStatus::Done, plan, record: Some((**record).clone()), outcomes: outcomes.clone() })
        }
    }
}

pub fn store_contribute(data: &Value, write: &Write) -> Result<Value> {
    if write.root_binding.is_empty() || store_replay(data, write)?.is_some() {
        return Err(Error::Invalid("task write requires a new root-bound request".into()));
    }
    let mut saved = store_namespace(data)?;
    let record = store_outcome(data, write)?;
    let answer = store_answer(&record);
    saved.records.insert(record.slug.clone(), record);
    saved.requests.insert(write.apply.request_id().into(),
        StoreReceipt { request_id: write.apply.request_id().into(), answer });
    let mut next = data.clone();
    next[NAMESPACE] = serde_json::to_value(saved)?;
    Ok(next)
}
