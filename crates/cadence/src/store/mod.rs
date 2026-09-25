pub mod cache;
pub mod decisions;
pub mod filesystem;
pub mod items;
pub mod model;
pub mod transaction;
pub mod writer;

#[cfg(test)]
mod transaction_tests;

#[cfg(test)]
mod writer_tests;

use model::Snapshot;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Error {
    Invalid(String),
    Conflict(String),
    Io(String),
    GitLimit(crate::git_process::Limit),
    Policy(String),
    Closed,
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::GitLimit(limit) => limit.fmt(f),
            _ => write!(f, "{self:?}"),
        }
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

impl From<crate::git_process::Error> for Error {
    fn from(error: crate::git_process::Error) -> Self {
        match error {
            crate::git_process::Error::Limit(limit) => Self::GitLimit(limit),
            crate::git_process::Error::Io(error) => error.into(),
        }
    }
}

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
    fn validate_release(&mut self, _write: &crate::milestone::release::WriteSeal, _replay: bool) -> Result<()> {
        Err(Error::Invalid("storage does not support release bumps".into()))
    }
    fn install_release(&mut self, _write: &crate::milestone::release::WriteSeal) -> Result<()> {
        Err(Error::Invalid("storage does not support release bumps".into()))
    }
    fn validate_undo(&mut self, _write: &crate::undo::model::Write, _replay: bool) -> Result<()> {
        Err(Error::Invalid("storage does not support phase undo".into()))
    }
    fn install_undo(&mut self, _write: &crate::undo::model::Write) -> Result<()> {
        Err(Error::Invalid("storage does not support phase undo".into()))
    }
    fn validate_prune(&mut self, _prune: &crate::milestone::prune::Prune, _replay: bool) -> Result<()> {
        Err(Error::Invalid("storage does not support milestone prune".into()))
    }
    fn install_prune(&mut self, _prune: &crate::milestone::prune::Prune) -> Result<()> {
        Err(Error::Invalid("storage does not support milestone prune".into()))
    }
    fn root(&self) -> Option<&std::path::Path> { None }
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
mod git_limit_tests {
    #[test]
    fn a_git_limit_keeps_its_type_and_names_the_enforced_bound() {
        let error = super::Error::from(crate::git_process::Error::Limit(crate::git_process::Limit {
            command: "git diff --cached".into(),
            bound: std::time::Duration::from_secs(60),
        }));
        assert!(matches!(&error, super::Error::GitLimit(limit)
            if limit.command == "git diff --cached" && limit.bound == std::time::Duration::from_secs(60)));
        assert_eq!(error.to_string(), "git diff --cached exceeded git deadline of 60 seconds");
    }
}
