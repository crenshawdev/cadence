//! A complete prune participant of the store's existing, sole intent journal.
use crate::process::Process;
use super::{documents, model::{self, Close, PruneRequest, Receipt, Selection}};
use crate::{rail::{branch, commit}, store::{Error, Result}};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{collections::{BTreeMap, BTreeSet}, fs::{self, File, OpenOptions}, io::{Read, Write},
    os::unix::fs::{MetadataExt, OpenOptionsExt, PermissionsExt}, path::{Component, Path}};

pub const NAMESPACE: &str = "milestone_prunes";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Entry {
    pub path: String,
    pub directory: bool,
    pub before: Vec<u8>,
    pub after: Option<Vec<u8>>,
    pub mode: u32,
    pub device: u64,
    pub inode: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Prune {
    pub id: String,
    pub root_binding: String,
    pub request: PruneRequest,
    pub selection: Selection,
    pub state: String,
    pub commit: String,
    pub entries: Vec<Entry>,
    pub git: commit::Seal,
    pub protected: Vec<String>,
    pub on_protected: String,
    pub guards: BTreeMap<String, Option<Vec<u8>>>,
    pub steps: Vec<String>,
}

/// An integration-test caller can stop the real writer at a named boundary.
/// This is an I/O failure, not a replacement filesystem or committer.
pub fn stop(point: &str) -> Result<()> {
    if cfg!(debug_assertions) && std::env::var("CADENCE_PRUNE_STOP").ok().as_deref() == Some(point) {
        return Err(Error::Io(format!("injected prune stop: {point}")));
    }
    Ok(())
}

fn fault(path: &str, error: impl std::fmt::Display) -> Error { Error::Conflict(format!("{path}: {error}")) }

fn contained(project: &Path, relative: &str) -> Result<std::path::PathBuf> {
    let path = Path::new(relative);
    if path.components().any(|c| !matches!(c,Component::Normal(_))) { return Err(fault(relative,"uncontained prune path")); }
    let full = project.join(path);
    for parent in full.ancestors().skip(1) {
        match fs::symlink_metadata(parent) {
            Ok(m) if m.is_dir() && !m.file_type().is_symlink() => {},
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {},
            _ => return Err(fault(relative,"symlink or non-directory ancestor")),
        }
    }
    Ok(full)
}

fn observe(project: &Path, path: &str) -> Result<Entry> {
    let full = contained(project,path)?;
    let metadata = fs::symlink_metadata(&full).map_err(|e| fault(path,e))?;
    if metadata.file_type().is_symlink() || !(metadata.is_file() || metadata.is_dir()) { return Err(fault(path,"not a contained regular file or directory")); }
    let mut before = Vec::new();
    if metadata.is_file() {
        let mut file = OpenOptions::new().read(true).custom_flags(libc::O_NOFOLLOW).open(&full).map_err(|e| fault(path,e))?;
        let opened = file.metadata()?;
        if opened.dev()!=metadata.dev() || opened.ino()!=metadata.ino() { return Err(fault(path,"input replaced during read")); }
        file.read_to_end(&mut before).map_err(|e| fault(path,e))?;
    } else { fs::read_dir(&full).map_err(|e| fault(path,e))?; }
    Ok(Entry {path:path.into(),directory:metadata.is_dir(),before,after:None,mode:metadata.mode(),device:metadata.dev(),inode:metadata.ino()})
}

fn collect(project: &Path, path: &str, entries: &mut Vec<Entry>) -> Result<()> {
    let entry = observe(project,path)?;
    if entry.directory {
        let mut children = fs::read_dir(project.join(path)).map_err(|e| fault(path,e))?.collect::<std::io::Result<Vec<_>>>()?;
        children.sort_by_key(|e| e.file_name());
        for child in children {
            let name = child.file_name().into_string().map_err(|_| fault(path,"undecodable pathname"))?;
            collect(project,&format!("{path}/{name}"),entries)?;
        }
    }
    entries.push(entry);
    Ok(())
}

pub fn require_close(data: &Value, binding: &str, request: &PruneRequest) -> Result<Close> {
    model::name(&request.request_id)?;
    request.selection.validate()?;
    let records = model::records::<Close>(data,"milestones")?;
    let close = records.records.get(&request.close).ok_or_else(|| fault(&request.close,"ready close does not exist"))?;
    if close.id != request.close || close.root_binding != binding || close.generation != request.expected_generation
        || close.selection != request.selection || close.id != model::identity("milestone",binding,&close.occurrence) {
        return Err(fault(&request.close,"ready close identity, generation or selection differs"));
    }
    Ok(close.clone())
}

pub fn freeze(root: &Path, data: &Value, binding: &str, request: PruneRequest, protected: Vec<String>, on_protected: String, process: &mut dyn Process) -> Result<Prune> {
    require_close(data,binding,&request)?;
    let project = root.parent().ok_or_else(|| Error::Invalid("planning root lacks project".into()))?;
    // Required documents are opened before any transaction or destructive write.
    let mut roadmap = observe(project,".planning/ROADMAP.md")?;
    let mut requirements = observe(project,".planning/REQUIREMENTS.md")?;
    let phases: BTreeSet<_> = request.selection.phases.iter().map(|p| p.get()).collect();
    roadmap.after = Some(documents::roadmap(std::str::from_utf8(&roadmap.before).map_err(|e| fault(&roadmap.path,e))?,&phases)?.into_bytes());
    requirements.after = Some(documents::requirements(std::str::from_utf8(&requirements.before).map_err(|e| fault(&requirements.path,e))?,&phases)?.into_bytes());
    let mut entries = Vec::new();
    for p in &phases {
        let dir = format!(".planning/phases/{p}");
        for name in ["SUMMARY.md","UAT.md"] {
            let _ = observe(project,&format!("{dir}/{name}"))?;
        }
        collect(project,&dir,&mut entries)?;
    }
    entries.extend([roadmap,requirements]);
    let changes = entries.iter().filter(|e| !e.directory).map(|e| (e.path.clone(),e.after.clone())).collect();
    let reference = String::from_utf8(crate::rail::git::run(project,["symbolic-ref","--short","HEAD"], process)?).map_err(|e| Error::Invalid(e.to_string()))?;
    if branch::permission(&protected,&on_protected,reference.trim())? != branch::Permission::Pass {
        return Err(Error::Policy(format!("prune commit requires branch permission: {}",reference.trim())));
    }
    let git = commit::freeze(project,&changes,&phases.into_iter().collect::<Vec<_>>(), process)?;
    let mut guards = BTreeMap::new();
    for path in [root.join("config.json"),root.join("config.v4.json")].into_iter().chain(
        std::env::var_os("CADENCE_GLOBAL_CONFIG").filter(|s| !s.is_empty()).map(std::path::PathBuf::from)) {
        let bytes = match fs::read(&path) { Ok(bytes)=>Some(bytes),Err(e) if e.kind()==std::io::ErrorKind::NotFound=>None,Err(e)=>return Err(e.into()) };
        guards.insert(path.to_string_lossy().into_owned(),bytes);
    }
    let steps = entries.iter().map(|e| format!("{}:{}",if e.after.is_some(){"replace"}else{"delete"},e.path))
        .chain(["objects","commit","ref","index","record"].map(str::to_owned)).collect();
    Ok(Prune {id:model::identity("prune",binding,&request.request_id),root_binding:binding.into(),selection:request.selection.clone(),
        request,state:"committed".into(),commit:git.commit.id.clone(),entries,git,protected,on_protected,guards,steps})
}

pub fn contribute(data: &Value, prune: &Prune) -> Result<Value> {
    require_close(data,&prune.root_binding,&prune.request)?;
    if prune.selection != prune.request.selection || prune.state != "committed" || prune.commit != prune.git.commit.id
        || prune.id != model::identity("prune",&prune.root_binding,&prune.request.request_id) {
        return Err(Error::Invalid("prune seal identity differs".into()));
    }
    let mut records = model::records::<Prune>(data,NAMESPACE)?;
    if model::reused(&records,&prune.root_binding,&prune.request.request_id) || records.records.values().any(|p| p.request.close == prune.request.close) {
        return Err(Error::Conflict("ready close already has an identified prune".into()));
    }
    let request = serde_json::to_value(&prune.request)?;
    let receipt = Receipt {root_binding:prune.root_binding.clone(),request_id:prune.request.request_id.clone(),request:request.clone(),answer:answer(prune)};
    records.receipts.insert(model::request_key(&prune.root_binding,&request)?,receipt);
    records.records.insert(prune.id.clone(),prune.clone());
    let mut next = data.clone();
    next.as_object_mut().ok_or_else(|| Error::Invalid("store data is not an object".into()))?.insert(NAMESPACE.into(),serde_json::to_value(records)?);
    Ok(next)
}

pub fn answer(prune: &Prune) -> Value {
    json!({"status":"ok","prune":{"id":prune.id,"close":prune.request.close,"generation":prune.request.expected_generation,
        "selection":prune.selection,"state":prune.state,"commit":prune.commit,"parent":prune.git.parent,"tree":prune.git.tree,
        "steps":prune.steps},"next":"land-read"})
}

pub fn validate(root: &Path, prune: &Prune, replay: bool, process: &mut dyn Process) -> Result<()> {
    use crate::store::Storage;
    if crate::store::filesystem::Filesystem::new(root)?.read(crate::store::model::STATE)?.directory_identity != prune.root_binding {
        return Err(Error::Conflict("prune store root changed".into()));
    }
    let project = root.parent().ok_or_else(|| Error::Invalid("planning root lacks project".into()))?;
    for (path,expected) in &prune.guards {
        let actual = match fs::read(path) {Ok(b)=>Some(b),Err(e) if e.kind()==std::io::ErrorKind::NotFound=>None,Err(e)=>return Err(fault(path,e))};
        if actual != *expected { return Err(fault(path,"prune commit policy input changed")); }
    }
    commit::validate(project,&prune.git,replay, process)?;
    for entry in &prune.entries {
        let phase_path = prune.selection.phases.iter().any(|p| entry.path == format!(".planning/phases/{p}") || entry.path.starts_with(&format!(".planning/phases/{p}/")));
        if !(phase_path && entry.after.is_none() || !entry.directory && entry.after.is_some() && matches!(entry.path.as_str(),".planning/ROADMAP.md"|".planning/REQUIREMENTS.md")) {
            return Err(fault(&entry.path,"path is outside sealed selection"));
        }
        let path = contained(project,&entry.path)?;
        match fs::symlink_metadata(&path) {
            Err(e) if e.kind()==std::io::ErrorKind::NotFound && replay && entry.after.is_none() => continue,
            Err(e) => return Err(fault(&entry.path,e)),
            Ok(_) => {},
        }
        let actual = observe(project,&entry.path)?;
        if entry.directory {
            if !actual.directory || actual.device!=entry.device || actual.inode!=entry.inode || actual.mode!=entry.mode { return Err(fault(&entry.path,"prune directory identity changed")); }
            for child in fs::read_dir(path)? {
                let name = format!("{}/{}",entry.path,child?.file_name().to_string_lossy());
                if !prune.entries.iter().any(|e| e.path==name) { return Err(fault(&name,"unmanifested prune child")); }
            }
        } else if actual.directory || actual.mode!=entry.mode || !(actual.before==entry.before && actual.device==entry.device && actual.inode==entry.inode
            || replay && entry.after.as_ref()==Some(&actual.before)) {
            return Err(fault(&entry.path,"prune preimage or installed bytes changed"));
        }
    }
    Ok(())
}

pub fn install(root: &Path, prune: &Prune, process: &mut dyn Process) -> Result<()> {
    let project = root.parent().ok_or_else(|| Error::Invalid("planning root lacks project".into()))?;
    for entry in &prune.entries {
        validate(root,prune,true, process)?;
        let operation = if entry.after.is_some(){"replace"}else{"delete"};
        stop(&format!("{operation}:{}:before",entry.path))?;
        let path = contained(project,&entry.path)?;
        if let Some(bytes) = &entry.after {
            if fs::read(&path)? != *bytes {
                let temporary = path.with_file_name(format!(".{}.{}.prune.tmp",path.file_name().unwrap().to_string_lossy(),std::process::id()));
                let mut file = OpenOptions::new().write(true).create_new(true).open(&temporary)?;
                let result = (|| {
                    file.write_all(bytes)?;
                    file.set_permissions(fs::Permissions::from_mode(entry.mode & 0o7777))?;
                    file.sync_all()?;
                    validate(root,prune,true, process)?;
                    fs::rename(&temporary,&path)?;
                    Ok::<_,Error>(())
                })();
                let _ = fs::remove_file(temporary);
                result?;
            }
        } else if path.exists() {
            if entry.directory { fs::remove_dir(&path).map_err(|e| fault(&entry.path,e))?; }
            else { fs::remove_file(&path).map_err(|e| fault(&entry.path,e))?; }
        }
        // If recovery already removed a parent, its nearest surviving ancestor
        // is the durable directory boundary for the already-installed absence.
        let parent = path.ancestors().skip(1).find(|p| p.exists()).ok_or_else(|| fault(&entry.path,"missing ancestor"))?;
        File::open(parent)?.sync_all()?;
        stop(&format!("{operation}:{}:after",entry.path))?;
    }
    commit::install(project,&prune.git,&mut |process: &mut dyn Process| validate(root,prune,true,process), process)?;
    validate(root,prune,true, process)
}
