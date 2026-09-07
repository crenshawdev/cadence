//! Native guard and cooperating-store process fixtures. All mutable inputs are temporary.
use cadence::store::filesystem::{Filesystem, Stage};
use cadence::store::model::{Decision, DecisionRecord, Evidence, Origin, VERSION};
use cadence::store::transaction::{INTENT, Transaction};
use cadence::store::writer::{Operation, STALE_SNAPSHOT, Store};
use cadence::store::{Error, MutationContext, Policy, Result};
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

struct Allow;
impl Policy for Allow {
    fn validate(&mut self, _: &MutationContext<'_>) -> Result<()> {
        Ok(())
    }
}
fn runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Builder::new_current_thread()
        .build()
        .unwrap()
}
fn decision(id: &str) -> DecisionRecord {
    DecisionRecord {
        version: VERSION,
        id: id.into(),
        revision: 1,
        origin: Origin {
            source: "phase7-test".into(),
            original: Evidence::Missing,
        },
        decision: Decision::Gate {
            outcome: id.into(),
            evidence: Evidence::Missing,
        },
    }
}
fn transaction(id: &str) -> Transaction {
    Transaction {
        id: id.into(),
        items: vec![],
        decisions: vec![decision(id)],
        snapshot: None,
        external: vec![],
    }
}
fn wait_for(path: &Path) {
    let deadline = Instant::now() + Duration::from_secs(15);
    while !path.exists() {
        assert!(
            Instant::now() < deadline,
            "timed out waiting for {}",
            path.display()
        );
        std::thread::sleep(Duration::from_millis(10));
    }
}
fn mark(root: &Path, name: &str) {
    std::fs::write(root.join(name), b"ready").unwrap();
}
struct Process(Child);
impl Process {
    fn wait(&mut self) {
        let deadline = Instant::now() + Duration::from_secs(15);
        loop {
            if let Some(status) = self.0.try_wait().unwrap() {
                assert!(status.success(), "child failed: {status}");
                return;
            }
            assert!(Instant::now() < deadline, "child timed out");
            std::thread::sleep(Duration::from_millis(10));
        }
    }
    fn kill(&mut self) {
        self.0.kill().unwrap();
        self.0.wait().unwrap();
    }
}
impl Drop for Process {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}
fn child(root: &Path, mode: &str) -> Process {
    Process(
        Command::new(std::env::current_exe().unwrap())
            .args(["--exact", "store_process", "--nocapture"])
            .env("CADENCE_PHASE7_STORE_ROOT", root)
            .env("CADENCE_PHASE7_STORE_MODE", mode)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::inherit())
            .spawn()
            .unwrap(),
    )
}
#[test]
fn store_process() {
    let Ok(root) = std::env::var("CADENCE_PHASE7_STORE_ROOT") else {
        return;
    };
    let root = std::path::PathBuf::from(root);
    let mode = std::env::var("CADENCE_PHASE7_STORE_MODE").unwrap();
    let probe_mode = mode.clone();
    let probe_root = root.clone();
    let filesystem = Filesystem::new(&root)
        .unwrap()
        .with_probe(move |stage, path| {
            let pause = (probe_mode == "admit"
                && stage == Stage::DirectorySynced
                && path.file_name().is_some_and(|p| p == INTENT))
                || (probe_mode == "recover" && stage == Stage::RecoverySync);
            if pause {
                mark(&probe_root, &format!("{probe_mode}-held"));
                loop {
                    std::thread::park();
                }
            }
            Ok(())
        });
    runtime().block_on(async {
        let store = Store::open(filesystem, Allow).await.unwrap();
        match mode.as_str() {
            "resident" => {
                let initial = store
                    .request(Operation::AppendDecision(decision("resident")))
                    .await
                    .unwrap();
                mark(&root, "resident-idle");
                wait_for(&root.join("hook-done"));
                assert_eq!(
                    store
                        .request(Operation::CompareRewriteSnapshot {
                            expected_generation: initial.snapshot.generation,
                            expected_integrity: initial.snapshot.integrity,
                            data: serde_json::json!({"stale":true}),
                        })
                        .await
                        .unwrap_err(),
                    Error::Conflict(STALE_SNAPSHOT.into())
                );
                let view = store
                    .request(Operation::AppendDecision(decision("resident-after")))
                    .await
                    .unwrap();
                assert_eq!(view.snapshot.generation, 3);
                assert_eq!(view.decisions.len(), 3);
            }
            "hook" => {
                store
                    .request(Operation::AppendDecision(decision("hook")))
                    .await
                    .unwrap();
                mark(&root, "hook-done");
            }
            "admit" => {
                store
                    .request(Operation::Transact(transaction("admitted")))
                    .await
                    .unwrap();
            }
            "recover" => {
                panic!("recovery barrier was not reached");
            }
            "retry" => {
                let view = store
                    .request(Operation::Transact(transaction("admitted")))
                    .await
                    .unwrap();
                assert_eq!(
                    view.decisions.iter().filter(|d| d.id == "admitted").count(),
                    1
                );
                mark(&root, "retry-done");
            }
            _ => panic!("unknown mode"),
        }
    });
}
#[test]
fn resident_and_hook_refresh_under_operation_ownership_and_refuse_stale_writes() {
    let root = tempfile::tempdir().unwrap();
    let mut resident = child(root.path(), "resident");
    wait_for(&root.path().join("resident-idle"));
    let mut hook = child(root.path(), "hook");
    hook.wait();
    resident.wait();
    runtime().block_on(async {
        let store = Store::open(Filesystem::new(root.path()).unwrap(), Allow)
            .await
            .unwrap();
        let view = store.request(Operation::ReadVerified).await.unwrap();
        assert_eq!(view.snapshot.generation, 3);
        assert_eq!(
            view.decisions
                .iter()
                .map(|d| d.id.as_str())
                .collect::<Vec<_>>(),
            ["resident", "hook", "resident-after"]
        );
    });
}
#[test]
fn killed_recovery_owner_releases_waiter_and_replays_exactly_once() {
    let root = tempfile::tempdir().unwrap();
    // Establish all three participants so recovery must resync the unchanged items.
    runtime().block_on(async {
        let store = Store::open(Filesystem::new(root.path()).unwrap(), Allow)
            .await
            .unwrap();
        store
            .request(Operation::AppendDecision(decision("initial")))
            .await
            .unwrap();
    });
    let mut admitting = child(root.path(), "admit");
    wait_for(&root.path().join("admit-held"));
    admitting.kill();
    let mut recovering = child(root.path(), "recover");
    wait_for(&root.path().join("recover-held"));
    let mut replacement = child(root.path(), "retry");
    std::thread::sleep(Duration::from_millis(100));
    assert!(replacement.0.try_wait().unwrap().is_none());
    assert!(!root.path().join("retry-done").exists());
    recovering.kill();
    replacement.wait();
    assert!(!root.path().join(INTENT).exists());
    let mut replay = child(root.path(), "retry");
    replay.wait();
    runtime().block_on(async {
        let store = Store::open(Filesystem::new(root.path()).unwrap(), Allow)
            .await
            .unwrap();
        let view = store.request(Operation::ReadVerified).await.unwrap();
        assert_eq!(view.snapshot.generation, 2);
        assert_eq!(view.decisions.len(), 2);
    });
}
#[test]
fn recovery_refuses_foreign_participant_bytes_before_replacement() {
    let root = tempfile::tempdir().unwrap();
    let mut admitting = child(root.path(), "admit");
    wait_for(&root.path().join("admit-held"));
    admitting.kill();
    std::fs::write(
        root.path().join("decisions.jsonl"),
        b"foreign participant\n",
    )
    .unwrap();
    let intent = std::fs::read(root.path().join(INTENT)).unwrap();
    runtime().block_on(async {
        let result = Store::open(Filesystem::new(root.path()).unwrap(), Allow).await;
        assert!(matches!(result, Err(Error::Conflict(message)) if message.contains("pending participant changed")));
    });
    assert_eq!(
        std::fs::read(root.path().join("decisions.jsonl")).unwrap(),
        b"foreign participant\n"
    );
    assert_eq!(std::fs::read(root.path().join(INTENT)).unwrap(), intent);
    assert!(!root.path().join("state.json").exists());
}
