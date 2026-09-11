//! Blocking artifact adapter and publication through the resident's session.
use crate::{config::reload::ConfigIo, import::SessionFactory};
use cadence::{
    derivation::*,
    store::{Error, writer::STALE_SNAPSHOT},
};
use std::{path::Path, sync::Arc};

pub type ArtifactFactory = Arc<dyn Fn() -> Box<dyn ArtifactIo + Send> + Send + Sync>;

#[derive(Clone)]
pub struct Driver {
    #[cfg(test)]
    pub compare: fn(
        Option<&serde_json::Value>,
        &str,
        &Lifecycle,
    ) -> Result<MemoDisposition, DerivationError>,
    pub artifacts: ArtifactFactory,
    #[cfg(test)]
    pub event: Arc<dyn Fn(Event) + Send + Sync>,
}
#[cfg(test)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Event {
    Derived,
    BeforeCommit,
    RoutingObserved,
}
impl Default for Driver {
    fn default() -> Self {
        Self {
            #[cfg(test)]
            compare: check_memo,
            artifacts: Arc::new(|| Box::new(ArtifactFiles)),
            #[cfg(test)]
            event: Arc::new(|_| {}),
        }
    }
}

pub fn store_error(error: Error) -> DerivationError {
    let kind = match &error {
        Error::Invalid(_) => "invalid",
        Error::Conflict(_) => "conflict",
        Error::Io(_) => "io",
        Error::Policy(_) => "policy",
        Error::Closed => "closed",
    };
    DerivationError::Store {
        kind: kind.into(),
        detail: error.to_string(),
    }
}
fn publication_error(error: Error) -> DerivationError {
    if error == Error::Conflict(STALE_SNAPSHOT.into()) {
        DerivationError::InputsChanged
    } else {
        store_error(error)
    }
}
struct Intake(IntakeObservation);
impl IntakeIo for Intake {
    fn observe_intake(&mut self) -> Result<IntakeObservation, DerivationError> {
        Ok(self.0.clone())
    }
}

pub async fn query<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    root: &Path,
    driver: &Driver,
) -> Result<Lifecycle, DerivationError> {
    Ok(checked_query(factory, root, driver)
        .await?
        .0
        .answer()
        .clone())
}

pub async fn checked_query<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    root: &Path,
    driver: &Driver,
) -> Result<(RecheckedLifecycle, cadence::store::writer::View), DerivationError> {
    let selected_root = root.to_path_buf();
    let task_driver = driver.clone();
    let (prepared, mut io) = tokio::task::spawn_blocking(move || {
        let mut io = (task_driver.artifacts)();
        let prepared = prepare_query(&selected_root, io.as_mut())?;
        #[cfg(test)]
        (task_driver.event)(Event::Derived);
        Ok::<_, DerivationError>((prepared, io))
    })
    .await
    .map_err(|_| store_error(Error::Closed))??;
    // A missing root or inconsistent ROADMAP refuses before import can create it.
    let session = factory
        .first_touch(&prepared.capture().root)
        .await
        .map_err(store_error)?;
    let view = session.derivation_view().await.map_err(store_error)?;
    let key = input_key(prepared.capture())?;
    // Validate the namespace before intake interprets its retirement sibling.
    let raw = memo_from_data(&view.snapshot.data, &key)?;
    let selected = select_intake(&view.snapshot.data)?;
    let pending = selected.pending(&view.snapshot.data)?;
    let prepared = prepared.with_intake(&selected)?;
    #[cfg(test)]
    let disposition = (driver.compare)(raw, &key, prepared.answer())?;
    #[cfg(not(test))]
    let disposition = check_memo(raw, &key, prepared.answer())?;
    let memo = LifecycleMemo::fresh(key, prepared.answer().clone());
    let rechecked = tokio::task::spawn_blocking(move || {
        recheck_query_with_intake(&prepared, io.as_mut(), &mut Intake(selected.observation))
    })
    .await
    .map_err(|_| store_error(Error::Closed))??;
    let latest = session.derivation_view().await.map_err(store_error)?;
    if latest.snapshot.generation != view.snapshot.generation
        || latest.snapshot.integrity != view.snapshot.integrity
    {
        return Err(DerivationError::InputsChanged);
    }
    recheck_intake(
        rechecked.intake().expect("selected intake").observation(),
        &IntakeObservation::from_data(&latest.snapshot.data),
    )?;
    let published = if disposition == MemoDisposition::Miss || pending {
        let data = rechecked.adopt_memo(&view.snapshot.data, &memo)?;
        #[cfg(test)]
        {
            let event = driver.event.clone();
            tokio::task::spawn_blocking(move || event(Event::BeforeCommit))
                .await
                .map_err(|_| store_error(Error::Closed))?;
        }
        session
            .commit_derivation(&view, data)
            .await
            .map_err(publication_error)?
    } else {
        latest
    };
    Ok((rechecked, published))
}
