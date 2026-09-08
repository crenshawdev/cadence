use super::{
    CadenceServer,
    derivation_service::{Driver, Event},
    evidence_service::Command as EvidenceCommand,
    execution_service,
};
use crate::import::SessionFactory;
use cadence::envelope::Envelope;
use cadence::execution::boundary::{ExecutionEnvelope, Success};
use cadence::{
    derivation::LifecycleStatus,
    evidence::{
        self, Fact, Record,
        gates::{Answer, Disposition, Gate, Purpose, State},
    },
    execution::model::{
        ActiveDispatch, Blocker, CommandReceipt, EvidenceReference, ExecutionSnapshot,
        ExecutorPatch, PATCH_SCHEMA, PatchKind, PlanDisposition, TaskOutcome,
        VerificationDisposition, VerificationReceipt,
    },
    store::{
        filesystem::Stage,
        model::{Decision, DecisionRecord},
        transaction::INTENT,
        writer::Operation,
    },
};
use std::{
    fs,
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};

const OUTPUT_DIGEST: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

struct Fixture {
    _temp: tempfile::TempDir,
    project: PathBuf,
    root: PathBuf,
    allowed_signers: PathBuf,
}

fn runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Runtime::new().unwrap()
}

fn factory() -> SessionFactory {
    SessionFactory::new(None, Arc::new(|_, _| Ok(())))
}

fn run(project: &Path, args: &[&str]) -> String {
    let output = Command::new("git")
        .arg("-C")
        .arg(project)
        .args(args)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "git {} failed: {}",
        args.join(" "),
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8(output.stdout).unwrap().trim().to_owned()
}

fn plan_source(phase: u32, plan: u32, files: &[&str], tasks: &[&str], body: &str) -> String {
    let tasks = tasks
        .iter()
        .map(|task| format!("    - id: {task}\n      verify: [verify-{task}]\n"))
        .collect::<String>();
    format!(
        "---\nphase: {phase}\nplan: {plan}\nrequirements: [AC4]\nfiles: [{}]\nexecution:\n  schema: 1\n  suite: suite-command\n  tasks:\n{tasks}---\n{body}",
        files.join(", ")
    )
}

fn fixture(specs: &[(&[&str], &[&str], &str)]) -> Fixture {
    let temp = tempfile::tempdir().unwrap();
    let project = temp.path().to_path_buf();
    let root = project.join(".planning");
    let phase = root.join("phases/6");
    fs::create_dir_all(phase.join("reports")).unwrap();
    fs::write(
        root.join("ROADMAP.md"),
        "## Phases\n- [ ] **Phase 6: Native execution**\n",
    )
    .unwrap();
    fs::write(root.join("config.json"), serde_json::to_vec(&serde_json::json!({"review":{"triggers":{"risk_surface":{"surfaces":cadence::rail::risk::CATEGORIES}}}})).unwrap()).unwrap();
    for (index, (files, tasks, body)) in specs.iter().enumerate() {
        fs::write(
            phase.join(format!("PLAN-{}.md", index + 1)),
            plan_source(6, (index + 1) as u32, files, tasks, body),
        )
        .unwrap();
    }

    run(&project, &["init", "-q"]);
    run(&project, &["config", "user.name", "Executor Fixture"]);
    run(&project, &["config", "user.email", "executor@example.com"]);
    let key = project.join("executor-signing-key");
    let key_text = key.to_string_lossy().into_owned();
    let key_output = Command::new("ssh-keygen")
        .args([
            "-q",
            "-t",
            "ed25519",
            "-N",
            "",
            "-C",
            "executor@example.com",
            "-f",
            &key_text,
        ])
        .output()
        .unwrap();
    assert!(
        key_output.status.success(),
        "ssh-keygen failed: {}",
        String::from_utf8_lossy(&key_output.stderr)
    );
    let allowed_signers = project.join("allowed-signers");
    fs::write(
        &allowed_signers,
        format!(
            "executor@example.com {}\n",
            fs::read_to_string(key.with_extension("pub"))
                .unwrap()
                .trim()
        ),
    )
    .unwrap();
    run(&project, &["config", "gpg.format", "ssh"]);
    run(&project, &["config", "user.signingkey", &key_text]);
    run(
        &project,
        &[
            "config",
            "gpg.ssh.allowedSignersFile",
            &allowed_signers.to_string_lossy(),
        ],
    );
    run(&project, &["config", "commit.gpgsign", "true"]);
    run(&project, &["add", ".planning"]);
    run(
        &project,
        &[
            "-c",
            "commit.gpgsign=false",
            "commit",
            "-q",
            "-m",
            "chore: initialize execution fixture",
        ],
    );
    Fixture {
        _temp: temp,
        project,
        root,
        allowed_signers,
    }
}

async fn accept(server: &CadenceServer, fixture: &Fixture) {
    let lifecycle = server.lifecycle(&fixture.root).await.unwrap();
    assert_eq!(lifecycle.phases[0].status, LifecycleStatus::Planned);
    let scope = execution_service::continuation_scope(&fixture.root, 6);
    let gate = Gate {
        id: "execution-acceptance".into(),
        purpose: Purpose::Progress,
        checkpoint_id: None,
        question: "Continue native execution?".into(),
        need: "Accept this execution occurrence".into(),
        options: vec![],
        state: State::Unanswered,
    };
    let record = |gate| Record {
        version: evidence::VERSION,
        scope: scope.clone(),
        fact: Fact::Gate(gate),
    };
    server
        .evidence(
            &fixture.root,
            EvidenceCommand::Submit {
                operation_id: "execution-acceptance-question".into(),
                record: Box::new(record(gate.clone())),
            },
        )
        .await
        .unwrap();
    let mut answered = gate;
    answered.state = State::Answered(Answer {
        question_id: answered.id.clone(),
        actual_response: "Proceed with this phase".into(),
        selected_option: None,
        adjustment: None,
        disposition: Disposition::Approve,
        authorization_id: Some("operator-execution-acceptance".into()),
    });
    server
        .evidence(
            &fixture.root,
            EvidenceCommand::Submit {
                operation_id: "execution-acceptance-answer".into(),
                record: Box::new(record(answered)),
            },
        )
        .await
        .unwrap();
}

async fn dispatch(server: &CadenceServer, fixture: &Fixture) -> ActiveDispatch {
    let Envelope::Ok(Success::Dispatch { dispatch, prompt }) =
        server.query_execution(&fixture.root, 6).await.unwrap()
    else {
        panic!("expected a dispatch")
    };
    assert_eq!(prompt.len() as u64, dispatch.prompt_bytes);
    assert!(prompt.contains(&dispatch.body));
    *dispatch
}

fn commit(fixture: &Fixture, name: &str, subject: &str, signed: bool) -> String {
    let relative = format!("work/{name}.txt");
    let path = fixture.project.join(&relative);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(&path, format!("content for {name}\n")).unwrap();
    run(&fixture.project, &["add", &relative]);
    if signed {
        run(&fixture.project, &["commit", "-q", "-m", subject]);
    } else {
        run(
            &fixture.project,
            &["-c", "commit.gpgsign=false", "commit", "-q", "-m", subject],
        );
    }
    run(&fixture.project, &["rev-parse", "HEAD"])
}

async fn scan_execution(
    server: &CadenceServer,
    root: &Path,
    dispatch: &ActiveDispatch,
    id: &str,
) -> cadence::rail::receipts::Report {
    use cadence::rail::{receipts, risk};
    let scope = risk::ScopeSelection {
        phase: dispatch.phase.try_into().unwrap(),
        occurrence: format!("phase-{}-execution", dispatch.phase),
        worker: Some(dispatch.plan.to_string()),
    };
    let source = risk::Source::Execution {
        plan: dispatch.plan.try_into().unwrap(),
        dispatch_id: dispatch.id.clone(),
    };
    let scan = server
        .service
        .apply_rail(
            root,
            risk::Apply::RiskCheck {
                request_id: id.into(),
                scope: scope.clone(),
                source: source.clone(),
                surfaces: None,
            },
        )
        .await
        .unwrap();
    assert!(matches!(scan, Envelope::Ok(_)), "{scan:?}");
    let answer = server
        .service
        .rail_receipt(
            root,
            super::rail_service::ReceiptCommand::Status(receipts::Query {
                scope,
                source,
                surfaces: None,
            }),
        )
        .await
        .unwrap();
    match answer {
        Envelope::Ok(super::rail_service::ReceiptOutput::Status(report)) => *report,
        _ => panic!("risk status did not return a report"),
    }
}

async fn settle_execution(server: &CadenceServer, root: &Path, dispatch: &ActiveDispatch) {
    let report = scan_execution(server, root, dispatch, &format!("clear-{}", dispatch.id)).await;
    assert_eq!(
        report.assessment.state,
        cadence::rail::receipts::State::Clear
    );
    assert!(report.assessment.permits_continuation);
}

fn assert_pending(answer: ExecutionEnvelope) -> ExecutionEnvelope {
    assert!(
        matches!(&answer, Envelope::Refused { code, .. } if code == "risk-pending"),
        "{answer:?}"
    );
    answer
}

fn completed(task_id: &str, commit: &str) -> TaskOutcome {
    TaskOutcome::Completed {
        task_id: task_id.into(),
        commit: commit.into(),
        verification: VerificationReceipt {
            disposition: VerificationDisposition::Passed,
            commands: vec![CommandReceipt {
                command: format!("verify-{task_id}"),
                exit_code: 0,
                output_digest: OUTPUT_DIGEST.into(),
            }],
        },
        evidence: vec![EvidenceReference::Commit { sha: commit.into() }],
    }
}

fn complete_patch(dispatch: &ActiveDispatch, commits: &[&str]) -> ExecutorPatch {
    ExecutorPatch {
        schema: PATCH_SCHEMA,
        kind: PatchKind::Executor,
        dispatch_id: dispatch.id.clone(),
        expected_execution_version: dispatch.expected_execution_version,
        outcome: PlanDisposition::Complete,
        tasks: dispatch
            .tasks
            .iter()
            .zip(commits)
            .map(|(task, commit)| completed(&task.id, commit))
            .collect(),
        deviations: vec![],
        blockers: vec![],
    }
}

fn refusal_code(response: ExecutionEnvelope) -> String {
    let Envelope::Refused { code, .. } = response else {
        panic!("expected refusal, got {response:?}")
    };
    code
}

#[test]
fn resident_selects_overlap_graph_durably_and_ignores_report_bodies() {
    runtime().block_on(async {
        let fixture = fixture(&[
            (&["src/a.rs", "work/one.txt"], &["T1"], "first body\n"),
            (&["src/b.rs", "work/two.txt"], &["T2"], "second body\n"),
            (&["src/a.rs"], &["T3"], "third body\n"),
        ]);
        let server = CadenceServer::with_factory(factory());
        accept(&server, &fixture).await;
        fs::write(
            fixture.root.join("phases/6/reports/plan-1.md"),
            "opaque report words cannot select a plan\n",
        )
        .unwrap();
        let first = dispatch(&server, &fixture).await;
        assert_eq!(first.plan, 1, "lowest independent ready plan wins");
        let stored = server
            .store(&fixture.root, Operation::ReadVerified)
            .await
            .unwrap();
        let execution: ExecutionSnapshot =
            serde_json::from_value(stored.snapshot.data["execution"].clone()).unwrap();
        assert_eq!(
            execution.occurrences["6"].active.as_ref().unwrap().id,
            first.id
        );

        fs::write(
            fixture.root.join("phases/6/reports/plan-1.md"),
            "entirely different report body\n",
        )
        .unwrap();
        let replay = dispatch(&server, &fixture).await;
        assert_eq!(replay, first);
        fs::remove_file(fixture.root.join("phases/6/reports/plan-1.md")).unwrap();
        assert_eq!(dispatch(&server, &fixture).await, first);

        let first_commit = commit(&fixture, "one", "feat(phase-6): complete T1", true);
        assert_pending(
            server
                .apply_executor_patch(&fixture.root, complete_patch(&first, &[&first_commit]))
                .await
                .unwrap(),
        );
        assert_pending(server.query_execution(&fixture.root, 6).await.unwrap());
        settle_execution(&server, &fixture.root, &first).await;
        let second = dispatch(&server, &fixture).await;
        assert_eq!(second.plan, 2);
        let second_commit = commit(&fixture, "two", "feat(phase-6): complete T2", true);
        assert_pending(
            server
                .apply_executor_patch(&fixture.root, complete_patch(&second, &[&second_commit]))
                .await
                .unwrap(),
        );
        assert_pending(server.query_execution(&fixture.root, 6).await.unwrap());
        settle_execution(&server, &fixture.root, &second).await;
        assert_eq!(dispatch(&server, &fixture).await.plan, 3);
    });
}

#[test]
fn lifecycle_continuation_and_changed_plan_inputs_refuse_dispatch() {
    runtime().block_on(async {
        let unaccepted = fixture(&[(&["src/a.rs"], &["T1"], "body\n")]);
        let server = CadenceServer::with_factory(factory());
        assert_eq!(
            refusal_code(server.query_execution(&unaccepted.root, 6).await.unwrap()),
            "continuation-refusal"
        );

        let complete = fixture(&[(&["src/a.rs"], &["T1"], "body\n")]);
        fs::write(
            complete.root.join("ROADMAP.md"),
            "## Phases\n- [x] **Phase 6: Native execution**\n",
        )
        .unwrap();
        fs::write(complete.root.join("phases/6/SUMMARY.md"), "complete\n").unwrap();
        fs::write(
            complete.root.join("phases/6/UAT.md"),
            "### 1. Verify\nstatus: pass\n",
        )
        .unwrap();
        let server = CadenceServer::with_factory(factory());
        let response = server.query_execution(&complete.root, 6).await.unwrap();
        assert!(matches!(response, Envelope::Refused { .. }));

        let changed = fixture(&[(&["src/a.rs"], &["T1"], "original body\n")]);
        let accepting = CadenceServer::with_factory(factory());
        accept(&accepting, &changed).await;
        drop(accepting);
        let once = Arc::new(AtomicBool::new(false));
        let path = changed.root.join("phases/6/PLAN-1.md");
        let driver = Driver {
            event: Arc::new(move |event| {
                if event == Event::RoutingObserved && !once.swap(true, Ordering::SeqCst) {
                    fs::write(
                        &path,
                        plan_source(6, 1, &["src/a.rs"], &["T1"], "changed body\n"),
                    )
                    .unwrap();
                }
            }),
            ..Driver::default()
        };
        let server = CadenceServer::with_derivation_driver(factory(), driver);
        assert_eq!(
            refusal_code(server.query_execution(&changed.root, 6).await.unwrap()),
            "inputs-changed"
        );
        let view = server
            .store(&changed.root, Operation::ReadVerified)
            .await
            .unwrap();
        assert!(view.snapshot.data.get("execution").is_none());
    });
}

#[test]
fn signed_commits_apply_in_strict_order_and_paths_survive_replay() {
    runtime().block_on(async {
        let fixture = fixture(&[(
            &["src/a.rs", "work/one.txt", "work/two.txt"],
            &["T1", "T2"],
            "ordered body\n",
        )]);
        let server = CadenceServer::with_factory(factory());
        accept(&server, &fixture).await;
        let dispatch = dispatch(&server, &fixture).await;
        let first = commit(&fixture, "one", "feat(phase-6): complete T1", true);
        let second = commit(&fixture, "two", "fix(phase-6): complete T2", true);
        let patch = complete_patch(&dispatch, &[&first, &second]);
        let pending = assert_pending(
            server
                .apply_executor_patch(&fixture.root, patch.clone())
                .await
                .unwrap(),
        );
        settle_execution(&server, &fixture.root, &dispatch).await;
        assert_eq!(
            server.query_execution(&fixture.root, 6).await.unwrap(),
            Envelope::Ok(Success::Complete { phase: 6 })
        );
        assert_eq!(
            server
                .apply_executor_patch(&fixture.root, patch)
                .await
                .unwrap(),
            pending
        );
        let view = server
            .store(&fixture.root, Operation::ReadVerified)
            .await
            .unwrap();
        let execution: ExecutionSnapshot =
            serde_json::from_value(view.snapshot.data["execution"].clone()).unwrap();
        let outcome = &execution.occurrences["6"].plans[0];
        assert_eq!(outcome.commit_paths[&first], ["work/one.txt"]);
        assert_eq!(outcome.commit_paths[&second], ["work/two.txt"]);
        assert!(matches!(
            execution.occurrences["6"].terminal,
            Some(cadence::execution::model::TerminalOutcome::Complete { phase: 6 })
        ));
    });
}

#[test]
fn missing_unsigned_reused_reordered_bad_and_mismatched_commits_refuse() {
    runtime().block_on(async {
        async fn ready(tasks: &[&str]) -> (Fixture, CadenceServer, ActiveDispatch) {
            let fixture = fixture(&[(
                &[
                    "src/a.rs",
                    "work/unsigned.txt",
                    "work/shared.txt",
                    "work/first.txt",
                    "work/second.txt",
                    "work/mismatch.txt",
                    "work/untrusted.txt",
                ],
                tasks,
                "body\n",
            )]);
            let server = CadenceServer::with_factory(factory());
            accept(&server, &fixture).await;
            let dispatch = dispatch(&server, &fixture).await;
            (fixture, server, dispatch)
        }

        let (fixture, server, dispatch) = ready(&["T1"]).await;
        assert_eq!(
            refusal_code(
                server
                    .apply_executor_patch(
                        &fixture.root,
                        complete_patch(&dispatch, &["1111111111111111111111111111111111111111"],),
                    )
                    .await
                    .unwrap()
            ),
            "missing-commit"
        );

        let (fixture, server, dispatch) = ready(&["T1"]).await;
        let unsigned = commit(&fixture, "unsigned", "feat: complete T1", false);
        assert_eq!(
            refusal_code(
                server
                    .apply_executor_patch(&fixture.root, complete_patch(&dispatch, &[&unsigned]),)
                    .await
                    .unwrap()
            ),
            "bad-signature"
        );

        let (fixture, server, dispatch) = ready(&["T1", "T2"]).await;
        let shared = commit(&fixture, "shared", "feat: complete T1 and T2", true);
        assert_eq!(
            refusal_code(
                server
                    .apply_executor_patch(
                        &fixture.root,
                        complete_patch(&dispatch, &[&shared, &shared]),
                    )
                    .await
                    .unwrap()
            ),
            "reused-commit"
        );

        let (fixture, server, dispatch) = ready(&["T1", "T2"]).await;
        let first = commit(&fixture, "first", "feat: complete T1 and T2 first", true);
        let second = commit(&fixture, "second", "feat: complete T1 and T2 second", true);
        assert_eq!(
            refusal_code(
                server
                    .apply_executor_patch(
                        &fixture.root,
                        complete_patch(&dispatch, &[&second, &first]),
                    )
                    .await
                    .unwrap()
            ),
            "git-order"
        );

        let (fixture, server, dispatch) = ready(&["T1"]).await;
        let mismatch = commit(&fixture, "mismatch", "feat: complete something else", true);
        assert_eq!(
            refusal_code(
                server
                    .apply_executor_patch(&fixture.root, complete_patch(&dispatch, &[&mismatch]),)
                    .await
                    .unwrap()
            ),
            "commit-subject"
        );

        let (fixture, server, dispatch) = ready(&["T1"]).await;
        let untrusted = commit(&fixture, "untrusted", "feat: complete T1", true);
        fs::write(&fixture.allowed_signers, "").unwrap();
        assert_eq!(
            refusal_code(
                server
                    .apply_executor_patch(&fixture.root, complete_patch(&dispatch, &[&untrusted]),)
                    .await
                    .unwrap()
            ),
            "bad-signature"
        );
    });
}

#[test]
fn blocked_patch_persists_judgment_stop_without_dispatching_more_work() {
    runtime().block_on(async {
        let fixture = fixture(&[(&["src/a.rs"], &["T1", "T2"], "body\n")]);
        let server = CadenceServer::with_factory(factory());
        accept(&server, &fixture).await;
        let dispatch = dispatch(&server, &fixture).await;
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
                text: "operator judgment is required".into(),
                evidence: vec![EvidenceReference::Criterion { id: "AC4".into() }],
            }],
        };
        let expected = Envelope::Ok(Success::JudgmentStop {
            phase: 6,
            dispatch_id: dispatch.id,
            blocker_ids: vec!["B1".into()],
        });
        assert_eq!(
            server
                .apply_executor_patch(&fixture.root, patch)
                .await
                .unwrap(),
            expected
        );
        assert_eq!(
            server.query_execution(&fixture.root, 6).await.unwrap(),
            expected
        );
    });
}

fn restart_barrier(name: &str) -> ! {
    println!("EXECUTION_BARRIER:{name}");
    std::io::stdout().flush().unwrap();
    loop {
        std::thread::park();
    }
}

fn child_patch() -> ExecutorPatch {
    serde_json::from_str(&std::env::var("CADENCE_EXECUTION_PATCH").unwrap()).unwrap()
}

#[test]
fn execution_restart_child() {
    let Some(root) = std::env::var_os("CADENCE_EXECUTION_ROOT") else {
        return;
    };
    let root = PathBuf::from(root);
    let phase: u32 = std::env::var("CADENCE_EXECUTION_PHASE")
        .unwrap()
        .parse()
        .unwrap();
    let mode = std::env::var("CADENCE_EXECUTION_MODE").unwrap();
    runtime().block_on(async {
        match mode.as_str() {
            "before-admission" => restart_barrier("before-admission"),
            "dispatch-lost" => {
                let server = CadenceServer::with_factory(factory());
                assert!(matches!(
                    server.query_execution(&root, phase).await.unwrap(),
                    Envelope::Ok(Success::Dispatch { .. })
                ));
                restart_barrier("dispatch-confirmed");
            }
            "apply-lost" => {
                let server = CadenceServer::with_factory(factory());
                assert_pending(
                    server
                        .apply_executor_patch(&root, child_patch())
                        .await
                        .unwrap(),
                );
                restart_barrier("patch-confirmed");
            }
            "summary-partial" => {
                let armed = Arc::new(AtomicBool::new(false));
                let probe_armed = armed.clone();
                let factory = factory().with_probe(Arc::new(move |stage, path| {
                    if probe_armed.load(Ordering::SeqCst)
                        && stage == Stage::Renamed
                        && path.ends_with("SUMMARY.md")
                    {
                        restart_barrier("summary-installed");
                    }
                    Ok(())
                }));
                let server = CadenceServer::with_factory(factory);
                armed.store(true, Ordering::SeqCst);
                let _ = server
                    .apply_executor_patch(&root, child_patch())
                    .await
                    .unwrap();
                panic!("summary barrier was not reached");
            }
            "read-query" => {
                let server = CadenceServer::with_factory(factory());
                println!(
                    "EXECUTION_RESULT {}",
                    serde_json::to_string(&server.query_execution(&root, phase).await.unwrap())
                        .unwrap()
                );
            }
            "read-apply" => {
                let server = CadenceServer::with_factory(factory());
                println!(
                    "EXECUTION_RESULT {}",
                    serde_json::to_string(
                        &server
                            .apply_executor_patch(&root, child_patch())
                            .await
                            .unwrap()
                    )
                    .unwrap()
                );
            }
            mode if mode.contains('@') => {
                let (request, barrier) = mode.split_once('@').unwrap();
                let barrier = barrier.to_owned();
                let probe_barrier = barrier.clone();
                let factory = factory().with_probe(Arc::new(move |stage, path| {
                    if probe_barrier
                        == format!("{stage:?}:{}", path.file_name().unwrap().to_string_lossy())
                    {
                        restart_barrier(&probe_barrier);
                    }
                    Ok(())
                }));
                let server = CadenceServer::with_factory(factory);
                let answer = if request == "apply" {
                    server
                        .apply_executor_patch(&root, child_patch())
                        .await
                        .unwrap()
                } else {
                    server.query_execution(&root, phase).await.unwrap()
                };
                if barrier == "confirmed" {
                    println!("EXECUTION_CONFIRMED {}", actual_digest(&answer));
                    restart_barrier("confirmed");
                }
                panic!("boundary was not reached: {barrier}");
            }
            other => panic!("unknown execution child mode: {other}"),
        }
    });
}

fn execution_child(root: &Path, mode: &str, patch: Option<&ExecutorPatch>) -> Command {
    let mut command = Command::new(std::env::current_exe().unwrap());
    command
        .args([
            "--exact",
            "server::execution_service_tests::execution_restart_child",
            "--nocapture",
        ])
        .env("CADENCE_EXECUTION_ROOT", root)
        .env("CADENCE_EXECUTION_PHASE", "6")
        .env("CADENCE_EXECUTION_MODE", mode)
        .stdin(Stdio::null());
    if let Some(patch) = patch {
        command.env(
            "CADENCE_EXECUTION_PATCH",
            serde_json::to_string(patch).unwrap(),
        );
    } else {
        command.env_remove("CADENCE_EXECUTION_PATCH");
    }
    command
}

fn kill_execution_child(root: &Path, mode: &str, barrier: &str, patch: Option<&ExecutorPatch>) {
    let mut child = execution_child(root, mode, patch)
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .unwrap();
    let stdout = child.stdout.take().unwrap();
    let expected = format!("EXECUTION_BARRIER:{barrier}");
    let (sender, receiver) = std::sync::mpsc::channel();
    let reader = std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            let line = line.unwrap();
            if line == expected {
                let _ = sender.send(());
                return;
            }
        }
    });
    let reached = receiver.recv_timeout(Duration::from_secs(10));
    child.kill().unwrap();
    let status = child.wait().unwrap();
    reader.join().unwrap();
    assert!(reached.is_ok(), "execution child missed {barrier}");
    assert!(!status.success());
    #[cfg(unix)]
    {
        use std::os::unix::process::ExitStatusExt;
        assert_eq!(status.signal(), Some(libc::SIGKILL));
    }
}

fn execution_child_result(
    root: &Path,
    mode: &str,
    patch: Option<&ExecutorPatch>,
) -> ExecutionEnvelope {
    let output = execution_child(root, mode, patch).output().unwrap();
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
            .find_map(|line| line.strip_prefix("EXECUTION_RESULT "))
            .expect("fresh execution child returned no result"),
    )
    .unwrap()
}

fn boundary_count(root: &Path) -> usize {
    fs::read_to_string(root.join("decisions.jsonl"))
        .unwrap_or_default()
        .lines()
        .map(|line| serde_json::from_str::<DecisionRecord>(line).unwrap())
        .filter(|record| matches!(record.decision, Decision::BoundaryV1(_)))
        .count()
}

#[test]
fn execution_restart_dispatch_recovery_distinguishes_pre_admission() {
    runtime().block_on(async {
        let not_admitted = fixture(&[(&["src/a.rs"], &["T1"], "pre-admission body\n")]);
        let server = CadenceServer::with_factory(factory());
        accept(&server, &not_admitted).await;
        drop(server);
        kill_execution_child(
            &not_admitted.root,
            "before-admission",
            "before-admission",
            None,
        );
        assert_eq!(boundary_count(&not_admitted.root), 0);
        let Envelope::Ok(Success::Dispatch { dispatch, .. }) =
            execution_child_result(&not_admitted.root, "read-query", None)
        else {
            panic!("fresh process did not admit the first dispatch")
        };
        assert_eq!(dispatch.expected_execution_version, 1);
        assert_eq!(boundary_count(&not_admitted.root), 1);

        let admitted = fixture(&[(&["src/a.rs"], &["T1"], "persisted body 日本語\n")]);
        let server = CadenceServer::with_factory(factory());
        accept(&server, &admitted).await;
        drop(server);
        kill_execution_child(&admitted.root, "dispatch-lost", "dispatch-confirmed", None);
        assert_eq!(boundary_count(&admitted.root), 1);
        let Envelope::Ok(Success::Dispatch { dispatch, prompt }) =
            execution_child_result(&admitted.root, "read-query", None)
        else {
            panic!("fresh process did not recover the dispatch")
        };
        assert_eq!(boundary_count(&admitted.root), 1);
        assert_eq!(dispatch.expected_execution_version, 1);
        assert_eq!(dispatch.plan, 1);
        assert_eq!(dispatch.tasks[0].id, "T1");
        assert_eq!(dispatch.body, "persisted body 日本語\n");
        assert_eq!(
            dispatch.base_sha,
            run(&admitted.project, &["rev-parse", "HEAD"])
        );
        assert_eq!(prompt.len() as u64, dispatch.prompt_bytes);
    });
}

#[test]
fn execution_restart_lost_apply_replays_one_immutable_transition() {
    runtime().block_on(async {
        for plan_count in [1, 2] {
            let specs: Vec<(&[&str], &[&str], &str)> = if plan_count == 1 {
                vec![(&["src/a.rs", "work/lost.txt"], &["T1"], "one plan\n")]
            } else {
                vec![
                    (&["src/a.rs", "work/lost.txt"], &["T1"], "first plan\n"),
                    (&["src/b.rs"], &["T2"], "second plan\n"),
                ]
            };
            let fixture = fixture(&specs);
            let server = CadenceServer::with_factory(factory());
            accept(&server, &fixture).await;
            let dispatch = dispatch(&server, &fixture).await;
            drop(server);
            let sha = commit(&fixture, "lost", "feat: complete T1", true);
            let patch = complete_patch(&dispatch, &[&sha]);
            kill_execution_child(&fixture.root, "apply-lost", "patch-confirmed", Some(&patch));
            let decisions = fs::read(fixture.root.join("decisions.jsonl")).unwrap();
            let summary = fs::read(fixture.root.join("phases/6/SUMMARY.md")).unwrap();
            let response = execution_child_result(&fixture.root, "read-apply", Some(&patch));
            assert_pending(response.clone());
            assert_eq!(
                fs::read(fixture.root.join("decisions.jsonl")).unwrap(),
                decisions
            );
            assert_eq!(
                fs::read(fixture.root.join("phases/6/SUMMARY.md")).unwrap(),
                summary
            );
            assert_eq!(
                String::from_utf8(summary)
                    .unwrap()
                    .matches("| 1 | T1 | completed")
                    .count(),
                1
            );
            disk_answer(&fixture.root, &response);
            let server = CadenceServer::with_factory(factory());
            settle_execution(&server, &fixture.root, &dispatch).await;
            drop(server);
            if plan_count == 2 {
                let later = execution_child_result(&fixture.root, "read-query", None);
                assert!(matches!(later, Envelope::Ok(Success::Dispatch { ref dispatch, .. }) if dispatch.plan == 2));
                let before = ["state.json", "decisions.jsonl"].map(|name| fs::read(fixture.root.join(name)).unwrap());
                assert_eq!(execution_child_result(&fixture.root, "read-apply", Some(&patch)), response);
                assert_eq!(["state.json", "decisions.jsonl"].map(|name| fs::read(fixture.root.join(name)).unwrap()), before);
            }
        }
    });
}

#[test]
fn execution_restart_repairs_summary_before_final_state_confirmation() {
    runtime().block_on(async {
        let fixture = fixture(&[(
            &["src/a.rs", "work/summary.txt"],
            &["T1"],
            "summary recovery\n",
        )]);
        let server = CadenceServer::with_factory(factory());
        accept(&server, &fixture).await;
        let dispatch = dispatch(&server, &fixture).await;
        drop(server);
        let sha = commit(&fixture, "summary", "feat: complete T1", true);
        let patch = complete_patch(&dispatch, &[&sha]);
        kill_execution_child(
            &fixture.root,
            "summary-partial",
            "summary-installed",
            Some(&patch),
        );
        assert!(fixture.root.join(INTENT).exists());
        let installed = fs::read(fixture.root.join("phases/6/SUMMARY.md")).unwrap();
        assert!(String::from_utf8_lossy(&installed).contains(&sha));
        assert_pending(execution_child_result(
            &fixture.root,
            "read-apply",
            Some(&patch),
        ));
        assert!(!fixture.root.join(INTENT).exists());
        assert_eq!(
            fs::read(fixture.root.join("phases/6/SUMMARY.md")).unwrap(),
            installed
        );
        assert_eq!(
            String::from_utf8(installed)
                .unwrap()
                .matches("| 1 | T1 | completed")
                .count(),
            1
        );
        let server = CadenceServer::with_factory(factory());
        settle_execution(&server, &fixture.root, &dispatch).await;
        assert_eq!(
            server.query_execution(&fixture.root, 6).await.unwrap(),
            Envelope::Ok(Success::Complete { phase: 6 })
        );
    });
}

#[test]
fn execution_restart_each_dispatch_and_patch_barrier_recovers_one_confirmed_answer() {
    for request in ["query", "apply"] {
        let mut barriers = vec![
            "TemporarySynced:.store-intent.json",
            "Renamed:.store-intent.json",
            "Confirmation:.store-intent.json",
            "Renamed:decisions.jsonl",
            "Renamed:state.json",
            "confirmed",
        ];
        if request == "apply" {
            barriers.push("Renamed:SUMMARY.md");
        }
        for barrier in barriers {
            let fixture = fixture(&[(
                &["src/a.rs", "work/barrier.txt"],
                &["T1"],
                "barrier body 日本語\n",
            )]);
            let patch = runtime().block_on(async {
                let server = CadenceServer::with_factory(factory());
                accept(&server, &fixture).await;
                if request == "apply" {
                    let dispatch = dispatch(&server, &fixture).await;
                    let sha = commit(&fixture, "barrier", "feat: complete T1", true);
                    Some(complete_patch(&dispatch, &[&sha]))
                } else {
                    None
                }
            });
            let paths = [
                "items.jsonl",
                "decisions.jsonl",
                "state.json",
                "phases/6/SUMMARY.md",
            ];
            let before = paths.map(|name| fs::read(fixture.root.join(name)).ok());
            let old_state: Value = serde_json::from_slice(before[2].as_ref().unwrap()).unwrap();
            kill_execution_child(
                &fixture.root,
                &format!("{request}@{barrier}"),
                barrier,
                patch.as_ref(),
            );
            let pre_admission = barrier == "TemporarySynced:.store-intent.json";
            if pre_admission {
                assert!(!fixture.root.join(INTENT).exists());
                assert_eq!(
                    paths.map(|name| fs::read(fixture.root.join(name)).ok()),
                    before
                );
            } else if barrier != "confirmed" {
                assert!(fixture.root.join(INTENT).exists());
            }
            if barrier == "Renamed:SUMMARY.md" {
                assert_eq!(
                    fs::read(fixture.root.join("state.json")).unwrap(),
                    *before[2].as_ref().unwrap()
                );
                let summary = fs::read_to_string(fixture.root.join("phases/6/SUMMARY.md")).unwrap();
                let TaskOutcome::Completed { commit, .. } = &patch.as_ref().unwrap().tasks[0]
                else {
                    unreachable!()
                };
                assert!(summary.contains(commit));
            }
            if matches!(
                barrier,
                "Renamed:decisions.jsonl" | "Renamed:state.json" | "Renamed:SUMMARY.md"
            ) {
                // SUMMARY is the first patch participant; its rename precedes
                // decisions as well as the final semantic snapshot.
                let recovery = if barrier == "Renamed:SUMMARY.md" {
                    "RecoverySync:SUMMARY.md"
                } else {
                    "RecoverySync:decisions.jsonl"
                };
                kill_execution_child(
                    &fixture.root,
                    &format!("{request}@{recovery}"),
                    recovery,
                    patch.as_ref(),
                );
                assert!(fixture.root.join(INTENT).exists());
            }
            let response = execution_child_result(
                &fixture.root,
                if request == "apply" {
                    "read-apply"
                } else {
                    "read-query"
                },
                patch.as_ref(),
            );
            let record = disk_answer(&fixture.root, &response);
            assert_eq!(
                record["decision"]["boundary"]["response_digest"],
                actual_digest(&response)
            );
            assert_eq!(
                boundary_count(&fixture.root),
                if request == "apply" { 2 } else { 1 }
            );
            let state: Value =
                serde_json::from_slice(&fs::read(fixture.root.join("state.json")).unwrap())
                    .unwrap();
            for (key, value) in old_state["data"].as_object().unwrap() {
                if !matches!(key.as_str(), "execution" | "lifecycle") {
                    assert_eq!(state["data"][key], *value, "{key}");
                }
            }
            assert!(!fixture.root.join(INTENT).exists());
            let stable = paths.map(|name| fs::read(fixture.root.join(name)).ok());
            assert_eq!(
                execution_child_result(
                    &fixture.root,
                    if request == "apply" {
                        "read-apply"
                    } else {
                        "read-query"
                    },
                    patch.as_ref()
                ),
                response
            );
            assert_eq!(
                paths.map(|name| fs::read(fixture.root.join(name)).ok()),
                stable
            );
        }
    }
}

#[test]
fn execution_restart_cross_format_failure_preserves_legacy_bytes_at_every_service_entry() {
    runtime().block_on(async {
        let fixture = fixture(&[(&["src/a.rs"], &["T1"], "old native record\n")]);
        let server = CadenceServer::with_factory(factory());
        accept(&server, &fixture).await;
        let view = server
            .store(&fixture.root, Operation::ReadVerified)
            .await
            .unwrap();
        server
            .store(
                &fixture.root,
                Operation::RecordExecutionRefusal {
                    expected_generation: view.snapshot.generation,
                    expected_integrity: view.snapshot.integrity,
                    operation_id: "old-refusal".into(),
                    decision: cadence::execution::model::BoundaryDecision {
                        phase: 6,
                        tool: BoundaryTool::CadenceQuery,
                        operation: "execute-next".into(),
                        request_digest: "a".repeat(64),
                        outcome: "refused:invalid-plan".into(),
                        subject_id: None,
                        prompt_bytes: None,
                        response_digest: "b".repeat(64),
                    },
                },
            )
            .await
            .unwrap();
        drop(server);
        fs::write(
            fixture.root.join("phases/6/SUMMARY.md"),
            b"old summary stays exact\n",
        )
        .unwrap();
        let paths = [
            "items.jsonl",
            "decisions.jsonl",
            "state.json",
            "phases/6/SUMMARY.md",
        ];
        let before = paths.map(|name| fs::read(fixture.root.join(name)).unwrap());
        let patch = ExecutorPatch {
            schema: 1,
            kind: PatchKind::Executor,
            dispatch_id: "old-dispatch".into(),
            expected_execution_version: 1,
            outcome: PlanDisposition::Complete,
            tasks: vec![],
            deviations: vec![],
            blockers: vec![],
        };
        let server = CadenceServer::with_factory(factory());
        assert_eq!(
            server.query_execution(&fixture.root, 6).await,
            Err(Failure::LegacyExecution)
        );
        assert_eq!(
            server.apply_executor_patch(&fixture.root, patch).await,
            Err(Failure::LegacyExecution)
        );
        assert_eq!(
            server
                .refuse_execution_arguments(
                    &fixture.root,
                    BoundaryTool::CadenceQuery,
                    None,
                    ValidationFailure::MissingArguments
                )
                .await,
            Err(Failure::LegacyExecution)
        );
        assert_eq!(
            paths.map(|name| fs::read(fixture.root.join(name)).unwrap()),
            before
        );
        assert!(!fixture.root.join(INTENT).exists());
    });
}

#[test]
fn phase_six_binary_acceptance_inventory_runs_registered_evidence() {
    // This is the binary shard of the inventory. The integration-store shard
    // supplies AC8 because Rust test executables cannot call across crates.
    let rows: [(&str, &str, fn()); 9] = [
        (
            "AC2",
            "server::execution_service_tests::resident_selects_overlap_graph_durably_and_ignores_report_bodies",
            resident_selects_overlap_graph_durably_and_ignores_report_bodies,
        ),
        (
            "AC4",
            "server::execution_service_tests::signed_commits_apply_in_strict_order_and_paths_survive_replay",
            signed_commits_apply_in_strict_order_and_paths_survive_replay,
        ),
        (
            "AC5",
            "server::execution_service_tests::missing_unsigned_reused_reordered_bad_and_mismatched_commits_refuse",
            missing_unsigned_reused_reordered_bad_and_mismatched_commits_refuse,
        ),
        (
            "AC6",
            "server::execution_service_tests::execution_restart_dispatch_recovery_distinguishes_pre_admission",
            execution_restart_dispatch_recovery_distinguishes_pre_admission,
        ),
        (
            "AC6",
            "server::execution_service_tests::execution_restart_lost_apply_replays_one_immutable_transition",
            execution_restart_lost_apply_replays_one_immutable_transition,
        ),
        (
            "AC6",
            "server::execution_service_tests::execution_restart_repairs_summary_before_final_state_confirmation",
            execution_restart_repairs_summary_before_final_state_confirmation,
        ),
        (
            "AC7 deterministic guard",
            "guard::tests::guard_denies_owned_outputs_through_every_path_spelling",
            crate::guard::tests::guard_denies_owned_outputs_through_every_path_spelling,
        ),
        (
            "AC7 deterministic guard",
            "guard::tests::guard_fails_closed_for_malformed_ambiguous_and_oversized_write_events",
            crate::guard::tests::guard_fails_closed_for_malformed_ambiguous_and_oversized_write_events,
        ),
        (
            "AC7 deterministic guard",
            "guard::tests::guard_allows_unowned_source_paths_inside_and_outside_planning",
            crate::guard::tests::guard_allows_unowned_source_paths_inside_and_outside_planning,
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

#[test]
fn execution_service_conversion_is_public_before_receipt_creation() {
    use cadence::execution::boundary::Response;
    use cadence::{
        envelope::Envelope,
        execution::boundary::{PreparedAnswer, Receipt},
    };
    let answer = PreparedAnswer::new(
        Response::Refused {
            phase: 6,
            code: "invalid-phase".into(),
            reason: "phase must be positive".into(),
        }
        .into_envelope(),
    )
    .unwrap();
    assert_eq!(
        serde_json::to_value(&answer.envelope).unwrap(),
        serde_json::json!({
            "status":"refused","code":"invalid-phase","reason":"phase must be positive"
        })
    );
    assert!(matches!(
        answer.receipt,
        Receipt::Compact {
            envelope: Envelope::Refused { .. }
        }
    ));
    assert_eq!(
        answer.response_digest,
        "6914d5f0a8f7869ca24286a3432df51d4114d9f9f3163293e2d0be6f8f1148c7"
    );
}

use cadence::execution::{
    boundary::{BoundaryScope, BoundaryV1, Failure, PreparedAnswer},
    model::BoundaryTool,
};
use cadence::store::writer::{BoundaryChange, View};
use execution_service::ValidationFailure;
use serde_json::{Value, json};

fn canonical_answer(value: &Value) -> Vec<u8> {
    match value {
        Value::Object(object) => format!(
            "{{{}}}",
            object
                .iter()
                .collect::<std::collections::BTreeMap<_, _>>()
                .into_iter()
                .map(|(k, v)| format!(
                    "{}:{}",
                    serde_json::to_string(k).unwrap(),
                    String::from_utf8(canonical_answer(v)).unwrap()
                ))
                .collect::<Vec<_>>()
                .join(",")
        )
        .into_bytes(),
        Value::Array(array) => format!(
            "[{}]",
            array
                .iter()
                .map(|v| String::from_utf8(canonical_answer(v)).unwrap())
                .collect::<Vec<_>>()
                .join(",")
        )
        .into_bytes(),
        _ => serde_json::to_vec(value).unwrap(),
    }
}
fn actual_digest(envelope: &ExecutionEnvelope) -> String {
    use sha2::{Digest, Sha256};
    format!(
        "{:x}",
        Sha256::digest(canonical_answer(&serde_json::to_value(envelope).unwrap()))
    )
}
fn disk_answer(root: &Path, answer: &ExecutionEnvelope) -> Value {
    let expected = actual_digest(answer);
    let record = fs::read_to_string(root.join("decisions.jsonl"))
        .unwrap()
        .lines()
        .map(|line| serde_json::from_str::<Value>(line).unwrap())
        .rev()
        .find(|record| {
            record["decision"]["class"] == "boundary_v1"
                && record["decision"]["boundary"]["response_digest"] == expected
        })
        .unwrap();
    let receipt = &record["decision"]["boundary"]["receipt"];
    if receipt["receipt"] == "compact" {
        assert_eq!(receipt["envelope"], serde_json::to_value(answer).unwrap());
    }
    record
}

#[test]
fn execution_service_malformed_arguments_confirm_root_refusals_without_semantic_work() {
    runtime().block_on(async {
        let fixture = fixture(&[(&["src/a.rs"], &["T1"], "body\n")]);
        let server = CadenceServer::with_factory(factory());
        accept(&server, &fixture).await;
        let before = server
            .store(&fixture.root, Operation::ReadVerified)
            .await
            .unwrap();
        fs::write(
            fixture.root.join("phases/6/SUMMARY.md"),
            "preserved summary\n",
        )
        .unwrap();
        let cases = [
            (None, ValidationFailure::MissingArguments),
            (Some(json!({})), ValidationFailure::MissingField),
            (
                Some(json!({"operation":"execute-next"})),
                ValidationFailure::MissingField,
            ),
            (Some(json!({"phase":0})), ValidationFailure::WrongType),
            (
                Some(serde_json::from_str(r#"{"phase":1.5}"#).unwrap()),
                ValidationFailure::WrongType,
            ),
            (
                Some(serde_json::from_str(r#"{"phase":1e0}"#).unwrap()),
                ValidationFailure::WrongType,
            ),
            (Some(json!({"phase":"6"})), ValidationFailure::WrongType),
            (
                Some(json!({"phase":6,"extra":true})),
                ValidationFailure::ExtraField,
            ),
            (
                Some(json!({"kind":"foreign"})),
                ValidationFailure::UnknownTag,
            ),
            (
                Some(json!({"kind":"executor","tasks":"bad"})),
                ValidationFailure::InvalidPatch,
            ),
        ];
        let mut requests = std::collections::BTreeSet::new();
        for tool in [BoundaryTool::CadenceQuery, BoundaryTool::CadenceApply] {
            for (raw, failure) in &cases {
                let answer = server
                    .refuse_execution_arguments(&fixture.root, tool, raw.clone(), *failure)
                    .await
                    .unwrap();
                assert!(matches!(answer, Envelope::Refused { .. }));
                let record = disk_answer(&fixture.root, &answer);
                assert_eq!(
                    record["decision"]["boundary"]["scope"],
                    json!({"scope":"root-refusal"})
                );
                let view = server
                    .store(&fixture.root, Operation::ReadVerified)
                    .await
                    .unwrap();
                let latest = &view.decisions.last().unwrap().decision;
                let Decision::BoundaryV1(value) = latest else {
                    panic!("missing public decision")
                };
                let operation = if tool == BoundaryTool::CadenceQuery {
                    "execute-next"
                } else {
                    "executor"
                };
                let tool_name = if tool == BoundaryTool::CadenceQuery {
                    "cadence-query"
                } else {
                    "cadence-apply"
                };
                let expected = cadence::store::model::digest(
                    &serde_json::to_vec(&json!([
                        "execution-request-v1",
                        tool_name,
                        operation,
                        raw
                    ]))
                    .unwrap(),
                );
                assert_eq!(value.boundary.request_digest, expected);
                assert!(requests.insert(expected));
                assert_eq!(view.snapshot.data, before.snapshot.data);
                assert_eq!(
                    fs::read(fixture.root.join("phases/6/SUMMARY.md")).unwrap(),
                    b"preserved summary\n"
                );
                let repeated = server
                    .refuse_execution_arguments(&fixture.root, tool, raw.clone(), *failure)
                    .await
                    .unwrap();
                assert_eq!(repeated, answer);
                assert_eq!(
                    server
                        .store(&fixture.root, Operation::ReadVerified)
                        .await
                        .unwrap(),
                    view
                );
            }
        }
        assert_eq!(requests.len(), 20);
        let zero = server.query_execution(&fixture.root, 0).await.unwrap();
        assert_eq!(refusal_code(zero.clone()), "invalid-phase");
        assert_eq!(
            disk_answer(&fixture.root, &zero)["decision"]["boundary"]["scope"],
            json!({"scope":"root-refusal"})
        );
    });
}

#[test]
fn execution_service_apply_resolves_active_receipt_and_foreign_dispatch_scopes() {
    runtime().block_on(async {
        let fixture = fixture(&[(&["src/a.rs", "work/T1.txt"], &["T1"], "body\n")]);
        let server = CadenceServer::with_factory(factory());
        accept(&server, &fixture).await;
        let dispatch = dispatch(&server, &fixture).await;
        let commit = commit(&fixture, "T1", "feat(6): T1 complete", true);
        let patch = complete_patch(&dispatch, &[&commit]);
        let malformed = json!({"dispatch_id":dispatch.id,"tasks":"wrong"});
        let refused = server
            .refuse_execution_arguments(
                &fixture.root,
                BoundaryTool::CadenceApply,
                Some(malformed.clone()),
                ValidationFailure::InvalidPatch,
            )
            .await
            .unwrap();
        assert_eq!(
            disk_answer(&fixture.root, &refused)["decision"]["boundary"]["scope"],
            json!({"scope":"execution","phase":6})
        );
        let applied = server
            .apply_executor_patch(&fixture.root, patch.clone())
            .await
            .unwrap();
        assert_pending(applied.clone());
        disk_answer(&fixture.root, &applied);
        let again = server
            .refuse_execution_arguments(
                &fixture.root,
                BoundaryTool::CadenceApply,
                Some(malformed),
                ValidationFailure::InvalidPatch,
            )
            .await
            .unwrap();
        assert_eq!(again, refused);
        let mut foreign = patch;
        foreign.dispatch_id = "foreign".into();
        let answer = server
            .apply_executor_patch(&fixture.root, foreign)
            .await
            .unwrap();
        assert_eq!(refusal_code(answer.clone()), "foreign-dispatch");
        assert_eq!(
            disk_answer(&fixture.root, &answer)["decision"]["boundary"]["scope"],
            json!({"scope":"root-refusal"})
        );
    });
}

#[test]
fn execution_service_semantic_failures_confirm_but_log_config_and_queue_failures_do_not() {
    runtime().block_on(async {
        let fixture = fixture(&[(&["src/a.rs"], &["T1"], "body\n")]);
        let armed = Arc::new(AtomicBool::new(false));
        let probe = armed.clone();
        let factory = factory().with_probe(Arc::new(move |stage, path| {
            if probe.load(Ordering::SeqCst)
                && stage == Stage::TemporarySync
                && path
                    .file_name()
                    .is_some_and(|name| name.to_string_lossy().contains("decisions.jsonl"))
            {
                Err(cadence::store::Error::Io("refusal log failure".into()))
            } else {
                Ok(())
            }
        }));
        let server = CadenceServer::with_factory(factory);
        let before = server
            .store(&fixture.root, Operation::ReadVerified)
            .await
            .unwrap();
        fs::write(
            fixture.root.join("ROADMAP.md"),
            "## Phases\n- [x] **Phase 6: Native execution**\n",
        )
        .unwrap();
        let refused = server.query_execution(&fixture.root, 6).await.unwrap();
        assert_eq!(refusal_code(refused.clone()), "state-conflict");
        disk_answer(&fixture.root, &refused);
        let after = server
            .store(&fixture.root, Operation::ReadVerified)
            .await
            .unwrap();
        assert_eq!(before.snapshot.data, after.snapshot.data);
        armed.store(true, Ordering::SeqCst);
        assert_eq!(
            server
                .refuse_execution_arguments(
                    &fixture.root,
                    BoundaryTool::CadenceQuery,
                    None,
                    ValidationFailure::MissingArguments
                )
                .await,
            Err(Failure::Store)
        );
        let closed = CadenceServer {
            service: super::recall::Resident::closed_for_test(),
        };
        assert_eq!(
            closed.query_execution(&fixture.root, 6).await,
            Err(Failure::Closed)
        );
        assert_eq!(
            closed
                .refuse_execution_arguments(
                    &fixture.root,
                    BoundaryTool::CadenceApply,
                    None,
                    ValidationFailure::MissingArguments
                )
                .await,
            Err(Failure::Closed)
        );
        fs::write(fixture.root.join("config.v4.json"), "not json").unwrap();
        assert_eq!(
            server.query_execution(&fixture.root, 0).await,
            Err(Failure::Store)
        );
    });
}

async fn saturate(server: &CadenceServer, root: &Path, scope: BoundaryScope) -> View {
    let mut view = server.store(root, Operation::ReadVerified).await.unwrap();
    let count=view.decisions.iter().filter(|record|matches!(&record.decision,Decision::BoundaryV1(value) if value.boundary.scope==scope)).count();
    for index in count..=256 {
        let decision = BoundaryV1::new(
            scope.clone(),
            BoundaryTool::CadenceQuery,
            "execute-next".into(),
            cadence::store::model::digest(format!("fill-{index}").as_bytes()),
            None,
            &PreparedAnswer::new(Envelope::Refused {
                code: "fixture-refusal".into(),
                reason: "fixture input refused".into(),
            })
            .unwrap(),
        );
        view = server
            .store(
                root,
                Operation::BoundaryV1 {
                    expected_generation: view.snapshot.generation,
                    expected_integrity: view.snapshot.integrity.clone(),
                    operation_id: format!("fill-{scope:?}-{index}"),
                    decision,
                    change: Box::new(BoundaryChange::Observe),
                },
            )
            .await
            .unwrap();
    }
    view
}

#[test]
fn execution_service_terminal_precedes_observation_dispatch_and_new_or_replayed_patch() {
    runtime().block_on(async {
        for state in ["root","new-dispatch","active","applied"] {
            let fixture=fixture(&[(&["src/a.rs", "work/T1.txt"],&["T1"],"body\n")]);
            let server=CadenceServer::with_factory(factory()); accept(&server,&fixture).await;
            let phase=if state=="root"{0}else{6};
            let patch=if state=="new-dispatch" || state=="root"{None}else{
                let active=dispatch(&server,&fixture).await;
                let sha=commit(&fixture,"T1","feat(6): T1 complete",true);
                let patch=complete_patch(&active,&[&sha]);
                if state=="applied"{server.apply_executor_patch(&fixture.root,patch.clone()).await.unwrap();}
                Some(patch)
            };
            let terminal=saturate(&server,&fixture.root,if phase==0{BoundaryScope::RootRefusal}else{BoundaryScope::Execution{phase}}).await;
            let bytes=["decisions.jsonl","state.json"].map(|name|fs::read(fixture.root.join(name)).unwrap());
            fs::write(fixture.root.join("ROADMAP.md"),"unreadable lifecycle meaning\n").unwrap();
            fs::remove_file(fixture.root.join("phases/6/PLAN-1.md")).unwrap();
            let answer=server.query_execution(&fixture.root,phase).await.unwrap();
            assert_eq!(serde_json::to_value(&answer).unwrap(),json!({"status":"refused","code":"log-bound","reason":"the boundary scope reached its 256-transition limit"}));
            disk_answer(&fixture.root,&answer);
            if phase==0 {
                assert_eq!(server.refuse_execution_arguments(&fixture.root,BoundaryTool::CadenceQuery,None,ValidationFailure::MissingArguments).await.unwrap(),answer);
                assert_eq!(server.refuse_execution_arguments(&fixture.root,BoundaryTool::CadenceApply,Some(json!({"dispatch_id":"foreign"})),ValidationFailure::InvalidPatch).await.unwrap(),answer);
            }
            if let Some(mut patch)=patch {
                assert_eq!(server.apply_executor_patch(&fixture.root,patch.clone()).await.unwrap(),answer);
                patch.expected_execution_version=0;
                assert_eq!(server.apply_executor_patch(&fixture.root,patch).await.unwrap(),answer);
            }
            assert_eq!(server.store(&fixture.root,Operation::ReadVerified).await.unwrap(),terminal);
            assert_eq!(["decisions.jsonl","state.json"].map(|name|fs::read(fixture.root.join(name)).unwrap()),bytes);
            drop(server);
            let server=CadenceServer::with_factory(factory());
            assert_eq!(server.query_execution(&fixture.root,phase).await.unwrap(),answer);
            fs::write(fixture.root.join("config.v4.json"),"invalid config").unwrap();
            assert_eq!(server.query_execution(&fixture.root,phase).await,Err(Failure::Store));
        }
    });
}

#[test]
fn execution_service_oversized_judgment_refuses_before_patch_or_summary_mutation() {
    runtime().block_on(async {
        let fixture = fixture(&[(&["src/a.rs"], &["T1"], "body\n")]);
        let server = CadenceServer::with_factory(factory());
        accept(&server, &fixture).await;
        let active = dispatch(&server, &fixture).await;
        let id = "b".repeat(20000);
        let patch = ExecutorPatch {
            schema: PATCH_SCHEMA,
            kind: PatchKind::Executor,
            dispatch_id: active.id,
            expected_execution_version: active.expected_execution_version,
            outcome: PlanDisposition::Blocked,
            tasks: vec![TaskOutcome::Blocked {
                task_id: "T1".into(),
                blocker_id: id.clone(),
            }],
            deviations: vec![],
            blockers: vec![Blocker {
                id,
                text: "judgment preserved".into(),
                evidence: vec![EvidenceReference::Criterion { id: "AC4".into() }],
            }],
        };
        let before = server
            .store(&fixture.root, Operation::ReadVerified)
            .await
            .unwrap();
        let refused = server
            .apply_executor_patch(&fixture.root, patch)
            .await
            .unwrap();
        assert_eq!(refusal_code(refused.clone()), "response-too-large");
        disk_answer(&fixture.root, &refused);
        assert_eq!(
            server
                .store(&fixture.root, Operation::ReadVerified)
                .await
                .unwrap()
                .snapshot
                .data,
            before.snapshot.data
        );
        assert!(!fixture.root.join("phases/6/SUMMARY.md").exists());
    });
}

// PLAN-3 repair inventory, alongside the unchanged PLAN-1 inventories.
// The four harness shards collectively cover M1-M7. Each row is registered
// and executed here; names alone cannot satisfy a repair obligation.
#[test]
fn phase_six_service_repair_inventory_runs_registered_evidence() {
    let rows: [(&str, &str, fn()); 7] = [
        (
            "M2",
            "server::execution_service_tests::execution_service_malformed_arguments_confirm_root_refusals_without_semantic_work",
            execution_service_malformed_arguments_confirm_root_refusals_without_semantic_work,
        ),
        (
            "M4",
            "server::execution_service_tests::execution_service_semantic_failures_confirm_but_log_config_and_queue_failures_do_not",
            execution_service_semantic_failures_confirm_but_log_config_and_queue_failures_do_not,
        ),
        (
            "M4",
            "server::execution_service_tests::execution_service_terminal_precedes_observation_dispatch_and_new_or_replayed_patch",
            execution_service_terminal_precedes_observation_dispatch_and_new_or_replayed_patch,
        ),
        (
            "M5",
            "server::execution_service_tests::execution_restart_lost_apply_replays_one_immutable_transition",
            execution_restart_lost_apply_replays_one_immutable_transition,
        ),
        (
            "M5",
            "server::execution_service_tests::lifecycle_continuation_and_changed_plan_inputs_refuse_dispatch",
            lifecycle_continuation_and_changed_plan_inputs_refuse_dispatch,
        ),
        (
            "M6",
            "server::execution_service_tests::execution_restart_cross_format_failure_preserves_legacy_bytes_at_every_service_entry",
            execution_restart_cross_format_failure_preserves_legacy_bytes_at_every_service_entry,
        ),
        (
            "M7",
            "server::execution_service_tests::execution_restart_each_dispatch_and_patch_barrier_recovers_one_confirmed_answer",
            execution_restart_each_dispatch_and_patch_barrier_recovers_one_confirmed_answer,
        ),
    ];
    assert_eq!(
        rows.iter()
            .map(|row| row.0)
            .collect::<std::collections::BTreeSet<_>>(),
        std::collections::BTreeSet::from(["M2", "M4", "M5", "M6", "M7"])
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

#[test]
fn execution_service_name_status_reader_rejects_incomplete_and_invalid_git_bytes() {
    use execution_service::read_name_status;
    assert_eq!(
        read_name_status(b"M\0src/a.rs\0R100\0src/old\0src/new\0").unwrap(),
        ["src/a.rs", "src/new", "src/old"]
    );
    assert_eq!(read_name_status(b"").unwrap(), Vec::<String>::new());
    for bytes in [
        b"M\0src/a.rs".as_slice(),
        b"R100\0src/a.rs\0",
        b"M\0\0",
        b"Z\0path\0",
        b"U\0path\0",
        b"R101\0old\0new\0",
        b"R\0old\0new\0",
        b"M\0../outside\0",
        b"M\0bad-\xff\0",
        b"\0",
    ] {
        assert!(read_name_status(bytes).is_err(), "{bytes:?}");
    }
}

#[test]
fn execution_service_risky_skill_sequence_refuses_missing_unfired_stale_and_restart_until_settled()
{
    use super::rail_service::ReceiptCommand;
    use cadence::rail::{receipts, risk};
    runtime().block_on(async {
        let fixture = fixture(&[(&["work/risky.txt"], &["T1"], "risky task\n")]);
        let server = CadenceServer::with_factory(factory());
        accept(&server, &fixture).await;
        // This is the unchanged skill's query -> fixed executor return -> apply sequence.
        let active = dispatch(&server, &fixture).await;
        fs::create_dir_all(fixture.project.join("work")).unwrap();
        fs::write(
            fixture.project.join("work/risky.txt"),
            "JSON.parse(input)\n",
        )
        .unwrap();
        run(&fixture.project, &["add", "work/risky.txt"]);
        run(
            &fixture.project,
            &["commit", "-q", "-S", "-m", "feat(7): risky fixture T1"],
        );
        let head = run(&fixture.project, &["rev-parse", "HEAD"]);
        assert_eq!(run(&fixture.project, &["log", "-1", "--format=%G?"]), "G");
        let patch = complete_patch(&active, &[&head]);
        let pending = assert_pending(
            server
                .apply_executor_patch(&fixture.root, patch.clone())
                .await
                .unwrap(),
        );
        let before = server
            .store(&fixture.root, Operation::ReadVerified)
            .await
            .unwrap();
        let occurrence = &before.snapshot.data["execution"]["occurrences"]["6"];
        assert!(occurrence["terminal"].is_null());
        assert!(occurrence["active"].is_null());
        assert_eq!(occurrence["plans"][0]["tasks"][0]["commit"], head);
        assert!(risk::read(&before.snapshot.data).unwrap().is_empty());
        assert_pending(server.query_execution(&fixture.root, 6).await.unwrap());
        assert_eq!(
            server
                .apply_executor_patch(&fixture.root, patch.clone())
                .await
                .unwrap(),
            pending
        );
        let report = scan_execution(&server, &fixture.root, &active, "matched-first").await;
        assert_eq!(report.assessment.state, receipts::State::Unfired);
        assert_pending(server.query_execution(&fixture.root, 6).await.unwrap());
        let old = receipts::Fire {
            id: "old-fire".into(),
            binding: receipts::Binding::new(
                report.requirement.boundary.clone(),
                report.current_observation.as_ref().unwrap(),
            )
            .unwrap(),
            review_scope: report.review_scope,
            rearm_of: None,
        };
        let current = scan_execution(&server, &fixture.root, &active, "matched-current").await;
        // A matching old material identity still lacks this scan generation.
        for (id, mut fire) in [
            ("stale", old.clone()),
            ("wrong-run", old.clone()),
            ("pre-signoff", old),
        ] {
            if id == "wrong-run" {
                fire.binding.boundary.run_id = "foreign-dispatch".into();
            }
            if id == "pre-signoff" {
                fire.binding.boundary.after_generation = 0;
            }
            let result = server
                .service
                .rail_receipt(
                    &fixture.root,
                    ReceiptCommand::Submit(receipts::Apply::Fire {
                        request_id: id.into(),
                        fire: Box::new(fire),
                    }),
                )
                .await
                .unwrap();
            assert!(matches!(result, Envelope::Refused { .. }));
            assert_pending(server.query_execution(&fixture.root, 6).await.unwrap());
        }
        let fire = receipts::Fire {
            id: "current-fire".into(),
            binding: receipts::Binding::new(
                current.requirement.boundary.clone(),
                current.current_observation.as_ref().unwrap(),
            )
            .unwrap(),
            review_scope: current.review_scope,
            rearm_of: None,
        };
        assert!(matches!(
            server
                .service
                .rail_receipt(
                    &fixture.root,
                    ReceiptCommand::Submit(receipts::Apply::Fire {
                        request_id: "current-fire".into(),
                        fire: Box::new(fire.clone())
                    })
                )
                .await
                .unwrap(),
            Envelope::Ok(_)
        ));
        assert_pending(server.query_execution(&fixture.root, 6).await.unwrap());
        drop(server);
        let replacement = CadenceServer::with_factory(factory());
        assert_pending(replacement.query_execution(&fixture.root, 6).await.unwrap());
        assert_eq!(
            replacement
                .apply_executor_patch(&fixture.root, patch.clone())
                .await
                .unwrap(),
            pending
        );
        let receipt = receipts::Receipt {
            id: "fixture-settlement".into(),
            fire,
            consequence: receipts::Consequence::GatePass {
                evidence_id: "contracted-fixture-result".into(),
            },
        };
        assert!(matches!(
            replacement
                .service
                .rail_receipt(
                    &fixture.root,
                    ReceiptCommand::Submit(receipts::Apply::Consequence {
                        request_id: "settle".into(),
                        receipt: Box::new(receipt)
                    })
                )
                .await
                .unwrap(),
            Envelope::Ok(_)
        ));
        // A receipt never installs terminal completion by itself.
        let settled = replacement
            .store(&fixture.root, Operation::ReadVerified)
            .await
            .unwrap();
        assert!(settled.snapshot.data["execution"]["occurrences"]["6"]["terminal"].is_null());
        drop(replacement);
        let replacement = CadenceServer::with_factory(factory());
        assert_eq!(
            replacement.query_execution(&fixture.root, 6).await.unwrap(),
            Envelope::Ok(Success::Complete { phase: 6 })
        );
        assert_eq!(
            replacement
                .apply_executor_patch(&fixture.root, patch)
                .await
                .unwrap(),
            pending
        );
        let after = replacement
            .store(&fixture.root, Operation::ReadVerified)
            .await
            .unwrap();
        assert_eq!(
            after.snapshot.data["execution"]["occurrences"]["6"]["receipts"],
            occurrence["receipts"]
        );
        assert_eq!(
            after.snapshot.data["execution"]["occurrences"]["6"]["plans"],
            occurrence["plans"]
        );
        assert_eq!(run(&fixture.project, &["rev-parse", "HEAD"]), head);
        // Even a terminal Complete is re-assessed after a new unchecked scan.
        let bad = cadence::rail::risk::Observation {
            version: 1,
            request_id: "unchecked-current".into(),
            request_digest: OUTPUT_DIGEST.into(),
            scope: current.requirement.boundary.scope,
            source: risk::Source::Execution {
                plan: 1.try_into().unwrap(),
                dispatch_id: active.id,
            },
            resolution: risk::Resolution::Committed {
                base_id: Some(active.base_sha),
                head_id: Some(head),
            },
            outcome: risk::ObservationOutcome::Unchecked,
            surfaces: risk::CATEGORIES.map(str::to_owned).to_vec(),
            scan: Some(
                cadence::rail::risk_diff::scan(None, &[], &risk::CATEGORIES.map(str::to_owned))
                    .unwrap(),
            ),
            diagnostics: vec!["injected unreadable diff".into()],
        };
        replacement
            .store(
                &fixture.root,
                Operation::RailObservation {
                    expected_generation: after.snapshot.generation,
                    expected_integrity: after.snapshot.integrity,
                    record: Box::new(
                        risk::Recorded::new(bad, after.snapshot.generation + 1).unwrap(),
                    ),
                },
            )
            .await
            .unwrap();
        let refused = assert_pending(replacement.query_execution(&fixture.root, 6).await.unwrap());
        assert!(matches!(refused, Envelope::Refused {reason,..} if reason.contains("Unchecked")));
    });
}
