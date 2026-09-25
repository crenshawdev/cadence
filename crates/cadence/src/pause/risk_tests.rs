//! The questions a pause risk review asks, and what counts as this fire's
//! contracted review. Values in, values out.
use super::risk::{
    CONTRACT, CommitKind, Fire, Finding, Review, Severity, disposition_question, surfaces_question,
};
use crate::evidence::{Scope, results::AcceptedResult};
use crate::rail::{risk_diff::Scan, surfaces};

fn fire(id: &str, round: u32) -> Fire {
    Fire {
        id: id.into(),
        commit_kind: CommitKind::Wip,
        round,
        base: "1".repeat(40),
        staged: true,
        head_id: None,
        index_id: "2".repeat(40),
        scope: vec!["src/db.rs".into()],
        authored: vec!["src/db.rs".into()],
        scan: Scan { checked: true, categories: vec!["destructive".into()], matches: vec![], inconclusive: false, empty: false },
    }
}

fn review(fire: Fire) -> Review {
    Review {
        version: 1,
        fire,
        finding_record: "finding-record-1".into(),
        findings: vec![Finding {
            number: 1,
            severity: Severity::High,
            file: "src/db.rs".into(),
            line: 4,
            claim: "drops a table".into(),
            fix: "keep the table".into(),
        }],
    }
}

fn result(review: &Review) -> AcceptedResult {
    AcceptedResult {
        id: review.fire.id.clone(),
        contract: CONTRACT.into(),
        result: "reviewed".into(),
        evidence_text: serde_json::to_string(review).unwrap(),
        references: vec![],
        checker_id: None,
    }
}

fn options(gate: &crate::evidence::gates::Gate) -> Vec<&str> {
    gate.options.iter().map(|option| option.id.as_str()).collect()
}

#[test]
fn a_first_round_review_offers_fix_override_or_abort() {
    assert_eq!(options(&disposition_question(&review(fire("f", 1)))), ["fix", "override", "abort"]);
}

#[test]
fn after_the_one_rearm_fix_is_no_longer_offered() {
    let gate = disposition_question(&review(fire("f", 2)));
    assert_eq!(options(&gate), ["override", "abort"]);
    assert!(gate.need.contains("re-arm is spent"), "{}", gate.need);
}

// The question is the fire's: asking again about the same fire is the same
// question, and another fire gets its own.
#[test]
fn the_disposition_question_is_named_by_its_fire() {
    let first = disposition_question(&review(fire("f", 2)));
    assert_eq!(first, disposition_question(&review(fire("f", 2))));
    assert_ne!(first.id, disposition_question(&review(fire("g", 2))).id);
}

#[test]
fn the_surfaces_question_offers_all_then_each_detected_set_then_choose_or_abort() {
    let report = surfaces::Report {
        root: "/project".into(),
        manifests: vec![],
        evidenced: vec![],
        silent: vec!["billing".into()],
        unspeakable: vec!["destructive".into()],
        inconclusive: false,
        recommended: vec!["auth".into(), "migrations".into()],
        options: vec![
            surfaces::Choice { surfaces: vec!["auth".into(), "migrations".into()], reason: "detected".into() },
            surfaces::Choice { surfaces: vec!["auth".into()], reason: "narrower".into() },
        ],
        warnings: vec![],
    };
    let scope = Scope {
        project: "/project".into(),
        planning_root: "/project/.planning".into(),
        cycle: "cycle".into(),
        occurrence: "pause-1".into(),
        phase: "1".into(),
        plan: "PLAN.md".into(),
        report: "reports/plan-1.md".into(),
    };
    let gate = surfaces_question(&scope, &report).unwrap();
    assert_eq!(options(&gate), ["all", "surfaces:auth", "choose", "abort"]);
    assert!(gate.need.contains("Silent: billing") && gate.need.contains("unspeakable: destructive"), "{}", gate.need);
}

#[test]
fn this_fires_contracted_review_parses() {
    let review = review(fire("f", 1));
    assert_eq!(Review::parse(&result(&review), &review.fire), Ok(review));
}

#[test]
fn a_result_that_is_not_this_fires_contracted_review_is_unusable() {
    let review = review(fire("f", 1));
    let mut other_contract = result(&review);
    other_contract.contract = "cadence.other.v1".into();
    let mut not_reviewed = result(&review);
    not_reviewed.result = "accepted".into();
    let mut not_a_review = result(&review);
    not_a_review.evidence_text = "{\"findings\":[]}".into();
    let mut other_fire = result(&review);
    other_fire.evidence_text = serde_json::to_string(&Review { fire: fire("f", 2), ..review.clone() }).unwrap();
    for (name, recorded) in [
        ("contract", other_contract),
        ("result", not_reviewed),
        ("evidence", not_a_review),
        ("fire", other_fire),
    ] {
        assert!(Review::parse(&recorded, &review.fire).is_err(), "{name}");
    }
}
