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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::model::{Evidence, Origin, Snapshot, VERSION};

    fn item(id: &str, text: &str) -> ItemRecord {
        ItemRecord {
            version: VERSION,
            id: id.into(),
            revision: 1,
            origin: Origin { source: "capture".into(), original: Evidence::Missing },
            text: text.into(),
            kind: "todo".into(),
            phase: None,
            disposition: Disposition::Captured,
            completed: false,
            filing_uncertain: false,
        }
    }

    fn view(items: Vec<ItemRecord>) -> View {
        View { items, decisions: vec![], snapshot: Snapshot::new(1, b"", b"", serde_json::Value::Null).unwrap() }
    }

    fn recalled(view: &View) -> Vec<(&str, u64)> {
        view.recall_items().iter().map(|item| (item.id.as_str(), item.revision)).collect()
    }

    fn filed(pointer: &str, uncertain: bool) -> ItemChange {
        ItemChange::File { pointer: pointer.into(), uncertain }
    }

    #[test]
    fn recall_offers_each_identity_once_at_its_latest_revision() {
        let first = item("first", "same words");
        let completed = revise(&first, ItemChange::Complete).unwrap();
        let log = view(vec![first, item("second", "same words"), completed]);
        assert_eq!(recalled(&log), [("second", 1), ("first", 2)]);
    }

    #[test]
    fn a_declined_identity_is_absent_from_recall_in_every_revision() {
        let captured = item("quasar", "unique quasar");
        let filing = revise(&captured, filed("GH-1", false)).unwrap();
        let declined = revise(&filing, ItemChange::Decline { reason: "out of scope".into() }).unwrap();
        let log = view(vec![captured, filing, declined, item("other", "kept")]);
        assert_eq!(recalled(&log), [("other", 1)]);
    }

    #[test]
    fn lookup_returns_the_latest_revision_even_when_it_is_declined() {
        let captured = item("quasar", "unique quasar");
        let declined = revise(&captured, ItemChange::Decline { reason: "out of scope".into() }).unwrap();
        let log = view(vec![captured, declined.clone()]);
        assert_eq!(log.lookup_item("quasar"), Some(&declined));
        assert_eq!(log.lookup_item("absent"), None);
    }

    #[test]
    fn each_revision_keeps_the_identity_and_advances_the_revision_by_one() {
        let captured = item("a", "words");
        for change in [filed("GH-1", false), ItemChange::Decline { reason: "no".into() }, ItemChange::Complete] {
            let next = revise(&captured, change).unwrap();
            assert_eq!((next.id.as_str(), next.revision, next.text.as_str()), ("a", 2, "words"));
        }
    }

    #[test]
    fn filing_records_the_pointer_and_whether_it_is_uncertain() {
        let next = revise(&item("a", "words"), filed("GH-7", true)).unwrap();
        assert_eq!(next.disposition, Disposition::Filed { pointer: "GH-7".into() });
        assert!(next.filing_uncertain);
    }

    #[test]
    fn completing_keeps_the_disposition() {
        let filing = revise(&item("a", "words"), filed("GH-7", false)).unwrap();
        let completed = revise(&filing, ItemChange::Complete).unwrap();
        assert!(completed.completed);
        assert_eq!(completed.disposition, Disposition::Filed { pointer: "GH-7".into() });
    }

    #[test]
    fn a_blank_filing_pointer_or_decline_reason_is_refused() {
        let captured = item("a", "words");
        assert_eq!(
            revise(&captured, filed(" \t", false)).map(|_| ()),
            Err(Error::Invalid("empty filing pointer".into()))
        );
        assert_eq!(
            revise(&captured, ItemChange::Decline { reason: "\n".into() }).map(|_| ()),
            Err(Error::Invalid("empty decline reason".into()))
        );
    }

    #[test]
    fn a_declined_identity_is_never_revised_again() {
        let declined = revise(&item("a", "words"), ItemChange::Decline { reason: "no".into() }).unwrap();
        for change in [filed("GH-1", false), ItemChange::Complete, ItemChange::Decline { reason: "again".into() }] {
            assert_eq!(
                revise(&declined, change).map(|_| ()),
                Err(Error::Invalid("declined identity is terminal".into()))
            );
        }
    }

    #[test]
    fn an_uncertain_result_revises_a_confirmed_filing_under_the_same_identity() {
        let filing = revise(&item("a", "words"), filed("GH-42", false)).unwrap();
        let completed = revise(&filing, ItemChange::Complete).unwrap();
        let uncertain = mark_filing_uncertain(&completed, true).unwrap().unwrap();
        assert_eq!((uncertain.id.as_str(), uncertain.revision), ("a", 4));
        assert_eq!(uncertain.disposition, Disposition::Filed { pointer: "GH-42".into() });
        assert!(uncertain.completed);
        assert!(uncertain.filing_uncertain);
    }

    #[test]
    fn a_certain_result_or_an_already_uncertain_row_changes_nothing() {
        let filing = revise(&item("a", "words"), filed("GH-42", false)).unwrap();
        assert_eq!(mark_filing_uncertain(&filing, false), Ok(None));
        let uncertain = mark_filing_uncertain(&filing, true).unwrap().unwrap();
        assert_eq!(mark_filing_uncertain(&uncertain, true), Ok(None));
    }
}
