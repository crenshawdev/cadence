use super::*;
use cadence::store::{
    MutationContext, Policy, Result,
    filesystem::Filesystem,
    model::{Disposition, Evidence},
    transaction::Transaction,
    writer::{Operation, Store},
};
use serde_json::json;

fn source(path: &str, text: &str) -> Source {
    Source {
        path: path.into(),
        bytes: text.as_bytes().to_vec(),
    }
}
struct Allow;
impl Policy for Allow {
    fn validate(&mut self, _: &MutationContext<'_>) -> Result<()> {
        Ok(())
    }
}
fn frozen(path: &str) -> Vec<u8> {
    let out = std::process::Command::new("git")
        .args(["show", &format!("v3.7.12:{path}")])
        .stdin(std::process::Stdio::null())
        .output()
        .unwrap();
    assert!(
        out.status.success(),
        "{}",
        String::from_utf8_lossy(&out.stderr)
    );
    out.stdout
}

#[test]
fn capture_import_preserves_independent_identities_and_all_source_bytes() {
    let capture = source(
        "CAPTURE.md",
        "# Capture\n\n## Todos\n- [ ] (phase 03.1) same\n  continuation with unknown meaning\n  ````rust\n- [ ] not an item\n  ```\n## Notes\n  ````\n- [ ] same\n- [x] complete\n## Seeds\n- seed\n## Notes\n- 2026-01-01 note\n## Unknown\n- evidence only\n",
    );
    let result = items::translate(Some(&capture), None, None).unwrap();
    assert_eq!(result.records.len(), 5);
    assert_eq!(
        result
            .records
            .iter()
            .map(|r| r.kind.as_str())
            .collect::<Vec<_>>(),
        ["todo", "todo", "todo", "seed", "note"]
    );
    assert_eq!(result.records[0].text, "same");
    assert_eq!(result.records[1].text, "same");
    assert_ne!(result.records[0].id, result.records[1].id);
    assert!(result.records[2].completed);
    assert_eq!(result.evidence[0].source, capture);
    assert_eq!(result.evidence[0].label, "non_effective_original_source");
    let Evidence::Text(provenance) = &result.records[0].origin.original else {
        panic!("missing provenance")
    };
    let provenance: serde_json::Value = serde_json::from_str(provenance).unwrap();
    assert_eq!(provenance[0]["phase_spelling"], json!("03.1"));
    assert!(
        result
            .records
            .iter()
            .all(|r| !r.text.contains("continuation")
                && !r.text.contains("not an item")
                && !r.text.contains("evidence only"))
    );
    assert_eq!(
        result,
        items::translate(Some(&capture), None, None).unwrap()
    );
    assert!(
        items::translate(None, None, None)
            .unwrap()
            .records
            .is_empty()
    );
}

#[test]
fn cross_ledger_decline_wins_preserves_uncertainty_and_replay_does_not_append() {
    let filed = source(
        "FILED.md",
        "- 2026-01-01 github org/repo abc: shared finding\n- 2026-01-02 github org/repo def unconfirmed: uncertain finding\n",
    );
    let declined = source(
        "DECLINED.md",
        "## Fingerprints\n- 2026-01-03 github org/repo abc: rejected shared finding\n## Decisions\n### Human decline\nDeclined because the tradeoff is wrong.\n## Nested reasoning\nKeep all of this.\n```md\n### not a separate decision\n```\n",
    );
    let translated = items::translate(None, Some(&filed), Some(&declined)).unwrap();
    assert_eq!(translated.records.len(), 4);
    assert!(translated.records[1].filing_uncertain); // frozen planning-files.mjs:1366-1367
    assert!(!translated.records[0].filing_uncertain);
    assert_eq!(translated.records[0].id, translated.records[2].id);
    assert!(matches!(
        translated.records[2].disposition,
        Disposition::Declined { .. }
    ));
    assert!(
        translated
            .warnings
            .iter()
            .any(|w| w.contains("FILED/DECLINED conflict"))
    );
    let Disposition::Declined { reason } = &translated.records[3].disposition else {
        panic!("prose not declined")
    };
    assert!(reason.contains("Nested reasoning") && reason.contains("tradeoff"));
    assert_eq!(
        translated
            .evidence
            .iter()
            .map(|e| e.source.clone())
            .collect::<Vec<_>>(),
        [filed, declined]
    );
    let transaction = Transaction {
        id: "same-source-generation".into(),
        items: translated.records.clone(),
        decisions: vec![],
        snapshot: Some(json!({"source_evidence":translated.evidence})),
        external: vec![],
    };
    let dir = tempfile::tempdir().unwrap();
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let store = Store::open(Filesystem::new(dir.path()).unwrap(), Allow)
            .await
            .unwrap();
        let first = store
            .request(Operation::Transact(transaction.clone()))
            .await
            .unwrap();
        assert_eq!(
            first
                .recall_items()
                .iter()
                .map(|r| r.text.as_str())
                .collect::<Vec<_>>(),
            ["uncertain finding"]
        );
        assert_eq!(
            store
                .request(Operation::Transact(transaction))
                .await
                .unwrap(),
            first
        );
        assert_eq!(first.items.len(), 4);
    });
}

#[test]
fn actual_frozen_declines_include_authored_decisions_and_exclude_them_from_recall() {
    let declined = Source {
        path: "DECLINED.md".into(),
        bytes: frozen(".planning/DECLINED.md"),
    };
    let filed = Source {
        path: "FILED.md".into(),
        bytes: frozen(".planning/FILED.md"),
    };
    let result = items::translate(None, Some(&filed), Some(&declined)).unwrap();
    assert_eq!(
        result
            .records
            .iter()
            .filter(|r| r.kind == "decline_decision")
            .count(),
        8
    );
    assert!(
        result
            .records
            .iter()
            .any(|r| r.text.starts_with("/cad-stakes:"))
    );
    assert!(
        result
            .warnings
            .iter()
            .any(|w| w.contains("FILED/DECLINED conflict"))
    );
    assert_eq!(result.evidence[1].source.bytes, declined.bytes);
    let invalid = Source {
        path: "CAPTURE.md".into(),
        bytes: vec![0xff, 0x00],
    };
    let result = items::translate(Some(&invalid), None, None).unwrap();
    assert!(result.records.is_empty());
    assert_eq!(result.evidence[0].source, invalid);
}

#[test]
fn frozen_cursor_survives_restart_without_deriving_phase_status() {
    let state = Source {
        path: "STATE.md".into(),
        bytes: frozen(".planning/STATE.md"),
    };
    let translated = decisions::translate(Some(&state), None, None).unwrap();
    assert_eq!(translated.cursor["phase"], json!(1.0));
    assert_eq!(translated.cursor["total"], json!(0));
    assert_eq!(translated.cursor["name"], json!("no active cycle"));
    assert_eq!(translated.cursor["status"], json!("ready to plan"));
    assert_eq!(translated.cursor["next"], json!("/cad-phase add"));
    assert_eq!(
        translated.cursor["original_fields"]["phase"],
        json!("1 of 0 (no active cycle)")
    );
    assert_eq!(translated.evidence[0].source, state);
    let dir = tempfile::tempdir().unwrap();
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let store = Store::open(Filesystem::new(dir.path()).unwrap(), Allow)
            .await
            .unwrap();
        let first = store
            .request(Operation::RewriteSnapshot(
                json!({"cursor":translated.cursor,"source_evidence":translated.evidence}),
            ))
            .await
            .unwrap();
        drop(store);
        let reopened = Store::open(Filesystem::new(dir.path()).unwrap(), Allow)
            .await
            .unwrap();
        assert_eq!(reopened.request(Operation::Read).await.unwrap(), first);
    });
}

#[test]
fn mixed_legacy_logs_admit_only_decisions_and_keep_requested_observed_effort_distinct() {
    use cadence::store::model::Decision;
    let mut raw = String::new();
    let routing = json!({"family":"routing","event":"resolve","phase":"03.1","agent":"cad-executor-high","role":"cad-executor","effort":"high","model_source":"repo","agent_id":"a","observed_effort":" \t "});
    for row in [
        routing.clone(),
        json!({"family":"routing","event":"resolve","phase":3,"agent":"cad-executor-high","agent_id":"b","effort":"high","observed_effort":"host-unfamiliar"}),
        json!({"family":"outcome","event":"risk_check","phase":3,"checked":false,"inconclusive":true,"reason":"unresolved-range"}),
        json!({"family":"outcome","event":"census_undeclared","phase":3,"censuses":["one"]}),
        json!({"family":"read","event":"recall","tokens":100}),
        json!({"family":"lifecycle","event":"dispatch","tokens":200}),
        json!({"family":"lifecycle","event":"record_rotated"}),
        json!({"family":"routing","event":"resolve","phase":null,"agent":"cad-executor-high"}),
        json!({"family":"outcome","event":"unknown"}),
    ] {
        raw.push_str(&format!("{row}\n"));
    }
    raw.push_str("broken row\n{\"family\":\"outcome\"");
    let current = source("trace.jsonl", &raw);
    let rotated = source("trace.1.jsonl", &format!("{routing}\n"));
    let result = decisions::translate(None, Some(&current), Some(&rotated)).unwrap();
    assert_eq!(result.records.len(), 5); // equal payload in another source is not proof of a carry
    assert_ne!(result.records[0].id, result.records[4].id);
    let Decision::Routing {
        requested_effort,
        observed_effort,
        receipt,
        ..
    } = &result.records[0].decision
    else {
        panic!("routing missing")
    };
    assert_eq!(*requested_effort, Evidence::Text("high".into()));
    assert_eq!(*observed_effort, Evidence::Missing);
    assert_eq!(*receipt, Evidence::Missing);
    assert!(
        !serde_json::to_string(&result.records[0])
            .unwrap()
            .contains("observed_effort")
    );
    let Decision::Routing {
        observed_effort, ..
    } = &result.records[1].decision
    else {
        panic!("routing missing")
    };
    assert_eq!(*observed_effort, Evidence::Text("host-unfamiliar".into()));
    assert!(matches!(result.records[2].decision, Decision::Gate { .. }));
    assert!(matches!(
        result.records[3].decision,
        Decision::Refusal { .. }
    ));
    assert!(
        result
            .warnings
            .iter()
            .any(|s| s.contains("malformed/incomplete"))
    );
    assert_eq!(result.evidence[0].source, current);
    assert_eq!(
        result.records,
        decisions::translate(None, Some(&current), Some(&rotated))
            .unwrap()
            .records
    );
    let transaction = Transaction {
        id: "log-source-generation".into(),
        items: vec![],
        decisions: result.records,
        snapshot: None,
        external: vec![],
    };
    let dir = tempfile::tempdir().unwrap();
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let store = Store::open(Filesystem::new(dir.path()).unwrap(), Allow)
            .await
            .unwrap();
        let first = store
            .request(Operation::Transact(transaction.clone()))
            .await
            .unwrap();
        assert_eq!(
            store
                .request(Operation::Transact(transaction))
                .await
                .unwrap(),
            first
        );
    });
}

#[test]
fn proven_rotation_copy_coalesces_events_and_retains_both_origins() {
    let anchor = json!({"family":"lifecycle","event":"phase_start","phase":3,"corr":"a"});
    let gate = json!({"family":"outcome","event":"risk_check","phase":3,"corr":"a","checked":true});
    let rotated = source("trace.1.jsonl", &format!("{anchor}\n{gate}\n{gate}\n"));
    let marker = json!({"family":"lifecycle","event":"record_rotated","file":"trace.1.jsonl","carried_bytes":rotated.bytes.len(),"corr":"a"});
    let current = source(
        "trace.jsonl",
        &format!("{anchor}\n{gate}\n{gate}\n{marker}\n"),
    );
    let result = decisions::translate(None, Some(&current), Some(&rotated)).unwrap();
    assert_eq!(result.records.len(), 2); // two real identical events, each with two source positions
    assert_ne!(result.records[0].id, result.records[1].id);
    for record in result.records {
        let Evidence::Text(original) = record.origin.original else {
            panic!("missing origins")
        };
        let origins: Vec<serde_json::Value> = serde_json::from_str(&original).unwrap();
        assert_eq!(origins.len(), 2);
        assert_eq!(origins[0]["path"], json!("trace.jsonl"));
        assert_eq!(origins[1]["path"], json!("trace.1.jsonl"));
    }
}
