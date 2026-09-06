//! Real-process tests of the production store. Barriers live only in this driver.
use cadence::store::filesystem::{Filesystem, Stage};
use cadence::store::model::{
    Decision, DecisionRecord, Disposition, Evidence, ItemRecord, Origin, VERSION,
};
use cadence::store::transaction::Transaction;
use cadence::store::writer::{Operation, Store};
use cadence::store::{Error, MutationContext, Policy, Result};
use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::Duration;

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
fn operation(id: &str) -> Transaction {
    let origin = Origin {
        source: "process-test".into(),
        original: Evidence::Missing,
    };
    Transaction {
        id: id.into(),
        items: vec![ItemRecord {
            version: VERSION,
            id: id.into(),
            revision: 1,
            origin: origin.clone(),
            text: format!("{id} complete content"),
            kind: "todo".into(),
            disposition: Disposition::Captured,
            completed: false,
            filing_uncertain: false,
        }],
        decisions: vec![DecisionRecord {
            version: VERSION,
            id: id.into(),
            revision: 1,
            origin,
            decision: Decision::Gate {
                outcome: id.into(),
                evidence: Evidence::Null,
            },
        }],
        snapshot: Some(serde_json::json!({"value":id})),
        external: vec![],
    }
}
fn apply(root: &Path, id: &str) {
    runtime().block_on(async {
        let store = Store::open(Filesystem::new(root).unwrap(), Allow)
            .await
            .unwrap();
        store
            .request(Operation::Transact(operation(id)))
            .await
            .unwrap();
    });
}
const TARGETS: [&str; 3] = ["items.jsonl", "decisions.jsonl", "state.json"];
fn values(root: &Path) -> Vec<Option<Vec<u8>>> {
    TARGETS
        .iter()
        .map(|target| std::fs::read(root.join(target)).ok())
        .collect()
}
fn assert_complete(root: &Path, old: &[Option<Vec<u8>>], new: &[Option<Vec<u8>>]) {
    for ((target, actual), (old, new)) in TARGETS.iter().zip(values(root)).zip(old.iter().zip(new))
    {
        assert!(actual == *old || actual == *new, "torn target {target}");
    }
}
fn barrier(stage: Stage, path: &Path, wanted_stage: &str, target: &str) {
    if format!("{stage:?}") == wanted_stage && path.file_name().unwrap() == target {
        println!("CADENCE_BARRIER");
        std::io::stdout().flush().unwrap();
        loop {
            std::thread::park();
        }
    }
}

#[test]
fn crash_child() {
    let Ok(root) = std::env::var("CADENCE_CRASH_ROOT") else {
        return;
    };
    let stage = std::env::var("CADENCE_CRASH_STAGE").unwrap();
    let target = std::env::var("CADENCE_CRASH_TARGET").unwrap();
    let fs = Filesystem::new(root).unwrap().with_probe(move |at, path| {
        barrier(at, path, &stage, &target);
        Ok(())
    });
    runtime().block_on(async {
        let store = Store::open(fs, Allow).await.unwrap();
        if std::env::var("CADENCE_CRASH_MODE").unwrap() == "write" {
            store
                .request(Operation::Transact(operation("new")))
                .await
                .unwrap();
        } else {
            store.request(Operation::Read).await.unwrap();
        }
        println!("CADENCE_SUCCESS");
    });
}

fn kill_at(root: &Path, stage: &str, target: &str, mode: &str) {
    let mut child = Command::new(std::env::current_exe().unwrap())
        .args(["--exact", "crash_child", "--nocapture"])
        .env("CADENCE_CRASH_ROOT", root)
        .env("CADENCE_CRASH_STAGE", stage)
        .env("CADENCE_CRASH_TARGET", target)
        .env("CADENCE_CRASH_MODE", mode)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .unwrap();
    let stdout = child.stdout.take().unwrap();
    let (sender, receiver) = std::sync::mpsc::channel();
    let reader = std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            let line = line.unwrap();
            if line.contains("CADENCE_BARRIER") {
                let _ = sender.send(());
                return;
            }
        }
    });
    let reached = receiver.recv_timeout(Duration::from_secs(10));
    child.kill().unwrap();
    let status = child.wait().unwrap();
    reader.join().unwrap();
    assert!(reached.is_ok(), "barrier not reached: {stage} {target}");
    assert!(!status.success());
    #[cfg(unix)]
    {
        use std::os::unix::process::ExitStatusExt;
        assert_eq!(status.signal(), Some(libc::SIGKILL));
    }
}

#[test]
fn process_kill_replacements_leave_complete_old_or_new_bytes() {
    for initially_absent in [true, false] {
        let reference = tempfile::tempdir().unwrap();
        if !initially_absent {
            apply(reference.path(), "old");
        }
        let old = values(reference.path());
        apply(reference.path(), "new");
        let new = values(reference.path());
        for target in TARGETS {
            for stage in ["Writing", "TemporarySynced", "Renamed", "DirectorySynced"] {
                let root = tempfile::tempdir().unwrap();
                if !initially_absent {
                    apply(root.path(), "old");
                }
                kill_at(root.path(), stage, target, "write");
                assert_complete(root.path(), &old, &new);
                // Retry after recovery is also the first operation after a kill
                // during preparation, when no intent had yet been installed.
                apply(root.path(), "new");
                assert_eq!(values(root.path()), new);
                apply(root.path(), "new");
                assert_eq!(values(root.path()), new);
            }
        }
    }
}

#[test]
fn process_kill_during_replay_preserves_complete_targets_and_retry_identity() {
    let reference = tempfile::tempdir().unwrap();
    apply(reference.path(), "old");
    let old = values(reference.path());
    apply(reference.path(), "new");
    let new = values(reference.path());
    for (stage, target) in [
        ("RecoverySync", "items.jsonl"),
        ("Writing", "decisions.jsonl"),
        ("Renamed", "state.json"),
    ] {
        let root = tempfile::tempdir().unwrap();
        apply(root.path(), "old");
        runtime().block_on(async {
            let fs = Filesystem::new(root.path())
                .unwrap()
                .with_probe(|at, path| {
                    if at == Stage::Confirmation && path.file_name().unwrap() == "items.jsonl" {
                        Err(Error::Io("interrupted".into()))
                    } else {
                        Ok(())
                    }
                });
            let store = Store::open(fs, Allow).await.unwrap();
            assert!(
                store
                    .request(Operation::Transact(operation("new")))
                    .await
                    .is_err()
            );
        });
        kill_at(root.path(), stage, target, "read");
        assert_complete(root.path(), &old, &new);
        apply(root.path(), "new");
        assert_eq!(values(root.path()), new);
    }
}

#[test]
fn acknowledged_operations_survive_normal_process_restart() {
    let root = tempfile::tempdir().unwrap();
    for mode in ["write", "read"] {
        let output = Command::new(std::env::current_exe().unwrap())
            .args(["--exact", "crash_child", "--nocapture"])
            .env("CADENCE_CRASH_ROOT", root.path())
            .env("CADENCE_CRASH_STAGE", "disabled")
            .env("CADENCE_CRASH_TARGET", "state.json")
            .env("CADENCE_CRASH_MODE", mode)
            .stdin(Stdio::null())
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert!(String::from_utf8_lossy(&output.stdout).contains("CADENCE_SUCCESS"));
    }
    runtime().block_on(async {
        let store = Store::open(Filesystem::new(root.path()).unwrap(), Allow)
            .await
            .unwrap();
        let view = store.request(Operation::Read).await.unwrap();
        assert_eq!(view.items.len(), 1);
        assert_eq!(view.decisions.len(), 1);
        assert_eq!(view.items[0].id, "new");
    });
}
