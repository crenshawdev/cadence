use super::*;

#[test]
fn modern_pause_ordinary_delivery_fields() {
    let identities: serde_json::Value =
        serde_json::from_str(include_str!("../tests/fixtures/phase9/h1-admission.json")).unwrap();
    let originals: serde_json::Value =
        serde_json::from_str(include_str!("../tests/fixtures/phase9/h4-originals.json")).unwrap();
    let delivery = risk::ModernDelivery {
        fire: identities["H"]["fire"].as_str().unwrap().into(),
        attempt: identities["a1"]["attempt"].as_str().unwrap().into(),
        findings: vec![
            serde_json::from_value(originals["F"]["parsed"]["findings"][0].clone()).unwrap(),
        ],
    };
    assert_eq!(
        serde_json::to_value(pause_delivery_request(&delivery)).unwrap(),
        serde_json::json!({"fire":"f1","attempt":"a1","fields":["file","line","severity","claim","failure_scenario"]})
    );
}
