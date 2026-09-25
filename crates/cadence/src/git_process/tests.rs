use super::{Caller, Error, deadline, finish, launch};
use crate::process::Output;
use std::{ffi::OsString, io, time::Duration};

#[test]
fn git_subprocesses_run_under_a_deadline() {
    let rows: &[(Caller, &[&str], &str, u64)] = &[
        (Caller::GuardBranch, &["symbolic-ref", "--quiet", "--short", "HEAD"], "git symbolic-ref --quiet --short HEAD", 9),
        (Caller::ExecutionOutput, &["show", "HEAD"], "git show HEAD", 60),
        (Caller::ExecutionStatus, &["diff", "--quiet"], "git diff --quiet", 60),
        (Caller::PauseRead, &["status", "--porcelain"], "git status --porcelain", 60),
        (Caller::PauseIndex, &["write-tree"], "git write-tree", 60),
        (Caller::WhyRead, &["log", "--", "a.rs"], "git log -- a.rs", 60),
        (Caller::WhyInput, &["cat-file", "--batch-check"], "git cat-file --batch-check", 60),
        (Caller::ExecutionRunner, &["rev-parse", "HEAD"], "git rev-parse HEAD", 60),
        (Caller::PauseMergeBase, &["merge-base", "base", "head"], "git merge-base base head", 60),
        (Caller::RailRead, &["diff", "--cached"], "git diff --cached", 60),
        (Caller::RailCommitInput, &["hash-object", "-w", "--stdin"], "git hash-object -w --stdin", 60),
        (Caller::RailConfig, &["config", "--get", "user.name"], "git config --get user.name", 60),
        (Caller::RecallHistory, &["cat-file", "-s", "HEAD:a.rs"], "git cat-file -s HEAD:a.rs", 60),
        (Caller::ReadDocumentHead, &["rev-parse", "HEAD"], "git rev-parse HEAD", 60),
        (Caller::LandingGit, &["fetch", "origin"], "git fetch origin", 60),
    ];
    for &(caller, args, command, seconds) in rows {
        let args: Vec<OsString> = args.iter().map(OsString::from).collect();
        let error = finish(caller, &args, Err(io::ErrorKind::TimedOut.into())).unwrap_err();
        let Error::Limit(limit) = error else { panic!("{caller:?}: expected named limit, got {error}"); };
        assert_eq!(limit.command, command);
        assert_eq!(limit.bound, Duration::from_secs(seconds));
        assert_eq!(limit.to_string(), format!("{command} exceeded git deadline of {seconds} seconds"));
    }
    let args = [OsString::from("status")];
    for output in [Output::exited(0, "kept", "notice"), Output::exited(128, "", "ordinary failure"), Output::signaled(9)] {
        assert_eq!(finish(Caller::PauseRead, &args, Ok(output.clone())).unwrap(), output);
    }
    assert!(matches!(
        finish(Caller::PauseRead, &args, Err(io::ErrorKind::PermissionDenied.into())),
        Err(Error::Io(error)) if error.kind() == io::ErrorKind::PermissionDenied
    ));
}

#[test]
fn registered_callers_select_their_deadlines() {
    for (caller, nominal, work) in [
        (Caller::GuardBranch, 10, 9),
        (Caller::ExecutionOutput, 60, 60),
        (Caller::ExecutionStatus, 60, 60),
        (Caller::PauseRead, 60, 60),
        (Caller::PauseIndex, 60, 60),
        (Caller::WhyRead, 60, 60),
        (Caller::WhyInput, 60, 60),
        (Caller::ExecutionRunner, 60, 60),
        (Caller::PauseMergeBase, 60, 60),
        (Caller::RailRead, 60, 60),
        (Caller::RailCommitInput, 60, 60),
        (Caller::RailConfig, 60, 60),
        (Caller::RecallHistory, 60, 60),
        (Caller::ReadDocumentHead, 60, 60),
        (Caller::LandingGit, 60, 60),
    ] {
        assert_eq!(deadline(caller).nominal, Duration::from_secs(nominal), "{caller:?}");
        assert_eq!(deadline(caller).work, Duration::from_secs(work), "{caller:?}");
        let launch = launch(caller);
        assert_eq!(launch.timeout, Some(Duration::from_secs(work)), "{caller:?}");
        assert!(launch.own_group);
        assert!(!launch.inherit);
        assert!(!launch.die_with_parent);
        assert_eq!(launch.limit, usize::MAX);
    }
}
