//! Native review delivery and retained identity.
pub mod admission;
pub mod attempts;
pub mod binding;
pub mod consumers;
pub mod contract;
pub mod deferred;
pub mod forward;
pub mod history;
pub mod inventory;
pub mod invoking;
pub mod io;
pub mod manifest;
pub mod material;
pub mod material_io;
pub mod model;
pub mod originals;
pub mod persistence;
pub mod policy;
pub mod provider;
pub mod recovery;
pub mod returns;
pub mod selection;
pub mod specialist;
pub mod stream;
pub mod targets;
pub mod views;

#[cfg(test)]
mod manifest_tests;
