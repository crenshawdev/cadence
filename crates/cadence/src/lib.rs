extern crate self as cadence;

/// Completion declared at import for ticked phases the documents cannot derive.
pub mod adoption;
/// The owner's typed captures: a kind, a phase, and no prose to parse back.
pub mod capture;
/// Two persisted layers; defaults and migration evidence are never a layer.
pub mod config;
pub mod config_service;
pub mod context;
pub mod derivation;
pub mod envelope;
pub mod evidence;
pub mod execution;
/// Legacy sources are immutable evidence, never replayed writers.
pub mod import;
pub mod next_action;
pub mod pause;
pub mod plan;
pub mod progress;
pub mod rail;
pub mod review;
pub mod read;
pub mod store;
pub mod suggest;
pub mod verification;
/// Why a file line is as it is: the git chain joined to the record, byte-identical to the frozen renderer.
pub mod why;
