//! Genuine Claude Code host evidence for the phase 31 read boundary.
use super::phase31::{Client, ProcessFixture, approve, process_plan_submission};
use cadence::read::{measurement, model::DocumentIdentity};
use serde_json::{Value, json};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    io::Read,
    num::NonZeroU32,
    path::{Path, PathBuf},
    process::{Command, ExitStatus, Output, Stdio},
};

#[derive(Debug)]
struct Call {
    caller: String,
    arguments: Value,
    result: Value,
}

pub fn prove_worker_hosts_receive_main_thread_answers() {
    let fixture = host_fixture();
    let project = fixture.project();

    // A separate resident is the handwritten stdio oracle. Host workers never
    // use this connection, and every assertion below is made again on raw host
    // tool results rather than on either model's final prose.
    let mut oracle = Client::open(project);
    let oracle_answers = oracle_round(&mut oracle);
    let oracle_signature = assert_round("direct stdio oracle", &oracle_answers, None);
    let foreign_location = oracle_answers.iter().find(|call| call.arguments["operation"] == "search"
        && call.arguments["pattern"] == "fn beta").unwrap().result["hits"][0]["location"]
        .as_str().unwrap().to_owned();
    oracle.finish();

    // Codex is deliberately not a leg of this helper: the installed host's
    // workers launch another resident, so invoking one cannot prove T6.
    let evidence = run_claude(project, &foreign_location);
    assert!(evidence.output.status.success(),
        "Claude executable, authentication, transport, and worker execution are required; status={}\nstdout:\n{}\nstderr:\n{}",
        evidence.output.status, bounded_output(&evidence.output.stdout),
        bounded_output(&evidence.output.stderr));
    assert!(!evidence.events.is_empty(), "Claude emitted no JSON host evidence");
    assert_eq!(evidence.worker_ids.len(), 1,
        "Claude must dispatch one actual named worker, got {:?}; events={}",
        evidence.worker_ids, event_summary(&evidence.events));

    let calls = claude_calls(&evidence.events);
    let callers: BTreeSet<_> = calls.iter().map(|call| call.caller.as_str()).collect();
    assert!(callers.len() >= 2,
        "Claude did not expose distinct main/worker raw tool-result identities; calls={}",
        call_summary(&calls));
    let worker = evidence.worker_ids.iter().next().unwrap();
    let worker_calls: Vec<_> = calls.iter().filter(|call| call.caller == *worker).collect();
    let main_calls: Vec<_> = calls.iter().filter(|call| call.caller != *worker).collect();
    let main_signature = assert_round("Claude main thread", &main_calls, Some(&foreign_location));
    let worker_signature = assert_round("Claude named child", &worker_calls, Some(&foreign_location));
    assert_eq!(main_signature, oracle_signature, "Claude main thread differs from stdio oracle");
    assert_eq!(worker_signature, oracle_signature, "Claude named child differs from stdio oracle");

    let issued = main_calls.iter().find(|call| call.arguments["operation"] == "search"
        && call.arguments["pattern"] == "fn beta").unwrap().result["hits"][0]["location"]
        .as_str().unwrap();
    assert!(worker_calls.iter().any(|call| call.arguments == json!({"operation":"read","location":issued})
        && call.result["body"] == "fn beta() {\n    let needle = 3;\n}\n"),
        "Claude worker did not follow the main thread's issued location on the shared resident");
    let repeated: Vec<_> = main_calls.iter().filter(|call| call.arguments["operation"] == "search"
        && call.arguments["pattern"] == "fn beta").collect();
    assert!(repeated.len() >= 2 && stable_hits(&repeated[0].result) == stable_hits(&repeated[1].result),
        "Claude repeated main-thread search changed after worker use");

    let server_pids: BTreeSet<_> = evidence.processes.iter().filter_map(|(pid, command)|
        command.contains("cadence serve").then_some(pid)).collect();
    assert_eq!(server_pids.len(), 1,
        "Claude main and named child must share exactly one cadence serve: {:?}", evidence.processes);
}

#[derive(Debug)]
pub struct PlannerRound {
    pub session_id: String,
    pub first_turn: String,
    pub last_turn: String,
    pub worker_ids: Vec<String>,
    pub source_digest: String,
    pub read_count: u64,
    pub whole_file_reads: u64,
    pub unclassified_reads: u64,
    pub token_total: u64,
    pub report: String,
}

pub struct PlannerRoundFixture {
    client: Option<Client>,
    fixture: ProcessFixture,
}

impl PlannerRoundFixture {
    pub fn new() -> Self {
        let fixture = planner_fixture();
        let client = Client::open(fixture.project());
        Self { client: Some(client), fixture }
    }

    pub fn client(&mut self) -> &mut Client { self.client.as_mut().unwrap() }

    pub fn run(&self) -> PlannerRound {
        let evidence = run_claude_planner(self.fixture.project());
        assert!(evidence.output.status.success(),
            "Claude executable, authentication, transport, and planner worker are required; status={}\nstdout:\n{}\nstderr:\n{}",
            evidence.output.status, bounded_output(&evidence.output.stdout),
            bounded_output(&evidence.output.stderr));
        assert!(!evidence.events.is_empty(), "Claude emitted no JSON host evidence for the planner round");
        let session_ids: BTreeSet<_> = evidence.events.iter().filter_map(|event|
            event["session_id"].as_str().or_else(|| event["sessionId"].as_str()).map(str::to_owned)
        ).collect();
        assert_eq!(session_ids.len(), 1, "the planner host did not expose one actual session id: {}",
            event_summary(&evidence.events));
        inspect_planner_record(self.fixture.project(), session_ids.into_iter().next().unwrap())
    }

    pub fn finish(mut self) { self.client.take().unwrap().finish(); }
}

fn inspect_planner_record(project: &Path, session_id: String) -> PlannerRound {
    let project = fs::canonicalize(project).unwrap();
    let encoded: String = project.to_string_lossy().chars()
        .map(|character| if character.is_alphanumeric() || matches!(character, '-' | '_') {
            character
        } else {
            '-'
        }).collect();
    let host_root = PathBuf::from(std::env::var_os("HOME").expect("Claude HOME is required"))
        .join(".claude/projects").join(encoded);
    let main_path = host_root.join(format!("{session_id}.jsonl"));
    assert!(main_path.is_file(), "Claude did not persist the fixture session record for {session_id}");
    let main = json_lines(&fs::read(&main_path).unwrap(), "main planner record");
    let first_turn = main.iter().find(|record| record["type"] == "user")
        .and_then(|record| record["uuid"].as_str()).expect("planner record has no first user UUID").to_owned();
    let last_turn = main.iter().rev().find(|record| record["type"] == "assistant")
        .and_then(|record| record["uuid"].as_str()).expect("planner record has no final assistant UUID").to_owned();

    // The library computes the report in-process; the test then proves the
    // resident returns that same report through `document`.
    let identity = DocumentIdentity::PlannerRound {
        phase: NonZeroU32::new(31).unwrap(),
        session_id: session_id.clone(),
        first_turn: first_turn.clone(),
        last_turn: last_turn.clone(),
    };
    let report = measurement::resolve(&project.join(".planning"), &identity)
        .unwrap_or_else(|refusal| panic!("the planner round could not be measured: {refusal}"));
    PlannerRound { session_id, first_turn, last_turn, worker_ids: report.worker_ids,
        source_digest: report.revision, read_count: report.read_count,
        whole_file_reads: report.whole_file_reads, unclassified_reads: report.unclassified_reads,
        token_total: report.token_total, report: report.body }
}

fn json_lines(bytes: &[u8], label: &str) -> Vec<Value> {
    String::from_utf8_lossy(bytes).lines().enumerate().map(|(line, value)|
        serde_json::from_str(value).unwrap_or_else(|error| panic!("invalid {label} line {}: {error}", line + 1))
    ).collect()
}

fn stable_hits(answer: &Value) -> Vec<Value> {
    answer["hits"].as_array().unwrap().iter().map(|hit| json!({
        "file":hit["file"], "name":hit["name"], "kind":hit["kind"],
        "range":hit["range"], "match_lines":hit["match_lines"], "body":hit["body"],
        "body_truncated":hit["body_truncated"]
    })).collect()
}

fn bounded_output(bytes: &[u8]) -> String {
    String::from_utf8_lossy(&bytes[..bytes.len().min(4_096)]).into_owned()
}

fn event_summary(events: &[Value]) -> String {
    events.iter().filter_map(|event| {
        let item = event.get("item")?;
        Some(format!("{}:{}", item["type"].as_str().unwrap_or("?"),
            item["tool"].as_str().or_else(|| item["server"].as_str()).unwrap_or("?")))
    }).collect::<Vec<_>>().join(",")
}

fn call_summary(calls: &[Call]) -> String {
    calls.iter().map(|call| format!("{}:{}:{}", call.caller,
        call.arguments["operation"].as_str().unwrap_or("?"),
        call.result["status"].as_str().unwrap_or("?"))).collect::<Vec<_>>().join(",")
}

fn oracle_round(client: &mut Client) -> Vec<Call> {
    let mut calls = Vec::new();
    fn call(client: &mut Client, calls: &mut Vec<Call>, arguments: Value) {
        let result = client.call("cadence_query", arguments.clone());
        calls.push(Call { caller: "oracle".into(), arguments, result });
    }
    call(client, &mut calls, json!({"operation":"search","pattern":"fn beta","scope":{"kind":"directory","selector":"src"}}));
    let location = calls[0].result["hits"][0]["location"].clone();
    call(client, &mut calls, json!({"operation":"read","location":location}));
    call(client, &mut calls, json!({"operation":"search","pattern":"outline_needle","scope":{"kind":"directory","selector":"src"}}));
    let file = calls[2].result["hits"][0]["file_reference"].clone();
    call(client, &mut calls, json!({"operation":"read","file":file}));
    call(client, &mut calls, json!({"operation":"search","pattern":"first-marker","scope":{"kind":"directory","selector":"src"}}));
    let large = calls[4].result["hits"][0]["location"].clone();
    call(client, &mut calls, json!({"operation":"read","location":large}));
    while let Some(continuation) = calls.last().unwrap().result["continuation"].as_str().map(str::to_owned) {
        call(client, &mut calls, json!({"operation":"read","location":continuation}));
    }
    call(client, &mut calls, json!({"operation":"document","identity":{"kind":"phase-context","phase":31},"part":"truth:T4"}));
    call(client, &mut calls, json!({"operation":"read","location":"unissued-opaque-token"}));
    calls
}

fn assert_round(label: &str, calls: &[impl std::borrow::Borrow<Call>], foreign: Option<&str>) -> Value {
    let calls: Vec<_> = calls.iter().map(std::borrow::Borrow::borrow).collect();
    let summary = calls.iter().map(|call| format!("{}:{}:{}", call.caller,
        call.arguments["operation"].as_str().unwrap_or("?"),
        call.result["status"].as_str().unwrap_or("?"))).collect::<Vec<_>>().join(",");
    let find = |operation: &str, pattern: Option<&str>| calls.iter().find(|call| {
        call.arguments["operation"] == operation
            && pattern.is_none_or(|wanted| call.arguments["pattern"] == wanted)
    }).unwrap_or_else(|| panic!("{label} omitted {operation} {pattern:?}: {summary}"));
    let search = find("search", Some("fn beta"));
    assert_eq!(search.result["status"], "ok", "{label}: {summary}");
    assert_eq!(search.result["hits"][0]["name"], "beta", "{label}: {summary}");
    assert_eq!(search.result["hits"][0]["range"], json!([5, 7]), "{label}: {summary}");
    assert_eq!(search.result["hits"][0]["match_lines"], json!([5]), "{label}: {summary}");
    assert_eq!(search.result["hits"][0]["body"], "fn beta() {\n    let needle = 3;\n}\n");
    let own_location = search.result["hits"][0]["location"].as_str().unwrap();
    assert!(calls.iter().any(|call| call.arguments == json!({"operation":"read","location":own_location})
        && call.result["body"] == "fn beta() {\n    let needle = 3;\n}\n"),
        "{label} did not read its independently searched beta location");
    assert!(calls.iter().any(|call| call.arguments["operation"] == "read"
        && call.result["body"] == "fn beta() {\n    let needle = 3;\n}\n"), "{label} omitted the short slice");
    let outline = calls.iter().find(|call| call.arguments["operation"] == "read"
        && call.result["kind"] == "outline").unwrap_or_else(|| panic!("{label} omitted outline: {summary}"));
    assert_eq!(outline.result["rows"][0]["name"], "first_unit");
    assert_eq!(outline.result["rows"][0]["range"], json!([1, 3]));
    assert_eq!(outline.result["rows"][1]["name"], "second_unit");
    assert_eq!(outline.result["rows"][1]["range"], json!([2004, 2006]));
    let cut = calls.iter().find(|call| call.result["kind"] == "slice"
        && call.result["truncated"] == true).unwrap_or_else(|| panic!("{label} omitted cut slice: {summary}"));
    let mut cut_body = cut.result["body"].as_str().unwrap().to_owned();
    let mut continuation = cut.result["continuation"].as_str();
    let mut pages = 1;
    while let Some(location) = continuation {
        let next = calls.iter().find(|call| call.arguments == json!({"operation":"read","location":location}))
            .unwrap_or_else(|| panic!("{label} omitted continuation {location}: {summary}"));
        cut_body.push_str(next.result["body"].as_str().unwrap());
        continuation = next.result["continuation"].as_str();
        pages += 1;
    }
    assert_eq!(cut_body, oversized_source(), "{label} cut/continuation bytes differ");
    assert!(pages > 1, "{label} did not exercise continuation");
    assert!(calls.iter().any(|call| call.arguments["operation"] == "document"
        && call.result["body"] == "When the caller asks for the host truth, the caller gets HANDWRITTEN HOST PROCESS SLICE.\n"),
        "{label} omitted the process slice");
    assert!(calls.iter().any(|call| call.arguments["location"] == "unissued-opaque-token"
        && call.result["status"] == "refused" && call.result["code"] == "location-not-issued"
        && call.result["rule"] == "D-147"), "{label} omitted the named refusal");
    if let Some(foreign) = foreign {
        assert!(calls.iter().any(|call| call.arguments["location"] == foreign
            && call.result["status"] == "refused" && call.result["code"] == "location-not-issued"
            && call.result["rule"] == "D-147"), "{label} omitted the foreign-location refusal");
    }
    let outline_rows: Vec<_> = outline.result["rows"].as_array().unwrap().iter().map(|row| json!({
        "name": row["name"], "kind": row["kind"], "range": row["range"]
    })).collect();
    json!({
        "search": stable_hits(&search.result),
        "slice": "fn beta() {\n    let needle = 3;\n}\n",
        "outline": outline_rows,
        "cut": cut_body,
        "process": "When the caller asks for the host truth, the caller gets HANDWRITTEN HOST PROCESS SLICE.\n",
        "refusal": {"status":"refused","code":"location-not-issued","rule":"D-147"},
        "continuation_pages": pages
    })
}

struct Evidence {
    output: Output,
    events: Vec<Value>,
    worker_ids: BTreeSet<String>,
    processes: BTreeMap<u32, String>,
}

fn run_claude(project: &Path, foreign_location: &str) -> Evidence {
    install_named_claude_worker(project);
    let config = project.join(".host/claude-mcp.json");
    fs::write(&config, serde_json::to_vec(&json!({"mcpServers":{"cadence":{
        "command":env!("CARGO_BIN_EXE_cadence"),"args":["serve","--project-root",project]
    }}})).unwrap()).unwrap();
    let settings = project.join(".host/claude-settings.json");
    fs::write(&settings, b"{}\n").unwrap();
    let mut command = Command::new("claude");
    command.args(["--print","--output-format","stream-json","--verbose","--forward-subagent-text",
        "--strict-mcp-config","--mcp-config",config.to_str().unwrap(),
        "--settings",settings.to_str().unwrap(),
        "--tools","Agent,mcp__cadence__cadence_query","--dangerously-skip-permissions",
        "--permission-mode","bypassPermissions",
        "--no-session-persistence",&main_prompt(foreign_location)])
        .current_dir(project).stdin(Stdio::null());
    run_and_capture(command)
}

fn run_claude_planner(project: &Path) -> Evidence {
    install_named_claude_planner(project);
    let config = project.join(".host/claude-planner-mcp.json");
    fs::write(&config, serde_json::to_vec(&json!({"mcpServers":{"cadence":{
        "command":env!("CARGO_BIN_EXE_cadence"),"args":["serve","--project-root",project]
    }}})).unwrap()).unwrap();
    let settings = project.join(".host/claude-planner-settings.json");
    fs::write(&settings, b"{}\n").unwrap();
    let mut command = Command::new("claude");
    command.args(["--print","--output-format","stream-json","--verbose","--forward-subagent-text",
        "--strict-mcp-config","--mcp-config",config.to_str().unwrap(),
        "--settings",settings.to_str().unwrap(),
        "--tools","Agent,mcp__cadence__cadence_query","--dangerously-skip-permissions",
        "--permission-mode","bypassPermissions",planner_prompt()])
        .current_dir(project).stdin(Stdio::null());
    run_and_capture(command)
}

fn install_named_claude_worker(project: &Path) {
    let agents = project.join(".claude/agents");
    fs::create_dir_all(&agents).unwrap();
    let source = include_str!("../../../../agents/cad-assumptions-analyzer.md");
    let named = if source.contains("\nmcpServers:") {
        source.to_owned()
    } else {
        source.replacen("\nskills:\n", "\nmcpServers:\n  - cadence\nskills:\n", 1)
    };
    assert!(named.contains("\nmcpServers:\n  - cadence\n"), "named worker must reference the parent's cadence server");
    fs::write(agents.join("cad-assumptions-analyzer.md"), named).unwrap();

    let skills = project.join(".claude/skills");
    let repository_skills = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../skills");
    for skill in ["cad-assumptions-analyzer-contract", "cad-read-contract"] {
        let source = repository_skills.join(skill).join("SKILL.md");
        if source.is_file() {
            let target = skills.join(skill);
            fs::create_dir_all(&target).unwrap();
            fs::copy(source, target.join("SKILL.md")).unwrap();
        }
    }
}

fn install_named_claude_planner(project: &Path) {
    let agents = project.join(".claude/agents");
    fs::create_dir_all(&agents).unwrap();
    let source = include_str!("../../../../agents/cad-planner.md");
    assert!(source.contains("\nmcpServers:\n  - cadence\n"),
        "named planner must inherit the parent's cadence server");
    fs::write(agents.join("cad-planner.md"), source).unwrap();

    let skills = project.join(".claude/skills");
    let repository_skills = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../skills");
    for skill in ["cad-planner-contract", "cad-read-contract"] {
        let target = skills.join(skill);
        fs::create_dir_all(&target).unwrap();
        fs::copy(repository_skills.join(skill).join("SKILL.md"), target.join("SKILL.md")).unwrap();
    }
}

fn run_and_capture(mut command: Command) -> Evidence {
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = command.spawn().unwrap_or_else(|error| panic!("Claude executable is required: {error}"));
    let root_pid = child.id();
    let mut stdout = child.stdout.take().unwrap();
    let mut stderr = child.stderr.take().unwrap();
    let out_reader = std::thread::spawn(move || { let mut bytes = Vec::new(); stdout.read_to_end(&mut bytes).unwrap(); bytes });
    let err_reader = std::thread::spawn(move || { let mut bytes = Vec::new(); stderr.read_to_end(&mut bytes).unwrap(); bytes });
    let mut processes = BTreeMap::new();
    let status: ExitStatus = loop {
        sample_process_tree(root_pid, &mut processes);
        if let Some(status) = child.try_wait().unwrap() { break status }
        std::thread::sleep(std::time::Duration::from_millis(20));
    };
    let output = Output { status, stdout: out_reader.join().unwrap(), stderr: err_reader.join().unwrap() };
    let events: Vec<Value> = String::from_utf8_lossy(&output.stdout).lines()
        .filter_map(|line| serde_json::from_str(line).ok()).collect();
    let worker_ids = worker_ids(&events);
    Evidence { output, events, worker_ids, processes }
}

fn main_prompt(foreign_location: &str) -> String {
    format!(r#"Use only the configured cadence MCP server and the Agent worker mechanism. Do not use filesystem, shell, web, or final-answer reconstruction for project content.
1. On the main thread call cadence_query search for `fn beta` in directory scope `src`, then read its issued location. Call search for `outline_needle` in `src` and read the issued file_reference for its outline. Call search for `first-marker` in `src` and read its issued location for the cut slice. Call document for phase-context 31 part truth:T4. Call read with location `unissued-opaque-token`.
2. Call the Agent tool with subagent_type `cad-assumptions-analyzer` and a prompt containing the exact beta location from step 1. Wait for that foreground Agent call to return. Tell the named child to first read the exact handed-off beta location, then independently perform the beta search/read, outline, cut, document, unknown-token refusal, and foreign-location refusal through its inherited cadence_query connection. It must follow every cut continuation until complete. The foreign location is `{foreign_location}`.
3. After the worker returns, on the main thread follow every cut continuation until complete, call read with the foreign location `{foreign_location}`, repeat the `fn beta` search, and then stop. Tool results are the evidence; do not summarize their content."#)
}

fn planner_prompt() -> &'static str {
    r#"Launch the project-scoped named `cad-planner` child agent in the foreground. The child must use only the inherited configured cadence MCP server: no filesystem tools, shell commands, web calls, guessed paths, or final-answer reconstruction for project content. Ask it to inspect phase 31's native context and all three existing native plans through context-intake, plan-read, evidence-read, and document identities; inspect the known Rust, JavaScript, Markdown, JSON, and C source units through search and reads at issued locations, including the large Rust outline; then author a small real fourth-plan proposal in its response. It must stop before owner approval or publication and must not call cadence_apply. Wait for the named child to finish, then stop. The actual tool records are the measurement; do not repeat the child's project reads on the main thread."#
}

// The host parser accepts only actual emitted tool events. It never accepts
// an assistant text block as evidence.
fn claude_calls(events: &[Value]) -> Vec<Call> {
    let mut pending: BTreeMap<String, (String, Value)> = BTreeMap::new();
    let mut calls = Vec::new();
    for event in events {
        let caller = event["parent_tool_use_id"].as_str()
            .or_else(|| event["session_id"].as_str()).unwrap_or("main").to_owned();
        if let Some(content) = event.pointer("/message/content").and_then(Value::as_array) {
            for block in content {
                if block["type"] == "tool_use" && block["name"] == "mcp__cadence__cadence_query" {
                    pending.insert(block["id"].as_str().unwrap().to_owned(), (caller.clone(), block["input"].clone()));
                }
                if block["type"] == "tool_result"
                    && let Some((caller, arguments)) = block["tool_use_id"].as_str()
                        .and_then(|id| pending.remove(id))
                    && let Some(result) = tool_result_value(block)
                {
                    calls.push(Call { caller, arguments, result });
                }
            }
        }
    }
    calls
}

fn tool_result_value(block: &Value) -> Option<Value> {
    if block["content"].is_object() { return Some(block["content"].clone()); }
    let text = block["content"].as_str().map(str::to_owned).or_else(|| block["content"].as_array().map(|parts| {
        parts.iter().filter_map(|part| part["text"].as_str()).collect::<String>()
    }))?;
    serde_json::from_str(&text).ok()
}

fn worker_ids(events: &[Value]) -> BTreeSet<String> {
    let mut ids = BTreeSet::new();
    for event in events {
        if let Some(id) = event["parent_tool_use_id"].as_str() { ids.insert(id.to_owned()); }
    }
    ids
}

fn sample_process_tree(root: u32, found: &mut BTreeMap<u32, String>) {
    let mut parents = BTreeMap::new();
    let Ok(entries) = fs::read_dir("/proc") else { return };
    for entry in entries.flatten() {
        let Some(pid) = entry.file_name().to_str().and_then(|name| name.parse::<u32>().ok()) else { continue };
        let Ok(stat) = fs::read_to_string(entry.path().join("stat")) else { continue };
        let Some(after_name) = stat.rsplit_once(") ").map(|(_, tail)| tail) else { continue };
        let Some(ppid) = after_name.split_whitespace().nth(1).and_then(|value| value.parse::<u32>().ok()) else { continue };
        parents.insert(pid, ppid);
    }
    for &pid in parents.keys() {
        let mut cursor = pid;
        let mut descendant = pid == root;
        for _ in 0..64 {
            if descendant || cursor == 0 { break }
            cursor = parents.get(&cursor).copied().unwrap_or(0);
            descendant = cursor == root;
        }
        if descendant {
            let bytes = fs::read(format!("/proc/{pid}/cmdline")).unwrap_or_default();
            let command = String::from_utf8_lossy(&bytes).replace('\0', " ");
            // A child that has already exited reads back an empty command line;
            // a later sample must not erase the one taken while it was alive.
            let seen = found.entry(pid).or_default();
            if seen.is_empty() { *seen = command; }
        }
    }
}

fn host_fixture() -> ProcessFixture {
    let fixture = ProcessFixture::new();
    let project = fixture.project();
    fs::create_dir_all(project.join(".host")).unwrap();
    fs::write(project.join("src/units.rs"), "fn alpha() {\n    let needle = 1;\n}\n\nfn beta() {\n    let needle = 3;\n}\n").unwrap();
    fs::write(project.join("src/units.js"), "function javascriptUnit() {\n  const needle = 1;\n}\n").unwrap();
    fs::write(project.join("docs/units.md"), "# Markdown unit\nneedle\n").unwrap();
    fs::write(project.join("src/units.json"), "{\n  \"jsonUnit\": \"needle\"\n}\n").unwrap();
    fs::write(project.join("src/units.c"), "int c_unit(void) {\n  int needle = 1;\n  return needle;\n}\n").unwrap();
    fs::create_dir_all(project.join("ignored")).unwrap();
    fs::write(project.join("ignored/sentinel.rs"), "fn ignored() { let needle = 0; }\n").unwrap();
    fs::write(project.join(".gitignore"), ".planning/\n.fixture-gnupg/\n.host/\n.claude/\nignored/\n").unwrap();
    let padding = "// outline padding\n".repeat(2_000);
    fs::write(project.join("src/outline.rs"), format!(
        "fn first_unit() {{\n    let outline_needle = 1;\n}}\n{padding}fn second_unit() {{\n    let outline_needle = 2;\n}}\n")).unwrap();
    fs::write(project.join("src/oversized.rs"), oversized_source()).unwrap();

    let mut client = Client::open(project);
    let context = client.call("cadence_apply", approve(json!({"operation":"context-submit","submission":{
        "phase":31,"title":"Host read boundary","scope":"A genuine worker host fixture.",
        "durable_decisions":[],"decisions":[],"assumptions":[],"truths":[{
            "id":"T4","trigger":"the caller asks for the host truth","observer":"the caller",
            "verb":"gets","outcome":"HANDWRITTEN HOST PROCESS SLICE","kind":"property",
            "observable":true,"fixed_oracle":true}]}})));
    assert_eq!(context["persisted"], true, "{context}");
    let allocation = client.call("cadence_query", json!({"operation":"plan-read","phase":"31","count":2}));
    let preview_request = process_plan_submission(&allocation, "HOST PLAN SELECTED TASK\n");
    let preview = client.call("cadence_query", json!({"operation":"plan-read","phase":"31",
        "submission":preview_request["submission"]}));
    let published = client.call("cadence_apply", approve(json!({"operation":"plan-submit",
        "submission":preview["submission"]})));
    assert_eq!(published["persisted"], true, "{published}");
    client.finish();
    fixture
}

fn planner_fixture() -> ProcessFixture {
    let fixture = ProcessFixture::new();
    let project = fixture.project();
    fs::create_dir_all(project.join(".host")).unwrap();
    fs::write(project.join("src/units.rs"), "fn alpha() {\n    let needle = 1;\n}\n\nfn beta() {\n    let needle = 3;\n}\n").unwrap();
    fs::write(project.join("src/units.js"), "function javascriptUnit() {\n  const needle = 1;\n}\n").unwrap();
    fs::write(project.join("docs/units.md"), "# Markdown unit\nneedle\n").unwrap();
    fs::write(project.join("src/units.json"), "{\n  \"jsonUnit\": \"needle\"\n}\n").unwrap();
    fs::write(project.join("src/units.c"), "int c_unit(void) {\n  int needle = 1;\n  return needle;\n}\n").unwrap();
    fs::create_dir_all(project.join("ignored")).unwrap();
    fs::write(project.join("ignored/sentinel.rs"), "fn ignored() { let needle = 0; }\n").unwrap();
    fs::write(project.join("outside-sentinel.txt"), "this source is outside the planner scope\n").unwrap();
    fs::write(project.join(".gitignore"),
        ".planning/\n.fixture-gnupg/\n.host/\n.claude/\nignored/\noutside-sentinel.txt\n").unwrap();
    let padding = "// outline padding\n".repeat(2_000);
    fs::write(project.join("src/outline.rs"), format!(
        "fn first_unit() {{\n    let outline_needle = 1;\n}}\n{padding}fn second_unit() {{\n    let outline_needle = 2;\n}}\n")).unwrap();
    assert!(fs::metadata(project.join("src/outline.rs")).unwrap().len() > 24_576);

    let mut client = Client::open(project);
    let context = client.call("cadence_apply", approve(json!({"operation":"context-submit","submission":{
        "phase":31,"title":"Measured planner fixture","scope":"Plan a bounded source-unit report.",
        "durable_decisions":[],"decisions":[],"assumptions":[],"truths":[{
            "id":"T7","trigger":"the fixture phase closes","observer":"the fixture owner",
            "verb":"sees","outcome":"the measured planner round", "kind":"property",
            "observable":true,"fixed_oracle":true}]}})));
    assert_eq!(context["persisted"], true, "{context}");
    let allocation = client.call("cadence_query", json!({"operation":"plan-read",
        "phase":"31","count":3}));
    let mut request = process_plan_submission(&allocation, "MEASURED PLAN TWO TASK\n");
    request["submission"]["plans"].as_array_mut().unwrap().push(json!({
        "target":allocation["targets"][2],"content":{"phase":31,"plan":3,"requirements":["T7"],
        "files":["src/units.rs"],"directories":[],
        "execution":{"schema":1,"suite":"python3 -B tests/tiny.py","tasks":[{
            "id":"fixture-three-a","verify":["python3 -B tests/tiny.py"]}]},
        "body":"# Fixture plan three\n\n## Goal\n\nPLAN THREE GOAL SENTINEL\n\n## Tasks\n\n### Task 1: Third fixture task\n\nPLAN THREE SOURCE UNIT TASK\n",
        "evidence_map":{"mode":"attached","items":[{
            "kind":"artifact","id":"fixture/artifact-three",
            "reason":"The third plan gives the live planner prior native process material.",
            "spec":{"locators":["src/units.rs"],"substance":"A third binary-rendered fixture plan."},
            "associations":[{"truth_id":"T7","truth_version":1,
                "reason":"The planner round follows three already-published plans."}]
        }]}}
    }));
    // The reused helper's check is associated with T4; update those authored
    // fixture identifiers before the public preview so the native T7 authority
    // remains the only source of truth.
    for plan in request["submission"]["plans"].as_array_mut().unwrap() {
        plan["content"]["requirements"] = json!(["T7"]);
        for item in plan["content"]["evidence_map"]["items"].as_array_mut().unwrap() {
            for association in item["associations"].as_array_mut().unwrap() {
                association["truth_id"] = json!("T7");
            }
        }
    }
    let preview = client.call("cadence_query", json!({"operation":"plan-read","phase":"31",
        "submission":request["submission"]}));
    assert_eq!(preview["status"], "ok", "{preview}");
    let published = client.call("cadence_apply", approve(json!({"operation":"plan-submit",
        "submission":preview["submission"]})));
    assert_eq!(published["persisted"], true, "{published}");
    assert_eq!(published["results"].as_array().unwrap().len(), 3, "{published}");
    client.finish();
    fixture
}

fn oversized_source() -> String {
    format!("fn oversized() {{\n    // first-marker {} last-marker\n}}\n", "é".repeat(40_000))
}
