use super::{
    CadenceServer,
    derivation_service::{Driver, Event},
    evidence_service::Command,
};
use crate::import::SessionFactory;
use cadence::{
    derivation::*,
    evidence::{
        self, Fact, Record, Scope,
        overrides::{Authorization, Meaning, Override},
    },
    store::writer::Operation,
};
use serde_json::json;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Arc,
};

fn runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Runtime::new().unwrap()
}
fn factory() -> SessionFactory {
    SessionFactory::new(None, Arc::new(|_, _| Ok(())))
}
fn fixture(states: &[LifecycleStatus]) -> tempfile::TempDir {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join(".planning");
    fs::create_dir_all(&root).unwrap();
    let mut roadmap = "## Phases\n".to_owned();
    for (i, status) in states.iter().enumerate() {
        let id = i + 1;
        roadmap.push_str(&format!(
            "- [{}] **Phase {id}: Work {id}**\n",
            if *status == LifecycleStatus::Complete {
                "x"
            } else {
                " "
            }
        ));
        let phase = root.join(format!("phases/{id}"));
        fs::create_dir_all(phase.join("reports")).unwrap();
        if *status != LifecycleStatus::Unplanned {
            fs::write(phase.join("PLAN.md"), "plan body").unwrap();
        }
        if matches!(
            status,
            LifecycleStatus::Executed | LifecycleStatus::Complete
        ) {
            fs::write(phase.join("SUMMARY.md"), "summary").unwrap();
            fs::write(phase.join("reports/plan-1.md"), "PLAN COMPLETE\n").unwrap();
        }
        if *status == LifecycleStatus::Complete {
            fs::write(phase.join("UAT.md"), "### 1. Check\nstatus: pass\n").unwrap();
        }
    }
    fs::write(root.join("ROADMAP.md"), roadmap).unwrap();
    temp
}
fn scope(root: &Path, occurrence: &str) -> Scope {
    Scope {
        project: root.parent().unwrap().to_string_lossy().into_owned(),
        planning_root: root.to_string_lossy().into_owned(),
        cycle: "v4".into(),
        occurrence: occurrence.into(),
        phase: "1".into(),
        plan: "PLAN.md".into(),
        report: "reports/plan-1.md".into(),
    }
}
fn pause_record(root: &Path, occurrence: &str) -> Record {
    Record {
        version: evidence::VERSION,
        scope: scope(root, occurrence),
        fact: Fact::Override(Override {
            id: "pause".into(),
            reason: "preserve current work".into(),
            authorization: Authorization::Invocation {
                id: "pause-request".into(),
                invocation: "pause".into(),
            },
            meaning: Meaning::PausedNext {
                sentence: "  verify the fix on the device  ".into(),
            },
        }),
    }
}
async fn submit(server: &CadenceServer, root: &Path, operation: &str, record: Record) {
    server
        .evidence(
            root,
            Command::Submit {
                operation_id: operation.into(),
                record: Box::new(record),
            },
        )
        .await
        .unwrap();
}
async fn instruction(server: &CadenceServer, root: &Path) -> String {
    server
        .next_action(root)
        .await
        .unwrap()
        .unwrap()
        .instruction()
}

#[test]
fn effective_config_changes_only_unplanned_and_unavailable_refuses() {
    runtime().block_on(async {
        let temp = fixture(&[LifecycleStatus::Unplanned]);
        let root = temp.path().join(".planning");
        let global = temp.path().join("global.json");
        fs::write(&global, r#"{"workflow":{"skip_discuss":true}}"#).unwrap();
        let f = SessionFactory::new(Some(global), Arc::new(|_, _| Ok(())));
        let session = f.first_touch(&root).await.unwrap();
        let active = session.import_manifest().active.repo.clone();
        let active_global = session.import_manifest().active.global.clone().unwrap();
        let server = CadenceServer::with_factory(f);
        assert_eq!(instruction(&server, &root).await, "/cad-plan 1");
        fs::write(&active, r#"{"workflow":{"skip_discuss":false}}"#).unwrap();
        assert_eq!(instruction(&server, &root).await, "/cad-context 1");
        fs::write(root.join("phases/1/PLAN.md"), "plan").unwrap();
        assert_eq!(instruction(&server, &root).await, "/cad-execute 1");
        fs::write(&active, r#"{"workflow":{"skip_discuss":true}}"#).unwrap();
        assert_eq!(instruction(&server, &root).await, "/cad-execute 1");
        fs::write(&active_global, "unavailable").unwrap();
        assert!(matches!(
            server.next_action(&root).await,
            Err(DerivationError::Store { .. })
        ));
    });
}

#[test]
fn native_pause_supersedes_retained_legacy_even_after_fulfillment() {
    runtime().block_on(async {
        let temp = fixture(&[LifecycleStatus::Planned]);
        let root = temp.path().join(".planning");
        fs::write(
            root.join("STATE.md"),
            "Phase: 1 of 1 (Work 1)\nStatus: paused\nNext: legacy resume\nUpdated: 2026-09-06\n",
        )
        .unwrap();
        let server = CadenceServer::with_factory(factory());
        assert_eq!(instruction(&server, &root).await, "legacy resume");
        assert_eq!(instruction(&server, &root).await, "legacy resume");
        submit(&server, &root, "pause", pause_record(&root, "run")).await;
        assert_eq!(
            instruction(&server, &root).await,
            "  verify the fix on the device  "
        );
        let end = Record {
            version: evidence::VERSION,
            scope: scope(&root, "run"),
            fact: Fact::Occurrence(evidence::authority::Occurrence::Fulfilled {
                completion: "done".into(),
            }),
        };
        submit(&server, &root, "finish", end).await;
        assert_eq!(instruction(&server, &root).await, "/cad-execute 1");
        let data = server
            .store(&root, Operation::Read)
            .await
            .unwrap()
            .snapshot
            .data;
        assert_eq!(data["cursor"]["next"], "legacy resume");
        assert_eq!(data["derivation"]["intake"]["retired"], true);
    });
}

#[test]
fn cold_and_warm_conflicts_survive_pause_and_override() {
    runtime().block_on(async {
        for warm in [false, true] {
            for memo in [false, true] {
                let temp = fixture(&[LifecycleStatus::Planned]);
                let root = temp.path().join(".planning");
                fs::write(root.join("STATE.md"), "Phase: 1 of 1 (Work 1)\nStatus: paused\nNext: legacy resume\nUpdated: 2026-09-06\n").unwrap();
                let f = factory();
                let session = f.first_touch(&root).await.unwrap();
                let server = CadenceServer::with_factory(f);
                submit(&server, &root, "pause", pause_record(&root, "run")).await;
                if warm { assert_eq!(instruction(&server, &root).await, "  verify the fix on the device  "); }
                if memo {
                    let capture = capture_inputs(&root, &mut ArtifactFiles).unwrap();
                    let mut bad = serde_json::to_value(LifecycleMemo::fresh(input_key(&capture).unwrap(), derive(&capture).unwrap())).unwrap();
                    bad["answer"]["phases"][0]["name"] = json!("wrong");
                    let before = session.derivation_view().await.unwrap();
                    let mut data = before.snapshot.data.clone();
                    if !data["derivation"].is_object() { data["derivation"] = json!({}); }
                    data["derivation"]["memo"] = bad;
                    session.commit_derivation(&before, data).await.unwrap();
                } else { fs::write(root.join("ROADMAP.md"), "## Phases\n- [x] **Phase 1: Work 1**\n").unwrap(); }
                let error = server.next_action(&root).await.unwrap_err();
                assert_eq!(error.code(), if memo { "derivation-conflict" } else { "state-conflict" });
            }
        }
    });
}

#[test]
fn consumed_report_config_store_and_lifecycle_changes_refuse_mixed_answer() {
    runtime().block_on(async {
        for change in ["report", "config", "store", "lifecycle"] {
            let temp = fixture(&[LifecycleStatus::Executed]);
            let root = temp.path().join(".planning");
            let f = factory();
            let session = f.first_touch(&root).await.unwrap();
            let task_root = root.clone();
            let driver = Driver {
                event: Arc::new(move |event| {
                    if event != Event::RoutingObserved {
                        return;
                    }
                    match change {
                        "report" => {
                            fs::write(task_root.join("phases/1/reports/plan-1.md"), "PLAN PARTIAL")
                                .unwrap()
                        }
                        "config" => fs::write(
                            &session.import_manifest().active.repo,
                            r#"{"workflow":{"skip_discuss":true}}"#,
                        )
                        .unwrap(),
                        "store" => tokio::runtime::Handle::current().block_on(async {
                            let before = session.derivation_view().await.unwrap();
                            let mut data = before.snapshot.data.clone();
                            data["changed"] = true.into();
                            session.commit_derivation(&before, data).await.unwrap();
                        }),
                        _ => fs::remove_file(task_root.join("phases/1/SUMMARY.md")).unwrap(),
                    }
                }),
                ..Driver::default()
            };
            let server = CadenceServer::with_derivation_driver(f, driver);
            assert!(
                matches!(
                    server.next_action(&root).await,
                    Err(DerivationError::InputsChanged)
                ),
                "{change}"
            );
        }
    });
}

struct Reordered(ArtifactFiles);
impl ArtifactIo for Reordered {
    fn resolve_root(&mut self, p: &Path) -> Result<PathBuf, InputFailure> {
        self.0.resolve_root(p)
    }
    fn probe_root(&mut self, p: &Path) -> Observation<()> {
        self.0.probe_root(p)
    }
    fn probe_summary(&mut self, p: &Path) -> Observation<()> {
        self.0.probe_summary(p)
    }
    fn read(&mut self, p: &Path) -> Observation<Vec<u8>> {
        self.0.read(p)
    }
    fn list_phase(&mut self, p: &Path) -> Observation<Vec<String>> {
        match self.0.list_phase(p) {
            Observation::Present(mut names) => {
                names.reverse();
                Observation::Present(names)
            }
            other => other,
        }
    }
}
#[test]
fn reordered_observations_preserve_lowest_planned_winner() {
    runtime().block_on(async {
        let temp = fixture(&[
            LifecycleStatus::Executed,
            LifecycleStatus::Planned,
            LifecycleStatus::Planned,
        ]);
        let root = temp.path().join(".planning");
        fs::write(root.join("phases/2/PLAN-2.md"), "second").unwrap();
        let server = CadenceServer::with_derivation_driver(
            factory(),
            Driver {
                artifacts: Arc::new(|| Box::new(Reordered(ArtifactFiles))),
                ..Driver::default()
            },
        );
        assert_eq!(instruction(&server, &root).await, "/cad-execute 2");
    });
}
