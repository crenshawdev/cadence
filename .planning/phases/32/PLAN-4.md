---
phase: 32
plan: 4
requirements: ["T6","T7"]
files: ["crates/cadence/tests/phase32_typed_authoring.rs","crates/cadence/tests/support/phase31_hosts.rs","crates/cadence/tests/phase31_read_layer.rs","crates/cadence/tests/support/phase31.rs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P32-4-T1","verify":["cargo nextest run -p cadence --test phase32_typed_authoring phase32_two_callers_on_one_resident_read_the_same_draft_slice"]},{"id":"P32-4-T2","verify":["cargo clippy -p cadence --test phase31_read_layer -- -D warnings"]},{"id":"P32-4-T3","verify":["cargo nextest run -p cadence --test phase32_typed_authoring phase32_six_plan_publication_wire_bytes --no-capture"]}]}
---
# Phase 32: Typed authoring and rendering - Plan 4

## Goal

Two callers on one resident read the same draft slice, the phase 31 host helper is clean, and the six-plan publication cost is measured on the wire against 113KB twice.

## Must be true when done

- T6. When a worker in a Claude host reads a draft by identity, the worker gets the same slice the main thread gets for that identity.
- T7. When phase 32 closes, the owner sees the wire bytes for publishing a six-plan phase beside the 113KB-twice figure of 2026-09-12.

## Context

D-183 and D-184 at .planning/phases/32/CONTEXT.md. The phase 31 host helper (crates/cadence/tests/support/phase31_hosts.rs) proves T6 only by starting the installed claude, which D-172 ignores; its clippy findings were recorded at bootstrap-exception.md item 5. The mechanism T6 names is one resident shared by every caller (D-149), and that is checkable from two request streams on one stdio process. The 2026-09-12 figure is the 113KB plan set carried twice in docs/architecture/boundary-fix.md:16, so the bound is 231424 bytes.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P32-T6-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase32_typed_authoring phase32_two_callers_on_one_resident_read_the_same_draft_slice",
        "expected": {
          "kind": "property",
          "value": "For every part selector of a held draft, the bytes served to the second caller equal the bytes served to the first caller on the same resident, and exactly one cadence serve process exists."
        },
        "test": {
          "file": "crates/cadence/tests/phase32_typed_authoring.rs",
          "function": "phase32_two_callers_on_one_resident_read_the_same_draft_slice"
        },
        "setup": "One real stdio server on a ProcessFixture project; the support Client extended to send requests under a second caller identity on the same process.",
        "call": "Submit a draft from caller one; read every draft part from caller one and caller two; list cadence serve processes.",
        "boundary": "stdio JSON-RPC to one real binary from two callers; the process table",
        "fakes": []
      },
      "reason": "A per-caller cache or a second resident makes the two readings differ or the process count two.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "A worker sharing the resident gets the main thread's slice; this is the mechanism T6 names, checked without a host."
        }
      ]
    },
    {
      "kind": "observation",
      "id": "P32-O1",
      "spec": {
        "episode": "The owner runs a real planning round for phase 33 in a Claude host, dispatches one named worker, and sees the worker read a phase 32 draft part through document and get the bytes the main thread read.",
        "specification": {
          "source": "D-183 in .planning/phases/32/CONTEXT.md",
          "document": ".planning/phases/32/CONTEXT.md",
          "approved_by": "John Crenshaw <john@jcrenshaw.dev>",
          "approved_at": "2026-09-17T11:56:07Z"
        },
        "status": "pending"
      },
      "reason": "A deterministic stdio check cannot establish what a Claude host does with a worker; the live probe phase31_worker_hosts_receive_main_thread_answers remains ignored under D-172.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "T6 names a Claude host; only the owner in a host can see it."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P32-T7-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase32_typed_authoring phase32_six_plan_publication_wire_bytes",
        "expected": {
          "kind": "literal",
          "value": "The test prints exactly one line 'phase 32 wire bytes: <total> against 231424' where <total> is the sum of request and answer bytes for preview, draft and digest approval of six typed plans, and asserts total < 231424."
        },
        "test": {
          "file": "crates/cadence/tests/phase32_typed_authoring.rs",
          "function": "phase32_six_plan_publication_wire_bytes"
        },
        "setup": "Start the real env!(CARGO_BIN_EXE_cadence) stdio server through the Client in crates/cadence/tests/support/phase31.rs on a fresh ProcessFixture project whose phase has a native approved context.",
        "call": "Preview six plans with plan-read count 6 and the complete submission, send the draft, approve by digest; count bytes on both directions of the stdio pipe.",
        "boundary": "stdio JSON-RPC to the real binary, bytes counted at the pipe",
        "fakes": []
      },
      "reason": "Any echoed document puts six plans back on the wire and the total exceeds the bound.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "The owner sees the number beside the 113KB-twice figure; the printed line is what the SUMMARY carries."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P32-A-summary-line",
      "spec": {
        "locators": [
          ".planning/phases/32/SUMMARY.md"
        ],
        "substance": "The phase summary carries the measured wire bytes line from P32-T7-C."
      },
      "reason": "Without the line in the summary the number is only in a test log.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "The owner sees the number at close in the summary."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Two callers on one resident get the same draft slice

- **ID:** P32-4-T1
- **Files:** crates/cadence/tests/phase32_typed_authoring.rs, crates/cadence/tests/support/phase31.rs
- **Action:** Red first: add phase32_two_callers_on_one_resident_read_the_same_draft_slice and retain its red run. The check opens one resident and drives it from two request streams that interleave (the main thread and a worker share one MCP connection in a Claude host; the support Client gains a way to send from a second caller identity on the same process), submits a draft from the first, reads each draft part from both, and asserts byte equality per part and exactly one cadence serve process. Then make it green if anything in plan 3's draft serving is caller-dependent.
- **Verify:**
  - cargo nextest run -p cadence --test phase32_typed_authoring phase32_two_callers_on_one_resident_read_the_same_draft_slice

### Task 2: Phase 31 host helper: lints clear, live probe stays ignored

- **ID:** P32-4-T2
- **Files:** crates/cadence/tests/support/phase31_hosts.rs, crates/cadence/tests/phase31_read_layer.rs
- **Action:** Run clippy on the phase31_read_layer target and clear any finding in support/phase31_hosts.rs (the four D-156 record item 5 names; 2026-09-17 clippy printed none, so record the run). The ignored phase31_worker_hosts_receive_main_thread_answers stays as the live probe under D-172 with its reason updated to name D-183 and this plan's check as the non-host evidence.
- **Verify:**
  - cargo clippy -p cadence --test phase31_read_layer -- -D warnings

### Task 3: Measure a six-plan publication on the wire

- **ID:** P32-4-T3
- **Files:** crates/cadence/tests/phase32_typed_authoring.rs
- **Action:** Red first: add phase32_six_plan_publication_wire_bytes and retain its red run. The check publishes a six-plan phase through plan-read preview, plan-submit draft and plan-submit approval by digest on the real stdio server, sums the bytes of every request and answer line, asserts the total is below 231424 (113KB twice, D-184), and prints one line 'phase 32 wire bytes: <total> against 231424' that the phase SUMMARY carries at close.
- **Verify:**
  - cargo nextest run -p cadence --test phase32_typed_authoring phase32_six_plan_publication_wire_bytes --no-capture

## Notes

The observation is pending and caps T6 at concerns even when seen; the check is the non-host evidence D-183 asks for. Task 3 runs last because it needs plans 1 and 3 landed.
