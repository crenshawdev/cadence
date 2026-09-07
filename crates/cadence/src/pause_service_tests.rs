use super::{CadenceServer, evidence_service::Command, pause_service::Response};
use crate::import::SessionFactory;
use cadence::{
    evidence::{
        self, Fact, Record, Scope,
        gates::{self, Gate, State},
    },
    pause::{Input, Phase, git},
};
use serde_json::{Value, json};
use std::{fs, path::Path, sync::Arc};

fn runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Runtime::new().unwrap()
}
fn server() -> CadenceServer {
    CadenceServer::with_factory(SessionFactory::new(None, Arc::new(|_, _| Ok(()))))
}
fn git_config(root: &Path, args: &[&str]) -> Vec<u8> {
    let output = std::process::Command::new("git")
        .current_dir(root)
        .args([
            "-c",
            "user.name=Pause Fixture",
            "-c",
            "user.email=pause@example.invalid",
            "-c",
            "commit.gpgsign=false",
        ])
        .args(args)
        .stdin(std::process::Stdio::null())
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    output.stdout
}
async fn fixture(policy: Value) -> tempfile::TempDir {
    let temp = tempfile::tempdir().unwrap();
    assert!(temp.path().starts_with("/tmp"));
    let root = temp.path().join(".planning");
    fs::create_dir_all(root.join("phases/1")).unwrap();
    fs::write(
        root.join("ROADMAP.md"),
        "# Roadmap v9.8.7\n\n## Phases\n\n- [ ] **Phase 1: Work**\n",
    )
    .unwrap();
    fs::write(root.join("phases/1/PLAN.md"), "plan").unwrap();
    fs::write(
        root.join("config.json"),
        serde_json::to_vec(&json!({"git":policy})).unwrap(),
    )
    .unwrap();
    git::run(temp.path(), ["init", "-b", "main"]).unwrap();
    server().lifecycle(&root).await.unwrap();
    git::run(temp.path(), ["add", "--", ".planning"]).unwrap();
    git_config(temp.path(), &["commit", "-m", "imported fixture"]);
    temp
}
fn input(project: &Path, occurrence: &str) -> Input {
    Input {
        scope: Scope {
            project: project.to_str().unwrap().into(),
            planning_root: project.join(".planning").to_str().unwrap().into(),
            cycle: "v9".into(),
            occurrence: occurrence.into(),
            phase: "1".into(),
            plan: "PLAN.md".into(),
            report: "reports/plan-1.md".into(),
        },
        phase: Some(Phase {
            identity: "1".into(),
            name: "Work".into(),
            total: 1,
            provenance: "recorded task".into(),
        }),
        sentence: Some("verify the fix on the device".into()),
        authorized: Default::default(),
    }
}
fn waiting(response: Response, kind: &str) -> Gate {
    let Response::Wait(gate) = response else {
        panic!("expected {kind}: {response:?}");
    };
    assert!(gate.id.starts_with(&format!("pause-{kind}-")), "{gate:?}");
    assert_eq!(gate.state, State::Unanswered);
    *gate
}
async fn answer(project: &Path, request: &Input, mut gate: Gate, option: &str, name: Option<&str>) {
    gate.state = State::Answered(gates::Answer {
        question_id: gate.id.clone(),
        actual_response: format!("operator chose {option}"),
        selected_option: Some(option.into()),
        adjustment: name.map(str::to_owned),
        disposition: if option == "abort" {
            gates::Disposition::Stop
        } else {
            gates::Disposition::Approve
        },
        authorization_id: Some(format!("{}:{}", request.scope.occurrence, gate.id)),
    });
    server()
        .evidence(
            &project.join(".planning"),
            Command::Submit {
                operation_id: format!("answer:{}:{}", request.scope.occurrence, gate.id),
                record: Box::new(Record {
                    version: evidence::VERSION,
                    scope: request.scope.clone(),
                    fact: Fact::Gate(gate),
                }),
            },
        )
        .await
        .unwrap();
}

#[test]
fn pause_protected_questions_survive_reopen_and_answers_are_occurrence_scoped() {
    runtime().block_on(async {
        for choice in ["proceed", "create", "abort"] {
            let temp = fixture(json!({"on_protected":"ask","integration_branch":"trunk"})).await;
            let request = input(temp.path(), "one");
            let head = git::run(temp.path(), ["rev-parse", "HEAD"]).unwrap();
            let gate = waiting(server().pause(request.clone()).await.unwrap(), "protected");
            let reopened = waiting(server().pause(request.clone()).await.unwrap(), "protected");
            assert_eq!(gate, reopened);
            answer(temp.path(), &request, gate, choice, Some("work/approved")).await;
            let result = server().pause(request.clone()).await.unwrap();
            if choice == "abort" {
                assert!(matches!(result, Response::Refused(_)));
            } else {
                assert!(matches!(result, Response::Ready(_)), "{result:?}");
            }
            assert_eq!(git::run(temp.path(), ["rev-parse", "HEAD"]).unwrap(), head);
            if choice == "create" {
                assert_eq!(
                    git::run(temp.path(), ["branch", "--show-current"]).unwrap(),
                    b"work/approved\n"
                );
            } else {
                waiting(
                    server().pause(input(temp.path(), "two")).await.unwrap(),
                    "protected",
                );
            }
        }
        let temp = fixture(json!({"on_protected":"refuse"})).await;
        let head = git::run(temp.path(), ["rev-parse", "HEAD"]).unwrap();
        assert!(server().pause(input(temp.path(), "refused")).await.is_err());
        assert_eq!(git::run(temp.path(), ["rev-parse", "HEAD"]).unwrap(), head);
    });
}

#[test]
fn pause_base_guards_use_local_refs_and_shared_history() {
    runtime().block_on(async {
        for case in [
            "detached",
            "missing",
            "tag-only",
            "unknown",
            "unrelated",
            "advanced",
        ] {
            let mut policy = json!({"on_protected":"allow","integration_branch":"trunk"});
            if matches!(case, "missing" | "tag-only") {
                policy["base_branch"] = json!("absent");
            }
            if case == "unknown" {
                policy["protected_branches"] = json!(["absent"]);
            }
            let temp = fixture(policy).await;
            let root = temp.path();
            match case {
                "detached" => {
                    git::run(root, ["checkout", "--detach"]).unwrap();
                }
                "tag-only" => {
                    git::run(root, ["tag", "--no-sign", "absent"]).unwrap();
                }
                "unrelated" => {
                    git::run(root, ["checkout", "--orphan", "unrelated"]).unwrap();
                    git_config(root, &["commit", "-m", "unrelated history"]);
                }
                "advanced" => {
                    git::run(root, ["branch", "work"]).unwrap();
                    fs::write(root.join("advance"), "advanced base").unwrap();
                    git::run(root, ["add", "--", "advance"]).unwrap();
                    git_config(root, &["commit", "-m", "advance base"]);
                    git::run(root, ["checkout", "work"]).unwrap();
                }
                _ => (),
            }
            let head = git::run(root, ["rev-parse", "HEAD"]).unwrap();
            let result = server().pause(input(root, case)).await.unwrap();
            if case == "advanced" {
                assert!(matches!(result, Response::Ready(_)), "{result:?}");
            } else {
                let kind = match case {
                    "detached" => "detached",
                    "missing" | "tag-only" => "missing-base",
                    "unknown" => "unknown-base",
                    _ => "unrelated-base",
                };
                let gate = waiting(result, kind);
                assert_eq!(
                    waiting(server().pause(input(root, case)).await.unwrap(), kind),
                    gate
                );
            }
            assert_eq!(git::run(root, ["rev-parse", "HEAD"]).unwrap(), head);
        }
    });
}

#[test]
fn pause_integration_policy_uses_active_version_before_title_and_preserves_all_arms() {
    runtime().block_on(async {
        for case in ["active", "title", "missing", "published", "trunk", "off", "off-base", "ask"] {
            let temp = fixture(json!({"on_protected":"allow", "integration_branch":if case == "trunk" {"trunk"} else {"milestone"},
                "auto_branch":if case == "off" {"off"} else if case == "ask" {"ask"} else {"auto"}})).await;
            let root = temp.path();
            if case == "active" {
                fs::write(root.join(".planning/PROJECT.md"), "### Active\n\nPrevious v1.0.0 closed.\n\n**`v2.3.4 - Current`**, opened today\n").unwrap();
            }
            if case == "missing" {
                fs::write(root.join(".planning/ROADMAP.md"), "# Roadmap\n\n## Phases\n\n- [ ] **Phase 1: Work**\n").unwrap();
            }
            if case == "published" { git::run(root, ["tag", "--no-sign", "9.8.7+release"]).unwrap(); }
            if case == "off-base" { git::run(root, ["checkout", "-b", "existing-work"]).unwrap(); }
            let result = server().pause(input(root, case)).await.unwrap();
            match case {
                "missing" => { waiting(result, "missing-version"); }
                "published" => { waiting(result, "published-version"); }
                "ask" => { waiting(result, "integration"); }
                _ => {
                    assert!(matches!(result, Response::Ready(_)), "{case}: {result:?}");
                    let expected = match case { "active" => "cadence/v2.3.4", "title" => "cadence/v9.8.7", "off-base" => "existing-work", _ => "main" };
                    assert_eq!(git::run(root, ["branch", "--show-current"]).unwrap(), format!("{expected}\n").as_bytes());
                }
            }
        }
    });
}

#[test]
fn pause_unreadable_controlling_config_never_supplies_cached_permission() {
    runtime().block_on(async {
        let temp = fixture(json!({"on_protected":"allow","integration_branch":"trunk"})).await;
        let server = server();
        assert!(matches!(
            server.pause(input(temp.path(), "one")).await.unwrap(),
            Response::Ready(_)
        ));
        // The active config path is discovered from the actual import manifest.
        let factory = SessionFactory::new(None, Arc::new(|_, _| Ok(())));
        let session = factory
            .first_touch(&temp.path().join(".planning"))
            .await
            .unwrap();
        let active = session.config().unwrap().repo.identity;
        fs::remove_file(&active).unwrap();
        fs::create_dir(&active).unwrap();
        let before = git::run(temp.path(), ["rev-parse", "HEAD"]).unwrap();
        assert!(server.pause(input(temp.path(), "one")).await.is_err());
        assert_eq!(
            git::run(temp.path(), ["rev-parse", "HEAD"]).unwrap(),
            before
        );
    });
}

#[test]
fn pause_branch_child() {
    let Some(project) = std::env::var_os("CADENCE_PAUSE_BRANCH_CHILD") else {
        return;
    };
    runtime().block_on(async {
        let project = Path::new(&project);
        let gate = waiting(
            server().pause(input(project, "restart")).await.unwrap(),
            "protected",
        );
        println!("PAUSE_GATE:{}", serde_json::to_string(&gate).unwrap());
    });
}

#[test]
fn pause_unanswered_branch_gate_reads_back_in_a_fresh_process() {
    runtime().block_on(async {
        let temp = fixture(json!({"on_protected":"ask","integration_branch":"trunk"})).await;
        let pending = waiting(
            server().pause(input(temp.path(), "restart")).await.unwrap(),
            "protected",
        );
        let head = git::run(temp.path(), ["rev-parse", "HEAD"]).unwrap();
        let output = std::process::Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "server::pause_service_tests::pause_branch_child",
                "--nocapture",
            ])
            .env("CADENCE_PAUSE_BRANCH_CHILD", temp.path())
            .stdin(std::process::Stdio::null())
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let output = String::from_utf8(output.stdout).unwrap();
        let line = output
            .lines()
            .find_map(|line| line.strip_prefix("PAUSE_GATE:"))
            .unwrap();
        assert_eq!(serde_json::from_str::<Gate>(line).unwrap(), pending);
        assert_eq!(git::run(temp.path(), ["rev-parse", "HEAD"]).unwrap(), head);
    });
}
