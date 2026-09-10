//! The resulting phase set removes every replaced contribution before union.
use super::{evidence::{Item, Map}, model::{Diagnostic, Submission}, persistence, map_history};
use cadence::store::{Error, Result};
use serde::Serialize;
use serde_json::Value;

pub struct Contribution {
    pub plan: u32,
    pub entry: Option<usize>,
    pub items: Vec<Item>,
}

pub fn candidate(data: &Value, submission: &Submission) -> Result<Vec<Contribution>> {
    let phase = submission.phase.get();
    let mut contributions = Vec::new();
    let history = map_history::saved(data, phase)?;
    if let Some(saved) = persistence::saved(data, phase)? {
        for publication in saved.publications.values() {
            if submission.plans.iter().any(|entry| entry.target == publication.identity) { continue; }
            let Some(revision) = &publication.map_revision else { continue };
            let event = history.as_ref().and_then(|h| h.revisions.iter().find(|r| &r.revision == revision))
                .ok_or_else(|| Error::Invalid("current publication lacks its acceptance map".into()))?;
            if event.identity != publication.identity || event.content_revision != publication.revision
                || event.occurrence != submission.occurrence
            {
                return Err(Error::Invalid("current map publication binding is inconsistent".into()));
            }
            contributions.push(Contribution { plan: publication.identity.plan.get(), entry: None, items: event.items.clone() });
        }
    }
    for (index, entry) in submission.plans.iter().enumerate() {
        if let Some(Map::Attached { items }) = &entry.content.evidence_map {
            contributions.push(Contribution { plan: entry.target.plan.get(), entry: Some(index), items: items.clone() });
        }
    }
    Ok(contributions)
}

fn associations(item: &Item) -> &[super::evidence::Association] {
    match item {
        Item::Check { associations, .. } | Item::Artifact { associations, .. }
        | Item::Link { associations, .. } | Item::Observation { associations, .. } => associations,
    }
}

#[derive(Serialize)]
pub struct Coverage {
    pub uncovered: Vec<String>,
}

pub fn validate(data: &Value, submission: &Submission) -> Result<Coverage> {
    let phase = submission.phase.get();
    let context = cadence::context::persistence::saved(data, phase)?
        .ok_or_else(|| Diagnostic { rule: "native-approved-truths".into(), slot: "submission.phase".into(),
            phase: Some(phase), entry: None, id: None,
            reason: format!("phase {phase} current native truth authority is absent; use context-submit") }.error())?;
    let contributions = candidate(data, submission)?;
    let uncovered = context.truths.iter().filter(|truth| {
        !contributions.iter().flat_map(|c| &c.items).flat_map(associations)
            .any(|a| a.truth_id == truth.id && a.truth_version == truth.version)
    }).map(|truth| truth.id.clone()).collect::<Vec<_>>();
    if submission.plans.iter().any(|entry| matches!(entry.content.evidence_map, Some(Map::Attached { .. })))
        && let Some(id) = uncovered.first()
    {
        return Err(Diagnostic { rule: "uncovered-truth".into(), slot: "submission.plans".into(),
            phase: Some(phase), entry: None, id: Some(id.clone()),
            reason: format!("phase {phase} current truth {id} has no evidence association in the resulting current phase set") }.error());
    }
    Ok(Coverage { uncovered })
}
