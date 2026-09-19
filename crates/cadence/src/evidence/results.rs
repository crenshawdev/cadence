use super::nonblank;
use crate::store::{Error, Result};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Reference {
    Commit { sha: String },
    FileLine { file: String, line: u32 },
    Criterion { id: String },
}
impl Reference {
    pub fn validate(&self) -> Result<()> {
        match self {
            Self::Commit { sha } => {
                if !(7..=64).contains(&sha.len()) || !sha.bytes().all(|b| b.is_ascii_hexdigit()) {
                    return Err(Error::Invalid("invalid commit SHA reference".into()));
                }
            }
            Self::FileLine { file, line } => {
                nonblank("evidence file", file)?;
                if *line == 0 {
                    return Err(Error::Invalid("evidence line must be positive".into()));
                }
            }
            Self::Criterion { id } => nonblank("criterion reference", id)?,
        }
        Ok(())
    }
}

/// Acceptance of a supported contracted return is not a passing checker verdict.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AcceptedResult {
    pub id: String,
    pub contract: String,
    pub result: String,
    pub evidence_text: String,
    pub references: Vec<Reference>,
    pub checker_id: Option<String>,
}
impl AcceptedResult {
    pub fn validate(&self) -> Result<()> {
        nonblank("result identity", &self.id)?;
        nonblank("result contract", &self.contract)?;
        nonblank("result tag", &self.result)?;
        if let Some(id) = &self.checker_id {
            nonblank("supporting check identity", id)?;
        }
        validate_references(&self.references)?;
        Ok(())
    }
}
pub fn validate_references(references: &[Reference]) -> Result<()> {
    if references.is_empty() {
        return Err(Error::Invalid(
            "accepted result needs an evidence reference".into(),
        ));
    }
    for reference in references {
        reference.validate()?;
    }
    Ok(())
}
