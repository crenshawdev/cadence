//! What a config command decides before and after its I/O: whether it is
//! answered as it stands, only observes, or opens a session, and how a failed
//! command answers.

use cadence::{
    config::{
        Layer, merge,
        interview::{Captured, Entry, Mode},
        reload::{Generation, Input, Paths},
        write::Update,
    },
    config_service::{Apply, Command, Failure, Start, active_layers, config_unavailable, failure, start},
    envelope::Envelope,
    store::Error,
};
use serde_json::json;

fn entry(tokens: &[&str]) -> Command {
    Command::Entry(tokens.iter().map(|token| (*token).to_string()).collect())
}

/// The refusal a start answered with, as (code, reason).
fn refusal(start: Start) -> (String, String) {
    match start {
        Start::Answer(answer) => match *answer {
            Envelope::Refused { code, reason } => (code, reason),
            _ => panic!("not answered with a refusal"),
        },
        _ => panic!("not answered"),
    }
}

fn captured() -> Captured {
    Captured::from_generation(&Generation {
        number: 1,
        global: None,
        repo: Input { identity: "/project/.planning/config.v4.json".into(), bytes: None, stamp: None },
        effective: merge::merge(None, None, false),
    })
}

fn interview(accepted: bool, answers: Option<Vec<Update>>) -> Command {
    Command::Apply(Apply::Interview { mode: Mode::Roles, captured: captured(), accepted, answers })
}

#[test]
fn a_review_entry_is_refused_as_unavailable_before_anything_is_read() {
    for tokens in [&["--review"][..], &["--review", "redetect"][..]] {
        assert_eq!(
            refusal(start(&entry(tokens))),
            (
                "review-setup-unavailable".to_string(),
                "Native live-provider setup is unavailable until the review-delivery phase.".to_string()
            ),
            "{tokens:?}"
        );
    }
}

#[test]
fn an_entry_that_does_not_parse_is_refused_as_invalid_config() {
    assert_eq!(
        refusal(start(&entry(&["no-equals-sign"]))),
        ("invalid-config".to_string(), "Invalid(\"config entry requires key=value tokens\")".to_string())
    );
}

#[test]
fn an_entry_that_parses_opens_the_session_carrying_its_entry() {
    let Start::Session(Some(parsed)) = start(&entry(&["--roles"])) else { panic!("no session") };
    assert!(matches!(parsed, Entry::Roles { mode: Mode::Roles }));
}

#[test]
fn a_declined_or_unanswered_interview_only_observes() {
    let answers = Some(vec![Update { key: "roles.cad-executor.effort".into(), value: json!("low") }]);
    for (accepted, answers) in [(false, answers.clone()), (false, None), (true, None)] {
        assert!(matches!(start(&interview(accepted, answers)), Start::ObserveOnly), "accepted {accepted}");
    }
}

#[test]
fn an_accepted_interview_with_answers_opens_the_session() {
    assert!(matches!(start(&interview(true, Some(vec![]))), Start::Session(None)));
}

#[test]
fn every_other_command_opens_the_session() {
    for command in [
        Command::Facts,
        Command::Interview(Mode::Global),
        Command::Apply(Apply::Batch { layer: Layer::Repo, updates: vec![] }),
    ] {
        assert!(matches!(start(&command), Start::Session(None)));
    }
}

fn refused(failure: Failure) -> (String, String) {
    match failure {
        Failure::Refused(answer) => match *answer {
            Envelope::Refused { code, reason } => (code, reason),
            _ => panic!("not a refusal"),
        },
        _ => panic!("not refused"),
    }
}

#[test]
fn an_invalid_request_or_a_conflict_is_refused_with_its_reason() {
    assert_eq!(refused(failure(Error::Invalid("bad key".into()))), ("invalid-config".into(), "bad key".into()));
    assert_eq!(refused(failure(Error::Conflict("moved".into()))), ("config-conflict".into(), "moved".into()));
}

#[test]
fn a_policy_failure_means_the_config_is_unavailable() {
    assert!(matches!(failure(Error::Policy("unreadable".into())), Failure::Unavailable(reason) if reason == "unreadable"));
}

#[test]
fn any_other_error_fails_the_call() {
    assert!(matches!(failure(Error::Io("disk".into())), Failure::Error(Error::Io(reason)) if reason == "disk"));
}

#[test]
fn an_unavailable_config_names_both_active_files_for_repair() {
    let paths = Paths { repo: "/p/config.v4.json".into(), global: Some("/g/config.v4.json".into()) };
    let Envelope::Refused { code, reason } = config_unavailable(&"unreadable", &active_layers(&paths)) else {
        panic!("not refused")
    };
    assert_eq!(
        (code.as_str(), reason.as_str()),
        (
            "config-unavailable",
            "unreadable; active layers (repo: /p/config.v4.json; global: /g/config.v4.json); repair the named active file before retrying"
        )
    );
}

#[test]
fn a_missing_global_file_is_named_unavailable() {
    let paths = Paths { repo: "/p/config.v4.json".into(), global: None };
    assert_eq!(active_layers(&paths), "repo: /p/config.v4.json; global: unavailable");
}
