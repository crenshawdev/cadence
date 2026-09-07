//! Recall's domain core consumes eligible records and explicit snippets only.
mod documents;
mod history;
mod rank;
#[cfg(test)]
mod tests;

use cadence::store::{
    items::RecallItems,
    model::{Decision, Disposition, Evidence},
    writer::View,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Provenance {
    Record {
        id: String,
        revision: u64,
        source: String,
        commit: Option<String>,
    },
    Document {
        path: String,
        line: usize,
        heading: String,
        commit: Option<String>,
    },
    Residue {
        path: String,
        line: usize,
        label: String,
        origin: String,
        phase: String,
        commit: Option<String>,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Candidate {
    pub text: String,
    pub provenance: Provenance,
    pub item_id: Option<String>,
}

/// Only identity metadata is inspected outside the eligible projection. Raw
/// event text, decline reasons and quarantined origin bytes never enter ranking.
pub fn declined(view: &View) -> BTreeSet<String> {
    view.items
        .iter()
        .filter(|r| matches!(r.disposition, Disposition::Declined { .. }))
        .map(|r| r.id.clone())
        .collect()
}

pub fn records(items: RecallItems<'_>) -> Vec<Candidate> {
    items
        .iter()
        .map(|r| Candidate {
            text: r.text.clone(),
            item_id: Some(r.id.clone()),
            provenance: Provenance::Record {
                id: r.id.clone(),
                revision: r.revision,
                source: r.origin.source.clone(),
                commit: None,
            },
        })
        .collect()
}

pub fn current(view: &View) -> Vec<Candidate> {
    let mut result = records(view.recall_items());
    for r in &view.decisions {
        let (label, evidence) = match &r.decision {
            Decision::Routing {
                choice, receipt, ..
            } => (choice, receipt),
            Decision::Gate { outcome, evidence } => (outcome, evidence),
            Decision::Refusal { reason, evidence } => (reason, evidence),
        };
        let text = match evidence {
            Evidence::Text(text) => format!("{label}\n{text}"),
            _ => label.clone(),
        };
        result.push(Candidate {
            text,
            item_id: None,
            provenance: Provenance::Record {
                id: r.id.clone(),
                revision: r.revision,
                source: r.origin.source.clone(),
                commit: None,
            },
        });
    }
    result
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Hit {
    pub score: f64,
    pub snippet: String,
    pub provenance: Provenance,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Answer {
    pub backend: String,
    pub results: Vec<Hit>,
    pub total: usize,
    pub incomplete: Vec<String>,
}

pub struct Corpus {
    candidates: Vec<Candidate>,
    index: rank::Index,
}

/// The mixed-source read boundary; its result is immediately queryable.
pub fn live(view: &View, root: &std::path::Path) -> (Corpus, Vec<String>) {
    let documents = documents::read(root, &mut documents::Files);
    let mut candidates = current(view);
    candidates.extend(documents.candidates);
    (
        Corpus::new(candidates, &declined(view)),
        documents.incomplete,
    )
}
impl Corpus {
    pub fn new(candidates: Vec<Candidate>, excluded: &BTreeSet<String>) -> Self {
        let candidates: Vec<_> = candidates
            .into_iter()
            .filter(|c| c.item_id.as_ref().is_none_or(|id| !excluded.contains(id)))
            .collect();
        let index = rank::Index::new(candidates.iter().map(|c| c.text.as_str()));
        Self { candidates, index }
    }
    pub fn query(&self, query: &str, limit: Option<i64>, backend: &str) -> Result<Answer, String> {
        let limit = limit.unwrap_or(5);
        if limit < 1 {
            return Err("limit must be a positive integer".into());
        }
        if query.trim().is_empty() {
            return Err("recall needs a query".into());
        }
        let mut answer = Answer {
            backend: backend.into(),
            results: vec![],
            total: 0,
            incomplete: vec![],
        };
        if backend == "none" {
            return Ok(answer);
        }
        if backend != "builtin" {
            return Err(format!("unknown recall backend: {backend}"));
        }
        let matched = self.index.search(query);
        answer.total = matched.len();
        answer.results = matched
            .into_iter()
            .take(limit as usize)
            .map(|(i, score)| Hit {
                score: (score * 10000.0).round() / 10000.0,
                snippet: self.candidates[i].text.clone(),
                provenance: self.candidates[i].provenance.clone(),
            })
            .collect();
        Ok(answer)
    }
}

// Runtime and filesystem work live outside the ranker and renderer. The task
// owns every derived index; handles only send requests and await their reply.
pub use resident::Resident;
mod resident {
    use super::*;
    use crate::{
        config::{
            merge,
            reload::{self, ConfigIo, Generation},
        },
        import::{Session, SessionFactory},
    };
    use cadence::store::{Error, Result, writer::Operation};
    use std::{
        collections::BTreeMap,
        os::unix::fs::MetadataExt,
        path::{Path, PathBuf},
    };
    use tokio::sync::{mpsc, oneshot};

    use crate::server::derivation_service::{self, Driver};
    use cadence::derivation::{DerivationError, Lifecycle};

    use crate::server::evidence_service::{self, Command, Recovery};

    enum Request {
        Evidence {
            root: PathBuf,
            command: Command,
            reply: oneshot::Sender<Result<Recovery>>,
        },
        Lifecycle {
            root: PathBuf,
            reply: oneshot::Sender<std::result::Result<Lifecycle, DerivationError>>,
        },
        Store {
            root: PathBuf,
            operation: Operation,
            reply: oneshot::Sender<Result<View>>,
        },
        Recall {
            root: PathBuf,
            query: String,
            limit: Option<i64>,
            reply: oneshot::Sender<Result<Answer>>,
        },
    }
    #[derive(Clone)]
    pub struct Resident {
        requests: mpsc::Sender<Request>,
    }

    #[derive(PartialEq, Eq)]
    struct Inputs {
        store: (u64, String, String),
        config: u64,
        documents: BTreeMap<String, String>,
        file_ids: BTreeMap<String, (u64, u64)>,
        history: BTreeSet<String>,
        incomplete: Vec<String>,
    }
    struct Cached {
        inputs: Inputs,
        corpus: Corpus,
    }

    fn prepare(root: &Path, view: &View, config: &Generation) -> (Inputs, Vec<Candidate>) {
        let docs = documents::read(root, &mut documents::Files);
        let file_ids = docs
            .identities
            .keys()
            .filter_map(|path| {
                std::fs::metadata(root.join(path))
                    .ok()
                    .map(|m| (path.clone(), (m.dev(), m.ino())))
            })
            .collect();
        let mut candidates = current(view);
        candidates.extend(docs.candidates);
        let history = history::read(root, view, &candidates, &mut history::Git);
        candidates.extend(history.candidates);
        let inputs = Inputs {
            store: (
                view.snapshot.generation,
                view.snapshot.items_digest.clone(),
                view.snapshot.decisions_digest.clone(),
            ),
            config: config.number,
            documents: docs.identities,
            file_ids,
            history: history.identities,
            incomplete: docs
                .incomplete
                .into_iter()
                .chain(history.incomplete)
                .collect(),
        };
        (inputs, candidates)
    }

    async fn answer<I: ConfigIo>(
        session: &Session<I>,
        root: &Path,
        query: &str,
        limit: Option<i64>,
        cache: &mut Option<Cached>,
    ) -> Result<Answer> {
        // Reads through the same owner as writes. Since this task serializes
        // its operations, only another supplied session client can change the
        // generation during I/O; rechecking below catches that too.
        let view = session.request(Operation::Read).await?;
        let config = session.config()?;
        let backend = merge::get(&config.effective.values, "memory.backend")
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| Error::Policy("recall controlling config unavailable".into()))?;
        // Validate arguments and backend before any expensive corpus read.
        let empty = Corpus::new(vec![], &BTreeSet::new());
        let disabled = empty.query(query, limit, backend).map_err(Error::Invalid)?;
        if backend == "none" {
            *cache = None;
            return Ok(disabled);
        }
        let task_root = root.to_path_buf();
        let task_view = view.clone();
        let task_config = config.clone();
        let (inputs, candidates) =
            tokio::task::spawn_blocking(move || prepare(&task_root, &task_view, &task_config))
                .await
                .map_err(|_| Error::Closed)?;
        let latest = session.request(Operation::Read).await?;
        let latest_config = session.config()?;
        if latest.snapshot != view.snapshot || latest_config != config {
            *cache = None;
            return Err(Error::Conflict(
                "recall inputs changed during preparation; retry with current generation".into(),
            ));
        }
        if cache.as_ref().is_none_or(|cached| cached.inputs != inputs) {
            *cache = Some(Cached {
                inputs,
                corpus: Corpus::new(candidates, &declined(&latest)),
            });
        }
        let cached = cache.as_ref().expect("prepared cache");
        let mut result = cached
            .corpus
            .query(query, limit, backend)
            .map_err(Error::Invalid)?;
        result.incomplete = cached.inputs.incomplete.clone();
        Ok(result)
    }

    impl Resident {
        // first_touch borrows the factory across await in a migratable task.
        // Sync applies to that borrow, not to writable store/index ownership.
        pub fn spawn<I: ConfigIo + Clone + Sync>(factory: SessionFactory<I>) -> Self {
            Self::spawn_with_driver(factory, Driver::default())
        }
        pub fn spawn_with_driver<I: ConfigIo + Clone + Sync>(
            factory: SessionFactory<I>,
            driver: Driver,
        ) -> Self {
            let (requests, mut receiver) = mpsc::channel::<Request>(32);
            tokio::spawn(async move {
                let mut caches = BTreeMap::<PathBuf, Option<Cached>>::new();
                while let Some(request) = receiver.recv().await {
                    match request {
                        Request::Evidence {
                            root,
                            command,
                            reply,
                        } => {
                            let result = evidence_service::execute(&factory, &root, command).await;
                            let _ = reply.send(result);
                        }
                        Request::Lifecycle { root, reply } => {
                            let result = derivation_service::query(&factory, &root, &driver).await;
                            let _ = reply.send(result);
                        }
                        Request::Store {
                            root,
                            operation,
                            reply,
                        } => {
                            let result = match factory.first_touch(&root).await {
                                Ok(session) => session.request(operation).await,
                                Err(e) => Err(e),
                            };
                            let _ = reply.send(result);
                        }
                        Request::Recall {
                            root,
                            query,
                            limit,
                            reply,
                        } => {
                            let result = match reload::identity(&root) {
                                Ok(root) => {
                                    let cache = caches.entry(root.clone()).or_default();
                                    let result = match factory.first_touch(&root).await {
                                        Ok(session) => {
                                            answer(&session, &root, &query, limit, cache).await
                                        }
                                        Err(e) => Err(e),
                                    };
                                    if result.is_err() {
                                        *cache = None;
                                    }
                                    result
                                }
                                Err(e) => Err(e),
                            };
                            let _ = reply.send(result);
                        }
                    }
                }
                // Dropping the factory releases its sessions and writer handles.
                // Accepted requests drain; canceled reply receivers cannot panic.
            });
            Self { requests }
        }

        pub async fn evidence(&self, root: &Path, command: Command) -> Result<Recovery> {
            let (reply, completion) = oneshot::channel();
            self.requests
                .send(Request::Evidence {
                    root: root.into(),
                    command,
                    reply,
                })
                .await
                .map_err(|_| Error::Closed)?;
            completion.await.map_err(|_| Error::Closed)?
        }

        pub async fn lifecycle(
            &self,
            root: &Path,
        ) -> std::result::Result<Lifecycle, DerivationError> {
            let (reply, completion) = oneshot::channel();
            self.requests
                .send(Request::Lifecycle {
                    root: root.into(),
                    reply,
                })
                .await
                .map_err(|_| derivation_service::store_error(Error::Closed))?;
            completion
                .await
                .map_err(|_| derivation_service::store_error(Error::Closed))?
        }
        pub async fn store(&self, root: &Path, operation: Operation) -> Result<View> {
            let (reply, completion) = oneshot::channel();
            self.requests
                .send(Request::Store {
                    root: root.into(),
                    operation,
                    reply,
                })
                .await
                .map_err(|_| Error::Closed)?;
            completion.await.map_err(|_| Error::Closed)?
        }
        pub async fn recall(&self, root: &Path, query: &str, limit: Option<i64>) -> Result<Answer> {
            let (reply, completion) = oneshot::channel();
            self.requests
                .send(Request::Recall {
                    root: root.into(),
                    query: query.into(),
                    limit,
                    reply,
                })
                .await
                .map_err(|_| Error::Closed)?;
            completion.await.map_err(|_| Error::Closed)?
        }
    }
}
