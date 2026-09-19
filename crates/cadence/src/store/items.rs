//! Recall accepts this projection, never an unfiltered revision log.
use super::model::{Disposition, ItemRecord};
use super::writer::View;
use super::{Error, Result};
use std::collections::{BTreeMap, BTreeSet};

pub struct RecallItems<'a> {
    records: Vec<&'a ItemRecord>,
}
impl<'a> RecallItems<'a> {
    pub fn iter(&self) -> impl Iterator<Item = &'a ItemRecord> + '_ {
        self.records.iter().copied()
    }
}
impl View {
    pub fn recall_items(&self) -> RecallItems<'_> {
        let declined: BTreeSet<&str> = self
            .items
            .iter()
            .filter_map(|item| {
                matches!(item.disposition, Disposition::Declined { .. }).then_some(item.id.as_str())
            })
            .collect();
        let latest: BTreeMap<&str, u64> = self
            .items
            .iter()
            .map(|item| (item.id.as_str(), item.revision))
            .collect();
        RecallItems {
            records: self
                .items
                .iter()
                .filter(|item| {
                    !declined.contains(item.id.as_str())
                        && latest[item.id.as_str()] == item.revision
                })
                .collect(),
        }
    }

    /// Explicit evidence/dedup lookup. This is not a recall input.
    pub fn lookup_item(&self, id: &str) -> Option<&ItemRecord> {
        self.items.iter().rev().find(|item| item.id == id)
    }
}

pub enum ItemChange {
    File { pointer: String, uncertain: bool },
    Decline { reason: String },
    Complete,
}

pub fn revise(item: &ItemRecord, change: ItemChange) -> Result<ItemRecord> {
    if matches!(item.disposition, Disposition::Declined { .. }) {
        return Err(Error::Invalid("declined identity is terminal".into()));
    }
    let mut next = item.clone();
    next.revision = next
        .revision
        .checked_add(1)
        .ok_or_else(|| Error::Invalid("revision overflow".into()))?;
    match change {
        ItemChange::File { pointer, uncertain } => {
            if pointer.trim().is_empty() {
                return Err(Error::Invalid("empty filing pointer".into()));
            }
            next.disposition = Disposition::Filed { pointer };
            next.filing_uncertain = uncertain;
        }
        ItemChange::Decline { reason } => {
            if reason.trim().is_empty() {
                return Err(Error::Invalid("empty decline reason".into()));
            }
            next.disposition = Disposition::Declined { reason };
        }
        ItemChange::Complete => next.completed = true,
    }
    Ok(next)
}

/// Mirrors the guarded held-row update: an incoming uncertain result only
/// revises an already-held confirmed row, including a declined row's evidence.
pub fn mark_filing_uncertain(
    held: &ItemRecord,
    incoming_uncertain: bool,
) -> Result<Option<ItemRecord>> {
    if !incoming_uncertain || held.filing_uncertain {
        return Ok(None);
    }
    let mut next = held.clone();
    next.revision = next
        .revision
        .checked_add(1)
        .ok_or_else(|| Error::Invalid("revision overflow".into()))?;
    next.filing_uncertain = true;
    Ok(Some(next))
}
