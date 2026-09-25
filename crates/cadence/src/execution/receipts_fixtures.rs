//! Values the receipts checks are built from.
//!
//! Every builder here makes a record, a close request or a repository fact by
//! hand. Nothing in this file opens a store, starts a program or fakes one:
//! the units these fixtures serve judge values, so the checks over them are
//! comparisons.
#![allow(dead_code)]
use super::{
    allocation::Check,
    history::{Event, Record, Request, Task},
    receipts::{
        Capture, Close, Disposition, Launch, Material, Observation, Pair, RepositoryFacts,
        RunResult, Stage, Summary,
    },
};
use serde_json::{Value, json};

pub(super) const RED: &str = "1111111111111111111111111111111111111111";
pub(super) const GREEN: &str = "2222222222222222222222222222222222222222";
pub(super) const DONE: &str = "3333333333333333333333333333333333333333";
pub(super) const TEST_FILE: &str = "crates/cadence/src/delivery.rs";
pub(super) const TEST_DIGEST: &str = "digest-of-the-test";
pub(super) const RED_TREE: &str = "tree-at-red";
pub(super) const GREEN_TREE: &str = "tree-at-green";
pub(super) const COMMAND: &str = "cargo nextest run delivery";

pub(super) fn check(id: &str) -> Check {
    Check { id: id.into(), item_revision: "revision-1".into() }
}

pub(super) fn task() -> Task {
    Task {
        phase: 12,
        occurrence: "active-cycle:phase:12".into(),
        admission_digest: "admitted".into(),
        plan: 1,
        task: "deliver".into(),
    }
}

/// The admitted allocation the validator reads through `allocated`, written
/// as the value it is rather than replayed through the admission pipeline.
pub(super) fn allocating(checks: &[&str]) -> Value {
    let checks: Vec<_> = checks.iter().map(|id| json!(check(id))).collect();
    json!({"native_admissions":{"schema":"native-admissions-1","phases":{"12":[{
        "schema":"native-admission-1","root_binding":"binding","set_version":0,
        "request_digest":"admitted","request":{"request_id":"admit","expected_set_version":0,
        "contract":{"phase":12,"occurrence":"active-cycle:phase:12","plans":[],
        "allocation":[{"plan":1,"task":"deliver","checks":checks}]}}}]}}})
}

pub(super) fn material(commit: &str, tree: &str) -> Material {
    Material {
        commit: commit.into(),
        tree: tree.into(),
        test_file: TEST_FILE.into(),
        test_digest: TEST_DIGEST.into(),
        command: COMMAND.into(),
    }
}

pub(super) fn record(attempt: &str, id: &str, event: Event) -> Record {
    Record {
        schema: "native-task-1".into(),
        root_binding: "binding".into(),
        version: 0,
        request_digest: format!("digest-{id}"),
        request: Request {
            request_id: id.into(),
            task: task(),
            attempt: attempt.into(),
            expected_version: 0,
            event,
        },
    }
}

pub(super) fn launch(attempt: &str, run: &str, id: &str, stage: Stage, commit: &str, tree: &str, at: u64) -> Record {
    record(attempt, run, Event::Launch(Launch {
        run_id: run.into(),
        check: Some(check(id)),
        stage,
        material: material(commit, tree),
        launched_at: at,
    }))
}

pub(super) fn result(attempt: &str, run: &str, code: i32, at: u64) -> Record {
    record(attempt, &format!("{run}-result"), Event::Result(RunResult {
        run_id: run.into(),
        disposition: Disposition::Exited { code },
        stdout: Capture::new(Vec::new(), true, Vec::new()),
        stderr: Capture::new(Vec::new(), true, Vec::new()),
        observed_at: at,
        observation: Observation::ResultsObserved { summary: Summary::Cargo { failed: code != 0 } },
        material_unchanged: true,
    }))
}

/// One check delivered honestly: a red run that failed, then a green run that
/// passed, at the same committed test material.
pub(super) fn honest_records(id: &str) -> Vec<Record> {
    let red = format!("red-{id}");
    let green = format!("green-{id}");
    vec![
        record("attempt", &format!("start-{id}"), Event::Attempt {
            predecessor: None,
            checks: vec![check(id)],
            base_commit: RED.into(),
        }),
        launch("attempt", &red, id, Stage::Red, RED, RED_TREE, 10),
        result("attempt", &red, 1, 20),
        launch("attempt", &green, id, Stage::Green, GREEN, GREEN_TREE, 30),
        result("attempt", &green, 0, 40),
    ]
}

pub(super) fn pair(id: &str) -> Pair {
    Pair {
        check: check(id),
        red_commit: RED.into(),
        green_commit: GREEN.into(),
        red_run: format!("red-{id}"),
        green_run: format!("green-{id}"),
    }
}

pub(super) fn close(pairs: Vec<Pair>) -> Close {
    Close {
        request_id: "close".into(),
        task: task(),
        attempt: "attempt".into(),
        expected_version: 0,
        completion: DONE.into(),
        checks: pairs,
        verification: Vec::new(),
    }
}

/// Everything Git would have answered for an honest delivery.
pub(super) fn honest_facts() -> RepositoryFacts {
    RepositoryFacts::new()
        .ancestor(RED, GREEN)
        .ancestor(GREEN, DONE)
        .blob(RED, TEST_FILE, TEST_DIGEST)
        .blob(GREEN, TEST_FILE, TEST_DIGEST)
        .blob(DONE, TEST_FILE, TEST_DIGEST)
        .tree(RED, RED_TREE)
        .tree(GREEN, GREEN_TREE)
}

