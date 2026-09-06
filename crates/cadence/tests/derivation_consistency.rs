use cadence::derivation::*;
use cadence::store::filesystem::Filesystem;
use cadence::store::model::{DECISIONS, ITEMS, STATE};
use cadence::store::writer::{Operation, Store};
use cadence::store::{MutationContext, Policy};
use serde_json::{Value, json};
use std::fs;
use std::path::Path;
use std::process::{Command, Stdio};

/// Fixture permission only; production publication and memo validity belong to PLAN-3.
struct FixturePolicy;
impl Policy for FixturePolicy {
    fn validate(&mut self, _: &MutationContext<'_>) -> cadence::store::Result<()> {
        Ok(())
    }
}

fn runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Runtime::new().unwrap()
}

fn opaque_memo() -> Value {
    json!({"fixture": "opaque accepted memo; no production key", "payload": [1, null, "exact"]})
}

fn cursor(word: &str, phase: u64, total: u64) -> Value {
    json!({"available":true, "phase":phase, "total":total, "name":"Three", "status":word,
        "next":"  /cad-resume 3 --literal=' a b '\t ", "updated":"2026-09-06",
        "original_fields":{"phase":format!("{phase} of {total} (Three)"), "status":word,
            "next":"  /cad-resume 3 --literal=' a b '\t ", "updated":"2026-09-06", "retained":null},
        "extension":{"untouched":true}})
}

fn data(word: &str) -> Value {
    json!({"cursor":cursor(word, 3, 4), "import":{"source":"fixture"},
        "source_evidence":["exact"], "archive":{"hold":null}, "unrelated":[false, 7]})
}

fn roadmap(root: &Path, advanced: bool) {
    fs::write(
        root.join("ROADMAP.md"),
        format!(
            "## Phases\n- [{}] **Phase 3: Three**\n- [ ] **Phase 4: Four**\n",
            if advanced { "x" } else { " " }
        ),
    )
    .unwrap();
}

fn advance(root: &Path) {
    fs::create_dir_all(root.join("phases/3")).unwrap();
    fs::write(root.join("phases/3/SUMMARY.md"), []).unwrap();
    fs::write(root.join("phases/3/UAT.md"), "### 1. Pass\nstatus: pass\n").unwrap();
    roadmap(root, true);
}

struct SnapshotIntake(IntakeObservation);
impl IntakeIo for SnapshotIntake {
    fn observe_intake(&mut self) -> Result<IntakeObservation, DerivationError> {
        Ok(self.0.clone())
    }
}

fn candidate(root: &Path, data: &Value) -> Result<RecheckedLifecycle, DerivationError> {
    let selected = select_intake(data)?;
    query_with_intake(
        root,
        &mut ArtifactFiles,
        &selected.cursor,
        &selected.observation,
        &mut SnapshotIntake(selected.observation.clone()),
    )
}

#[derive(Default)]
struct Calls {
    adoptions: usize,
    writes: usize,
}

async fn accept(
    store: &Store,
    root: &Path,
    data: &Value,
    calls: &mut Calls,
) -> Result<Value, DerivationError> {
    let candidate = candidate(root, data)?;
    calls.adoptions += 1;
    let next = adopt(data, opaque_memo(), candidate.intake().unwrap())?;
    calls.writes += 1;
    let persisted = store
        .request(Operation::RewriteSnapshot(next))
        .await
        .unwrap();
    Ok(persisted.snapshot.data)
}

fn store_bytes(root: &Path) -> Vec<Option<Vec<u8>>> {
    [ITEMS, DECISIONS, STATE]
        .into_iter()
        .map(|name| match fs::read(root.join(name)) {
            Ok(bytes) => Some(bytes),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
            Err(e) => panic!("{name}: {e}"),
        })
        .collect()
}

#[test]
fn subprocess_driver() {
    let Ok(root) = std::env::var("CADENCE_DERIVATION_CHILD_ROOT") else {
        return;
    };
    let root = Path::new(&root);
    let word = std::env::var("CADENCE_DERIVATION_CHILD_STATUS").unwrap();
    let mode = std::env::var("CADENCE_DERIVATION_CHILD_MODE").unwrap();
    runtime().block_on(async {
        let store = Store::open(Filesystem::new(root).unwrap(), FixturePolicy)
            .await
            .unwrap();
        let original = data(&word);
        if mode == "seed" {
            roadmap(root, false);
            store
                .request(Operation::RewriteSnapshot(original.clone()))
                .await
                .unwrap();
            let mut calls = Calls::default();
            let persisted = accept(&store, root, &original, &mut calls).await.unwrap();
            assert_eq!((calls.adoptions, calls.writes), (1, 1));
            assert_eq!(persisted["derivation"]["memo"], opaque_memo());
            assert_eq!(persisted["derivation"]["intake"]["retired"], true);
        } else {
            let persisted = store.request(Operation::Read).await.unwrap().snapshot.data;
            assert_eq!(persisted["cursor"], original["cursor"]);
            assert_eq!(
                persisted["cursor"]["original_fields"],
                original["cursor"]["original_fields"]
            );
            for key in ["import", "source_evidence", "archive", "unrelated"] {
                assert_eq!(persisted[key], original[key]);
            }
            assert_eq!(persisted["derivation"]["memo"], opaque_memo());
            let record: IntakeRecord =
                serde_json::from_value(persisted["derivation"]["intake"].clone()).unwrap();
            assert!(record.retired);
            assert_eq!(record.original_cursor, original["cursor"]);
            assert_eq!(
                record.normalized,
                normalize_imported_cursor(&original["cursor"]).unwrap()
            );
            assert_eq!(
                record.normalized.provenance().next.as_deref(),
                original["cursor"]["next"].as_str()
            );
            assert_eq!(
                matches!(record.normalized, CompatibilityCursor::Held(_)),
                word == "paused"
            );
            advance(root);
            let advanced = candidate(root, &persisted).unwrap();
            assert_eq!(
                advanced.answer(),
                &derive(&capture_inputs(root, &mut ArtifactFiles).unwrap()).unwrap()
            );
            assert_eq!(advanced.answer().current.unwrap().number(), 4.0);
            if word != "paused" {
                assert_eq!(
                    candidate(root, &original).unwrap_err().code(),
                    "state-conflict"
                );
            }
            let mut changed = persisted.clone();
            changed["cursor"] = cursor("unplanned", 3, 4);
            changed["cursor"]["extension"] = json!({"changed":true});
            assert_eq!(
                candidate(root, &changed).unwrap_err().code(),
                "state-conflict"
            );
            let next = accept(&store, root, &persisted, &mut Calls::default())
                .await
                .unwrap();
            assert_eq!(
                next["derivation"]["intake"],
                persisted["derivation"]["intake"]
            );
            assert_eq!(next["cursor"], original["cursor"]);
        }
    });
}

#[test]
fn ac5_adoption_and_hold_survive_fresh_process_and_retired_assertion_allows_advance() {
    for word in ["unplanned", "ready to plan", "context gathered", "paused"] {
        let root = tempfile::tempdir().unwrap();
        for mode in ["seed", "read"] {
            let output = Command::new(std::env::current_exe().unwrap())
                .args(["--exact", "subprocess_driver", "--nocapture"])
                .env("CADENCE_DERIVATION_CHILD_ROOT", root.path())
                .env("CADENCE_DERIVATION_CHILD_STATUS", word)
                .env("CADENCE_DERIVATION_CHILD_MODE", mode)
                .stdin(Stdio::null())
                .output()
                .unwrap();
            assert!(
                output.status.success(),
                "{word}/{mode}\n{}\n{}",
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            );
        }
    }
}

#[test]
fn ac5_failed_normalization_or_comparison_never_adopts_or_writes() {
    let root = tempfile::tempdir().unwrap();
    roadmap(root.path(), false);
    runtime().block_on(async {
        let store = Store::open(Filesystem::new(root.path()).unwrap(), FixturePolicy)
            .await
            .unwrap();
        for (word, code) in [
            ("unfamiliar", "invalid-status"),
            ("planned", "state-conflict"),
        ] {
            let data = data(word);
            store
                .request(Operation::RewriteSnapshot(data.clone()))
                .await
                .unwrap();
            let before = store_bytes(root.path());
            let mut calls = Calls::default();
            assert_eq!(
                accept(&store, root.path(), &data, &mut calls)
                    .await
                    .unwrap_err()
                    .code(),
                code
            );
            assert_eq!((calls.adoptions, calls.writes), (0, 0));
            assert_eq!(store_bytes(root.path()), before);
            assert!(!root.path().join(".store-intent.json").exists());
        }
    });
}
