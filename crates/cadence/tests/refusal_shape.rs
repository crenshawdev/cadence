//! A refusal has one shape, and one constructor builds it.
//!
//! The binary-rendered skills tell every reader that a refusal carries
//! `status: refused`, `code`, `reason`, and the location fields. The read
//! layer, the verification verdicts, the native-execution admission and the
//! server's own argument parsing each wrote their refusals by hand, and four
//! field sets grew out of it. A caller had to know which subsystem answered
//! before it knew which field to read.

#[path = "support/phase13.rs"]
#[allow(dead_code)]
mod phase13;
use phase13::*;
use serde_json::{Value, json};
use std::fs;
use std::path::Path;

/// Every `"status":"refused"` written by hand in production source, as
/// `path:line`. Test modules and test files are skipped, the way the phase 7
/// lease test skips them when it counts `fn covers(`.
fn handwritten_refusals(root: &Path) -> Vec<String> {
    let mut sites = Vec::new();
    for entry in fs::read_dir(root).unwrap() {
        let path = entry.unwrap().path();
        if path.is_dir() {
            sites.extend(handwritten_refusals(&path));
            continue;
        }
        let name = path.file_name().unwrap().to_str().unwrap();
        if !name.ends_with(".rs") || name == "tests.rs" || name.ends_with("_tests.rs") {
            continue;
        }
        let source = fs::read_to_string(&path).unwrap();
        let lines: Vec<&str> = source.lines().collect();
        for (index, line) in lines.iter().enumerate() {
            // An inline test module ends the production part of a file. A
            // `#[cfg(test)] mod name;` declaration does not: the file goes on.
            let opens_test_module = line.trim() == "#[cfg(test)]"
                && lines.get(index + 1).is_some_and(|next| next.trim().starts_with("mod ") && next.trim().ends_with('{'));
            if opens_test_module {
                break;
            }
            if line.trim().starts_with("//") {
                continue;
            }
            if line.replace(' ', "").contains("\"status\":\"refused\"") {
                sites.push(format!("{}:{}", path.display(), index + 1));
            }
        }
    }
    sites
}

fn code_of(answer: &Value) -> &str {
    answer["code"].as_str().unwrap_or_else(|| panic!("no code in {answer}"))
}

#[test]
fn no_refusal_is_written_by_hand() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let sites = handwritten_refusals(&root);
    assert!(
        sites.is_empty(),
        "refusals built without cadence::envelope::Refusal:\n{}",
        sites.join("\n")
    );
}

#[test]
fn a_malformed_verification_patch_is_refused_with_a_code() {
    let project = fixture();
    let answer = apply(project.path(), json!({"operation":"verification-submit","patch":{}}));
    assert_eq!(answer["status"], "refused", "{answer}");
    assert_eq!(answer["rule"], "verification-shape", "{answer}");
    assert!(!code_of(&answer).is_empty(), "{answer}");
}

#[test]
fn a_zero_phase_history_query_is_refused_with_a_code() {
    let project = fixture();
    let answer = query(project.path(), json!({"operation":"execution-history","phase":0}));
    assert_eq!(answer["status"], "refused", "{answer}");
    assert_eq!(answer["rule"], "task-history-shape", "{answer}");
    assert!(!code_of(&answer).is_empty(), "{answer}");
}

#[test]
fn a_malformed_review_finding_names_its_indexed_field() {
    let project = fixture();
    let answer = apply(project.path(), json!({"operation":"review-return","identity":{},"citations":[],
        "findings":[{"file":"a.rs","line":1,"severity":"high","claim":"claim","failure_scenario":"failure"},
            {"file":"b.rs","line":2,"claim":"claim","failure_scenario":"failure"}]}));
    assert_eq!(answer["status"], "refused", "{answer}");
    assert_eq!(answer["code"], "invalid-return", "{answer}");
    assert_eq!(answer["rule"], "H4-1", "{answer}");
    assert_eq!(answer["slot"], "findings[1].severity", "{answer}");
    assert!(answer["reason"].as_str().unwrap().contains("severity"));
}

#[test]
fn a_verdict_refusal_carries_a_code() {
    let answer = cadence::verification::verdicts::refusal(
        "verification-basis", "basis", "", "current verification authority unavailable", json!(null), json!(null),
    );
    assert_eq!(answer["status"], "refused", "{answer}");
    assert_eq!(answer["rule"], "verification-basis", "{answer}");
    assert!(!code_of(&answer).is_empty(), "{answer}");
}
