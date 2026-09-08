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
