//! Observe current native authority and committed source as one checked input.
use super::model::{Basis, Source, TruthVersion};
use crate::{execution::{admission, history, receipts, runner}, plan, store::{Error, Result, Storage, model::digest}};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{collections::BTreeMap, path::Path};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Inputs {
    pub basis: Basis,
    pub map: Value,
    pub admissions: Vec<admission::Record>,
    pub execution: Value,
    pub checks: Vec<Value>,
    pub authority_digest: String,
}

pub fn refuse(phase: u32, rule: &str, slot: &str, reason: impl Into<String>) -> Error {
    admission::refuse(phase, rule, slot, "", reason)
}

pub fn authority_digest(data: &Value) -> Result<String> {
    let mut data = data.clone();
    if let Some(object) = data.as_object_mut() { object.remove(super::persistence::NAMESPACE); }
    Ok(digest(&serde_json::to_vec(&data)?))
}

pub fn root_binding(root: &Path) -> Result<String> {
    Ok(crate::store::filesystem::Filesystem::new(root)?.read(crate::store::model::STATE)?.directory_identity)
}

/// Observe actual tracked bytes too: Git's index flags cannot hide modified
/// files. Symlinks contribute their own text, never their destination's bytes.
pub fn source(project: &Path) -> Result<Source> {
    source_accounting(project, &BTreeMap::new())
}

/// The same observation, where a tracked file whose working bytes are exactly
/// the bytes a confirmed binary-owned projection installed is read as HEAD's
/// bytes. Only the named paths with their exact bytes are accounted for; any
/// other difference is still ambiguous, and HEAD, tree and index identities
/// are observed in full (D-131).
pub fn source_accounting(project: &Path, installed: &BTreeMap<String, Vec<u8>>) -> Result<Source> {
    clean_accounting(project, installed)?;
    let head = runner::git_text(project, &["rev-parse", "HEAD"])?;
    let tree = runner::git_text(project, &["rev-parse", "HEAD^{tree}"])?;
    let index = runner::git(project, &["ls-files", "--stage", "-z"])?;
    let mut material = Vec::new();
    for row in index.split(|b| *b == 0).filter(|r| !r.is_empty()) {
        let row = std::str::from_utf8(row).map_err(|_| Error::Invalid("unrepresentable index path".into()))?;
        let (entry, name) = row.split_once('\t').ok_or_else(|| Error::Invalid("invalid index entry".into()))?;
        if !entry.ends_with(" 0") || !crate::execution::patch::safe_relative_path(name) {
            return Err(Error::Invalid("unmerged or unsafe index path".into()));
        }
        let path = project.join(name);
        let metadata = std::fs::symlink_metadata(&path)?;
        let bytes = if metadata.file_type().is_symlink() {
            std::fs::read_link(path)?.as_os_str().as_encoded_bytes().to_vec()
        } else if metadata.is_file() { std::fs::read(path)? }
        else { return Err(Error::Invalid(format!("ambiguous source material: {name}"))); };
        let committed = runner::git(project, &["show", &format!("{head}:{name}")])?;
        let bytes = if committed == bytes { bytes }
            else if installed.get(name).is_some_and(|expected| *expected == bytes) { committed }
            else { return Err(Error::Invalid(format!("tracked material differs from HEAD: {name}"))); };
        material.push((entry.to_owned(), name.to_owned(), digest(&bytes)));
    }
    clean_accounting(project, installed)?;
    if runner::git_text(project, &["rev-parse", "HEAD"])? != head
        || runner::git(project, &["ls-files", "--stage", "-z"])? != index {
        return Err(Error::Conflict("source changed during observation".into()));
    }
    Ok(Source { head, tree, index_digest: digest(&index), material_digest: digest(&serde_json::to_vec(&material)?) })
}

/// A clean tree, except that a tracked file modified in the working tree to
/// exactly the installed projection bytes is accounted for. Untracked, staged,
/// renamed, deleted and otherwise modified paths stay dirty.
fn clean_accounting(project: &Path, installed: &BTreeMap<String, Vec<u8>>) -> Result<()> {
    if installed.is_empty() { return runner::clean(project); }
    for (code, name) in runner::status(project)? {
        let accounted = code == " M " && installed.get(&name).is_some_and(|expected| std::fs::read(project.join(&name)).is_ok_and(|bytes| bytes == *expected));
        if !accounted {
            return Err(Error::Invalid("evidence-source-dirty: commit source before requesting an evidence run".into()));
        }
    }
    Ok(())
}

pub fn observe(root: &Path, data: &Value, phase: u32) -> Result<Inputs> {
    let project = root.parent().ok_or_else(|| refuse(phase, "verification-root", "project", "project root required"))?;
    let context = crate::context::persistence::saved(data, phase)?
        .ok_or_else(|| refuse(phase, "native-approved-truths", "context", "native approved truths required"))?;
    let admissions = admission::records(data, phase)?;
    let latest = admissions.last().ok_or_else(|| refuse(phase, "admission-required", "admissions", "complete native admission required"))?;
    let inventory = plan::inventory::read(root, &phase.to_string(), data)?;
    admission::validate(data, &inventory.documents, &latest.request.contract)?;
    let binding = root_binding(root)?;
    if admissions.iter().any(|a| admission::request_digest(&a.request).ok().as_ref() != Some(&a.request_digest)) {
        return Err(refuse(phase, "verification-admission", "admissions", "admission identity differs from its request"));
    }
    let events = history::records(data, phase)?;
    let plan_events = history::plan_records(data, phase)?;
    let outcomes = history::plan_outcomes(data, phase)?;
    if data["execution"]["occurrences"][phase.to_string()]["active"].is_object() {
        return Err(refuse(phase, "verification-execution", "execution.active", "execution dispatch remains active"));
    }
    if !history::phase_complete(data, phase)? {
        return Err(refuse(phase, "verification-execution", "execution.plans",
            "admitted plans are not complete or repaired by a later completed plan"));
    }
    for (identity, _) in history::admitted_plans(data, phase)? {
        for task in history::plan_task_views(data, &events, phase, identity.plan)? {
            if !task.state.completed { continue }
            if !task.state.unknown_runs.is_empty() {
                return Err(refuse(phase, "verification-execution", "execution.tasks",
                    format!("task {} has unanswered launches", task.task.task)));
            }
            let proof = events.iter().find_map(|r| match &r.request.event {
                history::Event::Close(proof) if r.request.task == task.task => Some(proof), _ => None,
            }).ok_or_else(|| refuse(phase, "verification-execution", "execution.tasks", "close proof absent"))?;
            receipts::validate_pairs(data, &events, &proof.submission, project)?;
            receipts::validate_close_owner(data, &events, &proof.submission)?;
            receipts::reobserve_source(project, &proof.dispatch, &task.task.task, &proof.source)?;
        }
    }
    for record in &events {
        if record.request_digest != history::request_digest(&record.request)? {
            return Err(refuse(phase, "verification-execution", "execution.events", "task event identity mismatch"));
        }
    }
    for record in &plan_events {
        if record.request_digest != history::plan_request_digest(&record.request)? {
            return Err(refuse(phase, "verification-execution", "execution.plan_events", "plan event identity mismatch"));
        }
    }
    let source = source(project).map_err(|e| refuse(phase, "verification-source", "source", e.to_string()))?;
    let map = serde_json::to_value(plan::map_view::read(root, phase)?)?;
    if map["coherence"] != "consistent" {
        return Err(refuse(phase, "verification-map", "map", "complete coherent evidence map required"));
    }
    let observed = plan::persistence::read_snapshot(root)?.ok_or_else(|| refuse(phase, "verification-inputs", "snapshot", "native snapshot absent"))?;
    if authority_digest(&observed.data)? != authority_digest(data)? {
        return Err(refuse(phase, "verification-inputs", "snapshot", "authority changed while observing map"));
    }
    let checks = map["items"].as_array().ok_or_else(|| refuse(phase, "verification-map", "items", "canonical items absent"))?
        .iter().filter(|i| i["kind"] == "check").cloned().collect();
    let execution = json!({"events":events,"plan_events":plan_events,"outcomes":outcomes});
    let basis = Basis { project: project.to_string_lossy().into_owned(), root_binding: binding,
        phase, occurrence: latest.request.contract.occurrence.clone(),
        context_digest: digest(&serde_json::to_vec(&context)?),
        truths: context.truths.iter().map(|t| TruthVersion { id: t.id.clone(), version: t.version }).collect(),
        publications: latest.request.contract.plans.clone(),
        map_digest: map["input_digest"].as_str().ok_or_else(|| refuse(phase, "verification-map", "input_digest", "map digest absent"))?.into(),
        admission_digests: admissions.iter().map(|a| a.request_digest.clone()).collect(),
        execution_digest: digest(&serde_json::to_vec(&execution)?), source };
    Ok(Inputs { basis, map, admissions, execution, checks, authority_digest: authority_digest(data)? })
}

/// Transaction replay checks the captured authority against its preimage, and
/// reobserves external material without asking readback to ignore a live intent.
pub fn reobserve_external(root: &Path, inputs: &Inputs, documents: &BTreeMap<String, String>) -> Result<()> {
    reobserve_external_accounting(root, inputs, documents, &BTreeMap::new())
}

/// The same reobservation for a transaction that installs its own confirmed
/// projections: those exact bytes, at those paths, are not a source change.
pub fn reobserve_external_accounting(root: &Path, inputs: &Inputs, documents: &BTreeMap<String, String>,
    installed: &BTreeMap<String, Vec<u8>>) -> Result<()> {
    let phase = inputs.basis.phase;
    if root.parent().map(|p| p.to_string_lossy().into_owned()).as_ref() != Some(&inputs.basis.project) {
        return Err(refuse(phase, "verification-root", "basis", "bound project changed"));
    }
    if source_accounting(Path::new(&inputs.basis.project), installed).map_err(|e| refuse(phase, "verification-source", "source", e.to_string()))? != inputs.basis.source {
        return Err(refuse(phase, "verification-source", "source", "committed source, index or material changed"));
    }
    let observed = plan::inventory::read(root, &phase.to_string(), &json!({}))?;
    if observed.documents != *documents {
        return Err(refuse(phase, "verification-inputs", "publications", "installed plan inventory changed before confirmation"));
    }
    Ok(())
}
