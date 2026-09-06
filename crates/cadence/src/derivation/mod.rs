//! Captured artifact evidence and synchronous lifecycle derivation.
mod model;
mod parse;
pub use model::*;
pub use parse::{parse_roadmap, parse_uat};

#[cfg(test)]
mod tests;
