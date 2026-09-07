use super::nonblank;
use crate::store::{Error, Result};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CheckpointType {
    Structural,
    HumanVerify,
    Decision,
    Blocked,
    SuiteRed,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum State {
    Unresolved,
    Resolved { resolution: String },
    Superseded { by: String },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Checkpoint {
    pub id: String,
    pub checkpoint_type: CheckpointType,
    pub task_number: u32,
    pub task_name: String,
    pub need: String,
    pub completed_work: Vec<String>,
    pub state: State,
    pub failing_output: Option<String>,
}

impl Checkpoint {
    pub fn requires_operator_answer(&self) -> bool {
        self.checkpoint_type != CheckpointType::SuiteRed
    }
    pub fn validate(&self) -> Result<()> {
        nonblank("checkpoint id", &self.id)?;
        nonblank("task name", &self.task_name)?;
        nonblank("Need", &self.need)?;
        if self.task_number == 0 {
            return Err(Error::Invalid("missing task number".into()));
        }
        for reference in &self.completed_work {
            nonblank("completed work reference", reference)?;
        }
        match &self.state {
            State::Resolved { resolution } => nonblank("resolution", resolution)?,
            State::Superseded { by } => nonblank("superseding identity", by)?,
            State::Unresolved => (),
        }
        if let Some(output) = &self.failing_output {
            nonblank("failing output", output)?;
        }
        if self.checkpoint_type == CheckpointType::SuiteRed && self.failing_output.is_none() {
            return Err(Error::Invalid(
                "suite-red lacks failing output reference".into(),
            ));
        }
        Ok(())
    }
}
