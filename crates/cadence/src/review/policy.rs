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

use super::model::{DeliveryState, Settlement};

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum GateAction {
    Off,
    WaitForDelivery,
    Continue,
    EnqueueBeforeContinuation,
    WaitForSettlement,
}

/// Accepted here means durably accepted. Severity and combination do not
/// change delivery permission; settlement is a separate gate decision.
pub fn delivery_permission(delivery: &DeliveryState) -> GateAction {
    match delivery {
        DeliveryState::Accepted | DeliveryState::AcceptedEmpty | DeliveryState::UsableComplete => {
            GateAction::Continue
        }
        _ => GateAction::WaitForDelivery,
    }
}

pub fn ordinary_gate_action(
    gate: &Gate,
    delivery: &DeliveryState,
    settlement: &Settlement,
) -> GateAction {
    if *gate == Gate::Off {
        return GateAction::Off;
    }
    if delivery_permission(delivery) == GateAction::WaitForDelivery {
        return GateAction::WaitForDelivery;
    }
    match gate {
        Gate::Off => GateAction::Off,
        Gate::Advisory => GateAction::Continue,
        Gate::Deferred => GateAction::EnqueueBeforeContinuation,
        Gate::Blocking | Gate::Adjudicated => {
            if *settlement == Settlement::Verified {
                GateAction::Continue
            } else {
                GateAction::WaitForSettlement
            }
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DetectorObservation {
    Match,
    Nonmatch,
    Inconclusive,
    Unanswered,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum RiskAction {
    Dispatch,
    NoReview,
    WaitForEvidence,
    AskSurfaces,
}

pub fn risk_review_action(gate: &Gate, observation: &DetectorObservation) -> RiskAction {
    if *gate == Gate::Off {
        return RiskAction::NoReview;
    }
    match observation {
        DetectorObservation::Match => RiskAction::Dispatch,
        DetectorObservation::Nonmatch => RiskAction::NoReview,
        DetectorObservation::Inconclusive => RiskAction::WaitForEvidence,
        DetectorObservation::Unanswered => RiskAction::AskSurfaces,
    }
}

/// Only an independently supplied settlement can change this state. Delivery
/// is deliberately not evidence for a transition to Verified.
pub fn settlement_state(settlement: Option<&Settlement>) -> Settlement {
    settlement.cloned().unwrap_or(Settlement::Pending)
}
