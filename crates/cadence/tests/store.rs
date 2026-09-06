use cadence::store::filesystem::{Filesystem, Stage};
use cadence::store::model::{Disposition, Evidence, ItemRecord, Origin, VERSION};
use cadence::store::writer::{Operation, Store};
use cadence::store::{Error, MutationContext, Policy, Result};
use std::process::{Command, Stdio};

struct Allow;
impl Policy for Allow {
    fn validate(&mut self, _: &MutationContext<'_>) -> Result<()> {
        Ok(())
    }
}
fn item(id: &str) -> ItemRecord {
    ItemRecord {
        version: VERSION,
        id: id.into(),
        revision: 1,
        origin: Origin {
            source: "test".into(),
            original: Evidence::Missing,
        },
        text: id.into(),
        kind: "todo".into(),
        disposition: Disposition::Captured,
        completed: false,
        filing_uncertain: false,
    }
}
fn runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Runtime::new().unwrap()
}

#[test]
fn subprocess_driver() {
    let Ok(root) = std::env::var("CADENCE_STORE_CHILD_ROOT") else {
        return;
    };
    runtime().block_on(async {
        let store = Store::open(Filesystem::new(root).unwrap(), Allow)
            .await
            .unwrap();
        if std::env::var("CADENCE_STORE_CHILD_MODE").unwrap() == "write" {
            store
                .request(Operation::AppendItem(item("first")))
                .await
                .unwrap();
            store
                .request(Operation::AppendItem(item("second")))
                .await
                .unwrap();
            store
                .request(Operation::RewriteSnapshot(
                    serde_json::json!({"cursor":[3,1],"exact":null}),
                ))
                .await
                .unwrap();
        } else {
            let view = store.request(Operation::Read).await.unwrap();
            assert_eq!(
                view.items.iter().map(|r| r.id.as_str()).collect::<Vec<_>>(),
                ["first", "second"]
            );
            assert_eq!(
                view.snapshot.data,
                serde_json::json!({"cursor":[3,1],"exact":null})
            );
        }
    });
}

#[test]
fn append_order_and_snapshot_survive_fresh_process() {
    let root = tempfile::tempdir().unwrap();
    for mode in ["write", "read"] {
        let result = Command::new(std::env::current_exe().unwrap())
            .args(["--exact", "subprocess_driver", "--nocapture"])
            .env("CADENCE_STORE_CHILD_ROOT", root.path())
            .env("CADENCE_STORE_CHILD_MODE", mode)
            .stdin(Stdio::null())
            .output()
            .unwrap();
        assert!(
            result.status.success(),
            "{}",
            String::from_utf8_lossy(&result.stderr)
        );
    }
}

#[test]
fn confirmation_holds_own_reply_and_cancellation_preserves_admitted_work() {
    let root = tempfile::tempdir().unwrap();
    let (entered_tx, entered_rx) = std::sync::mpsc::channel();
    let (release_tx, release_rx) = std::sync::mpsc::channel();
    let mut held = false;
    let fs = Filesystem::new(root.path())
        .unwrap()
        .with_probe(move |stage, _| {
            if stage == Stage::Confirmation && !held {
                held = true;
                entered_tx.send(()).unwrap();
                release_rx.recv().unwrap();
            }
            Ok(())
        });
    let rt = runtime();
    let store = rt.block_on(Store::open(fs, Allow)).unwrap();
    let cloned = store.clone();
    let caller = rt.spawn(async move { cloned.request(Operation::AppendItem(item("held"))).await });
    entered_rx
        .recv_timeout(std::time::Duration::from_secs(5))
        .unwrap();
    assert!(!caller.is_finished());
    caller.abort();
    release_tx.send(()).unwrap();
    let view = rt.block_on(store.request(Operation::Read)).unwrap();
    assert_eq!(view.items[0].id, "held");
}

#[test]
fn either_sync_failure_prevents_success() {
    for fail in [Stage::TemporarySync, Stage::DirectorySync] {
        let root = tempfile::tempdir().unwrap();
        let fs = Filesystem::new(root.path())
            .unwrap()
            .with_probe(move |stage, _| {
                if stage == fail {
                    Err(Error::Io(format!("injected {fail:?}")))
                } else {
                    Ok(())
                }
            });
        runtime().block_on(async {
            let store = Store::open(fs, Allow).await.unwrap();
            assert_eq!(
                store.request(Operation::AppendItem(item("fail"))).await,
                Err(Error::Io(format!("injected {fail:?}")))
            );
        });
    }
}

#[test]
fn concurrently_queued_callers_receive_distinct_outcomes() {
    struct RejectFirst(bool);
    impl Policy for RejectFirst {
        fn validate(&mut self, _: &MutationContext<'_>) -> Result<()> {
            if std::mem::take(&mut self.0) {
                Err(Error::Policy("first refused".into()))
            } else {
                Ok(())
            }
        }
    }
    let root = tempfile::tempdir().unwrap();
    runtime().block_on(async {
        let store = Store::open(Filesystem::new(root.path()).unwrap(), RejectFirst(true))
            .await
            .unwrap();
        let (first, second) = tokio::join!(
            store.request(Operation::AppendItem(item("one"))),
            store.request(Operation::AppendItem(item("two")))
        );
        assert_eq!(first, Err(Error::Policy("first refused".into())));
        assert_eq!(second.unwrap().items, [item("two")]);
    });
}

#[test]
fn declined_identity_is_absent_from_all_recall_outputs_after_restart() {
    use cadence::store::items::{ItemChange, RecallItems, revise};
    fn query(projection: RecallItems<'_>, term: &str) -> (usize, Vec<String>) {
        let snippets: Vec<String> = projection
            .iter()
            .filter(|r| r.text.contains(term))
            .map(|r| r.text.clone())
            .collect();
        (snippets.len(), snippets)
    }
    let root = tempfile::tempdir().unwrap();
    runtime().block_on(async {
        let store = Store::open(Filesystem::new(root.path()).unwrap(), Allow)
            .await
            .unwrap();
        let captured = item("unique-quasar");
        let view = store
            .request(Operation::AppendItem(captured.clone()))
            .await
            .unwrap();
        assert_eq!(
            query(view.recall_items(), "quasar"),
            (1, vec!["unique-quasar".into()])
        );
        let filed = revise(
            &captured,
            ItemChange::File {
                pointer: "GH-1".into(),
                uncertain: false,
            },
        )
        .unwrap();
        store
            .request(Operation::AppendItem(filed.clone()))
            .await
            .unwrap();
        let declined = revise(
            &filed,
            ItemChange::Decline {
                reason: "out of scope".into(),
            },
        )
        .unwrap();
        let view = store
            .request(Operation::AppendItem(declined.clone()))
            .await
            .unwrap();
        assert_eq!(query(view.recall_items(), "quasar"), (0, vec![]));
        assert_eq!(view.lookup_item(&captured.id), Some(&declined));
        drop(store);
        let reopened = Store::open(Filesystem::new(root.path()).unwrap(), Allow)
            .await
            .unwrap();
        let view = reopened.request(Operation::Read).await.unwrap();
        assert_eq!(query(view.recall_items(), "quasar"), (0, vec![]));
        assert_eq!(
            view.lookup_item(&captured.id).unwrap().disposition,
            Disposition::Declined {
                reason: "out of scope".into()
            }
        );
    });
}

#[test]
fn equal_prose_completion_and_guarded_uncertainty_preserve_identity() {
    use cadence::store::items::{ItemChange, mark_filing_uncertain, revise};
    let root = tempfile::tempdir().unwrap();
    runtime().block_on(async {
        let store = Store::open(Filesystem::new(root.path()).unwrap(), Allow)
            .await
            .unwrap();
        let first = item("first");
        let mut second = first.clone();
        second.id = "second".into();
        store
            .request(Operation::AppendItem(first.clone()))
            .await
            .unwrap();
        store.request(Operation::AppendItem(second)).await.unwrap();
        let completed = revise(&first, ItemChange::Complete).unwrap();
        let view = store
            .request(Operation::AppendItem(completed.clone()))
            .await
            .unwrap();
        assert_eq!(view.recall_items().iter().count(), 2);
        let filed = revise(
            &completed,
            ItemChange::File {
                pointer: "GH-42".into(),
                uncertain: false,
            },
        )
        .unwrap();
        store
            .request(Operation::AppendItem(filed.clone()))
            .await
            .unwrap();
        assert!(mark_filing_uncertain(&filed, false).unwrap().is_none());
        let uncertain = mark_filing_uncertain(&filed, true).unwrap().unwrap();
        assert_eq!(uncertain.id, first.id);
        assert_eq!(uncertain.disposition, filed.disposition);
        assert!(uncertain.completed);
        assert!(mark_filing_uncertain(&uncertain, true).unwrap().is_none());
        let view = store
            .request(Operation::AppendItem(uncertain))
            .await
            .unwrap();
        assert_eq!(view.recall_items().iter().count(), 2);
        assert!(view.lookup_item("first").unwrap().filing_uncertain);
    });
}

#[test]
fn durable_decisions_preserve_provenance_and_missing_receipts() {
    use cadence::store::model::{Decision, DecisionRecord};
    let root = tempfile::tempdir().unwrap();
    runtime().block_on(async {
        let store = Store::open(Filesystem::new(root.path()).unwrap(), Allow)
            .await
            .unwrap();
        for (id, effort) in [("blank", " \t"), ("unknown", "host-experimental")] {
            store
                .request(Operation::AppendDecision(DecisionRecord {
                    version: VERSION,
                    id: id.into(),
                    revision: 1,
                    origin: item("origin").origin,
                    decision: Decision::Routing {
                        choice: "worker-a".into(),
                        config_provenance: [("model".into(), Evidence::Text("user-global".into()))]
                            .into(),
                        requested_effort: Evidence::Text("high".into()),
                        observed_effort: Evidence::Text(effort.into()),
                        receipt: Evidence::Missing,
                    },
                }))
                .await
                .unwrap();
        }
        drop(store);
        let store = Store::open(Filesystem::new(root.path()).unwrap(), Allow)
            .await
            .unwrap();
        let view = store.request(Operation::Read).await.unwrap();
        assert_eq!(
            view.decisions
                .iter()
                .map(|r| r.id.as_str())
                .collect::<Vec<_>>(),
            ["blank", "unknown"]
        );
        for (index, record) in view.decisions.iter().enumerate() {
            let Decision::Routing {
                config_provenance,
                observed_effort,
                requested_effort,
                receipt,
                ..
            } = &record.decision
            else {
                panic!("routing expected")
            };
            assert_eq!(
                config_provenance["model"],
                Evidence::Text("user-global".into())
            );
            assert_eq!(*requested_effort, Evidence::Text("high".into()));
            assert_eq!(*receipt, Evidence::Missing);
            assert_eq!(
                *observed_effort,
                if index == 0 {
                    Evidence::Missing
                } else {
                    Evidence::Text("host-experimental".into())
                }
            );
        }
        let bytes = std::fs::read(root.path().join("decisions.jsonl")).unwrap();
        let lines: Vec<serde_json::Value> = cadence::store::model::parse_lines(&bytes).unwrap();
        assert!(lines[0]["decision"].get("observed_effort").is_none());
        assert!(lines.iter().all(|r| r["decision"].get("receipt").is_none()));
    });
}

#[test]
fn unsafe_store_or_policy_does_not_append_refusal() {
    struct Deny;
    impl Policy for Deny {
        fn validate(&mut self, _: &MutationContext<'_>) -> Result<()> {
            Err(Error::Policy("revoked".into()))
        }
    }
    let root = tempfile::tempdir().unwrap();
    runtime().block_on(async {
        let store = Store::open(Filesystem::new(root.path()).unwrap(), Deny)
            .await
            .unwrap();
        assert!(matches!(
            store.request(Operation::AppendItem(item("denied"))).await,
            Err(Error::Policy(_))
        ));
        assert_eq!(std::fs::read_dir(root.path()).unwrap().count(), 0);
        drop(store);
        std::fs::write(root.path().join("state.json"), b"foreign corrupted state").unwrap();
        assert!(
            Store::open(Filesystem::new(root.path()).unwrap(), Allow)
                .await
                .is_err()
        );
        assert_eq!(
            std::fs::read(root.path().join("state.json")).unwrap(),
            b"foreign corrupted state"
        );
        assert!(!root.path().join("decisions.jsonl").exists());
    });
}
