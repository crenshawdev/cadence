//! Phase 38 acceptance checks cross two real binaries, stdio, Git and durable
//! native execution state. No store record or renderer is seeded by a check.
#[path = "support/phase13.rs"]
#[allow(dead_code)]
mod support;

use serde_json::{Value, json};
use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::Instant,
};
use support::Client;

const PHASE: u32 = 38;
const COMMAND: &str = "python3 -B tests/retained_prompt.py";
const OWNER: &str = "Fixture Owner";
const AT: &str = "2026-09-15T14:00:00Z";

fn git(project: &Path, args: &[&str]) -> String {
    let output = Command::new("git")
        .args([
            "-c",
            "commit.gpgsign=false",
            "-c",
            "user.name=Cadence-Phase38",
            "-c",
            "user.email=phase38@example.invalid",
        ])
        .args(args)
        .current_dir(project)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GNUPGHOME", project.join(".fixture-gnupg"))
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "git {args:?}: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8(output.stdout)
        .unwrap()
        .trim_end()
        .to_owned()
}

fn fixture() -> tempfile::TempDir {
    use std::os::unix::fs::PermissionsExt;
    let temp = tempfile::tempdir().unwrap();
    let project = temp.path();
    fs::create_dir_all(project.join(".planning/phases/38")).unwrap();
    fs::create_dir(project.join(".fixture-gnupg")).unwrap();
    fs::set_permissions(
        project.join(".fixture-gnupg"),
        fs::Permissions::from_mode(0o700),
    )
    .unwrap();
    let output = Command::new("gpg")
        .env("GNUPGHOME", project.join(".fixture-gnupg"))
        .args([
            "--batch",
            "--pinentry-mode",
            "loopback",
            "--passphrase",
            "",
            "--quick-generate-key",
            "Cadence-Phase38 <phase38@example.invalid>",
            "ed25519",
            "sign",
            "0",
        ])
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
    fs::write(
        project.join(".planning/ROADMAP.md"),
        "## Phases\n- [ ] **Phase 38: Retained prompts**\n- [ ] **Phase 39: Next phase**\n",
    )
    .unwrap();
    fs::write(
        project.join(".planning/config.json"),
        serde_json::to_vec(&json!({
            "review":{"triggers":{"risk_surface":{"surfaces":cadence::rail::risk::CATEGORIES}}}
        }))
        .unwrap(),
    )
    .unwrap();
    fs::create_dir(project.join("src")).unwrap();
    fs::write(project.join(".gitignore"), ".planning/\n.fixture-gnupg/\n__pycache__/\n").unwrap();
    fs::write(project.join("src/value.py"), "def answer():\n    return 1\n").unwrap();
    git(project, &["init", "--initial-branch=fixture/retained-prompt"]);
    git(project, &["config", "user.signingkey", "phase38@example.invalid"]);
    git(project, &["add", ".gitignore", "src/value.py"]);
    git(project, &["commit", "-S", "-m", "Fixture phase 38 subject"]);
    temp
}

fn call(project: &Path, tool: &str, request: Value) -> Value {
    let mut client = Client::open(project);
    let answer = client.call(tool, request);
    client.finish();
    answer
}

fn check() -> Value {
    json!({"kind":"check","id":"P38-T4-C",
        "reason":"Re-rendering would change or refuse the retained owner-visible prompt.",
        "spec":{"command":COMMAND,"expected":{"kind":"property","value":"the retained prompt survives a renderer change"},
            "test":{"file":"tests/retained_prompt.py","function":"RetainedPrompt.test_answer"},
            "setup":"Admit under one compiled renderer and read under another.",
            "call":"Request execute-next from the changed binary.",
            "boundary":"Two real Cadence stdio binaries and one durable project.","fakes":[]},
        "associations":[{"truth_id":"T4","truth_version":1,
            "reason":"This is the owner-visible retained prompt outcome."}]})
}

fn map() -> Value {
    json!({"mode":"attached","items":[check(),{
        "kind":"artifact","id":"P38-A-PROMPT",
        "reason":"The durable dispatch must carry the admitted prompt.",
        "spec":{"locators":["src/value.py"],"substance":"The fixture subject exists."},
        "associations":[{"truth_id":"T4","truth_version":1,
            "reason":"The dispatch retains the bytes used for this work."}]
    }]})
}

fn history(project: &Path) -> Value {
    let mut answer = call(
        project,
        "cadence_query",
        json!({"operation":"execution-history","phase":PHASE}),
    );
    assert_eq!(answer["status"], "ok", "{answer}");
    // Retention assertions read stored records separately from the wire index.
    let retained = support::retained_history(project, PHASE);
    answer["events"] = retained["events"].clone();
    answer["plan_events"] = retained["plan_events"].clone();
    answer
}

fn task(project: &Path) -> Value {
    history(project)["tasks"]
        .as_array()
        .unwrap()
        .iter()
        .find(|entry| entry["task"]["task"] == "retain-prompt")
        .unwrap()
        .clone()
}

fn run(project: &Path, id: &str, stage: &str, check: Value) -> Value {
    let current = task(project);
    let mut client = Client::open(project);
    let launched = client.call(
        "cadence_apply",
        json!({"operation":"execution-run","request":{"request_id":id,
            "task":current["task"],"attempt":"attempt-retain-prompt",
            "expected_version":current["state"]["version"],"command":COMMAND,
            "check":check,"stage":stage}}),
    );
    assert_eq!(launched["status"], "ok", "{launched}");
    let result = support::native_result(&mut client, PHASE, id)["request"]["event"].clone();
    client.finish();
    result
}

fn copy_tree(from: &Path, to: &Path) {
    fs::create_dir_all(to).unwrap();
    for entry in fs::read_dir(from).unwrap() {
        let entry = entry.unwrap();
        let source = entry.path();
        let target = to.join(entry.file_name());
        if entry.file_type().unwrap().is_dir() {
            copy_tree(&source, &target);
        } else {
            fs::copy(source, target).unwrap();
        }
    }
}

// Reuse only dependency artifacts from the binary under test. Every fixture
// still compiles its own Cadence sources in a private target directory; no
// Cadence fingerprint, object, executable or incremental state is shared.
fn seed_dependency_artifacts(target: &Path) {
    fn copy_cached(from: &Path, to: &Path) {
        let metadata = fs::metadata(from).unwrap();
        if metadata.is_dir() {
            fs::create_dir_all(to).unwrap();
            for entry in fs::read_dir(from).unwrap() {
                let entry = entry.unwrap();
                copy_cached(&entry.path(), &to.join(entry.file_name()));
            }
        } else {
            fs::copy(from, to).unwrap();
        }
        // Cargo uses mtimes alongside fingerprints. Preserve them while
        // copying independent inodes, so fixture rebuilds cannot alter ours.
        fs::File::open(to).unwrap().set_times(
            fs::FileTimes::new().set_modified(metadata.modified().unwrap())
        ).unwrap();
    }
    let profile = target.join("debug");
    if profile.exists() { return; }
    let built = Path::new(env!("CARGO_BIN_EXE_cadence")).parent().unwrap();
    for directory in [".fingerprint", "build", "deps"] {
        let destination = profile.join(directory);
        fs::create_dir_all(&destination).unwrap();
        for entry in fs::read_dir(built.join(directory)).unwrap() {
            let entry = entry.unwrap();
            let name = entry.file_name();
            let name = name.to_str().unwrap();
            if name.starts_with("cadence-") || name.starts_with("libcadence") { continue; }
            if directory == "deps" && !name.starts_with("lib") && !name.ends_with(".d") { continue; }
            copy_cached(&entry.path(), &destination.join(name));
        }
    }
}

fn changed_binary(temp: &Path) -> PathBuf {
    let repository = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let source = temp.join("changed-source");
    fs::create_dir_all(source.join("crates/cadence")).unwrap();
    fs::create_dir_all(source.join("cadence-core/references")).unwrap();
    for file in ["Cargo.toml", "Cargo.lock"] {
        fs::copy(repository.join(file), source.join(file)).unwrap();
    }
    fs::copy(
        repository.join("crates/cadence/Cargo.toml"),
        source.join("crates/cadence/Cargo.toml"),
    )
    .unwrap();
    copy_tree(
        &repository.join("crates/cadence/src"),
        &source.join("crates/cadence/src"),
    );
    copy_tree(
        &repository.join("crates/cadence/tests/fixtures/phase9"),
        &source.join("crates/cadence/tests/fixtures/phase9"),
    );
    fs::copy(
        repository.join("cadence-core/references/reviewer-brief.md"),
        source.join("cadence-core/references/reviewer-brief.md"),
    )
    .unwrap();
    let instructions = source.join("crates/cadence/src/execution/instructions.rs");
    let original = fs::read_to_string(&instructions).unwrap();
    let needle = "The dispatch's operational input is the binary's authority";
    assert_eq!(original.matches(needle).count(), 1);
    fs::write(
        &instructions,
        original.replace(
            needle,
            "The retained dispatch operational input is the binary's authority",
        ),
    )
    .unwrap();
    let target = temp.join("changed-target");
    seed_dependency_artifacts(&target);
    let started = Instant::now();
    let output = Command::new("cargo")
        .args(["build", "--locked", "--jobs", "8", "-p", "cadence", "--bin", "cadence"])
        .current_dir(&source)
        .env("CARGO_TARGET_DIR", &target)
        .env("RUSTC_WRAPPER", "")
        .stdin(Stdio::null())
        .output()
        .unwrap();
    let elapsed = started.elapsed().as_secs_f64();
    eprintln!("PHASE38_SECOND_BINARY_BUILD_SECONDS={elapsed:.3}");
    assert!(
        output.status.success(),
        "changed binary build failed after {elapsed:.3}s:\n{}",
        String::from_utf8_lossy(&output.stderr)
    );
    target.join("debug/cadence")
}

#[test]
fn phase38_retained_dispatch_prompt_survives_renderer_change() {
    let temp = fixture();
    let project = temp.path();
    let truth = json!({"id":"T4","trigger":"the binary renderer changes after dispatch admission",
        "observer":"the owner","verb":"gets","outcome":"the admitted dispatch prompt byte for byte",
        "kind":"property","observable":true,"fixed_oracle":true});
    let context = call(
        project,
        "cadence_apply",
        support::approve(json!({"operation":"context-submit","submission":{"phase":PHASE,
            "title":"Retained prompts","scope":"One durable dispatch.","durable_decisions":[],
            "decisions":[],"assumptions":[],"truths":[truth]}})),
    );
    assert_eq!(context["persisted"], true, "{context}");

    let evidence_map = map();
    let mut client = Client::open(project);
    let allocation = client.read("38", Some(1));
    assert_eq!(allocation["status"], "ok", "{allocation}");
    let target = allocation["targets"][0].clone();
    let submission = json!({"phase":PHASE,"occurrence":allocation["occurrence"],
        "request_id":"publish-retained-prompt","inventory_basis":allocation["inventory"]["basis"],
        "plans":[{"target":target,"content":{"phase":PHASE,"plan":1,"requirements":["T4"],
            "files":["src/value.py","tests/retained_prompt.py"],"directories":[],
            "goal":"Fixture plan","context":"Retained-prompt fixture.","notes":"",
            "tasks":[{"id":"retain-prompt","title":"Retain dispatch prompt",
                "files":["src/value.py","tests/retained_prompt.py"],
                "action":"Exercise the retained prompt.","verify":[COMMAND]}],
            "suite":COMMAND,"evidence_map":evidence_map}}]});
    let preview = client.call(
        "cadence_query",
        json!({"operation":"plan-read","phase":"38","submission":submission}),
    );
    assert_eq!(preview["status"], "ok", "{preview}");
    let published = client.call(
        "cadence_apply",
        support::approve(json!({"operation":"plan-submit","submission":submission})),
    );
    assert_eq!(published["persisted"], true, "{published}");
    let plans = client.read("38", None);
    let evidence = client.call(
        "cadence_query",
        json!({"operation":"evidence-read","phase":PHASE}),
    );
    client.finish();
    let publication = &plans["native"]["publications"]["1"];
    let check_revision = evidence["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|item| item["id"] == "P38-T4-C")
        .unwrap()["item_revision"]
        .clone();
    let assignment = json!({"plan":1,"task":"retain-prompt","checks":[{
        "id":"P38-T4-C","item_revision":check_revision}]});
    let contract = json!({"phase":PHASE,"occurrence":plans["occurrence"],"plans":[{
        "plan":1,"publication_request":publication["publication_request"],
        "content_revision":publication["revision"],"map_revision":publication["map_revision"]}],
        "allocation":[assignment]});
    let admitted = call(
        project,
        "cadence_apply",
        json!({"operation":"execution-admit","request":{"request_id":"admit-retained-prompt",
            "expected_set_version":0,"contract":contract}}),
    );
    assert_eq!(admitted["status"], "ok", "{admitted}");
    let authorized = call(
        project,
        "cadence_apply",
        json!({"operation":"execution-authorize","phase":PHASE,
            "request_id":"authorize-retained-prompt","owner":OWNER,"at":AT,
            "response":"Run the retained prompt check."}),
    );
    assert_eq!(authorized["status"], "ok", "{authorized}");
    let dispatch = call(
        project,
        "cadence_query",
        json!({"operation":"execute-next","phase":PHASE}),
    );
    assert_eq!(dispatch["outcome"], "dispatch", "{dispatch}");
    assert!(dispatch.get("prompt").is_none());
    assert!(history(project)["active"].get("prompt").is_none());
    assert!(history(project)["active"].get("prompt_digest").is_none());

    let current = task(project);
    let started = call(
        project,
        "cadence_apply",
        json!({"operation":"execution-task-start","request":{"request_id":"start-retained-prompt",
            "task":current["task"],"attempt":"attempt-retain-prompt",
            "expected_version":current["state"]["version"],"predecessor":null,
            "checks":[assignment["checks"][0].clone()]}}),
    );
    assert_eq!(started["status"], "ok", "{started}");
    fs::create_dir(project.join("tests")).unwrap();
    fs::write(project.join("tests/retained_prompt.py"),
        "import sys, unittest\nsys.path.insert(0, 'src')\nfrom value import answer\nunittest.runner.time.perf_counter = lambda: 0.0\nclass RetainedPrompt(unittest.TestCase):\n    def test_answer(self):\n        self.assertEqual(answer(), 2)\nif __name__ == '__main__':\n    unittest.main()\n").unwrap();
    git(project, &["add", "tests/retained_prompt.py"]);
    git(project, &["commit", "-S", "-m", "test(38): retain prompt red"]);
    let red_commit = git(project, &["rev-parse", "HEAD"]);
    let red = run(project, "retained-red", "red", assignment["checks"][0].clone());
    assert_eq!(red["disposition"], json!({"kind":"exited","code":1}), "{red}");
    fs::write(project.join("src/value.py"), "def answer():\n    return 2\n").unwrap();
    git(project, &["add", "src/value.py"]);
    git(project, &["commit", "-S", "-m", "feat: deliver retain-prompt"]);
    let green_commit = git(project, &["rev-parse", "HEAD"]);
    let green = run(project, "retained-green", "green", assignment["checks"][0].clone());
    assert_eq!(green["disposition"], json!({"kind":"exited","code":0}), "{green}");
    let verified = run(project, "retained-verify", "verify", Value::Null);
    assert_eq!(verified["disposition"], json!({"kind":"exited","code":0}), "{verified}");
    let events = history(project);
    let launch = events["events"].as_array().unwrap().iter().find(|record| {
        record["request"]["event"]["kind"] == "launch"
            && record["request"]["event"]["run_id"] == "retained-red"
    }).unwrap();
    let inspection = json!({"check":assignment["checks"][0],
        "test_digest":launch["request"]["event"]["material"]["test_digest"],
        "evidence":["retained-red","retained-green"],"no_subject_stub":true});
    let current = task(project);
    let attested = call(project, "cadence_apply", json!({"operation":"execution-owner-attest","request":{
        "request_id":"attest-retained-prompt","task":current["task"],"attempt":"attempt-retain-prompt",
        "expected_version":current["state"]["version"],"statement":{"submission":inspection,
        "supersedes":null,"approval":{"approved":true,"owner":OWNER,"at":AT,"submission":inspection}}}}));
    assert_eq!(attested["status"], "ok", "{attested}");
    let current = task(project);
    let closed = call(project, "cadence_apply", json!({"operation":"execution-task-close","request":{
        "request_id":"close-retained-prompt","task":current["task"],"attempt":"attempt-retain-prompt",
        "expected_version":current["state"]["version"],"completion":green_commit,
        "checks":[{"check":assignment["checks"][0],"red_commit":red_commit,
            "green_commit":green_commit,"red_run":"retained-red","green_run":"retained-green"}],
        "verification":["retained-verify"]}}));
    assert_eq!(closed["status"], "ok", "{closed}");
    let current = history(project);
    let plan = current["plans"].as_array().unwrap().iter().find(|entry| entry["plan"]["plan"] == 1).unwrap();
    let mut client = Client::open(project);
    let suite = client.call("cadence_apply", json!({"operation":"execution-suite","request":{
        "request_id":"suite-retained-prompt","plan":plan["plan"],
        "expected_version":plan["state"]["version"]}}));
    assert_eq!(suite["status"], "ok", "{suite}");
    let result = support::native_result(&mut client, PHASE, "suite-retained-prompt");
    assert_eq!(result["request"]["event"]["disposition"], json!({"kind":"exited","code":0}));
    // Retain the current operational issue before changing only the renderer.
    let current_issue = client.call(
        "cadence_query",
        json!({"operation":"execute-next","phase":PHASE}),
    );
    assert_eq!(current_issue["outcome"], "dispatch", "{current_issue}");
    let retained = client.call("cadence_query", json!({"operation":"execution-history","phase":PHASE}))["active"].clone();
    assert!(retained.get("prompt").is_none());
    assert!(retained.get("prompt_digest").is_none());
    client.finish();

    let changed = changed_binary(temp.path());
    let mut replacement = Client::open_with_program(project, &changed);
    let reopened = replacement.call(
        "cadence_query",
        json!({"operation":"execute-next","phase":PHASE}),
    );
    replacement.finish();
    assert_eq!(reopened["status"], "ok", "retained prompt was refused: {reopened}");
    assert_eq!(reopened["outcome"], "dispatch", "{reopened}");
    assert_eq!(reopened, current_issue);
    assert_eq!(history(project)["active"], retained);
    assert!(reopened.get("prompt").is_none());
}

const RENDERED_COMMAND: &str = "python3 -B tests/rendered_skill.py";
const RENDERED_SKILL: &str = "skills/cad-executor-contract/SKILL.md";

fn rendered_check() -> Value {
    json!({"kind":"check","id":"P38-T5-C",
        "reason":"The real renderer, implicit lease and Write/Edit guard must agree on one owned file.",
        "spec":{"command":RENDERED_COMMAND,"expected":{"kind":"property","value":"the regenerated skill is accepted as implicit lease material"},
            "test":{"file":"tests/rendered_skill.py","function":"RenderedSkill.test_binary_output"},
            "setup":"Build the checked-in source and regenerate its executor skill through that binary.",
            "call":"Close the source and generated bytes, request the suite, and invoke the guard.",
            "boundary":"Compiled source through a real binary renderer, native close, suite and guard.","fakes":[]},
        "associations":[{"truth_id":"T5","truth_version":1,
            "reason":"This is the owner-visible regenerated-file outcome."}]})
}

fn rendered_map() -> Value {
    json!({"mode":"attached","items":[rendered_check(),{
        "kind":"artifact","id":"P38-A-RENDERED-SKILL",
        "reason":"The binary source and its rendered output form one owned change.",
        "spec":{"locators":["crates/cadence/src/execution/instructions.rs", RENDERED_SKILL],
            "substance":"The fixture changes compiled executor text and regenerates its skill."},
        "associations":[{"truth_id":"T5","truth_version":1,
            "reason":"The artifact is the source-to-render output exercised by the check."}]
    }]})
}

fn rendered_task(project: &Path) -> Value {
    history(project)["tasks"]
        .as_array()
        .unwrap()
        .iter()
        .find(|entry| entry["task"]["task"] == "regenerate-skill")
        .unwrap()
        .clone()
}

fn rendered_run(project: &Path, id: &str, stage: &str, check: Value) -> Value {
    let current = rendered_task(project);
    let mut client = Client::open(project);
    let launched = client.call(
        "cadence_apply",
        json!({"operation":"execution-run","request":{"request_id":id,
            "task":current["task"],"attempt":"attempt-regenerate-skill",
            "expected_version":current["state"]["version"],"command":RENDERED_COMMAND,
            "check":check,"stage":stage}}),
    );
    assert_eq!(launched["status"], "ok", "{launched}");
    let result = support::native_result(&mut client, PHASE, id)["request"]["event"].clone();
    client.finish();
    result
}

fn prepare_rendered_source(project: &Path) {
    let repository = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    fs::create_dir_all(project.join("crates/cadence")).unwrap();
    fs::create_dir_all(project.join("cadence-core/references")).unwrap();
    fs::create_dir_all(project.join("skills/cad-executor-contract")).unwrap();
    for file in ["Cargo.toml", "Cargo.lock"] {
        fs::copy(repository.join(file), project.join(file)).unwrap();
    }
    fs::copy(
        repository.join("crates/cadence/Cargo.toml"),
        project.join("crates/cadence/Cargo.toml"),
    )
    .unwrap();
    copy_tree(
        &repository.join("crates/cadence/src"),
        &project.join("crates/cadence/src"),
    );
    copy_tree(
        &repository.join("crates/cadence/tests/fixtures/phase9"),
        &project.join("crates/cadence/tests/fixtures/phase9"),
    );
    fs::copy(
        repository.join("cadence-core/references/reviewer-brief.md"),
        project.join("cadence-core/references/reviewer-brief.md"),
    )
    .unwrap();
    fs::copy(repository.join(RENDERED_SKILL), project.join(RENDERED_SKILL)).unwrap();
    fs::write(
        project.join(".gitignore"),
        ".planning/\n.fixture-gnupg/\n__pycache__/\ntarget/\n",
    )
    .unwrap();
    git(project, &["add", ".gitignore", "Cargo.toml", "Cargo.lock",
        "crates/cadence", "cadence-core/references/reviewer-brief.md", RENDERED_SKILL]);
    git(project, &["commit", "-S", "-m", "Fixture binary-rendered source"]);
}

fn build_rendered_binary(project: &Path) -> PathBuf {
    seed_dependency_artifacts(&project.join("target"));
    let started = Instant::now();
    let output = Command::new("cargo")
        .args(["build", "--locked", "--jobs", "8", "-p", "cadence", "--bin", "cadence"])
        .current_dir(project)
        .env("CARGO_TARGET_DIR", project.join("target"))
        .env("RUSTC_WRAPPER", "")
        .stdin(Stdio::null())
        .output()
        .unwrap();
    let elapsed = started.elapsed().as_secs_f64();
    eprintln!("PHASE38_REGENERATED_BINARY_BUILD_SECONDS={elapsed:.3}");
    assert!(output.status.success(), "fixture binary build failed after {elapsed:.3}s:\n{}",
        String::from_utf8_lossy(&output.stderr));
    project.join("target/debug/cadence")
}

fn guard_rendered_skill(project: &Path, binary: &Path) -> Value {
    let mut child = Command::new(binary)
        .arg("guard")
        .current_dir(project)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .unwrap();
    use std::io::Write;
    child.stdin.take().unwrap().write_all(
        &serde_json::to_vec(&json!({
            "session_id":"phase38-rendered-guard",
            "hook_event_name":"PreToolUse",
            "tool_name":"Edit",
            "cwd":project,
            "tool_input":{"file_path":RENDERED_SKILL,"old_string":"old","new_string":"new"}
        })).unwrap(),
    ).unwrap();
    let output = child.wait_with_output().unwrap();
    assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
    if output.stdout.is_empty() { Value::Null } else { serde_json::from_slice(&output.stdout).unwrap() }
}

#[test]
fn phase38_regenerated_skill_is_implicit_lease_material() {
    let temp = fixture();
    let project = temp.path();
    prepare_rendered_source(project);
    let truth = json!({"id":"T5","trigger":"compiled executor text changes",
        "observer":"the owner","verb":"gets","outcome":"the binary-regenerated skill accepted in the task lease",
        "kind":"property","observable":true,"fixed_oracle":true});
    let context = call(project, "cadence_apply", support::approve(json!({"operation":"context-submit",
        "submission":{"phase":PHASE,"title":"Rendered lease material","scope":"One rendered skill.",
        "durable_decisions":[],"decisions":[],"assumptions":[],"truths":[truth]}})));
    assert_eq!(context["persisted"], true, "{context}");

    let evidence_map = rendered_map();
    let mut client = Client::open(project);
    let allocation = client.read("38", Some(1));
    assert_eq!(allocation["status"], "ok", "{allocation}");
    let submission = json!({"phase":PHASE,"occurrence":allocation["occurrence"],
        "request_id":"publish-regenerated-skill","inventory_basis":allocation["inventory"]["basis"],
        "plans":[{"target":allocation["targets"][0],"content":{"phase":PHASE,"plan":1,
            "requirements":["T5"],
            "files":["crates/cadence/src/execution/instructions.rs","tests/rendered_skill.py"],
            "directories":[],"goal":"Fixture plan","context":"Rendered-skill fixture.","notes":"",
            "tasks":[{"id":"regenerate-skill","title":"Regenerate skill",
                "files":["crates/cadence/src/execution/instructions.rs","tests/rendered_skill.py"],
                "action":"Regenerate the binary-owned skill.","verify":[RENDERED_COMMAND]}],
            "suite":RENDERED_COMMAND,"evidence_map":evidence_map}}]});
    let preview = client.call("cadence_query",
        json!({"operation":"plan-read","phase":"38","submission":submission}));
    assert_eq!(preview["status"], "ok", "{preview}");
    let published = client.call("cadence_apply",
        support::approve(json!({"operation":"plan-submit","submission":submission})));
    assert_eq!(published["persisted"], true, "{published}");
    let plans = client.read("38", None);
    let evidence = client.call("cadence_query", json!({"operation":"evidence-read","phase":PHASE}));
    client.finish();
    let publication = &plans["native"]["publications"]["1"];
    let check_revision = evidence["items"].as_array().unwrap().iter()
        .find(|item| item["id"] == "P38-T5-C").unwrap()["item_revision"].clone();
    let assignment = json!({"plan":1,"task":"regenerate-skill","checks":[{
        "id":"P38-T5-C","item_revision":check_revision}]});
    let contract = json!({"phase":PHASE,"occurrence":plans["occurrence"],"plans":[{
        "plan":1,"publication_request":publication["publication_request"],
        "content_revision":publication["revision"],"map_revision":publication["map_revision"]}],
        "allocation":[assignment]});
    let admitted = call(project, "cadence_apply", json!({"operation":"execution-admit","request":{
        "request_id":"admit-regenerated-skill","expected_set_version":0,"contract":contract}}));
    assert_eq!(admitted["status"], "ok", "{admitted}");
    let authorized = call(project, "cadence_apply", json!({"operation":"execution-authorize",
        "phase":PHASE,"request_id":"authorize-regenerated-skill","owner":OWNER,"at":AT,
        "response":"Regenerate the binary-owned skill."}));
    assert_eq!(authorized["status"], "ok", "{authorized}");
    let dispatch = call(project, "cadence_query", json!({"operation":"execute-next","phase":PHASE}));
    assert_eq!(dispatch["outcome"], "dispatch", "{dispatch}");

    // Closing the task supersedes this dispatch, so retain its issued lease now.
    let parts = support::dispatch_parts(project, &dispatch);
    let current = rendered_task(project);
    let started = call(project, "cadence_apply", json!({"operation":"execution-task-start","request":{
        "request_id":"start-regenerated-skill","task":current["task"],
        "attempt":"attempt-regenerate-skill","expected_version":current["state"]["version"],
        "predecessor":null,"checks":[assignment["checks"][0]]}}));
    assert_eq!(started["status"], "ok", "{started}");
    fs::create_dir(project.join("tests")).unwrap();
    fs::write(project.join("tests/rendered_skill.py"), format!(
        "import pathlib, subprocess, unittest\nunittest.runner.time.perf_counter = lambda: 0.0\nclass RenderedSkill(unittest.TestCase):\n    def test_binary_output(self):\n        rendered = subprocess.run(['target/debug/cadence', 'executor-instructions'], check=True, capture_output=True, text=True).stdout\n        self.assertEqual(rendered, pathlib.Path('{RENDERED_SKILL}').read_text())\n        self.assertIn(\"The retained dispatch operational input is the binary's authority\", rendered)\nif __name__ == '__main__':\n    unittest.main()\n"
    )).unwrap();
    git(project, &["add", "tests/rendered_skill.py"]);
    git(project, &["commit", "-S", "-m", "test(38): prove regenerated skill red"]);
    let red_commit = git(project, &["rev-parse", "HEAD"]);
    let _baseline_binary = build_rendered_binary(project);
    let red = rendered_run(project, "rendered-red", "red", assignment["checks"][0].clone());
    assert_eq!(red["disposition"], json!({"kind":"exited","code":1}), "{red}");

    let instructions = project.join("crates/cadence/src/execution/instructions.rs");
    let original = fs::read_to_string(&instructions).unwrap();
    let needle = "The dispatch's operational input is the binary's authority";
    assert_eq!(original.matches(needle).count(), 1);
    fs::write(&instructions, original.replace(needle,
        "The retained dispatch operational input is the binary's authority")).unwrap();
    let changed_binary = build_rendered_binary(project);
    let rendered = Command::new(&changed_binary).arg("executor-instructions")
        .current_dir(project).stdin(Stdio::null()).output().unwrap();
    assert!(rendered.status.success(), "{}", String::from_utf8_lossy(&rendered.stderr));
    fs::write(project.join(RENDERED_SKILL), &rendered.stdout).unwrap();
    git(project, &["add", "crates/cadence/src/execution/instructions.rs", RENDERED_SKILL]);
    git(project, &["commit", "-S", "-m", "feat: deliver regenerate-skill"]);
    let green_commit = git(project, &["rev-parse", "HEAD"]);
    let green = rendered_run(project, "rendered-green", "green", assignment["checks"][0].clone());
    assert_eq!(green["disposition"], json!({"kind":"exited","code":0}), "{green}");
    let verified = rendered_run(project, "rendered-verify", "verify", Value::Null);
    assert_eq!(verified["disposition"], json!({"kind":"exited","code":0}), "{verified}");
    let events = history(project);
    let launch = events["events"].as_array().unwrap().iter().find(|record| {
        record["request"]["event"]["kind"] == "launch"
            && record["request"]["event"]["run_id"] == "rendered-red"
    }).unwrap();
    let inspection = json!({"check":assignment["checks"][0],
        "test_digest":launch["request"]["event"]["material"]["test_digest"],
        "evidence":["rendered-red","rendered-green"],"no_subject_stub":true});
    let current = rendered_task(project);
    let attested = call(project, "cadence_apply", json!({"operation":"execution-owner-attest","request":{
        "request_id":"attest-regenerated-skill","task":current["task"],
        "attempt":"attempt-regenerate-skill","expected_version":current["state"]["version"],
        "statement":{"submission":inspection,"supersedes":null,
            "approval":{"approved":true,"owner":OWNER,"at":AT,"submission":inspection}}}}));
    assert_eq!(attested["status"], "ok", "{attested}");
    let current = rendered_task(project);
    let closed = call(project, "cadence_apply", json!({"operation":"execution-task-close","request":{
        "request_id":"close-regenerated-skill","task":current["task"],
        "attempt":"attempt-regenerate-skill","expected_version":current["state"]["version"],
        "completion":green_commit,"checks":[{"check":assignment["checks"][0],
            "red_commit":red_commit,"green_commit":green_commit,
            "red_run":"rendered-red","green_run":"rendered-green"}],
        "verification":["rendered-verify"]}}));
    assert_eq!(closed["status"], "ok", "{closed}");

    let current = history(project);
    let plan = current["plans"].as_array().unwrap().iter()
        .find(|entry| entry["plan"]["plan"] == 1).unwrap();
    let mut client = Client::open(project);
    let suite = client.call("cadence_apply", json!({"operation":"execution-suite","request":{
        "request_id":"suite-regenerated-skill","plan":plan["plan"],
        "expected_version":plan["state"]["version"]}}));
    assert_eq!(suite["status"], "ok", "{suite}");
    let suite_result = support::native_result(&mut client, PHASE, "suite-regenerated-skill")["request"]["event"].clone();
    client.finish();
    let guarded = guard_rendered_skill(project, &changed_binary);

    let files = parts["lease"]["files"].as_array().unwrap();
    assert!(files.iter().any(|path| path == RENDERED_SKILL),
        "the retained dispatch lease must include {RENDERED_SKILL}: {files:?}");
    assert!(closed["receipt"]["request"]["event"]["source"]["out_of_lease"]
        .as_object().is_none_or(|paths| paths.is_empty()),
        "binary-rendered material must not be retained as a deviation: {closed}");
    assert_eq!(fs::read(project.join(RENDERED_SKILL)).unwrap(), rendered.stdout);
    assert_eq!(suite_result["disposition"], json!({"kind":"exited","code":0}));
    assert_eq!(suite_result["observation"]["class"], "results-observed",
        "suite must carry a recognized result: {suite_result}");
    assert_eq!(guarded["hookSpecificOutput"]["permissionDecision"], "deny",
        "direct Edit of {RENDERED_SKILL} must be denied: {guarded}");
}

const SUITE_COMMAND: &str = "sh tests/suite.sh";

fn repair_check(truth: &str, id: &str) -> Value {
    json!({"kind":"check","id":id,
        "reason":"The public suite lifecycle must retain the owner-gated repair.",
        "spec":{"command":COMMAND,"expected":{"kind":"property","value":"the suite repair lifecycle is retained"},
            "test":{"file":"tests/retained_prompt.py","function":"RetainedPrompt.test_answer"},
            "setup":"Complete one real task before the orchestrator launches the suite.",
            "call":"Drive the suite and repair through public stdio operations.",
            "boundary":"Real child processes, Git commits and durable public history.","fakes":[]},
        "associations":[{"truth_id":truth,"truth_version":1,
            "reason":"The check observes the promised suite lifecycle."}]})
}

fn repair_map(truth: &str, check_id: &str) -> Value {
    json!({"mode":"attached","items":[repair_check(truth, check_id),{
        "kind":"artifact","id":format!("P38-A-{truth}"),
        "reason":"The fixture task and suite are committed project programs.",
        "spec":{"locators":["src/value.py","tests/suite.sh"],
            "substance":"A committed task check and suite script exercise the lifecycle."},
        "associations":[{"truth_id":truth,"truth_version":1,
            "reason":"The committed fixture is the real process boundary."}]
    }]})
}

struct RepairEpisode {
    temp: tempfile::TempDir,
    task_close_event_count: usize,
}

impl RepairEpisode {
    fn project(&self) -> &Path { self.temp.path() }
}

fn prepare_repair_episode(truth_id: &str, check_id: &str, suite_body: &str) -> RepairEpisode {
    let temp = fixture();
    let project = temp.path();
    let truth = json!({"id":truth_id,"trigger":"the plan suite reports a failure",
        "observer":"the owner","verb":"sees","outcome":"one retained owner-gated repair lifecycle",
        "kind":"property","observable":true,"fixed_oracle":true});
    let context = call(project, "cadence_apply", support::approve(json!({"operation":"context-submit",
        "submission":{"phase":PHASE,"title":"Suite repair","scope":"One real suite repair.",
        "durable_decisions":[],"decisions":[],"assumptions":[],"truths":[truth]}})));
    assert_eq!(context["persisted"], true, "{context}");

    let evidence_map = repair_map(truth_id, check_id);
    let mut client = Client::open(project);
    let allocation = client.read("38", Some(1));
    assert_eq!(allocation["status"], "ok", "{allocation}");
    let submission = json!({"phase":PHASE,"occurrence":allocation["occurrence"],
        "request_id":format!("publish-{truth_id}"),"inventory_basis":allocation["inventory"]["basis"],
        "plans":[{"target":allocation["targets"][0],"content":{"phase":PHASE,"plan":1,
            "requirements":[truth_id],"files":["src/value.py","tests/retained_prompt.py","tests/suite.sh"],
            "directories":[],"goal":"Fixture plan","context":"Suite-repair fixture.","notes":"",
            "tasks":[{"id":"retain-prompt","title":"Retain repair prompt",
                "files":["src/value.py","tests/retained_prompt.py","tests/suite.sh"],
                "action":"Exercise the suite repair.","verify":[COMMAND]}],
            "suite":SUITE_COMMAND,"evidence_map":evidence_map}}]});
    let preview = client.call("cadence_query",
        json!({"operation":"plan-read","phase":"38","submission":submission}));
    assert_eq!(preview["status"], "ok", "{preview}");
    let published = client.call("cadence_apply",
        support::approve(json!({"operation":"plan-submit","submission":submission})));
    assert_eq!(published["persisted"], true, "{published}");
    let plans = client.read("38", None);
    let evidence = client.call("cadence_query", json!({"operation":"evidence-read","phase":PHASE}));
    client.finish();
    let publication = &plans["native"]["publications"]["1"];
    let check_revision = evidence["items"].as_array().unwrap().iter()
        .find(|item| item["id"] == check_id).unwrap()["item_revision"].clone();
    let check = json!({"id":check_id,"item_revision":check_revision});
    let assignment = json!({"plan":1,"task":"retain-prompt","checks":[check.clone()]});
    let contract = json!({"phase":PHASE,"occurrence":plans["occurrence"],"plans":[{
        "plan":1,"publication_request":publication["publication_request"],
        "content_revision":publication["revision"],"map_revision":publication["map_revision"]}],
        "allocation":[assignment]});
    let admitted = call(project, "cadence_apply", json!({"operation":"execution-admit","request":{
        "request_id":format!("admit-{truth_id}"),"expected_set_version":0,"contract":contract}}));
    assert_eq!(admitted["status"], "ok", "{admitted}");
    let authorized = call(project, "cadence_apply", json!({"operation":"execution-authorize",
        "phase":PHASE,"request_id":format!("authorize-{truth_id}"),"owner":OWNER,"at":AT,
        "response":"Run the real suite repair fixture."}));
    assert_eq!(authorized["status"], "ok", "{authorized}");
    let dispatch = call(project, "cadence_query", json!({"operation":"execute-next","phase":PHASE}));
    assert_eq!(dispatch["outcome"], "dispatch", "{dispatch}");

    let current = task(project);
    let started = call(project, "cadence_apply", json!({"operation":"execution-task-start","request":{
        "request_id":format!("start-{truth_id}"),"task":current["task"],"attempt":"attempt-retain-prompt",
        "expected_version":current["state"]["version"],"predecessor":null,"checks":[check.clone()]}}));
    assert_eq!(started["status"], "ok", "{started}");
    fs::create_dir(project.join("tests")).unwrap();
    fs::write(project.join("tests/retained_prompt.py"),
        "import sys, unittest\nsys.path.insert(0, 'src')\nfrom value import answer\nunittest.runner.time.perf_counter = lambda: 0.0\nclass RetainedPrompt(unittest.TestCase):\n    def test_answer(self):\n        self.assertEqual(answer(), 2)\nif __name__ == '__main__':\n    unittest.main()\n").unwrap();
    fs::write(project.join("tests/suite.sh"), suite_body).unwrap();
    git(project, &["add", "tests/retained_prompt.py", "tests/suite.sh"]);
    git(project, &["commit", "-S", "-m", &format!("test(38): prove {truth_id} red")]);
    let red_commit = git(project, &["rev-parse", "HEAD"]);
    let red = run(project, &format!("{truth_id}-red"), "red", check.clone());
    assert_eq!(red["disposition"], json!({"kind":"exited","code":1}), "{red}");
    fs::write(project.join("src/value.py"), "def answer():\n    return 2\n").unwrap();
    git(project, &["add", "src/value.py"]);
    git(project, &["commit", "-S", "-m", &format!("feat(38): deliver retain-prompt for {truth_id}")]);
    let green_commit = git(project, &["rev-parse", "HEAD"]);
    let green = run(project, &format!("{truth_id}-green"), "green", check.clone());
    assert_eq!(green["disposition"], json!({"kind":"exited","code":0}), "{green}");
    let verify_id = format!("{truth_id}-verify");
    let verified = run(project, &verify_id, "verify", Value::Null);
    assert_eq!(verified["disposition"], json!({"kind":"exited","code":0}), "{verified}");
    let launch = history(project)["events"].as_array().unwrap().iter().find(|record| {
        record["request"]["event"]["kind"] == "launch"
            && record["request"]["event"]["run_id"] == format!("{truth_id}-red")
    }).unwrap().clone();
    let inspection = json!({"check":check,"test_digest":launch["request"]["event"]["material"]["test_digest"],
        "evidence":[format!("{truth_id}-red"),format!("{truth_id}-green")],"no_subject_stub":true});
    let current = task(project);
    let attested = call(project, "cadence_apply", json!({"operation":"execution-owner-attest","request":{
        "request_id":format!("attest-{truth_id}"),"task":current["task"],"attempt":"attempt-retain-prompt",
        "expected_version":current["state"]["version"],"statement":{"submission":inspection,
        "supersedes":null,"approval":{"approved":true,"owner":OWNER,"at":AT,"submission":inspection}}}}));
    assert_eq!(attested["status"], "ok", "{attested}");
    let current = task(project);
    let closed = call(project, "cadence_apply", json!({"operation":"execution-task-close","request":{
        "request_id":format!("close-{truth_id}"),"task":current["task"],"attempt":"attempt-retain-prompt",
        "expected_version":current["state"]["version"],"completion":green_commit,
        "checks":[{"check":check,"red_commit":red_commit,"green_commit":green_commit,
            "red_run":format!("{truth_id}-red"),"green_run":format!("{truth_id}-green")}],
        "verification":[verify_id]}}));
    assert_eq!(closed["status"], "ok", "{closed}");
    let task_close_event_count = history(project)["events"].as_array().unwrap().len();
    let summary = fs::read(project.join(".planning/phases/38/SUMMARY.md")).unwrap();
    assert_eq!(closed["summary"], json!({"revision":cadence::store::model::digest(&summary)}));
    assert!(String::from_utf8(summary).unwrap().contains(&format!(
        "| 1 | retain-prompt | completed | {green_commit} | passed |")));
    RepairEpisode { temp, task_close_event_count }
}

fn failing_suite(names: &[&str]) -> String {
    let mut text = String::from("#!/bin/sh\n");
    for name in names { text.push_str(&format!("printf 'test {name} ... FAILED\\n'\n")); }
    text.push_str(&format!("printf 'test result: FAILED. 0 passed; {} failed; 0 ignored; 0 measured; 0 filtered out\\n'\nexit 1\n", names.len()));
    text
}

fn passing_suite() -> &'static str {
    "#!/bin/sh\nprintf 'test repair::fixed ... ok\\n'\nprintf 'test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out\\n'\n"
}

fn plan_view_for(project: &Path, plan_number: u32) -> Value {
    history(project)["plans"].as_array().unwrap().iter()
        .find(|entry| entry["plan"]["plan"] == plan_number).unwrap().clone()
}

fn plan_operation(project: &Path, operation: &str, request_id: &str, extra: Value) -> Value {
    let view = plan_view_for(project, 1);
    let mut request = json!({"request_id":request_id,"plan":view["plan"],
        "expected_version":view["state"]["version"]});
    for (key, value) in extra.as_object().unwrap() { request[key] = value.clone(); }
    json!({"operation":operation,"request":request})
}

fn launch_suite(project: &Path, id: &str, proposed_paths: &[&str]) -> (Value, Value) {
    let request = plan_operation(project, "execution-suite", id, json!({"proposed_paths":proposed_paths}));
    let mut client = Client::open(project);
    let launch = client.call("cadence_apply", request);
    assert_eq!(launch["status"], "ok", "suite launch must accept repair proposal paths: {launch}");
    let result = support::native_result(&mut client, PHASE, id)["request"]["event"].clone();
    client.finish();
    (launch, result)
}

fn repair_question(project: &Path) -> Value {
    history(project)["plan_events"].as_array().unwrap().iter()
        .find(|record| record["request"]["event"]["kind"] == "suite-repair-question")
        .unwrap().clone()
}

#[test]
fn phase38_first_red_raises_plan_repair_question() {
    let episode = prepare_repair_episode("T1", "P38-T1-C", &failing_suite(&["repair::alpha", "repair::beta"]));
    let project = episode.project();
    let (_, result) = launch_suite(project, "suite-first-red", &["src/value.py", "tests/suite.sh"]);
    assert_eq!(result["observation"]["summary"]["failed"], true, "{result}");
    let current = history(project);
    let events = current["plan_events"].as_array().unwrap();
    assert_eq!(events.iter().map(|event| event["request"]["event"]["kind"].as_str().unwrap())
        .collect::<Vec<_>>(), vec!["suite-launch", "suite-result", "suite-repair-question"]);
    let question = &events[2]["request"]["event"];
    assert_eq!(question["failed_run"], "suite-first-red");
    assert_eq!(question["failing_tests"], json!(["repair::alpha", "repair::beta"]));
    assert_eq!(question["proposed_paths"], json!(["src/value.py", "tests/suite.sh"]));
    assert_eq!(current["plans"][0]["outcome"], Value::Null, "a first red is not terminal: {current}");
    let waiting = call(project, "cadence_query", json!({"operation":"execute-next","phase":PHASE}));
    assert_eq!(waiting["status"], "refused", "{waiting}");
    assert_eq!(waiting["code"], "continuation-refusal", "{waiting}");
    assert!(waiting["reason"].as_str().unwrap().contains(question["id"].as_str().unwrap()), "{waiting}");
}

#[test]
fn phase38_approved_plan_repair_accepts_one_second_launch() {
    let episode = prepare_repair_episode("T2", "P38-T2-C", &failing_suite(&["repair::first"]));
    let project = episode.project();
    launch_suite(project, "suite-before-repair", &["tests/suite.sh"]);
    let question = repair_question(project);
    let question_id = question["request"]["event"]["id"].as_str().unwrap();
    let blank = call(project, "cadence_apply", plan_operation(project, "execution-suite-repair-answer", "answer-blank",
        json!({"question_id":question_id,"owner":"","at":AT,"disposition":"approve"})));
    assert_eq!(blank["status"], "refused", "{blank}");
    let answer_request = plan_operation(project, "execution-suite-repair-answer", "answer-repair",
        json!({"question_id":question_id,"owner":OWNER,"at":AT,"disposition":"approve"}));
    let answer = call(project, "cadence_apply", answer_request.clone());
    assert_eq!(answer["status"], "ok", "{answer}");
    assert_eq!(call(project, "cadence_apply", answer_request)["receipt"], answer["receipt"]);
    let continuation = call(project, "cadence_query", json!({"operation":"execute-next","phase":PHASE}));
    assert_eq!(continuation["outcome"], "dispatch", "{continuation}");
    assert_eq!(support::dispatch_parts(project, &continuation)["tasks"], json!([]), "completed tasks never reopen: {continuation}");
    fs::write(project.join("tests/suite.sh"), passing_suite()).unwrap();
    git(project, &["add", "tests/suite.sh"]);
    git(project, &["commit", "-S", "-m", "fix(38): repair T2 suite"]);
    let repair_commit = git(project, &["rev-parse", "HEAD"]);
    let repair = call(project, "cadence_apply", plan_operation(project, "execution-suite-repair", "record-repair",
        json!({"question_id":question_id,"commits":[repair_commit.clone()]})));
    assert_eq!(repair["status"], "ok", "{repair}");
    let (_, result) = launch_suite(project, "suite-after-repair", &[]);
    assert_eq!(result["disposition"], json!({"kind":"exited","code":0}), "{result}");
    let current = history(project);
    assert_eq!(current["events"].as_array().unwrap().len(), episode.task_close_event_count,
        "suite repair must not append to a completed task");
    assert_eq!(current["plan_events"].as_array().unwrap().iter()
        .map(|event| event["request"]["event"]["kind"].as_str().unwrap()).collect::<Vec<_>>(),
        vec!["suite-launch","suite-result","suite-repair-question","suite-repair-answer",
            "suite-repair","suite-launch","suite-result"]);
    assert_eq!(current["plans"][0]["state"]["relaunch"], Value::Null);
    assert_eq!(current["plans"][0]["state"]["launches"], json!(["suite-before-repair","suite-after-repair"]));
    assert_eq!(repair["receipt"]["request"]["event"]["commits"], json!([repair_commit]));
    assert_eq!(repair["receipt"]["request"]["event"]["changed_paths"][&repair_commit],
        json!(["tests/suite.sh"]));
    // The repaired plan settles risk over material that ends at the repair
    // commit and completes. Phase 32 plan 3 passed its second launch and could
    // not complete: the risk resolver answered the last task's completion as
    // the head while completion demanded the repair commit.
    let dispatch_id = current["active"]["id"].as_str().unwrap().to_owned();
    let risk = call(project, "cadence_apply", json!({"operation":"risk-check","request_id":"risk-repaired-plan",
        "scope":{"phase":PHASE,"occurrence":format!("phase-{PHASE}-execution"),"worker":"1"},
        "source":{"kind":"execution","plan":1,"dispatch_id":dispatch_id},"surfaces":null}));
    assert_eq!(risk["status"], "ok", "{risk}");
    assert_eq!(risk["observation"]["resolution"]["head_id"], json!(repair_commit), "risk material ends at the repair commit: {risk}");
    let complete = call(project, "cadence_apply", plan_operation(project, "execution-plan-complete", "complete-repaired-plan", json!({})));
    assert_eq!(complete["status"], "ok", "a repaired plan completes on its settlement: {complete}");
    let summary = fs::read_to_string(project.join(".planning/phases/38/SUMMARY.md")).unwrap();
    assert!(summary.contains("Status: complete"));
    assert!(summary.contains("Suite result suite-after-repair: passed"));
    assert!(summary.contains(&repair_commit));
    // The host can deliver its owner-approved count after completion too.
    let submission = json!({"dispatch_id":dispatch_id,"host":"fixture host","tokens":17,"wire_bytes":42});
    let recorded = call(project, "cadence_apply", plan_operation(project, "execution-round-record", "round-after-completion",
        json!({"statement":{"submission":submission,"approval":{"approved":true,"owner":OWNER,"at":AT,"submission":submission}}})));
    assert_eq!(recorded["status"], "ok", "{recorded}");
    let summary = fs::read_to_string(project.join(".planning/phases/38/SUMMARY.md")).unwrap();
    assert!(summary.contains("Status: complete"));
    assert!(summary.contains("Executor round tokens: 17 against 141893 (3.7 cad-executor median per dispatch, n=149, .planning/trace.jsonl, locked 2026-08-24); host fixture host; wire bytes 42"));
    assert!(summary.contains("wire bytes 42"));
}

#[test]
fn phase38_second_red_blocks_and_refuses_third_launch() {
    let episode = prepare_repair_episode("T3", "P38-T3-C", &failing_suite(&["repair::first"]));
    let project = episode.project();
    launch_suite(project, "suite-first-failure", &["tests/suite.sh", "docs/outside.md"]);
    let question = repair_question(project);
    let question_id = question["request"]["event"]["id"].as_str().unwrap();
    let answered = call(project, "cadence_apply", plan_operation(project, "execution-suite-repair-answer", "answer-second-red",
        json!({"question_id":question_id,"owner":OWNER,"at":AT,"disposition":"approve"})));
    assert_eq!(answered["status"], "ok", "{answered}");
    fs::create_dir(project.join("docs")).unwrap();
    fs::write(project.join("docs/outside.md"), "repair evidence outside the authored lease\n").unwrap();
    fs::write(project.join("tests/suite.sh"), failing_suite(&["repair::second"])).unwrap();
    git(project, &["add", "docs/outside.md", "tests/suite.sh"]);
    git(project, &["commit", "-S", "-m", "fix(38): attempt T3 suite repair"]);
    let repair_commit = git(project, &["rev-parse", "HEAD"]);
    let repaired = call(project, "cadence_apply", plan_operation(project, "execution-suite-repair", "record-second-red",
        json!({"question_id":question_id,"commits":[repair_commit.clone()]})));
    assert_eq!(repaired["status"], "ok", "{repaired}");
    let (_, second) = launch_suite(project, "suite-second-failure", &[]);
    assert_eq!(second["observation"]["summary"]["failed"], true, "{second}");
    let third = call(project, "cadence_apply", plan_operation(project, "execution-suite", "suite-third", json!({"proposed_paths":[]})));
    assert_eq!(third["status"], "refused", "{third}");
    assert_eq!(third["rule"], "suite-failed", "{third}");
    let current = history(project);
    let outcome = &current["plans"][0]["outcome"];
    assert_eq!(outcome["disposition"], "blocked", "{current}");
    assert_eq!(outcome["blockers"][0]["id"], "suite-failed:suite-second-failure");
    assert_eq!(outcome["deviations"].as_array().unwrap().iter()
        .map(|entry| entry["id"].as_str().unwrap()).collect::<Vec<_>>(),
        vec!["suite-repair:docs/outside.md"]);
    assert_eq!(outcome["deviations"][0]["evidence"], json!([{"kind":"commit","sha":repair_commit}]));
    assert_eq!(current["events"].as_array().unwrap().len(), episode.task_close_event_count);
    let blocked_outcome = outcome.clone();

    // A later admitted gap plan, artifact only under the one-check-per-truth
    // limit, repairs the suite inside its own lease and completes, which makes
    // the phase's terminal verification inputs available.
    let gap_map = json!({"mode":"attached","items":[{
        "kind":"artifact","id":"P38-A-T3-GAP",
        "reason":"The gap plan leaves the suite passing where the blocked plan could not.",
        "spec":{"locators":["tests/suite.sh"],
            "substance":"A committed passing suite script closes the blocked plan's gap."},
        "associations":[{"truth_id":"T3","truth_version":1,
            "reason":"The later completed plan is what a blocked plan needs before verification."}]
    }]});
    let mut client = Client::open(project);
    let allocation = client.read("38", Some(1));
    assert_eq!(allocation["status"], "ok", "{allocation}");
    let target = allocation["targets"][0].clone();
    assert_eq!(target["plan"], 2, "{allocation}");
    let submission = json!({"phase":PHASE,"occurrence":allocation["occurrence"],
        "request_id":"publish-gap-plan","inventory_basis":allocation["inventory"]["basis"],
        "plans":[{"target":target,"content":{"phase":PHASE,"plan":2,"requirements":["T3"],
            "files":["tests/suite.sh"],"directories":[],
            "goal":"Fixture plan","context":"Gap-plan fixture.","notes":"",
            "tasks":[{"id":"gap-plan","title":"Repair suite gap","files":["tests/suite.sh"],
                "action":"Leave the suite passing.","verify":[COMMAND]}],
            "suite":SUITE_COMMAND,"evidence_map":gap_map}}]});
    let preview = client.call("cadence_query",
        json!({"operation":"plan-read","phase":"38","submission":submission}));
    assert_eq!(preview["status"], "ok", "{preview}");
    let published = client.call("cadence_apply",
        support::approve(json!({"operation":"plan-submit","submission":submission})));
    assert_eq!(published["persisted"], true, "{published}");
    let plans = client.read("38", None);
    let evidence = client.call("cadence_query", json!({"operation":"evidence-read","phase":PHASE}));
    client.finish();
    let plan_one_revision = evidence["items"].as_array().unwrap().iter()
        .find(|item| item["id"] == "P38-T3-C").unwrap()["item_revision"].clone();
    let plan_one_check = json!({"id":"P38-T3-C","item_revision":plan_one_revision});
    let bindings = [1, 2].map(|number| {
        let publication = &plans["native"]["publications"][number.to_string()];
        json!({"plan":number,"publication_request":publication["publication_request"],
            "content_revision":publication["revision"],"map_revision":publication["map_revision"]})
    });
    let contract = json!({"phase":PHASE,"occurrence":plans["occurrence"],"plans":bindings,"allocation":[
        {"plan":1,"task":"retain-prompt","checks":[plan_one_check]},
        {"plan":2,"task":"gap-plan","checks":[]}
    ]});
    let extended = call(project, "cadence_apply", json!({"operation":"execution-extend","request":{
        "request_id":"extend-gap-plan","expected_set_version":1,"contract":contract}}));
    assert_eq!(extended["status"], "ok", "{extended}");
    let authorized = call(project, "cadence_apply", json!({"operation":"execution-authorize",
        "phase":PHASE,"request_id":"authorize-gap-plan","owner":OWNER,"at":AT,
        "response":"Run the gap plan after the blocked repair."}));
    assert_eq!(authorized["status"], "ok", "{authorized}");
    let dispatch = call(project, "cadence_query", json!({"operation":"execute-next","phase":PHASE}));
    assert_eq!(dispatch["outcome"], "dispatch", "{dispatch}");
    assert_eq!(dispatch["identities"]["plan"]["plan"], 2, "the blocked plan never redispatches: {dispatch}");

    let current = task_for(project, 2, "gap-plan");
    let started = call(project, "cadence_apply", json!({"operation":"execution-task-start","request":{
        "request_id":"start-gap-plan","task":current["task"],"attempt":"attempt-gap-plan",
        "expected_version":current["state"]["version"],"predecessor":null,"checks":[]}}));
    assert_eq!(started["status"], "ok", "{started}");
    fs::write(project.join("tests/suite.sh"), passing_suite()).unwrap();
    git(project, &["add", "tests/suite.sh"]);
    git(project, &["commit", "-S", "-m", "fix(38): deliver gap-plan suite"]);
    let gap_commit = git(project, &["rev-parse", "HEAD"]);
    let verified = run_for(project, 2, "gap-plan", "attempt-gap-plan", "gap-verify", "verify", Value::Null);
    assert_eq!(verified["disposition"], json!({"kind":"exited","code":0}), "{verified}");
    let current = task_for(project, 2, "gap-plan");
    let closed = call(project, "cadence_apply", json!({"operation":"execution-task-close","request":{
        "request_id":"close-gap-plan","task":current["task"],"attempt":"attempt-gap-plan",
        "expected_version":current["state"]["version"],"completion":gap_commit,
        "checks":[],"verification":["gap-verify"]}}));
    assert_eq!(closed["status"], "ok", "{closed}");
    let suite = launch_suite_for(project, 2, "suite-gap-plan");
    assert_eq!(suite["disposition"], json!({"kind":"exited","code":0}), "{suite}");
    let risk = call(project, "cadence_apply", json!({"operation":"risk-check",
        "request_id":"risk-gap-plan","scope":{"phase":PHASE,
            "occurrence":"phase-38-execution","worker":"2"},
        "source":{"kind":"execution","plan":2,"dispatch_id":dispatch["dispatch_id"]},
        "surfaces":null}));
    assert_eq!(risk["status"], "ok", "{risk}");
    let complete = call(project, "cadence_apply",
        plan_operation_for(project, 2, "execution-plan-complete", "complete-gap-plan", json!({})));
    assert_eq!(complete["status"], "ok", "{complete}");

    // Fresh verification inputs carry the blocked plan's outcome and the
    // plan-level repair event's Git-observed paths, unchanged by the gap plan.
    let verify = call(project, "cadence_query",
        json!({"operation":"verify-next","phase":PHASE,"request_id":"verify-gap-plan"}));
    assert_eq!(verify["status"], "ok", "{verify}");
    let saved = support::reopened(project).snapshot;
    let retained = saved.data["verification"]["attempts"].as_array().unwrap().iter().find(|a| a["id"] == verify["attempt"]["id"]).unwrap();
    let execution = &retained["inputs"]["execution"];
    let outcomes = execution["outcomes"].as_array().unwrap();
    let blocked = outcomes.iter().find(|entry| entry["plan"] == 1).unwrap();
    assert_eq!(*blocked, blocked_outcome, "{execution}");
    assert_eq!(blocked["disposition"], "blocked", "{blocked}");
    assert_eq!(blocked["blockers"].as_array().unwrap().iter()
        .map(|entry| entry["id"].as_str().unwrap()).collect::<Vec<_>>(),
        vec!["suite-failed:suite-second-failure"]);
    assert_eq!(blocked["deviations"].as_array().unwrap().iter()
        .map(|entry| entry["id"].as_str().unwrap()).collect::<Vec<_>>(),
        vec!["suite-repair:docs/outside.md"]);
    assert_eq!(blocked["deviations"][0]["evidence"], json!([{"kind":"commit","sha":repair_commit}]));
    assert_eq!(outcomes.iter().find(|entry| entry["plan"] == 2).unwrap()["disposition"], "complete", "{execution}");
    let repairs = execution["plan_events"].as_array().unwrap().iter().filter(|record| {
        record["request"]["plan"]["plan"] == 1 && record["request"]["event"]["kind"] == "suite-repair"
    }).collect::<Vec<_>>();
    assert_eq!(repairs.len(), 1, "{execution}");
    assert_eq!(repairs[0]["request"]["event"]["commits"], json!([repair_commit]));
    assert_eq!(repairs[0]["request"]["event"]["changed_paths"],
        json!({repair_commit.clone():["docs/outside.md","tests/suite.sh"]}));
}

fn task_for(project: &Path, plan: u32, id: &str) -> Value {
    history(project)["tasks"].as_array().unwrap().iter()
        .find(|entry| entry["task"]["plan"] == plan && entry["task"]["task"] == id)
        .unwrap().clone()
}

fn run_for(project: &Path, plan: u32, task_id: &str, attempt: &str,
    id: &str, stage: &str, check: Value) -> Value {
    let current = task_for(project, plan, task_id);
    let mut client = Client::open(project);
    let launched = client.call("cadence_apply", json!({"operation":"execution-run","request":{
        "request_id":id,"task":current["task"],"attempt":attempt,
        "expected_version":current["state"]["version"],"command":COMMAND,
        "check":check,"stage":stage}}));
    assert_eq!(launched["status"], "ok", "{launched}");
    let result = support::native_result(&mut client, PHASE, id)["request"]["event"].clone();
    client.finish();
    result
}

fn plan_operation_for(project: &Path, plan_number: u32, operation: &str,
    request_id: &str, extra: Value) -> Value {
    let view = plan_view_for(project, plan_number);
    let mut request = json!({"request_id":request_id,"plan":view["plan"],
        "expected_version":view["state"]["version"]});
    for (key, value) in extra.as_object().unwrap() { request[key] = value.clone(); }
    json!({"operation":operation,"request":request})
}

fn launch_suite_for(project: &Path, plan: u32, id: &str) -> Value {
    let request = plan_operation_for(project, plan, "execution-suite", id, json!({"proposed_paths":[]}));
    let mut client = Client::open(project);
    let launch = client.call("cadence_apply", request);
    assert_eq!(launch["status"], "ok", "{launch}");
    let result = support::native_result(&mut client, PHASE, id)["request"]["event"].clone();
    client.finish();
    result
}

#[test]
fn phase38_execute_next_dispatches_named_plan_first() {
    let temp = fixture();
    let project = temp.path();
    let truth = json!({"id":"T6","trigger":"the owner names the later admitted plan",
        "observer":"the owner","verb":"gets","outcome":"that plan before an earlier unfinished plan",
        "kind":"property","observable":true,"fixed_oracle":true});
    let context = call(project, "cadence_apply", support::approve(json!({"operation":"context-submit",
        "submission":{"phase":PHASE,"title":"Owner-selected plan","scope":"Two admitted plans.",
        "durable_decisions":[],"decisions":[],"assumptions":[],"truths":[truth]}})));
    assert_eq!(context["persisted"], true, "{context}");
    let evidence_map = repair_map("T6", "P38-T6-C");
    let mut client = Client::open(project);
    let allocation = client.read("38", Some(2));
    assert_eq!(allocation["status"], "ok", "{allocation}");
    let plans = [
        (1, "earlier-plan"),
        (2, "selected-plan"),
    ].into_iter().enumerate().map(|(index, (plan, task))| json!({
        "target":allocation["targets"][index],"content":{"phase":PHASE,"plan":plan,
        "requirements":["T6"],"files":["src/value.py","tests/retained_prompt.py","tests/suite.sh"],
        "directories":[],"goal":"Fixture plan","context":"Owner-selection fixture.","notes":"",
        "tasks":[{"id":task,"title":"Run selected plan",
            "files":["src/value.py","tests/retained_prompt.py","tests/suite.sh"],
            "action":"Exercise owner-selected dispatch.","verify":[COMMAND]}],
        "suite":SUITE_COMMAND,"evidence_map":evidence_map
    }})).collect::<Vec<_>>();
    let submission = json!({"phase":PHASE,"occurrence":allocation["occurrence"],
        "request_id":"publish-owner-selection","inventory_basis":allocation["inventory"]["basis"],
        "plans":plans});
    let preview = client.call("cadence_query",
        json!({"operation":"plan-read","phase":"38","submission":submission}));
    assert_eq!(preview["status"], "ok", "{preview}");
    let published = client.call("cadence_apply",
        support::approve(json!({"operation":"plan-submit","submission":submission})));
    assert_eq!(published["persisted"], true, "{published}");
    let plans = client.read("38", None);
    let evidence = client.call("cadence_query", json!({"operation":"evidence-read","phase":PHASE}));
    client.finish();
    let check_revision = evidence["items"].as_array().unwrap().iter()
        .find(|item| item["id"] == "P38-T6-C").unwrap()["item_revision"].clone();
    let check = json!({"id":"P38-T6-C","item_revision":check_revision});
    let bindings = [1,2].map(|number| {
        let publication = &plans["native"]["publications"][number.to_string()];
        json!({"plan":number,"publication_request":publication["publication_request"],
            "content_revision":publication["revision"],"map_revision":publication["map_revision"]})
    });
    let contract = json!({"phase":PHASE,"occurrence":plans["occurrence"],"plans":bindings,"allocation":[
        {"plan":1,"task":"earlier-plan","checks":[]},
        {"plan":2,"task":"selected-plan","checks":[check.clone()]}
    ]});
    let admitted = call(project, "cadence_apply", json!({"operation":"execution-admit","request":{
        "request_id":"admit-owner-selection","expected_set_version":0,"contract":contract}}));
    assert_eq!(admitted["status"], "ok", "{admitted}");
    let authorized = call(project, "cadence_apply", json!({"operation":"execution-authorize",
        "phase":PHASE,"request_id":"authorize-owner-selection","owner":OWNER,"at":AT,
        "response":"Run plan 2 before plan 1."}));
    assert_eq!(authorized["status"], "ok", "{authorized}");
    let dispatch = call(project, "cadence_query",
        json!({"operation":"execute-next","phase":PHASE,"plan":2}));
    assert_eq!(dispatch["status"], "ok", "named admitted plan must be accepted: {dispatch}");
    assert_eq!(dispatch["outcome"], "dispatch", "{dispatch}");
    assert_eq!(dispatch["identities"]["plan"]["plan"], 2, "{dispatch}");
    assert_eq!(history(project)["active"]["owner_selection"], json!({"plan":2}), "{dispatch}");
    let retained = history(project);
    assert_eq!(retained["active"]["owner_selection"], json!({"plan":2}), "{retained}");
    assert_eq!(plan_view_for(project, 1)["outcome"], Value::Null, "{retained}");

    let current = task_for(project, 2, "selected-plan");
    let started = call(project, "cadence_apply", json!({"operation":"execution-task-start","request":{
        "request_id":"start-selected-plan","task":current["task"],"attempt":"attempt-selected-plan",
        "expected_version":current["state"]["version"],"predecessor":null,"checks":[check.clone()]}}));
    assert_eq!(started["status"], "ok", "{started}");
    fs::create_dir(project.join("tests")).unwrap();
    fs::write(project.join("tests/retained_prompt.py"),
        "import sys, unittest\nsys.path.insert(0, 'src')\nfrom value import answer\nunittest.runner.time.perf_counter = lambda: 0.0\nclass RetainedPrompt(unittest.TestCase):\n    def test_answer(self):\n        self.assertEqual(answer(), 2)\nif __name__ == '__main__':\n    unittest.main()\n").unwrap();
    fs::write(project.join("tests/suite.sh"), passing_suite()).unwrap();
    git(project, &["add", "tests/retained_prompt.py", "tests/suite.sh"]);
    git(project, &["commit", "-S", "-m", "test(38): prove selected-plan red"]);
    let red_commit = git(project, &["rev-parse", "HEAD"]);
    let red = run_for(project, 2, "selected-plan", "attempt-selected-plan",
        "selected-red", "red", check.clone());
    assert_eq!(red["disposition"], json!({"kind":"exited","code":1}), "{red}");
    fs::write(project.join("src/value.py"), "def answer():\n    return 2\n").unwrap();
    git(project, &["add", "src/value.py"]);
    git(project, &["commit", "-S", "-m", "feat(38): deliver selected-plan"]);
    let green_commit = git(project, &["rev-parse", "HEAD"]);
    let green = run_for(project, 2, "selected-plan", "attempt-selected-plan",
        "selected-green", "green", check.clone());
    assert_eq!(green["disposition"], json!({"kind":"exited","code":0}), "{green}");
    let verified = run_for(project, 2, "selected-plan", "attempt-selected-plan",
        "selected-verify", "verify", Value::Null);
    assert_eq!(verified["disposition"], json!({"kind":"exited","code":0}), "{verified}");
    let red_launch = history(project)["events"].as_array().unwrap().iter().find(|record| {
        record["request"]["event"]["kind"] == "launch"
            && record["request"]["event"]["run_id"] == "selected-red"
    }).unwrap().clone();
    let inspection = json!({"check":check,"test_digest":red_launch["request"]["event"]["material"]["test_digest"],
        "evidence":["selected-red","selected-green"],"no_subject_stub":true});
    let current = task_for(project, 2, "selected-plan");
    let attested = call(project, "cadence_apply", json!({"operation":"execution-owner-attest","request":{
        "request_id":"attest-selected-plan","task":current["task"],"attempt":"attempt-selected-plan",
        "expected_version":current["state"]["version"],"statement":{"submission":inspection,
        "supersedes":null,"approval":{"approved":true,"owner":OWNER,"at":AT,"submission":inspection}}}}));
    assert_eq!(attested["status"], "ok", "{attested}");
    let current = task_for(project, 2, "selected-plan");
    let closed = call(project, "cadence_apply", json!({"operation":"execution-task-close","request":{
        "request_id":"close-selected-plan","task":current["task"],"attempt":"attempt-selected-plan",
        "expected_version":current["state"]["version"],"completion":green_commit,
        "checks":[{"check":check,"red_commit":red_commit,"green_commit":green_commit,
            "red_run":"selected-red","green_run":"selected-green"}],"verification":["selected-verify"]}}));
    assert_eq!(closed["status"], "ok", "{closed}");
    let suite = launch_suite_for(project, 2, "suite-selected-plan");
    assert_eq!(suite["disposition"], json!({"kind":"exited","code":0}), "{suite}");
    let risk = call(project, "cadence_apply", json!({"operation":"risk-check",
        "request_id":"risk-selected-plan","scope":{"phase":PHASE,
            "occurrence":"phase-38-execution","worker":"2"},
        "source":{"kind":"execution","plan":2,"dispatch_id":dispatch["dispatch_id"]},
        "surfaces":null}));
    assert_eq!(risk["status"], "ok", "{risk}");
    let complete = call(project, "cadence_apply",
        plan_operation_for(project, 2, "execution-plan-complete", "complete-selected-plan", json!({})));
    assert_eq!(complete["status"], "ok", "{complete}");
    let next = call(project, "cadence_query", json!({"operation":"execute-next","phase":PHASE}));
    assert_eq!(next["status"], "ok", "{next}");
    assert_eq!(next["outcome"], "dispatch", "{next}");
    assert_eq!(next["identities"]["plan"]["plan"], 1, "omission must retain first-ready order: {next}");
    assert_eq!(history(project)["active"]["owner_selection"], Value::Null, "{next}");
}

#[test]
fn phase38_large_suite_receipt_retains_every_failing_test_name() {
    let mut suite = String::from("#!/bin/sh\nprintf '%65540s\\n' x\n");
    for name in ["oversized::alpha", "oversized::beta", "oversized::gamma"] {
        suite.push_str(&format!("printf 'test {name} ... FAILED\\n'\n"));
    }
    suite.push_str("printf 'test result: FAILED. 0 passed; 3 failed; 0 ignored; 0 measured; 0 filtered out\\n'\nexit 1\n");
    let episode = prepare_repair_episode("T7", "P38-T7-C", &suite);
    let project = episode.project();
    let (_, result) = launch_suite(project, "suite-oversized", &[]);
    let expected = json!(["test oversized::alpha ... FAILED","test oversized::beta ... FAILED",
        "test oversized::gamma ... FAILED",
        "test result: FAILED. 0 passed; 3 failed; 0 ignored; 0 measured; 0 filtered out"]);
    assert!(result["stdout"]["text"].as_str().unwrap().len() <= 65_536, "{result}");
    assert_eq!(result["stdout"]["complete"], false, "{result}");
    assert_eq!(result["stdout"]["result_lines"], expected, "{result}");
    assert_eq!(result["observation"],
        json!({"class":"results-observed","summary":{"runner":"cargo","failed":true}}), "{result}");
    let retained = history(project)["plan_events"].as_array().unwrap().iter().find(|record| {
        record["request"]["event"]["kind"] == "suite-result"
            && record["request"]["event"]["run_id"] == "suite-oversized"
    }).unwrap().clone();
    assert_eq!(retained["request"]["event"]["stdout"]["result_lines"], expected, "{retained}");
}
