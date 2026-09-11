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

#[derive(Clone, Copy, Debug)]
enum ConflictRow {
    CheckedIncomplete,
    UncheckedComplete,
    WrongPhase,
    WrongStatus,
    ClosedTotal,
    ClosedHeldTotal,
    ClosedPlanned,
    ClosedExecuted,
    AllCompleteUnplanned,
    AllCompletePlanned,
    AllCompleteExecuted,
}

impl ConflictRow {
    fn seed(
        self,
        root: &Path,
    ) -> (
        Value,
        &'static str,
        &'static str,
        &'static str,
        &'static str,
    ) {
        let mut data = data("unplanned");
        roadmap(root, false);
        match self {
            Self::CheckedIncomplete => {
                roadmap(root, true);
                (data, "ROADMAP.md:2 entry 0", "complete", "true", "false")
            }
            Self::UncheckedComplete => {
                advance(root);
                roadmap(root, false);
                (data, "ROADMAP.md:2 entry 0", "complete", "false", "true")
            }
            Self::WrongPhase => {
                data["cursor"] = cursor("unplanned", 2, 4);
                (data, "data.cursor", "phase", "2", "3")
            }
            Self::WrongStatus => {
                data["cursor"] = cursor("planned", 3, 4);
                (data, "data.cursor", "status", "planned", "unplanned")
            }
            Self::ClosedTotal
            | Self::ClosedHeldTotal
            | Self::ClosedPlanned
            | Self::ClosedExecuted => {
                fs::write(root.join("ROADMAP.md"), "## Phases\nNo active phases.\n").unwrap();
                let (word, total) = match self {
                    Self::ClosedTotal => ("complete", 4),
                    Self::ClosedHeldTotal => ("paused", 4),
                    Self::ClosedPlanned => ("planned", 0),
                    _ => ("executed", 0),
                };
                data["cursor"] = cursor(word, 3, total);
                if total != 0 {
                    (data, "data.cursor", "total", "4", "0")
                } else {
                    (data, "data.cursor", "status", word, "complete or unplanned")
                }
            }
            Self::AllCompleteUnplanned | Self::AllCompletePlanned | Self::AllCompleteExecuted => {
                advance(root);
                fs::write(
                    root.join("ROADMAP.md"),
                    "## Phases\n- [x] **Phase 3: Three**\n",
                )
                .unwrap();
                let word = match self {
                    Self::AllCompleteUnplanned => "unplanned",
                    Self::AllCompletePlanned => "planned",
                    _ => "executed",
                };
                data["cursor"] = cursor(word, 3, 4);
                (data, "data.cursor", "status", word, "complete")
            }
        }
    }

    fn correct(self, root: &Path, data: &mut Value) {
        match self {
            Self::CheckedIncomplete => roadmap(root, false),
            Self::UncheckedComplete => {
                // Keep the cursor compatible on the first query, so this row
                // isolates only the ROADMAP declaration in both directions.
                roadmap(root, true);
            }
            Self::WrongPhase | Self::WrongStatus => data["cursor"] = cursor("unplanned", 3, 4),
            Self::ClosedTotal => data["cursor"] = cursor("complete", 3, 0),
            Self::ClosedHeldTotal => data["cursor"] = cursor("paused", 3, 0),
            Self::ClosedPlanned | Self::ClosedExecuted => {
                data["cursor"] = cursor("unplanned", 3, 0)
            }
            _ => data["cursor"] = cursor("complete", 3, 4),
        }
    }
}

fn source_bytes(root: &Path) -> std::collections::BTreeMap<std::path::PathBuf, Vec<u8>> {
    fn walk(
        root: &Path,
        path: &Path,
        files: &mut std::collections::BTreeMap<std::path::PathBuf, Vec<u8>>,
    ) {
        for entry in fs::read_dir(path).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            if path.is_dir() {
                walk(root, &path, files);
            } else if ![ITEMS, DECISIONS, STATE]
                .iter()
                .any(|name| path == root.join(name))
            {
                files.insert(
                    path.strip_prefix(root).unwrap().to_owned(),
                    fs::read(path).unwrap(),
                );
            }
        }
    }
    let mut files = std::collections::BTreeMap::new();
    walk(root, root, &mut files);
    files
}

fn error_only<T>(
    result: &Result<T, DerivationError>,
    source: &str,
    field: &str,
    declared: &str,
    derived: &str,
) -> Result<(), String> {
    match result {
        Err(
            error @ DerivationError::StateConflict {
                source: s,
                field: f,
                declared: a,
                derived: b,
            },
        ) if s == source && f == field && a == declared && b == derived && a != b => {
            let diagnostic = error.to_string();
            if ["state-conflict", source, declared, derived]
                .into_iter()
                .all(|s| diagnostic.contains(s))
            {
                Ok(())
            } else {
                Err(diagnostic)
            }
        }
        _ => Err("expected a named conflict with both unequal values and no candidate".into()),
    }
}

#[test]
fn ac6_cold_and_warm_conflicts_preserve_every_byte_and_corrections_succeed() {
    for warm in [false, true] {
        for row in [
            ConflictRow::CheckedIncomplete,
            ConflictRow::UncheckedComplete,
            ConflictRow::WrongPhase,
            ConflictRow::WrongStatus,
            ConflictRow::ClosedTotal,
            ConflictRow::ClosedHeldTotal,
            ConflictRow::ClosedPlanned,
            ConflictRow::ClosedExecuted,
            ConflictRow::AllCompleteUnplanned,
            ConflictRow::AllCompletePlanned,
            ConflictRow::AllCompleteExecuted,
        ] {
            let root = tempfile::tempdir().unwrap();
            let root = root.path();
            let (mut data, source, field, declared, derived) = row.seed(root);
            if matches!(row, ConflictRow::UncheckedComplete) {
                data["cursor"] = cursor("unplanned", 4, 4);
            }
            if warm {
                data["derivation"] = json!({"memo":opaque_memo()});
            }
            assert!(data["derivation"].get("intake").is_none());
            runtime().block_on(async {
                let store = Store::open(Filesystem::new(root).unwrap(), FixturePolicy)
                    .await
                    .unwrap();
                store
                    .request(Operation::RewriteSnapshot(data.clone()))
                    .await
                    .unwrap();
                // All baselines are taken after fixture seeding, including warm memos.
                let before_store = store_bytes(root);
                let before_source = source_bytes(root);
                let result = candidate(root, &data);
                assert_eq!(
                    error_only(&result, source, field, declared, derived),
                    Ok(()),
                    "{row:?}, warm={warm}"
                );
                assert_eq!(store_bytes(root), before_store, "{row:?}, warm={warm}");
                assert_eq!(source_bytes(root), before_source);
                assert_eq!(
                    store.request(Operation::Read).await.unwrap().snapshot.data,
                    data
                );
                assert!(!root.join(".store-intent.json").exists());
                let fresh = derive(&capture_inputs(root, &mut ArtifactFiles).unwrap()).unwrap();
                let success_with_drift: Result<Value, DerivationError> =
                    Ok(json!({"answer":fresh,"drift":result.unwrap_err().to_string()}));
                assert!(
                    error_only(&success_with_drift, source, field, declared, derived).is_err(),
                    "success-with-drift survived {row:?}, warm={warm}"
                );
                row.correct(root, &mut data);
                store
                    .request(Operation::RewriteSnapshot(data.clone()))
                    .await
                    .unwrap();
                let corrected = candidate(root, &data).unwrap();
                let fresh = derive(&capture_inputs(root, &mut ArtifactFiles).unwrap()).unwrap();
                assert_eq!(corrected.answer(), &fresh, "corrected {row:?}, warm={warm}");
                assert!(!root.join(".store-intent.json").exists());
            });
        }
    }
}

#[test]
fn ac6_retired_cursor_control_allows_consistent_advance_without_writes() {
    let root = tempfile::tempdir().unwrap();
    let root = root.path();
    roadmap(root, false);
    runtime().block_on(async {
        let store = Store::open(Filesystem::new(root).unwrap(), FixturePolicy)
            .await
            .unwrap();
        let retired = accept(&store, root, &data("unplanned"), &mut Calls::default())
            .await
            .unwrap();
        advance(root);
        let before = store_bytes(root);
        let sources = source_bytes(root);
        let answer = candidate(root, &retired).unwrap();
        assert_eq!(answer.answer().current.unwrap().number(), 4.0);
        assert_eq!(
            answer.answer(),
            &derive(&capture_inputs(root, &mut ArtifactFiles).unwrap()).unwrap()
        );
        assert_eq!(store_bytes(root), before);
        assert_eq!(source_bytes(root), sources);
        assert!(!root.join(".store-intent.json").exists());
    });
}

struct OnRoadmapRead<F> {
    files: ArtifactFiles,
    action: Option<F>,
}
impl<F: FnOnce()> ArtifactIo for OnRoadmapRead<F> {
    fn resolve_root(&mut self, path: &Path) -> Result<std::path::PathBuf, InputFailure> {
        self.files.resolve_root(path)
    }
    fn probe_root(&mut self, path: &Path) -> Observation<()> {
        self.files.probe_root(path)
    }
    fn list_phase(&mut self, path: &Path) -> Observation<Vec<String>> {
        self.files.list_phase(path)
    }
    fn probe_summary(&mut self, path: &Path) -> Observation<()> {
        self.files.probe_summary(path)
    }
    fn read(&mut self, path: &Path) -> Observation<Vec<u8>> {
        let observed = self.files.read(path);
        if path.file_name().is_some_and(|name| name == "ROADMAP.md")
            && let Some(action) = self.action.take()
        {
            action();
        }
        observed
    }
}

/// Synchronous test edge around verified real-store observations. Domain code
/// receives only IntakeObservation; it has no runtime or writer dependency.
struct StoreIntake<'a> {
    runtime: &'a tokio::runtime::Runtime,
    store: &'a Store,
}
impl IntakeIo for StoreIntake<'_> {
    fn observe_intake(&mut self) -> Result<IntakeObservation, DerivationError> {
        let view = self
            .runtime
            .block_on(self.store.request(Operation::Read))
            .unwrap();
        Ok(IntakeObservation::from_data(&view.snapshot.data))
    }
}

#[test]
fn intake_changed_during_preparation_refuses_and_preserves_prior_memo_and_retirement() {
    for historical in [false, true] {
        let root = tempfile::tempdir().unwrap();
        let root = root.path();
        roadmap(root, false);
        let rt = runtime();
        let store = rt
            .block_on(Store::open(Filesystem::new(root).unwrap(), FixturePolicy))
            .unwrap();
        let mut prior = rt
            .block_on(accept(
                &store,
                root,
                &data("unplanned"),
                &mut Calls::default(),
            ))
            .unwrap();
        if !historical {
            // Unconsumed intake beside a prior memo and retirement history.
            prior["cursor"]["extension"] = json!({"replacement":"not retired"});
            rt.block_on(store.request(Operation::RewriteSnapshot(prior.clone())))
                .unwrap();
        }
        let selected = select_intake(&prior).unwrap();
        assert_eq!(
            matches!(selected.cursor, CompatibilityCursor::Unavailable(_)),
            historical
        );
        let mut changed = prior.clone();
        changed["cursor"]["next"] = "  a different exact resume instruction\t".into();
        changed["cursor"]["original_fields"]["next"] = changed["cursor"]["next"].clone();
        let sources = source_bytes(root);
        let mut after_fixture_write = None;
        let mut artifacts = OnRoadmapRead {
            files: ArtifactFiles,
            action: Some(|| {
                rt.block_on(store.request(Operation::RewriteSnapshot(changed.clone())))
                    .unwrap();
                after_fixture_write = Some(store_bytes(root));
            }),
        };
        let result = query_with_intake(
            root,
            &mut artifacts,
            &selected.cursor,
            &selected.observation,
            &mut StoreIntake {
                runtime: &rt,
                store: &store,
            },
        );
        assert_eq!(result.as_ref().unwrap_err().code(), "inputs-changed");
        let mut calls = Calls::default();
        let publication = result.and_then(|candidate| {
            calls.adoptions += 1;
            let next = adopt(&prior, opaque_memo(), candidate.intake().unwrap())?;
            calls.writes += 1;
            Ok(rt
                .block_on(store.request(Operation::RewriteSnapshot(next)))
                .unwrap())
        });
        assert_eq!(publication.unwrap_err().code(), "inputs-changed");
        assert_eq!((calls.adoptions, calls.writes), (0, 0));
        assert_eq!(store_bytes(root), after_fixture_write.unwrap());
        assert_eq!(source_bytes(root), sources);
        let persisted = rt
            .block_on(store.request(Operation::Read))
            .unwrap()
            .snapshot
            .data;
        assert_eq!(persisted, changed);
        assert_eq!(persisted["derivation"]["memo"], prior["derivation"]["memo"]);
        assert_eq!(
            persisted["derivation"]["intake"],
            prior["derivation"]["intake"]
        );
        assert!(!root.join(".store-intent.json").exists());
    }
}
