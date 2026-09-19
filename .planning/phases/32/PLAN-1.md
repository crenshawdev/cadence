---
phase: 32
plan: 1
requirements: ["T1","T5"]
files: ["crates/cadence/src/plan/model.rs","crates/cadence/src/plan/render.rs","crates/cadence/src/plan/persistence.rs","crates/cadence/src/plan/validation.rs","crates/cadence/src/plan_service.rs","crates/cadence/src/plan/instructions.rs","crates/cadence/src/read/document.rs","crates/cadence/tests/phase32_typed_authoring.rs","crates/cadence/tests/support/phase13.rs","crates/cadence/tests/support/phase31.rs","crates/cadence/tests/phase27_plan.rs","crates/cadence/tests/phase28_evidence.rs","crates/cadence/tests/phase29_limits.rs","crates/cadence/tests/phase31_read_layer.rs","crates/cadence/tests/phase38_suite_gate.rs","crates/cadence/tests/phase36_released_checks.rs","crates/cadence/tests/phase34_blocked_path.rs","crates/cadence/tests/phase12_execution.rs","crates/cadence/tests/phase37_rejected_checks.rs","crates/cadence/tests/execution_terminal_reopen.rs","crates/cadence/tests/phase7_lease.rs","crates/cadence/tests/phase8_dispatch.rs","crates/cadence/tests/phase13_close.rs","crates/cadence/tests/execution_boundary_compat.rs","crates/cadence/tests/mcp.rs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P32-1-T1","verify":["cargo nextest run -p cadence --test phase32_typed_authoring phase32_typed_plan_answers_digest_and_no_document","cargo nextest run -p cadence --test phase32_typed_authoring phase32_plan_body_is_refused"]},{"id":"P32-1-T2","verify":["cargo nextest run -p cadence --test mcp","cargo nextest run -p cadence --test phase31_read_layer","cargo nextest run -p cadence --test phase27_plan"]}]}
---
# Phase 32: Typed authoring and rendering - Plan 1

## Goal

Plan submissions become typed pieces and the binary renders PLAN.md; a body on the wire is refused; draft and preview answers carry a digest and identities and echo nothing.

## Must be true when done

- T1. When the planner submits a plan as typed pieces, the planner gets the digest of the PLAN.md the binary rendered and no document in the answer.
- T5. When a plan-submit request carries a Markdown body, the planner is refused with the slot named.

## Context

D-178, D-180 and D-182 at .planning/phases/32/CONTEXT.md. Today Content.body (crates/cadence/src/plan/model.rs:34) is the whole PLAN.md after the frontmatter, render::document (crates/cadence/src/plan/render.rs:12) appends it unchanged, and complete_preview (crates/cadence/src/plan_service.rs:341) echoes document, old_section, section and the submission back. The context side already shows the target shape: context::render::document builds CONTEXT.md from scope, decisions and truth slots. The retained Publication keeps content with a filled body so phase 27 to 29 records, replay and map history read exactly as before; the fill follows persistence::bound (crates/cadence/src/plan/persistence.rs:77), which fills Approval.submission before recording. Nineteen test files build a body today (grep count 2026-09-17); the second task moves them and the planner skill in one pass so the suite is green at the plan's end.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P32-T1-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase32_typed_authoring phase32_typed_plan_answers_digest_and_no_document",
        "expected": {
          "kind": "literal",
          "value": "The draft plan-submit answer is {status: ok, operation: plan-submit, persisted: false, validation: draft, submission_digest: <64 hex>, documents: [{identity: {phase, plan}, revision: <64 hex>}]} with no other key; after approval by that digest, the SHA-256 of the installed .planning/phases/<N>/PLAN-1.md equals documents[0].revision."
        },
        "test": {
          "file": "crates/cadence/tests/phase32_typed_authoring.rs",
          "function": "phase32_typed_plan_answers_digest_and_no_document"
        },
        "setup": "Start the real env!(CARGO_BIN_EXE_cadence) stdio server through the Client in crates/cadence/tests/support/phase31.rs on a fresh ProcessFixture project whose phase has a native approved context.",
        "call": "Send plan-submit with one plan whose content is goal, context, notes, requirements, files, tasks [{id, title, files, action, verify}], suite and an attached evidence map, and no body; read the answer keys; approve by submission_digest; hash the installed file.",
        "boundary": "stdio JSON-RPC to the real binary bound to a fixture project, then the installed file on disk",
        "fakes": []
      },
      "reason": "Any echoed document, section or submission copy adds a key and fails the exact-keys assertion; a renderer that differs from the installed bytes fails the digest equality.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "The planner's answer carries the rendered digest and nothing that is a document; this is T1's outcome word for word."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P32-T5-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase32_typed_authoring phase32_plan_body_is_refused",
        "expected": {
          "kind": "literal",
          "value": "{status: refused, code: typed-content, slot: submission.plans[0].content.body, phase: <N>} and the fixture tree is byte-identical before and after."
        },
        "test": {
          "file": "crates/cadence/tests/phase32_typed_authoring.rs",
          "function": "phase32_plan_body_is_refused"
        },
        "setup": "Start the real env!(CARGO_BIN_EXE_cadence) stdio server through the Client in crates/cadence/tests/support/phase31.rs on a fresh ProcessFixture project whose phase has a native approved context.",
        "call": "Send plan-submit whose first plan content carries a body string beside the typed pieces.",
        "boundary": "stdio JSON-RPC to the real binary; the tree snapshot helper in tests/support/phase31.rs",
        "fakes": []
      },
      "reason": "Accepting or silently dropping the body answers ok or a different code; a write on refusal changes the tree snapshot.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "The refusal names the slot that carried the body; this is T5's outcome."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P32-A-typed-content",
      "spec": {
        "locators": [
          "crates/cadence/src/plan/model.rs::Content",
          "crates/cadence/src/plan/model.rs::Task",
          "crates/cadence/src/plan/render.rs::document"
        ],
        "substance": "The wire Content type with goal, context, notes and typed tasks and no body; the renderer that produces every PLAN.md section from it; the retained record whose body the binary fills."
      },
      "reason": "Removing the typed fields or restoring body as a wire field undoes D-178.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "The typed shape is what the planner submits."
        },
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "The type is what makes a body a refusable slot rather than a field."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Typed plan content, rendered by the binary

- **ID:** P32-1-T1
- **Files:** crates/cadence/src/plan/model.rs, crates/cadence/src/plan/render.rs, crates/cadence/src/plan/persistence.rs, crates/cadence/src/plan/validation.rs, crates/cadence/src/plan_service.rs, crates/cadence/src/read/document.rs, crates/cadence/tests/phase32_typed_authoring.rs
- **Action:** Red first: add phase32_typed_plan_answers_digest_and_no_document and phase32_plan_body_is_refused to the new test file and retain their red runs. Then replace Content.body on the wire with goal, context and notes (strings) and tasks as {id, title, files, action, verify} (D-178); derive execution {schema: 1, suite, tasks[{id, verify}]} from the typed tasks and the suite string; render::document builds the whole PLAN.md (frontmatter, Goal, Must be true when done from the associated truths' rendered sentences, Context, Evidence map, Tasks with the five bullets, Notes) from the pieces. The retained Publication.content keeps its shape: the binary fills body with the rendered Markdown before it records, exactly as plan Approval.submission is filled (D-182), and a historical record that already carries body reads as before. A wire request whose content carries body, or a path outside files, is refused typed-content with slot submission.plans[i].content.body. Draft and preview answers carry submission_digest and documents:[{identity, revision}] and nothing else that is a document: remove document, old_section, section and the submission echo (D-180). read/document.rs task parts come from the typed tasks, not from heading scans.
- **Verify:**
  - cargo nextest run -p cadence --test phase32_typed_authoring phase32_typed_plan_answers_digest_and_no_document
  - cargo nextest run -p cadence --test phase32_typed_authoring phase32_plan_body_is_refused

### Task 2: Move every fixture and the planner skill to typed pieces

- **ID:** P32-1-T2
- **Files:** crates/cadence/src/plan/instructions.rs, skills/cad-plan/SKILL.md, crates/cadence/tests/support/phase13.rs, crates/cadence/tests/support/phase31.rs, crates/cadence/tests/phase27_plan.rs, crates/cadence/tests/phase28_evidence.rs, crates/cadence/tests/phase29_limits.rs, crates/cadence/tests/phase31_read_layer.rs, crates/cadence/tests/phase38_suite_gate.rs, crates/cadence/tests/phase36_released_checks.rs, crates/cadence/tests/phase34_blocked_path.rs, crates/cadence/tests/phase12_execution.rs, crates/cadence/tests/phase37_rejected_checks.rs, crates/cadence/tests/execution_terminal_reopen.rs, crates/cadence/tests/phase7_lease.rs, crates/cadence/tests/phase8_dispatch.rs, crates/cadence/tests/phase13_close.rs, crates/cadence/tests/execution_boundary_compat.rs, crates/cadence/tests/mcp.rs
- **Action:** Every test and support helper that builds a plan-submit with a body sends the typed pieces instead; sentinel text the read-layer tests look for moves into goal, context, notes and task action slots. Rewrite the Author, Preview and Refusal sections of plan::instructions to the typed shape and the digest-and-identities answer; the binary regenerates skills/cad-plan/SKILL.md (D-166) and tests/mcp.rs pins it. The suite is green at the end of this task.
- **Verify:**
  - cargo nextest run -p cadence --test mcp
  - cargo nextest run -p cadence --test phase31_read_layer
  - cargo nextest run -p cadence --test phase27_plan

## Notes

Task 1 lands the type, renderer and answer shape red then green; task 2 is the sweep of fixtures and the regenerated skill. The stale-digest refusal with a location and the held draft are plan 3; this plan's approval still carries the submission with the digest, as phase 29 left it.
