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
pub struct RelaunchInput {
    pub request_id: String,
    pub plan: history::PlanIdentity,
    pub expected_version: u64,
    pub statement: history::OwnerAbsence,
}

/// The plan-level operations: the one suite, the operator's single confirmed
/// relaunch of a launch with no recognized result, and native completion.
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum PlanApply {
    #[serde(rename = "execution-suite")]
    Suite { request: PlanInput },
    #[serde(rename = "execution-suite-relaunch")]
    Relaunch { request: RelaunchInput },
    #[serde(rename = "execution-plan-complete")]
    Complete { request: PlanInput },
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
    if !view.state.completed && view.state.attempt.is_some() && clean(project).is_err() {
        uncertainty["requires_reconciliation"] = serde_json::json!(true);
        uncertainty["dirty_source"] = serde_json::json!(true);
    }
    Ok(uncertainty)
}

pub fn clean(project: &Path) -> Result<()> {
    if !git(project, &["status", "--porcelain=v1", "-z", "--untracked-files=all"])?.is_empty() {
        return Err(Error::Invalid("evidence-source-dirty: commit source before requesting an evidence run".into()));
    }
    Ok(())
}

pub fn material(project: &Path, command: &str, test_file: &str) -> Result<Material> {
    clean(project)?;
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

/// The suite launch is claimed before the process starts, exactly like a task
/// command; eligibility and the once-per-plan rule are validated in the store.
pub async fn suite_launch(store: Store, project: PathBuf, input: PlanInput) -> Result<history::PlanRecord> {
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
    let launch = SuiteLaunch { run_id: input.request_id.clone(), material: observed, launched_at: now() };
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

fn capture(mut reader: impl Read) -> Capture {
    let mut bytes = Vec::new();
    let mut complete = true;
    let mut buffer = [0; 8192];
    loop {
        match reader.read(&mut buffer) {
            Ok(0) => break,
            Ok(n) => { let retain = n.min(65536 - bytes.len()); bytes.extend_from_slice(&buffer[..retain]); complete &= retain == n; }
            Err(_) => { complete = false; break; }
        }
    }
    Capture { digest: digest(&bytes), bytes, complete }
}

fn observe_child(project: &Path, launch: &Launch) -> RunResult {
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
    let observation = classify(&stdout.bytes, &stderr.bytes);
    RunResult { run_id: launch.run_id.clone(), disposition, stdout, stderr, observed_at: now(), observation,
        material_unchanged: material(project, &launch.material.command, &launch.material.test_file).is_ok_and(|m| m == launch.material) }
}

pub fn classify(stdout: &[u8], stderr: &[u8]) -> Observation {
    let ran = regex::Regex::new(r"^Ran [0-9]+ tests?( in .+)?$").expect("fixed grammar");
    let failed = regex::Regex::new(r"^FAILED \(([^()]*)\)$").expect("fixed grammar");
    let counts = regex::Regex::new(r"^(failures|errors|skipped|expected failures|unexpected successes)=([0-9]+)$").expect("fixed grammar");
    let mut python_ran = false;
    let mut python_outcome = None;
    for bytes in [stdout, stderr] {
        for line in bytes.split_inclusive(|b| *b == b'\n') {
            if line.last() != Some(&b'\n') { continue }
            let Ok(line) = std::str::from_utf8(&line[..line.len()-1]) else { continue };
            let line = line.trim_end_matches('\r');
            if line.starts_with("test result:") {
                return Observation::ResultsObserved { summary: Summary::Cargo { failed: line.starts_with("test result: FAILED") } };
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
