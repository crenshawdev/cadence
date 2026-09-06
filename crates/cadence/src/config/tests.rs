use super::merge::{deep_merge, get, merge, set};
use super::*;
use serde_json::json;

#[test]
fn merge_matrix_preserves_null_absence_arrays_and_provenance() {
    let base = json!({"a":{"x":1,"y":2},"b":[1,2],"c":true});
    assert_eq!(
        deep_merge(&base, &json!({"a":{"x":null},"b":[],"c":false})),
        json!({"a":{"x":null,"y":2},"b":[],"c":false})
    );
    assert_eq!(deep_merge(&base, &json!({"a":null}))["a"], Value::Null);
    let global = json!({"roles":{"cad-executor":{"model":"one","effort":"high"}},
        "model":{"effort":{"cad-executor":"max"}}, "git":{"protected_branches":["main","stable"]}});
    let repo = json!({"roles":{"cad-executor":{"model":null}},"git":{"protected_branches":[]}});
    let merged = merge(Some(global.clone()), Some(repo.clone()), false);
    assert_eq!(merged.raw_global, Some(global));
    assert_eq!(merged.raw_repo, Some(repo));
    assert_eq!(
        get(&merged.values, "roles.cad-executor.model"),
        Some(&Value::Null)
    );
    assert_eq!(
        get(&merged.values, "roles.cad-executor.effort"),
        Some(&json!("high"))
    );
    assert_eq!(
        get(&merged.values, "model.effort.cad-executor"),
        Some(&json!("max"))
    );
    assert_eq!(
        get(&merged.values, "git.protected_branches"),
        Some(&json!([]))
    );
    assert_eq!(merged.sources["roles.cad-executor.model"], Layer::Repo);
    assert_eq!(merged.sources["model.effort.cad-executor"], Layer::Global);
    assert!(get(&merged.repo, "workflow.verifier").is_none());
    assert_eq!(get(&merged.values, "workflow.verifier"), Some(&json!(true)));
}

#[test]
fn global_only_settings_cannot_be_suppressed_by_repo_null_or_ancestors() {
    let global = json!({"workflow":{"test_command":"trusted","lint_command":"lint"},"review":{"key_file":"keys"}});
    for ancestor in [Value::Null, json!(false), json!([]), json!("blocked")] {
        let result = merge(
            Some(global.clone()),
            Some(json!({"workflow":ancestor,"review":ancestor})),
            false,
        );
        for key in GLOBAL_ONLY {
            assert_eq!(get(&result.values, key), get(&global, key));
        }
        assert_eq!(result.diagnostics.scope.is_empty(), ancestor.is_null());
    }
    let repo = json!({"workflow":{"test_command":null,"lint_command":"unsafe"},"review":{"key_file":null}});
    let result = merge(Some(global.clone()), Some(repo.clone()), false);
    for key in GLOBAL_ONLY {
        assert_eq!(get(&result.values, key), get(&global, key));
    }
    assert_eq!(result.diagnostics.scope.len(), 1);
    let explicit = merge(None, Some(repo), true);
    assert_eq!(
        get(&explicit.values, "workflow.lint_command"),
        Some(&json!("unsafe"))
    );
    assert_eq!(explicit.sources["workflow.lint_command"], Layer::Repo);
    assert!(explicit.global_intent);
}

#[test]
fn all_frozen_keys_have_exactly_one_disposition_and_retirements_have_no_defaults() {
    let output = std::process::Command::new("git")
        .args(["show", "v3.7.12:cadence-core/config.schema.json"])
        .stdin(std::process::Stdio::null())
        .output()
        .unwrap();
    assert!(output.status.success());
    let frozen: Value = serde_json::from_slice(&output.stdout).unwrap();
    let keys: std::collections::BTreeSet<_> = frozen["keys"]
        .as_object()
        .unwrap()
        .keys()
        .map(String::as_str)
        .collect();
    assert_eq!(keys, DISPOSITIONS.iter().map(|(k, _)| *k).collect());
    assert_eq!(DISPOSITIONS.len(), 94);
    assert_eq!(schema().len(), 94);
    assert_eq!(DISPOSITIONS.iter().filter(|(_, dead)| *dead).count(), 14);
    let mut all = json!({});
    for (key, dead) in DISPOSITIONS {
        assert_eq!(schema()[*key]["disposition"] == "dead", *dead);
        set(
            &mut all,
            key,
            if *dead {
                json!(false)
            } else {
                frozen["keys"][*key]["default"].clone()
            },
        );
    }
    let result = merge(Some(all.clone()), Some(all), false);
    assert_eq!(result.diagnostics.migration.len(), 28);
    for (key, dead) in DISPOSITIONS {
        if *dead {
            assert!(get(&result.values, key).is_none(), "{key}");
            assert!(schema()[*key].get("default").is_none());
            for layer in [Layer::Global, Layer::Repo] {
                assert!(
                    result
                        .diagnostics
                        .migration
                        .iter()
                        .any(|d| d.key == *key && d.layer == layer)
                );
            }
        }
    }
    for key in RETIRED {
        assert!(DISPOSITIONS.contains(&(key, true)));
    }
    for key in [
        "review.triggers.risk_surface.surfaces",
        "review.triggers.risk_surface.waive_routing_floor",
    ] {
        assert_eq!(get(&result.repo, key), Some(&Value::Null));
    }
}

#[test]
fn invalid_scope_and_migration_diagnostics_are_independent() {
    let result = merge(
        Some(json!(false)),
        Some(
            json!({"workflow":{"test_command":"bad"},"git":{"auto_close":false},"unrecognized":{"x":1}}),
        ),
        false,
    );
    assert_eq!(result.diagnostics.invalid_layer.len(), 1);
    assert_eq!(result.diagnostics.scope.len(), 1);
    assert_eq!(result.diagnostics.migration.len(), 2);
    assert!(get(&result.values, "unrecognized").is_none());
    assert_eq!(result.raw_repo.unwrap()["unrecognized"], json!({"x":1}));
    let slug = merge(
        Some(json!({"git":{"forge_repo":"owner/repo"}})),
        None,
        false,
    );
    assert_eq!(slug.sources["git.forge_repo"], Layer::Global);
    assert_eq!(slug.diagnostics.scope[0].key, "git.forge_repo");
}

#[test]
fn capture_threshold_reports_active_identities_without_refusing_append() {
    use cadence::store::model::{Disposition, Evidence, ItemRecord, Origin, VERSION};
    let mut records = Vec::new();
    for id in 0..5 {
        records.push(ItemRecord {
            version: VERSION,
            id: id.to_string(),
            revision: 1,
            origin: Origin {
                source: "capture".into(),
                original: Evidence::Missing,
            },
            text: "same text\nwith continuation".into(),
            kind: "todo".into(),
            completed: false,
            disposition: Disposition::Captured,
            filing_uncertain: false,
        });
    }
    let mut revision = records[0].clone();
    revision.revision = 2;
    records.push(revision);
    records[1].completed = true;
    records[2].disposition = Disposition::Filed {
        pointer: "GH-1".into(),
    };
    records[3].disposition = Disposition::Declined {
        reason: "no".into(),
    };
    let report = capture_report(&records, 1);
    assert_eq!(
        report,
        CaptureReport {
            active: 2,
            bound: 1,
            exceeded: true,
            unit: "items"
        }
    );
    assert_eq!(records.len(), 6);
}

// Independent frozen census expectation: exactly 94 leaves, not object containers.
const DISPOSITIONS: &[(&str, bool)] = &[
    ("granularity", false),
    ("model.escalate_on_failure", false),
    ("model.overrides.cad-planner", false),
    ("model.overrides.cad-assumptions-analyzer", false),
    ("model.overrides.cad-verifier", false),
    ("model.overrides.cad-reviewer", false),
    ("model.overrides.cad-executor", false),
    ("model.overrides.cad-plan-checker", false),
    ("model.effort.cad-planner", false),
    ("model.effort.cad-assumptions-analyzer", false),
    ("model.effort.cad-verifier", false),
    ("model.effort.cad-reviewer", false),
    ("model.effort.cad-executor", false),
    ("model.effort.cad-plan-checker", false),
    ("roles.cad-planner.model", false),
    ("roles.cad-assumptions-analyzer.model", false),
    ("roles.cad-verifier.model", false),
    ("roles.cad-reviewer.model", false),
    ("roles.cad-executor.model", false),
    ("roles.cad-plan-checker.model", false),
    ("roles.cad-planner.effort", false),
    ("roles.cad-assumptions-analyzer.effort", false),
    ("roles.cad-verifier.effort", false),
    ("roles.cad-reviewer.effort", false),
    ("roles.cad-executor.effort", false),
    ("roles.cad-plan-checker.effort", false),
    ("workflow.research", false),
    ("workflow.plan_check", false),
    ("workflow.verifier", false),
    ("workflow.skip_discuss", false),
    ("workflow.inline_plan_threshold", false),
    ("workflow.max_plan_tasks", false),
    ("workflow.max_plan_bytes", false),
    ("workflow.max_dispatch_tokens.cad-planner", true),
    (
        "workflow.max_dispatch_tokens.cad-assumptions-analyzer",
        true,
    ),
    ("workflow.max_dispatch_tokens.cad-verifier", true),
    ("workflow.max_dispatch_tokens.cad-reviewer", true),
    ("workflow.max_dispatch_tokens.cad-executor", true),
    ("workflow.max_dispatch_tokens.cad-plan-checker", true),
    ("workflow.test_command", false),
    ("workflow.lint_command", false),
    ("parallelization.enabled", true),
    ("parallelization.max_concurrent_agents", true),
    ("parallelization.min_plans_for_parallel", true),
    ("parallelization.use_worktrees", true),
    ("git.protected_branches", false),
    ("git.on_protected", false),
    ("git.integration_branch", false),
    ("git.auto_branch", false),
    ("git.base_branch", false),
    ("git.create_tag", false),
    ("git.on_land_cleanup", false),
    ("git.issue_check", false),
    ("git.forge_provider", false),
    ("git.forge_repo", false),
    ("git.forge_host", false),
    ("git.auto_close", true),
    ("planning.commit_docs", false),
    ("planning.max_capture_bullets", false),
    ("memory.backend", false),
    ("review.mode", false),
    ("review.reviewers", false),
    ("review.key_file", false),
    ("review.request_timeout_ms", false),
    ("review.max_prompt_tokens", false),
    ("review.providers.openai.tiers.flagship", false),
    ("review.providers.openai.tiers.balanced", false),
    ("review.providers.openai.tiers.cheap", false),
    ("review.providers.gemini.tiers.flagship", false),
    ("review.providers.gemini.tiers.balanced", false),
    ("review.providers.gemini.tiers.cheap", false),
    ("review.providers.deepseek.tiers.flagship", false),
    ("review.providers.deepseek.tiers.balanced", false),
    ("review.providers.deepseek.tiers.cheap", false),
    ("review.triggers.plan.gate", false),
    ("review.triggers.plan.tier", false),
    ("review.triggers.plan.effort", false),
    ("review.triggers.diff.gate", false),
    ("review.triggers.diff.tier", false),
    ("review.triggers.diff.effort", false),
    ("review.triggers.risk_surface.gate", false),
    ("review.triggers.risk_surface.tier", false),
    ("review.triggers.risk_surface.effort", false),
    ("review.triggers.risk_surface.surfaces", false),
    ("review.triggers.risk_surface.waive_routing_floor", false),
    ("review.triggers.phase_diff.gate", true),
    ("review.triggers.phase_diff.tier", true),
    ("review.triggers.phase_diff.effort", true),
    ("review.consult.enabled", false),
    ("review.consult.tier", false),
    ("review.consult.effort", false),
    ("review.consult.attempt_threshold", false),
    ("review.decision_review.tier", false),
    ("review.decision_review.effort", false),
];
