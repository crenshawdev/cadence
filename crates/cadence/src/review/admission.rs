//! H1 admission contributes identity and retained material to one caller commit.
use super::io::{Clock, GitIo, MaterialIo};
use super::model::{Admission, Attempt, AttemptState, Manifest, Target};
use super::persistence::{self, MaterialStorage};
use cadence::store::transaction::Transaction;
use cadence::store::writer::{Store, View};
use cadence::store::{Error, Result};
use serde::Serialize;
use serde_json::{Value, json};

pub struct PendingAdmission {
    pub admission: Admission,
    pub attempts: Vec<Attempt>,
    pub manifest: Manifest,
    pub material: MaterialStorage,
    /// Logical rendering address; the home index also retains scope/owner.
    pub home_path: String,
}

/// Acquisition uses Plan 2's actual retained-byte and mapping implementation.
/// The returned participant must join admission before anything is dispatched.
pub fn acquire_material(
    fire: &str,
    manifest: &str,
    target: &Target,
    source: &mut impl MaterialIo,
    git: &mut impl GitIo,
    clock: &mut impl Clock,
) -> Result<(Manifest, MaterialStorage)> {
    let mut storage = MaterialStorage::default();
    let retained = match target {
        Target::NamedFile { path, .. } => {
            super::material::retain_file(manifest, fire, path, source, &mut storage, clock)?
        }
        Target::Directory { path, .. } => {
            super::material::retain_directory(manifest, fire, path, source, &mut storage, clock)?
        }
        Target::CommittedRange { .. } | Target::PhaseRange { .. } => {
            super::material::retain_range(manifest, fire, target, git, &mut storage, clock)?
        }
        Target::StagedTree { .. } => {
            super::material::retain_staged(manifest, fire, target, git, &mut storage, clock)?
        }
        _ => return Err(Error::Invalid("use retained specialist material".into())),
    };
    Ok((retained.manifest, storage))
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum AdmissionReply {
    Admitted {
        fire: String,
        attempt: String,
        replayed: bool,
    },
    Refused {
        code: String,
        replay_key: String,
        dispatch: Option<String>,
    },
}

/// This token contains no dispatch. Only acknowledge_admission may expose it
/// after comparing the committed collection with this exact contribution.
pub struct AdmissionContribution {
    replay_key: String,
    expected: Value,
    replayed: bool,
}

fn allocate(records: &mut Value, replay_key: &str) -> Result<String> {
    if let Some(saved) = records
        .get("occurrences")
        .and_then(|values| values.get(replay_key))
    {
        return serde_json::from_value(saved.clone()).map_err(Error::from);
    }
    let sequence = records
        .get("occurrence_sequence")
        .and_then(Value::as_u64)
        .unwrap_or(0)
        .checked_add(1)
        .ok_or_else(|| Error::Invalid("occurrence overflow".into()))?;
    let occurrence = format!("occ{sequence}");
    records["occurrence_sequence"] = json!(sequence);
    persistence::insert(records, "occurrences", replay_key, &occurrence)?;
    Ok(occurrence)
}

pub fn contribute_admission(
    view: &View,
    transaction: &mut Transaction,
    mut input: PendingAdmission,
    clock: &mut impl Clock,
) -> Result<AdmissionContribution> {
    let data = transaction.snapshot.as_ref().unwrap_or(&view.snapshot.data);
    let mut records = persistence::records(data)?;
    let key = input.admission.replay_key.clone();
    if let Some(saved) = records.get("replays").and_then(|values| values.get(&key)) {
        return Ok(AdmissionContribution {
            replay_key: key,
            expected: saved.clone(),
            replayed: true,
        });
    }
    let occurrence = allocate(&mut records, &key)?;
    let admission = &mut input.admission;
    admission.home.occurrence = occurrence.clone();
    if input.home_path.is_empty()
        || input.attempts.is_empty()
        || admission.fire.is_empty()
        || admission.round == 0
        || input.manifest.fire != admission.fire
        || input.manifest.manifest != admission.artifact
    {
        return Err(Error::Invalid("incomplete admission identity".into()));
    }
    super::manifest::validate_manifest(&input.manifest)
        .map_err(|error| Error::Invalid(format!("{error:?}")))?;
    for entry in &input.manifest.entries {
        if entry.availability == super::model::Availability::Available {
            super::material::read_material(&mut input.material, entry)?;
        }
    }
    input.material.contribute(&mut records)?;
    persistence::insert(
        &mut records,
        "manifests",
        &admission.artifact,
        &input.manifest,
    )?;
    for attempt in &mut input.attempts {
        attempt.occurrence = occurrence.clone();
        if attempt.fire != admission.fire
            || attempt.round != admission.round
            || attempt.view.manifest != admission.artifact
            || attempt.state != AttemptState::Intended
            || attempt.original.is_some()
            || attempt.launch.is_some()
            || attempt.host_return.is_some()
            || !admission.roster.required.contains(&attempt.slot)
        {
            return Err(Error::Invalid("invalid initial attempt".into()));
        }
        if attempt.view.entries.iter().any(|id| {
            !input
                .manifest
                .entries
                .iter()
                .any(|entry| &entry.entry == id)
        }) {
            return Err(Error::Invalid(
                "attempt view contains unknown material".into(),
            ));
        }
        persistence::insert(&mut records, "attempts", &attempt.attempt, attempt)?;
    }
    for slot in &admission.roster.required {
        if input
            .attempts
            .iter()
            .filter(|attempt| &attempt.slot == slot)
            .count()
            != 1
        {
            return Err(Error::Invalid("incomplete initial roster".into()));
        }
    }
    persistence::insert(
        &mut records,
        "homes",
        &occurrence,
        &json!({"home":admission.home,"scope":admission.scope,"path":input.home_path,"fire":admission.fire}),
    )?;
    persistence::insert(&mut records, "admissions", &admission.fire, admission)?;
    let binding = json!({"fire":admission.fire,"attempt":input.attempts[0].attempt,"attempts":input.attempts.iter().map(|a| &a.attempt).collect::<Vec<_>>(),"occurrence":occurrence,"admitted_at":clock.now()});
    persistence::insert(&mut records, "replays", &key, &binding)?;
    persistence::contribute(view, transaction, records)?;
    Ok(AdmissionContribution {
        replay_key: key,
        expected: binding,
        replayed: false,
    })
}

pub fn acknowledge_admission(
    committed: &View,
    contribution: AdmissionContribution,
) -> Result<AdmissionReply> {
    let records = persistence::records(&committed.snapshot.data)?;
    let saved: Value = persistence::get(&records, "replays", &contribution.replay_key)?;
    if saved != contribution.expected {
        return Err(Error::Conflict("admission not confirmed".into()));
    }
    Ok(AdmissionReply::Admitted {
        fire: saved["fire"]
            .as_str()
            .ok_or_else(|| Error::Invalid("invalid replay fire".into()))?
            .into(),
        attempt: saved["attempt"]
            .as_str()
            .ok_or_else(|| Error::Invalid("invalid replay attempt".into()))?
            .into(),
        replayed: contribution.replayed,
    })
}

pub async fn admit_pending(
    store: &Store,
    view: &View,
    mut transaction: Transaction,
    input: PendingAdmission,
    clock: &mut impl Clock,
) -> Result<AdmissionReply> {
    let replay_key = input.admission.replay_key.clone();
    let contribution = contribute_admission(view, &mut transaction, input, clock)?;
    let committed = if contribution.replayed {
        persistence::read(store).await
    } else {
        persistence::commit(store, view, transaction).await
    };
    match committed {
        Ok(view) => acknowledge_admission(&view, contribution),
        Err(Error::Conflict(_)) => Ok(AdmissionReply::Refused {
            code: "revision-conflict".into(),
            replay_key,
            dispatch: None,
        }),
        Err(error) => Err(error),
    }
}

pub async fn read_admission(store: &Store, fire: &str) -> Result<Admission> {
    persistence::get(
        &persistence::records(&persistence::read(store).await?.snapshot.data)?,
        "admissions",
        fire,
    )
}

pub async fn allocate_occurrence(
    store: &Store,
    replay_key: &str,
    _clock: &mut impl Clock,
) -> Result<String> {
    let view = persistence::read(store).await?;
    let mut records = persistence::records(&view.snapshot.data)?;
    if let Some(saved) = records
        .get("occurrences")
        .and_then(|values| values.get(replay_key))
    {
        return Ok(serde_json::from_value(saved.clone())?);
    }
    let occurrence = allocate(&mut records, replay_key)?;
    let mut transaction = persistence::transaction(&view, &format!("occurrence:{replay_key}"));
    persistence::contribute(&view, &mut transaction, records)?;
    persistence::commit(store, &view, transaction).await?;
    Ok(occurrence)
}
