//! Retained H2 records use the caller's durable store, never a material journal.
use super::io::{Clock, GitIo, MaterialIo};
use super::model::{
    Availability, Contract, Manifest, MaterialEntry, MaterialProvenance, MaterialRole,
    MaterialView, Side, Target,
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

fn save<S: Storage>(store: &mut S, mut result: RetainedMaterial) -> Result<RetainedMaterial> {
    super::manifest::record_mappings(&mut result.manifest, &result.contents)?;
    retain_record(
        store,
        &format!("material-manifest-{}", result.manifest.manifest),
        &serde_json::to_vec(&result.manifest)?,
    )?;
    Ok(result)
}

/// Reads have only the retained-storage boundary. Neither a source path nor
/// Git is a recovery fallback, including when an ordinary ref has disappeared.
pub fn read_material<S: Storage>(store: &mut S, entry: &MaterialEntry) -> Result<Vec<u8>> {
    let unavailable = || Error::Io(format!("material unavailable: {}", entry.entry));
    if entry.availability != Availability::Available {
        return Err(unavailable());
    }
    let key = entry.retained.as_deref().ok_or_else(unavailable)?;
    let content = entry.content.as_deref().ok_or_else(unavailable)?;
    let bytes = store.read(key)?.bytes.ok_or_else(unavailable)?;
    if artifact_content_id(&bytes) != content {
        return Err(unavailable());
    }
    Ok(bytes)
}

pub fn material_matches(saved: &[u8], proposed: &[u8]) -> bool {
    saved == proposed
}

/// An entry ID allocated by the caller and exact newly acquired bytes. This is
/// an operation input; the saved vocabulary remains MaterialEntry/Manifest.
pub struct AdditionalMaterial {
    pub entry: String,
    pub role: MaterialRole,
    pub path: Option<String>,
    pub label: Option<String>,
    pub side: Side,
    pub acquisition: String,
    pub bytes: Vec<u8>,
}

/// The service validates this original view against persisted delivery first.
/// Membership is checked here; distinct later deliveries have their own saved
/// records and do not change the provenance of an existing acquisition.
pub struct DeliveredMaterial<'a> {
    pub attempt: &'a str,
    pub view: &'a MaterialView,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct MaterialAppend {
    pub manifest: String,
    pub contract: Contract,
    pub entry: MaterialEntry,
}

pub fn append_material<S: Storage>(
    manifest: &Manifest,
    additional: AdditionalMaterial,
    delivered: Option<DeliveredMaterial<'_>>,
    store: &mut S,
    clock: &mut impl Clock,
) -> Result<MaterialEntry> {
    if additional.entry.is_empty()
        || additional.acquisition.is_empty()
        || (additional.path.is_none() && additional.label.is_none())
    {
        return Err(Error::Invalid("incomplete material acquisition".into()));
    }
    if manifest
        .entries
        .iter()
        .any(|entry| entry.entry == additional.entry)
    {
        return Err(Error::Conflict(
            "original material entry is immutable".into(),
        ));
    }
    if let Some(binding) = &delivered
        && (binding.attempt.is_empty()
            || binding.view.view.is_empty()
            || binding.view.manifest != manifest.manifest
            || !binding.view.entries.contains(&additional.entry))
    {
        return Err(Error::Invalid(
            "material not in supplied attempt view".into(),
        ));
    }
    let mut saved = entry(
        &manifest.manifest,
        additional.path.as_deref().unwrap_or(""),
        additional.side,
        additional.role,
        clock.now(),
        additional.acquisition,
    );
    saved.entry = additional.entry;
    saved.path = additional.path;
    saved.label = additional.label;
    match delivered {
        Some(binding) => {
            saved.provenance = MaterialProvenance::OriginalView;
            saved.attempt = Some(binding.attempt.into());
            saved.view = Some(binding.view.view.clone());
        }
        None => saved.provenance = MaterialProvenance::LaterEvidence,
    }
    retain_bytes(store, &mut saved, &additional.bytes)?;
    saved.lines = super::manifest::line_map(&additional.bytes);
    let key = format!(
        "material-append-{}",
        artifact_content_id(&serde_json::to_vec(&(&manifest.manifest, &saved.entry))?)
    );
    let append = MaterialAppend {
        manifest: manifest.manifest.clone(),
        contract: manifest.contract.clone(),
        entry: saved.clone(),
    };
    retain_record(store, &key, &serde_json::to_vec(&append)?)?;
    Ok(saved)
}

#[derive(Debug, PartialEq, Eq)]
pub struct DirectoryMaterial {
    pub members: Vec<String>,
    pub contents: BTreeMap<String, Vec<u8>>,
}

pub fn read_directory_target<S: Storage>(
    store: &mut S,
    manifest: &Manifest,
) -> Result<DirectoryMaterial> {
    let Target::Directory { path, members } = &manifest.target else {
        return Err(Error::Invalid("expected directory target".into()));
    };
    let mut contents = BTreeMap::new();
    for member in members {
        let member_path = directory_member(path, member)?;
        let entry = manifest
            .entries
            .iter()
            .find(|entry| {
                entry.path.as_deref() == Some(&member_path)
                    && entry.side == Side::Snapshot
                    && entry.role == MaterialRole::Primary
            })
            .ok_or_else(|| Error::Io(format!("material unavailable: {member}")))?;
        contents.insert(member.clone(), read_material(store, entry)?);
    }
    Ok(DirectoryMaterial {
        members: members.clone(),
        contents,
    })
}

fn directory_member(path: &str, member: &str) -> Result<String> {
    use std::path::{Component, Path};
    let mut components = Path::new(member).components();
    if !matches!(components.next(), Some(Component::Normal(_))) || components.next().is_some() {
        return Err(Error::Invalid("invalid directory member".into()));
    }
    Ok(Path::new(path).join(member).to_string_lossy().into_owned())
}

pub fn retain_directory<S: Storage>(
    manifest: &str,
    fire: &str,
    path: &str,
    source: &mut impl MaterialIo,
    store: &mut S,
    clock: &mut impl Clock,
) -> Result<RetainedMaterial> {
    let mut listing = source.list(path)?;
    listing.members.sort();
    listing.members.dedup();
    let mut result = empty(
        manifest,
        fire,
        Target::Directory {
            path: path.into(),
            members: listing.members.clone(),
        },
    );
    let acquired_at = clock.now();
    for member in &listing.members {
        let member_path = directory_member(path, member)?;
        let mut saved = entry(
            manifest,
            &member_path,
            Side::Snapshot,
            MaterialRole::Primary,
            acquired_at,
            listing.identity.clone(),
        );
        match source.read(&member_path) {
            Ok(observed) => {
                saved.acquisition = format!("{}:{}", listing.identity, observed.identity);
                match observed.bytes {
                    Some(bytes) => {
                        retain_bytes(store, &mut saved, &bytes)?;
                        result.contents.insert(saved.entry.clone(), bytes);
                    }
                    None => saved.availability = Availability::Absent,
                }
            }
            Err(error) => saved.unavailable_reason = Some(error.to_string()),
        }
        result.manifest.entries.push(saved);
    }
    save(store, result)
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

#[cfg(test)]
mod gap_material_support {
    use super::*;
    use cadence::store::Observed;
    #[derive(Default)]
    pub struct Saved(pub BTreeMap<String, Vec<u8>>);
    impl Storage for Saved {
        type Prepared = (String, Vec<u8>);
        fn read(&mut self, key: &str) -> Result<Observed> {
            Ok(Observed {
                bytes: self.0.get(key).cloned(),
                identity: "saved".into(),
                directory_identity: "retained".into(),
            })
        }
        fn prepare(&mut self, key: &str, bytes: &[u8]) -> Result<Self::Prepared> {
            Ok((key.into(), bytes.into()))
        }
        fn install(&mut self, prepared: &Self::Prepared) -> Result<()> {
            self.0.insert(prepared.0.clone(), prepared.1.clone());
            Ok(())
        }
        fn discard(&mut self, _: Self::Prepared) -> Result<()> {
            Ok(())
        }
        fn resync(&mut self, key: &str, bytes: &[u8]) -> Result<Observed> {
            self.confirm(key, bytes)
        }
        fn remove(&mut self, key: &str) -> Result<()> {
            self.0.remove(key);
            Ok(())
        }
        fn confirm(&mut self, key: &str, bytes: &[u8]) -> Result<Observed> {
            assert_eq!(self.0.get(key).map(Vec::as_slice), Some(bytes));
            self.read(key)
        }
    }
    pub struct FixedClock;
    impl Clock for FixedClock {
        fn now(&mut self) -> u64 {
            100
        }
    }
}
#[cfg(test)]
mod gap153_append_tests {
    use super::gap_material_support::*;
    use super::*;
    #[test]
    fn gap153_unobserved_append_is_later_evidence() {
        let manifest = Manifest {
            manifest: "m1".into(),
            fire: "f1".into(),
            contract: Contract::current(),
            target: Target::NamedFile {
                path: "a.rs".into(),
                head: None,
            },
            entries: vec![],
        };
        let entry = append_material(
            &manifest,
            AdditionalMaterial {
                entry: "e4".into(),
                role: MaterialRole::Supporting,
                path: Some("counter.rs".into()),
                label: None,
                side: Side::Snapshot,
                acquisition: "acq1".into(),
                bytes: b"counter\n".to_vec(),
            },
            None,
            &mut Saved::default(),
            &mut FixedClock,
        )
        .unwrap();
        assert_eq!(entry.provenance, MaterialProvenance::LaterEvidence);
        assert_eq!(entry.acquired_at, 100);
        assert_eq!(entry.attempt, None);
        assert_eq!(entry.view, None);
    }
}
