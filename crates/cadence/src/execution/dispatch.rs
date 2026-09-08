use serde::Serialize;

use super::model::{
    ActiveDispatch, BranchPolicy, DispatchPolicy, EXECUTION_SCHEMA, ExecutionOccurrence,
    ExecutionPlan, ExecutorRung, ReviewPolicy,
};
use super::plan::PlanError;
use crate::store::model::digest;

#[derive(Serialize)]
struct DispatchIdentity<'a> {
    schema: u32,
    execution_version: u64,
    phase: u32,
    plan: u32,
    plan_fingerprint: &'a str,
    plan_set_fingerprint: &'a str,
    base_sha: &'a str,
}

pub fn build_dispatch(
    plan: &ExecutionPlan,
    plan_set_fingerprint: &str,
    execution_version: u64,
    base_sha: &str,
    prompt_bytes: u64,
) -> Result<ActiveDispatch, PlanError> {
    if !full_sha(base_sha) {
        return Err(error(
            "invalid-base",
            "base SHA must contain 40 hexadecimal digits",
        ));
    }
    if plan_set_fingerprint.len() != 64
        || !plan_set_fingerprint
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit())
    {
        return Err(error(
            "invalid-plan-set",
            "plan-set fingerprint must contain 64 hexadecimal digits",
        ));
    }
    if prompt_bytes == 0 {
        return Err(error(
            "invalid-prompt",
            "prompt byte count must be positive",
        ));
    }
    let identity = DispatchIdentity {
        schema: EXECUTION_SCHEMA,
        execution_version,
        phase: plan.phase,
        plan: plan.plan,
        plan_fingerprint: &plan.fingerprint,
        plan_set_fingerprint,
        base_sha,
    };
    let id = digest(
        &serde_json::to_vec(&identity)
            .map_err(|err| error("dispatch-identity", err.to_string()))?,
    );
    Ok(ActiveDispatch {
        schema: EXECUTION_SCHEMA,
        id,
        expected_execution_version: execution_version,
        phase: plan.phase,
        plan: plan.plan,
        plan_fingerprint: plan.fingerprint.clone(),
        plan_set_fingerprint: plan_set_fingerprint.to_owned(),
        requirements: plan.requirements.clone(),
        tasks: plan.tasks.clone(),
        suite: plan.suite.clone(),
        files: plan.files.clone(),
        directories: plan.directories.clone(),
        policy: DispatchPolicy {
            rung: ExecutorRung::Fixed,
            branch: BranchPolicy::Current,
            reviews: ReviewPolicy::Disabled,
        },
        route: None,
        base_sha: base_sha.to_owned(),
        prompt_bytes,
        body: plan.body.clone(),
    })
}

pub fn admit_dispatch(
    occurrence: &ExecutionOccurrence,
    candidate: ActiveDispatch,
) -> Result<(ExecutionOccurrence, ActiveDispatch), PlanError> {
    validate_route_choice(&candidate)?;
    if occurrence.phase != candidate.phase
        || occurrence.plan_set_fingerprint != candidate.plan_set_fingerprint
        || occurrence.version != candidate.expected_execution_version
    {
        return Err(error(
            "dispatch-conflict",
            "candidate dispatch does not match the execution occurrence",
        ));
    }
    if occurrence.terminal.is_some() {
        return Err(error(
            "dispatch-terminal",
            "execution occurrence already has a terminal outcome",
        ));
    }
    if let Some(active) = &occurrence.active {
        if active == &candidate {
            return Ok((occurrence.clone(), active.clone()));
        }
        return Err(error(
            "dispatch-active",
            "another plan dispatch is already active",
        ));
    }
    let mut next = occurrence.clone();
    next.active = Some(candidate.clone());
    next.version = next.version.checked_add(1).ok_or_else(|| {
        error(
            "execution-version",
            "execution version cannot be incremented",
        )
    })?;
    next.active
        .as_mut()
        .expect("active dispatch was just installed")
        .expected_execution_version = next.version;
    Ok((
        next,
        candidate_with_version(candidate, occurrence.version + 1),
    ))
}

fn candidate_with_version(mut candidate: ActiveDispatch, version: u64) -> ActiveDispatch {
    candidate.expected_execution_version = version;
    candidate
}

pub(crate) fn full_sha(value: &str) -> bool {
    value.len() == 40 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn error(code: &'static str, detail: impl Into<String>) -> PlanError {
    PlanError {
        code,
        detail: detail.into(),
    }
}

pub fn build_routed_dispatch(
    plan: &ExecutionPlan,
    plan_set_fingerprint: &str,
    execution_version: u64,
    base_sha: &str,
    prompt_bytes: u64,
    route: super::model::DispatchRoute,
) -> Result<ActiveDispatch, PlanError> {
    let mut dispatch = build_dispatch(
        plan,
        plan_set_fingerprint,
        execution_version,
        base_sha,
        prompt_bytes,
    )?;
    dispatch.policy.rung = routed_rung(&route.choice.rung)?;
    dispatch.route = Some(Box::new(route));
    validate_route_choice(&dispatch)?;
    dispatch.id = digest(
        &serde_json::to_vec(&(&dispatch.id, &dispatch.route))
            .map_err(|error| self::error("dispatch-identity", error.to_string()))?,
    );
    Ok(dispatch)
}

fn routed_rung(rung: &str) -> Result<ExecutorRung, PlanError> {
    match rung {
        "low" => Ok(ExecutorRung::Low),
        "medium" => Ok(ExecutorRung::Medium),
        "high" => Ok(ExecutorRung::High),
        "xhigh" => Ok(ExecutorRung::Xhigh),
        "max" => Ok(ExecutorRung::Max),
        _ => Err(error(
            "invalid-route",
            "routed dispatch requires an installed effort rung",
        )),
    }
}

pub fn validate_route_choice(dispatch: &ActiveDispatch) -> Result<(), PlanError> {
    let Some(route) = &dispatch.route else {
        return if dispatch.policy.rung == ExecutorRung::Fixed {
            Ok(())
        } else {
            Err(error(
                "invalid-route",
                "selected dispatch lacks routing evidence",
            ))
        };
    };
    let choice = &route.choice;
    let agent = super::model::roles::agent_for(&choice.role, &choice.rung);
    if choice.role != "cad-executor"
        || agent != Some(choice.agent.as_str())
        || dispatch.policy.rung != routed_rung(&choice.rung)?
        || choice.attempt == 0
        || routed_rung(&choice.starting_rung).is_err()
        || choice
            .model
            .as_deref()
            .is_some_and(|model| !super::model::roles::HOST_MODELS.contains(&model))
        || choice.reasons.is_empty()
        || [&route.inputs.repo]
            .into_iter()
            .chain(route.inputs.global.iter())
            .any(|input| {
                !input.identity.is_absolute()
                    || input.content.as_ref().is_some_and(|content| {
                        content.len() != 64 || !content.bytes().all(|byte| byte.is_ascii_hexdigit())
                    })
            })
    {
        return Err(error(
            "invalid-route",
            "dispatch route does not match its agent, effort or config identity",
        ));
    }
    Ok(())
}
