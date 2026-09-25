pub mod document;
pub mod instructions;
pub mod measurement;
pub mod model;

use crate::process::Process;
use model::{DocumentRequest, DocumentSearchRequest};
use serde_json::Value;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug)]
pub enum Query {
    Document(DocumentRequest),
    DocumentSearch(DocumentSearchRequest),
}

pub struct ReadDomain {
    pub(super) planning_root: PathBuf,
}

impl ReadDomain {
    pub fn new(planning_root: &Path) -> Result<Self, String> {
        Ok(Self { planning_root: planning_root.to_path_buf() })
    }
    pub fn query(&mut self, query: Query, process: &mut dyn Process) -> Value {
        match query {
            Query::Document(request) => self.document(request, process),
            Query::DocumentSearch(request) => self.document_search(request, process),
        }
    }
}
