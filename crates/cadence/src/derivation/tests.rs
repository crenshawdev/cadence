use super::*;

fn captured(text: &str) -> CapturedInputs {
    let parsed = parse_roadmap(text).unwrap();
    let mut phases: Vec<PhaseObservation> = Vec::new();
    for phase in &parsed.phases {
        if !phases
            .iter()
            .any(|p| p.relative_path == phase.relative_path)
        {
            phases.push(PhaseObservation {
                relative_path: phase.relative_path.clone(),
                plans: Observation::Absent,
                summary: Observation::Absent,
                uat: Observation::Absent,
            });
        }
    }
    CapturedInputs {
        root: "/planning".into(),
        root_probe: Observation::Present(()),
        roadmap: Observation::Present(text.as_bytes().into()),
        declarations: Some(Ok(parsed)),
        phases,
    }
}

struct TruthRow {
    label: &'static str,
    plans: bool,
    summary: bool,
    uat: Option<&'static str>,
    /// Pass, fail, pending, skipped and blocked items, counted by hand from
    /// `uat`; `None` where there is no UAT text to count.
    counts: Option<[usize; 5]>,
    expected: LifecycleStatus,
}

fn truth_rows() -> Vec<TruthRow> {
    use LifecycleStatus::*;
    [
        ("no artifacts", false, false, None, None, Unplanned),
        ("PLAN only", true, false, None, None, Planned),
        ("SUMMARY only", false, true, None, None, Executed),
        ("PLAN and SUMMARY", true, true, None, None, Executed),
        ("pass without PLAN", false, true, Some("### 1. Check\nstatus: pass"), Some([1, 0, 0, 0, 0]), Complete),
        ("pass with PLAN", true, true, Some("### 1. Check\nstatus: pass"), Some([1, 0, 0, 0, 0]), Complete),
        ("UAT without SUMMARY", false, false, Some("### 1. Check\nstatus: pass"), Some([1, 0, 0, 0, 0]), Unplanned),
        ("PLAN UAT without SUMMARY", true, false, Some("### 1. Check\nstatus: pass"), Some([1, 0, 0, 0, 0]), Planned),
        ("empty UAT", false, true, Some(""), None, Executed),
        ("malformed UAT", false, true, Some("not a checklist"), Some([0, 0, 0, 0, 0]), Executed),
        ("frontmatter complete", false, true, Some("---\nstatus: complete\n---"), Some([0, 0, 0, 0, 0]), Executed),
        ("manual numbered prose", false, true, Some("### Manual notes\n1. Check\nstatus: pass"), Some([0, 0, 0, 0, 0]), Executed),
        ("unknown status", false, true, Some("### 1. Check\nstatus: constructor"), Some([0, 0, 0, 0, 0]), Executed),
        ("missing status", false, true, Some("### 1. Check"), Some([0, 0, 0, 0, 0]), Executed),
        ("fail", false, true, Some("### 1. Check\nstatus: fail"), Some([0, 1, 0, 0, 0]), Executed),
        ("pending", false, true, Some("### 1. Check\nstatus: pending"), Some([0, 0, 1, 0, 0]), Executed),
        ("blocked", false, true, Some("### 1. Check\nstatus: blocked"), Some([0, 0, 0, 0, 1]), Executed),
        ("skip reason", false, true, Some("### 1. Check\nstatus: skipped\nreason: deferred"), Some([0, 0, 0, 1, 0]), Complete),
        ("skip no reason", false, true, Some("### 1. Check\nstatus: skipped"), Some([0, 0, 0, 1, 0]), Executed),
        ("skip empty reason", false, true, Some("### 1. Check\nstatus: skipped\nreason:"), Some([0, 0, 0, 1, 0]), Executed),
        ("skip space reason", false, true, Some("### 1. Check\nstatus: skipped\nreason:   "), Some([0, 0, 0, 1, 0]), Complete),
        ("pass and reasoned skip", false, true, Some("### 1. Check\nstatus: pass\n### 2. Skip\nstatus: skipped\nreason: later"), Some([1, 0, 0, 1, 0]), Complete),
    ]
    .into_iter()
    .map(|(label, plans, summary, uat, counts, expected)| TruthRow {
        label,
        plans,
        summary,
        uat,
        counts,
        expected,
    })
    .collect()
}

#[test]
fn ac1_production_truth_table() {
    for row in truth_rows() {
        let mut capture = captured("## Phases\n- [ ] **Phase 1: One**");
        let phase = &mut capture.phases[0];
        if row.plans {
            phase.plans = Observation::Present(vec!["PLAN.md".into()]);
        }
        if row.summary {
            phase.summary = Observation::Present(());
        }
        phase.uat = row.uat.map_or(Observation::Absent, |s| {
            Observation::Present(s.as_bytes().into())
        });
        let answer = derive(&capture).unwrap();
        let phase = &answer.phases[0];
        assert_eq!(phase.plans.len(), usize::from(row.plans), "{}", row.label);
        let counts = row.counts.map(|[pass, fail, pending, skipped, blocked]| UatCounts {
            pass,
            fail,
            pending,
            skipped,
            blocked,
        });
        assert_eq!(phase.uat, counts, "{}", row.label);
        assert_eq!(phase.status, row.expected, "{}", row.label);
    }
}

#[test]
fn ac1_removing_final_skip_reason_prevents_completion() {
    let mut capture = captured("## Phases\n- [ ] **Phase 1: One**");
    capture.phases[0].summary = Observation::Present(());
    capture.phases[0].uat = Observation::Present(
        b"### 1. Pass\nstatus: pass\n### 2. Skip\nstatus: skipped\nreason: later".to_vec(),
    );
    assert_eq!(
        derive(&capture).unwrap().phases[0].status,
        LifecycleStatus::Complete
    );
    capture.phases[0].uat =
        Observation::Present(b"### 1. Pass\nstatus: pass\n### 2. Skip\nstatus: skipped".to_vec());
    assert_eq!(
        derive(&capture).unwrap().phases[0].status,
        LifecycleStatus::Executed
    );
}

#[test]
fn ac1_failures_cannot_derive_success() {
    let mut capture = captured("## Phases\n- [ ] **Phase 1: One**");
    capture.root_probe = Observation::Absent;
    assert_eq!(
        derive(&capture).unwrap_err().code(),
        "missing-planning-root"
    );
    capture.root_probe = Observation::Present(());
    capture.roadmap = Observation::Absent;
    assert_eq!(derive(&capture).unwrap_err().code(), "missing-roadmap");
    capture.roadmap = Observation::Present(vec![]);
    capture.declarations = Some(parse_roadmap(""));
    assert_eq!(derive(&capture).unwrap_err().code(), "invalid-roadmap");
    let error = InputFailure {
        path: "/planning/phases/1/UAT.md".into(),
        category: InputFailureCategory::PermissionDenied,
        diagnostic: None,
    };
    capture.phases[0].uat = Observation::Failed(error.clone());
    assert_eq!(
        derive(&capture).unwrap_err(),
        DerivationError::InputFailure(error)
    );
}

fn complete(phase: &mut PhaseObservation) {
    phase.summary = Observation::Present(());
    phase.uat = Observation::Present(b"### 1. Check\nstatus: pass".to_vec());
}

#[test]
fn ac2_current_follows_list_order_not_number() {
    for order in [
        [8, 2, 5],
        [8, 5, 2],
        [2, 5, 8],
        [2, 8, 5],
        [5, 2, 8],
        [5, 8, 2],
    ] {
        let entries = order
            .map(|n| format!("- [ ] **Phase {n}: P{n}**"))
            .join("\n");
        let mut capture = captured(&format!("## Phases\n{entries}"));
        complete(&mut capture.phases[0]);
        let answer = derive(&capture).unwrap();
        assert_eq!(answer.current, Some(PhaseId(f64::from(order[1]))));
        assert_eq!(answer.total, 3);
        assert_eq!(
            answer
                .phases
                .iter()
                .map(|p| p.id.number())
                .collect::<Vec<_>>(),
            order.map(f64::from)
        );
        capture.phases[0].uat = Observation::Present(b"### 1. Check\nstatus: pending".to_vec());
        assert_eq!(derive(&capture).unwrap().current, Some(PhaseId(f64::from(order[0]))));
    }
}

#[test]
fn ac2_numeric_ties_share_evidence_and_preserve_names_and_order() {
    let mut capture = captured(
        "## Phases\n- [ ] **Phase 2: Two**\n- [ ] **Phase 1.10: First tie**\n- [ ] **Phase 01: One**\n- [ ] **Phase 1.1: Second tie**",
    );
    complete(&mut capture.phases[0]);
    capture.phases[1].plans = Observation::Present(vec!["PLAN-2.md".into()]);
    let answer = derive(&capture).unwrap();
    assert_eq!(capture.phases.len(), 3);
    assert_eq!(answer.total, 4);
    assert_eq!(answer.current, Some(PhaseId(1.1)));
    assert_eq!(
        answer
            .phases
            .iter()
            .map(|p| p.name.as_str())
            .collect::<Vec<_>>(),
        ["Two", "First tie", "One", "Second tie"]
    );
    assert_eq!(answer.phases[1].plans, answer.phases[3].plans);
    assert_eq!(answer.phases[1].status, LifecycleStatus::Planned);
    assert_eq!(answer.phases[3].status, LifecycleStatus::Planned);
}

#[test]
fn ac2_closed_null_zero_differs_from_live_null_all_complete() {
    let closed = derive(&captured("## Phases\nDone")).unwrap();
    assert_eq!(
        (closed.cycle, closed.current, closed.total),
        (Cycle::Closed, None, 0)
    );
    let mut capture = captured("## Phases\n- [ ] **Phase 1: One**");
    complete(&mut capture.phases[0]);
    let live = derive(&capture).unwrap();
    assert_eq!(
        (live.cycle, live.current, live.total),
        (Cycle::Live, None, 1)
    );
}

#[test]
fn a_ticked_checkbox_never_changes_the_derived_lifecycle() {
    let unchecked = captured("## Phases\n- [ ] **Phase 1: One**");
    let checked = captured("## Phases\n- [x] **Phase 1: One**");
    assert_eq!(derive(&unchecked).unwrap(), derive(&checked).unwrap());
    assert_eq!(
        derive(&checked).unwrap().phases[0].status,
        LifecycleStatus::Unplanned
    );
}

#[test]
fn a_roadmap_with_no_phases_section_or_only_malformed_entries_is_invalid() {
    let unchecked = captured("## Phases\n- [ ] **Phase 1: One**");
    for text in ["# No section", "## Phases\n- Phase 1: Bad"] {
        let mut capture = unchecked.clone();
        capture.roadmap = Observation::Present(text.as_bytes().into());
        capture.declarations = Some(parse_roadmap(text));
        assert_eq!(derive(&capture).unwrap_err().code(), "invalid-roadmap");
    }
}

#[test]
fn a_malformed_entry_beside_a_valid_one_is_skipped() {
    assert_eq!(
        derive(&captured(
            "## Phases\n- Phase 8: Bad\n- [ ] **Phase 1: Good**"
        ))
        .unwrap()
        .total,
        1
    );
}

#[test]
fn a_bom_and_crlf_line_endings_parse_without_shifting_source_lines() {
    for text in [
        "## Phases\n- [ ] **Phase 1: One**",
        "\u{feff}## Phases\r\n- [ ] **Phase 1: One**\r\n",
    ] {
        let parsed = parse_roadmap(text).unwrap();
        assert_eq!(parsed.phases.len(), 1);
        assert_eq!(parsed.phases[0].source_line, 2);
    }
}

#[test]
fn malformed_or_misplaced_phases_sections_are_refused() {
    for text in [
        "## Phases\r- [ ] **Phase 1: One**",
        "# Roadmap",
        "```\n## Phases\n```",
        "## Phases\n- [X] **Phase 1: One**",
        "## Phases\n## Details\n### Phase 1: One",
        "## Phases\n## Later\n- [ ] **Phase 1: One**",
    ] {
        assert!(parse_roadmap(text).is_err(), "{text:?}");
    }
}

#[test]
fn a_phases_section_with_no_entry_lines_is_a_closed_cycle() {
    for text in [
        "## Phases",
        "  ## Phases  \nAll done\n## Details\nphase 1 is prose",
        "## Phases\n```\nPhase 1\n```",
        "## Phases\nNotPhase 1\nPhase 1abc",
    ] {
        assert_eq!(
            parse_roadmap(text).unwrap().cycle,
            Cycle::Closed,
            "{text:?}"
        );
    }
}

#[test]
fn only_entries_inside_the_phases_section_count_and_a_trailing_text_is_the_description() {
    let parsed = parse_roadmap("## Phases\n- [X] **Phase 8: Bad**\n- [ ] **Phase 2: Good** - description\n## Details\n- [ ] **Phase 3: Outside**").unwrap();
    assert_eq!(parsed.phases.len(), 1);
    assert_eq!(parsed.phases[0].description, "description");
}

#[test]
fn parsers_roadmap_fences_match_character_length_and_empty_info() {
    let text = "~~~example\n## Phases\n- [ ] **Phase 99: Fake**\n~~~\n   ## Phases\n````rust\n- [ ] **Phase 90: Fake**\n```\n## Fake boundary\n```` not a closer\n- [ ] **Phase 91: Fake**\n~~~~\n`````   \n- [x] **Phase 2: Real**\n   ~~~\n- [ ] **Phase 92: Fake**\n   ~~~\n- [ ] **Phase 1: First**";
    let parsed = parse_roadmap(text).unwrap();
    assert_eq!(
        parsed
            .phases
            .iter()
            .map(|p| p.name.as_str())
            .collect::<Vec<_>>(),
        ["Real", "First"]
    );
    assert!(parsed.phases[0].checked);
    // Four spaces do not open a fence in the frozen scanner.
    assert_eq!(
        parse_roadmap("## Phases\n    ```\n- [ ] **Phase 1: Real**")
            .unwrap()
            .phases
            .len(),
        1
    );
}

#[test]
fn entries_keep_their_textual_order_as_ordinals() {
    let parsed = parse_roadmap("## Phases\n- [ ] **Phase 2: Two**\n- [ ] **Phase 1.10: Decimal A**\n- [ ] **Phase 01: Alias A**\n- [ ] **Phase 1.1: Decimal B**\n- [ ] **Phase 1.0: Alias B**\n- [ ] **Phase 1: Alias C**").unwrap();
    assert_eq!(
        parsed.phases.iter().map(|p| p.ordinal).collect::<Vec<_>>(),
        [0, 1, 2, 3, 4, 5]
    );
}

#[test]
fn an_address_is_the_number_as_javascript_formats_it_and_names_its_directory() {
    let parsed = parse_roadmap("## Phases\n- [ ] **Phase 2: Two**\n- [ ] **Phase 1.10: Decimal A**\n- [ ] **Phase 01: Alias A**\n- [ ] **Phase 1.1: Decimal B**\n- [ ] **Phase 1.0: Alias B**\n- [ ] **Phase 1: Alias C**").unwrap();
    assert_eq!(
        parsed
            .phases
            .iter()
            .map(|p| p.id.address())
            .collect::<Vec<_>>(),
        ["2", "1.1", "1", "1.1", "1", "1"]
    );
    for p in parsed.phases {
        assert_eq!(
            p.relative_path,
            std::path::PathBuf::from(format!("phases/{}", p.id.address()))
        );
    }
    for (number, address) in [
        ("0.000001", "0.000001"),
        ("0.0000001", "1e-7"),
        ("1000000000000000000000", "1e+21"),
        ("9007199254740993", "9007199254740992"),
    ] {
        let parsed = parse_roadmap(&format!("## Phases\n- [ ] **Phase {number}: N**")).unwrap();
        assert_eq!(parsed.phases[0].id.address(), address);
    }
}

#[test]
fn line_endings_and_a_bom_decide_where_item_headings_are_recognized() {
    assert_eq!(parse_uat("pre\r### 1. Item\nstatus: pass").counts.pass, 1);
    assert_eq!(
        parse_uat("pre\u{2028}### 1. Item\nstatus: pass")
            .counts
            .pass,
        1
    );
    assert_eq!(parse_uat("\u{feff}### 1. BOM\nstatus: pass").items.len(), 0);
    assert_eq!(parse_uat("### 1. CRLF\r\nstatus: pass\r\n").counts.pass, 1);
    assert_eq!(parse_uat("### 1. Lone CR\rstatus: pass").items.len(), 0);
}

#[test]
fn text_without_numbered_level_three_headings_yields_no_items() {
    for text in [
        "",
        "---\nstatus: complete\n---",
        "### Manual notes\n1. check logs\nstatus: pass",
        " ### 1. Indented\nstatus: pass",
    ] {
        let parsed = parse_uat(text);
        assert!(parsed.items.is_empty());
        assert_eq!(parsed.counts, UatCounts::default());
    }
}

#[test]
fn the_last_status_and_reason_in_an_item_win_and_counts_tally_known_statuses() {
    let parsed = parse_uat(
        "### 1. First\nstatus: fail\nstatus: pass\nstatus:\n status: blocked\nnot-key: ignored\nreason: old\nreason: final  \n### 2. Unknown\nstatus: constructor\n### 3. Skip\nstatus: skipped\nreason:   \n### 4. Pending\nstatus: pending\n### 5. Blocked\nstatus: blocked",
    );
    assert_eq!(parsed.items.len(), 5);
    assert_eq!(parsed.items[0].status.as_deref(), Some("pass"));
    assert_eq!(parsed.items[0].reason.as_deref(), Some("final"));
    assert_eq!(parsed.items[1].status.as_deref(), Some("constructor"));
    assert_eq!(parsed.items[2].reason.as_deref(), Some(" "));
    assert_eq!(
        parsed.counts,
        UatCounts {
            pass: 1,
            fail: 0,
            pending: 1,
            skipped: 1,
            blocked: 1
        }
    );
}

#[test]
fn fences_do_not_hide_item_headings_or_fields() {
    let parsed = parse_uat(
        "### 1. Item\nstatus: pending\n````\n## Fenced section\nstatus: pass\n```\n```` info\nreason: inside\n````\n## End\nstatus: fail\n```\n### 2. Fenced heading still splits\nstatus: blocked\n```",
    );
    assert_eq!(parsed.items.len(), 2);
    assert_eq!(parsed.items[0].status.as_deref(), Some("pass"));
    assert_eq!(parsed.items[0].reason.as_deref(), Some("inside"));
    assert_eq!(parsed.items[1].status.as_deref(), Some("blocked"));
}

#[test]
fn uat_status_matching_is_case_sensitive() {
    assert_eq!(
        parse_uat("### 1. Item\nstatus: PASS").counts,
        UatCounts::default()
    );
}

fn round_trip<T>(value: &T)
where
    T: serde::Serialize + serde::de::DeserializeOwned + PartialEq + std::fmt::Debug,
{
    let bytes = serde_json::to_vec(value).unwrap();
    assert_eq!(&serde_json::from_slice::<T>(&bytes).unwrap(), value);
}

#[test]
fn contract_exactly_four_native_status_strings() {
    for (status, word) in [
        (LifecycleStatus::Unplanned, "unplanned"),
        (LifecycleStatus::Planned, "planned"),
        (LifecycleStatus::Executed, "executed"),
        (LifecycleStatus::Complete, "complete"),
    ] {
        assert_eq!(serde_json::to_value(status).unwrap(), word);
        round_trip(&status);
    }
    for word in [
        "paused",
        "Complete",
        "ready to plan",
        "context gathered",
        "phase complete",
    ] {
        assert!(serde_json::from_value::<LifecycleStatus>(word.into()).is_err());
    }
}

#[test]
fn contract_round_trips_order_plans_counters_and_null_cycles() {
    let closed = Lifecycle {
        cycle: Cycle::Closed,
        current: None,
        total: 0,
        phases: vec![],
    };
    let mut live = Lifecycle {
        cycle: Cycle::Live,
        ..closed.clone()
    };
    for (i, plans) in [vec![], vec!["PLAN.md"], vec!["PLAN-10.md", "PLAN-2.md"]]
        .into_iter()
        .enumerate()
    {
        live.phases.push(PhaseRecord {
            id: PhaseId((3 - i) as f64),
            name: format!("entry {i}"),
            plans: plans.into_iter().map(str::to_owned).collect(),
            status: LifecycleStatus::Complete,
            uat: (i != 0).then_some(UatCounts {
                pass: 1,
                fail: 2,
                pending: 3,
                skipped: 4,
                blocked: 5,
            }),
            accepted: false,
        });
    }
    live.total = live.phases.len();
    assert_ne!(closed, live);
    round_trip(&closed);
    round_trip(&live);
    assert_eq!(
        serde_json::to_value(&closed).unwrap()["current"],
        serde_json::Value::Null
    );
    assert_eq!(
        serde_json::to_value(&live).unwrap()["current"],
        serde_json::Value::Null
    );
}

fn imported_cursor(status: &str, phase: u64, total: u64) -> serde_json::Value {
    serde_json::json!({"available": true, "phase": phase, "total": total, "name": "Three",
        "status": status, "next": "  /cad-plan 3 --exact\t ", "updated": "2026-09-06",
        "original_fields": {"phase": format!("{phase} of {total} (Three)"), "status": status,
            "next": "  /cad-plan 3 --exact\t ", "updated": "2026-09-06", "extra": [null, "retained"]},
        "extra": {"keep": true}})
}

fn legacy_state(status: &str) -> String {
    format!(
        "# State\nPhase: 3 of 4 (Three)\nStatus: {status}\nNext:  /cad-plan 3 --exact\t \nUpdated: 2026-09-06\n"
    )
}

const STATUS_WORDS: [(&str, LifecycleStatus); 7] = [
    ("unplanned", LifecycleStatus::Unplanned),
    ("ready to plan", LifecycleStatus::Unplanned),
    ("context gathered", LifecycleStatus::Unplanned),
    ("planned", LifecycleStatus::Planned),
    ("executed", LifecycleStatus::Executed),
    ("complete", LifecycleStatus::Complete),
    ("phase complete", LifecycleStatus::Complete),
];

#[test]
fn status_words_and_aliases_normalize_on_the_cursor_and_state_paths() {
    for (word, expected) in STATUS_WORDS {
        let normalized = normalize_imported_cursor(&imported_cursor(word, 3, 4)).unwrap();
        assert!(
            matches!(&normalized, CompatibilityCursor::Assertion { status, .. } if *status == expected)
        );
        let normalized = normalize_legacy_state(legacy_state(word).as_bytes()).unwrap();
        assert!(
            matches!(&normalized, CompatibilityCursor::Assertion { status, .. } if *status == expected)
        );
    }
}

#[test]
fn normalization_keeps_the_original_cursor_fields_bytes_and_trimmed_next() {
    for (word, _) in STATUS_WORDS {
        let raw = imported_cursor(word, 3, 4);
        let before = raw.clone();
        let normalized = normalize_imported_cursor(&raw).unwrap();
        let p = normalized.provenance();
        assert_eq!(p.original_cursor, before);
        assert_eq!(p.original_fields.as_ref(), raw.get("original_fields"));
        assert_eq!(p.next.as_deref(), raw["next"].as_str());
        assert_eq!(raw, before);
        let state = legacy_state(word);
        let normalized = normalize_legacy_state(state.as_bytes()).unwrap();
        assert_eq!(
            normalized.provenance().source_bytes.as_deref(),
            Some(state.as_bytes())
        );
        assert_eq!(
            normalized.provenance().next.as_deref(),
            Some("/cad-plan 3 --exact")
        );
    }
}

#[test]
fn paused_normalizes_to_held_on_both_paths() {
    for normalized in [
        normalize_imported_cursor(&imported_cursor("paused", 3, 4)),
        normalize_legacy_state(legacy_state("paused").as_bytes()),
    ] {
        assert!(matches!(normalized.unwrap(), CompatibilityCursor::Held(_)));
    }
}

#[test]
fn an_unknown_or_case_changed_status_is_refused_naming_its_source() {
    for word in ["surprised", "Planned", "UNPLANNED"] {
        for (source, result) in [
            (
                "data.cursor",
                normalize_imported_cursor(&imported_cursor(word, 3, 4)),
            ),
            (
                "STATE.md",
                normalize_legacy_state(legacy_state(word).as_bytes()),
            ),
        ] {
            let error = result.unwrap_err();
            assert_eq!(error.code(), "invalid-status");
            assert_eq!(
                error,
                DerivationError::InvalidStatus {
                    source: source.into(),
                    original_status: word.into()
                }
            );
        }
    }
}

#[test]
fn ac5_normalize_blank_name_and_next_are_line_bounded_native_constraints() {
    for (old, new) in [
        ("(Three)", "(   )"),
        ("Next:  /cad-plan 3 --exact\t ", "Next:"),
        ("Next:  /cad-plan 3 --exact\t ", "Next: \t "),
    ] {
        let state = legacy_state("unplanned").replace(old, new);
        let result = normalize_legacy_state(state.as_bytes()).unwrap();
        assert!(
            matches!(result, CompatibilityCursor::Unavailable(_)),
            "{state}"
        );
        assert_eq!(
            result.provenance().source_bytes.as_deref(),
            Some(state.as_bytes())
        );
    }
    for (key, value) in [
        ("name", "   "),
        ("next", ""),
        ("next", " \t "),
        ("next", "\nUpdated: 2026-09-06"),
    ] {
        let mut raw = imported_cursor("unplanned", 3, 4);
        raw.as_object_mut().unwrap().remove("original_fields");
        raw[key] = value.into();
        let result = normalize_imported_cursor(&raw).unwrap();
        assert!(
            matches!(result, CompatibilityCursor::Unavailable(_)),
            "{key}={value:?}"
        );
        assert_eq!(result.provenance().original_cursor, raw);
    }
}

#[test]
fn ac5_normalize_malformed_and_inconsistent_inputs_stay_unavailable() {
    for key in ["phase", "total", "name", "status", "next", "updated"] {
        for replacement in [
            None,
            Some(serde_json::Value::Null),
            Some(serde_json::json!([])),
        ] {
            let mut raw = imported_cursor("unplanned", 3, 4);
            if let Some(value) = replacement {
                raw[key] = value;
            } else {
                raw.as_object_mut().unwrap().remove(key);
            }
            let result = normalize_imported_cursor(&raw).unwrap();
            assert!(
                matches!(result, CompatibilityCursor::Unavailable(_)),
                "{key}"
            );
            assert_eq!(result.provenance().original_cursor, raw);
        }
    }
    for (key, value) in [
        ("phase", "+3 of 4 (Three)"),
        ("phase", "3e0 of 4 (Three)"),
        ("phase", "3 of 4 (   )"),
        ("phase", "3 of 4 (Other)"),
        ("phase", "2 of 4 (Three)"),
        ("phase", "3 of 5 (Three)"),
        ("status", "planned"),
        ("status", ""),
        ("next", "other"),
        ("next", ""),
        ("updated", "2026-09-07"),
    ] {
        let mut raw = imported_cursor("unplanned", 3, 4);
        raw["original_fields"][key] = value.into();
        assert!(
            matches!(
                normalize_imported_cursor(&raw).unwrap(),
                CompatibilityCursor::Unavailable(_)
            ),
            "{key}={value}"
        );
    }
    for date in ["2026-9-06", "20260906", "yesterday", "2026-09-06 extra"] {
        let state = legacy_state("unplanned").replace("2026-09-06", date);
        assert!(matches!(
            normalize_legacy_state(state.as_bytes()).unwrap(),
            CompatibilityCursor::Unavailable(_)
        ));
        let mut raw = imported_cursor("unplanned", 3, 4);
        raw["updated"] = date.into();
        raw["original_fields"]["updated"] = date.into();
        assert!(matches!(
            normalize_imported_cursor(&raw).unwrap(),
            CompatibilityCursor::Unavailable(_)
        ));
    }
    for prefix in ["Phase:", "Status:", "Next:", "Updated:"] {
        let state = legacy_state("unplanned")
            .lines()
            .filter(|s| !s.starts_with(prefix))
            .collect::<Vec<_>>()
            .join("\n");
        assert!(
            matches!(
                normalize_legacy_state(state.as_bytes()).unwrap(),
                CompatibilityCursor::Unavailable(_)
            ),
            "{prefix}"
        );
    }
    for raw in [
        serde_json::Value::Null,
        serde_json::json!({"available": true}),
        serde_json::json!({"available": false}),
    ] {
        assert!(matches!(
            normalize_imported_cursor(&raw).unwrap(),
            CompatibilityCursor::Unavailable(_)
        ));
    }
}

fn agreement(
    capture: &CapturedInputs,
    word: &str,
    phase: u64,
    total: u64,
) -> Result<(), DerivationError> {
    let cursor = normalize_imported_cursor(&imported_cursor(word, phase, total))?;
    check_consistency(validate_inputs(capture)?, &derive(capture)?, &cursor)
}

fn agreement_failures(
    check: impl Fn(&CapturedInputs, &str, u64, u64) -> Result<(), DerivationError>,
) -> Vec<String> {
    let live = captured("## Phases\n- [ ] **Phase 3: Three**");
    let closed = captured("## Phases\nNo active phases.");
    let mut done = captured("## Phases\n- [x] **Phase 3: Three**");
    complete(&mut done.phases[0]);
    let mut failed = Vec::new();
    for word in [
        "unplanned",
        "ready to plan",
        "context gathered",
        "planned",
        "executed",
        "complete",
        "phase complete",
        "paused",
    ] {
        for (label, capture, phase, total, expected) in [
            (
                "live",
                &live,
                3,
                4,
                matches!(
                    word,
                    "unplanned" | "ready to plan" | "context gathered" | "paused"
                ),
            ),
            ("wrong phase", &live, 2, 4, word == "paused"),
            (
                "all complete",
                &done,
                99,
                4,
                matches!(word, "complete" | "phase complete" | "paused"),
            ),
            (
                "closed",
                &closed,
                99,
                0,
                matches!(
                    word,
                    "unplanned"
                        | "ready to plan"
                        | "context gathered"
                        | "complete"
                        | "phase complete"
                        | "paused"
                ),
            ),
            ("closed nonzero", &closed, 99, 4, false),
        ] {
            let result = check(capture, word, phase, total);
            if result.is_ok() != expected {
                failed.push(format!("{label}: {word}"));
            } else if let Err(error) = result {
                assert_eq!(error.code(), "state-conflict");
            }
        }
    }
    failed
}

#[test]
fn ac5_agreement_canonical_alias_closed_all_complete_and_hold_table() {
    assert_eq!(agreement_failures(agreement), Vec::<String>::new());
}

fn conflict_only<T>(
    result: &Result<T, DerivationError>,
    source: &str,
    field: &str,
    declared: &str,
    derived: &str,
) -> bool {
    matches!(result, Err(DerivationError::StateConflict { source: s, field: f, declared: a, derived: b, .. })
        if s == source && f == field && a == declared && b == derived && a != b)
}

#[test]
fn ac6_conflicts_both_checkbox_directions() {
    for checked in [true, false] {
        let mut capture = captured(&format!(
            "## Phases\n- [{}] **Phase 3: Three**",
            if checked { "x" } else { " " }
        ));
        if !checked {
            complete(&mut capture.phases[0]);
        }
        let answer = derive(&capture).unwrap();
        let cursor = normalize_imported_cursor(&serde_json::Value::Null).unwrap();
        let result = check_consistency(validate_inputs(&capture).unwrap(), &answer, &cursor);
        let declared = checked.to_string();
        let derived = (!checked).to_string();
        assert!(conflict_only(
            &result,
            "ROADMAP.md:2 entry 0",
            "complete",
            &declared,
            &derived
        ));
        let error = result.unwrap_err().to_string();
        for expected in [
            "state-conflict",
            "ROADMAP.md:2 entry 0",
            &declared,
            &derived,
        ] {
            assert!(error.contains(expected));
        }
    }
}

struct FixedIntake(IntakeObservation);
impl IntakeIo for FixedIntake {
    fn observe_intake(&mut self) -> Result<IntakeObservation, DerivationError> {
        Ok(self.0.clone())
    }
}

fn validated_for(data: &serde_json::Value) -> RecheckedLifecycle {
    let temp = tempfile::tempdir().unwrap();
    std::fs::write(
        temp.path().join("ROADMAP.md"),
        "## Phases\n- [ ] **Phase 3: Three**",
    )
    .unwrap();
    let selected = select_intake(data).unwrap();
    query_with_intake(
        temp.path(),
        &mut ArtifactFiles,
        &selected.cursor,
        &selected.observation,
        &mut FixedIntake(selected.observation.clone()),
    )
    .unwrap()
}

/// A paused imported cursor beside unrelated data and a derivation extension.
fn unadopted() -> serde_json::Value {
    serde_json::json!({"cursor":imported_cursor("paused", 3, 4), "unrelated":[1,null], "derivation":{"extension":true}})
}

fn adopted() -> serde_json::Value {
    let original = unadopted();
    adopt(&original, serde_json::json!({"fixture":"opaque memo"}), validated_for(&original).intake().unwrap()).unwrap()
}

#[test]
fn adopt_keeps_unrelated_data_and_the_namespace_and_installs_the_memo_and_a_retired_intake() {
    let original = unadopted();
    let memo = serde_json::json!({"fixture":"opaque memo"});
    let adopted = adopt(&original, memo.clone(), validated_for(&original).intake().unwrap()).unwrap();
    assert_eq!(adopted["cursor"], original["cursor"]);
    assert_eq!(adopted["unrelated"], original["unrelated"]);
    assert_eq!(adopted["derivation"]["extension"], true);
    assert_eq!(adopted["derivation"]["memo"], memo);
    assert_eq!(adopted["derivation"]["intake"]["retired"], true);
}

#[test]
fn an_adopted_cursor_selects_as_unavailable_and_readoption_keeps_the_intake_record() {
    let adopted = adopted();
    assert!(matches!(
        select_intake(&adopted).unwrap().cursor,
        CompatibilityCursor::Unavailable(_)
    ));
    let again = adopt(
        &adopted,
        serde_json::json!("second memo"),
        validated_for(&adopted).intake().unwrap(),
    )
    .unwrap();
    assert_eq!(
        again["derivation"]["intake"],
        adopted["derivation"]["intake"]
    );
}

#[test]
fn a_changed_cursor_rearms_as_held_and_the_old_validation_is_refused() {
    let accepted = validated_for(&unadopted());
    let mut changed = adopted();
    changed["cursor"]["extra"] = false.into();
    assert!(matches!(
        select_intake(&changed).unwrap().cursor,
        CompatibilityCursor::Held(_)
    ));
    assert_eq!(
        adopt(&changed, serde_json::json!({"fixture":"opaque memo"}), accepted.intake().unwrap())
            .unwrap_err()
            .code(),
        "inputs-changed"
    );
}

#[test]
fn adopting_into_empty_data_creates_only_the_derivation_namespace() {
    let fresh = serde_json::Value::Null;
    let adopted = adopt(&fresh, serde_json::json!({"fixture":"opaque memo"}), validated_for(&fresh).intake().unwrap()).unwrap();
    assert!(adopted.is_object());
    assert!(adopted.get("cursor").is_none());
    assert!(adopted["derivation"].get("memo").is_some());
}

#[test]
fn ac5_adopt_malformed_retirement_cannot_suppress_comparison_or_discard_data() {
    let original = serde_json::json!({"cursor":imported_cursor("unplanned", 3, 4)});
    // The intake adopt accepts: what select_intake chose, as the query would
    // hand it over after its own consistency check.
    let selected = select_intake(&original).unwrap();
    let accepted = ValidatedIntake {
        cursor: selected.cursor,
        observation: selected.observation,
    };
    let valid = adopt(&original, serde_json::json!("opaque fixture"), &accepted)
    .unwrap();
    let mut malformed = Vec::new();
    for (field, value) in [
        ("version", serde_json::json!(2)),
        ("source", serde_json::json!("elsewhere")),
        ("retired", serde_json::json!(false)),
        ("normalized", serde_json::Value::Null),
        ("original_cursor", serde_json::json!({})),
    ] {
        let mut data = valid.clone();
        data["derivation"]["intake"][field] = value;
        malformed.push(data);
    }
    for field in [
        "version",
        "source",
        "original_cursor",
        "normalized",
        "retired",
    ] {
        let mut data = valid.clone();
        data["derivation"]["intake"]
            .as_object_mut()
            .unwrap()
            .remove(field);
        malformed.push(data);
    }
    let mut only_retirement = valid.clone();
    only_retirement["derivation"]
        .as_object_mut()
        .unwrap()
        .remove("memo");
    malformed.push(only_retirement);
    for value in [
        serde_json::Value::Null,
        serde_json::json!(true),
        serde_json::json!([]),
    ] {
        let mut data = valid.clone();
        data["derivation"]["intake"] = value;
        malformed.push(data);
    }
    malformed.extend([
        serde_json::json!(42),
        serde_json::json!([]),
        serde_json::json!("data"),
        serde_json::json!({"derivation":null}),
        serde_json::json!({"derivation":[]}),
    ]);
    for data in malformed {
        assert_eq!(
            select_intake(&data).unwrap_err().code(),
            "invalid-intake",
            "{data}"
        );
        assert_eq!(
            adopt(&data, serde_json::Value::Null, &accepted)
                .unwrap_err()
                .code(),
            "invalid-intake"
        );
    }
}

fn key_fixture() -> CapturedInputs {
    let mut c = captured("## Phases\n- [ ] **Phase 1: One**\n- [ ] **Phase 2: Two**\n");
    c.phases[0].plans = Observation::Present(vec!["PLAN-1.md".into(), "PLAN.md".into()]);
    c.phases[0].uat =
        Observation::Present(b"### 1. Check\nstatus: skipped\nreason: later".to_vec());
    c
}

fn key_rows() -> Vec<(&'static str, CapturedInputs, CapturedInputs)> {
    let base = key_fixture();
    let mut rows = Vec::new();
    macro_rules! row {
        ($name:literal, $c:ident, $change:expr) => {{
            let mut $c = base.clone();
            $change;
            rows.push(($name, base.clone(), $c));
        }};
    }
    row!("root address", c, c.root = "/other".into());
    row!("root probe", c, c.root_probe = Observation::Absent);
    row!("roadmap outcome", c, c.roadmap = Observation::Absent);
    row!(
        "roadmap bytes",
        c,
        c.roadmap = Observation::Present(b"other".to_vec())
    );
    row!("phase count", c, {
        c.declarations
            .as_mut()
            .unwrap()
            .as_mut()
            .unwrap()
            .phases
            .pop();
    });
    row!(
        "phase order",
        c,
        c.declarations
            .as_mut()
            .unwrap()
            .as_mut()
            .unwrap()
            .phases
            .reverse()
    );
    row!(
        "phase id",
        c,
        c.declarations.as_mut().unwrap().as_mut().unwrap().phases[0].id = PhaseId(3.0)
    );
    row!("phase path", c, {
        c.declarations.as_mut().unwrap().as_mut().unwrap().phases[0].relative_path =
            "phases/other".into();
        c.phases[0].relative_path = "phases/other".into();
    });
    row!(
        "listing outcome",
        c,
        c.phases[0].plans = Observation::Absent
    );
    row!(
        "plan count",
        c,
        c.phases[0].plans = Observation::Present(vec!["PLAN.md".into()])
    );
    row!(
        "plan name",
        c,
        c.phases[0].plans = Observation::Present(vec!["PLAN-2.md".into(), "PLAN.md".into()])
    );
    row!("summary", c, c.phases[0].summary = Observation::Present(()));
    row!("uat outcome", c, c.phases[0].uat = Observation::Absent);
    row!(
        "uat reason",
        c,
        c.phases[0].uat =
            Observation::Present(b"### 1. Check\nstatus: skipped\nreason: never".to_vec())
    );
    for target in ["root", "roadmap", "listing", "summary", "uat"] {
        let variants = (0..7)
            .map(|n| {
                let mut c = base.clone();
                fn variant<T: Default>(n: usize) -> Observation<T> {
                    match n {
                        0 => Observation::Absent,
                        1 => Observation::Present(T::default()),
                        _ => Observation::Failed(InputFailure {
                            path: "/ignored".into(),
                            diagnostic: Some("ignored".into()),
                            category: [
                                InputFailureCategory::PermissionDenied,
                                InputFailureCategory::NotDirectory,
                                InputFailureCategory::InvalidPath,
                                InputFailureCategory::SymlinkLoop,
                                InputFailureCategory::OtherIo,
                            ][n - 2],
                        }),
                    }
                }
                match target {
                    "root" => c.root_probe = variant(n),
                    "roadmap" => c.roadmap = variant(n),
                    "listing" => c.phases[0].plans = variant(n),
                    "summary" => c.phases[0].summary = variant(n),
                    _ => c.phases[0].uat = variant(n),
                }
                c
            })
            .collect::<Vec<_>>();
        for a in 0..variants.len() {
            for b in a + 1..variants.len() {
                rows.push((target, variants[a].clone(), variants[b].clone()));
            }
        }
    }
    rows
}

fn key_table_failures(encoder: impl Fn(&CapturedInputs) -> String) -> Vec<&'static str> {
    key_rows()
        .iter()
        .filter_map(|(name, a, b)| (encoder(a) == encoder(b)).then_some(*name))
        .collect()
}

#[test]
fn every_captured_field_and_outcome_category_changes_the_key() {
    assert!(key_table_failures(|c| input_key(c).unwrap()).is_empty());
}

#[test]
fn a_domain_encoding_or_semantics_version_change_changes_the_encoding() {
    let c = key_fixture();
    let original = encode_inputs(&c).unwrap();
    for (domain, encoding, semantics) in [
        ("other", ENCODING_VERSION, SEMANTICS_VERSION),
        (DOMAIN, ENCODING_VERSION + 1, SEMANTICS_VERSION),
        (DOMAIN, ENCODING_VERSION, SEMANTICS_VERSION + 1),
    ] {
        assert_ne!(
            crate::store::model::digest(&original),
            crate::store::model::digest(
                &memo::encode_versioned(&c, domain, encoding, semantics).unwrap()
            )
        );
    }
}

#[test]
fn plan_listing_order_does_not_change_the_key() {
    let c = key_fixture();
    let mut reversed = c.clone();
    if let Observation::Present(names) = &mut reversed.phases[0].plans {
        names.reverse();
    }
    assert_eq!(input_key(&c), input_key(&reversed));
}

#[test]
fn a_failed_root_probe_refuses_derivation() {
    for (_, a, _) in key_rows() {
        if let Observation::Failed(_) = a.root_probe {
            assert!(derive(&a).is_err());
        }
    }
}

#[test]
fn the_v1_encoding_of_a_minimal_capture_is_the_fixed_bytes_and_key() {
    let mut c = captured("## Phases\n");
    c.root = "/p".into();
    let expected = "0000000000000011636164656e63652e6c6966656379636c650000000000000001000000000000000200000000000000022f700101000000000000000a2323205068617365730a0000000000000000";
    let bytes = encode_inputs(&c).unwrap();
    assert_eq!(
        bytes.iter().map(|b| format!("{b:02x}")).collect::<String>(),
        expected
    );
    assert_eq!(
        input_key(&c).unwrap(),
        "21216b54184a118ca4bdbe093bd3a0f4f87c2662c19c0e4d3276e6a7d2b69180"
    );
}

#[test]
fn length_prefixed_fields_keep_ab_c_distinct_from_a_bc() {
    let mut a = key_fixture();
    let mut b = a.clone();
    a.phases[0].plans = Observation::Present(vec!["ab".into(), "c".into()]);
    b.phases[0].plans = Observation::Present(vec!["a".into(), "bc".into()]);
    assert_ne!(input_key(&a), input_key(&b));
}

#[test]
fn declaration_order_changes_the_key() {
    let a = key_fixture();
    let mut b = a.clone();
    b.declarations
        .as_mut()
        .unwrap()
        .as_mut()
        .unwrap()
        .phases
        .reverse();
    assert_ne!(input_key(&a), input_key(&b));
}

fn memo_fixture() -> (String, Lifecycle, serde_json::Value) {
    let c = key_fixture();
    let answer = derive(&c).unwrap();
    let key = input_key(&c).unwrap();
    let raw = serde_json::to_value(LifecycleMemo::fresh(key.clone(), answer.clone())).unwrap();
    (key, answer, raw)
}
fn memo_corruptions() -> Vec<(String, serde_json::Value)> {
    use serde_json::json;
    let (_, _, raw) = memo_fixture();
    let mut rows = Vec::new();
    for (pointer, field, value) in [
        ("/cycle", "cycle", json!("closed")),
        ("/current", "current", json!(null)),
        ("/total", "total", json!(3)),
        ("/phases/1/id", "phases[1].id", json!(3.0)),
        ("/phases/0/name", "phases[0].name", json!("Changed")),
        (
            "/phases/0/plans",
            "phases[0].plans",
            json!(["PLAN.md", "PLAN-1.md"]),
        ),
        ("/phases/0/status", "phases[0].status", json!("executed")),
        ("/phases/0/uat", "phases[0].uat", json!(null)),
        (
            "/phases/1/uat",
            "phases[1].uat",
            json!({"pass":0,"fail":0,"pending":0,"skipped":0,"blocked":0}),
        ),
    ] {
        let mut changed = raw.clone();
        *changed["answer"].pointer_mut(pointer).unwrap() = value;
        rows.push((field.into(), changed));
    }
    for counter in ["pass", "fail", "pending", "skipped", "blocked"] {
        let mut changed = raw.clone();
        changed["answer"]["phases"][0]["uat"][counter] = json!(9);
        rows.push((format!("phases[0].uat.{counter}"), changed));
    }
    let mut changed = raw;
    changed["answer"]["phases"]
        .as_array_mut()
        .unwrap()
        .reverse();
    rows.push(("phases[0].id".into(), changed));
    rows
}

#[test]
fn an_absent_memo_misses_and_an_identical_one_hits() {
    let (key, fresh, raw) = memo_fixture();
    assert_eq!(check_memo(None, &key, &fresh), Ok(MemoDisposition::Miss));
    assert_eq!(
        check_memo(Some(&raw), &key, &fresh),
        Ok(MemoDisposition::Hit)
    );
}

#[test]
fn a_differing_answer_field_conflicts_naming_the_field_and_both_hashes() {
    let (key, fresh, _) = memo_fixture();
    for (field, raw) in memo_corruptions() {
        assert!(
            matches!(check_memo(Some(&raw), &key, &fresh), Err(DerivationError::DerivationConflict { requested_hash, stored_hash, fields }) if requested_hash == key && stored_hash.as_deref() == Some(&key) && fields.contains(&field)),
            "{field}"
        );
    }
}

#[test]
fn a_changed_version_or_input_hash_misses() {
    let (key, fresh, raw) = memo_fixture();
    for name in ["encoding_version", "semantics_version", "input_hash"] {
        let mut changed = raw.clone();
        changed[name] = match name {
            "input_hash" => serde_json::json!("a".repeat(64)),
            "encoding_version" => serde_json::json!(ENCODING_VERSION + 1),
            _ => serde_json::json!(SEMANTICS_VERSION + 1),
        };
        assert_eq!(
            check_memo(Some(&changed), &key, &fresh),
            Ok(MemoDisposition::Miss)
        );
    }
}

#[test]
fn a_malformed_or_missing_envelope_field_conflicts_naming_that_field() {
    use serde_json::json;
    let (key, fresh, raw) = memo_fixture();
    let mut rows = vec![
        ("encoding_version", serde_json::Value::Null),
        ("encoding_version", json!({})),
    ];
    for name in [
        "encoding_version",
        "semantics_version",
        "input_hash",
        "answer",
    ] {
        let mut changed = raw.clone();
        changed.as_object_mut().unwrap().remove(name);
        rows.push((name, changed));
        let mut changed = raw.clone();
        changed[name] = json!(false);
        rows.push((name, changed));
    }
    for (field, raw) in rows {
        assert!(
            matches!(check_memo(Some(&raw), &key, &fresh), Err(DerivationError::DerivationConflict { fields, .. }) if fields == [field])
        );
    }
}

#[test]
fn a_malformed_answer_field_conflicts_naming_its_path() {
    use serde_json::json;
    let (_, fresh, raw) = memo_fixture();
    for (field, value) in [
        ("status", json!("paused")),
        ("id", json!(null)),
        ("uat", json!({})),
        ("plans", json!(false)),
    ] {
        let mut changed = raw.clone();
        changed["answer"]["phases"][0][field] = value;
        let error = check_memo(Some(&changed), &"b".repeat(64), &fresh).unwrap_err();
        assert_eq!(error.code(), "derivation-conflict");
        assert!(error.to_string().contains(&format!("phases[0].{field}")));
    }
}

#[test]
fn an_older_semantics_version_misses_unread_while_a_malformed_hash_still_refuses() {
    use serde_json::json;
    let (key, fresh, raw) = memo_fixture();
    let mut old = raw.clone();
    old["semantics_version"] = json!(SEMANTICS_VERSION + 1);
    old["answer"] = json!({"opaque":"older schema"});
    assert_eq!(
        check_memo(Some(&old), &key, &fresh),
        Ok(MemoDisposition::Miss)
    );
    old["input_hash"] = json!("broken");
    assert!(check_memo(Some(&old), &key, &fresh).is_err());
}

#[test]
fn a_malformed_derivation_namespace_refuses_and_an_absent_one_reads_as_none() {
    use serde_json::json;
    let (key, _, _) = memo_fixture();
    for data in [
        json!({"derivation":null}),
        json!({"derivation":[]}),
        json!([]),
    ] {
        assert_eq!(
            memo_from_data(&data, &key).unwrap_err().code(),
            "derivation-conflict"
        );
    }
    assert!(memo_from_data(&json!({}), &key).unwrap().is_none());
}

#[test]
fn a_phase_number_beyond_f64_range_survives_json_and_its_memo_hits() {
    // Overflow is still a numeric identity in the domain and must survive JSON.
    let c = captured(&format!(
        "## Phases\n- [ ] **Phase {}: Overflow**",
        "9".repeat(400)
    ));
    let fresh = derive(&c).unwrap();
    round_trip(&fresh);
    let key = input_key(&c).unwrap();
    let memo = serde_json::to_value(LifecycleMemo::fresh(key.clone(), fresh.clone())).unwrap();
    assert_eq!(
        check_memo(Some(&memo), &key, &fresh),
        Ok(MemoDisposition::Hit)
    );
}

#[test]
fn each_io_error_is_the_failure_category_it_names_and_keeps_its_path() {
    use std::io::{Error, ErrorKind};
    let path = std::path::Path::new("/planning/phases/1/UAT.md");
    for (error, category) in [
        (Error::from_raw_os_error(libc::ELOOP), InputFailureCategory::SymlinkLoop),
        (Error::from_raw_os_error(libc::ENAMETOOLONG), InputFailureCategory::InvalidPath),
        (Error::from(ErrorKind::InvalidInput), InputFailureCategory::InvalidPath),
        (Error::from(ErrorKind::PermissionDenied), InputFailureCategory::PermissionDenied),
        (Error::from(ErrorKind::NotADirectory), InputFailureCategory::NotDirectory),
        (Error::other("artifact is not a regular readable file"), InputFailureCategory::OtherIo),
    ] {
        let failure = capture::failure(path, error);
        assert_eq!((failure.path.as_path(), failure.category), (path, category));
    }
}

#[test]
fn not_found_is_absent_and_no_other_error_is_ever_taken_for_absence() {
    use std::io::{Error, ErrorKind};
    let path = std::path::Path::new("/planning/phases/1/SUMMARY.md");
    assert_eq!(capture::observation(path, Ok(())), Observation::Present(()));
    assert_eq!(capture::observation::<()>(path, Err(Error::from(ErrorKind::NotFound))), Observation::Absent);
    assert!(matches!(
        capture::observation::<()>(path, Err(Error::from(ErrorKind::PermissionDenied))),
        Observation::Failed(failure) if failure.category == InputFailureCategory::PermissionDenied
    ));
}

#[test]
fn only_plan_md_and_plan_dash_ascii_digits_md_are_plans() {
    for name in ["PLAN.md", "PLAN-1.md", "PLAN-02.md", "PLAN-123.md"] {
        assert!(capture::admitted(name), "{name}");
    }
    for name in ["plan.md", "PLAN-.md", "PLAN-1a.md", "PLAN-١.md", "PLAN-1.md.bak", "PLAN-1.MD", "PLAN-1", "SUMMARY.md"] {
        assert!(!capture::admitted(name), "{name}");
    }
}

#[test]
fn a_root_is_normalized_from_its_text_dropping_dot_and_popping_dot_dot() {
    use std::path::{Path, PathBuf};
    for (selected, normalized) in [
        ("/project/./.planning", "/project/.planning"),
        ("/project/src/../.planning", "/project/.planning"),
        ("/project/.planning/phases/..", "/project/.planning"),
        ("/..", "/"),
    ] {
        assert_eq!(capture::normalize(Path::new(selected)), PathBuf::from(normalized), "{selected}");
    }
}

#[test]
fn the_first_disagreeing_entry_is_refused_even_when_two_entries_share_an_address() {
    let capture = captured("## Phases\n- [ ] **Phase 3.0: First**\n- [x] **Phase 3: Second**");
    let answer = derive(&capture).unwrap();
    let cursor = normalize_imported_cursor(&serde_json::Value::Null).unwrap();
    let result = check_consistency(validate_inputs(&capture).unwrap(), &answer, &cursor);
    assert!(conflict_only(&result, "ROADMAP.md:3 entry 1", "complete", "true", "false"), "{result:?}");
}

#[test]
fn a_disagreeing_cursor_names_its_source_the_field_and_both_values() {
    let live = captured("## Phases\n- [ ] **Phase 3: Three**");
    let closed = captured("## Phases\nNo active phases.");
    for (capture, word, phase, total, field, declared, derived) in [
        (&live, "planned", 3, 4, "status", "planned", "unplanned"),
        (&live, "unplanned", 2, 4, "phase", "2", "3"),
        (&closed, "complete", 99, 4, "total", "4", "0"),
    ] {
        let result = agreement(capture, word, phase, total);
        assert!(conflict_only(&result, "data.cursor", field, declared, derived), "{field}: {result:?}");
    }
}

#[test]
fn an_intake_observed_again_must_equal_the_one_the_answer_was_made_with() {
    let observed = IntakeObservation::from_data(&unadopted());
    assert_eq!(recheck_intake(&observed, &observed.clone()), Ok(()));
    let changed = IntakeObservation::from_data(&serde_json::json!({"cursor": imported_cursor("planned", 3, 4)}));
    assert_eq!(recheck_intake(&observed, &changed), Err(DerivationError::InputsChanged));
}

/// A planning root holding one unticked phase 3, for the intake queries.
fn one_phase_root() -> tempfile::TempDir {
    let temp = tempfile::tempdir().unwrap();
    std::fs::write(temp.path().join("ROADMAP.md"), "## Phases\n- [ ] **Phase 3: Three**").unwrap();
    temp
}

#[test]
fn a_cursor_other_than_the_one_observed_cannot_be_prepared_with_that_intake() {
    let temp = one_phase_root();
    let selected = select_intake(&unadopted()).unwrap();
    let other = IntakeObservation::from_data(&serde_json::json!({"cursor": imported_cursor("unplanned", 3, 4)}));
    assert_eq!(
        prepare_query_with_intake(temp.path(), &mut ArtifactFiles, &selected.cursor, &other).map(|_| ()),
        Err(DerivationError::InputsChanged)
    );
}

#[test]
fn an_answer_made_with_intake_is_not_rechecked_without_observing_the_intake_again() {
    let temp = one_phase_root();
    let selected = select_intake(&unadopted()).unwrap();
    let prepared =
        prepare_query_with_intake(temp.path(), &mut ArtifactFiles, &selected.cursor, &selected.observation).unwrap();
    assert_eq!(recheck_query(&prepared, &mut ArtifactFiles).map(|_| ()), Err(DerivationError::InputsChanged));
}

#[test]
fn an_intake_that_changed_before_the_recheck_refuses_the_query() {
    let temp = one_phase_root();
    let selected = select_intake(&unadopted()).unwrap();
    let changed = IntakeObservation::from_data(&serde_json::json!({"cursor": imported_cursor("unplanned", 3, 4)}));
    assert_eq!(
        query_with_intake(temp.path(), &mut ArtifactFiles, &selected.cursor, &selected.observation, &mut FixedIntake(changed))
            .map(|_| ()),
        Err(DerivationError::InputsChanged)
    );
}

#[test]
fn a_retired_cursor_no_longer_holds_back_a_lifecycle_that_moved_past_it() {
    let mut capture = captured("## Phases\n- [x] **Phase 3: Three**\n- [ ] **Phase 4: Four**");
    complete(&mut capture.phases[0]);
    let answer = derive(&capture).unwrap();
    assert_eq!(answer.current.map(PhaseId::address), Some("4".to_string()));
    let retired = select_intake(&adopted()).unwrap().cursor;
    assert!(matches!(retired, CompatibilityCursor::Unavailable(_)));
    assert_eq!(check_consistency(validate_inputs(&capture).unwrap(), &answer, &retired), Ok(()));
    let unretired = normalize_imported_cursor(&imported_cursor("unplanned", 3, 4)).unwrap();
    assert!(conflict_only(
        &check_consistency(validate_inputs(&capture).unwrap(), &answer, &unretired),
        "data.cursor",
        "phase",
        "3",
        "4"
    ));
}
