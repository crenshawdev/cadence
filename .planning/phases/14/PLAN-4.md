---
phase: 14
plan: 4
requirements: ["T7"]
files: ["crates/cadence/src/launch_service.rs","crates/cadence/src/stop_hook.rs","crates/cadence/src/review_hook.rs","crates/cadence/src/lib.rs","crates/cadence/src/main.rs","crates/cadence/src/server.rs","crates/cadence/src/store/transaction.rs","crates/cadence/src/store/writer.rs","crates/cadence/src/review/attempts.rs","crates/cadence/src/review_service.rs","crates/cadence/src/execution_service.rs","crates/cadence/src/verification_service.rs","crates/cadence/src/progress/render.rs","crates/cadence/src/progress_service.rs","skills/cad-execute/SKILL.md","skills/cad-verify/SKILL.md","hooks/hooks.json",".gitignore","crates/cadence/tests/mcp.rs","crates/cadence/tests/phase7_guard.rs","crates/cadence/tests/phase14_receipts.rs","crates/cadence/tests/support/phase14.rs","cadence-core/references/seam-spawn-agent.md","cadence-core/references/conventions.md","cadence-core/workflows/execute.md"]
directories: ["cadence-core/bin","crates/cadence/src/execution","crates/cadence/src/verification","crates/cadence/src/next_action","crates/cadence/src/launch"]
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P14-4-T1","verify":["cargo test -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions -- --exact"]},{"id":"P14-4-T2","verify":["cargo test -p cadence --test phase14_receipts phase14_stopped_worker_without_patch_is_interrupted -- --exact"]},{"id":"P14-4-T3","verify":["node cadence-core/bin/test.mjs planning","node cadence-core/bin/test.mjs prose","node cadence-core/bin/test.mjs other","cargo test -p cadence --test phase7_guard -- hooks"]}]}
---
# Phase 14: Receipts and retune - Plan 4

## Goal

A stopped worker is detected and shown, never silently redispatched (D-141); read-trace and
subagent-trace leave with their libraries and the reads log.

## Must be true when done

- T7. When a dispatched worker stops without returning a patch, the owner sees that dispatch reported as interrupted with no silent redispatch offered.

## Context

Review attempts know the pattern: `host_launches` (`review/attempts.rs:117-122`), `cadence review-stop`
(`review_hook.rs:71-149`; `hooks/hooks.json:27-36`) writing `Interrupted` (`attempts.rs:139-152`), a late
return still accepted (`review/returns.rs:219-224`). An execution dispatch has no launch record and is
re-served forever (`execution_service.rs:1055-1067`); a verification attempt replays. `execution-authorize`
(`:126-160`) already carries an owner-attributed answer with a `continuation-target` refusal.
`review_hook.rs:31-68`, `:143-146` still spawn `subagent-trace.mjs`; `hooks/hooks.json:15-25` registers
`read-trace.mjs`; `tests/phase7_guard.rs:1278-1307` pins hooks.json. Common setup and the progress text grammar: PLAN-1.md, the two sections of those names.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P14-T7-C",
      "spec": {
        "command": "cargo test -p cadence --test phase14_receipts phase14_stopped_worker_without_patch_is_interrupted -- --exact",
        "expected": {
          "kind": "literal",
          "value": "Every `cadence stop` exits 0 with empty stdout and stderr, `nobody` included. After the first stop progress contains `Dispatch: dispatch <A> interrupted, no return; 1 generations since launch` and `Next: Continue dispatch <A> with execution-authorize or stop it`; `execute-next` is refused `code: \"continuation-refusal\"`, `located` `{rule:\"interrupted\",slot:\"dispatch\",id:<A>}`, recorded with `at`; after the continuation `execute-next` is ok with `dispatch.id == <A>` and a prompt byte-identical to the first; plan 1 completes. After the `agent-b` stop the late patch flow completes plan 2 with `status: ok` on every step; the final progress shows `phase 13: Plan publication - executed`, no `Dispatch:` line, `Record (phase 13): 2 routing decisions, 1 refusals, 0 gate fires`. The reopened store holds two Interrupted observations bound to `<A>`, `<B>` with `agent-a`, `agent-b`, each with `at` and a generation, none for `nobody`. `verification-read` reports attempt `<V>` `interrupted`. Nothing under `.planning` was written except the store's four files and the fixture's SUMMARY.md."
        },
        "test": {
          "file": "crates/cadence/tests/phase14_receipts.rs",
          "function": "phase14_stopped_worker_without_patch_is_interrupted"
        },
        "setup": "`Completed::published(false, |_| {})` (`support/phase13.rs:503-561`), admitted and authorized as `Completed::execute` begins (`:566-576`); the store generation is read from `reopened` after each write.",
        "call": "`execute-next` 13 (dispatch A); `dispatch-launched {agent_id:\"agent-a\",dispatch:<A>}`; run `cadence stop` with stdin `{\"hook_event_name\":\"SubagentStop\",\"agent_id\":\"agent-a\",\"cwd\":<project>}`; `progress`; `execute-next`; `execution-authorize` with `dispatch:<A>`; `execute-next`; complete plan 1 as `Completed::execute` does (`:585-646`); dispatch B, launch `agent-b`, stop, then complete plan 2 the same way (the late patch); `progress`; stop for `nobody`; `verify-next` 13 (attempt V), `dispatch-launched {agent_id:\"agent-v\",attempt:<V>}`, stop, `verification-read`; restart; `reopened`.",
        "boundary": "real cadence stop binary on stdin, real execute-next over stdio, real journal reopened; the worker is simulated only by its launch id and its absence",
        "fakes": [
          "the caller's inputs",
          "the test's own clock window read around each call"
        ]
      },
      "reason": "A stop that wrote nothing, a hidden interruption, a re-serve without a continuation record, or a refused late patch would break the detected-failure answer.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "A stop that wrote nothing, a hidden interruption, a re-serve without a continuation record, or a refused late patch would break the detected-failure answer."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T7-A1",
      "spec": {
        "locators": [
          "crates/cadence/src/launch_service.rs",
          "skills/cad-execute/SKILL.md",
          "skills/cad-verify/SKILL.md"
        ],
        "substance": "The one dispatch-launched operation binding a host agent id to a dispatch of any kind, taught to the executor and verifier front doors."
      },
      "reason": "Without a launch record no stop can be matched to a dispatch.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "Without a launch record no stop can be matched to a dispatch."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T7-A2",
      "spec": {
        "locators": [
          "crates/cadence/src/stop_hook.rs",
          "hooks/hooks.json SubagentStop"
        ],
        "substance": "cadence stop, the one SubagentStop registration: an Interrupted observation with at and generation for any launched dispatch kind, silent, exit 0, no legacy fallback."
      },
      "reason": "A hook that printed, exited nonzero or fell back to the script feeds the host noise and records nothing.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "A hook that printed, exited nonzero or fell back to the script feeds the host noise and records nothing."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T7-A3",
      "spec": {
        "locators": [
          "crates/cadence/src/execution_service.rs interrupted continuation gate and dispatch target",
          "crates/cadence/src/progress/render.rs Dispatch line"
        ],
        "substance": "The continuation gate: an interrupted dispatch without a patch is refused until an explicit owner continuation names it, then the identical dispatch is re-served; a late patch is accepted."
      },
      "reason": "A blind re-serve or a hidden interruption is the silent redispatch T7 forbids.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "A blind re-serve or a hidden interruption is the silent redispatch T7 forbids."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Record the host launch of every dispatch kind

- **Files:** the lease; new `launch/`, `launch_service.rs`.
- **Action:** Deliver P14-T7-A1. Add `cadence_apply {"operation":"dispatch-launched","agent_id":..,
  "dispatch":<id>}` or `"attempt":<verification attempt>` or `"review":<review attempt>` (exactly one),
  recording a durable launch `{agent_id, kind, id, generation}` under its own namespace and admitted
  intent; refused `launch-target` when the id names nothing retained, `launch-conflict` when the agent id
  is bound elsewhere; replay idempotent; the review target delegates to the existing Launch observation.
  Teach the regenerated `skills/cad-execute` and
  `cad-verify` to call it as they spawn the worker; extend `tests/mcp.rs:1194-1210`.
- **Verify:** `cargo test -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions -- --exact`.

### Task 2: cadence stop, the Interrupted observation, the continuation gate

- **Files:** the lease; new `stop_hook.rs` replacing `review_hook.rs`.
- **Action:** Deliver P14-T7-C, P14-T7-A2, P14-T7-A3. Rename to `cadence stop` (`main.rs:31`,
  `:106`; `hooks/hooks.json:27-36`; the pin `phase7_guard.rs:1298-1307`), move `review_hook.rs` to
  `stop_hook.rs`, delete the legacy fallback. It reads the SubagentStop JSON (`review_hook.rs:12-17`),
  matches the launch across all three kinds, writes an Interrupted observation bound to that id with `at`
  and generation, prints nothing and exits 0 on every path. An Interrupted execution dispatch without a
  patch receipt is the detected failure: progress renders the `Dispatch:` line and the next action
  `Continue dispatch <id> with execution-authorize or stop it`; `native_query`'s active branch
  (`:1055-1067`) refuses `continuation-refusal`, located `{rule:"interrupted", slot:"dispatch", id:<id>}`,
  until an `execution-authorize` answer (`:126-160`) with a new optional `dispatch` target names it
  (refused `continuation-target` when that dispatch has no interruption), after which the identical
  dispatch is re-served. A patch after Interrupted is accepted unchanged; the interruption stays in
  history. A verification attempt's interruption shows in `verification-read` (P8). No timeout, no lease
  expiry.
- **Verify:** `cargo test -p cadence --test phase14_receipts phase14_stopped_worker_without_patch_is_interrupted -- --exact`.

### Task 3: Remove read-trace and subagent-trace with their libraries and the reads log

- **Files:** `cadence-core/bin/`, `hooks/hooks.json`, `.gitignore`, `tests/phase7_guard.rs`.
- **Action:** A task, not a truth (P3: absence is phase 18's). Delete `bin/read-trace.mjs`,
  `lib/read-trace.mjs`, `bin/subagent-trace.mjs`, `lib/subagent-trace.mjs` and their two tests; remove the
  PostToolUse registration (`hooks/hooks.json:15-25`) and update the pin. Cut every importer: the `reads`
  subcommand (`planning/reads.mjs`, `planning.mjs:226`, `:269`), `core.mjs:31`, R7 and `IN_DISPATCH_FLOORS`
  in `lib/trace-suggest.mjs` (`:100-103`, `:649-720`) with their test cases, `lib/arg-contract.mjs:1372-1385`,
  the expectations in `planning-trace-ignore.test.mjs` and `prose-agreement.test.mjs:2830-2842`,
  `.gitignore:50`, `:54`, and the prose references in `references/` and `workflows/execute.md`. Nothing
  reads or writes `.planning/reads.jsonl` afterwards. Commit separately.
- **Verify:** `node cadence-core/bin/test.mjs planning`; `node cadence-core/bin/test.mjs prose`;
  `node cadence-core/bin/test.mjs other`; `cargo test -p cadence --test phase7_guard -- hooks`.

## Notes

Execution rules: PLAN-1.md Notes. The continuation record reuses the owner-attributed `execution-authorize` answer rather than a
new override `Meaning` (D-113); age is store generations since launch; the known gap stands written: a
host that never fires SubagentStop leaves the dispatch launched, and the owner's resume decides; the JS
suite stays green because CI runs it (`.github/workflows/test.yml:47`).
