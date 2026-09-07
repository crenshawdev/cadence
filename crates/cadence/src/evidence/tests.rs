use super::*;
use checkpoint::{Checkpoint, CheckpointType, State};
use serde_json::json;

fn record(kind: CheckpointType) -> Record {
    Record {
        version: VERSION,
        scope: Scope {
            project: "/project".into(),
            planning_root: "/project/.planning".into(),
            cycle: "v4".into(),
            occurrence: "dispatch-1".into(),
            phase: "5".into(),
            plan: "phases/5/PLAN-1.md".into(),
            report: "phases/5/reports/plan-1.md".into(),
        },
        fact: Fact::Checkpoint(Checkpoint {
            id: "stop-1".into(),
            checkpoint_type: kind,
            task_number: 7,
            task_name: "  Réparer 日本語\t".into(),
            need: "\n  Need: ¿sí?\r\n\t保持  \n".into(),
            completed_work: vec!["60d94a5a".into()],
            state: State::Unresolved,
            failing_output: Some("reports/suite.log:17".into()),
        }),
    }
}

#[test]
fn checkpoint_round_trips_all_types_and_dispositions() {
    for kind in [
        CheckpointType::Structural,
        CheckpointType::HumanVerify,
        CheckpointType::Decision,
        CheckpointType::Blocked,
        CheckpointType::SuiteRed,
    ] {
        for state in [
            State::Unresolved,
            State::Resolved {
                resolution: "approved  \n".into(),
            },
            State::Superseded {
                by: "stop-2".into(),
            },
        ] {
            let mut value = record(kind.clone());
            let Fact::Checkpoint(checkpoint) = &mut value.fact else {
                panic!("checkpoint")
            };
            checkpoint.state = state;
            assert_eq!(
                checkpoint.requires_operator_answer(),
                kind != CheckpointType::SuiteRed
            );
            value.validate().unwrap();
            let decoded: Record =
                serde_json::from_value(serde_json::to_value(&value).unwrap()).unwrap();
            assert_eq!(decoded, value);
            assert_eq!(
                persistence::decode_history(&persistence::history("op", &value).unwrap()).unwrap(),
                Some(value)
            );
        }
    }
}

#[test]
fn checkpoint_rejects_missing_and_blank_routing_fields() {
    let original = serde_json::to_value(record(CheckpointType::SuiteRed)).unwrap();
    for field in ["version", "scope", "fact"] {
        let mut value = original.clone();
        value.as_object_mut().unwrap().remove(field);
        assert!(serde_json::from_value::<Record>(value).is_err(), "{field}");
    }
    for field in [
        "project",
        "planning_root",
        "cycle",
        "occurrence",
        "phase",
        "plan",
        "report",
    ] {
        let mut value = original.clone();
        value["scope"].as_object_mut().unwrap().remove(field);
        assert!(serde_json::from_value::<Record>(value).is_err(), "{field}");
        let mut value = original.clone();
        value["scope"][field] = json!(" \t");
        assert!(
            serde_json::from_value::<Record>(value)
                .unwrap()
                .validate()
                .is_err(),
            "{field}"
        );
    }
    for field in [
        "id",
        "checkpoint_type",
        "task_number",
        "task_name",
        "need",
        "state",
        "completed_work",
    ] {
        let mut value = original.clone();
        value["fact"]["value"]
            .as_object_mut()
            .unwrap()
            .remove(field);
        assert!(serde_json::from_value::<Record>(value).is_err(), "{field}");
    }
    for (field, bad) in [
        ("id", json!("")),
        ("task_name", json!(" ")),
        ("need", json!("\n")),
        ("task_number", json!(0)),
        ("failing_output", Value::Null),
    ] {
        let mut value = original.clone();
        value["fact"]["value"][field] = bad;
        assert!(
            serde_json::from_value::<Record>(value)
                .unwrap()
                .validate()
                .is_err(),
            "{field}"
        );
    }
    let mut bad = record(CheckpointType::Blocked);
    bad.version = 99;
    assert!(bad.validate().is_err());
}

use serde_json::Value;
#[test]
fn checkpoint_projection_preserves_namespaces_and_occurrences() {
    let seed = json!({"derivation":{"memo":"hash"}, "import":{"original":"bytes"}, "cursor":"raw", "arbitrary":[1,null," x "]});
    let first = record(CheckpointType::Blocked);
    let mut second = first.clone();
    second.scope.occurrence = "dispatch-2".into();
    let data =
        persistence::project(&persistence::project(&seed, &first).unwrap(), &second).unwrap();
    for (key, value) in seed.as_object().unwrap() {
        assert_eq!(&data[key], value);
    }
    let records = persistence::read(&data).unwrap();
    assert_eq!(records.len(), 2);
    assert_eq!(records[&first.key().unwrap()], first);
    assert_eq!(records[&second.key().unwrap()], second);
    assert!(persistence::read(&seed).unwrap().is_empty());
    let mut legacy = persistence::history("legacy", &first).unwrap();
    legacy.origin.source = "import".into();
    assert_eq!(persistence::decode_history(&legacy).unwrap(), None);
}

#[test]
fn review_receipt_counts_do_not_replace_finding_reference() {
    use overrides::*;
    let mut value = record(CheckpointType::Decision);
    value.fact = Fact::Override(Override {
        id: "range".into(),
        reason: "  exact reason\n".into(),
        authorization: Authorization::Invocation {
            id: "answer".into(),
            invocation: "accept this range".into(),
        },
        meaning: Meaning::Review(ReviewReceipt {
            base: "B".into(),
            head: "C".into(),
            trigger: "execute".into(),
            plan: Some(value.scope.plan.clone()),
            correlation: "run".into(),
            round: Some(1),
            anchor: None,
            finding_record: "ADJUDICATION.md:17".into(),
            settled: SettledCounts {
                survivors: 3,
                downgraded: 2,
                refuted: 1,
            },
        }),
    });
    let projected = persistence::project(&json!({"legacy":{"reason":null}}), &value).unwrap();
    assert_eq!(
        persistence::read(&projected).unwrap()[&value.key().unwrap()],
        value
    );
    assert_eq!(
        persistence::decode_history(&persistence::history("range", &value).unwrap()).unwrap(),
        Some(value.clone())
    );
    let Fact::Override(o) = &mut value.fact else {
        unreachable!()
    };
    let Meaning::Review(receipt) = &mut o.meaning else {
        unreachable!()
    };
    receipt.finding_record.clear();
    assert!(
        value.validate().is_err(),
        "counts alone cannot support native receipt"
    );
    assert!(persistence::project(&json!({}), &value).is_err());
}
