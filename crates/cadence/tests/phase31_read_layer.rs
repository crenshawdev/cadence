#[path = "support/phase31.rs"]
mod phase31;
#[path = "support/phase31_hosts.rs"]
mod phase31_hosts;

use phase31::{Client, Fixture, ProcessFixture, approve, git, process_plan_submission};
use serde_json::json;
use std::{fs, io::Write};

#[test]
#[ignore = "D-172: starts the installed claude, which this repository does not build; run with --ignored as a live probe"]
fn phase31_worker_hosts_receive_main_thread_answers() {
    phase31_hosts::prove_worker_hosts_receive_main_thread_answers();
}

#[test]
#[ignore = "D-172: starts the installed claude, which this repository does not build; run with --ignored as a live probe"]
fn phase31_planner_round_reports_reads_and_tokens() {
    let mut fixture = phase31_hosts::PlannerRoundFixture::new();
    let round = fixture.run();
    assert!(round.read_count > 0, "the real planner round made no project reads: {round:?}");
    assert_eq!(round.whole_file_reads, 0, "the real planner opened a project file whole: {round:?}");
    assert_eq!(round.unclassified_reads, 0, "the real planner made an unclassifiable read: {round:?}");
    assert!(round.token_total > 0, "the real planner round reported no observed tokens: {round:?}");
    assert!(!round.worker_ids.is_empty(), "the measured round has no actual planner worker: {round:?}");

    let identity = json!({"kind":"planner-round","phase":31,
        "session_id":round.session_id,"first_turn":round.first_turn,"last_turn":round.last_turn});
    let index = fixture.client().call("cadence_query", json!({
        "operation":"document","identity":identity
    }));
    assert_eq!(index["status"], "ok", "planner-round document identity is unavailable: {index}; identity={identity}");
    assert_eq!(index["kind"], "document-index", "{index}");
    assert_eq!(index["classification"], "claude-planner-round", "{index}");
    assert_eq!(index["revision"], round.source_digest, "{index}");
    assert_eq!(index["parts"], json!([{"part":"report","title":"Claude planner round measurement",
        "bytes":round.report.as_bytes().len()}]), "{index}");

    let report = fixture.client().call("cadence_query", json!({
        "operation":"document","identity":identity,"part":"report"
    }));
    assert_eq!(report["status"], "ok", "{report}");
    assert_eq!(report["kind"], "document-slice", "{report}");
    assert_eq!(report["classification"], "claude-planner-round", "{report}");
    assert_eq!(report["revision"], round.source_digest, "{report}");
    assert_eq!(report["body"], round.report, "the binary report differs from the independent traversal");
    assert_eq!(report["truncated"], false, "{report}");
    assert!(report["continuation"].is_null(), "{report}");
    assert!(!report.to_string().contains(".claude/projects"), "host storage path leaked: {report}");

    let unavailable = fixture.client().call("cadence_query", json!({
        "operation":"document","identity":{"kind":"planner-round","phase":31,
            "session_id":"00000000-0000-4000-8000-000000000000",
            "first_turn":round.first_turn,"last_turn":round.last_turn}
    }));
    assert_eq!(unavailable["status"], "refused", "{unavailable}");
    assert_eq!(unavailable["code"], "document-not-found", "{unavailable}");
    assert!(unavailable.get("body").is_none(), "{unavailable}");
    assert!(!unavailable.to_string().contains(".claude/projects"), "host storage path leaked: {unavailable}");

    let mut stdout = std::io::stdout().lock();
    stdout.write_all(report["body"].as_str().unwrap().as_bytes()).unwrap();
    stdout.flush().unwrap();
    fixture.finish();
}

#[test]
fn phase31_search_returns_located_units() {
    let fixture = Fixture::new();
    let mut client = Client::open(fixture.project());
    let answer = client.call("cadence_query", json!({
        "operation":"search", "pattern":"needle",
        "scope":{"kind":"directory", "selector":"src"}
    }));
    assert_eq!(answer["status"], "ok", "{answer}");
    assert_eq!(answer["kind"], "search");
    assert_eq!(answer["bound"], 65_536);
    let units = answer["hits"].as_array().unwrap();
    let rust: Vec<_> = units.iter().filter(|unit| unit["file"] == "src/units.rs").collect();
    assert_eq!(rust.len(), 2, "{answer}");
    assert_eq!(rust[0]["name"], "alpha");
    assert_eq!(rust[0]["range"], json!([1, 4]));
    assert_eq!(rust[0]["match_lines"], json!([2, 3]));
    assert_eq!(rust[0]["body"], "fn alpha() {\n    let needle = 1;\n    let needle_again = 2;\n}\n");
    assert_eq!(rust[1]["name"], "beta");
    assert_eq!(rust[1]["range"], json!([6, 8]));
    assert_eq!(rust[1]["match_lines"], json!([7]));
    assert_eq!(rust[1]["body"], "fn beta() {\n    let needle = 3;\n}\n");
    assert!(rust.iter().all(|unit| unit["location"].as_str().is_some_and(|value| !value.is_empty())));
    assert!(units.iter().all(|unit| unit["file"] != "ignored/sentinel.rs"));
    let nested = units.iter().find(|unit| unit["file"] == "src/nested/mod.rs").unwrap();
    assert_eq!(nested["name"], "outer::inner");
    assert_eq!(nested["range"], json!([2, 2]));

    let grammar_answer = client.call("cadence_query", json!({
        "operation":"search", "pattern":"NEEDLE", "case_insensitive":true,
        "scope":{"kind":"glob", "selector":"**/*.{js,md,json,c}"}
    }));
    assert_eq!(grammar_answer["status"], "ok", "{grammar_answer}");
    let names: Vec<_> = grammar_answer["hits"].as_array().unwrap().iter()
        .map(|unit| (unit["file"].as_str().unwrap(), unit["name"].as_str().unwrap())).collect();
    assert_eq!(names, vec![
        ("docs/units.md", "# Markdown unit"),
        ("src/units.c", "c_unit"),
        ("src/units.js", "javascriptUnit"),
        ("src/units.json", "jsonUnit"),
    ]);
    let refusal = client.call("cadence_query", json!({
        "operation":"search", "pattern":"[", "scope":{"kind":"project"}
    }));
    assert_eq!(refusal["status"], "refused");
    assert_eq!(refusal["slot"], "pattern");
    client.finish();
}

#[test]
fn phase31_unissued_location_is_refused() {
    let fixture = Fixture::new();
    let mut client = Client::open(fixture.project());
    let search = client.call("cadence_query", json!({"operation":"search","pattern":"needle",
        "scope":{"kind":"directory","selector":"src"}}));
    let location = search["hits"].as_array().unwrap().iter()
        .find(|hit| hit["name"] == "beta").unwrap()["location"].as_str().unwrap().to_owned();
    let valid = client.call("cadence_query", json!({"operation":"read","location":location}));
    assert_eq!(valid["status"], "ok", "{valid}");
    assert_eq!(valid["kind"], "slice");
    assert_eq!(valid["body"], "fn beta() {\n    let needle = 3;\n}\n");
    for token in ["unissued-opaque-token", "/etc/passwd", "../outside", "loc-altered"] {
        let answer = client.call("cadence_query", json!({"operation":"read","location":token}));
        assert_eq!(answer["status"], "refused", "{answer}");
        assert_eq!(answer["code"], "location-not-issued", "{answer}");
        assert_eq!(answer["rule"], "D-147", "{answer}");
        assert_eq!(answer["slot"], "location", "{answer}");
        assert!(answer.get("body").is_none(), "{answer}");
    }
    let malformed = client.call("cadence_query", json!({"operation":"read","location":location,
        "path":"src/units.rs","start":1,"end":8}));
    assert_eq!(malformed["status"], "refused", "{malformed}");
    assert_eq!(malformed["code"], "read-contract", "{malformed}");
    let other_fixture = Fixture::new();
    let mut other = Client::open(other_fixture.project());
    let foreign = other.call("cadence_query", json!({"operation":"read","location":location}));
    assert_eq!(foreign["code"], "location-not-issued", "{foreign}");
    other.finish();
    let first = client.call("cadence_query", json!({"operation":"search","pattern":"beta",
        "scope":{"kind":"directory","selector":"src"}}))["hits"][0]["location"].as_str().unwrap().to_owned();
    for _ in 0..65 {
        let answer = client.call("cadence_query", json!({"operation":"search","pattern":"alpha",
            "scope":{"kind":"directory","selector":"src"}}));
        assert_eq!(answer["status"], "ok", "{answer}");
    }
    let expired = client.call("cadence_query", json!({"operation":"read","location":first}));
    assert_eq!(expired["code"], "location-not-issued", "{expired}");
    client.finish();
}

#[test]
fn phase31_read_returns_exact_slice_and_continuation() {
    let fixture = Fixture::new();
    let long_line = format!("    // first-marker {} last-marker\\n", "é".repeat(40_000));
    let oversized = format!("fn oversized() {{\\n{long_line}}}\\n");
    fs::write(fixture.path("src/oversized.rs"), &oversized).unwrap();
    let mut client = Client::open(fixture.project());

    let search = client.call("cadence_query", json!({"operation":"search","pattern":"first-marker",
        "scope":{"kind":"directory","selector":"src"}}));
    let location = search["hits"].as_array().unwrap().iter()
        .find(|hit| hit["name"] == "oversized").unwrap()["location"].as_str().unwrap().to_owned();

    let mut page = client.call("cadence_query", json!({"operation":"read","location":location}));
    assert_eq!(page["status"], "ok", "{page}");
    assert_eq!(page["kind"], "slice");
    assert_eq!(page["truncated"], true, "{page}");
    assert!(page["continuation"].as_str().is_some_and(|value| !value.is_empty()), "{page}");
    assert!(page["continue_from_byte"].as_u64().is_some_and(|byte| byte > 0), "{page}");

    let mut served = String::new();
    loop {
        served.push_str(page["body"].as_str().unwrap());
        let Some(next) = page["continuation"].as_str() else { break };
        page = client.call("cadence_query", json!({"operation":"read","location":next}));
        assert_eq!(page["status"], "ok", "{page}");
    }
    assert_eq!(served, oversized);
    assert_eq!(page["truncated"], false);
    assert!(page["continuation"].is_null());

    let beta = client.call("cadence_query", json!({"operation":"search","pattern":"fn beta",
        "scope":{"kind":"directory","selector":"src"}}))["hits"][0]["location"].as_str().unwrap().to_owned();
    let short = client.call("cadence_query", json!({"operation":"read","location":beta}));
    assert_eq!(short["body"], "fn beta() {\n    let needle = 3;\n}\n");
    client.finish();
}

#[test]
fn phase31_large_file_returns_unit_outline() {
    let fixture = Fixture::new();
    let padding = "// outline padding\n".repeat(2_000);
    let large = format!(
        "fn first_unit() {{\n    let outline_needle = 1;\n}}\n{padding}fn second_unit() {{\n    let outline_needle = 2;\n}}\n"
    );
    assert!(large.len() > 24 * 1024);
    fs::write(fixture.path("src/outline.rs"), large).unwrap();
    let mut client = Client::open(fixture.project());

    let search = client.call("cadence_query", json!({"operation":"search","pattern":"outline_needle",
        "scope":{"kind":"directory","selector":"src"}}));
    let file = search["hits"].as_array().unwrap().iter()
        .find(|hit| hit["name"] == "first_unit").unwrap()["file_reference"].as_str().unwrap().to_owned();
    let outline = client.call("cadence_query", json!({"operation":"read","file":file}));
    assert_eq!(outline["status"], "ok", "{outline}");
    assert_eq!(outline["kind"], "outline");
    assert!(outline.get("body").is_none(), "{outline}");
    let rows = outline["rows"].as_array().unwrap();
    assert_eq!(rows.len(), 2, "{outline}");
    assert_eq!(rows[0]["name"], "first_unit");
    assert_eq!(rows[0]["range"], json!([1, 3]));
    assert!(rows.iter().all(|row| row["location"].as_str().is_some_and(|value| !value.is_empty())));

    let selected = client.call("cadence_query", json!({"operation":"read","file":file,"unit":"second_unit"}));
    assert_eq!(selected["kind"], "slice");
    assert_eq!(selected["body"], "fn second_unit() {\n    let outline_needle = 2;\n}\n");
    let missing = client.call("cadence_query", json!({"operation":"read","file":file,"unit":"missing_unit"}));
    assert_eq!(missing["kind"], "outline");
    assert_eq!(missing["reason"], "missing-unit");
    assert_eq!(missing["rows"].as_array().unwrap().len(), 2, "{missing}");
    client.finish();
}

#[test]
fn phase31_process_identity_returns_rendered_slice() {
    fn no_process_path(value: &serde_json::Value) {
        let text = value.to_string();
        for forbidden in [".planning", "CONTEXT.md", "PLAN-", "ROADMAP.md"] {
            assert!(!text.contains(forbidden), "process path leaked in {value}");
        }
    }

    let fixture = ProcessFixture::new();
    let project = fixture.project();
    let mut client = Client::open(project);
    let context = client.call("cadence_apply", approve(json!({
        "operation":"context-submit","submission":{"phase":31,"title":"The read layer",
        "scope":format!("Bounded native scope. {}", "unrelated context padding ".repeat(4_000)),
        "durable_decisions":[],"decisions":[],"assumptions":[],
        "truths":[{"id":"T4","trigger":"the caller requests the native truth",
            "observer":"the caller","verb":"gets","outcome":"HANDWRITTEN NATIVE TRUTH SENTENCE",
            "kind":"property","observable":true,"fixed_oracle":true}]}
    })));
    assert_eq!(context["persisted"], true, "{context}");

    let allocation = client.call("cadence_query", json!({
        "operation":"plan-read","phase_address":"31","count":2
    }));
    let large_task = "LARGE SELECTED TASK PAGE\n".repeat(4_000);
    let preview = client.call("cadence_query", {
        let request = process_plan_submission(&allocation, &large_task);
        json!({"operation":"plan-read","phase_address":"31","submission":request["submission"]})
    });
    assert_eq!(preview["status"], "ok", "{preview}");
    let published = client.call("cadence_apply", approve(json!({
        "operation":"plan-submit","submission":preview["submission"]
    })));
    assert_eq!(published["persisted"], true, "{published}");
    let evidence = client.call("cadence_query", json!({"operation":"evidence-read","phase":31}));
    let check_revision = evidence["items"].as_array().unwrap().iter()
        .find(|item| item["id"] == "fixture/T4").unwrap()["item_revision"].clone();
    let plans = published["results"].as_array().unwrap();
    let contract = json!({"phase":31,"occurrence":allocation["occurrence"],
        "plans":plans.iter().map(|publication| json!({
            "plan":publication["identity"]["plan"],
            "publication_request":publication["approval"]["submission"]["request_id"],
            "content_revision":publication["revision"],"map_revision":publication["map_revision"]
        })).collect::<Vec<_>>(),
        "allocation":[
            {"plan":1,"task":"fixture-one-a","checks":[]},
            {"plan":1,"task":"fixture-one-b","checks":[{"id":"fixture/T4","item_revision":check_revision}]},
            {"plan":2,"task":"fixture-two-a","checks":[]},
            {"plan":2,"task":"fixture-two-b","checks":[]}
        ]});
    let admitted = client.call("cadence_apply", json!({"operation":"execution-admit","request":{
        "request_id":"fixture-admit","expected_set_version":0,"contract":contract
    }}));
    assert_eq!(admitted["status"], "ok", "{admitted}");
    let authorized = client.call("cadence_apply", json!({"operation":"execution-authorize","phase":31,
        "request_id":"fixture-authorize","owner":"Fixture Owner","at":"2026-09-13T12:01:00Z",
        "response":"Proceed with the fixture execution"}));
    assert_eq!(authorized["status"], "ok", "{authorized}");
    let dispatch = client.call("cadence_query", json!({"operation":"execute-next","phase":31}));
    assert_eq!(dispatch["status"], "ok", "{dispatch}");
    let operational = &dispatch["dispatch"]["operational"];
    let task = operational["tasks"].as_array().unwrap().iter()
        .find(|task| task["id"] == "fixture-one-a").unwrap();
    let lease_scope = task["lease_scope"].clone();
    assert_eq!(lease_scope["kind"], "current-task-lease", "{dispatch}");
    let task_identity = json!({"phase":31,"occurrence":operational["occurrence"],
        "admission_digest":operational["admission_digest"],"plan":1,"task":"fixture-one-a"});
    let started = client.call("cadence_apply", json!({"operation":"execution-task-start","request":{
        "request_id":"fixture-start","task":task_identity,"attempt":"fixture-attempt",
        "expected_version":0,"predecessor":null,"checks":[]
    }}));
    assert_eq!(started["status"], "ok", "{started}");

    let before_lease = fs::read(project.join(".planning/state.json")).unwrap();
    let lease = client.call("cadence_query", json!({"operation":"search","pattern":"lease_needle",
        "scope":lease_scope}));
    assert_eq!(lease["status"], "ok", "{lease}");
    assert_eq!(lease["hits"].as_array().unwrap().len(), 1, "{lease}");
    assert_eq!(lease["hits"][0]["file"], "src/lease.rs");
    assert!(lease["hits"].as_array().unwrap().iter().all(|hit| hit["file"] != "src/other.rs"));
    assert_eq!(fs::read(project.join(".planning/state.json")).unwrap(), before_lease);

    fs::write(project.join("src/lease.rs"), "pub fn lease_needle() -> u32 { 310 }\n").unwrap();
    git(project, &["add", "src/lease.rs"]);
    git(project, &["commit", "-S", "-m", "feat(read): complete fixture task (fixture-one-a)"]);
    let completion = git(project, &["rev-parse", "HEAD"]);
    let history = client.call("cadence_query", json!({"operation":"execution-history","phase":31}));
    let state = history["tasks"].as_array().unwrap().iter()
        .find(|entry| entry["task"]["task"] == "fixture-one-a").unwrap();
    let launched = client.call("cadence_apply", json!({"operation":"execution-run","request":{
        "request_id":"fixture-verify","task":state["task"],"attempt":"fixture-attempt",
        "expected_version":state["state"]["version"],"command":"python3 -B tests/tiny.py",
        "check":null,"stage":"verify"
    }}));
    assert_eq!(launched["status"], "ok", "{launched}");
    let result = client.wait_for_event(31, "fixture-verify");
    assert_eq!(result["disposition"], json!({"kind":"exited","code":0}), "{result}");
    let history = client.call("cadence_query", json!({"operation":"execution-history","phase":31}));
    let state = history["tasks"].as_array().unwrap().iter()
        .find(|entry| entry["task"]["task"] == "fixture-one-a").unwrap();
    let closed = client.call("cadence_apply", json!({"operation":"execution-task-close","request":{
        "request_id":"fixture-close","task":state["task"],"attempt":"fixture-attempt",
        "expected_version":state["state"]["version"],"completion":completion,"checks":[],
        "verification":["fixture-verify"]
    }}));
    assert_eq!(closed["status"], "ok", "{closed}");

    let intake = client.call("cadence_query", json!({"operation":"context-intake","phase":31}));
    assert!(intake["context"]["identity"].is_object(), "{intake}");
    assert!(intake["roadmap"]["identity"].is_object(), "{intake}");
    assert!(intake["context"].get("document").is_none(), "{intake}");
    let readback = client.call("cadence_query", json!({"operation":"plan-read","phase_address":"31"}));
    assert!(readback["plans"].as_array().unwrap().iter().all(|plan| plan.get("document").is_none()
        && plan.get("publication").is_none()), "{readback}");

    let context_identity = intake["context"]["identity"].clone();
    let context_index = client.call("cadence_query", json!({"operation":"document","identity":context_identity}));
    assert_eq!(context_index["kind"], "document-index", "{context_index}");
    assert!(context_index.get("body").is_none(), "{context_index}");
    let truth = client.call("cadence_query", json!({"operation":"document",
        "identity":intake["context"]["identity"],"part":"truth:T4"}));
    assert_eq!(truth["body"], "When the caller requests the native truth, the caller gets HANDWRITTEN NATIVE TRUTH SENTENCE.\n");

    let plan_identity = readback["plans"].as_array().unwrap().iter()
        .find(|plan| plan["identity"]["plan"] == 2).unwrap()["identity"].clone();
    let mut page = client.call("cadence_query", json!({"operation":"document","identity":plan_identity,
        "part":"task:fixture-two-a"}));
    let mut task_body = String::new();
    loop {
        task_body.push_str(page["body"].as_str().unwrap());
        let Some(continuation) = page["continuation"].as_str() else { break };
        page = client.call("cadence_query", json!({"operation":"document","identity":page["identity"],
            "part":continuation}));
    }
    assert!(task_body.contains("PLAN TWO TASK ONE UNIQUE"));
    assert!(task_body.contains("LARGE SELECTED TASK PAGE"));
    assert!(!task_body.contains("PLAN ONE"));
    assert!(!task_body.contains("PLAN TWO TASK TWO SENTINEL"));

    let roadmap = client.call("cadence_query", json!({"operation":"document",
        "identity":intake["roadmap"]["identity"],"part":"row"}));
    assert_eq!(roadmap["body"], "- [ ] **Phase 31: The read layer** - uniquely selected roadmap row\n");
    assert!(!roadmap["body"].as_str().unwrap().contains("Phase 30"));
    assert!(!roadmap["body"].as_str().unwrap().contains("Phase 32"));

    let resumed = client.call("cadence_query", json!({"operation":"execute-next","phase":31}));
    let completed = resumed["dispatch"]["operational"]["completed"].as_array().unwrap().iter()
        .find(|entry| entry["id"] == "fixture-one-a").unwrap();
    assert_eq!(completed["completion"], completion);
    let summary = client.call("cadence_query", json!({"operation":"document",
        "identity":completed["document_identity"],"part":"row"}));
    assert!(summary["body"].as_str().unwrap().contains("fixture-one-a"), "{summary}");
    assert!(summary["body"].as_str().unwrap().contains(&completion), "{summary}");

    let phase_hits = client.call("cadence_query", json!({"operation":"search",
        "pattern":"HANDWRITTEN NATIVE TRUTH SENTENCE","scope":{"kind":"phase-documents","phase":31}}));
    assert_eq!(phase_hits["hits"].as_array().unwrap().len(), 1, "{phase_hits}");
    assert!(phase_hits["hits"][0]["identity"].is_object(), "{phase_hits}");
    assert_eq!(phase_hits["hits"][0]["part"], "truth:T4");
    assert!(phase_hits["hits"][0].get("file").is_none(), "{phase_hits}");
    let followed = client.call("cadence_query", json!({"operation":"document",
        "identity":phase_hits["hits"][0]["identity"],"part":phase_hits["hits"][0]["part"]}));
    assert_eq!(followed["body"], truth["body"]);

    for answer in [
        client.call("cadence_query", json!({"operation":"document",
            "identity":{"kind":"phase-plan","phase":31,"plan":99},"part":"task:missing"})),
        client.call("cadence_query", json!({"operation":"document",
            "identity":{"kind":"phase-context","phase":30},"part":"truth:T4"})),
        client.call("cadence_query", json!({"operation":"read","file":"phases/31/PLAN-2.md"})),
        client.call("cadence_query", json!({"operation":"document",
            "identity":{"kind":"path","path":"phases/31/PLAN-2.md"},"part":"task:fixture-two-a"})),
    ] {
        assert_eq!(answer["status"], "refused", "{answer}");
        assert!(answer.get("body").is_none(), "{answer}");
        no_process_path(&answer);
    }
    for answer in [&intake, &readback, &context_index, &truth, &page, &roadmap, &summary, &phase_hits] {
        no_process_path(answer);
    }
    client.finish();
}
