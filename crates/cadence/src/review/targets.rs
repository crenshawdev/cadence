//! Exact owned specialist payloads, to be retained as inline material alongside
//! the Plan-1 Target and its source-entry references. No document rereads.
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct DecisionMaterial {
    pub decision: String,
    pub text: String,
    pub context: String,
}

pub fn decision_review_target(decision: &str, text: &str, context: &str) -> DecisionMaterial {
    DecisionMaterial {
        decision: decision.into(),
        text: text.into(),
        context: context.into(),
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct DiagnosisMaterial {
    pub entries: Vec<String>,
    pub reported: String,
    pub cause: String,
}

pub fn diagnosis_target(entries: &[String], reported: &str, cause: &str) -> DiagnosisMaterial {
    DiagnosisMaterial {
        entries: entries.into(),
        reported: reported.into(),
        cause: cause.into(),
    }
}
