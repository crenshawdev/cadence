#[allow(dead_code)]
#[path = "../src/review/model.rs"]
mod model;
#[allow(dead_code)]
#[path = "../src/review/views.rs"]
mod views;
use serde_json::{Value, json};
fn fixture(name: &str) -> Value {
    let input: Value =
        serde_json::from_str(include_str!("fixtures/phase9/h5-selected-views.json")).unwrap();
    input[name].clone()
}
#[test]
fn view_execute_ac57() {
    let input = fixture("execute");
    let supplied = serde_json::from_value(input["view"].clone()).unwrap();
    let output = views::execute_fix_input(&supplied).unwrap();
    assert_eq!(
        json!({"kind":output.kind,"revision":output.revision,"finding_ids":output.finding_ids.iter().map(|id|format!("{}:{}",id.original,id.index)).collect::<Vec<_>>(),"fix":output.fix}),
        json!({"kind":"provisional-selected","revision":2,"finding_ids":["o1:0"],"fix":null})
    );
}
#[test]
fn view_planned_task_ac58() {
    let input = fixture("planned-task");
    let supplied = serde_json::from_value(input["view"].clone()).unwrap();
    let output = views::planned_task_fix_input(&supplied).unwrap();
    assert_eq!(
        json!({"kind":output.kind,"revision":output.revision,"finding_ids":output.finding_ids.iter().map(|id|format!("{}:{}",id.original,id.index)).collect::<Vec<_>>(),"fix":output.fix}),
        json!({"kind":"provisional-selected","revision":2,"finding_ids":["o1:0"],"fix":null})
    );
}
#[test]
fn view_raw_ac59() {
    let input = serde_json::from_value(fixture("raw")).unwrap();
    assert_eq!(
        serde_json::to_value(views::consumer_view(&input).kind).unwrap(),
        json!("raw")
    );
}
#[test]
fn view_provisional_selected_ac60() {
    let input = serde_json::from_value(fixture("provisional-selected")).unwrap();
    assert_eq!(
        serde_json::to_value(views::consumer_view(&input).kind).unwrap(),
        json!("provisional-selected")
    );
}
#[test]
fn view_settled_ac61() {
    let input = serde_json::from_value(fixture("settled")).unwrap();
    assert_eq!(
        serde_json::to_value(views::consumer_view(&input).kind).unwrap(),
        json!("settled")
    );
}
