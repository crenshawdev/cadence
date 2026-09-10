//! Phase 11 checks exercise the real binary, journal and filesystem.
use cadence::store::model::{self, Snapshot};
use serde_json::{Value, json};
use std::collections::BTreeMap;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};

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
            .spawn().unwrap();
        let mut client = Self {
            stdin: child.stdin.take().unwrap(),
            stdout: BufReader::new(child.stdout.take().unwrap()),
            child,
        };
        client.send(json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{
            "protocolVersion":"2025-06-18","capabilities":{},
            "clientInfo":{"name":"phase11-check","version":"1"}}}));
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
        let text: String = response["result"]["content"].as_array().unwrap().iter()
            .filter(|block| block["type"] == "text")
            .map(|block| block["text"].as_str().unwrap()).collect();
        assert_eq!(result, serde_json::from_str::<Value>(&text).unwrap());
        result
    }

    fn finish(mut self) {
        drop(self.stdin);
        assert!(self.child.wait().unwrap().success());
    }
}

fn submission() -> Value {
    json!({"operation":"context-submit","submission":{
        "phase":11,"title":"First approved context","scope":"Only the approved phase.",
        "durable_decisions":[{"id":"D-01","text":"Keep **authored** café prose (`docs/design.md:7`)."}],
        "decisions":[{"id":"D-02","text":"Use the owner's chosen order."}],
        "assumptions":["The reader understands 日本語."],
        "truths":[{"id":"T1","trigger":"the owner opens the context",
            "observer":"the owner","verb":"sees","outcome":"the approved decisions",
            "kind":"literal","observable":true,"fixed_oracle":true}]
    }})
}

fn fixture(native: bool, phase: bool, pending: bool) -> tempfile::TempDir {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join(".planning");
    fs::create_dir(&root).unwrap();
    fs::write(root.join("ROADMAP.md"), "# Roadmap\n\n### Phase 11: First approved context\n\nGoal: approved context.\n\n### Phase 12: Next context\n\nGoal: next context.\n").unwrap();
    if phase {
        fs::create_dir_all(root.join("phases/11")).unwrap();
        fs::write(root.join("phases/11/CONTEXT.md"), "# Prior context\n\nOwner prose: déjà vu.\n").unwrap();
    }
    if native {
        let items = b"";
        let decisions = b"";
        let snapshot = Snapshot::new(1, items, decisions, json!({"unrelated":{"keep":"unchanged"}})).unwrap();
        fs::write(root.join(model::ITEMS), items).unwrap();
        fs::write(root.join(model::DECISIONS), decisions).unwrap();
        fs::write(root.join(model::STATE), snapshot.render().unwrap()).unwrap();
        if pending {
            // A retained journal is an input file. Draft authoring must not even
            // inspect/recover it; preserve its exact bytes, including whitespace.
            fs::write(root.join(".store-intent.json"), b"{\"retained\":\"pending owner work\"}\n").unwrap();
        }
    }
    temp
}

fn tree(project: &Path) -> BTreeMap<PathBuf, Option<Vec<u8>>> {
    fn visit(base: &Path, path: &Path, found: &mut BTreeMap<PathBuf, Option<Vec<u8>>>) {
        if !path.exists() { return; }
        let relative = path.strip_prefix(base).unwrap().to_path_buf();
        if path.is_dir() {
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
    let root = project.join(".planning");
    if root.join(model::STATE).exists() {
        let items = fs::read(root.join(model::ITEMS)).unwrap();
        let decisions = fs::read(root.join(model::DECISIONS)).unwrap();
        Snapshot::parse(&fs::read(root.join(model::STATE)).unwrap(), &items, &decisions).unwrap();
        model::validate_items(&model::parse_lines(&items).unwrap()).unwrap();
        model::validate_decisions(&model::parse_lines(&decisions).unwrap()).unwrap();
    }
    found
}

#[test]
fn phase11_unapproved_context_changes_nothing() {
    for (native, phase, pending) in [(true,true,false),(true,false,false),(false,true,false),(false,false,false),(true,true,true)] {
        for intake_only in [true, false] {
            let temp = fixture(native, phase, pending);
            let before = tree(temp.path());
            let mut client = Client::open(temp.path());
            let intake = client.call("cadence_query", json!({"operation":"context-intake","phase":11}));
            assert_eq!(intake["status"], "ok", "context intake must be supported: {intake}");
            assert_eq!(intake["operation"], "context-intake");
            assert!(intake["contract"].is_object(), "{intake}");
            assert_eq!(intake["context"], if phase { json!("# Prior context\n\nOwner prose: déjà vu.\n") } else { Value::Null });
            assert_eq!(tree(temp.path()), before);
            if !intake_only {
                for approval in [Value::Null, json!({"approved":false}), json!({"approved":true,"owner":""})] {
                    let mut draft = submission();
                    if !approval.is_null() { draft["approval"] = approval.clone(); }
                    let answer = client.call("cadence_apply", draft);
                    if approval["approved"] == true {
                        assert_eq!(answer["status"], "refused", "{answer}");
                        assert_eq!(answer["slot"], "approval", "{answer}");
                    } else {
                        assert_eq!(answer["status"], "ok", "valid draft must reach context authoring: {answer}");
                        assert_eq!(answer["operation"], "context-submit");
                        assert_eq!(answer["persisted"], false);
                    }
                    assert_eq!(tree(temp.path()), before);
                }
            }
            client.finish();
            assert_eq!(tree(temp.path()), before, "read-only reopen after server exit");
        }
    }
}
