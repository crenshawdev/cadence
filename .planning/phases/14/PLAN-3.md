---
phase: 14
plan: 3
requirements: ["T6"]
files: ["crates/cadence/src/execution_service.rs","crates/cadence/src/evidence/persistence.rs","crates/cadence/src/guard/audit.rs","crates/cadence/src/import/decisions.rs","crates/cadence/src/derivation/model.rs","crates/cadence/src/progress/render.rs","crates/cadence/src/progress_service.rs","crates/cadence/tests/phase14_receipts.rs","crates/cadence/tests/support/phase14.rs","crates/cadence/tests/mcp.rs","crates/cadence/tests/phase12_execution.rs"]
directories: ["crates/cadence/src/rail","crates/cadence/src/verification","crates/cadence/src/execution","crates/cadence/src/store"]
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P14-3-T1","verify":["cargo test -p cadence --test phase14_receipts phase14_refusal_records_carry_code_detail_and_time -- --exact"]},{"id":"P14-3-T2","verify":["cargo test -p cadence --test phase14_receipts phase14_refusal_records_carry_code_detail_and_time -- --exact"]},{"id":"P14-3-T3","verify":["cargo test -p cadence --test phase12_execution -- routing"]}]}
---
# Phase 14: Receipts and retune - Plan 3

## Goal

Every decision record written from now on carries when it happened; every refusal carries its code and
a typed located detail; close-path refusals are recorded; progress shows them (D-140, D-143).

## Must be true when done

- T6. When an operation is refused, the owner sees the refusal in the log with its code, its located detail and when it happened.

## Context

`DecisionRecord` (`store/model.rs:101-107`) carries no time; `BoundaryV1` (`execution/boundary.rs:427-439`,
`lease_refusal` `:437-438` is the typed-object precedent) cuts reasons at 1024 bytes without a marker
(`:270-274`); `stable_reason` (`execution_service.rs:2295-2304`) and `derivation_refusal` (`:2399-2428`)
flatten most codes; close-path refusals answered by `native_error` (`:54-64`), the lease refusal among
them (`execution/receipts.rs:457`), are never recorded. Clock: `review/material_io.rs:238-245`. Common setup and the progress text grammar: PLAN-1.md, the two sections of those names.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P14-T6-C",
      "spec": {
        "command": "cargo test -p cadence --test phase14_receipts phase14_refusal_records_carry_code_detail_and_time -- --exact",
        "expected": {
          "kind": "literal",
          "value": "(a) `code: \"state-conflict\"`; one `BoundaryV1` record, `outcome` `refused:state-conflict`, `located` = `{source:\"ROADMAP.md\",line:5,entry:3,phase:4,field:\"complete\",declared:\"true\",derived:\"planned\"}`, `at` in the window. (b) `rule: \"lease\"`, `slot: \"evidence_commits\"`, `id` the red sha; one record `refused:lease`, `located` = `{rule:\"lease\",slot:\"evidence_commits\",id:<sha>,path:\"docs/outside.md\"}`, `at` in the window. (c) `code: \"missing-roadmap\"`, `reason` contains `ROADMAP.md` and not `execution validation failed`; one record `refused:missing-roadmap`, `located` = `{rule:\"missing-roadmap\",slot:\"roadmap\",path:\".planning/ROADMAP.md\"}`, `at` in the window. No envelope reason is the generic sentence. Progress (a) contains `Record (phase 4): 0 routing decisions, 1 refusals, 0 gate fires` then `  refused state-conflict at source=ROADMAP.md line=5 entry=3 phase=4 field=complete declared=true derived=planned, <at>` with the record's integer; progress (b) lists `refused lease at rule=lease slot=evidence_commits id=<sha> path=docs/outside.md, <at>`. Repeating (a) after restart answers the same refusal and the log still holds exactly one record for it. Every record written after first touch carries `at`; imported rows carry none."
        },
        "test": {
          "file": "crates/cadence/tests/phase14_receipts.rs",
          "function": "phase14_refusal_records_carry_code_detail_and_time"
        },
        "setup": "Three projects: (a) plan 2's legacy tree with phase 4 ticked AFTER the first touch; (b) `Completed::published(false, |_| {})` admitted, authorized and dispatched for plan 1 as `Completed::execute` begins (`support/phase13.rs:566-602`), whose red commit also adds `docs/outside.md`, outside plan 1's lease; (c) a fresh project whose `.planning/` holds `config.json` and no ROADMAP.md. The test reads its clock (seconds) before the first call and after the last.",
        "call": "(a) `execute-next` 4; (b) `execution-task-close` naming the out-of-lease red commit in `evidence_commits`; (c) `execute-next` 1; `progress` on (a) and (b); restart; repeat (a); `reopened` each store, read `decisions`.",
        "boundary": "real refusing operations over stdio, real journal reopened; the clock is read by the test, never replaced",
        "fakes": [
          "the caller's inputs",
          "the test's own clock window read around each call"
        ]
      },
      "reason": "A refusal recorded without code, located object or at, or with the generic sentence, cannot be placed in time or joined to a line.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "A refusal recorded without code, located object or at, or with the generic sentence, cannot be placed in time or joined to a line."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T6-A1",
      "spec": {
        "locators": [
          "crates/cadence/src/store/model.rs DecisionRecord.at",
          "crates/cadence/src/execution/boundary.rs Located",
          "crates/cadence/src/execution_service.rs stable_reason"
        ],
        "substance": "at on every decision record written from now on; the typed located object beside the bounded envelope, a roadmap conflict carrying source, line, zero-based entry and the phase id itself; every code's own detail retained."
      },
      "reason": "Dropping at, located or the detail leaves the log counting refusals, not explaining them.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "Dropping at, located or the detail leaves the log counting refusals, not explaining them."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T6-A2",
      "spec": {
        "locators": [
          "crates/cadence/src/execution_service.rs close-path refusal recording"
        ],
        "substance": "Every cadence_apply execution-* typed refusal also recorded as a boundary decision with outcome, located object and at, the lease refusal included."
      },
      "reason": "A refusal answered but never recorded is one the owner cannot see in the log.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "A refusal answered but never recorded is one the owner cannot see in the log."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T6-A3",
      "spec": {
        "locators": [
          "crates/cadence/src/progress/render.rs Record block refusal lines"
        ],
        "substance": "The progress Record block listing the phase's refusals with code, located summary and at."
      },
      "reason": "Without the lines the record exists but the owner never sees it.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "Without the lines the record exists but the owner never sees it."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Time and located detail on every recorded refusal

- **Files:** the lease (every non-test `DecisionRecord {` construction site).
- **Action:** Deliver P14-T6-C, P14-T6-A1, P14-T6-A3. Add `at: Option<u64>` (seconds;
  `#[serde(default, skip_serializing_if = "Option::is_none")]`) to `DecisionRecord`, stamped from
  `Clock`/`WallClock` at every construction site the writer commits from now on (imported rows stay
  absent), excluded from `validate_routing`'s (`store/writer.rs:2044-2056`) and any other whole-record
  equality. Add `located: Option<Located>` beside `lease_refusal`: `{source, line, entry, phase, field,
  declared, derived}` for a roadmap conflict (the phase id itself, never the ordinal alone: `entry 8` was
  read as phase 8 when it meant phase 9), `{rule, slot, path}` for a missing or invalid input, `{rule,
  slot, id, path}` for a lease, `{rule, slot, id}` otherwise. Keep the 1024-byte bound, append `[cut]`
  when truncated. `stable_reason` returns the detail for every code; `derivation_refusal` carries each
  `DerivationError`'s own fields. Progress lists the phase's refusals in `Record`. Update the
  phase 12/13 regressions that pin the generic sentence; weaken no assertion on codes or replay.
- **Verify:** `cargo test -p cadence --test phase14_receipts phase14_refusal_records_carry_code_detail_and_time -- --exact`.

### Task 2: Record native close-path refusals

- **Files:** `execution_service.rs`, `execution/`, `store/writer.rs`.
- **Action:** Deliver P14-T6-A2. Every `cadence_apply execution-*` refusal answered through `native_error`
  is also recorded as a `BoundaryV1` decision, outcome `refused:<code>`, the `Diagnostic`'s rule, slot, id
  and reason in `located` and the envelope, plus `at`, as `record_lease_refusal` (`:1529`, `:2166-2184`)
  records the patch's `undeclared-files`. The out-of-lease evidence commit (`receipts.rs:457`) is the
  named case: `{rule:"lease", slot:"evidence_commits", id:<commit>, path:<path>}`. Recording never changes the answer; a replayed
  refusal does not duplicate (operation id = boundary identity, `:2221-2231`).
- **Verify:** `cargo test -p cadence --test phase14_receipts phase14_refusal_records_carry_code_detail_and_time -- --exact`.

### Task 3: Fill the routing decision's outcome edge

- **Files:** `store/writer.rs`, `execution/patch.rs`, `tests/phase12_execution.rs`.
- **Action:** P9, a task not a truth: when the executor patch lands (`patch.rs:74-127`, receipt `:183`)
  the decision `routing:<dispatch id>` (`writer.rs:2008-2042`) gains a second revision whose `receipt` is
  the identity of the boundary record that answered the dispatch; `observed_effort` stays `Missing`;
  `validate_routing` accepts the later revision. Extend one existing phase 12 routing regression.
- **Verify:** `cargo test -p cadence --test phase12_execution -- routing`.

## Notes

Execution rules: PLAN-1.md Notes. `at` is seconds (D-143) from the review `Clock` trait; `located` rides the boundary record;
draft D's request echo is not added; P10 stands.
