//! What the rail accepts as an object id, a risk surface and a scope name.
//!
//! These three guard what reaches a Git command line and what a caller may
//! claim about a change. All take a string or a JSON value and answer over it,
//! so every check here is a comparison.
use super::risk::{CATEGORIES, configured_surfaces, valid_object_id, validate_name, validate_surfaces};
use serde_json::json;

fn surfaces(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_owned()).collect()
}

// SHA-1 is forty hex characters and SHA-256 is sixty-four. Nothing else is an
// object id, and lowercase only, so one commit has one spelling.
#[test]
fn a_full_lowercase_hex_object_id_of_either_length_is_valid() {
    assert!(valid_object_id(&"a".repeat(40)));
    assert!(valid_object_id(&"0".repeat(64)));
    assert!(valid_object_id("1234567890abcdef1234567890abcdef12345678"));
}

#[test]
fn an_id_of_any_other_length_is_not_valid() {
    for length in [0, 7, 39, 41, 63, 65] {
        assert!(!valid_object_id(&"a".repeat(length)), "{length}");
    }
}

#[test]
fn an_uppercase_or_non_hex_id_is_not_valid() {
    for id in [
        "A".repeat(40),
        "g".repeat(40),
        format!("{}Z", "a".repeat(39)),
        format!("{} ", "a".repeat(39)),
        format!("{}-", "a".repeat(39)),
    ] {
        assert!(!valid_object_id(&id), "{id}");
    }
}

// The eight surfaces are the whole vocabulary. A caller naming something else
// is describing a risk the binary has no rule for.
#[test]
fn each_of_the_eight_surfaces_is_accepted_on_its_own() {
    for surface in CATEGORIES {
        assert_eq!(validate_surfaces(surfaces(&[surface])).unwrap(), [surface]);
    }
}

#[test]
fn several_distinct_surfaces_are_accepted_in_the_order_given() {
    assert_eq!(
        validate_surfaces(surfaces(&["secrets", "auth"])).unwrap(),
        ["secrets", "auth"]
    );
}

// An empty answer is not "no risk"; it is no answer. A caller saying there is
// no risk says so some other way.
#[test]
fn an_empty_surface_list_is_refused() {
    assert!(validate_surfaces(Vec::new()).is_err());
}

#[test]
fn a_surface_outside_the_vocabulary_is_refused() {
    for surface in ["performance", "AUTH", "auth ", "", "auth,secrets"] {
        assert!(validate_surfaces(surfaces(&[surface])).is_err(), "{surface:?}");
    }
}

// A repeat would let one surface be counted twice in whatever reads the answer.
#[test]
fn a_repeated_surface_is_refused() {
    assert!(validate_surfaces(surfaces(&["auth", "secrets", "auth"])).is_err());
}

// Configuration says nothing when it is absent, which is different from saying
// the empty list.
#[test]
fn absent_configuration_is_no_answer_and_an_empty_list_is_refused() {
    assert_eq!(configured_surfaces(&json!(null)).unwrap(), None);
    assert!(configured_surfaces(&json!([])).is_err());
    assert_eq!(configured_surfaces(&json!(["auth"])).unwrap(), Some(surfaces(&["auth"])));
}

#[test]
fn configuration_that_is_not_a_list_of_strings_is_refused() {
    for value in [json!("auth"), json!({"auth": true}), json!([7]), json!([["auth"]]), json!(3)] {
        assert!(configured_surfaces(&value).is_err(), "{value}");
    }
}

// Scope and request identities end up in stored keys and on command lines, so
// they take letters, digits and four punctuation characters, and nothing else.
#[test]
fn an_identity_of_letters_digits_and_the_four_allowed_marks_is_valid() {
    for name in [
        "phase-12",
        "active-cycle:phase:12",
        "P17_3_T1",
        "v4.0.0",
        "a",
        &"x".repeat(256),
    ] {
        assert!(validate_name(name).is_ok(), "{name}");
    }
}

#[test]
fn an_empty_or_overlong_identity_is_refused() {
    assert!(validate_name("").is_err());
    assert!(validate_name(&"x".repeat(257)).is_err());
}

#[test]
fn an_identity_carrying_anything_else_is_refused() {
    for name in [
        "phase 12",
        "phase/12",
        "phase\n12",
        "phase;12",
        "phase\"12",
        "phase'12",
        "phase\\12",
        "phasé",
    ] {
        assert!(validate_name(name).is_err(), "{name:?}");
    }
}

// A dash is an allowed character wherever it appears, so this rule does not
// stop an identity from reading as an option. Whatever puts one on a command
// line still has to pass it after `--`.
#[test]
fn an_identity_that_reads_as_an_option_is_still_valid_here() {
    assert!(validate_name("cadence-binary-owns-process").is_ok());
    assert!(validate_name("-leading").is_ok());
    assert!(validate_name("--phase").is_ok());
}
