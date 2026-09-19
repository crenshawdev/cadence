#[path = "support/phase31.rs"]
#[allow(dead_code)]
mod support;

use sha2::{Digest, Sha256};
use std::fs;
use support::ClosedRound;

#[test]
fn phase33_round_record_renders_tokens_beside_the_median() {
    use serde_json::json;
    let mut round = ClosedRound::admitted();
    let initial = round.client.call("cadence_query", json!({"operation":"execution-history","phase":31,"plan":1}));
    assert!(initial["plans"][0]["state"].get("round").is_none(), "{initial}");
    assert!(initial["plans"][0]["state"].get("completion").is_none(), "{initial}");
    let identity = json!({"kind":"phase-plan","phase":31,"plan":1});
    let index = round.client.call("cadence_query", json!({"operation":"document","identity":identity}));
    assert!(!index["parts"].as_array().unwrap().iter().any(|part| part["part"] == "execution"));
    let original_parts: Vec<_> = index["parts"].as_array().unwrap().iter().map(|part| {
        round.client.call("cadence_query", json!({"operation":"document","identity":identity,"part":part["part"]}))
    }).collect();
    let base = support::git(round.fixture.project(), &["rev-parse", "HEAD"]);
    let submission = json!({"dispatch_id":round.dispatch["dispatch_id"],"host":"codex exec","tokens":106259,"wire_bytes":null});
    let statement = json!({"submission":submission,"approval":{"approved":true,
        "owner":"Fixture Owner","at":"2026-09-17T12:00:00Z","submission":submission}});
    let request = json!({"operation":"execution-round-record","request":{"request_id":"round-tokens",
        "plan":round.plan,"expected_version":0,"statement":statement}});
    let before = support::tree(round.fixture.project());
    let refused = round.client.call("cadence_apply", request.clone());
    assert_eq!(refused["code"], "round-open", "{refused}");
    assert_eq!(support::tree(round.fixture.project()), before);
    round.close_tasks();
    let recorded = round.client.call("cadence_apply", request.clone());
    assert_eq!(recorded, json!({"status":"ok","receipt":{"plan":round.plan,"request_id":"round-tokens","version":1}}));
    let expected_round = json!({"dispatch_id":round.dispatch["dispatch_id"],"host":"codex exec",
        "tokens":106259,"wire_bytes":null,"owner":"Fixture Owner","at":"2026-09-17T12:00:00Z",
        "request_id":"round-tokens"});
    let state = assert_plan_read_surface(&mut round, &expected_round, &original_parts);
    assert!(state.get("completion").is_none(), "{state}");
    let summary = fs::read_to_string(round.fixture.project().join(".planning/phases/31/SUMMARY.md")).unwrap();
    assert_eq!(summary.lines().filter(|line| *line == "Executor round tokens: 106259 against 141893 (3.7 cad-executor median per dispatch, n=149, .planning/trace.jsonl, locked 2026-08-24); host codex exec; wire bytes unmeasured").count(), 1);
    let before = support::tree(round.fixture.project());
    assert_eq!(round.client.call("cadence_apply", request.clone()), recorded);
    assert_eq!(support::tree(round.fixture.project()), before);
    for (field, value) in [("tokens", json!(0)), ("tokens", json!(-1)), ("tokens", json!(1.5)), ("host", json!("  "))] {
        let mut invalid = request.clone();
        invalid["request"]["request_id"] = json!(format!("invalid-{field}-{value}"));
        invalid["request"]["expected_version"] = json!(1);
        invalid["request"]["statement"]["submission"][field] = value.clone();
        invalid["request"]["statement"]["approval"]["submission"][field] = value;
        assert_eq!(round.client.call("cadence_apply", invalid)["status"], "refused");
        assert_eq!(support::tree(round.fixture.project()), before);
    }
    let mut mismatch = request.clone();
    mismatch["request"]["request_id"] = json!("mismatched-owner-echo");
    mismatch["request"]["expected_version"] = json!(1);
    mismatch["request"]["statement"]["approval"]["submission"]["tokens"] = json!(1);
    assert_eq!(round.client.call("cadence_apply", mismatch)["status"], "refused");
    assert_eq!(support::tree(round.fixture.project()), before);
    let mut reused = request;
    reused["request"]["statement"]["submission"]["tokens"] = json!(2);
    assert_eq!(round.client.call("cadence_apply", reused)["status"], "refused");
    assert_eq!(support::tree(round.fixture.project()), before);
    round.complete();
    let state = assert_plan_read_surface(&mut round, &expected_round, &original_parts);
    assert_eq!(state["completion"], json!({"suite_run":"round-suite","request_id":"round-complete",
        "base":base,"head":round.commits.last().unwrap()}));
    println!("served round: {}", state["round"]);
}

fn assert_plan_read_surface(
    round: &mut ClosedRound, expected_round: &serde_json::Value, original_parts: &[serde_json::Value],
) -> serde_json::Value {
    use serde_json::{Value, json};
    let history = round.client.call("cadence_query", json!({"operation":"execution-history","phase":31,"plan":1}));
    let state = history["plans"][0]["state"].clone();
    assert_eq!(&state["round"], expected_round, "{history}");
    let index = round.client.call("cadence_query", json!({"operation":"execution-history","phase":31}));
    assert_eq!(index["plans"][0]["state"], state);
    assert!(serde_json::to_vec(&index).unwrap().len() <= index["bound"].as_u64().unwrap() as usize);
    let identity = json!({"kind":"phase-plan","phase":31,"plan":1});
    let index = round.client.call("cadence_query", json!({"operation":"document","identity":identity}));
    assert_eq!(index["parts"].as_array().unwrap().iter().filter(|part| part["part"] == "execution").count(), 1, "{index}");
    let document = round.client.call("cadence_query", json!({"operation":"document","identity":identity,"part":"execution"}));
    assert_eq!(serde_json::from_str::<Value>(document["body"].as_str().unwrap()).unwrap(), state);
    for original in original_parts {
        let current = round.client.call("cadence_query", json!({"operation":"document","identity":identity,"part":original["part"]}));
        assert_eq!(current, *original, "existing document parts stay unchanged");
    }
    let search = round.client.call("cadence_query", json!({"operation":"document-search","phase":31,"pattern":"round-tokens"}));
    assert!(search["hits"].as_array().unwrap().iter().any(|hit| hit["identity"] == identity && hit["part"] == "execution"), "{search}");
    state
}

#[test]
fn phase33_last_close_installs_binary_rendered_summary() {
    let mut round = ClosedRound::admitted();
    round.close_tasks();
    let path = round.fixture.project().join(".planning/phases/31/SUMMARY.md");
    assert!(path.exists(), "last close must install SUMMARY.md");
    let bytes = fs::read(&path).unwrap();
    let summary = String::from_utf8(bytes.clone()).unwrap();
    assert_eq!(round.closes[1]["summary"], serde_json::json!({"revision":format!("{:x}", Sha256::digest(&bytes))}));
    for (task, commit) in [("fixture-one-a", &round.commits[1]), ("fixture-one-b", &round.commits[2])] {
        assert_eq!(summary.lines().filter(|line| *line == format!("| 1 | {task} | completed | {commit} | passed |")).count(), 1);
    }
    for line in summary.lines().filter(|line| !line.trim().is_empty()) {
        assert!(round.client.request_lines.iter().all(|request| !request.contains(line)), "summary prose crossed the request boundary: {line}");
    }
    // A second observation sees the exact installed, untracked projection as clean.
    let source = round.client.call("cadence_query", serde_json::json!({"operation":"verification-read","phase":31}));
    assert_ne!(source["code"], "evidence-source-dirty", "{source}");
}
