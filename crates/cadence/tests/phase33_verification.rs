#[path = "support/phase31.rs"]
mod support;

use serde_json::{Value, json};
use support::ClosedRound;

#[test]
fn phase33_verify_next_answers_attempt_id_and_identities() {
    let mut round = ClosedRound::admitted();
    round.close_tasks();
    round.complete();
    let request = json!({"operation":"verify-next","phase":31,"request_id":"compact-attempt"});
    let answer = round.client.call("cadence_query", request.clone());
    assert_eq!(answer["status"], "ok", "{answer}");
    let mut keys = answer.as_object().unwrap().keys().map(String::as_str).collect::<Vec<_>>();
    keys.sort();
    assert_eq!(keys, ["attempt", "identities", "route", "status"]);
    let id = answer["attempt"]["id"].as_str().unwrap();
    assert_eq!(id.len(), 64);
    assert!(id.bytes().all(|b| b.is_ascii_hexdigit()));
    assert_eq!(answer["attempt"], json!({"schema":"verification-attempt-1","id":id,"request_id":"compact-attempt"}));
    let identity = json!({"kind":"verification-attempt","phase":31,"attempt":id});
    assert_eq!(answer["identities"], json!({"attempt":identity,"context":{"kind":"phase-context","phase":31},
        "plans":[{"kind":"phase-plan","phase":31,"plan":1}]}));
    let mut route_keys = answer["route"].as_object().unwrap().keys().map(String::as_str).collect::<Vec<_>>();
    route_keys.sort();
    assert_eq!(route_keys, ["choice", "inputs"]);
    assert_eq!(answer["route"]["choice"]["role"], "cad-verifier");
    assert!(serde_json::to_vec(&answer).unwrap().len() < 8192);
    assert_eq!(round.client.call("cadence_query", request), answer);
    let index = round.client.call("cadence_query", json!({"operation":"document","identity":identity}));
    assert_eq!(index["status"], "ok", "{index}");
    let mut bodies = std::collections::BTreeMap::new();
    for part in index["parts"].as_array().unwrap() {
        let slice = round.client.call("cadence_query", json!({"operation":"document","identity":identity,"part":part["part"]}));
        assert_eq!(slice["status"], "ok", "{slice}");
        assert!(slice["body"].as_str().unwrap().len() <= 24576);
        bodies.insert(part["part"].as_str().unwrap().to_owned(), slice["body"].as_str().unwrap().to_owned());
    }
    for name in ["basis", "truths", "publications", "admissions", "check:fixture/T4", "plan:1", "report"] {
        assert!(bodies.contains_key(name), "{name}");
    }
    let basis: Value = serde_json::from_str(&bodies["basis"]).unwrap();
    let root = round.fixture.project().join(".planning");
    let snapshot = cadence::context::persistence::read_snapshot(&root).unwrap().unwrap();
    let saved = cadence::verification::persistence::attempts(&snapshot.data).unwrap().pop().unwrap();
    assert_eq!(basis, json!(saved.inputs.basis));
    assert_eq!(saved.prompt, "");
    assert_eq!(saved.prompt_digest, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    for run in ["independent-run", "fixture-one-a-red"] {
        let launched = round.client.call("cadence_apply", json!({"operation":"verification-run","request":{
            "request_id":run,"attempt":id,"basis":basis,"item":round.check}}));
        assert_eq!(launched["status"], "ok", "{launched}");
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(30);
        loop {
            // The writer installs the log and snapshot separately. A read
            // racing that transaction has no coherent snapshot yet.
            if let Ok(Some(snapshot)) = cadence::context::persistence::read_snapshot(&root) {
                let records = cadence::verification::runner::records(&snapshot.data).unwrap();
                if cadence::verification::runner::result(&records, run).is_some() { break; }
            }
            assert!(std::time::Instant::now() < deadline);
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        let output = json!({"kind":"run-output","phase":31,"run":run});
        let index = round.client.call("cadence_query", json!({"operation":"document","identity":output}));
        if run == "fixture-one-a-red" { assert_eq!(index["code"], "document-ambiguous", "{index}"); }
        else {
            assert_eq!(index["status"], "ok", "{index}");
            let slice = round.client.call("cadence_query", json!({"operation":"document","identity":output,"part":"stderr:1"}));
            assert!(slice["body"].as_str().unwrap().contains("Ran 1 test"));
        }
    }
    let items = saved.inputs.map["items"].as_array().unwrap().iter().map(|item| json!({"id":item["id"],
        "item_revision":item["item_revision"],"verdict":"not_seen","observed":"The compact submission binds retained authority.","runs":[]})).collect::<Vec<_>>();
    let legacy = round.client.call("cadence_apply", json!({"operation":"verification-submit","patch":{
        "request_id":"fresh-basis","attempt":id,"basis":basis,"items":items}}));
    assert_eq!(legacy["rule"], "typed-content", "{legacy}");
    assert_eq!(legacy["slot"], "patch.basis");
    let patch = json!({"operation":"verification-submit","patch":{"request_id":"compact-patch","attempt":id,"items":items}});
    let submitted = round.client.call("cadence_apply", patch.clone());
    assert_eq!(submitted["status"], "ok", "{submitted}");
    assert_eq!(round.client.call("cadence_apply", patch), submitted);
    let historical = round.client.call("cadence_apply", json!({"operation":"verification-submit","patch":{
        "request_id":"compact-patch","attempt":id,"basis":basis,"items":items}}));
    assert_eq!(historical, submitted);
}

#[test]
fn phase33_run_output_reads_as_bounded_text_slices() {
    let mut round = ClosedRound::admitted();
    round.close_tasks_with_output();
    let root = round.fixture.project().join(".planning");
    let before = cadence::context::persistence::read_snapshot(&root).unwrap().unwrap();
    let records = cadence::execution::history::records(&before.data, 31).unwrap();
    for run in round.runs.clone() {
        let result = records.iter().find_map(|record| match &record.request.event {
            cadence::execution::history::Event::Result(result) if result.run_id == run => Some(result),
            _ => None,
        }).unwrap();
        let identity = json!({"kind":"run-output","phase":31,"run":run});
        let index = round.client.call("cadence_query", json!({"operation":"document","identity":identity}));
        assert_eq!(index["status"], "ok", "{index}");
        let parts = index["parts"].as_array().unwrap();
        assert_eq!(parts[0]["part"], "launch");
        assert_eq!(parts[1]["part"], "result");
        let mut stdout = String::new();
        let mut stderr = String::new();
        for (i, part) in parts.iter().enumerate() {
            let slice = round.client.call("cadence_query", json!({"operation":"document","identity":identity,"part":part["part"]}));
            assert_eq!(slice["status"], "ok", "{slice}");
            assert_eq!(slice["next"], parts.get(i + 1).map_or(Value::Null, |p| p["part"].clone()));
            let body = slice["body"].as_str().unwrap();
            assert!(body.len() <= 24576);
            let name = part["part"].as_str().unwrap();
            if name.starts_with("stdout:") { stdout.push_str(body); }
            else if name.starts_with("stderr:") { stderr.push_str(body); }
            else {
                let metadata: Value = serde_json::from_str(body).unwrap();
                if name == "result" {
                    assert!(metadata["request"]["event"]["stdout"].get("text").is_none());
                    assert!(metadata["request"]["event"]["stderr"].get("bytes").is_none());
                    assert_eq!(metadata["request"]["event"]["stdout"]["digest"], result.stdout.digest);
                }
            }
        }
        assert_eq!(stdout, String::from_utf8_lossy(&result.stdout.bytes));
        assert_eq!(stderr, String::from_utf8_lossy(&result.stderr.bytes));
        if run == "fixture-one-b-verify" {
            assert_eq!(result.stdout.bytes.len(), 65536);
            assert_eq!(parts.iter().filter(|p| p["part"].as_str().unwrap().starts_with("stdout:")).count(), 3);
            assert_eq!(parts.iter().filter(|p| p["part"].as_str().unwrap().starts_with("stderr:")).count(), 8);
        }
        let history = round.client.call("cadence_query", json!({"operation":"execution-history","phase":31,"run":run}));
        assert_eq!(history["identity"], identity);
        assert!(history["result"]["request"]["event"]["stdout"].get("text").is_none());
        assert!(history["result"]["request"]["event"]["stderr"].get("bytes").is_none());
    }
    let after = cadence::context::persistence::read_snapshot(&root).unwrap().unwrap();
    assert_eq!(before.data, after.data);
}
