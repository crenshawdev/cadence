use cadence::review::{io, model, persistence, returns};

use serde_json::{Value, json};
struct FixedClock;
impl io::Clock for FixedClock {
    fn now(&mut self) -> u64 {
        100
    }
}
fn fixture() -> Value {
    serde_json::from_str(include_str!("fixtures/phase9/h4-returns.json")).unwrap()
}
/// The review records one snapshot holds.
fn records(review: Value) -> Value {
    persistence::records(&json!({"review":review})).unwrap()
}
fn decide(review: Value, submitted: &returns::ReturnSubmission) -> Result<returns::ReturnDecision, returns::ReturnError> {
    returns::decide_return(records(review), submitted, &mut FixedClock)
}
/// The receipt for a new closure, read from the records it would commit.
fn closed(decision: returns::ReturnDecision) -> returns::ReturnReceipt {
    match decision {
        returns::ReturnDecision::Close { records, admission, attempt } => {
            returns::receipt(&records, &admission, &attempt, false).unwrap()
        }
        returns::ReturnDecision::Replay(_) => panic!("a pending attempt was replayed"),
    }
}
fn submission(input: &Value, raw: Option<&[u8]>) -> returns::ReturnSubmission {
    returns::ReturnSubmission {
        identity: serde_json::from_value(input["identity"].clone()).unwrap(),
        launch: "launch1".into(),
        host_return: Some("return1".into()),
        raw: raw.map(Vec::from),
        host_failure: None,
        citations: vec![],
    }
}
fn accepted(input: &Value) -> Value {
    let mut records = input["pending"].clone();
    records["attempts"]["a1"] = input["accepted_attempt"].clone();
    records["closures"] = json!({"a1":input["closure"]});
    records["originals"] = json!({"o1":input["original"]});
    records["originals"]["o1"]["raw"] = json!(input["F"].as_str().unwrap().as_bytes());
    records["original_sequence"] = json!(1);
    records
}
#[test]
fn accept_replay_ac46() {
    let input = fixture();
    let submitted = submission(&input, Some(input["F"].as_str().unwrap().as_bytes()));
    let Ok(returns::ReturnDecision::Replay(result)) = decide(accepted(&input), &submitted) else {
        panic!("a closed attempt was not replayed")
    };
    assert_eq!(
        json!({"attempt":result.attempt,"findings":result.findings,"terminal":result.terminal,"replayed":result.replayed}),
        json!({"attempt":"a1","findings":{"digest":input["original"]["content"],"count":1},"terminal":"accepted","replayed":true})
    );
}
#[test]
fn accept_conflict_ac47() {
    let input = fixture();
    let submitted = submission(&input, Some(input["Changed"].as_str().unwrap().as_bytes()));
    assert_eq!(
        serde_json::to_value(decide(accepted(&input), &submitted).err().unwrap()).unwrap(),
        json!({"code":"conflicting-return","attempt":"a1","original":"o1"})
    );
}
#[test]
fn accept_missing_return_closes_failed() {
    let input = fixture();
    let result = closed(decide(input["pending"].clone(), &submission(&input, None)).unwrap());
    assert_eq!(
        json!({"terminal":result.terminal,"findings":result.findings,"terminal_count":result.durable_terminal_count}),
        json!({"terminal":"failed","findings":null,"terminal_count":1})
    );
}
#[test]
fn accept_malformed_return_closes_failed() {
    let input = fixture();
    let submitted = submission(&input, Some(b"{\"findings\":"));
    assert_eq!(
        closed(decide(input["pending"].clone(), &submitted).unwrap()).terminal,
        model::AttemptState::Failed
    );
}
/// The new closure a return of `raw` writes over the pending records.
fn closing(input: &Value, raw: &[u8]) -> (Value, Box<model::Admission>, Box<model::Attempt>) {
    match decide(input["pending"].clone(), &submission(input, Some(raw))).unwrap() {
        returns::ReturnDecision::Close { records, admission, attempt } => (records, admission, attempt),
        returns::ReturnDecision::Replay(_) => panic!("a pending attempt was replayed"),
    }
}
#[test]
fn a_usable_return_records_a_new_original_with_the_exact_raw_bytes_and_parsed_findings() {
    let input = fixture();
    let raw = input["F"].as_str().unwrap().as_bytes();
    let (records, _, _) = closing(&input, raw);
    let original = &records["originals"]["o1"];
    assert_eq!(original["raw"], json!(raw));
    assert_eq!(original["parsed"], input["original"]["parsed"]);
}
#[test]
fn the_receipt_reports_only_the_findings_digest_and_count() {
    let input = fixture();
    let raw = input["F"].as_str().unwrap().as_bytes();
    let receipt = closed(decide(input["pending"].clone(), &submission(&input, Some(raw))).unwrap());
    let reported = serde_json::to_value(receipt).unwrap();
    assert_eq!(
        reported["findings"],
        json!({"digest":input["original"]["content"],"count":1})
    );
    assert!(reported.get("originals").is_none() && reported.get("original").is_none());
}
#[test]
fn a_failed_commit_replies_delivery_write_failed_unacknowledged() {
    let input = fixture();
    let raw = input["F"].as_str().unwrap().as_bytes();
    let (_, admission, attempt) = closing(&input, raw);
    let refused = returns::settle(
        persistence::Outcome::Failed,
        &admission,
        &attempt,
        &submission(&input, Some(raw)),
    )
    .unwrap_err();
    assert_eq!(
        serde_json::to_value(refused).unwrap(),
        json!({"code":"delivery-write-failed","attempt":"a1","acknowledged":false})
    );
}
#[test]
fn a_lost_race_to_a_different_accepted_return_names_the_winners_original() {
    let input = fixture();
    let changed = input["Changed"].as_str().unwrap().as_bytes();
    let (_, admission, attempt) = closing(&input, changed);
    let refused = returns::settle(
        persistence::Outcome::Lost(records(accepted(&input))),
        &admission,
        &attempt,
        &submission(&input, Some(changed)),
    )
    .unwrap_err();
    assert_eq!(
        serde_json::to_value(refused).unwrap(),
        json!({"code":"conflicting-return","attempt":"a1","original":"o1"})
    );
}
#[test]
fn a_provider_failure_closes_the_attempt_failed_with_no_original() {
    let input = fixture();
    let mut submitted = submission(&input, None);
    submitted.host_failure = Some("HTTP 500: upstream error".into());
    let result = closed(decide(input["pending"].clone(), &submitted).unwrap());
    assert_eq!((result.terminal, result.original), (model::AttemptState::Failed, None));
}
