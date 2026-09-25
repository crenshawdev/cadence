---
phase: 16
plan: 1
requirements: ["T1"]
files: ["crates/cadence/src/debug/mod.rs","crates/cadence/src/debug/model.rs","crates/cadence/src/debug/render.rs","crates/cadence/src/debug_service.rs","crates/cadence/src/lib.rs","crates/cadence/src/server.rs","crates/cadence/src/recall/mod.rs","crates/cadence/src/store/model.rs","crates/cadence/src/store/writer.rs","crates/cadence/src/store/transaction.rs","crates/cadence/src/store/filesystem.rs","crates/cadence/src/guard/mod.rs","crates/cadence/tests/support/support_records.rs","crates/cadence/tests/debug_record.rs","crates/cadence/tests/mcp.rs","crates/cadence/src/debug/instructions.rs","crates/cadence/src/main.rs","crates/cadence/src/execution/render.rs","crates/cadence/src/guard/tests.rs","skills/cad-debug/SKILL.md","cadence-core/bin/weight-budgets.json","cadence-core/workflows/debug.md","cadence-core/references/bug-patterns.md","cadence-core/bin/prose-agreement.test.mjs","cadence-core/bin/deferred-reads.test.mjs","cadence-core/bin/lib/deferred-reads.mjs","cadence-core/bin/lib/bulk-output.mjs","cadence-core/bin/bulk-output.test.mjs","cadence-core/bin/helper-census.test.mjs","cadence-core/bin/lib/census-registry.mjs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P16-1-T1","verify":["cargo nextest run -p cadence --test debug_record debug_session_resumes_from_the_record_alone","cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions"]},{"id":"P16-1-T2","verify":["cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions"]},{"id":"P16-1-T3","verify":["node --test --test-name-pattern='AC4: cad-context / references/recall.md' cadence-core/bin/deferred-reads.test.mjs","cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions","node --test --test-name-pattern='the register' cadence-core/bin/bulk-output.test.mjs","node --test cadence-core/bin/helper-census.test.mjs"]}]}
---
## Goal

Resume debug investigations from a durable binary record, with protected Markdown and a compiled cad-debug front door.

## Must be true when done

- T1. When a debug session is continued after any recorded observation, the owner sees the same symptom, hypotheses with their state, observations and attempt count, read from the binary's debug record and nothing else.

## Context

D-201/D-208. At HEAD the frozen debug workflow describes host-written state and grep routes (cadence-core/workflows/debug.md:7 and cadence-core/workflows/debug.md:31). The new module follows the typed operation/record/contribute shape in crates/cadence/src/undo/model.rs:23 and the Store request path in crates/cadence/src/undo_service.rs:33. Writer::persist is private at crates/cadence/src/store/writer.rs:1913 and calls transaction::commit at crates/cadence/src/store/writer.rs:1938; there is no Store::persist. SUMMARY rendering is recorded by crates/cadence/src/execution/render.rs:29; guard ownership is selected at crates/cadence/src/guard/mod.rs:284. Debug is absent from that selector today. Compose tests/support/phase13.rs Client::open at crates/cadence/tests/support/phase13.rs:22, fixture at crates/cadence/tests/support/phase13.rs:117, git at crates/cadence/tests/support/phase13.rs:361, git_value at crates/cadence/tests/support/phase13.rs:470 and reopened at crates/cadence/tests/support/phase13.rs:224 in new subject-named tests/support/support_records.rs. Borrow tracked document snapshots from crates/cadence/tests/support/phase14.rs:225 and real risk input jwt.verify(token) from crates/cadence/tests/support/phase15.rs:159, without calling its committed-material helper for a staged case. Create records only through public operations. Implement a guard probe launching CARGO_BIN_EXE_cadence guard with the real PreToolUse event shape at crates/cadence/src/guard/tests.rs:60; that existing helper uses a test-process child, so do not claim it already launches the integration binary.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P16-T1-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test debug_record debug_session_resumes_from_the_record_alone",
        "expected": {
          "kind": "literal",
          "value": "symptom='cache returns old value'; hypotheses h1/refuted and h2/untested with their exact rank reasons; observation print process version/current version/rules_out h1 unchanged; attempt_count=1. Continue survives a process restart and ignores altered projection content. .planning/debug/cache-miss.md equals rendered record bytes. Both guard probes answer permissionDecision=deny. list returns cache-miss and excludes the resolved control; unknown status is refused naming missing-slug."
        },
        "test": {
          "file": "crates/cadence/tests/debug_record.rs",
          "function": "debug_session_resumes_from_the_record_alone"
        },
        "setup": "Compose tests/support/phase13.rs Client::open at crates/cadence/tests/support/phase13.rs:22, fixture at crates/cadence/tests/support/phase13.rs:117, git at crates/cadence/tests/support/phase13.rs:361, git_value at crates/cadence/tests/support/phase13.rs:470 and reopened at crates/cadence/tests/support/phase13.rs:224 in new subject-named tests/support/support_records.rs. Borrow tracked document snapshots from crates/cadence/tests/support/phase14.rs:225 and real risk input jwt.verify(token) from crates/cadence/tests/support/phase15.rs:159, without calling its committed-material helper for a staged case. Create records only through public operations. Implement a guard probe launching CARGO_BIN_EXE_cadence guard with the real PreToolUse event shape at crates/cadence/src/guard/tests.rs:60; that existing helper uses a test-process child, so do not claim it already launches the integration binary. Open slug cache-miss with literal symptom 'cache returns old value'; add h1 'stale process' / rank 'cheapest identity check' and h2 'wrong key' / rank 'next discriminating check'; record observation test='print process version', result='current version', rules_out=['h1'], h1 refuted, h2 untested; record one failed fix attempt. In an independent repository stage docs/note.txt='plain note' with a configured auth surface, then make a separate session resolved through debug-resolve with caller-recorded successful reproduction evidence. This staged nonmatching control remains valid when plan 3 adds the risk gate. The fixture's Markdown is a projection, never input authority.",
        "call": "Stop and restart serve; debug-continue cache-miss, debug-status, debug-list, and debug-status missing-slug. Compare returned record fields to handwritten literals and the projected file to the compiled renderer; also compare key rendered lines to handwritten text. In a separate stopped-process copy replace only the Markdown with misleading symptom/count bytes, restart and continue; record fields must stay original or the projection may be repaired from the record. Probe real guard Write and Edit on the debug path.",
        "boundary": "Real cadence serve child over MCP stdio, actual filesystem, Store journal and Git where used; cadence guard is a separate real binary process. No fake record, admission, review-return, risk-consequence or Git resolver.",
        "fakes": [
          "Caller inputs, fixed clock/Git dates and a temporary real fixture repository"
        ]
      },
      "reason": "Changing the trigger-to-record/readback behavior described here must fail this truth's single check.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "Changing the trigger-to-record/readback behavior described here must fail this truth's single check."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P16-T1-A1",
      "spec": {
        "locators": [
          "crates/cadence/src/debug/model.rs",
          "crates/cadence/src/debug_service.rs",
          "crates/cadence/src/store/writer.rs",
          "crates/cadence/src/store/transaction.rs"
        ],
        "substance": "Versioned debug record with symptom, hypotheses (untested/testing/refuted/confirmed plus rank reason), observations (test/result/rules in or out), failed-attempt count, open/resolved status and resolution. debug-open/hypothesis/observation/attempt/resolve apply operations and debug-list/status/continue queries are journaled or read from that record alone."
      },
      "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T1.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T1."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P16-T1-A2",
      "spec": {
        "locators": [
          "crates/cadence/src/debug/render.rs",
          "crates/cadence/src/store/filesystem.rs",
          "crates/cadence/src/guard/mod.rs",
          ".planning/debug/<slug>.md"
        ],
        "substance": "Contained slug-derived Markdown projection installed in the same journal transition as its record; guard refuses host Write/Edit to the binary-owned debug path; no file/grep fallback for continuation."
      },
      "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T1.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T1."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P16-T1-A3",
      "spec": {
        "locators": [
          "crates/cadence/src/debug/instructions.rs",
          "crates/cadence/src/main.rs",
          "crates/cadence/src/execution/render.rs",
          "skills/cad-debug/SKILL.md",
          "crates/cadence/tests/mcp.rs",
          "crates/cadence/src/guard/tests.rs"
        ],
        "substance": "Compiled cadence debug-instructions front door and rendered skill with exact-byte/permission pins; rendered registry count 21, retaining host reviewer dispatch, owner-approved fix and explicit git add."
      },
      "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T1.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T1."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Deliver the debug record, continuation check and protected projection

- **ID:** P16-1-T1
- **Files:** crates/cadence/src/debug/mod.rs, crates/cadence/src/debug/model.rs, crates/cadence/src/debug/render.rs, crates/cadence/src/debug_service.rs, crates/cadence/src/lib.rs, crates/cadence/src/server.rs, crates/cadence/src/recall/mod.rs, crates/cadence/src/store/model.rs, crates/cadence/src/store/writer.rs, crates/cadence/src/store/transaction.rs, crates/cadence/src/store/filesystem.rs, crates/cadence/src/guard/mod.rs, crates/cadence/tests/support/support_records.rs, crates/cadence/tests/debug_record.rs, crates/cadence/tests/mcp.rs, crates/cadence/src/execution/render.rs
- **Action:** Deliver P16-T1-C red then green and A1/A2. Define typed validated slug/request/version operations; maintain explicit hypothesis identities and states, complete observations, failed attempts and resolution. Open initializes attempts=0 and status=open; observation updates and its hypothesis state commit together. Resolve records the caller's reproduction outcome and resolution; a failed reproduction records a failed attempt and keeps open. Expose open-only list, exact status/continue and slug-located unknown refusals. Route server schemas, dispatch and resident mailbox through the bound session without nested self-mailbox awaits. Add a narrow owning Store operation/intent with namespace validation, safe target mapping and recovery; atomically render the projection with the record. Reject arbitrary document paths and symlink escapes; preserve unrelated namespaces and historical journal decoding. Continue consumes the record even if the Markdown is absent or misleading. Add the real guard probe and fixture helper described in Context. In this task's green commit only, measure the serialized tools/list result.tools bytes using the existing mcp pin, and move both byte-bound literals (10_304 at HEAD, crates/cadence/tests/mcp.rs:305 and crates/cadence/tests/mcp.rs:1626) once to that measured value plus a small 64-byte margin. Preserve the three-tool inventory. Record the measurement in the commit; do not guess a future bound or perform GH-271's separate description cut. Extend the installed projection helper beside SUMMARY in execution/render.rs now; leave the static skill registry at 20 until task 2.
- **Verify:**
  - cargo nextest run -p cadence --test debug_record debug_session_resumes_from_the_record_alone
  - cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions

### Task 2: Render the debug role and move the skill pin to 21

- **ID:** P16-1-T2
- **Files:** crates/cadence/src/debug/instructions.rs, crates/cadence/src/debug/mod.rs, crates/cadence/src/main.rs, crates/cadence/src/execution/render.rs, crates/cadence/src/guard/tests.rs, crates/cadence/tests/mcp.rs, skills/cad-debug/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** Deliver A3. Add cadence debug-instructions and one RENDERED_PROJECT_FILES entry, regenerate cad-debug and pin exact installed bytes, front matter and body in mcp.rs. Move both rendered-file pins 20 -> 21. allowed-tools is exactly Task, mcp__cadence__cadence_apply, mcp__cadence__cadence_query, Write, Edit, Bash, AskUserQuestion. Host source edits and git add remain explicit owner-approved fix steps, reviewer launch uses cad-review-delivery, and all investigation writes use operations. Compile the scientific method, ranked hypotheses, cheap tests, diagnose-only reporting, single deliberate attempts and recovery instructions. Fold the useful bug-pattern discipline into compiled text before removing its sole include. Subsequent plans add recall/risk/settlement/consult specifics to this same source; no host-written debug file or grep route. Update only the generated skill's budget.
- **Verify:**
  - cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions

### Task 3: Delete the replaced debug workflow and its frozen consumers

- **ID:** P16-1-T3
- **Files:** cadence-core/workflows/debug.md, cadence-core/references/bug-patterns.md, cadence-core/bin/prose-agreement.test.mjs, cadence-core/bin/deferred-reads.test.mjs, cadence-core/bin/lib/deferred-reads.mjs, cadence-core/bin/lib/bulk-output.mjs, cadence-core/bin/bulk-output.test.mjs, cadence-core/bin/weight-budgets.json, cadence-core/bin/helper-census.test.mjs, cadence-core/bin/lib/census-registry.mjs
- **Action:** HEAD census over skills/ and cadence-core/: debug.md is included only by cad-debug; bug-patterns.md only by debug.md. Delete those two after compiled replacement. Remove only debug-specific assertions in prose-agreement (the debug arm at cadence-core/bin/prose-agreement.test.mjs:3264 and its stagedSites row), retaining verify's staged checks and the shared risk_surface wiring test. Remove debug rows from deferred-reads and bulk-output registries with their real-tree test cases and matching count/registry metadata; keep synthetic parser tests. Remove deleted-path budget rows; inspect helper-census and census-registry and update only entries/counts whose subjects changed. Keep consult.md (plan/execute still name it), recall.md (context still includes it), and review-triggers.md/triage-gate.md (task/execute/verify and other references consume them). Keep risk-check.mjs, its risk-diff tests, config.mjs and trace re-arm tests. Do not erase shared tests to conceal surviving dependencies.
- **Verify:**
  - node --test --test-name-pattern='AC4: cad-context / references/recall.md' cadence-core/bin/deferred-reads.test.mjs
  - cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions
  - node --test --test-name-pattern='the register' cadence-core/bin/bulk-output.test.mjs
  - node --test cadence-core/bin/helper-census.test.mjs

## Notes

Plan 1 delivers record persistence and continuation; plans 3 and 4 subsequently strengthen fix-resolution admission and settlement. No phase-completion or settlement-verification layer is implied by a resolved debug record. Pin after this rendering plan: 21 (20 -> 21).

Execute plans 1 through 7 sequentially, never concurrently. Repeated file leases extend only this plan's named surface and preserve earlier work. New paths, operation shapes and test functions below are creation specifications, not claims that they exist at HEAD. content.suite and typed tasks let the binary derive execution.schema=1, execution.suite and stable task verify arrays; do not submit an execution field. The check-delivering task records its one test red before implementation and green afterwards; later tasks use narrow regressions and create no additional evidence checks. No observation items. All records, replay identities and rendered projections use the existing Store request interface and sole journal, with root binding, expected generation and idempotent request IDs. Reject changed-input replay; never add a sidecar authority. D-207 side jobs are outside these leases. Phase 17 owns further contract enforcement; phase 18 owns absence/live-host acceptance; phase 21 owns its additional-round allowance and deferred settlement. Debug/spike records are not added to recall's corpus.
