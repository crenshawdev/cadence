---
phase: 14
plan: 1
requirements: ["T2"]
files: ["crates/cadence/src/progress_service.rs","crates/cadence/src/lib.rs","crates/cadence/src/main.rs","crates/cadence/src/server.rs","crates/cadence/src/next_action_service.rs","crates/cadence/src/derivation_service.rs","crates/cadence/src/recall/mod.rs","crates/cadence/tests/phase14_receipts.rs","crates/cadence/tests/support/phase14.rs","skills/cad-progress/SKILL.md","skills/cad-health/SKILL.md","skills/cad-report/SKILL.md"]
directories: ["crates/cadence/src/progress","crates/cadence/src/next_action"]
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P14-1-T1","verify":["cargo test -p cadence --test phase14_receipts phase14_progress_reports_status_issues_and_one_next_action -- --exact"]},{"id":"P14-1-T2","verify":["cargo test -p cadence --test phase14_receipts phase14_progress_reports_status_issues_and_one_next_action -- --exact","cargo run -p cadence -- progress-instructions"]}]}
---
# Phase 14: Receipts and retune - Plan 1

## Goal

One `progress` answer from the binary: status per phase, located issues, the current phase's record,
the capture count and the one next action; cad-health and cad-report folded in (D-138).

## Must be true when done

- T2. When the owner asks for progress, the owner sees every phase's derived status, the located issues and the one next action.

## Context

Lifecycle, next action, capture bound, deferred queue and the declared-phase label are all derived today
(`derivation_service.rs:81-151`, `next_action_service.rs:212-298`, `next_action/select.rs:54-65`,
`import/mod.rs:775-782`, `next_action/observations.rs:133-214`, `derivation/mod.rs:76-128`) but none is a
stdio operation (`server.rs:240-291`). A roadmap conflict refuses the checked query
(`derivation/query.rs:90`); progress must report it located, never repair (phase 13 R8).

## Common setup (every plan of this phase)

Every check runs the real binary: `env!("CARGO_BIN_EXE_cadence") serve --project-root <fresh disposable
project>` over stdio JSON-RPC as `tests/support/phase13.rs:22-56` (`Client::open`, `Client::call`) does.
Files, the store journal, Git commits and child processes stay real; only the caller's inputs and the
test's own clock window are controlled (the binary has no clock override; its one wall clock is
`review/material_io.rs:238-245`, seconds, so a time assertion brackets the call with the test's clock).
No mock store, fake process result, direct reducer call, model reply or production renderer supplies an
expected value; every expected value is handwritten. Reopen with `reopened` (`support/phase13.rs:211-224`)
and restart with a fresh `Client::open` wherever durability is asserted. Test file
`crates/cadence/tests/phase14_receipts.rs`, one function per truth; new fixture builders in
`crates/cadence/tests/support/phase14.rs`. Never the live tree. No observation items (owner's ruling). A
compiled front door is asserted inside its truth's own check (`tests/phase13_verification.rs:1200-1215`).

## Progress text grammar (fixed here; later checks write lines by hand)

The `progress` answer is `{"status":"ok","text":<rendered>,"phases":[..],"issues":[..],"record":{..},
"dispatch":<null|{..}>,"captures":{..},"next":{..}}`; `text`:

```
# progress: <project dir name>, phase <current> of <total>: <name>
phase <id>: <name> - <status>[ (<provenance word>, unverified)][ - UAT <p> pass, <f> fail[, <s> skipped]][ - plans <n>]
Issues: <count>
  ROADMAP.md:<line> entry <entry> declares phase <id> complete; derived <status>
Record (phase <current>): <r> routing decisions, <f> refusals, <g> gate fires
  refused <code> at <located summary>, <at>
Dispatch: dispatch <id> interrupted, no return; <k> generations since launch
Captures: <active> active of <bound>[, over bound]
Next: <instruction>
```

`<status>` is the `LifecycleStatus` word (`derivation/model.rs:4-11`); a declared completion renders
`complete (declared at import, unverified)` or `(declared at adoption, unverified)` with the on-disk UAT
counts, a native one `complete`/`complete-with-waivers` with `met <m>, waived <w>`, a legacy one `complete`
with its UAT counts. `Record` refusal lines list located fields as `key=value` in field order, `<at>` in
integer seconds (plan 3); `Dispatch:` only while a launched dispatch has stopped without returning
(plan 4); `Next:` is exactly one compiled-rule instruction (`next_action/select.rs:54-65`).

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P14-T2-C",
      "spec": {
        "command": "cargo test -p cadence --test phase14_receipts phase14_progress_reports_status_issues_and_one_next_action -- --exact",
        "expected": {
          "kind": "literal",
          "value": "First `text` lines: `# progress: <dir>, phase 5 of 3: Legacy`; `phase 5: Legacy - planned - plans 1`; `phase 13: Plan publication - executed`; `phase 28: Next phase - unplanned`; `Issues: 0`; `Record (phase 5): 0 routing decisions, 0 refusals, 0 gate fires`; `Captures: 0 active of 40`; `Next: /cad-execute 5`. Second: same rows, `Issues: 1` then `  ROADMAP.md:2 entry 0 declares phase 5 complete; derived planned`, `Next: Resolve ROADMAP.md:2 entry 0: declare phase 5 with adoption-declare or untick it`. Third equals the second byte for byte. Exactly one `Next:` line per answer. `derivation.intake.retired == true`. Every manifested byte identical except the test's tick. `cadence progress-instructions` stdout equals `skills/cad-progress/SKILL.md`; `skills/cad-health/SKILL.md` and `skills/cad-report/SKILL.md` absent."
        },
        "test": {
          "file": "crates/cadence/tests/phase14_receipts.rs",
          "function": "phase14_progress_reports_status_issues_and_one_next_action"
        },
        "setup": "`Completed::new()` (`support/phase13.rs:486`); insert `- [ ] **Phase 5: Legacy**` above the phase 13 row of ROADMAP.md; write `phases/5/PLAN-1.md` (valid legacy body) and `deferred/5/DEFERRED-diff-1.json` with one finding; manifest every `.planning` document byte.",
        "call": "`progress`; tick the phase 5 row; `progress`; restart; `progress`; `reopened`.",
        "boundary": "real serve binary over stdio, real derivation, real journal",
        "fakes": [
          "the caller's inputs",
          "the test's own clock window read around each call"
        ]
      },
      "reason": "Stale rows, a hidden or repaired conflict, or more or fewer than one next action would break what the owner sees.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "Stale rows, a hidden or repaired conflict, or more or fewer than one next action would break what the owner sees."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T2-A1",
      "spec": {
        "locators": [
          "crates/cadence/src/progress_service.rs",
          "crates/cadence/src/progress/render.rs",
          "crates/cadence/src/next_action/select.rs Rule::Conflict"
        ],
        "substance": "The stdio progress operation: checked lifecycle, issue lines naming path, line, zero-based entry and phase id, record and capture blocks, one next action; no document write."
      },
      "reason": "Without it the owner has no status, no located issue, no single next action.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "Without it the owner has no status, no located issue, no single next action."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T2-A2",
      "spec": {
        "locators": [
          "crates/cadence/src/progress/instructions.rs",
          "skills/cad-progress/SKILL.md",
          "skills/cad-health (absent)",
          "skills/cad-report (absent)"
        ],
        "substance": "The compiled, query-only cad-progress front door; cad-health and cad-report deleted per D-138."
      },
      "reason": "A surviving alias or workflow route would show sub-views instead of the one answer.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "A surviving alias or workflow route would show sub-views instead of the one answer."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Serve progress over stdio and render one answer

- **Files:** the lease; new `progress/`, `progress_service.rs`, the test file, `support/phase14.rs`.
- **Action:** Deliver P14-T2-C, P14-T2-A1. Add `{"operation":"progress"}` to
  `QueryArguments`, routed through the resident loop (`recall/mod.rs:488-493`) to `progress_service::query`:
  the checked lifecycle query (memo published, cursor retired as today), `next_action_service::query`, the
  capture report and the current phase's decisions, rendered in the grammar above. A `StateConflict`
  (`derivation/model.rs:147-152`) must not refuse progress: keep the rows and emit the issue line from its
  fields and the phase id; other `DerivationError`s still refuse. Add a tenth rule ahead of `Pause` in
  `select.rs:54-65`: `Conflict` selects `Action::Resolve { phase, source }` for the lowest conflicting
  phase, rendered `Resolve ROADMAP.md:<line> entry <entry>: declare phase <id> with adoption-declare or
  untick it`.
- **Verify:** `cargo test -p cadence --test phase14_receipts phase14_progress_reports_status_issues_and_one_next_action -- --exact`.

### Task 2: Compile the cad-progress front door; retire health and report

- **Files:** `progress/instructions.rs`, `main.rs`, `skills/cad-progress`, the two deleted skills.
- **Action:** Deliver P14-T2-A2. `cadence progress-instructions` (`main.rs:71-140`, the `PlanInstructions`
  arm `:107-116` is the pattern) renders `progress::instructions::markdown()`; regenerate
  `skills/cad-progress/SKILL.md` (query-only tools, no Write/Edit, no `CLAUDE_PLUGIN_ROOT`, no `@`-include):
  call `progress` once, print `text`. Delete `skills/cad-health/` and `skills/cad-report/` (D-138). The T2 check
  asserts the bytes and the two absences.
- **Verify:** `cargo test -p cadence --test phase14_receipts phase14_progress_reports_status_issues_and_one_next_action -- --exact`.

## Notes

Plans run sequentially PLAN-1 to PLAN-6; shared paths are sequential leases. New paths are
creation locations; test names not in the tree are creation specifications; implement new Rust names
from the actual code. For each task delivering a check the executor commits the test first with subject
`test(14): <function> red <task id>`, then the implementation with `feat(14): <summary> green <task id>`,
and inspects why red failed. Verify commands are narrow; the suite runs once at plan close, then
`cargo clippy --workspace --all-targets -- -D warnings` with null stdin. 3.x prose and scripts are frozen
reference material.

Planner decision: no paused override in the T2 fixture; a pause override is written only by a
test-only resident request (`pause_service.rs:443-471`, `server.rs:110-115`) with no stdio operation at
HEAD. The deferred member is a real `deferred/<phase>/DEFERRED-<trigger>-<disc>.json` file.
