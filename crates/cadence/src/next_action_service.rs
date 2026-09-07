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
