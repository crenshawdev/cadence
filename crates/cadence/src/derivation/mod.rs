//! Captured artifact evidence and synchronous lifecycle derivation.
mod capture;
mod model;
mod parse;
pub use capture::{ArtifactFiles, ArtifactIo, capture_inputs};
pub use model::*;
pub use parse::{parse_roadmap, parse_uat};

#[cfg(test)]
mod tests;
