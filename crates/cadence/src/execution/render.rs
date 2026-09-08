use super::model::ActiveDispatch;
use serde_json::{Value, json};
use std::fmt::Write;

use super::model::{
    EvidenceReference, ExecutionSnapshot, PlanOutcome, TaskOutcome, TerminalOutcome,
    VerificationDisposition,
};
use crate::store::{Error, Result};

pub const SUMMARY_RENDER_VERSION: u32 = 1;

pub fn render_phase_summary(execution: &ExecutionSnapshot, phase: u32) -> Result<Vec<u8>> {
    if phase == 0 || execution.schema != super::model::EXECUTION_SCHEMA {
        return Err(Error::Invalid("invalid execution summary identity".into()));
    }
    let occurrence = execution
        .occurrences
        .get(&phase.to_string())
        .ok_or_else(|| Error::Invalid("execution summary phase is absent".into()))?;
    if occurrence.phase != phase {
        return Err(Error::Invalid("execution summary phase mismatch".into()));
    }
    let status = match occurrence.terminal {
        Some(TerminalOutcome::Complete { .. }) => "complete",
        Some(TerminalOutcome::JudgmentStop { .. }) => "blocked",
        None => "executing",
    };
    let mut outcomes = occurrence.plans.iter().collect::<Vec<_>>();
    if let Some(TerminalOutcome::JudgmentStop { dispatch_id, .. }) = &occurrence.terminal
        && let Some(receipt) = occurrence.receipts.get(dispatch_id)
        && !outcomes
            .iter()
            .any(|outcome| outcome.dispatch_id == *dispatch_id)
    {
        outcomes.push(&receipt.outcome);
    }
    outcomes.sort_by_key(|outcome| outcome.plan);

    let mut rendered = String::new();
    writeln!(rendered, "# Phase {phase} Execution Summary").unwrap();
    writeln!(rendered).unwrap();
    writeln!(rendered, "Schema: {SUMMARY_RENDER_VERSION}").unwrap();
    writeln!(rendered, "Status: {status}").unwrap();
    writeln!(rendered).unwrap();
    writeln!(rendered, "| Plan | Task | Status | Commit | Verification |").unwrap();
    writeln!(rendered, "|---|---|---|---|---|").unwrap();
    for outcome in &outcomes {
        render_tasks(&mut rendered, outcome);
    }
    writeln!(rendered).unwrap();
    writeln!(
        rendered,
        "Deviation references: {}",
        judgment_ids(&outcomes, true)
    )
    .unwrap();
    writeln!(
        rendered,
        "Blocker references: {}",
        judgment_ids(&outcomes, false)
    )
    .unwrap();
    Ok(rendered.into_bytes())
}

fn render_tasks(rendered: &mut String, outcome: &PlanOutcome) {
    for task in &outcome.tasks {
        let (id, status, commit, verification) = match task {
            TaskOutcome::Completed {
                task_id,
                commit,
                verification,
                evidence,
            } => (
                task_id.as_str(),
                "completed",
                commit.as_str(),
                match verification.disposition {
                    VerificationDisposition::Passed if evidence.iter().all(valid_evidence) => {
                        "passed"
                    }
                    VerificationDisposition::Passed => "invalid-evidence",
                    VerificationDisposition::Failed => "failed",
                },
            ),
            TaskOutcome::Blocked { task_id, .. } => (task_id.as_str(), "blocked", "", "not-passed"),
            TaskOutcome::NotRun { task_id } => (task_id.as_str(), "not-run", "", "not-run"),
        };
        writeln!(
            rendered,
            "| {} | {} | {status} | {commit} | {verification} |",
            outcome.plan, id
        )
        .unwrap();
    }
}

fn valid_evidence(value: &EvidenceReference) -> bool {
    match value {
        EvidenceReference::Commit { sha } => sha.len() == 40,
        EvidenceReference::FileLine { path, line } => !path.is_empty() && *line > 0,
        EvidenceReference::Criterion { id } => !id.is_empty(),
    }
}

fn judgment_ids(outcomes: &[&PlanOutcome], deviations: bool) -> String {
    let values = outcomes
        .iter()
        .flat_map(|outcome| {
            if deviations {
                outcome
                    .deviations
                    .iter()
                    .map(|value| value.id.as_str())
                    .collect::<Vec<_>>()
            } else {
                outcome
                    .blockers
                    .iter()
                    .map(|value| value.id.as_str())
                    .collect::<Vec<_>>()
            }
        })
        .collect::<Vec<_>>();
    if values.is_empty() {
        "none".into()
    } else {
        values.join(", ")
    }
}

pub fn render_dispatch_prompt(
    dispatch: &ActiveDispatch,
    patch_schema: &Value,
    lease_instructions: bool,
) -> String {
    let guidance = if lease_instructions {
        "\nThe lease has zero exemptions: all reported commit paths and the whole staged set must be covered by files or directories, including both rename endpoints, new files, lockfiles and reports. A repairable mistake within this lease is not a blocker; correct it and rerun the required verification. If an undeclared-files refusal occurs, stop execution, preserve the rejected SHAs and request operator-controlled repair. Cadence leaves Git and the index untouched and the dispatch open. Do not push, reset, amend, revert or force-push automatically. After operator repair, resubmit a corrected full patch with the same dispatch ID and execution version, within the unchanged lease and plan fingerprint. An undeclared necessary file requires an operator planning correction; changing the lease or body cannot repair this active dispatch."
    } else {
        ""
    };
    let operational = prompt_operational(dispatch);
    format!(
        "Cadence native execution dispatch\n\nOperational input:\n{}\n\nExecutor patch schema:\n{}\n\nInstructions:\nComplete tasks in listed order. Use one distinct signed commit per completed task. Run each task's exact verification commands and the suite. Return exactly one executor patch matching this schema. Stop at the first blocker and mark all later tasks not-run.{}\n\nOpaque plan body ({} UTF-8 bytes):\n{}",
        serde_json::to_string_pretty(&operational).expect("operational fields serialize"),
        serde_json::to_string_pretty(patch_schema).expect("patch schema serializes"),
        guidance,
        dispatch.body.len(),
        dispatch.body,
    )
}

pub fn prompt_operational(dispatch: &ActiveDispatch) -> Value {
    let mut operational = json!({
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
    if !dispatch.directories.is_empty() {
        operational["directories"] = json!(dispatch.directories);
    }
    if let Some(route) = &dispatch.route {
        operational["route"] = json!(route);
    }
    operational
}
