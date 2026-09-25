---
phase: 16
plan: 2
requirements: ["T2"]
files: ["crates/cadence/src/recall/mod.rs","crates/cadence/src/recall/documents.rs","crates/cadence/src/recall/history.rs","crates/cadence/src/recall/rank.rs","crates/cadence/src/recall/tests.rs","crates/cadence/src/server.rs","crates/cadence/src/debug/model.rs","crates/cadence/src/debug_service.rs","crates/cadence/src/debug/render.rs","crates/cadence/tests/debug_record.rs","crates/cadence/tests/support/support_records.rs","crates/cadence/tests/mcp.rs","crates/cadence/src/debug/instructions.rs","skills/cad-debug/SKILL.md","cadence-core/bin/weight-budgets.json"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P16-2-T1","verify":["cargo nextest run -p cadence --test debug_record debug_open_reads_recall_by_the_effective_backend","cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions"]},{"id":"P16-2-T2","verify":["cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions"]}]}
---
## Goal

Put phase-filtered recall on the wire and retain symptom recall when a debug session opens.

## Must be true when done

- T2. When a debug session is opened, the owner gets recall for the symptom under the effective memory.backend: hits with source and phase on the record under builtin, none and no corpus read under none, and the recall query filtering by phase.

## Context

D-203 and GH-269. CadenceServer::recall exists off-wire at crates/cadence/src/server.rs:185; QueryArguments at crates/cadence/src/server.rs:271 lacks recall. The resident gates backend none before corpus preparation at crates/cadence/src/recall/mod.rs:418. Record provenance carries phase at crates/cadence/src/recall/mod.rs:23; Document provenance carries a path rather than a phase, and Residue carries its own phase spelling. Eligible documents at crates/cadence/src/recall/documents.rs:44 exclude debug and spikes. memory.backend defaults builtin at crates/cadence/src/config/schema.json:446; merge applies defaults and layers at crates/cadence/src/config/merge.rs:158.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P16-T2-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test debug_record debug_open_reads_recall_by_the_effective_backend",
        "expected": {
          "kind": "property",
          "value": "builtin open stores matching hits with source and phase; phase=1 query returns only phase-1 document/capture hits, never phase 2 or phaseless records, and limit is applied after phase filtering. In the unreadable-file sub-case, builtin names phases/1/SUMMARY.md in incomplete and returns the other matching file's hit from phases/2/SUMMARY.md. None returns backend='none', results=[], total=0, incomplete=[]: an attempted read of the unreadable corpus file would have named it in incomplete. Skip only the unreadable-file sub-case when the test runs as root, since root can read mode 000. Unset key returns builtin and matching hits. Restart preserves the open record's original recall hits."
        },
        "test": {
          "file": "crates/cadence/tests/debug_record.rs",
          "function": "debug_open_reads_recall_by_the_effective_backend"
        },
        "setup": "Compose tests/support/phase13.rs Client::open at crates/cadence/tests/support/phase13.rs:22, fixture at crates/cadence/tests/support/phase13.rs:117, git at crates/cadence/tests/support/phase13.rs:361, git_value at crates/cadence/tests/support/phase13.rs:470 and reopened at crates/cadence/tests/support/phase13.rs:224 in new subject-named tests/support/support_records.rs. Borrow tracked document snapshots from crates/cadence/tests/support/phase14.rs:225 and real risk input jwt.verify(token) from crates/cadence/tests/support/phase15.rs:159, without calling its committed-material helper for a staged case. Create records only through public operations. Implement a guard probe launching CARGO_BIN_EXE_cadence guard with the real PreToolUse event shape at crates/cadence/src/guard/tests.rs:60; that existing helper uses a test-process child, so do not claim it already launches the integration binary. In this check's own fixture in tests/support/support_records.rs, write .planning/ROADMAP.md under the fixture root before first-touch/config initialization, the phase-1 todo capture and either SUMMARY file, declaring phases 1 and 2 beside 13 and 28 with rows in the crates/cadence/tests/support/phase13.rs:123 shape; leave crates/cadence/tests/support/phase13.rs unchanged. Add handwritten phases/1/SUMMARY.md deviation '- cache stale token from reused key' and phases/2/SUMMARY.md deviation '- cache stale token from changed key'; leave them uncommitted to avoid history duplicates. Seed a phase-1 todo capture, the only capture kind that takes a phase, through the native capture operation as an additional typed Record provenance case. Use independent builtin, none and unset-key fixtures. Keep both matching SUMMARY files readable for the phase-filter and restart assertions. In a separate unreadable-file sub-case, make phases/1/SUMMARY.md mode 000 after first-touch/config initialization, leaving phases/2/SUMMARY.md readable; use independent builtin and none fixtures with the same corpus. Skip only this sub-case when the test runs as root, since root reads mode 000; do not skip the remaining backend, phase-filter or restart assertions. Restore permissions for fixture cleanup. The read-error answer is the oracle: crates/cadence/src/recall/documents.rs:156 appends the failed file to incomplete, exposed by crates/cadence/src/recall/mod.rs:121.",
        "call": "debug-open with symptom 'cache stale token'; query recall with that query, phase=1, limit=10 and separately limit=1; restart and debug-status. Repeat open/query in none and unset fixtures. For the unreadable-file sub-case, open and query without a phase filter under builtin and none, asserting builtin's incomplete entry and the readable phase-2 file's hit, and none's backend='none', results=[], total=0, incomplete=[]. Compare record recall to returned provenance.",
        "boundary": "Real cadence serve child over MCP stdio, actual filesystem, Store journal and Git where used; cadence guard is a separate real binary process. No fake record, admission, review-return, risk-consequence or Git resolver.",
        "fakes": [
          "Caller inputs, fixed clock/Git dates and a temporary real fixture repository"
        ]
      },
      "reason": "Changing the trigger-to-record/readback behavior described here must fail this truth's single check.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "Changing the trigger-to-record/readback behavior described here must fail this truth's single check."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P16-T2-A1",
      "spec": {
        "locators": [
          "crates/cadence/src/server.rs",
          "crates/cadence/src/recall/mod.rs",
          "crates/cadence/src/recall/documents.rs",
          "crates/cadence/src/recall/history.rs"
        ],
        "substance": "recall {query, limit?, phase?} public query, filtering by typed Record phase and structural document/residue phase provenance before result limiting; existing corpus/scoring retained, no parsing phase from snippet text."
      },
      "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T2.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T2."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P16-T2-A2",
      "spec": {
        "locators": [
          "crates/cadence/src/debug/model.rs",
          "crates/cadence/src/debug_service.rs",
          "crates/cadence/src/debug/render.rs"
        ],
        "substance": "debug-open folds recall for the exact symptom under effective memory.backend; retains backend, source/phase provenance and bounded hits with the debug record; none short-circuits all corpus/history I/O."
      },
      "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T2.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T2."
        }
      ]
    },
    {
      "kind": "link",
      "id": "P16-T2-L1",
      "spec": {
        "caller": "crates/cadence/src/recall/mod.rs recall answer",
        "callee": "crates/cadence/src/debug_service.rs debug-open record",
        "value": "hits with source and phase"
      },
      "reason": "The truth explicitly names this value crossing the boundary; losing or substituting it breaks that outcome.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "The truth explicitly names this value crossing the boundary; losing or substituting it breaks that outcome."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Deliver the effective-backend and phase-filtered recall check

- **ID:** P16-2-T1
- **Files:** crates/cadence/src/recall/mod.rs, crates/cadence/src/recall/documents.rs, crates/cadence/src/recall/history.rs, crates/cadence/src/recall/rank.rs, crates/cadence/src/recall/tests.rs, crates/cadence/src/server.rs, crates/cadence/src/debug/model.rs, crates/cadence/src/debug_service.rs, crates/cadence/src/debug/render.rs, crates/cadence/tests/debug_record.rs, crates/cadence/tests/support/support_records.rs, crates/cadence/tests/mcp.rs
- **Action:** Deliver P16-T2-C red then green and A1/A2/L1. Add the wire schema/dispatch and optional positive integer phase filter while retaining compatibility for existing off-wire callers through a delegating unfiltered entrypoint. Carry phase selection through the resident and cache/result key; rank the unchanged eligible corpus, filter provenance before limiting/counting returned matches, and expose source plus optional phase without inventing phase zero. Canonical positive phase path components and residue origins determine document phases; decimal spellings never alias integer phases. Keep phaseless hits only in unfiltered results. Extract a shared session-level recall path for debug-open, avoiding a recursive resident mailbox call. Read effective backend before preparation; persist the recall snapshot with open's record/projection through the plan-1 writer. Do not add debug/spike corpus tiers. In this check's own fixture in tests/support/support_records.rs, write .planning/ROADMAP.md under the fixture root before first-touch/config initialization, the phase-1 todo capture and either SUMMARY file, declaring phases 1 and 2 beside 13 and 28 with rows in the crates/cadence/tests/support/phase13.rs:123 shape; leave crates/cadence/tests/support/phase13.rs unchanged. Implement the unreadable-file sub-case in support_records using recall's own answer: after first-touch/config initialization, set the matching phases/1/SUMMARY.md to mode 000 and leave the matching phases/2/SUMMARY.md readable. Under builtin, assert that incomplete names the unreadable file and results includes the other file's hit; under none, assert backend='none', results=[], total=0 and incomplete=[], since an attempted read would have named the unreadable file there. Skip only this sub-case when the test runs as root, since root reads mode 000, and restore permissions for cleanup. Keep the readable-corpus phase-filter and restart-preserves-hits assertions, and assert the schema default builtin when the key is unset. In this task's green commit only, measure the serialized tools/list result.tools bytes using the existing mcp pin, and move both byte-bound literals (10_304 at HEAD, crates/cadence/tests/mcp.rs:305 and crates/cadence/tests/mcp.rs:1626) once to that measured value plus a small 64-byte margin. Preserve the three-tool inventory. Record the measurement in the commit; do not guess a future bound or perform GH-271's separate description cut.
- **Verify:**
  - cargo nextest run -p cadence --test debug_record debug_open_reads_recall_by_the_effective_backend
  - cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions

### Task 2: Present retained recall in the compiled debug method

- **ID:** P16-2-T2
- **Files:** crates/cadence/src/debug/instructions.rs, skills/cad-debug/SKILL.md, crates/cadence/tests/mcp.rs, cadence-core/bin/weight-budgets.json
- **Action:** Render debug-open's returned recall with each source/phase and describe recall as candidate evidence, never a confirmed hypothesis. Use the typed query for explicit recall requests, no planning.mjs subprocess and no references/recall.md include. Keep pin 21. Retain planning/recall.mjs, planning-recall.test.mjs and config-seams.test.mjs's recall cases because the HEAD census found other callers; no helper-census or census-registry count changes accompany a non-deletion. Update generated skill budget only.
- **Verify:**
  - cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions

## Notes

Depends on plan 1. Rendered-files pin remains 21. JavaScript recall and its tests cannot be deleted: planning.mjs still imports/registers cmdRecall at cadence-core/bin/planning.mjs:213 and cadence-core/bin/planning.mjs:272, with frozen workflow calls in plan.md and context.md. references/recall.md likewise retains context's include. The conditional deletion requirement therefore selects retention, not a claim that this surface is unused.

Execute plans 1 through 7 sequentially, never concurrently. Repeated file leases extend only this plan's named surface and preserve earlier work. New paths, operation shapes and test functions below are creation specifications, not claims that they exist at HEAD. content.suite and typed tasks let the binary derive execution.schema=1, execution.suite and stable task verify arrays; do not submit an execution field. The check-delivering task records its one test red before implementation and green afterwards; later tasks use narrow regressions and create no additional evidence checks. No observation items. All records, replay identities and rendered projections use the existing Store request interface and sole journal, with root binding, expected generation and idempotent request IDs. Reject changed-input replay; never add a sidecar authority. D-207 side jobs are outside these leases. Phase 17 owns further contract enforcement; phase 18 owns absence/live-host acceptance; phase 21 owns its additional-round allowance and deferred settlement. Debug/spike records are not added to recall's corpus.

Falsification finding 1 of .codex-analysis/phase16-falsification.md corrected this plan on 2026-09-20.
