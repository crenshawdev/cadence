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
    expected: LifecycleStatus,
}

fn truth_rows() -> Vec<TruthRow> {
    use LifecycleStatus::*;
    [
        ("no artifacts", false, false, None, Unplanned),
        ("PLAN only", true, false, None, Planned),
        ("SUMMARY only", false, true, None, Executed),
        ("PLAN and SUMMARY", true, true, None, Executed),
        (
            "pass without PLAN",
            false,
            true,
            Some("### 1. Check\nstatus: pass"),
            Complete,
        ),
        (
            "pass with PLAN",
            true,
            true,
            Some("### 1. Check\nstatus: pass"),
            Complete,
        ),
        (
            "UAT without SUMMARY",
            false,
            false,
            Some("### 1. Check\nstatus: pass"),
            Unplanned,
        ),
        (
            "PLAN UAT without SUMMARY",
            true,
            false,
            Some("### 1. Check\nstatus: pass"),
            Planned,
        ),
        ("empty UAT", false, true, Some(""), Executed),
        (
            "malformed UAT",
            false,
            true,
            Some("not a checklist"),
            Executed,
        ),
        (
            "frontmatter complete",
            false,
            true,
            Some("---\nstatus: complete\n---"),
            Executed,
        ),
        (
            "manual numbered prose",
            false,
            true,
            Some("### Manual notes\n1. Check\nstatus: pass"),
            Executed,
        ),
        (
            "unknown status",
            false,
            true,
            Some("### 1. Check\nstatus: constructor"),
            Executed,
        ),
        (
            "missing status",
            false,
            true,
            Some("### 1. Check"),
            Executed,
        ),
        (
            "fail",
            false,
            true,
            Some("### 1. Check\nstatus: fail"),
            Executed,
        ),
        (
            "pending",
            false,
            true,
            Some("### 1. Check\nstatus: pending"),
            Executed,
        ),
        (
            "blocked",
            false,
            true,
            Some("### 1. Check\nstatus: blocked"),
            Executed,
        ),
        (
            "skip reason",
            false,
            true,
            Some("### 1. Check\nstatus: skipped\nreason: deferred"),
            Complete,
        ),
        (
            "skip no reason",
            false,
            true,
            Some("### 1. Check\nstatus: skipped"),
            Executed,
        ),
        (
            "skip empty reason",
            false,
            true,
            Some("### 1. Check\nstatus: skipped\nreason:"),
            Executed,
        ),
        (
            "skip space reason",
            false,
            true,
            Some("### 1. Check\nstatus: skipped\nreason:   "),
            Complete,
        ),
        (
            "pass and reasoned skip",
            false,
            true,
            Some("### 1. Check\nstatus: pass\n### 2. Skip\nstatus: skipped\nreason: later"),
            Complete,
        ),
    ]
    .into_iter()
    .map(|(label, plans, summary, uat, expected)| TruthRow {
        label,
        plans,
        summary,
        uat,
        expected,
    })
    .collect()
}

fn table_failures(
    derive_fn: impl Fn(&CapturedInputs) -> Result<Lifecycle, DerivationError>,
) -> Vec<&'static str> {
    truth_rows()
        .into_iter()
        .filter_map(|row| {
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
            let answer = derive_fn(&capture).unwrap();
            assert_eq!(answer.phases[0].plans.len(), usize::from(row.plans));
            assert_eq!(
                answer.phases[0].uat.is_some(),
                row.uat.is_some_and(|s| !s.is_empty()),
                "{}",
                row.label
            );
            if let Some(text) = row.uat.filter(|text| !text.is_empty()) {
                assert_eq!(answer.phases[0].uat.as_ref(), Some(&parse_uat(text).counts));
            }
            (answer.phases[0].status != row.expected).then_some(row.label)
        })
        .collect()
}

#[test]
fn ac1_production_truth_table_and_plan_prerequisite_mutant() {
    assert!(table_failures(derive).is_empty());
    let rejected = table_failures(|capture| {
        let mut answer = derive(capture)?;
        for phase in &mut answer.phases {
            if phase.status == LifecycleStatus::Complete && phase.plans.is_empty() {
                phase.status = LifecycleStatus::Executed;
            }
        }
        Ok(answer)
    });
    assert!(rejected.contains(&"pass without PLAN"));
    assert!(!rejected.contains(&"pass with PLAN"));
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
fn ac1_empty_and_nonregular_plan_summary_use_existence() {
    for directories in [false, true] {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path();
        std::fs::write(root.join("ROADMAP.md"), "## Phases\n- [ ] **Phase 1: One**").unwrap();
        let phase = root.join("phases/1");
        std::fs::create_dir_all(&phase).unwrap();
        let make = |name| {
            if directories {
                std::fs::create_dir(phase.join(name)).unwrap();
            } else {
                std::fs::write(phase.join(name), []).unwrap();
            }
        };
        make("PLAN.md");
        let answer = derive(&capture_inputs(root, &mut ArtifactFiles).unwrap()).unwrap();
        assert_eq!(answer.phases[0].status, LifecycleStatus::Planned);
        make("SUMMARY.md");
        assert_eq!(
            derive(&capture_inputs(root, &mut ArtifactFiles).unwrap())
                .unwrap()
                .phases[0]
                .status,
            LifecycleStatus::Executed
        );
        std::fs::write(phase.join("UAT.md"), "### 1. Pass\nstatus: pass").unwrap();
        assert_eq!(
            derive(&capture_inputs(root, &mut ArtifactFiles).unwrap())
                .unwrap()
                .phases[0]
                .status,
            LifecycleStatus::Complete
        );
    }
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
fn ac2_current_is_numeric_and_invariant_under_unequal_permutation() {
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
        assert_eq!(answer.current, Some(PhaseId(5.0)));
        assert_eq!(answer.total, 3);
        assert_eq!(
            answer
                .phases
                .iter()
                .map(|p| p.id.number())
                .collect::<Vec<_>>(),
            [2.0, 5.0, 8.0]
        );
        capture.phases[0].uat = Observation::Present(b"### 1. Check\nstatus: pending".to_vec());
        assert_eq!(derive(&capture).unwrap().current, Some(PhaseId(2.0)));
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
        ["One", "First tie", "Second tie", "Two"]
    );
    assert_eq!(answer.phases[1].plans, answer.phases[2].plans);
    assert_eq!(answer.phases[1].status, LifecycleStatus::Planned);
    assert_eq!(answer.phases[2].status, LifecycleStatus::Planned);
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
fn ac2_checkbox_cannot_complete_and_invalid_lists_refuse() {
    let unchecked = captured("## Phases\n- [ ] **Phase 1: One**");
    let checked = captured("## Phases\n- [x] **Phase 1: One**");
    assert_eq!(derive(&unchecked).unwrap(), derive(&checked).unwrap());
    assert_eq!(
        derive(&checked).unwrap().phases[0].status,
        LifecycleStatus::Unplanned
    );
    for text in ["# No section", "## Phases\n- Phase 1: Bad"] {
        let mut capture = unchecked.clone();
        capture.roadmap = Observation::Present(text.as_bytes().into());
        capture.declarations = Some(parse_roadmap(text));
        assert_eq!(derive(&capture).unwrap_err().code(), "invalid-roadmap");
    }
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
fn parsers_roadmap_normalization_bounds_and_classification() {
    for text in [
        "## Phases\n- [ ] **Phase 1: One**",
        "\u{feff}## Phases\r\n- [ ] **Phase 1: One**\r\n",
    ] {
        let parsed = parse_roadmap(text).unwrap();
        assert_eq!(parsed.phases.len(), 1);
        assert_eq!(parsed.phases[0].source_line, 2);
    }
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
        ["First", "Real"]
    );
    assert!(parsed.phases[1].checked);
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
fn parsers_numeric_ties_keep_textual_order_and_number_addresses() {
    let parsed = parse_roadmap("## Phases\n- [ ] **Phase 2: Two**\n- [ ] **Phase 1.10: Decimal A**\n- [ ] **Phase 01: Alias A**\n- [ ] **Phase 1.1: Decimal B**\n- [ ] **Phase 1.0: Alias B**\n- [ ] **Phase 1: Alias C**").unwrap();
    assert_eq!(
        parsed.phases.iter().map(|p| p.ordinal).collect::<Vec<_>>(),
        [2, 4, 5, 1, 3, 0]
    );
    assert_eq!(
        parsed
            .phases
            .iter()
            .map(|p| p.id.address())
            .collect::<Vec<_>>(),
        ["1", "1", "1", "1.1", "1.1", "2"]
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
fn parsers_uat_items_fields_counts_and_raw_fence_behavior() {
    assert_eq!(parse_uat("pre\r### 1. Item\nstatus: pass").counts.pass, 1);
    assert_eq!(
        parse_uat("pre\u{2028}### 1. Item\nstatus: pass")
            .counts
            .pass,
        1
    );
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
    let parsed = parse_uat(
        "### 1. Item\nstatus: pending\n````\n## Fenced section\nstatus: pass\n```\n```` info\nreason: inside\n````\n## End\nstatus: fail\n```\n### 2. Fenced heading still splits\nstatus: blocked\n```",
    );
    assert_eq!(parsed.items.len(), 2);
    assert_eq!(parsed.items[0].status.as_deref(), Some("pass"));
    assert_eq!(parsed.items[0].reason.as_deref(), Some("inside"));
    assert_eq!(parsed.items[1].status.as_deref(), Some("blocked"));
    assert_eq!(parse_uat("\u{feff}### 1. BOM\nstatus: pass").items.len(), 0);
    assert_eq!(parse_uat("### 1. CRLF\r\nstatus: pass\r\n").counts.pass, 1);
    assert_eq!(parse_uat("### 1. Lone CR\rstatus: pass").items.len(), 0);
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

#[test]
fn contract_absent_empty_failed_are_distinct() {
    let absent = Observation::<Vec<u8>>::Absent;
    let empty = Observation::Present(vec![]);
    let failed = Observation::Failed(InputFailure {
        path: "/planning/UAT.md".into(),
        category: InputFailureCategory::PermissionDenied,
        diagnostic: Some("denied by fixture".into()),
    });
    assert_ne!(absent, empty);
    assert_ne!(empty, failed);
    assert_ne!(absent, failed);
    for value in [absent, empty, failed] {
        round_trip(&value);
    }
}
