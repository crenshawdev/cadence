//! Initial obligations share the review snapshot transaction and all-home index.
use super::io::Clock;
use super::model::{Admission, Attempt, DeferredMember, Gate, Home, Manifest, References, Scope};
use super::{originals, persistence};
use cadence::store::writer::Store;
use cadence::store::{Error, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum InitialState {
    Unruled,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct QueuedMember {
    #[serde(flatten)]
    pub record: DeferredMember,
    pub state: InitialState,
}
#[derive(Deserialize)]
struct IndexedHome {
    home: Home,
    scope: Scope,
    path: String,
    fire: String,
}
#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum EnqueueReply {
    Absent {
        member: Option<String>,
    },
    Enqueued {
        member: String,
        state: InitialState,
        continuation: String,
    },
}
#[derive(Debug, Serialize)]
pub struct EnqueueError {
    pub code: String,
    pub fire: String,
    pub continuation: String,
}
fn refused(fire: &str) -> EnqueueError {
    EnqueueError {
        code: "enqueue-write-failed".into(),
        fire: fire.into(),
        continuation: "wait".into(),
    }
}
fn receipt(member: &QueuedMember) -> EnqueueReply {
    EnqueueReply::Enqueued {
        member: member.record.member.clone(),
        state: member.state.clone(),
        continuation: "allowed".into(),
    }
}
fn home(records: &Value, admission: &Admission) -> Result<()> {
    let indexed: IndexedHome = persistence::get(records, "homes", &admission.home.occurrence)?;
    if indexed.home != admission.home
        || indexed.scope != admission.scope
        || indexed.fire != admission.fire
        || indexed.path.is_empty()
    {
        return Err(Error::Conflict("deferred home binding mismatch".into()));
    }
    Ok(())
}
fn references(records: &Value, admission: &Admission) -> Result<Vec<References>> {
    let manifest: Manifest = persistence::get(records, "manifests", &admission.artifact)?;
    if manifest.manifest != admission.artifact || manifest.fire != admission.fire {
        return Err(Error::Conflict("deferred manifest mismatch".into()));
    }
    let attempts: BTreeMap<String, Attempt> = records
        .get("attempts")
        .cloned()
        .map(serde_json::from_value)
        .transpose()?
        .unwrap_or_default();
    let mut result = vec![];
    for (id, attempt) in attempts.iter().filter(|(_, a)| a.fire == admission.fire) {
        if id != &attempt.attempt
            || attempt.round != admission.round
            || attempt.occurrence != admission.home.occurrence
            || attempt.view.manifest != admission.artifact
        {
            return Err(Error::Conflict("deferred attempt mismatch".into()));
        }
        if let Some(id) = &attempt.original {
            let original = originals::saved_original(records, id)?;
            if original.attempt.as_deref() != Some(&attempt.attempt)
                || original.artifact.as_deref() != Some(&admission.artifact)
                || original.view.as_deref() != Some(&attempt.view.view)
                || original.host_return != attempt.host_return
            {
                return Err(Error::Conflict("deferred original mismatch".into()));
            }
        }
        result.push(References {
            fire: admission.fire.clone(),
            manifest: admission.artifact.clone(),
            attempt: id.clone(),
            original: attempt.original.clone(),
        });
    }
    if result.is_empty() {
        return Err(Error::Invalid("deferred fire has no attempts".into()));
    }
    Ok(result)
}

/// This acknowledges durable enqueue only. Delivery and settlement retain their
/// own gates. Replay preserves the initial timestamp and never writes a new member.
pub async fn enqueue_deferred(
    store: &Store,
    fire: &str,
    clock: &mut impl Clock,
) -> std::result::Result<EnqueueReply, EnqueueError> {
    let view = persistence::read(store).await.map_err(|_| refused(fire))?;
    let mut records = persistence::records(&view.snapshot.data).map_err(|_| refused(fire))?;
    let admission: Admission =
        persistence::get(&records, "admissions", fire).map_err(|_| refused(fire))?;
    if admission.fire != fire {
        return Err(refused(fire));
    }
    if admission.gate != Some(Gate::Deferred) {
        return Ok(EnqueueReply::Absent { member: None });
    }
    home(&records, &admission).map_err(|_| refused(fire))?;
    let refs = references(&records, &admission).map_err(|_| refused(fire))?;
    if records
        .get("deferred")
        .and_then(|members| members.get(fire))
        .is_some()
    {
        let saved: QueuedMember =
            persistence::get(&records, "deferred", fire).map_err(|_| refused(fire))?;
        if saved.record.member != fire
            || saved.record.home != admission.home
            || saved.record.references != refs
        {
            return Err(refused(fire));
        }
        return Ok(receipt(&saved));
    }
    let member = QueuedMember {
        record: DeferredMember {
            member: fire.into(),
            home: admission.home,
            references: refs,
            enqueued_at: clock.now(),
            contract: admission.contract,
        },
        state: InitialState::Unruled,
    };
    persistence::insert(&mut records, "deferred", fire, &member).map_err(|_| refused(fire))?;
    // One generic contribution commits member, references and the existing index
    // in the same snapshot. No separate queue file participates.
    match persistence::update(store, &view, &format!("enqueue:{fire}"), records).await {
        Ok(committed) => {
            let saved: QueuedMember = persistence::get(
                &persistence::records(&committed.snapshot.data).map_err(|_| refused(fire))?,
                "deferred",
                fire,
            )
            .map_err(|_| refused(fire))?;
            if saved != member {
                return Err(refused(fire));
            }
            Ok(receipt(&saved))
        }
        Err(Error::Conflict(_)) => {
            let winner = persistence::read(store).await.map_err(|_| refused(fire))?;
            let saved: QueuedMember = persistence::get(
                &persistence::records(&winner.snapshot.data).map_err(|_| refused(fire))?,
                "deferred",
                fire,
            )
            .map_err(|_| refused(fire))?;
            if saved.record.member != member.record.member
                || saved.record.home != member.record.home
                || saved.record.references != member.record.references
                || saved.record.contract != member.record.contract
            {
                return Err(refused(fire));
            }
            Ok(receipt(&saved))
        }
        Err(_) => Err(refused(fire)),
    }
}

/// One joined row per member/attempt, retaining every panel or fallback reference.
/// `member` is the queue identity; repeated member IDs are distinct attempt rows.
#[derive(Debug, Serialize)]
pub struct DeferredInput {
    pub member: String,
    pub home: Home,
    pub state: InitialState,
    pub enqueued_at: u64,
    pub references: References,
}
#[derive(Debug, Serialize)]
pub struct DeferredInventory {
    pub members: Vec<DeferredInput>,
}

/// Unfiltered discovery: no cursor, directory scan, rendering or settlement test.
pub async fn enumerate_deferred(store: &Store) -> Result<DeferredInventory> {
    let view = persistence::read(store).await?;
    let records = persistence::records(&view.snapshot.data)?;
    let homes: BTreeMap<String, IndexedHome> = records
        .get("homes")
        .cloned()
        .map(serde_json::from_value)
        .transpose()?
        .unwrap_or_default();
    let mut members = BTreeMap::<String, QueuedMember>::new();
    for indexed in homes.values() {
        if records
            .get("deferred")
            .and_then(|values| values.get(&indexed.fire))
            .is_none()
        {
            continue;
        }
        let saved: QueuedMember = persistence::get(&records, "deferred", &indexed.fire)?;
        let admission: Admission = persistence::get(&records, "admissions", &indexed.fire)?;
        home(&records, &admission)?;
        if saved.record.member != indexed.fire
            || saved.record.home != indexed.home
            || saved.record.references.is_empty()
            || saved.record.references.iter().any(|reference| {
                reference.fire != indexed.fire || reference.manifest != admission.artifact
            })
        {
            return Err(Error::Conflict("deferred member binding mismatch".into()));
        }
        members.insert(saved.record.member.clone(), saved);
    }
    Ok(DeferredInventory {
        members: members
            .into_values()
            .flat_map(|saved| {
                saved
                    .record
                    .references
                    .into_iter()
                    .map(move |references| DeferredInput {
                        member: saved.record.member.clone(),
                        home: saved.record.home.clone(),
                        state: saved.state.clone(),
                        enqueued_at: saved.record.enqueued_at,
                        references,
                    })
            })
            .collect(),
    })
}
