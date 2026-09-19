pub mod decisions;
pub mod items;

use cadence::store::model::digest;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Source {
    pub path: String,
    pub bytes: Vec<u8>,
}
impl Source {
    pub fn generation(&self) -> String {
        digest(&self.bytes)
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SourceEvidence {
    pub source: Source,
    pub generation: String,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub layer: Option<Layer>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub global_alias: Option<PathBuf>,
}
impl SourceEvidence {
    pub fn original(source: &Source) -> Self {
        Self {
            source: source.clone(),
            generation: source.generation(),
            label: "non_effective_original_source".into(),
            layer: None,
            global_alias: None,
        }
    }
}

use crate::config::{
    self, Diagnostic, Effective, Layer, merge,
    reload::{self, ConfigIo, FileIo, Generation, Input, Paths, Reload, Shared},
    write,
};
use cadence::adoption;
use cadence::derivation::{
    self, ArtifactFiles, ArtifactIo, InputFailure, InputFailureCategory, Observation,
};
use cadence::store::{
    Error, MutationContext, Policy, Result, Storage,
    filesystem::Stage,
    model::{DECISIONS, ITEMS, STATE, Snapshot},
    transaction::{ExternalChange, INTENT, Transaction},
    writer::{Operation, Store, View},
};
use serde_json::{Value, json};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

pub type Evaluate = Arc<dyn Fn(&MutationContext<'_>, &Generation) -> Result<()> + Send + Sync>;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SourceGuard {
    pub path: PathBuf,
    pub identity: PathBuf,
    pub content: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ImportManifest {
    pub format: u32,
    pub complete: bool,
    pub source_generation: String,
    pub sources: Vec<SourceGuard>,
    pub active: Paths,
    pub created: Vec<PathBuf>,
    pub warnings: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shared_global: Option<SourceGuard>,
}

/// Snapshot field holding the layer mapping as it stands now. The import
/// manifest keeps where the layers were at import and never changes; this
/// record keeps where they are, the digest of the global layer's bytes as the
/// store last wrote them (the writer refreshes it on every global-config
/// participant), and every relocation the store accepted.
pub const LAYERS: &str = "layers";

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct LayerRecord {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active: Option<Paths>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub global_content: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub relocations: Vec<Relocation>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Relocation {
    pub from: PathBuf,
    pub to: PathBuf,
    /// The generation that recorded the move.
    pub generation: u64,
}

struct ImportInputs {
    manifest: ImportManifest,
    generation: Generation,
    transaction: Transaction,
    /// The ticked phases the documents cannot derive complete, with the root
    /// binding their records carry; the records land in the import's own
    /// transaction once its committing generation is known.
    declared: Vec<adoption::Declaration>,
    root_binding: String,
}

/// Reads the lifecycle documents through the import's own reader, so the
/// bytes a declaration is computed from are exactly the bytes its source
/// guard names. Listing and probing a phase directory stay with the
/// derivation's reader; a document the reader cannot open refuses the import
/// the way an unreadable legacy source does.
struct GuardedDocuments<'a, I: ConfigIo> {
    io: &'a mut I,
    files: ArtifactFiles,
    guards: Vec<SourceGuard>,
    failure: Option<Error>,
}

impl<I: ConfigIo> ArtifactIo for GuardedDocuments<'_, I> {
    fn resolve_root(&mut self, selected: &Path) -> std::result::Result<PathBuf, InputFailure> {
        self.files.resolve_root(selected)
    }
    fn probe_root(&mut self, root: &Path) -> Observation<()> {
        self.files.probe_root(root)
    }
    fn list_phase(&mut self, path: &Path) -> Observation<Vec<String>> {
        self.files.list_phase(path)
    }
    fn probe_summary(&mut self, path: &Path) -> Observation<()> {
        match self.read(path) {
            Observation::Present(_) => Observation::Present(()),
            Observation::Absent => Observation::Absent,
            Observation::Failed(failure) => Observation::Failed(failure),
        }
    }
    fn read(&mut self, path: &Path) -> Observation<Vec<u8>> {
        match observe(self.io, path) {
            Ok(input) => {
                self.guards.push(guard(path.to_owned(), &input));
                match input.bytes {
                    Some(bytes) => Observation::Present(bytes),
                    None => Observation::Absent,
                }
            }
            Err(error) => {
                let diagnostic = error.to_string();
                self.failure.get_or_insert(error);
                Observation::Failed(InputFailure {
                    path: path.to_owned(),
                    category: InputFailureCategory::OtherIo,
                    diagnostic: Some(diagnostic),
                })
            }
        }
    }
}

/// The declaration pass of the import: the roadmap and every phase's
/// documents read the way derivation reads them, the legacy table applied
/// with no native authority, and one declaration per ticked phase it derives
/// short of Complete. ROADMAP.md and each declared phase's SUMMARY.md and
/// UAT.md come back as source guards. An absent or unparseable roadmap
/// declares nothing; an unreadable document refuses the import.
fn declare_at_import<I: ConfigIo>(
    root: &Path,
    io: &mut I,
    existing: &Value,
) -> Result<(Vec<adoption::Declaration>, Vec<SourceGuard>, String)> {
    let mut documents = GuardedDocuments { io, files: ArtifactFiles, guards: Vec::new(), failure: None };
    let capture = derivation::capture_inputs(root, &mut documents)
        .map_err(|error| Error::Io(format!("legacy documents unavailable at import: {error}")))?;
    if let Some(error) = documents.failure {
        return Err(error);
    }
    let roadmap = root.join("ROADMAP.md");
    let take = |guards: &[SourceGuard], path: &Path| guards.iter().find(|g| g.path == path).cloned();
    let mut kept: Vec<SourceGuard> = take(&documents.guards, &roadmap).into_iter().collect();
    let legacy = match derivation::derive(&capture) {
        Ok(legacy) => legacy,
        Err(
            derivation::DerivationError::MissingPlanningRoot { .. }
            | derivation::DerivationError::MissingRoadmap { .. }
            | derivation::DerivationError::InvalidRoadmap { .. },
        ) => return Ok((vec![], kept, String::new())),
        Err(error) => {
            return Err(Error::Io(format!("legacy documents unreadable at import: {error}")));
        }
    };
    let declared = adoption::declarations(&capture, &legacy, existing)?;
    if declared.is_empty() {
        return Ok((vec![], kept, String::new()));
    }
    for declaration in &declared {
        let directory = capture.root.join(format!("phases/{}", declaration.phase));
        for name in ["SUMMARY.md", "UAT.md"] {
            kept.extend(take(&documents.guards, &directory.join(name)));
        }
    }
    let root_binding = cadence::verification::inputs::root_binding(root)?;
    Ok((declared, kept, root_binding))
}

/// The lifecycle documents read the way the import reads them: the capture
/// derivation works from, and one guard per document naming the bytes read.
/// An explicit adoption computes its record from exactly these bytes, so the
/// record's roadmap digest is the digest of what the owner's tree holds.
pub fn observe_documents<I: ConfigIo>(
    root: &Path,
    io: &mut I,
) -> Result<(derivation::CapturedInputs, Vec<SourceGuard>)> {
    let mut documents = GuardedDocuments { io, files: ArtifactFiles, guards: Vec::new(), failure: None };
    let capture = derivation::capture_inputs(root, &mut documents)
        .map_err(|error| Error::Io(format!("legacy documents unavailable: {error}")))?;
    if let Some(error) = documents.failure {
        return Err(error);
    }
    Ok((capture, documents.guards))
}

fn remove_path(value: &mut Value, key: &str) {
    let (head, tail) = key.split_once('.').unwrap_or((key, ""));
    if let Some(object) = value.as_object_mut() {
        if tail.is_empty() {
            object.remove(head);
        } else if let Some(child) = object.get_mut(head) {
            remove_path(child, tail);
        }
    }
}

fn translate_config(global: Option<Value>, repo: Option<Value>) -> Result<Effective> {
    let original_global = global.clone();
    let original_repo = repo.clone();
    let mut normalized = Vec::new();
    let mut normalize = |mut value: Option<Value>, layer| {
        if let Some(raw) = value.as_mut()
            && merge::get(raw, "git.on_protected") == Some(&json!("deny"))
        {
            merge::set(raw, "git.on_protected", json!("refuse"));
            normalized.push(Diagnostic {
                layer,
                key: "git.on_protected".into(),
                reason: "legacy deny normalized to refuse; original retained non-effectively"
                    .into(),
            });
        }
        value
    };
    let mut effective = merge::merge(
        normalize(global, Layer::Global),
        normalize(repo, Layer::Repo),
        false,
    );
    if !effective.diagnostics.invalid_layer.is_empty() {
        return Err(Error::Policy("invalid legacy config layer".into()));
    }
    for (layer, values) in [
        (Layer::Global, &mut effective.global),
        (Layer::Repo, &mut effective.repo),
    ] {
        for (key, spec) in config::schema() {
            if spec["disposition"] == "dead" {
                continue;
            }
            if let Some(value) = merge::get(values, key)
                && (!reload::valid_type(spec, value, true) || !write::valid_grammar(spec, value))
            {
                // Conservatively retain refusal semantics on policy-bearing
                // families; malformed preferences can be preserved as evidence.
                if key.starts_with("git.")
                    || key.starts_with("workflow.")
                    || key.starts_with("review.")
                {
                    return Err(Error::Policy(format!(
                        "invalid legacy permission: {key} in {layer:?}"
                    )));
                }
                remove_path(values, key);
                normalized.push(Diagnostic {
                    layer,
                    key: key.clone(),
                    reason: "invalid preference excluded; original retained non-effectively".into(),
                });
            }
        }
    }
    let clean = merge::merge(
        Some(effective.global.clone()),
        Some(effective.repo.clone()),
        false,
    );
    effective.values = clean.values;
    effective.sources = clean.sources;
    effective.raw_global = original_global;
    effective.raw_repo = original_repo;
    effective.diagnostics.migration.extend(normalized);
    reload::validate_effective(&effective)?;
    Ok(effective)
}

fn observe<I: ConfigIo>(io: &mut I, path: &Path) -> Result<Input> {
    io.read(&reload::identity(path)?)
}
fn guard(path: PathBuf, input: &Input) -> SourceGuard {
    SourceGuard {
        path,
        identity: input.identity.clone(),
        content: input.bytes.as_deref().map(digest),
    }
}
/// The global layer's identity is a canonical path, so a home that moves
/// between a symlink and a real directory changes the layer mapping while
/// every byte stays the same. Only the global layer may move, only to a place
/// holding exactly the bytes the store last knew (the writer's record, or the
/// import's content guard for a store that predates the record), and the
/// refusal names both places. A repo move, an absent record, or different
/// bytes are a different layer mapping and stay refused.
fn relocate_global_layer<I: ConfigIo>(
    io: &mut I,
    manifest: &ImportManifest,
    layers: &LayerRecord,
    recorded: &Paths,
    active: &Paths,
    generation: u64,
) -> Result<LayerRecord> {
    let display = |paths: &Paths| {
        paths
            .global
            .as_deref()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|| "(none)".into())
    };
    let refused = |why: &str| {
        Error::Conflict(format!(
            "changed layer mapping: {why}; global layer recorded at {}, now {}",
            display(recorded),
            display(active)
        ))
    };
    if recorded.repo != active.repo {
        return Err(refused("the repo layer moved"));
    }
    let (Some(old), Some(new)) = (&recorded.global, &active.global) else {
        return Err(refused("the global layer appeared or disappeared"));
    };
    let Some(expected) = layers
        .global_content
        .as_deref()
        .or_else(|| manifest.shared_global.as_ref()?.content.as_deref())
    else {
        return Err(refused(
            "no recorded content proves the new place is the same layer",
        ));
    };
    let current = observe(io, new)?;
    if current.bytes.as_deref().map(digest).as_deref() != Some(expected) {
        return Err(refused(
            "the bytes at the new place differ from the recorded layer",
        ));
    }
    let mut next = layers.clone();
    next.active = Some(active.clone());
    next.global_content = Some(expected.to_owned());
    next.relocations.push(Relocation {
        from: old.clone(),
        to: new.clone(),
        generation,
    });
    Ok(next)
}

fn validate_sources<I: ConfigIo>(io: &mut I, expected: &[SourceGuard]) -> Result<()> {
    for source in expected {
        let current = observe(io, &source.path)?;
        if guard(source.path.clone(), &current) != *source {
            return Err(Error::Conflict(format!(
                "legacy source changed during import: {}",
                source.path.display()
            )));
        }
    }
    Ok(())
}
fn parse_input(input: &Input) -> Result<Option<Value>> {
    input
        .bytes
        .as_deref()
        .map(|b| serde_json::from_slice(b).map_err(Error::from))
        .transpose()
}

fn validate_shared<I: ConfigIo>(io: &mut I, manifest: &ImportManifest) -> Result<()> {
    if let Some(expected) = &manifest.shared_global {
        let current = observe(io, &expected.path)?;
        if guard(expected.path.clone(), &current) != *expected {
            return Err(Error::Conflict(
                "active shared config changed during import".into(),
            ));
        }
    }
    Ok(())
}

fn prepare_import<I: ConfigIo>(
    root: &Path,
    legacy: &Paths,
    active: &Paths,
    io: &mut I,
    owns_global: bool,
    existing: &Value,
) -> Result<ImportInputs> {
    let repo_identity = reload::identity(&legacy.repo)?;
    let global_identity = legacy.global.as_deref().map(reload::identity).transpose()?;
    let global = match &global_identity {
        Some(id) if id != &repo_identity => Some(io.read(id)?),
        _ => None,
    };
    let repo = io.read(&repo_identity)?;
    let shared = match &active.global {
        Some(path) if path != &active.repo && !owns_global => Some(observe(io, path)?),
        _ => None,
    };
    let reused = shared.as_ref().filter(|input| input.bytes.is_some());
    let effective = if let Some(input) = reused {
        let current = parse_input(input)?;
        reload::validate_effective(&merge::merge(current.clone(), None, false))?;
        let translated = translate_config(None, parse_input(&repo)?)?;
        let effective = merge::merge(current, Some(translated.repo), false);
        reload::validate_effective(&effective)?;
        effective
    } else {
        translate_config(
            global.as_ref().map(parse_input).transpose()?.flatten(),
            parse_input(&repo)?,
        )?
    };
    let generation = Generation {
        number: 0,
        global: reused.cloned().or_else(|| global.clone()),
        repo: repo.clone(),
        effective,
    };
    let mut guards = vec![guard(legacy.repo.clone(), &repo)];
    if global.is_none()
        && let Some(path) = &legacy.global
        && path != &legacy.repo
    {
        guards.push(guard(path.clone(), &repo));
    }
    let mut evidence = Vec::new();
    for (path, input) in [
        (Some(&legacy.repo), Some(&repo)),
        (legacy.global.as_ref(), global.as_ref()),
    ] {
        if let (Some(path), Some(input)) = (path, input) {
            if path != &legacy.repo {
                guards.push(guard(path.clone(), input));
            }
            if let Some(bytes) = &input.bytes {
                let mut original = SourceEvidence::original(&Source {
                    path: path.display().to_string(),
                    bytes: bytes.clone(),
                });
                original.layer = Some(if path == &legacy.repo {
                    Layer::Repo
                } else {
                    Layer::Global
                });
                if path == &legacy.repo && global_identity.as_ref() == Some(&repo_identity) {
                    original.global_alias = legacy.global.clone();
                }
                evidence.push(original);
            }
        }
    }
    let mut sources = BTreeMap::new();
    for name in [
        "CAPTURE.md",
        "FILED.md",
        "DECLINED.md",
        "STATE.md",
        "trace.jsonl",
        "trace.1.jsonl",
        "ARCHIVE.md",
    ] {
        let path = root.join(name);
        let input = observe(io, &path)?;
        guards.push(guard(path, &input));
        if let Some(bytes) = input.bytes {
            sources.insert(
                name,
                Source {
                    path: name.into(),
                    bytes,
                },
            );
        }
    }
    let (declared, document_guards, root_binding) = declare_at_import(root, io, existing)?;
    guards.extend(document_guards);
    let items = items::translate(
        sources.get("CAPTURE.md"),
        sources.get("FILED.md"),
        sources.get("DECLINED.md"),
    )?;
    let decisions = decisions::translate(
        sources.get("STATE.md"),
        sources.get("trace.jsonl"),
        sources.get("trace.1.jsonl"),
    )?;
    evidence.extend(items.evidence);
    evidence.extend(decisions.evidence);
    let mut warnings = vec![format!(
        "Retired settings (D-06): {}. Present values are removed; publishing and merging require explicit authorization.",
        config::RETIRED.join(", ")
    )];
    let tokens: Vec<_> = config::schema()
        .keys()
        .filter(|key| key.starts_with("workflow.max_dispatch_tokens."))
        .cloned()
        .collect();
    warnings.push(format!(
        "Retired token-report settings: {}. No terminal-window budget is enforced.",
        tokens.join(", ")
    ));
    for (layer, raw) in [
        (Layer::Global, &generation.effective.raw_global),
        (Layer::Repo, &generation.effective.raw_repo),
    ] {
        let removed: Vec<_> = config::schema()
            .iter()
            .filter(|(_, spec)| spec["disposition"] == "dead")
            .filter(|(key, _)| raw.as_ref().and_then(|r| merge::get(r, key)).is_some())
            .map(|(key, _)| key.clone())
            .collect();
        warnings.push(format!(
            "{layer:?} present and removed: {}",
            if removed.is_empty() {
                "none".into()
            } else {
                removed.join(", ")
            }
        ));
    }
    for diagnostic in generation
        .effective
        .diagnostics
        .scope
        .iter()
        .chain(&generation.effective.diagnostics.migration)
    {
        warnings.push(format!(
            "{:?} {}: {}",
            diagnostic.layer, diagnostic.key, diagnostic.reason
        ));
    }
    warnings.extend(items.warnings);
    warnings.extend(decisions.warnings);
    let mut created: Vec<_> = [ITEMS, DECISIONS, STATE]
        .iter()
        .map(|name| root.join(name))
        .collect();
    created.push(active.repo.clone());
    if reused.is_none() && global.as_ref().is_some_and(|g| g.bytes.is_some()) {
        created.push(active.global.clone().expect("global source address"));
    }
    let source_generation = digest(&serde_json::to_vec(&guards)?);
    let manifest = ImportManifest {
        format: 1,
        complete: true,
        source_generation: source_generation.clone(),
        sources: guards,
        active: active.clone(),
        created,
        warnings,
        shared_global: shared
            .as_ref()
            .filter(|_| {
                reused.is_some() || global.as_ref().is_none_or(|input| input.bytes.is_none())
            })
            .map(|input| guard(active.global.clone().unwrap(), input)),
    };
    let snapshot = json!({"import":manifest,"cursor":decisions.cursor,"source_evidence":evidence,
        "archive":{"path":root.join("ARCHIVE.md"),"maintained":false,"available":sources.contains_key("ARCHIVE.md")}});
    Ok(ImportInputs {
        manifest,
        generation,
        transaction: Transaction {
            id: format!("import:{source_generation}"),
            items: items.records,
            decisions: decisions.records,
            snapshot: Some(snapshot),
            external: vec![],
        },
        declared,
        root_binding,
    })
}

/// The declared completions as the import transaction commits them, at the
/// generation that commit lands: one record per declaration, provenance
/// `declared-at-import`, appended by the one adoption writer.
fn declared_snapshot(
    declared: &[adoption::Declaration],
    root_binding: &str,
    source_generation: &str,
    snapshot: &Value,
    generation: u64,
) -> Result<Value> {
    let records = declared
        .iter()
        .map(|declaration| {
            adoption::record(root_binding, declaration, adoption::AT_IMPORT, generation, source_generation)
        })
        .collect::<Result<Vec<_>>>()?;
    adoption::contribute(snapshot, &records)
}

struct SessionPolicy<I: ConfigIo> {
    config: Shared<I>,
    importing: Arc<Mutex<Option<ImportInputs>>>,
    io: I,
    evaluate: Evaluate,
}
impl<I: ConfigIo> Policy for SessionPolicy<I> {
    fn validate(&mut self, context: &MutationContext<'_>) -> Result<()> {
        self.validate_inputs(context, None)
    }

    fn validate_routing_admission(
        &mut self,
        context: &MutationContext<'_>,
        inputs: &cadence::execution::model::ConfigInputs,
    ) -> Result<()> {
        self.validate_inputs(context, Some(inputs))
    }
}

impl<I: ConfigIo> SessionPolicy<I> {
    fn validate_inputs(
        &mut self,
        context: &MutationContext<'_>,
        expected: Option<&cadence::execution::model::ConfigInputs>,
    ) -> Result<()> {
        if matches!(context.operation, "guard_audit" | "guard_audit_recovery") {
            // The writer and intent validator prove the narrow projection before
            // this exception can admit work with unavailable controlling inputs.
            return Ok(());
        }
        let pending = self
            .importing
            .lock()
            .map_err(|_| Error::Policy("import guard unavailable".into()))?;
        let generation = if let Some(inputs) = pending.as_ref() {
            validate_sources(&mut self.io, &inputs.manifest.sources)?;
            validate_shared(&mut self.io, &inputs.manifest)?;
            if context.operation == "recovery"
                && (context.snapshot.data["import"]["source_generation"]
                    != inputs.manifest.source_generation
                    || context.snapshot.data["import"]["shared_global"]
                        != serde_json::to_value(&inputs.manifest.shared_global)?)
            {
                return Err(Error::Conflict(
                    "pending import source generation changed".into(),
                ));
            }
            inputs.generation.clone()
        } else {
            let mut reload = self
                .config
                .lock()
                .map_err(|_| Error::Policy("config unavailable".into()))?;
            match expected {
                Some(inputs) => reload.refresh_expected(inputs)?,
                None => reload.refresh()?,
            }
        };
        (self.evaluate)(context, &generation)
    }
}

pub struct Session<I: ConfigIo = FileIo> {
    root: PathBuf,
    store: Store,
    config: Shared<I>,
    /// Where the layers were at import. History; never rewritten.
    manifest: ImportManifest,
    /// Where the layers stand now, after every relocation the store accepted.
    active: Paths,
    pub drafts: Arc<Mutex<cadence::import::Drafts>>,
}

#[derive(Clone)]
pub struct PlanDraft {
    pub submission: cadence::plan::model::Submission,
    pub documents: Vec<cadence::read::document::Resolved>,
}

#[derive(Clone)]
pub struct ContextDraft {
    pub submission: cadence::context::model::Submission,
    pub document: cadence::read::document::Resolved,
}

#[derive(Default)]
pub struct Drafts {
    pub plans: std::collections::BTreeMap<(u32, String), PlanDraft>,
    pub contexts: std::collections::BTreeMap<(u32, String), ContextDraft>,
    pub newest_plan: std::collections::BTreeMap<u32, String>,
    pub newest_context: std::collections::BTreeMap<u32, String>,
}

/// Drafts precede the store's approval barrier and survive only this process.
pub fn drafts(root: &Path) -> Result<Arc<Mutex<Drafts>>> {
    type Registry = std::collections::BTreeMap<PathBuf, Arc<Mutex<Drafts>>>;
    static DRAFTS: std::sync::OnceLock<Mutex<Registry>> = std::sync::OnceLock::new();
    let root = reload::identity(root)?;
    let mut registry = DRAFTS.get_or_init(Mutex::default).lock()
        .map_err(|_| Error::Invalid("draft registry unavailable".into()))?;
    Ok(registry.entry(root).or_default().clone())
}
impl<I: ConfigIo> Session<I> {
    /// Saved review operations read admitted policy; the writer still validates
    /// current controlling inputs before every conditional mutation.
    pub fn review_store(&self) -> &Store {
        &self.store
    }

    pub fn import_manifest(&self) -> &ImportManifest {
        &self.manifest
    }
    pub fn active_paths(&self) -> &Paths {
        &self.active
    }
    pub fn config(&self) -> Result<Generation> {
        self.config
            .lock()
            .map_err(|_| Error::Policy("config unavailable".into()))?
            .refresh()
    }
    pub async fn request(&self, operation: Operation) -> Result<View> {
        // Queries refuse unavailable controlling config as well. Keep durable
        // import metadata through later cursor/snapshot changes.
        if !matches!(operation, Operation::GuardAudit(..)) {
            self.config()?;
        }
        let operation = match operation {
            Operation::RewriteSnapshot(value) => {
                let current = self.store.request(Operation::ReadVerified).await?;
                Operation::CompareRewriteSnapshot {
                    expected_generation: current.snapshot.generation,
                    expected_integrity: current.snapshot.integrity,
                    data: replace_current(&current.snapshot.data, value)?,
                }
            }
            Operation::Transact(mut transaction) if transaction.snapshot.is_some() => {
                let current = self.store.request(Operation::ReadVerified).await?;
                transaction.snapshot = Some(replace_current(
                    &current.snapshot.data,
                    transaction.snapshot.take().unwrap(),
                )?);
                Operation::CompareTransact {
                    expected_generation: current.snapshot.generation,
                    expected_integrity: current.snapshot.integrity,
                    transaction,
                }
            }
            other => other,
        };
        self.store.request(operation).await
    }
    pub async fn shared_derivation_view(&self) -> Result<std::sync::Arc<View>> {
        self.config()?;
        self.store.shared_view().await
    }

    pub async fn derivation_view(&self) -> Result<View> {
        self.config()?;
        self.store.request(Operation::ReadVerified).await
    }

    /// Full snapshot data, retaining import ownership and historical evidence.
    /// The supplied generation is checked again by the writer on its owner thread.
    pub async fn commit_derivation(&self, expected: &View, data: Value) -> Result<View> {
        let current = self.derivation_view().await?;
        if current.snapshot.generation != expected.snapshot.generation
            || current.snapshot.integrity != expected.snapshot.integrity
        {
            return Err(Error::Conflict(
                cadence::store::writer::STALE_SNAPSHOT.into(),
            ));
        }
        if !data.is_object() || data.get("import") != current.snapshot.data.get("import") {
            return Err(Error::Invalid(
                "derivation replacement must preserve import manifest".into(),
            ));
        }
        for field in ["source_evidence", "archive", "cursor", LAYERS] {
            if data.get(field) != current.snapshot.data.get(field) {
                return Err(Error::Invalid(format!(
                    "derivation replacement changed provenance: {field}"
                )));
            }
        }
        self.store
            .request(Operation::CompareRewriteSnapshot {
                expected_generation: expected.snapshot.generation,
                expected_integrity: expected.snapshot.integrity.clone(),
                data,
            })
            .await
    }

    /// Evidence owns only its namespace. Derivation retains its separate contract.
    pub async fn commit_evidence(
        &self,
        expected: &View,
        operation_id: &str,
        record: &cadence::evidence::Record,
    ) -> Result<View> {
        use cadence::evidence::persistence;
        self.config()?;
        let decision = persistence::history(operation_id, record)?;
        let current = self.store.request(Operation::ReadVerified).await?;
        // Reconstructing the projection after another write changes attempt data,
        // not the logical input. Recover its immutable receipt before projecting.
        // The comparison is over the content, never the write-time stamp: the
        // retried submit is a second process and never observed the second the
        // first one wrote in.
        if let Some(prior) = current
            .decisions
            .iter()
            .find(|prior| prior.id == decision.id)
        {
            return if prior.same_record(&decision) {
                Ok(current)
            } else {
                Err(Error::Conflict(
                    "operation identity reused for different content".into(),
                ))
            };
        }
        if expected.snapshot.data.get("import") != Some(&serde_json::to_value(&self.manifest)?) {
            return Err(Error::Invalid(
                "evidence proposal must preserve import manifest".into(),
            ));
        }
        let data = persistence::project(&expected.snapshot.data, record)?;
        self.store
            .request(Operation::CompareTransact {
                expected_generation: expected.snapshot.generation,
                expected_integrity: expected.snapshot.integrity.clone(),
                transaction: Transaction {
                    id: decision.id.clone(),
                    items: Vec::new(),
                    decisions: vec![decision],
                    snapshot: Some(data),
                    external: Vec::new(),
                },
            })
            .await
    }

    pub async fn set_config(&self, layer: Layer, key: &str, value: Value) -> Result<View> {
        write::ConfigWriter {
            root: self.root.clone(),
            active: self.active.clone(),
            store: self.store.clone(),
            config: self.config.clone(),
        }
        .set(layer, key, value)
        .await
    }
    pub async fn batch_config(
        &self,
        layer: Layer,
        updates: &[write::Update],
    ) -> Result<write::Written> {
        write::ConfigWriter {
            root: self.root.clone(),
            active: self.active.clone(),
            store: self.store.clone(),
            config: self.config.clone(),
        }
        .batch(layer, updates)
        .await
    }
    pub async fn interview_config(
        &self,
        mode: config::interview::Mode,
        captured: config::interview::Captured,
        accepted: bool,
        answers: Option<&[write::Update]>,
    ) -> Result<Option<write::Written>> {
        if !accepted || answers.is_none() {
            return Ok(None);
        }
        let generation = self.config()?;
        let (layer, updates) =
            config::interview::answers(&generation, mode, &captured, accepted, answers)?;
        write::ConfigWriter {
            root: self.root.clone(),
            active: self.active.clone(),
            store: self.store.clone(),
            config: self.config.clone(),
        }
        .batch_captured(layer, &updates, Some(captured))
        .await
        .map(Some)
    }
    pub async fn capture_report(&self) -> Result<config::CaptureReport> {
        let current = self.config()?;
        let bound = merge::get(&current.effective.values, "planning.max_capture_bullets")
            .and_then(Value::as_u64)
            .ok_or_else(|| Error::Policy("capture report unavailable".into()))?;
        let view = self.store.request(Operation::Read).await?;
        Ok(config::capture_report(&view.items, bound))
    }
}

fn replace_current(previous: &Value, value: Value) -> Result<Value> {
    let mut next = previous.clone();
    let object = next
        .as_object_mut()
        .ok_or_else(|| Error::Invalid("session snapshot must be an object".into()))?;
    if let Some(current) = object.get_mut("current")
        && contains_provenance(current)
    {
        *current = replace_current(current, value)?;
    } else {
        object.insert("current".into(), value);
    }
    cadence::store::transaction::preserve_provenance(previous, &next)?;
    Ok(next)
}

fn contains_provenance(value: &Value) -> bool {
    ["import", "source_evidence", "archive", "cursor"]
        .iter()
        .any(|field| value.get(field).is_some())
        || value.get("current").is_some_and(contains_provenance)
}

#[cfg(test)]
type TestProbe = Arc<dyn Fn(Stage, &Path) -> Result<()> + Send + Sync>;

/// Resident handler composition seam. Constructing a factory performs no I/O;
/// first touch serializes initialization and shares one owner per resolved root.
pub struct SessionFactory<I: ConfigIo + Clone = FileIo> {
    global: Option<PathBuf>,
    io: I,
    evaluate: Evaluate,
    sessions: tokio::sync::Mutex<BTreeMap<PathBuf, Arc<Session<I>>>>,
    #[cfg(test)]
    probe: Option<TestProbe>,
}

impl<I: ConfigIo + Clone> SessionFactory<I> {
    /// The reader every session of this factory observes documents through.
    pub fn io(&self) -> I {
        self.io.clone()
    }
}

struct AuditOnlyPolicy;
impl Policy for AuditOnlyPolicy {
    fn validate(&mut self, context: &MutationContext<'_>) -> Result<()> {
        if matches!(context.operation, "guard_audit" | "guard_audit_recovery") {
            Ok(())
        } else {
            Err(Error::Policy(
                "guard audit cannot admit or recover policy-dependent work".into(),
            ))
        }
    }
}
impl SessionFactory<FileIo> {
    pub fn new(global: Option<PathBuf>, evaluate: Evaluate) -> Self {
        Self::with_io(global, FileIo, evaluate)
    }
}
impl<I: ConfigIo + Clone> SessionFactory<I> {
    pub fn active_config_paths(&self, root: &Path) -> Result<Paths> {
        write::active_paths(&Paths {
            repo: root.join("config.json"),
            global: self.global.clone(),
        })
    }

    /// Observe unanswered interview facts without acquiring storage ownership or
    /// replaying an intent. An uninitialized project can reuse an active global.
    pub fn observe_config(&self, root: &Path) -> Result<(Generation, Option<Value>)> {
        let legacy = Paths {
            repo: root.join("config.json"),
            global: self.global.clone(),
        };
        let active = write::active_paths(&legacy)?;
        let mut io = self.io.clone();
        let snapshot = observe(&mut io, &root.join(STATE))?
            .bytes
            .as_deref()
            .map(serde_json::from_slice::<Snapshot>)
            .transpose()?;
        if let Some(snapshot) = snapshot
            .as_ref()
            .filter(|s| s.data["import"]["complete"] == true)
        {
            return Ok((
                Reload::new(active, io).refresh()?,
                Some(snapshot.data.clone()),
            ));
        }
        let repo = observe(&mut io, &legacy.repo)?;
        let global = legacy
            .global
            .as_ref()
            .map(|path| observe(&mut io, path))
            .transpose()?;
        let alias = global
            .as_ref()
            .is_some_and(|input| input.identity == repo.identity);
        let shared = active
            .global
            .as_ref()
            .filter(|path| *path != &active.repo)
            .map(|path| observe(&mut io, path))
            .transpose()?;
        let reused = shared.filter(|input| input.bytes.is_some());
        let effective = if let Some(input) = &reused {
            let current = parse_input(input)?;
            reload::validate_effective(&merge::merge(current.clone(), None, false))?;
            let translated = translate_config(None, parse_input(&repo)?)?;
            let effective = merge::merge(current, Some(translated.repo), false);
            reload::validate_effective(&effective)?;
            effective
        } else {
            let mut effective = translate_config(
                global
                    .as_ref()
                    .filter(|_| !alias)
                    .map(parse_input)
                    .transpose()?
                    .flatten(),
                parse_input(&repo)?,
            )?;
            effective.global_intent = alias;
            effective
        };
        Ok((
            Generation {
                number: 0,
                repo,
                global: reused.or(global.filter(|_| !alias)),
                effective,
            },
            snapshot.map(|s| s.data),
        ))
    }

    pub fn guard_config(&self, root: &Path) -> Result<Generation> {
        let legacy = Paths {
            repo: root.join("config.json"),
            global: self.global.clone(),
        };
        let mut io = self.io.clone();
        let state = observe(&mut io, &root.join(STATE))?.bytes;
        let imported = state
            .as_deref()
            .map(serde_json::from_slice::<Snapshot>)
            .transpose()?
            .is_some_and(|s| s.data["import"]["complete"] == true);
        let paths = if imported {
            write::active_paths(&legacy)?
        } else {
            legacy
        };
        Reload::new(paths, io).refresh()
    }

    pub async fn guard_audit(
        &self,
        root: &Path,
        audit: cadence::store::writer::audit::Audit,
    ) -> Result<View> {
        match self.first_touch(root).await {
            Ok(session) => session.request(Operation::GuardAudit(audit)).await,
            Err(error) => {
                // Healthy policy must use normal import ownership, including its
                // source-change refusals. Only unavailable policy admits fallback.
                if self.guard_config(root).is_ok() {
                    return Err(error);
                }
                let storage = cadence::store::filesystem::Filesystem::new(root)?;
                let store = Store::open(storage, AuditOnlyPolicy).await?;
                store.request(Operation::GuardAudit(audit)).await
            }
        }
    }

    pub fn with_io(global: Option<PathBuf>, io: I, evaluate: Evaluate) -> Self {
        Self {
            global,
            io,
            evaluate,
            sessions: tokio::sync::Mutex::new(BTreeMap::new()),
            #[cfg(test)]
            probe: None,
        }
    }
    #[cfg(test)]
    pub fn with_probe(mut self, probe: TestProbe) -> Self {
        self.probe = Some(probe);
        self
    }

    pub async fn first_touch(&self, root: &Path) -> Result<Arc<Session<I>>> {
        let root = reload::identity(root)?;
        let mut sessions = self.sessions.lock().await;
        if let Some(session) = sessions.get(&root) {
            return Ok(session.clone());
        }
        let legacy = Paths {
            repo: root.join("config.json"),
            global: self.global.clone(),
        };
        let active = write::active_paths(&legacy)?;
        if let Some(global) = &legacy.global
            && reload::identity(global)? != reload::identity(&legacy.repo)?
            && active.global.as_ref() == Some(&active.repo)
        {
            return Err(Error::Conflict(
                "distinct legacy layers map to one versioned destination".into(),
            ));
        }
        let mut io = self.io.clone();
        let pending = observe(&mut io, &root.join(INTENT))?.bytes;
        let state = observe(&mut io, &root.join(STATE))?.bytes;
        let mut pending_audit = false;
        let mut owns_global = false;
        let pending_import = if let Some(bytes) = &pending {
            let intent: Value = serde_json::from_slice(bytes)?;
            pending_audit = intent["kind"]["operation"] == "guard-audit";
            let participant = intent["participants"]
                .as_array()
                .and_then(|p| p.iter().find(|p| p["target"] == STATE))
                .ok_or_else(|| Error::Conflict("pending intent lacks snapshot".into()))?;
            let bytes = cadence::store::transaction::intent_bytes(&participant["bytes"])?;
            let snapshot: Snapshot = serde_json::from_slice(&bytes)?;
            owns_global = active.global.as_ref().is_some_and(|global| {
                snapshot.data["import"]["created"]
                    .as_array()
                    .is_some_and(|created| created.contains(&json!(global)))
            });
            let previous = cadence::store::transaction::intent_bytes_option(&participant["expected"]["bytes"])?;
            snapshot.data["import"]["complete"] == true
                && previous
                    .as_deref()
                    .map(serde_json::from_slice::<Snapshot>)
                    .transpose()?
                    .is_none_or(|s| s.data["import"]["complete"] != true)
        } else {
            false
        };
        let existing = state
            .as_deref()
            .map(serde_json::from_slice::<Snapshot>)
            .transpose()?;
        let audit_only = existing
            .as_ref()
            .is_some_and(cadence::store::writer::audit::audit_only);
        let importing = Arc::new(Mutex::new(
            if state.is_none() || pending_import || audit_only {
                Some(prepare_import(
                    &root,
                    &legacy,
                    &active,
                    &mut io,
                    owns_global,
                    &existing.map(|s| s.data).unwrap_or(Value::Null),
                )?)
            } else {
                None
            },
        ));
        if pending.is_none() && state.is_none() {
            for path in [root.join(ITEMS), root.join(DECISIONS), active.repo.clone()].into_iter() {
                if observe(&mut io, &path)?.bytes.is_some() {
                    return Err(Error::Conflict(format!(
                        "unrelated partial output: {}",
                        path.display()
                    )));
                }
            }
        }
        let config = Arc::new(Mutex::new(Reload::new(active.clone(), self.io.clone())));
        let policy = SessionPolicy {
            config: config.clone(),
            importing: importing.clone(),
            io: self.io.clone(),
            evaluate: self.evaluate.clone(),
        };
        let guard_for_prepare = importing.clone();
        let mut source_io = self.io.clone();
        #[cfg(test)]
        let probe = self.probe.clone();
        let mut storage = write::register(&root, &active)?.with_probe(move |stage, path| {
            #[cfg(test)]
            if let Some(probe) = &probe {
                probe(stage, path)?;
            }
            #[cfg(not(test))]
            let _ = path;
            if stage == Stage::Prepared
                && let Some(inputs) = guard_for_prepare
                    .lock()
                    .map_err(|_| Error::Policy("import guard unavailable".into()))?
                    .as_ref()
            {
                validate_sources(&mut source_io, &inputs.manifest.sources)?;
                validate_shared(&mut source_io, &inputs.manifest)?;
            }
            Ok(())
        });
        let transaction = if (pending.is_none() || pending_audit)
            && let Some(inputs) = importing
                .lock()
                .map_err(|_| Error::Policy("import guard unavailable".into()))?
                .as_ref()
        {
            let mut transaction = inputs.transaction.clone();
            let mut add = |target: &str, value: &Value| -> Result<()> {
                let expected = storage.read(target)?;
                if expected.bytes.is_some() {
                    return Err(Error::Conflict(format!(
                        "unrelated config output: {target}"
                    )));
                }
                transaction.external.push(ExternalChange {
                    target: target.into(),
                    expected,
                    bytes: serde_json::to_vec_pretty(value)?,
                });
                Ok(())
            };
            add("repo-config", &inputs.generation.effective.repo)?;
            if inputs
                .generation
                .global
                .as_ref()
                .is_some_and(|g| g.bytes.is_some())
                && inputs.manifest.shared_global.is_none()
            {
                add("global-config", &inputs.generation.effective.global)?;
            }
            let declared = (
                inputs.declared.clone(),
                inputs.root_binding.clone(),
                inputs.manifest.source_generation.clone(),
            );
            Some((transaction, declared))
        } else {
            None
        };
        let store = Store::open(storage, policy).await?;
        let view = if let Some((mut transaction, (declared, root_binding, source_generation))) = transaction {
            let current = store.request(Operation::ReadVerified).await?;
            if current.snapshot.data["import"]["complete"] == true {
                current
            } else {
                if let Some(guard) = current.snapshot.data.get("guard_audit") {
                    transaction.snapshot.as_mut().unwrap()["guard_audit"] = guard.clone();
                }
                // The commit lands at the next generation; the records name it.
                let generation = current
                    .snapshot
                    .generation
                    .checked_add(1)
                    .ok_or_else(|| Error::Invalid("generation overflow".into()))?;
                let snapshot = transaction.snapshot.take().expect("import snapshot");
                transaction.snapshot = Some(declared_snapshot(
                    &declared,
                    &root_binding,
                    &source_generation,
                    &snapshot,
                    generation,
                )?);
                store
                    .request(Operation::CompareTransact {
                        expected_generation: current.snapshot.generation,
                        expected_integrity: current.snapshot.integrity,
                        transaction,
                    })
                    .await?
            }
        } else {
            store.request(Operation::Read).await?
        };
        let manifest: ImportManifest = serde_json::from_value(view.snapshot.data["import"].clone())
            .map_err(|_| {
                Error::Conflict("new-format generation lacks import completion metadata".into())
            })?;
        if manifest.format != 1 || !manifest.complete {
            return Err(Error::Conflict("invalid import completion".into()));
        }
        *importing
            .lock()
            .map_err(|_| Error::Policy("import guard unavailable".into()))? = None;
        config
            .lock()
            .map_err(|_| Error::Policy("config unavailable".into()))?
            .refresh()?;
        let layers: LayerRecord = view
            .snapshot
            .data
            .get(LAYERS)
            .cloned()
            .map(serde_json::from_value)
            .transpose()?
            .unwrap_or_default();
        let recorded = layers
            .active
            .clone()
            .unwrap_or_else(|| manifest.active.clone());
        if recorded != active {
            // A moved home changes the identity the global layer canonicalizes
            // to without changing a byte. The store's record of the layer's
            // bytes decides whether the new place is that same layer; the
            // mapping is then recorded at its own generation so the next open
            // is exact. The import manifest stays as history.
            let generation = view
                .snapshot
                .generation
                .checked_add(1)
                .ok_or_else(|| Error::Invalid("generation overflow".into()))?;
            let next =
                relocate_global_layer(&mut io, &manifest, &layers, &recorded, &active, generation)?;
            let mut data = view.snapshot.data.clone();
            data[LAYERS] = serde_json::to_value(&next)?;
            store
                .request(Operation::CompareRewriteSnapshot {
                    expected_generation: view.snapshot.generation,
                    expected_integrity: view.snapshot.integrity.clone(),
                    data,
                })
                .await?;
        }
        // The import manifest stays as history; the session carries where the
        // layers stand now beside it.
        let session = Arc::new(Session {
            root: root.clone(),
            drafts: cadence::import::drafts(&root)?,
            store,
            config,
            manifest,
            active,
        });
        sessions.insert(root, session.clone());
        Ok(session)
    }
}
