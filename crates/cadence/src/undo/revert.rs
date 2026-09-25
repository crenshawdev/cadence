use crate::process::Process;
use super::model::{Document, Mode, Record, Write};
use crate::{rail::{branch, commit, git}, store::{Error, Result}};
use std::{collections::BTreeMap, fs, io::Write as _, os::unix::fs::PermissionsExt, path::Path};

pub fn read_regular(path: &Path) -> Result<Option<Vec<u8>>> {
    for parent in path.ancestors().skip(1) {
        let metadata = fs::symlink_metadata(parent)?;
        if !metadata.is_dir() || metadata.file_type().is_symlink() { return Err(Error::Invalid(format!("{}: uncontained document", path.display()))); }
    }
    match fs::symlink_metadata(path) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.into()),
        Ok(meta) if meta.is_file() && !meta.file_type().is_symlink() && meta.permissions().mode() & 0o444 != 0 => Ok(Some(fs::read(path)?)),
        Ok(_) => Err(Error::Invalid(format!("{}: not a readable regular file", path.display()))),
    }
}

pub fn policy(project: &Path, protected: &[String], on_protected: &str, process: &mut dyn Process) -> Result<()> {
    let name = String::from_utf8(git::run(project, ["symbolic-ref", "--short", "HEAD"], process)?)
        .map_err(|e| Error::Invalid(e.to_string()))?;
    if branch::permission(protected, on_protected, name.trim())? != branch::Permission::Pass {
        return Err(Error::Policy(format!("undo commit requires branch permission: {}", name.trim())));
    }
    Ok(())
}

pub fn preflight(project: &Path, mode: &Mode, protected: &[String], on_protected: &str, process: &mut dyn Process) -> Result<()> {
    if !git::run(project, ["status", "--porcelain", "--untracked-files=normal"], process)?.is_empty() {
        return Err(Error::Conflict("undo requires a clean worktree and index".into()));
    }
    for name in ["REVERT_HEAD", "CHERRY_PICK_HEAD", "MERGE_HEAD", "sequencer"] {
        let path = String::from_utf8(git::run(project, ["rev-parse", "--git-path", name], process)?).map_err(|e| Error::Invalid(e.to_string()))?;
        if project.join(path.trim()).exists() { return Err(Error::Conflict(format!("undo cannot enter existing Git state {name}"))); }
    }
    if *mode == Mode::Committed { policy(project, protected, on_protected, process)?; }
    Ok(())
}

pub fn perform(project: &Path, hash: &str, process: &mut dyn Process) -> Result<()> {
    // One full hash, always. Git owns real index/worktree conflict state.
    git::run(project, ["revert", "--no-commit", hash], process).map(|_| ())
}

pub fn conflicts(project: &Path, process: &mut dyn Process) -> Result<Vec<String>> {
    git::run(project, ["diff", "--name-only", "--diff-filter=U", "-z"], process)?
        .split(|b| *b == 0).filter(|p| !p.is_empty())
        .map(|p| String::from_utf8(p.to_vec()).map_err(|e| Error::Invalid(e.to_string()))).collect()
}

pub fn document(project: &Path, path: &str, after: Vec<u8>) -> Result<Document> {
    Ok(Document { before: read_regular(&project.join(path))?, after })
}

pub fn roadmap(bytes: &[u8], phase: u32) -> Result<Vec<u8>> {
    let text = std::str::from_utf8(bytes).map_err(|e| Error::Invalid(e.to_string()))?;
    let parsed = crate::derivation::parse_roadmap(text).map_err(|e| Error::Invalid(e.to_string()))?;
    let declarations: Vec<_> = parsed.phases.iter().filter(|p| p.id.address() == phase.to_string()).collect();
    let [declaration] = declarations.as_slice() else { return Err(Error::Invalid(format!("ROADMAP phase {phase} is absent or ambiguous"))); };
    let mut lines: Vec<String> = text.split('\n').map(str::to_owned).collect();
    let line = &mut lines[declaration.source_line - 1];
    if declaration.checked { *line = line.replacen("[x]", "[ ]", 1).replacen("[X]", "[ ]", 1); }
    // The table is a mirror, too. Only a row explicitly naming this phase is changed.
    for line in &mut lines {
        if !line.trim_start().starts_with('|') { continue; }
        let cells: Vec<_> = line.split('|').map(str::trim).collect();
        if cells.iter().any(|cell| *cell == phase.to_string() || *cell == format!("Phase {phase}")) {
            *line = line.replace("Complete", "Planned").replace("complete", "planned");
        }
    }
    Ok(lines.join("\n").into_bytes())
}

pub fn tracked_changes(documents: &BTreeMap<String, Document>) -> BTreeMap<String, Vec<u8>> {
    documents.iter().map(|(path, document)| (path.clone(), document.after.clone())).collect()
}

pub fn validate(root: &Path, write: &Write, replay: bool, process: &mut dyn Process) -> Result<()> {
    if crate::verification::inputs::root_binding(root)? != write.record.manifest.root_binding {
        return Err(Error::Conflict("undo store root changed".into()));
    }
    let project = root.parent().ok_or_else(|| Error::Invalid("planning root lacks project".into()))?;
    if let Some(seal) = &write.seal {
        policy(project, &write.protected, &write.on_protected, process)?;
        commit::validate(project, seal, replay, process)?;
    }
    for (path, document) in &write.documents {
        if !matches!(path.as_str(), ".planning/ROADMAP.md" | ".planning/REQUIREMENTS.md" | ".planning/STATE.md") {
            return Err(Error::Invalid(format!("undo cannot repair unrelated document {path}")));
        }
        let actual = read_regular(&project.join(path))?;
        if actual != document.before && !(replay && actual.as_ref() == Some(&document.after)) {
            return Err(Error::Conflict(format!("undo projection changed: {path}")));
        }
    }
    Ok(())
}

pub fn install(root: &Path, write: &Write, process: &mut dyn Process) -> Result<()> {
    let project = root.parent().ok_or_else(|| Error::Invalid("planning root lacks project".into()))?;
    for (relative, document) in &write.documents {
        validate(root, write, true, process)?;
        let path = project.join(relative);
        if read_regular(&path)?.as_ref() == Some(&document.after) { continue; }
        let temporary = path.with_extension(format!("undo-{}.tmp", std::process::id()));
        let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&temporary)?;
        let result = (|| {
            if let Ok(meta) = fs::metadata(&path) { file.set_permissions(meta.permissions())?; }
            file.write_all(&document.after)?;
            file.sync_all()?;
            validate(root, write, true, process)?;
            fs::rename(&temporary, &path)?;
            fs::File::open(path.parent().unwrap())?.sync_all()?;
            Ok::<_, Error>(())
        })();
        let _ = fs::remove_file(temporary);
        result?;
    }
    if let Some(seal) = &write.seal { commit::install(project, seal, &mut |process: &mut dyn Process| validate(root, write, true, process), process)?; }
    validate(root, write, true, process)
}

pub fn write(record: Record, protected: &[String], on_protected: &str) -> Write {
    Write { record, seal: None, documents: BTreeMap::new(), protected: protected.to_vec(), on_protected: on_protected.into() }
}
