//! Rejected-check acceptance crosses real stdio, Git and durable execution state.
#[path = "support/phase13.rs"]
#[allow(dead_code)]
mod support;

use serde_json::{Value, json};
use std::{fs, path::Path, process::{Command, Stdio}};
use support::Client;

const PHASE: u32 = 37;
const OLD_COMMAND: &str = "python3 -B tests/old_control.py";
const NEW_COMMAND: &str = "python3 -B tests/new_control.py";
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
        .args(["-c", "user.name=Cadence-Phase37", "-c", "user.email=phase37@example.invalid"])
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
            "Cadence-Phase37 <phase37@example.invalid>", "ed25519", "sign", "0"])
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
    fs::write(project.join(".planning/ROADMAP.md"),
        "## Phases\n- [ ] **Phase 37: Rejected checks**\n- [ ] **Phase 38: Next phase**\n").unwrap();
    fs::write(project.join(".planning/config.json"), serde_json::to_vec(&json!({
        "review":{"triggers":{"risk_surface":{"surfaces":cadence::rail::risk::CATEGORIES}}}
    })).unwrap()).unwrap();
    fs::create_dir(project.join("src")).unwrap();
    fs::write(project.join(".gitignore"), ".planning/\n.fixture-gnupg/\n__pycache__/\n").unwrap();
    fs::write(project.join("src/control.py"), "def answer():\n    return 6\n").unwrap();
    git(project, &["init", "--initial-branch=fixture/rejected-checks"]);
    git(project, &["config", "user.signingkey", "phase37@example.invalid"]);
    git(project, &["add", ".gitignore", "src/control.py"]);
    git(project, &["commit", "-S", "-m", "Fixture phase 37 subject"]);
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

fn changed_check() -> Value {
    json!({"kind":"check","id":"check/rejected","reason":"The replacement check proves the changed definition.",
        "spec":{"command":NEW_COMMAND,"expected":{"kind":"literal","value":"the replacement answer is eight"},
            "test":{"file":"tests/new_control.py","function":"NewCheck.test_replacement_answer"},
            "setup":"A retained accepted verification patch rejected the original definition.",
            "call":"Run the changed public-boundary check.",
            "boundary":"Real binary over MCP stdio and durable native execution history.","fakes":[]},
        "associations":association()})
}

fn artifact() -> Value {
    json!({"kind":"artifact","id":"artifact/remains","reason":"The completed plan's non-check work remains current.",
        "spec":{"locators":["src/control.py"],"substance":"The original publication's artifact remains visible."},
        "associations":association()})
}

fn map(items: Vec<Value>) -> Value { json!({"mode":"attached","items":items}) }

fn body(map: &Value) -> String {
    format!("# Fixture plan\n\n## Evidence map\n\n```json\n{}\n```\n\n", support::section_json(map, 0))
}

fn history(project: &Path) -> Value {
    let answer = call(project, "cadence_query", json!({"operation":"execution-history","phase":PHASE}));
    assert_eq!(answer["status"], "ok", "{answer}");
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
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(30);
    let result = loop {
        let current = client.call("cadence_query", json!({"operation":"execution-history","phase":PHASE}));
        if let Some(record) = current["events"].as_array().unwrap().iter()
            .find(|record| record["request"]["event"]["kind"] == "result"
                && record["request"]["event"]["run_id"] == id)
        {
            break record["request"]["event"].clone();
        }
        assert!(std::time::Instant::now() < deadline, "missing result {id}: {current}");
        std::thread::sleep(std::time::Duration::from_millis(10));
    };
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
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(30);
    loop {
        let current = client.call("cadence_query", json!({"operation":"execution-history","phase":PHASE}));
        if let Some(result) = current["plan_events"].as_array().unwrap().iter()
            .find(|record| record["request"]["event"]["kind"] == "suite-result"
                && record["request"]["event"]["run_id"] == id)
        {
            assert_eq!(result["request"]["event"]["disposition"], json!({"kind":"exited","code":0}));
            break;
        }
        assert!(std::time::Instant::now() < deadline, "missing suite result {id}: {current}");
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
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

    let events = history(project);
    let launch = events["events"].as_array().unwrap().iter()
        .find(|record| record["request"]["event"]["kind"] == "launch"
            && record["request"]["event"]["run_id"] == red_id).unwrap();
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

struct RejectedFixture {
    temp: tempfile::TempDir,
    old_map_revision: Value,
    old_check_revision: Value,
    artifact_revision: Value,
    old_contract: Value,
}

impl RejectedFixture {
    fn new() -> Self {
        let temp = fixture();
        let project = temp.path();
        let truth = json!({"id":"T1","trigger":"verification rejects a completed plan's check",
            "observer":"the owner","verb":"sees","outcome":"a later plan can replace and re-prove that check",
            "kind":"property","observable":true,"fixed_oracle":true});
        let context = call(project, "cadence_apply", support::approve(json!({
            "operation":"context-submit","submission":{"phase":PHASE,"title":"Rejected checks",
            "scope":"Replacement after an accepted rejected verdict.","durable_decisions":[],
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
                "execution":{"schema":1,"suite":OLD_COMMAND,
                    "tasks":[{"id":"initial-owner","verify":[OLD_COMMAND]}]},
                "body":body(&initial_map),"evidence_map":initial_map}}]});
        let preview = client.call("cadence_query", json!({"operation":"plan-read","phase_address":"37",
            "submission":submission}));
        assert_eq!(preview["status"], "ok", "{preview}");
        let published = client.call("cadence_apply", support::approve(json!({
            "operation":"plan-submit","submission":preview["submission"]
        })));
        assert_eq!(published["persisted"], true, "{published}");
        let old_map_revision = published["results"][0]["map_revision"].clone();
        client.finish();

        let mut client = Client::open(project);
        let plans = client.read("37", None);
        let evidence = client.call("cadence_query", json!({"operation":"evidence-read","phase":PHASE}));
        client.finish();
        let publication = &plans["native"]["publications"]["1"];
        let old_check_revision = evidence["items"].as_array().unwrap().iter()
            .find(|item| item["id"] == "check/rejected").unwrap()["item_revision"].clone();
        let artifact_revision = evidence["items"].as_array().unwrap().iter()
            .find(|item| item["id"] == "artifact/remains").unwrap()["item_revision"].clone();
        let old_assignment = json!({"plan":1,"task":"initial-owner","checks":[{
            "id":"check/rejected","item_revision":old_check_revision}]});
        let old_contract = json!({"phase":PHASE,"occurrence":plans["occurrence"],"plans":[{
            "plan":1,"publication_request":publication["publication_request"],
            "content_revision":publication["revision"],"map_revision":publication["map_revision"]}],
            "allocation":[old_assignment]});
        let admitted = call(project, "cadence_apply", json!({"operation":"execution-admit","request":{
            "request_id":"admit-initial-plan","expected_set_version":0,"contract":old_contract}}));
        assert_eq!(admitted["status"], "ok", "{admitted}");
        let authorized = call(project, "cadence_apply", json!({"operation":"execution-authorize",
            "phase":PHASE,"request_id":"authorize-initial-plan","owner":OWNER,"at":AT,
            "response":"Run the approved initial plan."}));
        assert_eq!(authorized["status"], "ok", "{authorized}");
        let dispatch = call(project, "cadence_query", json!({"operation":"execute-next","phase":PHASE}));
        assert_eq!(dispatch["outcome"], "dispatch", "{dispatch}");
        complete_task(project, 1, "initial-owner", OLD_COMMAND,
            old_contract["allocation"][0]["checks"][0].clone(), "tests/old_control.py",
            "import sys, unittest\nsys.path.insert(0, 'src')\nfrom control import answer\nunittest.runner.time.perf_counter = lambda: 0.0\nclass OldCheck(unittest.TestCase):\n    def test_answer(self):\n        self.assertEqual(answer(), 7)\nif __name__ == '__main__':\n    unittest.main()\n",
            "def answer():\n    return 7\n", "initial", &dispatch["dispatch"]["id"]);

        let verification = call(project, "cadence_query", json!({"operation":"verify-next",
            "phase":PHASE,"request_id":"verify-initial-plan"}));
        assert_eq!(verification["status"], "ok", "{verification}");
        let patch = json!({"request_id":"reject-initial-check",
            "attempt":verification["attempt"]["id"],"basis":verification["attempt"]["inputs"]["basis"],
            "items":[
                {"id":"check/rejected","item_revision":old_check_revision,"verdict":"rejected",
                    "observed":"The original check did not prove the approved replacement behavior.","runs":[]},
                {"id":"artifact/remains","item_revision":artifact_revision,"verdict":"accepted",
                    "observed":"The original non-check artifact remains substantive.","runs":[]}
            ]});
        let rejected = call(project, "cadence_apply", json!({"operation":"verification-submit","patch":patch}));
        assert_eq!(rejected["status"], "ok", "{rejected}");

        Self { temp, old_map_revision, old_check_revision, artifact_revision, old_contract }
    }

    fn project(&self) -> &Path { self.temp.path() }
}

fn later_submission(project: &Path, id: &str, item: Value, command: &str, task: &str,
    test_file: &str) -> (Value, Value)
{
    let later_map = map(vec![item]);
    let mut client = Client::open(project);
    let allocation = client.read("37", Some(1));
    assert_eq!(allocation["status"], "ok", "{allocation}");
    let target = allocation["targets"][0].clone();
    let submission = json!({"phase":PHASE,"occurrence":allocation["occurrence"],
        "request_id":id,"inventory_basis":allocation["inventory"]["basis"],"plans":[{
            "target":target,"content":{"phase":PHASE,"plan":target["plan"],"requirements":["T1"],
            "files":["src/control.py",test_file],"directories":[],
            "execution":{"schema":1,"suite":command,"tasks":[{"id":task,"verify":[command]}]},
            "body":body(&later_map),"evidence_map":later_map}}]});
    let preview = client.call("cadence_query", json!({"operation":"plan-read","phase_address":"37",
        "submission":submission}));
    client.finish();
    (preview, target)
}

fn publish_preview(project: &Path, preview: &Value) -> Value {
    assert_eq!(preview["status"], "ok", "{preview}");
    let published = call(project, "cadence_apply", support::approve(json!({
        "operation":"plan-submit","submission":preview["submission"]
    })));
    assert_eq!(published["persisted"], true, "{published}");
    published
}

fn extended_contract(fixture: &RejectedFixture, task: &str) -> (Value, Value) {
    let project = fixture.project();
    let mut client = Client::open(project);
    let plans = client.read("37", None);
    let evidence = client.call("cadence_query", json!({"operation":"evidence-read","phase":PHASE}));
    client.finish();
    let bindings = plans["native"]["publications"].as_object().unwrap().values().map(|publication| {
        json!({"plan":publication["identity"]["plan"],
            "publication_request":publication["publication_request"],
            "content_revision":publication["revision"],"map_revision":publication["map_revision"]})
    }).collect::<Vec<_>>();
    let current_check = evidence["items"].as_array().unwrap().iter()
        .find(|item| item["id"] == "check/rejected").unwrap();
    let later_assignment = json!({"plan":2,"task":task,"checks":[{
        "id":"check/rejected","item_revision":current_check["item_revision"]}]});
    let contract = json!({"phase":PHASE,"occurrence":plans["occurrence"],"plans":bindings,
        "allocation":[fixture.old_contract["allocation"][0],later_assignment]});
    (contract, current_check.clone())
}

#[test]
fn phase37_rejected_check_can_be_republished_with_changed_spec() {
    let fixture = RejectedFixture::new();
    let project = fixture.project();
    let changed = changed_check();
    let (preview, _) = later_submission(project, "publish-changed-check", changed.clone(),
        NEW_COMMAND, "replacement-owner", "tests/new_control.py");

    assert_eq!(preview["status"], "ok", "{preview}");
    assert_eq!(preview["submission"]["plans"][0]["content"]["evidence_map"]["items"], json!([changed]));
    assert_eq!(preview["coverage"]["uncovered"], json!([]));
    assert_eq!(preview["coverage"]["without_check"], json!([]));
    publish_preview(project, &preview);

    let evidence = call(project, "cadence_query", json!({"operation":"evidence-read","phase":PHASE}));
    assert_eq!(evidence["schema"], "acceptance-map-view-1");
    assert_eq!(evidence["coherence"], "consistent");
    assert_eq!(evidence["items"].as_array().unwrap().len(), 2);
    let current_artifact = evidence["items"].as_array().unwrap().iter()
        .find(|item| item["id"] == "artifact/remains").unwrap();
    let current_check = evidence["items"].as_array().unwrap().iter()
        .find(|item| item["id"] == "check/rejected").unwrap();
    assert_eq!(current_artifact["item_revision"], fixture.artifact_revision);
    assert_eq!(current_artifact["spec"], artifact()["spec"]);
    assert_eq!(current_check["spec"], changed_check()["spec"]);
    assert_ne!(current_check["item_revision"], fixture.old_check_revision);
    assert!(!evidence["aliases"].as_array().unwrap().iter()
        .any(|alias| alias["item_revision"] == fixture.old_check_revision));
    assert!(!evidence["associations"].as_array().unwrap().iter()
        .any(|edge| edge["origin"]["item_revision"] == fixture.old_check_revision));
}

#[test]
fn phase37_extension_reassigns_rejected_check() {
    let fixture = RejectedFixture::new();
    let project = fixture.project();
    let (preview, _) = later_submission(project, "publish-later-owner", old_check(),
        OLD_COMMAND, "later-owner", "tests/old_control.py");
    publish_preview(project, &preview);
    let (contract, current_check) = extended_contract(&fixture, "later-owner");
    let old_assignment = fixture.old_contract["allocation"][0].clone();
    let later_assignment = json!({"plan":2,"task":"later-owner","checks":[{
        "id":"check/rejected","item_revision":current_check["item_revision"]}]});

    let extended = call(project, "cadence_apply", json!({"operation":"execution-extend","request":{
        "request_id":"extend-later-owner","expected_set_version":1,"contract":contract.clone()}}));

    assert_eq!(extended["status"], "ok", "{extended}");
    assert_eq!(extended["receipt"]["set_version"], 2);
    assert_eq!(extended["receipt"]["request"]["contract"], contract);
    assert_eq!(extended["receipt"]["request"]["contract"]["allocation"][0], old_assignment);
    assert_eq!(extended["receipt"]["request"]["contract"]["allocation"][1], later_assignment);
}

#[test]
fn phase37_evidence_read_retains_rejected_check_as_superseded() {
    let fixture = RejectedFixture::new();
    let project = fixture.project();
    let changed = changed_check();
    let (preview, _) = later_submission(project, "publish-evidence-successor", changed.clone(),
        NEW_COMMAND, "replacement-owner", "tests/new_control.py");
    let published = publish_preview(project, &preview);
    let later_map_revision = published["results"][0]["map_revision"].clone();
    let evidence = call(project, "cadence_query", json!({"operation":"evidence-read","phase":PHASE}));
    let changed_check_revision = evidence["history"][1]["publication"]["item_revisions"]
        ["check/rejected"].clone();

    assert_eq!(evidence["status"], "ok", "{evidence}");
    assert_eq!(evidence["schema"], "acceptance-map-view-1");
    assert_eq!(evidence["coherence"], "consistent");
    assert_eq!(evidence["items"], json!([{
        "kind":"artifact","id":"artifact/remains","reason":"The completed plan's non-check work remains current.",
        "spec":artifact()["spec"],"item_revision":fixture.artifact_revision
    },{
        "kind":"check","id":"check/rejected","reason":"The replacement check proves the changed definition.",
        "spec":changed["spec"],"item_revision":changed_check_revision
    }]));
    assert_eq!(evidence["aliases"], json!([{
        "origin":{"plan":1,"map_revision":fixture.old_map_revision,
            "item_id":"artifact/remains","item_revision":fixture.artifact_revision},
        "id":"artifact/remains","item_revision":fixture.artifact_revision
    },{
        "origin":{"plan":2,"map_revision":later_map_revision,
            "item_id":"check/rejected","item_revision":changed_check_revision},
        "id":"check/rejected","item_revision":changed_check_revision
    }]));
    assert_eq!(evidence["associations"], json!([{
        "truth_id":"T1","truth_version":1,
        "reason":"This proves the owner-visible replacement of rejected evidence.",
        "origin":{"plan":1,"map_revision":fixture.old_map_revision,
            "item_id":"artifact/remains","item_revision":fixture.artifact_revision,"association_index":0}
    },{
        "truth_id":"T1","truth_version":1,
        "reason":"This proves the owner-visible replacement of rejected evidence.",
        "origin":{"plan":2,"map_revision":later_map_revision,
            "item_id":"check/rejected","item_revision":changed_check_revision,"association_index":0}
    }]));
    assert_eq!(evidence["coverage"]["uncovered"], json!([]));
    assert_eq!(evidence["coverage"]["without_check"], json!([]));
    assert_eq!(evidence["coverage"]["checks"],
        json!([{"truth_id":"T1","truth_version":1,"item_ids":["check/rejected"]}]));
    assert_eq!(evidence["history"].as_array().unwrap().len(), 2);
    let retained = &evidence["history"][0];
    assert_eq!(retained["status"], "superseded");
    assert_eq!(retained["superseded_by"], Value::Null);
    assert_eq!(retained["publication"]["revision"], fixture.old_map_revision);
    assert_eq!(retained["publication"]["items"], json!([old_check(), artifact()]));
    assert_eq!(retained["publication"]["item_revisions"]["check/rejected"], fixture.old_check_revision);
    let current = &evidence["history"][1];
    assert_eq!(current["status"], "current");
    assert_eq!(current["superseded_by"], Value::Null);
    assert_eq!(current["publication"]["revision"], later_map_revision);
    assert_eq!(current["publication"]["items"], json!([changed]));
    assert_eq!(current["publication"]["item_revisions"]["check/rejected"], changed_check_revision);
}

#[test]
fn phase37_fresh_verification_uses_only_reproved_check_definition() {
    let fixture = RejectedFixture::new();
    let project = fixture.project();
    let changed = changed_check();
    let (preview, _) = later_submission(project, "publish-reproved-check", changed.clone(),
        NEW_COMMAND, "replacement-owner", "tests/new_control.py");
    publish_preview(project, &preview);
    let (contract, later_check) = extended_contract(&fixture, "replacement-owner");
    let later_assignment = contract["allocation"][1].clone();
    let extended = call(project, "cadence_apply", json!({"operation":"execution-extend","request":{
        "request_id":"extend-reproved-check","expected_set_version":1,"contract":contract}}));
    assert_eq!(extended["status"], "ok", "{extended}");
    assert_eq!(extended["receipt"]["request"]["contract"]["allocation"][0],
        fixture.old_contract["allocation"][0]);
    assert_eq!(extended["receipt"]["request"]["contract"]["allocation"][1], later_assignment);

    let authorized = call(project, "cadence_apply", json!({"operation":"execution-authorize",
        "phase":PHASE,"request_id":"authorize-reproved-check","owner":OWNER,"at":AT,
        "response":"Run the approved replacement plan."}));
    assert_eq!(authorized["status"], "ok", "{authorized}");
    let dispatch = call(project, "cadence_query", json!({"operation":"execute-next","phase":PHASE}));
    assert_eq!(dispatch["outcome"], "dispatch", "{dispatch}");
    assert_eq!(dispatch["dispatch"]["plan"], 2);
    complete_task(project, 2, "replacement-owner", NEW_COMMAND,
        later_assignment["checks"][0].clone(), "tests/new_control.py",
        "import sys, unittest\nsys.path.insert(0, 'src')\nfrom control import answer\nunittest.runner.time.perf_counter = lambda: 0.0\nclass NewCheck(unittest.TestCase):\n    def test_replacement_answer(self):\n        self.assertEqual(answer(), 8)\nif __name__ == '__main__':\n    unittest.main()\n",
        "def answer():\n    return 8\n", "replacement", &dispatch["dispatch"]["id"]);

    let verification = call(project, "cadence_query", json!({"operation":"verify-next",
        "phase":PHASE,"request_id":"verify-reproved-check"}));
    assert_eq!(verification["status"], "ok", "{verification}");
    let inputs = &verification["attempt"]["inputs"];
    let expected_check = json!({
        "kind":"check","id":"check/rejected","reason":"The replacement check proves the changed definition.",
        "spec":changed["spec"],"item_revision":later_check["item_revision"]
    });
    assert_eq!(inputs["checks"], json!([expected_check]));
    assert_eq!(inputs["map"]["items"], json!([{
        "kind":"artifact","id":"artifact/remains","reason":"The completed plan's non-check work remains current.",
        "spec":artifact()["spec"],"item_revision":fixture.artifact_revision
    }, expected_check]));
    assert!(!inputs["checks"].as_array().unwrap().iter()
        .any(|item| item["item_revision"] == fixture.old_check_revision));
    assert!(!inputs["map"]["items"].as_array().unwrap().iter()
        .any(|item| item["item_revision"] == fixture.old_check_revision));
}
