use super::merge::{deep_merge, get, merge, set};
use super::*;
use serde_json::json;

#[test]
fn merge_matrix_preserves_null_absence_arrays_and_provenance() {
    let base = json!({"a":{"x":1,"y":2},"b":[1,2],"c":true});
    assert_eq!(
        deep_merge(&base, &json!({"a":{"x":null},"b":[],"c":false})),
        json!({"a":{"x":null,"y":2},"b":[],"c":false})
    );
    assert_eq!(deep_merge(&base, &json!({"a":null}))["a"], Value::Null);
    let global = json!({"roles":{"cad-executor":{"model":"one","effort":"high"}},
        "model":{"effort":{"cad-executor":"max"}}, "git":{"protected_branches":["main","stable"]}});
    let repo = json!({"roles":{"cad-executor":{"model":null}},"git":{"protected_branches":[]}});
    let merged = merge(Some(global.clone()), Some(repo.clone()), false);
    assert_eq!(merged.raw_global, Some(global));
    assert_eq!(merged.raw_repo, Some(repo));
    assert_eq!(
        get(&merged.values, "roles.cad-executor.model"),
        Some(&Value::Null)
    );
    assert_eq!(
        get(&merged.values, "roles.cad-executor.effort"),
        Some(&json!("high"))
    );
    assert_eq!(
        get(&merged.values, "model.effort.cad-executor"),
        Some(&json!("max"))
    );
    assert_eq!(
        get(&merged.values, "git.protected_branches"),
        Some(&json!([]))
    );
    assert_eq!(merged.sources["roles.cad-executor.model"], Layer::Repo);
    assert_eq!(merged.sources["model.effort.cad-executor"], Layer::Global);
    assert!(get(&merged.repo, "workflow.verifier").is_none());
    assert_eq!(get(&merged.values, "workflow.verifier"), Some(&json!(true)));
}

#[test]
fn global_only_settings_cannot_be_suppressed_by_repo_null_or_ancestors() {
    let global = json!({"workflow":{"test_command":"trusted","lint_command":"lint"},"review":{"key_file":"keys"}});
    for ancestor in [Value::Null, json!(false), json!([]), json!("blocked")] {
        let result = merge(
            Some(global.clone()),
            Some(json!({"workflow":ancestor,"review":ancestor})),
            false,
        );
        for key in GLOBAL_ONLY {
            assert_eq!(get(&result.values, key), get(&global, key));
        }
        assert_eq!(result.diagnostics.scope.is_empty(), ancestor.is_null());
    }
    let repo = json!({"workflow":{"test_command":null,"lint_command":"unsafe"},"review":{"key_file":null}});
    let result = merge(Some(global.clone()), Some(repo.clone()), false);
    for key in GLOBAL_ONLY {
        assert_eq!(get(&result.values, key), get(&global, key));
    }
    assert_eq!(result.diagnostics.scope.len(), 1);
    let explicit = merge(None, Some(repo), true);
    assert_eq!(
        get(&explicit.values, "workflow.lint_command"),
        Some(&json!("unsafe"))
    );
    assert_eq!(explicit.sources["workflow.lint_command"], Layer::Repo);
    assert!(explicit.global_intent);
}

#[test]
fn all_frozen_keys_have_exactly_one_disposition_and_retirements_have_no_defaults() {
    let output = std::process::Command::new("git")
        .args(["show", "v3.7.12:cadence-core/config.schema.json"])
        .stdin(std::process::Stdio::null())
        .output()
        .unwrap();
    assert!(output.status.success());
    let frozen: Value = serde_json::from_slice(&output.stdout).unwrap();
    let keys: std::collections::BTreeSet<_> = frozen["keys"]
        .as_object()
        .unwrap()
        .keys()
        .map(String::as_str)
        .collect();
    assert_eq!(keys, DISPOSITIONS.iter().map(|(k, _)| *k).collect());
    assert_eq!(DISPOSITIONS.len(), 94);
    assert_eq!(
        schema()
            .keys()
            .filter(|key| keys.contains(key.as_str()))
            .count(),
        94
    );
    assert_eq!(DISPOSITIONS.iter().filter(|(_, dead)| *dead).count(), 14);
    let mut all = json!({});
    for (key, dead) in DISPOSITIONS {
        assert_eq!(schema()[*key]["disposition"] == "dead", *dead);
        set(
            &mut all,
            key,
            if *dead {
                json!(false)
            } else {
                frozen["keys"][*key]["default"].clone()
            },
        );
    }
    let result = merge(Some(all.clone()), Some(all), false);
    assert_eq!(result.diagnostics.migration.len(), 28);
    for (key, dead) in DISPOSITIONS {
        if *dead {
            assert!(get(&result.values, key).is_none(), "{key}");
            assert!(schema()[*key].get("default").is_none());
            for layer in [Layer::Global, Layer::Repo] {
                assert!(
                    result
                        .diagnostics
                        .migration
                        .iter()
                        .any(|d| d.key == *key && d.layer == layer)
                );
            }
        }
    }
    for key in RETIRED {
        assert!(DISPOSITIONS.contains(&(key, true)));
    }
    for key in [
        "review.triggers.risk_surface.surfaces",
        "review.triggers.risk_surface.waive_routing_floor",
    ] {
        assert_eq!(get(&result.repo, key), Some(&Value::Null));
    }
}

#[test]
fn invalid_scope_and_migration_diagnostics_are_independent() {
    let result = merge(
        Some(json!(false)),
        Some(
            json!({"workflow":{"test_command":"bad"},"git":{"auto_close":false},"unrecognized":{"x":1}}),
        ),
        false,
    );
    assert_eq!(result.diagnostics.invalid_layer.len(), 1);
    assert_eq!(result.diagnostics.scope.len(), 1);
    assert_eq!(result.diagnostics.migration.len(), 2);
    assert!(get(&result.values, "unrecognized").is_none());
    assert_eq!(result.raw_repo.unwrap()["unrecognized"], json!({"x":1}));
    let slug = merge(
        Some(json!({"git":{"forge_repo":"owner/repo"}})),
        None,
        false,
    );
    assert_eq!(slug.sources["git.forge_repo"], Layer::Global);
    assert_eq!(slug.diagnostics.scope[0].key, "git.forge_repo");
}

#[test]
fn capture_threshold_reports_active_identities_without_refusing_append() {
    use cadence::store::model::{Disposition, Evidence, ItemRecord, Origin, VERSION};
    let mut records = Vec::new();
    for id in 0..5 {
        records.push(ItemRecord {
            version: VERSION,
            id: id.to_string(),
            revision: 1,
            origin: Origin {
                source: "capture".into(),
                original: Evidence::Missing,
            },
            text: "same text\nwith continuation".into(),
            kind: "todo".into(),
            completed: false,
            disposition: Disposition::Captured,
            filing_uncertain: false,
        });
    }
    let mut revision = records[0].clone();
    revision.revision = 2;
    records.push(revision);
    records[1].completed = true;
    records[2].disposition = Disposition::Filed {
        pointer: "GH-1".into(),
    };
    records[3].disposition = Disposition::Declined {
        reason: "no".into(),
    };
    let report = capture_report(&records, 1);
    assert_eq!(
        report,
        CaptureReport {
            active: 2,
            bound: 1,
            exceeded: true,
            unit: "items"
        }
    );
    assert_eq!(records.len(), 6);
}

// Independent frozen census expectation: exactly 94 leaves, not object containers.
const DISPOSITIONS: &[(&str, bool)] = &[
    ("granularity", false),
    ("model.escalate_on_failure", false),
    ("model.overrides.cad-planner", false),
    ("model.overrides.cad-assumptions-analyzer", false),
    ("model.overrides.cad-verifier", false),
    ("model.overrides.cad-reviewer", false),
    ("model.overrides.cad-executor", false),
    ("model.overrides.cad-plan-checker", false),
    ("model.effort.cad-planner", false),
    ("model.effort.cad-assumptions-analyzer", false),
    ("model.effort.cad-verifier", false),
    ("model.effort.cad-reviewer", false),
    ("model.effort.cad-executor", false),
    ("model.effort.cad-plan-checker", false),
    ("roles.cad-planner.model", false),
    ("roles.cad-assumptions-analyzer.model", false),
    ("roles.cad-verifier.model", false),
    ("roles.cad-reviewer.model", false),
    ("roles.cad-executor.model", false),
    ("roles.cad-plan-checker.model", false),
    ("roles.cad-planner.effort", false),
    ("roles.cad-assumptions-analyzer.effort", false),
    ("roles.cad-verifier.effort", false),
    ("roles.cad-reviewer.effort", false),
    ("roles.cad-executor.effort", false),
    ("roles.cad-plan-checker.effort", false),
    ("workflow.research", false),
    ("workflow.plan_check", false),
    ("workflow.verifier", false),
    ("workflow.skip_discuss", false),
    ("workflow.inline_plan_threshold", false),
    ("workflow.max_plan_tasks", false),
    ("workflow.max_plan_bytes", false),
    ("workflow.max_dispatch_tokens.cad-planner", true),
    (
        "workflow.max_dispatch_tokens.cad-assumptions-analyzer",
        true,
    ),
    ("workflow.max_dispatch_tokens.cad-verifier", true),
    ("workflow.max_dispatch_tokens.cad-reviewer", true),
    ("workflow.max_dispatch_tokens.cad-executor", true),
    ("workflow.max_dispatch_tokens.cad-plan-checker", true),
    ("workflow.test_command", false),
    ("workflow.lint_command", false),
    ("parallelization.enabled", true),
    ("parallelization.max_concurrent_agents", true),
    ("parallelization.min_plans_for_parallel", true),
    ("parallelization.use_worktrees", true),
    ("git.protected_branches", false),
    ("git.on_protected", false),
    ("git.integration_branch", false),
    ("git.auto_branch", false),
    ("git.base_branch", false),
    ("git.create_tag", false),
    ("git.on_land_cleanup", false),
    ("git.issue_check", false),
    ("git.forge_provider", false),
    ("git.forge_repo", false),
    ("git.forge_host", false),
    ("git.auto_close", true),
    ("planning.commit_docs", false),
    ("planning.max_capture_bullets", false),
    ("memory.backend", false),
    ("review.mode", false),
    ("review.reviewers", false),
    ("review.key_file", false),
    ("review.request_timeout_ms", false),
    ("review.max_prompt_tokens", false),
    ("review.providers.openai.tiers.flagship", false),
    ("review.providers.openai.tiers.balanced", false),
    ("review.providers.openai.tiers.cheap", false),
    ("review.providers.gemini.tiers.flagship", false),
    ("review.providers.gemini.tiers.balanced", false),
    ("review.providers.gemini.tiers.cheap", false),
    ("review.providers.deepseek.tiers.flagship", false),
    ("review.providers.deepseek.tiers.balanced", false),
    ("review.providers.deepseek.tiers.cheap", false),
    ("review.triggers.plan.gate", false),
    ("review.triggers.plan.tier", false),
    ("review.triggers.plan.effort", false),
    ("review.triggers.diff.gate", false),
    ("review.triggers.diff.tier", false),
    ("review.triggers.diff.effort", false),
    ("review.triggers.risk_surface.gate", false),
    ("review.triggers.risk_surface.tier", false),
    ("review.triggers.risk_surface.effort", false),
    ("review.triggers.risk_surface.surfaces", false),
    ("review.triggers.risk_surface.waive_routing_floor", false),
    ("review.triggers.phase_diff.gate", true),
    ("review.triggers.phase_diff.tier", true),
    ("review.triggers.phase_diff.effort", true),
    ("review.consult.enabled", false),
    ("review.consult.tier", false),
    ("review.consult.effort", false),
    ("review.consult.attempt_threshold", false),
    ("review.decision_review.tier", false),
    ("review.decision_review.effort", false),
];

fn config_paths(dir: &std::path::Path) -> reload::Paths {
    reload::Paths {
        global: Some(dir.join("global.json")),
        repo: dir.join("repo.json"),
    }
}
fn write_json(path: &std::path::Path, value: Value) {
    std::fs::write(path, serde_json::to_vec(&value).unwrap()).unwrap();
}
fn policy_value(g: &reload::Generation) -> bool {
    get(&g.effective.values, "workflow.verifier")
        .unwrap()
        .as_bool()
        .unwrap()
}
fn checked_policy(
    _: &cadence::store::MutationContext<'_>,
    g: &reload::Generation,
) -> cadence::store::Result<()> {
    if policy_value(g) {
        Ok(())
    } else {
        Err(cadence::store::Error::Policy(
            "test operation refused by current config".into(),
        ))
    }
}
fn store_bytes(dir: &std::path::Path) -> Vec<Option<Vec<u8>>> {
    ["items.jsonl", "decisions.jsonl", "state.json"]
        .iter()
        .map(|name| std::fs::read(dir.join(name)).ok())
        .collect()
}

#[test]
fn writer_rechecks_each_layer_and_recovers_from_admission_refusal() {
    use cadence::store::{
        filesystem::Filesystem,
        writer::{Operation, Store},
    };
    for global in [true, false] {
        let dir = tempfile::tempdir().unwrap();
        let paths = config_paths(dir.path());
        let target = if global {
            paths.global.as_ref().unwrap()
        } else {
            &paths.repo
        };
        write_json(target, json!({"workflow":{"verifier":true}}));
        let config = std::sync::Arc::new(std::sync::Mutex::new(reload::Reload::new(
            paths.clone(),
            reload::FileIo,
        )));
        let policy = reload::ConfigPolicy {
            config: config.clone(),
            evaluate: checked_policy,
        };
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let store = Store::open(Filesystem::new(dir.path()).unwrap(), policy)
                .await
                .unwrap();
            store
                .request(Operation::RewriteSnapshot(json!(1)))
                .await
                .unwrap();
            let before = store_bytes(dir.path());
            write_json(target, json!({"workflow":{"verifier":false}}));
            assert!(
                store
                    .request(Operation::RewriteSnapshot(json!(2)))
                    .await
                    .is_err()
            );
            assert_eq!(store_bytes(dir.path()), before);
            assert!(!policy_value(&config.lock().unwrap().refresh().unwrap()));
            write_json(target, json!({"workflow":{"verifier":true}}));
            assert_eq!(
                store
                    .request(Operation::RewriteSnapshot(json!(3)))
                    .await
                    .unwrap()
                    .snapshot
                    .data,
                json!(3)
            );
        });
    }
}

#[test]
fn reload_reads_bytes_despite_unchanged_size_time_and_rename() {
    use std::fs::{File, FileTimes};
    let dir = tempfile::tempdir().unwrap();
    let paths = config_paths(dir.path());
    std::fs::write(&paths.repo, b"{\"git\":{\"on_protected\":\"allow\"}}").unwrap();
    let mut reader = reload::Reload::new(paths.clone(), reload::FileIo);
    let old = reader.refresh().unwrap();
    let time = std::fs::metadata(&paths.repo).unwrap().modified().unwrap();
    std::fs::write(&paths.repo, b"{\"git\":{\"on_protected\":\"refuse\"}}").unwrap();
    // Equal-size change with the exact same mtime, not a coarse sleep-based test.
    std::fs::write(&paths.repo, b"{\"git\":{\"on_protected\":\"ask\"}}  ").unwrap();
    File::open(&paths.repo)
        .unwrap()
        .set_times(FileTimes::new().set_modified(time))
        .unwrap();
    let changed = reader.refresh().unwrap();
    assert_eq!(
        old.repo.bytes.as_ref().unwrap().len(),
        changed.repo.bytes.as_ref().unwrap().len()
    );
    assert!(changed.number > old.number);
    assert_eq!(
        get(&changed.effective.values, "git.on_protected"),
        Some(&json!("ask"))
    );
    let replacement = dir.path().join("checkout");
    std::fs::write(&replacement, changed.repo.bytes.as_ref().unwrap()).unwrap();
    std::fs::rename(replacement, &paths.repo).unwrap();
    let renamed = reader.refresh().unwrap();
    assert!(renamed.number > changed.number);
    assert_ne!(renamed.repo.stamp, changed.repo.stamp);
    std::fs::remove_file(&paths.repo).unwrap();
    let absent = reader.refresh().unwrap();
    assert!(absent.repo.bytes.is_none());
    assert!(absent.number > renamed.number);
}

#[test]
fn alias_identity_is_resolved_before_reads_and_rechecked_on_retarget() {
    use std::os::unix::fs::symlink;
    struct Count {
        reads: std::sync::Arc<std::sync::atomic::AtomicUsize>,
    }
    impl reload::ConfigIo for Count {
        fn read(&mut self, path: &std::path::Path) -> cadence::store::Result<reload::Input> {
            self.reads.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            reload::ConfigIo::read(&mut reload::FileIo, path)
        }
    }
    let dir = tempfile::tempdir().unwrap();
    let paths = config_paths(dir.path());
    write_json(
        &paths.repo,
        json!({"workflow":{"verifier":false,"test_command":"repo-command"}}),
    );
    symlink(&paths.repo, paths.global.as_ref().unwrap()).unwrap();
    let count = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let mut reader = reload::Reload::new(
        paths.clone(),
        Count {
            reads: count.clone(),
        },
    );
    let shared = reader.refresh().unwrap();
    assert!(shared.global.is_none());
    assert_eq!(count.load(std::sync::atomic::Ordering::SeqCst), 1);
    assert_eq!(shared.effective.sources["workflow.verifier"], Layer::Repo);
    assert_eq!(
        get(&shared.effective.values, "workflow.test_command"),
        Some(&Value::Null)
    );
    let other = dir.path().join("other.json");
    write_json(&other, json!({"workflow":{"test_command":"trusted"}}));
    std::fs::remove_file(paths.global.as_ref().unwrap()).unwrap();
    symlink(&other, paths.global.as_ref().unwrap()).unwrap();
    let separated = reader.refresh().unwrap();
    assert!(separated.global.is_some());
    assert_eq!(count.load(std::sync::atomic::Ordering::SeqCst), 3);
    assert_eq!(
        get(&separated.effective.values, "workflow.test_command"),
        Some(&json!("trusted"))
    );
    assert!(separated.number > shared.number);
    assert_eq!(
        reload::identity(&dir.path().join("missing.json")).unwrap(),
        dir.path().join("missing.json")
    );
}

#[test]
fn failed_io_invalidates_generation_and_never_uses_cached_permission() {
    struct Denied {
        deny: std::sync::Arc<std::sync::atomic::AtomicBool>,
    }
    impl reload::ConfigIo for Denied {
        fn read(&mut self, path: &std::path::Path) -> cadence::store::Result<reload::Input> {
            if self.deny.load(std::sync::atomic::Ordering::SeqCst) {
                return Err(std::io::Error::from(std::io::ErrorKind::PermissionDenied).into());
            }
            reload::ConfigIo::read(&mut reload::FileIo, path)
        }
    }
    use cadence::store::{
        filesystem::Filesystem,
        writer::{Operation, Store},
    };
    let dir = tempfile::tempdir().unwrap();
    let paths = config_paths(dir.path());
    write_json(&paths.repo, json!({"workflow":{"verifier":true}}));
    let deny = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let config = std::sync::Arc::new(std::sync::Mutex::new(reload::Reload::new(
        paths,
        Denied { deny: deny.clone() },
    )));
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let store = Store::open(
            Filesystem::new(dir.path()).unwrap(),
            reload::ConfigPolicy {
                config: config.clone(),
                evaluate: checked_policy,
            },
        )
        .await
        .unwrap();
        store
            .request(Operation::RewriteSnapshot(json!(1)))
            .await
            .unwrap();
        let first = config.lock().unwrap().refresh().unwrap().number;
        let before = store_bytes(dir.path());
        deny.store(true, std::sync::atomic::Ordering::SeqCst);
        assert!(
            store
                .request(Operation::RewriteSnapshot(json!(2)))
                .await
                .is_err()
        );
        assert!(config.lock().unwrap().refresh().is_err());
        assert_eq!(store_bytes(dir.path()), before);
        deny.store(false, std::sync::atomic::Ordering::SeqCst);
        store
            .request(Operation::RewriteSnapshot(json!(3)))
            .await
            .unwrap();
        assert!(config.lock().unwrap().refresh().unwrap().number > first);
    });
}

#[test]
fn final_validation_reevaluates_policy_after_admission() {
    use cadence::store::{
        filesystem::{Filesystem, Stage},
        writer::{Operation, Store},
    };
    let dir = tempfile::tempdir().unwrap();
    let paths = config_paths(dir.path());
    write_json(&paths.repo, json!({"workflow":{"verifier":true}}));
    let config = std::sync::Arc::new(std::sync::Mutex::new(reload::Reload::new(
        paths.clone(),
        reload::FileIo,
    )));
    let seen = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
    let observed = seen.clone();
    let policy = reload::ConfigPolicy {
        config,
        evaluate: move |ctx: &cadence::store::MutationContext<'_>, g: &reload::Generation| {
            observed.lock().unwrap().push(policy_value(g));
            checked_policy(ctx, g)
        },
    };
    let target = paths.repo.clone();
    let storage = Filesystem::new(dir.path())
        .unwrap()
        .with_probe(move |stage, path| {
            if stage == Stage::Prepared && path.file_name().unwrap() == "state.json" {
                write_json(&target, json!({"workflow":{"verifier":false}}));
            }
            Ok(())
        });
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let store = Store::open(storage, policy).await.unwrap();
        let before = store_bytes(dir.path());
        assert!(
            store
                .request(Operation::RewriteSnapshot(json!(1)))
                .await
                .is_err()
        );
        assert_eq!(store_bytes(dir.path()), before);
        assert_eq!(*seen.lock().unwrap(), vec![true, false]);
        assert!(!dir.path().join(".store-intent.json").exists());
    });
}

#[test]
fn malformed_nonobject_and_unreadable_layers_are_unavailable() {
    use std::os::unix::fs::PermissionsExt;
    let dir = tempfile::tempdir().unwrap();
    let paths = config_paths(dir.path());
    let mut reader = reload::Reload::new(paths.clone(), reload::FileIo);
    for bytes in [
        "{",
        "null",
        "false",
        "[]",
        "{\"git\":{\"on_protected\":\"nonsense\"}}",
        "{\"git\":null}",
    ] {
        std::fs::write(&paths.repo, bytes).unwrap();
        assert!(reader.refresh().is_err(), "{bytes}");
    }
    write_json(&paths.repo, json!({"workflow":{"verifier":true}}));
    reader.refresh().unwrap();
    std::fs::set_permissions(&paths.repo, std::fs::Permissions::from_mode(0o000)).unwrap();
    let actually_unreadable = std::fs::read(&paths.repo).is_err();
    if actually_unreadable {
        assert!(reader.refresh().is_err());
    } else {
        eprintln!(
            "privileged filesystem: mode bits do not establish unreadability; injected I/O boundary test supplies denial evidence"
        );
    }
    std::fs::set_permissions(&paths.repo, std::fs::Permissions::from_mode(0o600)).unwrap();
    assert!(reader.refresh().is_ok());
}

#[test]
fn config_updates_are_durable_visible_and_leave_legacy_bytes_unchanged() {
    use cadence::store::writer::{Operation, Store};
    let dir = tempfile::tempdir().unwrap();
    let global_dir = dir.path().join("global");
    std::fs::create_dir(&global_dir).unwrap();
    let legacy = reload::Paths {
        repo: dir.path().join("config.json"),
        global: Some(global_dir.join("config.json")),
    };
    write_json(&legacy.repo, json!({"planning":{"max_capture_bullets":40}}));
    let original = std::fs::read(&legacy.repo).unwrap();
    let active = write::active_paths(&legacy).unwrap();
    assert_eq!(active.repo, dir.path().join("config.v4.json"));
    write_json(
        &active.repo,
        json!({"planning":{"max_capture_bullets":40},"unknown_old":{"recover":"me"}}),
    );
    write_json(
        active.global.as_ref().unwrap(),
        json!({"git":{"forge_repo":"owner/repo"}}),
    );
    let config = std::sync::Arc::new(std::sync::Mutex::new(reload::Reload::new(
        active.clone(),
        reload::FileIo,
    )));
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let store = Store::open(
            write::register(dir.path(), &active).unwrap(),
            reload::ConfigPolicy {
                config: config.clone(),
                evaluate: checked_policy,
            },
        )
        .await
        .unwrap();
        let writer = write::ConfigWriter {
            root: dir.path().into(),
            active: active.clone(),
            store: store.clone(),
            config: config.clone(),
        };
        writer
            .set(Layer::Repo, "planning.max_capture_bullets", json!(2))
            .await
            .unwrap();
        let generation = config.lock().unwrap().refresh().unwrap();
        assert_eq!(
            get(&generation.effective.values, "planning.max_capture_bullets"),
            Some(&json!(2))
        );
        assert_eq!(
            generation.effective.sources["git.forge_repo"],
            Layer::Global
        );
        assert!(
            generation
                .effective
                .diagnostics
                .scope
                .iter()
                .any(|d| d.key == "git.forge_repo")
        );
        assert!(get(&generation.effective.values, "unknown_old").is_none());
        assert_eq!(
            generation.effective.raw_repo.as_ref().unwrap()["unknown_old"],
            json!({"recover":"me"})
        );
        let stored: Value = serde_json::from_slice(&std::fs::read(&active.repo).unwrap()).unwrap();
        assert_eq!(stored["planning"]["max_capture_bullets"], json!(2));
        assert!(stored.get("workflow").is_none());
        assert_eq!(std::fs::read(&legacy.repo).unwrap(), original);
        writer
            .set(Layer::Global, "workflow.test_command", json!("trusted"))
            .await
            .unwrap();
        assert_eq!(
            get(
                &config.lock().unwrap().refresh().unwrap().effective.values,
                "workflow.test_command"
            ),
            Some(&json!("trusted"))
        );
        // Repeated values after a change back are new writes, not import replays.
        writer
            .set(Layer::Repo, "planning.max_capture_bullets", json!(40))
            .await
            .unwrap();
        writer
            .set(Layer::Repo, "planning.max_capture_bullets", json!(2))
            .await
            .unwrap();
        assert_eq!(
            get(
                &config.lock().unwrap().refresh().unwrap().effective.values,
                "planning.max_capture_bullets"
            ),
            Some(&json!(2))
        );
        store
            .request(Operation::RewriteSnapshot(json!("next request")))
            .await
            .unwrap();
    });
}

#[test]
fn invalid_config_updates_cannot_change_policy_or_authorize_themselves() {
    use cadence::store::writer::Store;
    let dir = tempfile::tempdir().unwrap();
    let active = config_paths(dir.path());
    write_json(&active.repo, json!({"workflow":{"verifier":false}}));
    let config = std::sync::Arc::new(std::sync::Mutex::new(reload::Reload::new(
        active.clone(),
        reload::FileIo,
    )));
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let store = Store::open(
            write::register(dir.path(), &active).unwrap(),
            reload::ConfigPolicy {
                config: config.clone(),
                evaluate: checked_policy,
            },
        )
        .await
        .unwrap();
        let writer = write::ConfigWriter {
            root: dir.path().into(),
            active: active.clone(),
            store,
            config: config.clone(),
        };
        let generation = config.lock().unwrap().refresh().unwrap();
        let repo = std::fs::read(&active.repo).unwrap();
        for (layer, key, value) in [
            (Layer::Global, "git.forge_repo", json!("owner/repo")),
            (Layer::Repo, "workflow.test_command", json!("bad")),
            (Layer::Repo, "review.key_file", Value::Null),
            (Layer::Repo, "git.on_protected", json!("maybe")),
            (Layer::Repo, "git.auto_close", json!(true)),
            (Layer::Repo, "unknown_new", json!(1)),
            (Layer::Repo, "workflow.verifier", json!(true)),
        ] {
            assert!(writer.set(layer, key, value).await.is_err(), "{key}");
        }
        assert_eq!(config.lock().unwrap().refresh().unwrap(), generation);
        assert_eq!(std::fs::read(&active.repo).unwrap(), repo);
        assert!(!active.global.as_ref().unwrap().exists());
        assert_eq!(store_bytes(dir.path()), vec![None, None, None]);
    });
}

#[test]
fn aliased_config_updates_have_one_destination_and_keep_request_scope() {
    use cadence::store::writer::Store;
    use std::os::unix::fs::symlink;
    let dir = tempfile::tempdir().unwrap();
    let legacy = config_paths(dir.path());
    write_json(&legacy.repo, json!({}));
    symlink(&legacy.repo, legacy.global.as_ref().unwrap()).unwrap();
    let active = write::active_paths(&legacy).unwrap();
    assert_eq!(active.global.as_ref(), Some(&active.repo));
    let config = std::sync::Arc::new(std::sync::Mutex::new(reload::Reload::new(
        active.clone(),
        reload::FileIo,
    )));
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let store = Store::open(
            write::register(dir.path(), &active).unwrap(),
            reload::ConfigPolicy {
                config: config.clone(),
                evaluate: checked_policy,
            },
        )
        .await
        .unwrap();
        let writer = write::ConfigWriter {
            root: dir.path().into(),
            active: active.clone(),
            store,
            config: config.clone(),
        };
        assert!(
            writer
                .set(Layer::Global, "git.forge_repo", json!("owner/repo"))
                .await
                .is_err()
        );
        writer
            .set(Layer::Repo, "git.forge_repo", json!("owner/repo"))
            .await
            .unwrap();
        writer
            .set(
                Layer::Global,
                "workflow.test_command",
                json!("trusted intent"),
            )
            .await
            .unwrap();
        let current = config.lock().unwrap().refresh().unwrap();
        assert!(current.global.is_none());
        assert_eq!(current.effective.sources["git.forge_repo"], Layer::Repo);
        assert_eq!(
            get(&current.effective.values, "workflow.test_command"),
            Some(&Value::Null)
        );
        let addressed = merge(None, current.effective.raw_repo, true);
        assert_eq!(
            get(&addressed.values, "workflow.test_command"),
            Some(&json!("trusted intent"))
        );
        assert_eq!(std::fs::read(&legacy.repo).unwrap(), b"{}");
        assert_eq!(
            std::fs::read_dir(dir.path())
                .unwrap()
                .filter_map(Result::ok)
                .filter(|e| e.file_name() == "config.v4.json")
                .count(),
            1
        );
    });
}

#[test]
fn explicit_config_writes_validate_frozen_types_and_forge_grammars() {
    for (key, good, bad) in [
        (
            "git.forge_repo",
            json!("org/group/repo"),
            json!("org/../repo"),
        ),
        (
            "git.forge_host",
            json!("Example.com:65535"),
            json!("example.com:01"),
        ),
        ("planning.max_capture_bullets", json!(1), json!(0)),
        ("review.request_timeout_ms", json!(600000), json!(600001)),
        ("git.protected_branches", json!(["main"]), json!([1])),
        (
            "review.triggers.risk_surface.surfaces",
            json!([]),
            Value::Null,
        ),
    ] {
        assert!(
            write::validate_update(Layer::Repo, key, &good).is_ok(),
            "{key}"
        );
        assert!(
            write::validate_update(Layer::Repo, key, &bad).is_err(),
            "{key}"
        );
    }
    for bad in ["x", "-org/repo", "org/re po", "org/", "org/.."] {
        assert!(write::validate_update(Layer::Repo, "git.forge_repo", &json!(bad)).is_err());
    }
    for bad in [
        "-host",
        "host-",
        "host:0",
        "host:65536",
        "host:",
        "host:abc",
        "a..b",
    ] {
        assert!(write::validate_update(Layer::Repo, "git.forge_host", &json!(bad)).is_err());
    }
    assert!(
        write::validate_update(
            Layer::Repo,
            "git.forge_repo",
            &json!(format!("a/{}", "x".repeat(199)))
        )
        .is_err()
    );
    assert!(
        write::validate_update(Layer::Repo, "git.forge_host", &json!("a".repeat(254))).is_err()
    );
}

#[test]
fn native_guard_hard_fail_is_separate_from_the_frozen_key_census() {
    assert_eq!(schema().len(), 95);
    assert!(
        !DISPOSITIONS
            .iter()
            .any(|(key, _)| *key == "git.guard_hard_fail")
    );
    let spec = &schema()["git.guard_hard_fail"];
    assert_eq!(spec["default"], false);
    for value in [json!(false), json!(true)] {
        assert!(reload::valid_type(spec, &value, false));
    }
    for value in [
        Value::Null,
        json!(0),
        json!(1),
        json!("true"),
        json!([]),
        json!({}),
    ] {
        assert!(!reload::valid_type(spec, &value, false));
        assert!(
            reload::validate_effective(&merge(
                None,
                Some(json!({"git":{"guard_hard_fail":value}})),
                false
            ))
            .is_err()
        );
    }
    assert_eq!(
        get(&merge(None, None, false).values, "git.guard_hard_fail"),
        Some(&json!(false))
    );
}

#[test]
fn batch_preparation_preserves_unknown_values_and_distinguishes_absent_null() {
    use write::{Update, prepare_batch};
    let updates = [
        Update {
            key: "roles.cad-executor.model".into(),
            value: Value::Null,
        },
        Update {
            key: "roles.cad-executor.effort".into(),
            value: json!("xhigh"),
        },
    ];
    assert_eq!(
        prepare_batch(Layer::Repo, &json!({"unknown":{"saved":7}}), &updates).unwrap(),
        (
            json!({"unknown":{"saved":7},"roles":{"cad-executor":{"model":null,"effort":"xhigh"}}}),
            vec![
                "roles.cad-executor.effort".to_string(),
                "roles.cad-executor.model".to_string()
            ]
        )
    );
}

#[test]
fn batch_preparation_returns_literal_refusals_for_invalid_tail_and_duplicates() {
    use write::{Update, prepare_batch};
    for (key, value, reason) in [
        (
            "roles.cad-executor.effort",
            json!("impossible"),
            "invalid value for roles.cad-executor.effort",
        ),
        ("stakes", json!("high"), "unknown config key stakes"),
        (
            "git.auto_close",
            json!(true),
            "retired config key git.auto_close",
        ),
        (
            "workflow.test_command",
            json!("test"),
            "wrong config layer for workflow.test_command",
        ),
        (
            "roles.cad-executor.model",
            Value::Null,
            "duplicate config key roles.cad-executor.model",
        ),
    ] {
        let updates = [
            Update {
                key: "roles.cad-executor.model".into(),
                value: json!("sonnet"),
            },
            Update {
                key: key.into(),
                value,
            },
        ];
        assert_eq!(
            prepare_batch(Layer::Repo, &json!({}), &updates),
            Err(cadence::store::Error::Invalid(reason.into()))
        );
    }
}

#[test]
fn batch_preparation_empty_and_identical_stored_values_return_no_changes() {
    use write::{Update, prepare_batch};
    assert_eq!(
        prepare_batch(Layer::Repo, &json!({"a":1}), &[]).unwrap(),
        (json!({"a":1}), vec![])
    );
    assert_eq!(
        prepare_batch(
            Layer::Repo,
            &json!({"roles":{"cad-executor":{"model":null}}}),
            &[Update {
                key: "roles.cad-executor.model".into(),
                value: Value::Null
            }]
        )
        .unwrap(),
        (json!({"roles":{"cad-executor":{"model":null}}}), vec![])
    );
}

#[test]
fn batch_writer_persists_one_destination_with_literal_null_and_unknown_evidence() {
    use cadence::store::writer::Store;
    use write::Update;
    let dir = tempfile::tempdir().unwrap();
    let active = config_paths(dir.path());
    std::fs::write(&active.repo, br#"{"unknown":{"saved":7}}"#).unwrap();
    let config = std::sync::Arc::new(std::sync::Mutex::new(reload::Reload::new(
        active.clone(),
        reload::FileIo,
    )));
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let store = Store::open(
            write::register(dir.path(), &active).unwrap(),
            reload::ConfigPolicy {
                config: config.clone(),
                evaluate: super::planning_policy,
            },
        )
        .await
        .unwrap();
        let writer = write::ConfigWriter {
            root: dir.path().into(),
            active: active.clone(),
            store,
            config,
        };
        let written = writer
            .batch(
                Layer::Repo,
                &[
                    Update {
                        key: "roles.cad-executor.model".into(),
                        value: Value::Null,
                    },
                    Update {
                        key: "roles.cad-executor.effort".into(),
                        value: json!("xhigh"),
                    },
                ],
            )
            .await
            .unwrap();
        assert_eq!(
            written.changed_keys,
            ["roles.cad-executor.effort", "roles.cad-executor.model"]
        );
        assert_eq!(written.requested_layer, Layer::Repo);
        assert_eq!(written.destination, active.repo);
        assert_eq!(
            std::fs::read(&active.repo).unwrap(),
            br#"{
  "unknown": {
    "saved": 7
  },
  "roles": {
    "cad-executor": {
      "model": null,
      "effort": "xhigh"
    }
  }
}"#
        );
        assert!(!active.global.unwrap().exists());
    });
}

#[test]
fn batch_writer_refuses_stale_observation_without_installing_any_answer() {
    use cadence::store::{Error, writer::Store};
    #[derive(Clone)]
    struct Observed;
    impl reload::ConfigIo for Observed {
        fn read(&mut self, path: &std::path::Path) -> cadence::store::Result<reload::Input> {
            Ok(reload::Input {
                identity: path.into(),
                bytes: (path.file_name().unwrap() == "repo.json").then(|| b"{}".to_vec()),
                stamp: None,
            })
        }
    }
    let dir = tempfile::tempdir().unwrap();
    let active = config_paths(dir.path());
    let foreign = br#"{"roles":{"cad-executor":{"model":"opus"}}}"#;
    std::fs::write(&active.repo, foreign).unwrap();
    let config = std::sync::Arc::new(std::sync::Mutex::new(reload::Reload::new(
        active.clone(),
        Observed,
    )));
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let store = Store::open(write::register(dir.path(), &active).unwrap(), reload::ConfigPolicy { config: config.clone(), evaluate: super::planning_policy }).await.unwrap();
        let writer = write::ConfigWriter { root: dir.path().into(), active: active.clone(), store, config };
        let result = writer.batch(Layer::Repo, &[
            write::Update { key: "roles.cad-executor.model".into(), value: json!("sonnet") },
            write::Update { key: "roles.cad-executor.effort".into(), value: json!("xhigh") },
        ]).await;
        assert!(matches!(result, Err(Error::Conflict(reason)) if reason == "config changed while preparing update"));
        assert_eq!(std::fs::read(&active.repo).unwrap(), foreign);
        assert_eq!(store_bytes(dir.path()), vec![None, None, None]);
    });
}

#[test]
fn batch_writer_failed_intent_sync_preserves_all_config_bytes() {
    use cadence::store::{Error, filesystem::Stage, writer::Store};
    let dir = tempfile::tempdir().unwrap();
    let active = config_paths(dir.path());
    std::fs::write(&active.repo, b"{}").unwrap();
    let config = std::sync::Arc::new(std::sync::Mutex::new(reload::Reload::new(
        active.clone(),
        reload::FileIo,
    )));
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let storage = write::register(dir.path(), &active)
            .unwrap()
            .with_probe(|stage, path| {
                if stage == Stage::TemporarySync
                    && path.file_name().is_some_and(|name| {
                        name.to_string_lossy().starts_with("..store-intent.json.")
                    })
                {
                    Err(Error::Io("fixture intent sync".into()))
                } else {
                    Ok(())
                }
            });
        let store = Store::open(
            storage,
            reload::ConfigPolicy {
                config: config.clone(),
                evaluate: super::planning_policy,
            },
        )
        .await
        .unwrap();
        let writer = write::ConfigWriter {
            root: dir.path().into(),
            active: active.clone(),
            store,
            config,
        };
        let result = writer
            .batch(
                Layer::Repo,
                &[
                    write::Update {
                        key: "roles.cad-executor.model".into(),
                        value: json!("sonnet"),
                    },
                    write::Update {
                        key: "roles.cad-executor.effort".into(),
                        value: json!("xhigh"),
                    },
                ],
            )
            .await;
        assert!(matches!(result, Err(Error::Io(reason)) if reason == "fixture intent sync"));
        assert_eq!(std::fs::read(&active.repo).unwrap(), b"{}");
        assert_eq!(store_bytes(dir.path()), vec![None, None, None]);
    });
}
