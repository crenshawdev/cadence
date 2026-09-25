use super::model::Selection;
use crate::{rail::receipts::{self, Consequence, Fire, Receipt}, store::{Result, writer::{Store, View}}};
use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize)]
pub struct Unsettled {
    pub kind: String,
    pub phase: Option<u32>,
    pub identity: String,
}

fn settled(fire: &Fire, receipts: &[Receipt], depth: usize) -> bool {
    if depth > receipts.len() { return false; }
    match receipts.iter().find(|r| r.fire == *fire).map(|r| &r.consequence) {
        Some(Consequence::GatePass { .. } | Consequence::Override { .. } | Consequence::Adjudication { passed: true, .. }) => true,
        Some(Consequence::Rearm { next_fire }) => settled(next_fire, receipts, depth + 1),
        _ => false,
    }
}

pub async fn collect(store: &Store, view: &View, selection: &Selection) -> Result<Vec<Unsettled>> {
    receipts::confirmed_history(view)?;
    let (observations, fires, receipts) = receipts::history(&view.snapshot.data)?;
    let mut unsettled = Vec::new();
    for record in observations {
        let Some(phase) = record.observation.scope.phase() else { continue; };
        if !selection.phases.contains(&phase) || !receipts::requires_review(&record) { continue; }
        let bound: Vec<_> = fires.iter().filter(|f| f.binding.matches(&record)).collect();
        if bound.is_empty() || bound.iter().any(|f| !settled(f, &receipts, 0)) {
            unsettled.push(Unsettled { kind: "risk".into(), phase: Some(phase.get()), identity: record.confirmation.decision_id });
        }
    }
    unsettled.extend(crate::review::consumers::unruled_members(store).await?.into_iter()
        .filter(|m| m.phase.is_some_and(|p| selection.phases.iter().any(|selected| selected.get() == p))));
    order(&mut unsettled);
    Ok(unsettled)
}

pub fn order(unsettled: &mut Vec<Unsettled>) {
    unsettled.sort_by(|a, b| (&a.phase, &a.kind, &a.identity).cmp(&(&b.phase, &b.kind, &b.identity)));
    unsettled.dedup();
}
