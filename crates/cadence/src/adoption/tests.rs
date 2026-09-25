use super::*;
use crate::derivation::{CapturedInputs, PhaseObservation, derive, parse_roadmap};
use serde_json::json;

const ROADMAP: &str = "## Phases\n- [x] **Phase 1: One**\n- [x] **Phase 2: Two**\n- [x] **Phase 3: Three**\n- [ ] **Phase 4: Four**\n- [x] **Phase 5.5: Half**\n";
/// sha256 of ROADMAP, computed by hand with sha256sum.
const ROADMAP_DIGEST: &str = "6a8eb02ec75bf6d1484ba8f8d887a7652f40d5dad205792901d076c4168ee8ef";

/// Phase 1 derives complete; 2 has a failed item; 3 has no summary; 4 is
/// unticked; 5.5 is ticked, incomplete and not a phase the native path can
/// address.
fn capture() -> CapturedInputs {
    let parsed = parse_roadmap(ROADMAP).unwrap();
    let uat = |text: &str| Observation::Present(text.as_bytes().to_vec());
    let phases = vec![
        PhaseObservation { relative_path: "phases/1".into(), plans: Observation::Present(vec!["PLAN-1.md".into()]),
            summary: Observation::Present(()), uat: uat("### 1. Done\nstatus: pass\n### 2. Skipped\nstatus: skipped\nreason: n/a\n") },
        PhaseObservation { relative_path: "phases/2".into(), plans: Observation::Present(vec!["PLAN-1.md".into()]),
            summary: Observation::Present(()), uat: uat("### 1. A\nstatus: pass\n### 2. B\nstatus: pass\n### 3. C\nstatus: fail\n") },
        PhaseObservation { relative_path: "phases/3".into(), plans: Observation::Present(vec!["PLAN-1.md".into(), "PLAN-2.md".into()]),
            summary: Observation::Absent, uat: Observation::Absent },
        PhaseObservation { relative_path: "phases/4".into(), plans: Observation::Present(vec!["PLAN.md".into()]),
            summary: Observation::Absent, uat: Observation::Absent },
        PhaseObservation { relative_path: "phases/5.5".into(), plans: Observation::Present(vec![]),
            summary: Observation::Absent, uat: Observation::Absent },
    ];
    CapturedInputs { root: "/planning".into(), root_probe: Observation::Present(()),
        roadmap: Observation::Present(ROADMAP.as_bytes().to_vec()), declarations: Some(Ok(parsed)), phases }
}

fn declared(data: &Value) -> Vec<Declaration> {
    let capture = capture();
    let legacy = derive(&capture).unwrap();
    declarations(&capture, &legacy, data).unwrap()
}

fn nine() -> Declaration {
    Declaration {
        phase: 9,
        roadmap: Roadmap { line: 377, entry: 8, digest: "3753a2a10870eb0d09170e168be9784cf186a6683ee32b3c78cf818d48f4c340".into() },
        derived: Derived { status: LifecycleStatus::Executed, legacy_rule: LEGACY_RULE.into() },
        human_results: Some(HumanResults { present: true, pass: 150, fail: 7, skipped: 0 }),
    }
}

#[test]
fn record_id_binds_root_phase_and_roadmap_bytes_and_not_the_generation() {
    let declaration = nine();
    let written = record("1:2;3:4;", &declaration, AT_IMPORT, 2, "source-gen").unwrap();
    // sha256 of ["1:2;3:4;",9,"3753a2…c340"], computed by hand with sha256sum.
    assert_eq!(written.id, "35a191c68bf6aab028763bd1db121188cad2c452b70dcfb3718867f07ba6c459");
    // The generation it lands in is not part of the identity; the roadmap bytes are.
    assert_eq!(record("1:2;3:4;", &declaration, AT_IMPORT, 3, "other").unwrap().id, written.id);
    let mut moved = declaration.clone();
    moved.roadmap.digest = "0000000000000000000000000000000000000000000000000000000000000000".into();
    assert_ne!(record("1:2;3:4;", &moved, AT_IMPORT, 2, "source-gen").unwrap().id, written.id);
    assert_ne!(record("9:9;", &declaration, AT_IMPORT, 2, "source-gen").unwrap().id, written.id);
}

#[test]
fn a_written_record_has_the_exact_declared_completion_shape() {
    let written = record("1:2;3:4;", &nine(), AT_IMPORT, 2, "source-gen").unwrap();
    assert_eq!(serde_json::to_string(&written).unwrap(), concat!(
        r#"{"schema":"verification-declared-completion-1","#,
        r#""id":"35a191c68bf6aab028763bd1db121188cad2c452b70dcfb3718867f07ba6c459","#,
        r#""root_binding":"1:2;3:4;","phase":9,"provenance":"declared-at-import","#,
        r#""roadmap":{"line":377,"entry":8,"digest":"3753a2a10870eb0d09170e168be9784cf186a6683ee32b3c78cf818d48f4c340"},"#,
        r#""import_generation":2,"source_generation":"source-gen","#,
        r#""derived":{"status":"executed","legacy_rule":"summary-and-uat"},"#,
        r#""human_results":{"present":true,"pass":150,"fail":7,"skipped":0},"claims":[]}"#));
}

#[test]
fn declarations_cover_ticked_integer_phases_the_legacy_table_derives_short_of_complete() {
    let found = declared(&Value::Null);
    assert_eq!(found, vec![
        Declaration { phase: 2, roadmap: Roadmap { line: 3, entry: 1, digest: ROADMAP_DIGEST.into() },
            derived: Derived { status: LifecycleStatus::Executed, legacy_rule: "summary-and-uat".into() },
            human_results: Some(HumanResults { present: true, pass: 2, fail: 1, skipped: 0 }) },
        Declaration { phase: 3, roadmap: Roadmap { line: 4, entry: 2, digest: ROADMAP_DIGEST.into() },
            derived: Derived { status: LifecycleStatus::Planned, legacy_rule: "summary-and-uat".into() },
            human_results: None },
    ]);
    // Phase 1 derives complete, phase 4 is unticked, phase 5.5 is unaddressable: none.
    assert!(found.iter().all(|d| d.phase == 2 || d.phase == 3));
}

#[test]
fn a_phase_with_a_native_completion_record_is_never_declared() {
    use crate::verification::{completion, model::{Basis, Source}};
    let native = completion::Record {
        schema: completion::SCHEMA.into(), id: "c1".into(), request_id: "r1".into(), root_binding: "rb".into(), phase: 3,
        occurrence: "o1".into(), attempt: "a1".into(), patch: "p1".into(),
        basis: Basis { project: "/p".into(), root_binding: "rb".into(), phase: 3, occurrence: "o1".into(), context_digest: "cd".into(),
            truths: vec![], publications: vec![], map_digest: "md".into(), admission_digests: vec![], execution_digest: "ed".into(),
            source: Source { head: "h".into(), tree: "t".into(), index_digest: "i".into(), material_digest: "m".into() } },
        authority: "auth".into(), label: "complete".into(), truths: vec![], humans: vec![], projections: Value::Null,
    };
    let data = json!({"verification":{"schema":"verification-1","attempts":[],"completions":[native]}});
    assert_eq!(declared(&data).iter().map(|d| d.phase).collect::<Vec<_>>(), [2]);
}

fn planned_nine() -> Declaration {
    Declaration { phase: 9, roadmap: Roadmap { line: 3, entry: 1, digest: ROADMAP_DIGEST.into() },
        derived: Derived { status: LifecycleStatus::Planned, legacy_rule: LEGACY_RULE.into() }, human_results: None }
}

#[test]
fn contribute_appends_records_under_the_adoption_namespace() {
    let first = record("rb", &planned_nine(), AT_IMPORT, 1, "s").unwrap();
    let data = contribute(&Value::Null, std::slice::from_ref(&first)).unwrap();
    assert_eq!(data, json!({"adoption":{"schema":"adoption-1","declared_completions":[first]}}));
    assert_eq!(contribute(&data, &[]).unwrap(), data, "nothing to write leaves the snapshot as it was");
    assert_eq!(records(&data).unwrap(), vec![first.clone()]);
    assert_eq!(records(&Value::Null).unwrap(), vec![]);
    let later = record("rb", &planned_nine(), "declared-at-adoption", 4, "s2").unwrap();
    let data = contribute(&data, std::slice::from_ref(&later)).unwrap();
    assert_eq!(records(&data).unwrap(), vec![first, later]);
}

#[test]
fn applicability_takes_the_latest_record_and_yields_to_native_authority() {
    let first = record("rb", &planned_nine(), AT_IMPORT, 1, "s").unwrap();
    let data = contribute(&Value::Null, std::slice::from_ref(&first)).unwrap();
    assert_eq!(applicable(&data, 9).unwrap(), Some(first.clone()));
    assert_eq!(applicable(&data, 10).unwrap(), None);
    // A later declaration for the same phase is the one that applies.
    let later = record("rb", &planned_nine(), "declared-at-adoption", 4, "s2").unwrap();
    let data = contribute(&data, std::slice::from_ref(&later)).unwrap();
    assert_eq!(applicable(&data, 9).unwrap(), Some(later));
    // An approved context is native authority: the declaration yields, the record stays.
    let mut with_context = data.clone();
    with_context["context"] = json!({"schema":"context-1","phases":{"9":{}}});
    assert_eq!(applicable(&with_context, 9).unwrap(), None);
    assert_eq!(records(&with_context).unwrap().len(), 2);
}

#[test]
fn records_refuses_an_unknown_adoption_namespace_schema() {
    assert!(records(&json!({"adoption":{"schema":"adoption-2"}})).is_err(), "an unknown namespace schema is refused, never read as empty");
}
