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
