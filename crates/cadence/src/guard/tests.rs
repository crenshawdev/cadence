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
    if mode == "guard-gap" {
        std::process::exit(if super::run() == std::process::ExitCode::SUCCESS {
            0
        } else {
            1
        });
    }
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

const CONFIG_DENIAL: &[u8] = b"{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"Cadence owns this config destination; use cadence_apply config operations instead of Write/Edit\"}}\n";

// The temporary root maps the named /project, /global and /home/fixture trees
// into an isolated filesystem. The child exercises only the hook's process I/O.
fn gap_tree() -> tempfile::TempDir {
    let tree = tempfile::tempdir().unwrap();
    for directory in [
        "project/.planning/subdir",
        "global",
        "home/fixture/.claude/cadence",
        "server-project/.planning",
        "unrelated",
    ] {
        fs::create_dir_all(tree.path().join(directory)).unwrap();
    }
    tree
}

fn gap_hook(tree: &Path, tool: &str, target: &str, global: Option<&str>) -> Vec<u8> {
    let mut command = child("guard-gap");
    command
        .env_clear()
        .env("CADENCE_GUARD_CHILD", "guard-gap")
        .env("HOME", tree.join("home/fixture"))
        .current_dir(tree.join("project"));
    if let Some(global) = global {
        command.env("CADENCE_GLOBAL_CONFIG", global);
    }
    let mut process = command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .unwrap();
    process
        .stdin
        .take()
        .unwrap()
        .write_all(&event(tool, &tree.join("project"), json!(target)))
        .unwrap();
    let output = process.wait_with_output().unwrap();
    if !output.status.success() {
        panic!("hook child failed: {}", output.status);
    }
    // libtest prints its preamble before entering the child function.
    output
        .stdout
        .strip_prefix(b"\nrunning 1 test\n")
        .unwrap_or(&output.stdout)
        .to_vec()
}

#[test]
fn phase8_gap_guard_denies_bound_config_destinations() {
    for tool in ["Write", "Edit"] {
        for row in [
            "relative",
            "absolute",
            "dots",
            "backslash",
            "parent-alias",
            "file-alias",
            "hard-link",
            "missing-parent-alias",
            "global",
            "relative-global",
            "global-dots",
            "global-backslash",
            "global-parent-alias",
            "global-file-alias",
            "global-hard-link",
            "global-missing-alias",
            "global-legacy-alias",
            "home-global",
            "disabled-global",
            "legacy-alias",
            "active-alias",
            "collapsed",
            "cwd-repo-with-server-root",
        ] {
            let tree = gap_tree();
            let root = tree.path();
            let repo = root.join("project/.planning/config.v4.json");
            fs::write(&repo, b"{}").unwrap();
            fs::write(root.join("global/config.v4.json"), b"{}").unwrap();
            fs::write(root.join("server-project/.planning/config.v4.json"), b"{}").unwrap();
            std::os::unix::fs::symlink(root.join("project/.planning"), root.join("project/alias"))
                .unwrap();
            let global_path = root.join("global/config.json").to_str().unwrap().to_owned();
            let mut global = Some(global_path.as_str());
            let target = match row {
                "absolute" => repo.to_str().unwrap().to_owned(),
                "dots" => "./.planning/subdir/../config.v4.json".into(),
                "backslash" => ".planning\\config.v4.json".into(),
                "parent-alias" => "alias/config.v4.json".into(),
                "missing-parent-alias" => {
                    fs::remove_file(&repo).unwrap();
                    "alias/config.v4.json".into()
                }
                "file-alias" => {
                    std::os::unix::fs::symlink(&repo, root.join("project/file-alias")).unwrap();
                    "file-alias".into()
                }
                "hard-link" => {
                    fs::hard_link(&repo, root.join("project/hard-link")).unwrap();
                    "hard-link".into()
                }
                "global" => root
                    .join("global/config.v4.json")
                    .to_str()
                    .unwrap()
                    .to_owned(),
                "global-dots" => "../global/./config.v4.json".into(),
                "global-backslash" => "..\\global\\config.v4.json".into(),
                "global-parent-alias" | "global-missing-alias" => {
                    std::os::unix::fs::symlink(
                        root.join("global"),
                        root.join("project/global-alias"),
                    )
                    .unwrap();
                    if row == "global-missing-alias" {
                        fs::remove_file(root.join("global/config.v4.json")).unwrap();
                    }
                    "global-alias/config.v4.json".into()
                }
                "global-file-alias" => {
                    std::os::unix::fs::symlink(
                        root.join("global/config.v4.json"),
                        root.join("project/global-file"),
                    )
                    .unwrap();
                    "global-file".into()
                }
                "global-hard-link" => {
                    fs::hard_link(
                        root.join("global/config.v4.json"),
                        root.join("project/global-file"),
                    )
                    .unwrap();
                    "global-file".into()
                }
                "global-legacy-alias" => {
                    fs::write(root.join("unrelated/config.json"), b"{}").unwrap();
                    std::os::unix::fs::symlink(
                        root.join("unrelated/config.json"),
                        root.join("global/config.json"),
                    )
                    .unwrap();
                    "../unrelated/config.v4.json".into()
                }
                "relative-global" => {
                    global = Some("../global/config.json");
                    "../global/config.v4.json".into()
                }
                "home-global" => {
                    global = None;
                    root.join("home/fixture/.claude/cadence/config.v4.json")
                        .to_str()
                        .unwrap()
                        .to_owned()
                }
                "disabled-global" => {
                    global = Some("");
                    ".planning/config.v4.json".into()
                }
                "legacy-alias" => {
                    fs::write(root.join("unrelated/config.json"), b"{}").unwrap();
                    std::os::unix::fs::symlink(
                        root.join("unrelated/config.json"),
                        root.join("project/.planning/config.json"),
                    )
                    .unwrap();
                    "../unrelated/config.v4.json".into()
                }
                "active-alias" => {
                    fs::remove_file(&repo).unwrap();
                    fs::write(root.join("unrelated/active"), b"{}").unwrap();
                    std::os::unix::fs::symlink(root.join("unrelated/active"), &repo).unwrap();
                    "../unrelated/active".into()
                }
                "collapsed" => {
                    fs::write(root.join("project/.planning/config.json"), b"{}").unwrap();
                    std::os::unix::fs::symlink(
                        root.join("project/.planning/config.json"),
                        root.join("global/config.json"),
                    )
                    .unwrap();
                    ".planning/config.v4.json".into()
                }
                _ => ".planning/config.v4.json".into(),
            };
            assert_eq!(
                gap_hook(root, tool, &target, global),
                CONFIG_DENIAL,
                "{tool}/{row}"
            );
        }
    }
}

#[test]
fn phase8_gap_guard_denies_symlink_before_parent_segment() {
    for tool in ["Write", "Edit"] {
        for present in [true, false] {
            let tree = gap_tree();
            let root = tree.path();
            std::os::unix::fs::symlink(
                root.join("project/.planning/subdir"),
                root.join("project/jump"),
            )
            .unwrap();
            fs::write(root.join("project/config.v4.json"), b"unrelated").unwrap();
            if present {
                fs::write(root.join("project/.planning/config.v4.json"), b"{}").unwrap();
            }
            assert_eq!(
                gap_hook(
                    root,
                    tool,
                    "jump/../config.v4.json",
                    Some("../global/config.json")
                ),
                CONFIG_DENIAL,
                "{tool}/present={present}"
            );
        }
    }
}

#[test]
fn phase8_gap_guard_denies_literal_backslash_alias() {
    for tool in ["Write", "Edit"] {
        let tree = gap_tree();
        let root = tree.path();
        fs::create_dir(root.join("project/raw")).unwrap();
        fs::write(root.join("project/raw/alias"), b"unrelated").unwrap();
        fs::write(root.join("project/.planning/config.v4.json"), b"{}").unwrap();
        fs::hard_link(
            root.join("project/.planning/config.v4.json"),
            root.join("project/raw\\alias"),
        )
        .unwrap();
        assert_eq!(
            gap_hook(root, tool, "raw\\alias", Some("../global/config.json")),
            CONFIG_DENIAL,
            "{tool}"
        );
    }
}

#[test]
fn phase8_gap_guard_allows_unbound_config_name() {
    let tree = gap_tree();
    for path in [
        "project/.planning/config.v4.json",
        "global/config.v4.json",
        "unrelated/config.v4.json",
    ] {
        fs::write(tree.path().join(path), b"{}").unwrap();
    }
    assert_eq!(
        gap_hook(
            tree.path(),
            "Write",
            "../unrelated/config.v4.json",
            Some("../global/config.json")
        ),
        b""
    );
}

#[test]
fn phase8_gap_guard_different_server_root_is_unbound() {
    for tool in ["Write", "Edit"] {
        let tree = gap_tree();
        for path in [
            "project/.planning/config.v4.json",
            "global/config.v4.json",
            "server-project/.planning/config.v4.json",
        ] {
            fs::write(tree.path().join(path), b"{}").unwrap();
        }
        assert_eq!(
            gap_hook(
                tree.path(),
                tool,
                "../server-project/.planning/config.v4.json",
                Some("../global/config.json")
            ),
            b"",
            "{tool}"
        );
    }
}
