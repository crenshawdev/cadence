use super::*;
use std::path::Path;

/// Validated derivation and its immutable evidence. Publication still requires
/// a final recheck, immediately before return or submission to the writer.
#[derive(Debug)]
pub struct PreparedLifecycle {
    capture: CapturedInputs,
    answer: Lifecycle,
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
    let capture = capture_inputs(selected, io)?;
    let answer = derive(&capture)?;
    Ok(PreparedLifecycle { capture, answer })
}

pub fn recheck_query(
    prepared: &PreparedLifecycle,
    io: &mut (impl ArtifactIo + ?Sized),
) -> Result<RecheckedLifecycle, DerivationError> {
    // Reuse the resolved address: a changed working directory cannot retarget
    // the second observation of a relative selection.
    let second = capture_inputs(&prepared.capture.root, io)?;
    validate_observation_failures(&second)?;
    if second != prepared.capture {
        return Err(DerivationError::InputsChanged);
    }
    Ok(RecheckedLifecycle {
        prepared: PreparedLifecycle {
            capture: prepared.capture.clone(),
            answer: prepared.answer.clone(),
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
