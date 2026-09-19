#[path = "support/phase31.rs"]
mod support;

use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use support::{Client, ProcessFixture, observed_plan_review, publish_review_plan};

#[test]
fn phase33_review_entry_reads_as_bounded_parts() {
    let fixture = ProcessFixture::new();
    let text = "pub fn selected_unit() -> u32 { 31 }\n".to_owned()
        + &"// retained material λ\n".repeat(3000);
    std::fs::write(fixture.project().join("src/lease.rs"), &text).unwrap();
    let mut client = Client::open(fixture.project());
    let selected = client.call("cadence_query", json!({"operation":"review-select","command":"cad-review",
        "arguments":["minimalism","src/lease.rs"],"replay_key":"material"}));
    let admitted = client.call("cadence_apply", json!({"operation":"review-admit","request":selected["result"]["admission"]}));
    let next = client.call("cadence_query", json!({"operation":"review-next","fire":admitted["result"]["fire"]}));
    let attempt = &next["result"]["attempt"];
    let entry = &attempt["view"]["entries"][0];
    let identity = json!({"kind":"review-entry","attempt":attempt["attempt"],"entry":entry});
    let material = client.call("cadence_query", json!({"operation":"review-material","attempt":attempt["attempt"],"entry":entry}));
    assert_eq!(material["result"]["identity"], identity, "{material}");
    assert!(material["result"].get("bytes").is_none());
    assert!(material["result"]["entry"].get("lines").is_none());
    let index = client.call("cadence_query", json!({"operation":"document","identity":identity}));
    assert_eq!(index["status"], "ok", "{index}");
    let parts = index["parts"].as_array().unwrap();
    assert!(parts.iter().filter(|p| p["part"].as_str().unwrap().starts_with("text:")).count() > 1);
    assert!(parts.iter().filter(|p| p["part"].as_str().unwrap().starts_with("lines:")).count() > 1);
    let mut recovered = String::new();
    let mut lines = Vec::new();
    for (position, part) in parts.iter().enumerate() {
        assert!(part["bytes"].as_u64().unwrap() <= 24576);
        let slice = client.call("cadence_query", json!({"operation":"document","identity":identity,"part":part["part"]}));
        let body = slice["body"].as_str().unwrap();
        assert!(body.len() <= 24576);
        assert_eq!(slice["next"], parts.get(position + 1).map_or(Value::Null, |p| p["part"].clone()));
        if part["part"].as_str().unwrap().starts_with("text:") {
            assert!(part["title"].as_str().unwrap().contains("lines"));
            recovered.push_str(body);
        } else if part["part"].as_str().unwrap().starts_with("lines:") {
            lines.extend(serde_json::from_str::<Vec<Value>>(body).unwrap());
        } else {
            assert!(serde_json::from_str::<Value>(body).unwrap().get("lines").is_none());
        }
    }
    assert_eq!(recovered, text);
    assert_eq!(lines.len(), 3001);
    let foreign = client.call("cadence_query", json!({"operation":"document",
        "identity":{"kind":"review-entry","attempt":"unknown-attempt","entry":entry}}));
    assert_eq!(foreign["status"], "refused", "{foreign}");
    let found = client.call("cadence_query", json!({"operation":"search","pattern":"pub fn selected_unit",
        "scope":{"kind":"glob","selector":"src/lease.rs"}}));
    let hit = &found["hits"][0];
    for (key, location, expected) in [("unit", &hit["location"], "pub fn selected_unit() -> u32 { 31 }\n"),
        ("file", &hit["file_reference"], text.as_str())] {
        let appended = client.call("cadence_apply", json!({"operation":"review-material-append",
            "manifest":attempt["view"]["manifest"],"acquisition":key,"location":location}));
        assert_eq!(appended["status"], "ok", "{appended}");
        assert_eq!(appended["result"]["content"], format!("{:x}", Sha256::digest(expected.as_bytes())));
        let denied = client.call("cadence_query", json!({"operation":"document","identity":{
            "kind":"review-entry","attempt":attempt["attempt"],"entry":appended["result"]["entry"]}}));
        assert_eq!(denied["status"], "refused", "undelivered append: {denied}");
    }
    std::fs::write(fixture.project().join("src/lease.rs"), "changed\n").unwrap();
    let stale = client.call("cadence_apply", json!({"operation":"review-material-append",
        "manifest":attempt["view"]["manifest"],"acquisition":"stale","location":hit["location"]}));
    assert_eq!(stale["status"], "refused", "{stale}");
    let refused = client.call("cadence_apply", json!({"operation":"review-material-append",
        "manifest":attempt["view"]["manifest"],"acquisition":"bytes","bytes":[65]}));
    assert_eq!(refused["code"], "typed-content", "{refused}");
    assert_eq!(refused["slot"], "bytes", "{refused}");
}

#[test]
fn phase33_review_return_answers_digest_and_count() {
    let fixture = ProcessFixture::new();
    let mut client = Client::open(fixture.project());
    publish_review_plan(&mut client);
    let mut request = observed_plan_review(&mut client, "typed");
    let findings = json!([
        {"file":"src/lease.rs","line":1,"severity":"high","claim":"First claim","failure_scenario":"First failure"},
        {"file":"src/lease.rs","line":2,"severity":"medium","claim":"Second claim","failure_scenario":"Second failure"},
        {"file":"src/lease.rs","line":3,"severity":"low","claim":"Third claim","failure_scenario":"Third failure"}
    ]);
    request["findings"] = findings.clone();
    // The digest preimage is the retained object envelope, in Finding struct
    // field order, with no whitespace; it equals Original.content.
    let canonical = concat!("{\"findings\":[",
        "{\"file\":\"src/lease.rs\",\"line\":1,\"severity\":\"high\",\"claim\":\"First claim\",\"failure_scenario\":\"First failure\"},",
        "{\"file\":\"src/lease.rs\",\"line\":2,\"severity\":\"medium\",\"claim\":\"Second claim\",\"failure_scenario\":\"Second failure\"},",
        "{\"file\":\"src/lease.rs\",\"line\":3,\"severity\":\"low\",\"claim\":\"Third claim\",\"failure_scenario\":\"Third failure\"}]}");
    let digest = format!("{:x}", Sha256::digest(canonical.as_bytes()));
    let answer = client.call("cadence_apply", request.clone());
    let expected = json!({"status":"ok","operation":"review-return","result":{
        "attempt":request["identity"]["attempt"],"terminal":"accepted","replayed":false,
        "findings":{"digest":digest,"count":3},"durable_terminal_count":1,"next_selection":null}});
    assert_eq!(answer, expected);
    let mut replay = expected.clone();
    replay["result"]["replayed"] = json!(true);
    assert_eq!(client.call("cadence_apply", request.clone()), replay);
    let attempt = client.call("cadence_query", json!({"operation":"review-attempt","attempt":request["identity"]["attempt"]}));
    let original = client.call("cadence_query", json!({"operation":"review-original","original":attempt["result"]["original"]}));
    assert_eq!(original["result"]["record"]["content"], digest);
    assert!(original["result"].get("raw_bytes").is_none(), "{original}");
    let mut malformed = observed_plan_review(&mut client, "malformed");
    malformed["findings"] = findings;
    malformed["findings"][1].as_object_mut().unwrap().remove("severity");
    let refused = client.call("cadence_apply", malformed);
    assert_eq!(refused["status"], "refused", "{refused}");
    assert_eq!(refused["code"], "invalid-return", "{refused}");
    assert_eq!(refused["slot"], "findings[1].severity", "{refused}");
    request.as_object_mut().unwrap().remove("findings");
    request["raw"] = Value::String("{\"findings\":[]}".into());
    let refused = client.call("cadence_apply", request);
    assert_eq!(refused["code"], "typed-content", "{refused}");
    assert_eq!(refused["slot"], "raw", "{refused}");
}
