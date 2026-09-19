#[path = "support/phase13.rs"]
mod phase13;
use phase13::*;
use serde_json::{Value, json};
use std::{fs, time::{Duration, Instant}};

fn read(project: &std::path::Path, attempt: &Value) -> Value {
    query(project, json!({"operation":"verification-read","phase":13,"attempt":attempt["id"]}))
}

#[test]
fn phase13_runner_retains_independent_receipts() {
    let fixture = Completed::new();
    let project = fixture.project();
    assert_eq!((fixture.pairs.len(), fixture.statements.len(), fixture.dispatches.len()), (2, 2, 2));
    assert_eq!(fixture.admission["status"], "ok");
    let dispatch = query(project, json!({"operation":"verify-next","phase":13,"request_id":"runner-attempt"}));
    let attempt = phase13::attempt_view(project, &dispatch);
    assert_eq!(attempt["map"], fixture.map);
    let item = &fixture.pairs[0]["check"];
    let request = json!({"operation":"verification-run","request":{"request_id":"independent-a",
        "attempt":attempt["id"],"basis":attempt["basis"],"item":item}});
    let before = fs::read_to_string(project.join(".run/a-runs")).unwrap();
    assert_eq!(before, "run\nrun\nrun\n");
    let native_before = reopened(project).snapshot;
    let mut client = Client::open(project);
    let launch = client.call("cadence_apply", request.clone());
    assert_eq!(launch["status"], "ok", "{launch}");
    assert_eq!(launch["receipt"]["event"]["launch"]["material"]["command"], "python3 -B tests/a.py");
    phase13::independent_result(&mut client, 13, "independent-a");
    let result = client.call("cadence_query", json!({"operation":"execution-history","phase":13,"run":"independent-a"}))["result"].clone();
    assert_eq!(result["event"]["result"]["disposition"], json!({"kind":"exited","code":0}));
    assert_eq!(result["event"]["result"]["material_unchanged"], true);
    assert_eq!(result["event"]["source_after"], attempt["basis"]["source"]);
    client.finish();
    let after = tree(project);
    assert_eq!(apply(project, request.clone())["receipt"], launch["receipt"]);
    assert_eq!(read(project, &attempt)["runs"], json!([{"id":"independent-a","identity":{"kind":"run-output","phase":13,"run":"independent-a"}}]));
    assert_eq!(read(project, &attempt)["unknown_runs"], json!([]));
    assert_eq!(fs::read_to_string(project.join(".run/a-runs")).unwrap(), "run\nrun\nrun\nrun\n");
    let reopened = phase13::reopened(project).snapshot;
    assert_eq!(tree(project), after);
    for key in ["native_tasks", "native_plans", "native_admissions"] {
        assert_eq!(reopened.data[key], native_before.data[key], "verification never reopens execution");
    }
    let mut substituted = request.clone();
    substituted["request"]["request_id"] = json!("alternate");
    substituted["request"]["command"] = json!("printf substituted > .run/substitution");
    assert_eq!(apply(project, substituted)["status"], "refused");
    assert!(!project.join(".run/substitution").exists());
    let mut foreign = request.clone();
    foreign["request"]["request_id"] = json!("foreign");
    foreign["request"]["item"]["id"] = json!("artifact/shared");
    assert_eq!(apply(project, foreign)["rule"], "verification-item");
    fs::write(project.join("src/a.py"), "def answer():\n    return 8\n").unwrap();
    let mut stale = request.clone();
    stale["request"]["request_id"] = json!("stale");
    assert_eq!(apply(project, stale)["rule"], "verification-source");
    assert_eq!(apply(project, request.clone())["receipt"], launch["receipt"]);
    fs::write(project.join("src/a.py"), "def answer():\n    return 7\n").unwrap();
    assert_eq!(tree(project), after);
    // A real paused child is interrupted by killing its owning server.
    fs::write(project.join(".run/wait"), "wait").unwrap();
    let mut interrupted = request;
    interrupted["request"]["request_id"] = json!("interrupted");
    let mut client = Client::open(project);
    let pending = client.call("cadence_apply", interrupted.clone());
    assert_eq!(pending["status"], "ok", "{pending}");
    let deadline = Instant::now() + Duration::from_secs(20);
    while !project.join(".run/ready").exists() {
        assert!(Instant::now() < deadline);
        std::thread::sleep(Duration::from_millis(10));
    }
    client.child.kill().unwrap();
    client.child.wait().unwrap();
    drop(client);
    // The shell's child may outlive the shell; clean up the real fixture PID.
    let pid: i32 = fs::read_to_string(project.join(".run/ready")).unwrap().parse().unwrap();
    unsafe { libc::kill(pid, libc::SIGKILL); }
    fs::remove_file(project.join(".run/wait")).unwrap();
    let stopped = tree(project);
    assert_eq!(read(project, &attempt)["unknown_runs"], json!(["interrupted"]));
    assert_eq!(apply(project, interrupted)["receipt"], pending["receipt"]);
    assert_eq!(fs::read_to_string(project.join(".run/a-runs")).unwrap(), "run\nrun\nrun\nrun\nrun\n");
    assert_eq!(tree(project), stopped);
    let saved = phase13::reopened(project).snapshot;
    assert_eq!(saved.data["native_tasks"], native_before.data["native_tasks"]);
    assert_eq!(tree(project), stopped);
}

fn human(id: &str, submission: &Value) -> Value {
    json!({"operation":"verification-human-result","request_id":id,"submission":submission,
        "approval":{"approved":true,"owner":"Fixture Owner","at":"2026-09-11T16:00:00Z","submission":submission}})
}

fn result(occurrence: &Value, item: &str, reply: &str, outcome: &str, supersedes: Option<&Value>) -> Value {
    json!({"phase":13,"occurrence":occurrence,"id":item,"reply":reply,"outcome":outcome,
        "owner":"Fixture Owner","at":"2026-09-11T16:00:00Z","supersedes":supersedes})
}

const ORIGINAL: &str = "---\nstatus: testing\nphase: 13\n---\n\n## Items\n\n### 1. Delivery\nexpected: the parcel arrives\nstatus: fail\nfirst_pass: fail\nreported: \"the parcel never came\"\n\n### 2. Receipt\nexpected: the recipient signs\nstatus: pass\n";

#[test]
fn phase13_human_results_preserve_first_pass() {
    let fixture = Completed::new();
    let project = fixture.project();
    let uat = project.join(".planning/phases/13/UAT.md");
    // A caller-owned historical UAT with one failure and one pass.
    fs::write(&uat, ORIGINAL).unwrap();
    let occurrence = query(project, json!({"operation":"plan-read","phase":"13"}))["occurrence"].clone();
    let read = |project: &std::path::Path| query(project, json!({"operation":"verification-read","phase":13}));
    let before = tree(project);
    // The unretained historical document is classified, never adopted: the
    // failure is unfinished human work, the pass is neither required nor native.
    let humans = read(project)["humans"].clone();
    assert_eq!(humans.as_array().unwrap().len(), 2);
    assert_eq!((humans[0]["id"].as_str(), humans[0]["source"].as_str(), humans[0]["status"].as_str(), humans[0]["required"].as_bool(), humans[0]["history"].as_array().map(Vec::len)),
        (Some("1"), Some("imported"), Some("fail"), Some(true), Some(0)));
    assert_eq!((humans[1]["id"].as_str(), humans[1]["source"].as_str(), humans[1]["status"].as_str(), humans[1]["resolved"].as_bool(), humans[1]["required"].as_bool()),
        (Some("2"), Some("imported"), Some("pass"), Some(false), Some(false)));
    assert_eq!(tree(project), before, "readback retains nothing");
    // A native failure retains the original verbatim and renders beneath it.
    let failed = apply(project, human("fail-1", &result(&occurrence, "1", "Still no parcel at the door.", "failed", None)));
    assert_eq!(failed["status"], "ok", "{failed}");
    let first = failed["receipt"]["record"].clone();
    assert_eq!(first["first_pass"], "fail");
    assert_eq!(first["imported"]["name"], "Delivery");
    assert_eq!(first["imported"]["fields"]["reported"], "\"the parcel never came\"");
    let rendered = fs::read_to_string(&uat).unwrap();
    assert!(rendered.starts_with(ORIGINAL), "the imported original is kept verbatim first:\n{rendered}");
    let native = &rendered[ORIGINAL.len()..];
    assert!(native.starts_with("\n## Native human results\n"), "{native}");
    assert!(native.contains(&format!("\n### 1. 1\nname: Delivery\nstatus: fail\nfirst_pass: fail\nreported: \"Still no parcel at the door.\"\nowner: Fixture Owner\nat: 2026-09-11T16:00:00Z\nrecord: {}\nresults: 1\n", first["id"].as_str().unwrap())), "{native}");
    let saved = reopened(project).snapshot;
    assert_eq!(saved.data["verification"]["uat_originals"]["13"]["text"], ORIGINAL);
    assert_eq!(saved.data["verification"]["uat_originals"]["13"]["items"][0]["fields"]["status"], "fail");
    assert_eq!(saved.data["verification"]["humans"], json!([first]));
    let rows = read(project)["humans"].clone();
    assert_eq!(rows.as_array().unwrap().len(), 2);
    assert_eq!((rows[0]["id"].as_str(), rows[0]["source"].as_str(), rows[0]["status"].as_str(), rows[0]["first_pass"].as_str(), rows[0]["resolved"].as_bool(), rows[0]["required"].as_bool()),
        (Some("1"), Some("native"), Some("fail"), Some("fail"), Some(false), Some(true)));
    assert_eq!((rows[1]["id"].as_str(), rows[1]["source"].as_str(), rows[1]["status"].as_str(), rows[1]["resolved"].as_bool(), rows[1]["required"].as_bool()),
        (Some("2"), Some("imported"), Some("pass"), Some(false), Some(false)));
    let after_fail = tree(project);
    // Blank reply, unapproved input, a stale chain and a verifier's patch arm
    // change nothing; the rendered bytes and the retained history stay.
    let blank = apply(project, human("blank", &result(&occurrence, "1", "   ", "passed", Some(&first["id"]))));
    assert_eq!(blank["rule"], "verification-human", "{blank}");
    assert_eq!(blank["slot"], "submission.reply");
    let mut unapproved = human("unapproved", &result(&occurrence, "1", "Looks fine to me.", "passed", Some(&first["id"])));
    unapproved["approval"]["approved"] = json!(false);
    assert_eq!(apply(project, unapproved)["rule"], "verification-approval");
    let stale = apply(project, human("stale-chain", &result(&occurrence, "1", "It arrived.", "passed", None)));
    assert_eq!(stale["rule"], "verification-human", "{stale}");
    assert_eq!(stale["slot"], "submission.supersedes");
    let foreign = apply(project, human("foreign", &result(&json!("another-occurrence"), "1", "It arrived.", "passed", Some(&first["id"]))));
    assert_eq!(foreign["slot"], "submission.occurrence", "{foreign}");
    let attempt = query(project, json!({"operation":"verify-next","phase":13,"request_id":"human-attempt"}))["attempt"].clone();
    let patch = json!({"request_id":"overwrite","attempt":attempt["id"],"basis":attempt["basis"],
        "items":[],"humans":[{"id":"1","outcome":"passed"}]});
    let overwrite = apply(project, json!({"operation":"verification-submit","patch":patch}));
    assert_eq!(overwrite["rule"], "verification-shape", "{overwrite}");
    assert_eq!(fs::read_to_string(&uat).unwrap(), rendered);
    let mut current = tree(project);
    current.retain(|path, _| !path.ends_with("state.json") && !path.ends_with("decisions.jsonl"));
    let mut expected = after_fail.clone();
    expected.retain(|path, _| !path.ends_with("state.json") && !path.ends_with("decisions.jsonl"));
    assert_eq!(current, expected, "only the retained verification attempt appended to the journal");
    assert_eq!(reopened(project).snapshot.data["verification"]["humans"], json!([first]));
    assert_eq!(reopened(project).snapshot.data["verification"]["uat_originals"]["13"]["text"], ORIGINAL);
    // An explicit later pass supersedes the failure; first pass stays fail.
    let passed = apply(project, human("pass-1", &result(&occurrence, "1", "The parcel arrived this morning.", "passed", Some(&first["id"]))));
    assert_eq!(passed["status"], "ok", "{passed}");
    let second = passed["receipt"]["record"].clone();
    assert_eq!(second["first_pass"], "fail");
    assert_eq!(second["submission"]["supersedes"], first["id"]);
    let rendered = fs::read_to_string(&uat).unwrap();
    assert!(rendered.starts_with(ORIGINAL));
    assert!(rendered.contains(&format!("\n### 1. 1\nname: Delivery\nstatus: pass\nfirst_pass: fail\nreported: \"The parcel arrived this morning.\"\nowner: Fixture Owner\nat: 2026-09-11T16:00:00Z\nrecord: {}\nresults: 2\n", second["id"].as_str().unwrap())), "{rendered}");
    let rows = read(project)["humans"].clone();
    assert_eq!((rows[0]["status"].as_str(), rows[0]["first_pass"].as_str(), rows[0]["resolved"].as_bool(), rows[0]["required"].as_bool()),
        (Some("pass"), Some("fail"), Some(true), Some(false)));
    assert_eq!(rows[0]["history"].as_array().unwrap().len(), 2);
    assert_eq!(rows[0]["history"][0]["reply"], "Still no parcel at the door.");
    assert_eq!(rows[0]["history"][1]["reply"], "The parcel arrived this morning.");
    // Skip is not a pass: it is retained but leaves the item unresolved.
    let skipped = apply(project, human("skip-2", &result(&occurrence, "2", "No device available today.", "skipped", None)));
    assert_eq!(skipped["status"], "ok", "{skipped}");
    let rows = read(project)["humans"].clone();
    assert_eq!((rows[1]["source"].as_str(), rows[1]["status"].as_str(), rows[1]["first_pass"].as_str(), rows[1]["resolved"].as_bool(), rows[1]["required"].as_bool()),
        (Some("native"), Some("skipped"), Some("pass"), Some(false), Some(true)));
    // Restart: reopened bytes, exact replay, changed payload reuse.
    let stored = reopened(project).snapshot;
    let files = tree(project);
    assert_eq!(stored.data["verification"]["humans"].as_array().unwrap().len(), 3);
    assert_eq!(stored.data["verification"]["humans"][0], first);
    assert_eq!(stored.data["verification"]["humans"][1], second);
    assert_eq!(apply(project, human("pass-1", &result(&occurrence, "1", "The parcel arrived this morning.", "passed", Some(&first["id"])))), passed);
    let reused = apply(project, human("pass-1", &result(&occurrence, "1", "A different reply under the same request.", "passed", Some(&first["id"]))));
    assert_eq!(reused["rule"], "verification-human-reuse", "{reused}");
    assert_eq!(tree(project), files);
    assert_eq!(reopened(project).snapshot, stored);
    // A hand edit of the rendered document is refused, never adopted.
    fs::write(&uat, format!("{}\nstatus: pass\n", fs::read_to_string(&uat).unwrap())).unwrap();
    let drifted = apply(project, human("after-drift", &result(&occurrence, "1", "Another look.", "passed", Some(&second["id"]))));
    assert_eq!(drifted["rule"], "verification-human", "{drifted}");
    assert_eq!(drifted["slot"], "uat");
    assert_eq!(reopened(project).snapshot.data["verification"]["humans"], stored.data["verification"]["humans"]);
    assert_eq!(reopened(project).snapshot.data["verification"]["uat_originals"], stored.data["verification"]["uat_originals"]);
    assert_eq!(reopened(project).snapshot.data["context"], stored.data["context"]);
}

const REQUIREMENTS: &str = "# Requirements\n\n## Active\n\n- **T1**: the first parcel is delivered\n- **T2**: the second parcel is delivered\n- **T3**: receipts are signed\n\n## Deferred\n\n- **T9**: not this cycle\n\n## Traceability\n\n| Requirement | Phase | Status |\n|-------------|-------|--------|\n| T3 | Phase 13 | Complete |\n\n## Shipped\n\n| Requirement | Phase | Status | Milestone |\n|---|---|---|---|\n| OLD-01 | 1 | Complete | v1.0.0 |\n";

// The first publication carries one check for every approved truth; later ones add artifacts.
fn declaring(project: &std::path::Path, id: &str, requirements: &[&str]) -> Value {
    let items = if id == "seed-one" {
        ["T1", "T2", "T3", "T4", "T9"].into_iter()
            .map(|truth| check(&format!("check/{truth}"), &[truth]))
            .collect()
    } else {
        vec![artifact(&format!("artifact/{id}"), &["T1"])]
    };
    let mut input = proposal(project, id, &[(None, attached(items))]);
    input["submission"]["plans"][0]["content"]["requirements"] = json!(requirements);
    input
}

#[test]
fn phase13_publication_seeds_only_missing_trace_rows() {
    let temp = fixture();
    let project = temp.path();
    native_context(project, &[
        ("T1", "a parcel arrives", "the recipient", "the parcel"),
        ("T2", "a second parcel arrives", "the recipient", "the second parcel"),
        ("T3", "a receipt arrives", "the recipient", "the receipt"),
        ("T4", "a fourth parcel arrives", "the recipient", "the fourth parcel"),
        ("T9", "a deferred parcel arrives", "the recipient", "the deferred parcel"),
    ]);
    let requirements = project.join(".planning/REQUIREMENTS.md");
    fs::write(&requirements, REQUIREMENTS).unwrap();
    // A new plan declares one existing row, one missing active id and one id
    // with no active bullet: only the missing active row is seeded, Pending.
    let first = declaring(project, "seed-one", &["T3", "T1", "T9"]);
    let answer = publish(project, &first);
    assert_eq!(answer["requirements"], json!({"seeded":["T1"]}));
    let seeded_once = REQUIREMENTS.replace("| T3 | Phase 13 | Complete |\n", "| T3 | Phase 13 | Complete |\n| T1 | Phase 13 | Pending |\n");
    assert_eq!(fs::read_to_string(&requirements).unwrap(), seeded_once);
    let after_first = tree(project);
    let stored = reopened(project).snapshot;
    // Exact replay reinstalls nothing and reseeds nothing.
    let replay = apply(project, approve(first.clone()));
    assert_eq!(replay["replayed"], true, "{replay}");
    assert_eq!(tree(project), after_first);
    assert_eq!(reopened(project).snapshot, stored);
    // A second publication seeds only its own missing row; the resolved and
    // the already seeded rows keep their bytes and order.
    let second = declaring(project, "seed-two", &["T1", "T2"]);
    let answer = publish(project, &second);
    assert_eq!(answer["requirements"], json!({"seeded":["T2"]}));
    let seeded_twice = seeded_once.replace("| T1 | Phase 13 | Pending |\n", "| T1 | Phase 13 | Pending |\n| T2 | Phase 13 | Pending |\n");
    assert_eq!(fs::read_to_string(&requirements).unwrap(), seeded_twice);
    // Publication never raises a status: a third plan naming every id changes nothing.
    let third = declaring(project, "seed-none", &["T1", "T2", "T3"]);
    let answer = publish(project, &third);
    assert_eq!(answer["requirements"], json!({"seeded":[]}));
    assert_eq!(fs::read_to_string(&requirements).unwrap(), seeded_twice);
    let installed: Vec<_> = (1..=3).map(|n| fs::read(project.join(format!(".planning/phases/13/PLAN-{n}.md"))).unwrap()).collect();
    // A changed projection input is refused before anything installs: the
    // preimage is no longer an owned regular file.
    let stored = reopened(project).snapshot;
    let before = tree(project);
    fs::remove_file(&requirements).unwrap();
    fs::create_dir(&requirements).unwrap();
    let fourth = declaring(project, "seed-refused", &["T2"]);
    let refused = {
        let mut client = Client::open(project);
        let answer = client.call("cadence_apply", approve(fourth.clone()));
        client.finish();
        answer
    };
    assert_eq!(refused["status"], "refused", "{refused}");
    assert!(refused["reason"].as_str().unwrap().contains("not an owned regular file"), "{refused}");
    assert!(!project.join(".planning/phases/13/PLAN-4.md").exists());
    fs::remove_dir(&requirements).unwrap();
    fs::write(&requirements, &seeded_twice).unwrap();
    assert_eq!(tree(project), before);
    assert_eq!(reopened(project).snapshot, stored, "a refused publication leaves approval and history unchanged");
    // The same approved request then publishes, seeding nothing new.
    let answer = publish(project, &fourth);
    assert_eq!(answer["requirements"], json!({"seeded":[]}));
    assert_eq!(fs::read_to_string(&requirements).unwrap(), seeded_twice);
    for (n, bytes) in installed.iter().enumerate() {
        assert_eq!(fs::read(project.join(format!(".planning/phases/13/PLAN-{}.md", n + 1))).unwrap(), *bytes);
    }
    // Without a Traceability table nothing is seeded and publication proceeds.
    fs::write(&requirements, "# Requirements\n\n## Active\n\n- **T4**: a fourth parcel\n").unwrap();
    let answer = publish(project, &declaring(project, "seed-tableless", &["T4"]));
    assert_eq!(answer["requirements"], json!({"seeded":[]}));
    assert_eq!(fs::read_to_string(&requirements).unwrap(), "# Requirements\n\n## Active\n\n- **T4**: a fourth parcel\n");
    // Approved context and every publication receipt are exactly retained.
    let final_snapshot = reopened(project).snapshot;
    assert_eq!(final_snapshot.data["context"], stored.data["context"]);
    for id in ["seed-one", "seed-two", "seed-none", "seed-refused", "seed-tableless"] {
        assert!(final_snapshot.data["plan_publications"]["phases"]["13"]["receipts"][id].is_object(), "{id}");
    }
}

const PASSED_UAT: &str = "---\nstatus: complete\nphase: 13\n---\n\n## Items\n\n### 1. Delivery\nexpected: the parcel arrives\nstatus: pass\n";
const TRACED: &str = "# Requirements\n\n## Active\n\n- **T1**: the first parcel is delivered\n- **T7**: a later parcel\n\n## Traceability\n\n| Requirement | Phase | Status |\n|-------------|-------|--------|\n| T1 | Phase 13 | Pending |\n| T7 | Phase 14 | Pending |\n";

fn complete(attempt: &Value, id: &str, roadmap: &str, requirements: Option<&str>) -> Value {
    json!({"operation":"verification-complete","request_id":id,"attempt":attempt["id"],"basis":attempt["basis"],
        "projections":{"roadmap":roadmap,"requirements":requirements}})
}

#[test]
fn phase13_completion_projection_transaction_recovers() {
    let fixture = Completed::new();
    let project = fixture.project();
    let root = project.join(".planning");
    let (roadmap, requirements, uat) = (root.join("ROADMAP.md"), root.join("REQUIREMENTS.md"), root.join("phases/13/UAT.md"));
    fs::write(&uat, PASSED_UAT).unwrap();
    fs::write(&requirements, TRACED).unwrap();
    // The projections are tracked source here, so the transaction must account
    // for exactly its own installed bytes and nothing else.
    git_value(project, &["add", "-f", ".planning/ROADMAP.md", ".planning/REQUIREMENTS.md"]);
    git_value(project, &["commit", "-m", "Track planning projections"]);
    let (attempt, _) = verify(project, "complete-basis", &[]);
    let (roadmap_digest, requirements_digest) = (digest_of(&roadmap), digest_of(&requirements));
    let context = reopened(project).snapshot.data["context"].clone();
    let before = tree(project);
    let stored = reopened(project).snapshot;
    let unchanged = |project: &std::path::Path| {
        assert_eq!(tree(project), before, "nothing installed");
        assert_eq!(reopened(project).snapshot, stored, "nothing acknowledged");
        assert_eq!(fs::read_to_string(&uat).unwrap(), PASSED_UAT);
    };
    // A stale caller preimage for either projection is refused and locates it.
    let stale = apply(project, complete(&attempt, "stale-roadmap", &"0".repeat(64), Some(&requirements_digest)));
    assert_eq!(stale["rule"], "verification-projection", "{stale}");
    assert_eq!(stale["slot"], "projections.roadmap");
    assert_eq!(stale["details"]["current"], roadmap_digest);
    unchanged(project);
    let stale = apply(project, complete(&attempt, "stale-requirements", &roadmap_digest, Some(&"0".repeat(64))));
    assert_eq!(stale["rule"], "verification-projection", "{stale}");
    assert_eq!(stale["slot"], "projections.requirements");
    unchanged(project);
    let absent = apply(project, complete(&attempt, "absent-requirements", &roadmap_digest, None));
    assert_eq!(absent["slot"], "projections.requirements", "{absent}");
    unchanged(project);
    // A real interruption: the server is killed before it can answer. The
    // reopened store is wholly confirmed or wholly unconfirmed, never split.
    let request = complete(&attempt, "complete-13", &roadmap_digest, Some(&requirements_digest));
    let mut completed = false;
    for _ in 0..3 {
        Client::open(project).interrupt("cadence_apply", request.clone());
        let view = recovered(project);
        assert!(!root.join(".store-intent.json").exists(), "recovery leaves no intent behind");
        let completions = view.snapshot.data["verification"]["completions"].as_array().cloned().unwrap_or_default();
        let checked = fs::read_to_string(&roadmap).unwrap().contains("- [x] **Phase 13: Plan publication**");
        let traced = fs::read_to_string(&requirements).unwrap().contains("| T1 | Phase 13 | Complete |");
        assert_eq!((checked, traced), (!completions.is_empty(), !completions.is_empty()), "split authority/projection state");
        assert_eq!(fs::read_to_string(&uat).unwrap(), PASSED_UAT);
        if !completions.is_empty() { completed = true; break; }
        assert_eq!(tree(project), before);
    }
    let done = apply(project, request.clone());
    assert_eq!(done["status"], "ok", "{done}");
    assert_eq!(done["receipt"]["replayed"], json!(completed));
    let record = done["receipt"]["record"].clone();
    assert_eq!(record["schema"], "verification-completion-1");
    assert_eq!(record["label"], "complete");
    assert_eq!(record["phase"], 13);
    assert_eq!(record["attempt"], attempt["id"]);
    assert_eq!(record["basis"], attempt["basis"]);
    assert_eq!(record["projections"]["roadmap"]["preimage"], roadmap_digest);
    assert_eq!(record["projections"]["roadmap"]["line"], 2);
    assert_eq!(record["projections"]["requirements"]["rows"], json!(["T1"]));
    assert_eq!(record["truths"], json!([{"id":"T1","version":1,"status":"met","derived":"met","waiver":null},
        {"id":"T2","version":1,"status":"met","derived":"met","waiver":null}]));
    assert_eq!(fs::read_to_string(&roadmap).unwrap(), "## Phases\n- [x] **Phase 13: Plan publication**\n- [ ] **Phase 28: Next phase**\n");
    assert_eq!(fs::read_to_string(&requirements).unwrap(), TRACED.replace("| T1 | Phase 13 | Pending |", "| T1 | Phase 13 | Complete |"));
    assert_eq!(fs::read_to_string(&uat).unwrap(), PASSED_UAT, "completion leaves human material untouched");
    assert_eq!(git_value(project, &["status", "--porcelain"]), " M .planning/REQUIREMENTS.md\n M .planning/ROADMAP.md");
    let saved = reopened(project).snapshot;
    assert_eq!(saved.data["context"], context);
    assert_eq!(saved.data["verification"]["completions"], json!([record]));
    assert_eq!(saved.data["verification"]["patches"], stored.data["verification"]["patches"]);
    let read = query(project, json!({"operation":"verification-read","phase":13}));
    assert_eq!(read["completion"]["status"], "complete");
    assert_eq!(read["completion"]["applicable"], true);
    assert_eq!(read["completion"]["record"], record);
    assert_eq!(read["current"]["applicable"], false, "the uncommitted projections are a source change for verification");
    assert_eq!(read["current"]["unavailable"]["rule"], "verification-source");
    // Exact replay, changed payload and a second completion on the same inputs.
    let after = tree(project);
    let replay = apply(project, request.clone());
    assert_eq!(replay["receipt"]["record"], record);
    assert_eq!(replay["receipt"]["replayed"], true);
    assert_eq!(tree(project), after);
    let reused = apply(project, complete(&attempt, "complete-13", &"1".repeat(64), Some(&requirements_digest)));
    assert_eq!(reused["rule"], "verification-complete-reuse", "{reused}");
    git_value(project, &["commit", "-am", "Record phase 13 completion"]);
    let (fresh, _) = verify(project, "after-completion", &[]);
    let again = apply(project, complete(&fresh, "complete-13-again", &digest_of(&roadmap), Some(&digest_of(&requirements))));
    assert_eq!(again["rule"], "verification-complete", "{again}");
    assert_eq!(again["slot"], "phase");
    let read = query(project, json!({"operation":"verification-read","phase":13}));
    assert_eq!(read["completion"]["applicable"], true, "committing the projections changes no native input");
    assert_eq!(read["current"]["attempt"], fresh["id"]);
    assert_eq!(reopened(project).snapshot.data["verification"]["completions"].as_array().unwrap().len(), 1);
    assert_eq!(fs::read_to_string(&uat).unwrap(), PASSED_UAT);
}
