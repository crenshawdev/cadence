use cadence::review::binding;

use serde_json::{Value, json};
fn fixture() -> Value {
    serde_json::from_str(include_str!("fixtures/phase9/h3-bindings.json")).unwrap()
}
#[test]
fn binding_artifact_ac39() {
    let input = fixture();
    let admission = serde_json::from_value(input["H"].clone()).unwrap();
    let attempt = serde_json::from_value(input["attempts"]["a1"].clone()).unwrap();
    let submitted = serde_json::from_value(input["artifact-mismatch"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(binding::bind_return(&admission, &attempt, &submitted).unwrap_err())
            .unwrap(),
        json!({"code":"artifact-mismatch","fire":"f1","field":"artifact"})
    );
}
#[test]
fn binding_round_ac40() {
    let input = fixture();
    let admission = serde_json::from_value(input["H"].clone()).unwrap();
    let attempt = serde_json::from_value(input["attempts"]["a1"].clone()).unwrap();
    let submitted = serde_json::from_value(input["round-mismatch"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(binding::bind_return(&admission, &attempt, &submitted).unwrap_err())
            .unwrap(),
        json!({"code":"round-mismatch","fire":"f1","field":"round"})
    );
}
#[test]
fn binding_host_return_ac79() {
    let input = fixture()["bound"].clone();
    let bindings = serde_json::from_value(input["host_returns"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(
            binding::bind_host_return(
                &bindings,
                input["return"].as_str().unwrap(),
                input["submitted_attempt"].as_str().unwrap()
            )
            .unwrap_err()
        )
        .unwrap(),
        json!({"code":"host-return-conflict","return":"return1","bound_attempt":"a1","submitted_attempt":"a2"})
    );
}
