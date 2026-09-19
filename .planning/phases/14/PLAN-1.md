---
phase: 14
plan: 1
requirements: ["T2"]
files: ["crates/cadence/src/progress_service.rs","crates/cadence/src/progress/mod.rs","crates/cadence/src/progress/render.rs","crates/cadence/src/progress/instructions.rs","crates/cadence/src/lib.rs","crates/cadence/src/main.rs","crates/cadence/src/server.rs","crates/cadence/src/recall/mod.rs","crates/cadence/src/next_action/select.rs","crates/cadence/src/next_action_service.rs","crates/cadence/src/derivation_service.rs","crates/cadence/tests/phase14_receipts.rs","crates/cadence/tests/support/phase14.rs","crates/cadence/tests/support/mod.rs","crates/cadence/tests/mcp.rs","skills/cad-progress/SKILL.md","skills/cad-health/SKILL.md","skills/cad-report/SKILL.md"]
directories: ["crates/cadence/src/progress","crates/cadence/src/next_action"]
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P14-1-T1","verify":["cargo nextest run -p cadence --test phase14_receipts phase14_progress_reports_status_issues_and_one_next_action"]},{"id":"P14-1-T2","verify":["cargo nextest run -p cadence --test phase14_receipts phase14_progress_reports_status_issues_and_one_next_action","cargo nextest run -p cadence --test mcp"]}]}
---
## Goal

One `progress` answer from the binary: every phase's derived status, the located issues, the current phase's record block, the capture count and the one next action; cad-health and cad-report folded in (D-138). This plan also fixes the progress text grammar that plans 2, 3 and 4 write lines against.

## Must be true when done

- T2. When the owner asks for progress, the owner sees every phase's derived status, the located issues and the one next action.

## Context

D-138 at the phase 14 context. Lifecycle, next action, capture bound, deferred queue and the declared-completion label are all derived today (derivation_service::query in crates/cadence/src/derivation_service.rs, next_action_service::query in crates/cadence/src/next_action_service.rs, the nine compiled rules in crates/cadence/src/next_action/select.rs with Pause first, the adoption overlay in crates/cadence/src/derivation/mod.rs, the retired cursor in crates/cadence/src/derivation/intake.rs) but none is a stdio query operation: the QueryArguments enum in crates/cadence/src/server.rs has no progress arm. A roadmap StateConflict (crates/cadence/src/derivation/model.rs, fields source, field, declared, derived) refuses the checked lifecycle query today; progress must report it as a located issue and never repair a document (phase 13 R8). The compiled front doors follow one pattern: a `<module>/instructions.rs` renders the skill, a Command arm in crates/cadence/src/main.rs prints it (ContextInstructions, PlanInstructions, ExecutorInstructions are the models), and crates/cadence/tests/mcp.rs pins the skill files against the rendered text (skill_contract_matches_wire_patch_and_direct_tool_permissions, skills_and_agents_grant_no_direct_project_reads). Every check of this phase runs the real env!(CARGO_BIN_EXE_cadence) serve binary over stdio: native fixtures through Client and ProcessFixture in crates/cadence/tests/support/phase31.rs, legacy-shaped fixtures through Client, Completed::new, Completed::published, Completed::execute and reopened in crates/cadence/tests/support/phase13.rs; files, the store journal, git commits and child processes stay real; only the caller's inputs and the test's own clock window are controlled; every expected value is handwritten; durability is asserted by a fresh Client after restart and by reopened. Test file crates/cadence/tests/phase14_receipts.rs, one function per truth; fixture builders in crates/cadence/tests/support/phase14.rs. Never the live tree. No observation items (owner's ruling: phase 18 holds every live-host observation).

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P14-T2-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase14_receipts phase14_progress_reports_status_issues_and_one_next_action",
        "expected": {
          "kind": "literal",
          "value": "First answer `text` lines in order: `# progress: <dir>, phase 5 of 3: Legacy`; `phase 5: Legacy - planned - plans 1`; `phase 13: Plan publication - executed`; `phase 28: Next phase - unplanned`; `Issues: 0`; `Record (phase 5): 0 routing decisions, 0 refusals, 0 gate fires`; `Captures: 0 active of 40`; `Next: /cad-execute 5`. Second answer, after the tick: the same rows, then `Issues: 1` and `  ROADMAP.md:2 entry 0 declares phase 5 complete; derived planned`, and `Next: Resolve ROADMAP.md:2 entry 0: declare phase 5 with adoption-declare or untick it`. Third answer, after restart, equals the second byte for byte. Exactly one `Next:` line per answer. The answer carries no `body` and no document key. reopened derivation intake reports the cursor retired. Every manifested document byte is identical except the test's own tick. `cadence progress-instructions` stdout equals skills/cad-progress/SKILL.md; skills/cad-health/SKILL.md and skills/cad-report/SKILL.md are absent."
        },
        "test": {
          "file": "crates/cadence/tests/phase14_receipts.rs",
          "function": "phase14_progress_reports_status_issues_and_one_next_action"
        },
        "setup": "Completed::new() from crates/cadence/tests/support/phase13.rs; insert `- [ ] **Phase 5: Legacy**` above the phase 13 row of ROADMAP.md; write phases/5/PLAN-1.md as a valid legacy body and deferred/5/DEFERRED-diff-1.json with one finding; manifest every .planning document byte.",
        "call": "progress; tick the phase 5 row on disk; progress; restart the client; progress; reopened.",
        "boundary": "real serve binary over stdio, real derivation, real journal",
        "fakes": [
          "the caller's inputs",
          "the test's own clock window read around each call"
        ]
      },
      "reason": "Stale rows, a hidden or repaired conflict, a document on the wire, or more or fewer than one next action would break what the owner sees.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "The owner asks for progress and sees every phase's derived status, the located issue and the one next action: the trigger and outcome of T2 word for word."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T2-A1",
      "spec": {
        "locators": [
          "crates/cadence/src/progress_service.rs",
          "crates/cadence/src/progress/render.rs",
          "crates/cadence/src/next_action/select.rs Rule::Conflict"
        ],
        "substance": "The stdio progress query: checked lifecycle rows, issue lines naming path, line, zero-based entry and phase id, the record and capture blocks, one next action; no document write and no document on the wire."
      },
      "reason": "Without it the owner has no status, no located issue and no single next action.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "It is the operation that produces the status, the issues and the next action T2 names."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T2-A2",
      "spec": {
        "locators": [
          "crates/cadence/src/progress/instructions.rs",
          "skills/cad-progress/SKILL.md",
          "skills/cad-health (absent)",
          "skills/cad-report (absent)"
        ],
        "substance": "The compiled, query-only cad-progress front door; cad-health and cad-report deleted per D-138."
      },
      "reason": "A surviving alias or a door that shells out to planning.mjs would show sub-views or stale counts instead of the one answer.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "The front door is how the owner asks for progress; it must call the one query and print its text."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Serve progress over stdio and render one answer

- **ID:** P14-1-T1
- **Files:** crates/cadence/src/progress_service.rs, crates/cadence/src/progress/mod.rs, crates/cadence/src/progress/render.rs, crates/cadence/src/lib.rs, crates/cadence/src/server.rs, crates/cadence/src/recall/mod.rs, crates/cadence/src/next_action/select.rs, crates/cadence/src/next_action_service.rs, crates/cadence/src/derivation_service.rs, crates/cadence/tests/phase14_receipts.rs, crates/cadence/tests/support/phase14.rs, crates/cadence/tests/support/mod.rs
- **Action:** Deliver P14-T2-C and P14-T2-A1. Add {operation: progress} to the query surface, routed through the resident loop to progress_service::query: the checked lifecycle query (memo published, cursor retired as today), next_action_service::query, the session capture report and the current phase's decision records, rendered in the grammar in this plan's notes. A StateConflict must not refuse progress: keep the rows and emit the issue line from its fields and the phase id; every other DerivationError still refuses. Add a tenth compiled rule ahead of Pause in crates/cadence/src/next_action/select.rs: Conflict selects Action::Resolve {phase, source} for the lowest conflicting phase, rendered `Resolve ROADMAP.md:<line> entry <entry>: declare phase <id> with adoption-declare or untick it`. The answer carries no document; it is a rendered slice bounded like a document part.
- **Verify:**
  - cargo nextest run -p cadence --test phase14_receipts phase14_progress_reports_status_issues_and_one_next_action

### Task 2: Compile the cad-progress front door; retire cad-health and cad-report

- **ID:** P14-1-T2
- **Files:** crates/cadence/src/progress/instructions.rs, crates/cadence/src/main.rs, crates/cadence/tests/mcp.rs, skills/cad-progress/SKILL.md, skills/cad-health/SKILL.md, skills/cad-report/SKILL.md
- **Action:** Deliver P14-T2-A2. Add `cadence progress-instructions` as a Command arm rendering progress::instructions::markdown(); regenerate skills/cad-progress/SKILL.md from it: query-only tools (mcp__cadence__cadence_query only, no Write, no Bash, no SlashCommand, no CLAUDE_PLUGIN_ROOT, no --stats or --trace), one progress call, print `text`. Delete skills/cad-health/ and skills/cad-report/ (D-138). Extend the skill pin in crates/cadence/tests/mcp.rs so the rendered text and the two absences are asserted there as well as in the T2 check.
- **Verify:**
  - cargo nextest run -p cadence --test phase14_receipts phase14_progress_reports_status_issues_and_one_next_action
  - cargo nextest run -p cadence --test mcp

## Notes

Progress text grammar, fixed here; plans 2, 3 and 4 write their expected lines against it by hand. The `progress` answer is {status: ok, text: <rendered>, phases: [..], issues: [..], record: {..}, dispatch: <null or {..}>, captures: {..}, next: {..}}. `text` is: line 1 `# progress: <project dir name>, phase <current> of <total>: <name>`; one line per declared phase `phase <id>: <name> - <status>[ (<provenance word>, unverified)][ - UAT <p> pass, <f> fail[, <s> skipped]][ - plans <n>]`; `Issues: <count>` then one indented line per issue `  ROADMAP.md:<line> entry <entry> declares phase <id> complete; derived <status>`; `Record (phase <current>): <r> routing decisions, <f> refusals, <g> gate fires` then one indented line per refusal `  refused <code> at <located summary>, <at>`; `Dispatch: dispatch <id> interrupted, no return; <k> generations since issue` only while an issued dispatch has been reported exited without completing its plan (plan 4); `Captures: <active> active of <bound>[, over bound]`; `Next: <instruction>`, exactly one compiled-rule instruction. `<status>` is the LifecycleStatus word from crates/cadence/src/derivation/model.rs; a declared completion renders `complete (declared at import, unverified)` or `complete (declared at adoption, unverified)` with the on-disk UAT counts; a native completion renders `complete` or `complete-with-waivers` with `met <m>, waived <w>`; a legacy completion renders `complete` with its UAT counts. Refusal lines list located fields as `key=value` in field order with `<at>` in integer seconds (plan 3). Execution rules for every plan of this phase: plans run in order 1 to 6; shared paths are sequential leases; new paths are creation locations; test names not in the tree are creation specifications; implement new Rust names from the actual code, never from these plans' prose. For each task delivering a check the executor commits the test first with subject `test(14): <function> red <task id>`, then the implementation with `feat(14): <summary> green <task id>`, and inspects why red failed. Verify commands are narrow; the orchestrator runs the suite once at plan close, then `cargo clippy --workspace --all-targets -- -D warnings`. The 3.x JavaScript under cadence-core/ and the 3.x skill prose are frozen reference material, read only where a task names them. Planner decision: no paused override in the T2 fixture, because a pause override is written only by a test-only resident request with no stdio operation at HEAD; the deferred member is a real deferred/<phase>/DEFERRED-<trigger>-<disc>.json file.
