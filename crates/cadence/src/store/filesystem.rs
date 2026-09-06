//! Filesystem work belongs exclusively to the resource-owning writer thread.
use super::{Error, Observed, Result, Storage};
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Stage {
    TemporarySync,
    DirectorySync,
    Confirmation,
}

type Probe = Box<dyn FnMut(Stage, &Path) -> Result<()> + Send>;

pub struct Filesystem {
    root: PathBuf,
    sequence: u64,
    probe: Probe,
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
        if Path::new(target).components().count() != 1 || target == "." || target == ".." {
            return Err(Error::Invalid("expected a store filename".into()));
        }
        Ok(self.root.join(target))
    }
}

impl Storage for Filesystem {
    type Prepared = Prepared;

    fn read(&mut self, target: &str) -> Result<Observed> {
        let target = self.target(target)?;
        let bytes = match fs::read(&target) {
            Ok(bytes) => Some(bytes),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
            Err(error) => return Err(error.into()),
        };
        Ok(Observed {
            bytes,
            identity: String::new(),
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
}
