#[allow(dead_code)]
#[path = "support/phase13.rs"]
mod phase13;
#[path = "support/phase14.rs"]
mod phase14;

use cadence::store::model;
use phase13::{Client, Completed, apply, digest_of, git_value, reopened};
use phase14::{LEGACY_TICKED, TICKED, dispatched_plan, documents, legacy_fixture, natively_completed, progress_fixture, why_fixture};
use serde_json::{Value, json};
use std::{fs, path::Path, process::{Command, Stdio}, time::{SystemTime, UNIX_EPOCH}};

fn progress(client: &mut Client) -> Value {
    let answer = client.call("cadence_query", json!({"operation":"progress"}));
    assert_eq!(answer["status"], "ok", "{answer}");
    assert!(answer.get("body").is_none());
    assert!(answer.as_object().unwrap().keys().all(|key| !key.contains("document")));
    assert_eq!(answer["text"].as_str().unwrap().lines().filter(|line| line.starts_with("Next:")).count(), 1);
    assert!(answer["text"].as_str().unwrap().len() <= 24_576);
    answer
}

fn seconds() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs()
}

/// Every decision the reopened store holds, as the JSON its journal line carries.
fn journal(project: &Path) -> Vec<Value> {
    reopened(project).decisions.iter().map(|record| serde_json::to_value(record).unwrap()).collect()
}

#[test]
fn phase14_suggest_prices_from_routing_decisions_and_writes_nothing() {
    let fixture = phase14::suggest_fixture();
    let project = fixture.project();
    let imported: std::collections::BTreeSet<_> = reopened(project).decisions.iter()
        .filter(|r| r.origin.source == "trace.jsonl")
        .map(|r| r.id.clone()).collect();
    assert_eq!(imported.len(), 3);
    let native: std::collections::BTreeSet<_> = fixture.dispatches.iter()
        .map(|d| format!("routing:{}", d["dispatch_id"].as_str().unwrap())).collect();
    assert_eq!(native.len(), 2);
    let decisions: Vec<_> = imported.union(&native).cloned().collect();
    let config_before = fs::read(project.join(".planning/config.v4.json")).unwrap();
    let mut client = Client::open(project);
    let facts_before = client.call("cadence_query", json!({"operation":"config-facts"}));
    assert_eq!(facts_before["status"], "ok", "{facts_before}");
    let before = phase13::tree(project);
    let retained = reopened(project);
    let first = client.call("cadence_query", json!({"operation":"suggest"}));
    assert_eq!(first, json!({"status":"ok","suggestions":[
        {"key":"roles.cad-executor.effort","layer":"repo","current":"high","proposed":"xhigh",
         "evidence":{"counted":5,"escalated":2,"decisions":decisions},
         "apply":{"operation":"config-apply","layer":"repo","updates":[{"key":"roles.cad-executor.effort","value":"xhigh"}]}},
        {"key":"review.triggers.diff.gate","priced":false,"counted":1}
    ]}));
    let phase13 = client.call("cadence_query", json!({"operation":"suggest","phase":13}));
    assert_eq!(phase13, json!({"status":"ok","suggestions":[
        {"key":"roles.cad-executor.effort","priced":false,"counted":2},
        {"key":"review.triggers.diff.gate","priced":false,"counted":1}
    ]}));
    let phase12 = client.call("cadence_query", json!({"operation":"suggest","phase":12}));
    assert_eq!(phase12, json!({"status":"ok","suggestions":[
        {"key":"roles.cad-executor.effort","layer":"repo","current":"high","proposed":"xhigh",
         "evidence":{"counted":3,"escalated":2,"decisions":imported},
         "apply":{"operation":"config-apply","layer":"repo","updates":[{"key":"roles.cad-executor.effort","value":"xhigh"}]}}
    ]}));
    assert_eq!(client.call("cadence_query", json!({"operation":"config-facts"})), facts_before);
    client.finish();
    let mut client = Client::open(project);
    assert_eq!(client.call("cadence_query", json!({"operation":"suggest"})), first);
    client.finish();
    assert_eq!(fs::read(project.join(".planning/config.v4.json")).unwrap(), config_before);
    assert_eq!(phase13::tree(project), before, "suggest retains no new receipt or other write");
    let after = reopened(project);
    assert_eq!(after.snapshot, retained.snapshot);
    assert_eq!(after.decisions, retained.decisions);
    let rendered = Command::new(env!("CARGO_BIN_EXE_cadence"))
        .arg("suggest-instructions").current_dir(project).stdin(Stdio::null()).output().unwrap();
    assert!(rendered.status.success(), "{}", String::from_utf8_lossy(&rendered.stderr));
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    assert_eq!(rendered.stdout, fs::read(root.join("skills/cad-suggest/SKILL.md")).unwrap());
}

fn why(client: &mut Client, request: Value) -> Value {
    let answer = client.call("cadence_query", request);
    assert_eq!(answer["status"], "ok", "{answer}");
    answer
}

fn shas(answer: &Value) -> Vec<&str> {
    answer["entries"].as_array().unwrap().iter().map(|entry| entry["sha"].as_str().unwrap()).collect()
}

#[test]
fn phase14_why_text_is_byte_exact_including_pruned_phase() {
    let fixture = why_fixture();
    let project = fixture.project();
    let [one, two, three, four] = &fixture.thing;
    let status = ["-c", "core.excludesFile=/dev/null", "status", "--porcelain", "--untracked-files=all"];
    assert_eq!(git_value(project, &status), "");
    let mut client = Client::open(project);
    let first = why(&mut client, json!({"operation":"why","path":"src/thing.py"}));
    assert_eq!(first["result"], "chain", "{first}");
    assert_eq!(first["path"], "src/thing.py");
    assert_eq!(first["line"], Value::Null);
    assert_eq!(shas(&first), [four, three, two, one]);
    assert_eq!(first["shown"], 4);
    assert_eq!(first["total"], 4);
    assert_eq!(first["excluded"], json!([]));
    assert_eq!(first["warnings"], json!([]));
    // The fixed expected text, taken once from the frozen 3.x seam over this
    // same repository; the recovered phase is spelled with the fixture's shas.
    let fixtures = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/phase14");
    let expected = fs::read(fixtures.join("why-expected.txt")).unwrap();
    let text = first["text"].as_str().unwrap();
    assert!(text.contains(&format!("\nphase: an unlabelled close ({}) phase 2 (recovered from {}:.planning/phases/2)\n",
        &fixture.prune[..8], &fixture.parent[..8])), "{text}");
    assert!(text.contains("\nphase: NOT RESOLVED - "), "{text}");
    assert_eq!(text.as_bytes(), expected.as_slice(), "text:\n{text}");

    let top = why(&mut client, json!({"operation":"why","path":"src/thing.py","top":1}));
    assert_eq!(top["text"].as_str().unwrap().as_bytes(), fs::read(fixtures.join("why-top-expected.txt")).unwrap().as_slice(), "{top}");
    assert_eq!(top["shown"], 1);
    assert_eq!(top["total"], 4);
    assert_eq!(shas(&top), [four]);
    assert!(top["text"].as_str().unwrap().ends_with("\n\nShowing 1 of 4 commit(s). Pass --top 4 to see the rest."));

    // Line 1 was written by the first commit and doubled by the third; the
    // other two touched other lines. Each block is the bare chain's block.
    let blocks = text.split("\n\n").collect::<Vec<_>>();
    assert_eq!(blocks.len(), 4, "{text}");
    let line = why(&mut client, json!({"operation":"why","path":"src/thing.py","line":1}));
    assert_eq!(line["result"], "chain", "{line}");
    assert_eq!(line["line"], 1);
    assert_eq!(shas(&line), [three, one]);
    assert_eq!(line["shown"], 2);
    assert_eq!(line["total"], 2);
    assert_eq!(line["excluded"], Value::Null);
    assert_eq!(line["text"], format!("{}\n\n{}", blocks[1], blocks[3]));

    let never = why(&mut client, json!({"operation":"why","path":"never/here.py"}));
    assert_eq!(never, json!({"status":"ok","path":"never/here.py","line":null,"result":"not-in-history",
        "text":"No commits: git has never seen \"never/here.py\" in this repository's history."}));
    client.finish();

    let mut client = Client::open(project);
    let again = why(&mut client, json!({"operation":"why","path":"src/thing.py"}));
    assert_eq!(serde_json::to_vec(&again).unwrap(), serde_json::to_vec(&first).unwrap());
    client.finish();
    assert_eq!(git_value(project, &status), "", "why reads the repository and writes nothing");

    let rendered = Command::new(env!("CARGO_BIN_EXE_cadence"))
        .arg("why-instructions").current_dir(project).stdin(Stdio::null()).output().unwrap();
    assert!(rendered.status.success(), "{}", String::from_utf8_lossy(&rendered.stderr));
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    assert_eq!(rendered.stdout, fs::read(root.join("skills/cad-why/SKILL.md")).unwrap());
    let skill = String::from_utf8(rendered.stdout).unwrap();
    assert!(skill.contains("Print the returned `text` verbatim and nothing else"), "{skill}");
}

fn refused(records: &[Value]) -> Vec<&Value> {
    records.iter().filter(|record| record["decision"]["boundary"]["outcome"].as_str()
        .is_some_and(|outcome| outcome.starts_with("refused:"))).collect()
}

/// The integer seconds a record was written, which the progress line repeats.
fn at(record: &Value, window: (u64, u64)) -> u64 {
    let at = record.get("at").and_then(Value::as_u64)
        .unwrap_or_else(|| panic!("record carries no time: {record}"));
    assert!((window.0..=window.1).contains(&at), "{at} outside {window:?}: {record}");
    at
}

#[test]
fn phase14_refusal_records_carry_code_detail_and_time() {
    let before = seconds();

    // (a) A legacy tree the owner ticks after the first touch: the declaration
    // and the derivation disagree, and execution refuses on the disagreement.
    let legacy = legacy_fixture();
    let a = legacy.path().to_owned();
    fs::write(a.join(".planning/trace.jsonl"),
        "{\"family\":\"outcome\",\"event\":\"legacy_check\",\"phase\":1,\"verdict\":\"opaque legacy pass\"}\n").unwrap();
    let mut client = Client::open(&a);
    progress(&mut client);
    fs::write(a.join(".planning/ROADMAP.md"), LEGACY_TICKED).unwrap();
    let conflict = client.call("cadence_query", json!({"operation":"execute-next","phase":4}));
    assert_eq!((conflict["status"].as_str(), conflict["code"].as_str()),
        (Some("refused"), Some("state-conflict")), "{conflict}");
    let text_a = progress(&mut client)["text"].as_str().unwrap().to_owned();
    client.finish();
    // The same refusal after a restart answers the same and records nothing new.
    let mut client = Client::open(&a);
    assert_eq!(client.call("cadence_query", json!({"operation":"execute-next","phase":4})), conflict);
    client.finish();

    // (b) A dispatched plan whose close observes a staged path outside its lease.
    let (fixture, close) = dispatched_plan();
    let b = fixture.project().to_owned();
    fs::create_dir_all(b.join("docs")).unwrap();
    fs::write(b.join("docs/outside.md"), "outside the plan's lease\n").unwrap();
    git_value(&b, &["add", "docs/outside.md"]);
    let mut client = Client::open(&b);
    let lease = client.call("cadence_apply", close);
    assert_eq!((lease["status"].as_str(), lease["rule"].as_str(), lease["slot"].as_str(), lease["id"].as_str()),
        (Some("refused"), Some("lease"), Some("staged"), Some("docs/outside.md")), "{lease}");
    let text_b = progress(&mut client)["text"].as_str().unwrap().to_owned();
    client.finish();

    // (c) A project with a planning root and no roadmap to derive from.
    let empty = tempfile::tempdir().unwrap();
    let c = empty.path().to_owned();
    fs::create_dir_all(c.join(".planning")).unwrap();
    fs::write(c.join(".planning/config.json"), "{}\n").unwrap();
    let mut client = Client::open(&c);
    let missing = client.call("cadence_query", json!({"operation":"execute-next","phase":1}));
    assert_eq!((missing["status"].as_str(), missing["code"].as_str()),
        (Some("refused"), Some("missing-roadmap")), "{missing}");
    let reason = missing["reason"].as_str().unwrap();
    assert!(reason.contains("ROADMAP.md") && !reason.contains("execution validation failed"), "{missing}");
    client.finish();

    let window = (before, seconds());

    // (a) One record, located on the roadmap line that disagreed.
    let records = journal(&a);
    let refusals = refused(&records);
    assert_eq!(refusals.len(), 1, "{records:#?}");
    let boundary = &refusals[0]["decision"]["boundary"];
    assert_eq!(boundary["outcome"], "refused:state-conflict", "{boundary}");
    assert_eq!(boundary["located"], json!({"source":"ROADMAP.md","line":5,"entry":3,"phase":"4",
        "field":"complete","declared":"true","derived":"planned"}), "{boundary}");
    let stamp = at(refusals[0], window);
    assert!(text_a.contains(&format!(
        "Record (phase 4): 0 routing decisions, 1 refusals, 0 gate fires\n  refused state-conflict at \
         source=ROADMAP.md line=5 entry=3 phase=4 field=complete declared=true derived=planned, {stamp}\n")),
        "{text_a}");
    // Every record the binary wrote carries its time; the imported row carries none.
    let (imported, written): (Vec<&Value>, Vec<&Value>) = records.iter()
        .partition(|record| record["id"].as_str().is_some_and(|id| id.starts_with("decision:")));
    assert_eq!(imported.len(), 1, "{records:#?}");
    assert!(imported[0].get("at").is_none(), "{}", imported[0]);
    assert!(written.iter().all(|record| record.get("at").is_some()), "{written:#?}");

    // (b) One record for the staged path the lease does not cover.
    let records = journal(&b);
    let leases: Vec<&Value> = refused(&records).into_iter()
        .filter(|record| record["decision"]["boundary"]["outcome"] == "refused:lease").collect();
    assert_eq!(leases.len(), 1, "{records:#?}");
    assert_eq!(leases[0]["decision"]["boundary"]["located"],
        json!({"rule":"lease","slot":"staged","id":"docs/outside.md"}), "{}", leases[0]);
    let stamp = at(leases[0], window);
    assert!(text_b.contains(&format!("  refused lease at rule=lease slot=staged id=docs/outside.md, {stamp}\n")),
        "{text_b}");

    // (c) One record naming the input it could not read.
    let records = journal(&c);
    let refusals = refused(&records);
    assert_eq!(refusals.len(), 1, "{records:#?}");
    assert_eq!(refusals[0]["decision"]["boundary"]["outcome"], "refused:missing-roadmap", "{}", refusals[0]);
    assert_eq!(refusals[0]["decision"]["boundary"]["located"],
        json!({"rule":"missing-roadmap","slot":"roadmap","path":".planning/ROADMAP.md"}), "{}", refusals[0]);
    at(refusals[0], window);

    // No refusal in any of the three stores explains itself with the generic sentence.
    for project in [&a, &b, &c] {
        let records = journal(project);
        for record in refused(&records) {
            let reason = record["decision"]["boundary"]["receipt"]["envelope"]["reason"].as_str().unwrap_or_default();
            assert!(!reason.contains("execution validation failed"), "{record}");
        }
    }
}

#[test]
fn phase14_first_touch_declares_ticked_phases_it_cannot_derive() {
    let temp = legacy_fixture();
    let project = temp.path();
    let root = project.join(".planning");
    let mut before = documents(project);
    let import_digest = digest_of(&root.join("ROADMAP.md"));
    let mut client = Client::open(project);
    // First touch through progress: phases 2 and 3 are ticked and the legacy
    // table derives them short of complete, so the import declares them.
    let first = progress(&mut client);
    let name = project.file_name().unwrap().to_str().unwrap();
    let rows = "phase 1: First - complete - UAT 1 pass, 0 fail\n\
        phase 2: Second - complete (declared at import, unverified) - UAT 2 pass, 1 fail\n\
        phase 3: Third - complete (declared at import, unverified)\n\
        phase 4: Fourth - planned - plans 1\n";
    assert!(first["text"].as_str().unwrap().starts_with(&format!("# progress: {name}, phase 4 of 4: Fourth\n{rows}Issues: 0\n")), "{}", first["text"]);
    let next = client.call("cadence_query", json!({"operation":"execute-next","phase":4}));
    assert_ne!(next["code"], "state-conflict", "{next}");

    let declare = |client: &mut Client, phase: u32, id: &str| {
        client.call("cadence_apply", json!({"operation":"adoption-declare","phase":phase,"request_id":id}))
    };
    // A derivable phase and an unticked phase are refused in the typed shape.
    let d1 = declare(&mut client, 1, "d1");
    assert_eq!((d1["status"].as_str(), d1["rule"].as_str(), d1["id"].as_str()),
        (Some("refused"), Some("declaration-unneeded"), Some("complete")), "{d1}");
    let d4a = declare(&mut client, 4, "d4a");
    assert_eq!((d4a["status"].as_str(), d4a["rule"].as_str(), d4a["id"].as_str()),
        (Some("refused"), Some("declaration-unticked"), Some("ROADMAP.md:5")), "{d4a}");
    // The owner ticks phase 4 on disk after import and declares it explicitly.
    fs::write(root.join("ROADMAP.md"), LEGACY_TICKED).unwrap();
    before.insert(".planning/ROADMAP.md".into(), LEGACY_TICKED.as_bytes().to_vec());
    let d4 = declare(&mut client, 4, "d4");
    assert_eq!(d4["status"], "ok", "{d4}");
    assert_eq!(d4["replayed"], false);
    let record = d4["record"].clone();
    assert_eq!(record["provenance"], "declared-at-adoption");
    assert_eq!(record["phase"], 4);
    assert_eq!(record["roadmap"], json!({"line":5,"entry":3,"digest":model::digest(LEGACY_TICKED.as_bytes())}));
    assert_eq!(record["derived"], json!({"status":"planned","legacy_rule":"summary-and-uat"}));
    assert_eq!(record["human_results"], Value::Null);
    assert_eq!(record["claims"], json!([]));
    let mut replay = declare(&mut client, 4, "d4");
    assert_eq!(replay["replayed"], true, "{replay}");
    replay["replayed"] = json!(false);
    assert_eq!(replay, d4);
    let second = progress(&mut client);
    assert!(second["text"].as_str().unwrap().contains("\nphase 4: Fourth - complete (declared at adoption, unverified)\n"), "{}", second["text"]);
    let next = client.call("cadence_query", json!({"operation":"execute-next","phase":4}));
    assert_ne!(next["code"], "state-conflict", "{next}");
    // A caller-supplied record has no operation to arrive through.
    let forged = client.call("cadence_apply", json!({"operation":"adoption-record","phase":1,"request_id":"forged","record":record}));
    assert_eq!(forged["code"], "unknown-operation", "{forged}");
    client.finish();

    // A natively completed phase is never declared; the refusal names its completion.
    let (native, completion) = natively_completed();
    let dn = apply(native.project(), json!({"operation":"adoption-declare","phase":13,"request_id":"dn"}));
    assert_eq!((dn["status"].as_str(), dn["rule"].as_str(), dn["id"].as_str()),
        (Some("refused"), Some("declaration-native"), Some(completion.as_str())), "{dn}");

    // Reopened after restart: two records from the import, one from adoption, none for phase 1.
    let reopened = reopened(project);
    let records = reopened.snapshot.data["adoption"]["declared_completions"].as_array().unwrap().clone();
    assert_eq!(records.iter().map(|r| r["phase"].as_u64().unwrap()).collect::<Vec<_>>(), [2, 3, 4]);
    let shape = |record: &Value| {
        let mut shape = record.clone();
        for key in ["id", "root_binding", "import_generation", "source_generation"] {
            shape.as_object_mut().unwrap().remove(key);
        }
        shape
    };
    assert_eq!(shape(&records[0]), json!({
        "schema":"verification-declared-completion-1","phase":2,"provenance":"declared-at-import",
        "roadmap":{"line":3,"entry":1,"digest":import_digest},
        "derived":{"status":"executed","legacy_rule":"summary-and-uat"},
        "human_results":{"present":true,"pass":2,"fail":1,"skipped":0},"claims":[]}));
    assert_eq!(shape(&records[1]), json!({
        "schema":"verification-declared-completion-1","phase":3,"provenance":"declared-at-import",
        "roadmap":{"line":4,"entry":2,"digest":import_digest},
        "derived":{"status":"planned","legacy_rule":"summary-and-uat"},
        "human_results":null,"claims":[]}));
    assert_eq!(shape(&records[2]), json!({
        "schema":"verification-declared-completion-1","phase":4,"provenance":"declared-at-adoption",
        "roadmap":{"line":5,"entry":3,"digest":model::digest(LEGACY_TICKED.as_bytes())},
        "derived":{"status":"planned","legacy_rule":"summary-and-uat"},
        "human_results":null,"claims":[]}));
    assert_eq!(records[2]["id"].as_str().unwrap().len(), 64);
    assert_eq!(records[2]["root_binding"], records[0]["root_binding"]);
    // Every document byte is as it was, except the test's own tick of phase 4.
    assert_eq!(documents(project), before);
    assert!(String::from_utf8(before[Path::new(".planning/phases/2/UAT.md")].clone()).unwrap().contains("status: fail\n"));
}

#[test]
fn phase14_capture_records_items_and_reports_the_bound() {
    let fixture = Completed::published(false, |project| {
        let path = project.join(".planning/config.json");
        let mut config: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        config["planning"] = json!({"max_capture_bullets": 2});
        fs::write(&path, serde_json::to_vec(&config).unwrap()).unwrap();
    });
    let project = fixture.project();
    let head = git_value(project, &["rev-parse", "HEAD"]);
    assert!(!project.join(".planning/CAPTURE.md").exists());
    let mut client = Client::open(project);
    let sent = |request_id: &str, kind: &str, text: &str, phase: Option<u32>| {
        let mut request = json!({"operation":"capture","request_id":request_id,"kind":kind,"text":text});
        if let Some(phase) = phase { request["phase"] = json!(phase); }
        request
    };
    let c1 = client.call("cadence_apply", sent("c1", "todo", "wire the bound", Some(13)));
    let c2 = client.call("cadence_apply", sent("c2", "seed", "a global queue", None));
    let c3 = client.call("cadence_apply", sent("c3", "note", "read once", None));
    // Every receipt shows the item as it was sent and the bound as it stood,
    // and the third lands over the bound instead of being refused by it.
    for (answer, kind, text, phase, active, exceeded) in [
        (&c1, "todo", "wire the bound", Some(13u64), 1, false),
        (&c2, "seed", "a global queue", None, 2, false),
        (&c3, "note", "read once", None, 3, true),
    ] {
        assert_eq!(answer["status"], "ok", "{answer}");
        assert_eq!(answer["replayed"], false, "{answer}");
        let item = &answer["item"];
        assert_eq!((item["kind"].as_str(), item["text"].as_str()), (Some(kind), Some(text)), "{answer}");
        assert_eq!(item.get("phase").and_then(Value::as_u64), phase, "{answer}");
        assert_eq!(item["revision"], 1, "{answer}");
        assert_eq!(item["disposition"]["status"], "captured", "{answer}");
        assert_eq!(answer["captures"], json!({"active":active,"bound":2,"exceeded":exceeded}), "{answer}");
    }
    // A replay answers from the record it already wrote and appends nothing.
    let mut replay = client.call("cadence_apply", sent("c1", "todo", "wire the bound", Some(13)));
    assert_eq!(replay["replayed"], true, "{replay}");
    replay["replayed"] = json!(false);
    assert_eq!(replay, c1);
    // Each refusal names the slot that decided it.
    let c4 = client.call("cadence_apply", sent("c4", "seed", "a global queue", Some(13)));
    assert_eq!((c4["status"].as_str(), c4["rule"].as_str(), c4["slot"].as_str()),
        (Some("refused"), Some("capture"), Some("phase")), "{c4}");
    let c5 = client.call("cadence_apply", sent("c5", "todo", "wire the bound", Some(99)));
    assert_eq!((c5["status"].as_str(), c5["rule"].as_str(), c5["slot"].as_str(), c5["id"].as_str()),
        (Some("refused"), Some("capture"), Some("phase"), Some("99")), "{c5}");
    let c6 = client.call("cadence_apply", sent("c6", "note", "", None));
    assert_eq!((c6["status"].as_str(), c6["rule"].as_str(), c6["slot"].as_str()),
        (Some("refused"), Some("capture"), Some("text")), "{c6}");
    assert!(progress(&mut client)["text"].as_str().unwrap().contains("\nCaptures: 3 active of 2, over bound\n"),
        "{}", progress(&mut client)["text"]);
    client.finish();

    // Reopened: exactly the three records, and nothing written to the tree.
    let reopened = reopened(project);
    let handwritten = |answer: &Value, kind: &str, text: &str, phase: Option<u32>| {
        let mut record = json!({"version":1,"id":answer["item"]["id"],"revision":1,
            "origin":{"source":"capture","original":"missing"},
            "text":text,"kind":kind,"disposition":{"status":"captured"},
            "completed":false,"filing_uncertain":false});
        if let Some(phase) = phase { record["phase"] = json!(phase); }
        record
    };
    assert_eq!(reopened.items.iter().map(|item| serde_json::to_value(item).unwrap()).collect::<Vec<_>>(),
        vec![handwritten(&c1, "todo", "wire the bound", Some(13)),
            handwritten(&c2, "seed", "a global queue", None),
            handwritten(&c3, "note", "read once", None)]);
    assert_eq!(git_value(project, &["rev-parse", "HEAD"]), head);
    assert!(!project.join(".planning/CAPTURE.md").exists());

    let rendered = Command::new(env!("CARGO_BIN_EXE_cadence"))
        .arg("capture-instructions").current_dir(project).stdin(Stdio::null()).output().unwrap();
    assert!(rendered.status.success(), "{}", String::from_utf8_lossy(&rendered.stderr));
    assert_eq!(rendered.stdout,
        fs::read(Path::new(env!("CARGO_MANIFEST_DIR")).join("../../skills/cad-capture/SKILL.md")).unwrap());
}

#[test]
fn phase14_progress_reports_status_issues_and_one_next_action() {
    let fixture = progress_fixture();
    let project = fixture.project();
    let mut before = documents(project);
    let mut client = Client::open(project);
    let first = progress(&mut client);
    let header = format!("# progress: {}, phase 5 of 3: Legacy\n", project.file_name().unwrap().to_str().unwrap());
    let rows = "phase 5: Legacy - planned - plans 1\nphase 13: Plan publication - executed\nphase 28: Next phase - unplanned\n";
    assert_eq!(first["text"], format!("{header}{rows}Issues: 0\nRecord (phase 5): 0 routing decisions, 0 refusals, 0 gate fires\nCaptures: 0 active of 40\nNext: /cad-execute 5\n"));
    assert_eq!(first["phases"].as_array().unwrap().len(), 3);
    assert_eq!(first["issues"], json!([]));
    assert_eq!(first["dispatch"], Value::Null);
    assert_eq!(documents(project), before);

    fs::write(project.join(".planning/ROADMAP.md"), TICKED).unwrap();
    before.insert(".planning/ROADMAP.md".into(), TICKED.as_bytes().to_vec());
    let second = progress(&mut client);
    assert_eq!(second["phases"], first["phases"]);
    assert_eq!(second["issues"].as_array().unwrap().len(), 1);
    assert_eq!(second["text"], format!("{header}{rows}Issues: 1\n  ROADMAP.md:2 entry 0 declares phase 5 complete; derived planned\nRecord (phase 5): 0 routing decisions, 0 refusals, 0 gate fires\nCaptures: 0 active of 40\nNext: Resolve ROADMAP.md:2 entry 0: declare phase 5 with adoption-declare or untick it\n"));
    client.finish();
    let mut client = Client::open(project);
    let third = progress(&mut client);
    assert_eq!(serde_json::to_vec(&third).unwrap(), serde_json::to_vec(&second).unwrap());
    client.finish();
    assert_eq!(reopened(project).snapshot.data["derivation"]["intake"]["retired"], true);
    assert_eq!(documents(project), before);

    let rendered = Command::new(env!("CARGO_BIN_EXE_cadence"))
        .arg("progress-instructions").current_dir(project).stdin(Stdio::null()).output().unwrap();
    assert!(rendered.status.success(), "{}", String::from_utf8_lossy(&rendered.stderr));
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    assert_eq!(rendered.stdout, fs::read(root.join("skills/cad-progress/SKILL.md")).unwrap());
    for retired in ["cad-health", "cad-report"] {
        assert!(!root.join(format!("skills/{retired}/SKILL.md")).exists());
    }
}

#[test]
fn phase14_exited_worker_without_completion_is_interrupted() {
    use phase14::WorkerRound;
    let mut round = WorkerRound::new();
    let project = round.fixture.project().to_owned();
    let before_documents = documents(&project);
    let before_tree = phase13::tree(&project);
    let before = seconds();
    let a = round.issue();
    let id = a["dispatch_id"].as_str().unwrap().to_owned();
    let issued_generation = reopened(&project).snapshot.generation;
    let exit_request = json!({"operation":"execution-worker-exit","request_id":"exit-A","phase":31,
        "dispatch":id,"host":"codex exec","outcome":"exited"});
    let exit_a = round.apply(exit_request.clone());
    assert_eq!(exit_a["interrupted"], true, "{exit_a}");
    assert_eq!(exit_a["generation"], issued_generation + 1, "{exit_a}");
    let text = round.progress()["text"].as_str().unwrap().to_owned();
    assert!(text.contains(&format!("Dispatch: dispatch {id} interrupted, no return; 1 generations since issue\n")), "{text}");
    assert!(text.ends_with(&format!("Next: Continue dispatch {id} with execution-authorize or retire it\n")), "{text}");
    let document = round.query(json!({"operation":"document","identity":{"kind":"dispatch","id":id},"part":"execution"}));
    assert_eq!(document["status"], "ok", "{document}");
    let execution: Value = serde_json::from_str(document["body"].as_str().unwrap()).unwrap();
    assert_eq!(execution["worker_exits"][0]["dispatch_id"], id);
    let refused = round.query(json!({"operation":"execute-next","phase":31}));
    assert_eq!(refused["code"], "continuation-refusal", "{refused}");
    assert_eq!(refused["located"], json!({"rule":"interrupted","slot":"dispatch","id":id}), "{refused}");
    let mut duplicate_request = exit_request.clone();
    duplicate_request["request_id"] = json!("exit-A-duplicate");
    let duplicate = round.client.call("cadence_apply", duplicate_request);
    assert_eq!(duplicate["rule"], "exit-duplicate", "{duplicate}");
    assert_eq!(round.apply(exit_request.clone()), exit_a);
    let irrelevant = round.client.call("cadence_apply", json!({"operation":"execution-authorize","phase":31,
        "request_id":"wrong-continuation","dispatch":"unknown","owner":"Fixture Owner","at":"2026-09-19T12:00:00Z","response":"Continue"}));
    assert_eq!(irrelevant["rule"], "continuation-target", "{irrelevant}");
    round.apply(json!({"operation":"execution-authorize","phase":31,"request_id":"continue-A","dispatch":id,
        "owner":"Fixture Owner","at":"2026-09-19T12:00:00Z","response":"Continue this interrupted dispatch"}));
    let resumed = round.issue();
    for slot in ["dispatch_id", "route", "identities"] { assert_eq!(resumed[slot], a[slot]); }
    assert!(!round.progress()["text"].as_str().unwrap().contains("Dispatch:"));
    round.close_task(1, true);
    round.close_task(1, false);
    round.complete(1, &a);
    let completed_exit = round.apply(json!({"operation":"execution-worker-exit","request_id":"exit-A-complete","phase":31,
        "dispatch":id,"host":"codex exec","outcome":"exited"}));
    assert_eq!(completed_exit["interrupted"], false);
    assert!(!round.progress()["text"].as_str().unwrap().contains("Dispatch:"));

    let b = round.issue();
    round.close_task(2, true);
    let exit_b = round.apply(json!({"operation":"execution-worker-exit","request_id":"exit-B","phase":31,
        "dispatch":b["dispatch_id"],"host":"codex exec","outcome":"failed","detail":"worker exited after the first task"}));
    assert_eq!(exit_b["interrupted"], true);
    round.close_task(2, false);
    round.complete(2, &b);
    let final_progress = round.progress();
    let text = final_progress["text"].as_str().unwrap();
    assert!(!text.contains("Dispatch:"), "{text}");
    assert!(text.contains("Record (phase 31): 2 routing decisions, 1 refusals, 0 gate fires\n"), "{text}");
    let unknown = round.client.call("cadence_apply", json!({"operation":"execution-worker-exit","request_id":"exit-unknown","phase":31,
        "dispatch":"unknown","host":"codex exec","outcome":"exited"}));
    assert_eq!(unknown["rule"], "exit-target", "{unknown}");
    assert_eq!(round.apply(exit_request.clone()), exit_a);
    let v = round.query(json!({"operation":"verify-next","phase":31,"request_id":"verify-exit"}));
    assert_eq!(v["status"], "ok", "{v}");
    let verifier_exit = round.apply(json!({"operation":"execution-worker-exit","request_id":"exit-V","phase":31,
        "attempt":v["attempt"]["id"],"host":"codex exec","outcome":"exited"}));
    assert_eq!(verifier_exit["interrupted"], true);
    let verification = round.query(json!({"operation":"verification-read","phase":31,"attempt":v["attempt"]["id"]}));
    assert_eq!(verification["attempt"]["interrupted"], true, "{verification}");
    round.client.finish();
    round.client = phase14::exit_support::Client::open(&project);
    assert_eq!(round.apply(exit_request), exit_a);
    let verification = round.query(json!({"operation":"verification-read","phase":31,"attempt":v["attempt"]["id"]}));
    assert_eq!(verification["attempt"]["interrupted"], true);
    round.client.finish();
    let after = seconds();
    let reopened = reopened(&project);
    let exits: Vec<Value> = cadence::execution::history::plan_records(&reopened.snapshot.data, 31).unwrap().iter()
        .map(|r| serde_json::to_value(&r.request.event).unwrap()).filter(|e| e["kind"] == "worker-exit").collect();
    assert_eq!(exits.len(), 3, "{exits:?}");
    assert_eq!(exits.iter().filter(|e| e["interrupted"] == true).count(), 2);
    assert_eq!(exits.iter().map(|e| e["dispatch_id"].clone()).collect::<Vec<_>>(), [a["dispatch_id"].clone(), a["dispatch_id"].clone(), b["dispatch_id"].clone()]);
    for event in &exits {
        assert_eq!(event["host"], "codex exec");
        at(event, (before, after));
        assert!(event["generation"].as_u64().is_some_and(|g| g > issued_generation));
    }
    let refusals: Vec<_> = reopened.decisions.iter().map(|r| serde_json::to_value(r).unwrap())
        .filter(|r| r["decision"]["boundary"]["outcome"] == "refused:continuation-refusal").collect();
    assert_eq!(refusals.len(), 1);
    at(&refusals[0], (before, after));
    assert_eq!(refusals[0]["decision"]["boundary"]["located"], json!({"rule":"interrupted","slot":"dispatch","id":id}));
    let mut after_documents = documents(&project);
    after_documents.remove(Path::new(".planning/phases/31/SUMMARY.md"));
    assert_eq!(after_documents, before_documents);
    for (path, bytes) in phase13::tree(&project) {
        if path.starts_with(".planning") && before_tree.get(&path) != Some(&bytes) {
            assert!([".planning/state.json", ".planning/decisions.jsonl", ".planning/items.jsonl", ".planning/phases/31/SUMMARY.md"]
                .iter().any(|allowed| path == Path::new(allowed)), "unexpected planning write: {}", path.display());
        }
    }
}
