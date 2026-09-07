use super::{
    CadenceServer,
    evidence_service::{Command, Recovery},
};
use crate::import::SessionFactory;
use cadence::{
    evidence::{
        Fact, Record, Scope, VERSION,
        checkpoint::{Checkpoint, CheckpointType, State},
    },
    store::{Error, filesystem::Stage, writer::Operation},
};
use serde_json::json;
use std::{
    path::Path,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
};

fn runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Runtime::new().unwrap()
}
fn factory() -> SessionFactory {
    SessionFactory::new(None, Arc::new(|_, _| Ok(())))
}
fn fixture() -> tempfile::TempDir {
    let root = tempfile::tempdir().unwrap();
    std::fs::write(
        root.path().join("STATE.md"),
        "Phase: 5 of 5 (Evidence)\nStatus: planned\nNext:  exact imported next\n",
    )
    .unwrap();
    root
}
fn checkpoint(root: &Path) -> Record {
    Record {
        version: VERSION,
        scope: Scope {
            project: root.parent().unwrap().to_str().unwrap().into(),
            planning_root: root.to_str().unwrap().into(),
            cycle: "v4".into(),
            occurrence: "dispatch-5-1".into(),
            phase: "5".into(),
            plan: "phases/5/PLAN-1.md".into(),
            report: "phases/5/reports/plan-1.md".into(),
        },
        fact: Fact::Checkpoint(Checkpoint {
            id: "checkpoint-3".into(),
            checkpoint_type: CheckpointType::Structural,
            task_number: 3,
            task_name: "  tâche 日本語\t".into(),
            need: "\n  Keep this Need exactly.\r\n\t¿Ajustar?  \n".into(),
            completed_work: vec!["0ab3b79c".into()],
            state: State::Unresolved,
            failing_output: None,
        }),
    }
}
async fn submit(
    server: &CadenceServer,
    root: &Path,
    id: &str,
    record: Record,
) -> cadence::store::Result<Recovery> {
    server
        .evidence(
            root,
            Command::Submit {
                operation_id: id.into(),
                record: Box::new(record),
            },
        )
        .await
}

#[test]
fn checkpoint_service_records_recovers_and_refuses_without_changes() {
    let root = fixture();
    runtime().block_on(async {
        let f = factory();
        let session = f.first_touch(root.path()).await.unwrap();
        let before = session.derivation_view().await.unwrap();
        let mut seed = before.snapshot.data.clone();
        seed["derivation"] = json!({"memo":"keep"});
        seed["lifecycle_intake"] = json!({"keep":"intake"});
        seed["other"] = json!(["arbitrary", null]);
        session
            .request(Operation::CompareRewriteSnapshot {
                expected_generation: before.snapshot.generation,
                expected_integrity: before.snapshot.integrity,
                data: seed.clone(),
            })
            .await
            .unwrap();
        let server = CadenceServer::with_factory(f);
        let value = checkpoint(root.path());
        let written = submit(&server, root.path(), "checkpoint-op", value.clone())
            .await
            .unwrap();
        assert_eq!(written.current, std::slice::from_ref(&value));
        assert_eq!(written.history, std::slice::from_ref(&value));
        assert_eq!(
            server.evidence(root.path(), Command::Read).await.unwrap(),
            written
        );
        let before = server
            .store(root.path(), Operation::ReadVerified)
            .await
            .unwrap();
        for (key, value) in seed.as_object().unwrap() {
            assert_eq!(&before.snapshot.data[key], value);
        }
        let mut invalid = value.clone();
        let Fact::Checkpoint(cp) = &mut invalid.fact else {
            panic!("checkpoint")
        };
        cp.need.clear();
        assert!(
            submit(&server, root.path(), "invalid", invalid)
                .await
                .is_err()
        );
        let mut wrong_root = value.clone();
        wrong_root.scope.planning_root = "/another-root".into();
        assert!(
            submit(&server, root.path(), "wrong-root", wrong_root)
                .await
                .is_err()
        );
        assert_eq!(
            server
                .store(root.path(), Operation::ReadVerified)
                .await
                .unwrap(),
            before
        );
        assert_eq!(
            submit(&server, root.path(), "checkpoint-op", value)
                .await
                .unwrap(),
            written
        );
        drop(server);
        drop(session);
        let reopened = CadenceServer::with_factory(factory());
        assert_eq!(
            reopened.evidence(root.path(), Command::Read).await.unwrap(),
            written
        );
    });
}

#[test]
fn canceled_checkpoint_reply_does_not_cancel_admitted_persistence() {
    let root = fixture();
    let rt = runtime();
    let armed = Arc::new(AtomicBool::new(false));
    let probe_armed = armed.clone();
    let (entered_tx, entered_rx) = std::sync::mpsc::channel();
    let (release_tx, release_rx) = std::sync::mpsc::channel();
    let release_rx = std::sync::Mutex::new(release_rx);
    let f = factory().with_probe(Arc::new(move |stage, path| {
        if stage == Stage::Confirmation
            && path.ends_with("state.json")
            && probe_armed.swap(false, Ordering::SeqCst)
        {
            entered_tx.send(()).unwrap();
            release_rx.lock().unwrap().recv().unwrap();
        }
        Ok(())
    }));
    let server = rt.block_on(async { CadenceServer::with_factory(f) });
    rt.block_on(server.evidence(root.path(), Command::Read))
        .unwrap();
    armed.store(true, Ordering::SeqCst);
    let clone = server.clone();
    let path = root.path().to_path_buf();
    let value = checkpoint(&path);
    let expected = value.clone();
    let caller = rt.spawn(async move { submit(&clone, &path, "cancelled", value).await });
    entered_rx
        .recv_timeout(std::time::Duration::from_secs(5))
        .unwrap();
    assert!(!caller.is_finished());
    caller.abort();
    release_tx.send(()).unwrap();
    let recovered = rt
        .block_on(server.evidence(root.path(), Command::Read))
        .unwrap();
    assert_eq!(recovered.current, std::slice::from_ref(&expected));
    assert_eq!(recovered.history, [expected]);
}

#[test]
fn closed_resident_returns_closed() {
    let root = fixture();
    let rt = runtime();
    let server = rt.block_on(async { CadenceServer::with_factory(factory()) });
    drop(rt);
    assert_eq!(
        runtime().block_on(server.evidence(root.path(), Command::Read)),
        Err(Error::Closed)
    );
}

use cadence::evidence::checker::{
    Attempt, CheckedMaterial, Checker, Disposition as CheckDisposition, Finding, Severity,
};
fn finding(number: u32, severity: Severity) -> Finding {
    Finding {
        number,
        severity,
        location: "PLAN-1.md:42".into(),
        claim: "  Exact finding 日本語\n".into(),
        fix: "Keep the output reference".into(),
    }
}
fn checker(root: &Path, id: &str, raw: &str, findings: Vec<Finding>) -> Record {
    let mut value = checkpoint(root);
    value.fact = Fact::Checker(Checker {
        id: id.into(),
        raw_return: raw.into(),
        disposition: Checker::disposition(raw, &findings),
        findings,
        checked_material: vec![CheckedMaterial {
            path: "phases/5/PLAN-1.md".into(),
            content_digest: cadence::store::model::digest(b"actual observed plan content"),
        }],
        attempt: Attempt::Initial,
        revision_spent: false,
    });
    value
}

#[test]
fn checker_service_retains_actual_results_and_spent_revision() {
    let root = fixture();
    std::fs::write(
        root.path().join("trace.jsonl"),
        "{\"family\":\"trace\",\"event\":\"close\",\"role\":\"cad-plan-checker\",\"phase\":5}\n",
    )
    .unwrap();
    runtime().block_on(async {
        let server = CadenceServer::with_factory(factory());
        assert!(
            server
                .evidence(root.path(), Command::Read)
                .await
                .unwrap()
                .current
                .is_empty()
        );
        let cases = [
            (
                "pass",
                "## VERIFICATION PASSED",
                vec![],
                CheckDisposition::Pass,
            ),
            (
                "warnings",
                "## ISSUES FOUND",
                vec![finding(1, Severity::Warning)],
                CheckDisposition::Pass,
            ),
            (
                "blockers",
                "## ISSUES FOUND",
                vec![finding(1, Severity::Blocker)],
                CheckDisposition::Fail,
            ),
            (
                "mixed",
                "## ISSUES FOUND",
                vec![finding(1, Severity::Warning), finding(2, Severity::Blocker)],
                CheckDisposition::Fail,
            ),
            ("empty", "", vec![], CheckDisposition::Unusable),
            (
                "unmarked",
                "finished checking",
                vec![],
                CheckDisposition::Unusable,
            ),
        ];
        let mut expected = Vec::new();
        for (id, raw, findings, disposition) in cases {
            let value = checker(root.path(), id, raw, findings);
            let Fact::Checker(check) = &value.fact else {
                panic!("checker")
            };
            assert_eq!(check.disposition, disposition);
            assert!(!check.revision_spent);
            submit(&server, root.path(), id, value.clone())
                .await
                .unwrap();
            expected.push(value);
        }
        let mut revision = checker(
            root.path(),
            "revised",
            "## ISSUES FOUND",
            vec![finding(2, Severity::Blocker)],
        );
        let Fact::Checker(check) = &mut revision.fact else {
            panic!("checker")
        };
        check.attempt = Attempt::Revision {
            previous_check: "mixed".into(),
            previous_blockers: vec![finding(2, Severity::Blocker)],
            diff: "-old plan\n+fixed plan\n".into(),
        };
        check.revision_spent = true;
        check.checked_material[0].content_digest =
            cadence::store::model::digest(b"revised observed body");
        submit(&server, root.path(), "revision", revision.clone())
            .await
            .unwrap();
        expected.push(revision.clone());
        drop(server);
        let reopened = CadenceServer::with_factory(factory());
        let recovered = reopened.evidence(root.path(), Command::Read).await.unwrap();
        assert_eq!(recovered.history, expected);
        for value in &expected {
            assert!(recovered.current.contains(value));
        }
        let mut second = revision;
        let Fact::Checker(check) = &mut second.fact else {
            panic!("checker")
        };
        check.id = "revision-two".into();
        let before = reopened
            .store(root.path(), Operation::ReadVerified)
            .await
            .unwrap();
        assert!(
            submit(&reopened, root.path(), "second-revision", second)
                .await
                .is_err()
        );
        let refund = checker(root.path(), "fresh-input", "## VERIFICATION PASSED", vec![]);
        assert!(
            submit(&reopened, root.path(), "refund", refund)
                .await
                .is_err()
        );
        assert_eq!(
            reopened
                .store(root.path(), Operation::ReadVerified)
                .await
                .unwrap(),
            before
        );
    });
}

use cadence::evidence::gates::{
    Answer, Disposition as GateDisposition, Gate, OptionChoice, Purpose, State as GateState,
};
fn gate(root: &Path, id: &str, purpose: Purpose) -> Record {
    let mut value = checkpoint(root);
    value.fact = Fact::Gate(Gate {
        id: id.into(),
        purpose,
        checkpoint_id: None,
        question: "  Continue now? 日本語\n".into(),
        need: "\n Exact Need\t".into(),
        options: vec![
            OptionChoice {
                id: "continue".into(),
                text: "Continue now".into(),
            },
            OptionChoice {
                id: "stop".into(),
                text: "Stop here".into(),
            },
        ],
        state: GateState::Unanswered,
    });
    value
}
fn answered(mut value: Record, disposition: GateDisposition) -> Record {
    let Fact::Gate(gate) = &mut value.fact else {
        panic!("gate")
    };
    gate.state = GateState::Answered(Answer {
        question_id: gate.id.clone(),
        actual_response: "  yes, with this adjustment\r\n".into(),
        selected_option: Some("continue".into()),
        adjustment: Some(" preserve exact names  ".into()),
        disposition,
        authorization_id: Some("operator-answer-1".into()),
    });
    value
}

#[test]
fn gates_service_binds_exact_answers_to_pending_questions_and_occurrences() {
    let root = fixture();
    runtime().block_on(async {
        let server = CadenceServer::with_factory(factory());
        let unanswered = gate(root.path(), "pending", Purpose::Progress);
        submit(&server, root.path(), "pending", unanswered.clone())
            .await
            .unwrap();
        let mut answers = Vec::new();
        for (index, purpose) in [
            Purpose::Structural,
            Purpose::HumanVerify,
            Purpose::Decision,
            Purpose::Blocked,
            Purpose::UnusableCheck,
            Purpose::Progress,
        ]
        .into_iter()
        .enumerate()
        {
            for (d, disposition) in [
                GateDisposition::Approve,
                GateDisposition::Adjust,
                GateDisposition::Stop,
            ]
            .into_iter()
            .enumerate()
            {
                let id = format!("gate-{index}-{d}");
                let question = gate(root.path(), &id, purpose.clone());
                submit(&server, root.path(), &id, question.clone())
                    .await
                    .unwrap();
                let answer = answered(question, disposition);
                submit(
                    &server,
                    root.path(),
                    &format!("answer-{id}"),
                    answer.clone(),
                )
                .await
                .unwrap();
                answers.push(answer);
            }
        }
        let superseded = gate(root.path(), "old", Purpose::Decision);
        submit(&server, root.path(), "old-question", superseded.clone())
            .await
            .unwrap();
        let mut retired = superseded.clone();
        let Fact::Gate(g) = &mut retired.fact else {
            panic!("gate")
        };
        g.state = GateState::Superseded { by: "new".into() };
        submit(&server, root.path(), "supersede", retired)
            .await
            .unwrap();
        let before = server
            .store(root.path(), Operation::ReadVerified)
            .await
            .unwrap();
        assert!(
            submit(
                &server,
                root.path(),
                "old-answer",
                answered(superseded, GateDisposition::Approve)
            )
            .await
            .is_err()
        );
        let mut wrong_id = answered(unanswered.clone(), GateDisposition::Approve);
        let Fact::Gate(g) = &mut wrong_id.fact else {
            panic!("gate")
        };
        let GateState::Answered(a) = &mut g.state else {
            panic!("answer")
        };
        a.question_id = "different".into();
        assert!(
            submit(&server, root.path(), "wrong-id", wrong_id)
                .await
                .is_err()
        );
        let mut other_occurrence = answers[0].clone();
        other_occurrence.scope.occurrence = "run-again".into();
        assert!(
            submit(&server, root.path(), "reuse-answer", other_occurrence)
                .await
                .is_err()
        );
        let mut changed = answered(unanswered.clone(), GateDisposition::Approve);
        let Fact::Gate(g) = &mut changed.fact else {
            panic!("gate")
        };
        g.question.push('?');
        assert!(
            submit(&server, root.path(), "changed-question", changed)
                .await
                .is_err()
        );
        assert_eq!(
            server
                .store(root.path(), Operation::ReadVerified)
                .await
                .unwrap(),
            before
        );
        drop(server);
        let reopened = CadenceServer::with_factory(factory());
        let recovery = reopened.evidence(root.path(), Command::Read).await.unwrap();
        assert!(recovery.current.contains(&unanswered));
        for answer in &answers {
            assert!(recovery.current.contains(answer));
            assert!(recovery.history.contains(answer));
        }
        assert_eq!(recovery.history.len(), 39);
    });
}

#[test]
fn gate_answer_waits_for_its_own_confirmation() {
    let root = fixture();
    let rt = runtime();
    let armed = Arc::new(AtomicBool::new(false));
    let probe_armed = armed.clone();
    let (entered_tx, entered_rx) = std::sync::mpsc::channel();
    let (release_tx, release_rx) = std::sync::mpsc::channel();
    let release_rx = std::sync::Mutex::new(release_rx);
    let f = factory().with_probe(Arc::new(move |stage, path| {
        if stage == Stage::Confirmation
            && path.ends_with("state.json")
            && probe_armed.swap(false, Ordering::SeqCst)
        {
            entered_tx.send(()).unwrap();
            release_rx.lock().unwrap().recv().unwrap();
        }
        Ok(())
    }));
    let server = rt.block_on(async { CadenceServer::with_factory(f) });
    let pending = gate(root.path(), "question", Purpose::Progress);
    let before = rt
        .block_on(submit(&server, root.path(), "question", pending.clone()))
        .unwrap();
    armed.store(true, Ordering::SeqCst);
    let clone = server.clone();
    let path = root.path().to_path_buf();
    let answer = answered(pending.clone(), GateDisposition::Approve);
    let expected = answer.clone();
    let caller = rt.spawn(async move { submit(&clone, &path, "answer", answer).await });
    entered_rx
        .recv_timeout(std::time::Duration::from_secs(5))
        .unwrap();
    assert!(!caller.is_finished());
    assert_eq!(before.current, [pending]);
    release_tx.send(()).unwrap();
    let acknowledged = rt.block_on(caller).unwrap().unwrap();
    assert_eq!(acknowledged.current, [expected]);
    assert_eq!(acknowledged.history.len(), 2);
}

use cadence::evidence::results::{AcceptedResult, Reference};
fn accepted(root: &Path, id: &str, references: Vec<Reference>) -> Record {
    let mut value = checkpoint(root);
    value.fact = Fact::AcceptedResult(AcceptedResult {
        id: id.into(),
        contract: "cad-executor".into(),
        result: "PLAN COMPLETE".into(),
        evidence_text: "The work passed all checks".into(),
        references,
        checker_id: None,
    });
    value
}

#[test]
fn accepted_results_require_real_references_and_preserve_checker_outcomes() {
    let root = fixture();
    runtime().block_on(async {
        let server = CadenceServer::with_factory(factory());
        let refs = [
            Reference::Commit {
                sha: "60d94a5a".into(),
            },
            Reference::FileLine {
                file: "src/lib.rs".into(),
                line: 7,
            },
            Reference::Criterion { id: "AC7".into() },
        ];
        let mut expected = Vec::new();
        for (i, reference) in refs.into_iter().enumerate() {
            let id = format!("accepted-{i}");
            let value = accepted(root.path(), &id, vec![reference]);
            submit(&server, root.path(), &id, value.clone())
                .await
                .unwrap();
            expected.push(value);
        }
        let before = server
            .store(root.path(), Operation::ReadVerified)
            .await
            .unwrap();
        for bad in [
            Reference::Criterion { id: " \t".into() },
            Reference::FileLine {
                file: "".into(),
                line: 1,
            },
            Reference::FileLine {
                file: "some.rs".into(),
                line: 0,
            },
            Reference::Commit {
                sha: "just prose".into(),
            },
            Reference::Commit { sha: "abc".into() },
        ] {
            assert!(
                submit(
                    &server,
                    root.path(),
                    "bad-reference",
                    accepted(root.path(), "bad", vec![bad])
                )
                .await
                .is_err()
            );
        }
        for raw in [
            json!({"kind":"file_line","file":"some.rs"}),
            json!({"kind":"file_line","line":1}),
            json!({"kind":"criterion"}),
            json!({"kind":"prose","text":"it passed"}),
        ] {
            assert!(serde_json::from_value::<Reference>(raw).is_err());
        }
        assert_eq!(
            server
                .store(root.path(), Operation::ReadVerified)
                .await
                .unwrap(),
            before
        );
        for (id, raw, findings, disposition) in [
            (
                "warnings",
                "## ISSUES FOUND",
                vec![finding(1, Severity::Warning)],
                "pass",
            ),
            (
                "blocked",
                "## ISSUES FOUND",
                vec![finding(1, Severity::Blocker)],
                "fail",
            ),
            ("unusable", "", vec![], "unusable"),
        ] {
            let check = checker(root.path(), id, raw, findings);
            submit(&server, root.path(), id, check.clone())
                .await
                .unwrap();
            let mut result = accepted(
                root.path(),
                &format!("result-{id}"),
                vec![Reference::Criterion { id: "AC2".into() }],
            );
            let Fact::AcceptedResult(r) = &mut result.fact else {
                panic!("result")
            };
            r.checker_id = Some(id.into());
            r.result = disposition.into();
            let written = submit(
                &server,
                root.path(),
                &format!("receipt-{id}"),
                result.clone(),
            )
            .await
            .unwrap();
            assert!(written.current.contains(&check));
            expected.push(result);
        }
        drop(server);
        let reopened = CadenceServer::with_factory(factory());
        let recovered = reopened.evidence(root.path(), Command::Read).await.unwrap();
        for value in expected {
            assert!(recovered.current.contains(&value));
            assert!(recovered.history.contains(&value));
        }
    });
}

#[test]
fn ac7_no_reference_refuses_before_native_state_or_history_write() {
    let root = fixture();
    runtime().block_on(async {
        let server = CadenceServer::with_factory(factory());
        server.evidence(root.path(), Command::Read).await.unwrap();
        let before = server
            .store(root.path(), Operation::ReadVerified)
            .await
            .unwrap();
        let unsupported = accepted(root.path(), "unsupported", vec![]);
        assert!(
            submit(&server, root.path(), "unsupported", unsupported)
                .await
                .is_err(),
            "no-reference acceptance must refuse"
        );
        assert_eq!(
            server
                .store(root.path(), Operation::ReadVerified)
                .await
                .unwrap(),
            before
        );
    });
}

#[test]
fn legacy_evidence_is_readable_without_native_acceptance() {
    use cadence::store::model::{Decision, DecisionRecord, Evidence, Origin};
    let root = fixture();
    std::fs::write(root.path().join("trace.jsonl"), "{\"family\":\"outcome\",\"event\":\"legacy_check\",\"phase\":5,\"verdict\":\"opaque legacy pass\"}\n").unwrap();
    runtime().block_on(async {
        let server = CadenceServer::with_factory(factory());
        let imported = server
            .store(root.path(), Operation::ReadVerified)
            .await
            .unwrap();
        assert_eq!(imported.decisions.len(), 1);
        assert!(
            imported.snapshot.data["source_evidence"]
                .to_string()
                .contains("trace.jsonl")
        );
        for (index, evidence) in [
            Evidence::Missing,
            Evidence::Null,
            Evidence::Text("opaque legacy pass".into()),
        ]
        .into_iter()
        .enumerate()
        {
            server
                .store(
                    root.path(),
                    Operation::AppendDecision(DecisionRecord {
                        version: 1,
                        id: format!("legacy-{index}"),
                        revision: 1,
                        origin: Origin {
                            source: "legacy-import".into(),
                            original: evidence.clone(),
                        },
                        decision: Decision::Gate {
                            outcome: "pass".into(),
                            evidence,
                        },
                    }),
                )
                .await
                .unwrap();
        }
        let before = server
            .store(root.path(), Operation::ReadVerified)
            .await
            .unwrap();
        drop(server);
        let reopened = CadenceServer::with_factory(factory());
        let recovered = reopened.evidence(root.path(), Command::Read).await.unwrap();
        assert!(recovered.current.is_empty());
        assert!(recovered.history.is_empty());
        assert_eq!(
            reopened
                .store(root.path(), Operation::ReadVerified)
                .await
                .unwrap(),
            before
        );
    });
}

use std::{
    io::{BufRead, BufReader, Write},
    process::{Command as ProcessCommand, Stdio},
    time::Duration,
};
fn process_fixture() -> tempfile::TempDir {
    let root = fixture();
    std::fs::create_dir_all(root.path().join("phases/5")).unwrap();
    std::fs::write(root.path().join("phases/5/PLAN-1.md"), "# Evidence plan\n").unwrap();
    std::fs::write(root.path().join("ROADMAP.md"), "## Phases\n- [x] **Phase 1: One**\n- [x] **Phase 2: Two**\n- [x] **Phase 3: Three**\n- [x] **Phase 4: Four**\n- [ ] **Phase 5: Evidence**\n").unwrap();
    std::fs::write(root.path().join("STATE.md"), "Phase: 5 of 5 (Evidence)\nStatus: planned\nNext:  exact imported next\nUpdated: 2026-09-06\n").unwrap();
    for phase in 1..5 {
        let directory = root.path().join(format!("phases/{phase}"));
        std::fs::create_dir_all(&directory).unwrap();
        std::fs::write(directory.join("SUMMARY.md"), "completed work").unwrap();
        std::fs::write(directory.join("UAT.md"), "### 1. Done\nstatus: pass\n").unwrap();
    }
    root
}
fn process_barrier() {
    println!("EVIDENCE_BARRIER");
    std::io::stdout().flush().unwrap();
    loop {
        std::thread::park();
    }
}

#[test]
fn evidence_process_child() {
    let Ok(root) = std::env::var("CADENCE_EVIDENCE_CHILD_ROOT") else {
        return;
    };
    let root = std::path::PathBuf::from(root);
    let mode = std::env::var("CADENCE_EVIDENCE_CHILD_MODE").unwrap();
    runtime().block_on(async {
        // The fresh reader consumes only the address, never producer payloads.
        if mode == "read" || mode == "retry" {
            let server = CadenceServer::with_factory(factory());
            let initial = server.evidence(&root,Command::Read).await.unwrap();
            let recovered = if mode == "retry" {
                submit(&server,&root,"death-checkpoint",checkpoint(&root)).await.unwrap()
            } else { initial.clone() };
            let before_lifecycle = server.store(&root,Operation::ReadVerified).await.unwrap();
            server.lifecycle(&root).await.unwrap();
            let after = server.store(&root,Operation::ReadVerified).await.unwrap();
            assert_eq!(before_lifecycle,after,"evidence must not invalidate or rewrite the lifecycle memo");
            println!("EVIDENCE_RESULT {}",json!({"pid":std::process::id(),"initial":initial,"recovery":recovered,"data":after.snapshot.data,"generation":after.snapshot.generation,"operations":after.snapshot.operations}));
            return;
        }
        let armed = Arc::new(AtomicBool::new(false)); let probe_armed = armed.clone();
        let f = factory().with_probe(Arc::new(move |stage,path| {
            if stage == Stage::Confirmation && path.ends_with("state.json") && probe_armed.load(Ordering::SeqCst) { process_barrier(); }
            Ok(())
        }));
        let server = CadenceServer::with_factory(f);
        server.lifecycle(&root).await.unwrap();
        let before = server.store(&root,Operation::ReadVerified).await.unwrap();
        let mut data = before.snapshot.data.clone(); data["arbitrary"] = json!(["keep exact",null,17]);
        let baseline = server.store(&root,Operation::CompareRewriteSnapshot { expected_generation: before.snapshot.generation, expected_integrity: before.snapshot.integrity, data }).await.unwrap();
        println!("EVIDENCE_BASELINE {}",json!({"pid":std::process::id(),"data":baseline.snapshot.data}));
        std::io::stdout().flush().unwrap();
        if mode == "never-recorded" { process_barrier(); }
        if mode == "lost-reply" { armed.store(true,Ordering::SeqCst); }
        if mode == "facts" {
            for (id,raw,findings) in [
                ("pass","## VERIFICATION PASSED",vec![]),
                ("warnings","## ISSUES FOUND",vec![finding(1,Severity::Warning)]),
                ("blockers","## ISSUES FOUND",vec![finding(1,Severity::Blocker)]),
                ("mixed","## ISSUES FOUND",vec![finding(1,Severity::Warning),finding(2,Severity::Blocker)]),
                ("unusable","  no marked return\n",vec![]),
            ] { submit(&server,&root,id,checker(&root,id,raw,findings)).await.unwrap(); }
            let mut revised = checker(&root,"revision","## VERIFICATION PASSED",vec![]);
            let Fact::Checker(check) = &mut revised.fact else { panic!("checker") };
            check.attempt = Attempt::Revision { previous_check: "mixed".into(), previous_blockers: vec![finding(2,Severity::Blocker)], diff: "-old\n+new\n".into() };
            check.revision_spent = true;
            check.checked_material[0].content_digest = cadence::store::model::digest(b"revised material");
            submit(&server,&root,"revision",revised).await.unwrap();
            let question = gate(&root,"answered",Purpose::Structural);
            submit(&server,&root,"question",question.clone()).await.unwrap();
            submit(&server,&root,"answer",answered(question,GateDisposition::Adjust)).await.unwrap();
            submit(&server,&root,"unanswered",gate(&root,"unanswered",Purpose::Progress)).await.unwrap();
        } else {
            submit(&server,&root,"death-checkpoint",checkpoint(&root)).await.unwrap();
        }
        println!("EVIDENCE_ACK"); process_barrier();
    });
}

fn process_command(root: &Path, mode: &str) -> ProcessCommand {
    let mut command = ProcessCommand::new(std::env::current_exe().unwrap());
    command
        .args([
            "--exact",
            "server::evidence_service_tests::evidence_process_child",
            "--nocapture",
        ])
        .env("CADENCE_EVIDENCE_CHILD_ROOT", root)
        .env("CADENCE_EVIDENCE_CHILD_MODE", mode)
        .stdin(Stdio::null());
    command
}
fn killed_writer(root: &Path, mode: &str) -> serde_json::Value {
    let mut child = process_command(root, mode)
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .unwrap();
    let child_pid = child.id();
    let stdout = child.stdout.take().unwrap();
    let (sender, receiver) = std::sync::mpsc::channel();
    let reader = std::thread::spawn(move || {
        let mut lines = Vec::new();
        for line in BufReader::new(stdout).lines() {
            let line = line.unwrap();
            let barrier = line == "EVIDENCE_BARRIER";
            lines.push(line);
            if barrier {
                let _ = sender.send(lines.clone());
            }
        }
    });
    let reached = receiver.recv_timeout(Duration::from_secs(10));
    child.kill().unwrap();
    let status = child.wait().unwrap();
    reader.join().unwrap();
    let lines = reached.expect("production evidence child must reach its barrier");
    use std::os::unix::process::ExitStatusExt;
    assert_eq!(status.signal(), Some(libc::SIGKILL));
    assert_eq!(
        lines.iter().any(|line| line == "EVIDENCE_ACK"),
        matches!(mode, "checkpoint" | "facts")
    );
    let baseline: serde_json::Value = serde_json::from_str(
        lines
            .iter()
            .find_map(|line| line.strip_prefix("EVIDENCE_BASELINE "))
            .unwrap(),
    )
    .unwrap();
    assert_eq!(baseline["pid"], child_pid);
    baseline
}
fn fresh_reader(root: &Path, mode: &str) -> serde_json::Value {
    let output = process_command(root, mode).output().unwrap();
    assert!(
        output.status.success(),
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    serde_json::from_str(
        String::from_utf8(output.stdout)
            .unwrap()
            .lines()
            .find_map(|line| line.strip_prefix("EVIDENCE_RESULT "))
            .unwrap(),
    )
    .unwrap()
}
fn preserved_process_data(baseline: &serde_json::Value, read: &serde_json::Value) {
    assert_ne!(baseline["pid"], read["pid"]);
    for (key, value) in baseline["data"].as_object().unwrap() {
        assert_eq!(&read["data"][key], value, "preserve {key}");
    }
    assert!(read["data"]["derivation"]["memo"].is_object());
    assert!(read["data"]["import"].is_object());
    assert!(
        !read["data"]["source_evidence"]
            .as_array()
            .unwrap()
            .is_empty()
    );
}

#[test]
fn ac1_checkpoint_survives_real_kill_and_address_only_fresh_reader() {
    let root = process_fixture();
    let baseline = killed_writer(root.path(), "checkpoint");
    let read = fresh_reader(root.path(), "read");
    preserved_process_data(&baseline, &read);
    let recovery: Recovery = serde_json::from_value(read["recovery"].clone()).unwrap();
    assert_eq!(recovery.current.len(), 1);
    assert_eq!(recovery.history, recovery.current);
    let Fact::Checkpoint(cp) = &recovery.current[0].fact else {
        panic!("checkpoint")
    };
    assert_eq!(cp.checkpoint_type, CheckpointType::Structural);
    assert_eq!(cp.task_number, 3);
    assert_eq!(cp.task_name, "  tâche 日本語\t");
    assert_eq!(
        cp.need.as_bytes(),
        b"\n  Keep this Need exactly.\r\n\t\xc2\xbfAjustar?  \n"
    );
    assert_eq!(cp.state, State::Unresolved);
    assert_eq!(recovery.current[0].scope, checkpoint(root.path()).scope);
}

#[test]
fn ac2_ac3_checker_and_gate_facts_survive_process_death() {
    let root = process_fixture();
    let baseline = killed_writer(root.path(), "facts");
    let read = fresh_reader(root.path(), "read");
    preserved_process_data(&baseline, &read);
    let recovery: Recovery = serde_json::from_value(read["recovery"].clone()).unwrap();
    assert_eq!(recovery.current.len(), 8);
    assert_eq!(recovery.history.len(), 9);
    for (id, raw, findings, disposition) in [
        (
            "pass",
            "## VERIFICATION PASSED",
            vec![],
            CheckDisposition::Pass,
        ),
        (
            "warnings",
            "## ISSUES FOUND",
            vec![finding(1, Severity::Warning)],
            CheckDisposition::Pass,
        ),
        (
            "blockers",
            "## ISSUES FOUND",
            vec![finding(1, Severity::Blocker)],
            CheckDisposition::Fail,
        ),
        (
            "mixed",
            "## ISSUES FOUND",
            vec![finding(1, Severity::Warning), finding(2, Severity::Blocker)],
            CheckDisposition::Fail,
        ),
        (
            "unusable",
            "  no marked return\n",
            vec![],
            CheckDisposition::Unusable,
        ),
    ] {
        let value = checker(root.path(), id, raw, findings);
        assert!(recovery.current.contains(&value));
        let Fact::Checker(check) = &value.fact else {
            panic!("checker")
        };
        assert_eq!(check.disposition, disposition);
    }
    let revised = recovery
        .current
        .iter()
        .find_map(|r| match &r.fact {
            Fact::Checker(check) if check.id == "revision" => Some(check),
            _ => None,
        })
        .unwrap();
    assert!(revised.revision_spent);
    assert_eq!(revised.disposition, CheckDisposition::Pass);
    assert_eq!(
        revised.attempt,
        Attempt::Revision {
            previous_check: "mixed".into(),
            previous_blockers: vec![finding(2, Severity::Blocker)],
            diff: "-old\n+new\n".into()
        }
    );
    assert_eq!(
        revised.checked_material[0].content_digest,
        cadence::store::model::digest(b"revised material")
    );
    assert!(recovery.current.contains(&answered(
        gate(root.path(), "answered", Purpose::Structural),
        GateDisposition::Adjust
    )));
    assert!(
        recovery
            .current
            .contains(&gate(root.path(), "unanswered", Purpose::Progress))
    );
    assert!(
        recovery
            .history
            .contains(&gate(root.path(), "answered", Purpose::Structural))
    );
}

#[test]
fn admitted_lost_reply_retries_once_but_unrecorded_input_stays_absent() {
    for (mode, recorded_before_retry) in [("lost-reply", 1), ("never-recorded", 0)] {
        let root = process_fixture();
        let baseline = killed_writer(root.path(), mode);
        let read = fresh_reader(root.path(), "read");
        preserved_process_data(&baseline, &read);
        assert_eq!(
            read["recovery"]["history"].as_array().unwrap().len(),
            recorded_before_retry
        );
        let replay = fresh_reader(root.path(), "retry");
        preserved_process_data(&baseline, &replay);
        assert_eq!(
            replay["initial"]["history"].as_array().unwrap().len(),
            recorded_before_retry
        );
        assert_eq!(replay["recovery"]["history"].as_array().unwrap().len(), 1);
        if recorded_before_retry == 1 {
            assert_eq!(read["generation"], replay["generation"]);
        } else {
            assert!(read["generation"].as_u64().unwrap() < replay["generation"].as_u64().unwrap());
        }
        let twice = fresh_reader(root.path(), "retry");
        assert_eq!(twice["recovery"], replay["recovery"]);
        assert_eq!(twice["generation"], replay["generation"]);
        assert_eq!(twice["operations"], replay["operations"]);
    }
}

use cadence::evidence::overrides::{Authorization, Bypass, Meaning, Override, ReviewReceipt};
fn override_record(root: &Path, id: &str, meaning: Meaning) -> Record {
    let mut value = checkpoint(root);
    value.fact = Fact::Override(Override {
        id: id.into(),
        reason: "  My exact reason 日本語\r\n".into(),
        authorization: Authorization::Invocation {
            id: format!("authorization-{id}"),
            invocation: "explicit operator request".into(),
        },
        meaning,
    });
    value
}
fn review_receipt(base: &str, head: &str) -> ReviewReceipt {
    ReviewReceipt {
        base: base.into(),
        head: head.into(),
        trigger: "execute".into(),
        plan: Some("phases/5/PLAN-1.md".into()),
        correlation: "review-correlation".into(),
        round: Some(2),
        anchor: Some("earlier-run-anchor".into()),
        finding_record: "phases/5/ADJUDICATION.md:17".into(),
        settled: cadence::evidence::overrides::SettledCounts {
            survivors: 2,
            downgraded: 3,
            refuted: 4,
        },
    }
}

#[test]
fn four_overrides_share_submission_and_durable_readback() {
    let root = process_fixture();
    std::fs::write(root.path().join("phases/5/PLAN-2.md"), "second plan").unwrap();
    std::fs::create_dir_all(root.path().join("phases/5/reports")).unwrap();
    for n in 1..=2 {
        std::fs::write(
            root.path().join(format!("phases/5/reports/plan-{n}.md")),
            "PLAN COMPLETE\n",
        )
        .unwrap();
    }
    runtime().block_on(async {
        let server = CadenceServer::with_factory(factory());
        let failed = checker(
            root.path(),
            "failed",
            "## ISSUES FOUND",
            vec![finding(1, Severity::Blocker)],
        );
        submit(&server, root.path(), "failed", failed.clone())
            .await
            .unwrap();
        let forms = vec![
            override_record(
                root.path(),
                "rerun",
                Meaning::Rerun {
                    admitted_plans: vec!["PLAN-1.md".into(), "PLAN-2.md".into()],
                },
            ),
            override_record(
                root.path(),
                "bypass",
                Meaning::Bypass {
                    target: Bypass::Result {
                        checker_id: "failed".into(),
                        disposition: CheckDisposition::Fail,
                        material: vec![CheckedMaterial {
                            path: "phases/5/PLAN-1.md".into(),
                            content_digest: cadence::store::model::digest(
                                b"actual observed plan content",
                            ),
                        }],
                    },
                },
            ),
            override_record(
                root.path(),
                "pause",
                Meaning::PausedNext {
                    sentence: "  Ask René about 日本語; preserve\tthis  ".into(),
                },
            ),
            override_record(
                root.path(),
                "review",
                Meaning::Review(review_receipt("A", "B")),
            ),
        ];
        let before = server
            .store(root.path(), Operation::ReadVerified)
            .await
            .unwrap();
        let mut narrowed = forms[0].clone();
        let Fact::Override(o) = &mut narrowed.fact else {
            unreachable!()
        };
        o.meaning = Meaning::Rerun {
            admitted_plans: vec!["PLAN-2.md".into()],
        };
        assert!(
            submit(&server, root.path(), "narrowed", narrowed)
                .await
                .is_err()
        );
        for original in &forms {
            let mut missing = serde_json::to_value(original).unwrap();
            missing["fact"]["value"]
                .as_object_mut()
                .unwrap()
                .remove("reason");
            assert!(serde_json::from_value::<Record>(missing).is_err());
            for reason in ["", " \t\n"] {
                let mut invalid = original.clone();
                let Fact::Override(o) = &mut invalid.fact else {
                    unreachable!()
                };
                o.reason = reason.into();
                assert!(
                    submit(&server, root.path(), "invalid", invalid)
                        .await
                        .is_err()
                );
            }
        }
        let mut rewritten = forms[1].clone();
        let Fact::Override(o) = &mut rewritten.fact else {
            unreachable!()
        };
        o.meaning = Meaning::Bypass {
            target: Bypass::Result {
                checker_id: "failed".into(),
                disposition: CheckDisposition::Pass,
                material: vec![CheckedMaterial {
                    path: "phases/5/PLAN-1.md".into(),
                    content_digest: cadence::store::model::digest(b"actual observed plan content"),
                }],
            },
        };
        assert!(
            submit(&server, root.path(), "rewrite", rewritten)
                .await
                .is_err()
        );
        assert_eq!(
            server
                .store(root.path(), Operation::ReadVerified)
                .await
                .unwrap(),
            before
        );
        for (i, value) in forms.iter().enumerate() {
            submit(&server, root.path(), &format!("form-{i}"), value.clone())
                .await
                .unwrap();
        }
        drop(server);
        let server = CadenceServer::with_factory(factory());
        let reopened = server.evidence(root.path(), Command::Read).await.unwrap();
        assert_eq!(
            reopened.history,
            [vec![failed.clone()], forms.clone()].concat()
        );
        assert!(reopened.current.contains(&failed));
        for form in forms {
            assert!(reopened.current.contains(&form));
        }
    });
}

#[test]
fn override_requires_actual_invocation_or_recorded_authorizing_answer() {
    let root = fixture();
    std::fs::write(
        root.path().join("config.json"),
        r#"{"workflow":{"plan_check":false}}"#,
    )
    .unwrap();
    runtime().block_on(async {
        let server = CadenceServer::with_factory(factory());
        assert!(
            server
                .evidence(root.path(), Command::Read)
                .await
                .unwrap()
                .current
                .is_empty()
        );
        let value = override_record(
            root.path(),
            "skip",
            Meaning::Bypass {
                target: Bypass::Skipped {
                    check: "plan-check".into(),
                },
            },
        );
        let before = server
            .store(root.path(), Operation::ReadVerified)
            .await
            .unwrap();
        let unchanged = server
            .evidence(
                root.path(),
                Command::InvokeOverride {
                    requested: false,
                    operation_id: "unset".into(),
                    record: Box::new(value.clone()),
                },
            )
            .await
            .unwrap();
        assert!(unchanged.current.is_empty());
        assert_eq!(
            server
                .store(root.path(), Operation::ReadVerified)
                .await
                .unwrap(),
            before
        );
        server
            .evidence(
                root.path(),
                Command::InvokeOverride {
                    requested: true,
                    operation_id: "set".into(),
                    record: Box::new(value.clone()),
                },
            )
            .await
            .unwrap();
        let mut from_answer = value.clone();
        let Fact::Override(o) = &mut from_answer.fact else {
            unreachable!()
        };
        o.id = "answer-skip".into();
        o.authorization = Authorization::Answer {
            id: "operator-answer-1".into(),
            question_id: "bypass-question".into(),
        };
        assert!(
            submit(&server, root.path(), "no-answer", from_answer.clone())
                .await
                .is_err()
        );
        let question = gate(root.path(), "bypass-question", Purpose::UnusableCheck);
        submit(&server, root.path(), "question", question.clone())
            .await
            .unwrap();
        assert!(
            submit(&server, root.path(), "unanswered", from_answer.clone())
                .await
                .is_err()
        );
        submit(
            &server,
            root.path(),
            "answer",
            answered(question, GateDisposition::Approve),
        )
        .await
        .unwrap();
        submit(&server, root.path(), "from-answer", from_answer.clone())
            .await
            .unwrap();
        drop(server);
        let server = CadenceServer::with_factory(factory());
        let recovered = server.evidence(root.path(), Command::Read).await.unwrap();
        assert!(recovered.current.contains(&value));
        assert!(recovered.current.contains(&from_answer));
    });
}

#[test]
fn review_receipts_keep_two_ranges_one_answer_and_legacy_originals() {
    let root = fixture();
    let legacy = concat!(
        "{\"family\":\"outcome\",\"event\":\"override\",\"phase\":5,\"base\":\"B\",\"sha\":\"C\",\"trigger\":\"execute\",\"detail\":\"  legacy reason  \"}\n",
        "{\"family\":\"outcome\",\"event\":\"override\",\"phase\":5,\"verdict\":\"override\",\"detail\":\"historical receipt without endpoints\"}\n"
    );
    std::fs::write(root.path().join("trace.jsonl"), legacy).unwrap();
    runtime().block_on(async {
        let server = CadenceServer::with_factory(factory());
        let before = server
            .store(root.path(), Operation::ReadVerified)
            .await
            .unwrap();
        assert_eq!(
            before.decisions.len(),
            1,
            "the established legacy outcome stays readable"
        );
        let sources: Vec<crate::import::SourceEvidence> =
            serde_json::from_value(before.snapshot.data["source_evidence"].clone()).unwrap();
        assert!(
            sources
                .iter()
                .any(|s| s.source.path.ends_with("trace.jsonl")
                    && s.source.bytes == legacy.as_bytes())
        );
        let question = gate(root.path(), "two-ranges", Purpose::Decision);
        submit(&server, root.path(), "question", question.clone())
            .await
            .unwrap();
        submit(
            &server,
            root.path(),
            "answer",
            answered(question, GateDisposition::Approve),
        )
        .await
        .unwrap();
        let mut receipts = Vec::new();
        for (id, base, head) in [("first", "B", "C"), ("second", "D", "E")] {
            let mut receipt = review_receipt(base, head);
            receipt.finding_record = format!("phases/5/{id}-ADJUDICATION.md:17");
            if id == "second" {
                receipt.round = None;
                receipt.anchor = None;
            }
            let mut value = override_record(root.path(), id, Meaning::Review(receipt));
            let Fact::Override(o) = &mut value.fact else {
                unreachable!()
            };
            o.authorization = Authorization::Answer {
                id: "operator-answer-1".into(),
                question_id: "two-ranges".into(),
            };
            submit(&server, root.path(), id, value.clone())
                .await
                .unwrap();
            receipts.push(value);
        }
        let written = server
            .store(root.path(), Operation::ReadVerified)
            .await
            .unwrap();
        for field in ["source_evidence", "cursor", "import"] {
            assert_eq!(written.snapshot.data[field], before.snapshot.data[field]);
        }
        assert_eq!(written.decisions[0], before.decisions[0]);
        for field in ["reason", "base", "head", "finding_record", "correlation"] {
            let mut raw = serde_json::to_value(&receipts[0]).unwrap();
            let target = if field == "reason" {
                &mut raw["fact"]["value"]
            } else {
                &mut raw["fact"]["value"]["meaning"]
            };
            target.as_object_mut().unwrap().remove(field);
            assert!(
                serde_json::from_value::<Record>(raw).is_err(),
                "missing {field}"
            );
            let mut raw = serde_json::to_value(&receipts[0]).unwrap();
            let target = if field == "reason" {
                &mut raw["fact"]["value"]
            } else {
                &mut raw["fact"]["value"]["meaning"]
            };
            target[field] = json!(" \t");
            assert!(
                submit(
                    &server,
                    root.path(),
                    "invalid",
                    serde_json::from_value(raw).unwrap()
                )
                .await
                .is_err(),
                "blank {field}"
            );
        }
        assert_eq!(
            server
                .store(root.path(), Operation::ReadVerified)
                .await
                .unwrap(),
            written
        );
        drop(server);
        let server = CadenceServer::with_factory(factory());
        let recovered = server.evidence(root.path(), Command::Read).await.unwrap();
        for value in &receipts {
            assert!(recovered.current.contains(value));
            assert!(recovered.history.contains(value));
        }
        let scope = &receipts[0].scope;
        let plan = Some(scope.plan.as_str());
        assert_eq!(
            recovered.review_settlements(scope, "B", "C", "execute", plan),
            vec![&receipts[0]]
        );
        assert_eq!(
            recovered.review_settlements(scope, "D", "E", "execute", plan),
            vec![&receipts[1]]
        );
        for (base, head, trigger, plan) in [
            ("A", "C", "execute", plan),
            ("B", "C", "plan", plan),
            ("B", "C", "execute", Some("PLAN-2.md")),
            ("B", "C", "execute", None),
        ] {
            assert!(
                recovered
                    .review_settlements(scope, base, head, trigger, plan)
                    .is_empty()
            );
        }
        assert_eq!(
            server
                .store(root.path(), Operation::ReadVerified)
                .await
                .unwrap(),
            written
        );
        assert_eq!(
            std::fs::read(root.path().join("trace.jsonl")).unwrap(),
            legacy.as_bytes()
        );
    });
}

use cadence::evidence::authority::{Occurrence, Permission};
async fn permission(server: &CadenceServer, root: &Path, scope: &Scope, id: &str) -> Permission {
    server
        .evidence(
            root,
            Command::Permission {
                scope: scope.clone(),
                override_id: id.into(),
            },
        )
        .await
        .unwrap()
        .permission
        .unwrap()
}
fn terminal(grant: &Record, state: Occurrence) -> Record {
    Record {
        version: VERSION,
        scope: grant.scope.clone(),
        fact: Fact::Occurrence(state),
    }
}

#[test]
fn occurrence_permission_survives_restart_and_ends_only_by_scoped_transition() {
    for state in [
        Occurrence::Fulfilled {
            completion: "resume finished at commit 1234567".into(),
        },
        Occurrence::Superseded {
            by: "dispatch-5-2".into(),
        },
    ] {
        let root = process_fixture();
        runtime().block_on(async {
            let server = CadenceServer::with_factory(factory());
            let pause = override_record(
                root.path(),
                "pause",
                Meaning::PausedNext {
                    sentence: "  Resume this exact instruction 日本語\t".into(),
                },
            );
            let review = override_record(
                root.path(),
                "review",
                Meaning::Review(review_receipt("B", "C")),
            );
            submit(&server, root.path(), "pause", pause.clone())
                .await
                .unwrap();
            submit(&server, root.path(), "review", review.clone())
                .await
                .unwrap();
            assert_eq!(
                permission(&server, root.path(), &pause.scope, "pause").await,
                Permission::Pending,
                "saving preservation leaves resume pending"
            );
            drop(server);
            let server = CadenceServer::with_factory(factory());
            assert!(
                permission(&server, root.path(), &pause.scope, "pause")
                    .await
                    .active()
            );
            let mut later = pause.scope.clone();
            later.occurrence = "dispatch-5-2".into();
            assert_eq!(
                permission(&server, root.path(), &later, "pause").await,
                Permission::Absent
            );
            for field in ["phase", "plan", "report", "cycle"] {
                let mut raw = serde_json::to_value(&pause.scope).unwrap();
                raw[field] = json!("another");
                assert!(
                    !permission(
                        &server,
                        root.path(),
                        &serde_json::from_value(raw).unwrap(),
                        "pause"
                    )
                    .await
                    .active()
                );
            }
            let transition = terminal(&pause, state.clone());
            let mut wrong = transition.clone();
            wrong.scope.occurrence = "never-granted".into();
            assert!(submit(&server, root.path(), "wrong", wrong).await.is_err());
            submit(&server, root.path(), "end", transition.clone())
                .await
                .unwrap();
            drop(server);
            let server = CadenceServer::with_factory(factory());
            let expected = match state {
                Occurrence::Fulfilled { .. } => Permission::Fulfilled,
                Occurrence::Superseded { .. } => Permission::Superseded,
            };
            assert_eq!(
                permission(&server, root.path(), &pause.scope, "pause").await,
                expected
            );
            assert!(
                !permission(&server, root.path(), &review.scope, "review")
                    .await
                    .active()
            );
            let before = server
                .store(root.path(), Operation::ReadVerified)
                .await
                .unwrap();
            let replay = submit(&server, root.path(), "pause", pause.clone())
                .await
                .unwrap();
            assert_eq!(
                replay.history,
                vec![pause.clone(), review.clone(), transition]
            );
            assert!(replay.current.contains(&pause));
            assert_eq!(
                replay.review_settlements(
                    &review.scope,
                    "B",
                    "C",
                    "execute",
                    Some(&review.scope.plan)
                ),
                vec![&review]
            );
            assert!(
                !permission(&server, root.path(), &pause.scope, "pause")
                    .await
                    .active()
            );
            assert!(
                submit(
                    &server,
                    root.path(),
                    "new-grant-old-work",
                    override_record(
                        root.path(),
                        "new",
                        Meaning::PausedNext {
                            sentence: "same words".into()
                        }
                    )
                )
                .await
                .is_err()
            );
            assert!(
                submit(
                    &server,
                    root.path(),
                    "second-transition",
                    terminal(
                        &pause,
                        Occurrence::Fulfilled {
                            completion: "again".into()
                        }
                    )
                )
                .await
                .is_err()
            );
            assert_eq!(
                server
                    .store(root.path(), Operation::ReadVerified)
                    .await
                    .unwrap(),
                before
            );
            let mut fresh = pause.clone();
            fresh.scope = later;
            submit(&server, root.path(), "fresh-answer", fresh.clone())
                .await
                .unwrap();
            assert!(
                permission(&server, root.path(), &fresh.scope, "pause")
                    .await
                    .active()
            );
            assert!(
                !permission(&server, root.path(), &pause.scope, "pause")
                    .await
                    .active()
            );
        });
    }
}

#[test]
fn active_override_cannot_suppress_lifecycle_conflict() {
    let root = process_fixture();
    runtime().block_on(async {
        let server = CadenceServer::with_factory(factory());
        let value = override_record(
            root.path(),
            "pause",
            Meaning::PausedNext {
                sentence: "resume".into(),
            },
        );
        submit(&server, root.path(), "pause", value.clone())
            .await
            .unwrap();
        assert!(
            permission(&server, root.path(), &value.scope, "pause")
                .await
                .active()
        );
        let path = root.path().join("ROADMAP.md");
        let text = std::fs::read_to_string(&path)
            .unwrap()
            .replace("- [ ] **Phase 5", "- [x] **Phase 5");
        std::fs::write(path, text).unwrap();
        let error = server
            .evidence(
                root.path(),
                Command::Permission {
                    scope: value.scope.clone(),
                    override_id: "pause".into(),
                },
            )
            .await
            .unwrap_err();
        assert!(
            matches!(error,Error::Conflict(ref detail) if detail.contains("StateConflict")),
            "{error:?}"
        );
        assert!(
            server
                .evidence(root.path(), Command::Read)
                .await
                .unwrap()
                .current
                .contains(&value)
        );
    });
}

use cadence::evidence::{
    authority::CheckerApplicability,
    material::{self, Freshness, Observation},
};
fn observed_material(root: &Path, paths: &[&str]) -> Vec<CheckedMaterial> {
    paths
        .iter()
        .map(|path| CheckedMaterial {
            path: (*path).into(),
            content_digest: cadence::store::model::digest(&std::fs::read(root.join(path)).unwrap()),
        })
        .collect()
}
async fn checker_permission(
    server: &CadenceServer,
    root: &Path,
    scope: &Scope,
    checker_id: &str,
) -> CheckerApplicability {
    server
        .evidence(
            root,
            Command::CheckerApplicability {
                scope: scope.clone(),
                checker_id: checker_id.into(),
            },
        )
        .await
        .unwrap()
        .checker_applicability
        .unwrap()
}
fn material_override(
    root: &Path,
    id: &str,
    check: &str,
    materials: Vec<CheckedMaterial>,
) -> Record {
    override_record(
        root,
        id,
        Meaning::Bypass {
            target: Bypass::Result {
                checker_id: check.into(),
                disposition: CheckDisposition::Pass,
                material: materials,
            },
        },
    )
}
async fn spent_revision(server: &CadenceServer, root: &Path) -> Record {
    let mut initial = checker(
        root,
        "initial",
        "## ISSUES FOUND",
        vec![finding(1, Severity::Blocker)],
    );
    let Fact::Checker(c) = &mut initial.fact else {
        unreachable!()
    };
    c.checked_material = observed_material(root, &["phases/5/PLAN-1.md", "phases/5/CONTEXT.md"]);
    submit(server, root, "initial", initial).await.unwrap();
    let mut revised = checker(root, "revised", "## VERIFICATION PASSED", vec![]);
    let Fact::Checker(c) = &mut revised.fact else {
        unreachable!()
    };
    c.checked_material = observed_material(root, &["phases/5/PLAN-1.md"]);
    c.attempt = Attempt::Revision {
        previous_check: "initial".into(),
        previous_blockers: vec![finding(1, Severity::Blocker)],
        diff: "-missing proof\n+proof\n".into(),
    };
    c.revision_spent = true;
    submit(server, root, "revised", revised.clone())
        .await
        .unwrap();
    revised
}

#[test]
fn changed_material_needs_fresh_verdict_or_exact_override_without_revision_refund() {
    let root = process_fixture();
    std::fs::write(root.path().join("phases/5/CONTEXT.md"), "locked decision").unwrap();
    runtime().block_on(async {
        let server = CadenceServer::with_factory(factory());
        let revised = spent_revision(&server, root.path()).await;
        let scope = revised.scope.clone();
        let old_override = material_override(
            root.path(),
            "old-material",
            "revised",
            observed_material(root.path(), &["phases/5/PLAN-1.md", "phases/5/CONTEXT.md"]),
        );
        submit(&server, root.path(), "old-material", old_override)
            .await
            .unwrap();
        let lifecycle = server.lifecycle(root.path()).await.unwrap();
        let memo = server
            .store(root.path(), Operation::ReadVerified)
            .await
            .unwrap()
            .snapshot
            .data["derivation"]
            .clone();
        drop(server);
        let server = CadenceServer::with_factory(factory());
        let current = checker_permission(&server, root.path(), &scope, "revised").await;
        assert!(
            current.verdict_applicable && current.continuation_allowed && current.revision_spent
        );
        std::fs::write(
            root.path().join("phases/5/PLAN-1.md"),
            "same filename, changed body",
        )
        .unwrap();
        let changed = checker_permission(&server, root.path(), &scope, "revised").await;
        assert_eq!(changed.freshness, Freshness::Changed);
        assert!(
            !changed.verdict_applicable && !changed.continuation_allowed && changed.revision_spent
        );
        assert_eq!(server.lifecycle(root.path()).await.unwrap(), lifecycle);
        assert_eq!(
            server
                .store(root.path(), Operation::ReadVerified)
                .await
                .unwrap()
                .snapshot
                .data["derivation"],
            memo
        );
        assert!(
            server
                .evidence(root.path(), Command::Read)
                .await
                .unwrap()
                .history
                .contains(&revised)
        );
        let mut unrelated = checker(root.path(), "revised", "## VERIFICATION PASSED", vec![]);
        unrelated.scope.occurrence = "another-occurrence".into();
        let Fact::Checker(c) = &mut unrelated.fact else {
            unreachable!()
        };
        c.checked_material =
            observed_material(root.path(), &["phases/5/PLAN-1.md", "phases/5/CONTEXT.md"]);
        submit(&server, root.path(), "unrelated-check", unrelated.clone())
            .await
            .unwrap();
        let mut wrong = material_override(
            root.path(),
            "wrong-occurrence",
            "revised",
            observed_material(root.path(), &["phases/5/PLAN-1.md", "phases/5/CONTEXT.md"]),
        );
        wrong.scope = unrelated.scope;
        submit(&server, root.path(), "wrong-occurrence", wrong)
            .await
            .unwrap();
        assert!(
            !checker_permission(&server, root.path(), &scope, "revised")
                .await
                .continuation_allowed
        );
        let mut fresh = checker(root.path(), "fresh", "## VERIFICATION PASSED", vec![]);
        let Fact::Checker(c) = &mut fresh.fact else {
            unreachable!()
        };
        c.checked_material =
            observed_material(root.path(), &["phases/5/PLAN-1.md", "phases/5/CONTEXT.md"]);
        c.revision_spent = true;
        submit(&server, root.path(), "fresh", fresh.clone())
            .await
            .unwrap();
        let result = checker_permission(&server, root.path(), &scope, "fresh").await;
        assert!(result.continuation_allowed && result.verdict_applicable && result.revision_spent);
        let explicit = material_override(
            root.path(),
            "changed-work",
            "revised",
            observed_material(root.path(), &["phases/5/PLAN-1.md", "phases/5/CONTEXT.md"]),
        );
        submit(&server, root.path(), "changed-work", explicit.clone())
            .await
            .unwrap();
        drop(server);
        let server = CadenceServer::with_factory(factory());
        let allowed = checker_permission(&server, root.path(), &scope, "revised").await;
        assert!(
            !allowed.verdict_applicable && allowed.continuation_allowed && allowed.revision_spent
        );
        assert_eq!(allowed.override_id.as_deref(), Some("changed-work"));
        let before = server
            .store(root.path(), Operation::ReadVerified)
            .await
            .unwrap();
        let mut refund = fresh.clone();
        let Fact::Checker(c) = &mut refund.fact else {
            unreachable!()
        };
        c.id = "refund".into();
        c.revision_spent = false;
        assert!(
            submit(&server, root.path(), "refund", refund)
                .await
                .is_err()
        );
        let mut second = revised.clone();
        let Fact::Checker(c) = &mut second.fact else {
            unreachable!()
        };
        c.id = "second-revision".into();
        assert!(
            submit(&server, root.path(), "second-revision", second)
                .await
                .is_err()
        );
        assert_eq!(
            server
                .store(root.path(), Operation::ReadVerified)
                .await
                .unwrap(),
            before
        );
        std::fs::write(root.path().join("phases/5/PLAN-1.md"), "another edit").unwrap();
        for id in ["initial", "revised", "fresh"] {
            let result = checker_permission(&server, root.path(), &scope, id).await;
            assert!(!result.continuation_allowed && result.revision_spent);
        }
        std::fs::remove_file(root.path().join("phases/5/CONTEXT.md")).unwrap();
        let failed = server
            .evidence(
                root.path(),
                Command::CheckerApplicability {
                    scope: scope.clone(),
                    checker_id: "revised".into(),
                },
            )
            .await
            .unwrap();
        let result = failed.checker_applicability.unwrap();
        assert_eq!(result.freshness, Freshness::Unavailable);
        assert!(!result.continuation_allowed && result.revision_spent);
        assert!(matches!(
            failed.material_observations["phases/5/CONTEXT.md"],
            Observation::Failed(_)
        ));
        assert!(failed.history.contains(&revised) && failed.history.contains(&explicit));
    });
}

#[test]
fn narrowed_revision_keeps_initial_observations_and_read_failures_never_approve() {
    let root = process_fixture();
    let context = root.path().join("phases/5/CONTEXT.md");
    std::fs::write(&context, "original context").unwrap();
    runtime().block_on(async {
        let server = CadenceServer::with_factory(factory());
        let revised = spent_revision(&server,root.path()).await;
        assert!(checker_permission(&server,root.path(),&revised.scope,"revised").await.continuation_allowed);
        let recovered = server.evidence(root.path(),Command::Read).await.unwrap();
        let basis = material::basis(&recovered.current,&revised.scope,"revised").unwrap();
        assert_eq!(basis.len(),2);
        let Fact::Checker(c) = &revised.fact else { unreachable!() };
        assert_eq!(c.checked_material.len(),1,"revision did not reread the full input set");
        assert!(matches!(&c.attempt,Attempt::Revision { previous_blockers,diff,.. } if previous_blockers.len() == 1 && diff == "-missing proof\n+proof\n"));
        std::fs::write(&context,"changed outside narrowed revision").unwrap();
        let changed = checker_permission(&server,root.path(),&revised.scope,"revised").await;
        assert_eq!(changed.freshness,Freshness::Changed);
        assert!(!changed.continuation_allowed && changed.revision_spent);
        std::fs::write(&context,"original context").unwrap();
        let injected = super::evidence_service::observe_material(root.path(),&basis,&mut |_| Err(std::io::Error::new(std::io::ErrorKind::PermissionDenied,"injected read denial")));
        assert!(injected.values().all(|o| matches!(o,Observation::Failed(s) if s.contains("PermissionDenied"))));
        let result = cadence::evidence::authority::checker_applicability(&recovered.current,&revised.scope,"revised",&injected).unwrap();
        assert_eq!(result.freshness,Freshness::Unavailable);
        assert!(!result.verdict_applicable && !result.continuation_allowed && result.revision_spent);
        drop(server);
        let server = CadenceServer::with_factory(factory());
        assert!(checker_permission(&server,root.path(),&revised.scope,"revised").await.revision_spent);
    });
}
