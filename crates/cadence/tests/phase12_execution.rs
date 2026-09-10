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
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .env("GNUPGHOME", project.join(".fixture-gnupg"))
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
            "clientInfo":{"name":"phase12-check","version":"1"}}}),
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
    fs::create_dir_all(root.join("phases/12")).unwrap();
    fs::write(
        root.join("ROADMAP.md"),
        "## Phases\n- [ ] **Phase 12: Plan publication**\n- [ ] **Phase 28: Next phase**\n",
    )
    .unwrap();
    fs::write(
        root.join("config.json"),
        serde_json::to_vec(&json!({"review":{"triggers":{
        "risk_surface":{"surfaces":cadence::rail::risk::CATEGORIES}}}}))
        .unwrap(),
    )
    .unwrap();
    git(temp.path(), &["init", "--initial-branch=fixture/execution"]);
    git(temp.path(), &["add", ".planning"]);
    git(temp.path(), &["commit", "-m", "Fixture baseline"]);
    temp
}

fn native_context(project: &Path, slots: &[(&str, &str, &str, &str)]) {
    let truths = slots.iter().map(|(id, trigger, observer, outcome)| json!({
        "id":id,"trigger":trigger,"observer":observer,"verb":"gets","outcome":outcome,
        "kind":"property","observable":true,"fixed_oracle":true
    })).collect::<Vec<_>>();
    let mut client = Client::open(project);
    let answer = client.call("cadence_apply", approve(json!({
        "operation":"context-submit","submission":{"phase":12,"title":"Limits",
        "scope":"Approved plans only.","durable_decisions":[],"decisions":[],
        "assumptions":[],"truths":truths}
    })));
    assert_eq!(answer["persisted"], true, "native setup: {answer}");
    client.finish();
    let before = tree(project);
    let saved = reopened(project).snapshot;
    assert_eq!(saved.data["context"]["phases"]["12"]["submission"]["truths"], json!(truths));
    for (i, (id, trigger, observer, outcome)) in slots.iter().enumerate() {
        assert_eq!(saved.data["context"]["phases"]["12"]["truths"][i], json!({
            "id":id,"phase":12,"version":1,"pattern":"when",
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
                "execution":{"schema":1,"suite":"printf suite","tasks":[{"id":"task-1","verify":["printf verified"]},{"id":"task-2","verify":["printf documented"]}]},
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
    let allocation = client.read("12", Some(maps.len() as u32));
    assert_eq!(allocation["status"], "ok", "{allocation}");
    client.finish();
    let mut input = request(&allocation, 12, id, &vec![""; maps.len()]);
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
            let document = fs::read_to_string(project.join(format!(".planning/phases/12/PLAN-{plan}.md"))).unwrap();
            entry["replacement"] = json!({"approved":true,"owner":"John Crenshaw",
                "at":"2026-09-10T15:00:00Z","target":entry["target"],
                "old_revision":old["revision"],"old_document":document,"content":entry["content"]});
        }
    }
    input
}

fn preview(client: &mut Client, input: &Value) -> Value {
    client.call("cadence_query", json!({"operation":"plan-read","phase_address":"12",
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
    let occurrence = &prior.data["plan_publications"]["phases"]["12"];
    assert_eq!(occurrence["receipts"][input["submission"]["request_id"].as_str().unwrap()]["results"], answer["results"]);
    for (entry, result) in input["submission"]["plans"].as_array().unwrap().iter().zip(answer["results"].as_array().unwrap()) {
        assert_eq!(result["identity"], entry["target"]);
        assert_eq!(result["content"], entry["content"]);
        assert_eq!(result["approval"], approved["approval"]);
        assert_eq!(occurrence["publications"][result["identity"]["plan"].as_u64().unwrap().to_string()], *result);
        let retained = prior.data["acceptance_maps"]["phases"]["12"]["revisions"].as_array().unwrap().iter()
            .find(|r| r["revision"] == result["map_revision"]).unwrap();
        assert_eq!(retained["items"], entry["content"]["evidence_map"]["items"]);
        assert_eq!(retained["identity"], entry["target"]);
        assert_eq!(retained["content_revision"], result["revision"]);
        let document = fs::read_to_string(project.join(format!(".planning/phases/12/PLAN-{}.md", entry["target"]["plan"]))).unwrap();
        assert!(document.ends_with(entry["content"]["body"].as_str().unwrap()));
    }
    let mut client = Client::open(project);
    let read = client.call("cadence_query", json!({"operation":"evidence-read","phase":12}));
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

fn git(project:&Path,args:&[&str]) {
    let output=Command::new("git").args(["-c","commit.gpgsign=false","-c","user.name=Cadence-Phase12",
        "-c","user.email=phase12@example.invalid"]).args(args).current_dir(project)
        .env("GIT_CONFIG_GLOBAL","/dev/null").env("GIT_CONFIG_NOSYSTEM","1").stdin(Stdio::null()).output().unwrap();
    assert!(output.status.success(),"{}",String::from_utf8_lossy(&output.stderr));
}

fn contract(project:&Path) -> Value {
    let mut client=Client::open(project);
    let published=client.read("12",None);
    let map=client.call("cadence_query",json!({"operation":"evidence-read","phase":12}));
    client.finish();
    let publications=published["native"]["publications"].as_object().unwrap();
    let mut assigned=std::collections::BTreeSet::new();
    let mut plans=Vec::new(); let mut allocation=Vec::new();
    for publication in publications.values() {
        let number=publication["identity"]["plan"].clone();
        plans.push(json!({"plan":number,"publication_request":publication["approval"]["submission"]["request_id"],
            "content_revision":publication["revision"],"map_revision":publication.get("map_revision").cloned().unwrap_or(json!(""))}));
        let items=publication["content"]["evidence_map"]["items"].as_array().cloned().unwrap_or_default();
        for (index,task) in publication["content"]["execution"]["tasks"].as_array().unwrap().iter().enumerate() {
            let mut checks=Vec::new();
            if index==0 {
                for item in &items {
                    if item["kind"]=="check" && assigned.insert(item["id"].as_str().unwrap().to_owned()) {
                        let saved=map["items"].as_array().unwrap().iter().find(|i|i["id"]==item["id"]).unwrap();
                        checks.push(json!({"id":item["id"],"item_revision":saved["item_revision"]}));
                    }
                }
            }
            allocation.push(json!({"plan":number,"task":task["id"],"checks":checks}));
        }
    }
    json!({"phase":12,"occurrence":published["occurrence"],"plans":plans,"allocation":allocation})
}

fn admit_request(contract:Value,id:&str,version:u64) -> Value {
    json!({"operation":if version==0 {"execution-admit"} else {"execution-extend"},
        "request":{"request_id":id,"expected_set_version":version,"contract":contract}})
}

fn apply(project:&Path,request:Value) -> Value {
    let mut client=Client::open(project); let answer=client.call("cadence_apply",request); client.finish(); answer
}

fn admission_refusal(project:&Path,request:Value,rule:&str,slot:&str,id:&str) -> Value {
    let before=tree(project); let prior=snapshot(project);
    let answer=apply(project,request);
    assert_eq!(answer["status"],"refused","{answer}");
    assert_eq!(answer["rule"],rule,"{answer}");
    assert_eq!(answer["slot"],slot,"{answer}");
    if !id.is_empty() {assert_eq!(answer["id"],id,"{answer}");}
    unchanged(project,&before,&prior);
    answer
}

// Native execution checks use caller-owned inputs and the real stdio service.
struct Tiny {
    temp: tempfile::TempDir,
    command: String,
    checks: Vec<Value>,
    red: String,
    green: String,
    pairs: Vec<Value>,
}

fn git_value(project: &Path, args: &[&str]) -> String {
    let output = Command::new("git").args(["-c", "commit.gpgsign=false", "-c", "user.name=Cadence-Phase12", "-c", "user.email=phase12@example.invalid"])
        .args(args).current_dir(project).env("GNUPGHOME", project.join(".fixture-gnupg"))
        .env("GIT_CONFIG_GLOBAL", "/dev/null").env("GIT_CONFIG_NOSYSTEM", "1").stdin(Stdio::null()).output().unwrap();
    assert!(output.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&output.stderr));
    String::from_utf8(output.stdout).unwrap().trim_end().to_owned()
}

fn execution_history(project: &Path) -> Value {
    let mut client = Client::open(project);
    let answer = client.call("cadence_query", json!({"operation":"execution-history","phase":12}));
    assert_eq!(answer["status"], "ok", "{answer}");
    client.finish();
    answer
}

fn task_state(project: &Path, name: &str) -> Value {
    execution_history(project)["tasks"].as_array().unwrap().iter()
        .find(|t| t["task"]["plan"] == 1 && t["task"]["task"] == name).unwrap().clone()
}

impl Tiny {
    fn project(&self) -> &Path { self.temp.path() }
    fn new(mode: &str) -> Self {
        use std::os::unix::fs::PermissionsExt;
        let temp = fixture(); let project = temp.path();
        fs::create_dir(project.join(".fixture-gnupg")).unwrap();
        fs::set_permissions(project.join(".fixture-gnupg"), fs::Permissions::from_mode(0o700)).unwrap();
        let output = Command::new("gpg").env("GNUPGHOME", project.join(".fixture-gnupg"))
            .args(["--batch","--pinentry-mode","loopback","--passphrase","","--quick-generate-key",
                "Cadence-Phase12 <phase12@example.invalid>","ed25519","sign","0"]).stdin(Stdio::null()).output().unwrap();
        assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
        git_value(project, &["config","user.signingkey","phase12@example.invalid"]);
        fs::create_dir(project.join("src")).unwrap(); fs::create_dir(project.join(".run")).unwrap();
        fs::write(project.join(".gitignore"), ".planning/\n.fixture-gnupg/\n.run/\n__pycache__/\n").unwrap();
        fs::write(project.join("src/tiny.py"), "def answer():\n    return 6\n").unwrap();
        fs::write(project.join("outside.txt"), "unchanged rename content for source policy\n").unwrap();
        git_value(project, &["add",".gitignore","src/tiny.py","outside.txt"]);
        git_value(project, &["commit","-m","Fixture tiny subject"]);
        native_context(project, &[("truth/A","the first parcel arrives","the first recipient","a receipt"),
            ("truth/A2","the second parcel arrives","the second recipient","a receipt"),
            ("truth/B","the third parcel arrives","the third recipient","a receipt")]);
        let command = if mode == "missing" { "python3 -B missing.py" } else { "python3 -B tests/check.py" }.to_owned();
        let items: Vec<_> = [("check/A","truth/A"),("check/A2","truth/A2"),("check/B","truth/B")].into_iter().map(|(id,truth)| {
            let mut item = check(id, &[truth]);
            item["spec"]["command"] = json!(command);
            item["spec"]["test"] = json!({"file":"tests/check.py","function":"Check.test_answer"});
            item["spec"]["expected"] = json!({"kind":"property","value":"answer is seven"});
            item
        }).collect();
        let map = attached(items);
        // Shared aliases in a second publication still have one closing owner.
        let mut input = proposal(project, "tiny-plans", &[(None,map.clone()),(None,map)]);
        for entry in input["submission"]["plans"].as_array_mut().unwrap() {
            entry["content"]["files"] = json!(["src/tiny.py","tests/check.py","src/renamed.py"]);
            entry["content"]["directories"] = json!([]);
            entry["content"]["execution"]["tasks"] = json!([{"id":"A","verify":[command]},{"id":"B","verify":[command]},{"id":"C","verify":[command]}]);
        }
        publish(project,&input);
        let mut allocation = contract(project);
        let checks = allocation["allocation"][0]["checks"].as_array().unwrap().clone();
        allocation["allocation"][0]["checks"] = json!(&checks[..2]);
        allocation["allocation"][1]["checks"] = json!([checks[2]]);
        let answer = apply(project,admit_request(allocation,"tiny-admit",0)); assert_eq!(answer["status"],"ok","{answer}");
        let answer = apply(project,json!({"operation":"execution-authorize","phase":12,"request_id":"tiny-authorize","owner":"Fixture Owner",
            "at":"2026-09-10T14:00:00Z","response":"Proceed with native execution"})); assert_eq!(answer["status"],"ok","{answer}");
        let mut client = Client::open(project);
        let dispatch = client.call("cadence_query",json!({"operation":"execute-next","phase":12})); client.finish();
        assert_eq!(dispatch["status"],"ok","{dispatch}");
        for (name, allocated) in [("A",json!(&checks[..2])),("B",json!([checks[2]])),("C",json!([]))] {
            let task = task_state(project,name)["task"].clone();
            let answer = apply(project,json!({"operation":"execution-task-start","request":{"request_id":format!("start-{name}"),"task":task,
                "attempt":format!("attempt-{name}"),"expected_version":0,"predecessor":null,"checks":allocated}}));
            assert_eq!(answer["status"],"ok","{answer}");
        }
        fs::create_dir(project.join("tests")).unwrap();
        let source = if mode == "custom" {
            "import sys\nsys.path.insert(0, 'src')\nfrom tiny import answer\nvalue = answer()\nif value != 7:\n    print('answer: expected 7, received 6')\n    sys.exit(1)\nprint('answer is seven')\n".to_owned()
        } else {
            let setup = if mode == "setup-error" { "    def setUp(self):\n        if answer() == 6:\n            raise RuntimeError('setup stopped')\n" } else { "" };
            format!("import sys, unittest, pathlib\nsys.path.insert(0, 'src')\nfrom tiny import answer\nunittest.runner.time.perf_counter = lambda: 0.0\nclass Check(unittest.TestCase):\n{setup}    def test_answer(self):\n        pathlib.Path('.run/body').write_text('body ran')\n        self.assertEqual(answer(), 7)\nif __name__ == '__main__':\n    unittest.main()\n")
        };
        fs::write(project.join("tests/check.py"), source).unwrap();
        if mode == "outside" { fs::write(project.join("outside.txt"),"out-of-lease red evidence\n").unwrap(); git_value(project,&["add","outside.txt"]); }
        if mode == "rename" { git_value(project,&["mv","outside.txt","src/renamed.py"]); }
        git_value(project,&["add","tests/check.py"]); git_value(project,&["commit","-m","test(12): tiny check red A"]);
        let red = git_value(project,&["rev-parse","HEAD"]);
        let mut fixture = Self { temp, command, checks, red, green:String::new(), pairs:vec![] };
        for i in 0..3 { fixture.run(if i < 2 {"A"} else {"B"},&format!("red-{i}"),Some(i),"red"); }
        if mode == "setup-error" { assert!(!fixture.project().join(".run/body").exists(),"setUp error must precede the body"); }
        fs::write(fixture.project().join("src/tiny.py"), "def answer():\n    return 7\n").unwrap();
        git_value(fixture.project(),&["add","src/tiny.py"]); git_value(fixture.project(),&["commit","-S","-m","feat(12): tiny subject green A"]);
        fixture.green = git_value(fixture.project(),&["rev-parse","HEAD"]);
        assert_eq!(git_value(fixture.project(),&["show",&format!("{}:tests/check.py",fixture.red)]),git_value(fixture.project(),&["show",&format!("{}:tests/check.py",fixture.green)]));
        for i in 0..3 {
            fixture.run(if i < 2 {"A"} else {"B"},&format!("green-{i}"),Some(i),"green");
            fixture.pairs.push(json!({"check":fixture.checks[i],"red_commit":fixture.red,"green_commit":fixture.green,
                "red_run":format!("red-{i}"),"green_run":format!("green-{i}")}));
        }
        fixture
    }
    fn run(&self, task: &str, id: &str, check: Option<usize>, stage: &str) -> Value {
        let state = task_state(self.project(),task);
        let request = json!({"operation":"execution-run","request":{"request_id":id,"task":state["task"],"attempt":format!("attempt-{task}"),
            "expected_version":state["state"]["version"],"command":self.command,"check":check.map(|i|self.checks[i].clone()),"stage":stage}});
        let mut client = Client::open(self.project());
        let launch = client.call("cadence_apply",request.clone()); assert_eq!(launch["status"],"ok","{launch}");
        let deadline = std::time::Instant::now()+std::time::Duration::from_secs(20);
        let result = loop {
            let history = client.call("cadence_query",json!({"operation":"execution-history","phase":12}));
            if let Some(record) = history["events"].as_array().unwrap().iter().find(|e| e["request"]["event"]["kind"] == "result" && e["request"]["event"]["run_id"] == id) { break record.clone(); }
            assert!(std::time::Instant::now()<deadline,"runner result timed out: {history}");
            std::thread::sleep(std::time::Duration::from_millis(10));
        };
        assert_eq!(client.call("cadence_apply",request)["receipt"],launch["receipt"],"launch replay");
        client.finish();
        let event = &result["request"]["event"];
        assert_eq!(event["material_unchanged"],true,"{event}");
        assert!(event["observed_at"].as_u64().unwrap()>=launch["receipt"]["request"]["event"]["launched_at"].as_u64().unwrap());
        for stream in ["stdout","stderr"] {
            let bytes:Vec<u8>=serde_json::from_value(event[stream]["bytes"].clone()).unwrap();
            assert_eq!(event[stream]["digest"],model::digest(&bytes)); assert_eq!(event[stream]["complete"],true);
        }
        result
    }
    fn owner(&self, i: usize, id: &str, affirmative: bool) -> Value {
        let task = if i<2 {"A"} else {"B"}; let state=task_state(self.project(),task);
        let history=execution_history(self.project());
        let launch=history["events"].as_array().unwrap().iter().find(|e|e["request"]["event"]["run_id"]==format!("red-{i}") && e["request"]["event"]["kind"]=="launch").unwrap();
        let submission=json!({"check":self.checks[i],"test_digest":launch["request"]["event"]["material"]["test_digest"],
            "evidence":[format!("red-{i}"),format!("green-{i}")],"no_subject_stub":affirmative});
        json!({"operation":"execution-owner-attest","request":{"request_id":id,"task":state["task"],"attempt":format!("attempt-{task}"),
            "expected_version":state["state"]["version"],"statement":{"submission":submission,"supersedes":null,
                "approval":{"approved":true,"owner":"Fixture Owner","at":"2026-09-10T15:00:00Z","submission":submission}}}})
    }
    fn attest(&self) {
        for i in 0..3 { let answer=apply(self.project(),self.owner(i,&format!("owner-{i}"),true)); assert_eq!(answer["status"],"ok","{answer}"); }
    }
    fn close(&self, id: &str) -> Value {
        let state=task_state(self.project(),"A");
        json!({"operation":"execution-task-close","request":{"request_id":id,"task":state["task"],"attempt":"attempt-A",
            "expected_version":state["state"]["version"],"completion":self.green,"checks":&self.pairs[..2],"verification":["green-0"]}})
    }
    fn classify(&self, index: usize, red: bool) -> Value {
        let task=if index<2 {"A"} else {"B"};let state=task_state(self.project(),task);
        let run=format!("{}-{index}",if red {"red"} else {"green"});
        let history=execution_history(self.project());
        let result=&history["events"].as_array().unwrap().iter().find(|r|r["request"]["event"]["kind"]=="result" && r["request"]["event"]["run_id"]==run).unwrap()["request"]["event"];
        let identity=model::digest(format!("{}\n{}",result["stdout"]["digest"].as_str().unwrap(),result["stderr"]["digest"].as_str().unwrap()).as_bytes());
        let submission=json!({"run_id":run,"output_identity":identity,"check":self.checks[index],"interpretation":if red {"red-eligible"} else {"green-eligible"}});
        json!({"operation":"execution-classify-run","request":{"request_id":format!("classify-{run}"),"task":state["task"],"attempt":format!("attempt-{task}"),
            "expected_version":state["state"]["version"],"statement":{"submission":submission,
                "approval":{"approved":true,"owner":"Fixture Owner","at":"2026-09-10T15:00:00Z","submission":submission}}}})
    }
}

fn close_refused(project:&Path, request:Value, rule:&str, ids:&[&str]) -> Value {
    let before=tree(project);let prior=reopened(project).snapshot;
    let answer=apply(project,request);assert_eq!(answer["status"],"refused","{answer}");
    assert_eq!(answer["rule"],rule,"{answer}");
    for id in ids {assert!(answer["details"]["unsatisfied"].as_array().unwrap().iter().any(|c|c["id"]==*id),"missing {id}: {answer}");}
    unchanged(project,&before,&prior);answer
}

#[test]
fn phase12_task_close_requires_red_then_green() {
    let fixture=Tiny::new("unittest");fixture.attest();let project=fixture.project();
    let good=fixture.close("close-A");
    // Complete caller input is checked against the real public production type.
    let _:cadence::execution::receipts::CloseApply=serde_json::from_value(good.clone()).unwrap();
    let history=execution_history(project);
    for (id,failed,code,needle) in [("red-0",true,1,"6 != 7"),("green-0",false,0,"OK\n")] {
        let event=&history["events"].as_array().unwrap().iter().find(|r|r["request"]["event"]["kind"]=="result" && r["request"]["event"]["run_id"]==id).unwrap()["request"]["event"];
        assert_eq!(event["disposition"],json!({"kind":"exited","code":code}));
        assert_eq!(event["observation"],json!({"class":"results-observed","summary":{"runner":"unittest","failed":failed,"failures":if failed {1}else{0},"errors":0}}));
        assert_eq!(event["stdout"]["bytes"],json!([]));
        let stderr=String::from_utf8(serde_json::from_value(event["stderr"]["bytes"].clone()).unwrap()).unwrap();
        assert!(stderr.contains("Ran 1 test in 0.000s\n"),"{stderr}");assert!(stderr.contains(needle),"{stderr}");
        if failed {assert!(stderr.ends_with("FAILED (failures=1)\n"));}
        else {assert_eq!(stderr,".\n----------------------------------------------------------------------\nRan 1 test in 0.000s\n\nOK\n");}
    }
    let unrelated=git_value(project,&["commit-tree",&git_value(project,&["rev-parse","HEAD^{tree}"]),"-m","Unrelated evidence"]);
    for case in 0..13 {
        let mut bad=good.clone();bad["request"]["request_id"]=json!(format!("invalid-{case}"));
        let pair=&mut bad["request"]["checks"][0];
        match case {
            0=>bad["request"]["checks"]=json!([]),
            1=>{pair["green_commit"]=json!("");pair["green_run"]=json!("");},
            2=>{pair["red_commit"]=json!("");pair["red_run"]=json!("");},
            3=>{pair["red_commit"]=json!(fixture.green);pair["red_run"]=json!("green-0");},
            4=>{pair["red_commit"]=json!(fixture.green);pair["green_commit"]=json!(fixture.red);pair["red_run"]=json!("green-0");pair["green_run"]=json!("red-0");},
            5=>pair["red_commit"]=json!(unrelated),
            6=>pair["check"]["item_revision"]=json!("stale"),
            7=>pair["red_commit"]=json!("f".repeat(40)),
            8=>{pair["red_run"]=json!("unrecorded-red");pair["green_run"]=json!("unrecorded-green");},
            9=>{pair["exit_code"]=json!(1);pair["output"]=json!("caller says red");},
            10=>pair["green_commit"]=json!(fixture.red),
            11=>bad["request"]["checks"]=json!([fixture.pairs[2].clone()]),
            _=>bad["request"]["checks"]=json!([fixture.pairs[0].clone()]),
        }
        let expected:&[&str]=if case==12 {&["check/A2"]} else if matches!(case,0|11) {&["check/A","check/A2"]} else {&["check/A"]};
        close_refused(project,bad,"red-green",expected);
    }
    // Real source dirt is refused before spawning another child.
    fs::write(project.join("src/tiny.py"),"def answer():\n    return 8\n").unwrap();
    let state=task_state(project,"A");let before=tree(project);let prior=reopened(project).snapshot;
    let dirty=apply(project,json!({"operation":"execution-run","request":{"request_id":"dirty-run","task":state["task"],"attempt":"attempt-A",
        "expected_version":state["state"]["version"],"command":fixture.command,"check":fixture.checks[0],"stage":"red"}}));
    assert_eq!(dirty["status"],"refused","{dirty}");unchanged(project,&before,&prior);
    git_value(project,&["restore","src/tiny.py"]);
    // A passing run with changed test bytes cannot pair with the original red.
    let test=fs::read(project.join("tests/check.py")).unwrap();fs::write(project.join("tests/check.py"),[test.as_slice(),b"\n# Changed test material\n"].concat()).unwrap();
    git_value(project,&["add","tests/check.py"]);git_value(project,&["commit","-S","-m","test(12): changed check material A"]);
    let changed=git_value(project,&["rev-parse","HEAD"]);fixture.run("A","changed-green",Some(0),"green");
    let mut bad=fixture.close("changed-test");bad["request"]["completion"]=json!(changed);bad["request"]["checks"][0]["green_commit"]=json!(changed);bad["request"]["checks"][0]["green_run"]=json!("changed-green");
    close_refused(project,bad,"red-green",&["check/A"]);git_value(project,&["reset","--hard",&fixture.green]);
    let accepted_request=fixture.close("close-A");let accepted=apply(project,accepted_request.clone());assert_eq!(accepted["status"],"ok","real red/green should close: {accepted}");
    let before=tree(project);let prior=reopened(project).snapshot;
    assert_eq!(apply(project,accepted_request.clone())["receipt"],accepted["receipt"]);unchanged(project,&before,&prior);
    let mut malformed=accepted_request;malformed["request"]["checks"][0]["red_run"]=json!("replaced");
    close_refused(project,malformed,"task-request-reuse",&[]);
    close_refused(project,fixture.close("duplicate-close"),"task-completed",&[]);
    assert_eq!(task_state(project,"A")["state"]["completed"],true);
    assert_eq!(git_value(project,&["show",&format!("{}:src/tiny.py",fixture.red)]),"def answer():\n    return 6");
    assert_eq!(git_value(project,&["show",&format!("{}:src/tiny.py",fixture.green)]),"def answer():\n    return 7");
    // Explicit empty allocation still needs a signed conventional completion and
    // observed named verification, but no invented check or owner record.
    git_value(project,&["commit","--allow-empty","-S","-m","feat(12): finish empty allocation C"]);
    let empty_commit=git_value(project,&["rev-parse","HEAD"]);fixture.run("C","empty-verify",None,"verify");
    let state=task_state(project,"C");let empty=apply(project,json!({"operation":"execution-task-close","request":{"request_id":"close-C","task":state["task"],"attempt":"attempt-C",
        "expected_version":state["state"]["version"],"completion":empty_commit,"checks":[],"verification":["empty-verify"]}}));
    assert_eq!(empty["status"],"ok","{empty}");

    for mode in ["setup-error","missing","outside","rename"] {
        let control=Tiny::new(mode);control.attest();let project=control.project();
        let history=execution_history(project);let result=&history["events"].as_array().unwrap().iter().find(|r|r["request"]["event"]["kind"]=="result" && r["request"]["event"]["run_id"]=="red-0").unwrap()["request"]["event"];
        if mode=="setup-error" {
            assert_eq!(result["observation"],json!({"class":"results-observed","summary":{"runner":"unittest","failed":true,"failures":0,"errors":1}}));
            let request=control.classify(0,true);let answer=apply(project,request);assert_eq!(answer["status"],"refused","known errors cannot be owner-classified: {answer}");
        }
        if mode=="missing" {assert_eq!(result["observation"],json!({"class":"unknown"}));assert_eq!(result["disposition"]["code"],2);}
        let rule=if matches!(mode,"outside"|"rename") {"lease"} else {"red-green"};
        let answer=close_refused(project,control.close("invalid-control"),rule,if rule=="red-green" {&["check/A","check/A2"]}else{&[]});
        if matches!(mode,"outside"|"rename") {assert!(answer["reason"].as_str().unwrap().contains("outside.txt"));}
    }
    let custom=Tiny::new("custom");custom.attest();let project=custom.project();
    let before_classification=execution_history(project);
    for (id,expected,code) in [("red-0","answer: expected 7, received 6\n",1),("green-0","answer is seven\n",0)] {
        let result=&before_classification["events"].as_array().unwrap().iter().find(|r|r["request"]["event"]["kind"]=="result" && r["request"]["event"]["run_id"]==id).unwrap()["request"]["event"];
        assert_eq!(result["observation"],json!({"class":"unknown"}));assert_eq!(result["disposition"],json!({"kind":"exited","code":code}));
        assert_eq!(result["stdout"]["bytes"],json!(expected.as_bytes()));assert_eq!(result["stderr"]["bytes"],json!([]));assert_eq!(result["stdout"]["digest"],model::digest(expected.as_bytes()));
    }
    close_refused(project,custom.close("custom-unclassified"),"red-green",&["check/A","check/A2"]);
    for case in 0..4 {
        let mut request=custom.classify(0,true);request["request"]["request_id"]=json!(format!("bad-class-{case}"));
        match case {
            0=>request["request"]["statement"]["submission"]["output_identity"]=json!("changed"),
            1=>request["request"]["statement"]["submission"]["check"]["item_revision"]=json!("stale"),
            2=>request["request"]["statement"]["submission"]["run_id"]=json!("green-0"),
            _=>{request["request"]["statement"].as_object_mut().unwrap().remove("approval");request["request"]["statement"]["role"]=json!("owner");},
        }
        if case<3 {request["request"]["statement"]["approval"]["submission"]=request["request"]["statement"]["submission"].clone();}
        let before=tree(project);let prior=reopened(project).snapshot;let answer=apply(project,request);assert_eq!(answer["status"],"refused","{answer}");unchanged(project,&before,&prior);
    }
    let first=custom.classify(0,true);let accepted=apply(project,first.clone());assert_eq!(accepted["status"],"ok","{accepted}");
    assert_eq!(apply(project,first)["receipt"],accepted["receipt"]);
    close_refused(project,custom.close("custom-half"),"red-green",&["check/A","check/A2"]);
    for (i,red) in [(0,false),(1,true),(1,false)] {let answer=apply(project,custom.classify(i,red));assert_eq!(answer["status"],"ok","{answer}");}
    let answer=apply(project,custom.close("custom-close"));assert_eq!(answer["status"],"ok","{answer}");
    let after=execution_history(project);
    for event in before_classification["events"].as_array().unwrap() {assert!(after["events"].as_array().unwrap().contains(event),"owner interpretation cannot rewrite an observation");}
    assert_eq!(task_state(project,"A")["state"]["completed"],true);
}

#[test]
fn phase12_task_close_requires_owner_no_stub_attestation() {
    let fixture=Tiny::new("unittest");let project=fixture.project();
    close_refused(project,fixture.close("missing-owner"),"owner-attestation",&["check/A","check/A2"]);
    for i in 0..2 {let answer=apply(project,fixture.owner(i,&format!("false-{i}"),false));assert_eq!(answer["status"],"ok","{answer}");}
    close_refused(project,fixture.close("false-owner"),"owner-attestation",&["check/A","check/A2"]);
    for case in 0..4 {
        let mut request=fixture.owner(0,&format!("stale-owner-{case}"),true);
        match case {
            0=>request["request"]["statement"]["submission"]["check"]["item_revision"]=json!("old-revision"),
            1=>request["request"]["statement"]["submission"]["test_digest"]=json!("old-test-material"),
            2=>request["request"]["statement"]["submission"]["evidence"]=json!(["another-inspection"]),
            _=>{request["request"]["statement"].as_object_mut().unwrap().remove("approval");request["request"]["statement"]["no_stub"]=json!(true);request["request"]["statement"]["role"]=json!("owner");},
        }
        if case<3 {request["request"]["statement"]["approval"]["submission"]=request["request"]["statement"]["submission"].clone();}
        let before=tree(project);let prior=reopened(project).snapshot;let answer=apply(project,request);assert_eq!(answer["status"],"refused","{answer}");unchanged(project,&before,&prior);
        close_refused(project,fixture.close(&format!("close-stale-owner-{case}")),"owner-attestation",&["check/A","check/A2"]);
    }
    let mut first=fixture.owner(0,"affirmative-0",true);first["request"]["statement"]["supersedes"]=json!("false-0");
    let answer=apply(project,first.clone());assert_eq!(answer["status"],"ok","{answer}");
    assert_eq!(answer["receipt"]["request"]["event"]["approval"],first["request"]["statement"]["approval"]);
    let before=tree(project);let prior=reopened(project).snapshot;assert_eq!(apply(project,first)["receipt"],answer["receipt"]);unchanged(project,&before,&prior);
    close_refused(project,fixture.close("only-one-owner"),"owner-attestation",&["check/A2"]);
    // An affirmative statement inspecting only the red run is retained honestly,
    // but does not attest the exact pair offered at close.
    let mut partial=fixture.owner(1,"partial-inspection",true);partial["request"]["statement"]["submission"]["evidence"]=json!(["red-1"]);
    partial["request"]["statement"]["approval"]["submission"]=partial["request"]["statement"]["submission"].clone();
    let answer=apply(project,partial);assert_eq!(answer["status"],"ok","{answer}");
    close_refused(project,fixture.close("different-inspection"),"owner-attestation",&["check/A2"]);
    let second=fixture.owner(1,"affirmative-1",true);let answer=apply(project,second.clone());assert_eq!(answer["status"],"ok","{answer}");
    assert_eq!(answer["receipt"]["request"]["event"]["submission"],second["request"]["statement"]["submission"]);
    let close=fixture.close("owner-complete");let answer=apply(project,close.clone());assert_eq!(answer["status"],"ok","{answer}");
    let before=tree(project);let prior=reopened(project).snapshot;assert_eq!(apply(project,close)["receipt"],answer["receipt"]);unchanged(project,&before,&prior);
    close_refused(project,fixture.close("owner-duplicate"),"task-completed",&[]);
    // No-check task requires no invented owner statement.
    git_value(project,&["commit","--allow-empty","-S","-m","feat(12): complete empty owner allocation C"]);
    let completion=git_value(project,&["rev-parse","HEAD"]);fixture.run("C","owner-empty-verify",None,"verify");let state=task_state(project,"C");
    let answer=apply(project,json!({"operation":"execution-task-close","request":{"request_id":"owner-empty-close","task":state["task"],"attempt":"attempt-C",
        "expected_version":state["state"]["version"],"completion":completion,"checks":[],"verification":["owner-empty-verify"]}}));assert_eq!(answer["status"],"ok","{answer}");

    // Previously valid owner records become stale when the actual test material
    // and inspected runs change, even though the current real pair is valid.
    let mut stale=Tiny::new("unittest");stale.attest();
    let old_history=execution_history(stale.project());
    let old_test=fs::read(stale.project().join("tests/check.py")).unwrap();
    fs::write(stale.project().join("tests/check.py"),[old_test.as_slice(),b"\n# New inspected material\n"].concat()).unwrap();
    fs::write(stale.project().join("src/tiny.py"),"def answer():\n    return 6\n").unwrap();
    git_value(stale.project(),&["add","tests/check.py","src/tiny.py"]);git_value(stale.project(),&["commit","-m","test(12): fresh owner evidence A"]);
    let red=git_value(stale.project(),&["rev-parse","HEAD"]);
    for i in 0..2 {stale.run("A",&format!("new-red-{i}"),Some(i),"red");}
    fs::write(stale.project().join("src/tiny.py"),"def answer():\n    return 7\n").unwrap();git_value(stale.project(),&["add","src/tiny.py"]);
    git_value(stale.project(),&["commit","-S","-m","feat(12): fresh passing owner evidence A"]);stale.green=git_value(stale.project(),&["rev-parse","HEAD"]);
    for i in 0..2 {stale.run("A",&format!("new-green-{i}"),Some(i),"green");stale.pairs[i]=json!({"check":stale.checks[i],"red_commit":red,"green_commit":stale.green,"red_run":format!("new-red-{i}"),"green_run":format!("new-green-{i}")});}
    let mut stale_close=stale.close("material-stale-owner");stale_close["request"]["verification"]=json!(["new-green-0"]);
    close_refused(stale.project(),stale_close,"owner-attestation",&["check/A","check/A2"]);
    for i in 0..2 {
        let mut request=stale.owner(i,&format!("new-owner-{i}"),true);
        request["request"]["statement"]["submission"]["test_digest"]=json!(model::digest(&fs::read(stale.project().join("tests/check.py")).unwrap()));
        request["request"]["statement"]["submission"]["evidence"]=json!([format!("new-red-{i}"),format!("new-green-{i}")]);
        request["request"]["statement"]["approval"]["submission"]=request["request"]["statement"]["submission"].clone();
        let answer=apply(stale.project(),request);assert_eq!(answer["status"],"ok","{answer}");
    }
    let mut close=stale.close("fresh-owner-close");close["request"]["verification"]=json!(["new-green-0"]);
    let answer=apply(stale.project(),close);assert_eq!(answer["status"],"ok","{answer}");
    let after=execution_history(stale.project());for event in old_history["events"].as_array().unwrap() {assert!(after["events"].as_array().unwrap().contains(event));}
}

struct Historical {root:PathBuf,_lock:fs::File}
impl Historical {
    fn restore() -> Self {
        use std::os::fd::AsRawFd;
        let fixture:Value=serde_json::from_str(include_str!("fixtures/phase12_pre29_blank.json")).unwrap();
        let root=PathBuf::from(fixture["root"].as_str().unwrap());
        let lock=fs::OpenOptions::new().create(true).truncate(false).write(true).open(fixture["lock"].as_str().unwrap()).unwrap();
        assert_eq!(unsafe {libc::flock(lock.as_raw_fd(),libc::LOCK_EX|libc::LOCK_NB)},0,"exclusive historical fixture ownership required");
        assert!(!root.exists(),"foreign fixture contents must not be replaced");
        let output=Command::new("python3").args(["-c",
            "import base64,hashlib,json,pathlib,sys; f=json.load(open(sys.argv[1])); r=pathlib.Path(f['root']); r.mkdir(); [(r.joinpath(p).parent.mkdir(parents=True,exist_ok=True),r.joinpath(p).write_bytes(base64.b64decode(v['base64'])),r.joinpath(p).chmod(v['mode'])) for p,v in f['files'].items()]; assert all(hashlib.sha256(r.joinpath(p).read_bytes()).hexdigest()==v['sha256'] for p,v in f['files'].items())",
            concat!(env!("CARGO_MANIFEST_DIR"),"/tests/fixtures/phase12_pre29_blank.json")]).stdin(Stdio::null()).output().unwrap();
        assert!(output.status.success(),"{}",String::from_utf8_lossy(&output.stderr));
        Self {root,_lock:lock}
    }
}
impl Drop for Historical {
    fn drop(&mut self) {
        assert_eq!(fs::read_to_string(self.root.join(".phase12-owner")).unwrap(),"cadence-phase12-pre29-5b7de640");
        fs::remove_dir_all(&self.root).unwrap();
    }
}

#[test]
fn phase12_incomplete_execution_contract_is_refused() {
    let temp=fixture(); let project=temp.path();
    let truths=["truth/A","truth/B"];
    native_context(project,&[(truths[0],"the sender sends the parcel","the recipient","a receipt"),
        (truths[1],"the courier arrives","the customer","a receipt")]);
    let mut shared=check("check/shared",&truths);
    shared["spec"]["test"]=json!({"file":"tests/not_yet_written.rs","function":"delivery"});
    let map=attached(vec![shared.clone(),artifact("artifact/delivery",&truths)]);
    publish(project,&proposal(project,"native",&[(None,map.clone()),(None,attached(vec![shared.clone()]))]));
    let basis=contract(project);
    let valid=admit_request(basis.clone(),"valid",0);
    // The same advertised public type used by the real decoder must accept the
    // caller's complete payload; no helper-only admission schema substitutes.
    let _:cadence::execution::boundary::NativeApply=serde_json::from_value(valid.clone()).unwrap();
    assert!(!project.join("tests/not_yet_written.rs").exists());
    assert_eq!(basis["allocation"].as_array().unwrap().len(),4);
    assert_eq!(basis["allocation"][0]["checks"][0]["id"],"check/shared");
    assert_eq!(basis["allocation"][1]["checks"],json!([]));
    assert_eq!(basis["allocation"][2]["checks"],json!([]));

    for (n,rule,slot,id) in [
        (0,"admission-shape","contract.allocation",""),
        (1,"allocation-task","contract.allocation","task-2"),
        (2,"allocation-task","contract.allocation[0]","unknown-task"),
        (3,"allocation-item","contract.allocation[0].checks[0].id","unknown-item"),
        (4,"allocation-kind","contract.allocation[0].checks[0].id","artifact/delivery"),
        (5,"allocation-revision","contract.allocation[0].checks[0].item_revision","check/shared"),
        (6,"allocation-check","contract.allocation","check/shared"),
        (7,"allocation-owner","contract.allocation[2].checks[0]","check/shared"),
    ] {
        let mut bad=basis.clone();
        match n {
            0=>{bad.as_object_mut().unwrap().remove("allocation");},
            1=>{bad["allocation"].as_array_mut().unwrap().remove(1);},
            2=>bad["allocation"][0]["task"]=json!("unknown-task"),
            3=>bad["allocation"][0]["checks"][0]["id"]=json!("unknown-item"),
            4=>bad["allocation"][0]["checks"][0]["id"]=json!("artifact/delivery"),
            5=>bad["allocation"][0]["checks"][0]["item_revision"]=json!("stale"),
            6=>bad["allocation"][0]["checks"]=json!([]),
            7=>bad["allocation"][2]["checks"]=bad["allocation"][0]["checks"].clone(),_=>unreachable!(),
        }
        admission_refusal(project,admit_request(bad,&format!("invalid-{n}"),0),rule,slot,id);
    }
    for field in ["publication_request","content_revision","map_revision"] {
        let mut bad=basis.clone();bad["plans"][0][field]=json!("stale");
        admission_refusal(project,admit_request(bad,field,0),"admission-binding",&format!("contract.plans[0].{field}"),"1");
    }
    let mut bad=basis.clone();bad["occurrence"]=json!("wrong-occurrence");
    admission_refusal(project,admit_request(bad,"occurrence",0),"admission-occurrence","contract.occurrence","");
    let path=project.join(".planning/phases/12/PLAN-1.md");let bytes=fs::read(&path).unwrap();
    fs::write(&path,[bytes.as_slice(),b"\n"].concat()).unwrap();
    admission_refusal(project,valid.clone(),"installed-plan","phases/12/PLAN-1.md","1");
    fs::write(&path,bytes).unwrap();
    let legacy=project.join(".planning/phases/12/PLAN-3.md");
    fs::write(&legacy,"# Unretained legacy PLAN\n").unwrap();
    admission_refusal(project,valid.clone(),"mixed-plan-set","phases/12/PLAN-3.md","phases/12/PLAN-3.md");
    fs::remove_file(legacy).unwrap();

    // A competing approved replacement invalidates an observed admission basis.
    let old=valid.clone();
    let mut changed=shared.clone();changed["spec"]["command"]=json!("revised-custom-check");
    publish(project,&proposal(project,"replacement",&[(Some(1),attached(vec![changed.clone(),artifact("artifact/delivery",&truths)])),
        (Some(2),attached(vec![changed]))]));
    admission_refusal(project,old,"admission-binding","contract.plans[0].publication_request","1");
    let valid=admit_request(contract(project),"valid-current",0);
    let accepted=apply(project,valid.clone());
    assert_eq!(accepted["status"],"ok","valid native admission: {accepted}");
    assert_eq!(accepted["receipt"]["set_version"],1);
    assert_eq!(accepted["receipt"]["request"],valid["request"]);
    let before=tree(project);let prior=reopened(project).snapshot;
    let replay=apply(project,valid.clone());
    assert_eq!(replay["receipt"],accepted["receipt"]);assert_eq!(replay["replayed"],true);
    unchanged(project,&before,&prior);
    let authorize=apply(project,json!({"operation":"execution-authorize","phase":12,"request_id":"start",
        "owner":"Fixture Owner","at":"2026-09-10T15:00:00Z","response":"Proceed with this phase"}));
    assert_eq!(authorize["status"],"ok","{authorize}");
    let mut client=Client::open(project);
    let dispatch=client.call("cadence_query",json!({"operation":"execute-next","phase":12}));
    client.finish();
    assert_eq!(dispatch["status"],"ok","valid native dispatch: {dispatch}");
    assert_eq!(dispatch["outcome"],"dispatch");assert_eq!(dispatch["dispatch"]["plan"],1);
    assert_eq!(dispatch["dispatch"]["tasks"],json!([{"id":"task-1","verify":["printf verified"]},{"id":"task-2","verify":["printf documented"]}]));
    assert!(!project.join("tests/not_yet_written.rs").exists());
    let original_record=serde_json::to_vec(&prior.data["native_admissions"]["phases"]["12"][0]).unwrap();
    let original_execution=snapshot(project).data["execution"].clone();
    let replacement=proposal(project,"admitted-replacement",&[(Some(2),map)]);
    admission_refusal(project,approve(replacement),"admitted-plan","submission","");
    publish(project,&proposal(project,"gap",&[(None,attached(vec![artifact("artifact/gap",&truths)]))]));
    let extended=contract(project);
    admission_refusal(project,admit_request(extended.clone(),"implicit",0),"admission-set-version","expected_set_version","implicit");
    let mut moved=extended.clone();moved["allocation"][4]["checks"]=moved["allocation"][0]["checks"].clone();moved["allocation"][0]["checks"]=json!([]);
    admission_refusal(project,admit_request(moved,"move",1),"admission-reassignment","contract.allocation","task-1");
    let extension=admit_request(extended.clone(),"extend",1);
    let answer=apply(project,extension.clone());
    assert_eq!(answer["status"],"ok","{answer}");assert_eq!(answer["receipt"]["set_version"],2);
    let before=tree(project);let after=reopened(project).snapshot;
    assert_eq!(after.data["native_admissions"]["phases"]["12"].as_array().unwrap().len(),2);
    assert_eq!(serde_json::to_vec(&after.data["native_admissions"]["phases"]["12"][0]).unwrap(),original_record);
    assert_eq!(after.data["execution"],original_execution,"extension preserves original dispatch and risk basis");
    assert_eq!(apply(project,extension)["receipt"],answer["receipt"]);
    assert_eq!(apply(project,valid)["receipt"],accepted["receipt"]);
    unchanged(project,&before,&after);
    admission_refusal(project,admit_request(extended,"stale-extension",1),"admission-set-version","expected_set_version","stale-extension");

    let provisional=fixture();let root=provisional.path();
    native_context(root,&[("truth/P","the sender sends the parcel","the recipient","a receipt")]);
    let proposal=proposal(root,"provisional",&[(None,json!({"mode":"provisional"}))]);
    assert_eq!(apply(root,approve(proposal))["persisted"],true);
    admission_refusal(root,admit_request(contract(root),"mapless",0),"admission-binding","contract.plans[0].map_revision","1");

    let historical=Historical::restore();let root=&historical.root;
    let captured:Value=serde_json::from_str(include_str!("fixtures/phase12_pre29_blank.json")).unwrap();
    let old_request=captured["transcript"].as_array().unwrap().iter().find_map(|e| {
        let input=&e["request"]["params"]["arguments"];
        (input["operation"]=="plan-submit").then(||input.clone())
    }).unwrap();
    let before=tree(root);let prior=reopened(root).snapshot;
    assert_eq!(apply(root,old_request)["replayed"],true);
    unchanged(root,&before,&prior);
    let mut historical_contract=contract(root);
    // Select the valid plan first; admission must still inspect the offender
    // in the whole current union, independent of caller plan ordering.
    historical_contract["plans"].as_array_mut().unwrap().reverse();
    assert_eq!(historical_contract["plans"][0]["plan"],2);
    admission_refusal(root,admit_request(historical_contract,"historical",0),"check-command",
        "current.plans[1].evidence_map.items[0].spec.command","check/historical");
}
