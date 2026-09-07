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
        root.path().join("TRACE.jsonl"),
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
