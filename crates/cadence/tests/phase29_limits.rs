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
    assert_eq!(applied["status"], "refused", "publication must refuse: {applied}");
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

#[test]
fn phase29_check_without_expected_output_is_refused() {
    let temp = fixture();
    let project = temp.path();
    let truth = "truth/full/delivery";
    native_context(project, &[(truth, "the sender sends the parcel", "the recipient", "a receipt")]);
    publish(project, &proposal(project, "winner", &[(None, attached(vec![check("check/full/output", &[truth])]))]));
    let mut cases = vec![(None, "spec.expected"), (Some(Value::Null), "spec.expected"),
        (Some(json!("receipt")), "spec.expected"), (Some(json!(false)), "spec.expected"),
        (Some(json!(1)), "spec.expected"), (Some(json!([])), "spec.expected")];
    for kind in [None, Some(Value::Null), Some(json!(3)), Some(json!([])), Some(json!({})), Some(json!("unknown"))] {
        let mut expected = json!({"value":"receipt"});
        if let Some(kind) = kind { expected["kind"] = kind; }
        cases.push((Some(expected), "spec.expected.kind"));
    }
    for kind in ["literal", "property"] {
        for value in [None, Some(Value::Null), Some(json!(true)), Some(json!(17)), Some(json!({})), Some(json!([])),
            Some(json!("")), Some(json!("  ")), Some(json!("\t\n")), Some(json!("\u{2003}\u{a0}"))]
        {
            let mut expected = json!({"kind":kind});
            if let Some(value) = value { expected["value"] = value; }
            cases.push((Some(expected), "spec.expected.value"));
        }
    }
    for (n, (expected, field)) in cases.into_iter().enumerate() {
        let mut item = check("check/full/output", &[truth]);
        if let Some(expected) = expected { item["spec"]["expected"] = expected; }
        else { item["spec"].as_object_mut().unwrap().remove("expected"); }
        let input = proposal(project, &format!("missing-output-{n}"), &[
            (None, attached(vec![artifact("first-plan", &[truth])])),
            (Some(1), attached(vec![artifact("first-item", &[truth]), item]))]);
        for answer in refusals(project, &input) {
            located(&answer, "check-expected", "check/full/output", 1, 1, field);
        }
    }
    for (n, expected) in [json!({"kind":"literal","value":"receipt"}),
        json!({"kind":"property","value":"stdout is empty and the exit status is zero"}),
        json!({"kind":"literal","value":"  receipt\t\n"}),
        json!({"kind":"property","value":" \u{2003}owner-defined oracle\n"})].into_iter().enumerate()
    {
        let mut item = check("check/full/output", &[truth]);
        item["spec"]["expected"] = expected;
        publish(project, &proposal(project, &format!("output-control-{n}"), &[(Some(1), attached(vec![item]))]));
    }
    let mut item = check("check/draft", &[truth]);
    item["spec"]["expected"] = json!({"kind":"literal","value":""});
    let input = proposal(project, "output-draft", &[(None, attached(vec![item]))]);
    let before = tree(project);
    let prior = snapshot(project);
    let mut client = Client::open(project);
    let answer = client.call("cadence_apply", input);
    assert_eq!(answer["persisted"], false);
    assert_eq!(answer["validation"], "draft");
    client.finish();
    unchanged(project, &before, &prior);
}

fn origin(identity: &Value, source: &str, slot: &str) -> Value {
    json!({"phase":identity["phase"],"plan":identity["plan"],"source":source,"slot":slot})
}

fn conflicts(answer: &Value, truth: &str, checks: Value) {
    assert_eq!(answer["status"], "refused", "{answer}");
    assert_eq!(answer["code"], "invalid-plan");
    assert_eq!(answer["rule"], "truth-check-limit", "{answer}");
    assert_eq!(answer["id"], truth);
    assert_eq!(answer["phase"], 27);
    assert_eq!(answer["slot"], "submission.plans");
    assert_eq!(answer["entry"], Value::Null);
    assert_eq!(answer["details"], json!({"truth_id":truth,"truth_version":1,"checks":checks}));
    let reason = answer["reason"].as_str().unwrap();
    assert!(reason.contains(truth) && reason.contains("1"));
    for check in checks.as_array().unwrap() {
        assert!(reason.contains(check["id"].as_str().unwrap()));
        for origin in check["origins"].as_array().unwrap() {
            assert!(reason.contains(origin["source"].as_str().unwrap()));
            assert!(reason.contains(origin["slot"].as_str().unwrap()));
            assert!(reason.contains(&format!("plan {}", origin["plan"])));
        }
    }
}

#[test]
fn phase29_distinct_checks_across_plans_are_refused() {
    let temp = fixture();
    let project = temp.path();
    let truth = "truth/full/delivery";
    native_context(project, &[(truth, "the sender sends the parcel", "the recipient", "a receipt")]);
    let original = proposal(project, "saved", &[(None, attached(vec![check("check/saved", &[truth])]))]);
    let saved = publish(project, &original);
    let input = proposal(project, "second", &[(None, attached(vec![check("check/proposed", &[truth])]))]);
    let saved_origin = origin(&saved["results"][0]["identity"], "saved", "current.plans[1].evidence_map.items[0]");
    let proposed_origin = origin(&input["submission"]["plans"][0]["target"], "proposed", "submission.plans[0].content.evidence_map.items[0]");
    for answer in refusals(project, &input) {
        conflicts(&answer, truth, json!([
            {"id":"check/proposed","origins":[proposed_origin]},
            {"id":"check/saved","origins":[saved_origin]}
        ]));
    }
    // All distinct ids are reported, regardless of item input order or equal specs.
    for ids in [["check/z", "check/a", "check/m"], ["check/m", "check/z", "check/a"]] {
        let input = proposal(project, "within", &[(Some(1), attached(ids.iter().map(|id| check(id, &[truth])).collect()))]);
        let mut rows = Vec::new();
        for id in ["check/a", "check/m", "check/z"] {
            let index = ids.iter().position(|candidate| *candidate == id).unwrap();
            rows.push(json!({"id":id,"origins":[origin(&saved["results"][0]["identity"], "proposed",
                &format!("submission.plans[0].content.evidence_map.items[{index}]"))]}));
        }
        for answer in refusals(project, &input) { conflicts(&answer, truth, json!(rows)); }
    }
    let input = proposal(project, "two-within", &[(Some(1), attached(vec![check("check/a", &[truth]), check("check/z", &[truth])]))]);
    for answer in refusals(project, &input) {
        conflicts(&answer, truth, json!([
            {"id":"check/a","origins":[origin(&saved["results"][0]["identity"], "proposed", "submission.plans[0].content.evidence_map.items[0]")]},
            {"id":"check/z","origins":[origin(&saved["results"][0]["identity"], "proposed", "submission.plans[0].content.evidence_map.items[1]")]}
        ]));
    }
    // One definition may have multiple origins; aliases count only once.
    let alias = publish(project, &proposal(project, "alias", &[(None, attached(vec![check("check/saved", &[truth])]))]));
    let second_saved = origin(&alias["results"][0]["identity"], "saved", "current.plans[2].evidence_map.items[0]");
    let input = proposal(project, "alias-conflict", &[(None, attached(vec![check("check/proposed", &[truth])]))]);
    for answer in refusals(project, &input) {
        conflicts(&answer, truth, json!([
            {"id":"check/proposed","origins":[origin(&input["submission"]["plans"][0]["target"], "proposed", "submission.plans[0].content.evidence_map.items[0]")]},
            {"id":"check/saved","origins":[saved_origin,second_saved]}
        ]));
    }
    let input = proposal(project, "partial-replace", &[(Some(1), attached(vec![check("check/new", &[truth])]))]);
    for answer in refusals(project, &input) {
        conflicts(&answer, truth, json!([
            {"id":"check/new","origins":[origin(&saved["results"][0]["identity"], "proposed", "submission.plans[0].content.evidence_map.items[0]")]},
            {"id":"check/saved","origins":[second_saved]}
        ]));
    }
    // Reordering a replacement batch changes only the accurate origin paths.
    for numbers in [[1, 2], [2, 1]] {
        let input = proposal(project, "reordered-batch", &numbers.iter().map(|n|
            (Some(*n), attached(vec![check(if *n == 1 { "check/a" } else { "check/z" }, &[truth])]))).collect::<Vec<_>>());
        let rows = ["check/a", "check/z"].iter().enumerate().map(|(n, id)| {
            let entry = numbers.iter().position(|number| *number == n as u32 + 1).unwrap();
            json!({"id":id,"origins":[origin(&input["submission"]["plans"][entry]["target"], "proposed",
                &format!("submission.plans[{entry}].content.evidence_map.items[0]"))]})
        }).collect::<Vec<_>>();
        for answer in refusals(project, &input) { conflicts(&answer, truth, json!(rows)); }
    }
    let prior = snapshot(project);
    let coordinated = proposal(project, "coordinated", &[
        (Some(2), attached(vec![check("check/new", &[truth])])),
        (Some(1), attached(vec![check("check/new", &[truth])]))]);
    let replaced = publish(project, &coordinated);
    let after = reopened(project).snapshot;
    let old_maps = prior.data["acceptance_maps"]["phases"]["27"]["revisions"].as_array().unwrap();
    assert_eq!(&after.data["acceptance_maps"]["phases"]["27"]["revisions"].as_array().unwrap()[..old_maps.len()], old_maps);
    for id in ["saved", "alias"] {
        assert_eq!(after.data["plan_publications"]["phases"]["27"]["receipts"][id], prior.data["plan_publications"]["phases"]["27"]["receipts"][id]);
    }
    for (old, new) in [(&saved["results"][0], &replaced["results"][1]), (&alias["results"][0], &replaced["results"][0])] {
        assert_eq!(after.data["acceptance_maps"]["phases"]["27"]["superseded"][old["map_revision"].as_str().unwrap()], json!({
            "request_id":"coordinated","identity":new["identity"],"content_revision":new["revision"],"map_revision":new["map_revision"]}));
    }
    let before = tree(project);
    let mut client = Client::open(project);
    let replay = client.call("cadence_apply", approve(original));
    assert_eq!(replay["results"], saved["results"]);
    assert_eq!(replay["replayed"], true);
    assert_eq!(replay["projections"][0]["status"], "newer-authorized");
    client.finish();
    unchanged(project, &before, &after);

    // The first attached multi-plan batch, following a valid provisional winner.
    let initial = fixture();
    let root = initial.path();
    native_context(root, &[(truth, "the sender sends the parcel", "the recipient", "a receipt")]);
    let provisional = proposal(root, "provisional", &[(None, json!({"mode":"provisional"}))]);
    let mut client = Client::open(root);
    assert_eq!(preview(&mut client, &provisional)["status"], "ok");
    assert_eq!(client.call("cadence_apply", approve(provisional))["persisted"], true);
    client.finish();
    let input = proposal(root, "first-attached-batch", &[(None, attached(vec![check("check/a", &[truth])])),
        (None, attached(vec![check("check/z", &[truth])]))]);
    for answer in refusals(root, &input) {
        conflicts(&answer, truth, json!([
            {"id":"check/a","origins":[origin(&input["submission"]["plans"][0]["target"], "proposed", "submission.plans[0].content.evidence_map.items[0]")]},
            {"id":"check/z","origins":[origin(&input["submission"]["plans"][1]["target"], "proposed", "submission.plans[1].content.evidence_map.items[0]")]}
        ]));
    }

    // Legal shared check on several truths, then separate checks on each truth.
    let multi = fixture();
    let root = multi.path();
    native_context(root, &[("truth/A", "the sender sends the parcel", "the recipient", "a receipt"),
        ("truth/B", "the driver arrives", "the customer", "a notification")]);
    publish(root, &proposal(root, "shared-truths", &[(None, attached(vec![check("check/shared", &["truth/A", "truth/B"])]))]));
    publish(root, &proposal(root, "separate-truths", &[(Some(1), attached(vec![check("check/A", &["truth/A"])])),
        (None, attached(vec![check("check/B", &["truth/B"])]))]));

    // A real second caller changes the sole saved check after a legal preview.
    let racing = fixture();
    let root = racing.path();
    native_context(root, &[(truth, "the sender sends the parcel", "the recipient", "a receipt")]);
    publish(root, &proposal(root, "before-race", &[(None, attached(vec![check("check/old", &[truth])]))]));
    let early = proposal(root, "early", &[(None, attached(vec![check("check/old", &[truth])]))]);
    let mut first = Client::open(root);
    assert_eq!(preview(&mut first, &early)["status"], "ok");
    let early_approval = approve(early);
    let winner = publish(root, &proposal(root, "competing", &[(Some(1), attached(vec![check("check/current", &[truth])]))]));
    let before = tree(root);
    let prior = snapshot(root);
    let stale = first.call("cadence_apply", early_approval);
    assert_eq!(stale["status"], "refused", "{stale}");
    assert_eq!(stale["rule"], "allocation-conflict", "{stale}");
    first.finish();
    unchanged(root, &before, &prior);
    let refreshed = proposal(root, "fresh-conflict", &[(None, attached(vec![check("check/old", &[truth])]))]);
    let mut client = Client::open(root);
    let answer = client.call("cadence_apply", approve(refreshed.clone()));
    client.finish();
    conflicts(&answer, truth, json!([
        {"id":"check/current","origins":[origin(&winner["results"][0]["identity"], "saved", "current.plans[1].evidence_map.items[0]")]},
        {"id":"check/old","origins":[origin(&refreshed["submission"]["plans"][0]["target"], "proposed", "submission.plans[0].content.evidence_map.items[0]")]}
    ]));
    unchanged(root, &before, &prior);
}

fn link(value: &str, truths: &[&str]) -> Value {
    json!({"kind":"link","id":"link/full/invoice","reason":"invoice arc package it: losing this value breaks delivery.",
        "spec":{"caller":"unmentioned producer","callee":"unmentioned consumer","value":value},
        "associations":edges(truths)})
}

fn missing_link(answer: &Value, truth: &str, value: &str, association: usize) {
    located(answer, "link-value-not-named", "link/full/invoice", 0, 1, "spec.value");
    assert_eq!(answer["details"], json!({"truth_id":truth,"truth_version":1,
        "association_slot":format!("submission.plans[0].content.evidence_map.items[1].associations[{association}]")}));
    assert!(answer["reason"].as_str().unwrap().contains(value));
    assert!(answer["reason"].as_str().unwrap().contains(truth));
}

#[test]
fn phase29_link_value_absent_from_truth_is_refused() {
    let temp = fixture();
    let project = temp.path();
    let truth = "truth/full/delivery";
    let other = "truth/full/invoice";
    native_context(project, &[(truth, "the sender sends the parcel", "the recipient", "a receipt"),
        (other, "the courier sends the invoice", "the customer", "a parcel")]);
    let shared = check("check/full/invoice", &[truth, other]);
    publish(project, &proposal(project, "winner", &[(None, attached(vec![shared.clone()]))]));
    // Metadata and the other truth deliberately name the absent values.
    for (n, value) in ["invoice", "arc", "Parcel", "package", "it", "the  parcel", "sender-sends"].iter().enumerate() {
        let input = proposal(project, &format!("absent-{n}"), &[(Some(1), attached(vec![shared.clone(), link(value, &[truth])]))]);
        for answer in refusals(project, &input) { missing_link(&answer, truth, value, 0); }
    }
    for (n, value) in ["parcel", " parcel ", "\u{2003}parcel\u{a0}", "the parcel", "recipient", "receipt"].iter().enumerate() {
        publish(project, &proposal(project, &format!("named-{n}"), &[(Some(1), attached(vec![shared.clone(), link(value, &[truth])]))]));
    }
    // Only the first associated truth names receipt; all associations are checked.
    let input = proposal(project, "second-association", &[(Some(1), attached(vec![shared.clone(), link("receipt", &[truth, other])]))]);
    for answer in refusals(project, &input) { missing_link(&answer, other, "receipt", 1); }
    publish(project, &proposal(project, "both-associations", &[(Some(1), attached(vec![shared.clone(), link("parcel", &[truth, other])]))]));

    for field in ["caller", "callee", "value"] {
        for (n, value) in [None, Some(Value::Null), Some(json!(false)), Some(json!(12)), Some(json!({})), Some(json!([])),
            Some(json!("")), Some(json!("  ")), Some(json!("\t\n")), Some(json!("\u{2003}\u{a0}"))].into_iter().enumerate()
        {
            let mut item = link("parcel", &[truth]);
            if let Some(value) = value { item["spec"][field] = value; }
            else { item["spec"].as_object_mut().unwrap().remove(field); }
            let input = proposal(project, &format!("link-content-{field}-{n}"), &[(Some(1), attached(vec![shared.clone(), item]))]);
            for answer in refusals(project, &input) {
                located(&answer, "link-content", "link/full/invoice", 0, 1, &format!("spec.{field}"));
            }
        }
    }

    // Handwritten predicates distinguish Unicode chars from ASCII or bytes.
    // Every case authors native slots and installs a valid winner first.
    for (trigger, value, accepts) in [
        ("the sender sends the parcelé", "parcel", false),
        ("the sender sends the éparcel", "parcel", false),
        ("the sender sends the parcel2", "parcel", false),
        ("the sender sends the 2parcel", "parcel", false),
        ("sends the parcel_2", "parcel", false),
        ("sends the _parcel", "parcel", false),
        ("sends the parcel٢", "parcel", false),
        ("sends the ٢parcel", "parcel", false),
        ("sends the parcel界", "parcel", false),
        ("sends the 界parcel", "parcel", false),
        ("sends the parcel, then", "parcel", true),
        ("sends the (parcel)", "parcel", true),
        ("sends the parcelé then parcel", "parcel", true),
        ("sends the parcelparcel", "parcel", false),
        ("sends the Parcel", "parcel", false),
        ("sends the red  parcel", "red parcel", false),
        ("sends the red  parcel", "red  parcel", true),
        ("sends the parcel-id", "parcel_id", false),
        ("sends the parcel-id", "parcel-id", true),
    ] {
        let temp = fixture();
        let root = temp.path();
        native_context(root, &[(truth, trigger, "the recipient", "a receipt")]);
        let item = check("check/full/delivery", &[truth]);
        publish(root, &proposal(root, "winner", &[(None, attached(vec![item.clone()]))]));
        let input = proposal(root, "lexical", &[(Some(1), attached(vec![item, link(value, &[truth])]))]);
        if accepts { publish(root, &input); }
        else { for answer in refusals(root, &input) { missing_link(&answer, truth, value, 0); } }
    }
    let cross = fixture();
    let root = cross.path();
    native_context(root, &[(truth, "the sender sends the parcel", "recipient", "a receipt")]);
    let item = check("check/full/delivery", &[truth]);
    publish(root, &proposal(root, "winner", &[(None, attached(vec![item.clone()]))]));
    let input = proposal(root, "cross-slot", &[(Some(1), attached(vec![item, link("parcel recipient", &[truth])]))]);
    for answer in refusals(root, &input) { missing_link(&answer, truth, "parcel recipient", 0); }
    // Unresolvable approved authority is inspected in production, never forged
    // into a native context to claim a runtime case that public authoring forbids.
}
