//! The off-roadmap task: explicit identity, the shared branch and risk policy,
//! and a record whose home depends on whether a planning root exists.
//!
//! Without a planning root the episode lives in the resident's memory for
//! the run, matched risk material is held in a per-run temporary directory
//! that is gone before the answer, and nothing is created under the project
//! (D-209). Under a planning root the record is a store record; that arm is
//! plan 2's and is refused here by name rather than answered without a record.
pub mod instructions;
pub mod model;
pub mod render;

use crate::process::Process;
use crate::{
    rail::{git, risk::MaterialIdentity},
    store::{Error, Result},
};
use std::{
    fs,
    path::{Path, PathBuf},
};

/// The material a matched risk is held in: one directory under the system
/// temporary root, named by the run token, removed when dropped. It is never
/// a project path and never a `.planning/` artifact.
pub struct Transient {
    directory: PathBuf,
}

impl Transient {
    pub fn create(token: &str) -> Result<Self> {
        let directory = std::env::temp_dir().join(format!("cadence-task-{token}"));
        match fs::create_dir(&directory) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                fs::remove_dir_all(&directory)?;
                fs::create_dir(&directory)?;
            }
            Err(error) => return Err(error.into()),
        }
        Ok(Self { directory })
    }

    pub fn location(&self) -> &Path {
        &self.directory
    }

    /// Write one named file into the directory and return its path.
    pub fn hold(&self, name: &str, bytes: &[u8]) -> Result<PathBuf> {
        let path = self.directory.join(name);
        fs::write(&path, bytes)?;
        Ok(path)
    }
}

impl Drop for Transient {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.directory);
    }
}

/// The commits and files between the task's start commit and the current
/// HEAD, read from git and never retyped by the caller.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Range {
    pub head: String,
    pub commits: Vec<model::Commit>,
    pub files: Vec<String>,
    pub material: Option<MaterialIdentity>,
    pub diff: Vec<u8>,
    pub diff_paths: Vec<PathBuf>,
}

fn text(bytes: &[u8]) -> Result<String> {
    String::from_utf8(bytes.to_vec()).map_err(|_| Error::Invalid("git answered non-UTF-8 text".into()))
}

fn path_text(path: &Path) -> Result<String> {
    path.to_str()
        .map(str::to_owned)
        .ok_or_else(|| Error::Invalid("git path is not UTF-8".into()))
}

/// Observe the range `start..HEAD`. An unmoved HEAD is an empty range with
/// no material: nothing landed, so nothing can be scanned.
pub fn observe_range(project: &Path, start: &str, process: &mut dyn Process) -> Result<Range> {
    let head = git::resolve_commit(project, "HEAD", process)?;
    if head == start {
        return Ok(Range { head, commits: Vec::new(), files: Vec::new(), material: None, diff: Vec::new(), diff_paths: Vec::new() });
    }
    let material = MaterialIdentity::Committed { base_id: start.to_owned(), head_id: head.clone() };
    let log = git::run(project, ["log", "--reverse", "--format=%H%x00%s", "--end-of-options", &format!("{start}..{head}")], process)?;
    let mut commits = Vec::new();
    for line in text(&log)?.lines().filter(|line| !line.is_empty()) {
        let (id, subject) = line.split_once('\0').ok_or_else(|| Error::Invalid("malformed git log record".into()))?;
        let names = git::run(project, ["diff-tree", "--no-commit-id", "--name-only", "-r", "-z", "--root", "--end-of-options", id], process)?;
        let files = names.split(|byte| *byte == 0).filter(|name| !name.is_empty())
            .map(text).collect::<Result<Vec<_>>>()?;
        commits.push(model::Commit { id: id.to_owned(), subject: subject.to_owned(), files });
    }
    let diff = git::diff(project, &material, process)?;
    let files = git::changed_paths(project, &material, process)?.iter().map(|path| path_text(path)).collect::<Result<Vec<_>>>()?;
    Ok(Range { head, commits, files, material: Some(material), diff: diff.body, diff_paths: diff.paths })
}
