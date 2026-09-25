//! Reading Git's tree listing before a prune rewrites it.
//!
//! `freeze_message` runs `ls-tree`; `parse_tree` reads what it printed. A
//! pathname can hold anything a filesystem allows, which is why Git offers the
//! NUL form and why this is worth reading carefully: a row misread here would
//! put the wrong mode or object id into a commit the owner signs.
use super::commit::parse_tree;

const BLOB: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER: &str = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

#[test]
fn each_row_reads_as_a_path_with_its_mode_and_object() {
    let output = format!("100644 blob {BLOB}\t.planning/ROADMAP.md\0100755 blob {OTHER}\tscripts/run.sh\0");
    let entries = parse_tree(output.as_bytes()).unwrap();
    assert_eq!(entries[".planning/ROADMAP.md"], ("100644".to_owned(), BLOB.to_owned()));
    assert_eq!(entries["scripts/run.sh"], ("100755".to_owned(), OTHER.to_owned()));
}

#[test]
fn an_empty_listing_is_no_entries() {
    assert!(parse_tree(b"").unwrap().is_empty());
}

// The NUL form exists so a pathname carrying a space or a tab survives. Only
// the first tab separates the header from the path.
#[test]
fn a_pathname_with_spaces_or_tabs_survives() {
    let output = format!("100644 blob {BLOB}\tdocs/a file\twith a tab.md\0");
    let entries = parse_tree(output.as_bytes()).unwrap();
    assert_eq!(entries["docs/a file\twith a tab.md"], ("100644".to_owned(), BLOB.to_owned()));
}

#[test]
fn a_directory_entry_keeps_its_tree_mode_and_id() {
    let output = format!("040000 tree {BLOB}\t.planning/phases\0");
    assert_eq!(parse_tree(output.as_bytes()).unwrap()[".planning/phases"], ("040000".to_owned(), BLOB.to_owned()));
}

// A row that is not a tree entry is refused rather than read past, because
// guessing at it would put an invented mode or object into the commit.
#[test]
fn a_row_with_no_tab_is_refused() {
    assert!(parse_tree(format!("100644 blob {BLOB} .planning/ROADMAP.md\0").as_bytes()).is_err());
}

#[test]
fn a_header_without_three_fields_is_refused() {
    for header in ["100644 blob", "100644", format!("100644 blob {BLOB} extra").as_str(), ""] {
        let output = [header.as_bytes(), b"\tpath.md\0"].concat();
        assert!(parse_tree(&output).is_err(), "{header:?}");
    }
}

#[test]
fn a_pathname_that_is_not_utf8_is_refused() {
    let mut output = format!("100644 blob {BLOB}\t").into_bytes();
    output.extend_from_slice(&[0xff, 0xfe, 0]);
    assert!(parse_tree(&output).is_err());
}

// A trailing NUL leaves an empty record, which is not a row.
#[test]
fn trailing_and_repeated_separators_add_no_entries() {
    let output = format!("100644 blob {BLOB}\tone.md\0\0\0");
    assert_eq!(parse_tree(output.as_bytes()).unwrap().len(), 1);
}
