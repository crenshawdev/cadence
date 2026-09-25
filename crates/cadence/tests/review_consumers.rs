use cadence::review::consumers;

use cadence::review::persistence;
use serde_json::{Value, json};
fn fixture(name: &str) -> Value {
    let input: Value =
        serde_json::from_str(include_str!("fixtures/phase9/h5-raw-views.json")).unwrap();
    input[name].clone()
}
/// The review records one snapshot holds.
fn records(input: &Value) -> Value {
    persistence::records(&json!({"review":input["records"]})).unwrap()
}
#[test]
fn raw_plan_ac53() {
    let input = fixture("plan");
    assert_eq!(
        serde_json::to_value(consumers::input_from_records(&records(&input), "a1").unwrap().identity)
            .unwrap(),
        json!({"kind":"raw","fire":"f1","round":1,"original":"o1","finding_ids":["o1:0"]})
    );
}
#[test]
fn raw_pending_ac64() {
    let input = fixture("pending");
    let delivery = serde_json::from_value(input["delivery"].clone()).unwrap();
    let findings = serde_json::from_value(input["findings"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(consumers::completion_review_state(delivery, findings)).unwrap(),
        json!({"state":"pending","findings":null})
    );
}
#[test]
fn raw_failed_ac65() {
    let input = fixture("failed");
    let delivery = serde_json::from_value(input["delivery"].clone()).unwrap();
    let findings = serde_json::from_value(input["findings"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(consumers::completion_review_state(delivery, findings)).unwrap(),
        json!({"state":"failed","findings":null})
    );
}
#[test]
fn raw_accepted_empty_ac66() {
    let input = fixture("accepted-empty");
    let delivery = serde_json::from_value(input["delivery"].clone()).unwrap();
    let findings = serde_json::from_value(input["findings"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(consumers::completion_review_state(delivery, findings)).unwrap(),
        json!({"state":"accepted","findings":[]})
    );
}
#[test]
fn raw_specialist_raw_ac136() {
    let input = fixture("specialist-raw");
    let output = consumers::specialist_from_records(&records(&input), "a1").unwrap();
    assert_eq!(
        json!({"kind":output.identity.kind,"original":output.identity.original}),
        json!({"kind":"raw","original":"o1"})
    );
}
#[test]
fn raw_specialist_empty_ac137() {
    let input = fixture("specialist-empty");
    let output = consumers::specialist_from_records(&records(&input), "a1").unwrap();
    assert_eq!(
        json!({"kind":output.identity.kind,"findings":output.findings}),
        json!({"kind":"raw","findings":[]})
    );
}
#[test]
fn raw_specialist_failed_ac138() {
    let input = fixture("specialist-failed");
    let output = consumers::specialist_from_records(&records(&input), "a1").unwrap();
    assert_eq!(
        json!({"kind":output.identity.kind,"findings":output.findings}),
        json!({"kind":"failed","findings":null})
    );
}
