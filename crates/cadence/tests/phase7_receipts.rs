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

#[test]
fn missing_matched_only_unfired_and_unchecked_are_not_permission() {
    let record = observation(2, false);
    assert_eq!(
        receipts::status(&wanted(&record), &[], &[], &[])
            .unwrap()
            .state,
        State::Missing
    );
    let result = assess(&record, &[], &[]);
    assert_eq!(result.state, State::Unfired);
    assert!(!result.permits_continuation);
    let fired = fire(&record);
    assert_eq!(assess(&record, &[fired], &[]).state, State::Pending);
    let unchecked = edit(&record, |r| {
        r["outcome"] = json!("unchecked");
        r["scan"]["checked"] = json!(false);
        r["scan"]["inconclusive"] = json!(true);
        r["scan"]["matches"] = json!([]);
    });
    assert_eq!(assess(&unchecked, &[], &[]).state, State::Unchecked);
    let mut invalid = fire(&record);
    invalid.binding = Binding::new(wanted(&unchecked).boundary, &unchecked).unwrap();
    assert!(receipts::validate_history(&[unchecked], &[invalid], &[]).is_err());
}

#[test]
fn exact_committed_and_null_head_staged_records_settle() {
    for staged in [false, true] {
        let record = observation(2, staged);
        let fired = fire(&record);
        if staged {
            let wire = serde_json::to_value(&record.observation.resolution).unwrap();
            assert!(wire["head_id"].is_null());
            assert_eq!(wire["index_id"], "d".repeat(40));
        }
        let outcome = receipt(
            &fired,
            json!({"kind":"gate-pass","evidence_id":"review-accepted"}),
        );
        let result = assess(
            &record,
            std::slice::from_ref(&fired),
            std::slice::from_ref(&outcome),
        );
        assert_eq!(result.state, State::Settled);
        assert!(result.permits_continuation);
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
        match change {
            0 => wanted.boundary.scope.project.push('x'),
            1 => wanted.boundary.scope.planning_root.push('x'),
            2 => wanted.boundary.scope.cycle = "archived".into(),
            3 => wanted.boundary.scope.occurrence = "different".into(),
            4 => wanted.boundary.scope.phase = 8.try_into().unwrap(),
            5 => wanted.boundary.scope.worker = Some("5".into()),
            6 => wanted.boundary.scope.plan = Some(5.try_into().unwrap()),
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

#[test]
fn consequences_are_distinct_and_override_requires_reason() {
    let record = observation(2, true);
    let fired = fire(&record);
    for consequence in [
        json!({"kind":"override","reason":"  \n"}),
        json!({"kind":"gate-pass","evidence_id":""}),
    ] {
        let outcome = receipt(&fired, consequence);
        assert!(outcome.validate(&fired).is_err());
    }
    for (consequence, state, permits, deferred) in [
        (
            json!({"kind":"override","reason":"Accept for this occurrence and material"}),
            State::Settled,
            true,
            false,
        ),
        (
            json!({"kind":"adjudication","passed":false,"evidence_id":"surviving-findings"}),
            State::Pending,
            false,
            false,
        ),
        (
            json!({"kind":"adjudication","passed":true,"evidence_id":"adjudicated"}),
            State::Settled,
            true,
            false,
        ),
        (
            json!({"kind":"deferral","pending_id":"queue-1","permits_continuation":true}),
            State::Deferred,
            true,
            true,
        ),
        (
            json!({"kind":"deferral","pending_id":"queue-1","permits_continuation":false}),
            State::Pending,
            false,
            true,
        ),
    ] {
        let outcome = receipt(&fired, consequence);
        let result = assess(&record, std::slice::from_ref(&fired), &[outcome]);
        assert_eq!(result.state, state);
        assert_eq!(result.permits_continuation, permits);
        assert_eq!(!result.deferred_work.is_empty(), deferred);
    }
}

#[test]
fn one_narrowed_rearm_does_not_pass_its_new_review_and_cannot_rearm_again() {
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
    let records = [first, second.clone()];
    let result = receipts::status(
        &wanted(&second),
        &records,
        std::slice::from_ref(&one),
        std::slice::from_ref(&rearm),
    )
    .unwrap();
    assert_eq!(result.state, State::Unfired);
    let fires = [one.clone(), two.clone()];
    let result = receipts::status(
        &wanted(&second),
        &records,
        &fires,
        std::slice::from_ref(&rearm),
    )
    .unwrap();
    assert_eq!(result.state, State::Pending);
    assert_eq!(result.pending_fires, vec![two.id.clone()]);
    let passed = receipt(
        &two,
        json!({"kind":"gate-pass","evidence_id":"second-review"}),
    );
    assert!(
        receipts::status(&wanted(&second), &records, &fires, &[rearm, passed])
            .unwrap()
            .permits_continuation
    );
    let mut three = two.clone();
    three.id = "fire-third".into();
    three.rearm_of = Some(two.id.clone());
    three.binding.observation.generation += 1;
    assert!(receipts::validate_rearm(&two, &three).is_err());
    let mut widened = two;
    widened.review_scope.push("unrelated.rs".into());
    assert!(receipts::validate_rearm(&one, &widened).is_err());
}

#[test]
fn malformed_unknown_short_identity_and_prose_receipts_refuse() {
    let record = observation(2, true);
    let fired = fire(&record);
    let valid = receipt(
        &fired,
        json!({"kind":"gate-pass","evidence_id":"review-one"}),
    );
    assert!(
        receipts::validate_history(
            std::slice::from_ref(&record),
            &[],
            std::slice::from_ref(&valid)
        )
        .is_err()
    );
    let mut value = serde_json::to_value(&valid).unwrap();
    value["reviewer_prose"] = json!("PASS");
    assert!(serde_json::from_value::<Receipt>(value).is_err());
    let mut wrong = valid;
    wrong.fire.binding.material = MaterialIdentity::Staged {
        base_id: "bbbbbbb".into(),
        index_id: "ddddddd".into(),
    };
    assert!(wrong.validate(&fired).is_err());
    let mut value = serde_json::to_value(&fired).unwrap();
    value["binding"]["material"]["head_id"] = Value::Null;
    assert!(serde_json::from_value::<Fire>(value).is_err());
}

use cadence::{
    envelope::Envelope,
    execution::{
        boundary::{BoundaryScope, BoundaryV1, PreparedAnswer, Success},
        dispatch::build_dispatch,
        model::{ActiveDispatch, BoundaryTool, ExecutorPatch},
        plan::{parse_plan, plan_set_fingerprint},
    },
    store::{
        self,
        filesystem::{Filesystem, Stage},
        transaction::INTENT,
        writer::{BoundaryChange, Operation, Store, View},
    },
};
use std::{
    collections::BTreeMap,
    fs,
    path::Path,
    process::{Command, Stdio},
};

struct Allow;
impl store::Policy for Allow {
    fn validate(&mut self, _: &store::MutationContext<'_>) -> store::Result<()> {
        Ok(())
    }
}
fn runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Builder::new_current_thread()
        .build()
        .unwrap()
}
async fn open(path: &Path) -> Store {
    Store::open(Filesystem::new(path).unwrap(), Allow)
        .await
        .unwrap()
}

#[test]
fn receipt_confirmation_failure_replays_once_after_recovery_without_changing_execution() {
    for (stage, target) in [
        (Stage::Renamed, INTENT),
        (Stage::Renamed, "decisions.jsonl"),
        (Stage::Confirmation, "state.json"),
    ] {
        let dir = tempfile::tempdir().unwrap();
        runtime().block_on(async {
            let initial = open(dir.path()).await;
            let seed = json!({"execution":{"preserve":true},"other":[1,2]});
            let view = initial
                .request(Operation::RewriteSnapshot(seed.clone()))
                .await
                .unwrap();
            let record = observation(view.snapshot.generation + 1, true);
            let view = initial
                .request(Operation::RailObservation {
                    expected_generation: view.snapshot.generation,
                    expected_integrity: view.snapshot.integrity,
                    record: Box::new(record.clone()),
                })
                .await
                .unwrap();
            let request = receipts::Apply::Fire {
                request_id: "fire-request".into(),
                fire: Box::new(fire(&record)),
            };
            let fact = receipts::RecordedFact::new(request, view.snapshot.generation + 1).unwrap();
            let broken = Store::open(
                Filesystem::new(dir.path())
                    .unwrap()
                    .with_probe(move |at, path| {
                        if at == stage && path.file_name().is_some_and(|name| name == target) {
                            return Err(store::Error::Io(
                                "injected receipt confirmation failure".into(),
                            ));
                        }
                        Ok(())
                    }),
                Allow,
            )
            .await
            .unwrap();
            let operation = || Operation::RailReceipt {
                expected_generation: view.snapshot.generation,
                expected_integrity: view.snapshot.integrity.clone(),
                record: Box::new(fact.clone()),
            };
            assert!(broken.request(operation()).await.is_err());
            assert!(broken.request(operation()).await.is_err());
            let replacement = open(dir.path()).await;
            let recovered = replacement.request(operation()).await.unwrap();
            assert_eq!(recovered.snapshot.data["execution"], seed["execution"]);
            assert_eq!(recovered.snapshot.data["other"], seed["other"]);
            assert_eq!(
                recovered.decisions,
                vec![record.decision().unwrap(), fact.decision().unwrap()]
            );
            assert_eq!(replacement.request(operation()).await.unwrap(), recovered);
            receipts::confirmed_history(&recovered).unwrap();
            assert_eq!(
                receipts::assess(&wanted(&record), &recovered.snapshot.data)
                    .unwrap()
                    .state,
                State::Pending
            );
        });
    }
}

fn boundary(
    tool: BoundaryTool,
    id: &str,
    subject: Option<String>,
    answer: Envelope<Success>,
) -> BoundaryV1 {
    BoundaryV1::new(
        BoundaryScope::Execution { phase: 7 },
        tool,
        match tool {
            BoundaryTool::CadenceQuery => "execute-next",
            BoundaryTool::CadenceApply => "executor",
        }
        .into(),
        cadence::store::model::digest(id.as_bytes()),
        subject,
        &PreparedAnswer::new(answer).unwrap(),
    )
}
fn operation(view: &View, id: &str, decision: BoundaryV1, change: BoundaryChange) -> Operation {
    Operation::BoundaryV1 {
        expected_generation: view.snapshot.generation,
        expected_integrity: view.snapshot.integrity.clone(),
        operation_id: id.into(),
        decision,
        change: Box::new(change),
    }
}
async fn dispatch_fixture(store: &Store) -> (View, ActiveDispatch) {
    let view = store
        .request(Operation::RewriteSnapshot(json!({"other":{"keep":true}})))
        .await
        .unwrap();
    let plan = parse_plan(b"---\nphase: 7\nplan: 4\nrequirements: [AC10]\nfiles: [auth/login.rs]\nexecution:\n  schema: 1\n  suite: printf suite\n  tasks:\n    - id: T1\n      verify: [printf T1]\n---\nChange auth.\n",7,4).unwrap();
    let set = plan_set_fingerprint(std::slice::from_ref(&plan)).unwrap();
    let candidate = build_dispatch(&plan, &set, 0, &"b".repeat(40), 1).unwrap();
    let mut dispatch = candidate.clone();
    dispatch.expected_execution_version = 1;
    let decision = boundary(
        BoundaryTool::CadenceQuery,
        "dispatch",
        Some(candidate.id.clone()),
        Envelope::Ok(Success::Dispatch {
            dispatch: Box::new(dispatch.clone()),
            prompt: "x".into(),
        }),
    );
    let view = store
        .request(operation(
            &view,
            "dispatch",
            decision,
            BoundaryChange::Dispatch {
                plan_set_fingerprint: set,
                dispatch: candidate,
            },
        ))
        .await
        .unwrap();
    (view, dispatch)
}
fn patch(dispatch: &ActiveDispatch) -> ExecutorPatch {
    serde_json::from_value(json!({"schema":1,"kind":"executor","dispatch_id":dispatch.id,"expected_execution_version":dispatch.expected_execution_version,
        "outcome":"complete","tasks":[{"status":"completed","task_id":"T1","commit":"c".repeat(40),
            "verification":{"disposition":"passed","commands":[{"command":"printf T1","exit_code":0,"output_digest":"a".repeat(64)}]},
            "evidence":[{"kind":"criterion","id":"AC10"}]}],"deviations":[],"blockers":[]})).unwrap()
}
async fn pending_patch(
    store: &Store,
    view: &View,
    dispatch: &ActiveDispatch,
) -> store::Result<View> {
    let answer = Envelope::Refused {
        code: "risk-pending".into(),
        reason: "Task evidence accepted; continuation refused pending risk settlement for plan 4"
            .into(),
    };
    let decision = boundary(
        BoundaryTool::CadenceApply,
        "pending-patch",
        Some(dispatch.id.clone()),
        answer,
    );
    store
        .request(operation(
            view,
            "pending-patch",
            decision,
            BoundaryChange::Patch {
                patch: patch(dispatch),
                commit_paths: BTreeMap::from([("c".repeat(40), vec!["auth/login.rs".into()])]),
                staged_paths: vec![],
                render_version: cadence::execution::render::SUMMARY_RENDER_VERSION,
                complete_phase: false,
            },
        ))
        .await
}

#[test]
fn pending_task_evidence_survives_process_kill_and_finalization_rechecks_current_evidence() {
    const CHILD: &str = "CADENCE_RECEIPT_CRASH_ROOT";
    if let Some(root) = std::env::var_os(CHILD) {
        runtime().block_on(async {
            let path = Path::new(&root);
            let initial = open(path).await;
            let (view, dispatch) = dispatch_fixture(&initial).await;
            let broken = Store::open(
                Filesystem::new(path).unwrap().with_probe(|stage, path| {
                    if stage == Stage::Renamed
                        && path
                            .file_name()
                            .is_some_and(|name| name == "decisions.jsonl")
                    {
                        // The intent is durable and the snapshot is still old. Abrupt
                        // process death exercises replacement recovery, not an Err path.
                        unsafe {
                            libc::kill(libc::getpid(), libc::SIGKILL);
                        }
                    }
                    Ok(())
                }),
                Allow,
            )
            .await
            .unwrap();
            pending_patch(&broken, &view, &dispatch).await.unwrap();
            panic!("process did not die at the required boundary");
        });
        return;
    }
    let dir = tempfile::tempdir().unwrap();
    fs::create_dir_all(dir.path().join("phases/7")).unwrap();
    let child = Command::new(std::env::current_exe().unwrap()).args(["--exact","pending_task_evidence_survives_process_kill_and_finalization_rechecks_current_evidence","--nocapture"])
        .env(CHILD,dir.path()).stdin(Stdio::null()).output().unwrap();
    use std::os::unix::process::ExitStatusExt;
    assert_eq!(
        child.status.signal(),
        Some(libc::SIGKILL),
        "{}",
        String::from_utf8_lossy(&child.stdout)
    );
    assert!(dir.path().join(INTENT).exists());
    runtime().block_on(async {
        let replacement = open(dir.path()).await;
        let mut view = replacement.request(Operation::ReadVerified).await.unwrap();
        let occurrence = &view.snapshot.data["execution"]["occurrences"]["7"];
        assert!(occurrence["terminal"].is_null());
        assert!(occurrence["active"].is_null());
        assert_eq!(occurrence["plans"][0]["tasks"][0]["commit"], "c".repeat(40));
        let dispatch_id = occurrence["plans"][0]["dispatch_id"]
            .as_str()
            .unwrap()
            .to_owned();
        assert_eq!(
            cadence::rail::risk::execution_bases(&view.snapshot.data).unwrap()[&dispatch_id]
                .base_id,
            "b".repeat(40)
        );
        let pending_data = view.snapshot.data.clone();
        let record = edit(&observation(view.snapshot.generation + 1, false), |r| {
            r["scope"]["occurrence"] = json!("phase-7-execution");
            r["scope"]["plan"] = json!(4);
            r["source"] = json!({"kind":"execution","plan":4,"dispatch_id":dispatch_id});
        });
        let requirement = Requirement {
            boundary: Boundary {
                scope: record.observation.scope.clone(),
                run_id: dispatch_id,
                after_generation: 2,
            },
            material: record.observation.resolution.material().unwrap(),
            surfaces: record.observation.surfaces.clone(),
        };
        let finalize = |view: &View| {
            operation(
                view,
                "finalize",
                boundary(
                    BoundaryTool::CadenceQuery,
                    "finalize",
                    None,
                    Envelope::Ok(Success::Complete { phase: 7 }),
                ),
                BoundaryChange::FinalizeRisk {
                    phase: 7,
                    requirements: vec![requirement.clone()],
                },
            )
        };
        assert!(replacement.request(finalize(&view)).await.is_err());
        assert_eq!(
            replacement
                .request(Operation::ReadVerified)
                .await
                .unwrap()
                .snapshot
                .data,
            pending_data
        );
        view = replacement
            .request(Operation::RailObservation {
                expected_generation: view.snapshot.generation,
                expected_integrity: view.snapshot.integrity.clone(),
                record: Box::new(record.clone()),
            })
            .await
            .unwrap();
        assert!(replacement.request(finalize(&view)).await.is_err());
        let fired = Fire {
            id: "native-fire".into(),
            binding: Binding::new(requirement.boundary.clone(), &record).unwrap(),
            review_scope: vec!["auth/login.rs".into()],
            rearm_of: None,
        };
        for fact in [
            receipts::Apply::Fire {
                request_id: "native-fire".into(),
                fire: Box::new(fired.clone()),
            },
            receipts::Apply::Consequence {
                request_id: "native-outcome".into(),
                receipt: Box::new(Receipt {
                    id: "native-receipt".into(),
                    fire: fired,
                    consequence: Consequence::GatePass {
                        evidence_id: "fixture-review".into(),
                    },
                }),
            },
        ] {
            let record = receipts::RecordedFact::new(fact, view.snapshot.generation + 1).unwrap();
            view = replacement
                .request(Operation::RailReceipt {
                    expected_generation: view.snapshot.generation,
                    expected_integrity: view.snapshot.integrity.clone(),
                    record: Box::new(record),
                })
                .await
                .unwrap();
        }
        let ready = finalize(&view);
        // The same settled snapshot can finalize after process replacement;
        // immutable accepted patches and receipt facts are retained verbatim.
        let success = tempfile::tempdir().unwrap();
        fs::create_dir_all(success.path().join("phases/7")).unwrap();
        for path in [
            "state.json",
            "items.jsonl",
            "decisions.jsonl",
            "phases/7/SUMMARY.md",
        ] {
            fs::copy(dir.path().join(path), success.path().join(path)).unwrap();
        }
        let fresh = open(success.path()).await;
        let completed = fresh.request(finalize(&view)).await.unwrap();
        assert_eq!(
            completed.snapshot.data["execution"]["occurrences"]["7"]["terminal"],
            json!({"status":"complete","phase":7})
        );
        let mut expected = view.snapshot.data.clone();
        expected["execution"]["occurrences"]["7"]["terminal"] =
            completed.snapshot.data["execution"]["occurrences"]["7"]["terminal"].clone();
        assert_eq!(completed.snapshot.data, expected);
        assert_eq!(
            open(success.path())
                .await
                .request(Operation::ReadVerified)
                .await
                .unwrap(),
            completed
        );
        let changed = edit(&observation(view.snapshot.generation + 1, false), |r| {
            r["scope"] = serde_json::to_value(&requirement.boundary.scope).unwrap();
            r["source"] = serde_json::to_value(&record.observation.source).unwrap();
            r["resolution"]["head_id"] = json!("e".repeat(40));
        });
        let view = replacement
            .request(Operation::RailObservation {
                expected_generation: view.snapshot.generation,
                expected_integrity: view.snapshot.integrity,
                record: Box::new(changed),
            })
            .await
            .unwrap();
        assert!(replacement.request(ready).await.is_err());
        assert!(replacement.request(finalize(&view)).await.is_err());
        assert!(
            replacement
                .request(Operation::ReadVerified)
                .await
                .unwrap()
                .snapshot
                .data["execution"]["occurrences"]["7"]["terminal"]
                .is_null()
        );
    });
}
