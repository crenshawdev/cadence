use cadence::{derivation::*, next_action::observations::*};
use std::{fs, os::unix::fs::symlink, path::Path};

fn lifecycle(root: &Path, closed: bool) -> Lifecycle {
    fs::write(
        root.join("ROADMAP.md"),
        if closed {
            "## Phases\n"
        } else {
            "## Phases\n- [ ] **Phase 1: One**\n"
        },
    )
    .unwrap();
    derive(&capture_inputs(root, &mut ArtifactFiles).unwrap()).unwrap()
}

fn member(root: &Path, home: &str, name: &str, value: serde_json::Value) {
    fs::create_dir_all(root.join(home)).unwrap();
    fs::write(
        root.join(home).join(name),
        serde_json::to_vec(&value).unwrap(),
    )
    .unwrap();
}
fn valid(phase: &str) -> serde_json::Value {
    serde_json::json!({"phase":phase,"trigger":"diff-plan","discriminator":"1","round":1,"findings":[{}]})
}

fn phase_one() -> PhaseId {
    parse_roadmap("## Phases\n- [ ] **Phase 1: One**").unwrap().phases[0].id
}

fn report(bytes: Observation<Vec<u8>>) -> Report {
    Report { path: "phases/1/reports/plan-1.md".into(), bytes }
}

#[test]
fn each_plan_file_name_maps_to_its_report_path() {
    for (plan, path) in [
        ("PLAN.md", "phases/1/reports/plan-1.md"),
        ("PLAN-02.md", "phases/1/reports/plan-2.md"),
        ("PLAN-3.md", "phases/1/reports/plan-3.md"),
    ] {
        assert_eq!(report_path(phase_one(), plan), Path::new(path), "{plan}");
    }
}

#[test]
fn capture_reads_a_missing_report_as_absent_and_an_unreadable_one_as_failed() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path();
    let phase = root.join("phases/1");
    fs::create_dir_all(phase.join("reports")).unwrap();
    for plan in ["PLAN.md", "PLAN-02.md", "PLAN-3.md"] {
        fs::write(phase.join(plan), "").unwrap();
    }
    let life = lifecycle(root, false);
    fs::write(phase.join("reports/plan-2.md"), "PLAN COMPLETE").unwrap();
    fs::create_dir(phase.join("reports/plan-3.md")).unwrap();
    let observed = capture(root, &life).unwrap();
    let reports = &observed.reports[0].1;
    let bytes = |path: &str| &reports.iter().find(|r| r.path == Path::new(path)).unwrap().bytes;
    assert!(matches!(bytes("phases/1/reports/plan-1.md"), Observation::Absent), "{reports:?}");
    assert!(matches!(bytes("phases/1/reports/plan-3.md"), Observation::Failed(_)), "{reports:?}");
}

#[test]
fn a_missing_or_unreadable_report_is_not_complete() {
    let failure = InputFailure {
        path: "phases/1/reports/plan-1.md".into(),
        diagnostic: Some("is a directory".into()),
        category: InputFailureCategory::OtherIo,
    };
    assert!(!report(Observation::Absent).complete());
    assert!(!report(Observation::Failed(failure)).complete());
}

#[test]
fn a_report_is_complete_only_when_its_trimmed_first_line_is_plan_complete() {
    for body in ["PLAN COMPLETE", "\u{feff} PLAN COMPLETE \r\nother"] {
        assert!(report(Observation::Present(body.into())).complete(), "{body:?}");
    }
    for body in [
        "PLAN PARTIAL\nPLAN COMPLETE",
        "\nPLAN COMPLETE",
        "PLAN COMPLETE extra",
        "PLAN CHECKPOINT: blocked",
    ] {
        assert!(!report(Observation::Present(body.into())).complete(), "{body:?}");
    }
}

#[test]
fn a_phase_is_outstanding_while_any_plan_report_is_incomplete() {
    let observed = |bodies: &[&str]| Observations {
        reports: vec![(
            phase_one(),
            bodies.iter().map(|body| report(Observation::Present(body.as_bytes().to_vec()))).collect(),
        )],
        ..Observations::default()
    };
    assert!(observed(&["PLAN COMPLETE", "PLAN PARTIAL"]).outstanding(phase_one()));
    assert!(!observed(&["PLAN COMPLETE", "PLAN COMPLETE"]).outstanding(phase_one()));
}

#[test]
fn the_queue_reads_deferred_members_from_both_homes() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path();
    for home in ["phases/1", "deferred/1"] {
        member(root, home, "DEFERRED-diff-plan-1.json", valid("1"));
    }
    let life = lifecycle(root, true);
    assert_eq!(capture(root, &life).unwrap().queue.members.len(), 2);
}

#[test]
fn a_regular_adjudication_sibling_suppresses_its_member_and_a_symlinked_one_does_not() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path();
    let name = "DEFERRED-diff-plan-1.json";
    for home in ["phases/1", "deferred/1"] {
        member(root, home, name, valid("1"));
    }
    let life = lifecycle(root, true);
    fs::write(
        root.join("phases/1/ADJUDICATION-diff-plan-1.json"),
        "malformed",
    )
    .unwrap();
    symlink(
        "DEFERRED-diff-plan-1.json",
        root.join("deferred/1/ADJUDICATION-diff-plan-1.json"),
    )
    .unwrap();
    let q = capture(root, &life).unwrap().queue;
    assert_eq!(q.members.len(), 1);
    assert!(q.members[0].path.starts_with("deferred"));
}

fn queue_member(findings: usize) -> QueueMember {
    QueueMember {
        path: "deferred/1/DEFERRED-diff-plan-1.json".into(),
        phase: "1".into(),
        trigger: "diff-plan".into(),
        discriminator: "1".into(),
        round: 1,
        findings,
    }
}

#[test]
fn a_queue_needs_triage_when_a_member_has_findings_or_something_is_unreadable() {
    let with = |members, unreadable| Queue { members, unreadable };
    assert!(with(vec![queue_member(1)], vec![]).needs_triage());
    assert!(with(vec![], vec!["deferred/link".into()]).needs_triage());
    assert!(!with(vec![queue_member(0)], vec![]).needs_triage());
}

#[test]
fn a_member_whose_phase_round_findings_or_name_does_not_match_is_unreadable() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path();
    let name = "DEFERRED-diff-plan-1.json";
    for (i, mut value) in [valid("wrong"), valid("2"), valid("3"), valid("4")]
        .into_iter()
        .enumerate()
    {
        match i {
            1 => value["round"] = 0.into(),
            2 => value["findings"] = false.into(),
            3 => value["trigger"] = "other".into(),
            _ => {}
        }
        member(root, &format!("phases/{}", i + 1), name, value);
    }
    let life = lifecycle(root, true);
    let q = capture(root, &life).unwrap().queue;
    assert!(q.members.is_empty());
    assert_eq!(q.unreadable.len(), 4);
}

#[test]
fn a_symlinked_phase_directory_in_a_home_is_unreadable() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path();
    member(root, "phases/1", "DEFERRED-diff-plan-1.json", valid("1"));
    fs::create_dir_all(root.join("deferred")).unwrap();
    symlink("../phases/1", root.join("deferred/1")).unwrap();
    let life = lifecycle(root, true);
    let q = capture(root, &life).unwrap().queue;
    assert_eq!(q.unreadable, [Path::new("deferred/1")]);
}

#[test]
fn a_symlinked_member_file_is_unreadable() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path();
    let name = "DEFERRED-diff-plan-1.json";
    member(root, "phases/1", name, valid("1"));
    fs::create_dir_all(root.join("deferred/1")).unwrap();
    symlink("../../phases/1/DEFERRED-diff-plan-1.json", root.join("deferred/1").join(name)).unwrap();
    let life = lifecycle(root, true);
    let q = capture(root, &life).unwrap().queue;
    assert_eq!(q.unreadable, [Path::new("deferred/1").join(name)]);
}

#[test]
fn a_plain_file_directly_in_a_home_is_ignored() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path();
    fs::create_dir_all(root.join("deferred")).unwrap();
    fs::write(root.join("deferred/file"), "unrelated").unwrap();
    let life = lifecycle(root, true);
    let q = capture(root, &life).unwrap().queue;
    assert_eq!((q.members.len(), q.unreadable.len()), (0, 0));
}

#[test]
fn absent_homes_are_empty_unreadable_homes_are_explicit() {
    use std::io::ErrorKind;
    assert_eq!(unlisted_home("phases", ErrorKind::NotFound), None);
    for error in [ErrorKind::NotADirectory, ErrorKind::PermissionDenied, ErrorKind::Other] {
        assert_eq!(unlisted_home("deferred", error), Some("deferred".into()), "{error:?}");
    }
    let unreadable = Queue { members: vec![], unreadable: vec!["phases".into(), "deferred".into()] };
    assert!(unreadable.needs_triage());
    assert!(!Queue::default().needs_triage());
}

#[test]
fn closed_residue_uses_legal_names_and_live_directories_are_not_residue() {
    let names = || {
        ["1", "1.10", "1.1", "2", "02", "0", "1.0", "1.2.3", "archive"]
            .map(String::from)
    };
    assert_eq!(residue(Cycle::Closed, names()), ["1", "1.1", "1.10", "2"]);
    assert!(residue(Cycle::Live, names()).is_empty());
}
