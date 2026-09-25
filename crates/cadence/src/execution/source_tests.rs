//! What a close's source material has to be, asserted over values.
//!
//! `observe_repository_source` asks Git and judges nothing; `judge_source`
//! judges and asks nothing. These checks build the observation by hand, so
//! none of them starts a program or scripts one. What Git would actually say
//! is not a rule of ours and is not asserted here.
use super::model::ActiveDispatch;
use super::receipts::{SourceObservation, judge_source};
use super::receipts_fixtures::{DONE, GREEN, RED};
use serde_json::json;

const OWNED: &str = "crates/cadence/src/delivery.rs";
const OUTSIDE: &str = "docs/architecture/acceptance.md";
const SUBJECT: &str = "feat(execution): deliver the receipt deliver";

/// A dispatch whose lease covers one file and one directory.
fn dispatch() -> ActiveDispatch {
    serde_json::from_value(json!({
        "schema": 1, "id": "dispatch-1", "expected_execution_version": 0, "phase": 12, "plan": 1,
        "plan_fingerprint": "plan-1", "plan_set_fingerprint": "plans", "requirements": ["truth/A"],
        "tasks": [{"id": "deliver", "verify": []}], "suite": "cargo nextest run",
        "files": [OWNED], "directories": ["crates/cadence/src/execution"],
        "policy": {"rung": "medium", "branch": "current", "reviews": "disabled"},
        "base_sha": RED,
    })).expect("a dispatch record")
}

/// Everything Git would have said about an honest delivery.
fn honest() -> SourceObservation {
    SourceObservation::new()
        .commit(GREEN, &[OWNED])
        .commit(DONE, &[OWNED])
        .signed(true)
        .completion_subject(SUBJECT)
        .staged(b"", &[])
}

fn judged(observation: &SourceObservation) -> crate::store::Result<super::receipts::SourceMaterial> {
    judge_source(&dispatch(), "deliver", DONE, &[GREEN.to_owned()], observation)
}

#[test]
fn a_signed_conventional_completion_inside_the_lease_is_accepted() {
    let material = judged(&honest()).expect("an accepted close");
    assert_eq!(material.completion, DONE);
    assert_eq!(material.evidence_commits, [GREEN]);
    assert_eq!(material.commit_paths[GREEN], [OWNED]);
    assert!(material.out_of_lease.is_empty());
}

// The dispatch base is where the work started, so it cannot also be evidence
// the work produced.
#[test]
fn an_evidence_commit_that_is_the_dispatch_base_is_refused() {
    let observation = honest().commit(RED, &[OWNED]);
    let error = judge_source(&dispatch(), "deliver", DONE, &[RED.to_owned()], &observation).unwrap_err();
    assert!(error.to_string().contains("strictly after the dispatch base"), "{error}");
}

#[test]
fn an_evidence_commit_that_is_not_a_full_object_id_is_refused() {
    let error = judge_source(&dispatch(), "deliver", DONE, &["abc123".to_owned()], &honest()).unwrap_err();
    assert!(error.to_string().contains("strictly after the dispatch base"), "{error}");
}

// These three were what a failed Git call used to mean. Each is now a fact
// that is not there.
#[test]
fn a_commit_git_could_not_read_is_refused() {
    let error = judged(&honest().absent(GREEN)).unwrap_err();
    assert!(error.to_string().contains("reachable from HEAD"), "{error}");
}

#[test]
fn a_commit_that_does_not_come_after_the_dispatch_base_is_refused() {
    let error = judged(&honest().before_the_base(GREEN)).unwrap_err();
    assert!(error.to_string().contains("reachable from HEAD"), "{error}");
}

#[test]
fn a_commit_unreachable_from_head_is_refused() {
    let error = judged(&honest().unreachable(DONE)).unwrap_err();
    assert!(error.to_string().contains("reachable from HEAD"), "{error}");
}

#[test]
fn an_unsigned_completion_is_refused() {
    let error = judged(&honest().signed(false)).unwrap_err();
    assert!(error.to_string().contains("valid signature"), "{error}");
}

// The completion has to name its task in a conventional subject, so the
// history says which task each commit closed.
#[test]
fn a_completion_subject_that_does_not_name_its_task_is_refused() {
    for subject in [
        "feat(execution): ship the receipt",
        "feat(execution): deliverance is at hand",
        "deliver",
        "Deliver(execution): the receipt deliver",
        "feat(execution) deliver the receipt deliver",
        "feat(execution): ",
    ] {
        let error = judged(&honest().completion_subject(subject)).unwrap_err();
        assert!(error.to_string().contains("conventionally"), "{subject}: {error}");
    }
}

#[test]
fn a_conventional_subject_naming_the_task_is_accepted() {
    for subject in [
        "feat(execution): deliver the receipt deliver",
        "fix: repair deliver",
        "refactor(execution)!: move deliver out",
    ] {
        assert!(judged(&honest().completion_subject(subject)).is_ok(), "{subject}");
    }
}

// D-170: the lease is the planner's expectation, not a gate. A commit that
// touched a path outside it is retained as a deviation and the close stands.
#[test]
fn a_commit_touching_a_path_outside_the_lease_is_retained_not_refused() {
    let observation = honest().commit(GREEN, &[OWNED, OUTSIDE]);
    let material = judged(&observation).expect("an out-of-lease commit does not refuse the close");
    assert_eq!(material.out_of_lease[GREEN], [OUTSIDE]);
    assert!(!material.out_of_lease.contains_key(DONE));
}

#[test]
fn a_path_under_a_leased_directory_is_inside_the_lease() {
    let observation = honest().commit(GREEN, &["crates/cadence/src/execution/receipts.rs"]);
    let material = judged(&observation).expect("a leased directory covers its files");
    assert!(material.out_of_lease.is_empty());
}

// Staged work is different: it has not been committed, so an out-of-lease
// staged path is refused rather than retained.
#[test]
fn an_out_of_lease_staged_path_is_refused() {
    let error = judged(&honest().staged(b"raw", &[OUTSIDE])).unwrap_err();
    assert!(error.to_string().contains("out-of-lease staged path"), "{error}");
}

#[test]
fn a_staged_path_inside_the_lease_is_carried_into_the_material() {
    let material = judged(&honest().staged(b"raw", &[OWNED])).expect("a leased staged path");
    assert_eq!(material.staged_paths, [OWNED]);
    assert_eq!(material.staged_objects, b"raw");
}

#[test]
fn a_retained_source_stands_when_a_fresh_observation_finds_the_same_material() {
    let retained = judged(&honest()).expect("an accepted close");
    assert_eq!(super::receipts::source_unchanged(&retained.clone(), &retained), Ok(()));
}

#[test]
fn a_retained_source_is_in_conflict_when_a_fresh_observation_differs() {
    let retained = judged(&honest()).expect("an accepted close");
    let moved = judged(&SourceObservation::new()
        .commit(GREEN, &[OWNED, OUTSIDE])
        .commit(DONE, &[OWNED])
        .signed(true)
        .completion_subject(SUBJECT)
        .staged(b"", &[])).expect("an accepted close");
    let mut staged = retained.clone();
    staged.staged_paths = vec![OWNED.to_owned()];
    for fresh in [moved, staged] {
        assert_eq!(
            super::receipts::source_unchanged(&fresh, &retained),
            Err(crate::store::Error::Conflict("native source or staged inputs changed".into()))
        );
    }
}
