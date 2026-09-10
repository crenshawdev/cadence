//! Acceptance checks cross the real stdio, policy, journal and filesystem boundary.
use cadence::store::{
    model::{self, Snapshot},
    writer::{Operation, Store},
};
use serde_json::{Value, json};
use std::{
    collections::BTreeMap,
    fs,
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
};

struct Client {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<std::process::ChildStdout>,
}

impl Client {
    fn open(project: &Path) -> Self {
        let mut child = Command::new(env!("CARGO_BIN_EXE_cadence"))
            .args(["serve", "--project-root", project.to_str().unwrap()])
            .env("CADENCE_GLOBAL_CONFIG", "")
            .current_dir(project)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .unwrap();
        let mut client = Self {
            stdin: child.stdin.take().unwrap(),
            stdout: BufReader::new(child.stdout.take().unwrap()),
            child,
        };
        client.send(
            json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{
            "protocolVersion":"2025-06-18","capabilities":{},
            "clientInfo":{"name":"phase27-check","version":"1"}}}),
        );
        assert!(client.recv()["result"]["serverInfo"].is_object());
        client.send(json!({"jsonrpc":"2.0","method":"notifications/initialized"}));
        client
    }
    fn send(&mut self, value: Value) {
        writeln!(self.stdin, "{value}").unwrap();
        self.stdin.flush().unwrap();
    }
    fn recv(&mut self) -> Value {
        let mut line = String::new();
        assert!(self.stdout.read_line(&mut line).unwrap() > 0);
        serde_json::from_str(&line).unwrap()
    }
    fn call(&mut self, tool: &str, arguments: Value) -> Value {
        self.send(json!({"jsonrpc":"2.0","id":2,"method":"tools/call",
            "params":{"name":tool,"arguments":arguments}}));
        let response = self.recv();
        assert!(response.get("error").is_none(), "{response}");
        assert_ne!(response["result"]["isError"], true, "{response}");
        let result = response["result"]["structuredContent"].clone();
        let text: String = response["result"]["content"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|b| b["type"] == "text")
            .map(|b| b["text"].as_str().unwrap())
            .collect();
        assert_eq!(result, serde_json::from_str::<Value>(&text).unwrap());
        result
    }
    fn read(&mut self, phase: &str, count: Option<u32>) -> Value {
        self.call(
            "cadence_query",
            json!({"operation":"plan-read","phase_address":phase,"count":count}),
        )
    }
    fn finish(mut self) {
        drop(self.stdin);
        assert!(self.child.wait().unwrap().success());
    }
}

fn approve(mut request: Value) -> Value {
    request["approval"] = json!({"approved":true,"owner":"John Crenshaw",
        "at":"2026-09-10T14:00:00Z","submission":request["submission"].clone()});
    request
}

fn fixture() -> tempfile::TempDir {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join(".planning");
    fs::create_dir_all(root.join("phases/27")).unwrap();
    fs::write(
        root.join("ROADMAP.md"),
        "## Phases\n- [ ] **Phase 27: Plan publication**\n- [ ] **Phase 28: Next phase**\n",
    )
    .unwrap();
    fs::write(
        root.join("config.json"),
        serde_json::to_vec(&json!({"review":{"triggers":{
        "risk_surface":{"surfaces":cadence::rail::risk::CATEGORIES}}}}))
        .unwrap(),
    )
    .unwrap();
    temp
}

fn native_context(project: &Path, phase: u32) {
    let mut client = Client::open(project);
    let answer = client.call(
        "cadence_apply",
        approve(json!({"operation":"context-submit","submission":{
        "phase":phase,"title":"Plan publication","scope":"Approved plans only.",
        "durable_decisions":[],"decisions":[],"assumptions":[],
        "truths":[{"id":"T1","trigger":"the owner approves a plan","observer":"the owner",
            "verb":"sees","outcome":"the approved content at its identity","kind":"property",
            "observable":true,"fixed_oracle":true}]}})),
    );
    assert_eq!(answer["persisted"], true, "native context setup: {answer}");
    client.finish();
}

fn request(preview: &Value, phase: u32, id: &str, bodies: &[&str]) -> Value {
    json!({"operation":"plan-submit","submission":{
        "phase":phase,"occurrence":preview["occurrence"],"request_id":id,
        "inventory_basis":preview["inventory"]["basis"],
        "plans":bodies.iter().enumerate().map(|(i,body)| json!({
            "target":preview["targets"][i],"content":{
                "phase":phase,"plan":preview["targets"][i]["plan"],
                "requirements":["T1"],"files":["src/shared.txt"],"directories":["src/extra"],
                "execution":{"schema":1,"suite":"printf suite","tasks":[{"id":"task-1","verify":["printf verified"]}]},
                "body":body}})).collect::<Vec<_>>()}})
}

fn snapshot(project: &Path) -> Snapshot {
    let root = project.join(".planning");
    Snapshot::parse(
        &fs::read(root.join(model::STATE)).unwrap(),
        &fs::read(root.join(model::ITEMS)).unwrap(),
        &fs::read(root.join(model::DECISIONS)).unwrap(),
    )
    .unwrap()
}

fn tree(project: &Path) -> BTreeMap<PathBuf, Option<Vec<u8>>> {
    fn visit(base: &Path, path: &Path, found: &mut BTreeMap<PathBuf, Option<Vec<u8>>>) {
        let meta = fs::symlink_metadata(path).unwrap();
        let relative = path.strip_prefix(base).unwrap().to_path_buf();
        if meta.file_type().is_symlink() {
            found.insert(
                relative,
                Some(
                    fs::read_link(path)
                        .unwrap()
                        .as_os_str()
                        .as_encoded_bytes()
                        .to_vec(),
                ),
            );
        } else if meta.is_dir() {
            found.insert(relative, None);
            for entry in fs::read_dir(path).unwrap() {
                visit(base, &entry.unwrap().path(), found);
            }
        } else {
            found.insert(relative, Some(fs::read(path).unwrap()));
        }
    }
    let mut found = BTreeMap::new();
    visit(project, &project.join(".planning"), &mut found);
    if project.join(".planning/state.json").exists() {
        snapshot(project);
    }
    found
}

fn reopened(project: &Path) -> cadence::store::writer::View {
    // Inspect the journal before a writer can perform recovery.
    assert!(!project.join(".planning/.store-intent.json").exists());
    snapshot(project);
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let store = Store::open(
            cadence::store::filesystem::Filesystem::new(project.join(".planning")).unwrap(),
            cadence::store::writer::PlanningPolicy,
        )
        .await
        .unwrap();
        store.request(Operation::ReadVerified).await.unwrap()
    })
}

fn git(project: &Path, args: &[&str]) {
    let result = Command::new("git")
        .arg("-C")
        .arg(project)
        .args(args)
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(
        result.status.success(),
        "git {args:?}: {}",
        String::from_utf8_lossy(&result.stderr)
    );
}

fn execution_authority(project: &Path) {
    fs::create_dir(project.join("src")).unwrap();
    fs::write(project.join("src/shared.txt"), "Initial content.\n").unwrap();
    git(project, &["init", "-q"]);
    git(project, &["add", "src/shared.txt"]);
    git(
        project,
        &[
            "-c",
            "user.name=John Crenshaw",
            "-c",
            "user.email=john@jcrenshaw.dev",
            "-c",
            "user.signingkey=693AB15F91734B0C",
            "commit",
            "-S",
            "-qm",
            "test(27): fixture source",
        ],
    );
    let planning = project.join(".planning");
    let mut record = json!({"version":1,"scope":{
        "project":project,"planning_root":planning,"cycle":"live","occurrence":"phase-27-execution",
        "phase":"27","plan":"native-execution","report":"phases/27/SUMMARY.md"},
        "fact":{"kind":"gate","value":{"id":"fixture-progress","purpose":"progress","checkpoint_id":null,
            "question":"Continue?","need":"Execution authority","options":[],"state":{"status":"unanswered"}}}});
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let factory = cadence::import::SessionFactory::new(
            None,
            std::sync::Arc::new(cadence::config::planning_policy),
        );
        let session = factory.first_touch(&planning).await.unwrap();
        for (index, state) in [
            json!({"status":"unanswered"}),
            json!({"status":"answered","value":{
            "question_id":"fixture-progress","actual_response":"Proceed","selected_option":null,
            "adjustment":null,"disposition":"approve","authorization_id":"fixture-authorization"}}),
        ]
        .into_iter()
        .enumerate()
        {
            record["fact"]["value"]["state"] = state;
            let native: cadence::evidence::Record = serde_json::from_value(record.clone()).unwrap();
            let view = session.request(Operation::ReadVerified).await.unwrap();
            session
                .commit_evidence(&view, &format!("fixture-authority-{index}"), &native)
                .await
                .unwrap();
        }
    });
}

#[test]
fn phase27_approved_plan_is_published_at_returned_identity() {
    for body in [
        "# Plan café\n\n## Evidence map\nOpaque **T1** → 日本語.\n",
        "# Plan café\r\n\r\n## Evidence map\r\nOpaque `T1` → 日本語.",
        "## Evidence map\n\n- Preserve this final newline.\n\n",
    ] {
        let temp = fixture();
        let project = temp.path();
        native_context(project, 27);
        execution_authority(project);
        let before = tree(project);
        let prior = snapshot(project);
        let mut client = Client::open(project);
        let preview = client.read("27", Some(1));
        assert_eq!(preview["status"], "ok", "{preview}");
        assert_eq!(preview["targets"], json!([{"phase":27,"plan":1}]));
        assert_eq!(preview["native_truths_approved"], true);
        assert!(preview["contract"].is_object());
        let draft = request(&preview, 27, "first-publication", &[body]);
        for approval in [Value::Null, json!({"approved":false})] {
            let mut input = draft.clone();
            input["approval"] = approval;
            let answer = client.call("cadence_apply", input);
            assert_eq!(answer["persisted"], false, "{answer}");
            assert_eq!(tree(project), before);
        }
        let approved = approve(draft);
        let mut changed = approved.clone();
        changed["submission"]["plans"][0]["content"]["body"] = json!("Unapproved edit");
        let answer = client.call("cadence_apply", changed);
        assert_eq!(answer["rule"], "exact-submission-approval", "{answer}");
        assert_eq!(tree(project), before);
        let answer = client.call("cadence_apply", approved.clone());
        assert_eq!(
            answer["status"], "ok",
            "approved plan must publish: {answer}"
        );
        assert_eq!(answer["persisted"], true);
        assert_eq!(
            answer["results"][0]["identity"],
            json!({"phase":27,"plan":1})
        );
        assert_eq!(answer["results"][0]["readiness"], "provisional-authoring");
        let readback = client.read("27", None);
        assert_eq!(
            readback["native"]["publications"]["1"]["content"],
            approved["submission"]["plans"][0]["content"]
        );
        assert_eq!(readback["readiness"], "provisional-authoring");
        let execution = client.call(
            "cadence_query",
            json!({"operation":"execute-next","phase":27}),
        );
        assert_eq!(execution["status"], "refused", "{execution}");
        assert_eq!(execution["code"], "provisional-authoring", "{execution}");
        assert!(
            execution["reason"]
                .as_str()
                .unwrap()
                .contains("phase 27 plan 1")
        );
        assert!(execution.get("dispatch").is_none());
        client.finish();
        let bytes = fs::read(project.join(".planning/phases/27/PLAN-1.md")).unwrap();
        let parsed = cadence::execution::plan::parse_plan(&bytes, 27, 1).unwrap();
        assert_eq!(parsed.body.as_bytes(), body.as_bytes());
        assert_eq!(parsed.requirements, ["T1"]);
        assert_eq!(parsed.files, ["src/shared.txt"]);
        assert_eq!(parsed.directories, ["src/extra"]);
        assert_eq!(parsed.schema, 1);
        assert_eq!(parsed.suite, "printf suite");
        assert_eq!(parsed.tasks[0].id, "task-1");
        assert_eq!(parsed.tasks[0].verify, ["printf verified"]);
        let view = reopened(project);
        let occurrence = &view.snapshot.data["plan_publications"]["phases"]["27"];
        let saved = &occurrence["publications"]["1"];
        assert_eq!(saved["approval"], approved["approval"]);
        assert_eq!(
            saved["content"],
            approved["submission"]["plans"][0]["content"]
        );
        assert_eq!(saved["occurrence"], preview["occurrence"]);
        assert_eq!(saved["revision"], answer["results"][0]["revision"]);
        assert_eq!(saved["revision"].as_str().unwrap().len(), 64);
        assert_eq!(saved["history"], json!([saved["revision"]]));
        assert_eq!(occurrence["high_water"], 1);
        assert_eq!(occurrence["consumed"], json!([1]));
        assert_eq!(
            occurrence["receipts"]["first-publication"]["results"],
            answer["results"]
        );
        for key in ["context", "evidence", "import", "source_evidence"] {
            assert_eq!(
                view.snapshot.data.get(key),
                prior.data.get(key),
                "prior {key} preserved"
            );
        }
        assert!(view.snapshot.data["execution"]["occurrences"]["27"]["active"].is_null());
    }

    for context_phase in [None, Some(28)] {
        let temp = fixture();
        fs::write(
            temp.path().join(".planning/phases/27/CONTEXT.md"),
            "# Handwritten approval is not native approval\n",
        )
        .unwrap();
        if let Some(phase) = context_phase {
            native_context(temp.path(), phase);
        }
        let before = tree(temp.path());
        let mut client = Client::open(temp.path());
        let preview = client.read("27", Some(1));
        assert_eq!(preview["native_truths_approved"], false);
        assert_eq!(preview["next"], "context-intake");
        let answer = client.call(
            "cadence_apply",
            approve(request(&preview, 27, "no-truths", &["# Draft\n"])),
        );
        assert_eq!(answer["status"], "refused", "{answer}");
        assert_eq!(answer["rule"], "native-approved-truths");
        assert!(
            answer["reason"]
                .as_str()
                .unwrap()
                .contains("context-submit")
        );
        client.finish();
        assert_eq!(tree(temp.path()), before);
    }

    let pending = fixture();
    native_context(pending.path(), 27);
    fs::write(
        pending.path().join(".planning/.store-intent.json"),
        b"{\"retained\":\"pending owner work\"}\n",
    )
    .unwrap();
    let before = tree(pending.path());
    let mut client = Client::open(pending.path());
    let preview = client.read("27", Some(1));
    let answer = client.call(
        "cadence_apply",
        request(&preview, 27, "draft", &["Draft\r\n"]),
    );
    assert_eq!(answer["persisted"], false);
    client.finish();
    assert_eq!(
        tree(pending.path()),
        before,
        "draft must not recover a retained intent"
    );

    // Independently handwritten strict-schema legacy input proves that the
    // owner-input fixture reaches actual dispatch when native ownership is absent.
    let legacy = fixture();
    native_context(legacy.path(), 27);
    fs::write(legacy.path().join(".planning/phases/27/PLAN-1.md"),
        "---\nphase: 27\nplan: 1\nrequirements: [T1]\nfiles: [src/shared.txt]\ndirectories: [src/extra]\nexecution:\n  schema: 1\n  suite: printf suite\n  tasks:\n    - id: task-1\n      verify: [printf verified]\n---\n## Evidence map\nLegacy opaque map.\n").unwrap();
    execution_authority(legacy.path());
    let mut client = Client::open(legacy.path());
    let read = client.read("27", None);
    assert!(read["native"].is_null());
    assert_eq!(read["legacy_readiness"], "legacy-input");
    let answer = client.call(
        "cadence_query",
        json!({"operation":"execute-next","phase":27}),
    );
    assert_eq!(
        answer["status"], "ok",
        "otherwise-dispatchable fixture prerequisite: {answer}"
    );
    assert_eq!(
        answer["outcome"], "dispatch",
        "otherwise-dispatchable fixture prerequisite: {answer}"
    );
    client.finish();
    let view = reopened(legacy.path());
    assert!(view.snapshot.data.get("plan_publications").is_none());
    assert_eq!(
        view.snapshot.data["execution"]["occurrences"]["27"]["active"]["plan"],
        1
    );
}

#[test]
fn phase27_identity_mismatch_is_refused() {
    let temp = fixture();
    let project = temp.path();
    native_context(project, 27);
    native_context(project, 28);
    let mut client = Client::open(project);
    let preview = client.read("27", Some(1));
    let winner = client.call(
        "cadence_apply",
        approve(request(&preview, 27, "winner", &["# Keep the winner\n"])),
    );
    assert_eq!(winner["persisted"], true, "{winner}");
    client.finish();
    let before = tree(project);
    for (phase, plan) in [(28, 2), (27, 1)] {
        let mut client = Client::open(project);
        let preview = client.read("27", Some(1));
        assert_eq!(preview["targets"], json!([{"phase":27,"plan":2}]));
        let mut input = request(&preview, 27, "mismatch", &["# Refuse this copy\n"]);
        input["submission"]["plans"][0]["content"]["phase"] = json!(phase);
        input["submission"]["plans"][0]["content"]["plan"] = json!(plan);
        let answer = client.call("cadence_apply", approve(input));
        assert_eq!(answer["status"], "refused", "{answer}");
        assert_eq!(
            answer["rule"], "identity-mismatch",
            "mismatch must be a typed plan refusal: {answer}"
        );
        let reason = answer["reason"].as_str().unwrap();
        assert!(
            reason.contains(&format!("phase {phase} plan {plan}")),
            "{answer}"
        );
        assert!(reason.contains("phase 27 plan 2"), "{answer}");
        client.finish();
        assert_eq!(
            tree(project),
            before,
            "no file, allocation or prior record changes"
        );
    }
    let mut client = Client::open(project);
    let preview = client.read("27", Some(1));
    let answer = client.call(
        "cadence_apply",
        approve(request(
            &preview,
            27,
            "matching",
            &["# Matching approval\n"],
        )),
    );
    assert_eq!(answer["persisted"], true, "{answer}");
    assert_eq!(
        answer["results"][0]["identity"],
        json!({"phase":27,"plan":2})
    );
    client.finish();
    let view = reopened(project);
    assert_eq!(
        view.snapshot.data["plan_publications"]["phases"]["27"]["publications"]["1"]["content"]["body"],
        "# Keep the winner\n"
    );
    assert_eq!(
        cadence::execution::plan::parse_plan(
            &fs::read(project.join(".planning/phases/27/PLAN-2.md")).unwrap(),
            27,
            2
        )
        .unwrap()
        .body,
        "# Matching approval\n"
    );
}

#[test]
fn phase27_out_of_phase_target_is_refused() {
    let temp = fixture();
    let project = temp.path();
    native_context(project, 27);
    let outside = project.join("sentinel.md");
    fs::write(&outside, "Outside sentinel café\n").unwrap();
    fs::create_dir_all(project.join(".planning/phases/28")).unwrap();
    fs::write(
        project.join(".planning/phases/28/PLAN-1.md"),
        "Other phase sentinel\n",
    )
    .unwrap();
    let before = tree(project);
    for path in [
        "../sentinel.md".to_owned(),
        outside.to_string_lossy().into_owned(),
        "phases/28/PLAN-1.md".to_owned(),
    ] {
        let mut client = Client::open(project);
        let preview = client.read("27", Some(1));
        let mut input = approve(request(&preview, 27, "unsafe-path", &["# Safe body\n"]));
        input["destination"] = json!(path);
        let answer = client.call("cadence_apply", input);
        assert_eq!(answer["status"], "refused", "{answer}");
        assert_eq!(
            answer["rule"], "path-confinement",
            "forbidden destination must name confinement: {answer}"
        );
        assert!(
            answer["reason"].as_str().unwrap().contains(&path),
            "{answer}"
        );
        client.finish();
        assert_eq!(tree(project), before);
        assert_eq!(
            fs::read(&outside).unwrap(),
            b"Outside sentinel caf\xc3\xa9\n"
        );
    }
    for ancestor in [false, true] {
        let mut client = Client::open(project);
        let preview = client.read("27", Some(1));
        let input = approve(request(&preview, 27, "symlink-target", &["# Safe body\n"]));
        let target = project.join(if ancestor {
            ".planning/phases/27"
        } else {
            ".planning/phases/27/PLAN-1.md"
        });
        let moved = project.join("outside-phase");
        if ancestor {
            fs::rename(&target, &moved).unwrap();
            std::os::unix::fs::symlink(&moved, &target).unwrap();
        } else {
            std::os::unix::fs::symlink(&outside, &target).unwrap();
        }
        let unsafe_before = tree(project);
        let answer = client.call("cadence_apply", input);
        assert_eq!(answer["status"], "refused", "{answer}");
        assert_eq!(answer["rule"], "path-confinement", "{answer}");
        assert!(
            answer["reason"]
                .as_str()
                .unwrap()
                .contains(target.to_str().unwrap()),
            "{answer}"
        );
        client.finish();
        assert_eq!(tree(project), unsafe_before);
        assert_eq!(
            fs::read(&outside).unwrap(),
            b"Outside sentinel caf\xc3\xa9\n"
        );
        assert!(!moved.join("PLAN-1.md").exists());
        fs::remove_file(&target).unwrap();
        if ancestor {
            fs::rename(&moved, &target).unwrap();
        }
    }
    let mut client = Client::open(project);
    let preview = client.read("27", Some(1));
    let answer = client.call(
        "cadence_apply",
        approve(request(&preview, 27, "safe-canonical", &["# Safe body\n"])),
    );
    assert_eq!(answer["persisted"], true, "{answer}");
    client.finish();
    let view = reopened(project);
    assert_eq!(
        view.snapshot.data["plan_publications"]["phases"]["27"]["high_water"],
        1
    );
    assert_eq!(
        cadence::execution::plan::parse_plan(
            &fs::read(project.join(".planning/phases/27/PLAN-1.md")).unwrap(),
            27,
            1
        )
        .unwrap()
        .body,
        "# Safe body\n"
    );
    assert_eq!(
        fs::read(&outside).unwrap(),
        b"Outside sentinel caf\xc3\xa9\n"
    );
    assert_eq!(
        fs::read_to_string(project.join(".planning/phases/28/PLAN-1.md")).unwrap(),
        "Other phase sentinel\n"
    );
}

fn occupied_fixture() -> tempfile::TempDir {
    let temp = fixture();
    native_context(temp.path(), 27);
    for number in 1..=8 {
        fs::write(
            temp.path()
                .join(format!(".planning/phases/27/PLAN-{number}.md")),
            format!("# Legacy occupied plan {number}\n"),
        )
        .unwrap();
    }
    temp
}

fn plan_names(project: &Path) -> Vec<String> {
    let mut names = fs::read_dir(project.join(".planning/phases/27"))
        .unwrap()
        .map(|e| e.unwrap().file_name().into_string().unwrap())
        .filter(|n| n.starts_with("PLAN"))
        .collect::<Vec<_>>();
    names.sort();
    names
}

fn replacement_request(preview: &Value, number: u32, id: &str, old: &str, revision: &Value, body: &str) -> Value {
    let mut preview = preview.clone();
    preview["targets"] = json!([{"phase":27,"plan":number}]);
    let mut input = request(&preview, 27, id, &[body]);
    let entry = &mut input["submission"]["plans"][0];
    entry["replacement"] = json!({"approved":true,"owner":"John Crenshaw",
        "at":"2026-09-10T15:00:00Z","target":{"phase":27,"plan":number},
        "old_revision":revision,"old_document":old,"content":entry["content"]});
    approve(input)
}

#[test]
fn phase27_unauthorized_replacement_is_refused() {
    let temp = fixture();
    let project = temp.path();
    native_context(project, 27);
    let mut client = Client::open(project);
    let preview = client.read("27", Some(1));
    let original = approve(request(&preview, 27, "original", &["# Original approved content\n"]));
    let first = client.call("cadence_apply", original.clone());
    assert_eq!(first["persisted"], true, "{first}");
    client.finish();
    let path = project.join(".planning/phases/27/PLAN-1.md");
    let old = fs::read_to_string(&path).unwrap();
    let revision = &first["results"][0]["revision"];
    let before = tree(project);
    for case in ["absent", "declined", "original-only", "wrong-target", "stale-revision", "stale-bytes", "different-new-content", "no-owner", "no-time", "no-initial-approval", "declined-initial-approval"] {
        let mut client = Client::open(project);
        let preview = client.read("27", Some(1));
        let mut input = replacement_request(&preview, 1, case, &old, revision, "# Unauthorized replacement\n");
        let replacement = &mut input["submission"]["plans"][0]["replacement"];
        match case {
            "absent" | "original-only" => *replacement = Value::Null,
            "declined" => replacement["approved"] = json!(false),
            "wrong-target" => replacement["target"]["plan"] = json!(2),
            "stale-revision" => replacement["old_revision"] = json!("stale-revision"),
            "stale-bytes" => replacement["old_document"] = json!("Stale old bytes\n"),
            "different-new-content" => replacement["content"]["body"] = json!("Different approved proposal\n"),
            "no-owner" => replacement["owner"] = Value::Null,
            "no-time" => replacement["at"] = Value::Null,
            _ => {}
        }
        input = approve(input);
        match case {
            "original-only" => input["approval"] = original["approval"].clone(),
            "no-initial-approval" => input["approval"] = Value::Null,
            "declined-initial-approval" => input["approval"]["approved"] = json!(false),
            _ => {}
        }
        let answer = client.call("cadence_apply", input);
        let expected = if case.starts_with("stale-") { "stale-target" } else { "replacement-authorization" };
        assert_eq!(answer["status"], "refused", "{case}: {answer}");
        assert_eq!(answer["rule"], expected, "{case}: {answer}");
        assert!(answer["reason"].as_str().unwrap().contains("phase 27 plan 1"), "{answer}");
        client.finish();
        assert_eq!(tree(project), before, "{case} cannot alter revision, history or allocation");
    }
    let mut client = Client::open(project);
    let preview = client.read("27", Some(1));
    let winner = replacement_request(&preview, 1, "replacement-winner", &old, revision, "# Authorized new content\n");
    let loser = replacement_request(&preview, 1, "stale-loser", &old, revision, "# Losing content\n");
    let replaced = client.call("cadence_apply", winner);
    assert_eq!(replaced["persisted"], true, "exact replacement must succeed: {replaced}");
    assert_eq!(replaced["results"][0]["identity"], json!({"phase":27,"plan":1}));
    assert_ne!(replaced["results"][0]["revision"], *revision);
    client.finish();
    let installed = tree(project);
    let mut client = Client::open(project);
    let answer = client.call("cadence_apply", loser);
    assert_eq!(answer["rule"], "stale-target", "{answer}");
    assert!(answer["reason"].as_str().unwrap().contains("phase 27 plan 1"));
    client.finish();
    assert_eq!(tree(project), installed);
    assert_eq!(plan_names(project), ["PLAN-1.md"]);
    assert_eq!(cadence::execution::plan::parse_plan(&fs::read(&path).unwrap(),27,1).unwrap().body, "# Authorized new content\n");
    let saved = reopened(project).snapshot;
    let occurrence = &saved.data["plan_publications"]["phases"]["27"];
    assert_eq!(occurrence["id"], "active-cycle:phase:27");
    assert_eq!(occurrence["high_water"], 1);
    assert_eq!(occurrence["consumed"], json!([1]));
    assert_eq!(occurrence["receipts"]["original"]["results"], first["results"]);
    assert_eq!(occurrence["receipts"]["replacement-winner"]["results"], replaced["results"]);
    assert_eq!(occurrence["publications"]["1"]["history"], json!([revision,replaced["results"][0]["revision"]]));

    let admitted = admitted_legacy();
    let before = tree(admitted.path());
    let path = admitted.path().join(".planning/phases/27/PLAN-8.md");
    let old = fs::read_to_string(&path).unwrap();
    let mut client = Client::open(admitted.path());
    let preview = client.read("27", Some(1));
    let input = replacement_request(&preview, 8, "admitted", &old, &json!(model::digest(old.as_bytes())), "# Never replace admitted work\n");
    let answer = client.call("cadence_apply", input);
    assert_eq!(answer["rule"], "admitted-plan", "{answer}");
    assert!(answer["reason"].as_str().unwrap().contains("phase 27 plan 8"));
    client.finish();
    assert_eq!(tree(admitted.path()), before);

    let legacy = fixture();
    native_context(legacy.path(), 27);
    fs::write(legacy.path().join(".planning/phases/27/PLAN.md"), "Bare legacy bytes\n").unwrap();
    let before = tree(legacy.path());
    let mut client = Client::open(legacy.path());
    let preview = client.read("27", Some(1));
    let input = replacement_request(&preview, 1, "alias", "Bare legacy bytes\n", &json!(model::digest(b"Bare legacy bytes\n")), "# Cannot convert alias\n");
    let answer = client.call("cadence_apply", input);
    assert_eq!(answer["rule"], "legacy-read-only", "{answer}");
    assert!(answer["reason"].as_str().unwrap().contains("phase 27 plan 1"));
    client.finish();
    assert_eq!(tree(legacy.path()), before);
    assert!(!legacy.path().join(".planning/phases/27/PLAN-1.md").exists());
}

fn admitted_legacy() -> tempfile::TempDir {
    let temp = fixture();
    native_context(temp.path(), 27);
    fs::write(temp.path().join(".planning/phases/27/PLAN-8.md"),
        "---\nphase: 27\nplan: 8\nrequirements: [T1]\nfiles: [src/shared.txt]\ndirectories: [src/extra]\nexecution:\n  schema: 1\n  suite: printf suite\n  tasks:\n    - id: task-1\n      verify: [printf verified]\n---\n## Evidence map\nLegacy admitted work.\n").unwrap();
    execution_authority(temp.path());
    let mut client = Client::open(temp.path());
    let answer = client.call("cadence_query", json!({"operation":"execute-next","phase":27}));
    assert_eq!(answer["status"], "ok", "real legacy admission prerequisite: {answer}");
    assert_eq!(answer["outcome"], "dispatch", "real legacy admission prerequisite: {answer}");
    client.finish();
    assert_eq!(reopened(temp.path()).snapshot.data["execution"]["occurrences"]["27"]["active"]["plan"], 8);
    temp
}

#[test]
fn phase27_gap_plan_uses_previously_unused_identity() {
    let temp = fixture();
    let project = temp.path();
    native_context(project, 27);
    native_context(project, 28);
    let phase = project.join(".planning/phases/27");
    fs::create_dir(phase.join("reports")).unwrap();
    let legacy = [
        ("PLAN.md", "# Bare legacy reserves one\n"),
        ("PLAN-3.md", "---\nphase: 27\nplan: 3\n---\n# Legacy three\n"),
        ("reports/plan-8.md", "PLAN COMPLETE\nPrior report eight\n"),
        ("SUMMARY.md", "# Prior summary\n"),
        ("UAT.md", "# Unresolved gap\n"),
    ];
    for (path, bytes) in legacy { fs::write(phase.join(path), bytes).unwrap(); }
    fs::create_dir_all(project.join(".planning/phases/27.1")).unwrap();
    fs::write(project.join(".planning/phases/27.1/PLAN-70.md"), "Decimal legacy\n").unwrap();
    let mut client = Client::open(project);
    let preview = client.read("27", Some(1));
    assert_eq!(preview["targets"], json!([{"phase":27,"plan":9}]));
    let first = client.call("cadence_apply", approve(request(&preview, 27, "nine", &["# Native nine\n"])));
    assert_eq!(first["persisted"], true, "{first}");
    client.finish();
    let prior = reopened(project).snapshot;
    fs::remove_file(phase.join("PLAN-9.md")).unwrap();
    let mut client = Client::open(project);
    let preview = client.read("27", Some(1));
    assert_eq!(preview["targets"], json!([{"phase":27,"plan":10}]));
    let gap = client.call("cadence_apply", approve(request(&preview, 27, "gap-ten", &["# Additional gap work\n"])));
    assert_eq!(gap["persisted"], true, "{gap}");
    client.finish();
    assert_eq!(plan_names(project), ["PLAN-10.md", "PLAN-3.md", "PLAN.md"]);
    for (path, bytes) in legacy { assert_eq!(fs::read_to_string(phase.join(path)).unwrap(), bytes); }
    let saved = reopened(project).snapshot;
    let occurrence = &saved.data["plan_publications"]["phases"]["27"];
    assert_eq!(occurrence["high_water"], 10);
    assert_eq!(occurrence["consumed"], json!([1,3,8,9,10]));
    assert_eq!(occurrence["id"], "active-cycle:phase:27");
    assert_eq!(occurrence["publications"]["9"], prior.data["plan_publications"]["phases"]["27"]["publications"]["9"]);
    assert_eq!(occurrence["receipts"]["nine"], prior.data["plan_publications"]["phases"]["27"]["receipts"]["nine"]);
    assert_eq!(cadence::execution::plan::parse_plan(&fs::read(phase.join("PLAN-10.md")).unwrap(),27,10).unwrap().body, "# Additional gap work\n");
    for key in ["context", "execution", "evidence", "import", "source_evidence"] { assert_eq!(saved.data.get(key), prior.data.get(key)); }
    let mut client = Client::open(project);
    fs::remove_file(phase.join("reports/plan-8.md")).unwrap();
    let preview = client.read("27", Some(1));
    assert_eq!(preview["targets"], json!([{"phase":27,"plan":11}]));
    let gap = client.call("cadence_apply", approve(request(&preview, 27, "gap-eleven", &["# Another gap\n"])));
    assert_eq!(gap["persisted"], true, "{gap}");
    let other = client.read("28", Some(1));
    assert_eq!(other["targets"], json!([{"phase":28,"plan":1}]));
    assert_eq!(other["occurrence"], "active-cycle:phase:28");
    let decimal = client.read("27.1", None);
    assert_eq!(decimal["inventory"]["occupied"], json!([70]));
    assert_eq!(decimal["native_truths_approved"], false);
    assert!(decimal["occurrence"].is_null());
    assert_eq!(client.read("27.1", Some(1))["rule"], "native-identity");
    client.finish();
    assert_eq!(plan_names(project), ["PLAN-10.md", "PLAN-11.md", "PLAN-3.md", "PLAN.md"]);
    let saved = reopened(project).snapshot;
    assert_eq!(saved.data["plan_publications"]["phases"]["27"]["high_water"], 11);
    assert_eq!(saved.data["plan_publications"]["phases"]["27"]["consumed"], json!([1,3,8,9,10,11]));
    assert_eq!(fs::read_to_string(project.join(".planning/phases/27.1/PLAN-70.md")).unwrap(), "Decimal legacy\n");

    let admitted = admitted_legacy();
    let before = reopened(admitted.path()).snapshot;
    fs::remove_file(admitted.path().join(".planning/phases/27/PLAN-8.md")).unwrap();
    let mut client = Client::open(admitted.path());
    let preview = client.read("27", Some(1));
    assert_eq!(preview["targets"], json!([{"phase":27,"plan":9}]));
    let gap = client.call("cadence_apply", approve(request(&preview, 27, "after-admission", &["# New work\n"])));
    assert_eq!(gap["persisted"], true, "{gap}");
    client.finish();
    assert_eq!(plan_names(admitted.path()), ["PLAN-9.md"]);
    let after = reopened(admitted.path()).snapshot;
    assert_eq!(after.data["execution"], before.data["execution"]);
    assert_eq!(after.data["plan_publications"]["phases"]["27"]["consumed"], json!([8,9]));

    for inputs in [
        vec![("PLAN.md", "Bare\n"), ("PLAN-1.md", "Alias\n")],
        vec![("PLAN-01.md", "Leading zero\n")],
        vec![("PLAN-3.md", "---\nphase: 27\nplan: 4\n---\nConflict\n")],
    ] {
        let temp = fixture();
        native_context(temp.path(), 27);
        let mut client = Client::open(temp.path());
        let clean = client.read("27", Some(1));
        let input = approve(request(&clean, 27, "ambiguous", &["# Must refuse\n"]));
        for (path, bytes) in inputs { fs::write(temp.path().join(".planning/phases/27").join(path), bytes).unwrap(); }
        let before = tree(temp.path());
        for answer in [client.read("27", Some(1)), client.call("cadence_apply", input)] {
            assert_eq!(answer["rule"], "inventory", "ambiguous surviving evidence: {answer}");
            assert!(answer["reason"].as_str().unwrap().contains("explicit resolution"), "{answer}");
        }
        client.finish();
        assert_eq!(tree(temp.path()), before);
    }
}

#[test]
fn phase27_multiple_plans_have_distinct_numeric_order() {
    let temp = occupied_fixture();
    let project = temp.path();
    let before = tree(project);
    let mut first = Client::open(project);
    let mut second = Client::open(project);
    let preview = first.read("27", Some(3));
    let competing_preview = second.read("27", Some(3));
    assert_eq!(
        preview["targets"],
        json!([{"phase":27,"plan":9},{"phase":27,"plan":10},{"phase":27,"plan":11}])
    );
    assert_eq!(preview["targets"], competing_preview["targets"]);
    assert_eq!(
        preview["inventory"]["basis"],
        competing_preview["inventory"]["basis"]
    );
    assert_eq!(tree(project), before, "previews do not reserve numbers");
    let bodies = [
        "# Ninth — café\n",
        "# Tenth\r\n## Evidence map\r\nOpaque",
        "# Eleventh\n日本語\n",
    ];
    let winner_request = approve(request(&preview, 27, "batch-winner", &bodies));
    let loser_request = approve(request(
        &competing_preview,
        27,
        "batch-loser",
        &["Loser nine", "Loser ten", "Loser eleven"],
    ));
    let answer = first.call("cadence_apply", winner_request.clone());
    assert_eq!(
        answer["persisted"], true,
        "ordered approved batch must publish: {answer}"
    );
    let numbers: Vec<_> = answer["results"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| p["identity"]["plan"].as_u64().unwrap())
        .collect();
    assert_eq!(numbers, [9, 10, 11]);
    let listing = first.read("27", None);
    assert_eq!(
        listing["plans"]
            .as_array()
            .unwrap()
            .iter()
            .map(|p| p["identity"]["plan"].as_u64().unwrap())
            .collect::<Vec<_>>(),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    );
    first.finish();
    let installed = tree(project);
    let loser = second.call("cadence_apply", loser_request);
    assert_eq!(loser["status"], "refused", "{loser}");
    assert_eq!(loser["rule"], "allocation-conflict", "{loser}");
    assert!(
        loser["reason"]
            .as_str()
            .unwrap()
            .contains("inventory precondition changed"),
        "{loser}"
    );
    second.finish();
    assert_eq!(
        tree(project),
        installed,
        "loser cannot allocate 12 or change the winning batch"
    );
    let mut actual = fs::read_dir(project.join(".planning/phases/27"))
        .unwrap()
        .map(|e| e.unwrap().file_name().into_string().unwrap())
        .filter(|name| name.starts_with("PLAN-"))
        .collect::<Vec<_>>();
    actual.sort();
    assert_eq!(
        actual,
        [
            "PLAN-1.md",
            "PLAN-10.md",
            "PLAN-11.md",
            "PLAN-2.md",
            "PLAN-3.md",
            "PLAN-4.md",
            "PLAN-5.md",
            "PLAN-6.md",
            "PLAN-7.md",
            "PLAN-8.md",
            "PLAN-9.md"
        ]
    );
    let view = reopened(project);
    let occurrence = &view.snapshot.data["plan_publications"]["phases"]["27"];
    assert_eq!(occurrence["high_water"], 11);
    assert_eq!(
        occurrence["consumed"],
        json!([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    );
    for (number, body) in [(9, bodies[0]), (10, bodies[1]), (11, bodies[2])] {
        let document =
            fs::read(project.join(format!(".planning/phases/27/PLAN-{number}.md"))).unwrap();
        assert_eq!(
            cadence::execution::plan::parse_plan(&document, 27, number)
                .unwrap()
                .body,
            body
        );
        assert_eq!(
            occurrence["publications"][number.to_string()]["content"]["body"],
            body
        );
    }
    assert_eq!(
        occurrence["receipts"]["batch-winner"]["results"],
        answer["results"]
    );
    assert!(occurrence["receipts"].get("batch-loser").is_none());
    let mut client = Client::open(project);
    let fresh = client.read("27", Some(1));
    assert_eq!(fresh["targets"], json!([{"phase":27,"plan":12}]));
    let next = client.call(
        "cadence_apply",
        approve(request(
            &fresh,
            27,
            "fresh-twelve",
            &["# Freshly approved twelve\n"],
        )),
    );
    assert_eq!(next["persisted"], true, "{next}");
    client.finish();
    assert_eq!(
        reopened(project).snapshot.data["plan_publications"]["phases"]["27"]["high_water"],
        12
    );

    let conflict = occupied_fixture();
    let mut client = Client::open(conflict.path());
    let preview = client.read("27", Some(3));
    let input = approve(request(&preview, 27, "last-entry-conflict", &bodies));
    fs::write(
        conflict.path().join(".planning/phases/27/PLAN-11.md"),
        "Concurrent final-entry winner\n",
    )
    .unwrap();
    let before = tree(conflict.path());
    let answer = client.call("cadence_apply", input);
    assert_eq!(answer["rule"], "allocation-conflict", "{answer}");
    client.finish();
    assert_eq!(tree(conflict.path()), before);
    assert!(
        !conflict
            .path()
            .join(".planning/phases/27/PLAN-9.md")
            .exists()
    );
    assert!(
        !conflict
            .path()
            .join(".planning/phases/27/PLAN-10.md")
            .exists()
    );
    assert!(
        snapshot(conflict.path())
            .data
            .get("plan_publications")
            .is_none()
    );

    let exhausted = fixture();
    native_context(exhausted.path(), 27);
    fs::write(
        exhausted
            .path()
            .join(".planning/phases/27/PLAN-4294967295.md"),
        "Consumed maximum\n",
    )
    .unwrap();
    let before = tree(exhausted.path());
    let mut client = Client::open(exhausted.path());
    let refusal = client.read("27", Some(1));
    assert_eq!(refusal["rule"], "number-exhaustion", "{refusal}");
    let mut raw = client.read("27", None);
    raw["targets"] = json!([{"phase":27,"plan":4294967295_u32}]);
    let refusal = client.call(
        "cadence_apply",
        approve(request(&raw, 27, "exhausted", &["Never wrap to zero\n"])),
    );
    assert_eq!(refusal["rule"], "number-exhaustion", "{refusal}");
    client.finish();
    assert_eq!(tree(exhausted.path()), before);
}
