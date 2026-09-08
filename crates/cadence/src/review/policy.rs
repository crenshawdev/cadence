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

/// These flags come from the saved-record confirmation boundary, not tool input.
pub struct RiskEvidence<'a> {
    pub observation: &'a cadence::rail::risk::Observation,
    pub confirmed: bool,
    pub current: bool,
}

pub fn detector_observation(
    scope: &cadence::rail::risk::Scope,
    material: &cadence::rail::risk::MaterialIdentity,
    surfaces: Option<&[String]>,
    evidence: Option<RiskEvidence<'_>>,
) -> Result<DetectorObservation, &'static str> {
    let Some(surfaces) = surfaces else {
        return Ok(DetectorObservation::Unanswered);
    };
    let Some(evidence) = evidence else {
        return Ok(DetectorObservation::Inconclusive);
    };
    let observation = evidence.observation;
    if observation.scope != *scope || observation.resolution.material().as_ref() != Some(material) {
        return Err("foreign-risk-evidence");
    }
    if observation.surfaces != surfaces || !evidence.confirmed || !evidence.current {
        return Ok(DetectorObservation::Inconclusive);
    }
    match &observation.scan {
        Some(scan)
            if observation.outcome == cadence::rail::risk::ObservationOutcome::Checked
                && scan.checked
                && !scan.inconclusive
                && scan.categories == surfaces =>
        {
            Ok(if scan.matches.is_empty() {
                DetectorObservation::Nonmatch
            } else {
                DetectorObservation::Match
            })
        }
        _ => Ok(DetectorObservation::Inconclusive),
    }
}

#[derive(Debug, Serialize)]
pub struct AdmissionPolicyDecision {
    pub action: RiskAction,
    pub gate: Option<Gate>,
    pub fire: Option<String>,
    pub dispatch: Option<String>,
}

pub fn admission_policy(
    trigger: Option<&OrdinaryTrigger>,
    gate: Option<&Gate>,
    observation: Option<&DetectorObservation>,
) -> AdmissionPolicyDecision {
    let action = match (trigger, gate) {
        (_, Some(Gate::Off)) => RiskAction::NoReview,
        (Some(OrdinaryTrigger::RiskSurface), Some(gate)) => risk_review_action(
            gate,
            observation.unwrap_or(&DetectorObservation::Inconclusive),
        ),
        _ => RiskAction::Dispatch,
    };
    AdmissionPolicyDecision {
        action,
        gate: gate.cloned(),
        fire: None,
        dispatch: None,
    }
}

#[cfg(test)]
mod gap154_tests {
    use super::*;
    use cadence::rail::{risk, risk_diff};
    use serde_json::json;
    fn observation() -> risk::Observation {
        risk::Observation {
            version: 1,
            request_id: "scan1".into(),
            request_digest: "d".repeat(64),
            scope: risk::Scope {
                project: "p1".into(),
                planning_root: "p1/.planning".into(),
                cycle: "live".into(),
                occurrence: "scope1".into(),
                phase: 1.try_into().unwrap(),
                worker: None,
                plan: None,
            },
            source: risk::Source::Committed {
                base: "b1".into(),
                head: "h1".into(),
            },
            resolution: risk::Resolution::Committed {
                base_id: Some("b1".into()),
                head_id: Some("h1".into()),
            },
            outcome: risk::ObservationOutcome::Checked,
            surfaces: vec!["secrets".into()],
            diagnostics: vec![],
            scan: Some(risk_diff::Scan {
                checked: true,
                categories: vec!["secrets".into()],
                matches: vec![],
                inconclusive: false,
                empty: false,
            }),
        }
    }
    #[test]
    fn gap154_conversion_maps_authoritative_observations() {
        let base = observation();
        let material = risk::MaterialIdentity::Committed {
            base_id: "b1".into(),
            head_id: "h1".into(),
        };
        for (matched, inconclusive, confirmed, expected) in [
            (true, false, true, "match"),
            (false, false, true, "nonmatch"),
            (false, true, true, "inconclusive"),
            (false, false, false, "inconclusive"),
        ] {
            let mut obs = observation();
            let scan = obs.scan.as_mut().unwrap();
            scan.inconclusive = inconclusive;
            if matched {
                scan.matches.push(risk_diff::Match {
                    category: "secrets".into(),
                    signal: "fixture".into(),
                });
            }
            let result = detector_observation(
                &base.scope,
                &material,
                Some(&base.surfaces),
                Some(RiskEvidence {
                    observation: &obs,
                    confirmed,
                    current: true,
                }),
            )
            .unwrap();
            assert_eq!(serde_json::to_value(result).unwrap(), expected);
        }
        assert_eq!(
            detector_observation(&base.scope, &material, Some(&base.surfaces), None).unwrap(),
            DetectorObservation::Inconclusive
        );
        assert_eq!(
            detector_observation(&base.scope, &material, None, None).unwrap(),
            DetectorObservation::Unanswered
        );
    }
    #[test]
    fn gap154_foreign_and_stale_evidence_cannot_claim_clean() {
        let base = observation();
        let material = risk::MaterialIdentity::Committed {
            base_id: "b1".into(),
            head_id: "h1".into(),
        };
        let mut foreign = observation();
        foreign.scope.occurrence = "foreign".into();
        assert_eq!(
            detector_observation(
                &base.scope,
                &material,
                Some(&base.surfaces),
                Some(RiskEvidence {
                    observation: &foreign,
                    confirmed: true,
                    current: true
                })
            )
            .unwrap_err(),
            "foreign-risk-evidence"
        );
        let mut foreign = observation();
        foreign.resolution = risk::Resolution::Committed {
            base_id: Some("other".into()),
            head_id: Some("h1".into()),
        };
        assert_eq!(
            detector_observation(
                &base.scope,
                &material,
                Some(&base.surfaces),
                Some(RiskEvidence {
                    observation: &foreign,
                    confirmed: true,
                    current: true
                })
            )
            .unwrap_err(),
            "foreign-risk-evidence"
        );
        assert_eq!(
            detector_observation(
                &base.scope,
                &material,
                Some(&base.surfaces),
                Some(RiskEvidence {
                    observation: &base,
                    confirmed: true,
                    current: false
                })
            )
            .unwrap(),
            DetectorObservation::Inconclusive
        );
    }
    #[test]
    fn gap154_admission_policy_keeps_non_dispatch_arms_empty() {
        for (observation, expected) in [
            (DetectorObservation::Match, "dispatch"),
            (DetectorObservation::Nonmatch, "no-review"),
            (DetectorObservation::Inconclusive, "wait-for-evidence"),
            (DetectorObservation::Unanswered, "ask-surfaces"),
        ] {
            let decision = admission_policy(
                Some(&OrdinaryTrigger::RiskSurface),
                Some(&Gate::Blocking),
                Some(&observation),
            );
            assert_eq!(
                serde_json::to_value(decision).unwrap(),
                json!({"action":expected,"gate":"blocking","fire":null,"dispatch":null})
            );
        }
        assert_eq!(
            admission_policy(
                Some(&OrdinaryTrigger::RiskSurface),
                Some(&Gate::Off),
                Some(&DetectorObservation::Match)
            )
            .action,
            RiskAction::NoReview
        );
    }
}
