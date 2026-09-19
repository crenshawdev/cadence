pub mod document;
pub mod instructions;
pub mod list;
pub mod location;
pub mod measurement;
pub mod model;
pub mod outline;
pub mod search;
pub mod slice;
pub mod scope;
pub mod source;

use location::Registry;
use model::{DocumentRequest, DocumentSearchRequest, ListRequest, ReadRequest, SearchRequest};
use serde_json::Value;
use std::path::{Path, PathBuf};

pub use location::Capability;

#[derive(Clone, Debug)]
pub enum Query {
    Search(SearchRequest),
    List(ListRequest),
    Read(ReadRequest),
    Document(DocumentRequest),
    DocumentSearch(DocumentSearchRequest),
}

pub struct ReadDomain {
    pub(super) project: PathBuf,
    pub(super) planning_root: PathBuf,
    pub(super) registry: Registry,
}

impl ReadDomain {
    pub fn new(planning_root: &Path) -> Result<Self, String> {
        let project = planning_root.parent().ok_or_else(|| "planning root has no project parent".to_string())?;
        Ok(Self {
            project: std::fs::canonicalize(project).map_err(|error| error.to_string())?,
            planning_root: planning_root.to_path_buf(),
            registry: Registry::default(),
        })
    }
    pub fn query(&mut self, query: Query) -> Value {
        match query {
            Query::Search(request) => self.search(request),
            Query::List(request) => self.list(request),
            Query::Read(request) => self.read(request),
            Query::Document(request) => self.document(request),
            Query::DocumentSearch(request) => self.document_search(request),
        }
    }
}
