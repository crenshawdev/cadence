//! Native plan dispatch and executor-patch application.
//!
//! The resident calls these functions directly. They never send another
//! resident request, so the single owner cannot deadlock itself.
use super::{
    derivation_service::{self, Driver},
    next_action_service,
};
use crate::{
    config::reload::ConfigIo,
    import::{Session, SessionFactory},
};
use cadence::{
    derivation::{Cycle, LifecycleStatus},
    evidence::Scope,
    execution::{
        dispatch::{admit_dispatch, build_dispatch},
        model::{
            ActiveDispatch, BoundaryDecision, BoundaryTool, ExecutionOccurrence, ExecutionPlan,
            ExecutionSnapshot, ExecutorPatch, PlanDisposition, TerminalOutcome,
        },
        patch::{ApplicationDisposition, apply_executor_patch, attach_commit_paths},
        plan::{PlanGraph, parse_plan, plan_set_fingerprint},
        render::SUMMARY_RENDER_VERSION,
    },
    next_action::continuation::Decision as ContinuationDecision,
    store::{
        Error,
        model::digest,
        writer::{Operation, View},
    },
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    collections::{BTreeMap, BTreeSet},
    path::Path,
    process::Command,
    sync::Arc,
};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "outcome", rename_all = "kebab-case")]
pub enum Response {
    Dispatch {
        dispatch: Box<ActiveDispatch>,
        prompt: String,
    },
    NextPlan {
        phase: u32,
        plan: u32,
    },
    Complete {
        phase: u32,
    },
    JudgmentStop {
        phase: u32,
        dispatch_id: String,
        blocker_ids: Vec<String>,
    },
    Refused {
        phase: u32,
        code: String,
        reason: String,
    },
}

impl Response {
    fn label(&self) -> String {
        match self {
            Self::Dispatch { .. } => "dispatch".into(),
            Self::NextPlan { .. } => "next-plan".into(),
            Self::Complete { .. } => "complete".into(),
            Self::JudgmentStop { .. } => "judgment-stop".into(),
            Self::Refused { code, .. } => format!("refused:{code}"),
        }
    }
}

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
) -> Response {
    let raw_request = request_digest(&("query-next", selected_root.to_string_lossy(), phase));
    if phase == 0 {
        return refused(phase, "invalid-phase", "phase must be a positive integer");
    }
    let (checked, mut view) =
        match derivation_service::checked_query(factory, selected_root, driver).await {
            Ok(value) => value,
            Err(error) => return refused(phase, error.code(), format!("{error:?}")),
        };
    let root = checked.capture().root.clone();
    let session = match factory.first_touch(&root).await {
        Ok(session) => session,
        Err(error) => return store_refusal(phase, error),
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
            let Response::Dispatch {
                dispatch: returned, ..
            } = &response
            else {
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
            let mut original_candidate = returned.as_ref().clone();
            original_candidate.expected_execution_version = occurrence.version - 1;
            let decision = boundary(
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                &response,
                Some(active.id.clone()),
                Some(active.prompt_bytes),
            );
            let written = match session
                .request(Operation::AdmitExecution {
                    expected_generation: view.snapshot.generation,
                    expected_integrity: view.snapshot.integrity.clone(),
                    operation_id: format!("execution-dispatch:{}", active.id),
                    plan_set_fingerprint: plans.fingerprint.clone(),
                    dispatch: original_candidate,
                    decision,
                })
                .await
            {
                Ok(written) => written,
                Err(error) => return store_refusal(phase, error),
            };
            if !stored_dispatch(&written, phase, returned) {
                return refused(
                    phase,
                    "dispatch-not-confirmed",
                    "the writer did not confirm the replayed dispatch",
                );
            }
            return response;
        }
    }

    let continuation = match next_action_service::continuation(
        factory,
        &root,
        &continuation_scope(&root, phase),
        driver,
    )
    .await
    {
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
        let response = Response::Complete { phase };
        return record_observation(
            &session,
            &view,
            phase,
            BoundaryTool::CadenceQuery,
            "query-next",
            &raw_request,
            response,
            None,
        )
        .await;
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
    let mut candidate =
        match build_dispatch(plan, &plans.fingerprint, occurrence.version, &base_sha, 1) {
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
        "query-next",
        &raw_request,
        &response,
        Some(dispatch.id.clone()),
        Some(dispatch.prompt_bytes),
    );
    let operation_id = format!("execution-dispatch:{}", dispatch.id);
    let written = match session
        .request(Operation::AdmitExecution {
            expected_generation: view.snapshot.generation,
            expected_integrity: view.snapshot.integrity.clone(),
            operation_id,
            plan_set_fingerprint: plans.fingerprint,
            dispatch: candidate,
            decision,
        })
        .await
    {
        Ok(written) => written,
        Err(error) => return store_refusal(phase, error),
    };
    if !stored_dispatch(&written, phase, &dispatch) {
        return refused(
            phase,
            "dispatch-not-confirmed",
            "the writer did not confirm the admitted dispatch",
        );
    }
    response
}

pub async fn apply<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    selected_root: &Path,
    phase: u32,
    patch: ExecutorPatch,
    driver: &Driver,
) -> Response {
    let request = request_digest(&("apply-executor-patch", phase, &patch));
    if phase == 0 {
        return refused(phase, "invalid-phase", "phase must be a positive integer");
    }
    let (checked, view) =
        match derivation_service::checked_query(factory, selected_root, driver).await {
            Ok(value) => value,
            Err(error) => return refused(phase, error.code(), format!("{error:?}")),
        };
    let root = checked.capture().root.clone();
    let session = match factory.first_touch(&root).await {
        Ok(session) => session,
        Err(error) => return store_refusal(phase, error),
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
    let (commit_paths, base_sha) = if application.disposition == ApplicationDisposition::Replay {
        (application.outcome.commit_paths.clone(), String::new())
    } else {
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
            None => return refused(phase, "invalid-project-root", "planning root has no parent"),
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
    let application = match attach_commit_paths(application, &commit_paths) {
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
    let graph = match PlanGraph::build(&plans.values) {
        Ok(graph) => graph,
        Err(error) => return refused(phase, error.code, error.detail),
    };
    let next_execution = match application
        .data
        .get("execution")
        .ok_or_else(|| "snapshot has no execution namespace".to_owned())
        .and_then(execution_value)
    {
        Ok(value) => value,
        Err(error) => return refused(phase, "invalid-execution-store", error),
    };
    let next_occurrence = &next_execution.occurrences[&phase.to_string()];
    let completed = next_occurrence
        .plans
        .iter()
        .filter(|outcome| outcome.disposition == PlanDisposition::Complete)
        .map(|outcome| outcome.plan)
        .collect::<BTreeSet<_>>();
    let response = if application.outcome.disposition == PlanDisposition::Blocked {
        terminal_response(
            phase,
            next_occurrence
                .terminal
                .as_ref()
                .expect("blocked patch installs a terminal outcome"),
        )
    } else if let Some(plan) = graph.next_ready(&completed) {
        Response::NextPlan { phase, plan }
    } else {
        Response::Complete { phase }
    };
    let complete_phase = matches!(response, Response::Complete { .. });
    let decision = boundary(
        phase,
        BoundaryTool::CadenceApply,
        "apply-executor-patch",
        &request,
        &response,
        Some(patch.dispatch_id.clone()),
        None,
    );
    let operation_id = format!("execution-patch:{}", patch.dispatch_id);
    let written = match session
        .request(Operation::ApplyExecutionPatch {
            expected_generation: view.snapshot.generation,
            expected_integrity: view.snapshot.integrity.clone(),
            operation_id,
            patch,
            commit_paths,
            decision,
            render_version: SUMMARY_RENDER_VERSION,
            complete_phase,
        })
        .await
    {
        Ok(written) => written,
        Err(error) => return store_refusal(phase, error),
    };
    if !stored_receipt(&written, phase, &application.outcome.dispatch_id) {
        return refused(
            phase,
            "patch-not-confirmed",
            "the writer did not confirm the executor patch receipt",
        );
    }
    response
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
    let prompt = render_prompt(&dispatch);
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
    let operational = json!({
        "schema": dispatch.schema,
        "dispatch_id": dispatch.id,
        "expected_execution_version": dispatch.expected_execution_version,
        "phase": dispatch.phase,
        "plan": dispatch.plan,
        "requirements": dispatch.requirements,
        "files": dispatch.files,
        "suite": dispatch.suite,
        "tasks": dispatch.tasks,
        "policy": dispatch.policy,
        "base_sha": dispatch.base_sha,
    });
    format!(
        "Cadence native execution dispatch\n\nOperational input:\n{}\n\nExecutor patch schema:\n{}\n\nInstructions:\nComplete tasks in listed order. Use one distinct signed commit per completed task. Run each task's exact verification commands and the suite. Return exactly one executor patch matching this schema. Stop at the first blocker and mark all later tasks not-run.\n\nOpaque plan body ({} UTF-8 bytes):\n{}",
        serde_json::to_string_pretty(&operational).expect("operational fields serialize"),
        serde_json::to_string_pretty(&patch_schema()).expect("patch schema serializes"),
        dispatch.body.len(),
        dispatch.body,
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
        let output = git_output_bytes(
            project,
            &[
                "diff-tree",
                "--root",
                "--no-commit-id",
                "--name-only",
                "-r",
                "-z",
                commit,
            ],
        )
        .map_err(|reason| ("commit-paths", reason))?;
        let mut observed = output
            .split(|byte| *byte == 0)
            .filter(|value| !value.is_empty())
            .map(|value| {
                String::from_utf8(value.to_vec())
                    .map_err(|_| ("commit-paths", "Git path is not valid UTF-8".into()))
            })
            .collect::<Result<Vec<_>, _>>()?;
        observed.sort();
        observed.dedup();
        paths.insert(commit.clone(), observed);
        prior = commit;
    }
    Ok(paths)
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

fn request_digest(value: &impl Serialize) -> String {
    digest(&serde_json::to_vec(value).expect("request identity serializes"))
}

fn boundary(
    phase: u32,
    tool: BoundaryTool,
    operation: &str,
    request: &str,
    response: &Response,
    subject_id: Option<String>,
    prompt_bytes: Option<u64>,
) -> BoundaryDecision {
    BoundaryDecision {
        phase,
        tool,
        operation: operation.into(),
        request_digest: request.into(),
        outcome: response.label(),
        subject_id,
        prompt_bytes,
        response_digest: request_digest(response),
    }
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
) -> Response {
    let response = Response::Refused {
        phase,
        code: code.into(),
        reason: reason.into(),
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
) -> Response {
    let decision = boundary(phase, tool, operation, request, &response, subject_id, None);
    let operation_id = format!("execution-observation:{}", request_digest(&decision));
    match session
        .request(Operation::RecordExecutionRefusal {
            expected_generation: view.snapshot.generation,
            expected_integrity: view.snapshot.integrity.clone(),
            operation_id,
            decision,
        })
        .await
    {
        Ok(_) => response,
        Err(error) => store_refusal(phase, error),
    }
}

fn refused(phase: u32, code: impl Into<String>, reason: impl Into<String>) -> Response {
    Response::Refused {
        phase,
        code: code.into(),
        reason: reason.into(),
    }
}

fn store_refusal(phase: u32, error: Error) -> Response {
    let code = if matches!(error, Error::Conflict(_)) {
        "store-conflict"
    } else {
        "store-error"
    };
    refused(phase, code, error.to_string())
}

fn stored_dispatch(view: &View, phase: u32, dispatch: &ActiveDispatch) -> bool {
    execution_snapshot(view)
        .ok()
        .and_then(|execution| execution.occurrences.get(&phase.to_string()).cloned())
        .and_then(|occurrence| occurrence.active)
        .is_some_and(|mut active| {
            active.body = dispatch.body.clone();
            active == *dispatch
        })
}

fn stored_receipt(view: &View, phase: u32, dispatch_id: &str) -> bool {
    execution_snapshot(view)
        .ok()
        .and_then(|execution| execution.occurrences.get(&phase.to_string()).cloned())
        .is_some_and(|occurrence| occurrence.receipts.contains_key(dispatch_id))
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
        let mut dispatch = build_dispatch(&plan, &"a".repeat(64), 0, &"b".repeat(40), 1).unwrap();
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
