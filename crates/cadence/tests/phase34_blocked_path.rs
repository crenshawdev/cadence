//! Phase 34 acceptance checks cross the real stdio, policy, journal and filesystem boundary.
#[path = "support/phase13.rs"]
#[allow(dead_code)]
mod support;

use cadence::store::model;
use serde_json::{Value, json};
use std::{fs, path::Path, process::{Command, Stdio}};
use support::Client;

const PHASE: u32 = 34;
const COMMAND: &str = "python3 -B tests/control.py";
const OWNER: &str = "Fixture Owner";
const AT: &str = "2026-09-13T18:45:00Z";
const REASON: &str = "The retired implementation path cannot satisfy the approved contract.";

fn call(project: &Path, tool: &str, request: Value) -> Value {
    let mut client = Client::open(project);
    let answer = client.call(tool, request);
    client.finish();
    answer
}

fn git(project: &Path, args: &[&str]) -> String {
    let output = Command::new("git")
        .args(["-c", "user.name=Cadence-Phase34", "-c", "user.email=phase34@example.invalid"])
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
    fs::create_dir_all(project.join(".planning/phases/34")).unwrap();
    fs::create_dir(project.join(".fixture-gnupg")).unwrap();
    fs::set_permissions(project.join(".fixture-gnupg"), fs::Permissions::from_mode(0o700)).unwrap();
    let output = Command::new("gpg")
        .env("GNUPGHOME", project.join(".fixture-gnupg"))
        .args(["--batch", "--pinentry-mode", "loopback", "--passphrase", "", "--quick-generate-key",
            "Cadence-Phase34 <phase34@example.invalid>", "ed25519", "sign", "0"])
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
    fs::write(project.join(".planning/ROADMAP.md"),
        "## Phases\n- [ ] **Phase 34: The blocked path**\n- [ ] **Phase 35: Next phase**\n").unwrap();
    fs::write(project.join(".planning/config.json"), serde_json::to_vec(&json!({
        "review":{"triggers":{"risk_surface":{"surfaces":cadence::rail::risk::CATEGORIES}}}
    })).unwrap()).unwrap();
    fs::create_dir(project.join("src")).unwrap();
    fs::create_dir(project.join("tests")).unwrap();
    fs::write(project.join(".gitignore"), ".planning/\n.fixture-gnupg/\n__pycache__/\n").unwrap();
    fs::write(project.join("src/control.py"), "def answer():\n    return 6\n").unwrap();
    git(project, &["init", "--initial-branch=fixture/blocked"]);
    git(project, &["config", "user.signingkey", "phase34@example.invalid"]);
    git(project, &["add", ".gitignore", "src/control.py"]);
    git(project, &["commit", "-S", "-m", "Fixture phase 34 subject"]);
    temp
}

fn map(items: Vec<Value>) -> Value { json!({"mode":"attached","items":items}) }

fn association() -> Value {
    json!([{"truth_id":"T1","truth_version":1,
        "reason":"This proves the visible blocked handoff."}])
}

fn repair_association() -> Value {
    json!([{"truth_id":"T2","truth_version":1,
        "reason":"This proves the owner-visible lifecycle after a blocked plan is repaired."}])
}

fn repair_check() -> Value {
    json!({"kind":"check","id":"check/blocked-repair","reason":"Without the public flow the owner cannot observe executed after repair.",
        "spec":{"command":COMMAND,"expected":{"kind":"literal","value":"phase status is executed"},
            "test":{"file":"tests/control.py","function":"Check.test_answer"},
            "setup":"Plan 1 is retired before the later plan repairs the subject.",
            "call":"Read execution-history before and after completing the later plan.",
            "boundary":"Real owner caller through MCP stdio, durable execution and lifecycle derivation.","fakes":[]},
        "associations":repair_association()})
}

fn repair_artifact() -> Value {
    json!({"kind":"artifact","id":"artifact/blocked-repair","reason":"The blocked outcome must remain while the later plan completes.",
        "spec":{"locators":["src/control.py"],"substance":"The later admitted plan repairs the blocked work."},
        "associations":repair_association()})
}

fn check() -> Value {
    json!({"kind":"check","id":"check/retirement","reason":"Without the public flow the owner cannot observe the handoff.",
        "spec":{"command":COMMAND,"expected":{"kind":"property","value":"answer is seven"},
            "test":{"file":"tests/control.py","function":"Check.test_answer"},
            "setup":"The control subject begins at six.","call":"Run the public native execution flow.",
            "boundary":"Real owner caller through MCP stdio and durable native history.","fakes":["clock"]},
        "associations":association()})
}

fn artifact() -> Value {
    json!({"kind":"artifact","id":"artifact/retirement","reason":"The later plan keeps the same promised repair visible.",
        "spec":{"locators":["src/control.py"],"substance":"The next admitted plan can repair the retired work."},
        "associations":association()})
}

fn body(map: &Value) -> String {
    format!("# Fixture plan\n\n## Evidence map\n\n```json\n{}\n```\n\n",
        support::section_json(map, 0))
}

fn publish(project: &Path) {
    let truth = json!({"id":"T1","trigger":"the owner retires unfinished work",
        "observer":"the executor","verb":"gets","outcome":"the next admitted plan",
        "kind":"property","observable":true,"fixed_oracle":true});
    let context = call(project, "cadence_apply", support::approve(json!({
        "operation":"context-submit","submission":{"phase":PHASE,"title":"The blocked path",
        "scope":"Owner retirement only.","durable_decisions":[],"decisions":[],"assumptions":[],"truths":[truth]}
    })));
    assert_eq!(context["persisted"], true, "{context}");

    let mut client = Client::open(project);
    let allocation = client.read("34", Some(2));
    assert_eq!(allocation["status"], "ok", "{allocation}");
    let maps = [map(vec![check()]), map(vec![artifact()])];
    let plans = maps.iter().enumerate().map(|(index, evidence_map)| {
        let target = allocation["targets"][index].clone();
        let tasks = if index == 0 {
            json!([{"id":"control","verify":[COMMAND]},{"id":"retire","verify":[COMMAND]}])
        } else {
            json!([{"id":"repair","verify":[COMMAND]}])
        };
        json!({"target":target,"content":{"phase":PHASE,"plan":target["plan"],"requirements":["T1"],
            "files":["src/control.py","tests/control.py"],"directories":[],
            "execution":{"schema":1,"suite":COMMAND,"tasks":tasks},"body":body(evidence_map),
            "evidence_map":evidence_map}})
    }).collect::<Vec<_>>();
    let submission = json!({"phase":PHASE,"occurrence":allocation["occurrence"],"request_id":"publish-two-plans",
        "inventory_basis":allocation["inventory"]["basis"],"plans":plans});
    let preview = client.call("cadence_query", json!({"operation":"plan-read","phase_address":"34","submission":submission}));
    assert_eq!(preview["status"], "ok", "{preview}");
    let published = client.call("cadence_apply", support::approve(json!({"operation":"plan-submit","submission":submission})));
    assert_eq!(published["persisted"], true, "{published}");
    client.finish();
}

fn publish_blocked_plan(project: &Path) {
    let truth = json!({"id":"T2","trigger":"a blocked plan is followed by a later admitted plan that completed",
        "observer":"the owner","verb":"sees","outcome":"the phase derived as executed",
        "kind":"literal","observable":true,"fixed_oracle":true});
    let context = call(project, "cadence_apply", support::approve(json!({
        "operation":"context-submit","submission":{"phase":PHASE,"title":"The blocked path",
        "scope":"A later completed plan repairs a blocked outcome.","durable_decisions":[],
        "decisions":[],"assumptions":[],"truths":[truth]}
    })));
    assert_eq!(context["persisted"], true, "{context}");

    let mut client = Client::open(project);
    let allocation = client.read("34", Some(1));
    assert_eq!(allocation["status"], "ok", "{allocation}");
    let evidence_map = map(vec![repair_check(), repair_artifact()]);
    let target = allocation["targets"][0].clone();
    let plans = vec![json!({"target":target,"content":{"phase":PHASE,"plan":target["plan"],
        "requirements":["T2"],"files":["src/control.py"],"directories":[],
        "execution":{"schema":1,"suite":COMMAND,"tasks":[{"id":"retire","verify":[COMMAND]}]},
        "body":body(&evidence_map),"evidence_map":evidence_map}})];
    let submission = json!({"phase":PHASE,"occurrence":allocation["occurrence"],
        "request_id":"publish-blocked-repair","inventory_basis":allocation["inventory"]["basis"],
        "plans":plans});
    let preview = client.call("cadence_query", json!({"operation":"plan-read","phase_address":"34",
        "submission":submission}));
    assert_eq!(preview["status"], "ok", "{preview}");
    let published = client.call("cadence_apply", support::approve(json!({
        "operation":"plan-submit","submission":submission})));
    assert_eq!(published["persisted"], true, "{published}");
    client.finish();
}

fn contract(project: &Path) -> Value {
    let mut client = Client::open(project);
    let plans = client.read("34", None);
    let evidence = client.call("cadence_query", json!({"operation":"evidence-read","phase":PHASE}));
    client.finish();
    let publications = plans["native"]["publications"].as_object().unwrap();
    let mut bindings = Vec::new();
    let mut allocation = Vec::new();
    for publication in publications.values() {
        let plan = publication["identity"]["plan"].clone();
        bindings.push(json!({"plan":plan,"publication_request":publication["publication_request"],
            "content_revision":publication["revision"],"map_revision":publication["map_revision"]}));
        for task in publication["tasks"].as_array().unwrap() {
            let checks = if plan == 1 && task["id"] == "control" {
                let item = evidence["items"].as_array().unwrap().iter()
                    .find(|item| item["id"] == "check/retirement").unwrap();
                json!([{"id":"check/retirement","item_revision":item["item_revision"]}])
            } else { json!([]) };
            allocation.push(json!({"plan":plan,"task":task["id"],"checks":checks}));
        }
    }
    json!({"phase":PHASE,"occurrence":plans["occurrence"],"plans":bindings,"allocation":allocation})
}

fn blocked_plan_contract(project: &Path) -> Value {
    let mut client = Client::open(project);
    let plans = client.read("34", None);
    let evidence = client.call("cadence_query", json!({"operation":"evidence-read","phase":PHASE}));
    client.finish();
    let check = evidence["items"].as_array().unwrap().iter()
        .find(|item| item["id"] == "check/blocked-repair").unwrap();
    let publication = &plans["native"]["publications"]["1"];
    json!({"phase":PHASE,"occurrence":plans["occurrence"],"plans":[{
        "plan":1,"publication_request":publication["publication_request"],
        "content_revision":publication["revision"],"map_revision":publication["map_revision"]}],
        "allocation":[{"plan":1,"task":"retire","checks":[{
            "id":"check/blocked-repair","item_revision":check["item_revision"]}]}]})
}

fn history(project: &Path) -> Value {
    let value = call(project, "cadence_query", json!({"operation":"execution-history","phase":PHASE}));
    assert_eq!(value["status"], "ok", "{value}");
    value
}

fn task(project: &Path, plan: u32, name: &str) -> Value {
    history(project)["tasks"].as_array().unwrap().iter()
        .find(|entry| entry["task"]["plan"] == plan && entry["task"]["task"] == name)
        .unwrap().clone()
}

fn start(project: &Path, plan: u32, name: &str, checks: Value) -> Value {
    let current = task(project, plan, name);
    call(project, "cadence_apply", json!({"operation":"execution-task-start","request":{
        "request_id":format!("start-{name}"),"task":current["task"],"attempt":format!("attempt-{name}"),
        "expected_version":current["state"]["version"],"predecessor":null,"checks":checks}}))
}

fn run_task(project: &Path, plan: u32, name: &str, id: &str, check: Value, stage: &str) -> Value {
    let current = task(project, plan, name);
    let request = json!({"operation":"execution-run","request":{"request_id":id,"task":current["task"],
        "attempt":format!("attempt-{name}"),"expected_version":current["state"]["version"],"command":COMMAND,
        "check":check,"stage":stage}});
    let mut client = Client::open(project);
    let launched = client.call("cadence_apply", request);
    assert_eq!(launched["status"], "ok", "{launched}");
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(30);
    let result = loop {
        let current = client.call("cadence_query", json!({"operation":"execution-history","phase":PHASE}));
        if let Some(record) = current["events"].as_array().unwrap().iter()
            .find(|record| record["request"]["event"]["kind"] == "result"
                && record["request"]["event"]["run_id"] == id) {
            break record["request"]["event"].clone();
        }
        assert!(std::time::Instant::now() < deadline, "missing result {id}: {current}");
        std::thread::sleep(std::time::Duration::from_millis(10));
    };
    client.finish();
    result
}

fn close_control(project: &Path, allocated: Value) -> (String, String, Value) {
    fs::write(project.join("tests/control.py"),
        "import sys, unittest\nsys.path.insert(0, 'src')\nfrom control import answer\nunittest.runner.time.perf_counter = lambda: 0.0\nclass Check(unittest.TestCase):\n    def test_answer(self):\n        self.assertEqual(answer(), 7)\nif __name__ == '__main__':\n    unittest.main()\n").unwrap();
    git(project, &["add", "tests/control.py"]);
    git(project, &["commit", "-S", "-m", "test(34): control task red"]);
    let red = git(project, &["rev-parse", "HEAD"]);
    let result = run_task(project, 1, "control", "control-red", allocated.clone(), "red");
    assert_eq!(result["disposition"], json!({"kind":"exited","code":1}));
    assert_eq!(result["observation"]["summary"]["failures"], 1);

    fs::write(project.join("src/control.py"), "def answer():\n    return 7\n").unwrap();
    git(project, &["add", "src/control.py"]);
    git(project, &["commit", "-S", "-m", "feat(34): control task green"]);
    let green = git(project, &["rev-parse", "HEAD"]);
    let result = run_task(project, 1, "control", "control-green", allocated.clone(), "green");
    assert_eq!(result["disposition"], json!({"kind":"exited","code":0}));

    let events = history(project);
    let launch = events["events"].as_array().unwrap().iter()
        .find(|record| record["request"]["event"]["kind"] == "launch"
            && record["request"]["event"]["run_id"] == "control-red").unwrap();
    let inspection = json!({"check":allocated,"test_digest":launch["request"]["event"]["material"]["test_digest"],
        "evidence":["control-red","control-green"],"no_subject_stub":true});
    let current = task(project, 1, "control");
    let attested = call(project, "cadence_apply", json!({"operation":"execution-owner-attest","request":{
        "request_id":"attest-control","task":current["task"],"attempt":"attempt-control",
        "expected_version":current["state"]["version"],"statement":{"submission":inspection,"supersedes":null,
        "approval":{"approved":true,"owner":OWNER,"at":AT,"submission":inspection}}}}));
    assert_eq!(attested["status"], "ok", "{attested}");
    let pair = json!({"check":allocated,"red_commit":red,"green_commit":green,
        "red_run":"control-red","green_run":"control-green"});
    let current = task(project, 1, "control");
    let closed = call(project, "cadence_apply", json!({"operation":"execution-task-close","request":{
        "request_id":"close-control","task":current["task"],"attempt":"attempt-control",
        "expected_version":current["state"]["version"],"completion":green,"checks":[pair],
        "verification":["control-green"]}}));
    assert_eq!(closed["status"], "ok", "{closed}");
    (red, green, closed["receipt"].clone())
}

fn retire_request(project: &Path, plan: u32, name: &str, request_id: &str,
    owner: &str, at: &str, reason: &str) -> Value {
    let current = task(project, plan, name);
    json!({"operation":"execution-task-retire","request":{"request_id":request_id,
        "task":current["task"],"attempt":format!("attempt-{name}"),
        "expected_version":current["state"]["version"],"owner":owner,"at":at,"reason":reason}})
}

fn refused_without_history_change(project: &Path, request: Value, rule: &str, slot: &str) -> Value {
    let before = history(project);
    let answer = call(project, "cadence_apply", request);
    assert_eq!(answer["status"], "refused", "{answer}");
    assert_eq!(answer["rule"], rule, "{answer}");
    assert_eq!(answer["slot"], slot, "{answer}");
    let after = history(project);
    assert_eq!(after["events"], before["events"]);
    assert_eq!(after["plan_events"], before["plan_events"]);
    assert_eq!(after["plans"], before["plans"]);
    answer
}

#[test]
fn phase34_owner_retires_unfinished_task_and_next_plan_dispatches() {
    let fixture = fixture();
    let project = fixture.path();
    publish(project);
    let contract = contract(project);
    let admitted = call(project, "cadence_apply", json!({"operation":"execution-admit","request":{
        "request_id":"admit-two-plans","expected_set_version":0,"contract":contract}}));
    assert_eq!(admitted["status"], "ok", "{admitted}");
    let authorized = call(project, "cadence_apply", json!({"operation":"execution-authorize","phase":PHASE,
        "request_id":"authorize-retirement","owner":OWNER,"at":AT,"response":"Run the approved plans."}));
    assert_eq!(authorized["status"], "ok", "{authorized}");
    let dispatch = call(project, "cadence_query", json!({"operation":"execute-next","phase":PHASE}));
    assert_eq!(dispatch["outcome"], "dispatch", "{dispatch}");
    assert_eq!(dispatch["dispatch"]["plan"], 1);

    let allocated = contract["allocation"].as_array().unwrap().iter()
        .find(|entry| entry["plan"] == 1 && entry["task"] == "control").unwrap()["checks"][0].clone();
    assert_eq!(start(project, 1, "control", json!([allocated.clone()]))["status"], "ok");
    let (red, green, close_receipt) = close_control(project, allocated);
    assert_eq!(start(project, 1, "retire", json!([]))["status"], "ok");

    refused_without_history_change(project,
        retire_request(project, 1, "retire", "blank-owner", " ", AT, REASON),
        "task-retirement", "owner");
    refused_without_history_change(project,
        retire_request(project, 1, "retire", "blank-at", OWNER, "", REASON),
        "task-retirement", "at");
    refused_without_history_change(project,
        retire_request(project, 1, "retire", "blank-reason", OWNER, AT, "\n"),
        "task-retirement", "reason");
    refused_without_history_change(project,
        retire_request(project, 1, "control", "retire-closed", OWNER, AT, REASON),
        "task-completed", "task");
    refused_without_history_change(project,
        retire_request(project, 2, "repair", "retire-outside", OWNER, AT, REASON),
        "task-active", "task");

    let request = retire_request(project, 1, "retire", "retire-current", OWNER, AT, REASON);
    let before = history(project);
    let retired = call(project, "cadence_apply", request.clone());
    assert_eq!(retired["status"], "ok", "{retired}");
    assert_eq!(retired["receipt"]["request"]["event"], json!({
        "kind":"retirement","owner":OWNER,"at":AT,"reason":REASON
    }));
    assert_eq!(retired["outcome"]["disposition"], "blocked");
    assert_eq!(retired["outcome"]["blockers"], json!([{
        "id":"task-retired:retire","text":REASON,"evidence":[]
    }]));
    assert_eq!(retired["outcome"]["tasks"][0]["status"], "completed");
    assert_eq!(retired["outcome"]["tasks"][0]["task_id"], "control");
    assert_eq!(retired["outcome"]["tasks"][0]["commit"], green);
    assert_eq!(retired["outcome"]["tasks"][0]["evidence"], json!([
        {"kind":"commit","sha":red},{"kind":"commit","sha":green}
    ]));
    assert_eq!(retired["outcome"]["tasks"][1], json!({
        "status":"blocked","task_id":"retire","blocker_id":"task-retired:retire"
    }));
    assert_eq!(retired["outcome"]["deviations"], json!([]), "an in-lease completion records no deviation");
    assert_eq!(retired["outcome"]["transition_id"], retired["receipt"]["request_digest"]);
    assert_eq!(close_receipt["request"]["request_id"], "close-control");

    let after = history(project);
    assert_eq!(after["events"].as_array().unwrap().len(), before["events"].as_array().unwrap().len() + 1);
    assert_eq!(after["events"].as_array().unwrap().last().unwrap(), &retired["receipt"]);
    assert_eq!(after["plans"][0]["state"]["outcome"], "pending",
        "retirement is a task event, not a suite or completion event");
    assert_eq!(after["plan_events"], json!([]));

    let replay = call(project, "cadence_apply", request.clone());
    assert_eq!(replay, retired);
    assert_eq!(history(project)["events"], after["events"]);
    let mut changed = request;
    changed["request"]["reason"] = json!("Changed retirement bytes.");
    refused_without_history_change(project, changed, "task-request-reuse", "request_id");

    let snapshot = support::reopened(project).snapshot;
    let occurrence = &snapshot.data["execution"]["occurrences"][PHASE.to_string()];
    assert!(occurrence["active"].is_null(), "{occurrence}");
    assert!(occurrence["terminal"].is_null(), "retirement must not manufacture JudgmentStop: {occurrence}");
    assert_eq!(occurrence["plans"], json!([retired["outcome"].clone()]));

    let next = call(project, "cadence_query", json!({"operation":"execute-next","phase":PHASE}));
    assert_eq!(next["status"], "ok", "{next}");
    assert_eq!(next["outcome"], "dispatch", "{next}");
    assert_eq!(next["dispatch"]["plan"], 2, "{next}");
    assert_ne!(next["outcome"], "complete");
    assert_ne!(next["outcome"], "judgment-stop");
    let final_history = history(project);
    assert_eq!(final_history["events"], after["events"]);
    assert_eq!(model::digest(&serde_json::to_vec(&retired["receipt"]).unwrap()).len(), 64);
}

#[test]
fn out_of_lease_completion_paths_are_retained_as_deviations() {
    // D-170: a planner's file list is not a gate. A completion commit that touches a
    // path outside the admitted lease closes, and every such path is written on the
    // plan record as a deviation, named per file, with the commit as its evidence.
    let fixture = fixture();
    let project = fixture.path();
    publish(project);
    let contract = contract(project);
    let admitted = call(project, "cadence_apply", json!({"operation":"execution-admit","request":{
        "request_id":"admit-deviation","expected_set_version":0,"contract":contract}}));
    assert_eq!(admitted["status"], "ok", "{admitted}");
    let authorized = call(project, "cadence_apply", json!({"operation":"execution-authorize","phase":PHASE,
        "request_id":"authorize-deviation","owner":OWNER,"at":AT,"response":"Run the approved plans."}));
    assert_eq!(authorized["status"], "ok", "{authorized}");
    let dispatch = call(project, "cadence_query", json!({"operation":"execute-next","phase":PHASE}));
    assert_eq!(dispatch["outcome"], "dispatch", "{dispatch}");
    let files = dispatch["dispatch"]["files"].as_array().unwrap();
    assert_eq!(&files[..2], &json!(["src/control.py","tests/control.py"]).as_array().unwrap()[..]);
    assert_eq!(&files[2..], &cadence::execution::render::RENDERED_PROJECT_FILES.iter()
        .map(|rendered| json!(rendered.path)).collect::<Vec<_>>()[..]);

    let allocated = contract["allocation"].as_array().unwrap().iter()
        .find(|entry| entry["plan"] == 1 && entry["task"] == "control").unwrap()["checks"][0].clone();
    assert_eq!(start(project, 1, "control", json!([allocated.clone()]))["status"], "ok");
    fs::write(project.join("tests/control.py"),
        "import sys, unittest\nsys.path.insert(0, 'src')\nfrom control import answer\nunittest.runner.time.perf_counter = lambda: 0.0\nclass Check(unittest.TestCase):\n    def test_answer(self):\n        self.assertEqual(answer(), 7)\nif __name__ == '__main__':\n    unittest.main()\n").unwrap();
    git(project, &["add", "tests/control.py"]);
    git(project, &["commit", "-S", "-m", "test(34): control task red"]);
    let red = git(project, &["rev-parse", "HEAD"]);
    let result = run_task(project, 1, "control", "control-red", allocated.clone(), "red");
    assert_eq!(result["disposition"], json!({"kind":"exited","code":1}));

    fs::create_dir_all(project.join("docs")).unwrap();
    fs::write(project.join("src/control.py"), "def answer():\n    return 7\n").unwrap();
    fs::write(project.join("docs/outside.md"), "written outside the lease\n").unwrap();
    git(project, &["add", "src/control.py", "docs/outside.md"]);
    git(project, &["commit", "-S", "-m", "feat(34): control task green"]);
    let green = git(project, &["rev-parse", "HEAD"]);
    let result = run_task(project, 1, "control", "control-green", allocated.clone(), "green");
    assert_eq!(result["disposition"], json!({"kind":"exited","code":0}));

    let events = history(project);
    let launch = events["events"].as_array().unwrap().iter()
        .find(|record| record["request"]["event"]["kind"] == "launch"
            && record["request"]["event"]["run_id"] == "control-red").unwrap();
    let inspection = json!({"check":allocated,"test_digest":launch["request"]["event"]["material"]["test_digest"],
        "evidence":["control-red","control-green"],"no_subject_stub":true});
    let current = task(project, 1, "control");
    let attested = call(project, "cadence_apply", json!({"operation":"execution-owner-attest","request":{
        "request_id":"attest-control","task":current["task"],"attempt":"attempt-control",
        "expected_version":current["state"]["version"],"statement":{"submission":inspection,"supersedes":null,
        "approval":{"approved":true,"owner":OWNER,"at":AT,"submission":inspection}}}}));
    assert_eq!(attested["status"], "ok", "{attested}");
    let pair = json!({"check":allocated,"red_commit":red,"green_commit":green,
        "red_run":"control-red","green_run":"control-green"});
    let current = task(project, 1, "control");
    let closed = call(project, "cadence_apply", json!({"operation":"execution-task-close","request":{
        "request_id":"close-control","task":current["task"],"attempt":"attempt-control",
        "expected_version":current["state"]["version"],"completion":green,"checks":[pair],
        "verification":["control-green"]}}));
    assert_eq!(closed["status"], "ok", "the out-of-lease path must not refuse the close: {closed}");
    let source = &closed["receipt"]["request"]["event"]["source"];
    assert_eq!(source["out_of_lease"], json!({green.clone(): ["docs/outside.md"]}), "{source}");
    assert_eq!(source["commit_paths"][&green], json!(["docs/outside.md","src/control.py"]), "{source}");

    assert_eq!(start(project, 1, "retire", json!([]))["status"], "ok");
    let retired = call(project, "cadence_apply",
        retire_request(project, 1, "retire", "retire-current", OWNER, AT, REASON));
    assert_eq!(retired["status"], "ok", "{retired}");
    assert_eq!(retired["outcome"]["disposition"], "blocked");
    assert_eq!(retired["outcome"]["deviations"], json!([{
        "id":"out-of-lease:control:docs/outside.md",
        "text":format!("control committed docs/outside.md outside the admitted lease in {green}"),
        "evidence":[{"kind":"commit","sha":green}]
    }]), "{}", retired["outcome"]);

    let snapshot = support::reopened(project).snapshot;
    let occurrence = &snapshot.data["execution"]["occurrences"][PHASE.to_string()];
    assert_eq!(occurrence["plans"][0]["deviations"], retired["outcome"]["deviations"], "{occurrence}");
    assert_eq!(history(project)["plans"][0]["state"]["outcome"], "pending");
}

#[test]
fn phase34_blocked_then_completed_phase_is_derived_executed() {
    let fixture = fixture();
    let project = fixture.path();
    publish_blocked_plan(project);
    let contract = blocked_plan_contract(project);
    let admitted = call(project, "cadence_apply", json!({"operation":"execution-admit","request":{
        "request_id":"admit-blocked-plan","expected_set_version":0,"contract":contract}}));
    assert_eq!(admitted["status"], "ok", "{admitted}");
    let authorized = call(project, "cadence_apply", json!({"operation":"execution-authorize","phase":PHASE,
        "request_id":"authorize-blocked-plan","owner":OWNER,"at":AT,
        "response":"Run the approved blocked plan."}));
    assert_eq!(authorized["status"], "ok", "{authorized}");

    let first = call(project, "cadence_query", json!({"operation":"execute-next","phase":PHASE}));
    assert_eq!(first["outcome"], "dispatch", "{first}");
    assert_eq!(first["dispatch"]["plan"], 1);
    let old_assignment = contract["allocation"][0].clone();
    assert_eq!(start(project, 1, "retire", old_assignment["checks"].clone())["status"], "ok");
    let retired = call(project, "cadence_apply",
        retire_request(project, 1, "retire", "retire-blocked-plan", OWNER, AT, REASON));
    assert_eq!(retired["status"], "ok", "{retired}");
    assert_eq!(retired["outcome"]["disposition"], "blocked");

    let intermediate = history(project);
    assert_eq!(intermediate["phase_status"], "planned", "{intermediate}");
    assert!(!intermediate["plan_events"].as_array().unwrap().iter().any(|record|
        record["request"]["plan"]["plan"] == 1
            && record["request"]["event"]["kind"] == "completion"));
    let retired_task = intermediate["tasks"].as_array().unwrap().iter()
        .find(|entry| entry["task"]["plan"] == 1 && entry["task"]["task"] == "retire").unwrap();
    assert_eq!(retired_task["state"]["completed"], false);

    let repair_map = map(vec![repair_check()]);
    let mut client = Client::open(project);
    let allocation = client.read("34", Some(1));
    assert_eq!(allocation["status"], "ok", "{allocation}");
    let target = allocation["targets"][0].clone();
    let submission = json!({"phase":PHASE,"occurrence":allocation["occurrence"],
        "request_id":"publish-later-repair","inventory_basis":allocation["inventory"]["basis"],
        "plans":[{"target":target,"content":{"phase":PHASE,"plan":target["plan"],
            "requirements":["T2"],"files":["src/control.py","tests/control.py"],"directories":[],
            "execution":{"schema":1,"suite":COMMAND,"tasks":[{"id":"repair","verify":[COMMAND]}]},
            "body":body(&repair_map),"evidence_map":repair_map}}]});
    let preview = client.call("cadence_query", json!({"operation":"plan-read","phase_address":"34",
        "submission":submission}));
    assert_eq!(preview["status"], "ok", "{preview}");
    let published = client.call("cadence_apply", support::approve(json!({
        "operation":"plan-submit","submission":preview["submission"]
    })));
    assert_eq!(published["persisted"], true, "{published}");
    client.finish();

    let mut client = Client::open(project);
    let plans = client.read("34", None);
    let evidence = client.call("cadence_query", json!({"operation":"evidence-read","phase":PHASE}));
    client.finish();
    let check = evidence["items"].as_array().unwrap().iter()
        .find(|item| item["id"] == "check/blocked-repair").unwrap();
    let bindings = plans["native"]["publications"].as_object().unwrap().values().map(|publication| {
        json!({"plan":publication["identity"]["plan"],
            "publication_request":publication["publication_request"],
            "content_revision":publication["revision"],"map_revision":publication["map_revision"]})
    }).collect::<Vec<_>>();
    let allocated = json!({"id":"check/blocked-repair","item_revision":check["item_revision"]});
    let later_assignment = json!({"plan":2,"task":"repair","checks":[allocated.clone()]});
    let extended_contract = json!({"phase":PHASE,"occurrence":plans["occurrence"],"plans":bindings,
        "allocation":[old_assignment,later_assignment]});
    let extended = call(project, "cadence_apply", json!({"operation":"execution-extend","request":{
        "request_id":"extend-later-repair","expected_set_version":1,"contract":extended_contract}}));
    assert_eq!(extended["status"], "ok", "{extended}");
    assert_eq!(extended["receipt"]["set_version"], 2, "{extended}");
    let authorized = call(project, "cadence_apply", json!({"operation":"execution-authorize",
        "phase":PHASE,"request_id":"authorize-later-repair","owner":OWNER,"at":AT,
        "response":"Run the approved later repair."}));
    assert_eq!(authorized["status"], "ok", "{authorized}");

    let second = call(project, "cadence_query", json!({"operation":"execute-next","phase":PHASE}));
    assert_eq!(second["outcome"], "dispatch", "{second}");
    assert_eq!(second["dispatch"]["plan"], 2);
    assert_eq!(start(project, 2, "repair", json!([allocated.clone()]))["status"], "ok");

    fs::write(project.join("tests/control.py"),
        "import sys, unittest\nsys.path.insert(0, 'src')\nfrom control import answer\nunittest.runner.time.perf_counter = lambda: 0.0\nclass Check(unittest.TestCase):\n    def test_answer(self):\n        self.assertEqual(answer(), 7)\nif __name__ == '__main__':\n    unittest.main()\n").unwrap();
    git(project, &["add", "tests/control.py"]);
    git(project, &["commit", "-S", "-m", "test(34): blocked repair red"]);
    let red = git(project, &["rev-parse", "HEAD"]);
    let red_result = run_task(project, 2, "repair", "repair-red", allocated.clone(), "red");
    assert_eq!(red_result["disposition"], json!({"kind":"exited","code":1}));
    assert_eq!(red_result["observation"]["summary"]["failures"], 1);

    fs::write(project.join("src/control.py"), "def answer():\n    return 7\n").unwrap();
    git(project, &["add", "src/control.py"]);
    git(project, &["commit", "-S", "-m", "feat(34): blocked repair green"]);
    let green = git(project, &["rev-parse", "HEAD"]);
    let green_result = run_task(project, 2, "repair", "repair-green", allocated.clone(), "green");
    assert_eq!(green_result["disposition"], json!({"kind":"exited","code":0}));
    let verify_result = run_task(project, 2, "repair", "repair-verify", Value::Null, "verify");
    assert_eq!(verify_result["disposition"], json!({"kind":"exited","code":0}));

    let events = history(project);
    let launch = events["events"].as_array().unwrap().iter()
        .find(|record| record["request"]["event"]["kind"] == "launch"
            && record["request"]["event"]["run_id"] == "repair-red").unwrap();
    let inspection = json!({"check":allocated,
        "test_digest":launch["request"]["event"]["material"]["test_digest"],
        "evidence":["repair-red","repair-green"],"no_subject_stub":true});
    let current = task(project, 2, "repair");
    let attested = call(project, "cadence_apply", json!({"operation":"execution-owner-attest","request":{
        "request_id":"attest-repair","task":current["task"],"attempt":"attempt-repair",
        "expected_version":current["state"]["version"],"statement":{"submission":inspection,
        "supersedes":null,"approval":{"approved":true,"owner":OWNER,"at":AT,"submission":inspection}}}}));
    assert_eq!(attested["status"], "ok", "{attested}");
    let pair = json!({"check":allocated,"red_commit":red,"green_commit":green,
        "red_run":"repair-red","green_run":"repair-green"});
    let current = task(project, 2, "repair");
    let closed = call(project, "cadence_apply", json!({"operation":"execution-task-close","request":{
        "request_id":"close-repair","task":current["task"],"attempt":"attempt-repair",
        "expected_version":current["state"]["version"],"completion":green,"checks":[pair],
        "verification":["repair-verify"]}}));
    assert_eq!(closed["status"], "ok", "{closed}");

    let before_suite = history(project);
    let plan = before_suite["plans"].as_array().unwrap().iter()
        .find(|entry| entry["plan"]["plan"] == 2).unwrap();
    let mut client = Client::open(project);
    let suite = client.call("cadence_apply", json!({"operation":"execution-suite","request":{
        "request_id":"suite-repair","plan":plan["plan"],"expected_version":plan["state"]["version"]}}));
    assert_eq!(suite["status"], "ok", "{suite}");
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(30);
    loop {
        let current = client.call("cadence_query", json!({"operation":"execution-history","phase":PHASE}));
        if let Some(result) = current["plan_events"].as_array().unwrap().iter()
            .find(|record| record["request"]["event"]["kind"] == "suite-result"
                && record["request"]["event"]["run_id"] == "suite-repair") {
            assert_eq!(result["request"]["event"]["disposition"], json!({"kind":"exited","code":0}));
            break;
        }
        assert!(std::time::Instant::now() < deadline, "missing suite result: {current}");
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
    client.finish();

    let active = support::reopened(project).snapshot.data["execution"]["occurrences"]["34"]["active"]["id"].clone();
    let risk = call(project, "cadence_apply", json!({"operation":"risk-check","request_id":"risk-repair",
        "scope":{"phase":PHASE,"occurrence":"phase-34-execution","worker":"2"},
        "source":{"kind":"execution","plan":2,"dispatch_id":active},"surfaces":null}));
    assert_eq!(risk["status"], "ok", "{risk}");
    assert_eq!(risk["observation"]["scan"]["matches"], json!([]));
    let before_complete = history(project);
    let plan = before_complete["plans"].as_array().unwrap().iter()
        .find(|entry| entry["plan"]["plan"] == 2).unwrap();
    let completed = call(project, "cadence_apply", json!({"operation":"execution-plan-complete","request":{
        "request_id":"complete-repair","plan":plan["plan"],"expected_version":plan["state"]["version"]}}));
    assert_eq!(completed["status"], "ok", "{completed}");

    let final_history = history(project);
    assert_eq!(final_history["phase_status"], "executed", "{final_history}");
    assert_eq!(retired["outcome"]["disposition"], "blocked");
    let repaired_plan = final_history["plans"].as_array().unwrap().iter()
        .find(|entry| entry["plan"]["plan"] == 2).unwrap();
    assert_eq!(repaired_plan["state"]["outcome"], "complete");
    assert!(!final_history["plan_events"].as_array().unwrap().iter().any(|record|
        record["request"]["plan"]["plan"] == 1
            && record["request"]["event"]["kind"] == "completion"));
    let retired_task = final_history["tasks"].as_array().unwrap().iter()
        .find(|entry| entry["task"]["plan"] == 1 && entry["task"]["task"] == "retire").unwrap();
    assert_eq!(retired_task["state"]["completed"], false);
}
