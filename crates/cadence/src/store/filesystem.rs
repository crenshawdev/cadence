//! Filesystem work belongs exclusively to the resource-owning writer thread.
use super::{Error, Observed, Result, Storage};
use std::collections::BTreeMap;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::os::fd::AsRawFd;
use std::os::unix::fs::{MetadataExt, OpenOptionsExt};
use std::path::{Path, PathBuf};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Stage {
    OwnershipAcquired,
    Writing,
    TemporarySync,
    TemporarySynced,
    Prepared,
    Renamed,
    DirectorySync,
    DirectorySynced,
    Confirmation,
    RecoverySync,
}

type Probe = Box<dyn FnMut(Stage, &Path) -> Result<()> + Send>;

#[cfg(test)]
#[derive(Clone, Copy, Default, PartialEq, Eq)]
pub enum OmitSync {
    #[default]
    Neither,
    Temporary,
    Directory,
}

pub struct Filesystem {
    root: PathBuf,
    sequence: u64,
    probe: Probe,
    participants: BTreeMap<String, PathBuf>,
    directories: BTreeMap<PathBuf, Vec<(u64, u64)>>,
    #[cfg(test)]
    omit_sync: OmitSync,
}

pub struct Prepared {
    target: PathBuf,
    temporary: PathBuf,
}

impl Filesystem {
    /// The root is the repository's .planning directory, not the repository.
    pub fn new(root: impl Into<PathBuf>) -> Result<Self> {
        let root: PathBuf = root.into();
        let root = std::path::absolute(root)?;
        ensure_directory(&root)?;
        let directories = [(root.clone(), directory_identity(&root)?)].into();
        Ok(Self {
            root,
            sequence: 0,
            probe: Box::new(|_, _| Ok(())),
            participants: BTreeMap::new(),
            directories,
            #[cfg(test)]
            omit_sync: OmitSync::Neither,
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

    #[cfg(test)]
    pub fn omit_sync_for_test(mut self, omission: OmitSync) -> Self {
        self.omit_sync = omission;
        self
    }

    fn sync_temporary(&self, file: &File) -> Result<()> {
        #[cfg(test)]
        if self.omit_sync == OmitSync::Temporary {
            return Ok(());
        }
        file.sync_all()?;
        Ok(())
    }

    fn sync_directory(&self, parent: &Path) -> Result<()> {
        #[cfg(test)]
        if self.omit_sync == OmitSync::Directory {
            return Ok(());
        }
        File::open(parent)?.sync_all()?;
        Ok(())
    }

    fn target(&self, target: &str) -> Result<PathBuf> {
        if let Some((phase, plan)) = phase_plan_target(target)? {
            return Ok(self.root.join(format!("phases/{phase}/PLAN-{plan}.md")));
        }
        if let Some(phase) = phase_context_target(target)? {
            return Ok(self
                .root
                .join("phases")
                .join(phase.to_string())
                .join("CONTEXT.md"));
        }
        if let Some(path) = self.participants.get(target) {
            return Ok(path.clone());
        }
        if let Some(phase) = phase_summary_target(target)? {
            return Ok(self
                .root
                .join("phases")
                .join(phase.to_string())
                .join("SUMMARY.md"));
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

    /// Participants bind factory-owned paths, never paths from persisted intents.
    pub fn with_participant(mut self, name: &str, path: impl Into<PathBuf>) -> Result<Self> {
        if !matches!(name, "repo-config" | "global-config") {
            return Err(Error::Invalid("unknown config participant".into()));
        }
        let path = path.into();
        if !path.is_absolute() || path.parent().is_none() {
            return Err(Error::Invalid(
                "config participant needs an absolute path and parent".into(),
            ));
        }
        ensure_directory(path.parent().unwrap())?;
        let parent = path.parent().unwrap().to_path_buf();
        let identity = directory_identity(&parent)?;
        if self
            .directories
            .get(&parent)
            .is_some_and(|bound| bound != &identity)
        {
            return Err(Error::Conflict(
                "registered directory identity changed".into(),
            ));
        }
        self.directories.insert(parent, identity);
        self.participants.insert(name.to_string(), path);
        Ok(self)
    }
}

fn directory_identity(path: &Path) -> Result<Vec<(u64, u64)>> {
    path.ancestors()
        .map(|ancestor| {
            let metadata = fs::symlink_metadata(ancestor)?;
            if !metadata.is_dir() || metadata.file_type().is_symlink() {
                return Err(Error::Conflict("unsafe directory identity".into()));
            }
            Ok((metadata.dev(), metadata.ino()))
        })
        .collect()
}

fn ensure_directory(path: &Path) -> Result<()> {
    let absolute = std::path::absolute(path)?;
    let mut directories: Vec<_> = absolute.ancestors().collect();
    directories.reverse();
    for directory in directories {
        match fs::symlink_metadata(directory) {
            Ok(metadata) if metadata.is_dir() && !metadata.file_type().is_symlink() => {}
            Ok(_) => return Err(Error::Conflict("unsafe directory identity".into())),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                match fs::create_dir(directory) {
                    Ok(()) => {}
                    Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
                    Err(error) => return Err(error.into()),
                }
                let file = OpenOptions::new()
                    .read(true)
                    .custom_flags(libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC)
                    .open(directory)?;
                file.sync_all()?;
                if let Some(parent) = directory.parent() {
                    File::open(parent)?.sync_all()?;
                }
                let current = fs::symlink_metadata(directory)?;
                let opened = file.metadata()?;
                if current.dev() != opened.dev() || current.ino() != opened.ino() {
                    return Err(Error::Conflict("directory changed during creation".into()));
                }
            }
            Err(error) => return Err(error.into()),
        }
    }
    Ok(())
}

pub(crate) fn phase_context_target(target: &str) -> Result<Option<u32>> {
    let Some(value) = target.strip_prefix("phase-context:") else {
        return Ok(None);
    };
    phase_summary_target(&format!("phase-summary:{value}"))
}

pub(crate) fn phase_plan_target(target: &str) -> Result<Option<(u32, u32)>> {
    let Some(value) = target.strip_prefix("phase-plan:") else {
        return Ok(None);
    };
    let (phase, plan) = value
        .split_once(':')
        .ok_or_else(|| Error::Invalid("invalid phase-plan target".into()))?;
    let phase = phase_summary_target(&format!("phase-summary:{phase}"))?.unwrap();
    let plan = phase_summary_target(&format!("phase-summary:{plan}"))?.unwrap();
    Ok(Some((phase, plan)))
}

pub(crate) fn phase_summary_target(target: &str) -> Result<Option<u32>> {
    let Some(value) = target.strip_prefix("phase-summary:") else {
        return Ok(None);
    };
    if value.is_empty()
        || value.starts_with('0')
        || !value.bytes().all(|byte| byte.is_ascii_digit())
    {
        return Err(Error::Invalid("invalid phase-summary target".into()));
    }
    let phase = value
        .parse::<u32>()
        .map_err(|_| Error::Invalid("invalid phase-summary target".into()))?;
    if phase == 0 {
        return Err(Error::Invalid("invalid phase-summary target".into()));
    }
    Ok(Some(phase))
}

impl Storage for Filesystem {
    type Prepared = Prepared;

    fn acquire(&mut self) -> Result<Box<dyn Send>> {
        let mut ownership = BTreeMap::new();
        for (path, expected) in &self.directories {
            let directory = OpenOptions::new()
                .read(true)
                .custom_flags(libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC)
                .open(path)?;
            let metadata = directory.metadata()?;
            let identity = (metadata.dev(), metadata.ino());
            if expected.first() != Some(&identity) || directory_identity(path)? != *expected {
                return Err(Error::Conflict(
                    "registered directory identity changed".into(),
                ));
            }
            ownership
                .entry(identity)
                .or_insert((directory, path.clone()));
        }
        for (directory, path) in ownership.values() {
            loop {
                if unsafe { libc::flock(directory.as_raw_fd(), libc::LOCK_EX) } == 0 {
                    break;
                }
                let error = std::io::Error::last_os_error();
                if error.kind() != std::io::ErrorKind::Interrupted {
                    return Err(error.into());
                }
            }
            (self.probe)(Stage::OwnershipAcquired, path)?;
        }
        for (path, expected) in &self.directories {
            if directory_identity(path)? != *expected {
                return Err(Error::Conflict(
                    "registered directory identity changed".into(),
                ));
            }
        }
        Ok(Box::new(ownership))
    }

    fn read(&mut self, target: &str) -> Result<Observed> {
        if let Some(phase) = target.strip_prefix("phase-plan-inventory:") {
            let phase = phase_summary_target(&format!("phase-summary:{phase}"))?.unwrap();
            let inventory = cadence::plan::inventory::read(
                &self.root,
                &phase.to_string(),
                &serde_json::json!({}),
            )
            .map_err(|error| Error::Invalid(error.to_string()))?;
            return Ok(Observed {
                bytes: Some(serde_json::to_vec(&inventory)?),
                identity: inventory.basis,
                directory_identity: String::new(),
            });
        }
        if phase_context_target(target)?.is_some() || phase_plan_target(target)?.is_some() {
            // Only the approved writer path requests this participant. Bind and
            // sync its parents before capturing the expected-file identity.
            if self.directories.get(&self.root) != Some(&directory_identity(&self.root)?) {
                return Err(Error::Conflict("context root directory changed".into()));
            }
            let path = self.target(target)?;
            let parent = path.parent().unwrap();
            ensure_directory(parent)?;
            let identity = directory_identity(parent)?;
            if self
                .directories
                .get(parent)
                .is_some_and(|old| old != &identity)
            {
                return Err(Error::Conflict("context directory changed".into()));
            }
            self.directories.insert(parent.into(), identity);
        }
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
            let middle = bytes.len() / 2;
            file.write_all(&bytes[..middle])?;
            (self.probe)(Stage::Writing, &target)?;
            file.write_all(&bytes[middle..])?;
            (self.probe)(Stage::TemporarySync, &temporary)?;
            self.sync_temporary(&file)?;
            (self.probe)(Stage::TemporarySynced, &target)?;
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
        (self.probe)(Stage::Renamed, &prepared.target)?;
        let parent = prepared.target.parent().unwrap();
        (self.probe)(Stage::DirectorySync, parent)?;
        self.sync_directory(parent)?;
        (self.probe)(Stage::DirectorySynced, &prepared.target)?;
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
        self.sync_directory(parent)?;
        self.confirm(target, bytes)
    }

    fn remove(&mut self, target: &str) -> Result<()> {
        let path = self.target(target)?;
        fs::remove_file(&path)?;
        let parent = path.parent().unwrap();
        (self.probe)(Stage::DirectorySync, parent)?;
        self.sync_directory(parent)?;
        Ok(())
    }
}
