use super::*;

#[test]
fn home_request_uses_saved_task_identity() {
    let input: Value =
        serde_json::from_str(include_str!("../tests/fixtures/phase9/h1-admission.json")).unwrap();
    let home: Home = serde_json::from_value(input["H"]["home"].clone()).unwrap();
    assert_eq!(
        home_path(
            &HomeInput {
                kind: home.kind,
                id: home.id
            },
            input["H"]["fire"].as_str().unwrap()
        )
        .unwrap(),
        "tasks/h1"
    );
}
