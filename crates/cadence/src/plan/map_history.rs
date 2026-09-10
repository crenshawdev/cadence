//! Immutable acceptance specifications bound to publication events and receipts.
use super::{evidence::{Item, Map}, model::{Identity, Publication, Submission, Approval}};
use cadence::store::{Error, Result, model::digest};
use serde::{Serialize, Deserialize};
use serde_json::{Value, json};
use std::collections::BTreeMap;

pub const NAMESPACE: &str = "acceptance_maps";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Revision {
    pub revision: String,
    pub occurrence: String,
    pub request_id: String,
    pub payload_digest: String,
    pub identity: Identity,
    pub content_revision: String,
    pub items: Vec<Item>,
    pub item_revisions: BTreeMap<String, String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct History {
    pub occurrence: String,
    pub revisions: Vec<Revision>,
}

pub fn saved(data: &Value, phase: u32) -> Result<Option<History>> {
    let Some(namespace) = data.get(NAMESPACE) else { return Ok(None) };
    if namespace["schema"] != "acceptance-map-1" {
        return Err(Error::Invalid("unsupported acceptance map namespace".into()));
    }
    namespace["phases"].get(phase.to_string()).cloned()
        .map(serde_json::from_value).transpose().map_err(Error::from)
}

/// Associations have independent reasons and origins; only the item's stable
/// definition participates in its revision digest.
pub fn definition(item: &Item) -> Result<Value> {
    let mut value = serde_json::to_value(item)?;
    value.as_object_mut().expect("item object").remove("associations");
    Ok(value)
}

pub fn event_id(submission: &Submission, identity: &Identity) -> Result<String> {
    Ok(digest(&serde_json::to_vec(&(&submission.occurrence, &submission.request_id, identity))?))
}

pub fn contribute(data: &mut Value, submission: &Submission, approval: &Approval, results: &[Publication]) -> Result<()> {
    let phase = submission.phase.get();
    let mut history = saved(data, phase)?.unwrap_or_else(|| History {
        occurrence: submission.occurrence.clone(), revisions: vec![],
    });
    if history.occurrence != submission.occurrence {
        return Err(Error::Invalid("acceptance map occurrence changed".into()));
    }
    let old_len = history.revisions.len();
    for publication in results {
        let Some(Map::Attached { items }) = &publication.content.evidence_map else { continue };
        let mut item_revisions = BTreeMap::new();
        for item in items {
            let definition = definition(item)?;
            item_revisions.insert(definition["id"].as_str().expect("item id").to_owned(), digest(&serde_json::to_vec(&definition)?));
        }
        history.revisions.push(Revision {
            revision: event_id(submission, &publication.identity)?,
            occurrence: submission.occurrence.clone(), request_id: submission.request_id.clone(),
            payload_digest: super::persistence::payload_digest(submission, approval)?,
            identity: publication.identity.clone(), content_revision: publication.revision.clone(),
            items: items.clone(), item_revisions,
        });
    }
    if history.revisions.len() != old_len {
        let namespace = data.as_object_mut().ok_or_else(|| Error::Invalid("map snapshot must be an object".into()))?
            .entry(NAMESPACE).or_insert_with(|| json!({"schema":"acceptance-map-1","phases":{}}));
        namespace["phases"][phase.to_string()] = serde_json::to_value(history)?;
    }
    Ok(())
}
