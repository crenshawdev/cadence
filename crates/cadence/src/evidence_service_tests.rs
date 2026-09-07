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
        let Fact::Checkpoint(cp) = &mut invalid.fact;
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
