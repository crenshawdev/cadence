use cadence::review::{deferred, io};

use cadence::store::model::{DECISIONS, ITEMS, STATE, Snapshot};
use cadence::store::writer::{PlanningPolicy, Store};
use cadence::store::{Error, Observed, Result, Storage};
use serde_json::{Value, json};
use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};
struct FixedClock;
impl io::Clock for FixedClock {
    fn now(&mut self) -> u64 {
        100
    }
}
fn fixture(name: &str) -> Value {
    let input: Value =
        serde_json::from_str(include_str!("fixtures/phase9/h5-all-homes.json")).unwrap();
    input[name].clone()
}
type Files = BTreeMap<String, Vec<u8>>;
struct Filesystem {
    files: Arc<Mutex<Files>>,
    winner: Option<Files>,
    acquisitions: usize,
    fail_sync: bool,
    forbid_writes: bool,
}
impl Storage for Filesystem {
    type Prepared = (String, Vec<u8>);
    fn acquire(&mut self) -> Result<Box<dyn Send>> {
        self.acquisitions += 1;
        if self.acquisitions == 3
            && let Some(winner) = self.winner.take()
        {
            *self.files.lock().unwrap() = winner;
        }
        Ok(Box::new(()))
    }
    fn read(&mut self, target: &str) -> Result<Observed> {
        if ![ITEMS, DECISIONS, STATE, ".store-intent.json"].contains(&target) {
            panic!("forbidden rendering/cursor/source read: {target}");
        }
        let bytes = self.files.lock().unwrap().get(target).cloned();
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
        if self.forbid_writes {
            panic!("member write forbidden");
        }
        Ok((target.into(), bytes.into()))
    }
    fn install(&mut self, prepared: &Self::Prepared) -> Result<()> {
        if self.fail_sync && prepared.0 == STATE {
            return Err(Error::Io("queue sync failed".into()));
        }
        self.files
            .lock()
            .unwrap()
            .insert(prepared.0.clone(), prepared.1.clone());
        Ok(())
    }
    fn discard(&mut self, _: Self::Prepared) -> Result<()> {
        Ok(())
    }
    fn confirm(&mut self, target: &str, bytes: &[u8]) -> Result<Observed> {
        let observed = self.read(target)?;
        if observed.bytes.as_deref() != Some(bytes) {
            return Err(Error::Conflict("bytes differ".into()));
        }
        Ok(observed)
    }
    fn resync(&mut self, target: &str, bytes: &[u8]) -> Result<Observed> {
        self.confirm(target, bytes)
    }
    fn remove(&mut self, target: &str) -> Result<()> {
        self.files.lock().unwrap().remove(target);
        Ok(())
    }
}
fn files(records: Value, generation: u64) -> Files {
    let snapshot = Snapshot::new(generation, b"", b"", json!({"review":records})).unwrap();
    [
        (ITEMS.into(), vec![]),
        (DECISIONS.into(), vec![]),
        (STATE.into(), snapshot.render().unwrap()),
    ]
    .into()
}
async fn store(input: &Value) -> (Store, Arc<Mutex<Files>>) {
    let mut saved_files = files(input["records"].clone(), 3);
    for (path, bytes) in input["renderings"].as_object().unwrap() {
        saved_files.insert(path.clone(), bytes.as_str().unwrap().as_bytes().to_vec());
    }
    let files = Arc::new(Mutex::new(saved_files));
    let boundary = Filesystem {
        files: files.clone(),
        winner: input
            .get("winner_records")
            .map(|records| self::files(records.clone(), 4)),
        acquisitions: 0,
        fail_sync: input["fail_sync"].as_bool().unwrap(),
        forbid_writes: input["forbid_writes"].as_bool().unwrap(),
    };
    (Store::open(boundary, PlanningPolicy).await.unwrap(), files)
}
fn saved_member(files: &Arc<Mutex<Files>>) -> Value {
    let files = files.lock().unwrap();
    let snapshot: Value = serde_json::from_slice(&files[STATE]).unwrap();
    snapshot["data"]["review"]["deferred"]["f1"].clone()
}
#[tokio::test]
async fn deferred_phase_ac139() {
    let input = fixture("phase");
    let (store, files) = store(&input).await;
    let output = deferred::enqueue_deferred(&store, "f1", &mut FixedClock)
        .await
        .unwrap();
    assert_eq!(
        json!({"receipt":output,"durable":saved_member(&files)}),
        json!({
            "receipt":{"member":"f1","state":"unruled","continuation":"allowed"},
            "durable":{"member":"f1","state":"unruled","home":{"kind":"phase","id":"h1","occurrence":"occ1"},"references":[{"fire":"f1","manifest":"m1","attempt":"a1","original":"o1"}],"enqueued_at":100,"contract":{"schema":"review-1","interpretation":"H1-H5","validator":"H4-1"}}
        })
    );
}
#[tokio::test]
async fn deferred_task_ac140() {
    let input = fixture("task");
    let (store, files) = store(&input).await;
    let output = deferred::enqueue_deferred(&store, "f1", &mut FixedClock)
        .await
        .unwrap();
    assert_eq!(
        json!({"receipt":output,"durable":saved_member(&files)}),
        json!({
            "receipt":{"member":"f1","state":"unruled","continuation":"allowed"},
            "durable":{"member":"f1","state":"unruled","home":{"kind":"task","id":"h1","occurrence":"occ1"},"references":[{"fire":"f1","manifest":"m1","attempt":"a1","original":"o1"}],"enqueued_at":100,"contract":{"schema":"review-1","interpretation":"H1-H5","validator":"H4-1"}}
        })
    );
}
#[tokio::test]
async fn deferred_root_inline_ac141() {
    let input = fixture("root-inline");
    let (store, files) = store(&input).await;
    let output = deferred::enqueue_deferred(&store, "f1", &mut FixedClock)
        .await
        .unwrap();
    assert_eq!(
        json!({"receipt":output,"durable":saved_member(&files)}),
        json!({
            "receipt":{"member":"f1","state":"unruled","continuation":"allowed"},
            "durable":{"member":"f1","state":"unruled","home":{"kind":"root-inline","id":"h1","occurrence":"occ1"},"references":[{"fire":"f1","manifest":"m1","attempt":"a1","original":"o1"}],"enqueued_at":100,"contract":{"schema":"review-1","interpretation":"H1-H5","validator":"H4-1"}}
        })
    );
}
#[tokio::test]
async fn deferred_root_debug_ac142() {
    let input = fixture("root-debug");
    let (store, files) = store(&input).await;
    let output = deferred::enqueue_deferred(&store, "f1", &mut FixedClock)
        .await
        .unwrap();
    assert_eq!(
        json!({"receipt":output,"durable":saved_member(&files)}),
        json!({
            "receipt":{"member":"f1","state":"unruled","continuation":"allowed"},
            "durable":{"member":"f1","state":"unruled","home":{"kind":"root-debug","id":"h1","occurrence":"occ1"},"references":[{"fire":"f1","manifest":"m1","attempt":"a1","original":"o1"}],"enqueued_at":100,"contract":{"schema":"review-1","interpretation":"H1-H5","validator":"H4-1"}}
        })
    );
}
#[tokio::test]
async fn deferred_root_diagnosis_ac143() {
    let input = fixture("root-diagnosis");
    let (store, files) = store(&input).await;
    let output = deferred::enqueue_deferred(&store, "f1", &mut FixedClock)
        .await
        .unwrap();
    assert_eq!(
        json!({"receipt":output,"durable":saved_member(&files)}),
        json!({
            "receipt":{"member":"f1","state":"unruled","continuation":"allowed"},
            "durable":{"member":"f1","state":"unruled","home":{"kind":"root-diagnosis","id":"h1","occurrence":"occ1"},"references":[{"fire":"f1","manifest":"m1","attempt":"a1","original":"o1"}],"enqueued_at":100,"contract":{"schema":"review-1","interpretation":"H1-H5","validator":"H4-1"}}
        })
    );
}
#[tokio::test]
async fn deferred_sync_failure_ac144() {
    let input = fixture("sync-failure");
    let (store, files) = store(&input).await;
    let output = deferred::enqueue_deferred(&store, "f1", &mut FixedClock)
        .await
        .unwrap_err();
    assert_eq!(
        json!({"receipt":output,"durable":saved_member(&files)}),
        json!({"receipt":{"code":"enqueue-write-failed","fire":"f1","continuation":"wait"},"durable":null})
    );
}
#[tokio::test]
async fn deferred_advisory_ac146() {
    let input = fixture("advisory");
    let (store, _) = store(&input).await;
    assert_eq!(
        serde_json::to_value(
            deferred::enqueue_deferred(&store, "f1", &mut FixedClock)
                .await
                .unwrap()
        )
        .unwrap(),
        json!({"member":null})
    );
}
#[tokio::test]
async fn deferred_off_ac147() {
    let input = fixture("off");
    let (store, _) = store(&input).await;
    assert_eq!(
        serde_json::to_value(
            deferred::enqueue_deferred(&store, "f1", &mut FixedClock)
                .await
                .unwrap()
        )
        .unwrap(),
        json!({"member":null})
    );
}
#[tokio::test]
async fn deferred_references_ac150() {
    let input = fixture("references");
    let (store, _) = store(&input).await;
    let output = deferred::enumerate_deferred(&store).await.unwrap();
    assert_eq!(
        serde_json::to_value(&output.members[0].references).unwrap(),
        json!({"fire":"f1","manifest":"m1","attempt":"a1","original":"o1"})
    );
}
#[tokio::test]
async fn deferred_replay_preserves_initial_member() {
    let input = fixture("replay");
    let (store, files) = store(&input).await;
    let output = deferred::enqueue_deferred(&store, "f1", &mut FixedClock)
        .await
        .unwrap();
    assert_eq!(
        json!({"receipt":output,"enqueued_at":saved_member(&files)["enqueued_at"]}),
        json!({"receipt":{"member":"f1","state":"unruled","continuation":"allowed"},"enqueued_at":99})
    );
}
#[tokio::test]
async fn deferred_same_winner_preserves_initial_member() {
    let input = fixture("same-winner");
    let (store, files) = store(&input).await;
    let output = deferred::enqueue_deferred(&store, "f1", &mut FixedClock)
        .await
        .unwrap();
    assert_eq!(
        json!({"receipt":output,"enqueued_at":saved_member(&files)["enqueued_at"]}),
        json!({"receipt":{"member":"f1","state":"unruled","continuation":"allowed"},"enqueued_at":99})
    );
}
#[tokio::test]
async fn deferred_adjudication_rendering_does_not_filter() {
    let input = fixture("with-adjudication-rendering");
    let (store, _) = store(&input).await;
    let output = deferred::enumerate_deferred(&store).await.unwrap();
    assert_eq!(
        output
            .members
            .iter()
            .map(|member| member.member.as_str())
            .collect::<Vec<_>>(),
        ["f1", "f2", "f3"]
    );
}
