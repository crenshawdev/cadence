//! Debug consumes confirmed rail facts, never ordinary Settlement::Verified.
use super::model;
use crate::{rail::{receipts, risk}, review::{model::Attempt, originals, persistence},
    store::{Error, Result, writer::{Operation, Store, View}}};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{collections::BTreeMap, path::Path};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Returned {
    pub original: String,
    pub finding_ids: Vec<String>,
    pub findings: Value,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct FireReview {
    pub fire: receipts::Fire,
    pub admitted: bool,
    pub receipt: Option<receipts::Receipt>,
    pub returns: Vec<Returned>,
}

fn permits(fire: &receipts::Fire, entries: &[FireReview]) -> bool {
    let Some(entry) = entries.iter().find(|entry| entry.fire == *fire && entry.admitted) else { return false; };
    match entry.receipt.as_ref().map(|r| &r.consequence) {
        Some(receipts::Consequence::GatePass { .. }) => true,
        Some(receipts::Consequence::Override { reason }) => !reason.trim().is_empty(),
        Some(receipts::Consequence::Rearm { next_fire }) =>
            receipts::validate_rearm(fire, next_fire).is_ok() && permits(next_fire, entries),
        _ => false,
    }
}

/// Rebuilt by both the owning writer and intent recovery from the same preimage.
pub fn contribute(data: &Value, root_binding: &str) -> Result<Value> {
    let mut saved = model::namespace(data)?;
    let (observations, fires, receipts) = receipts::history(data)?;
    let records = persistence::records(data)?;
    let attempts: BTreeMap<String, Attempt> = records.get("attempts").cloned()
        .map(serde_json::from_value).transpose()?.unwrap_or_default();
    for record in saved.records.values_mut() {
        let Some(review) = &mut record.review else { continue; };
        if review.fire.is_none() { continue; }
        if record.root_binding != root_binding { return Err(Error::Invalid("debug review root binding changed".into())); }
        let observation = observations.iter().find(|o| o.observation.request_id == review.observation
            && o.observation.scope.occurrence() == record.slug)
            .ok_or_else(|| Error::Invalid("debug review lacks its observation".into()))?;
        let boundary = receipts::Boundary { scope: observation.observation.scope.clone(),
            run_id: record.slug.clone(), after_generation: 0 };
        if !matches!(boundary.scope, risk::Scope::RootDebug { .. }) {
            return Err(Error::Invalid("debug review requires root-debug scope".into()));
        }
        let mut entries = Vec::new();
        for fire in fires.iter().filter(|fire| fire.binding.boundary == boundary) {
            let admission = &records["admissions"][&fire.id];
            let manifest = &records["manifests"][admission["artifact"].as_str().unwrap_or("")];
            let admitted = admission["caller"] == "debug" && admission["discriminator"] == record.slug
                && admission["home"]["kind"] == "root-debug" && admission["home"]["id"] == record.slug
                && admission["trigger"] == "risk_surface"
                && manifest["fire"] == fire.id
                && manifest["target"] == json!({"kind":"staged-tree","base":fire.binding.material.base_id(),
                    "index":fire.binding.material.tip_id(),"head":null});
            let mut returned = Vec::new();
            for attempt in attempts.values().filter(|a| a.fire == fire.id) {
                if let Some(id) = &attempt.original {
                    let original = originals::saved_original(&records, id)?;
                    if original.attempt.as_deref() != Some(&attempt.attempt)
                        || original.artifact.as_deref() != Some(&attempt.view.manifest)
                        || admission["artifact"] != attempt.view.manifest {
                        return Err(Error::Invalid("debug original differs from admitted attempt".into()));
                    }
                    returned.push(Returned { original: id.clone(), finding_ids: original.citations.iter()
                        .map(|c| format!("{}:{}", c.finding.original, c.finding.index)).collect(),
                        findings: serde_json::to_value(original.parsed.map(|p| p.findings))? });
                }
            }
            entries.push(FireReview { fire: fire.clone(), admitted,
                receipt: receipts.iter().find(|r| r.fire == *fire).cloned(), returns: returned });
        }
        review.pending_fires = entries.iter().filter(|entry| !permits(&entry.fire, &entries))
            .map(|entry| entry.fire.id.clone()).collect();
        if let Some(id) = &review.fire
            && !entries.iter().any(|entry| entry.fire.id == *id) {
            review.pending_fires.push(id.clone());
        }
        review.settled = review.pending_fires.is_empty();
        review.history = entries;
    }
    let mut next = data.clone();
    if data.get("debug").is_some() { next["debug"] = serde_json::to_value(saved)?; }
    Ok(next)
}

/// Every terminal branch must still cover the exact index and surface selection.
/// A parent receipt delegates only to its recorded, validated child.
pub fn current(review: &model::Review, material: &risk::MaterialIdentity, surfaces: &[String]) -> bool {
    !review.history.is_empty() && review.history.iter().all(|entry| {
        let terminal = match entry.receipt.as_ref().map(|r| &r.consequence) {
            Some(receipts::Consequence::Rearm { next_fire }) => next_fire.as_ref(),
            _ => &entry.fire,
        };
        terminal.binding.material == *material && terminal.binding.surfaces == surfaces
    })
}

pub async fn synchronize(store: &Store, root: &Path) -> Result<View> {
    let view = store.request(Operation::ReadVerified).await?;
    receipts::confirmed_history(&view)?;
    let root_binding = crate::verification::inputs::root_binding(root)?;
    if contribute(&view.snapshot.data, &root_binding)? == view.snapshot.data { return Ok(view); }
    store.request(Operation::DebugReviewV1 { expected_generation: view.snapshot.generation,
        expected_integrity: view.snapshot.integrity.clone(), root_binding }).await
}

pub fn changed(before: &Value, after: &Value) -> Result<Vec<String>> {
    let old = model::namespace(before)?;
    Ok(model::namespace(after)?.records.into_iter().filter(|(slug, record)| old.records.get(slug) != Some(record))
        .map(|(slug, _)| slug).collect())
}
