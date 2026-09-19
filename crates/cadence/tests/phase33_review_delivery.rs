#[path = "support/phase31.rs"]
mod support;

use serde_json::json;
use sha2::{Digest, Sha256};
use support::{Client, ProcessFixture, observed_plan_review, publish_review_plan};

#[test]
fn phase33_review_delivery_contract_accepts_typed_findings() {
    let fixture = ProcessFixture::new();
    let mut client = Client::open(fixture.project());
    publish_review_plan(&mut client);
    let mut request = observed_plan_review(&mut client, "delivery");
    let identity = request["identity"].clone();
    let findings = json!([{"file":"src/lease.rs","line":1,"severity":"low",
        "claim":"The answer is constant","failure_scenario":"A different input still returns 31"}]);
    request["findings"] = findings.clone();
    request["host_failure"] = serde_json::Value::Null;
    let canonical = r#"{"findings":[{"file":"src/lease.rs","line":1,"severity":"low","claim":"The answer is constant","failure_scenario":"A different input still returns 31"}]}"#;
    let digest = format!("{:x}", Sha256::digest(canonical.as_bytes()));
    let receipt = client.call("cadence_apply", request.clone());
    assert_eq!(receipt, json!({"status":"ok","operation":"review-return","result":{
        "attempt":identity["attempt"],"terminal":"accepted","replayed":false,
        "findings":{"digest":digest,"count":1},"durable_terminal_count":1,"next_selection":null}}));

    // A new resident must read the retained original and acknowledge an exact replay.
    client.finish();
    let mut client = Client::open(fixture.project());
    let mut replay = receipt.clone();
    replay["result"]["replayed"] = json!(true);
    assert_eq!(client.call("cadence_apply", request), replay);
    let saved = client.call("cadence_query", json!({"operation":"review-attempt","attempt":identity["attempt"]}));
    let original = client.call("cadence_query", json!({"operation":"review-original","original":saved["result"]["original"]}));
    assert_eq!(original["status"], "ok", "{original}");
    assert_eq!(original["result"]["identity"]["original"], saved["result"]["original"], "{original}");
    assert_eq!(original["result"]["record"]["content"], digest, "{original}");
    assert_eq!(original["result"]["findings"], findings, "{original}");
    assert!(original["result"].get("raw_bytes").is_none(), "{original}");
    let next = client.call("cadence_query", json!({"operation":"review-next","fire":identity["fire"]}));
    assert_eq!(next["result"]["action"], "continue", "{next}");

    // The rendered execution front door delegates to this exact delivery contract. Keep this
    // assertion after the wire episode so red proves the instruction defect.
    let output = std::process::Command::new(env!("CARGO_BIN_EXE_cadence"))
        .args(["executor-instructions", "--frontdoor"]).output().unwrap();
    assert!(output.status.success());
    let instructions = String::from_utf8(output.stdout).unwrap();
    assert!(instructions.contains("@${CLAUDE_PLUGIN_ROOT}/skills/cad-review-delivery/SKILL.md"));
    let delivery = std::fs::read_to_string(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../skills/cad-review-delivery/SKILL.md")
    ).unwrap().split_whitespace().collect::<Vec<_>>().join(" ");
    assert!(delivery.contains("findings array") && delivery.contains("Never send raw"),
        "delivery must instruct typed findings and forbid sending raw");
    assert!(!delivery.contains("host_return, raw") && !delivery.contains("Copy raw text byte-for-byte"),
        "delivery must not instruct the removed raw return protocol");
}
