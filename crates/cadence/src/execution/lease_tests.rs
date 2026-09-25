//! What a dispatch lease covers, and what counts as a path at all.
//!
//! Both rules take strings and return a boolean. They decide whether an
//! executor's commit stays inside what the plan declared and whether a path
//! the caller supplied can be joined to the project root safely, so they are
//! worth stating exactly.
use super::lease::covers;
use super::patch::safe_relative_path;

fn files(paths: &[&str]) -> Vec<String> {
    paths.iter().map(|path| (*path).to_owned()).collect()
}

#[test]
fn an_exact_file_covers_only_itself() {
    let declared = files(&["crates/cadence/src/delivery.rs"]);
    assert!(covers(&declared, &[], "crates/cadence/src/delivery.rs"));
    assert!(!covers(&declared, &[], "crates/cadence/src/receipt.rs"));
    assert!(!covers(&declared, &[], "crates/cadence/src"));
}

// A file declaration is not a prefix. Declaring `src/delivery.rs` must not
// quietly cover `src/delivery.rs.bak` or a directory that starts the same way.
#[test]
fn a_file_declaration_does_not_cover_a_path_that_merely_starts_with_it() {
    let declared = files(&["src/delivery.rs"]);
    assert!(!covers(&declared, &[], "src/delivery.rs.bak"));
    assert!(!covers(&declared, &[], "src/delivery.rs/inner"));
}

#[test]
fn a_directory_covers_its_descendants_at_any_depth() {
    let declared = files(&["crates/cadence/src/execution"]);
    assert!(covers(&[], &declared, "crates/cadence/src/execution/receipts.rs"));
    assert!(covers(&[], &declared, "crates/cadence/src/execution/deep/under/here.rs"));
}

// The root itself counts, which is what lets two declarations be ordered
// against each other when one contains the other.
#[test]
fn a_directory_covers_itself() {
    assert!(covers(&[], &files(&["crates/cadence/src"]), "crates/cadence/src"));
}

// Coverage stops at a component boundary. A sibling directory whose name
// begins with the declared one is outside the lease.
#[test]
fn a_directory_does_not_cover_a_sibling_that_shares_its_prefix() {
    let declared = files(&["crates/cadence/src/exec"]);
    assert!(!covers(&[], &declared, "crates/cadence/src/execution/receipts.rs"));
    assert!(!covers(&[], &declared, "crates/cadence/src/exec2"));
}

#[test]
fn nothing_declared_covers_nothing() {
    assert!(!covers(&[], &[], "src/delivery.rs"));
    assert!(!covers(&[], &[], ""));
}

#[test]
fn either_list_can_be_the_one_that_covers_a_path() {
    let file = files(&["README.md"]);
    let directory = files(&["docs"]);
    assert!(covers(&file, &directory, "README.md"));
    assert!(covers(&file, &directory, "docs/architecture/acceptance.md"));
    assert!(!covers(&file, &directory, "src/delivery.rs"));
}

// A path is joined to the project root, so anything that could climb out of
// it, name the root itself, or be read differently by another filesystem is
// refused rather than normalised.
#[test]
fn an_ordinary_relative_path_is_safe() {
    for path in ["README.md", "crates/cadence/src/delivery.rs", "a/b/c/d.rs", ".planning/state.json"] {
        assert!(safe_relative_path(path), "{path}");
    }
}

#[test]
fn an_absolute_path_is_not_safe() {
    for path in ["/etc/passwd", "/", "//server/share"] {
        assert!(!safe_relative_path(path), "{path}");
    }
}

#[test]
fn a_path_that_can_climb_out_is_not_safe() {
    for path in ["../secrets", "src/../../secrets", "..", "src/..", "./src", "."] {
        assert!(!safe_relative_path(path), "{path}");
    }
}

// An empty component means a doubled or trailing separator, which two
// filesystems need not agree about.
#[test]
fn an_empty_path_or_component_is_not_safe() {
    for path in ["", "src//delivery.rs", "src/", "/src"] {
        assert!(!safe_relative_path(path), "{path:?}");
    }
}

// A backslash is a separator on some hosts and an ordinary character here, so
// a path carrying one would mean two different things.
#[test]
fn a_backslash_anywhere_is_not_safe() {
    for path in ["src\\delivery.rs", "src/deliv\\ery.rs", "..\\secrets"] {
        assert!(!safe_relative_path(path), "{path}");
    }
}

// A name that merely contains dots is ordinary; only a component that is
// exactly one or two dots is not.
#[test]
fn a_dotted_name_that_is_not_a_traversal_is_safe() {
    for path in ["src/..hidden", "src/a..b", "v4.0.0/notes.md", ".gitignore"] {
        assert!(safe_relative_path(path), "{path}");
    }
}
