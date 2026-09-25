//! When a difference in the working tree is the binary's own and when it is
//! the owner's uncommitted work.
//!
//! `observe_working_tree` asks Git and the filesystem; `accounted` judges what
//! they said. These checks build the tree by hand, so none of them reads a
//! file or runs a command. D-131: only the named projections with their exact
//! bytes are accounted for, and every other difference stays ambiguous.
use super::inputs::{WorkingTree, accounted};
use std::collections::BTreeMap;

const SUMMARY: &str = ".planning/phases/12/SUMMARY.md";
const RENDERED: &[u8] = b"# Phase 12\n\nDelivered.\n";

fn installed(paths: &[(&str, &[u8])]) -> BTreeMap<String, Vec<u8>> {
    paths.iter().map(|(path, bytes)| ((*path).to_owned(), bytes.to_vec())).collect()
}

fn is_dirty(result: crate::store::Result<()>) -> bool {
    result.is_err_and(|error| error.to_string().contains("evidence-source-dirty"))
}

// With nothing rendered, the tree has to be clean outright.
#[test]
fn with_no_projections_a_clean_tree_is_accounted_and_any_difference_is_not() {
    assert!(accounted(&BTreeMap::new(), &WorkingTree::new()).is_ok());
    assert!(is_dirty(accounted(&BTreeMap::new(), &WorkingTree::new().file(" M ", SUMMARY, RENDERED))));
}

#[test]
fn a_projection_at_exactly_its_rendered_bytes_is_accounted() {
    let tree = WorkingTree::new().file(" M ", SUMMARY, RENDERED);
    assert!(accounted(&installed(&[(SUMMARY, RENDERED)]), &tree).is_ok());
}

#[test]
fn an_untracked_projection_at_its_rendered_bytes_is_accounted() {
    let tree = WorkingTree::new().file("?? ", SUMMARY, RENDERED);
    assert!(accounted(&installed(&[(SUMMARY, RENDERED)]), &tree).is_ok());
}

// Exact means exact. A projection the owner has edited is their work now.
#[test]
fn a_projection_whose_bytes_differ_by_anything_is_not_accounted() {
    let tree = WorkingTree::new().file(" M ", SUMMARY, b"# Phase 12\n\nDelivered.");
    assert!(is_dirty(accounted(&installed(&[(SUMMARY, RENDERED)]), &tree)));
}

#[test]
fn a_path_that_was_never_rendered_is_not_accounted() {
    let tree = WorkingTree::new().file(" M ", "src/delivery.rs", RENDERED);
    assert!(is_dirty(accounted(&installed(&[(SUMMARY, RENDERED)]), &tree)));
}

// Only a modification or an untracked file can be the binary's own writing.
// A staged add, a deletion or a rename is the owner doing something else.
#[test]
fn only_a_modification_or_an_untracked_file_can_be_accounted() {
    let installed = installed(&[(SUMMARY, RENDERED)]);
    for code in ["A  ", " D ", "D  ", "R  ", "MM ", "AM ", "UU "] {
        let tree = WorkingTree::new().file(code, SUMMARY, RENDERED);
        assert!(is_dirty(accounted(&installed, &tree)), "{code}");
    }
}

// A path Git named that will not read back as plain bytes is ambiguous, not
// accounted: a symlink contributes its own text, a directory none at all.
#[test]
fn a_difference_that_does_not_read_as_a_file_is_not_accounted() {
    let tree = WorkingTree::new().unreadable(" M ", SUMMARY);
    assert!(is_dirty(accounted(&installed(&[(SUMMARY, RENDERED)]), &tree)));
}

// Every difference has to be accounted for, not just one of them.
#[test]
fn one_unaccounted_difference_beside_an_accounted_one_is_still_dirty() {
    let tree = WorkingTree::new()
        .file(" M ", SUMMARY, RENDERED)
        .file(" M ", "src/delivery.rs", b"fn answer() -> u8 { 7 }\n");
    assert!(is_dirty(accounted(&installed(&[(SUMMARY, RENDERED)]), &tree)));
}

#[test]
fn several_projections_at_their_rendered_bytes_are_all_accounted() {
    let other = ".planning/phases/13/SUMMARY.md";
    let tree = WorkingTree::new()
        .file(" M ", SUMMARY, RENDERED)
        .file("?? ", other, b"# Phase 13\n");
    assert!(accounted(&installed(&[(SUMMARY, RENDERED), (other, b"# Phase 13\n")]), &tree).is_ok());
}
