//! Immutable native task events and a separately derived current projection.
use super::{admission, allocation::Check, receipts::*};
use crate::store::{Error, Result, model::{digest, DecisionRecord, Decision, Origin, Evidence}};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

pub const NAMESPACE: &str = "native_tasks";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Task {
    pub phase: u32,
    pub occurrence: String,
    pub admission_digest: String,
    pub plan: u32,
    pub task: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "kebab-case", deny_unknown_fields)]
pub enum Event {
    Attempt { predecessor: Option<String>, checks: Vec<Check>, base_commit: String },
    Launch(Launch),
    Result(RunResult),
    OwnerStatement(OwnerStatement),
    OwnerClassification(OwnerClassification),
    Progress { text: String, evidence: Vec<String> },
    FailedAttempt { reason: String, evidence: Vec<String> },
    Deviation { text: String, evidence: Vec<String> },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub request_id: String,
    pub task: Task,
    pub attempt: String,
    pub expected_version: u64,
    pub event: Event,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Record {
    pub schema: String,
    pub root_binding: String,
    pub version: u64,
    pub request_digest: String,
    pub request: Request,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Projection {
    pub version: u64,
    pub attempt: Option<String>,
    pub completed: bool,
    pub progress: Vec<String>,
    pub unknown_runs: Vec<String>,
}

pub fn records(data: &Value, phase: u32) -> Result<Vec<Record>> {
    let Some(namespace) = data.get(NAMESPACE) else { return Ok(vec![]) };
    if namespace["schema"] != "native-tasks-1" {
        return Err(admission::refuse(phase, "task-schema", NAMESPACE, "", "unsupported native task history"));
    }
    namespace["phases"].get(phase.to_string()).cloned().map(serde_json::from_value)
        .transpose().map(|r| r.unwrap_or_default()).map_err(Error::from)
}

pub fn project(records: &[Record], task: &Task) -> Projection {
    let mut projection = Projection { version: 0, attempt: None, completed: false, progress: vec![], unknown_runs: vec![] };
    for record in records.iter().filter(|r| r.request.task == *task) {
        projection.version = record.version;
        match &record.request.event {
            Event::Attempt { .. } => projection.attempt = Some(record.request.attempt.clone()),
            Event::Launch(launch) => projection.unknown_runs.push(launch.run_id.clone()),
            Event::Result(result) => projection.unknown_runs.retain(|id| id != &result.run_id),
            Event::Progress { text, .. } => projection.progress.push(text.clone()),
            _ => {}
        }
    }
    projection
}

pub fn request_digest(request: &Request) -> Result<String> {
    Ok(digest(&super::boundary::canonical_bytes(request).map_err(|e| Error::Invalid(e.to_string()))?))
}

pub fn replay(data: &Value, root: &str, request: &Request) -> Result<Option<Record>> {
    if let Some(record) = records(data, request.task.phase)?.into_iter().find(|r| r.request.request_id == request.request_id) {
        if record.root_binding != root || record.request != *request || record.request_digest != request_digest(request)? {
            return Err(admission::refuse(request.task.phase, "task-request-reuse", "request_id", &request.request_id, "request already names another payload or root"));
        }
        return Ok(Some(record));
    }
    Ok(None)
}

pub fn contribute(data: &Value, root: &str, request: &Request) -> Result<(Value, Record)> {
    if let Some(record) = replay(data, root, request)? { return Ok((data.clone(), record)) }
    let task = &request.task;
    let refuse = |rule: &str, reason: &str| admission::refuse(task.phase, rule, "task", &task.task, reason);
    if request.request_id.trim().is_empty() || request.attempt.trim().is_empty() {
        return Err(refuse("task-identity", "request and attempt identities required"));
    }
    let admissions = admission::records(data, task.phase)?;
    let basis = admissions.iter().find(|r| r.request_digest == task.admission_digest && r.root_binding == root
        && r.request.contract.occurrence == task.occurrence)
        .ok_or_else(|| refuse("task-admission", "task must name its immutable admission and bound root"))?;
    let assignment = basis.request.contract.allocation.iter().find(|a| a.plan == task.plan && a.task == task.task)
        .ok_or_else(|| refuse("task-allocation", "task is not in this admission"))?;
    // A gap extension never rekeys the original task's receipt identity.
    if admissions.iter().take_while(|r| r.request_digest != task.admission_digest)
        .any(|r| r.request.contract.allocation.iter().any(|a| a.plan == task.plan && a.task == task.task)) {
        return Err(refuse("task-admission", "use the task's original admission basis"));
    }
    let mut history = records(data, task.phase)?;
    let projection = project(&history, task);
    if request.expected_version != projection.version {
        return Err(refuse("task-version", "expected task version is stale"));
    }
    match &request.event {
        Event::Attempt { predecessor, checks, base_commit } => {
            if *checks != assignment.checks || base_commit.is_empty() || *predecessor != projection.attempt
                || history.iter().any(|r| r.request.task == *task && r.request.attempt == request.attempt) {
                return Err(refuse("task-attempt", "attempt must echo allocation and link its predecessor exactly"));
            }
        }
        _ if projection.attempt.as_deref() != Some(&request.attempt) => {
            return Err(refuse("task-attempt", "event requires the current named attempt"));
        }
        Event::Launch(launch) => {
            if launch.run_id.is_empty() || launch.material.commit.is_empty() || launch.material.tree.is_empty()
                || launch.material.command.trim().is_empty()
                || launch.check.as_ref().is_some_and(|c| !assignment.checks.contains(c))
                || history.iter().any(|r| matches!(&r.request.event, Event::Launch(l) if l.run_id == launch.run_id)) {
                return Err(refuse("task-launch", "launch identity, committed material and admitted check required"));
            }
        }
        Event::Result(result) => {
            let launch = history.iter().find_map(|r| match &r.request.event {
                Event::Launch(l) if r.request.task == *task && r.request.attempt == request.attempt && l.run_id == result.run_id => Some(l),
                _ => None,
            }).ok_or_else(|| refuse("task-result", "result has no matching launch"))?;
            if result.observed_at < launch.launched_at
                || history.iter().any(|r| matches!(&r.request.event, Event::Result(prior) if prior.run_id == result.run_id))
                || [&result.stdout, &result.stderr].iter().any(|s| s.bytes.len() > 65536 || digest(&s.bytes) != s.digest)
                || result.observation != super::runner::classify(&result.stdout.bytes, &result.stderr.bytes) {
                return Err(refuse("task-result", "result duplicates a run or has invalid capture/timestamp"));
            }
        }
        Event::OwnerStatement(statement) => {
            if !assignment.checks.contains(&statement.submission.check) {
                return Err(refuse("task-owner", "owner statement names an unallocated check revision"));
            }
            super::receipts::validate_inspection(&history, task, statement)?;
        }
        Event::OwnerClassification(statement) => {
            let classification = &statement.submission;
            let result = history.iter().find_map(|r| match &r.request.event {
                Event::Result(result) if r.request.task == *task && result.run_id == classification.run_id => Some(result),
                _ => None,
            }).ok_or_else(|| refuse("task-classification", "classification requires an observed run"))?;
            if !assignment.checks.contains(&classification.check) || classification.output_identity != result.output_identity() {
                return Err(refuse("task-classification", "classification must bind exact output and check revision"));
            }
        }
        _ => {}
    }
    let record = Record { schema: "native-task-event-1".into(), root_binding: root.into(),
        version: projection.version.checked_add(1).ok_or_else(|| refuse("task-version", "version exhausted"))?,
        request_digest: request_digest(request)?, request: request.clone() };
    history.push(record.clone());
    let mut proposed = data.clone();
    let namespace = proposed.as_object_mut().ok_or_else(|| refuse("task-shape", "snapshot must be an object"))?
        .entry(NAMESPACE).or_insert_with(|| json!({"schema":"native-tasks-1","phases":{}}));
    namespace["phases"][task.phase.to_string()] = serde_json::to_value(history)?;
    Ok((proposed, record))
}

pub fn decision(record: &Record) -> Result<DecisionRecord> {
    Ok(DecisionRecord { version: 1, id: format!("native-task:{}:{}", record.request.task.phase, record.request_digest), revision: 1,
        origin: Origin { source: "native-task-event-1".into(), original: Evidence::Missing },
        decision: Decision::Gate { outcome: "native-task-event-1".into(), evidence: Evidence::Text(serde_json::to_string(record)?) } })
}
