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
fn tools_list_declares_exactly_cadence_version_with_an_output_schema() {
    let mut client = Client::spawn();
    client.handshake();
    let response = client.tools_list(2);
    let tools = response["result"]["tools"]
        .as_array()
        .unwrap_or_else(|| panic!("result.tools is an array; response: {response}"));
    assert_eq!(tools.len(), 1, "response: {response}");
    assert_eq!(tools[0]["name"], json!("cadence_version"));
    // An `outputSchema` is what tells a host the answer is structured. Its
    // absence would mean the envelope is riding a text convention after all,
    // which is the thing D-07 rejects.
    assert!(
        tools[0]["outputSchema"].is_object(),
        "cadence_version must declare an outputSchema; response: {response}"
    );
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
