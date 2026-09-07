//! Integration tests: spawn the real `cadence serve` binary and drive it over
//! stdio with hand-rolled newline-delimited JSON-RPC. No client-side rmcp
//! feature is needed for this, and nothing here shares a process with the
//! server - what these tests see is what a host sees.
//!
//! The `Client` below is the seed of phase 2's golden harness, so it knows
//! nothing about which tools exist. Every fact about the surface is stated in
//! an assertion, never baked into the client.

use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};

use serde_json::{Value, json};
use std::{collections::BTreeSet, fs, path::Path};

/// A tiny JSON-RPC-over-stdio client for the spawned `cadence serve` process.
struct Client {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<std::process::ChildStdout>,
}

impl Client {
    fn spawn() -> Self {
        Self::spawn_with_args(&["serve"])
    }

    fn spawn_with_args(args: &[&str]) -> Self {
        Self::spawn_in(args, Path::new(env!("CARGO_MANIFEST_DIR")))
    }

    fn spawn_in(args: &[&str], cwd: &Path) -> Self {
        let mut child = Command::new(env!("CARGO_BIN_EXE_cadence"))
            .current_dir(cwd)
            .args(args)
            .env("CADENCE_GLOBAL_CONFIG", "")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            // Inherited, not piped: a panic in the server prints here, and a
            // captured stderr would turn a stack trace into a test that
            // merely times out with nothing to read.
            .stderr(Stdio::inherit())
            .spawn()
            .expect("failed to spawn cadence serve");
        let stdin = child.stdin.take().expect("child stdin");
        let stdout = BufReader::new(child.stdout.take().expect("child stdout"));
        Self {
            child,
            stdin,
            stdout,
        }
    }

    /// Send one JSON-RPC message (request or notification) as a line.
    fn send(&mut self, msg: Value) {
        let line = serde_json::to_string(&msg).expect("serialize request");
        self.stdin
            .write_all(line.as_bytes())
            .expect("write request");
        self.stdin.write_all(b"\n").expect("write newline");
        self.stdin.flush().expect("flush stdin");
    }

    /// Read one JSON-RPC response line and parse it.
    fn recv(&mut self) -> Value {
        let mut line = String::new();
        self.stdout
            .read_line(&mut line)
            .expect("read response line");
        assert!(!line.is_empty(), "server closed stdout before responding");
        serde_json::from_str(&line)
            .unwrap_or_else(|e| panic!("response line was not JSON: {e}\nline: {line}"))
    }

    /// Run the initialize handshake: send `initialize`, read its response,
    /// then send `notifications/initialized`.
    fn handshake(&mut self) -> Value {
        self.send(json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": {"name": "probe", "version": "0"}
            }
        }));
        let init_response = self.recv();
        self.send(json!({
            "jsonrpc": "2.0",
            "method": "notifications/initialized"
        }));
        init_response
    }

    fn tools_list(&mut self, id: i64) -> Value {
        self.send(json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": "tools/list"
        }));
        self.recv()
    }

    fn tools_call(&mut self, id: i64, name: &str, arguments: Value) -> Value {
        self.send(json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": "tools/call",
            "params": {
                "name": name,
                "arguments": arguments
            }
        }));
        self.recv()
    }

    /// Close stdin and wait for the process to exit, returning its status.
    fn finish(mut self) -> std::process::ExitStatus {
        drop(self.stdin);
        self.child.wait().expect("wait for child")
    }
}

/// Whether a `tools/call` response's result carries `isError: true`.
fn is_error(response: &Value) -> bool {
    response["result"]["isError"] == json!(true)
}

/// Extract the concatenated text of every `type: "text"` content block in a
/// `tools/call` response's result.
fn result_text(response: &Value) -> String {
    response["result"]["content"]
        .as_array()
        .expect("result.content is an array")
        .iter()
        .filter(|block| block["type"] == "text")
        .map(|block| block["text"].as_str().expect("text field is a string"))
        .collect::<Vec<_>>()
        .join("")
}

/// The server key every later `mcp__cadence__<tool>` wire name is built from
/// (D-09). Renaming it silently invalidates every subagent definition,
/// `allowed-tools` block and hook matcher that spells a tool out.
#[test]
fn initialize_names_the_server_cadence_at_the_crate_version() {
    let mut client = Client::spawn();
    let response = client.handshake();
    let info = &response["result"]["serverInfo"];
    assert_eq!(info["name"], json!("cadence"), "response: {response}");
    assert_eq!(
        info["version"],
        json!(env!("CARGO_PKG_VERSION")),
        "response: {response}"
    );
    assert!(client.finish().success());
}

#[test]
fn tool_schemas_list_exactly_three_tools_with_output_schemas() {
    let mut client = Client::spawn();
    client.handshake();
    let response = client.tools_list(2);
    let tools = response["result"]["tools"]
        .as_array()
        .unwrap_or_else(|| panic!("result.tools is an array; response: {response}"));
    assert_eq!(tools.len(), 3, "response: {response}");
    assert_eq!(tools[0]["name"], json!("cadence_version"));
    assert_eq!(
        tools
            .iter()
            .map(|t| t["name"].as_str().unwrap())
            .collect::<Vec<_>>(),
        ["cadence_version", "cadence_query", "cadence_apply"]
    );
    for tool in tools {
        assert!(tool["outputSchema"].is_object());
        let output = tool["outputSchema"].to_string();
        for status in ["ok", "refused", "unknown", "not-applicable"] {
            assert!(output.contains(status));
        }
    }
    assert_eq!(tools[0]["inputSchema"]["additionalProperties"], false);
    let query = &tools[1]["inputSchema"];
    assert!(query.to_string().contains("execute-next"));
    assert!(schema_accepts(
        query,
        query,
        &json!({"operation":"execute-next","phase":6})
    ));
    for phase in [json!(0), json!(-1), json!(1.5), json!("6")] {
        assert!(!schema_accepts(
            query,
            query,
            &json!({"operation":"execute-next","phase":phase})
        ));
    }
    let patch = &tools[2]["inputSchema"];
    let sample = schema_fixture();
    assert!(schema_accepts(patch, patch, &sample));
    let mut paths = vec![];
    inspect_schema_objects(patch, patch, &sample, "", &mut paths);
    assert_eq!(paths.len(), 13);
    assert!(client.finish().success());
}

#[test]
fn tool_schemas_all_inputs_and_outputs_have_object_roots() {
    let mut client = Client::spawn();
    client.handshake();
    let response = client.tools_list(2);
    assert!(client.finish().success());
    let tools = response["result"]["tools"]
        .as_array()
        .unwrap_or_else(|| panic!("result.tools is an array; response: {response}"));
    assert!(
        !tools.is_empty(),
        "no advertised tools; response: {response}"
    );
    for tool in tools {
        for field in ["inputSchema", "outputSchema"] {
            let schema = tool
                .get(field)
                .unwrap_or_else(|| panic!("{} is missing {field}", tool["name"]));
            assert_eq!(
                schema.get("type"),
                Some(&json!("object")),
                "{}.{field} must have root type object; schema: {schema}",
                tool["name"]
            );
        }
    }
}

#[test]
fn cadence_version_returns_an_ok_envelope_as_structured_content() {
    let mut client = Client::spawn();
    client.handshake();
    let response = client.tools_call(2, "cadence_version", json!({}));
    assert!(
        !is_error(&response),
        "a successful report must not be an error; response: {response}"
    );
    let structured = &response["result"]["structuredContent"];
    assert_eq!(structured["status"], json!("ok"), "response: {response}");
    assert_eq!(structured["version"], json!(env!("CARGO_PKG_VERSION")));
    assert!(
        structured["os"].is_string() && structured["arch"].is_string(),
        "os and arch must both be present; response: {response}"
    );
    // The text block mirrors the structured content rather than replacing it.
    // Whether a host shows the model `structuredContent` or only text blocks
    // is not settled, so the answer has to survive either - and this is the
    // assertion that fails if a later change drops one of the two.
    let mirrored: Value =
        serde_json::from_str(&result_text(&response)).expect("the text block is the same JSON");
    assert_eq!(&mirrored, structured, "response: {response}");
    assert!(client.finish().success());
}

/// The session owns the process. When the host closes stdin the server stops,
/// cleanly, rather than surviving the session that started it.
#[test]
fn closing_stdin_exits_the_server_cleanly() {
    let client = Client::spawn();
    let status = client.finish();
    assert!(status.success(), "exit status was {status}");
}

fn schema_fixture() -> serde_json::Value {
    json!({
        "schema": 1, "kind": "executor", "dispatch_id": "dispatch-1",
        "expected_execution_version": 1, "outcome": "blocked",
        "tasks": [
            {"status":"completed","task_id":"T1","commit":"abc",
             "verification":{"disposition":"passed","commands":[
                 {"command":"verify","exit_code":0,"output_digest":"digest"}]},
             "evidence":[{"kind":"commit","sha":"abc"},
                 {"kind":"file-line","path":"src/a.rs","line":1},
                 {"kind":"criterion","id":"AC1"}]},
            {"status":"blocked","task_id":"T2","blocker_id":"B1"},
            {"status":"not-run","task_id":"T3"}
        ],
        "deviations":[{"id":"D1","text":"judgment","evidence":[{"kind":"criterion","id":"AC1"}]}],
        "blockers":[{"id":"B1","text":"judgment","evidence":[{"kind":"file-line","path":"src/a.rs","line":2}]}]
    })
}

fn resolve_schema<'a>(
    root: &'a serde_json::Value,
    node: &'a serde_json::Value,
) -> &'a serde_json::Value {
    match node.get("$ref") {
        Some(reference) => resolve_schema(
            root,
            root.pointer(reference.as_str().unwrap().strip_prefix('#').unwrap())
                .unwrap(),
        ),
        None => node,
    }
}

// Evaluate only the structural keywords generated for this contract. Field
// inventories below also check each independently authored object in full.
fn schema_accepts(
    root: &serde_json::Value,
    node: &serde_json::Value,
    value: &serde_json::Value,
) -> bool {
    let node = resolve_schema(root, node);
    if let Some(variants) = node.get("oneOf") {
        return variants
            .as_array()
            .unwrap()
            .iter()
            .filter(|variant| schema_accepts(root, variant, value))
            .count()
            == 1;
    }
    if node.get("const").is_some_and(|expected| expected != value)
        || node
            .get("enum")
            .is_some_and(|values| !values.as_array().unwrap().contains(value))
    {
        return false;
    }
    match node.get("type").and_then(|value| value.as_str()) {
        Some("object") => value.as_object().is_some_and(|object| {
            let empty = serde_json::Map::new();
            let properties = node["properties"].as_object().unwrap_or(&empty);
            node["required"]
                .as_array()
                .into_iter()
                .flatten()
                .all(|key| object.contains_key(key.as_str().unwrap()))
                && object.iter().all(|(key, value)| match properties.get(key) {
                    Some(property) => schema_accepts(root, property, value),
                    None => node["additionalProperties"] != false,
                })
        }),
        Some("array") => value.as_array().is_some_and(|values| {
            values
                .iter()
                .all(|value| schema_accepts(root, &node["items"], value))
        }),
        Some("string") => value.is_string(),
        Some("integer") => {
            (value.is_u64() || value.is_i64())
                && node
                    .get("minimum")
                    .is_none_or(|min| value.as_f64().unwrap() >= min.as_f64().unwrap())
                && node
                    .get("maximum")
                    .is_none_or(|max| value.as_f64().unwrap() <= max.as_f64().unwrap())
        }
        None => true,
        unexpected => panic!("unexpected schema type {unexpected:?}"),
    }
}

fn inspect_schema_objects(
    root: &serde_json::Value,
    node: &serde_json::Value,
    value: &serde_json::Value,
    path: &str,
    paths: &mut Vec<String>,
) {
    let mut node = resolve_schema(root, node);
    if let Some(variants) = node.get("oneOf") {
        node = variants
            .as_array()
            .unwrap()
            .iter()
            .find(|node| schema_accepts(root, node, value))
            .unwrap();
    }
    if let Some(object) = value.as_object() {
        assert_eq!(node["additionalProperties"], false, "{path}");
        let actual: BTreeSet<_> = object.keys().map(String::as_str).collect();
        let properties: BTreeSet<_> = node["properties"]
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect();
        let required: BTreeSet<_> = node["required"]
            .as_array()
            .unwrap()
            .iter()
            .map(|key| key.as_str().unwrap())
            .collect();
        assert_eq!(actual, properties, "{path}");
        assert_eq!(actual, required, "{path}");
        paths.push(path.to_owned());
        for (key, value) in object {
            inspect_schema_objects(
                root,
                &node["properties"][key],
                value,
                &format!("{path}/{key}"),
                paths,
            );
        }
    } else if let Some(array) = value.as_array() {
        for (index, value) in array.iter().enumerate() {
            inspect_schema_objects(
                root,
                &node["items"],
                value,
                &format!("{path}/{index}"),
                paths,
            );
        }
    }
}

fn envelope(response: &Value) -> Value {
    assert!(response.get("error").is_none(), "{response}");
    assert!(!is_error(response), "{response}");
    let structured = response["result"]["structuredContent"].clone();
    let mirrored: Value = serde_json::from_str(&result_text(response)).unwrap();
    assert_eq!(structured, mirrored);
    assert!(structured["status"].is_string());
    structured
}

fn isolated_client(project: &Path) -> Client {
    Client::spawn_with_args(&["serve", "--project-root", project.to_str().unwrap()])
}

fn missing_call(client: &mut Client, name: &str) -> Value {
    client.send(json!({"jsonrpc":"2.0","id":10,"method":"tools/call","params":{"name":name}}));
    client.recv()
}

#[test]
fn tool_schemas_malformed_objects_reach_cadence_and_protocol_errors_stay_distinct() {
    let temp = tempfile::tempdir().unwrap();
    fs::create_dir(temp.path().join(".planning")).unwrap();
    let mut client = isolated_client(temp.path());
    client.handshake();
    let listing = client.tools_list(2);
    for (index, name, sample) in [
        (0, "cadence_version", json!({})),
        (
            1,
            "cadence_query",
            json!({"operation":"execute-next","phase":6}),
        ),
        (2, "cadence_apply", schema_fixture()),
    ] {
        let missing = envelope(&missing_call(&mut client, name));
        assert_eq!(missing["status"], "refused");
        assert!(missing["code"].is_string() && missing["reason"].is_string());
        let schema = &listing["result"]["tools"][index]["inputSchema"];
        let mut paths = vec![String::new()];
        if index == 2 {
            paths.clear();
            inspect_schema_objects(schema, schema, &sample, "", &mut paths);
        }
        for path in paths {
            let object = sample.pointer(&path).unwrap().as_object().unwrap();
            let mut cases = vec![];
            for key in object.keys() {
                let mut missing = sample.clone();
                missing
                    .pointer_mut(&path)
                    .unwrap()
                    .as_object_mut()
                    .unwrap()
                    .remove(key);
                cases.push(missing);
                let mut wrong = sample.clone();
                wrong.pointer_mut(&path).unwrap()[key] = Value::Null;
                cases.push(wrong);
            }
            let mut extra = sample.clone();
            extra.pointer_mut(&path).unwrap()["foreign_state"] = json!(true);
            cases.push(extra);
            for case in cases {
                assert!(
                    !schema_accepts(schema, schema, &case),
                    "schema admitted {case}"
                );
                let answer = envelope(&client.tools_call(11, name, case));
                assert_eq!(answer["status"], "refused", "{answer}");
                assert!(answer["code"].is_string() && answer["reason"].is_string());
            }
        }
    }
    for (name, path, value) in [
        ("cadence_query", "/operation", json!("other")),
        ("cadence_query", "/phase", json!(0)),
        ("cadence_query", "/phase", json!(6.0)),
        ("cadence_apply", "/kind", json!("other")),
        ("cadence_apply", "/outcome", json!("other")),
        ("cadence_apply", "/tasks/0/status", json!("other")),
        ("cadence_apply", "/tasks/0/evidence/0/kind", json!("other")),
        ("cadence_apply", "/schema", json!(2)),
    ] {
        let mut input = if name == "cadence_query" {
            json!({"operation":"execute-next","phase":6})
        } else {
            schema_fixture()
        };
        *input.pointer_mut(path).unwrap() = value;
        assert_eq!(
            envelope(&client.tools_call(12, name, input))["status"],
            "refused"
        );
    }
    let unknown = client.tools_call(20, "undeclared", json!({}));
    assert_eq!(unknown["error"]["code"], -32602);
    client.send(json!({"jsonrpc":"2.0","id":21,"method":"tools/call","params":{"name":"cadence_query","arguments":[]}}));
    let invalid = client.recv();
    assert_eq!(invalid["error"]["code"], -32601);
    assert!(invalid.get("result").is_none());
    assert!(client.finish().success());
    let decisions = fs::read_to_string(temp.path().join(".planning/decisions.jsonl")).unwrap();
    assert!(decisions.contains("missing-arguments"));
    assert!(decisions.contains("invalid-patch"));
}

struct Fixture {
    temp: tempfile::TempDir,
}

struct AllowFixture;
impl cadence::store::Policy for AllowFixture {
    fn validate(&mut self, _: &cadence::store::MutationContext<'_>) -> cadence::store::Result<()> {
        Ok(())
    }
}

fn git(root: &Path, args: &[&str]) -> String {
    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "git {args:?}: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8(output.stdout).unwrap().trim().to_owned()
}

fn hash(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    format!("{:x}", Sha256::digest(bytes))
}

fn canonical(value: &Value) -> Value {
    match value {
        Value::Object(object) => Value::Object(
            object
                .iter()
                .map(|(key, value)| (key.clone(), canonical(value)))
                .collect::<std::collections::BTreeMap<_, _>>()
                .into_iter()
                .collect(),
        ),
        Value::Array(array) => Value::Array(array.iter().map(canonical).collect()),
        _ => value.clone(),
    }
}

impl Fixture {
    fn new(plans: &[&[&str]]) -> Self {
        let fixture = Self {
            temp: tempfile::tempdir().unwrap(),
        };
        let root = fixture.root();
        fs::create_dir_all(root.join(".planning/phases/6")).unwrap();
        fs::create_dir(root.join("src")).unwrap();
        fs::write(root.join("src/shared.txt"), "initial\n").unwrap();
        fs::write(root.join(".gitignore"), ".planning/state.json\n.planning/items.jsonl\n.planning/decisions.jsonl\n.planning/config.v4.json\n.planning/phases/6/SUMMARY.md\n").unwrap();
        fs::write(
            root.join(".planning/ROADMAP.md"),
            "## Phases\n- [ ] **Phase 6: Native execution**\n",
        )
        .unwrap();
        for (index, tasks) in plans.iter().enumerate() {
            let rows = tasks
                .iter()
                .map(|task| format!("    - id: {task}\n      verify: [\"printf {task}\"]\n"))
                .collect::<String>();
            fs::write(root.join(format!(".planning/phases/6/PLAN-{}.md", index + 1)),
                format!("---\nphase: 6\nplan: {}\nrequirements: [AC6]\nfiles: [src/shared.txt]\nexecution:\n  schema: 1\n  suite: printf suite\n  tasks:\n{rows}---\nChange the shared source for these tasks.\n", index + 1)).unwrap();
        }
        git(root, &["init", "-q"]);
        for (key, value) in [
            ("user.name", "John Crenshaw"),
            ("user.email", "john@jcrenshaw.dev"),
            ("gpg.format", "openpgp"),
            ("user.signingkey", "693AB15F91734B0C"),
            ("commit.gpgsign", "true"),
        ] {
            git(root, &["config", "--local", key, value]);
        }
        git(
            root,
            &[
                "add",
                "src/shared.txt",
                ".planning/ROADMAP.md",
                ".planning/phases/6",
                ".gitignore",
            ],
        );
        git(
            root,
            &["commit", "-q", "-m", "feat(6): initialize native fixture"],
        );
        // Initialize through the real public boundary. Continuation authority is
        // fixture input, seeded below through the store, not a service shortcut.
        let mut client = fixture.client();
        let answer = envelope(&missing_call(&mut client, "cadence_query"));
        fixture.assert_decision(&answer, "cadence_query", &Value::Null);
        assert!(client.finish().success());
        fixture.seed_authority();
        fixture
    }

    fn root(&self) -> &Path {
        self.temp.path()
    }

    fn client(&self) -> Client {
        let mut client = isolated_client(self.root());
        client.handshake();
        client
    }

    fn read(&self) -> cadence::store::writer::View {
        tokio::runtime::Builder::new_current_thread()
            .build()
            .unwrap()
            .block_on(async {
                let store = cadence::store::writer::Store::open(
                    cadence::store::filesystem::Filesystem::new(self.root().join(".planning"))
                        .unwrap(),
                    AllowFixture,
                )
                .await
                .unwrap();
                store
                    .request(cadence::store::writer::Operation::ReadVerified)
                    .await
                    .unwrap()
            })
    }

    fn seed_authority(&self) {
        use cadence::{
            evidence::{Record, persistence},
            store::{
                filesystem::Filesystem,
                transaction::Transaction,
                writer::{Operation, Store},
            },
        };
        let root = self.root();
        let planning = root.join(".planning");
        let mut record = json!({"version":1,"scope":{
            "project":root,"planning_root":planning,"cycle":"live","occurrence":"phase-6-execution",
            "phase":"6","plan":"native-execution","report":"phases/6/SUMMARY.md"},
            "fact":{"kind":"gate","value":{"id":"fixture-progress","purpose":"progress","checkpoint_id":null,
                "question":"Continue?","need":"Execution authority","options":[],"state":{"status":"unanswered"}}}});
        tokio::runtime::Builder::new_current_thread().build().unwrap().block_on(async {
            let store = Store::open(Filesystem::new(&planning).unwrap(), AllowFixture).await.unwrap();
            for (index, state) in [json!({"status":"unanswered"}), json!({"status":"answered","value":{
                "question_id":"fixture-progress","actual_response":"Proceed","selected_option":null,
                "adjustment":null,"disposition":"approve","authorization_id":"fixture-authorization"}})].into_iter().enumerate() {
                record["fact"]["value"]["state"] = state;
                let native: Record = serde_json::from_value(record.clone()).unwrap();
                let view = store.request(Operation::ReadVerified).await.unwrap();
                let id = format!("fixture-authority-{index}");
                store.request(Operation::Transact(Transaction { id: id.clone(), items: vec![],
                    decisions: vec![persistence::history(&id, &native).unwrap()],
                    snapshot: Some(persistence::project(&view.snapshot.data, &native).unwrap()), external: vec![] })).await.unwrap();
            }
        });
    }

    fn assert_decision(&self, answer: &Value, tool: &str, raw: &Value) {
        let tool_tag = if tool == "cadence_query" {
            "cadence-query"
        } else {
            "cadence-apply"
        };
        let operation = if tool == "cadence_query" {
            "execute-next"
        } else {
            "executor"
        };
        let request_digest = hash(
            &serde_json::to_vec(&json!(["execution-request-v1", tool_tag, operation, raw]))
                .unwrap(),
        );
        let view = self.read();
        let digest = hash(&serde_json::to_vec(&canonical(answer)).unwrap());
        let expected = if answer["status"] == "ok" {
            answer["outcome"].as_str().unwrap().to_string()
        } else {
            format!(
                "{}:{}",
                answer["status"].as_str().unwrap(),
                answer["code"].as_str().unwrap()
            )
        };
        let matches = view
            .decisions
            .iter()
            .filter_map(|record| match &record.decision {
                cadence::store::model::Decision::BoundaryV1(record)
                    if record.boundary.response_digest == digest
                        && (record.terminal
                            || (record.boundary.request_digest == request_digest
                                && serde_json::to_value(record.boundary.tool).unwrap()
                                    == tool_tag)) =>
                {
                    Some(record)
                }
                _ => None,
            })
            .collect::<Vec<_>>();
        assert_eq!(
            matches.len(),
            1,
            "expected exactly one decision for {answer}"
        );
        assert_eq!(matches[0].boundary.outcome, expected);
        if answer["outcome"] == "dispatch" {
            assert_eq!(
                matches[0].boundary.subject_id.as_deref(),
                answer["dispatch"]["id"].as_str()
            );
            assert_eq!(
                answer["prompt"].as_str().unwrap().len() as u64,
                answer["dispatch"]["prompt_bytes"].as_u64().unwrap()
            );
        } else {
            assert!(
                serde_json::to_vec(answer).unwrap().len() <= 16384,
                "compact envelope bound"
            );
            assert!(answer.get("prompt").is_none() && answer.get("body").is_none());
            if answer["status"] != "ok" {
                assert!(answer["reason"].as_str().unwrap().len() <= 1024);
            }
        }
    }

    fn call(&self, client: &mut Client, name: &str, input: Value) -> Value {
        let answer = envelope(&client.tools_call(30, name, input.clone()));
        self.assert_decision(&answer, name, &input);
        answer
    }

    fn query(&self, client: &mut Client) -> Value {
        self.call(
            client,
            "cadence_query",
            json!({"operation":"execute-next","phase":6}),
        )
    }

    fn semantic_bytes(&self) -> (Vec<u8>, Option<Vec<u8>>) {
        (
            serde_json::to_vec(&self.read().snapshot.data["execution"]).unwrap(),
            fs::read(self.root().join(".planning/phases/6/SUMMARY.md")).ok(),
        )
    }

    fn refuse(&self, client: &mut Client, input: Value, code: &str) {
        let before = self.semantic_bytes();
        let answer = self.call(client, "cadence_apply", input);
        assert_eq!(answer["status"], "refused");
        assert_eq!(answer["code"], code);
        assert_eq!(self.semantic_bytes(), before);
    }

    fn complete_patch(&self, dispatch: &Value) -> Value {
        let mut tasks = vec![];
        for task in dispatch["tasks"].as_array().unwrap() {
            let id = task["id"].as_str().unwrap();
            fs::write(
                self.root().join("src/shared.txt"),
                format!("completed {id}\n"),
            )
            .unwrap();
            let commands = task["verify"]
                .as_array()
                .unwrap()
                .iter()
                .map(|command| {
                    let output = Command::new("sh")
                        .args(["-c", command.as_str().unwrap()])
                        .current_dir(self.root())
                        .stdin(Stdio::null())
                        .output()
                        .unwrap();
                    assert!(output.status.success());
                    let mut bytes = output.stdout;
                    bytes.extend(output.stderr);
                    json!({"command":command,"exit_code":0,"output_digest":hash(&bytes)})
                })
                .collect::<Vec<_>>();
            git(self.root(), &["add", "src/shared.txt"]);
            git(
                self.root(),
                &["commit", "-q", "-m", &format!("feat(6): complete {id}")],
            );
            let sha = git(self.root(), &["rev-parse", "HEAD"]);
            tasks.push(json!({"status":"completed","task_id":id,"commit":sha,
                "verification":{"disposition":"passed","commands":commands},"evidence":[{"kind":"commit","sha":sha}]}));
        }
        let output = Command::new("sh")
            .args(["-c", dispatch["suite"].as_str().unwrap()])
            .current_dir(self.root())
            .stdin(Stdio::null())
            .output()
            .unwrap();
        assert!(output.status.success());
        json!({"schema":1,"kind":"executor","dispatch_id":dispatch["id"],
            "expected_execution_version":dispatch["expected_execution_version"],"outcome":"complete",
            "tasks":tasks,"deviations":[],"blockers":[]})
    }
}

#[test]
fn execution_calls_confirm_dispatch_completion_and_refused_patch_semantics() {
    let fixture = Fixture::new(&[&["T1"]]);
    let mut client = fixture.client();
    let first = fixture.query(&mut client);
    assert_eq!(first["outcome"], "dispatch");
    let patch = fixture.complete_patch(&first["dispatch"]);
    let mut malformed = patch.clone();
    malformed.as_object_mut().unwrap().remove("tasks");
    fixture.refuse(&mut client, malformed, "invalid-patch");
    let mut foreign = patch.clone();
    foreign["dispatch_id"] = json!("foreign");
    fixture.refuse(&mut client, foreign, "foreign-dispatch");
    let mut stale = patch.clone();
    stale["expected_execution_version"] = json!(999);
    fixture.refuse(&mut client, stale, "stale-execution");
    let mut schema = patch.clone();
    schema["schema"] = json!(2);
    fixture.refuse(&mut client, schema, "unsupported-patch-schema");
    let plan_path = fixture.root().join(".planning/phases/6/PLAN-1.md");
    let original = fs::read(&plan_path).unwrap();
    let mut changed = original.clone();
    changed.extend_from_slice(b"Changed controlling plan.\n");
    fs::write(&plan_path, changed).unwrap();
    fixture.refuse(&mut client, patch.clone(), "plan-set-changed");
    fs::write(&plan_path, original).unwrap();
    let sha = patch["tasks"][0]["commit"].as_str().unwrap();
    git(
        fixture.root(),
        &[
            "checkout",
            "-q",
            "--detach",
            first["dispatch"]["base_sha"].as_str().unwrap(),
        ],
    );
    fixture.refuse(&mut client, patch.clone(), "git-order");
    git(fixture.root(), &["checkout", "-q", "--detach", sha]);
    let complete = fixture.call(&mut client, "cadence_apply", patch.clone());
    assert_eq!(
        complete,
        json!({"status":"ok","outcome":"complete","phase":6})
    );
    assert_eq!(fixture.call(&mut client, "cadence_apply", patch), complete);
    assert_eq!(fixture.query(&mut client), complete);
    assert!(client.finish().success());
}

#[test]
fn execution_calls_confirm_blocked_judgment_stop() {
    let fixture = Fixture::new(&[&["T1", "T2"]]);
    let mut client = fixture.client();
    let dispatch = fixture.query(&mut client)["dispatch"].clone();
    let answer = fixture.call(&mut client, "cadence_apply", json!({"schema":1,"kind":"executor",
        "dispatch_id":dispatch["id"],"expected_execution_version":dispatch["expected_execution_version"],
        "outcome":"blocked","tasks":[{"status":"blocked","task_id":"T1","blocker_id":"B1"},
            {"status":"not-run","task_id":"T2"}],"deviations":[],
        "blockers":[{"id":"B1","text":"Needs a decision","evidence":[{"kind":"criterion","id":"AC6"}]}]}));
    assert_eq!(
        answer,
        json!({"status":"ok","outcome":"judgment-stop","phase":6,
        "dispatch_id":dispatch["id"],"blocker_ids":["B1"]})
    );
    assert_eq!(fixture.query(&mut client), answer);
    assert!(client.finish().success());
}

#[test]
fn execution_calls_store_failure_never_acknowledges_a_refusal() {
    let fixture = Fixture::new(&[&["T1"]]);
    let mut client = fixture.client();
    fixture.query(&mut client);
    let before = fixture.semantic_bytes();
    let intent = fixture.root().join(".planning/.store-intent.json");
    fs::create_dir(&intent).unwrap();
    let response = client.tools_call(31, "cadence_apply", json!({"unexpected":"field"}));
    assert_eq!(response["error"]["code"], -32603);
    assert_eq!(response["error"]["data"]["failure"], "store");
    assert!(response.get("result").is_none());
    assert!(
        !response
            .to_string()
            .contains(fixture.root().to_str().unwrap())
    );
    fs::remove_dir(intent).unwrap();
    assert_eq!(fixture.semantic_bytes(), before);
    let retry = client.tools_call(32, "cadence_apply", json!({"unexpected":"field"}));
    assert_eq!(retry["error"]["code"], -32603);
    assert!(client.finish().success());
    let mut replacement = fixture.client();
    fixture.refuse(
        &mut replacement,
        json!({"unexpected":"field"}),
        "invalid-patch",
    );
    assert!(replacement.finish().success());
}

#[test]
fn execution_calls_log_bound_replay_preserves_terminal_bytes() {
    let fixture = Fixture::new(&[&["T1"]]);
    let mut client = fixture.client();
    let dispatch = fixture.query(&mut client);
    for index in 0..260 {
        let answer = fixture.call(
            &mut client,
            "cadence_apply",
            json!({"dispatch_id":dispatch["dispatch"]["id"],"invalid":index}),
        );
        if answer["code"] == "log-bound" {
            break;
        }
        assert_eq!(answer["code"], "invalid-patch");
    }
    let terminal = fixture.query(&mut client);
    assert_eq!(
        terminal,
        json!({"status":"refused","code":"log-bound",
        "reason":"the boundary scope reached its 256-transition limit"})
    );
    let before = fs::read(fixture.root().join(".planning/decisions.jsonl")).unwrap();
    let state = fs::read(fixture.root().join(".planning/state.json")).unwrap();
    assert!(client.finish().success());
    let mut replacement = fixture.client();
    assert_eq!(fixture.query(&mut replacement), terminal);
    assert_eq!(
        fixture.call(
            &mut replacement,
            "cadence_apply",
            json!({"dispatch_id":dispatch["dispatch"]["id"]})
        ),
        terminal
    );
    assert_eq!(
        fs::read(fixture.root().join(".planning/decisions.jsonl")).unwrap(),
        before
    );
    assert_eq!(
        fs::read(fixture.root().join(".planning/state.json")).unwrap(),
        state
    );
    assert!(replacement.finish().success());
}

fn markdown_parts(relative: &str) -> (Value, String) {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let text = fs::read_to_string(root.join(relative)).unwrap();
    let rest = text.strip_prefix("---\n").unwrap();
    let (frontmatter, body) = rest.split_once("\n---\n").unwrap();
    (
        serde_saphyr::from_str(frontmatter).unwrap(),
        body.to_owned(),
    )
}

#[test]
fn skill_contract_matches_wire_patch_and_direct_tool_permissions() {
    let (skill, main) = markdown_parts("skills/cad-execute/SKILL.md");
    let (contract, executor) = markdown_parts("skills/cad-executor-contract/SKILL.md");
    let (agent, fixed) = markdown_parts("agents/cad-executor.md");
    assert_eq!(skill["name"], "cad-execute");
    assert_eq!(
        skill["allowed-tools"],
        json!([
            "mcp__cadence__cadence_query",
            "mcp__cadence__cadence_apply",
            "Task"
        ])
    );
    assert_eq!(contract["name"], "cad-executor-contract");
    assert_eq!(contract["user-invocable"], false);
    assert_eq!(agent["name"], "cad-executor");
    assert_eq!(agent["skills"], json!(["cad-executor-contract"]));
    assert_eq!(
        agent["tools"]
            .as_str()
            .unwrap()
            .split(", ")
            .collect::<Vec<_>>(),
        [
            "Read",
            "Write",
            "Edit",
            "Bash",
            "Grep",
            "Glob",
            "LSP",
            "mcp__excerpt__excerpt_read",
            "mcp__excerpt__excerpt_search"
        ]
    );
    let process = main
        .split_once("<process>")
        .unwrap()
        .1
        .split_once("</process>")
        .unwrap()
        .0;
    assert_eq!(
        process
            .lines()
            .filter(|line| line.starts_with(|c: char| c.is_ascii_digit()))
            .count(),
        5
    );
    let query = process.find("mcp__cadence__cadence_query").unwrap();
    let task = process.find("Task").unwrap();
    let apply = process.find("mcp__cadence__cadence_apply").unwrap();
    assert!(query < task && task < apply);
    for token in [
        "cad-executor",
        "unchanged",
        "exactly the returned prompt",
        "field-for-field",
        "refused",
        "unknown",
        "not-applicable",
        "judgment-stop",
        "complete",
        "next-plan",
    ] {
        assert!(main.contains(token), "missing loop token {token}");
    }
    for token in [
        "signed",
        "task ID",
        "suite",
        "completed",
        "blocked",
        "not-run",
        ".planning/",
        "rung: fixed",
        "branch: current",
        "reviews: disabled",
        "one JSON object",
    ] {
        assert!(executor.contains(token), "missing executor token {token}");
    }
    let patch_text = executor
        .split_once("<patch-shape>\n")
        .unwrap()
        .1
        .split_once("\n</patch-shape>")
        .unwrap()
        .0;
    let patch: Value = serde_json::from_str(patch_text).unwrap();
    let mut client = Client::spawn();
    client.handshake();
    let listing = client.tools_list(2);
    let schema = &listing["result"]["tools"][2]["inputSchema"];
    assert!(schema_accepts(schema, schema, &patch));
    let mut paths = vec![];
    inspect_schema_objects(schema, schema, &patch, "", &mut paths);
    assert_eq!(paths.len(), 13);
    assert_eq!(
        patch.as_object().unwrap().keys().collect::<BTreeSet<_>>(),
        schema_fixture()
            .as_object()
            .unwrap()
            .keys()
            .collect::<BTreeSet<_>>()
    );
    assert!(client.finish().success());
    for text in [
        &main,
        &executor,
        &fixed,
        &skill.to_string(),
        &contract.to_string(),
        &agent.to_string(),
    ] {
        for forbidden in [
            ".mjs",
            "node ",
            "reports/",
            "STATE.md",
            "SUMMARY.md",
            "cadence serve",
            "cadence query",
            "cadence apply",
            "worktree",
            "AskUserQuestion",
            "ToolSearch",
        ] {
            assert!(
                !text.contains(forbidden),
                "forbidden contract channel {forbidden}"
            );
        }
    }
}

#[test]
fn execute_restart_preserves_dispatch_and_advances_overlapping_signed_plans() {
    let fixture = Fixture::new(&[&["T1", "T2"], &["T3", "T4"]]);
    let mut first_child = fixture.client();
    let first_pid = first_child.child.id();
    let first = fixture.query(&mut first_child);
    assert_eq!(first["status"], "ok");
    assert_eq!(first["outcome"], "dispatch");
    assert_eq!(first["dispatch"]["plan"], 1);
    assert_eq!(first["dispatch"]["files"], json!(["src/shared.txt"]));
    assert_eq!(
        first["dispatch"]["policy"],
        json!({"rung":"fixed","branch":"current","reviews":"disabled"})
    );
    let original_bytes = serde_json::to_vec(&first).unwrap();
    // Independently authored request: no ExecutorPatch or expected response type.
    let missing_task = json!({"schema":1,"kind":"executor","dispatch_id":first["dispatch"]["id"],
        "expected_execution_version":first["dispatch"]["expected_execution_version"],"outcome":"blocked",
        "tasks":[{"status":"blocked","task_id":"T1","blocker_id":"B1"}],"deviations":[],
        "blockers":[{"id":"B1","text":"Fixture stop","evidence":[{"kind":"criterion","id":"AC6"}]}]});
    fixture.refuse(&mut first_child, missing_task.clone(), "task-set");
    let mut foreign_state = missing_task.clone();
    foreign_state["state"] = json!({"complete":true});
    fixture.refuse(&mut first_child, foreign_state, "invalid-patch");
    let mut wrong_dispatch = missing_task;
    wrong_dispatch["dispatch_id"] = json!("another-dispatch");
    fixture.refuse(&mut first_child, wrong_dispatch, "foreign-dispatch");
    assert_eq!(
        serde_json::to_vec(&fixture.query(&mut first_child)).unwrap(),
        original_bytes
    );
    assert!(first_child.finish().success());

    let mut second_child = fixture.client();
    let second_pid = second_child.child.id();
    assert_ne!(first_pid, second_pid);
    assert_eq!(
        serde_json::to_vec(&fixture.query(&mut second_child)).unwrap(),
        original_bytes
    );
    let first_patch = fixture.complete_patch(&first["dispatch"]);
    let next = fixture.call(&mut second_child, "cadence_apply", first_patch.clone());
    assert_eq!(
        next,
        json!({"status":"ok","outcome":"next-plan","phase":6,"plan":2})
    );
    let first_summary = fs::read(fixture.root().join(".planning/phases/6/SUMMARY.md")).unwrap();
    assert!(String::from_utf8_lossy(&first_summary).contains("Status: executing"));
    assert!(second_child.finish().success());

    let mut third_child = fixture.client();
    let third_pid = third_child.child.id();
    assert_ne!(third_pid, first_pid);
    assert_ne!(third_pid, second_pid);
    let second = fixture.query(&mut third_child);
    assert_eq!(second["outcome"], "dispatch");
    assert_eq!(second["dispatch"]["plan"], 2);
    assert_eq!(second["dispatch"]["files"], first["dispatch"]["files"]);
    assert_eq!(
        second["dispatch"]["base_sha"],
        first_patch["tasks"][1]["commit"]
    );
    assert_ne!(second["dispatch"]["id"], first["dispatch"]["id"]);
    assert!(
        second["dispatch"]["expected_execution_version"]
            .as_u64()
            .unwrap()
            > first["dispatch"]["expected_execution_version"]
                .as_u64()
                .unwrap()
    );
    fixture.refuse(
        &mut third_child,
        json!({"dispatch_id":second["dispatch"]["id"],"state":{}}),
        "invalid-patch",
    );
    assert_eq!(
        fs::read(fixture.root().join(".planning/phases/6/SUMMARY.md")).unwrap(),
        first_summary
    );
    assert_eq!(fixture.query(&mut third_child), second);
    let second_patch = fixture.complete_patch(&second["dispatch"]);
    let complete = fixture.call(&mut third_child, "cadence_apply", second_patch.clone());
    assert_eq!(
        complete,
        json!({"status":"ok","outcome":"complete","phase":6})
    );
    assert_eq!(fixture.query(&mut third_child), complete);
    assert!(third_child.finish().success());

    let mut fourth_child = fixture.client();
    assert!(![first_pid, second_pid, third_pid].contains(&fourth_child.child.id()));
    assert_eq!(fixture.query(&mut fourth_child), complete);
    assert!(fourth_child.finish().success());

    let commits = first_patch["tasks"]
        .as_array()
        .unwrap()
        .iter()
        .chain(second_patch["tasks"].as_array().unwrap())
        .map(|row| row["commit"].as_str().unwrap())
        .collect::<Vec<_>>();
    assert_eq!(commits.iter().collect::<BTreeSet<_>>().len(), 4);
    let base = first["dispatch"]["base_sha"].as_str().unwrap();
    assert_eq!(
        git(
            fixture.root(),
            &["rev-list", "--reverse", &format!("{base}..HEAD")]
        )
        .lines()
        .collect::<Vec<_>>(),
        commits
    );
    let mut previous = base;
    for (index, sha) in commits.iter().enumerate() {
        let object = git(fixture.root(), &["cat-file", "-p", sha]);
        assert!(object.contains("gpgsig -----BEGIN PGP SIGNATURE-----"));
        assert!(object.contains(&format!("parent {previous}\n")));
        assert!(object.contains("author John Crenshaw <john@jcrenshaw.dev>"));
        let task_id = format!("T{}", index + 1);
        assert!(object.ends_with(&format!("feat(6): complete {task_id}")));
        git(fixture.root(), &["verify-commit", sha]);
        assert_eq!(
            git(fixture.root(), &["show", "-s", "--format=%G? %GK", sha]),
            "G 693AB15F91734B0C"
        );
        git(
            fixture.root(),
            &["merge-base", "--is-ancestor", previous, sha],
        );
        assert_eq!(
            git(
                fixture.root(),
                &["diff-tree", "--no-commit-id", "--name-only", "-r", sha]
            ),
            "src/shared.txt"
        );
        previous = sha;
    }
    let summary = fs::read_to_string(fixture.root().join(".planning/phases/6/SUMMARY.md")).unwrap();
    assert!(summary.contains("Status: complete"));
    let rows = summary
        .lines()
        .filter(|line| line.contains(" | completed | "))
        .map(|line| line.split('|').map(str::trim).collect::<Vec<_>>())
        .collect::<Vec<_>>();
    assert_eq!(rows.len(), 4);
    for (index, row) in rows.iter().enumerate() {
        assert_eq!(row[1], (index / 2 + 1).to_string());
        assert_eq!(row[2], format!("T{}", index + 1));
        assert_eq!(row[4], commits[index]);
        assert_eq!(row[5], "passed");
    }
    let summary_shas = summary
        .split(|c: char| !c.is_ascii_hexdigit())
        .filter(|token| token.len() == 40)
        .collect::<Vec<_>>();
    assert_eq!(summary_shas, commits);
    let view = fixture.read();
    assert_eq!(
        view.snapshot.data["execution"]["occurrences"]["6"]["plans"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
}

#[test]
fn execute_restart_root_binding_and_version_remain_isolated() {
    let fixture = Fixture::new(&[&["T1"]]);
    let other = Fixture::new(&[&["T1"]]);
    let other_before = other.read().snapshot;
    let alias_temp = tempfile::tempdir().unwrap();
    let alias = alias_temp.path().join("project-link");
    std::os::unix::fs::symlink(fixture.root(), &alias).unwrap();
    let mut explicit = isolated_client(&alias);
    explicit.handshake();
    let before = fixture.read().snapshot;
    assert_eq!(
        envelope(&explicit.tools_call(35, "cadence_version", json!({})))["status"],
        "ok"
    );
    assert_eq!(
        envelope(&missing_call(&mut explicit, "cadence_version"))["status"],
        "refused"
    );
    assert_eq!(fixture.read().snapshot, before);
    let rejected = fixture.call(
        &mut explicit,
        "cadence_query",
        json!({"operation":"execute-next","phase":6,"project_root":other.root()}),
    );
    assert_eq!(rejected["status"], "refused");
    assert_eq!(other.read().snapshot, other_before);
    let first = fixture.query(&mut explicit);
    let pid = explicit.child.id();
    assert!(explicit.finish().success());
    let mut discovered = Client::spawn_in(&["serve"], fixture.root());
    discovered.handshake();
    assert_ne!(discovered.child.id(), pid);
    assert_eq!(fixture.query(&mut discovered), first);
    assert!(discovered.finish().success());
}

// Phase 5's executable inventory retains this registration name. The version
// entry remains unique; tool_schemas owns the complete three-tool inventory.
#[test]
fn tools_list_declares_exactly_cadence_version_with_an_output_schema() {
    let mut client = Client::spawn();
    client.handshake();
    let response = client.tools_list(2);
    let versions = response["result"]["tools"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|tool| tool["name"] == "cadence_version")
        .collect::<Vec<_>>();
    assert_eq!(versions.len(), 1);
    assert!(versions[0]["outputSchema"].is_object());
    assert!(client.finish().success());
}
