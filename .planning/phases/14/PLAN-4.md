---
phase: 14
plan: 4
requirements: ["T7"]
files: ["crates/cadence/src/execution/history.rs","crates/cadence/src/execution/runner.rs","crates/cadence/src/execution/boundary.rs","crates/cadence/src/execution/instructions.rs","crates/cadence/src/execution_service.rs","crates/cadence/src/verification/model.rs","crates/cadence/src/verification/instructions.rs","crates/cadence/src/verification_service.rs","crates/cadence/src/review/attempts.rs","crates/cadence/src/review_service.rs","crates/cadence/src/next_action/select.rs","crates/cadence/src/progress/render.rs","crates/cadence/src/progress_service.rs","crates/cadence/src/server.rs","crates/cadence/src/read/document.rs","skills/cad-execute/SKILL.md","skills/cad-executor-contract/SKILL.md","skills/cad-verify/SKILL.md","skills/cad-verifier-contract/SKILL.md","hooks/hooks.json",".gitignore","cadence-core/bin/read-trace.mjs","cadence-core/bin/read-trace.test.mjs","cadence-core/bin/subagent-trace.mjs","cadence-core/bin/subagent-trace.test.mjs","cadence-core/bin/lib/read-trace.mjs","cadence-core/bin/lib/subagent-trace.mjs","crates/cadence/tests/mcp.rs","crates/cadence/tests/phase7_guard.rs","crates/cadence/tests/phase14_receipts.rs","crates/cadence/tests/support/phase14.rs","crates/cadence/src/review/instructions.rs","skills/cad-review/SKILL.md","skills/cad-decision-review/SKILL.md","skills/cad-minimalism-review/SKILL.md","skills/cad-plan-review/SKILL.md","cadence-core/bin/planning/core.mjs","cadence-core/bin/planning/trace.mjs","cadence-core/bin/planning/reads.mjs","cadence-core/bin/lib/trace.mjs","cadence-core/bin/lib/trace-suggest.mjs","cadence-core/bin/lib/arg-contract.mjs","cadence-core/bin/lib/refusal-hints.mjs","cadence-core/bin/lib/subagent-transcript.mjs","cadence-core/bin/planning-trace-ignore.test.mjs","cadence-core/bin/subagent-transcript.test.mjs","cadence-core/bin/trace-suggest.test.mjs","cadence-core/bin/trace.test.mjs"]
directories: ["crates/cadence/src/execution","crates/cadence/src/verification","crates/cadence/src/next_action","cadence-core/bin"]
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P14-4-T1","verify":["cargo nextest run -p cadence --test phase14_receipts phase14_exited_worker_without_completion_is_interrupted","cargo nextest run -p cadence --lib worker_exit"]},{"id":"P14-4-T2","verify":["cargo nextest run -p cadence --test phase14_receipts phase14_exited_worker_without_completion_is_interrupted","cargo nextest run -p cadence --test mcp"]},{"id":"P14-4-T3","verify":["cargo nextest run -p cadence --test phase7_guard hooks","test ! -e cadence-core/bin/read-trace.mjs -a ! -e cadence-core/bin/subagent-trace.mjs -a ! -e cadence-core/bin/lib/read-trace.mjs -a ! -e cadence-core/bin/lib/subagent-trace.mjs","node cadence-core/bin/test.mjs planning","node cadence-core/bin/test.mjs prose","node cadence-core/bin/test.mjs other"]}]}
---
## Goal

A worker that exits without completing its plan is detected from the orchestrator's report, shown as interrupted, and never silently redispatched (T7); read-trace and subagent-trace leave with their libraries and the reads log.

## Must be true when done

- T7. When a dispatched worker stops without returning a patch, the owner sees that dispatch reported as interrupted with no silent redispatch offered.

## Context

T7 and D-141 at the phase 14 context, with D-141's mechanism superseded as recorded in this plan's notes. Since phase 33 (D-185) execute-next answers a dispatch id, a route and identities and no prompt; the worker reads its dispatch by id through document and returns through the native task family (execution-task-start, execution-run, execution-task-close) and execution-plan-complete; the plan's events are PlanEvent variants in crates/cadence/src/execution/history.rs (RoundRecord, the suite events, Completion) and the plan-level operations are the PlanApply enum in crates/cadence/src/execution/runner.rs. A repeated execute-next for the same admitted plan re-serves the same dispatch id through the reissue path in crates/cadence/src/execution_service.rs, with no record that the previous worker ever ran; execution-authorize there already carries an owner-attributed answer and a `continuation-target` refusal for a checkpoint that did not stop. Review attempts know the pattern: host_launches and the Interrupted observation in crates/cadence/src/review/attempts.rs, `cadence review-stop` as the SubagentStop registration in hooks/hooks.json, a late return still accepted in crates/cadence/src/review/returns.rs. Verification attempts have no interruption state. Local review workers are launched by the review front door (crates/cadence/src/review/instructions.rs, rendered to skills/cad-review/SKILL.md and its three alias skills); a provider delivery runs inside the resident binary and answers pending through review-next, so no host ever launches it. hooks/hooks.json still registers cadence-core/bin/read-trace.mjs on PostToolUse; crates/cadence/tests/phase7_guard.rs pins hooks.json; nothing in 4.0 reads .planning/reads.jsonl. Progress grammar and common setup: phase 14 plan 1, context and notes parts.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P14-T7-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase14_receipts phase14_exited_worker_without_completion_is_interrupted",
        "expected": {
          "kind": "literal",
          "value": "The exit report for dispatch A answers ok with interrupted true. Progress then contains `Dispatch: dispatch <A> interrupted, no return; 1 generations since issue` and `Next: Continue dispatch <A> with execution-authorize or retire it`. execute-next is refused code `continuation-refusal` with located {rule `interrupted`, slot `dispatch`, id <A>} and the refusal is recorded with at. After execution-authorize names dispatch A, execute-next answers ok with dispatch_id equal to A and the same route and identities as the first issue, and the worker flow completes plan 1 with status ok on every step. For dispatch B the exit report arrives after one of two tasks closed and answers interrupted true; the late close of the second task and execution-plan-complete both answer ok; the final progress shows no `Dispatch:` line and `Record (phase <p>): 2 routing decisions, 1 refusals, 0 gate fires`. An exit report after plan 1 completed answers interrupted false and adds no Dispatch line. An exit report naming an unknown id is refused rule `exit-target`; a second report for A before the continuation is refused `exit-duplicate`; the replay of A's report equals the original receipt. For the verification attempt V, verification-read reports the attempt interrupted. After restart the reopened plan history holds two WorkerExit events bound to A and B with host `codex exec`, at inside the clock window and a generation, and none for the unknown id. Nothing under .planning was written except the store's files and the binary's own renders."
        },
        "test": {
          "file": "crates/cadence/tests/phase14_receipts.rs",
          "function": "phase14_exited_worker_without_completion_is_interrupted"
        },
        "setup": "A ProcessFixture from crates/cadence/tests/support/phase31.rs: a native context with two truths T1 and T2, two typed plans of two tasks each whose verify runs python3 -B tests/tiny.py, plan 1's check bound to T1 and plan 2's to T2 (one check per truth), admitted with each check allocated to its plan's first task, and authorized, the way crates/cadence/tests/phase33_execution.rs builds one plan. The completion steps (task start, red and green runs, owner attest, task close, execution-suite and its result, risk-check, execution-plan-complete) are copied from Completed::execute in crates/cadence/tests/support/phase13.rs into crates/cadence/tests/support/phase14.rs so the test can interleave exit reports. The store generation is read from reopened after each write; the test reads its clock in seconds before the first call and after the last.",
        "call": "execute-next (dispatch A); execution-worker-exit {dispatch A, host `codex exec`, outcome exited}; progress; execute-next; execution-authorize {dispatch A, owner, at, response}; execute-next; complete plan 1 through the copied completion steps; execution-worker-exit {dispatch A} again; execute-next (dispatch B); close one task; execution-worker-exit {dispatch B}; close the second task; execution-plan-complete; progress; execution-worker-exit naming an unknown id; replay A's first report; verify-next (attempt V) then execution-worker-exit {attempt V} and verification-read; restart; reopened.",
        "boundary": "real execute-next, worker-exit, authorize, close, suite and completion operations over stdio against the real binary; the worker is simulated only by the orchestrator's report of its absence",
        "fakes": [
          "the caller's inputs",
          "the test's own clock window read around each call"
        ]
      },
      "reason": "An exit that recorded nothing, a hidden interruption, a re-serve without a continuation record, or a refused late close would break the detected-failure answer.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "A dispatched worker stops without returning and the owner sees the dispatch reported as interrupted with no silent redispatch: T7's trigger and outcome."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T7-A1",
      "spec": {
        "locators": [
          "crates/cadence/src/execution/history.rs PlanEvent::WorkerExit",
          "crates/cadence/src/execution/runner.rs execution-worker-exit",
          "crates/cadence/src/verification/model.rs attempt interruption"
        ],
        "substance": "The one execution-worker-exit operation: the orchestrator's report of a worker's exit for any dispatch kind, recorded with host, outcome, at and generation, and judged interrupted when the plan has not completed."
      },
      "reason": "Without a recorded exit a dead worker is indistinguishable from a slow one.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "It is how the binary learns the worker stopped, on either host."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T7-A2",
      "spec": {
        "locators": [
          "crates/cadence/src/execution_service.rs interrupted continuation gate and execution-authorize dispatch target",
          "crates/cadence/src/next_action/select.rs Rule::Interrupted"
        ],
        "substance": "The continuation gate: an interrupted dispatch is refused re-serve until an explicit owner continuation names it, then the identical dispatch is re-served; a late close is accepted."
      },
      "reason": "A blind re-serve or a hidden interruption is the silent redispatch T7 forbids.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "The gate is what makes the redispatch never silent."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T7-A3",
      "spec": {
        "locators": [
          "crates/cadence/src/progress/render.rs Dispatch line",
          "skills/cad-execute/SKILL.md",
          "skills/cad-verify/SKILL.md"
        ],
        "substance": "The progress Dispatch line and next action for an unanswered interruption, and the front doors that report the worker's exit as they see it end."
      },
      "reason": "A door that never reports leaves the gap open on both hosts; a missing line hides the interruption from the owner.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "The line is what the owner sees; the door is what produces the report."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Record the worker's exit; mark an incomplete plan interrupted

- **ID:** P14-4-T1
- **Files:** crates/cadence/src/execution/history.rs, crates/cadence/src/execution/runner.rs, crates/cadence/src/execution/boundary.rs, crates/cadence/src/execution_service.rs, crates/cadence/src/verification/model.rs, crates/cadence/src/verification_service.rs, crates/cadence/src/review/attempts.rs, crates/cadence/src/review_service.rs, crates/cadence/src/server.rs, crates/cadence/src/read/document.rs, crates/cadence/tests/phase14_receipts.rs, crates/cadence/tests/support/phase14.rs
- **Action:** Deliver P14-T7-A1 and the recording half of P14-T7-C. Add cadence_apply {operation: execution-worker-exit, request_id, phase, host, outcome: exited|failed, detail?} with exactly one of `dispatch` (an issued execution dispatch id), `attempt` (a verification attempt id) or `review` (a review attempt id). For a dispatch it appends a PlanEvent::WorkerExit {dispatch_id, host, outcome, detail, at, generation, interrupted} to the plan's history: interrupted is true when the plan has no Completion event at that generation, false when the plan completed before the report. For a verification attempt it records the attempt as interrupted, shown by verification-read. For a review attempt it delegates to the existing Interrupted observation, unit tested beside the delegation in crates/cadence/src/review/attempts.rs. Refuse `exit-target` when the id names nothing issued or retained, `exit-duplicate` when that dispatch already has an unanswered interruption; replay returns the original receipt. The exit and the interruption are readable through the dispatch document's `execution` part and through execution-history.
- **Verify:**
  - cargo nextest run -p cadence --test phase14_receipts phase14_exited_worker_without_completion_is_interrupted
  - cargo nextest run -p cadence --lib worker_exit

### Task 2: The continuation gate and the Dispatch line

- **ID:** P14-4-T2
- **Files:** crates/cadence/src/execution_service.rs, crates/cadence/src/execution/boundary.rs, crates/cadence/src/execution/instructions.rs, crates/cadence/src/verification/instructions.rs, crates/cadence/src/next_action/select.rs, crates/cadence/src/progress/render.rs, crates/cadence/src/progress_service.rs, skills/cad-execute/SKILL.md, skills/cad-executor-contract/SKILL.md, skills/cad-verify/SKILL.md, skills/cad-verifier-contract/SKILL.md, crates/cadence/tests/mcp.rs, crates/cadence/tests/phase14_receipts.rs, crates/cadence/src/review/instructions.rs, skills/cad-review/SKILL.md, skills/cad-decision-review/SKILL.md, skills/cad-minimalism-review/SKILL.md, skills/cad-plan-review/SKILL.md
- **Action:** Deliver P14-T7-C, P14-T7-A2 and P14-T7-A3. An unanswered interruption is the detected failure: progress renders `Dispatch: dispatch <id> interrupted, no return; <k> generations since issue` and the next action `Continue dispatch <id> with execution-authorize or retire it` (a compiled rule ahead of Pause, after Conflict); execute-next for that phase is refused `continuation-refusal`, located {rule interrupted, slot dispatch, id}, recorded with at (plan 3's shape), until an execution-authorize answer whose new optional `dispatch` field names that id (refused `continuation-target` when that dispatch has no unanswered interruption); after that execute-next re-serves the identical dispatch id. A task close or plan completion arriving after the interruption is accepted unchanged and the interruption stays in history. No wall-clock timeout, no lease expiry. Teach the regenerated cad-execute, cad-verify and cad-review front doors (the three review aliases render from the same source) to call execution-worker-exit when the worker they spawned exits; a provider delivery is not reported; and the executor and verifier contracts that an exit report may already exist; extend the skill pin in crates/cadence/tests/mcp.rs.
- **Verify:**
  - cargo nextest run -p cadence --test phase14_receipts phase14_exited_worker_without_completion_is_interrupted
  - cargo nextest run -p cadence --test mcp

### Task 3: Remove read-trace and subagent-trace with their libraries and the reads log

- **ID:** P14-4-T3
- **Files:** hooks/hooks.json, .gitignore, cadence-core/bin/read-trace.mjs, cadence-core/bin/read-trace.test.mjs, cadence-core/bin/subagent-trace.mjs, cadence-core/bin/subagent-trace.test.mjs, cadence-core/bin/lib/read-trace.mjs, cadence-core/bin/lib/subagent-trace.mjs, crates/cadence/tests/phase7_guard.rs, cadence-core/bin/planning/core.mjs, cadence-core/bin/planning/trace.mjs, cadence-core/bin/planning/reads.mjs, cadence-core/bin/lib/trace.mjs, cadence-core/bin/lib/trace-suggest.mjs, cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/lib/refusal-hints.mjs, cadence-core/bin/lib/subagent-transcript.mjs, cadence-core/bin/planning-trace-ignore.test.mjs, cadence-core/bin/subagent-transcript.test.mjs, cadence-core/bin/trace-suggest.test.mjs, cadence-core/bin/trace.test.mjs
- **Action:** A task, not a truth (P3: the absence assertion is phase 18's). Delete cadence-core/bin/read-trace.mjs, cadence-core/bin/lib/read-trace.mjs, cadence-core/bin/subagent-trace.mjs, cadence-core/bin/lib/subagent-trace.mjs and their two test files; remove the PostToolUse registration from hooks/hooks.json and update the pin in crates/cadence/tests/phase7_guard.rs; drop the .planning/reads.jsonl lines from .gitignore. Cut every surviving importer of the two libraries (the files in this task's list: the reads subcommand, core.mjs, trace.mjs, trace-suggest.mjs with its reads rules and floors, arg-contract.mjs, refusal-hints.mjs, subagent-transcript.mjs and their tests) so nothing in the tree reads or writes .planning/reads.jsonl afterwards, and the node test groups stay green because the release workflow runs them. Commit separately.
- **Verify:**
  - cargo nextest run -p cadence --test phase7_guard hooks
  - test ! -e cadence-core/bin/read-trace.mjs -a ! -e cadence-core/bin/subagent-trace.mjs -a ! -e cadence-core/bin/lib/read-trace.mjs -a ! -e cadence-core/bin/lib/subagent-trace.mjs
  - node cadence-core/bin/test.mjs planning
  - node cadence-core/bin/test.mjs prose
  - node cadence-core/bin/test.mjs other

## Notes

D-141 superseded, owner 2026-09-18, recorded here because the phase context is immutable: D-141 detected a dead worker through the host's SubagentStop hook, which fires only in a Claude Code host; Cadence must work with Codex or Claude Code as the host, and Codex never fires it, so the hook cannot be the mechanism. The replacement: the orchestrator (the main thread running a front door) spawns every host-launched worker, the executor, the verifier and a local reviewer, and sees it exit, so it reports the exit through one apply operation, execution-worker-exit, naming the dispatch, the host and the outcome; the binary decides whether that exit is an interruption (the plan has no completion yet) and records it; the continuation gate, the late return, the no-timeout rule and the generations-as-age rule of D-141 are unchanged. A provider delivery is binary-owned, never host-launched, and is not reported. The known gap is rewritten: an orchestrator that never reports leaves the dispatch issued with no exit and no return, and the owner's resume decides. The continuation record reuses the owner-attributed execution-authorize answer with a new optional `dispatch` target rather than a new override meaning (D-113). `cadence review-stop` stays as it is: on a Claude host it remains a second signal for review attempts, and the review leg of execution-worker-exit delegates to the same Interrupted observation. Execution rules: phase 14 plan 1, notes part. The JavaScript removal in task 3 is verified by absence, by the hooks pin and by the node test groups the release workflow still runs (.github/workflows/release.yml runs node cadence-core/bin/test.mjs in its guard job). Falsification findings 9 to 14 of .codex-analysis/phase14-falsification.md corrected this plan on 2026-09-18.
