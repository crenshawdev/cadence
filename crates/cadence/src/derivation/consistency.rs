use super::*;

fn conflict(
    source: String,
    field: &str,
    declared: impl ToString,
    derived: impl ToString,
) -> DerivationError {
    DerivationError::StateConflict {
        source,
        field: field.into(),
        declared: declared.to_string(),
        derived: derived.to_string(),
    }
}

fn status_name(status: LifecycleStatus) -> &'static str {
    match status {
        LifecycleStatus::Unplanned => "unplanned",
        LifecycleStatus::Planned => "planned",
        LifecycleStatus::Executed => "executed",
        LifecycleStatus::Complete => "complete",
    }
}

/// Declarations never determine lifecycle. Refuse the first disagreement in
/// parsed ROADMAP order (including textual ties), then cursor status/phase/total.
pub fn check_consistency(
    declarations: &ParsedRoadmap,
    answer: &Lifecycle,
    cursor: &CompatibilityCursor,
) -> Result<(), DerivationError> {
    for (declaration, phase) in declarations.phases.iter().zip(&answer.phases) {
        let complete = phase.status == LifecycleStatus::Complete;
        if declaration.checked != complete {
            return Err(conflict(
                format!(
                    "ROADMAP.md:{} entry {}",
                    declaration.source_line, declaration.ordinal
                ),
                "complete",
                declaration.checked,
                complete,
            ));
        }
    }
    let p = cursor.provenance();
    if let CompatibilityCursor::Assertion { status, .. } = cursor {
        let current = answer
            .phases
            .iter()
            .find(|p| p.status != LifecycleStatus::Complete);
        let expected = match (answer.cycle, current) {
            (Cycle::Closed, _) => "complete or unplanned",
            (_, Some(phase)) => status_name(phase.status),
            (_, None) => "complete",
        };
        let agrees = match (answer.cycle, current) {
            (Cycle::Closed, _) => matches!(
                status,
                LifecycleStatus::Complete | LifecycleStatus::Unplanned
            ),
            (_, Some(phase)) => *status == phase.status,
            (_, None) => *status == LifecycleStatus::Complete,
        };
        if !agrees {
            return Err(conflict(
                p.source.clone(),
                "status",
                status_name(*status),
                expected,
            ));
        }
        if answer.cycle == Cycle::Live
            && let Some(current) = current
            && p.phase != Some(current.id)
        {
            return Err(conflict(
                p.source.clone(),
                "phase",
                p.phase.map_or("missing".into(), PhaseId::address),
                current.id.address(),
            ));
        }
    }
    if !matches!(cursor, CompatibilityCursor::Unavailable(_))
        && answer.cycle == Cycle::Closed
        && p.total != Some(0)
    {
        return Err(conflict(
            p.source.clone(),
            "total",
            p.total.map_or("missing".into(), |n| n.to_string()),
            0,
        ));
    }
    Ok(())
}

pub fn recheck_intake(
    expected: &IntakeObservation,
    current: &IntakeObservation,
) -> Result<(), DerivationError> {
    if expected != current {
        return Err(DerivationError::InputsChanged);
    }
    Ok(())
}
