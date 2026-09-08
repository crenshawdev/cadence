#[allow(dead_code)]
#[path = "../src/review/model.rs"]
mod model;

use model::RequestedVoice;
use serde_json::{Value, json};

fn voice(name: &str) -> RequestedVoice {
    let input: Value =
        serde_json::from_str(include_str!("fixtures/phase9/requested-voice.json")).unwrap();
    serde_json::from_value(input[name].clone()).unwrap()
}

#[test]
fn model_present_round_trips_pin() {
    assert_eq!(
        serde_json::to_value(voice("pinned")).unwrap(),
        json!({"agent":"cad-reviewer","model":"sonnet","effort":null,"routing":null,"selection_evidence":"route1"})
    );
}

#[test]
fn model_absent_round_trips_inheritance() {
    assert_eq!(
        serde_json::to_value(voice("inherited")).unwrap(),
        json!({"agent":"cad-reviewer","model":null,"effort":null,"routing":null,"selection_evidence":"route1"})
    );
}
