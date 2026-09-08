//! Decisions over supplied, resolved policy. No configuration or home discovery.
use super::model::{Gate, Home, Routing, Selection, Specialist};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OrdinaryTrigger {
    Plan,
    Diff,
    RiskSurface,
}

/// The gate already includes the applicable phase-8 floor decision. Its
/// observation travels with the request; this adapter never reapplies a floor.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResolvedOrdinary {
    pub trigger: OrdinaryTrigger,
    pub gate: Gate,
    pub routing: Routing,
    pub selection: Selection,
    pub floor_elevated: bool,
    pub home: Home,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct OrdinaryRequest {
    pub caller: String,
    pub specialist: Option<Specialist>,
    #[serde(flatten)]
    pub policy: ResolvedOrdinary,
}

pub fn ordinary_request(caller: &str, policy: ResolvedOrdinary) -> OrdinaryRequest {
    OrdinaryRequest {
        caller: caller.into(),
        specialist: None,
        policy,
    }
}

pub fn manual_plan_request(policy: ResolvedOrdinary) -> OrdinaryRequest {
    ordinary_request("manual-plan", policy)
}
pub fn automatic_plan_request(policy: ResolvedOrdinary) -> OrdinaryRequest {
    ordinary_request("automatic-plan", policy)
}
pub fn task_review_request(policy: ResolvedOrdinary) -> OrdinaryRequest {
    ordinary_request("task", policy)
}
pub fn execute_review_request(policy: ResolvedOrdinary) -> OrdinaryRequest {
    ordinary_request("execute", policy)
}
pub fn debug_review_request(policy: ResolvedOrdinary) -> OrdinaryRequest {
    ordinary_request("debug", policy)
}
pub fn verify_review_request(policy: ResolvedOrdinary) -> OrdinaryRequest {
    ordinary_request("verify", policy)
}
