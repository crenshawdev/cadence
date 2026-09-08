//! Retained H2 records use the caller's durable store, never a material journal.
use super::io::{Clock, GitIo, MaterialIo};
use super::model::{
    Availability, Contract, Manifest, MaterialEntry, MaterialProvenance, MaterialRole, Side, Target,
};
use cadence::store::{Error, Result, Storage};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

/// Bytes are returned alongside their saved references so acquisition callers
/// can inspect the exact observation without reading mutable sources again.
#[derive(Debug)]
pub struct RetainedMaterial {
    pub manifest: Manifest,
    pub contents: BTreeMap<String, Vec<u8>>,
}

pub fn artifact_content_id(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

/// Store keys are logical addresses interpreted by the durable-storage adapter.
/// Ownership spans the absence check and installation; existing bytes may only
/// be replayed, never replaced. Success requires the adapter's sync/confirmation.
pub(crate) fn retain_record<S: Storage>(store: &mut S, key: &str, bytes: &[u8]) -> Result<()> {
    let _owner = store.acquire()?;
    if let Some(saved) = store.read(key)?.bytes {
        if saved != bytes {
            return Err(Error::Conflict(format!(
                "retained record already exists: {key}"
            )));
        }
        store.resync(key, bytes)?;
        return Ok(());
    }
    let prepared = store.prepare(key, bytes)?;
    let installed = store.install(&prepared);
    store.discard(prepared)?;
    installed?;
    store.confirm(key, bytes)?;
    Ok(())
}

fn entry_id(manifest: &str, path: &str, side: &Side) -> String {
    artifact_content_id(&serde_json::to_vec(&(manifest, path, side)).expect("string tuple"))
}

pub(crate) fn entry(
    manifest: &str,
    path: &str,
    side: Side,
    role: MaterialRole,
    acquired_at: u64,
    acquisition: String,
) -> MaterialEntry {
    MaterialEntry {
        entry: entry_id(manifest, path, &side),
        role,
        path: Some(path.into()),
        label: None,
        side,
        availability: Availability::Unavailable,
        unavailable_reason: None,
        content: None,
        retained: None,
        old_path: None,
        new_path: None,
        lines: Vec::new(),
        hunks: Vec::new(),
        acquisition,
        acquired_at,
        provenance: MaterialProvenance::OriginalView,
        attempt: None,
        view: None,
    }
}

pub(crate) fn retain_bytes<S: Storage>(
    store: &mut S,
    entry: &mut MaterialEntry,
    bytes: &[u8],
) -> Result<()> {
    let content = artifact_content_id(bytes);
    let key = format!("material-content-{content}");
    retain_record(store, &key, bytes)?;
    entry.availability = Availability::Available;
    entry.content = Some(content);
    entry.retained = Some(key);
    Ok(())
}

fn empty(manifest: &str, fire: &str, target: Target) -> RetainedMaterial {
    RetainedMaterial {
        manifest: Manifest {
            manifest: manifest.into(),
            fire: fire.into(),
            contract: Contract::current(),
            target,
            entries: Vec::new(),
        },
        contents: BTreeMap::new(),
    }
}

fn save<S: Storage>(store: &mut S, result: RetainedMaterial) -> Result<RetainedMaterial> {
    retain_record(
        store,
        &format!("material-manifest-{}", result.manifest.manifest),
        &serde_json::to_vec(&result.manifest)?,
    )?;
    Ok(result)
}

pub fn retain_file<S: Storage>(
    manifest: &str,
    fire: &str,
    path: &str,
    source: &mut impl MaterialIo,
    store: &mut S,
    clock: &mut impl Clock,
) -> Result<RetainedMaterial> {
    let mut result = empty(
        manifest,
        fire,
        Target::NamedFile {
            path: path.into(),
            head: None,
        },
    );
    let observation = source.read(path);
    let mut saved = entry(
        manifest,
        path,
        Side::Snapshot,
        MaterialRole::Primary,
        clock.now(),
        match &observation {
            Ok(value) => value.identity.clone(),
            Err(_) => format!("file:{path}"),
        },
    );
    match observation {
        Ok(observed) => match observed.bytes {
            Some(bytes) => {
                retain_bytes(store, &mut saved, &bytes)?;
                result.contents.insert(saved.entry.clone(), bytes);
            }
            None => saved.availability = Availability::Absent,
        },
        Err(error) => saved.unavailable_reason = Some(error.to_string()),
    }
    result.manifest.entries.push(saved);
    save(store, result)
}

pub fn retain_range<S: Storage>(
    manifest: &str,
    fire: &str,
    target: &Target,
    git: &mut impl GitIo,
    store: &mut S,
    clock: &mut impl Clock,
) -> Result<RetainedMaterial> {
    if !matches!(
        target,
        Target::CommittedRange { .. } | Target::PhaseRange { .. }
    ) {
        return Err(Error::Invalid("expected committed range".into()));
    }
    retain_git(manifest, fire, target, git, store, clock)
}

pub fn retain_staged<S: Storage>(
    manifest: &str,
    fire: &str,
    target: &Target,
    git: &mut impl GitIo,
    store: &mut S,
    clock: &mut impl Clock,
) -> Result<RetainedMaterial> {
    if !matches!(target, Target::StagedTree { head: None, .. }) {
        return Err(Error::Invalid("expected staged tree without head".into()));
    }
    retain_git(manifest, fire, target, git, store, clock)
}

fn retain_git<S: Storage>(
    manifest: &str,
    fire: &str,
    target: &Target,
    git: &mut impl GitIo,
    store: &mut S,
    clock: &mut impl Clock,
) -> Result<RetainedMaterial> {
    let observed = git.resolve(target)?;
    let (resolved, tip, tip_side) = match target {
        Target::StagedTree { .. } => {
            let index = observed
                .index
                .clone()
                .filter(|_| observed.head.is_none())
                .ok_or_else(|| Error::Invalid("missing authored tree or unexpected head".into()))?;
            (
                Target::StagedTree {
                    base: observed.base.clone(),
                    index: index.clone(),
                    head: None,
                },
                index,
                Side::Snapshot,
            )
        }
        Target::CommittedRange { .. } | Target::PhaseRange { .. } => {
            let head = observed
                .head
                .clone()
                .ok_or_else(|| Error::Invalid("missing resolved head".into()))?;
            let resolved = match target {
                Target::PhaseRange { phase, .. } => Target::PhaseRange {
                    phase: phase.clone(),
                    base: observed.base.clone(),
                    head: head.clone(),
                },
                _ => Target::CommittedRange {
                    base: observed.base.clone(),
                    head: head.clone(),
                },
            };
            (resolved, head, Side::Head)
        }
        _ => return Err(Error::Invalid("expected Git target".into())),
    };
    let mut result = empty(manifest, fire, resolved);
    let acquired_at = clock.now();
    let mut paths = observed.paths;
    paths.sort();
    paths.dedup();
    for path in paths {
        for (object, side) in [(&observed.base, Side::Base), (&tip, tip_side.clone())] {
            let mut saved = entry(
                manifest,
                &path,
                side,
                MaterialRole::Primary,
                acquired_at,
                object.clone(),
            );
            match git.read_object(object, &path) {
                Ok(bytes) => {
                    retain_bytes(store, &mut saved, &bytes)?;
                    result.contents.insert(saved.entry.clone(), bytes);
                }
                Err(error) => saved.unavailable_reason = Some(error.to_string()),
            }
            result.manifest.entries.push(saved);
        }
    }
    let mut diff = entry(
        manifest,
        "\0diff",
        Side::Snapshot,
        MaterialRole::Primary,
        acquired_at,
        format!("{}:{tip}", observed.base),
    );
    diff.path = None;
    diff.label = Some("diff".into());
    retain_bytes(store, &mut diff, &observed.diff)?;
    result.contents.insert(diff.entry.clone(), observed.diff);
    result.manifest.entries.push(diff);
    save(store, result)
}
