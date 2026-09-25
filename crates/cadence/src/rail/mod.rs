//! Shared pure rail decisions; workflows retain their own questions and mutations.
pub mod branch;
pub mod commit;
pub mod git;
pub mod receipts;
pub mod risk;
pub mod risk_diff;
pub mod surfaces;

#[cfg(test)]
mod commit_tests;

#[cfg(test)]
mod risk_tests;

#[cfg(test)]
mod risk_diff_tests;
