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
        let current = derivation::capture_inputs(&capture.root, (driver.artifacts)().as_mut())?;
        if current != capture || material_observations(&capture.root, &material) != observed {
            return Err(DerivationError::InputsChanged);
        }
        Ok(())
    })
    .await
    .map_err(|_| store_error(Error::Closed))?
}

/// Reads one named occurrence. The phase 6 dispatcher consumes this decision.
pub async fn continuation<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    root: &Path,
    scope: &cadence::evidence::Scope,
    driver: &Driver,
) -> Result<cadence::next_action::continuation::Continuation, DerivationError> {
    use cadence::{
        evidence::{self, material},
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
    #[cfg(test)]
    {
        let event = driver.event.clone();
        tokio::task::spawn_blocking(move || {
            event(super::derivation_service::Event::RoutingObserved)
        })
        .await
        .map_err(|_| store_error(Error::Closed))?;
    }
    recheck_continuation(checked.capture(), &material, &observed, driver).await?;
    let latest = session.derivation_view().await.map_err(store_error)?;
    if latest.snapshot != view.snapshot || session.config().map_err(store_error)? != config {
        return Err(DerivationError::InputsChanged);
    }
    if let Decision::NeedQuestion(gate) = selected.decision {
        let record = evidence::Record {
            version: evidence::VERSION,
            scope: scope.clone(),
            fact: Fact::Gate(gate.clone()),
        };
        let operation = format!(
            "continuation-question:{}",
            record.key().map_err(store_error)?
        );
        view = session
            .commit_evidence(&view, &operation, &record)
            .await
            .map_err(store_error)?;
        selected.decision = Decision::Wait(gate);
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

fn pause(view: &View) -> Result<Option<Pause>, DerivationError> {
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

pub async fn query<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    root: &Path,
    driver: &Driver,
) -> Result<Option<Action>, DerivationError> {
    let (checked, view) = derivation_service::checked_query(factory, root, driver).await?;
    let root = checked.capture().root.clone();
    let session = factory.first_touch(&root).await.map_err(store_error)?;
    let config = session.config().map_err(store_error)?;
    let skip = merge::get(&config.effective.values, "workflow.skip_discuss")
        .and_then(serde_json::Value::as_bool)
        .ok_or_else(|| {
            store_error(Error::Policy(
                "next-action controlling config unavailable".into(),
            ))
        })?;
    let paused = pause(&view)?;
    let task_root = root.clone();
    let lifecycle = checked.answer().clone();
    let observed =
        tokio::task::spawn_blocking(move || observations::capture(&task_root, &lifecycle))
            .await
            .map_err(|_| store_error(Error::Closed))??;
    let answer = next_action::select(checked.answer(), &observed, paused.as_ref(), skip);
    #[cfg(test)]
    {
        let event = driver.event.clone();
        tokio::task::spawn_blocking(move || {
            event(super::derivation_service::Event::RoutingObserved)
        })
        .await
        .map_err(|_| store_error(Error::Closed))?;
    }
    let task_driver = driver.clone();
    tokio::task::spawn_blocking(move || {
        let current = observations::capture(&root, checked.answer())?;
        let lifecycle = derivation::capture_inputs(&root, (task_driver.artifacts)().as_mut())?;
        if current != observed || &lifecycle != checked.capture() {
            return Err(DerivationError::InputsChanged);
        }
        Ok(())
    })
    .await
    .map_err(|_| store_error(Error::Closed))??;
    let latest = session.derivation_view().await.map_err(store_error)?;
    if latest.snapshot != view.snapshot || session.config().map_err(store_error)? != config {
        return Err(DerivationError::InputsChanged);
    }
    Ok(answer)
}
