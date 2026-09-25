//! `git status --porcelain=v1 -z` read over bytes, what a changed path's
//! material reads as in a temporary directory the test owns, and the choices
//! pause makes about what the WIP commit stages and when it may commit.

use super::git::{
    Change, Entry, Material, Observation, WipIndex, add_paths, commit_guarded, committed_as_guarded,
    guard_holds, material, parse_status, unauthorized, unchanged, wip_paths, wip_subject,
};
use crate::process::Recorded;
use std::collections::BTreeSet;
use std::os::unix::ffi::OsStrExt;
use std::path::PathBuf;

fn entry(index: u8, worktree: u8, path: &str, original: Option<&str>) -> Entry {
    Entry { index, worktree, path: path.into(), original: original.map(PathBuf::from) }
}

#[test]
fn each_entry_keeps_its_index_and_worktree_codes_and_path() {
    assert_eq!(
        parse_status(b"M  staged\0 M unstaged\0?? untracked\0 D deleted\0").unwrap(),
        [
            entry(b'M', b' ', "staged", None),
            entry(b' ', b'M', "unstaged", None),
            entry(b'?', b'?', "untracked", None),
            entry(b' ', b'D', "deleted", None),
        ]
    );
}

#[test]
fn empty_status_is_no_entries() {
    assert_eq!(parse_status(b"").unwrap(), []);
}

#[test]
fn a_rename_or_copy_carries_the_field_after_it_as_its_source() {
    assert_eq!(
        parse_status(b"R  new\0old\0C  copy\0source\0 M after\0").unwrap(),
        [
            entry(b'R', b' ', "new", Some("old")),
            entry(b'C', b' ', "copy", Some("source")),
            entry(b' ', b'M', "after", None),
        ]
    );
    assert_eq!(parse_status(b" R new\0old\0").unwrap(), [entry(b' ', b'R', "new", Some("old"))]);
}

#[test]
fn a_rename_without_its_source_is_refused() {
    for status in [b"R  new\0".as_slice(), b"R  new\0\0"] {
        let refusal = parse_status(status).unwrap_err().to_string();
        assert!(refusal.contains("missing Git rename source"), "{status:?}: {refusal}");
    }
}

#[test]
fn pathname_bytes_reach_the_entry_unchanged() {
    let name = b"caf\xe9 $(touch x) `id`;|&*'\"";
    let status = [b"?? ".as_slice(), name, b"\0"].concat();
    let parsed = parse_status(&status).unwrap();
    assert_eq!(parsed.len(), 1);
    assert_eq!(parsed[0].path.as_os_str().as_bytes(), name);
}

#[test]
fn an_entry_without_two_codes_and_a_space_is_refused() {
    for status in [b"M\0".as_slice(), b"MM\0", b"MMxname\0"] {
        assert!(parse_status(status).is_err(), "{status:?}");
    }
}

#[test]
fn a_path_that_leaves_the_repository_or_enters_git_is_refused() {
    for status in [
        b"?? ../outside\0".as_slice(),
        b"?? .git/config\0",
        b"R  inside\0../outside\0",
    ] {
        assert!(parse_status(status).is_err(), "{status:?}");
    }
}

#[test]
fn a_deleted_path_is_missing_material() {
    let temp = tempfile::tempdir().unwrap();
    assert_eq!(material(&temp.path().join("deleted")).unwrap(), Material::Missing);
}

#[test]
fn a_symlink_is_its_target_text_and_is_not_followed() {
    let temp = tempfile::tempdir().unwrap();
    let link = temp.path().join("link");
    std::os::unix::fs::symlink("nowhere/target", &link).unwrap();
    assert_eq!(material(&link).unwrap(), Material::Symlink("nowhere/target".into()));
}

#[test]
fn a_directory_is_not_material() {
    let temp = tempfile::tempdir().unwrap();
    assert!(material(temp.path()).is_err());
}

fn paths(values: &[&str]) -> Vec<PathBuf> {
    values.iter().map(PathBuf::from).collect()
}

#[test]
fn store_receipts_named_by_provenance_are_not_authored() {
    let receipts = [PathBuf::from(".planning/state.json")].into();
    assert_eq!(
        super::git::authored(&paths(&["src/lib.rs", ".planning/state.json"]), &receipts),
        paths(&["src/lib.rs"])
    );
}

#[test]
fn review_artifacts_directly_under_a_phase_are_not_authored() {
    let scope = paths(&[
        ".planning/phases/3/REVIEW-risk_surface-pause-1.md",
        ".planning/phases/3/ADJUDICATION-1.json",
        ".planning/phases/3/FINDINGS.json",
        ".planning/phases/3/verifier-findings.json",
        "src/lib.rs",
    ]);
    assert_eq!(super::git::authored(&scope, &Default::default()), paths(&["src/lib.rs"]));
}

// Only exact provenance and the named review files leave the scope: anything
// that merely resembles them stays under review.
#[test]
fn a_lookalike_of_a_receipt_or_review_file_stays_authored() {
    let scope = paths(&[
        ".planning/unknown.jsonl",
        ".planning/phases/3/nested/REVIEW-x.md",
        ".planning/REVIEW-x.md",
        ".planning/notes/3/REVIEW-x.md",
        ".planning/phases/3/REVIEW-x.json",
    ]);
    assert_eq!(super::git::authored(&scope, &[PathBuf::from(".planning/items.jsonl")].into()), scope);
}

const HEAD: &str = "1111111111111111111111111111111111111111";
const TREE: &str = "2222222222222222222222222222222222222222";

fn change(index: u8, worktree: u8, path: &str, original: Option<&str>) -> Change {
    Change {
        index,
        worktree,
        path: path.into(),
        original: original.map(PathBuf::from),
        material: Material::Missing,
    }
}

fn observation(changes: Vec<Change>) -> Observation {
    Observation { head: HEAD.into(), branch: b"work".to_vec(), index: b"index".to_vec(), changes }
}

fn set(values: &[&str]) -> BTreeSet<PathBuf> {
    values.iter().map(PathBuf::from).collect()
}

#[test]
fn dirty_work_outside_the_authorized_set_and_the_receipts_is_unauthorized() {
    let dirty = observation(vec![change(b' ', b'M', "src/lib.rs", None), change(b' ', b'M', "notes.md", None)]);
    assert!(unauthorized(&dirty, &set(&["src/lib.rs"]), &set(&[])));
    assert!(!unauthorized(&dirty, &set(&["src/lib.rs"]), &set(&["notes.md"])));
    assert!(!unauthorized(&dirty, &set(&["src/lib.rs", "notes.md"]), &set(&[])));
}

#[test]
fn a_rename_is_authorized_only_with_both_of_its_sides() {
    let renamed = observation(vec![change(b'R', b' ', "new.rs", Some("old.rs"))]);
    assert!(unauthorized(&renamed, &set(&["new.rs"]), &set(&[])));
    assert!(!unauthorized(&renamed, &set(&["new.rs", "old.rs"]), &set(&[])));
}

#[test]
fn an_originally_clean_tree_has_no_unauthorized_work() {
    assert!(!unauthorized(&observation(vec![]), &set(&[]), &set(&[])));
}

#[test]
fn captured_work_is_unchanged_until_its_head_index_or_authored_changes_move() {
    let expected = observation(vec![change(b' ', b'M', "src/lib.rs", None)]);
    assert!(unchanged(&expected.clone(), &expected, &set(&[])));
    let moved = Observation { head: TREE.into(), ..expected.clone() };
    let reindexed = Observation { index: b"other".to_vec(), ..expected.clone() };
    let edited = observation(vec![change(b' ', b'D', "src/lib.rs", None)]);
    for current in [moved, reindexed, edited] {
        assert!(!unchanged(&current, &expected, &set(&[])), "{current:?}");
    }
}

#[test]
fn a_change_to_an_ignored_receipt_alone_leaves_the_work_unchanged() {
    let expected = observation(vec![change(b' ', b'M', "src/lib.rs", None)]);
    let current =
        observation(vec![change(b' ', b'M', "src/lib.rs", None), change(b' ', b'M', ".planning/state.json", None)]);
    assert!(unchanged(&current, &expected, &set(&[".planning/state.json"])));
}

#[test]
fn modified_deleted_and_new_files_in_the_worktree_are_added() {
    let expected = observation(vec![
        change(b' ', b'M', "modified", None),
        change(b' ', b'D', "deleted", None),
        change(b'?', b'?', "new", None),
    ]);
    assert_eq!(add_paths(&expected, &set(&["modified", "deleted", "new"])), set(&["modified", "deleted", "new"]));
}

#[test]
fn a_worktree_rename_adds_both_sides_and_a_staged_one_adds_nothing() {
    let unstaged = observation(vec![change(b' ', b'R', "new", Some("old"))]);
    assert_eq!(add_paths(&unstaged, &set(&["new", "old"])), set(&["new", "old"]));
    let staged = observation(vec![change(b'R', b' ', "new", Some("old"))]);
    assert_eq!(add_paths(&staged, &set(&["new", "old"])), set(&[]));
    let edited_after = observation(vec![change(b'R', b'M', "new", Some("old"))]);
    assert_eq!(add_paths(&edited_after, &set(&["new", "old"])), set(&["new"]));
}

#[test]
fn a_change_the_wip_does_not_stage_is_not_added() {
    let expected = observation(vec![change(b' ', b'M', "kept", None), change(b' ', b'R', "new", Some("old"))]);
    assert_eq!(add_paths(&expected, &set(&["new"])), set(&[]));
}

#[test]
fn nothing_staged_for_the_wip_is_no_wip() {
    assert_eq!(wip_paths(vec![], &set(&["a"])), Ok(None));
    assert_eq!(wip_paths(vec!["other".into()], &set(&["a"])), Ok(None));
}

#[test]
fn the_wip_is_exactly_its_staged_paths() {
    assert_eq!(wip_paths(vec!["a".into(), "b".into()], &set(&["a", "b", "c"])), Ok(Some(vec!["a".into(), "b".into()])));
}

#[test]
fn anything_else_staged_beside_the_wip_is_refused() {
    let refused = wip_paths(vec!["a".into(), "other".into()], &set(&["a"]));
    assert!(matches!(refused, Err(crate::store::Error::Conflict(_))), "{refused:?}");
}

fn guarded() -> WipIndex {
    WipIndex { head: HEAD.into(), branch: b"work".to_vec(), index_id: TREE.into(), paths: vec!["src/lib.rs".into()] }
}

#[test]
fn the_guard_holds_only_while_head_branch_tree_and_worktree_are_as_staged() {
    let wip = guarded();
    assert!(guard_holds(&wip, HEAD, b"work", TREE, &[]));
    assert!(!guard_holds(&wip, TREE, b"work", TREE, &[]));
    assert!(!guard_holds(&wip, HEAD, b"main", TREE, &[]));
    assert!(!guard_holds(&wip, HEAD, b"work", HEAD, &[]));
    assert!(!guard_holds(&wip, HEAD, b"work", TREE, &["src/lib.rs".into()]));
}

#[test]
fn a_commit_is_as_guarded_only_as_the_staged_tree_on_the_guarded_head() {
    let wip = guarded();
    assert!(committed_as_guarded(&wip, TREE, HEAD, &[]));
    assert!(!committed_as_guarded(&wip, HEAD, HEAD, &[]));
    assert!(!committed_as_guarded(&wip, TREE, TREE, &[]));
    assert!(!committed_as_guarded(&wip, TREE, HEAD, &["src/lib.rs".into()]));
}

#[test]
fn a_wip_subject_is_wip_and_the_one_line_description() {
    assert_eq!(wip_subject("  Work on pause  "), Ok("wip: Work on pause".into()));
    for description in ["", "  ", "first\nsecond", "first\rsecond"] {
        assert!(wip_subject(description).is_err(), "{description:?}");
    }
}

// A commit that fails, a refusing hook for instance, is the error pause
// reports; the index it guarded is left as it was, so nothing follows it.
#[test]
fn a_failed_commit_is_reported_and_nothing_is_asked_of_git_after_it() {
    let process = &mut Recorded::new()
        .out(format!("{HEAD}\n"))
        .out("work\n")
        .out(format!("{TREE}\n"))
        .out("")
        .fail(1, "pre-commit hook refused");
    let failure = commit_guarded(std::path::Path::new("/project"), &guarded(), "wip: Work", process)
        .unwrap_err()
        .to_string();
    assert!(failure.contains("pre-commit hook refused"), "{failure}");
    let requests = process.arguments();
    assert_eq!(requests.last().unwrap(), &["commit", "-m", "wip: Work"]);
    assert_eq!(requests.len(), 5, "{requests:?}");
}
