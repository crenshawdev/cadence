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
