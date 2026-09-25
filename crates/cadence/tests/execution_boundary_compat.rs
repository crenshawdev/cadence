//! Independent wire fixtures for the boundary format.
use cadence::envelope::Envelope;
use cadence::execution::{
    boundary::{BoundaryScope, BoundaryV1, PreparedAnswer},
    model::BoundaryTool,
};
use cadence::store::model::{self, Decision, DecisionRecord};
use serde_json::{Value, json};
use std::collections::BTreeMap;

fn refusal(unique: &str) -> BoundaryV1 {
    BoundaryV1::new(
        BoundaryScope::RootRefusal,
        BoundaryTool::CadenceQuery,
        "execute-next".into(),
        model::digest(unique.as_bytes()),
        None,
        &PreparedAnswer::new(Envelope::Refused {
            code: "invalid-input".into(),
            reason: "invalid execution input".into(),
        })
        .unwrap(),
    )
}
fn canonical(value: &Value) -> Vec<u8> {
    match value {
        Value::Object(object) => format!(
            "{{{}}}",
            object
                .iter()
                .collect::<BTreeMap<_, _>>()
                .into_iter()
                .map(|(k, v)| format!(
                    "{}:{}",
                    serde_json::to_string(k).unwrap(),
                    String::from_utf8(canonical(v)).unwrap()
                ))
                .collect::<Vec<_>>()
                .join(",")
        )
        .into_bytes(),
        Value::Array(array) => format!(
            "[{}]",
            array
                .iter()
                .map(|v| String::from_utf8(canonical(v)).unwrap())
                .collect::<Vec<_>>()
                .join(",")
        )
        .into_bytes(),
        _ => serde_json::to_vec(value).unwrap(),
    }
}
fn wire_record(boundary: Value, generation: u64, terminal: bool) -> Value {
    let id = model::digest(&canonical(&json!(["boundary-envelope-v1", boundary])));
    json!({"version":1,"id":id,"revision":1,"origin":{"source":"execution-boundary-v1","original":"missing"},
        "decision":{"class":"boundary_v1","boundary":boundary,"store_generation":generation,"terminal":terminal}})
}
fn validate(values: Vec<Value>) -> bool {
    let bytes = values
        .iter()
        .map(|v| serde_json::to_string(v).unwrap() + "\n")
        .collect::<String>();
    let records = model::parse_lines::<DecisionRecord>(bytes.as_bytes());
    records
        .and_then(|records| model::validate_decisions(&records))
        .is_ok()
}

#[test]
fn a_duplicate_record_or_a_later_revision_of_an_immutable_record_is_rejected() {
    let boundary = serde_json::to_value(refusal("one")).unwrap();
    let first = wire_record(boundary, 1, false);
    assert!(validate(vec![first.clone()]));
    assert!(!validate(vec![first.clone(), first.clone()]));
    let mut revision = first.clone();
    revision["revision"] = json!(2);
    assert!(!validate(vec![first.clone(), revision]));
}

#[test]
fn each_malformed_boundary_field_is_rejected() {
    for field in [
        "codec",
        "scope",
        "response_digest",
        "receipt",
        "operation",
        "outcome",
    ] {
        let mut invalid = serde_json::to_value(refusal("invalid")).unwrap();
        invalid[field] = match field {
            "codec" => json!(99),
            "scope" => json!({"scope":"execution","phase":0}),
            "response_digest" => json!("d".repeat(64)),
            "receipt" => json!({"receipt":"unknown"}),
            _ => json!("wrong"),
        };
        assert!(!validate(vec![wire_record(invalid, 1, false)]), "{field}");
    }
}

#[test]
fn a_terminal_log_bound_record_is_valid_only_as_the_257th_once_and_last() {
    let mut history: Vec<_> = (0..256)
        .map(|i| {
            wire_record(
                serde_json::to_value(refusal(&i.to_string())).unwrap(),
                i + 1,
                false,
            )
        })
        .collect();
    let terminal_boundary =
        serde_json::to_value(BoundaryV1::terminal(BoundaryScope::RootRefusal).unwrap()).unwrap();
    let terminal = wire_record(terminal_boundary, 257, true);
    assert!(!validate(vec![terminal.clone()]));
    history.push(terminal.clone());
    assert!(validate(history.clone()));
    let mut second = history.clone();
    second.push(terminal);
    assert!(!validate(second));
    history.push(wire_record(
        serde_json::to_value(refusal("late")).unwrap(),
        258,
        false,
    ));
    assert!(!validate(history));
}

#[test]
fn a_legacy_compact_receipt_boundary_reserializes_identically_under_its_canonical_identity() {
    let old = json!({"codec":1,"scope":{"scope":"root-refusal"},"tool":"cadence-query","operation":"execute-next",
        "request_digest":model::digest(b"one"),"outcome":"refused:invalid-input","subject_id":null,
        "response_digest":model::digest(&canonical(&json!({"status":"refused","code":"invalid-input","reason":"invalid execution input"}))),
        "receipt":{"receipt":"compact","envelope":{"status":"refused","code":"invalid-input","reason":"invalid execution input"}}});
    let decoded: BoundaryV1 = serde_json::from_value(old.clone()).unwrap();
    assert_eq!(
        serde_json::to_vec(&decoded).unwrap(),
        serde_json::to_vec(&old).unwrap()
    );
    assert_eq!(
        decoded.identity().unwrap(),
        model::digest(&canonical(&json!(["boundary-envelope-v1", old])))
    );
}

#[test]
fn a_lease_refusal_boundary_validates_and_each_malformed_lease_field_is_refused() {
    let paths = cadence::execution::patch::UndeclaredPaths {
        schema: 1,
        dispatch_id: "open-dispatch".into(),
        phase: 7,
        plan: 2,
        tasks: BTreeMap::from([("T1".into(), "2".repeat(40))]),
        committed: BTreeMap::from([("2".repeat(40), vec!["outside.txt".into()])]),
        staged: vec!["Cargo.lock".into()],
    };
    let boundary = BoundaryV1::lease_refusal(model::digest(b"request"), paths).unwrap();
    let value = serde_json::to_value(&boundary).unwrap();
    assert!(validate(vec![wire_record(value.clone(), 1, false)]));
    for field in [
        "schema",
        "phase",
        "tasks",
        "staged",
        "committed",
        "dispatch_id",
    ] {
        let mut invalid = value.clone();
        invalid["lease_refusal"]["paths"][field] = match field {
            "schema" => json!(99),
            "phase" => json!(0),
            "tasks" => json!({}),
            "staged" => json!(["z", "a"]),
            "committed" => json!({"3333333333333333333333333333333333333333":["outside.txt"]}),
            _ => json!("wrong"),
        };
        assert!(!validate(vec![wire_record(invalid, 1, false)]), "{field}");
    }
    let mut invalid = value.clone();
    invalid["lease_refusal"]["disposition"] = json!("automatically reset history");
    assert!(!validate(vec![wire_record(invalid, 1, false)]));
    let mut invalid = value;
    invalid["lease_refusal"]["paths"]["staged"] = json!(["../outside"]);
    assert!(!validate(vec![wire_record(invalid, 1, false)]));
}

/// A dispatch admitted before D-165: `prompt_bytes` and no prompt.
fn pre_d165_dispatch() -> Value {
    json!({"schema":1,"id":"old-dispatch","expected_execution_version":1,
        "phase":6,"plan":1,"plan_fingerprint":"plan","plan_set_fingerprint":"plans",
        "requirements":["AC4"],"tasks":[{"id":"T1","verify":["verify-T1"]}],
        "suite":"suite-command","files":["src/a.rs"],
        "policy":{"rung":"fixed","branch":"current","reviews":"disabled"},
        "base_sha":"1111111111111111111111111111111111111111","prompt_bytes":512,"body":""})
}

/// A dispatch admitted after D-165: the prompt and its digest, no byte count.
fn post_d165_dispatch() -> (Value, String) {
    let prompt = "p".repeat(20);
    let mut current = pre_d165_dispatch();
    current.as_object_mut().unwrap().remove("prompt_bytes");
    current["prompt"] = json!(prompt);
    current["prompt_digest"] = json!(model::digest(prompt.as_bytes()));
    (current, prompt)
}

// Every retained close proof embeds its dispatch and is digested over exactly
// those bytes, so the record must write back what it read (D-175, second site).
#[test]
fn a_pre_d165_dispatch_round_trips_byte_identically_with_no_prompt() {
    let wire = pre_d165_dispatch();
    let supplied: cadence::execution::model::ActiveDispatch = serde_json::from_value(wire.clone()).unwrap();
    assert!(supplied.prompt.is_empty() && supplied.prompt_digest.is_empty());
    assert_eq!(supplied.prompt_bytes, Some(512));
    assert_eq!(serde_json::to_value(&supplied).unwrap(), wire);
}

#[test]
fn a_post_d165_dispatch_round_trips_with_its_prompt_and_no_byte_count() {
    let (current, _) = post_d165_dispatch();
    let supplied: cadence::execution::model::ActiveDispatch = serde_json::from_value(current.clone()).unwrap();
    assert_eq!(supplied.prompt_bytes, None);
    assert_eq!(serde_json::to_value(&supplied).unwrap(), current);
}

#[test]
fn a_retained_dispatch_boundary_replays_the_fixed_historical_answer_unchanged() {
    use cadence::execution::{boundary::BoundaryV1, model::ActiveDispatch};
    use cadence::store::writer::ConfirmedBoundary;
    let (post, post_prompt) = post_d165_dispatch();
    for (dispatch, prompt) in [(pre_d165_dispatch(), "x".repeat(512)), (post, post_prompt)] {
        let (raw, record) = historical_boundary(&dispatch, &prompt);
        let boundary: BoundaryV1 = serde_json::from_value(raw).unwrap();
        let before = serde_json::to_vec(&record).unwrap();
        let Decision::BoundaryV1(value) = &record.decision else { panic!("historical boundary") };
        let confirmed = ConfirmedBoundary { id: &record.id, value };
        let supplied: ActiveDispatch = serde_json::from_value(dispatch.clone()).unwrap();
        let mut expected = json!({"status":"ok","outcome":"dispatch","dispatch_id":"old-dispatch",
            "expected_execution_version":1,"route":null,
            "identities":{"dispatch":{"kind":"dispatch","id":"old-dispatch"},
                "plan":{"kind":"phase-plan","phase":6,"plan":1},
                "context":{"kind":"phase-context","phase":6}}});
        if let Some(digest) = dispatch.get("prompt_digest") { expected["prompt_digest"] = digest.clone(); }
        for _ in 0..2 {
            let replay = confirmed.historical_dispatch(&supplied, &prompt).unwrap();
            assert_eq!(serde_json::to_value(replay).unwrap(), expected);
            assert_eq!(serde_json::to_vec(&record).unwrap(), before);
            assert_eq!(value.boundary.identity().unwrap(), boundary.identity().unwrap());
        }
    }
}

#[test]
fn the_historical_replay_refuses_a_prompt_that_differs_from_the_retained_one() {
    use cadence::execution::model::ActiveDispatch;
    use cadence::store::writer::ConfirmedBoundary;
    let (post, post_prompt) = post_d165_dispatch();
    for (dispatch, prompt) in [(pre_d165_dispatch(), "x".repeat(512)), (post, post_prompt)] {
        let (_, record) = historical_boundary(&dispatch, &prompt);
        let Decision::BoundaryV1(value) = &record.decision else { panic!("historical boundary") };
        let confirmed = ConfirmedBoundary { id: &record.id, value };
        let supplied: ActiveDispatch = serde_json::from_value(dispatch.clone()).unwrap();
        assert!(confirmed.historical_dispatch(&supplied, &format!("{prompt}!")).is_err());
    }
}

/// The boundary a historical dispatch answer left, and its decision record.
/// This fixture retains the historical prompt-bearing envelope. No fresh
/// dispatch request or current PreparedAnswer creates its replay receipt.
fn historical_boundary(dispatch: &Value, prompt: &str) -> (Value, DecisionRecord) {
    let retained_envelope = json!({"status":"ok","outcome":"dispatch","dispatch":dispatch,"prompt":prompt});
    let mut receipt = json!({"receipt":"dispatch","dispatch_id":dispatch["id"]});
    if let Some(bytes) = dispatch.get("prompt_bytes") {
        receipt["prompt_bytes"] = bytes.clone();
    } else {
        receipt["prompt_digest"] = dispatch["prompt_digest"].clone();
    }
    let raw = json!({"codec":1,"scope":{"scope":"execution","phase":6},
        "tool":"cadence-query","operation":"execute-next",
        "request_digest":"a".repeat(64),"outcome":"dispatch","subject_id":dispatch["id"],
        "response_digest":model::digest(&canonical(&retained_envelope)),"receipt":receipt});
    let record: DecisionRecord = serde_json::from_value(wire_record(raw.clone(), 1, false)).unwrap();
    (raw, record)
}

/// Verbatim from this project's decisions.jsonl (generation 11): every dispatch
/// boundary written before D-165 carries `prompt_bytes`, and its id is the
/// digest of exactly those bytes.
const RETAINED_DISPATCH: &[u8] = br#"{"version":1,"id":"fd73b34e20f4eea7940d0199b87a8291c52f5d731458f2cde5d3850dee3666f2","revision":1,"origin":{"source":"execution-boundary-v1","original":"missing"},"decision":{"class":"boundary_v1","boundary":{"codec":1,"scope":{"scope":"execution","phase":31},"tool":"cadence-query","operation":"execute-next","request_digest":"42bd9246acd9b54f997d46b23cc1c90ab780ff86d7aaddbae85ee2556c4c32a5","outcome":"dispatch","subject_id":"c68a606535f1f85db58f11a95117f76d404ce79c9f11ba171bc795d17b053c28","response_digest":"547338b6015175af68b49b2ecaed279cccd14b7c55189c5269e5b47defb54835","receipt":{"receipt":"dispatch","dispatch_id":"c68a606535f1f85db58f11a95117f76d404ce79c9f11ba171bc795d17b053c28","prompt_bytes":63671}},"store_generation":11,"terminal":false}}"#;

#[test]
fn retained_dispatch_receipt_with_prompt_bytes_keeps_its_identity() {
    // Loading it must not change what it re-serializes to.
    let record: DecisionRecord = serde_json::from_slice(RETAINED_DISPATCH).unwrap();
    assert_eq!(serde_json::to_vec(&record).unwrap(), RETAINED_DISPATCH);
    model::validate_decisions(&[record]).unwrap();
}

#[test]
fn a_dispatch_receipt_validates_in_digest_form_and_refuses_a_zero_count_or_unknown_field() {
    let mut boundary: Value = serde_json::from_slice(RETAINED_DISPATCH).unwrap();
    let boundary = boundary["decision"]["boundary"].take();
    // A record written after D-165 carries the digest and never the byte count.
    let mut current = boundary.clone();
    current["receipt"] = json!({"receipt":"dispatch",
        "dispatch_id":"c68a606535f1f85db58f11a95117f76d404ce79c9f11ba171bc795d17b053c28",
        "prompt_digest":"d08d660b7de4e2314def9d953b46d4fec2db3acbfe7344cda4ede7faacc5e177"});
    assert!(validate(vec![wire_record(current, 1, false)]));
    // A retained byte count of zero and an unknown receipt field are still refused.
    let mut zero = boundary.clone();
    zero["receipt"]["prompt_bytes"] = json!(0);
    assert!(!validate(vec![wire_record(zero, 1, false)]));
    let mut unknown = boundary;
    unknown["receipt"]["prompt_size"] = json!(1);
    assert!(!validate(vec![wire_record(unknown, 1, false)]));
}

#[test]
fn the_historical_replay_refuses_a_boundary_whose_response_digest_differs() {
    use cadence::execution::model::ActiveDispatch;
    use cadence::store::writer::ConfirmedBoundary;
    let (post, post_prompt) = post_d165_dispatch();
    for (dispatch, prompt) in [(pre_d165_dispatch(), "x".repeat(512)), (post, post_prompt)] {
        let (_, mut record) = historical_boundary(&dispatch, &prompt);
        if let Decision::BoundaryV1(value) = &mut record.decision {
            value.boundary.response_digest = cadence::store::model::digest(b"another answer");
        }
        let Decision::BoundaryV1(value) = &record.decision else { panic!("historical boundary") };
        let confirmed = ConfirmedBoundary { id: &record.id, value };
        let supplied: ActiveDispatch = serde_json::from_value(dispatch.clone()).unwrap();
        assert!(confirmed.historical_dispatch(&supplied, &prompt).is_err());
    }
}
