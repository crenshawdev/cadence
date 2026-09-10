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
            let state=history::project(&records,&task);
            let baseline=records.iter().rev().filter(|r|r.request.task==task).find_map(|r|match &r.request.event {
                history::Event::AcknowledgedProgress {commit,..}=>Some(commit.clone()),
                history::Event::Attempt {base_commit,..}=>Some(base_commit.clone()),
                _=>None,
            });
            let mut commits=Vec::new();
            if !state.completed && let Some(baseline)=baseline {
                let project=root.parent().ok_or_else(||Error::Invalid("project root missing".into()))?;
                commits=runner::git_text(project,&["rev-list","--reverse",&format!("{baseline}..HEAD")])?.lines().map(str::to_owned).collect();
            }
            let mut uncertainty=json!({"requires_reconciliation":!commits.is_empty(),"commits":commits});
            if !state.completed && state.attempt.is_some()
                && !runner::git(root.parent().ok_or_else(||Error::Invalid("project root missing".into()))?,&["status","--porcelain=v1","-z","--untracked-files=all"])?.is_empty() {
                uncertainty["requires_reconciliation"]=json!(true);
                uncertainty["dirty_source"]=json!(true);
            }
            tasks.push(json!({"task":task,"state":state,"uncertainty":uncertainty}));
        }
    }
    let mut checkpoints=Vec::new();
    for decision in &view.decisions {
        if let Some(record)=cadence::evidence::persistence::decode_history(decision)?
            && record.scope.phase==phase.to_string() && record.scope.planning_root==root.to_string_lossy() {
            checkpoints.push(record);
        }
    }
    Ok(json!({"status":"ok","schema":"native-task-history-1","events":records,"tasks":tasks,"checkpoint_history":checkpoints}))
}
