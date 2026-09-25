use cadence::rail::{
    receipts::{self, Binding, Boundary, Consequence, Fire, Receipt, Requirement, State},
    risk::{MaterialIdentity, Observation, Recorded},
};
use serde_json::{Value, json};

fn observation(generation: u64, staged: bool) -> Recorded {
    // Hand-encoded wire inputs, independent of the production receipt serializer.
    let mut value = json!({
        "version":1, "request_id":format!("scan-{generation}"), "request_digest":"a".repeat(64),
        "scope":{"project":"/tmp/project","planning_root":"/tmp/project/.planning",
            "cycle":"live","occurrence":"run-one","phase":7,"worker":"4","plan":null},
        "source":{"kind":"committed","base":"HEAD~1","head":"HEAD"},
        "resolution":{"kind":"committed","base_id":"b".repeat(40),"head_id":"c".repeat(40)},
        "outcome":"checked", "surfaces":["auth","secrets"],
        "scan":{"checked":true,"categories":["auth","secrets"],
            "matches":[{"category":"auth","signal":"path segment auth"}],
            "inconclusive":false,"empty":false}, "diagnostics":[]
    });
    if staged {
        value["source"] = json!({"kind":"staged","base":"HEAD"});
        value["resolution"] =
            json!({"kind":"staged","base_id":"b".repeat(40),"index_id":"d".repeat(40)});
    }
    Recorded::new(serde_json::from_value(value).unwrap(), generation).unwrap()
}

fn wanted(record: &Recorded) -> Requirement {
    Requirement {
        boundary: Boundary {
            scope: record.observation.scope.clone(),
            run_id: "run-one".into(),
            after_generation: 1,
        },
        material: record.observation.resolution.material().unwrap(),
        surfaces: record.observation.surfaces.clone(),
    }
}

fn fire(record: &Recorded) -> Fire {
    Fire {
        id: format!("fire-{}", record.confirmation.generation),
        binding: Binding::new(wanted(record).boundary, record).unwrap(),
        review_scope: vec!["auth/login.rs".into(), "auth/session.rs".into()],
        rearm_of: None,
    }
}

fn receipt(fire: &Fire, consequence: Value) -> Receipt {
    // The expected contract spells out every field; no receipt round-trip supplies it.
    let material = match &fire.binding.material {
        MaterialIdentity::Committed { base_id, head_id } => {
            json!({"kind":"committed","base_id":base_id,"head_id":head_id})
        }
        MaterialIdentity::Staged { base_id, index_id } => {
            json!({"kind":"staged","base_id":base_id,"index_id":index_id})
        }
    };
    serde_json::from_value(json!({
        "id":format!("receipt-{}",fire.id),
        "fire":{"id":fire.id,"binding":{
            "boundary":{"scope":{"project":"/tmp/project","planning_root":"/tmp/project/.planning",
                "cycle":"live","occurrence":"run-one","phase":7,"worker":"4","plan":null},
                "run_id":"run-one","after_generation":1},
            "observation":{"generation":fire.binding.observation.generation,
                "decision_id":fire.binding.observation.decision_id,"observation_digest":fire.binding.observation.observation_digest},
            "material":material,"surfaces":["auth","secrets"]},
            "review_scope":fire.review_scope,"rearm_of":fire.rearm_of},
        "consequence":consequence
    })).unwrap()
}

fn assess(record: &Recorded, fires: &[Fire], receipts: &[Receipt]) -> receipts::Status {
    receipts::status(
        &wanted(record),
        std::slice::from_ref(record),
        fires,
        receipts,
    )
    .unwrap()
}

fn edit(record: &Recorded, change: impl FnOnce(&mut Value)) -> Recorded {
    let mut value = serde_json::to_value(&record.observation).unwrap();
    change(&mut value);
    Recorded::new(
        serde_json::from_value::<Observation>(value).unwrap(),
        record.confirmation.generation,
    )
    .unwrap()
}

fn unchecked_scan(record: &Recorded) -> Recorded {
    edit(record, |r| {
        r["outcome"] = json!("unchecked");
        r["scan"]["checked"] = json!(false);
        r["scan"]["inconclusive"] = json!(true);
        r["scan"]["matches"] = json!([]);
    })
}

#[test]
fn a_requirement_with_no_observation_is_missing() {
    let record = observation(2, false);
    assert_eq!(
        receipts::status(&wanted(&record), &[], &[], &[])
            .unwrap()
            .state,
        State::Missing
    );
}

#[test]
fn a_matched_observation_with_no_fire_is_unfired_and_not_permission() {
    let record = observation(2, false);
    let result = assess(&record, &[], &[]);
    assert_eq!(result.state, State::Unfired);
    assert!(!result.permits_continuation);
}

#[test]
fn a_fire_with_no_receipt_is_pending() {
    let record = observation(2, false);
    let fired = fire(&record);
    assert_eq!(assess(&record, &[fired], &[]).state, State::Pending);
}

#[test]
fn an_unchecked_observation_is_unchecked_and_not_permission() {
    let unchecked = unchecked_scan(&observation(2, false));
    let result = assess(&unchecked, &[], &[]);
    assert_eq!(result.state, State::Unchecked);
    assert!(!result.permits_continuation);
}

#[test]
fn history_refuses_a_fire_bound_to_an_unchecked_observation() {
    let record = observation(2, false);
    let unchecked = unchecked_scan(&record);
    let mut invalid = fire(&record);
    invalid.binding = Binding::new(wanted(&unchecked).boundary, &unchecked).unwrap();
    assert!(receipts::validate_history(&[unchecked], &[invalid], &[]).is_err());
}

fn gate_pass(fired: &Fire, evidence_id: &str) -> Receipt {
    receipt(
        fired,
        json!({"kind":"gate-pass","evidence_id":evidence_id}),
    )
}

#[test]
fn a_staged_resolution_serializes_a_null_head_id_beside_its_index_id() {
    let record = observation(2, true);
    let wire = serde_json::to_value(&record.observation.resolution).unwrap();
    assert!(wire["head_id"].is_null());
    assert_eq!(wire["index_id"], "d".repeat(40));
}

#[test]
fn a_gate_pass_bound_to_the_exact_material_settles_and_permits_continuation() {
    for staged in [false, true] {
        let record = observation(2, staged);
        let fired = fire(&record);
        let outcome = gate_pass(&fired, "review-accepted");
        let result = assess(
            &record,
            std::slice::from_ref(&fired),
            std::slice::from_ref(&outcome),
        );
        assert_eq!(result.state, State::Settled);
        assert!(result.permits_continuation);
    }
}

#[test]
fn status_refuses_a_receipt_whose_base_or_tip_differs_from_its_fire() {
    for staged in [false, true] {
        let record = observation(2, staged);
        let fired = fire(&record);
        let outcome = gate_pass(&fired, "review-accepted");
        for field in ["base", "tip"] {
            let mut wrong = outcome.clone();
            match &mut wrong.fire.binding.material {
                MaterialIdentity::Committed { base_id, head_id } => {
                    *if field == "base" { base_id } else { head_id } = "e".repeat(40);
                }
                MaterialIdentity::Staged { base_id, index_id } => {
                    *if field == "base" { base_id } else { index_id } = "e".repeat(40);
                }
            }
            assert!(
                receipts::status(
                    &wanted(&record),
                    std::slice::from_ref(&record),
                    std::slice::from_ref(&fired),
                    &[wrong]
                )
                .is_err()
            );
        }
    }
}

#[test]
fn scope_run_signoff_and_scan_generation_are_required_before_material() {
    let record = observation(2, true);
    let fired = fire(&record);
    let outcome = receipt(
        &fired,
        json!({"kind":"gate-pass","evidence_id":"review-one"}),
    );
    let original = wanted(&record);
    for change in 0..9 {
        let mut wanted = original.clone();
        let cadence::rail::risk::Scope::Phase { project, planning_root, cycle, occurrence, phase, worker, plan } = &mut wanted.boundary.scope else { panic!("phase fixture"); };
        match change {
            0 => project.push('x'),
            1 => planning_root.push('x'),
            2 => *cycle = "archived".into(),
            3 => *occurrence = "different".into(),
            4 => *phase = 8.try_into().unwrap(),
            5 => *worker = Some("5".into()),
            6 => *plan = Some(5.try_into().unwrap()),
            7 => wanted.boundary.run_id = "run-two".into(),
            _ => wanted.boundary.after_generation = 2,
        }
        let result = receipts::status(
            &wanted,
            std::slice::from_ref(&record),
            std::slice::from_ref(&fired),
            std::slice::from_ref(&outcome),
        )
        .unwrap();
        assert_eq!(result.state, State::Missing, "boundary {change}");
        assert!(!result.permits_continuation);
    }
    let later = observation(3, true);
    let result = receipts::status(&original, &[record, later], &[fired], &[outcome]).unwrap();
    assert_eq!(result.state, State::Unfired);
    assert!(!result.permits_continuation);
}

#[test]
fn widened_range_changed_index_or_selection_is_stale() {
    for staged in [false, true] {
        let record = observation(2, staged);
        let fired = fire(&record);
        let outcome = receipt(
            &fired,
            json!({"kind":"gate-pass","evidence_id":"review-one"}),
        );
        for change in 0..3 {
            let mut wanted = wanted(&record);
            match change {
                0 => match &mut wanted.material {
                    MaterialIdentity::Committed { base_id, .. }
                    | MaterialIdentity::Staged { base_id, .. } => *base_id = "e".repeat(40),
                },
                1 => match &mut wanted.material {
                    MaterialIdentity::Committed { head_id, .. } => *head_id = "e".repeat(40),
                    MaterialIdentity::Staged { index_id, .. } => *index_id = "e".repeat(40),
                },
                _ => wanted.surfaces.push("billing".into()),
            }
            let result = receipts::status(
                &wanted,
                std::slice::from_ref(&record),
                std::slice::from_ref(&fired),
                std::slice::from_ref(&outcome),
            )
            .unwrap();
            assert_eq!(result.state, State::Stale);
            assert!(!result.permits_continuation);
        }
    }
}

#[test]
fn every_relevant_fire_needs_its_own_consequence() {
    let first = observation(2, false);
    let second = observation(3, false);
    let one = fire(&first);
    let two = fire(&second);
    let outcome = receipt(
        &two,
        json!({"kind":"gate-pass","evidence_id":"second-review"}),
    );
    let result = receipts::status(
        &wanted(&second),
        &[first, second],
        &[one.clone(), two],
        &[outcome],
    )
    .unwrap();
    assert_eq!(result.state, State::Pending);
    assert_eq!(result.pending_fires, vec![one.id]);
}

#[test]
fn clear_inconclusive_and_no_range_keep_distinct_meanings() {
    let record = observation(2, false);
    let clear = edit(&record, |r| {
        r["scan"]["matches"] = json!([]);
        r["scan"]["empty"] = json!(true);
    });
    let result = assess(&clear, &[], &[]);
    assert_eq!(result.state, State::Clear);
    assert!(result.permits_continuation);
    let inconclusive = edit(&record, |r| {
        r["scan"]["matches"] = json!([]);
        r["scan"]["inconclusive"] = json!(true);
    });
    assert_eq!(assess(&inconclusive, &[], &[]).state, State::Unfired);
    let skipped = edit(&record, |r| {
        r["resolution"]["head_id"] = json!("b".repeat(40));
        r["scan"] = Value::Null;
        r["outcome"] = json!("no-range");
    });
    let result = assess(&skipped, &[], &[]);
    assert_eq!(result.state, State::Skipped);
    assert!(result.permits_continuation);
}

fn settle(consequence: Value) -> receipts::Status {
    let record = observation(2, true);
    let fired = fire(&record);
    let outcome = receipt(&fired, consequence);
    assess(&record, std::slice::from_ref(&fired), &[outcome])
}

#[test]
fn validate_refuses_a_blank_override_reason() {
    let fired = fire(&observation(2, true));
    let outcome = receipt(&fired, json!({"kind":"override","reason":"  \n"}));
    assert!(outcome.validate(&fired).is_err());
}

#[test]
fn validate_refuses_an_empty_gate_pass_evidence_id() {
    let fired = fire(&observation(2, true));
    let outcome = receipt(&fired, json!({"kind":"gate-pass","evidence_id":""}));
    assert!(outcome.validate(&fired).is_err());
}

#[test]
fn an_override_with_a_reason_settles_and_permits_continuation() {
    let result =
        settle(json!({"kind":"override","reason":"Accept for this occurrence and material"}));
    assert_eq!(result.state, State::Settled);
    assert!(result.permits_continuation);
    assert!(result.deferred_work.is_empty());
}

#[test]
fn a_failed_adjudication_stays_pending() {
    let result =
        settle(json!({"kind":"adjudication","passed":false,"evidence_id":"surviving-findings"}));
    assert_eq!(result.state, State::Pending);
    assert!(!result.permits_continuation);
    assert!(result.deferred_work.is_empty());
}

#[test]
fn a_passed_adjudication_settles_and_permits_continuation() {
    let result = settle(json!({"kind":"adjudication","passed":true,"evidence_id":"adjudicated"}));
    assert_eq!(result.state, State::Settled);
    assert!(result.permits_continuation);
    assert!(result.deferred_work.is_empty());
}

#[test]
fn a_deferral_that_permits_continuation_is_deferred_with_its_work() {
    let result =
        settle(json!({"kind":"deferral","pending_id":"queue-1","permits_continuation":true}));
    assert_eq!(result.state, State::Deferred);
    assert!(result.permits_continuation);
    assert!(!result.deferred_work.is_empty());
}

#[test]
fn a_deferral_that_withholds_continuation_stays_pending_with_its_work() {
    let result =
        settle(json!({"kind":"deferral","pending_id":"queue-1","permits_continuation":false}));
    assert_eq!(result.state, State::Pending);
    assert!(!result.permits_continuation);
    assert!(!result.deferred_work.is_empty());
}

struct Rearmed {
    wanted: Requirement,
    records: [Recorded; 2],
    one: Fire,
    two: Fire,
    rearm: Receipt,
}

/// A fire rearmed once onto a later index, with its review scope narrowed.
fn rearmed() -> Rearmed {
    let first = observation(2, true);
    let second = edit(&observation(3, true), |r| {
        r["resolution"]["index_id"] = json!("e".repeat(40))
    });
    let one = fire(&first);
    let mut two = fire(&second);
    two.rearm_of = Some(one.id.clone());
    two.review_scope.pop();
    let rearm = Receipt {
        id: "rearm-once".into(),
        fire: one.clone(),
        consequence: Consequence::Rearm {
            next_fire: Box::new(two.clone()),
        },
    };
    Rearmed {
        wanted: wanted(&second),
        records: [first, second],
        one,
        two,
        rearm,
    }
}

#[test]
fn a_narrowed_rearm_is_unfired_until_its_new_fire_exists() {
    let r = rearmed();
    let result = receipts::status(
        &r.wanted,
        &r.records,
        std::slice::from_ref(&r.one),
        std::slice::from_ref(&r.rearm),
    )
    .unwrap();
    assert_eq!(result.state, State::Unfired);
}

#[test]
fn a_narrowed_rearm_is_pending_on_its_new_fire() {
    let r = rearmed();
    let result = receipts::status(
        &r.wanted,
        &r.records,
        &[r.one, r.two.clone()],
        std::slice::from_ref(&r.rearm),
    )
    .unwrap();
    assert_eq!(result.state, State::Pending);
    assert_eq!(result.pending_fires, vec![r.two.id]);
}

#[test]
fn a_narrowed_rearm_permits_continuation_after_its_own_pass() {
    let r = rearmed();
    let passed = receipt(
        &r.two,
        json!({"kind":"gate-pass","evidence_id":"second-review"}),
    );
    assert!(
        receipts::status(&r.wanted, &r.records, &[r.one, r.two], &[r.rearm, passed])
            .unwrap()
            .permits_continuation
    );
}

#[test]
fn validate_rearm_refuses_rearming_a_rearm() {
    let r = rearmed();
    let mut three = r.two.clone();
    three.id = "fire-third".into();
    three.rearm_of = Some(r.two.id.clone());
    three.binding.observation.generation += 1;
    assert!(receipts::validate_rearm(&r.two, &three).is_err());
}

#[test]
fn validate_rearm_refuses_a_rearm_that_widens_the_review_scope() {
    let r = rearmed();
    let mut widened = r.two;
    widened.review_scope.push("unrelated.rs".into());
    assert!(receipts::validate_rearm(&r.one, &widened).is_err());
}

#[test]
fn history_refuses_a_receipt_whose_fire_was_never_recorded() {
    let record = observation(2, true);
    let valid = gate_pass(&fire(&record), "review-one");
    assert!(
        receipts::validate_history(
            std::slice::from_ref(&record),
            &[],
            std::slice::from_ref(&valid)
        )
        .is_err()
    );
}

#[test]
fn a_receipt_with_reviewer_prose_does_not_deserialize() {
    let valid = gate_pass(&fire(&observation(2, true)), "review-one");
    let mut value = serde_json::to_value(&valid).unwrap();
    value["reviewer_prose"] = json!("PASS");
    assert!(serde_json::from_value::<Receipt>(value).is_err());
}

#[test]
fn validate_refuses_abbreviated_object_ids() {
    let fired = fire(&observation(2, true));
    let mut wrong = gate_pass(&fired, "review-one");
    wrong.fire.binding.material = MaterialIdentity::Staged {
        base_id: "bbbbbbb".into(),
        index_id: "ddddddd".into(),
    };
    assert!(wrong.validate(&fired).is_err());
}

#[test]
fn a_staged_fire_whose_material_also_names_a_head_id_does_not_deserialize() {
    let fired = fire(&observation(2, true));
    let mut value = serde_json::to_value(&fired).unwrap();
    value["binding"]["material"]["head_id"] = Value::Null;
    assert!(serde_json::from_value::<Fire>(value).is_err());
}

#[test]
fn an_identical_recorded_receipt_request_is_answered_from_the_view() {
    use cadence::store::writer::{rail_fact_record, rail_receipt_replays};
    let fire = fire(&observation(3, false));
    let record = receipts::RecordedFact::new(
        receipts::Apply::Fire { request_id: "fire-request".into(), fire: Box::new(fire) },
        4,
    )
    .unwrap();
    let decisions = vec![rail_fact_record(&record).unwrap()];
    assert_eq!(rail_receipt_replays(Some(&record), &record, &decisions), Ok(true));
}

#[test]
fn projecting_a_receipt_changes_nothing_outside_its_namespace() {
    use cadence::rail::risk;
    let observed = observation(3, false);
    let data = risk::project(&json!({"execution": {"schema": 1}, "other": {"keep": true}}), &observed).unwrap();
    let record = receipts::RecordedFact::new(
        receipts::Apply::Fire { request_id: "fire-request".into(), fire: Box::new(fire(&observed)) },
        4,
    )
    .unwrap();
    let mut outside = receipts::project(&data, &record).unwrap();
    assert!(outside.as_object_mut().unwrap().remove(receipts::NAMESPACE).is_some());
    assert_eq!(outside, data);
}

/// Phase 7's plan 1, completed at commit `c…` over base `b…`, and the scan of
/// that range recorded at `generation` with `head` as its tip.
const DISPATCH: &str = "d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7";

fn execution_scan(generation: u64, head: &str, matched: bool) -> Recorded {
    let matches = if matched { json!([{"category":"auth","signal":"path segment auth"}]) } else { json!([]) };
    let value = json!({
        "version":1, "request_id":format!("scan-{generation}"), "request_digest":"a".repeat(64),
        "scope":{"project":"/tmp/project","planning_root":"/tmp/project/.planning",
            "cycle":"live","occurrence":"phase-7-execution","phase":7,"worker":"1","plan":1},
        "source":{"kind":"execution","plan":1,"dispatch_id":DISPATCH},
        "resolution":{"kind":"committed","base_id":"b".repeat(40),"head_id":head},
        "outcome":"checked", "surfaces":["auth","secrets"],
        "scan":{"checked":true,"categories":["auth","secrets"],"matches":matches,
            "inconclusive":false,"empty":false}, "diagnostics":[]
    });
    Recorded::new(serde_json::from_value(value).unwrap(), generation).unwrap()
}

/// Snapshot data holding phase 7's completed plan, its recorded commit basis
/// and the given scans.
fn completed_phase(scans: &[Recorded]) -> Value {
    use cadence::execution::model::*;
    use cadence::rail::risk::{self, ExecutionBasis};
    use std::collections::BTreeMap;
    let commit = "c".repeat(40);
    let outcome = PlanOutcome {
        dispatch_id: DISPATCH.into(), phase: 7, plan: 1, disposition: PlanDisposition::Complete,
        tasks: vec![TaskOutcome::Completed {
            task_id: "T1".into(), commit: commit.clone(),
            verification: VerificationReceipt { disposition: VerificationDisposition::Passed,
                commands: vec![CommandReceipt { command: "cargo test".into(), exit_code: 0, output_digest: "3".repeat(64) }] },
            evidence: vec![EvidenceReference::Commit { sha: commit.clone() }],
        }],
        deviations: vec![], blockers: vec![], commit_paths: BTreeMap::new(), transition_id: "e".repeat(64),
    };
    let execution = ExecutionSnapshot {
        schema: EXECUTION_SCHEMA,
        occurrences: BTreeMap::from([("7".into(), ExecutionOccurrence {
            phase: 7, undone: None, plan_set_fingerprint: "f".repeat(64), version: 2, active: None,
            plans: vec![outcome], terminal: None, receipts: BTreeMap::new(), issues: BTreeMap::new(),
        })]),
    };
    let basis = ExecutionBasis {
        version: 1, phase: 7, plan: 1, dispatch_id: DISPATCH.into(), plan_set_fingerprint: "f".repeat(64),
        plan_fingerprint: "9".repeat(64), base_id: "b".repeat(40), commits: vec![commit], transition_id: "e".repeat(64),
    };
    let mut data = risk::project_execution_basis(&json!({"execution": execution}), &basis).unwrap();
    for scan in scans {
        data = risk::project(&data, scan).unwrap();
    }
    data
}

fn phase_requirement() -> Requirement {
    let scan = execution_scan(2, &"c".repeat(40), false);
    Requirement {
        boundary: Boundary { scope: scan.observation.scope.clone(), run_id: DISPATCH.into(), after_generation: 1 },
        material: scan.observation.resolution.material().unwrap(),
        surfaces: scan.observation.surfaces.clone(),
    }
}

#[test]
fn finalizing_completes_the_phase_once_its_current_scan_settles_it() {
    let data = completed_phase(&[execution_scan(2, &"c".repeat(40), false)]);
    let finalized = receipts::finalize_execution(&data, 7, &[phase_requirement()]).unwrap();
    assert_eq!(finalized["execution"]["occurrences"]["7"]["terminal"], json!({"status":"complete","phase":7}));
}

#[test]
fn finalizing_refuses_while_a_requirement_is_not_settled() {
    let data = completed_phase(&[execution_scan(2, &"c".repeat(40), true)]);
    assert!(receipts::finalize_execution(&data, 7, &[phase_requirement()]).is_err());
}

#[test]
fn finalizing_refuses_again_after_a_newer_scan_changes_the_material() {
    let data = completed_phase(&[execution_scan(2, &"c".repeat(40), false), execution_scan(3, &"d".repeat(40), false)]);
    assert!(receipts::finalize_execution(&data, 7, &[phase_requirement()]).is_err());
}


