//! Resident-owned risk observations. Detection and confirmed persistence are separate.
use crate::{
    config::{
        merge,
        reload::{self, ConfigIo},
    },
    import::SessionFactory,
};
use cadence::{
    envelope::Envelope,
    rail::{
        git,
        risk::{self, Apply, Observation, Recorded, Scope},
    },
    store::{Error, Result, writer::Operation},
};
use std::path::Path;

pub type Answer = Result<Envelope<Recorded>>;

pub async fn apply<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    selected: &Path,
    request: Apply,
) -> Answer {
    let Apply::RiskCheck {
        request_id,
        scope: selection,
        source,
        surfaces,
    } = &request;
    if risk::validate_name(request_id).is_err()
        || risk::validate_name(&selection.occurrence).is_err()
        || selection
            .worker
            .as_deref()
            .is_some_and(|worker| risk::validate_name(worker).is_err())
    {
        return Ok(refused(
            "invalid-scope",
            "scope and request identities must be nonempty safe names",
        ));
    }
    let root = reload::identity(selected)?;
    if !root.join(format!("phases/{}", selection.phase)).is_dir() {
        return Ok(refused(
            "invalid-scope",
            "requested phase directory is unavailable",
        ));
    }
    let session = match factory.first_touch(&root).await {
        Ok(session) => session,
        Err(error) if factory.guard_config(&root).is_err() => {
            return Ok(refused("config-unavailable", &error.to_string()));
        }
        Err(error) => return Err(error),
    };
    let config = match session.config() {
        Ok(config) => config,
        Err(error) => return Ok(refused("config-unavailable", &error.to_string())),
    };
    let chosen = match surfaces {
        Some(values) => risk::validate_surfaces(values.clone()).map(Some),
        None => merge::get(
            &config.effective.values,
            "review.triggers.risk_surface.surfaces",
        )
        .ok_or_else(|| Error::Policy("missing risk surface selection".into()))
        .and_then(risk::configured_surfaces),
    };
    let surfaces = match chosen {
        Ok(Some(values)) => values,
        Ok(None) => {
            return Ok(refused(
                "unanswered-surfaces",
                "risk surface selection is unanswered",
            ));
        }
        Err(error) => return Ok(refused("invalid-surfaces", &error.to_string())),
    };
    let view = session.derivation_view().await?;
    let project = root
        .parent()
        .ok_or_else(|| Error::Invalid("planning root lacks project".into()))?
        .to_path_buf();
    let scope = Scope {
        project: project.to_string_lossy().into_owned(),
        planning_root: root.to_string_lossy().into_owned(),
        cycle: "live".into(),
        occurrence: selection.occurrence.clone(),
        phase: selection.phase,
        worker: selection.worker.clone(),
        plan: None,
    };
    let request_digest = request.digest()?;
    if let Some(old) = risk::confirmed(&view, &scope, request_id)? {
        return if old.observation.request_digest == request_digest {
            Ok(Envelope::Ok(old))
        } else {
            Ok(refused(
                "request-reused",
                "request identity already records different input",
            ))
        };
    }
    let source = source.clone();
    let observation = tokio::task::spawn_blocking(move || {
        let (resolution, mut diagnostics) = git::resolve(&project, &source);
        let scan = match resolution.material() {
            Some(material) => match git::scan(&project, &material, &surfaces) {
                Ok(scan) => scan,
                Err(error) => {
                    diagnostics.push(error.to_string());
                    cadence::rail::risk_diff::scan(None, &[], &surfaces)?
                }
            },
            None => cadence::rail::risk_diff::scan(None, &[], &surfaces)?,
        };
        Ok::<_, Error>(Observation {
            version: 1,
            request_id: request.request_id().into(),
            request_digest,
            scope,
            source,
            resolution,
            scan,
            diagnostics,
        })
    })
    .await
    .map_err(|_| Error::Closed)??;
    if session.config()? != config {
        return Ok(refused(
            "config-changed",
            "risk configuration changed during observation; retry",
        ));
    }
    let recorded = Recorded::new(
        observation,
        view.snapshot
            .generation
            .checked_add(1)
            .ok_or_else(|| Error::Invalid("generation overflow".into()))?,
    )?;
    let confirmed = session
        .request(Operation::RailObservation {
            expected_generation: view.snapshot.generation,
            expected_integrity: view.snapshot.integrity.clone(),
            record: Box::new(recorded.clone()),
        })
        .await?;
    let actual = risk::confirmed(
        &confirmed,
        &recorded.observation.scope,
        &recorded.observation.request_id,
    )?
    .filter(|actual| *actual == recorded)
    .ok_or_else(|| Error::Invalid("rail observation was not confirmed".into()))?;
    Ok(Envelope::Ok(actual))
}

pub fn refused(code: &str, reason: &str) -> Envelope<Recorded> {
    Envelope::Refused {
        code: code.into(),
        reason: reason.into(),
    }
}
