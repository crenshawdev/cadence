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
    let entries = (1..=2).map(|n| serde_json::from_value(json!({"target":{"phase":12,"plan":n},"content":{
        "phase":12,"plan":n,"requirements":["truth/A","truth/B"],"files":["src/delivery.rs"],"directories":[],
        "execution":{"schema":1,"suite":"printf suite","tasks":[{"id":"deliver","verify":["printf verified"]},
        {"id":"document","verify":["printf documented"]}]},"body":body,"evidence_map":map}})).unwrap()).collect();
    let submission = Submission { phase: 12.try_into().unwrap(), occurrence:"active-cycle:phase:12".into(),
        request_id:"unit-publication".into(), inventory_basis:"unit-inventory".into(), plans:entries };
    let approval = Approval { approved:true, owner:Some("Fixture Owner".into()), at:Some("2026-09-10T14:00:00Z".into()), submission:Some(submission.clone()) };
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
        let approved=crate::plan::model::Approval {approved:true,owner:Some("Fixture Owner".into()),at:Some("2026-09-10T15:00:00Z".into()),submission:Some(replacing.clone())};
        assert!(crate::plan::persistence::contribute(&view.snapshot.data,&replacing,&approved,&inventory).unwrap_err().to_string().contains("admitted-plan"));
        let mut content=crate::plan::persistence::saved(&view.snapshot.data,12).unwrap().unwrap().publications[&1].content.clone();
        content.plan=3.try_into().unwrap();
        let submission=crate::plan::model::Submission {phase:12.try_into().unwrap(),occurrence:first.contract.occurrence.clone(),request_id:"gap".into(),
            inventory_basis:inventory.basis.clone(),plans:vec![crate::plan::model::Entry {target:crate::plan::model::Identity {phase:12.try_into().unwrap(),plan:3.try_into().unwrap()},content,replacement:None}]};
        let approval=crate::plan::model::Approval {approved:true,owner:Some("Fixture Owner".into()),at:Some("2026-09-10T15:00:00Z".into()),submission:Some(submission.clone())};
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
    for (criterion, name, run) in rows {
        assert!(
            listing.lines().any(|line| line == format!("{name}: test")),
            "{criterion} repair evidence is not registered: {name}"
        );
        run();
        println!("{criterion} repair evidence passed: {name}");
    }
}
