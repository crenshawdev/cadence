//! Filesystem work belongs exclusively to the resource-owning writer thread.
use super::{Error, Observed, Result, Storage};
use std::collections::BTreeMap;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::os::unix::fs::MetadataExt;
use std::path::{Path, PathBuf};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Stage {
    TemporarySync,
    Prepared,
    DirectorySync,
    Confirmation,
    RecoverySync,
}

type Probe = Box<dyn FnMut(Stage, &Path) -> Result<()> + Send>;

pub struct Filesystem {
    root: PathBuf,
    sequence: u64,
    probe: Probe,
    participants: BTreeMap<String, PathBuf>,
}

pub struct Prepared {
    target: PathBuf,
    temporary: PathBuf,
}

impl Filesystem {
    /// The root is the repository's .planning directory, not the repository.
    pub fn new(root: impl Into<PathBuf>) -> Result<Self> {
        let root = root.into();
        fs::create_dir_all(&root)?;
        Ok(Self {
            root,
            sequence: 0,
            probe: Box::new(|_, _| Ok(())),
            participants: BTreeMap::new(),
        })
    }

    /// Injectable I/O observation/failure boundary; normal construction has no hook.
    pub fn with_probe(
        mut self,
        probe: impl FnMut(Stage, &Path) -> Result<()> + Send + 'static,
    ) -> Self {
        self.probe = Box::new(probe);
        self
    }

    fn target(&self, target: &str) -> Result<PathBuf> {
        if let Some(path) = self.participants.get(target) {
            return Ok(path.clone());
        }
        if matches!(target, "repo-config" | "global-config") {
            return Err(Error::Invalid(
                "config participant was not registered".into(),
            ));
        }
        if Path::new(target).components().count() != 1 || target == "." || target == ".." {
            return Err(Error::Invalid("expected a store filename".into()));
        }
        Ok(self.root.join(target))
    }

    /// Config/import participants are registered by the factory, never resolved
    /// from paths supplied by a persisted intent. Their parent must exist.
    pub fn with_participant(mut self, name: &str, path: impl Into<PathBuf>) -> Result<Self> {
        if !matches!(name, "repo-config" | "global-config") {
            return Err(Error::Invalid("unknown config participant".into()));
        }
        let path = path.into();
        if !path.is_absolute() || !path.parent().is_some_and(Path::is_dir) {
            return Err(Error::Invalid(
                "config participant needs an absolute path and existing parent".into(),
            ));
        }
        self.participants.insert(name.to_string(), path);
        Ok(self)
    }
}

impl Storage for Filesystem {
    type Prepared = Prepared;

    fn read(&mut self, target: &str) -> Result<Observed> {
        let target = self.target(target)?;
        let mut identity = String::new();
        for parent in target.parent().unwrap().ancestors() {
            if parent.as_os_str().is_empty() {
                continue;
            }
            let metadata = fs::symlink_metadata(parent)?;
            if !metadata.is_dir() || metadata.file_type().is_symlink() {
                return Err(Error::Conflict(format!(
                    "non-directory or symlink ancestor: {}",
                    parent.display()
                )));
            }
            identity.push_str(&format!("{}:{};", metadata.dev(), metadata.ino()));
        }
        let metadata = match fs::symlink_metadata(&target) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                return Ok(Observed {
                    bytes: None,
                    directory_identity: identity.clone(),
                    identity,
                });
            }
            Err(error) => return Err(error.into()),
        };
        if !metadata.is_file() || metadata.file_type().is_symlink() {
            return Err(Error::Conflict(format!(
                "not an owned regular file: {}",
                target.display()
            )));
        }
        if metadata.mode() & 0o444 == 0 {
            return Err(Error::Io(format!("unreadable file: {}", target.display())));
        }
        let mut file = File::open(&target)?;
        let opened = file.metadata()?;
        if opened.dev() != metadata.dev() || opened.ino() != metadata.ino() {
            return Err(Error::Conflict("file replaced during read".into()));
        }
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes)?;
        let directory_identity = identity.clone();
        identity.push_str(&format!(
            "{}:{}:{}",
            opened.dev(),
            opened.ino(),
            opened.mode()
        ));
        Ok(Observed {
            bytes: Some(bytes),
            identity,
            directory_identity,
        })
    }

    fn prepare(&mut self, target: &str, bytes: &[u8]) -> Result<Prepared> {
        let target = self.target(target)?;
        let (temporary, mut file) = loop {
            self.sequence += 1;
            let temporary = target.with_file_name(format!(
                ".{}.{}.{}.tmp",
                target.file_name().unwrap().to_string_lossy(),
                std::process::id(),
                self.sequence
            ));
            match OpenOptions::new()
                .create_new(true)
                .write(true)
                .open(&temporary)
            {
                Ok(file) => break (temporary, file),
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                Err(error) => return Err(error.into()),
            }
        };
        let result = (|| {
            file.write_all(bytes)?;
            (self.probe)(Stage::TemporarySync, &temporary)?;
            file.sync_all()?;
            (self.probe)(Stage::Prepared, &target)?;
            Ok(())
        })();
        if let Err(error) = result {
            fs::remove_file(&temporary)?;
            return Err(error);
        }
        Ok(Prepared { target, temporary })
    }

    fn install(&mut self, prepared: &Prepared) -> Result<()> {
        fs::rename(&prepared.temporary, &prepared.target)?;
        let parent = prepared.target.parent().unwrap();
        (self.probe)(Stage::DirectorySync, parent)?;
        File::open(parent)?.sync_all()?;
        Ok(())
    }

    fn discard(&mut self, prepared: Prepared) -> Result<()> {
        match fs::remove_file(prepared.temporary) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(error.into()),
        }
    }

    fn confirm(&mut self, target: &str, bytes: &[u8]) -> Result<Observed> {
        let path = self.target(target)?;
        (self.probe)(Stage::Confirmation, &path)?;
        let observed = self.read(target)?;
        if observed.bytes.as_deref() != Some(bytes) {
            return Err(Error::Conflict(format!("installed bytes differ: {target}")));
        }
        Ok(observed)
    }

    fn resync(&mut self, target: &str, bytes: &[u8]) -> Result<Observed> {
        let path = self.target(target)?;
        (self.probe)(Stage::RecoverySync, &path)?;
        File::open(&path)?.sync_all()?;
        let parent = path.parent().unwrap();
        (self.probe)(Stage::DirectorySync, parent)?;
        File::open(parent)?.sync_all()?;
        self.confirm(target, bytes)
    }

    fn remove(&mut self, target: &str) -> Result<()> {
        let path = self.target(target)?;
        fs::remove_file(&path)?;
        let parent = path.parent().unwrap();
        (self.probe)(Stage::DirectorySync, parent)?;
        File::open(parent)?.sync_all()?;
        Ok(())
    }
}
