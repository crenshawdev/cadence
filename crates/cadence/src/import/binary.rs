//! Legacy sources are immutable evidence, never replayed writers.

// This executable owns these tests; shared source includes register none.
include!("mod.rs");

#[cfg(test)]
mod tests;

#[cfg(test)]
mod routing_admission_tests;
