//! Internal selection uses verified lifecycle, config and evidence generations.
use super::derivation_service::{self, Driver, store_error};
use crate::{
    config::{merge, reload::ConfigIo},
    import::SessionFactory,
};
use cadence::{
    derivation::{self, CompatibilityCursor, DerivationError},
    evidence::{Fact, authority, overrides::Meaning, persistence},
    next_action::{self, Action, Pause, observations},
    store::{Error, writer::View},
};
use std::path::Path;

fn ordered_records(view: &View) -> Result<Vec<cadence::evidence::Record>, DerivationError> {
    let mut current = persistence::read(&view.snapshot.data).map_err(store_error)?;
    let mut ordered = Vec::new();
    for decision in view.decisions.iter().rev() {
        if let Some(historical) = persistence::decode_history(decision).map_err(store_error)?
            && let Some(record) = current.remove(&historical.key().map_err(store_error)?)
        {
            ordered.push(record);
        }
    }
    if !current.is_empty() {
        return Err(store_error(Error::Invalid(
            "native continuation records lack history".into(),
        )));
    }
    ordered.reverse();
    Ok(ordered)
}

fn material_observations(
    root: &Path,
    material: &[cadence::evidence::checker::CheckedMaterial],
) -> cadence::evidence::material::Observations {
    use cadence::derivation::{ArtifactFiles, ArtifactIo, Observation};
    super::evidence_service::observe_material(root, material, &mut |path| match ArtifactFiles
        .read(path)
    {
        Observation::Present(bytes) => Ok(bytes),
        Observation::Absent => Err(std::io::ErrorKind::NotFound.into()),
        Observation::Failed(error) => Err(std::io::Error::other(format!("{error:?}"))),
    })
}

async fn recheck_continuation(
    capture: &cadence::derivation::CapturedInputs,
    material: &[cadence::evidence::checker::CheckedMaterial],
    observed: &cadence::evidence::material::Observations,
    driver: &Driver,
) -> Result<(), DerivationError> {
    let capture = capture.clone();
    let material = material.to_vec();
    let observed = observed.clone();
    let driver = driver.clone();
    tokio::task::spawn_blocking(move || {
        // The native acceptance overlay is a function of the owned snapshot,
        // which every caller compares after this recapture; only the artifact
        // capture and material need an independent second observation here.
        let current = derivation::capture_inputs(&capture.root, (driver.artifacts)().as_mut())?;
        let reobserved = material_observations(&capture.root, &material);
        recheck_holds(&capture, &current, &observed, &reobserved)
    })
    .await
    .map_err(|_| store_error(Error::Closed))?
}

/// A continuation stands only when the lifecycle capture and the checked
/// material read the same on the recheck as when it was decided.
pub(super) fn recheck_holds(
    capture: &cadence::derivation::CapturedInputs,
    recaptured: &cadence::derivation::CapturedInputs,
    observed: &cadence::evidence::material::Observations,
    reobserved: &cadence::evidence::material::Observations,
) -> Result<(), DerivationError> {
    if recaptured != capture || reobserved != observed {
        return Err(DerivationError::InputsChanged);
    }
    Ok(())
}

/// The record that asks a checkpoint's question in `scope`, and the decision
/// once it is recorded: waiting on that same gate.
pub(super) fn ask(
    scope: &cadence::evidence::Scope,
    gate: cadence::evidence::gates::Gate,
) -> (cadence::evidence::Record, cadence::next_action::continuation::Decision) {
    let record = cadence::evidence::Record {
        version: cadence::evidence::VERSION,
        scope: scope.clone(),
        fact: Fact::Gate(gate.clone()),
    };
    (record, cadence::next_action::continuation::Decision::Wait(gate))
}

/// Reads one named occurrence. The phase 6 dispatcher consumes this decision.
pub async fn continuation<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    root: &Path,
    scope: &cadence::evidence::Scope,
    driver: &Driver,
) -> Result<cadence::next_action::continuation::Continuation, DerivationError> {
    use cadence::{
        evidence::material,
        next_action::continuation::{self, Decision},
    };
    scope.validate().map_err(store_error)?;
    let (checked, mut view) = derivation_service::checked_query(factory, root, driver).await?;
    let root = checked.capture().root.clone();
    if Path::new(&scope.planning_root) != root || root.parent() != Some(Path::new(&scope.project)) {
        return Err(store_error(Error::Invalid(
            "continuation scope differs from selected root".into(),
        )));
    }
    let session = factory.first_touch(&root).await.map_err(store_error)?;
    let config = session.config().map_err(store_error)?;
    let records = ordered_records(&view)?;
    let checker = continuation::latest_checker(&records, scope);
    let material = checker
        .map(|c| material::basis(&records, scope, &c.id))
        .transpose()
        .map_err(store_error)?
        .unwrap_or_default();
    let task_root = root.clone();
    let task_material = material.clone();
    let observed =
        tokio::task::spawn_blocking(move || material_observations(&task_root, &task_material))
            .await
            .map_err(|_| store_error(Error::Closed))?;
    let applicability = checker
        .map(|c| authority::checker_applicability(&records, scope, &c.id, &observed))
        .transpose()
        .map_err(store_error)?;
    let plans = checked
        .answer()
        .phases
        .iter()
        .find(|p| p.id.address() == scope.phase)
        .map(|p| p.plans.as_slice())
        .unwrap_or_default();
    let mut selected = continuation::select(&records, scope, applicability, plans);
    if let Ok(phase) = scope.phase.parse::<u32>()
        && let Some(active) = view.snapshot.data["execution"]["occurrences"][phase.to_string()]["active"].as_object()
        && let Some(plan) = active.get("plan").and_then(serde_json::Value::as_u64).and_then(|plan| u32::try_from(plan).ok()) {
        let plan_events = cadence::execution::history::plan_records(&view.snapshot.data, phase)
            .map_err(store_error)?;
        let admitted = cadence::execution::history::admitted_plans(&view.snapshot.data, phase)
            .map_err(store_error)?;
        if let Some((identity, _)) = admitted.iter().find(|(identity, _)| identity.plan == plan)
            && let Some(decision) = continuation::plan_repair_decision(
                &cadence::execution::history::plan_project(&plan_events, identity)) {
            selected.checkpoint = None;
            selected.decision = decision;
        }
    }
    recheck_continuation(checked.capture(), &material, &observed, driver).await?;
    let latest = session.derivation_view().await.map_err(store_error)?;
    if latest.snapshot != view.snapshot || session.config().map_err(store_error)? != config {
        return Err(DerivationError::InputsChanged);
    }
    if let Decision::NeedQuestion(gate) = selected.decision {
        let (record, waiting) = ask(scope, gate);
        let operation = format!(
            "continuation-question:{}",
            record.key().map_err(store_error)?
        );
        view = session
            .commit_evidence(&view, &operation, &record)
            .await
            .map_err(store_error)?;
        selected.decision = waiting;
        recheck_continuation(checked.capture(), &material, &observed, driver).await?;
        if session
            .derivation_view()
            .await
            .map_err(store_error)?
            .snapshot
            != view.snapshot
            || session.config().map_err(store_error)? != config
        {
            return Err(DerivationError::InputsChanged);
        }
    }
    Ok(selected)
}

pub(super) fn pause(view: &View) -> Result<Option<Pause>, DerivationError> {
    let records: Vec<_> = persistence::read(&view.snapshot.data)
        .map_err(store_error)?
        .into_values()
        .collect();
    // History supplies chronology; current records supply occurrence lifetime.
    for decision in view.decisions.iter().rev() {
        let Some(record) = persistence::decode_history(decision).map_err(store_error)? else {
            continue;
        };
        let Fact::Override(value) = &record.fact else {
            continue;
        };
        let Meaning::PausedNext { sentence } = &value.meaning else {
            continue;
        };
        return if authority::permission(&records, &record.scope, &value.id).active() {
            let phase = serde_json::from_value(serde_json::json!(
                record
                    .scope
                    .phase
                    .parse::<f64>()
                    .map_err(|_| store_error(Error::Invalid(
                        "pause phase is not numeric".into()
                    )))?
            ))
            .map_err(|e| store_error(Error::Invalid(e.to_string())))?;
            Ok(Some(Pause {
                phase,
                next: sentence.clone(),
            }))
        } else {
            Ok(None)
        };
    }
    // Retirement ends the assertion, not the valid sentence's provenance.
    let original = view
        .snapshot
        .data
        .get("cursor")
        .unwrap_or(&serde_json::Value::Null);
    Ok(match derivation::normalize_imported_cursor(original)? {
        CompatibilityCursor::Held(p) => p
            .phase
            .zip(p.next)
            .map(|(phase, next)| Pause { phase, next }),
        _ => None,
    })
}

/// Whether the effective config skips discussion for an unplanned phase. A
/// config that does not say controls nothing, so the query refuses.
pub(super) fn skip_discuss(values: &serde_json::Value) -> Result<bool, DerivationError> {
    merge::get(values, "workflow.skip_discuss")
        .and_then(serde_json::Value::as_bool)
        .ok_or_else(|| {
            store_error(Error::Policy(
                "next-action controlling config unavailable".into(),
            ))
        })
}

/// The undo mirror uses the selector with prospective lifecycle and retained
/// pause/interruption authority. Queue rules follow Planned in this selector.
pub fn undo_next(root: &Path, lifecycle: &derivation::Lifecycle, view: &View, config: &serde_json::Value) -> Result<String, DerivationError> {
    let observed = observations::capture(root, lifecycle)?;
    let paused = pause(view)?;
    let skip = skip_discuss(config)?;
    let interruption = match lifecycle.current.and_then(|p| p.address().parse::<u32>().ok()) {
        Some(phase) => cadence::execution::history::interrupted_dispatch(&view.snapshot.data, phase, view.snapshot.generation).map_err(store_error)?,
        None => None,
    };
    Ok(next_action::select_with_interruptions(lifecycle, &observed, paused.as_ref(), skip, &[],
        interruption.as_ref().map(|i| i.id.as_str())).map_or_else(String::new, |a| a.instruction()))
}

pub async fn query<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    root: &Path,
    driver: &Driver,
) -> Result<Option<Action>, DerivationError> {
    let (checked, view) = derivation_service::checked_query(factory, root, driver).await?;
    query_checked(factory, checked, view, driver, &[]).await
}

pub async fn query_checked<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>, checked: derivation::RecheckedLifecycle, view: View,
    driver: &Driver, conflicts: &[derivation::RoadmapConflict],
) -> Result<Option<Action>, DerivationError> {
    let root = checked.capture().root.clone();
    let session = factory.first_touch(&root).await.map_err(store_error)?;
    let config = session.config().map_err(store_error)?;
    let skip = skip_discuss(&config.effective.values)?;
    let paused = pause(&view)?;
    let task_root = root.clone();
    let lifecycle = checked.answer().clone();
    let mut observed =
        tokio::task::spawn_blocking(move || observations::capture(&task_root, &lifecycle))
            .await
            .map_err(|_| store_error(Error::Closed))??;
    let modern = cadence::review::deferred::enumerate_deferred(session.review_store())
        .await
        .map_err(store_error)?;
    let records =
        cadence::review::persistence::records(&view.snapshot.data).map_err(store_error)?;
    let mut members = Vec::new();
    let mut unreadable = Vec::new();
    for member in modern.members {
        let address = std::path::PathBuf::from(format!("review:{}", member.member));
        let input = cadence::review::consumers::deferred_enqueue_input(
            session.review_store(),
            &member.references.attempt,
        )
        .await;
        match input {
            Ok(input) => {
                if input.findings.is_none() {
                    unreadable.push(address.clone());
                }
                members.push(observations::QueueMember {
                    path: address,
                    phase: input.admission.home.id,
                    trigger: input.admission.trigger.unwrap_or_default(),
                    discriminator: input.admission.discriminator,
                    round: input.admission.round,
                    findings: input.findings.map_or(0, |findings| findings.len()),
                });
            }
            Err(_) => unreadable.push(address),
        }
    }
    observations::include_reviews(&mut observed.queue, members.clone(), unreadable.clone());
    let interruption = match checked.answer().current.and_then(|p| p.address().parse::<u32>().ok()) {
        Some(phase) => cadence::execution::history::interrupted_dispatch(&view.snapshot.data, phase, view.snapshot.generation).map_err(store_error)?,
        None => None,
    };
    let answer = next_action::select_with_interruptions(checked.answer(), &observed, paused.as_ref(), skip, conflicts,
        interruption.as_ref().map(|i| i.id.as_str()));
    let task_driver = driver.clone();
    let task_capture = checked.capture().clone();
    let (current, lifecycle) = tokio::task::spawn_blocking(move || {
        let mut current = observations::capture(&root, checked.answer())?;
        observations::include_reviews(&mut current.queue, members, unreadable);
        let lifecycle = derivation::capture_inputs(&root, (task_driver.artifacts)().as_mut())?;
        Ok::<_, DerivationError>((current, lifecycle))
    })
    .await
    .map_err(|_| store_error(Error::Closed))??;
    let latest = session.derivation_view().await.map_err(store_error)?;
    let after = Consumed {
        observed: current,
        capture: lifecycle,
        reviews: cadence::review::persistence::records(&latest.snapshot.data).map_err(store_error)?,
        snapshot: latest.snapshot.clone(),
        config: session.config().map_err(store_error)?,
    };
    let before = Consumed {
        observed,
        capture: task_capture,
        reviews: records,
        snapshot: view.snapshot,
        config,
    };
    held(&before, &after)?;
    Ok(answer)
}

/// What a next-action answer was selected from.
pub(super) struct Consumed {
    pub(super) observed: observations::Observations,
    pub(super) capture: derivation::CapturedInputs,
    pub(super) reviews: serde_json::Value,
    pub(super) snapshot: cadence::store::model::Snapshot,
    pub(super) config: crate::config::reload::Generation,
}

/// An answer is served only when everything it was selected from reads the
/// same after selection: the reports, queue and residue observed, the
/// lifecycle capture, the review records, the store snapshot and the config.
pub(super) fn held(before: &Consumed, after: &Consumed) -> Result<(), DerivationError> {
    if after.observed != before.observed
        || after.capture != before.capture
        || after.reviews != before.reviews
        || after.snapshot != before.snapshot
        || after.config != before.config
    {
        return Err(DerivationError::InputsChanged);
    }
    Ok(())
}
