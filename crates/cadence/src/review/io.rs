//! Acquisition boundaries only. Transactional persistence uses
//! `cadence::store::Storage` and the existing conditional store transaction.
use super::model::Target;
use cadence::store::{Observed, Result};

pub trait MaterialIo {
    fn read(&mut self, path: &str) -> Result<Observed>;
    /// Frozen membership, including an identity that can detect replacement.
    fn list(&mut self, path: &str) -> Result<DirectoryObservation>;
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DirectoryObservation {
    pub identity: String,
    pub members: Vec<String>,
}
/// A subprocess boundary; implementations acquire fixed Git observations.
/// Decision code consumes these values without starting another process.
pub trait GitIo {
    fn resolve(&mut self, target: &Target) -> Result<GitObservation>;
    fn read_object(&mut self, object: &str, path: &str) -> Result<Vec<u8>>;
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GitObservation {
    pub base: String,
    pub head: Option<String>,
    pub index: Option<String>,
    pub diff: Vec<u8>,
    pub paths: Vec<String>,
}
pub trait Clock {
    fn now(&mut self) -> u64;
}
