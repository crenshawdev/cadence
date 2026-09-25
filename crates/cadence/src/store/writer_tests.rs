//! The writer's decisions over values: whether a guarded write still holds
//! its precondition, what view a set of store files makes, and whether files
//! another writer left can replace the view this writer holds.

use super::model::{
    DECISIONS, Disposition, Evidence, ITEMS, ItemRecord, Origin, STATE, Snapshot, VERSION,
    render_lines,
};
use super::writer::{STALE_SNAPSHOT, View, later_generation, next_generation, precondition, view};
use super::{Error, Observed};
use serde_json::json;
use std::collections::BTreeMap;

#[test]
fn drain_limit_diagnostic_names_the_open_write_and_bound() {
    let limit = super::writer::DrainLimit {
        open_write: Some("drain-02".into()),
        bound: std::time::Duration::from_secs(10),
    };
    assert_eq!(super::writer::drain_limit_diagnostic(&limit),
        "cadence: shutdown drain reached 10 seconds; open admitted write drain-02 left to journal recovery.");
}

#[test]
fn drain_limit_diagnostic_names_the_open_write_and_bound_without_inventing_a_write() {
    let limit = super::writer::DrainLimit {
        open_write: None,
        bound: std::time::Duration::from_secs(10),
    };
    assert_eq!(super::writer::drain_limit_diagnostic(&limit),
        "cadence: shutdown drain reached 10 seconds while joining writers; any open intent is left to journal recovery.");
}

#[test]
fn serve_drains_admitted_writes_on_transport_end() {
    let admissions = [
        super::writer::Admission { sequence: 1, id: "drain-01".into() },
        super::writer::Admission { sequence: 2, id: "drain-02".into() },
    ];
    for (elapsed, expected) in [
        (std::time::Duration::from_millis(9_999), super::writer::DrainAction::Wait),
        (std::time::Duration::from_secs(10), super::writer::DrainAction::DrainLimit(super::writer::DrainLimit {
            open_write: Some("drain-02".into()), bound: std::time::Duration::from_secs(10),
        })),
        (std::time::Duration::from_secs(11), super::writer::DrainAction::DrainLimit(super::writer::DrainLimit {
            open_write: Some("drain-02".into()), bound: std::time::Duration::from_secs(10),
        })),
    ] {
        let drain = super::writer::Drain {
            admission_closed: true, admissions: &admissions, completed_prefix: 1,
            open_write: Some("drain-02"), elapsed,
        };
        assert_eq!(drain.step(None), expected);
    }
}

#[test]
fn requests_after_transport_end_are_refused() {
    let drain = super::writer::Drain {
        admission_closed: true, admissions: &[], completed_prefix: 0,
        open_write: None, elapsed: std::time::Duration::ZERO,
    };
    assert_eq!(drain.step(Some("late-01")), super::writer::DrainAction::Refuse);
}

#[test]
fn next_write_is_earliest_pending_admission() {
    let admissions = [
        super::writer::Admission { sequence: 3, id: "drain-03".into() },
        super::writer::Admission { sequence: 1, id: "drain-01".into() },
        super::writer::Admission { sequence: 2, id: "drain-02".into() },
    ];
    let drain = super::writer::Drain {
        admission_closed: true, admissions: &admissions, completed_prefix: 1,
        open_write: None, elapsed: std::time::Duration::ZERO,
    };
    assert_eq!(drain.step(None), super::writer::DrainAction::Next("drain-02".into()));
}

#[test]
fn nothing_pending_requests_normal_join() {
    let drain = super::writer::Drain {
        admission_closed: true, admissions: &[], completed_prefix: 2,
        open_write: None, elapsed: std::time::Duration::from_secs(11),
    };
    assert_eq!(drain.step(None), super::writer::DrainAction::Join);
}

#[test]
fn a_write_commits_as_the_generation_after_the_current_one() {
    assert_eq!((next_generation(0), next_generation(41)), (Ok(1), Ok(42)));
}

fn item(id: &str) -> ItemRecord {
    ItemRecord {
        version: VERSION,
        id: id.into(),
        revision: 1,
        origin: Origin { source: "capture".into(), original: Evidence::Missing },
        text: id.into(),
        kind: "todo".into(),
        phase: None,
        disposition: Disposition::Captured,
        completed: false,
        filing_uncertain: false,
    }
}

fn file(bytes: &[u8], directory: &str) -> Observed {
    Observed { bytes: Some(bytes.to_vec()), identity: "file".into(), directory_identity: directory.into() }
}

fn absent() -> Observed {
    Observed { bytes: None, identity: "missing".into(), directory_identity: "store".into() }
}

/// A store's three files at `generation` holding `items`, in `directory`.
fn store_in(generation: u64, items: &[ItemRecord], directory: &str) -> BTreeMap<String, Observed> {
    let items = render_lines(items).unwrap();
    let state = Snapshot::new(generation, &items, b"", json!({"generation": generation}))
        .unwrap()
        .render()
        .unwrap();
    BTreeMap::from([
        (ITEMS.into(), file(&items, directory)),
        (DECISIONS.into(), file(b"", directory)),
        (STATE.into(), file(&state, directory)),
    ])
}

fn store(generation: u64, items: &[ItemRecord]) -> BTreeMap<String, Observed> {
    store_in(generation, items, "store")
}

fn snapshot(data: serde_json::Value) -> Snapshot {
    Snapshot::new(4, b"", b"", data).unwrap()
}

#[test]
fn the_current_generation_and_integrity_meet_the_precondition() {
    let current = snapshot(json!({"answer": 1}));
    assert_eq!(precondition(&current, 4, &current.integrity.clone()), Ok(()));
}

#[test]
fn a_generation_moved_on_by_an_intervening_write_is_stale() {
    let current = snapshot(json!({"answer": 1}));
    assert_eq!(
        precondition(&current, 3, &current.integrity.clone()),
        Err(Error::Conflict(STALE_SNAPSHOT.into()))
    );
}

#[test]
fn an_integrity_changed_by_a_snapshot_rewrite_at_the_same_generation_is_stale() {
    let current = snapshot(json!({"answer": 1}));
    let expected = snapshot(json!({"answer": 2})).integrity;
    assert_ne!(expected, current.integrity);
    assert_eq!(precondition(&current, 4, &expected), Err(Error::Conflict(STALE_SNAPSHOT.into())));
}

#[test]
fn three_absent_files_are_a_new_store_at_generation_0() {
    let files = BTreeMap::from([(ITEMS.into(), absent()), (DECISIONS.into(), absent()), (STATE.into(), absent())]);
    let new = view(&files).unwrap();
    assert_eq!((new.snapshot.generation, new.items.len(), new.decisions.len()), (0, 0, 0));
}

#[test]
fn a_state_file_without_its_items_or_decisions_is_refused() {
    for missing in [ITEMS, DECISIONS] {
        let mut files = store(1, &[]);
        files.insert(missing.into(), absent());
        assert_eq!(
            view(&files).map(|_| ()),
            Err(Error::Conflict("owned generation lost a store file".into())),
            "{missing}"
        );
    }
}

#[test]
fn records_without_a_state_file_are_refused() {
    let mut files = store(1, &[item("a")]);
    files.insert(STATE.into(), absent());
    assert_eq!(view(&files).map(|_| ()), Err(Error::Conflict("owned records lack a snapshot".into())));
}

#[test]
fn a_state_file_that_does_not_match_its_items_is_refused() {
    let mut files = store(1, &[]);
    files.insert(ITEMS.into(), file(&render_lines(&[item("a")]).unwrap(), "store"));
    assert_eq!(
        view(&files).map(|_| ()),
        Err(Error::Conflict("snapshot integrity or version mismatch".into()))
    );
}

#[test]
fn the_view_holds_the_items_in_file_order_and_the_snapshot_generation() {
    let read = view(&store(2, &[item("a"), item("b")])).unwrap();
    assert_eq!(read.items.iter().map(|item| item.id.as_str()).collect::<Vec<_>>(), ["a", "b"]);
    assert_eq!(read.snapshot.data, json!({"generation": 2}));
}

fn read(files: &BTreeMap<String, Observed>) -> View {
    view(files).unwrap()
}

#[test]
fn a_later_generation_that_only_appends_replaces_the_view() {
    let before = store(1, &[item("a")]);
    let after = store(2, &[item("a"), item("b")]);
    assert_eq!(later_generation(&read(&before), &before, &read(&after), &after), Ok(()));
}

#[test]
fn files_that_do_not_move_the_generation_on_are_an_external_change() {
    let before = store(2, &[item("a")]);
    for generation in [1, 2] {
        let after = store(generation, &[item("a"), item("b")]);
        assert_eq!(
            later_generation(&read(&before), &before, &read(&after), &after),
            Err(Error::Conflict("externally changed store generation".into())),
            "{generation}"
        );
    }
}

#[test]
fn a_later_generation_that_drops_or_replaces_an_item_is_an_external_change() {
    let before = store(1, &[item("a"), item("b")]);
    for items in [vec![item("a")], vec![item("b"), item("a")]] {
        let after = store(2, &items);
        assert_eq!(
            later_generation(&read(&before), &before, &read(&after), &after),
            Err(Error::Conflict("externally changed store generation".into()))
        );
    }
}

#[test]
fn a_later_generation_in_a_replaced_store_directory_is_an_external_change() {
    let before = store(1, &[item("a")]);
    let after = store_in(2, &[item("a"), item("b")], "replaced");
    assert_eq!(
        later_generation(&read(&before), &before, &read(&after), &after),
        Err(Error::Conflict("externally changed store generation".into()))
    );
}

/// Phase 6's execution with plan 1 admitted as its active dispatch, which
/// carries the plan body.
fn admitted_execution() -> cadence::execution::model::ExecutionSnapshot {
    use cadence::execution::{
        dispatch::{admit_dispatch, build_dispatch},
        model::{EXECUTION_SCHEMA, ExecutionOccurrence, ExecutionSnapshot},
        plan::{parse_plan, plan_set_fingerprint},
    };
    let plan = parse_plan(
        b"---\nphase: 6\nplan: 1\nrequirements: [AC4]\nfiles: [src/lib.rs]\nexecution:\n  schema: 1\n  suite: cargo test\n  tasks:\n    - id: T1\n      verify: [cargo test one]\n---\nBuild it.\n",
        6,
        1,
    )
    .unwrap();
    let set = plan_set_fingerprint(std::slice::from_ref(&plan)).unwrap();
    let candidate = build_dispatch(&plan, &set, 0, &"1".repeat(40)).unwrap();
    assert!(!candidate.body.is_empty(), "the fixture's dispatch carries its body");
    let occurrence = ExecutionOccurrence {
        phase: 6, undone: None, plan_set_fingerprint: set, version: 0, active: None,
        plans: vec![], terminal: None, receipts: BTreeMap::new(), issues: BTreeMap::new(),
    };
    let (occurrence, _) = admit_dispatch(&occurrence, candidate).unwrap();
    ExecutionSnapshot { schema: EXECUTION_SCHEMA, occurrences: BTreeMap::from([("6".into(), occurrence)]) }
}

#[test]
fn installing_execution_leaves_every_other_namespace_as_it_was() {
    use super::writer::install_execution;
    let mut data = json!({"lifecycle": {"status": "planned"}, "evidence": [{"id": "seed"}]});
    install_execution(&mut data, admitted_execution()).unwrap();
    assert_eq!(
        (&data["lifecycle"], &data["evidence"]),
        (&json!({"status": "planned"}), &json!([{"id": "seed"}]))
    );
}

#[test]
fn installing_execution_keeps_the_plan_body_out_of_the_snapshot() {
    use super::writer::install_execution;
    let mut data = json!({});
    install_execution(&mut data, admitted_execution()).unwrap();
    assert!(data["execution"]["occurrences"]["6"]["active"].is_object());
    assert!(data["execution"]["occurrences"]["6"]["active"].get("body").is_none());
}

/// A decision record in the legacy boundary class, as the pre-v1 writer left it.
fn legacy_boundary_line() -> String {
    let digest = "a".repeat(64);
    format!(
        concat!(
            r#"{{"version":1,"id":"{d}","revision":1,"origin":{{"source":"execution-boundary","original":"missing"}},"#,
            r#""decision":{{"class":"boundary","phase":3,"tool":"cadence-apply","operation":"execution-refusal","#,
            r#""request_digest":"{d}","outcome":"refused","subject_id":null,"store_generation":1,"prompt_digest":null,"#,
            r#""response_digest":"{d}","terminal":false}},"at":1}}"#
        ),
        d = digest
    )
}

#[test]
fn a_legacy_boundary_record_writes_back_byte_identically_and_validates() {
    let line = legacy_boundary_line();
    let record: super::model::DecisionRecord = serde_json::from_str(&line).unwrap();
    assert_eq!(serde_json::to_string(&record).unwrap(), line);
    assert_eq!(super::model::validate_decisions(&[record]), Ok(()));
}

/// A sealed snapshot of a store whose execution is in the legacy format.
fn legacy_snapshot() -> Vec<u8> {
    use super::writer::install_execution;
    let mut data = json!({"other": true});
    install_execution(&mut data, admitted_execution()).unwrap();
    Snapshot::sealed(1, b"", b"", data, BTreeMap::new()).unwrap().1
}

#[test]
fn a_legacy_execution_snapshot_writes_back_byte_identically() {
    let bytes = legacy_snapshot();
    assert_eq!(Snapshot::parse(&bytes, b"", b"").unwrap().render().unwrap(), bytes);
}

#[test]
fn reading_a_legacy_execution_snapshot_repairs_nothing() {
    assert!(Snapshot::parse(&legacy_snapshot(), b"", b"").unwrap().repaired.is_empty());
}

mod boundaries {
    use super::super::model::{Decision, DecisionRecord, digest};
    use super::super::writer::{BoundaryAdmission, Prior, boundary_admission, prior};
    use super::*;
    use cadence::execution::model::{BoundaryDecision, BoundaryTool};

    fn request(phase: u32, name: &str) -> BoundaryDecision {
        BoundaryDecision {
            phase,
            tool: BoundaryTool::CadenceApply,
            operation: "execution-refusal".into(),
            request_digest: digest(name.as_bytes()),
            outcome: "refused".into(),
            subject_id: None,
            prompt_digest: None,
            response_digest: digest(format!("answer to {name}").as_bytes()),
        }
    }

    /// A boundary decision already in the log, written by hand.
    fn logged(phase: u32, index: usize, terminal: bool) -> DecisionRecord {
        let id = digest(format!("logged {phase} {index}").as_bytes());
        DecisionRecord {
            version: VERSION,
            id: id.clone(),
            revision: 1,
            origin: Origin { source: "execution-boundary".into(), original: Evidence::Missing },
            decision: Decision::Boundary {
                phase,
                tool: "cadence-apply".into(),
                operation: "execution-refusal".into(),
                request_digest: id.clone(),
                outcome: if terminal { "log-bound" } else { "refused" }.into(),
                subject_id: None,
                store_generation: index as u64 + 1,
                prompt_digest: None,
                response_digest: id,
                terminal,
            },
            at: Some(1),
        }
    }

    fn log(phase: u32, count: usize) -> Vec<DecisionRecord> {
        (0..count).map(|index| logged(phase, index, false)).collect()
    }

    /// The boundary fields of an admitted record: phase, outcome, generation,
    /// whether it is terminal, and its time.
    fn fields(record: &DecisionRecord) -> (u32, &str, u64, bool, Option<u64>) {
        let Decision::Boundary { phase, outcome, store_generation, terminal, .. } = &record.decision else {
            panic!("not a boundary decision: {record:?}")
        };
        (*phase, outcome.as_str(), *store_generation, *terminal, record.at)
    }

    #[test]
    fn a_phase_under_its_limit_admits_the_decision_to_append_at_the_given_generation_and_time() {
        let BoundaryAdmission::Proceed(record) =
            boundary_admission(&log(3, 255), &request(3, "next"), 256, Some(7)).unwrap()
        else {
            panic!("not admitted")
        };
        assert_eq!(fields(&record), (3, "refused", 256, false, Some(7)));
    }

    #[test]
    fn the_decision_after_a_phase_uses_256_is_its_terminal_log_bound_decision() {
        let BoundaryAdmission::Terminal(record) =
            boundary_admission(&log(3, 256), &request(3, "next"), 257, Some(7)).unwrap()
        else {
            panic!("not terminal")
        };
        assert_eq!(fields(&record), (3, "log-bound", 257, true, Some(7)));
    }

    #[test]
    fn decisions_of_other_phases_do_not_count_toward_the_limit() {
        let mut decisions = log(3, 255);
        decisions.extend(log(4, 10));
        assert!(matches!(
            boundary_admission(&decisions, &request(3, "next"), 266, Some(7)).unwrap(),
            BoundaryAdmission::Proceed(_)
        ));
    }

    #[test]
    fn a_decision_already_in_the_log_replays_even_once_the_phase_is_at_its_limit() {
        let BoundaryAdmission::Proceed(first) =
            boundary_admission(&[], &request(3, "first"), 1, Some(7)).unwrap()
        else {
            panic!("not admitted")
        };
        for mut decisions in [vec![], log(3, 256)] {
            decisions.push(first.clone());
            assert_eq!(
                boundary_admission(&decisions, &request(3, "first"), 300, Some(8)).unwrap(),
                BoundaryAdmission::Replay
            );
        }
    }

    #[test]
    fn a_boundary_decision_for_phase_0_is_refused() {
        assert_eq!(
            boundary_admission(&[], &request(0, "zero"), 1, Some(7)),
            Err(Error::Invalid("boundary phase must be positive".into()))
        );
    }

    fn view_with(decisions: Vec<DecisionRecord>, operations: &[(&str, &str)]) -> View {
        let mut snapshot = Snapshot::new(1, b"", b"", serde_json::Value::Null).unwrap();
        snapshot.operations = operations.iter().map(|(id, fingerprint)| (id.to_string(), fingerprint.to_string())).collect();
        View { items: vec![], decisions, snapshot }
    }

    #[test]
    fn an_operation_identity_not_in_the_view_is_new() {
        let view = view_with(log(3, 2), &[("op-1", "content-1")]);
        assert_eq!(prior(&view, "op-2", "content-2", 3), Ok(Prior::New));
    }

    #[test]
    fn a_recorded_operation_identity_replays_its_own_content_and_is_reused_by_other_content() {
        let view = view_with(vec![], &[("op-1", "content-1")]);
        assert_eq!(prior(&view, "op-1", "content-1", 3), Ok(Prior::Replay));
        assert_eq!(prior(&view, "op-1", "content-2", 3), Ok(Prior::Reused));
    }

    #[test]
    fn once_a_phase_holds_its_terminal_decision_every_request_for_it_replays() {
        let view = view_with(vec![logged(3, 256, true)], &[("op-1", "content-1")]);
        assert_eq!(prior(&view, "op-new", "anything", 3), Ok(Prior::Replay));
        assert_eq!(prior(&view, "op-1", "content-2", 3), Ok(Prior::Replay));
        assert_eq!(prior(&view, "op-new", "anything", 4), Ok(Prior::New));
    }

    #[test]
    fn a_store_holding_a_boundary_decision_in_the_legacy_format_is_refused_for_execution() {
        use super::super::writer::require_current_execution;
        assert_eq!(
            require_current_execution(&view_with(vec![logged(3, 0, false)], &[])),
            Err(cadence::execution::boundary::Failure::LegacyExecution)
        );
    }

    #[test]
    fn a_blank_operation_identity_is_refused() {
        assert_eq!(
            prior(&view_with(vec![], &[]), " \t", "content", 3),
            Err(Error::Invalid("empty operation identity".into()))
        );
    }

    #[test]
    fn a_refusal_appends_its_decision_and_changes_no_data() {
        use super::super::writer::append_admitted_boundary;
        let mut view = View {
            items: vec![],
            decisions: log(3, 2),
            snapshot: Snapshot::new(3, b"", b"", json!({"execution": {"schema": 1}, "other": true})).unwrap(),
        };
        let data = view.snapshot.data.clone();
        let admitted = boundary_admission(&view.decisions, &request(3, "refused"), 4, Some(7)).unwrap();
        append_admitted_boundary(&mut view, admitted).unwrap();
        assert_eq!((view.decisions.len(), &view.snapshot.data), (3, &data));
    }
}

mod scoped {
    use super::super::model::{BoundaryRecordV1, Decision, DecisionRecord, digest};
    use super::super::writer::{BoundaryChange, ScopedAdmission, scoped_admission};
    use super::*;
    use cadence::envelope::Envelope;
    use cadence::execution::boundary::{BoundaryScope, BoundaryV1, PreparedAnswer};
    use cadence::execution::model::BoundaryTool;

    const PHASE: BoundaryScope = BoundaryScope::Execution { phase: 3 };

    fn boundary(scope: BoundaryScope, operation: &str, name: &str) -> BoundaryV1 {
        let answer = PreparedAnswer::new(Envelope::Refused { code: "refused".into(), reason: name.into() }).unwrap();
        BoundaryV1::new(scope, BoundaryTool::CadenceApply, operation.into(), digest(name.as_bytes()), None, &answer)
    }

    /// A scoped decision already in the log, written by hand.
    fn logged(scope: BoundaryScope, operation: &str, index: usize) -> DecisionRecord {
        DecisionRecord {
            version: VERSION,
            id: digest(format!("logged {scope:?} {operation} {index}").as_bytes()),
            revision: 1,
            origin: Origin { source: "execution-boundary-v1".into(), original: Evidence::Missing },
            decision: Decision::BoundaryV1(BoundaryRecordV1 {
                boundary: boundary(scope, operation, &format!("logged {index}")),
                store_generation: index as u64 + 1,
                terminal: false,
            }),
            at: Some(1),
        }
    }

    fn log(scope: BoundaryScope, operation: &str, count: usize) -> Vec<DecisionRecord> {
        (0..count).map(|index| logged(scope.clone(), operation, index)).collect()
    }

    fn admit(decisions: &[DecisionRecord], decision: &BoundaryV1) -> ScopedAdmission {
        scoped_admission(decisions, "new-decision", decision, &BoundaryChange::Observe, 300, Some(9)).unwrap()
    }

    fn view_of(decisions: Vec<DecisionRecord>, data: serde_json::Value) -> View {
        View { items: vec![], decisions, snapshot: Snapshot::new(1, b"", b"", data).unwrap() }
    }

    /// The terminal log-bound decision of `scope`, written by hand.
    fn terminal(scope: BoundaryScope) -> DecisionRecord {
        let mut record = logged(scope, "log-bound", 256);
        let Decision::BoundaryV1(value) = &mut record.decision else { unreachable!() };
        value.terminal = true;
        record
    }

    #[test]
    fn a_scope_holding_its_terminal_decision_is_answered_by_it_and_no_other_scope_is() {
        use super::super::writer::terminal_v1;
        let mut decisions = log(PHASE, "executor", 256);
        decisions.push(terminal(PHASE));
        let id = decisions[256].id.clone();
        let view = view_of(decisions, serde_json::Value::Null);
        assert_eq!(terminal_v1(&view, &PHASE).map(|found| found.id), Some(id.as_str()));
        assert!(terminal_v1(&view, &BoundaryScope::Execution { phase: 4 }).is_none());
        assert!(terminal_v1(&view_of(log(PHASE, "executor", 256), serde_json::Value::Null), &PHASE).is_none());
    }

    #[test]
    fn an_execution_occurrence_with_no_scoped_decision_is_in_the_legacy_format() {
        use super::super::writer::require_current_execution;
        use cadence::execution::boundary::Failure;
        let data = json!({"execution": {"occurrences": {"3": {"active": null}}}});
        assert_eq!(require_current_execution(&view_of(vec![], data.clone())), Err(Failure::LegacyExecution));
        assert_eq!(require_current_execution(&view_of(log(BoundaryScope::Execution { phase: 4 }, "executor", 1), data.clone())), Err(Failure::LegacyExecution));
        assert_eq!(require_current_execution(&view_of(log(PHASE, "executor", 1), data)), Ok(()));
    }

    #[test]
    fn a_scope_under_its_limit_proceeds() {
        assert_eq!(admit(&log(PHASE, "executor", 255), &boundary(PHASE, "executor", "next")), ScopedAdmission::Proceed);
    }

    #[test]
    fn the_write_after_a_scope_uses_256_is_its_terminal_log_bound_decision() {
        let ScopedAdmission::Terminal(record) = admit(&log(PHASE, "executor", 256), &boundary(PHASE, "executor", "next"))
        else {
            panic!("not terminal")
        };
        let Decision::BoundaryV1(value) = &record.decision else { panic!("not scoped: {record:?}") };
        assert_eq!(
            (&value.boundary.scope, value.boundary.operation.as_str(), value.store_generation, value.terminal, record.at),
            (&PHASE, "log-bound", 300, true, Some(9))
        );
    }

    #[test]
    fn a_scope_counts_only_its_own_ordinary_decisions() {
        let mut decisions = log(PHASE, "executor", 255);
        decisions.extend(log(BoundaryScope::RootRefusal, "executor", 10));
        decisions.extend(log(BoundaryScope::Execution { phase: 4 }, "executor", 10));
        decisions.extend(log(PHASE, "native-refusal", 10));
        assert_eq!(admit(&decisions, &boundary(PHASE, "executor", "next")), ScopedAdmission::Proceed);
    }

    #[test]
    fn a_native_refusal_is_never_limited() {
        assert_eq!(
            admit(&log(PHASE, "executor", 256), &boundary(PHASE, "native-refusal", "next")),
            ScopedAdmission::Proceed
        );
    }

    #[test]
    fn a_logged_decision_under_another_operation_replays_an_observation_and_refuses_a_change() {
        let decisions = log(PHASE, "executor", 2);
        let decision = boundary(PHASE, "executor", "logged 1");
        let id = decisions[1].id.clone();
        assert_eq!(
            scoped_admission(&decisions, &id, &decision, &BoundaryChange::Observe, 3, Some(9)),
            Ok(ScopedAdmission::Replay)
        );
        let change = BoundaryChange::FinalizeRisk { phase: 3, requirements: vec![] };
        assert_eq!(
            scoped_admission(&decisions, &id, &decision, &change, 3, Some(9)),
            Err(Error::Conflict("boundary decision already admitted under another operation".into()))
        );
    }

    #[test]
    fn the_root_refusal_scope_reaches_its_own_limit() {
        let root = BoundaryScope::RootRefusal;
        assert!(matches!(
            admit(&log(root.clone(), "executor", 256), &boundary(root, "executor", "next")),
            ScopedAdmission::Terminal(_)
        ));
    }

    #[test]
    fn a_store_with_no_execution_records_is_not_legacy() {
        use super::super::writer::require_current_execution;
        assert_eq!(require_current_execution(&view_of(vec![], json!({"import": {"complete": true}}))), Ok(()));
    }

    #[test]
    fn a_legacy_store_is_refused_as_an_unsupported_cross_format_resume() {
        use super::super::writer::require_current_execution;
        let data = json!({"execution": {"occurrences": {"3": {"active": null}}}});
        assert_eq!(
            require_current_execution(&view_of(vec![], data)).unwrap_err().to_string(),
            "cross-format native execution resume is unsupported"
        );
    }

    #[test]
    fn a_confirmed_boundary_answers_its_compact_envelope_only_under_its_canonical_digest() {
        use super::super::writer::ConfirmedBoundary;
        let record = logged(PHASE, "executor", 1);
        let Decision::BoundaryV1(value) = &record.decision else { unreachable!() };
        assert_eq!(
            ConfirmedBoundary { id: &record.id, value }.envelope(None).unwrap(),
            Envelope::Refused { code: "refused".into(), reason: "logged 1".into() }
        );
        let mut tampered = value.clone();
        tampered.boundary.response_digest = digest(b"another answer");
        assert!(ConfirmedBoundary { id: &record.id, value: &tampered }.envelope(None).is_err());
    }

    #[test]
    fn a_scope_holding_its_terminal_decision_confirms_every_later_request_with_it() {
        use super::super::writer::confirmed_boundary;
        let mut decisions = log(PHASE, "executor", 256);
        decisions.push(terminal(PHASE));
        let id = decisions[256].id.clone();
        let view = view_of(decisions, serde_json::Value::Null);
        assert_eq!(
            confirmed_boundary(&view, &boundary(PHASE, "executor", "later")).map(|found| found.id.to_string()),
            Ok(id)
        );
    }

    #[test]
    fn a_caller_transaction_may_not_carry_a_phase_summary() {
        use super::super::writer::caller_target;
        assert_eq!(caller_target("phase-summary:3"), Ok(false));
        assert_eq!(caller_target("repo-config"), Ok(true));
    }

    #[test]
    fn a_summary_rendered_by_another_version_is_refused() {
        use super::super::writer::supported_render;
        let current = cadence::execution::render::SUMMARY_RENDER_VERSION;
        assert!(supported_render(current));
        assert!(!supported_render(current + 1));
    }

    #[test]
    fn a_risk_pending_patch_is_accepted_only_while_it_leaves_the_phase_open() {
        use super::super::writer::patch_boundary_valid;
        use cadence::execution::model::{ExecutorPatch, PatchKind, PlanDisposition};
        let answer = PreparedAnswer::new(Envelope::Refused { code: "risk-pending".into(), reason: "review pending".into() }).unwrap();
        let decision = BoundaryV1::new(PHASE, BoundaryTool::CadenceApply, "executor".into(), digest(b"patch"), Some("d-1".into()), &answer);
        let patch = ExecutorPatch {
            schema: 1, kind: PatchKind::Executor, dispatch_id: "d-1".into(), expected_execution_version: 1,
            outcome: PlanDisposition::Complete, tasks: vec![], deviations: vec![], blockers: vec![],
        };
        let render = cadence::execution::render::SUMMARY_RENDER_VERSION;
        assert!(patch_boundary_valid(&decision, &patch, render, false));
        assert!(!patch_boundary_valid(&decision, &patch, render, true));
    }

    fn step(view: &View, operation: &str, decision: &BoundaryV1) -> super::super::writer::BoundaryStep {
        super::super::writer::boundary_step(view, operation, decision, &BoundaryChange::Observe, 300, Some(9)).unwrap()
    }

    #[test]
    fn a_later_request_in_a_scope_holding_its_terminal_is_answered_without_a_write() {
        use super::super::writer::BoundaryStep;
        let mut decisions = log(PHASE, "executor", 256);
        decisions.push(terminal(PHASE));
        let view = view_of(decisions, serde_json::Value::Null);
        assert_eq!(step(&view, "later", &boundary(PHASE, "executor", "later")), BoundaryStep::Replay);
    }

    #[test]
    fn an_operation_already_recorded_with_the_same_content_is_answered_without_a_write() {
        use super::super::writer::{BoundaryStep, boundary_operation};
        let decision = boundary(PHASE, "executor", "again");
        let fingerprint = boundary_operation(&BTreeMap::new(), "op-1", &decision, &BoundaryChange::Observe).unwrap().unwrap();
        let mut view = view_of(vec![], serde_json::Value::Null);
        view.snapshot.operations.insert("op-1".into(), fingerprint);
        assert_eq!(step(&view, "op-1", &decision), BoundaryStep::Replay);
    }

    #[test]
    fn the_write_after_a_scope_uses_256_is_its_terminal_step() {
        use super::super::writer::BoundaryStep;
        let view = view_of(log(PHASE, "executor", 256), serde_json::Value::Null);
        assert!(matches!(step(&view, "next", &boundary(PHASE, "executor", "next")), BoundaryStep::Terminal(_)));
    }

    #[test]
    fn a_terminal_decision_changes_no_data_and_no_operations() {
        use super::super::writer::{BoundaryStep, terminal_next};
        // A log the store's own validation accepts: each record under its identity.
        let valid: Vec<DecisionRecord> = (0..256)
            .map(|index| {
                let boundary = boundary(PHASE, "executor", &format!("valid {index}"));
                DecisionRecord {
                    version: VERSION,
                    id: boundary.identity().unwrap(),
                    revision: 1,
                    origin: Origin { source: "execution-boundary-v1".into(), original: Evidence::Missing },
                    decision: Decision::BoundaryV1(BoundaryRecordV1 { boundary, store_generation: index as u64 + 1, terminal: false }),
                    at: Some(1),
                }
            })
            .collect();
        let mut view = view_of(valid, json!({"execution": {"schema": 1}}));
        view.snapshot.operations.insert("op-1".into(), "fp".into());
        let BoundaryStep::Terminal(record) = step(&view, "next", &boundary(PHASE, "executor", "next")) else {
            panic!("no terminal step")
        };
        let next = terminal_next(&view, *record).unwrap();
        assert_eq!(
            (&next.snapshot.data, &next.snapshot.operations, next.decisions.len()),
            (&view.snapshot.data, &view.snapshot.operations, 257)
        );
    }

    #[test]
    fn a_root_refusal_logs_its_decision_and_operation_and_changes_no_data() {
        use super::super::writer::boundary_tail;
        let view = view_of(vec![], json!({"execution": {"schema": 1}, "other": true}));
        let refusal = boundary(BoundaryScope::RootRefusal, "executor", "refused");
        let (next, operations) = boundary_tail(view.clone(), refusal, "op-1", "fp".into(), 2, Some(9)).unwrap();
        assert_eq!(
            (&next.snapshot.data, operations.get("op-1").map(String::as_str), next.decisions.len()),
            (&view.snapshot.data, Some("fp"), 1)
        );
    }

    #[test]
    fn a_boundary_write_on_a_legacy_store_keeps_its_data_operations_and_decision_bytes() {
        use super::super::writer::boundary_tail;
        let legacy: DecisionRecord = serde_json::from_str(&super::legacy_boundary_line()).unwrap();
        let mut view = view_of(vec![legacy], json!({"execution": {"schema": 1}, "other": true}));
        view.snapshot.operations.insert("earlier".into(), "fp-earlier".into());
        let refusal = boundary(BoundaryScope::RootRefusal, "executor", "refused");
        let (next, operations) = boundary_tail(view.clone(), refusal, "op-1", "fp".into(), 2, Some(9)).unwrap();
        assert_eq!(next.snapshot.data, view.snapshot.data);
        assert_eq!(operations.get("earlier").map(String::as_str), Some("fp-earlier"));
        assert_eq!(serde_json::to_string(&next.decisions[0]).unwrap(), super::legacy_boundary_line());
    }
}

mod writes {
    use super::super::model::{Decision, DecisionRecord};
    use super::super::transaction::{ExternalChange, Transaction};
    use super::super::writer::{sealed, transact};
    use super::*;

    fn routing(id: &str, observed_effort: Evidence) -> DecisionRecord {
        DecisionRecord {
            version: VERSION,
            id: id.into(),
            revision: 1,
            origin: Origin { source: "worker".into(), original: Evidence::Missing },
            decision: Decision::Routing {
                choice: "worker-a".into(),
                config_provenance: BTreeMap::new(),
                requested_effort: Evidence::Text("high".into()),
                observed_effort,
                receipt: Evidence::Missing,
            },
            at: Some(1),
        }
    }

    /// A view holding item `a` and decision `first`, with data `{"kept": true}`.
    fn current() -> View {
        View {
            items: vec![item("a")],
            decisions: vec![routing("first", Evidence::Missing)],
            snapshot: Snapshot::new(1, b"", b"", json!({"kept": true})).unwrap(),
        }
    }

    fn transaction(snapshot: Option<serde_json::Value>) -> Transaction {
        Transaction {
            id: "tx-1".into(),
            items: vec![item("b")],
            decisions: vec![routing("second", Evidence::Text(" \t".into()))],
            snapshot,
            external: vec![ExternalChange {
                target: "global-config".into(),
                expected: file(b"old\n", "config"),
                bytes: b"new\n".to_vec(),
            }],
        }
    }

    #[test]
    fn a_transaction_appends_its_items_and_decisions_after_the_existing_ones() {
        let mut next = current();
        transact(&mut next, &mut BTreeMap::new(), transaction(None), "fp".into()).unwrap();
        assert_eq!(next.items.iter().map(|item| item.id.as_str()).collect::<Vec<_>>(), ["a", "b"]);
        assert_eq!(next.decisions.iter().map(|record| record.id.as_str()).collect::<Vec<_>>(), ["first", "second"]);
    }

    #[test]
    fn a_transaction_records_its_identity_with_its_fingerprint() {
        let mut operations = BTreeMap::from([("tx-0".to_string(), "older".to_string())]);
        transact(&mut current(), &mut operations, transaction(None), "fp".into()).unwrap();
        assert_eq!(
            operations,
            BTreeMap::from([("tx-0".to_string(), "older".to_string()), ("tx-1".to_string(), "fp".to_string())])
        );
    }

    #[test]
    fn a_transactions_decisions_are_normalized_as_they_are_appended() {
        let mut next = current();
        transact(&mut next, &mut BTreeMap::new(), transaction(None), "fp".into()).unwrap();
        assert_eq!(next.decisions[1], routing("second", Evidence::Missing));
    }

    #[test]
    fn snapshot_data_in_a_transaction_replaces_the_data_and_its_absence_keeps_it() {
        let mut replaced = current();
        transact(&mut replaced, &mut BTreeMap::new(), transaction(Some(json!({"new": 1}))), "fp".into()).unwrap();
        assert_eq!(replaced.snapshot.data, json!({"new": 1}));
        let mut kept = current();
        transact(&mut kept, &mut BTreeMap::new(), transaction(None), "fp".into()).unwrap();
        assert_eq!(kept.snapshot.data, json!({"kept": true}));
    }

    #[test]
    fn a_transaction_answers_the_external_participants_it_brings() {
        let external = transact(&mut current(), &mut BTreeMap::new(), transaction(None), "fp".into()).unwrap();
        assert_eq!(external.iter().map(|change| change.target.as_str()).collect::<Vec<_>>(), ["global-config"]);
    }

    #[test]
    fn a_transaction_whose_item_skips_a_revision_is_refused() {
        let mut skipped = transaction(None);
        skipped.items[0].id = "a".into();
        skipped.items[0].revision = 3;
        assert_eq!(
            transact(&mut current(), &mut BTreeMap::new(), skipped, "fp".into()).map(|_| ()),
            Err(Error::Invalid("unsupported version, empty identity, or inconsistent revision".into()))
        );
    }

    fn observed() -> BTreeMap<String, Observed> {
        [ITEMS, DECISIONS, STATE].into_iter().map(|name| (name.to_string(), file(name.as_bytes(), "store"))).collect()
    }

    fn own() -> Vec<super::super::transaction::Participant> {
        vec![ExternalChange { target: "phase-summary:3".into(), expected: absent(), bytes: b"# Summary\n".to_vec() }]
    }

    #[test]
    fn a_sealed_write_is_at_the_given_generation_with_its_operations_and_data() {
        let operations = BTreeMap::from([("tx-1".to_string(), "fp".to_string())]);
        let (next, _) = sealed(current(), operations.clone(), own(), 5, &observed()).unwrap();
        assert_eq!(
            (next.snapshot.generation, &next.snapshot.operations, &next.snapshot.data),
            (5, &operations, &json!({"kept": true}))
        );
    }

    #[test]
    fn the_store_files_follow_the_writes_own_participants_with_the_state_last_each_expected_as_observed() {
        let (_, participants) = sealed(current(), BTreeMap::new(), own(), 5, &observed()).unwrap();
        assert_eq!(
            participants.iter().map(|p| p.target.as_str()).collect::<Vec<_>>(),
            ["phase-summary:3", ITEMS, DECISIONS, STATE]
        );
        for participant in &participants[1..] {
            assert_eq!(participant.expected, observed()[&participant.target], "{}", participant.target);
        }
    }

    #[test]
    fn the_sealed_files_read_back_as_the_sealed_view() {
        let (next, participants) = sealed(current(), BTreeMap::new(), vec![], 5, &observed()).unwrap();
        let files = participants
            .iter()
            .map(|p| (p.target.clone(), file(&p.bytes, "store")))
            .collect::<BTreeMap<_, _>>();
        assert_eq!(view(&files).unwrap(), next);
    }
}

mod checked {
    use super::super::writer::CheckedPolicy;
    use super::super::{MutationContext, Policy, Result};
    use super::*;
    use std::sync::{Arc, Mutex};

    /// A store policy that records each call and allows it.
    struct Recording(Arc<Mutex<usize>>);
    impl Policy for Recording {
        fn validate(&mut self, _: &MutationContext<'_>) -> Result<()> {
            *self.0.lock().unwrap() += 1;
            Ok(())
        }
    }

    fn checked(check: Result<()>) -> (CheckedPolicy<Recording>, Arc<Mutex<usize>>) {
        let calls = Arc::new(Mutex::new(0));
        let check = Box::new(move || check.clone());
        (CheckedPolicy { policy: Recording(calls.clone()), check: Some(check) }, calls)
    }

    fn validate(policy: &mut CheckedPolicy<Recording>) -> Result<()> {
        let snapshot = Snapshot::new(1, b"", b"", serde_json::Value::Null).unwrap();
        policy.validate(&MutationContext { operation: "store", snapshot: &snapshot })
    }

    #[test]
    fn a_failing_input_check_refuses_before_the_store_policy_runs() {
        let changed = Error::Conflict("interview config inputs changed".into());
        let (mut policy, calls) = checked(Err(changed.clone()));
        assert_eq!(validate(&mut policy), Err(changed));
        assert_eq!(*calls.lock().unwrap(), 0);
    }

    #[test]
    fn a_passing_input_check_hands_every_validation_to_the_store_policy() {
        let (mut policy, calls) = checked(Ok(()));
        validate(&mut policy).unwrap();
        validate(&mut policy).unwrap();
        assert_eq!(*calls.lock().unwrap(), 2);
    }

    #[test]
    fn a_failing_input_check_refuses_a_routing_admission_too() {
        let changed = Error::Conflict("interview config inputs changed".into());
        let (mut policy, calls) = checked(Err(changed.clone()));
        let snapshot = Snapshot::new(1, b"", b"", serde_json::Value::Null).unwrap();
        let inputs = cadence::execution::model::ConfigInputs {
            repo: cadence::execution::model::ConfigInput { identity: "/project/config.v4.json".into(), content: None, stamp: None },
            global: None,
            global_alias: false,
        };
        assert_eq!(
            policy.validate_routing_admission(&MutationContext { operation: "store", snapshot: &snapshot }, &inputs),
            Err(changed)
        );
        assert_eq!(*calls.lock().unwrap(), 0);
    }
}
