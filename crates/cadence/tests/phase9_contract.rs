#[allow(dead_code)]
#[path = "../src/review/contract.rs"]
mod contract;
#[allow(dead_code)]
#[path = "../src/review/io.rs"]
mod io;
#[allow(dead_code)]
#[path = "../src/review/model.rs"]
mod model;

use contract::{classify_return, validate_findings};
use serde_json::{Value, json};
fn shapes(name: &str) -> Option<String> {
    let fixture: Value =
        serde_json::from_str(include_str!("fixtures/phase9/h4-shapes.json")).unwrap();
    fixture[name].as_str().map(str::to_owned)
}
#[test]
fn envelope_missing_return_ac27() {
    let missing = shapes("missing");
    assert_eq!(
        serde_json::to_value(classify_return(missing.as_deref().map(str::as_bytes))).unwrap(),
        json!({"state":"failed","reason":"missing-return"})
    );
}
#[test]
fn envelope_malformed_return_ac28() {
    let malformed = shapes("malformed").unwrap();
    assert_eq!(
        serde_json::to_value(classify_return(Some(malformed.as_bytes()))).unwrap(),
        json!({"state":"failed","reason":"malformed-return"})
    );
}
#[test]
fn envelope_empty_ac84() {
    let empty = shapes("empty").unwrap();
    assert_eq!(
        serde_json::to_value(validate_findings(empty.as_bytes()).unwrap()).unwrap(),
        json!({"findings":[]})
    );
}
#[test]
fn envelope_hundred_ac85() {
    let hundred = shapes("hundred").unwrap();
    assert_eq!(
        validate_findings(hundred.as_bytes())
            .unwrap()
            .findings
            .len(),
        100
    );
}
macro_rules! envelope_error {
    ($name:ident, $input:literal, $expected:expr) => {
        #[test]
        fn $name() {
            let input = shapes($input).unwrap();
            assert_eq!(
                serde_json::to_value(validate_findings(input.as_bytes()).unwrap_err()).unwrap(),
                $expected
            );
        }
    };
}
envelope_error!(
    envelope_excess_ac103,
    "excess",
    json!({"code":"too-many-findings","limit":100,"actual":101})
);
envelope_error!(
    envelope_extra_ac104,
    "extra_envelope",
    json!({"code":"unknown-field","field":"extra"})
);
envelope_error!(
    envelope_fix_ac105,
    "extra_finding",
    json!({"code":"unknown-field","index":0,"field":"fix"})
);
envelope_error!(
    envelope_severity_ac116,
    "critical",
    json!({"code":"invalid-severity","index":0,"field":"severity","actual":"critical"})
);
envelope_error!(
    envelope_scenario_ac117,
    "missing_scenario",
    json!({"code":"missing-field","index":0,"field":"failure_scenario"})
);
macro_rules! envelope_severity {
    ($name:ident, $input:literal, $expected:literal) => {
        #[test]
        fn $name() {
            let input = shapes($input).unwrap();
            assert_eq!(
                serde_json::to_value(
                    &validate_findings(input.as_bytes()).unwrap().findings[0].severity
                )
                .unwrap(),
                json!($expected)
            );
        }
    };
}
envelope_severity!(envelope_blocker_ac112, "blocker", "blocker");
envelope_severity!(envelope_high_ac113, "high", "high");
envelope_severity!(envelope_medium_ac114, "medium", "medium");
envelope_severity!(envelope_low_ac115, "low", "low");
