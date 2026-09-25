//! Native verification authority, independent from execution completion.
pub mod instructions;
pub mod model;
pub mod inputs;
pub mod dispatch;
pub mod persistence;
pub mod runner;
pub mod verdicts;
pub mod status;
pub mod waivers;
pub mod human;
pub mod projections;
pub mod completion;
pub mod render;
pub mod audit;

#[cfg(test)]
mod accounting_tests;
