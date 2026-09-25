use super::{Launch, bounded};
use std::io::Cursor;
use std::path::Path;

#[test]
fn a_launch_carries_its_own_environment_including_removals() {
    let launch = Launch::new("git").cwd(Path::new("/project"))
        .args(["status", "--porcelain"])
        .env("GIT_OPTIONAL_LOCKS", "0")
        .unset("GIT_LITERAL_PATHSPECS");

    assert_eq!(launch.program, "git");
    assert_eq!(launch.args, ["status", "--porcelain"]);
    assert_eq!(launch.cwd.as_deref(), Some(Path::new("/project")));
    assert_eq!(
        launch.env,
        [
            ("GIT_OPTIONAL_LOCKS".to_owned(), Some("0".into())),
            ("GIT_LITERAL_PATHSPECS".to_owned(), None),
        ]
    );
}

#[test]
fn a_stream_longer_than_the_limit_is_cut_and_says_so() {
    let stream = Cursor::new(vec![b'x'; 9_000]);

    let (bytes, complete) = bounded(stream, 8_192).unwrap();

    assert_eq!(bytes.len(), 8_192);
    assert!(!complete, "a cut stream is incomplete");
}

#[test]
fn a_stream_inside_the_limit_is_whole() {
    let stream = Cursor::new(b"test result: ok. 1 passed\n".to_vec());

    let (bytes, complete) = bounded(stream, 8_192).unwrap();

    assert_eq!(bytes, b"test result: ok. 1 passed\n");
    assert!(complete);
}

#[test]
fn git_launches_require_registered_deadlines() {
    use super::validate_launch;
    use crate::git_process::{self, Caller};
    use std::{io::ErrorKind, time::Duration};

    // A literal, absolute path or variable-program git needs registration,
    // even if the generic caller supplied the right numeric timeout.
    for program in ["git", "/usr/bin/git", "./tools/git"] {
        for launch in [Launch::new(program), Launch::new(program).timeout(Duration::from_secs(60)).own_group()] {
            let error = validate_launch(&launch).unwrap_err();
            assert_eq!(error.kind(), ErrorKind::InvalidInput);
            assert_eq!(error.to_string(), "git launch requires a registered caller");
        }
    }
    for timeout in [None, Some(Duration::from_secs(59))] {
        let mut launch = git_process::launch(Caller::PauseRead);
        launch.timeout = timeout;
        let error = validate_launch(&launch).unwrap_err();
        assert_eq!(error.kind(), ErrorKind::InvalidInput);
        assert_eq!(error.to_string(), "registered git launch requires its caller deadline and owned process group");
    }
    let mut guard = git_process::launch(Caller::GuardBranch);
    guard.timeout = Some(Duration::from_secs(10));
    assert!(validate_launch(&guard).is_err(), "the host envelope is not the child deadline");

    let mut launch = git_process::launch(Caller::PauseRead);
    launch.own_group = false;
    assert!(validate_launch(&launch).is_err(), "cleanup ownership cannot be cleared");
    launch.own_group = true;
    launch.program = "sh".into();
    assert!(validate_launch(&launch).is_err(), "a registered descriptor cannot change program class");

    let launch = git_process::launch(Caller::PauseRead).args(["status"]);
    let validated = validate_launch(&launch).unwrap();
    assert_eq!(validated.descriptor().git_caller(), Some(Caller::PauseRead));
    assert_eq!(validated.descriptor().timeout, Some(Duration::from_secs(60)));
    assert_eq!(validated.descriptor().args, ["status"]);
    let guard = git_process::launch(Caller::GuardBranch);
    assert_eq!(validate_launch(&guard).unwrap().descriptor().timeout, Some(Duration::from_secs(9)));
    for program in ["sh", "gpg", "gh"] {
        let launch = Launch::new(program);
        assert_eq!(validate_launch(&launch).unwrap().descriptor(), &launch);
    }
}

#[test]
fn deadline_expiry_requests_cleanup() {
    use super::{DeadlineAction, deadline_action};
    use std::time::Duration;
    assert_eq!(deadline_action(Some(Duration::from_secs(9)), Duration::from_millis(8_999)), DeadlineAction::Wait);
    assert_eq!(deadline_action(Some(Duration::from_secs(9)), Duration::from_secs(9)), DeadlineAction::KillAndReap);
    assert_eq!(deadline_action(Some(Duration::from_secs(60)), Duration::from_secs(60)), DeadlineAction::KillAndReap);
    assert_eq!(deadline_action(None, Duration::from_secs(60)), DeadlineAction::Wait);
}
