//! Source acquisition adapters. Retention is supplied separately as Storage.
use super::io::{Clock, DirectoryObservation, GitIo, GitObservation, MaterialIo};
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

impl MaterialIo for SourceFiles {
    fn read(&mut self, path: &str) -> Result<Observed> {
        let path = self.root.join(path);
        let mut file = match fs::OpenOptions::new()
            .read(true)
            .custom_flags(libc::O_NONBLOCK)
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
        Ok(Observed {
            bytes: Some(bytes),
            identity: identity(&before),
            directory_identity: identity(&fs::metadata(path.parent().unwrap_or(Path::new(".")))?),
        })
    }

    fn list(&mut self, path: &str) -> Result<DirectoryObservation> {
        let path = self.root.join(path);
        let before = fs::metadata(&path)?;
        let mut members = fs::read_dir(&path)?
            .map(|item| {
                item?
                    .file_name()
                    .into_string()
                    .map_err(|_| Error::Invalid("non-UTF-8 member".into()))
            })
            .collect::<Result<Vec<_>>>()?;
        members.sort();
        if identity(&before) != identity(&fs::metadata(&path)?) {
            return Err(Error::Conflict(
                "directory changed during acquisition".into(),
            ));
        }
        Ok(DirectoryObservation {
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
