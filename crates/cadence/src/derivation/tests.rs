use super::*;

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
