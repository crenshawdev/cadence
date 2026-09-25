//! What `validate_pairs` refuses, asserted over values.
//!
//! Every fact this judgment needs about the repository arrives as a value in
//! `RepositoryFacts`, gathered by `observe_pairs` before the judging starts.
//! So no test here starts a program, fakes one, or scripts an answer for the
//! code to agree with: each one builds the records and the facts, asks the
//! validator, and reads the refusal. A check that had to be told what Git
//! would say could not fail, and would measure nothing.
use super::receipts_fixtures::*;
use super::receipts::{RepositoryFacts, validate_pairs};
use super::history::{Event, Record};
use super::receipts::{Close, Disposition, Observation, Summary, Stage};
use serde_json::Value;

/// The checks a refusal named, or None when the close was accepted.
fn refused(data: &Value, records: &[Record], close: &Close, facts: &RepositoryFacts) -> Option<Vec<String>> {
    let error = validate_pairs(data, records, close, facts).err()?;
    let crate::store::Error::Invalid(payload) = &error else { panic!("an invalid-shaped refusal: {error}") };
    let parsed: Value = serde_json::from_str(payload.trim_start_matches("native-task-refusal:")).expect("a refusal envelope");
    assert_eq!(parsed["rule"], "red-green", "{parsed}");
    Some(parsed["details"]["unsatisfied"].as_array().expect("unsatisfied checks")
        .iter().map(|check| check["id"].as_str().expect("a check id").to_owned()).collect())
}

/// The control the other tests are read against: with the records and the
/// repository facts agreeing, the close is accepted.
#[test]
fn an_observed_red_then_green_at_unchanged_material_closes() {
    assert_eq!(refused(&allocating(&["check/A"]), &honest_records("check/A"), &close(vec![pair("check/A")]), &honest_facts()), None);
}

#[test]
fn a_close_offering_no_pairs_names_every_allocated_check() {
    assert_eq!(
        refused(&allocating(&["check/A", "check/A2"]), &honest_records("check/A"), &close(Vec::new()), &honest_facts()),
        Some(vec!["check/A".to_owned(), "check/A2".to_owned()])
    );
}

#[test]
fn offering_one_of_two_allocated_checks_names_the_missing_one() {
    assert_eq!(
        refused(&allocating(&["check/A", "check/A2"]), &honest_records("check/A"), &close(vec![pair("check/A")]), &honest_facts()),
        Some(vec!["check/A2".to_owned()])
    );
}

#[test]
fn a_pair_for_a_check_that_was_never_allocated_names_every_allocated_check() {
    assert_eq!(
        refused(&allocating(&["check/A"]), &honest_records("check/A"), &close(vec![pair("check/other")]), &honest_facts()),
        Some(vec!["check/A".to_owned()])
    );
}

#[test]
fn a_pair_whose_red_and_green_are_the_same_commit_is_refused() {
    let mut close = close(vec![pair("check/A")]);
    close.checks[0].green_commit = RED.into();
    assert_eq!(refused(&allocating(&["check/A"]), &honest_records("check/A"), &close, &honest_facts()), Some(vec!["check/A".to_owned()]));
}

#[test]
fn an_empty_commit_identifier_is_refused() {
    for empty_red in [true, false] {
        let mut close = close(vec![pair("check/A")]);
        if empty_red { close.checks[0].red_commit.clear() } else { close.checks[0].green_commit.clear() }
        assert_eq!(
            refused(&allocating(&["check/A"]), &honest_records("check/A"), &close, &honest_facts()),
            Some(vec!["check/A".to_owned()]), "empty red: {empty_red}"
        );
    }
}

#[test]
fn a_run_identifier_that_was_never_recorded_is_refused() {
    let mut close = close(vec![pair("check/A")]);
    close.checks[0].red_run = "never-recorded".into();
    assert_eq!(refused(&allocating(&["check/A"]), &honest_records("check/A"), &close, &honest_facts()), Some(vec!["check/A".to_owned()]));
}

#[test]
fn a_pair_naming_the_green_run_as_its_red_is_refused() {
    let mut close = close(vec![pair("check/A")]);
    close.checks[0].red_run = "green-check/A".into();
    close.checks[0].red_commit = GREEN.into();
    assert_eq!(refused(&allocating(&["check/A"]), &honest_records("check/A"), &close, &honest_facts()), Some(vec!["check/A".to_owned()]));
}

#[test]
fn a_stale_item_revision_on_the_pair_is_refused() {
    let mut close = close(vec![pair("check/A")]);
    close.checks[0].check.item_revision = "revision-0".into();
    assert_eq!(refused(&allocating(&["check/A"]), &honest_records("check/A"), &close, &honest_facts()), Some(vec!["check/A".to_owned()]));
}

// The red has to have been observed before the green was launched. A green
// recorded first is a pair assembled after the fact, not a repair observed.
#[test]
fn a_red_observed_after_the_green_was_launched_is_refused() {
    let mut records = honest_records("check/A");
    let Event::Result(red) = &mut records[2].request.event else { panic!("the red result") };
    red.observed_at = 31;
    assert_eq!(refused(&allocating(&["check/A"]), &records, &close(vec![pair("check/A")]), &honest_facts()), Some(vec!["check/A".to_owned()]));
}

// A run whose source moved under it saw something else than what it reports.
#[test]
fn a_run_recorded_over_changed_material_is_refused() {
    let mut records = honest_records("check/A");
    let Event::Result(green) = &mut records[4].request.event else { panic!("the green result") };
    green.material_unchanged = false;
    assert_eq!(refused(&allocating(&["check/A"]), &records, &close(vec![pair("check/A")]), &honest_facts()), Some(vec!["check/A".to_owned()]));
}

// A red that passed is not a red, whatever the pair calls it.
#[test]
fn a_red_run_that_exited_zero_is_refused() {
    let mut records = honest_records("check/A");
    let Event::Result(red) = &mut records[2].request.event else { panic!("the red result") };
    red.disposition = Disposition::Exited { code: 0 };
    red.observation = Observation::ResultsObserved { summary: Summary::Cargo { failed: false } };
    assert_eq!(refused(&allocating(&["check/A"]), &records, &close(vec![pair("check/A")]), &honest_facts()), Some(vec!["check/A".to_owned()]));
}

// The two runs must have exercised the same test with the same command, or
// the green is evidence about something the red never asserted.
#[test]
fn a_green_run_of_a_different_command_is_refused() {
    let mut records = honest_records("check/A");
    let Event::Launch(green) = &mut records[3].request.event else { panic!("the green launch") };
    green.material.command = "cargo nextest run something-else".into();
    assert_eq!(refused(&allocating(&["check/A"]), &records, &close(vec![pair("check/A")]), &honest_facts()), Some(vec!["check/A".to_owned()]));
}

// These four were the cases that used to need a scripted Git answer. Each is
// now the absence or the contradiction of a gathered fact.
#[test]
fn a_red_that_is_not_an_ancestor_of_the_green_is_refused() {
    let facts = RepositoryFacts::new()
        .ancestor(GREEN, DONE)
        .blob(RED, TEST_FILE, TEST_DIGEST).blob(GREEN, TEST_FILE, TEST_DIGEST).blob(DONE, TEST_FILE, TEST_DIGEST)
        .tree(RED, RED_TREE).tree(GREEN, GREEN_TREE);
    assert_eq!(refused(&allocating(&["check/A"]), &honest_records("check/A"), &close(vec![pair("check/A")]), &facts), Some(vec!["check/A".to_owned()]));
}

#[test]
fn a_green_that_is_not_an_ancestor_of_the_completion_is_refused() {
    let facts = RepositoryFacts::new()
        .ancestor(RED, GREEN)
        .blob(RED, TEST_FILE, TEST_DIGEST).blob(GREEN, TEST_FILE, TEST_DIGEST).blob(DONE, TEST_FILE, TEST_DIGEST)
        .tree(RED, RED_TREE).tree(GREEN, GREEN_TREE);
    assert_eq!(refused(&allocating(&["check/A"]), &honest_records("check/A"), &close(vec![pair("check/A")]), &facts), Some(vec!["check/A".to_owned()]));
}

#[test]
fn committed_test_material_that_changed_between_red_and_green_is_refused() {
    let facts = honest_facts().blob(GREEN, TEST_FILE, "a-different-test");
    assert_eq!(refused(&allocating(&["check/A"]), &honest_records("check/A"), &close(vec![pair("check/A")]), &facts), Some(vec!["check/A".to_owned()]));
}

#[test]
fn committed_test_material_that_changed_by_the_completion_is_refused() {
    let facts = honest_facts().blob(DONE, TEST_FILE, "a-different-test");
    assert_eq!(refused(&allocating(&["check/A"]), &honest_records("check/A"), &close(vec![pair("check/A")]), &facts), Some(vec!["check/A".to_owned()]));
}

// An unresolvable commit answers nothing at all, which is not the same as
// answering something that disagrees. Both invalidate the pair.
#[test]
fn a_commit_git_could_not_resolve_is_refused() {
    let facts = RepositoryFacts::new().ancestor(RED, GREEN).ancestor(GREEN, DONE)
        .blob(GREEN, TEST_FILE, TEST_DIGEST).blob(DONE, TEST_FILE, TEST_DIGEST).tree(GREEN, GREEN_TREE);
    assert_eq!(refused(&allocating(&["check/A"]), &honest_records("check/A"), &close(vec![pair("check/A")]), &facts), Some(vec!["check/A".to_owned()]));
}

#[test]
fn a_tree_that_does_not_match_the_recorded_one_is_refused() {
    let facts = honest_facts().tree(RED, "some-other-tree");
    assert_eq!(refused(&allocating(&["check/A"]), &honest_records("check/A"), &close(vec![pair("check/A")]), &facts), Some(vec!["check/A".to_owned()]));
}

// A task that stopped at a checkpoint resumes in a successor attempt naming
// its predecessor. Its red stays where it was recorded, and the close pairs
// it with a green from the successor.
#[test]
fn a_resumed_attempt_closes_on_its_predecessors_red() {
    let mut records = honest_records("check/A");
    records.push(record("resumed", "start-resumed", Event::Attempt {
        predecessor: Some("attempt".into()),
        checks: vec![check("check/A")],
        base_commit: RED.into(),
    }));
    records.push(launch("resumed", "green-resumed", "check/A", Stage::Green, GREEN, GREEN_TREE, 50));
    records.push(result("resumed", "green-resumed", 0, 60));
    let mut close = close(vec![pair("check/A")]);
    close.attempt = "resumed".into();
    close.checks[0].green_run = "green-resumed".into();
    assert_eq!(refused(&allocating(&["check/A"]), &records, &close, &honest_facts()), None);
}

// Without that predecessor the same close has no red in its own attempt.
#[test]
fn an_attempt_that_names_no_predecessor_cannot_reach_an_earlier_red() {
    let mut records = honest_records("check/A");
    records.push(record("resumed", "start-resumed", Event::Attempt {
        predecessor: None,
        checks: vec![check("check/A")],
        base_commit: RED.into(),
    }));
    records.push(launch("resumed", "green-resumed", "check/A", Stage::Green, GREEN, GREEN_TREE, 50));
    records.push(result("resumed", "green-resumed", 0, 60));
    let mut close = close(vec![pair("check/A")]);
    close.attempt = "resumed".into();
    close.checks[0].green_run = "green-resumed".into();
    assert_eq!(refused(&allocating(&["check/A"]), &records, &close, &honest_facts()), Some(vec!["check/A".to_owned()]));
}

// A lineage that names itself as its own predecessor terminates rather than
// walking forever.
#[test]
fn a_lineage_that_loops_back_on_itself_terminates() {
    let mut records = honest_records("check/A");
    records[0] = record("attempt", "start-check/A", Event::Attempt {
        predecessor: Some("attempt".into()),
        checks: vec![check("check/A")],
        base_commit: RED.into(),
    });
    assert_eq!(refused(&allocating(&["check/A"]), &records, &close(vec![pair("check/A")]), &honest_facts()), None);
}
