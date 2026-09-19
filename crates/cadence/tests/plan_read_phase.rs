//! `plan-read` takes `phase` like every other operation.
//!
//! It was the one operation with `phase_address: String`, because it can read
//! a decimal legacy phase directory such as `phases/27.1` that nothing else
//! addresses. The capability stays; the field is `phase`, and it accepts an
//! integer or a dotted-decimal string.

#[path = "support/phase13.rs"]
#[allow(dead_code)]
mod phase13;
use phase13::*;
use serde_json::json;
use std::fs;

#[test]
fn plan_read_takes_an_integer_phase() {
    let project = fixture();
    let answer = query(project.path(), json!({"operation":"plan-read","phase":13}));
    assert_eq!(answer["status"], "ok", "{answer}");
    assert!(answer["inventory"].is_object(), "{answer}");
}

#[test]
fn plan_read_takes_a_decimal_legacy_address_as_a_string() {
    let project = fixture();
    let legacy = project.path().join(".planning/phases/13.1");
    fs::create_dir_all(&legacy).unwrap();
    fs::write(legacy.join("PLAN-70.md"), "Decimal legacy\n").unwrap();
    let answer = query(project.path(), json!({"operation":"plan-read","phase":"13.1"}));
    assert_eq!(answer["status"], "ok", "{answer}");
    assert_eq!(answer["inventory"]["occupied"], json!([70]), "{answer}");
    assert!(answer["occurrence"].is_null(), "a legacy address has no native cycle: {answer}");
}

#[test]
fn a_plan_entry_does_not_echo_the_phase_it_was_asked_for() {
    let project = fixture();
    let legacy = project.path().join(".planning/phases/13.1");
    fs::create_dir_all(&legacy).unwrap();
    fs::write(legacy.join("PLAN-70.md"), "Decimal legacy\n").unwrap();
    let answer = query(project.path(), json!({"operation":"plan-read","phase":"13.1"}));
    let plans = answer["plans"].as_array().unwrap_or_else(|| panic!("{answer}"));
    assert_eq!(plans.len(), 1, "{answer}");
    assert!(plans[0].get("phase_address").is_none(), "the caller named the phase: {answer}");
    assert_eq!(plans[0]["classification"], "legacy-input", "{answer}");
}

#[test]
fn phase_address_is_no_longer_a_field() {
    let project = fixture();
    let answer = query(project.path(), json!({"operation":"plan-read","phase_address":"13"}));
    assert_eq!(answer["status"], "refused", "{answer}");
    assert_eq!(answer["code"], "invalid-plan", "{answer}");
    assert!(answer["reason"].as_str().unwrap().contains("phase_address"), "{answer}");
}
