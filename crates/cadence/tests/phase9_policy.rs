#[allow(dead_code)]
#[path = "../src/review/model.rs"]
mod model;
#[allow(dead_code)]
#[path = "../src/review/policy.rs"]
mod policy;

use serde_json::{Value, json};

fn request_input(name: &str) -> policy::ResolvedOrdinary {
    let inputs: Value =
        serde_json::from_str(include_str!("fixtures/phase9/policy-requests.json")).unwrap();
    serde_json::from_value(inputs[name].clone()).unwrap()
}

#[test]
fn request_manual_plan_ac6() {
    let input = request_input("manual-plan");
    let result = policy::manual_plan_request(input);
    assert_eq!(
        json!({"caller":result.caller,"gate":result.policy.gate,"routing":result.policy.routing.answer,"home":result.policy.home.id}),
        json!({"caller":"manual-plan","gate":"deferred","routing":"local","home":"h1"})
    );
}

#[test]
fn request_automatic_plan_ac7() {
    let input = request_input("automatic-plan");
    let result = policy::automatic_plan_request(input);
    assert_eq!(
        json!({"caller":result.caller,"gate":result.policy.gate,"routing":result.policy.routing.answer,"home":result.policy.home.id}),
        json!({"caller":"automatic-plan","gate":"deferred","routing":"local","home":"h1"})
    );
}

#[test]
fn request_task_ac8() {
    let input = request_input("task");
    let result = policy::task_review_request(input);
    assert_eq!(
        json!({"caller":result.caller,"gate":result.policy.gate,"routing":result.policy.routing.answer,"home":result.policy.home.id}),
        json!({"caller":"task","gate":"deferred","routing":"local","home":"h1"})
    );
}

#[test]
fn request_execute_ac9() {
    let input = request_input("execute");
    let result = policy::execute_review_request(input);
    assert_eq!(
        json!({"caller":result.caller,"gate":result.policy.gate,"routing":result.policy.routing.answer,"home":result.policy.home.id}),
        json!({"caller":"execute","gate":"deferred","routing":"local","home":"h1"})
    );
}

#[test]
fn request_debug_ac10() {
    let input = request_input("debug");
    let result = policy::debug_review_request(input);
    assert_eq!(
        json!({"caller":result.caller,"gate":result.policy.gate,"routing":result.policy.routing.answer,"home":result.policy.home.id}),
        json!({"caller":"debug","gate":"deferred","routing":"local","home":"h1"})
    );
}

#[test]
fn request_verify_ac11() {
    let input = request_input("verify");
    let result = policy::verify_review_request(input);
    assert_eq!(
        json!({"caller":result.caller,"gate":result.policy.gate,"routing":result.policy.routing.answer,"home":result.policy.home.id}),
        json!({"caller":"verify","gate":"deferred","routing":"local","home":"h1"})
    );
}

#[test]
fn request_plan_advisory_ac17() {
    let input = request_input("plan-advisory");
    assert_eq!(
        serde_json::to_value(policy::ordinary_request("task", input).policy.gate).unwrap(),
        json!("advisory")
    );
}

#[test]
fn request_risk_blocking_ac18() {
    let input = request_input("risk-blocking");
    assert_eq!(
        serde_json::to_value(policy::ordinary_request("task", input).policy.gate).unwrap(),
        json!("blocking")
    );
}

#[test]
fn request_diff_off_ac19() {
    let input = request_input("diff-off");
    assert_eq!(
        serde_json::to_value(policy::ordinary_request("task", input).policy.gate).unwrap(),
        json!("off")
    );
}

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

#[test]
fn action_unsettled_ac128() {
    let input = action_input("unsettled");
    let settlement: Option<model::Settlement> =
        serde_json::from_value(input["settlement"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(policy::settlement_state(settlement.as_ref())).unwrap(),
        json!("pending")
    );
}
