//! The limits a plan's evidence map is held to.
//!
//! Every rule here takes contributions or raw JSON and returns a refusal or
//! nothing. No store, no repository, no clock, so each check states a case and
//! reads the answer. These are the rules a planner meets before anything is
//! published, and until now none of them had a check of its own.
use super::associations::Contribution;
use super::evidence::Item;
use super::limits::{base, checks, content, disposition, malformed};
use super::model::{Details, Source};
use crate::store::Error;
use serde_json::{Value, json};

/// A check item that satisfies every content rule, ready to be spoiled.
fn check(id: &str, truths: &[(&str, u32)]) -> Item {
    let associations: Vec<_> = truths.iter()
        .map(|(id, version)| json!({"truth_id": id, "truth_version": version, "reason": "The check proves it."}))
        .collect();
    serde_json::from_value(json!({
        "kind": "check", "id": id, "reason": "Removing delivery loses the receipt.",
        "spec": {"command": "cargo nextest run delivery", "expected": {"kind": "literal", "value": "receipt"},
            "test": {"file": "src/delivery.rs", "function": "delivers"}, "setup": "", "call": "",
            "boundary": "delivery::deliver", "fakes": ["process"]},
        "associations": associations,
    })).expect("a check item")
}

fn link(id: &str) -> Item {
    serde_json::from_value(json!({
        "kind": "link", "id": id, "reason": "The caller needs the callee.",
        "spec": {"caller": "delivery::deliver", "callee": "receipt::write", "value": "a receipt"},
        "associations": [{"truth_id": "truth/A", "truth_version": 1, "reason": "The link carries it."}],
    })).expect("a link item")
}

/// A plan already saved in the current set.
fn saved(plan: u32, items: Vec<Item>) -> Contribution {
    Contribution { plan, entry: None, items }
}

/// A plan being proposed in this submission.
fn proposed(plan: u32, entry: usize, items: Vec<Item>) -> Contribution {
    Contribution { plan, entry: Some(entry), items }
}

fn refusal(error: Error) -> Value {
    let (Error::Invalid(payload) | Error::Conflict(payload)) = error else { panic!("a typed refusal: {error:?}") };
    serde_json::from_str(payload.trim_start_matches("plan-refusal:")).expect("a refusal envelope")
}

#[test]
fn a_complete_check_and_link_meet_the_content_rules() {
    assert!(content(12, &[saved(1, vec![check("check/A", &[("truth/A", 1)]), link("link/A")])]).is_ok());
}

// A command nobody can run, or an expectation of nothing, is a check that
// cannot fail. Blank means blank after trimming, so whitespace does not pass.
#[test]
fn a_check_without_a_command_is_refused_at_its_own_slot() {
    for blank in ["", "   ", "\t\n"] {
        let mut item = check("check/A", &[("truth/A", 1)]);
        let Item::Check { spec, .. } = &mut item else { panic!("a check") };
        spec.command = blank.into();
        let answer = refusal(content(12, &[saved(1, vec![item])]).unwrap_err());
        assert_eq!(answer["rule"], "check-command", "{blank:?}");
        assert_eq!(answer["slot"], "current.plans[1].evidence_map.items[0].spec.command");
        assert_eq!(answer["id"], "check/A");
    }
}

#[test]
fn a_check_expecting_nothing_is_refused() {
    let mut item = check("check/A", &[("truth/A", 1)]);
    let Item::Check { spec, .. } = &mut item else { panic!("a check") };
    spec.expected = super::evidence::Expected::Literal("  ".into());
    let answer = refusal(content(12, &[saved(1, vec![item])]).unwrap_err());
    assert_eq!(answer["rule"], "check-expected");
    assert_eq!(answer["slot"], "current.plans[1].evidence_map.items[0].spec.expected.value");
}

#[test]
fn a_check_with_a_blank_test_file_is_refused() {
    for blank in ["", "   "] {
        let artifact = serde_json::from_value(json!({
            "kind": "artifact", "id": "artifact/refusal", "reason": "The refusal must locate the check.",
            "spec": {"locators": ["src/plan.rs"], "substance": "The check content decision."},
            "associations": [{"truth_id": "T6", "truth_version": 1, "reason": "The refusal names its slot."}],
        })).expect("an artifact item");
        let mut item = check("check/blank", &[("T6", 1)]);
        let Item::Check { spec, .. } = &mut item else { panic!("a check") };
        spec.test.file = blank.into();
        let result = content(39, &[proposed(3, 1, vec![artifact, item])]);
        assert!(result.is_err(), "test.file {blank:?} must be refused");
        let answer = refusal(result.unwrap_err());
        assert_eq!(answer["rule"], "check-test-file");
        assert_eq!(answer["slot"], "submission.plans[1].content.evidence_map.items[1].spec.test.file");
        assert_eq!(answer["phase"], 39);
        assert_eq!(answer["entry"], 1);
        assert_eq!(answer["id"], "check/blank");
        assert_eq!(answer["reason"], "phase 39 item check/blank needs nonblank test.file");
    }
}

#[test]
fn plan_instructions_require_a_test_file() {
    let rendered = crate::plan::instructions::markdown();
    for block in [
        "- `check-test-file`: the check's test file must contain non-whitespace text. The refusal names its test-file slot; this establishes a locator, not that the file exists or contains an adequate test.",
        "Command, expected output and the test file are content-checked on a check. The\n\
test function, setup, call, boundary and fakes keep their typed grammar; blank\n\
strings in those fields and an empty fakes array remain legal. This describes\n\
mechanical admission, not permission to omit the one-unit shape above. Cadence\n\
does not infer test style or assertion strength. Test existence, task/check\n\
bindings, red/green receipts and subject-stub gates belong to execution;\n\
adequacy belongs to the owner and verifier.",
        "- `check-test-file`: supply a nonblank test file at the named item's test-file slot. Whitespace alone is blank; a missing or mistyped file remains an evidence-item-shape failure.",
        "so an old-policy blank command, expected output or test file, an extra check or\n\
an unnamed link blocks that union.",
    ] {
        assert!(rendered.contains(block), "missing instruction block: {block}");
    }
    for obsolete in [
        "Only command and expected output are content-checked on a check.",
        "Test locator,",
        "blank command/output",
    ] {
        assert!(!rendered.contains(obsolete), "obsolete instruction remains: {obsolete}");
    }
}

#[test]
fn a_link_missing_either_end_or_its_value_is_refused() {
    for field in ["caller", "callee", "value"] {
        let mut item = link("link/A");
        let Item::Link { spec, .. } = &mut item else { panic!("a link") };
        match field {
            "caller" => spec.caller.clear(),
            "callee" => spec.callee.clear(),
            _ => spec.value.clear(),
        }
        let answer = refusal(content(12, &[saved(1, vec![item])]).unwrap_err());
        assert_eq!(answer["rule"], "link-content", "{field}");
        assert_eq!(answer["slot"], format!("current.plans[1].evidence_map.items[0].spec.{field}"));
    }
}

// A slot has to say where the owner can go and change it, which is a
// different place for a plan being proposed than for one already saved.
#[test]
fn a_slot_names_the_submission_entry_when_proposed_and_the_saved_plan_otherwise() {
    assert_eq!(base(&proposed(3, 0, Vec::new()), 2), "submission.plans[0].content.evidence_map.items[2]");
    assert_eq!(base(&saved(3, Vec::new()), 2), "current.plans[3].evidence_map.items[2]");
}

// One truth gets one check across the whole phase. Two distinct checks on the
// same truth is the rule that a fixture broke this morning.
#[test]
fn one_truth_takes_one_distinct_check() {
    assert!(checks(12, &[saved(1, vec![check("check/A", &[("truth/A", 1)])])]).is_ok());

    let two = saved(1, vec![check("check/A", &[("truth/A", 1)]), check("check/A2", &[("truth/A", 1)])]);
    let answer = refusal(checks(12, &[two]).unwrap_err());
    assert_eq!(answer["rule"], "truth-check-limit");
    assert_eq!(answer["slot"], "submission.plans");
    assert_eq!(answer["id"], "truth/A");
    let ids: Vec<_> = answer["details"]["checks"].as_array().unwrap()
        .iter().map(|check| check["id"].as_str().unwrap().to_owned()).collect();
    assert_eq!(ids, ["check/A", "check/A2"]);
}

// Aliases share an id, so the same check named twice against one truth is one
// check, not two.
#[test]
fn the_same_check_id_against_one_truth_twice_is_one_check() {
    let twice = saved(1, vec![check("check/A", &[("truth/A", 1)]), check("check/A", &[("truth/A", 1)])]);
    assert!(checks(12, &[twice]).is_ok());
}

#[test]
fn one_check_covering_several_truths_is_allowed() {
    let wide = saved(1, vec![check("check/A", &[("truth/A", 1), ("truth/B", 1)])]);
    assert!(checks(12, &[wide]).is_ok());
}

// A truth's versions are separate truths for this purpose: rewriting a truth
// lets a new check take over from the old one.
#[test]
fn checks_on_different_versions_of_a_truth_do_not_collide() {
    let versions = saved(1, vec![check("check/A", &[("truth/A", 1)]), check("check/A2", &[("truth/A", 2)])]);
    assert!(checks(12, &[versions]).is_ok());
}

// The limit is across the phase, so two plans each holding their own check on
// one truth collide even though neither plan does on its own.
#[test]
fn two_plans_each_with_their_own_check_on_one_truth_collide() {
    let first = saved(1, vec![check("check/A", &[("truth/A", 1)])]);
    let second = saved(2, vec![check("check/A2", &[("truth/A", 1)])]);
    assert!(checks(12, &[first, second]).is_err());
}

// The owner reads the origins to decide which check to keep, so the proposal
// they are about to make is listed before the definition already saved at the
// same plan, and the plans run in numeric order rather than lexical: plan 2
// before plan 10.
#[test]
fn origins_are_listed_by_plan_with_the_proposal_before_the_saved_definition() {
    let answer = refusal(checks(12, &[
        proposed(2, 0, vec![check("check/A", &[("truth/A", 1)])]),
        saved(10, vec![check("check/A2", &[("truth/A", 1)])]),
        saved(2, vec![check("check/A", &[("truth/A", 1)])]),
    ]).unwrap_err());
    let Details::CheckConflict { checks, .. } = serde_json::from_value(answer["details"].clone()).unwrap()
        else { panic!("a check conflict") };
    let first = checks.iter().find(|check| check.id == "check/A").expect("check/A");
    assert_eq!(
        first.origins.iter().map(|origin| (origin.plan, matches!(origin.source, Source::Proposed))).collect::<Vec<_>>(),
        [(2, true), (2, false)]
    );
    let second = checks.iter().find(|check| check.id == "check/A2").expect("check/A2");
    assert_eq!(second.origins[0].plan, 10);
}

// A caller who sends a check the typed grammar cannot read gets told which
// field, not a parser message.
#[test]
fn a_check_whose_command_is_not_a_string_is_named_as_a_command_problem() {
    let raw = json!({"submission": {"phase": 12, "plans": [{"content": {"evidence_map": {"mode": "attached",
        "items": [{"kind": "check", "id": "check/A", "reason": "why", "associations": [],
            "spec": {"command": 7, "expected": {"kind": "literal", "value": "receipt"},
                "test": {"file": "f", "function": "g"}, "setup": "", "call": "", "boundary": "b", "fakes": []}}]}}}]}});
    let found = malformed(&raw).expect("a diagnostic");
    assert_eq!(found.rule, "check-command");
    assert_eq!(found.slot, "submission.plans[0].content.evidence_map.items[0].spec.command");
    assert_eq!(found.id.as_deref(), Some("check/A"));
    assert_eq!(found.phase, Some(12));
}

#[test]
fn a_well_formed_map_has_nothing_malformed_in_it() {
    let raw = json!({"submission": {"phase": 12, "plans": [{"content": {"evidence_map": {"mode": "attached",
        "items": [serde_json::to_value(check("check/A", &[("truth/A", 1)])).unwrap()]}}}]}});
    assert!(malformed(&raw).is_none());
}

// A provisional map has no items to be malformed.
#[test]
fn a_provisional_map_is_never_malformed() {
    let raw = json!({"submission": {"phase": 12, "plans": [{"content": {"evidence_map": {"mode": "provisional"}}}]}});
    assert!(malformed(&raw).is_none());
}

// Our own typed refusal survives a transaction boundary intact; anything else
// is converted rather than parsed back out of a Debug rendering.
#[test]
fn a_typed_refusal_crosses_a_boundary_unchanged_and_anything_else_is_converted() {
    let typed = Error::Invalid("plan-refusal:{\"rule\":\"check-command\"}".into());
    let Error::Conflict(carried) = disposition(typed, Error::Conflict) else { panic!("converted") };
    assert_eq!(carried, "plan-refusal:{\"rule\":\"check-command\"}");

    let other = Error::Io("disk went away".into());
    let Error::Conflict(described) = disposition(other, Error::Conflict) else { panic!("converted") };
    assert!(described.contains("disk went away"), "{described}");
    assert!(!described.starts_with("plan-refusal:"), "{described}");
}
