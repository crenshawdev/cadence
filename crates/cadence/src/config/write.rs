//! Config changes join the store transaction; no direct config writer exists.
use super::{
    GLOBAL_ONLY, Layer, merge,
    reload::{self, ConfigIo, Generation, Paths, Shared},
    schema,
};
use cadence::store::{
    Error, Observed, Result, Storage,
    filesystem::Filesystem,
    model::digest,
    transaction::{ExternalChange, Transaction},
    writer::{Operation, Store, View},
};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};

/// Resolve the legacy identities before assigning versioned siblings. An alias
/// remains one repo-provenance layer and retains its global address separately.
pub fn active_paths(legacy: &Paths) -> Result<Paths> {
    let repo = reload::identity(&legacy.repo)?;
    let global = legacy.global.as_deref().map(reload::identity).transpose()?;
    Ok(versioned(&repo, global.as_deref()))
}

/// The files config is written to, beside legacy files already resolved:
/// `config.v4.json` next to the repo file, and next to the global file unless
/// the global path is the repo file itself, when both layers share the repo's.
pub fn versioned(repo: &Path, global: Option<&Path>) -> Paths {
    let destination = repo.with_file_name("config.v4.json");
    Paths {
        repo: destination.clone(),
        global: global.map(|path| {
            if path == repo {
                destination.clone()
            } else {
                path.with_file_name("config.v4.json")
            }
        }),
    }
}

pub fn register(root: &Path, active: &Paths) -> Result<Filesystem> {
    let mut storage = Filesystem::new(root)?.with_participant("repo-config", &active.repo)?;
    if let Some(global) = &active.global
        && global != &active.repo
    {
        storage = storage.with_participant("global-config", global)?;
    }
    Ok(storage)
}

pub fn valid_grammar(spec: &Value, value: &Value) -> bool {
    if value.is_null() {
        return true;
    }
    let Some(grammar) = spec.get("grammar").and_then(Value::as_str) else {
        return true;
    };
    let Some(text) = value.as_str() else {
        return false;
    };
    match grammar {
        "forge_slug" => {
            text.len() <= 200
                && text.split('/').count() >= 2
                && text.split('/').all(|s| {
                    !s.is_empty()
                        && s != "."
                        && s != ".."
                        && !s.starts_with('-')
                        && s.bytes()
                            .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
                })
        }
        "forge_host" => {
            let (host, port) = text
                .rsplit_once(':')
                .map_or((text, None), |(host, port)| (host, Some(port)));
            text.len() <= 253
                && !host.is_empty()
                && host.split('.').all(|s| {
                    !s.is_empty()
                        && !s.starts_with('-')
                        && !s.ends_with('-')
                        && s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
                })
                && port.is_none_or(|s| {
                    !s.starts_with('0')
                        && s.bytes().all(|b| b.is_ascii_digit())
                        && s.parse::<u16>().is_ok_and(|n| n > 0)
                })
        }
        _ => false,
    }
}

pub fn validate_update(layer: Layer, key: &str, value: &Value) -> Result<()> {
    let spec = schema()
        .get(key)
        .ok_or_else(|| Error::Invalid(format!("unknown config key {key}")))?;
    if spec["disposition"] == "dead" {
        return Err(Error::Invalid(format!("retired config key {key}")));
    }
    if !reload::valid_type(spec, value, false) || !valid_grammar(spec, value) {
        return Err(Error::Invalid(format!("invalid value for {key}")));
    }
    if (layer == Layer::Global && spec["repo_only"] == true)
        || (layer == Layer::Repo && GLOBAL_ONLY.contains(&key))
    {
        return Err(Error::Invalid(format!("wrong config layer for {key}")));
    }
    Ok(())
}

pub struct ConfigWriter<I: ConfigIo> {
    pub root: PathBuf,
    pub active: Paths,
    pub store: Store,
    pub config: Shared<I>,
}

impl<I: ConfigIo> ConfigWriter<I> {
    pub async fn set(&self, layer: Layer, key: &str, value: Value) -> Result<View> {
        Ok(self
            .batch(
                layer,
                &[Update {
                    key: key.into(),
                    value,
                }],
            )
            .await?
            .view)
    }

    pub async fn batch(&self, layer: Layer, updates: &[Update]) -> Result<Written> {
        self.batch_captured(layer, updates, None).await
    }

    pub async fn batch_captured(
        &self,
        layer: Layer,
        updates: &[Update],
        captured: Option<super::interview::Captured>,
    ) -> Result<Written> {
        self.batch_observed(layer, updates, captured, |target| {
            register(&self.root, &self.active)?.read(target)
        })
        .await
    }

    pub async fn batch_observed(
        &self,
        layer: Layer,
        updates: &[Update],
        captured: Option<super::interview::Captured>,
        observe: impl FnOnce(&str) -> Result<cadence::store::Observed>,
    ) -> Result<Written> {
        let generation = self
            .config
            .lock()
            .map_err(|_| Error::Policy("config unavailable".into()))?
            .refresh()
            .map_err(unavailable)?;
        if let Some(captured) = &captured {
            captured.validate(&generation)?;
        }
        let check = captured.map(|captured| input_check(self.config.clone(), captured));
        let plan = plan(&generation, &self.active, layer, updates)?;
        if plan.bytes.is_none() {
            let view = self.store.request(request(None, check)).await?;
            return Ok(written(view, plan, layer));
        }
        let change = plan.change(observe(plan.target)?)?;
        let store_generation = self
            .store
            .request(Operation::Read)
            .await?
            .snapshot
            .generation;
        let transaction = transaction(change, store_generation);
        let view = self.store.request(request(Some(transaction), check)).await?;
        Ok(written(view, plan, layer))
    }
}

/// The store request that carries a batch: a plain read when the plan changes
/// nothing, so no generation is spent, else its transaction, under the
/// captured-input check when there is one.
pub fn request(transaction: Option<Transaction>, check: Option<cadence::store::writer::InputCheck>) -> Operation {
    match (transaction, check) {
        (None, None) => Operation::Read,
        (transaction, Some(check)) => Operation::CheckedTransact { check, transaction },
        (Some(transaction), None) => Operation::Transact(transaction),
    }
}

/// What a batch reports: the store view after it, the keys it changed, the
/// file it wrote to and the layer it was asked for.
pub fn written(view: View, plan: Plan, layer: Layer) -> Written {
    Written { view, changed_keys: plan.changed_keys, destination: plan.destination, requested_layer: layer }
}

/// A config read that failed refuses the write as a policy error.
pub fn unavailable(error: Error) -> Error {
    Error::Policy(format!("config unavailable: {error}"))
}

/// What a config batch writes, decided against the generation it was
/// prepared from.
#[derive(Debug, PartialEq)]
pub struct Plan {
    /// The store participant the layer is written as.
    pub target: &'static str,
    /// The file that participant is.
    pub destination: PathBuf,
    /// What the file held in that generation.
    pub prepared_against: Option<Vec<u8>>,
    /// The keys the batch changes, sorted.
    pub changed_keys: Vec<String>,
    /// The layer to install, pretty-printed; nothing when no key changes.
    pub bytes: Option<Vec<u8>>,
}

/// Plan writing `updates` to `layer`. A global write goes to the repo file
/// when the global path is the repo file itself. The file must still be the
/// one the session bound, and the layer it makes must leave a valid effective
/// config.
pub fn plan(generation: &Generation, active: &Paths, layer: Layer, updates: &[Update]) -> Result<Plan> {
    let (target, path, input) = match layer {
        Layer::Repo => ("repo-config", &active.repo, &generation.repo),
        Layer::Global => {
            let path = active
                .global
                .as_ref()
                .ok_or_else(|| Error::Invalid("global config address unavailable".into()))?;
            if path == &active.repo {
                ("repo-config", path, &generation.repo)
            } else {
                (
                    "global-config",
                    path,
                    generation
                        .global
                        .as_ref()
                        .ok_or_else(|| Error::Conflict("config layer identity changed".into()))?,
                )
            }
        }
    };
    // Registered participant paths are session bindings, never silently
    // rebound by a symlink replacement during a pending config update.
    if input.identity != *path {
        return Err(Error::Conflict(
            "active config identity changed; reopen session before writing config".into(),
        ));
    }
    let raw: Value = input
        .bytes
        .as_deref()
        .map(serde_json::from_slice)
        .transpose()?
        .unwrap_or_else(|| json!({}));
    let (proposed, changed_keys) = prepare_batch(layer, &raw, updates)?;
    let effective = match target {
        "repo-config" => merge::merge(
            generation.effective.raw_global.clone(),
            Some(proposed.clone()),
            generation.effective.global_intent,
        ),
        _ => merge::merge(
            Some(proposed.clone()),
            generation.effective.raw_repo.clone(),
            generation.effective.global_intent,
        ),
    };
    reload::validate_effective(&effective)?;
    let bytes = if changed_keys.is_empty() {
        None
    } else {
        Some(serde_json::to_vec_pretty(&proposed)?)
    };
    Ok(Plan {
        target,
        destination: path.clone(),
        prepared_against: input.bytes.clone(),
        changed_keys,
        bytes,
    })
}

impl Plan {
    /// The store change that installs the plan over `expected`, the file as
    /// observed now. Bytes other than those the plan was prepared against
    /// mean the file changed in the meantime.
    pub fn change(&self, expected: Observed) -> Result<ExternalChange> {
        let bytes = self
            .bytes
            .clone()
            .ok_or_else(|| Error::Invalid("config plan changes nothing".into()))?;
        if expected.bytes != self.prepared_against {
            return Err(Error::Conflict("config changed while preparing update".into()));
        }
        Ok(ExternalChange { target: self.target.into(), expected, bytes })
    }
}

/// The store transaction for one config change, identified by its target, the
/// store generation it follows and its bytes.
pub fn transaction(change: ExternalChange, store_generation: u64) -> Transaction {
    Transaction {
        id: format!("config:{}:{store_generation}:{}", change.target, digest(&change.bytes)),
        items: vec![],
        decisions: vec![],
        snapshot: None,
        external: vec![change],
    }
}

#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Update {
    pub key: String,
    pub value: Value,
}

pub struct Written {
    pub view: View,
    pub changed_keys: Vec<String>,
    pub destination: PathBuf,
    pub requested_layer: Layer,
}

pub fn prepare_batch(
    layer: Layer,
    raw: &Value,
    updates: &[Update],
) -> Result<(Value, Vec<String>)> {
    let mut keys = std::collections::BTreeSet::new();
    for update in updates {
        validate_update(layer, &update.key, &update.value)?;
        if !keys.insert(&update.key) {
            return Err(Error::Invalid(format!(
                "duplicate config key {}",
                update.key
            )));
        }
    }
    let mut proposed = raw.clone();
    let mut changed = Vec::new();
    for update in updates {
        if merge::get(raw, &update.key) != Some(&update.value) {
            merge::set(&mut proposed, &update.key, update.value.clone());
            changed.push(update.key.clone());
        }
    }
    changed.sort();
    Ok((proposed, changed))
}

pub fn input_check<I: ConfigIo>(
    shared: Shared<I>,
    captured: super::interview::Captured,
) -> cadence::store::writer::InputCheck {
    Box::new(move || {
        let generation = shared
            .lock()
            .map_err(|_| Error::Policy("config unavailable".into()))?
            .refresh()?;
        captured.validate(&generation)
    })
}
