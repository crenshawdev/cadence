use super::model::{Scope, Unit};
use sha2::{Digest, Sha256};
use std::{collections::{BTreeMap, VecDeque}, path::PathBuf, time::{SystemTime, UNIX_EPOCH}};

/// How many issued tokens the resident keeps before the oldest expire.
///
/// A search answer is bounded at 65,536 bytes and every hit in it carries at
/// least a location token and a few hundred bytes of JSON, so one answer can
/// issue at most a few hundred tokens. The cap is set so no single answer can
/// expire its own earliest locations before the caller has read them.
const MAX_CAPABILITIES: usize = 1024;

/// The request a cursor continues. A cursor presented with a different
/// request is refused rather than resumed at a site that means nothing there.
#[derive(Clone, PartialEq, Eq)]
pub enum Resumes {
    Search { pattern: String, scope: Scope, case_insensitive: bool },
    List { scope: Scope },
}

#[derive(Clone)]
pub enum Capability {
    Unit { path: PathBuf, revision: String, unit: Unit, offset: usize },
    File { path: PathBuf, revision: String },
    /// Where a bounded answer resumes: the first site it did not serve, bound
    /// to the request it was issued for. A list site is a file and line 0.
    Cursor { resumes: Resumes, file: PathBuf, line: usize },
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
    pub fn cursor(&mut self, resumes: Resumes, file: PathBuf, line: usize) -> String {
        self.issue("cur", Capability::Cursor { resumes, file, line })
    }
    pub fn get(&self, token: &str) -> Option<Capability> { self.entries.get(token).cloned() }
}
