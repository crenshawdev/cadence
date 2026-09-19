//! A phase whose last admitted plan completed stores a Complete terminal; a
//! later extension must reopen native selection (D-162). Real stdio, Git and
//! durable execution state, no seeded records.
#[path = "support/phase13.rs"]
#[allow(dead_code)]
mod support;

use serde_json::{Value, json};
use std::{fs, path::Path, process::{Command, Stdio}};
use support::Client;

const PHASE: u32 = 37;
const OLD_COMMAND: &str = "python3 -B tests/old_control.py";
const OWNER: &str = "Fixture Owner";
const AT: &str = "2026-09-14T18:00:00Z";

fn call(project: &Path, tool: &str, request: Value) -> Value {
    let mut client = Client::open(project);
    let answer = client.call(tool, request);
    client.finish();
    answer
}

fn git(project: &Path, args: &[&str]) -> String {
    let output = Command::new("git")
        .args(["-c", "user.name=Cadence-Reopen", "-c", "user.email=reopen@example.invalid"])
        .args(args)
        .current_dir(project)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GNUPGHOME", project.join(".fixture-gnupg"))
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(output.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&output.stderr));
    String::from_utf8(output.stdout).unwrap().trim_end().to_owned()
}

fn fixture() -> tempfile::TempDir {
    use std::os::unix::fs::PermissionsExt;
    let temp = tempfile::tempdir().unwrap();
    let project = temp.path();
    fs::create_dir_all(project.join(".planning/phases/37")).unwrap();
    fs::create_dir(project.join(".fixture-gnupg")).unwrap();
    fs::set_permissions(project.join(".fixture-gnupg"), fs::Permissions::from_mode(0o700)).unwrap();
    let output = Command::new("gpg")
        .env("GNUPGHOME", project.join(".fixture-gnupg"))
        .args(["--batch", "--pinentry-mode", "loopback", "--passphrase", "", "--quick-generate-key",
            "Cadence-Reopen <reopen@example.invalid>", "ed25519", "sign", "0"])
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
    fs::write(project.join(".planning/ROADMAP.md"),
        "## Phases\n- [ ] **Phase 37: Reopened terminal**\n- [ ] **Phase 38: Next phase**\n").unwrap();
    fs::write(project.join(".planning/config.json"), serde_json::to_vec(&json!({
        "review":{"triggers":{"risk_surface":{"surfaces":cadence::rail::risk::CATEGORIES}}}
    })).unwrap()).unwrap();
    fs::create_dir(project.join("src")).unwrap();
    fs::write(project.join(".gitignore"), ".planning/\n.fixture-gnupg/\n__pycache__/\n").unwrap();
    fs::write(project.join("src/control.py"), "def answer():\n    return 6\n").unwrap();
    git(project, &["init", "--initial-branch=fixture/terminal-reopen"]);
    git(project, &["config", "user.signingkey", "reopen@example.invalid"]);
    git(project, &["add", ".gitignore", "src/control.py"]);
    git(project, &["commit", "-S", "-m", "Fixture terminal subject"]);
    temp
}

fn association() -> Value {
    json!([{"truth_id":"T1","truth_version":1,
        "reason":"This proves the owner-visible replacement of rejected evidence."}])
}

fn old_check() -> Value {
    json!({"kind":"check","id":"check/rejected","reason":"The original check proves the first definition.",
        "spec":{"command":OLD_COMMAND,"expected":{"kind":"property","value":"the original answer is seven"},
            "test":{"file":"tests/old_control.py","function":"OldCheck.test_answer"},
            "setup":"The completed first plan owns this exact definition.",
            "call":"Run the original public-boundary check.",
            "boundary":"Real binary over MCP stdio and durable native execution history.","fakes":[]},
        "associations":association()})
}

fn artifact() -> Value {
    json!({"kind":"artifact","id":"artifact/remains","reason":"The completed plan's non-check work remains current.",
        "spec":{"locators":["src/control.py"],"substance":"The original publication's artifact remains visible."},
        "associations":association()})
}

fn map(items: Vec<Value>) -> Value { json!({"mode":"attached","items":items}) }

fn history(project: &Path) -> Value {
    let mut answer = call(project, "cadence_query", json!({"operation":"execution-history","phase":PHASE}));
    assert_eq!(answer["status"], "ok", "{answer}");
    // Retention assertions read stored records separately from the wire index.
    let retained = support::retained_history(project, PHASE);
    answer["events"] = retained["events"].clone();
    answer["plan_events"] = retained["plan_events"].clone();
    answer
}

fn task_for(project: &Path, plan: u32, name: &str) -> Value {
    history(project)["tasks"].as_array().unwrap().iter()
        .find(|entry| entry["task"]["plan"] == plan && entry["task"]["task"] == name)
        .unwrap().clone()
}

fn run_task(project: &Path, plan: u32, name: &str, id: &str, command: &str,
    check: Value, stage: &str) -> Value
{
    let current = task_for(project, plan, name);
    let request = json!({"operation":"execution-run","request":{"request_id":id,
        "task":current["task"],"attempt":format!("attempt-{name}"),
        "expected_version":current["state"]["version"],"command":command,
        "check":check,"stage":stage}});
    let mut client = Client::open(project);
    let launched = client.call("cadence_apply", request);
    assert_eq!(launched["status"], "ok", "{launched}");
    let result = support::native_result(&mut client, PHASE, id)["request"]["event"].clone();
    client.finish();
    result
}

fn run_suite(project: &Path, plan_number: u32, id: &str) {
    let current = history(project);
    let plan = current["plans"].as_array().unwrap().iter()
        .find(|entry| entry["plan"]["plan"] == plan_number).unwrap();
    let mut client = Client::open(project);
    let launched = client.call("cadence_apply", json!({"operation":"execution-suite","request":{
        "request_id":id,"plan":plan["plan"],"expected_version":plan["state"]["version"]}}));
    assert_eq!(launched["status"], "ok", "{launched}");
    let result = support::native_result(&mut client, PHASE, id)["request"]["event"].clone();
    assert_eq!(result["disposition"], json!({"kind":"exited","code":0}));
    client.finish();
}

#[allow(clippy::too_many_arguments)]
fn complete_task(project: &Path, plan: u32, name: &str, command: &str, check: Value,
    test_file: &str, test_source: &str, green_source: &str, prefix: &str, dispatch_id: &Value)
{
    let current = task_for(project, plan, name);
    let started = call(project, "cadence_apply", json!({"operation":"execution-task-start","request":{
        "request_id":format!("start-{prefix}"),"task":current["task"],"attempt":format!("attempt-{name}"),
        "expected_version":current["state"]["version"],"predecessor":null,"checks":[check.clone()]}}));
    assert_eq!(started["status"], "ok", "{started}");

    fs::create_dir_all(project.join("tests")).unwrap();
    fs::write(project.join(test_file), test_source).unwrap();
    git(project, &["add", test_file]);
    git(project, &["commit", "-S", "-m", &format!("test(37): {prefix} red")]);
    let red = git(project, &["rev-parse", "HEAD"]);
    let red_id = format!("{prefix}-red");
    let red_result = run_task(project, plan, name, &red_id, command, check.clone(), "red");
    assert_eq!(red_result["disposition"], json!({"kind":"exited","code":1}));
    assert_eq!(red_result["observation"]["summary"]["failures"], 1);

    fs::write(project.join("src/control.py"), green_source).unwrap();
    git(project, &["add", "src/control.py"]);
    git(project, &["commit", "-S", "-m", &format!("feat(37): complete {name} ({prefix})")]);
    let green = git(project, &["rev-parse", "HEAD"]);
    let green_id = format!("{prefix}-green");
    let green_result = run_task(project, plan, name, &green_id, command, check.clone(), "green");
    assert_eq!(green_result["disposition"], json!({"kind":"exited","code":0}));
    let verify_id = format!("{prefix}-verify");
    let verify_result = run_task(project, plan, name, &verify_id, command, Value::Null, "verify");
    assert_eq!(verify_result["disposition"], json!({"kind":"exited","code":0}));

    let run = call(project, "cadence_query", json!({"operation":"execution-history","phase":PHASE,"run":red_id}));
    let launch = &run["launch"];
    let inspection = json!({"check":check,
        "test_digest":launch["request"]["event"]["material"]["test_digest"],
        "evidence":[red_id,green_id],"no_subject_stub":true});
    let current = task_for(project, plan, name);
    let attested = call(project, "cadence_apply", json!({"operation":"execution-owner-attest","request":{
        "request_id":format!("attest-{prefix}"),"task":current["task"],"attempt":format!("attempt-{name}"),
        "expected_version":current["state"]["version"],"statement":{"submission":inspection,
        "supersedes":null,"approval":{"approved":true,"owner":OWNER,"at":AT,"submission":inspection}}}}));
    assert_eq!(attested["status"], "ok", "{attested}");
    let pair = json!({"check":inspection["check"],"red_commit":red,"green_commit":green,
        "red_run":red_id,"green_run":green_id});
    let current = task_for(project, plan, name);
    let closed = call(project, "cadence_apply", json!({"operation":"execution-task-close","request":{
        "request_id":format!("close-{prefix}"),"task":current["task"],"attempt":format!("attempt-{name}"),
        "expected_version":current["state"]["version"],"completion":green,"checks":[pair],
        "verification":[verify_id]}}));
    assert_eq!(closed["status"], "ok", "{closed}");

    run_suite(project, plan, &format!("suite-{prefix}"));
    let risk = call(project, "cadence_apply", json!({"operation":"risk-check",
        "request_id":format!("risk-{prefix}"),
        "scope":{"phase":PHASE,"occurrence":"phase-37-execution","worker":plan.to_string()},
        "source":{"kind":"execution","plan":plan,"dispatch_id":dispatch_id},"surfaces":null}));
    assert_eq!(risk["status"], "ok", "{risk}");
    assert_eq!(risk["observation"]["scan"]["matches"], json!([]));
    let current = history(project);
    let plan_state = current["plans"].as_array().unwrap().iter()
        .find(|entry| entry["plan"]["plan"] == plan).unwrap();
    let completed = call(project, "cadence_apply", json!({"operation":"execution-plan-complete","request":{
        "request_id":format!("complete-{prefix}"),"plan":plan_state["plan"],
        "expected_version":plan_state["state"]["version"]}}));
    assert_eq!(completed["status"], "ok", "{completed}");
}

fn later_artifact() -> Value {
    json!({"kind":"artifact","id":"artifact/later","reason":"The later plan adds work after the phase completed.",
        "spec":{"locators":["src/control.py"],"substance":"The later publication's artifact is current."},
        "associations":association()})
}

fn bindings(plans: &Value) -> Vec<Value> {
    plans["native"]["publications"].as_object().unwrap().values().map(|publication| {
        json!({"plan":publication["identity"]["plan"],
            "publication_request":publication["publication_request"],
            "content_revision":publication["revision"],"map_revision":publication["map_revision"]})
    }).collect()
}

#[test]
fn execute_next_dispatches_a_plan_admitted_after_the_phase_completed() {
    let temp = fixture();
    let project = temp.path();
    let truth = json!({"id":"T1","trigger":"a plan is admitted after the phase completed",
        "observer":"the owner","verb":"gets","outcome":"a dispatch for that plan",
        "kind":"property","observable":true,"fixed_oracle":true});
    let context = call(project, "cadence_apply", support::approve(json!({
        "operation":"context-submit","submission":{"phase":PHASE,"title":"Reopened terminal",
        "scope":"A later admission reopens a completed phase.","durable_decisions":[],
        "decisions":[],"assumptions":[],"truths":[truth]}})));
    assert_eq!(context["persisted"], true, "{context}");

    let initial_map = map(vec![old_check(), artifact()]);
    let mut client = Client::open(project);
    let allocation = client.read("37", Some(1));
    assert_eq!(allocation["status"], "ok", "{allocation}");
    let target = allocation["targets"][0].clone();
    let submission = json!({"phase":PHASE,"occurrence":allocation["occurrence"],
        "request_id":"publish-initial-plan","inventory_basis":allocation["inventory"]["basis"],
        "plans":[{"target":target,"content":{"phase":PHASE,"plan":target["plan"],
            "requirements":["T1"],"files":["src/control.py","tests/old_control.py"],"directories":[],
            "goal":"Fixture plan","context":"Initial terminal fixture.","notes":"",
            "tasks":[{"id":"initial-owner","title":"Complete initial work",
                "files":["src/control.py","tests/old_control.py"],"action":"Exercise the initial owner.",
                "verify":[OLD_COMMAND]}],"suite":OLD_COMMAND,"evidence_map":initial_map}}]});
    let preview = client.call("cadence_query", json!({"operation":"plan-read","phase":"37",
        "submission":submission}));
    assert_eq!(preview["status"], "ok", "{preview}");
    let published = client.call("cadence_apply", support::approve(json!({
        "operation":"plan-submit","submission":submission})));
    assert_eq!(published["persisted"], true, "{published}");
    client.finish();

    let mut client = Client::open(project);
    let plans = client.read("37", None);
    let evidence = client.call("cadence_query", json!({"operation":"evidence-read","phase":PHASE}));
    client.finish();
    let old_check_revision = evidence["items"].as_array().unwrap().iter()
        .find(|item| item["id"] == "check/rejected").unwrap()["item_revision"].clone();
    let old_assignment = json!({"plan":1,"task":"initial-owner","checks":[{
        "id":"check/rejected","item_revision":old_check_revision}]});
    let old_contract = json!({"phase":PHASE,"occurrence":plans["occurrence"],"plans":bindings(&plans),
        "allocation":[old_assignment.clone()]});
    let admitted = call(project, "cadence_apply", json!({"operation":"execution-admit","request":{
        "request_id":"admit-initial-plan","expected_set_version":0,"contract":old_contract}}));
    assert_eq!(admitted["status"], "ok", "{admitted}");
    let authorized = call(project, "cadence_apply", json!({"operation":"execution-authorize",
        "phase":PHASE,"request_id":"authorize-initial-plan","owner":OWNER,"at":AT,
        "response":"Run the approved initial plan."}));
    assert_eq!(authorized["status"], "ok", "{authorized}");
    let dispatch = call(project, "cadence_query", json!({"operation":"execute-next","phase":PHASE}));
    assert_eq!(dispatch["outcome"], "dispatch", "{dispatch}");
    assert_eq!(dispatch["identities"]["plan"]["plan"], 1, "{dispatch}");
    complete_task(project, 1, "initial-owner", OLD_COMMAND, old_assignment["checks"][0].clone(),
        "tests/old_control.py",
        "import sys, unittest\nsys.path.insert(0, 'src')\nfrom control import answer\nunittest.runner.time.perf_counter = lambda: 0.0\nclass OldCheck(unittest.TestCase):\n    def test_answer(self):\n        self.assertEqual(answer(), 7)\nif __name__ == '__main__':\n    unittest.main()\n",
        "def answer():\n    return 7\n", "initial", &dispatch["dispatch_id"]);

    // Control: the phase is complete and says so.
    let finished = call(project, "cadence_query", json!({"operation":"execute-next","phase":PHASE}));
    assert_eq!(finished, json!({"status":"ok","outcome":"complete","phase":PHASE}), "{finished}");

    // A later plan for the same truth, artifact only, admitted by extension.
    let later_map = map(vec![later_artifact()]);
    let mut client = Client::open(project);
    let allocation = client.read("37", Some(1));
    assert_eq!(allocation["status"], "ok", "{allocation}");
    let target = allocation["targets"][0].clone();
    assert_eq!(target["plan"], 2, "{allocation}");
    let submission = json!({"phase":PHASE,"occurrence":allocation["occurrence"],
        "request_id":"publish-later-plan","inventory_basis":allocation["inventory"]["basis"],
        "plans":[{"target":target,"content":{"phase":PHASE,"plan":2,"requirements":["T1"],
            "files":["src/control.py"],"directories":[],
            "goal":"Fixture plan","context":"Later terminal fixture.","notes":"",
            "tasks":[{"id":"later-owner","title":"Complete later work","files":["src/control.py"],
                "action":"Exercise the later owner.","verify":[OLD_COMMAND]}],
            "suite":OLD_COMMAND,"evidence_map":later_map}}]});
    let preview = client.call("cadence_query", json!({"operation":"plan-read","phase":"37",
        "submission":submission}));
    assert_eq!(preview["status"], "ok", "{preview}");
    let published = client.call("cadence_apply", support::approve(json!({
        "operation":"plan-submit","submission":submission})));
    assert_eq!(published["persisted"], true, "{published}");
    let plans = client.read("37", None);
    client.finish();
    let contract = json!({"phase":PHASE,"occurrence":plans["occurrence"],"plans":bindings(&plans),
        "allocation":[old_assignment,{"plan":2,"task":"later-owner","checks":[]}]});
    let extended = call(project, "cadence_apply", json!({"operation":"execution-extend","request":{
        "request_id":"extend-later-plan","expected_set_version":1,"contract":contract}}));
    assert_eq!(extended["status"], "ok", "{extended}");
    assert_eq!(extended["receipt"]["set_version"], 2, "{extended}");
    let authorized = call(project, "cadence_apply", json!({"operation":"execution-authorize",
        "phase":PHASE,"request_id":"authorize-later-plan","owner":OWNER,"at":AT,
        "response":"Run the later plan."}));
    assert_eq!(authorized["status"], "ok", "{authorized}");

    let reopened = call(project, "cadence_query", json!({"operation":"execute-next","phase":PHASE}));
    assert_eq!(reopened["outcome"], "dispatch", "{reopened}");
    assert_eq!(reopened["identities"]["plan"]["plan"], 2, "{reopened}");
    assert_eq!(support::dispatch_parts(project, &reopened)["set_version"], 2, "{reopened}");
    let plan_one = history(project)["plans"].as_array().unwrap().iter()
        .find(|entry| entry["plan"]["plan"] == 1).unwrap().clone();
    assert_eq!(plan_one["state"]["outcome"], "complete", "{plan_one}");
}
