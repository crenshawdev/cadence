use cadence::review::selection;

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

fn panel_input(name: &str) -> Value {
    let inputs: Value =
        serde_json::from_str(include_str!("fixtures/phase9/selection-panel.json")).unwrap();
    inputs[name].clone()
}

#[test]
fn panel_roster_panel_ac118() {
    let input = serde_json::from_value(panel_input("panel")).unwrap();
    assert_eq!(
        selection::dispatch_roster(&input).required_requests,
        ["A", "B"]
    );
}

#[test]
fn panel_roster_adjudicated_ac119() {
    let input = serde_json::from_value(panel_input("adjudicated")).unwrap();
    assert_eq!(
        selection::dispatch_roster(&input).required_requests,
        ["A", "B"]
    );
}

#[test]
fn panel_pending_ac120() {
    let input = panel_input("pending");
    let roster = serde_json::from_value(input["roster"].clone()).unwrap();
    let slots = serde_json::from_value(input["slots"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(selection::delivery_completion(&roster, &slots)).unwrap(),
        json!("incomplete")
    );
}

#[test]
fn panel_interrupted_ac121() {
    let input = panel_input("interrupted");
    let roster = serde_json::from_value(input["roster"].clone()).unwrap();
    let slots = serde_json::from_value(input["slots"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(selection::delivery_completion(&roster, &slots)).unwrap(),
        json!("incomplete")
    );
}

#[test]
fn panel_success_ac122() {
    let input = panel_input("success");
    let roster = serde_json::from_value(input["roster"].clone()).unwrap();
    let slots = serde_json::from_value(input["slots"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(selection::delivery_completion(&roster, &slots)).unwrap(),
        json!("usable-complete")
    );
}

#[test]
fn panel_failed_no_fallback_ac123() {
    let input = panel_input("failed-no-fallback");
    let roster = serde_json::from_value(input["roster"].clone()).unwrap();
    let slots = serde_json::from_value(input["slots"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(selection::delivery_completion(&roster, &slots)).unwrap(),
        json!("complete-with-failure")
    );
}

#[test]
fn panel_failed_fallback_success_ac124() {
    let input = panel_input("failed-fallback-success");
    let roster = serde_json::from_value(input["roster"].clone()).unwrap();
    let slots = serde_json::from_value(input["slots"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(selection::delivery_completion(&roster, &slots)).unwrap(),
        json!("usable-complete")
    );
}

#[test]
fn panel_failed_fallback_failed_ac125() {
    let input = panel_input("failed-fallback-failed");
    let roster = serde_json::from_value(input["roster"].clone()).unwrap();
    let slots = serde_json::from_value(input["slots"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(selection::delivery_completion(&roster, &slots)).unwrap(),
        json!("complete-with-failure")
    );
}

#[test]
fn panel_missing_b_missing_slot() {
    let input = panel_input("missing-b");
    let roster = serde_json::from_value(input["roster"].clone()).unwrap();
    let slots = serde_json::from_value(input["slots"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(selection::delivery_completion(&roster, &slots)).unwrap(),
        json!("incomplete")
    );
}

#[test]
fn panel_fallback_pending_fallback_wait() {
    let input = panel_input("fallback-pending");
    let roster = serde_json::from_value(input["roster"].clone()).unwrap();
    let slots = serde_json::from_value(input["slots"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(selection::delivery_completion(&roster, &slots)).unwrap(),
        json!("incomplete")
    );
}

#[test]
fn panel_roster_preserves_per_slot_fallbacks() {
    let input = serde_json::from_value(panel_input("panel")).unwrap();
    assert_eq!(
        serde_json::to_value(selection::dispatch_roster(&input).fallbacks).unwrap(),
        json!({"A":null,"B":"local"})
    );
}
