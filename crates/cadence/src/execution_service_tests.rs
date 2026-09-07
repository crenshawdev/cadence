use super::{
    CadenceServer,
    derivation_service::{Driver, Event},
    evidence_service::Command as EvidenceCommand,
    execution_service::{self, Response},
};
use crate::import::SessionFactory;
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
    store::writer::Operation,
};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
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
    let Response::Dispatch { dispatch, prompt } = server.query_execution(&fixture.root, 6).await
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

fn refusal_code(response: Response) -> String {
    let Response::Refused { code, .. } = response else {
        panic!("expected refusal, got {response:?}")
    };
    code
}

#[test]
fn resident_selects_overlap_graph_durably_and_ignores_report_bodies() {
    runtime().block_on(async {
        let fixture = fixture(&[
            (&["src/a.rs"], &["T1"], "first body\n"),
            (&["src/b.rs"], &["T2"], "second body\n"),
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
        assert_eq!(
            server
                .apply_executor_patch(&fixture.root, 6, complete_patch(&first, &[&first_commit]),)
                .await,
            Response::NextPlan { phase: 6, plan: 2 }
        );
        let second = dispatch(&server, &fixture).await;
        assert_eq!(second.plan, 2);
        let second_commit = commit(&fixture, "two", "feat(phase-6): complete T2", true);
        assert_eq!(
            server
                .apply_executor_patch(&fixture.root, 6, complete_patch(&second, &[&second_commit]),)
                .await,
            Response::NextPlan { phase: 6, plan: 3 }
        );
        assert_eq!(dispatch(&server, &fixture).await.plan, 3);
    });
}

#[test]
fn lifecycle_continuation_and_changed_plan_inputs_refuse_dispatch() {
    runtime().block_on(async {
        let unaccepted = fixture(&[(&["src/a.rs"], &["T1"], "body\n")]);
        let server = CadenceServer::with_factory(factory());
        assert_eq!(
            refusal_code(server.query_execution(&unaccepted.root, 6).await),
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
        let response = server.query_execution(&complete.root, 6).await;
        assert!(matches!(response, Response::Refused { .. }));

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
            refusal_code(server.query_execution(&changed.root, 6).await),
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
        let fixture = fixture(&[(&["src/a.rs"], &["T1", "T2"], "ordered body\n")]);
        let server = CadenceServer::with_factory(factory());
        accept(&server, &fixture).await;
        let dispatch = dispatch(&server, &fixture).await;
        let first = commit(&fixture, "one", "feat(phase-6): complete T1", true);
        let second = commit(&fixture, "two", "fix(phase-6): complete T2", true);
        let patch = complete_patch(&dispatch, &[&first, &second]);
        assert_eq!(
            server
                .apply_executor_patch(&fixture.root, 6, patch.clone())
                .await,
            Response::Complete { phase: 6 }
        );
        assert_eq!(
            server.apply_executor_patch(&fixture.root, 6, patch).await,
            Response::Complete { phase: 6 }
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
            let fixture = fixture(&[(&["src/a.rs"], tasks, "body\n")]);
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
                        6,
                        complete_patch(&dispatch, &["1111111111111111111111111111111111111111"],),
                    )
                    .await
            ),
            "missing-commit"
        );

        let (fixture, server, dispatch) = ready(&["T1"]).await;
        let unsigned = commit(&fixture, "unsigned", "feat: complete T1", false);
        assert_eq!(
            refusal_code(
                server
                    .apply_executor_patch(
                        &fixture.root,
                        6,
                        complete_patch(&dispatch, &[&unsigned]),
                    )
                    .await
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
                        6,
                        complete_patch(&dispatch, &[&shared, &shared]),
                    )
                    .await
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
                        6,
                        complete_patch(&dispatch, &[&second, &first]),
                    )
                    .await
            ),
            "git-order"
        );

        let (fixture, server, dispatch) = ready(&["T1"]).await;
        let mismatch = commit(&fixture, "mismatch", "feat: complete something else", true);
        assert_eq!(
            refusal_code(
                server
                    .apply_executor_patch(
                        &fixture.root,
                        6,
                        complete_patch(&dispatch, &[&mismatch]),
                    )
                    .await
            ),
            "commit-subject"
        );

        let (fixture, server, dispatch) = ready(&["T1"]).await;
        let untrusted = commit(&fixture, "untrusted", "feat: complete T1", true);
        fs::write(&fixture.allowed_signers, "").unwrap();
        assert_eq!(
            refusal_code(
                server
                    .apply_executor_patch(
                        &fixture.root,
                        6,
                        complete_patch(&dispatch, &[&untrusted]),
                    )
                    .await
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
        let expected = Response::JudgmentStop {
            phase: 6,
            dispatch_id: dispatch.id,
            blocker_ids: vec!["B1".into()],
        };
        assert_eq!(
            server.apply_executor_patch(&fixture.root, 6, patch).await,
            expected
        );
        assert_eq!(server.query_execution(&fixture.root, 6).await, expected);
    });
}
