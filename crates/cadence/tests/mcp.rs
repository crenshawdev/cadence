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
        let mut child = Command::new(env!("CARGO_BIN_EXE_cadence"))
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
