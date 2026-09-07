//! Independent wire fixtures and real recovery evidence for the boundary format.
use cadence::envelope::Envelope;
use cadence::execution::{
    boundary::{BoundaryScope, BoundaryV1, PreparedAnswer},
    model::BoundaryTool,
};
use cadence::store::filesystem::{Filesystem, Stage};
use cadence::store::model::{self, DECISIONS, Decision, DecisionRecord, ITEMS, STATE, Snapshot};
use cadence::store::transaction::INTENT;
use cadence::store::writer::{BoundaryChange, Operation, Store};
use cadence::store::{Error, MutationContext, Policy, Result};
use serde_json::{Value, json};
use std::{collections::BTreeMap, path::Path};

struct Allow;
impl Policy for Allow {
    fn validate(&mut self, _: &MutationContext<'_>) -> Result<()> {
        Ok(())
    }
}
fn runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Builder::new_current_thread()
        .build()
        .unwrap()
}
async fn open(root: &Path) -> Result<Store> {
    Store::open(Filesystem::new(root).unwrap(), Allow).await
}
fn refusal(unique: &str) -> BoundaryV1 {
    BoundaryV1::new(
        BoundaryScope::RootRefusal,
        BoundaryTool::CadenceQuery,
        "execute-next".into(),
        model::digest(unique.as_bytes()),
        None,
        &PreparedAnswer::new(Envelope::Refused {
            code: "invalid-input".into(),
            reason: "invalid execution input".into(),
        })
        .unwrap(),
    )
}
fn canonical(value: &Value) -> Vec<u8> {
    match value {
        Value::Object(object) => format!(
            "{{{}}}",
            object
                .iter()
                .collect::<BTreeMap<_, _>>()
                .into_iter()
                .map(|(k, v)| format!(
                    "{}:{}",
                    serde_json::to_string(k).unwrap(),
                    String::from_utf8(canonical(v)).unwrap()
                ))
                .collect::<Vec<_>>()
                .join(",")
        )
        .into_bytes(),
        Value::Array(array) => format!(
            "[{}]",
            array
                .iter()
                .map(|v| String::from_utf8(canonical(v)).unwrap())
                .collect::<Vec<_>>()
                .join(",")
        )
        .into_bytes(),
        _ => serde_json::to_vec(value).unwrap(),
    }
}
fn wire_record(boundary: Value, generation: u64, terminal: bool) -> Value {
    let id = model::digest(&canonical(&json!(["boundary-envelope-v1", boundary])));
    json!({"version":1,"id":id,"revision":1,"origin":{"source":"execution-boundary-v1","original":"missing"},
        "decision":{"class":"boundary_v1","boundary":boundary,"store_generation":generation,"terminal":terminal}})
}
fn validate(values: Vec<Value>) -> bool {
    let bytes = values
        .iter()
        .map(|v| serde_json::to_string(v).unwrap() + "\n")
        .collect::<String>();
    let records = model::parse_lines::<DecisionRecord>(bytes.as_bytes());
    records
        .and_then(|records| model::validate_decisions(&records))
        .is_ok()
}

#[test]
fn legacy_record_snapshot_and_operation_receipt_encodings_round_trip_and_mix() {
    // Literal field order and encodings from baseline 2aa77d64, before envelope receipts.
    let legacy = br#"{"version":1,"id":"old-refusal","revision":1,"origin":{"source":"execution-boundary","original":"missing"},"decision":{"class":"boundary","phase":6,"tool":"cadence-query","operation":"execute-next","request_digest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","outcome":"refused:invalid-plan","subject_id":null,"store_generation":1,"prompt_bytes":null,"response_digest":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","terminal":false}}"#;
    let record: DecisionRecord = serde_json::from_slice(legacy).unwrap();
    assert_eq!(serde_json::to_vec(&record).unwrap(), legacy);
    model::validate_decisions(&[record]).unwrap();
    assert!(!validate(vec![
        json!({"version":1,"id":"unknown","revision":1,"origin":{"source":"old"},"decision":{"class":"boundary_v99"}})
    ]));
    let root = tempfile::tempdir().unwrap();
    let decisions = b"{\"version\":1,\"id\":\"gate-5\",\"revision\":1,\"origin\":{\"source\":\"evidence\",\"original\":\"missing\"},\"decision\":{\"class\":\"gate\",\"outcome\":\"accepted\",\"evidence\":{\"text\":\"source evidence\"}}}\n";
    let mut snapshot = json!({"version":1,"generation":1,"items_digest":model::digest(b""),"decisions_digest":model::digest(decisions),
        "data":{"import":{"manifest":["legacy"],"provenance":"retained"},"lifecycle":{"memo":"retained"},"evidence":{"permissions":["E1"]},"pause":{"pending":true},"other":[null,1]},
        "operations":{"old-operation":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"},"integrity":""});
    snapshot["integrity"] = json!(model::digest(&serde_json::to_vec(&snapshot).unwrap()));
    let bytes = serde_json::to_vec(&snapshot).unwrap();
    assert_eq!(
        Snapshot::parse(&bytes, b"", decisions)
            .unwrap()
            .render()
            .unwrap(),
        bytes
    );
    std::fs::write(root.path().join(ITEMS), b"").unwrap();
    std::fs::write(root.path().join(DECISIONS), decisions).unwrap();
    std::fs::write(root.path().join(STATE), &bytes).unwrap();
    runtime().block_on(async {
        let store = open(root.path()).await.unwrap();
        let view = store.request(Operation::ReadVerified).await.unwrap();
        let updated = store
            .request(Operation::BoundaryV1 {
                expected_generation: view.snapshot.generation,
                expected_integrity: view.snapshot.integrity,
                operation_id: "new-refusal".into(),
                decision: refusal("new"),
                change: Box::new(BoundaryChange::Observe),
            })
            .await
            .unwrap();
        assert_eq!(updated.snapshot.data, snapshot["data"]);
        assert_eq!(updated.snapshot.operations["old-operation"], "c".repeat(64));
        assert!(
            std::fs::read(root.path().join(DECISIONS))
                .unwrap()
                .starts_with(decisions)
        );
        assert!(matches!(
            updated.decisions[0].decision,
            Decision::Gate { .. }
        ));
        drop(store);
        assert_eq!(
            open(root.path())
                .await
                .unwrap()
                .request(Operation::ReadVerified)
                .await
                .unwrap(),
            updated
        );
    });
}

#[test]
fn immutable_records_reject_duplicate_revisions_terminals_and_post_terminal_admissions() {
    let boundary = serde_json::to_value(refusal("one")).unwrap();
    let first = wire_record(boundary, 1, false);
    assert!(validate(vec![first.clone()]));
    assert!(!validate(vec![first.clone(), first.clone()]));
    let mut revision = first.clone();
    revision["revision"] = json!(2);
    assert!(!validate(vec![first.clone(), revision]));
    for field in [
        "codec",
        "scope",
        "response_digest",
        "receipt",
        "operation",
        "outcome",
    ] {
        let mut invalid = serde_json::to_value(refusal("invalid")).unwrap();
        invalid[field] = match field {
            "codec" => json!(99),
            "scope" => json!({"scope":"execution","phase":0}),
            "response_digest" => json!("d".repeat(64)),
            "receipt" => json!({"receipt":"unknown"}),
            _ => json!("wrong"),
        };
        assert!(!validate(vec![wire_record(invalid, 1, false)]), "{field}");
    }
    let mut history: Vec<_> = (0..256)
        .map(|i| {
            wire_record(
                serde_json::to_value(refusal(&i.to_string())).unwrap(),
                i + 1,
                false,
            )
        })
        .collect();
    let terminal_boundary =
        serde_json::to_value(BoundaryV1::terminal(BoundaryScope::RootRefusal).unwrap()).unwrap();
    let terminal = wire_record(terminal_boundary, 257, true);
    assert!(!validate(vec![terminal.clone()]));
    history.push(terminal.clone());
    assert!(validate(history.clone()));
    let mut second = history.clone();
    second.push(terminal);
    assert!(!validate(second));
    history.push(wire_record(
        serde_json::to_value(refusal("late")).unwrap(),
        258,
        false,
    ));
    assert!(!validate(history));
}

async fn pending_root(root: &Path) -> Value {
    let store = Store::open(
        Filesystem::new(root).unwrap().with_probe(|stage, path| {
            if stage == Stage::Confirmation && path.file_name().is_some_and(|name| name == INTENT) {
                Err(Error::Io("intent confirmation injected".into()))
            } else {
                Ok(())
            }
        }),
        Allow,
    )
    .await
    .unwrap();
    let view = store.request(Operation::Read).await.unwrap();
    assert!(
        store
            .request(Operation::BoundaryV1 {
                expected_generation: 0,
                expected_integrity: view.snapshot.integrity,
                operation_id: "pending-root".into(),
                decision: refusal("pending"),
                change: Box::new(BoundaryChange::Observe)
            })
            .await
            .is_err()
    );
    drop(store);
    serde_json::from_slice(&std::fs::read(root.join(INTENT)).unwrap()).unwrap()
}
fn seal_intent(intent: &mut Value) {
    intent["integrity"] = json!(model::digest(
        &serde_json::to_vec(&json!([
            intent["version"],
            intent["kind"],
            intent["participants"]
        ]))
        .unwrap()
    ));
}

#[test]
fn root_intent_rejects_unknown_scope_generation_receipt_targets_and_tampering_before_install() {
    for case in [
        "scope",
        "zero",
        "identity",
        "generation",
        "codec",
        "digest",
        "receipt",
        "target",
        "summary",
        "config",
        "format",
        "tamper",
    ] {
        let root = tempfile::tempdir().unwrap();
        runtime().block_on(async {
            let mut intent = pending_root(root.path()).await;
            match case {
                "scope" => intent["kind"]["scope"] = json!({"scope":"execution","phase":6}),
                "zero" => intent["kind"]["scope"] = json!({"scope":"execution","phase":0}),
                "identity" => intent["kind"]["decision_id"] = json!("foreign"),
                "format" => intent["kind"]["operation"] = json!("boundary-observation-v99"),
                "target"|"summary"|"config" => {
                    let target = match case { "target"=>"../foreign", "summary"=>"phase-summary:6", _=>"repo-config" };
                    let mut participant = intent["participants"][0].clone(); participant["target"]=json!(target);
                    intent["participants"].as_array_mut().unwrap().insert(0,participant);
                }
                "generation"|"codec"|"digest"|"receipt" => {
                    let index = intent["participants"].as_array().unwrap().iter().position(|p|p["target"]==DECISIONS).unwrap();
                    let bytes: Vec<u8> = serde_json::from_value(intent["participants"][index]["bytes"].clone()).unwrap();
                    let mut record: Value = serde_json::from_slice(&bytes).unwrap();
                    match case {
                        "generation" => record["decision"]["store_generation"]=json!(2),
                        "codec" => record["decision"]["boundary"]["codec"]=json!(99),
                        "digest" => record["decision"]["boundary"]["response_digest"]=json!("0".repeat(64)),
                        _ => record["decision"]["boundary"]["receipt"]=json!({"receipt":"dispatch","dispatch_id":"foreign","prompt_bytes":5}),
                    }
                    let mut bytes = serde_json::to_vec(&record).unwrap(); bytes.push(b'\n');
                    intent["participants"][index]["bytes"] = json!(bytes);
                    let state_index = intent["participants"].as_array().unwrap().iter().position(|p| p["target"] == STATE).unwrap();
                    let state_bytes: Vec<u8> = serde_json::from_value(intent["participants"][state_index]["bytes"].clone()).unwrap();
                    let mut state: Value = serde_json::from_slice(&state_bytes).unwrap();
                    state["decisions_digest"] = json!(model::digest(&bytes));
                    state["integrity"] = json!("");
                    state["integrity"] = json!(model::digest(&serde_json::to_vec(&state).unwrap()));
                    intent["participants"][state_index]["bytes"] = json!(serde_json::to_vec(&state).unwrap());
                }
                _ => {}
            }
            seal_intent(&mut intent);
            if case=="tamper" { intent["integrity"]=json!("0".repeat(64)); }
            let encoded = serde_json::to_vec(&intent).unwrap();
            std::fs::write(root.path().join(INTENT), &encoded).unwrap();
            assert!(open(root.path()).await.is_err(), "accepted {case}");
            for target in [ITEMS, DECISIONS, STATE] { assert!(!root.path().join(target).exists(), "installed {target} in {case}"); }
            assert_eq!(std::fs::read(root.path().join(INTENT)).unwrap(),encoded);
        });
    }
}
