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
        entry: None,
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
    if let Some((issue, entry)) = located_conflicts(declarations, answer).into_iter().next() {
        return Err(DerivationError::StateConflict {
            source: issue.source,
            field: issue.field,
            declared: issue.declared,
            derived: issue.derived,
            entry: Some(Box::new(entry)),
        });
    }
    check_cursor(answer, cursor)
}

/// Progress retains each disagreement without granting it execution authority.
pub fn roadmap_conflicts(declarations: &ParsedRoadmap, answer: &Lifecycle) -> Vec<RoadmapConflict> {
    located_conflicts(declarations, answer)
        .into_iter()
        .map(|(issue, _)| issue)
        .collect()
}

/// Each disagreement with the roadmap line it sits on, so a refusal over the
/// first one can be joined to that line rather than to a flattened sentence.
fn located_conflicts(
    declarations: &ParsedRoadmap,
    answer: &Lifecycle,
) -> Vec<(RoadmapConflict, ConflictEntry)> {
    let mut issues = Vec::new();
    for (declaration, phase) in declarations.phases.iter().zip(&answer.phases) {
        let complete = phase.status == LifecycleStatus::Complete;
        if declaration.checked != complete {
            issues.push((
                RoadmapConflict {
                    phase: phase.id,
                    status: phase.status,
                    source: format!(
                        "ROADMAP.md:{} entry {}",
                        declaration.source_line, declaration.ordinal
                    ),
                    field: "complete".into(),
                    declared: declaration.checked.to_string(),
                    derived: complete.to_string(),
                },
                ConflictEntry {
                    source: "ROADMAP.md".into(),
                    line: declaration.source_line as u64,
                    entry: declaration.ordinal as u64,
                    phase: phase.id.address(),
                    status: status_name(phase.status).into(),
                },
            ));
        }
    }
    issues
}

pub(super) fn check_cursor(answer: &Lifecycle, cursor: &CompatibilityCursor) -> Result<(), DerivationError> {
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
