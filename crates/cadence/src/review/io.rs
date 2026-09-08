//! Acquisition boundaries only. Transactional persistence uses
//! `cadence::store::Storage` and the existing conditional store transaction.
use super::model::Target;
use cadence::store::{Observed, Result};

pub trait MaterialIo {
    fn read(&mut self, path: &str) -> Result<Observed>;
    /// Frozen membership, including an identity that can detect replacement.
    fn list(&mut self, path: &str) -> Result<DirectoryObservation>;
    fn members(&mut self, path: &str) -> Result<DirectoryMembers> {
        let listing = self.list(path)?;
        Ok(DirectoryMembers {
            identity: listing.identity,
            members: listing
                .members
                .into_iter()
                .map(|name| DirectoryNode {
                    name,
                    kind: NodeKind::File,
                })
                .collect(),
        })
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DirectoryObservation {
    pub identity: String,
    pub members: Vec<String>,
}
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, serde::Serialize)]
pub enum NodeKind {
    File,
    Directory,
    Symlink,
    Special,
}
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, serde::Serialize)]
pub struct DirectoryNode {
    pub name: String,
    pub kind: NodeKind,
}
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
pub struct DirectoryMembers {
    pub identity: String,
    pub members: Vec<DirectoryNode>,
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
