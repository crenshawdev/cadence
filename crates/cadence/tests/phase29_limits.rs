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
            "clientInfo":{"name":"phase29-check","version":"1"}}}),
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

fn native_context(project: &Path, slots: &[(&str, &str, &str, &str)]) {
    let truths = slots.iter().map(|(id, trigger, observer, outcome)| json!({
        "id":id,"trigger":trigger,"observer":observer,"verb":"gets","outcome":outcome,
        "kind":"property","observable":true,"fixed_oracle":true
    })).collect::<Vec<_>>();
    let mut client = Client::open(project);
    let answer = client.call("cadence_apply", approve(json!({
        "operation":"context-submit","submission":{"phase":27,"title":"Limits",
        "scope":"Approved plans only.","durable_decisions":[],"decisions":[],
        "assumptions":[],"truths":truths}
    })));
    assert_eq!(answer["persisted"], true, "native setup: {answer}");
    client.finish();
    let before = tree(project);
    let saved = reopened(project).snapshot;
    assert_eq!(saved.data["context"]["phases"]["27"]["submission"]["truths"], json!(truths));
    for (i, (id, trigger, observer, outcome)) in slots.iter().enumerate() {
        assert_eq!(saved.data["context"]["phases"]["27"]["truths"][i], json!({
            "id":id,"phase":27,"version":1,"pattern":"when",
            "text":format!("When {trigger}, {observer} gets {outcome}."),
            "kind":"property","status":"pending"
        }));
    }
    assert_eq!(tree(project), before);
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

fn attached(items: Vec<Value>) -> Value {
    json!({"mode":"attached","items":items})
}

fn edges(truths: &[&str]) -> Value {
    json!(truths.iter().map(|id| json!({"truth_id":id,"truth_version":1,
        "reason":"This causes the promised delivery."})).collect::<Vec<_>>())
}

fn check(id: &str, truths: &[&str]) -> Value {
    json!({"kind":"check","id":id,"reason":"Dropping delivery loses the receipt.",
        "spec":{"command":"custom-delivery-check","expected":{"kind":"literal","value":"receipt"},
            "test":{"file":"","function":""},"setup":"","call":"","boundary":"","fakes":[]},
        "associations":edges(truths)})
}

fn artifact(id: &str, truths: &[&str]) -> Value {
    json!({"kind":"artifact","id":id,"reason":"A destination is necessary.",
        "spec":{"locators":["src/destination"],"substance":"The destination exists."},
        "associations":edges(truths)})
}

// Handwritten phase-28 section grammar. No production renderer, validator or
// typed map serializer participates in this caller's expected document.
fn section_json(value: &Value, depth: usize) -> String {
    let indent = "  ".repeat(depth);
    let child = "  ".repeat(depth + 1);
    match value {
        Value::Array(values) if !values.is_empty() => format!("[\n{}\n{indent}]", values.iter()
            .map(|v| format!("{child}{}", section_json(v, depth + 1))).collect::<Vec<_>>().join(",\n")),
        Value::Object(fields) if !fields.is_empty() => {
            let order: &[&str] = if fields.contains_key("mode") { &["mode", "items"] }
                else if fields.contains_key("spec") { &["kind", "id", "spec", "reason", "associations"] }
                else if fields.contains_key("truth_id") { &["truth_id", "truth_version", "reason"] }
                else if fields.contains_key("command") || fields.contains_key("expected") {
                    &["command", "expected", "test", "setup", "call", "boundary", "fakes"]
                } else if fields.contains_key("file") { &["file", "function"] }
                else if fields.contains_key("locators") { &["locators", "substance"] }
                else if fields.contains_key("caller") || fields.contains_key("callee") { &["caller", "callee", "value"] }
                else { &["kind", "value"] };
            let mut keys = order.iter().copied().filter(|k| fields.contains_key(*k)).collect::<Vec<_>>();
            keys.extend(fields.keys().map(String::as_str).filter(|k| !order.contains(k)));
            format!("{{\n{}\n{indent}}}", keys.iter().map(|k| format!("{child}{}: {}",
                serde_json::to_string(k).unwrap(), section_json(&fields[*k], depth + 1)))
                .collect::<Vec<_>>().join(",\n"))
        }
        _ => serde_json::to_string(value).unwrap(),
    }
}

fn body(map: &Value) -> String {
    format!("# Limits invoice pronoun\n## Evidence map\n\n```json\n{}\n```\n\n", section_json(map, 0))
}

// Some(number) replaces a current contribution; None allocates a new one.
fn proposal(project: &Path, id: &str, maps: &[(Option<u32>, Value)]) -> Value {
    let mut client = Client::open(project);
    let allocation = client.read("27", Some(maps.len() as u32));
    assert_eq!(allocation["status"], "ok", "{allocation}");
    client.finish();
    let mut input = request(&allocation, 27, id, &vec![""; maps.len()]);
    let mut next = allocation["inventory"]["high_water"].as_u64().unwrap() as u32;
    for (entry, (number, map)) in input["submission"]["plans"].as_array_mut().unwrap().iter_mut().zip(maps) {
        let plan = number.unwrap_or_else(|| { next += 1; next });
        entry["target"]["plan"] = json!(plan);
        entry["content"]["plan"] = json!(plan);
        entry["content"]["evidence_map"] = map.clone();
        entry["content"]["body"] = json!(body(map));
        if number.is_some() {
            let old = &allocation["native"]["publications"][plan.to_string()];
            assert!(old.is_object());
            let document = fs::read_to_string(project.join(format!(".planning/phases/27/PLAN-{plan}.md"))).unwrap();
            entry["replacement"] = json!({"approved":true,"owner":"John Crenshaw",
                "at":"2026-09-10T15:00:00Z","target":entry["target"],
                "old_revision":old["revision"],"old_document":document,"content":entry["content"]});
        }
    }
    input
}

fn preview(client: &mut Client, input: &Value) -> Value {
    client.call("cadence_query", json!({"operation":"plan-read","phase_address":"27",
        "submission":input["submission"]}))
}

fn unchanged(project: &Path, before: &BTreeMap<PathBuf, Option<Vec<u8>>>, prior: &Snapshot) {
    assert_eq!(&tree(project), before, "all durable bytes and directory entries");
    assert_eq!(&snapshot(project), prior, "parsed durable records");
    assert_eq!(&reopened(project).snapshot, prior, "verified reopened store");
    assert_eq!(&tree(project), before, "reopen is read only");
}

fn publish(project: &Path, input: &Value) -> Value {
    let mut client = Client::open(project);
    let complete = preview(&mut client, input);
    assert_eq!(complete["status"], "ok", "complete control preview: {complete}");
    assert_eq!(complete["submission"], input["submission"], "handwritten canonical section");
    let approved = approve(input.clone());
    let answer = client.call("cadence_apply", approved.clone());
    assert_eq!(answer["persisted"], true, "control publication: {answer}");
    client.finish();
    let before = tree(project);
    let prior = reopened(project).snapshot;
    let occurrence = &prior.data["plan_publications"]["phases"]["27"];
    assert_eq!(occurrence["receipts"][input["submission"]["request_id"].as_str().unwrap()]["results"], answer["results"]);
    for (entry, result) in input["submission"]["plans"].as_array().unwrap().iter().zip(answer["results"].as_array().unwrap()) {
        assert_eq!(result["identity"], entry["target"]);
        assert_eq!(result["content"], entry["content"]);
        assert_eq!(result["approval"], approved["approval"]);
        assert_eq!(occurrence["publications"][result["identity"]["plan"].as_u64().unwrap().to_string()], *result);
        let retained = prior.data["acceptance_maps"]["phases"]["27"]["revisions"].as_array().unwrap().iter()
            .find(|r| r["revision"] == result["map_revision"]).unwrap();
        assert_eq!(retained["items"], entry["content"]["evidence_map"]["items"]);
        assert_eq!(retained["identity"], entry["target"]);
        assert_eq!(retained["content_revision"], result["revision"]);
        let document = fs::read_to_string(project.join(format!(".planning/phases/27/PLAN-{}.md", entry["target"]["plan"]))).unwrap();
        assert!(document.ends_with(entry["content"]["body"].as_str().unwrap()));
    }
    let mut client = Client::open(project);
    let read = client.call("cadence_query", json!({"operation":"evidence-read","phase":27}));
    assert_eq!(read["schema"], "acceptance-map-view-1");
    assert_eq!(read["coherence"], "consistent");
    for result in answer["results"].as_array().unwrap() {
        assert!(read["contributions"].as_array().unwrap().iter().any(|c|
            c["identity"] == result["identity"] && c["map_revision"] == result["map_revision"]));
        for expected in result["content"]["evidence_map"]["items"].as_array().unwrap() {
            let actual = read["items"].as_array().unwrap().iter().find(|i| i["id"] == expected["id"]).unwrap();
            assert_eq!(actual["spec"], expected["spec"]);
        }
    }
    let replay = client.call("cadence_apply", approved);
    assert_eq!(replay["replayed"], true);
    assert_eq!(replay["results"], answer["results"]);
    client.finish();
    unchanged(project, &before, &prior);
    answer
}

fn refusals(project: &Path, input: &Value) -> [Value; 2] {
    let before = tree(project);
    let prior = snapshot(project);
    let mut client = Client::open(project);
    let preview = preview(&mut client, input);
    client.finish();
    unchanged(project, &before, &prior);
    let mut client = Client::open(project);
    let applied = client.call("cadence_apply", approve(input.clone()));
    client.finish();
    unchanged(project, &before, &prior);
    [preview, applied]
}

fn located(answer: &Value, rule: &str, id: &str, entry: usize, item: usize, field: &str) {
    assert_eq!(answer["status"], "refused", "{answer}");
    assert_eq!(answer["code"], "invalid-plan", "{answer}");
    assert_eq!(answer["rule"], rule, "identified refusal: {answer}");
    assert_eq!(answer["id"], id, "identified refusal: {answer}");
    assert_eq!(answer["phase"], 27, "{answer}");
    assert_eq!(answer["entry"], entry, "{answer}");
    assert_eq!(answer["slot"], format!("submission.plans[{entry}].content.evidence_map.items[{item}].{field}"), "{answer}");
}

#[test]
fn phase29_check_without_command_is_refused() {
    let temp = fixture();
    let project = temp.path();
    let truth = "truth/full/delivery";
    native_context(project, &[(truth, "the sender sends the parcel", "the recipient", "a receipt")]);
    let saved = attached(vec![check("check/full/delivery", &[truth])]);
    publish(project, &proposal(project, "winner", &[(None, saved.clone())]));
    for (n, value) in [None, Some(Value::Null), Some(json!(true)), Some(json!(17)),
        Some(json!({})), Some(json!([])), Some(json!("")), Some(json!("   ")),
        Some(json!("\t\n")), Some(json!("\u{2003}\u{a0}"))].into_iter().enumerate()
    {
        let mut offending = check("check/full/delivery", &[truth]);
        if let Some(value) = value { offending["spec"]["command"] = value; }
        else { offending["spec"].as_object_mut().unwrap().remove("command"); }
        let maps = [(None, attached(vec![artifact("batch/first", &[truth])])),
            (Some(1), attached(vec![artifact("item/first", &[truth]), offending]))];
        let input = proposal(project, &format!("bad-command-{n}"), &maps);
        for answer in refusals(project, &input) {
            located(&answer, "check-command", "check/full/delivery", 1, 1, "spec.command");
        }
    }
    // D-106: blank auxiliary strings are legal; commands have no runner/file gate.
    let sentinel = project.join("should-never-exist");
    let sentinel_command = format!("touch '{}'", sentinel.display());
    for (n, command) in ["nonexistent-custom-wrapper", "cargo test --workspace", "  wrapper\t\n", &sentinel_command].iter().enumerate() {
        let mut item = check("check/full/delivery", &[truth]);
        item["spec"]["command"] = json!(command);
        let input = proposal(project, &format!("control-{n}"), &[(Some(1), attached(vec![item]))]);
        publish(project, &input);
        assert!(!sentinel.exists(), "planning must never execute a command");
    }
    let mut item = check("check/full/delivery", &[truth]);
    item["spec"]["command"] = json!("\t");
    let input = proposal(project, "draft", &[(None, attached(vec![item]))]);
    let before = tree(project);
    let prior = snapshot(project);
    let mut client = Client::open(project);
    let draft = client.call("cadence_apply", input);
    assert_eq!(draft["persisted"], false);
    assert_eq!(draft["validation"], "draft");
    assert_eq!(client.read("27", Some(2))["persisted"], false);
    client.finish();
    unchanged(project, &before, &prior);
}
