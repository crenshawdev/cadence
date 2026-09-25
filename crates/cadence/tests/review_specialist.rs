use cadence::review::{model, specialist};

use serde_json::{Value, json};

fn input(name: &str) -> (model::Manifest, model::Routing) {
    let inputs: Value =
        serde_json::from_str(include_str!("fixtures/phase9/specialist-requests.json")).unwrap();
    (
        serde_json::from_value(inputs[name]["retained"].clone()).unwrap(),
        serde_json::from_value(inputs[name]["routing"].clone()).unwrap(),
    )
}

#[test]
fn minimalism_file_ac130() {
    let (retained, routing) = input("file");
    assert_eq!(
        serde_json::to_value(specialist::minimalism_request(&retained, &routing).unwrap()).unwrap(),
        json!({"specialist":"minimalism","target":"m1","reviewers":["base"],"ordinary_routing":null})
    );
}
#[test]
fn minimalism_directory_ac131() {
    let (retained, routing) = input("directory");
    assert_eq!(
        serde_json::to_value(specialist::minimalism_request(&retained, &routing).unwrap()).unwrap(),
        json!({"specialist":"minimalism","target":"m1","reviewers":["base"],"ordinary_routing":null})
    );
}
#[test]
fn minimalism_phase_range_ac132() {
    let (retained, routing) = input("phase-range");
    assert_eq!(
        serde_json::to_value(specialist::minimalism_request(&retained, &routing).unwrap()).unwrap(),
        json!({"specialist":"minimalism","target":"m1","reviewers":["base"],"ordinary_routing":null})
    );
}
