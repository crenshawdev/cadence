use super::model::{DocumentIdentity, Unit};
use sha2::{Digest, Sha256};
use std::{collections::{BTreeMap, VecDeque}, path::PathBuf, time::{SystemTime, UNIX_EPOCH}};

const MAX_CAPABILITIES: usize = 64;

#[derive(Clone)]
pub enum Capability {
    Unit { path: PathBuf, revision: String, unit: Unit, offset: usize },
    File { path: PathBuf, revision: String },
    Document { identity: DocumentIdentity, part: String, revision: String, offset: usize },
}

pub struct Registry {
    nonce: String,
    next: u64,
    entries: BTreeMap<String, Capability>,
    order: VecDeque<String>,
}

impl Default for Registry {
    fn default() -> Self {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
        let mut hasher = Sha256::new();
        hasher.update(format!("{now}:{}", std::process::id()));
        Self { nonce: format!("{:x}", hasher.finalize())[..16].to_owned(), next: 0, entries: BTreeMap::new(), order: VecDeque::new() }
    }
}

impl Registry {
    fn issue(&mut self, prefix: &str, value: Capability) -> String {
        self.next += 1;
        let token = format!("{prefix}-{}-{}", self.nonce, self.next);
        while self.order.len() >= MAX_CAPABILITIES {
            if let Some(expired) = self.order.pop_front() { self.entries.remove(&expired); }
        }
        self.entries.insert(token.clone(), value);
        self.order.push_back(token.clone());
        token
    }
    pub fn unit(&mut self, path: PathBuf, revision: String, unit: Unit, offset: usize) -> String {
        self.issue("loc", Capability::Unit { path, revision, unit, offset })
    }
    pub fn file(&mut self, path: PathBuf, revision: String) -> String {
        self.issue("file", Capability::File { path, revision })
    }
    pub fn document(&mut self, identity: DocumentIdentity, part: String, revision: String, offset: usize) -> String {
        self.issue("doc", Capability::Document { identity, part, revision, offset })
    }
    pub fn get(&self, token: &str) -> Option<Capability> { self.entries.get(token).cloned() }
}
