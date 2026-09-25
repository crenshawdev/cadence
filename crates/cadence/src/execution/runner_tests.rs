//! What the runner reads out of Git's answers, and what it concludes.
//!
//! `status` calls Git and `parse_status` reads what it said; `uncertainty`
//! gathers and `uncertain` concludes. These checks take the second of each
//! pair, so every one of them is bytes in, values out. What Git would print is
//! not a rule of ours and is not asserted here; the shapes below are the
//! porcelain v1 NUL format Git documents.
use super::history::{Projection, TaskView};
use super::receipts_fixtures::{GREEN, RED, check, task};
use super::runner::{parse_status, uncertain};
use serde_json::json;

fn view(completed: bool, attempt: Option<&str>) -> TaskView {
    TaskView {
        task: task(),
        checks: vec![check("check/A")],
        verify: Vec::new(),
        state: Projection {
            version: 0,
            attempt: attempt.map(str::to_owned),
            completed,
            progress: Vec::new(),
            unknown_runs: Vec::new(),
        },
    }
}

fn entries(output: &[u8]) -> Vec<(String, String)> {
    parse_status(output).expect("a readable status")
}

#[test]
fn an_empty_status_reports_no_differences() {
    assert!(entries(b"").is_empty());
}

#[test]
fn each_code_and_path_is_read_as_one_difference() {
    assert_eq!(
        entries(b" M src/delivery.rs\0?? notes.md\0A  src/added.rs\0"),
        [
            (" M ".to_owned(), "src/delivery.rs".to_owned()),
            ("?? ".to_owned(), "notes.md".to_owned()),
            ("A  ".to_owned(), "src/added.rs".to_owned()),
        ]
    );
}

// A rename or a copy carries its origin path in the next entry. Only the
// destination is a difference; the origin would otherwise read as a path that
// changed on its own.
#[test]
fn a_rename_or_copy_keeps_only_its_destination() {
    for code in ["R  ", "C  ", "RM ", "CM "] {
        let mut output = code.as_bytes().to_vec();
        output.extend_from_slice(b"src/new.rs\0src/old.rs\0 M src/other.rs\0");
        assert_eq!(
            entries(&output),
            [(code.to_owned(), "src/new.rs".to_owned()), (" M ".to_owned(), "src/other.rs".to_owned())],
            "{code}"
        );
    }
}

// D-160: a commit landing between the store's prepare and its rename leaves
// `.planning/.state.json.<pid>.<seq>.tmp` beside its target. That file is the
// binary's own and never the owner's uncommitted work.
#[test]
fn the_stores_own_staging_file_is_not_a_difference() {
    assert!(entries(b"?? .planning/.state.json.1234.7.tmp\0").is_empty());
    assert!(entries(b"?? .planning/phases/.decisions.jsonl.99.1.tmp\0").is_empty());
}

// Only an untracked staging file is skipped, and only under .planning. A
// tracked modification to the same path is a real difference.
#[test]
fn a_staging_name_elsewhere_or_tracked_is_still_a_difference() {
    assert_eq!(
        entries(b"?? src/.state.json.1234.7.tmp\0"),
        [("?? ".to_owned(), "src/.state.json.1234.7.tmp".to_owned())]
    );
    assert_eq!(
        entries(b" M .planning/.state.json.1234.7.tmp\0"),
        [(" M ".to_owned(), ".planning/.state.json.1234.7.tmp".to_owned())]
    );
}

// A name that only looks like a staging file is the owner's.
#[test]
fn a_name_that_is_not_the_stores_staging_form_is_a_difference() {
    for name in [".planning/.state.json.tmp", ".planning/.state.json.abc.7.tmp", ".planning/state.json.1.2.tmp"] {
        let output = [b"?? ", name.as_bytes(), b"\0"].concat();
        assert_eq!(entries(&output).len(), 1, "{name}");
    }
}

#[test]
fn an_entry_shorter_than_its_code_is_refused() {
    assert!(parse_status(b"M\0").is_err());
}

#[test]
fn an_entry_that_is_not_utf8_is_refused() {
    assert!(parse_status(&[b' ', b'M', b' ', 0xff, 0]).is_err());
}

// Uncertainty is what the owner has to reconcile before a redispatch: commits
// made since the last acknowledged progress, and a working tree that is not
// clean under an open attempt.
#[test]
fn no_commits_and_a_clean_tree_is_nothing_to_reconcile() {
    assert_eq!(
        uncertain(&view(false, Some("attempt")), &[], false),
        json!({"requires_reconciliation": false, "commits": []})
    );
}

#[test]
fn commits_since_the_baseline_require_reconciliation() {
    assert_eq!(
        uncertain(&view(false, Some("attempt")), &[RED.to_owned(), GREEN.to_owned()], false),
        json!({"requires_reconciliation": true, "commits": [RED, GREEN]})
    );
}

#[test]
fn a_dirty_tree_under_an_open_attempt_requires_reconciliation() {
    assert_eq!(
        uncertain(&view(false, Some("attempt")), &[], true),
        json!({"requires_reconciliation": true, "commits": [], "dirty_source": true})
    );
}

// A dirty tree is only this task's problem while the task is open. A completed
// task, or one with no attempt, is not answerable for it.
#[test]
fn a_dirty_tree_is_not_this_tasks_problem_once_it_is_closed_or_unstarted() {
    assert_eq!(
        uncertain(&view(true, Some("attempt")), &[], true),
        json!({"requires_reconciliation": false, "commits": []})
    );
    assert_eq!(
        uncertain(&view(false, None), &[], true),
        json!({"requires_reconciliation": false, "commits": []})
    );
}

// Commits stand on their own: they need reconciling whether or not the tree
// is dirty and whether or not the task is closed.
#[test]
fn commits_require_reconciliation_even_for_a_completed_task() {
    assert_eq!(
        uncertain(&view(true, Some("attempt")), &[RED.to_owned()], false),
        json!({"requires_reconciliation": true, "commits": [RED]})
    );
}
