use std::collections::{BTreeMap, BTreeSet};
use std::fmt;

use serde_json::{Map, Value};

use super::dispatch::full_sha;
use super::model::{
    AppliedReceipt, Blocker, Deviation, EXECUTION_SCHEMA, EvidenceReference, ExecutionOccurrence,
    ExecutionSnapshot, ExecutorPatch, PATCH_SCHEMA, PlanDisposition, PlanOutcome, TaskOutcome,
    TerminalOutcome, VerificationDisposition,
};
use crate::store::model::digest;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PatchError {
    pub code: &'static str,
    pub detail: String,
}

impl PatchError {
    fn new(code: &'static str, detail: impl Into<String>) -> Self {
        Self {
            code,
            detail: detail.into(),
        }
    }
}

impl fmt::Display for PatchError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.code, self.detail)
    }
}

impl std::error::Error for PatchError {}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ApplicationDisposition {
    Applied,
    Replay,
}

#[derive(Clone, Debug, PartialEq)]
pub struct PatchApplication {
    pub data: Value,
    pub disposition: ApplicationDisposition,
    pub transition_id: String,
    pub outcome: PlanOutcome,
}

pub fn parse_executor_patch(value: Value) -> Result<ExecutorPatch, PatchError> {
    serde_json::from_value(value)
        .map_err(|error| PatchError::new("invalid-patch", error.to_string()))
}

pub fn apply_executor_patch(
    data: &Value,
    patch: &ExecutorPatch,
) -> Result<PatchApplication, PatchError> {
    if patch.schema != PATCH_SCHEMA {
        return Err(PatchError::new(
            "unsupported-patch-schema",
            format!("patch schema {} is not supported", patch.schema),
        ));
    }
    let execution_value = data.get("execution").cloned().ok_or_else(|| {
        PatchError::new("missing-execution", "snapshot has no execution namespace")
    })?;
    let execution: ExecutionSnapshot = serde_json::from_value(execution_value)
        .map_err(|error| PatchError::new("invalid-execution", error.to_string()))?;
    if execution.schema != EXECUTION_SCHEMA {
        return Err(PatchError::new(
            "unsupported-execution-schema",
            format!("execution schema {} is not supported", execution.schema),
        ));
    }
    let request_digest = digest(
        &serde_json::to_vec(patch)
            .map_err(|error| PatchError::new("patch-digest", error.to_string()))?,
    );

    for (key, occurrence) in &execution.occurrences {
        if let Some(receipt) = occurrence.receipts.get(&patch.dispatch_id) {
            if receipt.request_digest != request_digest {
                return Err(PatchError::new(
                    "patch-conflict",
                    "dispatch was already answered by different patch content",
                ));
            }
            return Ok(PatchApplication {
                data: data.clone(),
                disposition: ApplicationDisposition::Replay,
                transition_id: receipt.transition_id.clone(),
                outcome: receipt.outcome.clone(),
            });
        }
        if occurrence
            .active
            .as_ref()
            .is_some_and(|active| active.id == patch.dispatch_id)
        {
            return apply_to_occurrence(data, &execution, key, occurrence, patch, request_digest);
        }
    }
    Err(PatchError::new(
        "foreign-dispatch",
        "patch does not name an active or previously applied dispatch",
    ))
}

fn apply_to_occurrence(
    data: &Value,
    execution: &ExecutionSnapshot,
    occurrence_key: &str,
    occurrence: &ExecutionOccurrence,
    patch: &ExecutorPatch,
    request_digest: String,
) -> Result<PatchApplication, PatchError> {
    let active = occurrence
        .active
        .as_ref()
        .ok_or_else(|| PatchError::new("foreign-dispatch", "dispatch is not active"))?;
    if patch.expected_execution_version != active.expected_execution_version
        || patch.expected_execution_version != occurrence.version
    {
        return Err(PatchError::new(
            "stale-execution",
            format!(
                "patch expected execution version {}, current version is {}",
                patch.expected_execution_version, occurrence.version
            ),
        ));
    }
    validate_judgments(&patch.deviations, &patch.blockers)?;
    validate_tasks(active, patch)?;
    let transition_id = digest(
        &serde_json::to_vec(&("executor-patch", &active.id, &request_digest))
            .map_err(|error| PatchError::new("transition-digest", error.to_string()))?,
    );
    let outcome = PlanOutcome {
        dispatch_id: active.id.clone(),
        phase: active.phase,
        plan: active.plan,
        disposition: patch.outcome,
        tasks: patch.tasks.clone(),
        deviations: patch.deviations.clone(),
        blockers: patch.blockers.clone(),
        commit_paths: BTreeMap::new(),
        transition_id: transition_id.clone(),
    };
    let receipt = AppliedReceipt {
        dispatch_id: active.id.clone(),
        request_digest,
        transition_id: transition_id.clone(),
        outcome: outcome.clone(),
    };
    let mut next_occurrence = occurrence.clone();
    next_occurrence.version = next_occurrence.version.checked_add(1).ok_or_else(|| {
        PatchError::new(
            "execution-version",
            "execution version cannot be incremented",
        )
    })?;
    next_occurrence.receipts.insert(active.id.clone(), receipt);
    match patch.outcome {
        PlanDisposition::Complete => {
            next_occurrence.active = None;
            next_occurrence.plans.push(outcome.clone());
        }
        PlanDisposition::Blocked => {
            next_occurrence.terminal = Some(TerminalOutcome::JudgmentStop {
                dispatch_id: active.id.clone(),
                blocker_ids: patch
                    .blockers
                    .iter()
                    .map(|blocker| blocker.id.clone())
                    .collect(),
            });
        }
    }
    let mut next_execution = execution.clone();
    next_execution
        .occurrences
        .insert(occurrence_key.to_owned(), next_occurrence);
    let mut next_data = object(data, "snapshot data")?.clone();
    next_data.insert(
        "execution".into(),
        serde_json::to_value(next_execution)
            .map_err(|error| PatchError::new("execution-encode", error.to_string()))?,
    );
    Ok(PatchApplication {
        data: Value::Object(next_data),
        disposition: ApplicationDisposition::Applied,
        transition_id,
        outcome,
    })
}

/// Binds paths observed from Git to the otherwise executor-authored outcome.
/// The executor cannot assert this field; only the binary's apply boundary can
/// attach it after resolving every commit.
pub fn attach_commit_paths(
    mut application: PatchApplication,
    commit_paths: &BTreeMap<String, Vec<String>>,
) -> Result<PatchApplication, PatchError> {
    let expected = application
        .outcome
        .tasks
        .iter()
        .filter_map(|task| match task {
            TaskOutcome::Completed { commit, .. } => Some(commit.clone()),
            TaskOutcome::Blocked { .. } | TaskOutcome::NotRun { .. } => None,
        })
        .collect::<BTreeSet<_>>();
    if expected != commit_paths.keys().cloned().collect() {
        return Err(PatchError::new(
            "commit-path-set",
            "observed paths must name exactly the completed task commits",
        ));
    }
    for paths in commit_paths.values() {
        if paths.iter().collect::<BTreeSet<_>>().len() != paths.len()
            || paths.windows(2).any(|pair| pair[0] > pair[1])
            || paths.iter().any(|path| !safe_relative_path(path))
        {
            return Err(PatchError::new(
                "commit-path-set",
                "observed commit paths must be unique sorted relative paths",
            ));
        }
    }
    if application.disposition == ApplicationDisposition::Replay {
        if &application.outcome.commit_paths != commit_paths {
            return Err(PatchError::new(
                "commit-path-conflict",
                "replayed Git observations differ from the durable receipt",
            ));
        }
        return Ok(application);
    }

    application.outcome.commit_paths = commit_paths.clone();
    let mut execution: ExecutionSnapshot = serde_json::from_value(
        application
            .data
            .get("execution")
            .cloned()
            .ok_or_else(|| PatchError::new("missing-execution", "snapshot lost execution"))?,
    )
    .map_err(|error| PatchError::new("invalid-execution", error.to_string()))?;
    let occurrence = execution
        .occurrences
        .values_mut()
        .find(|occurrence| {
            occurrence
                .receipts
                .contains_key(&application.outcome.dispatch_id)
        })
        .ok_or_else(|| PatchError::new("missing-receipt", "applied receipt is absent"))?;
    let receipt = occurrence
        .receipts
        .get_mut(&application.outcome.dispatch_id)
        .expect("selected occurrence contains the receipt");
    receipt.outcome.commit_paths = commit_paths.clone();
    if let Some(outcome) = occurrence
        .plans
        .iter_mut()
        .find(|outcome| outcome.dispatch_id == application.outcome.dispatch_id)
    {
        outcome.commit_paths = commit_paths.clone();
    }
    let object = application
        .data
        .as_object_mut()
        .ok_or_else(|| PatchError::new("invalid-snapshot", "snapshot data must be an object"))?;
    object.insert(
        "execution".into(),
        serde_json::to_value(execution)
            .map_err(|error| PatchError::new("execution-encode", error.to_string()))?,
    );
    Ok(application)
}

fn validate_tasks(
    active: &super::model::ActiveDispatch,
    patch: &ExecutorPatch,
) -> Result<(), PatchError> {
    if patch.tasks.len() != active.tasks.len() {
        return Err(PatchError::new(
            "task-set",
            "patch must contain exactly one row for every dispatched task",
        ));
    }
    let mut seen = BTreeSet::new();
    let blocker_ids = patch
        .blockers
        .iter()
        .map(|value| value.id.as_str())
        .collect::<BTreeSet<_>>();
    let mut blocked_at = None;
    for (index, (row, expected)) in patch.tasks.iter().zip(&active.tasks).enumerate() {
        if row.task_id() != expected.id {
            return Err(PatchError::new(
                "task-order",
                format!("task row {index} must name {}", expected.id),
            ));
        }
        if !seen.insert(row.task_id()) {
            return Err(PatchError::new(
                "duplicate-task",
                "task rows must be unique",
            ));
        }
        match row {
            TaskOutcome::Completed {
                commit,
                verification,
                evidence,
                ..
            } => {
                if blocked_at.is_some() {
                    return Err(PatchError::new(
                        "blocked-prefix",
                        "tasks after the first blocker must be not-run",
                    ));
                }
                if !full_sha(commit) {
                    return Err(PatchError::new(
                        "invalid-commit",
                        "completed task commit must be a full SHA",
                    ));
                }
                if verification.disposition != VerificationDisposition::Passed
                    || verification.commands.len() != expected.verify.len()
                {
                    return Err(PatchError::new(
                        "verification",
                        "completed task must carry passed receipts for every dispatched command",
                    ));
                }
                for (receipt, command) in verification.commands.iter().zip(&expected.verify) {
                    if &receipt.command != command
                        || receipt.exit_code != 0
                        || !digest_value(&receipt.output_digest)
                    {
                        return Err(PatchError::new(
                            "verification",
                            "verification command, exit status or output digest is invalid",
                        ));
                    }
                }
                if evidence.is_empty() {
                    return Err(PatchError::new(
                        "missing-evidence",
                        "completed task requires at least one evidence reference",
                    ));
                }
                validate_evidence(evidence)?;
            }
            TaskOutcome::Blocked { blocker_id, .. } => {
                if blocked_at.replace(index).is_some() || !blocker_ids.contains(blocker_id.as_str())
                {
                    return Err(PatchError::new(
                        "blocker-reference",
                        "blocked row must uniquely reference a declared blocker",
                    ));
                }
            }
            TaskOutcome::NotRun { .. } => {
                if blocked_at.is_none() {
                    return Err(PatchError::new(
                        "blocked-prefix",
                        "not-run is valid only after a blocked row",
                    ));
                }
            }
        }
    }
    match patch.outcome {
        PlanDisposition::Complete if blocked_at.is_some() || !patch.blockers.is_empty() => {
            Err(PatchError::new(
                "outcome-mismatch",
                "complete plan cannot contain blocked or not-run rows",
            ))
        }
        PlanDisposition::Blocked if blocked_at.is_none() || patch.blockers.len() != 1 => {
            Err(PatchError::new(
                "outcome-mismatch",
                "blocked plan requires exactly one blocked row and blocker",
            ))
        }
        _ => Ok(()),
    }
}

fn validate_judgments(deviations: &[Deviation], blockers: &[Blocker]) -> Result<(), PatchError> {
    let mut ids = BTreeSet::new();
    for (kind, id, text, evidence) in deviations
        .iter()
        .map(|value| ("deviation", &value.id, &value.text, &value.evidence))
        .chain(
            blockers
                .iter()
                .map(|value| ("blocker", &value.id, &value.text, &value.evidence)),
        )
    {
        if !stable_id(id) || !ids.insert(id) {
            return Err(PatchError::new(
                "judgment-id",
                format!("{kind} IDs must be stable and unique"),
            ));
        }
        if text.trim().is_empty() {
            return Err(PatchError::new(
                "judgment-text",
                format!("{kind} judgment text must not be blank"),
            ));
        }
        if evidence.is_empty() {
            return Err(PatchError::new(
                "judgment-evidence",
                format!("{kind} requires typed evidence"),
            ));
        }
        validate_evidence(evidence)?;
    }
    Ok(())
}

fn validate_evidence(values: &[EvidenceReference]) -> Result<(), PatchError> {
    for value in values {
        let valid = match value {
            EvidenceReference::Commit { sha } => full_sha(sha),
            EvidenceReference::FileLine { path, line } => *line > 0 && safe_relative_path(path),
            EvidenceReference::Criterion { id } => stable_id(id),
        };
        if !valid {
            return Err(PatchError::new(
                "unsupported-evidence",
                "evidence reference has an invalid typed value",
            ));
        }
    }
    Ok(())
}

fn stable_id(value: &str) -> bool {
    let mut chars = value.chars();
    chars.next().is_some_and(|ch| ch.is_ascii_alphanumeric())
        && chars.all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
}

fn safe_relative_path(value: &str) -> bool {
    !value.is_empty()
        && !value.starts_with('/')
        && !value.contains('\\')
        && !value
            .split('/')
            .any(|part| part.is_empty() || matches!(part, "." | ".."))
}

fn digest_value(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn object<'a>(value: &'a Value, name: &str) -> Result<&'a Map<String, Value>, PatchError> {
    value
        .as_object()
        .ok_or_else(|| PatchError::new("invalid-snapshot", format!("{name} must be an object")))
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use serde_json::json;

    use super::*;
    use crate::execution::dispatch::{admit_dispatch, build_dispatch};
    use crate::execution::model::{
        CommandReceipt, EvidenceReference, ExecutionOccurrence, ExecutionSnapshot, PatchKind,
        VerificationReceipt,
    };
    use crate::execution::plan::{parse_plan, plan_set_fingerprint};

    const BASE: &str = "1111111111111111111111111111111111111111";
    const COMMIT: &str = "2222222222222222222222222222222222222222";
    const OUTPUT: &str = "3333333333333333333333333333333333333333333333333333333333333333";

    fn plan() -> crate::execution::model::ExecutionPlan {
        let bytes = b"---\nphase: 6\nplan: 1\nrequirements: [AC4]\nfiles: [src/lib.rs]\nexecution:\n  schema: 1\n  suite: cargo test\n  tasks:\n    - id: T1\n      verify: [cargo test one]\n    - id: T2\n      verify: [cargo test two]\n---\nBuild it.\n";
        parse_plan(bytes, 6, 1).unwrap()
    }

    fn fixture() -> (Value, super::super::model::ActiveDispatch) {
        let plan = plan();
        let set = plan_set_fingerprint(std::slice::from_ref(&plan)).unwrap();
        let candidate = build_dispatch(&plan, &set, 0, BASE, 100).unwrap();
        let occurrence = ExecutionOccurrence {
            phase: 6,
            plan_set_fingerprint: set,
            version: 0,
            active: None,
            plans: Vec::new(),
            terminal: None,
            receipts: BTreeMap::new(),
        };
        let (occurrence, dispatch) = admit_dispatch(&occurrence, candidate).unwrap();
        let execution = ExecutionSnapshot {
            schema: EXECUTION_SCHEMA,
            occurrences: BTreeMap::from([("6".into(), occurrence)]),
        };
        (
            json!({
                "execution": execution,
                "lifecycle": {"status":"planned", "nested":[1,2,3]},
                "evidence": [{"id":"seed"}],
                "arbitrary": {"preserve":true}
            }),
            dispatch,
        )
    }

    fn receipt(command: &str) -> VerificationReceipt {
        VerificationReceipt {
            disposition: VerificationDisposition::Passed,
            commands: vec![CommandReceipt {
                command: command.into(),
                exit_code: 0,
                output_digest: OUTPUT.into(),
            }],
        }
    }

    fn completed(task_id: &str, command: &str, commit: &str) -> TaskOutcome {
        TaskOutcome::Completed {
            task_id: task_id.into(),
            commit: commit.into(),
            verification: receipt(command),
            evidence: vec![EvidenceReference::Commit { sha: commit.into() }],
        }
    }

    fn complete_patch(dispatch: &super::super::model::ActiveDispatch) -> ExecutorPatch {
        ExecutorPatch {
            schema: PATCH_SCHEMA,
            kind: PatchKind::Executor,
            dispatch_id: dispatch.id.clone(),
            expected_execution_version: dispatch.expected_execution_version,
            outcome: PlanDisposition::Complete,
            tasks: vec![
                completed("T1", "cargo test one", COMMIT),
                completed(
                    "T2",
                    "cargo test two",
                    "4444444444444444444444444444444444444444",
                ),
            ],
            deviations: Vec::new(),
            blockers: Vec::new(),
        }
    }

    #[test]
    fn dispatch_is_content_derived_and_only_one_can_be_active() {
        let plan = plan();
        let set = plan_set_fingerprint(std::slice::from_ref(&plan)).unwrap();
        let first = build_dispatch(&plan, &set, 0, BASE, 100).unwrap();
        let second = build_dispatch(&plan, &set, 0, BASE, 200).unwrap();
        assert_eq!(first.id, second.id);
        let occurrence = ExecutionOccurrence {
            phase: 6,
            plan_set_fingerprint: set,
            version: 0,
            active: None,
            plans: vec![],
            terminal: None,
            receipts: BTreeMap::new(),
        };
        let (admitted, active) = admit_dispatch(&occurrence, first).unwrap();
        assert_eq!(active.expected_execution_version, 1);
        assert_eq!(admitted.active.as_ref(), Some(&active));
        let mut foreign = second;
        foreign.plan = 2;
        assert_eq!(
            admit_dispatch(&admitted, foreign).unwrap_err().code,
            "dispatch-conflict"
        );
    }

    #[test]
    fn complete_patch_preserves_every_unrelated_json_value() {
        let (data, dispatch) = fixture();
        let before = data.clone();
        let applied = apply_executor_patch(&data, &complete_patch(&dispatch)).unwrap();
        assert_eq!(applied.disposition, ApplicationDisposition::Applied);
        for key in ["lifecycle", "evidence", "arbitrary"] {
            assert_eq!(applied.data.get(key), before.get(key));
        }
        let execution: ExecutionSnapshot =
            serde_json::from_value(applied.data["execution"].clone()).unwrap();
        let occurrence = &execution.occurrences["6"];
        assert!(occurrence.active.is_none());
        assert_eq!(occurrence.plans.len(), 1);
        assert_eq!(occurrence.version, 2);
    }

    #[test]
    fn completed_blocked_and_not_run_rows_form_one_prefix() {
        let (data, dispatch) = fixture();
        let blocker = Blocker {
            id: "B1".into(),
            text: "operator decision required".into(),
            evidence: vec![EvidenceReference::Criterion { id: "AC4".into() }],
        };
        let patch = ExecutorPatch {
            schema: PATCH_SCHEMA,
            kind: PatchKind::Executor,
            dispatch_id: dispatch.id.clone(),
            expected_execution_version: dispatch.expected_execution_version,
            outcome: PlanDisposition::Blocked,
            tasks: vec![
                TaskOutcome::Blocked {
                    task_id: "T1".into(),
                    blocker_id: "B1".into(),
                },
                TaskOutcome::NotRun {
                    task_id: "T2".into(),
                },
            ],
            deviations: vec![],
            blockers: vec![blocker],
        };
        let applied = apply_executor_patch(&data, &patch).unwrap();
        let execution: ExecutionSnapshot =
            serde_json::from_value(applied.data["execution"].clone()).unwrap();
        let occurrence = &execution.occurrences["6"];
        assert!(occurrence.active.is_some());
        assert!(occurrence.plans.is_empty());
        assert!(matches!(
            occurrence.terminal,
            Some(TerminalOutcome::JudgmentStop { .. })
        ));
    }

    #[test]
    fn pairwise_invalid_task_field_combinations_are_rejected_by_schema() {
        let (_, dispatch) = fixture();
        let base = serde_json::to_value(complete_patch(&dispatch)).unwrap();
        let mut cases = Vec::new();
        for (field, value) in [("blocker_id", json!("B1")), ("unexpected", json!(true))] {
            let mut case = base.clone();
            case["tasks"][0][field] = value;
            cases.push(case);
        }
        let mut blocked = json!({"status":"blocked","task_id":"T1","blocker_id":"B1"});
        blocked["commit"] = json!(COMMIT);
        let mut not_run = json!({"status":"not-run","task_id":"T2"});
        not_run["verification"] = serde_json::to_value(receipt("cargo test two")).unwrap();
        cases.extend([blocked, not_run].into_iter().map(|row| {
            let mut case = base.clone();
            case["tasks"][0] = row;
            case
        }));
        for case in cases {
            assert_eq!(
                parse_executor_patch(case).unwrap_err().code,
                "invalid-patch"
            );
        }
    }

    #[test]
    fn exact_task_set_and_order_are_enforced() {
        let (data, dispatch) = fixture();
        let mut missing = complete_patch(&dispatch);
        missing.tasks.pop();
        assert_eq!(
            apply_executor_patch(&data, &missing).unwrap_err().code,
            "task-set"
        );
        let mut extra = complete_patch(&dispatch);
        extra
            .tasks
            .push(completed("T3", "cargo test three", COMMIT));
        assert_eq!(
            apply_executor_patch(&data, &extra).unwrap_err().code,
            "task-set"
        );
        let mut reordered = complete_patch(&dispatch);
        reordered.tasks.swap(0, 1);
        assert_eq!(
            apply_executor_patch(&data, &reordered).unwrap_err().code,
            "task-order"
        );
        let mut duplicate = complete_patch(&dispatch);
        duplicate.tasks[1] = duplicate.tasks[0].clone();
        assert_eq!(
            apply_executor_patch(&data, &duplicate).unwrap_err().code,
            "task-order"
        );
    }

    #[test]
    fn foreign_and_stale_dispatch_identity_are_rejected() {
        let (data, dispatch) = fixture();
        let mut foreign = complete_patch(&dispatch);
        foreign.dispatch_id = "f".repeat(64);
        assert_eq!(
            apply_executor_patch(&data, &foreign).unwrap_err().code,
            "foreign-dispatch"
        );
        let mut stale = complete_patch(&dispatch);
        stale.expected_execution_version -= 1;
        assert_eq!(
            apply_executor_patch(&data, &stale).unwrap_err().code,
            "stale-execution"
        );
    }

    #[test]
    fn evidence_forms_are_typed_and_validated() {
        let (data, dispatch) = fixture();
        for evidence in [
            EvidenceReference::Commit { sha: COMMIT.into() },
            EvidenceReference::FileLine {
                path: "src/lib.rs".into(),
                line: 4,
            },
            EvidenceReference::Criterion { id: "AC4".into() },
        ] {
            let mut patch = complete_patch(&dispatch);
            if let TaskOutcome::Completed {
                evidence: target, ..
            } = &mut patch.tasks[0]
            {
                *target = vec![evidence];
            }
            apply_executor_patch(&data, &patch).unwrap();
        }
        let mut bad = serde_json::to_value(complete_patch(&dispatch)).unwrap();
        bad["tasks"][0]["evidence"] = json!([{"kind":"model-prose","text":"trust me"}]);
        assert_eq!(parse_executor_patch(bad).unwrap_err().code, "invalid-patch");
    }

    #[test]
    fn completed_rows_require_full_sha_passed_verification_and_evidence() {
        let (data, dispatch) = fixture();
        let mut short = complete_patch(&dispatch);
        if let TaskOutcome::Completed { commit, .. } = &mut short.tasks[0] {
            *commit = "abc".into();
        }
        assert_eq!(
            apply_executor_patch(&data, &short).unwrap_err().code,
            "invalid-commit"
        );
        let mut failed = complete_patch(&dispatch);
        if let TaskOutcome::Completed { verification, .. } = &mut failed.tasks[0] {
            verification.disposition = VerificationDisposition::Failed;
        }
        assert_eq!(
            apply_executor_patch(&data, &failed).unwrap_err().code,
            "verification"
        );
        let mut no_evidence = complete_patch(&dispatch);
        if let TaskOutcome::Completed { evidence, .. } = &mut no_evidence.tasks[0] {
            evidence.clear();
        }
        assert_eq!(
            apply_executor_patch(&data, &no_evidence).unwrap_err().code,
            "missing-evidence"
        );
    }

    #[test]
    fn blocking_requires_reference_then_explicit_not_run_rows() {
        let (data, dispatch) = fixture();
        let mut patch = complete_patch(&dispatch);
        patch.outcome = PlanDisposition::Blocked;
        patch.tasks[0] = TaskOutcome::NotRun {
            task_id: "T1".into(),
        };
        assert_eq!(
            apply_executor_patch(&data, &patch).unwrap_err().code,
            "blocked-prefix"
        );
        patch.tasks[0] = TaskOutcome::Blocked {
            task_id: "T1".into(),
            blocker_id: "missing".into(),
        };
        patch.tasks[1] = completed("T2", "cargo test two", COMMIT);
        assert_eq!(
            apply_executor_patch(&data, &patch).unwrap_err().code,
            "blocker-reference"
        );
    }

    #[test]
    fn judgment_ids_text_and_evidence_are_required() {
        let (data, dispatch) = fixture();
        let mut patch = complete_patch(&dispatch);
        patch.deviations = vec![Deviation {
            id: "D1".into(),
            text: "observed mismatch".into(),
            evidence: vec![EvidenceReference::Criterion { id: "AC4".into() }],
        }];
        apply_executor_patch(&data, &patch).unwrap();
        for mutation in ["blank-id", "blank-text", "empty-evidence", "duplicate-id"] {
            let mut invalid = patch.clone();
            match mutation {
                "blank-id" => invalid.deviations[0].id = " ".into(),
                "blank-text" => invalid.deviations[0].text = " ".into(),
                "empty-evidence" => invalid.deviations[0].evidence.clear(),
                _ => invalid.deviations.push(invalid.deviations[0].clone()),
            }
            assert!(
                apply_executor_patch(&data, &invalid).is_err(),
                "accepted {mutation}"
            );
        }
    }

    #[test]
    fn complete_outcome_rejects_blocked_and_not_run_rows() {
        let (data, dispatch) = fixture();
        let mut patch = complete_patch(&dispatch);
        patch.tasks[0] = TaskOutcome::Blocked {
            task_id: "T1".into(),
            blocker_id: "B1".into(),
        };
        patch.tasks[1] = TaskOutcome::NotRun {
            task_id: "T2".into(),
        };
        patch.blockers = vec![Blocker {
            id: "B1".into(),
            text: "stop".into(),
            evidence: vec![EvidenceReference::Criterion { id: "AC4".into() }],
        }];
        assert_eq!(
            apply_executor_patch(&data, &patch).unwrap_err().code,
            "outcome-mismatch"
        );
    }

    #[test]
    fn every_top_level_patch_key_is_required_and_unknown_keys_refuse() {
        let (_, dispatch) = fixture();
        let value = serde_json::to_value(complete_patch(&dispatch)).unwrap();
        for key in [
            "schema",
            "kind",
            "dispatch_id",
            "expected_execution_version",
            "outcome",
            "tasks",
            "deviations",
            "blockers",
        ] {
            let mut missing = value.clone();
            missing.as_object_mut().unwrap().remove(key);
            assert_eq!(
                parse_executor_patch(missing).unwrap_err().code,
                "invalid-patch",
                "accepted missing {key}"
            );
        }
        let mut added = value;
        added["state"] = json!({"replace":"everything"});
        assert_eq!(
            parse_executor_patch(added).unwrap_err().code,
            "invalid-patch"
        );
    }

    #[test]
    fn replay_has_same_transition_identity_and_changed_content_conflicts() {
        let (data, dispatch) = fixture();
        let patch = complete_patch(&dispatch);
        let first = apply_executor_patch(&data, &patch).unwrap();
        let replay = apply_executor_patch(&first.data, &patch).unwrap();
        assert_eq!(replay.disposition, ApplicationDisposition::Replay);
        assert_eq!(replay.transition_id, first.transition_id);
        assert_eq!(replay.data, first.data);

        let mut changed = patch;
        changed.deviations.push(Deviation {
            id: "D1".into(),
            text: "different content".into(),
            evidence: vec![EvidenceReference::Criterion { id: "AC4".into() }],
        });
        assert_eq!(
            apply_executor_patch(&first.data, &changed)
                .unwrap_err()
                .code,
            "patch-conflict"
        );
    }

    #[test]
    fn arbitrary_lifecycle_and_summary_patch_fields_never_parse() {
        let (_, dispatch) = fixture();
        for key in ["lifecycle", "summary", "state", "phase", "plan"] {
            let mut value = serde_json::to_value(complete_patch(&dispatch)).unwrap();
            value[key] = json!("invented");
            assert_eq!(
                parse_executor_patch(value).unwrap_err().code,
                "invalid-patch"
            );
        }
    }
}
