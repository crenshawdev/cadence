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

fn hook(root: &Path, cwd: &Path, command: &str, id: &str) -> std::process::Output {
    hook_environment(root, cwd, command, id, &[])
}
fn hook_environment(
    root: &Path,
    cwd: &Path,
    command: &str,
    id: &str,
    environment: &[(&str, &Path)],
) -> std::process::Output {
    use std::io::Write;
    let mut process = Command::new(env!("CARGO_BIN_EXE_cadence"))
        .arg("guard")
        .env("CADENCE_GLOBAL_CONFIG", root.join("missing-global.json"))
        .envs(environment.iter().copied())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    let input = serde_json::json!({"tool_name":"Bash","hook_event_name":"PreToolUse","cwd":cwd,
        "session_id":"fixture","tool_use_id":id,"tool_input":{"command":command}});
    process
        .stdin
        .take()
        .unwrap()
        .write_all(&serde_json::to_vec(&input).unwrap())
        .unwrap();
    process.wait_with_output().unwrap()
}
fn stored(root: &Path) -> cadence::store::writer::View {
    runtime().block_on(async {
        let store = Store::open(Filesystem::new(root.join(".planning")).unwrap(), Allow)
            .await
            .unwrap();
        store.request(Operation::ReadVerified).await.unwrap()
    })
}
#[test]
fn binary_push_asks_only_after_a_confirmed_receipt_and_replays_host_identity() {
    let root = tempfile::tempdir().unwrap();
    std::fs::create_dir(root.path().join(".planning")).unwrap();
    let result = hook(root.path(), root.path(), "git push origin main", "push-1");
    assert!(result.status.success());
    // Independently confirm the store before accepting stdout as a hook result.
    let view = stored(root.path());
    let record = view
        .decisions
        .iter()
        .find(|r| r.origin.source == "bash-guard")
        .unwrap();
    let audit = audit::from_record(record).unwrap();
    assert_eq!(audit.outcome, Outcome::Ask);
    assert_eq!(
        audit.command_digest,
        cadence::store::model::digest(b"git push origin main")
    );
    let response: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(response["hookSpecificOutput"]["permissionDecision"], "ask");
    assert_eq!(
        response["hookSpecificOutput"]["permissionDecisionReason"],
        audit.reason
    );
    let replay = hook(root.path(), root.path(), "git push origin main", "push-1");
    assert_eq!(replay.stdout, result.stdout);
    assert_eq!(stored(root.path()), view);
}
#[test]
fn binary_project_discovery_walks_nested_cwd_and_stops_at_foreign_git_boundaries() {
    let root = tempfile::tempdir().unwrap();
    std::fs::create_dir(root.path().join(".planning")).unwrap();
    let nested = root.path().join("src/deep");
    std::fs::create_dir_all(&nested).unwrap();
    let result = hook(root.path(), &nested, "git push", "nested");
    assert!(result.status.success());
    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(&result.stdout).unwrap()["hookSpecificOutput"]
            ["permissionDecision"],
        "ask"
    );
    let before = stored(root.path());
    std::fs::write(root.path().join("src/.git"), b"gitdir: /unrelated").unwrap();
    let result = hook(root.path(), &nested, "git push", "foreign");
    assert!(result.status.success());
    assert!(result.stdout.is_empty());
    assert_eq!(stored(root.path()), before);
    let unrelated = tempfile::tempdir().unwrap();
    std::fs::create_dir(unrelated.path().join(".git")).unwrap();
    let result = hook(unrelated.path(), unrelated.path(), "git push", "outside");
    assert!(result.status.success());
    assert!(result.stdout.is_empty());
    assert!(!unrelated.path().join(".planning").exists());
}

fn git(root: &Path, args: &[&str]) -> Vec<u8> {
    let result = Command::new("git")
        .current_dir(root)
        .args(args)
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(
        result.status.success(),
        "git {args:?}: {}",
        String::from_utf8_lossy(&result.stderr)
    );
    result.stdout
}
fn native_fixture() -> tempfile::TempDir {
    let root = tempfile::tempdir().unwrap();
    git(root.path(), &["init", "-b", "main"]);
    std::fs::create_dir(root.path().join(".planning")).unwrap();
    let factory = import::SessionFactory::new(
        Some(root.path().join("missing-global.json")),
        std::sync::Arc::new(|_, _| Ok(())),
    );
    runtime()
        .block_on(factory.first_touch(&root.path().join(".planning")))
        .unwrap();
    root
}
#[test]
fn merged_compatibility_preserves_names_empty_lists_and_layer_provenance() {
    use config::merge::{get, merge};
    for (raw, expected) in [
        (serde_json::json!("release"), serde_json::json!(["release"])),
        (
            serde_json::json!(["release", " ", 2, null, " main "]),
            serde_json::json!(["release", " main "]),
        ),
        (serde_json::json!([]), serde_json::json!([])),
        (
            serde_json::json!(["", 2]),
            serde_json::json!(["main", "master"]),
        ),
        (
            serde_json::json!(" "),
            serde_json::json!(["main", "master"]),
        ),
        (
            serde_json::json!(false),
            serde_json::json!(["main", "master"]),
        ),
        (
            serde_json::Value::Null,
            serde_json::json!(["main", "master"]),
        ),
        (
            serde_json::json!({"branch":"release"}),
            serde_json::json!(["main", "master"]),
        ),
    ] {
        let global =
            serde_json::json!({"git":{"protected_branches":["global"],"on_protected":"refuse"}});
        let repo = serde_json::json!({"git":{"protected_branches":raw,"on_protected":"deny"}});
        let merged = merge(Some(global.clone()), Some(repo.clone()), false);
        assert_eq!(
            get(&merged.values, "git.protected_branches"),
            Some(&expected)
        );
        assert_eq!(
            get(&merged.values, "git.on_protected"),
            Some(&serde_json::json!("refuse"))
        );
        assert_eq!(merged.raw_repo, Some(repo.clone()));
        assert_eq!(merged.repo, repo);
        assert_eq!(merged.raw_global, Some(global));
        assert_eq!(
            merged.sources["git.protected_branches"],
            config::Layer::Repo
        );
        config::reload::validate_effective(&merged).unwrap();
    }
    let inherited = merge(
        Some(serde_json::json!({"git":{"protected_branches":"release","on_protected":"deny"}})),
        Some(serde_json::json!({})),
        false,
    );
    assert_eq!(
        inherited.sources["git.protected_branches"],
        config::Layer::Global
    );
    assert_eq!(
        get(&inherited.values, "git.protected_branches"),
        Some(&serde_json::json!(["release"]))
    );
}
#[test]
fn native_commit_policy_asks_denies_and_passes_using_shared_permission() {
    for (branches, policy, expected) in [
        (serde_json::json!(["main"]), "ask", Some("ask")),
        (serde_json::json!(["main"]), "refuse", Some("deny")),
        (serde_json::json!("main"), "deny", Some("deny")),
        (serde_json::json!(["main"]), "allow", None),
        (serde_json::json!(["release"]), "refuse", None),
        (serde_json::json!([]), "refuse", None),
        (serde_json::json!(["", 4]), "ask", Some("ask")),
    ] {
        let root = native_fixture();
        std::fs::write(
            root.path().join(".planning/config.v4.json"),
            serde_json::to_vec(
                &serde_json::json!({"git":{"protected_branches":branches,"on_protected":policy}}),
            )
            .unwrap(),
        )
        .unwrap();
        let before = stored(root.path());
        let result = hook(root.path(), root.path(), "git commit -m fixture", "commit");
        assert!(
            result.status.success(),
            "{}",
            String::from_utf8_lossy(&result.stderr)
        );
        if let Some(expected) = expected {
            assert_eq!(
                serde_json::from_slice::<serde_json::Value>(&result.stdout).unwrap()["hookSpecificOutput"]
                    ["permissionDecision"],
                expected
            );
            let view = stored(root.path());
            let audit = audit::from_record(view.decisions.last().unwrap()).unwrap();
            assert_eq!(audit.branch.as_deref(), Some("main"));
            assert!(audit.policy.unwrap().complete);
        } else {
            assert!(result.stdout.is_empty());
            assert_eq!(stored(root.path()), before);
        }
    }
}

#[test]
fn bounded_scanner_recognizes_top_level_separators_paths_and_seven_options() {
    let root = native_fixture();
    std::fs::write(
        root.path().join(".planning/config.v4.json"),
        br#"{"git":{"on_protected":"refuse"}}"#,
    )
    .unwrap();
    let mut cases = vec![
        ("/usr/bin/git push origin main".to_string(), "ask"),
        ("git commit -m x && git push".into(), "ask"),
        ("git push; git commit -m x".into(), "ask"),
    ];
    for separator in [";", "\n", "|", "||", "&&", "&"] {
        cases.push((format!("echo harmless{separator}git commit -m x"), "deny"));
        cases.push((format!("git status{separator}git push"), "ask"));
    }
    for option in [
        "-C",
        "-c",
        "--git-dir",
        "--work-tree",
        "--namespace",
        "--exec-path",
        "--config-env",
    ] {
        cases.push((format!("git {option} 'not a verb' commit -m x"), "deny"));
        cases.push((format!("git {option}=value --no-pager push"), "ask"));
    }
    cases.push((format!("{}git push", ";|&\n".repeat(10_000)), "ask"));
    for (i, (command, expected)) in cases.iter().enumerate() {
        let result = hook(root.path(), root.path(), command, &format!("grammar-{i}"));
        assert!(result.status.success());
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&result.stdout).unwrap()["hookSpecificOutput"]
                ["permissionDecision"],
            *expected,
            "{command}"
        );
    }
}
#[test]
fn bounded_scanner_never_rescans_quotes_escapes_wrappers_or_substitutions() {
    let root = native_fixture();
    let mut commands: Vec<String> = [
        "echo git push",
        "command -v git commit",
        "sudo git push",
        "env git push",
        "xargs git push",
        "$(git push)",
        "echo $(echo text; git push)",
        "echo `git push`",
        "git push $(echo target)",
        "echo \"unterminated; git push",
        "echo 'unterminated; git push",
        "git push; echo \\",
        "echo done # comment; git push",
        "cat <<EOF\ngit push\nEOF",
        "(git push)",
        "{ git push; }",
        "bash -c \"echo text; git commit -m x\"",
        "echo \"text; git push origin main\"",
        "git -C push",
    ]
    .into_iter()
    .map(str::to_owned)
    .collect();
    for separator in [";", "|", "||", "&&", "&", "\n"] {
        for quote in ['\'', '"'] {
            commands.push(format!(
                "echo {quote}text{separator} git push origin main{quote}"
            ));
            commands.push(format!(
                "bash -c {quote}echo text{separator} git commit -m x{quote}"
            ));
        }
    }
    commands.extend(
        [
            r"echo text\; git push",
            r"echo text\| git push",
            r"echo text\& git push",
        ]
        .map(str::to_owned),
    );
    let before = stored(root.path());
    for (i, command) in commands.iter().enumerate() {
        let result = hook(root.path(), root.path(), command, &format!("silent-{i}"));
        assert!(result.status.success());
        assert!(result.stdout.is_empty(), "false segment: {command}");
        assert_eq!(
            stored(root.path()),
            before,
            "silent input wrote audit: {command}"
        );
    }
    let result = hook(
        root.path(),
        root.path(),
        "echo 'text; git commit' && git push",
        "genuine-top-level",
    );
    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(&result.stdout).unwrap()["hookSpecificOutput"]
            ["permissionDecision"],
        "ask"
    );
}
#[test]
fn bounded_scanner_observes_hook_cwd_without_retargeting_or_simulating_checkout() {
    let root = native_fixture();
    let other = native_fixture();
    git(
        other.path(),
        &["symbolic-ref", "HEAD", "refs/heads/feature"],
    );
    std::fs::write(
        root.path().join(".planning/config.v4.json"),
        br#"{"git":{"on_protected":"refuse"}}"#,
    )
    .unwrap();
    for (i, command) in [
        format!("git -C {} commit -m x", other.path().display()),
        "git checkout feature && git commit -m x".into(),
    ]
    .iter()
    .enumerate()
    {
        let result = hook(root.path(), root.path(), command, &format!("cwd-{i}"));
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&result.stdout).unwrap()["hookSpecificOutput"]
                ["permissionDecision"],
            "deny"
        );
        let view = stored(root.path());
        assert_eq!(
            audit::from_record(view.decisions.last().unwrap())
                .unwrap()
                .branch
                .as_deref(),
            Some("main")
        );
    }
    assert_eq!(
        git(root.path(), &["symbolic-ref", "--short", "HEAD"]),
        b"main\n"
    );
    assert_eq!(
        git(other.path(), &["symbolic-ref", "--short", "HEAD"]),
        b"feature\n"
    );
}

fn permission_output(result: &std::process::Output) -> Option<String> {
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    if result.stdout.is_empty() {
        None
    } else {
        Some(serde_json::from_slice::<serde_json::Value>(&result.stdout).unwrap()["hookSpecificOutput"]["permissionDecision"].as_str().unwrap().into())
    }
}
fn latest_audit(root: &Path) -> Audit {
    audit::from_record(stored(root).decisions.last().unwrap()).unwrap()
}
fn native_policy(root: &Path, value: serde_json::Value) {
    std::fs::write(
        root.join(".planning/config.v4.json"),
        serde_json::to_vec(&value).unwrap(),
    )
    .unwrap();
}
#[test]
fn unavailable_git_and_unresolved_branch_are_distinct_durable_failure_passes() {
    for missing_git in [true, false] {
        let root = native_fixture();
        let empty_path = root.path().join("empty-bin");
        std::fs::create_dir(&empty_path).unwrap();
        if !missing_git {
            std::fs::write(
                root.path().join(".git/HEAD"),
                format!("{}\n", "0".repeat(40)),
            )
            .unwrap();
        }
        let env = if missing_git {
            vec![("PATH", empty_path.as_path())]
        } else {
            vec![]
        };
        let result = hook_environment(root.path(), root.path(), "git commit -m x", "failure", &env);
        assert_eq!(permission_output(&result), None);
        assert!(!result.stderr.is_empty());
        let audit = latest_audit(root.path());
        assert_eq!(audit.outcome, Outcome::FailurePass);
        assert!(
            audit
                .unavailable
                .iter()
                .any(|f| f.input == if missing_git { "Git" } else { "branch" })
        );
        assert!(audit.reason.contains("not policy approval"));
    }
}
#[test]
fn torn_layers_ask_even_after_custom_list_loss_and_simultaneous_git_failure() {
    for global in [true, false] {
        for missing_git in [true, false] {
            let root = native_fixture();
            git(root.path(), &["symbolic-ref", "HEAD", "refs/heads/release"]);
            let layer = if global {
                root.path().join("config.v4.json")
            } else {
                root.path().join(".planning/config.v4.json")
            };
            std::fs::write(&layer, br#"{"git":{"protected_branches":["release"]}}"#).unwrap();
            assert_eq!(
                permission_output(&hook(
                    root.path(),
                    root.path(),
                    "git commit -m x",
                    "healthy"
                )),
                Some("ask".into())
            );
            std::fs::write(&layer, b"{torn").unwrap();
            let empty = root.path().join("empty");
            std::fs::create_dir(&empty).unwrap();
            let env = if missing_git {
                vec![("PATH", empty.as_path())]
            } else {
                vec![]
            };
            let result =
                hook_environment(root.path(), root.path(), "git commit -m x", "torn", &env);
            assert_eq!(permission_output(&result), Some("ask".into()));
            let audit = latest_audit(root.path());
            assert!(
                audit
                    .reason
                    .contains("defaults rather than the user's settings")
            );
            assert!(audit.reason.contains(layer.to_str().unwrap()));
            assert!(
                audit
                    .unavailable
                    .iter()
                    .any(|f| f.input.starts_with(if global {
                        "global config"
                    } else {
                        "repo config"
                    }))
            );
            assert_eq!(
                audit.unavailable.iter().any(|f| f.input == "Git"),
                missing_git
            );
        }
    }
}
#[test]
fn torn_layer_retains_an_independently_established_refusal() {
    let root = native_fixture();
    std::fs::write(
        root.path().join("config.v4.json"),
        br#"{"git":{"on_protected":"refuse"}}"#,
    )
    .unwrap();
    std::fs::write(root.path().join(".planning/config.v4.json"), b"{torn").unwrap();
    let result = hook(root.path(), root.path(), "git commit -m x", "deny-torn");
    assert_eq!(permission_output(&result), Some("deny".into()));
    let audit = latest_audit(root.path());
    assert_eq!(audit.outcome, Outcome::Deny);
    assert!(
        audit
            .reason
            .contains("defaults rather than the user's settings")
    );
}
#[test]
fn confirmed_hard_fail_survives_own_layer_loss_restart_and_current_head_changes() {
    use std::os::unix::fs::PermissionsExt;
    for global in [true, false] {
        for damage in ["torn", "missing", "unreadable"] {
            let root = native_fixture();
            git(root.path(), &["symbolic-ref", "HEAD", "refs/heads/release"]);
            let layer = if global {
                root.path().join("config.v4.json")
            } else {
                root.path().join(".planning/config.v4.json")
            };
            std::fs::write(
                &layer,
                br#"{"git":{"protected_branches":["release"],"guard_hard_fail":true}}"#,
            )
            .unwrap();
            assert_eq!(
                permission_output(&hook(
                    root.path(),
                    root.path(),
                    "git commit -m x",
                    "confirmed"
                )),
                Some("ask".into())
            );
            let before = stored(root.path()).snapshot.data["guard_audit"]["denial_policy"].clone();
            match damage {
                "torn" => std::fs::write(&layer, b"{torn").unwrap(),
                "missing" => std::fs::remove_file(&layer).unwrap(),
                _ => std::fs::set_permissions(&layer, std::fs::Permissions::from_mode(0o000))
                    .unwrap(),
            }
            let empty = root.path().join("empty");
            std::fs::create_dir(&empty).unwrap();
            let result = hook_environment(
                root.path(),
                root.path(),
                "git commit -m x",
                "lost-opt-in",
                &[("PATH", &empty)],
            );
            assert_eq!(
                permission_output(&result),
                Some("deny".into()),
                "{global} {damage}: {}",
                String::from_utf8_lossy(&result.stderr)
            );
            assert_eq!(
                stored(root.path()).snapshot.data["guard_audit"]["denial_policy"],
                before
            );
            assert!(
                latest_audit(root.path())
                    .reason
                    .contains("defaults rather than the user's settings")
            );
            // A former protected observation cannot authorize denial after HEAD changes.
            git(root.path(), &["symbolic-ref", "HEAD", "refs/heads/feature"]);
            let changed = hook_environment(
                root.path(),
                root.path(),
                "git commit -m x",
                "changed-head",
                &[("PATH", &empty)],
            );
            assert_eq!(permission_output(&changed), Some("ask".into()));
        }
    }
}
#[test]
fn fresh_readable_hard_fail_and_opt_out_use_current_policy_only() {
    for name in ["main", "release"] {
        let root = native_fixture();
        git(
            root.path(),
            &["symbolic-ref", "HEAD", &format!("refs/heads/{name}")],
        );
        native_policy(
            root.path(),
            serde_json::json!({"git":{"guard_hard_fail":true,"protected_branches":[name]}}),
        );
        std::fs::write(root.path().join("config.v4.json"), b"{torn").unwrap();
        let empty = root.path().join("empty");
        std::fs::create_dir(&empty).unwrap();
        let result = hook_environment(
            root.path(),
            root.path(),
            "git commit -m x",
            "fresh",
            &[("PATH", &empty)],
        );
        assert_eq!(permission_output(&result), Some("deny".into()));
        std::fs::write(root.path().join("config.v4.json"), b"{}").unwrap();
        native_policy(
            root.path(),
            serde_json::json!({"git":{"guard_hard_fail":false,"on_protected":"allow"}}),
        );
        assert_eq!(
            permission_output(&hook(
                root.path(),
                root.path(),
                "git commit -m x",
                "opt-out"
            )),
            None
        );
        assert_eq!(
            permission_output(&hook_environment(
                root.path(),
                root.path(),
                "git commit -m x",
                "missing-after-opt-out",
                &[("PATH", &empty)]
            )),
            None
        );
    }
}
#[test]
fn audit_failure_is_loud_without_claiming_durability_and_keeps_hard_denial() {
    use std::os::unix::fs::PermissionsExt;
    for hard_fail in [true, false] {
        let root = native_fixture();
        native_policy(
            root.path(),
            serde_json::json!({"git":{"guard_hard_fail":hard_fail}}),
        );
        let log = root.path().join(".planning/decisions.jsonl");
        let before = std::fs::read(&log).unwrap();
        std::fs::set_permissions(&log, std::fs::Permissions::from_mode(0o000)).unwrap();
        let empty = root.path().join("empty");
        std::fs::create_dir(&empty).unwrap();
        let result = hook_environment(
            root.path(),
            root.path(),
            "git commit -m x",
            "audit-failed",
            &[("PATH", &empty)],
        );
        assert_eq!(permission_output(&result), hard_fail.then(|| "deny".into()));
        let stderr = String::from_utf8(result.stderr).unwrap();
        assert!(stderr.contains("Git"));
        assert!(stderr.contains("audit storage/confirmation unavailable"));
        assert!(stderr.contains("not confirmed durably"));
        std::fs::set_permissions(&log, std::fs::Permissions::from_mode(0o600)).unwrap();
        assert_eq!(std::fs::read(&log).unwrap(), before);
    }
}

#[path = "support/signing.rs"]
mod signing;
#[test]
fn hard_fail_reads_current_symbolic_head_through_real_worktree_gitdir() {
    let fixture = tempfile::tempdir().unwrap();
    let seed = fixture.path().join("seed");
    std::fs::create_dir(&seed).unwrap();
    git(&seed, &["init", "-b", "main"]);
    let key = signing::generate(&seed);
    let result = Command::new("git")
        .current_dir(&seed)
        .env("GNUPGHOME", signing::home(&seed))
        .args([
            "-c",
            "user.name=John Crenshaw",
            "-c",
            "user.email=john@jcrenshaw.dev",
            "-c",
            &format!("user.signingkey={key}"),
            "commit",
            "-S",
            "--allow-empty",
            "-m",
            "fixture base",
        ])
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    let root = fixture.path().join("worktree");
    git(
        &seed,
        &[
            "worktree",
            "add",
            "-b",
            "release",
            root.to_str().unwrap(),
            "HEAD",
        ],
    );
    assert!(root.join(".git").is_file());
    std::fs::create_dir(root.join(".planning")).unwrap();
    std::fs::write(
        root.join(".planning/config.json"),
        br#"{"git":{"guard_hard_fail":true,"protected_branches":["release"]}}"#,
    )
    .unwrap();
    let empty = fixture.path().join("empty");
    std::fs::create_dir(&empty).unwrap();
    let result = hook_environment(
        &root,
        &root,
        "git commit -m x",
        "worktree",
        &[("PATH", &empty)],
    );
    assert_eq!(permission_output(&result), Some("deny".into()));
    assert_eq!(latest_audit(&root).branch.as_deref(), Some("release"));
    let gitdir = git(&root, &["rev-parse", "--absolute-git-dir"]);
    let gitdir = Path::new(std::str::from_utf8(&gitdir).unwrap().trim());
    std::fs::write(gitdir.join("HEAD"), format!("{}\n", "0".repeat(40))).unwrap();
    let unknown = hook_environment(
        &root,
        &root,
        "git commit -m x",
        "worktree-detached",
        &[("PATH", &empty)],
    );
    assert_eq!(permission_output(&unknown), None);
    assert_eq!(latest_audit(&root).outcome, Outcome::FailurePass);
}
