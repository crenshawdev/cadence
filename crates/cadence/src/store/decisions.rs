use super::model::{Decision, DecisionRecord, Evidence};
use serde_json::Value;

pub fn normalize_effort(evidence: Evidence) -> Evidence {
    match evidence {
        Evidence::Text(text) if text.trim().is_empty() => Evidence::Missing,
        evidence => evidence,
    }
}

/// The live writer and import use exactly the same record-boundary rule.
/// Requested effort and absent receipts are never inferred from observations.
pub fn normalize(mut record: DecisionRecord) -> DecisionRecord {
    if let Decision::Routing {
        observed_effort, ..
    } = &mut record.decision
    {
        *observed_effort = normalize_effort(std::mem::take(observed_effort));
    }
    record
}

/// Worker facts may enrich an existing historical decision only with an agent
/// identity. This function cannot manufacture an observation-only log event.
pub fn historical_observed_effort(agent_id: Option<&str>, value: Option<&Value>) -> Evidence {
    if agent_id.is_none_or(|id| id.trim().is_empty()) {
        return Evidence::Missing;
    }
    normalize_effort(match value {
        Some(Value::String(text)) => Evidence::Text(text.clone()),
        Some(Value::Null) => Evidence::Null,
        _ => Evidence::Missing,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn observed_effort_preserves_unknown_evidence_but_omits_blank() {
        assert_eq!(
            normalize_effort(Evidence::Text(" \t\n".into())),
            Evidence::Missing
        );
        assert_eq!(
            normalize_effort(Evidence::Text(" host-ultra ".into())),
            Evidence::Text(" host-ultra ".into())
        );
    }

    #[test]
    fn historical_observed_effort_without_an_agent_identity_is_missing() {
        assert_eq!(
            historical_observed_effort(None, Some(&serde_json::json!("host-ultra"))),
            Evidence::Missing
        );
    }

    #[test]
    fn historical_observed_effort_with_an_agent_keeps_its_text_and_omits_blank_or_absent() {
        assert_eq!(
            historical_observed_effort(Some("agent-1"), Some(&serde_json::json!(" \n"))),
            Evidence::Missing
        );
        assert_eq!(
            historical_observed_effort(Some("agent-1"), Some(&serde_json::json!("host-ultra"))),
            Evidence::Text("host-ultra".into())
        );
        assert_eq!(
            historical_observed_effort(Some("agent-1"), None),
            Evidence::Missing
        );
    }
    fn routing(observed_effort: Evidence) -> DecisionRecord {
        DecisionRecord {
            version: super::super::model::VERSION,
            id: "route".into(),
            revision: 1,
            origin: super::super::model::Origin { source: "worker".into(), original: Evidence::Missing },
            decision: Decision::Routing {
                choice: "worker-a".into(),
                config_provenance: [("model".into(), Evidence::Text("user-global".into()))].into(),
                requested_effort: Evidence::Text("high".into()),
                observed_effort,
                receipt: Evidence::Missing,
            },
            at: Some(1),
        }
    }

    #[test]
    fn normalizing_a_routing_record_drops_only_a_blank_observed_effort() {
        assert_eq!(normalize(routing(Evidence::Text(" \t".into()))), routing(Evidence::Missing));
        let unknown = routing(Evidence::Text("host-experimental".into()));
        assert_eq!(normalize(unknown.clone()), unknown);
    }

    #[test]
    fn missing_evidence_is_left_off_the_wire_and_reads_back_missing() {
        let record = routing(Evidence::Missing);
        let wire = serde_json::to_value(&record).unwrap();
        assert!(wire["decision"].get("receipt").is_none(), "{wire}");
        assert!(wire["decision"].get("observed_effort").is_none(), "{wire}");
        assert_eq!(wire["decision"]["config_provenance"]["model"], serde_json::json!({"text": "user-global"}));
        assert_eq!(serde_json::from_value::<DecisionRecord>(wire).unwrap(), record);
    }

    #[test]
    fn activity_only_classes_are_not_decisions() {
        for class in [
            "read",
            "worker_start",
            "worker_stop",
            "cache",
            "tokens",
            "rotation",
            "observation",
        ] {
            let bytes = serde_json::json!({"class":class});
            assert!(serde_json::from_value::<Decision>(bytes).is_err());
        }
    }
}
