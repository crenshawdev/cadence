use super::*;
use cadence::store::{
    MutationContext, Policy, Result,
    model::{Disposition, Evidence},
    transaction::Transaction,
    writer::{Operation, Store},
};
use serde_json::json;

#[test]
fn a_store_crossing_refuses_session_input() {
    let error = store_input_error(cadence::acquisition::Error::Crossing(cadence::acquisition::Crossing {
        file: ".planning/state.json".into(), size: 1_073_741_825, bound: 1_073_741_824,
    }));
    assert!(matches!(error, cadence::store::Error::Invalid(reason)
        if reason == ".planning/state.json: size 1073741825 exceeds acquisition bound 1073741824"));
}

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
/// Planning files exactly as v3.7.12 left them, taken from that tag once and
/// kept as fixtures, so no test asks git for them.
const FROZEN_DECLINED: &[u8] = include_bytes!("../../tests/fixtures/v3.7.12/DECLINED.md");
const FROZEN_FILED: &[u8] = include_bytes!("../../tests/fixtures/v3.7.12/FILED.md");
const FROZEN_STATE: &[u8] = include_bytes!("../../tests/fixtures/v3.7.12/STATE.md");

fn capture_source() -> Source {
    source(
        "CAPTURE.md",
        "# Capture\n\n## Todos\n- [ ] (phase 03.1) same\n  continuation with unknown meaning\n  ````rust\n- [ ] not an item\n  ```\n## Notes\n  ````\n- [ ] same\n- [x] complete\n## Seeds\n- seed\n## Notes\n- 2026-01-01 note\n## Unknown\n- evidence only\n",
    )
}

#[test]
fn capture_entries_become_records_by_section_skipping_other_lines_and_carrying_completion() {
    let result = items::translate(Some(&capture_source()), None, None).unwrap();
    assert_eq!(result.records.len(), 5);
    assert_eq!(
        result
            .records
            .iter()
            .map(|r| r.kind.as_str())
            .collect::<Vec<_>>(),
        ["todo", "todo", "todo", "seed", "note"]
    );
    assert!(result.records[2].completed);
    assert!(
        result
            .records
            .iter()
            .all(|r| !r.text.contains("continuation")
                && !r.text.contains("not an item")
                && !r.text.contains("evidence only"))
    );
}

#[test]
fn identical_capture_texts_get_distinct_ids_and_translation_is_deterministic() {
    let capture = capture_source();
    let result = items::translate(Some(&capture), None, None).unwrap();
    assert_eq!(result.records[0].text, "same");
    assert_eq!(result.records[1].text, "same");
    assert_ne!(result.records[0].id, result.records[1].id);
    assert_eq!(
        result,
        items::translate(Some(&capture), None, None).unwrap()
    );
}

#[test]
fn capture_source_bytes_are_kept_as_evidence_with_the_phase_spelling_in_provenance() {
    let capture = capture_source();
    let result = items::translate(Some(&capture), None, None).unwrap();
    assert_eq!(result.evidence[0].source, capture);
    assert_eq!(result.evidence[0].label, "non_effective_original_source");
    let Evidence::Text(provenance) = &result.records[0].origin.original else {
        panic!("missing provenance")
    };
    let provenance: serde_json::Value = serde_json::from_str(provenance).unwrap();
    assert_eq!(provenance[0]["phase_spelling"], json!("03.1"));
}

#[test]
fn no_capture_source_yields_no_records() {
    assert!(
        items::translate(None, None, None)
            .unwrap()
            .records
            .is_empty()
    );
}

fn ledgers() -> (Source, Source) {
    let filed = source(
        "FILED.md",
        "- 2026-01-01 github org/repo abc: shared finding\n- 2026-01-02 github org/repo def unconfirmed: uncertain finding\n",
    );
    let declined = source(
        "DECLINED.md",
        "## Fingerprints\n- 2026-01-03 github org/repo abc: rejected shared finding\n## Decisions\n### Human decline\nDeclined because the tradeoff is wrong.\n## Nested reasoning\nKeep all of this.\n```md\n### not a separate decision\n```\n",
    );
    (filed, declined)
}

#[test]
fn an_unconfirmed_filing_is_marked_uncertain() {
    let (filed, declined) = ledgers();
    let translated = items::translate(None, Some(&filed), Some(&declined)).unwrap();
    assert_eq!(translated.records.len(), 4);
    assert!(translated.records[1].filing_uncertain); // frozen planning-files.mjs:1366-1367
    assert!(!translated.records[0].filing_uncertain);
}

#[test]
fn a_decline_of_a_filed_fingerprint_wins_under_the_same_id_with_a_conflict_warning() {
    let (filed, declined) = ledgers();
    let translated = items::translate(None, Some(&filed), Some(&declined)).unwrap();
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
}

#[test]
fn a_declined_decision_keeps_all_of_its_nested_reasoning() {
    let (filed, declined) = ledgers();
    let translated = items::translate(None, Some(&filed), Some(&declined)).unwrap();
    let Disposition::Declined { reason } = &translated.records[3].disposition else {
        panic!("prose not declined")
    };
    assert!(reason.contains("Nested reasoning") && reason.contains("tradeoff"));
}

#[test]
fn both_ledgers_are_kept_as_evidence_in_order() {
    let (filed, declined) = ledgers();
    let translated = items::translate(None, Some(&filed), Some(&declined)).unwrap();
    assert_eq!(
        translated
            .evidence
            .iter()
            .map(|e| e.source.clone())
            .collect::<Vec<_>>(),
        [filed, declined]
    );
}

#[test]
fn recall_offers_only_the_uncertain_filing_after_a_decline() {
    let (filed, declined) = ledgers();
    let translated = items::translate(None, Some(&filed), Some(&declined)).unwrap();
    let view = cadence::store::writer::View {
        snapshot: serde_json::from_value(json!({"version":1,"generation":0,"items_digest":"","decisions_digest":"","data":{},"operations":{},"integrity":""})).unwrap(),
        items: translated.records,
        decisions: vec![],
    };
    assert_eq!(
        view.recall_items()
            .iter()
            .map(|r| r.text.as_str())
            .collect::<Vec<_>>(),
        ["uncertain finding"]
    );
}

#[test]
fn actual_frozen_declines_include_authored_decisions_and_exclude_them_from_recall() {
    let declined = Source {
        path: "DECLINED.md".into(),
        bytes: FROZEN_DECLINED.to_vec(),
    };
    let filed = Source {
        path: "FILED.md".into(),
        bytes: FROZEN_FILED.to_vec(),
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
}

#[test]
fn a_capture_file_that_is_not_utf8_yields_no_records_and_keeps_its_bytes() {
    let invalid = Source {
        path: "CAPTURE.md".into(),
        bytes: vec![0xff, 0x00],
    };
    let result = items::translate(Some(&invalid), None, None).unwrap();
    assert!(result.records.is_empty());
    assert_eq!(result.evidence[0].source, invalid);
}

#[test]
fn frozen_cursor_is_read_without_deriving_phase_status() {
    let state = Source {
        path: "STATE.md".into(),
        bytes: FROZEN_STATE.to_vec(),
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
}

/// The current trace log with every family, a rotated copy of its first
/// routing row, and a broken tail.
fn mixed_logs() -> (Source, Source) {
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
    (source("trace.jsonl", &raw), source("trace.1.jsonl", &format!("{routing}\n")))
}

#[test]
fn log_admission_keeps_only_decisions_and_an_equal_rotated_row_is_its_own_record() {
    let (current, rotated) = mixed_logs();
    let result = decisions::translate(None, Some(&current), Some(&rotated)).unwrap();
    assert_eq!(result.records.len(), 5); // equal payload in another source is not proof of a carry
    assert_ne!(result.records[0].id, result.records[4].id);
}

#[test]
fn a_routing_row_keeps_requested_effort_and_omits_a_blank_observed_effort() {
    use cadence::store::model::Decision;
    let (current, rotated) = mixed_logs();
    let result = decisions::translate(None, Some(&current), Some(&rotated)).unwrap();
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
}

#[test]
fn an_unfamiliar_observed_effort_is_kept_verbatim() {
    use cadence::store::model::Decision;
    let (current, rotated) = mixed_logs();
    let result = decisions::translate(None, Some(&current), Some(&rotated)).unwrap();
    let Decision::Routing {
        observed_effort, ..
    } = &result.records[1].decision
    else {
        panic!("routing missing")
    };
    assert_eq!(*observed_effort, Evidence::Text("host-unfamiliar".into()));
}

#[test]
fn a_risk_check_is_a_gate_and_an_undeclared_census_is_a_refusal() {
    use cadence::store::model::Decision;
    let (current, rotated) = mixed_logs();
    let result = decisions::translate(None, Some(&current), Some(&rotated)).unwrap();
    assert!(matches!(result.records[2].decision, Decision::Gate { .. }));
    assert!(matches!(
        result.records[3].decision,
        Decision::Refusal { .. }
    ));
}

#[test]
fn malformed_log_rows_warn_and_the_current_log_is_kept_as_evidence() {
    let (current, rotated) = mixed_logs();
    let result = decisions::translate(None, Some(&current), Some(&rotated)).unwrap();
    assert!(
        result
            .warnings
            .iter()
            .any(|s| s.contains("malformed/incomplete"))
    );
    assert_eq!(result.evidence[0].source, current);
}

#[test]
fn log_translation_is_deterministic() {
    let (current, rotated) = mixed_logs();
    assert_eq!(
        decisions::translate(None, Some(&current), Some(&rotated)).unwrap().records,
        decisions::translate(None, Some(&current), Some(&rotated))
            .unwrap()
            .records
    );
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

/// A session's current view: import metadata, provenance and unrelated data.
fn session_view() -> View {
    let manifest: ImportManifest = serde_json::from_value(json!({"format":1,"complete":true,
        "source_generation":"fixture","sources":[],"active":{"repo":"/fixture/project/.planning/config.v4.json","global":null},
        "created":[],"warnings":[]}))
    .unwrap();
    View {
        items: vec![],
        decisions: vec![],
        snapshot: cadence::store::model::Snapshot::new(
            7,
            b"",
            b"",
            json!({
                "import":manifest,"source_evidence":[{"preserved":[1,null]}],"cursor":{"phase":8},
                "archive":{"available":true},"unrelated":{"keep":true}
            }),
        )
        .unwrap(),
    }
}

#[test]
fn a_derivation_may_replace_everything_but_import_and_provenance() {
    let current = session_view();
    let mut data = current.snapshot.data.clone();
    data["unrelated"] = json!({"keep":[1,2]});
    data["current"] = json!({"legacy":"unchanged"});
    data["derivation"] = json!({"memo":"fixture"});
    assert_eq!(check_derivation(&current, &current, &data), Ok(()));
}

#[test]
fn a_derivation_may_not_change_import_or_provenance() {
    let current = session_view();
    for field in ["import", "source_evidence", "archive", "cursor"] {
        let mut data = current.snapshot.data.clone();
        data[field] = Value::Null;
        assert!(check_derivation(&current, &current, &data).is_err(), "{field}");
    }
}

#[test]
fn a_derivation_from_a_stale_view_is_refused() {
    let current = session_view();
    let mut stale = current.clone();
    stale.snapshot = cadence::store::model::Snapshot::new(6, b"", b"", current.snapshot.data.clone()).unwrap();
    assert_eq!(
        check_derivation(&current, &stale, &current.snapshot.data),
        Err(Error::Conflict(cadence::store::writer::STALE_SNAPSHOT.into()))
    );
}

fn first_run_answers() -> Vec<write::Update> {
    serde_json::from_value(json!([
        {"key":"roles.cad-planner.model","value":null},
        {"key":"roles.cad-planner.effort","value":"high"},
        {"key":"roles.cad-assumptions-analyzer.model","value":null},
        {"key":"roles.cad-assumptions-analyzer.effort","value":"high"},
        {"key":"roles.cad-verifier.model","value":null},
        {"key":"roles.cad-verifier.effort","value":"high"},
        {"key":"roles.cad-reviewer.model","value":null},
        {"key":"roles.cad-reviewer.effort","value":"medium"},
        {"key":"roles.cad-executor.model","value":null},
        {"key":"roles.cad-executor.effort","value":"high"},
        {"key":"roles.cad-plan-checker.model","value":null},
        {"key":"roles.cad-plan-checker.effort","value":"low"},
        {"key":"review.triggers.risk_surface.waive_routing_floor","value":[]}
    ]))
    .unwrap()
}

#[tokio::test]
async fn first_global_batch_returns_thirteen_leaves_from_missing_parent_registration() {
    let fixture = tempfile::tempdir().unwrap();
    let root = fixture.path().join("project/.planning");
    let active = Paths {
        repo: root.join("config.v4.json"),
        global: Some(fixture.path().join("global/nested/config.v4.json")),
    };
    let storage = write::register(&root, &active).unwrap();
    let writer = write::ConfigWriter {
        root,
        active: active.clone(),
        store: Store::open(storage, Allow).await.unwrap(),
        config: Arc::new(Mutex::new(Reload::new(active, FileIo))),
    };
    let result = writer
        .batch(Layer::Global, &first_run_answers())
        .await
        .unwrap();
    assert_eq!(
        result.changed_keys,
        [
            "review.triggers.risk_surface.waive_routing_floor",
            "roles.cad-assumptions-analyzer.effort",
            "roles.cad-assumptions-analyzer.model",
            "roles.cad-executor.effort",
            "roles.cad-executor.model",
            "roles.cad-plan-checker.effort",
            "roles.cad-plan-checker.model",
            "roles.cad-planner.effort",
            "roles.cad-planner.model",
            "roles.cad-reviewer.effort",
            "roles.cad-reviewer.model",
            "roles.cad-verifier.effort",
            "roles.cad-verifier.model",
        ]
    );
}

#[derive(Clone)]
struct SuppliedConfig(BTreeMap<PathBuf, Vec<u8>>);
impl ConfigIo for SuppliedConfig {
    fn identity(&mut self, path: &Path) -> Result<std::path::PathBuf> {
        Ok(path.into())
    }
    fn read(&mut self, path: &Path) -> Result<Input> {
        Ok(Input {
            identity: path.into(),
            bytes: self.0.get(path).cloned(),
            stamp: None,
        })
    }
}

#[test]
fn prepare_import_uses_active_roles_and_retains_conflicting_legacy_evidence() {
    let root = Path::new("/fixture/project/.planning");
    let legacy = Paths {
        repo: root.join("config.json"),
        global: Some("/fixture/global/config.json".into()),
    };
    let active = Paths {
        repo: root.join("config.v4.json"),
        global: Some("/fixture/global/config.v4.json".into()),
    };
    let original = br#"{"roles":{"cad-executor":{"model":"opus"}},"stakes":{"old":3}}"#;
    let mut io = SuppliedConfig(
        [
            (legacy.global.clone().unwrap(), original.to_vec()),
            (
                active.global.clone().unwrap(),
                br#"{"roles":{"cad-executor":{"model":"sonnet"}}}"#.to_vec(),
            ),
        ]
        .into(),
    );
    let result = prepare_import(root, &legacy, &active, &mut io, false, &Value::Null).unwrap();
    assert_eq!(
        (
            result.generation.effective.raw_global,
            result.transaction.snapshot.unwrap()["source_evidence"].clone()
        ),
        (
            Some(json!({"roles":{"cad-executor":{"model":"sonnet"}}})),
            json!([{
                "source":{"path":"/fixture/global/config.json","bytes":original.as_slice()},
                "generation":"4811eab5b9e5fb01dd97de0e9e9d7c06d57b6a84e0dc63bdce9a4fa8638e0884","label":"non_effective_original_source","layer":"global"
            }])
        )
    );
}

#[test]
fn register_missing_global_parent_creates_infrastructure_without_config_pins() {
    let fixture = tempfile::tempdir().unwrap();
    let root = fixture.path().join("project/.planning");
    let active = Paths {
        repo: root.join("config.v4.json"),
        global: Some(fixture.path().join("global/nested/config.v4.json")),
    };
    let mut result = write::register(&root, &active).unwrap();
    assert_eq!(
        (
            result.read("repo-config").unwrap().bytes,
            result.read("global-config").unwrap().bytes
        ),
        (None, None)
    );
}

#[test]
fn register_refuses_symlink_ancestors() {
    let fixture = tempfile::tempdir().unwrap();
    std::os::unix::fs::symlink(fixture.path(), fixture.path().join("alias")).unwrap();
    let active = Paths {
        repo: fixture.path().join("config.v4.json"),
        global: Some(fixture.path().join("alias/nested/config.v4.json")),
    };
    assert_eq!(
        write::register(fixture.path(), &active).err(),
        Some(Error::Conflict("unsafe directory identity".into()))
    );
}

#[test]
fn prepare_import_refuses_unusable_active_global_without_legacy_normalization() {
    let root = Path::new("/fixture/project/.planning");
    let legacy = Paths {
        repo: root.join("config.json"),
        global: Some("/fixture/global/config.json".into()),
    };
    let active = Paths {
        repo: root.join("config.v4.json"),
        global: Some("/fixture/global/config.v4.json".into()),
    };
    let mut io = SuppliedConfig(
        [(
            active.global.clone().unwrap(),
            br#"{"roles":{"cad-executor":{"effort":"invalid"}}}"#.to_vec(),
        )]
        .into(),
    );
    assert_eq!(
        prepare_import(root, &legacy, &active, &mut io, false, &Value::Null).err(),
        Some(Error::Policy(
            "config unavailable: unusable roles.cad-executor.effort".into()
        ))
    );
}

#[test]
fn snapshot_replacement_preserves_provenance_and_unrelated_namespaces() {
    let previous = json!({"import":{"complete":true},"source_evidence":[{"original":[null,1]}],
        "archive":{"path":"ARCHIVE.md"},"cursor":{"phase":8},"evidence":{"keep":1},
        "derivation":{"keep":2},"execution":{"keep":3},"rail_receipts":{"keep":4}});
    assert_eq!(
        replace_current(&previous, json!({"new":"payload"})),
        Ok(json!({
            "import":{"complete":true},"source_evidence":[{"original":[null,1]}],
            "archive":{"path":"ARCHIVE.md"},"cursor":{"phase":8},"evidence":{"keep":1},
            "derivation":{"keep":2},"execution":{"keep":3},"rail_receipts":{"keep":4},
            "current":{"new":"payload"}
        }))
    );
}

#[test]
fn snapshot_replacement_keeps_wrapped_historical_evidence_at_its_original_location() {
    assert_eq!(
        replace_current(
            &json!({"import":{"complete":true},
        "current":{"source_evidence":[{"old":null}],"unrelated":[1,2]}}),
            json!({"answer":13})
        ),
        Ok(
            json!({"import":{"complete":true},"current":{"source_evidence":[{"old":null}],
            "unrelated":[1,2],"current":{"answer":13}}})
        )
    );
}

#[test]
fn session_rewrite_returns_preserved_source_evidence() {
    let current = session_view();
    let Operation::CompareRewriteSnapshot { expected_generation, data, .. } =
        conditional(&current, Operation::RewriteSnapshot(json!({"answer":13}))).unwrap()
    else {
        panic!("a snapshot rewrite was not pinned to the current snapshot")
    };
    assert_eq!(
        (expected_generation, data["source_evidence"].clone(), data["current"].clone(), data["unrelated"].clone()),
        (7, json!([{"preserved":[1,null]}]), json!({"answer":13}), json!({"keep":true}))
    );
}

#[test]
fn session_transaction_snapshot_returns_preserved_source_evidence() {
    let current = session_view();
    let transaction = Transaction {
        id: "snapshot-input".into(),
        items: vec![],
        decisions: vec![],
        snapshot: Some(json!({"answer":13})),
        external: vec![],
    };
    let Operation::CompareTransact { expected_generation, transaction, .. } =
        conditional(&current, Operation::Transact(transaction)).unwrap()
    else {
        panic!("a transaction carrying a snapshot was not pinned to the current snapshot")
    };
    let data = transaction.snapshot.unwrap();
    assert_eq!(
        (expected_generation, data["source_evidence"].clone(), data["current"].clone()),
        (7, json!([{"preserved":[1,null]}]), json!({"answer":13}))
    );
}

#[test]
fn session_conditional_rewrite_returns_exact_stale_generation_refusal() {
    let current = session_view();
    assert_eq!(
        cadence::store::writer::precondition(&current.snapshot, 6, "stale-generation"),
        Err(Error::Conflict("conditional snapshot precondition changed".into()))
    );
}
