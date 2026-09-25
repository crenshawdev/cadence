---
phase: 16
plan: 4
requirements: ["T4"]
files: ["crates/cadence/src/debug/mod.rs","crates/cadence/src/debug/review.rs","crates/cadence/src/debug/model.rs","crates/cadence/src/debug/render.rs","crates/cadence/src/debug_service.rs","crates/cadence/src/rail_service.rs","crates/cadence/src/review_service.rs","crates/cadence/src/recall/mod.rs","crates/cadence/src/store/writer.rs","crates/cadence/src/store/transaction.rs","crates/cadence/tests/debug_review.rs","crates/cadence/tests/support/support_records.rs","crates/cadence/src/debug/instructions.rs","skills/cad-debug/SKILL.md","skills/cad-review-delivery/SKILL.md","crates/cadence/tests/mcp.rs","cadence-core/bin/weight-budgets.json"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P16-4-T1","verify":["cargo nextest run -p cadence --test debug_review debug_blocking_fire_holds_resolve_until_a_receipt"]},{"id":"P16-4-T2","verify":["cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions","cargo nextest run -p cadence --test debug_review debug_blocking_fire_holds_resolve_until_a_receipt"]}]}
---
## Goal

Hold debug resolution until the receipts rail settles the exact blocking fire, including one narrowed re-arm.

## Must be true when done

- T4. When a blocking debug fire returns findings, the owner sees resolve refused until a gate-pass or a reasoned override receipt names that fire, with at most one narrowed re-arm round.

## Context

D-202. Receipt::validate rejects blank override reasons at crates/cadence/src/rail/receipts.rs:139; validate_rearm at crates/cadence/src/rail/receipts.rs:174 requires the same boundary/surfaces/base, a newer observation and narrowed nonempty scope, and refuses a child that was itself re-armed. validate_history at crates/cadence/src/rail/receipts.rs:336 additionally permits one consequence per fire. consequence_permits at crates/cadence/src/rail/receipts.rs:160 accepts more consequence kinds than debug's approved gate, so debug must not use that boolean as its whole oracle. ordinary_gate_action at crates/cadence/src/review/policy.rs:83 waits for Settlement::Verified; this plan adds the debug receipts consumer without inventing that dropped settlement layer.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P16-T4-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test debug_review debug_blocking_fire_holds_resolve_until_a_receipt",
        "expected": {
          "kind": "literal",
          "value": "Unsettled resolve is refused naming the exact fire and, after return, both outstanding findings; raw findings grant no clearance. Exact gate-pass lets resolve reach verification; blank override is refused without a new consequence, nonblank override lets it proceed. One narrowed child round is accepted with its actual path set recorded; child re-arm is refused by the one-round rule, duplicate parent consequence is refused. Parent rearm alone leaves resolve blocked until child gate-pass/override. Debug review readback and rendered section name the actual fire, findings and accepted receipt(s), unchanged after restart; no Settlement::Verified is fabricated."
        },
        "test": {
          "file": "crates/cadence/tests/debug_review.rs",
          "function": "debug_blocking_fire_holds_resolve_until_a_receipt"
        },
        "setup": "Compose tests/support/phase13.rs Client::open at crates/cadence/tests/support/phase13.rs:22, fixture at crates/cadence/tests/support/phase13.rs:117, git at crates/cadence/tests/support/phase13.rs:361, git_value at crates/cadence/tests/support/phase13.rs:470 and reopened at crates/cadence/tests/support/phase13.rs:224 in new subject-named tests/support/support_records.rs. Borrow tracked document snapshots from crates/cadence/tests/support/phase14.rs:225 and real risk input jwt.verify(token) from crates/cadence/tests/support/phase15.rs:159, without calling its committed-material helper for a staged case. Create records only through public operations. Implement a guard probe launching CARGO_BIN_EXE_cadence guard with the real PreToolUse event shape at crates/cadence/src/guard/tests.rs:60; that existing helper uses a test-process child, so do not claim it already launches the integration binary. Reuse plan-3 real staged match on two paths src/auth/a.rs and src/auth/b.rs. Obtain review-next's issued attempt, record fixture caller launch/return inputs with review-observation under its exact H3 identity, then submit two handwritten findings via real review-return: high at a.rs:1 'unchecked token' / 'invalid token admitted'; high at b.rs:1 'missing permission' / 'unauthorized caller admitted'. Read review-original to retain their actual identities. Use fresh independent fixtures for gate-pass, override and re-arm, never two incompatible consequences on one parent.",
        "call": "Resolve before findings and after review-return; apply real risk-consequence gate-pass naming the exact joined fire then resolve. Fresh copy: blank override then reason 'Fixture owner accepts these two findings' then resolve. Fresh copy: stage a real narrower one-path change against the same base, risk-check again with same root-debug boundary and later confirmed generation, obtain round-2 shared admission and exact child fire, record parent rearm consequence then child risk-fire, return child findings. Try a second re-arm of child and a duplicate parent re-arm, then settle child with its own gate-pass and resolve. At each step query debug-status/continue and inspect the projected review section after synchronization and restart.",
        "boundary": "Real cadence serve child over MCP stdio, actual filesystem, Store journal and Git where used; cadence guard is a separate real binary process. No fake record, admission, review-return, risk-consequence or Git resolver.",
        "fakes": [
          "Caller inputs, fixed clock/Git dates and a temporary real fixture repository"
        ]
      },
      "reason": "Changing the trigger-to-record/readback behavior described here must fail this truth's single check.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "Changing the trigger-to-record/readback behavior described here must fail this truth's single check."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P16-T4-A1",
      "spec": {
        "locators": [
          "crates/cadence/src/debug/review.rs",
          "crates/cadence/src/debug_service.rs",
          "crates/cadence/src/rail/receipts.rs"
        ],
        "substance": "Debug resolve gate reads confirmed rail history and exact fire/material bindings; gate-pass or nonblank override only, recursively settling at most one rearmed child. Adjudication, deferral permission and raw findings do not clear this blocking debug gate."
      },
      "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T4.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T4."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P16-T4-A2",
      "spec": {
        "locators": [
          "crates/cadence/src/debug/model.rs",
          "crates/cadence/src/debug/render.rs",
          "crates/cadence/src/rail_service.rs"
        ],
        "substance": "Debug review section retains the authoritative review admission/fire join, returned findings references, narrowed child and receipt identities; risk-consequence settlement is reflected through the same store journal/projection, including after restart."
      },
      "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T4.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T4."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Deliver the blocking-fire receipt check and debug settlement consumer

- **ID:** P16-4-T1
- **Files:** crates/cadence/src/debug/mod.rs, crates/cadence/src/debug/review.rs, crates/cadence/src/debug/model.rs, crates/cadence/src/debug/render.rs, crates/cadence/src/debug_service.rs, crates/cadence/src/rail_service.rs, crates/cadence/src/review_service.rs, crates/cadence/src/recall/mod.rs, crates/cadence/src/store/writer.rs, crates/cadence/src/store/transaction.rs, crates/cadence/tests/debug_review.rs, crates/cadence/tests/support/support_records.rs
- **Action:** Deliver P16-T4-C red then green and A1/A2. Read confirmed_history and exact history bindings; debug continuation requires GatePass or Override with nonblank reason, not generic permits_continuation. Inspect every unresolved blocking fire retained by the session, so a newer clear scan does not erase one. A parent Rearm follows its single narrowed child; require that child's actual settlement. Reuse validate_rearm without relaxing phase consumers. Retain review-return findings via existing native reads, never synthesize a return/adjudication record from a report. Join risk-consequence and review-return effects into the debug record's review section and projection through the existing owning writer; if implemented as a follow-up projection transaction, durable reads/restart must refresh from confirmed authority and never expose a stale cleared result. Material moved since review refuses reuse. The one check drives real review-admit/next/observation/return and risk-consequence with fixture caller inputs, not inserted snapshots. Include a wrong-fire or changed-index receipt negative control inside the same function. Keep the three accepted settlement branches in independent repositories. No generic settlement writer or new operation.
- **Verify:**
  - cargo nextest run -p cadence --test debug_review debug_blocking_fire_holds_resolve_until_a_receipt

### Task 2: Show findings, exact receipts and the terminal re-arm choice

- **ID:** P16-4-T2
- **Files:** crates/cadence/src/debug/instructions.rs, skills/cad-debug/SKILL.md, skills/cad-review-delivery/SKILL.md, crates/cadence/tests/mcp.rs, cadence-core/bin/weight-budgets.json
- **Action:** Present pending findings and fire IDs; request a real gate-pass or the owner's explicit reasoned override through risk-consequence, or the one narrowed re-arm. Retain actual host return and wait for durable acknowledgment. After the narrowed round still fails, stop for the owner rather than auto-loop. Amend only the debug-specific qualification in cad-review-delivery's obsolete blanket pending-settlement sentence: debug reads the receipts rail, other callers keep existing behavior. Keep that internal contract outside the rendered registry (pin 21) and keep all debug allowed tools. Render/pin cad-debug. Retain shared triage-gate.md/review-triggers.md and trace.test.mjs's rearm history cases because other HEAD workflows consume them; no trace-count script is ported.
- **Verify:**
  - cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions
  - cargo nextest run -p cadence --test debug_review debug_blocking_fire_holds_resolve_until_a_receipt

## Notes

Depends on plan 3's actual admission/rail fire join. A re-arm receipt is not clearance: its child still needs gate-pass or reasoned override. Check both attempts to re-arm the child (validate_rearm cap) and to reuse the original parent (one-consequence rule); do not incorrectly claim both refusals arise at the same validator. Pin remains 21. No new operation is needed; reuse risk-consequence and existing debug reads/resolve, so no tools/list budget increase is planned here.

Execute plans 1 through 7 sequentially, never concurrently. Repeated file leases extend only this plan's named surface and preserve earlier work. New paths, operation shapes and test functions below are creation specifications, not claims that they exist at HEAD. content.suite and typed tasks let the binary derive execution.schema=1, execution.suite and stable task verify arrays; do not submit an execution field. The check-delivering task records its one test red before implementation and green afterwards; later tasks use narrow regressions and create no additional evidence checks. No observation items. All records, replay identities and rendered projections use the existing Store request interface and sole journal, with root binding, expected generation and idempotent request IDs. Reject changed-input replay; never add a sidecar authority. D-207 side jobs are outside these leases. Phase 17 owns further contract enforcement; phase 18 owns absence/live-host acceptance; phase 21 owns its additional-round allowance and deferred settlement. Debug/spike records are not added to recall's corpus.
