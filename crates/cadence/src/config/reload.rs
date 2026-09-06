//! Synchronous config I/O at writer admission and final policy validation.
use super::{Effective, merge, schema};
use cadence::store::{Error, MutationContext, Policy, Result};
use serde_json::Value;
use std::fs;
use std::os::unix::fs::MetadataExt;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};

pub fn identity(path: &Path) -> Result<PathBuf> {
    if path.as_os_str().is_empty() {
        return Err(Error::Invalid("empty config path".into()));
    }
    if let Ok(real) = fs::canonicalize(path) {
        return Ok(real);
    }
    if let (Some(parent), Some(name)) = (path.parent(), path.file_name())
        && let Ok(real) = fs::canonicalize(parent)
    {
        return Ok(real.join(name));
    }
    let absolute = std::path::absolute(path)?;
    let mut normalized = PathBuf::new();
    for part in absolute.components() {
        match part {
            Component::ParentDir => {
                normalized.pop();
            }
            Component::CurDir => {}
            part => normalized.push(part),
        }
    }
    Ok(normalized)
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Input {
    pub identity: PathBuf,
    pub bytes: Option<Vec<u8>>,
    pub stamp: Option<(u64, u64, u32)>,
}

/// Failure injection uses the same boundary as real read errors, not permission
/// bits that a privileged process might ignore.
pub trait ConfigIo: Send + 'static {
    fn read(&mut self, resolved: &Path) -> Result<Input>;
}

pub struct FileIo;
impl ConfigIo for FileIo {
    fn read(&mut self, path: &Path) -> Result<Input> {
        let mut file = match fs::File::open(path) {
            Ok(file) => file,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                return Ok(Input {
                    identity: path.into(),
                    bytes: None,
                    stamp: None,
                });
            }
            Err(e) => return Err(Error::Io(format!("config {}: {e}", path.display()))),
        };
        let metadata = file.metadata()?;
        if !metadata.is_file() {
            return Err(Error::Invalid(format!(
                "config {} is not a file",
                path.display()
            )));
        }
        let mut bytes = Vec::new();
        std::io::Read::read_to_end(&mut file, &mut bytes)?;
        Ok(Input {
            identity: path.into(),
            bytes: Some(bytes),
            stamp: Some((metadata.dev(), metadata.ino(), metadata.mode())),
        })
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Paths {
    pub global: Option<PathBuf>,
    pub repo: PathBuf,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Generation {
    pub number: u64,
    pub global: Option<Input>,
    pub repo: Input,
    pub effective: Effective,
}

pub struct Reload<I: ConfigIo = FileIo> {
    pub paths: Paths,
    io: I,
    current: Option<Generation>,
    number: u64,
}

impl<I: ConfigIo> Reload<I> {
    pub fn new(paths: Paths, io: I) -> Self {
        Self {
            paths,
            io,
            current: None,
            number: 0,
        }
    }

    /// No cached permission is observable after a failed reload. Re-read full
    /// bytes even when size and timestamps match; re-resolve both paths first.
    pub fn refresh(&mut self) -> Result<Generation> {
        let result = self.load();
        if result.is_err() {
            self.current = None;
        }
        result
    }

    fn load(&mut self) -> Result<Generation> {
        let repo_id = identity(&self.paths.repo)?;
        let global_id = self.paths.global.as_deref().map(identity).transpose()?;
        let global = match global_id {
            Some(id) if id != repo_id => Some(self.io.read(&id)?),
            _ => None,
        };
        let repo = self.io.read(&repo_id)?;
        if let Some(cached) = &self.current
            && cached.global == global
            && cached.repo == repo
        {
            return Ok(cached.clone());
        }
        let parse = |input: &Input| -> Result<Option<Value>> {
            input
                .bytes
                .as_deref()
                .map(|bytes| {
                    serde_json::from_slice(bytes).map_err(|e| {
                        Error::Invalid(format!("config {}: {e}", input.identity.display()))
                    })
                })
                .transpose()
        };
        let global_value = global.as_ref().map(parse).transpose()?.flatten();
        let effective = merge::merge(global_value, parse(&repo)?, false);
        validate_effective(&effective)?;
        self.number = self
            .number
            .checked_add(1)
            .ok_or_else(|| Error::Invalid("config generation overflow".into()))?;
        let generation = Generation {
            number: self.number,
            global,
            repo,
            effective,
        };
        self.current = Some(generation.clone());
        Ok(generation)
    }
}

pub fn valid_type(spec: &Value, value: &Value, import: bool) -> bool {
    match spec["type"].as_str() {
        Some("bool") => value.is_boolean(),
        Some("int") => value.as_i64().is_some_and(|n| {
            spec["min"].as_i64().is_none_or(|min| n >= min)
                && spec["max"].as_i64().is_none_or(|max| n <= max)
        }),
        Some("string") => value.is_string(),
        Some("string_or_null") => value.is_null() || value.is_string(),
        Some("enum") => spec["values"]
            .as_array()
            .is_some_and(|values| values.contains(value)),
        Some("array_string") => value
            .as_array()
            .is_some_and(|values| values.iter().all(Value::is_string)),
        Some("array_enum") => {
            (import && value.is_null() && spec["default"].is_null())
                || value.as_array().is_some_and(|values| {
                    values.iter().all(|v| {
                        spec["values"]
                            .as_array()
                            .is_some_and(|allowed| allowed.contains(v))
                    })
                })
        }
        _ => false,
    }
}

pub fn validate_effective(effective: &Effective) -> Result<()> {
    if !effective.diagnostics.invalid_layer.is_empty() {
        return Err(Error::Policy("config unavailable: invalid layer".into()));
    }
    for (key, spec) in schema() {
        if spec["disposition"] == "dead" {
            continue;
        }
        if !merge::get(&effective.values, key).is_some_and(|value| valid_type(spec, value, true)) {
            return Err(Error::Policy(format!("config unavailable: unusable {key}")));
        }
    }
    Ok(())
}

pub type Shared<I = FileIo> = Arc<Mutex<Reload<I>>>;

pub struct ConfigPolicy<I: ConfigIo, F> {
    pub config: Shared<I>,
    pub evaluate: F,
}

impl<I, F> Policy for ConfigPolicy<I, F>
where
    I: ConfigIo,
    F: FnMut(&MutationContext<'_>, &Generation) -> Result<()> + Send + 'static,
{
    fn validate(&mut self, context: &MutationContext<'_>) -> Result<()> {
        let generation = self
            .config
            .lock()
            .map_err(|_| Error::Policy("config unavailable: poisoned reload".into()))?
            .refresh()?;
        (self.evaluate)(context, &generation)
    }
}
