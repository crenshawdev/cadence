use serde_json::{Value, json};
use std::{
    io::{BufRead, BufReader, Write},
    path::Path,
    process::{Command, Stdio},
};

fn request(project: &Path, tool: &str, arguments: Value) -> Value {
    let mut child = Command::new(env!("CARGO_BIN_EXE_cadence"))
        .args(["serve"])
        .current_dir(project)
        .env("CADENCE_GLOBAL_CONFIG", "")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .unwrap();
    let mut input = child.stdin.take().unwrap();
    let mut output = BufReader::new(child.stdout.take().unwrap());
    writeln!(input, "{}", json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{
        "protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"config-test","version":"1"}}})).unwrap();
    let mut line = String::new();
    output.read_line(&mut line).unwrap();
    writeln!(
        input,
        "{}",
        json!({"jsonrpc":"2.0","method":"notifications/initialized"})
    )
    .unwrap();
    writeln!(input, "{}", json!({"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":tool,"arguments":arguments}})).unwrap();
    input.flush().unwrap();
    line.clear();
    output.read_line(&mut line).unwrap();
    let response: Value = serde_json::from_str(&line).unwrap();
    drop(input);
    assert!(child.wait().unwrap().success());
    response["result"]["structuredContent"].clone()
}

#[test]
fn config_apply_transport_returns_changed_keys_requested_layer_and_destination() {
    let project = tempfile::tempdir().unwrap();
    let answer = request(
        project.path(),
        "cadence_apply",
        json!({"operation":"config-apply","layer":"repo","updates":[
        {"key":"roles.cad-executor.model","value":"sonnet"},
        {"key":"roles.cad-executor.effort","value":"xhigh"}]}),
    );
    assert_eq!(answer["status"], "ok", "{answer}");
    assert_eq!(answer["operation"], "config-apply");
    assert_eq!(
        answer["changed_keys"],
        json!(["roles.cad-executor.effort", "roles.cad-executor.model"])
    );
    assert_eq!(answer["requested_layer"], "repo");
    assert_eq!(
        answer["destination"],
        project
            .path()
            .join(".planning/config.v4.json")
            .to_str()
            .unwrap()
    );
}

#[test]
fn malformed_config_transport_returns_operation_specific_literal_refusals() {
    for (tool, arguments, expected) in [
        (
            "cadence_query",
            json!({"operation":"config-facts","extra":true}),
            json!({"status":"refused","code":"invalid-arguments","reason":"config-facts arguments do not match the strict operation schema"}),
        ),
        (
            "cadence_apply",
            json!({"operation":"config-apply","layer":"elsewhere","updates":[]}),
            json!({"status":"refused","code":"invalid-arguments","reason":"config-apply arguments do not match the strict operation schema"}),
        ),
        (
            "cadence_apply",
            json!({"operation":"config-apply","layer":"repo","updates":[{"key":"roles.cad-executor.model","value":null,"extra":1}]}),
            json!({"status":"refused","code":"invalid-arguments","reason":"config-apply arguments do not match the strict operation schema"}),
        ),
    ] {
        let project = tempfile::tempdir().unwrap();
        assert_eq!(request(project.path(), tool, arguments), expected);
    }
}

fn persisted_config(project: &Path, bytes: &[u8]) {
    use sha2::{Digest, Sha256};
    let root = project.join(".planning");
    std::fs::create_dir(&root).unwrap();
    let active = root.join("config.v4.json");
    std::fs::write(&active, bytes).unwrap();
    let empty = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    let mut snapshot = json!({"version":1,"generation":1,"items_digest":empty,"decisions_digest":empty,
        "data":{"import":{"format":1,"complete":true,"source_generation":"fixture","sources":[],
            "active":{"global":null,"repo":active},"created":[],"warnings":[]}},
        "operations":{},"integrity":""});
    snapshot["integrity"] = json!(format!(
        "{:x}",
        Sha256::digest(serde_json::to_vec(&snapshot).unwrap())
    ));
    std::fs::write(
        root.join("state.json"),
        serde_json::to_vec(&snapshot).unwrap(),
    )
    .unwrap();
    std::fs::write(root.join("items.jsonl"), b"").unwrap();
    std::fs::write(root.join("decisions.jsonl"), b"").unwrap();
}

#[test]
fn config_facts_transport_reads_independently_encoded_persisted_settings() {
    let project = tempfile::tempdir().unwrap();
    let bytes = br#"{"roles":{"cad-executor":{"model":null,"effort":"xhigh"}}}"#;
    persisted_config(project.path(), bytes);
    let answer = request(
        project.path(),
        "cadence_query",
        json!({"operation":"config-facts"}),
    );
    assert_eq!(answer["status"], "ok", "{answer}");
    let model = answer["facts"]["keys"]
        .as_array()
        .unwrap()
        .iter()
        .find(|row| row["key"] == "roles.cad-executor.model")
        .unwrap();
    assert_eq!(model["present_repo"], true);
    assert_eq!(model["present_global"], false);
    assert_eq!(model["stored_repo"], Value::Null);
    assert_eq!(model["effective"], Value::Null);
    assert_eq!(model["source"], "repo");
    assert_eq!(
        std::fs::read(project.path().join(".planning/config.v4.json")).unwrap(),
        bytes
    );
}

#[test]
fn config_apply_transport_refuses_invalid_tail_without_saving_batch_prefix() {
    for (key, value, reason) in [
        (
            "roles.cad-executor.effort",
            json!(7),
            "invalid value for roles.cad-executor.effort",
        ),
        ("stakes", json!("high"), "unknown config key stakes"),
        (
            "git.auto_close",
            json!(true),
            "retired config key git.auto_close",
        ),
        (
            "workflow.test_command",
            json!("test"),
            "wrong config layer for workflow.test_command",
        ),
    ] {
        let project = tempfile::tempdir().unwrap();
        let bytes = br#"{"roles":{"cad-executor":{"model":"opus"}}}"#;
        persisted_config(project.path(), bytes);
        let answer = request(
            project.path(),
            "cadence_apply",
            json!({"operation":"config-apply","layer":"repo","updates":[
            {"key":"roles.cad-executor.model","value":"sonnet"},{"key":key,"value":value}]}),
        );
        assert_eq!(
            answer,
            json!({"status":"refused","code":"invalid-config","reason":reason})
        );
        assert_eq!(
            std::fs::read(project.path().join(".planning/config.v4.json")).unwrap(),
            bytes
        );
    }
}
