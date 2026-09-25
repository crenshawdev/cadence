
use cadence::next_action::continuation::Decision;

#[test]
fn suite_repair_continuation_waits_on_plan_question() {
    use cadence::execution::history::{PlanProjection, SuiteRepairQuestion};
    let question = SuiteRepairQuestion { id: "suite-repair:run-1".into(), failed_run: "run-1".into(),
        failing_tests: vec!["repair::alpha".into()], proposed_paths: vec!["src/value.rs".into()] };
    let projection = PlanProjection { version: 3, worker_exits: vec![], round: None, completion: None, launches: vec!["run-1".into()], results: vec!["run-1".into()],
        relaunch: None, repair_question: Some(question.clone()), repair_answer: None, repair: None,
        outcome: "failed".into(), completed: false };
    assert_eq!(cadence::next_action::continuation::plan_repair_decision(&projection),
        Some(Decision::RepairSuite { question_id: question.id, approved: false }));
}

use super::next_action_service::{self, Consumed};
use crate::config::reload::{Generation, Input};
use cadence::derivation::{CapturedInputs, DerivationError, Observation, PhaseId};
use cadence::evidence::authority::Occurrence;
use cadence::evidence::gates::{Answer, Disposition, Gate, Purpose, State};
use cadence::evidence::overrides::{Authorization, Meaning, Override};
use cadence::evidence::{Fact, Record, Scope, VERSION, material, persistence};
use cadence::next_action::{Pause, observations::{Observations, Report}};
use cadence::store::{model::Snapshot, writer::View};
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

fn phase(number: f64) -> PhaseId {
    serde_json::from_value(json!(number)).unwrap()
}

fn record(occurrence: &str, fact: Fact) -> Record {
    Record { version: VERSION, scope: scope(occurrence), fact }
}

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

#[test]
fn an_asked_question_is_recorded_as_that_gate_and_then_waited_on() {
    let gate = progress(State::Unanswered);
    let (asked, decision) = next_action_service::ask(&scope("run"), gate.clone());
    assert_eq!(asked, record("run", Fact::Gate(gate.clone())));
    assert_eq!(decision, Decision::Wait(gate));
}

#[test]
fn skip_discuss_is_read_from_the_effective_config() {
    for skip in [true, false] {
        let values = json!({"workflow":{"skip_discuss":skip}});
        assert_eq!(next_action_service::skip_discuss(&values).unwrap(), skip);
    }
}

#[test]
fn a_config_that_does_not_say_whether_to_skip_discussion_refuses() {
    assert!(next_action_service::skip_discuss(&json!({"workflow":{}})).is_err());
}

fn captured(roadmap: &[u8]) -> CapturedInputs {
    CapturedInputs {
        root: "/project/.planning".into(),
        root_probe: Observation::Present(()),
        roadmap: Observation::Present(roadmap.to_vec()),
        declarations: None,
        phases: vec![],
    }
}

fn generation(number: u64) -> Generation {
    Generation {
        number,
        global: None,
        repo: Input { identity: "/project/.planning/config.v4.json".into(), bytes: None, stamp: None },
        effective: crate::config::merge::merge(None, Some(json!({})), false),
    }
}

/// What an answer consumed: phase 2's plan report reading `report`, the
/// roadmap `roadmap`, review records `reviews`, store generation `store` and
/// config generation `config`.
fn consumed(report: &[u8], roadmap: &[u8], reviews: Value, store: u64, config: u64) -> Consumed {
    Consumed {
        observed: Observations {
            reports: vec![(phase(2.0), vec![Report {
                path: "phases/2/reports/plan-1.md".into(),
                bytes: Observation::Present(report.to_vec()),
            }])],
            ..Observations::default()
        },
        capture: captured(roadmap),
        reviews,
        snapshot: Snapshot::new(store, b"", b"", json!({})).unwrap(),
        config: generation(config),
    }
}

#[test]
fn an_answer_is_served_only_while_everything_it_consumed_reads_the_same() {
    let before = || consumed(b"PLAN COMPLETE", b"# Roadmap", json!({}), 1, 1);
    assert!(next_action_service::held(&before(), &before()).is_ok());
    for after in [
        consumed(b"PLAN PARTIAL", b"# Roadmap", json!({}), 1, 1),
        consumed(b"PLAN COMPLETE", b"# Roadmap, edited", json!({}), 1, 1),
        consumed(b"PLAN COMPLETE", b"# Roadmap", json!({"deferred":{}}), 1, 1),
        consumed(b"PLAN COMPLETE", b"# Roadmap", json!({}), 2, 1),
        consumed(b"PLAN COMPLETE", b"# Roadmap", json!({}), 1, 2),
    ] {
        assert!(matches!(
            next_action_service::held(&before(), &after),
            Err(DerivationError::InputsChanged)
        ));
    }
}

#[test]
fn a_continuation_whose_checked_material_changed_on_recheck_is_refused() {
    let capture = captured(b"# Roadmap");
    let read = |bytes: &[u8]| -> material::Observations {
        [("phases/5/PLAN-1.md".to_string(), material::Observation::Read(cadence::store::model::digest(bytes)))].into()
    };
    assert!(next_action_service::recheck_holds(&capture, &capture, &read(b"v1"), &read(b"v1")).is_ok());
    assert!(matches!(
        next_action_service::recheck_holds(&capture, &capture, &read(b"v1"), &read(b"v2")),
        Err(DerivationError::InputsChanged)
    ));
}

fn granted(id: &str, meaning: Meaning) -> Fact {
    Fact::Override(Override {
        id: id.into(),
        reason: "the operator said so".into(),
        authorization: Authorization::Invocation { id: "invoke".into(), invocation: "pause here".into() },
        meaning,
    })
}

const SENTENCE: &str = "verify the fix on the device";

fn paused() -> Fact {
    granted("pause", Meaning::PausedNext { sentence: SENTENCE.into() })
}

/// A legacy cursor imported as paused at phase 3 of 4.
fn legacy_cursor() -> Value {
    json!({"available": true, "phase": 3, "total": 4, "name": "Three", "status": "paused",
        "next": "/cad-plan 3 --exact", "updated": "2026-09-06",
        "original_fields": {"phase": "3 of 4 (Three)", "status": "paused",
            "next": "/cad-plan 3 --exact", "updated": "2026-09-06"}})
}

/// A store view holding `records`, oldest first, in its history and its
/// current evidence, with `cursor` as its imported legacy cursor.
fn store(records: &[Record], cursor: Option<Value>) -> View {
    let mut data = records.iter().fold(json!({}), |data, record| persistence::project(&data, record).unwrap());
    if let Some(cursor) = cursor {
        data["cursor"] = cursor;
    }
    View {
        items: vec![],
        decisions: records
            .iter()
            .enumerate()
            .map(|(i, record)| persistence::history(&format!("op{i}"), record, None).unwrap())
            .collect(),
        snapshot: Snapshot::new(1, b"", b"", data).unwrap(),
    }
}

#[test]
fn an_active_pause_offers_its_exact_sentence_for_its_phase() {
    assert_eq!(
        next_action_service::pause(&store(&[record("run", paused())], None)).unwrap(),
        Some(Pause { phase: phase(5.0), next: SENTENCE.into() })
    );
}

#[test]
fn a_held_legacy_cursor_is_the_pause_when_no_native_pause_is_recorded() {
    assert_eq!(
        next_action_service::pause(&store(&[], Some(legacy_cursor()))).unwrap(),
        Some(Pause { phase: phase(3.0), next: "/cad-plan 3 --exact".into() })
    );
}

#[test]
fn a_native_pause_is_offered_in_place_of_the_legacy_cursor() {
    assert_eq!(
        next_action_service::pause(&store(&[record("run", paused())], Some(legacy_cursor()))).unwrap(),
        Some(Pause { phase: phase(5.0), next: SENTENCE.into() })
    );
}

#[test]
fn an_ended_native_pause_offers_neither_it_nor_the_legacy_cursor() {
    for ended in [
        Occurrence::Fulfilled { completion: "resumed".into() },
        Occurrence::Superseded { by: "later".into() },
    ] {
        let view = store(&[record("run", paused()), record("run", Fact::Occurrence(ended))], Some(legacy_cursor()));
        assert_eq!(next_action_service::pause(&view).unwrap(), None);
    }
}

#[test]
fn another_occurrences_progress_gate_and_approval_offer_no_pause() {
    let approve = Answer {
        question_id: "progress-1".into(),
        actual_response: "go on".into(),
        selected_option: None,
        adjustment: None,
        disposition: Disposition::Approve,
        authorization_id: None,
    };
    let view = store(
        &[
            record("other", Fact::Gate(progress(State::Unanswered))),
            record("other", Fact::Gate(progress(State::Answered(approve)))),
        ],
        None,
    );
    assert_eq!(next_action_service::pause(&view).unwrap(), None);
}
