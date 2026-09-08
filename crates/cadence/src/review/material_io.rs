//! Source acquisition adapters. Retention is supplied separately as Storage.
use super::io::{
    Clock, DirectoryMembers, DirectoryNode, DirectoryObservation, GitIo, GitObservation,
    MaterialIo, NodeKind,
};
use super::model::Target;
use cadence::rail::git;
use cadence::store::{Error, Observed, Result};
use std::fs;
use std::io::Read;
use std::os::unix::fs::{MetadataExt, OpenOptionsExt};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub struct SourceFiles {
    pub root: PathBuf,
}

fn identity(metadata: &fs::Metadata) -> String {
    format!(
        "{}:{}:{}:{}:{}",
        metadata.dev(),
        metadata.ino(),
        metadata.len(),
        metadata.mtime(),
        metadata.mtime_nsec()
    )
}

impl SourceFiles {
    fn checked_path(&self, relative: &str) -> Result<PathBuf> {
        let relative = relative.strip_prefix("./").unwrap_or(relative);
        if relative.is_empty()
            || Path::new(relative).is_absolute()
            || relative.contains('\\')
            || (relative != "."
                && relative
                    .split('/')
                    .any(|p| p.is_empty() || p == "." || p == ".."))
        {
            return Err(Error::Invalid("invalid source path".into()));
        }
        let mut path = self.root.clone();
        for component in Path::new(relative).components() {
            path.push(component);
            match fs::symlink_metadata(&path) {
                Ok(metadata) if metadata.file_type().is_symlink() => {
                    return Err(Error::Invalid("unsupported source symlink".into()));
                }
                Ok(_) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => break,
                Err(error) => return Err(error.into()),
            }
        }
        Ok(self.root.join(relative))
    }
}

impl MaterialIo for SourceFiles {
    fn read(&mut self, path: &str) -> Result<Observed> {
        let relative = path;
        let path = self.checked_path(relative)?;
        let mut file = match fs::OpenOptions::new()
            .read(true)
            .custom_flags(libc::O_NONBLOCK | libc::O_NOFOLLOW)
            .open(&path)
        {
            Ok(file) => file,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                return Ok(Observed {
                    bytes: None,
                    identity: "absent".into(),
                    directory_identity: String::new(),
                });
            }
            Err(error) => return Err(error.into()),
        };
        let before = file.metadata()?;
        if !before.is_file() {
            return Err(Error::Invalid("source is not a regular file".into()));
        }
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes)?;
        if identity(&before) != identity(&file.metadata()?)
            || identity(&before) != identity(&fs::metadata(&path)?)
        {
            return Err(Error::Conflict("source changed during acquisition".into()));
        }
        self.checked_path(relative)?;
        Ok(Observed {
            bytes: Some(bytes),
            identity: identity(&before),
            directory_identity: identity(&fs::metadata(path.parent().unwrap_or(Path::new(".")))?),
        })
    }

    fn list(&mut self, path: &str) -> Result<DirectoryObservation> {
        let observed = self.members(path)?;
        Ok(DirectoryObservation {
            identity: observed.identity,
            members: observed.members.into_iter().map(|m| m.name).collect(),
        })
    }

    fn members(&mut self, relative: &str) -> Result<DirectoryMembers> {
        let path = self.checked_path(relative)?;
        let before = fs::symlink_metadata(&path)?;
        if !before.is_dir() {
            return Err(Error::Invalid("source is not a directory".into()));
        }
        let mut members = fs::read_dir(&path)?
            .map(|item| {
                let item = item?;
                let name = item
                    .file_name()
                    .into_string()
                    .map_err(|_| Error::Invalid("non-UTF-8 member".into()))?;
                let kind = item.file_type()?;
                let kind = if kind.is_symlink() {
                    NodeKind::Symlink
                } else if kind.is_dir() {
                    NodeKind::Directory
                } else if kind.is_file() {
                    NodeKind::File
                } else {
                    NodeKind::Special
                };
                Ok(DirectoryNode { name, kind })
            })
            .collect::<Result<Vec<_>>>()?;
        members.sort();
        self.checked_path(relative)?;
        if identity(&before) != identity(&fs::symlink_metadata(&path)?) {
            return Err(Error::Conflict(
                "directory changed during acquisition".into(),
            ));
        }
        Ok(DirectoryMembers {
            identity: identity(&before),
            members,
        })
    }
}

pub struct SourceGit {
    pub root: PathBuf,
}

impl GitIo for SourceGit {
    fn resolve(&mut self, target: &Target) -> Result<GitObservation> {
        let (base, head, index) = match target {
            Target::CommittedRange { base, head } | Target::PhaseRange { base, head, .. } => (
                git::resolve_commit(&self.root, base)?,
                Some(git::resolve_commit(&self.root, head)?),
                None,
            ),
            Target::StagedTree {
                base,
                index,
                head: None,
            } => {
                // The caller supplies the authored tree, which can exclude its
                // own receipts. Do not substitute today's full mutable index.
                let tree = git::object_id(git::run(
                    &self.root,
                    [
                        "rev-parse",
                        "--verify",
                        "--end-of-options",
                        &format!("{index}^{{tree}}"),
                    ],
                )?)?;
                (git::resolve_comparison(&self.root, base)?, None, Some(tree))
            }
            _ => return Err(Error::Invalid("expected resolved Git target".into())),
        };
        let tip = head.as_ref().or(index.as_ref()).expect("Git tip");
        let names = git::run(
            &self.root,
            [
                "diff",
                "--no-ext-diff",
                "--no-textconv",
                "--no-renames",
                "--name-only",
                "-z",
                &base,
                tip,
                "--",
            ],
        )?;
        let paths = names
            .split(|b| *b == 0)
            .filter(|p| !p.is_empty())
            .map(|p| {
                String::from_utf8(p.to_vec())
                    .map_err(|_| Error::Invalid("non-UTF-8 Git path".into()))
            })
            .collect::<Result<Vec<_>>>()?;
        let diff = git::run(
            &self.root,
            [
                "diff",
                "--no-ext-diff",
                "--no-textconv",
                "--find-renames",
                "--binary",
                "--color=never",
                "--src-prefix=a/",
                "--dst-prefix=b/",
                "--output-indicator-new=+",
                "--output-indicator-old=-",
                "--output-indicator-context= ",
                &base,
                tip,
                "--",
            ],
        )?;
        Ok(GitObservation {
            base,
            head,
            index,
            diff,
            paths,
        })
    }

    fn read_object(&mut self, object: &str, path: &str) -> Result<Vec<u8>> {
        let object = git::object_id(object.as_bytes().to_vec())?;
        git::run(
            &self.root,
            ["cat-file", "blob", &format!("{object}:{path}")],
        )
    }
}

pub struct WallClock;
impl Clock for WallClock {
    fn now(&mut self) -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    }
}
