#[allow(dead_code)]
#[path = "../src/review/io.rs"]
mod io;
#[allow(dead_code)]
#[path = "../src/review/model.rs"]
mod model;
#[allow(dead_code)]
#[path = "../src/review/originals.rs"]
mod originals;
#[allow(dead_code)]
#[path = "../src/review/persistence.rs"]
mod persistence;
#[allow(dead_code)]
#[path = "../src/review/recovery.rs"]
mod recovery;
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
fn roster_fixture() -> Value {
    serde_json::from_str(include_str!("fixtures/phase9/h3-rosters.json")).unwrap()
}
fn original_fixture() -> Value {
    serde_json::from_str(include_str!("fixtures/phase9/h4-originals.json")).unwrap()
}
fn view(records: Value) -> View {
    View {
        items: vec![],
        decisions: vec![],
        snapshot: Snapshot::new(3, b"", b"", json!({"review":records})).unwrap(),
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

#[tokio::test]
async fn recover_pending_admission_ac43() {
    let input = roster_fixture()["pending-admission"].clone();
    let basis = view(json!({"schema":"review-1","attempts":{"a1":input}}));
    let store = store(&basis, None).await;
    assert_eq!(
        serde_json::to_value(
            recovery::recover_attempt(&store, "a1", &mut FixedClock)
                .await
                .unwrap()
        )
        .unwrap(),
        json!({"attempt":"a1","delivery":"interrupted","original":null})
    );
}
#[tokio::test]
async fn recover_host_return_ac44() {
    let input = roster_fixture()["host-return-before-submission"].clone();
    let basis = view(json!({"schema":"review-1","attempts":{"a1":input}}));
    let store = store(&basis, None).await;
    assert_eq!(
        serde_json::to_value(
            recovery::recover_attempt(&store, "a1", &mut FixedClock)
                .await
                .unwrap()
        )
        .unwrap(),
        json!({"attempt":"a1","delivery":"interrupted","original":null})
    );
}
#[tokio::test]
async fn recover_original_without_rendering_ac52() {
    let input = original_fixture()["F"].clone();
    let basis = view(json!({"schema":"review-1","originals":{"o1":input}}));
    let store = store(&basis, None).await;
    assert_eq!(
        serde_json::to_value(
            &recovery::recover_original(&store, "o1")
                .await
                .unwrap()
                .unwrap()[0]
        )
        .unwrap(),
        json!({"file":"a.rs","line":1,"severity":"high","claim":"C","failure_scenario":"S"})
    );
}
#[tokio::test]
async fn recover_original_identity_ac108() {
    let input = original_fixture()["Q"].clone();
    let basis = view(json!({"schema":"review-1","originals":{"o1":input}}));
    let store = store(&basis, None).await;
    assert_eq!(
        serde_json::to_value(
            originals::read_original(&store, "o1")
                .await
                .unwrap()
                .identity
        )
        .unwrap(),
        json!({"original":"o1","contract":"H4-1","finding_ids":["o1:0","o1:1"]})
    );
}
#[tokio::test]
async fn recover_original_q_ac109() {
    let input = original_fixture()["Q"].clone();
    let basis = view(json!({"schema":"review-1","originals":{"o1":input}}));
    let store = store(&basis, None).await;
    assert_eq!(
        originals::read_original(&store, "o1")
            .await
            .unwrap()
            .findings
            .unwrap()[0]
            .claim,
        "quote: \"\n雪"
    );
}
#[tokio::test]
async fn recover_original_raw_ac110() {
    let input = original_fixture()["empty"].clone();
    let basis = view(json!({"schema":"review-1","originals":{"o1":input}}));
    let store = store(&basis, None).await;
    assert_eq!(
        originals::read_original(&store, "o1")
            .await
            .unwrap()
            .raw_bytes,
        br#"{"findings":[]}"#
    );
}
#[tokio::test]
async fn recover_roster_pending_b_ac126() {
    let input = roster_fixture();
    let original = original_fixture()["empty"].clone();
    let basis = view(
        json!({"schema":"review-1","admissions":{"f1":input["H"]},"attempts":{"a1":input["accepted-A"],"a2":input["pending-B"]},"originals":{"o1":original}}),
    );
    let store = store(&basis, None).await;
    assert_eq!(
        serde_json::to_value(recovery::read_roster(&store, "f1").await.unwrap()).unwrap(),
        json!({"required":["A","B"],"pending":["B"]})
    );
}
#[tokio::test]
async fn recover_voice_original_ids_ac127() {
    let input = roster_fixture();
    let originals = original_fixture();
    let basis = view(
        json!({"schema":"review-1","admissions":{"f1":input["H"]},"attempts":{"a1":input["accepted-A"],"a2":input["accepted-B"]},"originals":{"o1":originals["empty"],"o2":originals["B-F"]}}),
    );
    let store = store(&basis, None).await;
    assert_eq!(
        serde_json::to_value(
            originals::read_voice_originals(&store, "f1")
                .await
                .unwrap()
                .originals
        )
        .unwrap(),
        json!({"A":"o1","B":"o2"})
    );
}
#[tokio::test]
async fn recover_voice_findings_ac129() {
    let input = roster_fixture();
    let originals = original_fixture();
    let basis = view(
        json!({"schema":"review-1","admissions":{"f1":input["H"]},"attempts":{"a1":input["accepted-A"],"a2":input["accepted-B"]},"originals":{"o1":originals["F"],"o2":originals["B-empty"]}}),
    );
    let store = store(&basis, None).await;
    assert_eq!(
        serde_json::to_value(
            originals::read_voice_originals(&store, "f1")
                .await
                .unwrap()
                .findings
        )
        .unwrap(),
        json!({"A":[{"file":"a.rs","line":1,"severity":"high","claim":"C","failure_scenario":"S"}],"B":[]})
    );
}
#[tokio::test]
async fn recover_unknown_original_contract_is_unverified() {
    let mut input = original_fixture()["empty"].clone();
    input["contract"]["validator"] = json!("historical-unknown");
    let basis = view(json!({"schema":"review-1","originals":{"o1":input}}));
    let store = store(&basis, None).await;
    assert_eq!(
        serde_json::to_value(
            originals::read_original(&store, "o1")
                .await
                .unwrap()
                .record
                .acceptance
        )
        .unwrap(),
        json!({"state":"unverified","reason":"unknown-saved-contract"})
    );
}
