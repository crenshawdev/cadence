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
    let result = match input {
        runner::PlanApply::Suite { request } => runner::suite_launch(session.review_store().clone(), project.to_path_buf(), request).await,
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
        Ok(receipt) => json!({"status":"ok","receipt":receipt}),
        Err(error) => super::execution_service::native_error(error),
    })
}

pub async fn read<I: ConfigIo + Clone + Sync>(factory: &SessionFactory<I>, root: &Path, phase: u32) -> Result<Value> {
    let session = factory.first_touch(root).await?;
    let view = session.derivation_view().await?;
    let records = history::records(&view.snapshot.data, phase)?;
    let project = root.parent().ok_or_else(|| Error::Invalid("project root missing".into()))?;
    let mut tasks = Vec::new();
    for basis in &cadence::execution::admission::records(&view.snapshot.data, phase)? {
        for binding in &basis.request.contract.plans {
            if tasks.iter().any(|value: &Value| value["task"]["plan"] == binding.plan) { continue }
            for task in history::plan_task_views(&view.snapshot.data, &records, phase, binding.plan)? {
                let uncertainty = runner::uncertainty(project, &records, &task)?;
                tasks.push(json!({"task":task.task,"state":task.state,"uncertainty":uncertainty}));
            }
        }
    }
    let mut checkpoints=Vec::new();
    for decision in &view.decisions {
        if let Some(record)=cadence::evidence::persistence::decode_history(decision)?
            && record.scope.phase==phase.to_string() && record.scope.planning_root==root.to_string_lossy() {
            checkpoints.push(record);
        }
    }
    let plan_events = history::plan_records(&view.snapshot.data, phase)?;
    let plans = history::admitted_plans(&view.snapshot.data, phase)?.into_iter()
        .map(|(plan, _)| json!({"state":history::plan_project(&plan_events, &plan),"plan":plan})).collect::<Vec<_>>();
    Ok(json!({"status":"ok","schema":"native-task-history-1","events":records,"tasks":tasks,"checkpoint_history":checkpoints,
        "plan_events":plan_events,"plans":plans}))
}
