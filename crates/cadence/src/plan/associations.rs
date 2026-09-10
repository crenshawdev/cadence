//! The resulting phase set removes every replaced contribution before union.
use super::{evidence::{Item, Map}, model::{Diagnostic, Submission}, persistence, map_history};
use cadence::store::{Error, Result};
use serde::Serialize;
use serde_json::Value;

/// Locate a malformed numeric slot before typed decoding loses its JSON path.
/// Valid numeric values, including zero, are compared to native authority later.
pub fn malformed_version(raw: &Value) -> Option<Diagnostic> {
    let submission = &raw["submission"];
    let plans = submission["plans"].as_array()?;
    for (entry, plan) in plans.iter().enumerate() {
        let map = &plan["content"]["evidence_map"];
        if map["mode"] != "attached" { continue; }
        let Some(items) = map["items"].as_array() else { continue };
        for (item_index, item) in items.iter().enumerate() {
            let Some(associations) = item["associations"].as_array() else { continue };
            for (edge, association) in associations.iter().enumerate() {
                if association["truth_version"].as_u64().is_some_and(|n| u32::try_from(n).is_ok()) { continue; }
                return Some(Diagnostic {
                    details: None,
                    rule: "evidence-association-shape".into(),
                    slot: format!("submission.plans[{entry}].content.evidence_map.items[{item_index}].associations[{edge}].truth_version"),
                    phase: submission["phase"].as_u64().and_then(|n| u32::try_from(n).ok()),
                    entry: Some(entry), id: item["id"].as_str().map(str::to_owned),
                    reason: format!("item {} truth {} has {} truth_version; supply an explicit numeric version with no inferred default",
                        item["id"], association["truth_id"],
                        if association.get("truth_version").is_none() { "missing" } else { "malformed" }),
                });
            }
        }
    }
    None
}

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
                details: None,
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
                let Some(truth) = truths.iter().find(|truth| truth.id == association.truth_id) else {
                    return Err(refuse("evidence-item-truth", &format!("associations[{edge}].truth_id"),
                        format!("phase {phase} item {} requests truth {} but current bound-phase membership is absent", item.id(), association.truth_id)));
                };
                if association.truth_version != truth.version {
                    return Err(refuse("truth-version-mismatch", &format!("associations[{edge}].truth_version"),
                        format!("phase {phase} item {} truth {} requested {}, current {}; an explicit current version is required",
                            item.id(), truth.id, association.truth_version, truth.version)));
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
            details: None,
            phase: Some(phase), entry: None, id: None,
            reason: format!("phase {phase} current native truth authority is absent; use context-submit") }.error())?;
    let contributions = candidate(data, submission)?;
    let attached = submission.plans.iter().any(|entry| matches!(entry.content.evidence_map, Some(Map::Attached { .. })));
    validate_union(&context, phase, &contributions, attached)
}

/// Publication and admission share the current-union rules, without inventing
/// a proposed publication to validate an already retained execution contract.
pub fn validate_union(context: &cadence::context::model::ApprovedContext, phase: u32,
    contributions: &[Contribution], attached: bool) -> Result<Coverage>
{
    validate_items(&context.truths, phase, contributions)?;
    let uncovered = context.truths.iter().filter(|truth| {
        !contributions.iter().flat_map(|c| &c.items).flat_map(associations)
            .any(|a| a.truth_id == truth.id && a.truth_version == truth.version)
    }).map(|truth| truth.id.clone()).collect::<Vec<_>>();
    if attached
        && let Some(id) = uncovered.first()
    {
        return Err(Diagnostic { rule: "uncovered-truth".into(), slot: "submission.plans".into(),
            details: None,
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
            details: None,
            phase: Some(phase), entry: None, id: Some(id.clone()),
            reason: format!("phase {phase} current truth {id} has evidence but no current check; supplementary evidence cannot replace its check") }.error());
    }
    if attached {
        super::limits::content(phase, contributions)?;
        super::limits::links(context, phase, contributions)?;
        super::limits::checks(phase, contributions)?;
    }
    Ok(Coverage { uncovered, without_check })
}
