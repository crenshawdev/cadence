---
phase: 38
plan: 2
requirements: ["T1","T2","T3"]
files: ["crates/cadence/src/execution/history.rs","crates/cadence/src/execution/runner.rs","crates/cadence/src/execution/instructions.rs","crates/cadence/src/execution/tests.rs","crates/cadence/src/execution_service.rs","crates/cadence/src/execution_service_tests.rs","crates/cadence/src/execution_runner_service.rs","crates/cadence/src/server.rs","crates/cadence/src/next_action/continuation.rs","crates/cadence/src/next_action_service_tests.rs","crates/cadence/src/verification/inputs.rs","crates/cadence/src/verification/completion.rs","docs/architecture/acceptance.md","crates/cadence/tests/phase12_execution.rs","crates/cadence/tests/phase38_suite_gate.rs"]
directories: []
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P38-2-T1","verify":["cargo test -p cadence --test phase38_suite_gate phase38_first_red_raises_plan_repair_question -- --exact","cargo test -p cadence --test phase38_suite_gate phase38_approved_plan_repair_accepts_one_second_launch -- --exact","cargo test -p cadence --test phase38_suite_gate phase38_second_red_blocks_and_refuses_third_launch -- --exact","cargo test -p cadence --test phase12_execution phase12_runner_retains_task_commands_and_one_suite -- --exact","cargo test -p cadence --lib execution::tests::suite_repair_is_plan_level_single_use_and_retains_deviations -- --exact","cargo test -p cadence --lib server::execution_service_tests::suite_repair_answer_requires_owner_and_replays -- --exact","cargo test -p cadence --lib server::next_action_service_tests::suite_repair_continuation_waits_on_plan_question -- --exact"]}]}
---
# Phase 38: The suite is a gate, not a guillotine - Plan 2

## Goal

Make a recognized first red suite open one owner-gated plan-level repair, retain the entire repair lifecycle, and keep closed tasks closed while a second red remains terminal.

## Must be true when done

- T1. When a plan's suite launch reports a failure, the owner sees one repair checkpoint naming the failing tests and the files the executor proposes to touch, and no blocked plan.
- T2. When the owner has approved a repair checkpoint, the owner sees a second suite launch accepted on the same plan with both launches and both results retained in execution-history.
- T3. When a plan's second suite launch reports a failure, the owner sees the plan blocked with a suite-failed blocker and a third launch refused.

## Context

D-163 and D-164 are approved at .planning/phases/38/CONTEXT.md:9-10. Today plan_contribute rejects every event after a failed projection at crates/cadence/src/execution/history.rs:620-621, refuses another recognized launch as suite-once at crates/cadence/src/execution/history.rs:651-660, ends the active dispatch Blocked on the first failed SuiteResult at crates/cadence/src/execution/history.rs:671-675, and refuses completion at crates/cadence/src/execution/history.rs:712-715. execution_service directs the owner to a gap plan at crates/cadence/src/execution_service.rs:1106-1114 and crates/cadence/src/execution_service.rs:2360. Replace that first-failure path only. The absence-attested dead-launch SuiteRelaunch at crates/cadence/src/execution/history.rs:677-701 remains semantically unchanged and its budget is independent of the repair launch.

The repair lifecycle is plan history, not task history. Add SuiteRepairQuestion, SuiteRepairAnswer, and SuiteRepair beside SuiteLaunch, SuiteRelaunch, and Completion in PlanEvent at crates/cadence/src/execution/history.rs:420-427. SuiteRepairQuestion is generated after the first failing SuiteResult and carries a stable question id, failed run id, every failing test name recognized from retained suite output, and the executor's proposed project-relative repair paths supplied on the suite request. SuiteRepairAnswer carries the answered question id, nonblank owner and time, and approve or refuse. Expose it through the new plan-level cadence_apply operation execution-suite-repair-answer, validate attribution before append, and use PlanRequest replay at crates/cadence/src/execution/history.rs:511-517. A refused answer ends the dispatch Blocked. SuiteRepair names actual ordered repair commits and Git-observed changed paths; expose it through execution-suite-repair, validate it against the active plan, current question and approved answer, and retain it before another launch.

Extend PlanProjection at crates/cadence/src/execution/history.rs:448-458 and plan_project at crates/cadence/src/execution/history.rs:491-505 so public plan state carries launches, results, repair question, answer and repair. The first failed result is nonterminal and creates one unanswered question. Decision::RepairSuite at crates/cadence/src/next_action/continuation.rs:13-31 is selected from current plan_project and makes execute-next wait on that unanswered plan question; after approval it permits a plan-level repair continuation with no executable tasks. No Event::Checkpoint is created. The completed-task refusal at crates/cadence/src/execution/history.rs:180-184 and checkpoint_projection at crates/cadence/src/execution/history.rs:340-368 remain byte-for-byte untouched: nothing appends any event or attempt to a closed task.

Accept a second ordinary SuiteLaunch only when an approved SuiteRepairAnswer and SuiteRepair both occur after the first failed result and no second failed result exists. This is one repair rerun and never consumes SuiteRelaunch. A second failed SuiteResult calls end_dispatch Blocked with suite-failed:<run-id>; a refused answer also calls end_dispatch Blocked. A third launch is refused suite-failed. At terminal projection derive every repaired path outside ActiveDispatch.files/directories into one stable Deviation using crates/cadence/src/execution/model.rs:117-123 and PlanOutcome.deviations at crates/cadence/src/execution/model.rs:168-180, backed by repair commit evidence. execution-history already returns plan events at crates/cadence/src/execution_runner_service.rs:101-105; add the matching outcome to each plan view. Add terminal outcomes to verification execution material at crates/cadence/src/verification/inputs.rs:102-156 and keep completion reconstruction aligned at crates/cadence/src/verification/completion.rs:121-124, so verification sees the same deviation and repair paths.

The public PlanApply schema and adapter at crates/cadence/src/execution/runner.rs:40-68, crates/cadence/src/execution/runner.rs:230-277, crates/cadence/src/execution_runner_service.rs:30-76, and crates/cadence/src/server.rs:300-310 own the suite proposal, answer and repair operations. Existing passing-suite calls may omit proposed repair paths. Update compiled executor lifecycle prose at crates/cadence/src/execution/instructions.rs:10, crates/cadence/src/execution/instructions.rs:48-51, crates/cadence/src/execution/instructions.rs:81-103 and crates/cadence/src/execution/instructions.rs:227-234, plus acceptance rule 5 at docs/architecture/acceptance.md:390-397. Plan 1's binary-owned regeneration writes affected skills as implicit lease material; do not hand-edit or list generated paths.

The old refusal assertions are all in phase12_runner_retains_task_commands_and_one_suite at crates/cadence/tests/phase12_execution.rs:1321-1488. Preserve the successful-suite terminal rule; replace the first-red suite-failed/gap assertions at lines 1427-1459 with question, answer, repair and second-launch history; leave Unknown/dead-launch SuiteRelaunch assertions at lines 1385-1425 and 1462-1487 intact. Replace the old task-level SuiteRed test at crates/cadence/src/next_action_service_tests.rs:195-228 with a plan-question wait. Add focused plan-history and public-answer units without weakening unrelated refusals.

The three acceptance checks are separate fresh-project real-stdio episodes in crates/cadence/tests/phase38_suite_gate.rs. They traverse the public lifecycle with handwritten expected values and never seed state, call internal projections, inject events, reopen tasks, fake captures, or add observations.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P38-T1-C",
      "spec": {
        "command": "cargo test -p cadence --test phase38_suite_gate phase38_first_red_raises_plan_repair_question -- --exact",
        "expected": {
          "kind": "property",
          "value": "After the first recognized failing suite result, execution-history retains SuiteLaunch and SuiteResult followed by exactly one unanswered SuiteRepairQuestion whose failed_run names that result, failing_tests equals the two handwritten failing test names, and proposed_paths equals the executor's two submitted project-relative paths; the active dispatch remains present and no blocked PlanOutcome or suite-failed blocker exists."
        },
        "test": {
          "file": "crates/cadence/tests/phase38_suite_gate.rs",
          "function": "phase38_first_red_raises_plan_repair_question"
        },
        "setup": "Create a fresh disposable signed Git project and run env!(CARGO_BIN_EXE_cadence) through the real stdio Client in crates/cadence/tests/support/phase13.rs. Use only public context-submit, plan-submit, execution-admit, execution-authorize, execute-next, execution-task-start, real execution-run red and green stages, execution-owner-attest, execution-task-close, and execution-suite calls. Handwrite every expected value. Make the admitted suite process emit recognized failures for two named tests and include two exact proposed repair paths in the first execution-suite request. Do not seed the store, reopen a task, inject a PlanEvent, or call an internal runner, projection, or history function.",
        "call": "Launch the real failing suite, poll cadence_query execution-history until the binary-generated suite-repair-question follows its retained suite-result, then compare the ordered plan events, question id, failed run, failing test names, proposed paths, active dispatch, and absence of a terminal plan outcome to handwritten JSON.",
        "boundary": "Real suite child process and executor-proposed paths -> binary-generated immutable plan-level question -> public execution-history and active plan state.",
        "fakes": []
      },
      "reason": "If the first red still ends the plan, uses task checkpoint state, loses names or proposed paths, or raises more than one question, the public history assertions fail.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "This real stdio first-red history and still-active outcome is the owner-visible boundary approved as phase 38 T1."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P38-T2-C",
      "spec": {
        "command": "cargo test -p cadence --test phase38_suite_gate phase38_approved_plan_repair_accepts_one_second_launch -- --exact",
        "expected": {
          "kind": "property",
          "value": "execution-suite-repair-answer refuses a request with no owner, accepts and replays one attributed approve answer by request id, execute-next returns a plan-level repair dispatch without reopening any completed task, execution-suite-repair retains the exact repair commits and Git-observed changed paths, and one second execution-suite launch is accepted on the same PlanIdentity; execution-history retains in order both launches, both results, SuiteRepairQuestion, SuiteRepairAnswer, and SuiteRepair while SuiteRelaunch remains null."
        },
        "test": {
          "file": "crates/cadence/tests/phase38_suite_gate.rs",
          "function": "phase38_approved_plan_repair_accepts_one_second_launch"
        },
        "setup": "Create a separate fresh disposable signed Git project and drive the same real public context, publication, admission, authorization, dispatch, task red/green, owner-attestation, task-close, and first failing suite flow. Poll for the generated SuiteRepairQuestion. Submit an execution-suite-repair-answer request with a blank owner and assert refusal without mutation; then submit an attributed approve answer and replay the same request id. Call execute-next and assert the repair continuation contains no reopened task. Commit one repair, submit execution-suite-repair with the exact question id and ordered commits while the binary observes their changed paths, then make the second real suite pass.",
        "call": "Use cadence_apply execution-suite-repair-answer, cadence_query execute-next, cadence_apply execution-suite-repair, and cadence_apply execution-suite in that order, then read execution-history and compare every plan event, result identity, owner/time, commit, changed path, and the unused dead-launch relaunch field to handwritten values.",
        "boundary": "Attributed public owner answer and actual Git repair -> plan-level continuation/repair record -> one accepted second real suite launch and durable public history.",
        "fakes": []
      },
      "reason": "If approval is unattributed, tasks reopen, repair material is caller-invented, replay duplicates an event, the repair consumes SuiteRelaunch, or the second launch is refused, an assertion fails.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "This owner-approved recorded repair and two-launch history is the owner-visible boundary approved as phase 38 T2."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P38-T3-C",
      "spec": {
        "command": "cargo test -p cadence --test phase38_suite_gate phase38_second_red_blocks_and_refuses_third_launch -- --exact",
        "expected": {
          "kind": "property",
          "value": "When the approved repair's second recognized suite result fails, execution-history retains a Blocked PlanOutcome with exactly one suite-failed:<second-run-id> blocker and the complete plan-event lifecycle; a third execution-suite call is refused with suite-failed. Each changed repair path outside the authored lease is a per-file outcome.deviations entry and, after a later admitted gap plan completes, fresh verify-next inputs expose the same outcome and plan-level repair event paths."
        },
        "test": {
          "file": "crates/cadence/tests/phase38_suite_gate.rs",
          "function": "phase38_second_red_blocks_and_refuses_third_launch"
        },
        "setup": "Create a fresh disposable signed Git project through the same real stdio public flow. Drive a first recognized red suite, its generated SuiteRepairQuestion, an attributed approve SuiteRepairAnswer, and one SuiteRepair record. The actual repair commits deliberately touch one handwritten path inside and one outside the admitted lease. Make the authorized second suite launch fail with a distinct handwritten test name and attempt a third launch. Then publish and admit a later gap plan, complete its real task, suite and risk path, and request verify-next so terminal verification inputs are available. Never seed history, fake Capture, reopen a completed task, or inject deviations.",
        "call": "Submit the second failing execution-suite, inspect execution-history, submit a third execution-suite request, complete the later gap plan through public operations, and call cadence_query verify-next. Assert the exact Blocked disposition and suite-failed blocker, third-launch refusal, ordered lifecycle, one per-file out-of-lease deviation backed by the repair commit, and the same outcome and repair paths in verification inputs.",
        "boundary": "Second real recognized suite failure plus Git-observed repair paths -> end_dispatch Blocked projection, third-launch gate, PlanOutcome deviations, execution-history, and fresh verification inputs.",
        "fakes": []
      },
      "reason": "If a second red remains repairable, a third launch enters, the blocker differs, or an out-of-lease path is hidden from history or verification, the assertions fail.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "This second-red blocker, third-launch refusal, and visible deviation is the owner-visible boundary approved as phase 38 T3."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P38-A-PLAN-SUITE-REPAIR-LIFECYCLE",
      "spec": {
        "locators": [
          "crates/cadence/src/execution/history.rs::PlanEvent",
          "crates/cadence/src/execution/history.rs::plan_project",
          "crates/cadence/src/execution/history.rs::plan_contribute",
          "crates/cadence/src/execution_runner_service.rs::plan_apply",
          "crates/cadence/src/next_action/continuation.rs::Decision::RepairSuite",
          "crates/cadence/src/execution/model.rs::PlanOutcome",
          "crates/cadence/src/verification/inputs.rs::observe"
        ],
        "substance": "PlanEvent gains SuiteRepairQuestion, SuiteRepairAnswer, and SuiteRepair. The binary generates the question after the first failed SuiteResult with recognized failing test names and executor-proposed paths. execution-suite-repair-answer requires owner, time, approve/refuse and the question id, with PlanRequest replay; refusal calls end_dispatch Blocked. Approval stops Decision::RepairSuite waiting and permits a plan-level repair dispatch with every task closed. execution-suite-repair validates actual ordered commits and derives changed paths before retaining SuiteRepair. A second SuiteLaunch requires that answer and repair record and does not consume SuiteRelaunch. A second failed result blocks with suite-failed. plan_project and history retain the full lifecycle. Terminal repair paths outside ActiveDispatch files/directories become existing per-file Deviation values in PlanOutcome, exposed by history and verification. Task Event::Checkpoint, the completed-task refusal, and checkpoint_projection are unchanged."
      },
      "reason": "If repair state lives in task history, an untracked counter, or an unverified caller claim, closed-task invariants weaken and lifecycle evidence can disappear.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "The generated question and nonterminal first-red projection implement T1."
        },
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "The attributed answer, Git-backed repair and guarded second launch implement T2."
        },
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "The exhausted budget, blocker and per-file deviations implement T3."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Install the plan-level one-repair suite state machine

- **ID:** P38-2-T1
- **Files:** crates/cadence/src/execution/history.rs, crates/cadence/src/execution/runner.rs, crates/cadence/src/execution/instructions.rs, crates/cadence/src/execution/tests.rs, crates/cadence/src/execution_service.rs, crates/cadence/src/execution_service_tests.rs, crates/cadence/src/execution_runner_service.rs, crates/cadence/src/server.rs, crates/cadence/src/next_action/continuation.rs, crates/cadence/src/next_action_service_tests.rs, crates/cadence/src/verification/inputs.rs, crates/cadence/src/verification/completion.rs, docs/architecture/acceptance.md, crates/cadence/tests/phase12_execution.rs, crates/cadence/tests/phase38_suite_gate.rs.
- **Action:** Before production edits, add all three phase-38 functions, replace the old task-level SuiteRed continuation unit, revise phase12_runner_retains_task_commands_and_one_suite only where it asserts the first-red gap rule, and add focused plan-history/public-answer units; commit and retain every exact red run. Then add SuiteRepairQuestion, SuiteRepairAnswer and SuiteRepair to PlanEvent and project them with every launch/result; generate the question after a first failed result; implement attributed replay-safe execution-suite-repair-answer and Git-validated execution-suite-repair; make Decision::RepairSuite wait on the unanswered plan question; admit exactly one second SuiteLaunch only after approval and repair; block refusal or second red through end_dispatch; refuse a third launch; derive per-file out-of-lease deviations; and expose outcomes in history and verification inputs. Update architecture and compiled executor prose and regenerate skills only through Plan 1's binary-owned mechanism. Do not edit crates/cadence/src/execution/history.rs:180-184 or :340-368 and do not append any task event after close. Commit implementation plus generated bytes, rerun every exact command green, and close with all red/green pairs.
- **Verify:**
  - cargo test -p cadence --test phase38_suite_gate phase38_first_red_raises_plan_repair_question -- --exact
  - cargo test -p cadence --test phase38_suite_gate phase38_approved_plan_repair_accepts_one_second_launch -- --exact
  - cargo test -p cadence --test phase38_suite_gate phase38_second_red_blocks_and_refuses_third_launch -- --exact
  - cargo test -p cadence --test phase12_execution phase12_runner_retains_task_commands_and_one_suite -- --exact
  - cargo test -p cadence --lib execution::tests::suite_repair_is_plan_level_single_use_and_retains_deviations -- --exact
  - cargo test -p cadence --lib server::execution_service_tests::suite_repair_answer_requires_owner_and_replays -- --exact
  - cargo test -p cadence --lib server::next_action_service_tests::suite_repair_continuation_waits_on_plan_question -- --exact

## Notes

This remains one executor dispatch because question generation, attributed answer, repair provenance, launch budget, blocker and deviations are one atomic plan state machine; splitting it would leave an admitted intermediate state without its validating transition. D-169 requires red and green commits under the executor block with native verification afterward. The task completed refusal and checkpoint projection are explicit non-targets. Gap plans remain for a refused repair, second red or redesign. No phase 31, 34, 36 or 37 file is leased or changed.
