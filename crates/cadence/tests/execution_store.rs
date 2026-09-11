//! Store shard of the executable phase-6 acceptance inventory.
//!
//! The inventory runs deterministic persistence and log-bound evidence. Real
//! host behavior and model-produced work remain PLAN-2 UAT obligations.
use std::{
    collections::BTreeMap,
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::Duration,
};

use cadence::execution::dispatch::build_dispatch;
use cadence::execution::model::{
    ActiveDispatch, Blocker, BoundaryDecision, BoundaryTool, CommandReceipt, EvidenceReference,
    ExecutionSnapshot, ExecutorPatch, PATCH_SCHEMA, PatchKind, PlanDisposition, TaskOutcome,
    VerificationDisposition, VerificationReceipt,
};
use cadence::execution::plan::{parse_plan, plan_set_fingerprint};
use cadence::execution::render::SUMMARY_RENDER_VERSION;
use cadence::store::filesystem::{Filesystem, Stage};
use cadence::store::model::{DECISIONS, Decision, STATE, digest};
use cadence::store::transaction::{ExternalChange, INTENT, Transaction};
use cadence::store::writer::{Operation, Store, View};
use cadence::store::{Error, MutationContext, Observed, Policy, Result, Storage};
use serde_json::{Value, json};

const BASE: &str = "1111111111111111111111111111111111111111";
const COMMIT_1: &str = "2222222222222222222222222222222222222222";
const COMMIT_2: &str = "3333333333333333333333333333333333333333";
const OUTPUT: &str = "4444444444444444444444444444444444444444444444444444444444444444";

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

fn planning(root: &Path) -> PathBuf {
    root.join(".planning")
}

fn prepare_root(root: &Path) {
    std::fs::create_dir_all(planning(root).join("phases/6")).unwrap();
}

async fn open(root: &Path) -> Store {
    Store::open(Filesystem::new(planning(root)).unwrap(), Allow)
        .await
        .unwrap()
}

async fn open_with_probe(
    root: &Path,
    probe: impl FnMut(Stage, &Path) -> Result<()> + Send + 'static,
) -> Store {
    Store::open(
        Filesystem::new(planning(root)).unwrap().with_probe(probe),
        Allow,
    )
    .await
    .unwrap()
}

fn seed_data() -> Value {
    json!({
        "import": {"format":1,"complete":true,"sources":["legacy"]},
        "lifecycle": {"phase":6,"status":"planned"},
        "evidence": [{"id":"E1","accepted":true}],
        "pause": {"pending":false},
        "arbitrary": {"nested":[1,{"keep":"exact"}]}
    })
}

fn native_plan() -> cadence::execution::model::ExecutionPlan {
    parse_plan(
        b"---\nphase: 6\nplan: 1\nrequirements: [AC4, AC5]\nfiles: [src/lib.rs, src/one.rs, src/two.rs]\nexecution:\n  schema: 1\n  suite: cargo test\n  tasks:\n    - id: T1\n      verify: [cargo test one]\n    - id: T2\n      verify: [cargo test two]\n---\nBuild the execution slice.\n",
        6,
        1,
    )
    .unwrap()
}

fn boundary(
    tool: BoundaryTool,
    operation: &str,
    outcome: &str,
    subject_id: Option<String>,
    prompt_bytes: Option<u64>,
    unique: &str,
) -> BoundaryDecision {
    BoundaryDecision {
        phase: 6,
        tool,
        operation: operation.into(),
        request_digest: digest(format!("request:{unique}").as_bytes()),
        outcome: outcome.into(),
        subject_id,
        prompt_bytes,
        response_digest: digest(format!("response:{unique}").as_bytes()),
    }
}

fn execution(view: &View) -> ExecutionSnapshot {
    serde_json::from_value(view.snapshot.data["execution"].clone()).unwrap()
}

async fn seed_and_dispatch(store: &Store) -> (View, ActiveDispatch) {
    let seeded = store
        .request(Operation::RewriteSnapshot(seed_data()))
        .await
        .unwrap();
    let plan = native_plan();
    let set = plan_set_fingerprint(std::slice::from_ref(&plan)).unwrap();
    let candidate = build_dispatch(&plan, &set, 0, BASE, 512).unwrap();
    let admitted = store
        .request(Operation::AdmitExecution {
            expected_generation: seeded.snapshot.generation,
            expected_integrity: seeded.snapshot.integrity,
            operation_id: "dispatch-6-1".into(),
            plan_set_fingerprint: set,
            decision: boundary(
                BoundaryTool::CadenceQuery,
                "execute-next",
                "dispatch",
                Some(candidate.id.clone()),
                Some(candidate.prompt_bytes),
                "dispatch-6-1",
            ),
            dispatch: candidate,
        })
        .await
        .unwrap();
    let active = execution(&admitted).occurrences["6"]
        .active
        .clone()
        .unwrap();
    (admitted, active)
}

fn verification(command: &str) -> VerificationReceipt {
    VerificationReceipt {
        disposition: VerificationDisposition::Passed,
        commands: vec![CommandReceipt {
            command: command.into(),
            exit_code: 0,
            output_digest: OUTPUT.into(),
        }],
    }
}

fn complete_patch(dispatch: &ActiveDispatch) -> ExecutorPatch {
    ExecutorPatch {
        schema: PATCH_SCHEMA,
        kind: PatchKind::Executor,
        dispatch_id: dispatch.id.clone(),
        expected_execution_version: dispatch.expected_execution_version,
        outcome: PlanDisposition::Complete,
        tasks: vec![
            TaskOutcome::Completed {
                task_id: "T1".into(),
                commit: COMMIT_1.into(),
                verification: verification("cargo test one"),
                evidence: vec![EvidenceReference::Commit {
                    sha: COMMIT_1.into(),
                }],
            },
            TaskOutcome::Completed {
                task_id: "T2".into(),
                commit: COMMIT_2.into(),
                verification: verification("cargo test two"),
                evidence: vec![EvidenceReference::FileLine {
                    path: "src/lib.rs".into(),
                    line: 1,
                }],
            },
        ],
        deviations: Vec::new(),
        blockers: Vec::new(),
    }
}

fn apply_operation(view: &View, dispatch: &ActiveDispatch) -> Operation {
    Operation::ApplyExecutionPatch {
        staged_paths: Vec::new(),
        expected_generation: view.snapshot.generation,
        expected_integrity: view.snapshot.integrity.clone(),
        operation_id: "patch-6-1".into(),
        patch: complete_patch(dispatch),
        commit_paths: BTreeMap::from([
            (COMMIT_1.into(), vec!["src/one.rs".into()]),
            (COMMIT_2.into(), vec!["src/two.rs".into()]),
        ]),
        decision: boundary(
            BoundaryTool::CadenceApply,
            "executor",
            "accepted",
            Some(dispatch.id.clone()),
            None,
            "patch-6-1",
        ),
        render_version: SUMMARY_RENDER_VERSION,
        complete_phase: false,
    }
}

#[test]
fn dispatch_is_durable_and_preserves_unrelated_namespaces_after_reopen() {
    let root = tempfile::tempdir().unwrap();
    prepare_root(root.path());
    runtime().block_on(async {
        let store = open(root.path()).await;
        let (view, dispatch) = seed_and_dispatch(&store).await;
        for key in ["import", "lifecycle", "evidence", "pause", "arbitrary"] {
            assert_eq!(view.snapshot.data.get(key), seed_data().get(key));
        }
        drop(store);
        let reopened = open(root.path()).await;
        let recovered = reopened.request(Operation::ReadVerified).await.unwrap();
        assert_eq!(
            execution(&recovered).occurrences["6"].active.as_ref(),
            Some(&dispatch)
        );
        assert!(
            !std::fs::read_to_string(planning(root.path()).join(STATE))
                .unwrap()
                .contains("Build the execution slice.")
        );
        assert_eq!(recovered.decisions.len(), 1);
    });
}

#[test]
fn accepted_patch_and_derived_summary_survive_reopen() {
    let root = tempfile::tempdir().unwrap();
    prepare_root(root.path());
    runtime().block_on(async {
        let store = open(root.path()).await;
        let (view, dispatch) = seed_and_dispatch(&store).await;
        let accepted = store
            .request(apply_operation(&view, &dispatch))
            .await
            .unwrap();
        let occurrence = &execution(&accepted).occurrences["6"];
        assert!(occurrence.active.is_none());
        assert_eq!(occurrence.plans.len(), 1);
        let summary =
            std::fs::read_to_string(planning(root.path()).join("phases/6/SUMMARY.md")).unwrap();
        assert!(summary.contains(
            "| 1 | T1 | completed | 2222222222222222222222222222222222222222 | passed |"
        ));
        assert!(summary.contains(
            "| 1 | T2 | completed | 3333333333333333333333333333333333333333 | passed |"
        ));
        drop(store);
        let reopened = open(root.path()).await;
        assert_eq!(
            reopened
                .request(Operation::Read)
                .await
                .unwrap()
                .snapshot
                .data,
            accepted.snapshot.data
        );
    });
}

#[test]
fn blocked_patch_persists_judgment_without_completing_the_plan() {
    let root = tempfile::tempdir().unwrap();
    prepare_root(root.path());
    runtime().block_on(async {
        let store = open(root.path()).await;
        let (view, dispatch) = seed_and_dispatch(&store).await;
        let patch = ExecutorPatch {
            schema: PATCH_SCHEMA,
            kind: PatchKind::Executor,
            dispatch_id: dispatch.id.clone(),
            expected_execution_version: dispatch.expected_execution_version,
            outcome: PlanDisposition::Blocked,
            tasks: vec![
                TaskOutcome::Blocked {
                    task_id: "T1".into(),
                    blocker_id: "B1".into(),
                },
                TaskOutcome::NotRun {
                    task_id: "T2".into(),
                },
            ],
            deviations: vec![],
            blockers: vec![Blocker {
                id: "B1".into(),
                text: "operator judgment required".into(),
                evidence: vec![EvidenceReference::Criterion { id: "AC4".into() }],
            }],
        };
        let blocked = store
            .request(Operation::ApplyExecutionPatch {
                staged_paths: Vec::new(),
                expected_generation: view.snapshot.generation,
                expected_integrity: view.snapshot.integrity,
                operation_id: "blocked-6-1".into(),
                decision: boundary(
                    BoundaryTool::CadenceApply,
                    "executor",
                    "judgment-stop",
                    Some(dispatch.id.clone()),
                    None,
                    "blocked-6-1",
                ),
                patch,
                commit_paths: BTreeMap::new(),
                render_version: SUMMARY_RENDER_VERSION,
                complete_phase: false,
            })
            .await
            .unwrap();
        let occurrence = &execution(&blocked).occurrences["6"];
        assert!(occurrence.active.is_some());
        assert!(occurrence.plans.is_empty());
        assert!(occurrence.terminal.is_some());
        let summary =
            std::fs::read_to_string(planning(root.path()).join("phases/6/SUMMARY.md")).unwrap();
        assert!(summary.contains("Status: blocked"));
        assert!(summary.contains("Blocker references: B1"));
        drop(store);
        let reopened = open(root.path()).await;
        assert_eq!(
            reopened
                .request(Operation::Read)
                .await
                .unwrap()
                .snapshot
                .data,
            blocked.snapshot.data
        );
    });
}

#[test]
fn refusal_changes_only_decisions_generation_and_integrity() {
    let root = tempfile::tempdir().unwrap();
    prepare_root(root.path());
    runtime().block_on(async {
        let store = open(root.path()).await;
        let (view, dispatch) = seed_and_dispatch(&store).await;
        let accepted = store
            .request(apply_operation(&view, &dispatch))
            .await
            .unwrap();
        let execution_before = accepted.snapshot.data["execution"].clone();
        let unrelated_before = seed_data();
        let summary_path = planning(root.path()).join("phases/6/SUMMARY.md");
        let summary_before = std::fs::read(&summary_path).unwrap();
        let decisions_before = std::fs::read(planning(root.path()).join(DECISIONS)).unwrap();
        let refused = store
            .request(Operation::RecordExecutionRefusal {
                expected_generation: accepted.snapshot.generation,
                expected_integrity: accepted.snapshot.integrity,
                operation_id: "refusal-6-1".into(),
                decision: boundary(
                    BoundaryTool::CadenceApply,
                    "executor",
                    "refused",
                    Some(dispatch.id),
                    None,
                    "refusal-6-1",
                ),
            })
            .await
            .unwrap();
        assert_eq!(refused.snapshot.data["execution"], execution_before);
        for key in ["import", "lifecycle", "evidence", "pause", "arbitrary"] {
            assert_eq!(refused.snapshot.data.get(key), unrelated_before.get(key));
        }
        assert_eq!(std::fs::read(&summary_path).unwrap(), summary_before);
        assert_ne!(
            std::fs::read(planning(root.path()).join(DECISIONS)).unwrap(),
            decisions_before
        );
        assert_eq!(
            refused.snapshot.generation,
            accepted.snapshot.generation + 1
        );
        drop(store);
        let reopened = open(root.path()).await;
        assert_eq!(
            reopened
                .request(Operation::Read)
                .await
                .unwrap()
                .snapshot
                .data["execution"],
            execution_before
        );
    });
}

#[test]
fn invalid_summary_targets_bytes_versions_and_summary_only_intents_refuse_before_mutation() {
    let root = tempfile::tempdir().unwrap();
    prepare_root(root.path());
    runtime().block_on(async {
        let store = open(root.path()).await;
        let (view, dispatch) = seed_and_dispatch(&store).await;
        let before =
            [STATE, DECISIONS].map(|name| std::fs::read(planning(root.path()).join(name)).unwrap());
        let mut wrong_version = apply_operation(&view, &dispatch);
        if let Operation::ApplyExecutionPatch { render_version, .. } = &mut wrong_version {
            *render_version = SUMMARY_RENDER_VERSION + 1;
        }
        assert!(matches!(
            store.request(wrong_version).await,
            Err(Error::Invalid(_))
        ));
        let supplied = Transaction {
            id: "caller-summary".into(),
            items: vec![],
            decisions: vec![],
            snapshot: None,
            external: vec![ExternalChange {
                target: "phase-summary:6".into(),
                expected: Observed {
                    bytes: None,
                    identity: String::new(),
                    directory_identity: String::new(),
                },
                bytes: b"caller supplied".to_vec(),
            }],
        };
        assert!(matches!(
            store.request(Operation::Transact(supplied)).await,
            Err(Error::Invalid(_))
        ));
        assert_eq!(
            before,
            [STATE, DECISIONS].map(|name| std::fs::read(planning(root.path()).join(name)).unwrap())
        );
    });

    let mut filesystem = Filesystem::new(planning(root.path())).unwrap();
    for target in [
        "phase-summary:0",
        "phase-summary:01",
        "phase-summary:../6",
        "phase-summary:/tmp",
    ] {
        assert!(filesystem.read(target).is_err(), "accepted {target}");
    }

    let isolated = tempfile::tempdir().unwrap();
    prepare_root(isolated.path());
    let expected = json!({"bytes":null,"identity":"","directory_identity":""});
    let kind = json!({
        "operation":"execution-patch",
        "phase":6,
        "render_version":SUMMARY_RENDER_VERSION,
        "summary":true
    });
    let participants = json!([{
        "target":"phase-summary:6",
        "expected":expected,
        "bytes":[]
    }]);
    let integrity = digest(&serde_json::to_vec(&(1u32, &kind, &participants)).unwrap());
    let intent = json!({
        "version":1,
        "kind":kind,
        "participants":participants,
        "integrity":integrity
    });
    std::fs::write(
        planning(isolated.path()).join(INTENT),
        serde_json::to_vec(&intent).unwrap(),
    )
    .unwrap();
    assert!(
        runtime()
            .block_on(Store::open(
                Filesystem::new(planning(isolated.path())).unwrap(),
                Allow
            ))
            .is_err()
    );
    assert!(!planning(isolated.path()).join(STATE).exists());
}

fn target_matches(stage: Stage, path: &Path, target: &str) -> bool {
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default();
    match stage {
        Stage::TemporarySync => name.contains(target),
        Stage::Renamed | Stage::Confirmation => name == target,
        Stage::DirectorySync if target == "SUMMARY.md" => name == "6",
        Stage::DirectorySync => name == ".planning",
        _ => false,
    }
}

#[test]
fn store_and_summary_failures_never_acknowledge_and_recovery_finishes_once() {
    for target in ["state.json", "SUMMARY.md"] {
        for stage in [
            Stage::TemporarySync,
            Stage::DirectorySync,
            Stage::Renamed,
            Stage::Confirmation,
        ] {
            let root = tempfile::tempdir().unwrap();
            prepare_root(root.path());
            runtime().block_on(async {
                let initial = open(root.path()).await;
                let (view, dispatch) = seed_and_dispatch(&initial).await;
                drop(initial);
                let failing = open_with_probe(root.path(), move |seen, path| {
                    if seen == stage && target_matches(seen, path, target) {
                        Err(Error::Io(format!("injected {stage:?} for {target}")))
                    } else {
                        Ok(())
                    }
                })
                .await;
                assert!(
                    failing
                        .request(apply_operation(&view, &dispatch))
                        .await
                        .is_err()
                );
                drop(failing);

                let recovered = open(root.path()).await;
                let reopened = recovered.request(Operation::ReadVerified).await.unwrap();
                let plans = execution(&reopened).occurrences["6"].plans.len();
                let final_view = if plans == 0 {
                    recovered
                        .request(apply_operation(&reopened, &dispatch))
                        .await
                        .unwrap()
                } else {
                    recovered
                        .request(apply_operation(&view, &dispatch))
                        .await
                        .unwrap()
                };
                let occurrence = &execution(&final_view).occurrences["6"];
                assert_eq!(occurrence.plans.len(), 1, "{stage:?} {target}");
                assert_eq!(occurrence.receipts.len(), 1, "{stage:?} {target}");
                assert_eq!(final_view.decisions.len(), 2, "{stage:?} {target}");
                let summary =
                    std::fs::read_to_string(planning(root.path()).join("phases/6/SUMMARY.md"))
                        .unwrap();
                assert_eq!(summary.matches(COMMIT_1).count(), 1);
                assert_eq!(summary.matches(COMMIT_2).count(), 1);
            });
        }
    }
}

#[test]
fn transition_257_persists_one_terminal_log_bound_and_later_calls_replay_it() {
    let root = tempfile::tempdir().unwrap();
    prepare_root(root.path());
    runtime().block_on(async {
        let store = open(root.path()).await;
        let mut view = store
            .request(Operation::RewriteSnapshot(seed_data()))
            .await
            .unwrap();
        for number in 1..=256 {
            view = store
                .request(Operation::RecordExecutionRefusal {
                    expected_generation: view.snapshot.generation,
                    expected_integrity: view.snapshot.integrity.clone(),
                    operation_id: format!("refusal-{number}"),
                    decision: boundary(
                        BoundaryTool::CadenceQuery,
                        "execute-next",
                        "refused",
                        None,
                        None,
                        &format!("refusal-{number}"),
                    ),
                })
                .await
                .unwrap();
        }
        assert_eq!(view.decisions.len(), 256);
        let bounded = store
            .request(Operation::RecordExecutionRefusal {
                expected_generation: view.snapshot.generation,
                expected_integrity: view.snapshot.integrity.clone(),
                operation_id: "refusal-257".into(),
                decision: boundary(
                    BoundaryTool::CadenceQuery,
                    "execute-next",
                    "refused",
                    None,
                    None,
                    "refusal-257",
                ),
            })
            .await
            .unwrap();
        assert_eq!(bounded.decisions.len(), 257);
        let terminal_id = bounded.decisions.last().unwrap().id.clone();
        assert!(matches!(
            bounded.decisions.last().unwrap().decision,
            Decision::Boundary {
                terminal: true,
                ref outcome,
                ..
            } if outcome == "log-bound"
        ));
        let bytes = std::fs::read(planning(root.path()).join(DECISIONS)).unwrap();
        let replayed = store
            .request(Operation::RecordExecutionRefusal {
                expected_generation: bounded.snapshot.generation,
                expected_integrity: bounded.snapshot.integrity.clone(),
                operation_id: "refusal-258".into(),
                decision: boundary(
                    BoundaryTool::CadenceApply,
                    "executor",
                    "refused",
                    None,
                    None,
                    "refusal-258",
                ),
            })
            .await
            .unwrap();
        assert_eq!(replayed.snapshot.generation, bounded.snapshot.generation);
        assert_eq!(replayed.decisions.len(), 257);
        assert_eq!(replayed.decisions.last().unwrap().id, terminal_id);
        assert_eq!(
            std::fs::read(planning(root.path()).join(DECISIONS)).unwrap(),
            bytes
        );
    });
}

fn operation_from_patch(view: &View, patch: ExecutorPatch) -> Operation {
    Operation::ApplyExecutionPatch {
        staged_paths: Vec::new(),
        expected_generation: view.snapshot.generation,
        expected_integrity: view.snapshot.integrity.clone(),
        operation_id: "patch-6-1".into(),
        commit_paths: BTreeMap::from([
            (COMMIT_1.into(), vec!["src/one.rs".into()]),
            (COMMIT_2.into(), vec!["src/two.rs".into()]),
        ]),
        decision: boundary(
            BoundaryTool::CadenceApply,
            "executor",
            "accepted",
            Some(patch.dispatch_id.clone()),
            None,
            "patch-6-1",
        ),
        patch,
        render_version: SUMMARY_RENDER_VERSION,
        complete_phase: false,
    }
}

fn execution_store_barrier() -> ! {
    println!("EXECUTION_STORE_BARRIER");
    std::io::stdout().flush().unwrap();
    loop {
        std::thread::park();
    }
}

#[test]
fn execution_store_restart_child() {
    let Some(project) = std::env::var_os("CADENCE_EXECUTION_STORE_ROOT") else {
        return;
    };
    let project = PathBuf::from(project);
    let patch: ExecutorPatch =
        serde_json::from_str(&std::env::var("CADENCE_EXECUTION_STORE_PATCH").unwrap()).unwrap();
    let mode = std::env::var("CADENCE_EXECUTION_STORE_MODE").unwrap();
    runtime().block_on(async {
        let store = if mode == "produce" {
            open_with_probe(&project, |stage, path| {
                if stage == Stage::Confirmation && path.ends_with(STATE) {
                    execution_store_barrier();
                }
                Ok(())
            })
            .await
        } else {
            open(&project).await
        };
        let view = store.request(Operation::ReadVerified).await.unwrap();
        let result = store
            .request(operation_from_patch(&view, patch))
            .await
            .unwrap();
        assert_eq!(execution(&result).occurrences["6"].receipts.len(), 1);
        println!(
            "EXECUTION_STORE_RESULT {}",
            json!({
                "pid": std::process::id(),
                "plans": execution(&result).occurrences["6"].plans.len(),
                "decisions": result.decisions.len(),
            })
        );
    });
}

fn execution_store_child(project: &Path, mode: &str, patch: &ExecutorPatch) -> Command {
    let mut command = Command::new(std::env::current_exe().unwrap());
    command
        .args(["--exact", "execution_store_restart_child", "--nocapture"])
        .env("CADENCE_EXECUTION_STORE_ROOT", project)
        .env("CADENCE_EXECUTION_STORE_MODE", mode)
        .env(
            "CADENCE_EXECUTION_STORE_PATCH",
            serde_json::to_string(patch).unwrap(),
        )
        .stdin(Stdio::null());
    command
}

#[test]
fn real_kill_after_summary_install_recovers_final_state_and_one_receipt() {
    let root = tempfile::tempdir().unwrap();
    prepare_root(root.path());
    let patch = runtime().block_on(async {
        let store = open(root.path()).await;
        let (view, dispatch) = seed_and_dispatch(&store).await;
        let patch = complete_patch(&dispatch);
        assert_eq!(view.decisions.len(), 1);
        patch
    });
    let mut child = execution_store_child(root.path(), "produce", &patch)
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .unwrap();
    let producer_pid = child.id();
    let stdout = child.stdout.take().unwrap();
    let (sender, receiver) = std::sync::mpsc::channel();
    let reader = std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            if line.unwrap() == "EXECUTION_STORE_BARRIER" {
                let _ = sender.send(());
                return;
            }
        }
    });
    assert!(receiver.recv_timeout(Duration::from_secs(10)).is_ok());
    child.kill().unwrap();
    let status = child.wait().unwrap();
    reader.join().unwrap();
    assert!(!status.success());
    #[cfg(unix)]
    {
        use std::os::unix::process::ExitStatusExt;
        assert_eq!(status.signal(), Some(libc::SIGKILL));
    }
    assert!(planning(root.path()).join(INTENT).exists());
    let installed = std::fs::read(planning(root.path()).join("phases/6/SUMMARY.md")).unwrap();

    let output = execution_store_child(root.path(), "recover", &patch)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8(output.stdout).unwrap();
    let result: Value = serde_json::from_str(
        stdout
            .lines()
            .find_map(|line| line.strip_prefix("EXECUTION_STORE_RESULT "))
            .unwrap(),
    )
    .unwrap();
    assert_ne!(result["pid"], producer_pid);
    assert_eq!(result["plans"], 1);
    assert_eq!(result["decisions"], 2);
    assert!(!planning(root.path()).join(INTENT).exists());
    assert_eq!(
        std::fs::read(planning(root.path()).join("phases/6/SUMMARY.md")).unwrap(),
        installed
    );
    let summary = String::from_utf8(installed).unwrap();
    assert_eq!(summary.matches(COMMIT_1).count(), 1);
    assert_eq!(summary.matches(COMMIT_2).count(), 1);
}

#[test]
fn phase_six_store_acceptance_inventory_runs_registered_evidence() {
    let rows: [(&str, &str, fn()); 4] = [
        (
            "AC4",
            "accepted_patch_and_derived_summary_survive_reopen",
            accepted_patch_and_derived_summary_survive_reopen,
        ),
        (
            "AC5",
            "refusal_changes_only_decisions_generation_and_integrity",
            refusal_changes_only_decisions_generation_and_integrity,
        ),
        (
            "AC6",
            "real_kill_after_summary_install_recovers_final_state_and_one_receipt",
            real_kill_after_summary_install_recovers_final_state_and_one_receipt,
        ),
        (
            "AC8 log-bound",
            "transition_257_persists_one_terminal_log_bound_and_later_calls_replay_it",
            transition_257_persists_one_terminal_log_bound_and_later_calls_replay_it,
        ),
    ];
    let listing = Command::new(std::env::current_exe().unwrap())
        .arg("--list")
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(listing.status.success());
    let listing = String::from_utf8(listing.stdout).unwrap();
    for (criterion, name, run) in rows {
        assert!(
            listing.lines().any(|line| line == format!("{name}: test")),
            "{criterion} evidence is not registered: {name}"
        );
        run();
    }
}

use cadence::envelope::Envelope;
use cadence::execution::boundary::{
    BoundaryScope, BoundaryV1, ExecutionEnvelope, PreparedAnswer, Success,
};
use cadence::store::writer::{BoundaryChange, confirmed_boundary};

fn scoped_answer(
    scope: BoundaryScope,
    tool: BoundaryTool,
    unique: &str,
    envelope: ExecutionEnvelope,
    subject: Option<String>,
) -> BoundaryV1 {
    BoundaryV1::new(
        scope,
        tool,
        match tool {
            BoundaryTool::CadenceQuery => "execute-next",
            BoundaryTool::CadenceApply => "executor",
        }
        .into(),
        digest(unique.as_bytes()),
        subject,
        &PreparedAnswer::new(envelope).unwrap(),
    )
}

fn scoped_refusal(scope: BoundaryScope, unique: &str) -> BoundaryV1 {
    scoped_answer(
        scope,
        BoundaryTool::CadenceQuery,
        unique,
        Envelope::Refused {
            code: "invalid-input".into(),
            reason: "the execution input is invalid".into(),
        },
        None,
    )
}

fn scoped_operation(
    view: &View,
    id: &str,
    decision: BoundaryV1,
    change: BoundaryChange,
) -> Operation {
    Operation::BoundaryV1 {
        expected_generation: view.snapshot.generation,
        expected_integrity: view.snapshot.integrity.clone(),
        operation_id: id.into(),
        decision,
        change: Box::new(change),
    }
}

// This oracle sorts parsed JSON independently and never serializes a response type.
fn independent_canonical(value: &Value) -> Vec<u8> {
    match value {
        Value::Object(map) => {
            let sorted: BTreeMap<_, _> = map.iter().collect();
            let parts: Vec<_> = sorted
                .into_iter()
                .map(|(key, value)| {
                    format!(
                        "{}:{}",
                        serde_json::to_string(key).unwrap(),
                        String::from_utf8(independent_canonical(value)).unwrap()
                    )
                })
                .collect();
            format!("{{{}}}", parts.join(",")).into_bytes()
        }
        Value::Array(array) => format!(
            "[{}]",
            array
                .iter()
                .map(|value| String::from_utf8(independent_canonical(value)).unwrap())
                .collect::<Vec<_>>()
                .join(",")
        )
        .into_bytes(),
        _ => serde_json::to_vec(value).unwrap(),
    }
}

fn assert_disk_answer(root: &Path, view: &View, decision: &BoundaryV1, expected: Value) {
    let selected = confirmed_boundary(view, decision).unwrap();
    let bytes = std::fs::read_to_string(planning(root).join(DECISIONS)).unwrap();
    let record = bytes
        .lines()
        .map(|line| serde_json::from_str::<Value>(line).unwrap())
        .find(|record| record["id"] == selected.id)
        .unwrap();
    assert_eq!(record["decision"]["class"], "boundary_v1");
    assert_eq!(record["decision"]["boundary"]["codec"], 1);
    assert_eq!(
        record["decision"]["boundary"]["response_digest"],
        digest(&independent_canonical(&expected))
    );
    if record["decision"]["boundary"]["receipt"]["receipt"] == "compact" {
        assert_eq!(
            record["decision"]["boundary"]["receipt"]["envelope"],
            expected
        );
        assert_eq!(
            serde_json::to_value(selected.envelope(None).unwrap()).unwrap(),
            expected
        );
    }
}

async fn scoped_dispatch(store: &Store) -> (View, ActiveDispatch, BoundaryV1) {
    let view = store
        .request(Operation::RewriteSnapshot(seed_data()))
        .await
        .unwrap();
    let plan = native_plan();
    let set = plan_set_fingerprint(std::slice::from_ref(&plan)).unwrap();
    let candidate = build_dispatch(&plan, &set, 0, BASE, 512).unwrap();
    let mut returned = candidate.clone();
    returned.expected_execution_version = 1;
    let decision = scoped_answer(
        BoundaryScope::Execution { phase: 6 },
        BoundaryTool::CadenceQuery,
        "new-dispatch",
        Envelope::Ok(Success::Dispatch {
            dispatch: Box::new(returned.clone()),
            prompt: "x".repeat(512),
        }),
        Some(candidate.id.clone()),
    );
    let view = store
        .request(scoped_operation(
            &view,
            "new-dispatch",
            decision.clone(),
            BoundaryChange::Dispatch {
                plan_set_fingerprint: set,
                dispatch: candidate,
            },
        ))
        .await
        .unwrap();
    (view, returned, decision)
}

#[test]
fn scoped_writer_confirms_dispatch_complete_blocked_and_observation_public_digests() {
    for blocked in [false, true] {
        let root = tempfile::tempdir().unwrap();
        prepare_root(root.path());
        runtime().block_on(async {
            let store = open(root.path()).await;
            let (view, dispatch, decision) = scoped_dispatch(&store).await;
            let mut expected_dispatch = serde_json::to_value(&dispatch).unwrap();
            expected_dispatch["body"] = json!("Build the execution slice.\n");
            assert_disk_answer(root.path(), &view, &decision, json!({"status":"ok","outcome":"dispatch","dispatch":expected_dispatch,"prompt":"x".repeat(512)}));
            let selected = confirmed_boundary(&view, &decision).unwrap();
            assert!(selected.envelope(None).is_err());
            let answer = Envelope::Ok(Success::Dispatch { dispatch: Box::new(dispatch.clone()), prompt: "x".repeat(512) });
            assert_eq!(selected.envelope(Some(answer.clone())).unwrap(), answer);
            let mut patch = complete_patch(&dispatch);
            let expected = if blocked {
                patch.outcome = PlanDisposition::Blocked;
                patch.tasks = vec![TaskOutcome::Blocked { task_id:"T1".into(), blocker_id:"B1".into() }, TaskOutcome::NotRun { task_id:"T2".into() }];
                patch.blockers = vec![Blocker { id:"B1".into(), text:"judgment".into(), evidence:vec![EvidenceReference::Criterion { id:"AC4".into() }] }];
                json!({"status":"ok","outcome":"judgment-stop","phase":6,"dispatch_id":dispatch.id,"blocker_ids":["B1"]})
            } else { json!({"status":"ok","outcome":"complete","phase":6}) };
            let decision = scoped_answer(BoundaryScope::Execution { phase:6 }, BoundaryTool::CadenceApply, "new-patch",
                serde_json::from_value(expected.clone()).unwrap(), Some(dispatch.id.clone()));
            let commit_paths = if blocked { BTreeMap::new() } else { BTreeMap::from([(COMMIT_1.into(), vec!["src/one.rs".into()]),(COMMIT_2.into(), vec!["src/two.rs".into()])]) };
            let change = BoundaryChange::Patch { staged_paths: Vec::new(), patch, commit_paths, render_version:SUMMARY_RENDER_VERSION, complete_phase:!blocked };
            let applied = store.request(scoped_operation(&view, "new-patch", decision.clone(), change.clone())).await.unwrap();
            assert_disk_answer(root.path(), &applied, &decision, expected.clone());
            let old_summary = std::fs::read(planning(root.path()).join("phases/6/SUMMARY.md")).unwrap();
            let observation = scoped_answer(BoundaryScope::Execution { phase:6 }, BoundaryTool::CadenceQuery, "observe", serde_json::from_value(expected.clone()).unwrap(), Some(dispatch.id.clone()));
            let observed = store.request(scoped_operation(&applied, "observe", observation.clone(), BoundaryChange::Observe)).await.unwrap();
            assert_disk_answer(root.path(), &observed, &observation, expected);
            let replay = store.request(scoped_operation(&view, "new-patch", decision.clone(), change.clone())).await.unwrap();
            assert_eq!(replay, observed);
            let mut changed = decision; changed.request_digest = digest(b"changed");
            assert!(store.request(scoped_operation(&view, "new-patch", changed, change)).await.is_err());
            let refusal = scoped_refusal(BoundaryScope::RootRefusal, "malformed");
            let refused = store.request(scoped_operation(&observed, "malformed", refusal.clone(), BoundaryChange::Observe)).await.unwrap();
            assert_eq!(refused.snapshot.data, applied.snapshot.data);
            assert_eq!(std::fs::read(planning(root.path()).join("phases/6/SUMMARY.md")).unwrap(), old_summary);
            assert_disk_answer(root.path(), &refused, &refusal, json!({"status":"refused","code":"invalid-input","reason":"the execution input is invalid"}));
        });
    }
}

#[test]
fn scoped_budgets_admit_256_plus_terminal_and_reopen_never_grows_either_scope() {
    for phase_first in [false, true] {
        let root = tempfile::tempdir().unwrap();
        prepare_root(root.path());
        runtime().block_on(async {
        let mut store = open(root.path()).await;
        let (mut view, dispatch, original) = scoped_dispatch(&store).await;
        let data = view.snapshot.data.clone();
        for scope in if phase_first { [BoundaryScope::Execution { phase:6 }, BoundaryScope::RootRefusal] } else { [BoundaryScope::RootRefusal, BoundaryScope::Execution { phase:6 }] } {
            let existing = if scope == BoundaryScope::RootRefusal { 0 } else { 1 };
            for index in existing..256 {
                let unique = format!("{scope:?}:{index}");
                let decision = scoped_refusal(scope.clone(), &unique);
                let before = view.clone();
                view = store.request(scoped_operation(&view, &unique, decision.clone(), BoundaryChange::Observe)).await.unwrap();
                assert_eq!(store.request(scoped_operation(&before, &unique, decision, BoundaryChange::Observe)).await.unwrap(), view);
            }
            let decision = scoped_refusal(scope.clone(), "overflow");
            let terminal = store.request(scoped_operation(&view, "overflow", decision.clone(), BoundaryChange::Observe)).await.unwrap();
            let selected = confirmed_boundary(&terminal, &decision).unwrap();
            assert!(selected.value.terminal);
            assert_eq!(selected.value.boundary.response_digest, "dbf0572cace415f2802f207056eafe427501f99eb793bd9551d6b114477b4ab9");
            assert_ne!(selected.id, selected.value.boundary.response_digest);
            assert_eq!(terminal.snapshot.operations, view.snapshot.operations);
            assert_eq!(terminal.snapshot.data, data);
            assert_eq!(terminal.decisions.iter().filter(|record| matches!(&record.decision, Decision::BoundaryV1(value) if value.boundary.scope == scope)).count(), 257);
            let disk = [STATE, DECISIONS].map(|name| std::fs::read(planning(root.path()).join(name)).unwrap());
            drop(store); store = open(root.path()).await;
            for index in 0..6 {
                let mut candidate = if index == 0 && scope != BoundaryScope::RootRefusal { original.clone() }
                    else { scoped_refusal(scope.clone(), &format!("retry-{index}")) };
                candidate.tool = if index % 2 == 0 { BoundaryTool::CadenceQuery } else { BoundaryTool::CadenceApply };
                let change = if index == 3 { BoundaryChange::Patch { staged_paths: Vec::new(), patch:complete_patch(&dispatch), commit_paths:BTreeMap::new(), render_version:SUMMARY_RENDER_VERSION, complete_phase:true } }
                    else { BoundaryChange::Observe };
                let replay = store.request(Operation::BoundaryV1 { expected_generation:0, expected_integrity:"changed".into(), operation_id:"new-dispatch".into(), decision:candidate.clone(), change:Box::new(change) }).await.unwrap();
                assert_eq!(replay, terminal);
                assert!(confirmed_boundary(&replay, &candidate).unwrap().value.terminal);
                assert_eq!([STATE, DECISIONS].map(|name| std::fs::read(planning(root.path()).join(name)).unwrap()), disk);
            }
            view = terminal;
        }
        assert_eq!(view.decisions.len(), 514);
        assert_eq!(view.snapshot.operations.len(), 512);
    });
    }
}

fn recovery_operation(view: &View, case: &str, patch: Option<&ExecutorPatch>) -> Operation {
    let (decision, change) = match case {
        "dispatch" => {
            let plan = native_plan();
            let set = plan_set_fingerprint(std::slice::from_ref(&plan)).unwrap();
            let candidate = build_dispatch(&plan, &set, 0, BASE, 512).unwrap();
            let mut returned = candidate.clone();
            returned.expected_execution_version = 1;
            (
                scoped_answer(
                    BoundaryScope::Execution { phase: 6 },
                    BoundaryTool::CadenceQuery,
                    "recovery-dispatch",
                    Envelope::Ok(Success::Dispatch {
                        dispatch: Box::new(returned),
                        prompt: "x".repeat(512),
                    }),
                    Some(candidate.id.clone()),
                ),
                BoundaryChange::Dispatch {
                    plan_set_fingerprint: set,
                    dispatch: candidate,
                },
            )
        }
        "patch" => {
            let patch = patch.unwrap().clone();
            (
                scoped_answer(
                    BoundaryScope::Execution { phase: 6 },
                    BoundaryTool::CadenceApply,
                    "recovery-patch",
                    Envelope::Ok(Success::Complete { phase: 6 }),
                    Some(patch.dispatch_id.clone()),
                ),
                BoundaryChange::Patch {
                    staged_paths: Vec::new(),
                    patch,
                    commit_paths: BTreeMap::from([
                        (COMMIT_1.into(), vec!["src/one.rs".into()]),
                        (COMMIT_2.into(), vec!["src/two.rs".into()]),
                    ]),
                    render_version: SUMMARY_RENDER_VERSION,
                    complete_phase: true,
                },
            )
        }
        "refusal" | "terminal" => (
            scoped_refusal(BoundaryScope::RootRefusal, "recovery-refusal"),
            BoundaryChange::Observe,
        ),
        _ => panic!("unknown recovery operation: {case}"),
    };
    scoped_operation(view, "recovery-operation", decision, change)
}

fn recovery_template(case: &str) -> (tempfile::TempDir, Option<ExecutorPatch>) {
    let root = tempfile::tempdir().unwrap();
    prepare_root(root.path());
    let patch = runtime().block_on(async {
        let store = open(root.path()).await;
        if case == "patch" {
            let (_, dispatch, _) = scoped_dispatch(&store).await;
            Some(complete_patch(&dispatch))
        } else {
            let mut view = store
                .request(Operation::RewriteSnapshot(seed_data()))
                .await
                .unwrap();
            if case == "terminal" {
                for i in 0..256 {
                    let id = format!("pre-terminal-{i}");
                    let decision = scoped_refusal(BoundaryScope::RootRefusal, &id);
                    view = store
                        .request(scoped_operation(
                            &view,
                            &id,
                            decision,
                            BoundaryChange::Observe,
                        ))
                        .await
                        .unwrap();
                }
            }
            None
        }
    });
    std::fs::write(
        planning(root.path()).join("phases/6/SUMMARY.md"),
        b"prior summary\n",
    )
    .unwrap();
    (root, patch)
}

fn copy_recovery_template(source: &Path) -> tempfile::TempDir {
    let root = tempfile::tempdir().unwrap();
    prepare_root(root.path());
    for name in ["items.jsonl", DECISIONS, STATE, "phases/6/SUMMARY.md"] {
        std::fs::copy(
            planning(source).join(name),
            planning(root.path()).join(name),
        )
        .unwrap();
    }
    root
}

fn recovery_bytes(root: &Path) -> [Vec<u8>; 4] {
    ["items.jsonl", DECISIONS, STATE, "phases/6/SUMMARY.md"]
        .map(|name| std::fs::read(planning(root).join(name)).unwrap())
}

fn assert_recovery_once(root: &Path, case: &str, before: &View, after: &View) {
    assert_eq!(after.decisions.len(), before.decisions.len() + 1);
    assert_eq!(after.snapshot.generation, before.snapshot.generation + 1);
    for key in ["import", "lifecycle", "evidence", "pause", "arbitrary"] {
        assert_eq!(after.snapshot.data[key], before.snapshot.data[key]);
    }
    if case == "patch" {
        let execution = execution(after);
        assert_eq!(execution.occurrences["6"].plans.len(), 1);
        assert_eq!(execution.occurrences["6"].receipts.len(), 1);
        let summary = std::fs::read_to_string(planning(root).join("phases/6/SUMMARY.md")).unwrap();
        assert_eq!(summary.matches(COMMIT_1).count(), 1);
        assert_eq!(summary.matches(COMMIT_2).count(), 1);
    } else {
        assert_eq!(
            std::fs::read(planning(root).join("phases/6/SUMMARY.md")).unwrap(),
            b"prior summary\n"
        );
    }
    if matches!(case, "refusal" | "terminal") {
        assert_eq!(after.snapshot.data, before.snapshot.data);
    }
    assert_eq!(
        after.snapshot.operations.len(),
        before.snapshot.operations.len() + usize::from(case != "terminal")
    );
    assert!(!planning(root).join(INTENT).exists());
}

#[test]
fn scoped_intent_and_changed_participant_failures_never_acknowledge() {
    use std::sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    };
    for case in ["refusal", "dispatch", "patch", "terminal"] {
        let (template, patch) = recovery_template(case);
        let mut targets = vec![INTENT, DECISIONS, STATE, "intent-removal"];
        if case == "patch" {
            targets.push("SUMMARY.md");
        }
        for target in targets {
            for stage in if target == "intent-removal" {
                vec![Stage::DirectorySync]
            } else {
                vec![
                    Stage::TemporarySync,
                    Stage::Renamed,
                    Stage::DirectorySync,
                    Stage::Confirmation,
                ]
            } {
                let root = copy_recovery_template(template.path());
                runtime().block_on(async {
                    let initial = open(root.path()).await;
                    let before = initial.request(Operation::ReadVerified).await.unwrap();
                    drop(initial);
                    let hit = Arc::new(AtomicBool::new(false));
                    let seen_hit = hit.clone();
                    let mut renamed = String::new();
                    let pending = planning(root.path()).join(INTENT);
                    let failing = open_with_probe(root.path(), move |seen, path| {
                        if seen == Stage::Renamed {
                            renamed = path.file_name().unwrap().to_string_lossy().into_owned();
                        }
                        let matches = if target == "intent-removal" {
                            renamed == STATE && !pending.exists()
                        } else if stage == Stage::DirectorySync {
                            renamed == target
                        } else {
                            target_matches(seen, path, target)
                        };
                        if seen == stage && matches {
                            seen_hit.store(true, Ordering::SeqCst);
                            Err(Error::Io("scoped failure injected".into()))
                        } else {
                            Ok(())
                        }
                    })
                    .await;
                    assert!(
                        failing
                            .request(recovery_operation(&before, case, patch.as_ref()))
                            .await
                            .is_err(),
                        "acknowledged {case} {stage:?} {target}"
                    );
                    assert!(
                        hit.load(Ordering::SeqCst),
                        "missed {case} {stage:?} {target}"
                    );
                    drop(failing);
                    let recovered = open(root.path()).await;
                    let view = recovered.request(Operation::ReadVerified).await.unwrap();
                    let result = recovered
                        .request(recovery_operation(&view, case, patch.as_ref()))
                        .await
                        .unwrap();
                    assert_recovery_once(root.path(), case, &before, &result);
                    let bytes = recovery_bytes(root.path());
                    assert_eq!(
                        recovered
                            .request(recovery_operation(&before, case, patch.as_ref()))
                            .await
                            .unwrap(),
                        result
                    );
                    assert_eq!(recovery_bytes(root.path()), bytes);
                });
            }
        }
    }
}

#[test]
fn scoped_recovery_resync_and_intent_removal_failures_never_acknowledge() {
    use std::sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    };
    let (template, patch) = recovery_template("patch");
    for target in [DECISIONS, STATE, "SUMMARY.md", INTENT] {
        for stage in if target == INTENT {
            vec![Stage::DirectorySync]
        } else {
            vec![
                Stage::RecoverySync,
                Stage::DirectorySync,
                Stage::Confirmation,
            ]
        } {
            let root = copy_recovery_template(template.path());
            runtime().block_on(async {
                let store = open_with_probe(root.path(), |stage, path| {
                    if stage == Stage::Confirmation && path.ends_with(STATE) {
                        Err(Error::Io("final confirmation injected".into()))
                    } else {
                        Ok(())
                    }
                })
                .await;
                let before = store.request(Operation::ReadVerified).await.unwrap();
                assert!(
                    store
                        .request(recovery_operation(&before, "patch", patch.as_ref()))
                        .await
                        .is_err()
                );
                drop(store);
                let installed = recovery_bytes(root.path());
                let pending = std::fs::read(planning(root.path()).join(INTENT)).unwrap();
                let root_path = planning(root.path());
                let hit = Arc::new(AtomicBool::new(false));
                let probe_hit = hit.clone();
                let mut syncing = String::new();
                let result = Store::open(
                    Filesystem::new(&root_path)
                        .unwrap()
                        .with_probe(move |seen, path| {
                            if seen == Stage::RecoverySync {
                                syncing = path.file_name().unwrap().to_string_lossy().into_owned();
                            }
                            let matches = if target == INTENT {
                                !root_path.join(INTENT).exists()
                            } else if stage == Stage::DirectorySync {
                                syncing == target
                            } else {
                                path.ends_with(target)
                            };
                            if seen == stage && matches {
                                probe_hit.store(true, Ordering::SeqCst);
                                Err(Error::Io("resync/removal injected".into()))
                            } else {
                                Ok(())
                            }
                        }),
                    Allow,
                )
                .await;
                assert!(result.is_err(), "acknowledged {stage:?} {target}");
                assert!(hit.load(Ordering::SeqCst), "missed {stage:?} {target}");
                assert_eq!(recovery_bytes(root.path()), installed);
                if target != INTENT {
                    assert_eq!(
                        std::fs::read(planning(root.path()).join(INTENT)).unwrap(),
                        pending
                    );
                }
                let recovered = open(root.path()).await;
                let view = recovered.request(Operation::ReadVerified).await.unwrap();
                assert_recovery_once(root.path(), "patch", &before, &view);
                assert_eq!(
                    recovered
                        .request(recovery_operation(&before, "patch", patch.as_ref()))
                        .await
                        .unwrap(),
                    view
                );
                assert_eq!(recovery_bytes(root.path()), installed);
            });
        }
    }
}

#[test]
fn scoped_recovery_reloads_policy_before_any_participant_write() {
    struct Reload(std::path::PathBuf);
    impl Policy for Reload {
        fn validate(&mut self, context: &MutationContext<'_>) -> Result<()> {
            assert_eq!(context.operation, "recovery");
            if std::fs::read(&self.0).unwrap() == b"deny" {
                Err(Error::Policy("changed policy".into()))
            } else {
                Ok(())
            }
        }
    }
    let (root, patch) = recovery_template("patch");
    runtime().block_on(async {
        let store = open_with_probe(root.path(), |stage, path| {
            if stage == Stage::Confirmation && path.ends_with(INTENT) {
                Err(Error::Io("intent confirmed failure".into()))
            } else {
                Ok(())
            }
        })
        .await;
        let view = store.request(Operation::ReadVerified).await.unwrap();
        assert!(
            store
                .request(recovery_operation(&view, "patch", patch.as_ref()))
                .await
                .is_err()
        );
        drop(store);
        let before = recovery_bytes(root.path());
        let intent = std::fs::read(planning(root.path()).join(INTENT)).unwrap();
        let policy = root.path().join("policy");
        std::fs::write(&policy, b"deny").unwrap();
        assert!(matches!(
            Store::open(
                Filesystem::new(planning(root.path())).unwrap(),
                Reload(policy.clone())
            )
            .await,
            Err(Error::Policy(_))
        ));
        assert_eq!(recovery_bytes(root.path()), before);
        assert_eq!(
            std::fs::read(planning(root.path()).join(INTENT)).unwrap(),
            intent
        );
        std::fs::write(&policy, b"allow").unwrap();
        let recovered = Store::open(
            Filesystem::new(planning(root.path())).unwrap(),
            Reload(policy),
        )
        .await
        .unwrap();
        let after = recovered.request(Operation::Read).await.unwrap();
        assert_recovery_once(root.path(), "patch", &view, &after);
    });
}

#[test]
fn scoped_restart_child() {
    let Some(root) = std::env::var_os("CADENCE_SCOPED_ROOT") else {
        return;
    };
    let root = PathBuf::from(root);
    let case = std::env::var("CADENCE_SCOPED_CASE").unwrap();
    let barrier = std::env::var("CADENCE_SCOPED_BARRIER").unwrap();
    let probe_barrier = barrier.clone();
    runtime().block_on(async {
        let store = open_with_probe(&root,move |stage,path| {
            let name = format!("{stage:?}:{}",path.file_name().unwrap().to_string_lossy());
            if name == probe_barrier {
                println!("SCOPED_BARRIER:{name}");
                std::io::stdout().flush().unwrap();
                loop {std::thread::park();}
            }
            Ok(())
        }).await;
        let view = store.request(Operation::ReadVerified).await.unwrap();
        let operation = recovery_operation(&view,&case,None);
        let Operation::BoundaryV1 {decision,..} = &operation else {unreachable!()};
        let decision = decision.clone();
        let result = store.request(operation).await.unwrap();
        let selected = confirmed_boundary(&result,&decision).unwrap();
        let answer = selected.envelope(None).unwrap();
        if barrier == "confirmed" {
            println!("SCOPED_BARRIER:confirmed");
            std::io::stdout().flush().unwrap();
            loop {std::thread::park();}
        }
        println!("SCOPED_RESULT {}",json!({"answer":answer,"digest":selected.value.boundary.response_digest,"generation":result.snapshot.generation}));
    });
}

fn scoped_child(root: &Path, case: &str, barrier: &str) -> Command {
    let mut command = Command::new(std::env::current_exe().unwrap());
    command
        .args(["--exact", "scoped_restart_child", "--nocapture"])
        .env("CADENCE_SCOPED_ROOT", root)
        .env("CADENCE_SCOPED_CASE", case)
        .env("CADENCE_SCOPED_BARRIER", barrier)
        .stdin(Stdio::null());
    command
}

fn scoped_kill(root: &Path, case: &str, barrier: &str) {
    let mut child = scoped_child(root, case, barrier)
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .unwrap();
    let stdout = child.stdout.take().unwrap();
    let expected = format!("SCOPED_BARRIER:{barrier}");
    let (sender, receiver) = std::sync::mpsc::channel();
    let reader = std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            if line.unwrap() == expected {
                let _ = sender.send(());
                return;
            }
        }
    });
    let reached = receiver.recv_timeout(Duration::from_secs(10));
    child.kill().unwrap();
    let status = child.wait().unwrap();
    reader.join().unwrap();
    assert!(reached.is_ok(), "missed {case} {barrier}");
    use std::os::unix::process::ExitStatusExt;
    assert_eq!(status.signal(), Some(libc::SIGKILL));
}

fn scoped_read(root: &Path, case: &str) -> Value {
    let output = scoped_child(root, case, "read").output().unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    serde_json::from_str(
        String::from_utf8(output.stdout)
            .unwrap()
            .lines()
            .find_map(|line| line.strip_prefix("SCOPED_RESULT "))
            .unwrap(),
    )
    .unwrap()
}

#[test]
fn scoped_refusal_and_terminal_kills_recover_one_identical_answer_without_semantic_changes() {
    for case in ["refusal", "terminal"] {
        let (template, _) = recovery_template(case);
        for barrier in [
            "TemporarySynced:.store-intent.json",
            "Renamed:.store-intent.json",
            "Confirmation:.store-intent.json",
            "Renamed:decisions.jsonl",
            "Renamed:state.json",
            "confirmed",
        ] {
            let root = copy_recovery_template(template.path());
            let before = runtime().block_on(async {
                open(root.path())
                    .await
                    .request(Operation::ReadVerified)
                    .await
                    .unwrap()
            });
            let bytes = recovery_bytes(root.path());
            scoped_kill(root.path(), case, barrier);
            if barrier == "TemporarySynced:.store-intent.json" {
                assert_eq!(recovery_bytes(root.path()), bytes);
                assert!(!planning(root.path()).join(INTENT).exists());
            } else if barrier != "confirmed" {
                assert!(planning(root.path()).join(INTENT).exists());
            }
            if matches!(barrier, "Renamed:decisions.jsonl" | "Renamed:state.json") {
                scoped_kill(root.path(), case, "RecoverySync:decisions.jsonl");
            }
            let first = scoped_read(root.path(), case);
            assert_eq!(
                first["digest"],
                digest(&independent_canonical(&first["answer"]))
            );
            assert_eq!(first["answer"]["status"], "refused");
            assert_eq!(
                first["answer"]["code"],
                if case == "terminal" {
                    "log-bound"
                } else {
                    "invalid-input"
                }
            );
            let after = runtime().block_on(async {
                open(root.path())
                    .await
                    .request(Operation::ReadVerified)
                    .await
                    .unwrap()
            });
            assert_recovery_once(root.path(), case, &before, &after);
            let Decision::BoundaryV1(last) = &after.decisions.last().unwrap().decision else {
                unreachable!()
            };
            assert_eq!(first["digest"], last.boundary.response_digest);
            let stable = recovery_bytes(root.path());
            assert_eq!(scoped_read(root.path(), case), first);
            assert_eq!(recovery_bytes(root.path()), stable);
        }
    }
}

// PLAN-3 repair inventory, alongside the unchanged PLAN-1 inventories.
// The four harness shards collectively cover M1-M7. Each row is registered
// and executed here; names alone cannot satisfy a repair obligation.
#[test]
fn phase_six_store_repair_inventory_runs_registered_evidence() {
    let rows: [(&str, &str, fn()); 6] = [
        (
            "M3",
            "scoped_budgets_admit_256_plus_terminal_and_reopen_never_grows_either_scope",
            scoped_budgets_admit_256_plus_terminal_and_reopen_never_grows_either_scope,
        ),
        (
            "M4",
            "scoped_writer_confirms_dispatch_complete_blocked_and_observation_public_digests",
            scoped_writer_confirms_dispatch_complete_blocked_and_observation_public_digests,
        ),
        (
            "M7",
            "scoped_intent_and_changed_participant_failures_never_acknowledge",
            scoped_intent_and_changed_participant_failures_never_acknowledge,
        ),
        (
            "M7",
            "scoped_recovery_resync_and_intent_removal_failures_never_acknowledge",
            scoped_recovery_resync_and_intent_removal_failures_never_acknowledge,
        ),
        (
            "M7",
            "scoped_recovery_reloads_policy_before_any_participant_write",
            scoped_recovery_reloads_policy_before_any_participant_write,
        ),
        (
            "M7",
            "scoped_refusal_and_terminal_kills_recover_one_identical_answer_without_semantic_changes",
            scoped_refusal_and_terminal_kills_recover_one_identical_answer_without_semantic_changes,
        ),
    ];
    assert_eq!(
        rows.iter()
            .map(|row| row.0)
            .collect::<std::collections::BTreeSet<_>>(),
        std::collections::BTreeSet::from(["M3", "M4", "M7"])
    );
    let listing = std::process::Command::new(std::env::current_exe().unwrap())
        .arg("--list")
        .stdin(std::process::Stdio::null())
        .output()
        .unwrap();
    assert!(listing.status.success());
    let listing = String::from_utf8(listing.stdout).unwrap();
    for (criterion, name, run) in rows {
        assert!(
            listing.lines().any(|line| line == format!("{name}: test")),
            "{criterion} repair evidence is not registered: {name}"
        );
        run();
        println!("{criterion} repair evidence passed: {name}");
    }
}
