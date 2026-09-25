//! The native evidence rules over hand-built records: how a checker return is
//! judged, which checks, answers, results and overrides a work scope accepts,
//! and when a verdict or a grant still applies.

use super::authority::{self, Occurrence, Permission};
use super::checker::{Attempt, CheckedMaterial, Checker, Disposition, Finding, Severity};
use super::checkpoint::{Checkpoint, CheckpointType, State as CheckpointState};
use super::gates::{self, Answer, Gate, OptionChoice, Purpose};
use super::material::{self, Freshness, Observation, Observations};
use super::overrides::{Authorization, Bypass, Meaning, Override};
use super::results::{AcceptedResult, Reference};
use super::*;
use crate::store::model::digest;
use serde_json::{Value, json};

fn scope(occurrence: &str) -> Scope {
    Scope {
        project: "/project".into(),
        planning_root: "/project/.planning".into(),
        cycle: "v4".into(),
        occurrence: occurrence.into(),
        phase: "5".into(),
        plan: "phases/5/PLAN-1.md".into(),
        report: "phases/5/reports/plan-1.md".into(),
    }
}

fn record(fact: Fact) -> Record {
    Record { version: VERSION, scope: scope("dispatch-1"), fact }
}

fn in_occurrence(occurrence: &str, fact: Fact) -> Record {
    Record { version: VERSION, scope: scope(occurrence), fact }
}

/// Project each record in turn into empty snapshot data.
fn projected(records: &[Record]) -> Result<Value> {
    records.iter().try_fold(json!({}), |data, record| persistence::project(&data, record))
}

fn current(data: &Value) -> Vec<Record> {
    persistence::read(data).unwrap().into_values().collect()
}

fn finding(number: u32, severity: Severity) -> Finding {
    Finding { number, severity, location: "src/a.rs:3".into(), claim: "wrong".into(), fix: "fix it".into() }
}

fn material(path: &str, content: &[u8]) -> CheckedMaterial {
    CheckedMaterial { path: path.into(), content_digest: digest(content) }
}

const PASSED: &str = "## VERIFICATION PASSED";
const ISSUES: &str = "## ISSUES FOUND";

/// An initial check of `a.rs` and `b.rs` that failed on one blocker.
fn failed_initial() -> Checker {
    Checker {
        id: "initial".into(),
        raw_return: ISSUES.into(),
        disposition: Disposition::Fail,
        findings: vec![finding(1, Severity::Blocker)],
        checked_material: vec![material("a.rs", b"a1"), material("b.rs", b"b1")],
        attempt: Attempt::Initial,
        revision_spent: false,
    }
}

/// The one revision of `failed_initial`, re-reading only `a.rs`, that passed.
fn revision(id: &str) -> Checker {
    Checker {
        id: id.into(),
        raw_return: PASSED.into(),
        disposition: Disposition::Pass,
        findings: vec![],
        checked_material: vec![material("a.rs", b"a2")],
        attempt: Attempt::Revision {
            previous_check: "initial".into(),
            previous_blockers: vec![finding(1, Severity::Blocker)],
            diff: "diff --git a/a.rs".into(),
        },
        revision_spent: true,
    }
}

#[test]
fn a_passed_marker_passes_with_no_findings_or_warnings_only() {
    assert_eq!(Checker::disposition(PASSED, &[]), Disposition::Pass);
    assert_eq!(Checker::disposition(PASSED, &[finding(1, Severity::Warning)]), Disposition::Pass);
}

#[test]
fn an_issues_marker_fails_on_any_blocker_and_passes_on_warnings_only() {
    assert_eq!(
        Checker::disposition(ISSUES, &[finding(1, Severity::Warning), finding(2, Severity::Blocker)]),
        Disposition::Fail
    );
    assert_eq!(Checker::disposition(ISSUES, &[finding(1, Severity::Warning)]), Disposition::Pass);
}

#[test]
fn no_marker_both_markers_or_issues_without_findings_is_unusable() {
    for (raw, findings) in [
        ("looks fine to me", vec![]),
        ("", vec![]),
        ("## VERIFICATION PASSED\n## ISSUES FOUND", vec![finding(1, Severity::Warning)]),
        (ISSUES, vec![]),
    ] {
        assert_eq!(Checker::disposition(raw, &findings), Disposition::Unusable, "{raw:?}");
    }
}

#[test]
fn a_recorded_disposition_that_disagrees_with_the_return_is_refused() {
    let mut check = failed_initial();
    check.disposition = Disposition::Pass;
    assert_eq!(check.validate(), Err(Error::Invalid("checker disposition does not match return/findings".into())));
}

#[test]
fn a_revision_needs_a_spent_budget_and_only_the_prior_blockers() {
    let refused = || Err(Error::Invalid("revision needs its prior blockers and spent budget".into()));
    let mut unspent = revision("revision");
    unspent.revision_spent = false;
    assert_eq!(unspent.validate(), refused());
    for blockers in [vec![], vec![finding(1, Severity::Warning)]] {
        let mut check = revision("revision");
        let Attempt::Revision { previous_blockers, .. } = &mut check.attempt else { unreachable!() };
        *previous_blockers = blockers;
        assert_eq!(check.validate(), refused());
    }
}

#[test]
fn a_check_needs_material_with_one_sha256_digest_per_distinct_path() {
    let mut none = failed_initial();
    none.checked_material.clear();
    assert_eq!(none.validate(), Err(Error::Invalid("checker lacks checked material".into())));
    for materials in [
        vec![CheckedMaterial { path: "a.rs".into(), content_digest: "abc".into() }],
        vec![material("a.rs", b"a1"), material("a.rs", b"a2")],
    ] {
        let mut check = failed_initial();
        check.checked_material = materials;
        assert_eq!(check.validate(), Err(Error::Invalid("invalid or duplicate checked material".into())));
    }
}

#[test]
fn a_work_scope_spends_its_one_revision_once() {
    let data = projected(&[record(Fact::Checker(failed_initial())), record(Fact::Checker(revision("first")))]).unwrap();
    assert_eq!(
        persistence::project(&data, &record(Fact::Checker(revision("second")))).map(|_| ()),
        Err(Error::Conflict("one checker revision already spent".into()))
    );
}

#[test]
fn an_initial_check_neither_spends_nor_refunds_the_revision() {
    let spent = projected(&[record(Fact::Checker(failed_initial())), record(Fact::Checker(revision("first")))]).unwrap();
    let mut refund = failed_initial();
    refund.id = "again".into();
    let mut spend = failed_initial();
    spend.revision_spent = true;
    for (data, check) in [(&spent, refund), (&json!({}), spend)] {
        assert_eq!(
            persistence::project(data, &record(Fact::Checker(check))).map(|_| ()),
            Err(Error::Invalid("initial check cannot spend or refund revision".into()))
        );
    }
}

#[test]
fn a_revision_reconsiders_exactly_the_recorded_initial_checks_blockers() {
    let data = projected(&[record(Fact::Checker(failed_initial()))]).unwrap();
    let mut changed = revision("revision");
    let Attempt::Revision { previous_blockers, .. } = &mut changed.attempt else { unreachable!() };
    *previous_blockers = vec![finding(2, Severity::Blocker)];
    assert_eq!(
        persistence::project(&data, &record(Fact::Checker(changed))).map(|_| ()),
        Err(Error::Invalid("revision changed the blocker list under reconsideration".into()))
    );
}

#[test]
fn a_checker_identity_is_recorded_once_per_work_scope() {
    let data = projected(&[record(Fact::Checker(failed_initial()))]).unwrap();
    assert_eq!(
        persistence::project(&data, &record(Fact::Checker(failed_initial()))).map(|_| ()),
        Err(Error::Conflict("checker observation identity already recorded".into()))
    );
}

fn question(state: gates::State) -> Gate {
    Gate {
        id: "q1".into(),
        purpose: Purpose::Decision,
        checkpoint_id: None,
        question: "Ship it?".into(),
        need: "Need: a decision".into(),
        options: vec![OptionChoice { id: "yes".into(), text: "Yes".into() }],
        state,
    }
}

fn answered(disposition: gates::Disposition, authorization: Option<&str>) -> gates::State {
    gates::State::Answered(Answer {
        question_id: "q1".into(),
        actual_response: "yes, ship".into(),
        selected_option: Some("yes".into()),
        adjustment: None,
        disposition,
        authorization_id: authorization.map(Into::into),
    })
}

#[test]
fn an_answer_to_its_own_pending_question_is_recorded() {
    let pending = projected(&[record(Fact::Gate(question(gates::State::Unanswered)))]).unwrap();
    let answer = record(Fact::Gate(question(answered(gates::Disposition::Approve, None))));
    let data = persistence::project(&pending, &answer).unwrap();
    assert_eq!(persistence::read(&data).unwrap()[&answer.key().unwrap()], answer);
}

#[test]
fn an_answer_without_its_pending_question_in_the_same_scope_is_refused() {
    let pending = projected(&[record(Fact::Gate(question(gates::State::Unanswered)))]).unwrap();
    let elsewhere = in_occurrence("dispatch-2", Fact::Gate(question(answered(gates::Disposition::Approve, None))));
    for (data, answer) in [
        (json!({}), record(Fact::Gate(question(answered(gates::Disposition::Approve, None))))),
        (pending, elsewhere),
    ] {
        assert_eq!(
            persistence::project(&data, &answer).map(|_| ()),
            Err(Error::Invalid("answer requires its recorded pending question".into()))
        );
    }
}

#[test]
fn an_answer_that_changes_its_question_or_answers_it_again_is_refused() {
    let pending = projected(&[record(Fact::Gate(question(gates::State::Unanswered)))]).unwrap();
    let mut reworded = question(answered(gates::Disposition::Approve, None));
    reworded.question = "Ship it now?".into();
    let once = persistence::project(&pending, &record(Fact::Gate(question(answered(gates::Disposition::Approve, None))))).unwrap();
    let superseded = persistence::project(&pending, &record(Fact::Gate(question(gates::State::Superseded { by: "q2".into() })))).unwrap();
    for (data, answer) in [
        (&pending, reworded),
        (&once, question(answered(gates::Disposition::Stop, None))),
        (&superseded, question(answered(gates::Disposition::Approve, None))),
    ] {
        assert_eq!(
            persistence::project(data, &record(Fact::Gate(answer))).map(|_| ()),
            Err(Error::Conflict("question changed, already answered, or superseded".into()))
        );
    }
}

#[test]
fn an_answer_must_name_its_question_a_known_option_and_carry_any_adjustment() {
    let answer = |change: fn(&mut Answer)| {
        let mut state = answered(gates::Disposition::Approve, None);
        let gates::State::Answered(value) = &mut state else { unreachable!() };
        change(value);
        question(state).validate()
    };
    assert_eq!(answer(|a| a.question_id = "q9".into()), Err(Error::Invalid("answer names a different question".into())));
    assert_eq!(answer(|a| a.selected_option = Some("no".into())), Err(Error::Invalid("answer names an unknown option".into())));
    assert_eq!(answer(|a| a.disposition = gates::Disposition::Adjust), Err(Error::Invalid("adjust disposition lacks adjustment".into())));
}

fn checkpoint(kind: CheckpointType) -> Checkpoint {
    Checkpoint {
        id: "stop-1".into(),
        checkpoint_type: kind,
        task_number: 2,
        task_name: "Task".into(),
        need: "Need: an answer".into(),
        completed_work: vec![],
        state: CheckpointState::Unresolved,
        failing_output: Some("reports/suite.log:17".into()),
    }
}

#[test]
fn a_gate_needs_its_checkpoint_and_a_suite_red_checkpoint_takes_no_gate() {
    let mut gated = question(gates::State::Unanswered);
    gated.checkpoint_id = Some("stop-1".into());
    assert_eq!(
        persistence::project(&json!({}), &record(Fact::Gate(gated.clone()))).map(|_| ()),
        Err(Error::Invalid("gate lacks its checkpoint".into()))
    );
    let suite_red = projected(&[record(Fact::Checkpoint(checkpoint(CheckpointType::SuiteRed)))]).unwrap();
    assert_eq!(
        persistence::project(&suite_red, &record(Fact::Gate(gated.clone()))).map(|_| ()),
        Err(Error::Invalid("suite-red does not require an operator gate".into()))
    );
    let decision = projected(&[record(Fact::Checkpoint(checkpoint(CheckpointType::Decision)))]).unwrap();
    assert!(persistence::project(&decision, &record(Fact::Gate(gated))).is_ok());
}

#[test]
fn a_commit_of_7_to_64_hex_digits_a_positive_file_line_and_a_named_criterion_are_references() {
    for reference in [
        Reference::Commit { sha: "60d94a5".into() },
        Reference::Commit { sha: "a".repeat(40) },
        Reference::Commit { sha: "b".repeat(64) },
        Reference::FileLine { file: "src/a.rs".into(), line: 1 },
        Reference::Criterion { id: "AC7".into() },
    ] {
        assert_eq!(reference.validate(), Ok(()), "{reference:?}");
    }
}

#[test]
fn a_short_or_non_hex_commit_a_zero_or_blank_file_line_and_a_blank_criterion_are_refused() {
    for reference in [
        Reference::Commit { sha: "abc".into() },
        Reference::Commit { sha: "just prose".into() },
        Reference::Commit { sha: "c".repeat(65) },
        Reference::FileLine { file: "src/a.rs".into(), line: 0 },
        Reference::FileLine { file: " ".into(), line: 3 },
        Reference::Criterion { id: " \t".into() },
    ] {
        assert!(reference.validate().is_err(), "{reference:?}");
    }
}

#[test]
fn a_prose_reference_or_one_missing_a_field_does_not_parse() {
    for raw in [
        json!({"kind":"prose","text":"it passed"}),
        json!({"kind":"file_line","file":"some.rs"}),
        json!({"kind":"file_line","line":1}),
        json!({"kind":"criterion"}),
    ] {
        assert!(serde_json::from_value::<Reference>(raw.clone()).is_err(), "{raw}");
    }
}

fn result(checker: Option<&str>, tag: &str, references: Vec<Reference>) -> AcceptedResult {
    AcceptedResult {
        id: "result-1".into(),
        contract: "cad-verifier".into(),
        result: tag.into(),
        evidence_text: "verified".into(),
        references,
        checker_id: checker.map(Into::into),
    }
}

fn criterion() -> Vec<Reference> {
    vec![Reference::Criterion { id: "AC2".into() }]
}

#[test]
fn an_accepted_result_without_a_reference_is_refused() {
    assert_eq!(
        result(None, "pass", vec![]).validate(),
        Err(Error::Invalid("accepted result needs an evidence reference".into()))
    );
}

#[test]
fn an_accepted_result_tied_to_a_checker_states_that_checkers_recorded_disposition() {
    let checked = projected(&[record(Fact::Checker(failed_initial()))]).unwrap();
    assert_eq!(
        persistence::project(&checked, &record(Fact::AcceptedResult(result(Some("initial"), "pass", criterion())))).map(|_| ()),
        Err(Error::Invalid("acceptance cannot change the checker disposition".into()))
    );
    assert!(persistence::project(&checked, &record(Fact::AcceptedResult(result(Some("initial"), "fail", criterion())))).is_ok());
    assert_eq!(
        persistence::project(&json!({}), &record(Fact::AcceptedResult(result(Some("initial"), "fail", criterion())))).map(|_| ()),
        Err(Error::Invalid("accepted checker result lacks its observation".into()))
    );
}

#[test]
fn an_accepted_result_identity_is_recorded_once() {
    let data = projected(&[record(Fact::AcceptedResult(result(None, "pass", criterion())))]).unwrap();
    assert_eq!(
        persistence::project(&data, &record(Fact::AcceptedResult(result(None, "pass", criterion())))).map(|_| ()),
        Err(Error::Conflict("accepted result identity already recorded".into()))
    );
}

fn pause() -> Override {
    Override {
        id: "pause".into(),
        reason: "continue later".into(),
        authorization: Authorization::Invocation { id: "invoke".into(), invocation: "pause here".into() },
        meaning: Meaning::PausedNext { sentence: "resume exact instruction".into() },
    }
}

fn fulfilled() -> Fact {
    Fact::Occurrence(Occurrence::Fulfilled { completion: "done".into() })
}

#[test]
fn an_occurrence_ends_once_and_only_after_a_grant_in_its_own_scope() {
    assert_eq!(
        persistence::project(&json!({}), &record(fulfilled())).map(|_| ()),
        Err(Error::Invalid("occurrence transition lacks its pending grant".into()))
    );
    let ended = projected(&[record(Fact::Override(pause())), record(fulfilled())]).unwrap();
    let mut later_grant = pause();
    later_grant.id = "pause-2".into();
    for fact in [Fact::Occurrence(Occurrence::Superseded { by: "dispatch-2".into() }), Fact::Override(later_grant)] {
        assert_eq!(
            persistence::project(&ended, &record(fact)).map(|_| ()),
            Err(Error::Conflict("work occurrence already fulfilled or superseded".into()))
        );
    }
}

#[test]
fn a_grant_ends_by_its_own_scopes_transition_and_by_no_other() {
    let data = projected(&[
        record(Fact::Override(pause())),
        in_occurrence("dispatch-2", Fact::Override(pause())),
        in_occurrence("dispatch-2", fulfilled()),
    ])
    .unwrap();
    let records = current(&data);
    assert_eq!(authority::permission(&records, &scope("dispatch-1"), "pause"), Permission::Pending);
    assert_eq!(authority::permission(&records, &scope("dispatch-2"), "pause"), Permission::Fulfilled);
}

#[test]
fn a_revision_basis_keeps_the_initial_material_it_did_not_read_again() {
    let records = current(&projected(&[record(Fact::Checker(failed_initial())), record(Fact::Checker(revision("revision")))]).unwrap());
    assert_eq!(
        material::basis(&records, &scope("dispatch-1"), "revision").unwrap(),
        vec![material("a.rs", b"a2"), material("b.rs", b"b1")]
    );
}

#[test]
fn material_read_as_recorded_is_current_changed_bytes_are_changed_and_anything_unread_is_unavailable() {
    let expected = vec![material("a.rs", b"a1")];
    let observed = |observation: Option<Observation>| -> Observations {
        observation.into_iter().map(|o| ("a.rs".to_string(), o)).collect()
    };
    assert_eq!(material::compare(&expected, &observed(Some(Observation::Read(digest(b"a1"))))), Freshness::Current);
    assert_eq!(material::compare(&expected, &observed(Some(Observation::Read(digest(b"a9"))))), Freshness::Changed);
    assert_eq!(material::compare(&expected, &observed(Some(Observation::Failed("denied".into())))), Freshness::Unavailable);
    assert_eq!(material::compare(&expected, &observed(None)), Freshness::Unavailable);
    assert_eq!(material::compare(&[], &observed(None)), Freshness::Unavailable);
}

/// A passing initial check of `a.rs`.
fn passed_initial() -> Checker {
    Checker {
        id: "check".into(),
        raw_return: PASSED.into(),
        disposition: Disposition::Pass,
        findings: vec![],
        checked_material: vec![material("a.rs", b"a1")],
        attempt: Attempt::Initial,
        revision_spent: false,
    }
}

#[test]
fn a_failed_read_makes_the_verdict_unavailable_and_denies_continuation() {
    let records = current(&projected(&[record(Fact::Checker(passed_initial()))]).unwrap());
    let failed: Observations = [("a.rs".to_string(), Observation::Failed("PermissionDenied: denied".into()))].into();
    let applicability = authority::checker_applicability(&records, &scope("dispatch-1"), "check", &failed).unwrap();
    assert_eq!(applicability.freshness, Freshness::Unavailable);
    assert!(!applicability.verdict_applicable);
    assert!(!applicability.continuation_allowed);
}

fn bypass(material_bytes: &[u8], disposition: Disposition) -> Override {
    Override {
        id: "bypass".into(),
        reason: "accept as checked".into(),
        authorization: Authorization::Invocation { id: "invoke".into(), invocation: "bypass the failed check".into() },
        meaning: Meaning::Bypass {
            target: Bypass::Result { checker_id: "initial".into(), disposition, material: vec![material("a.rs", material_bytes), material("b.rs", b"b1")] },
        },
    }
}

fn both_read(a: &[u8]) -> Observations {
    [("a.rs".to_string(), Observation::Read(digest(a))), ("b.rs".to_string(), Observation::Read(digest(b"b1")))].into()
}

#[test]
fn an_active_bypass_whose_material_matches_the_observation_allows_continuation() {
    let records = current(&projected(&[record(Fact::Checker(failed_initial())), record(Fact::Override(bypass(b"a2", Disposition::Fail)))]).unwrap());
    let applicability = authority::checker_applicability(&records, &scope("dispatch-1"), "initial", &both_read(b"a2")).unwrap();
    assert_eq!(applicability.freshness, Freshness::Changed);
    assert!(!applicability.verdict_applicable);
    assert!(applicability.continuation_allowed);
    assert_eq!(applicability.override_id.as_deref(), Some("bypass"));
}

#[test]
fn a_bypass_over_other_material_or_after_its_occurrence_ended_does_not_allow_continuation() {
    let granted = projected(&[record(Fact::Checker(failed_initial())), record(Fact::Override(bypass(b"a2", Disposition::Fail)))]).unwrap();
    let ended = persistence::project(&granted, &record(fulfilled())).unwrap();
    for (data, observed) in [(&granted, both_read(b"a3")), (&ended, both_read(b"a2"))] {
        let applicability = authority::checker_applicability(&current(data), &scope("dispatch-1"), "initial", &observed).unwrap();
        assert!(!applicability.continuation_allowed);
        assert_eq!(applicability.override_id, None);
    }
}

#[test]
fn a_spent_revision_stays_spent_whatever_allows_continuation() {
    let data = projected(&[
        record(Fact::Checker(failed_initial())),
        record(Fact::Checker(revision("revision"))),
    ])
    .unwrap();
    let applicability = authority::checker_applicability(&current(&data), &scope("dispatch-1"), "revision", &both_read(b"a2")).unwrap();
    assert!(applicability.continuation_allowed);
    assert!(applicability.revision_spent);
}

#[test]
fn a_bypass_states_its_checkers_recorded_disposition_and_its_whole_material_set() {
    let checked = projected(&[record(Fact::Checker(failed_initial()))]).unwrap();
    assert_eq!(
        persistence::project(&checked, &record(Fact::Override(bypass(b"a2", Disposition::Pass)))).map(|_| ()),
        Err(Error::Invalid("bypass must preserve its actual checker outcome".into()))
    );
    let mut partial = bypass(b"a2", Disposition::Fail);
    let Meaning::Bypass { target: Bypass::Result { material, .. } } = &mut partial.meaning else { unreachable!() };
    material.pop();
    assert_eq!(
        persistence::project(&checked, &record(Fact::Override(partial))).map(|_| ()),
        Err(Error::Invalid("bypass must identify the full affected material set".into()))
    );
}

fn answer_authorized() -> Override {
    let mut value = pause();
    value.authorization = Authorization::Answer { id: "auth-1".into(), question_id: "q1".into() };
    value
}

#[test]
fn an_answer_authorized_override_needs_its_recorded_non_stop_answer_carrying_its_authority() {
    let pending = projected(&[record(Fact::Gate(question(gates::State::Unanswered)))]).unwrap();
    let with = |state| persistence::project(&pending, &record(Fact::Gate(question(state)))).unwrap();
    let refused = Err(Error::Invalid("override lacks its recorded authorizing answer".into()));
    for data in [
        pending.clone(),
        with(answered(gates::Disposition::Stop, Some("auth-1"))),
        with(answered(gates::Disposition::Approve, Some("auth-2"))),
    ] {
        assert_eq!(persistence::project(&data, &record(Fact::Override(answer_authorized()))).map(|_| ()), refused);
    }
    assert!(
        persistence::project(&with(answered(gates::Disposition::Approve, Some("auth-1"))), &record(Fact::Override(answer_authorized())))
            .is_ok()
    );
}

#[test]
fn an_override_identity_is_recorded_once() {
    let data = projected(&[record(Fact::Override(pause()))]).unwrap();
    assert_eq!(
        persistence::project(&data, &record(Fact::Override(pause()))).map(|_| ()),
        Err(Error::Conflict("override identity already recorded".into()))
    );
}
