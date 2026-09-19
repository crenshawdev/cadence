use crate::phase13::{Client, Completed, admit_request, apply, contract, digest_of, git, git_value, query, tree, verify};
use serde_json::{Value, json};
use std::{collections::BTreeMap, fs, path::{Path, PathBuf}, time::{Duration, Instant}};

pub const OPEN: &str = "## Phases\n- [ ] **Phase 5: Legacy**\n- [ ] **Phase 13: Plan publication**\n- [ ] **Phase 28: Next phase**\n";
pub const TICKED: &str = "## Phases\n- [x] **Phase 5: Legacy**\n- [ ] **Phase 13: Plan publication**\n- [ ] **Phase 28: Next phase**\n";

/// The adoption tree's roadmap: phases 1 to 3 ticked, 4 open.
pub const LEGACY: &str = "## Phases\n- [x] **Phase 1: First**\n- [x] **Phase 2: Second**\n- [x] **Phase 3: Third**\n- [ ] **Phase 4: Fourth**\n";
/// The same roadmap after the owner ticks phase 4 by hand.
pub const LEGACY_TICKED: &str = "## Phases\n- [x] **Phase 1: First**\n- [x] **Phase 2: Second**\n- [x] **Phase 3: Third**\n- [x] **Phase 4: Fourth**\n";

pub fn progress_fixture() -> Completed {
    let fixture = Completed::new();
    let root = fixture.project().join(".planning");
    fs::write(root.join("ROADMAP.md"), OPEN).unwrap();
    fs::create_dir_all(root.join("phases/5")).unwrap();
    fs::write(root.join("phases/5/PLAN-1.md"), "---\nphase: 5\nplan: 1\n---\n# Legacy plan\n\n## Tasks\n\n### Task 1: Deliver legacy work\n\n- **Files:** src/legacy.rs\n- **Action:** Deliver the legacy work.\n- **Verify:** cargo test\n").unwrap();
    fs::create_dir_all(root.join("deferred/5")).unwrap();
    fs::write(root.join("deferred/5/DEFERRED-diff-1.json"),
        r#"{"phase":"5","trigger":"diff","discriminator":"1","round":1,"findings":[{"description":"Review the legacy work"}]}"#).unwrap();
    fixture
}

/// A legacy tree no binary has touched: phase 1 derives complete (SUMMARY and
/// a passing UAT), phase 2 is ticked with one failing UAT item, phase 3 is
/// ticked with a plan only, phase 4 is open with a plan. One baseline commit.
pub fn legacy_fixture() -> tempfile::TempDir {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join(".planning");
    for phase in 1..=4 {
        fs::create_dir_all(root.join(format!("phases/{phase}"))).unwrap();
        fs::write(root.join(format!("phases/{phase}/PLAN-1.md")),
            format!("---\nphase: {phase}\nplan: 1\n---\n# Phase {phase} plan\n\n## Tasks\n\n### Task 1: Deliver phase {phase}\n\n- **Files:** src/phase{phase}.rs\n- **Action:** Deliver the phase.\n- **Verify:** cargo test\n")).unwrap();
    }
    fs::write(root.join("ROADMAP.md"), LEGACY).unwrap();
    fs::write(root.join("config.json"), "{}\n").unwrap();
    fs::write(root.join("phases/1/SUMMARY.md"), "# Phase 1 summary\n").unwrap();
    fs::write(root.join("phases/1/UAT.md"), "## Items\n\n### 1. Done\nstatus: pass\n").unwrap();
    fs::write(root.join("phases/2/SUMMARY.md"), "# Phase 2 summary\n").unwrap();
    fs::write(root.join("phases/2/UAT.md"), "## Items\n\n### 1. A\nstatus: pass\n\n### 2. B\nstatus: pass\n\n### 3. C\nstatus: fail\n").unwrap();
    git(temp.path(), &["init", "--initial-branch=fixture/adoption"]);
    fs::write(temp.path().join(".gitignore"), ".planning/\n").unwrap();
    git(temp.path(), &["add", ".gitignore"]);
    git(temp.path(), &["commit", "-m", "Adoption fixture baseline"]);
    temp
}

/// The why fixture's commits, in the order they were made: the four that touch
/// src/thing.py, the two that record a phase, and the prune that deletes
/// phase 2 with no ARCHIVE.md heading (D-139, corrected in plan 6's notes).
pub struct WhyFixture {
    pub temp: tempfile::TempDir,
    /// The four commits touching src/thing.py, oldest first.
    pub thing: [String; 4],
    /// The commit that recorded phases/2/SUMMARY.md: the prune's parent.
    pub parent: String,
    /// The `git rm -r .planning/phases/2` commit.
    pub prune: String,
}

impl WhyFixture {
    pub fn project(&self) -> &Path { self.temp.path() }
}

/// A tracked `.planning` tree with every author and committer date fixed, so
/// the shas the checked-in expected bytes carry are the shas this builds.
fn why_git(project: &Path, day: u32, args: &[&str]) -> String {
    let date = format!("2026-01-{day:02}T00:00:00+00:00");
    let output = std::process::Command::new("git")
        .args(["-c", "commit.gpgsign=false", "-c", "core.excludesFile=/dev/null",
            "-c", "user.name=Cadence Phase14", "-c", "user.email=phase14@example.invalid"])
        .args(args).current_dir(project)
        .env("GIT_CONFIG_GLOBAL", "/dev/null").env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_AUTHOR_DATE", &date).env("GIT_COMMITTER_DATE", &date)
        .stdin(std::process::Stdio::null()).output().unwrap();
    assert!(output.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&output.stderr));
    String::from_utf8(output.stdout).unwrap().trim_end().to_owned()
}

pub const WHY_ROADMAP: &str = "## Phases\n- [x] **Phase 1: Seed**\n- [ ] **Phase 2: Double**\n";
pub const WHY_CONTEXT: &str = "# Phase 1 context\n\n## Decisions\n- D-01: thing keeps three named values, one per line\n";
pub const WHY_PLAN: &str = "---\nphase: 1\nplan: 1\n---\n# Phase 1 plan\n\n## Context\nSeeds src/thing.py.\n\n## Tasks\n\n### Task 1: Seed thing\n\n- **Files:** src/thing.py\n- **Action:** Write the three values D-01 names.\n- **Verify:** python3 -m py_compile src/thing.py\n";

/// Three commits touching src/thing.py, phase 1 recorded on disk with one
/// deviation naming D-01, phase 2 recorded and then pruned by a real
/// `git rm -r` commit, and a fourth commit touching the file after the prune.
pub fn why_fixture() -> WhyFixture {
    let temp = tempfile::tempdir().unwrap();
    let project = temp.path();
    let planning = project.join(".planning");
    why_git(project, 1, &["init", "--initial-branch=fixture/why"]);
    fs::create_dir_all(project.join("src")).unwrap();
    fs::create_dir_all(planning.join("phases/1")).unwrap();
    fs::write(planning.join("ROADMAP.md"), WHY_ROADMAP).unwrap();
    fs::write(planning.join("phases/1/CONTEXT.md"), WHY_CONTEXT).unwrap();
    fs::write(planning.join("phases/1/PLAN-1.md"), WHY_PLAN).unwrap();
    fs::write(project.join("src/thing.py"), "alpha = 1\nbeta = 2\ngamma = 3\n").unwrap();
    why_git(project, 1, &["add", "."]);
    why_git(project, 1, &["commit", "-m", "feat(1-1): seed thing with three lines"]);
    let one = why_git(project, 1, &["rev-parse", "HEAD"]);
    fs::write(project.join("src/thing.py"), "alpha = 1\nbeta = 2\ngamma = 30\n").unwrap();
    why_git(project, 2, &["commit", "-am", "feat(1-1): raise gamma"]);
    let two = why_git(project, 2, &["rev-parse", "HEAD"]);
    fs::write(planning.join("phases/1/SUMMARY.md"), format!(
        "# Phase 1 summary\n\n## Commits\n\n| plan | task | commit | description |\n|---|---|---|---|\n\
         | 1 | 1 | {} | seed thing with three lines |\n| 1 | 1 | {} | raise gamma |\n\n\
         ## Deviations\n\n- [deviation] D-01 was kept: gamma stays an integer rather than the float the plan proposed\n",
        &one[..8], &two[..8])).unwrap();
    why_git(project, 3, &["add", ".planning/phases/1/SUMMARY.md"]);
    why_git(project, 3, &["commit", "-m", "docs(1): record phase 1"]);
    fs::write(project.join("src/thing.py"), "alpha = 2\nbeta = 2\ngamma = 30\n").unwrap();
    why_git(project, 4, &["commit", "-am", "feat(2-1): double alpha"]);
    let three = why_git(project, 4, &["rev-parse", "HEAD"]);
    fs::create_dir_all(planning.join("phases/2")).unwrap();
    fs::write(planning.join("phases/2/SUMMARY.md"), format!(
        "# Phase 2 summary\n\n## Commits\n\n| plan | task | commit | description |\n|---|---|---|---|\n\
         | 1 | 1 | {} | double alpha |\n", &three[..8])).unwrap();
    why_git(project, 5, &["add", ".planning/phases/2/SUMMARY.md"]);
    why_git(project, 5, &["commit", "-m", "docs(2): record phase 2"]);
    let parent = why_git(project, 5, &["rev-parse", "HEAD"]);
    why_git(project, 6, &["rm", "-r", "-q", ".planning/phases/2"]);
    why_git(project, 6, &["commit", "-m", "chore: close phase 2 without a label"]);
    let prune = why_git(project, 6, &["rev-parse", "HEAD"]);
    fs::write(project.join("src/thing.py"), "alpha = 2\nbeta = 20\ngamma = 30\n").unwrap();
    why_git(project, 7, &["commit", "-am", "feat(3-1): raise beta after the prune"]);
    let four = why_git(project, 7, &["rev-parse", "HEAD"]);
    WhyFixture { temp, thing: [one, two, three, four], parent, prune }
}

/// A second project verified and natively completed the way
/// phase13_verification completes one; the completion record's id comes back
/// with it.
pub fn natively_completed() -> (Completed, String) {
    let fixture = Completed::new();
    let project = fixture.project();
    let (accepted, _) = verify(project, "accepted", &[]);
    let basis = query(project, json!({"operation":"verification-read","phase":13}))["current"]["observed"].clone();
    assert!(basis.is_object(), "{basis}");
    let root = project.join(".planning");
    let requirements = root.join("REQUIREMENTS.md");
    let done = apply(project, json!({"operation":"verification-complete","request_id":"complete-13","attempt":accepted["id"],"basis":basis,
        "projections":{"roadmap":digest_of(&root.join("ROADMAP.md")),"requirements":requirements.exists().then(|| digest_of(&requirements))}}));
    assert_eq!(done["status"], "ok", "{done}");
    let id = done["receipt"]["record"]["id"].as_str().unwrap().to_owned();
    (fixture, id)
}

fn task_state(client: &mut Client, plan: u32) -> Value {
    let history = client.call("cadence_query", json!({"operation":"execution-history","phase":13}));
    history["tasks"].as_array().unwrap_or(&Vec::new()).iter()
        .find(|entry| entry["task"]["plan"] == plan)
        .unwrap_or_else(|| panic!("plan {plan} has no open task: {history}")).clone()
}

fn task_run(client: &mut Client, id: &str, check: &Value, stage: &str, command: &str) -> Value {
    let state = task_state(client, 1);
    let launch = client.call("cadence_apply", json!({"operation":"execution-run","request":{
        "request_id":id,"task":state["task"],"attempt":"attempt-1",
        "expected_version":state["state"]["version"],"check":check,"stage":stage,"command":command}}));
    assert_eq!(launch["status"], "ok", "{launch}");
    let deadline = Instant::now() + Duration::from_secs(30);
    loop {
        let history = client.call("cadence_query", json!({"operation":"execution-history","phase":13,"run":id}));
        if history["result"]["request"]["event"]["kind"] == "result" {
            return history["result"]["request"]["event"].clone();
        }
        assert!(Instant::now() < deadline, "missing {id}: {history}");
        std::thread::sleep(Duration::from_millis(10));
    }
}

/// One published plan carried to the edge of its close: admitted, authorized,
/// dispatched, with a committed red run and a signed green run recorded. The
/// close request comes back unsent, so the caller decides what the worktree
/// looks like when it asks for it.
pub fn dispatched_plan() -> (Completed, Value) {
    let fixture = Completed::published(false, |_| {});
    let project = fixture.project();
    let contract = contract(project);
    let check = contract["allocation"].as_array().unwrap().iter()
        .find(|entry| entry["plan"] == 1).unwrap()["checks"][0].clone();
    assert_eq!(check["id"], "check/A", "{contract}");
    let mut client = Client::open(project);
    let admitted = client.call("cadence_apply", admit_request(contract, "admit-one", 0));
    assert_eq!(admitted["status"], "ok", "{admitted}");
    let authorized = client.call("cadence_apply", json!({"operation":"execution-authorize","phase":13,
        "request_id":"authorize-1","owner":"Fixture Owner","at":"2026-09-11T12:00:00Z",
        "response":"Proceed with native execution"}));
    assert_eq!(authorized["status"], "ok", "{authorized}");
    let dispatch = client.call("cadence_query", json!({"operation":"execute-next","phase":13}));
    assert_eq!(dispatch["status"], "ok", "{dispatch}");
    let task = task_state(&mut client, 1);
    let started = client.call("cadence_apply", json!({"operation":"execution-task-start","request":{
        "request_id":"start-1","task":task["task"],"attempt":"attempt-1","expected_version":0,
        "predecessor":null,"checks":[check.clone()]}}));
    assert_eq!(started["status"], "ok", "{started}");
    let command = "python3 -B tests/a.py";
    fs::write(project.join("tests/a.py"),
        "import sys, unittest\nsys.path.insert(0, 'src')\nfrom a import answer\n\
         unittest.runner.time.perf_counter = lambda: 0.0\nclass Check(unittest.TestCase):\n    \
         def test_answer(self):\n        self.assertEqual(answer(), 7)\n\
         if __name__ == '__main__':\n    unittest.main()\n").unwrap();
    git_value(project, &["add", "tests/a.py"]);
    git_value(project, &["commit", "-m", "test(13): red task-a"]);
    let red_commit = git_value(project, &["rev-parse", "HEAD"]);
    let red = task_run(&mut client, "red-1", &check, "red", command);
    assert_eq!(red["disposition"], json!({"kind":"exited","code":1}), "{red}");
    fs::write(project.join("src/a.py"), "def answer():\n    return 7\n").unwrap();
    git_value(project, &["add", "src/a.py"]);
    git_value(project, &["commit", "-S", "-m", "feat(13): green task-a"]);
    let green_commit = git_value(project, &["rev-parse", "HEAD"]);
    let green = task_run(&mut client, "green-1", &check, "green", command);
    assert_eq!(green["disposition"], json!({"kind":"exited","code":0}), "{green}");
    let task = task_state(&mut client, 1);
    let close = json!({"operation":"execution-task-close","request":{"request_id":"close-1",
        "task":task["task"],"attempt":"attempt-1","expected_version":task["state"]["version"],
        "completion":green_commit,"checks":[{"check":check,"red_commit":red_commit,
        "green_commit":green_commit,"red_run":"red-1","green_run":"green-1"}],
        "verification":["green-1"]}});
    client.finish();
    (fixture, close)
}

pub fn documents(project: &Path) -> BTreeMap<PathBuf, Vec<u8>> {
    tree(project).into_iter().filter_map(|(path, bytes)| {
        // Store journals and snapshots may change; every authored document and
        // the deferred input must remain byte-exact across the progress reads.
        let document = path.extension().is_some_and(|ext| ext == "md")
            || path.starts_with(".planning/deferred")
            || path == Path::new(".planning/config.json");
        document.then_some(bytes).flatten().map(|bytes| (path, bytes))
    }).collect()
}

#[allow(dead_code)]
#[path = "phase31.rs"]
pub mod exit_support;

/// The phase 33 process fixture, with two plans and an interleavable version of
/// phase 13's native completion flow. Only programs and caller inputs are fake.
pub struct WorkerRound {
    pub fixture: exit_support::ProcessFixture,
    pub client: exit_support::Client,
}

/// Import three historical routes, then retain two real native dispatches.
pub fn suggest_fixture() -> Completed {
    let mut fixture = Completed::published(false, |project| {
        let rows = [
            json!({"family":"routing","event":"resolve","phase":12,"role":"cad-executor",
                "agent":"cad-executor","effort":"high","attempt":1,"escalated":false}),
            json!({"family":"routing","event":"resolve","phase":12,"role":"cad-executor",
                "agent":"cad-executor-xhigh","effort":"xhigh","attempt":2,"escalated":true}),
            json!({"family":"routing","event":"resolve","phase":12,"role":"cad-executor",
                "agent":"cad-executor-xhigh","effort":"xhigh","attempt":2,"escalated":true}),
        ];
        let trace = rows.iter().map(|row| format!("{row}\n")).collect::<String>();
        fs::write(project.join(".planning/trace.jsonl"), trace).unwrap();
        fs::write(project.join(".planning/config.json"), serde_json::to_vec(&json!({"review":{"triggers":{
            "diff":{"gate":"blocking"},"risk_surface":{"surfaces":cadence::rail::risk::CATEGORIES}}}})).unwrap()).unwrap();
    });
    let configured = apply(fixture.project(), json!({"operation":"config-apply","layer":"repo",
        "updates":[{"key":"roles.cad-executor.effort","value":"high"}]}));
    assert_eq!(configured["status"], "ok", "{configured}");
    fixture.execute();
    let project = fixture.project();
    let admitted = apply(project, json!({"operation":"review-admit","request":{
        "replay_key":"suggest-diff","caller":"execute","trigger":"diff","specialist":null,
        "project":project.to_string_lossy(),"cycle":"live","home":{"kind":"phase","id":"13"},
        "discriminator":"suggest-diff","phase":13,"plan":1,"anchor":null,"round":1,
        "target":{"kind":"committed-range","base":fixture.pairs[0]["red_commit"],
            "head":fixture.pairs[0]["green_commit"]},"decision":null,"risk_observation":null}}));
    assert_eq!(admitted["status"], "ok", "{admitted}");
    assert!(admitted["result"]["fire"].is_string(), "{admitted}");
    // The admitted fire counts before a reviewer has answered its gate.
    let saved = super::phase13::reopened(project);
    let admission = &saved.snapshot.data["review"]["admissions"][admitted["result"]["fire"].as_str().unwrap()];
    assert_eq!(admission["gate"], "blocking");
    assert_eq!(admission["settlement"], "pending");
    fixture
}

impl WorkerRound {
    const COMMAND: &'static str = "python3 -B tests/tiny.py";

    pub fn new() -> Self {
        let fixture = exit_support::ProcessFixture::new();
        fs::write(fixture.project().join(".planning/config.json"), serde_json::to_vec(&json!({"review":{"triggers":{
            "risk_surface":{"surfaces":cadence::rail::risk::CATEGORIES}}}})).unwrap()).unwrap();
        fs::write(fixture.project().join("src/answer.py"), "def answer():\n    return 0\n").unwrap();
        exit_support::git(fixture.project(), &["add", "src/answer.py"]);
        exit_support::git(fixture.project(), &["-c", "commit.gpgsign=false", "-c", "user.name=Cadence Phase31", "-c", "user.email=phase31@example.invalid", "commit", "-m", "Fixture subject"]);
        let client = exit_support::Client::open(fixture.project());
        let mut this = Self { fixture, client };
        this.publish("context-submit", json!({"phase":31,"title":"Worker exits","scope":"Retain and continue interrupted workers.",
            "durable_decisions":[],"decisions":[],"assumptions":[],"truths":([1,2].map(|n| json!({
                "id":format!("T{n}"),"trigger":"a worker exits","observer":"the owner","verb":"sees",
                "outcome":"an interruption","kind":"property","observable":true,"fixed_oracle":true})))}));
        let allocation = this.query(json!({"operation":"plan-read","phase":31,"count":2}));
        let plans = (1..=2).map(|n| json!({"target":allocation["targets"][n-1],"content":{
            "phase":31,"plan":n,"requirements":[format!("T{n}")],"files":["src/answer.py","src/lease.rs","tests/tiny.py"],"directories":[],
            "goal":"Retain exit observations.","context":"Two tasks allow a late close.","notes":"No wall-clock timeout.",
            "tasks":(["a","b"].map(|s| json!({"id":format!("p{n}-{s}"),"title":"Deliver fixture work",
                "files":["src/answer.py","src/lease.rs","tests/tiny.py"],"action":"Deliver the fixture answer.","verify":[Self::COMMAND]}))),
            "suite":Self::COMMAND,"evidence_map":{"mode":"attached","items":[{
                "kind":"check","id":format!("check/{n}"),"reason":"Observe the answer.",
                "spec":{"command":Self::COMMAND,"expected":{"kind":"literal","value":"the expected answer"},
                    "test":{"file":"tests/tiny.py","function":"Tiny.test_answer"},"setup":"A real project.","call":"Run the subject.","boundary":"stdio","fakes":[]},
                "associations":[{"truth_id":format!("T{n}"),"truth_version":1,"reason":"Observe the answer."}]}]}}})).collect::<Vec<_>>();
        this.publish("plan-submit", json!({"phase":31,"occurrence":allocation["occurrence"],"request_id":"exit-plans",
            "inventory_basis":allocation["inventory"]["basis"],"plans":plans}));
        let evidence = this.query(json!({"operation":"evidence-read","phase":31}));
        let read = this.query(json!({"operation":"plan-read","phase":31}));
        let allocation = (1..=2).flat_map(|n| {
            let check = evidence["items"].as_array().unwrap().iter().find(|i| i["id"] == format!("check/{n}")).unwrap();
            [json!({"plan":n,"task":format!("p{n}-a"),"checks":[{"id":check["id"],"item_revision":check["item_revision"]}]}),
             json!({"plan":n,"task":format!("p{n}-b"),"checks":[]})]
        }).collect::<Vec<_>>();
        this.apply(json!({"operation":"execution-admit","request":{"request_id":"exit-admit","expected_set_version":0,"contract":{
            "phase":31,"occurrence":read["occurrence"],"allocation":allocation,
            "plans":read["native"]["publications"].as_object().unwrap().values().map(|p| json!({"plan":p["identity"]["plan"],
                "publication_request":p["publication_request"],"content_revision":p["revision"],"map_revision":p["map_revision"]})).collect::<Vec<_>>()}}}));
        this.apply(json!({"operation":"execution-authorize","phase":31,"request_id":"exit-authorize",
            "owner":"Fixture Owner","at":"2026-09-19T12:00:00Z","response":"Proceed with both plans"}));
        this
    }

    fn publish(&mut self, operation: &str, submission: Value) {
        let draft = self.apply(json!({"operation":operation,"submission":submission}));
        let answer = self.apply(json!({"operation":operation,"phase":31,"approval":{"approved":true,
            "owner":"Fixture Owner","at":"2026-09-19T12:00:00Z","submission_digest":draft["submission_digest"]}}));
        assert_eq!(answer["persisted"], true, "{answer}");
    }

    pub fn query(&mut self, request: Value) -> Value { self.client.call("cadence_query", request) }
    pub fn apply(&mut self, request: Value) -> Value {
        let answer = self.client.call("cadence_apply", request);
        assert_eq!(answer["status"], "ok", "{answer}");
        answer
    }
    pub fn issue(&mut self) -> Value {
        let answer = self.query(json!({"operation":"execute-next","phase":31}));
        assert_eq!(answer["outcome"], "dispatch", "{answer}");
        answer
    }
    pub fn progress(&mut self) -> Value {
        let answer = self.query(json!({"operation":"progress"}));
        assert_eq!(answer["status"], "ok", "{answer}");
        answer
    }
    fn task(&mut self, id: &str) -> Value {
        let history = self.query(json!({"operation":"execution-history","phase":31}));
        history["tasks"].as_array().unwrap().iter().find(|t| t["task"]["task"] == id).unwrap().clone()
    }
    fn plan(&mut self, number: u32) -> Value {
        let history = self.query(json!({"operation":"execution-history","phase":31}));
        history["plans"].as_array().unwrap().iter().find(|p| p["plan"]["plan"] == number).unwrap().clone()
    }
    fn commit(&self, paths: &[&str], subject: &str) -> String {
        let project = self.fixture.project();
        let mut args = vec!["add"];
        args.extend_from_slice(paths);
        exit_support::git(project, &args);
        exit_support::git(project, &["-c", "commit.gpgsign=false", "-c", "user.name=Cadence Phase31", "-c", "user.email=phase31@example.invalid", "commit", "-S", "-m", subject]);
        exit_support::git(project, &["rev-parse", "HEAD"])
    }
    fn run(&mut self, id: &str, stage: &str, check: Value) -> String {
        let task = self.task(id);
        let run = format!("{id}-{stage}");
        self.apply(json!({"operation":"execution-run","request":{"request_id":run,"task":task["task"],"attempt":id,
            "expected_version":task["state"]["version"],"command":Self::COMMAND,"check":check,"stage":stage}}));
        let result = self.client.wait_for_event(31, &run);
        assert_eq!(result["disposition"]["code"], if stage == "red" { 1 } else { 0 }, "{result}");
        if stage == "red" { assert_eq!(result["observation"]["summary"], json!({"runner":"unittest","failed":true,"failures":1,"errors":0})); }
        run
    }

    pub fn close_task(&mut self, plan: u32, first: bool) {
        let id = format!("p{plan}-{}", if first { "a" } else { "b" });
        let task = self.task(&id);
        let checks = if first {
            let evidence = self.query(json!({"operation":"evidence-read","phase":31}));
            let item = evidence["items"].as_array().unwrap().iter().find(|i| i["id"] == format!("check/{plan}")).unwrap();
            json!([{"id":item["id"],"item_revision":item["item_revision"]}])
        } else { json!([]) };
        self.apply(json!({"operation":"execution-task-start","request":{"request_id":format!("{id}-start"),
            "task":task["task"],"attempt":id,"expected_version":0,"predecessor":null,"checks":checks}}));
        let (completion, checks, verification) = if first {
            let check = checks[0].clone();
            fs::write(self.fixture.project().join("tests/tiny.py"), format!("import sys, unittest\nsys.path.insert(0, 'src')\nfrom answer import answer\nunittest.runner.time.perf_counter = lambda: 0.0\nclass Tiny(unittest.TestCase):\n    def test_answer(self):\n        self.assertEqual(answer(), {})\nif __name__ == '__main__':\n    unittest.main()\n", plan + 6)).unwrap();
            let red = self.commit(&["tests/tiny.py"], &format!("test(14): expect answer {id}"));
            let red_run = self.run(&id, "red", check.clone());
            fs::write(self.fixture.project().join("src/answer.py"), format!("def answer():\n    return {}\n", plan + 6)).unwrap();
            let green = self.commit(&["src/answer.py"], &format!("feat(14): deliver answer {id}"));
            let green_run = self.run(&id, "green", check.clone());
            let observed = self.query(json!({"operation":"execution-history","phase":31,"run":red_run}));
            let inspection = json!({"check":check,"test_digest":observed["launch"]["request"]["event"]["material"]["test_digest"],
                "evidence":[red_run,green_run],"no_subject_stub":true});
            let task = self.task(&id);
            self.apply(json!({"operation":"execution-owner-attest","request":{"request_id":format!("{id}-owner"),
                "task":task["task"],"attempt":id,"expected_version":task["state"]["version"],
                "statement":{"submission":inspection,"approval":{"approved":true,"owner":"Fixture Owner","at":"2026-09-19T12:00:00Z","submission":inspection}}}}));
            (green.clone(), json!([{"check":check,"red_commit":red,"green_commit":green,"red_run":red_run,"green_run":green_run}]), green_run)
        } else {
            fs::write(self.fixture.project().join("src/lease.rs"), format!("pub fn lease_needle() -> u32 {{ {plan} }}\n")).unwrap();
            let commit = self.commit(&["src/lease.rs"], &format!("feat(14): finish fixture {id}"));
            let run = self.run(&id, "verify", Value::Null);
            (commit, json!([]), run)
        };
        let task = self.task(&id);
        self.apply(json!({"operation":"execution-task-close","request":{"request_id":format!("{id}-close"),
            "task":task["task"],"attempt":id,"expected_version":task["state"]["version"],"completion":completion,
            "checks":checks,"verification":[verification]}}));
    }

    pub fn complete(&mut self, number: u32, dispatch: &Value) {
        let plan = self.plan(number);
        let run = format!("suite-{number}");
        self.apply(json!({"operation":"execution-suite","request":{"request_id":run,"plan":plan["plan"],"expected_version":plan["state"]["version"]}}));
        let result = self.client.wait_for_event(31, &run);
        assert_eq!(result["disposition"]["code"], 0, "{result}");
        self.apply(json!({"operation":"risk-check","request_id":format!("risk-{number}"),
            "scope":{"phase":31,"occurrence":"phase-31-execution","worker":number.to_string()},
            "source":{"kind":"execution","plan":number,"dispatch_id":dispatch["dispatch_id"]},"surfaces":null}));
        let plan = self.plan(number);
        self.apply(json!({"operation":"execution-plan-complete","request":{"request_id":format!("complete-{number}"),
            "plan":plan["plan"],"expected_version":plan["state"]["version"]}}));
    }
}
