use cadence::{
    evidence::{Scope, results::AcceptedResult},
    pause::{
        git::Staged,
        risk::{CommitKind, Fire, Review},
    },
    rail::{
        risk::{self, MaterialIdentity},
        risk_diff,
    },
};
use serde_json::json;
use std::path::PathBuf;

#[test]
fn shared_classifier_keeps_category_order_and_changed_line_signals() {
    let categories = risk::CATEGORIES.map(str::to_owned);
    let body = b"diff --git a/work b/work\n--- a/work\n+++ b/work\n@@ -1 +1,8 @@\n-jwt.verify(token)\n+ALTER TABLE example\n+stripe\n+Mutex\n+DROP TABLE example\n+APP_SECRET=value\n+router.get('/hello')\n+JSON.parse(input)\n";
    let scan = risk_diff::scan(Some(body), &[PathBuf::from("work")], &categories).unwrap();
    assert!(scan.checked && !scan.empty && !scan.inconclusive);
    assert_eq!(
        scan.matches
            .iter()
            .map(|m| m.category.as_str())
            .collect::<Vec<_>>(),
        risk::CATEGORIES
    );
    assert_eq!(
        scan,
        cadence::pause::risk_diff::scan(Some(body), &[PathBuf::from("work")], &categories).unwrap()
    );
}

#[test]
fn empty_unavailable_binary_and_unchanged_context_stay_distinct() {
    let categories = vec!["destructive".into()];
    let empty = risk_diff::scan(Some(b""), &[], &categories).unwrap();
    assert!(empty.checked && empty.empty && !empty.inconclusive);
    let unavailable = risk_diff::scan(None, &[], &categories).unwrap();
    assert!(!unavailable.checked && unavailable.inconclusive && !unavailable.empty);
    let binary = risk_diff::scan(
        Some(b"diff --git a/a b/a\nBinary files a/a and b/a differ\n"),
        &["a".into()],
        &categories,
    )
    .unwrap();
    assert!(binary.checked && binary.inconclusive && !binary.empty);
    let context = risk_diff::scan(
        Some(b"diff --git a/a b/a\n@@ -1,2 +1,2 @@\n DROP TABLE old\n-old\n+new\n"),
        &["a".into()],
        &categories,
    )
    .unwrap();
    assert!(context.matches.is_empty() && !context.inconclusive);
}

#[test]
fn shared_surface_selection_keeps_unanswered_invalid_and_explicit_choices_distinct() {
    assert_eq!(risk::configured_surfaces(&json!(null)).unwrap(), None);
    assert_eq!(
        risk::configured_surfaces(&json!(["secrets", "auth"])).unwrap(),
        Some(vec!["secrets".into(), "auth".into()])
    );
    for value in [
        json!([]),
        json!(["auth", "auth"]),
        json!(["unknown"]),
        json!([2]),
        json!("auth"),
    ] {
        assert!(risk::configured_surfaces(&value).is_err());
    }
}

#[test]
fn independently_encoded_pause_fire_preserves_bytes_digest_and_exact_review_matching() {
    let scope: Scope = serde_json::from_value(json!({"project":"/project","planning_root":"/project/.planning","cycle":"4","occurrence":"pause-1","phase":"7","plan":"3","report":"pause"})).unwrap();
    let scan = risk_diff::scan(Some(b""), &[], &["auth".into()]).unwrap();
    let staged = Staged {
        base: "a".repeat(40),
        index_id: "b".repeat(40),
        scope: vec!["work".into()],
        authored: vec![],
        diff: vec![],
    };
    // This is the pre-extraction tuple and field order, encoded independently.
    let prior_input = format!(
        r#"[{{"project":"/project","planning_root":"/project/.planning","cycle":"4","occurrence":"pause-1","phase":"7","plan":"3","report":"pause"}},"wip",1,"{}","{}",["work"],[],{{"checked":true,"categories":["auth"],"matches":[],"inconclusive":false,"empty":true}}]"#,
        "a".repeat(40),
        "b".repeat(40)
    );
    let id = format!(
        "pause-risk-{}",
        cadence::store::model::digest(prior_input.as_bytes())
    );
    let prior_bytes = format!(
        r#"{{"id":"{id}","commit_kind":"wip","round":1,"base":"{}","staged":true,"head_id":null,"index_id":"{}","scope":["work"],"authored":[],"scan":{{"checked":true,"categories":["auth"],"matches":[],"inconclusive":false,"empty":true}}}}"#,
        "a".repeat(40),
        "b".repeat(40)
    );
    let old: Fire = serde_json::from_str(&prior_bytes).unwrap();
    let new = Fire::new(&scope, CommitKind::Wip, 1, &staged, scan).unwrap();
    assert_eq!(old, new);
    assert_eq!(serde_json::to_string(&new).unwrap(), prior_bytes);
    assert_eq!(
        new.material().unwrap(),
        MaterialIdentity::Staged {
            base_id: staged.base,
            index_id: staged.index_id
        }
    );
    let record = AcceptedResult {
        id,
        contract: "cadence.pause.risk-surface.v1".into(),
        result: "reviewed".into(),
        evidence_text: format!(
            r#"{{"version":1,"fire":{prior_bytes},"finding_record":"review.md","findings":[]}}"#
        ),
        references: vec![],
        checker_id: None,
    };
    assert_eq!(Review::parse(&record, &new).unwrap().fire, old);
    let mut different = new;
    different.index_id = "c".repeat(40);
    assert!(Review::parse(&record, &different).is_err());
}
