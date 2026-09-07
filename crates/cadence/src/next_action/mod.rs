pub mod observations;
mod select;
pub use select::{Action, Pause, select};

#[cfg(test)]
mod tests;
