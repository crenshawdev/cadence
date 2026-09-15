//! Review records share Snapshot.data and the store's sole transaction journal.
use cadence::store::transaction::{Transaction, preserve_provenance};
use cadence::store::writer::{Operation, Store, View};
use cadence::store::{Error, Observed, Result, Storage};
use serde::{Serialize, de::DeserializeOwned};
use serde_json::{Value, json};
use std::collections::BTreeMap;

pub const NAMESPACE: &str = "review";

pub fn records(data: &Value) -> Result<Value> {
    match data.get(NAMESPACE) {
        None => Ok(json!({"schema":"review-1"})),
        Some(value) if value["schema"] == "review-1" => Ok(value.clone()),
        Some(_) => Err(Error::Invalid("unsupported review namespace".into())),
    }
}

pub fn get<T: DeserializeOwned>(records: &Value, family: &str, id: &str) -> Result<T> {
    let value = records
        .get(family)
        .and_then(|values| values.get(id))
        .ok_or_else(|| Error::Invalid(format!("missing review {family}: {id}")))?;
    Ok(serde_json::from_value(value.clone())?)
}

pub fn put<T: Serialize>(records: &mut Value, family: &str, id: &str, value: &T) -> Result<()> {
    if id.is_empty() {
        return Err(Error::Invalid("empty review identity".into()));
    }
    let object = records
        .as_object_mut()
        .ok_or_else(|| Error::Invalid("invalid review records".into()))?;
    let family = object.entry(family).or_insert_with(|| json!({}));
    family
        .as_object_mut()
        .ok_or_else(|| Error::Invalid("invalid review collection".into()))?
        .insert(id.into(), serde_json::to_value(value)?);
    Ok(())
}

pub fn insert<T: Serialize>(records: &mut Value, family: &str, id: &str, value: &T) -> Result<()> {
    let encoded = serde_json::to_value(value)?;
    if let Some(saved) = records.get(family).and_then(|values| values.get(id)) {
        return if saved == &encoded {
            Ok(())
        } else {
            Err(Error::Conflict(format!("immutable review {family}: {id}")))
        };
    }
    put(records, family, id, value)
}

/// Merge into the caller's proposed snapshot, preserving all other participants.
pub fn contribute(view: &View, transaction: &mut Transaction, records: Value) -> Result<()> {
    let mut data = transaction
        .snapshot
        .clone()
        .unwrap_or_else(|| view.snapshot.data.clone());
    preserve_provenance(&view.snapshot.data, &data)?;
    let object = data
        .as_object_mut()
        .ok_or_else(|| Error::Invalid("durable review home unavailable".into()))?;
    object.insert(NAMESPACE.into(), records);
    transaction.snapshot = Some(data);
    Ok(())
}

pub fn transaction(view: &View, name: &str) -> Transaction {
    Transaction {
        id: format!(
            "review:{name}:{}:{}",
            view.snapshot.generation, view.snapshot.integrity
        ),
        items: vec![],
        decisions: vec![],
        snapshot: None,
        external: vec![],
    }
}

pub async fn commit(store: &Store, view: &View, transaction: Transaction) -> Result<View> {
    store
        .request(Operation::CompareTransact {
            expected_generation: view.snapshot.generation,
            expected_integrity: view.snapshot.integrity.clone(),
            transaction,
        })
        .await
}

pub async fn read(store: &Store) -> Result<View> {
    store.request(Operation::ReadVerified).await
}

/// A transaction-local material participant. Plan 2's acquisition and mapping
/// code writes these logical records; only the encompassing CompareTransact
/// makes them durable. It never opens paths or acknowledges a dispatch.
#[derive(Clone, Default)]
pub struct MaterialStorage {
    pub retained: BTreeMap<String, Vec<u8>>,
}
impl MaterialStorage {
    pub fn from_records(records: &Value) -> Result<Self> {
        Ok(Self {
            retained: records
                .get("retained")
                .cloned()
                .map(serde_json::from_value)
                .transpose()?
                .unwrap_or_default(),
        })
    }
    pub fn contribute(&self, records: &mut Value) -> Result<()> {
        for (key, bytes) in &self.retained {
            insert(records, "retained", key, bytes)?;
        }
        Ok(())
    }
}
impl Storage for MaterialStorage {
    type Prepared = (String, Vec<u8>);
    fn read(&mut self, target: &str) -> Result<Observed> {
        if !target.starts_with("material-") {
            return Err(Error::Invalid("not a material record".into()));
        }
        let bytes = self.retained.get(target).cloned();
        Ok(Observed {
            identity: bytes
                .as_deref()
                .map(cadence::store::model::digest)
                .unwrap_or_default(),
            bytes,
            directory_identity: "review:retained".into(),
        })
    }
    fn prepare(&mut self, target: &str, bytes: &[u8]) -> Result<Self::Prepared> {
        Ok((target.into(), bytes.into()))
    }
    fn install(&mut self, prepared: &Self::Prepared) -> Result<()> {
        if self
            .retained
            .get(&prepared.0)
            .is_some_and(|old| old != &prepared.1)
        {
            return Err(Error::Conflict("retained material is immutable".into()));
        }
        self.retained.insert(prepared.0.clone(), prepared.1.clone());
        Ok(())
    }
    fn discard(&mut self, _: Self::Prepared) -> Result<()> {
        Ok(())
    }
    fn confirm(&mut self, target: &str, bytes: &[u8]) -> Result<Observed> {
        let saved = self.read(target)?;
        if saved.bytes.as_deref() != Some(bytes) {
            return Err(Error::Conflict("material bytes differ".into()));
        }
        Ok(saved)
    }
    fn resync(&mut self, target: &str, bytes: &[u8]) -> Result<Observed> {
        self.confirm(target, bytes)
    }
    fn remove(&mut self, _: &str) -> Result<()> {
        Err(Error::Invalid("retained deletion forbidden".into()))
    }
}

pub async fn update(store: &Store, view: &View, name: &str, records: Value) -> Result<View> {
    let mut transaction = transaction(view, name);
    contribute(view, &mut transaction, records)?;
    commit(store, view, transaction).await
}

pub fn terminal_count(records: &Value, attempt: &str) -> usize {
    records
        .get("closures")
        .and_then(Value::as_object)
        .map_or(0, |closures| {
            closures
                .values()
                .filter(|closure| closure["attempt"] == attempt)
                .count()
        })
}
