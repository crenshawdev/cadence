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
        assert_eq!(
            historical_observed_effort(None, Some(&serde_json::json!("host-ultra"))),
            Evidence::Missing
        );
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
