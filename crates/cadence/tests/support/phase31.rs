//! Real-binary fixtures for the phase 31 read-layer acceptance checks.
use serde_json::{Value, json};
use std::{
    collections::BTreeMap,
    fs,
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
};

pub struct Client {
    child: Child,
    stdin: Option<ChildStdin>,
    stdout: BufReader<std::process::ChildStdout>,
    pending: BTreeMap<u64, Value>,
    pub send_bytes: usize,
    pub recv_bytes: usize,
    pub request_lines: Vec<String>,
}

// Used by the phase 32 target, which shares this transport with phase 31.
#[allow(dead_code)]
pub struct Caller {
    next_id: u64,
    end_id: u64,
}

#[allow(dead_code)]
impl Caller {
    pub fn new(slot: u32) -> Self {
        let start = (u64::from(slot) + 1) * 1_000_000;
        Self { next_id: start, end_id: start + 1_000_000 }
    }
}

impl Client {
    pub fn open(project: &Path) -> Self {
        let mut child = Command::new(env!("CARGO_BIN_EXE_cadence"))
            .args(["serve", "--project-root", project.to_str().unwrap()])
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .env("GIT_CONFIG_COUNT", "3")
            .env("GIT_CONFIG_KEY_0", "commit.gpgsign")
            .env("GIT_CONFIG_VALUE_0", "false")
            .env("GIT_CONFIG_KEY_1", "user.name")
            .env("GIT_CONFIG_VALUE_1", "Cadence Phase31")
            .env("GIT_CONFIG_KEY_2", "user.email")
            .env("GIT_CONFIG_VALUE_2", "phase31@example.invalid")
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
            pending: BTreeMap::new(),
            send_bytes: 0,
            recv_bytes: 0,
            request_lines: Vec::new(),
            child,
        };
        client.send(json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{
            "protocolVersion":"2025-06-18","capabilities":{},
            "clientInfo":{"name":"phase31-check","version":"1"}}}));
        assert!(client.recv()["result"]["serverInfo"].is_object());
        client.send(json!({"jsonrpc":"2.0","method":"notifications/initialized"}));
        client
    }

    fn send(&mut self, value: Value) {
        let line = format!("{value}\n");
        self.request_lines.push(line.clone());
        self.stdin.as_mut().unwrap().write_all(line.as_bytes()).unwrap();
        self.send_bytes += line.len();
        self.stdin.as_mut().unwrap().flush().unwrap();
    }

    fn recv(&mut self) -> Value {
        let mut line = String::new();
        assert!(self.stdout.read_line(&mut line).unwrap() > 0);
        self.recv_bytes += line.len();
        serde_json::from_str(&line).unwrap()
    }

    pub fn call(&mut self, tool: &str, arguments: Value) -> Value {
        self.send(json!({"jsonrpc":"2.0","id":2,"method":"tools/call",
            "params":{"name":tool,"arguments":arguments}}));
        self.receive_call(2)
    }

    #[allow(dead_code)]
    pub fn send_call(&mut self, caller: &mut Caller, tool: &str, arguments: Value) -> u64 {
        assert!(caller.next_id < caller.end_id, "caller exhausted its request id range");
        let id = caller.next_id;
        caller.next_id += 1;
        self.send(json!({"jsonrpc":"2.0","id":id,"method":"tools/call",
            "params":{"name":tool,"arguments":arguments}}));
        id
    }

    pub fn receive_call(&mut self, id: u64) -> Value {
        let response = loop {
            if let Some(response) = self.pending.remove(&id) {
                break response;
            }
            let response = self.recv();
            if response.get("id").is_none() {
                assert!(response["method"].is_string(), "invalid notification: {response}");
                continue;
            }
            let response_id = response["id"].as_u64().expect("numeric request id");
            assert!(self.pending.insert(response_id, response).is_none(), "duplicate response id");
        };
        assert_eq!(response["id"], id, "reply must match its caller's request");
        assert!(response.get("error").is_none(), "{response}");
        assert_ne!(response["result"]["isError"], true, "{response}");
        let structured = response["result"]["structuredContent"].clone();
        let text: String = response["result"]["content"].as_array().unwrap().iter()
            .filter(|block| block["type"] == "text")
            .map(|block| block["text"].as_str().unwrap())
            .collect();
        assert_eq!(structured, serde_json::from_str::<Value>(&text).unwrap());
        structured
    }

    #[allow(dead_code)]
    pub fn serve_processes(&self) -> Vec<u32> {
        let output = Command::new("ps").args(["-eo", "pid=,ppid=,args="]).output().unwrap();
        assert!(output.status.success());
        let listing = String::from_utf8(output.stdout).unwrap();
        let rows: Vec<_> = listing.lines().map(|line| {
            let mut fields = line.split_whitespace();
            let pid = fields.next().unwrap().parse::<u32>().unwrap();
            let parent = fields.next().unwrap().parse::<u32>().unwrap();
            let command: Vec<_> = fields.collect();
            (pid, parent, command)
        }).collect();
        let mut descendants = std::collections::BTreeSet::from([self.child.id()]);
        loop {
            let before = descendants.len();
            for (pid, parent, _) in &rows {
                if descendants.contains(parent) {
                    descendants.insert(*pid);
                }
            }
            if descendants.len() == before { break; }
        }
        rows.iter().filter(|(pid, _, command)| {
            descendants.contains(pid)
                && command.first().is_some_and(|name| Path::new(name).file_name().is_some_and(|name| name == "cadence"))
                && command.get(1) == Some(&"serve")
        }).map(|(pid, _, _)| *pid).collect()
    }

    pub fn wait_for_event(&mut self, phase: u32, run_id: &str) -> Value {
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(30);
        loop {
            let history = self.call(
                "cadence_query",
                json!({"operation":"execution-history","phase":phase,"run":run_id}),
            );
            if history["result"]["request"]["event"].is_object() {
                return history["result"]["request"]["event"].clone();
            }
            assert!(std::time::Instant::now() < deadline, "missing run {run_id}: {history}");
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
    }

    #[allow(dead_code)]
    pub fn finish(mut self) {
        drop(self.stdin.take());
        assert!(self.child.wait().unwrap().success());
    }
}

impl Drop for Client {
    fn drop(&mut self) {
        drop(self.stdin.take());
        if !matches!(self.child.try_wait(), Ok(Some(_))) {
            let _ = self.child.kill();
        }
        let _ = self.child.wait();
    }
}

#[allow(dead_code)]
pub struct Fixture {
    temp: tempfile::TempDir,
}

#[allow(dead_code)]
impl Fixture {
    pub fn new() -> Self {
        let temp = tempfile::tempdir().unwrap();
        let project = temp.path();
        fs::create_dir_all(project.join(".planning/phases/13")).unwrap();
        fs::create_dir_all(project.join("src/nested")).unwrap();
        fs::create_dir_all(project.join("docs")).unwrap();
        fs::write(project.join(".planning/ROADMAP.md"), "## Phases\n- [ ] **Phase 13: Fixture**\n").unwrap();
        fs::write(project.join(".planning/config.json"), "{}").unwrap();
        fs::write(project.join(".gitignore"), "ignored/\n.planning/\n").unwrap();
        fs::create_dir_all(project.join("ignored")).unwrap();
        fs::write(project.join("ignored/sentinel.rs"), "fn ignored() { let needle = 0; }\n").unwrap();
        fs::write(project.join("src/units.rs"), "fn alpha() {\n    let needle = 1;\n    let needle_again = 2;\n}\n\nfn beta() {\n    let needle = 3;\n}\n\nfn untouched() {}\n").unwrap();
        fs::write(project.join("src/nested/mod.rs"), "fn outer() {\n    fn inner() { let needle = 4; }\n}\n").unwrap();
        fs::write(project.join("src/units.js"), "function javascriptUnit() {\n  const needle = 1;\n}\n").unwrap();
        fs::write(project.join("docs/units.md"), "# Markdown unit\nneedle\n").unwrap();
        fs::write(project.join("src/units.json"), "{\n  \"jsonUnit\": \"needle\"\n}\n").unwrap();
        fs::write(project.join("src/units.c"), "int c_unit(void) {\n  int needle = 1;\n  return needle;\n}\n").unwrap();
        fs::write(project.join("src/items.rs"), concat!(
            "use std::collections::BTreeMap;\n\n",
            "/// Doc for the struct.\n",
            "pub struct Registry {\n    entries: BTreeMap<String, u32>,\n}\n\n",
            "impl Registry {\n    pub fn insert(&mut self, key: &str) { self.entries.insert(key.into(), 1); }\n}\n\n",
            "pub enum Kind { Heading, Function }\n",
        )).unwrap();
        fs::create_dir_all(project.join("tools")).unwrap();
        fs::write(project.join("tools/build.py"), "class Builder:\n    def run(self):\n        marker = 1\n").unwrap();
        fs::create_dir_all(project.join("config")).unwrap();
        fs::write(project.join("config/settings.toml"), "[package]\nname = \"fixture\"\n\n[deps]\nneedle = \"1\"\n").unwrap();
        Command::new("git").args(["init", "--initial-branch=fixture/read"]).current_dir(project).status().unwrap();
        Command::new("git").args(["add", "."]).current_dir(project).status().unwrap();
        Command::new("git").args(["-c", "commit.gpgsign=false", "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "fixture"]).current_dir(project).status().unwrap();
        Self { temp }
    }

    pub fn project(&self) -> &Path { self.temp.path() }
    pub fn path(&self, relative: &str) -> PathBuf { self.project().join(relative) }
}

pub fn approve(mut request: Value) -> Value {
    request["approval"] = json!({"approved":true,"owner":"Fixture Owner",
        "at":"2026-09-13T12:00:00Z","submission":request["submission"].clone()});
    request
}

#[allow(dead_code)]
pub fn publish_review_plan(client: &mut Client) {
    let configured = client.call("cadence_apply", json!({"operation":"config-apply","layer":"repo","updates":[
        {"key":"review.reviewers","value":["claude-subagent"]}]}));
    assert_eq!(configured["status"], "ok", "{configured}");
    let context = client.call("cadence_apply", approve(json!({"operation":"context-submit","submission":{
        "phase":31,"title":"Review fixture","scope":"Review a native plan.",
        "durable_decisions":[],"decisions":[],"assumptions":[],
        "truths":[{"id":"T4","trigger":"a review returns","observer":"the caller","verb":"gets",
            "outcome":"the retained result","kind":"property","observable":true,"fixed_oracle":true}]}})));
    assert_eq!(context["persisted"], true, "{context}");
    let allocation = client.call("cadence_query", json!({"operation":"plan-read","phase":31,"count":1}));
    let mut proposal = process_plan_submission(&allocation, "");
    proposal["submission"]["plans"].as_array_mut().unwrap().truncate(1);
    let published = client.call("cadence_apply", approve(proposal));
    assert_eq!(published["persisted"], true, "{published}");
}

/// Exercise the local host's launch/return binding over the real stdio wire.
#[allow(dead_code)]
pub fn observed_plan_review(client: &mut Client, key: &str) -> Value {
    let selected = client.call("cadence_query", json!({"operation":"review-select",
        "command":"cad-review","arguments":["plan","31"],"replay_key":key}));
    assert_eq!(selected["status"], "ok", "{selected}");
    let admitted = client.call("cadence_apply", json!({"operation":"review-admit","request":selected["result"]["admission"]}));
    assert_eq!(admitted["status"], "ok", "{admitted}");
    let next = client.call("cadence_query", json!({"operation":"review-next","fire":admitted["result"]["fire"]}));
    assert_eq!(next["result"]["state"], "dispatch", "{next}");
    assert_eq!(next["result"]["dispatch"]["local"], true, "{next}");
    let attempt = &next["result"]["attempt"];
    let launch = format!("{key}-launch");
    let returned = format!("{key}-return");
    for (kind, host_return) in [("launch", Value::Null), ("return", json!(returned))] {
        let observed = client.call("cadence_apply", json!({"operation":"review-observation","observation":{
            "observation":format!("{key}-{kind}-observation"),"attempt":attempt["attempt"],
            "launch":launch,"host_return":host_return,"kind":kind,"reference":format!("event:{key}-{kind}"),
            "observed_at":1,"host":"fixture","model":null,
            "usage":{"input":null,"output":null,"cost":null,"currency":null},"contract":attempt["contract"]}}));
        assert_eq!(observed["status"], "ok", "{observed}");
    }
    json!({"operation":"review-return","identity":{
        "fire":attempt["fire"],"occurrence":attempt["occurrence"],"artifact":attempt["view"]["manifest"],
        "view":attempt["view"]["view"],"attempt":attempt["attempt"],"round":attempt["round"]},
        "launch":launch,"host_return":returned,"citations":[]})
}

pub fn git(project: &Path, args: &[&str]) -> String {
    let output = Command::new("git")
        .args(args)
        .current_dir(project)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GNUPGHOME", project.join(".fixture-gnupg"))
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(output.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&output.stderr));
    String::from_utf8(output.stdout).unwrap().trim_end().to_owned()
}

pub struct ProcessFixture {
    temp: tempfile::TempDir,
}

impl ProcessFixture {
    pub fn new() -> Self {
        use std::os::unix::fs::PermissionsExt;

        let temp = tempfile::tempdir().unwrap();
        let project = temp.path();
        for path in [".planning/phases/31", ".fixture-gnupg", "src", "tests", "docs"] {
            fs::create_dir_all(project.join(path)).unwrap();
        }
        fs::set_permissions(project.join(".fixture-gnupg"), fs::Permissions::from_mode(0o700)).unwrap();
        fs::write(project.join(".planning/ROADMAP.md"), concat!(
            "## Phases\n",
            "- [x] **Phase 30: Before** - neighboring prior row\n",
            "- [ ] **Phase 31: The read layer** - uniquely selected roadmap row\n",
            "- [ ] **Phase 32: After** - neighboring next row\n",
        )).unwrap();
        fs::write(project.join(".planning/config.json"), "{}\n").unwrap();
        fs::write(project.join(".gitignore"), ".planning/\n.fixture-gnupg/\n.run/\n").unwrap();
        fs::write(project.join("src/lease.rs"), "pub fn lease_needle() -> u32 { 31 }\n").unwrap();
        fs::write(project.join("src/other.rs"), "pub fn outside_lease() -> u32 { 32 }\n").unwrap();
        fs::write(project.join("tests/tiny.py"), concat!(
            "import unittest\n",
            "unittest.runner.time.perf_counter = lambda: 0.0\n",
            "class Tiny(unittest.TestCase):\n",
            "    def test_ok(self):\n",
            "        self.assertEqual(31, 31)\n",
            "if __name__ == '__main__':\n",
            "    unittest.main()\n",
        )).unwrap();
        fs::write(project.join("docs/PLAN.md"), "MISLEADING RAW PLAN ALIAS\n").unwrap();
        let key = Command::new("gpg")
            .env("GNUPGHOME", project.join(".fixture-gnupg"))
            .args(["--batch", "--pinentry-mode", "loopback", "--passphrase", "", "--quick-generate-key",
                "Cadence Phase31 <phase31@example.invalid>", "ed25519", "sign", "0"])
            .stdin(Stdio::null())
            .output()
            .unwrap();
        assert!(key.status.success(), "{}", String::from_utf8_lossy(&key.stderr));
        git(project, &["init", "--initial-branch=fixture/process"]);
        git(project, &["config", "user.name", "Cadence Phase31"]);
        git(project, &["config", "user.email", "phase31@example.invalid"]);
        git(project, &["config", "user.signingkey", "phase31@example.invalid"]);
        git(project, &["add", "."]);
        git(project, &["-c", "commit.gpgsign=false", "commit", "-m", "Fixture baseline"]);
        Self { temp }
    }

    pub fn project(&self) -> &Path { self.temp.path() }
}

#[allow(dead_code)]
pub fn tree(project: &Path) -> BTreeMap<PathBuf, Option<Vec<u8>>> {
    fn visit(base: &Path, path: &Path, found: &mut BTreeMap<PathBuf, Option<Vec<u8>>>) {
        let metadata = fs::symlink_metadata(path).unwrap();
        let relative = path.strip_prefix(base).unwrap().to_path_buf();
        if metadata.file_type().is_symlink() {
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
        } else if metadata.is_dir() {
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
    found
}

pub fn process_plan_submission(allocation: &Value, large_task: &str) -> Value {
    let check = json!({
        "kind":"check","id":"fixture/T4","reason":"The process record must be readable.",
        "spec":{"command":"python3 -B tests/tiny.py","expected":{"kind":"property","value":"the test passes"},
            "test":{"file":"tests/tiny.py","function":"Tiny.test_ok"},"setup":"A real fixture project.",
            "call":"Run the real binary.","boundary":"stdio to the bound project","fakes":[]},
        "associations":[{"truth_id":"T4","truth_version":1,"reason":"This observes the process read."}]
    });
    let artifact = |id: &str| json!({
        "kind":"artifact","id":id,"reason":"The rendered identity needs an owner.",
        "spec":{"locators":["read-layer"],"substance":"Identity-owned process rendering."},
        "associations":[{"truth_id":"T4","truth_version":1,"reason":"This owns the rendered identity."}]
    });
    let plan_two_action = format!("PLAN TWO TASK ONE UNIQUE\n{large_task}");
    json!({"operation":"plan-submit","submission":{
        "phase":31,"occurrence":allocation["occurrence"],"request_id":"fixture-two-plans",
        "inventory_basis":allocation["inventory"]["basis"],"plans":[
            {"target":allocation["targets"][0],"content":{"phase":31,"plan":1,"requirements":["T4"],
                "files":["src/lease.rs","tests/tiny.py"],"directories":[],
                "goal":"PLAN ONE GOAL SENTINEL","context":"Plan one fixture context.","notes":"Plan one fixture notes.",
                "tasks":[
                    {"id":"fixture-one-a","title":"Completed fixture task","files":["src/lease.rs","tests/tiny.py"],
                        "action":"PLAN ONE TASK ONE SENTINEL","verify":["python3 -B tests/tiny.py"]},
                    {"id":"fixture-one-b","title":"Deferred fixture task","files":["src/lease.rs","tests/tiny.py"],
                        "action":"PLAN ONE TASK TWO SENTINEL","verify":["python3 -B tests/tiny.py"]}],
                "suite":"python3 -B tests/tiny.py",
                "evidence_map":{"mode":"attached","items":[check, artifact("fixture/artifact-one")]}}},
            {"target":allocation["targets"][1],"content":{"phase":31,"plan":2,"requirements":["T4"],
                "files":["src/lease.rs"],"directories":[],
                "goal":"PLAN TWO GOAL SENTINEL","context":"Plan two fixture context.","notes":"Plan two fixture notes.",
                "tasks":[
                    {"id":"fixture-two-a","title":"Requested fixture task","files":["src/lease.rs"],
                        "action":plan_two_action,"verify":["python3 -B tests/tiny.py"]},
                    {"id":"fixture-two-b","title":"Neighbor fixture task","files":["src/lease.rs"],
                        "action":"PLAN TWO TASK TWO SENTINEL","verify":["python3 -B tests/tiny.py"]}],
                "suite":"python3 -B tests/tiny.py",
                "evidence_map":{"mode":"attached","items":[artifact("fixture/artifact-two")]}}}
        ]}})
}

/// One admitted round, kept open so callers can inspect or extend its lifecycle.
#[allow(dead_code)]
pub struct ClosedRound {
    pub fixture: ProcessFixture,
    pub client: Client,
    pub dispatch: Value,
    pub plan: Value,
    pub commits: Vec<String>,
    pub runs: Vec<String>,
    pub closes: Vec<Value>,
    pub check: Value,
}

#[allow(dead_code)]
impl ClosedRound {
    pub fn admitted() -> Self {
        Self::admitted_with_tasks(2)
    }

    pub fn admitted_with_tasks(task_count: usize) -> Self {
        let fixture = ProcessFixture::new();
        let project = fixture.project();
        fs::write(project.join(".planning/config.json"), serde_json::to_vec(&json!({"review":{"triggers":{
            "risk_surface":{"surfaces":cadence::rail::risk::CATEGORIES}}}})).unwrap()).unwrap();
        fs::write(project.join("src/lease.rs"), "def answer():\n    return 0\n").unwrap();
        // Track the authored planning inputs while leaving only the store's
        // bookkeeping ignored. SUMMARY.md is deliberately not ignored.
        fs::write(project.join(".gitignore"), ".fixture-gnupg/\n.run/\n.planning/*\n!.planning/phases/\n.planning/phases/*\n!.planning/phases/31/\n").unwrap();
        let mut client = Client::open(project);
        let context = client.call("cadence_apply", approve(json!({"operation":"context-submit","submission":{
            "phase":31,"title":"Round fixture","scope":"An actual two-task round.",
            "durable_decisions":[],"decisions":[],"assumptions":[],
            "truths":[{"id":"T4","trigger":"the round closes","observer":"the caller","verb":"gets",
                "outcome":"the retained result","kind":"property","observable":true,"fixed_oracle":true}]}})));
        assert_eq!(context["persisted"], true, "{context}");
        let allocation = client.call("cadence_query", json!({"operation":"plan-read","phase":31,"count":1}));
        let mut proposal = process_plan_submission(&allocation, "");
        proposal["submission"]["plans"].as_array_mut().unwrap().truncate(1);
        let tasks = proposal["submission"]["plans"][0]["content"]["tasks"].as_array_mut().unwrap();
        for index in 2..task_count {
            let mut task = tasks[1].clone();
            task["id"] = json!(format!("fixture-task-{index}-{}", "bounded".repeat(60)));
            tasks.push(task);
        }
        let allocation_rows: Vec<_> = tasks.iter().enumerate().map(|(index, task)|
            json!({"plan":1,"task":task["id"],"first":index == 0})).collect();
        let published = client.call("cadence_apply", approve(proposal));
        assert_eq!(published["persisted"], true, "{published}");
        let evidence = client.call("cadence_query", json!({"operation":"evidence-read","phase":31}));
        let check = evidence["items"].as_array().unwrap().iter().find(|i| i["id"] == "fixture/T4").unwrap();
        let check = json!({"id":check["id"],"item_revision":check["item_revision"]});
        let readback = client.call("cadence_query", json!({"operation":"plan-read","phase":31}));
        let publications = readback["native"]["publications"].as_object().unwrap();
        let contract = json!({"phase":31,"occurrence":readback["occurrence"],
            "plans":publications.values().map(|p| json!({"plan":p["identity"]["plan"],
                "publication_request":p["publication_request"],"content_revision":p["revision"],"map_revision":p["map_revision"]})).collect::<Vec<_>>(),
            "allocation":allocation_rows.iter().map(|row| json!({"plan":1,"task":row["task"],
                "checks":if row["first"] == true {json!([check])} else {json!([])}})).collect::<Vec<_>>()});
        let admitted = client.call("cadence_apply", json!({"operation":"execution-admit","request":{
            "request_id":"round-admit","expected_set_version":0,"contract":contract}}));
        assert_eq!(admitted["status"], "ok", "{admitted}");
        git(project, &["add", "."]);
        git(project, &["-c", "commit.gpgsign=false", "commit", "-m", "test(round): prepare planning inputs"]);
        let authorized = client.call("cadence_apply", json!({"operation":"execution-authorize","phase":31,
            "request_id":"round-authorize","owner":"Fixture Owner","at":"2026-09-17T12:00:00Z","response":"Execute the fixture round"}));
        assert_eq!(authorized["status"], "ok", "{authorized}");
        let dispatch = client.call("cadence_query", json!({"operation":"execute-next","phase":31}));
        assert_eq!(dispatch["status"], "ok", "{dispatch}");
        let history = client.call("cadence_query", json!({"operation":"execution-history","phase":31}));
        let plan = history["plans"][0]["plan"].clone();
        Self { fixture, client, dispatch, plan, check, commits: vec![], runs: vec![], closes: vec![] }
    }

    pub fn state(&mut self, name: &str) -> Value {
        let history = self.client.call("cadence_query", json!({"operation":"execution-history","phase":31}));
        history["tasks"].as_array().unwrap().iter().find(|t| t["task"]["task"] == name).unwrap().clone()
    }

    fn run(&mut self, name: &str, stage: &str, check: Value) -> String {
        let state = self.state(name);
        let id = format!("{name}-{stage}");
        let launched = self.client.call("cadence_apply", json!({"operation":"execution-run","request":{
            "request_id":id,"task":state["task"],"attempt":name,"expected_version":state["state"]["version"],
            "command":"python3 -B tests/tiny.py","check":check,"stage":stage}}));
        assert_eq!(launched["status"], "ok", "{launched}");
        let result = self.client.wait_for_event(31, &id);
        assert_eq!(result["disposition"]["code"], if stage == "red" { 1 } else { 0 }, "{result}");
        if stage == "red" {
            assert_eq!(result["observation"]["summary"], json!({"runner":"unittest","failed":true,"failures":1,"errors":0}));
        }
        self.runs.push(id.clone());
        id
    }

    pub fn close_tasks(&mut self) {
        self.drive_tasks(true, false);
    }

    pub fn close_tasks_with_output(&mut self) {
        self.drive_tasks(true, true);
    }

    pub fn prepare_last_close(&mut self) -> Value {
        self.drive_tasks(false, false).unwrap()
    }

    pub fn complete(&mut self) {
        let red = self.client.call("cadence_query", json!({"operation":"execution-history","phase":31,"run":"fixture-one-a-red"}));
        let state = self.state("fixture-one-a");
        let inspection = json!({"check":self.check,"test_digest":red["launch"]["request"]["event"]["material"]["test_digest"],
            "evidence":["fixture-one-a-red","fixture-one-a-green"],"no_subject_stub":true});
        let attested = self.client.call("cadence_apply", json!({"operation":"execution-owner-attest","request":{
            "request_id":"round-inspection","task":state["task"],"attempt":"fixture-one-a","expected_version":state["state"]["version"],
            "statement":{"submission":inspection,"approval":{"approved":true,"owner":"Fixture Owner","at":"2026-09-17T12:00:00Z","submission":inspection}}}}));
        assert_eq!(attested["status"], "ok", "{attested}");
        let history = self.client.call("cadence_query", json!({"operation":"execution-history","phase":31}));
        let suite = self.client.call("cadence_apply", json!({"operation":"execution-suite","request":{
            "request_id":"round-suite","plan":self.plan,"expected_version":history["plans"][0]["state"]["version"]}}));
        assert_eq!(suite["status"], "ok", "{suite}");
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(30);
        loop {
            let run = self.client.call("cadence_query", json!({"operation":"execution-history","phase":31,"run":"round-suite"}));
            if !run["result"].is_null() {
                assert_eq!(run["result"]["request"]["event"]["disposition"]["code"], 0, "{run}");
                break;
            }
            assert!(std::time::Instant::now() < deadline, "{run}");
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        let risk = self.client.call("cadence_apply", json!({"operation":"risk-check","request_id":"round-risk",
            "scope":{"phase":31,"occurrence":"phase-31-execution","worker":"1"},
            "source":{"kind":"execution","plan":1,"dispatch_id":self.dispatch["dispatch_id"]},"surfaces":null}));
        assert_eq!(risk["status"], "ok", "{risk}");
        let history = self.client.call("cadence_query", json!({"operation":"execution-history","phase":31}));
        let completed = self.client.call("cadence_apply", json!({"operation":"execution-plan-complete","request":{
            "request_id":"round-complete","plan":self.plan,"expected_version":history["plans"][0]["state"]["version"]}}));
        assert_eq!(completed["status"], "ok", "{completed}");
    }

    fn drive_tasks(&mut self, close_last: bool, large_output: bool) -> Option<Value> {
        for (index, name) in ["fixture-one-a", "fixture-one-b"].into_iter().enumerate() {
            let state = self.state(name);
            let checks = if index == 0 { json!([self.check]) } else { json!([]) };
            let started = self.client.call("cadence_apply", json!({"operation":"execution-task-start","request":{
                "request_id":format!("{name}-start"),"task":state["task"],"attempt":name,
                "expected_version":0,"predecessor":null,"checks":checks}}));
            assert_eq!(started["status"], "ok", "{started}");
            let mut pairs = Vec::new();
            if index == 0 {
                fs::write(self.fixture.project().join("tests/tiny.py"), concat!(
                    "import unittest, runpy\n",
                    "unittest.runner.time.perf_counter = lambda: 0.0\n",
                    "class Tiny(unittest.TestCase):\n",
                    "    def test_ok(self):\n",
                    "        self.assertEqual(runpy.run_path('src/lease.rs')['answer'](), 7)\n",
                    "if __name__ == '__main__':\n    unittest.main()\n")).unwrap();
                git(self.fixture.project(), &["add", "tests/tiny.py"]);
                git(self.fixture.project(), &["-c", "commit.gpgsign=false", "commit", "-m", "test(round): expose fixture-one-a failure"]);
                let red = git(self.fixture.project(), &["rev-parse", "HEAD"]);
                self.commits.push(red.clone());
                let red_run = self.run(name, "red", checks[0].clone());
                fs::write(self.fixture.project().join("src/lease.rs"), "def answer():\n    return 7\n").unwrap();
                git(self.fixture.project(), &["add", "src/lease.rs"]);
                git(self.fixture.project(), &["-c", "commit.gpgsign=false", "commit", "-S", "-m", "feat(round): complete fixture-one-a"]);
                let green = git(self.fixture.project(), &["rev-parse", "HEAD"]);
                self.commits.push(green.clone());
                let green_run = self.run(name, "green", checks[0].clone());
                pairs.push(json!({"check":checks[0],"red_commit":red,"green_commit":green,"red_run":red_run,"green_run":green_run}));
            } else {
                let output = if large_output { "import os\nos.write(1, ('é' * 35000).encode())\nos.write(2, b'\\xff' * 70000)\n" } else { "" };
                fs::write(self.fixture.project().join("src/lease.rs"), format!("def answer():\n    return 7\n# Second task completed.\n{output}")).unwrap();
                git(self.fixture.project(), &["add", "src/lease.rs"]);
                git(self.fixture.project(), &["-c", "commit.gpgsign=false", "commit", "-S", "-m", "feat(round): complete fixture-one-b"]);
                self.commits.push(git(self.fixture.project(), &["rev-parse", "HEAD"]));
            }
            let verification = self.run(name, "verify", Value::Null);
            let state = self.state(name);
            let request = json!({"operation":"execution-task-close","request":{
                "request_id":format!("{name}-close"),"task":state["task"],"attempt":name,"expected_version":state["state"]["version"],
                "completion":self.commits.last().unwrap(),"checks":pairs,"verification":[verification]}});
            if index == 1 && !close_last { return Some(request); }
            let closed = self.client.call("cadence_apply", request);
            assert_eq!(closed["status"], "ok", "{closed}");
            self.closes.push(closed);
        }
        None
    }
}
