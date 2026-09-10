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
    stdin: Option<ChildStdin>,
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
            stdin: child.stdin.take(),
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
        writeln!(self.stdin.as_mut().unwrap(), "{value}").unwrap();
        self.stdin.as_mut().unwrap().flush().unwrap();
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
        drop(self.stdin.take());
        assert!(self.child.wait().unwrap().success());
    }
}

impl Drop for Client {
    fn drop(&mut self) {
        drop(self.stdin.take());
        if !matches!(self.child.try_wait(), Ok(Some(_))) { let _ = self.child.kill(); }
        let _ = self.child.wait();
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
    let bad = proposal(&mut client, "saved-conflict", std::slice::from_ref(&conflicting[1]), &["# Conflicting gap\n"]);
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

#[test]
fn phase28_noncurrent_truth_version_is_refused() {
    for requested in [2_u32, 0, u32::MAX] {
        for shared in [false, true] {
            let temp = fixture();
            let project = temp.path();
            native_context(project, 27, &["T1", "T2"]);
            let before = tree(project);
            let prior = snapshot(project);
            assert_eq!(prior.data["context"]["phases"]["27"]["truths"][0]["version"], 1);
            assert_eq!(prior.data["context"]["phases"]["27"]["truths"][1]["version"], 1);
            let mut item = artifact("opaque/version-item", if shared { &["T1", "T2"] } else { &["T2"] });
            let edge = usize::from(shared);
            item["associations"][edge]["truth_version"] = json!(requested);
            let mut client = Client::open(project);
            let input = proposal(&mut client, "wrong-version", &[attached(vec![check("one", "T1"),
                check("two", "T2"), item])], &["# Wrong numeric version\n"]);
            for answer in [preview(&mut client, &input), client.call("cadence_apply", approve(input))] {
                assert_refusal(&answer, "truth-version-mismatch", "opaque/version-item");
                assert_eq!(answer["entry"], 0);
                assert_eq!(answer["slot"], format!("submission.plans[0].content.evidence_map.items[2].associations[{edge}].truth_version"));
                let reason = answer["reason"].as_str().unwrap();
                for text in ["T2".to_owned(), format!("requested {requested}"), "current 1".into()] {
                    assert!(reason.contains(&text), "{answer}");
                }
            }
            client.finish();
            assert_unchanged(project, &before, &prior);
        }
    }

    let temp = fixture();
    let project = temp.path();
    native_context(project, 27, &["T1", "T2"]);
    let before = tree(project);
    let prior = snapshot(project);
    let mut client = Client::open(project);
    let mut missing = proposal(&mut client, "missing-version", &[attached(vec![check("one", "T1"),
        check("two", "T2"), artifact("opaque/version-item", &["T1", "T2"])])], &["# Missing numeric version\n"]);
    missing["submission"]["plans"][0]["content"]["evidence_map"]["items"][2]["associations"][1]
        .as_object_mut().unwrap().remove("truth_version");
    let answer = client.call("cadence_apply", approve(missing));
    assert_refusal(&answer, "evidence-association-shape", "opaque/version-item");
    assert_eq!(answer["entry"], 0);
    assert_eq!(answer["slot"], "submission.plans[0].content.evidence_map.items[2].associations[1].truth_version");
    assert!(answer["reason"].as_str().unwrap().contains("missing"));
    client.finish();
    assert_unchanged(project, &before, &prior);

    let mut client = Client::open(project);
    let items = vec![check("one", "T1"), check("two", "T2"), artifact("opaque/version-item", &["T1", "T2"])];
    let current = proposal(&mut client, "current-version", &[attached(items.clone())], &["# Explicit version one\n"]);
    let published = publish(&mut client, &current);
    client.finish();
    let saved = reopened(project).snapshot;
    assert_eq!(saved.data["acceptance_maps"]["phases"]["27"]["revisions"][0]["items"], json!(items));
    assert_eq!(saved.data["plan_publications"]["phases"]["27"]["publications"]["1"], published["results"][0]);

    let absent = fixture();
    fs::write(absent.path().join(".planning/phases/27/CONTEXT.md"),
        "# Handwritten context\nT1 is mentioned here; this is not native approval.\n").unwrap();
    let before = tree(absent.path());
    let mut client = Client::open(absent.path());
    let input = proposal(&mut client, "no-native-truths", &[attached(vec![check("one", "T1")])], &["# Cannot infer approval\n"]);
    for answer in [preview(&mut client, &input), client.call("cadence_apply", approve(input))] {
        assert_eq!(answer["status"], "refused", "{answer}");
        assert_eq!(answer["rule"], "native-approved-truths");
        assert_eq!(answer["phase"], 27);
        let reason = answer["reason"].as_str().unwrap();
        assert!(reason.contains("current") && reason.contains("absent") && reason.contains("context-submit"), "{answer}");
    }
    client.finish();
    assert_eq!(tree(absent.path()), before);
    assert!(!absent.path().join(".planning/state.json").exists());
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
fn phase28_republication_supersedes_previous_map() {
    for case in ["body", "spec", "mapless", "shared"] {
        let temp = fixture();
        let project = temp.path();
        native_context(project, 27, &["T1"]);
        let items = vec![check("delivery", "T1"), artifact("address", &["T1"])];
        let map = attached(items.clone());
        let mut client = Client::open(project);
        let maps = if case == "shared" { vec![map.clone(), map.clone()] } else { vec![map.clone()] };
        let bodies = if case == "shared" { vec!["# Original\n", "# Unaffected\n"] } else { vec!["# Original\n"] };
        let input = proposal(&mut client, "original", &maps, &bodies);
        let original_request = approve(final_request(&preview(&mut client, &input)));
        let original = client.call("cadence_apply", original_request.clone());
        assert_eq!(original["persisted"], true, "{original}");
        client.finish();
        let first = reopened(project).snapshot;
        let old_events = first.data["acceptance_maps"]["phases"]["27"]["revisions"].as_array().unwrap().clone();
        assert_eq!(old_events[0]["items"], json!(items));
        assert_eq!(old_events[0]["identity"], json!({"phase":27,"plan":1}));
        assert_eq!(old_events[0]["request_id"], "original");
        assert_eq!(old_events[0]["content_revision"], original["results"][0]["revision"]);
        assert_eq!(old_events[0]["payload_digest"], first.data["plan_publications"]["phases"]["27"]["receipts"]["original"]["payload_digest"]);
        let path = project.join(".planning/phases/27/PLAN-1.md");
        let old_document = fs::read_to_string(&path).unwrap();
        let before = tree(project);
        let mut changed_items = items.clone();
        changed_items[1]["spec"]["substance"] = json!("A revised usable destination.");
        let new_map = match case {
            "spec" => attached(changed_items.clone()),
            "mapless" => json!({"mode":"provisional"}),
            _ => map.clone(),
        };
        let mut client = Client::open(project);
        let candidate = replacement(&mut client, "replacement", 1, &original["results"][0],
            &old_document, new_map.clone(), "# Revised body\n");
        // Each refusal must preserve both the installed winner and its history.
        for control in ["missing", "stale", "wrong-map", "invalid-association", "implicit-map"] {
            let mut bad = candidate.clone();
            let entry = &mut bad["submission"]["plans"][0];
            let rule = match control {
                "missing" => { entry.as_object_mut().unwrap().remove("replacement"); "replacement-authorization" }
                "stale" => { entry["replacement"]["old_revision"] = json!("stale"); "stale-target" }
                "wrong-map" => { entry["replacement"]["content"]["evidence_map"] = attached(changed_items.clone()); "replacement-authorization" }
                "invalid-association" => {
                    let mut bad_items = items.clone();
                    bad_items[0]["associations"][0]["truth_version"] = json!(2);
                    entry["content"]["evidence_map"] = attached(bad_items);
                    entry["replacement"]["content"] = entry["content"].clone();
                    "truth-version-mismatch"
                }
                "implicit-map" => {
                    entry["content"].as_object_mut().unwrap().remove("evidence_map");
                    entry["content"]["body"] = json!(original["results"][0]["content"]["body"]);
                    entry["replacement"]["content"] = entry["content"].clone();
                    "evidence-map-mode"
                }
                _ => unreachable!(),
            };
            // Wrong authorization must differ even when the proposed spec is revised.
            if control == "wrong-map" {
                bad["submission"]["plans"][0]["replacement"]["content"]["evidence_map"] = json!({"mode":"provisional"});
                if case == "mapless" { bad["submission"]["plans"][0]["replacement"]["content"]["evidence_map"] = map.clone(); }
            }
            let answer = client.call("cadence_apply", approve(bad));
            assert_eq!(answer["status"], "refused", "{case}/{control}: {answer}");
            assert_eq!(answer["rule"], rule, "{case}/{control}: {answer}");
            client.finish();
            assert_unchanged(project, &before, &first);
            client = Client::open(project);
        }
        if case == "shared" {
            let conflict = replacement(&mut client, "conflict", 1, &original["results"][0],
                &old_document, attached(changed_items.clone()), "# Conflicting definition\n");
            assert_refusal(&preview(&mut client, &conflict), "evidence-item-conflict", "address");
            client.finish();
            assert_unchanged(project, &before, &first);
            client = Client::open(project);
        }
        let complete = preview(&mut client, &candidate);
        let approved = approve(final_request(&complete));
        let replacement = client.call("cadence_apply", approved.clone());
        assert_eq!(replacement["persisted"], true, "{replacement}");
        assert_ne!(replacement["results"][0]["revision"], original["results"][0]["revision"]);
        if case == "mapless" {
            assert_eq!(replacement["coverage"], json!({"uncovered":["T1"],"without_check":["T1"]}));
            assert!(replacement["results"][0].get("map_revision").is_none());
        }
        client.finish();
        let saved = reopened(project).snapshot;
        let occurrence = &saved.data["plan_publications"]["phases"]["27"];
        assert_eq!(occurrence["publications"]["1"], replacement["results"][0]);
        assert_eq!(occurrence["receipts"]["original"], first.data["plan_publications"]["phases"]["27"]["receipts"]["original"]);
        assert_eq!(occurrence["receipts"]["original"]["results"][0]["approval"], original_request["approval"]);
        let history = &saved.data["acceptance_maps"]["phases"]["27"];
        let events = history["revisions"].as_array().unwrap();
        assert_eq!(&events[..old_events.len()], old_events.as_slice());
        assert_eq!(events.len(), old_events.len() + usize::from(case != "mapless"));
        let successor = json!({"request_id":"replacement","identity":{"phase":27,"plan":1},
            "content_revision":replacement["results"][0]["revision"],
            "map_revision":replacement["results"][0].get("map_revision")});
        let old_id = old_events[0]["revision"].as_str().unwrap();
        assert_eq!(history["superseded"][old_id], successor, "retained supersession relation");
        if case != "mapless" {
            let new_event = events.last().unwrap();
            assert_eq!(new_event["items"], new_map["items"]);
            assert_eq!(new_event["revision"], replacement["results"][0]["map_revision"]);
            assert_eq!(new_event["payload_digest"], occurrence["receipts"]["replacement"]["payload_digest"]);
            assert_ne!(new_event["revision"], old_events[0]["revision"]);
            if case == "spec" { assert_ne!(new_event["item_revisions"]["address"], old_events[0]["item_revisions"]["address"]); }
            else { assert_eq!(new_event["item_revisions"], old_events[0]["item_revisions"]); }
        }
        if case == "shared" { assert_eq!(occurrence["publications"]["2"], original["results"][1]); }
        let installed = fs::read(&path).unwrap();
        assert_eq!(model::digest(&installed), replacement["results"][0]["revision"]);
        assert_eq!(installed, complete["documents"][0]["document"].as_str().unwrap().as_bytes());
        let after = tree(project);
        let mut client = Client::open(project);
        let read = client.read("27", None);
        let visible = read["map_history"].as_array().expect("public retained map history");
        assert_eq!(visible.len(), events.len());
        assert_eq!(visible[0], json!({"publication":old_events[0],"status":"superseded","superseded_by":successor}));
        for (index, event) in events.iter().enumerate().skip(1) {
            assert_eq!(visible[index], json!({"publication":event,"status":"current","superseded_by":null}));
        }
        assert_eq!(read["native"]["publications"]["1"]["readiness"], "provisional-authoring");
        client.finish();
        assert_unchanged(project, &after, &saved);
        assert_eq!(reopened(project).snapshot, saved);

        // Retry the exact original acknowledgment after replacement and restart.
        for projection in ["newer-authorized", "drifted", "missing"] {
            match projection {
                "drifted" => fs::write(&path, b"Caller drift; not evidence.\n").unwrap(),
                "missing" => fs::remove_file(&path).unwrap(),
                _ => {},
            }
            let before_replay = tree(project);
            let mut client = Client::open(project);
            let replay = client.call("cadence_apply", original_request.clone());
            assert_eq!(replay["replayed"], true, "{replay}");
            assert_eq!(replay["results"], original["results"]);
            assert_eq!(replay["payload_digest"], occurrence["receipts"]["original"]["payload_digest"],
                "replay returns original payload digest");
            assert_eq!(replay["projections"][0]["status"], projection);
            assert_eq!(replay["projections"][0]["current_revision"], replacement["results"][0]["revision"]);
            for changed in ["spec", "association"] {
                let mut reused = original_request.clone();
                let item = &mut reused["submission"]["plans"][0]["content"]["evidence_map"]["items"][0];
                if changed == "spec" { item["spec"]["call"] = json!("Send an altered parcel."); }
                else { item["associations"][0]["reason"] = json!("A different association reason."); }
                let refused = client.call("cadence_apply", approve(reused));
                assert_eq!(refused["rule"], "request-id-reuse", "{refused}");
                assert!(refused["reason"].as_str().unwrap().contains("original"));
            }
            client.finish();
            assert_unchanged(project, &before_replay, &saved);
            assert_eq!(reopened(project).snapshot, saved);
        }
        fs::write(&path, installed).unwrap();
    }

    // Two independent real callers preview the same old target before either wins.
    let temp = fixture();
    let project = temp.path();
    native_context(project, 27, &["T1"]);
    let mut first = Client::open(project);
    let map = attached(vec![check("delivery", "T1")]);
    let initial = proposal(&mut first, "competing-original", std::slice::from_ref(&map), &["# Original\n"]);
    let original = publish(&mut first, &initial);
    first.finish();
    let path = project.join(".planning/phases/27/PLAN-1.md");
    let old = fs::read_to_string(&path).unwrap();
    let mut first = Client::open(project);
    let mut second = Client::open(project);
    let winner = replacement(&mut first, "winner", 1, &original["results"][0], &old, map.clone(), "# Winner\n");
    let loser = replacement(&mut second, "loser", 1, &original["results"][0], &old, map, "# Loser\n");
    let winner = approve(final_request(&preview(&mut first, &winner)));
    let loser = approve(final_request(&preview(&mut second, &loser)));
    let won = first.call("cadence_apply", winner);
    assert_eq!(won["persisted"], true, "{won}");
    first.finish();
    let before = tree(project);
    let saved = reopened(project).snapshot;
    let refused = second.call("cadence_apply", loser);
    assert_eq!(refused["rule"], "stale-target", "{refused}");
    assert!(refused["reason"].as_str().unwrap().contains("phase 27 plan 1"));
    assert!(refused["reason"].as_str().unwrap().contains("fresh approval"));
    second.finish();
    assert_unchanged(project, &before, &saved);
    assert_eq!(reopened(project).snapshot, saved);

    // Restore the captured historical bytes verbatim at their original root.
    // Guard is declared before clients, so unwind reaps them before root cleanup.
    let capture: Value = serde_json::from_str(include_str!("fixtures/phase27_absent_map.json")).unwrap();
    let fixed = HistoricalRoot::restore(&capture);
    let project = &fixed.path;
    let original_request = capture["request"].clone();
    for content in [&original_request["submission"]["plans"][0]["content"],
        &original_request["approval"]["submission"]["plans"][0]["content"],
        &capture["publication"]["content"], &capture["receipt"]["results"][0]["content"]] {
        assert!(content.get("evidence_map").is_none());
        assert!(content.get("provisional").is_none());
    }
    let before = tree(project);
    let saved = reopened(project).snapshot;
    assert_eq!(saved.data["import"]["active"], capture["provenance"]["active"]);
    let mut client = Client::open(project);
    let replay = client.call("cadence_apply", original_request.clone());
    assert_eq!(replay["replayed"], true, "{replay}");
    assert_eq!(replay["results"], capture["acknowledgment"]["results"]);
    assert_eq!(replay["payload_digest"], capture["payload_digest"]);
    assert_eq!(replay["projections"][0]["status"], "installed");
    client.finish();
    assert_unchanged(project, &before, &saved);
    let path = project.join(".planning/phases/27/PLAN-1.md");
    let old = fs::read_to_string(&path).unwrap();
    assert_eq!(old.as_bytes(), serde_json::from_value::<Vec<u8>>(capture["plan_bytes"].clone()).unwrap());
    let mut client = Client::open(project);
    let new = replacement(&mut client, "first-attached-map", 1, &capture["publication"], &old,
        attached(vec![check("native-first-check", "T1")]), "# First approved attached map\n");
    let complete = preview(&mut client, &new);
    let published = client.call("cadence_apply", approve(final_request(&complete)));
    assert_eq!(published["persisted"], true, "historical replacement writer admission: {published}");
    client.finish();
    let after = tree(project);
    let current = reopened(project).snapshot;
    let mut client = Client::open(project);
    let replay = client.call("cadence_apply", original_request.clone());
    assert_eq!(replay["replayed"], true);
    assert_eq!(replay["results"], capture["acknowledgment"]["results"]);
    assert_eq!(replay["payload_digest"], capture["payload_digest"]);
    assert_eq!(replay["projections"][0]["status"], "newer-authorized");
    assert_eq!(replay["projections"][0]["current_revision"], published["results"][0]["revision"]);
    assert!(replay["results"][0]["content"].get("evidence_map").is_none());
    client.finish();
    assert_unchanged(project, &after, &current);
    let persisted = reopened(project).snapshot;
    let occurrence = &persisted.data["plan_publications"]["phases"]["27"];
    let id = original_request["submission"]["request_id"].as_str().unwrap();
    assert_eq!(serde_json::to_vec(&occurrence["receipts"][id]).unwrap(), serde_json::to_vec(&capture["receipt"]).unwrap());
    assert_eq!(occurrence["publications"]["1"], published["results"][0]);
    let events = persisted.data["acceptance_maps"]["phases"]["27"]["revisions"].as_array().unwrap();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0]["items"], json!([check("native-first-check", "T1")]));
    assert_eq!(events[0]["revision"], published["results"][0]["map_revision"]);
    assert_eq!(fs::read(&path).unwrap(), complete["documents"][0]["document"].as_str().unwrap().as_bytes());
}

struct HistoricalRoot {
    path: PathBuf,
    _lock: fs::File,
}

impl HistoricalRoot {
    const MARKER: &'static [u8] = b"phase27-absent-map-df43af15\n";

    fn owned(path: &Path) -> bool {
        use std::os::unix::fs::MetadataExt;
        let Ok(meta) = fs::symlink_metadata(path) else { return false };
        let Ok(marker) = fs::symlink_metadata(path.join(".cadence-fixture-owner")) else { return false };
        // SAFETY: geteuid has no arguments or memory preconditions.
        meta.is_dir() && meta.uid() == unsafe { libc::geteuid() } && marker.is_file()
            && fs::read(path.join(".cadence-fixture-owner")).is_ok_and(|bytes| bytes == Self::MARKER)
    }

    fn restore(capture: &Value) -> Self {
        use std::os::{fd::AsRawFd, unix::fs::{MetadataExt, OpenOptionsExt, PermissionsExt}};
        let path = PathBuf::from("/tmp/cadence-phase27-absent-map-df43af15");
        let lock = fs::OpenOptions::new().read(true).write(true).create(true).truncate(false)
            .mode(0o600).custom_flags(libc::O_NOFOLLOW).open(path.with_extension("lock")).unwrap();
        let meta = lock.metadata().unwrap();
        // SAFETY: geteuid and flock use no borrowed memory; the file is live.
        assert!(meta.is_file() && meta.uid() == unsafe { libc::geteuid() } && meta.mode() & 0o777 == 0o600);
        assert_eq!(unsafe { libc::flock(lock.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) }, 0, "historical fixture lock unavailable");
        let guard = Self { path, _lock: lock };
        if fs::symlink_metadata(&guard.path).is_ok() {
            assert!(Self::owned(&guard.path), "refuse unowned or symlink historical root");
            fs::remove_dir_all(&guard.path).unwrap();
        }
        fs::create_dir(&guard.path).unwrap();
        fs::set_permissions(&guard.path, fs::Permissions::from_mode(0o700)).unwrap();
        fs::write(guard.path.join(".cadence-fixture-owner"), Self::MARKER).unwrap();
        assert_eq!(fs::canonicalize(&guard.path).unwrap(), guard.path);
        assert_eq!(capture["provenance"]["project_root"], guard.path.to_str().unwrap());
        assert_eq!(capture["provenance"]["planning_root"], guard.path.join(".planning").to_str().unwrap());
        assert_eq!(capture["provenance"]["CADENCE_GLOBAL_CONFIG"], "");
        assert_eq!(capture["provenance"]["active"], json!({"repo":guard.path.join(".planning/config.v4.json"),"global":null}));
        for (relative, bytes) in capture["files"].as_object().unwrap() {
            let relative = Path::new(relative);
            assert!(relative.components().all(|c| matches!(c, std::path::Component::Normal(_))));
            let target = guard.path.join(".planning").join(relative);
            if bytes.is_null() { fs::create_dir_all(target).unwrap(); }
            else {
                fs::create_dir_all(target.parent().unwrap()).unwrap();
                fs::write(target, serde_json::from_value::<Vec<u8>>(bytes.clone()).unwrap()).unwrap();
            }
        }
        assert_eq!(fs::canonicalize(guard.path.join(".planning")).unwrap(), guard.path.join(".planning"));
        guard
    }
}

impl Drop for HistoricalRoot {
    fn drop(&mut self) {
        if Self::owned(&self.path) { fs::remove_dir_all(&self.path).expect("clean up owned historical root before unlocking"); }
    }
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
