//! Integration tests: spawn the real `cadence serve` binary and drive it over
//! stdio with hand-rolled newline-delimited JSON-RPC. No client-side rmcp
//! feature is needed for this, and nothing here shares a process with the
//! server. These tests prove wire behavior, not host/model semantics. Synthetic
//! fixture patches and command receipts do not prove that an executor ran.
//! AC3/AC7's live clauses require the observations in phase 6's UAT.md; source,
//! test-output and judgment quality and compaction causality are not asserted.
//! Phase 11 attempt history, checkpoints and general SUMMARY/task/lease behavior,
//! and phase 7-9 commit/Bash/routing/review rails remain unimplemented by this slice.
//!
//! The `Client` below is the seed of phase 2's golden harness, so it knows
//! nothing about which tools exist. Every fact about the surface is stated in
//! an assertion, never baked into the client.

use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};

use serde_json::{Value, json};
use std::{collections::BTreeSet, fs, path::Path};

#[path = "support/signing.rs"]
mod signing;

#[path = "support/phase13.rs"]
pub mod phase13;
#[path = "support/phase31.rs"]
#[allow(dead_code)]
mod phase31;

#[test]
fn execution_index_continues_before_exceeding_its_byte_budget() {
    let mut round = phase31::ClosedRound::admitted_with_tasks(64);
    let mut request = json!({"operation":"execution-history","phase":31});
    let mut task_ids = std::collections::BTreeSet::new();
    let mut pages = 0;
    loop {
        let page = round.client.call("cadence_query", request.clone());
        assert_eq!(page["status"], "ok", "{page}");
        assert!(page.to_string().len() <= 65536);
        assert!(page.get("events").is_none() && page.get("plan_events").is_none());
        for task in page["tasks"].as_array().unwrap() {
            assert!(task_ids.insert(task["task"]["task"].as_str().unwrap().to_owned()));
            assert_eq!(task["state"]["version"], 0);
            assert_eq!(task["runs"], json!([]));
        }
        pages += 1;
        assert!(pages < 20);
        if page["incomplete"] == false { break; }
        assert!(page["continue"]["task"].is_string());
        request["plan"] = page["continue"]["plan"].clone();
        request["task"] = page["continue"]["task"].clone();
    }
    assert!(pages > 1);
    assert_eq!(task_ids.len(), 64);
    round.client.finish();
}

#[test]
fn execution_index_counts_omitted_run_ids() {
    let mut round = phase31::ClosedRound::admitted();
    let history = round.client.call("cadence_query", json!({"operation":"execution-history","phase":31}));
    let task = history["tasks"][0]["task"].clone();
    let started = round.client.call("cadence_apply", json!({"operation":"execution-task-start","request":{
        "request_id":"index-start","task":task,"attempt":"index-attempt","expected_version":0,
        "predecessor":null,"checks":[round.check]}}));
    assert_eq!(started["status"], "ok", "{started}");
    for number in 0..7 {
        let history = round.client.call("cadence_query", json!({"operation":"execution-history","phase":31}));
        let id = format!("index-run-{number}-{}", "r".repeat(3000));
        let launch = round.client.call("cadence_apply", json!({"operation":"execution-run","request":{
            "request_id":id,"task":task,"attempt":"index-attempt","expected_version":history["tasks"][0]["state"]["version"],
            "command":"python3 -B tests/tiny.py","check":null,"stage":"verify"}}));
        assert_eq!(launch["status"], "ok", "{launch}");
        round.client.wait_for_event(31, &id);
    }
    let index = round.client.call("cadence_query", json!({"operation":"execution-history","phase":31}));
    assert!(index.to_string().len() <= 65536);
    assert_eq!(index["tasks"][0]["runs"].as_array().unwrap().len(), 2);
    assert_eq!(index["tasks"][0]["runs_omitted"], 5);
    assert_eq!(index["incomplete"], false);
    round.client.finish();
}

#[test]
fn verification_index_bounds_observations_and_preserves_attempt_parts() {
    let fixture = phase13::Completed::new();
    let project = fixture.project();
    let (attempt, mut patch) = phase13::inspect(project, "bounded-observation", &[]);
    let observation = "é".repeat(7_500);
    for item in patch["items"].as_array_mut().unwrap() {
        item["observed"] = json!(observation);
    }
    let accepted = phase13::apply(project, json!({"operation":"verification-submit","patch":patch}));
    assert_eq!(accepted["status"], "ok", "{accepted}");
    let mut client = phase13::Client::open(project);
    let index = client.call("cadence_query", json!({"operation":"verification-read","phase":13}));
    assert!(index.to_string().len() <= 65536);
    assert!(index.get("report").is_none());
    assert!(index["attempt"].get("inputs").is_none());
    assert!(index["history"][0].get("truths").is_none());
    for truth in index["truths"].as_array().unwrap() {
        for item in truth["items"].as_array().unwrap() {
            assert_eq!(item["observed"], "é".repeat(1024));
            assert_eq!(item["truncated"], true);
            assert_eq!(item["identity"]["attempt"], attempt["id"]);
        }
    }
    let identity = &index["identity"];
    let full: Value = serde_json::from_str(&phase13::document_part(&mut client, identity, "claim:bounded-observation-patch")).unwrap();
    assert_eq!(full["patch"]["items"][0]["observed"], observation);
    let history = client.call("cadence_query", json!({"operation":"execution-history","phase":13,"plan":1}));
    assert!(history.to_string().len() <= 65536);
    assert!(history.get("events").is_none() && history.get("plan_events").is_none());
    assert!(history["plans"].as_array().unwrap().iter().all(|p| p["plan"]["plan"] == 1));
    assert!(history["tasks"].as_array().unwrap().iter().all(|t| t["task"]["plan"] == 1 && t["close"].is_string()));
    let empty = client.call("cadence_query", json!({"operation":"execution-history","phase":13,"plan":999}));
    assert_eq!(empty["plans"], json!([]));
    assert_eq!(empty["tasks"], json!([]));
    client.finish();
}

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
        Self::spawn_in_with_keyring(args, cwd, None)
    }

    fn spawn_in_with_keyring(args: &[&str], cwd: &Path, gnupg_home: Option<&Path>) -> Self {
        let mut command = Command::new(env!("CARGO_BIN_EXE_cadence"));
        if let Some(home) = gnupg_home {
            command.env("GNUPGHOME", home);
        }
        let mut child = command
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
    assert_eq!(response["result"]["instructions"], cadence::read::instructions::CONTRACT);
    assert!(client.finish().success());
}

#[test]
fn tool_schemas_list_exactly_three_tools_with_minimal_inputs() {
    // Refused calls below still open a store, so the server runs in a temp
    // project rather than the crate directory.
    let temp = tempfile::tempdir().unwrap();
    fs::create_dir(temp.path().join(".planning")).unwrap();
    let mut client = isolated_client(temp.path());
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
        assert!(
            tool.get("outputSchema").is_none(),
            "{} must not declare outputSchema",
            tool["name"]
        );
    }
    let tools_bytes = serde_json::to_vec(tools).unwrap().len();
    assert!(
        tools_bytes < 9_900,
        "tools/list result.tools is {tools_bytes} bytes; measured 6,846 bytes before top-level types, 9,303 bytes with the derived property union, 9,578 once adoption-declare and capture joined the apply enum, 9,830 once why joined the query enum with path, line and top"
    );
    assert_eq!(tools[0]["inputSchema"]["additionalProperties"], false);
    for (tool, names) in [("query", query_operation_names()), ("apply", apply_operation_names())] {
        let declared = tools.iter().find(|entry| entry["name"] == format!("cadence_{tool}")).unwrap();
        let description = format!("Full request shapes: cadence_query {{\"operation\":\"schema\",\"tool\":\"{tool}\",\"for\":\"<operation>\"}} or the compiled contracts.");
        let input = &declared["inputSchema"];
        assert_eq!(input["type"], "object");
        assert_eq!(input["required"], json!(["operation"]));
        assert_eq!(input["additionalProperties"], true);
        for keyword in ["$defs", "$ref", "oneOf", "anyOf"] {
            assert!(input.get(keyword).is_none(), "{tool}: root contains {keyword}");
        }
        let properties = input["properties"].as_object().unwrap();
        assert_eq!(properties["operation"], json!({
            "type":"string", "enum":names, "description":description
        }));
        let mut expected = std::collections::BTreeMap::<String, BTreeSet<String>>::new();
        for operation in &names {
            let schema = served_operation_schema(&mut client, tool, operation);
            for (name, property) in schema["properties"].as_object().unwrap() {
                if name == "operation" { continue; }
                expected.entry(name.clone()).or_default()
                    .extend(schema_plain_types(&schema, property));
            }
        }
        for (name, types) in &expected {
            let property = properties.get(name)
                .unwrap_or_else(|| panic!("{tool}: tools/list omits argument {name}"));
            let mut plain = json!({});
            if types.len() == 1 {
                plain["type"] = json!(types.first().unwrap());
            } else if !types.is_empty() {
                plain["type"] = json!(types);
            }
            if types.contains("object") { plain["additionalProperties"] = json!(true); }
            assert_eq!(property, &plain, "{tool}: plain types for {name}");
        }
        let mut expected_names = expected.keys().map(String::as_str).collect::<Vec<_>>();
        expected_names.push("operation");
        expected_names.sort_unstable();
        assert_eq!(properties.keys().map(String::as_str).collect::<Vec<_>>(), expected_names,
            "{tool}: exactly the top-level properties, sorted by name");
    }
    let query = &tools[1]["inputSchema"];
    for sample in [json!({"operation":"execute-next","phase":6}),
        json!({"operation":"execute-next","phase":6,"plan":2})] {
        assert!(schema_accepts(query, query, &sample));
    }
    // The tool list declares plain types; the selected handler still validates fields.
    for phase in [json!(0), json!(-1), json!(1.5), json!("6")] {
        let answer = envelope(&client.tools_call(
            3,
            "cadence_query",
            json!({"operation":"execute-next","phase":phase}),
        ));
        assert_eq!(answer["status"], "refused", "{answer}");
    }
    for plan in [json!(0), json!(-1), json!(1.5), json!("2")] {
        let answer = envelope(&client.tools_call(
            4,
            "cadence_query",
            json!({"operation":"execute-next","phase":6,"plan":plan}),
        ));
        assert_eq!(answer["status"], "refused", "{answer}");
    }
    let patch = &tools[2]["inputSchema"];
    assert!(!schema_accepts(patch, patch, &schema_fixture()), "legacy patches have no declared operation but still reach the handler");
    assert!(client.finish().success());
}

fn served_operation_schema(client: &mut Client, tool: &str, operation: &str) -> Value {
    let mut request = json!({"operation":"schema","tool":tool,"for":operation});
    let mut serialized = String::new();
    loop {
        let answer = envelope(&client.tools_call(3, "cadence_query", request.clone()));
        assert_eq!(answer["status"], "ok", "{answer}");
        if let Some(schema) = answer.get("schema") { return schema.clone(); }
        serialized.push_str(answer["body"].as_str().unwrap());
        if answer["next"].is_null() { return serde_json::from_str(&serialized).unwrap(); }
        request["part"] = answer["next"].clone();
    }
}

fn schema_plain_types(root: &Value, node: &Value) -> BTreeSet<String> {
    let node = resolve_schema(root, node);
    let mut types = BTreeSet::new();
    match &node["type"] {
        Value::String(kind) => { types.insert(kind.clone()); }
        Value::Array(kinds) => types.extend(kinds.iter().map(|kind| kind.as_str().unwrap().to_owned())),
        _ => {}
    }
    for keyword in ["oneOf", "anyOf", "allOf"] {
        if let Some(variants) = node[keyword].as_array() {
            for variant in variants { types.extend(schema_plain_types(root, variant)); }
        }
    }
    types.remove("null");
    types
}

// Read the enum tables themselves so adding an operation cannot silently omit
// its name from tools/list. Only variant-level serde names are operation names.
fn enum_source<'a>(source: &'a str, name: &str) -> &'a str {
    source.split_once(&format!("enum {name} {{")).unwrap().1.split_once("\n}").unwrap().0
}

fn operation_names(source: &str, name: &str) -> Vec<String> {
    let names = regex::Regex::new(r#"(?m)^    #\[serde\(rename\s*=\s*"([^"]+)"\)\]"#).unwrap();
    names.captures_iter(enum_source(source, name)).map(|capture| capture[1].to_owned()).collect()
}

fn apply_operation_names() -> Vec<String> {
    let source = include_str!("../src/server.rs");
    let mut names = Vec::new();
    for line in enum_source(source, "ApplyArguments").lines().filter(|line| line.contains('(')) {
        let ty = line.split_once('(').unwrap().1.split_once(')').unwrap().0;
        if ty == "ExecutorPatch" { continue; } // The unchanged unnamed legacy request.
        let (module, name) = ty.rsplit_once("::").unwrap();
        let module = module.strip_prefix("cadence::").unwrap_or(module).replace("::", "/");
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("src").join(format!("{module}.rs"));
        names.extend(operation_names(&fs::read_to_string(path).unwrap(), name));
    }
    names
}

fn query_operation_names() -> Vec<String> {
    let mut names = operation_names(include_str!("../src/server.rs"), "QueryArguments");
    // Schema discovery itself must remain discoverable.
    if !names.iter().any(|name| name == "schema") { names.push("schema".into()); }
    names.extend(operation_names(include_str!("../src/review_service.rs"), "Query"));
    names
}

// Derive the same group prefix as the apply table, preserving schemars' names
// for generic definitions and types with identical Rust names across modules.
#[derive(schemars::JsonSchema)]
#[serde(untagged)]
#[allow(dead_code)]
enum ApplySchemaGroups {
    Verification(cadence::verification::model::Apply),
    NativeRetirement(cadence::execution::history::RetirementApply),
    NativeProgress(cadence::execution::history::ProgressApply),
    NativeClose(cadence::execution::receipts::CloseApply),
    NativeOwner(cadence::execution::receipts::OwnerApply),
    NativeRunner(cadence::execution::runner::Apply),
}

#[derive(schemars::JsonSchema)]
#[serde(tag = "operation", deny_unknown_fields)]
#[allow(dead_code)]
enum VerificationSchema {
    #[serde(rename = "verify-next")]
    Next { phase: std::num::NonZeroU32, request_id: Option<String> },
}

fn derived_operation(root: &Value, node: &Value, name: &str) -> Option<Value> {
    let node = resolve_schema(root, node);
    if node["properties"]["operation"]["const"] == name { return Some(node.clone()); }
    node.get("oneOf").or_else(|| node.get("anyOf"))?.as_array()?.iter()
        .find_map(|variant| derived_operation(root, variant, name))
}

fn operation_with_definitions(root: &Value, name: &str) -> Value {
    fn references(node: &Value, names: &mut BTreeSet<String>) {
        match node {
            Value::Object(fields) => {
                if let Some(reference) = fields.get("$ref").and_then(Value::as_str) {
                    names.insert(reference.strip_prefix("#/$defs/").unwrap().to_owned());
                }
                for value in fields.values() { references(value, names); }
            }
            Value::Array(values) => for value in values { references(value, names); },
            _ => {}
        }
    }
    let mut schema = derived_operation(root, root, name).unwrap();
    let mut names = BTreeSet::new();
    references(&schema, &mut names);
    loop {
        let previous = names.clone();
        for name in &previous { references(&root["$defs"][name], &mut names); }
        if previous == names { break; }
    }
    if !names.is_empty() {
        schema["$defs"] = names.into_iter().map(|name| {
            let value = root["$defs"][&name].clone();
            assert!(!value.is_null(), "missing definition {name}");
            (name, value)
        }).collect::<serde_json::Map<_, _>>().into();
    }
    schema
}

#[test]
fn schema_queries_serve_derived_operations_and_locate_unknown_names() {
    let temp = tempfile::tempdir().unwrap();
    let mut client = isolated_client(temp.path());
    client.handshake();
    for (tool, operation, derived) in [
        ("apply", "execution-run", serde_json::to_value(schemars::schema_for!(ApplySchemaGroups)).unwrap()),
        ("query", "verify-next", serde_json::to_value(schemars::schema_for!(VerificationSchema)).unwrap()),
    ] {
        let answer = envelope(&client.tools_call(3, "cadence_query",
            json!({"operation":"schema","tool":tool,"for":operation})));
        assert_eq!(answer, json!({"status":"ok","tool":tool,"operation":operation,
            "schema":operation_with_definitions(&derived, operation)}));
    }
    for (tool, operation, slot, code) in [
        ("apply", "no-such-operation", "for", "unknown-operation"),
        ("query", "no-such-operation", "for", "unknown-operation"),
        ("other", "execution-run", "tool", "unknown-tool"),
    ] {
        let answer = envelope(&client.tools_call(4, "cadence_query",
            json!({"operation":"schema","tool":tool,"for":operation})));
        assert_eq!(answer["status"], "refused", "{answer}");
        assert_eq!(answer["slot"], slot, "{answer}");
        assert_eq!(answer["code"], code, "{answer}");
        assert!(answer["reason"].is_string(), "{answer}");
    }
    assert!(client.finish().success());
}

#[test]
fn every_declared_operation_has_a_bounded_self_contained_schema() {
    fn check_refs(root: &Value, node: &Value) {
        match node {
            Value::Object(fields) => {
                if let Some(reference) = fields.get("$ref").and_then(Value::as_str) {
                    assert!(root.pointer(reference.strip_prefix('#').unwrap()).is_some(), "{reference}");
                }
                for value in fields.values() { check_refs(root, value); }
            }
            Value::Array(values) => for value in values { check_refs(root, value); },
            _ => {}
        }
    }
    let temp = tempfile::tempdir().unwrap();
    let mut client = isolated_client(temp.path());
    client.handshake();
    for (tool, names) in [("apply", apply_operation_names()), ("query", query_operation_names())] {
        for name in names {
            let mut request = json!({"operation":"schema","tool":tool,"for":name});
            let mut answer = envelope(&client.tools_call(3, "cadence_query", request.clone()));
            assert_eq!(answer["status"], "ok", "{answer}");
            let schema = if answer.get("schema").is_some() {
                assert!(serde_json::to_vec(&answer["schema"]).unwrap().len() <= 24_576);
                answer["schema"].clone()
            } else {
                let mut serialized = String::new();
                let mut part = 1;
                loop {
                    assert_eq!(answer["status"], "ok", "{answer}");
                    assert_eq!(answer["tool"], tool);
                    assert_eq!(answer["operation"], name);
                    assert_eq!(answer["part"], part);
                    assert_eq!(answer["bound"], 24_576);
                    let body = answer["body"].as_str().unwrap();
                    assert!(!body.is_empty() && body.len() <= 24_576);
                    serialized.push_str(body);
                    if answer["next"].is_null() { break; }
                    part += 1;
                    assert_eq!(answer["next"], part);
                    request["part"] = json!(part);
                    answer = envelope(&client.tools_call(3, "cadence_query", request.clone()));
                }
                assert!(serialized.len() > 24_576);
                serde_json::from_str(&serialized).unwrap()
            };
            assert_eq!(schema["properties"]["operation"]["const"], name);
            check_refs(&schema, &schema);
        }
    }
    assert!(client.finish().success());
}

#[test]
fn tool_schemas_all_inputs_have_object_roots() {
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
        let schema = tool
            .get("inputSchema")
            .unwrap_or_else(|| panic!("{} is missing inputSchema", tool["name"]));
        assert_eq!(
            schema.get("type"),
            Some(&json!("object")),
            "{}.inputSchema must have root type object; schema: {schema}",
            tool["name"]
        );
    }
}

#[test]
fn tool_schemas_all_inputs_have_properties_without_root_unions() {
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
        let schema = tool
            .get("inputSchema")
            .unwrap_or_else(|| panic!("{} is missing inputSchema", tool["name"]));
        for keyword in ["oneOf", "anyOf", "allOf"] {
            assert!(
                schema.get(keyword).is_none(),
                "{}.inputSchema must not use top-level {keyword}; schema: {schema}",
                tool["name"]
            );
        }
        assert!(
            schema.get("properties").is_some_and(Value::is_object),
            "{}.inputSchema must carry properties; schema: {schema}",
            tool["name"]
        );
    }
}

/// Claude's API refuses a tool whose schema nests more than 64 levels of
/// objects and arrays. Every advertised input schema stays well
/// under that so adding a variant never takes the whole host session down.
#[test]
fn tool_schemas_stay_within_host_nesting_limits() {
    const HOST_LIMIT: usize = 64;
    const HEADROOM: usize = 32;
    fn depth(node: &Value) -> usize {
        match node {
            Value::Object(fields) => 1 + fields.values().map(depth).max().unwrap_or(0),
            Value::Array(items) => 1 + items.iter().map(depth).max().unwrap_or(0),
            _ => 0,
        }
    }
    let mut client = Client::spawn();
    client.handshake();
    let response = client.tools_list(2);
    assert!(client.finish().success());
    let tools = response["result"]["tools"]
        .as_array()
        .unwrap_or_else(|| panic!("result.tools is an array; response: {response}"));
    for tool in tools {
        let schema = tool
            .get("inputSchema")
            .unwrap_or_else(|| panic!("{} is missing inputSchema", tool["name"]));
        let nesting = depth(schema);
        assert!(
            nesting <= HOST_LIMIT - HEADROOM,
            "{}.inputSchema nests {nesting} levels; the host limit is {HOST_LIMIT}",
            tool["name"]
        );
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
    if let Some(variants) = node.get("anyOf") {
        return variants
            .as_array()
            .unwrap()
            .iter()
            .any(|variant| schema_accepts(root, variant, value));
    }
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
    if let Some(types) = node.get("type").and_then(Value::as_array) {
        return types.iter().any(|kind| {
            let mut alternative = node.clone();
            alternative["type"] = kind.clone();
            schema_accepts(root, &alternative, value)
        });
    }
    match node.get("type").and_then(|value| value.as_str()) {
        Some("null") => value.is_null(),
        Some("boolean") => value.is_boolean(),
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

/// Every JSON pointer to an object inside `value`, the root first.
fn object_paths(value: &Value, path: &str, out: &mut Vec<String>) {
    match value {
        Value::Object(map) => {
            out.push(path.to_owned());
            for (key, child) in map {
                object_paths(child, &format!("{path}/{key}"), out);
            }
        }
        Value::Array(items) => {
            for (index, child) in items.iter().enumerate() {
                object_paths(child, &format!("{path}/{index}"), out);
            }
        }
        _ => {}
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
        assert_eq!(schema_accepts(schema, schema, &sample), index != 2,
            "{name}: legacy executor patches bypass the declared operation requirement");
        let mut paths = vec![];
        object_paths(&sample, "", &mut paths);
        if index == 2 {
            assert_eq!(paths.len(), 13, "the executor patch fixture has 13 objects");
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
    _temp: tempfile::TempDir,
    root: std::path::PathBuf,
    signing_key: String,
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
        .env("GNUPGHOME", signing::home(root))
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
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("repo");
        let signing_key = signing::generate(&root);
        let fixture = Self {
            _temp: temp,
            root,
            signing_key,
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
        fs::write(root.join(".planning/config.json"), serde_json::to_vec(&serde_json::json!({"review":{"triggers":{"risk_surface":{"surfaces":cadence::rail::risk::CATEGORIES}}}})).unwrap()).unwrap();
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
            ("gpg.program", "gpg"),
            ("user.signingkey", fixture.signing_key.as_str()),
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
                ".planning/config.json",
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
        &self.root
    }

    fn client(&self) -> Client {
        let mut client = Client::spawn_in_with_keyring(
            &["serve", "--project-root", self.root().to_str().unwrap()],
            Path::new(env!("CARGO_MANIFEST_DIR")),
            Some(&signing::home(self.root())),
        );
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
                answer["dispatch_id"].as_str()
            );

        }
        {
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

    fn settle(&self, client: &mut Client, dispatch: &Value) {
        let scan = envelope(&client.tools_call(70, "cadence_apply", json!({"operation":"risk-check","request_id":format!("clear-{}",dispatch["id"].as_str().unwrap()),
            "scope":{"phase":6,"occurrence":"phase-6-execution","worker":dispatch["plan"].to_string()},
            "source":{"kind":"execution","plan":dispatch["plan"],"dispatch_id":dispatch["id"]},"surfaces":null})));
        assert_eq!(scan["status"], "ok", "{scan}");
        assert_eq!(scan["observation"]["scan"]["checked"], true);
        assert_eq!(scan["observation"]["scan"]["matches"], json!([]));
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

    fn dispatch(&self, answer: &Value) -> Value {
        let active = self.read().snapshot.data["execution"]["occurrences"]["6"]["active"].clone();
        assert_eq!(answer["dispatch_id"], active["id"]);
        active
    }
}

#[test]
fn execution_calls_refuse_noninteger_phases_and_legacy_plans_without_dispatch() {
    let repo = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    for (args, skill) in [
        (vec!["executor-instructions"], "skills/cad-executor-contract/SKILL.md"),
        (vec!["executor-instructions", "--frontdoor"], "skills/cad-execute/SKILL.md"),
    ] {
        let output = Command::new(env!("CARGO_BIN_EXE_cadence")).args(args)
            .stdin(Stdio::null()).output().unwrap();
        assert!(output.status.success());
        let rendered = String::from_utf8(output.stdout).unwrap();
        assert_eq!(rendered, fs::read_to_string(repo.join(skill)).unwrap());
        if skill == "skills/cad-execute/SKILL.md" {
            assert!(rendered.contains("execution-round-record"));
            assert!(rendered.contains("host's reported"));
            assert!(rendered.contains("owner's actual approval"));
            assert!(rendered.contains("After the plan's last task closes, the orchestrator collects the owner's exact inspections for every delivered check before requesting `execution-plan-complete`"));
            assert!(rendered.contains("ensure the orchestrator has collected the inspections for the plan's delivered checks as described in step 6"));
        }
        if skill == "skills/cad-executor-contract/SKILL.md" {
            assert!(rendered.contains("The binary renders SUMMARY.md from the retained record"));
            assert!(rendered.contains("The executor writes no summary."));
            assert!(rendered.contains(
                "Binary-rendered project files in the\ndispatch lease are implicit material"
            ), "{skill} must explain the D-166 implicit rendered-file lease");
            for required in ["Task close proceeds\nwithout this inspection",
                "The plan cannot complete until every delivered check",
                "after the last task closes and before requesting `execution-plan-complete`",
                "inspections recorded after green and before close remain valid"] {
                assert!(rendered.contains(required), "{skill}: missing {required}");
            }
        }
        for required in ["positive JSON integers", "\"phase\":13", "\"phase\":\"13\"",
            "plan-read", "evidence-read", "approval.submission.request_id", "map_revision",
            "item_revision", "checks:[]", "execution-extend", "expected_set_version",
            "complete", "checkpoint_history", "same checkpoint", "omitted or null",
            "feat: deliver task-A", "repository configuration", "server's environment",
            "{check:{id,item_revision},test_digest,evidence:[red_run,green_run],no_subject_stub}",
            "approval:{approved,owner,at,submission:Inspection}", "supersedes",
            "JSON-RPC transport error"] {
            assert!(rendered.contains(required), "{skill}: missing {required}");
        }
        let example = rendered.split("Minimal complete admission example").nth(1).unwrap()
            .split("```json\n").nth(1).unwrap().split("\n```").next().unwrap();
        let admission: Value = serde_json::from_str(example).unwrap();
        assert_eq!(admission, json!({"operation":"execution-admit","request":{
            "request_id":"admit-13","expected_set_version":0,"contract":{"phase":13,
            "occurrence":"<saved occurrence>","plans":[{"plan":1,
            "publication_request":"<saved publication request>","content_revision":"<saved content revision>",
            "map_revision":"<saved map revision>"}],"allocation":[{"plan":1,"task":"task-A",
            "checks":[{"id":"check/A","item_revision":"<saved item revision>"}]},
            {"plan":1,"task":"task-B","checks":[]}]}}}));
    }
    let fixture = phase13::fixture();
    let project = fixture.path();
    phase13::native_context(project, &[("T1","a request arrives","the caller","a bounded answer")]);
    let before = phase13::reopened(project).snapshot.data;
    let mut client = phase13::Client::open(project);
    let mut replies = Vec::new();
    for (phase, detail) in [("0","0"),("-1","-1"),("13.0","13.0"),("13.5","13.5"),
        ("13e0","13e+0"),("\"13\"","\"13\""),("null","null")] {
        let input: Value = serde_json::from_str(&format!(
            r#"{{"operation":"execute-next","phase":{phase}}}"#)).unwrap();
        let answer = client.call("cadence_query", input.clone());
        assert_eq!(answer["status"], "refused", "{answer}");
        assert!(answer.get("dispatch").is_none());
        assert_eq!(answer["reason"], format!("phase={detail}; phase must be a positive JSON integer"));
        replies.push((input, answer));
    }
    // A prose-only historical plan never acquires native execution authority.
    let plan = project.join(".planning/phases/13/PLAN-1.md");
    let legacy_bytes = b"---\nphase: 13\nplan: 1\nrequirements: [T1]\nfiles: [src/shared.txt]\n---\nComplete T1 and run the suite.\n";
    fs::write(&plan, legacy_bytes).unwrap();
    let request = json!({"operation":"execute-next","phase":13});
    let legacy = client.call("cadence_query", request.clone());
    assert_eq!(legacy["status"], "refused", "{legacy}");
    assert!(legacy.get("dispatch").is_none());
    client.finish();
    let reopened = phase13::reopened(project);
    assert_eq!(reopened.snapshot.data["execution"], before["execution"]);
    assert_eq!(reopened.snapshot.data["contexts"], before["contexts"]);
    let mut client = phase13::Client::open(project);
    for (input, answer) in &replies {
        assert_eq!(client.call("cadence_query", input.clone()), *answer);
    }
    assert_eq!(client.call("cadence_query", request.clone()), legacy);
    client.finish();
    let roadmap = project.join(".planning/ROADMAP.md");
    let conflict_bytes = b"## Phases\n- [x] **Phase 13: Plan publication**\n- [ ] **Phase 28: Next phase**\n";
    fs::write(&roadmap, conflict_bytes).unwrap();
    let mut client = phase13::Client::open(project);
    let conflict = client.call("cadence_query", request.clone());
    assert_eq!(conflict["code"], "state-conflict", "{conflict}");
    assert_eq!(serde_json::from_str::<Value>(conflict["reason"].as_str().unwrap()).unwrap(),
        json!({"source":"ROADMAP.md:2 entry 0","field":"complete","declared":"true","derived":"false"}));
    assert!(conflict.get("dispatch").is_none());
    client.finish();
    let durable = phase13::tree(project);
    assert_eq!(phase13::reopened(project).snapshot.data["execution"], before["execution"]);
    let mut client = phase13::Client::open(project);
    assert_eq!(client.call("cadence_query", request), conflict);
    client.finish();
    phase13::reopened(project);
    assert_eq!(phase13::tree(project), durable);
    assert_eq!(fs::read(plan).unwrap(), legacy_bytes);
    assert_eq!(fs::read(roadmap).unwrap(), conflict_bytes);
}

#[test]
fn execution_calls_confirm_dispatch_completion_and_refused_patch_semantics() {
    let fixture = Fixture::new(&[&["T1"]]);
    let mut client = fixture.client();
    let first = fixture.query(&mut client);
    assert_eq!(first["outcome"], "dispatch");
    let first_record = fixture.dispatch(&first);
    let patch = fixture.complete_patch(&first_record);
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
            first_record["base_sha"].as_str().unwrap(),
        ],
    );
    fixture.refuse(&mut client, patch.clone(), "git-order");
    git(fixture.root(), &["checkout", "-q", "--detach", sha]);
    let pending = fixture.call(&mut client, "cadence_apply", patch.clone());
    assert_eq!(pending["code"], "risk-pending");
    fixture.settle(&mut client, &first_record);
    assert_eq!(fixture.call(&mut client, "cadence_apply", patch), pending);
    assert_eq!(
        fixture.query(&mut client),
        json!({"status":"ok","outcome":"complete","phase":6})
    );
    assert!(client.finish().success());
}

#[test]
fn execution_calls_confirm_blocked_judgment_stop() {
    let fixture = Fixture::new(&[&["T1", "T2"]]);
    let mut client = fixture.client();
    let answer = fixture.query(&mut client);
    let dispatch = fixture.dispatch(&answer);
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
            json!({"dispatch_id":dispatch["dispatch_id"],"invalid":index}),
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
            json!({"dispatch_id":dispatch["dispatch_id"]})
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
    let mut client = Client::spawn();
    let initialized = client.handshake();
    assert_eq!(initialized["result"]["instructions"], cadence::read::instructions::CONTRACT);
    let listed = client.tools_list(2);
    let query = listed["result"]["tools"].as_array().unwrap().iter()
        .find(|tool| tool["name"] == "cadence_query").unwrap();
    // The contract is delivered once, as server instructions. The tool
    // description carries only the operation rules, never a second copy.
    let description = query["description"].as_str().unwrap();
    assert!(!description.contains(cadence::read::instructions::CONTRACT),
        "cadence_query description repeats CONTRACT already sent as server instructions");
    assert!(description.starts_with("Read supported configuration"), "description: {description}");
    assert!(client.finish().success());

    // These skills are generated artifacts: their bytes are the binary's own
    // rendering, never a second authority. What they say is C7's subject.
    assert_eq!(cadence::execution::render::RENDERED_PROJECT_FILES.len(), 17);
    let (why, body) = markdown_parts("skills/cad-why/SKILL.md");
    assert_eq!(why["name"], "cad-why");
    assert_eq!(why["argument-hint"], "<path>[:<line>]");
    assert_eq!(why["allowed-tools"], json!(["mcp__cadence__cadence_query"]));
    assert!(body.contains("once") && body.contains(r#"{"operation":"why","path":"<path>"}"#));
    assert!(body.contains("`\"line\":<n>` as a JSON integer"));
    assert!(body.contains("Print the returned `text` verbatim and nothing else"));
    assert!(body.contains("no reformatting"));
    // The 3.x door ran why.mjs through Bash; this one is query-only.
    for forbidden in ["Bash", "why.mjs", "node ", "CLAUDE_PLUGIN_ROOT", "SlashCommand", "--dir", "--top"] {
        assert!(!cadence::why::instructions::markdown().contains(forbidden), "{forbidden}");
    }
    let (suggest, body) = markdown_parts("skills/cad-suggest/SKILL.md");
    assert_eq!(suggest["name"], "cad-suggest");
    assert_eq!(suggest["argument-hint"], "[phase]");
    assert_eq!(suggest["allowed-tools"], json!(["mcp__cadence__cadence_query", "mcp__cadence__cadence_apply"]));
    assert!(body.contains("once") && body.contains(r#"{"operation":"suggest"}"#));
    assert!(body.contains("key, current value, proposed value and counted decisions\nunchanged"));
    assert!(body.contains("accepted `apply` payload unchanged"));
    assert!(body.contains("decline and nothing before asking"));
    for forbidden in ["SlashCommand", "planning.mjs", "Bash", "CLAUDE_PLUGIN_ROOT"] {
        assert!(!cadence::suggest::instructions::markdown().contains(forbidden));
    }
    let (progress, body) = markdown_parts("skills/cad-progress/SKILL.md");
    assert_eq!(progress["name"], "cad-progress");
    assert_eq!(progress["allowed-tools"], json!(["mcp__cadence__cadence_query"]));
    assert!(body.contains("once") && body.contains(r#"{"operation":"progress"}"#));
    assert!(body.contains("Print the returned `text` unchanged"));
    for forbidden in ["Write", "Bash", "SlashCommand", "CLAUDE_PLUGIN_ROOT", "--stats", "--trace"] {
        assert!(!cadence::progress::instructions::markdown().contains(forbidden));
    }
    let (capture, body) = markdown_parts("skills/cad-capture/SKILL.md");
    assert_eq!(capture["name"], "cad-capture");
    assert_eq!(capture["allowed-tools"], json!(["mcp__cadence__cadence_apply", "mcp__cadence__cadence_query"]));
    assert!(body.contains("once") && body.contains(r#""operation":"capture""#));
    assert!(body.contains("only for a todo") && body.contains("`captures`"));
    // The 3.x door ran a script, wrote CAPTURE.md and committed it; this one
    // refuses all three, and parks --cadence rather than implying it works.
    for forbidden in ["Write", "Bash", "SlashCommand", "CLAUDE_PLUGIN_ROOT", "planning.mjs", "--cadence "] {
        assert!(!cadence::capture::instructions::markdown().contains(forbidden), "{forbidden}");
    }
    assert!(body.contains("do not open or change
`.planning/CAPTURE.md`, and do not make a commit"));
    assert!(body.contains("parked for a later phase"));
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    for retired in ["cad-health", "cad-report"] {
        assert!(!root.join(format!("skills/{retired}/SKILL.md")).exists());
    }
    for command in ["cad-review", "cad-decision-review", "cad-minimalism-review", "cad-plan-review"] {
        let text = cadence::review::instructions::frontdoor_markdown(command).unwrap();
        assert!(text.contains("kind: review-entry") && text.contains("lines:<n>") && text.contains("text:<n>"));
        assert!(text.contains("Never send\n   raw JSON text") && text.contains("findings digest and count"));
        assert!(text.contains("execution-worker-exit") && text.contains("`review: <attempt.attempt>`"));
        assert!(text.contains("A provider delivery is binary-owned and is not reported"));
    }
    for target in cadence::execution::render::RENDERED_PROJECT_FILES {
        let relative = target.path;
        let rendered = Command::new(env!("CARGO_BIN_EXE_cadence"))
            .args(target.command)
            .current_dir(std::env::temp_dir())
            .stdin(Stdio::null())
            .output()
            .unwrap();
        assert!(rendered.status.success(), "{}", String::from_utf8_lossy(&rendered.stderr));
        let installed = fs::read(Path::new(env!("CARGO_MANIFEST_DIR")).join("../..").join(relative)).unwrap();
        assert_eq!(installed, rendered.stdout,
            "{relative} is binary-rendered implicit lease material and cannot drift from its renderer");
    }
    let (verify, frontdoor) = markdown_parts("skills/cad-verify/SKILL.md");
    let (verifier_contract, verifier) = markdown_parts("skills/cad-verifier-contract/SKILL.md");
    let (read_contract, read_body) = markdown_parts("skills/cad-read-contract/SKILL.md");
    assert_eq!(read_contract["allowed-tools"], json!(["mcp__cadence__cadence_query"]));
    assert_eq!(read_contract["user-invocable"], false);
    assert!(read_body.contains(cadence::read::instructions::CONTRACT));
    assert_eq!(verify["allowed-tools"], json!(["mcp__cadence__cadence_query", "mcp__cadence__cadence_apply", "Task"]));
    assert_eq!(verifier_contract["user-invocable"], false);
    assert!(frontdoor.contains("verify-next") && frontdoor.contains("`identities`"));
    assert!(frontdoor.contains("route.choice") && !frontdoor.contains("attempt.prompt"));
    assert!(verifier.contains("verification-run") && verifier.contains("verification-submit"));
    assert!(frontdoor.contains("execution-worker-exit") && frontdoor.contains("`attempt: <attempt.id>`"));
    assert!(verifier.contains("execution-worker-exit report may already exist"));
    for (name, effort) in [("cad-verifier", "high"), ("cad-verifier-low", "low"),
        ("cad-verifier-medium", "medium"), ("cad-verifier-xhigh", "xhigh"), ("cad-verifier-max", "max")] {
        let (agent, body) = markdown_parts(&format!("agents/{name}.md"));
        assert_eq!(agent["name"], name);
        assert_eq!(agent["effort"], effort);
        assert_eq!(agent["skills"], json!(["cad-read-contract", "cad-verifier-contract"]));
        assert_eq!(agent["mcpServers"], json!(["cadence"]));
        assert_eq!(agent["tools"].as_str().unwrap().split(", ").collect::<Vec<_>>(),
            ["Bash", "mcp__cadence__cadence_query", "mcp__cadence__cadence_apply"]);
        assert_eq!(agent["disallowedTools"], "Write, Edit, MultiEdit");
        assert!(body.contains("`cad-verifier-contract`"));
        assert!(!body.contains("verification-") && !body.contains("suite"));
    }
    let (skill, main) = markdown_parts("skills/cad-execute/SKILL.md");
    let (contract, executor) = markdown_parts("skills/cad-executor-contract/SKILL.md");
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
    assert!(main.contains("execution-worker-exit") && main.contains("`dispatch: <dispatch_id>`"));
    assert!(executor.contains("execution-worker-exit report may already exist"));
    // The five agent manifests are metadata adapters: they name the compiled
    // contract by reference, carry the routing rung and grant exactly the
    // Cadence tools the native task protocol needs. They state no policy.
    let mut bodies = vec![];
    for (path, name, effort) in [
        ("agents/cad-executor.md", "cad-executor", "high"),
        ("agents/cad-executor-low.md", "cad-executor-low", "low"),
        (
            "agents/cad-executor-medium.md",
            "cad-executor-medium",
            "medium",
        ),
        (
            "agents/cad-executor-xhigh.md",
            "cad-executor-xhigh",
            "xhigh",
        ),
        ("agents/cad-executor-max.md", "cad-executor-max", "max"),
    ] {
        let (agent, body) = markdown_parts(path);
        assert_eq!(agent["name"], name);
        assert_eq!(agent["effort"], effort);
        assert_eq!(agent["skills"], json!(["cad-read-contract", "cad-executor-contract"]));
        assert_eq!(agent["mcpServers"], json!(["cadence"]));
        assert_eq!(
            agent["tools"]
                .as_str()
                .unwrap()
                .split(", ")
                .collect::<Vec<_>>(),
            [
                "Write",
                "Edit",
                "Bash",
                "LSP",
                "mcp__cadence__cadence_query",
                "mcp__cadence__cadence_apply"
            ],
            "{path}"
        );
        assert!(body.contains("`cad-executor-contract`"), "{path} names its contract by reference");
        assert!(!body.contains("execution-") && !body.contains("suite"), "{path} copies no policy");
        bodies.push(body);
    }
    for (prefix, variants, tools, contract_name, disallowed) in [
        ("cad-assumptions-analyzer", [("", "xhigh"), ("-low", "low"), ("-medium", "medium"), ("-high", "high"), ("-max", "max")],
            vec!["Bash", "mcp__cadence__cadence_query"], "cad-assumptions-analyzer-contract", true),
        ("cad-plan-checker", [("", "low"), ("-medium", "medium"), ("-high", "high"), ("-xhigh", "xhigh"), ("-max", "max")],
            vec!["Bash", "mcp__cadence__cadence_query"], "cad-plan-checker-contract", true),
        ("cad-planner", [("", "high"), ("-low", "low"), ("-medium", "medium"), ("-xhigh", "xhigh"), ("-max", "max")],
            vec!["Write", "Edit", "Bash", "mcp__cadence__cadence_query"], "cad-planner-contract", false),
        ("cad-reviewer", [("", "high"), ("-low", "low"), ("-medium", "medium"), ("-xhigh", "xhigh"), ("-max", "max")],
            vec!["Bash", "mcp__cadence__cadence_query"], "cad-reviewer-contract", true),
    ] {
        for (suffix, effort) in variants {
            let path = format!("agents/{prefix}{suffix}.md");
            let (agent, body) = markdown_parts(&path);
            assert_eq!(agent["effort"], effort, "{path}");
            assert_eq!(agent["mcpServers"], json!(["cadence"]), "{path}");
            assert_eq!(agent["skills"], json!(["cad-read-contract", contract_name]), "{path}");
            assert_eq!(agent["tools"].as_str().unwrap().split(", ").collect::<Vec<_>>(), tools, "{path}");
            if disallowed { assert_eq!(agent["disallowedTools"], "Write, Edit, MultiEdit", "{path}"); }
            assert!(body.contains(&format!("`{contract_name}`")), "{path}");
            bodies.push(body);
        }
    }
    for text in [&main, &executor, &skill.to_string(), &contract.to_string()]
        .into_iter()
        .chain(bodies.iter())
    {
        for forbidden in [
            ".mjs",
            "node ",
            "reports/",
            "STATE.md",
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
    let first_record = fixture.dispatch(&first);
    assert_eq!(first_record["plan"], 1);
    let files = first_record["files"].as_array().unwrap();
    assert_eq!(&files[..1], &json!(["src/shared.txt"]).as_array().unwrap()[..]);
    assert_eq!(&files[1..], &cadence::execution::render::RENDERED_PROJECT_FILES.iter()
        .map(|rendered| json!(rendered.path)).collect::<Vec<_>>()[..]);
    assert_eq!(
        first_record["policy"],
        json!({"rung":"high","branch":"current","reviews":"disabled"})
    );
    let original_bytes = serde_json::to_vec(&first).unwrap();
    // Independently authored request: no ExecutorPatch or expected response type.
    let missing_task = json!({"schema":1,"kind":"executor","dispatch_id":first_record["id"],
        "expected_execution_version":first_record["expected_execution_version"],"outcome":"blocked",
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
    let first_patch = fixture.complete_patch(&first_record);
    let next = fixture.call(&mut second_child, "cadence_apply", first_patch.clone());
    assert_eq!(next["code"], "risk-pending");
    assert_eq!(fixture.query(&mut second_child)["code"], "risk-pending");
    fixture.settle(&mut second_child, &first_record);
    let first_summary = fs::read(fixture.root().join(".planning/phases/6/SUMMARY.md")).unwrap();
    assert!(String::from_utf8_lossy(&first_summary).contains("Status: executing"));
    assert!(second_child.finish().success());

    let mut third_child = fixture.client();
    let third_pid = third_child.child.id();
    assert_ne!(third_pid, first_pid);
    assert_ne!(third_pid, second_pid);
    let second = fixture.query(&mut third_child);
    assert_eq!(second["outcome"], "dispatch");
    let second_record = fixture.dispatch(&second);
    assert_eq!(second_record["plan"], 2);
    assert_eq!(second_record["files"], first_record["files"]);
    assert_eq!(
        second_record["base_sha"],
        first_patch["tasks"][1]["commit"]
    );
    assert_ne!(second_record["id"], first_record["id"]);
    assert!(
        second_record["expected_execution_version"]
            .as_u64()
            .unwrap()
            > first_record["expected_execution_version"]
                .as_u64()
                .unwrap()
    );
    fixture.refuse(
        &mut third_child,
        json!({"dispatch_id":second_record["id"],"state":{}}),
        "invalid-patch",
    );
    assert_eq!(
        fs::read(fixture.root().join(".planning/phases/6/SUMMARY.md")).unwrap(),
        first_summary
    );
    assert_eq!(fixture.query(&mut third_child), second);
    let second_patch = fixture.complete_patch(&second_record);
    let pending = fixture.call(&mut third_child, "cadence_apply", second_patch.clone());
    assert_eq!(pending["code"], "risk-pending");
    fixture.settle(&mut third_child, &second_record);
    let complete = fixture.query(&mut third_child);
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
    let base = first_record["base_sha"].as_str().unwrap();
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
        let signature = git(fixture.root(), &["show", "-s", "--format=%G? %GK", sha]);
        let (status, key_id) = signature.split_once(' ').unwrap();
        assert_eq!(status, "G");
        assert_eq!(key_id, fixture.signing_key);
        assert_eq!(
            key_id,
            git(fixture.root(), &["config", "--local", "user.signingkey"])
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
    let mut explicit = Client::spawn_in_with_keyring(
        &["serve", "--project-root", alias.to_str().unwrap()],
        Path::new(env!("CARGO_MANIFEST_DIR")),
        Some(&signing::home(fixture.root())),
    );
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
    let mut discovered = Client::spawn_in_with_keyring(
        &["serve"],
        fixture.root(),
        Some(&signing::home(fixture.root())),
    );
    discovered.handshake();
    assert_ne!(discovered.child.id(), pid);
    assert_eq!(fixture.query(&mut discovered), first);
    assert!(discovered.finish().success());
}

// Phase 5's executable inventory retains this registration name. The version
// entry remains unique; tool_schemas owns the complete three-tool inventory.
#[test]
fn tools_list_declares_exactly_cadence_version_without_an_output_schema() {
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
    assert!(versions[0].get("outputSchema").is_none());
    let answer = client.tools_call(3, "cadence_version", json!({}));
    assert_eq!(answer["result"]["structuredContent"]["status"], "ok");
    assert!(client.finish().success());
}

#[test]
fn risk_receipts_cross_stdio_restart_and_bind_current_staged_and_committed_material() {
    let fixture = Fixture::new(&[&["T1"]]);
    let root = fixture.root();
    let base = git(root, &["rev-parse", "HEAD"]);
    fs::write(root.join("src/shared.txt"), "jwt.verify(token)\n").unwrap();
    git(root, &["add", "src/shared.txt"]);
    let mut client = fixture.client();
    let scope = json!({"phase":6,"occurrence":"receipt-fixture","worker":null});
    let source = json!({"kind":"staged","base":base});
    let scan = envelope(&client.tools_call(20,"cadence_apply",json!({"operation":"risk-check","request_id":"staged-one","scope":scope,"source":source,"surfaces":["auth"]})));
    assert_eq!(scan["status"], "ok");
    assert!(scan["observation"]["resolution"]["head_id"].is_null());
    let query =
        json!({"operation":"risk-status","scope":scope,"source":source,"surfaces":["auth"]});
    let report = envelope(&client.tools_call(21, "cadence_query", query.clone()));
    assert_eq!(report["assessment"]["state"], "unfired");
    assert_eq!(report["assessment"]["permits_continuation"], false);
    let fire = json!({"id":"staged-fire","binding":{
        "boundary":report["requirement"]["boundary"],"material":report["requirement"]["material"],
        "surfaces":["auth"],"observation":scan["confirmation"]},
        "review_scope":["src/shared.txt"],"rearm_of":null});
    let fire_request = json!({"operation":"risk-fire","request_id":"fire-request","fire":fire});
    let fired = envelope(&client.tools_call(22, "cadence_apply", fire_request.clone()));
    assert_eq!(fired["status"], "ok", "{fired}");
    let pending = envelope(&client.tools_call(23, "cadence_query", query.clone()));
    assert_eq!(pending["assessment"]["state"], "pending");
    let receipt = json!({"id":"staged-receipt","fire":fire,"consequence":{"kind":"gate-pass","evidence_id":"contracted-fixture-review"}});
    let request = json!({"operation":"risk-consequence","request_id":"consequence-request","receipt":receipt});
    let settled = envelope(&client.tools_call(24, "cadence_apply", request.clone()));
    assert_eq!(settled["status"], "ok", "{settled}");
    let before = fixture.read();
    assert_eq!(
        envelope(&client.tools_call(25, "cadence_apply", request.clone())),
        settled
    );
    assert_eq!(
        envelope(&client.tools_call(26, "cadence_apply", fire_request)),
        fired
    );
    assert_eq!(fixture.read(), before);
    let mut changed = request.clone();
    changed["receipt"]["consequence"]["evidence_id"] = json!("different");
    assert_eq!(
        envelope(&client.tools_call(27, "cadence_apply", changed))["code"],
        "request-reused"
    );
    assert_eq!(fixture.read(), before);
    assert!(client.finish().success());
    let mut replacement = fixture.client();
    let report = envelope(&replacement.tools_call(28, "cadence_query", query.clone()));
    assert_eq!(report["assessment"]["state"], "settled");
    assert_eq!(report["assessment"]["permits_continuation"], true);
    fs::write(root.join("src/shared.txt"), "jwt.verify(other_token)\n").unwrap();
    git(root, &["add", "src/shared.txt"]);
    let report = envelope(&replacement.tools_call(29, "cadence_query", query.clone()));
    assert_eq!(report["assessment"]["state"], "stale");
    let mut stale = request.clone();
    stale["request_id"] = json!("different-staged-bytes");
    assert_eq!(
        envelope(&replacement.tools_call(30, "cadence_apply", stale))["code"],
        "stale-receipt"
    );
    git(
        root,
        &[
            "commit",
            "-q",
            "-S",
            "-m",
            "feat(7): receipt fixture material",
        ],
    );
    let head = git(root, &["rev-parse", "HEAD"]);
    let committed = json!({"kind":"committed","base":base,"head":head});
    let scan = envelope(&replacement.tools_call(31,"cadence_apply",json!({"operation":"risk-check","request_id":"committed-one","scope":scope,"source":committed,"surfaces":["auth"]})));
    assert_eq!(scan["status"], "ok");
    let mut committed_query = query;
    committed_query["source"] = committed;
    let report = envelope(&replacement.tools_call(32, "cadence_query", committed_query.clone()));
    assert_eq!(report["assessment"]["state"], "unfired");
    let mut committed_fire = fire;
    committed_fire["id"] = json!("committed-fire");
    committed_fire["binding"]["material"] = report["requirement"]["material"].clone();
    committed_fire["binding"]["observation"] = scan["confirmation"].clone();
    assert_eq!(envelope(&replacement.tools_call(33,"cadence_apply",json!({"operation":"risk-fire","request_id":"committed-fire-request","fire":committed_fire})))["status"],"ok");
    assert_eq!(envelope(&replacement.tools_call(34,"cadence_apply",json!({"operation":"risk-consequence","request_id":"committed-receipt-request","receipt":{"id":"committed-receipt","fire":committed_fire,"consequence":{"kind":"override","reason":"Accept this fixture occurrence and material"}}})))["status"],"ok");
    assert_eq!(
        envelope(&replacement.tools_call(35, "cadence_query", committed_query.clone()))["assessment"]
            ["state"],
        "settled"
    );
    committed_query["source"]["base"] = json!(head);
    let report = envelope(&replacement.tools_call(36, "cadence_query", committed_query));
    assert_eq!(report["assessment"]["state"], "stale");
    assert_eq!(report["assessment"]["permits_continuation"], false);
    for (name, input) in [
        (
            "cadence_query",
            json!({"operation":"risk-status","scope":scope,"source":{"kind":"staged","base":base,"head":"HEAD"}}),
        ),
        (
            "cadence_apply",
            json!({"operation":"risk-fire","request_id":"malformed","fire":null}),
        ),
        (
            "cadence_apply",
            json!({"operation":"risk-consequence","request_id":"malformed","receipt":{"prose":"PASS"}}),
        ),
    ] {
        assert_eq!(
            envelope(&replacement.tools_call(37, name, input))["code"],
            "invalid-arguments"
        );
    }
    assert!(replacement.finish().success());
}

#[test]
fn detect_surfaces_public_read_uses_bound_root_and_changes_no_config_or_rail_state() {
    let temp = tempfile::tempdir().unwrap();
    fs::create_dir(temp.path().join(".planning")).unwrap();
    fs::write(
        temp.path().join(".planning/config.json"),
        b"torn configuration deliberately irrelevant",
    )
    .unwrap();
    fs::write(
        temp.path().join("package.json"),
        br#"{"dependencies":{"stripe":"1","@grpc/grpc-js":"1"}}"#,
    )
    .unwrap();
    fs::write(
        temp.path().join("source.rs"),
        b"passport DROP TABLE auth token",
    )
    .unwrap();
    let mut client = isolated_client(temp.path());
    client.handshake();
    let query = json!({"operation":"detect-surfaces","answered":["auth"]});
    let report = envelope(&client.tools_call(60, "cadence_query", query.clone()));
    assert_eq!(report["status"], "ok");
    assert_eq!(report["root"], temp.path().to_str().unwrap());
    assert_eq!(report["evidenced"][0]["category"], "billing");
    assert_eq!(report["evidenced"][1]["category"], "api_contract");
    assert_eq!(report["unspeakable"], json!(["destructive"]));
    assert_eq!(report["recommended"].as_array().unwrap().len(), 8);
    assert_eq!(report["options"].as_array().unwrap().len(), 4);
    fs::write(temp.path().join("source.rs"), b"entirely different").unwrap();
    assert_eq!(
        envelope(&client.tools_call(61, "cadence_query", query)),
        report
    );
    for answered in [json!([]), json!(["auth", "typo"])] {
        assert_eq!(
            envelope(&client.tools_call(
                62,
                "cadence_query",
                json!({"operation":"detect-surfaces","answered":answered})
            ))["code"],
            "invalid-surfaces"
        );
    }
    // No state can be created even when effective configuration is unreadable.
    assert_eq!(
        fs::read(temp.path().join(".planning/config.json")).unwrap(),
        b"torn configuration deliberately irrelevant"
    );
    for name in ["state.json", "decisions.jsonl", "items.jsonl"] {
        assert!(!temp.path().join(".planning").join(name).exists());
    }
    assert!(client.finish().success());
    // A caller-selected filesystem root is rejected by the strict operation.
    fs::write(temp.path().join(".planning/config.json"), b"{}").unwrap();
    let mut client = isolated_client(temp.path());
    client.handshake();
    assert_eq!(
        envelope(&client.tools_call(
            63,
            "cadence_query",
            json!({"operation":"detect-surfaces","root":"/"})
        ))["status"],
        "refused"
    );
    assert!(client.finish().success());
}

/// Every `$defs` entry a tool schema carries is reached by a `$ref` from its
/// root. A definition nothing points at is bytes every host receives and no
/// host can use.
#[test]
fn tool_schemas_carry_no_unreferenced_definitions() {
    fn refs(node: &Value, out: &mut Vec<String>) {
        match node {
            Value::Object(map) => {
                if let Some(reference) = map.get("$ref").and_then(Value::as_str) {
                    out.push(reference.rsplit('/').next().unwrap().to_owned());
                }
                map.values().for_each(|v| refs(v, out));
            }
            Value::Array(items) => items.iter().for_each(|v| refs(v, out)),
            _ => {}
        }
    }
    let mut client = Client::spawn();
    client.handshake();
    let listed = client.tools_list(2);
    for tool in listed["result"]["tools"].as_array().unwrap() {
        let schema = &tool["inputSchema"];
        let Some(defs) = schema.get("$defs").and_then(Value::as_object) else { continue };
        let mut reached = BTreeSet::new();
        let mut todo = Vec::new();
        for (key, value) in schema.as_object().unwrap() {
            if key != "$defs" { refs(value, &mut todo); }
        }
        while let Some(name) = todo.pop() {
            if reached.insert(name.clone()) && let Some(def) = defs.get(&name) {
                refs(def, &mut todo);
            }
        }
        let dead: Vec<_> = defs.keys().filter(|k| !reached.contains(*k)).collect();
        assert!(dead.is_empty(), "{} carries unreferenced $defs: {dead:?}", tool["name"]);
    }
    assert!(client.finish().success());
}

/// P31-A-CALLER-ADAPTERS, the skill half: no shipped skill or agent grants a
/// built-in project read, and no body carries the old read recipes. Cadence
/// is the only project read surface; a prohibition that names a tool is fine.
#[test]
fn skills_and_agents_grant_no_direct_project_reads() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let mut paths = Vec::new();
    for entry in fs::read_dir(root.join("skills")).unwrap() {
        let candidate = entry.unwrap().path().join("SKILL.md");
        if candidate.is_file() { paths.push(candidate); }
    }
    for entry in fs::read_dir(root.join("agents")).unwrap() {
        let candidate = entry.unwrap().path();
        if candidate.extension().is_some_and(|ext| ext == "md") { paths.push(candidate); }
    }
    assert!(paths.len() > 40, "{} surfaces found", paths.len());
    let mut offending = Vec::new();
    for path in &paths {
        let relative = path.strip_prefix(&root).unwrap().display().to_string();
        let (front, body) = markdown_parts(&relative);
        let granted: Vec<String> = match front.get("allowed-tools").or_else(|| front.get("tools")) {
            Some(Value::Array(items)) => items.iter().filter_map(Value::as_str).map(str::to_owned).collect(),
            Some(Value::String(line)) => line.split(", ").map(str::to_owned).collect(),
            _ => Vec::new(),
        };
        for tool in granted {
            if matches!(tool.as_str(), "Read" | "Grep" | "Glob") {
                offending.push(format!("{relative}: grants {tool}"));
            }
        }
        for recipe in [
            "mcp__excerpt__",
            "excerpt_search",
            "excerpt_read",
            "skim.mjs",
            "built-in Read",
            "built-ins are the path",
            "grep -n",
            "Glob and grep",
        ] {
            if body.contains(recipe) {
                offending.push(format!("{relative}: body carries `{recipe}`"));
            }
        }
    }
    assert!(offending.is_empty(), "direct project reads survive:\n{}", offending.join("\n"));
}
