---
phase: 16
plan: 7
requirements: ["T7"]
files: ["crates/cadence/src/help/mod.rs","crates/cadence/src/help/table.rs","crates/cadence/src/help/instructions.rs","crates/cadence/src/lib.rs","crates/cadence/src/server.rs","crates/cadence/src/main.rs","crates/cadence/src/execution/render.rs","crates/cadence/src/guard/tests.rs","crates/cadence/tests/mcp.rs","crates/cadence/tests/help_reference.rs","crates/cadence/tests/support/support_records.rs","crates/cadence/src/undo/instructions.rs","crates/cadence/src/landing/instructions.rs","crates/cadence/src/milestone/instructions.rs","crates/cadence/src/why/instructions.rs","crates/cadence/src/suggest/instructions.rs","crates/cadence/src/capture/instructions.rs","crates/cadence/src/progress/instructions.rs","crates/cadence/src/verification/instructions.rs","crates/cadence/src/review/instructions.rs","crates/cadence/src/context/instructions.rs","crates/cadence/src/plan/instructions.rs","crates/cadence/src/execution/instructions.rs","crates/cadence/src/debug/instructions.rs","crates/cadence/src/spike/instructions.rs","skills/cad-adopt/SKILL.md","skills/cad-audit/SKILL.md","skills/cad-capture/SKILL.md","skills/cad-config/SKILL.md","skills/cad-context/SKILL.md","skills/cad-coverage/SKILL.md","skills/cad-debug/SKILL.md","skills/cad-decision-review/SKILL.md","skills/cad-docs-verify/SKILL.md","skills/cad-execute/SKILL.md","skills/cad-help/SKILL.md","skills/cad-land/SKILL.md","skills/cad-milestone/SKILL.md","skills/cad-minimalism-review/SKILL.md","skills/cad-new-project/SKILL.md","skills/cad-pause/SKILL.md","skills/cad-phase/SKILL.md","skills/cad-plan/SKILL.md","skills/cad-plan-review/SKILL.md","skills/cad-progress/SKILL.md","skills/cad-review/SKILL.md","skills/cad-spike/SKILL.md","skills/cad-suggest/SKILL.md","skills/cad-task/SKILL.md","skills/cad-undo/SKILL.md","skills/cad-verify/SKILL.md","skills/cad-why/SKILL.md","cadence-core/references/COMMANDS.md","cadence-core/bin/include-consumers.test.mjs","cadence-core/bin/lib/include-consumers.mjs","README.md","cadence-core/bin/weight-budgets.json","cadence-core/bin/helper-census.test.mjs","cadence-core/bin/lib/census-registry.mjs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P16-7-T1","verify":["cargo nextest run -p cadence --test help_reference help_lists_the_installed_skills_from_the_compiled_table","cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions"]},{"id":"P16-7-T2","verify":["node --test cadence-core/bin/include-consumers.test.mjs","node --test cadence-core/bin/helper-census.test.mjs","cargo nextest run -p cadence --test help_reference help_lists_the_installed_skills_from_the_compiled_table"]}]}
---
## Goal

Answer help from one compiled command table and use that table for descriptions of skills shipped under skills/.

## Must be true when done

- T7. When help is asked, the owner sees every user-invocable skill the binary installs, by cluster, with its compiled description; a name answering that one skill; no match listing the closest names; a skill absent at HEAD never listed.

## Context

Depends on plan 6; rendered-files pin starts at 22. HEAD has 35 skills and eight explicitly user-invocable:false contract/delivery skills, leaving 27 user commands. The old table at cadence-core/references/COMMANDS.md:12 lists removed cad-report and cad-health and lacks cad-review, while shipped skills/cad-review/SKILL.md:3 already describes the native merged review. The current compiled registry starts at crates/cadence/src/execution/render.rs:119; its size is pinned at crates/cadence/tests/mcp.rs:1562 and crates/cadence/src/guard/tests.rs:90. The frozen help include test is cadence-core/bin/include-consumers.test.mjs:112 and README.md:53 links the obsolete table. Description literals currently live in each instructions renderer, for example crates/cadence/src/undo/instructions.rs:5 and crates/cadence/src/review/instructions.rs:74.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P16-T7-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test help_reference help_lists_the_installed_skills_from_the_compiled_table",
        "expected": {
          "kind": "literal",
          "value": "Exactly the 27 handwritten user command names shipped under skills/ at HEAD (35 SKILL.md files minus eight user-invocable: false) occur once, grouped under the four named clusters; cad-review is present and cad-report/cad-health are absent. This shipped inventory differs from the 20-entry RENDERED_PROJECT_FILES inventory at HEAD (17 user-invocable), whose D-208 progression remains 20 -> 21 -> 22 -> 23. debug, cad-debug and /cad-debug return the same single row. healt yields no exact row and a stable closest-name list including cad-help. Every returned description equals the description of the skill shipped under skills/ and the compiled renderer's description where that renderer exists; literal descriptions for the new debug/spike/help rows are independently asserted. COMMANDS.md is absent and help answers without any project reference file."
        },
        "test": {
          "file": "crates/cadence/tests/help_reference.rs",
          "function": "help_lists_the_installed_skills_from_the_compiled_table"
        },
        "setup": "Compose tests/support/phase13.rs Client::open at crates/cadence/tests/support/phase13.rs:22, fixture at crates/cadence/tests/support/phase13.rs:117, git at crates/cadence/tests/support/phase13.rs:361, git_value at crates/cadence/tests/support/phase13.rs:470 and reopened at crates/cadence/tests/support/phase13.rs:224 in new subject-named tests/support/support_records.rs. Borrow tracked document snapshots from crates/cadence/tests/support/phase14.rs:225 and real risk input jwt.verify(token) from crates/cadence/tests/support/phase15.rs:159, without calling its committed-material helper for a staged case. Create records only through public operations. Implement a guard probe launching CARGO_BIN_EXE_cadence guard with the real PreToolUse event shape at crates/cadence/src/guard/tests.rs:60; that existing helper uses a test-process child, so do not claim it already launches the integration binary. Use handwritten expected names and cluster membership: Build spine={new-project,adopt,context,plan,execute,verify,progress,task}; Review & quality gates={review,plan-review,decision-review,minimalism-review,debug,coverage,docs-verify,audit}; Lifecycle & git={land,milestone,phase,undo}; Support={capture,config,help,pause,spike,suggest,why}. Pin the literal count 27 independently of the implementation table. Inspect the SKILL.md front matter shipped under skills/ as the shipped inventory, explicitly excluding the eight user-invocable:false skills; use the real binary instruction commands to check rendered fronts, not a second table reconstructed from help output.",
        "call": "Call real stdio help with no name, debug, cad-debug, /cad-debug and healt. Compare every returned name, cluster and description against handwritten expected membership/count and front matter shipped under skills/; compare each binary-rendered front door's full bytes to the installed bytes. Check that cad-report/cad-health and the eight internal skills never appear. Verify the source-tree COMMANDS.md is absent. Run from a separate fixture root lacking a command reference so help cannot accidentally read project prose.",
        "boundary": "Real cadence serve child over MCP stdio, actual filesystem, Store journal and Git where used; cadence guard is a separate real binary process. No fake record, admission, review-return, risk-consequence or Git resolver.",
        "fakes": [
          "Caller inputs, fixed clock/Git dates and a temporary real fixture repository"
        ]
      },
      "reason": "Changing the trigger-to-record/readback behavior described here must fail this truth's single check.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "Changing the trigger-to-record/readback behavior described here must fail this truth's single check."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P16-T7-A1",
      "spec": {
        "locators": [
          "crates/cadence/src/help/table.rs",
          "crates/cadence/src/help/mod.rs",
          "crates/cadence/src/server.rs"
        ],
        "substance": "Compiled name/cluster/description table for exactly 27 user-invocable skills shipped under skills/; pure help query lists clusters, normalizes slash/cad- prefixes and returns closest names for no match. No runtime COMMANDS.md read, no invented absent commands."
      },
      "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T7.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T7."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P16-T7-A2",
      "spec": {
        "locators": [
          "crates/cadence/src/help/instructions.rs",
          "crates/cadence/src/main.rs",
          "crates/cadence/src/execution/render.rs",
          "skills/cad-help/SKILL.md",
          "crates/cadence/tests/mcp.rs",
          "crates/cadence/src/guard/tests.rs"
        ],
        "substance": "cadence help-instructions, compiled cad-help front door with cadence_query alone, one-source description front matter, installed-equals-renderer pin and rendered-files count 23."
      },
      "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T7.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T7."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P16-T7-A3",
      "spec": {
        "locators": [
          "crates/cadence/src/help/table.rs",
          "skills/cad-debug/SKILL.md",
          "skills/cad-spike/SKILL.md",
          "skills/cad-help/SKILL.md"
        ],
        "substance": "All 27 user-skill descriptions sourced from the compiled table. Existing compiled front doors use its description accessor; the seven authored bodies keep their behavior while their description front matter is generated from the same rows. COMMANDS.md and its include-dependent test are removed."
      },
      "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T7.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T7."
        }
      ]
    },
    {
      "kind": "link",
      "id": "P16-T7-L1",
      "spec": {
        "caller": "crates/cadence/src/help/table.rs",
        "callee": "help query response",
        "value": "compiled description"
      },
      "reason": "The truth explicitly names this value crossing the boundary; losing or substituting it breaks that outcome.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "The truth explicitly names this value crossing the boundary; losing or substituting it breaks that outcome."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Deliver compiled help, shared descriptions and the one red-then-green check

- **ID:** P16-7-T1
- **Files:** crates/cadence/src/help/mod.rs, crates/cadence/src/help/table.rs, crates/cadence/src/help/instructions.rs, crates/cadence/src/lib.rs, crates/cadence/src/server.rs, crates/cadence/src/main.rs, crates/cadence/src/execution/render.rs, crates/cadence/src/guard/tests.rs, crates/cadence/tests/mcp.rs, crates/cadence/tests/help_reference.rs, crates/cadence/tests/support/support_records.rs, crates/cadence/src/undo/instructions.rs, crates/cadence/src/landing/instructions.rs, crates/cadence/src/milestone/instructions.rs, crates/cadence/src/why/instructions.rs, crates/cadence/src/suggest/instructions.rs, crates/cadence/src/capture/instructions.rs, crates/cadence/src/progress/instructions.rs, crates/cadence/src/verification/instructions.rs, crates/cadence/src/review/instructions.rs, crates/cadence/src/context/instructions.rs, crates/cadence/src/plan/instructions.rs, crates/cadence/src/execution/instructions.rs, crates/cadence/src/debug/instructions.rs, crates/cadence/src/spike/instructions.rs, skills/cad-adopt/SKILL.md, skills/cad-audit/SKILL.md, skills/cad-capture/SKILL.md, skills/cad-config/SKILL.md, skills/cad-context/SKILL.md, skills/cad-coverage/SKILL.md, skills/cad-debug/SKILL.md, skills/cad-decision-review/SKILL.md, skills/cad-docs-verify/SKILL.md, skills/cad-execute/SKILL.md, skills/cad-help/SKILL.md, skills/cad-land/SKILL.md, skills/cad-milestone/SKILL.md, skills/cad-minimalism-review/SKILL.md, skills/cad-new-project/SKILL.md, skills/cad-pause/SKILL.md, skills/cad-phase/SKILL.md, skills/cad-plan/SKILL.md, skills/cad-plan-review/SKILL.md, skills/cad-progress/SKILL.md, skills/cad-review/SKILL.md, skills/cad-spike/SKILL.md, skills/cad-suggest/SKILL.md, skills/cad-task/SKILL.md, skills/cad-undo/SKILL.md, skills/cad-verify/SKILL.md, skills/cad-why/SKILL.md, cadence-core/references/COMMANDS.md, cadence-core/bin/include-consumers.test.mjs, cadence-core/bin/lib/include-consumers.mjs
- **Action:** Deliver the single check red first, then green. Compile the 27 name/cluster/description rows with exactly the membership in the check. Use the current descriptions shipped under skills/ as the starting text for unaffected skills, preserving their present behavior; define these new literal descriptions: debug='Resume a recorded debug session, review its staged fix, and offer a configured consult at dead ends.'; spike='Record risk-ordered spike criteria before experimenting, then retain observations and a bounded verdict.'; help='List Cadence commands shipped under skills/ by cluster, or show one command and its compiled description.' Existing compiled frontdoor renderers obtain descriptions from this table instead of independent literals. Provide a frontmatter-description rendering helper driven by the table and regenerate only that field for the seven authored user bodies (adopt, config, docs-verify, new-project, pause, phase, task); keep these as authored bodies, not seven new registry entries. Add query help {name?}; normalize one optional leading slash and cad- prefix, choose a deterministic edit-distance ordering with name tie-breaks for closest names, and do not open project prose. Add cadence help-instructions and the one cad-help RENDERED_PROJECT_FILES entry. allowed-tools is cadence_query alone with its real MCP prefix; no apply/Write/Edit/Bash. Regenerate installed skill bytes, update affected body/description pins, move both registry counts 22->23 and preserve exact equality with each renderer. Delete COMMANDS.md now, after the census finds no actual skill/workflow consumer except replaced cad-help. Delete precisely its include-consumers.test.mjs case at 112–119 and update the explanatory COMMANDS example in lib/include-consumers.mjs without weakening include validation. In this task's green commit only, measure the serialized tools/list result.tools bytes using the existing mcp pin, and move both byte-bound literals (10_304 at HEAD, crates/cadence/tests/mcp.rs:305 and crates/cadence/tests/mcp.rs:1626) once to that measured value plus a small 64-byte margin. Preserve the three-tool inventory. Record the measurement in the commit; do not guess a future bound or perform GH-271's separate description cut.
- **Verify:**
  - cargo nextest run -p cadence --test help_reference help_lists_the_installed_skills_from_the_compiled_table
  - cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions

### Task 2: Finish the help reference retirement in documentation and budgets

- **ID:** P16-7-T2
- **Files:** README.md, cadence-core/bin/weight-budgets.json, cadence-core/bin/helper-census.test.mjs, cadence-core/bin/lib/census-registry.mjs
- **Action:** Replace README.md's dead COMMANDS.md link with the compiled help front door and correct its obsolete twenty-eight count to the 27 shipped under skills/. Remove the COMMANDS weight-budget row; measure/update the regenerated help/debug/spike and any changed description-only skill budgets. Reconcile affected helper census/registry rows and totals without manufacturing a new command helper. HEAD census found only the cad-help include, the removed include-dependent test, weight-budget entry and explanatory include-consumers comment under skills/ and cadence-core/, plus README's link. Keep the other include-consumer tests, shared consult/recall/review references and risk-check helper. Pin remains 23 and the tools/list bound does not move a second time.
- **Verify:**
  - node --test cadence-core/bin/include-consumers.test.mjs
  - node --test cadence-core/bin/helper-census.test.mjs
  - cargo nextest run -p cadence --test help_reference help_lists_the_installed_skills_from_the_compiled_table

## Notes

The help count is 27 user commands, not the 23 rendered project files: that registry also contains three internal contracts, while seven user skills shipped under skills/ retain authored bodies. Draw every user-skill description from the compiled table, including regenerated description front matter on those seven bodies, without expanding the static rendered-file registry beyond 23. Do not rename old phase-named tests or perform the other D-207 side jobs.

Execute plans 1 through 7 sequentially, never concurrently. Repeated file leases extend only this plan's named surface and preserve earlier work. New paths, operation shapes and test functions below are creation specifications, not claims that they exist at HEAD. content.suite and typed tasks let the binary derive execution.schema=1, execution.suite and stable task verify arrays; do not submit an execution field. The check-delivering task records its one test red before implementation and green afterwards; later tasks use narrow regressions and create no additional evidence checks. No observation items. All records, replay identities and rendered projections use the existing Store request interface and sole journal, with root binding, expected generation and idempotent request IDs. Reject changed-input replay; never add a sidecar authority. D-207 side jobs are outside these leases. Phase 17 owns further contract enforcement; phase 18 owns absence/live-host acceptance; phase 21 owns its additional-round allowance and deferred settlement. Debug/spike records are not added to recall's corpus.

Falsification finding 3 of .codex-analysis/phase16-falsification.md corrected this plan on 2026-09-20.
