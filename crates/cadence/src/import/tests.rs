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

fn semantic_bytes(root: &Path) -> Vec<Vec<u8>> {
    [ITEMS, DECISIONS, STATE]
        .iter()
        .map(|name| std::fs::read(root.join(name)).unwrap())
        .collect()
}
fn change_config(path: &Path, key: &str, value: Value) {
    let mut raw: Value = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    merge::set(&mut raw, key, value);
    std::fs::write(path, serde_json::to_vec(&raw).unwrap()).unwrap();
}
fn capture_item(id: &str) -> cadence::store::model::ItemRecord {
    cadence::store::model::ItemRecord {
        version: cadence::store::model::VERSION,
        id: id.into(),
        revision: 1,
        origin: cadence::store::model::Origin {
            source: "service-test".into(),
            original: Evidence::Missing,
        },
        text: format!("{id}\ncontinued text"),
        kind: "todo".into(),
        disposition: Disposition::Captured,
        completed: false,
        filing_uncertain: false,
    }
}
fn global_fixture(dir: &Path) -> PathBuf {
    let parent = dir.join("global");
    std::fs::create_dir(&parent).unwrap();
    let path = parent.join("config.json");
    std::fs::write(&path, br#"{"workflow":{"verifier":true}}"#).unwrap();
    path
}
fn frozen_readers_still_read_originals(fixture: &Path, root: &Path) {
    let library = fixture.join("frozen-readers");
    std::fs::create_dir(&library).unwrap();
    for name in [
        "planning-files.mjs",
        "lease-grammar.mjs",
        "config-merge.mjs",
        "global-only-keys.mjs",
    ] {
        std::fs::write(
            library.join(name),
            frozen(&format!("cadence-core/bin/lib/{name}")),
        )
        .unwrap();
    }
    let script = r#"
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const [library, root] = process.argv.slice(1);
const readers = await import(pathToFileURL(`${library}/planning-files.mjs`));
const config = await import(pathToFileURL(`${library}/config-merge.mjs`));
const cursor = readers.parseCursor(readFileSync(`${root}/STATE.md`, 'utf8'));
console.log(JSON.stringify({cursor,
 filed:readers.parseFiledRows(readFileSync(`${root}/FILED.md`, 'utf8')).length,
 declined:readers.parseDeclinedRows(readFileSync(`${root}/DECLINED.md`, 'utf8')).length,
 auto_close:config.mergeLayers(`${root}/config.json`).config.git.auto_close}));
"#;
    let output = std::process::Command::new("node")
        .args(["--input-type=module", "-e", script])
        .arg(&library)
        .arg(root)
        .current_dir(fixture)
        .env(
            "CADENCE_GLOBAL_CONFIG",
            fixture.join("absent-reader-global.json"),
        )
        .stdin(std::process::Stdio::null())
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let read: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(read["cursor"]["phase"], json!(1));
    assert_eq!(read["cursor"]["total"], json!(0));
    assert!(read["filed"].as_u64().unwrap() > 0 && read["declined"].as_u64().unwrap() > 0);
    assert_eq!(read["auto_close"], json!(true));
}

#[test]
fn same_owner_imports_then_rechecks_each_layer_denials_and_internal_writes() {
    for layer in [Layer::Global, Layer::Repo] {
        let fixture = extraction();
        let root = fixture.path().join(".planning");
        let originals = tree_bytes(&root);
        let global = global_fixture(fixture.path());
        let old_global = std::fs::read(&global).unwrap();
        let denied = Arc::new(Mutex::new(None));
        let factory = SessionFactory::with_io(
            Some(global.clone()),
            DenyIo {
                path: denied.clone(),
            },
            policy_evaluation(),
        );
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let session = factory.first_touch(&root).await.unwrap();
            assert!(Arc::ptr_eq(
                &session,
                &factory.first_touch(&root).await.unwrap()
            ));
            assert_eq!(session.import_manifest().created.len(), 5);
            for key in config::RETIRED {
                assert!(session.import_manifest().warnings[0].contains(key));
            }
            session
                .request(Operation::AppendItem(capture_item("permitted")))
                .await
                .unwrap();
            let active = &session.import_manifest().active;
            let target = if layer == Layer::Repo {
                &active.repo
            } else {
                active.global.as_ref().unwrap()
            };
            change_config(target, "workflow.verifier", json!(false));
            let before = semantic_bytes(&root);
            assert!(
                session
                    .request(Operation::AppendItem(capture_item("refused")))
                    .await
                    .is_err()
            );
            assert_eq!(semantic_bytes(&root), before);
            change_config(target, "workflow.verifier", json!(true));
            let good_generation = session.config().unwrap().number;
            *denied.lock().unwrap() = Some(target.clone());
            assert!(
                session
                    .request(Operation::AppendItem(capture_item("unreadable")))
                    .await
                    .is_err()
            );
            assert!(session.request(Operation::Read).await.is_err());
            assert_eq!(semantic_bytes(&root), before);
            *denied.lock().unwrap() = None;
            session
                .request(Operation::AppendItem(capture_item("restored")))
                .await
                .unwrap();
            assert!(session.config().unwrap().number > good_generation);
            session
                .set_config(Layer::Repo, "planning.max_capture_bullets", json!(1))
                .await
                .unwrap();
            assert_eq!(session.capture_report().await.unwrap().bound, 1);
            session
                .set_config(layer, "workflow.verifier", json!(false))
                .await
                .unwrap();
            let before = semantic_bytes(&root);
            let config_before = std::fs::read(target).unwrap();
            assert!(
                session
                    .request(Operation::AppendItem(capture_item("new-policy")))
                    .await
                    .is_err()
            );
            assert!(
                session
                    .set_config(layer, "workflow.verifier", json!(true))
                    .await
                    .is_err()
            );
            assert_eq!(semantic_bytes(&root), before);
            assert_eq!(std::fs::read(target).unwrap(), config_before);
            change_config(target, "workflow.verifier", json!(true));
            session
                .request(Operation::RewriteSnapshot(json!({"cursor":"next"})))
                .await
                .unwrap();
            let view = session.request(Operation::Read).await.unwrap();
            assert_eq!(view.snapshot.data["import"]["complete"], json!(true));
            assert_eq!(view.snapshot.data["current"]["cursor"], json!("next"));
            assert!(
                view.items
                    .iter()
                    .all(|r| !matches!(r.id.as_str(), "refused" | "unreadable" | "new-policy"))
            );
        });
        for (path, bytes) in originals {
            assert_eq!(std::fs::read(root.join(path)).unwrap(), bytes);
        }
        assert_eq!(std::fs::read(global).unwrap(), old_global);
        frozen_readers_still_read_originals(fixture.path(), &root);
    }
}

#[test]
fn resident_policy_follows_rename_symlink_retarget_and_layer_collapse() {
    use std::os::unix::fs::symlink;
    let fixture = extraction();
    let root = fixture.path().join(".planning");
    let global = global_fixture(fixture.path());
    let factory = SessionFactory::new(Some(global), policy_evaluation());
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let session = factory.first_touch(&root).await.unwrap();
        let active = &session.import_manifest().active;
        let global = active.global.as_ref().unwrap();
        let first = session.config().unwrap();
        let replacement = fixture.path().join("checkout-config.json");
        std::fs::write(&replacement, br#"{"workflow":{"verifier":false}}"#).unwrap();
        std::fs::rename(&replacement, global).unwrap();
        let before = semantic_bytes(&root);
        assert!(
            session
                .request(Operation::AppendItem(capture_item("renamed-denial")))
                .await
                .is_err()
        );
        assert_eq!(semantic_bytes(&root), before);
        assert_ne!(
            session.config().unwrap().global.unwrap().stamp,
            first.global.unwrap().stamp
        );
        change_config(global, "workflow.verifier", json!(true));
        let original_repo = std::fs::read(&active.repo).unwrap();
        let refused = fixture.path().join("refused.json");
        let allowed = fixture.path().join("allowed.json");
        std::fs::write(&refused, br#"{"workflow":{"verifier":false}}"#).unwrap();
        std::fs::write(&allowed, br#"{"workflow":{"verifier":true}}"#).unwrap();
        std::fs::remove_file(&active.repo).unwrap();
        symlink(&refused, &active.repo).unwrap();
        assert!(
            session
                .request(Operation::AppendItem(capture_item("symlink-denial")))
                .await
                .is_err()
        );
        assert_eq!(semantic_bytes(&root), before);
        std::fs::remove_file(&active.repo).unwrap();
        symlink(&allowed, &active.repo).unwrap();
        session
            .request(Operation::AppendItem(capture_item("retargeted")))
            .await
            .unwrap();
        assert_eq!(session.config().unwrap().repo.identity, allowed);
        std::fs::remove_file(&active.repo).unwrap();
        std::fs::write(&active.repo, &original_repo).unwrap();
        std::fs::remove_file(global).unwrap();
        symlink(&active.repo, global).unwrap();
        assert!(session.config().unwrap().global.is_none());
        session
            .request(Operation::AppendItem(capture_item("collapsed")))
            .await
            .unwrap();
        std::fs::remove_file(global).unwrap();
        std::fs::write(global, br#"{"workflow":{"verifier":false}}"#).unwrap();
        let before = semantic_bytes(&root);
        assert!(session.config().unwrap().global.is_some());
        assert!(
            session
                .request(Operation::AppendItem(capture_item("separated-denial")))
                .await
                .is_err()
        );
        assert_eq!(semantic_bytes(&root), before);
        change_config(global, "workflow.verifier", json!(true));
        session
            .request(Operation::AppendItem(capture_item("separated-restored")))
            .await
            .unwrap();
        assert!(Arc::ptr_eq(
            &session,
            &factory.first_touch(&root).await.unwrap()
        ));
    });
}

#[test]
fn capture_threshold_counts_active_identities_across_durable_revisions() {
    use cadence::store::items::{ItemChange, revise};
    let fixture = extraction();
    let root = fixture.path().join(".planning");
    let factory = SessionFactory::new(None, policy_evaluation());
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let session = factory.first_touch(&root).await.unwrap();
        let baseline = session.request(Operation::Read).await.unwrap().items.len();
        session
            .set_config(Layer::Repo, "planning.max_capture_bullets", json!(1))
            .await
            .unwrap();
        let first = capture_item("capture-first");
        session
            .request(Operation::AppendItem(first.clone()))
            .await
            .unwrap();
        assert_eq!(session.capture_report().await.unwrap().active, 1);
        session
            .request(Operation::AppendItem(
                revise(&first, ItemChange::Complete).unwrap(),
            ))
            .await
            .unwrap();
        let second = capture_item("capture-second");
        let third = capture_item("capture-third");
        session
            .request(Operation::AppendItem(second.clone()))
            .await
            .unwrap();
        let crossed = session
            .request(Operation::AppendItem(third.clone()))
            .await
            .unwrap();
        let report = session.capture_report().await.unwrap();
        assert_eq!(
            report,
            config::CaptureReport {
                active: 2,
                bound: 1,
                exceeded: true,
                unit: "items"
            }
        );
        assert_eq!(crossed.items.len(), baseline + 4);
        let durable: Vec<cadence::store::model::ItemRecord> =
            cadence::store::model::parse_lines(&std::fs::read(root.join(ITEMS)).unwrap()).unwrap();
        assert_eq!(durable, crossed.items);
        assert!(durable.iter().any(|r| r.id == third.id));
        session
            .request(Operation::AppendItem(
                revise(
                    &third,
                    ItemChange::File {
                        pointer: "github owner/repo abc".into(),
                        uncertain: true,
                    },
                )
                .unwrap(),
            ))
            .await
            .unwrap();
        session
            .request(Operation::AppendItem(
                revise(
                    &second,
                    ItemChange::Decline {
                        reason: "explicit decline".into(),
                    },
                )
                .unwrap(),
            ))
            .await
            .unwrap();
        let last = session
            .request(Operation::AppendItem(capture_item("capture-active")))
            .await
            .unwrap();
        assert_eq!(last.items.len(), baseline + 7);
        assert_eq!(
            session.capture_report().await.unwrap(),
            config::CaptureReport {
                active: 1,
                bound: 1,
                exceeded: false,
                unit: "items"
            }
        );
        assert!(last.recall_items().iter().all(|r| r.id != second.id));
    });
}

#[test]
fn aliased_legacy_sources_keep_one_import_destination_and_global_request_scope() {
    use std::os::unix::fs::symlink;
    let fixture = extraction();
    let root = fixture.path().join(".planning");
    let alias = fixture.path().join("global-link.json");
    symlink(root.join("config.json"), &alias).unwrap();
    let factory = SessionFactory::new(Some(alias), policy_evaluation());
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let session = factory.first_touch(&root).await.unwrap();
        assert_eq!(session.import_manifest().created.len(), 4);
        assert_eq!(
            session.import_manifest().active.global.as_ref(),
            Some(&session.import_manifest().active.repo)
        );
        let current = session.config().unwrap();
        assert!(current.global.is_none());
        assert_eq!(current.effective.sources["git.forge_repo"], Layer::Repo);
        let before = semantic_bytes(&root);
        assert!(
            session
                .set_config(Layer::Global, "git.forge_repo", json!("owner/repo"))
                .await
                .is_err()
        );
        assert_eq!(semantic_bytes(&root), before);
        session
            .set_config(Layer::Repo, "planning.max_capture_bullets", json!(2))
            .await
            .unwrap();
        assert_eq!(session.capture_report().await.unwrap().bound, 2);
    });
}

#[test]
fn same_factory_recovers_interrupted_import_then_uses_active_policy() {
    use std::sync::atomic::{AtomicBool, Ordering};
    let fixture = extraction();
    let root = fixture.path().join(".planning");
    let interrupt = Arc::new(AtomicBool::new(true));
    let fault = interrupt.clone();
    let factory =
        SessionFactory::new(None, policy_evaluation()).with_probe(Arc::new(move |stage, path| {
            if stage == Stage::Renamed
                && path.file_name().unwrap() == ITEMS
                && fault.swap(false, Ordering::SeqCst)
            {
                return Err(Error::Io("interrupted import installation".into()));
            }
            Ok(())
        }));
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        assert!(factory.first_touch(&root).await.is_err());
        assert!(root.join(INTENT).exists());
        let session = factory.first_touch(&root).await.unwrap();
        assert!(!root.join(INTENT).exists());
        assert_eq!(
            session
                .request(Operation::Read)
                .await
                .unwrap()
                .snapshot
                .generation,
            1
        );
        session
            .request(Operation::AppendItem(capture_item("after-recovery")))
            .await
            .unwrap();
        change_config(
            &session.import_manifest().active.repo,
            "workflow.verifier",
            json!(false),
        );
        let before = semantic_bytes(&root);
        assert!(
            session
                .request(Operation::AppendItem(capture_item("recovery-denied")))
                .await
                .is_err()
        );
        assert_eq!(semantic_bytes(&root), before);
        change_config(
            &session.import_manifest().active.repo,
            "workflow.verifier",
            json!(true),
        );
        session
            .request(Operation::AppendItem(capture_item("recovery-restored")))
            .await
            .unwrap();
        assert!(Arc::ptr_eq(
            &session,
            &factory.first_touch(&root).await.unwrap()
        ));
    });
}

#[test]
fn derivation_snapshot_preserves_full_data_and_restart_manifest() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let root = tempfile::tempdir().unwrap();
    std::fs::write(
        root.path().join("STATE.md"),
        "Phase: 3 of 4\nStatus: paused\nNext: Exact next text\n",
    )
    .unwrap();
    let expected = rt.block_on(async {
        let factory = SessionFactory::new(None, Arc::new(|_, _| Ok(())));
        let session = factory.first_touch(root.path()).await.unwrap();
        let before = session.derivation_view().await.unwrap();
        let mut data = before.snapshot.data.clone();
        data["unrelated"] = json!({"keep":[1,2]});
        data["current"] = json!({"legacy":"unchanged"});
        data["derivation"] = json!({"memo":"fixture"});
        let written = session
            .commit_derivation(&before, data.clone())
            .await
            .unwrap();
        assert_eq!(written.snapshot.data, data);
        for field in ["import", "source_evidence", "archive", "cursor"] {
            assert_eq!(written.snapshot.data[field], before.snapshot.data[field]);
            let mut bad = data.clone();
            bad[field] = Value::Null;
            assert!(
                session.commit_derivation(&written, bad).await.is_err(),
                "{field}"
            );
        }
        assert_eq!(written.snapshot.operations, before.snapshot.operations);
        let mut next = data.clone();
        next["derivation"] = json!({"memo":"winner"});
        let winner = session.commit_derivation(&written, next).await.unwrap();
        assert!(session.commit_derivation(&written, data).await.is_err());
        assert_eq!(session.derivation_view().await.unwrap(), winner);
        winner.snapshot.data
    });
    rt.block_on(async {
        let factory = SessionFactory::new(None, Arc::new(|_, _| Ok(())));
        let session = factory.first_touch(root.path()).await.unwrap();
        let reopened = session.derivation_view().await.unwrap();
        assert_eq!(reopened.snapshot.data, expected);
        assert_eq!(
            serde_json::to_value(session.import_manifest()).unwrap(),
            expected["import"]
        );
    });
}

fn first_run_answers() -> Vec<write::Update> {
    serde_json::from_value(json!([
        {"key":"roles.cad-planner.model","value":null},
        {"key":"roles.cad-planner.effort","value":"high"},
        {"key":"roles.cad-assumptions-analyzer.model","value":null},
        {"key":"roles.cad-assumptions-analyzer.effort","value":"high"},
        {"key":"roles.cad-verifier.model","value":null},
        {"key":"roles.cad-verifier.effort","value":"high"},
        {"key":"roles.cad-reviewer.model","value":null},
        {"key":"roles.cad-reviewer.effort","value":"medium"},
        {"key":"roles.cad-executor.model","value":null},
        {"key":"roles.cad-executor.effort","value":"high"},
        {"key":"roles.cad-plan-checker.model","value":null},
        {"key":"roles.cad-plan-checker.effort","value":"low"},
        {"key":"review.triggers.risk_surface.waive_routing_floor","value":[]}
    ]))
    .unwrap()
}

const FIRST_RUN: &[u8] = br#"{"roles":{"cad-planner":{"model":null,"effort":"high"},"cad-assumptions-analyzer":{"model":null,"effort":"high"},"cad-verifier":{"model":null,"effort":"high"},"cad-reviewer":{"model":null,"effort":"medium"},"cad-executor":{"model":null,"effort":"high"},"cad-plan-checker":{"model":null,"effort":"low"}},"review":{"triggers":{"risk_surface":{"waive_routing_floor":[]}}}}"#;

#[tokio::test]
async fn first_global_batch_returns_thirteen_leaves_from_missing_parent_registration() {
    let fixture = external_temp();
    let root = fixture.path().join("project/.planning");
    let active = Paths {
        repo: root.join("config.v4.json"),
        global: Some(fixture.path().join("global/nested/config.v4.json")),
    };
    let storage = write::register(&root, &active).unwrap();
    let writer = write::ConfigWriter {
        root,
        active: active.clone(),
        store: Store::open(storage, Allow).await.unwrap(),
        config: Arc::new(Mutex::new(Reload::new(active, FileIo))),
    };
    let result = writer
        .batch(Layer::Global, &first_run_answers())
        .await
        .unwrap();
    assert_eq!(
        result.changed_keys,
        [
            "review.triggers.risk_surface.waive_routing_floor",
            "roles.cad-assumptions-analyzer.effort",
            "roles.cad-assumptions-analyzer.model",
            "roles.cad-executor.effort",
            "roles.cad-executor.model",
            "roles.cad-plan-checker.effort",
            "roles.cad-plan-checker.model",
            "roles.cad-planner.effort",
            "roles.cad-planner.model",
            "roles.cad-reviewer.effort",
            "roles.cad-reviewer.model",
            "roles.cad-verifier.effort",
            "roles.cad-verifier.model",
        ]
    );
}

#[derive(Clone)]
struct SuppliedConfig(BTreeMap<PathBuf, Vec<u8>>);
impl ConfigIo for SuppliedConfig {
    fn read(&mut self, path: &Path) -> Result<Input> {
        Ok(Input {
            identity: path.into(),
            bytes: self.0.get(path).cloned(),
            stamp: None,
        })
    }
}

#[tokio::test]
async fn session_config_reads_thirteen_independently_persisted_reopened_values() {
    let fixture = external_temp();
    let root = fixture.path();
    let active = Paths {
        repo: root.join("config.v4.json"),
        global: Some(root.join("global/config.v4.json")),
    };
    let session = Session {
        root: root.into(),
        store: Store::open(Filesystem::new(root).unwrap(), Allow)
            .await
            .unwrap(),
        config: Arc::new(Mutex::new(Reload::new(
            active.clone(),
            SuppliedConfig([(active.global.clone().unwrap(), FIRST_RUN.to_vec())].into()),
        ))),
        manifest: serde_json::from_value(
            json!({"format":1,"complete":true,"source_generation":"fixture",
            "sources":[],"active":active,"created":[],"warnings":[]}),
        )
        .unwrap(),
    };
    assert_eq!(
        session.config().unwrap().effective.raw_global,
        Some(json!({
            "roles": {
                "cad-planner":{"model":null,"effort":"high"},
                "cad-assumptions-analyzer":{"model":null,"effort":"high"},
                "cad-verifier":{"model":null,"effort":"high"},
                "cad-reviewer":{"model":null,"effort":"medium"},
                "cad-executor":{"model":null,"effort":"high"},
                "cad-plan-checker":{"model":null,"effort":"low"}
            },"review":{"triggers":{"risk_surface":{"waive_routing_floor":[]}}}
        }))
    );
}

#[tokio::test]
async fn initialize_second_project_reuses_active_global_bytes_and_preserves_legacy() {
    let fixture = external_temp();
    let global = fixture.path().join("global");
    std::fs::create_dir(&global).unwrap();
    std::fs::write(global.join("config.v4.json"), FIRST_RUN).unwrap();
    let legacy = br#"{"roles":{"cad-executor":{"model":"opus"}},"stakes":{"old":[1,null]}}"#;
    std::fs::write(global.join("config.json"), legacy).unwrap();
    let factory = SessionFactory::new(Some(global.join("config.json")), allow_evaluation());
    let result = factory
        .first_touch(&fixture.path().join("second/.planning"))
        .await
        .unwrap();
    assert_eq!(
        (
            result
                .manifest
                .created
                .contains(&global.join("config.v4.json")),
            std::fs::read(global.join("config.v4.json")).unwrap(),
            std::fs::read(global.join("config.json")).unwrap(),
        ),
        (false, FIRST_RUN.to_vec(), legacy.to_vec())
    );
}

#[test]
fn prepare_import_uses_active_roles_and_retains_conflicting_legacy_evidence() {
    let root = Path::new("/fixture/project/.planning");
    let legacy = Paths {
        repo: root.join("config.json"),
        global: Some("/fixture/global/config.json".into()),
    };
    let active = Paths {
        repo: root.join("config.v4.json"),
        global: Some("/fixture/global/config.v4.json".into()),
    };
    let original = br#"{"roles":{"cad-executor":{"model":"opus"}},"stakes":{"old":3}}"#;
    let mut io = SuppliedConfig(
        [
            (legacy.global.clone().unwrap(), original.to_vec()),
            (
                active.global.clone().unwrap(),
                br#"{"roles":{"cad-executor":{"model":"sonnet"}}}"#.to_vec(),
            ),
        ]
        .into(),
    );
    let result = prepare_import(root, &legacy, &active, &mut io, false).unwrap();
    assert_eq!(
        (
            result.generation.effective.raw_global,
            result.transaction.snapshot.unwrap()["source_evidence"].clone()
        ),
        (
            Some(json!({"roles":{"cad-executor":{"model":"sonnet"}}})),
            json!([{
                "source":{"path":"/fixture/global/config.json","bytes":original.as_slice()},
                "generation":"4811eab5b9e5fb01dd97de0e9e9d7c06d57b6a84e0dc63bdce9a4fa8638e0884","label":"non_effective_original_source","layer":"global"
            }])
        )
    );
}

#[test]
fn register_missing_global_parent_creates_infrastructure_without_config_pins() {
    let fixture = external_temp();
    let root = fixture.path().join("project/.planning");
    let active = Paths {
        repo: root.join("config.v4.json"),
        global: Some(fixture.path().join("global/nested/config.v4.json")),
    };
    let mut result = write::register(&root, &active).unwrap();
    assert_eq!(
        (
            result.read("repo-config").unwrap().bytes,
            result.read("global-config").unwrap().bytes
        ),
        (None, None)
    );
}

#[test]
fn register_refuses_symlink_ancestors() {
    let fixture = external_temp();
    std::os::unix::fs::symlink(fixture.path(), fixture.path().join("alias")).unwrap();
    let active = Paths {
        repo: fixture.path().join("config.v4.json"),
        global: Some(fixture.path().join("alias/nested/config.v4.json")),
    };
    assert_eq!(
        write::register(fixture.path(), &active).err(),
        Some(Error::Conflict("unsafe directory identity".into()))
    );
}

#[test]
fn prepare_import_refuses_unusable_active_global_without_legacy_normalization() {
    let root = Path::new("/fixture/project/.planning");
    let legacy = Paths {
        repo: root.join("config.json"),
        global: Some("/fixture/global/config.json".into()),
    };
    let active = Paths {
        repo: root.join("config.v4.json"),
        global: Some("/fixture/global/config.v4.json".into()),
    };
    let mut io = SuppliedConfig(
        [(
            active.global.clone().unwrap(),
            br#"{"roles":{"cad-executor":{"effort":"invalid"}}}"#.to_vec(),
        )]
        .into(),
    );
    assert_eq!(
        prepare_import(root, &legacy, &active, &mut io, false).err(),
        Some(Error::Policy(
            "config unavailable: unusable roles.cad-executor.effort".into()
        ))
    );
}

#[test]
fn snapshot_replacement_preserves_provenance_and_unrelated_namespaces() {
    let previous = json!({"import":{"complete":true},"source_evidence":[{"original":[null,1]}],
        "archive":{"path":"ARCHIVE.md"},"cursor":{"phase":8},"evidence":{"keep":1},
        "derivation":{"keep":2},"execution":{"keep":3},"rail_receipts":{"keep":4}});
    assert_eq!(
        replace_current(&previous, json!({"new":"payload"})),
        Ok(json!({
            "import":{"complete":true},"source_evidence":[{"original":[null,1]}],
            "archive":{"path":"ARCHIVE.md"},"cursor":{"phase":8},"evidence":{"keep":1},
            "derivation":{"keep":2},"execution":{"keep":3},"rail_receipts":{"keep":4},
            "current":{"new":"payload"}
        }))
    );
}

#[test]
fn snapshot_replacement_keeps_wrapped_historical_evidence_at_its_original_location() {
    assert_eq!(
        replace_current(
            &json!({"import":{"complete":true},
        "current":{"source_evidence":[{"old":null}],"unrelated":[1,2]}}),
            json!({"answer":13})
        ),
        Ok(
            json!({"import":{"complete":true},"current":{"source_evidence":[{"old":null}],
            "unrelated":[1,2],"current":{"answer":13}}})
        )
    );
}

struct SnapshotMemory(BTreeMap<String, cadence::store::Observed>);
impl Storage for SnapshotMemory {
    type Prepared = (String, Vec<u8>);
    fn read(&mut self, target: &str) -> Result<cadence::store::Observed> {
        Ok(self
            .0
            .get(target)
            .cloned()
            .unwrap_or(cadence::store::Observed {
                bytes: None,
                identity: "missing".into(),
                directory_identity: "fixture".into(),
            }))
    }
    fn prepare(&mut self, target: &str, bytes: &[u8]) -> Result<Self::Prepared> {
        Ok((target.into(), bytes.into()))
    }
    fn install(&mut self, prepared: &Self::Prepared) -> Result<()> {
        self.0.insert(
            prepared.0.clone(),
            cadence::store::Observed {
                bytes: Some(prepared.1.clone()),
                identity: "installed".into(),
                directory_identity: "fixture".into(),
            },
        );
        Ok(())
    }
    fn discard(&mut self, _: Self::Prepared) -> Result<()> {
        Ok(())
    }
    fn confirm(&mut self, target: &str, _: &[u8]) -> Result<cadence::store::Observed> {
        self.read(target)
    }
    fn resync(&mut self, target: &str, _: &[u8]) -> Result<cadence::store::Observed> {
        self.read(target)
    }
    fn remove(&mut self, target: &str) -> Result<()> {
        self.0.remove(target);
        Ok(())
    }
}

async fn snapshot_session() -> Session<SuppliedConfig> {
    let active = Paths {
        repo: "/fixture/project/.planning/config.v4.json".into(),
        global: None,
    };
    let manifest: ImportManifest = serde_json::from_value(json!({"format":1,"complete":true,
        "source_generation":"fixture","sources":[],"active":active,"created":[],"warnings":[]}))
    .unwrap();
    let snapshot = cadence::store::model::Snapshot::new(
        7,
        b"",
        b"",
        json!({
            "import":manifest,"source_evidence":[{"preserved":[1,null]}],"cursor":{"phase":8},
            "archive":{"available":true},"unrelated":{"keep":true}
        }),
    )
    .unwrap();
    let memory = SnapshotMemory(
        [
            (ITEMS, Vec::new()),
            (DECISIONS, Vec::new()),
            (STATE, snapshot.render().unwrap()),
        ]
        .into_iter()
        .map(|(name, bytes)| {
            (
                name.into(),
                cadence::store::Observed {
                    bytes: Some(bytes),
                    identity: "fixture".into(),
                    directory_identity: "fixture".into(),
                },
            )
        })
        .collect(),
    );
    Session {
        root: "/fixture/project/.planning".into(),
        store: Store::open(memory, Allow).await.unwrap(),
        config: Arc::new(Mutex::new(Reload::new(
            active,
            SuppliedConfig(BTreeMap::new()),
        ))),
        manifest,
    }
}

#[tokio::test]
async fn session_rewrite_returns_preserved_source_evidence() {
    let session = snapshot_session().await;
    assert_eq!(
        session
            .request(Operation::RewriteSnapshot(json!({"answer":13})))
            .await
            .map(|view| (
                view.snapshot.generation,
                view.snapshot.data["source_evidence"].clone(),
                view.snapshot.data["current"].clone(),
                view.snapshot.data["unrelated"].clone()
            )),
        Ok((
            8,
            json!([{"preserved":[1,null]}]),
            json!({"answer":13}),
            json!({"keep":true})
        ))
    );
}

#[tokio::test]
async fn session_transaction_snapshot_returns_preserved_source_evidence() {
    let session = snapshot_session().await;
    assert_eq!(
        session
            .request(Operation::Transact(Transaction {
                id: "snapshot-input".into(),
                items: vec![],
                decisions: vec![],
                snapshot: Some(json!({"answer":13})),
                external: vec![],
            }))
            .await
            .map(|view| (
                view.snapshot.generation,
                view.snapshot.data["source_evidence"].clone(),
                view.snapshot.data["current"].clone()
            )),
        Ok((8, json!([{"preserved":[1,null]}]), json!({"answer":13})))
    );
}

#[tokio::test]
async fn session_conditional_rewrite_returns_exact_stale_generation_refusal() {
    let session = snapshot_session().await;
    assert_eq!(
        session
            .request(Operation::CompareRewriteSnapshot {
                expected_generation: 6,
                expected_integrity: "stale-generation".into(),
                data: json!({"answer":13}),
            })
            .await,
        Err(Error::Conflict(
            "conditional snapshot precondition changed".into()
        ))
    );
}
