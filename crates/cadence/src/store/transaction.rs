use super::model::{self, DECISIONS, DecisionRecord, ITEMS, ItemRecord, STATE, Snapshot, VERSION};
use super::{Error, MutationContext, Observed, Policy, Result, Storage};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeSet;

pub const INTENT: &str = ".store-intent.json";

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExternalChange {
    pub target: String,
    pub expected: Observed,
    pub bytes: Vec<u8>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Transaction {
    /// Stable caller identity, e.g. a digest of the frozen import source set.
    pub id: String,
    pub items: Vec<ItemRecord>,
    pub decisions: Vec<DecisionRecord>,
    pub snapshot: Option<Value>,
    pub external: Vec<ExternalChange>,
}

impl Transaction {
    pub fn fingerprint(&self) -> Result<String> {
        // Preconditions describe a particular attempt, not the logical import.
        // A retry after recovery has different installed identities.
        Ok(model::digest(&serde_json::to_vec(&(
            &self.items,
            &self.decisions,
            &self.snapshot,
            self.external
                .iter()
                .map(|p| (&p.target, &p.bytes))
                .collect::<Vec<_>>(),
        ))?))
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct Participant {
    pub target: String,
    pub expected: Observed,
    pub bytes: Vec<u8>,
}

#[derive(Serialize, Deserialize)]
struct Intent {
    version: u32,
    participants: Vec<Participant>,
    integrity: String,
}

impl Intent {
    fn digest(&self) -> Result<String> {
        Ok(model::digest(&serde_json::to_vec(&(
            self.version,
            &self.participants,
        ))?))
    }

    fn validate(&self) -> Result<Snapshot> {
        if self.version != VERSION || self.integrity != self.digest()? {
            return Err(Error::Conflict("invalid operation intent integrity".into()));
        }
        let mut names = BTreeSet::new();
        for participant in &self.participants {
            if !matches!(
                participant.target.as_str(),
                ITEMS | DECISIONS | STATE | "repo-config" | "global-config"
            ) || !names.insert(participant.target.as_str())
            {
                return Err(Error::Invalid(
                    "invalid or duplicate intent participant".into(),
                ));
            }
        }
        let bytes = |name| {
            self.participants
                .iter()
                .find(|p| p.target == name)
                .map(|p| p.bytes.as_slice())
                .ok_or_else(|| Error::Invalid("intent lacks semantic target".into()))
        };
        let items = bytes(ITEMS)?;
        let decisions = bytes(DECISIONS)?;
        model::validate_items(&model::parse_lines(items)?)?;
        model::validate_decisions(&model::parse_lines(decisions)?)?;
        Snapshot::parse(bytes(STATE)?, items, decisions)
    }
}

fn validate_all<S: Storage>(
    storage: &mut S,
    participants: &[Participant],
    replay: bool,
) -> Result<()> {
    // This entire pass finishes before any participant can change.
    for participant in participants {
        let actual = storage.read(&participant.target)?;
        let intended = replay
            && actual.bytes.as_ref() == Some(&participant.bytes)
            && actual.directory_identity == participant.expected.directory_identity;
        if actual != participant.expected && !intended {
            return Err(Error::Conflict(format!(
                "pending participant changed: {}",
                participant.target
            )));
        }
    }
    Ok(())
}

fn dispose<S: Storage>(
    storage: &mut S,
    prepared: Vec<(String, Vec<u8>, S::Prepared)>,
) -> Result<()> {
    let mut first = None;
    for (_, _, file) in prepared {
        if let Err(error) = storage.discard(file) {
            first.get_or_insert(error);
        }
    }
    first.map_or(Ok(()), Err)
}

pub(crate) fn commit<S: Storage, P: Policy>(
    storage: &mut S,
    policy: &mut P,
    context: &MutationContext<'_>,
    participants: Vec<Participant>,
) -> Result<()> {
    if storage.read(INTENT)?.bytes.is_some() {
        return Err(Error::Conflict(
            "pending operation requires recovery".into(),
        ));
    }
    validate_all(storage, &participants, false)?;
    let mut prepared = Vec::new();
    for participant in &participants {
        if participant.expected.bytes.as_ref() == Some(&participant.bytes) {
            continue;
        }
        match storage.prepare(&participant.target, &participant.bytes) {
            Ok(file) => {
                prepared.push((participant.target.clone(), participant.bytes.clone(), file))
            }
            Err(error) => {
                dispose(storage, prepared)?;
                return Err(error);
            }
        }
    }
    let mut intent = Intent {
        version: VERSION,
        participants,
        integrity: String::new(),
    };
    intent.integrity = intent.digest()?;
    intent.validate()?;
    let bytes = serde_json::to_vec(&intent)?;
    let intent_file = match storage.prepare(INTENT, &bytes) {
        Ok(file) => file,
        Err(error) => {
            dispose(storage, prepared)?;
            return Err(error);
        }
    };
    if let Err(error) =
        validate_all(storage, &intent.participants, false).and_then(|()| policy.validate(context))
    {
        storage.discard(intent_file)?;
        dispose(storage, prepared)?;
        return Err(error);
    }
    let installed = storage.install(&intent_file);
    storage.discard(intent_file)?;
    if let Err(error) = installed.and_then(|()| storage.confirm(INTENT, &bytes).map(|_| ())) {
        dispose(storage, prepared)?;
        return Err(error);
    }
    let mut remaining = prepared.into_iter();
    while let Some((target, bytes, file)) = remaining.next() {
        // Check all participants again immediately before each replacement.
        let result = validate_all(storage, &intent.participants, true)
            .and_then(|()| storage.install(&file))
            .and_then(|()| storage.confirm(&target, &bytes).map(|_| ()));
        storage.discard(file)?;
        if let Err(error) = result {
            dispose(storage, remaining.collect())?;
            return Err(error);
        }
    }
    // Snapshot is the final semantic participant and holds completion receipts.
    // Removing the intent and syncing its directory is part of completion.
    validate_all(storage, &intent.participants, true)?;
    storage.remove(INTENT)
}

pub(crate) fn recover<S: Storage, P: Policy>(storage: &mut S, policy: &mut P) -> Result<()> {
    let Some(bytes) = storage.read(INTENT)?.bytes else {
        return Ok(());
    };
    let intent: Intent = serde_json::from_slice(&bytes)?;
    let snapshot = intent.validate()?;
    validate_all(storage, &intent.participants, true)?;
    policy.validate(&MutationContext {
        operation: "recovery",
        snapshot: &snapshot,
    })?;
    for participant in &intent.participants {
        validate_all(storage, &intent.participants, true)?;
        let current = storage.read(&participant.target)?;
        if current.bytes.as_ref() == Some(&participant.bytes) {
            // Rename may have completed before its directory sync. Reconfirm
            // both file and directory even when no semantic update is needed.
            storage.resync(&participant.target, &participant.bytes)?;
        } else {
            let file = storage.prepare(&participant.target, &participant.bytes)?;
            let result = validate_all(storage, &intent.participants, true)
                .and_then(|()| storage.install(&file))
                .and_then(|()| {
                    storage
                        .confirm(&participant.target, &participant.bytes)
                        .map(|_| ())
                });
            storage.discard(file)?;
            result?;
        }
    }
    validate_all(storage, &intent.participants, true)?;
    storage.remove(INTENT)
}
