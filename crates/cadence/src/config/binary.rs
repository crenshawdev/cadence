//! Two persisted layers; defaults and migration evidence are never a layer.

// This executable owns these tests; shared source includes register none.
include!("mod.rs");

#[cfg(test)]
mod tests;
