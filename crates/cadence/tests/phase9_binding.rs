#[allow(dead_code)]
#[path = "../src/review/io.rs"]
mod io;
#[allow(dead_code)]
#[path = "../src/review/attempts.rs"]
mod attempts;
#[allow(dead_code)]
#[path = "../src/review/binding.rs"]
mod binding;
#[allow(dead_code)]
#[path = "../src/review/model.rs"]
mod model;
#[allow(dead_code)]
#[path = "../src/review/persistence.rs"]
mod persistence;

use cadence::store::model::{DECISIONS, ITEMS, STATE, Snapshot};
use cadence::store::writer::{PlanningPolicy, Store};
use cadence::store::{Observed, Result, Storage};
use serde_json::{Value, json};
use std::collections::BTreeMap;
fn fixture() -> Value {
    serde_json::from_str(include_str!("fixtures/phase9/h3-bindings.json")).unwrap()
}
struct Filesystem(BTreeMap<String, Vec<u8>>);
impl Storage for Filesystem {
    type Prepared = ();
    fn read(&mut self, target: &str) -> Result<Observed> {
        if ![ITEMS, DECISIONS, STATE, ".store-intent.json"].contains(&target) {
            panic!("forbidden filesystem read: {target}");
        }
        Ok(Observed {
            bytes: self.0.get(target).cloned(),
            identity: "saved1".into(),
            directory_identity: "store1".into(),
        })
    }
    fn prepare(&mut self, _: &str, _: &[u8]) -> Result<()> {
        panic!("forbidden write")
    }
    fn install(&mut self, _: &()) -> Result<()> {
        panic!("forbidden write")
    }
    fn discard(&mut self, _: ()) -> Result<()> {
        panic!("forbidden write")
    }
    fn confirm(&mut self, _: &str, _: &[u8]) -> Result<Observed> {
        panic!("forbidden write")
    }
    fn resync(&mut self, _: &str, _: &[u8]) -> Result<Observed> {
        panic!("forbidden write")
    }
    fn remove(&mut self, _: &str) -> Result<()> {
        panic!("forbidden write")
    }
}
#[test]
fn binding_artifact_ac39() {
    let input = fixture();
    let admission = serde_json::from_value(input["H"].clone()).unwrap();
    let attempt = serde_json::from_value(input["attempts"]["a1"].clone()).unwrap();
    let submitted = serde_json::from_value(input["artifact-mismatch"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(binding::bind_return(&admission, &attempt, &submitted).unwrap_err())
            .unwrap(),
        json!({"code":"artifact-mismatch","fire":"f1","field":"artifact"})
    );
}
#[test]
fn binding_round_ac40() {
    let input = fixture();
    let admission = serde_json::from_value(input["H"].clone()).unwrap();
    let attempt = serde_json::from_value(input["attempts"]["a1"].clone()).unwrap();
    let submitted = serde_json::from_value(input["round-mismatch"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(binding::bind_return(&admission, &attempt, &submitted).unwrap_err())
            .unwrap(),
        json!({"code":"round-mismatch","fire":"f1","field":"round"})
    );
}
#[tokio::test]
async fn binding_read_attempt_ac78() {
    let input = fixture();
    let snapshot = Snapshot::new(
        2,
        b"",
        b"",
        json!({"review":{"schema":"review-1","attempts":input["attempts"]}}),
    )
    .unwrap();
    let store = Store::open(
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
    .unwrap();
    let result = attempts::read_attempt(&store, "a1").await.unwrap();
    assert_eq!(
        json!({"requested_model":result.requested.model,"observed_model":result.observed_model,"launch":result.launch,"host_return":result.host_return}),
        json!({"requested_model":"model-A","observed_model":null,"launch":"launch1","host_return":"return1"})
    );
}
#[test]
fn binding_host_return_ac79() {
    let input = fixture()["bound"].clone();
    let bindings = serde_json::from_value(input["host_returns"].clone()).unwrap();
    assert_eq!(
        serde_json::to_value(
            binding::bind_host_return(
                &bindings,
                input["return"].as_str().unwrap(),
                input["submitted_attempt"].as_str().unwrap()
            )
            .unwrap_err()
        )
        .unwrap(),
        json!({"code":"host-return-conflict","return":"return1","bound_attempt":"a1","submitted_attempt":"a2"})
    );
}
