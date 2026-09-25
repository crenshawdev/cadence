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
        Error::GitLimit(_) => "git-limit",
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
/// Whether a checked query writes its memo. The store must still be the one
/// the answer was checked against, `checked`: the same generation, integrity
/// and intake. Then it writes only when the stored memo missed or an intake
/// is still waiting to be adopted; otherwise it answers from the store.
pub fn publish(
    checked: &cadence::store::model::Snapshot,
    latest: &cadence::store::model::Snapshot,
    intake: &IntakeObservation,
    disposition: MemoDisposition,
    pending: bool,
) -> Result<bool, DerivationError> {
    if latest.generation != checked.generation || latest.integrity != checked.integrity {
        return Err(DerivationError::InputsChanged);
    }
    recheck_intake(intake, &IntakeObservation::from_data(&latest.data))?;
    Ok(disposition == MemoDisposition::Miss || pending)
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
    checked(factory, root, driver, false).await
}

pub async fn checked_progress<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>, root: &Path, driver: &Driver,
) -> Result<(RecheckedLifecycle, cadence::store::writer::View), DerivationError> {
    checked(factory, root, driver, true).await
}

/// Derive the prospective undo mirror from the same captured lifecycle inputs.
/// Publication still happens through the normal checked service after the
/// journal installs the marker and the sealed final commit.
pub fn undo_lifecycle(root: &Path, data: &serde_json::Value, phase: u32, roadmap: Vec<u8>) -> cadence::store::Result<Lifecycle> {
    let invalid = |error: DerivationError| Error::Invalid(error.to_string());
    let mut capture = capture_inputs(root, &mut ArtifactFiles).map_err(invalid)?;
    capture.declarations = Some(parse_roadmap(std::str::from_utf8(&roadmap).map_err(|e| Error::Invalid(e.to_string()))?));
    capture.roadmap = Observation::Present(roadmap);
    let mut overlay = acceptance_overlay(data).map_err(invalid)?;
    overlay.phases.insert(phase.to_string(), AcceptancePhase { published: true, executed: false,
        completion: None, label: None, met: 0, waived: 0, disagreement: None });
    derive_with(&capture, &overlay).map_err(invalid)
}

/// One observation of the artifacts on the blocking pool; the test event
/// fires for the request's first observation only.
async fn observe(
    selected: std::path::PathBuf, driver: Driver, report_conflicts: bool, first: bool,
) -> Result<(PreparedLifecycle, Box<dyn ArtifactIo + Send>), DerivationError> {
    tokio::task::spawn_blocking(move || {
        let mut io = (driver.artifacts)();
        let prepared = if report_conflicts {
            prepare_progress(&selected, io.as_mut())?
        } else {
            prepare_query(&selected, io.as_mut())?
        };
        #[cfg(test)]
        if first {
            (driver.event)(Event::Derived);
        }
        #[cfg(not(test))]
        let _ = first;
        Ok::<_, DerivationError>((prepared, io))
    })
    .await
    .map_err(|_| store_error(Error::Closed))?
}

async fn checked<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>, root: &Path, driver: &Driver, report_conflicts: bool,
) -> Result<(RecheckedLifecycle, cadence::store::writer::View), DerivationError> {
    let (mut prepared, mut io) = observe(root.to_path_buf(), driver.clone(), report_conflicts, true).await?;
    // A missing root or inconsistent ROADMAP refuses before import can create it.
    let session = factory
        .first_touch(&prepared.capture().root)
        .await
        .map_err(store_error)?;
    let view = session.derivation_view().await.map_err(store_error)?;
    // The native acceptance authority was read beside the artifacts; the
    // owned view is the authority. A first touch that has just imported a
    // legacy tree wrote its declared completions between the two reads, so
    // the artifacts are observed once more against the imported store; any
    // other difference is a changed input.
    if acceptance_overlay(&view.snapshot.data)? != *prepared.overlay() {
        (prepared, io) = observe(prepared.capture().root.clone(), driver.clone(), report_conflicts, false).await?;
        if acceptance_overlay(&view.snapshot.data)? != *prepared.overlay() {
            return Err(DerivationError::InputsChanged);
        }
    }
    let key = prepared.input_key()?;
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
    let writes = publish(
        &view.snapshot,
        &latest.snapshot,
        rechecked.intake().expect("selected intake").observation(),
        disposition,
        pending,
    )?;
    let published = if writes {
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

#[cfg(test)]
mod publish_tests {
    use super::*;
    use cadence::store::model::Snapshot;
    use serde_json::json;

    #[test]
    fn a_git_deadline_has_a_distinct_store_classification() {
        assert_eq!(store_error(Error::GitLimit(cadence::git_process::Limit {
            command: "git status".into(),
            bound: std::time::Duration::from_secs(60),
        })), DerivationError::Store {
            kind: "git-limit".into(),
            detail: "git status exceeded git deadline of 60 seconds".into(),
        });
    }

    /// A store snapshot holding `data` at `generation`.
    fn snapshot(generation: u64, data: serde_json::Value) -> Snapshot {
        Snapshot::new(generation, b"", b"", data).unwrap()
    }

    fn paused() -> serde_json::Value {
        json!({"cursor": {"status": "paused"}})
    }

    #[test]
    fn a_memo_miss_or_a_pending_intake_is_published() {
        let checked = snapshot(3, paused());
        let intake = IntakeObservation::from_data(&checked.data);
        for (disposition, pending) in [(MemoDisposition::Miss, false), (MemoDisposition::Hit, true), (MemoDisposition::Miss, true)] {
            assert_eq!(publish(&checked, &checked.clone(), &intake, disposition, pending), Ok(true), "{disposition:?} {pending}");
        }
    }

    #[test]
    fn a_memo_hit_with_nothing_pending_answers_without_writing() {
        let checked = snapshot(3, paused());
        let intake = IntakeObservation::from_data(&checked.data);
        assert_eq!(publish(&checked, &checked.clone(), &intake, MemoDisposition::Hit, false), Ok(false));
    }

    #[test]
    fn a_store_that_moved_on_since_the_check_refuses_as_inputs_changed() {
        let checked = snapshot(3, paused());
        let intake = IntakeObservation::from_data(&checked.data);
        for latest in [snapshot(4, paused()), snapshot(3, json!({"cursor": {"status": "paused"}, "other": 1}))] {
            assert_eq!(
                publish(&checked, &latest, &intake, MemoDisposition::Miss, false),
                Err(DerivationError::InputsChanged)
            );
        }
    }

    #[test]
    fn an_intake_that_differs_from_the_one_checked_refuses_as_inputs_changed() {
        let checked = snapshot(3, paused());
        let other = IntakeObservation::from_data(&json!({"cursor": {"status": "planned"}}));
        assert_eq!(
            publish(&checked, &checked.clone(), &other, MemoDisposition::Hit, false),
            Err(DerivationError::InputsChanged)
        );
    }

    #[test]
    fn a_publication_refused_as_stale_is_inputs_changed() {
        assert_eq!(publication_error(Error::Conflict(STALE_SNAPSHOT.into())), DerivationError::InputsChanged);
    }

    #[test]
    fn any_other_store_failure_is_a_store_error_naming_its_kind() {
        for (error, kind) in [
            (Error::Conflict("other".into()), "conflict"),
            (Error::Policy("config unavailable".into()), "policy"),
            (Error::Io("disk".into()), "io"),
            (Error::Invalid("bad".into()), "invalid"),
            (Error::Closed, "closed"),
        ] {
            assert_eq!(
                publication_error(error.clone()),
                DerivationError::Store { kind: kind.into(), detail: error.to_string() }
            );
        }
    }
}
