use super::{
    CadenceServer,
    derivation_service::{Driver, Event},
};
use crate::import::{Session, SessionFactory};
use cadence::{
    derivation::*,
    store::{
        self,
        writer::{Operation, View},
    },
};
use serde_json::{Value, json};
use std::{
    collections::BTreeMap,
    path::{Path, PathBuf},
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
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
    std::fs::create_dir_all(root.path().join("phases/1")).unwrap();
    std::fs::write(
        root.path().join("ROADMAP.md"),
        "## Phases\n- [ ] **Phase 1: One**\n",
    )
    .unwrap();
    std::fs::write(
        root.path().join("STATE.md"),
        "Phase: 1 of 1 (One)\nStatus: unplanned\nNext:  exact retained next\nUpdated: 2026-09-06\n",
    )
    .unwrap();
    root
}
fn tree(root: &Path) -> BTreeMap<PathBuf, Vec<u8>> {
    fn visit(root: &Path, path: &Path, out: &mut BTreeMap<PathBuf, Vec<u8>>) {
        for entry in std::fs::read_dir(path).unwrap() {
            let path = entry.unwrap().path();
            if path.is_dir() {
                visit(root, &path, out);
            } else {
                out.insert(
                    path.strip_prefix(root).unwrap().into(),
                    std::fs::read(path).unwrap(),
                );
            }
        }
    }
    let mut out = BTreeMap::new();
    visit(root, root, &mut out);
    out
}
async fn replace(session: &Session, data: Value) -> View {
    let before = session.derivation_view().await.unwrap();
    session
        .request(Operation::CompareRewriteSnapshot {
            expected_generation: before.snapshot.generation,
            expected_integrity: before.snapshot.integrity,
            data,
        })
        .await
        .unwrap()
}
fn cursor(status: &str, total: u64) -> Value {
    json!({"available":true,"phase":1,"total":total,"name":"One","status":status,"next":"  exact next  ","updated":"2026-09-06","original_fields":{"phase":format!("1 of {total} (One)"),"status":status,"next":"  exact next  ","updated":"2026-09-06","extra":"preserved"}})
}

#[derive(Clone, Copy)]
enum Inject {
    None,
    Uat,
    Summary,
    Read,
    List,
    Probe,
    Root,
}
struct Artifacts {
    files: ArtifactFiles,
    round: usize,
    injection: Inject,
    captures: Arc<AtomicUsize>,
}
impl Artifacts {
    fn denied<T>(&self, path: &Path) -> Observation<T> {
        Observation::Failed(InputFailure {
            path: path.into(),
            category: InputFailureCategory::PermissionDenied,
            diagnostic: Some("injected denial".into()),
        })
    }
}
impl ArtifactIo for Artifacts {
    fn resolve_root(&mut self, selected: &Path) -> Result<PathBuf, InputFailure> {
        self.round += 1;
        self.captures.fetch_add(1, Ordering::SeqCst);
        if self.round == 2 {
            match self.injection {
                Inject::Uat => std::fs::write(
                    selected.join("phases/1/UAT.md"),
                    "### 1. Changed\nstatus: pending",
                )
                .unwrap(),
                Inject::Summary => {
                    std::fs::write(selected.join("phases/1/SUMMARY.md"), "").unwrap()
                }
                _ => {}
            }
        }
        self.files.resolve_root(selected)
    }
    fn probe_root(&mut self, path: &Path) -> Observation<()> {
        if self.round == 2 && matches!(self.injection, Inject::Root) {
            self.denied(path)
        } else {
            self.files.probe_root(path)
        }
    }
    fn list_phase(&mut self, path: &Path) -> Observation<Vec<String>> {
        if self.round == 2 && matches!(self.injection, Inject::List) {
            self.denied(path)
        } else {
            self.files.list_phase(path)
        }
    }
    fn probe_summary(&mut self, path: &Path) -> Observation<()> {
        if self.round == 2 && matches!(self.injection, Inject::Probe) {
            self.denied(path)
        } else {
            self.files.probe_summary(path)
        }
    }
    fn read(&mut self, path: &Path) -> Observation<Vec<u8>> {
        if self.round == 2 && matches!(self.injection, Inject::Read) && path.ends_with("UAT.md") {
            self.denied(path)
        } else {
            self.files.read(path)
        }
    }
}
fn driver(injection: Inject, captures: Arc<AtomicUsize>, derived: Arc<AtomicUsize>) -> Driver {
    Driver {
        artifacts: Arc::new(move || {
            Box::new(Artifacts {
                files: ArtifactFiles,
                round: 0,
                injection,
                captures: captures.clone(),
            })
        }),
        event: Arc::new(move |event| {
            if event == Event::Derived {
                derived.fetch_add(1, Ordering::SeqCst);
            }
        }),
        ..Driver::default()
    }
}

#[test]
fn query_guards_reobserve_changes_denials_and_fresh_hit_without_write() {
    runtime().block_on(async {
        let root = fixture();
        let f = factory();
        let session = f.first_touch(root.path()).await.unwrap();
        let captures = Arc::new(AtomicUsize::new(0));
        let derives = Arc::new(AtomicUsize::new(0));
        let server = CadenceServer::with_derivation_driver(
            f,
            driver(Inject::None, captures.clone(), derives.clone()),
        );
        let fresh = server.lifecycle(root.path()).await.unwrap();
        let stored = session.derivation_view().await.unwrap();
        let bytes = tree(root.path());
        assert_eq!(server.lifecycle(root.path()).await.unwrap(), fresh);
        assert_eq!(captures.load(Ordering::SeqCst), 4);
        assert_eq!(derives.load(Ordering::SeqCst), 2);
        assert_eq!(session.derivation_view().await.unwrap(), stored);
        assert_eq!(tree(root.path()), bytes);
        for injection in [
            Inject::Uat,
            Inject::Summary,
            Inject::Read,
            Inject::List,
            Inject::Probe,
            Inject::Root,
        ] {
            let other = fixture();
            let f = factory();
            let session = f.first_touch(other.path()).await.unwrap();
            // Initialize memo before measuring refusal; import is a separate operation.
            super::derivation_service::query(&f, other.path(), &Driver::default())
                .await
                .unwrap();
            let before = session.derivation_view().await.unwrap();
            let guarded = CadenceServer::with_derivation_driver(
                f,
                driver(
                    injection,
                    Arc::new(AtomicUsize::new(0)),
                    Arc::new(AtomicUsize::new(0)),
                ),
            );
            let error = guarded.lifecycle(other.path()).await.unwrap_err();
            match injection {
                Inject::Uat | Inject::Summary => assert_eq!(error, DerivationError::InputsChanged),
                _ => {
                    let DerivationError::InputFailure(failure) = error else {
                        panic!("{error:?}")
                    };
                    assert_eq!(failure.category, InputFailureCategory::PermissionDenied);
                    let relative = match injection {
                        Inject::Read => "phases/1/UAT.md",
                        Inject::List => "phases/1",
                        Inject::Probe => "phases/1/SUMMARY.md",
                        _ => "",
                    };
                    assert_eq!(failure.path, other.path().join(relative));
                }
            }
            assert_eq!(session.derivation_view().await.unwrap(), before);
            assert!(!other.path().join(store::transaction::INTENT).exists());
        }
        let missing = root.path().join("absent");
        assert!(matches!(
            server.lifecycle(&missing).await,
            Err(DerivationError::MissingPlanningRoot { .. })
        ));
        assert!(!missing.exists());
    });
}

#[test]
fn query_guards_cold_warm_declarations_and_retired_cursor_advance() {
    runtime().block_on(async {
        for warm in [false, true] {
            for conflict in ["checked", "unchecked", "cursor", "closed-total"] {
                let root = fixture();
                let f = factory();
                let session = f.first_touch(root.path()).await.unwrap();
                let server = CadenceServer::with_factory(f);
                if warm {
                    server.lifecycle(root.path()).await.unwrap();
                }
                let mut data = session.derivation_view().await.unwrap().snapshot.data;
                data["cursor"] = cursor("unplanned", 1);
                if let Some(d) = data.get_mut("derivation").and_then(Value::as_object_mut) {
                    d.remove("intake");
                }
                match conflict {
                    "checked" => std::fs::write(
                        root.path().join("ROADMAP.md"),
                        "## Phases\n- [x] **Phase 1: One**\n",
                    )
                    .unwrap(),
                    "unchecked" => {
                        std::fs::write(root.path().join("phases/1/SUMMARY.md"), "").unwrap();
                        std::fs::write(
                            root.path().join("phases/1/UAT.md"),
                            "### 1. Done\nstatus: pass",
                        )
                        .unwrap();
                    }
                    "cursor" => data["cursor"] = cursor("planned", 1),
                    _ => {
                        std::fs::write(root.path().join("ROADMAP.md"), "## Phases\n").unwrap();
                        data["cursor"] = cursor("paused", 1);
                    }
                }
                replace(&session, data).await;
                let bytes = tree(root.path());
                let error = server.lifecycle(root.path()).await.unwrap_err();
                let DerivationError::StateConflict {
                    source,
                    declared,
                    derived,
                    ..
                } = error
                else {
                    panic!("{error:?}")
                };
                assert!(
                    source.starts_with(if matches!(conflict, "checked" | "unchecked") {
                        "ROADMAP.md:"
                    } else {
                        "data.cursor"
                    })
                );
                assert_ne!(declared, derived);
                assert_eq!(tree(root.path()), bytes, "{warm} {conflict}");
                std::fs::write(
                    root.path().join("ROADMAP.md"),
                    "## Phases\n- [ ] **Phase 1: One**\n",
                )
                .unwrap();
                for name in ["SUMMARY.md", "UAT.md"] {
                    let _ = std::fs::remove_file(root.path().join("phases/1").join(name));
                }
                let mut data = session.derivation_view().await.unwrap().snapshot.data;
                data["cursor"] = cursor("unplanned", 1);
                replace(&session, data).await;
                assert_eq!(
                    server.lifecycle(root.path()).await.unwrap().phases[0].status,
                    LifecycleStatus::Unplanned
                );
                let adopted = session.derivation_view().await.unwrap();
                std::fs::write(root.path().join("phases/1/PLAN.md"), "").unwrap();
                assert_eq!(
                    server.lifecycle(root.path()).await.unwrap().phases[0].status,
                    LifecycleStatus::Planned
                );
                let advanced = session.derivation_view().await.unwrap();
                assert_eq!(
                    advanced.snapshot.data["cursor"],
                    adopted.snapshot.data["cursor"]
                );
                assert_eq!(
                    advanced.snapshot.data["derivation"]["intake"],
                    adopted.snapshot.data["derivation"]["intake"]
                );
            }
        }
    });
}

#[test]
fn query_guards_stale_publication_and_store_config_errors_remain_distinct() {
    let rt = runtime();
    let root = fixture();
    let f = factory();
    let session = rt.block_on(f.first_touch(root.path())).unwrap();
    let handle = rt.handle().clone();
    let other = session.clone();
    let driver = Driver {
        event: Arc::new(move |event| {
            if event == Event::BeforeCommit {
                handle.block_on(async {
                    let mut data = other.derivation_view().await.unwrap().snapshot.data;
                    data["intervening"] = json!(true);
                    replace(&other, data).await;
                });
            }
        }),
        ..Driver::default()
    };
    let server = rt.block_on(async { CadenceServer::with_derivation_driver(f, driver) });
    assert_eq!(
        rt.block_on(server.lifecycle(root.path())),
        Err(DerivationError::InputsChanged)
    );
    let winner = rt.block_on(session.derivation_view()).unwrap();
    assert_eq!(winner.snapshot.data["intervening"], true);
    assert!(winner.snapshot.data.get("derivation").is_none());
    std::fs::write(&session.import_manifest().active.repo, "invalid config").unwrap();
    assert!(matches!(
        rt.block_on(server.lifecycle(root.path())),
        Err(DerivationError::Store { .. })
    ));
}

fn process_fixture() -> tempfile::TempDir {
    let root = fixture();
    std::fs::create_dir_all(root.path().join("phases/2")).unwrap();
    std::fs::write(
        root.path().join("ROADMAP.md"),
        "## Phases\n- [ ] **Phase 1: One**\n- [ ] **Phase 2: Two**\n",
    )
    .unwrap();
    std::fs::write(
        root.path().join("STATE.md"),
        "Phase: 1 of 2 (One)\nStatus: planned\nNext: /cad-exec 1 --exact\nUpdated: 2026-09-06\n",
    )
    .unwrap();
    for name in ["PLAN.md", "PLAN-1.md"] {
        std::fs::write(root.path().join("phases/1").join(name), "").unwrap();
    }
    std::fs::write(
        root.path().join("phases/1/UAT.md"),
        "### 1. Check\nstatus: skipped\nreason: later",
    )
    .unwrap();
    root
}
fn production_key(root: &Path) -> String {
    input_key(&capture_inputs(root, &mut ArtifactFiles).unwrap()).unwrap()
}
fn corrupt_memo(raw: &mut Value, case: &str) -> &'static str {
    match case {
        "cycle" => {
            raw["answer"]["cycle"] = json!("closed");
            "cycle"
        }
        "current" => {
            raw["answer"]["current"] = Value::Null;
            "current"
        }
        "total" => {
            raw["answer"]["total"] = json!(3);
            "total"
        }
        "id" => {
            raw["answer"]["phases"][1]["id"] = json!(3.0);
            "phases[1].id"
        }
        "name" => {
            raw["answer"]["phases"][0]["name"] = json!("corrupted");
            "phases[0].name"
        }
        "plans" => {
            raw["answer"]["phases"][0]["plans"]
                .as_array_mut()
                .unwrap()
                .reverse();
            "phases[0].plans"
        }
        "phases" => {
            raw["answer"]["phases"].as_array_mut().unwrap().reverse();
            "phases[0].id"
        }
        "status" => {
            raw["answer"]["phases"][0]["status"] = json!("executed");
            "phases[0].status"
        }
        "uat-none" => {
            raw["answer"]["phases"][0]["uat"] = Value::Null;
            "phases[0].uat"
        }
        "uat-zero" => {
            raw["answer"]["phases"][1]["uat"] =
                json!({"pass":0,"fail":0,"pending":0,"skipped":0,"blocked":0});
            "phases[1].uat"
        }
        "pass" | "fail" | "pending" | "skipped" | "blocked" => {
            raw["answer"]["phases"][0]["uat"][case] = json!(9);
            match case {
                "pass" => "phases[0].uat.pass",
                "fail" => "phases[0].uat.fail",
                "pending" => "phases[0].uat.pending",
                "skipped" => "phases[0].uat.skipped",
                _ => "phases[0].uat.blocked",
            }
        }
        "null" => {
            *raw = Value::Null;
            "encoding_version"
        }
        "missing-answer" => {
            raw.as_object_mut().unwrap().remove("answer");
            "answer"
        }
        "missing-current" => {
            raw["answer"].as_object_mut().unwrap().remove("current");
            "current"
        }
        "bad-status" => {
            raw["answer"]["phases"][0]["status"] = json!("paused");
            "phases[0].status"
        }
        "bad-hash" => {
            raw["input_hash"] = json!("invalid");
            "input_hash"
        }
        _ => panic!("unknown corruption {case}"),
    }
}

#[test]
fn ac4_child() {
    let Ok(root) = std::env::var("CADENCE_DERIVATION_CHILD_ROOT") else {
        return;
    };
    let root = PathBuf::from(root);
    let mode = std::env::var("CADENCE_DERIVATION_CHILD_MODE").unwrap();
    let output = runtime().block_on(async {
        let f = factory();
        let session = f.first_touch(&root).await.unwrap();
        if mode == "seed" {
            let before = session.derivation_view().await.unwrap();
            let mut data = before.snapshot.data.clone();
            let case = std::env::var("CADENCE_DERIVATION_CORRUPTION").unwrap();
            let field = corrupt_memo(&mut data["derivation"]["memo"], &case);
            let view = session.commit_derivation(&before, data).await.unwrap();
            let bytes = std::fs::read(root.join(store::model::STATE)).unwrap();
            let snapshot = store::model::Snapshot::parse(&bytes, &std::fs::read(root.join(store::model::ITEMS)).unwrap(), &std::fs::read(root.join(store::model::DECISIONS)).unwrap()).unwrap();
            assert_eq!(snapshot, view.snapshot);
            return json!({"field":field,"data":view.snapshot.data});
        }
        let mut driver = Driver::default();
        if mode == "bypass" { driver.compare = |_, _, _| Ok(MemoDisposition::Hit); }
        let server = CadenceServer::with_derivation_driver(f, driver);
        let key_before = production_key(&root);
        let result = server.lifecycle(&root).await;
        assert_eq!(production_key(&root), key_before, "a memo write must not change its own key");
        let view = session.derivation_view().await.unwrap();
        json!({"result":result,"data":view.snapshot.data,"generation":view.snapshot.generation,"key":key_before})
    });
    println!("DERIVATION_RESULT {output}");
}
fn child(root: &Path, mode: &str, case: &str) -> Value {
    let output = std::process::Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "server::derivation_service_tests::ac4_child",
            "--nocapture",
        ])
        .env("CADENCE_DERIVATION_CHILD_ROOT", root)
        .env("CADENCE_DERIVATION_CHILD_MODE", mode)
        .env("CADENCE_DERIVATION_CORRUPTION", case)
        .stdin(std::process::Stdio::null())
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8(output.stdout).unwrap();
    serde_json::from_str(
        stdout
            .lines()
            .find_map(|line| line.strip_prefix("DERIVATION_RESULT "))
            .unwrap(),
    )
    .unwrap()
}

#[test]
fn ac4_fresh_process_equality_invalidation_and_cursor_history() {
    let root = process_fixture();
    let key = production_key(root.path());
    let first = child(root.path(), "query", "");
    assert!(first["result"].get("Ok").is_some());
    assert_eq!(first["key"], key);
    assert_eq!(
        first["data"]["derivation"]["memo"]["answer"],
        first["result"]["Ok"]
    );
    let bytes = tree(root.path());
    let second = child(root.path(), "query", "");
    assert_eq!(first, second);
    assert_eq!(tree(root.path()), bytes);
    assert_eq!(
        first["data"]["derivation"]["intake"]["original_cursor"],
        first["data"]["cursor"]
    );
    assert_eq!(first["data"]["derivation"]["intake"]["retired"], true);
    assert_eq!(first["data"]["cursor"]["next"], "/cad-exec 1 --exact");
    std::fs::write(root.path().join("phases/1/SUMMARY.md"), "").unwrap();
    std::fs::write(
        root.path().join("ROADMAP.md"),
        "## Phases\n- [x] **Phase 1: One**\n- [ ] **Phase 2: Two**\n",
    )
    .unwrap();
    let third = child(root.path(), "query", "");
    assert_ne!(third["key"], first["key"]);
    assert_eq!(third["result"]["Ok"]["current"], 2.0);
    assert_eq!(third["result"]["Ok"]["phases"][0]["status"], "complete");
    assert_eq!(third["data"]["cursor"], first["data"]["cursor"]);
    assert_eq!(
        third["data"]["derivation"]["intake"],
        first["data"]["derivation"]["intake"]
    );
    assert_eq!(
        third["generation"].as_u64(),
        first["generation"].as_u64().map(|g| g + 1)
    );
}

#[test]
fn ac4_integritied_corruption_and_malformed_memos_refuse_without_repair() {
    for case in [
        "cycle",
        "current",
        "total",
        "id",
        "name",
        "plans",
        "phases",
        "status",
        "uat-none",
        "uat-zero",
        "pass",
        "fail",
        "pending",
        "skipped",
        "blocked",
        "null",
        "missing-answer",
        "missing-current",
        "bad-status",
        "bad-hash",
    ] {
        let root = process_fixture();
        let first = child(root.path(), "query", "");
        let seeded = child(root.path(), "seed", case);
        let bytes = tree(root.path());
        let refused = child(root.path(), "query", "");
        let error: DerivationError =
            serde_json::from_value(refused["result"]["Err"].clone()).unwrap();
        assert_eq!(error.code(), "derivation-conflict", "{case}");
        let DerivationError::DerivationConflict {
            requested_hash,
            stored_hash,
            fields,
        } = error
        else {
            unreachable!()
        };
        assert_eq!(requested_hash, first["key"].as_str().unwrap());
        assert_eq!(
            stored_hash.as_deref(),
            seeded["data"]["derivation"]["memo"]["input_hash"].as_str()
        );
        assert!(
            fields
                .iter()
                .any(|field| Some(field.as_str()) == seeded["field"].as_str()),
            "{case}: {fields:?}"
        );
        assert_eq!(tree(root.path()), bytes, "{case}");
        assert!(!root.path().join(store::transaction::INTENT).exists());
        // Same stored fixtures, valid integrity, deliberately omitted comparison.
        let bypass = child(root.path(), "bypass", "");
        assert!(
            bypass["result"].get("Ok").is_some(),
            "negative control did not bypass {case}"
        );
        assert!(bypass["result"].get("Err").is_none());
        assert_eq!(tree(root.path()), bytes);
    }
}

struct ReorderedFiles(ArtifactFiles);
impl ArtifactIo for ReorderedFiles {
    fn resolve_root(&mut self, path: &Path) -> Result<PathBuf, InputFailure> {
        self.0.resolve_root(path)
    }
    fn probe_root(&mut self, path: &Path) -> Observation<()> {
        self.0.probe_root(path)
    }
    fn probe_summary(&mut self, path: &Path) -> Observation<()> {
        self.0.probe_summary(path)
    }
    fn read(&mut self, path: &Path) -> Observation<Vec<u8>> {
        self.0.read(path)
    }
    fn list_phase(&mut self, path: &Path) -> Observation<Vec<String>> {
        match self.0.list_phase(path) {
            Observation::Present(mut names) => {
                names.reverse();
                Observation::Present(names)
            }
            other => other,
        }
    }
}

#[test]
fn ac3_exclusions_real_files_metadata_order_snapshot_and_positive_controls() {
    let rt = runtime();
    let root = process_fixture();
    let f = factory();
    let session = rt.block_on(f.first_touch(root.path())).unwrap();
    let server = rt.block_on(async { CadenceServer::with_factory(f) });
    rt.block_on(server.lifecycle(root.path())).unwrap();
    let key = production_key(root.path());
    let reordered = capture_inputs(root.path(), &mut ReorderedFiles(ArtifactFiles)).unwrap();
    assert_eq!(input_key(&reordered).unwrap(), key);
    let uat = root.path().join("phases/1/UAT.md");
    let old_time = std::fs::metadata(&uat).unwrap().modified().unwrap();
    std::fs::File::open(&uat)
        .unwrap()
        .set_times(
            std::fs::FileTimes::new()
                .set_modified(std::time::UNIX_EPOCH + std::time::Duration::from_secs(100)),
        )
        .unwrap();
    assert_ne!(
        std::fs::metadata(&uat).unwrap().modified().unwrap(),
        old_time
    );
    assert_eq!(production_key(root.path()), key, "mtime only");
    for name in ["PLAN.md", "PLAN-1.md"] {
        std::fs::write(
            root.path().join("phases/1").join(name),
            "body changed, existence retained",
        )
        .unwrap();
        assert_eq!(production_key(root.path()), key, "{name} body");
    }
    let summary = root.path().join("phases/1/SUMMARY.md");
    std::fs::write(&summary, "").unwrap();
    let summary_key = production_key(root.path());
    assert_ne!(summary_key, key, "SUMMARY presence");
    std::fs::write(&summary, "new body").unwrap();
    assert_eq!(production_key(root.path()), summary_key, "SUMMARY body");
    std::fs::remove_file(&summary).unwrap();
    let uat_bytes = std::fs::read(&uat).unwrap();
    std::fs::write(&uat, "### 1. Check\nstatus: skipped\nreason: different").unwrap();
    assert_ne!(production_key(root.path()), key, "UAT reason bytes");
    std::fs::write(&uat, uat_bytes).unwrap();
    for name in [
        "STATE.md",
        "REQUIREMENTS.md",
        "DEFERRED.md",
        "ADJUDICATION.md",
        "TRACE.md",
        "trace/events.jsonl",
        ".git/HEAD",
        ".git/config",
        "config.json",
        "config.v4.json",
        "CONTEXT.md",
        "phases/1/CONTEXT.md",
        "phases/1/REPORT.md",
        "phases/1/REPORT-1.md",
        "phases/1/DEFERRED.md",
        "phases/1/ADJUDICATION.md",
        "phases/1/notes.txt",
        "phases/1/PLAN-x.md",
    ] {
        let path = root.path().join(name);
        let prior = std::fs::read(&path).ok();
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, format!("excluded edit: {name}")).unwrap();
        assert_eq!(production_key(root.path()), key, "excluded {name}");
        if let Some(prior) = prior {
            std::fs::write(&path, prior).unwrap();
        } else {
            std::fs::remove_file(&path).unwrap();
        }
    }
    for field in [
        "unrelated",
        "current",
        "source_evidence",
        "archive",
        "cursor",
    ] {
        let path = root.path().join("state.json");
        let before = std::fs::read(&path).unwrap();
        let mut snapshot: Value = serde_json::from_slice(&before).unwrap();
        snapshot["data"][field] = json!({"excluded":"changed"});
        std::fs::write(&path, serde_json::to_vec(&snapshot).unwrap()).unwrap();
        assert_eq!(production_key(root.path()), key, "snapshot {field}");
        std::fs::write(path, before).unwrap();
    }
    let before = rt.block_on(session.derivation_view()).unwrap();
    let mut data = before.snapshot.data.clone();
    data["cursor"] = cursor("executed", 2);
    rt.block_on(replace(&session, data));
    assert_eq!(production_key(root.path()), key);
    assert!(matches!(
        rt.block_on(server.lifecycle(root.path())),
        Err(DerivationError::StateConflict { .. })
    ));
    rt.block_on(replace(&session, before.snapshot.data));
    std::fs::write(
        &session.import_manifest().active.repo,
        "invalid controlling config",
    )
    .unwrap();
    assert_eq!(production_key(root.path()), key);
    assert!(matches!(
        rt.block_on(server.lifecycle(root.path())),
        Err(DerivationError::Store { .. })
    ));
}

#[test]
fn ac3_exclusions_failed_captures_never_create_success_memos() {
    runtime().block_on(async {
        for injection in [Inject::Read, Inject::List, Inject::Probe, Inject::Root] {
            let root = fixture();
            let f = factory();
            let session = f.first_touch(root.path()).await.unwrap();
            let before = tree(root.path());
            let server = CadenceServer::with_derivation_driver(
                f,
                driver(
                    injection,
                    Arc::new(AtomicUsize::new(0)),
                    Arc::new(AtomicUsize::new(0)),
                ),
            );
            assert!(matches!(
                server.lifecycle(root.path()).await,
                Err(DerivationError::InputFailure(_))
            ));
            assert!(
                session
                    .derivation_view()
                    .await
                    .unwrap()
                    .snapshot
                    .data
                    .get("derivation")
                    .is_none()
            );
            assert_eq!(tree(root.path()), before);
        }
    });
}

#[test]
fn memo_ack_installed_memo_does_not_acknowledge_before_confirmation() {
    use std::sync::{Mutex, atomic::AtomicBool};
    use store::filesystem::Stage;
    let rt = runtime();
    let root = fixture();
    let enabled = Arc::new(AtomicBool::new(false));
    let flag = enabled.clone();
    let (entered_tx, entered_rx) = std::sync::mpsc::channel();
    let (release_tx, release_rx) = std::sync::mpsc::channel();
    let release_rx = Mutex::new(release_rx);
    let f = factory().with_probe(Arc::new(move |stage, path| {
        if stage == Stage::Confirmation
            && path.ends_with(store::model::STATE)
            && flag.swap(false, Ordering::SeqCst)
        {
            entered_tx.send(()).unwrap();
            release_rx
                .lock()
                .unwrap()
                .recv_timeout(std::time::Duration::from_secs(10))
                .unwrap();
        }
        Ok(())
    }));
    let session = rt.block_on(f.first_touch(root.path())).unwrap();
    let before = rt.block_on(session.derivation_view()).unwrap();
    let server = rt.block_on(async { CadenceServer::with_factory(f) });
    enabled.store(true, Ordering::SeqCst);
    let task_root = root.path().to_path_buf();
    let caller = rt.spawn(async move { server.lifecycle(&task_root).await });
    entered_rx
        .recv_timeout(std::time::Duration::from_secs(5))
        .unwrap();
    assert!(!caller.is_finished());
    let installed: store::model::Snapshot =
        serde_json::from_slice(&std::fs::read(root.path().join(store::model::STATE)).unwrap())
            .unwrap();
    assert_eq!(installed.generation, before.snapshot.generation + 1);
    assert!(installed.data["derivation"]["memo"].is_object());
    assert_eq!(installed.data["derivation"]["intake"]["retired"], true);
    assert!(root.path().join(store::transaction::INTENT).exists());
    assert!(
        !caller.is_finished(),
        "installed data is not an acknowledgement"
    );
    release_tx.send(()).unwrap();
    assert!(rt.block_on(caller).unwrap().is_ok());
    assert!(!root.path().join(store::transaction::INTENT).exists());
}

#[test]
fn memo_ack_either_fsync_failure_refuses_and_installed_generation_can_recover() {
    use std::sync::atomic::AtomicBool;
    use store::filesystem::Stage;
    for failure in [Stage::TemporarySync, Stage::DirectorySync] {
        let root = fixture();
        let rt = runtime();
        let enabled = Arc::new(AtomicBool::new(false));
        let flag = enabled.clone();
        let renamed = AtomicBool::new(false);
        let f = factory().with_probe(Arc::new(move |stage, path| {
            if flag.load(Ordering::SeqCst) {
                if stage == Stage::Renamed && path.ends_with(store::model::STATE) {
                    renamed.store(true, Ordering::SeqCst);
                }
                let state_temporary = path
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .starts_with(".state.json.");
                if stage == failure
                    && ((failure == Stage::TemporarySync && state_temporary)
                        || (failure == Stage::DirectorySync && renamed.load(Ordering::SeqCst)))
                {
                    return Err(store::Error::Io(format!("injected {failure:?}")));
                }
            }
            Ok(())
        }));
        let session = rt.block_on(f.first_touch(root.path())).unwrap();
        let server = rt.block_on(async { CadenceServer::with_factory(f) });
        enabled.store(true, Ordering::SeqCst);
        let error = rt.block_on(server.lifecycle(root.path())).unwrap_err();
        assert!(
            matches!(error, DerivationError::Store { ref kind, ref detail } if kind == "io" && detail.contains(&format!("{failure:?}")))
        );
        let snapshot: Value =
            serde_json::from_slice(&std::fs::read(root.path().join(store::model::STATE)).unwrap())
                .unwrap();
        if failure == Stage::DirectorySync {
            assert!(
                snapshot["data"]["derivation"]["memo"].is_object(),
                "exercise installed but unacknowledged data"
            );
            assert!(root.path().join(store::transaction::INTENT).exists());
        } else {
            assert!(snapshot["data"].get("derivation").is_none());
        }
        drop(session);
        drop(server);
        drop(rt);
        let recovered = child(root.path(), "query", "");
        assert!(recovered["result"].get("Ok").is_some());
        assert!(!root.path().join(store::transaction::INTENT).exists());
    }
}
