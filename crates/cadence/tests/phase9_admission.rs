#[allow(dead_code)]
#[path = "../src/review/admission.rs"]
mod admission;
#[allow(dead_code)]
#[path = "../src/review/io.rs"]
mod io;
#[allow(dead_code)]
#[path = "../src/review/manifest.rs"]
mod manifest;
#[allow(dead_code)]
#[path = "../src/review/material.rs"]
mod material;
#[allow(dead_code)]
#[path = "../src/review/model.rs"]
mod model;
#[allow(dead_code)]
#[path = "../src/review/persistence.rs"]
mod persistence;

use cadence::store::model::{DECISIONS, ITEMS, STATE, Snapshot};
use cadence::store::writer::{PlanningPolicy, Store, View};
use cadence::store::{Error, Observed, Result, Storage};
use serde_json::{Value, json};
use std::collections::BTreeMap;

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
fn files(view: &View) -> BTreeMap<String, Vec<u8>> {
    [
        (ITEMS.into(), vec![]),
        (DECISIONS.into(), vec![]),
        (STATE.into(), view.snapshot.render().unwrap()),
    ]
    .into()
}
struct Filesystem {
    files: BTreeMap<String, Vec<u8>>,
    winner: Option<BTreeMap<String, Vec<u8>>>,
    acquisitions: usize,
}
impl Storage for Filesystem {
    type Prepared = (String, Vec<u8>);
    fn acquire(&mut self) -> Result<Box<dyn Send>> {
        self.acquisitions += 1;
        if self.acquisitions == 2
            && let Some(winner) = self.winner.take()
        {
            self.files = winner;
        }
        Ok(Box::new(()))
    }
    fn read(&mut self, target: &str) -> Result<Observed> {
        if ![ITEMS, DECISIONS, STATE, ".store-intent.json"].contains(&target) {
            panic!("forbidden filesystem read: {target}");
        }
        let bytes = self.files.get(target).cloned();
        Ok(Observed {
            identity: bytes
                .as_deref()
                .map(cadence::store::model::digest)
                .unwrap_or_default(),
            bytes,
            directory_identity: "store1".into(),
        })
    }
    fn prepare(&mut self, target: &str, bytes: &[u8]) -> Result<Self::Prepared> {
        Ok((target.into(), bytes.into()))
    }
    fn install(&mut self, prepared: &Self::Prepared) -> Result<()> {
        self.files.insert(prepared.0.clone(), prepared.1.clone());
        Ok(())
    }
    fn discard(&mut self, _: Self::Prepared) -> Result<()> {
        Ok(())
    }
    fn confirm(&mut self, target: &str, bytes: &[u8]) -> Result<Observed> {
        let saved = self.read(target)?;
        if saved.bytes.as_deref() != Some(bytes) {
            return Err(Error::Conflict("bytes differ".into()));
        }
        Ok(saved)
    }
    fn resync(&mut self, target: &str, bytes: &[u8]) -> Result<Observed> {
        self.confirm(target, bytes)
    }
    fn remove(&mut self, target: &str) -> Result<()> {
        self.files.remove(target);
        Ok(())
    }
}
async fn store(view: &View, winner: Option<&View>) -> Store {
    Store::open(
        Filesystem {
            files: files(view),
            winner: winner.map(files),
            acquisitions: 0,
        },
        PlanningPolicy,
    )
    .await
    .unwrap()
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
#[tokio::test]
async fn admission_revision_conflict_ac48() {
    let input = fixture();
    let basis = view(input["fresh"].clone(), 1);
    let winner = view(input["fresh"].clone(), 2);
    let store = store(&basis, Some(&winner)).await;
    let transaction = persistence::transaction(&basis, "caller:k1");
    assert_eq!(
        serde_json::to_value(
            admission::admit_pending(
                &store,
                &basis,
                transaction,
                pending(&input),
                &mut FixedClock
            )
            .await
            .unwrap()
        )
        .unwrap(),
        json!({"code":"revision-conflict","replay_key":"k1","dispatch":null})
    );
}
#[tokio::test]
async fn admission_replay_ac49() {
    let input = fixture();
    let basis = view(saved(&input), 2);
    let store = store(&basis, None).await;
    let transaction = persistence::transaction(&basis, "caller:k1");
    assert_eq!(
        serde_json::to_value(
            admission::admit_pending(
                &store,
                &basis,
                transaction,
                pending(&input),
                &mut FixedClock
            )
            .await
            .unwrap()
        )
        .unwrap(),
        json!({"fire":"f1","attempt":"a1","replayed":true})
    );
}
#[tokio::test]
async fn admission_saved_policy_ac68() {
    let input = fixture();
    let basis = view(saved(&input), 2);
    let store = store(&basis, None).await;
    assert_eq!(
        serde_json::to_value(admission::read_admission(&store, "f1").await.unwrap()).unwrap(),
        json!({"fire":"f1","replay_key":"k1","scope":{"project":"p1","root":"r1","cycle":"c1"},"home":{"kind":"task","id":"h1","occurrence":"occ1"},"caller":"task","trigger":"risk_surface","specialist":null,"discriminator":"d1","plan":null,"anchor":null,"round":1,"artifact":"m1","gate":"deferred","selection":{"mode":"single","choices":["A","B"],"fallback":"local"},"routing":{"answer":"local","evidence":"route1"},"roster":{"required":["A"],"completion":"all-required-terminal"},"contract":{"schema":"review-1","interpretation":"H1-H5","validator":"H4-1"},"settlement":"pending"})
    );
}
#[tokio::test]
async fn admission_independent_occurrence_ac69() {
    let input = fixture();
    let basis = view(json!({"review":input["sequence"]}), 2);
    let store = store(&basis, None).await;
    assert_eq!(
        admission::allocate_occurrence(&store, "k2", &mut FixedClock)
            .await
            .unwrap(),
        "occ2"
    );
}
#[tokio::test]
async fn admission_replayed_occurrence_ac70() {
    let input = fixture();
    let basis = view(json!({"review":input["sequence"]}), 2);
    let store = store(&basis, None).await;
    assert_eq!(
        admission::allocate_occurrence(&store, "k1", &mut FixedClock)
            .await
            .unwrap(),
        "occ1"
    );
}
#[tokio::test]
async fn admission_fresh_commit() {
    let input = fixture();
    let basis = view(input["fresh"].clone(), 1);
    let store = store(&basis, None).await;
    let transaction = persistence::transaction(&basis, "caller:k1");
    assert_eq!(
        serde_json::to_value(
            admission::admit_pending(
                &store,
                &basis,
                transaction,
                pending(&input),
                &mut FixedClock
            )
            .await
            .unwrap()
        )
        .unwrap(),
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
#[tokio::test]
async fn admission_unavailable_home_refuses() {
    let input = fixture();
    let basis = view(Value::Null, 0);
    let store = store(&basis, None).await;
    let transaction = persistence::transaction(&basis, "caller:k1");
    assert_eq!(
        admission::admit_pending(
            &store,
            &basis,
            transaction,
            pending(&input),
            &mut FixedClock
        )
        .await
        .unwrap_err(),
        Error::Invalid("durable review home unavailable".into())
    );
}
