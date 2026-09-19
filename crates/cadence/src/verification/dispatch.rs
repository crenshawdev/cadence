use super::{inputs::Inputs, instructions};
use crate::execution::{history::{self, Event, PlanEvent, PlanIdentity, PlanRecord, Record, Task}, receipts::{Capture, Material, RunResult}};
use serde_json::{Value, json};
use std::collections::BTreeMap;

pub fn prompt(inputs: &Inputs, documents: &BTreeMap<String, String>) -> crate::store::Result<String> {
    let authored: BTreeMap<_, _> = inputs.basis.publications.iter().filter_map(|p| {
        let path = format!("phases/{}/PLAN-{}.md", inputs.basis.phase, p.plan);
        documents.get(&path).map(|body| (path, body))
    }).collect();
    let mut rendered = serde_json::to_value(inputs)?;
    rendered["execution"] = execution_view(inputs)?;
    Ok(format!("{}\n<operational-input>\n{}\n</operational-input>\n<authored-material>\n{}\n</authored-material>\n",
        instructions::contract_markdown(), serde_json::to_string_pretty(&rendered)?, serde_json::to_string_pretty(&authored)?))
}

/// GH-263: the prompt's execution block is a view of the retained history,
/// bounded the way the executor's dispatch is. Each plan carries its suite
/// runs and tasks; each task its runs, close, owner records and remaining
/// events by id; each check item is indexed to the pairs and attestations that
/// bear on it. A run's output stays on the record (D-177) and is read by id
/// through `execution-history`. The record itself, digested into the basis,
/// is untouched.
pub fn execution_view(inputs: &Inputs) -> crate::store::Result<Value> {
    let events: Vec<Record> = serde_json::from_value(inputs.execution["events"].clone())?;
    let plan_events: Vec<PlanRecord> = serde_json::from_value(inputs.execution["plan_events"].clone())?;
    let outcomes = inputs.execution["outcomes"].as_array().cloned().unwrap_or_default();
    let mut plans: BTreeMap<u32, PlanIdentity> = BTreeMap::new();
    for record in &events {
        let task = &record.request.task;
        plans.entry(task.plan).or_insert_with(|| PlanIdentity { phase: task.phase, occurrence: task.occurrence.clone(),
            admission_digest: task.admission_digest.clone(), plan: task.plan });
    }
    for record in &plan_events {
        plans.entry(record.request.plan.plan).or_insert_with(|| record.request.plan.clone());
    }
    let mut items: BTreeMap<String, Value> = inputs.checks.iter().filter_map(|c| c["id"].as_str())
        .map(|id| (id.to_owned(), json!({"pairs":[],"owner_statements":[],"classifications":[]}))).collect();
    let mut rendered = Vec::new();
    for (number, identity) in &plans {
        let mut tasks: Vec<&Task> = Vec::new();
        for record in &events {
            if record.request.task.plan == *number && !tasks.contains(&&record.request.task) { tasks.push(&record.request.task); }
        }
        let tasks = tasks.iter().map(|task| task_view(task, &events, &mut items)).collect::<crate::store::Result<Vec<_>>>()?;
        let suite_runs = plan_events.iter().filter(|r| r.request.plan == *identity).filter_map(|r| match &r.request.event {
            PlanEvent::SuiteLaunch(launch) => {
                let result = plan_events.iter().find_map(|r| match &r.request.event {
                    PlanEvent::SuiteResult(result) if r.request.plan == *identity && result.run_id == launch.run_id => Some(result), _ => None });
                let mut run = run_view(&launch.run_id, json!("suite"), Value::Null, &launch.material, launch.launched_at, result);
                if !launch.proposed_paths.is_empty() { run["proposed_paths"] = json!(launch.proposed_paths); }
                Some(run)
            }
            _ => None,
        }).collect::<Vec<_>>();
        let outcome = outcomes.iter().find(|o| o["plan"] == *number).cloned().unwrap_or(Value::Null);
        rendered.push(json!({"plan": identity, "suite": history::plan_project(&plan_events, identity), "outcome": outcome,
            "suite_runs": suite_runs, "tasks": tasks}));
    }
    Ok(json!({"schema": "verifier-execution-view-1", "digest": inputs.basis.execution_digest,
        "read": {"operation": "execution-history", "phase": inputs.basis.phase, "run": "<run id>"},
        "plans": rendered, "items": items}))
}

fn task_view(task: &Task, events: &[Record], items: &mut BTreeMap<String, Value>) -> crate::store::Result<Value> {
    let own: Vec<&Record> = events.iter().filter(|r| r.request.task == *task).collect();
    let mut runs = Vec::new();
    let mut close = Value::Null;
    let mut owner_statements = Vec::new();
    let mut classifications = Vec::new();
    let mut others = Vec::new();
    let where_ = |request_id: &str| json!({"plan": task.plan, "task": task.task, "request_id": request_id});
    for record in &own {
        let request_id = &record.request.request_id;
        match &record.request.event {
            Event::Launch(launch) => {
                let result = own.iter().find_map(|r| match &r.request.event {
                    Event::Result(result) if result.run_id == launch.run_id => Some(result), _ => None });
                runs.push(run_view(&launch.run_id, json!(launch.stage), json!(launch.check), &launch.material, launch.launched_at, result));
            }
            Event::Result(_) => {}
            Event::Close(proof) => {
                let submission = &proof.submission;
                for pair in &submission.checks {
                    item(items, &pair.check.id)["pairs"].as_array_mut().expect("pairs").push(json!({"plan": task.plan, "task": task.task,
                        "close": request_id, "red_commit": pair.red_commit, "green_commit": pair.green_commit,
                        "red_run": pair.red_run, "green_run": pair.green_run}));
                }
                close = json!({"request_id": request_id, "completion": submission.completion, "checks": submission.checks,
                    "verification": submission.verification});
            }
            Event::OwnerStatement(statement) => {
                item(items, &statement.submission.check.id)["owner_statements"].as_array_mut().expect("owner_statements").push(where_(request_id));
                owner_statements.push(json!({"request_id": request_id, "statement": statement}));
            }
            Event::OwnerClassification(classification) => {
                item(items, &classification.submission.check.id)["classifications"].as_array_mut().expect("classifications").push(where_(request_id));
                classifications.push(json!({"request_id": request_id, "statement": classification}));
            }
            Event::Checkpoint { .. } => {}
            event => others.push(json!({"request_id": request_id, "kind": serde_json::to_value(event)?["kind"]})),
        }
    }
    Ok(json!({"task": task, "state": history::project(events, task), "runs": runs, "close": close,
        "owner_statements": owner_statements, "classifications": classifications,
        "checkpoints": history::task_checkpoints(events, task), "events": others}))
}

fn item<'a>(items: &'a mut BTreeMap<String, Value>, id: &str) -> &'a mut Value {
    items.entry(id.to_owned()).or_insert_with(|| json!({"pairs":[],"owner_statements":[],"classifications":[]}))
}

fn run_view(run_id: &str, stage: Value, check: Value, material: &Material, launched_at: u64, result: Option<&RunResult>) -> Value {
    let capture = |capture: &Capture| json!({"digest": capture.digest, "byte_length": capture.bytes.len(), "complete": capture.complete});
    json!({"run_id": run_id, "stage": stage, "check": check, "material": material, "launched_at": launched_at,
        "result": result.map(|result| json!({"disposition": result.disposition, "observation": result.observation,
            "observed_at": result.observed_at, "material_unchanged": result.material_unchanged,
            "stdout": capture(&result.stdout), "stderr": capture(&result.stderr)}))})
}

#[cfg(test)]
mod tests {
    use super::super::model::{Basis, Source};
    use super::super::inputs::Inputs;
    use serde_json::json;

    fn inputs(execution: serde_json::Value) -> Inputs {
        Inputs {
            basis: Basis { project: "/p".into(), root_binding: "1:1;".into(), phase: 6, occurrence: "active-cycle:phase:6".into(),
                context_digest: "c".repeat(64), truths: vec![], publications: vec![], map_digest: "m".repeat(64),
                admission_digests: vec![], execution_digest: "e".repeat(64),
                source: Source { head: "h".repeat(40), tree: "t".repeat(40), index_digest: "i".repeat(64), material_digest: "d".repeat(64) } },
            map: json!({}), admissions: vec![], execution, checks: vec![json!({"id":"check/one"})], authority_digest: "a".repeat(64),
        }
    }

    fn task() -> serde_json::Value {
        json!({"phase":6,"occurrence":"active-cycle:phase:6","admission_digest":"9".repeat(64),"plan":1,"task":"T1"})
    }

    fn record(request_id: &str, version: u64, event: serde_json::Value) -> serde_json::Value {
        json!({"schema":"native-task-event-1","root_binding":"1:1;","version":version,"request_digest":"r".repeat(64),
            "request":{"request_id":request_id,"task":task(),"attempt":"attempt-1","expected_version":version-1,"event":event}})
    }

    // D-177 and GH-263: a retained run's captured output stays on the record;
    // the prompt names the run by id, its output by digest and length, and
    // carries no event list at all.
    #[test]
    fn prompt_names_runs_by_identity_and_never_carries_bytes() {
        let material = json!({"commit":"1".repeat(40),"tree":"2".repeat(40),"test_file":"tests/one.py","test_digest":"3".repeat(64),"command":"python3 tests/one.py"});
        let stdout = json!({"bytes":[116,101,115,116,32,114,101,115,117,108,116,58,32,111,107,10],"digest":"f".repeat(64),"complete":true,"result_lines":["test result: ok"]});
        let stderr = json!({"bytes":[],"digest":"0".repeat(64),"complete":true});
        let execution = json!({"events":[
            record("start-1", 1, json!({"kind":"attempt","predecessor":null,"checks":[{"id":"check/one","item_revision":"5".repeat(64)}],"base_commit":"1".repeat(40)})),
            record("r1", 2, json!({"kind":"launch","run_id":"r1","check":{"id":"check/one","item_revision":"5".repeat(64)},"stage":"green","material":material,"launched_at":10})),
            record("r1:result", 3, json!({"kind":"result","run_id":"r1","disposition":{"kind":"exited","code":0},"stdout":stdout,"stderr":stderr,"observed_at":11,
                "observation":{"class":"results-observed","summary":{"runner":"cargo","failed":false}},"material_unchanged":true})),
        ],"plan_events":[],"outcomes":[]});
        let prompt = super::prompt(&inputs(execution), &Default::default()).unwrap();
        let start = prompt.find("<operational-input>\n").unwrap() + "<operational-input>\n".len();
        let end = prompt.find("\n</operational-input>").unwrap();
        let rendered: serde_json::Value = serde_json::from_str(&prompt[start..end]).unwrap();
        let view = &rendered["execution"];
        assert!(view.get("events").is_none(), "{view}");
        let task_view = &view["plans"][0]["tasks"][0];
        assert_eq!(task_view["task"], task());
        assert_eq!(task_view["runs"], json!([{"run_id":"r1","stage":"green","check":{"id":"check/one","item_revision":"5".repeat(64)},
            "material":material,"launched_at":10,"result":{"disposition":{"kind":"exited","code":0},
            "observation":{"class":"results-observed","summary":{"runner":"cargo","failed":false}},"observed_at":11,"material_unchanged":true,
            "stdout":{"digest":"f".repeat(64),"byte_length":16,"complete":true},"stderr":{"digest":"0".repeat(64),"byte_length":0,"complete":true}}}]));
        assert_eq!(task_view["events"], json!([{"request_id":"start-1","kind":"attempt"}]));
        assert_eq!(task_view["close"], json!(null));
        assert_eq!(view["items"], json!({"check/one":{"pairs":[],"owner_statements":[],"classifications":[]}}));
        assert!(!prompt.contains("116,"), "capture bytes leaked into the prompt");
        assert!(!prompt.contains("result_lines"), "recognized lines leaked into the prompt");
    }
}
