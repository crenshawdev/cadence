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
        /// The phase a captured item named (D-144), so recall can be filtered
        /// by it instead of parsing the snippet back out.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        phase: Option<u32>,
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
                phase: r.phase,
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
                phase: None,
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
    #[serde(default)]
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phase: Option<u32>,
    pub provenance: Provenance,
}

impl Provenance {
    fn source(&self) -> &str {
        match self {
            Self::Record { source, .. } => source,
            Self::Document { path, .. } | Self::Residue { path, .. } => path,
        }
    }

    fn phase(&self) -> Option<u32> {
        match self {
            Self::Record { phase, .. } => phase.filter(|phase| *phase > 0),
            Self::Document { path, .. } => documents::phase_of(path),
            Self::Residue { phase, .. } => documents::canonical_phase(phase),
        }
    }
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
        self.query_phase(query, limit, backend, None)
    }

    pub fn query_phase(&self, query: &str, limit: Option<i64>, backend: &str, phase: Option<u32>) -> Result<Answer, String> {
        if phase == Some(0) { return Err("phase must be a positive integer".into()); }
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
        let matched: Vec<_> = self.index.search(query).into_iter()
            .filter(|(i, _)| phase.is_none_or(|phase| self.candidates[*i].provenance.phase() == Some(phase)))
            .collect();
        answer.total = matched.len();
        answer.results = matched
            .into_iter()
            .take(limit as usize)
            .map(|(i, score)| Hit {
                score: (score * 10000.0).round() / 10000.0,
                snippet: self.candidates[i].text.clone(),
                source: self.candidates[i].provenance.source().into(),
                phase: self.candidates[i].provenance.phase(),
                provenance: self.candidates[i].provenance.clone(),
            })
            .collect();
        Ok(answer)
    }
}

// Runtime and filesystem work live outside the ranker and renderer. The task
// owns every derived index; handles only send requests and await their reply.
pub use resident::Resident;
pub(crate) mod resident {
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
        Shutdown,
        Debug {
            root: PathBuf,
            command: crate::server::debug_service::Command,
            reply: oneshot::Sender<Result<serde_json::Value>>,
        },
        Spike {
            root: PathBuf,
            command: crate::server::spike_service::Command,
            reply: oneshot::Sender<Result<serde_json::Value>>,
        },
        Task {
            root: PathBuf,
            command: crate::server::task_service::Command,
            reply: oneshot::Sender<Result<serde_json::Value>>,
        },
        Undo {
            root: PathBuf,
            command: crate::server::undo_service::Command,
            reply: oneshot::Sender<Result<serde_json::Value>>,
        },
        Milestone {
            root: PathBuf,
            command: crate::server::milestone_service::Command,
            reply: oneshot::Sender<Result<serde_json::Value>>,
        },
        Landing {
            root: PathBuf,
            command: crate::server::landing_service::Command,
            reply: oneshot::Sender<Result<serde_json::Value>>,
        },
        Suggest {
            root: PathBuf,
            phase: Option<u32>,
            reply: oneshot::Sender<Result<serde_json::Value>>,
        },
        Why {
            root: PathBuf,
            request: crate::server::why_service::Request,
            reply: oneshot::Sender<Result<serde_json::Value>>,
        },
        Progress {
            root: PathBuf,
            reply: oneshot::Sender<std::result::Result<serde_json::Value, DerivationError>>,
        },
        Adoption {
            root: PathBuf,
            apply: crate::server::adoption_service::Apply,
            reply: oneshot::Sender<Result<serde_json::Value>>,
        },
        Capture {
            root: PathBuf,
            apply: crate::server::capture_service::Apply,
            reply: oneshot::Sender<Result<serde_json::Value>>,
        },
        Verification {
            root: PathBuf,
            command: crate::server::verification_service::Command,
            reply: oneshot::Sender<Result<serde_json::Value>>,
        },
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
            plan: Option<std::num::NonZeroU32>,
            reply: oneshot::Sender<execution_service::Answer>,
        },
        NativeExecutionApply {
            root: PathBuf,
            raw: serde_json::Value,
            reply: oneshot::Sender<Result<serde_json::Value>>,
        },
        NativeRefusal {
            root: PathBuf,
            raw: serde_json::Value,
            answer: serde_json::Value,
            reply: oneshot::Sender<Result<()>>,
        },
        NativeExecutionHistory {
            root: PathBuf,
            phase: u32,
            run: Option<String>,
            plan: Option<u32>,
            task: Option<String>,
            reply: oneshot::Sender<Result<serde_json::Value>>,
        },
        Read {
            root: PathBuf,
            query: cadence::read::Query,
            reply: oneshot::Sender<serde_json::Value>,
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
            phase: Option<u32>,
            reply: oneshot::Sender<Result<Answer>>,
        },
    }
    type ResidentWorker = tokio::task::JoinHandle<Result<()>>;

    #[derive(Clone)]
    pub struct Resident {
        requests: mpsc::Sender<Request>,
        worker: std::sync::Arc<tokio::sync::Mutex<Option<ResidentWorker>>>,
    }

    /// What a warm corpus was built from: the store by generation and
    /// digests, the config by generation, each document by digest and file
    /// identity, and history by the commits and blobs it reached.
    #[derive(PartialEq, Eq)]
    pub(super) struct Inputs {
        store: (u64, String, String),
        config: u64,
        documents: BTreeMap<String, String>,
        file_ids: BTreeMap<String, (u64, u64)>,
        history: BTreeSet<String>,
        incomplete: Vec<String>,
    }
    impl Inputs {
        pub(super) fn new(
            view: &View,
            config: u64,
            docs: documents::Documents,
            file_ids: BTreeMap<String, (u64, u64)>,
            history: history::History,
        ) -> Self {
            Self {
                store: (
                    view.snapshot.generation,
                    view.snapshot.items_digest.clone(),
                    view.snapshot.decisions_digest.clone(),
                ),
                config,
                documents: docs.identities,
                file_ids,
                history: history.identities,
                incomplete: docs.incomplete.into_iter().chain(history.incomplete).collect(),
            }
        }
    }
    pub(crate) struct Cached {
        pub(super) inputs: Inputs,
        pub(super) corpus: Corpus,
        pub(super) phase: Option<u32>,
    }
    impl Cached {
        /// The warm corpus answers only while everything it was built from,
        /// and the phase it was built for, is unchanged.
        pub(super) fn answers(&self, inputs: &Inputs, phase: Option<u32>) -> bool {
            self.inputs == *inputs && self.phase == phase
        }
    }

    fn prepare(root: &Path, view: &View, config: &Generation) -> (Inputs, Vec<Candidate>) {
        let mut docs = documents::read(root, &mut documents::Files);
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
        candidates.extend(std::mem::take(&mut docs.candidates));
        let mut history = history::read(root, view, &candidates, &mut cadence::process::System);
        candidates.extend(std::mem::take(&mut history.candidates));
        (Inputs::new(view, config.number, docs, file_ids, history), candidates)
    }

    /// The backend recall answers with, as the config reloaded for this
    /// request names it.
    pub(super) fn backend(values: &serde_json::Value) -> Result<&str> {
        merge::get(values, "memory.backend")
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| Error::Policy("recall controlling config unavailable".into()))
    }

    pub(crate) async fn answer<I: ConfigIo>(
        session: &Session<I>,
        root: &Path,
        query: &str,
        limit: Option<i64>,
        phase: Option<u32>,
        cache: &mut Option<Cached>,
    ) -> Result<Answer> {
        // Reads through the same owner as writes. Since this task serializes
        // its operations, only another supplied session client can change the
        // generation during I/O; rechecking below catches that too.
        let view = session.shared_derivation_view().await?;
        let config = session.config()?;
        let backend = backend(&config.effective.values)?;
        // Validate arguments and backend before any expensive corpus read.
        let empty = Corpus::new(vec![], &BTreeSet::new());
        let disabled = empty.query_phase(query, limit, backend, phase).map_err(Error::Invalid)?;
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
        let latest = session.shared_derivation_view().await?;
        let latest_config = session.config()?;
        if latest.snapshot != view.snapshot || latest_config != config {
            *cache = None;
            return Err(Error::Conflict(
                "recall inputs changed during preparation; retry with current generation".into(),
            ));
        }
        if cache.as_ref().is_none_or(|cached| !cached.answers(&inputs, phase)) {
            *cache = Some(Cached {
                inputs,
                corpus: Corpus::new(candidates, &declined(&latest)),
                phase,
            });
        }
        let cached = cache.as_ref().expect("prepared cache");
        let mut result = cached
            .corpus
            .query_phase(query, limit, backend, phase)
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
            let worker = tokio::spawn(async move {
                let mut caches = BTreeMap::<PathBuf, Option<Cached>>::new();
                let mut read_domains = BTreeMap::<PathBuf, cadence::read::ReadDomain>::new();
                // Treeless task episodes live here for the run and nowhere else (D-209).
                let mut task_episodes = crate::server::task_service::Episodes::default();
                while let Some(request) = receiver.recv().await {
                    match request {
                        Request::Shutdown => receiver.close(),
                        Request::Milestone { root, command, reply } => {
                            let _ = reply.send(crate::server::milestone_service::execute(&factory, &root, command, &mut cadence::process::System).await);
                        }
                        Request::Landing { root, command, reply } => {
                            let _ = reply.send(crate::server::landing_service::execute(&factory, &root, command, &mut cadence::process::System).await);
                        }
                        Request::Undo { root, command, reply } => {
                            let _ = reply.send(crate::server::undo_service::execute(
                                    &factory,
                                    &root,
                                    command,
                                    &mut cadence::process::System,
                                )
                                .await);
                        }
                        Request::Debug { root, command, reply } => {
                            let _ = reply.send(crate::server::debug_service::execute(&factory, &root, command, &mut cadence::process::System).await);
                        }
                        Request::Spike { root, command, reply } => {
                            let _ = reply.send(crate::server::spike_service::execute(&factory, &root, command).await);
                        }
                        Request::Task { root, command, reply } => {
                            let _ = reply.send(crate::server::task_service::execute(&factory, &root, command, &mut task_episodes).await);
                        }
                        Request::Suggest { root, phase, reply } => {
                            let result = crate::server::suggest_service::query(&factory, &root, phase).await;
                            let _ = reply.send(result);
                        }
                        Request::Why { root, request, reply } => {
                            if request.phase.is_some() || request.part.is_some() {
                                let result = if request.path.is_some() || request.line.is_some() || request.top.is_some()
                                    || request.phase.is_none() || request.part.as_deref() != Some("refusals") {
                                    Ok(cadence::envelope::Refusal::new("invalid-arguments",
                                        "why takes either path/line/top or phase with part=refusals").slot("arguments").value())
                                } else {
                                    match factory.first_touch(&root).await {
                                        Ok(session) => session.derivation_view().await.map(|view|
                                            crate::server::why_service::refusals(&view, request.phase.unwrap())),
                                        Err(error) => Err(error),
                                    }
                                };
                                let _ = reply.send(result);
                                continue;
                            }
                            // git and the record are read on a blocking thread
                            // so a long chain never holds the resident's loop.
                            let result = tokio::task::spawn_blocking(move || {
                                crate::server::why_service::query(&root, &request, &mut cadence::process::System)
                            })
                                .await.map_err(|_| Error::Closed);
                            let _ = reply.send(result);
                        }
                        Request::Progress { root, reply } => {
                            let result = crate::server::progress_service::query(&factory, &root, &driver).await;
                            let _ = reply.send(result);
                        }
                        Request::Adoption { root, apply, reply } => {
                            let result = crate::server::adoption_service::execute(&factory, &root, apply).await;
                            let _ = reply.send(result);
                        }
                        Request::Capture { root, apply, reply } => {
                            let result = crate::server::capture_service::execute(&factory, &root, apply).await;
                            let _ = reply.send(result);
                        }
                        Request::Read { root, query, reply } => {
                            let result = crate::server::read_service::execute(
                                &mut read_domains,
                                &root,
                                query,
                                &mut cadence::process::System,
                            );
                            let _ = reply.send(result);
                        }
                        Request::Verification { root, command, reply } => {
                            let result = crate::server::verification_service::execute(&factory, &root, command, &mut cadence::process::System).await;
                            let _ = reply.send(result);
                        }
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
                            mut command,
                            reply,
                        } => {
                            if let crate::server::review_service::Command::Apply(crate::server::review_service::Apply::MaterialAppend {
                                path, bytes, ..
                            }) = command.as_mut() {
                                let acquired = path.as_deref()
                                    .ok_or_else(|| "review-material-append names no path".to_string())
                                    .and_then(|relative| project_source(&root, relative));
                                match acquired {
                                    Ok((issued_path, issued_bytes)) => { *path = Some(issued_path); *bytes = issued_bytes; }
                                    Err(reason) => {
                                        let _ = reply.send(Ok(crate::server::review_service::refused(reason)));
                                        continue;
                                    }
                                }
                            }
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
                                crate::server::rail_service::receipt(&factory, &root, *command, &mut cadence::process::System)
                                    .await;
                            let _ = reply.send(result);
                        }
                        Request::RailApply {
                            root,
                            request,
                            reply,
                        } => {
                            let result =
                                crate::server::rail_service::apply(&factory, &root, *request)
                                    .await;
                            let _ = reply.send(result);
                        }
                        Request::Pause { input, reply } => {
                            let result =
                                crate::server::pause_service::execute(&factory, input, &driver, &mut cadence::process::System)
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
                        Request::ExecutionQuery { root, phase, plan, reply } => {
                            let result =
                                execution_service::query_selected(&factory, &root, phase, plan, &driver, &mut cadence::process::System).await;
                            let _ = reply.send(result);
                        }
                        Request::NativeExecutionApply {root,raw,reply} => {
                            let _=reply.send(execution_service::native_apply(&factory, &root, raw, &mut cadence::process::System)
                                    .await);
                        }
                        Request::NativeRefusal { root, raw, answer, reply } => {
                            let _ = reply.send(execution_service::record_native_refusal(&factory, &root, &raw, &answer).await);
                        }
                        Request::NativeExecutionHistory { root, phase, run, plan, task, reply } => {
                            let _ = reply.send(match run {
                                Some(run) => crate::server::execution_runner_service::read_run(&factory, &root, phase, &run).await,
                                None => crate::server::execution_runner_service::read(&factory, &root, phase, plan, task, &mut cadence::process::System).await,
                            });
                        }
                        Request::ExecutionApply { root, patch, reply } => {
                            let result =
                                execution_service::apply(
                                    &factory,
                                    &root,
                                    patch,
                                    &driver
                                )
                                .await;
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
                            phase,
                            reply,
                        } => {
                            let result = match reload::identity(&root) {
                                Ok(root) => {
                                    let cache = caches.entry(root.clone()).or_default();
                                    let result = match factory.first_touch(&root).await {
                                        Ok(session) => {
                                            answer(&session, &root, &query, limit, phase, cache).await
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
                // Every accepted request has finished; now close and join all writers.
                factory.shutdown().await
            });
            Self { requests, worker: std::sync::Arc::new(tokio::sync::Mutex::new(Some(worker))) }
        }

        pub async fn shutdown(&self) -> Result<()> {
            let mut worker = self.worker.lock().await;
            if let Some(handle) = worker.take() {
                let _ = self.requests.send(Request::Shutdown).await;
                handle.await.map_err(|_| Error::Closed)??;
            }
            Ok(())
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

        pub async fn verification(&self, root: &Path, query: cadence::verification::model::Query) -> Result<serde_json::Value> {
            let (reply, receive) = oneshot::channel();
            self.requests.send(Request::Verification { root: root.into(), command: crate::server::verification_service::Command::Query(query), reply }).await.map_err(|_| Error::Closed)?;
            receive.await.map_err(|_| Error::Closed)?
        }

        pub async fn verification_apply(&self, root: &Path, input: cadence::verification::model::Apply) -> Result<serde_json::Value> {
            let (reply, receive) = oneshot::channel();
            self.requests.send(Request::Verification { root: root.into(), command: crate::server::verification_service::Command::Apply(input), reply }).await.map_err(|_| Error::Closed)?;
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

        pub async fn progress(&self, root: &Path) -> std::result::Result<serde_json::Value, DerivationError> {
            let (reply, completion) = oneshot::channel();
            self.requests.send(Request::Progress { root: root.into(), reply }).await
                .map_err(|_| derivation_service::store_error(Error::Closed))?;
            completion.await.map_err(|_| derivation_service::store_error(Error::Closed))?
        }

        pub async fn suggest(&self, root: &Path, phase: Option<u32>) -> Result<serde_json::Value> {
            let (reply, completion) = oneshot::channel();
            self.requests.send(Request::Suggest { root: root.into(), phase, reply }).await
                .map_err(|_| Error::Closed)?;
            completion.await.map_err(|_| Error::Closed)?
        }

        pub async fn milestone(&self, root: &Path, command: crate::server::milestone_service::Command) -> Result<serde_json::Value> {
            let (reply, receive) = oneshot::channel();
            self.requests.send(Request::Milestone { root: root.into(), command, reply }).await.map_err(|_| Error::Closed)?;
            receive.await.map_err(|_| Error::Closed)?
        }

        pub async fn landing(&self, root: &Path, command: crate::server::landing_service::Command) -> Result<serde_json::Value> {
            let (reply, receive) = oneshot::channel();
            self.requests.send(Request::Landing { root: root.into(), command, reply }).await.map_err(|_| Error::Closed)?;
            receive.await.map_err(|_| Error::Closed)?
        }

        pub async fn undo(&self, root: &Path, command: crate::server::undo_service::Command) -> Result<serde_json::Value> {
            let (reply, receive) = oneshot::channel();
            self.requests.send(Request::Undo { root: root.into(), command, reply }).await.map_err(|_| Error::Closed)?;
            receive.await.map_err(|_| Error::Closed)?
        }

        pub async fn debug(&self, root: &Path, command: crate::server::debug_service::Command) -> Result<serde_json::Value> {
            let (reply, receive) = oneshot::channel();
            self.requests.send(Request::Debug { root: root.into(), command, reply }).await.map_err(|_| Error::Closed)?;
            receive.await.map_err(|_| Error::Closed)?
        }

        pub async fn spike(&self, root: &Path, command: crate::server::spike_service::Command) -> Result<serde_json::Value> {
            let (reply, receive) = oneshot::channel();
            self.requests.send(Request::Spike { root: root.into(), command, reply }).await.map_err(|_| Error::Closed)?;
            receive.await.map_err(|_| Error::Closed)?
        }
        pub async fn task(&self, root: &Path, command: crate::server::task_service::Command) -> Result<serde_json::Value> {
            let (reply, receive) = oneshot::channel();
            self.requests.send(Request::Task { root: root.into(), command, reply }).await.map_err(|_| Error::Closed)?;
            receive.await.map_err(|_| Error::Closed)?
        }

        pub async fn why(&self, root: &Path, request: crate::server::why_service::Request) -> Result<serde_json::Value> {
            let (reply, completion) = oneshot::channel();
            self.requests.send(Request::Why { root: root.into(), request, reply }).await
                .map_err(|_| Error::Closed)?;
            completion.await.map_err(|_| Error::Closed)?
        }

        pub async fn adoption(&self, root: &Path, apply: crate::server::adoption_service::Apply) -> Result<serde_json::Value> {
            let (reply, completion) = oneshot::channel();
            self.requests.send(Request::Adoption { root: root.into(), apply, reply }).await.map_err(|_| Error::Closed)?;
            completion.await.map_err(|_| Error::Closed)?
        }

        pub async fn capture(&self, root: &Path, apply: crate::server::capture_service::Apply) -> Result<serde_json::Value> {
            let (reply, completion) = oneshot::channel();
            self.requests.send(Request::Capture { root: root.into(), apply, reply }).await.map_err(|_| Error::Closed)?;
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
            self.recall_phase(root, query, limit, None).await
        }

        pub async fn recall_phase(&self, root: &Path, query: &str, limit: Option<i64>, phase: Option<u32>) -> Result<Answer> {
            let (reply, completion) = oneshot::channel();
            self.requests
                .send(Request::Recall {
                    root: root.into(),
                    query: query.into(),
                    limit,
                    phase,
                    reply,
                })
                .await
                .map_err(|_| Error::Closed)?;
            completion.await.map_err(|_| Error::Closed)?
        }

        pub async fn read(&self, root: &Path, query: cadence::read::Query) -> serde_json::Value {
            let (reply, completion) = oneshot::channel();
            if self.requests.send(Request::Read { root: root.into(), query, reply }).await.is_err() {
                return crate::server::read_service::unavailable("resident closed");
            }
            completion.await.unwrap_or_else(|_| crate::server::read_service::unavailable("resident closed"))
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
            self.query_selected_execution(root, phase, None).await
        }

        pub async fn query_selected_execution(&self, root: &Path, phase: u32,
            plan: Option<std::num::NonZeroU32>) -> execution_service::Answer {
            let (reply, completion) = oneshot::channel();
            if self
                .requests
                .send(Request::ExecutionQuery {
                    root: root.into(),
                    phase,
                    plan,
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

        pub async fn record_native_refusal(&self, root: &Path, raw: serde_json::Value, answer: serde_json::Value) -> Result<()> {
            let (reply, result) = oneshot::channel();
            self.requests.send(Request::NativeRefusal { root: root.into(), raw, answer, reply }).await.map_err(|_| Error::Closed)?;
            result.await.map_err(|_| Error::Closed)?
        }

        pub async fn native_execution_history(&self, root: &Path, phase: u32, run: Option<String>, plan: Option<u32>, task: Option<String>) -> Result<serde_json::Value> {
            let (reply, result) = oneshot::channel();
            self.requests.send(Request::NativeExecutionHistory { root: root.to_path_buf(), phase, run, plan, task, reply }).await.map_err(|_| Error::Closed)?;
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

    /// The canonical path and bytes of one project source file named relative to
    /// the project; a path outside the project or inside the planning root is refused.
    pub(super) fn project_source(planning_root: &Path, relative: &str) -> std::result::Result<(String, Vec<u8>), String> {
        let project = planning_root.parent().and_then(|project| std::fs::canonicalize(project).ok())
            .ok_or_else(|| "planning root has no project parent".to_string())?;
        let path = std::fs::canonicalize(project.join(relative)).map_err(|error| format!("{relative}: {error}"))?;
        let records = std::fs::canonicalize(planning_root).unwrap_or_else(|_| planning_root.to_path_buf());
        if !path.starts_with(&project) || path.starts_with(&records) {
            return Err(format!("{relative} is not a project source file"));
        }
        let text = cadence::acquisition::text(&path, cadence::acquisition::Class::Source).map_err(|error| error.to_string())?;
        Ok((path.to_string_lossy().into_owned(), text.into_bytes()))
    }
}
