//! Admission is a value decision; filesystem adapters only gather observations.
use std::{fmt, fs, io::{self, Read}, os::unix::fs::MetadataExt, path::Path};

pub const MAX_SOURCE_BYTES: u64 = 16 * 1024 * 1024;
pub const MAX_STORE_BYTES: u64 = 1024 * 1024 * 1024;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Class { Source, Store }

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
pub struct Crossing {
    pub file: String,
    pub size: u64,
    pub bound: u64,
}

impl fmt::Display for Crossing {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: size {} exceeds acquisition bound {}", self.file, self.size, self.bound)
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Action { Read { bound: u64 }, Refuse(Crossing) }

pub fn decide(file: &str, class: Class, size: u64) -> Action {
    let bound = match class { Class::Source => MAX_SOURCE_BYTES, Class::Store => MAX_STORE_BYTES };
    if size > bound { Action::Refuse(Crossing { file: file.into(), size, bound }) }
    else { Action::Read { bound } }
}

pub fn permit(file: &str, class: Class, size: u64) -> Result<u64, Error> {
    match decide(file, class, size) {
        Action::Read { bound } => Ok(bound),
        Action::Refuse(crossing) => Err(Error::Crossing(crossing)),
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Observation {
    pub device: u64,
    pub inode: u64,
    pub size: u64,
    pub mode: u32,
    pub modified: (i64, i64),
    pub changed: (i64, i64),
    pub regular: bool,
}

impl Observation {
    pub fn from_metadata(metadata: &fs::Metadata) -> Self {
        Self { device: metadata.dev(), inode: metadata.ino(), size: metadata.len(),
            mode: metadata.mode(), modified: (metadata.mtime(), metadata.mtime_nsec()),
            changed: (metadata.ctime(), metadata.ctime_nsec()), regular: metadata.is_file() }
    }
}

#[derive(Debug)]
pub enum Error {
    Crossing(Crossing),
    Changed(String),
    NotRegular(String),
    Io(io::Error),
    Store(crate::store::Error),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Crossing(crossing) => crossing.fmt(f),
            Self::Changed(file) => write!(f, "{file}: input changed during acquisition"),
            Self::NotRegular(file) => write!(f, "{file}: input is not a regular file"),
            Self::Io(error) => error.fmt(f),
            Self::Store(error) => error.fmt(f),
        }
    }
}
impl std::error::Error for Error {}
impl From<io::Error> for Error {
    fn from(error: io::Error) -> Self { Self::Io(error) }
}

pub fn store_error(error: Error) -> crate::store::Error {
    match error {
        Error::Crossing(crossing) => crate::store::Error::Invalid(crossing.to_string()),
        Error::Io(error) => error.into(),
        Error::Store(error) => error,
        error @ Error::Changed(_) => crate::store::Error::Conflict(error.to_string()),
        error @ Error::NotRegular(_) => crate::store::Error::Invalid(error.to_string()),
    }
}

pub fn revalidate(file: &str, class: Class, before: &Observation, after: &Observation,
    acquired: u64) -> Result<(), Error>
{
    permit(file, class, before.size)?;
    permit(file, class, after.size)?;
    if !before.regular || !after.regular { return Err(Error::NotRegular(file.into())); }
    if before != after || acquired != after.size { return Err(Error::Changed(file.into())); }
    Ok(())
}

/// Gather with the standard library's capped reader; it owns request sizing.
/// No metadata length is used to reserve a buffer.
pub fn read_opened(path: &Path, file: &mut fs::File, before: &fs::Metadata, class: Class) -> Result<Vec<u8>, Error> {
    let label = path.to_string_lossy();
    let bound = permit(&label, class, before.len())?;
    if !before.is_file() { return Err(Error::NotRegular(label.into_owned())); }
    let before = Observation::from_metadata(before);
    let mut bytes = Vec::new();
    (&mut *file).take(bound).read_to_end(&mut bytes)?;
    let after = Observation::from_metadata(&file.metadata()?);
    revalidate(&label, class, &before, &after, bytes.len() as u64)?;
    let current = Observation::from_metadata(&fs::metadata(path)?);
    revalidate(&label, class, &after, &current, bytes.len() as u64)?;
    Ok(bytes)
}

pub fn read(path: &Path, class: Class) -> Result<Vec<u8>, Error> {
    let label = path.to_string_lossy();
    let before = fs::metadata(path)?;
    permit(&label, class, before.len())?;
    if !before.is_file() { return Err(Error::NotRegular(label.into_owned())); }
    let mut file = fs::File::open(path)?;
    let opened = file.metadata()?;
    revalidate(&label, class, &Observation::from_metadata(&before),
        &Observation::from_metadata(&opened), opened.len())?;
    read_opened(path, &mut file, &opened, class)
}

pub fn text(path: &Path, class: Class) -> Result<String, Error> {
    String::from_utf8(read(path, class)?)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error).into())
}

#[cfg(test)]
mod tests;
