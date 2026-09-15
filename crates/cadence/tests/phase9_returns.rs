use cadence::review::{io, model, returns};

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
    serde_json::from_str(include_str!("fixtures/phase9/h4-returns.json")).unwrap()
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
    winner: Option<BTreeMap<String, Vec<u8>>>,
    acquisitions: usize,
    fail_sync: bool,
}
impl Storage for Filesystem {
    type Prepared = (String, Vec<u8>);
    fn acquire(&mut self) -> Result<Box<dyn Send>> {
        self.acquisitions += 1;
        if self.acquisitions == 3
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
        if self.fail_sync && prepared.0 == STATE {
            return Err(Error::Io("result-store sync failed".into()));
        }
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
async fn store(view: &View, winner: Option<&View>, fail_sync: bool) -> Store {
    Store::open(
        Filesystem {
            files: files(view),
            winner: winner.map(files),
            acquisitions: 0,
            fail_sync,
        },
        PlanningPolicy,
    )
    .await
    .unwrap()
}

fn submission(input: &Value, raw: Option<&[u8]>) -> returns::ReturnSubmission {
    returns::ReturnSubmission {
        identity: serde_json::from_value(input["identity"].clone()).unwrap(),
        launch: "launch1".into(),
        host_return: Some("return1".into()),
        raw: raw.map(Vec::from),
        host_failure: None,
        citations: vec![],
    }
}
fn accepted(input: &Value) -> Value {
    let mut records = input["pending"].clone();
    records["attempts"]["a1"] = input["accepted_attempt"].clone();
    records["closures"] = json!({"a1":input["closure"]});
    records["originals"] = json!({"o1":input["original"]});
    records["originals"]["o1"]["raw"] = json!(input["F"].as_str().unwrap().as_bytes());
    records["original_sequence"] = json!(1);
    records
}
#[tokio::test]
async fn accept_exact_q_ac5() {
    let input = fixture();
    let basis = view(input["pending"].clone(), 2);
    let store = store(&basis, None, false).await;
    let submitted = submission(
        &input,
        Some(include_bytes!("fixtures/phase9/original-q.json")),
    );
    assert_eq!(
        returns::accept_return(&store, submitted, &mut FixedClock)
            .await
            .unwrap()
            .originals
            .unwrap()[0]
            .claim,
        "quote: \"\n雪"
    );
}
#[tokio::test]
async fn accept_sync_failure_ac45() {
    let input = fixture();
    let basis = view(input["pending"].clone(), 2);
    let store = store(&basis, None, true).await;
    let submitted = submission(&input, Some(input["F"].as_str().unwrap().as_bytes()));
    assert_eq!(
        serde_json::to_value(
            returns::accept_return(&store, submitted, &mut FixedClock)
                .await
                .unwrap_err()
        )
        .unwrap(),
        json!({"code":"delivery-write-failed","attempt":"a1","acknowledged":false})
    );
}
#[tokio::test]
async fn accept_replay_ac46() {
    let input = fixture();
    let basis = view(accepted(&input), 3);
    let store = store(&basis, None, false).await;
    let submitted = submission(&input, Some(input["F"].as_str().unwrap().as_bytes()));
    let result = returns::accept_return(&store, submitted, &mut FixedClock)
        .await
        .unwrap();
    assert_eq!(
        json!({"attempt":result.attempt,"original":result.original,"terminal":result.terminal,"replayed":result.replayed}),
        json!({"attempt":"a1","original":"o1","terminal":"accepted","replayed":true})
    );
}
#[tokio::test]
async fn accept_conflict_ac47() {
    let input = fixture();
    let basis = view(accepted(&input), 3);
    let store = store(&basis, None, false).await;
    let submitted = submission(&input, Some(input["Changed"].as_str().unwrap().as_bytes()));
    assert_eq!(
        serde_json::to_value(
            returns::accept_return(&store, submitted, &mut FixedClock)
                .await
                .unwrap_err()
        )
        .unwrap(),
        json!({"code":"conflicting-return","attempt":"a1","original":"o1"})
    );
}
#[tokio::test]
async fn accept_conflicting_winner_ac51() {
    let input = fixture();
    let basis = view(input["pending"].clone(), 2);
    let winner = view(accepted(&input), 3);
    let store = store(&basis, Some(&winner), false).await;
    let submitted = submission(&input, Some(input["Changed"].as_str().unwrap().as_bytes()));
    assert_eq!(
        serde_json::to_value(
            returns::accept_return(&store, submitted, &mut FixedClock)
                .await
                .unwrap_err()
        )
        .unwrap(),
        json!({"code":"conflicting-return","attempt":"a1","original":"o1"})
    );
}
#[tokio::test]
async fn accept_missing_return_closes_failed() {
    let input = fixture();
    let basis = view(input["pending"].clone(), 2);
    let store = store(&basis, None, false).await;
    let submitted = submission(&input, None);
    let result = returns::accept_return(&store, submitted, &mut FixedClock)
        .await
        .unwrap();
    assert_eq!(
        json!({"terminal":result.terminal,"original":result.original,"findings":result.originals,"terminal_count":result.durable_terminal_count}),
        json!({"terminal":"failed","original":null,"findings":null,"terminal_count":1})
    );
}
#[tokio::test]
async fn accept_malformed_return_closes_failed() {
    let input = fixture();
    let basis = view(input["pending"].clone(), 2);
    let store = store(&basis, None, false).await;
    let submitted = submission(&input, Some(b"{\"findings\":"));
    assert_eq!(
        returns::accept_return(&store, submitted, &mut FixedClock)
            .await
            .unwrap()
            .terminal,
        model::AttemptState::Failed
    );
}
