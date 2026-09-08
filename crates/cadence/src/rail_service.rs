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
        risk::{self, Apply, Observation, ObservationOutcome, Recorded, Scope},
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
    let mut scope = Scope {
        project: project.to_string_lossy().into_owned(),
        planning_root: root.to_string_lossy().into_owned(),
        cycle: "live".into(),
        occurrence: selection.occurrence.clone(),
        phase: selection.phase,
        worker: selection.worker.clone(),
        plan: None,
    };
    let material_source = if let risk::Source::Execution { plan, dispatch_id } = source {
        if selection
            .worker
            .as_deref()
            .is_some_and(|worker| worker != plan.to_string())
        {
            return Ok(refused(
                "invalid-scope",
                "execution worker must name the selected plan",
            ));
        }
        let material = match super::execution_service::risk_material(
            &view,
            &root,
            selection.phase.get(),
            &selection.occurrence,
            plan.get(),
            dispatch_id,
        ) {
            Ok(material) => material,
            Err(reason) => return Ok(refused("missing-execution-material", &reason)),
        };
        scope.plan = Some(*plan);
        scope.worker = Some(plan.to_string());
        risk::Source::Committed {
            base: material.base_id().into(),
            head: material.tip_id().into(),
        }
    } else {
        source.clone()
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
        let (resolution, mut diagnostics) = git::resolve(&project, &material_source);
        let material = resolution.material();
        let scan = if material
            .as_ref()
            .is_some_and(risk::MaterialIdentity::no_range)
        {
            None
        } else {
            Some(match material {
                Some(material) => match git::scan(&project, &material, &surfaces) {
                    Ok(scan) => scan,
                    Err(error) => {
                        diagnostics.push(error.to_string());
                        cadence::rail::risk_diff::scan(None, &[], &surfaces)?
                    }
                },
                None => cadence::rail::risk_diff::scan(None, &[], &surfaces)?,
            })
        };
        let outcome = match &scan {
            None => ObservationOutcome::NoRange,
            Some(scan) if scan.checked => ObservationOutcome::Checked,
            Some(_) => ObservationOutcome::Unchecked,
        };
        Ok::<_, Error>(Observation {
            version: 1,
            request_id: request.request_id().into(),
            request_digest,
            scope,
            source,
            resolution,
            outcome,
            surfaces,
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

pub fn refused<T>(code: &str, reason: &str) -> Envelope<T> {
    Envelope::Refused {
        code: code.into(),
        reason: reason.into(),
    }
}

use cadence::rail::receipts;
use cadence::store::writer::View;
use schemars::JsonSchema;
use serde::Serialize;

pub enum ReceiptCommand {
    Status(receipts::Query),
    Submit(receipts::Apply),
}

#[derive(Serialize, JsonSchema)]
#[serde(untagged)]
pub enum ReceiptOutput {
    Status(Box<receipts::Report>),
    Recorded(Box<receipts::RecordedFact>),
}
pub type ReceiptAnswer = Result<Envelope<ReceiptOutput>>;

/// The dispatch generation is the execution's native signoff/run fence. Explicit
/// observations have their own occurrence boundary and cannot settle execution.
pub fn receipt_boundary(
    view: &View,
    scope: Scope,
    source: &risk::Source,
) -> Result<receipts::Boundary> {
    let (run_id, after_generation) = match source {
        risk::Source::Execution { dispatch_id, .. } => {
            let generation = view.decisions.iter().filter_map(|record| match &record.decision {
                cadence::store::model::Decision::BoundaryV1(value)
                    if value.boundary.scope == (cadence::execution::boundary::BoundaryScope::Execution {phase:scope.phase.get()})
                        && matches!(&value.boundary.receipt, cadence::execution::boundary::Receipt::Dispatch { dispatch_id: id, .. } if id == dispatch_id)
                        && cadence::store::writer::confirmed_boundary(view, &value.boundary).is_ok() => Some(value.store_generation),
                _ => None,
            }).min().ok_or_else(|| Error::Invalid("risk boundary lacks native dispatch admission".into()))?;
            (dispatch_id.clone(), generation)
        }
        _ => (scope.occurrence.clone(), 0),
    };
    Ok(receipts::Boundary {
        scope,
        run_id,
        after_generation,
    })
}

pub async fn receipt<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    selected: &Path,
    command: ReceiptCommand,
) -> ReceiptAnswer {
    let root = reload::identity(selected)?;
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
    let view = session.derivation_view().await?;
    receipts::confirmed_history(&view)?;
    let project = root
        .parent()
        .ok_or_else(|| Error::Invalid("planning root lacks project".into()))?;
    let query = match &command {
        ReceiptCommand::Status(query) => query.clone(),
        ReceiptCommand::Submit(request) => {
            if risk::validate_name(request.request_id()).is_err() {
                return Ok(refused(
                    "invalid-arguments",
                    "invalid receipt request identity",
                ));
            }
            if let Some(old) = receipts::read(&view.snapshot.data)?.remove(&request.key()?) {
                return if old.fact == *request {
                    Ok(Envelope::Ok(ReceiptOutput::Recorded(Box::new(old))))
                } else {
                    Ok(refused(
                        "request-reused",
                        "receipt request identity records different content",
                    ))
                };
            }
            let binding = &request.fire().binding;
            let Some(record) = risk::read(&view.snapshot.data)?
                .into_values()
                .find(|r| binding.matches(r))
            else {
                return Ok(refused(
                    "unknown-observation",
                    "receipt does not bind an actual stored observation",
                ));
            };
            receipts::Query {
                scope: risk::ScopeSelection {
                    phase: record.observation.scope.phase,
                    occurrence: record.observation.scope.occurrence,
                    worker: record.observation.scope.worker,
                },
                source: record.observation.source,
                surfaces: Some(record.observation.surfaces),
            }
        }
    };
    if !root.join(format!("phases/{}", query.scope.phase)).is_dir()
        || risk::validate_name(&query.scope.occurrence).is_err()
        || query
            .scope
            .worker
            .as_deref()
            .is_some_and(|worker| risk::validate_name(worker).is_err())
    {
        return Ok(refused(
            "invalid-scope",
            "requested risk scope is unavailable or invalid",
        ));
    }
    let surfaces = match query.surfaces {
        Some(values) => risk::validate_surfaces(values).map(Some),
        None => merge::get(
            &config.effective.values,
            "review.triggers.risk_surface.surfaces",
        )
        .ok_or_else(|| Error::Policy("missing risk selection".into()))
        .and_then(risk::configured_surfaces),
    };
    let surfaces = match surfaces {
        Ok(Some(values)) => values,
        Ok(None) => {
            return Ok(refused(
                "unanswered-surfaces",
                "risk surface selection is unanswered",
            ));
        }
        Err(error) => return Ok(refused("invalid-surfaces", &error.to_string())),
    };
    let mut scope = Scope {
        project: project.to_string_lossy().into_owned(),
        planning_root: root.to_string_lossy().into_owned(),
        cycle: "live".into(),
        occurrence: query.scope.occurrence.clone(),
        phase: query.scope.phase,
        worker: query.scope.worker,
        plan: None,
    };
    let material = match &query.source {
        risk::Source::Execution { plan, dispatch_id } => {
            if scope
                .worker
                .as_deref()
                .is_some_and(|worker| worker != plan.to_string())
            {
                return Ok(refused(
                    "invalid-scope",
                    "execution worker must name the selected plan",
                ));
            }
            scope.plan = Some(*plan);
            scope.worker = Some(plan.to_string());
            match super::execution_service::risk_material(
                &view,
                &root,
                scope.phase.get(),
                &scope.occurrence,
                plan.get(),
                dispatch_id,
            ) {
                Ok(material) => material,
                Err(reason) => return Ok(refused("missing-execution-material", &reason)),
            }
        }
        source => {
            let (resolution, diagnostics) = git::resolve(project, source);
            match resolution.material() {
                Some(material) => material,
                None => return Ok(refused("unresolved-material", &diagnostics.join("; "))),
            }
        }
    };
    let boundary = match receipt_boundary(&view, scope, &query.source) {
        Ok(boundary) => boundary,
        Err(error) => return Ok(refused("invalid-boundary", &error.to_string())),
    };
    let requirement = receipts::Requirement {
        boundary,
        material,
        surfaces,
    };
    let assessment = receipts::assess(&requirement, &view.snapshot.data)?;
    let current_observation = risk::read(&view.snapshot.data)?
        .into_values()
        .find(|r| assessment.observation.as_ref() == Some(&r.confirmation));
    let review_scope = match git::changed_paths(project, &requirement.material) {
        Ok(paths) => match paths
            .into_iter()
            .map(|p| p.into_os_string().into_string())
            .collect::<std::result::Result<std::collections::BTreeSet<_>, _>>()
        {
            Ok(paths) => paths.into_iter().collect::<Vec<_>>(),
            Err(_) => {
                return Ok(refused(
                    "unreadable-scope",
                    "risk scope contains a non-UTF-8 path",
                ));
            }
        },
        Err(error) => return Ok(refused("unreadable-scope", &error.to_string())),
    };
    let ReceiptCommand::Submit(request) = command else {
        return Ok(Envelope::Ok(ReceiptOutput::Status(Box::new(
            receipts::Report {
                requirement,
                assessment,
                current_observation,
                review_scope,
            },
        ))));
    };
    let fire = match &request {
        receipts::Apply::Consequence { receipt, .. } => match &receipt.consequence {
            receipts::Consequence::Rearm { next_fire } => next_fire.as_ref(),
            _ => &receipt.fire,
        },
        receipts::Apply::Fire { fire, .. } => fire.as_ref(),
    };
    if fire.binding.boundary != requirement.boundary
        || fire.binding.material != requirement.material
        || fire.binding.surfaces != requirement.surfaces
        || current_observation
            .as_ref()
            .is_none_or(|r| !fire.binding.matches(r))
        || fire.review_scope != review_scope
    {
        return Ok(refused(
            "stale-receipt",
            "receipt scope, material or scan is not current",
        ));
    }
    if let receipts::Apply::Consequence { receipt, .. } = &request
        && let receipts::Consequence::Rearm { next_fire } = &receipt.consequence
    {
        // A re-arm selects an already recorded later observation. Verify the
        // narrowed immutable diff rather than accepting invented path coverage.
        let paths = git::changed_paths(project, &next_fire.binding.material)?;
        let paths = paths
            .iter()
            .map(|p| p.to_string_lossy().into_owned())
            .collect::<std::collections::BTreeSet<_>>();
        if paths.into_iter().collect::<Vec<_>>() != next_fire.review_scope {
            return Ok(refused(
                "invalid-rearm",
                "re-arm scope differs from its immutable diff",
            ));
        }
    }
    let recorded = receipts::RecordedFact::new(
        request,
        view.snapshot
            .generation
            .checked_add(1)
            .ok_or_else(|| Error::Invalid("generation overflow".into()))?,
    )?;
    if let Err(error) = receipts::project(&view.snapshot.data, &recorded) {
        return Ok(refused("invalid-receipt", &error.to_string()));
    }
    if session.config()? != config {
        return Ok(refused(
            "config-changed",
            "risk configuration changed; retry",
        ));
    }
    let confirmed = session
        .request(Operation::RailReceipt {
            expected_generation: view.snapshot.generation,
            expected_integrity: view.snapshot.integrity.clone(),
            record: Box::new(recorded.clone()),
        })
        .await?;
    receipts::confirmed_history(&confirmed)?;
    if receipts::read(&confirmed.snapshot.data)?.get(&recorded.fact.key()?) != Some(&recorded) {
        return Err(Error::Invalid(
            "receipt persistence was not confirmed".into(),
        ));
    }
    Ok(Envelope::Ok(ReceiptOutput::Recorded(Box::new(recorded))))
}
