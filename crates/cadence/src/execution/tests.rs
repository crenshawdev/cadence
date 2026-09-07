//! Core shard of the executable phase-6 acceptance inventory.
//!
//! Each test-binary shard checks the harness registry and then invokes every
//! mapped evidence function. A source-level test name is never counted as a
//! pass. Real-host invocation, a real model executor, actual host permission
//! denial and model-produced work remain PLAN-2 UAT obligations, not Cargo
//! claims.
use super::{
    patch::parse_executor_patch,
    plan::{PlanGraph, parse_plan},
};
use serde_json::json;
use std::{collections::BTreeSet, process::Command};

fn schema_fixture() -> serde_json::Value {
    json!({
        "schema": 1, "kind": "executor", "dispatch_id": "dispatch-1",
        "expected_execution_version": 1, "outcome": "blocked",
        "tasks": [
            {"status":"completed","task_id":"T1","commit":"abc",
             "verification":{"disposition":"passed","commands":[
                 {"command":"verify","exit_code":0,"output_digest":"digest"}]},
             "evidence":[{"kind":"commit","sha":"abc"},
                 {"kind":"file-line","path":"src/a.rs","line":1},
                 {"kind":"criterion","id":"AC1"}]},
            {"status":"blocked","task_id":"T2","blocker_id":"B1"},
            {"status":"not-run","task_id":"T3"}
        ],
        "deviations":[{"id":"D1","text":"judgment","evidence":[{"kind":"criterion","id":"AC1"}]}],
        "blockers":[{"id":"B1","text":"judgment","evidence":[{"kind":"file-line","path":"src/a.rs","line":2}]}]
    })
}

fn resolve_schema<'a>(
    root: &'a serde_json::Value,
    node: &'a serde_json::Value,
) -> &'a serde_json::Value {
    match node.get("$ref") {
        Some(reference) => resolve_schema(
            root,
            root.pointer(reference.as_str().unwrap().strip_prefix('#').unwrap())
                .unwrap(),
        ),
        None => node,
    }
}

// Evaluate only the structural keywords generated for this contract. Field
// inventories below also check each independently authored object in full.
fn schema_accepts(
    root: &serde_json::Value,
    node: &serde_json::Value,
    value: &serde_json::Value,
) -> bool {
    let node = resolve_schema(root, node);
    if let Some(variants) = node.get("oneOf") {
        return variants
            .as_array()
            .unwrap()
            .iter()
            .filter(|variant| schema_accepts(root, variant, value))
            .count()
            == 1;
    }
    if node.get("const").is_some_and(|expected| expected != value)
        || node
            .get("enum")
            .is_some_and(|values| !values.as_array().unwrap().contains(value))
    {
        return false;
    }
    match node.get("type").and_then(|value| value.as_str()) {
        Some("object") => value.as_object().is_some_and(|object| {
            let properties = node["properties"].as_object().unwrap();
            node["required"]
                .as_array()
                .unwrap()
                .iter()
                .all(|key| object.contains_key(key.as_str().unwrap()))
                && object.iter().all(|(key, value)| match properties.get(key) {
                    Some(property) => schema_accepts(root, property, value),
                    None => node["additionalProperties"] != false,
                })
        }),
        Some("array") => value.as_array().is_some_and(|values| {
            values
                .iter()
                .all(|value| schema_accepts(root, &node["items"], value))
        }),
        Some("string") => value.is_string(),
        Some("integer") => {
            (value.is_u64() || value.is_i64())
                && node
                    .get("minimum")
                    .is_none_or(|min| value.as_f64().unwrap() >= min.as_f64().unwrap())
                && node
                    .get("maximum")
                    .is_none_or(|max| value.as_f64().unwrap() <= max.as_f64().unwrap())
        }
        None => true,
        unexpected => panic!("unexpected schema type {unexpected:?}"),
    }
}

fn inspect_schema_objects(
    root: &serde_json::Value,
    node: &serde_json::Value,
    value: &serde_json::Value,
    path: &str,
    paths: &mut Vec<String>,
) {
    let mut node = resolve_schema(root, node);
    if let Some(variants) = node.get("oneOf") {
        node = variants
            .as_array()
            .unwrap()
            .iter()
            .find(|node| schema_accepts(root, node, value))
            .unwrap();
    }
    if let Some(object) = value.as_object() {
        assert_eq!(node["additionalProperties"], false, "{path}");
        let actual: BTreeSet<_> = object.keys().map(String::as_str).collect();
        let properties: BTreeSet<_> = node["properties"]
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect();
        let required: BTreeSet<_> = node["required"]
            .as_array()
            .unwrap()
            .iter()
            .map(|key| key.as_str().unwrap())
            .collect();
        assert_eq!(actual, properties, "{path}");
        assert_eq!(actual, required, "{path}");
        paths.push(path.to_owned());
        for (key, value) in object {
            inspect_schema_objects(
                root,
                &node["properties"][key],
                value,
                &format!("{path}/{key}"),
                paths,
            );
        }
    } else if let Some(array) = value.as_array() {
        for (index, value) in array.iter().enumerate() {
            inspect_schema_objects(
                root,
                &node["items"],
                value,
                &format!("{path}/{index}"),
                paths,
            );
        }
    }
}

#[test]
fn patch_schema_all_variants_and_nested_field_inventories_match_deserialization() {
    let schema = super::model::patch_schema();
    let fixture = schema_fixture();
    assert!(schema_accepts(&schema, &schema, &fixture));
    parse_executor_patch(fixture.clone()).unwrap();
    let mut paths = Vec::new();
    inspect_schema_objects(&schema, &schema, &fixture, "", &mut paths);
    assert_eq!(paths.len(), 13);
    for path in paths {
        let object = fixture.pointer(&path).unwrap().as_object().unwrap();
        for key in object.keys() {
            let mut missing = fixture.clone();
            missing
                .pointer_mut(&path)
                .unwrap()
                .as_object_mut()
                .unwrap()
                .remove(key);
            assert!(
                !schema_accepts(&schema, &schema, &missing),
                "missing {path}/{key}"
            );
            assert!(
                parse_executor_patch(missing).is_err(),
                "missing {path}/{key}"
            );
            let mut wrong = fixture.clone();
            wrong.pointer_mut(&path).unwrap()[key] = json!(false);
            assert!(
                !schema_accepts(&schema, &schema, &wrong),
                "type {path}/{key}"
            );
            assert!(parse_executor_patch(wrong).is_err(), "type {path}/{key}");
        }
        let mut extra = fixture.clone();
        extra.pointer_mut(&path).unwrap()["unexpected"] = json!(true);
        assert!(!schema_accepts(&schema, &schema, &extra), "extra {path}");
        assert!(parse_executor_patch(extra).is_err(), "extra {path}");
    }
}

#[test]
fn patch_schema_rejects_incorrect_union_tags_and_integer_types() {
    let schema = super::model::patch_schema();
    for path in [
        "/kind",
        "/outcome",
        "/tasks/0/status",
        "/tasks/1/status",
        "/tasks/2/status",
        "/tasks/0/verification/disposition",
        "/tasks/0/evidence/0/kind",
        "/tasks/0/evidence/1/kind",
        "/tasks/0/evidence/2/kind",
        "/deviations/0/evidence/0/kind",
        "/blockers/0/evidence/0/kind",
        "/schema",
        "/expected_execution_version",
        "/tasks/0/verification/commands/0/exit_code",
        "/tasks/0/evidence/1/line",
    ] {
        let mut fixture = schema_fixture();
        *fixture.pointer_mut(path).unwrap() = json!("invalid-tag-or-integer");
        assert!(!schema_accepts(&schema, &schema, &fixture), "{path}");
        assert!(parse_executor_patch(fixture).is_err(), "{path}");
    }
}

#[test]
fn patch_schema_keeps_structural_and_semantic_admission_separate() {
    let schema = super::model::patch_schema();
    let mut fixture = schema_fixture();
    fixture["schema"] = json!(2);
    fixture["tasks"][0]["verification"]["disposition"] = json!("failed");
    fixture["tasks"][0]["evidence"] = json!([]);
    assert!(schema_accepts(&schema, &schema, &fixture));
    let patch = parse_executor_patch(fixture).unwrap();
    assert_eq!(
        super::patch::apply_executor_patch(&json!({}), &patch)
            .unwrap_err()
            .code,
        "unsupported-patch-schema"
    );
}

#[test]
fn ac2_strict_plan_and_overlap_selection_are_executable_evidence() {
    let source = |plan, files: &str, body: &str| {
        format!(
            "---\nphase: 6\nplan: {plan}\nrequirements: [AC2]\nfiles: [{files}]\nexecution:\n  schema: 1\n  suite: cargo test\n  tasks:\n    - id: T{plan}\n      verify: [cargo test task{plan}]\n---\n{body}"
        )
    };
    let first = parse_plan(source(1, "src/a.rs", "opaque 日本語\n").as_bytes(), 6, 1).unwrap();
    let second = parse_plan(source(2, "src/a.rs", "second\n").as_bytes(), 6, 2).unwrap();
    let graph = PlanGraph::build(&[first.clone(), second]).unwrap();
    assert_eq!(first.body, "opaque 日本語\n");
    assert_eq!(graph.next_ready(&BTreeSet::new()), Some(1));
    assert_eq!(graph.next_ready(&BTreeSet::from([1])), Some(2));
}

#[test]
fn ac5_unknown_patch_keys_are_executable_evidence() {
    let value = json!({
        "schema": 1,
        "kind": "executor",
        "dispatch_id": "dispatch",
        "expected_execution_version": 1,
        "outcome": "complete",
        "tasks": [],
        "deviations": [],
        "blockers": [],
        "unknown": true,
    });
    assert_eq!(
        parse_executor_patch(value).unwrap_err().code,
        "invalid-patch"
    );
}

#[test]
fn phase_six_core_acceptance_inventory_runs_registered_evidence() {
    let rows: [(&str, &str, fn()); 2] = [
        (
            "AC2",
            "execution::tests::ac2_strict_plan_and_overlap_selection_are_executable_evidence",
            ac2_strict_plan_and_overlap_selection_are_executable_evidence,
        ),
        (
            "AC5",
            "execution::tests::ac5_unknown_patch_keys_are_executable_evidence",
            ac5_unknown_patch_keys_are_executable_evidence,
        ),
    ];
    let listing = Command::new(std::env::current_exe().unwrap())
        .arg("--list")
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
