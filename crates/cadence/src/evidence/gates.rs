use super::nonblank;
use crate::store::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Purpose {
    Structural,
    HumanVerify,
    Decision,
    Blocked,
    UnusableCheck,
    Progress,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct OptionChoice {
    pub id: String,
    pub text: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Disposition {
    Approve,
    Adjust,
    Stop,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct Answer {
    pub question_id: String,
    pub actual_response: String,
    pub selected_option: Option<String>,
    pub adjustment: Option<String>,
    pub disposition: Disposition,
    pub authorization_id: Option<String>,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "status", content = "value", rename_all = "snake_case")]
pub enum State {
    Unanswered,
    Answered(Answer),
    Superseded { by: String },
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Gate {
    pub id: String,
    pub purpose: Purpose,
    pub checkpoint_id: Option<String>,
    pub question: String,
    pub need: String,
    pub options: Vec<OptionChoice>,
    pub state: State,
}
impl Gate {
    pub fn validate(&self) -> Result<()> {
        nonblank("question id", &self.id)?;
        nonblank("question", &self.question)?;
        nonblank("gate Need", &self.need)?;
        if let Some(id) = &self.checkpoint_id {
            nonblank("checkpoint identity", id)?;
        }
        let mut ids = BTreeSet::new();
        for option in &self.options {
            nonblank("option id", &option.id)?;
            nonblank("option text", &option.text)?;
            if !ids.insert(&option.id) {
                return Err(Error::Invalid("duplicate gate option identity".into()));
            }
        }
        match &self.state {
            State::Unanswered => (),
            State::Superseded { by } => nonblank("superseding question", by)?,
            State::Answered(answer) => {
                if answer.question_id != self.id {
                    return Err(Error::Invalid("answer names a different question".into()));
                }
                nonblank("actual operator response", &answer.actual_response)?;
                if let Some(option) = &answer.selected_option
                    && !ids.contains(option)
                {
                    return Err(Error::Invalid("answer names an unknown option".into()));
                }
                if let Some(adjustment) = &answer.adjustment {
                    nonblank("adjustment", adjustment)?;
                }
                if answer.disposition == Disposition::Adjust && answer.adjustment.is_none() {
                    return Err(Error::Invalid("adjust disposition lacks adjustment".into()));
                }
                if let Some(id) = &answer.authorization_id {
                    nonblank("authorization identity", id)?;
                }
            }
        }
        Ok(())
    }
}
