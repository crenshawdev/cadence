//! Immutable close selections and request receipts in the existing store.
use crate::envelope::Refusal;
use crate::store::{Error, Result, model::digest, transaction::Transaction, writer::{Operation, Store, View}};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::BTreeMap, num::NonZeroU32};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Selection {
    pub phases: Vec<NonZeroU32>,
    pub label: String,
}
impl Selection {
    pub fn validate(&self) -> Result<()> {
        if self.phases.is_empty() || self.phases.windows(2).any(|w| w[0] >= w[1]) {
            return Err(Error::Invalid("phases must be a nonempty sorted set of positive integers".into()));
        }
        name(&self.label)
    }
}

pub fn name(value: &str) -> Result<()> {
    if value.trim().is_empty() || value.len() > 1024 || value.chars().any(char::is_control) {
        return Err(Error::Invalid("identity or label must be nonblank, bounded text without control characters".into()));
    }
    Ok(())
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct CloseRequest {
    pub request_id: String,
    pub occurrence: String,
    pub expected_generation: u64,
    pub selection: Selection,
}
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum Apply {
    #[serde(rename = "milestone-release")]
    Release { request: super::release::Request },
    #[serde(rename = "milestone-release-confirm")]
    ReleaseConfirm { request: super::release::Confirm },
    #[serde(rename = "milestone-close")]
    Close { request: CloseRequest },
    #[serde(rename = "milestone-prune")]
    Prune { request: PruneRequest },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct PruneRequest {
    pub request_id: String,
    pub close: String,
    pub expected_generation: u64,
    pub selection: Selection,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum State { Ready }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Close {
    pub id: String,
    pub root_binding: String,
    pub occurrence: String,
    pub generation: u64,
    pub selection: Selection,
    pub state: State,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Receipt {
    pub root_binding: String,
    pub request_id: String,
    pub request: Value,
    pub answer: Value,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Records<T> {
    pub schema: u32,
    pub records: BTreeMap<String, T>,
    pub receipts: BTreeMap<String, Receipt>,
}

pub fn records<T: serde::de::DeserializeOwned>(data: &Value, namespace: &str) -> Result<Records<T>> {
    let records: Records<T> = match data.get(namespace) {
        Some(value) => serde_json::from_value(value.clone())?,
        None => Records { schema: 1, records: BTreeMap::new(), receipts: BTreeMap::new() },
    };
    if records.schema != 1 { return Err(Error::Invalid(format!("unsupported {namespace} records"))); }
    for (key, receipt) in &records.receipts {
        if *key != request_key(&receipt.root_binding, &receipt.request)? {
            return Err(Error::Invalid(format!("invalid {namespace} receipt binding")));
        }
    }
    Ok(records)
}

pub fn identity(kind: &str, root: &str, occurrence: &str) -> String {
    format!("{kind}-{}", digest(format!("{root}\0{occurrence}").as_bytes()))
}
pub fn request_key(root: &str, request: &Value) -> Result<String> {
    Ok(digest(&serde_json::to_vec(&(root, request))?))
}
pub fn replay<T>(records: &Records<T>, root: &str, id: &str, request: &Value) -> Result<Option<Value>> {
    Ok(records.receipts.get(&request_key(root, request)?).filter(|r| r.request_id == id).map(|r| r.answer.clone()))
}
pub fn reused<T>(records: &Records<T>, root: &str, id: &str) -> bool {
    records.receipts.values().any(|r| r.root_binding == root && r.request_id == id)
}
pub fn refuse(code: &str, reason: impl Into<String>) -> Value {
    Refusal::new(code, reason).value()
}

pub async fn persist<T: Serialize>(store: &Store, view: &View, namespace: &str, records: &mut Records<T>, receipt: Receipt) -> Result<Value> {
    let key = request_key(&receipt.root_binding, &receipt.request)?;
    let answer = receipt.answer.clone();
    records.receipts.insert(key.clone(), receipt);
    let mut data = view.snapshot.data.clone();
    data.as_object_mut().ok_or_else(|| Error::Invalid("store data is not an object".into()))?
        .insert(namespace.into(), serde_json::to_value(records)?);
    store.request(Operation::CompareTransact {
        expected_generation: view.snapshot.generation,
        expected_integrity: view.snapshot.integrity.clone(),
        transaction: Transaction { id: format!("{namespace}:{key}"), items: vec![], decisions: vec![], snapshot: Some(data), external: vec![] },
    }).await?;
    Ok(answer)
}
