#[allow(dead_code)]
#[path = "../src/review/invoking.rs"]
mod invoking;
#[allow(dead_code)]
#[path = "../src/review/model.rs"]
mod model;

#[test]
fn advisory_retained_read_only_contract() {
    let input: serde_json::Value =
        serde_json::from_str(include_str!("fixtures/phase9/h1-admission.json")).unwrap();
    let policies: serde_json::Value =
        serde_json::from_str(include_str!("fixtures/phase9/policy-actions.json")).unwrap();
    let gate: model::Gate = serde_json::from_value(policies["advisory"]["gate"].clone()).unwrap();
    assert_eq!(
        invoking::advisory_contract(input["H"]["artifact"].as_str().unwrap(), &gate),
        "Review retained target m1. Return raw JSON findings. Do not write files or append lifecycle records."
    );
}
