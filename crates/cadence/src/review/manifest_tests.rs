use crate::review::{manifest, model};

use serde_json::{Value, json};
use std::collections::BTreeMap;

fn input(name: &str) -> (model::Manifest, BTreeMap<String, Vec<u8>>) {
    let fixture: Value =
        serde_json::from_str(include_str!("../../tests/fixtures/phase9/material-sides.json")).unwrap();
    let case = &fixture["cases"][name];
    let entries = case["entries"]
        .as_array()
        .unwrap()
        .iter()
        .map(|key| {
            serde_json::from_value(fixture["entries"][key.as_str().unwrap()].clone()).unwrap()
        })
        .collect();
    let contents = case["contents"]
        .as_object()
        .map(|values| {
            values
                .iter()
                .map(|(key, bytes)| (key.clone(), bytes.as_str().unwrap().as_bytes().to_vec()))
                .collect()
        })
        .unwrap_or_default();
    (
        model::Manifest {
            manifest: "m1".into(),
            fire: "f1".into(),
            contract: model::Contract::current(),
            target: model::Target::CommittedRange {
                base: "b1".into(),
                head: "h1".into(),
            },
            entries,
        },
        contents,
    )
}

#[test]
fn source_deleted_reference_ac71() {
    let (saved, _) = input("deleted_reference");
    assert_eq!(
        serde_json::to_value(manifest::source_reference(
            &saved,
            "d1",
            4,
            &model::Side::Base
        ))
        .unwrap(),
        json!({"entry":"e1","path":"old.rs","side":"base","line":2})
    );
}
#[test]
fn source_renamed_reference_ac72() {
    let (saved, _) = input("renamed_reference");
    assert_eq!(
        serde_json::to_value(manifest::source_reference(
            &saved,
            "d1",
            5,
            &model::Side::Head
        ))
        .unwrap(),
        json!({"entry":"e2","path":"new.rs","side":"head","line":3})
    );
}
#[test]
fn source_absent_head_ac73() {
    let (saved, _) = input("absent_side");
    assert_eq!(
        serde_json::to_value(manifest::material_side(&saved, "old.rs", model::Side::Head)).unwrap(),
        json!({"path":"old.rs","side":"head","availability":"absent"})
    );
}
#[test]
fn source_missing_material_ac77() {
    let (saved, _) = input("missing_source");
    assert_eq!(
        serde_json::to_value(manifest::validate_manifest(&saved).unwrap_err()).unwrap(),
        json!({"code":"missing-source-material","entry":"e1","side":"base"})
    );
}
#[test]
fn source_unavailable_object_is_not_retention() {
    let (saved, _) = input("unavailable_source");
    assert_eq!(
        serde_json::to_value(manifest::validate_manifest(&saved).unwrap_err()).unwrap(),
        json!({"code":"missing-source-material","entry":"e1","side":"base"})
    );
}
#[test]
fn source_record_rename_maps_to_entry_sides() {
    let (mut saved, bytes) = input("record_rename");
    manifest::record_mappings(&mut saved, &bytes).unwrap();
    assert_eq!(
        serde_json::to_value(&saved.entries[2].hunks).unwrap(),
        json!([
            {"diff_line":7,"source":{"entry":"e1","path":"old.rs","side":"base","line":2}},
            {"diff_line":8,"source":{"entry":"e2","path":"new.rs","side":"head","line":3}}
        ])
    );
}
#[test]
fn source_record_deletion_preserves_old_path() {
    let (mut saved, bytes) = input("record_delete");
    manifest::record_mappings(&mut saved, &bytes).unwrap();
    assert_eq!(
        (&saved.entries[0].old_path, &saved.entries[0].new_path),
        (&Some("old.rs".into()), &None)
    );
}
