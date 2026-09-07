use super::MAX_INPUT_BYTES;
use clap::Parser;
use serde_json::{Value, json};
use std::{
    fs,
    io::{BufRead, BufReader, Write},
    path::Path,
    process::{Command as ProcessCommand, Stdio},
};

#[test]
fn guard_process_child() {
    let Ok(mode) = std::env::var("CADENCE_GUARD_CHILD") else {
        return;
    };
    let command = match mode.as_str() {
        "guard" => crate::Command::Guard,
        "serve" => crate::Command::Serve,
        _ => panic!("unknown guard child mode"),
    };
    assert_eq!(crate::run_command(command), std::process::ExitCode::SUCCESS);
}

fn child(mode: &str) -> ProcessCommand {
    let mut command = ProcessCommand::new(std::env::current_exe().unwrap());
    command
        .args([
            "--exact",
            "guard::tests::guard_process_child",
            "--nocapture",
        ])
        .env("CADENCE_GUARD_CHILD", mode);
    command
}

fn invoke_bytes(bytes: &[u8]) -> Option<Value> {
    let mut process = child("guard")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .unwrap();
    process.stdin.take().unwrap().write_all(bytes).unwrap();
    let output = process.wait_with_output().unwrap();
    assert!(output.status.success());
    String::from_utf8(output.stdout)
        .unwrap()
        .lines()
        .find_map(|line| serde_json::from_str(line).ok())
}

fn event(tool: &str, cwd: &Path, target: Value) -> Vec<u8> {
    serde_json::to_vec(&json!({
        "session_id": "guard-fixture",
        "hook_event_name": "PreToolUse",
        "tool_name": tool,
        "cwd": cwd,
        "tool_input": if tool == "Write" {
            json!({"file_path":target,"content":"never written"})
        } else {
            json!({"file_path":target,"old_string":"old","new_string":"new"})
        }
    }))
    .unwrap()
}

fn denied(bytes: &[u8]) -> Value {
    let output = invoke_bytes(bytes).expect("protected or malformed Write/Edit needs a decision");
    let decision = &output["hookSpecificOutput"];
    assert_eq!(decision["hookEventName"], "PreToolUse");
    assert_eq!(decision["permissionDecision"], "deny");
    assert!(
        decision["permissionDecisionReason"]
            .as_str()
            .is_some_and(|reason| !reason.is_empty())
    );
    output
}

#[test]
pub(crate) fn guard_denies_owned_outputs_through_every_path_spelling() {
    let temp = tempfile::tempdir().unwrap();
    let project = temp.path();
    let planning = project.join(".planning");
    fs::create_dir_all(planning.join("phases/6")).unwrap();
    fs::create_dir_all(project.join("nested")).unwrap();
    #[cfg(unix)]
    std::os::unix::fs::symlink(&planning, project.join("planning-alias")).unwrap();
    let state = planning.join("state.json");
    fs::write(&state, "original\n").unwrap();

    let cases = [
        ("Write", project, ".planning/state.json".into()),
        ("Edit", project, ".planning/decisions.jsonl".into()),
        ("Write", project, ".planning/items.jsonl".into()),
        ("Edit", project, ".planning/phases/6/SUMMARY.md".into()),
        ("Write", project, ".planning/phases/0007/SUMMARY.md".into()),
        (
            "Edit",
            project,
            "./.planning/phases/6/../6/SUMMARY.md".into(),
        ),
        ("Write", project, ".planning\\state.json".into()),
        ("Edit", project, state.to_string_lossy().into_owned()),
        (
            "Write",
            &project.join("nested"),
            "../.planning/state.json".into(),
        ),
        #[cfg(unix)]
        ("Edit", project, "planning-alias/state.json".into()),
    ];
    for (tool, cwd, target) in cases {
        denied(&event(tool, cwd, json!(target)));
    }
    assert_eq!(fs::read_to_string(state).unwrap(), "original\n");
    assert!(!planning.join("decisions.jsonl").exists());
    assert!(!planning.join("phases/6/SUMMARY.md").exists());
}

#[test]
pub(crate) fn guard_fails_closed_for_malformed_ambiguous_and_oversized_write_events() {
    let temp = tempfile::tempdir().unwrap();
    let cwd = temp.path();
    for bytes in [
        event("Write", cwd, Value::Null),
        event("Edit", cwd, json!("bad\0path")),
        br#"{"tool_name":"Write","cwd":1,"tool_input":{"file_path":"x"}}"#.to_vec(),
        br#"{"tool_name":"Edit","cwd":"/","tool_input":{}}"#.to_vec(),
        br#"{"tool_name":"Write","cwd":"/","tool_input":{"file_path":"a","file_path":"b"}}"#
            .to_vec(),
        br#"{"tool_name":"Write","cwd":"/","tool_input":{"file_path":"x"}} {}"#.to_vec(),
        vec![
            b'{', b'"', b't', b'o', b'o', b'l', b'_', b'n', b'a', b'm', b'e', b'"', b':', b'"',
            b'W', b'r', b'i', b't', b'e', b'"', b',', 0xff,
        ],
    ] {
        denied(&bytes);
    }
    let mut oversized = format!(
        "{{\"tool_name\":\"Write\",\"cwd\":\"{}\",\"tool_input\":{{\"file_path\":\"",
        cwd.display()
    )
    .into_bytes();
    oversized.resize(MAX_INPUT_BYTES as usize + 20, b'x');
    denied(&oversized);
    denied(&event("Write", cwd, json!("C:\\ambiguous\\path")));
    assert!(invoke_bytes(br#"{"tool_name":"Bash","tool_input":{}}"#).is_none());
}

#[test]
pub(crate) fn guard_allows_unowned_source_paths_inside_and_outside_planning() {
    let temp = tempfile::tempdir().unwrap();
    let project = temp.path();
    fs::create_dir_all(project.join(".planning/phases/6")).unwrap();
    let outside = tempfile::tempdir().unwrap().path().join("outside.rs");
    for (tool, target) in [
        ("Write", "src/lib.rs".to_owned()),
        ("Edit", ".planning/notes.md".to_owned()),
        ("Write", ".planning/phases/6/PLAN-1.md".to_owned()),
        ("Edit", outside.to_string_lossy().into_owned()),
    ] {
        assert!(invoke_bytes(&event(tool, project, json!(target))).is_none());
    }
    assert!(invoke_bytes(&event("Bash", project, json!(".planning/state.json"))).is_none());
}

#[test]
fn guard_cli_retains_the_serve_handshake() {
    assert!(matches!(
        crate::Cli::try_parse_from(["cadence", "guard"])
            .unwrap()
            .command,
        crate::Command::Guard
    ));
    assert!(matches!(
        crate::Cli::try_parse_from(["cadence", "serve"])
            .unwrap()
            .command,
        crate::Command::Serve
    ));

    let mut process = child("serve")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .unwrap();
    let mut stdin = process.stdin.take().unwrap();
    let mut stdout = BufReader::new(process.stdout.take().unwrap());
    writeln!(
        stdin,
        "{}",
        json!({
            "jsonrpc":"2.0",
            "id":1,
            "method":"initialize",
            "params":{
                "protocolVersion":"2025-06-18",
                "capabilities":{},
                "clientInfo":{"name":"guard-probe","version":"0"}
            }
        })
    )
    .unwrap();
    stdin.flush().unwrap();
    let response = loop {
        let mut line = String::new();
        assert_ne!(stdout.read_line(&mut line).unwrap(), 0);
        if let Ok(value) = serde_json::from_str::<Value>(&line)
            && value["id"] == 1
        {
            break value;
        }
    };
    assert_eq!(response["result"]["serverInfo"]["name"], "cadence");
    writeln!(
        stdin,
        "{}",
        json!({"jsonrpc":"2.0","method":"notifications/initialized"})
    )
    .unwrap();
    stdin.flush().unwrap();
    drop(stdin);
    assert!(process.wait().unwrap().success());
}
