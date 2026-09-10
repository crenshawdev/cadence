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
            json!({"operation":"plan-read","phase":phase,"count":count}),
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
