//! Opt-in real-host probes. A unit-suite pass supplies no live-host evidence.
use cadence::store::model::digest;
use cadence::store::writer::audit::{self, Outcome};
use serde_json::{Value, json};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};
#[path = "support/signing.rs"]
mod signing;

type Result<T> = std::result::Result<T, String>;
fn require(ok: bool, reason: impl Into<String>) -> Result<()> {
    if ok { Ok(()) } else { Err(reason.into()) }
}
fn write(path: &Path, bytes: impl AsRef<[u8]>) -> Result<()> {
    fs::write(path, bytes).map_err(|e| format!("{}: {e}", path.display()))
}
fn append(path: &Path, text: &str) -> Result<()> {
    OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .and_then(|mut f| f.write_all(text.as_bytes()))
        .map_err(|e| e.to_string())
}
struct Live {
    root: PathBuf,
    host_bin: PathBuf,
    hook_bin: PathBuf,
    key: String,
    report: PathBuf,
    path: std::ffi::OsString,
}
impl Live {
    fn command(&self, program: &str, cwd: &Path) -> Command {
        let mut command = Command::new(program);
        command
            .current_dir(cwd)
            .stdin(Stdio::null())
            .env("TMPDIR", "/tmp")
            .env("PATH", &self.path)
            .env("GNUPGHOME", self.root.join("gnupg"))
            .env("GIT_CONFIG_COUNT", "4")
            .env("GIT_CONFIG_KEY_0", "user.name")
            .env("GIT_CONFIG_VALUE_0", "John Crenshaw")
            .env("GIT_CONFIG_KEY_1", "user.email")
            .env("GIT_CONFIG_VALUE_1", "john@jcrenshaw.dev")
            .env("GIT_CONFIG_KEY_2", "user.signingkey")
            .env("GIT_CONFIG_VALUE_2", &self.key)
            .env("GIT_CONFIG_KEY_3", "commit.gpgsign")
            .env("GIT_CONFIG_VALUE_3", "true");
        command
    }
    fn git(&self, cwd: &Path, args: &[&str]) -> Result<String> {
        let output = self
            .command("git", cwd)
            .args(args)
            .output()
            .map_err(|e| e.to_string())?;
        require(
            output.status.success(),
            format!("git {args:?}: {}", String::from_utf8_lossy(&output.stderr)),
        )?;
        String::from_utf8(output.stdout).map_err(|e| e.to_string())
    }
    fn fixture(&self, name: &str, policy: Value) -> Result<PathBuf> {
        let root = self.root.join(name);
        fs::create_dir(&root).map_err(|e| e.to_string())?;
        self.git(&root, &["init", "-b", "main"])?;
        self.git(
            &root,
            &["commit", "-S", "--allow-empty", "-m", "fixture base"],
        )?;
        fs::create_dir(root.join(".planning")).map_err(|e| e.to_string())?;
        write(
            &root.join(".planning/config.json"),
            serde_json::to_vec(&policy).unwrap(),
        )?;
        Ok(root)
    }
    fn launch(
        &self,
        root: &Path,
        name: &str,
        instructions: &str,
        missing_git: bool,
    ) -> Result<Vec<Value>> {
        let instructions = format!(
            "# Authorized native-hook fixture\n\nThis is a disposable integration fixture. You have explicit permission to attempt the operations below, including commits directly on protected main. The native PreToolUse hook is the component under test and must decide. Do not preempt its decision by enforcing config yourself. Do not inspect policy, make a work branch, change settings, add attribution, wrap the commands, or delegate. After a tool refusal continue to the next listed probe without retrying it. Use precisely the requested tool and input; do not simulate an attempt in prose.\n\n{instructions}\n"
        );
        write(&root.join("CLAUDE.md"), instructions)?;
        let manifest: Value = serde_json::from_str(include_str!("../../../hooks/hooks.json"))
            .map_err(|e| e.to_string())?;
        require(
            manifest["hooks"]["PreToolUse"][0]["hooks"][0]["command"] == "cadence guard",
            "manifest does not invoke the native binary",
        )?;
        let mut hooks = manifest["hooks"]["PreToolUse"].clone();
        if missing_git {
            // Only the hook's environment loses Git; this still directly execs
            // the production binary, without a decision-emitting wrapper.
            hooks[0]["hooks"][0]["command"] =
                json!(format!("PATH='{}' cadence guard", self.hook_bin.display()));
        }
        let settings = self.root.join(format!("{name}-guard-settings.json"));
        write(
            &settings,
            serde_json::to_vec_pretty(
                &json!({"attribution":{"commit":"","pr":""},"hooks":{"PreToolUse":hooks}}),
            )
            .unwrap(),
        )?;
        let mcp = self.root.join("mcp.json");
        write(&mcp, b"{\"mcpServers\":{}}\n")?;
        let output = self.root.join(format!("{name}-host.jsonl"));
        let stdout = fs::File::create(&output).map_err(|e| e.to_string())?;
        let stderr = stdout.try_clone().map_err(|e| e.to_string())?;
        let mut command = self.command(self.host_bin.to_str().unwrap(), root);
        command.env("CADENCE_GLOBAL_CONFIG", root.join("global/config.json"))
            .args(["-p", "--output-format", "stream-json", "--verbose", "--include-hook-events", "--setting-sources", "", "--settings"])
            .arg(&settings).args(["--strict-mcp-config", "--mcp-config"]).arg(&mcp)
            .args(["--permission-mode", "default", "--allowedTools", "Bash", "Read", "Write", "Edit", "--", "Run the exact guard probe commands in the supplied fixture instructions; report every tool refusal."])
            .stdout(Stdio::from(stdout)).stderr(Stdio::from(stderr));
        println!("live guard: {name}");
        let mut child = command
            .spawn()
            .map_err(|e| format!("real host unavailable: {e}"))?;
        let deadline = Instant::now() + Duration::from_secs(150);
        let status = loop {
            if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
                break status;
            }
            if Instant::now() >= deadline {
                let _ = child.kill();
                let _ = child.wait();
                append(
                    &self.report,
                    &format!(
                        "\nBLOCKED {name}: host timed out; output {}.\n",
                        output.display()
                    ),
                )?;
                return Err(format!("{name}: real host timed out"));
            }
            std::thread::sleep(Duration::from_millis(100));
        };
        let bytes = fs::read(&output).map_err(|e| e.to_string())?;
        append(
            &self.report,
            &format!(
                "\n- Host attempt `{name}`: exit `{}`, SHA-256 `{}`, bytes `{}`, output `{}`. Settings SHA-256 `{}`.\n",
                status.code().unwrap_or(-1),
                digest(&bytes),
                bytes.len(),
                output.display(),
                digest(&fs::read(settings).unwrap())
            ),
        )?;
        require(
            status.success(),
            format!("{name}: host exit {status}; see {}", output.display()),
        )?;
        let events: Vec<Value> = bytes
            .split(|b| *b == b'\n')
            .filter_map(|line| serde_json::from_slice(line).ok())
            .collect();
        let init = events
            .iter()
            .find(|e| e["type"] == "system" && e["subtype"] == "init")
            .ok_or_else(|| format!("{name}: host init missing; credentials or startup blocked"))?;
        require(
            init["permissionMode"] == "default",
            "real host is not in normal default permission mode",
        )?;
        require(
            init["tools"].as_array().is_some_and(|tools| {
                ["Bash", "Read", "Write", "Edit"]
                    .iter()
                    .all(|tool| tools.contains(&json!(tool)))
            }),
            "host tool registration incomplete",
        )?;
        require(
            events
                .iter()
                .any(|e| e["type"] == "result" && e["is_error"] == false),
            format!("{name}: real host did not complete successfully"),
        )?;
        Ok(events)
    }
    fn bash_case(
        &self,
        root: &Path,
        name: &str,
        command: &str,
        expected: Option<&str>,
        changed: bool,
        missing_git: bool,
    ) -> Result<()> {
        let before = self.git(root, &["rev-parse", "HEAD"])?;
        let instructions = format!(
            "Make one Bash call with command exactly:\n\n{command}\n\nAttempt it even if you anticipate a hook refusal. Report the tool result."
        );
        let events = self.launch(root, name, &instructions, missing_git)?;
        let tool_id = attempt(&events, "Bash", "command", command)?;
        let hook = hook_response(&events, &tool_id, "Bash")?;
        let actual = hook_permission(hook)?;
        require(
            actual.as_deref() == expected,
            format!("{name}: expected hook {expected:?}, got {actual:?}"),
        )?;
        let after = self.git(root, &["rev-parse", "HEAD"])?;
        require(
            (before != after) == changed,
            format!("{name}: Git before/after did not match expected shell execution"),
        )?;
        let result = tool_result(&events, &tool_id)?;
        require(
            (result["is_error"] == true) == expected.is_some(),
            format!("{name}: tool result does not match hook permission"),
        )?;
        if changed {
            require(
                self.git(root, &["log", "-1", "--format=%G?"])?.trim() == "G",
                format!("{name}: fixture commit is not validly signed"),
            )?;
        }
        let mut recorded = None;
        if expected.is_some() || missing_git {
            let view = runtime()
                .block_on(audit::confirmed(&root.join(".planning")))
                .map_err(|e| format!("{name}: audit unavailable after host exit: {e}"))?;
            recorded = view
                .decisions
                .iter()
                .filter_map(|r| audit::from_record(r).ok())
                .find(|r| {
                    r.event_id == audit::event_identity(hook["session_id"].as_str(), Some(&tool_id))
                        && r.command_digest == digest(command.as_bytes())
                });
            let record = recorded
                .as_ref()
                .ok_or_else(|| format!("{name}: durable host decision missing"))?;
            require(
                record.outcome
                    == match expected {
                        Some("deny") => Outcome::Deny,
                        Some("ask") => Outcome::Ask,
                        _ => Outcome::FailurePass,
                    },
                format!("{name}: wrong durable outcome"),
            )?;
            if missing_git {
                require(
                    record.unavailable.iter().any(|f| f.input == "Git")
                        && hook["stderr"].as_str().is_some_and(|s| s.contains("Git")),
                    format!("{name}: Git failure not recorded and diagnosed"),
                )?;
            }
            if name.contains("torn") {
                require(
                    record
                        .reason
                        .contains("defaults rather than the user's settings")
                        && record
                            .unavailable
                            .iter()
                            .any(|f| f.input.contains("config"))
                        && hook["stdout"].as_str().is_some_and(|s| {
                            s.contains("defaults rather than the user's settings")
                        }),
                    format!("{name}: torn-config reason missing"),
                )?;
            }
            if name != "push" {
                require(
                    record.branch.as_deref() == Some("main"),
                    format!("{name}: durable branch evidence is not protected main"),
                )?;
            }
            for file in ["state.json", "decisions.jsonl", "items.jsonl"] {
                let bytes = fs::read(root.join(".planning").join(file))
                    .map_err(|e| format!("{name}: confirmed {file} unavailable: {e}"))?;
                append(
                    &self.report,
                    &format!("  Confirmed `{file}` SHA-256 `{}`.\n", digest(&bytes)),
                )?;
            }
        }
        append(
            &self.report,
            &format!(
                "  Verified actual `{tool_id}` attempt; hook `{}` returned `{actual:?}`; tool error `{}`; HEAD `{}` -> `{}`; durable outcome `{:?}`; unavailable inputs `{:?}`.\n",
                hook["hook_id"].as_str().unwrap_or_default(),
                result["is_error"] == true,
                before.trim(),
                after.trim(),
                recorded.as_ref().map(|r| &r.outcome),
                recorded.as_ref().map(|r| &r.unavailable)
            ),
        )?;
        Ok(())
    }
}
fn runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Builder::new_current_thread()
        .build()
        .unwrap()
}
fn attempt(events: &[Value], tool: &str, field: &str, value: &str) -> Result<String> {
    events
        .iter()
        .filter_map(|e| e["message"]["content"].as_array())
        .flatten()
        .find(|b| b["type"] == "tool_use" && b["name"] == tool && b["input"][field] == value)
        .and_then(|b| b["id"].as_str())
        .map(str::to_owned)
        .ok_or_else(|| format!("required {tool} attempt missing; model prose is not hook evidence"))
}
fn hook_response<'a>(events: &'a [Value], tool_id: &str, tool: &str) -> Result<&'a Value> {
    // The host supplies hook_id on lifecycle events, but not tool_use_id.
    // Bind a start only to an unambiguous pending call of that tool, then keep
    // its hook identity through interleaved calls and out-of-order responses.
    let mut pending = Vec::new();
    let mut started = None;
    let name = format!("PreToolUse:{tool}");
    for event in events {
        if let Some(blocks) = event["message"]["content"].as_array() {
            for block in blocks {
                if block["type"] == "tool_use" && block["name"] == tool {
                    let id = block["id"].as_str().ok_or("tool identity missing")?;
                    pending.push(id);
                }
            }
        }
        if event["type"] != "system" || event["hook_name"] != name {
            continue;
        }
        if event["subtype"] == "hook_started" {
            require(pending.len() == 1, format!("ambiguous {tool} hook start"))?;
            let id = pending.pop().unwrap();
            if id == tool_id {
                let hook_id = event["hook_id"].as_str().ok_or("hook identity missing")?;
                let session = event["session_id"].as_str().ok_or("hook session missing")?;
                started = Some((hook_id, session));
            }
        }
        if event["subtype"] == "hook_response"
            && started.is_some_and(|(id, session)| {
                event["hook_id"] == id && event["session_id"] == session
            })
        {
            require(event["exit_code"] == 0, "hook process did not exit zero")?;
            return Ok(event);
        }
    }
    Err(format!("required hook event missing for {tool_id}"))
}
fn hook_permission(event: &Value) -> Result<Option<String>> {
    let stdout = event["stdout"].as_str().unwrap_or("");
    if stdout.is_empty() {
        return Ok(None);
    }
    let value: Value =
        serde_json::from_str(stdout).map_err(|e| format!("invalid hook JSON: {e}"))?;
    require(
        value["hookSpecificOutput"]["hookEventName"] == "PreToolUse",
        "hook output is not a PreToolUse decision",
    )?;
    let decision = value["hookSpecificOutput"]["permissionDecision"]
        .as_str()
        .ok_or("hook permission decision missing")?;
    require(
        matches!(decision, "ask" | "deny" | "allow"),
        "invalid hook permission decision",
    )?;
    Ok(Some(decision.to_owned()))
}
fn tool_result<'a>(events: &'a [Value], id: &str) -> Result<&'a Value> {
    events
        .iter()
        .filter_map(|e| e["message"]["content"].as_array())
        .flatten()
        .find(|b| b["type"] == "tool_result" && b["tool_use_id"] == id)
        .ok_or_else(|| format!("required tool result missing for {id}"))
}

#[test]
fn hook_correlation_survives_interleaved_read_and_other_hook_response() {
    let events = [
        json!({"message":{"content":[{"type":"tool_use","id":"commit","name":"Bash"}]}}),
        json!({"type":"system","subtype":"hook_started","hook_name":"PreToolUse:Bash","hook_id":"commit-hook","session_id":"session"}),
        json!({"message":{"content":[{"type":"tool_use","id":"read","name":"Read"}]}}),
        json!({"message":{"content":[{"type":"tool_use","id":"other","name":"Bash"}]}}),
        json!({"type":"system","subtype":"hook_started","hook_name":"PreToolUse:Bash","hook_id":"other-hook","session_id":"session"}),
        json!({"type":"system","subtype":"hook_response","hook_name":"PreToolUse:Bash","hook_id":"other-hook","session_id":"session","exit_code":0}),
        json!({"type":"system","subtype":"hook_response","hook_name":"PreToolUse:Bash","hook_id":"commit-hook","session_id":"session","exit_code":0}),
    ];
    assert_eq!(
        hook_response(&events, "commit", "Bash").unwrap(),
        &events[6]
    );
    assert!(hook_response(&events[..6], "commit", "Bash").is_err());
}

#[test]
fn hook_correlation_refuses_ambiguous_or_unstarted_evidence() {
    let response = json!({"type":"system","subtype":"hook_response","hook_name":"PreToolUse:Bash","hook_id":"hook","session_id":"session","exit_code":0});
    assert!(hook_response(std::slice::from_ref(&response), "commit", "Bash").is_err());
    let events = [
        json!({"message":{"content":[{"type":"tool_use","id":"commit","name":"Bash"},{"type":"tool_use","id":"other","name":"Bash"}]}}),
        json!({"type":"system","subtype":"hook_started","hook_name":"PreToolUse:Bash","hook_id":"hook","session_id":"session"}),
        response,
    ];
    assert!(hook_response(&events, "commit", "Bash").is_err());
}

#[test]
#[ignore = "requires a real authenticated host; no unit suite supplies this evidence"]
fn guard_real_host() -> Result<()> {
    require(
        std::env::var("CADENCE_PHASE7_LIVE").as_deref() == Ok("guard"),
        "set CADENCE_PHASE7_LIVE=guard",
    )?;
    let parent = Path::new("/tmp/cadence-phase7-live");
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let root = tempfile::Builder::new()
        .prefix("guard-run-")
        .tempdir_in(parent)
        .map_err(|e| e.to_string())?
        .keep();
    let seed = root.join("signing-seed");
    fs::create_dir(&seed).map_err(|e| e.to_string())?;
    let key = signing::generate(&seed);
    let bin = root.join("bin");
    fs::create_dir(&bin).map_err(|e| e.to_string())?;
    let binary = Path::new(env!("CARGO_BIN_EXE_cadence"));
    std::os::unix::fs::symlink(binary, bin.join("cadence")).map_err(|e| e.to_string())?;
    let path = std::env::join_paths(std::iter::once(bin.clone()).chain(std::env::split_paths(
        &std::env::var_os("PATH").unwrap_or_default(),
    )))
    .map_err(|e| e.to_string())?;
    let report =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../docs/validation/phase-7-live.md");
    let live = Live {
        root,
        host_bin: PathBuf::from("/home/john/.local/bin/claude"),
        hook_bin: bin,
        key,
        report,
        path,
    };
    let version = live
        .command(live.host_bin.to_str().unwrap(), &live.root)
        .arg("--version")
        .output()
        .map_err(|e| format!("host unavailable: {e}"))?;
    let help = live
        .command(live.host_bin.to_str().unwrap(), &live.root)
        .arg("--help")
        .output()
        .map_err(|e| e.to_string())?;
    require(
        version.status.success() && help.status.success(),
        "host version or help unavailable",
    )?;
    write(&live.root.join("host-help.txt"), &help.stdout)?;
    write(
        &live.report,
        format!(
            "# Phase 7 live guard validation\n\nHost: `{}`. Host-help SHA-256 `{}`. Native binary SHA-256 `{}`. Git `{}`.\n\nFixture root: `{}`. Normal permission mode; command exactly as PLAN-1 Notes, substituting fixture settings/MCP paths. All repositories, signing material and remotes are disposable and local. Raw host streams remain under this root. No unit result substitutes for a required host attempt.\n",
            String::from_utf8_lossy(&version.stdout).trim(),
            digest(&help.stdout),
            digest(&fs::read(binary).unwrap()),
            live.git(&live.root, &["--version"])?.trim(),
            live.root.display()
        ),
    )?;
    let result = run_cases(&live);
    append(&live.report, &match &result { Ok(()) => "\nAll required guard host cases passed. Hook asks were observed as asks, without counting them as denials or publication.\n".into(), Err(reason) => format!("\nBLOCKED: {reason}. AC1/AC2 live evidence remains incomplete.\n") })?;
    result
}
fn run_cases(live: &Live) -> Result<()> {
    let deny = live.fixture("deny", json!({"git":{"on_protected":"refuse"}}))?;
    live.bash_case(
        &deny,
        "deny",
        "git commit --allow-empty -m guard-deny",
        Some("deny"),
        false,
        false,
    )?;
    let ask = live.fixture("ask", json!({}))?;
    live.bash_case(
        &ask,
        "ask",
        "git commit --allow-empty -m guard-ask",
        Some("ask"),
        false,
        false,
    )?;
    let pass = live.fixture("pass", json!({"git":{"on_protected":"allow"}}))?;
    live.bash_case(
        &pass,
        "pass",
        "git commit --allow-empty -m guard-pass",
        None,
        true,
        false,
    )?;
    let push = live.fixture("push", json!({}))?;
    let remote = live.root.join("remote.git");
    fs::create_dir(&remote).map_err(|e| e.to_string())?;
    live.git(&remote, &["init", "--bare"])?;
    live.git(
        &push,
        &["remote", "add", "fixture", remote.to_str().unwrap()],
    )?;
    let before = live.git(&remote, &["for-each-ref"])?;
    live.bash_case(
        &push,
        "push",
        "git push fixture main",
        Some("ask"),
        false,
        false,
    )?;
    require(
        live.git(&remote, &["for-each-ref"])? == before,
        "push ask was mistaken for publication",
    )?;
    let silent = live.fixture("silent", json!({}))?;
    live.bash_case(&silent, "silent", "printf guard-silent", None, false, false)?;
    require(
        !silent.join(".planning/decisions.jsonl").exists(),
        "silent command wrote a decision",
    )?;
    let git_open = live.fixture("git-open", json!({}))?;
    live.bash_case(
        &git_open,
        "git-open",
        "git commit --allow-empty -m guard-git-open",
        None,
        true,
        true,
    )?;
    let torn = live.fixture("torn", json!({}))?;
    write(&torn.join(".planning/config.json"), b"{torn")?;
    live.bash_case(
        &torn,
        "torn",
        "git commit --allow-empty -m guard-torn",
        Some("ask"),
        false,
        false,
    )?;
    let deny_torn = live.fixture("deny-torn", json!({}))?;
    fs::create_dir(deny_torn.join("global")).map_err(|e| e.to_string())?;
    write(
        &deny_torn.join("global/config.json"),
        b"{\"git\":{\"on_protected\":\"refuse\"}}",
    )?;
    write(&deny_torn.join(".planning/config.json"), b"{torn")?;
    live.bash_case(
        &deny_torn,
        "deny-torn",
        "git commit --allow-empty -m guard-deny-torn",
        Some("deny"),
        false,
        false,
    )?;
    let hard = live.fixture("hard", json!({"git":{"guard_hard_fail":true}}))?;
    live.bash_case(
        &hard,
        "hard-git",
        "git commit --allow-empty -m guard-hard-git",
        Some("deny"),
        false,
        true,
    )?;
    write(&hard.join(".planning/config.v4.json"), b"{torn")?;
    live.bash_case(
        &hard,
        "hard-torn",
        "git commit --allow-empty -m guard-hard-torn",
        Some("deny"),
        false,
        true,
    )?;
    let state = hard.join(".planning/state.json");
    let before = fs::read(&state).map_err(|e| e.to_string())?;
    let instructions = format!(
        "Attempt Write with file_path {} and content guard-write-probe. Then Read that same file and attempt Edit on it replacing the first occurrence of state with guard-edit-probe (if state is absent, replace the first occurrence of version with guard-edit-probe). Use Write and Edit directly; do not perform shell writes. Both attempts are explicitly authorized probes of the native ownership hook.",
        state.display()
    );
    let events = live.launch(&hard, "ownership", &instructions, false)?;
    for tool in ["Write", "Edit"] {
        let id = attempt(&events, tool, "file_path", state.to_str().unwrap())?;
        require(
            hook_permission(hook_response(&events, &id, tool)?)?.as_deref() == Some("deny"),
            format!("{tool} ownership denial missing"),
        )?;
        require(
            tool_result(&events, &id)?["is_error"] == true,
            format!("{tool} tool refusal missing"),
        )?;
    }
    require(
        fs::read(&state).map_err(|e| e.to_string())? == before,
        "ownership probe changed native state",
    )?;
    append(
        &live.report,
        &format!(
            "  Verified real Write and Edit hook denials, tool refusals and unchanged state bytes, SHA-256 `{}`.\n",
            digest(&before)
        ),
    )?;
    Ok(())
}
