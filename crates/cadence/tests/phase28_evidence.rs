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

fn independent_hash(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    format!("{:x}", Sha256::digest(bytes))
}

// Test-side byte construction: sorted object names, supplied array order, no
// production renderer, view assembler or digest implementation is called.
fn canonical_test_bytes(value: &Value) -> Vec<u8> {
    fn write(value: &Value) -> String {
        match value {
            Value::Object(object) => {
                let ordered: BTreeMap<_, _> = object.iter().collect();
                format!("{{{}}}", ordered.into_iter().map(|(k, v)|
                    format!("{}:{}", serde_json::to_string(k).unwrap(), write(v))).collect::<Vec<_>>().join(","))
            }
            Value::Array(array) => format!("[{}]", array.iter().map(write).collect::<Vec<_>>().join(",")),
            _ => serde_json::to_string(value).unwrap(),
        }
    }
    write(value).into_bytes()
}

fn authored_items(items: &[Value]) -> Vec<Value> {
    items.iter().map(|i| json!({"kind":i["kind"],"id":i["id"],"spec":i["spec"],
        "reason":i["reason"],"associations":i["associations"]})).collect()
}

fn expected_plan(number: u32, heading: &str, items: Option<&[Value]>) -> Vec<u8> {
    let mut text = format!("---\nphase: 27\nplan: {number}\nrequirements: [\"T1\"]\nfiles: [\"src/shared.txt\"]\ndirectories: [\"src/extra\"]\nexecution: {{\"schema\":1,\"suite\":\"printf suite\",\"tasks\":[{{\"id\":\"task-1\",\"verify\":[\"printf verified\"]}}]}}\n---\n{heading}");
    if let Some(items) = items {
        let map = json!({"mode":"attached","items":authored_items(items)});
        text.push_str(&format!("## Evidence map\n\n```json\n{}\n```\n\n", serde_json::to_string_pretty(&map).unwrap()));
    }
    text.into_bytes()
}

fn expected_event(request: &Value, number: u32, document: &[u8], items: &[Value]) -> Value {
    let id = &request["submission"]["request_id"];
    let identity = json!({"phase":27,"plan":number});
    let mut revisions = BTreeMap::new();
    for item in authored_items(items) {
        let definition = json!({"kind":item["kind"],"id":item["id"],"spec":item["spec"],"reason":item["reason"]});
        revisions.insert(item["id"].as_str().unwrap().to_owned(), independent_hash(&serde_json::to_vec(&definition).unwrap()));
    }
    json!({"revision":independent_hash(&serde_json::to_vec(&json!(["active-cycle:phase:27",id,identity])).unwrap()),
        "occurrence":"active-cycle:phase:27","request_id":id,
        "payload_digest":independent_hash(&serde_json::to_vec(&json!([request["submission"],request["approval"]])).unwrap()),
        "identity":identity,"content_revision":independent_hash(document),
        "items":authored_items(items),"item_revisions":revisions})
}

fn expected_view(events: &[Value], current: &[usize], superseded: &[(usize, usize)]) -> Value {
    let truths = ["T1", "T2"].map(|id| json!({"id":id,"version":1,
        "text":"When the sender sends the parcel, the recipient gets the parcel from the sender.","kind":"property"}));
    let mut contributions = vec![];
    let mut items = BTreeMap::new();
    let mut associations = vec![];
    let mut aliases = vec![];
    let mut projections = vec![];
    for &index in current {
        let event = &events[index];
        let number = event["identity"]["plan"].as_u64().unwrap();
        contributions.push(json!({"identity":event["identity"],"content_revision":event["content_revision"],
            "map_revision":event["revision"],"request_id":event["request_id"]}));
        projections.push(json!({"identity":event["identity"],"current_revision":event["content_revision"],
            "observed_digest":event["content_revision"],"status":"installed"}));
        let ordered: BTreeMap<_, _> = event["items"].as_array().unwrap().iter()
            .map(|item| (item["id"].as_str().unwrap(), item)).collect();
        for (id, item) in ordered {
            let revision = &event["item_revisions"][id];
            items.insert(id.to_owned(), json!({"id":id,"kind":item["kind"],"spec":item["spec"],
                "reason":item["reason"],"item_revision":revision}));
            let origin = json!({"plan":number,"map_revision":event["revision"],"item_id":id,"item_revision":revision});
            aliases.push(json!({"origin":origin,"id":id,"item_revision":revision}));
            for (position, association) in item["associations"].as_array().unwrap().iter().enumerate() {
                let mut origin = origin.clone();
                origin["association_index"] = json!(position);
                associations.push(json!({"truth_id":association["truth_id"],"truth_version":association["truth_version"],
                    "reason":association["reason"],"origin":origin}));
            }
        }
    }
    let mut history: Vec<_> = events.iter().enumerate().map(|(index, event)| {
        let next = superseded.iter().find(|(old, _)| *old == index).map(|(_, next)| &events[*next]);
        let successor = next.map(|n| json!({"request_id":n["request_id"],"identity":n["identity"],
            "content_revision":n["content_revision"],"map_revision":n["revision"]}));
        json!({"publication":event,"status":if next.is_some() {"superseded"} else {"current"},"superseded_by":successor})
    }).collect();
    history.sort_by_key(|h| (h["publication"]["identity"]["plan"].as_u64().unwrap(),
        h["publication"]["revision"].as_str().unwrap().to_owned()));
    json!({"schema":"acceptance-map-view-1","phase":27,"occurrence":"active-cycle:phase:27",
        "truths":truths,"contributions":contributions,"items":items.into_values().collect::<Vec<_>>(),
        "associations":associations,"aliases":aliases,"history":history,
        "coverage":{"uncovered":[],"without_check":[],"checks":[
            {"truth_id":"T1","truth_version":1,"item_ids":["check/one"]},
            {"truth_id":"T2","truth_version":1,"item_ids":["check/two"]}]},
        "readiness":"provisional-authoring","projections":projections})
}

fn assert_view(answer: &Value, expected: &Value) {
    let mut full = expected.clone();
    full["status"] = json!("ok");
    full["operation"] = json!("evidence-read");
    full["coherence"] = json!("consistent");
    full["input_digest"] = json!(independent_hash(&canonical_test_bytes(expected)));
    assert_eq!(*answer, full, "complete authoritative view and independently assembled input digest");
}

#[test]
fn phase28_readback_returns_authoritative_map_with_input_digest() {
    // A complete canonical empty-phase input and its literal SHA-256 are pinned
    // independently of the production assembly and of transport response bytes.
    const EMPTY: &str = r#"{"aliases":[],"associations":[],"contributions":[],"coverage":{"checks":[],"uncovered":[],"without_check":[]},"history":[],"items":[],"occurrence":"active-cycle:phase:28","phase":28,"projections":[],"readiness":"provisional-authoring","schema":"acceptance-map-view-1","truths":[]}"#;
    const EMPTY_HASH: &str = "58ce66f04952ef63b152c07d5b3e4d0d1250d3176556d6911b319cc14a6a8d45";
    let empty = fixture();
    let before = tree(empty.path());
    let mut client = Client::open(empty.path());
    let answer = client.call("cadence_query", json!({"operation":"evidence-read","phase":28}));
    assert_eq!(answer["schema"], "acceptance-map-view-1", "authoritative evidence-read operation");
    let empty_expected: Value = serde_json::from_str(EMPTY).unwrap();
    assert_eq!(canonical_test_bytes(&empty_expected), EMPTY.as_bytes());
    assert_eq!(independent_hash(EMPTY.as_bytes()), EMPTY_HASH);
    assert_view(&answer, &empty_expected);
    client.finish();
    assert_eq!(tree(empty.path()), before);
    assert!(!empty.path().join(".planning/state.json").exists());

    let temp = fixture();
    let project = temp.path();
    native_context(project, 27, &["T1", "T2"]);
    let shared = artifact("shared/address", &["T1", "T2"]);
    let mut observed = observation("shared/O1", &["T1", "T2"]);
    observed["associations"][0]["reason"] = json!("The first recipient must see the host delivery.");
    observed["associations"][1]["reason"] = json!("The second recipient must see the host delivery.");
    let mut literal = check("check/one", "T1");
    literal["spec"]["expected"] = json!({"kind":"literal","value":"parcel received"});
    let first_items = vec![literal, shared.clone(), observed.clone()];
    let second_items = vec![check("check/two", "T2"), shared, observed];
    let mut client = Client::open(project);
    let initial = proposal(&mut client, "view-original", &[attached(first_items.clone()), attached(second_items.clone())],
        &["# First view\n", "# Second view\n"]);
    let complete = preview(&mut client, &initial);
    let approved = approve(final_request(&complete));
    let first_bytes = expected_plan(1, "# First view\n", Some(&first_items));
    let second_bytes = expected_plan(2, "# Second view\n", Some(&second_items));
    assert_eq!(complete["documents"][0]["document"].as_str().unwrap().as_bytes(), first_bytes);
    assert_eq!(complete["documents"][1]["document"].as_str().unwrap().as_bytes(), second_bytes);
    let initial = client.call("cadence_apply", approved.clone());
    assert_eq!(initial["persisted"], true, "{initial}");
    client.finish();
    let saved = reopened(project).snapshot;
    let mut events = vec![expected_event(&approved, 1, &first_bytes, &first_items),
        expected_event(&approved, 2, &second_bytes, &second_items)];
    assert_eq!(saved.data["acceptance_maps"]["phases"]["27"]["revisions"], json!(events));
    let original_expected = expected_view(&events, &[0, 1], &[]);
    let mut client = Client::open(project);
    assert_view(&client.call("cadence_query", json!({"operation":"evidence-read","phase":27})), &original_expected);
    let changed = replacement(&mut client, "view-replacement", 1, &initial["results"][0],
        std::str::from_utf8(&first_bytes).unwrap(), attached(first_items.clone()), "# Revised first view\n");
    let complete = preview(&mut client, &changed);
    let replacement_request = approve(final_request(&complete));
    let replacement_bytes = expected_plan(1, "# Revised first view\n", Some(&first_items));
    assert_eq!(complete["documents"][0]["document"].as_str().unwrap().as_bytes(), replacement_bytes);
    let published = client.call("cadence_apply", replacement_request.clone());
    assert_eq!(published["persisted"], true, "{published}");
    client.finish();
    let saved = reopened(project).snapshot;
    events.push(expected_event(&replacement_request, 1, &replacement_bytes, &first_items));
    assert_eq!(saved.data["acceptance_maps"]["phases"]["27"]["revisions"], json!(events));
    let expected = expected_view(&events, &[2, 1], &[(0, 2)]);
    assert_ne!(independent_hash(&canonical_test_bytes(&expected)), independent_hash(&canonical_test_bytes(&original_expected)));
    let path = project.join(".planning/phases/27/PLAN-1.md");
    assert_eq!(fs::read(&path).unwrap(), replacement_bytes);
    assert_eq!(fs::read(project.join(".planning/phases/27/PLAN-2.md")).unwrap(), second_bytes);
    for bytes in [Some(replacement_bytes.as_slice()), Some(replacement_bytes.as_slice()),
        Some(b"---\nphase: [broken\nplan: 999\n---\n## Evidence map\nNot authority.\n".as_slice()),
        Some(b"\xff\xfe\x80".as_slice()), None, Some(replacement_bytes.as_slice())] {
        if let Some(bytes) = bytes { fs::write(&path, bytes).unwrap(); }
        else { fs::remove_file(&path).unwrap(); }
        let before = tree(project);
        let mut variant = expected.clone();
        variant["projections"][0]["observed_digest"] = bytes.map(independent_hash).into();
        variant["projections"][0]["status"] = json!(if bytes.is_none() {"missing"}
            else if bytes == Some(replacement_bytes.as_slice()) {"installed"} else {"drifted"});
        let mut client = Client::open(project);
        assert_view(&client.call("cadence_query", json!({"operation":"evidence-read","phase":27})), &variant);
        client.finish();
        assert_unchanged(project, &before, &saved);
        assert_eq!(reopened(project).snapshot, saved);
    }

    // Real external atomic replacements race the reader. A stable answer must
    // match one entire old/new input set; a scheduler win is never required.
    let race_bytes = b"External companion input; saved maps remain authoritative.\n";
    let mut alternate = expected.clone();
    alternate["projections"][0]["observed_digest"] = json!(independent_hash(race_bytes));
    alternate["projections"][0]["status"] = json!("drifted");
    let companion = project.join("companion-input");
    fs::write(&companion, &replacement_bytes).unwrap();
    let mut child = Companion(Command::new("python3").args(["-c",
        "import os,sys,time\np=sys.argv[1]; old=open(sys.argv[2],'rb').read(); new=b'External companion input; saved maps remain authoritative.\\n'\nprint('ready',flush=True)\ni=0\nwhile True:\n with open(sys.argv[2]+'.next','wb') as f: f.write(old if i%2 else new)\n os.replace(sys.argv[2]+'.next',p)\n i+=1\n time.sleep(0.001)"])
        .arg(&path).arg(&companion).stdin(Stdio::null()).stdout(Stdio::piped()).spawn().unwrap());
    let mut ready = String::new();
    BufReader::new(child.0.stdout.take().unwrap()).read_line(&mut ready).unwrap();
    assert_eq!(ready, "ready\n");
    let mut client = Client::open(project);
    for _ in 0..12 {
        let answer = client.call("cadence_query", json!({"operation":"evidence-read","phase":27}));
        if answer["coherence"] == "consistent" {
            if answer["projections"][0]["status"] == "installed" { assert_view(&answer, &expected); }
            else { assert_view(&answer, &alternate); }
        } else { assert_inconsistent(&answer, "phases/27/PLAN-1.md"); }
    }
    client.finish();
    drop(child);
    fs::write(&path, &replacement_bytes).unwrap();
    assert_eq!(reopened(project).snapshot, saved);

    // Actual-file presence sentinel ONLY: not a retained transaction test.
    let sentinel = tempfile::tempdir().unwrap();
    for (relative, bytes) in tree(project) {
        let target = sentinel.path().join(relative);
        if let Some(bytes) = bytes {
            fs::create_dir_all(target.parent().unwrap()).unwrap(); fs::write(target, bytes).unwrap();
        } else { fs::create_dir_all(target).unwrap(); }
    }
    fs::write(sentinel.path().join(".planning/.store-intent.json"), b"{\"retained\":\"pending owner work\"}\n").unwrap();
    let sentinel_before = tree(sentinel.path());
    let mut client = Client::open(sentinel.path());
    assert_inconsistent(&client.call("cadence_query", json!({"operation":"evidence-read","phase":27})), ".store-intent.json");
    client.finish();
    assert_eq!(tree(sentinel.path()), sentinel_before);
    assert_eq!(snapshot(sentinel.path()), saved); // Snapshot::parse only; no recovering writer.

    // Explicitly mapless publication reports missing coverage, never historical borrowing.
    let mapless = fixture();
    native_context(mapless.path(), 27, &["T1", "T2"]);
    let mut client = Client::open(mapless.path());
    let input = proposal(&mut client, "mapless-view", &[json!({"mode":"provisional"})], &["# Mapless\n"]);
    let published = publish(&mut client, &input);
    client.finish();
    let saved = reopened(mapless.path()).snapshot;
    let before = tree(mapless.path());
    let bytes = expected_plan(1, "# Mapless\n", None);
    assert_eq!(published["results"][0]["revision"], independent_hash(&bytes));
    let mut missing = empty_expected;
    missing["phase"] = json!(27);
    missing["occurrence"] = json!("active-cycle:phase:27");
    missing["truths"] = expected["truths"].clone();
    missing["contributions"] = json!([{"identity":{"phase":27,"plan":1},"content_revision":independent_hash(&bytes),
        "map_revision":null,"request_id":"mapless-view"}]);
    missing["projections"] = json!([{"identity":{"phase":27,"plan":1},"current_revision":independent_hash(&bytes),
        "observed_digest":independent_hash(&bytes),"status":"installed"}]);
    missing["coverage"] = json!({"uncovered":["T1","T2"],"without_check":["T1","T2"],"checks":[
        {"truth_id":"T1","truth_version":1,"item_ids":[]},{"truth_id":"T2","truth_version":1,"item_ids":[]}]});
    let mut client = Client::open(mapless.path());
    assert_view(&client.call("cadence_query", json!({"operation":"evidence-read","phase":27})), &missing);
    client.finish();
    assert_unchanged(mapless.path(), &before, &saved);
    assert_eq!(reopened(mapless.path()).snapshot, saved);
}

fn assert_inconsistent(answer: &Value, input: &str) {
    assert_eq!(answer["status"], "ok", "{answer}");
    assert_eq!(answer["coherence"], "inconsistent", "{answer}");
    assert_eq!(answer["rule"], "inconsistent-inputs", "{answer}");
    assert!(answer["inputs"].as_array().unwrap().iter().any(|v| v == input), "{answer}");
    assert!(answer.get("input_digest").is_none_or(Value::is_null), "{answer}");
}

struct Companion(Child);
impl Drop for Companion {
    fn drop(&mut self) { let _ = self.0.kill(); let _ = self.0.wait(); }
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
