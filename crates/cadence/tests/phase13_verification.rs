#[path = "support/phase13.rs"]
mod phase13;
use phase13::*;
use serde_json::{Value, json};

fn inspected_patch(project: &std::path::Path, id: &str) -> (Value, Value) {
    inspected_with(project, id, &[])
}

// A fresh dispatch, one independent run per saved check, and one complete
// handwritten patch; `verdicts` overrides (item, verdict, observed) rows.
fn inspected_with(project: &std::path::Path, id: &str, verdicts: &[(&str, &str, &str)]) -> (Value, Value) {
    let dispatch = query(project, json!({"operation":"verify-next","phase":13,"request_id":id}));
    assert_eq!(dispatch["status"], "ok", "{dispatch}");
    let attempt = dispatch["attempt"].clone();
    let mut items = Vec::new();
    let mut client = Client::open(project);
    for item in attempt["inputs"]["map"]["items"].as_array().unwrap() {
        let mut runs = Vec::new();
        if item["kind"] == "check" {
            let run = format!("{id}-{}", item["id"].as_str().unwrap());
            let launched = client.call("cadence_apply", json!({"operation":"verification-run","request":{
                "request_id":run,"attempt":attempt["id"],"basis":attempt["inputs"]["basis"],
                "item":{"id":item["id"],"item_revision":item["item_revision"]}}}));
            assert_eq!(launched["status"], "ok", "{launched}");
            let deadline = std::time::Instant::now() + std::time::Duration::from_secs(30);
            loop {
                let read = client.call("cadence_query", json!({"operation":"verification-read","phase":13,"attempt":attempt["id"]}));
                if let Some(result) = read["runs"].as_array().unwrap().iter()
                    .find(|r| r["event"]["kind"] == "result" && r["event"]["run_id"] == run) {
                    assert_eq!(result["event"]["result"]["disposition"], json!({"kind":"exited","code":0}));
                    assert_eq!(result["event"]["result"]["material_unchanged"], true);
                    break;
                }
                assert!(std::time::Instant::now() < deadline, "{read}");
                std::thread::sleep(std::time::Duration::from_millis(10));
            }
            runs.push(run);
        }
        let (verdict, observed) = verdicts.iter().find(|(name, _, _)| item["id"] == *name)
            .map_or(("accepted", "Inspected the specified fixture evidence."), |(_, verdict, observed)| (verdict, observed));
        items.push(json!({"id":item["id"],"item_revision":item["item_revision"],
            "verdict":verdict,"observed":observed,"runs":runs}));
    }
    client.finish();
    let patch = json!({"request_id":format!("{id}-patch"),"attempt":attempt["id"],
        "basis":attempt["inputs"]["basis"],"items":items});
    (attempt, patch)
}

// Refusal history may append; everything except that separate history remains
// byte-identical after the real server has exited and the store is reopened.
fn acceptance_bytes(project: &std::path::Path) -> Vec<u8> {
    let reopened = reopened(project);
    let mut data = reopened.snapshot.data;
    let effective = data["verification"]["patches"].clone();
    data.as_object_mut().unwrap().remove("verification");
    let mut files = tree(project);
    files.remove(&std::path::PathBuf::from(".planning/state.json"));
    files.remove(&std::path::PathBuf::from(".planning/decisions.jsonl"));
    serde_json::to_vec(&(data, effective, files)).unwrap()
}

#[test]
fn phase13_mismatched_verdict_patch_is_refused() {
    let fixture = Completed::new();
    let project = fixture.project();
    let (attempt, valid) = inspected_patch(project, "patch-attempt");
    let baseline = acceptance_bytes(project);
    let mut variants = Vec::new();
    let mut unknown = valid.clone();
    unknown["items"][0]["id"] = json!("unknown/item");
    variants.push((unknown, "verification-item", "items[0].id", "unknown/item"));
    let mut missing = valid.clone();
    missing["items"].as_array_mut().unwrap().remove(0);
    variants.push((missing, "verification-item", "items", "artifact/shared"));
    let mut duplicate = valid.clone();
    duplicate["items"].as_array_mut().unwrap().push(valid["items"][0].clone());
    variants.push((duplicate, "verification-item", "items[4].id", "artifact/shared"));
    let mut revision = valid.clone();
    revision["items"][0]["item_revision"] = json!("wrong-revision");
    variants.push((revision, "verification-item", "items[0].item_revision", "artifact/shared"));
    for (pointer, slot, replacement) in [
        ("/basis/map_digest", "basis.map_digest", json!("stale-map")),
        ("/basis/truths/0/version", "basis.truths", json!(2)),
        ("/basis/publications/0/content_revision", "basis.publications", json!("wrong-content")),
        ("/basis/occurrence", "basis.occurrence", json!("foreign-occurrence")),
        ("/basis/root_binding", "basis.root_binding", json!("foreign-root")),
        ("/basis/project", "basis.project", json!("/foreign-project")),
        ("/basis/context_digest", "basis.context_digest", json!("wrong-context")),
        ("/basis/admission_digests", "basis.admission_digests", json!([])),
        ("/basis/execution_digest", "basis.execution_digest", json!("wrong-execution")),
        ("/basis/source/head", "basis.source", json!("foreign-head")),
        ("/basis/source/tree", "basis.source", json!("foreign-tree")),
        ("/basis/source/index_digest", "basis.source", json!("foreign-index")),
        ("/basis/source/material_digest", "basis.source", json!("foreign-material")),
    ] {
        let mut patch = valid.clone();
        *patch.pointer_mut(pointer).unwrap() = replacement;
        variants.push((patch, "verification-basis", slot, ""));
    }
    let mut no_run = valid.clone();
    no_run["items"][1]["runs"] = json!([]);
    variants.push((no_run, "verification-run", "items[1].runs", "check/A"));
    let mut executor_run = valid.clone();
    executor_run["items"][1]["runs"] = json!(["green-1"]);
    variants.push((executor_run, "verification-run", "items[1].runs", "check/A"));
    for (index, (mut patch, rule, slot, item)) in variants.into_iter().enumerate() {
        patch["request_id"] = json!(format!("invalid-{index}"));
        let response = apply(project, json!({"operation":"verification-submit","patch":patch}));
        assert_eq!(response["status"], "refused", "mismatched patch accepted: {response}");
        assert_eq!(response["rule"], rule, "refusal must identify the mismatched item/input: {response}");
        assert_eq!(response["slot"], slot, "{response}");
        if !item.is_empty() { assert_eq!(response["id"], item, "{response}"); }
        if rule == "verification-basis" || slot.ends_with("item_revision") {
            assert!(response["details"].get("requested").is_some(), "{response}");
            assert!(response["details"].get("current").is_some(), "{response}");
        }
        assert_eq!(acceptance_bytes(project), baseline);
        let claims = reopened(project).snapshot.data["verification"]["claims"].clone();
        let retained = claims.as_array().unwrap().iter().find(|c| c["patch"]["request_id"] == patch["request_id"]).unwrap();
        assert_eq!(retained["patch"], patch);
        assert_eq!(retained["answer"]["rule"], rule);
        let before_replay = tree(project);
        assert_eq!(apply(project, json!({"operation":"verification-submit","patch":patch})), response);
        assert_eq!(tree(project), before_replay);
    }
    for (field, value) in [("phase_pass", json!(true)), ("truth_status", json!("met")),
        ("write_file", json!({"path":"findings.md","content":"passed"}))] {
        let mut patch = valid.clone();
        patch[field] = value;
        let before = tree(project);
        let response = apply(project, json!({"operation":"verification-submit","patch":patch}));
        assert_eq!(response["status"], "refused");
        assert_eq!(response["rule"], "verification-shape");
        assert!(response["reason"].as_str().unwrap().contains(field), "{response}");
        assert_eq!(acceptance_bytes(project), baseline);
        assert_eq!(tree(project), before, "transport-invalid input is not a domain claim");
    }
    let accepted = apply(project, json!({"operation":"verification-submit","patch":valid}));
    assert_eq!(accepted["status"], "ok", "valid complete control: {accepted}");
    assert_eq!(accepted["receipt"]["patch"], valid);
    assert_eq!(accepted["receipt"]["application"], "accepted");
    assert_eq!(reopened(project).snapshot.data["verification"]["patches"], json!([valid]));
    let accepted_bytes = acceptance_bytes(project);
    let before = tree(project);
    assert_eq!(apply(project, json!({"operation":"verification-submit","patch":valid})), accepted);
    assert_eq!(tree(project), before);
    let mut conflict = valid.clone();
    conflict["items"][0]["observed"] = json!("Changed claim under the same request.");
    let response = apply(project, json!({"operation":"verification-submit","patch":conflict}));
    assert_eq!(response["rule"], "verification-request-reuse");
    assert_eq!(response["slot"], "request_id");
    assert_eq!(acceptance_bytes(project), accepted_bytes);
    let mut second = valid.clone();
    second["request_id"] = json!("second-completion");
    assert_eq!(apply(project, json!({"operation":"verification-submit","patch":second}))["rule"], "verification-attempt-complete");
    assert_eq!(acceptance_bytes(project), accepted_bytes);
    // Actual source staleness, not a forged HEAD in the input.
    std::fs::write(project.join("src/a.py"), "def answer():\n    return 7 # repaired implementation\n").unwrap();
    git_value(project, &["add", "src/a.py"]);
    git_value(project, &["commit", "-m", "Fixture repair"]);
    let mut stale = valid.clone();
    stale["request_id"] = json!("source-stale");
    let before = acceptance_bytes(project);
    let response = apply(project, json!({"operation":"verification-submit","patch":stale}));
    assert_eq!(response["rule"], "verification-basis", "{response}");
    assert_eq!(response["slot"], "basis.source");
    assert_eq!(response["details"]["requested"], attempt["inputs"]["basis"]["source"]);
    assert_eq!(response["details"]["current"]["head"], git_value(project, &["rev-parse", "HEAD"]));
    assert_eq!(acceptance_bytes(project), before);
    let (_, current) = inspected_patch(project, "current-source");
    // Actual approved union extension; an admitted plan is never replaced.
    let gap = proposal(project, "new-map", &[(None, attached(vec![artifact("artifact/gap", &["truth/A"])]))]);
    publish(project, &gap);
    let map = query(project, json!({"operation":"evidence-read","phase":13}));
    let before = acceptance_bytes(project);
    let response = apply(project, json!({"operation":"verification-submit","patch":current}));
    assert_eq!(response["rule"], "verification-basis", "{response}");
    assert_eq!(response["slot"], "basis.map_digest");
    assert_eq!(response["details"]["requested"], current["basis"]["map_digest"]);
    assert_eq!(response["details"]["current"], map["input_digest"]);
    assert_eq!(acceptance_bytes(project), before);
    assert_eq!(apply(project, json!({"operation":"verification-submit","patch":valid})), accepted);
    assert_eq!(acceptance_bytes(project), before, "historical replay does not reinstall acceptance");
    for name in ["findings.md", ".planning/findings.md", ".planning/phases/13/UAT.md"] {
        assert!(!project.join(name).exists());
    }
}

#[test]
fn phase13_dispatch_carries_current_verification_inputs() {
    let fixture = Completed::new();
    let project = fixture.project();
    assert_eq!(fixture.dispatches.len(), 2);
    let execution = history(project);
    assert!(execution["tasks"].as_array().unwrap().iter().all(|t| t["state"]["completed"] == true));
    let request = json!({"operation":"verify-next","phase":13,"request_id":"verify-first"});
    let dispatch = query(project, request.clone());
    assert_eq!(dispatch["status"], "ok", "verifier dispatch must be retained: {dispatch}");
    let attempt = &dispatch["attempt"];
    let prompt = attempt["prompt"].as_str().expect("retained verifier prompt");
    let operational: Value = serde_json::from_str(prompt.split("<operational-input>\n").nth(1).unwrap()
        .split("\n</operational-input>").next().unwrap()).unwrap();
    assert_eq!(operational["map"], fixture.map);
    assert_eq!(operational["map"]["truths"], json!([
        {"id":"truth/A","version":1,"text":"When a parcel arrives, the recipient gets the parcel.","kind":"property"},
        {"id":"truth/B","version":1,"text":"When a second parcel arrives, the recipient gets the parcel.","kind":"property"}
    ]));
    let ids: Vec<_> = operational["map"]["items"].as_array().unwrap().iter().map(|i| i["id"].as_str().unwrap()).collect();
    assert_eq!(ids, ["artifact/shared", "check/A", "check/B", "link/parcel"]);
    let associations: Vec<_> = operational["map"]["associations"].as_array().unwrap().iter()
        .map(|a| (a["origin"]["plan"].as_u64().unwrap(), a["origin"]["item_id"].as_str().unwrap(), a["truth_id"].as_str().unwrap(), a["reason"].as_str().unwrap())).collect();
    assert_eq!(associations, [
        (1,"artifact/shared","truth/A","This causes the promised delivery."),
        (1,"artifact/shared","truth/B","This causes the promised delivery."),
        (1,"check/A","truth/A","This causes the promised delivery."),
        (1,"link/parcel","truth/A","This causes the promised delivery."),
        (2,"artifact/shared","truth/A","This causes the promised delivery."),
        (2,"artifact/shared","truth/B","This causes the promised delivery."),
        (2,"check/B","truth/B","This causes the promised delivery.")]);
    assert_eq!(operational["basis"]["map_digest"], fixture.map["input_digest"]);
    assert_eq!(operational["basis"]["publications"], fixture.admission["receipt"]["request"]["contract"]["plans"]);
    assert_eq!(operational["admissions"], json!([fixture.admission["receipt"]]));
    assert_eq!(operational["execution"]["events"], execution["events"]);
    assert_eq!(operational["execution"]["plan_events"], execution["plan_events"]);
    let pairs: Vec<_> = operational["execution"]["events"].as_array().unwrap().iter()
        .filter(|e| e["request"]["event"]["kind"] == "close")
        .flat_map(|e| e["request"]["event"]["submission"]["checks"].as_array().unwrap().clone()).collect();
    assert_eq!(pairs, fixture.pairs);
    let statements: Vec<_> = operational["execution"]["events"].as_array().unwrap().iter()
        .filter(|e| e["request"]["event"]["kind"] == "owner-statement")
        .map(|e| { let mut v = e["request"]["event"].clone(); v.as_object_mut().unwrap().remove("kind"); v }).collect();
    assert_eq!(statements, fixture.statements);
    let commands: Vec<_> = operational["checks"].as_array().unwrap().iter().map(|c| c["spec"]["command"].as_str().unwrap()).collect();
    assert_eq!(commands, ["python3 -B tests/a.py", "python3 -B tests/b.py"]);
    for check in operational["checks"].as_array().unwrap() {
        let saved = fixture.map["items"].as_array().unwrap().iter().find(|i| i["id"] == check["id"]).unwrap();
        assert_eq!(check["spec"], saved["spec"]);
    }
    assert_eq!(operational["basis"]["source"]["head"], git_value(project, &["rev-parse","HEAD"]));
    assert_eq!(operational["basis"]["source"]["tree"], git_value(project, &["rev-parse","HEAD^{tree}"]));
    for key in ["index_digest", "material_digest"] { assert!(!operational["basis"]["source"][key].as_str().unwrap().is_empty()); }
    assert!(prompt.contains(cadence::verification::instructions::VERIFIER),
        "the prompt receipt must retain the binary's compiled verifier text");
    assert!(prompt.contains("Strict item patch schema"));
    assert!(!prompt.contains("configured-alternative"));
    assert!(!prompt.contains("All imaginary checks passed"));
    assert!(!prompt.contains("findings_file"));
    let before = tree(project);
    let stored = reopened(project).snapshot;
    assert_eq!(tree(project), before);
    assert_eq!(query(project, request.clone())["attempt"], *attempt);
    assert_eq!(query(project, json!({"operation":"verification-read","phase":13,"attempt":attempt["id"]}))["attempt"], *attempt);
    assert_eq!(tree(project), before);
    assert_eq!(reopened(project).snapshot, stored);
    // A historical replay is stable even when current source changes.
    std::fs::write(project.join("src/a.py"), "def answer():\n    return 8\n").unwrap();
    assert_eq!(query(project, request.clone())["attempt"], *attempt);
    let dirty = query(project, json!({"operation":"verify-next","phase":13,"request_id":"dirty"}));
    assert_eq!(dirty["status"], "refused", "{dirty}");
    assert_eq!(dirty["rule"], "verification-source");
    let changed = query(project, json!({"operation":"verify-next","phase":28,"request_id":"verify-first"}));
    assert_eq!(changed["status"], "refused", "{changed}");
    assert_eq!(changed["rule"], "verification-request-reuse");
    std::fs::write(project.join("src/a.py"), "def answer():\n    return 7\n").unwrap();
    let plan = project.join(".planning/phases/13/PLAN-2.md");
    let original = std::fs::read(&plan).unwrap();
    std::fs::write(&plan, b"drifted native publication\n").unwrap();
    let refused = query(project, json!({"operation":"verify-next","phase":13,"request_id":"drift"}));
    assert_eq!(refused["status"], "refused", "{refused}");
    assert_eq!(refused["rule"], "installed-plan");
    std::fs::write(&plan, original).unwrap();
    assert_eq!(query(project, request)["attempt"], *attempt);
    assert_eq!(tree(project), before);
    let missing = phase13::fixture();
    let before = tree(missing.path());
    let refused = query(missing.path(), json!({"operation":"verify-next","phase":13,"request_id":"missing"}));
    assert_eq!(refused["status"], "refused", "{refused}");
    assert_eq!(refused["rule"], "native-approved-truths");
    // An absent authority must not be replaced with a fabricated attempt.
    assert!(!serde_json::to_string(&tree(missing.path())).unwrap().contains("verification-attempt-1"));
    assert_eq!(tree(missing.path()), before);
}

fn report(project: &std::path::Path) -> Value {
    query(project, json!({"operation":"verification-read","phase":13}))
}

fn submitted(project: &std::path::Path, id: &str, verdicts: &[(&str, &str, &str)]) -> (Value, Value) {
    let (attempt, patch) = inspected_with(project, id, verdicts);
    let answer = apply(project, json!({"operation":"verification-submit","patch":patch}));
    assert_eq!(answer["status"], "ok", "complete patch for {id}: {answer}");
    (attempt, patch)
}

// Handwritten truth row. Items are (id, kind, verdict, observed) in id order;
// a check's independent run id follows the inspection id it was launched under.
fn row(map: &Value, run: &str, truth: &str, text: &str, status: &str, reason: &str, items: &[(&str, &str, &str, &str)]) -> Value {
    let items: Vec<_> = items.iter().map(|(id, kind, verdict, observed)| {
        let saved = map["items"].as_array().unwrap().iter().find(|i| i["id"] == *id).unwrap();
        json!({"id":id,"kind":kind,"item_revision":saved["item_revision"],"verdict":verdict,"observed":observed,
            "runs":if *kind == "check" { json!([format!("{run}-{id}")]) } else { json!([]) },
            "reasons":["This causes the promised delivery."]})
    }).collect();
    json!({"id":truth,"version":1,"text":text,"status":status,"reason":reason,"items":items})
}

fn pending(truth: &str, text: &str) -> Value {
    json!({"id":truth,"version":1,"text":text,"status":"pending","reason":"no complete applicable verification","items":[]})
}

const A: &str = "When a parcel arrives, the recipient gets the parcel.";
const B: &str = "When a second parcel arrives, the recipient gets the parcel.";
const SEEN: &str = "Inspected the specified fixture evidence.";
const MET: &str = "every item accepted and none is an observation";
const CONCERNS: &str = "every item accepted and at least one is an observation";
const LEGACY: &str = "historical classification only; never native evidence";

#[test]
fn phase13_report_derives_truth_status_from_every_item() {
    let fixture = Completed::new();
    let project = fixture.project();
    let map = &fixture.map;
    let context = reopened(project).snapshot.data["context"].clone();
    // Execution is complete and SUMMARY claims success; nothing is verified yet.
    let before = tree(project);
    let read = report(project);
    assert_eq!(read["status"], "ok", "{read}");
    assert_eq!(read["schema"], "verification-report-1");
    assert_eq!(read["current"]["applicable"], false);
    assert_eq!(read["current"]["reason"], "no verification attempt");
    assert_eq!(read["current"]["attempt"], Value::Null);
    assert_eq!(read["current"]["verified_at"], Value::Null);
    assert_eq!(read["current"]["observed"]["source"]["head"], git_value(project, &["rev-parse", "HEAD"]));
    assert_eq!(read["truths"], json!([pending("truth/A", A), pending("truth/B", B)]));
    assert_eq!(read["history"], json!([]));
    assert_eq!(read["legacy"], json!({"summary_document":true,"uat_document":false,"authority":LEGACY}));
    let text = read["report"].as_str().unwrap();
    assert!(text.contains("Current: none - no verification attempt"), "{text}");
    assert!(text.contains("| truth/A | pending | - |"), "{text}");
    assert!(text.contains("Legacy: SUMMARY present, UAT absent - historical classification only, never native evidence."), "{text}");
    assert_eq!(tree(project), before, "readback writes nothing");
    // An open attempt with finished runs is still not a verification.
    let (first, first_patch) = inspected_patch(project, "all-accepted");
    let read = report(project);
    assert_eq!(read["current"]["applicable"], false);
    assert_eq!(read["current"]["reason"], "no complete verification on the current basis");
    assert_eq!(read["truths"], json!([pending("truth/A", A), pending("truth/B", B)]));
    assert_eq!(read["history"][0]["attempt"], first["id"]);
    assert_eq!(read["history"][0]["applicability"], "open");
    assert_eq!(read["history"][0]["reason"], "attempt has no complete patch");
    assert_eq!(read["history"][0]["application"], Value::Null);
    let answer = apply(project, json!({"operation":"verification-submit","patch":first_patch}));
    assert_eq!(answer["status"], "ok", "{answer}");
    let read = report(project);
    assert_eq!(read["current"], json!({"applicable":true,"attempt":first["id"],"patch":"all-accepted-patch",
        "reason":"complete patch on the current basis","verified_at":first["inputs"]["basis"],
        "observed":first["inputs"]["basis"],"unavailable":null}));
    assert_eq!(read["current"]["verified_at"]["map_digest"], map["input_digest"]);
    assert_eq!(read["current"]["verified_at"]["source"]["head"], git_value(project, &["rev-parse", "HEAD"]));
    assert_eq!(read["current"]["verified_at"]["source"]["tree"], git_value(project, &["rev-parse", "HEAD^{tree}"]));
    assert_eq!(read["current"]["verified_at"]["publications"], fixture.admission["receipt"]["request"]["contract"]["plans"]);
    let met_a = row(map, "all-accepted", "truth/A", A, "met", MET, &[
        ("artifact/shared", "artifact", "accepted", SEEN), ("check/A", "check", "accepted", SEEN), ("link/parcel", "link", "accepted", SEEN)]);
    let met_b = row(map, "all-accepted", "truth/B", B, "met", MET, &[
        ("artifact/shared", "artifact", "accepted", SEEN), ("check/B", "check", "accepted", SEEN)]);
    assert_eq!(read["truths"], json!([met_a, met_b]));
    assert_eq!(read["history"][0]["applicability"], "current");
    assert_eq!(read["history"][0]["application"], "accepted");
    assert_eq!(read["history"][0]["patch"], "all-accepted-patch");
    assert_eq!(read["history"][0]["truths"], read["truths"]);
    let text = read["report"].as_str().unwrap();
    assert!(text.contains(&format!("Current: attempt {}, patch all-accepted-patch", first["id"].as_str().unwrap())), "{text}");
    assert!(text.contains("| truth/A | met | artifact/shared accepted; check/A accepted; link/parcel accepted |"), "{text}");
    assert!(text.contains("| truth/B | met | artifact/shared accepted; check/B accepted |"), "{text}");
    // Restart: the store is reopened and a fresh server derives the same rows.
    let stored = reopened(project).snapshot;
    assert_eq!(report(project), read);
    assert_eq!(reopened(project).snapshot, stored);
    assert_eq!(query(project, json!({"operation":"verification-read","phase":13,"attempt":first["id"]}))["truths"], read["truths"]);
    // A rejected shared artifact reaches every association it names, and the
    // accepted checks cannot cover it.
    let (second, _) = submitted(project, "rejected-artifact", &[("artifact/shared", "rejected", "The destination is an empty placeholder directory.")]);
    let read = report(project);
    assert_eq!(read["current"]["attempt"], second["id"]);
    let unmet_a = row(map, "rejected-artifact", "truth/A", A, "unmet", "rejected or not seen: artifact/shared", &[
        ("artifact/shared", "artifact", "rejected", "The destination is an empty placeholder directory."),
        ("check/A", "check", "accepted", SEEN), ("link/parcel", "link", "accepted", SEEN)]);
    let unmet_b = row(map, "rejected-artifact", "truth/B", B, "unmet", "rejected or not seen: artifact/shared", &[
        ("artifact/shared", "artifact", "rejected", "The destination is an empty placeholder directory."),
        ("check/B", "check", "accepted", SEEN)]);
    assert_eq!(read["truths"], json!([unmet_a, unmet_b]));
    assert_eq!(read["history"][0]["applicability"], "historical");
    assert_eq!(read["history"][0]["reason"], format!("superseded by attempt {}", second["id"].as_str().unwrap()));
    assert_eq!(read["history"][0]["truths"], json!([met_a, met_b]), "historical judgments keep their rows");
    assert_eq!(read["history"][1]["applicability"], "current");
    let text = read["report"].as_str().unwrap();
    assert!(text.contains("| truth/A | unmet | artifact/shared rejected; check/A accepted; link/parcel accepted |"), "{text}");
    assert!(text.contains("| truth/B | unmet | artifact/shared rejected; check/B accepted |"), "{text}");
    assert!(text.contains(&format!("- attempt {}: historical - superseded by attempt {}; truth/A met; truth/B met",
        first["id"].as_str().unwrap(), second["id"].as_str().unwrap())), "{text}");
    // A rejected link named by one truth leaves the other truth met.
    let (third, _) = submitted(project, "rejected-link", &[("link/parcel", "rejected", "The sender never hands the recipient a parcel.")]);
    let read = report(project);
    assert_eq!(read["current"]["attempt"], third["id"]);
    assert_eq!(read["truths"], json!([
        row(map, "rejected-link", "truth/A", A, "unmet", "rejected or not seen: link/parcel", &[
            ("artifact/shared", "artifact", "accepted", SEEN), ("check/A", "check", "accepted", SEEN),
            ("link/parcel", "link", "rejected", "The sender never hands the recipient a parcel.")]),
        row(map, "rejected-link", "truth/B", B, "met", MET, &[
            ("artifact/shared", "artifact", "accepted", SEEN), ("check/B", "check", "accepted", SEEN)])]));
    // Explicit not_seen is complete and negative.
    let (fourth, _) = submitted(project, "not-seen", &[("check/B", "not_seen", "tests/b.py could not be opened during inspection.")]);
    let read = report(project);
    assert_eq!(read["current"]["attempt"], fourth["id"]);
    let not_seen_a = row(map, "not-seen", "truth/A", A, "met", MET, &[
        ("artifact/shared", "artifact", "accepted", SEEN), ("check/A", "check", "accepted", SEEN), ("link/parcel", "link", "accepted", SEEN)]);
    let not_seen_b = row(map, "not-seen", "truth/B", B, "unmet", "rejected or not seen: check/B", &[
        ("artifact/shared", "artifact", "accepted", SEEN),
        ("check/B", "check", "not_seen", "tests/b.py could not be opened during inspection.")]);
    assert_eq!(read["truths"], json!([not_seen_a, not_seen_b]));
    assert_eq!(read["history"].as_array().unwrap().len(), 4);
    assert_eq!(read["history"][2]["reason"], format!("superseded by attempt {}", fourth["id"].as_str().unwrap()));
    // No truth status was written into the approved context, and execution
    // completion never became acceptance.
    assert_eq!(reopened(project).snapshot.data["context"], context);
    assert_eq!(reopened(project).snapshot.data["verification"]["patches"].as_array().unwrap().len(), 4);
    // A real repair commit makes every judgment historical until reverified.
    let old_head = git_value(project, &["rev-parse", "HEAD"]);
    std::fs::write(project.join("src/b.py"), "def answer():\n    return 7 # repaired implementation\n").unwrap();
    git_value(project, &["add", "src/b.py"]);
    git_value(project, &["commit", "-m", "Fixture repair"]);
    let new_head = git_value(project, &["rev-parse", "HEAD"]);
    let read = report(project);
    assert_eq!(read["current"]["applicable"], false);
    assert_eq!(read["current"]["attempt"], Value::Null);
    assert_eq!(read["current"]["reason"], "no complete verification on the current basis");
    assert_eq!(read["current"]["observed"]["source"]["head"], new_head);
    assert_eq!(read["truths"], json!([pending("truth/A", A), pending("truth/B", B)]));
    for (index, attempt) in [&first, &second, &third, &fourth].into_iter().enumerate() {
        assert_eq!(read["history"][index]["attempt"], attempt["id"]);
        assert_eq!(read["history"][index]["applicability"], "historical");
        assert_eq!(read["history"][index]["basis"], attempt["inputs"]["basis"]);
        assert_eq!(read["history"][index]["basis"]["source"]["head"], old_head);
        assert_eq!(read["history"][index]["differs"], json!(["basis.source"]));
    }
    assert_eq!(read["history"][3]["reason"], "basis differs from current: basis.source");
    assert_eq!(read["history"][3]["truths"], json!([not_seen_a, not_seen_b]));
    let text = read["report"].as_str().unwrap();
    assert!(text.contains("Current: none - no complete verification on the current basis"), "{text}");
    // Uncommitted source is ambiguous: nothing is current and the refusal is located.
    std::fs::write(project.join("src/a.py"), "def answer():\n    return 9\n").unwrap();
    let read = report(project);
    assert_eq!(read["status"], "ok", "{read}");
    assert_eq!(read["current"]["applicable"], false);
    assert_eq!(read["current"]["reason"], "current verification inputs unavailable");
    assert_eq!(read["current"]["unavailable"]["rule"], "verification-source");
    assert_eq!(read["current"]["observed"], Value::Null);
    assert_eq!(read["truths"], json!([pending("truth/A", A), pending("truth/B", B)]));
    assert_eq!(read["history"][3]["reason"], "current verification inputs unavailable");
    std::fs::write(project.join("src/a.py"), "def answer():\n    return 7\n").unwrap();
    // A fresh applicable attempt restores the current rows; the rejected
    // original attempt stays in history with its own identity.
    let (fifth, _) = submitted(project, "fresh", &[]);
    let read = report(project);
    assert_eq!(read["current"]["attempt"], fifth["id"]);
    assert_eq!(read["current"]["verified_at"]["source"]["head"], new_head);
    assert_eq!(read["truths"], json!([
        row(map, "fresh", "truth/A", A, "met", MET, &[
            ("artifact/shared", "artifact", "accepted", SEEN), ("check/A", "check", "accepted", SEEN), ("link/parcel", "link", "accepted", SEEN)]),
        row(map, "fresh", "truth/B", B, "met", MET, &[
            ("artifact/shared", "artifact", "accepted", SEEN), ("check/B", "check", "accepted", SEEN)])]));
    assert_eq!(read["history"].as_array().unwrap().len(), 5);
    assert_eq!(read["history"][3]["applicability"], "historical");
    assert_eq!(read["history"][3]["reason"], "basis differs from current: basis.source");
    assert_eq!(read["history"][3]["truths"], json!([not_seen_a, not_seen_b]));
    assert_eq!(read["history"][4]["applicability"], "current");
    let stored = reopened(project).snapshot;
    assert_eq!(report(project), read);
    assert_eq!(reopened(project).snapshot, stored);
    for name in ["findings.md", ".planning/findings.md", ".planning/phases/13/UAT.md"] {
        assert!(!project.join(name).exists());
    }
    // A separate generic fixture phase carries a supplementary observation:
    // all accepted caps at concerns, and a negative observation verdict is unmet.
    let generic = Completed::with_observation();
    let host = generic.project();
    let map = &generic.map;
    let observed = |observed: &str| row(map, "seen", "truth/B", B, "concerns", CONCERNS, &[
        ("artifact/shared", "artifact", "accepted", SEEN), ("check/B", "check", "accepted", SEEN),
        ("observation/host", "observation", "accepted", observed)]);
    submitted(host, "seen", &[("observation/host", "accepted", "Seen by Fixture Owner on 2026-09-11 on the real host.")]);
    let read = report(host);
    assert_eq!(read["truths"], json!([
        row(map, "seen", "truth/A", A, "met", MET, &[
            ("artifact/shared", "artifact", "accepted", SEEN), ("check/A", "check", "accepted", SEEN), ("link/parcel", "link", "accepted", SEEN)]),
        observed("Seen by Fixture Owner on 2026-09-11 on the real host.")]));
    let text = read["report"].as_str().unwrap();
    assert!(text.contains("| truth/B | concerns | artifact/shared accepted; check/B accepted; observation/host accepted |"), "{text}");
    submitted(host, "unseen", &[("observation/host", "not_seen", "No host episode was available to the inspector.")]);
    let read = report(host);
    assert_eq!(read["truths"][0]["status"], "met");
    assert_eq!(read["truths"][1], row(map, "unseen", "truth/B", B, "unmet", "rejected or not seen: observation/host", &[
        ("artifact/shared", "artifact", "accepted", SEEN), ("check/B", "check", "accepted", SEEN),
        ("observation/host", "observation", "not_seen", "No host episode was available to the inspector.")]));
    submitted(host, "refuted", &[("observation/host", "rejected", "The host showed no delivery.")]);
    let read = report(host);
    assert_eq!(read["truths"][0]["status"], "met");
    assert_eq!(read["truths"][1]["status"], "unmet");
    assert_eq!(read["truths"][1]["reason"], "rejected or not seen: observation/host");
    assert_eq!(read["history"][0]["truths"][1]["status"], "concerns", "the capped judgment stays in history");
    let stored = reopened(host).snapshot;
    assert_eq!(report(host), read);
    assert_eq!(reopened(host).snapshot, stored);
}

fn waive(id: &str, submission: &Value) -> Value {
    json!({"operation":"truth-waive","request_id":id,"submission":submission,
        "approval":{"approved":true,"owner":"Fixture Owner","at":"2026-09-11T15:00:00Z","submission":submission}})
}

fn waiver(basis: &Value, truth: &str, version: u32, reason: &str) -> Value {
    json!({"truth":{"id":truth,"version":version},"basis":basis,"reason":reason,
        "owner":"Fixture Owner","at":"2026-09-11T15:00:00Z","supersedes":null,"revoked":false})
}

#[test]
fn phase13_owner_waiver_is_distinct_from_met() {
    let fixture = Completed::new();
    let project = fixture.project();
    let map = &fixture.map;
    let context = reopened(project).snapshot.data["context"].clone();
    // One met and one unmet truth, with the rejection retained.
    let rejected = "tests/b.py asserts nothing about the second parcel.";
    let (reviewed, _) = submitted(project, "reviewed", &[("check/B", "rejected", rejected)]);
    let basis = reviewed["inputs"]["basis"].clone();
    let met_a = row(map, "reviewed", "truth/A", A, "met", MET, &[
        ("artifact/shared", "artifact", "accepted", SEEN), ("check/A", "check", "accepted", SEEN), ("link/parcel", "link", "accepted", SEEN)]);
    let unmet_b = row(map, "reviewed", "truth/B", B, "unmet", "rejected or not seen: check/B", &[
        ("artifact/shared", "artifact", "accepted", SEEN), ("check/B", "check", "rejected", rejected)]);
    let read = report(project);
    assert_eq!(read["truths"], json!([met_a, unmet_b]));
    assert_eq!(read["counts"], json!({"met":1,"concerns":0,"unmet":1,"pending":0,"waived":0}));
    assert_eq!(read["waivers"], json!([]));
    let valid = waiver(&basis, "truth/B", 1, "The second parcel ships in phase 14.");
    let before = tree(project);
    let stored = reopened(project).snapshot;
    // Only exact owner approval waives. Each variant is refused with the
    // offending input located and nothing durable changes.
    let mut variants: Vec<(Value, &str, &str)> = Vec::new();
    let mut unapproved = waive("unapproved", &valid);
    unapproved["approval"]["approved"] = json!(false);
    variants.push((unapproved, "verification-approval", "approval.approved"));
    let mut mismatched = waive("mismatched", &valid);
    mismatched["approval"]["submission"]["reason"] = json!("A different reason than the owner saw.");
    variants.push((mismatched, "verification-approval", "approval.submission"));
    let mut anonymous = waive("anonymous", &valid);
    anonymous["approval"]["owner"] = json!("   ");
    variants.push((anonymous, "verification-approval", "approval.owner"));
    let mut undated = waive("undated", &valid);
    undated["approval"]["at"] = json!("");
    variants.push((undated, "verification-approval", "approval.at"));
    for (field, slot) in [("reason", "submission.reason"), ("owner", "submission.owner"), ("at", "submission.at")] {
        let mut blank = valid.clone();
        blank[field] = json!("  ");
        variants.push((waive(&format!("blank-{field}"), &blank), "verification-waiver", slot));
    }
    variants.push((waive("stale-version", &waiver(&basis, "truth/B", 2, "Version two never existed.")), "verification-truth", "submission.truth"));
    variants.push((waive("unknown-truth", &waiver(&basis, "truth/C", 1, "No such promise.")), "verification-truth", "submission.truth"));
    variants.push((waive("met-truth", &waiver(&basis, "truth/A", 1, "Already met; nothing to waive.")), "verification-truth", "submission.truth"));
    let mut stale = valid.clone();
    stale["basis"]["source"]["head"] = json!("0000000000000000000000000000000000000000");
    variants.push((waive("stale-source", &stale), "verification-basis", "basis.source"));
    let mut foreign = valid.clone();
    foreign["basis"]["map_digest"] = json!("stale-map");
    variants.push((waive("stale-map", &foreign), "verification-basis", "basis.map_digest"));
    let mut orphan = valid.clone();
    orphan["supersedes"] = json!("no-such-waiver");
    variants.push((waive("orphan-supersession", &orphan), "verification-waiver", "submission.supersedes"));
    let mut revoke_nothing = valid.clone();
    revoke_nothing["revoked"] = json!(true);
    variants.push((waive("revoke-nothing", &revoke_nothing), "verification-waiver", "submission.supersedes"));
    for (request, rule, slot) in variants {
        let response = apply(project, request.clone());
        assert_eq!(response["status"], "refused", "{request}\n{response}");
        assert_eq!(response["rule"], rule, "{response}");
        assert_eq!(response["slot"], slot, "{response}");
        assert_eq!(tree(project), before, "an invalid waiver changes nothing");
        assert_eq!(report(project)["truths"], json!([met_a, unmet_b]));
    }
    // A verifier cannot author a waiver from its patch arm, and an absent
    // approval is a transport shape refusal rather than a prepared payload.
    let mut prepared = waive("prepared", &valid);
    prepared.as_object_mut().unwrap().remove("approval");
    assert_eq!(apply(project, prepared)["rule"], "verification-shape");
    let (_, mut patch) = inspected_patch(project, "verifier-authored");
    patch["waivers"] = json!([valid]);
    assert_eq!(apply(project, json!({"operation":"verification-submit","patch":patch}))["rule"], "verification-shape");
    assert_eq!(reopened(project).snapshot.data["verification"].get("waivers"), None);
    // The exact owner waiver is effective and shown beside the met truth.
    let accepted = apply(project, waive("waive-b", &valid));
    assert_eq!(accepted["status"], "ok", "{accepted}");
    let record = accepted["receipt"]["record"].clone();
    assert_eq!(record["schema"], "verification-waiver-1");
    assert_eq!(record["kind"], "waive");
    assert_eq!(record["request_id"], "waive-b");
    assert_eq!(record["submission"], valid);
    assert_eq!(record["approval"]["owner"], "Fixture Owner");
    assert_eq!(record["reviewed"]["attempt"], reviewed["id"]);
    assert_eq!(record["reviewed"]["patch"], "reviewed-patch");
    assert_eq!(record["reviewed"]["status"], "unmet");
    let waived_b = {
        let mut row = unmet_b.clone();
        row["status"] = json!("waived");
        row["derived"] = json!("unmet");
        row["waiver"] = json!({"id":record["id"],"request_id":"waive-b","owner":"Fixture Owner",
            "at":"2026-09-11T15:00:00Z","reason":"The second parcel ships in phase 14."});
        row
    };
    let read = report(project);
    assert_eq!(read["truths"], json!([met_a, waived_b]));
    assert_eq!(read["counts"], json!({"met":1,"concerns":0,"unmet":0,"pending":0,"waived":1}));
    assert_eq!(read["waivers"].as_array().unwrap().len(), 1);
    assert_eq!(read["waivers"][0]["id"], record["id"]);
    assert_eq!(read["waivers"][0]["effective"], true);
    assert_eq!(read["waivers"][0]["truth"], json!({"id":"truth/B","version":1}));
    assert_eq!(read["advice"], Value::Null);
    assert_eq!(read["history"][0]["truths"], json!([met_a, unmet_b]), "the derived judgment is kept as derived");
    let text = read["report"].as_str().unwrap();
    assert!(text.contains("| truth/A | met | artifact/shared accepted; check/A accepted; link/parcel accepted |"), "{text}");
    assert!(text.contains("| truth/B | waived (derived unmet) | artifact/shared accepted; check/B rejected |"), "{text}");
    assert!(text.contains("Waived: truth/B by Fixture Owner at 2026-09-11T15:00:00Z - The second parcel ships in phase 14."), "{text}");
    assert!(text.contains("Counts: met 1, concerns 0, unmet 0, pending 0, waived 1"), "{text}");
    // Restart and replay: one immutable record, the same answer, no new bytes.
    let saved = reopened(project).snapshot;
    assert_eq!(saved.data["verification"]["waivers"], json!([record]));
    assert_eq!(saved.data["context"], context);
    assert_eq!(saved.data["verification"]["patches"], stored.data["verification"]["patches"]);
    assert_eq!(report(project), read);
    let after = tree(project);
    assert_eq!(apply(project, waive("waive-b", &valid)), accepted);
    assert_eq!(tree(project), after);
    let mut changed = valid.clone();
    changed["reason"] = json!("A different reason under the same request.");
    let reused = apply(project, waive("waive-b", &changed));
    assert_eq!(reused["rule"], "verification-waiver-reuse", "{reused}");
    let duplicate = apply(project, waive("waive-b-again", &valid));
    assert_eq!(duplicate["rule"], "verification-waiver", "{duplicate}");
    assert_eq!(duplicate["slot"], "submission.supersedes");
    assert_eq!(reopened(project).snapshot.data["verification"]["waivers"], json!([record]));
    assert_eq!(tree(project), after);
    // A later verifier patch neither erases the waiver nor is covered by it:
    // the new judgment is derived from its own verdicts and the retained
    // waiver needs explicit owner reaffirmation against the new evidence.
    let (again, _) = submitted(project, "again", &[("check/B", "rejected", rejected)]);
    let unmet_b_again = row(map, "again", "truth/B", B, "unmet", "rejected or not seen: check/B", &[
        ("artifact/shared", "artifact", "accepted", SEEN), ("check/B", "check", "rejected", rejected)]);
    let met_a_again = row(map, "again", "truth/A", A, "met", MET, &[
        ("artifact/shared", "artifact", "accepted", SEEN), ("check/A", "check", "accepted", SEEN), ("link/parcel", "link", "accepted", SEEN)]);
    let read = report(project);
    assert_eq!(read["current"]["attempt"], again["id"]);
    assert_eq!(read["truths"], json!([met_a_again, unmet_b_again]));
    assert_eq!(read["counts"]["waived"], 0);
    assert_eq!(read["waivers"][0]["id"], record["id"]);
    assert_eq!(read["waivers"][0]["effective"], false);
    assert_eq!(read["waivers"][0]["reason"], format!("reviewed attempt {} is not the current attempt {}", reviewed["id"].as_str().unwrap(), again["id"].as_str().unwrap()));
    assert_eq!(reopened(project).snapshot.data["verification"]["waivers"], json!([record]));
    // Reaffirmation is a separate owner event naming the retained waiver.
    let mut reaffirm = waiver(&again["inputs"]["basis"], "truth/B", 1, "Still shipping in phase 14.");
    reaffirm["supersedes"] = record["id"].clone();
    let reaffirmed = apply(project, waive("reaffirm-b", &reaffirm));
    assert_eq!(reaffirmed["status"], "ok", "{reaffirmed}");
    let second = reaffirmed["receipt"]["record"].clone();
    assert_eq!(second["kind"], "reaffirm");
    let read = report(project);
    assert_eq!(read["truths"][1]["status"], "waived");
    assert_eq!(read["truths"][1]["waiver"]["id"], second["id"]);
    assert_eq!(read["truths"][1]["waiver"]["reason"], "Still shipping in phase 14.");
    assert_eq!(read["counts"], json!({"met":1,"concerns":0,"unmet":0,"pending":0,"waived":1}));
    assert_eq!(read["waivers"][0]["effective"], false);
    assert_eq!(read["waivers"][0]["superseded_by"], second["id"]);
    assert_eq!(read["waivers"][1]["effective"], true);
    // Revocation is another owner event; the derived unmet judgment returns.
    let mut revoke = reaffirm.clone();
    revoke["supersedes"] = second["id"].clone();
    revoke["revoked"] = json!(true);
    revoke["reason"] = json!("Phase 14 will not take the second parcel after all.");
    let revoked = apply(project, waive("revoke-b", &revoke));
    assert_eq!(revoked["status"], "ok", "{revoked}");
    assert_eq!(revoked["receipt"]["record"]["kind"], "revoke");
    let read = report(project);
    assert_eq!(read["truths"], json!([met_a_again, unmet_b_again]));
    assert_eq!(read["counts"], json!({"met":1,"concerns":0,"unmet":1,"pending":0,"waived":0}));
    assert_eq!(read["waivers"][1]["effective"], false);
    assert_eq!(read["waivers"][1]["revoked_by"], revoked["receipt"]["record"]["id"]);
    assert_eq!(read["waivers"].as_array().unwrap().len(), 3);
    assert_eq!(reopened(project).snapshot.data["verification"]["waivers"].as_array().unwrap().len(), 3);
    // Several waivers cue "revisit the plan"; waived never counts as met.
    let (both, _) = submitted(project, "both", &[("check/A", "rejected", "tests/a.py asserts nothing."), ("check/B", "rejected", rejected)]);
    let read = report(project);
    assert_eq!(read["counts"], json!({"met":0,"concerns":0,"unmet":2,"pending":0,"waived":0}));
    for (id, truth) in [("waive-a-both", "truth/A"), ("waive-b-both", "truth/B")] {
        let answer = apply(project, waive(id, &waiver(&both["inputs"]["basis"], truth, 1, "Deferred to phase 14.")));
        assert_eq!(answer["status"], "ok", "{answer}");
    }
    let read = report(project);
    assert_eq!(read["counts"], json!({"met":0,"concerns":0,"unmet":0,"pending":0,"waived":2}));
    assert_eq!(read["truths"][0]["status"], "waived");
    assert_eq!(read["truths"][0]["derived"], "unmet");
    assert_eq!(read["truths"][1]["status"], "waived");
    assert_eq!(read["advice"], "revisit the plan: 2 truths are waived");
    assert!(read["report"].as_str().unwrap().contains("Revisit the plan: 2 truths are waived."));
    assert_eq!(reopened(project).snapshot.data["context"], context);
    let final_tree = tree(project);
    let final_snapshot = reopened(project).snapshot;
    assert_eq!(report(project), read);
    assert_eq!(tree(project), final_tree);
    assert_eq!(reopened(project).snapshot, final_snapshot);
    for name in ["findings.md", ".planning/findings.md", ".planning/phases/13/UAT.md"] {
        assert!(!project.join(name).exists());
    }
}

const HISTORICAL_UAT: &str = "---\nstatus: testing\nphase: 13\n---\n\n## Items\n\n### 1. Delivery\nexpected: the parcel arrives\nstatus: fail\nfirst_pass: fail\nreported: \"the parcel never came\"\n\n### 2. Receipt\nexpected: the recipient signs\nstatus: pass\n";
const REQUIREMENTS_T5: &str = "# Requirements\n\n## Active\n\n- **T1**: the first parcel is delivered\n- **T2**: the second parcel is delivered\n\n## Traceability\n\n| Requirement | Phase | Status |\n|-------------|-------|--------|\n| T2 | Phase 13 | Pending |\n";
const ROADMAP_OPEN: &str = "## Phases\n- [ ] **Phase 13: Plan publication**\n- [ ] **Phase 28: Next phase**\n";
const ROADMAP_DONE: &str = "## Phases\n- [x] **Phase 13: Plan publication**\n- [ ] **Phase 28: Next phase**\n";

fn completion(root: &std::path::Path, id: &str, attempt: &Value, basis: &Value) -> Value {
    let requirements = root.join("REQUIREMENTS.md");
    json!({"operation":"verification-complete","request_id":id,"attempt":attempt,"basis":basis,
        "projections":{"roadmap":digest_of(&root.join("ROADMAP.md")),
            "requirements":requirements.exists().then(|| digest_of(&requirements))}})
}

#[test]
fn phase13_incomplete_verification_cannot_complete_phase() {
    let mut fixture = Completed::published(false, |project| {
        std::fs::write(project.join(".planning/REQUIREMENTS.md"), REQUIREMENTS_T5).unwrap();
        std::fs::write(project.join(".planning/phases/13/UAT.md"), HISTORICAL_UAT).unwrap();
    });
    let project = fixture.project().to_path_buf();
    let project = project.as_path();
    let root = project.join(".planning");
    let (roadmap, requirements, uat) = (root.join("ROADMAP.md"), root.join("REQUIREMENTS.md"), root.join("phases/13/UAT.md"));
    // Publication seeded the one missing active row, Pending, after the
    // existing row; it raised nothing and touched no other byte.
    let seeded = format!("{REQUIREMENTS_T5}| T1 | Phase 13 | Pending |\n");
    assert_eq!(std::fs::read_to_string(&requirements).unwrap(), seeded);
    assert_eq!(std::fs::read_to_string(&roadmap).unwrap(), ROADMAP_OPEN);
    let context = reopened(project).snapshot.data["context"].clone();
    let placeholder = json!({"project":"","root_binding":"","phase":13,"occurrence":"","context_digest":"","truths":[],
        "publications":[],"map_digest":"","admission_digests":[],"execution_digest":"",
        "source":{"head":"","tree":"","index_digest":"","material_digest":""}});
    let projections_unchanged = |uat_expected: &str| {
        assert_eq!(std::fs::read_to_string(&roadmap).unwrap(), ROADMAP_OPEN);
        assert_eq!(std::fs::read_to_string(&requirements).unwrap(), seeded);
        assert_eq!(std::fs::read_to_string(&uat).unwrap(), uat_expected);
        let saved = reopened(project).snapshot;
        assert_eq!(saved.data["verification"].get("completions"), None, "no completion authority");
        assert_eq!(saved.data["context"], context, "approved context unchanged");
    };
    let refused = |request: Value, rule: &str, slot: &str, uat_expected: &str| -> Value {
        let answer = apply(project, request.clone());
        assert_eq!(answer["status"], "refused", "{request}\n{answer}");
        assert_eq!(answer["rule"], rule, "{answer}");
        assert_eq!(answer["slot"], slot, "{answer}");
        projections_unchanged(uat_expected);
        answer
    };
    // Publication alone: the located refusal names the unadmitted execution.
    let answer = refused(completion(&root, "after-publication", &json!(""), &placeholder), "admission-required", "admissions", HISTORICAL_UAT);
    assert_eq!(answer["phase"], 13);
    // Execution complete, SUMMARY present, no verdicts: still not acceptance.
    fixture.execute();
    let next = query(project, json!({"operation":"execute-next","phase":13}));
    assert_eq!((next["status"].as_str(), next["outcome"].as_str()), (Some("ok"), Some("complete")), "execution is complete: {next}");
    let read = report(project);
    assert_eq!(read["current"]["applicable"], false);
    assert_eq!(read["completion"], json!({"status":"incomplete","applicable":false,"reason":"no completion recorded","record":null}));
    let basis = read["current"]["observed"].clone();
    assert!(basis.is_object(), "{read}");
    let answer = refused(completion(&root, "after-execution", &json!(""), &basis), "verification-incomplete", "verification", HISTORICAL_UAT);
    assert!(answer["reason"].as_str().unwrap().contains("no complete verification"), "{answer}");
    // An open attempt with finished runs is not a verification either.
    let (open, _) = inspect(project, "open", &[]);
    refused(completion(&root, "open-attempt", &open["id"], &basis), "verification-incomplete", "verification", HISTORICAL_UAT);
    // One unmet truth: the refusal names it, its negative item and the
    // imported human failure that is also unfinished.
    let (partial, _) = verify(project, "partial", &[("check/B", "rejected", "tests/b.py proves nothing about the second parcel.")]);
    let answer = refused(completion(&root, "partial", &partial["id"], &basis), "verification-incomplete", "truths", HISTORICAL_UAT);
    assert_eq!(answer["id"], "truth/B");
    assert_eq!(answer["details"]["requested"]["unfinished"], json!([
        {"kind":"truth","id":"truth/B","version":1,"status":"unmet","reason":"rejected or not seen: check/B","items":[{"id":"check/B","verdict":"rejected"}]},
        {"kind":"human","id":"1","status":"fail","source":"imported","first_pass":"fail"}]));
    assert_eq!(answer["details"]["current"]["counts"], json!({"met":1,"concerns":0,"unmet":1,"pending":0,"waived":0}));
    // A real repair commit makes that verification historical.
    std::fs::write(project.join("src/b.py"), "def answer():\n    return 7 # repaired implementation\n").unwrap();
    git_value(project, &["add", "src/b.py"]);
    git_value(project, &["commit", "-m", "Fixture repair"]);
    let answer = refused(completion(&root, "stale", &partial["id"], &basis), "verification-basis", "basis.source", HISTORICAL_UAT);
    assert_eq!(answer["details"]["current"]["head"], git_value(project, &["rev-parse", "HEAD"]));
    let read = report(project);
    assert_eq!(read["current"]["applicable"], false);
    assert_eq!(read["history"][1]["applicability"], "historical");
    let basis = read["current"]["observed"].clone();
    refused(completion(&root, "stale-attempt", &partial["id"], &basis), "verification-incomplete", "verification", HISTORICAL_UAT);
    // Every item accepted on fresh independent runs; the human failure remains.
    let (accepted, _) = verify(project, "accepted", &[]);
    let read = report(project);
    assert_eq!(read["counts"], json!({"met":2,"concerns":0,"unmet":0,"pending":0,"waived":0}));
    let answer = refused(completion(&root, "human-conflict", &accepted["id"], &basis), "verification-incomplete", "humans", HISTORICAL_UAT);
    assert_eq!(answer["id"], "1");
    assert_eq!(answer["details"]["requested"]["unfinished"], json!([{"kind":"human","id":"1","status":"fail","source":"imported","first_pass":"fail"}]));
    let stored = reopened(project).snapshot;
    assert_eq!(apply(project, completion(&root, "human-conflict", &accepted["id"], &basis)), answer, "repeating asks nothing new");
    assert_eq!(reopened(project).snapshot, stored);
    // The verifier's patch arm cannot resolve human work, and a wrong attempt cannot either.
    let overwrite = json!({"request_id":"resolve-by-patch","attempt":accepted["id"],"basis":basis,"items":[],"humans":[{"id":"1","outcome":"passed"}]});
    assert_eq!(apply(project, json!({"operation":"verification-submit","patch":overwrite}))["rule"], "verification-shape");
    refused(completion(&root, "wrong-attempt", &partial["id"], &basis), "verification-attempt", "attempt", HISTORICAL_UAT);
    assert_eq!(reopened(project).snapshot.data["verification"].get("humans"), None);
    // Only the authorized human path resolves it; first pass stays fail.
    let occurrence = query(project, json!({"operation":"plan-read","phase_address":"13"}))["occurrence"].clone();
    let submission = json!({"phase":13,"occurrence":occurrence,"id":"1","reply":"The parcel arrived on the second attempt.",
        "outcome":"passed","owner":"Fixture Owner","at":"2026-09-11T17:00:00Z","supersedes":null});
    let resolved = apply(project, json!({"operation":"verification-human-result","request_id":"resolve-1","submission":submission,
        "approval":{"approved":true,"owner":"Fixture Owner","at":"2026-09-11T17:00:00Z","submission":submission}}));
    assert_eq!(resolved["status"], "ok", "{resolved}");
    assert_eq!(resolved["receipt"]["record"]["first_pass"], "fail");
    let rendered = std::fs::read_to_string(&uat).unwrap();
    assert!(rendered.starts_with(HISTORICAL_UAT), "{rendered}");
    assert!(rendered.contains("\n### 1. 1\nname: Delivery\nstatus: pass\nfirst_pass: fail\nreported: \"The parcel arrived on the second attempt.\"\n"), "{rendered}");
    let read = report(project);
    assert_eq!(read["humans"][0]["resolved"], true);
    assert_eq!(read["humans"][0]["first_pass"], "fail");
    assert_eq!(read["humans"][0]["history"][0]["reply"], "The parcel arrived on the second attempt.");
    // Interleaved reads change nothing; a stale caller preimage still refuses.
    assert_eq!(query(project, json!({"operation":"plan-read","phase_address":"13"}))["status"], "ok");
    assert_eq!(query(project, json!({"operation":"execute-next","phase":13}))["outcome"], "complete");
    let mut stale = completion(&root, "stale-preimage", &accepted["id"], &basis);
    stale["projections"]["requirements"] = json!(cadence::store::model::digest(REQUIREMENTS_T5.as_bytes()));
    refused(stale, "verification-projection", "projections.requirements", &rendered);
    // The fully applicable completion: authority and both projections, once.
    let request = completion(&root, "complete-13", &accepted["id"], &basis);
    let done = apply(project, request.clone());
    assert_eq!(done["status"], "ok", "{done}");
    let record = done["receipt"]["record"].clone();
    assert_eq!(record["label"], "complete");
    assert_eq!(record["attempt"], accepted["id"]);
    assert_eq!(record["basis"], basis);
    assert_eq!(record["truths"], json!([{"id":"truth/A","version":1,"status":"met","derived":"met","waiver":null},
        {"id":"truth/B","version":1,"status":"met","derived":"met","waiver":null}]));
    assert_eq!(record["humans"], json!([{"id":"1","status":"pass","first_pass":"fail","source":"native"},
        {"id":"2","status":"pass","first_pass":"pass","source":"imported"}]));
    assert_eq!(record["projections"]["requirements"]["rows"], json!(["T1"]));
    assert_eq!(std::fs::read_to_string(&roadmap).unwrap(), ROADMAP_DONE);
    assert_eq!(std::fs::read_to_string(&requirements).unwrap(), seeded.replace("| T1 | Phase 13 | Pending |", "| T1 | Phase 13 | Complete |"));
    assert_eq!(std::fs::read_to_string(&uat).unwrap(), rendered, "completion leaves UAT.md alone");
    let saved = reopened(project).snapshot;
    assert_eq!(saved.data["context"], context);
    assert_eq!(saved.data["verification"]["completions"], json!([record]));
    let read = report(project);
    assert_eq!(read["completion"]["status"], "complete");
    assert_eq!(read["completion"]["applicable"], true);
    assert_eq!(read["current"]["attempt"], accepted["id"], "untracked projections are not source");
    // Once only: exact replay answers the same, a second completion refuses,
    // and the lifecycle now agrees with the checked box.
    let after = tree(project);
    let replay = apply(project, request);
    assert_eq!(replay["receipt"]["record"], record);
    assert_eq!(replay["receipt"]["replayed"], true);
    assert_eq!(tree(project), after);
    let again = apply(project, completion(&root, "complete-13-again", &accepted["id"], &basis));
    assert_eq!(again["rule"], "verification-complete", "{again}");
    assert_eq!(tree(project), after);
    // The lifecycle derives phase 13 complete from the native completion, so
    // the next phase is current and no state conflict names the checked box.
    let next = query(project, json!({"operation":"execute-next","phase":13}));
    assert_eq!((next["status"].as_str(), next["code"].as_str()), (Some("refused"), Some("phase-not-current")), "native completion is the lifecycle authority: {next}");
    // A lifecycle query records its own refusal and memo; it repairs and
    // completes nothing: projections, human material and authority are as left.
    assert_eq!(std::fs::read_to_string(&roadmap).unwrap(), ROADMAP_DONE);
    assert_eq!(std::fs::read_to_string(&requirements).unwrap(), seeded.replace("| T1 | Phase 13 | Pending |", "| T1 | Phase 13 | Complete |"));
    assert_eq!(std::fs::read_to_string(&uat).unwrap(), rendered);
    let saved = reopened(project).snapshot;
    assert_eq!(saved.data["verification"]["completions"], json!([record]));
    assert_eq!(saved.data["context"], context);
    assert_eq!(report(project), read);
    assert_eq!(reopened(project).snapshot, saved);
    // A later publication changes the native inputs: the completion is no
    // longer applicable, the report says which input, and the lifecycle
    // names the exact disagreement with the checked box.
    let gap = proposal(project, "gap", &[(None, attached(vec![artifact("artifact/gap", &["truth/A"])]))]);
    publish(project, &gap);
    let read = report(project);
    assert_eq!(read["completion"]["status"], "incomplete");
    assert_eq!(read["completion"]["applicable"], false);
    assert_eq!(read["completion"]["reason"], "native inputs changed since completion: publications");
    assert_eq!(read["completion"]["record"], record, "history is preserved");
    assert_eq!(read["current"]["applicable"], false);
    let next = query(project, json!({"operation":"execute-next","phase":13}));
    assert_eq!(next["status"], "refused", "{next}");
    assert_eq!(next["code"], "state-conflict", "{next}");
    assert!(next["reason"].as_str().unwrap().contains("ROADMAP.md:2"), "{next}");
    assert_eq!(std::fs::read_to_string(&roadmap).unwrap(), ROADMAP_DONE, "a query repairs nothing");
    assert_eq!(reopened(project).snapshot.data["verification"]["completions"], json!([record]));
    assert_eq!(reopened(project).snapshot.data["context"], context);
    for name in ["findings.md", ".planning/findings.md"] {
        assert!(!project.join(name).exists());
    }
}

// The real decision document: D-1 continues onto a second line, D-2 is one
// line, and D-3 is declared twice so the selection is ambiguous.
const DECISIONS: &str = "# Fixture decisions\n\n## Decisions\n\n- D-1. Parcels ship by ground.\n  Ground shipping is cheaper for the fixture.\n- D-2. The recipient signs on delivery.\n- D-3. Insurance is optional.\n- D-3. Insurance is required.\n";
const D2: &str = "- D-2. The recipient signs on delivery.\n";
// Handwritten compiled intents. Both the local dispatch and the provider
// payload fragment must carry exactly these words for the selected kind.
const DECISION_INTENT: &str = "Refute the selected decision: argue against it from the retained decision text and its retained inline context, name the claim each objection rests on, and apply no amendment.";
const MINIMALISM_INTENT: &str = "Rank code that should not exist, as a deletion list ordered by severity: reinvented standard library or dependency, an abstraction with one implementation, unused flexibility and configuration nobody sets. Propose deletions; apply nothing.";
const PLAN_INTENT: &str = "Work backward from the phase goal and its locked decisions: for each task ask which truth it serves, whether the retained plan can deliver it as written, and whether any step contradicts a locked or durable decision. Return findings; edit nothing.";

fn select(project: &std::path::Path, command: &str, arguments: &[&str], key: &str) -> Value {
    query(project, json!({"operation":"review-select","command":command,"arguments":arguments,"replay_key":key}))
}

// Admit the selection exactly as returned, take the saved dispatch, and read
// every retained entry back through review-material: (admitted, next, entries).
fn deliver(project: &std::path::Path, admission: &Value) -> (Value, Value, Vec<(Value, Vec<u8>)>) {
    let mut client = Client::open(project);
    let admitted = client.call("cadence_apply", json!({"operation":"review-admit","request":admission}));
    assert_eq!(admitted["status"], "ok", "{admitted}");
    let next = client.call("cadence_query", json!({"operation":"review-next","fire":admitted["result"]["fire"]}));
    assert_eq!(next["status"], "ok", "{next}");
    assert_eq!(next["result"]["state"], "dispatch", "{next}");
    let attempt = next["result"]["attempt"].clone();
    // A range retains an absent side as an absent entry; only available
    // entries carry bytes, and those are the ones the reviewer is told to read.
    let inventory = client.call("cadence_query", json!({"operation":"review-inventory"}));
    let manifest = inventory["result"]["records"]["manifests"][next["result"]["admission"]["artifact"].as_str().unwrap()].clone();
    let mut entries = Vec::new();
    for entry in attempt["view"]["entries"].as_array().unwrap() {
        let saved = manifest["entries"].as_array().unwrap().iter().find(|e| e["entry"] == *entry).unwrap();
        if saved["availability"] != "available" { entries.push((saved.clone(), vec![])); continue; }
        let read = client.call("cadence_query", json!({"operation":"review-material","attempt":attempt["attempt"],"entry":entry}));
        assert_eq!(read["status"], "ok", "{read}");
        let bytes: Vec<u8> = serde_json::from_value(read["result"]["bytes"].clone()).unwrap();
        assert_eq!(read["result"]["entry"], *saved);
        entries.push((saved.clone(), bytes));
    }
    client.finish();
    (admitted, next, entries)
}

fn entry_bytes<'a>(entries: &'a [(Value, Vec<u8>)], path: &str) -> &'a [u8] {
    &entries.iter().find(|(entry, _)| entry["path"] == path).unwrap_or_else(|| panic!("retained entry {path}")).1
}

#[test]
fn phase13_review_surface_selects_target_and_intent() {
    let fixture = Completed::new();
    let project = fixture.project();
    let root = project.to_string_lossy().into_owned();
    std::fs::create_dir(project.join("docs")).unwrap();
    std::fs::write(project.join("docs/decisions.md"), DECISIONS).unwrap();
    git_value(project, &["add", "docs/decisions.md"]);
    git_value(project, &["commit", "-m", "Fixture decisions"]);
    let subject = std::fs::read(project.join("src/a.py")).unwrap();
    assert_eq!(subject, b"def answer():\n    return 7\n");
    let sha = |bytes: &[u8]| cadence::store::model::digest(bytes);
    let before = tree(project);
    let stored = reopened(project).snapshot;
    let inventory = || query(project, json!({"operation":"review-inventory"}));
    let admissions = |value: &Value| value["result"]["records"]["admissions"].as_object().map_or(0, |a| a.len());
    assert_eq!(admissions(&inventory()), 0);
    // Missing, ambiguous and unresolvable selections request a target and
    // stop: nothing is admitted and nothing widens to a parent or the tree.
    std::fs::write(project.join("13"), b"a file whose name is also a phase number\n").unwrap();
    for (command, arguments, code, request) in [
        ("cad-review", vec![], "review-kind-required", "decision, minimalism or plan"),
        ("cad-review", vec!["diff", "src/a.py"], "review-kind-unknown", "decision, minimalism or plan"),
        ("cad-unknown-review", vec!["src/a.py"], "review-command-unknown", "cad-review"),
        ("cad-review", vec!["decision"], "review-target-required", "<document> <decision-id>"),
        ("cad-review", vec!["decision", "docs/decisions.md"], "review-target-required", "<decision-id>"),
        ("cad-decision-review", vec![], "review-target-required", "<document> <decision-id>"),
        ("cad-review", vec!["decision", "docs/decisions.md", "D-2", "extra"], "review-target-ambiguous", "one document and one decision id"),
        ("cad-review", vec!["decision", "docs/decisions.md", "D-3"], "review-target-ambiguous", "lines 8 and 9"),
        ("cad-review", vec!["decision", "docs/decisions.md", "D-9"], "review-target-unresolvable", "D-9"),
        ("cad-review", vec!["decision", "docs/missing.md", "D-1"], "review-target-unresolvable", "docs/missing.md"),
        ("cad-review", vec!["minimalism"], "review-target-required", "<file|directory|phase>"),
        ("cad-minimalism-review", vec![], "review-target-required", "<file|directory|phase>"),
        ("cad-review", vec!["minimalism", "src/none.py"], "review-target-unresolvable", "src/none.py"),
        ("cad-review", vec!["minimalism", "13"], "review-target-ambiguous", "phase:13"),
        ("cad-review", vec!["minimalism", "phase:42"], "review-target-unresolvable", "phase 42"),
        ("cad-review", vec!["minimalism", "src", "tests"], "review-target-ambiguous", "one file, directory or phase"),
        ("cad-review", vec!["plan"], "review-target-required", "<phase|plan-path>"),
        ("cad-plan-review", vec![], "review-target-required", "<phase|plan-path>"),
        ("cad-review", vec!["plan", "42"], "review-target-unresolvable", "phase 42"),
        ("cad-review", vec!["plan", ".planning/phases/13/PLAN-9.md"], "review-target-unresolvable", "PLAN-9.md"),
    ] {
        let refused = select(project, command, &arguments, "refused");
        assert_eq!(refused["status"], "refused", "{command} {arguments:?}: {refused}");
        assert_eq!(refused["code"], code, "{command} {arguments:?}: {refused}");
        assert!(refused["reason"].as_str().unwrap().contains(request), "{command} {arguments:?}: {refused}");
    }
    assert_eq!(admissions(&inventory()), 0, "a refused selection admits nothing");
    assert_eq!(std::fs::read(project.join("docs/decisions.md")).unwrap(), DECISIONS.as_bytes());
    std::fs::remove_file(project.join("13")).unwrap();
    assert_eq!(tree(project), before, "selection is read-only");
    assert_eq!(reopened(project).snapshot, stored);
    // Decision: the exact decision line and the exact document bytes reach
    // the reviewer with the compiled refutation intent; the alias selects the
    // same canonical kind and target.
    let decision = select(project, "cad-review", &["decision", "docs/decisions.md", "D-2"], "decision-key");
    assert_eq!(decision["status"], "ok", "{decision}");
    let selected = &decision["result"];
    assert_eq!(selected["command"], "cad-review");
    assert_eq!(selected["canonical"], "cad-review");
    assert_eq!(selected["kind"], "decision");
    assert_eq!(selected["aliases"], json!(["cad-decision-review"]));
    assert_eq!(selected["target"], json!({"kind":"decision","selected":"D-2","context_entries":["docs/decisions.md"]}));
    assert_eq!(selected["material"], json!([
        {"label":"decision","path":"docs/decisions.md","lines":[7,7],"digest":sha(D2.as_bytes())},
        {"label":"context","path":"docs/decisions.md","lines":[1,9],"digest":sha(DECISIONS.as_bytes())}]));
    assert_eq!(selected["intent"], DECISION_INTENT);
    let discriminator = selected["discriminator"].as_str().unwrap();
    assert_eq!(discriminator.len(), 64);
    assert_eq!(selected["admission"], json!({"replay_key":"decision-key","caller":"cad-review","trigger":null,"specialist":"decision",
        "project":root,"cycle":"live","home":{"kind":"root-inline","id":format!("select-{}", &discriminator[..16])},
        "discriminator":discriminator,"phase":null,"plan":null,"anchor":null,"round":1,
        "target":selected["target"],"decision":{"decision":"D-2","text":D2,"context":DECISIONS},"risk_observation":null,
        "selection":{"kind":"decision","document":"docs/decisions.md","digest":sha(DECISIONS.as_bytes()),"lines":[7,7]}}));
    assert_eq!(select(project, "cad-review", &["decision", "docs/decisions.md", "D-2"], "decision-key"), decision, "selection replays identically");
    let alias = select(project, "cad-decision-review", &["docs/decisions.md", "D-2"], "decision-key");
    assert_eq!(alias["status"], "ok", "{alias}");
    assert_eq!(alias["result"]["command"], "cad-decision-review");
    let mut canonical = alias["result"].clone();
    canonical["command"] = json!("cad-review");
    assert_eq!(canonical, *selected, "the alias resolves the same canonical selection");
    let d1 = select(project, "cad-review", &["decision", "docs/decisions.md", "D-1"], "d1-key");
    assert_eq!(d1["result"]["admission"]["decision"]["text"], "- D-1. Parcels ship by ground.\n  Ground shipping is cheaper for the fixture.\n");
    assert_eq!(d1["result"]["material"][0]["lines"], json!([5,6]));
    // A caller cannot substitute its own paragraph for the resolved document.
    let mut tampered = selected["admission"].clone();
    tampered["decision"]["text"] = json!("- D-2. The recipient never signs.\n");
    let refused = apply(project, json!({"operation":"review-admit","request":tampered}));
    assert_eq!(refused["status"], "refused", "{refused}");
    assert!(refused["reason"].as_str().unwrap().contains("selected decision differs from the resolved document"), "{refused}");
    assert_eq!(admissions(&inventory()), 0);
    let (admitted, next, entries) = deliver(project, &selected["admission"]);
    assert_eq!(admitted["result"]["replayed"], false);
    let dispatch = &next["result"]["dispatch"];
    assert_eq!(dispatch["local"], true);
    assert_eq!(dispatch["agent"], "cad-reviewer");
    let prompt = dispatch["prompt"].as_str().unwrap();
    assert!(prompt.contains(DECISION_INTENT), "{prompt}");
    assert!(prompt.contains(&format!("Review retained target {}", admitted["result"]["fire"].as_str().unwrap().replace('f', "m"))), "{prompt}");
    assert_eq!(next["result"]["admission"]["specialist"], "decision");
    assert_eq!(next["result"]["admission"]["trigger"], Value::Null);
    assert_eq!(next["result"]["admission"]["gate"], Value::Null);
    assert_eq!(next["result"]["admission"]["discriminator"], discriminator);
    assert_eq!(entries.len(), 2);
    assert_eq!(entry_bytes(&entries, "decision"), D2.as_bytes());
    assert_eq!(entry_bytes(&entries, "context"), DECISIONS.as_bytes());
    let replayed = apply(project, json!({"operation":"review-admit","request":selected["admission"]}));
    assert_eq!(replayed["result"], json!({"fire":admitted["result"]["fire"],"attempt":admitted["result"]["attempt"],"replayed":true}));
    assert_eq!(admissions(&inventory()), 1);
    // Minimalism over a named file, a frozen directory and a native phase
    // range: the base reviewer, no provider, no gate, ranked deletion intent.
    let file = select(project, "cad-review", &["minimalism", "src/a.py"], "file-key");
    assert_eq!(file["status"], "ok", "{file}");
    assert_eq!(file["result"]["kind"], "minimalism");
    assert_eq!(file["result"]["aliases"], json!(["cad-minimalism-review"]));
    assert_eq!(file["result"]["target"], json!({"kind":"named-file","path":"src/a.py","head":null}));
    assert_eq!(file["result"]["material"], json!([{"label":"file","path":"src/a.py","lines":[1,2],"digest":sha(&subject)}]));
    assert_eq!(file["result"]["intent"], MINIMALISM_INTENT);
    let file_discriminator = file["result"]["discriminator"].as_str().unwrap();
    assert_eq!(file["result"]["admission"], json!({"replay_key":"file-key","caller":"cad-review","trigger":null,"specialist":"minimalism",
        "project":root,"cycle":"live","home":{"kind":"root-inline","id":format!("select-{}", &file_discriminator[..16])},
        "discriminator":file_discriminator,"phase":null,"plan":null,"anchor":null,"round":1,
        "target":file["result"]["target"],"decision":null,"risk_observation":null,"selection":null}));
    let mut alias = select(project, "cad-minimalism-review", &["src/a.py"], "file-key");
    assert_eq!(alias["result"]["command"], "cad-minimalism-review");
    alias["result"]["command"] = json!("cad-review");
    assert_eq!(alias, file);
    assert_eq!(select(project, "cad-review", &["minimalism", "file:src/a.py"], "file-key"), file);
    let (_, next, entries) = deliver(project, &file["result"]["admission"]);
    let prompt = next["result"]["dispatch"]["prompt"].as_str().unwrap();
    assert!(prompt.contains(MINIMALISM_INTENT), "{prompt}");
    assert!(!prompt.contains(DECISION_INTENT) && !prompt.contains(PLAN_INTENT));
    assert_eq!(next["result"]["admission"]["specialist"], "minimalism");
    assert_eq!(next["result"]["admission"]["gate"], Value::Null);
    assert_eq!(next["result"]["admission"]["trigger"], Value::Null);
    assert_eq!(next["result"]["admission"]["routing"], Value::Null);
    assert_eq!(next["result"]["admission"]["selection"], json!({"mode":"single","choices":["base"],"fallback":null}));
    assert_eq!(next["result"]["admission"]["roster"], json!({"required":["base"],"completion":"all-required-terminal"}));
    assert_eq!(next["result"]["attempt"]["requested"], json!({"agent":"cad-reviewer","model":null,"effort":null,"routing":null,
        "selection_evidence":format!("minimalism:{}", next["result"]["admission"]["artifact"].as_str().unwrap())}));
    assert_eq!(entries.len(), 1);
    assert_eq!(entry_bytes(&entries, "src/a.py"), subject.as_slice());
    let directory = select(project, "cad-review", &["minimalism", "src"], "dir-key");
    assert_eq!(directory["status"], "ok", "{directory}");
    assert_eq!(directory["result"]["target"], json!({"kind":"directory","path":"src","members":["a.py","b.py"]}));
    assert_eq!(directory["result"]["material"], json!([
        {"label":"member","path":"src/a.py","lines":[1,2],"digest":sha(&subject)},
        {"label":"member","path":"src/b.py","lines":[1,2],"digest":sha(&std::fs::read(project.join("src/b.py")).unwrap())}]));
    assert_eq!(select(project, "cad-review", &["minimalism", "dir:src"], "dir-key"), directory);
    let (_, next, entries) = deliver(project, &directory["result"]["admission"]);
    assert!(next["result"]["dispatch"]["prompt"].as_str().unwrap().contains(MINIMALISM_INTENT));
    assert_eq!(entries.len(), 2);
    assert_eq!(entry_bytes(&entries, "src/a.py"), subject.as_slice());
    assert_eq!(entry_bytes(&entries, "src/b.py"), std::fs::read(project.join("src/b.py")).unwrap().as_slice());
    let execution = history(project);
    let base = execution["events"].as_array().unwrap().iter()
        .find(|e| e["request"]["event"]["kind"] == "attempt").unwrap()["request"]["event"]["base_commit"].clone();
    let head = fixture.pairs[1]["green_commit"].clone();
    let phase = select(project, "cad-review", &["minimalism", "phase:13"], "phase-key");
    assert_eq!(phase["status"], "ok", "{phase}");
    assert_eq!(phase["result"]["target"], json!({"kind":"phase-range","phase":"13","base":base,"head":head}));
    assert_eq!(phase["result"]["admission"]["phase"], 13);
    assert_eq!(phase["result"]["admission"]["home"], json!({"kind":"phase","id":"13"}));
    assert_eq!(select(project, "cad-review", &["minimalism", "13"], "phase-key"), phase, "unambiguous once the file named 13 is gone");
    let (_, next, entries) = deliver(project, &phase["result"]["admission"]);
    assert!(next["result"]["dispatch"]["prompt"].as_str().unwrap().contains(MINIMALISM_INTENT));
    assert_eq!(next["result"]["admission"]["specialist"], "minimalism");
    assert_eq!(next["result"]["admission"]["gate"], Value::Null);
    let diff = String::from_utf8(entries.iter().find(|(e, _)| e["label"] == "diff").unwrap().1.clone()).unwrap();
    assert!(diff.contains("+++ b/src/a.py") && diff.contains("+    return 7"), "{diff}");
    let heads: Vec<_> = entries.iter().filter(|(e, _)| e["side"] == "head").map(|(e, _)| e["path"].as_str().unwrap()).collect();
    assert_eq!(heads, ["src/a.py", "src/b.py", "tests/a.py", "tests/b.py"]);
    assert_eq!(entries.iter().find(|(e, _)| e["side"] == "head" && e["path"] == "src/a.py").unwrap().1, subject);
    // Plan: the phase's native slices and locked context reach the reviewer
    // through the ordinary manual-plan trigger with its configured gate.
    let configured = apply(project, json!({"operation":"config-apply","layer":"repo","updates":[{"key":"review.triggers.plan.gate","value":"blocking"}]}));
    assert_eq!(configured["status"], "ok", "{configured}");
    let context = std::fs::read(project.join(".planning/phases/13/CONTEXT.md")).unwrap();
    let plan1 = std::fs::read(project.join(".planning/phases/13/PLAN-1.md")).unwrap();
    let plan2 = std::fs::read(project.join(".planning/phases/13/PLAN-2.md")).unwrap();
    let published = query(project, json!({"operation":"plan-read","phase_address":"13"}));
    assert_eq!(published["native"]["publications"]["1"]["revision"], sha(&plan1));
    let plan = select(project, "cad-review", &["plan", "13"], "plan-key");
    assert_eq!(plan["status"], "ok", "{plan}");
    assert_eq!(plan["result"]["kind"], "plan");
    assert_eq!(plan["result"]["aliases"], json!(["cad-plan-review"]));
    assert_eq!(plan["result"]["target"], json!({"kind":"inline-text","label":"plan:13"}));
    assert_eq!(plan["result"]["material"], json!([
        {"label":"locked-context","path":".planning/phases/13/CONTEXT.md","lines":[1,context.split(|b| *b == b'\n').count() - 1],"digest":sha(&context)},
        {"label":"plan","path":".planning/phases/13/PLAN-1.md","lines":[1,plan1.split(|b| *b == b'\n').count() - 1],"digest":sha(&plan1)},
        {"label":"plan","path":".planning/phases/13/PLAN-2.md","lines":[1,plan2.split(|b| *b == b'\n').count() - 1],"digest":sha(&plan2)}]));
    assert_eq!(plan["result"]["intent"], PLAN_INTENT);
    let plan_discriminator = plan["result"]["discriminator"].as_str().unwrap();
    assert_eq!(plan["result"]["admission"], json!({"replay_key":"plan-key","caller":"manual-plan","trigger":"plan","specialist":null,
        "project":root,"cycle":"live","home":{"kind":"phase","id":"13"},"discriminator":plan_discriminator,
        "phase":13,"plan":null,"anchor":null,"round":1,"target":plan["result"]["target"],"decision":null,"risk_observation":null,"selection":null}));
    let mut alias = select(project, "cad-plan-review", &["13"], "plan-key");
    assert_eq!(alias["result"]["command"], "cad-plan-review");
    alias["result"]["command"] = json!("cad-review");
    assert_eq!(alias, plan);
    let (_, next, entries) = deliver(project, &plan["result"]["admission"]);
    let prompt = next["result"]["dispatch"]["prompt"].as_str().unwrap();
    assert!(prompt.contains(PLAN_INTENT), "{prompt}");
    assert_eq!(next["result"]["admission"]["trigger"], "plan");
    assert_eq!(next["result"]["admission"]["gate"], "blocking", "the configured gate, not an invented one");
    assert_eq!(next["result"]["admission"]["caller"], "manual-plan");
    assert_eq!(next["result"]["admission"]["specialist"], Value::Null);
    assert_eq!(entries.len(), 3);
    assert_eq!(entry_bytes(&entries, ".planning/phases/13/CONTEXT.md"), context.as_slice());
    assert_eq!(entry_bytes(&entries, ".planning/phases/13/PLAN-1.md"), plan1.as_slice());
    assert_eq!(entry_bytes(&entries, ".planning/phases/13/PLAN-2.md"), plan2.as_slice());
    let slice = select(project, "cad-review", &["plan", ".planning/phases/13/PLAN-2.md"], "slice-key");
    assert_eq!(slice["status"], "ok", "{slice}");
    assert_eq!(slice["result"]["target"], json!({"kind":"named-file","path":".planning/phases/13/PLAN-2.md","head":null}));
    assert_eq!(slice["result"]["material"], json!([{"label":"plan","path":".planning/phases/13/PLAN-2.md","lines":[1,plan2.split(|b| *b == b'\n').count() - 1],"digest":sha(&plan2)}]));
    assert_eq!(slice["result"]["admission"]["phase"], 13);
    assert_eq!(slice["result"]["admission"]["trigger"], "plan");
    let (_, next, entries) = deliver(project, &slice["result"]["admission"]);
    assert!(next["result"]["dispatch"]["prompt"].as_str().unwrap().contains(PLAN_INTENT));
    assert_eq!(entries.len(), 1);
    assert_eq!(entry_bytes(&entries, ".planning/phases/13/PLAN-2.md"), plan2.as_slice());
    // Nothing was edited: every target file is byte-identical and the tree is clean.
    assert_eq!(std::fs::read(project.join("docs/decisions.md")).unwrap(), DECISIONS.as_bytes());
    assert_eq!(std::fs::read(project.join("src/a.py")).unwrap(), subject);
    assert_eq!(std::fs::read(project.join(".planning/phases/13/PLAN-1.md")).unwrap(), plan1);
    assert_eq!(std::fs::read(project.join(".planning/phases/13/PLAN-2.md")).unwrap(), plan2);
    assert_eq!(std::fs::read(project.join(".planning/phases/13/CONTEXT.md")).unwrap(), context);
    assert_eq!(git_value(project, &["status", "--porcelain"]), "");
    assert_eq!(admissions(&inventory()), 6);
    // The shared compiled fragment: the provider payload and the local
    // dispatch name the same instructions module, and the four generated
    // skills are the binary's own rendering of it.
    let repo = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let source = |path: &str| std::fs::read_to_string(repo.join(path)).unwrap();
    assert!(source("crates/cadence/src/review/provider/payload.rs").contains("instructions::intent("));
    assert!(source("crates/cadence/src/review/invoking.rs").contains("instructions::intent("));
    let instructions = source("crates/cadence/src/review/instructions.rs");
    for intent in [DECISION_INTENT, MINIMALISM_INTENT, PLAN_INTENT] {
        assert!(instructions.contains(intent), "compiled fragment carries the handwritten intent");
    }
    for (args, skill, hint) in [
        (vec!["review-instructions"], "skills/cad-review/SKILL.md", "decision <document> <decision-id> | minimalism <file|directory|phase> | plan <phase|plan-path>"),
        (vec!["review-instructions", "--alias", "cad-decision-review"], "skills/cad-decision-review/SKILL.md", "<document> <decision-id>"),
        (vec!["review-instructions", "--alias", "cad-minimalism-review"], "skills/cad-minimalism-review/SKILL.md", "<file|directory|phase>"),
        (vec!["review-instructions", "--alias", "cad-plan-review"], "skills/cad-plan-review/SKILL.md", "<phase|plan-path>"),
    ] {
        let rendered = std::process::Command::new(env!("CARGO_BIN_EXE_cadence")).args(&args)
            .current_dir(std::env::temp_dir()).stdin(std::process::Stdio::null()).output().unwrap();
        assert!(rendered.status.success(), "{}", String::from_utf8_lossy(&rendered.stderr));
        assert_eq!(std::fs::read(repo.join(skill)).unwrap(), rendered.stdout,
            "{skill} is binary-rendered implicit lease material and cannot drift from its renderer");
        let text = String::from_utf8(rendered.stdout).unwrap();
        assert!(text.contains(&format!("argument-hint: \"{hint}\"")), "{skill}");
        assert!(text.contains("review-select") && text.contains("review-admit") && text.contains("review-next"), "{skill}");
        for intent in [DECISION_INTENT, MINIMALISM_INTENT, PLAN_INTENT] { assert!(text.contains(intent), "{skill}"); }
        assert!(!text.contains("CLAUDE_PLUGIN_ROOT") && !text.contains("Write") && !text.contains("Edit"), "{skill} applies nothing");
    }
}

// Actual requirement inputs for the audit: T1 and T3 are assigned to phase 13,
// T5 to a phase the roadmap never declares, T6 to another declared phase; T2
// and T4 are active without a row (publication seeds T2 because plan 2 names
// it, T4 stays an orphan); T7 exists only in plan 2's requirements.
const REQUIREMENTS_T7: &str = "# Requirements\n\n## Active\n\n- **T1**: the first parcel is delivered\n- **T2**: the second parcel is delivered\n- **T3**: the recipient signs\n- **T4**: the sender is notified\n- **T5**: the parcel is insured\n- **T6**: the depot is staffed\n\n## Traceability\n\n| Requirement | Phase | Status |\n|-------------|-------|--------|\n| T1 | Phase 13 | Pending |\n| T3 | Phase 13 | Pending |\n| T5 | Phase 42 | Pending |\n| T6 | Phase 28 | Pending |\n";
const ASSOCIATION: &str = "a requirement assigned to phase 13 is joined to every current truth of phase 13 through the phase's typed map; no direct requirement-to-truth edge is authored or inferred";
const NO_VERDICT: &str = "no complete verification on the current basis";
const VERIFY_NEXT: &str = "run the verifier for phase 13 and submit one complete item patch";

fn edge(name: &str, state: &str, value: Value) -> Value {
    json!({"edge":name,"state":state,"value":value})
}

fn broken(edge: &str, reason: &str, next_action: &str) -> Value {
    json!({"edge":edge,"reason":reason,"next_action":next_action})
}

fn audit(project: &std::path::Path, command: Option<&str>) -> Value {
    let before = tree(project);
    let stored = reopened(project).snapshot;
    let mut request = json!({"operation":"verification-audit","phase":13});
    if let Some(command) = command { request["command"] = json!(command); }
    let answer = query(project, request);
    assert_eq!(tree(project), before, "the audit writes nothing");
    assert_eq!(reopened(project).snapshot, stored, "the audit changes no record");
    answer
}

// A truth row as the report derives it, with each item's map origins added.
fn audited(row: Value, origins: &[(&str, &[u64])]) -> Value {
    let mut row = row;
    for item in row["items"].as_array_mut().unwrap() {
        let plans = origins.iter().find(|(id, _)| item["id"] == *id).unwrap().1;
        item["origins"] = json!(plans.iter().map(|plan| json!({"plan":plan,"item_id":item["id"]})).collect::<Vec<_>>());
    }
    row
}

#[test]
fn phase13_audit_reports_broken_verification_traces() {
    let mut fixture = Completed::published_shaped(false, |project| {
        std::fs::write(project.join(".planning/REQUIREMENTS.md"), REQUIREMENTS_T7).unwrap();
    }, |index, entry| {
        entry["content"]["requirements"] = if index == 0 { json!(["T1"]) } else { json!(["T2", "T7"]) };
    });
    fixture.execute();
    let project = fixture.project();
    let root = project.join(".planning");
    let map = &fixture.map;
    let seeded = format!("{REQUIREMENTS_T7}| T2 | Phase 13 | Pending |\n");
    assert_eq!(std::fs::read_to_string(root.join("REQUIREMENTS.md")).unwrap(), seeded);
    let roadmap = std::fs::read_to_string(root.join("ROADMAP.md")).unwrap();
    let publications = query(project, json!({"operation":"plan-read","phase_address":"13"}))["native"]["publications"].clone();
    let publication = |plan: u64| json!({"plan":plan,"revision":publications[plan.to_string()]["revision"],
        "map_revision":publications[plan.to_string()]["map_revision"]});
    let origins = |plans: &[u64], row_line: u64, active_line: u64| json!({
        "active":{"path":"REQUIREMENTS.md","line":active_line},
        "row":{"path":"REQUIREMENTS.md","line":row_line,"phase":"Phase 13","status":"Pending"},
        "roadmap":{"path":"ROADMAP.md","line":2,"checked":false},
        "plans":plans.iter().map(|p| publication(*p)).collect::<Vec<_>>()});
    let structural = |plans: Vec<u64>| vec![
        edge("requirement->phase", "present", json!("Phase 13")),
        edge("phase->roadmap", "present", json!("ROADMAP.md:2")),
        edge("phase->plan", "present", json!(plans)),
        json!({"edge":"plan->truths","state":"present","scope":"phase-scoped","value":["truth/A","truth/B"]}),
        edge("truth->evidence", "present", json!(["artifact/shared","check/A","check/B","link/parcel"]))];
    let t3 = json!({"requirement":"T3","scope":"phase",
        "origins":{"active":{"path":"REQUIREMENTS.md","line":7},"row":{"path":"REQUIREMENTS.md","line":17,"phase":"Phase 13","status":"Pending"},
            "roadmap":{"path":"ROADMAP.md","line":2,"checked":false},"plans":[]},
        "edges":[edge("requirement->phase","present",json!("Phase 13")),edge("phase->roadmap","present",json!("ROADMAP.md:2")),edge("phase->plan","missing",Value::Null)],
        "truths":[],"breaks":[broken("phase->plan","no published plan of phase 13 names T3","publish a phase 13 plan naming T3, or reassign its trace row")],
        "outcome":"broken"});
    let t4 = json!({"requirement":"T4","scope":"global",
        "origins":{"active":{"path":"REQUIREMENTS.md","line":8},"row":null,"roadmap":null,"plans":[]},
        "edges":[edge("requirement->phase","missing",Value::Null)],
        "truths":[],"breaks":[broken("requirement->phase","T4 is active with no ## Traceability row","publish a plan naming T4 in its requirements so publication seeds its trace row, or add the row by hand")],
        "outcome":"broken"});
    let t5 = json!({"requirement":"T5","scope":"global",
        "origins":{"active":{"path":"REQUIREMENTS.md","line":9},"row":{"path":"REQUIREMENTS.md","line":18,"phase":"Phase 42","status":"Pending"},"roadmap":null,"plans":[]},
        "edges":[edge("requirement->phase","present",json!("Phase 42")),edge("phase->roadmap","missing",Value::Null)],
        "truths":[],"breaks":[broken("phase->roadmap","ROADMAP.md declares no phase 42","declare Phase 42 in ROADMAP.md, or reassign T5's trace row")],
        "outcome":"broken"});
    let t7 = json!({"requirement":"T7","scope":"phase",
        "origins":{"active":null,"row":null,"roadmap":{"path":"ROADMAP.md","line":2,"checked":false},"plans":[publication(2)]},
        "edges":[edge("plan->requirement","missing",json!([2]))],
        "truths":[],"breaks":[broken("plan->requirement","plan 2 names T7, which REQUIREMENTS.md does not declare under ## Active","declare T7 under ## Active in REQUIREMENTS.md, or remove it from plan 2")],
        "outcome":"broken"});
    let out_of_scope = json!([{"requirement":"T6","phase":"Phase 28","line":19,"reason":"assigned to another declared phase; audit that phase"}]);
    // Execution is complete and nothing is verified: the structural edges
    // hold and the verdict edge is missing; every break is visible.
    let read = audit(project, None);
    assert_eq!(read["status"], "ok", "{read}");
    assert_eq!(read["schema"], "verification-audit-1");
    assert_eq!(read["phase"], 13);
    assert_eq!(read["read_only"], true);
    assert_eq!(read["command"], json!({"requested":"verification-audit","canonical":"cad-audit","operation":"verification-audit","generate":null}));
    assert_eq!(read["association"], json!({"kind":"phase-scoped","note":ASSOCIATION}));
    assert_eq!(read["sources"]["requirements"]["path"], "REQUIREMENTS.md");
    assert_eq!(read["sources"]["requirements"]["available"], true);
    assert_eq!(read["sources"]["requirements"]["digest"], cadence::store::model::digest(seeded.as_bytes()));
    assert_eq!(read["sources"]["requirements"]["active"], json!(["T1","T2","T3","T4","T5","T6"]));
    assert_eq!(read["sources"]["requirements"]["rows"], json!([
        {"line":16,"id":"T1","phase":"Phase 13","status":"Pending"},{"line":17,"id":"T3","phase":"Phase 13","status":"Pending"},
        {"line":18,"id":"T5","phase":"Phase 42","status":"Pending"},{"line":19,"id":"T6","phase":"Phase 28","status":"Pending"},
        {"line":20,"id":"T2","phase":"Phase 13","status":"Pending"}]));
    assert_eq!(read["sources"]["roadmap"], json!({"path":"ROADMAP.md","available":true,"digest":cadence::store::model::digest(roadmap.as_bytes()),
        "phases":[{"phase":"13","line":2,"checked":false},{"phase":"28","line":3,"checked":false}]}));
    assert_eq!(read["sources"]["context"], json!({"available":true,"truths":[{"id":"truth/A","version":1},{"id":"truth/B","version":1}]}));
    assert_eq!(read["sources"]["publications"], json!([
        {"plan":1,"revision":publications["1"]["revision"],"map_revision":publications["1"]["map_revision"],"requirements":["T1"]},
        {"plan":2,"revision":publications["2"]["revision"],"map_revision":publications["2"]["map_revision"],"requirements":["T2","T7"]}]));
    assert_eq!(read["sources"]["map"], json!({"coherence":"consistent","input_digest":map["input_digest"],"superseded":[]}));
    assert_eq!(read["sources"]["verification"], json!({"applicable":false,"attempt":null,"patch":null,"reason":"no verification attempt","unavailable":null,"waivers":[],"history":[]}));
    let pending_a = pending("truth/A", A);
    let pending_b = pending("truth/B", B);
    let mut edges = structural(vec![1]);
    edges.push(edge("evidence->verdict", "missing", Value::Null));
    let t1 = json!({"requirement":"T1","scope":"phase","origins":origins(&[1], 16, 5),"edges":edges,
        "truths":[pending_a, pending_b],"breaks":[broken("evidence->verdict", NO_VERDICT, VERIFY_NEXT)],"outcome":"pending"});
    let mut t2 = t1.clone();
    t2["requirement"] = json!("T2");
    t2["origins"] = origins(&[2], 20, 6);
    t2["edges"][2]["value"] = json!([2]);
    assert_eq!(read["traces"], json!([t1, t2, t3, t4, t5, t7]));
    assert_eq!(read["out_of_scope"], out_of_scope);
    assert_eq!(read["counts"], json!({"met":0,"waived":0,"concerns":0,"unmet":0,"pending":2,"broken":4,"out_of_scope":1}));
    let limits = read["limits"].as_array().unwrap();
    assert!(limits.iter().any(|l| l == "phase-scoped: the requirement-to-truth association is the phase's whole truth set, never a semantic edge"), "{limits:?}");
    assert!(limits.iter().any(|l| l == "read-only: no status, map, UAT or store record is written or repaired"), "{limits:?}");
    let text = read["report"].as_str().unwrap();
    assert!(text.contains("# Verification audit: phase 13"), "{text}");
    assert!(text.contains("| T3 | broken | phase->plan | no published plan of phase 13 names T3 |"), "{text}");
    assert!(text.contains("| T4 | broken | requirement->phase | T4 is active with no ## Traceability row |"), "{text}");
    assert!(text.contains("| T1 | pending | evidence->verdict | no complete verification on the current basis |"), "{text}");
    assert!(text.contains("Association: phase-scoped"), "{text}");
    // cad-audit and the retained cad-coverage alias select the same view: the
    // same traces, with the generation arm gone.
    let named = audit(project, Some("cad-audit"));
    assert_eq!(named["command"], json!({"requested":"cad-audit","canonical":"cad-audit","operation":"verification-audit","generate":null}));
    assert_eq!(named["traces"], read["traces"]);
    let coverage = audit(project, Some("cad-coverage"));
    assert_eq!(coverage["command"], json!({"requested":"cad-coverage","canonical":"cad-audit","operation":"verification-audit","generate":null}));
    assert_eq!(coverage["traces"], read["traces"]);
    assert_eq!(coverage["report"], read["report"]);
    let unknown = query(project, json!({"operation":"verification-audit","phase":13,"command":"cad-generate"}));
    assert_eq!(unknown["status"], "refused", "{unknown}");
    assert_eq!(unknown["rule"], "verification-audit");
    assert_eq!(unknown["slot"], "command");
    // A rejected check reaches every requirement of the phase: structural
    // coverage is complete and the outcome is still unmet.
    let rejected = "tests/a.py asserts nothing about the parcel.";
    let (judged, _) = submitted(project, "audit-rejected", &[("check/A", "rejected", rejected)]);
    let read = audit(project, None);
    assert_eq!(read["sources"]["verification"]["applicable"], true);
    assert_eq!(read["sources"]["verification"]["attempt"], judged["id"]);
    assert_eq!(read["sources"]["verification"]["patch"], "audit-rejected-patch");
    let shared: &[(&str, &[u64])] = &[("artifact/shared", &[1, 2]), ("check/A", &[1]), ("check/B", &[2]), ("link/parcel", &[1])];
    let unmet_a = audited(row(map, "audit-rejected", "truth/A", A, "unmet", "rejected or not seen: check/A", &[
        ("artifact/shared", "artifact", "accepted", SEEN), ("check/A", "check", "rejected", rejected), ("link/parcel", "link", "accepted", SEEN)]), shared);
    let met_b = audited(row(map, "audit-rejected", "truth/B", B, "met", MET, &[
        ("artifact/shared", "artifact", "accepted", SEEN), ("check/B", "check", "accepted", SEEN)]), shared);
    let mut edges = structural(vec![1]);
    edges.push(edge("evidence->verdict", "present", judged["id"].clone()));
    let t1 = json!({"requirement":"T1","scope":"phase","origins":origins(&[1], 16, 5),"edges":edges,
        "truths":[unmet_a, met_b],"breaks":[],"outcome":"unmet"});
    let mut t2 = t1.clone();
    t2["requirement"] = json!("T2");
    t2["origins"] = origins(&[2], 20, 6);
    t2["edges"][2]["value"] = json!([2]);
    assert_eq!(read["traces"], json!([t1, t2, t3, t4, t5, t7]));
    assert_eq!(read["counts"], json!({"met":0,"waived":0,"concerns":0,"unmet":2,"pending":0,"broken":4,"out_of_scope":1}));
    assert!(read["report"].as_str().unwrap().contains("| T1 | unmet | - | truth/A unmet (check/A rejected); truth/B met |"), "{}", read["report"]);
    // An owner waiver shows beside the derived unmet judgment, never as met.
    let waiver_a = waiver(&judged["inputs"]["basis"], "truth/A", 1, "The first parcel ships in phase 14.");
    let waived = apply(project, waive("audit-waive", &waiver_a));
    assert_eq!(waived["status"], "ok", "{waived}");
    let record = waived["receipt"]["record"].clone();
    let read = audit(project, None);
    assert_eq!(read["sources"]["verification"]["waivers"], json!([{"id":record["id"],"truth":{"id":"truth/A","version":1},"effective":true,"reason":"effective against the current judgment"}]));
    let waived_a = {
        let mut row = read["traces"][0]["truths"][0].clone();
        assert_eq!(row["status"], "waived");
        assert_eq!(row["derived"], "unmet");
        assert_eq!(row["waiver"]["id"], record["id"]);
        assert_eq!(row["items"], t1["truths"][0]["items"], "the rejected evidence stays visible");
        row.as_object_mut().unwrap().remove("waiver");
        row
    };
    assert_eq!(read["traces"][0]["outcome"], "waived");
    assert_eq!(read["traces"][1]["outcome"], "waived");
    assert_eq!(read["counts"], json!({"met":0,"waived":2,"concerns":0,"unmet":0,"pending":0,"broken":4,"out_of_scope":1}));
    assert_eq!(waived_a["status"], "waived");
    assert!(read["report"].as_str().unwrap().contains("| T1 | waived | - | truth/A waived (derived unmet: check/A rejected); truth/B met |"), "{}", read["report"]);
    // The met control: a fresh complete verification on independent runs.
    let (accepted, _) = submitted(project, "audit-met", &[]);
    let read = audit(project, None);
    assert_eq!(read["sources"]["verification"]["attempt"], accepted["id"]);
    assert_eq!(read["sources"]["verification"]["waivers"][0]["effective"], false);
    let met_a = audited(row(map, "audit-met", "truth/A", A, "met", MET, &[
        ("artifact/shared", "artifact", "accepted", SEEN), ("check/A", "check", "accepted", SEEN), ("link/parcel", "link", "accepted", SEEN)]), shared);
    let met_b = audited(row(map, "audit-met", "truth/B", B, "met", MET, &[
        ("artifact/shared", "artifact", "accepted", SEEN), ("check/B", "check", "accepted", SEEN)]), shared);
    assert_eq!(read["traces"][0]["truths"], json!([met_a, met_b]));
    assert_eq!(read["traces"][0]["outcome"], "met");
    assert_eq!(read["traces"][1]["outcome"], "met");
    assert_eq!(read["traces"][0]["edges"][5], edge("evidence->verdict", "present", accepted["id"].clone()));
    assert_eq!(read["counts"], json!({"met":2,"waived":0,"concerns":0,"unmet":0,"pending":0,"broken":4,"out_of_scope":1}));
    assert_eq!(&read["traces"].as_array().unwrap()[2..], &[t3.clone(), t4.clone(), t5.clone(), t7.clone()], "breaks never disappear behind a met phase");
    assert_eq!(read["sources"]["verification"]["history"], json!([
        {"attempt":judged["id"],"applicability":"historical","reason":format!("superseded by attempt {}", accepted["id"].as_str().unwrap())},
        {"attempt":accepted["id"],"applicability":"current","reason":"complete patch on the current basis"}]));
    // A superseded map: plan 3 is published with one map and replaced with
    // another. The old revision is visible as superseded, the met judgment is
    // historical against the changed inputs, and nothing counts as current met.
    let gap = proposal(project, "gap-old", &[(None, attached(vec![artifact("artifact/gap-old", &["truth/A"])]))]);
    publish(project, &gap);
    let replaced = proposal(project, "gap-new", &[(Some(3), attached(vec![artifact("artifact/gap-new", &["truth/A"])]))]);
    publish(project, &replaced);
    let current = query(project, json!({"operation":"evidence-read","phase":13}));
    let superseded = current["history"].as_array().unwrap().iter().find(|h| h["status"] == "superseded").unwrap();
    assert_eq!(superseded["publication"]["identity"]["plan"], 3);
    let read = audit(project, None);
    assert_eq!(read["sources"]["map"]["superseded"], json!([{"plan":3,"revision":superseded["publication"]["revision"],"superseded_by":superseded["superseded_by"]}]));
    assert_eq!(read["sources"]["map"]["input_digest"], current["input_digest"]);
    assert_eq!(read["sources"]["verification"]["applicable"], false);
    assert_eq!(read["sources"]["verification"]["attempt"], Value::Null);
    assert_eq!(read["sources"]["verification"]["reason"], "current verification inputs unavailable");
    assert_eq!(read["sources"]["verification"]["unavailable"]["rule"], "admission-plan-set");
    assert_eq!(read["sources"]["verification"]["history"][1]["applicability"], "historical");
    assert_eq!(read["sources"]["verification"]["history"][1]["reason"], "current verification inputs unavailable");
    let t1 = &read["traces"][0];
    assert_eq!(t1["requirement"], "T1");
    assert_eq!(t1["origins"]["plans"], json!([publication(1), {"plan":3,"revision":current["contributions"][2]["content_revision"],"map_revision":current["contributions"][2]["map_revision"]}]));
    assert_eq!(t1["edges"][2], edge("phase->plan", "present", json!([1, 3])));
    assert_eq!(t1["edges"][4], edge("truth->evidence", "present", json!(["artifact/gap-new","artifact/shared","check/A","check/B","link/parcel"])));
    assert_eq!(t1["edges"][5], edge("evidence->verdict", "missing", Value::Null));
    assert_eq!(t1["truths"], json!([pending("truth/A", A), pending("truth/B", B)]));
    assert_eq!(t1["breaks"], json!([broken("evidence->verdict", "current verification inputs unavailable: admission-plan-set", "admit the current plan set (execution-extend) and verify phase 13 again")]));
    assert_eq!(t1["outcome"], "pending");
    assert_eq!(read["counts"], json!({"met":0,"waived":0,"concerns":0,"unmet":0,"pending":2,"broken":4,"out_of_scope":1}));
    assert!(!serde_json::to_string(&read["traces"]).unwrap().contains("gap-old"), "a superseded item is not current evidence");
    // Nothing was written by any audit: the documents the owner authored are
    // byte-identical, no UAT.md appeared, and the store holds only what the
    // public verification, waiver and publication operations recorded.
    assert_eq!(std::fs::read_to_string(root.join("REQUIREMENTS.md")).unwrap(), seeded);
    assert_eq!(std::fs::read_to_string(root.join("ROADMAP.md")).unwrap(), roadmap);
    assert!(!root.join("phases/13/UAT.md").exists());
    let saved = reopened(project).snapshot;
    assert_eq!(saved.data["verification"]["patches"].as_array().unwrap().len(), 2);
    assert_eq!(saved.data["verification"]["waivers"], json!([record]));
    assert_eq!(saved.data["verification"].get("completions"), None);
    assert_eq!(saved.data["context"]["phases"]["13"]["truths"][0]["status"], "pending", "no status is written into the approved context");
    // The two thin skills are the binary's rendering of the compiled audit
    // instructions: one read-only operation, no generation arm.
    let repo = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    for (args, skill, name) in [
        (vec!["audit-instructions"], "skills/cad-audit/SKILL.md", "cad-audit"),
        (vec!["audit-instructions", "--coverage"], "skills/cad-coverage/SKILL.md", "cad-coverage"),
    ] {
        let rendered = std::process::Command::new(env!("CARGO_BIN_EXE_cadence")).args(&args)
            .current_dir(std::env::temp_dir()).stdin(std::process::Stdio::null()).output().unwrap();
        assert!(rendered.status.success(), "{}", String::from_utf8_lossy(&rendered.stderr));
        assert_eq!(std::fs::read(repo.join(skill)).unwrap(), rendered.stdout, "{skill} is rendered by the binary");
        let text = String::from_utf8(rendered.stdout).unwrap();
        assert!(text.contains(&format!("name: {name}\n")), "{skill}");
        assert!(text.contains(&format!("\"operation\":\"verification-audit\",\"phase\":13,\"command\":\"{name}\"")), "{skill}");
        assert!(text.contains("allowed-tools:\n  - mcp__cadence__cadence_query\n---"), "{skill} is read-only");
        assert!(text.contains(ASSOCIATION), "{skill}");
        for forbidden in ["Write", "Edit", "generate tests", "coverage.md", "audit.md", "CLAUDE_PLUGIN_ROOT", "PASS/FAIL"] {
            assert!(!text.contains(forbidden), "{skill} must not carry {forbidden}");
        }
    }
}
