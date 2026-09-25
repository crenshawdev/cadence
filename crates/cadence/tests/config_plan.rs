//! What a config batch writes, decided over values: the files config goes to,
//! which file a layer's batch replaces, the bytes it installs, and the checks
//! that refuse it. Nothing here reads a file or opens a store.

use cadence::{
    config::{
        Layer, merge,
        reload::{Generation, Input, Paths},
        write::{Plan, Update, plan, transaction, unavailable, versioned},
    },
    store::{Error, Observed},
};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};

const REPO: &str = "/project/.planning/config.v4.json";
const GLOBAL: &str = "/global/config.v4.json";

fn input(path: &str, layer: &Option<Value>) -> Input {
    Input {
        identity: path.into(),
        bytes: layer.as_ref().map(|value| serde_json::to_vec(value).unwrap()),
        stamp: None,
    }
}

/// A generation with the two layers in distinct files.
fn generation(global: Option<Value>, repo: Option<Value>) -> Generation {
    Generation {
        number: 1,
        global: Some(input(GLOBAL, &global)),
        repo: input(REPO, &repo),
        effective: merge::merge(global, repo, false),
    }
}

/// A generation whose global path is the repo file: one layer, global intent.
fn aliased(repo: Option<Value>) -> Generation {
    Generation {
        number: 1,
        global: None,
        repo: input(REPO, &repo),
        effective: merge::merge(None, repo, true),
    }
}

fn distinct() -> Paths {
    Paths { repo: REPO.into(), global: Some(GLOBAL.into()) }
}

fn shared() -> Paths {
    Paths { repo: REPO.into(), global: Some(REPO.into()) }
}

fn update(key: &str, value: Value) -> Update {
    Update { key: key.into(), value }
}

fn pretty(value: Value) -> Option<Vec<u8>> {
    Some(serde_json::to_vec_pretty(&value).unwrap())
}

#[test]
fn config_is_written_beside_each_resolved_legacy_file_as_config_v4_json() {
    let paths = versioned(Path::new("/project/.planning/config.json"), Some(Path::new("/home/u/.cadence/config.json")));
    assert_eq!(
        (paths.repo, paths.global),
        (PathBuf::from("/project/.planning/config.v4.json"), Some(PathBuf::from("/home/u/.cadence/config.v4.json")))
    );
}

#[test]
fn a_global_path_that_is_the_repo_file_shares_the_repo_destination() {
    let repo = Path::new("/project/.planning/config.json");
    assert_eq!(versioned(repo, Some(repo)).global, Some(PathBuf::from("/project/.planning/config.v4.json")));
}

#[test]
fn without_a_global_path_there_is_no_global_destination() {
    assert_eq!(versioned(Path::new("/project/.planning/config.json"), None).global, None);
}

#[test]
fn a_repo_batch_replaces_the_repo_file_and_reports_its_changed_keys_sorted() {
    let planned = plan(
        &generation(None, Some(json!({"roles":{"cad-executor":{"effort":"high"}}}))),
        &distinct(),
        Layer::Repo,
        &[update("roles.cad-executor.model", json!("sonnet")), update("roles.cad-executor.effort", json!("low"))],
    )
    .unwrap();
    assert_eq!(
        (planned.target, planned.destination.as_path(), planned.changed_keys.as_slice()),
        ("repo-config", Path::new(REPO), ["roles.cad-executor.effort".to_string(), "roles.cad-executor.model".to_string()].as_slice())
    );
}

#[test]
fn the_installed_layer_is_pretty_printed_and_keeps_unknown_keys_and_literal_nulls() {
    let planned = plan(
        &generation(None, Some(json!({"unknown":{"saved":7}}))),
        &distinct(),
        Layer::Repo,
        &[update("roles.cad-executor.model", Value::Null)],
    )
    .unwrap();
    assert_eq!(planned.bytes, pretty(json!({"unknown":{"saved":7},"roles":{"cad-executor":{"model":null}}})));
}

#[test]
fn a_global_batch_replaces_only_the_global_file_with_the_literal_model_text() {
    let before = json!({"roles":{"cad-planner":{"effort":"high"}}});
    let planned = plan(
        &generation(Some(before.clone()), Some(json!({"surfaces":["auth"]}))),
        &distinct(),
        Layer::Global,
        &[update("roles.cad-planner.model", json!("claude-opus-5-5"))],
    )
    .unwrap();
    assert_eq!(
        planned,
        Plan {
            target: "global-config",
            destination: GLOBAL.into(),
            prepared_against: Some(serde_json::to_vec(&before).unwrap()),
            changed_keys: vec!["roles.cad-planner.model".into()],
            bytes: pretty(json!({"roles":{"cad-planner":{"effort":"high","model":"claude-opus-5-5"}}})),
        }
    );
}

#[test]
fn with_the_global_path_aliased_a_global_only_key_is_written_to_the_repo_file() {
    let planned = plan(&aliased(None), &shared(), Layer::Global, &[update("workflow.test_command", json!("cargo test"))]).unwrap();
    assert_eq!((planned.target, planned.destination.as_path()), ("repo-config", Path::new(REPO)));
}

#[test]
fn a_repo_only_key_at_the_global_layer_is_refused_whether_or_not_the_path_is_aliased() {
    for (generation, paths) in [(generation(None, None), distinct()), (aliased(None), shared())] {
        assert_eq!(
            plan(&generation, &paths, Layer::Global, &[update("git.forge_repo", json!("owner/repo"))]),
            Err(Error::Invalid("wrong config layer for git.forge_repo".into()))
        );
    }
}

#[test]
fn a_global_batch_without_a_global_address_is_refused() {
    let paths = Paths { repo: REPO.into(), global: None };
    assert_eq!(
        plan(&generation(None, None), &paths, Layer::Global, &[update("roles.cad-planner.effort", json!("low"))]),
        Err(Error::Invalid("global config address unavailable".into()))
    );
}

#[test]
fn a_file_that_is_no_longer_the_one_the_session_bound_is_refused() {
    let mut rebound = generation(None, None);
    rebound.repo.identity = "/elsewhere/config.v4.json".into();
    assert_eq!(
        plan(&rebound, &distinct(), Layer::Repo, &[update("roles.cad-executor.effort", json!("low"))]),
        Err(Error::Conflict("active config identity changed; reopen session before writing config".into()))
    );
}

#[test]
fn an_invalid_update_anywhere_in_the_batch_refuses_the_plan() {
    assert_eq!(
        plan(
            &generation(None, None),
            &distinct(),
            Layer::Repo,
            &[update("roles.cad-executor.effort", json!("low")), update("stakes", json!("high"))]
        ),
        Err(Error::Invalid("unknown config key stakes".into()))
    );
}

#[test]
fn a_batch_of_stored_values_changes_no_key_and_plans_no_bytes() {
    let stored = json!({"review":{"triggers":{"risk_surface":{"waive_routing_floor":[]}}}});
    let planned = plan(
        &generation(None, Some(stored)),
        &distinct(),
        Layer::Repo,
        &[update("review.triggers.risk_surface.waive_routing_floor", json!([]))],
    )
    .unwrap();
    assert_eq!((planned.changed_keys.len(), planned.bytes), (0, None));
}

#[test]
fn a_plan_that_changes_nothing_has_no_change_to_install() {
    let stored = json!({"review":{"triggers":{"risk_surface":{"waive_routing_floor":[]}}}});
    let planned = plan(
        &generation(None, Some(stored)),
        &distinct(),
        Layer::Repo,
        &[update("review.triggers.risk_surface.waive_routing_floor", json!([]))],
    )
    .unwrap();
    assert_eq!(
        planned.change(observed(planned.prepared_against.as_deref())).map(|_| ()),
        Err(Error::Invalid("config plan changes nothing".into()))
    );
}

#[test]
fn a_plan_that_changes_nothing_is_only_a_read_of_the_store() {
    use cadence::config::write::request;
    use cadence::store::writer::Operation;
    assert!(matches!(request(None, None), Operation::Read));
}

#[test]
fn a_batch_reports_the_layer_it_was_asked_for() {
    use cadence::config::write::written;
    use cadence::store::{model::Snapshot, writer::View};
    let planned = repo_plan();
    let view = View { items: vec![], decisions: vec![], snapshot: Snapshot::new(0, b"", b"", json!({})).unwrap() };
    assert_eq!(written(view, planned, Layer::Global).requested_layer, Layer::Global);
}

#[test]
fn a_value_changed_and_then_changed_back_is_written_both_times() {
    let key = "roles.cad-executor.effort";
    for (stored, requested) in [("high", "low"), ("low", "high")] {
        let planned = plan(
            &generation(None, Some(json!({"roles":{"cad-executor":{"effort":stored}}}))),
            &distinct(),
            Layer::Repo,
            &[update(key, json!(requested))],
        )
        .unwrap();
        assert_eq!(planned.changed_keys, [key.to_string()], "{stored} to {requested}");
    }
}

#[test]
fn an_empty_waiver_replaces_the_stored_one_and_keeps_its_sibling_keys() {
    let planned = plan(
        &generation(None, Some(json!({"review":{"triggers":{"risk_surface":{"waive_routing_floor":["auth"]}}},"surfaces":["auth"]}))),
        &distinct(),
        Layer::Repo,
        &[update("review.triggers.risk_surface.waive_routing_floor", json!([]))],
    )
    .unwrap();
    assert_eq!(
        planned.bytes,
        pretty(json!({"review":{"triggers":{"risk_surface":{"waive_routing_floor":[]}}},"surfaces":["auth"]}))
    );
}

fn observed(bytes: Option<&[u8]>) -> Observed {
    Observed { bytes: bytes.map(<[u8]>::to_vec), identity: "file".into(), directory_identity: "config".into() }
}

fn repo_plan() -> Plan {
    plan(
        &generation(None, Some(json!({"a":1}))),
        &distinct(),
        Layer::Repo,
        &[update("roles.cad-executor.effort", json!("low"))],
    )
    .unwrap()
}

#[test]
fn the_change_replaces_the_file_as_observed_with_the_planned_bytes() {
    let planned = repo_plan();
    let now = observed(planned.prepared_against.as_deref());
    let change = planned.change(now.clone()).unwrap();
    assert_eq!((change.target.as_str(), change.expected, Some(change.bytes)), ("repo-config", now, planned.bytes));
}

#[test]
fn a_file_that_changed_since_the_plan_was_prepared_is_refused() {
    assert_eq!(
        repo_plan().change(observed(Some(b"{\"a\":2}"))).map(|_| ()),
        Err(Error::Conflict("config changed while preparing update".into()))
    );
}

#[test]
fn the_transaction_carries_only_the_change_under_an_identity_of_target_generation_and_bytes() {
    let planned = repo_plan();
    let change = || planned.change(observed(planned.prepared_against.as_deref())).unwrap();
    let written = transaction(change(), 7);
    assert!(written.id.starts_with("config:repo-config:7:"), "{}", written.id);
    assert_eq!((written.items.len(), written.decisions.len(), written.snapshot, written.external.len()), (0, 0, None, 1));
    assert_ne!(transaction(change(), 8).id, written.id);
    let mut other = change();
    other.bytes.push(b'\n');
    assert_ne!(transaction(other, 7).id, written.id);
}

#[test]
fn a_failed_config_read_refuses_the_write_as_a_policy_error() {
    assert_eq!(
        unavailable(Error::Io("permission denied".into())),
        Error::Policy("config unavailable: Io(\"permission denied\")".into())
    );
}

#[test]
fn a_first_global_batch_of_the_thirteen_defaults_changes_all_thirteen_in_the_global_file() {
    let mut updates = Vec::new();
    for (role, effort) in [
        ("cad-planner", "high"),
        ("cad-assumptions-analyzer", "high"),
        ("cad-verifier", "high"),
        ("cad-reviewer", "medium"),
        ("cad-executor", "high"),
        ("cad-plan-checker", "low"),
    ] {
        updates.push(update(&format!("roles.{role}.model"), Value::Null));
        updates.push(update(&format!("roles.{role}.effort"), json!(effort)));
    }
    updates.push(update("review.triggers.risk_surface.waive_routing_floor", json!([])));
    let planned = plan(&generation(None, None), &distinct(), Layer::Global, &updates).unwrap();
    assert_eq!(
        planned.changed_keys,
        [
            "review.triggers.risk_surface.waive_routing_floor",
            "roles.cad-assumptions-analyzer.effort",
            "roles.cad-assumptions-analyzer.model",
            "roles.cad-executor.effort",
            "roles.cad-executor.model",
            "roles.cad-plan-checker.effort",
            "roles.cad-plan-checker.model",
            "roles.cad-planner.effort",
            "roles.cad-planner.model",
            "roles.cad-reviewer.effort",
            "roles.cad-reviewer.model",
            "roles.cad-verifier.effort",
            "roles.cad-verifier.model",
        ]
    );
    assert_eq!((planned.target, planned.destination.as_path()), ("global-config", Path::new(GLOBAL)));
    assert_eq!(
        planned.bytes,
        pretty(json!({
            "roles": {
                "cad-planner": {"model": null, "effort": "high"},
                "cad-assumptions-analyzer": {"model": null, "effort": "high"},
                "cad-verifier": {"model": null, "effort": "high"},
                "cad-reviewer": {"model": null, "effort": "medium"},
                "cad-executor": {"model": null, "effort": "high"},
                "cad-plan-checker": {"model": null, "effort": "low"}
            },
            "review": {"triggers": {"risk_surface": {"waive_routing_floor": []}}}
        }))
    );
}
