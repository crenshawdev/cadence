//! Git process boundary. Paths are OS strings, never shell commands or quoted text.
use crate::store::{Error, Result};
use std::{
    collections::BTreeSet,
    ffi::OsStr,
    fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

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

pub fn run<I, S>(root: &Path, args: I) -> Result<Vec<u8>>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let output = Command::new("git")
        .current_dir(root)
        .args(args)
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("GIT_LITERAL_PATHSPECS", "1")
        .stdin(Stdio::null())
        .output()?;
    if !output.status.success() {
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

fn material(path: &Path) -> Result<Material> {
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

pub fn observe(root: &Path) -> Result<Observation> {
    let prefix = run(root, ["rev-parse", "--show-prefix"])?;
    if prefix != b"\n" {
        return Err(Error::Invalid(
            "pause root is not the Git worktree root".into(),
        ));
    }
    let head = String::from_utf8(line(run(root, ["rev-parse", "--verify", "HEAD"])?))
        .map_err(|_| Error::Invalid("invalid Git HEAD".into()))?;
    let branch = line(run(root, ["branch", "--show-current"])?);
    let index = run(root, ["ls-files", "--stage", "-z"])?;
    let status = run(
        root,
        [
            "status",
            "--porcelain=v1",
            "-z",
            "--untracked-files=all",
            "--renames",
        ],
    )?;
    let mut fields = status.split(|b| *b == 0);
    let mut changes = Vec::new();
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
        changes.push(Change {
            index: entry[0],
            worktree: entry[1],
            material: material(&root.join(&path))?,
            path,
            original,
        });
    }
    // Observation is read-only, including Git's optional index refresh.
    if index != run(root, ["ls-files", "--stage", "-z"])?
        || head.as_bytes() != line(run(root, ["rev-parse", "--verify", "HEAD"])?)
        || branch != line(run(root, ["branch", "--show-current"])?)
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

pub fn index_id(root: &Path) -> Result<String> {
    String::from_utf8(line(run(root, ["write-tree"])?))
        .map_err(|_| Error::Invalid("invalid staged tree identity".into()))
}

/// Store receipts are supplied by provenance, not recognized by filename.
pub fn staged(root: &Path, base: &str, receipts: &BTreeSet<PathBuf>) -> Result<Staged> {
    let head = String::from_utf8(line(run(root, ["rev-parse", "--verify", "HEAD"])?))
        .map_err(|_| Error::Invalid("invalid Git HEAD".into()))?;
    let before = index_id(root)?;
    let scope = paths(&run(
        root,
        [
            "diff",
            "--cached",
            "--name-only",
            "-z",
            "--no-renames",
            base,
            "--",
        ],
    )?)?;
    let authored: Vec<_> = scope
        .iter()
        .filter(|path| !receipts.contains(*path) && !review_artifact(path))
        .cloned()
        .collect();
    let diff = if authored.is_empty() {
        Vec::new()
    } else {
        let mut args = vec![
            std::ffi::OsString::from("diff"),
            "--cached".into(),
            "--no-ext-diff".into(),
            "--no-textconv".into(),
            "--no-renames".into(),
            "--binary".into(),
            "--unified=0".into(),
            base.into(),
            "--".into(),
        ];
        args.extend(authored.iter().map(|path| path.as_os_str().to_owned()));
        run(root, args)?
    };
    if before != index_id(root)?
        || head.as_bytes() != line(run(root, ["rev-parse", "--verify", "HEAD"])?)
    {
        return Err(Error::Conflict(
            "staged material changed during risk observation".into(),
        ));
    }
    Ok(Staged {
        base: base.into(),
        index_id: before,
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

pub fn stage_authorized(
    root: &Path,
    expected: &Observation,
    authorized: &BTreeSet<PathBuf>,
    ignored_paths: &BTreeSet<PathBuf>,
    stage_paths: &BTreeSet<PathBuf>,
) -> Result<Option<WipIndex>> {
    if expected
        .changes
        .iter()
        .any(|change| !covered(change, ignored_paths) && !covered(change, authorized))
    {
        return Err(Error::Conflict(
            "pause found dirty work outside the authorized set".into(),
        ));
    }
    let current = observe(root)?;
    let authored = |observation: &Observation| {
        observation
            .changes
            .iter()
            .filter(|change| !covered(change, ignored_paths))
            .cloned()
            .collect::<Vec<_>>()
    };
    if current.head != expected.head
        || current.index != expected.index
        || authored(&current) != authored(expected)
    {
        return Err(Error::Conflict(
            "authorized work changed before pause staging".into(),
        ));
    }
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
    if !add_paths.is_empty() {
        let mut args = vec![std::ffi::OsString::from("add"), "--all".into(), "--".into()];
        args.extend(add_paths.iter().map(|path| path.as_os_str().to_owned()));
        run(root, args)?;
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
    )?)?;
    let wip_paths: Vec<_> = staged_paths
        .iter()
        .filter(|path| stage_paths.contains(*path))
        .cloned()
        .collect();
    if wip_paths.is_empty() {
        return Ok(None);
    }
    if wip_paths.len() != staged_paths.len() {
        return Err(Error::Conflict(
            "pause found non-WIP material in the staged index".into(),
        ));
    }
    Ok(Some(WipIndex {
        head: expected.head.clone(),
        branch: expected.branch.clone(),
        index_id: index_id(root)?,
        paths: wip_paths,
    }))
}

fn unstaged(root: &Path, paths: &[PathBuf]) -> Result<Vec<PathBuf>> {
    let mut args = vec![
        std::ffi::OsString::from("diff"),
        "--name-only".into(),
        "-z".into(),
        "--no-renames".into(),
        "--".into(),
    ];
    args.extend(paths.iter().map(|path| path.as_os_str().to_owned()));
    self::paths(&run(root, args)?)
}

pub fn commit_wip(root: &Path, expected: &WipIndex, description: &str) -> Result<String> {
    let head = String::from_utf8(line(run(root, ["rev-parse", "--verify", "HEAD"])?))
        .map_err(|_| Error::Invalid("invalid Git HEAD".into()))?;
    if head != expected.head
        || line(run(root, ["branch", "--show-current"])?) != expected.branch
        || index_id(root)? != expected.index_id
        || !unstaged(root, &expected.paths)?.is_empty()
    {
        return Err(Error::Conflict(
            "guarded material changed before WIP commit".into(),
        ));
    }
    let description = description.trim();
    if description.is_empty() || description.contains(['\r', '\n']) {
        return Err(Error::Invalid("WIP description must be one line".into()));
    }
    run(root, ["commit", "-m", &format!("wip: {description}")])?;
    let committed = String::from_utf8(line(run(root, ["rev-parse", "--verify", "HEAD"])?))
        .map_err(|_| Error::Invalid("invalid WIP commit identity".into()))?;
    let tree = String::from_utf8(line(run(root, ["rev-parse", "HEAD^{tree}"])?))
        .map_err(|_| Error::Invalid("invalid WIP tree identity".into()))?;
    let parent = String::from_utf8(line(run(root, ["rev-parse", "HEAD^"])?))
        .map_err(|_| Error::Invalid("invalid WIP parent identity".into()))?;
    if tree != expected.index_id
        || parent != expected.head
        || !unstaged(root, &expected.paths)?.is_empty()
    {
        return Err(Error::Conflict(
            "WIP commit differs from the guarded staged tree".into(),
        ));
    }
    Ok(committed)
}
