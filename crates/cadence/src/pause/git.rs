//! Git process boundary. Paths are OS strings, never shell commands or quoted text.
use crate::process::Process;
use crate::rail::{git as shared_git, risk::MaterialIdentity};
use crate::store::{Error, Result};
use std::{
    collections::BTreeSet,
    ffi::OsStr,
    fs,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};

static TEMP_INDEX_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Staged {
    pub base: String,
    pub index_id: String,
    pub scope: Vec<PathBuf>,
    pub authored: Vec<PathBuf>,
    pub diff: Vec<u8>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WipIndex {
    pub head: String,
    pub branch: Vec<u8>,
    pub index_id: String,
    pub paths: Vec<PathBuf>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Change {
    pub index: u8,
    pub worktree: u8,
    pub path: PathBuf,
    pub original: Option<PathBuf>,
    pub material: Material,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Material {
    Missing,
    File { digest: String, executable: bool },
    Symlink(PathBuf),
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Observation {
    pub head: String,
    /// Empty means detached HEAD; retained as bytes rather than decoded lossily.
    pub branch: Vec<u8>,
    pub index: Vec<u8>,
    pub changes: Vec<Change>,
}

pub fn run<I, S>(root: &Path, args: I, process: &mut dyn Process) -> Result<Vec<u8>>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let output = crate::git_process::run(
        &crate::git_process::launch(crate::git_process::Caller::PauseRead)
            .cwd(root)
            .args(args)
            .env("GIT_OPTIONAL_LOCKS", "0")
            .env("GIT_LITERAL_PATHSPECS", "1"), process,
    )?;
    if !output.success() {
        return Err(Error::Invalid(format!(
            "Git failed ({}): {}",
            output.status,
            String::from_utf8_lossy(&output.stderr)
        )));
    }
    Ok(output.stdout)
}

fn line(mut bytes: Vec<u8>) -> Vec<u8> {
    if bytes.last() == Some(&b'\n') {
        bytes.pop();
    }
    bytes
}

#[cfg(unix)]
fn pathname(bytes: &[u8]) -> Result<PathBuf> {
    use std::os::unix::ffi::OsStrExt;
    Ok(PathBuf::from(OsStr::from_bytes(bytes)))
}
#[cfg(not(unix))]
fn pathname(bytes: &[u8]) -> Result<PathBuf> {
    String::from_utf8(bytes.to_vec())
        .map(PathBuf::from)
        .map_err(|_| Error::Invalid("Git pathname is not representable on this platform".into()))
}

pub(crate) fn material(path: &Path) -> Result<Material> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Material::Missing),
        Err(error) => return Err(error.into()),
    };
    if metadata.file_type().is_symlink() {
        return Ok(Material::Symlink(fs::read_link(path)?));
    }
    if !metadata.is_file() {
        return Err(Error::Invalid(format!(
            "pause needs an ordinary file or symlink: {path:?}"
        )));
    }
    #[cfg(unix)]
    let executable = {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    };
    #[cfg(not(unix))]
    let executable = false;
    Ok(Material::File {
        digest: crate::store::model::digest(&fs::read(path)?),
        executable,
    })
}

/// One entry of `git status --porcelain=v1 -z`: the index and worktree codes,
/// the path, and the source of a rename or copy.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Entry {
    pub index: u8,
    pub worktree: u8,
    pub path: PathBuf,
    pub original: Option<PathBuf>,
}

/// Reads status output as raw pathname bytes; nothing is decoded or quoted.
pub fn parse_status(status: &[u8]) -> Result<Vec<Entry>> {
    let mut fields = status.split(|b| *b == 0);
    let mut entries = Vec::new();
    while let Some(entry) = fields.next() {
        if entry.is_empty() {
            break;
        }
        if entry.len() < 4 || entry[2] != b' ' {
            return Err(Error::Invalid("malformed Git status".into()));
        }
        let path = pathname(&entry[3..])?;
        super::validate_path(&path)?;
        let original = if entry[..2].iter().any(|b| matches!(b, b'R' | b'C')) {
            let source = fields
                .next()
                .filter(|f| !f.is_empty())
                .ok_or_else(|| Error::Invalid("missing Git rename source".into()))?;
            let source = pathname(source)?;
            super::validate_path(&source)?;
            Some(source)
        } else {
            None
        };
        entries.push(Entry {
            index: entry[0],
            worktree: entry[1],
            path,
            original,
        });
    }
    Ok(entries)
}

pub fn observe(root: &Path, process: &mut dyn Process) -> Result<Observation> {
    let prefix = run(root, ["rev-parse", "--show-prefix"], process)?;
    if prefix != b"\n" {
        return Err(Error::Invalid(
            "pause root is not the Git worktree root".into(),
        ));
    }
    let head = String::from_utf8(line(run(root, ["rev-parse", "--verify", "HEAD"], process)?))
        .map_err(|_| Error::Invalid("invalid Git HEAD".into()))?;
    let branch = line(run(root, ["branch", "--show-current"], process)?);
    let index = run(root, ["ls-files", "--stage", "-z"], process)?;
    let status = run(
        root,
        [
            "status",
            "--porcelain=v1",
            "-z",
            "--untracked-files=all",
            "--renames",
        ],
        process,
    )?;
    let changes = parse_status(&status)?
        .into_iter()
        .map(|entry| {
            Ok(Change {
                index: entry.index,
                worktree: entry.worktree,
                material: material(&root.join(&entry.path))?,
                path: entry.path,
                original: entry.original,
            })
        })
        .collect::<Result<Vec<_>>>()?;
    // Observation is read-only, including Git's optional index refresh.
    if index != run(root, ["ls-files", "--stage", "-z"], process)?
        || head.as_bytes() != line(run(root, ["rev-parse", "--verify", "HEAD"], process)?)
        || branch != line(run(root, ["branch", "--show-current"], process)?)
    {
        return Err(Error::Invalid(
            "Git changed during pause observation".into(),
        ));
    }
    Ok(Observation {
        head,
        branch,
        index,
        changes,
    })
}

fn paths(bytes: &[u8]) -> Result<Vec<PathBuf>> {
    bytes
        .split(|byte| *byte == 0)
        .filter(|field| !field.is_empty())
        .map(|field| {
            let path = pathname(field)?;
            super::validate_path(&path)?;
            Ok(path)
        })
        .collect()
}

fn review_artifact(path: &Path) -> bool {
    let parts: Vec<_> = path.components().collect();
    if parts.len() != 4 || parts[0].as_os_str() != ".planning" || parts[1].as_os_str() != "phases" {
        return false;
    }
    let Some(name) = path.file_name().and_then(OsStr::to_str) else {
        return false;
    };
    (name.starts_with("ADJUDICATION-") && name.ends_with(".json"))
        || (name.starts_with("REVIEW-") && name.ends_with(".md"))
        || matches!(name, "FINDINGS.json" | "verifier-findings.json")
}

pub fn index_id(root: &Path, process: &mut dyn Process) -> Result<String> {
    shared_git::index_id(root, process)
}

struct TempIndex {
    directory: PathBuf,
    path: PathBuf,
}

impl TempIndex {
    fn create() -> Result<Self> {
        loop {
            let sequence = TEMP_INDEX_SEQUENCE.fetch_add(1, Ordering::Relaxed);
            let directory = std::env::temp_dir().join(format!(
                "cadence-risk-index-{}-{sequence}",
                std::process::id()
            ));
            match fs::create_dir(&directory) {
                Ok(()) => {
                    return Ok(Self {
                        path: directory.join("index"),
                        directory,
                    });
                }
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                Err(error) => return Err(error.into()),
            }
        }
    }

    fn run<I, S>(
        &self,
        root: &Path,
        args: I,
        input: Option<&[u8]>,
        process: &mut dyn Process,
    ) -> Result<Vec<u8>>
    where
        I: IntoIterator<Item = S>,
        S: AsRef<OsStr>,
    {
        let mut launch = crate::git_process::launch(crate::git_process::Caller::PauseIndex)
            .cwd(root)
            .args(args)
            .env("GIT_OPTIONAL_LOCKS", "0")
            .env("GIT_INDEX_FILE", &self.path);
        if let Some(bytes) = input {
            launch = launch.stdin(bytes);
        }
        let output = crate::git_process::run(&launch, process)?;
        if !output.success() {
            return Err(Error::Invalid(format!(
                "Git failed ({}): {}",
                output.status,
                String::from_utf8_lossy(&output.stderr)
            )));
        }
        Ok(output.stdout)
    }
}

impl Drop for TempIndex {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.directory);
    }
}

fn authored_index_id(
    root: &Path,
    base: &str,
    captured_index: &str,
    authored: &[PathBuf],
    process: &mut dyn Process,
) -> Result<String> {
    let index = TempIndex::create()?;
    index.run(root, ["read-tree", base], None, process)?;
    for path in authored {
        index.run(
            root,
            [
                OsStr::new("update-index"),
                OsStr::new("--force-remove"),
                path.as_os_str(),
            ],
            None,
            process,
        )?;
        let entry = run(
            root,
            [
                OsStr::new("ls-tree"),
                OsStr::new("-z"),
                OsStr::new(captured_index),
                OsStr::new("--"),
                path.as_os_str(),
            ],
            process,
        )?;
        if !entry.is_empty() {
            index.run(root, ["update-index", "-z", "--index-info"], Some(&entry), process)?;
        }
    }
    String::from_utf8(line(index.run(root, ["write-tree"], None, process)?))
        .map_err(|_| Error::Invalid("invalid authored staged tree identity".into()))
}

/// The staged paths risk reviews: every changed path except the store receipts
/// named by provenance and the review artifacts directly under a phase.
pub fn authored(scope: &[PathBuf], receipts: &BTreeSet<PathBuf>) -> Vec<PathBuf> {
    scope
        .iter()
        .filter(|path| !receipts.contains(*path) && !review_artifact(path))
        .cloned()
        .collect()
}

/// Store receipts are supplied by provenance, not recognized by filename.
pub fn staged(root: &Path, base: &str, receipts: &BTreeSet<PathBuf>, process: &mut dyn Process) -> Result<Staged> {
    let head = shared_git::resolve_commit(root, "HEAD", process)?;
    let base = shared_git::resolve_comparison(root, base, process)?;
    let before = index_id(root, process)?;
    let scope = shared_git::changed_paths(
        root,
        &MaterialIdentity::Staged {
            base_id: base.clone(),
            index_id: before.clone(),
        },
        process,
    )?;
    let authored = authored(&scope, receipts);
    let authored_id = authored_index_id(root, &base, &before, &authored, process)?;
    let diff = shared_git::diff_selected(
        root,
        &MaterialIdentity::Staged {
            base_id: base.clone(),
            index_id: authored_id.clone(),
        },
        &authored,
        process,
    )?
    .body;
    if before != index_id(root, process)? || head != shared_git::resolve_commit(root, "HEAD", process)? {
        return Err(Error::Conflict(
            "staged material changed during risk observation".into(),
        ));
    }
    Ok(Staged {
        base,
        index_id: authored_id,
        scope,
        authored,
        diff,
    })
}

fn covered(change: &Change, paths: &BTreeSet<PathBuf>) -> bool {
    paths.contains(&change.path)
        && change
            .original
            .as_ref()
            .is_none_or(|original| paths.contains(original))
}

/// Dirty work that is neither authorized nor an ignored receipt.
pub fn unauthorized(
    expected: &Observation,
    authorized: &BTreeSet<PathBuf>,
    ignored: &BTreeSet<PathBuf>,
) -> bool {
    expected
        .changes
        .iter()
        .any(|change| !covered(change, ignored) && !covered(change, authorized))
}

/// Whether Git still shows the work pause captured: the same head, the same
/// index, and the same changes apart from the ignored receipts.
pub fn unchanged(current: &Observation, expected: &Observation, ignored: &BTreeSet<PathBuf>) -> bool {
    let authored = |observation: &Observation| {
        observation
            .changes
            .iter()
            .filter(|change| !covered(change, ignored))
            .cloned()
            .collect::<Vec<_>>()
    };
    current.head == expected.head
        && current.index == expected.index
        && authored(current) == authored(expected)
}

/// What `git add` is given: each worktree change the WIP stages, and the source
/// of a rename not yet in the index, so both sides of it land.
pub fn add_paths(expected: &Observation, stage_paths: &BTreeSet<PathBuf>) -> BTreeSet<PathBuf> {
    let mut add_paths = BTreeSet::new();
    for change in &expected.changes {
        if change.worktree != b' ' && covered(change, stage_paths) {
            add_paths.insert(change.path.clone());
            if change.index == b' '
                && let Some(original) = &change.original
            {
                add_paths.insert(original.clone());
            }
        }
    }
    add_paths
}

/// The WIP commit's paths out of everything staged: none when nothing staged is
/// WIP material, and a refusal when anything else is staged beside it.
pub fn wip_paths(staged: Vec<PathBuf>, stage_paths: &BTreeSet<PathBuf>) -> Result<Option<Vec<PathBuf>>> {
    let count = staged.len();
    let wip: Vec<_> = staged
        .into_iter()
        .filter(|path| stage_paths.contains(path))
        .collect();
    if wip.is_empty() {
        return Ok(None);
    }
    if wip.len() != count {
        return Err(Error::Conflict(
            "pause found non-WIP material in the staged index".into(),
        ));
    }
    Ok(Some(wip))
}

pub fn stage_authorized(
    root: &Path,
    expected: &Observation,
    authorized: &BTreeSet<PathBuf>,
    ignored_paths: &BTreeSet<PathBuf>,
    stage_paths: &BTreeSet<PathBuf>,
    process: &mut dyn Process,
) -> Result<Option<WipIndex>> {
    if unauthorized(expected, authorized, ignored_paths) {
        return Err(Error::Conflict(
            "pause found dirty work outside the authorized set".into(),
        ));
    }
    let current = observe(root, process)?;
    if !unchanged(&current, expected, ignored_paths) {
        return Err(Error::Conflict(
            "authorized work changed before pause staging".into(),
        ));
    }
    let add_paths = add_paths(expected, stage_paths);
    if !add_paths.is_empty() {
        let mut args = vec![std::ffi::OsString::from("add"), "--all".into(), "--".into()];
        args.extend(add_paths.iter().map(|path| path.as_os_str().to_owned()));
        run(root, args, process)?;
    }
    let staged_paths = paths(&run(
        root,
        [
            "diff",
            "--cached",
            "--name-only",
            "-z",
            "--no-renames",
            expected.head.as_str(),
            "--",
        ],
        process,
    )?)?;
    let Some(wip_paths) = wip_paths(staged_paths, stage_paths)? else {
        return Ok(None);
    };
    Ok(Some(WipIndex {
        head: expected.head.clone(),
        branch: expected.branch.clone(),
        index_id: index_id(root, process)?,
        paths: wip_paths,
    }))
}

fn unstaged(root: &Path, paths: &[PathBuf], process: &mut dyn Process) -> Result<Vec<PathBuf>> {
    let mut args = vec![
        std::ffi::OsString::from("diff"),
        "--name-only".into(),
        "-z".into(),
        "--no-renames".into(),
        "--".into(),
    ];
    args.extend(paths.iter().map(|path| path.as_os_str().to_owned()));
    self::paths(&run(root, args, process)?)
}

pub fn commit_guarded(
    root: &Path,
    expected: &WipIndex,
    subject: &str,
    process: &mut dyn Process,
) -> Result<String> {
    let head = String::from_utf8(line(run(root, ["rev-parse", "--verify", "HEAD"], process)?))
        .map_err(|_| Error::Invalid("invalid Git HEAD".into()))?;
    let branch = line(run(root, ["branch", "--show-current"], process)?);
    let index = index_id(root, process)?;
    if !guard_holds(expected, &head, &branch, &index, &unstaged(root, &expected.paths, process)?) {
        return Err(Error::Conflict(
            "guarded material changed before commit".into(),
        ));
    }
    let subject = subject.trim();
    if subject.is_empty() || subject.contains(['\r', '\n']) {
        return Err(Error::Invalid("commit subject must be one line".into()));
    }
    run(root, ["commit", "-m", subject], process)?;
    let committed = String::from_utf8(line(run(root, ["rev-parse", "--verify", "HEAD"], process)?))
        .map_err(|_| Error::Invalid("invalid commit identity".into()))?;
    let tree = String::from_utf8(line(run(root, ["rev-parse", "HEAD^{tree}"], process)?))
        .map_err(|_| Error::Invalid("invalid WIP tree identity".into()))?;
    let parent = String::from_utf8(line(run(root, ["rev-parse", "HEAD^"], process)?))
        .map_err(|_| Error::Invalid("invalid WIP parent identity".into()))?;
    if !committed_as_guarded(expected, &tree, &parent, &unstaged(root, &expected.paths, process)?) {
        return Err(Error::Conflict(
            "commit differs from the guarded staged tree".into(),
        ));
    }
    Ok(committed)
}

/// Whether Git still shows the guarded index before its commit: its head, its
/// branch, its tree, and nothing of its paths left unstaged.
pub fn guard_holds(expected: &WipIndex, head: &str, branch: &[u8], index_id: &str, unstaged: &[PathBuf]) -> bool {
    head == expected.head
        && branch == expected.branch
        && index_id == expected.index_id
        && unstaged.is_empty()
}

/// Whether the new commit is the guarded tree on the guarded head, with
/// nothing of its paths left unstaged.
pub fn committed_as_guarded(expected: &WipIndex, tree: &str, parent: &str, unstaged: &[PathBuf]) -> bool {
    tree == expected.index_id && parent == expected.head && unstaged.is_empty()
}

/// `wip: <description>`, from one nonblank line.
pub fn wip_subject(description: &str) -> Result<String> {
    let description = description.trim();
    if description.is_empty() || description.contains(['\r', '\n']) {
        return Err(Error::Invalid("WIP description must be one line".into()));
    }
    Ok(format!("wip: {description}"))
}

pub fn commit_wip(root: &Path, expected: &WipIndex, description: &str, process: &mut dyn Process) -> Result<String> {
    commit_guarded(root, expected, &wip_subject(description)?, process)
}

pub fn require_clean(root: &Path, process: &mut dyn Process) -> Result<()> {
    if run(
        root,
        [
            "status",
            "--porcelain=v1",
            "-z",
            "--untracked-files=all",
            "--renames",
        ],
        process,
    )?
    .is_empty()
    {
        Ok(())
    } else {
        Err(Error::Conflict(
            "pause commit did not leave a clean worktree".into(),
        ))
    }
}

pub fn committed_file(
    root: &Path,
    commit: &str,
    path: &Path,
    process: &mut dyn Process,
) -> Result<Vec<u8>> {
    let path = path
        .to_str()
        .ok_or_else(|| Error::Invalid("committed participant path is not UTF-8".into()))?;
    run(root, ["show", &format!("{commit}:{path}")], process)
}
