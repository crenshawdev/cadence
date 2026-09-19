//! The resulting phase set removes every replaced contribution before union.
use super::{evidence::{Item, Map}, model::{Diagnostic, Submission}, persistence, map_history};
use cadence::store::{Error, Result};
use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;

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

impl Contribution {
    pub fn current_items(&self) -> impl Iterator<Item = (usize, &Item)> {
        self.items.iter().enumerate()
    }
}

/// Canonical check revisions released by blocked plans or replaced rejected
/// verification, paired with the admission version through which their saved
/// definitions stop being current.
pub fn released_check_revisions(data: &Value, phase: u32) -> Result<BTreeMap<String, u64>> {
    released_check_revisions_with_submission(data, phase, None)
}

fn released_check_revisions_with_submission(data: &Value, phase: u32,
    submission: Option<&Submission>) -> Result<BTreeMap<String, u64>>
{
    use crate::execution::{history, model::{PlanDisposition, PlanOutcome}};

    let records = history::records(data, phase)?;
    let admitted = history::admitted_plans(data, phase)?;
    let outcomes: Vec<PlanOutcome> = data["execution"]["occurrences"]
        .get(phase.to_string()).and_then(|occurrence| occurrence.get("plans")).cloned()
        .map(serde_json::from_value).transpose()?.unwrap_or_default();
    let mut released = BTreeMap::<String, u64>::new();
    for (identity, admitted_at) in &admitted {
        if !outcomes.iter().any(|outcome| outcome.plan == identity.plan
            && outcome.disposition == PlanDisposition::Blocked)
        {
            continue;
        }
        for task in history::plan_task_views(data, &records, phase, identity.plan)? {
            if task.state.completed { continue; }
            for check in task.checks {
                released.entry(check.item_revision).and_modify(|through| {
                    *through = (*through).max(*admitted_at);
                }).or_insert(*admitted_at);
            }
        }
    }
    let patches = crate::verification::verdicts::patches(data)?;
    let rejected = patches.iter().filter(|patch| patch.basis.phase == phase)
        .flat_map(|patch| &patch.items)
        .filter(|item| item.verdict == crate::verification::model::Verdict::Rejected)
        .map(|item| (item.id.as_str(), item.item_revision.as_str()))
        .collect::<std::collections::BTreeSet<_>>();
    if rejected.is_empty() { return Ok(released); }
    let saved = persistence::saved(data, phase)?;
    let map_history = map_history::saved(data, phase)?;
    let mut current_events = Vec::new();
    if let Some(saved) = &saved {
        for publication in saved.publications.values() {
            let Some(revision) = &publication.map_revision else { continue };
            let (position, event) = map_history.as_ref()
                .and_then(|history| history.revisions.iter().enumerate()
                    .find(|(_, event)| &event.revision == revision))
                .ok_or_else(|| Error::Invalid("current publication lacks its acceptance map".into()))?;
            if event.identity != publication.identity || event.content_revision != publication.revision
                || event.occurrence != publication.occurrence
            {
                return Err(Error::Invalid("current map publication binding is inconsistent".into()));
            }
            current_events.push((position, event));
        }
    }
    let previewed_checks = submission.iter().flat_map(|submission| &submission.plans)
        .flat_map(|entry| match &entry.content.evidence_map {
            Some(Map::Attached { items }) => items.as_slice(),
            _ => &[],
        }).filter(|item| matches!(item, Item::Check { .. }))
        .map(Item::id).collect::<std::collections::BTreeSet<_>>();
    for (identity, admitted_at) in admitted {
        for task in history::plan_task_views(data, &records, phase, identity.plan)? {
            for check in task.checks {
                if !rejected.contains(&(check.id.as_str(), check.item_revision.as_str())) { continue; }
                let owner_position = current_events.iter()
                    .find(|(_, event)| event.identity.plan.get() == identity.plan)
                    .map(|(position, _)| *position);
                let saved_replacement = owner_position.is_some_and(|owner_position| {
                    current_events.iter().any(|(position, event)| *position > owner_position
                        && event.items.iter().any(|item| {
                            matches!(item, Item::Check { .. }) && item.id() == check.id
                        }))
                });
                if !previewed_checks.contains(check.id.as_str()) && !saved_replacement { continue; }
                released.entry(check.item_revision).and_modify(|through| {
                    *through = (*through).max(admitted_at);
                }).or_insert(admitted_at);
            }
        }
    }
    Ok(released)
}

pub fn candidate(data: &Value, submission: &Submission) -> Result<Vec<Contribution>> {
    let phase = submission.phase.get();
    let mut contributions = Vec::new();
    let history = map_history::saved(data, phase)?;
    let released = released_check_revisions_with_submission(data, phase, Some(submission))?;
    let admitted: BTreeMap<_, _> = crate::execution::history::admitted_plans(data, phase)?
        .into_iter().map(|(identity, version)| (identity.plan, version)).collect();
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
            let plan = publication.identity.plan.get();
            let items = event.items.iter().filter(|item| {
                if !matches!(item, Item::Check { .. }) { return true; }
                let Some(admitted_at) = admitted.get(&plan) else { return true };
                let Some(revision) = event.item_revisions.get(item.id()) else { return true };
                !released.get(revision).is_some_and(|through| admitted_at <= through)
            }).cloned().collect();
            contributions.push(Contribution { plan, entry: None, items });
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
        for (index, item) in contribution.current_items() {
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
        !contributions.iter().flat_map(|c| c.current_items().map(|(_, item)| item)).flat_map(associations)
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
        !contributions.iter().flat_map(|c| c.current_items().map(|(_, item)| item))
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
