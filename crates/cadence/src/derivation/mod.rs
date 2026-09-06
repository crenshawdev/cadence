//! Captured artifact evidence and synchronous lifecycle derivation.
mod capture;
mod compatibility;
mod consistency;
mod intake;
mod model;
mod parse;
mod query;
pub use capture::{ArtifactFiles, ArtifactIo, capture_inputs};
pub use compatibility::{normalize_imported_cursor, normalize_legacy_state};
pub use consistency::{check_consistency, recheck_intake};
pub use intake::{adopt, select_intake};
pub use model::*;
pub use parse::{parse_roadmap, parse_uat};
pub use query::{
    IntakeIo, PreparedLifecycle, RecheckedLifecycle, prepare_query, prepare_query_with_intake,
    query, query_with_intake, recheck_query, recheck_query_with_intake,
};

fn validate_observation_failures(capture: &CapturedInputs) -> Result<(), DerivationError> {
    fn check<T>(observation: &Observation<T>) -> Result<(), DerivationError> {
        if let Observation::Failed(error) = observation {
            return Err(DerivationError::InputFailure(error.clone()));
        }
        Ok(())
    }
    check(&capture.root_probe)?;
    check(&capture.roadmap)?;
    for phase in &capture.phases {
        check(&phase.plans)?;
        check(&phase.summary)?;
        check(&phase.uat)?;
    }
    Ok(())
}

/// Availability is checked before interpreting any evidence as lifecycle state.
pub(crate) fn validate_inputs(capture: &CapturedInputs) -> Result<&ParsedRoadmap, DerivationError> {
    validate_observation_failures(capture)?;
    if matches!(capture.root_probe, Observation::Absent) {
        return Err(DerivationError::MissingPlanningRoot {
            path: capture.root.clone(),
        });
    }
    if matches!(capture.roadmap, Observation::Absent) {
        return Err(DerivationError::MissingRoadmap {
            path: capture.root.join("ROADMAP.md"),
        });
    }
    capture
        .declarations
        .as_ref()
        .ok_or_else(|| DerivationError::InvalidRoadmap {
            detail: "captured roadmap has no parsed declarations".into(),
        })?
        .as_ref()
        .map_err(Clone::clone)
}

/// Pure lifecycle truth table over the exact bytes and probes in one capture.
pub fn derive(capture: &CapturedInputs) -> Result<Lifecycle, DerivationError> {
    let parsed = validate_inputs(capture)?;
    let mut phases = Vec::with_capacity(parsed.phases.len());
    for declaration in &parsed.phases {
        let observation = capture
            .phases
            .iter()
            .find(|p| p.relative_path == declaration.relative_path)
            .ok_or_else(|| {
                DerivationError::InputFailure(InputFailure {
                    path: capture.root.join(&declaration.relative_path),
                    category: InputFailureCategory::InvalidPath,
                    diagnostic: Some("missing addressed phase observation".into()),
                })
            })?;
        let plans = match &observation.plans {
            Observation::Present(names) => names.clone(),
            _ => Vec::new(),
        };
        let uat = match &observation.uat {
            Observation::Present(bytes) if !bytes.is_empty() => {
                Some(parse_uat(&String::from_utf8_lossy(bytes)))
            }
            _ => None,
        };
        let mut status = if plans.is_empty() {
            LifecycleStatus::Unplanned
        } else {
            LifecycleStatus::Planned
        };
        if matches!(observation.summary, Observation::Present(())) {
            let complete = uat.as_ref().is_some_and(|uat| {
                !uat.items.is_empty()
                    && uat.items.iter().all(|item| {
                        item.status.as_deref() == Some("pass")
                            || (item.status.as_deref() == Some("skipped")
                                && item
                                    .reason
                                    .as_ref()
                                    .is_some_and(|reason| !reason.is_empty()))
                    })
            });
            status = if complete {
                LifecycleStatus::Complete
            } else {
                LifecycleStatus::Executed
            };
        }
        phases.push(PhaseRecord {
            id: declaration.id,
            name: declaration.name.clone(),
            plans,
            status,
            uat: uat.map(|u| u.counts),
        });
    }
    Ok(Lifecycle {
        cycle: parsed.cycle,
        current: phases
            .iter()
            .find(|p| p.status != LifecycleStatus::Complete)
            .map(|p| p.id),
        total: phases.len(),
        phases,
    })
}

#[cfg(test)]
mod tests;
