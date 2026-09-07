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

#[test]
fn exact_reports_first_line_and_unreadability() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path();
    let phase = root.join("phases/1");
    fs::create_dir_all(phase.join("reports")).unwrap();
    for plan in ["PLAN.md", "PLAN-02.md", "PLAN-3.md"] {
        fs::write(phase.join(plan), "").unwrap();
    }
    let life = lifecycle(root, false);
    fs::write(phase.join("reports/plan-1.1.md"), "PLAN COMPLETE").unwrap();
    fs::write(
        phase.join("reports/plan-2.md"),
        "\u{feff} PLAN COMPLETE \r\nother",
    )
    .unwrap();
    fs::create_dir(phase.join("reports/plan-3.md")).unwrap();
    let observed = capture(root, &life).unwrap();
    let reports = &observed.reports[0].1;
    assert!(
        reports
            .iter()
            .any(|r| matches!(r.bytes, Observation::Absent))
    );
    assert!(
        reports
            .iter()
            .any(|r| matches!(r.bytes, Observation::Failed(_)))
    );
    assert_eq!(reports.iter().filter(|r| r.complete()).count(), 1);
    assert!(observed.outstanding(life.phases[0].id));
    for body in [
        "PLAN PARTIAL\nPLAN COMPLETE",
        "\nPLAN COMPLETE",
        "PLAN COMPLETE extra",
        "PLAN CHECKPOINT: blocked",
    ] {
        fs::write(phase.join("reports/plan-1.md"), body).unwrap();
        assert!(
            !capture(root, &life).unwrap().reports[0]
                .1
                .iter()
                .find(|r| r.path.ends_with("plan-1.md"))
                .unwrap()
                .complete()
        );
    }
}

#[test]
fn both_queue_homes_and_regular_sibling_suppression() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path();
    let name = "DEFERRED-diff-plan-1.json";
    for home in ["phases/1", "deferred/1"] {
        member(root, home, name, valid("1"));
    }
    let life = lifecycle(root, true);
    assert_eq!(capture(root, &life).unwrap().queue.members.len(), 2);
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
    assert!(q.needs_triage());
}

#[test]
fn malformed_members_and_directory_member_symlinks_remain_unreadable() {
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
    fs::create_dir_all(root.join("deferred/5")).unwrap();
    symlink("../../phases/1", root.join("deferred/link")).unwrap();
    symlink(
        "../../phases/1/DEFERRED-diff-plan-1.json",
        root.join("deferred/5").join(name),
    )
    .unwrap();
    fs::write(root.join("deferred/file"), "unrelated").unwrap();
    let life = lifecycle(root, true);
    let q = capture(root, &life).unwrap().queue;
    assert!(q.members.is_empty());
    assert_eq!(q.unreadable.len(), 6);
    assert!(q.needs_triage());
}

#[test]
fn absent_homes_are_empty_unreadable_homes_are_explicit() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path();
    let life = lifecycle(root, true);
    assert_eq!(capture(root, &life).unwrap().queue, Queue::default());
    fs::write(root.join("phases"), "not a directory").unwrap();
    fs::write(root.join("deferred"), "not a directory").unwrap();
    let q = capture(root, &life).unwrap().queue;
    assert_eq!(q.unreadable.len(), 2);
    assert!(q.members.is_empty());
    assert!(q.needs_triage());
}

#[test]
fn closed_residue_uses_legal_names_and_live_directories_are_not_residue() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path();
    for name in [
        "1", "1.10", "1.1", "2", "02", "0", "1.0", "1.2.3", "archive",
    ] {
        fs::create_dir_all(root.join("phases").join(name)).unwrap();
    }
    let closed = lifecycle(root, true);
    assert_eq!(
        capture(root, &closed).unwrap().residue,
        ["1", "1.1", "1.10", "2"]
    );
    let live = lifecycle(root, false);
    assert!(capture(root, &live).unwrap().residue.is_empty());
}
