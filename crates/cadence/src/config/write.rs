//! Config changes join the store transaction; no direct config writer exists.
use super::{
    GLOBAL_ONLY, Layer, merge,
    reload::{self, ConfigIo, Paths, Shared},
    schema,
};
use cadence::store::{
    Error, Result, Storage,
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
    let destination = repo.with_file_name("config.v4.json");
    Ok(Paths {
        repo: destination.clone(),
        global: global.map(|path| {
            if path == repo {
                destination.clone()
            } else {
                path.with_file_name("config.v4.json")
            }
        }),
    })
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
        let generation = self
            .config
            .lock()
            .map_err(|_| Error::Policy("config unavailable".into()))?
            .refresh()
            .map_err(|error| Error::Policy(format!("config unavailable: {error}")))?;
        if let Some(captured) = &captured {
            captured.validate(&generation)?;
        }
        let check = captured.map(|captured| input_check(self.config.clone(), captured));
        let (target, path, input) = match layer {
            Layer::Repo => ("repo-config", &self.active.repo, &generation.repo),
            Layer::Global => {
                let path =
                    self.active.global.as_ref().ok_or_else(|| {
                        Error::Invalid("global config address unavailable".into())
                    })?;
                if path == &self.active.repo {
                    ("repo-config", path, &generation.repo)
                } else {
                    (
                        "global-config",
                        path,
                        generation.global.as_ref().ok_or_else(|| {
                            Error::Conflict("config layer identity changed".into())
                        })?,
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
        let mut raw: Value = input
            .bytes
            .as_deref()
            .map(serde_json::from_slice)
            .transpose()?
            .unwrap_or_else(|| json!({}));
        let (proposed, changed_keys) = prepare_batch(layer, &raw, updates)?;
        raw = proposed;
        let effective = match target {
            "repo-config" => merge::merge(
                generation.effective.raw_global.clone(),
                Some(raw.clone()),
                generation.effective.global_intent,
            ),
            _ => merge::merge(
                Some(raw.clone()),
                generation.effective.raw_repo.clone(),
                generation.effective.global_intent,
            ),
        };
        reload::validate_effective(&effective)?;
        if changed_keys.is_empty() {
            return Ok(Written {
                view: self
                    .store
                    .request(match check {
                        Some(check) => Operation::CheckedTransact {
                            check,
                            transaction: None,
                        },
                        None => Operation::Read,
                    })
                    .await?,
                changed_keys,
                destination: path.clone(),
                requested_layer: layer,
            });
        }
        let bytes = serde_json::to_vec_pretty(&raw)?;
        let mut storage = register(&self.root, &self.active)?;
        let expected = storage.read(target)?;
        if expected.bytes != input.bytes {
            return Err(Error::Conflict(
                "config changed while preparing update".into(),
            ));
        }
        let store_generation = self
            .store
            .request(Operation::Read)
            .await?
            .snapshot
            .generation;
        let transaction = Transaction {
            id: format!("config:{target}:{store_generation}:{}", digest(&bytes)),
            items: vec![],
            decisions: vec![],
            snapshot: None,
            external: vec![ExternalChange {
                target: target.into(),
                expected,
                bytes,
            }],
        };
        let operation = match check {
            Some(check) => Operation::CheckedTransact {
                check,
                transaction: Some(transaction),
            },
            None => Operation::Transact(transaction),
        };
        let view = self.store.request(operation).await?;
        Ok(Written {
            view,
            changed_keys,
            destination: path.clone(),
            requested_layer: layer,
        })
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
