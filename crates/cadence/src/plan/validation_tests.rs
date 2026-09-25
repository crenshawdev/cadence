//! What a plan submission may and may not carry.
//!
//! These rules run before anything is parsed or written, and they take a raw
//! request or a typed submission and nothing else. So each check states a
//! request and reads the refusal; there is no store, no path and no process
//! anywhere in them.
use super::inventory::phase_address;
use super::validation::{arguments, identities, typed_content};
use serde_json::{Value, json};

fn refusal(answer: Option<crate::plan::model::Answer>) -> Value {
    serde_json::to_value(answer.expect("a refusal")).expect("a refusal envelope")
}

fn submission(plans: Value) -> Value {
    json!({"submission": {"phase": 12, "plans": plans}})
}

// The binary renders the plan document from typed pieces. A caller that sends
// prose or a derived execution block is asking to author what the binary owns.
#[test]
fn a_caller_authored_body_is_refused_at_its_own_slot() {
    let answer = refusal(typed_content(&submission(json!([{"content": {"body": "# Plan\n"}}]))));
    assert_eq!(answer["slot"], "submission.plans[0].content.body");
    assert_eq!(answer["phase"], 12);
    assert_eq!(answer["entry"], 0);
}

#[test]
fn a_caller_authored_execution_block_is_refused() {
    let answer = refusal(typed_content(&submission(json!([{"content": {"execution": {"suite": "cargo test"}}}]))));
    assert_eq!(answer["slot"], "submission.plans[0].content.execution");
}

// A task cannot lease a path the plan never declared, or the lease would say
// one thing and the tasks another.
#[test]
fn a_task_path_outside_the_plans_declared_files_is_refused() {
    let answer = refusal(typed_content(&submission(json!([{"content": {
        "files": ["src/delivery.rs"],
        "tasks": [{"id": "deliver", "files": ["src/delivery.rs"]}, {"id": "record", "files": ["src/receipt.rs"]}],
    }}]))));
    assert_eq!(answer["slot"], "submission.plans[0].content.tasks[1].files[0]");
}

#[test]
fn task_paths_that_are_all_declared_pass() {
    assert!(typed_content(&submission(json!([{"content": {
        "files": ["src/delivery.rs", "src/receipt.rs"],
        "tasks": [{"id": "deliver", "files": ["src/delivery.rs", "src/receipt.rs"]}],
    }}]))).is_none());
}

#[test]
fn a_plan_with_no_tasks_or_files_has_nothing_to_refuse() {
    assert!(typed_content(&submission(json!([{"content": {"phase": 12, "plan": 1}}]))).is_none());
    assert!(typed_content(&json!({"submission": {"phase": 12}})).is_none());
}

// The publication path comes from the bound phase and plan number. A caller
// naming a destination is trying to write somewhere the binding does not
// reach, so the field is refused rather than ignored.
#[test]
fn a_destination_field_anywhere_in_the_request_is_refused() {
    for field in ["destination", "path", "target_path", "project_root", "root"] {
        let answer = refusal(arguments(&json!({field: "/etc/passwd"})));
        assert_eq!(answer["rule"], "path-confinement", "{field}");
        assert!(answer["reason"].as_str().unwrap().contains(field), "{field}");
    }
}

#[test]
fn a_destination_field_on_the_submission_or_a_plan_or_its_target_is_refused() {
    assert!(arguments(&json!({"submission": {"path": "elsewhere"}})).is_some());
    assert!(arguments(&submission(json!([{"root": "/tmp"}]))).is_some());
    assert!(arguments(&submission(json!([{"target": {"destination": "/tmp"}}]))).is_some());
}

// Authored text is not a destination. The rule looks only at the positions
// that could carry one, so a plan may write the word in its own prose.
#[test]
fn the_same_word_inside_authored_content_is_not_a_destination() {
    assert!(arguments(&submission(json!([{"content": {"path": "src/delivery.rs"}}]))).is_none());
    assert!(arguments(&json!({"submission": {"phase": 12, "plans": []}})).is_none());
}

// A plan says which phase and plan it is in three places, and all three have
// to agree or the publication would land somewhere its author did not mean.
#[test]
fn the_content_the_target_and_the_binding_must_name_the_same_plan() {
    let agreeing = |phase: u32, plan: u32, target_phase: u32, target_plan: u32| {
        serde_json::from_value::<super::model::Submission>(json!({
            "phase": 12, "occurrence": "active-cycle:phase:12", "request_id": "publish",
            "inventory_basis": "basis",
            "plans": [{"target": {"phase": target_phase, "plan": target_plan},
                "content": {"phase": phase, "plan": plan, "requirements": [], "files": [], "directories": [],
                    "suite": "cargo nextest run", "tasks": [], "evidence_map": {"mode": "provisional"}}}],
        })).expect("a submission")
    };
    assert!(identities(&agreeing(12, 1, 12, 1)).is_none());
    assert!(identities(&agreeing(13, 1, 12, 1)).is_some(), "content names another phase");
    assert!(identities(&agreeing(12, 2, 12, 1)).is_some(), "content names another plan");
    assert!(identities(&agreeing(11, 1, 11, 1)).is_some(), "both name a phase the binding does not");
}

// A phase address is the integer every operation takes, or the dotted form of
// a legacy directory such as phases/27.1 that only plan-read can reach.
#[test]
fn a_phase_address_is_digits_or_dotted_digits() {
    for address in ["12", "27.1", "4.0.0", "0"] {
        assert!(phase_address(address), "{address}");
    }
}

#[test]
fn anything_else_is_not_a_phase_address() {
    for address in ["", ".", "12.", ".12", "12..1", "12a", "phase-12", "-1", "1 2", "١٢"] {
        assert!(!phase_address(address), "{address:?}");
    }
}
