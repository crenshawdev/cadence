//! What counts as a reference this binary will hand to Git.
//!
//! A landing writes refs whose names come from configuration and from the
//! branch the owner is on, so a name that Git would read as an option, a
//! revision expression or a path traversal must never reach the command line.
//! The rule is ours and takes only a string, so every check here is a
//! comparison.
use super::effects::valid_ref;

#[test]
fn a_plain_branch_or_tag_reference_is_valid() {
    for name in [
        "refs/heads/main",
        "refs/heads/cadence/binary-owns-process",
        "refs/tags/v4.0.0",
        "refs/remotes/origin/main",
    ] {
        assert!(valid_ref(name), "{name}");
    }
}

// Anything outside the refs namespace is not a reference this binary writes.
#[test]
fn a_name_outside_the_refs_namespace_is_refused() {
    for name in ["main", "heads/main", "HEAD", "", "/refs/heads/main"] {
        assert!(!valid_ref(name), "{name}");
    }
}

// Git's revision grammar: `..` is a range, `@{` a reflog selector, `^` and `~`
// walk ancestry, `:` splits a refspec. A name carrying any of them would be
// read as an expression rather than the reference it claims to be.
#[test]
fn a_name_git_would_read_as_a_revision_expression_is_refused() {
    for name in [
        "refs/heads/a..b",
        "refs/heads/main@{yesterday}",
        "refs/heads/main^",
        "refs/heads/main~1",
        "refs/heads/main:other",
        "refs/heads/ma?in",
        "refs/heads/ma*in",
        "refs/heads/ma[in",
        "refs/heads/ma\\in",
        "refs/heads/main.",
    ] {
        assert!(!valid_ref(name), "{name}");
    }
}

#[test]
fn a_name_with_whitespace_or_control_characters_is_refused() {
    for name in ["refs/heads/my main", "refs/heads/main\n", "refs/heads/main\t", "refs/heads/ma\0in"] {
        assert!(!valid_ref(name), "{name:?}");
    }
}

// Git's own ref format rules: no empty component, no component starting with a
// dot, and `.lock` is reserved for its own locking.
#[test]
fn a_component_that_is_empty_hidden_or_a_lock_is_refused() {
    for name in [
        "refs/heads//main",
        "refs/heads/",
        "refs/heads/.hidden",
        "refs/.heads/main",
        "refs/heads/main.lock",
        "refs/heads/main.lock/more",
    ] {
        assert!(!valid_ref(name), "{name}");
    }
}

// A dot inside a component is ordinary; only a trailing one, or a component
// that begins with one, is not.
#[test]
fn a_dot_inside_a_component_is_ordinary() {
    assert!(valid_ref("refs/tags/v4.0.0"));
    assert!(valid_ref("refs/heads/release-1.2.x"));
}
