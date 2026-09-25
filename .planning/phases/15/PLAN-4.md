---
phase: 15
plan: 4
requirements: ["T4"]
files: ["crates/cadence/src/landing/reconcile.rs","crates/cadence/src/landing/mod.rs","crates/cadence/src/landing/model.rs","crates/cadence/src/landing/effects.rs","crates/cadence/src/landing/forge.rs","crates/cadence/src/landing_service.rs","crates/cadence/src/server.rs","crates/cadence/src/recall/mod.rs","crates/cadence/src/store/writer.rs","crates/cadence/src/store/transaction.rs","crates/cadence/tests/phase15_landing.rs","crates/cadence/tests/support/phase15.rs","crates/cadence/src/landing/report.rs","crates/cadence/src/landing/instructions.rs","skills/cad-land/SKILL.md","crates/cadence/tests/mcp.rs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P15-4-T1","verify":["cargo nextest run -p cadence --test phase15_landing phase15_interrupted_landing_reconciles_against_the_remote"]},{"id":"P15-4-T2","verify":["cargo nextest run -p cadence --test phase15_landing phase15_interrupted_landing_reconciles_against_the_remote","cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions"]}]}
---
## Goal

Resume an interrupted landing by reading the actual remote effect and recording it once, without repeating push, PR creation or merge.

## Must be true when done

- T4. When a landing is interrupted after a remote step succeeded and before its receipt was recorded, the owner sees the resumed landing read the remote state, record the step done, and repeat no push, create or merge.

## Context

Build on plan 3's durable landing, exact step authorization, before-effect intent and per-step receipt slots (D-197). The remote is not the store journal: absence of a receipt cannot prove absence of an external effect. The test boundary remains the real binary and actual Git transport; forge stand-ins are executable processes on PATH, not mocked Rust modules. Real Git trace events supplement remote refs/reflogs: a repeated no-op push can leave the ref log unchanged, so reflog length alone is not a sufficient oracle.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P15-T4-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase15_landing phase15_interrupted_landing_reconciles_against_the_remote",
        "expected": {
          "kind": "property",
          "value": "In every effect-before-receipt case the remote read precedes the newly recorded done receipt; the push SHA or PR identity/state in that receipt is the handwritten fixture effect. Exactly one receipt exists for that landing step, including after another restart/resume, and the next step is offered. The resumed processes execute zero pushes; the bare ref and reflog length stay unchanged. Exactly one create and one merge invocation exist across each respective interrupted/resumed case, while view/list reads do occur. A remote-state read failure or mismatch is refused, creates no done receipt and runs no mutation. A reconciled MERGED state leaves merge confirmation absent."
        },
        "test": {
          "file": "crates/cadence/tests/phase15_landing.rs",
          "function": "phase15_interrupted_landing_reconciles_against_the_remote"
        },
        "setup": "Use the actual Client::open stdio launch at crates/cadence/tests/support/phase13.rs:22; compare authored document bytes with crates/cadence/tests/support/phase14.rs:225 where required. Use support/phase15.rs with a real bare origin, exact authorized landing and no push receipt. The fixture performs one actual git push to install the frozen destination SHA (as CONTEXT's example requests); preserve the pending landing. For open and merge use the binary's actual authorized operation and a real executable forge fixture that persists the requested effect and logs it, then stop the actual serve process after effect success before receipt persistence. For merge first establish a real PR identity and push source; the forge reports literal matching MERGED state only after its merge invocation. Enable GIT_TRACE2_EVENT on resumed child processes.",
        "call": "Restart and land-resume separately for push/open/merge, then land-read and resume once more. Read actual remote ref/reflog, Git trace, forge read/mutation logs and reopened store receipts.",
        "boundary": "Real cadence serve over stdio; actual store journal, filesystem, Git child processes and local bare repository; forge effects, when present, cross an executable on PATH.",
        "fakes": [
          "Caller inputs and fixed clock/Git date inputs",
          "Local bare origin with a real test-performed push",
          "Real forge executables that persist fixed PR states and log every invocation",
          "Caller-selected actual serve-process exit between external success and receipt write"
        ]
      },
      "reason": "Causes the trigger of approved T4 version 1 and observes its stated outcome; this is its only check.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "Causes the trigger of approved T4 version 1 and observes its stated outcome; this is its only check."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P15-T4-A1",
      "spec": {
        "locators": [
          "crates/cadence/src/landing/reconcile.rs",
          "crates/cadence/src/landing/forge.rs",
          "crates/cadence/src/landing/effects.rs"
        ],
        "substance": "Actual remote-ref and exact PR-state reconciliation before replay; existing effects become done once and ambiguous effects stop without repeated mutations."
      },
      "reason": "This artifact implements the owner-visible T4 outcome, including the named durable boundary.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "This artifact implements the owner-visible T4 outcome, including the named durable boundary."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P15-T4-A2",
      "spec": {
        "locators": [
          "crates/cadence/src/landing/model.rs",
          "crates/cadence/src/landing/report.rs",
          "crates/cadence/src/landing_service.rs"
        ],
        "substance": "One journaled receipt per landing step, retaining exact remote proof and reconciliation provenance; restart/readback offers the next step without treating remote merge state as owner confirmation."
      },
      "reason": "This artifact implements the owner-visible T4 outcome, including the named durable boundary.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "This artifact implements the owner-visible T4 outcome, including the named durable boundary."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Deliver reconciliation across each effect-before-receipt interruption

- **ID:** P15-4-T1
- **Files:** crates/cadence/src/landing/reconcile.rs, crates/cadence/src/landing/mod.rs, crates/cadence/src/landing/model.rs, crates/cadence/src/landing/effects.rs, crates/cadence/src/landing/forge.rs, crates/cadence/src/landing_service.rs, crates/cadence/src/server.rs, crates/cadence/src/recall/mod.rs, crates/cadence/src/store/writer.rs, crates/cadence/src/store/transaction.rs, crates/cadence/tests/phase15_landing.rs, crates/cadence/tests/support/phase15.rs
- **Action:** Deliver P15-T4-C and A1/A2 red then green. Add land-resume, routed through the same resident and writer. Before attempting an unfinished remote step, read exact remote destination ref/object for push, and exact repository/head/base plus PR identity/state for open/merge; do not rely on local tracking refs or a cached report. If the intended effect is already there, atomically append the single done receipt with its observed remote proof and reconciliation provenance, and offer the next step without running the mutating command. If definitively absent, retain the existing exact authorization and allow only that step; if unknown, ambiguous, moved, closed-unmerged or mismatched, return a named refusal. Persist no fabricated success when the read fails. Keep receipt ids keyed by landing/step so a repeated resume reuses the same receipt. Add an actual process-exit hook after the real effect returns and before its receipt write, alongside the reusable support15 child lifecycle. Include push, create AND merge cases in the one test and restart the actual binary for each.
- **Verify:**
  - cargo nextest run -p cadence --test phase15_landing phase15_interrupted_landing_reconciles_against_the_remote

### Task 2: Expose reconciled receipts and resume through the compiled door

- **ID:** P15-4-T2
- **Files:** crates/cadence/src/landing/report.rs, crates/cadence/src/landing/instructions.rs, skills/cad-land/SKILL.md, crates/cadence/tests/mcp.rs, crates/cadence/tests/phase15_landing.rs, crates/cadence/tests/support/phase15.rs
- **Action:** Make land-read/land-resume show exact done steps, their observed remote ref or PR state and one next step. Compile the resume instruction into the existing cad-land door and update its byte pin. Retain the already-green P15-T4-C assertions against actual Git trace/ref reads, CLI invocation logs and restarted store readback. The forge executable must durably update its fixture PR state before the serve process is stopped, log every read/create/merge invocation separately, and fail if a second create/merge is attempted; this is an external protocol fixture, not the reconciliation implementation. Check repeated resume appends no second receipt and does not imply merge confirmation.
- **Verify:**
  - cargo nextest run -p cadence --test phase15_landing phase15_interrupted_landing_reconciles_against_the_remote
  - cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions

## Notes

Shared landing/model/effects files are sequential extensions of plan 3. Reconciliation cannot synthesize missing permission: match the retained authorization and frozen identity before any mutation. Read failure or ambiguous/mismatching remote state refuses with the actual discrepancy; it never triggers a blind repeat. Remote merged state records the merge step done but is not the owner's merge-confirmation record; plan 5 still requires that record before cleanup.

Execute plans 1 through 7 in order, never concurrently. Repeated file leases are sequential: retain earlier operations/tests and edit only this plan's named surface. New Rust paths and test functions are creation specifications, not claims about HEAD. The suite field renders execution.schema=1 and execution.suite; task ids and verify arrays render its task contract. Every task that delivers the one check commits its failing test first, records the real failing run, implements the behavior, then records the same narrow command passing. Do not add another evidence check for this truth. No observation items. All phase records and refusal/step receipts use the existing store writer and its sole journal; no separate authority or sidecar journal. Inputs are root-bound and versioned; retries bind the same request and exact inputs, and changed inputs refuse. Keep tracker writes, deferred-member ruling, generic absence proofs and manifest selection in their parked phases.
