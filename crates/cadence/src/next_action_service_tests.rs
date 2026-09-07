use super::{
    CadenceServer,
    derivation_service::{Driver, Event},
    evidence_service::Command,
};
use crate::import::SessionFactory;
use cadence::{
    derivation::*,
    evidence::{
        self, Fact, Record, Scope,
        overrides::{Authorization, Meaning, Override},
    },
    store::writer::Operation,
};
use serde_json::json;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Arc,
};

use cadence::{
    evidence::{
        authority::Occurrence,
        checker::{self, Attempt, CheckedMaterial, Checker, Finding, Severity},
        checkpoint::{Checkpoint, CheckpointType, State as CheckpointState},
        gates::{self, Gate, Purpose, State as GateState},
    },
    next_action::continuation::{Continuation, Decision},
};

fn fact(root: &Path, occurrence: &str, fact: Fact) -> Record {
    Record {
        version: evidence::VERSION,
        scope: scope(root, occurrence),
        fact,
    }
}
async fn recover_continuation(root: &Path, occurrence: &str) -> Continuation {
    super::next_action_service::continuation(
        &factory(),
        root,
        &scope(root, occurrence),
        &Driver::default(),
    )
    .await
    .unwrap()
}
fn checkpoint(kind: CheckpointType) -> Checkpoint {
    Checkpoint {
        id: "checkpoint".into(),
        checkpoint_type: kind.clone(),
        task_number: 3,
        task_name: "Restore exact device state".into(),
        need: "  Approve the device change? 日本語\nKeep this exact Need.  ".into(),
        completed_work: vec!["commit:abc123".into()],
        state: CheckpointState::Unresolved,
        failing_output: (kind == CheckpointType::SuiteRed)
            .then(|| "reports/failing-output.txt:17".into()),
    }
}
fn progress_gate() -> Gate {
    Gate {
        id: "progress".into(),
        purpose: Purpose::Progress,
        checkpoint_id: None,
        question: "Continue now or stop here?".into(),
        need: "Accept this selected work occurrence".into(),
        options: vec![],
        state: GateState::Unanswered,
    }
}
fn answered(mut gate: Gate, disposition: gates::Disposition) -> Gate {
    gate.state = GateState::Answered(gates::Answer {
        question_id: gate.id.clone(),
        actual_response: "  My exact recorded response  ".into(),
        selected_option: None,
        adjustment: (disposition == gates::Disposition::Adjust)
            .then(|| "Use the spare device".into()),
        disposition,
        authorization_id: Some("answer-authority".into()),
    });
    gate
}
fn checker_record(root: &Path, id: &str, verdict: checker::Disposition) -> Checker {
    let findings = if verdict == checker::Disposition::Fail {
        vec![Finding {
            number: 1,
            severity: Severity::Blocker,
            location: "PLAN.md:2".into(),
            claim: "Missing required change".into(),
            fix: "Add the change".into(),
        }]
    } else {
        vec![]
    };
    Checker {
        id: id.into(),
        raw_return: match verdict {
            checker::Disposition::Pass => "## VERIFICATION PASSED",
            checker::Disposition::Fail => "## ISSUES FOUND",
            checker::Disposition::Unusable => "unmarked return",
        }
        .into(),
        disposition: verdict,
        findings,
        checked_material: vec![CheckedMaterial {
            path: "phases/1/PLAN.md".into(),
            content_digest: cadence::store::model::digest(
                &fs::read(root.join("phases/1/PLAN.md")).unwrap(),
            ),
        }],
        attempt: Attempt::Initial,
        revision_spent: false,
    }
}

#[test]
fn checkpoint_continuation_persists_question_and_recovers_exact_answers() {
    runtime().block_on(async {
        for kind in [
            CheckpointType::Structural,
            CheckpointType::HumanVerify,
            CheckpointType::Decision,
            CheckpointType::Blocked,
        ] {
            for disposition in [
                gates::Disposition::Approve,
                gates::Disposition::Adjust,
                gates::Disposition::Stop,
            ] {
                let temp = fixture(&[LifecycleStatus::Planned]);
                let root = temp.path().join(".planning");
                let server = CadenceServer::with_factory(factory());
                let cp = checkpoint(kind.clone());
                submit(
                    &server,
                    &root,
                    "checkpoint",
                    fact(&root, "run", Fact::Checkpoint(cp.clone())),
                )
                .await;
                drop(server);
                let first = recover_continuation(&root, "run").await;
                assert_eq!(first.checkpoint, Some(cp.clone()));
                let Decision::Wait(gate) = first.decision else {
                    panic!("missing persisted gate");
                };
                assert_eq!(gate.need, cp.need);
                assert_eq!(gate.question, cp.need);
                assert_eq!(
                    recover_continuation(&root, "run").await.decision,
                    Decision::Wait(gate.clone())
                );
                let server = CadenceServer::with_factory(factory());
                let recorded = server.evidence(&root, Command::Read).await.unwrap();
                assert!(
                    recorded
                        .current
                        .iter()
                        .any(|r| r.fact == Fact::Gate(gate.clone()))
                );
                let answer = answered(gate, disposition.clone());
                submit(
                    &server,
                    &root,
                    "answer",
                    fact(&root, "run", Fact::Gate(answer.clone())),
                )
                .await;
                drop(server);
                let final_state = recover_continuation(&root, "run").await;
                assert_eq!(final_state.checkpoint, Some(cp));
                let GateState::Answered(expected) = answer.state else {
                    unreachable!()
                };
                if disposition == gates::Disposition::Stop {
                    assert_eq!(final_state.decision, Decision::Stop(expected));
                } else {
                    assert_eq!(
                        final_state.decision,
                        Decision::Continue {
                            answer: Some(expected),
                            override_id: None,
                            rerun_plans: vec![]
                        }
                    );
                }
            }
        }
    });
}

#[test]
fn suite_red_continuation_retains_output_without_creating_question() {
    runtime().block_on(async {
        let temp = fixture(&[LifecycleStatus::Executed]);
        let root = temp.path().join(".planning");
        let server = CadenceServer::with_factory(factory());
        let cp = checkpoint(CheckpointType::SuiteRed);
        submit(
            &server,
            &root,
            "suite",
            fact(&root, "run", Fact::Checkpoint(cp.clone())),
        )
        .await;
        drop(server);
        let selected = recover_continuation(&root, "run").await;
        assert_eq!(selected.checkpoint, Some(cp));
        assert_eq!(
            selected.decision,
            Decision::RepairSuite {
                failing_output: "reports/failing-output.txt:17".into()
            }
        );
        let server = CadenceServer::with_factory(factory());
        assert!(
            !server
                .evidence(&root, Command::Read)
                .await
                .unwrap()
                .current
                .iter()
                .any(|r| matches!(r.fact, Fact::Gate(_)))
        );
    });
}

#[test]
fn actual_checker_dispositions_and_warning_budget_survive_continuation_restart() {
    runtime().block_on(async {
        for case in ["pass", "warning", "blocker", "unusable", "revision"] {
            let temp = fixture(&[LifecycleStatus::Planned]);
            let root = temp.path().join(".planning");
            let server = CadenceServer::with_factory(factory());
            let gate = progress_gate();
            submit(
                &server,
                &root,
                "question",
                fact(&root, "run", Fact::Gate(gate.clone())),
            )
            .await;
            submit(
                &server,
                &root,
                "answer",
                fact(
                    &root,
                    "run",
                    Fact::Gate(answered(gate, gates::Disposition::Approve)),
                ),
            )
            .await;
            let verdict = match case {
                "blocker" | "revision" => checker::Disposition::Fail,
                "unusable" => checker::Disposition::Unusable,
                _ => checker::Disposition::Pass,
            };
            let mut check = checker_record(&root, "initial", verdict.clone());
            if case == "warning" {
                check.raw_return = "## ISSUES FOUND".into();
                check.findings.push(Finding {
                    number: 1,
                    severity: Severity::Warning,
                    location: "PLAN.md:1".into(),
                    claim: "Improve the explanation".into(),
                    fix: "Clarify it".into(),
                });
            }
            submit(
                &server,
                &root,
                "check",
                fact(&root, "run", Fact::Checker(check.clone())),
            )
            .await;
            if case == "revision" {
                let initial = check.clone();
                check.id = "revision".into();
                check.revision_spent = true;
                check.attempt = Attempt::Revision {
                    previous_check: initial.id.clone(),
                    previous_blockers: initial.blockers(),
                    diff: "recorded revision diff".into(),
                };
                submit(
                    &server,
                    &root,
                    "revision",
                    fact(&root, "run", Fact::Checker(check.clone())),
                )
                .await;
            }
            drop(server);
            let selected = recover_continuation(&root, "run").await;
            assert_eq!(selected.checker, Some(check.clone()));
            assert_eq!(
                selected.applicability.as_ref().unwrap().revision_spent,
                case == "revision"
            );
            match case {
                "pass" | "warning" => {
                    assert!(matches!(selected.decision, Decision::Continue { .. }))
                }
                "blocker" => assert_eq!(selected.decision, Decision::Revise),
                _ => assert_eq!(selected.decision, Decision::OverrideRequired),
            }
            if matches!(case, "blocker" | "unusable" | "revision") {
                let server = CadenceServer::with_factory(factory());
                let value = Override {
                    id: "bypass".into(),
                    reason: "Proceed with this recorded result".into(),
                    authorization: Authorization::Answer {
                        id: "answer-authority".into(),
                        question_id: "progress".into(),
                    },
                    meaning: Meaning::Bypass {
                        target: evidence::overrides::Bypass::Result {
                            checker_id: check.id.clone(),
                            disposition: check.disposition.clone(),
                            material: check.checked_material.clone(),
                        },
                    },
                };
                submit(
                    &server,
                    &root,
                    "bypass",
                    fact(&root, "run", Fact::Override(value)),
                )
                .await;
                drop(server);
                let bypassed = recover_continuation(&root, "run").await;
                assert_eq!(bypassed.checker, Some(check));
                assert!(matches!(
                    bypassed.decision,
                    Decision::Continue {
                        override_id: Some(_),
                        ..
                    }
                ));
            }
        }
    });
}

#[test]
fn changed_material_requires_new_check_or_matching_persisted_bypass() {
    runtime().block_on(async {
        for repair in ["check", "override"] {
            let temp = fixture(&[LifecycleStatus::Planned]);
            let root = temp.path().join(".planning");
            let server = CadenceServer::with_factory(factory());
            let check = checker_record(&root, "initial", checker::Disposition::Pass);
            submit(
                &server,
                &root,
                "check",
                fact(&root, "run", Fact::Checker(check.clone())),
            )
            .await;
            let gate = progress_gate();
            submit(
                &server,
                &root,
                "gate",
                fact(&root, "run", Fact::Gate(gate.clone())),
            )
            .await;
            submit(
                &server,
                &root,
                "answer",
                fact(
                    &root,
                    "run",
                    Fact::Gate(answered(gate, gates::Disposition::Approve)),
                ),
            )
            .await;
            server.lifecycle(&root).await.unwrap();
            assert!(matches!(
                recover_continuation(&root, "run").await.decision,
                Decision::Continue { .. }
            ));
            let before = server
                .store(&root, Operation::Read)
                .await
                .unwrap()
                .snapshot
                .data["derivation"]["memo"]
                .clone();
            fs::write(root.join("phases/1/PLAN.md"), "changed plan body").unwrap();
            drop(server);
            assert_eq!(
                recover_continuation(&root, "run").await.decision,
                Decision::FreshCheck
            );
            let server = CadenceServer::with_factory(factory());
            assert_eq!(
                server
                    .store(&root, Operation::Read)
                    .await
                    .unwrap()
                    .snapshot
                    .data["derivation"]["memo"],
                before
            );
            let fresh = checker_record(&root, "fresh", checker::Disposition::Pass);
            if repair == "check" {
                submit(
                    &server,
                    &root,
                    "fresh",
                    fact(&root, "run", Fact::Checker(fresh)),
                )
                .await;
            } else {
                let value = Override {
                    id: "bypass".into(),
                    reason: "Accept this exact changed material".into(),
                    authorization: Authorization::Answer {
                        id: "answer-authority".into(),
                        question_id: "progress".into(),
                    },
                    meaning: Meaning::Bypass {
                        target: evidence::overrides::Bypass::Result {
                            checker_id: check.id,
                            disposition: check.disposition,
                            material: fresh.checked_material,
                        },
                    },
                };
                submit(
                    &server,
                    &root,
                    "bypass",
                    fact(&root, "run", Fact::Override(value)),
                )
                .await;
            }
            drop(server);
            assert!(matches!(
                recover_continuation(&root, "run").await.decision,
                Decision::Continue { .. }
            ));
        }
    });
}

#[test]
fn suggestion_acceptance_and_scoped_rerun_permission_are_separate() {
    runtime().block_on(async {
        for end in [
            None,
            Some(Occurrence::Fulfilled {
                completion: "finished".into(),
            }),
            Some(Occurrence::Superseded { by: "later".into() }),
        ] {
            let temp = fixture(&[LifecycleStatus::Executed]);
            let root = temp.path().join(".planning");
            fs::write(root.join("phases/1/PLAN-2.md"), "gap plan").unwrap();
            let server = CadenceServer::with_factory(factory());
            let normal = instruction(&server, &root).await;
            let before = server.store(&root, Operation::Read).await.unwrap();
            assert_eq!(
                recover_continuation(&root, "run").await.decision,
                Decision::AwaitAcceptance
            );
            assert_eq!(
                server.store(&root, Operation::Read).await.unwrap().snapshot,
                before.snapshot
            );
            assert_eq!(instruction(&server, &root).await, normal);
            let grant = Override {
                id: "rerun".into(),
                reason: "Repeat all admitted plans".into(),
                authorization: Authorization::Invocation {
                    id: "rerun-request".into(),
                    invocation: "execute --rerun".into(),
                },
                meaning: Meaning::Rerun {
                    admitted_plans: vec!["PLAN-2.md".into(), "PLAN.md".into()],
                },
            };
            submit(
                &server,
                &root,
                "rerun",
                fact(&root, "run", Fact::Override(grant)),
            )
            .await;
            if let Some(state) = &end {
                submit(
                    &server,
                    &root,
                    "end",
                    fact(&root, "run", Fact::Occurrence(state.clone())),
                )
                .await;
            }
            drop(server);
            let selected = recover_continuation(&root, "run").await;
            if let Some(state) = end {
                assert_eq!(selected.decision, Decision::Ended(state));
            } else {
                assert_eq!(
                    selected.decision,
                    Decision::Continue {
                        answer: None,
                        override_id: Some("rerun".into()),
                        rerun_plans: vec!["PLAN-2.md".into(), "PLAN.md".into()]
                    }
                );
            }
            assert_eq!(
                recover_continuation(&root, "wrong-occurrence")
                    .await
                    .decision,
                Decision::AwaitAcceptance
            );
            let server = CadenceServer::with_factory(factory());
            assert_eq!(instruction(&server, &root).await, normal);
        }
    });
}

#[test]
fn pause_offer_requires_acceptance_and_superseded_gate_grants_nothing() {
    runtime().block_on(async {
        let temp = fixture(&[LifecycleStatus::Planned]);
        let root = temp.path().join(".planning");
        let server = CadenceServer::with_factory(factory());
        submit(&server, &root, "pause", pause_record(&root, "run")).await;
        server.lifecycle(&root).await.unwrap();
        assert_eq!(
            recover_continuation(&root, "run").await.decision,
            Decision::AwaitAcceptance
        );
        let gate = progress_gate();
        submit(
            &server,
            &root,
            "gate",
            fact(&root, "run", Fact::Gate(gate.clone())),
        )
        .await;
        assert_eq!(
            recover_continuation(&root, "run").await.decision,
            Decision::Wait(gate.clone())
        );
        let mut superseded = gate;
        superseded.state = GateState::Superseded {
            by: "replacement".into(),
        };
        submit(
            &server,
            &root,
            "supersede",
            fact(&root, "run", Fact::Gate(superseded)),
        )
        .await;
        drop(server);
        assert_eq!(
            recover_continuation(&root, "run").await.decision,
            Decision::AwaitAcceptance
        );
    });
}

#[test]
fn continuation_consumed_material_change_cannot_publish_old_approval() {
    runtime().block_on(async {
        let temp = fixture(&[LifecycleStatus::Planned]);
        let root = temp.path().join(".planning");
        let server = CadenceServer::with_factory(factory());
        let check = checker_record(&root, "initial", checker::Disposition::Pass);
        submit(
            &server,
            &root,
            "check",
            fact(&root, "run", Fact::Checker(check)),
        )
        .await;
        let task_root = root.clone();
        let driver = Driver {
            event: Arc::new(move |event| {
                if event == Event::RoutingObserved {
                    fs::write(task_root.join("phases/1/PLAN.md"), "changed").unwrap();
                }
            }),
            ..Driver::default()
        };
        assert!(matches!(
            super::next_action_service::continuation(
                &factory(),
                &root,
                &scope(&root, "run"),
                &driver
            )
            .await,
            Err(DerivationError::InputsChanged)
        ));
    });
}

fn queued(root: &Path) {
    fs::create_dir_all(root.join("deferred/1")).unwrap();
    fs::write(
        root.join("deferred/1/DEFERRED-diff-1.json"),
        serde_json::to_vec(
            &json!({"phase":"1","trigger":"diff","discriminator":"1","round":1,"findings":[{}]}),
        )
        .unwrap(),
    )
    .unwrap();
}

#[test]
fn nine_normal_answers_ignore_unrelated_continuation_history() {
    runtime().block_on(async {
        use LifecycleStatus::*;
        for (case, statuses, expected) in [
            (1, vec![Planned], "  verify the fix on the device  "),
            (2, vec![Planned], "/cad-execute 1"),
            (3, vec![Executed], "/cad-execute 1"),
            (4, vec![Executed], "/cad-verify 1"),
            (5, vec![Unplanned], "/cad-context 1"),
            (6, vec![Complete], "Triage the deferred queue"),
            (7, vec![], "/cad-milestone"),
            (8, vec![], "/cad-phase add"),
            (9, vec![Complete], "/cad-milestone"),
        ] {
            let temp = fixture(&statuses);
            let root = temp.path().join(".planning");
            if case == 3 {
                fs::remove_file(root.join("phases/1/reports/plan-1.md")).unwrap();
            }
            if case == 6 {
                queued(&root);
            }
            if case == 7 {
                fs::create_dir_all(root.join("phases/1")).unwrap();
            }
            let server = CadenceServer::with_factory(factory());
            if case == 1 {
                submit(&server, &root, "pause", pause_record(&root, "paused-work")).await;
            }
            assert_eq!(instruction(&server, &root).await, expected, "W{case}");
            let gate = progress_gate();
            submit(
                &server,
                &root,
                "unrelated-question",
                fact(&root, "unrelated", Fact::Gate(gate.clone())),
            )
            .await;
            submit(
                &server,
                &root,
                "unrelated-answer",
                fact(
                    &root,
                    "unrelated",
                    Fact::Gate(answered(gate, gates::Disposition::Approve)),
                ),
            )
            .await;
            assert!(matches!(
                recover_continuation(&root, "unrelated").await.decision,
                Decision::Continue { .. }
            ));
            assert_eq!(
                instruction(&server, &root).await,
                expected,
                "W{case} after unrelated history"
            );
        }
    });
}

fn runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Runtime::new().unwrap()
}
fn factory() -> SessionFactory {
    SessionFactory::new(None, Arc::new(|_, _| Ok(())))
}
fn fixture(states: &[LifecycleStatus]) -> tempfile::TempDir {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join(".planning");
    fs::create_dir_all(&root).unwrap();
    let mut roadmap = "## Phases\n".to_owned();
    for (i, status) in states.iter().enumerate() {
        let id = i + 1;
        roadmap.push_str(&format!(
            "- [{}] **Phase {id}: Work {id}**\n",
            if *status == LifecycleStatus::Complete {
                "x"
            } else {
                " "
            }
        ));
        let phase = root.join(format!("phases/{id}"));
        fs::create_dir_all(phase.join("reports")).unwrap();
        if *status != LifecycleStatus::Unplanned {
            fs::write(phase.join("PLAN.md"), "plan body").unwrap();
        }
        if matches!(
            status,
            LifecycleStatus::Executed | LifecycleStatus::Complete
        ) {
            fs::write(phase.join("SUMMARY.md"), "summary").unwrap();
            fs::write(phase.join("reports/plan-1.md"), "PLAN COMPLETE\n").unwrap();
        }
        if *status == LifecycleStatus::Complete {
            fs::write(phase.join("UAT.md"), "### 1. Check\nstatus: pass\n").unwrap();
        }
    }
    fs::write(root.join("ROADMAP.md"), roadmap).unwrap();
    temp
}
fn scope(root: &Path, occurrence: &str) -> Scope {
    Scope {
        project: root.parent().unwrap().to_string_lossy().into_owned(),
        planning_root: root.to_string_lossy().into_owned(),
        cycle: "v4".into(),
        occurrence: occurrence.into(),
        phase: "1".into(),
        plan: "PLAN.md".into(),
        report: "reports/plan-1.md".into(),
    }
}
fn pause_record(root: &Path, occurrence: &str) -> Record {
    Record {
        version: evidence::VERSION,
        scope: scope(root, occurrence),
        fact: Fact::Override(Override {
            id: "pause".into(),
            reason: "preserve current work".into(),
            authorization: Authorization::Invocation {
                id: "pause-request".into(),
                invocation: "pause".into(),
            },
            meaning: Meaning::PausedNext {
                sentence: "  verify the fix on the device  ".into(),
            },
        }),
    }
}
async fn submit(server: &CadenceServer, root: &Path, operation: &str, record: Record) {
    server
        .evidence(
            root,
            Command::Submit {
                operation_id: operation.into(),
                record: Box::new(record),
            },
        )
        .await
        .unwrap();
}
async fn instruction(server: &CadenceServer, root: &Path) -> String {
    server
        .next_action(root)
        .await
        .unwrap()
        .unwrap()
        .instruction()
}

#[test]
fn effective_config_changes_only_unplanned_and_unavailable_refuses() {
    runtime().block_on(async {
        let temp = fixture(&[LifecycleStatus::Unplanned]);
        let root = temp.path().join(".planning");
        let global = temp.path().join("global.json");
        fs::write(&global, r#"{"workflow":{"skip_discuss":true}}"#).unwrap();
        let f = SessionFactory::new(Some(global), Arc::new(|_, _| Ok(())));
        let session = f.first_touch(&root).await.unwrap();
        let active = session.import_manifest().active.repo.clone();
        let active_global = session.import_manifest().active.global.clone().unwrap();
        let server = CadenceServer::with_factory(f);
        assert_eq!(instruction(&server, &root).await, "/cad-plan 1");
        fs::write(&active, r#"{"workflow":{"skip_discuss":false}}"#).unwrap();
        assert_eq!(instruction(&server, &root).await, "/cad-context 1");
        fs::write(root.join("phases/1/PLAN.md"), "plan").unwrap();
        assert_eq!(instruction(&server, &root).await, "/cad-execute 1");
        fs::write(&active, r#"{"workflow":{"skip_discuss":true}}"#).unwrap();
        assert_eq!(instruction(&server, &root).await, "/cad-execute 1");
        fs::write(&active_global, "unavailable").unwrap();
        assert!(matches!(
            server.next_action(&root).await,
            Err(DerivationError::Store { .. })
        ));
    });
}

#[test]
fn native_pause_supersedes_retained_legacy_even_after_fulfillment() {
    runtime().block_on(async {
        let temp = fixture(&[LifecycleStatus::Planned]);
        let root = temp.path().join(".planning");
        fs::write(
            root.join("STATE.md"),
            "Phase: 1 of 1 (Work 1)\nStatus: paused\nNext: legacy resume\nUpdated: 2026-09-06\n",
        )
        .unwrap();
        let server = CadenceServer::with_factory(factory());
        assert_eq!(instruction(&server, &root).await, "legacy resume");
        assert_eq!(instruction(&server, &root).await, "legacy resume");
        submit(&server, &root, "pause", pause_record(&root, "run")).await;
        assert_eq!(
            instruction(&server, &root).await,
            "  verify the fix on the device  "
        );
        let end = Record {
            version: evidence::VERSION,
            scope: scope(&root, "run"),
            fact: Fact::Occurrence(evidence::authority::Occurrence::Fulfilled {
                completion: "done".into(),
            }),
        };
        submit(&server, &root, "finish", end).await;
        assert_eq!(instruction(&server, &root).await, "/cad-execute 1");
        let data = server
            .store(&root, Operation::Read)
            .await
            .unwrap()
            .snapshot
            .data;
        assert_eq!(data["cursor"]["next"], "legacy resume");
        assert_eq!(data["derivation"]["intake"]["retired"], true);
    });
}

#[test]
fn cold_and_warm_conflicts_survive_pause_and_override() {
    runtime().block_on(async {
        for warm in [false, true] {
            for memo in [false, true] {
                let temp = fixture(&[LifecycleStatus::Planned]);
                let root = temp.path().join(".planning");
                fs::write(root.join("STATE.md"), "Phase: 1 of 1 (Work 1)\nStatus: paused\nNext: legacy resume\nUpdated: 2026-09-06\n").unwrap();
                let f = factory();
                let session = f.first_touch(&root).await.unwrap();
                let server = CadenceServer::with_factory(f);
                submit(&server, &root, "pause", pause_record(&root, "run")).await;
                if warm { assert_eq!(instruction(&server, &root).await, "  verify the fix on the device  "); }
                if memo {
                    let capture = capture_inputs(&root, &mut ArtifactFiles).unwrap();
                    let mut bad = serde_json::to_value(LifecycleMemo::fresh(input_key(&capture).unwrap(), derive(&capture).unwrap())).unwrap();
                    bad["answer"]["phases"][0]["name"] = json!("wrong");
                    let before = session.derivation_view().await.unwrap();
                    let mut data = before.snapshot.data.clone();
                    if !data["derivation"].is_object() { data["derivation"] = json!({}); }
                    data["derivation"]["memo"] = bad;
                    session.commit_derivation(&before, data).await.unwrap();
                } else { fs::write(root.join("ROADMAP.md"), "## Phases\n- [x] **Phase 1: Work 1**\n").unwrap(); }
                let error = server.next_action(&root).await.unwrap_err();
                assert_eq!(error.code(), if memo { "derivation-conflict" } else { "state-conflict" });
            }
        }
    });
}

#[test]
fn consumed_report_config_store_and_lifecycle_changes_refuse_mixed_answer() {
    runtime().block_on(async {
        for change in ["report", "config", "store", "lifecycle"] {
            let temp = fixture(&[LifecycleStatus::Executed]);
            let root = temp.path().join(".planning");
            let f = factory();
            let session = f.first_touch(&root).await.unwrap();
            let task_root = root.clone();
            let driver = Driver {
                event: Arc::new(move |event| {
                    if event != Event::RoutingObserved {
                        return;
                    }
                    match change {
                        "report" => {
                            fs::write(task_root.join("phases/1/reports/plan-1.md"), "PLAN PARTIAL")
                                .unwrap()
                        }
                        "config" => fs::write(
                            &session.import_manifest().active.repo,
                            r#"{"workflow":{"skip_discuss":true}}"#,
                        )
                        .unwrap(),
                        "store" => tokio::runtime::Handle::current().block_on(async {
                            let before = session.derivation_view().await.unwrap();
                            let mut data = before.snapshot.data.clone();
                            data["changed"] = true.into();
                            session.commit_derivation(&before, data).await.unwrap();
                        }),
                        _ => fs::remove_file(task_root.join("phases/1/SUMMARY.md")).unwrap(),
                    }
                }),
                ..Driver::default()
            };
            let server = CadenceServer::with_derivation_driver(f, driver);
            assert!(
                matches!(
                    server.next_action(&root).await,
                    Err(DerivationError::InputsChanged)
                ),
                "{change}"
            );
        }
    });
}

struct Reordered(ArtifactFiles);
impl ArtifactIo for Reordered {
    fn resolve_root(&mut self, p: &Path) -> Result<PathBuf, InputFailure> {
        self.0.resolve_root(p)
    }
    fn probe_root(&mut self, p: &Path) -> Observation<()> {
        self.0.probe_root(p)
    }
    fn probe_summary(&mut self, p: &Path) -> Observation<()> {
        self.0.probe_summary(p)
    }
    fn read(&mut self, p: &Path) -> Observation<Vec<u8>> {
        self.0.read(p)
    }
    fn list_phase(&mut self, p: &Path) -> Observation<Vec<String>> {
        match self.0.list_phase(p) {
            Observation::Present(mut names) => {
                names.reverse();
                Observation::Present(names)
            }
            other => other,
        }
    }
}
#[test]
fn reordered_observations_preserve_lowest_planned_winner() {
    runtime().block_on(async {
        let temp = fixture(&[
            LifecycleStatus::Executed,
            LifecycleStatus::Planned,
            LifecycleStatus::Planned,
        ]);
        let root = temp.path().join(".planning");
        fs::write(root.join("phases/2/PLAN-2.md"), "second").unwrap();
        let server = CadenceServer::with_derivation_driver(
            factory(),
            Driver {
                artifacts: Arc::new(|| Box::new(Reordered(ArtifactFiles))),
                ..Driver::default()
            },
        );
        assert_eq!(instruction(&server, &root).await, "/cad-execute 2");
    });
}
