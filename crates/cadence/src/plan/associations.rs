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
    item.associations()
}

fn validate_items(truths: &[cadence::context::model::Truth], phase: u32, contributions: &[Contribution]) -> Result<()> {
    let mut definitions = std::collections::BTreeMap::<String, (Value, u32)>::new();
    for contribution in contributions {
        let mut ids = std::collections::BTreeSet::new();
        for (index, item) in contribution.items.iter().enumerate() {
            let base = match contribution.entry {
                Some(entry) => format!("submission.plans[{entry}].content.evidence_map.items[{index}]"),
                None => format!("current.plans[{}].evidence_map.items[{index}]", contribution.plan),
            };
            let refuse = |rule: &str, slot: &str, reason: String| Diagnostic {
                rule: rule.into(), slot: format!("{base}.{slot}"), phase: Some(phase),
                entry: contribution.entry, id: Some(item.id().into()), reason,
            }.error();
            if item.id().trim().is_empty() {
                return Err(refuse("evidence-item-shape", "id", "item id must be a nonblank opaque string".into()));
            }
            if !ids.insert(item.id()) {
                return Err(refuse("duplicate-evidence-item", "id",
                    format!("phase {phase} plan {} defines item {} more than once", contribution.plan, item.id())));
            }
            if item.reason().trim().is_empty() {
                return Err(refuse("evidence-item-shape", "reason", format!("phase {phase} item {} needs its own nonblank reason", item.id())));
            }
            if item.associations().is_empty() {
                return Err(refuse("evidence-item-truth", "associations", format!("phase {phase} item {} names no bound truth", item.id())));
            }
            for (edge, association) in item.associations().iter().enumerate() {
                if association.reason.trim().is_empty() {
                    return Err(refuse("evidence-item-shape", &format!("associations[{edge}].reason"),
                        format!("phase {phase} item {} association needs its own nonblank reason", item.id())));
                }
                if !truths.iter().any(|truth| truth.id == association.truth_id) {
                    return Err(refuse("evidence-item-truth", &format!("associations[{edge}].truth_id"),
                        format!("phase {phase} item {} requests truth {} but current bound-phase membership is absent", item.id(), association.truth_id)));
                }
            }
            let definition = map_history::definition(item)?;
            if let Some((prior, plan)) = definitions.get(item.id()) {
                if *prior != definition {
                    return Err(refuse("evidence-item-conflict", "id", format!(
                        "phase {phase} shared item {} has conflicting definitions in plan {plan} and plan {}", item.id(), contribution.plan)));
                }
            } else {
                definitions.insert(item.id().into(), (definition, contribution.plan));
            }
        }
    }
    Ok(())
}

#[derive(Serialize)]
pub struct Coverage {
    pub uncovered: Vec<String>,
    pub without_check: Vec<String>,
}

pub fn validate(data: &Value, submission: &Submission) -> Result<Coverage> {
    let phase = submission.phase.get();
    let context = cadence::context::persistence::saved(data, phase)?
        .ok_or_else(|| Diagnostic { rule: "native-approved-truths".into(), slot: "submission.phase".into(),
            phase: Some(phase), entry: None, id: None,
            reason: format!("phase {phase} current native truth authority is absent; use context-submit") }.error())?;
    let contributions = candidate(data, submission)?;
    validate_items(&context.truths, phase, &contributions)?;
    let uncovered = context.truths.iter().filter(|truth| {
        !contributions.iter().flat_map(|c| &c.items).flat_map(associations)
            .any(|a| a.truth_id == truth.id && a.truth_version == truth.version)
    }).map(|truth| truth.id.clone()).collect::<Vec<_>>();
    let attached = submission.plans.iter().any(|entry| matches!(entry.content.evidence_map, Some(Map::Attached { .. })));
    if attached
        && let Some(id) = uncovered.first()
    {
        return Err(Diagnostic { rule: "uncovered-truth".into(), slot: "submission.plans".into(),
            phase: Some(phase), entry: None, id: Some(id.clone()),
            reason: format!("phase {phase} current truth {id} has no evidence association in the resulting current phase set") }.error());
    }
    // Presence is the lower bound: repeated aliases of a shared check cannot
    // count as extra checks. Phase 29 owns the distinct-check upper bound.
    let without_check = context.truths.iter().filter(|truth| {
        !contributions.iter().flat_map(|c| &c.items)
            .filter(|item| matches!(item, Item::Check { .. })).flat_map(associations)
            .any(|a| a.truth_id == truth.id && a.truth_version == truth.version)
    }).map(|truth| truth.id.clone()).collect::<Vec<_>>();
    if attached && let Some(id) = without_check.first() {
        return Err(Diagnostic { rule: "truth-without-check".into(), slot: "submission.plans".into(),
            phase: Some(phase), entry: None, id: Some(id.clone()),
            reason: format!("phase {phase} current truth {id} has evidence but no current check; supplementary evidence cannot replace its check") }.error());
    }
    Ok(Coverage { uncovered, without_check })
}
