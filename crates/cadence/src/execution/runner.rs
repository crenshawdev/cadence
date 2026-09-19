//! The same native command core serves public requests and unit callers.
use super::{admission, allocation::Check, history::{self, Event, Record, Request, Task}, receipts::*};
use crate::store::{Error, Result, model::digest, writer::{Operation, Store}};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::{io::Read, path::{Path, PathBuf}, process::{Command, Stdio}, time::{SystemTime, UNIX_EPOCH}};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Start {
    pub request_id: String,
    pub task: Task,
    pub attempt: String,
    pub expected_version: u64,
    pub predecessor: Option<String>,
    pub checks: Vec<Check>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Run {
    pub request_id: String,
    pub task: Task,
    pub attempt: String,
    pub expected_version: u64,
    pub command: String,
    pub check: Option<Check>,
    pub stage: Stage,
}

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum Apply {
    #[serde(rename = "execution-task-start")]
    Start { request: Start },
    #[serde(rename = "execution-run")]
    Run { request: Run },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct PlanInput {
    pub request_id: String,
    pub plan: history::PlanIdentity,
    pub expected_version: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct SuiteInput {
    pub request_id: String,
    pub plan: history::PlanIdentity,
    pub expected_version: u64,
    #[serde(default)]
    pub proposed_paths: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct RepairAnswerInput {
    pub request_id: String,
    pub plan: history::PlanIdentity,
    pub expected_version: u64,
    pub question_id: String,
    pub owner: String,
    pub at: String,
    pub disposition: history::SuiteRepairDisposition,
}

impl RepairAnswerInput {
    pub fn plan_request(self) -> Result<history::PlanRequest> {
        if self.owner.trim().is_empty() || self.at.trim().is_empty() {
            return Err(admission::refuse(self.plan.phase, "suite-repair-answer", "owner", &self.question_id,
                "repair answer requires nonblank owner attribution and time"));
        }
        Ok(history::PlanRequest { request_id: self.request_id, plan: self.plan,
            expected_version: self.expected_version, event: history::PlanEvent::SuiteRepairAnswer(
                history::SuiteRepairAnswer { question_id: self.question_id, owner: self.owner,
                    at: self.at, disposition: self.disposition }) })
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct RepairInput {
    pub request_id: String,
    pub plan: history::PlanIdentity,
    pub expected_version: u64,
    pub question_id: String,
    pub commits: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct RelaunchInput {
    pub request_id: String,
    pub plan: history::PlanIdentity,
    pub expected_version: u64,
    pub statement: history::OwnerAbsence,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct RoundInput {
    pub request_id: String,
    pub plan: history::PlanIdentity,
    pub expected_version: u64,
    pub statement: history::OwnerRound,
}

/// The plan-level operations: the one suite, the operator's single confirmed
/// relaunch of a launch with no recognized result, and native completion.
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum PlanApply {
    #[serde(rename = "execution-worker-exit")]
    WorkerExit { #[serde(flatten)] report: WorkerExit },
    #[serde(rename = "execution-round-record")]
    RoundRecord { request: RoundInput },
    #[serde(rename = "execution-suite")]
    Suite { request: SuiteInput },
    #[serde(rename = "execution-suite-repair-answer")]
    RepairAnswer { request: RepairAnswerInput },
    #[serde(rename = "execution-suite-repair")]
    Repair { request: RepairInput },
    #[serde(rename = "execution-suite-relaunch")]
    Relaunch { request: RelaunchInput },
    #[serde(rename = "execution-plan-complete")]
    Complete { request: PlanInput },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum WorkerOutcome { Exited, Failed }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct WorkerExit {
    pub request_id: String,
    pub phase: u32,
    pub host: String,
    pub outcome: WorkerOutcome,
    #[serde(default)] pub detail: Option<String>,
    #[serde(default)] pub dispatch: Option<String>,
    #[serde(default)] pub attempt: Option<String>,
    #[serde(default)] pub review: Option<String>,
}

pub async fn worker_exit(store: &Store, report: WorkerExit) -> Result<serde_json::Value> {
    use serde_json::json;
    let view = store.request(Operation::ReadVerified).await?;
    let data = &view.snapshot.data;
    let key = crate::store::model::digest(report.request_id.as_bytes());
    let prior = &data["worker_exits"][&key];
    if !prior.is_null() {
        if prior["request"] != json!(report) {
            return Err(super::admission::refuse(report.phase, "exit-request-reuse", "request_id", &report.request_id, "exit request already names another payload"));
        }
        return Ok(prior["answer"].clone());
    }
    let targets = [&report.dispatch, &report.attempt, &report.review];
    if report.phase == 0 || report.request_id.trim().is_empty() || report.host.trim().is_empty()
        || targets.iter().filter(|id| id.is_some()).count() != 1 {
        return Err(super::admission::refuse(report.phase, "exit-target", "target", "", "positive phase, request, host and exactly one dispatch, attempt or review required"));
    }
    let generation = view.snapshot.generation + 1;
    let at = now() / 1000;
    let mut next = data.clone();
    let interrupted;
    if let Some(id) = &report.dispatch {
        if let Some(saved) = history::plan_records(data, report.phase)?.into_iter()
            .find(|r| r.request.request_id == report.request_id) {
            if let history::PlanEvent::WorkerExit { dispatch_id, host, outcome, detail, at, generation, interrupted } = &saved.request.event
                && *dispatch_id == *id && *host == report.host && *outcome == report.outcome && *detail == report.detail {
                return Ok(json!({"status":"ok","request_id":report.request_id,"interrupted":interrupted,"at":at,"generation":generation}));
            }
            return Err(super::admission::refuse(report.phase, "exit-request-reuse", "request_id", &report.request_id, "exit request already names another payload"));
        }
        let issue = &data["execution"]["occurrences"][report.phase.to_string()]["issues"][id];
        let plan = history::admitted_plans(data, report.phase)?.into_iter()
            .map(|(plan, _)| plan).find(|p| issue["operational"]["plan"] == p.plan)
            .ok_or_else(|| super::admission::refuse(report.phase, "exit-target", "dispatch", id, "dispatch was never issued"))?;
        let projection = history::plan_project(&history::plan_records(data, report.phase)?, &plan);
        interrupted = !projection.completed;
        let request = history::PlanRequest { request_id: report.request_id.clone(), plan,
            expected_version: projection.version, event: history::PlanEvent::WorkerExit {
                dispatch_id: id.clone(), host: report.host.clone(), outcome: report.outcome.clone(),
                detail: report.detail.clone(), at, generation, interrupted } };
        store.request(Operation::NativePlanV1 { expected_generation: view.snapshot.generation,
            expected_integrity: view.snapshot.integrity, request: Box::new(request) }).await?;
        return Ok(json!({"status":"ok","request_id":report.request_id,"interrupted":interrupted,"at":at,"generation":generation}));
    } else if let Some(id) = &report.attempt {
        if crate::verification::persistence::attempt(data, Some(report.phase), id)?.is_none() {
            return Err(super::admission::refuse(report.phase, "exit-target", "attempt", id, "verification attempt was never retained"));
        }
        interrupted = true;
        next["worker_interruptions"]["verification"][id] = json!(crate::verification::model::Interruption {
            request_id: report.request_id.clone(), host: report.host.clone(), outcome: report.outcome.clone(),
            detail: report.detail.clone(), at, generation });
    } else {
        let id = report.review.as_deref().expect("one target");
        let (records, observed) = crate::review::attempts::worker_exit(
            &crate::review::persistence::records(data)?, &report, id, at)?;
        next["review"] = records;
        interrupted = observed;
    }
    let answer = json!({"status":"ok","request_id":report.request_id,"interrupted":interrupted,
        "at":at,"generation":generation});
    next["worker_exits"][key] = json!({"request":report,"answer":answer});
    store.request(Operation::CompareTransact { expected_generation: view.snapshot.generation,
        expected_integrity: view.snapshot.integrity, transaction: crate::store::transaction::Transaction {
            id: format!("worker-exit:{}", report.request_id), items: vec![], decisions: vec![],
            snapshot: Some(next), external: vec![] } }).await?;
    Ok(answer)
}

pub fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis().try_into().unwrap_or(u64::MAX)
}

pub fn git(project: &Path, args: &[&str]) -> Result<Vec<u8>> {
    let output = Command::new("git").args(args).current_dir(project).stdin(Stdio::null()).output()?;
    if !output.status.success() { return Err(Error::Invalid(format!("Git observation failed: {}", String::from_utf8_lossy(&output.stderr)))) }
    Ok(output.stdout)
}

pub fn git_text(project: &Path, args: &[&str]) -> Result<String> {
    String::from_utf8(git(project, args)?).map(|s| s.trim_end().to_owned()).map_err(|_| Error::Invalid("unrepresentable Git output".into()))
}

/// Commits after the last acknowledged progress, or a dirty tree, are visible
/// uncertainty that needs explicit reconciliation before any redispatch.
pub fn uncertainty(project: &Path, records: &[Record], view: &history::TaskView) -> Result<serde_json::Value> {
    let baseline = records.iter().rev().filter(|r| r.request.task == view.task).find_map(|r| match &r.request.event {
        Event::AcknowledgedProgress { commit, .. } => Some(commit.clone()),
        Event::Attempt { base_commit, .. } => Some(base_commit.clone()),
        _ => None,
    });
    let mut commits = Vec::new();
    if !view.state.completed && let Some(baseline) = baseline {
        commits = git_text(project, &["rev-list", "--reverse", &format!("{baseline}..HEAD")])?.lines().map(str::to_owned).collect();
    }
    let mut uncertainty = serde_json::json!({"requires_reconciliation":!commits.is_empty(),"commits":commits});
    if !view.state.completed && view.state.attempt.is_some()
        && crate::verification::inputs::clean_accounting(project, &crate::verification::inputs::confirmed_summaries(project)?).is_err() {
        uncertainty["requires_reconciliation"] = serde_json::json!(true);
        uncertainty["dirty_source"] = serde_json::json!(true);
    }
    Ok(uncertainty)
}

/// Every working-tree difference Git reports, as `(code, path)`, less the
/// store's own staging files: a commit between `prepare` and its rename has
/// `.planning/.state.json.<pid>.<seq>.tmp` beside its target, and that file
/// is the binary's, never the user's (D-160). A rename or copy carries its
/// origin path in the next entry; only the destination is kept.
pub fn status(project: &Path) -> Result<Vec<(String, String)>> {
    let output = git(project, &["status", "--porcelain=v1", "-z", "--untracked-files=all"])?;
    let mut entries = output.split(|b| *b == 0).filter(|e| !e.is_empty());
    let mut differences = Vec::new();
    while let Some(entry) = entries.next() {
        let entry = std::str::from_utf8(entry).map_err(|_| Error::Invalid("unrepresentable status entry".into()))?;
        let (code, name) = entry.split_at_checked(3).ok_or_else(|| Error::Invalid("invalid status entry".into()))?;
        if code.starts_with('R') || code.starts_with('C') { entries.next(); }
        if code == "?? " && own_staging(name) { continue; }
        differences.push((code.to_owned(), name.to_owned()));
    }
    Ok(differences)
}

fn own_staging(path: &str) -> bool {
    path.strip_prefix(".planning/")
        .and_then(|inside| inside.rsplit('/').next())
        .is_some_and(crate::store::filesystem::is_staging_name)
}

pub fn clean(project: &Path) -> Result<()> {
    if !status(project)?.is_empty() {
        return Err(Error::Invalid("evidence-source-dirty: commit source before requesting an evidence run".into()));
    }
    Ok(())
}

pub fn material(project: &Path, command: &str, test_file: &str) -> Result<Material> {
    crate::verification::inputs::clean_accounting(project, &crate::verification::inputs::confirmed_summaries(project)?)?;
    let commit = git_text(project, &["rev-parse", "HEAD"])?;
    let tree = git_text(project, &["rev-parse", "HEAD^{tree}"])?;
    let test = if test_file.is_empty() { vec![] } else { git(project, &["show", &format!("{commit}:{test_file}")])? };
    Ok(Material { commit, tree, test_file: test_file.into(), test_digest: digest(&test), command: command.into() })
}

pub async fn append(store: &Store, request: Request) -> Result<Record> {
    let view = store.request(Operation::ReadVerified).await?;
    let written = store.request(Operation::NativeTaskV1 { expected_generation: view.snapshot.generation,
        expected_integrity: view.snapshot.integrity, request: Box::new(request.clone()) }).await?;
    history::records(&written.snapshot.data, request.task.phase)?.into_iter().find(|r| r.request.request_id == request.request_id)
        .ok_or_else(|| Error::Invalid("confirmed task receipt missing".into()))
}

pub async fn start(store: &Store, project: &Path, input: Start) -> Result<Record> {
    let view = store.request(Operation::ReadVerified).await?;
    let prior = history::records(&view.snapshot.data, input.task.phase)?.into_iter().find(|r| r.request.request_id == input.request_id);
    let base_commit = match prior.as_ref().map(|r| &r.request.event) {
        Some(Event::Attempt { base_commit, .. }) => base_commit.clone(),
        _ => git_text(project, &["rev-parse", "HEAD"] )?,
    };
    append(store, Request { request_id: input.request_id, task: input.task, attempt: input.attempt, expected_version: input.expected_version,
        event: Event::Attempt { predecessor: input.predecessor, checks: input.checks, base_commit } }).await
}

/// Returns after confirmation and child ownership transfer. It never awaits the
/// child's exit on the resident's serial request loop.
pub async fn launch(store: Store, project: PathBuf, input: Run) -> Result<Record> {
    let view = store.request(Operation::ReadVerified).await?;
    let history = history::records(&view.snapshot.data, input.task.phase)?;
    if let Some(prior) = history.iter().find(|r| r.request.request_id == input.request_id) {
        let Event::Launch(launch) = &prior.request.event else { return Err(Error::Invalid("task-request-reuse".into())) };
        if prior.request.task != input.task || prior.request.attempt != input.attempt || prior.request.expected_version != input.expected_version
            || launch.material.command != input.command || launch.check != input.check || launch.stage != input.stage {
            return Err(Error::Invalid("task-request-reuse".into()));
        }
        return Ok(prior.clone());
    }
    let publication = crate::plan::persistence::saved(&view.snapshot.data, input.task.phase)?
        .and_then(|p| p.publications.get(&input.task.plan).cloned())
        .ok_or_else(|| Error::Invalid("task publication missing".into()))?;
    let execution = &publication.content.execution;
    let named = execution.tasks.iter().find(|t| t.id == input.task.task)
        .ok_or_else(|| Error::Invalid("task missing".into()))?;
    if !named.verify.contains(&input.command) {
        return Err(admission::refuse(input.task.phase, "named-command", "command", &input.task.task, "select an admitted task command; replacement text and suite launches are unavailable"));
    }
    let mut test_file = String::new();
    if let Some(check) = &input.check {
        let basis = admission::records(&view.snapshot.data, input.task.phase)?.into_iter()
            .find(|b| b.request_digest == input.task.admission_digest).ok_or_else(|| Error::Invalid("admission missing".into()))?;
        for binding in &basis.request.contract.plans {
            let published = crate::plan::persistence::saved(&view.snapshot.data, input.task.phase)?.unwrap().publications[&binding.plan].clone();
            let map = crate::plan::map_view::checked_map(&view.snapshot.data, input.task.phase, &published)?;
            for item in map.items {
                if let crate::plan::evidence::Item::Check { id, spec, .. } = item
                    && id == check.id && map.item_revisions[&id] == check.item_revision {
                    if spec.command != input.command { return Err(Error::Invalid("named check command differs".into())); }
                    test_file = spec.test.file;
                }
            }
        }
        if test_file.is_empty() { return Err(Error::Invalid("committed check test locator required".into())); }
    } else if input.stage != Stage::Verify { return Err(Error::Invalid("red/green launch needs an admitted check".into())); }
    let observed = material(&project, &input.command, &test_file)?;
    let launch = Launch { run_id: input.request_id.clone(), check: input.check, stage: input.stage, material: observed, launched_at: now() };
    let request = Request { request_id: input.request_id, task: input.task, attempt: input.attempt,
        expected_version: input.expected_version, event: Event::Launch(launch.clone()) };
    let record = append(&store, request.clone()).await?;
    // Owned background task outlives this request, while still using one Store.
    tokio::spawn(async move {
        let process_project = project.clone();
        let process_launch = launch.clone();
        let result = tokio::task::spawn_blocking(move || observe_child(&process_project, &process_launch)).await;
        if let Ok(result) = result {
            for _ in 0..3 {
                let Ok(view) = store.request(Operation::ReadVerified).await else { return };
                let Ok(records) = history::records(&view.snapshot.data, request.task.phase) else { return };
                let expected_version = history::project(&records, &request.task).version;
                let observed = Request { request_id: format!("{}:result", request.request_id), task: request.task.clone(),
                    attempt: request.attempt.clone(), expected_version, event: Event::Result(result.clone()) };
                match append(&store, observed).await {
                    Ok(_) => return,
                    Err(Error::Conflict(_)) => continue,
                    Err(_) => return,
                }
            }
        }
    });
    Ok(record)
}

pub async fn plan_append(store: &Store, request: history::PlanRequest) -> Result<history::PlanRecord> {
    let view = store.request(Operation::ReadVerified).await?;
    let written = store.request(Operation::NativePlanV1 { expected_generation: view.snapshot.generation,
        expected_integrity: view.snapshot.integrity, request: Box::new(request.clone()) }).await?;
    history::plan_records(&written.snapshot.data, request.plan.phase)?.into_iter().find(|r| r.request.request_id == request.request_id)
        .ok_or_else(|| Error::Invalid("confirmed plan receipt missing".into()))
}

pub async fn suite_repair(store: &Store, project: &Path, input: RepairInput) -> Result<history::PlanRecord> {
    use history::{PlanEvent, PlanRequest, SuiteRepair};
    let view = store.request(Operation::ReadVerified).await?;
    let records = history::plan_records(&view.snapshot.data, input.plan.phase)?;
    if let Some(prior) = records.iter().find(|record| record.request.request_id == input.request_id) {
        let PlanEvent::SuiteRepair(repair) = &prior.request.event else {
            return Err(admission::refuse(input.plan.phase, "plan-request-reuse", "request_id", &input.request_id,
                "request already names another payload"));
        };
        if prior.request.plan != input.plan || prior.request.expected_version != input.expected_version
            || repair.question_id != input.question_id || repair.commits != input.commits {
            return Err(admission::refuse(input.plan.phase, "plan-request-reuse", "request_id", &input.request_id,
                "request already names another payload"));
        }
        return Ok(prior.clone());
    }
    crate::verification::inputs::clean_accounting(project, &crate::verification::inputs::confirmed_summaries(project)?)?;
    let projection = history::plan_project(&records, &input.plan);
    let question = projection.repair_question.as_ref()
        .filter(|question| question.id == input.question_id)
        .ok_or_else(|| admission::refuse(input.plan.phase, "suite-repair", "question_id", &input.question_id,
            "repair requires the current retained suite question"))?;
    let failed_commit = records.iter().find_map(|record| match &record.request.event {
        PlanEvent::SuiteLaunch(launch) if record.request.plan == input.plan && launch.run_id == question.failed_run => {
            Some(launch.material.commit.clone())
        }
        _ => None,
    }).ok_or_else(|| Error::Invalid("suite repair question lacks its failed launch".into()))?;
    let head = git_text(project, &["rev-parse", "HEAD"])?;
    let mut changed_paths = std::collections::BTreeMap::new();
    let mut predecessor = failed_commit;
    for commit in &input.commits {
        if !crate::rail::risk::valid_object_id(commit) || commit == &predecessor {
            return Err(admission::refuse(input.plan.phase, "suite-repair", "commits", commit,
                "repair commits require distinct full object ids after the failed launch"));
        }
        git(project, &["cat-file", "-e", &format!("{commit}^{{commit}}")])?;
        git(project, &["merge-base", "--is-ancestor", &predecessor, commit])?;
        git(project, &["merge-base", "--is-ancestor", commit, &head])?;
        git(project, &["verify-commit", commit])?;
        changed_paths.insert(commit.clone(), super::receipts::commit_paths(project, commit)?);
        predecessor = commit.clone();
    }
    plan_append(store, PlanRequest { request_id: input.request_id, plan: input.plan,
        expected_version: input.expected_version, event: PlanEvent::SuiteRepair(SuiteRepair {
            question_id: input.question_id, commits: input.commits, changed_paths,
        }) }).await
}

/// The suite launch is claimed before the process starts, exactly like a task
/// command; eligibility and the once-per-plan rule are validated in the store.
pub async fn suite_launch(store: Store, project: PathBuf, input: SuiteInput) -> Result<history::PlanRecord> {
    use history::{PlanEvent, PlanRequest, SuiteLaunch};
    let view = store.request(Operation::ReadVerified).await?;
    let history = history::plan_records(&view.snapshot.data, input.plan.phase)?;
    if let Some(prior) = history.iter().find(|r| r.request.request_id == input.request_id) {
        if !matches!(prior.request.event, PlanEvent::SuiteLaunch(_)) || prior.request.plan != input.plan || prior.request.expected_version != input.expected_version {
            return Err(admission::refuse(input.plan.phase, "plan-request-reuse", "request_id", &input.request_id, "request already names another payload"));
        }
        return Ok(prior.clone());
    }
    let publication = crate::plan::persistence::saved(&view.snapshot.data, input.plan.phase)?
        .and_then(|p| p.publications.get(&input.plan.plan).cloned())
        .ok_or_else(|| Error::Invalid("plan publication missing".into()))?;
    let observed = material(&project, &publication.content.execution.suite, "")?;
    let launch = SuiteLaunch { run_id: input.request_id.clone(), material: observed, launched_at: now(),
        proposed_paths: input.proposed_paths };
    let request = PlanRequest { request_id: input.request_id, plan: input.plan, expected_version: input.expected_version,
        event: PlanEvent::SuiteLaunch(launch.clone()) };
    let record = plan_append(&store, request.clone()).await?;
    tokio::spawn(async move {
        let process_project = project.clone();
        let process_launch = Launch { run_id: launch.run_id.clone(), check: None, stage: Stage::Verify, material: launch.material.clone(), launched_at: launch.launched_at };
        let result = tokio::task::spawn_blocking(move || observe_child(&process_project, &process_launch)).await;
        if let Ok(result) = result {
            for _ in 0..3 {
                let Ok(view) = store.request(Operation::ReadVerified).await else { return };
                let Ok(records) = history::plan_records(&view.snapshot.data, request.plan.phase) else { return };
                let expected_version = history::plan_project(&records, &request.plan).version;
                let observed = PlanRequest { request_id: format!("{}:result", request.request_id), plan: request.plan.clone(),
                    expected_version, event: PlanEvent::SuiteResult(result.clone()) };
                match plan_append(&store, observed).await {
                    Ok(_) => return,
                    Err(Error::Conflict(_)) => continue,
                    Err(_) => return,
                }
            }
        }
    });
    Ok(record)
}

pub(crate) fn capture(mut reader: impl Read) -> Capture {
    let mut bytes = Vec::new();
    let mut line = Vec::new();
    let mut result_lines = Vec::new();
    let mut complete = true;
    let mut buffer = [0; 8192];
    loop {
        match reader.read(&mut buffer) {
            Ok(0) => break,
            Ok(n) => {
                let retain = n.min(65536 - bytes.len());
                bytes.extend_from_slice(&buffer[..retain]);
                complete &= retain == n;
                for byte in &buffer[..n] {
                    if *byte == b'\n' {
                        if line.last() == Some(&b'\r') { line.pop(); }
                        if let Ok(value) = std::str::from_utf8(&line)
                            && valid_result_line(value) {
                            result_lines.push(value.to_owned());
                        }
                        line.clear();
                    } else {
                        line.push(*byte);
                    }
                }
            }
            Err(_) => { complete = false; break; }
        }
    }
    if !line.is_empty() && let Ok(value) = std::str::from_utf8(&line)
        && valid_result_line(value) {
        result_lines.push(value.to_owned());
    }
    Capture::new(bytes, complete, result_lines)
}

pub fn observe_child(project: &Path, launch: &Launch) -> RunResult {
    use std::os::unix::process::{CommandExt, ExitStatusExt};
    if !material(project, &launch.material.command, &launch.material.test_file).is_ok_and(|m| m == launch.material) {
        return RunResult { run_id: launch.run_id.clone(), disposition: Disposition::LaunchFailed { reason: "committed material changed before spawn".into() },
            stdout: capture(&b""[..]), stderr: capture(&b""[..]), observed_at: now(), observation: Observation::Unknown, material_unchanged: false };
    }
    let mut command = Command::new("sh");
    command.args(["-c", &launch.material.command]).current_dir(project).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    // The child cannot survive loss of its owning server on Linux.
    #[cfg(target_os = "linux")]
    let parent = std::process::id() as libc::pid_t;
    #[cfg(target_os = "linux")]
    unsafe { command.pre_exec(move || {
        if libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGKILL) != 0 { return Err(std::io::Error::last_os_error()) }
        if libc::getppid() != parent { return Err(std::io::Error::other("runner owner exited before spawn")) }
        Ok(())
    }); }
    let (disposition, stdout, stderr) = match command.spawn() {
        Ok(mut child) => {
            let stdout = child.stdout.take().expect("piped stdout");
            let stderr = child.stderr.take().expect("piped stderr");
            std::thread::scope(|scope| {
                let out = scope.spawn(|| capture(stdout));
                let err = scope.spawn(|| capture(stderr));
                let disposition = match child.wait() {
                    Ok(status) => status.code().map(|code| Disposition::Exited { code })
                        .unwrap_or(Disposition::Signaled { signal: status.signal().unwrap_or(0) }),
                    Err(error) => { let _ = child.kill(); let _ = child.wait(); Disposition::LaunchFailed { reason: error.to_string() } }
                };
                (disposition, out.join().expect("capture thread"), err.join().expect("capture thread"))
            })
        }
        Err(error) => (Disposition::LaunchFailed { reason: error.to_string() }, capture(&b""[..]), capture(&b""[..])),
    };
    let observation = classify(&stdout, &stderr);
    RunResult { run_id: launch.run_id.clone(), disposition, stdout, stderr, observed_at: now(), observation,
        material_unchanged: material(project, &launch.material.command, &launch.material.test_file).is_ok_and(|m| m == launch.material) }
}

pub fn valid_result_line(line: &str) -> bool {
    if line.contains(['\n', '\r']) { return false }
    // nextest indents every line it writes and cargo's own lines under it.
    let line = line.trim_start();
    if line.starts_with("test result:") || line == "OK" || line.starts_with("OK (")
        || line.starts_with("Ran ") || line.starts_with("FAILED (")
        || line.starts_with("FAIL: ") || line.starts_with("ERROR: ")
        || line.starts_with("Summary [") || line.starts_with("PASS [") || line.starts_with("FAIL [") {
        return true;
    }
    line.strip_prefix("test ").and_then(|value| value.rsplit_once(" ... "))
        .is_some_and(|(name, status)| !name.is_empty()
            && (matches!(status, "ok" | "FAILED" | "ignored" | "bench" | "FAIL" | "ERROR")
                || status.starts_with("skipped ")))
}

fn lines(capture: &Capture) -> Vec<String> {
    let mut lines = capture.bytes.split_inclusive(|byte| *byte == b'\n').filter_map(|line| {
        (line.last() == Some(&b'\n')).then(|| std::str::from_utf8(&line[..line.len()-1]).ok()
            .map(|line| line.trim_end_matches('\r').to_owned())).flatten()
    }).collect::<Vec<_>>();
    lines.extend(capture.result_lines.iter().cloned());
    lines
}

/// A retained observation is what the binary that recorded it saw. Unknown is
/// the weaker claim and needs an owner classification either way, so a later
/// classifier that recognizes the bytes does not make the record invalid; a
/// retained result that says more than the bytes say still does.
pub fn observation_consistent(stored: &Observation, stdout: &Capture, stderr: &Capture) -> bool {
    *stored == Observation::Unknown || *stored == classify(stdout, stderr)
}

pub(crate) struct NextestSummary {
    pub nonempty: bool,
    pub failed: bool,
}

/// Share nextest's summary grammar with independent verification, which also
/// needs positive run and passed counts before accepting a successful result.
pub(crate) fn nextest_summary(line: &str) -> Option<NextestSummary> {
    static NEXTEST: std::sync::LazyLock<regex::Regex> = std::sync::LazyLock::new(|| {
        regex::Regex::new(r"^Summary \[[^\]]*\] ([0-9]+) tests? run: ([0-9]+) passed(, ([0-9]+) failed)?").expect("fixed grammar")
    });
    let found = NEXTEST.captures(line.trim_start())?;
    Some(NextestSummary {
        nonempty: [1, 2].iter().all(|&index| found[index].parse::<u64>().is_ok_and(|n| n > 0)),
        failed: found.get(4).is_some_and(|count| count.as_str() != "0"),
    })
}

pub fn classify(stdout: &Capture, stderr: &Capture) -> Observation {
    let ran = regex::Regex::new(r"^Ran [0-9]+ tests?( in .+)?$").expect("fixed grammar");
    let failed = regex::Regex::new(r"^FAILED \(([^()]*)\)$").expect("fixed grammar");
    let counts = regex::Regex::new(r"^(failures|errors|skipped|expected failures|unexpected successes)=([0-9]+)$").expect("fixed grammar");
    let mut python_ran = false;
    let mut python_outcome = None;
    for capture in [stdout, stderr] {
        for line in lines(capture) {
            let line = line.trim_start();
            if line.starts_with("test result:") {
                return Observation::ResultsObserved { summary: Summary::Cargo { failed: line.starts_with("test result: FAILED") } };
            }
            // nextest runs cargo's test binaries and writes one Summary line;
            // it repeats cargo's `test result:` only under a failure.
            if let Some(summary) = nextest_summary(line) {
                return Observation::ResultsObserved { summary: Summary::Cargo { failed: summary.failed } };
            }
            if ran.is_match(line) { python_ran = true; }
            if line == "OK" { python_outcome = Some(Summary::Unittest { failed: false, failures: 0, errors: 0 }); }
            if let Some(found) = failed.captures(line) {
                let mut failures = 0; let mut errors = 0; let mut valid = true;
                for part in found[1].split(", ") {
                    if let Some(count) = counts.captures(part) {
                        let Ok(value) = count[2].parse::<u64>() else { valid = false; break };
                        match &count[1] { "failures" => failures = value, "errors" => errors = value, _ => {} }
                    } else { valid = false; }
                }
                if valid { python_outcome = Some(Summary::Unittest { failed: true, failures, errors }); }
            }
        }
    }
    if python_ran && let Some(summary) = python_outcome { return Observation::ResultsObserved { summary } }
    Observation::Unknown
}
