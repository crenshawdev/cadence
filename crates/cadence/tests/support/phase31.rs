//! Real-binary fixtures for the phase 31 read-layer acceptance checks.
use serde_json::{Value, json};
use std::{
    fs,
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
};

pub struct Client {
    child: Child,
    stdin: Option<ChildStdin>,
    stdout: BufReader<std::process::ChildStdout>,
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
        writeln!(self.stdin.as_mut().unwrap(), "{value}").unwrap();
        self.stdin.as_mut().unwrap().flush().unwrap();
    }

    fn recv(&mut self) -> Value {
        let mut line = String::new();
        assert!(self.stdout.read_line(&mut line).unwrap() > 0);
        serde_json::from_str(&line).unwrap()
    }

    pub fn call(&mut self, tool: &str, arguments: Value) -> Value {
        self.send(json!({"jsonrpc":"2.0","id":2,"method":"tools/call",
            "params":{"name":tool,"arguments":arguments}}));
        let response = self.recv();
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

    pub fn wait_for_event(&mut self, phase: u32, run_id: &str) -> Value {
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(30);
        loop {
            let history = self.call(
                "cadence_query",
                json!({"operation":"execution-history","phase":phase}),
            );
            if let Some(event) = history["events"].as_array().unwrap().iter().find_map(|record| {
                let event = &record["request"]["event"];
                (event["kind"] == "result" && event["run_id"] == run_id).then(|| event.clone())
            }) {
                return event;
            }
            assert!(std::time::Instant::now() < deadline, "missing run {run_id}: {history}");
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
    }

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

pub struct Fixture {
    temp: tempfile::TempDir,
}

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
    let plan_one = concat!(
        "# Fixture plan one\n\n## Goal\n\nPLAN ONE GOAL SENTINEL\n\n## Tasks\n\n",
        "### Task 1: Completed fixture task\n\nPLAN ONE TASK ONE SENTINEL\n\n",
        "### Task 2: Deferred fixture task\n\nPLAN ONE TASK TWO SENTINEL\n",
    );
    let plan_two = format!(concat!(
        "# Fixture plan two\n\n## Goal\n\nPLAN TWO GOAL SENTINEL\n\n## Tasks\n\n",
        "### Task 1: Requested fixture task\n\nPLAN TWO TASK ONE UNIQUE\n{}\n",
        "### Task 2: Neighbor fixture task\n\nPLAN TWO TASK TWO SENTINEL\n",
    ), large_task);
    json!({"operation":"plan-submit","submission":{
        "phase":31,"occurrence":allocation["occurrence"],"request_id":"fixture-two-plans",
        "inventory_basis":allocation["inventory"]["basis"],"plans":[
            {"target":allocation["targets"][0],"content":{"phase":31,"plan":1,"requirements":["T4"],
                "files":["src/lease.rs","tests/tiny.py"],"directories":[],
                "execution":{"schema":1,"suite":"python3 -B tests/tiny.py","tasks":[
                    {"id":"fixture-one-a","verify":["python3 -B tests/tiny.py"]},
                    {"id":"fixture-one-b","verify":["python3 -B tests/tiny.py"]}]},
                "body":plan_one,"evidence_map":{"mode":"attached","items":[check, artifact("fixture/artifact-one")]}}},
            {"target":allocation["targets"][1],"content":{"phase":31,"plan":2,"requirements":["T4"],
                "files":["src/lease.rs"],"directories":[],
                "execution":{"schema":1,"suite":"python3 -B tests/tiny.py","tasks":[
                    {"id":"fixture-two-a","verify":["python3 -B tests/tiny.py"]},
                    {"id":"fixture-two-b","verify":["python3 -B tests/tiny.py"]}]},
                "body":plan_two,"evidence_map":{"mode":"attached","items":[artifact("fixture/artifact-two")]}}}
        ]}})
}
