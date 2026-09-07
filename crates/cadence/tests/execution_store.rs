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
        b"---\nphase: 6\nplan: 1\nrequirements: [AC4, AC5]\nfiles: [src/lib.rs]\nexecution:\n  schema: 1\n  suite: cargo test\n  tasks:\n    - id: T1\n      verify: [cargo test one]\n    - id: T2\n      verify: [cargo test two]\n---\nBuild the execution slice.\n",
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
