#[allow(dead_code)]
#[path = "../src/review/contract.rs"]
mod contract;
#[allow(dead_code)]
#[path = "../src/review/model.rs"]
mod model;
#[allow(dead_code)]
#[path = "../src/review/selection.rs"]
mod selection;

use serde_json::{Value, json};

fn first_input(name: &str) -> Value {
    let inputs: Value =
        serde_json::from_str(include_str!("fixtures/phase9/selection-first.json")).unwrap();
    inputs[name].clone()
}

#[test]
fn first_failed_a_ac24() {
    let input = first_input("failed-a");
    let selection = serde_json::from_value(input["selection"].clone()).unwrap();
    let attempts = serde_json::from_value(input["attempts"].clone()).unwrap();
    let result = selection::select_next(&selection, &attempts);
    assert_eq!(json!({"request":result.request}), json!({"request":"B"}));
}

#[test]
fn first_usable_b_ac25() {
    let input = first_input("usable-b");
    let selection = serde_json::from_value(input["selection"].clone()).unwrap();
    let attempts = serde_json::from_value(input["attempts"].clone()).unwrap();
    let result = selection::select_next(&selection, &attempts);
    assert_eq!(
        json!({"request":result.request,"not_selected":result.not_selected}),
        json!({"request":null,"not_selected":["C"]})
    );
}

#[test]
fn first_empty_a_ac26() {
    let input = first_input("empty-a");
    let selection = serde_json::from_value(input["selection"].clone()).unwrap();
    let attempts = serde_json::from_value(input["attempts"].clone()).unwrap();
    let result = selection::select_next(&selection, &attempts);
    assert_eq!(
        json!({"request":result.request,"not_selected":result.not_selected}),
        json!({"request":null,"not_selected":["B","C"]})
    );
}

#[test]
fn first_exhausted_ac29() {
    let input = first_input("exhausted");
    let selection = serde_json::from_value(input["selection"].clone()).unwrap();
    let attempts = serde_json::from_value(input["attempts"].clone()).unwrap();
    let result = selection::select_next(&selection, &attempts);
    assert_eq!(
        json!({"request":result.request}),
        json!({"request":"local"})
    );
}

#[test]
fn first_local_empty_ac30() {
    let input = first_input("local-empty");
    let selection = serde_json::from_value(input["selection"].clone()).unwrap();
    let attempts = serde_json::from_value(input["attempts"].clone()).unwrap();
    let result = selection::select_next(&selection, &attempts);
    assert_eq!(
        json!({"state":result.state,"request":result.request}),
        json!({"state":"usable-complete","request":null})
    );
}

#[test]
fn first_local_failed_ac31() {
    let input = first_input("local-failed");
    let selection = serde_json::from_value(input["selection"].clone()).unwrap();
    let attempts = serde_json::from_value(input["attempts"].clone()).unwrap();
    let result = selection::select_next(&selection, &attempts);
    assert_eq!(
        json!({"state":result.state,"request":result.request}),
        json!({"state":"complete-with-failure","request":null})
    );
}

#[test]
fn first_pending_a_wait() {
    let input = first_input("pending-a");
    let selection = serde_json::from_value(input["selection"].clone()).unwrap();
    let attempts = serde_json::from_value(input["attempts"].clone()).unwrap();
    let result = selection::select_next(&selection, &attempts);
    assert_eq!(
        json!({"state":result.state,"request":result.request}),
        json!({"state":"incomplete","request":null})
    );
}

#[test]
fn first_interrupted_a_wait() {
    let input = first_input("interrupted-a");
    let selection = serde_json::from_value(input["selection"].clone()).unwrap();
    let attempts = serde_json::from_value(input["attempts"].clone()).unwrap();
    let result = selection::select_next(&selection, &attempts);
    assert_eq!(
        json!({"state":result.state,"request":result.request}),
        json!({"state":"incomplete","request":null})
    );
}

#[test]
fn first_missing_a_advance() {
    let input = first_input("missing-a");
    let selection = serde_json::from_value(input["selection"].clone()).unwrap();
    let attempts = serde_json::from_value(input["attempts"].clone()).unwrap();
    let result = selection::select_next(&selection, &attempts);
    assert_eq!(json!({"request":result.request}), json!({"request":"B"}));
}

#[test]
fn first_malformed_a_advance() {
    let input = first_input("malformed-a");
    let selection = serde_json::from_value(input["selection"].clone()).unwrap();
    let attempts = serde_json::from_value(input["attempts"].clone()).unwrap();
    let result = selection::select_next(&selection, &attempts);
    assert_eq!(json!({"request":result.request}), json!({"request":"B"}));
}

#[test]
fn first_usage_spent_ac32() {
    let input = serde_json::from_value(first_input("spent")).unwrap();
    let result = selection::attempt_usage(&input);
    assert_eq!(
        json!({"input":result.input,"output":result.output}),
        json!({"input":7,"output":3})
    );
}

#[test]
fn first_usage_unobserved_ac33() {
    let input = serde_json::from_value(first_input("unobserved")).unwrap();
    let result = selection::attempt_usage(&input);
    assert_eq!(
        json!({"input":result.input,"output":result.output}),
        json!({"input":null,"output":null})
    );
}

#[test]
fn first_usage_spent_cost() {
    let input = serde_json::from_value(first_input("spent")).unwrap();
    let result = selection::attempt_usage(&input);
    assert_eq!(
        json!({"cost":result.cost,"currency":result.currency}),
        json!({"cost":"0.02","currency":"USD"})
    );
}
