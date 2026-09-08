#[allow(dead_code)]
#[path = "../src/review/consumers.rs"]
mod consumers;
#[allow(dead_code)]
#[path = "../src/review/model.rs"]
mod model;
#[allow(dead_code)]
#[path = "../src/review/originals.rs"]
mod originals;
#[allow(dead_code)]
#[path = "../src/review/persistence.rs"]
mod persistence;
use cadence::store::model::{DECISIONS, ITEMS, STATE, Snapshot};
use cadence::store::writer::{PlanningPolicy, Store};
use cadence::store::{Observed, Result, Storage};
use serde_json::{Value, json};
use std::collections::BTreeMap;
fn fixture(name: &str) -> Value {
    let input: Value =
        serde_json::from_str(include_str!("fixtures/phase9/h5-raw-views.json")).unwrap();
    input[name].clone()
}
struct Filesystem(BTreeMap<String, Vec<u8>>);
impl Storage for Filesystem {
    type Prepared = ();
    fn read(&mut self, target: &str) -> Result<Observed> {
        if ![ITEMS, DECISIONS, STATE, ".store-intent.json"].contains(&target) {
            panic!("forbidden rendering/source read: {target}");
        }
        let bytes = self.0.get(target).cloned();
        Ok(Observed {
            identity: bytes
                .as_deref()
                .map(cadence::store::model::digest)
                .unwrap_or_default(),
            bytes,
            directory_identity: "store1".into(),
        })
    }
    fn prepare(&mut self, _: &str, _: &[u8]) -> Result<()> {
        panic!("read-only input")
    }
    fn install(&mut self, _: &()) -> Result<()> {
        panic!("read-only input")
    }
    fn discard(&mut self, _: ()) -> Result<()> {
        panic!("read-only input")
    }
    fn confirm(&mut self, _: &str, _: &[u8]) -> Result<Observed> {
        panic!("read-only input")
    }
    fn resync(&mut self, _: &str, _: &[u8]) -> Result<Observed> {
        panic!("read-only input")
    }
    fn remove(&mut self, _: &str) -> Result<()> {
        panic!("read-only input")
    }
}
async fn store(input: Value) -> Store {
    let snapshot = Snapshot::new(3, b"", b"", json!({"review":input["records"]})).unwrap();
    Store::open(
        Filesystem(
            [
                (ITEMS.into(), vec![]),
                (DECISIONS.into(), vec![]),
                (STATE.into(), snapshot.render().unwrap()),
            ]
            .into(),
        ),
        PlanningPolicy,
    )
    .await
    .unwrap()
}
#[tokio::test]
async fn raw_plan_ac53() {
    let input = fixture("plan");
    let store = store(input).await;
    assert_eq!(
        serde_json::to_value(
            consumers::plan_completion_input(&store, "a1")
                .await
                .unwrap()
                .identity
        )
        .unwrap(),
        json!({"kind":"raw","fire":"f1","round":1,"original":"o1","finding_ids":["o1:0"]})
    );
}
#[tokio::test]
async fn raw_execute_ac54() {
    let input = fixture("execute");
    let store = store(input).await;
    assert_eq!(
        serde_json::to_value(
            consumers::execute_completion_input(&store, "a1")
                .await
                .unwrap()
                .identity
        )
        .unwrap(),
        json!({"kind":"raw","fire":"f1","round":1,"original":"o1","finding_ids":["o1:0"]})
    );
}
#[tokio::test]
async fn raw_report_ac55() {
    let input = fixture("report");
    let store = store(input).await;
    assert_eq!(
        serde_json::to_value(
            consumers::report_review_input(&store, "a1")
                .await
                .unwrap()
                .identity
        )
        .unwrap(),
        json!({"kind":"raw","fire":"f1","round":1,"original":"o1","finding_ids":["o1:0"]})
    );
}
#[tokio::test]
async fn raw_deferred_ac56() {
    let input = fixture("deferred");
    let store = store(input).await;
    assert_eq!(
        serde_json::to_value(
            consumers::deferred_enqueue_input(&store, "a1")
                .await
                .unwrap()
                .identity
        )
        .unwrap(),
        json!({"kind":"raw","fire":"f1","round":1,"original":"o1","finding_ids":["o1:0"]})
    );
}
#[test]
fn raw_pending_ac64() {
    let input = fixture("pending");
    let delivery = serde_json::from_value(input["delivery"].clone()).unwrap();
    let findings = serde_json::from_value(input["findings"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(consumers::completion_review_state(delivery, findings)).unwrap(),
        json!({"state":"pending","findings":null})
    );
}
#[test]
fn raw_failed_ac65() {
    let input = fixture("failed");
    let delivery = serde_json::from_value(input["delivery"].clone()).unwrap();
    let findings = serde_json::from_value(input["findings"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(consumers::completion_review_state(delivery, findings)).unwrap(),
        json!({"state":"failed","findings":null})
    );
}
#[test]
fn raw_accepted_empty_ac66() {
    let input = fixture("accepted-empty");
    let delivery = serde_json::from_value(input["delivery"].clone()).unwrap();
    let findings = serde_json::from_value(input["findings"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(consumers::completion_review_state(delivery, findings)).unwrap(),
        json!({"state":"accepted","findings":[]})
    );
}
#[tokio::test]
async fn raw_specialist_raw_ac136() {
    let input = fixture("specialist-raw");
    let store = store(input).await;
    let output = consumers::read_specialist_result(&store, "a1")
        .await
        .unwrap();
    assert_eq!(
        json!({"kind":output.identity.kind,"original":output.identity.original}),
        json!({"kind":"raw","original":"o1"})
    );
}
#[tokio::test]
async fn raw_specialist_empty_ac137() {
    let input = fixture("specialist-empty");
    let store = store(input).await;
    let output = consumers::read_specialist_result(&store, "a1")
        .await
        .unwrap();
    assert_eq!(
        json!({"kind":output.identity.kind,"findings":output.findings}),
        json!({"kind":"raw","findings":[]})
    );
}
#[tokio::test]
async fn raw_specialist_failed_ac138() {
    let input = fixture("specialist-failed");
    let store = store(input).await;
    let output = consumers::read_specialist_result(&store, "a1")
        .await
        .unwrap();
    assert_eq!(
        json!({"kind":output.identity.kind,"findings":output.findings}),
        json!({"kind":"failed","findings":null})
    );
}
