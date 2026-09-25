//! Registered git deadlines and interpretation of process observations.

use crate::process::{Launch, Output, Process};
use std::{ffi::OsString, fmt, io, time::Duration};

pub const GUARD_GIT_DEADLINE: Duration = Duration::from_secs(10);
pub const OTHER_GIT_DEADLINE: Duration = Duration::from_secs(60);
pub const GUARD_REAP_RESERVE: Duration = Duration::from_secs(1);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Caller {
    ExecutionOutput,
    ExecutionStatus,
    PauseRead,
    PauseIndex,
    WhyRead,
    WhyInput,
    ExecutionRunner,
    PauseMergeBase,
    RailRead,
    GuardBranch,
    RailCommitInput,
    RailConfig,
    RecallHistory,
    ReadDocumentHead,
    LandingGit,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Registration(Caller);

impl Registration {
    pub(crate) fn caller(&self) -> Caller { self.0 }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Deadline {
    pub nominal: Duration,
    pub work: Duration,
}

pub fn deadline(caller: Caller) -> Deadline {
    match caller {
        Caller::GuardBranch => Deadline {
            nominal: GUARD_GIT_DEADLINE,
            work: GUARD_GIT_DEADLINE - GUARD_REAP_RESERVE,
        },
        Caller::ExecutionOutput | Caller::ExecutionStatus | Caller::PauseRead
        | Caller::PauseIndex | Caller::WhyRead | Caller::WhyInput | Caller::ExecutionRunner
        | Caller::PauseMergeBase | Caller::RailRead | Caller::RailCommitInput | Caller::RailConfig
        | Caller::RecallHistory | Caller::ReadDocumentHead | Caller::LandingGit => Deadline {
            nominal: OTHER_GIT_DEADLINE,
            work: OTHER_GIT_DEADLINE,
        },
    }
}

pub fn launch(caller: Caller) -> Launch {
    Launch::registered_git(Registration(caller)).timeout(deadline(caller).work).own_group()
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Limit {
    pub command: String,
    pub bound: Duration,
}

impl fmt::Display for Limit {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} exceeded git deadline of {} seconds", self.command, self.bound.as_secs())
    }
}

#[derive(Debug)]
pub enum Error {
    Limit(Limit),
    Io(io::Error),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Limit(limit) => limit.fmt(f),
            Self::Io(error) => error.fmt(f),
        }
    }
}

impl std::error::Error for Error {}

/// Interpret one completion; only an explicit timeout observation is a limit.
pub fn finish(caller: Caller, args: &[OsString], answer: io::Result<Output>) -> Result<Output, Error> {
    answer.map_err(|error| {
        if error.kind() == io::ErrorKind::TimedOut {
            Error::Limit(Limit {
                command: format!("git {}", args.iter().map(|arg| arg.to_string_lossy()).collect::<Vec<_>>().join(" ")),
                bound: deadline(caller).work,
            })
        } else {
            Error::Io(error)
        }
    })
}

pub fn run(launch: &Launch, process: &mut dyn Process) -> Result<Output, Error> {
    let caller = launch.git_caller().ok_or_else(|| Error::Io(io::Error::new(
        io::ErrorKind::InvalidInput, "git launch requires a registered caller",
    )))?;
    finish(caller, &launch.args, process.run(launch))
}

#[cfg(test)]
mod tests;
