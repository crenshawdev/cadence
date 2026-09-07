use super::{CadenceServer, evidence_service::Command, pause_service::Response};
use crate::import::SessionFactory;
use cadence::{
    evidence::{
        self, Fact, Record, Scope,
        gates::{self, Gate, State},
        overrides::{Authorization, Meaning},
        results::{AcceptedResult, Reference},
    },
    next_action::observations,
    pause::{
        Input, Phase, ResumeInvocation, git,
        risk::{self, Finding, Outcome, Review, Severity},
        risk_diff,
    },
    store::{Error, filesystem::Stage},
};
use serde_json::{Value, json};
use std::{
    collections::BTreeSet,
    fs,
    path::{Path, PathBuf},
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
};

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
    configured_fixture(json!({"git":policy})).await
}
async fn configured_fixture(config: Value) -> tempfile::TempDir {
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
        serde_json::to_vec(&config).unwrap(),
    )
    .unwrap();
    git::run(temp.path(), ["init", "-b", "main"]).unwrap();
    git::run(
        temp.path(),
        ["config", "--local", "user.name", "Pause Fixture"],
    )
    .unwrap();
    git::run(
        temp.path(),
        ["config", "--local", "user.email", "pause@example.invalid"],
    )
    .unwrap();
    git::run(
        temp.path(),
        ["config", "--local", "commit.gpgsign", "false"],
    )
    .unwrap();
    server().lifecycle(&root).await.unwrap();
    git::run(temp.path(), ["add", "--", ".planning"]).unwrap();
    git_config(temp.path(), &["commit", "-m", "imported fixture"]);
    temp
}
async fn risk_fixture(consequence: &str, surfaces: Option<Value>) -> tempfile::TempDir {
    let mut risk = json!({"gate":consequence});
    if let Some(surfaces) = surfaces {
        risk["surfaces"] = surfaces;
    }
    configured_fixture(json!({
        "git":{"on_protected":"allow","integration_branch":"trunk"},
        "review":{"triggers":{"risk_surface":risk}}
    }))
    .await
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
fn reviewing(response: Response) -> super::pause_service::RiskNeed {
    let Response::Review(need) = response else {
        panic!("expected risk review: {response:?}");
    };
    *need
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

fn finding(severity: Severity) -> Finding {
    Finding {
        number: 1,
        severity,
        file: "work.sql".into(),
        line: 1,
        claim: "the destructive change can remove persisted data".into(),
        fix: "replace it with a non-destructive migration".into(),
    }
}

async fn review(
    project: &Path,
    request: &Input,
    need: &super::pause_service::RiskNeed,
    findings: Vec<Finding>,
) {
    let finding_record = format!(
        ".planning/phases/1/REVIEW-risk_surface-pause-{}.md",
        &need.fire.index_id[..12]
    );
    let body = Review {
        version: 1,
        fire: need.fire.clone(),
        finding_record: finding_record.clone(),
        findings,
    };
    server()
        .evidence(
            &project.join(".planning"),
            Command::Submit {
                operation_id: format!("review:{}:{}", request.scope.occurrence, need.fire.id),
                record: Box::new(Record {
                    version: evidence::VERSION,
                    scope: request.scope.clone(),
                    fact: Fact::AcceptedResult(AcceptedResult {
                        id: need.fire.id.clone(),
                        contract: risk::CONTRACT.into(),
                        result: "reviewed".into(),
                        evidence_text: serde_json::to_string(&body).unwrap(),
                        references: vec![Reference::FileLine {
                            file: finding_record,
                            line: 1,
                        }],
                        checker_id: None,
                    }),
                }),
            },
        )
        .await
        .unwrap();
}

fn staged_request(project: &Path, occurrence: &str, body: &[u8]) -> Input {
    fs::write(project.join("work.sql"), body).unwrap();
    git::run(project, ["add", "--", "work.sql"]).unwrap();
    let mut request = input(project, occurrence);
    request.authorized.insert("work.sql".into());
    request
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
                assert_eq!(git::run(temp.path(), ["rev-parse", "HEAD"]).unwrap(), head);
            } else {
                assert!(matches!(result, Response::Ready(_)), "{result:?}");
                assert_eq!(git::run(temp.path(), ["rev-parse", "HEAD^"]).unwrap(), head);
            }
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
                assert_eq!(git::run(root, ["rev-parse", "HEAD^"]).unwrap(), head);
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
            if case != "advanced" {
                assert_eq!(git::run(root, ["rev-parse", "HEAD"]).unwrap(), head);
            }
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
            if matches!(case, "active" | "missing") {
                git::run(root, ["add", "--", ".planning"]).unwrap();
                git_config(root, &["commit", "-m", "set branch fixture inputs"]);
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
fn pause_risk_reads_the_staged_tree_and_preserves_checked_match_and_inconclusive_states() {
    runtime().block_on(async {
        let temp = risk_fixture("blocking", Some(json!(["destructive", "untrusted_input"]))).await;
        let request = staged_request(
            temp.path(),
            "staged-risk",
            b"const body = JSON.parse(request.body);\nDROP TABLE accounts;\n",
        );
        let before = git::run(temp.path(), ["rev-parse", "HEAD"]).unwrap();
        let need = reviewing(server().pause(request).await.unwrap());
        assert_eq!(need.fire.base.as_bytes(), &before[..before.len() - 1]);
        assert!(need.fire.staged);
        assert_eq!(need.fire.head_id, None);
        assert_eq!(need.fire.index_id, git::index_id(temp.path()).unwrap());
        assert_eq!(need.fire.scope, vec![PathBuf::from("work.sql")]);
        assert_eq!(need.fire.authored, need.fire.scope);
        assert!(need.fire.scan.checked);
        assert!(!need.fire.scan.inconclusive);
        assert_eq!(
            need.fire
                .scan
                .matches
                .iter()
                .map(|matched| (matched.category.as_str(), matched.signal.as_str()))
                .collect::<Vec<_>>(),
            vec![
                ("destructive", "changed line: a DROP statement"),
                ("untrusted_input", "changed line: a JSON.parse call"),
            ]
        );

        let binary = risk_fixture("blocking", Some(json!(["destructive"]))).await;
        let request = staged_request(binary.path(), "binary-risk", b"\0\xff\0");
        let need = reviewing(server().pause(request).await.unwrap());
        assert!(need.fire.scan.checked);
        assert!(need.fire.scan.inconclusive);
        assert!(need.fire.scan.matches.is_empty());

        let safe = risk_fixture("blocking", Some(json!(["destructive"]))).await;
        let request = staged_request(
            safe.path(),
            "safe-risk",
            b"CREATE TABLE accounts(id int);\n",
        );
        let Response::Ready(capture) = server().pause(request).await.unwrap() else {
            panic!("a judged nonmatching staged change must clear");
        };
        assert!(matches!(capture.risk, Some(Outcome::Clear(fire))
            if fire.scan.checked && fire.scan.matches.is_empty() && !fire.scan.inconclusive));
    });
}

#[test]
fn pause_risk_asks_for_unanswered_surfaces_and_persists_the_answer_before_review() {
    runtime().block_on(async {
        let temp = risk_fixture("blocking", None).await;
        let request = staged_request(temp.path(), "scope-risk", b"DROP TABLE accounts;\n");
        let head = git::run(temp.path(), ["rev-parse", "HEAD"]).unwrap();
        let gate = waiting(
            server().pause(request.clone()).await.unwrap(),
            "risk-surfaces",
        );
        assert_eq!(git::run(temp.path(), ["rev-parse", "HEAD"]).unwrap(), head);
        answer(temp.path(), &request, gate, "all", None).await;
        assert!(matches!(
            server().pause(request.clone()).await.unwrap(),
            Response::Refused(reason) if reason.contains("recorded")
        ));
        let need = reviewing(server().pause(request).await.unwrap());
        assert_eq!(need.fire.scan.categories, risk::CATEGORIES);
        assert!(
            need.fire
                .scan
                .matches
                .iter()
                .any(|matched| matched.category == "destructive")
        );
    });
}

#[test]
fn pause_risk_excludes_binary_receipts_by_provenance_and_keeps_narrow_review_exclusions() {
    runtime().block_on(async {
        let temp = risk_fixture("blocking", Some(json!(["destructive"]))).await;
        let request = input(temp.path(), "receipt-risk");
        let view = server()
            .store(
                &temp.path().join(".planning"),
                cadence::store::writer::Operation::Read,
            )
            .await
            .unwrap();
        let record = AcceptedResult {
            id: "quoted-command".into(),
            contract: "fixture.result.v1".into(),
            result: "observed".into(),
            evidence_text: "The operator quoted DROP TABLE accounts".into(),
            references: vec![Reference::Criterion { id: "AC6".into() }],
            checker_id: None,
        };
        server()
            .evidence(
                &temp.path().join(".planning"),
                Command::Submit {
                    operation_id: "quoted-command".into(),
                    record: Box::new(Record {
                        version: evidence::VERSION,
                        scope: request.scope.clone(),
                        fact: Fact::AcceptedResult(record),
                    }),
                },
            )
            .await
            .unwrap();
        assert!(view.snapshot.generation > 0);
        git::run(
            temp.path(),
            [
                "add",
                "--",
                ".planning/items.jsonl",
                ".planning/decisions.jsonl",
                ".planning/state.json",
            ],
        )
        .unwrap();
        let Response::Ready(capture) = server().pause(request).await.unwrap() else {
            panic!("binary receipts must not fire their own gate");
        };
        let Some(Outcome::Clear(fire)) = capture.risk else {
            panic!("expected a completed clean risk observation");
        };
        assert_eq!(fire.scope.len(), 2);
        assert!(fire.authored.is_empty());
        assert!(fire.scan.empty);

        let future = risk_fixture("blocking", Some(json!(["destructive"]))).await;
        fs::write(
            future.path().join("future-store-participant.jsonl"),
            "DROP TABLE accounts\n",
        )
        .unwrap();
        git::run(
            future.path(),
            ["add", "--", "future-store-participant.jsonl"],
        )
        .unwrap();
        let staged = git::staged(
            future.path(),
            "HEAD",
            &BTreeSet::from([PathBuf::from("future-store-participant.jsonl")]),
        )
        .unwrap();
        assert_eq!(staged.scope.len(), 1);
        assert!(staged.authored.is_empty());
        assert!(
            risk_diff::scan(
                Some(&staged.diff),
                &staged.authored,
                &["destructive".into()]
            )
            .unwrap()
            .empty
        );

        let review = risk_fixture("blocking", Some(json!(["destructive"]))).await;
        let artifact = review
            .path()
            .join(".planning/phases/1/REVIEW-risk_surface-fixture.md");
        fs::write(&artifact, "DROP TABLE accounts\n").unwrap();
        fs::create_dir(review.path().join(".planning/phases/1/nested")).unwrap();
        fs::write(
            review
                .path()
                .join(".planning/phases/1/nested/REVIEW-risk_surface-fixture.md"),
            "DROP TABLE accounts\n",
        )
        .unwrap();
        git::run(
            review.path(),
            [
                "add",
                "--",
                ".planning/phases/1/REVIEW-risk_surface-fixture.md",
                ".planning/phases/1/nested/REVIEW-risk_surface-fixture.md",
            ],
        )
        .unwrap();
        let staged = git::staged(review.path(), "HEAD", &BTreeSet::new()).unwrap();
        assert_eq!(
            staged.authored,
            vec![PathBuf::from(
                ".planning/phases/1/nested/REVIEW-risk_surface-fixture.md"
            )]
        );
        assert!(
            risk_diff::scan(
                Some(&staged.diff),
                &staged.authored,
                &["destructive".into()]
            )
            .unwrap()
            .matches
            .iter()
            .any(|matched| matched.category == "destructive")
        );
    });
}

#[test]
fn pause_risk_consequences_use_only_recorded_contracted_results() {
    runtime().block_on(async {
        let off = risk_fixture("off", None).await;
        let request = staged_request(off.path(), "off-risk", b"DROP TABLE accounts;\n");
        let Response::Ready(capture) = server().pause(request).await.unwrap() else {
            panic!("off must skip review");
        };
        assert_eq!(capture.risk, Some(Outcome::Off));

        let advisory = risk_fixture("advisory", Some(json!(["destructive"]))).await;
        let request = staged_request(advisory.path(), "advisory-risk", b"DROP TABLE accounts;\n");
        let need = reviewing(server().pause(request.clone()).await.unwrap());
        review(
            advisory.path(),
            &request,
            &need,
            vec![finding(Severity::High)],
        )
        .await;
        let Response::Ready(capture) = server().pause(request).await.unwrap() else {
            panic!("advisory must report and continue");
        };
        assert!(matches!(capture.risk, Some(Outcome::Advisory(_))));

        let blocking = risk_fixture("blocking", Some(json!(["destructive"]))).await;
        let request = staged_request(blocking.path(), "blocking-clean", b"DROP TABLE accounts;\n");
        let need = reviewing(server().pause(request.clone()).await.unwrap());
        review(blocking.path(), &request, &need, Vec::new()).await;
        let Response::Ready(capture) = server().pause(request).await.unwrap() else {
            panic!("recorded no-survivor result must clear blocking");
        };
        assert!(matches!(
            capture.risk,
            Some(Outcome::BlockingCleared(Review { findings, .. })) if findings.is_empty()
        ));

        let malformed = risk_fixture("blocking", Some(json!(["destructive"]))).await;
        let request = staged_request(
            malformed.path(),
            "malformed-risk",
            b"DROP TABLE accounts;\n",
        );
        let need = reviewing(server().pause(request.clone()).await.unwrap());
        server()
            .evidence(
                &malformed.path().join(".planning"),
                Command::Submit {
                    operation_id: "malformed-risk".into(),
                    record: Box::new(Record {
                        version: evidence::VERSION,
                        scope: request.scope.clone(),
                        fact: Fact::AcceptedResult(AcceptedResult {
                            id: need.fire.id,
                            contract: risk::CONTRACT.into(),
                            result: "reviewed".into(),
                            evidence_text: "not a contracted return".into(),
                            references: vec![Reference::Criterion { id: "AC6".into() }],
                            checker_id: None,
                        }),
                    }),
                },
            )
            .await
            .unwrap();
        assert!(matches!(
            server().pause(request).await.unwrap(),
            Response::Refused(reason) if reason.contains("unusable")
        ));
    });
}

#[test]
fn pause_deferred_review_is_visible_to_the_production_queue_observation() {
    runtime().block_on(async {
        let temp = risk_fixture("deferred", Some(json!(["destructive"]))).await;
        let request = staged_request(temp.path(), "deferred-risk", b"DROP TABLE accounts;\n");
        let need = reviewing(server().pause(request.clone()).await.unwrap());
        review(
            temp.path(),
            &request,
            &need,
            vec![finding(Severity::Medium)],
        )
        .await;
        let Response::Ready(capture) = server().pause(request).await.unwrap() else {
            panic!("deferred review must allow the run");
        };
        let Some(Outcome::Deferred { queue, .. }) = capture.risk else {
            panic!("deferred outcome missing");
        };
        let lifecycle = server()
            .lifecycle(&temp.path().join(".planning"))
            .await
            .unwrap();
        let observed = observations::capture(&temp.path().join(".planning"), &lifecycle).unwrap();
        assert_eq!(observed.queue.members.len(), 1);
        assert_eq!(observed.queue.members[0].path, queue);
        assert_eq!(observed.queue.members[0].findings, 1);
    });
}

#[test]
fn pause_blocking_override_is_occurrence_scoped_and_rearm_is_capped_across_restart() {
    runtime().block_on(async {
        let overridden = risk_fixture("blocking", Some(json!(["destructive"]))).await;
        let request = staged_request(
            overridden.path(),
            "override-risk",
            b"DROP TABLE accounts;\n",
        );
        let need = reviewing(server().pause(request.clone()).await.unwrap());
        review(
            overridden.path(),
            &request,
            &need,
            vec![finding(Severity::Blocker)],
        )
        .await;
        let gate = waiting(server().pause(request.clone()).await.unwrap(), "risk");
        answer(
            overridden.path(),
            &request,
            gate,
            "override",
            Some("the migration is intentionally destructive after backup"),
        )
        .await;
        let Response::Ready(capture) = server().pause(request.clone()).await.unwrap() else {
            panic!("recorded review override must authorize its occurrence");
        };
        let Some(Outcome::Overridden { override_id, .. }) = capture.risk else {
            panic!("override outcome missing");
        };
        let recovery = server()
            .evidence(&overridden.path().join(".planning"), Command::Read)
            .await
            .unwrap();
        assert!(recovery.current.iter().any(|record| {
            record.scope == request.scope
                && matches!(&record.fact, Fact::Override(value)
                    if value.id == override_id
                    && matches!(&value.meaning, Meaning::Review(receipt)
                        if receipt.head.starts_with("index:")
                        && receipt.head != receipt.base))
        }));

        let rearmed = risk_fixture("blocking", Some(json!(["destructive"]))).await;
        let request = staged_request(rearmed.path(), "rearm-risk", b"DROP TABLE accounts;\n");
        let first = reviewing(server().pause(request.clone()).await.unwrap());
        review(
            rearmed.path(),
            &request,
            &first,
            vec![finding(Severity::High)],
        )
        .await;
        let gate = waiting(server().pause(request.clone()).await.unwrap(), "risk");
        answer(rearmed.path(), &request, gate, "fix", None).await;
        fs::write(
            rearmed.path().join("work.sql"),
            "CREATE TABLE accounts(id int);\n",
        )
        .unwrap();
        git::run(rearmed.path(), ["add", "--", "work.sql"]).unwrap();
        let second = reviewing(server().pause(request.clone()).await.unwrap());
        assert_eq!(second.fire.round, 2);
        assert_eq!(second.fire.base, first.fire.index_id);
        assert!(
            second
                .fire
                .scan
                .matches
                .iter()
                .any(|matched| matched.signal == "changed line: a DROP statement")
        );
        review(
            rearmed.path(),
            &request,
            &second,
            vec![finding(Severity::High)],
        )
        .await;
        let gate = waiting(server().pause(request.clone()).await.unwrap(), "risk");
        assert!(!gate.options.iter().any(|option| option.id == "fix"));
        let reopened = waiting(server().pause(request).await.unwrap(), "risk");
        assert_eq!(reopened, gate);
    });
}

#[test]
fn pause_adjudicated_findings_wait_for_a_recorded_operator_disposition() {
    runtime().block_on(async {
        let temp = risk_fixture("adjudicated", Some(json!(["destructive"]))).await;
        let request = staged_request(temp.path(), "adjudicated-risk", b"DROP TABLE accounts;\n");
        let need = reviewing(server().pause(request.clone()).await.unwrap());
        review(temp.path(), &request, &need, vec![finding(Severity::Low)]).await;
        let gate = waiting(server().pause(request.clone()).await.unwrap(), "risk");
        assert_eq!(gate.state, State::Unanswered);
        assert!(matches!(
            server().pause(request).await.unwrap(),
            Response::Wait(_)
        ));
    });
}

#[test]
fn pause_wip_preserves_exact_bytes_deletion_and_rename() {
    runtime().block_on(async {
        let temp = risk_fixture("off", None).await;
        let root = temp.path();
        fs::write(root.join("binary data.bin"), b"old bytes\n").unwrap();
        fs::write(root.join("delete-me.txt"), "remove me\n").unwrap();
        fs::write(root.join("old name.txt"), "rename contents\n").unwrap();
        git::run(
            root,
            [
                "add",
                "--",
                "binary data.bin",
                "delete-me.txt",
                "old name.txt",
            ],
        )
        .unwrap();
        git_config(root, &["commit", "-m", "seed work files"]);
        let before = git::run(root, ["rev-parse", "HEAD"]).unwrap();

        let bytes = b"\0preserved\xffbytes\n";
        fs::write(root.join("binary data.bin"), bytes).unwrap();
        fs::remove_file(root.join("delete-me.txt")).unwrap();
        git::run(root, ["mv", "--", "old name.txt", "renamed \u{2713}.txt"]).unwrap();
        fs::write(root.join("new file.txt"), "new contents\n").unwrap();
        fs::write(
            root.join(".planning/phases/1/working notes.md"),
            "record this with the pause documentation\n",
        )
        .unwrap();
        let mut request = input(root, "wip-exact");
        request.authorized.extend(
            [
                "binary data.bin",
                "delete-me.txt",
                "old name.txt",
                "renamed \u{2713}.txt",
                "new file.txt",
                ".planning/phases/1/working notes.md",
            ]
            .into_iter()
            .map(PathBuf::from),
        );

        let Response::Ready(capture) = server().pause(request).await.unwrap() else {
            panic!("authorized WIP must be preserved");
        };
        let wip = capture.wip.expect("dirty source work needs a WIP");
        assert_eq!(
            git::run(root, ["rev-parse", "HEAD^"]).unwrap(),
            format!("{wip}\n").as_bytes()
        );
        assert_ne!(before, format!("{wip}\n").as_bytes());
        assert_eq!(
            git::run(root, ["show", "-s", "--format=%s", &wip]).unwrap(),
            b"wip: Work\n"
        );
        let binary = format!("{wip}:binary data.bin");
        let renamed = format!("{wip}:renamed \u{2713}.txt");
        let added = format!("{wip}:new file.txt");
        let deleted = format!("{wip}:delete-me.txt");
        let planning = format!("{wip}:.planning/phases/1/working notes.md");
        assert_eq!(git::run(root, ["show", binary.as_str()]).unwrap(), bytes);
        assert_eq!(
            git::run(root, ["show", renamed.as_str()]).unwrap(),
            b"rename contents\n"
        );
        assert_eq!(
            git::run(root, ["show", added.as_str()]).unwrap(),
            b"new contents\n"
        );
        assert!(git::run(root, ["show", deleted.as_str()]).is_err());
        assert!(git::run(root, ["show", planning.as_str()]).is_err());
        assert!(root.join(".planning/phases/1/working notes.md").is_file());
    });
}

#[test]
fn pause_wip_refuses_unauthorized_dirt_and_skips_an_originally_clean_tree() {
    runtime().block_on(async {
        let dirty = risk_fixture("off", None).await;
        fs::write(dirty.path().join("authorized.txt"), "authorized\n").unwrap();
        fs::write(dirty.path().join("unrelated.txt"), "unrelated\n").unwrap();
        let mut request = input(dirty.path(), "unauthorized-wip");
        request.authorized.insert("authorized.txt".into());
        let head = git::run(dirty.path(), ["rev-parse", "HEAD"]).unwrap();
        assert!(server().pause(request).await.is_err());
        assert_eq!(git::run(dirty.path(), ["rev-parse", "HEAD"]).unwrap(), head);
        assert!(git::run(dirty.path(), ["diff", "--cached", "--quiet"]).is_ok());

        let clean = risk_fixture("off", None).await;
        let head = git::run(clean.path(), ["rev-parse", "HEAD"]).unwrap();
        let Response::Ready(capture) = server()
            .pause(input(clean.path(), "clean-wip"))
            .await
            .unwrap()
        else {
            panic!("clean pause must be ready");
        };
        assert_eq!(capture.wip, None);
        assert_eq!(
            git::run(clean.path(), ["rev-parse", "HEAD^"]).unwrap(),
            head
        );
    });
}

#[test]
fn pause_wip_rechecks_the_staged_tree_before_commit() {
    runtime().block_on(async {
        let temp = risk_fixture("off", None).await;
        let root = temp.path();
        fs::write(root.join("guarded.txt"), "first\n").unwrap();
        let observed = git::observe(root).unwrap();
        let authorized = BTreeSet::from([PathBuf::from("guarded.txt")]);
        let staged =
            git::stage_authorized(root, &observed, &authorized, &BTreeSet::new(), &authorized)
                .unwrap()
                .unwrap();
        let head = git::run(root, ["rev-parse", "HEAD"]).unwrap();
        fs::write(root.join("guarded.txt"), "second\n").unwrap();
        git::run(root, ["add", "--", "guarded.txt"]).unwrap();
        assert!(git::commit_wip(root, &staged, "guarded work").is_err());
        assert_eq!(git::run(root, ["rev-parse", "HEAD"]).unwrap(), head);
    });
}

#[test]
fn pause_wip_reports_a_real_commit_hook_failure_without_discarding_the_index() {
    runtime().block_on(async {
        use std::os::unix::fs::PermissionsExt;

        let temp = risk_fixture("off", None).await;
        let root = temp.path();
        fs::write(root.join("hooked.txt"), "preserve me\n").unwrap();
        let hook = root.join(".git/hooks/pre-commit");
        fs::write(&hook, "#!/bin/sh\nexit 1\n").unwrap();
        let mut permissions = fs::metadata(&hook).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&hook, permissions).unwrap();
        let mut request = input(root, "hook-failure");
        request.authorized.insert("hooked.txt".into());
        let head = git::run(root, ["rev-parse", "HEAD"]).unwrap();

        assert!(server().pause(request).await.is_err());
        assert_eq!(git::run(root, ["rev-parse", "HEAD"]).unwrap(), head);
        assert_eq!(
            git::run(root, ["show", ":hooked.txt"]).unwrap(),
            b"preserve me\n"
        );
    });
}

#[test]
fn pause_commits_exact_resume_record_for_dirty_and_clean_starts() {
    runtime().block_on(async {
        for dirty in [true, false] {
            let temp = risk_fixture("off", None).await;
            let root = temp.path();
            let before = String::from_utf8(git::run(root, ["rev-parse", "HEAD"]).unwrap())
                .unwrap()
                .trim()
                .to_owned();
            let mut request = input(root, if dirty { "record-dirty" } else { "record-clean" });
            if dirty {
                fs::write(root.join("source.txt"), b"exact source bytes\0\xff").unwrap();
                request.authorized.insert("source.txt".into());
            }
            let Response::Ready(capture) = server().pause(request.clone()).await.unwrap() else {
                panic!("pause record must commit");
            };
            let commits = String::from_utf8(
                git::run(root, ["rev-list", "--count", &format!("{before}..HEAD")]).unwrap(),
            )
            .unwrap();
            assert_eq!(commits.trim(), if dirty { "2" } else { "1" });
            assert_eq!(capture.wip.is_some(), dirty);
            if let Some(wip) = &capture.wip {
                assert_eq!(
                    git::run(root, ["show", &format!("{wip}:source.txt")]).unwrap(),
                    b"exact source bytes\0\xff"
                );
                assert_eq!(
                    git::run(root, ["rev-parse", "HEAD^"]).unwrap(),
                    format!("{wip}\n").as_bytes()
                );
            }
            assert_eq!(
                git::run(root, ["log", "-1", "--format=%s"]).unwrap(),
                b"docs: pause at phase 1\n"
            );
            git::require_clean(root).unwrap();

            let service = server();
            let recovery = service
                .evidence(&root.join(".planning"), Command::Read)
                .await
                .unwrap();
            let record = recovery
                .current
                .iter()
                .find(|record| {
                    record.scope == request.scope
                        && matches!(&record.fact, Fact::Override(value) if value.id == "pause-resume")
                })
                .unwrap();
            let Fact::Override(value) = &record.fact else {
                unreachable!()
            };
            assert_eq!(value.reason, "verify the fix on the device");
            assert!(matches!(
                &value.meaning,
                Meaning::PausedNext { sentence } if sentence == "verify the fix on the device"
            ));
            let Authorization::Invocation { invocation, .. } = &value.authorization else {
                panic!("pause record needs invocation provenance");
            };
            let invocation: ResumeInvocation = serde_json::from_str(invocation).unwrap();
            assert_eq!(invocation.version, 1);
            assert_eq!(invocation.action, "pause");
            assert_eq!(invocation.phase, capture.phase);
            assert_eq!(invocation.preserved_head, capture.wip.unwrap_or(before));
            assert!(!invocation.config.is_empty());

            let permission = service
                .evidence(
                    &root.join(".planning"),
                    Command::Permission {
                        scope: request.scope,
                        override_id: "pause-resume".into(),
                    },
                )
                .await
                .unwrap();
            assert_eq!(
                permission.permission,
                Some(cadence::evidence::authority::Permission::Pending)
            );
            let view = service
                .store(
                    &root.join(".planning"),
                    cadence::store::writer::Operation::Read,
                )
                .await
                .unwrap();
            for (name, bytes) in evidence::persistence::confirmed_participants(&view).unwrap() {
                assert_eq!(
                    git::run(root, ["show", &format!("HEAD:.planning/{name}")]).unwrap(),
                    bytes
                );
            }
        }
    });
}

#[test]
fn pause_record_failure_after_wip_is_partial_and_retry_is_idempotent() {
    runtime().block_on(async {
        let temp = risk_fixture("off", None).await;
        let root = temp.path();
        let before = String::from_utf8(git::run(root, ["rev-parse", "HEAD"]).unwrap())
            .unwrap()
            .trim()
            .to_owned();
        fs::write(root.join("partial.txt"), "preserve before record\n").unwrap();
        let mut request = input(root, "partial-record");
        request.authorized.insert("partial.txt".into());
        let armed = Arc::new(AtomicBool::new(true));
        let probe_armed = armed.clone();
        let factory = SessionFactory::new(None, Arc::new(|_, _| Ok(()))).with_probe(Arc::new(
            move |stage, path| {
                if stage == Stage::Prepared
                    && path.ends_with(cadence::store::model::STATE)
                    && probe_armed.swap(false, Ordering::SeqCst)
                {
                    Err(Error::Io("injected pause record failure".into()))
                } else {
                    Ok(())
                }
            },
        ));
        let failed = CadenceServer::with_factory(factory);
        assert!(failed.pause(request.clone()).await.is_err());
        let wip = String::from_utf8(git::run(root, ["rev-parse", "HEAD"]).unwrap())
            .unwrap()
            .trim()
            .to_owned();
        assert_ne!(wip, before);
        assert_eq!(
            git::run(root, ["show", &format!("{wip}:partial.txt")]).unwrap(),
            b"preserve before record\n"
        );
        let recovery = server()
            .evidence(&root.join(".planning"), Command::Read)
            .await
            .unwrap();
        assert!(!recovery.current.iter().any(|record| matches!(
            &record.fact,
            Fact::Override(value) if value.id == "pause-resume"
        )));

        let Response::Ready(capture) = server().pause(request).await.unwrap() else {
            panic!("retry must finish the preserved pause");
        };
        assert_eq!(capture.wip, None);
        let count = String::from_utf8(
            git::run(root, ["rev-list", "--count", &format!("{before}..HEAD")]).unwrap(),
        )
        .unwrap();
        assert_eq!(count.trim(), "2");
        let subjects = String::from_utf8(
            git::run(root, ["log", "--format=%s", &format!("{before}..HEAD")]).unwrap(),
        )
        .unwrap();
        assert_eq!(subjects.matches("wip: Work").count(), 1);
        assert_eq!(subjects.matches("docs: pause at phase 1").count(), 1);
        let recovery = server()
            .evidence(&root.join(".planning"), Command::Read)
            .await
            .unwrap();
        assert_eq!(
            recovery
                .history
                .iter()
                .filter(|record| matches!(
                    &record.fact,
                    Fact::Override(value) if value.id == "pause-resume"
                ))
                .count(),
            1
        );
        git::require_clean(root).unwrap();
    });
}

#[test]
fn pause_record_risk_identity_ignores_changed_binary_receipt_bytes() {
    runtime().block_on(async {
        let temp = risk_fixture("blocking", Some(json!(["destructive"]))).await;
        let root = temp.path();
        let note = ".planning/phases/1/operator note.md";
        fs::write(
            root.join(note),
            "DROP TABLE only in authored documentation\n",
        )
        .unwrap();
        let mut request = input(root, "record-risk-receipts");
        request.authorized.insert(note.into());

        let need = reviewing(server().pause(request.clone()).await.unwrap());
        assert_eq!(need.fire.commit_kind, risk::CommitKind::ResumeRecord);
        assert_eq!(need.fire.authored, vec![PathBuf::from(note)]);
        review(root, &request, &need, Vec::new()).await;
        let Response::Ready(capture) = server().pause(request).await.unwrap() else {
            panic!("receipt-only changes must not create a second review fire");
        };
        assert_eq!(capture.wip, None);
        git::require_clean(root).unwrap();
        assert_eq!(
            git::run(root, ["show", &format!("HEAD:{note}")]).unwrap(),
            b"DROP TABLE only in authored documentation\n"
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
