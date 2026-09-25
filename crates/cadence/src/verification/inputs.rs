//! Observe current native authority and committed source as one checked input.
use crate::process::Process;
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
    // Serialize the same ordered object without copying retained attempts just
    // to discard their namespace. Preserve the digest byte-for-byte.
    struct Authority<'a>(&'a Value);
    impl Serialize for Authority<'_> {
        fn serialize<S: serde::Serializer>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error> {
            use serde::ser::SerializeMap;
            let Some(object) = self.0.as_object() else { return self.0.serialize(serializer); };
            let mut entries: Vec<_> = object.iter().collect();
            // serde_json's preserve_order Map::remove uses swap_remove.
            if let Some(index) = entries.iter().position(|(key, _)| *key == super::persistence::NAMESPACE) {
                entries.swap_remove(index);
            }
            let mut map = serializer.serialize_map(Some(entries.len()))?;
            for (key, value) in entries { map.serialize_entry(key, value)?; }
            map.end()
        }
    }
    Ok(digest(&serde_json::to_vec(&Authority(data))?))
}

pub fn root_binding(root: &Path) -> Result<String> {
    Ok(crate::store::filesystem::Filesystem::new(root)?.read(crate::store::model::STATE)?.directory_identity)
}

/// Observe actual tracked bytes too: Git's index flags cannot hide modified
/// files. Symlinks contribute their own text, never their destination's bytes.
pub fn source(project: &Path, process: &mut dyn Process) -> Result<Source> {
    source_accounting(project, &confirmed_summaries(project)?, process)
}

pub fn confirmed_summaries(project: &Path) -> Result<BTreeMap<String, Vec<u8>>> {
    let Some(snapshot) = plan::persistence::read_snapshot(&project.join(".planning"))? else { return Ok(BTreeMap::new()); };
    crate::execution::render::installed_summaries(&snapshot.data)
}

/// The same observation, where a tracked file whose working bytes are exactly
/// the bytes a confirmed binary-owned projection installed is read as HEAD's
/// bytes. Only the named paths with their exact bytes are accounted for; any
/// other difference is still ambiguous, and HEAD, tree and index identities
/// are observed in full (D-131).
pub fn source_accounting(project: &Path, installed: &BTreeMap<String, Vec<u8>>, process: &mut dyn Process) -> Result<Source> {
    clean_accounting(project, installed, process)?;
    let head = runner::git_text(project, &["rev-parse", "HEAD"], process)?;
    let tree = runner::git_text(project, &["rev-parse", "HEAD^{tree}"], process)?;
    let index = runner::git(project, &["ls-files", "--stage", "-z"], process)?;
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
        let committed = runner::git(project, &["show", &format!("{head}:{name}")], process)?;
        let bytes = if committed == bytes { bytes }
            else if installed.get(name).is_some_and(|expected| *expected == bytes) { committed }
            else { return Err(Error::Invalid(format!("tracked material differs from HEAD: {name}"))); };
        material.push((entry.to_owned(), name.to_owned(), digest(&bytes)));
    }
    clean_accounting(project, installed, process)?;
    if runner::git_text(project, &["rev-parse", "HEAD"], process)? != head
        || runner::git(project, &["ls-files", "--stage", "-z"], process)? != index {
        return Err(Error::Conflict("source changed during observation".into()));
    }
    Ok(Source { head, tree, index_digest: digest(&index), material_digest: digest(&serde_json::to_vec(&material)?) })
}

/// Exact installed projection bytes are accounted for whether tracked or new.
/// Staged, renamed, deleted and otherwise modified paths stay dirty.
/// What the working tree shows, beside the bytes of every differing path that
/// could be read as a regular file. A path Git named but that is missing here
/// is one the filesystem would not give up as plain bytes: a directory, a
/// symlink, a deletion, something unreadable.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct WorkingTree {
    entries: Vec<(String, String)>,
    files: BTreeMap<String, Vec<u8>>,
}

impl WorkingTree {
    pub fn new() -> Self {
        Self::default()
    }

    /// Git reported this code for this path, and the path reads back as these
    /// bytes.
    pub fn file(mut self, code: &str, path: &str, bytes: &[u8]) -> Self {
        self.entries.push((code.to_owned(), path.to_owned()));
        self.files.insert(path.to_owned(), bytes.to_vec());
        self
    }

    /// Git reported this code for this path, and the path is not a readable
    /// regular file.
    pub fn unreadable(mut self, code: &str, path: &str) -> Self {
        self.entries.push((code.to_owned(), path.to_owned()));
        self
    }
}

/// Ask Git and the filesystem what differs. Judges nothing, so it has no check
/// of its own.
pub fn observe_working_tree(project: &Path, process: &mut dyn Process) -> Result<WorkingTree> {
    let mut tree = WorkingTree::new();
    for (code, name) in runner::status(project, process)? {
        let path = project.join(&name);
        if std::fs::symlink_metadata(&path).is_ok_and(|m| m.is_file() && !m.file_type().is_symlink())
            && let Ok(bytes) = std::fs::read(&path) {
            tree.files.insert(name.clone(), bytes);
        }
        tree.entries.push((code, name));
    }
    Ok(tree)
}

/// A difference is accounted for only when the binary itself wrote it: the
/// path is one of the confirmed projections and its bytes are exactly the
/// bytes that projection installed. Anything else is source the owner has not
/// committed, and evidence cannot be observed over it.
pub fn accounted(installed: &BTreeMap<String, Vec<u8>>, tree: &WorkingTree) -> Result<()> {
    let dirty = || Error::Invalid("evidence-source-dirty: commit source before requesting an evidence run".into());
    if installed.is_empty() {
        return if tree.entries.is_empty() { Ok(()) } else { Err(dirty()) };
    }
    for (code, name) in &tree.entries {
        let accounted = matches!(code.as_str(), " M " | "?? ")
            && tree.files.get(name).is_some_and(|bytes| installed.get(name).is_some_and(|expected| bytes == expected));
        if !accounted { return Err(dirty()); }
    }
    Ok(())
}

pub fn clean_accounting(project: &Path, installed: &BTreeMap<String, Vec<u8>>, process: &mut dyn Process) -> Result<()> {
    accounted(installed, &observe_working_tree(project, process)?)
}

pub fn observe(root: &Path, data: &Value, phase: u32, process: &mut dyn Process) -> Result<Inputs> {
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
            let facts = receipts::observe_pairs(project, &events, &proof.submission, process);
            receipts::validate_pairs(data, &events, &proof.submission, &facts)?;
            receipts::validate_close_owner(data, &events, &proof.submission)?;
            receipts::reobserve_source(project, &proof.dispatch, &task.task.task, &proof.source, process)?;
        }
    }
    for record in &events {
        if record.request_digest != history::request_digest(&record.request)? {
            return Err(refuse(phase, "verification-execution", "execution.events",
                format!("task event identity mismatch: {} is not the record the log holds", record.request.request_id)));
        }
    }
    for record in &plan_events {
        if record.request_digest != history::plan_request_digest(&record.request)? {
            return Err(refuse(phase, "verification-execution", "execution.plan_events",
                format!("plan event identity mismatch: {} is not the record the log holds", record.request.request_id)));
        }
    }
    let source = source_accounting(project, &crate::execution::render::installed_summaries(data)?, process)
        .map_err(|e| refuse(phase, "verification-source", "source", e.to_string()))?;
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
pub fn reobserve_external(root: &Path, data: &Value, inputs: &Inputs, documents: &BTreeMap<String, String>, process: &mut dyn Process) -> Result<()> {
    reobserve_external_accounting(root, inputs, documents, &crate::execution::render::installed_summaries(data)?, process)
}

/// The same reobservation for a transaction that installs its own confirmed
/// projections: those exact bytes, at those paths, are not a source change.
pub fn reobserve_external_accounting(root: &Path, inputs: &Inputs, documents: &BTreeMap<String, String>,
    installed: &BTreeMap<String, Vec<u8>>,
    process: &mut dyn Process,) -> Result<()> {
    let phase = inputs.basis.phase;
    if root.parent().map(|p| p.to_string_lossy().into_owned()).as_ref() != Some(&inputs.basis.project) {
        return Err(refuse(phase, "verification-root", "basis", "bound project changed"));
    }
    if source_accounting(Path::new(&inputs.basis.project), installed, process).map_err(|e| refuse(phase, "verification-source", "source", e.to_string()))? != inputs.basis.source {
        return Err(refuse(phase, "verification-source", "source", "committed source, index or material changed"));
    }
    let observed = plan::inventory::read(root, &phase.to_string(), &json!({}))?;
    if observed.documents != *documents {
        return Err(refuse(phase, "verification-inputs", "publications", "installed plan inventory changed before confirmation"));
    }
    Ok(())
}

#[cfg(test)]
mod digest_tests {
    use super::*;

    #[test]
    fn borrowed_authority_preserves_the_existing_digest_and_key_order() {
        for text in [r#"{"verification":{},"a":1,"b":2,"c":3}"#,
            r#"{"a":1,"verification":{},"b":2,"c":3}"#,
            r#"{"a":1,"b":2,"verification":{}}"#, r#"{"a":1}"#, "null"] {
            let data: Value = serde_json::from_str(text).unwrap();
            let mut previous = data.clone();
            if let Some(object) = previous.as_object_mut() { object.remove(super::super::persistence::NAMESPACE); }
            assert_eq!(authority_digest(&data).unwrap(), digest(&serde_json::to_vec(&previous).unwrap()));
        }
    }
}
