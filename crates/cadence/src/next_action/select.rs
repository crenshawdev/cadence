use super::observations::Observations;
use crate::derivation::{Cycle, Lifecycle, LifecycleStatus, PhaseId};

#[derive(Clone, Debug, PartialEq)]
pub struct Pause {
    pub phase: PhaseId,
    pub next: String,
}

#[derive(Clone, Debug, PartialEq)]
pub enum Action {
    Resolve { phase: PhaseId, source: String },
    Resume(String),
    Interrupted(String),
    Execute(PhaseId),
    Verify(PhaseId),
    Context(PhaseId),
    Plan(PhaseId),
    TriageDeferred,
    Milestone,
    AddPhase,
}

impl Action {
    pub fn instruction(&self) -> String {
        match self {
            Self::Resolve { phase, source } => format!("Resolve {source}: declare phase {} with adoption-declare or untick it", phase.address()),
            Self::Resume(next) => next.clone(),
            Self::Interrupted(id) => format!("Continue dispatch {id} with execution-authorize or retire it"),
            Self::Execute(id) => format!("/cad-execute {}", id.address()),
            Self::Verify(id) => format!("/cad-verify {}", id.address()),
            Self::Context(id) => format!("/cad-context {}", id.address()),
            Self::Plan(id) => format!("/cad-plan {}", id.address()),
            Self::TriageDeferred => "Triage the deferred queue".into(),
            Self::Milestone => "/cad-milestone".into(),
            Self::AddPhase => "/cad-phase add".into(),
        }
    }

    pub fn reference(&self) -> Option<(&'static str, &'static str)> {
        matches!(self, Self::TriageDeferred)
            .then_some(("cadence-core/references/triage-gate.md", "deferred"))
    }
}

#[derive(Clone, Copy)]
pub(super) enum Rule {
    Conflict,
    Interrupted,
    Pause,
    Planned,
    Outstanding,
    Executed,
    Unplanned,
    Queue,
    Residue,
    Closed,
    NullCurrent,
}
pub(super) const RULES: [Rule; 9] = [
    Rule::Pause,
    Rule::Planned,
    Rule::Outstanding,
    Rule::Executed,
    Rule::Unplanned,
    Rule::Queue,
    Rule::Residue,
    Rule::Closed,
    Rule::NullCurrent,
];

impl Rule {
    pub(super) fn apply(
        self,
        lifecycle: &Lifecycle,
        observations: &Observations,
        pause: Option<&Pause>,
        skip_discuss: bool,
    ) -> Option<Action> {
        self.apply_with_conflicts(lifecycle, observations, pause, skip_discuss, &[], None)
    }

    fn apply_with_conflicts(
        self, lifecycle: &Lifecycle, observations: &Observations, pause: Option<&Pause>,
        skip_discuss: bool, conflicts: &[crate::derivation::RoadmapConflict], interrupted: Option<&str>,
    ) -> Option<Action> {
        let lowest = |status, outstanding: bool| {
            lifecycle
                .phases
                .iter()
                .filter(|p| p.status == status && (!outstanding || observations.outstanding(p.id)))
                .min_by(|a, b| a.id.number().total_cmp(&b.id.number()))
                .map(|p| p.id)
        };
        match self {
            Self::Interrupted => interrupted.map(|id| Action::Interrupted(id.into())),
            Self::Conflict => conflicts.iter()
                .min_by(|a, b| a.phase.number().total_cmp(&b.phase.number()))
                .map(|issue| Action::Resolve { phase: issue.phase, source: issue.source.clone() }),
            Self::Pause => pause
                .filter(|p| Some(p.phase) == lifecycle.current)
                .map(|p| Action::Resume(p.next.clone())),
            Self::Planned => lowest(LifecycleStatus::Planned, false).map(Action::Execute),
            Self::Outstanding => lowest(LifecycleStatus::Executed, true).map(Action::Execute),
            Self::Executed => lowest(LifecycleStatus::Executed, false).map(Action::Verify),
            Self::Unplanned => lifecycle
                .current
                .filter(|id| {
                    lifecycle
                        .phases
                        .iter()
                        .any(|p| p.id == *id && p.status == LifecycleStatus::Unplanned)
                })
                .map(|id| {
                    if skip_discuss {
                        Action::Plan(id)
                    } else {
                        Action::Context(id)
                    }
                }),
            Self::Queue => observations
                .queue
                .needs_triage()
                .then_some(Action::TriageDeferred),
            Self::Residue => (!observations.residue.is_empty()).then_some(Action::Milestone),
            Self::Closed => (lifecycle.cycle == Cycle::Closed).then_some(Action::AddPhase),
            Self::NullCurrent => lifecycle.current.is_none().then_some(Action::Milestone),
        }
    }
}

/// Suggestion only. Invocation authority belongs to the selected occurrence.
pub fn select(
    lifecycle: &Lifecycle,
    observations: &Observations,
    pause: Option<&Pause>,
    skip_discuss: bool,
) -> Option<Action> {
    select_with_conflicts(lifecycle, observations, pause, skip_discuss, &[])
}

pub fn select_with_conflicts(
    lifecycle: &Lifecycle, observations: &Observations, pause: Option<&Pause>,
    skip_discuss: bool, conflicts: &[crate::derivation::RoadmapConflict],
) -> Option<Action> {
    select_with_interruptions(lifecycle, observations, pause, skip_discuss, conflicts, None)
}

pub fn select_with_interruptions(
    lifecycle: &Lifecycle, observations: &Observations, pause: Option<&Pause>,
    skip_discuss: bool, conflicts: &[crate::derivation::RoadmapConflict], interrupted: Option<&str>,
) -> Option<Action> {
    Rule::Conflict.apply_with_conflicts(lifecycle, observations, pause, skip_discuss, conflicts, interrupted)
        .or_else(|| Rule::Interrupted.apply_with_conflicts(lifecycle, observations, pause, skip_discuss, conflicts, interrupted))
        .or_else(|| RULES.iter().find_map(|rule| rule.apply(lifecycle, observations, pause, skip_discuss)))
}
