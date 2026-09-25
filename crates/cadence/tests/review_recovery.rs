use cadence::review::{io, originals, persistence, recovery};

use serde_json::{Value, json};
struct FixedClock;
impl io::Clock for FixedClock {
    fn now(&mut self) -> u64 {
        100
    }
}
fn roster_fixture() -> Value {
    serde_json::from_str(include_str!("fixtures/phase9/h3-rosters.json")).unwrap()
}
fn original_fixture() -> Value {
    serde_json::from_str(include_str!("fixtures/phase9/h4-originals.json")).unwrap()
}
/// The review records one snapshot holds.
fn records(review: Value) -> Value {
    persistence::records(&json!({"review":review})).unwrap()
}
fn interrupted(review: Value) -> Value {
    match recovery::decide_recovery(records(review), "a1", &mut FixedClock).unwrap() {
        recovery::Recovery::Interrupt { recovered, .. } => serde_json::to_value(recovered).unwrap(),
        recovery::Recovery::Settled(recovered) => panic!("an in-flight attempt was left as {recovered:?}"),
    }
}
#[test]
fn recover_pending_admission_ac43() {
    let input = roster_fixture()["pending-admission"].clone();
    assert_eq!(
        interrupted(json!({"schema":"review-1","attempts":{"a1":input}})),
        json!({"attempt":"a1","delivery":"interrupted","original":null})
    );
}
#[test]
fn recover_host_return_ac44() {
    let input = roster_fixture()["host-return-before-submission"].clone();
    assert_eq!(
        interrupted(json!({"schema":"review-1","attempts":{"a1":input}})),
        json!({"attempt":"a1","delivery":"interrupted","original":null})
    );
}
#[test]
fn recover_original_identity_ac108() {
    let input = original_fixture()["Q"].clone();
    let review = records(json!({"schema":"review-1","originals":{"o1":input}}));
    assert_eq!(
        serde_json::to_value(originals::original_read(&review, "o1").unwrap().identity).unwrap(),
        json!({"original":"o1","contract":"H4-1","finding_ids":["o1:0","o1:1"]})
    );
}
#[test]
fn recover_roster_pending_b_ac126() {
    let input = roster_fixture();
    let original = original_fixture()["empty"].clone();
    let review = records(
        json!({"schema":"review-1","admissions":{"f1":input["H"]},"attempts":{"a1":input["accepted-A"],"a2":input["pending-B"]},"originals":{"o1":original}}),
    );
    assert_eq!(
        serde_json::to_value(recovery::roster(&review, "f1").unwrap()).unwrap(),
        json!({"required":["A","B"],"pending":["B"]})
    );
}
#[test]
fn recover_voice_original_ids_ac127() {
    let input = roster_fixture();
    let originals = original_fixture();
    let review = records(
        json!({"schema":"review-1","admissions":{"f1":input["H"]},"attempts":{"a1":input["accepted-A"],"a2":input["accepted-B"]},"originals":{"o1":originals["empty"],"o2":originals["B-F"]}}),
    );
    assert_eq!(
        serde_json::to_value(originals::voice_originals(&review, "f1").unwrap().originals).unwrap(),
        json!({"A":"o1","B":"o2"})
    );
}
#[test]
fn recover_voice_findings_ac129() {
    let input = roster_fixture();
    let originals = original_fixture();
    let review = records(
        json!({"schema":"review-1","admissions":{"f1":input["H"]},"attempts":{"a1":input["accepted-A"],"a2":input["accepted-B"]},"originals":{"o1":originals["F"],"o2":originals["B-empty"]}}),
    );
    assert_eq!(
        serde_json::to_value(originals::voice_originals(&review, "f1").unwrap().findings).unwrap(),
        json!({"A":[{"file":"a.rs","line":1,"severity":"high","claim":"C","failure_scenario":"S"}],"B":[]})
    );
}
#[test]
fn recover_unknown_original_contract_is_unverified() {
    let mut input = original_fixture()["empty"].clone();
    input["contract"]["validator"] = json!("historical-unknown");
    let review = records(json!({"schema":"review-1","originals":{"o1":input}}));
    assert_eq!(
        serde_json::to_value(originals::saved_original(&review, "o1").unwrap().acceptance).unwrap(),
        json!({"state":"unverified","reason":"unknown-saved-contract"})
    );
}
/// The `F` original, saved under `validator`, with a finding whose text has
/// quotes, a newline and non-ASCII characters.
fn saved_under(validator: &str) -> (Value, Value) {
    let mut input = original_fixture()["F"].clone();
    input["contract"]["validator"] = json!(validator);
    input["parsed"]["findings"][0]["claim"] = json!("says \"no\"\nthen ü → ok");
    let review = records(json!({"schema":"review-1","originals":{"o1":input.clone()}}));
    (review, input)
}
#[test]
fn an_h4_original_yields_its_saved_findings_exactly() {
    let (review, input) = saved_under("H4-1");
    let parsed = originals::saved_original(&review, "o1").unwrap().parsed.unwrap();
    assert_eq!(serde_json::to_value(parsed.findings).unwrap(), input["parsed"]["findings"]);
}
#[test]
fn an_original_under_another_contract_yields_no_findings() {
    let (review, _) = saved_under("historical-unknown");
    assert!(originals::saved_original(&review, "o1").unwrap().parsed.is_none());
}
#[test]
fn reading_an_original_returns_its_exact_saved_raw_bytes() {
    let input = original_fixture()["Q"].clone();
    let saved: Vec<u8> = serde_json::from_value(input["raw"].clone()).unwrap();
    let review = records(json!({"schema":"review-1","originals":{"o1":input}}));
    assert_eq!(originals::original_read(&review, "o1").unwrap().raw_bytes, saved);
}
