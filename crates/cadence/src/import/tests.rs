use super::*;
use cadence::store::{
    MutationContext, Policy, Result,
    filesystem::Filesystem,
    model::{Disposition, Evidence},
    transaction::Transaction,
    writer::{Operation, Store},
};
use serde_json::json;

fn source(path: &str, text: &str) -> Source {
    Source {
        path: path.into(),
        bytes: text.as_bytes().to_vec(),
    }
}
struct Allow;
impl Policy for Allow {
    fn validate(&mut self, _: &MutationContext<'_>) -> Result<()> {
        Ok(())
    }
}
fn frozen(path: &str) -> Vec<u8> {
    let out = std::process::Command::new("git")
        .current_dir(repository_root())
        .args(["show", &format!("v3.7.12:{path}")])
        .stdin(std::process::Stdio::null())
        .output()
        .unwrap();
    assert!(
        out.status.success(),
        "{}",
        String::from_utf8_lossy(&out.stderr)
    );
    out.stdout
}

#[test]
fn capture_import_preserves_independent_identities_and_all_source_bytes() {
    let capture = source(
        "CAPTURE.md",
        "# Capture\n\n## Todos\n- [ ] (phase 03.1) same\n  continuation with unknown meaning\n  ````rust\n- [ ] not an item\n  ```\n## Notes\n  ````\n- [ ] same\n- [x] complete\n## Seeds\n- seed\n## Notes\n- 2026-01-01 note\n## Unknown\n- evidence only\n",
    );
    let result = items::translate(Some(&capture), None, None).unwrap();
    assert_eq!(result.records.len(), 5);
    assert_eq!(
        result
            .records
            .iter()
            .map(|r| r.kind.as_str())
            .collect::<Vec<_>>(),
        ["todo", "todo", "todo", "seed", "note"]
    );
    assert_eq!(result.records[0].text, "same");
    assert_eq!(result.records[1].text, "same");
    assert_ne!(result.records[0].id, result.records[1].id);
    assert!(result.records[2].completed);
    assert_eq!(result.evidence[0].source, capture);
    assert_eq!(result.evidence[0].label, "non_effective_original_source");
    let Evidence::Text(provenance) = &result.records[0].origin.original else {
        panic!("missing provenance")
    };
    let provenance: serde_json::Value = serde_json::from_str(provenance).unwrap();
    assert_eq!(provenance[0]["phase_spelling"], json!("03.1"));
    assert!(
        result
            .records
            .iter()
            .all(|r| !r.text.contains("continuation")
                && !r.text.contains("not an item")
                && !r.text.contains("evidence only"))
    );
    assert_eq!(
        result,
        items::translate(Some(&capture), None, None).unwrap()
    );
    assert!(
        items::translate(None, None, None)
            .unwrap()
            .records
            .is_empty()
    );
}

#[test]
fn cross_ledger_decline_wins_preserves_uncertainty_and_replay_does_not_append() {
    let filed = source(
        "FILED.md",
        "- 2026-01-01 github org/repo abc: shared finding\n- 2026-01-02 github org/repo def unconfirmed: uncertain finding\n",
    );
    let declined = source(
        "DECLINED.md",
        "## Fingerprints\n- 2026-01-03 github org/repo abc: rejected shared finding\n## Decisions\n### Human decline\nDeclined because the tradeoff is wrong.\n## Nested reasoning\nKeep all of this.\n```md\n### not a separate decision\n```\n",
    );
    let translated = items::translate(None, Some(&filed), Some(&declined)).unwrap();
    assert_eq!(translated.records.len(), 4);
    assert!(translated.records[1].filing_uncertain); // frozen planning-files.mjs:1366-1367
    assert!(!translated.records[0].filing_uncertain);
    assert_eq!(translated.records[0].id, translated.records[2].id);
    assert!(matches!(
        translated.records[2].disposition,
        Disposition::Declined { .. }
    ));
    assert!(
        translated
            .warnings
            .iter()
            .any(|w| w.contains("FILED/DECLINED conflict"))
    );
    let Disposition::Declined { reason } = &translated.records[3].disposition else {
        panic!("prose not declined")
    };
    assert!(reason.contains("Nested reasoning") && reason.contains("tradeoff"));
    assert_eq!(
        translated
            .evidence
            .iter()
            .map(|e| e.source.clone())
            .collect::<Vec<_>>(),
        [filed, declined]
    );
    let transaction = Transaction {
        id: "same-source-generation".into(),
        items: translated.records.clone(),
        decisions: vec![],
        snapshot: Some(json!({"source_evidence":translated.evidence})),
        external: vec![],
    };
    let dir = tempfile::tempdir().unwrap();
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let store = Store::open(Filesystem::new(dir.path()).unwrap(), Allow)
            .await
            .unwrap();
        let first = store
            .request(Operation::Transact(transaction.clone()))
            .await
            .unwrap();
        assert_eq!(
            first
                .recall_items()
                .iter()
                .map(|r| r.text.as_str())
                .collect::<Vec<_>>(),
            ["uncertain finding"]
        );
        assert_eq!(
            store
                .request(Operation::Transact(transaction))
                .await
                .unwrap(),
            first
        );
        assert_eq!(first.items.len(), 4);
    });
}

#[test]
fn actual_frozen_declines_include_authored_decisions_and_exclude_them_from_recall() {
    let declined = Source {
        path: "DECLINED.md".into(),
        bytes: frozen(".planning/DECLINED.md"),
    };
    let filed = Source {
        path: "FILED.md".into(),
        bytes: frozen(".planning/FILED.md"),
    };
    let result = items::translate(None, Some(&filed), Some(&declined)).unwrap();
    assert_eq!(
        result
            .records
            .iter()
            .filter(|r| r.kind == "decline_decision")
            .count(),
        8
    );
    assert!(
        result
            .records
            .iter()
            .any(|r| r.text.starts_with("/cad-stakes:"))
    );
    assert!(
        result
            .warnings
            .iter()
            .any(|w| w.contains("FILED/DECLINED conflict"))
    );
    assert_eq!(result.evidence[1].source.bytes, declined.bytes);
    let invalid = Source {
        path: "CAPTURE.md".into(),
        bytes: vec![0xff, 0x00],
    };
    let result = items::translate(Some(&invalid), None, None).unwrap();
    assert!(result.records.is_empty());
    assert_eq!(result.evidence[0].source, invalid);
}

#[test]
fn frozen_cursor_survives_restart_without_deriving_phase_status() {
    let state = Source {
        path: "STATE.md".into(),
        bytes: frozen(".planning/STATE.md"),
    };
    let translated = decisions::translate(Some(&state), None, None).unwrap();
    assert_eq!(translated.cursor["phase"], json!(1.0));
    assert_eq!(translated.cursor["total"], json!(0));
    assert_eq!(translated.cursor["name"], json!("no active cycle"));
    assert_eq!(translated.cursor["status"], json!("ready to plan"));
    assert_eq!(translated.cursor["next"], json!("/cad-phase add"));
    assert_eq!(
        translated.cursor["original_fields"]["phase"],
        json!("1 of 0 (no active cycle)")
    );
    assert_eq!(translated.evidence[0].source, state);
    let dir = tempfile::tempdir().unwrap();
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let store = Store::open(Filesystem::new(dir.path()).unwrap(), Allow)
            .await
            .unwrap();
        let first = store
            .request(Operation::RewriteSnapshot(
                json!({"cursor":translated.cursor,"source_evidence":translated.evidence}),
            ))
            .await
            .unwrap();
        drop(store);
        let reopened = Store::open(Filesystem::new(dir.path()).unwrap(), Allow)
            .await
            .unwrap();
        assert_eq!(reopened.request(Operation::Read).await.unwrap(), first);
    });
}

#[test]
fn mixed_legacy_logs_admit_only_decisions_and_keep_requested_observed_effort_distinct() {
    use cadence::store::model::Decision;
    let mut raw = String::new();
    let routing = json!({"family":"routing","event":"resolve","phase":"03.1","agent":"cad-executor-high","role":"cad-executor","effort":"high","model_source":"repo","agent_id":"a","observed_effort":" \t "});
    for row in [
        routing.clone(),
        json!({"family":"routing","event":"resolve","phase":3,"agent":"cad-executor-high","agent_id":"b","effort":"high","observed_effort":"host-unfamiliar"}),
        json!({"family":"outcome","event":"risk_check","phase":3,"checked":false,"inconclusive":true,"reason":"unresolved-range"}),
        json!({"family":"outcome","event":"census_undeclared","phase":3,"censuses":["one"]}),
        json!({"family":"read","event":"recall","tokens":100}),
        json!({"family":"lifecycle","event":"dispatch","tokens":200}),
        json!({"family":"lifecycle","event":"record_rotated"}),
        json!({"family":"routing","event":"resolve","phase":null,"agent":"cad-executor-high"}),
        json!({"family":"outcome","event":"unknown"}),
    ] {
        raw.push_str(&format!("{row}\n"));
    }
    raw.push_str("broken row\n{\"family\":\"outcome\"");
    let current = source("trace.jsonl", &raw);
    let rotated = source("trace.1.jsonl", &format!("{routing}\n"));
    let result = decisions::translate(None, Some(&current), Some(&rotated)).unwrap();
    assert_eq!(result.records.len(), 5); // equal payload in another source is not proof of a carry
    assert_ne!(result.records[0].id, result.records[4].id);
    let Decision::Routing {
        requested_effort,
        observed_effort,
        receipt,
        ..
    } = &result.records[0].decision
    else {
        panic!("routing missing")
    };
    assert_eq!(*requested_effort, Evidence::Text("high".into()));
    assert_eq!(*observed_effort, Evidence::Missing);
    assert_eq!(*receipt, Evidence::Missing);
    assert!(
        !serde_json::to_string(&result.records[0])
            .unwrap()
            .contains("observed_effort")
    );
    let Decision::Routing {
        observed_effort, ..
    } = &result.records[1].decision
    else {
        panic!("routing missing")
    };
    assert_eq!(*observed_effort, Evidence::Text("host-unfamiliar".into()));
    assert!(matches!(result.records[2].decision, Decision::Gate { .. }));
    assert!(matches!(
        result.records[3].decision,
        Decision::Refusal { .. }
    ));
    assert!(
        result
            .warnings
            .iter()
            .any(|s| s.contains("malformed/incomplete"))
    );
    assert_eq!(result.evidence[0].source, current);
    assert_eq!(
        result.records,
        decisions::translate(None, Some(&current), Some(&rotated))
            .unwrap()
            .records
    );
    let transaction = Transaction {
        id: "log-source-generation".into(),
        items: vec![],
        decisions: result.records,
        snapshot: None,
        external: vec![],
    };
    let dir = tempfile::tempdir().unwrap();
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let store = Store::open(Filesystem::new(dir.path()).unwrap(), Allow)
            .await
            .unwrap();
        let first = store
            .request(Operation::Transact(transaction.clone()))
            .await
            .unwrap();
        assert_eq!(
            store
                .request(Operation::Transact(transaction))
                .await
                .unwrap(),
            first
        );
    });
}

#[test]
fn proven_rotation_copy_coalesces_events_and_retains_both_origins() {
    let anchor = json!({"family":"lifecycle","event":"phase_start","phase":3,"corr":"a"});
    let gate = json!({"family":"outcome","event":"risk_check","phase":3,"corr":"a","checked":true});
    let rotated = source("trace.1.jsonl", &format!("{anchor}\n{gate}\n{gate}\n"));
    let marker = json!({"family":"lifecycle","event":"record_rotated","file":"trace.1.jsonl","carried_bytes":rotated.bytes.len(),"corr":"a"});
    let current = source(
        "trace.jsonl",
        &format!("{anchor}\n{gate}\n{gate}\n{marker}\n"),
    );
    let result = decisions::translate(None, Some(&current), Some(&rotated)).unwrap();
    assert_eq!(result.records.len(), 2); // two real identical events, each with two source positions
    assert_ne!(result.records[0].id, result.records[1].id);
    for record in result.records {
        let Evidence::Text(original) = record.origin.original else {
            panic!("missing origins")
        };
        let origins: Vec<serde_json::Value> = serde_json::from_str(&original).unwrap();
        assert_eq!(origins.len(), 2);
        assert_eq!(origins[0]["path"], json!("trace.jsonl"));
        assert_eq!(origins[1]["path"], json!("trace.1.jsonl"));
    }
}

fn repository_root() -> &'static Path {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
}

fn external_temp() -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    let repo = repository_root();
    assert!(
        !dir.path().starts_with(repo),
        "import fixtures require TMPDIR outside repository"
    );
    dir
}
fn extraction() -> tempfile::TempDir {
    use std::io::Write;
    use std::process::{Command, Stdio};
    let dir = external_temp();
    let archive = Command::new("git")
        .current_dir(repository_root())
        .args(["archive", "v3.7.12", ".planning"])
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(
        archive.status.success(),
        "{}",
        String::from_utf8_lossy(&archive.stderr)
    );
    let mut tar = Command::new("tar")
        .args(["-x", "-C"])
        .arg(dir.path())
        .stdin(Stdio::piped())
        .spawn()
        .unwrap();
    tar.stdin
        .take()
        .unwrap()
        .write_all(&archive.stdout)
        .unwrap();
    assert!(tar.wait().unwrap().success());
    // These are the frozen inputs that make AC5 meaningful. An empty or
    // wrong-generation extraction must fail before the importer is invoked.
    let planning = dir.path().join(".planning");
    for name in ["config.json", "STATE.md", "FILED.md", "DECLINED.md"] {
        let path = planning.join(name);
        assert!(path.is_file(), "frozen fixture lacks {}", path.display());
        assert_eq!(
            std::fs::read(&path).unwrap(),
            frozen(&format!(".planning/{name}")),
            "wrong frozen provenance: {name}"
        );
    }
    for name in [ITEMS, DECISIONS, STATE, "config.v4.json"] {
        assert!(
            !planning.join(name).exists(),
            "fixture already contains v4 output: {name}"
        );
    }
    let git = Command::new("git")
        .arg("-C")
        .arg(dir.path())
        .args(["rev-parse", "--show-toplevel"])
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(!git.status.success(), "fixture inherited a git repository");
    dir
}
fn tree_bytes(root: &Path) -> BTreeMap<PathBuf, Vec<u8>> {
    fn walk(root: &Path, at: &Path, out: &mut BTreeMap<PathBuf, Vec<u8>>) {
        for entry in std::fs::read_dir(at).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            if entry.file_type().unwrap().is_dir() {
                walk(root, &path, out);
            } else {
                out.insert(
                    path.strip_prefix(root).unwrap().into(),
                    std::fs::read(path).unwrap(),
                );
            }
        }
    }
    let mut out = BTreeMap::new();
    walk(root, root, &mut out);
    out
}
fn allow_evaluation() -> Evaluate {
    Arc::new(|_, _| Ok(()))
}
fn policy_evaluation() -> Evaluate {
    Arc::new(|_, g| {
        if merge::get(&g.effective.values, "workflow.verifier") == Some(&json!(true)) {
            Ok(())
        } else {
            Err(Error::Policy(
                "test mutation refused by current workflow.verifier".into(),
            ))
        }
    })
}

#[test]
fn first_touch_child() {
    use std::io::{Read, Write};
    let Some(root) = std::env::var_os("CADENCE_IMPORT_ROOT") else {
        return;
    };
    let root = PathBuf::from(root);
    let kill = std::env::var("CADENCE_IMPORT_KILL").unwrap_or_default();
    let factory =
        SessionFactory::new(None, policy_evaluation()).with_probe(Arc::new(move |stage, path| {
            if stage == Stage::Renamed && path.file_name().unwrap() == kill.as_str() {
                println!("IMPORT_BARRIER");
                std::io::stdout().flush()?;
                let _ = std::io::stdin().read(&mut [0u8; 1]);
            }
            Ok(())
        }));
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let session=factory.first_touch(&root).await.unwrap();
        let same=factory.first_touch(&root).await.unwrap();
        assert!(Arc::ptr_eq(&session,&same));
        let view=session.request(Operation::Read).await.unwrap();
        println!("IMPORT_RESULT {}",json!({"manifest":session.import_manifest(),"items":view.items.iter().map(|r|(&r.id,r.revision)).collect::<Vec<_>>(),"generation":view.snapshot.generation}));
    });
}
fn import_child(root: &Path) -> Value {
    let output = std::process::Command::new(std::env::current_exe().unwrap())
        .args(["--exact", "import::tests::first_touch_child", "--nocapture"])
        .env("CADENCE_IMPORT_ROOT", root)
        .env_remove("CADENCE_IMPORT_KILL")
        .stdin(std::process::Stdio::null())
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    let text = String::from_utf8(output.stdout).unwrap();
    serde_json::from_str(
        text.lines()
            .find_map(|line| line.strip_prefix("IMPORT_RESULT "))
            .unwrap(),
    )
    .unwrap()
}

#[test]
fn ac5_frozen_first_touch_creates_stores_names_retirements_and_preserves_every_original() {
    let fixture = extraction();
    let root = fixture.path().join(".planning");
    let originals = tree_bytes(&root);
    let first = import_child(&root);
    assert_eq!(first["generation"], json!(1));
    let created: Vec<PathBuf> =
        serde_json::from_value(first["manifest"]["created"].clone()).unwrap();
    assert_eq!(created.len(), 4);
    for name in [ITEMS, DECISIONS, STATE, "config.v4.json"] {
        assert!(created.contains(&root.join(name)));
    }
    let warnings = first["manifest"]["warnings"].as_array().unwrap();
    let locked = warnings
        .iter()
        .filter_map(Value::as_str)
        .find(|s| s.starts_with("Retired settings (D-06):"))
        .unwrap();
    for key in config::RETIRED {
        assert!(locked.contains(key), "{key}");
    }
    assert_eq!(
        warnings
            .iter()
            .filter_map(Value::as_str)
            .find(|s| s.starts_with("Repo present and removed:")),
        Some("Repo present and removed: git.auto_close")
    );
    let effective: Value =
        serde_json::from_slice(&std::fs::read(root.join("config.v4.json")).unwrap()).unwrap();
    assert!(merge::get(&effective, "git.auto_close").is_none());
    assert_eq!(import_child(&root), first);
    for (path, bytes) in originals {
        assert_eq!(std::fs::read(root.join(path)).unwrap(), bytes);
    }
}

#[test]
fn killed_first_touch_recovers_one_import_with_stable_identities() {
    use std::io::{BufRead, BufReader};
    use std::os::unix::process::ExitStatusExt;
    use std::process::{Command, Stdio};
    for target in ["config.v4.json", ITEMS, DECISIONS, STATE] {
        let fixture = extraction();
        let root = fixture.path().join(".planning");
        let originals = tree_bytes(&root);
        let mut child = Command::new(std::env::current_exe().unwrap())
            .args(["--exact", "import::tests::first_touch_child", "--nocapture"])
            .env("CADENCE_IMPORT_ROOT", &root)
            .env("CADENCE_IMPORT_KILL", target)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .unwrap();
        let mut output = BufReader::new(child.stdout.take().unwrap());
        let mut saw_barrier = false;
        loop {
            let mut line = String::new();
            if output.read_line(&mut line).unwrap() == 0 {
                break;
            }
            if line.trim() == "IMPORT_BARRIER" {
                saw_barrier = true;
                break;
            }
        }
        assert!(saw_barrier, "child exited before {target} barrier");
        child.kill().unwrap();
        assert_eq!(child.wait().unwrap().signal(), Some(libc::SIGKILL));
        assert!(root.join(INTENT).exists());
        let resumed = import_child(&root);
        assert_eq!(resumed["generation"], json!(1));
        assert_eq!(import_child(&root), resumed);
        assert!(!root.join(INTENT).exists());
        let store_items: Vec<cadence::store::model::ItemRecord> =
            cadence::store::model::parse_lines(&std::fs::read(root.join(ITEMS)).unwrap()).unwrap();
        let expected = items::translate(
            None,
            Some(&Source {
                path: "FILED.md".into(),
                bytes: originals[Path::new("FILED.md")].clone(),
            }),
            Some(&Source {
                path: "DECLINED.md".into(),
                bytes: originals[Path::new("DECLINED.md")].clone(),
            }),
        )
        .unwrap();
        assert_eq!(store_items, expected.records);
        for (path, bytes) in originals {
            assert_eq!(std::fs::read(root.join(path)).unwrap(), bytes);
        }
    }
}

#[derive(Clone)]
struct DenyIo {
    path: Arc<Mutex<Option<PathBuf>>>,
}
impl ConfigIo for DenyIo {
    fn read(&mut self, path: &Path) -> Result<Input> {
        if self.path.lock().unwrap().as_deref() == Some(path) {
            return Err(std::io::Error::from(std::io::ErrorKind::PermissionDenied).into());
        }
        FileIo.read(path)
    }
}

#[test]
fn first_touch_distinguishes_optional_absence_unreadability_malformed_config_and_foreign_outputs() {
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let empty = external_temp();
        let root = empty.path().join(".planning");
        let factory = SessionFactory::new(
            Some(empty.path().join("missing-global/config.json")),
            allow_evaluation(),
        );
        let session = factory.first_touch(&root).await.unwrap();
        assert!(
            session
                .request(Operation::Read)
                .await
                .unwrap()
                .items
                .is_empty()
        );
        assert_eq!(session.import_manifest().created.len(), 4);
        for invalid in ["{", "false", "{\"git\":{\"on_protected\":\"maybe\"}}"] {
            let fixture = external_temp();
            std::fs::write(fixture.path().join("config.json"), invalid).unwrap();
            let before = tree_bytes(fixture.path());
            assert!(
                SessionFactory::new(None, allow_evaluation())
                    .first_touch(fixture.path())
                    .await
                    .is_err()
            );
            assert_eq!(tree_bytes(fixture.path()), before);
        }
        for target in [ITEMS, DECISIONS, STATE, "config.v4.json"] {
            let fixture = external_temp();
            std::fs::write(fixture.path().join(target), b"foreign").unwrap();
            let before = tree_bytes(fixture.path());
            assert!(
                SessionFactory::new(None, allow_evaluation())
                    .first_touch(fixture.path())
                    .await
                    .is_err()
            );
            assert_eq!(tree_bytes(fixture.path()), before);
        }
        let fixture = extraction();
        let root = fixture.path().join(".planning");
        let before = tree_bytes(&root);
        let denied = Arc::new(Mutex::new(Some(root.join("FILED.md"))));
        let factory = SessionFactory::with_io(None, DenyIo { path: denied }, allow_evaluation());
        assert!(factory.first_touch(&root).await.is_err());
        assert_eq!(tree_bytes(&root), before);
    });
}

#[test]
fn first_touch_checks_source_changes_and_normalizes_known_legacy_values() {
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let fixture=external_temp();let root=fixture.path().to_path_buf();
        std::fs::write(root.join("config.json"),br#"{"git":{"on_protected":"deny"},"planning":{"max_capture_bullets":"invalid"},"unknown":{"value":5}}"#).unwrap();
        let session=SessionFactory::new(None,allow_evaluation()).first_touch(&root).await.unwrap();
        assert_eq!(merge::get(&session.config().unwrap().effective.values,"git.on_protected"),Some(&json!("refuse")));
        assert_eq!(merge::get(&session.config().unwrap().effective.values,"planning.max_capture_bullets"),Some(&json!(40)));
        let view=session.request(Operation::Read).await.unwrap();
        assert!(view.snapshot.data["source_evidence"].to_string().contains("non_effective_original_source"));
        let fixture=external_temp();let root=fixture.path().to_path_buf();
        let path=root.join("CAPTURE.md");std::fs::write(&path,b"## Todos\n- [ ] first\n").unwrap();
        let changed=path.clone();
        let factory=SessionFactory::new(None,allow_evaluation()).with_probe(Arc::new(move |stage,_| {
            if stage==Stage::Prepared {std::fs::write(&changed,b"## Todos\n- [ ] changed\n")?;}Ok(())
        }));
        assert!(factory.first_touch(&root).await.is_err());
        for name in [ITEMS,DECISIONS,STATE,"config.v4.json",INTENT] {assert!(!root.join(name).exists());}
    });
}
