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

// Include binary-owned import/config modules to exercise the production factory.
#[allow(dead_code)]
#[path = "../src/config/mod.rs"]
mod config;
#[allow(dead_code)]
#[path = "../src/import/mod.rs"]
mod import;
use cadence::store::writer::audit::{self, Audit, Outcome, Unavailable, Verb};
fn audit_event(root: &Path, id: &str) -> Audit {
    Audit {
        event_id: id.into(),
        command_digest: cadence::store::model::digest(b"fixture command"),
        cwd: root.into(),
        project: root.into(),
        verb: Verb::Push,
        branch: None,
        policy: None,
        outcome: Outcome::Ask,
        unavailable: vec![],
        reason: "push requires permission".into(),
    }
}
#[derive(Clone)]
struct FaultConfig {
    unreadable: std::sync::Arc<std::sync::Mutex<Option<std::path::PathBuf>>>,
}
impl config::reload::ConfigIo for FaultConfig {
    fn read(&mut self, path: &Path) -> Result<config::reload::Input> {
        if self.unreadable.lock().unwrap().as_deref() == Some(path) {
            return Err(Error::Io(format!("unreadable config {}", path.display())));
        }
        config::reload::ConfigIo::read(&mut config::reload::FileIo, path)
    }
}
#[test]
fn audit_survives_healthy_torn_and_unreadable_layers_and_later_import() {
    for cold in [true, false] {
        for global in [true, false] {
            for unreadable in [true, false] {
                let fixture = tempfile::tempdir().unwrap();
                let root = fixture.path().join("project");
                let global_root = fixture.path().join("global");
                std::fs::create_dir_all(&root).unwrap();
                std::fs::create_dir_all(&global_root).unwrap();
                let global_path = global_root.join("config.json");
                std::fs::write(&global_path, b"{}").unwrap();
                std::fs::write(root.join("config.json"), b"{}").unwrap();
                std::fs::write(
                    root.join("CAPTURE.md"),
                    b"# Capture\n\n## Todos\n- [ ] preserved legacy capture\n",
                )
                .unwrap();
                let io = FaultConfig {
                    unreadable: Default::default(),
                };
                let factory = import::SessionFactory::with_io(
                    Some(global_path.clone()),
                    io.clone(),
                    std::sync::Arc::new(|_, _| Ok(())),
                );
                runtime().block_on(async {
                    if !cold {
                        factory.first_touch(&root).await.unwrap();
                    }
                    let path = if global { &global_root } else { &root }.join(if cold {
                        "config.json"
                    } else {
                        "config.v4.json"
                    });
                    if unreadable {
                        *io.unreadable.lock().unwrap() = Some(path.clone());
                    } else {
                        std::fs::write(&path, b"{torn").unwrap();
                    }
                    let mut event = audit_event(&root, "first-event");
                    event.unavailable.push(Unavailable {
                        input: path.display().to_string(),
                        reason: "unavailable layer".into(),
                    });
                    let view = factory.guard_audit(&root, event.clone()).await.unwrap();
                    assert_eq!(
                        view.decisions
                            .iter()
                            .filter(|d| d.id == event.id().unwrap())
                            .count(),
                        1
                    );
                    assert_eq!(audit::audit_only(&view.snapshot), cold);
                    assert!(!root.join("phases/7/SUMMARY.md").exists());
                    let replay = factory.guard_audit(&root, event.clone()).await.unwrap();
                    assert_eq!(view, replay);
                    if cold {
                        assert!(!root.join("config.v4.json").exists());
                    }
                    *io.unreadable.lock().unwrap() = None;
                    std::fs::write(&path, b"{}").unwrap();
                    // Reopen the factory to prove the initialization marker survives exit.
                    let reopened = import::SessionFactory::with_io(
                        Some(global_path),
                        io,
                        std::sync::Arc::new(|_, _| Ok(())),
                    );
                    let session = reopened.first_touch(&root).await.unwrap();
                    let imported = session.derivation_view().await.unwrap();
                    assert_eq!(imported.snapshot.data["import"]["complete"], true);
                    assert_eq!(imported.items.len(), 1);
                    assert!(imported.decisions.contains(&event.record().unwrap()));
                    let second = reopened
                        .guard_audit(&root, audit_event(&root, "second-event"))
                        .await
                        .unwrap();
                    assert_eq!(
                        second
                            .decisions
                            .iter()
                            .filter(|d| d.origin.source == "bash-guard")
                            .count(),
                        2
                    );
                });
            }
        }
    }
}
#[test]
fn audit_confirmation_failure_never_acknowledges_and_recovery_replays_receipt() {
    for (stage, target) in [
        (Stage::Renamed, INTENT),
        (Stage::Renamed, "decisions.jsonl"),
        (Stage::Confirmation, "state.json"),
    ] {
        let root = tempfile::tempdir().unwrap();
        let filesystem = Filesystem::new(root.path())
            .unwrap()
            .with_probe(move |at, path| {
                if at == stage && path.file_name().is_some_and(|name| name == target) {
                    return Err(Error::Io("injected audit persistence failure".into()));
                }
                Ok(())
            });
        runtime().block_on(async {
            let store = Store::open(filesystem, Allow).await.unwrap();
            let event = audit_event(root.path(), "same-event");
            assert!(
                store
                    .request(Operation::GuardAudit(event.clone()))
                    .await
                    .is_err()
            );
            let reopened = Store::open(Filesystem::new(root.path()).unwrap(), Allow)
                .await
                .unwrap();
            let view = reopened
                .request(Operation::GuardAudit(event.clone()))
                .await
                .unwrap();
            assert_eq!(view.snapshot.generation, 1);
            assert_eq!(view.decisions, vec![event.record().unwrap()]);
            let mut recomputed = event.clone();
            recomputed.reason = "policy changed after event".into();
            assert_eq!(
                reopened
                    .request(Operation::GuardAudit(recomputed))
                    .await
                    .unwrap(),
                view
            );
            let mut collision = event;
            collision.command_digest = cadence::store::model::digest(b"another command");
            assert!(
                reopened
                    .request(Operation::GuardAudit(collision))
                    .await
                    .is_err()
            );
        });
    }
}
fn rewrite_intent(root: &Path, mutate: impl FnOnce(&mut serde_json::Value)) {
    let path = root.join(INTENT);
    let mut value: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
    mutate(&mut value);
    value["integrity"] = serde_json::json!(cadence::store::model::digest(
        &serde_json::to_vec(&(&value["version"], &value["kind"], &value["participants"])).unwrap()
    ));
    std::fs::write(path, serde_json::to_vec(&value).unwrap()).unwrap();
}
#[test]
fn audit_payload_and_recovery_cannot_smuggle_unrelated_mutations() {
    for field in ["execution", "config", "snapshot", "external"] {
        let root = tempfile::tempdir().unwrap();
        let mut value = serde_json::to_value(audit_event(root.path(), "malicious")).unwrap();
        value[field] = serde_json::json!({"allow":true});
        assert!(serde_json::from_value::<Audit>(value).is_err());
    }
    for field in [
        "execution",
        "lifecycle",
        "import",
        "phase-summary:7",
        "repo-config",
        "global-config",
    ] {
        let root = tempfile::tempdir().unwrap();
        runtime().block_on(async {
            let filesystem = Filesystem::new(root.path())
                .unwrap()
                .with_probe(|stage, path| {
                    if stage == Stage::Renamed && path.file_name().is_some_and(|n| n == INTENT) {
                        return Err(Error::Io("hold admitted audit".into()));
                    }
                    Ok(())
                });
            let store = Store::open(filesystem, Allow).await.unwrap();
            assert!(
                store
                    .request(Operation::GuardAudit(audit_event(root.path(), "malicious")))
                    .await
                    .is_err()
            );
            rewrite_intent(root.path(), |value| {
                if field.contains('-') || field.contains(':') {
                    value["participants"][0]["target"] = serde_json::json!(field);
                } else {
                    let participants = value["participants"].as_array_mut().unwrap();
                    let state = participants
                        .iter_mut()
                        .find(|p| p["target"] == "state.json")
                        .unwrap();
                    let bytes: Vec<u8> = serde_json::from_value(state["bytes"].clone()).unwrap();
                    let mut snapshot: cadence::store::model::Snapshot =
                        serde_json::from_slice(&bytes).unwrap();
                    snapshot.data[field] = serde_json::json!({"authorized":true});
                    let new = cadence::store::model::Snapshot::new(
                        snapshot.generation,
                        b"",
                        &cadence::store::model::render_lines(&[audit_event(
                            root.path(),
                            "malicious",
                        )
                        .record()
                        .unwrap()])
                        .unwrap(),
                        snapshot.data,
                    )
                    .unwrap();
                    state["bytes"] = serde_json::to_value(new.render().unwrap()).unwrap();
                }
            });
            assert!(
                Store::open(Filesystem::new(root.path()).unwrap(), Allow)
                    .await
                    .is_err()
            );
            assert!(!root.path().join("state.json").exists());
            assert!(!root.path().join("decisions.jsonl").exists());
        });
    }
}
#[test]
fn legacy_invocations_do_not_coalesce_by_command_digest() {
    assert_ne!(
        audit::event_identity(Some("session"), None),
        audit::event_identity(Some("session"), None)
    );
    assert_eq!(
        audit::event_identity(Some("session"), Some("tool-1")),
        audit::event_identity(Some("session"), Some("tool-1"))
    );
    assert_ne!(
        audit::event_identity(Some("session"), Some("tool-1")),
        audit::event_identity(Some("session"), Some("tool-2"))
    );
}
