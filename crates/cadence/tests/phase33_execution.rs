#[allow(dead_code)]
#[path = "support/phase31.rs"]
mod support;

use serde_json::{Value, json};
use support::{Caller, Client, ProcessFixture, git};
use std::collections::BTreeMap;

const PHASE: u32 = 31;
const COMMAND: &str = "python3 -B tests/tiny.py";

fn publish(client: &mut Client, operation: &str, submission: Value) {
    let draft = client.call("cadence_apply", json!({"operation":operation,"submission":submission}));
    assert_eq!(draft["status"], "ok", "{draft}");
    let answer = client.call("cadence_apply", json!({"operation":operation,"phase":PHASE,
        "approval":{"approved":true,"owner":"Fixture Owner","at":"2026-09-17T12:00:00Z",
            "submission_digest":draft["submission_digest"]}}));
    assert_eq!(answer["persisted"], true, "{answer}");
}

fn setup(client: &mut Client) -> (Value, Value) {
    publish(client, "context-submit", json!({"phase":PHASE,"title":"Dispatch identity",
        "scope":"Read dispatches through bounded typed parts.",
        "durable_decisions":[],"decisions":[],"assumptions":[],
        "truths":[{"id":"T1","trigger":"the worker reads its dispatch","observer":"the worker",
            "verb":"gets","outcome":"bounded typed parts","kind":"property",
            "observable":true,"fixed_oracle":true}]}));
    let allocation = client.call("cadence_query", json!({"operation":"plan-read","phase":PHASE,"count":1}));
    let content = json!({"phase":PHASE,"plan":1,"requirements":["T1"],
        "files":["src/lease.rs","tests/tiny.py"],"directories":[],
        "goal":"DISPATCH GOAL SENTINEL\n## Tasks\nThis is typed prose.",
        "context":"DISPATCH CONTEXT SENTINEL","notes":"é bounded notes\n".repeat(3000).trim_end(),
        "tasks":[
            {"id":"dispatch-a","title":"First task","files":["src/lease.rs","tests/tiny.py"],
                "action":"DISPATCH ACTION SENTINEL A","verify":[COMMAND]},
            {"id":"dispatch-b","title":"Second task","files":["src/lease.rs","tests/tiny.py"],
                "action":"DISPATCH ACTION SENTINEL B","verify":[COMMAND]}],
        "suite":COMMAND,"evidence_map":{"mode":"attached","items":[{
            "kind":"check","id":"dispatch/check","reason":"Observe dispatch parts.",
            "spec":{"command":COMMAND,"expected":{"kind":"property","value":"the test passes"},
                "test":{"file":"tests/tiny.py","function":"Tiny.test_ok"},
                "setup":"A real project.","call":"Read document parts.","boundary":"stdio","fakes":[]},
            "associations":[{"truth_id":"T1","truth_version":1,"reason":"Observe the worker read."}]
        }]}});
    publish(client, "plan-submit", json!({"phase":PHASE,"occurrence":allocation["occurrence"],
        "request_id":"dispatch-plan","inventory_basis":allocation["inventory"]["basis"],
        "plans":[{"target":allocation["targets"][0],"content":content}]}));
    let evidence = client.call("cadence_query", json!({"operation":"evidence-read","phase":PHASE}));
    let check = evidence["items"].as_array().unwrap().iter().find(|item| item["id"] == "dispatch/check").unwrap().clone();
    let readback = client.call("cadence_query", json!({"operation":"plan-read","phase":PHASE}));
    let plans = readback["native"]["publications"].as_object().unwrap();
    let admitted = client.call("cadence_apply", json!({"operation":"execution-admit","request":{
        "request_id":"dispatch-admit","expected_set_version":0,"contract":{
            "phase":PHASE,"occurrence":readback["occurrence"],
            "plans":plans.values().map(|p| json!({"plan":p["identity"]["plan"],
                "publication_request":p["publication_request"],"content_revision":p["revision"],
                "map_revision":p["map_revision"]})).collect::<Vec<_>>(),
            "allocation":[{"plan":1,"task":"dispatch-a","checks":[{"id":check["id"],"item_revision":check["item_revision"]}]},
                {"plan":1,"task":"dispatch-b","checks":[]}]}}}));
    assert_eq!(admitted["status"], "ok", "{admitted}");
    let authorized = client.call("cadence_apply", json!({"operation":"execution-authorize","phase":PHASE,
        "request_id":"dispatch-authorize","owner":"Fixture Owner","at":"2026-09-17T12:01:00Z",
        "response":"Proceed with fixture execution","disposition":"approve"}));
    assert_eq!(authorized["status"], "ok", "{authorized}");
    (content, check)
}

fn issue(client: &mut Client) -> Value {
    let answer = client.call("cadence_query", json!({"operation":"execute-next","phase":PHASE}));
    assert_eq!(answer["status"], "ok", "{answer}");
    answer
}

fn dispatch_id(answer: &Value) -> Value {
    answer.get("dispatch_id").unwrap_or(&answer["dispatch"]["id"]).clone()
}

#[test]
fn phase33_execute_next_answers_dispatch_id_and_route() {
    fn strings(value: &Value) {
        match value {
            Value::String(text) => {
                for sentinel in ["DISPATCH GOAL SENTINEL", "DISPATCH ACTION SENTINEL", "Cadence is the only project read surface."] {
                    assert!(!text.contains(sentinel), "dispatch leaked {sentinel}");
                }
            }
            Value::Array(values) => values.iter().for_each(strings),
            Value::Object(values) => values.values().for_each(strings),
            _ => {}
        }
    }
    let fixture = ProcessFixture::new();
    let mut client = Client::open(fixture.project());
    setup(&mut client);
    let answer = issue(&mut client);
    assert_eq!(answer.as_object().unwrap().keys().map(String::as_str).collect::<std::collections::BTreeSet<_>>(),
        std::collections::BTreeSet::from(["status", "outcome", "dispatch_id", "expected_execution_version", "route", "identities"]));
    assert_eq!(answer["outcome"], "dispatch");
    let id = answer["dispatch_id"].as_str().unwrap();
    assert_eq!(id.len(), 64);
    assert!(id.bytes().all(|byte| byte.is_ascii_hexdigit()));
    assert_eq!(answer["expected_execution_version"], 1);
    assert_eq!(answer["identities"], json!({"dispatch":{"kind":"dispatch","id":id},
        "plan":{"kind":"phase-plan","phase":PHASE,"plan":1},"context":{"kind":"phase-context","phase":PHASE}}));
    assert_eq!(answer["route"].as_object().unwrap().keys().map(String::as_str).collect::<std::collections::BTreeSet<_>>(),
        std::collections::BTreeSet::from(["choice", "inputs"]));
    assert!(answer["route"]["choice"]["agent"].is_string());
    let bytes = serde_json::to_vec(&answer).unwrap();
    assert!(bytes.len() < 8192);
    strings(&answer);
    assert_eq!(bytes, serde_json::to_vec(&issue(&mut client)).unwrap());
    let history = client.call("cadence_query", json!({"operation":"execution-history","phase":PHASE}));
    assert!(history["active"].get("prompt").is_none());
    assert!(history["active"].get("prompt_digest").is_none());
    client.finish();
}

fn parts(client: &mut Client, identity: Value) -> BTreeMap<String, String> {
    let mut a = Caller::new(0);
    let mut b = Caller::new(1);
    let args = json!({"operation":"document","identity":identity});
    let ra = client.send_call(&mut a, "cadence_query", args.clone());
    let rb = client.send_call(&mut b, "cadence_query", args);
    let ib = client.receive_call(rb);
    let ia = client.receive_call(ra);
    assert_eq!(ia["status"], "ok", "{ia}");
    assert_eq!(ia, ib);
    let mut found = BTreeMap::new();
    for part in ia["parts"].as_array().unwrap() {
        assert!(part["bytes"].as_u64().unwrap() <= 24_576);
        let args = json!({"operation":"document","identity":identity,"part":part["part"]});
        let ra = client.send_call(&mut a, "cadence_query", args.clone());
        let rb = client.send_call(&mut b, "cadence_query", args);
        let sb = client.receive_call(rb);
        let sa = client.receive_call(ra);
        assert_eq!(sa["status"], "ok", "{sa}");
        assert_eq!(sa, sb);
        let body = sa["body"].as_str().unwrap();
        assert!(body.len() <= 24_576);
        assert!(found.insert(part["part"].as_str().unwrap().to_owned(), body.to_owned()).is_none());
    }
    found
}

#[test]
fn phase33_dispatch_reads_by_id_as_bounded_parts() {
    let fixture = ProcessFixture::new();
    let mut client = Client::open(fixture.project());
    let (content, check) = setup(&mut client);
    let first = issue(&mut client);
    let history = client.call("cadence_query", json!({"operation":"execution-history","phase":PHASE}));
    assert_eq!(dispatch_id(&first), history["active"]["id"]);
    let repeat = issue(&mut client);
    assert_eq!(dispatch_id(&first), dispatch_id(&repeat));
    let found = parts(&mut client, json!({"kind":"dispatch","id":dispatch_id(&first)}));
    for slot in ["goal", "context"] { assert_eq!(found[slot], content[slot].as_str().unwrap()); }
    let mut notes = found["notes"].clone();
    let mut continuation = 2;
    while let Some(body) = found.get(&format!("notes:{continuation}")) {
        notes.push_str(body);
        continuation += 1;
    }
    assert!(continuation > 2);
    assert_eq!(notes, content["notes"].as_str().unwrap());
    for slot in ["identity", "completed", "continuation", "suite", "lease", "commands", "policy", "route"] {
        assert!(found.contains_key(slot), "missing {slot}");
    }
    assert_eq!(found.keys().filter(|key| key.starts_with("task:")).count(), 2);
    for task in content["tasks"].as_array().unwrap() {
        let part: Value = serde_json::from_str(&found[&format!("task:{}", task["id"].as_str().unwrap())]).unwrap();
        for slot in ["title", "files", "action", "verify"] { assert_eq!(part[slot], task[slot]); }
        assert!(part["state"].is_object());
        assert!(part["checkpoints"].is_array());
    }
    assert_eq!(found.keys().filter(|key| key.starts_with("check:")).count(), 1);
    let delivered: Value = serde_json::from_str(&found["check:dispatch/check"]).unwrap();
    assert_eq!(delivered["spec"], content["evidence_map"]["items"][0]["spec"]);
    assert_eq!(delivered["item_revision"], check["item_revision"]);
    assert_eq!(delivered["task"], "dispatch-a");
    let plan = parts(&mut client, json!({"kind":"phase-plan","phase":PHASE,"plan":1}));
    assert_eq!(plan["goal"], found["goal"]);
    assert_eq!(plan["context"], found["context"]);
    assert_eq!(plan["notes:2"], found["notes:2"]);
    let item: Value = serde_json::from_str(&plan["evidence:dispatch/check"]).unwrap();
    assert_eq!(item, content["evidence_map"]["items"][0]);
    client.finish();
}

#[test]
fn phase33_superseded_dispatch_read_names_the_changed_part() {
    let fixture = ProcessFixture::new();
    let project = fixture.project();
    let mut client = Client::open(project);
    setup(&mut client);
    let old = dispatch_id(&issue(&mut client));
    let history = client.call("cadence_query", json!({"operation":"execution-history","phase":PHASE}));
    let task = history["tasks"].as_array().unwrap().iter().find(|t| t["task"]["task"] == "dispatch-b").unwrap()["task"].clone();
    let started = client.call("cadence_apply", json!({"operation":"execution-task-start","request":{
        "request_id":"start-b","task":task,"attempt":"b1","expected_version":0,"predecessor":null,"checks":[]}}));
    assert_eq!(started["status"], "ok", "{started}");
    // A live attempt changes the view, not the issued binding.
    let live = client.call("cadence_query", json!({"operation":"document","identity":{"kind":"dispatch","id":old}}));
    assert_eq!(live["status"], "ok", "{live}");
    std::fs::write(project.join("src/lease.rs"), "pub fn lease_needle() -> u32 { 33 }\n").unwrap();
    git(project, &["add", "src/lease.rs"]);
    git(project, &["-c", "commit.gpgsign=false", "-c", "user.name=Cadence Phase31", "-c", "user.email=phase31@example.invalid", "commit", "-S", "-m", "feat(read): finish dispatch-b"]);
    let completion = git(project, &["rev-parse", "HEAD"]);
    let launched = client.call("cadence_apply", json!({"operation":"execution-run","request":{
        "request_id":"verify-b","task":task,"attempt":"b1","expected_version":1,
        "command":COMMAND,"check":null,"stage":"verify"}}));
    assert_eq!(launched["status"], "ok", "{launched}");
    client.wait_for_event(PHASE, "verify-b");
    let history = client.call("cadence_query", json!({"operation":"execution-history","phase":PHASE}));
    let state = history["tasks"].as_array().unwrap().iter().find(|t| t["task"] == task).unwrap();
    let closed = client.call("cadence_apply", json!({"operation":"execution-task-close","request":{
        "request_id":"close-b","task":task,"attempt":"b1","expected_version":state["state"]["version"],
        "completion":completion,"checks":[],"verification":["verify-b"]}}));
    assert_eq!(closed["status"], "ok", "{closed}");
    let current = dispatch_id(&issue(&mut client));
    assert_ne!(old, current);
    let stale = client.call("cadence_query", json!({"operation":"document","identity":{"kind":"dispatch","id":old}}));
    assert_eq!(stale["status"], "refused", "{stale}");
    assert_eq!(stale["code"], "dispatch-superseded", "{stale}");
    assert_eq!(stale["slot"], "task:dispatch-b", "{stale}");
    assert!(stale["value"].to_string().contains(current.as_str().unwrap()), "{stale}");
    let found = parts(&mut client, json!({"kind":"dispatch","id":current}));
    assert!(!found.contains_key("task:dispatch-b"));
    assert!(found.contains_key("task:dispatch-a"));
    client.finish();
}
