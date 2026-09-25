use cadence::review::{admission, io, persistence};

use cadence::store::Error;
use cadence::store::model::Snapshot;
use cadence::store::writer::View;
use serde_json::{Value, json};

struct FixedClock;
impl io::Clock for FixedClock {
    fn now(&mut self) -> u64 {
        100
    }
}
fn fixture() -> Value {
    serde_json::from_str(include_str!("fixtures/phase9/h1-admission.json")).unwrap()
}
fn view(data: Value, generation: u64) -> View {
    View {
        items: vec![],
        decisions: vec![],
        snapshot: Snapshot::new(generation, b"", b"", data).unwrap(),
    }
}
fn pending(input: &Value) -> admission::PendingAdmission {
    admission::PendingAdmission {
        admission: serde_json::from_value(input["H"].clone()).unwrap(),
        attempts: vec![serde_json::from_value(input["a1"].clone()).unwrap()],
        manifest: serde_json::from_value(input["m1"].clone()).unwrap(),
        material: persistence::MaterialStorage {
            retained: serde_json::from_value(input["retained"].clone()).unwrap(),
        },
        home_path: input["home_path"].as_str().unwrap().into(),
    }
}
fn saved(input: &Value) -> Value {
    let mut data = input["fresh"].clone();
    data["review"] = input["sequence"].clone();
    data["review"]["replays"] = json!({"k1":input["replay"]});
    data["review"]["admissions"] = json!({"f1":input["H"]});
    data["review"]["attempts"] = json!({"a1":input["a1"]});
    data
}
#[test]
fn admission_replay_ac49() {
    let input = fixture();
    let basis = view(saved(&input), 2);
    let mut transaction = persistence::transaction(&basis, "caller:k1");
    let contribution =
        admission::contribute_admission(&basis, &mut transaction, pending(&input), &mut FixedClock).unwrap();
    assert_eq!(
        serde_json::to_value(admission::acknowledge_admission(&basis, contribution).unwrap()).unwrap(),
        json!({"fire":"f1","attempt":"a1","replayed":true})
    );
}
#[test]
fn admission_independent_occurrence_ac69() {
    let input = fixture();
    let mut records = persistence::records(&json!({"review":input["sequence"]})).unwrap();
    assert_eq!(admission::allocate(&mut records, "k2").unwrap(), "occ2");
}
#[test]
fn admission_replayed_occurrence_ac70() {
    let input = fixture();
    let mut records = persistence::records(&json!({"review":input["sequence"]})).unwrap();
    assert_eq!(admission::allocate(&mut records, "k1").unwrap(), "occ1");
}
#[test]
fn admission_fresh_commit() {
    let input = fixture();
    let basis = view(input["fresh"].clone(), 1);
    let mut transaction = persistence::transaction(&basis, "caller:k1");
    let contribution =
        admission::contribute_admission(&basis, &mut transaction, pending(&input), &mut FixedClock).unwrap();
    // The view the commit would return: the transaction's snapshot, installed.
    let committed = view(transaction.snapshot.clone().unwrap(), 2);
    assert_eq!(
        serde_json::to_value(admission::acknowledge_admission(&committed, contribution).unwrap()).unwrap(),
        json!({"fire":"f1","attempt":"a1","replayed":false})
    );
}
#[test]
fn admission_contribution_preserves_caller_snapshot() {
    let input = fixture();
    let basis = view(input["fresh"].clone(), 1);
    let mut transaction = persistence::transaction(&basis, "caller:k1");
    transaction.snapshot = Some(input["fresh"].clone());
    transaction.snapshot.as_mut().unwrap()["current"]["cursor"] = json!(2);
    let _contribution =
        admission::contribute_admission(&basis, &mut transaction, pending(&input), &mut FixedClock)
            .unwrap();
    let mut data = transaction.snapshot.unwrap();
    data.as_object_mut().unwrap().remove("review");
    assert_eq!(
        data,
        json!({"import":{"complete":true},"source_evidence":[{"source":"old"}],"current":{"cursor":2},"other":{"untouched":true}})
    );
}
#[test]
fn admission_unavailable_home_refuses() {
    let input = fixture();
    let basis = view(Value::Null, 0);
    let mut transaction = persistence::transaction(&basis, "caller:k1");
    assert_eq!(
        admission::contribute_admission(&basis, &mut transaction, pending(&input), &mut FixedClock)
            .err()
            .unwrap(),
        Error::Invalid("durable review home unavailable".into())
    );
}
#[test]
fn an_admission_records_the_supplied_time() {
    let input = fixture();
    let basis = view(input["fresh"].clone(), 1);
    let mut transaction = persistence::transaction(&basis, "caller:k1");
    admission::contribute_admission(&basis, &mut transaction, pending(&input), &mut FixedClock).unwrap();
    let replay_key = input["H"]["replay_key"].as_str().unwrap();
    assert_eq!(
        transaction.snapshot.unwrap()["review"]["replays"][replay_key]["admitted_at"],
        100
    );
}
