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

fn scalars(name: &str) -> String {
    let fixture: Value =
        serde_json::from_str(include_str!("fixtures/phase9/h4-scalars.json")).unwrap();
    let case = &fixture[name];
    let bytes = case["bytes"].as_str().unwrap();
    match case["count"].as_u64() {
        Some(count) => bytes.replace(
            "@TEXT@",
            &case["character"].as_str().unwrap().repeat(count as usize),
        ),
        None => bytes.to_owned(),
    }
}
macro_rules! scalar_accepted {
    ($name:ident, $input:literal) => {
        #[test]
        fn $name() {
            let input = scalars($input);
            assert_eq!(validate_findings(input.as_bytes()).map(|_| true), Ok(true));
        }
    };
}
scalar_accepted!(scalars_file_limit_ac86, "file_limit");
scalar_accepted!(scalars_claim_limit_ac90, "claim_limit");
scalar_accepted!(scalars_scenario_limit_ac94, "failure_scenario_limit");
macro_rules! scalar_error {
    ($name:ident, $input:literal, $expected:expr) => {
        #[test]
        fn $name() {
            let input = scalars($input);
            assert_eq!(
                serde_json::to_value(validate_findings(input.as_bytes()).unwrap_err()).unwrap(),
                $expected
            );
        }
    };
}
scalar_error!(
    scalars_file_excess_ac87,
    "file_excess",
    json!({"code":"field-too-long","index":0,"field":"file","limit":1024})
);
scalar_error!(
    scalars_file_empty_ac88,
    "file_empty",
    json!({"code":"blank-field","index":0,"field":"file"})
);
scalar_error!(
    scalars_file_whitespace_ac89,
    "file_whitespace",
    json!({"code":"blank-field","index":0,"field":"file"})
);
scalar_error!(
    scalars_claim_excess_ac91,
    "claim_excess",
    json!({"code":"field-too-long","index":0,"field":"claim","limit":2000})
);
scalar_error!(
    scalars_claim_empty_ac92,
    "claim_empty",
    json!({"code":"blank-field","index":0,"field":"claim"})
);
scalar_error!(
    scalars_claim_whitespace_ac93,
    "claim_whitespace",
    json!({"code":"blank-field","index":0,"field":"claim"})
);
scalar_error!(
    scalars_scenario_excess_ac95,
    "failure_scenario_excess",
    json!({"code":"field-too-long","index":0,"field":"failure_scenario","limit":2000})
);
scalar_error!(
    scalars_scenario_empty_ac96,
    "failure_scenario_empty",
    json!({"code":"blank-field","index":0,"field":"failure_scenario"})
);
scalar_error!(
    scalars_scenario_whitespace_ac97,
    "failure_scenario_whitespace",
    json!({"code":"blank-field","index":0,"field":"failure_scenario"})
);
scalar_error!(
    scalars_line_zero_ac100,
    "line_zero",
    json!({"code":"invalid-line","index":0,"field":"line","min":1,"max":9007199254740991_u64})
);
scalar_error!(
    scalars_line_fraction_ac101,
    "line_fraction",
    json!({"code":"invalid-line","index":0,"field":"line","min":1,"max":9007199254740991_u64})
);
scalar_error!(
    scalars_line_excess_ac102,
    "line_excess",
    json!({"code":"invalid-line","index":0,"field":"line","min":1,"max":9007199254740991_u64})
);
scalar_error!(
    scalars_lone_surrogate_ac106,
    "surrogate",
    json!({"code":"invalid-unicode-scalar","index":0,"field":"claim"})
);
#[test]
fn scalars_line_one_ac98() {
    let input = scalars("line_one");
    assert_eq!(
        validate_findings(input.as_bytes()).unwrap().findings[0].line,
        1
    );
}
#[test]
fn scalars_line_max_ac99() {
    let input = scalars("line_max");
    assert_eq!(
        validate_findings(input.as_bytes()).unwrap().findings[0].line,
        9007199254740991
    );
}
