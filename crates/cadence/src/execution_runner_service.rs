//! Root-bound adapter for the shared native runner; it owns no second writer.
use crate::{config::reload::ConfigIo, import::SessionFactory};
use cadence::{execution::{history, runner}, store::{Error, Result}};
use serde_json::{Value, json};
use std::path::Path;

pub async fn apply<I: ConfigIo + Clone + Sync>(factory: &SessionFactory<I>, root: &Path, raw: Value) -> Result<Value> {
    let input: runner::Apply = match serde_json::from_value(raw) {
        Ok(input) => input,
        Err(error) => return Ok(super::execution_service::native_error(Error::Invalid(error.to_string()))),
    };
    let session = factory.first_touch(root).await?;
    let view = session.derivation_view().await?;
    let task = match &input { runner::Apply::Start { request } => &request.task, runner::Apply::Run { request } => &request.task };
    let active = &view.snapshot.data["execution"]["occurrences"][task.phase.to_string()]["active"];
    if active["plan"] != task.plan || active["phase"] != task.phase {
        return Ok(super::execution_service::native_error(Error::Invalid("native task requires its active dispatch".into())));
    }
    let project = root.parent().ok_or_else(|| Error::Invalid("project root missing".into()))?;
    let result = match input {
        runner::Apply::Start { request } => runner::start(session.review_store(), project, request).await,
        runner::Apply::Run { request } => runner::launch(session.review_store().clone(), project.to_path_buf(), request).await,
    };
    Ok(match result {
        Ok(receipt) => json!({"status":"ok","receipt":receipt}),
        Err(error) => super::execution_service::native_error(error),
    })
}

/// The plan-level operations: the suite launch, the operator's absence
/// attestation for one relaunch, and native completion. Completion needs the
/// plan's one passing suite receipt and its exact risk settlement together.
pub async fn plan_apply<I: ConfigIo + Clone + Sync>(factory: &SessionFactory<I>, root: &Path, raw: Value) -> Result<Value> {
    use cadence::execution::history::{Completion, PlanEvent, PlanRequest};
    let input: runner::PlanApply = match serde_json::from_value(raw) {
        Ok(input) => input,
        Err(error) => return Ok(super::execution_service::native_error(Error::Invalid(error.to_string()))),
    };
    let session = factory.first_touch(root).await?;
    let view = session.derivation_view().await?;
    let project = root.parent().ok_or_else(|| Error::Invalid("project root missing".into()))?;
    let compact_round = matches!(input, runner::PlanApply::RoundRecord { .. });
    let result = match input {
        runner::PlanApply::WorkerExit { report } => return runner::worker_exit(session.review_store(), report).await,
        runner::PlanApply::RoundRecord { request } => runner::plan_append(session.review_store(), PlanRequest {
            request_id: request.request_id, plan: request.plan, expected_version: request.expected_version,
            event: PlanEvent::RoundRecord(request.statement),
        }).await,
        runner::PlanApply::Suite { request } => runner::suite_launch(session.review_store().clone(), project.to_path_buf(), request).await,
        runner::PlanApply::RepairAnswer { request } => match request.plan_request() {
            Ok(request) => runner::plan_append(session.review_store(), request).await,
            Err(error) => Err(error),
        },
        runner::PlanApply::Repair { request } => runner::suite_repair(session.review_store(), project, request).await,
        runner::PlanApply::Relaunch { request } => runner::plan_append(session.review_store(), PlanRequest { request_id: request.request_id,
            plan: request.plan, expected_version: request.expected_version, event: PlanEvent::SuiteRelaunch(request.statement) }).await,
        runner::PlanApply::Complete { request } => {
            let records = history::plan_records(&view.snapshot.data, request.plan.phase)?;
            if let Some(prior) = records.iter().find(|r| r.request.request_id == request.request_id) {
                if matches!(prior.request.event, PlanEvent::Completion(_)) && prior.request.plan == request.plan && prior.request.expected_version == request.expected_version {
                    Ok(prior.clone())
                } else {
                    Err(cadence::execution::admission::refuse(request.plan.phase, "plan-request-reuse", "request_id", &request.request_id, "request already names another payload"))
                }
            } else {
                // The settlement is computed only for a passing suite; every other
                // state is refused by the store with its own located rule.
                let projection = history::plan_project(&records, &request.plan);
                let suite_run = projection.launches.last().cloned().unwrap_or_default();
                let passed = history::suite_result(&records, &request.plan, &suite_run).is_some_and(history::suite_passed);
                let active = view.snapshot.data["execution"]["occurrences"][request.plan.phase.to_string()]["active"]["id"].as_str().unwrap_or_default().to_owned();
                let settlement = match (passed && !projection.completed && !active.is_empty())
                    .then(|| super::execution_service::native_settlement(&session, &view, root, request.plan.phase, request.plan.plan, &active)) {
                    Some(Ok(settlement)) => Some(settlement),
                    Some(Err(reason)) => return Ok(super::execution_service::native_error(cadence::execution::admission::refuse(request.plan.phase, "risk-pending", "plan",
                        &request.plan.plan.to_string(), format!("the suite receipt is retained; completion waits for the exact risk settlement: {reason}")))),
                    None => None,
                };
                runner::plan_append(session.review_store(), PlanRequest { request_id: request.request_id, plan: request.plan,
                    expected_version: request.expected_version, event: PlanEvent::Completion(Completion { suite_run, settlement }) }).await
            }
        }
    };
    Ok(match result {
        Ok(receipt) if compact_round => json!({"status":"ok","receipt":{
            "plan":receipt.request.plan,"request_id":receipt.request.request_id,"version":receipt.version}}),
        Ok(receipt) => json!({"status":"ok","receipt":receipt}),
        Err(error) => super::execution_service::native_error(error),
    })
}

/// One run by its id (GH-263): the launch and result records that name it,
/// from task, plan, or independent verifier events. Captures are read by
/// document identity beside metadata; the record keeps its bytes. A run the
/// phase never retained is refused, never answered with the phase.
pub async fn read_run<I: ConfigIo + Clone + Sync>(factory: &SessionFactory<I>, root: &Path, phase: u32, run: &str) -> Result<Value> {
    let session = factory.first_touch(root).await?;
    let view = session.shared_derivation_view().await?;
    Ok(match history::run_view(&view.snapshot.data, phase, run) {
        Ok(view) => json!({"status":"ok","schema":"native-run-history-1","phase":phase,"run_id":run,
            "launch":view.launch,"result":view.result,"identity":{"kind":"run-output","phase":phase,"run":run}}),
        Err(answer) => answer,
    })
}


pub async fn read<I: ConfigIo + Clone + Sync>(factory: &SessionFactory<I>, root: &Path, phase: u32,
    selected_plan: Option<u32>, selected_task: Option<String>) -> Result<Value> {
    let session = factory.first_touch(root).await?;
    let view = session.shared_derivation_view().await?;
    let records = history::selected_records(&view.snapshot.data, phase, selected_plan, None)?;
    let project = root.parent().ok_or_else(|| Error::Invalid("project root missing".into()))?;
    let plan_events = history::selected_plan_records(&view.snapshot.data, phase, selected_plan)?;
    let outcomes = history::plan_outcomes(&view.snapshot.data, phase)?;
    let active = &view.snapshot.data["execution"]["occurrences"][phase.to_string()]["active"];
    let mut answer = json!({"status":"ok","schema":"native-task-history-1","phase":phase,"bound":65536,
        "plans":[],"tasks":[],"active":active["id"].as_str().map(|id| {
            let mut entry = json!({"id":id,"identity":{"kind":"dispatch","id":id}});
            if let Some(selection) = active.get("owner_selection") {
                entry["owner_selection"] = selection.clone();
            }
            entry
        }),
        "repaired":view.snapshot.repaired,"incomplete":false,"continue":null});
    trim_ids(&mut answer, "repaired", 64);
    let mut started = selected_task.is_none();
    for (plan, _) in history::admitted_plans(&view.snapshot.data, phase)? {
        if selected_plan.is_some_and(|number| number != plan.plan) { continue; }
        let mut state = json!(history::plan_project(&plan_events, &plan));
        for key in ["launches", "results"] { trim_ids(&mut state, key, 64); }
        if state.to_string().len() > 8192 {
            state = json!({"version":state["version"],"outcome":state["outcome"],"completed":state["completed"],"truncated":true});
        }
        let mut outcome = json!(outcomes.iter().find(|o| o.plan == plan.plan));
        if outcome.to_string().len() > 8192 {
            outcome = json!({"disposition":outcome["disposition"],"truncated":true});
        }
        let row = json!({"state":state,"plan":plan,"outcome":outcome,
            "identity":{"kind":"phase-plan","phase":phase,"plan":plan.plan}});
        if !append_index(&mut answer, "plans", row, json!({"plan":plan.plan,"task":null})) { break; }
        for task in history::plan_task_views(&view.snapshot.data, &records, phase, plan.plan)? {
            if !started { started = selected_task.as_deref() == Some(&task.task.task); }
            if !started { continue; }
            let own: Vec<_> = records.iter().filter(|r| r.request.task == task.task).collect();
            let runs: Vec<_> = own.iter().filter_map(|r| match &r.request.event {
                history::Event::Launch(l) => Some(&l.run_id), _ => None,
            }).collect();
            let close = own.iter().find(|r| matches!(r.request.event, history::Event::Close(_))).map(|r| &r.request.request_id);
            let checkpoints = history::task_checkpoints(&records, &task.task).into_iter().map(|c| c["id"].clone()).collect::<Vec<_>>();
            let mut row = json!({"task":task.task,"state":task.state,"runs":runs,"close":close,"checkpoints":checkpoints,
                "uncertainty":runner::uncertainty(project, &records, &task)?,
                "identity":{"kind":"task-summary","phase":phase,"occurrence":task.task.occurrence,"plan":plan.plan,"task":task.task.task}});
            for key in ["runs", "checkpoints"] { trim_ids(&mut row, key, 64); }
            for key in ["progress", "unknown_runs"] { trim_ids(&mut row["state"], key, 16); }
            trim_ids(&mut row["uncertainty"], "commits", 16);
            if row.to_string().len() > 24576 {
                row["state"] = json!({"version":row["state"]["version"],"completed":row["state"]["completed"],
                    "outcome":row["state"]["outcome"],"truncated":true});
                row["uncertainty"] = json!({"truncated":true});
            }
            if !append_index(&mut answer, "tasks", row, json!({"plan":plan.plan,"task":task.task.task})) { return Ok(answer); }
        }
    }
    Ok(answer)
}

fn trim_ids(value: &mut Value, key: &str, limit: usize) {
    if let Some(ids) = value.get_mut(key).and_then(Value::as_array_mut) {
        let before = ids.len();
        ids.truncate(limit);
        while !ids.is_empty() && serde_json::to_vec(ids).expect("JSON values serialize").len() > 8192 {
            ids.pop();
        }
        let omitted = before - ids.len();
        if omitted > 0 { value[format!("{key}_omitted")] = json!(omitted); }
    }
}

fn append_index(answer: &mut Value, key: &str, row: Value, continuation: Value) -> bool {
    // Reserve space for continuation and the server's phase_status field.
    if answer.to_string().len() + row.to_string().len() + continuation.to_string().len() + 1024 > 65536 {
        answer["incomplete"] = json!(true);
        answer["continue"] = continuation;
        false
    } else {
        answer[key].as_array_mut().unwrap().push(row);
        true
    }
}
