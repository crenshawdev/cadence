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
            Decision::Boundary { .. } | Decision::BoundaryV1(_) => continue,
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

    use crate::server::{
        evidence_service::{self, Command, Recovery},
        execution_service,
    };

    enum Request {
        Plan {
            root: PathBuf,
            command: crate::server::plan_service::Command,
            reply: oneshot::Sender<Result<cadence::plan::model::Answer>>,
        },
        Context {
            root: PathBuf,
            command: crate::server::context_service::Command,
            reply: oneshot::Sender<Result<cadence::context::model::Answer>>,
        },
        Review {
            root: PathBuf,
            command: Box<crate::server::review_service::Command>,
            reply: oneshot::Sender<crate::server::review_service::Answer>,
        },
        Config {
            root: PathBuf,
            command: crate::server::config_service::Command,
            reply: oneshot::Sender<crate::server::config_service::Answer>,
        },
        RailReceipt {
            root: PathBuf,
            command: Box<crate::server::rail_service::ReceiptCommand>,
            reply: oneshot::Sender<crate::server::rail_service::ReceiptAnswer>,
        },
        RailApply {
            root: PathBuf,
            request: Box<cadence::rail::risk::Apply>,
            reply: oneshot::Sender<crate::server::rail_service::Answer>,
        },
        Pause {
            input: cadence::pause::Input,
            reply: oneshot::Sender<Result<crate::server::pause_service::Response>>,
        },
        NextAction {
            root: PathBuf,
            reply: oneshot::Sender<
                std::result::Result<Option<cadence::next_action::Action>, DerivationError>,
            >,
        },
        Evidence {
            root: PathBuf,
            command: Command,
            reply: oneshot::Sender<Result<Recovery>>,
        },
        ExecutionRefusal {
            root: PathBuf,
            tool: cadence::execution::model::BoundaryTool,
            raw: Option<serde_json::Value>,
            failure: execution_service::ValidationFailure,
            reply: oneshot::Sender<execution_service::Answer>,
        },
        ExecutionQuery {
            root: PathBuf,
            phase: u32,
            reply: oneshot::Sender<execution_service::Answer>,
        },
        NativeExecutionApply {
            root: PathBuf,
            raw: serde_json::Value,
            reply: oneshot::Sender<Result<serde_json::Value>>,
        },
        NativeExecutionHistory {
            root: PathBuf,
            phase: u32,
            reply: oneshot::Sender<Result<serde_json::Value>>,
        },
        ExecutionApply {
            root: PathBuf,
            patch: cadence::execution::model::ExecutorPatch,
            reply: oneshot::Sender<execution_service::Answer>,
        },
        Lifecycle {
            root: PathBuf,
            reply: oneshot::Sender<std::result::Result<Lifecycle, DerivationError>>,
        },
        Store {
            root: PathBuf,
            operation: Box<Operation>,
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
                        Request::Plan {
                            root,
                            command,
                            reply,
                        } => {
                            let result =
                                crate::server::plan_service::execute(&factory, &root, command)
                                    .await;
                            let _ = reply.send(result);
                        }
                        Request::Context {
                            root,
                            command,
                            reply,
                        } => {
                            let result =
                                crate::server::context_service::execute(&factory, &root, command)
                                    .await;
                            let _ = reply.send(result);
                        }
                        Request::Review {
                            root,
                            command,
                            reply,
                        } => {
                            let result =
                                crate::server::review_service::execute(&factory, &root, *command)
                                    .await;
                            let _ = reply.send(result);
                        }
                        Request::Config {
                            root,
                            command,
                            reply,
                        } => {
                            let result =
                                crate::server::config_service::execute(&factory, &root, command)
                                    .await;
                            let _ = reply.send(result);
                        }
                        Request::RailReceipt {
                            root,
                            command,
                            reply,
                        } => {
                            let result =
                                crate::server::rail_service::receipt(&factory, &root, *command)
                                    .await;
                            let _ = reply.send(result);
                        }
                        Request::RailApply {
                            root,
                            request,
                            reply,
                        } => {
                            let result =
                                crate::server::rail_service::apply(&factory, &root, *request).await;
                            let _ = reply.send(result);
                        }
                        Request::Pause { input, reply } => {
                            let result =
                                crate::server::pause_service::execute(&factory, input, &driver)
                                    .await;
                            let _ = reply.send(result);
                        }
                        Request::NextAction { root, reply } => {
                            let result =
                                crate::server::next_action_service::query(&factory, &root, &driver)
                                    .await;
                            let _ = reply.send(result);
                        }
                        Request::Evidence {
                            root,
                            command,
                            reply,
                        } => {
                            let result = evidence_service::execute(&factory, &root, command).await;
                            let _ = reply.send(result);
                        }
                        Request::ExecutionRefusal {
                            root,
                            tool,
                            raw,
                            failure,
                            reply,
                        } => {
                            let result = execution_service::refuse_arguments(
                                &factory, &root, tool, raw, failure,
                            )
                            .await;
                            let _ = reply.send(result);
                        }
                        Request::ExecutionQuery { root, phase, reply } => {
                            let result =
                                execution_service::query(&factory, &root, phase, &driver).await;
                            let _ = reply.send(result);
                        }
                        Request::NativeExecutionApply {root,raw,reply} => {
                            let _=reply.send(execution_service::native_apply(&factory,&root,raw).await);
                        }
                        Request::NativeExecutionHistory { root, phase, reply } => {
                            let _ = reply.send(crate::server::execution_runner_service::read(&factory, &root, phase).await);
                        }
                        Request::ExecutionApply { root, patch, reply } => {
                            let result =
                                execution_service::apply(&factory, &root, patch, &driver).await;
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
                                Ok(session) => session.request(*operation).await,
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

        pub async fn plan(
            &self,
            root: &Path,
            command: crate::server::plan_service::Command,
        ) -> Result<cadence::plan::model::Answer> {
            let (reply, receive) = oneshot::channel();
            self.requests
                .send(Request::Plan {
                    root: root.into(),
                    command,
                    reply,
                })
                .await
                .map_err(|_| Error::Closed)?;
            receive.await.map_err(|_| Error::Closed)?
        }

        pub async fn context(
            &self,
            root: &Path,
            command: crate::server::context_service::Command,
        ) -> Result<cadence::context::model::Answer> {
            let (reply, receive) = oneshot::channel();
            self.requests
                .send(Request::Context {
                    root: root.into(),
                    command,
                    reply,
                })
                .await
                .map_err(|_| Error::Closed)?;
            receive.await.map_err(|_| Error::Closed)?
        }

        pub async fn review(
            &self,
            root: &Path,
            command: crate::server::review_service::Command,
        ) -> crate::server::review_service::Answer {
            let (reply, receive) = oneshot::channel();
            self.requests
                .send(Request::Review {
                    root: root.into(),
                    command: Box::new(command),
                    reply,
                })
                .await
                .map_err(|_| Error::Closed)?;
            receive.await.map_err(|_| Error::Closed)?
        }

        pub async fn config_interview(
            &self,
            root: &Path,
            mode: crate::config::interview::Mode,
        ) -> crate::server::config_service::Answer {
            self.config(
                root,
                crate::server::config_service::Command::Interview(mode),
            )
            .await
        }

        pub async fn config(
            &self,
            root: &Path,
            command: crate::server::config_service::Command,
        ) -> crate::server::config_service::Answer {
            let (reply, completion) = oneshot::channel();
            self.requests
                .send(Request::Config {
                    root: root.into(),
                    command,
                    reply,
                })
                .await
                .map_err(|_| Error::Closed)?;
            completion.await.map_err(|_| Error::Closed)?
        }

        pub async fn rail_receipt(
            &self,
            root: &Path,
            command: crate::server::rail_service::ReceiptCommand,
        ) -> crate::server::rail_service::ReceiptAnswer {
            let (reply, completion) = oneshot::channel();
            self.requests
                .send(Request::RailReceipt {
                    root: root.into(),
                    command: Box::new(command),
                    reply,
                })
                .await
                .map_err(|_| Error::Closed)?;
            completion.await.map_err(|_| Error::Closed)?
        }

        pub async fn apply_rail(
            &self,
            root: &Path,
            request: cadence::rail::risk::Apply,
        ) -> crate::server::rail_service::Answer {
            let (reply, completion) = oneshot::channel();
            self.requests
                .send(Request::RailApply {
                    root: root.into(),
                    request: Box::new(request),
                    reply,
                })
                .await
                .map_err(|_| Error::Closed)?;
            completion.await.map_err(|_| Error::Closed)?
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

        pub async fn pause(
            &self,
            input: cadence::pause::Input,
        ) -> Result<crate::server::pause_service::Response> {
            let (reply, completion) = oneshot::channel();
            self.requests
                .send(Request::Pause { input, reply })
                .await
                .map_err(|_| Error::Closed)?;
            completion.await.map_err(|_| Error::Closed)?
        }

        pub async fn next_action(
            &self,
            root: &Path,
        ) -> std::result::Result<Option<cadence::next_action::Action>, DerivationError> {
            let (reply, completion) = oneshot::channel();
            self.requests
                .send(Request::NextAction {
                    root: root.into(),
                    reply,
                })
                .await
                .map_err(|_| derivation_service::store_error(Error::Closed))?;
            completion
                .await
                .map_err(|_| derivation_service::store_error(Error::Closed))?
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
                    operation: Box::new(operation),
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

        #[cfg(test)]
        pub fn closed_for_test() -> Self {
            let (requests, receiver) = mpsc::channel(1);
            drop(receiver);
            Self { requests }
        }

        pub async fn refuse_execution_arguments(
            &self,
            root: &Path,
            tool: cadence::execution::model::BoundaryTool,
            raw: Option<serde_json::Value>,
            failure: execution_service::ValidationFailure,
        ) -> execution_service::Answer {
            let (reply, completion) = oneshot::channel();
            self.requests
                .send(Request::ExecutionRefusal {
                    root: root.into(),
                    tool,
                    raw,
                    failure,
                    reply,
                })
                .await
                .map_err(|_| execution_service::Failure::Closed)?;
            completion
                .await
                .map_err(|_| execution_service::Failure::Closed)?
        }

        pub async fn query_execution(&self, root: &Path, phase: u32) -> execution_service::Answer {
            let (reply, completion) = oneshot::channel();
            if self
                .requests
                .send(Request::ExecutionQuery {
                    root: root.into(),
                    phase,
                    reply,
                })
                .await
                .is_err()
            {
                return resident_closed();
            }
            completion.await.unwrap_or_else(|_| resident_closed())
        }

        pub async fn native_execution_apply(&self,root:&Path,raw:serde_json::Value) -> Result<serde_json::Value> {
            let (reply,result)=oneshot::channel();
            self.requests.send(Request::NativeExecutionApply {root:root.to_path_buf(),raw,reply}).await.map_err(|_|Error::Closed)?;
            result.await.map_err(|_|Error::Closed)?
        }

        pub async fn native_execution_history(&self, root: &Path, phase: u32) -> Result<serde_json::Value> {
            let (reply, result) = oneshot::channel();
            self.requests.send(Request::NativeExecutionHistory { root: root.to_path_buf(), phase, reply }).await.map_err(|_| Error::Closed)?;
            result.await.map_err(|_| Error::Closed)?
        }

        pub async fn apply_executor_patch(
            &self,
            root: &Path,
            patch: cadence::execution::model::ExecutorPatch,
        ) -> execution_service::Answer {
            let (reply, completion) = oneshot::channel();
            if self
                .requests
                .send(Request::ExecutionApply {
                    root: root.into(),
                    patch,
                    reply,
                })
                .await
                .is_err()
            {
                return resident_closed();
            }
            completion.await.unwrap_or_else(|_| resident_closed())
        }
    }

    fn resident_closed() -> execution_service::Answer {
        Err(execution_service::Failure::Closed)
    }
}
