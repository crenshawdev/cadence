//! Core shard of the executable phase-6 acceptance inventory.
//!
//! Each test-binary shard checks the harness registry and then invokes every
//! mapped evidence function. A source-level test name is never counted as a
//! pass. Real-host invocation, a real model executor, actual host permission
//! denial and model-produced work remain PLAN-2 UAT obligations, not Cargo
//! claims.
use super::{
    patch::parse_executor_patch,
    plan::{PlanGraph, parse_plan},
};
use serde_json::json;
use std::{collections::BTreeSet, process::Command};

#[test]
fn capture_retains_result_lines_past_prefix() {
    let mut output = vec![b'x'; 65_537];
    output.extend_from_slice(b"\ntest oversized::late ... FAILED\ntest result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out\n");
    let capture = super::runner::capture(output.as_slice());
    assert_eq!(capture.bytes.len(), 65_536);
    assert!(!capture.complete);
    assert_eq!(capture.result_lines, vec!["test oversized::late ... FAILED",
        "test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out"]);
}

// D-168 and the run classifier both read cargo test's own lines. nextest, which
// the suite runs under since D-176, writes its summary to stderr with a leading
// indent and repeats cargo's `test result:` line indented under a failure, so
// every nextest run came back Unknown and cost the owner a classification.
#[test]
fn classify_reads_nextest_summaries_and_keeps_their_result_lines() {
    use super::{receipts::{Observation, Summary}, runner::{capture, classify, valid_result_line}};
    let empty = capture(&b""[..]);
    let green = capture(&b"    Starting 1 test across 1 binary (1 test skipped)\n        PASS [   0.062s] (1/1) cadence::phase32_typed_authoring phase32_plan_body_is_refused\n     Summary [   0.062s] 1 test run: 1 passed, 1 skipped\n"[..]);
    assert_eq!(classify(&empty, &green), Observation::ResultsObserved { summary: Summary::Cargo { failed: false } });
    let red = capture(&b"        FAIL [   0.065s] (1/1) cadence::phase32_typed_authoring phase32_plan_body_is_refused\n    test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 1 filtered out; finished in 0.06s\n     Summary [   0.066s] 1 test run: 0 passed, 1 failed, 1 skipped\nerror: test run failed\n"[..]);
    assert_eq!(classify(&empty, &red), Observation::ResultsObserved { summary: Summary::Cargo { failed: true } });
    let summary_only_red = capture(&b"     Summary [   0.066s] 2 tests run: 1 passed, 1 failed\n"[..]);
    assert_eq!(classify(&empty, &summary_only_red), Observation::ResultsObserved { summary: Summary::Cargo { failed: true } });
    for line in ["     Summary [   0.062s] 1 test run: 1 passed, 1 skipped",
        "        PASS [   0.062s] (1/1) cadence::phase32_typed_authoring phase32_plan_body_is_refused",
        "        FAIL [   0.065s] (1/1) cadence::phase32_typed_authoring phase32_plan_body_is_refused",
        "    test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 1 filtered out; finished in 0.06s"] {
        assert!(valid_result_line(line), "{line}");
    }
    assert!(!valid_result_line("    Starting 1 test across 1 binary (1 test skipped)"));
    assert!(!valid_result_line("error: test run failed"));
}

// A retained run classified Unknown by an older binary is still the record of
// what that binary saw. A later classifier that recognizes those bytes may not
// refuse the record; a retained result that claims more than the bytes say still is.
#[test]
fn retained_unknown_observation_stays_valid_when_the_classifier_learns_its_lines() {
    use super::{receipts::{Observation, Summary}, runner::{capture, observation_consistent}};
    let empty = capture(&b""[..]);
    let green = capture(&b"     Summary [   0.062s] 1 test run: 1 passed, 1 skipped\n"[..]);
    assert!(observation_consistent(&Observation::Unknown, &empty, &green));
    let observed = Observation::ResultsObserved { summary: Summary::Cargo { failed: false } };
    assert!(observation_consistent(&observed, &empty, &green));
    let claimed = Observation::ResultsObserved { summary: Summary::Cargo { failed: true } };
    assert!(!observation_consistent(&claimed, &empty, &green));
    let custom = capture(&b"custom output\n"[..]);
    assert!(!observation_consistent(&observed, &empty, &custom));
}

#[test]
fn later_answered_launch_supersedes_only_matching_unanswered_runs() {
    use super::{allocation::Check, history::{self, Event, Record, Request, Task}, receipts::*, runner::capture};
    let task = Task { phase: 33, occurrence: "active-cycle:phase:33".into(), admission_digest: "admitted".into(),
        plan: 3, task: "P33-3-T3".into() };
    let launch = |id: &str| Launch { run_id: id.into(), check: None, stage: Stage::Verify,
        material: Material { command: "cargo nextest run -p cadence --test mcp".into(), commit: "f74d252d".into(),
            tree: "material-tree".into(), test_file: String::new(), test_digest: String::new() }, launched_at: 1 };
    let result = |id: &str| Event::Result(RunResult { run_id: id.into(), disposition: Disposition::Exited { code: 0 },
        stdout: capture(&b""[..]), stderr: capture(&b""[..]), observed_at: 2,
        observation: Observation::Unknown, material_unchanged: true });
    let record = |version: u64, event: Event| {
        let request = Request { request_id: format!("event-{version}"), task: task.clone(), attempt: "attempt".into(),
            expected_version: version - 1, event };
        Record { schema: "native-task-event-1".into(), root_binding: "fixture".into(), version,
            request_digest: history::request_digest(&request).unwrap(), request }
    };
    let check = Check { id: "check/mcp".into(), item_revision: "revision-1".into() };
    for case in ["different command", "different stage", "different check", "different check revision", "different attempt",
        "different task", "unanswered retry", "older result", "matching null check", "matching check"] {
        let mut first = launch("dead-launch");
        let mut second = launch("resumed-launch");
        match case {
            "different command" => second.material.command = "cargo nextest run -p cadence --test phase33_verification".into(),
            "different stage" => second.stage = Stage::Green,
            "different check" => second.check = Some(check.clone()),
            "different check revision" | "matching check" => {
                first.check = Some(check.clone());
                second.check = Some(check.clone());
                if case == "different check revision" { second.check.as_mut().unwrap().item_revision = "revision-2".into(); }
            }
            _ => {}
        }
        let mut records = vec![record(1, Event::Launch(first)), record(2, Event::Launch(second))];
        assert_eq!(history::project(&records[..1], &task).unknown_runs, ["dead-launch"], "{case}");
        assert_eq!(history::project(&records, &task).unknown_runs, ["dead-launch", "resumed-launch"], "{case}");
        if case != "unanswered retry" {
            records.push(record(3, result(if case == "older result" { "dead-launch" } else { "resumed-launch" })));
        }
        for record in &mut records[1..] {
            if case == "different attempt" { record.request.attempt = "another-attempt".into(); }
            if case == "different task" { record.request.task.task = "another-task".into(); }
            record.request_digest = history::request_digest(&record.request).unwrap();
        }
        let retained = serde_json::to_vec(&records).unwrap();
        let expected = match case {
            "matching null check" | "matching check" => vec![],
            "unanswered retry" => vec!["dead-launch", "resumed-launch"],
            "older result" => vec!["resumed-launch"],
            _ => vec!["dead-launch"],
        };
        assert_eq!(history::project(&records, &task).unknown_runs, expected, "{case}");
        assert_eq!(serde_json::to_vec(&records).unwrap(), retained, "projection must preserve retained records");
    }
}

// D-168: a suite receipt always carries every failing test's name. nextest
// names a failure as `FAIL [ time ] (n/m) crate::binary test`, indented, and
// repeats the name in its final list; the repair question for suite-p32-1
// carried no names from nineteen failures.
#[test]
fn failing_tests_reads_nextest_fail_lines_once_each() {
    use super::{history::failing_tests, receipts::{Disposition, Observation, RunResult}, runner::capture};
    let stderr = capture(&b"        FAIL [   0.299s] ( 351/1065) cadence::phase12_execution phase12_acknowledged_progress_survives_restart\n    test phase12_acknowledged_progress_survives_restart ... FAILED\n        FAIL [   0.268s] ( 362/1065) cadence::phase13_close phase13_rules_gate_retirement_rehearsal\n     Summary [ 120.000s] 1065 tests run: 1046 passed, 19 failed, 2 skipped\n        FAIL [   0.299s] ( 351/1065) cadence::phase12_execution phase12_acknowledged_progress_survives_restart\n        FAIL [   0.268s] ( 362/1065) cadence::phase13_close phase13_rules_gate_retirement_rehearsal\nerror: test run failed\n"[..]);
    let result = RunResult { run_id: "suite".into(), disposition: Disposition::Exited { code: 100 }, stdout: capture(&b""[..]),
        stderr, observed_at: 1, observation: Observation::Unknown, material_unchanged: true };
    assert_eq!(failing_tests(&result), vec![
        "phase12_execution phase12_acknowledged_progress_survives_restart".to_owned(),
        "phase13_close phase13_rules_gate_retirement_rehearsal".to_owned()]);
}

// Constructed unit authority, not a claim of approval through the public API.
// The acceptance check separately supplies that boundary with real stdio calls.
fn native_unit_contract(command: &str) -> (serde_json::Value, std::collections::BTreeMap<String, String>, super::admission::Contract) {
    use crate::{plan::{model::*, evidence::Map}, store::model::digest};
    let truths = ["truth/A", "truth/B"].map(|id| json!({"id":id,"trigger":"the sender sends the parcel",
        "observer":"the recipient","verb":"gets","outcome":"a receipt","kind":"property",
        "observable":true,"fixed_oracle":true}));
    let submission = json!({"phase":12,"title":"Delivery","scope":"Approved delivery.","decisions":[],
        "durable_decisions":[],"assumptions":[],"truths":truths});
    let approval = json!({"approved":true,"owner":"Fixture Owner","at":"2026-09-10T14:00:00Z","submission":submission});
    let context = crate::context::persistence::approved(serde_json::from_value(submission).unwrap(), serde_json::from_value(approval).unwrap()).unwrap();
    let edges = ["truth/A", "truth/B"].map(|id| json!({"truth_id":id,"truth_version":1,"reason":"Delivery provides the receipt."}));
    let map: Map = serde_json::from_value(json!({"mode":"attached","items":[{
        "kind":"check","id":"check/shared","spec":{"command":command,"expected":{"kind":"literal","value":"receipt"},
        "test":{"file":"tests/not_yet_written.rs","function":"delivery"},"setup":"","call":"","boundary":"","fakes":[]},
        "reason":"Removing delivery loses the receipt.","associations":edges},
        {"kind":"artifact","id":"artifact/delivery","spec":{"locators":["src/delivery.rs"],"substance":"Delivery exists."},
        "reason":"Delivery needs an implementation.","associations":edges}]})).unwrap();
    let body = format!("# Delivery\n## Evidence map\n\n```json\n{}\n```\n\n", serde_json::to_string_pretty(&map).unwrap());
    // Blank check commands must reach admission with valid task metadata.
    let verify = if command.is_empty() { "printf verified" } else { command };
    let entries = (1..=2).map(|n| serde_json::from_value(json!({"target":{"phase":12,"plan":n},"content":{
        "phase":12,"plan":n,"requirements":["truth/A","truth/B"],"files":["src/delivery.rs"],"directories":[],
        "execution":{"schema":1,"suite":"printf suite","tasks":[{"id":"deliver","verify":[verify]},
        {"id":"document","verify":["printf documented"]}]},"body":body,"evidence_map":map}})).unwrap()).collect();
    let submission = Submission { phase: 12.try_into().unwrap(), occurrence:"active-cycle:phase:12".into(),
        request_id:"unit-publication".into(), inventory_basis:"unit-inventory".into(), plans:entries };
    let approval = Approval { approved:true, owner:Some("Fixture Owner".into()), at:Some("2026-09-10T14:00:00Z".into()), submission:Some(submission.clone()), submission_digest:None };
    let mut documents = std::collections::BTreeMap::new();
    let mut publications = std::collections::BTreeMap::new();
    let mut revisions = Vec::new();
    let mut bindings = Vec::new();
    let payload = crate::plan::persistence::payload_digest(&submission, &approval).unwrap();
    for entry in &submission.plans {
        let bytes = crate::plan::render::document(&entry.content).unwrap();
        let content_revision = digest(&bytes);
        let map_revision = crate::plan::map_history::event_id(&submission, &entry.target).unwrap();
        let Map::Attached { items } = &map else { unreachable!() };
        let item_revisions = items.iter().map(|i| (i.id().into(), digest(&serde_json::to_vec(&crate::plan::map_history::definition(i).unwrap()).unwrap()))).collect();
        revisions.push(crate::plan::map_history::Revision { revision:map_revision.clone(), occurrence:submission.occurrence.clone(),
            request_id:submission.request_id.clone(), payload_digest:payload.clone(), identity:entry.target.clone(),
            content_revision:content_revision.clone(),items:items.clone(),item_revisions });
        publications.insert(entry.target.plan.get(), Publication { identity:entry.target.clone(), occurrence:submission.occurrence.clone(),
            revision:content_revision.clone(),content:entry.content.clone(),approval:approval.clone(),readiness:Readiness::ProvisionalAuthoring,
            history:vec![content_revision.clone()],map_revision:Some(map_revision.clone()) });
        documents.insert(format!("phases/12/PLAN-{}.md",entry.target.plan), String::from_utf8(bytes).unwrap());
        bindings.push(super::admission::Binding {plan:entry.target.plan.get(),publication_request:submission.request_id.clone(),content_revision,map_revision});
    }
    let receipt = Receipt {payload_digest:payload,results:publications.values().cloned().collect()};
    let occurrence = Occurrence {id:submission.occurrence.clone(),phase:12,cycle:"active".into(),high_water:2,consumed:vec![1,2],
        provenance:Default::default(),publications,receipts:std::collections::BTreeMap::from([(submission.request_id,receipt)])};
    let allocation = (1..=2).flat_map(|plan| ["deliver","document"].map(|task| super::allocation::Assignment {
        plan,task:task.into(),checks:if plan == 1 && task == "deliver" {vec![super::allocation::Check {
            id:"check/shared".into(),item_revision:revisions[0].item_revisions["check/shared"].clone()}]} else {vec![]}
    })).collect();
    let data = json!({"context":{"schema":"context-1","phases":{"12":context}},
        "plan_publications":{"schema":"plan-1","phases":{"12":occurrence}},
        "acceptance_maps":{"schema":"acceptance-map-1","phases":{"12":{"occurrence":submission.occurrence,"revisions":revisions}}}});
    (data, documents, super::admission::Contract {phase:12,occurrence:submission.occurrence,plans:bindings,allocation})
}

#[test]
fn native_admission_validates_authority_and_allocation() {
    use super::admission::{decode,validate};
    let (data, documents, contract) = native_unit_contract("custom-delivery-check");
    let valid = validate(&data,&documents,&contract).unwrap();
    assert_eq!(valid.plans.iter().map(|p| p.plan).collect::<Vec<_>>(), vec![1,2]);
    assert_eq!(valid.plans[0].tasks.iter().map(|t| t.id.as_str()).collect::<Vec<_>>(), vec!["deliver","document"]);
    assert_eq!(valid.maps.len(),2);
    assert_eq!(contract.allocation[1].checks,vec![]);
    let assert_refusal = |error:crate::store::Error, rule:&str, slot:&str, id:&str| {
        let crate::store::Error::Invalid(message) = error else {panic!("expected located invalid: {error}")};
        let diagnostic:crate::plan::model::Diagnostic = serde_json::from_str(message.strip_prefix("plan-refusal:").unwrap()).unwrap();
        assert_eq!(diagnostic.rule,rule);
        assert_eq!(diagnostic.slot,slot);
        if !id.is_empty() {assert_eq!(diagnostic.id.as_deref(),Some(id));}
    };
    for field in ["phase","occurrence","plans","allocation"] {
        let mut raw=serde_json::to_value(&contract).unwrap(); raw.as_object_mut().unwrap().remove(field);
        assert_refusal(decode(raw).unwrap_err(),"admission-shape",&format!("contract.{field}"),"");
    }
    for (pointer,value,rule,slot) in [
        ("/context",serde_json::Value::Null,"native-approved-truths","context"),
        ("/context/phases/12/approval/approved",json!(false),"native-approved-truths","context.approval"),
        ("/context/phases/12/truths/0/version",json!(2),"native-approved-truths","context.approval"),
        ("/context/phases/12/submission/truths/0/outcome",json!("another outcome"),"native-approved-truths","context.approval"),
        ("/plan_publications/phases/12/receipts/unit-publication/payload_digest",json!("stale"),"publication-authority","current.plans[1].receipt"),
        ("/acceptance_maps/phases/12/revisions/0/item_revisions/check~1shared",json!("stale"),"map-authority","current.plans[1].item_revision"),
        ("/acceptance_maps/phases/12/revisions/0/content_revision",json!("stale"),"map-authority","current.plans[1].map_revision"),
    ] {
        let mut changed=data.clone();
        if pointer=="/context" {changed.as_object_mut().unwrap().remove("context");}
        else {*changed.pointer_mut(pointer).unwrap()=value;}
        assert_refusal(validate(&changed,&documents,&contract).unwrap_err(),rule,slot,"");
    }
    let mut drift=documents.clone(); drift.get_mut("phases/12/PLAN-1.md").unwrap().push('\n');
    assert_refusal(validate(&data,&drift,&contract).unwrap_err(),"installed-plan","phases/12/PLAN-1.md","1");
    let (blank_data,blank_docs,blank_contract)=native_unit_contract("");
    assert_refusal(validate(&blank_data,&blank_docs,&blank_contract).unwrap_err(),"check-command","current.plans[1].evidence_map.items[0].spec.command","check/shared");
    for (n,rule,slot,id) in [
        (0,"allocation-task","contract.allocation","deliver"),
        (1,"allocation-task","contract.allocation","document"),
        (2,"allocation-task","contract.allocation[0]","unknown"),
        (3,"allocation-item","contract.allocation[0].checks[0].id","unknown"),
        (4,"allocation-kind","contract.allocation[0].checks[0].id","artifact/delivery"),
        (5,"allocation-revision","contract.allocation[0].checks[0].item_revision","check/shared"),
        (6,"allocation-check","contract.allocation","check/shared"),
        (7,"allocation-owner","contract.allocation[2].checks[0]","check/shared"),
    ] {
        let mut changed=contract.clone();
        match n {
            0=>changed.allocation.clear(),1=>{changed.allocation.remove(1);},2=>changed.allocation[0].task="unknown".into(),
            3=>changed.allocation[0].checks[0].id="unknown".into(),4=>changed.allocation[0].checks[0].id="artifact/delivery".into(),
            5=>changed.allocation[0].checks[0].item_revision="stale".into(),6=>changed.allocation[0].checks.clear(),
            7=>changed.allocation[2].checks=changed.allocation[0].checks.clone(),_=>unreachable!(),
        }
        assert_refusal(validate(&data,&documents,&changed).unwrap_err(),rule,slot,id);
    }
}

#[test]
fn native_admission_refuses_check_command_outside_task_verify() {
    use super::admission::validate;
    let command = "custom-delivery-check";
    let (data, documents, mut contract) = native_unit_contract(command);
    validate(&data, &documents, &contract).unwrap();
    // The document task names only `printf documented`; delivery's command
    // exists on another task, but cannot launch under this closing owner.
    contract.allocation[1].checks = std::mem::take(&mut contract.allocation[0].checks);
    let error = validate(&data, &documents, &contract).unwrap_err();
    let crate::store::Error::Invalid(message) = error else { panic!("expected located invalid: {error}") };
    let diagnostic: crate::plan::model::Diagnostic = serde_json::from_str(message.strip_prefix("plan-refusal:").unwrap()).unwrap();
    assert_eq!(diagnostic.rule, "check-command-verify");
    assert_eq!(diagnostic.slot, "contract.allocation");
    assert_eq!(diagnostic.phase, Some(12));
    assert_eq!(diagnostic.id.as_deref(), Some("document"));
    assert!(diagnostic.reason.contains("check/shared"), "{}", diagnostic.reason);
    assert!(diagnostic.reason.contains(command), "{}", diagnostic.reason);
}

#[test]
fn native_admission_commits_versioned_extensions() {
    use crate::store::{Storage,filesystem::Filesystem,writer::{Store,Operation,PlanningPolicy},transaction::{Transaction,ExternalChange}};
    use super::admission;
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let temp=tempfile::tempdir().unwrap(); let root=temp.path().join(".planning");
        std::fs::create_dir_all(root.join("phases/12")).unwrap();
        let (data,documents,contract)=native_unit_contract("custom-delivery-check");
        for (path,bytes) in &documents {std::fs::write(root.join(path),bytes).unwrap();}
        let store=Store::open(Filesystem::new(&root).unwrap(),PlanningPolicy).await.unwrap();
        let view=store.request(Operation::RewriteSnapshot(data)).await.unwrap();
        let first=admission::Request {request_id:"admit".into(),expected_set_version:0,contract};
        let view=store.request(Operation::NativeAdmissionV1 {expected_generation:view.snapshot.generation,
            expected_integrity:view.snapshot.integrity.clone(),request:Box::new(first.clone())}).await.unwrap();
        let initial=admission::records(&view.snapshot.data,12).unwrap();
        assert_eq!(initial.len(),1); assert_eq!(initial[0].set_version,1); assert_eq!(initial[0].request,first);
        let raw_record=serde_json::to_vec(&initial[0]).unwrap();
        let before=std::fs::read(root.join("state.json")).unwrap();
        let before_decisions=std::fs::read(root.join("decisions.jsonl")).unwrap();
        drop(store);
        assert!(!root.join(".store-intent.json").exists());
        let store=Store::open(Filesystem::new(&root).unwrap(),PlanningPolicy).await.unwrap();
        let view=store.request(Operation::ReadVerified).await.unwrap();
        assert_eq!(admission::records(&view.snapshot.data,12).unwrap(),initial);
        assert_eq!(std::fs::read(root.join("state.json")).unwrap(),before);
        let replay=store.request(Operation::NativeAdmissionV1 {expected_generation:0,expected_integrity:"stale".into(),request:Box::new(first.clone())}).await.unwrap();
        assert_eq!(replay,view);
        assert_eq!(std::fs::read(root.join("state.json")).unwrap(),before);
        let mut reuse=first.clone(); reuse.contract.allocation[0].checks.clear();
        assert!(store.request(Operation::NativeAdmissionV1 {expected_generation:0,expected_integrity:"stale".into(),request:Box::new(reuse)}).await.unwrap_err().to_string().contains("admission-request-reuse"));
        assert_eq!(std::fs::read(root.join("decisions.jsonl")).unwrap(),before_decisions);
        assert!(crate::plan::validation::admitted(&view.snapshot.data,12,2).unwrap(),"undispatched member is protected");

        // Unit setup publishes a gap through the real publication transaction;
        // no native admission record is seeded or rewritten by setup.
        let inventory=crate::plan::inventory::read(&root,"12",&view.snapshot.data).unwrap();
        let old=crate::plan::persistence::saved(&view.snapshot.data,12).unwrap().unwrap().publications[&2].clone();
        let replacement=crate::plan::model::ReplacementApproval {approved:true,owner:Some("Fixture Owner".into()),
            at:Some("2026-09-10T15:00:00Z".into()),target:old.identity.clone(),old_revision:old.revision.clone(),
            old_document:String::from_utf8(crate::plan::render::document(&old.content).unwrap()).unwrap(),content:old.content.clone()};
        let replacing=crate::plan::model::Submission {phase:12.try_into().unwrap(),occurrence:first.contract.occurrence.clone(),
            request_id:"replace-undispatched".into(),inventory_basis:inventory.basis.clone(),plans:vec![crate::plan::model::Entry {
                target:old.identity,content:old.content,replacement:Some(replacement)}]};
        let approved=crate::plan::model::Approval {approved:true,owner:Some("Fixture Owner".into()),at:Some("2026-09-10T15:00:00Z".into()),submission:Some(replacing.clone()),submission_digest:None};
        assert!(crate::plan::persistence::contribute(&view.snapshot.data,&replacing,&approved,&inventory).unwrap_err().to_string().contains("admitted-plan"));
        let mut content=crate::plan::persistence::saved(&view.snapshot.data,12).unwrap().unwrap().publications[&1].content.clone();
        content.plan=3.try_into().unwrap();
        let submission=crate::plan::model::Submission {phase:12.try_into().unwrap(),occurrence:first.contract.occurrence.clone(),request_id:"gap".into(),
            inventory_basis:inventory.basis.clone(),plans:vec![crate::plan::model::Entry {target:crate::plan::model::Identity {phase:12.try_into().unwrap(),plan:3.try_into().unwrap()},content,replacement:None}]};
        let approval=crate::plan::model::Approval {approved:true,owner:Some("Fixture Owner".into()),at:Some("2026-09-10T15:00:00Z".into()),submission:Some(submission.clone()),submission_digest:None};
        let (next,publications)=crate::plan::persistence::contribute(&view.snapshot.data,&submission,&approval,&inventory).unwrap();
        let publication=&publications[0];
        let mut filesystem=Filesystem::new(&root).unwrap();
        let external=ExternalChange {target:"phase-plan:12:3".into(),expected:filesystem.read("phase-plan:12:3").unwrap(),
            bytes:crate::plan::render::document(&publication.content).unwrap()};
        let view=store.request(Operation::CompareTransact {expected_generation:view.snapshot.generation,expected_integrity:view.snapshot.integrity,
            transaction:Transaction {id:"gap-publication".into(),items:vec![],decisions:vec![],snapshot:Some(next),external:vec![external]}}).await.unwrap();
        let mut extension=first.clone(); extension.request_id="extend".into(); extension.expected_set_version=1;
        extension.contract.plans.push(admission::Binding {plan:3,publication_request:"gap".into(),content_revision:publication.revision.clone(),map_revision:publication.map_revision.clone().unwrap()});
        for task in ["deliver","document"] {extension.contract.allocation.push(super::allocation::Assignment {plan:3,task:task.into(),checks:vec![]});}
        let before=std::fs::read(root.join("state.json")).unwrap();
        let before_decisions=std::fs::read(root.join("decisions.jsonl")).unwrap();
        for (mut invalid,rule) in [(extension.clone(),"admission-set-version"),(extension.clone(),"admission-plan-set"),(extension.clone(),"admission-reassignment")] {
            match rule {
                "admission-set-version"=>invalid.expected_set_version=0,
                "admission-plan-set"=>{invalid.contract.plans.pop();},
                _=>{invalid.contract.allocation[4].checks=invalid.contract.allocation[0].checks.clone();invalid.contract.allocation[0].checks.clear();}
            }
            let error=store.request(Operation::NativeAdmissionV1 {expected_generation:view.snapshot.generation,expected_integrity:view.snapshot.integrity.clone(),request:Box::new(invalid)}).await.unwrap_err();
            assert!(error.to_string().contains(rule),"{error}");
            assert_eq!(std::fs::read(root.join("state.json")).unwrap(),before);
            assert_eq!(std::fs::read(root.join("decisions.jsonl")).unwrap(),before_decisions);
        }
        // Changed installed bytes between preparation and owned validation.
        let path=root.join("phases/12/PLAN-3.md"); let bytes=std::fs::read(&path).unwrap();
        std::fs::write(&path,[bytes.as_slice(),b"\n"].concat()).unwrap();
        let error=store.request(Operation::NativeAdmissionV1 {expected_generation:view.snapshot.generation,expected_integrity:view.snapshot.integrity.clone(),request:Box::new(extension.clone())}).await.unwrap_err();
        assert!(error.to_string().contains("installed-plan"),"{error}");
        std::fs::write(&path,bytes).unwrap();
        // The intent's own installed-byte reobservation catches a filesystem
        // change after validation and preparation, before any confirmed write.
        drop(store);
        let drift_path=path.clone();
        let filesystem=Filesystem::new(&root).unwrap().with_probe(move |stage,path| {
            if stage==crate::store::filesystem::Stage::Prepared && path.file_name().is_some_and(|n|n==".store-intent.json") {
                use std::io::Write;
                std::fs::OpenOptions::new().append(true).open(&drift_path)?.write_all(b"\n")?;
            }
            Ok(())
        });
        let store=Store::open(filesystem,PlanningPolicy).await.unwrap();
        let bytes=std::fs::read(&path).unwrap();
        let error=store.request(Operation::NativeAdmissionV1 {expected_generation:view.snapshot.generation,expected_integrity:view.snapshot.integrity.clone(),request:Box::new(extension.clone())}).await.unwrap_err();
        assert!(error.to_string().contains("admission-inputs-changed"),"{error}");
        drop(store);
        std::fs::write(&path,bytes).unwrap();
        assert!(!root.join(".store-intent.json").exists());
        assert_eq!(std::fs::read(root.join("state.json")).unwrap(),before);
        assert_eq!(std::fs::read(root.join("decisions.jsonl")).unwrap(),before_decisions);
        let store=Store::open(Filesystem::new(&root).unwrap(),PlanningPolicy).await.unwrap();
        let view=store.request(Operation::NativeAdmissionV1 {expected_generation:view.snapshot.generation,expected_integrity:view.snapshot.integrity.clone(),request:Box::new(extension.clone())}).await.unwrap();
        let records=admission::records(&view.snapshot.data,12).unwrap();
        assert_eq!(records.len(),2); assert_eq!(records[1].set_version,2);
        assert_eq!(serde_json::to_vec(&records[0]).unwrap(),raw_record);
        assert!(std::fs::read(root.join("decisions.jsonl")).unwrap().starts_with(&before_decisions));
        let before=std::fs::read(root.join("state.json")).unwrap();
        drop(store); assert!(!root.join(".store-intent.json").exists());
        let store=Store::open(Filesystem::new(&root).unwrap(),PlanningPolicy).await.unwrap();
        for request in [first,extension] {
            let replay=store.request(Operation::NativeAdmissionV1 {expected_generation:0,expected_integrity:"old".into(),request:Box::new(request)}).await.unwrap();
            assert_eq!(admission::records(&replay.snapshot.data,12).unwrap(),records);
            assert_eq!(std::fs::read(root.join("state.json")).unwrap(),before);
        }
    });
}

#[test]
fn native_records_outlive_the_directory_identity_they_were_stamped_with() {
    // A reboot or restore gives .planning new device and inode numbers at the
    // same path. The records a store retains were stamped under the old
    // identity; the identity is provenance, never a key the next process must
    // reproduce, so admissions, task events and plan events still bind.
    use super::{admission, history::{self, Event, Request, Task}};
    let (data, documents, contract) = native_unit_contract("custom-delivery-check");
    let before_reboot = "46:302462;46:302461;46:1;36:256;";
    let after_reboot = "46:302568;46:302566;46:1;36:256;";
    let admit = admission::Request { request_id: "admit".into(), expected_set_version: 0, contract };
    let (data, basis) = admission::contribute(&data, &documents, before_reboot, &admit).unwrap();
    assert_eq!(basis.root_binding, before_reboot);
    assert_eq!(admission::replay(&data, &admit).unwrap(), Some(basis.clone()));
    let task = Task { phase: 12, occurrence: "active-cycle:phase:12".into(), admission_digest: basis.request_digest.clone(),
        plan: 1, task: "deliver".into() };
    let check = basis.request.contract.allocation[0].checks[0].clone();
    let start = Request { request_id: "event-0".into(), task: task.clone(), attempt: "attempt-1".into(), expected_version: 0,
        event: Event::Attempt { predecessor: None, checks: vec![check], base_commit: "unit-base".into() } };
    let (data, event) = history::contribute(&data, after_reboot, &start).unwrap();
    assert_eq!(event.root_binding, after_reboot);
    assert_eq!(history::replay(&data, &start).unwrap(), Some(event));
}

#[test]
fn native_task_records_replay_confirmed_events() {
    use super::{admission, history::{self, Event, Request, Task}, receipts::*};
    use crate::store::{filesystem::{Filesystem, Stage as FsStage}, writer::{Store, Operation, PlanningPolicy}};
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join(".planning");
        std::fs::create_dir_all(root.join("phases/12")).unwrap();
        let (data, documents, contract) = native_unit_contract("custom-delivery-check");
        for (path, bytes) in documents { std::fs::write(root.join(path), bytes).unwrap(); }
        let store = Store::open(Filesystem::new(&root).unwrap(), PlanningPolicy).await.unwrap();
        let view = store.request(Operation::RewriteSnapshot(data)).await.unwrap();
        let view = store.request(Operation::NativeAdmissionV1 {
            expected_generation: view.snapshot.generation, expected_integrity: view.snapshot.integrity,
            request: Box::new(admission::Request { request_id: "admit".into(), expected_set_version: 0, contract }),
        }).await.unwrap();
        let basis = admission::records(&view.snapshot.data, 12).unwrap().remove(0);
        let task = Task { phase: 12, occurrence: "active-cycle:phase:12".into(), admission_digest: basis.request_digest,
            plan: 1, task: "deliver".into() };
        let check = basis.request.contract.allocation[0].checks[0].clone();
        let result = RunResult { run_id: "run-1".into(), disposition: Disposition::Exited { code: 1 },
            stdout: Capture::new(b"answer: expected 7, received 6\n".to_vec(), true, vec![]),
            stderr: Capture::new(vec![], true, vec![]), observed_at: 20,
            observation: Observation::Unknown, material_unchanged: true };
        let inspection = Inspection { check: check.clone(), test_digest: "unit-test-material".into(),
            evidence: vec!["run-1".into()], no_subject_stub: false };
        let classification = Classification { run_id: "run-1".into(), output_identity: result.output_identity(),
            check: check.clone(), interpretation: Interpretation::RedEligible };
        let events = vec![
            Event::Attempt { predecessor: None, checks: vec![check.clone()], base_commit: "unit-base".into() },
            Event::FailedAttempt { reason: "first attempt stopped".into(), evidence: vec!["owner stop".into()] },
            Event::Attempt { predecessor: Some("attempt-1".into()), checks: vec![check.clone()], base_commit: "unit-base".into() },
            Event::Launch(Launch { run_id: "run-1".into(), check: Some(check), stage: Stage::Red,
                material: Material { commit: "unit-red".into(), tree: "unit-tree".into(), test_file: "test.py".into(),
                    test_digest: "unit-test-material".into(), command: "custom-delivery-check".into() }, launched_at: 10 }),
            Event::Result(result),
            Event::OwnerStatement(OwnerStatement { submission: inspection.clone(), supersedes: None,
                approval: OwnerApproval { approved: true, owner: "Fixture Owner".into(), at: "2026-09-10T14:00:00Z".into(), submission: inspection } }),
            Event::OwnerClassification(OwnerClassification { submission: classification.clone(),
                approval: OwnerApproval { approved: true, owner: "Fixture Owner".into(), at: "2026-09-10T14:01:00Z".into(), submission: classification } }),
            Event::Progress { text: "subject still returns six".into(), evidence: vec!["run-1".into()] },
            Event::Deviation { text: "owner interpretation required for custom output".into(), evidence: vec!["run-1".into()] },
        ];
        let requests: Vec<_> = events.into_iter().enumerate().map(|(i, event)| Request {
            request_id: format!("event-{i}"), task: task.clone(), attempt: if i < 2 { "attempt-1" } else { "attempt-2" }.into(),
            expected_version: i as u64, event,
        }).collect();
        drop(store);
        for (i, request) in requests.iter().enumerate() {
            let store = Store::open(Filesystem::new(&root).unwrap(), PlanningPolicy).await.unwrap();
            let view = store.request(Operation::ReadVerified).await.unwrap();
            let old = history::records(&view.snapshot.data, 12).unwrap();
            let view = store.request(Operation::NativeTaskV1 { expected_generation: view.snapshot.generation,
                expected_integrity: view.snapshot.integrity, request: Box::new(request.clone()) }).await.unwrap();
            let records = history::records(&view.snapshot.data, 12).unwrap();
            assert_eq!(&records[..i], old);
            assert_eq!(records[i].request, *request);
            assert_eq!(records[i].version, i as u64 + 1);
            assert_eq!(records[i].schema, "native-task-event-1");
            assert!(!history::project(&records, &task).completed);
            let baseline = ["state.json", "decisions.jsonl", "items.jsonl"].map(|p| std::fs::read(root.join(p)).unwrap());
            drop(store);
            assert!(!root.join(".store-intent.json").exists());
            let store = Store::open(Filesystem::new(&root).unwrap(), PlanningPolicy).await.unwrap();
            let replay = store.request(Operation::NativeTaskV1 { expected_generation: 0, expected_integrity: "stale".into(),
                request: Box::new(request.clone()) }).await.unwrap();
            assert_eq!(replay, view);
            assert_eq!(history::replay(&replay.snapshot.data, request).unwrap(), Some(records[i].clone()));
            let mut changed = request.clone();
            changed.event = Event::Progress { text: "changed payload".into(), evidence: vec![] };
            assert!(store.request(Operation::NativeTaskV1 { expected_generation: 0, expected_integrity: "stale".into(),
                request: Box::new(changed.clone()) }).await.unwrap_err().to_string().contains("task-request-reuse"));
            changed.request_id = format!("stale-{i}");
            assert!(store.request(Operation::NativeTaskV1 { expected_generation: view.snapshot.generation,
                expected_integrity: view.snapshot.integrity, request: Box::new(changed) }).await.unwrap_err().to_string().contains("task-version"));
            drop(store);
            assert_eq!(["state.json", "decisions.jsonl", "items.jsonl"].map(|p| std::fs::read(root.join(p)).unwrap()), baseline);
        }
        // Interrupt confirmation after durable rename. Reopening must validate
        // and finish the actual versioned intent, not reconstruct an event.
        let filesystem = Filesystem::new(&root).unwrap().with_probe(|stage, path| {
            if stage == FsStage::Confirmation && path.file_name().is_some_and(|p| p == "state.json") {
                return Err(crate::store::Error::Io("interrupted native confirmation".into()));
            }
            Ok(())
        });
        let store = Store::open(filesystem, PlanningPolicy).await.unwrap();
        let view = store.request(Operation::ReadVerified).await.unwrap();
        let request = Request { request_id: "lost-reply".into(), task: task.clone(), attempt: "attempt-2".into(),
            expected_version: 9, event: Event::Progress { text: "repair awaiting approval".into(), evidence: vec!["run-1".into()] } };
        assert!(store.request(Operation::NativeTaskV1 { expected_generation: view.snapshot.generation,
            expected_integrity: view.snapshot.integrity, request: Box::new(request.clone()) }).await.unwrap_err().to_string().contains("interrupted native confirmation"));
        drop(store);
        assert!(root.join(".store-intent.json").exists());
        let baseline = std::fs::read(root.join("state.json")).unwrap();
        let store = Store::open(Filesystem::new(&root).unwrap(), PlanningPolicy).await.unwrap();
        let view = store.request(Operation::NativeTaskV1 { expected_generation: 0, expected_integrity: "stale".into(), request: Box::new(request) }).await.unwrap();
        let records = history::records(&view.snapshot.data, 12).unwrap();
        assert_eq!(records.len(), 10);
        assert_eq!(history::project(&records, &task), history::Projection { version: 10, attempt: Some("attempt-2".into()), completed: false,
            progress: vec!["subject still returns six".into(), "repair awaiting approval".into()], unknown_runs: vec![] });
        assert_eq!(std::fs::read(root.join("state.json")).unwrap(), baseline);
        assert!(!root.join(".store-intent.json").exists());
    });
}

#[test]
fn native_runner_claims_before_spawn_and_replays_once() {
    use super::{admission, history::{self, Task}, runner::{self, Start, Run}, receipts::*};
    use crate::store::{filesystem::Filesystem, writer::{Store, Operation, PlanningPolicy}, model::digest};
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let temp = tempfile::tempdir().unwrap(); let project = temp.path(); let root = project.join(".planning");
        std::fs::create_dir_all(root.join("phases/12")).unwrap();
        std::fs::create_dir_all(project.join("tests")).unwrap();
        std::fs::create_dir_all(project.join(".runner")).unwrap();
        std::fs::write(project.join(".gitignore"), ".planning/\n.runner/\n").unwrap();
        // A real controlled program inspects its confirmed launch before doing
        // work, then waits for this test's filesystem handshake.
        std::fs::write(project.join("tests/not_yet_written.rs"), "import json,pathlib,time\nr=pathlib.Path('.runner')\nrun=(r/'run').read_text()\ns=json.loads(pathlib.Path('.planning/state.json').read_text())\nassert any(e['request']['event'].get('run_id')==run for e in s['data']['native_tasks']['phases']['12'])\nwith (r/'markers').open('a') as f: f.write(run+'\\n')\nwhile not (r/'release').exists(): time.sleep(.01)\nmode=(r/'mode').read_text()\nif mode=='custom': print('custom output')\nelif mode=='error':\n import sys\n print('Ran 1 test in 0.000s\\nFAILED (errors=1)',file=sys.stderr)\n sys.exit(1)\nelse: print('test result: ok. 1 passed; 0 failed;')\n").unwrap();
        let git = |args: &[&str]| {
            let output = Command::new("git").args(["-c", "commit.gpgsign=false", "-c", "user.name=Cadence-Phase12", "-c", "user.email=phase12@example.invalid"])
                .args(args).current_dir(project).stdin(std::process::Stdio::null()).output().unwrap();
            assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
            String::from_utf8(output.stdout).unwrap().trim().to_owned()
        };
        git(&["init", "--initial-branch=fixture/runner"]); git(&["add", ".gitignore", "tests"]); git(&["commit", "-m", "Fixture runner"]);
        let head = git(&["rev-parse", "HEAD"]); let tree = git(&["rev-parse", "HEAD^{tree}"]);
        let command = "python3 tests/not_yet_written.rs";
        let (data, documents, contract) = native_unit_contract(command);
        for (path, bytes) in documents { std::fs::write(root.join(path), bytes).unwrap(); }
        let store = Store::open(Filesystem::new(&root).unwrap(), PlanningPolicy).await.unwrap();
        let view = store.request(Operation::RewriteSnapshot(data)).await.unwrap();
        let view = store.request(Operation::NativeAdmissionV1 { expected_generation: view.snapshot.generation,
            expected_integrity: view.snapshot.integrity, request: Box::new(admission::Request { request_id: "admit-runner".into(), expected_set_version: 0, contract }) }).await.unwrap();
        let basis = admission::records(&view.snapshot.data, 12).unwrap().remove(0);
        let task = Task { phase: 12, occurrence: "active-cycle:phase:12".into(), admission_digest: basis.request_digest, plan: 1, task: "deliver".into() };
        let checks = basis.request.contract.allocation[0].checks.clone();
        let start = Start { request_id: "start".into(), task: task.clone(), attempt: "attempt".into(), expected_version: 0, predecessor: None, checks: checks.clone() };
        let started = runner::start(&store, project, start.clone()).await.unwrap();
        assert_eq!(runner::start(&store, project, start).await.unwrap(), started);
        let mut version = 1;
        for (id, mode, expected_stdout, expected_stderr, disposition, expected_observation) in [
            ("cargo-run", "cargo", "test result: ok. 1 passed; 0 failed;\n", "", Disposition::Exited { code: 0 }, Observation::ResultsObserved { summary: Summary::Cargo { failed: false } }),
            ("custom-run", "custom", "custom output\n", "", Disposition::Exited { code: 0 }, Observation::Unknown),
            ("error-run", "error", "", "Ran 1 test in 0.000s\nFAILED (errors=1)\n", Disposition::Exited { code: 1 }, Observation::ResultsObserved { summary: Summary::Unittest { failed: true, failures: 0, errors: 1 } }),
        ] {
            let _ = std::fs::remove_file(project.join(".runner/release"));
            std::fs::write(project.join(".runner/run"), id).unwrap(); std::fs::write(project.join(".runner/mode"), mode).unwrap();
            let input = Run { request_id: id.into(), task: task.clone(), attempt: "attempt".into(), expected_version: version,
                command: command.into(), check: Some(checks[0].clone()), stage: Stage::Red };
            let claim = runner::launch(store.clone(), project.to_path_buf(), input.clone()).await.unwrap();
            let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
            while !std::fs::read_to_string(project.join(".runner/markers")).unwrap_or_default().lines().any(|line| line == id) {
                assert!(std::time::Instant::now() < deadline, "child did not observe confirmed claim");
                tokio::time::sleep(std::time::Duration::from_millis(10)).await;
            }
            let live = tokio::time::timeout(std::time::Duration::from_secs(1), store.request(Operation::ReadVerified)).await.unwrap().unwrap();
            assert_eq!(history::project(&history::records(&live.snapshot.data, 12).unwrap(), &task).unknown_runs, vec![id.to_owned()]);
            assert_eq!(runner::launch(store.clone(), project.to_path_buf(), input.clone()).await.unwrap(), claim);
            std::fs::write(project.join(".runner/release"), "continue").unwrap();
            let result = loop {
                let view = store.request(Operation::ReadVerified).await.unwrap();
                if let Some(result) = history::records(&view.snapshot.data, 12).unwrap().into_iter().find_map(|r| match r.request.event {
                    history::Event::Result(result) if result.run_id == id => Some(result), _ => None,
                }) { break result }
                assert!(std::time::Instant::now() < deadline, "result not retained");
                tokio::time::sleep(std::time::Duration::from_millis(10)).await;
            };
            assert_eq!(result.stdout.bytes, expected_stdout.as_bytes()); assert_eq!(result.stderr.bytes, expected_stderr.as_bytes());
            assert_eq!(result.stdout.digest, digest(expected_stdout.as_bytes())); assert_eq!(result.stderr.digest, digest(expected_stderr.as_bytes()));
            assert!(result.stdout.complete && result.stderr.complete && result.material_unchanged);
            assert_eq!(result.observation, expected_observation); assert_eq!(result.disposition, disposition);
            let history::Event::Launch(launch) = &claim.request.event else { panic!("launch required") };
            assert_eq!(launch.material.commit, head); assert_eq!(launch.material.tree, tree); assert_eq!(launch.material.command, command);
            assert!(launch.launched_at > 0 && result.observed_at >= launch.launched_at);
            assert_eq!(runner::launch(store.clone(), project.to_path_buf(), input.clone()).await.unwrap(), claim);
            version += 2;
            let mut replacement = input.clone(); replacement.request_id = format!("{id}-replacement"); replacement.expected_version = version;
            replacement.command = "printf caller-replacement".into();
            assert!(runner::launch(store.clone(), project.to_path_buf(), replacement).await.unwrap_err().to_string().contains("named-command"));
        }
        let markers = std::fs::read_to_string(project.join(".runner/markers")).unwrap();
        assert_eq!(markers, "cargo-run\ncustom-run\nerror-run\n");
        std::fs::write(project.join("dirty-source"), "uncommitted").unwrap();
        assert!(runner::launch(store.clone(), project.to_path_buf(), Run { request_id: "dirty-run".into(), task,
            attempt: "attempt".into(), expected_version: version, command: command.into(), check: Some(checks[0].clone()), stage: Stage::Red }).await.unwrap_err().to_string().contains("evidence-source-dirty"));
        assert_eq!(std::fs::read_to_string(project.join(".runner/markers")).unwrap(), markers);
        let baseline = std::fs::read(root.join("state.json")).unwrap();
        drop(store);
        let store = Store::open(Filesystem::new(&root).unwrap(), PlanningPolicy).await.unwrap();
        assert_eq!(history::records(&store.request(Operation::ReadVerified).await.unwrap().snapshot.data,12).unwrap().len(), 7);
        assert_eq!(std::fs::read(root.join("state.json")).unwrap(), baseline);
    });
}

#[test]
fn native_owner_statements_bind_exact_inspection() {
    use super::{admission, history::{self, Event, Task, Request}, receipts::*, runner};
    use crate::store::{filesystem::Filesystem, writer::{Store, Operation, PlanningPolicy}};
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let temp = tempfile::tempdir().unwrap(); let root = temp.path().join(".planning");
        std::fs::create_dir_all(root.join("phases/12")).unwrap();
        let (data, documents, contract) = native_unit_contract("custom-delivery-check");
        for (path, bytes) in documents { std::fs::write(root.join(path), bytes).unwrap(); }
        let store = Store::open(Filesystem::new(&root).unwrap(), PlanningPolicy).await.unwrap();
        let view = store.request(Operation::RewriteSnapshot(data)).await.unwrap();
        let view = store.request(Operation::NativeAdmissionV1 { expected_generation: view.snapshot.generation, expected_integrity: view.snapshot.integrity,
            request: Box::new(admission::Request { request_id: "admit-owner".into(), expected_set_version: 0, contract }) }).await.unwrap();
        let basis = admission::records(&view.snapshot.data, 12).unwrap().remove(0);
        let task = Task { phase: 12, occurrence: "active-cycle:phase:12".into(), admission_digest: basis.request_digest, plan: 1, task: "deliver".into() };
        let check = basis.request.contract.allocation[0].checks[0].clone();
        let request = |id: &str, version, event| Request { request_id: id.into(), task: task.clone(), attempt: "attempt".into(), expected_version: version, event };
        runner::append(&store, request("start", 0, Event::Attempt { predecessor: None, checks: vec![check.clone()], base_commit: "unit-base".into() })).await.unwrap();
        runner::append(&store, request("launch", 1, Event::Launch(Launch { run_id: "inspected-run".into(), check: Some(check.clone()), stage: Stage::Red,
            material: Material { commit: "unit-commit".into(), tree: "unit-tree".into(), test_file: "test.py".into(), test_digest: "inspected-material".into(), command: "custom-delivery-check".into() }, launched_at: 10 }))).await.unwrap();
        runner::append(&store, request("result", 2, Event::Result(RunResult { run_id: "inspected-run".into(), disposition: Disposition::Exited { code: 1 },
            stdout: Capture::new(b"custom failed\n".to_vec(), true, vec![]),
            stderr: Capture::new(vec![], true, vec![]), observed_at: 20, observation: Observation::Unknown, material_unchanged: true }))).await.unwrap();
        let inspection = Inspection { check: check.clone(), test_digest: "inspected-material".into(), evidence: vec!["inspected-run".into()], no_subject_stub: false };
        let negative = OwnerStatement { submission: inspection.clone(), approval: OwnerApproval { approved: true, owner: "Fixture Owner".into(),
            at: "2026-09-10T14:00:00Z".into(), submission: inspection }, supersedes: None };
        let first = request("negative", 3, Event::OwnerStatement(negative.clone()));
        let first_receipt = runner::append(&store, first.clone()).await.unwrap();
        assert!(!owner_eligible(&negative, &check, "inspected-material", &["inspected-run".into()]));
        let baseline = ["state.json", "decisions.jsonl"].map(|p| std::fs::read(root.join(p)).unwrap());
        for (i, mut invalid) in (0..5).map(|i| (i, negative.clone())) {
            match i {
                0 => invalid.approval.approved = false,
                1 => invalid.approval.owner.clear(),
                2 => invalid.submission.no_subject_stub = true,
                3 => { invalid.submission.test_digest = "stale-material".into(); invalid.approval.submission = invalid.submission.clone(); }
                _ => { invalid.submission.evidence = vec!["another-run".into()]; invalid.approval.submission = invalid.submission.clone(); }
            }
            assert!(runner::append(&store, request(&format!("invalid-{i}"), 4, Event::OwnerStatement(invalid))).await.unwrap_err().to_string().contains("owner-inspection"));
            assert_eq!(["state.json", "decisions.jsonl"].map(|p| std::fs::read(root.join(p)).unwrap()), baseline);
        }
        let wire = json!({"operation":"execution-owner-attest","request":{"request_id":"executor","task":task,"attempt":"attempt","expected_version":4,
            "statement":{"submission":negative.submission,"supersedes":null,"no_stub":true,"role":"owner"}}});
        assert!(serde_json::from_value::<OwnerApply>(wire).is_err(), "an executor boolean and self-assigned role cannot replace exact approval");
        let mut affirmative = negative.clone(); affirmative.submission.no_subject_stub = true;
        affirmative.approval.submission = affirmative.submission.clone(); affirmative.approval.at = "2026-09-10T14:05:00Z".into();
        affirmative.supersedes = Some("negative".into());
        let second = request("affirmative", 4, Event::OwnerStatement(affirmative.clone()));
        let second_receipt = runner::append(&store, second.clone()).await.unwrap();
        assert!(owner_eligible(&affirmative, &check, "inspected-material", &["inspected-run".into()]));
        assert!(!owner_eligible(&affirmative, &check, "stale-material", &["inspected-run".into()]));
        assert!(!owner_eligible(&affirmative, &check, "inspected-material", &["another-run".into()]));
        let baseline = ["state.json", "decisions.jsonl"].map(|p| std::fs::read(root.join(p)).unwrap());
        drop(store);
        let store = Store::open(Filesystem::new(&root).unwrap(), PlanningPolicy).await.unwrap();
        assert_eq!(runner::append(&store, first).await.unwrap(), first_receipt);
        assert_eq!(runner::append(&store, second).await.unwrap(), second_receipt);
        let view = store.request(Operation::ReadVerified).await.unwrap();
        let records = history::records(&view.snapshot.data, 12).unwrap();
        assert_eq!(records[3].request.event, Event::OwnerStatement(negative));
        assert_eq!(records[4].request.event, Event::OwnerStatement(affirmative));
        assert_eq!(["state.json", "decisions.jsonl"].map(|p| std::fs::read(root.join(p)).unwrap()), baseline);
    });
}

#[test]
fn native_material_includes_scoped_evidence_commits() {
    use super::{admission, history::Task, receipts, dispatch::build_dispatch};
    use crate::{rail::risk, store::{filesystem::Filesystem, writer::{Store, Operation, PlanningPolicy}, model::digest}};
    use std::os::unix::fs::PermissionsExt;
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let temp = tempfile::tempdir().unwrap(); let project = temp.path().join("repo"); let root = project.join(".planning");
        std::fs::create_dir_all(root.join("phases/12")).unwrap(); std::fs::create_dir_all(project.join("src")).unwrap();
        let home = temp.path().join("gnupg"); std::fs::create_dir(&home).unwrap(); std::fs::set_permissions(&home, std::fs::Permissions::from_mode(0o700)).unwrap();
        let output = Command::new("gpg").env("GNUPGHOME", &home).args(["--batch", "--pinentry-mode", "loopback", "--passphrase", "", "--quick-generate-key",
            "Cadence-Phase12 <phase12@example.invalid>", "ed25519", "sign", "0"]).stdin(std::process::Stdio::null()).output().unwrap();
        assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
        let wrapper = temp.path().join("gpg-fixture");
        std::fs::write(&wrapper, format!("#!/bin/sh\nexec gpg --homedir '{}' \"$@\"\n", home.to_str().unwrap().replace('\'', "'\\''"))).unwrap();
        std::fs::set_permissions(&wrapper, std::fs::Permissions::from_mode(0o700)).unwrap();
        let git = |args: &[&str]| {
            let output = Command::new("git").args(["-c", "commit.gpgsign=false", "-c", "user.name=Cadence-Phase12", "-c", "user.email=phase12@example.invalid"])
                .args(args).env("GNUPGHOME", &home).env("GIT_CONFIG_GLOBAL", "/dev/null").env("GIT_CONFIG_NOSYSTEM", "1")
                .current_dir(&project).stdin(std::process::Stdio::null()).output().unwrap();
            assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr)); String::from_utf8(output.stdout).unwrap().trim().to_owned()
        };
        git(&["init", "--initial-branch=fixture/material"]); git(&["config", "gpg.program", wrapper.to_str().unwrap()]);
        git(&["config", "user.signingkey", "phase12@example.invalid"]);
        std::fs::write(project.join(".gitignore"), ".planning/\n").unwrap();
        std::fs::write(project.join("src/delivery.rs"), "answer six\n").unwrap();
        std::fs::write(project.join("outside.txt"), "rename material with enough bytes to detect exactly\n").unwrap();
        git(&["add", ".gitignore", "src/delivery.rs", "outside.txt"]); git(&["commit", "-m", "Fixture base"]);
        let base = git(&["rev-parse", "HEAD"]);
        std::fs::write(project.join("test.py"), "assert answer() == 7\n").unwrap();
        git(&["add", "test.py"]); git(&["commit", "-m", "test(12): failing assertion deliver"]);
        let red = git(&["rev-parse", "HEAD"]);
        std::fs::write(project.join("src/delivery.rs"), "answer seven\n").unwrap();
        git(&["add", "src/delivery.rs"]); git(&["commit", "-S", "-m", "feat(12): correct answer deliver"]);
        let green = git(&["rev-parse", "HEAD"]);
        let (data, documents, contract) = native_unit_contract("custom-delivery-check");
        for (path, bytes) in &documents { std::fs::write(root.join(path), bytes).unwrap(); }
        let store = Store::open(Filesystem::new(&root).unwrap(), PlanningPolicy).await.unwrap();
        let view = store.request(Operation::RewriteSnapshot(data)).await.unwrap();
        let view = store.request(Operation::NativeAdmissionV1 { expected_generation: view.snapshot.generation, expected_integrity: view.snapshot.integrity,
            request: Box::new(admission::Request { request_id: "admit-material".into(), expected_set_version: 0, contract: contract.clone() }) }).await.unwrap();
        let basis = admission::records(&view.snapshot.data, 12).unwrap().remove(0);
        let task = Task { phase: 12, occurrence: contract.occurrence.clone(), admission_digest: basis.request_digest, plan: 1, task: "deliver".into() };
        let mut plan = parse_plan(documents["phases/12/PLAN-1.md"].as_bytes(), 12, 1).unwrap();
        // Unit dispatch authority explicitly leases the test and rename target.
        plan.files.extend(["test.py".into(), "src/renamed.rs".into()]);
        let active = build_dispatch(&plan, &digest(b"original-set"), 0, &base).unwrap();
        let material = receipts::observe_source(&project, &active, "deliver", &green, std::slice::from_ref(&red)).unwrap();
        let in_lease = serde_json::to_value(&material).unwrap();
        assert!(in_lease["out_of_lease"].is_null() || in_lease["out_of_lease"] == json!({}), "in-lease evidence records no deviation: {in_lease}");
        assert_eq!(material.commit_paths[&red], vec!["test.py"]); assert_eq!(material.commit_paths[&green], vec!["src/delivery.rs"]);
        assert_eq!(material.staged_objects, Vec::<u8>::new()); assert_eq!(material.staged_paths, Vec::<String>::new());
        let native = risk::NativeExecutionBasis::new(&active, task, material.clone(), digest(b"unit-close-material")).unwrap();
        assert_eq!(native.execution.commits, vec![red.clone(), green.clone()]);
        assert_eq!(native.material(), risk::MaterialIdentity::Committed { base_id: base.clone(), head_id: green.clone() });
        let data = risk::project_native_execution_basis(&view.snapshot.data, &native).unwrap();
        let view = store.request(Operation::CompareRewriteSnapshot { expected_generation: view.snapshot.generation, expected_integrity: view.snapshot.integrity, data }).await.unwrap();
        let retained = serde_json::to_vec(&risk::native_execution_bases(&view.snapshot.data).unwrap()).unwrap();
        // A real approved gap publication and admission extension preserve the
        // material's original task/admission/dispatch identity.
        let inventory = crate::plan::inventory::read(&root, "12", &view.snapshot.data).unwrap();
        let mut content = crate::plan::persistence::saved(&view.snapshot.data,12).unwrap().unwrap().publications[&1].content.clone();
        content.plan = 3.try_into().unwrap();
        let submission = crate::plan::model::Submission { phase: 12.try_into().unwrap(), occurrence: contract.occurrence.clone(), request_id: "material-gap".into(),
            inventory_basis: inventory.basis.clone(), plans: vec![crate::plan::model::Entry { target: crate::plan::model::Identity { phase: 12.try_into().unwrap(), plan: 3.try_into().unwrap() }, content, replacement: None }] };
        let approval = crate::plan::model::Approval { approved: true, owner: Some("Fixture Owner".into()), at: Some("2026-09-10T15:00:00Z".into()), submission: Some(submission.clone()), submission_digest: None };
        let (next, publications) = crate::plan::persistence::contribute(&view.snapshot.data, &submission, &approval, &inventory).unwrap();
        let publication = &publications[0];
        let view = store.request(Operation::CompareTransact { expected_generation: view.snapshot.generation, expected_integrity: view.snapshot.integrity,
            transaction: crate::store::transaction::Transaction { id: "gap-publication".into(), items: vec![], decisions: vec![], snapshot: Some(next),
                external: vec![crate::store::transaction::ExternalChange { target: "phase-plan:12:3".into(),
                    expected: crate::store::Storage::read(&mut Filesystem::new(&root).unwrap(), "phase-plan:12:3").unwrap(), bytes: crate::plan::render::document(&publication.content).unwrap() }] } }).await.unwrap();
        let mut extended = contract;
        extended.plans.push(admission::Binding { plan: 3, publication_request: "material-gap".into(), content_revision: publication.revision.clone(), map_revision: publication.map_revision.clone().unwrap() });
        for task in ["deliver", "document"] { extended.allocation.push(super::allocation::Assignment { plan: 3, task: task.into(), checks: vec![] }); }
        store.request(Operation::NativeAdmissionV1 { expected_generation: view.snapshot.generation, expected_integrity: view.snapshot.integrity,
            request: Box::new(admission::Request { request_id: "extend-material".into(), expected_set_version: 1, contract: extended }) }).await.unwrap();
        drop(store);
        let store = Store::open(Filesystem::new(&root).unwrap(), PlanningPolicy).await.unwrap();
        let view = store.request(Operation::ReadVerified).await.unwrap();
        assert_eq!(serde_json::to_vec(&risk::native_execution_bases(&view.snapshot.data).unwrap()).unwrap(), retained);
        assert_eq!(admission::records(&view.snapshot.data, 12).unwrap().len(), 2);
        std::fs::write(project.join("src/delivery.rs"), "staged correction\n").unwrap(); git(&["add", "src/delivery.rs"]);
        assert!(receipts::reobserve_source(&project, &active, "deliver", &material).unwrap_err().to_string().contains("staged inputs changed"));
        git(&["reset", "--hard", &green]);
        std::fs::write(project.join("outside.txt"), "changed outside lease\n").unwrap(); git(&["add", "outside.txt"]); git(&["commit", "-m", "test(12): evidence outside lease"]);
        let outside = git(&["rev-parse", "HEAD"]);
        let widened = receipts::observe_source(&project, &active, "deliver", &green, &[red.clone(), outside.clone()]).unwrap();
        assert_eq!(serde_json::to_value(&widened).unwrap()["out_of_lease"], json!({outside.clone(): ["outside.txt"]}),
            "a committed path outside the lease is retained by commit, never refused (D-170)");
        assert_eq!(widened.commit_paths[&outside], vec!["outside.txt"]);
        git(&["reset", "--hard", &green]); git(&["mv", "outside.txt", "src/renamed.rs"]); git(&["commit", "-m", "test(12): rename evidence"]);
        let rename = git(&["rev-parse", "HEAD"]);
        assert_eq!(receipts::commit_paths(&project, &rename).unwrap(), vec!["outside.txt", "src/renamed.rs"]);
        let renamed = receipts::observe_source(&project, &active, "deliver", &green, &[red, rename.clone()]).unwrap();
        assert_eq!(serde_json::to_value(&renamed).unwrap()["out_of_lease"], json!({rename: ["outside.txt"]}),
            "a rename names its out-of-lease source; its in-lease destination is not a deviation");
        assert_eq!(git(&["show", &format!("{green}:src/delivery.rs")]), "answer seven");
    });
}

fn schema_fixture() -> serde_json::Value {
    json!({
        "schema": 1, "kind": "executor", "dispatch_id": "dispatch-1",
        "expected_execution_version": 1, "outcome": "blocked",
        "tasks": [
            {"status":"completed","task_id":"T1","commit":"abc",
             "verification":{"disposition":"passed","commands":[
                 {"command":"verify","exit_code":0,"output_digest":"digest"}]},
             "evidence":[{"kind":"commit","sha":"abc"},
                 {"kind":"file-line","path":"src/a.rs","line":1},
                 {"kind":"criterion","id":"AC1"}]},
            {"status":"blocked","task_id":"T2","blocker_id":"B1"},
            {"status":"not-run","task_id":"T3"}
        ],
        "deviations":[{"id":"D1","text":"judgment","evidence":[{"kind":"criterion","id":"AC1"}]}],
        "blockers":[{"id":"B1","text":"judgment","evidence":[{"kind":"file-line","path":"src/a.rs","line":2}]}]
    })
}

fn resolve_schema<'a>(
    root: &'a serde_json::Value,
    node: &'a serde_json::Value,
) -> &'a serde_json::Value {
    match node.get("$ref") {
        Some(reference) => resolve_schema(
            root,
            root.pointer(reference.as_str().unwrap().strip_prefix('#').unwrap())
                .unwrap(),
        ),
        None => node,
    }
}

// Evaluate only the structural keywords generated for this contract. Field
// inventories below also check each independently authored object in full.
fn schema_accepts(
    root: &serde_json::Value,
    node: &serde_json::Value,
    value: &serde_json::Value,
) -> bool {
    let node = resolve_schema(root, node);
    if let Some(variants) = node.get("oneOf") {
        return variants
            .as_array()
            .unwrap()
            .iter()
            .filter(|variant| schema_accepts(root, variant, value))
            .count()
            == 1;
    }
    if node.get("const").is_some_and(|expected| expected != value)
        || node
            .get("enum")
            .is_some_and(|values| !values.as_array().unwrap().contains(value))
    {
        return false;
    }
    match node.get("type").and_then(|value| value.as_str()) {
        Some("object") => value.as_object().is_some_and(|object| {
            let properties = node["properties"].as_object().unwrap();
            node["required"]
                .as_array()
                .unwrap()
                .iter()
                .all(|key| object.contains_key(key.as_str().unwrap()))
                && object.iter().all(|(key, value)| match properties.get(key) {
                    Some(property) => schema_accepts(root, property, value),
                    None => node["additionalProperties"] != false,
                })
        }),
        Some("array") => value.as_array().is_some_and(|values| {
            values
                .iter()
                .all(|value| schema_accepts(root, &node["items"], value))
        }),
        Some("string") => value.is_string(),
        Some("integer") => {
            (value.is_u64() || value.is_i64())
                && node
                    .get("minimum")
                    .is_none_or(|min| value.as_f64().unwrap() >= min.as_f64().unwrap())
                && node
                    .get("maximum")
                    .is_none_or(|max| value.as_f64().unwrap() <= max.as_f64().unwrap())
        }
        None => true,
        unexpected => panic!("unexpected schema type {unexpected:?}"),
    }
}

fn inspect_schema_objects(
    root: &serde_json::Value,
    node: &serde_json::Value,
    value: &serde_json::Value,
    path: &str,
    paths: &mut Vec<String>,
) {
    let mut node = resolve_schema(root, node);
    if let Some(variants) = node.get("oneOf") {
        node = variants
            .as_array()
            .unwrap()
            .iter()
            .find(|node| schema_accepts(root, node, value))
            .unwrap();
    }
    if let Some(object) = value.as_object() {
        assert_eq!(node["additionalProperties"], false, "{path}");
        let actual: BTreeSet<_> = object.keys().map(String::as_str).collect();
        let properties: BTreeSet<_> = node["properties"]
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect();
        let required: BTreeSet<_> = node["required"]
            .as_array()
            .unwrap()
            .iter()
            .map(|key| key.as_str().unwrap())
            .collect();
        assert_eq!(actual, properties, "{path}");
        assert_eq!(actual, required, "{path}");
        paths.push(path.to_owned());
        for (key, value) in object {
            inspect_schema_objects(
                root,
                &node["properties"][key],
                value,
                &format!("{path}/{key}"),
                paths,
            );
        }
    } else if let Some(array) = value.as_array() {
        for (index, value) in array.iter().enumerate() {
            inspect_schema_objects(
                root,
                &node["items"],
                value,
                &format!("{path}/{index}"),
                paths,
            );
        }
    }
}

#[test]
fn patch_schema_all_variants_and_nested_field_inventories_match_deserialization() {
    let schema = super::model::patch_schema();
    let fixture = schema_fixture();
    assert!(schema_accepts(&schema, &schema, &fixture));
    parse_executor_patch(fixture.clone()).unwrap();
    let mut paths = Vec::new();
    inspect_schema_objects(&schema, &schema, &fixture, "", &mut paths);
    assert_eq!(paths.len(), 13);
    for path in paths {
        let object = fixture.pointer(&path).unwrap().as_object().unwrap();
        for key in object.keys() {
            let mut missing = fixture.clone();
            missing
                .pointer_mut(&path)
                .unwrap()
                .as_object_mut()
                .unwrap()
                .remove(key);
            assert!(
                !schema_accepts(&schema, &schema, &missing),
                "missing {path}/{key}"
            );
            assert!(
                parse_executor_patch(missing).is_err(),
                "missing {path}/{key}"
            );
            let mut wrong = fixture.clone();
            wrong.pointer_mut(&path).unwrap()[key] = json!(false);
            assert!(
                !schema_accepts(&schema, &schema, &wrong),
                "type {path}/{key}"
            );
            assert!(parse_executor_patch(wrong).is_err(), "type {path}/{key}");
        }
        let mut extra = fixture.clone();
        extra.pointer_mut(&path).unwrap()["unexpected"] = json!(true);
        assert!(!schema_accepts(&schema, &schema, &extra), "extra {path}");
        assert!(parse_executor_patch(extra).is_err(), "extra {path}");
    }
}

#[test]
fn patch_schema_rejects_incorrect_union_tags_and_integer_types() {
    let schema = super::model::patch_schema();
    for path in [
        "/kind",
        "/outcome",
        "/tasks/0/status",
        "/tasks/1/status",
        "/tasks/2/status",
        "/tasks/0/verification/disposition",
        "/tasks/0/evidence/0/kind",
        "/tasks/0/evidence/1/kind",
        "/tasks/0/evidence/2/kind",
        "/deviations/0/evidence/0/kind",
        "/blockers/0/evidence/0/kind",
        "/schema",
        "/expected_execution_version",
        "/tasks/0/verification/commands/0/exit_code",
        "/tasks/0/evidence/1/line",
    ] {
        let mut fixture = schema_fixture();
        *fixture.pointer_mut(path).unwrap() = json!("invalid-tag-or-integer");
        assert!(!schema_accepts(&schema, &schema, &fixture), "{path}");
        assert!(parse_executor_patch(fixture).is_err(), "{path}");
    }
}

#[test]
fn patch_schema_keeps_structural_and_semantic_admission_separate() {
    let schema = super::model::patch_schema();
    let mut fixture = schema_fixture();
    fixture["schema"] = json!(2);
    fixture["tasks"][0]["verification"]["disposition"] = json!("failed");
    fixture["tasks"][0]["evidence"] = json!([]);
    assert!(schema_accepts(&schema, &schema, &fixture));
    let patch = parse_executor_patch(fixture).unwrap();
    assert_eq!(
        super::patch::apply_executor_patch(&json!({}), &patch)
            .unwrap_err()
            .code,
        "unsupported-patch-schema"
    );
}

#[test]
fn executor_never_requests_the_gates_the_orchestrator_owns() {
    // D-171: the suite and plan completion are the orchestrator's requests. The
    // executor closes its last task and reports. D-170: a committed path outside
    // the lease is retained as a deviation, never refused.
    let executor = crate::execution::instructions::dispatch_text();
    let frontdoor = crate::execution::instructions::frontdoor_markdown();
    assert!(executor.contains("The executor never requests `execution-suite` or `execution-plan-complete`"),
        "the compiled executor text must hand the gates to the orchestrator");
    assert!(!executor.contains("Every path in an evidence or completion commit"),
        "D-170: the lease paragraph still promises a refusal");
    assert!(executor.contains("retained as a deviation on the plan record"),
        "D-170: the lease paragraph must name the retained deviation");
    assert!(frontdoor.contains("request `execution-suite`"), "the front door must request the suite itself");
    assert!(frontdoor.contains("then request `execution-plan-complete`"), "the front door must complete the plan itself");
}

#[test]
fn suite_repair_is_plan_level_single_use_and_retains_deviations() {
    let question = json!({"kind":"suite-repair-question","id":"suite-repair:run-1",
        "failed_run":"run-1","failing_tests":["repair::alpha"],
        "proposed_paths":["src/delivery.rs","docs/outside.md"]});
    let event = serde_json::from_value::<super::history::PlanEvent>(question.clone())
        .expect("the plan history must accept a suite repair question");
    assert_eq!(serde_json::to_value(event).unwrap(), question);
    let answer = json!({"kind":"suite-repair-answer","question_id":"suite-repair:run-1",
        "owner":"Fixture Owner","at":"2026-09-15T18:00:00Z","disposition":"approve"});
    assert!(serde_json::from_value::<super::history::PlanEvent>(answer).is_ok(),
        "the owner answer must be a plan event, never a task checkpoint");
    let repair = json!({"kind":"suite-repair","question_id":"suite-repair:run-1",
        "commits":["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
        "changed_paths":{"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa":["docs/outside.md"]}});
    assert!(serde_json::from_value::<super::history::PlanEvent>(repair).is_ok(),
        "the Git-observed repair must be retained at plan level");
}

#[test]
fn ac2_strict_plan_and_overlap_selection_are_executable_evidence() {
    let source = |plan, files: &str, body: &str| {
        format!(
            "---\nphase: 6\nplan: {plan}\nrequirements: [AC2]\nfiles: [{files}]\nexecution:\n  schema: 1\n  suite: cargo test\n  tasks:\n    - id: T{plan}\n      verify: [cargo test task{plan}]\n---\n{body}"
        )
    };
    let first = parse_plan(source(1, "src/a.rs", "opaque 日本語\n").as_bytes(), 6, 1).unwrap();
    let second = parse_plan(source(2, "src/a.rs", "second\n").as_bytes(), 6, 2).unwrap();
    let graph = PlanGraph::build(&[first.clone(), second]).unwrap();
    assert_eq!(first.body, "opaque 日本語\n");
    assert_eq!(graph.ready(&BTreeSet::new()), [1]);
    assert_eq!(graph.ready(&BTreeSet::from([1])), [2]);
    assert_eq!(graph.next_ready(&BTreeSet::new()), Some(1));
    assert_eq!(graph.next_ready(&BTreeSet::from([1])), Some(2));
}

#[test]
fn ac5_unknown_patch_keys_are_executable_evidence() {
    let value = json!({
        "schema": 1,
        "kind": "executor",
        "dispatch_id": "dispatch",
        "expected_execution_version": 1,
        "outcome": "complete",
        "tasks": [],
        "deviations": [],
        "blockers": [],
        "unknown": true,
    });
    assert_eq!(
        parse_executor_patch(value).unwrap_err().code,
        "invalid-patch"
    );
}

#[test]
fn phase_six_core_acceptance_inventory_runs_registered_evidence() {
    let rows: [(&str, &str, fn()); 2] = [
        (
            "AC2",
            "execution::tests::ac2_strict_plan_and_overlap_selection_are_executable_evidence",
            ac2_strict_plan_and_overlap_selection_are_executable_evidence,
        ),
        (
            "AC5",
            "execution::tests::ac5_unknown_patch_keys_are_executable_evidence",
            ac5_unknown_patch_keys_are_executable_evidence,
        ),
    ];
    let listing = Command::new(std::env::current_exe().unwrap())
        .arg("--list")
        .output()
        .unwrap();
    assert!(listing.status.success());
    let listing = String::from_utf8(listing.stdout).unwrap();
    for (criterion, name, run) in rows {
        assert!(
            listing.lines().any(|line| line == format!("{name}: test")),
            "{criterion} evidence is not registered: {name}"
        );
        run();
    }
}

// PLAN-3 repair inventory, alongside the unchanged PLAN-1 inventories.
// The four harness shards collectively cover M1-M7. Each row is registered
// and executed here; names alone cannot satisfy a repair obligation.
#[test]
fn phase_six_core_repair_inventory_runs_registered_evidence() {
    let rows: [(&str, &str, fn()); 3] = [
        (
            "M1",
            "execution::tests::patch_schema_all_variants_and_nested_field_inventories_match_deserialization",
            patch_schema_all_variants_and_nested_field_inventories_match_deserialization,
        ),
        (
            "M1",
            "execution::tests::patch_schema_rejects_incorrect_union_tags_and_integer_types",
            patch_schema_rejects_incorrect_union_tags_and_integer_types,
        ),
        (
            "M1",
            "execution::tests::patch_schema_keeps_structural_and_semantic_admission_separate",
            patch_schema_keeps_structural_and_semantic_admission_separate,
        ),
    ];
    assert_eq!(
        rows.iter()
            .map(|row| row.0)
            .collect::<std::collections::BTreeSet<_>>(),
        std::collections::BTreeSet::from(["M1"])
    );
    let listing = std::process::Command::new(std::env::current_exe().unwrap())
        .arg("--list")
        .stdin(std::process::Stdio::null())
        .output()
        .unwrap();
    assert!(listing.status.success());
    let listing = String::from_utf8(listing.stdout).unwrap();
    // Each row is a test of its own and runs as one; this test proves the row
    // is registered under the name the criterion cites and bound to a real
    // function, and does not run it a second time (D-176).
    for (criterion, name, _bound) in rows {
        assert!(
            listing.lines().any(|line| line == format!("{name}: test")),
            "{criterion} repair evidence is not registered: {name}"
        );
        println!("{criterion} repair evidence registered: {name}");
    }
}
