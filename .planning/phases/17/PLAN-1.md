---
phase: 17
plan: 1
requirements: ["T1"]
files: ["crates/cadence/src/task/mod.rs","crates/cadence/src/task/model.rs","crates/cadence/src/task_service.rs","crates/cadence/src/lib.rs","crates/cadence/src/server.rs","crates/cadence/src/recall/mod.rs","crates/cadence/src/rail/risk.rs","crates/cadence/src/rail/receipts.rs","crates/cadence/src/rail_service.rs","crates/cadence/tests/task_record.rs","crates/cadence/tests/support/task_fixtures.rs","crates/cadence/tests/support/serve.rs","crates/cadence/tests/mcp.rs","crates/cadence/src/execution/instructions.rs","crates/cadence/src/task/instructions.rs","crates/cadence/src/execution/render.rs","crates/cadence/src/main.rs","crates/cadence/src/help/table.rs","crates/cadence/src/guard/tests.rs","crates/cadence/tests/help_reference.rs","skills/cad-task/SKILL.md","cadence-core/bin/weight-budgets.json","cadence-core/bin/lib/census-registry.mjs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P17-1-T1","verify":["cargo nextest run -p cadence --test task_record task_treeless_done_reports_unrecorded","cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions"]},{"id":"P17-1-T2","verify":["cargo nextest run -p cadence --test task_record task_treeless_done_reports_unrecorded","cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions","cargo nextest run -p cadence --test help_reference help_lists_the_installed_skills_from_the_compiled_table"]}]}
---
## Goal

Open and close an explicitly identified treeless task under the shared executor contract, with honest risk and recording dispositions.

## Must be true when done

- T1. When a task is done with no planning root under the task executor contract, the owner sees done with the risk disposition stated and the record called unrecorded, no .planning/ and no tasks/<slug>/ created, and a blocking risk still blocking.

## Context

Grounded at HEAD 0bba2df0, which overrides the older context's code facts. The frozen skill includes the task workflow at skills/cad-task/SKILL.md:23. The completion rule is cadence-core/workflows/task.md:208; D-118 is .planning/phases/12/CONTEXT.md:301. The shared executor source exposes contract/frontdoor composition at crates/cadence/src/execution/instructions.rs:313. RENDERED_PROJECT_FILES starts at crates/cadence/src/execution/render.rs:144 and currently contains 23 entries; the pins are crates/cadence/tests/mcp.rs:1562 and crates/cadence/src/guard/tests.rs:90. This plan precedes the rooted record work; its task namespace must not pretend to be a phase or acquire a store without a root.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "check/task_treeless_done_reports_unrecorded",
      "spec": {
        "command": "cargo nextest run -p cadence --test task_record task_treeless_done_reports_unrecorded",
        "expected": {
          "kind": "property",
          "value": "Inline open is accepted and ephemeral. Harmless close says done, risk clear and record unrecorded. Both .planning and tasks/<slug> remain absent; no unexpected project entry changes. The risk copy is blocked and names auth; no task record is written and transient risk material is removed. The missing-file case names that file, not an absent planning root. Protected-branch policy is enforced before any task change."
        },
        "test": {
          "file": "crates/cadence/tests/task_record.rs",
          "function": "task_treeless_done_reports_unrecorded"
        },
        "setup": "Add tests/support/task_fixtures.rs using the real Client handshake at crates/cadence/tests/support/serve.rs:21, git/git_value at crates/cadence/tests/support/serve.rs:361 and :470, and the real repository/risk setup at crates/cadence/tests/support/landing_fixtures.rs:16 and :159. Make a genuine git repository on protected main without .planning, with explicit protected-branch policy and auth risk surface supplied as fixture inputs. Obtain the policy disposition, switch to an authorized fixture branch, and task-open inline. Capture the start SHA. A second independent repo has the auth change. Snapshot the project listing excluding .git immediately around each operation; intentionally authored commits are outside those before/after comparisons.",
        "call": "Call real cadence_apply task-open, create one harmless committed file, then task-close over stdio in the same resident. Repeat with a committed jwt.verify(token) change and auth configured blocking. Repeat close with an explicitly named nonexistent file. Observe the real child and per-run temporary directory after each answer.",
        "boundary": "Real serve stdin/stdout, real git history and filesystem; control only caller inputs and fixture repositories.",
        "fakes": []
      },
      "reason": "This one check causes T1's trigger and inspects its stated outcome.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "The trigger and outcome are exercised at the real boundary for T1."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/task-open-close",
      "spec": {
        "locators": [
          "crates/cadence/src/task/mod.rs",
          "crates/cadence/src/task/model.rs",
          "crates/cadence/src/task_service.rs"
        ],
        "substance": "Typed task-open/task-close operations and an explicit inline/planned task record kind, with a treeless in-memory episode, protected-branch/risk dispositions and no phase-zero/store creation."
      },
      "reason": "Typed task-open/task-close operations and an explicit inline/planned task record kind, with a treeless in-memory episode, protected-branch/risk dispositions and no phase-zero/store creation.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "This artifact is required for T1's stated outcome."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/task-executor-contract",
      "spec": {
        "locators": [
          "crates/cadence/src/execution/instructions.rs",
          "crates/cadence/src/task/instructions.rs"
        ],
        "substance": "The task executor contract is rendered from the phase executor's compiled role source with the phase lease disabled and protected-branch/risk rules retained."
      },
      "reason": "The task executor contract is rendered from the phase executor's compiled role source with the phase lease disabled and protected-branch/risk rules retained.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "This artifact is required for T1's stated outcome."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/task-frontdoor",
      "spec": {
        "locators": [
          "crates/cadence/src/main.rs",
          "crates/cadence/src/execution/render.rs",
          "skills/cad-task/SKILL.md",
          "crates/cadence/tests/mcp.rs",
          "crates/cadence/src/guard/tests.rs",
          "crates/cadence/tests/help_reference.rs"
        ],
        "substance": "cadence task-instructions emits the help-described cad-task front door; it is rendered file 24, with direct-tool, guard, help and byte-budget pins updated."
      },
      "reason": "cadence task-instructions emits the help-described cad-task front door; it is rendered file 24, with direct-tool, guard, help and byte-budget pins updated.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "This artifact is required for T1's stated outcome."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Deliver the treeless task boundary and its check

- **ID:** P17-1-T1
- **Files:** crates/cadence/src/task/mod.rs, crates/cadence/src/task/model.rs, crates/cadence/src/task_service.rs, crates/cadence/src/lib.rs, crates/cadence/src/server.rs, crates/cadence/src/recall/mod.rs, crates/cadence/src/rail/risk.rs, crates/cadence/src/rail/receipts.rs, crates/cadence/src/rail_service.rs, crates/cadence/tests/task_record.rs, crates/cadence/tests/support/task_fixtures.rs, crates/cadence/tests/support/serve.rs, crates/cadence/tests/mcp.rs
- **Action:** Create task/model.rs and task_service.rs following the typed debug/spike operation and namespace shape. Add task-open and task-close to the native apply routing and operation schemas. Identity carries slug, inline/planned mode, start commit and a per-run token; the resident retains the treeless episode in memory. Define the task record type now for plan 2, without adding a persisted phase-zero event. Resolve whether .planning is absent at this boundary before any first_touch; classify unrelated missing files by their actual path. Read actual commits/files and shared risk policy, use per-run TempDir material for a matched risk and drop it before answering; never persist global config or create .planning or tasks. A protected starting branch requires the existing branch-policy disposition, not a bypass; a caller switches to its authorized working branch before making its fixture commit. Done includes risk and record=unrecorded; blocking risk cannot be called done. Implement the sole T1 check red then green over real stdio, including a missing-file request and the blocked copy. Use caller-supplied per-run risk answers for treeless scope instead of persisting them. In this green commit measure tools/list through the existing mcp test and set both byte ceilings to that measurement + 64, not an invented estimate. Reuse the existing pause::branch::observe and pause::git::run path for the task's protected-branch observation, so the shared branch policy is exercised through task-open without inventing a public pause operation.
- **Verify:**
  - cargo nextest run -p cadence --test task_record task_treeless_done_reports_unrecorded
  - cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions

### Task 2: Render cad-task from the executor source and move the pins

- **ID:** P17-1-T2
- **Files:** crates/cadence/src/execution/instructions.rs, crates/cadence/src/task/instructions.rs, crates/cadence/src/execution/render.rs, crates/cadence/src/main.rs, crates/cadence/src/help/table.rs, crates/cadence/src/guard/tests.rs, crates/cadence/tests/mcp.rs, crates/cadence/tests/help_reference.rs, skills/cad-task/SKILL.md, cadence-core/bin/weight-budgets.json, cadence-core/bin/lib/census-registry.mjs
- **Action:** Parameterize the existing compiled executor role/protocol composition with explicit task scope and phase lease disabled; do not copy the phase contract into another string. Add task/instructions.rs as the small frontdoor composition and cadence task-instructions in main.rs. The compiled help table supplies description frontmatter. Regenerate skills/cad-task/SKILL.md with cadence_apply, cadence_query, Write, Edit, Bash, AskUserQuestion and Task; state inline execution and optional --plan subagent behavior. Add its RENDERED_PROJECT_FILES row. Set both length pins to 24, extend the per-skill tool/patch permissions assertion, and update help_reference's rendered-users and difference set. Refresh only the changed skill byte budget and relevant census descriptions. This main.rs edit is the command arm; later shutdown and renderer-registry edits have separate sequential leases.
- **Verify:**
  - cargo nextest run -p cadence --test task_record task_treeless_done_reports_unrecorded
  - cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions
  - cargo nextest run -p cadence --test help_reference help_lists_the_installed_skills_from_the_compiled_table

## Notes

D-209 and D-216. The task has inline/planned identity, never phase 0. Preserve protected-branch and risk policy; disable only the phase lease. Retain Task in allowed-tools because the frozen --plan arm and D-118 permit one executor dispatch; inline work remains in the caller. No frozen task deletion until plan 2 replaces the rooted arm. The rendered-file pin moves 23 -> 24 here, help's rendered user count 20 -> 21, and the seven unrendered user skills become six. Only this plan adds wire operation names (task-open, task-close): both existing 6245-byte tools/list ceilings become measured post-change tools_bytes + 64 bytes, once in its operations green commit; the future measured integer cannot honestly be given before execution. No other plan raises that ceiling unless an actual new operation is separately authorized. Leases shared with later plans are sequential edits, not concurrent dispatches. The existing pause coordinator has no public MCP operation at HEAD; task-open reuses its production branch/git observation path, which is how plan 6 drives that caller through real serve.
