---
phase: 17
plan: 2
requirements: ["T2"]
files: ["crates/cadence/src/task/model.rs","crates/cadence/src/task/render.rs","crates/cadence/src/task/mod.rs","crates/cadence/src/task_service.rs","crates/cadence/src/store/model.rs","crates/cadence/src/store/writer.rs","crates/cadence/src/store/transaction.rs","crates/cadence/src/store/filesystem.rs","crates/cadence/src/execution/render.rs","crates/cadence/src/read/document.rs","crates/cadence/src/read/model.rs","crates/cadence/src/guard/mod.rs","crates/cadence/tests/task_record.rs","crates/cadence/tests/support/task_fixtures.rs","crates/cadence/tests/support/support_records.rs","crates/cadence/tests/support/serve.rs","cadence-core/workflows/task.md","cadence-core/bin/planning/task-record.mjs","cadence-core/bin/planning-task-record.test.mjs","cadence-core/bin/planning.mjs","cadence-core/bin/planning-recall.test.mjs","cadence-core/bin/support/task-history-fixtures.mjs","cadence-core/bin/planning-lease-check.test.mjs","cadence-core/bin/lib/arg-contract.mjs","cadence-core/bin/prose-agreement.test.mjs","cadence-core/bin/trace.test.mjs","cadence-core/bin/lib/bulk-output.mjs","cadence-core/bin/bulk-output.test.mjs","cadence-core/bin/weight-budgets.json","cadence-core/bin/helper-census.test.mjs","cadence-core/bin/lib/census-registry.mjs","cadence-core/bin/census-registry.test.mjs","cadence-core/bin/test.mjs","cadence-core/bin/arg-contract.test.mjs","cadence-core/bin/reason-census.test.mjs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P17-2-T1","verify":["cargo nextest run -p cadence --test task_record task_rooted_done_writes_the_record_before_done"]},{"id":"P17-2-T2","verify":["cargo nextest run -p cadence --test task_record task_rooted_done_writes_the_record_before_done","node --test --test-name-pattern='task-record|task record' cadence-core/bin/planning-recall.test.mjs","node --test cadence-core/bin/task-record.test.mjs","node --test --test-name-pattern='detail' cadence-core/bin/planning-lease-check.test.mjs","node --test cadence-core/bin/helper-census.test.mjs","node --test cadence-core/bin/census-registry.test.mjs","node --test --test-name-pattern='every flag in every row' cadence-core/bin/arg-contract.test.mjs","node --test --test-name-pattern='every committed refusal token is still produced by the live tree' cadence-core/bin/reason-census.test.mjs"]}]}
---
## Goal

A rooted task is done only after its store record and protected Markdown projections are acknowledged.

## Must be true when done

- T2. When a task is done under a planning root, the owner sees the task's commits and files in the binary's task record, rendered to .planning/tasks/<slug>/RECORD.md, acknowledged before done, and done refused naming the write when the record cannot be written.

## Context

Plan 1 supplies identity, operations and the executor front door. The projection pattern is crates/cadence/src/execution/render.rs:39 (debug) and :47 (spike), and writer acknowledgments await request completion at crates/cadence/src/store/writer.rs:304. protected_target at crates/cadence/src/guard/mod.rs:284 covers store, debug, spikes and selected phase outputs but not tasks. At HEAD, git ls-files .planning/tasks/ yields 14 distinct tracked task directories, not the five claimed by the context. The existing shared JavaScript task-record library is still imported by planning/recall.mjs and lib/why-corpus.mjs; only the command writer is replaced here.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "check/task_rooted_done_writes_the_record_before_done",
      "spec": {
        "command": "cargo nextest run -p cadence --test task_record task_rooted_done_writes_the_record_before_done",
        "expected": {
          "kind": "property",
          "value": "Both actual commit hashes in order and their exact filenames are present in the native record; independently hand-written RECORD grammar contains those observed values and equals the installed bytes (also equal to the actual renderer output). A done answer is followed immediately by a successfully reopened acknowledged record/projection transaction. Guard refuses both host writes. Planned open installs PLAN.md and close records each planned outcome. A failed record write names its path, refuses done and leaves no successful close receipt. Every byte of all 14 tracked historical directories is identical before and after."
        },
        "test": {
          "file": "crates/cadence/tests/task_record.rs",
          "function": "task_rooted_done_writes_the_record_before_done"
        },
        "setup": "Use Client at crates/cadence/tests/support/serve.rs:21, support_records::fixture at crates/cadence/tests/support/support_records.rs:7, git_value at crates/cadence/tests/support/serve.rs:470 and reopened at :224. Seed the fixture with byte copies of every tracked historical task directory read from the checkout; assert the handwritten HEAD inventory count 14, retain each path/byte map, and choose a fresh slug. Initialize a real git baseline and neutral risk config. Prepare independent rooted inline, planned and write-failure fixtures; no mocked store or git.",
        "call": "task-open inline through serve, make two commits to alpha.txt and beta.txt, task-close. Capture real git log --format=%H and diff --name-only for the independently observed range. Stop/restart the real binary, read the typed task document and journal with reopened. Probe guard Write and Edit against RECORD.md. Repeat planned open/close with explicit task outcomes and inspect PLAN.md at open. Before the failure close, make .planning/tasks unable to accept its directory/record write.",
        "boundary": "Real serve operations, real store/restart and git repo; guard is the real hook binary, never a fabricated guard response.",
        "fakes": []
      },
      "reason": "This one check causes T2's trigger and inspects its stated outcome.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "The trigger and outcome are exercised at the real boundary for T2."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/rooted-task-record",
      "spec": {
        "locators": [
          "crates/cadence/src/task/model.rs",
          "crates/cadence/src/store/writer.rs",
          "crates/cadence/src/store/transaction.rs"
        ],
        "substance": "The rooted task record kind and request receipts are durable and transactionally acknowledged before done."
      },
      "reason": "The rooted task record kind and request receipts are durable and transactionally acknowledged before done.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "This artifact is required for T2's stated outcome."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/task-record-projections",
      "spec": {
        "locators": [
          "crates/cadence/src/task/render.rs",
          "crates/cadence/src/execution/render.rs",
          "crates/cadence/src/store/filesystem.rs"
        ],
        "substance": "Binary-owned RECORD.md and planned PLAN.md renderers install only the fresh task's projections; historical directories remain unchanged."
      },
      "reason": "Binary-owned RECORD.md and planned PLAN.md renderers install only the fresh task's projections; historical directories remain unchanged.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "This artifact is required for T2's stated outcome."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/task-protection",
      "spec": {
        "locators": [
          "crates/cadence/src/guard/mod.rs"
        ],
        "substance": "protected_target covers .planning/tasks/<slug>/ including RECORD.md and PLAN.md."
      },
      "reason": "protected_target covers .planning/tasks/<slug>/ including RECORD.md and PLAN.md.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "This artifact is required for T2's stated outcome."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/task-write-refusal",
      "spec": {
        "locators": [
          "crates/cadence/src/task_service.rs",
          "crates/cadence/src/store/writer.rs"
        ],
        "substance": "A record/projection write failure produces a refusal naming the failed write, never a done or an unrecorded rooted success."
      },
      "reason": "A record/projection write failure produces a refusal naming the failed write, never a done or an unrecorded rooted success.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "This artifact is required for T2's stated outcome."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/task-writer-retirement",
      "spec": {
        "locators": [
          "cadence-core/bin/planning.mjs",
          "cadence-core/bin/lib/arg-contract.mjs",
          "cadence-core/bin/planning-recall.test.mjs",
          "cadence-core/bin/weight-budgets.json"
        ],
        "substance": "The replaced workflow, command module and writer tests are absent; frozen recall/why history readers and their shared task-record library/tests remain connected."
      },
      "reason": "The replaced workflow, command module and writer tests are absent; frozen recall/why history readers and their shared task-record library/tests remain connected.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "This artifact is required for T2's stated outcome."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Persist and guard rooted task records, with the one rooted check

- **ID:** P17-2-T1
- **Files:** crates/cadence/src/task/model.rs, crates/cadence/src/task/render.rs, crates/cadence/src/task/mod.rs, crates/cadence/src/task_service.rs, crates/cadence/src/store/model.rs, crates/cadence/src/store/writer.rs, crates/cadence/src/store/transaction.rs, crates/cadence/src/store/filesystem.rs, crates/cadence/src/execution/render.rs, crates/cadence/src/read/document.rs, crates/cadence/src/read/model.rs, crates/cadence/src/guard/mod.rs, crates/cadence/tests/task_record.rs, crates/cadence/tests/support/task_fixtures.rs, crates/cadence/tests/support/support_records.rs, crates/cadence/tests/support/serve.rs
- **Action:** Extend the task namespace defined in plan 1 with validated rooted open/close records and idempotent request receipts, in the store's established record/intent algebra. Bind commits and files to real git observations of the retained start..close range; never accept a caller-invented success, hash list or filenames as the observation. Add TaskV1 intent validation and RECORD.md/PLAN.md external participants to the writer transaction, recovery and installed-projection enumeration. Preserve provenance and reject an existing authored historical slug. A planned open retains the explicit small plan and atomically renders PLAN.md; close retains one outcome per planned task. Expose the task record through the existing document operation's typed task identity, not a third task operation. Return done only after the owning transaction confirms both store and projection bytes. Any blocked/unwritable target refuses with the failed write path and no done; do not recast it as treeless success. Extend protected_target to every .planning/tasks/<slug>/ descendant after the existing containment/symlink resolution, and use real guard Write/Edit probes. Deliver the sole T2 test red then green including historical preservation, inline and planned cases, and a genuinely unwritable .planning/tasks directory: run the fixture child as its ordinary unprivileged owner, or drop the root test child's uid/gid after assigning fixture ownership, then chmod the tasks directory read-only. Do not silently skip under root; a separate child-path obstruction tests named write failure without touching historical siblings.
- **Verify:**
  - cargo nextest run -p cadence --test task_record task_rooted_done_writes_the_record_before_done

### Task 2: Remove the replaced task writer and its frozen assertions

- **ID:** P17-2-T2
- **Files:** cadence-core/workflows/task.md, cadence-core/bin/planning/task-record.mjs, cadence-core/bin/planning-task-record.test.mjs, cadence-core/bin/planning.mjs, cadence-core/bin/planning-recall.test.mjs, cadence-core/bin/support/task-history-fixtures.mjs, cadence-core/bin/planning-lease-check.test.mjs, cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/prose-agreement.test.mjs, cadence-core/bin/trace.test.mjs, cadence-core/bin/lib/bulk-output.mjs, cadence-core/bin/bulk-output.test.mjs, cadence-core/bin/weight-budgets.json, cadence-core/bin/helper-census.test.mjs, cadence-core/bin/lib/census-registry.mjs, cadence-core/bin/census-registry.test.mjs, cadence-core/bin/test.mjs, cadence-core/bin/arg-contract.test.mjs, cadence-core/bin/reason-census.test.mjs
- **Action:** HEAD consumer census: skills/cad-task/SKILL.md is the sole workflow @-include and plan 1 removes it; planning.mjs is the sole command-module importer/dispatcher. Remove workflows/task.md, planning/task-record.mjs and planning-task-record.test.mjs, plus planning.mjs help/import/dispatch and lib/arg-contract.mjs task-record row. planning-recall.test.mjs imports taskRepo, runIn, TASK_COMMITS from the deleted test and invokes the command: move the still-needed real-repository helpers to support/task-history-fixtures.mjs and make the recall fixture an explicitly authored historical RECORD rather than run a deleted writer. Keep lib/task-record.mjs, its dedicated task-record.test.mjs, the imports in planning/recall.mjs and lib/why-corpus.mjs; lib/planning-files.mjs's record parser and lib/trace.mjs's commentary are consumers of the historical grammar, not writer imports. planning-lease-check.test.mjs has a live planning-detail-sites census, not only a comment: recount the 15 total/6 wrapped sites after deleting the writer, update its assertions and matching registry row together. Remove only the task-workflow portions of prose-agreement.test.mjs (risk row, risk-check seam, completion rule, surfaces-unanswered, TASK_WF/PHS-02/PHS-03 and stagedSites), and the task BRACKETING/coordinator row in trace.test.mjs; preserve unrelated frozen assertions. Remove the task row in bulk-output and its row test while that module still exists until plan 7. Remove the task workflow budget and explicit writer-test suite entry, refresh changed census counts/subjects and helper-census comments; do not weaken surviving helper uniqueness. Confirm the includes/imports census again before deletion. Recount arg-contract.test.mjs's current 182 flag-entry census after removing the task-record row, retaining its unchanged top-level row count until plan 7 removes self-verify. Remove the retired no-range and no-record entries from REASON_TOKENS in cadence-core/bin/reason-census.test.mjs in the same deletion commit; its test 'every committed refusal token is still produced by the live tree' must stay green. HEAD census re-read: liveTokens at cadence-core/bin/reason-census.test.mjs:141 delegates to refusalSites, whose sourceFiles walk at cadence-core/bin/lib/refusal-hints.mjs:404 recursively scans regular .mjs files under cadence-core/bin, skips *.test.mjs, and applies REGISTER file/token exclusions plus comment stripping; isLiteral at cadence-core/bin/reason-census.test.mjs:135 retains only anchored reason: '<token>' or fail('<token>' spellings. The deleted command writer produces bad-args, no-range and no-record in that population: only no-range and no-record have no surviving producer. bad-args remains in other planning commands and planning.mjs. The removed task-record dispatch arm at cadence-core/bin/planning.mjs:276 only calls cmdTaskRecord and emits no token; its surviving bad-args producers remain. planning-task-record.test.mjs and task-record.test.mjs are excluded from the walk, and workflows/task.md is outside both its directory and extension scope. No other committed token loses its sole producer in plan 2; retain the census and its shared refusal-hints dependency.
- **Verify:**
  - cargo nextest run -p cadence --test task_record task_rooted_done_writes_the_record_before_done
  - node --test --test-name-pattern='task-record|task record' cadence-core/bin/planning-recall.test.mjs
  - node --test cadence-core/bin/task-record.test.mjs
  - node --test --test-name-pattern='detail' cadence-core/bin/planning-lease-check.test.mjs
  - node --test cadence-core/bin/helper-census.test.mjs
  - node --test cadence-core/bin/census-registry.test.mjs
  - node --test --test-name-pattern='every flag in every row' cadence-core/bin/arg-contract.test.mjs
  - node --test --test-name-pattern='every committed refusal token is still produced by the live tree' cadence-core/bin/reason-census.test.mjs

## Notes

D-209. Keep all 14 historical task directories as authored bytes; no bulk import, normalization or overwrite of an occupied historical slug. RECORD.md is the rooted projection; planned identity additionally renders PLAN.md at open and per-task outcomes at close. No new wire operation or pin movement here. Retain cadence-core/bin/lib/task-record.mjs and cadence-core/bin/task-record.test.mjs because recall and why-corpus still consume the library; unconditional deletion would violate the prompt's no-surviving-consumer rule. The obsolete workflow, command writer and writer tests are deleted in this replacement plan. Sequential overlap with plan 1 is limited to rooted behavior/projections; later plans separately edit writer shutdown/acquisition. Correction run: reason-census.test.mjs is leased with the writer deletion; retire exactly no-range and no-record alongside their sole producer. Its liveTokens population scans production .mjs under cadence-core/bin, not workflow prose or *.test.mjs. The task dispatch arm adds no producer, and bad-args still has live producers. This lease has no overlap with another plan's reason-census edits.
