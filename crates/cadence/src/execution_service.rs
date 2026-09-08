//! Native plan dispatch and executor-patch application.
//!
//! The resident calls these functions directly. They never send another
//! resident request, so the single owner cannot deadlock itself.
use super::derivation_service::{self, Driver};
use crate::{
    config::reload::ConfigIo,
    import::{Session, SessionFactory},
};
use cadence::{
    derivation::{Cycle, LifecycleStatus},
    evidence::Scope,
    execution::{
        dispatch::{admit_dispatch, build_routed_dispatch},
        model::{
            ActiveDispatch, BoundaryTool, ExecutionOccurrence, ExecutionPlan, ExecutionSnapshot,
            ExecutorPatch, PlanDisposition, TerminalOutcome,
        },
        patch::{ApplicationDisposition, apply_executor_patch, attach_commit_paths},
        plan::{PlanGraph, parse_plan, plan_set_fingerprint},
        render::SUMMARY_RENDER_VERSION,
    },
    next_action::continuation::Decision as ContinuationDecision,
    store::{
        Error,
        model::digest,
        writer::{
            BoundaryChange, Operation, View, confirmed_boundary, require_current_execution,
            terminal_v1,
        },
    },
};

use serde_json::{Value, json};
use std::{
    collections::{BTreeMap, BTreeSet},
    path::Path,
    process::Command,
    sync::Arc,
};

use cadence::envelope::Envelope;
pub use cadence::execution::boundary::{Answer, Failure, Response};
use cadence::execution::boundary::{
    BoundaryScope, BoundaryV1, ExecutionEnvelope, PreparedAnswer, Receipt,
};

#[derive(Clone)]
struct Plans {
    values: Vec<ExecutionPlan>,
    fingerprint: String,
}

pub fn continuation_scope(root: &Path, phase: u32) -> Scope {
    Scope {
        project: root.parent().unwrap_or(root).to_string_lossy().into_owned(),
        planning_root: root.to_string_lossy().into_owned(),
        cycle: "live".into(),
        occurrence: format!("phase-{phase}-execution"),
        phase: phase.to_string(),
        plan: "native-execution".into(),
        report: format!("phases/{phase}/SUMMARY.md"),
    }
}

pub async fn query<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    selected_root: &Path,
    phase: u32,
    driver: &Driver,
) -> Answer {
    let raw_request = public_request_digest(
        BoundaryTool::CadenceQuery,
        Some(&json!({"operation":"execute-next","phase":phase})),
    );
    let (root, session, initial) = begin(factory, selected_root).await?;
    if let Some(answer) = terminal_answer(&session, &initial, &scope(phase)).await? {
        return Ok(answer);
    }
    if phase == 0 {
        return record_refusal(
            &session,
            &initial,
            phase,
            BoundaryTool::CadenceQuery,
            "execute-next",
            &raw_request,
            "invalid-phase",
            "phase must be a positive integer",
            None,
        )
        .await;
    }
    let (checked, mut view) = match checked_execution(&session, &root, driver).await {
        Ok(value) => value,
        Err(error) => {
            return derivation_refusal(
                &session,
                phase,
                BoundaryTool::CadenceQuery,
                &raw_request,
                error,
            )
            .await;
        }
    };
    let lifecycle = checked.answer();
    if lifecycle.cycle != Cycle::Live {
        return record_refusal(
            &session,
            &view,
            phase,
            BoundaryTool::CadenceQuery,
            "query-next",
            &raw_request,
            "closed-cycle",
            "execution requires the live planning cycle",
            None,
        )
        .await;
    }
    let phase_record = match lifecycle
        .phases
        .iter()
        .find(|record| record.id.number() == f64::from(phase))
    {
        Some(record) => record.clone(),
        None => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                "unknown-phase",
                "the lifecycle does not contain the requested phase",
                None,
            )
            .await;
        }
    };
    if lifecycle
        .current
        .is_none_or(|current| current.number() != f64::from(phase))
    {
        return record_refusal(
            &session,
            &view,
            phase,
            BoundaryTool::CadenceQuery,
            "query-next",
            &raw_request,
            "phase-not-current",
            "the requested phase is not the derived current phase",
            None,
        )
        .await;
    }
    if !matches!(
        phase_record.status,
        LifecycleStatus::Planned | LifecycleStatus::Executed
    ) {
        return record_refusal(
            &session,
            &view,
            phase,
            BoundaryTool::CadenceQuery,
            "query-next",
            &raw_request,
            "lifecycle-refusal",
            format!("phase status {:?} cannot execute", phase_record.status),
            None,
        )
        .await;
    }
    let plans = match observe_plans(&root, phase, &phase_record.plans).await {
        Ok(plans) => plans,
        Err((code, reason)) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                code,
                reason,
                None,
            )
            .await;
        }
    };
    let execution = match execution_snapshot(&view) {
        Ok(value) => value,
        Err(error) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                "invalid-execution-store",
                error,
                None,
            )
            .await;
        }
    };
    let occurrence = execution.occurrences.get(&phase.to_string()).cloned();
    if let Some(occurrence) = &occurrence {
        if occurrence.plan_set_fingerprint != plans.fingerprint {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                "plan-set-changed",
                "native plan inputs differ from the admitted execution occurrence",
                occurrence.active.as_ref().map(|active| active.id.clone()),
            )
            .await;
        }
        if let Err(reason) = execution_risk(&session, &view, &root, phase) {
            return record_observation(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "execute-next",
                &raw_request,
                refused(phase, "risk-pending", reason),
                None,
            )
            .await;
        }
        if let Some(terminal) = &occurrence.terminal {
            let response = terminal_response(phase, terminal);
            return record_observation(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                response,
                occurrence.active.as_ref().map(|active| active.id.clone()),
            )
            .await;
        }
        if let Some(active) = &occurrence.active {
            let Some(plan) = plans.values.iter().find(|plan| plan.plan == active.plan) else {
                return record_refusal(
                    &session,
                    &view,
                    phase,
                    BoundaryTool::CadenceQuery,
                    "query-next",
                    &raw_request,
                    "active-plan-missing",
                    "the active dispatch plan is no longer admitted",
                    Some(active.id.clone()),
                )
                .await;
            };
            if active.plan_fingerprint != plan.fingerprint {
                return record_refusal(
                    &session,
                    &view,
                    phase,
                    BoundaryTool::CadenceQuery,
                    "query-next",
                    &raw_request,
                    "plan-changed",
                    "the active plan bytes differ from the admitted fingerprint",
                    Some(active.id.clone()),
                )
                .await;
            }
            let project = match root.parent() {
                Some(project) => project,
                None => {
                    return record_refusal(
                        &session,
                        &view,
                        phase,
                        BoundaryTool::CadenceQuery,
                        "query-next",
                        &raw_request,
                        "invalid-project-root",
                        "planning root has no project parent",
                        Some(active.id.clone()),
                    )
                    .await;
                }
            };
            let head = match git_head(project).await {
                Ok(head) => head,
                Err(reason) => {
                    return record_refusal(
                        &session,
                        &view,
                        phase,
                        BoundaryTool::CadenceQuery,
                        "query-next",
                        &raw_request,
                        "git-head",
                        reason,
                        Some(active.id.clone()),
                    )
                    .await;
                }
            };
            let response = dispatch_response(active, plan);
            if let Err(reason) = reobserve(
                &session,
                &view,
                &root,
                phase,
                &phase_record.plans,
                &plans,
                Some(&head),
            )
            .await
            {
                return record_refusal(
                    &session,
                    &view,
                    phase,
                    BoundaryTool::CadenceQuery,
                    "query-next",
                    &raw_request,
                    "inputs-changed",
                    reason,
                    Some(active.id.clone()),
                )
                .await;
            }
            let Response::Dispatch { .. } = &response else {
                return record_observation(
                    &session,
                    &view,
                    phase,
                    BoundaryTool::CadenceQuery,
                    "query-next",
                    &raw_request,
                    response,
                    Some(active.id.clone()),
                )
                .await;
            };
            if active.expected_execution_version != occurrence.version || occurrence.version == 0 {
                return record_refusal(
                    &session,
                    &view,
                    phase,
                    BoundaryTool::CadenceQuery,
                    "query-next",
                    &raw_request,
                    "invalid-active-dispatch",
                    "active dispatch execution version is inconsistent",
                    Some(active.id.clone()),
                )
                .await;
            }
            let decision = boundary(
                phase,
                BoundaryTool::CadenceQuery,
                "execute-next",
                &raw_request,
                &response,
                Some(active.id.clone()),
                Some(active.prompt_bytes),
            )?;
            let confirmed = confirmed_boundary(&view, &decision)?;
            return confirmed.envelope(Some(response.into_envelope()));
        }
    }

    let continuation = match checked_continuation(&session, &view, &checked, phase, driver).await {
        Ok(value) => value,
        Err(error) => {
            view = match session.derivation_view().await {
                Ok(latest) => latest,
                Err(store) => return store_refusal(phase, store),
            };
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                error.code(),
                format!("{error:?}"),
                None,
            )
            .await;
        }
    };
    if !matches!(continuation.decision, ContinuationDecision::Continue { .. }) {
        view = match session.derivation_view().await {
            Ok(latest) => latest,
            Err(error) => return store_refusal(phase, error),
        };
        return record_refusal(
            &session,
            &view,
            phase,
            BoundaryTool::CadenceQuery,
            "query-next",
            &raw_request,
            "continuation-refusal",
            format!(
                "continuation authority returned {:?}",
                continuation.decision
            ),
            None,
        )
        .await;
    }
    view = match session.derivation_view().await {
        Ok(latest) => latest,
        Err(error) => return store_refusal(phase, error),
    };
    let execution = match execution_snapshot(&view) {
        Ok(value) => value,
        Err(error) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                "invalid-execution-store",
                error,
                None,
            )
            .await;
        }
    };
    let occurrence = execution
        .occurrences
        .get(&phase.to_string())
        .cloned()
        .unwrap_or_else(|| ExecutionOccurrence {
            phase,
            plan_set_fingerprint: plans.fingerprint.clone(),
            version: 0,
            active: None,
            plans: Vec::new(),
            terminal: None,
            receipts: BTreeMap::new(),
        });
    if occurrence.plan_set_fingerprint != plans.fingerprint {
        return record_refusal(
            &session,
            &view,
            phase,
            BoundaryTool::CadenceQuery,
            "query-next",
            &raw_request,
            "plan-set-changed",
            "native plan inputs differ from the admitted execution occurrence",
            None,
        )
        .await;
    }
    let risk_config = session.config().map_err(store_failure)?;
    let requirements =
        match super::rail_service::execution_requirements(&view, &root, phase, &risk_config) {
            Ok(requirements) => requirements,
            Err(reason) => {
                return record_observation(
                    &session,
                    &view,
                    phase,
                    BoundaryTool::CadenceQuery,
                    "execute-next",
                    &raw_request,
                    refused(phase, "risk-pending", reason),
                    None,
                )
                .await;
            }
        };
    let graph = match PlanGraph::build(&plans.values) {
        Ok(graph) => graph,
        Err(error) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                error.code,
                error.detail,
                None,
            )
            .await;
        }
    };
    let completed = occurrence
        .plans
        .iter()
        .filter(|outcome| outcome.disposition == PlanDisposition::Complete)
        .map(|outcome| outcome.plan)
        .collect::<BTreeSet<_>>();
    let Some(next) = graph.next_ready(&completed) else {
        if let Err(reason) = reobserve(
            &session,
            &view,
            &root,
            phase,
            &phase_record.plans,
            &plans,
            None,
        )
        .await
        {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "execute-next",
                &raw_request,
                "inputs-changed",
                reason,
                None,
            )
            .await;
        }
        if session.config().map_err(store_failure)? != risk_config {
            return Err(Failure::Store);
        }
        let response = Response::Complete { phase };
        let decision = boundary(
            phase,
            BoundaryTool::CadenceQuery,
            "execute-next",
            &raw_request,
            &response,
            None,
            None,
        )?;
        let written = session
            .request(Operation::BoundaryV1 {
                expected_generation: view.snapshot.generation,
                expected_integrity: view.snapshot.integrity.clone(),
                operation_id: format!("execution-finalize:{}", decision.identity()?),
                decision: decision.clone(),
                change: Box::new(BoundaryChange::FinalizeRisk {
                    phase,
                    requirements,
                }),
            })
            .await
            .map_err(store_failure)?;
        return confirmed_boundary(&written, &decision)?.envelope(None);
    };
    let plan = plans
        .values
        .iter()
        .find(|plan| plan.plan == next)
        .expect("graph plan came from observed set");
    let project = match root.parent() {
        Some(project) => project.to_path_buf(),
        None => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                "invalid-project-root",
                "planning root has no project parent",
                None,
            )
            .await;
        }
    };
    let base_sha = match git_head(&project).await {
        Ok(sha) => sha,
        Err(reason) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                "git-head",
                reason,
                None,
            )
            .await;
        }
    };
    let config = session.config().map_err(store_failure)?;
    let choice = match super::config_service::route_at(
        &config,
        &super::config_service::RouteRequest {
            role: "cad-executor".into(),
            phase: std::num::NonZeroU32::new(phase),
            plan: std::num::NonZeroU32::new(plan.plan),
            attempt: None,
        },
        &root,
    ) {
        Ok(route) => route.choice,
        Err(error) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                "route-unavailable",
                error.to_string(),
                None,
            )
            .await;
        }
    };
    let route = cadence::execution::model::DispatchRoute {
        choice,
        inputs: super::config_service::routing_inputs(&config),
    };
    let mut candidate = match build_routed_dispatch(
        plan,
        &plans.fingerprint,
        occurrence.version,
        &base_sha,
        1,
        route,
    ) {
        Ok(value) => value,
        Err(error) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                error.code,
                error.detail,
                None,
            )
            .await;
        }
    };
    let (_, provisional) = match admit_dispatch(&occurrence, candidate.clone()) {
        Ok(value) => value,
        Err(error) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                error.code,
                error.detail,
                Some(candidate.id),
            )
            .await;
        }
    };
    let prompt = render_prompt(&provisional);
    candidate.prompt_bytes = prompt.len() as u64;
    let (_, dispatch) = admit_dispatch(&occurrence, candidate.clone())
        .expect("prompt byte count does not alter dispatch admission");
    let response = Response::Dispatch {
        dispatch: Box::new(dispatch.clone()),
        prompt,
    };

    #[cfg(test)]
    {
        let event = driver.event.clone();
        if tokio::task::spawn_blocking(move || event(derivation_service::Event::RoutingObserved))
            .await
            .is_err()
        {
            return store_refusal(phase, Error::Closed);
        }
    }
    if let Err(reason) = reobserve(
        &session,
        &view,
        &root,
        phase,
        &phase_record.plans,
        &plans,
        Some(&base_sha),
    )
    .await
    {
        return record_refusal(
            &session,
            &view,
            phase,
            BoundaryTool::CadenceQuery,
            "query-next",
            &raw_request,
            "inputs-changed",
            reason,
            Some(dispatch.id),
        )
        .await;
    }
    let decision = boundary(
        phase,
        BoundaryTool::CadenceQuery,
        "execute-next",
        &raw_request,
        &response,
        Some(dispatch.id.clone()),
        Some(dispatch.prompt_bytes),
    )?;
    let written = session
        .request(Operation::BoundaryV1 {
            expected_generation: view.snapshot.generation,
            expected_integrity: view.snapshot.integrity.clone(),
            operation_id: format!("execution-dispatch:{}", dispatch.id),
            decision: decision.clone(),
            change: Box::new(BoundaryChange::Dispatch {
                plan_set_fingerprint: plans.fingerprint,
                dispatch: candidate,
            }),
        })
        .await
        .map_err(store_failure)?;
    confirmed_boundary(&written, &decision)?.envelope(Some(response.into_envelope()))
}

pub async fn apply<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    selected_root: &Path,
    patch: ExecutorPatch,
    driver: &Driver,
) -> Answer {
    let raw = serde_json::to_value(&patch).map_err(|_| Failure::Encoding)?;
    let request = public_request_digest(BoundaryTool::CadenceApply, Some(&raw));
    let (root, session, initial) = begin(factory, selected_root).await?;
    let phase = dispatch_phase(&initial, &patch.dispatch_id)?.unwrap_or(0);
    if let Some(answer) = terminal_answer(&session, &initial, &scope(phase)).await? {
        return Ok(answer);
    }
    if phase == 0 {
        return record_refusal(
            &session,
            &initial,
            0,
            BoundaryTool::CadenceApply,
            "executor",
            &request,
            "foreign-dispatch",
            "the patch does not identify a dispatch in this store",
            None,
        )
        .await;
    }
    let (checked, view) = match checked_execution(&session, &root, driver).await {
        Ok(value) => value,
        Err(error) => {
            return derivation_refusal(
                &session,
                phase,
                BoundaryTool::CadenceApply,
                &request,
                error,
            )
            .await;
        }
    };
    let Some(phase_record) = checked
        .answer()
        .phases
        .iter()
        .find(|record| record.id.number() == f64::from(phase))
        .cloned()
    else {
        return record_refusal(
            &session,
            &view,
            phase,
            BoundaryTool::CadenceApply,
            "apply-executor-patch",
            &request,
            "unknown-phase",
            "the lifecycle does not contain the requested phase",
            Some(patch.dispatch_id.clone()),
        )
        .await;
    };
    let plans = match observe_plans(&root, phase, &phase_record.plans).await {
        Ok(plans) => plans,
        Err((code, reason)) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceApply,
                "apply-executor-patch",
                &request,
                code,
                reason,
                Some(patch.dispatch_id.clone()),
            )
            .await;
        }
    };
    let execution = match execution_snapshot(&view) {
        Ok(value) => value,
        Err(error) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceApply,
                "apply-executor-patch",
                &request,
                "invalid-execution-store",
                error,
                Some(patch.dispatch_id.clone()),
            )
            .await;
        }
    };
    let Some(occurrence) = execution.occurrences.get(&phase.to_string()) else {
        return record_refusal(
            &session,
            &view,
            phase,
            BoundaryTool::CadenceApply,
            "apply-executor-patch",
            &request,
            "missing-execution",
            "the phase has no execution occurrence",
            Some(patch.dispatch_id.clone()),
        )
        .await;
    };
    if occurrence.plan_set_fingerprint != plans.fingerprint {
        return record_refusal(
            &session,
            &view,
            phase,
            BoundaryTool::CadenceApply,
            "apply-executor-patch",
            &request,
            "plan-set-changed",
            "native plan inputs differ from the admitted execution occurrence",
            Some(patch.dispatch_id.clone()),
        )
        .await;
    }
    let application = match apply_executor_patch(&view.snapshot.data, &patch) {
        Ok(value) => value,
        Err(error) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceApply,
                "apply-executor-patch",
                &request,
                error.code,
                error.detail,
                Some(patch.dispatch_id.clone()),
            )
            .await;
        }
    };
    if application.disposition == ApplicationDisposition::Replay {
        let prior = view
            .decisions
            .iter()
            .find_map(|record| match &record.decision {
                cadence::store::model::Decision::BoundaryV1(value)
                    if value.boundary.scope == scope(phase)
                        && value.boundary.tool == BoundaryTool::CadenceApply
                        && value.boundary.request_digest == request
                        && value.boundary.subject_id.as_ref() == Some(&patch.dispatch_id)
                        && (matches!(value.boundary.receipt, Receipt::Compact { envelope: Envelope::Ok(_) })
                            || matches!(&value.boundary.receipt, Receipt::Compact { envelope: Envelope::Refused { code, .. } } if code == "risk-pending")) =>
                {
                    Some(&value.boundary)
                }
                _ => None,
            })
            .ok_or(Failure::Confirmation)?;
        if matches!(
            prior.receipt,
            Receipt::Compact {
                envelope: Envelope::Ok(_)
            }
        ) && let Err(reason) = execution_risk(&session, &view, &root, phase)
        {
            return record_observation(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceApply,
                "executor",
                &request,
                refused(phase, "risk-pending", reason),
                Some(patch.dispatch_id.clone()),
            )
            .await;
        }
        if let Err(reason) = reobserve(
            &session,
            &view,
            &root,
            phase,
            &phase_record.plans,
            &plans,
            None,
        )
        .await
        {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceApply,
                "executor",
                &request,
                "inputs-changed",
                reason,
                Some(patch.dispatch_id.clone()),
            )
            .await;
        }
        return confirmed_boundary(&view, prior)?.envelope(None);
    }
    if application.disposition == ApplicationDisposition::Applied
        && (checked.answer().cycle != Cycle::Live
            || checked
                .answer()
                .current
                .is_none_or(|current| current.number() != f64::from(phase))
            || !matches!(
                phase_record.status,
                LifecycleStatus::Planned | LifecycleStatus::Executed
            ))
    {
        return record_refusal(
            &session,
            &view,
            phase,
            BoundaryTool::CadenceApply,
            "apply-executor-patch",
            &request,
            "lifecycle-refusal",
            "the active phase no longer has executable lifecycle authority",
            Some(patch.dispatch_id.clone()),
        )
        .await;
    }
    let (commit_paths, base_sha) = {
        let Some(active) = occurrence.active.as_ref() else {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceApply,
                "apply-executor-patch",
                &request,
                "foreign-dispatch",
                "the patch does not name the active dispatch",
                Some(patch.dispatch_id.clone()),
            )
            .await;
        };
        let Some(plan) = plans.values.iter().find(|plan| plan.plan == active.plan) else {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceApply,
                "apply-executor-patch",
                &request,
                "active-plan-missing",
                "the active dispatch plan is no longer admitted",
                Some(patch.dispatch_id.clone()),
            )
            .await;
        };
        if active.plan_fingerprint != plan.fingerprint {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceApply,
                "apply-executor-patch",
                &request,
                "plan-changed",
                "the active plan bytes differ from the admitted fingerprint",
                Some(patch.dispatch_id.clone()),
            )
            .await;
        }
        let project = match root.parent() {
            Some(project) => project.to_path_buf(),
            None => {
                return record_refusal(
                    &session,
                    &view,
                    phase,
                    BoundaryTool::CadenceApply,
                    "executor",
                    &request,
                    "invalid-project-root",
                    "planning root has no parent",
                    Some(patch.dispatch_id.clone()),
                )
                .await;
            }
        };
        let head = match git_head(&project).await {
            Ok(head) => head,
            Err(reason) => {
                return record_refusal(
                    &session,
                    &view,
                    phase,
                    BoundaryTool::CadenceApply,
                    "apply-executor-patch",
                    &request,
                    "git-head",
                    reason,
                    Some(patch.dispatch_id.clone()),
                )
                .await;
            }
        };
        let paths = match validate_commits(&project, active, &patch, &head).await {
            Ok(paths) => paths,
            Err((code, reason)) => {
                return record_refusal(
                    &session,
                    &view,
                    phase,
                    BoundaryTool::CadenceApply,
                    "apply-executor-patch",
                    &request,
                    code,
                    reason,
                    Some(patch.dispatch_id.clone()),
                )
                .await;
            }
        };
        (paths, head)
    };
    let project = root.parent().ok_or(Failure::Encoding)?;
    let staged = match observe_staged(project).await {
        Ok(value) => value,
        Err(reason) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceApply,
                "executor",
                &request,
                "staged-paths",
                reason,
                Some(patch.dispatch_id.clone()),
            )
            .await;
        }
    };
    let application = match attach_commit_paths(application, &commit_paths, &staged.paths) {
        Ok(value) => value,
        Err(error) => {
            if let Some(paths) = error.undeclared {
                return record_lease_refusal(&session, &view, &request, *paths).await;
            }
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceApply,
                "apply-executor-patch",
                &request,
                error.code,
                error.detail,
                Some(patch.dispatch_id.clone()),
            )
            .await;
        }
    };
    if application.disposition == ApplicationDisposition::Applied
        && let Err(reason) = reobserve(
            &session,
            &view,
            &root,
            phase,
            &phase_record.plans,
            &plans,
            Some(&base_sha),
        )
        .await
    {
        return record_refusal(
            &session,
            &view,
            phase,
            BoundaryTool::CadenceApply,
            "apply-executor-patch",
            &request,
            "inputs-changed",
            reason,
            Some(patch.dispatch_id.clone()),
        )
        .await;
    }
    if let Err(reason) = reobserve_staged(project, &staged).await {
        return record_refusal(
            &session,
            &view,
            phase,
            BoundaryTool::CadenceApply,
            "executor",
            &request,
            "inputs-changed",
            reason,
            Some(patch.dispatch_id.clone()),
        )
        .await;
    }
    let next_execution = match application
        .data
        .get("execution")
        .ok_or_else(|| "snapshot has no execution namespace".to_owned())
        .and_then(execution_value)
    {
        Ok(value) => value,
        Err(error) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceApply,
                "executor",
                &request,
                "invalid-execution-store",
                error,
                Some(patch.dispatch_id.clone()),
            )
            .await;
        }
    };
    let next_occurrence = &next_execution.occurrences[&phase.to_string()];
    let response = if application.outcome.disposition == PlanDisposition::Blocked {
        terminal_response(
            phase,
            next_occurrence
                .terminal
                .as_ref()
                .expect("blocked patch installs a terminal outcome"),
        )
    } else {
        // The accepted dispatch basis becomes available atomically with this patch.
        // No prior execution scan can cover material which has not been accepted.
        refused(
            phase,
            "risk-pending",
            format!(
                "Task evidence accepted for phase-{phase}-execution, plan {}, dispatch {}; continuation refused: risk evidence is Missing. Record an exact execution risk-check and any required fire/consequence, then invoke execute-next again. No terminal completion was installed; tasks must not be rerun.",
                application.outcome.plan, patch.dispatch_id
            ),
        )
    };
    let answer = PreparedAnswer::new(response.into_envelope())?;
    let decision = BoundaryV1::new(
        scope(phase),
        BoundaryTool::CadenceApply,
        "executor".into(),
        request,
        Some(patch.dispatch_id.clone()),
        &answer,
    );
    let complete_phase = matches!(
        answer.envelope,
        Envelope::Ok(cadence::execution::boundary::Success::Complete { .. })
    );
    let (operation_id, change) = if answer.too_large() {
        (
            format!("execution-observation:{}", decision.identity()?),
            BoundaryChange::Observe,
        )
    } else {
        (
            format!("execution-patch:{}", patch.dispatch_id),
            BoundaryChange::Patch {
                patch,
                commit_paths,
                staged_paths: staged.paths,
                render_version: SUMMARY_RENDER_VERSION,
                complete_phase,
            },
        )
    };
    let written = session
        .request(Operation::BoundaryV1 {
            expected_generation: view.snapshot.generation,
            expected_integrity: view.snapshot.integrity.clone(),
            operation_id,
            decision: decision.clone(),
            change: Box::new(change),
        })
        .await
        .map_err(store_failure)?;
    confirmed_boundary(&written, &decision)?.envelope(None)
}

fn execution_risk<I: ConfigIo>(
    session: &Session<I>,
    view: &View,
    root: &Path,
    phase: u32,
) -> Result<Vec<cadence::rail::receipts::Requirement>, String> {
    let config = session.config().map_err(|e| e.to_string())?;
    super::rail_service::execution_requirements(view, root, phase, &config)
}

fn execution_snapshot(view: &View) -> Result<ExecutionSnapshot, String> {
    match view.snapshot.data.get("execution") {
        Some(value) => execution_value(value),
        None => Ok(ExecutionSnapshot::default()),
    }
}

fn execution_value(value: &Value) -> Result<ExecutionSnapshot, String> {
    let execution: ExecutionSnapshot = serde_json::from_value(value.clone())
        .map_err(|error| format!("invalid execution namespace: {error}"))?;
    if execution.schema != cadence::execution::model::EXECUTION_SCHEMA {
        return Err(format!("unsupported execution schema {}", execution.schema));
    }
    Ok(execution)
}

fn terminal_response(phase: u32, terminal: &TerminalOutcome) -> Response {
    match terminal {
        TerminalOutcome::Complete { phase } => Response::Complete { phase: *phase },
        TerminalOutcome::JudgmentStop {
            dispatch_id,
            blocker_ids,
        } => Response::JudgmentStop {
            phase,
            dispatch_id: dispatch_id.clone(),
            blocker_ids: blocker_ids.clone(),
        },
    }
}

fn dispatch_response(active: &ActiveDispatch, plan: &ExecutionPlan) -> Response {
    let mut dispatch = active.clone();
    dispatch.body = plan.body.clone();
    let mut prompt = render_prompt(&dispatch);
    if prompt.len() as u64 != dispatch.prompt_bytes {
        // Outstanding dispatches retain the exact known historical renderer.
        // The existing confirmed boundary also verifies its public answer digest.
        prompt = render_prompt_version(&dispatch, false);
    }
    if prompt.len() as u64 != dispatch.prompt_bytes {
        return refused(
            dispatch.phase,
            "prompt-mismatch",
            "the reconstructed prompt byte count differs from the admitted dispatch",
        );
    }
    Response::Dispatch {
        dispatch: Box::new(dispatch),
        prompt,
    }
}

fn render_prompt(dispatch: &ActiveDispatch) -> String {
    render_prompt_version(dispatch, true)
}

fn render_prompt_version(dispatch: &ActiveDispatch, lease_instructions: bool) -> String {
    cadence::execution::render::render_dispatch_prompt(
        dispatch,
        &patch_schema(),
        lease_instructions,
    )
}

pub use cadence::execution::model::patch_schema;

async fn observe_plans(
    root: &Path,
    phase: u32,
    names: &[String],
) -> Result<Plans, (&'static str, String)> {
    let root = root.to_path_buf();
    let names = names.to_vec();
    tokio::task::spawn_blocking(move || {
        if names.is_empty() {
            return Err(("empty-plan-set", "the phase admits no native plans".into()));
        }
        let phase_root = root.join(format!("phases/{phase}"));
        let mut listed = std::fs::read_dir(&phase_root)
            .map_err(|error| ("plan-read", format!("{}: {error}", phase_root.display())))?
            .map(|entry| {
                entry
                    .map(|entry| entry.file_name().to_string_lossy().into_owned())
                    .map_err(|error| ("plan-read", error.to_string()))
            })
            .collect::<Result<Vec<_>, _>>()?;
        listed.retain(|name| admitted_plan_name(name));
        listed.sort();
        let mut expected = names.clone();
        expected.sort();
        if listed != expected {
            return Err((
                "plan-set-changed",
                "the real phase-directory plan names differ from checked derivation".into(),
            ));
        }
        let mut values = Vec::with_capacity(names.len());
        let mut numbers = BTreeSet::new();
        for name in names {
            let Some(number) = plan_number(&name) else {
                return Err((
                    "invalid-plan-name",
                    format!("native plan name is not PLAN-N.md: {name}"),
                ));
            };
            if !numbers.insert(number) {
                return Err((
                    "duplicate-plan",
                    format!("plan number {number} is duplicated"),
                ));
            }
            let path = root.join(format!("phases/{phase}/{name}"));
            let bytes = std::fs::read(&path)
                .map_err(|error| ("plan-read", format!("{}: {error}", path.display())))?;
            values.push(
                parse_plan(&bytes, phase, number).map_err(|error| (error.code, error.detail))?,
            );
        }
        values.sort_by_key(|plan| plan.plan);
        let fingerprint =
            plan_set_fingerprint(&values).map_err(|error| (error.code, error.detail))?;
        Ok(Plans {
            values,
            fingerprint,
        })
    })
    .await
    .map_err(|_| ("plan-read", "plan observation task closed".into()))?
}

fn plan_number(name: &str) -> Option<u32> {
    let number = name.strip_prefix("PLAN-")?.strip_suffix(".md")?;
    if number.is_empty()
        || number.starts_with('0')
        || !number.bytes().all(|byte| byte.is_ascii_digit())
    {
        return None;
    }
    number.parse().ok().filter(|number| *number > 0)
}

fn admitted_plan_name(name: &str) -> bool {
    name == "PLAN.md"
        || name
            .strip_prefix("PLAN-")
            .and_then(|number| number.strip_suffix(".md"))
            .is_some_and(|number| {
                !number.is_empty() && number.bytes().all(|byte| byte.is_ascii_digit())
            })
}

async fn reobserve<I: ConfigIo>(
    session: &Session<I>,
    expected: &View,
    root: &Path,
    phase: u32,
    names: &[String],
    plans: &Plans,
    expected_head: Option<&str>,
) -> Result<(), String> {
    let latest_plans = observe_plans(root, phase, names)
        .await
        .map_err(|(code, reason)| format!("{code}: {reason}"))?;
    if latest_plans.fingerprint != plans.fingerprint || latest_plans.values != plans.values {
        return Err("native plan bytes changed during the request".into());
    }
    if let Some(expected_head) = expected_head {
        let project = root
            .parent()
            .ok_or_else(|| "planning root has no parent".to_owned())?;
        if git_head(project).await? != expected_head {
            return Err("Git HEAD changed during the request".into());
        }
    }
    let latest = session
        .derivation_view()
        .await
        .map_err(|error| error.to_string())?;
    if latest.snapshot.generation != expected.snapshot.generation
        || latest.snapshot.integrity != expected.snapshot.integrity
    {
        return Err("effective store generation changed during the request".into());
    }
    Ok(())
}

async fn git_head(project: &Path) -> Result<String, String> {
    let project = project.to_path_buf();
    tokio::task::spawn_blocking(move || {
        let output = git_output(&project, &["rev-parse", "--verify", "HEAD"])?;
        let sha = output.trim().to_owned();
        if sha.len() != 40 || !sha.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err("Git HEAD is not a full commit SHA".into());
        }
        Ok(sha)
    })
    .await
    .map_err(|_| "Git observation task closed".to_owned())?
}

async fn validate_commits(
    project: &Path,
    active: &ActiveDispatch,
    patch: &ExecutorPatch,
    head: &str,
) -> Result<BTreeMap<String, Vec<String>>, (&'static str, String)> {
    let project = project.to_path_buf();
    let active = active.clone();
    let patch = patch.clone();
    let head = head.to_owned();
    tokio::task::spawn_blocking(move || validate_commits_blocking(&project, &active, &patch, &head))
        .await
        .map_err(|_| ("git-validation", "Git validation task closed".into()))?
}

fn validate_commits_blocking(
    project: &Path,
    active: &ActiveDispatch,
    patch: &ExecutorPatch,
    head: &str,
) -> Result<BTreeMap<String, Vec<String>>, (&'static str, String)> {
    let completed = patch.tasks.iter().filter_map(|task| match task {
        cadence::execution::model::TaskOutcome::Completed {
            task_id, commit, ..
        } => Some((task_id, commit)),
        cadence::execution::model::TaskOutcome::Blocked { .. }
        | cadence::execution::model::TaskOutcome::NotRun { .. } => None,
    });
    let mut prior = active.base_sha.as_str();
    let mut seen = BTreeSet::new();
    let mut paths = BTreeMap::new();
    for (task_id, commit) in completed {
        if !seen.insert(commit.clone()) {
            return Err((
                "reused-commit",
                "one commit cannot complete two tasks".into(),
            ));
        }
        git_success(
            project,
            &["cat-file", "-e", &format!("{commit}^{{commit}}")],
        )
        .map_err(|reason| ("missing-commit", reason))?;
        if commit == prior
            || !git_status(project, &["merge-base", "--is-ancestor", prior, commit])
                .map_err(|reason| ("git-order", reason))?
        {
            return Err((
                "git-order",
                format!("commit {commit} is not strictly after {prior}"),
            ));
        }
        if !git_status(project, &["merge-base", "--is-ancestor", commit, head])
            .map_err(|reason| ("git-order", reason))?
        {
            return Err((
                "git-order",
                format!("commit {commit} is not an ancestor of current HEAD"),
            ));
        }
        git_success(project, &["verify-commit", commit])
            .map_err(|reason| ("bad-signature", reason))?;
        let subject = git_output(project, &["show", "-s", "--format=%s", commit])
            .map_err(|reason| ("commit-subject", reason))?;
        if !conventional_subject(subject.trim(), task_id) {
            return Err((
                "commit-subject",
                format!("commit {commit} subject is not conventional or does not name {task_id}"),
            ));
        }
        // Compare every parent explicitly. A combined merge diff omits paths
        // changed against only one parent and is insufficient lease evidence.
        let parents = git_output(project, &["show", "-s", "--format=%P", commit])
            .map_err(|reason| ("commit-paths", reason))?;
        let parents = parents.split_whitespace().collect::<Vec<_>>();
        let mut observed = BTreeSet::new();
        for parent in parents
            .iter()
            .copied()
            .map(Some)
            .chain(parents.is_empty().then_some(None))
        {
            let mut args = vec![
                "diff-tree",
                "--root",
                "--no-commit-id",
                "--name-status",
                "-r",
                "-z",
                "-M",
                "--no-ext-diff",
                "--no-textconv",
            ];
            if let Some(parent) = parent {
                args.push(parent);
            }
            args.extend([commit, "--"]);
            let output =
                git_output_bytes(project, &args).map_err(|reason| ("commit-paths", reason))?;
            observed.extend(read_name_status(&output).map_err(|reason| ("commit-paths", reason))?);
        }
        paths.insert(commit.clone(), observed.into_iter().collect());
        prior = commit;
    }
    Ok(paths)
}

/// Read Git's unquoted NUL records without normalizing or losing pathname bytes.
pub(super) fn read_name_status(bytes: &[u8]) -> Result<Vec<String>, String> {
    if bytes.is_empty() {
        return Ok(Vec::new());
    }
    if bytes.last() != Some(&0) {
        return Err("unterminated Git name-status record".into());
    }
    let mut fields = bytes[..bytes.len() - 1].split(|byte| *byte == 0);
    let mut paths = BTreeSet::new();
    while let Some(status) = fields.next() {
        let status = std::str::from_utf8(status).map_err(|_| "invalid Git status")?;
        let endpoints = match status.as_bytes() {
            [b'A' | b'D' | b'M' | b'T'] => 1,
            [b'R' | b'C', score @ ..]
                if !score.is_empty()
                    && score.iter().all(u8::is_ascii_digit)
                    && std::str::from_utf8(score)
                        .ok()
                        .and_then(|s| s.parse::<u32>().ok())
                        .is_some_and(|n| n <= 100) =>
            {
                2
            }
            [b'M', score @ ..]
                if !score.is_empty()
                    && score.iter().all(u8::is_ascii_digit)
                    && std::str::from_utf8(score)
                        .ok()
                        .and_then(|s| s.parse::<u32>().ok())
                        .is_some_and(|n| n <= 100) =>
            {
                1
            }
            _ => return Err("invalid or unresolved Git name-status record".into()),
        };
        for _ in 0..endpoints {
            let path = fields.next().ok_or("missing Git rename/path endpoint")?;
            let path = std::str::from_utf8(path).map_err(|_| "Git path is not valid UTF-8")?;
            if !cadence::execution::patch::safe_relative_path(path) {
                return Err("Git path is not a safe relative path".into());
            }
            paths.insert(path.to_owned());
        }
    }
    Ok(paths.into_iter().collect())
}

#[derive(Debug, PartialEq, Eq)]
struct StagedObservation {
    paths: Vec<String>,
    objects: Vec<u8>,
}

async fn observe_staged(project: &Path) -> Result<StagedObservation, String> {
    let project = project.to_path_buf();
    tokio::task::spawn_blocking(move || {
        let objects = || {
            git_output_bytes(
                &project,
                &[
                    "diff",
                    "--cached",
                    "--raw",
                    "-z",
                    "-M",
                    "--no-abbrev",
                    "--no-ext-diff",
                    "--no-textconv",
                    "--",
                ],
            )
        };
        let before = objects()?;
        let bytes = git_output_bytes(
            &project,
            &[
                "diff",
                "--cached",
                "--name-status",
                "-z",
                "-M",
                "--no-ext-diff",
                "--no-textconv",
                "--",
            ],
        )?;
        let paths = read_name_status(&bytes)?;
        if objects()? != before {
            return Err("staged inputs changed during observation".into());
        }
        Ok(StagedObservation {
            paths,
            objects: before,
        })
    })
    .await
    .map_err(|_| "staged observation task closed".to_owned())?
}

async fn reobserve_staged(project: &Path, expected: &StagedObservation) -> Result<(), String> {
    if &observe_staged(project).await? != expected {
        return Err("staged inputs changed during the request".into());
    }
    Ok(())
}

fn conventional_subject(subject: &str, task_id: &str) -> bool {
    let Some((prefix, description)) = subject.split_once(": ") else {
        return false;
    };
    if description.trim().is_empty() {
        return false;
    }
    let prefix = prefix.strip_suffix('!').unwrap_or(prefix);
    let valid_type = if let Some((kind, scope)) = prefix.split_once('(') {
        kind.bytes().all(|byte| byte.is_ascii_lowercase())
            && !kind.is_empty()
            && scope.ends_with(')')
            && scope.len() > 1
            && !scope[..scope.len() - 1].chars().any(char::is_whitespace)
    } else {
        !prefix.is_empty() && prefix.bytes().all(|byte| byte.is_ascii_lowercase())
    };
    valid_type
        && description
            .split(|ch: char| !(ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.')))
            .any(|word| word == task_id)
}

fn git_output(project: &Path, args: &[&str]) -> Result<String, String> {
    String::from_utf8(git_output_bytes(project, args)?)
        .map_err(|_| "Git output is not valid UTF-8".into())
}

fn git_output_bytes(project: &Path, args: &[&str]) -> Result<Vec<u8>, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(project)
        .args(args)
        .output()
        .map_err(|error| format!("cannot run git: {error}"))?;
    if output.status.success() {
        Ok(output.stdout)
    } else {
        Err(format!(
            "git {} failed: {}",
            args.join(" "),
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

fn git_success(project: &Path, args: &[&str]) -> Result<(), String> {
    git_output_bytes(project, args).map(|_| ())
}

fn git_status(project: &Path, args: &[&str]) -> Result<bool, String> {
    let status = Command::new("git")
        .arg("-C")
        .arg(project)
        .args(args)
        .status()
        .map_err(|error| format!("cannot run git: {error}"))?;
    match status.code() {
        Some(0) => Ok(true),
        Some(1) => Ok(false),
        _ => Err(format!("git {} failed with {status}", args.join(" "))),
    }
}

fn scope(phase: u32) -> BoundaryScope {
    if phase == 0 {
        BoundaryScope::RootRefusal
    } else {
        BoundaryScope::Execution { phase }
    }
}

fn boundary(
    phase: u32,
    tool: BoundaryTool,
    _operation: &str,
    request: &str,
    response: &Response,
    subject_id: Option<String>,
    _prompt_bytes: Option<u64>,
) -> Result<BoundaryV1, Failure> {
    let answer = PreparedAnswer::new(response.clone().into_envelope())?;
    Ok(BoundaryV1::new(
        scope(phase),
        tool,
        tool_operation(tool).into(),
        request.into(),
        subject_id,
        &answer,
    ))
}

async fn record_lease_refusal<I: ConfigIo>(
    session: &Arc<Session<I>>,
    view: &View,
    request: &str,
    paths: cadence::execution::patch::UndeclaredPaths,
) -> Answer {
    let decision = BoundaryV1::lease_refusal(request.into(), paths)?;
    let written = session
        .request(Operation::BoundaryV1 {
            expected_generation: view.snapshot.generation,
            expected_integrity: view.snapshot.integrity.clone(),
            operation_id: format!("execution-observation:{}", decision.identity()?),
            decision: decision.clone(),
            change: Box::new(BoundaryChange::Observe),
        })
        .await
        .map_err(store_failure)?;
    confirmed_boundary(&written, &decision)?.envelope(None)
}

#[allow(clippy::too_many_arguments)]
async fn record_refusal<I: ConfigIo>(
    session: &Arc<Session<I>>,
    view: &View,
    phase: u32,
    tool: BoundaryTool,
    operation: &str,
    request: &str,
    code: impl Into<String>,
    reason: impl Into<String>,
    subject_id: Option<String>,
) -> Answer {
    let code = code.into();
    let response = Response::Refused {
        phase,
        reason: stable_reason(&code, &reason.into()),
        code,
    };
    record_observation(
        session, view, phase, tool, operation, request, response, subject_id,
    )
    .await
}

#[allow(clippy::too_many_arguments)]
async fn record_observation<I: ConfigIo>(
    session: &Arc<Session<I>>,
    view: &View,
    phase: u32,
    tool: BoundaryTool,
    operation: &str,
    request: &str,
    response: Response,
    subject_id: Option<String>,
) -> Answer {
    let decision = boundary(phase, tool, operation, request, &response, subject_id, None)?;
    let written = session
        .request(Operation::BoundaryV1 {
            expected_generation: view.snapshot.generation,
            expected_integrity: view.snapshot.integrity.clone(),
            operation_id: format!("execution-observation:{}", decision.identity()?),
            decision: decision.clone(),
            change: Box::new(BoundaryChange::Observe),
        })
        .await
        .map_err(store_failure)?;
    confirmed_boundary(&written, &decision)?.envelope(Some(response.into_envelope()))
}

fn refused(phase: u32, code: impl Into<String>, reason: impl Into<String>) -> Response {
    Response::Refused {
        phase,
        code: code.into(),
        reason: reason.into(),
    }
}

fn store_failure(error: Error) -> Failure {
    if error == Error::Closed {
        Failure::Closed
    } else if error == Error::Conflict("routing inputs changed before admission".into()) {
        Failure::RoutingInputsChanged
    } else {
        Failure::Store
    }
}

fn store_refusal(_phase: u32, error: Error) -> Answer {
    Err(store_failure(error))
}

#[derive(Clone, Copy, Debug)]
pub enum ValidationFailure {
    MissingArguments,
    MissingField,
    ExtraField,
    WrongType,
    UnknownTag,
    InvalidPatch,
}

impl ValidationFailure {
    fn code(self) -> &'static str {
        match self {
            Self::MissingArguments => "missing-arguments",
            Self::MissingField => "missing-field",
            Self::ExtraField => "extra-field",
            Self::WrongType => "wrong-type",
            Self::UnknownTag => "unknown-tag",
            Self::InvalidPatch => "invalid-patch",
        }
    }
}

fn tool_operation(tool: BoundaryTool) -> &'static str {
    match tool {
        BoundaryTool::CadenceQuery => "execute-next",
        BoundaryTool::CadenceApply => "executor",
    }
}

fn public_request_digest(tool: BoundaryTool, raw: Option<&Value>) -> String {
    // Option encodes absence as null, distinct from an empty arguments object.
    digest(
        &serde_json::to_vec(&("execution-request-v1", tool, tool_operation(tool), raw))
            .expect("JSON request identity serializes"),
    )
}

fn stable_reason(code: &str, _detail: &str) -> String {
    match code {
        "invalid-phase" => "phase must be a positive integer; supply the native phase number".into(),
        "foreign-dispatch" => "the patch does not identify a dispatch in this store; request the next execution dispatch".into(),
        "continuation-refusal" => "execution needs current continuation authority; resolve the pending decision before retrying".into(),
        _ => format!("execution validation failed ({code}); check the controlling inputs and retry"),
    }
}

async fn begin<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    selected: &Path,
) -> Result<(std::path::PathBuf, Arc<Session<I>>, View), Failure> {
    let root = crate::config::reload::identity(selected).map_err(store_failure)?;
    let session = factory.first_touch(&root).await.map_err(store_failure)?;
    let view = session.derivation_view().await.map_err(store_failure)?;
    require_current_execution(&view)?;
    Ok((root, session, view))
}

fn dispatch_phase(view: &View, id: &str) -> Result<Option<u32>, Failure> {
    let execution = execution_snapshot(view).map_err(|_| Failure::Store)?;
    let matches = execution
        .occurrences
        .values()
        .filter(|occurrence| {
            occurrence
                .active
                .as_ref()
                .is_some_and(|active| active.id == id)
                || occurrence.receipts.contains_key(id)
        })
        .map(|occurrence| occurrence.phase)
        .collect::<Vec<_>>();
    match matches.as_slice() {
        [] => Ok(None),
        [phase] if *phase > 0 => Ok(Some(*phase)),
        _ => Err(Failure::Store),
    }
}

async fn terminal_answer<I: ConfigIo>(
    session: &Session<I>,
    view: &View,
    scope: &BoundaryScope,
) -> Result<Option<ExecutionEnvelope>, Failure> {
    let Some(terminal) = terminal_v1(view, scope) else {
        return Ok(None);
    };
    let decision = terminal.value.boundary.clone();
    let written = session
        .request(Operation::BoundaryV1 {
            expected_generation: view.snapshot.generation,
            expected_integrity: view.snapshot.integrity.clone(),
            operation_id: terminal.id.into(),
            decision: decision.clone(),
            change: Box::new(BoundaryChange::Observe),
        })
        .await
        .map_err(store_failure)?;
    Ok(Some(
        confirmed_boundary(&written, &decision)?.envelope(None)?,
    ))
}

pub async fn refuse_arguments<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    root: &Path,
    tool: BoundaryTool,
    raw: Option<Value>,
    failure: ValidationFailure,
) -> Answer {
    let (_, session, view) = begin(factory, root).await?;
    let phase = if tool == BoundaryTool::CadenceApply {
        match raw
            .as_ref()
            .and_then(|value| value.get("dispatch_id"))
            .and_then(Value::as_str)
        {
            Some(id) => dispatch_phase(&view, id)?.unwrap_or(0),
            None => 0,
        }
    } else {
        0
    };
    if let Some(answer) = terminal_answer(&session, &view, &scope(phase)).await? {
        return Ok(answer);
    }
    record_refusal(
        &session,
        &view,
        phase,
        tool,
        tool_operation(tool),
        &public_request_digest(tool, raw.as_ref()),
        failure.code(),
        "invalid execution arguments",
        None,
    )
    .await
}

async fn derivation_refusal<I: ConfigIo>(
    session: &Arc<Session<I>>,
    phase: u32,
    tool: BoundaryTool,
    request: &str,
    error: cadence::derivation::DerivationError,
) -> Answer {
    if matches!(error, cadence::derivation::DerivationError::Store { .. }) {
        return Err(Failure::Store);
    }
    let view = session.derivation_view().await.map_err(store_failure)?;
    record_refusal(
        session,
        &view,
        phase,
        tool,
        tool_operation(tool),
        request,
        error.code(),
        "lifecycle input validation failed",
        None,
    )
    .await
}

// Execution observes lifecycle authority without publishing a memo on a later refusal.
async fn checked_execution<I: ConfigIo + Clone + Sync>(
    session: &Session<I>,
    root: &Path,
    driver: &Driver,
) -> Result<(cadence::derivation::RecheckedLifecycle, View), cadence::derivation::DerivationError> {
    use cadence::derivation::*;
    struct Intake(IntakeObservation);
    impl IntakeIo for Intake {
        fn observe_intake(&mut self) -> Result<IntakeObservation, DerivationError> {
            Ok(self.0.clone())
        }
    }
    let root = root.to_path_buf();
    let driver = driver.clone();
    let view = session
        .derivation_view()
        .await
        .map_err(derivation_service::store_error)?;
    let data = view.snapshot.data.clone();
    let checked = tokio::task::spawn_blocking(move || {
        let mut io = (driver.artifacts)();
        let prepared = prepare_query(&root, io.as_mut())?;
        #[cfg(test)]
        (driver.event)(derivation_service::Event::Derived);
        let key = input_key(prepared.capture())?;
        let raw = memo_from_data(&data, &key)?;
        let selected = select_intake(&data)?;
        let prepared = prepared.with_intake(&selected)?;
        #[cfg(test)]
        (driver.compare)(raw, &key, prepared.answer())?;
        #[cfg(not(test))]
        check_memo(raw, &key, prepared.answer())?;
        recheck_query_with_intake(&prepared, io.as_mut(), &mut Intake(selected.observation))
    })
    .await
    .map_err(|_| derivation_service::store_error(Error::Closed))??;
    let latest = session
        .derivation_view()
        .await
        .map_err(derivation_service::store_error)?;
    if latest.snapshot != view.snapshot {
        return Err(DerivationError::InputsChanged);
    }
    Ok((checked, latest))
}

async fn checked_continuation<I: ConfigIo + Clone + Sync>(
    session: &Session<I>,
    view: &View,
    checked: &cadence::derivation::RecheckedLifecycle,
    phase: u32,
    driver: &Driver,
) -> Result<cadence::next_action::continuation::Continuation, cadence::derivation::DerivationError>
{
    use cadence::{
        derivation::*,
        evidence::{authority, material, persistence},
        next_action::continuation,
    };
    let fail = derivation_service::store_error;
    let scope = continuation_scope(&checked.capture().root, phase);
    scope.validate().map_err(fail)?;
    let config = session.config().map_err(fail)?;
    let mut current = persistence::read(&view.snapshot.data).map_err(fail)?;
    let mut records = Vec::new();
    for decision in view.decisions.iter().rev() {
        if let Some(historical) = persistence::decode_history(decision).map_err(fail)?
            && let Some(record) = current.remove(&historical.key().map_err(fail)?)
        {
            records.push(record);
        }
    }
    if !current.is_empty() {
        return Err(fail(Error::Invalid(
            "native continuation records lack history".into(),
        )));
    }
    records.reverse();
    let checker = continuation::latest_checker(&records, &scope);
    let materials = checker
        .map(|c| material::basis(&records, &scope, &c.id))
        .transpose()
        .map_err(fail)?
        .unwrap_or_default();
    let capture = checked.capture().clone();
    let driver = driver.clone();
    let observed_materials = materials.clone();
    let observed = tokio::task::spawn_blocking(move || {
        let observe = || {
            super::evidence_service::observe_material(
                &capture.root,
                &observed_materials,
                &mut |path| match ArtifactFiles.read(path) {
                    Observation::Present(bytes) => Ok(bytes),
                    Observation::Absent => Err(std::io::ErrorKind::NotFound.into()),
                    Observation::Failed(_) => {
                        Err(std::io::Error::other("checked material is unreadable"))
                    }
                },
            )
        };
        let observed = observe();
        #[cfg(test)]
        (driver.event)(derivation_service::Event::RoutingObserved);
        if capture_inputs(&capture.root, (driver.artifacts)().as_mut())? != capture
            || observe() != observed
        {
            return Err(DerivationError::InputsChanged);
        }
        Ok(observed)
    })
    .await
    .map_err(|_| fail(Error::Closed))??;
    let applicability = checker
        .map(|c| authority::checker_applicability(&records, &scope, &c.id, &observed))
        .transpose()
        .map_err(fail)?;
    let plans = checked
        .answer()
        .phases
        .iter()
        .find(|p| p.id.number() == f64::from(phase))
        .map(|p| p.plans.as_slice())
        .unwrap_or_default();
    let selected = continuation::select(&records, &scope, applicability, plans);
    if session.derivation_view().await.map_err(fail)?.snapshot != view.snapshot
        || session.config().map_err(fail)? != config
    {
        return Err(DerivationError::InputsChanged);
    }
    Ok(selected)
}

/// An explicit assessment consumes accepted execution evidence, never report prose
/// or a fresh HEAD. The base was retained atomically before completion cleared active.
pub fn risk_material(
    view: &View,
    root: &Path,
    phase: u32,
    occurrence_id: &str,
    plan: u32,
    dispatch_id: &str,
) -> Result<cadence::rail::risk::MaterialIdentity, String> {
    use cadence::rail::risk;
    require_current_execution(view).map_err(|error| error.to_string())?;
    if occurrence_id != continuation_scope(root, phase).occurrence {
        return Err("risk source names a foreign execution occurrence".into());
    }
    let execution = execution_snapshot(view)?;
    let occurrence = execution
        .occurrences
        .get(&phase.to_string())
        .ok_or("risk source lacks accepted execution material")?;
    let receipt = occurrence
        .receipts
        .get(dispatch_id)
        .ok_or("risk source lacks an accepted dispatch receipt")?;
    let basis = risk::execution_bases(&view.snapshot.data)
        .map_err(|error| error.to_string())?
        .remove(dispatch_id)
        .ok_or("risk source lacks a retained dispatch base")?;
    if basis.phase != phase
        || basis.plan != plan
        || receipt.outcome.phase != phase
        || receipt.outcome.plan != plan
        || basis.plan_set_fingerprint != occurrence.plan_set_fingerprint
        || basis.transition_id != receipt.transition_id
        || receipt.outcome.transition_id != receipt.transition_id
        || basis.commits != risk::completed_commits(&receipt.outcome)
    {
        return Err("risk source differs from accepted execution material".into());
    }
    let confirmed = view.decisions.iter().any(|record| match &record.decision {
        cadence::store::model::Decision::BoundaryV1(value) => {
            value.store_generation <= view.snapshot.generation
                && value.boundary.tool == BoundaryTool::CadenceApply
                && value.boundary.scope == (BoundaryScope::Execution { phase })
                && value.boundary.subject_id.as_deref() == Some(dispatch_id)
                && (matches!(&value.boundary.receipt, Receipt::Compact { envelope: Envelope::Ok(_) })
                    || matches!(&value.boundary.receipt, Receipt::Compact { envelope: Envelope::Refused { code, .. } } if code == "risk-pending"))
                && confirmed_boundary(view, &value.boundary).is_ok()
        }
        _ => false,
    });
    if !confirmed {
        return Err("risk source lacks confirmed patch acceptance".into());
    }
    let head_id = basis
        .commits
        .last()
        .cloned()
        .unwrap_or_else(|| basis.base_id.clone());
    Ok(risk::MaterialIdentity::Committed {
        base_id: basis.base_id,
        head_id,
    })
}

#[cfg(test)]
mod schema_tests {
    use super::*;

    #[test]
    fn execution_service_prompt_contains_generated_schema_and_opaque_utf8_body() {
        let source = b"---\nphase: 6\nplan: 1\nrequirements: [AC1]\nfiles: [src/a.rs]\nexecution:\n  schema: 1\n  suite: cargo test\n  tasks:\n    - id: T1\n      verify: [cargo test one]\n---\n";
        let body = "opaque 日本語\n# unparsed heading\n";
        let mut bytes = source.to_vec();
        bytes.extend_from_slice(body.as_bytes());
        let plan = parse_plan(&bytes, 6, 1).unwrap();
        let mut dispatch = cadence::execution::dispatch::build_dispatch(
            &plan,
            &"a".repeat(64),
            0,
            &"b".repeat(40),
            1,
        )
        .unwrap();
        let prompt = render_prompt(&dispatch);
        dispatch.prompt_bytes = prompt.len() as u64;
        assert_eq!(render_prompt(&dispatch).len() as u64, dispatch.prompt_bytes);
        assert!(prompt.ends_with(body));
        assert!(prompt.contains(&format!("Opaque plan body ({} UTF-8 bytes):", body.len())));
        let schema = prompt
            .split("Executor patch schema:\n")
            .nth(1)
            .unwrap()
            .split("\n\nInstructions:")
            .next()
            .unwrap();
        assert_eq!(
            serde_json::from_str::<Value>(schema).unwrap(),
            patch_schema()
        );
        assert_eq!(
            patch_schema(),
            serde_json::to_value(schemars::schema_for!(ExecutorPatch)).unwrap()
        );
    }
}

#[derive(Debug, PartialEq)]
enum ExecutionReviewDecision {
    Skip,
    Replay {
        fire: String,
        attempt: String,
    },
    Admit {
        request: Value,
        gate: cadence::review::model::Gate,
    },
}

fn execution_review_decision(
    completed: Option<Value>,
    gate: Option<cadence::review::model::Gate>,
    saved: Option<&Value>,
) -> cadence::store::Result<ExecutionReviewDecision> {
    if let Some(saved) = saved {
        return Ok(ExecutionReviewDecision::Replay {
            fire: saved["fire"]
                .as_str()
                .ok_or_else(|| Error::Invalid("invalid boundary fire".into()))?
                .into(),
            attempt: saved["attempt"]
                .as_str()
                .ok_or_else(|| Error::Invalid("invalid boundary attempt".into()))?
                .into(),
        });
    }
    match (completed, gate) {
        (Some(request), Some(gate)) if gate != cadence::review::model::Gate::Off => {
            Ok(ExecutionReviewDecision::Admit { request, gate })
        }
        _ => Ok(ExecutionReviewDecision::Skip),
    }
}

/// Grouped-tool handoff guard; execution envelopes and canonical receipts are
/// unchanged. Reads include replayed terminal dispatches before exposing them.
pub async fn review_handoff<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    root: &Path,
    phase: Option<u32>,
    dispatch: Option<&str>,
) -> super::review_service::Answer {
    let session = factory.first_touch(root).await?;
    let phase = match phase {
        Some(phase) => Some(phase),
        None => match dispatch {
            Some(id) => {
                let view = session.derivation_view().await?;
                dispatch_phase(&view, id).map_err(|e| Error::Invalid(e.to_string()))?
            }
            None => None,
        },
    };
    let Some(phase) = phase else {
        return Ok(Envelope::Ok(super::review_service::Output {
            operation: "review-handoff".into(),
            result: json!({"pending":false}),
        }));
    };
    let view = session.derivation_view().await?;
    let execution = execution_snapshot(&view).map_err(Error::Invalid)?;
    if let Some(occurrence) = execution.occurrences.get(&phase.to_string()) {
        for receipt in occurrence
            .receipts
            .values()
            .filter(|r| r.outcome.disposition == PlanDisposition::Complete)
        {
            let scope = continuation_scope(root, phase);
            let key = format!(
                "execution-review:{}",
                digest(&serde_json::to_vec(&json!({
                    "scope":scope,"occurrence":occurrence.plan_set_fingerprint,
                    "dispatch":receipt.dispatch_id,"transition":receipt.transition_id,"trigger":"diff","round":1
                }))?)
            );
            let records = cadence::review::persistence::records(
                &session.derivation_view().await?.snapshot.data,
            )?;
            let saved = records.get("replays").and_then(|r| r.get(&key));
            let decision = if saved.is_some() {
                execution_review_decision(None, None, saved)?
            } else {
                let route = super::config_service::route_at(
                    &session.config()?,
                    &super::config_service::RouteRequest {
                        role: "cad-reviewer".into(),
                        phase: std::num::NonZeroU32::new(phase),
                        plan: std::num::NonZeroU32::new(receipt.outcome.plan),
                        attempt: None,
                    },
                    root,
                )?;
                let policy = route
                    .policy
                    .triggers
                    .get("diff")
                    .ok_or_else(|| Error::Policy("missing diff policy".into()))?;
                let gate = serde_json::from_value(json!(policy.gate))?;
                let material = risk_material(
                    &view,
                    root,
                    phase,
                    &scope.occurrence,
                    receipt.outcome.plan,
                    &receipt.dispatch_id,
                )
                .map_err(Error::Invalid)?;
                let cadence::rail::risk::MaterialIdentity::Committed { base_id, head_id } =
                    material
                else {
                    return Err(Error::Invalid(
                        "completed execution requires a committed range".into(),
                    ));
                };
                let request = json!({"replay_key":key,"caller":"execute","trigger":"diff","specialist":null,
                    "project":scope.project,"cycle":scope.cycle,"home":{"kind":"phase","id":phase.to_string()},
                    "discriminator":scope.occurrence,"phase":phase,"plan":receipt.outcome.plan,
                    "anchor":receipt.transition_id,"round":1,"target":{"kind":"committed-range","base":base_id,"head":head_id}});
                execution_review_decision(Some(request), Some(gate), None)?
            };
            let fire = match decision {
                ExecutionReviewDecision::Skip => continue,
                ExecutionReviewDecision::Replay { fire, .. } => fire,
                ExecutionReviewDecision::Admit { request, .. } => {
                    let answer = super::review_service::admit(factory, root, request).await?;
                    match answer {
                        Envelope::Ok(output) if output.result["fire"].is_string() => {
                            output.result["fire"].as_str().unwrap().to_owned()
                        }
                        Envelope::Ok(output) if output.result["gate"] == "off" => continue,
                        answer => return Ok(answer),
                    }
                }
            };
            let answer = super::review_service::next(session.review_store(), &fire).await?;
            if !matches!(&answer, Envelope::Ok(output) if super::review_service::execution_continuation(&output.result) == "continue")
            {
                return Ok(answer);
            }
        }
    }
    super::review_service::pending_execution(session.review_store(), phase).await
}

#[cfg(test)]
mod routing_prompt_tests {
    use super::*;
    use cadence::execution::render::prompt_operational;

    #[test]
    fn prompt_operational_returns_the_admitted_choice_verbatim() {
        let route = json!({"choice":{"role":"cad-executor","agent":"cad-executor-xhigh","rung":"xhigh","starting_rung":"xhigh","model":"opus",
            "effort_source":{"kind":"role","key":"roles.cad-executor.effort","layer":"repo","stored":"xhigh"},
            "model_source":{"kind":"role","key":"roles.cad-executor.model","layer":"repo","stored":"opus"},
            "attempt":1,"escalated":false,"pinned":false,"reasons":["fixture selection"],"warnings":[]},
            "inputs":{"repo":{"identity":"/project/.planning/config.v4.json","content":null,"stamp":null},"global":null,"global_alias":false}});
        let supplied: ActiveDispatch = serde_json::from_value(json!({"schema":1,"id":"dispatch-fixture","expected_execution_version":1,
            "phase":8,"plan":1,"plan_fingerprint":"plan","plan_set_fingerprint":"plans","requirements":["AC10"],"tasks":[{"id":"T1","verify":["verify"]}],
            "suite":"verify","files":["src/a.rs"],"policy":{"rung":"xhigh","branch":"current","reviews":"disabled"},
            "route":route,"base_sha":"base","prompt_bytes":1,"body":"opaque fixture body"})).unwrap();
        assert_eq!(
            prompt_operational(&supplied),
            json!({"schema":1,"dispatch_id":"dispatch-fixture","expected_execution_version":1,
            "phase":8,"plan":1,"requirements":["AC10"],"files":["src/a.rs"],"suite":"verify","tasks":[{"id":"T1","verify":["verify"]}],
            "policy":{"rung":"xhigh","branch":"current","reviews":"disabled"},"base_sha":"base","route":route})
        );
    }
}

#[cfg(test)]
mod gap151_boundary_tests {
    use super::*;
    use cadence::review::model::Gate;

    #[test]
    fn gap151_completed_diff_requests_admission() {
        let request = json!({"dispatch":"d1","caller":"execute","trigger":"diff","target":{"base":"b1","head":"h1"}});
        let decision =
            execution_review_decision(Some(request), Some(Gate::Advisory), None).unwrap();
        let ExecutionReviewDecision::Admit { request, gate } = decision else {
            panic!("admission required")
        };
        assert_eq!(gate, Gate::Advisory);
        assert_eq!(
            request,
            json!({"dispatch":"d1","caller":"execute","trigger":"diff","target":{"base":"b1","head":"h1"}})
        );
    }

    #[test]
    fn gap151_replay_precedes_changed_policy_and_material() {
        let saved = json!({"replay_key":"k1","fire":"f1","attempt":"a1"});
        assert_eq!(
            execution_review_decision(
                Some(json!({"target":{"base":"other","head":"changed"}})),
                Some(Gate::Off),
                Some(&saved)
            )
            .unwrap(),
            ExecutionReviewDecision::Replay {
                fire: "f1".into(),
                attempt: "a1".into()
            }
        );
    }

    #[test]
    fn gap151_absent_artifact_and_fresh_off_admit_nothing() {
        assert_eq!(
            execution_review_decision(None, Some(Gate::Advisory), None).unwrap(),
            ExecutionReviewDecision::Skip
        );
        assert_eq!(
            execution_review_decision(Some(json!({"dispatch":"d1"})), Some(Gate::Off), None)
                .unwrap(),
            ExecutionReviewDecision::Skip
        );
    }
}
