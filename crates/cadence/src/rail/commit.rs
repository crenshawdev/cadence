//! A sealed single-parent commit and index CAS, installed by the store writer.
use crate::process::{Launch, Process};
use crate::store::{Error, Result};
use super::git;
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, fs, io::Write, path::{Path, PathBuf}};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Object { pub kind: String, pub id: String, pub bytes: Vec<u8> }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Seal {
    pub parent: String,
    pub reference: String,
    pub tree: String,
    pub commit: Object,
    pub objects: Vec<Object>,
    pub index_path: PathBuf,
    pub index_before: Vec<u8>,
    pub index_after: Vec<u8>,
}

fn input(root: &Path, args: &[&str], bytes: &[u8], index: Option<&Path>, process: &mut dyn Process) -> Result<Vec<u8>> {
    let mut launch = crate::git_process::launch(crate::git_process::Caller::RailCommitInput).cwd(root).args(args).stdin(bytes);
    if let Some(index) = index { launch = launch.env("GIT_INDEX_FILE", index); }
    let output = crate::git_process::run(&launch, process)?;
    if !output.success() { return Err(Error::Io(format!("git {args:?}: {}", String::from_utf8_lossy(&output.stderr)))); }
    Ok(output.stdout)
}
fn text(root: &Path, args: &[&str], process: &mut dyn Process) -> Result<String> {
    String::from_utf8(git::run(root, args, process)?).map(|s| s.trim_end().to_owned()).map_err(|e| Error::Invalid(e.to_string()))
}
fn object(root: &Path, kind: &str, bytes: Vec<u8>, process: &mut dyn Process) -> Result<Object> {
    let id = git::object_id(input(root, &["hash-object", "-t", kind, "--stdin"], &bytes, None, process)?)?;
    Ok(Object { kind: kind.into(), id, bytes })
}
fn optional_config(root: &Path, key: &str, process: &mut dyn Process) -> Result<Option<String>> {
    let output = crate::git_process::run(&crate::git_process::launch(crate::git_process::Caller::RailConfig).cwd(root).args(["config", "--get", key]), process)?;
    match output.code() {
        Some(0) => Ok(Some(String::from_utf8_lossy(&output.stdout).trim_end().into())),
        Some(1) => Ok(None),
        _ => Err(Error::Policy(format!("cannot read git config {key}"))),
    }
}
fn sign(root: &Path, bytes: Vec<u8>, process: &mut dyn Process) -> Result<Vec<u8>> {
    if !matches!(optional_config(root, "commit.gpgsign", process)?.as_deref(), Some("true" | "yes" | "1" | "on")) { return Ok(bytes); }
    if optional_config(root, "gpg.format", process)?.is_some_and(|f| f != "openpgp") {
        return Err(Error::Policy("prune committer requires OpenPGP signing".into()));
    }
    let program = optional_config(root, "gpg.program", process)?.unwrap_or_else(|| "gpg".into());
    let key = optional_config(root, "user.signingkey", process)?.ok_or_else(|| Error::Policy("prune signing needs user.signingkey".into()))?;
    let output = process.run(
        &Launch::new(program).cwd(root).args(["--status-fd=2", "-bsau", &key]).stdin(bytes.clone()),
    )?;
    if !output.success() { return Err(Error::Policy(format!("prune signing failed: {}", String::from_utf8_lossy(&output.stderr)))); }
    let signature = String::from_utf8(output.stdout).map_err(|e| Error::Invalid(e.to_string()))?;
    let source = String::from_utf8(bytes).map_err(|e| Error::Invalid(e.to_string()))?;
    let (headers, message) = source.split_once("\n\n").ok_or_else(|| Error::Invalid("invalid commit bytes".into()))?;
    Ok(format!("{headers}\ngpgsig {}\n\n{message}", signature.trim_end().replace('\n', "\n ")).into_bytes())
}

// Git's tree order treats a directory as if its name ended with '/'.
fn tree(root: &Path, entries: &BTreeMap<String, (String,String)>, prefix: &str, objects: &mut Vec<Object>, process: &mut dyn Process) -> Result<String> {
    let mut children = BTreeMap::new();
    for (path,(mode,id)) in entries {
        let Some(rest) = path.strip_prefix(prefix) else { continue; };
        if let Some((dir,_)) = rest.split_once('/') { children.insert(format!("{dir}/"), None); }
        else { children.insert(rest.into(), Some((mode.clone(),id.clone()))); }
    }
    let mut bytes = Vec::new();
    for (name,entry) in children {
        let (name,mode,id) = if let Some((mode,id)) = entry { (name,mode,id) }
        else {
            let id = tree(root, entries, &format!("{prefix}{name}"), objects, process)?;
            (name.trim_end_matches('/').to_owned(),"40000".into(),id)
        };
        bytes.extend_from_slice(format!("{mode} {name}\0").as_bytes());
        for pair in id.as_bytes().as_chunks::<2>().0 {
            bytes.push(u8::from_str_radix(std::str::from_utf8(pair).unwrap(),16).map_err(|e| Error::Invalid(e.to_string()))?);
        }
    }
    let object = object(root,"tree",bytes, process)?;
    let id = object.id.clone();
    objects.push(object);
    Ok(id)
}

struct Temporary(PathBuf);
impl Drop for Temporary { fn drop(&mut self) { let _ = fs::remove_file(&self.0); } }

pub fn freeze(root: &Path, changes: &BTreeMap<String, Option<Vec<u8>>>, phases: &[u32], process: &mut dyn Process) -> Result<Seal> {
    freeze_message(root, changes, phases, &format!("chore: prune milestone phases {}\n\nRetain completed phase evidence in the single parent tree.\n", phases.iter().map(u32::to_string).collect::<Vec<_>>().join(", ")), process)
}

/// Read `ls-tree -r -z --full-tree` into path, mode and object id. Git's NUL
/// protocol keeps pathnames intact; a row that does not carry a mode, a type
/// and an object id before its tab is not a tree entry and is refused rather
/// than read past.
pub fn parse_tree(output: &[u8]) -> Result<BTreeMap<String, (String, String)>> {
    let mut entries = BTreeMap::new();
    for record in output.split(|b| *b == 0).filter(|b| !b.is_empty()) {
        let record = std::str::from_utf8(record).map_err(|_| Error::Invalid("undecodable Git pathname".into()))?;
        let (header,path) = record.split_once('\t').ok_or_else(|| Error::Invalid("invalid Git tree row".into()))?;
        let fields: Vec<_> = header.split(' ').collect();
        if fields.len()!=3 { return Err(Error::Invalid("invalid Git tree entry".into())); }
        entries.insert(path.to_owned(),(fields[0].to_owned(),fields[2].to_owned()));
    }
    Ok(entries)
}

pub fn freeze_message(root: &Path, changes: &BTreeMap<String, Option<Vec<u8>>>, phases: &[u32], message: &str, process: &mut dyn Process) -> Result<Seal> {
    let parent = git::resolve_commit(root,"HEAD", process)?;
    let reference = text(root,&["symbolic-ref","-q","HEAD"], process)?;
    if !reference.starts_with("refs/heads/") { return Err(Error::Policy("prune needs a branch ref".into())); }
    let mut entries = parse_tree(&git::run(root,["ls-tree","-r","-z","--full-tree",&parent], process)?)?;
    for path in entries.keys() {
        if phases.iter().any(|p| path.starts_with(&format!(".planning/phases/{p}/"))) && !changes.contains_key(path) {
            return Err(Error::Conflict(format!("tracked prune input is missing: {path}")));
        }
    }
    let mut objects = Vec::new();
    let mut index_input = Vec::new();
    for (path,after) in changes {
        let (mode,_) = entries.get(path).ok_or_else(|| Error::Invalid(format!("prune input lacks Git history: {path}")))?.clone();
        if !matches!(mode.as_str(),"100644"|"100755") { return Err(Error::Invalid(format!("prune input is not a tracked regular file: {path}"))); }
        if git::run(root,["show",&format!("{parent}:{path}")], process)? != fs::read(root.join(path)).map_err(|e| Error::Io(format!("{path}: {e}")))? {
            return Err(Error::Conflict(format!("prune worktree differs from parent: {path}")));
        }
        let diff = git::run(root,["diff","--cached","--name-only","--no-ext-diff",&parent,"--",&format!(":(literal){path}")], process)?;
        if !diff.is_empty() { return Err(Error::Conflict(format!("prune index differs from parent: {path}"))); }
        if let Some(bytes) = after {
            let blob = object(root,"blob",bytes.clone(), process)?;
            index_input.extend_from_slice(format!("{mode} {}\t{path}\0",blob.id).as_bytes());
            entries.insert(path.clone(),(mode,blob.id.clone()));
            objects.push(blob);
        } else {
            entries.remove(path);
            index_input.extend_from_slice(format!("0 {}\t{path}\0", "0".repeat(parent.len())).as_bytes());
        }
    }
    let tree = tree(root,&entries,"",&mut objects, process)?;
    let author = text(root,&["var","GIT_AUTHOR_IDENT"], process)?;
    let committer = text(root,&["var","GIT_COMMITTER_IDENT"], process)?;
    let commit = object(root,"commit",sign(root,format!("tree {tree}\nparent {parent}\nauthor {author}\ncommitter {committer}\n\n{message}").into_bytes(), process)?, process)?;
    let index_path = root.join(text(root,&["rev-parse","--git-path","index"], process)?);
    let index_before = fs::read(&index_path)?;
    let temporary = Temporary(index_path.with_file_name(format!(".cadence-prune-index-{}",std::process::id())));
    let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&temporary.0)?;
    file.write_all(&index_before)?;
    drop(file);
    input(root,&["update-index","-z","--index-info"],&index_input,Some(&temporary.0), process)?;
    let index_after = fs::read(&temporary.0)?;
    Ok(Seal {parent,reference,tree,commit,objects,index_path,index_before,index_after})
}

/// Seal the real staged revert plus the final phase projections. The store
/// installs this exact object and index under the same intent as the receipt.
pub fn freeze_staged(root: &Path, changes: &BTreeMap<String, Vec<u8>>, subject: &str, process: &mut dyn Process) -> Result<Seal> {
    let parent = git::resolve_commit(root, "HEAD", process)?;
    let reference = text(root, &["symbolic-ref", "-q", "HEAD"], process)?;
    if !reference.starts_with("refs/heads/") { return Err(Error::Policy("undo requires a branch ref".into())); }
    let mut entries = BTreeMap::new();
    for row in git::run(root, ["ls-files", "--stage", "-z"], process)?.split(|b| *b == 0).filter(|b| !b.is_empty()) {
        let row = std::str::from_utf8(row).map_err(|_| Error::Invalid("undecodable index entry".into()))?;
        let (header, path) = row.split_once('\t').ok_or_else(|| Error::Invalid("invalid index entry".into()))?;
        let fields: Vec<_> = header.split(' ').collect();
        if fields.len() != 3 || fields[2] != "0" { return Err(Error::Conflict("undo index has conflicts".into())); }
        entries.insert(path.to_owned(), (fields[0].to_owned(), fields[1].to_owned()));
    }
    let index_path = root.join(text(root, &["rev-parse", "--git-path", "index"], process)?);
    let index_before = fs::read(&index_path)?;
    let temporary = Temporary(index_path.with_file_name(format!(".cadence-undo-index-{}", std::process::id())));
    let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&temporary.0)?;
    file.write_all(&index_before)?;
    drop(file);
    let mut objects = Vec::new();
    let mut index_input = Vec::new();
    for (path, bytes) in changes {
        let mode = entries.get(path).map_or("100644", |e| e.0.as_str()).to_owned();
        if !matches!(mode.as_str(), "100644" | "100755") { return Err(Error::Invalid(format!("undo projection is not a regular file: {path}"))); }
        let blob = object(root, "blob", bytes.clone(), process)?;
        index_input.extend_from_slice(format!("{mode} {}\t{path}\0", blob.id).as_bytes());
        entries.insert(path.clone(), (mode, blob.id.clone()));
        objects.push(blob);
    }
    if !index_input.is_empty() { input(root, &["update-index", "-z", "--index-info"], &index_input, Some(&temporary.0), process)?; }
    let tree = tree(root, &entries, "", &mut objects, process)?;
    let author = text(root, &["var", "GIT_AUTHOR_IDENT"], process)?;
    let committer = text(root, &["var", "GIT_COMMITTER_IDENT"], process)?;
    let commit = object(root, "commit", sign(root, format!("tree {tree}\nparent {parent}\nauthor {author}\ncommitter {committer}\n\n{subject}\n\nUndo only the accepted recorded phase material.\n").into_bytes(), process)?, process)?;
    let index_after = fs::read(&temporary.0)?;
    Ok(Seal { parent, reference, tree, commit, objects, index_path, index_before, index_after })
}

pub fn validate(root: &Path, seal: &Seal, replay: bool, process: &mut dyn Process) -> Result<()> {
    if text(root,&["symbolic-ref","-q","HEAD"], process)? != seal.reference { return Err(Error::Conflict("prune branch ref changed".into())); }
    let actual = git::resolve_commit(root,&seal.reference, process)?;
    if actual != seal.parent && !(replay && actual == seal.commit.id) {
        return Err(Error::Conflict(format!("prune ref changed: {}",seal.reference)));
    }
    let path = root.join(text(root,&["rev-parse","--git-path","index"], process)?);
    if path != seal.index_path { return Err(Error::Conflict("prune index path changed".into())); }
    let actual = fs::read(&path)?;
    if actual != seal.index_before && !(replay && actual == seal.index_after) {
        return Err(Error::Conflict(format!("prune index changed: {}",path.display())));
    }
    Ok(())
}

pub fn install(
    root: &Path,
    seal: &Seal,
    guard: &mut dyn FnMut(&mut dyn Process) -> Result<()>,
    process: &mut dyn Process,
) -> Result<()> {
    use crate::milestone::prune::stop;
    guard(process)?;
    stop("objects:before")?;
    for object in &seal.objects {
        guard(process)?;
        let id = git::object_id(input(root,&["hash-object","-w","-t",&object.kind,"--stdin"],&object.bytes,None, process)?)?;
        if id != object.id { return Err(Error::Invalid("prune object identity changed".into())); }
    }
    stop("objects:after")?;
    guard(process)?;
    stop("commit:before")?;
    let id = git::object_id(input(root,&["hash-object","-w","-t","commit","--stdin"],&seal.commit.bytes,None, process)?)?;
    if id != seal.commit.id { return Err(Error::Invalid("prune commit identity changed".into())); }
    stop("commit:after")?;
    guard(process)?;
    stop("ref:before")?;
    if git::resolve_commit(root,&seal.reference, process)? != id {
        git::run(root,["update-ref",&seal.reference,&id,&seal.parent], process)?;
    }
    stop("ref:after")?;
    guard(process)?;
    stop("index:before")?;
    if fs::read(&seal.index_path)? != seal.index_after {
        let lock = Temporary(seal.index_path.with_extension("lock"));
        let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&lock.0)?;
        guard(process)?;
        file.write_all(&seal.index_after)?;
        file.sync_all()?;
        fs::rename(&lock.0,&seal.index_path)?;
        fs::File::open(seal.index_path.parent().unwrap())?.sync_all()?;
    }
    stop("index:after")?;
    Ok(())
}
