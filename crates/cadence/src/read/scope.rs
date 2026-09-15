use super::{ReadDomain, search::files, source};
use serde_json::Value;
use std::path::PathBuf;

fn refusal(slot: &str, code: &str, reason: impl Into<String>) -> Value {
    serde_json::json!({"status":"refused","code":code,"rule":"D-147","slot":slot,"reason":reason.into()})
}

pub(super) fn task_lease_files(
    domain: &ReadDomain,
    phase: u32,
    occurrence: &str,
    plan: u32,
    task: &str,
) -> Result<Vec<PathBuf>, Value> {
    let data = cadence::context::persistence::read_snapshot(&domain.planning_root)
        .map_err(|error| refusal("scope", "scope-unavailable", error.to_string()))?
        .map(|snapshot| snapshot.data)
        .ok_or_else(|| refusal("scope", "scope-not-found", "native execution authority is absent"))?;
    let publication = cadence::plan::persistence::saved(&data, phase)
        .map_err(|error| refusal("scope", "scope-unavailable", error.to_string()))?
        .filter(|saved| saved.id == occurrence)
        .and_then(|saved| saved.publications.get(&plan).cloned())
        .ok_or_else(|| refusal("scope", "scope-not-found", "task lease identity is not admitted"))?;
    let execution: cadence::execution::model::ExecutionSnapshot = serde_json::from_value(data["execution"].clone())
        .map_err(|error| refusal("scope", "scope-unavailable", error.to_string()))?;
    let active = execution
        .occurrences
        .get(&phase.to_string())
        .and_then(|entry| entry.active.as_ref())
        .filter(|active| active.plan == plan && active.tasks.iter().any(|candidate| candidate.id == task))
        .ok_or_else(|| refusal("scope", "scope-not-current", "task lease is not in the active dispatch"))?;
    let records = cadence::execution::history::records(&data, phase)
        .map_err(|error| refusal("scope", "scope-unavailable", error.to_string()))?;
    let current = records
        .iter()
        .find(|record| {
            let identity = &record.request.task;
            identity.phase == phase
                && identity.occurrence == occurrence
                && identity.plan == plan
                && identity.task == task
        })
        .map(|record| record.request.task.clone())
        .ok_or_else(|| refusal("scope", "scope-not-current", "task lease has not been started"))?;
    if cadence::execution::history::project(&records, &current).completed {
        return Err(refusal("scope", "scope-not-current", "task lease is already completed"));
    }
    let mut published_files = publication.content.files.clone();
    published_files.extend(
        cadence::execution::render::RENDERED_PROJECT_FILES
            .iter()
            .map(|rendered| rendered.path.to_owned())
            .filter(|path| !publication.content.files.contains(path)),
    );
    if active.files != published_files || active.directories != publication.content.directories {
        return Err(refusal("scope", "scope-unavailable", "active lease differs from retained publication"));
    }
    let mut paths = Vec::new();
    for relative in &active.files {
        let candidate = domain.project.join(relative);
        let Some(path) = source::confined(&domain.project, &candidate) else { continue };
        if path.starts_with(&domain.planning_root) || !path.is_file() {
            continue;
        }
        paths.push(path);
    }
    for relative in &active.directories {
        let candidate = domain.project.join(relative);
        let Some(root) = source::confined(&domain.project, &candidate) else { continue };
        paths.extend(files(&root, &domain.project, None));
    }
    paths.sort();
    paths.dedup();
    Ok(paths)
}
