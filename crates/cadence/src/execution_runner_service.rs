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

pub async fn read<I: ConfigIo + Clone + Sync>(factory: &SessionFactory<I>, root: &Path, phase: u32) -> Result<Value> {
    let session = factory.first_touch(root).await?;
    let view = session.derivation_view().await?;
    let records = history::records(&view.snapshot.data, phase)?;
    let admissions = cadence::execution::admission::records(&view.snapshot.data, phase)?;
    let mut tasks = Vec::new();
    for basis in &admissions {
        for assignment in &basis.request.contract.allocation {
            if tasks.iter().any(|value: &Value| value["task"]["plan"] == assignment.plan && value["task"]["task"] == assignment.task) { continue }
            let task = history::Task { phase, occurrence: basis.request.contract.occurrence.clone(), admission_digest: basis.request_digest.clone(),
                plan: assignment.plan, task: assignment.task.clone() };
            tasks.push(json!({"task":task,"state":history::project(&records,&task)}));
        }
    }
    Ok(json!({"status":"ok","schema":"native-task-history-1","events":records,"tasks":tasks}))
}
