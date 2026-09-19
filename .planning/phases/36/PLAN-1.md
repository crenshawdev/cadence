---
phase: 36
plan: 1
requirements: ["T1","T4"]
files: ["crates/cadence/src/plan/associations.rs","crates/cadence/src/plan/limits.rs","crates/cadence/src/plan/map_view.rs","crates/cadence/tests/phase36_released_checks.rs","crates/cadence/tests/support/phase13.rs"]
directories: []
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P36-1-T1","verify":["cargo test -p cadence --test phase36_released_checks phase36_blocked_check_can_be_republished_with_changed_spec -- --exact"]},{"id":"P36-1-T2","verify":["cargo test -p cadence --test phase36_released_checks phase36_evidence_read_retains_released_check_as_superseded -- --exact"]}]}
---
# Phase 36: What a blocked plan leaves behind - Plan 1

## Goal

Release the check definitions owned by unfinished tasks in blocked plans from the current publication union, while retaining the old definition visibly in evidence-read and leaving every other published item current.

## Must be true when done

- T1. When a plan is blocked and a later plan publishes a released check id with a changed spec, the owner sees the preview accepted.
- T4. When a check is released, the owner sees its old definition in evidence-read as retained, not current.

## Context

D-158 is the exact rule at .planning/phases/36/CONTEXT.md:8. Today candidate adds every saved publication map to the current union at crates/cadence/src/plan/associations.rs:42-65. A later item with the released id and changed definition therefore reaches evidence-item-conflict at crates/cadence/src/plan/associations.rs:114-119; for the one-entry later submission the refusal slot is submission.plans[0].content.evidence_map.items[0].id. The distinct-check policy then counts every contribution at crates/cadence/src/plan/limits.rs:155-190. The replacement escape is unavailable because an admitted plan is refused at crates/cadence/src/plan/validation.rs:56-57.

Use only facts already retained. A task projection becomes completed only from Event::Close at crates/cadence/src/execution/history.rs:75-88, and plan_task_views joins that projection to the immutable first-admission allocation at crates/cadence/src/execution/history.rs:100-115. A retained blocked outcome distinguishes an unclosed retired task from a not-run task at crates/cadence/src/execution/history.rs:554-570. Derive released canonical check revisions from those records; do not add a record, operation or store file. D-120 remains intact: “A shared check is reused only while its exact item, map and truth authority still applies; a changed spec needs fresh receipts” at .planning/phases/12/CONTEXT.md:325-334.

T4 requires one explicit lease exception. The public handler routes evidence-read at crates/cadence/src/server.rs:717-750 and plan_service delegates it unchanged at crates/cadence/src/plan_service.rs:24-25. Its current-set assembly is crates/cadence/src/plan/map_view.rs:146-215, which does not call associations::candidate, so T4 cannot be delivered by editing only associations.rs and limits.rs. Add crates/cadence/src/plan/map_view.rs to this previewed lease. Reuse the existing history[].status field defined as current or superseded at crates/cadence/src/plan/map_history.rs:44-52; do not change the answer shape, map history record or server. The old definition remains in history publication bytes, while current items/aliases/associations omit it and the blocked plan's artifacts remain current.

The checks use the real stdio Client at crates/cadence/tests/support/phase13.rs:15-92 and the phase-34 retirement fixture sequence at crates/cadence/tests/phase34_blocked_path.rs:39-67, crates/cadence/tests/phase34_blocked_path.rs:118-150 and crates/cadence/tests/phase34_blocked_path.rs:318-324. They build fresh disposable public records; no phase-34 file changes.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P36-T1-C",
      "spec": {
        "command": "cargo test -p cadence --test phase36_released_checks phase36_blocked_check_can_be_republished_with_changed_spec -- --exact",
        "expected": {
          "kind": "property",
          "value": "After the first admitted plan is retired with its check-owning task unclosed, a complete plan-read preview for a later plan returns status \"ok\" even though it republishes the same check id with a deliberately changed command, expected property and test locator. The preview retains the blocked plan's non-check artifact in the current union, contains only the later definition as the current check, and reports coverage.uncovered == [] and coverage.without_check == []."
        },
        "test": {
          "file": "crates/cadence/tests/phase36_released_checks.rs",
          "function": "phase36_blocked_check_can_be_republished_with_changed_spec"
        },
        "setup": "Create a fresh disposable signed Git project and start env!(CARGO_BIN_EXE_cadence) through tests/support/phase13.rs Client. Through public stdio, context-submit one approved fixture truth, plan-submit an initial attached map with one check and one artifact, execution-admit its exact publication/map revisions and task allocation, execution-authorize it, execute-next, execution-task-start, then execution-task-retire the active unfinished owner task using the phase-34 retirement sequence. Allocate a later plan identity through plan-read and build its attached map with the same check id but handwritten changed spec. Do not seed the store or call plan validators directly.",
        "call": "Call cadence_query plan-read with the complete later-plan submission and assert its returned normalized submission, current coverage and accepted status against handwritten values.",
        "boundary": "Real binary over MCP stdio -> persisted context/publication/admission/task-retirement records -> complete publication-union preview.",
        "fakes": []
      },
      "reason": "If the old blocked check remains in the current union, today's evidence-item-conflict refusal fires before the accepted preview.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "The public-boundary result is the one approved by phase 36 T1."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P36-T4-C",
      "spec": {
        "command": "cargo test -p cadence --test phase36_released_checks phase36_evidence_read_retains_released_check_as_superseded -- --exact",
        "expected": {
          "kind": "property",
          "value": "After the admitted check-owning task is retired without a Close event, evidence-read omits the old check id from current items, aliases and associations; keeps the blocked plan's handwritten artifact current; and retains the exact old check definition under history with status \"superseded\" rather than \"current\". The answer remains schema acceptance-map-view-1 and coherence consistent."
        },
        "test": {
          "file": "crates/cadence/tests/phase36_released_checks.rs",
          "function": "phase36_evidence_read_retains_released_check_as_superseded"
        },
        "setup": "Build a separate fresh disposable signed project with the same real public context-submit, plan-submit, execution-admit, execution-authorize, execute-next, execution-task-start and execution-task-retire path used by the phase-34 fixture. The initial map contains one check with a distinctive handwritten old command/spec plus one artifact. Reopen only through the real stdio server; do not edit native records or manufacture map history.",
        "call": "Call cadence_query with {\"operation\":\"evidence-read\",\"phase\":36} after retirement and compare current collections plus the retained history publication/status to the handwritten old definition.",
        "boundary": "Real binary over MCP stdio -> durable blocked execution facts -> acceptance-map-view-1 current and retained-history serialization.",
        "fakes": []
      },
      "reason": "If evidence-read still assembles every item from the blocked publication as current, the old definition remains in items and its retained history status remains current.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "The public-boundary result is the one approved by phase 36 T4."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P36-A-RELEASED-UNION",
      "spec": {
        "locators": [
          "crates/cadence/src/plan/associations.rs::candidate",
          "crates/cadence/src/plan/limits.rs::checks",
          "crates/cadence/src/plan/map_view.rs::assemble",
          "crates/cadence/src/plan/map_history.rs::view"
        ],
        "substance": "One derived released-check projection identifies canonical check revisions allocated to tasks left without Close in retained Blocked plans. Publication validation and evidence-read exclude only those released definitions from the current set; all non-check items remain current. Evidence-read retains the old map bytes in history and reuses history[].status to label the released definition superseded."
      },
      "reason": "A disagreement between preview filtering, check limits and evidence-read would either block the corrected definition or continue exposing the released one as current.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "This retained implementation is necessary for the owner-visible outcome in T1."
        },
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "This retained implementation is necessary for the owner-visible outcome in T4."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Release blocked ownership during publication validation

- **ID:** P36-1-T1
- **Files:** crates/cadence/src/plan/associations.rs, crates/cadence/src/plan/limits.rs, crates/cadence/tests/phase36_released_checks.rs, crates/cadence/tests/support/phase13.rs.
- **Action:** First add phase36_blocked_check_can_be_republished_with_changed_spec as the red real-stdio check, reusing the phase-34 retirement sequence through the shared phase13 Client and fixture helpers. Add one pure released-check projection from retained admitted-plan order, Blocked outcomes, first-admission allocations and Close-derived task state. Preserve full retained map bytes, but give Contribution a current-item iterator that omits only released check revisions from saved contributions at or before the blocking admission; proposed and later-admission contributions remain eligible. Use that iterator consistently in association definition conflict, coverage and every content/link/check limit loop. The later changed definition must be the sole current definition and get fresh item authority; do not loosen ordinary shared-definition or one-check-per-truth refusals.
- **Verify:** cargo test -p cadence --test phase36_released_checks phase36_blocked_check_can_be_republished_with_changed_spec -- --exact.

### Task 2: Project released definitions as retained, not current

- **ID:** P36-1-T2
- **Files:** crates/cadence/src/plan/associations.rs, crates/cadence/src/plan/map_view.rs, crates/cadence/tests/phase36_released_checks.rs, crates/cadence/tests/support/phase13.rs.
- **Action:** First add phase36_evidence_read_retains_released_check_as_superseded as the second red real-stdio check. Apply the same released-check projection while assemble builds canonical items, aliases, associations, checks and coverage. Keep the blocked publication contribution and all non-check items current. Keep the old map event and exact old check bytes in history, but derive its existing status field as superseded when it contains a released definition; do not add a field, record or persistence write. Assert schema/coherence and handwritten current/history collections. No server, plan_service, map_history, phase-34 file or verification audit change is planned.
- **Verify:** cargo test -p cadence --test phase36_released_checks phase36_evidence_read_retains_released_check_as_superseded -- --exact.

## Notes

Plan 2 depends on this plan's released-check projection. The lease adds only crates/cadence/src/plan/map_view.rs beyond the owner-enumerated list because evidence-read constructs both current definitions and history[].status there; this is reported for owner resolution and is not published by this dispatch. Existing phase-28 replacement-history and phase-29 limit assertions remain unchanged because no blocked execution exists in those fixtures.
