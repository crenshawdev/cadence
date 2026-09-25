//! Independent verification launches never reopen execution task state.
use crate::process::Process;
use super::{inputs::{self, refuse}, model::{Run, Source}, persistence};
use crate::{execution::{receipts::{Launch, RunResult, Stage}, runner as child},
    store::{Error, Result, model::{digest, DecisionRecord, Decision, Origin, Evidence}, writer::{Operation, Store}}};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{collections::BTreeMap, path::{Path, PathBuf}};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case", deny_unknown_fields)]
pub enum Event {
    Launch { request: Box<Run>, launch: Box<Launch>, documents: BTreeMap<String, String> },
    Result { run_id: String, result: Box<RunResult>, source_after: Option<Source> },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Record {
    pub schema: String,
    pub root: PathBuf,
    pub root_binding: String,
    pub attempt: String,
    pub id: String,
    pub event: Event,
}

pub fn records(data: &Value) -> Result<Vec<Record>> {
    persistence::attempt_values(data)?;
    Ok(data[persistence::NAMESPACE].get("runs").cloned().map(serde_json::from_value).transpose()?.unwrap_or_default())
}

/// A run document needs only matching launches/results, not every capture.
pub fn records_for_run(data: &Value, run: &str) -> Result<Vec<Record>> {
    persistence::attempt_values(data)?;
    let Some(records) = data[persistence::NAMESPACE].get("runs") else { return Ok(vec![]); };
    let records = records.as_array().ok_or_else(|| Error::from(Vec::<Record>::deserialize(records).unwrap_err()))?;
    records.iter().filter(|r| r["event"]["run_id"] == run || r["event"]["launch"]["run_id"] == run)
        .map(|r| Record::deserialize(r).map_err(Error::from)).collect()
}

pub fn result<'a>(records: &'a [Record], run_id: &str) -> Option<&'a Record> {
    records.iter().find(|r| matches!(&r.event, Event::Result { run_id: id, .. } if id == run_id))
}

/// Exit zero alone is not an independent observed check. Require a complete,
/// recognized successful summary that actually reports at least one test.
pub fn acceptable(result: &RunResult) -> bool {
    use crate::execution::receipts::{Disposition, Observation, Summary};
    if result.disposition != (Disposition::Exited { code: 0 }) || !result.stdout.complete || !result.stderr.complete {
        return false;
    }
    let passed = matches!(&result.observation,
        Observation::ResultsObserved { summary: Summary::Cargo { failed: false } });
    let nonempty = [&result.stdout, &result.stderr].iter().any(|capture| {
        String::from_utf8_lossy(&capture.bytes).lines().chain(capture.result_lines.iter().map(String::as_str)).any(|line| {
            let words: Vec<_> = line.split_whitespace().collect();
            (words.first() == Some(&"Ran") && words.get(1).is_some_and(|n| n.parse::<u64>().is_ok_and(|n| n > 0)))
                || (line.starts_with("test result: ok.") && words.get(3).is_some_and(|n| n.parse::<u64>().is_ok_and(|n| n > 0)))
                || child::nextest_summary(line).is_some_and(|summary| summary.nonempty && !summary.failed)
        })
    });
    passed && nonempty
}

pub fn decision(record: &Record) -> Result<DecisionRecord> {
    Ok(DecisionRecord { version: 1, id: format!("verification-run:{}", record.id), revision: 1,
        origin: Origin { source: "verification-run-1".into(), original: Evidence::Missing },
        decision: Decision::Gate { outcome: "verification-run-1".into(), evidence: Evidence::Text(serde_json::to_string(record)?) },
        at: crate::store::model::stamped_at() })
}

pub fn contribute(data: &Value, binding: &str, record: &Record) -> Result<Value> {
    let attempt = persistence::attempt(data, None, &record.attempt)?
        .ok_or_else(|| Error::Invalid("verification attempt absent".into()))?;
    let phase = attempt.inputs.basis.phase;
    let mut history = records(data)?;
    if let Some(prior) = history.iter().find(|r| r.id == record.id) {
        return if prior == record { Ok(data.clone()) } else {
            Err(refuse(phase, "verification-run-reuse", "request_id", "run identity already names another payload"))
        };
    }
    if record.schema != "verification-run-1" || record.root_binding != binding {
        return Err(refuse(phase, "verification-run-binding", "basis", "verification run root or schema mismatch"));
    }
    match &record.event {
        Event::Launch { request, launch, .. } => {
            let item = attempt.inputs.checks.iter().find(|i| i["id"] == request.item.id && i["item_revision"] == request.item.item_revision)
                .ok_or_else(|| refuse(phase, "verification-item", "item", "saved canonical check revision required"))?;
            if request.basis != attempt.inputs.basis || request.attempt != attempt.id || request.request_id != record.id
                || request.request_id.trim().is_empty() || request.request_id.len() > 256
                || launch.run_id != record.id || launch.check.as_ref() != Some(&request.item)
                || launch.material.command != item["spec"]["command"] || launch.material.test_file != item["spec"]["test"]["file"]
                || launch.material.commit != request.basis.source.head || launch.material.tree != request.basis.source.tree
                || inputs::authority_digest(data)? != attempt.inputs.authority_digest {
                return Err(refuse(phase, "verification-run-basis", "basis", "launch differs from saved check or current authority"));
            }
        }
        Event::Result { run_id, result: observed, source_after } => {
            let launch = history.iter().find_map(|r| match &r.event {
                Event::Launch { launch, .. } if r.id == *run_id && r.attempt == record.attempt => Some(launch), _ => None,
            }).ok_or_else(|| refuse(phase, "verification-run-result", "run_id", "matching launch absent"))?;
            if record.id != format!("{run_id}:result") || result(&history, run_id).is_some() || observed.run_id != *run_id
                || observed.observed_at < launch.launched_at
                || [&observed.stdout, &observed.stderr].iter().any(|c| c.bytes.len() > 65536 || c.digest != digest(&c.bytes)
                    || c.result_lines.iter().any(|line| !child::valid_result_line(line)))
                || !child::observation_consistent(&observed.observation, &observed.stdout, &observed.stderr)
                || (observed.material_unchanged && source_after.as_ref() != Some(&attempt.inputs.basis.source)) {
                return Err(refuse(phase, "verification-run-result", "result", "result duplicates or differs from observed material and captures"));
            }
        }
    }
    history.push(record.clone());
    let mut next = data.clone();
    next[persistence::NAMESPACE]["runs"] = json!(history);
    Ok(next)
}

pub fn reobserve_launch(data: &Value, record: &Record, process: &mut dyn Process) -> Result<()> {
    if let Event::Launch { documents, .. } = &record.event {
        let attempt = persistence::attempt(data, None, &record.attempt)?
            .ok_or_else(|| Error::Invalid("verification attempt absent".into()))?;
        inputs::reobserve_external(&record.root, data, &attempt.inputs, documents, process)?;
    }
    Ok(())
}

async fn append(store: &Store, record: Record) -> Result<Record> {
    let view = store.request(Operation::ReadVerified).await?;
    let written = store.request(Operation::VerificationRunV1 { expected_generation: view.snapshot.generation,
        expected_integrity: view.snapshot.integrity, record: Box::new(record.clone()) }).await?;
    records(&written.snapshot.data)?.into_iter().find(|r| r.id == record.id)
        .ok_or_else(|| Error::Invalid("confirmed verification run missing".into()))
}

pub async fn launch(
    store: Store,
    root: PathBuf,
    request: Run,
    process: &mut (dyn Process + Send),
) -> Result<Record> {
    let view = store.request(Operation::ReadVerified).await?;
    let history = records(&view.snapshot.data)?;
    if let Some(prior) = history.iter().find(|r| r.id == request.request_id) {
        return if matches!(&prior.event, Event::Launch { request: saved, .. } if **saved == request) {
            Ok(prior.clone())
        } else { Err(refuse(request.basis.phase, "verification-run-reuse", "request_id", "request already names another run payload")) };
    }
    let attempt = persistence::attempt(&view.snapshot.data, None, &request.attempt)?
        .ok_or_else(|| refuse(request.basis.phase, "verification-attempt", "attempt", "attempt absent"))?;
    if attempt.inputs.basis != request.basis {
        return Err(refuse(request.basis.phase, "verification-run-basis", "basis", "echo the saved attempt basis"));
    }
    let observed = inputs::observe(&root, &view.snapshot.data, request.basis.phase, process)?;
    if observed != attempt.inputs {
        return Err(refuse(request.basis.phase, "verification-run-basis", "basis", "attempt is historical; request a current dispatch"));
    }
    let item = attempt.inputs.checks.iter().find(|i| i["id"] == request.item.id && i["item_revision"] == request.item.item_revision)
        .ok_or_else(|| refuse(request.basis.phase, "verification-item", "item", "saved check revision required"))?;
    let command = item["spec"]["command"].as_str().ok_or_else(|| Error::Invalid("saved command absent".into()))?;
    let test = item["spec"]["test"]["file"].as_str().ok_or_else(|| Error::Invalid("test locator absent".into()))?;
    let project = Path::new(&request.basis.project);
    let launch = Launch { run_id: request.request_id.clone(), check: Some(request.item.clone()), stage: Stage::Verify,
        material: child::material(project, command, test, process)?, launched_at: child::now() };
    let documents = crate::plan::inventory::read(&root, &request.basis.phase.to_string(), &view.snapshot.data)?.documents;
    let record = Record { schema: "verification-run-1".into(), root, root_binding: request.basis.root_binding.clone(),
        attempt: request.attempt.clone(), id: request.request_id.clone(), event: Event::Launch { request: Box::new(request.clone()), launch: Box::new(launch.clone()), documents } };
    let written = append(&store, record.clone()).await?;
    tokio::spawn(async move {
        let project = PathBuf::from(&request.basis.project);
        let expected = request.basis.source.clone();
        let process = tokio::task::spawn_blocking(move || {
            if inputs::source(&project, &mut crate::process::System).ok().as_ref()
                != Some(&expected)
            {
                use crate::execution::receipts::{Capture, Disposition, Observation};
                let empty = Capture::new(vec![], true, vec![]);
                return (RunResult { run_id: launch.run_id, disposition: Disposition::LaunchFailed {
                    reason: "verification source changed before process launch".into() },
                    stdout: empty.clone(), stderr: empty, observed_at: child::now(),
                    observation: Observation::Unknown, material_unchanged: false }, inputs::source(&project, &mut crate::process::System).ok());
            }
            let mut result = child::observe_child(&project, &launch, &mut crate::process::System);
            let source_after = inputs::source(&project, &mut crate::process::System).ok();
            result.material_unchanged &= source_after.as_ref() == Some(&expected);
            (result, source_after)
        }).await;
        if let Ok((result, source_after)) = process {
            let observed = Record { id: format!("{}:result", record.id), event: Event::Result { run_id: record.id.clone(), result: Box::new(result), source_after }, ..record };
            for _ in 0..3 {
                match append(&store, observed.clone()).await {
                    Ok(_) => return,
                    Err(Error::Conflict(_)) => continue,
                    Err(_) => return,
                }
            }
        }
    });
    Ok(written)
}

#[cfg(test)]
mod tests {
    use super::acceptable;
    use crate::execution::receipts::{Capture, Disposition, Observation, RunResult, Summary};

    #[test]
    fn acceptable_requires_a_nonzero_passing_nextest_summary() {
        let pass = "        PASS [  16.118s] (1/1) cadence::phase33_execution phase33_execute_next_answers_dispatch_id_and_route";
        let summary = "     Summary [  16.118s] 1 test run: 1 passed, 2 skipped";
        let result = RunResult {
            run_id: "verify-p33-t1-independent-1".into(),
            disposition: Disposition::Exited { code: 0 },
            stdout: Capture::new(vec![], true, vec![]),
            stderr: Capture::new(vec![], true, vec![pass.into(), summary.into()]),
            observed_at: 1,
            observation: Observation::ResultsObserved { summary: Summary::Cargo { failed: false } },
            material_unchanged: true,
        };
        assert!(acceptable(&result), "the retained nextest summary reports one passing test");

        for (line, failed, expected) in [
            ("Summary [ 0.001s] 2 tests run: 2 passed", false, true),
            ("Summary [ 0.001s] 0 tests run: 0 passed, 3 skipped", false, false),
            ("Summary [ 0.001s] 1 test run: 0 passed", false, false),
            ("Summary [ 0.001s] 2 tests run: 1 passed, 1 failed", true, false),
            ("Summary [ 0.001s] 2 tests run: 1 passed, 1 failed", false, false),
            (pass, false, false),
            ("unrecognised output", false, false),
            ("test result: ok. 1 passed; 0 failed", false, true),
            ("test result: ok. 0 passed; 0 failed", false, false),
        ] {
            let mut candidate = result.clone();
            candidate.stderr = Capture::new(vec![], true, vec![line.into()]);
            candidate.observation = Observation::ResultsObserved { summary: Summary::Cargo { failed } };
            assert_eq!(acceptable(&candidate), expected, "{line}, failed={failed}");
        }

        let mut candidate = result.clone();
        candidate.disposition = Disposition::Exited { code: 100 };
        assert!(!acceptable(&candidate));
        let mut candidate = result.clone();
        candidate.stdout.complete = false;
        assert!(!acceptable(&candidate));
        let mut candidate = result.clone();
        candidate.stderr.complete = false;
        assert!(!acceptable(&candidate));
        let mut candidate = result.clone();
        candidate.observation = Observation::Unknown;
        assert!(!acceptable(&candidate));

        let mut candidate = result.clone();
        candidate.stderr = Capture::new(format!("{pass}\n{summary}\n").into_bytes(), true, vec![]);
        let candidate: RunResult = serde_json::from_value(serde_json::to_value(candidate).unwrap()).unwrap();
        assert!(!candidate.stderr.bytes.is_empty(), "text captures restore bytes on read");
        assert!(acceptable(&candidate));
    }
}
