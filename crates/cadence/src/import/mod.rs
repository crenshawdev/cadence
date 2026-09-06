//! Legacy sources are immutable evidence, never replayed writers.
pub mod decisions;
pub mod items;

use cadence::store::model::digest;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Source {
    pub path: String,
    pub bytes: Vec<u8>,
}
impl Source {
    pub fn generation(&self) -> String {
        digest(&self.bytes)
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SourceEvidence {
    pub source: Source,
    pub generation: String,
    pub label: String,
}
impl SourceEvidence {
    pub fn original(source: &Source) -> Self {
        Self {
            source: source.clone(),
            generation: source.generation(),
            label: "non_effective_original_source".into(),
        }
    }
}

#[cfg(test)]
mod tests;
