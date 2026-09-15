use super::*;
use std::path::Path;

/// Validated derivation and its immutable evidence. Publication still requires
/// a final recheck, immediately before return or submission to the writer.
#[derive(Debug)]
pub struct PreparedLifecycle {
    capture: CapturedInputs,
    overlay: AcceptanceOverlay,
    answer: Lifecycle,
    intake: Option<ValidatedIntake>,
}

impl PreparedLifecycle {
    pub fn capture(&self) -> &CapturedInputs {
        &self.capture
    }
    /// The native acceptance authority this derivation was made with.
    pub fn overlay(&self) -> &AcceptanceOverlay {
        &self.overlay
    }
    pub fn answer(&self) -> &Lifecycle {
        &self.answer
    }
    /// The memo identity of every input, native authority included.
    pub fn input_key(&self) -> Result<String, DerivationError> {
        super::memo::input_key_with(&self.capture, &self.overlay)
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
    pub fn overlay(&self) -> &AcceptanceOverlay {
        &self.prepared.overlay
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

/// The imported cursor is a compatibility assertion about the current phase.
/// Once that phase holds a native approved context, native authority decides
/// its status and the assertion is checked no further; the first successful
/// checked query then retires the cursor as before. Nothing stored changes:
/// the selected cursor is still what adoption records.
pub(super) fn yielded(
    cursor: &CompatibilityCursor,
    overlay: &AcceptanceOverlay,
    answer: &Lifecycle,
) -> CompatibilityCursor {
    match (cursor, answer.current) {
        (CompatibilityCursor::Assertion { provenance, .. }, Some(current))
            if overlay.contexted.contains(&current.address()) =>
        {
            CompatibilityCursor::Unavailable(provenance.clone())
        }
        _ => cursor.clone(),
    }
}

fn prepare(
    selected: &Path,
    io: &mut (impl ArtifactIo + ?Sized),
    cursor: &CompatibilityCursor,
    observation: Option<&IntakeObservation>,
) -> Result<PreparedLifecycle, DerivationError> {
    let capture = capture_inputs(selected, io)?;
    // Native acceptance is read from the store files beside the artifacts,
    // before any consistency check, so a natively completed phase agrees
    // with its checked box without SUMMARY.md or UAT.md (D-131).
    let overlay = observe_acceptance(&capture.root)?;
    let answer = derive_with(&capture, &overlay)?;
    check_consistency(validate_inputs(&capture)?, &answer, &yielded(cursor, &overlay, &answer))?;
    Ok(PreparedLifecycle {
        capture,
        overlay,
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
    if second != prepared.capture || observe_acceptance(&prepared.capture.root)? != prepared.overlay {
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
            overlay: prepared.overlay.clone(),
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

impl PreparedLifecycle {
    /// Add snapshot intake to the already derived request-entry capture.
    pub fn with_intake(mut self, selected: &SelectedIntake) -> Result<Self, DerivationError> {
        if selected.cursor.provenance().original_cursor
            != selected.observation.cursor.clone().unwrap_or_default()
        {
            return Err(DerivationError::InputsChanged);
        }
        check_consistency(
            validate_inputs(&self.capture)?,
            &self.answer,
            &yielded(&selected.cursor, &self.overlay, &self.answer),
        )?;
        self.intake = Some(ValidatedIntake {
            cursor: selected.cursor.clone(),
            observation: selected.observation.clone(),
        });
        Ok(self)
    }
}
