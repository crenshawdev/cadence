//! Recall's domain core consumes eligible records and explicit snippets only.
mod rank;
#[cfg(test)]
mod tests;

use cadence::store::{
    items::RecallItems,
    model::{Decision, Disposition, Evidence},
    writer::View,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Provenance {
    Record {
        id: String,
        revision: u64,
        source: String,
        commit: Option<String>,
    },
    Document {
        path: String,
        line: usize,
        heading: String,
        commit: Option<String>,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Candidate {
    pub text: String,
    pub provenance: Provenance,
    pub item_id: Option<String>,
}

/// Only identity metadata is inspected outside the eligible projection. Raw
/// event text, decline reasons and quarantined origin bytes never enter ranking.
pub fn declined(view: &View) -> BTreeSet<String> {
    view.items
        .iter()
        .filter(|r| matches!(r.disposition, Disposition::Declined { .. }))
        .map(|r| r.id.clone())
        .collect()
}

pub fn records(items: RecallItems<'_>) -> Vec<Candidate> {
    items
        .iter()
        .map(|r| Candidate {
            text: r.text.clone(),
            item_id: Some(r.id.clone()),
            provenance: Provenance::Record {
                id: r.id.clone(),
                revision: r.revision,
                source: r.origin.source.clone(),
                commit: None,
            },
        })
        .collect()
}

pub fn current(view: &View) -> Vec<Candidate> {
    let mut result = records(view.recall_items());
    for r in &view.decisions {
        let (label, evidence) = match &r.decision {
            Decision::Routing {
                choice, receipt, ..
            } => (choice, receipt),
            Decision::Gate { outcome, evidence } => (outcome, evidence),
            Decision::Refusal { reason, evidence } => (reason, evidence),
        };
        let text = match evidence {
            Evidence::Text(text) => format!("{label}\n{text}"),
            _ => label.clone(),
        };
        result.push(Candidate {
            text,
            item_id: None,
            provenance: Provenance::Record {
                id: r.id.clone(),
                revision: r.revision,
                source: r.origin.source.clone(),
                commit: None,
            },
        });
    }
    result
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Hit {
    pub score: f64,
    pub snippet: String,
    pub provenance: Provenance,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Answer {
    pub backend: String,
    pub results: Vec<Hit>,
    pub total: usize,
    pub incomplete: Vec<String>,
}

pub struct Corpus {
    candidates: Vec<Candidate>,
    index: rank::Index,
}
impl Corpus {
    pub fn new(candidates: Vec<Candidate>, excluded: &BTreeSet<String>) -> Self {
        let candidates: Vec<_> = candidates
            .into_iter()
            .filter(|c| c.item_id.as_ref().is_none_or(|id| !excluded.contains(id)))
            .collect();
        let index = rank::Index::new(candidates.iter().map(|c| c.text.as_str()));
        Self { candidates, index }
    }
    pub fn query(&self, query: &str, limit: Option<i64>, backend: &str) -> Result<Answer, String> {
        let limit = limit.unwrap_or(5);
        if limit < 1 {
            return Err("limit must be a positive integer".into());
        }
        if query.trim().is_empty() {
            return Err("recall needs a query".into());
        }
        let mut answer = Answer {
            backend: backend.into(),
            results: vec![],
            total: 0,
            incomplete: vec![],
        };
        if backend == "none" {
            return Ok(answer);
        }
        if backend != "builtin" {
            return Err(format!("unknown recall backend: {backend}"));
        }
        let matched = self.index.search(query);
        answer.total = matched.len();
        answer.results = matched
            .into_iter()
            .take(limit as usize)
            .map(|(i, score)| Hit {
                score: (score * 10000.0).round() / 10000.0,
                snippet: self.candidates[i].text.clone(),
                provenance: self.candidates[i].provenance.clone(),
            })
            .collect();
        Ok(answer)
    }
}
