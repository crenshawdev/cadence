//! What continuation decides for one occurrence, over hand-built records.

use super::continuation::{Decision, select};
use crate::evidence::authority::{CheckerApplicability, Occurrence};
use crate::evidence::checker::{Attempt, Checker, Disposition as Verdict};
use crate::evidence::checkpoint::{Checkpoint, CheckpointType, State as CheckpointState};
use crate::evidence::gates::{Answer, Disposition, Gate, Purpose, State};
use crate::evidence::material::Freshness;
use crate::evidence::overrides::{Authorization, Meaning, Override};
use crate::evidence::{Fact, Record, Scope, VERSION};

const NEED: &str = "Approve the schema change before task 2";

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

/// A record in the occurrence under decision, `run`.
fn record(fact: Fact) -> Record {
    Record { version: VERSION, scope: scope("run"), fact }
}

/// A record in another occurrence.
fn elsewhere(fact: Fact) -> Record {
    Record { version: VERSION, scope: scope("other"), fact }
}

fn checkpoint() -> Fact {
    Fact::Checkpoint(Checkpoint {
        id: "cp-1".into(),
        checkpoint_type: CheckpointType::Structural,
        task_number: 1,
        task_name: "Schema".into(),
        need: NEED.into(),
        completed_work: vec![],
        state: CheckpointState::Unresolved,
        failing_output: None,
    })
}

/// The question asked for `checkpoint`, in `state`.
fn asked(state: State) -> Gate {
    Gate {
        id: "continuation/checkpoint/cp-1".into(),
        purpose: Purpose::Structural,
        checkpoint_id: Some("cp-1".into()),
        question: NEED.into(),
        need: NEED.into(),
        options: vec![],
        state,
    }
}

/// A progress question, in `state`.
fn progress(state: State) -> Gate {
    Gate {
        id: "progress-1".into(),
        purpose: Purpose::Progress,
        checkpoint_id: None,
        question: "Continue phase 5?".into(),
        need: "Continue phase 5?".into(),
        options: vec![],
        state,
    }
}

fn answer(disposition: Disposition) -> Answer {
    Answer {
        question_id: "q".into(),
        actual_response: "as the operator said it".into(),
        selected_option: None,
        adjustment: None,
        disposition,
        authorization_id: None,
    }
}

fn checker(disposition: Verdict) -> Fact {
    Fact::Checker(Checker {
        id: "check".into(),
        raw_return: String::new(),
        disposition,
        findings: vec![],
        checked_material: vec![],
        attempt: Attempt::Initial,
        revision_spent: false,
    })
}

/// What checker applicability said about the latest check.
fn applicable(freshness: Freshness, allowed: bool, spent: bool, override_id: Option<&str>) -> CheckerApplicability {
    CheckerApplicability {
        verdict_applicable: freshness == Freshness::Current,
        freshness,
        continuation_allowed: allowed,
        revision_spent: spent,
        override_id: override_id.map(str::to_string),
    }
}

fn granted(id: &str, meaning: Meaning) -> Fact {
    Fact::Override(Override {
        id: id.into(),
        reason: "the operator said so".into(),
        authorization: Authorization::Invocation { id: "invoke".into(), invocation: "continue it".into() },
        meaning,
    })
}

fn paused() -> Fact {
    granted("pause", Meaning::PausedNext { sentence: "verify the fix on the device".into() })
}

fn decision(records: &[Record], applicability: Option<CheckerApplicability>, plans: &[String]) -> Decision {
    select(records, &scope("run"), applicability, plans).decision
}

fn continued(answer: Option<Answer>, override_id: Option<&str>, rerun_plans: &[String]) -> Decision {
    Decision::Continue { answer, override_id: override_id.map(str::to_string), rerun_plans: rerun_plans.to_vec() }
}

#[test]
fn an_unresolved_checkpoint_with_no_linked_gate_asks_its_need_verbatim() {
    let Decision::NeedQuestion(gate) = decision(&[record(checkpoint())], None, &[]) else {
        panic!("no question was asked")
    };
    assert_eq!(
        (gate.question.as_str(), gate.need.as_str(), gate.checkpoint_id.as_deref()),
        (NEED, NEED, Some("cp-1"))
    );
}

#[test]
fn an_asked_checkpoint_question_waits_on_that_gate() {
    let records = [record(checkpoint()), record(Fact::Gate(asked(State::Unanswered)))];
    assert_eq!(decision(&records, None, &[]), Decision::Wait(asked(State::Unanswered)));
}

#[test]
fn a_stop_answer_stops_with_that_answer() {
    let stop = answer(Disposition::Stop);
    let records = [record(checkpoint()), record(Fact::Gate(asked(State::Answered(stop.clone()))))];
    assert_eq!(decision(&records, None, &[]), Decision::Stop(stop));
}

#[test]
fn an_approve_or_adjust_answer_continues_with_that_answer() {
    for disposition in [Disposition::Approve, Disposition::Adjust] {
        let given = answer(disposition);
        let records = [record(checkpoint()), record(Fact::Gate(asked(State::Answered(given.clone()))))];
        assert_eq!(decision(&records, None, &[]), continued(Some(given), None, &[]));
    }
}

#[test]
fn a_current_passing_check_leaves_an_approved_continuation_standing() {
    let approve = answer(Disposition::Approve);
    let records = [record(checker(Verdict::Pass)), record(Fact::Gate(progress(State::Answered(approve.clone()))))];
    assert_eq!(
        decision(&records, Some(applicable(Freshness::Current, true, false, None)), &[]),
        continued(Some(approve), None, &[])
    );
}

#[test]
fn a_blocker_with_its_revision_unspent_asks_for_revision() {
    let records = [record(checker(Verdict::Fail))];
    assert_eq!(
        decision(&records, Some(applicable(Freshness::Current, false, false, None)), &[]),
        Decision::Revise
    );
}

#[test]
fn an_unusable_result_or_a_spent_revision_requires_an_override() {
    for (verdict, spent) in [(Verdict::Unusable, false), (Verdict::Fail, true)] {
        let records = [record(checker(verdict))];
        assert_eq!(
            decision(&records, Some(applicable(Freshness::Current, false, spent, None)), &[]),
            Decision::OverrideRequired
        );
    }
}

#[test]
fn an_active_bypass_of_that_result_continues_with_its_override_id() {
    let records = [record(checker(Verdict::Fail))];
    assert_eq!(
        decision(&records, Some(applicable(Freshness::Changed, true, false, Some("bypass"))), &[]),
        continued(None, Some("bypass"), &[])
    );
}

#[test]
fn changed_material_asks_for_a_fresh_check() {
    let records = [record(checker(Verdict::Pass))];
    assert_eq!(
        decision(&records, Some(applicable(Freshness::Changed, false, false, None)), &[]),
        Decision::FreshCheck
    );
}

#[test]
fn with_no_answer_and_no_override_continuation_awaits_acceptance() {
    assert_eq!(decision(&[], None, &[]), Decision::AwaitAcceptance);
}

#[test]
fn a_rerun_override_for_the_admitted_plans_continues_with_those_plans() {
    let plans = ["PLAN-1.md".to_string(), "PLAN-2.md".to_string()];
    let records = [record(granted(
        "rerun",
        Meaning::Rerun { admitted_plans: vec!["PLAN-2.md".into(), "PLAN-1.md".into()] },
    ))];
    assert_eq!(decision(&records, None, &plans), continued(None, Some("rerun"), &plans));
}

#[test]
fn an_ended_occurrence_answers_ended() {
    let ended = Occurrence::Fulfilled { completion: "resumed".into() };
    assert_eq!(decision(&[record(Fact::Occurrence(ended.clone()))], None, &[]), Decision::Ended(ended));
}

#[test]
fn another_occurrences_records_do_not_change_the_answer() {
    let records = [
        elsewhere(Fact::Gate(progress(State::Answered(answer(Disposition::Stop))))),
        elsewhere(Fact::Occurrence(Occurrence::Fulfilled { completion: "done".into() })),
    ];
    assert_eq!(decision(&records, None, &[]), Decision::AwaitAcceptance);
}

#[test]
fn a_saved_pause_sentence_alone_awaits_acceptance() {
    assert_eq!(decision(&[record(paused())], None, &[]), Decision::AwaitAcceptance);
}

#[test]
fn an_unanswered_progress_gate_waits_on_it() {
    let records = [record(paused()), record(Fact::Gate(progress(State::Unanswered)))];
    assert_eq!(decision(&records, None, &[]), Decision::Wait(progress(State::Unanswered)));
}

#[test]
fn an_approved_progress_gate_continues_with_its_answer() {
    let approve = answer(Disposition::Approve);
    let records = [record(paused()), record(Fact::Gate(progress(State::Answered(approve.clone()))))];
    assert_eq!(decision(&records, None, &[]), continued(Some(approve), None, &[]));
}

#[test]
fn a_superseded_progress_gate_grants_nothing() {
    let superseded = progress(State::Superseded { by: "replacement".into() });
    let records = [record(paused()), record(Fact::Gate(superseded))];
    assert_eq!(decision(&records, None, &[]), Decision::AwaitAcceptance);
}
