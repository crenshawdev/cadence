#[allow(dead_code)]
#[path = "../src/review/inventory.rs"]
mod inventory;
#[allow(dead_code)]
#[path = "../src/review/model.rs"]
mod model;
use serde_json::{Value, json};
fn fixture(name: &str) -> Vec<inventory::InventoryEntry> {
    let input: Value =
        serde_json::from_str(include_str!("fixtures/phase9/h5-inventories.json")).unwrap();
    serde_json::from_value(input[name].clone()).unwrap()
}
#[test]
fn inventory_landing_ac62() {
    let input = fixture("landing");
    assert_eq!(
        serde_json::to_value(inventory::landing_inventory(&input)).unwrap(),
        json!({"unruled":["f1/1"],"adjudicated":["f2/2"]})
    );
}
#[test]
fn inventory_milestone_ac63() {
    let input = fixture("milestone");
    assert_eq!(
        inventory::milestone_review_inputs(&input),
        [
            "REVIEW-risk_surface-1.md",
            "ADJUDICATION-risk_surface-1.md",
            "REVIEW-risk_surface-2.md",
            "ADJUDICATION-risk_surface-2.md"
        ]
    );
}
#[test]
fn inventory_advisory_ac67() {
    let input = fixture("advisory");
    assert_eq!(
        serde_json::to_value(inventory::deferred_members(&input)).unwrap(),
        json!([])
    );
}
