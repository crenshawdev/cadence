use cadence::review::policy;

use serde_json::{Value, json};

fn action_input(name: &str) -> Value {
    let inputs: Value =
        serde_json::from_str(include_str!("fixtures/phase9/policy-actions.json")).unwrap();
    inputs[name].clone()
}

#[test]
fn action_advisory_pending_ac3() {
    let input = action_input("advisory-pending");
    let delivery = serde_json::from_value(input["delivery"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(policy::delivery_permission(&delivery)).unwrap(),
        json!("wait-for-delivery")
    );
}

#[test]
fn action_advisory_blocker_ac4() {
    let input = action_input("advisory-blocker");
    let delivery = serde_json::from_value(input["delivery"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(policy::delivery_permission(&delivery)).unwrap(),
        json!("continue")
    );
}

#[test]
fn action_off_ac12() {
    let input = action_input("off");
    let gate = serde_json::from_value(input["gate"].clone()).unwrap();
    let delivery = serde_json::from_value(input["delivery"].clone()).unwrap();
    let settlement = serde_json::from_value(input["settlement"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(policy::ordinary_gate_action(&gate, &delivery, &settlement)).unwrap(),
        json!("off")
    );
}

#[test]
fn action_advisory_ac13() {
    let input = action_input("advisory");
    let gate = serde_json::from_value(input["gate"].clone()).unwrap();
    let delivery = serde_json::from_value(input["delivery"].clone()).unwrap();
    let settlement = serde_json::from_value(input["settlement"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(policy::ordinary_gate_action(&gate, &delivery, &settlement)).unwrap(),
        json!("continue")
    );
}

#[test]
fn action_deferred_ac14() {
    let input = action_input("deferred");
    let gate = serde_json::from_value(input["gate"].clone()).unwrap();
    let delivery = serde_json::from_value(input["delivery"].clone()).unwrap();
    let settlement = serde_json::from_value(input["settlement"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(policy::ordinary_gate_action(&gate, &delivery, &settlement)).unwrap(),
        json!("enqueue-before-continuation")
    );
}

#[test]
fn action_blocking_ac15() {
    let input = action_input("blocking");
    let gate = serde_json::from_value(input["gate"].clone()).unwrap();
    let delivery = serde_json::from_value(input["delivery"].clone()).unwrap();
    let settlement = serde_json::from_value(input["settlement"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(policy::ordinary_gate_action(&gate, &delivery, &settlement)).unwrap(),
        json!("wait-for-settlement")
    );
}

#[test]
fn action_adjudicated_ac16() {
    let input = action_input("adjudicated");
    let gate = serde_json::from_value(input["gate"].clone()).unwrap();
    let delivery = serde_json::from_value(input["delivery"].clone()).unwrap();
    let settlement = serde_json::from_value(input["settlement"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(policy::ordinary_gate_action(&gate, &delivery, &settlement)).unwrap(),
        json!("wait-for-settlement")
    );
}

#[test]
fn action_match_ac20() {
    let input = action_input("match");
    let gate = serde_json::from_value(input["gate"].clone()).unwrap();
    let observation = serde_json::from_value(input["observation"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(policy::risk_review_action(&gate, &observation)).unwrap(),
        json!("dispatch")
    );
}

#[test]
fn action_nonmatch_ac21() {
    let input = action_input("nonmatch");
    let gate = serde_json::from_value(input["gate"].clone()).unwrap();
    let observation = serde_json::from_value(input["observation"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(policy::risk_review_action(&gate, &observation)).unwrap(),
        json!("no-review")
    );
}

#[test]
fn action_inconclusive_ac22() {
    let input = action_input("inconclusive");
    let gate = serde_json::from_value(input["gate"].clone()).unwrap();
    let observation = serde_json::from_value(input["observation"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(policy::risk_review_action(&gate, &observation)).unwrap(),
        json!("wait-for-evidence")
    );
}

#[test]
fn action_unanswered_ac23() {
    let input = action_input("unanswered");
    let gate = serde_json::from_value(input["gate"].clone()).unwrap();
    let observation = serde_json::from_value(input["observation"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(policy::risk_review_action(&gate, &observation)).unwrap(),
        json!("ask-surfaces")
    );
}
