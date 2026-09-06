use super::*;
use cadence::store::model::{ItemRecord, Origin, Snapshot, VERSION};

fn item(id: &str, text: &str) -> ItemRecord {
    ItemRecord {
        version: VERSION,
        id: id.into(),
        revision: 1,
        origin: Origin {
            source: "capture".into(),
            original: Evidence::Missing,
        },
        text: text.into(),
        kind: "note".into(),
        disposition: Disposition::Captured,
        completed: false,
        filing_uncertain: false,
    }
}
fn view(items: Vec<ItemRecord>) -> View {
    View {
        items,
        decisions: vec![],
        snapshot: Snapshot::new(0, b"", b"", serde_json::Value::Null).unwrap(),
    }
}
fn prose(text: &str, line: usize) -> Candidate {
    Candidate {
        text: text.into(),
        item_id: None,
        provenance: Provenance::Document {
            path: "CONTEXT.md".into(),
            line,
            heading: "Durable decisions".into(),
            commit: None,
        },
    }
}

#[test]
fn frozen_token_relationships_and_raw_stopword_order() {
    for (a, b) in [
        ("seams", "seam"),
        ("closes", "close"),
        ("files", "file"),
        ("notes", "note"),
        ("types", "type"),
        ("changes", "change"),
        ("refused", "refuse"),
        ("removed", "remove"),
        ("running", "run"),
    ] {
        assert_eq!(rank::tokenize(a), rank::tokenize(b), "{a} / {b}");
    }
    assert_eq!(rank::tokenize("THE being its"), vec!["be", "it"]);
    assert_eq!(rank::tokenize("freed agreed"), vec!["freed", "agree"]);
    assert_ne!(rank::tokenize("verifies"), rank::tokenize("verify"));
    assert_ne!(rank::tokenize("indices"), rank::tokenize("index"));
}

#[test]
fn deterministic_ties_deduplicated_query_default_limit_and_total() {
    let candidates = (1..=7).map(|i| prose("quasar seam", i)).collect();
    let corpus = Corpus::new(candidates, &BTreeSet::new());
    let answer = corpus.query("quasar", None, "builtin").unwrap();
    assert_eq!(answer.total, 7);
    assert_eq!(answer.results.len(), 5);
    for (i, hit) in answer.results.iter().enumerate() {
        assert_eq!(hit.provenance, prose("", i + 1).provenance);
    }
    assert_eq!(
        answer,
        corpus.query("quasar quasar", None, "builtin").unwrap()
    );
    assert_eq!(answer, corpus.query("quasar", None, "builtin").unwrap());
    assert_eq!(
        corpus
            .query("seams", Some(2), "builtin")
            .unwrap()
            .results
            .len(),
        2
    );
}

#[test]
fn empty_zero_hits_invalid_limits_disabled_and_unknown() {
    let corpus = Corpus::new(vec![prose("quasar", 1)], &BTreeSet::new());
    for limit in [0, -1] {
        assert!(corpus.query("quasar", Some(limit), "builtin").is_err());
    }
    assert!(corpus.query(" ", None, "builtin").is_err());
    assert!(corpus.query("quasar", None, "other").is_err());
    let disabled = corpus.query("quasar", None, "none").unwrap();
    assert_eq!(disabled.backend, "none");
    assert_eq!((disabled.total, disabled.results.len()), (0, 0));
    assert_eq!(corpus.query("absent", None, "builtin").unwrap().total, 0);
    assert_eq!(
        Corpus::new(vec![], &BTreeSet::new())
            .query("quasar", None, "builtin")
            .unwrap()
            .total,
        0
    );
}

#[test]
fn declined_current_and_historical_candidates_never_affect_ranking_or_totals() {
    let old = item("declined", "quasar quasar");
    let historical = records(view(vec![old.clone()]).recall_items());
    let mut dead = old.clone();
    dead.revision = 2;
    dead.disposition = Disposition::Declined {
        reason: "quasar secret reason".into(),
    };
    let live = view(vec![old, dead, item("kept", "quasar")]);
    let mut candidates = current(&live);
    candidates.extend(historical);
    let actual = Corpus::new(candidates, &declined(&live))
        .query("quasar", None, "builtin")
        .unwrap();
    let expected = Corpus::new(
        records(view(vec![item("kept", "quasar")]).recall_items()),
        &BTreeSet::new(),
    )
    .query("quasar", None, "builtin")
    .unwrap();
    assert_eq!(actual, expected);
    assert_eq!(actual.total, 1);
}
