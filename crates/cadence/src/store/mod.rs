pub mod decisions;
pub mod filesystem;
pub mod items;
pub mod model;
pub mod transaction;
pub mod writer;

use model::Snapshot;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Error {
    Invalid(String),
    Conflict(String),
    Io(String),
    Policy(String),
    Closed,
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{self:?}")
    }
}
impl std::error::Error for Error {}
impl From<serde_json::Error> for Error {
    fn from(error: serde_json::Error) -> Self {
        Self::Invalid(error.to_string())
    }
}
impl From<std::io::Error> for Error {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error.to_string())
    }
}
pub type Result<T> = std::result::Result<T, Error>;

/// Domain inputs only: policy implementations must reload their authoritative
/// inputs on every call. There is deliberately no default permission provider.
pub struct MutationContext<'a> {
    pub operation: &'a str,
    pub snapshot: &'a Snapshot,
}
pub trait Policy: Send + 'static {
    fn validate(&mut self, context: &MutationContext<'_>) -> Result<()>;
    fn validate_routing_admission(
        &mut self,
        context: &MutationContext<'_>,
        _inputs: &cadence::execution::model::ConfigInputs,
    ) -> Result<()> {
        self.validate(context)
    }
}

/// Adapter-owned identity tokens have no filesystem semantics in the core.
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct Observed {
    pub bytes: Option<Vec<u8>>,
    pub identity: String,
    pub directory_identity: String,
}

/// Preparation is disposable; install must synchronize file then directory,
/// and confirm must check the installed bytes before the writer acknowledges.
pub trait Storage: Send + 'static {
    type Prepared;
    /// Hold root and registered shared-parent ownership until the guard is dropped.
    /// In-memory adapters already have one owner and need no additional lock.
    fn acquire(&mut self) -> Result<Box<dyn Send>> {
        Ok(Box::new(()))
    }
    fn read(&mut self, target: &str) -> Result<Observed>;
    fn prepare(&mut self, target: &str, bytes: &[u8]) -> Result<Self::Prepared>;
    fn install(&mut self, prepared: &Self::Prepared) -> Result<()>;
    fn discard(&mut self, prepared: Self::Prepared) -> Result<()>;
    fn confirm(&mut self, target: &str, bytes: &[u8]) -> Result<Observed>;
    fn resync(&mut self, target: &str, bytes: &[u8]) -> Result<Observed>;
    fn remove(&mut self, target: &str) -> Result<()>;
}

#[cfg(test)]
mod crash_tests;
