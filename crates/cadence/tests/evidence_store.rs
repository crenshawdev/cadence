use cadence::evidence::{
    Fact, Record, Scope, VERSION,
    checkpoint::{Checkpoint, CheckpointType, State},
    persistence,
};
use cadence::store::{
    Error, MutationContext, Policy, Result,
    filesystem::{Filesystem, Stage},
    model::{Disposition, Evidence, ItemRecord, Origin},
    transaction::Transaction,
    writer::{Operation, STALE_SNAPSHOT, Store, View},
};
use serde_json::json;

struct Allow;
impl Policy for Allow {
    fn validate(&mut self, _: &MutationContext<'_>) -> Result<()> {
        Ok(())
    }
}
fn runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Runtime::new().unwrap()
}
fn record() -> Record {
    Record {
        version: VERSION,
        scope: Scope {
            project: "/repo".into(),
            planning_root: "/repo/.planning".into(),
            cycle: "v4".into(),
            occurrence: "run-1".into(),
            phase: "5".into(),
            plan: "PLAN-1.md".into(),
            report: "reports/plan-1.md".into(),
        },
        fact: Fact::Checkpoint(Checkpoint {
            id: "checkpoint".into(),
            checkpoint_type: CheckpointType::Blocked,
            task_number: 2,
            task_name: "write evidence".into(),
            need: "  Need\n".into(),
            completed_work: vec![],
            state: State::Unresolved,
            failing_output: None,
        }),
    }
}
fn proposal(view: &View) -> Transaction {
    Transaction {
        id: "evidence-op".into(),
        items: vec![],
        decisions: vec![persistence::history("evidence-op", &record()).unwrap()],
        snapshot: Some(persistence::project(&view.snapshot.data, &record()).unwrap()),
        external: vec![],
    }
}
fn guarded(view: &View, transaction: Transaction) -> Operation {
    Operation::CompareTransact {
        expected_generation: view.snapshot.generation,
        expected_integrity: view.snapshot.integrity.clone(),
        transaction,
    }
}

#[test]
fn acknowledged_history_projection_reopen_and_replay() {
    let root = tempfile::tempdir().unwrap();
    runtime().block_on(async {
        let store = Store::open(Filesystem::new(root.path()).unwrap(), Allow).await.unwrap();
        let seed = json!({"import":{"sources":["original"]},"source_evidence":["exact"],"archive":[1],"cursor":"raw", "derivation":{"memo":"hash"},"lifecycle_intake":"old", "other":true});
        let before = store.request(Operation::RewriteSnapshot(seed.clone())).await.unwrap();
        let transaction = proposal(&before);
        let written = store.request(guarded(&before, transaction.clone())).await.unwrap();
        assert_eq!(written.decisions, transaction.decisions);
        assert_eq!(persistence::read(&written.snapshot.data).unwrap().into_values().collect::<Vec<_>>(), [record()]);
        for (key,value) in seed.as_object().unwrap() { assert_eq!(&written.snapshot.data[key],value); }
        assert_eq!(store.request(guarded(&before, transaction.clone())).await.unwrap(), written);
        drop(store);
        let reopened = Store::open(Filesystem::new(root.path()).unwrap(), Allow).await.unwrap();
        assert_eq!(reopened.request(guarded(&before, transaction.clone())).await.unwrap(), written);
        let mut changed = transaction; changed.snapshot.as_mut().unwrap()["other"] = json!(false);
        assert!(matches!(reopened.request(guarded(&before, changed)).await, Err(Error::Conflict(_))));
        assert_eq!(reopened.request(Operation::Read).await.unwrap(), written);
    });
}

#[test]
fn intervening_item_or_snapshot_makes_evidence_stale() {
    for snapshot in [false, true] {
        let root = tempfile::tempdir().unwrap();
        runtime().block_on(async {
            let store = Store::open(Filesystem::new(root.path()).unwrap(), Allow)
                .await
                .unwrap();
            let before = store.request(Operation::ReadVerified).await.unwrap();
            let operation = if snapshot {
                Operation::RewriteSnapshot(json!({"winner":true}))
            } else {
                Operation::AppendItem(ItemRecord {
                    version: 1,
                    id: "winner".into(),
                    revision: 1,
                    origin: Origin {
                        source: "capture".into(),
                        original: Evidence::Missing,
                    },
                    text: "keep".into(),
                    kind: "todo".into(),
                    disposition: Disposition::Captured,
                    completed: false,
                    filing_uncertain: false,
                })
            };
            let winner = store.request(operation).await.unwrap();
            assert_eq!(
                store.request(guarded(&before, proposal(&before))).await,
                Err(Error::Conflict(STALE_SNAPSHOT.into()))
            );
            assert_eq!(store.request(Operation::Read).await.unwrap(), winner);
        });
    }
}

#[test]
fn evidence_confirmation_holds_reply_and_cancellation_keeps_admitted_write() {
    let root = tempfile::tempdir().unwrap();
    let (entered_tx, entered_rx) = std::sync::mpsc::channel();
    let (release_tx, release_rx) = std::sync::mpsc::channel();
    let mut held = false;
    let fs = Filesystem::new(root.path())
        .unwrap()
        .with_probe(move |stage, path| {
            if stage == Stage::Confirmation && path.ends_with("state.json") && !held {
                held = true;
                entered_tx.send(()).unwrap();
                release_rx.recv().unwrap();
            }
            Ok(())
        });
    let rt = runtime();
    let store = rt.block_on(Store::open(fs, Allow)).unwrap();
    let before = rt.block_on(store.request(Operation::Read)).unwrap();
    let transaction = proposal(&before);
    let cloned = store.clone();
    let operation = guarded(&before, transaction.clone());
    let caller = rt.spawn(async move { cloned.request(operation).await });
    entered_rx
        .recv_timeout(std::time::Duration::from_secs(5))
        .unwrap();
    assert!(!caller.is_finished());
    caller.abort();
    release_tx.send(()).unwrap();
    let recovered = rt
        .block_on(store.request(guarded(&before, transaction)))
        .unwrap();
    assert_eq!(recovered.decisions.len(), 1);
    assert_eq!(
        persistence::read(&recovered.snapshot.data).unwrap().len(),
        1
    );
}

#[test]
fn evidence_sync_failures_never_acknowledge() {
    for fail in [Stage::TemporarySync, Stage::DirectorySync] {
        let root = tempfile::tempdir().unwrap();
        let fs = Filesystem::new(root.path())
            .unwrap()
            .with_probe(move |stage, _| {
                if stage == fail {
                    Err(Error::Io(format!("injected {fail:?}")))
                } else {
                    Ok(())
                }
            });
        runtime().block_on(async {
            let store = Store::open(fs, Allow).await.unwrap();
            let before = store.request(Operation::Read).await.unwrap();
            assert_eq!(
                store.request(guarded(&before, proposal(&before))).await,
                Err(Error::Io(format!("injected {fail:?}")))
            );
            drop(store);
            let recovered = Store::open(Filesystem::new(root.path()).unwrap(), Allow)
                .await
                .unwrap();
            let view = recovered.request(Operation::ReadVerified).await.unwrap();
            assert_eq!(
                view.decisions.len(),
                persistence::read(&view.snapshot.data).unwrap().len()
            );
        });
    }
}
