---
phase: 16
plan: 6
requirements: ["T6"]
files: ["crates/cadence/src/spike/mod.rs","crates/cadence/src/spike/model.rs","crates/cadence/src/spike/render.rs","crates/cadence/src/spike_service.rs","crates/cadence/src/lib.rs","crates/cadence/src/server.rs","crates/cadence/src/store/model.rs","crates/cadence/src/store/writer.rs","crates/cadence/src/store/filesystem.rs","crates/cadence/src/store/transaction.rs","crates/cadence/src/execution/render.rs","crates/cadence/src/guard/mod.rs","crates/cadence/tests/spike_record.rs","crates/cadence/tests/support/support_records.rs","crates/cadence/tests/mcp.rs","crates/cadence/src/spike/instructions.rs","crates/cadence/src/main.rs","crates/cadence/src/guard/tests.rs","skills/cad-spike/SKILL.md","cadence-core/bin/weight-budgets.json","cadence-core/workflows/spike.md","cadence-core/bin/helper-census.test.mjs","cadence-core/bin/lib/census-registry.mjs","crates/cadence/src/recall/mod.rs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P16-6-T1","verify":["cargo nextest run -p cadence --test spike_record spike_criteria_precede_material_and_the_verdict_is_bounded"]},{"id":"P16-6-T2","verify":["cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions","cargo nextest run -p cadence --test spike_record spike_criteria_precede_material_and_the_verdict_is_bounded"]},{"id":"P16-6-T3","verify":["node --test cadence-core/bin/helper-census.test.mjs","cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions"]}]}
---
## Goal

Record each spike's criteria before the experiment, constrain verdicts, and protect the durable record while keeping throwaway material outside it.

## Must be true when done

- T6. When a spike is opened, the owner sees its question, decision and risk-ordered criteria recorded before any experiment material exists; a verdict outside validated, invalidated, inconclusive refused; and the criteria unchangeable after the verdict.

## Context

Depends on plan 5, including the debug projection integration and rendered-files pin at 21. The frozen spike front door includes only cadence-core/workflows/spike.md at skills/cad-spike/SKILL.md:22; the workflow currently allows scratch material inside the spike directory at cadence-core/workflows/spike.md:32, which D-204 replaces. The existing native-summary projection uses installed_summaries at crates/cadence/src/execution/render.rs:16 and the protected-target predicate starts at crates/cadence/src/guard/mod.rs:284. Reuse the Store journal and the debug record shape delivered by plan 1; do not migrate the ten historical spike directories.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P16-T6-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test spike_record spike_criteria_precede_material_and_the_verdict_is_bounded",
        "expected": {
          "kind": "literal",
          "value": "At open the literal question, decision and ordered criteria exist in the record and SPIKE.md, with no result section and no experiment material yet. Guard denies both host writes to the projection and other files inside its directory. confirmed is refused naming validated, invalidated, inconclusive; each allowed word is accepted with one observed result per criterion, and validated renders the three handwritten results. Changed criteria after verdict refuse without changing the original record. Close retains the external throwaway location; no experiment code is copied into project source or the spike directory. Reopened record and projection agree; all ten historical directory names and file bytes are unchanged."
        },
        "test": {
          "file": "crates/cadence/tests/spike_record.rs",
          "function": "spike_criteria_precede_material_and_the_verdict_is_bounded"
        },
        "setup": "Compose tests/support/phase13.rs Client::open at crates/cadence/tests/support/phase13.rs:22, fixture at crates/cadence/tests/support/phase13.rs:117, git at crates/cadence/tests/support/phase13.rs:361, git_value at crates/cadence/tests/support/phase13.rs:470 and reopened at crates/cadence/tests/support/phase13.rs:224 in new subject-named tests/support/support_records.rs. Borrow tracked document snapshots from crates/cadence/tests/support/phase14.rs:225 and real risk input jwt.verify(token) from crates/cadence/tests/support/phase15.rs:159, without calling its committed-material helper for a staged case. Create records only through public operations. Implement a guard probe launching CARGO_BIN_EXE_cadence guard with the real PreToolUse event shape at crates/cadence/src/guard/tests.rs:60; that existing helper uses a test-process child, so do not claim it already launches the integration binary. Copy the ten HEAD spike directories into the fixture as historical bytes and snapshot every relative filename and byte before serving it. Use slug tenant-cache, question 'Can tenant-local keys prevent cross-tenant cache hits?', decision 'Choose the cache key scheme', and three handwritten ordered criteria: isolation first, invalidation second, latency third, each with Given/When/Then and an explicit failure outcome. Reserve an external temporary throwaway location and assert it does not yet exist.",
        "call": "Through real stdio call spike-open, read its answer and rendered SPIKE.md before creating any throwaway material. Probe real cadence guard with Write and Edit to SPIKE.md and Write of experiment.rs inside the spike directory. Only then create the fixture's throwaway outside that directory; record one observed result for each criterion through spike-observation. Call spike-verdict with confirmed, then validated with the recorded criterion identities. Attempt changed criteria through a new-request-id spike-open on the same slug after verdict; use independent cases for invalidated and inconclusive. Call spike-close naming the outside throwaway location, restart serve, and inspect durable state and rendered bytes. Compare the ten historical directory snapshots exactly.",
        "boundary": "Real cadence serve child over MCP stdio, actual filesystem, Store journal and Git where used; cadence guard is a separate real binary process. No fake record, admission, review-return, risk-consequence or Git resolver.",
        "fakes": [
          "Caller inputs, fixed clock/Git dates and a temporary real fixture repository"
        ]
      },
      "reason": "Changing the trigger-to-record/readback behavior described here must fail this truth's single check.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "Changing the trigger-to-record/readback behavior described here must fail this truth's single check."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P16-T6-A1",
      "spec": {
        "locators": [
          "crates/cadence/src/spike/model.rs",
          "crates/cadence/src/spike_service.rs",
          "crates/cadence/src/store/writer.rs"
        ],
        "substance": "Journal-owned spike open/observation/verdict/close operations, literal question/decision/risk-ordered criteria, per-criterion observed results, the three-word verdict vocabulary, frozen criteria and recorded external throwaway location."
      },
      "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T6.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T6."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P16-T6-A2",
      "spec": {
        "locators": [
          "crates/cadence/src/spike/render.rs",
          "crates/cadence/src/guard/mod.rs",
          "crates/cadence/src/store/filesystem.rs"
        ],
        "substance": "Binary-rendered .planning/spikes/<slug>/SPIKE.md projection, guard denial of host Write/Edit to it and any other file inside the spike directory, and preservation of the ten historical spike directories. Only newly native-owned records are projected or repaired."
      },
      "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T6.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T6."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P16-T6-A3",
      "spec": {
        "locators": [
          "crates/cadence/src/spike/instructions.rs",
          "crates/cadence/src/main.rs",
          "crates/cadence/src/execution/render.rs",
          "skills/cad-spike/SKILL.md",
          "crates/cadence/tests/mcp.rs",
          "crates/cadence/src/guard/tests.rs"
        ],
        "substance": "Project-free cadence spike-instructions compiled front door, exact installed byte pin, allowed-tools cadence_apply/cadence_query/Write/Edit/Bash/AskUserQuestion, and rendered-files count 22."
      },
      "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T6.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T6."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Deliver the spike record, guard and one red-then-green check

- **ID:** P16-6-T1
- **Files:** crates/cadence/src/spike/mod.rs, crates/cadence/src/spike/model.rs, crates/cadence/src/spike/render.rs, crates/cadence/src/spike_service.rs, crates/cadence/src/lib.rs, crates/cadence/src/server.rs, crates/cadence/src/store/model.rs, crates/cadence/src/store/writer.rs, crates/cadence/src/store/filesystem.rs, crates/cadence/src/store/transaction.rs, crates/cadence/src/execution/render.rs, crates/cadence/src/guard/mod.rs, crates/cadence/tests/spike_record.rs, crates/cadence/tests/support/support_records.rs, crates/cadence/tests/mcp.rs, crates/cadence/src/recall/mod.rs
- **Action:** Deliver this plan's one check red before implementation, then green. Add typed spike-open, spike-observation, spike-verdict, spike-close apply variants and their Store request wiring, using the same sole journal and safe projection namespace as debug. Require nonempty question/decision and ordered distinct criterion identities before observations; reject missing/foreign criteria in results, unsupported verdicts and reopening a slug with changed immutable inputs. Replaying identical input is idempotent. Render no results section until results exist; retain caller observations without pretending the binary adjudicates them. Record the external throwaway location at close and reject a location inside .planning/spikes or project production source; the host creates/discards experiments outside the record directory. Extend protected_target for the entire spikes directory subtree, including non-SPIKE.md paths, and transaction path validation only for native-owned SPIKE.md projections; never scan history into new records or rewrite its bytes. Preserve debug protection. This task changes projection support but not the static rendered-skill registry, which stays 21 until the next task. In this task's green commit only, measure the serialized tools/list result.tools bytes using the existing mcp pin, and move both byte-bound literals (10_304 at HEAD, crates/cadence/tests/mcp.rs:305 and crates/cadence/tests/mcp.rs:1626) once to that measured value plus a small 64-byte margin. Preserve the three-tool inventory. Record the measurement in the commit; do not guess a future bound or perform GH-271's separate description cut. Add the spike resident request/dispatch to recall/mod.rs so its service shares the bound session and single writer.
- **Verify:**
  - cargo nextest run -p cadence --test spike_record spike_criteria_precede_material_and_the_verdict_is_bounded

### Task 2: Compile and render the spike front door

- **ID:** P16-6-T2
- **Files:** crates/cadence/src/spike/instructions.rs, crates/cadence/src/spike/mod.rs, crates/cadence/src/main.rs, crates/cadence/src/execution/render.rs, crates/cadence/src/guard/tests.rs, crates/cadence/tests/mcp.rs, skills/cad-spike/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** Add cadence spike-instructions and RENDERED_PROJECT_FILES entry for cad-spike. Compile the question/decision interview, falsifiable Given/When/Then criteria, risk-first experiment order, explicit open/readback before experiment creation, observations, bounded verdict and close. Replace the former allowance for scratch inside the spike directory with an external temporary directory. allowed-tools are cadence_apply, cadence_query, Write, Edit, Bash, AskUserQuestion (with the real MCP prefixes in YAML); no Task. Regenerate SKILL.md from the binary. Move both rendered-file counts from 21 to 22, add per-skill body/permissions and installed-equals-renderer pin, preserve the debug pin, and update the skill budget. No second tools/list bound change.
- **Verify:**
  - cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions
  - cargo nextest run -p cadence --test spike_record spike_criteria_precede_material_and_the_verdict_is_bounded

### Task 3: Delete the replaced spike workflow and update its budget/census

- **ID:** P16-6-T3
- **Files:** cadence-core/workflows/spike.md, cadence-core/bin/weight-budgets.json, cadence-core/bin/helper-census.test.mjs, cadence-core/bin/lib/census-registry.mjs
- **Action:** Delete cadence-core/workflows/spike.md after its only skill include has been replaced. HEAD census across skills/ and cadence-core/ finds that include only in cad-spike and the workflow's weight-budget entry; no dedicated frozen spike workflow test imports or reads it. Consequently no unrelated frozen test is removed. Remove its weight-budget row; reconcile any affected helper census/registry totals while preserving unrelated rows. Do not delete, edit, normalize or migrate any of the ten .planning/spikes directories. Keep all risk-check and shared review/reference tests.
- **Verify:**
  - node --test cadence-core/bin/helper-census.test.mjs
  - cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions

## Notes

Question, decision and criteria are fixed by open; a repeated open with changed criteria is refused, including after verdict. No criteria-edit operation is needed to satisfy the freeze. The binary does not infer experimental truth: callers supply observed results and choose one allowed verdict. The compiled skill orders open/readback before scratch creation and keeps that material outside .planning/spikes.

Execute plans 1 through 7 sequentially, never concurrently. Repeated file leases extend only this plan's named surface and preserve earlier work. New paths, operation shapes and test functions below are creation specifications, not claims that they exist at HEAD. content.suite and typed tasks let the binary derive execution.schema=1, execution.suite and stable task verify arrays; do not submit an execution field. The check-delivering task records its one test red before implementation and green afterwards; later tasks use narrow regressions and create no additional evidence checks. No observation items. All records, replay identities and rendered projections use the existing Store request interface and sole journal, with root binding, expected generation and idempotent request IDs. Reject changed-input replay; never add a sidecar authority. D-207 side jobs are outside these leases. Phase 17 owns further contract enforcement; phase 18 owns absence/live-host acceptance; phase 21 owns its additional-round allowance and deferred settlement. Debug/spike records are not added to recall's corpus.
