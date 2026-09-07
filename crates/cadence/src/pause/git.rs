//! Git process boundary. Paths are OS strings, never shell commands or quoted text.
use crate::store::{Error, Result};
use std::{
    ffi::OsStr,
    fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

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
