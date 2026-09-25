//! What the owner's inspection has to be before it attests a pair.
//!
//! These units already take nothing but values: no repository, no store, no
//! clock. So every check here builds the records and the statement by hand and
//! reads the answer. Nothing is faked, because nothing is asked of the world.
use super::receipts_fixtures::*;
use super::history::{Event, Record};
use super::receipts::{
    Inspection, OwnerApproval, OwnerStatement, missing_owner_inspections, owner_eligible,
    validate_approval, validate_inspection,
};
use serde_json::Value;

/// The inspection an owner signs after looking at both runs of a pair.
fn inspection(id: &str) -> Inspection {
    Inspection {
        check: check(id),
        test_digest: TEST_DIGEST.into(),
        evidence: vec![format!("red-{id}"), format!("green-{id}")],
        no_subject_stub: true,
    }
}

fn statement(id: &str) -> OwnerStatement {
    let inspection = inspection(id);
    OwnerStatement {
        approval: OwnerApproval {
            approved: true,
            owner: "Fixture Owner".into(),
            at: "2026-09-22T14:00:00Z".into(),
            submission: inspection.clone(),
        },
        submission: inspection,
        supersedes: None,
    }
}

/// An attested delivery: the honest records, plus the owner's statement about
/// them recorded before the close.
fn attested(id: &str, statement: OwnerStatement) -> Vec<Record> {
    let mut records = honest_records(id);
    records.push(record("attempt", &format!("attest-{id}"), Event::OwnerStatement(statement)));
    records
}

/// The checks plan completion would still be waiting on.
fn missing(records: &[Record], data: &Value, pairs: &[&str]) -> Vec<String> {
    let close = close(pairs.iter().map(|id| pair(id)).collect());
    missing_owner_inspections(data, records, &close)
        .expect("an allocation to read")
        .into_iter()
        .map(|check| check.id)
        .collect()
}

#[test]
fn an_approval_must_be_affirmative_attributed_timed_and_exact() {
    let statement = statement("check/A");
    assert!(validate_approval(&statement.submission, &statement.approval));

    for (case, spoil) in [
        ("not approved", 0),
        ("no owner named", 1),
        ("no time recorded", 2),
        ("echoes a different payload", 3),
    ] {
        let mut statement = statement.clone();
        match spoil {
            0 => statement.approval.approved = false,
            1 => statement.approval.owner = "   ".into(),
            2 => statement.approval.at.clear(),
            _ => statement.approval.submission.test_digest = "some-other-material".into(),
        }
        assert!(!validate_approval(&statement.submission, &statement.approval), "{case}");
    }
}

#[test]
fn an_inspection_of_the_recorded_runs_is_accepted() {
    assert!(validate_inspection(&honest_records("check/A"), &task(), &statement("check/A")).is_ok());
}

#[test]
fn an_inspection_whose_approval_does_not_echo_it_is_refused() {
    let mut statement = statement("check/A");
    statement.approval.submission.evidence = vec!["red-check/A".into()];
    assert!(validate_inspection(&honest_records("check/A"), &task(), &statement).is_err());
}

#[test]
fn an_inspection_without_material_or_evidence_is_refused() {
    for drop_evidence in [true, false] {
        let mut statement = statement("check/A");
        if drop_evidence { statement.submission.evidence.clear() } else { statement.submission.test_digest.clear() }
        statement.approval.submission = statement.submission.clone();
        assert!(validate_inspection(&honest_records("check/A"), &task(), &statement).is_err(), "dropped evidence: {drop_evidence}");
    }
}

// Naming the same run twice reads as two inspections when it is one, so the
// statement cannot say how much was actually looked at.
#[test]
fn an_inspection_naming_the_same_run_twice_is_refused() {
    let mut statement = statement("check/A");
    statement.submission.evidence = vec!["red-check/A".into(), "red-check/A".into()];
    statement.approval.submission = statement.submission.clone();
    assert!(validate_inspection(&honest_records("check/A"), &task(), &statement).is_err());
}

#[test]
fn an_inspection_of_a_run_that_was_never_launched_is_refused() {
    let mut statement = statement("check/A");
    statement.submission.evidence = vec!["red-check/A".into(), "never-launched".into()];
    statement.approval.submission = statement.submission.clone();
    assert!(validate_inspection(&honest_records("check/A"), &task(), &statement).is_err());
}

// The run has to have been launched for this check, at the material the owner
// says they inspected.
#[test]
fn an_inspection_whose_run_belongs_to_another_check_is_refused() {
    let mut records = honest_records("check/A");
    let Event::Launch(red) = &mut records[1].request.event else { panic!("the red launch") };
    red.check = Some(check("check/A2"));
    assert!(validate_inspection(&records, &task(), &statement("check/A")).is_err());
}

#[test]
fn an_inspection_of_material_that_has_since_changed_is_refused() {
    let mut statement = statement("check/A");
    statement.submission.test_digest = "material-the-runs-never-saw".into();
    statement.approval.submission = statement.submission.clone();
    assert!(validate_inspection(&honest_records("check/A"), &task(), &statement).is_err());
}

// A launch with no result is a run nobody watched finish, so there is nothing
// for an owner to have inspected.
#[test]
fn an_inspection_of_a_launch_with_no_result_is_refused() {
    let mut records = honest_records("check/A");
    records.retain(|r| !matches!(&r.request.event, Event::Result(result) if result.run_id == "green-check/A"));
    assert!(validate_inspection(&records, &task(), &statement("check/A")).is_err());
}

#[test]
fn a_statement_superseding_one_that_was_never_recorded_is_refused() {
    let mut statement = statement("check/A");
    statement.supersedes = Some("no-such-statement".into());
    assert!(validate_inspection(&honest_records("check/A"), &task(), &statement).is_err());
}

#[test]
fn a_statement_supersedes_an_earlier_one_for_the_same_check() {
    let first = statement("check/A");
    let mut records = honest_records("check/A");
    records.push(record("attempt", "first-statement", Event::OwnerStatement(first)));
    let mut second = statement("check/A");
    second.supersedes = Some("first-statement".into());
    assert!(validate_inspection(&records, &task(), &second).is_ok());
}

// Eligibility is exact on all four counts, so a statement about the right
// check at the wrong material, or over different runs, does not carry over.
#[test]
fn eligibility_requires_the_exact_check_material_and_runs() {
    let statement = statement("check/A");
    let evidence = ["red-check/A".to_owned(), "green-check/A".to_owned()];
    assert!(owner_eligible(&statement, &check("check/A"), TEST_DIGEST, &evidence));
    assert!(!owner_eligible(&statement, &check("check/A2"), TEST_DIGEST, &evidence));
    assert!(!owner_eligible(&statement, &check("check/A"), "other-material", &evidence));
    assert!(!owner_eligible(&statement, &check("check/A"), TEST_DIGEST, &["red-check/A".to_owned()]));
}

// An inspection that reports a subject stub is honest about having nothing to
// judge, and it does not attest.
#[test]
fn an_inspection_reporting_a_subject_stub_does_not_attest() {
    let mut statement = statement("check/A");
    statement.submission.no_subject_stub = false;
    statement.approval.submission = statement.submission.clone();
    let evidence = ["red-check/A".to_owned(), "green-check/A".to_owned()];
    assert!(!owner_eligible(&statement, &check("check/A"), TEST_DIGEST, &evidence));
}

#[test]
fn a_check_with_no_owner_statement_is_still_missing() {
    assert_eq!(
        missing(&honest_records("check/A"), &allocating(&["check/A"]), &["check/A"]),
        vec!["check/A".to_owned()]
    );
}

#[test]
fn a_check_with_an_exact_affirmative_statement_is_satisfied() {
    let records = attested("check/A", statement("check/A"));
    assert!(missing(&records, &allocating(&["check/A"]), &["check/A"]).is_empty());
}

// A statement about only the red run is a real inspection, retained as what
// the owner saw. It is not an inspection of the pair the close offers.
#[test]
fn a_statement_over_only_the_red_run_does_not_attest_the_pair() {
    let mut partial = statement("check/A");
    partial.submission.evidence = vec!["red-check/A".into()];
    partial.approval.submission = partial.submission.clone();
    let records = attested("check/A", partial);
    assert_eq!(
        missing(&records, &allocating(&["check/A"]), &["check/A"]),
        vec!["check/A".to_owned()]
    );
}

#[test]
fn a_negative_statement_leaves_the_check_missing() {
    let mut negative = statement("check/A");
    negative.approval.approved = false;
    let records = attested("check/A", negative);
    assert_eq!(
        missing(&records, &allocating(&["check/A"]), &["check/A"]),
        vec!["check/A".to_owned()]
    );
}

// The latest statement for a check is the one that counts, so an affirmative
// recorded after a negative satisfies it and the reverse does not.
#[test]
fn the_latest_statement_for_a_check_is_the_one_that_counts() {
    let mut negative = statement("check/A");
    negative.approval.approved = false;

    let mut records = attested("check/A", negative.clone());
    records.push(record("attempt", "later-affirmative", Event::OwnerStatement(statement("check/A"))));
    assert!(missing(&records, &allocating(&["check/A"]), &["check/A"]).is_empty());

    let mut records = attested("check/A", statement("check/A"));
    records.push(record("attempt", "later-negative", Event::OwnerStatement(negative)));
    assert_eq!(missing(&records, &allocating(&["check/A"]), &["check/A"]), vec!["check/A".to_owned()]);
}

// Attestation is per allocated check, so one satisfied check does not carry
// the other.
#[test]
fn an_allocated_check_the_close_offers_no_pair_for_is_missing() {
    let records = attested("check/A", statement("check/A"));
    assert_eq!(
        missing(&records, &allocating(&["check/A", "check/A2"]), &["check/A"]),
        vec!["check/A2".to_owned()]
    );
}

// The digest the owner inspected has to be the one the green run actually
// recorded, not one they were told about.
#[test]
fn a_statement_at_material_the_green_run_never_recorded_is_missing() {
    let mut stale = statement("check/A");
    stale.submission.test_digest = "material-from-an-older-tree".into();
    stale.approval.submission = stale.submission.clone();
    let records = attested("check/A", stale);
    assert_eq!(
        missing(&records, &allocating(&["check/A"]), &["check/A"]),
        vec!["check/A".to_owned()]
    );
}

// The rule is what a caller reads to learn which check to go back to.
#[test]
fn a_refused_inspection_names_the_owner_inspection_rule_and_its_check() {
    let mut statement = statement("check/A");
    statement.approval.submission.evidence = vec!["red-check/A".into()];
    let crate::store::Error::Invalid(message) = validate_inspection(&honest_records("check/A"), &task(), &statement).unwrap_err() else {
        panic!("an inspection refusal is a located invalid request");
    };
    let diagnostic: crate::plan::model::Diagnostic = serde_json::from_str(message.strip_prefix("plan-refusal:").unwrap()).unwrap();
    assert_eq!((diagnostic.rule.as_str(), diagnostic.slot.as_str(), diagnostic.id.as_deref()), ("owner-inspection", "statement", Some("check/A")));
}

#[test]
fn a_statement_the_owner_did_not_approve_is_not_eligible() {
    let mut statement = statement("check/A");
    statement.approval.approved = false;
    let evidence = ["red-check/A".to_owned(), "green-check/A".to_owned()];
    assert!(!owner_eligible(&statement, &check("check/A"), TEST_DIGEST, &evidence));
}

// The executor cannot stand in for the owner: an attest request carries the
// owner's own approval, and a flag or a role it sets for itself is refused.
#[test]
fn an_attest_request_cannot_replace_the_owners_approval_with_a_flag_or_a_role() {
    use super::receipts::OwnerApply;
    let request = |statement: serde_json::Value| serde_json::json!({"operation":"execution-owner-attest","request":{
        "request_id":"executor","task":task(),"attempt":"attempt","expected_version":4,"statement":statement}});
    let honest = serde_json::to_value(statement("check/A")).unwrap();
    assert!(serde_json::from_value::<OwnerApply>(request(honest.clone())).is_ok());
    let mut unapproved = honest.clone();
    unapproved.as_object_mut().unwrap().remove("approval");
    unapproved["no_stub"] = true.into();
    let mut self_assigned = honest;
    self_assigned["role"] = "owner".into();
    for statement in [unapproved, self_assigned] {
        assert!(serde_json::from_value::<OwnerApply>(request(statement.clone())).is_err(), "{statement}");
    }
}
