pub mod continuation;
pub mod observations;
mod select;
pub use select::{Action, Pause, select, select_with_conflicts, select_with_interruptions};

#[cfg(test)]
mod tests;
