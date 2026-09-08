//! Legacy sources are immutable evidence, never replayed writers.
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

#[cfg(test)]
mod tests;

use crate::config::{
    self, Diagnostic, Effective, Layer, merge,
    reload::{self, ConfigIo, FileIo, Generation, Input, Paths, Reload, Shared},
    write,
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

struct ImportInputs {
    manifest: ImportManifest,
    generation: Generation,
    transaction: Transaction,
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
    })
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
    manifest: ImportManifest,
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
        if !data.is_object() || data.get("import") != Some(&serde_json::to_value(&self.manifest)?) {
            return Err(Error::Invalid(
                "derivation replacement must preserve import manifest".into(),
            ));
        }
        for field in ["source_evidence", "archive", "cursor"] {
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
        if let Some(prior) = current
            .decisions
            .iter()
            .find(|prior| prior.id == decision.id)
        {
            return if prior == &decision {
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
            active: self.manifest.active.clone(),
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
            active: self.manifest.active.clone(),
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
            active: self.manifest.active.clone(),
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
            let bytes: Vec<u8> = serde_json::from_value(participant["bytes"].clone())?;
            let snapshot: Snapshot = serde_json::from_slice(&bytes)?;
            owns_global = active.global.as_ref().is_some_and(|global| {
                snapshot.data["import"]["created"]
                    .as_array()
                    .is_some_and(|created| created.contains(&json!(global)))
            });
            let previous: Option<Vec<u8>> =
                serde_json::from_value(participant["expected"]["bytes"].clone())?;
            snapshot.data["import"]["complete"] == true
                && previous
                    .as_deref()
                    .map(serde_json::from_slice::<Snapshot>)
                    .transpose()?
                    .is_none_or(|s| s.data["import"]["complete"] != true)
        } else {
            false
        };
        let audit_only = state
            .as_deref()
            .map(serde_json::from_slice::<Snapshot>)
            .transpose()?
            .is_some_and(|s| cadence::store::writer::audit::audit_only(&s));
        let importing = Arc::new(Mutex::new(
            if state.is_none() || pending_import || audit_only {
                Some(prepare_import(
                    &root,
                    &legacy,
                    &active,
                    &mut io,
                    owns_global,
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
            Some(transaction)
        } else {
            None
        };
        let store = Store::open(storage, policy).await?;
        let view = if let Some(mut transaction) = transaction {
            let current = store.request(Operation::ReadVerified).await?;
            if current.snapshot.data["import"]["complete"] == true {
                current
            } else {
                if let Some(guard) = current.snapshot.data.get("guard_audit") {
                    transaction.snapshot.as_mut().unwrap()["guard_audit"] = guard.clone();
                }
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
        if manifest.format != 1 || !manifest.complete || manifest.active != active {
            return Err(Error::Conflict(
                "invalid import completion or changed layer mapping".into(),
            ));
        }
        *importing
            .lock()
            .map_err(|_| Error::Policy("import guard unavailable".into()))? = None;
        config
            .lock()
            .map_err(|_| Error::Policy("config unavailable".into()))?
            .refresh()?;
        let session = Arc::new(Session {
            root: root.clone(),
            store,
            config,
            manifest,
        });
        sessions.insert(root, session.clone());
        Ok(session)
    }
}

#[cfg(test)]
mod routing_admission_tests {
    use super::*;
    use crate::config::reload::{Input, Paths, Reload};
    use cadence::execution::model::{ConfigInput, ConfigInputs};

    #[derive(Clone)]
    struct InputIo;
    impl ConfigIo for InputIo {
        fn read(&mut self, path: &Path) -> Result<Input> {
            Ok(Input {
                identity: path.into(),
                bytes: Some(b"{}".to_vec()),
                stamp: None,
            })
        }
    }

    fn policy() -> SessionPolicy<InputIo> {
        SessionPolicy {
            config: Arc::new(Mutex::new(Reload::new(
                Paths {
                    repo: "/project/config.json".into(),
                    global: None,
                },
                InputIo,
            ))),
            importing: Arc::new(Mutex::new(None)),
            io: InputIo,
            evaluate: Arc::new(crate::config::planning_policy),
        }
    }

    #[test]
    fn new_admission_refuses_a_different_captured_input() {
        let snapshot =
            cadence::store::model::Snapshot::new(1, b"", b"", serde_json::json!({})).unwrap();
        let inputs = ConfigInputs {
            repo: ConfigInput {
                identity: "/project/config.json".into(),
                content: None,
                stamp: None,
            },
            global: None,
            global_alias: false,
        };
        assert_eq!(
            policy().validate_routing_admission(
                &MutationContext {
                    operation: "boundary_v1",
                    snapshot: &snapshot
                },
                &inputs
            ),
            Err(Error::Conflict(
                "routing inputs changed before admission".into()
            ))
        );
    }

    #[test]
    fn recovery_only_requires_current_config_usability() {
        let snapshot = cadence::store::model::Snapshot::new(
            1,
            b"",
            b"",
            serde_json::json!({"execution":{"historical_route":"different inputs"}}),
        )
        .unwrap();
        assert_eq!(
            policy().validate(&MutationContext {
                operation: "recovery",
                snapshot: &snapshot
            }),
            Ok(())
        );
    }
    #[test]
    fn final_intent_preparation_cannot_admit_a_stale_route() {
        use cadence::execution::boundary::{BoundaryScope, BoundaryV1, Receipt};
        use cadence::store::filesystem::{Filesystem, Stage};
        use cadence::store::writer::BoundaryChange;
        use serde_json::json;
        let root = tempfile::tempdir().unwrap();
        std::fs::write(root.path().join("state.json"), r#"{"version":1,"generation":0,"items_digest":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","decisions_digest":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","data":{},"operations":{},"integrity":"e9756a2c9107069a015c009d174bacbc989df7121a7646ecc1a770afdfbf35bd"}"#).unwrap();
        std::fs::write(root.path().join("items.jsonl"), b"").unwrap();
        std::fs::write(root.path().join("decisions.jsonl"), b"").unwrap();
        let config_path = root.path().join("config.json");
        std::fs::write(&config_path, b"{}").unwrap();
        let mut expected = Reload::new(
            Paths {
                repo: config_path.clone(),
                global: None,
            },
            FileIo,
        )
        .refresh()
        .unwrap()
        .routing_inputs();
        expected.repo.content =
            Some("44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a".into());
        let dispatch = serde_json::from_value(json!({"schema":1,"id":"d".repeat(64),"expected_execution_version":0,"phase":8,"plan":1,
            "plan_fingerprint":"1".repeat(64),"plan_set_fingerprint":"2".repeat(64),"requirements":["AC10"],"tasks":[{"id":"T1","verify":["verify"]}],"suite":"verify","files":["src/a.rs"],"policy":{"rung":"high","branch":"current","reviews":"disabled"},
            "route":{"choice":{"role":"cad-executor","agent":"cad-executor","rung":"high","starting_rung":"high","model":"sonnet","effort_source":{"kind":"role","key":"roles.cad-executor.effort","layer":"repo","stored":"high"},"model_source":{"kind":"role","key":"roles.cad-executor.model","layer":"repo","stored":"sonnet"},"attempt":1,"escalated":false,"pinned":false,"reasons":["fixture selection"],"warnings":[]},"inputs":expected},"base_sha":"3".repeat(40),"prompt_bytes":7,"body":"fixture"})).unwrap();
        let policy = SessionPolicy {
            config: Arc::new(Mutex::new(Reload::new(
                Paths {
                    repo: config_path.clone(),
                    global: None,
                },
                FileIo,
            ))),
            importing: Arc::new(Mutex::new(None)),
            io: FileIo,
            evaluate: Arc::new(crate::config::planning_policy),
        };
        let storage = Filesystem::new(root.path())
            .unwrap()
            .with_probe(move |stage, path| {
                if stage == Stage::Prepared
                    && path
                        .file_name()
                        .is_some_and(|name| name == ".store-intent.json")
                {
                    std::fs::write(
                        &config_path,
                        br#"{"roles":{"cad-executor":{"model":"opus"}}}"#,
                    )?;
                }
                Ok(())
            });
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let store = Store::open(storage, policy).await.unwrap();
            assert_eq!(
                store
                    .request(Operation::BoundaryV1 {
                        expected_generation: 0,
                        expected_integrity:
                            "e9756a2c9107069a015c009d174bacbc989df7121a7646ecc1a770afdfbf35bd"
                                .into(),
                        operation_id: "fixture-admission".into(),
                        decision: BoundaryV1 {
                            codec: 1,
                            scope: BoundaryScope::Execution { phase: 8 },
                            tool: cadence::execution::model::BoundaryTool::CadenceQuery,
                            operation: "execute-next".into(),
                            request_digest: "4".repeat(64),
                            outcome: "dispatch".into(),
                            subject_id: Some("d".repeat(64)),
                            response_digest: "5".repeat(64),
                            receipt: Receipt::Dispatch {
                                dispatch_id: "d".repeat(64),
                                prompt_bytes: 7
                            },
                            lease_refusal: None
                        },
                        change: Box::new(BoundaryChange::Dispatch {
                            plan_set_fingerprint: "2".repeat(64),
                            dispatch
                        })
                    })
                    .await,
                Err(Error::Conflict(
                    "routing inputs changed before admission".into()
                ))
            );
        });
    }
}
