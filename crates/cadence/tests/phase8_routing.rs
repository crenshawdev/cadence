use cadence::execution::model::roles;

use roles::{Input, Stored, resolve};
use serde_json::{Value, json};

fn input(role: &str, default_effort: &str) -> Input {
    Input {
        role: role.into(),
        phase: None,
        plan: None,
        attempt: 1,
        default_effort: default_effort.into(),
        role_effort: None,
        legacy_effort: None,
        role_model: None,
        legacy_model: None,
        escalate_on_failure: false,
    }
}

fn stored(key: String, layer: &str, value: Value) -> Stored {
    Stored {
        key,
        layer: layer.into(),
        value,
    }
}

#[test]
fn default_role_inputs_return_the_six_literal_starting_choices() {
    for (role, default_effort, agent) in [
        ("cad-planner", "high", "cad-planner"),
        (
            "cad-assumptions-analyzer",
            "high",
            "cad-assumptions-analyzer-high",
        ),
        ("cad-verifier", "high", "cad-verifier"),
        ("cad-reviewer", "medium", "cad-reviewer-medium"),
        ("cad-executor", "high", "cad-executor"),
        ("cad-plan-checker", "low", "cad-plan-checker"),
    ] {
        let answer = resolve(&input(role, default_effort)).unwrap();
        assert_eq!(
            (
                answer.agent.as_str(),
                answer.rung.as_str(),
                answer.model,
                answer.pinned
            ),
            (agent, default_effort, None, false)
        );
        assert_eq!(
            (
                answer.effort_source.kind.as_str(),
                answer.effort_source.layer.as_str()
            ),
            ("absent", "defaults")
        );
        assert_eq!(
            (
                answer.model_source.kind.as_str(),
                answer.model_source.layer.as_str()
            ),
            ("absent", "session")
        );
    }
}

#[test]
fn each_null_independently_defeats_the_older_pin_in_either_layer() {
    for (role, default_effort) in [
        ("cad-planner", "high"),
        ("cad-assumptions-analyzer", "high"),
        ("cad-verifier", "high"),
        ("cad-reviewer", "medium"),
        ("cad-executor", "high"),
        ("cad-plan-checker", "low"),
    ] {
        for (primary, legacy) in [("repo", "global"), ("global", "repo")] {
            for (reset_effort, reset_model) in
                [(false, false), (true, false), (false, true), (true, true)]
            {
                let mut request = input(role, default_effort);
                request.legacy_effort =
                    Some(stored(format!("model.effort.{role}"), legacy, json!("max")));
                request.legacy_model = Some(stored(
                    format!("model.overrides.{role}"),
                    legacy,
                    json!("opus"),
                ));
                request.role_effort = reset_effort
                    .then(|| stored(format!("roles.{role}.effort"), primary, Value::Null));
                request.role_model = reset_model
                    .then(|| stored(format!("roles.{role}.model"), primary, Value::Null));
                let answer = resolve(&request).unwrap();
                assert_eq!(
                    answer.rung,
                    if reset_effort { default_effort } else { "max" }
                );
                assert_eq!(
                    answer.model.as_deref(),
                    if reset_model { None } else { Some("opus") }
                );
                assert_eq!(answer.pinned, !reset_model);
                assert_eq!(
                    answer.effort_source.kind,
                    if reset_effort { "reset" } else { "legacy" }
                );
                assert_eq!(
                    answer.model_source.kind,
                    if reset_model { "reset" } else { "legacy" }
                );
                assert_eq!(
                    answer.effort_source.layer,
                    if reset_effort { primary } else { legacy }
                );
                assert_eq!(
                    answer.model_source.layer,
                    if reset_model { primary } else { legacy }
                );
                assert_eq!(
                    answer
                        .effort_source
                        .ignored_legacy
                        .as_ref()
                        .map(|value| value.value.clone()),
                    if reset_effort {
                        Some(json!("max"))
                    } else {
                        None
                    }
                );
                assert_eq!(
                    answer
                        .model_source
                        .ignored_legacy
                        .as_ref()
                        .map(|value| value.value.clone()),
                    if reset_model {
                        Some(json!("opus"))
                    } else {
                        None
                    }
                );
            }
        }
    }
}

#[test]
fn explicit_values_keep_their_source_and_all_thirty_agent_names_are_literal() {
    for (role, expected) in [
        (
            "cad-planner",
            [
                "cad-planner-low",
                "cad-planner-medium",
                "cad-planner",
                "cad-planner-xhigh",
                "cad-planner-max",
            ],
        ),
        (
            "cad-assumptions-analyzer",
            [
                "cad-assumptions-analyzer-low",
                "cad-assumptions-analyzer-medium",
                "cad-assumptions-analyzer-high",
                "cad-assumptions-analyzer",
                "cad-assumptions-analyzer-max",
            ],
        ),
        (
            "cad-verifier",
            [
                "cad-verifier-low",
                "cad-verifier-medium",
                "cad-verifier",
                "cad-verifier-xhigh",
                "cad-verifier-max",
            ],
        ),
        (
            "cad-reviewer",
            [
                "cad-reviewer-low",
                "cad-reviewer-medium",
                "cad-reviewer",
                "cad-reviewer-xhigh",
                "cad-reviewer-max",
            ],
        ),
        (
            "cad-executor",
            [
                "cad-executor-low",
                "cad-executor-medium",
                "cad-executor",
                "cad-executor-xhigh",
                "cad-executor-max",
            ],
        ),
        (
            "cad-plan-checker",
            [
                "cad-plan-checker",
                "cad-plan-checker-medium",
                "cad-plan-checker-high",
                "cad-plan-checker-xhigh",
                "cad-plan-checker-max",
            ],
        ),
    ] {
        for (rung, agent) in ["low", "medium", "high", "xhigh", "max"]
            .into_iter()
            .zip(expected)
        {
            for layer in ["global", "repo"] {
                let mut request = input(role, "high");
                request.role_effort =
                    Some(stored(format!("roles.{role}.effort"), layer, json!(rung)));
                request.role_model = Some(stored(
                    format!("roles.{role}.model"),
                    layer,
                    json!("sonnet"),
                ));
                request.legacy_model = Some(stored(
                    format!("model.overrides.{role}"),
                    "repo",
                    json!("opus"),
                ));
                let answer = resolve(&request).unwrap();
                assert_eq!(
                    (
                        answer.agent.as_str(),
                        answer.rung.as_str(),
                        answer.model.as_deref(),
                        answer.pinned
                    ),
                    (agent, rung, Some("sonnet"), false)
                );
                assert_eq!(
                    (
                        answer.effort_source.kind.as_str(),
                        answer.effort_source.layer.as_str()
                    ),
                    ("role", layer)
                );
                assert_eq!(
                    (
                        answer.model_source.kind.as_str(),
                        answer.model_source.layer.as_str()
                    ),
                    ("role", layer)
                );
            }
        }
    }
}

#[test]
fn retries_advance_once_from_the_starting_rung_and_hold_at_max() {
    for role in [
        "cad-planner",
        "cad-assumptions-analyzer",
        "cad-verifier",
        "cad-reviewer",
        "cad-executor",
        "cad-plan-checker",
    ] {
        for (start, next) in [
            ("low", "medium"),
            ("medium", "high"),
            ("high", "xhigh"),
            ("xhigh", "max"),
            ("max", "max"),
        ] {
            for attempt in [1, 2, 3] {
                for enabled in [false, true] {
                    let mut request = input(role, "high");
                    request.role_effort =
                        Some(stored(format!("roles.{role}.effort"), "repo", json!(start)));
                    request.attempt = attempt;
                    request.escalate_on_failure = enabled;
                    let answer = resolve(&request).unwrap();
                    assert_eq!(answer.starting_rung, start);
                    assert_eq!(
                        answer.rung,
                        if enabled && attempt > 1 { next } else { start }
                    );
                    assert_eq!(answer.escalated, enabled && attempt > 1 && start != "max");
                }
            }
        }
    }
}

#[test]
fn unsupported_custom_model_is_reported_verbatim_without_reviving_opus() {
    let mut request = input("cad-executor", "high");
    request.role_model = Some(stored(
        "roles.cad-executor.model".into(),
        "repo",
        json!(" custom \"x\" = λ "),
    ));
    request.legacy_model = Some(stored(
        "model.overrides.cad-executor".into(),
        "global",
        json!("opus"),
    ));
    let answer = resolve(&request).unwrap();
    assert_eq!(answer.model, None);
    assert!(!answer.pinned);
    assert_eq!(answer.model_source.kind, "unsupported");
    assert_eq!(
        answer.model_source.stored,
        Some(json!(" custom \"x\" = λ "))
    );
    assert_eq!(
        answer.warnings,
        [
            "roles.cad-executor.model=\" custom \\\"x\\\" = λ \" is unsupported; supported host aliases are opus/sonnet/haiku/fable; omit model without legacy fallback"
        ]
    );
}

#[test]
fn only_supported_legacy_models_pin_and_invalid_scope_returns_literal_error() {
    for (model, expected, pinned) in [
        ("opus", Some("opus"), true),
        ("sonnet", Some("sonnet"), true),
        ("haiku", Some("haiku"), true),
        ("fable", Some("fable"), true),
        ("custom", None, false),
    ] {
        let mut request = input("cad-executor", "high");
        request.legacy_model = Some(stored(
            "model.overrides.cad-executor".into(),
            "global",
            json!(model),
        ));
        let answer = resolve(&request).unwrap();
        assert_eq!((answer.model.as_deref(), answer.pinned), (expected, pinned));
    }
    for (attempt, phase, plan) in [
        (0, None, None),
        (1, Some(0), None),
        (1, Some(8), Some(0)),
        (1, None, Some(1)),
    ] {
        let mut request = input("cad-executor", "high");
        request.attempt = attempt;
        request.phase = phase;
        request.plan = plan;
        assert_eq!(resolve(&request), Err(cadence::store::Error::Invalid("route requires a positive attempt and positive phase/plan; a plan requires a phase".into())));
    }
    assert_eq!(
        resolve(&input("executor", "high")),
        Err(cadence::store::Error::Invalid(
            "unknown routing role".into()
        ))
    );
}

#[test]
fn global_resets_return_the_literal_reason_trail_with_ignored_repo_pins() {
    let mut request = input("cad-executor", "high");
    request.role_effort = Some(stored(
        "roles.cad-executor.effort".into(),
        "global",
        Value::Null,
    ));
    request.role_model = Some(stored(
        "roles.cad-executor.model".into(),
        "global",
        Value::Null,
    ));
    request.legacy_effort = Some(stored(
        "model.effort.cad-executor".into(),
        "repo",
        json!("max"),
    ));
    request.legacy_model = Some(stored(
        "model.overrides.cad-executor".into(),
        "repo",
        json!("opus"),
    ));
    let answer = resolve(&request).unwrap();
    assert_eq!(
        answer.reasons,
        [
            "roles.cad-executor.effort: reset from global; starting rung high",
            "roles.cad-executor.model: reset from global; omit model; inherit session",
            "model.effort.cad-executor from repo is ignored by roles.cad-executor.effort",
            "model.overrides.cad-executor from repo is ignored by roles.cad-executor.model",
        ]
    );
}

use cadence::config::{Layer, merge, policy};

#[test]
fn policy_defaults_return_only_the_three_surviving_trigger_rows() {
    let result = policy::resolve(&merge::merge(None, None, false)).unwrap();
    assert_eq!(
        result.triggers,
        [
            (
                "diff".into(),
                policy::Trigger {
                    gate: "off".into(),
                    gate_source: None,
                    reviewers: vec!["claude-subagent".into()],
                    tier: "cheap".into(),
                    effort: "minimal".into()
                }
            ),
            (
                "plan".into(),
                policy::Trigger {
                    gate: "advisory".into(),
                    gate_source: None,
                    reviewers: vec!["claude-subagent".into()],
                    tier: "cheap".into(),
                    effort: "low".into()
                }
            ),
            (
                "risk_surface".into(),
                policy::Trigger {
                    gate: "blocking".into(),
                    gate_source: None,
                    reviewers: vec!["claude-subagent".into()],
                    tier: "cheap".into(),
                    effort: "low".into()
                }
            ),
        ]
        .into()
    );
}

#[test]
fn policy_filters_each_trigger_at_its_own_tier() {
    let supplied = json!({"review":{"reviewers":["openai","gemini","deepseek"],
        "providers":{"openai":{"tiers":{"cheap":"cheap-model","balanced":" ","flagship":null}},"gemini":{"tiers":{"balanced":"balanced-model"}},"deepseek":{"tiers":{"flagship":"flagship-model"}}},
        "triggers":{"diff":{"gate":"deferred","tier":"flagship","effort":"high"},"plan":{"gate":"advisory","tier":"balanced","effort":"medium"},"risk_surface":{"gate":"adjudicated","tier":"cheap","effort":"minimal"}}}});
    let result = policy::resolve(&merge::merge(None, Some(supplied), false)).unwrap();
    assert_eq!(
        result.triggers,
        [
            (
                "diff".into(),
                policy::Trigger {
                    gate: "deferred".into(),
                    gate_source: Some(Layer::Repo),
                    reviewers: vec!["deepseek".into()],
                    tier: "flagship".into(),
                    effort: "high".into()
                }
            ),
            (
                "plan".into(),
                policy::Trigger {
                    gate: "advisory".into(),
                    gate_source: Some(Layer::Repo),
                    reviewers: vec!["gemini".into()],
                    tier: "balanced".into(),
                    effort: "medium".into()
                }
            ),
            (
                "risk_surface".into(),
                policy::Trigger {
                    gate: "adjudicated".into(),
                    gate_source: Some(Layer::Repo),
                    reviewers: vec!["openai".into()],
                    tier: "cheap".into(),
                    effort: "minimal".into()
                }
            ),
        ]
        .into()
    );
}

#[test]
fn policy_names_every_missing_provider_setting_and_fallback() {
    let supplied = json!({"review":{"reviewers":["openai"]}});
    let result = policy::resolve(&merge::merge(None, Some(supplied), false)).unwrap();
    assert_eq!((result.diagnostics, result.reasons[1..].to_vec()), (
        vec!["diff: dropped openai; review.providers.openai.tiers.cheap has no nonblank model ID at tier cheap", "plan: dropped openai; review.providers.openai.tiers.cheap has no nonblank model ID at tier cheap", "risk_surface: dropped openai; review.providers.openai.tiers.cheap has no nonblank model ID at tier cheap"].into_iter().map(str::to_owned).collect::<Vec<_>>(),
        vec!["diff: no configured reviewer qualifies at tier cheap; falling back to claude-subagent", "plan: no configured reviewer qualifies at tier cheap; falling back to claude-subagent", "risk_surface: no configured reviewer qualifies at tier cheap; falling back to claude-subagent"].into_iter().map(str::to_owned).collect::<Vec<_>>()));
}

#[test]
fn policy_empty_reviewers_fall_back_to_the_subagent() {
    let supplied = json!({"review":{"reviewers":[]}});
    assert_eq!(
        policy::resolve(&merge::merge(None, Some(supplied), false))
            .unwrap()
            .triggers["plan"]
            .reviewers,
        vec!["claude-subagent"]
    );
}

#[test]
fn policy_mixed_list_keeps_subagent_without_provider_configuration() {
    let supplied = json!({"review":{"reviewers":["openai","claude-subagent"]}});
    assert_eq!(
        policy::resolve(&merge::merge(None, Some(supplied), false))
            .unwrap()
            .triggers["plan"]
            .reviewers,
        vec!["claude-subagent"]
    );
}

#[test]
fn policy_surface_answers_preserve_phase_seven_meanings() {
    for (supplied, expected) in [
        (json!({}), policy::SurfaceAnswer::Unanswered),
        (
            json!({"review":{"triggers":{"risk_surface":{"surfaces":null}}}}),
            policy::SurfaceAnswer::Unanswered,
        ),
        (
            json!({"review":{"triggers":{"risk_surface":{"surfaces":[]}}}}),
            policy::SurfaceAnswer::Invalid {
                reason: "Invalid(\"invalid risk surface answer\")".into(),
            },
        ),
        (
            json!({"review":{"triggers":{"risk_surface":{"surfaces":["auth","secrets"]}}}}),
            policy::SurfaceAnswer::Answered {
                categories: vec!["auth".into(), "secrets".into()],
            },
        ),
    ] {
        assert_eq!(
            policy::resolve(&merge::merge(None, Some(supplied), false))
                .unwrap()
                .surfaces,
            expected
        );
    }
}

#[test]
fn policy_explicit_default_gate_retains_its_winning_layer() {
    let supplied = json!({"review":{"triggers":{"plan":{"gate":"advisory"}}}});
    assert_eq!(
        policy::resolve(&merge::merge(Some(supplied), None, false))
            .unwrap()
            .triggers["plan"]
            .gate_source,
        Some(Layer::Global)
    );
}

fn route_generation(repo: Value) -> cadence::config::reload::Generation {
    cadence::config::reload::Generation {
        number: 17,
        global: None,
        repo: cadence::config::reload::Input {
            identity: "/project/.planning/config.v4.json".into(),
            bytes: None,
            stamp: None,
        },
        effective: merge::merge(None, Some(repo), false),
    }
}

#[test]
fn route_bundle_uses_the_supplied_generation_for_policy_and_spending() {
    let generation = route_generation(
        json!({"roles":{"cad-executor":{"model":"sonnet","effort":"xhigh"}},"review":{"triggers":{"plan":{"gate":"off"}}}}),
    );
    let result = cadence::config_service::resolve_route(
        &generation,
        &cadence::config_service::RouteRequest {
            role: "cad-executor".into(),
            phase: None,
            plan: None,
            attempt: None,
        },
    )
    .unwrap();
    assert_eq!(
        (
            result.generation,
            result.choice.model,
            result.choice.agent,
            result.policy.triggers["plan"].gate.as_str(),
            result.floor.state
        ),
        (
            17,
            Some("sonnet".into()),
            "cad-executor-xhigh".into(),
            "off",
            cadence::config::floor::State::NotComputed
        )
    );
}

#[test]
fn route_bundle_refuses_invalid_supported_policy() {
    let generation = route_generation(json!({"review":{"triggers":{"plan":{"gate":"invalid"}}}}));
    assert_eq!(
        cadence::config_service::resolve_route(
            &generation,
            &cadence::config_service::RouteRequest {
                role: "cad-executor".into(),
                phase: None,
                plan: None,
                attempt: None
            }
        )
        .unwrap_err()
        .to_string(),
        "Policy(\"config unavailable: unusable review.triggers.plan.gate\")"
    );
}

use cadence::config::floor::{self, Access, State};
use cadence::rail::risk_diff::{DeclaredMatch, DeclaredScan, Withheld, scan_declared};
use std::{fs, io, path::Path};

fn native_plan(number: u32, files: &[&str], directories: &[&str]) -> String {
    format!(
        "---\nphase: 8\nplan: {number}\nrequirements: [AC9]\nfiles: {}\ndirectories: {}\nexecution:\n  schema: 1\n  suite: verify\n  tasks:\n    - id: T1\n      verify: [verify]\n---\nFixture body; prose/auth.rs is not a lease.\n",
        serde_json::to_string(files).unwrap(),
        serde_json::to_string(directories).unwrap()
    )
}
fn scope_fixture(plans: &[(u32, &[&str], &[&str])], bodies: &[(&str, &[u8])]) -> tempfile::TempDir {
    let root = tempfile::tempdir().unwrap();
    fs::create_dir_all(root.path().join(".planning/phases/8")).unwrap();
    for (number, files, directories) in plans {
        fs::write(
            root.path()
                .join(format!(".planning/phases/8/PLAN-{number}.md")),
            native_plan(*number, files, directories),
        )
        .unwrap();
    }
    for (path, bytes) in bodies {
        let path = root.path().join(path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, bytes).unwrap();
    }
    root
}
fn categories() -> Vec<String> {
    cadence::rail::risk::CATEGORIES
        .iter()
        .map(|c| (*c).into())
        .collect()
}

#[test]
fn floor_named_plan_is_clean_independently_of_risky_sibling() {
    let root = scope_fixture(
        &[(1, &["plain.rs"], &[]), (2, &["auth/new.rs"], &[])],
        &[("plain.rs", b"fn main() {}")],
    );
    let result = floor::read_observed(
        &root.path().join(".planning"),
        "cad-executor",
        Some(8),
        Some(1),
        &categories(),
        |_, _| Ok(()),
    )
    .unwrap();
    assert_eq!(
        (result.state, result.paths, result.matches),
        (State::Complete, vec!["plain.rs".into()], vec![])
    );
}

#[test]
fn floor_phase_union_includes_new_file_path_evidence() {
    let root = scope_fixture(&[(2, &["auth/new.rs"], &[]), (1, &["plain.rs"], &[])], &[]);
    let result = floor::read_observed(
        &root.path().join(".planning"),
        "cad-verifier",
        Some(8),
        None,
        &categories(),
        |_, _| Ok(()),
    )
    .unwrap();
    assert_eq!(
        (result.state, result.paths, result.matches, result.bytes),
        (
            State::Complete,
            vec!["auth/new.rs".into(), "plain.rs".into()],
            vec![DeclaredMatch {
                path: "auth/new.rs".into(),
                category: "auth".into(),
                signal: "path segment auth".into()
            }],
            0
        )
    );
}

#[test]
fn floor_preplan_roles_and_no_phase_do_no_filesystem_access() {
    for (role, phase, expected) in [
        ("cad-planner", Some(8), State::Bypassed),
        ("cad-assumptions-analyzer", Some(8), State::Bypassed),
        ("cad-executor", None, State::NotComputed),
    ] {
        assert_eq!(
            floor::read_observed(
                Path::new("/unobserved/.planning"),
                role,
                phase,
                Some(1),
                &categories(),
                |_, _| panic!("forbidden filesystem observation")
            )
            .unwrap()
            .state,
            expected
        );
    }
}

#[test]
fn floor_missing_named_plan_does_not_fall_back_to_a_sibling() {
    let root = scope_fixture(&[(2, &["plain.rs"], &[])], &[]);
    let result = floor::read_observed(
        &root.path().join(".planning"),
        "cad-executor",
        Some(8),
        Some(1),
        &categories(),
        |_, _| Ok(()),
    )
    .unwrap();
    assert_eq!(
        (
            result.state,
            result.paths,
            result
                .diagnostics
                .iter()
                .map(|d| d.reason.as_str())
                .collect::<Vec<_>>()
        ),
        (
            State::Incomplete,
            vec![],
            vec!["plan read: plan missing", "empty total declared scope"]
        )
    );
}

#[test]
fn floor_native_parser_refuses_malformed_and_empty_leases() {
    for (bytes, reason) in [
        (
            native_plan(1, &["plain.rs/"], &[]),
            "plan parse: invalid-path",
        ),
        (native_plan(1, &[], &[]), "plan parse: empty-lease"),
    ] {
        let root = scope_fixture(&[], &[]);
        fs::write(root.path().join(".planning/phases/8/PLAN-1.md"), bytes).unwrap();
        let result = floor::read_observed(
            &root.path().join(".planning"),
            "cad-executor",
            Some(8),
            Some(1),
            &categories(),
            |_, _| Ok(()),
        )
        .unwrap();
        assert_eq!(
            (result.state, result.diagnostics[0].reason.as_str()),
            (State::Incomplete, reason)
        );
    }
}

#[test]
fn floor_plan_identity_cannot_cross_the_named_phase() {
    let root = scope_fixture(&[(1, &["plain.rs"], &[])], &[]);
    fs::write(
        root.path().join(".planning/phases/8/PLAN-1.md"),
        native_plan(1, &["plain.rs"], &[]).replace("phase: 8", "phase: 9"),
    )
    .unwrap();
    assert_eq!(
        floor::read_observed(
            &root.path().join(".planning"),
            "cad-executor",
            Some(8),
            Some(1),
            &categories(),
            |_, _| Ok(())
        )
        .unwrap()
        .diagnostics[0]
            .reason,
        "plan parse: identity-mismatch"
    );
}

#[test]
fn floor_unreadable_sibling_keeps_union_incomplete() {
    let root = scope_fixture(&[(1, &["plain.rs"], &[]), (2, &["auth/new.rs"], &[])], &[]);
    let result = floor::read_observed(
        &root.path().join(".planning"),
        "cad-verifier",
        Some(8),
        None,
        &categories(),
        |access, path| {
            if access == Access::ReadBody && path.ends_with("PLAN-2.md") {
                Err(io::Error::other("injected plan read"))
            } else {
                Ok(())
            }
        },
    )
    .unwrap();
    assert_eq!(
        (
            result.state,
            result.paths,
            result.diagnostics[0].reason.as_str()
        ),
        (
            State::Incomplete,
            vec!["plain.rs".into()],
            "plan read: injected plan read"
        )
    );
}

#[test]
fn floor_neutral_path_metadata_failures_never_become_new_files() {
    for (code, message) in [
        (
            libc::EACCES,
            "metadata or containment: Permission denied (os error 13)",
        ),
        (
            libc::ELOOP,
            "metadata or containment: Too many levels of symbolic links (os error 40)",
        ),
        (
            libc::ENOTDIR,
            "metadata or containment: Not a directory (os error 20)",
        ),
    ] {
        let root = scope_fixture(
            &[(1, &["plain.rs"], &[])],
            &[("plain.rs", b"jwt.verify(token)")],
        );
        let result = floor::read_observed(
            &root.path().join(".planning"),
            "cad-executor",
            Some(8),
            Some(1),
            &categories(),
            |access, path| {
                if access == Access::Metadata && path.ends_with("plain.rs") {
                    Err(io::Error::from_raw_os_error(code))
                } else {
                    Ok(())
                }
            },
        )
        .unwrap();
        assert_eq!(
            (result.state, result.matches, result.diagnostics),
            (
                State::Incomplete,
                vec![],
                vec![floor::Diagnostic {
                    path: "plain.rs".into(),
                    reason: message.into()
                }]
            )
        );
    }
}

#[test]
fn floor_source_read_and_canonicalization_failures_are_incomplete() {
    for (access, expected) in [
        (Access::ReadBody, "body read: injected failure"),
        (
            Access::Canonicalize,
            "metadata or containment: injected failure",
        ),
    ] {
        let root = scope_fixture(
            &[(1, &["plain.rs"], &[])],
            &[("plain.rs", b"jwt.verify(token)")],
        );
        let result = floor::read_observed(
            &root.path().join(".planning"),
            "cad-executor",
            Some(8),
            Some(1),
            &categories(),
            |a, path| {
                if a == access && path.ends_with("plain.rs") {
                    Err(io::Error::other("injected failure"))
                } else {
                    Ok(())
                }
            },
        )
        .unwrap();
        assert_eq!(
            (result.state, result.diagnostics[0].reason.as_str()),
            (State::Incomplete, expected)
        );
    }
}

#[test]
fn floor_outside_symlinked_parent_refuses_existing_and_missing_leaves() {
    for exists in [false, true] {
        let outside = tempfile::tempdir().unwrap();
        if exists {
            fs::write(outside.path().join("plain.rs"), b"jwt.verify(token)").unwrap();
        }
        let root = scope_fixture(&[(1, &["link/plain.rs"], &[])], &[]);
        std::os::unix::fs::symlink(outside.path(), root.path().join("link")).unwrap();
        let result = floor::read_observed(
            &root.path().join(".planning"),
            "cad-executor",
            Some(8),
            Some(1),
            &categories(),
            |_, _| Ok(()),
        )
        .unwrap();
        assert_eq!(
            (
                result.state,
                result.bytes,
                result.diagnostics[0].reason.as_str()
            ),
            (
                State::Incomplete,
                0,
                "metadata or containment: path resolves outside the project"
            )
        );
    }
}

#[test]
fn floor_final_symlink_and_fifo_are_rejected_before_open() {
    for symlink in [false, true] {
        let root = scope_fixture(&[(1, &["plain.rs"], &[])], &[]);
        if symlink {
            std::os::unix::fs::symlink("/dev/zero", root.path().join("plain.rs")).unwrap();
        } else {
            use std::{ffi::CString, os::unix::ffi::OsStrExt};
            let path = CString::new(root.path().join("plain.rs").as_os_str().as_bytes()).unwrap();
            let result = unsafe { libc::mkfifo(path.as_ptr(), 0o600) };
            if result != 0 {
                panic!("fixture FIFO: {}", io::Error::last_os_error());
            }
        }
        let result = floor::read_observed(
            &root.path().join(".planning"),
            "cad-executor",
            Some(8),
            Some(1),
            &categories(),
            |access, path| {
                if path.ends_with("plain.rs") && access == Access::OpenBody {
                    panic!("nonregular body opened");
                }
                Ok(())
            },
        )
        .unwrap();
        assert_eq!(
            (
                result.state,
                result.bytes,
                result.diagnostics[0].reason.as_str()
            ),
            (
                State::Incomplete,
                0,
                if symlink {
                    "metadata or containment: final symlink is not declared evidence"
                } else {
                    "body read: not a regular file"
                }
            )
        );
    }
}

#[test]
fn floor_body_growth_and_replacement_are_incomplete() {
    for access in [Access::OpenBody, Access::ReadBody, Access::AfterRead] {
        let root = scope_fixture(&[(1, &["plain.rs"], &[])], &[("plain.rs", b"safe")]);
        let result = floor::read_observed(
            &root.path().join(".planning"),
            "cad-executor",
            Some(8),
            Some(1),
            &categories(),
            |a, path| {
                if a == access && path.ends_with("plain.rs") {
                    if access == Access::OpenBody {
                        let replacement = path.with_extension("replacement");
                        fs::write(&replacement, b"safe")?;
                        fs::rename(replacement, path)?;
                    } else {
                        fs::write(path, b"jwt.verify(token)")?;
                    }
                }
                Ok(())
            },
        )
        .unwrap();
        assert_eq!(
            (result.state, result.diagnostics[0].reason.as_str()),
            (
                State::Incomplete,
                if access == Access::OpenBody {
                    "body read: body replaced before open"
                } else {
                    "body read: body replaced or grew during read"
                }
            )
        );
    }
}

#[test]
fn floor_body_size_and_invalid_utf8_are_incomplete() {
    for (bytes, expected) in [
        (
            vec![b'x'; floor::MAX_BODY_BYTES + 1],
            "body read: body size or total read budget exceeded",
        ),
        (vec![255], "body is not UTF-8"),
    ] {
        let root = scope_fixture(&[(1, &["plain.rs"], &[])], &[("plain.rs", &bytes)]);
        let result = floor::read_observed(
            &root.path().join(".planning"),
            "cad-executor",
            Some(8),
            Some(1),
            &categories(),
            |_, _| Ok(()),
        )
        .unwrap();
        assert_eq!(
            (result.state, result.diagnostics[0].reason.as_str()),
            (State::Incomplete, expected)
        );
    }
}

#[test]
fn floor_directory_walk_ignores_ignore_rules_and_deduplicates_overlap() {
    let root = scope_fixture(
        &[(1, &["src/plain.rs"], &["src", "src/auth"])],
        &[
            ("src/plain.rs", b"safe"),
            ("src/auth/new.rs", b"safe"),
            ("src/.gitignore", b"*"),
        ],
    );
    let result = floor::read_observed(
        &root.path().join(".planning"),
        "cad-executor",
        Some(8),
        Some(1),
        &categories(),
        |_, _| Ok(()),
    )
    .unwrap();
    assert_eq!(
        (result.state, result.paths, result.bytes),
        (
            State::Complete,
            vec![
                "src",
                "src/.gitignore",
                "src/auth",
                "src/auth/new.rs",
                "src/plain.rs"
            ]
            .into_iter()
            .map(str::to_owned)
            .collect::<Vec<_>>(),
            9
        )
    );
}

#[test]
fn floor_directory_and_phase_enumeration_failures_are_incomplete() {
    for (suffix, plan, reason) in [
        ("src", Some(1), "directory enumeration: injected listing"),
        ("phases/8", None, "phase listing: injected listing"),
    ] {
        let root = scope_fixture(&[(1, &[], &["src"])], &[("src/plain.rs", b"safe")]);
        let result = floor::read_observed(
            &root.path().join(".planning"),
            "cad-executor",
            Some(8),
            plan,
            &categories(),
            |access, path| {
                if access == Access::ListDirectory && path.ends_with(suffix) {
                    Err(io::Error::other("injected listing"))
                } else {
                    Ok(())
                }
            },
        )
        .unwrap();
        assert_eq!(
            (result.state, result.diagnostics[0].reason.as_str()),
            (State::Incomplete, reason)
        );
    }
}

#[test]
fn floor_directory_walk_entry_bound_reports_incomplete() {
    let root = scope_fixture(&[(1, &[], &["src"])], &[]);
    fs::create_dir(root.path().join("src")).unwrap();
    for i in 0..4097 {
        fs::write(root.path().join(format!("src/{i}")), b"").unwrap();
    }
    assert_eq!(
        floor::read_observed(
            &root.path().join(".planning"),
            "cad-executor",
            Some(8),
            Some(1),
            &categories(),
            |_, _| Ok(())
        )
        .unwrap()
        .diagnostics[0]
            .reason,
        "directory enumeration: directory exceeds 4096 entry bound"
    );
}

#[test]
fn floor_total_source_read_budget_is_not_silently_truncated() {
    let root = scope_fixture(&[(1, &[], &["src"])], &[]);
    fs::create_dir(root.path().join("src")).unwrap();
    for i in 0..33 {
        fs::write(
            root.path().join(format!("src/{i:02}.md")),
            vec![b'x'; 512 * 1024],
        )
        .unwrap();
    }
    let result = floor::read_observed(
        &root.path().join(".planning"),
        "cad-executor",
        Some(8),
        Some(1),
        &categories(),
        |_, _| Ok(()),
    )
    .unwrap();
    assert_eq!(
        (result.state, result.bytes, result.diagnostics),
        (
            State::Incomplete,
            16 * 1024 * 1024,
            vec![floor::Diagnostic {
                path: "src/32.md".into(),
                reason: "body read: body size or total read budget exceeded".into()
            }]
        )
    );
}

#[test]
fn declared_documents_keep_path_hits_and_name_body_exclusion() {
    assert_eq!(
        scan_declared(
            "docs/auth/guide.md",
            Some("jwt.verify(token)\nJSON.parse(input)"),
            &categories()
        )
        .unwrap(),
        DeclaredScan {
            matches: vec![DeclaredMatch {
                path: "docs/auth/guide.md".into(),
                category: "auth".into(),
                signal: "path segment auth".into()
            }],
            withheld: vec![Withheld {
                path: "docs/auth/guide.md".into(),
                category: None,
                reason: "document body".into()
            }]
        }
    );
}

#[test]
fn declared_signal_tables_exclude_only_the_documented_paths() {
    assert_eq!(
        scan_declared(
            "crates/cadence/src/rail/risk_diff.rs",
            Some("jwt.verify(token)"),
            &categories()
        )
        .unwrap(),
        DeclaredScan {
            matches: vec![],
            withheld: vec![Withheld {
                path: "crates/cadence/src/rail/risk_diff.rs".into(),
                category: None,
                reason: "signal-table body".into()
            }]
        }
    );
}

#[test]
fn declared_import_and_literal_constants_name_withheld_categories() {
    assert_eq!(
        scan_declared(
            "plain.js",
            Some("import jwt from 'jsonwebtoken';\nconst API_TOKEN = 'literal';"),
            &categories()
        )
        .unwrap(),
        DeclaredScan {
            matches: vec![],
            withheld: vec![
                Withheld {
                    path: "plain.js".into(),
                    category: Some("auth".into()),
                    reason: "only import or literal-constant lines".into()
                },
                Withheld {
                    path: "plain.js".into(),
                    category: Some("secrets".into()),
                    reason: "only import or literal-constant lines".into()
                }
            ]
        }
    );
}

#[test]
fn declared_executable_initializers_and_calls_after_imports_still_count() {
    for body in [
        "const value = JSON.parse(input);",
        "const value = [JSON.parse(input)];",
        "import parser from 'module'; JSON.parse(input);",
    ] {
        assert_eq!(
            scan_declared("plain.js", Some(body), &categories()).unwrap(),
            DeclaredScan {
                matches: vec![DeclaredMatch {
                    path: "plain.js".into(),
                    category: "untrusted_input".into(),
                    signal: "body line: a JSON.parse call".into()
                }],
                withheld: vec![]
            }
        );
    }
}

fn scope_value(state: State, hits: &[(&str, &str, &str)]) -> floor::Scope {
    floor::Scope {
        state,
        paths: vec!["plain.rs".into()],
        matches: hits
            .iter()
            .map(|(path, category, signal)| DeclaredMatch {
                path: (*path).into(),
                category: (*category).into(),
                signal: (*signal).into(),
            })
            .collect(),
        withheld: vec![],
        diagnostics: vec![],
        bytes: 4,
        reasons: vec!["literal scope observation".into()],
    }
}

fn route_value(
    gate: &str,
    source: Option<Layer>,
    waivers: &[&str],
) -> cadence::config_service::Route {
    cadence::config_service::Route {
        choice: serde_json::from_value(json!({"role":"cad-executor","agent":"cad-executor-xhigh","rung":"xhigh","starting_rung":"high","model":"sonnet",
            "effort_source":{"kind":"role","key":"roles.cad-executor.effort","layer":"global","stored":"high"},"model_source":{"kind":"role","key":"roles.cad-executor.model","layer":"repo","stored":"sonnet"},"attempt":3,"escalated":true,"pinned":false,"reasons":["saved choice"],"warnings":[]})).unwrap(),
        generation: 17, config_diagnostics: Default::default(),
        policy: policy::Policy { mode: "adjudicated".into(),
            triggers: [
                ("plan".into(), policy::Trigger { gate: gate.into(), gate_source: source, reviewers: vec!["openai".into()], tier: "flagship".into(), effort: "high".into() }),
                ("diff".into(), policy::Trigger { gate: "off".into(), gate_source: None, reviewers: vec!["claude-subagent".into()], tier: "cheap".into(), effort: "minimal".into() }),
                ("risk_surface".into(), policy::Trigger { gate: "blocking".into(), gate_source: Some(Layer::Repo), reviewers: vec!["gemini".into()], tier: "balanced".into(), effort: "medium".into() }),
            ].into(),
            surfaces: policy::SurfaceAnswer::Answered { categories: vec!["auth".into(), "secrets".into()] }, floor_categories: vec!["auth".into(), "secrets".into()],
            waived_categories: waivers.iter().map(|c| (*c).into()).collect(), reasons: vec![], diagnostics: vec![],
        }, floor: scope_value(State::NotComputed, &[]), deep_verification: false,
    }
}

#[test]
fn route_floor_effect_matrix_changes_only_deep_and_the_default_plan_gate() {
    for (state, hits, waivers, deep, gate) in [
        (State::Complete, vec![], vec![], false, "advisory"),
        (
            State::Complete,
            vec![("plain.rs", "auth", "body line: a JWT sign/verify call")],
            vec![],
            true,
            "blocking",
        ),
        (
            State::Complete,
            vec![("plain.rs", "auth", "body line: a JWT sign/verify call")],
            vec!["auth"],
            false,
            "advisory",
        ),
        (
            State::Complete,
            vec![
                ("plain.rs", "auth", "body line: a JWT sign/verify call"),
                ("plain.rs", "secrets", "body line: a crypto primitive call"),
            ],
            vec!["auth"],
            true,
            "blocking",
        ),
        (
            State::Incomplete,
            vec![],
            vec!["auth", "secrets"],
            true,
            "blocking",
        ),
        (State::Bypassed, vec![], vec![], false, "advisory"),
        (State::NotComputed, vec![], vec![], false, "advisory"),
    ] {
        let result = route_value("advisory", None, &waivers).with_scope(scope_value(state, &hits));
        assert_eq!(
            (
                result.choice.model.as_deref(),
                result.choice.starting_rung.as_str(),
                result.choice.rung.as_str(),
                result.choice.agent.as_str(),
                result.choice.attempt,
                result.choice.escalated,
                result.policy.triggers["diff"].clone(),
                result.policy.triggers["risk_surface"].clone(),
                result.policy.surfaces,
                result.deep_verification,
                result.policy.triggers["plan"].gate.as_str(),
            ),
            (
                Some("sonnet"),
                "high",
                "xhigh",
                "cad-executor-xhigh",
                3,
                true,
                policy::Trigger {
                    gate: "off".into(),
                    gate_source: None,
                    reviewers: vec!["claude-subagent".into()],
                    tier: "cheap".into(),
                    effort: "minimal".into()
                },
                policy::Trigger {
                    gate: "blocking".into(),
                    gate_source: Some(Layer::Repo),
                    reviewers: vec!["gemini".into()],
                    tier: "balanced".into(),
                    effort: "medium".into()
                },
                policy::SurfaceAnswer::Answered {
                    categories: vec!["auth".into(), "secrets".into()]
                },
                deep,
                gate,
            )
        );
    }
}

#[test]
fn route_explicit_gate_matrix_keeps_both_layers_and_all_valid_gates() {
    for source in [Layer::Global, Layer::Repo] {
        for gate in ["advisory", "off", "deferred", "blocking", "adjudicated"] {
            let result = route_value(gate, Some(source), &[])
                .with_scope(scope_value(State::Incomplete, &[]));
            assert_eq!(
                (
                    result.deep_verification,
                    result.policy.triggers["plan"].gate.as_str(),
                    result.policy.triggers["plan"].gate_source
                ),
                (true, gate, Some(source))
            );
        }
    }
}

#[test]
fn route_floor_preserves_a_gate_already_at_or_above_blocking() {
    for gate in ["blocking", "adjudicated"] {
        let result = route_value(gate, None, &[]).with_scope(scope_value(State::Incomplete, &[]));
        assert_eq!(
            (
                result.deep_verification,
                result.policy.triggers["plan"].gate.as_str()
            ),
            (true, gate)
        );
    }
}

#[test]
fn route_floor_names_waived_and_unwaived_causes_and_explicit_gate() {
    let result = route_value("advisory", Some(Layer::Global), &["auth"]).with_scope(scope_value(
        State::Complete,
        &[
            ("auth/new.rs", "auth", "path segment auth"),
            ("plain.rs", "secrets", "body line: a crypto primitive call"),
        ],
    ));
    assert_eq!((result.floor.reasons, result.policy.reasons), (
        vec!["literal scope observation", "auth/new.rs: auth (path segment auth) is waived for the plan-time floor", "plain.rs: unwaived secrets (body line: a crypto primitive call) recommends deep verification"].into_iter().map(str::to_owned).collect::<Vec<_>>(),
        vec!["Explicit Global plan gate advisory wins; the floor does not replace it.".into()],
    ));
}

#[test]
fn floor_incomplete_reason_cannot_be_removed_by_waivers() {
    assert_eq!(floor::recommend(&scope_value(State::Incomplete, &[]), &categories()), floor::Recommendation { deep_verification: true, reasons: vec!["literal scope observation".into(), "Incomplete required scope recommends deep verification; category waivers cannot waive failed observations.".into()] });
}

#[test]
fn policy_layered_waiver_values_keep_empty_replacement_and_repo_precedence() {
    for (global, repo, expected) in [
        (json!(["auth"]), json!([]), vec![]),
        (json!([]), json!(["secrets"]), vec!["secrets".to_owned()]),
        (
            json!(["auth"]),
            json!(["secrets"]),
            vec!["secrets".to_owned()],
        ),
    ] {
        let effective = merge::merge(
            Some(json!({"review":{"triggers":{"risk_surface":{"waive_routing_floor":global}}}})),
            Some(
                json!({"review":{"triggers":{"risk_surface":{"waive_routing_floor":repo,"surfaces":["auth","secrets"]}}}}),
            ),
            false,
        );
        let result = policy::resolve(&effective).unwrap();
        assert_eq!(
            (result.waived_categories, result.surfaces),
            (
                expected,
                policy::SurfaceAnswer::Answered {
                    categories: vec!["auth".into(), "secrets".into()]
                }
            )
        );
    }
}

#[test]
fn declared_commonjs_initializer_calls_are_not_import_only_evidence() {
    assert_eq!(
        scan_declared(
            "plain.js",
            Some("const value = require('module').parse(JSON.parse(input));"),
            &categories()
        )
        .unwrap(),
        DeclaredScan {
            matches: vec![DeclaredMatch {
                path: "plain.js".into(),
                category: "untrusted_input".into(),
                signal: "body line: a JSON.parse call".into()
            }],
            withheld: vec![]
        }
    );
}
