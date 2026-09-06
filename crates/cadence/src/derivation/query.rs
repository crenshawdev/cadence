use super::*;
use std::path::Path;

/// Validated derivation and its immutable evidence. Publication still requires
/// a final recheck, immediately before return or submission to the writer.
#[derive(Debug)]
pub struct PreparedLifecycle {
    capture: CapturedInputs,
    answer: Lifecycle,
    intake: Option<ValidatedIntake>,
}

impl PreparedLifecycle {
    pub fn capture(&self) -> &CapturedInputs {
        &self.capture
    }
    pub fn answer(&self) -> &Lifecycle {
        &self.answer
    }
}

/// Constructible only through successful reobservation. This is an observation
/// checkpoint, with no guarantee against edits after that checkpoint.
#[derive(Debug)]
pub struct RecheckedLifecycle {
    prepared: PreparedLifecycle,
}

impl RecheckedLifecycle {
    pub fn intake(&self) -> Option<&ValidatedIntake> {
        self.prepared.intake.as_ref()
    }
    pub fn capture(&self) -> &CapturedInputs {
        &self.prepared.capture
    }
    pub fn answer(&self) -> &Lifecycle {
        &self.prepared.answer
    }
}

pub fn prepare_query(
    selected: &Path,
    io: &mut (impl ArtifactIo + ?Sized),
) -> Result<PreparedLifecycle, DerivationError> {
    let unavailable = normalize_imported_cursor(&serde_json::Value::Null)?;
    prepare(selected, io, &unavailable, None)
}

/// Independent synchronous, read-only boundary for verified snapshot intake.
pub trait IntakeIo {
    fn observe_intake(&mut self) -> Result<IntakeObservation, DerivationError>;
}

pub fn prepare_query_with_intake(
    selected: &Path,
    io: &mut (impl ArtifactIo + ?Sized),
    cursor: &CompatibilityCursor,
    observation: &IntakeObservation,
) -> Result<PreparedLifecycle, DerivationError> {
    if cursor.provenance().original_cursor != observation.cursor.clone().unwrap_or_default() {
        return Err(DerivationError::InputsChanged);
    }
    prepare(selected, io, cursor, Some(observation))
}

fn prepare(
    selected: &Path,
    io: &mut (impl ArtifactIo + ?Sized),
    cursor: &CompatibilityCursor,
    observation: Option<&IntakeObservation>,
) -> Result<PreparedLifecycle, DerivationError> {
    let capture = capture_inputs(selected, io)?;
    let answer = derive(&capture)?;
    check_consistency(validate_inputs(&capture)?, &answer, cursor)?;
    Ok(PreparedLifecycle {
        capture,
        answer,
        intake: observation.map(|observation| ValidatedIntake {
            cursor: cursor.clone(),
            observation: observation.clone(),
        }),
    })
}

pub fn recheck_query(
    prepared: &PreparedLifecycle,
    io: &mut (impl ArtifactIo + ?Sized),
) -> Result<RecheckedLifecycle, DerivationError> {
    recheck(prepared, io, None)
}

pub fn recheck_query_with_intake(
    prepared: &PreparedLifecycle,
    io: &mut (impl ArtifactIo + ?Sized),
    intake_io: &mut dyn IntakeIo,
) -> Result<RecheckedLifecycle, DerivationError> {
    recheck(prepared, io, Some(intake_io))
}

fn recheck(
    prepared: &PreparedLifecycle,
    io: &mut (impl ArtifactIo + ?Sized),
    intake_io: Option<&mut dyn IntakeIo>,
) -> Result<RecheckedLifecycle, DerivationError> {
    // Reuse the resolved address: a changed working directory cannot retarget
    // the second observation of a relative selection.
    let second = capture_inputs(&prepared.capture.root, io)?;
    validate_observation_failures(&second)?;
    if second != prepared.capture {
        return Err(DerivationError::InputsChanged);
    }
    if let Some(expected) = &prepared.intake {
        let current = intake_io
            .ok_or(DerivationError::InputsChanged)?
            .observe_intake()?;
        recheck_intake(&expected.observation, &current)?;
    }
    Ok(RecheckedLifecycle {
        prepared: PreparedLifecycle {
            capture: prepared.capture.clone(),
            answer: prepared.answer.clone(),
            intake: prepared.intake.clone(),
        },
    })
}

pub fn query(
    selected: &Path,
    io: &mut (impl ArtifactIo + ?Sized),
) -> Result<RecheckedLifecycle, DerivationError> {
    let prepared = prepare_query(selected, io)?;
    recheck_query(&prepared, io)
}

pub fn query_with_intake(
    selected: &Path,
    io: &mut (impl ArtifactIo + ?Sized),
    cursor: &CompatibilityCursor,
    observation: &IntakeObservation,
    intake_io: &mut dyn IntakeIo,
) -> Result<RecheckedLifecycle, DerivationError> {
    let prepared = prepare_query_with_intake(selected, io, cursor, observation)?;
    recheck_query_with_intake(&prepared, io, intake_io)
}
