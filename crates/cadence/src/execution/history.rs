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

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case", deny_unknown_fields)]
pub enum Event {
    AcknowledgedProgress { text: String, evidence: Vec<String>, commit: String },
    Checkpoint { records: Vec<crate::evidence::Record>, owner: Option<String>, at: Option<String> },
    Close(Box<CloseProof>),
    Attempt { predecessor: Option<String>, checks: Vec<Check>, base_commit: String },
    Launch(Launch),
    Result(RunResult),
    OwnerStatement(OwnerStatement),
    OwnerClassification(OwnerClassification),
    Progress { text: String, evidence: Vec<String> },
    FailedAttempt { reason: String, evidence: Vec<String> },
    Deviation { text: String, evidence: Vec<String> },
    Retirement { owner: String, at: String, reason: String },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub request_id: String,
    pub task: Task,
    pub attempt: String,
    pub expected_version: u64,
    pub event: Event,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
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
            Event::Close(_) => projection.completed = true,
            Event::Attempt { .. } => projection.attempt = Some(record.request.attempt.clone()),
            Event::Launch(launch) => projection.unknown_runs.push(launch.run_id.clone()),
            Event::Result(result) => projection.unknown_runs.retain(|id| id != &result.run_id),
            Event::Progress { text, .. } | Event::AcknowledgedProgress { text, .. } => projection.progress.push(text.clone()),
            _ => {}
        }
    }
    projection
}

/// One admitted task with its allocation, named commands and current projection.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TaskView {
    pub task: Task,
    pub checks: Vec<Check>,
    pub verify: Vec<String>,
    pub state: Projection,
}

/// A plan's tasks in admitted order; each task keeps the admission basis that
/// first admitted its plan, so a gap extension never rekeys its receipts.
pub fn plan_task_views(data: &Value, records: &[Record], phase: u32, plan: u32) -> Result<Vec<TaskView>> {
    let refuse = |reason: &str| admission::refuse(phase, "task-admission", "plan", &plan.to_string(), reason);
    let admissions = admission::records(data, phase)?;
    let basis = admissions.iter().find(|r| r.request.contract.plans.iter().any(|b| b.plan == plan))
        .ok_or_else(|| refuse("plan is not admitted"))?;
    let publication = crate::plan::persistence::saved(data, phase)?.and_then(|o| o.publications.get(&plan).cloned())
        .ok_or_else(|| refuse("admitted plan publication missing"))?;
    publication.content.execution.tasks.iter().map(|spec| {
        let assignment = basis.request.contract.allocation.iter().find(|a| a.plan == plan && a.task == spec.id)
            .ok_or_else(|| refuse("admitted task lacks its allocation"))?;
        let task = Task { phase, occurrence: basis.request.contract.occurrence.clone(), admission_digest: basis.request_digest.clone(),
            plan, task: spec.id.clone() };
        Ok(TaskView { state: project(records, &task), task, checks: assignment.checks.clone(), verify: spec.verify.clone() })
    }).collect()
}

/// Retained checkpoints of one task with their questions and owner answers.
pub fn task_checkpoints(records: &[Record], task: &Task) -> Vec<Value> {
    use crate::evidence::{Fact, gates::State};
    let mut checkpoints: Vec<Value> = Vec::new();
    for record in records.iter().filter(|r| r.request.task == *task) {
        let Event::Checkpoint { records: facts, .. } = &record.request.event else { continue };
        for fact in facts {
            match &fact.fact {
                Fact::Checkpoint(checkpoint) => checkpoints.push(json!({"id":checkpoint.id,"question":Value::Null,"answer":Value::Null})),
                Fact::Gate(gate) => {
                    let Some(entry) = checkpoints.iter_mut().find(|c| c["id"] == *gate.checkpoint_id.as_deref().unwrap_or("")) else { continue };
                    entry["question"] = json!(gate.id);
                    if let State::Answered(answer) = &gate.state { entry["answer"] = json!(answer); }
                }
                _ => {}
            }
        }
    }
    checkpoints
}

/// The confirmed completion of a task, shown as history and never scheduled.
pub fn completed_view(records: &[Record], view: &TaskView) -> Option<Value> {
    records.iter().filter(|r| r.request.task == view.task).find_map(|r| match &r.request.event {
        Event::Close(proof) => Some(json!({"id":view.task.task,"attempt":r.request.attempt,"completion":proof.submission.completion,
            "checks":view.checks,"close_request":r.request.request_id})),
        _ => None,
    })
}

pub fn request_digest(request: &Request) -> Result<String> {
    Ok(digest(&super::boundary::canonical_bytes(request).map_err(|e| Error::Invalid(e.to_string()))?))
}

pub fn replay(data: &Value, request: &Request) -> Result<Option<Record>> {
    if let Some(record) = records(data, request.task.phase)?.into_iter().find(|r| r.request.request_id == request.request_id) {
        if record.request != *request || record.request_digest != request_digest(request)? {
            return Err(admission::refuse(request.task.phase, "task-request-reuse", "request_id", &request.request_id, "request already names another payload"));
        }
        return Ok(Some(record));
    }
    Ok(None)
}

pub fn contribute(data: &Value, root: &str, request: &Request) -> Result<(Value, Record)> {
    if let Some(record) = replay(data, request)? { return Ok((data.clone(), record)) }
    let task = &request.task;
    let refuse = |rule: &str, reason: &str| admission::refuse(task.phase, rule, "task", &task.task, reason);
    if request.request_id.trim().is_empty() || request.attempt.trim().is_empty() {
        return Err(refuse("task-identity", "request and attempt identities required"));
    }
    let admissions = admission::records(data, task.phase)?;
    let basis = admissions.iter().find(|r| r.request_digest == task.admission_digest
        && r.request.contract.occurrence == task.occurrence)
        .ok_or_else(|| refuse("task-admission", "task must name its immutable admission"))?;
    let assignment = basis.request.contract.allocation.iter().find(|a| a.plan == task.plan && a.task == task.task)
        .ok_or_else(|| refuse("task-allocation", "task is not in this admission"))?;
    // A gap extension never rekeys the original task's receipt identity.
    if admissions.iter().take_while(|r| r.request_digest != task.admission_digest)
        .any(|r| r.request.contract.allocation.iter().any(|a| a.plan == task.plan && a.task == task.task)) {
        return Err(refuse("task-admission", "use the task's original admission basis"));
    }
    let mut history = records(data, task.phase)?;
    let projection = project(&history, task);
    if projection.completed {
        return Err(refuse("task-completed", "task already has a confirmed completion"));
    }
    if request.expected_version != projection.version {
        return Err(refuse("task-version", "expected task version is stale"));
    }
    let mut retirement = None;
    match &request.event {
        Event::Attempt { predecessor, checks, base_commit } => {
            if *checks != assignment.checks || base_commit.is_empty() || *predecessor != projection.attempt
                || history.iter().any(|r| r.request.task == *task && r.request.attempt == request.attempt) {
                return Err(refuse("task-attempt", "attempt must echo allocation and link its predecessor exactly"));
            }
        }
        Event::Retirement { owner, at, reason } => {
            for (field, value) in [("owner", owner), ("at", at), ("reason", reason)] {
                if value.trim().is_empty() {
                    return Err(admission::refuse(task.phase, "task-retirement", field, &task.task,
                        "owner retirement requires nonblank owner, time and reason"));
                }
            }
            let active: super::model::ActiveDispatch = data["execution"]["occurrences"]
                .get(task.phase.to_string()).and_then(|occurrence| occurrence.get("active"))
                .filter(|active| !active.is_null()).cloned().map(serde_json::from_value).transpose()?
                .ok_or_else(|| admission::refuse(task.phase, "task-active", "task", &task.task,
                    "retirement requires the task's exact active dispatch"))?;
            if active.phase != task.phase || active.plan != task.plan
                || !active.tasks.iter().any(|spec| spec.id == task.task) {
                return Err(admission::refuse(task.phase, "task-active", "task", &task.task,
                    "retirement requires the task's exact active dispatch"));
            }
            if projection.attempt.as_deref() != Some(&request.attempt) {
                return Err(refuse("task-attempt", "event requires the current named attempt"));
            }
            retirement = Some((active, reason.clone()));
        }
        _ if projection.attempt.as_deref() != Some(&request.attempt) => {
            return Err(refuse("task-attempt", "event requires the current named attempt"));
        }
        Event::Close(proof) => {
            if proof.submission.task != *task || proof.submission.request_id != request.request_id || proof.submission.attempt != request.attempt
                || proof.submission.expected_version != request.expected_version {
                return Err(refuse("task-close", "close event differs from its public submission"));
            }
            super::receipts::validate_close(data, &history, proof)?;
        }
        Event::Checkpoint { records, owner, at } => {
            if records.iter().any(|r|matches!(&r.fact,crate::evidence::Fact::Gate(gate) if matches!(gate.state,crate::evidence::gates::State::Answered(_))))
                && (owner.as_ref().is_none_or(|s|s.trim().is_empty()) || at.as_ref().is_none_or(|s|s.trim().is_empty())) {
                return Err(refuse("task-checkpoint", "checkpoint answer requires owner attribution and time"));
            }
            checkpoint_projection(data, task, records)?;
        }
        Event::AcknowledgedProgress { text, commit, .. } => {
            if text.trim().is_empty() || !crate::rail::risk::valid_object_id(commit) {
                return Err(refuse("task-progress", "progress requires authored text and an observed commit"));
            }
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
                || [&result.stdout, &result.stderr].iter().any(|s| s.bytes.len() > 65536 || digest(&s.bytes) != s.digest
                    || s.result_lines.iter().any(|line| !super::runner::valid_result_line(line)))
                || result.observation != super::runner::classify(&result.stdout, &result.stderr) {
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
            super::receipts::validate_classification(&history, task, statement)?;
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
    namespace["phases"][task.phase.to_string()] = serde_json::to_value(&history)?;
    if let Event::Checkpoint {records,..}=&request.event {
        proposed=checkpoint_projection(&proposed,task,records)?;
    }
    if let Event::Close(proof) = &request.event {
        let basis = crate::rail::risk::NativeExecutionBasis::new(&proof.dispatch, task.clone(), proof.source.clone(), record.request_digest.clone())?;
        proposed = crate::rail::risk::project_native_execution_basis(&proposed, &basis)?;
    }
    if let Some((active, reason)) = retirement {
        let plan = PlanIdentity { phase: task.phase, occurrence: task.occurrence.clone(),
            admission_digest: task.admission_digest.clone(), plan: task.plan };
        let blocker = super::model::Blocker { id: format!("task-retired:{}", task.task),
            text: reason, evidence: vec![] };
        proposed = end_dispatch(&proposed, &plan, &active, &history,
            super::model::PlanDisposition::Blocked, vec![blocker], &record.request_digest)?;
    }
    Ok((proposed, record))
}

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct RetirementInput {
    pub request_id: String,
    pub task: Task,
    pub attempt: String,
    pub expected_version: u64,
    pub owner: String,
    pub at: String,
    pub reason: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag="operation", deny_unknown_fields)]
pub enum RetirementApply {
    #[serde(rename="execution-task-retire")]
    Retire { request: RetirementInput },
}

pub fn decision(record: &Record) -> Result<DecisionRecord> {
    Ok(DecisionRecord { version: 1, id: format!("native-task:{}:{}", record.request.task.phase, record.request_digest), revision: 1,
        origin: Origin { source: "native-task-event-1".into(), original: Evidence::Missing },
        decision: Decision::Gate { outcome: "native-task-event-1".into(), evidence: Evidence::Text(serde_json::to_string(record)?) } })
}

pub fn decisions(record: &Record) -> Result<Vec<DecisionRecord>> {
    let mut decisions=vec![decision(record)?];
    if let Event::Checkpoint {records,..}=&record.request.event {
        for (index,evidence) in records.iter().enumerate() {
            decisions.push(crate::evidence::persistence::history(&format!("task:{}:{index}",record.request_digest),evidence)?);
        }
    }
    Ok(decisions)
}

fn checkpoint_projection(data:&Value,task:&Task,records:&[crate::evidence::Record]) -> Result<Value> {
    use crate::evidence::{Fact,persistence};
    if records.is_empty() || records.len()>2 {return Err(admission::refuse(task.phase,"task-checkpoint","records",&task.task,"one checkpoint with question, or one answer, required"));}
    let mut next=data.clone();
    for record in records {
        if record.scope.phase!=task.phase.to_string() || record.scope.occurrence!=format!("phase-{}-execution",task.phase)
            || record.scope.plan!="native-execution" || !matches!(record.fact,Fact::Checkpoint(_)|Fact::Gate(_)) {
            return Err(admission::refuse(task.phase,"task-checkpoint","scope",&task.task,"checkpoint must use the task's execution occurrence"));
        }
        if let Fact::Checkpoint(checkpoint)=&record.fact {
            let publication=crate::plan::persistence::saved(data,task.phase)?.and_then(|p|p.publications.get(&task.plan).cloned())
                .ok_or_else(||admission::refuse(task.phase,"task-checkpoint","task",&task.task,"checkpoint task publication missing"))?;
            let number=publication.content.execution.tasks.iter().position(|t|t.id==task.task).map(|n|n+1);
            if number!=Some(checkpoint.task_number as usize) || checkpoint.task_name!=task.task {
                return Err(admission::refuse(task.phase,"task-checkpoint","task",&task.task,"checkpoint task identity differs from admitted task order"));
            }
        }
        if let Fact::Gate(gate)=&record.fact
            && matches!(gate.state,crate::evidence::gates::State::Answered(_))
            && !self::records(data,task.phase)?.iter().any(|r|r.request.task==*task && matches!(&r.request.event,
                Event::Checkpoint {records,..} if records.iter().any(|r|matches!(&r.fact,Fact::Gate(prior) if prior.id==gate.id)))) {
            return Err(admission::refuse(task.phase,"task-checkpoint","question",&gate.id,"answer must name this task's retained question"));
        }
        if matches!(record.fact,Fact::Checkpoint(_)) && persistence::read(&next)?.contains_key(&record.key()?) {
            return Err(admission::refuse(task.phase,"task-checkpoint","checkpoint",&task.task,"checkpoint identity already retained; create an explicit successor"));
        }
        next=persistence::project(&next,record)?;
    }
    Ok(next)
}

// Plan-level events: the suite lifecycle and native completion. They are
// immutable like task events, keyed by the plan's admission binding, and
// Suite and completion are plan events; owner retirement is the one task event
// that ends a plan's dispatch through the same retained outcome transition.
pub const PLAN_NAMESPACE: &str = "native_plans";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct PlanIdentity {
    pub phase: u32,
    pub occurrence: String,
    pub admission_digest: String,
    pub plan: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct SuiteLaunch {
    pub run_id: String,
    pub material: Material,
    pub launched_at: u64,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub proposed_paths: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct SuiteRepairQuestion {
    pub id: String,
    pub failed_run: String,
    pub failing_tests: Vec<String>,
    pub proposed_paths: Vec<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum SuiteRepairDisposition { Approve, Refuse }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct SuiteRepairAnswer {
    pub question_id: String,
    pub owner: String,
    pub at: String,
    pub disposition: SuiteRepairDisposition,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct SuiteRepair {
    pub question_id: String,
    pub commits: Vec<String>,
    pub changed_paths: std::collections::BTreeMap<String, Vec<String>>,
}

/// The operator's attestation over a launch's retained bytes that no test
/// results were produced. The binary checks that it names the latest launch,
/// that no recognized result exists and that it binds the exact retained
/// output; it never decides the truth of the absence claim.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Absence {
    pub dead_launch: String,
    pub output_identity: Option<String>,
    pub attestation: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct OwnerAbsence {
    pub submission: Absence,
    pub approval: OwnerApproval<Absence>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Completion {
    pub suite_run: String,
    pub settlement: Option<crate::rail::receipts::Requirement>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case", deny_unknown_fields)]
pub enum PlanEvent {
    SuiteLaunch(SuiteLaunch),
    SuiteResult(RunResult),
    SuiteRepairQuestion(SuiteRepairQuestion),
    SuiteRepairAnswer(SuiteRepairAnswer),
    SuiteRepair(SuiteRepair),
    SuiteRelaunch(OwnerAbsence),
    Completion(Completion),
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PlanRequest {
    pub request_id: String,
    pub plan: PlanIdentity,
    pub expected_version: u64,
    pub event: PlanEvent,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PlanRecord {
    pub schema: String,
    pub root_binding: String,
    pub version: u64,
    pub request_digest: String,
    pub request: PlanRequest,
}

/// The suite's standing as the binary observed it: `pending` before a launch,
/// `unknown` while the latest launch has no recognized result, `failed` or
/// `passed` from a recognized result, and `complete` after native completion.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PlanProjection {
    pub version: u64,
    pub launches: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub results: Vec<String>,
    pub relaunch: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repair_question: Option<SuiteRepairQuestion>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repair_answer: Option<SuiteRepairAnswer>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repair: Option<SuiteRepair>,
    pub outcome: String,
    pub completed: bool,
}

pub fn plan_records(data: &Value, phase: u32) -> Result<Vec<PlanRecord>> {
    let Some(namespace) = data.get(PLAN_NAMESPACE) else { return Ok(vec![]) };
    if namespace["schema"] != "native-plans-1" {
        return Err(admission::refuse(phase, "plan-schema", PLAN_NAMESPACE, "", "unsupported native plan history"));
    }
    namespace["phases"].get(phase.to_string()).cloned().map(serde_json::from_value)
        .transpose().map(|r| r.unwrap_or_default()).map_err(Error::from)
}

pub fn suite_result<'a>(records: &'a [PlanRecord], plan: &PlanIdentity, run_id: &str) -> Option<&'a RunResult> {
    records.iter().find_map(|r| match &r.request.event {
        PlanEvent::SuiteResult(result) if r.request.plan == *plan && result.run_id == run_id => Some(result),
        _ => None,
    })
}

/// A recognized result that reports a failure, or a recognized result whose
/// process did not exit cleanly; Unknown is never a failure or a pass.
pub fn suite_failed(result: &RunResult) -> bool {
    matches!(result.observation, Observation::ResultsObserved { .. })
        && (result.disposition != (Disposition::Exited { code: 0 }) || match &result.observation {
            Observation::ResultsObserved { summary: Summary::Cargo { failed } } => *failed,
            Observation::ResultsObserved { summary: Summary::Unittest { failed, failures, errors } } => *failed || *failures > 0 || *errors > 0,
            Observation::Unknown => false,
        })
}

pub fn suite_passed(result: &RunResult) -> bool {
    matches!(result.observation, Observation::ResultsObserved { .. }) && !suite_failed(result) && result.material_unchanged
}

pub fn failing_tests(result: &RunResult) -> Vec<String> {
    let mut names = Vec::new();
    for capture in [&result.stdout, &result.stderr] {
        let mut retained = capture.bytes.split_inclusive(|byte| *byte == b'\n').filter_map(|line| {
            (line.last() == Some(&b'\n')).then(|| std::str::from_utf8(&line[..line.len()-1]).ok()
                .map(|line| line.trim_end_matches('\r').to_owned())).flatten()
        }).collect::<Vec<_>>();
        retained.extend(capture.result_lines.iter().cloned());
        for line in retained {
            let name = line.strip_prefix("test ").and_then(|line| line.strip_suffix(" ... FAILED"))
                .or_else(|| line.strip_prefix("FAIL: ").and_then(|line| line.split_once(" (").map(|(name, _)| name)))
                .or_else(|| line.strip_prefix("ERROR: ").and_then(|line| line.split_once(" (").map(|(name, _)| name)));
            if let Some(name) = name.filter(|name| !name.is_empty())
                && !names.iter().any(|prior| prior == name) {
                names.push(name.to_owned());
            }
        }
    }
    names
}

pub fn plan_project(records: &[PlanRecord], plan: &PlanIdentity) -> PlanProjection {
    let mut projection = PlanProjection { version: 0, launches: vec![], results: vec![], relaunch: None,
        repair_question: None, repair_answer: None, repair: None, outcome: "pending".into(), completed: false };
    for record in records.iter().filter(|r| r.request.plan == *plan) {
        projection.version = record.version;
        match &record.request.event {
            PlanEvent::SuiteLaunch(launch) => { projection.launches.push(launch.run_id.clone()); projection.outcome = "unknown".into(); }
            PlanEvent::SuiteResult(result) => {
                projection.results.push(result.run_id.clone());
                projection.outcome = if suite_passed(result) { "passed" } else if suite_failed(result) { "failed" } else { "unknown" }.into();
            }
            PlanEvent::SuiteRepairQuestion(question) => projection.repair_question = Some(question.clone()),
            PlanEvent::SuiteRepairAnswer(answer) => projection.repair_answer = Some(answer.clone()),
            PlanEvent::SuiteRepair(repair) => projection.repair = Some(repair.clone()),
            PlanEvent::SuiteRelaunch(_) => projection.relaunch = Some(record.request.request_id.clone()),
            PlanEvent::Completion(_) => { projection.completed = true; projection.outcome = "complete".into(); }
        }
    }
    projection
}

pub fn plan_request_digest(request: &PlanRequest) -> Result<String> {
    Ok(digest(&super::boundary::canonical_bytes(request).map_err(|e| Error::Invalid(e.to_string()))?))
}

pub fn plan_replay(data: &Value, request: &PlanRequest) -> Result<Option<PlanRecord>> {
    if let Some(record) = plan_records(data, request.plan.phase)?.into_iter().find(|r| r.request.request_id == request.request_id) {
        if record.request != *request || record.request_digest != plan_request_digest(request)? {
            return Err(admission::refuse(request.plan.phase, "plan-request-reuse", "request_id", &request.request_id, "request already names another payload"));
        }
        return Ok(Some(record));
    }
    Ok(None)
}

/// Every admitted plan with the admission that first admitted it.
pub fn admitted_plans(data: &Value, phase: u32) -> Result<Vec<(PlanIdentity, u64)>> {
    let mut plans: Vec<(PlanIdentity, u64)> = Vec::new();
    for record in admission::records(data, phase)? {
        for binding in &record.request.contract.plans {
            if plans.iter().any(|(p, _)| p.plan == binding.plan) { continue }
            plans.push((PlanIdentity { phase, occurrence: record.request.contract.occurrence.clone(),
                admission_digest: record.request_digest.clone(), plan: binding.plan }, record.set_version));
        }
    }
    Ok(plans)
}

pub fn plan_outcomes(data: &Value, phase: u32) -> Result<Vec<super::model::PlanOutcome>> {
    Ok(data["execution"]["occurrences"].get(phase.to_string()).and_then(|o| o.get("plans")).cloned()
        .map(serde_json::from_value).transpose()?.unwrap_or_default())
}

/// The phase is done when every admitted plan has an outcome and each failed
/// plan has a later-admitted gap plan that completed (D-120).
pub fn phase_complete(data: &Value, phase: u32) -> Result<bool> {
    use super::model::PlanDisposition;
    let plans = admitted_plans(data, phase)?;
    let outcomes = plan_outcomes(data, phase)?;
    let disposition = |plan: u32| outcomes.iter().find(|o| o.plan == plan).map(|o| o.disposition);
    Ok(plans.iter().all(|(identity, version)| match disposition(identity.plan) {
        Some(PlanDisposition::Complete) => true,
        Some(PlanDisposition::Blocked) => plans.iter().any(|(later, later_version)| later_version > version
            && disposition(later.plan) == Some(PlanDisposition::Complete)),
        None => false,
    }))
}

/// Ends the plan's dispatch with a retained outcome. Completed tasks are
/// listed from their close receipts; a failed suite is a visible blocker.
fn end_dispatch(data: &Value, plan: &PlanIdentity, active: &super::model::ActiveDispatch, records: &[Record],
    disposition: super::model::PlanDisposition, blockers: Vec<super::model::Blocker>, transition_id: &str) -> Result<Value> {
    use super::model::{CommandReceipt, Deviation, EvidenceReference, ExecutionSnapshot, PlanOutcome, TaskOutcome, TerminalOutcome, VerificationDisposition, VerificationReceipt};
    let mut tasks = Vec::new();
    let mut deviations = Vec::new();
    let mut commit_paths = std::collections::BTreeMap::new();
    for spec in &active.tasks {
        let task = Task { phase: plan.phase, occurrence: plan.occurrence.clone(), admission_digest: plan.admission_digest.clone(), plan: plan.plan, task: spec.id.clone() };
        let Some(proof) = records.iter().find_map(|r| match &r.request.event {
            Event::Close(proof) if r.request.task == task => Some(proof), _ => None,
        }) else {
            if records.iter().any(|r| r.request.task == task && matches!(&r.request.event, Event::Retirement { .. })) {
                tasks.push(TaskOutcome::Blocked { task_id: spec.id.clone(), blocker_id: format!("task-retired:{}", spec.id) });
            } else {
                tasks.push(TaskOutcome::NotRun { task_id: spec.id.clone() });
            }
            continue
        };
        let commands = proof.submission.verification.iter().filter_map(|id| {
            let launch = records.iter().find_map(|r| match &r.request.event { Event::Launch(l) if r.request.task == task && l.run_id == *id => Some(l), _ => None })?;
            let result = records.iter().find_map(|r| match &r.request.event { Event::Result(res) if r.request.task == task && res.run_id == *id => Some(res), _ => None })?;
            let exit_code = match result.disposition { Disposition::Exited { code } => code, _ => -1 };
            Some(CommandReceipt { command: launch.material.command.clone(), exit_code, output_digest: result.output_identity() })
        }).collect();
        let mut evidence = Vec::new();
        for pair in &proof.submission.checks {
            for sha in [&pair.red_commit, &pair.green_commit] {
                let reference = EvidenceReference::Commit { sha: sha.clone() };
                if !evidence.contains(&reference) { evidence.push(reference); }
            }
        }
        tasks.push(TaskOutcome::Completed { task_id: spec.id.clone(), commit: proof.submission.completion.clone(),
            verification: VerificationReceipt { disposition: VerificationDisposition::Passed, commands }, evidence });
        // D-170: the lease is the planner's expectation; the record names what differed.
        for (commit, paths) in &proof.source.out_of_lease {
            for path in paths {
                deviations.push(Deviation { id: format!("out-of-lease:{}:{path}", spec.id),
                    text: format!("{} committed {path} outside the admitted lease in {commit}", spec.id),
                    evidence: vec![EvidenceReference::Commit { sha: commit.clone() }] });
            }
        }
    }
    for repair in plan_records(data, plan.phase)?.iter().filter_map(|record| match &record.request.event {
        PlanEvent::SuiteRepair(repair) if record.request.plan == *plan => Some(repair),
        _ => None,
    }) {
        for (commit, paths) in &repair.changed_paths {
            commit_paths.insert(commit.clone(), paths.clone());
            for path in paths.iter().filter(|path| !super::lease::covers(&active.files, &active.directories, path)) {
                deviations.push(Deviation { id: format!("suite-repair:{path}"),
                    text: format!("suite repair committed {path} outside the admitted lease in {commit}"),
                    evidence: vec![EvidenceReference::Commit { sha: commit.clone() }] });
            }
        }
    }
    let mut execution: ExecutionSnapshot = serde_json::from_value(data["execution"].clone())?;
    let occurrence = execution.occurrences.get_mut(&plan.phase.to_string())
        .ok_or_else(|| Error::Invalid("plan outcome lacks its execution occurrence".into()))?;
    occurrence.plans.push(PlanOutcome { dispatch_id: active.id.clone(), phase: plan.phase, plan: plan.plan, disposition, tasks,
        deviations, blockers, commit_paths, transition_id: transition_id.into() });
    occurrence.active = None;
    let mut next = data.clone();
    next["execution"] = serde_json::to_value(execution)?;
    if phase_complete(&next, plan.phase)? {
        next["execution"]["occurrences"][plan.phase.to_string()]["terminal"] = serde_json::to_value(TerminalOutcome::Complete { phase: plan.phase })?;
    }
    Ok(next)
}

pub fn plan_contribute(data: &Value, root: &str, request: &PlanRequest) -> Result<(Value, PlanRecord)> {
    if let Some(record) = plan_replay(data, request)? { return Ok((data.clone(), record)) }
    let plan = &request.plan;
    let refuse = |rule: &str, reason: &str| admission::refuse(plan.phase, rule, "plan", &plan.plan.to_string(), reason);
    if request.request_id.trim().is_empty() { return Err(refuse("plan-identity", "request identity required")); }
    let admissions = admission::records(data, plan.phase)?;
    if !admissions.iter().any(|r| r.request_digest == plan.admission_digest
        && r.request.contract.occurrence == plan.occurrence && r.request.contract.plans.iter().any(|b| b.plan == plan.plan)) {
        return Err(refuse("plan-admission", "plan must name its immutable admission"));
    }
    if admissions.iter().take_while(|r| r.request_digest != plan.admission_digest)
        .any(|r| r.request.contract.plans.iter().any(|b| b.plan == plan.plan)) {
        return Err(refuse("plan-admission", "use the plan's original admission basis"));
    }
    let mut history = plan_records(data, plan.phase)?;
    let projection = plan_project(&history, plan);
    let task_records = records(data, plan.phase)?;
    if projection.completed { return Err(refuse("plan-completed", "plan already has a confirmed native completion")); }
    if plan_outcomes(data, plan.phase)?.iter().any(|outcome| outcome.plan == plan.plan) {
        return Err(refuse("suite-failed", "the plan's repair launch reported a failure; its next repair is a newly approved gap plan"));
    }
    if request.expected_version != projection.version { return Err(refuse("plan-version", "expected plan version is stale")); }
    let publication = crate::plan::persistence::saved(data, plan.phase)?.and_then(|o| o.publications.get(&plan.plan).cloned())
        .ok_or_else(|| refuse("plan-admission", "admitted plan publication missing"))?;
    let unfinished: Vec<String> = publication.content.execution.tasks.iter().filter(|spec| {
        let task = Task { phase: plan.phase, occurrence: plan.occurrence.clone(), admission_digest: plan.admission_digest.clone(), plan: plan.plan, task: spec.id.clone() };
        !project(&task_records, &task).completed
    }).map(|spec| spec.id.clone()).collect();
    let active: Option<super::model::ActiveDispatch> = data["execution"]["occurrences"].get(plan.phase.to_string())
        .and_then(|o| o.get("active")).filter(|a| !a.is_null()).cloned().map(serde_json::from_value).transpose()?;
    let latest = projection.launches.last().cloned();
    let latest_result = latest.as_deref().and_then(|id| suite_result(&history, plan, id)).cloned();
    let mut proposed = data.clone();
    let record_digest = plan_request_digest(request)?;
    let mut generated_question = None;
    match &request.event {
        PlanEvent::SuiteLaunch(launch) => {
            let active = active.filter(|a| a.plan == plan.plan && a.phase == plan.phase)
                .ok_or_else(|| refuse("plan-active", "the suite needs the plan's active dispatch"))?;
            if !unfinished.is_empty() {
                return Err(refuse("suite-early", &format!("the suite is available only after the last task is acknowledged; unfinished: {}", unfinished.join(", "))));
            }
            if launch.run_id.trim().is_empty() || launch.material.commit.is_empty() || launch.material.tree.is_empty()
                || launch.proposed_paths.iter().any(|path| !super::patch::safe_relative_path(path))
                || launch.proposed_paths.iter().collect::<std::collections::BTreeSet<_>>().len() != launch.proposed_paths.len()
                || history.iter().any(|r| matches!(&r.request.event, PlanEvent::SuiteLaunch(l) if l.run_id == launch.run_id)) {
                return Err(refuse("suite-launch", "launch identity, committed material and distinct project-relative repair paths required"));
            }
            if launch.material.command != active.suite || launch.material.command != publication.content.execution.suite || !launch.material.test_file.is_empty() {
                return Err(refuse("suite-command", "the suite runs exactly the admitted suite command"));
            }
            if let Some(latest) = &latest {
                if latest_result.as_ref().is_some_and(|r| matches!(r.observation, Observation::ResultsObserved { .. })) {
                    let approved_repair = latest_result.as_ref().is_some_and(suite_failed)
                        && projection.launches.len() == 1
                        && projection.repair_answer.as_ref().is_some_and(|answer| answer.disposition == SuiteRepairDisposition::Approve)
                        && projection.repair.is_some();
                    if !approved_repair {
                        return Err(refuse("suite-once", "a recognized suite result permits one further launch only after an approved, retained plan repair"));
                    }
                }
                if latest_result.as_ref().is_none_or(|result| !matches!(result.observation, Observation::ResultsObserved { .. })) {
                    let confirmed = history.iter().filter(|r| r.request.plan == *plan).rev()
                        .take_while(|r| !matches!(&r.request.event, PlanEvent::SuiteLaunch(_)))
                        .any(|r| matches!(&r.request.event, PlanEvent::SuiteRelaunch(a) if a.submission.dead_launch == *latest));
                    if !confirmed || projection.launches.len() >= 2 {
                        return Err(refuse("suite-once", "the suite runs once per plan; a launch with no recognized result is relaunched only once, after the operator's execution-suite-relaunch attestation"));
                    }
                }
            }
        }
        PlanEvent::SuiteResult(result) => {
            let launch = history.iter().find_map(|r| match &r.request.event {
                PlanEvent::SuiteLaunch(l) if r.request.plan == *plan && l.run_id == result.run_id => Some(l), _ => None,
            }).ok_or_else(|| refuse("suite-result", "result has no matching suite launch"))?;
            if result.observed_at < launch.launched_at || suite_result(&history, plan, &result.run_id).is_some()
                || [&result.stdout, &result.stderr].iter().any(|s| s.bytes.len() > 65536 || digest(&s.bytes) != s.digest
                    || s.result_lines.iter().any(|line| !super::runner::valid_result_line(line)))
                || result.observation != super::runner::classify(&result.stdout, &result.stderr) {
                return Err(refuse("suite-result", "result duplicates a run or has invalid capture/timestamp"));
            }
            if suite_failed(result) {
                if projection.repair.is_some() {
                    if let Some(active) = active.as_ref().filter(|active| active.plan == plan.plan) {
                        let blocker = super::model::Blocker { id: format!("suite-failed:{}", result.run_id),
                            text: "the plan's one repair launch reported a failure; further repair requires a gap plan".into(), evidence: vec![] };
                        proposed = end_dispatch(&proposed, plan, active, &task_records,
                            super::model::PlanDisposition::Blocked, vec![blocker], &record_digest)?;
                    }
                } else {
                    generated_question = Some(SuiteRepairQuestion { id: format!("suite-repair:{}", result.run_id),
                        failed_run: result.run_id.clone(), failing_tests: failing_tests(result),
                        proposed_paths: launch.proposed_paths.clone() });
                }
            }
        }
        PlanEvent::SuiteRepairQuestion(_) => {
            return Err(refuse("suite-repair-question", "the suite repair question is generated by the binary"));
        }
        PlanEvent::SuiteRepairAnswer(answer) => {
            let Some(question) = projection.repair_question.as_ref() else {
                return Err(refuse("suite-repair-answer", "repair answer requires the retained plan question"));
            };
            if projection.repair_answer.is_some() || answer.question_id != question.id
                || answer.owner.trim().is_empty() || answer.at.trim().is_empty() {
                return Err(refuse("suite-repair-answer", "one answer must name the retained question with nonblank owner attribution and time"));
            }
            if answer.disposition == SuiteRepairDisposition::Refuse {
                let active = active.as_ref().filter(|active| active.plan == plan.plan)
                    .ok_or_else(|| refuse("plan-active", "repair refusal needs the plan's active dispatch"))?;
                let blocker = super::model::Blocker { id: format!("suite-repair-refused:{}", question.id),
                    text: "the owner refused the plan-level suite repair".into(), evidence: vec![] };
                proposed = end_dispatch(&proposed, plan, active, &task_records,
                    super::model::PlanDisposition::Blocked, vec![blocker], &record_digest)?;
            }
        }
        PlanEvent::SuiteRepair(repair) => {
            let Some(question) = projection.repair_question.as_ref() else {
                return Err(refuse("suite-repair", "repair requires the retained plan question"));
            };
            if repair.question_id != question.id || repair.commits.is_empty()
                || repair.commits.iter().collect::<std::collections::BTreeSet<_>>().len() != repair.commits.len()
                || repair.commits.iter().any(|commit| !repair.changed_paths.contains_key(commit))
                || repair.changed_paths.keys().any(|commit| !repair.commits.contains(commit))
                || projection.repair.is_some()
                || projection.repair_answer.as_ref().is_none_or(|answer| answer.question_id != question.id
                    || answer.disposition != SuiteRepairDisposition::Approve) {
                return Err(refuse("suite-repair", "one Git-observed repair requires the current approved question and exact ordered commits"));
            }
        }
        PlanEvent::SuiteRelaunch(statement) => {
            let absence = &statement.submission;
            let refuse_relaunch = |reason: &str| admission::refuse(plan.phase, "suite-relaunch", "statement", &absence.dead_launch, reason);
            if !validate_approval(absence, &statement.approval) || absence.attestation.trim().is_empty() {
                return Err(refuse_relaunch("actual attributed/timed operator approval must echo the exact attestation"));
            }
            if latest.as_deref() != Some(absence.dead_launch.as_str()) {
                return Err(refuse_relaunch("the attestation must name the plan's latest suite launch"));
            }
            match &latest_result {
                Some(result) if matches!(result.observation, Observation::ResultsObserved { .. }) => {
                    return Err(admission::refuse(plan.phase, "suite-results-observed", "statement", &absence.dead_launch,
                        "a recognized test result exists for this launch; the absence attestation is refused outright"));
                }
                Some(result) if absence.output_identity.as_deref() != Some(result.output_identity().as_str()) => {
                    return Err(refuse_relaunch("the attestation must bind the exact retained output of the Unknown launch"));
                }
                None if absence.output_identity.is_some() => {
                    return Err(refuse_relaunch("the dead launch retained no output; the attestation names no output identity"));
                }
                _ => {}
            }
            if projection.relaunch.is_some() {
                return Err(admission::refuse(plan.phase, "suite-relaunch-budget", "statement", &absence.dead_launch, "exactly one confirmed relaunch per admitted plan"));
            }
        }
        PlanEvent::Completion(completion) => {
            let active = active.filter(|a| a.plan == plan.plan && a.phase == plan.phase)
                .ok_or_else(|| refuse("plan-active", "completion needs the plan's active dispatch"))?;
            if !unfinished.is_empty() {
                return Err(refuse("tasks-unfinished", &format!("every task must close before the plan completes; unfinished: {}", unfinished.join(", "))));
            }
            if latest.as_deref() != Some(completion.suite_run.as_str()) {
                return Err(refuse("suite-required", "native completion needs the plan's one passing suite receipt; no suite launch is retained"));
            }
            match &latest_result {
                None => return Err(refuse("suite-unknown", "the suite launch has no observed result; it is Unknown, neither success nor a completed run")),
                Some(result) if suite_failed(result) && projection.repair.is_none() => {
                    return Err(refuse("suite-repair-pending", "the first failing suite is waiting on its retained owner-gated repair"));
                }
                Some(result) if suite_failed(result) => return Err(refuse("suite-failed", "the repair launch reported a failure; further repair belongs to a gap plan")),
                Some(result) if !suite_passed(result) => return Err(refuse("suite-unknown", "the suite output carries no recognized passing result; Unknown is neither success nor plan completion")),
                Some(_) => {}
            }
            let settlement = completion.settlement.as_ref()
                .ok_or_else(|| refuse("risk-pending", "the plan's exact risk settlement is pending; the suite receipt is retained and completion waits for both"))?;
            let scope = &settlement.boundary.scope;
            let bases = crate::rail::risk::native_execution_bases(data)?.into_iter()
                .filter(|basis| basis.task.phase == plan.phase && basis.task.plan == plan.plan).collect::<Vec<_>>();
            let base = bases.first().map(|basis| basis.execution.base_id.clone())
                .ok_or_else(|| refuse("risk-pending", "no native risk material is retained for the plan's dispatch"))?;
            let head = projection.repair.as_ref().and_then(|repair| repair.commits.last()).cloned()
                .or_else(|| bases.last().map(|basis| basis.source.completion.clone()))
                .ok_or_else(|| refuse("risk-pending", "no native risk material is retained for the plan's dispatch"))?;
            let material = crate::rail::risk::MaterialIdentity::Committed { base_id: base, head_id: head };
            if settlement.boundary.run_id != active.id || scope.phase.get() != plan.phase || scope.plan.map(|p| p.get()) != Some(plan.plan)
                || scope.occurrence != format!("phase-{}-execution", plan.phase) || settlement.material != material
                || !crate::rail::receipts::assess(settlement, data)?.permits_continuation {
                return Err(refuse("risk-pending", "the plan's exact risk settlement is pending; the suite receipt is retained and completion waits for both"));
            }
            proposed = end_dispatch(&proposed, plan, &active, &task_records, super::model::PlanDisposition::Complete, vec![], &record_digest)?;
        }
    }
    let record = PlanRecord { schema: "native-plan-event-1".into(), root_binding: root.into(),
        version: projection.version.checked_add(1).ok_or_else(|| refuse("plan-version", "version exhausted"))?,
        request_digest: record_digest, request: request.clone() };
    history.push(record.clone());
    if let Some(question) = generated_question {
        let question_request = PlanRequest { request_id: format!("{}:question", question.id), plan: plan.clone(),
            expected_version: record.version, event: PlanEvent::SuiteRepairQuestion(question) };
        let question_record = PlanRecord { schema: "native-plan-event-1".into(), root_binding: root.into(),
            version: record.version.checked_add(1).ok_or_else(|| refuse("plan-version", "version exhausted"))?,
            request_digest: plan_request_digest(&question_request)?, request: question_request };
        history.push(question_record);
    }
    let namespace = proposed.as_object_mut().ok_or_else(|| refuse("plan-shape", "snapshot must be an object"))?
        .entry(PLAN_NAMESPACE).or_insert_with(|| json!({"schema":"native-plans-1","phases":{}}));
    namespace["phases"][plan.phase.to_string()] = serde_json::to_value(history)?;
    Ok((proposed, record))
}

pub fn plan_decision(record: &PlanRecord) -> Result<DecisionRecord> {
    Ok(DecisionRecord { version: 1, id: format!("native-plan:{}:{}", record.request.plan.phase, record.request_digest), revision: 1,
        origin: Origin { source: "native-plan-event-1".into(), original: Evidence::Missing },
        decision: Decision::Gate { outcome: "native-plan-event-1".into(), evidence: Evidence::Text(serde_json::to_string(record)?) } })
}

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag="kind",rename_all="kebab-case",deny_unknown_fields)]
pub enum ProgressEvent {
    Progress {text:String,evidence:Vec<String>},
    Deviation {text:String,evidence:Vec<String>},
    FailedAttempt {text:String,evidence:Vec<String>},
}

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ProgressInput {
    pub request_id:String,
    pub task:Task,
    pub attempt:String,
    pub expected_version:u64,
    pub event:ProgressEvent,
}

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct CheckpointInput {
    pub request_id:String,
    pub task:Task,
    pub attempt:String,
    pub expected_version:u64,
    pub checkpoint:crate::evidence::checkpoint::Checkpoint,
    pub question_id:String,
    pub question:String,
}

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct AnswerInput {
    pub request_id:String,
    pub task:Task,
    pub attempt:String,
    pub expected_version:u64,
    pub owner:String,
    pub at:String,
    pub answer:crate::evidence::gates::Answer,
}

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag="operation",deny_unknown_fields)]
pub enum ProgressApply {
    #[serde(rename="execution-task-progress")]
    Progress {request:ProgressInput},
    #[serde(rename="execution-task-checkpoint")]
    Checkpoint {request:CheckpointInput},
    #[serde(rename="execution-task-answer")]
    Answer {request:AnswerInput},
}
