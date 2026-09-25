//! The grammar a truth has to be written in before a phase can start.
//!
//! These are the rules the owner settled when criteria became first-class:
//! at most seven truths, one trigger, one observer, a fixed verb, and two
//! separate owner attestations that nothing else can imply. Every one of them
//! takes a submission and returns a refusal or nothing, so each check states
//! a context and reads the answer.
use super::model::{ApprovedContext, Submission};
use super::validation::{identities, validate};
use serde_json::{Value, json};

fn truth(id: &str) -> Value {
    json!({"id": id, "trigger": "the sender sends the parcel", "observer": "the recipient",
        "verb": "gets", "outcome": "a receipt", "kind": "property",
        "observable": true, "fixed_oracle": true})
}

fn context(truths: Vec<Value>) -> Value {
    json!({"submission": {"phase": 12, "title": "Delivery", "scope": "Approved delivery.",
        "durable_decisions": [], "decisions": [], "assumptions": [], "truths": truths}})
}

fn refusal(answer: Option<super::model::Answer>) -> Value {
    serde_json::to_value(answer.expect("a refusal")).expect("a refusal envelope")
}

fn spoiled(slot: &str, value: Value) -> Value {
    let mut only = truth("truth/A");
    only[slot] = value;
    context(vec![only])
}

#[test]
fn a_complete_truth_is_accepted() {
    assert!(validate(&context(vec![truth("truth/A")])).is_none());
}

#[test]
fn a_context_with_no_truths_is_refused() {
    for empty in [context(Vec::new()), json!({"submission": {"phase": 12}})] {
        let answer = refusal(validate(&empty));
        assert_eq!(answer["rule"], "required-slot");
        assert_eq!(answer["slot"], "truths");
    }
}

// Seven is the hard limit the owner set: a phase that needs an eighth truth is
// two phases.
#[test]
fn seven_truths_are_allowed_and_an_eighth_is_refused() {
    let seven: Vec<_> = (1..=7).map(|n| truth(&format!("truth/{n}"))).collect();
    assert!(validate(&context(seven.clone())).is_none());

    let mut eight = seven;
    eight.push(truth("truth/8"));
    let answer = refusal(validate(&context(eight)));
    assert_eq!(answer["rule"], "seven-truths");
    assert!(answer["reason"].as_str().unwrap().contains("split the phase"));
}

#[test]
fn every_sentence_slot_has_to_be_a_nonblank_string() {
    for slot in ["trigger", "observer", "verb", "outcome", "kind"] {
        for blank in [json!(""), json!("   "), json!(null), json!(7)] {
            let answer = refusal(validate(&spoiled(slot, blank.clone())));
            assert_eq!(answer["rule"], "required-slot", "{slot} {blank}");
            assert_eq!(answer["slot"], slot);
            assert_eq!(answer["id"], "truth/A");
            assert_eq!(answer["entry"], 0);
        }
    }
}

// A truth with two triggers is two truths wearing one sentence, and neither
// can be checked on its own.
#[test]
fn a_trigger_with_an_alternative_is_refused() {
    let answer = refusal(validate(&spoiled("trigger", json!("the sender sends or cancels the parcel"))));
    assert_eq!(answer["rule"], "one-trigger");
}

#[test]
fn a_trigger_that_merely_contains_the_letters_or_is_fine() {
    assert!(validate(&spoiled("trigger", json!("the sender reorders the parcel"))).is_none());
    assert!(validate(&spoiled("trigger", json!("the order arrives"))).is_none());
}

// One observer, for the same reason: whose experience the truth is about has
// to be answerable.
#[test]
fn an_observer_naming_more_than_one_party_is_refused() {
    for observer in [
        "the recipient and the sender",
        "the recipient & the sender",
        "the recipient, the sender",
        "the recipient; the sender",
    ] {
        let answer = refusal(validate(&spoiled("observer", json!(observer))));
        assert_eq!(answer["rule"], "one-observer", "{observer}");
    }
}

#[test]
fn an_observer_whose_name_merely_contains_and_is_fine() {
    assert!(validate(&spoiled("observer", json!("the standby operator"))).is_none());
}

// The verb decides what kind of observation settles the truth, so it comes
// from a fixed set rather than the author's prose.
#[test]
fn the_verb_is_one_of_three() {
    for verb in ["sees", "gets", "is refused"] {
        assert!(validate(&spoiled("verb", json!(verb))).is_none(), "{verb}");
    }
    for verb in ["receives", "Gets", "gets ", "is accepted"] {
        let answer = refusal(validate(&spoiled("verb", json!(verb))));
        assert_eq!(answer["rule"], "allowed-verb", "{verb}");
    }
}

#[test]
fn the_kind_is_literal_or_property() {
    for kind in ["literal", "property"] {
        assert!(validate(&spoiled("kind", json!(kind))).is_none(), "{kind}");
    }
    let answer = refusal(validate(&spoiled("kind", json!("behavioural"))));
    assert_eq!(answer["rule"], "allowed-kind");
}

// Two separate attestations, and neither is implied by approval or by the
// other. Anything other than a literal true is not an attestation.
#[test]
fn the_owner_attests_observability_and_a_fixed_oracle_separately() {
    for (slot, rule) in [("observable", "unobservable"), ("fixed_oracle", "prose-oracle")] {
        for absent in [json!(false), json!(null), json!("true"), json!(1)] {
            let answer = refusal(validate(&spoiled(slot, absent.clone())));
            assert_eq!(answer["rule"], rule, "{slot} {absent}");
            assert_eq!(answer["slot"], slot);
        }
    }
}

// The refusal names which truth, so an owner with seven of them knows where to
// look.
#[test]
fn a_refusal_names_the_offending_truth_by_position_and_id() {
    let mut second = truth("truth/B");
    second["verb"] = json!("receives");
    let answer = refusal(validate(&context(vec![truth("truth/A"), second])));
    assert_eq!(answer["entry"], 1);
    assert_eq!(answer["id"], "truth/B");
}

// An approval bound by digest carries no submission to check, and the digest
// is what binds it.
#[test]
fn an_approval_bound_by_digest_alone_has_nothing_to_validate() {
    assert!(validate(&json!({"approval": {"submission_digest": "abc123"}})).is_none());
    assert!(validate(&json!({"approval": {"submission_digest": ""}})).is_some());
}

fn submission(truths: &[&str], durable: &[&str], decisions: &[&str]) -> Submission {
    let decision = |id: &str| json!({"id": id, "text": "Settled."});
    serde_json::from_value(json!({
        "phase": 12, "title": "Delivery", "scope": "Approved delivery.", "assumptions": [],
        "durable_decisions": durable.iter().map(|id| decision(id)).collect::<Vec<_>>(),
        "decisions": decisions.iter().map(|id| decision(id)).collect::<Vec<_>>(),
        "truths": truths.iter().map(|id| truth(id)).collect::<Vec<_>>(),
    })).expect("a submission")
}

#[test]
fn distinct_identities_across_truths_and_decisions_are_accepted() {
    assert!(identities(&submission(&["truth/A"], &["D-1"], &["D-2"]), None).is_none());
}

// One namespace: a decision cannot take a truth's id, in either direction.
#[test]
fn an_identity_used_twice_in_one_submission_is_refused() {
    for (truths, durable, decisions) in [
        (vec!["truth/A", "truth/A"], vec![], vec![]),
        (vec!["truth/A"], vec!["truth/A"], vec![]),
        (vec!["truth/A"], vec![], vec!["truth/A"]),
        (vec![], vec!["D-1"], vec!["D-1"]),
    ] {
        let answer = refusal(identities(&submission(&truths, &durable, &decisions), None));
        assert_eq!(answer["rule"], "identity-collision", "{truths:?} {durable:?} {decisions:?}");
    }
}

// An extension cannot reuse an identity the approved context already spent,
// or two different things would answer to one name in the same phase.
#[test]
fn an_identity_already_approved_in_this_phase_cannot_be_reused() {
    let approved: ApprovedContext = serde_json::from_value(json!({
        "submission": serde_json::to_value(submission(&["truth/A"], &["D-1"], &[])).unwrap(),
        "approval": {"approved": true, "owner": "Fixture Owner", "at": "2026-09-22T14:00:00Z",
            "submission": serde_json::to_value(submission(&["truth/A"], &["D-1"], &[])).unwrap(),
            "submission_digest": null},
        "truths": [],
    })).expect("an approved context");

    assert!(identities(&submission(&["truth/B"], &[], &["D-2"]), Some(&approved)).is_none());
    assert_eq!(refusal(identities(&submission(&["truth/A"], &[], &[]), Some(&approved)))["rule"], "identity-collision");
    assert_eq!(refusal(identities(&submission(&["truth/B"], &["D-1"], &[]), Some(&approved)))["rule"], "identity-collision");
}

#[test]
fn a_blank_identity_is_refused_before_any_collision() {
    let answer = refusal(identities(&submission(&["   "], &[], &[]), None));
    assert_eq!(answer["rule"], "required-slot");
    assert_eq!(answer["slot"], "truths.id");
}
