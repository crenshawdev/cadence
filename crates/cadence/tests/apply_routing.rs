//! `cadence_apply` routes by the operation name, and a miss names the field.
//!
//! The apply arguments were one untagged enum over fifteen groups. Serde tried
//! every group in order and reported only that none matched, the `.ok()` on
//! that parse threw the message away, and what a caller got back depended on
//! which side door the operation had fallen through first: a config typo was
//! "does not match the strict operation schema", and an operation that does
//! not exist was told to shape itself as an executor patch.

#[path = "support/phase13.rs"]
#[allow(dead_code)]
mod phase13;
use phase13::*;
use serde_json::{Value, json};
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};

/// The `cadence_apply` tool as the server advertises it over `tools/list`.
fn advertised_apply_tool(project: &std::path::Path) -> Value {
    let mut child = Command::new(env!("CARGO_BIN_EXE_cadence"))
        .args(["serve", "--project-root", project.to_str().unwrap()])
        .current_dir(project)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .unwrap();
    let mut stdin = child.stdin.take().unwrap();
    let mut stdout = BufReader::new(child.stdout.take().unwrap());
    let mut exchange = |request: Value| -> Value {
        writeln!(stdin, "{request}").unwrap();
        stdin.flush().unwrap();
        if request.get("id").is_none() {
            return Value::Null;
        }
        let mut line = String::new();
        assert!(stdout.read_line(&mut line).unwrap() > 0);
        serde_json::from_str(&line).unwrap()
    };
    exchange(json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{
        "protocolVersion":"2025-06-18","capabilities":{},
        "clientInfo":{"name":"apply-routing","version":"1"}}}));
    exchange(json!({"jsonrpc":"2.0","method":"notifications/initialized"}));
    let tools = exchange(json!({"jsonrpc":"2.0","id":2,"method":"tools/list"}));
    drop(stdin);
    assert!(child.wait().unwrap().success());
    tools["result"]["tools"]
        .as_array()
        .unwrap()
        .iter()
        .find(|tool| tool["name"] == "cadence_apply")
        .cloned()
        .expect("cadence_apply is advertised")
}

#[test]
fn a_misspelled_config_field_is_named_in_the_refusal() {
    let project = fixture();
    let answer = apply(project.path(), json!({"operation":"config-apply","layer":"repo",
        "updates":[{"key":"roles.executor.model","valeu":"x"}]}));
    assert_eq!(answer["status"], "refused", "{answer}");
    assert_eq!(answer["code"], "invalid-arguments", "{answer}");
    let reason = answer["reason"].as_str().unwrap();
    assert!(reason.contains("valeu"), "{answer}");
}

#[test]
fn an_operation_that_does_not_exist_is_refused_as_unknown() {
    let project = fixture();
    let answer = apply(project.path(), json!({"operation":"no-such-operation"}));
    assert_eq!(answer["status"], "refused", "{answer}");
    assert_eq!(answer["code"], "unknown-operation", "{answer}");
    let reason = answer["reason"].as_str().unwrap();
    assert!(reason.contains("no-such-operation"), "{answer}");
    assert!(reason.contains("config-apply"), "the refusal lists the operations: {answer}");
}

#[test]
fn a_request_without_an_operation_is_still_read_as_an_executor_patch() {
    let project = fixture();
    let answer = apply(project.path(), json!({"unexpected":"field"}));
    assert_eq!(answer["status"], "refused", "{answer}");
    assert_eq!(answer["code"], "invalid-patch", "{answer}");
}

#[test]
fn the_apply_schema_lists_each_operation_once() {
    let project = fixture();
    let tool = advertised_apply_tool(project.path());
    // The enum follows the operation table; duplicate names remain forbidden.
    let variants = tool["inputSchema"]["properties"]["operation"]["enum"]
        .as_array()
        .unwrap_or_else(|| panic!("no properties.operation.enum in {}", tool["inputSchema"]));
    let mut names: Vec<&str> = variants
        .iter()
        .map(|variant| variant.as_str().unwrap())
        .collect();
    names.sort_unstable();
    let count = names.len();
    names.dedup();
    assert_eq!(names.len(), count, "an operation appears in two variants: {names:?}");
    for expected in ["config-apply", "plan-submit", "context-submit", "review-admit",
        "risk-check", "risk-fire", "verification-run", "execution-admit", "execution-task-close", "execution-round-record"] {
        assert!(names.contains(&expected), "{expected} missing from {names:?}");
    }
}
