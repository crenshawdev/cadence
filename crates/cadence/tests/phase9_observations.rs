#[allow(dead_code)]
#[path = "../src/review/attempts.rs"]
mod attempts;
#[allow(dead_code)]
#[path = "../src/review/binding.rs"]
mod binding;
#[allow(dead_code)]
#[path = "../src/review/io.rs"]
mod io;
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
    serde_json::from_str(include_str!("fixtures/phase9/h3-observations.json")).unwrap()
}
fn view(records: Value, generation: u64) -> View {
    View {
        items: vec![],
        decisions: vec![],
        snapshot: Snapshot::new(generation, b"", b"", json!({"review":records})).unwrap(),
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
}
impl Storage for Filesystem {
    type Prepared = (String, Vec<u8>);
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
async fn store(view: &View) -> Store {
    Store::open(
        Filesystem {
            files: files(view),
        },
        PlanningPolicy,
    )
    .await
    .unwrap()
}

#[tokio::test]
async fn observation_duplicate_ac81() {
    let input = fixture();
    let basis = view(input["accepted"].clone(), 2);
    let store = store(&basis).await;
    let event = serde_json::from_value(input["obs1"].clone()).unwrap();
    let result = attempts::record_observation(&store, event, &mut FixedClock)
        .await
        .unwrap();
    assert_eq!(
        json!({"attempt":result.attempt.attempt,"observation":result.observation,"replayed":result.replayed}),
        json!({"attempt":"a1","observation":"obs1","replayed":true})
    );
}
#[tokio::test]
async fn observation_late_usage_ac82() {
    let input = fixture();
    let basis = view(input["accepted"].clone(), 2);
    let store = store(&basis).await;
    let event = serde_json::from_value(input["obs2"].clone()).unwrap();
    let result = attempts::record_observation(&store, event, &mut FixedClock)
        .await
        .unwrap();
    assert_eq!(
        json!({"attempt":result.attempt.attempt,"terminal_count":result.terminal_count,"original":result.attempt.original,"observed_model":result.attempt.observed_model,"input_usage":result.attempt.usage.input}),
        json!({"attempt":"a1","terminal_count":1,"original":"o1","observed_model":"observed-A","input_usage":7})
    );
}
#[tokio::test]
async fn observation_conflicting_replay_refuses() {
    let input = fixture();
    let basis = view(input["accepted"].clone(), 2);
    let store = store(&basis).await;
    let mut event: model::Observation = serde_json::from_value(input["obs1"].clone()).unwrap();
    event.attempt = "a2".into();
    assert_eq!(
        attempts::record_observation(&store, event, &mut FixedClock)
            .await
            .unwrap_err(),
        Error::Conflict("observation identity reused".into())
    );
}
