---
phase: 16
plan: 3
requirements: ["T3"]
files: ["crates/cadence/src/rail/risk.rs","crates/cadence/src/rail/receipts.rs","crates/cadence/src/rail_service.rs","crates/cadence/src/review_service.rs","crates/cadence/src/review/policy.rs","crates/cadence/src/execution_service.rs","crates/cadence/src/execution/history.rs","crates/cadence/src/milestone/preflight.rs","crates/cadence/src/suggest_service.rs","crates/cadence/src/execution_service_tests.rs","crates/cadence/src/debug/model.rs","crates/cadence/src/debug_service.rs","crates/cadence/src/debug/render.rs","crates/cadence/src/server.rs","crates/cadence/src/recall/mod.rs","crates/cadence/tests/debug_review.rs","crates/cadence/tests/support/support_records.rs","crates/cadence/tests/phase7_receipts.rs","crates/cadence/tests/phase7_risk.rs","crates/cadence/tests/mcp.rs","crates/cadence/src/debug/instructions.rs","skills/cad-debug/SKILL.md","cadence-core/bin/weight-budgets.json","crates/cadence/tests/debug_record.rs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P16-3-T1","verify":["cargo nextest run -p cadence --test debug_review debug_resolve_risk_checks_the_index_without_a_phase","cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions","cargo nextest run -p cadence --test debug_record debug_session_resumes_from_the_record_alone"]},{"id":"P16-3-T2","verify":["cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions"]}]}
---
## Goal

Risk-check the staged debug fix under a phase-less root-debug scope and admit the shared reviewer.

## Must be true when done

- T3. When resolve is requested on a debug session with a staged fix, the owner sees the index risk-checked under a root-debug scope with no phase, an empty index refused, and a match or an inconclusive check firing the shared risk-surface reviewer on the staged tree.

## Context

D-202. ScopeSelection and Scope currently require NonZeroU32 phase (crates/cadence/src/rail/risk.rs:101 and crates/cadence/src/rail/risk.rs:148); rail_service also requires a phase directory (crates/cadence/src/rail_service.rs:44). Source::Staged resolves an actual git write-tree at crates/cadence/src/rail/git.rs:84. Phase-less admission exits before looking up risk records at crates/cadence/src/review_service.rs:686. risk_review_action maps inconclusive to WaitForEvidence at crates/cadence/src/review/policy.rs:126. Existing caller debug and root review homes are supported at crates/cadence/src/review_service.rs:372 and crates/cadence/src/review_service.rs:219. A checked binary diff is inconclusive at crates/cadence/src/rail/risk_diff.rs:328; missing acquisition is Unchecked, a distinct case.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P16-T3-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test debug_review debug_resolve_risk_checks_the_index_without_a_phase",
        "expected": {
          "kind": "literal",
          "value": "Clean and unstaged-only cases are refused naming empty index, never resolved. Matched staged case records exactly one confirmed root-debug risk check with phase absent/null, Source staged and MaterialIdentity Staged{base_id=actual HEAD,index_id=actual git write-tree}; one linked shared fire/admission has caller debug, home reviews/<issued fire>, Target StagedTree with the same base/index and head=null, and review-next yields a host dispatch. NUL binary staged case has checked=true,inconclusive=true and also dispatches. Conclusive nonmatch has matches=[], no fire and resolve reaches reproduction verification. Same-fix retry creates no second scan/fire."
        },
        "test": {
          "file": "crates/cadence/tests/debug_review.rs",
          "function": "debug_resolve_risk_checks_the_index_without_a_phase"
        },
        "setup": "Compose tests/support/phase13.rs Client::open at crates/cadence/tests/support/phase13.rs:22, fixture at crates/cadence/tests/support/phase13.rs:117, git at crates/cadence/tests/support/phase13.rs:361, git_value at crates/cadence/tests/support/phase13.rs:470 and reopened at crates/cadence/tests/support/phase13.rs:224 in new subject-named tests/support/support_records.rs. Borrow tracked document snapshots from crates/cadence/tests/support/phase14.rs:225 and real risk input jwt.verify(token) from crates/cadence/tests/support/phase15.rs:159, without calling its committed-material helper for a staged case. Create records only through public operations. Implement a guard probe launching CARGO_BIN_EXE_cadence guard with the real PreToolUse event shape at crates/cadence/src/guard/tests.rs:60; that existing helper uses a test-process child, so do not claim it already launches the integration binary. Use review risk_surface surfaces=['auth'], gate=blocking, mode=single, reviewers=['claude-subagent']; initialize before staging. Open debug through stdio. Use independent repositories for clean index, unstaged-only jwt.verify(token), staged src/auth/login.rs containing jwt.verify(token), staged docs/note.txt containing 'plain note', and staged opaque.bin with NUL bytes (real Git emits a binary diff). Capture base via git rev-parse HEAD and index via git write-tree. The binary fixture is the deterministic inconclusive case; do not fake a scan.",
        "call": "Request debug-resolve in each fixture. In the match/inconclusive cases follow the real admission to review-next; read risk records and review-admission/material through their public reads and reopened confirmed store. Retry resolve for the same recorded fix and inspect that it retained one scan/fire. Read the null phase/head and exact material identities; no fabricated fire or direct snapshot insertion.",
        "boundary": "Real cadence serve child over MCP stdio, actual filesystem, Store journal and Git where used; cadence guard is a separate real binary process. No fake record, admission, review-return, risk-consequence or Git resolver.",
        "fakes": [
          "Caller inputs, fixed clock/Git dates and a temporary real fixture repository"
        ]
      },
      "reason": "Changing the trigger-to-record/readback behavior described here must fail this truth's single check.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "Changing the trigger-to-record/readback behavior described here must fail this truth's single check."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P16-T3-A1",
      "spec": {
        "locators": [
          "crates/cadence/src/rail/risk.rs",
          "crates/cadence/src/rail_service.rs",
          "crates/cadence/src/rail/receipts.rs"
        ],
        "substance": "Root-debug scope variant beside phase scope, identified by debug occurrence with no phase; exact staged material, empty-index refusal before clearance, existing phase-scope reads/digests preserved."
      },
      "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T3.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T3."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P16-T3-A2",
      "spec": {
        "locators": [
          "crates/cadence/src/debug_service.rs",
          "crates/cadence/src/debug/model.rs",
          "crates/cadence/src/review_service.rs",
          "crates/cadence/src/review/policy.rs"
        ],
        "substance": "Resolve coordinator risk-checks the real index, binds confirmed evidence to real review admission with caller debug, RootDebug home reviews/<fire> and staged-tree/null head. Match and checked inconclusive dispatch; nonmatch reaches verification, unreadable/unanswered never clears."
      },
      "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T3.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T3."
        }
      ]
    },
    {
      "kind": "link",
      "id": "P16-T3-L1",
      "spec": {
        "caller": "crates/cadence/src/debug_service.rs staged resolve admission",
        "callee": "crates/cadence/src/review_service.rs admitted target",
        "value": "staged tree"
      },
      "reason": "The truth explicitly names this value crossing the boundary; losing or substituting it breaks that outcome.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "The truth explicitly names this value crossing the boundary; losing or substituting it breaks that outcome."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Deliver root-debug staged admission and its single check

- **ID:** P16-3-T1
- **Files:** crates/cadence/src/rail/risk.rs, crates/cadence/src/rail/receipts.rs, crates/cadence/src/rail_service.rs, crates/cadence/src/review_service.rs, crates/cadence/src/review/policy.rs, crates/cadence/src/execution_service.rs, crates/cadence/src/execution/history.rs, crates/cadence/src/milestone/preflight.rs, crates/cadence/src/suggest_service.rs, crates/cadence/src/execution_service_tests.rs, crates/cadence/src/debug/model.rs, crates/cadence/src/debug_service.rs, crates/cadence/src/debug/render.rs, crates/cadence/src/server.rs, crates/cadence/src/recall/mod.rs, crates/cadence/tests/debug_review.rs, crates/cadence/tests/support/support_records.rs, crates/cadence/tests/phase7_receipts.rs, crates/cadence/tests/phase7_risk.rs, crates/cadence/tests/mcp.rs, crates/cadence/tests/debug_record.rs
- **Action:** Deliver P16-T3-C red then green and A1/A2/L1. Represent phase and root-debug as explicit scope variants, with serde compatibility for the existing phase representation and immutable observation digests. Update the actual constructors/phase consumers in the leased files, including milestone phase filtering, suggest filtering and execution finalization: root-debug never aliases a selected phase or an execution boundary. Extend both risk-check and risk-status scope selection, lookup and boundary creation; root-debug validates a real debug record instead of phases/<N>. Only Source::Staged applies to this scope. Capture HEAD and git write-tree through the existing Git acquisition; distinguish empty scannable index from checked clear material and refuse empty at debug-resolve. Persist a current observation; construct the real review-admit request with its saved request ID, same occurrence discriminator, null phase/plan, caller debug, RootDebug, exact StagedTree and null head. Join phase-less saved evidence before policy; add a debug-specific dispatch rule for confirmed checked inconclusive material without changing other callers' WaitForEvidence behavior. Admission yields the authoritative fire ID; bind the receipts rail fire to that same ID, material, observation and actual diff paths, and persist the join on the debug record. Resume incomplete coordination idempotently rather than duplicate a fire. Keep a pending blocking fire unresolved. Require current material equality before subsequent clearance. In this task's green commit only, measure the serialized tools/list result.tools bytes using the existing mcp pin, and move both byte-bound literals (10_304 at HEAD, crates/cadence/tests/mcp.rs:305 and crates/cadence/tests/mcp.rs:1626) once to that measured value plus a small 64-byte margin. Preserve the three-tool inventory. Record the measurement in the commit; do not guess a future bound or perform GH-271's separate description cut. Preserve the T1 resolved-list control using its real staged nonmatching change; no new T1 check is added.
- **Verify:**
  - cargo nextest run -p cadence --test debug_review debug_resolve_risk_checks_the_index_without_a_phase
  - cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions
  - cargo nextest run -p cadence --test debug_record debug_session_resumes_from_the_record_alone

### Task 2: Compile staging, risk refusals and shared dispatch into cad-debug

- **ID:** P16-3-T2
- **Files:** crates/cadence/src/debug/instructions.rs, skills/cad-debug/SKILL.md, crates/cadence/tests/mcp.rs, cadence-core/bin/weight-budgets.json
- **Action:** Show the exact source files and owner-approved fix, have the host git add only those files, then request resolve; display empty-index or unanswered/unavailable refusal without calling it a pass. Follow the admitted shared reviewer through cad-review-delivery and its actual host Task; no Rust substitute reviewer and no host-written review records. Explain checked inconclusive dispatch and the staged/null-head identity. Regenerate skill and pins, keeping count 21 and all seven allowed tools. The shared frozen risk-check helper/tests and review-triggers/triage-gate references remain: the HEAD consumer census found cad-execute/cad-task/cad-verify paths and shared prose pins.
- **Verify:**
  - cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions

## Notes

Depends on plans 1/2. Preserve the serialized legacy phase-scope shape and its digests during the Rust enum migration; no phase zero and no rewriting old observations. Pin remains 21. Until plan 4 settles receipts, a blocking admitted fire keeps resolve pending. Unanswered config and failure to resolve immutable material remain refusals; an actual checked-but-inconclusive staged scan fires.

Execute plans 1 through 7 sequentially, never concurrently. Repeated file leases extend only this plan's named surface and preserve earlier work. New paths, operation shapes and test functions below are creation specifications, not claims that they exist at HEAD. content.suite and typed tasks let the binary derive execution.schema=1, execution.suite and stable task verify arrays; do not submit an execution field. The check-delivering task records its one test red before implementation and green afterwards; later tasks use narrow regressions and create no additional evidence checks. No observation items. All records, replay identities and rendered projections use the existing Store request interface and sole journal, with root binding, expected generation and idempotent request IDs. Reject changed-input replay; never add a sidecar authority. D-207 side jobs are outside these leases. Phase 17 owns further contract enforcement; phase 18 owns absence/live-host acceptance; phase 21 owns its additional-round allowance and deferred settlement. Debug/spike records are not added to recall's corpus.
