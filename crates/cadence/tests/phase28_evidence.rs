//! Acceptance checks cross the real stdio, policy, journal and filesystem boundary.
use cadence::store::{
    model::{self, Snapshot},
    writer::{Operation, Store},
};
use serde_json::{Value, json};
use std::{
    collections::BTreeMap,
    fs,
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
};

struct Client {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<std::process::ChildStdout>,
}

impl Client {
    fn open(project: &Path) -> Self {
        let mut child = Command::new(env!("CARGO_BIN_EXE_cadence"))
            .args(["serve", "--project-root", project.to_str().unwrap()])
            .env("CADENCE_GLOBAL_CONFIG", "")
            .current_dir(project)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .unwrap();
        let mut client = Self {
            stdin: child.stdin.take().unwrap(),
            stdout: BufReader::new(child.stdout.take().unwrap()),
            child,
        };
        client.send(
            json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{
            "protocolVersion":"2025-06-18","capabilities":{},
            "clientInfo":{"name":"phase28-check","version":"1"}}}),
        );
        assert!(client.recv()["result"]["serverInfo"].is_object());
        client.send(json!({"jsonrpc":"2.0","method":"notifications/initialized"}));
        client
    }
    fn send(&mut self, value: Value) {
        writeln!(self.stdin, "{value}").unwrap();
        self.stdin.flush().unwrap();
    }
    fn recv(&mut self) -> Value {
        let mut line = String::new();
        assert!(self.stdout.read_line(&mut line).unwrap() > 0);
        serde_json::from_str(&line).unwrap()
    }
    fn call(&mut self, tool: &str, arguments: Value) -> Value {
        self.send(json!({"jsonrpc":"2.0","id":2,"method":"tools/call",
            "params":{"name":tool,"arguments":arguments}}));
        let response = self.recv();
        assert!(response.get("error").is_none(), "{response}");
        assert_ne!(response["result"]["isError"], true, "{response}");
        let result = response["result"]["structuredContent"].clone();
        let text: String = response["result"]["content"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|b| b["type"] == "text")
            .map(|b| b["text"].as_str().unwrap())
            .collect();
        assert_eq!(result, serde_json::from_str::<Value>(&text).unwrap());
        result
    }
    fn read(&mut self, phase: &str, count: Option<u32>) -> Value {
        self.call(
            "cadence_query",
            json!({"operation":"plan-read","phase_address":phase,"count":count}),
        )
    }
    fn finish(mut self) {
        drop(self.stdin);
        assert!(self.child.wait().unwrap().success());
    }
}

fn approve(mut request: Value) -> Value {
    request["approval"] = json!({"approved":true,"owner":"John Crenshaw",
        "at":"2026-09-10T14:00:00Z","submission":request["submission"].clone()});
    request
}

fn fixture() -> tempfile::TempDir {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join(".planning");
    fs::create_dir_all(root.join("phases/27")).unwrap();
    fs::write(
        root.join("ROADMAP.md"),
        "## Phases\n- [ ] **Phase 27: Plan publication**\n- [ ] **Phase 28: Next phase**\n",
    )
    .unwrap();
    fs::write(
        root.join("config.json"),
        serde_json::to_vec(&json!({"review":{"triggers":{
        "risk_surface":{"surfaces":cadence::rail::risk::CATEGORIES}}}}))
        .unwrap(),
    )
    .unwrap();
    temp
}

fn native_context(project: &Path, phase: u32, ids: &[&str]) {
    let mut client = Client::open(project);
    let answer = client.call(
        "cadence_apply",
        approve(json!({"operation":"context-submit","submission":{
        "phase":phase,"title":"Plan publication","scope":"Approved plans only.",
        "durable_decisions":[],"decisions":[],"assumptions":[],
        "truths":ids.iter().map(|id| json!({"id":id,"trigger":"the sender sends the parcel","observer":"the recipient",
            "verb":"gets","outcome":"the parcel from the sender","kind":"property",
            "observable":true,"fixed_oracle":true})).collect::<Vec<_>>()}})),
    );
    assert_eq!(answer["persisted"], true, "native context setup: {answer}");
    client.finish();
}

fn request(preview: &Value, phase: u32, id: &str, bodies: &[&str]) -> Value {
    json!({"operation":"plan-submit","submission":{
        "phase":phase,"occurrence":preview["occurrence"],"request_id":id,
        "inventory_basis":preview["inventory"]["basis"],
        "plans":bodies.iter().enumerate().map(|(i,body)| json!({
            "target":preview["targets"][i],"content":{
                "phase":phase,"plan":preview["targets"][i]["plan"],
                "requirements":["T1"],"files":["src/shared.txt"],"directories":["src/extra"],
                "execution":{"schema":1,"suite":"printf suite","tasks":[{"id":"task-1","verify":["printf verified"]}]},
                "body":body,"evidence_map":{"mode":"provisional"}}})).collect::<Vec<_>>()}})
}

fn snapshot(project: &Path) -> Snapshot {
    let root = project.join(".planning");
    Snapshot::parse(
        &fs::read(root.join(model::STATE)).unwrap(),
        &fs::read(root.join(model::ITEMS)).unwrap(),
        &fs::read(root.join(model::DECISIONS)).unwrap(),
    )
    .unwrap()
}

fn tree(project: &Path) -> BTreeMap<PathBuf, Option<Vec<u8>>> {
    fn visit(base: &Path, path: &Path, found: &mut BTreeMap<PathBuf, Option<Vec<u8>>>) {
        let meta = fs::symlink_metadata(path).unwrap();
        let relative = path.strip_prefix(base).unwrap().to_path_buf();
        if meta.file_type().is_symlink() {
            found.insert(
                relative,
                Some(
                    fs::read_link(path)
                        .unwrap()
                        .as_os_str()
                        .as_encoded_bytes()
                        .to_vec(),
                ),
            );
        } else if meta.is_dir() {
            found.insert(relative, None);
            for entry in fs::read_dir(path).unwrap() {
                visit(base, &entry.unwrap().path(), found);
            }
        } else {
            found.insert(relative, Some(fs::read(path).unwrap()));
        }
    }
    let mut found = BTreeMap::new();
    visit(project, &project.join(".planning"), &mut found);
    if project.join(".planning/state.json").exists() {
        snapshot(project);
    }
    found
}

fn reopened(project: &Path) -> cadence::store::writer::View {
    // Inspect the journal before a writer can perform recovery.
    assert!(!project.join(".planning/.store-intent.json").exists());
    snapshot(project);
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let store = Store::open(
            cadence::store::filesystem::Filesystem::new(project.join(".planning")).unwrap(),
            cadence::store::writer::PlanningPolicy,
        )
        .await
        .unwrap();
        store.request(Operation::ReadVerified).await.unwrap()
    })
}

fn assert_refusal(answer: &Value, rule: &str, id: &str) {
    assert_eq!(answer["status"], "refused", "{answer}");
    assert_eq!(answer["rule"], rule, "{answer}");
    assert_eq!(answer["phase"], 27, "{answer}");
    assert_eq!(answer["id"], id, "{answer}");
}

fn publish(client: &mut Client, input: &Value) -> Value {
    let completed = preview(client, input);
    let approved = approve(final_request(&completed));
    let answer = client.call("cadence_apply", approved);
    assert_eq!(answer["persisted"], true, "{answer}");
    answer
}

#[test]
fn phase28_uncovered_current_truth_is_refused() {
    for map in [attached(vec![check("one", "T1")]), attached(vec![])] {
        let temp = fixture();
        let project = temp.path();
        native_context(project, 27, &["T1", "truth/full/T2"]);
        let before = tree(project);
        let prior = snapshot(project);
        let mut client = Client::open(project);
        let input = proposal(&mut client, "uncovered", std::slice::from_ref(&map), &["# Proposed\n"]);
        let missing = if map["items"].as_array().unwrap().is_empty() { "T1" } else { "truth/full/T2" };
        let answer = preview(&mut client, &input);
        assert_refusal(&answer, "uncovered-truth", missing);
        let answer = client.call("cadence_apply", approve(input));
        assert_refusal(&answer, "uncovered-truth", missing);
        client.finish();
        assert_unchanged(project, &before, &prior);
    }

    let temp = fixture();
    let project = temp.path();
    native_context(project, 27, &["T1", "truth/full/T2"]);
    let before = tree(project);
    let prior = snapshot(project);
    let mut client = Client::open(project);
    let split = proposal(&mut client, "split", &[
        attached(vec![check("one", "T1")]),
        attached(vec![check("two", "truth/full/T2")]),
    ], &["# First\n", "# Second\n"]);
    let previewed = preview(&mut client, &split);
    let approved = approve(final_request(&previewed));
    client.finish();
    assert_unchanged(project, &before, &prior);
    let mut client = Client::open(project);
    let published = client.call("cadence_apply", approved);
    assert_eq!(published["persisted"], true, "{published}");
    assert_eq!(published["results"].as_array().unwrap().len(), 2);
    client.finish();
    let before = tree(project);
    let prior = reopened(project).snapshot;
    let old = fs::read_to_string(project.join(".planning/phases/27/PLAN-2.md")).unwrap();
    let mut client = Client::open(project);
    let removes_t2 = replacement(&mut client, "removes-t2", 2, &published["results"][1], &old,
        attached(vec![]), "# Replacement\n");
    assert_refusal(&preview(&mut client, &removes_t2), "uncovered-truth", "truth/full/T2");
    assert_refusal(&client.call("cadence_apply", approve(removes_t2)), "uncovered-truth", "truth/full/T2");
    client.finish();
    assert_unchanged(project, &before, &prior);

    let mut client = Client::open(project);
    let gap = proposal(&mut client, "gap", &[attached(vec![artifact("gap-address", &["T1"])])], &["# Gap\n"]);
    let gap = publish(&mut client, &gap);
    assert_eq!(gap["results"][0]["identity"], json!({"phase":27,"plan":3}));
    assert_eq!(gap["results"][0]["content"]["evidence_map"]["items"].as_array().unwrap().len(), 1);
    client.finish();
    let saved = reopened(project).snapshot;
    assert_eq!(saved.data["acceptance_maps"]["phases"]["27"]["revisions"].as_array().unwrap().len(), 3);
    assert_eq!(saved.data["plan_publications"]["phases"]["27"]["publications"]["1"], published["results"][0]);
    assert_eq!(saved.data["plan_publications"]["phases"]["27"]["publications"]["2"], published["results"][1]);

    // Provisional removal is not a validated map. Its missing coverage remains visible.
    let mut client = Client::open(project);
    let provisional = replacement(&mut client, "provisional-removal", 2, &published["results"][1], &old,
        json!({"mode":"provisional"}), "# Provisional replacement\n");
    let complete = preview(&mut client, &provisional);
    assert_eq!(complete["coverage"]["uncovered"], json!(["truth/full/T2"]));
    let provisional = client.call("cadence_apply", approve(final_request(&complete)));
    assert_eq!(provisional["persisted"], true, "{provisional}");
    assert_eq!(provisional["coverage"]["uncovered"], json!(["truth/full/T2"]));
    client.finish();
    let before = tree(project);
    let prior = reopened(project).snapshot;
    let mut client = Client::open(project);
    let stale_history = proposal(&mut client, "old-cannot-cover", &[attached(vec![])], &["# Gap\n"]);
    assert_refusal(&preview(&mut client, &stale_history), "uncovered-truth", "truth/full/T2");
    assert_refusal(&client.call("cadence_apply", approve(stale_history)), "uncovered-truth", "truth/full/T2");
    client.finish();
    assert_unchanged(project, &before, &prior);
}

#[test]
fn phase28_current_truth_without_check_is_refused() {
    for supplementary in [
        vec![artifact("address", &["T2"])],
        vec![observation("O1", &["T2"])],
        vec![link("handoff", "T2")],
        vec![artifact("address", &["T2"]), observation("O1", &["T2"])],
    ] {
        let temp = fixture();
        let project = temp.path();
        native_context(project, 27, &["T1", "T2"]);
        let before = tree(project);
        let prior = snapshot(project);
        let mut items = vec![check("one", "T1")];
        items.extend(supplementary);
        let mut client = Client::open(project);
        let input = proposal(&mut client, "no-check", &[attached(items.clone())], &["# Supplementary\n"]);
        assert_refusal(&preview(&mut client, &input), "truth-without-check", "T2");
        assert_refusal(&client.call("cadence_apply", approve(input)), "truth-without-check", "T2");
        client.finish();
        assert_unchanged(project, &before, &prior);
        items.push(check("two", "T2"));
        let mut client = Client::open(project);
        let corrected = proposal(&mut client, "corrected", &[attached(items.clone())], &["# Has a check\n"]);
        let published = publish(&mut client, &corrected);
        client.finish();
        let saved = reopened(project).snapshot;
        assert_eq!(saved.data["acceptance_maps"]["phases"]["27"]["revisions"][0]["items"], json!(items));
        assert_eq!(saved.data["plan_publications"]["phases"]["27"]["publications"]["1"], published["results"][0]);
    }

    let temp = fixture();
    let project = temp.path();
    native_context(project, 27, &["T1", "T2"]);
    let mut client = Client::open(project);
    let first = proposal(&mut client, "checks", &[attached(vec![check("one", "T1"), check("two", "T2")])], &["# Both checks\n"]);
    let first = publish(&mut client, &first);
    client.finish();
    reopened(project);
    let mut client = Client::open(project);
    let second = proposal(&mut client, "artifact", &[attached(vec![artifact("address", &["T2"])])], &["# Uses the saved check\n"]);
    let second = publish(&mut client, &second);
    client.finish();
    let before = tree(project);
    let prior = reopened(project).snapshot;
    let old = fs::read_to_string(project.join(".planning/phases/27/PLAN-1.md")).unwrap();
    let mut client = Client::open(project);
    let removes_check = replacement(&mut client, "removes-check", 1, &first["results"][0], &old,
        attached(vec![check("one", "T1")]), "# T2 artifact survives in the other plan\n");
    assert_refusal(&preview(&mut client, &removes_check), "truth-without-check", "T2");
    assert_refusal(&client.call("cadence_apply", approve(removes_check)), "truth-without-check", "T2");
    client.finish();
    assert_unchanged(project, &before, &prior);
    assert_eq!(prior.data["plan_publications"]["phases"]["27"]["publications"]["2"], second["results"][0]);
    let mut client = Client::open(project);
    let corrected = replacement(&mut client, "retains-check", 1, &first["results"][0], &old,
        attached(vec![check("one", "T1"), check("two", "T2")]), "# Both checks retained\n");
    publish(&mut client, &corrected);
    client.finish();
    let saved = reopened(project).snapshot;
    assert_eq!(saved.data["acceptance_maps"]["phases"]["27"]["revisions"].as_array().unwrap().len(), 3);
    assert_eq!(saved.data["plan_publications"]["phases"]["27"]["publications"]["2"], second["results"][0]);
}

#[test]
fn phase28_item_without_bound_truth_is_refused() {
    for case in ["empty", "unknown", "other-phase", "mixed", "duplicate", "blank-id", "item-reason", "association-reason"] {
        let temp = fixture();
        let project = temp.path();
        native_context(project, 27, &["T1", "parcel/T2"]);
        native_context(project, 28, &["elsewhere/T2"]);
        let before = tree(project);
        let prior = snapshot(project);
        let mut item = artifact("opaque/item/T2", &["parcel/T2"]);
        let (rule, slot, requested) = match case {
            "empty" => {
                item["associations"] = json!([]);
                ("evidence-item-truth", "associations", None)
            }
            "unknown" => {
                item["associations"][0]["truth_id"] = json!("unknown/T2");
                ("evidence-item-truth", "associations[0].truth_id", Some("unknown/T2"))
            }
            "other-phase" => {
                item["associations"][0]["truth_id"] = json!("elsewhere/T2");
                ("evidence-item-truth", "associations[0].truth_id", Some("elsewhere/T2"))
            }
            "mixed" => {
                item["associations"].as_array_mut().unwrap().push(json!({"truth_id":"unknown/T2","truth_version":1,"reason":"No suffix matching."}));
                ("evidence-item-truth", "associations[1].truth_id", Some("unknown/T2"))
            }
            "duplicate" => ("duplicate-evidence-item", "id", None),
            "blank-id" => {
                item["id"] = json!("  ");
                ("evidence-item-shape", "id", None)
            }
            "item-reason" => {
                item["reason"] = json!(" ");
                ("evidence-item-shape", "reason", None)
            }
            "association-reason" => {
                item["associations"][0]["reason"] = json!("");
                ("evidence-item-shape", "associations[0].reason", None)
            }
            _ => unreachable!(),
        };
        let id = item["id"].as_str().unwrap().to_owned();
        let mut items = vec![check("one", "T1"), check("two", "parcel/T2"), item.clone()];
        let index = if case == "duplicate" { items.push(item); 3 } else { 2 };
        let mut client = Client::open(project);
        let input = proposal(&mut client, "invalid-edge", &[attached(items)], &["# Membership\n"]);
        for answer in [preview(&mut client, &input), client.call("cadence_apply", approve(input))] {
            assert_refusal(&answer, rule, &id);
            assert_eq!(answer["entry"], 0);
            assert_eq!(answer["slot"], format!("submission.plans[0].content.evidence_map.items[{index}].{slot}"));
            if let Some(requested) = requested {
                assert!(answer["reason"].as_str().unwrap().contains(requested), "{answer}");
            }
        }
        client.finish();
        assert_unchanged(project, &before, &prior);
        let mut client = Client::open(project);
        let corrected = proposal(&mut client, "corrected", &[attached(vec![
            check("one", "T1"), check("two", "parcel/T2"), artifact("opaque/item/T2", &["parcel/T2"]),
        ])], &["# Corrected\n"]);
        publish(&mut client, &corrected);
        client.finish();
        let saved = reopened(project).snapshot;
        assert_eq!(saved.data["acceptance_maps"]["phases"]["27"]["revisions"][0]["items"][2],
            artifact("opaque/item/T2", &["parcel/T2"]));
    }

    let temp = fixture();
    let project = temp.path();
    native_context(project, 27, &["T1", "parcel/T2"]);
    let shared_one = artifact("shared/opaque", &["T1"]);
    let mut shared_two = artifact("shared/opaque", &["parcel/T2"]);
    shared_two["associations"][0]["reason"] = json!("This second contribution needs the same destination.");
    let maps = [attached(vec![check("one", "T1"), shared_one.clone()]),
        attached(vec![check("two", "parcel/T2"), shared_two.clone()])];
    let before = tree(project);
    let prior = snapshot(project);
    let mut client = Client::open(project);
    let mut conflicting = maps.clone();
    conflicting[1]["items"][1]["spec"]["substance"] = json!("A conflicting destination.");
    let bad = proposal(&mut client, "conflict", &conflicting, &["# First\n", "# Second\n"]);
    for answer in [preview(&mut client, &bad), client.call("cadence_apply", approve(bad))] {
        assert_refusal(&answer, "evidence-item-conflict", "shared/opaque");
        assert_eq!(answer["entry"], 1);
        assert_eq!(answer["slot"], "submission.plans[1].content.evidence_map.items[1].id");
        for origin in ["plan 1", "plan 2"] { assert!(answer["reason"].as_str().unwrap().contains(origin), "{answer}"); }
    }
    client.finish();
    assert_unchanged(project, &before, &prior);
    let mut client = Client::open(project);
    let corrected = proposal(&mut client, "shared", &maps, &["# First\n", "# Second\n"]);
    let original = publish(&mut client, &corrected);
    client.finish();
    let saved = reopened(project).snapshot;
    let events = &saved.data["acceptance_maps"]["phases"]["27"]["revisions"];
    assert_eq!(events[0]["items"][1], shared_one);
    assert_eq!(events[1]["items"][1], shared_two);
    assert_eq!(events[0]["item_revisions"]["shared/opaque"], events[1]["item_revisions"]["shared/opaque"]);

    let before = tree(project);
    let mut client = Client::open(project);
    let bad = proposal(&mut client, "saved-conflict", &[conflicting[1].clone()], &["# Conflicting gap\n"]);
    for answer in [preview(&mut client, &bad), client.call("cadence_apply", approve(bad))] {
        assert_refusal(&answer, "evidence-item-conflict", "shared/opaque");
        for origin in ["plan 1", "plan 3"] { assert!(answer["reason"].as_str().unwrap().contains(origin), "{answer}"); }
    }
    client.finish();
    assert_unchanged(project, &before, &saved);

    // A coordinated replacement can revise the stable id once no conflicting
    // definition survives in the resulting current set. Prior definitions stay.
    let old_one = fs::read_to_string(project.join(".planning/phases/27/PLAN-1.md")).unwrap();
    let old_two = fs::read_to_string(project.join(".planning/phases/27/PLAN-2.md")).unwrap();
    let mut revised_maps = maps.clone();
    for map in &mut revised_maps { map["items"][1]["spec"]["substance"] = json!("The newly approved destination."); }
    let mut client = Client::open(project);
    let mut left = replacement(&mut client, "revised-shared", 1, &original["results"][0], &old_one,
        revised_maps[0].clone(), "# Revised first\n");
    let right = replacement(&mut client, "revised-shared", 2, &original["results"][1], &old_two,
        revised_maps[1].clone(), "# Revised second\n");
    left["submission"]["plans"].as_array_mut().unwrap().push(right["submission"]["plans"][0].clone());
    publish(&mut client, &left);
    client.finish();
    let reopened = reopened(project).snapshot;
    let revised = &reopened.data["acceptance_maps"]["phases"]["27"]["revisions"];
    assert_eq!(revised.as_array().unwrap().len(), 4);
    assert_eq!(revised[0], events[0]);
    assert_eq!(revised[1], events[1]);
    assert_eq!(revised[2]["items"][1]["spec"]["substance"], "The newly approved destination.");
    assert_eq!(revised[2]["item_revisions"]["shared/opaque"], revised[3]["item_revisions"]["shared/opaque"]);
    assert_ne!(revised[2]["item_revisions"]["shared/opaque"], events[0]["item_revisions"]["shared/opaque"]);
}

fn attached(items: Vec<Value>) -> Value {
    json!({"mode":"attached","items":items})
}

fn check(id: &str, truth: &str) -> Value {
    json!({"id":id,"kind":"check","reason":"Dropping the delivery loses the parcel.",
        "spec":{"command":"cargo test parcel -- --exact",
            "expected":{"kind":"property","value":"1 passed; 0 failed; the recipient gets the submitted parcel."},
            "test":{"file":"tests/parcel.rs","function":"parcel"},
            "setup":"Prepare a real sender and recipient.","call":"Send the parcel.",
            "boundary":"Real delivery and recipient.","fakes":["clock"]},
        "associations":[{"truth_id":truth,"truth_version":1,"reason":"This causes the promised delivery."}]})
}

fn artifact(id: &str, truths: &[&str]) -> Value {
    json!({"id":id,"kind":"artifact","reason":"Removing the address loses the delivery.",
        "spec":{"locators":["src/address.rs","Address"],"substance":"A usable destination."},
        "associations":truths.iter().map(|truth| json!({"truth_id":truth,"truth_version":1,
            "reason":"The recipient needs this destination."})).collect::<Vec<_>>()})
}

fn observation(id: &str, truths: &[&str]) -> Value {
    json!({"id":id,"kind":"observation","reason":"A real host must witness the delivery.",
        "spec":{"episode":"The owner sees a real delivery.",
            "specification":{"source":"O1","document":"CONTEXT.md","approved_by":"John Crenshaw",
                "approved_at":"2026-09-10"},"status":"pending"},
        "associations":truths.iter().map(|truth| json!({"truth_id":truth,"truth_version":1,
            "reason":"Host delivery remains supplementary."})).collect::<Vec<_>>()})
}

fn link(id: &str, truth: &str) -> Value {
    json!({"id":id,"kind":"link","reason":"Losing the parcel breaks the handoff.",
        "spec":{"caller":"sender","callee":"recipient","value":"parcel"},
        "associations":[{"truth_id":truth,"truth_version":1,"reason":"The truth names this parcel."}]})
}

fn proposal(client: &mut Client, id: &str, maps: &[Value], bodies: &[&str]) -> Value {
    let allocation = client.read("27", Some(maps.len() as u32));
    assert_eq!(allocation["status"], "ok", "{allocation}");
    let mut input = request(&allocation, 27, id, bodies);
    for (entry, map) in input["submission"]["plans"].as_array_mut().unwrap().iter_mut().zip(maps) {
        entry["content"]["evidence_map"] = map.clone();
    }
    input
}

fn preview(client: &mut Client, input: &Value) -> Value {
    client.call("cadence_query", json!({"operation":"plan-read","phase_address":"27",
        "submission":input["submission"]}))
}

fn final_request(preview: &Value) -> Value {
    assert_eq!(preview["status"], "ok", "complete preview: {preview}");
    assert_eq!(preview["persisted"], false);
    json!({"operation":"plan-submit","submission":preview["submission"]})
}

fn replacement(client: &mut Client, id: &str, number: u32, old: &Value, old_document: &str,
    map: Value, body: &str) -> Value {
    let mut input = proposal(client, id, &[map], &[body]);
    let entry = &mut input["submission"]["plans"][0];
    entry["target"]["plan"] = json!(number);
    entry["content"]["plan"] = json!(number);
    entry["replacement"] = json!({"approved":true,"owner":"John Crenshaw",
        "at":"2026-09-10T15:00:00Z","target":entry["target"],
        "old_revision":old["revision"],"old_document":old_document,"content":entry["content"]});
    input
}

fn assert_unchanged(project: &Path, before: &BTreeMap<PathBuf, Option<Vec<u8>>>, prior: &Snapshot) {
    assert_eq!(&tree(project), before);
    assert_eq!(&snapshot(project), prior);
}

#[test]
fn phase28_accepted_map_is_attached_to_published_plan() {
    for (prefix, suffix, reverse, replace) in [
        ("# Plan café\n\n", "## Tasks\nDo the work.\n", false, false),
        ("# Plan 日本語\r\n\r\n", "## Tasks\r\nDo the work.", true, false),
        ("# Replacement\n\n", "## Tasks\nPreserved outside bytes.\n\n", false, true),
        ("# Without tasks\n~~~\n## Evidence map\nExample only.\n~~~\n", "", true, false),
    ] {
        let temp = fixture();
        let project = temp.path();
        native_context(project, 27, &["T1", "parcel/日本語"]);
        let mut client = Client::open(project);
        let original = if replace {
            let input = proposal(&mut client, "provisional", &[json!({"mode":"provisional"})],
                &["# Old plan\n\n## Evidence map\nOpaque prose is not authority.\n\n## Tasks\nOld work.\n"]);
            let result = client.call("cadence_apply", approve(input));
            assert_eq!(result["persisted"], true, "{result}");
            Some(result["results"][0].clone())
        } else { None };
        client.finish();
        let before = tree(project);
        let prior = snapshot(project);
        let mut items = vec![
            check("check-one", "T1"), check("検証/opaque", "parcel/日本語"),
            artifact("shared/住所", &["T1", "parcel/日本語"]),
            link("parcel-link", "parcel/日本語"),
            observation("O1/shared", &["T1", "parcel/日本語"]),
        ];
        if reverse { items.reverse(); }
        let map = attached(items.clone());
        let body = format!("{prefix}{suffix}");
        let mut client = Client::open(project);
        let old_document = original.as_ref().map(|_| fs::read_to_string(project.join(".planning/phases/27/PLAN-1.md")).unwrap());
        let input = if let Some(old) = &original {
            replacement(&mut client, "attached", 1, old, old_document.as_ref().unwrap(), map.clone(), &body)
        } else {
            proposal(&mut client, "attached", std::slice::from_ref(&map), &[&body])
        };
        let complete = preview(&mut client, &input);
        let normalized = final_request(&complete);
        assert_eq!(complete["readiness"], "provisional-authoring");
        assert_eq!(normalized["submission"]["plans"][0]["content"]["evidence_map"], map);
        let section = complete["documents"][0]["section"].as_str().unwrap();
        let rendered = normalized["submission"]["plans"][0]["content"]["body"].as_str().unwrap().to_owned();
        assert_eq!(rendered, format!("{prefix}{section}{suffix}"));
        let json_section = section.strip_prefix("## Evidence map\n\n```json\n").unwrap()
            .strip_suffix("\n```\n\n").unwrap();
        assert_eq!(serde_json::from_str::<Value>(json_section).unwrap(), map);
        if replace {
            assert_eq!(complete["documents"][0]["old_section"], "## Evidence map\nOpaque prose is not authority.\n\n");
            assert_eq!(normalized["submission"]["plans"][0]["replacement"]["content"],
                normalized["submission"]["plans"][0]["content"]);
        } else { assert!(complete["documents"][0]["old_section"].is_null()); }
        client.finish();
        assert_unchanged(project, &before, &prior);

        for case in ["decline", "changed-map", "duplicate-section", "disagree", "count", "scope"] {
            let mut client = Client::open(project);
            let mut candidate = normalized.clone();
            let answer = match case {
                "decline" if !replace => {
                    candidate["approval"] = json!({"approved":false});
                    client.call("cadence_apply", candidate)
                }
                "decline" => { client.finish(); continue; }
                "changed-map" => {
                    candidate = approve(candidate);
                    candidate["submission"]["plans"][0]["content"]["evidence_map"]["items"][0]["reason"] = json!("Unapproved change.");
                    client.call("cadence_apply", candidate)
                }
                "duplicate-section" | "disagree" => {
                    let body = candidate["submission"]["plans"][0]["content"]["body"].as_str().unwrap().to_owned();
                    candidate["submission"]["plans"][0]["content"]["body"] = json!(if case == "duplicate-section" {
                        format!("{body}\n## Evidence map\nAnother section.\n")
                    } else { body.replace(section, "## Evidence map\nUnapproved prose.\n\n") });
                    preview(&mut client, &candidate)
                }
                "count" => client.call("cadence_query", json!({"operation":"plan-read","phase_address":"27","count":1,
                    "submission":candidate["submission"]})),
                "scope" => client.call("cadence_query", json!({"operation":"plan-read","phase_address":"28",
                    "submission":candidate["submission"]})),
                _ => unreachable!(),
            };
            if case == "decline" { assert_eq!(answer["persisted"], false); }
            else {
                assert_eq!(answer["status"], "refused", "{case}: {answer}");
                if case == "changed-map" { assert!(["exact-submission-approval","replacement-authorization"].contains(&answer["rule"].as_str().unwrap()), "{answer}"); }
            }
            client.finish();
            assert_unchanged(project, &before, &prior);
        }
        if !replace {
            let mut client = Client::open(project);
            let draft = client.call("cadence_apply", normalized.clone());
            assert_eq!(draft["persisted"], false);
            client.finish();
            assert_unchanged(project, &before, &prior);
        }
        let approved = approve(normalized);
        let mut client = Client::open(project);
        let acknowledgment = client.call("cadence_apply", approved.clone());
        assert_eq!(acknowledgment["persisted"], true, "{acknowledgment}");
        assert_eq!(acknowledgment["results"][0]["identity"], json!({"phase":27,"plan":1}));
        assert_eq!(acknowledgment["results"][0]["readiness"], "provisional-authoring");
        assert_eq!(client.read("27", None)["native"]["publications"]["1"]["content"]["evidence_map"], map);
        client.finish();
        let installed = fs::read(project.join(".planning/phases/27/PLAN-1.md")).unwrap();
        let parsed = cadence::execution::plan::parse_plan(&installed, 27, 1).unwrap();
        assert_eq!(parsed.body, rendered);
        assert_eq!(complete["documents"][0]["document"].as_str().unwrap().as_bytes(), installed);
        let revision = model::digest(&installed);
        assert_eq!(acknowledgment["results"][0]["revision"], revision);
        assert_eq!(complete["documents"][0]["revision"], revision);
        assert!(!String::from_utf8_lossy(&installed).contains(&revision));
        let saved = reopened(project).snapshot;
        let occurrence = &saved.data["plan_publications"]["phases"]["27"];
        assert_eq!(occurrence["publications"]["1"]["approval"], approved["approval"]);
        assert_eq!(occurrence["receipts"]["attached"]["results"], acknowledgment["results"]);
        let maps = &saved.data["acceptance_maps"];
        assert_eq!(maps["schema"], "acceptance-map-1");
        let events = maps["phases"]["27"]["revisions"].as_array().unwrap();
        assert_eq!(events.len(), 1);
        let event = &events[0];
        assert_eq!(event["occurrence"], "active-cycle:phase:27");
        assert_eq!(event["request_id"], "attached");
        assert_eq!(event["identity"], json!({"phase":27,"plan":1}));
        assert_eq!(event["content_revision"], revision);
        assert_eq!(event["items"], json!(items));
        assert_eq!(event["payload_digest"], occurrence["receipts"]["attached"]["payload_digest"]);
        assert_eq!(event["revision"], acknowledgment["results"][0]["map_revision"]);
        assert_eq!(event["item_revisions"].as_object().unwrap().len(), 5);
        if replace {
            assert_eq!(occurrence["receipts"]["provisional"]["results"][0]["content"]["evidence_map"], json!({"mode":"provisional"}));
            assert!(occurrence["receipts"]["provisional"]["results"][0].get("map_revision").is_none());
        }
        for key in ["context", "evidence", "execution", "import"] { assert_eq!(saved.data.get(key), prior.data.get(key)); }
        let after = tree(project);
        let mut client = Client::open(project);
        let read = client.read("27", None);
        assert_eq!(read["native"]["publications"]["1"], acknowledgment["results"][0]);
        assert_eq!(read["native"]["publications"]["1"]["content"]["evidence_map"], map);
        client.finish();
        assert_eq!(tree(project), after);
    }
}
