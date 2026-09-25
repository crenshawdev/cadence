---
phase: 15
plan: 6
requirements: ["T6"]
files: ["crates/cadence/src/undo/mod.rs","crates/cadence/src/undo/model.rs","crates/cadence/src/undo/manifest.rs","crates/cadence/src/undo/revert.rs","crates/cadence/src/undo_service.rs","crates/cadence/src/lib.rs","crates/cadence/src/server.rs","crates/cadence/src/recall/mod.rs","crates/cadence/src/execution/model.rs","crates/cadence/src/execution/history.rs","crates/cadence/src/execution/receipts.rs","crates/cadence/src/execution_service.rs","crates/cadence/src/execution/patch.rs","crates/cadence/src/execution/render.rs","crates/cadence/src/store/writer.rs","crates/cadence/src/store/transaction.rs","crates/cadence/src/store/filesystem.rs","crates/cadence/src/rail/commit.rs","crates/cadence/src/rail/git.rs","crates/cadence/src/derivation/mod.rs","crates/cadence/src/derivation_service.rs","crates/cadence/src/verification/completion.rs","crates/cadence/src/next_action/select.rs","crates/cadence/src/next_action_service.rs","crates/cadence/tests/phase7_lease.rs","crates/cadence/tests/phase15_landing.rs","crates/cadence/tests/support/phase15.rs","crates/cadence/src/undo/instructions.rs","crates/cadence/src/main.rs","crates/cadence/tests/mcp.rs","skills/cad-undo/SKILL.md","cadence-core/bin/weight-budgets.json","cadence-core/workflows/undo.md","cadence-core/bin/prose-agreement.test.mjs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P15-6-T1","verify":["cargo nextest run -p cadence --test phase15_landing phase15_undo_reverts_exact_hashes_and_marks_the_record"]},{"id":"P15-6-T2","verify":["cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions"]},{"id":"P15-6-T3","verify":["cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions"]}]}
---
## Goal

Undo only the recorded exact hashes in reverse order, retain conflict progress, and make committed native execution derive planned again.

## Must be true when done

- T6. When the owner undoes a phase, the owner sees the manifest's commits, from the execution record else the SUMMARY, reverted by exact hash in reverse order by the binary; in committed mode the phase derived planned again with the execution record marked undone; in --no-commit mode nothing reset; a conflict stopping it with the reverted set recorded.

## Context

D-198. SourceMaterial holds completion/evidence hashes in crates/cadence/src/execution/receipts.rs:241; native close history and its rendered SUMMARY are distinct from guessing a git-log subject. crates/cadence/src/execution/model.rs:225 defines ExecutionOccurrence and currently has no undone marker. crates/cadence/src/derivation/mod.rs:76 reconstructs lifecycle from native history and verification completion, so changing only markdown cannot undo it. crates/cadence/src/verification/completion.rs:99 currently compares retained authority for applicability; the undo marker must suppress that old completion explicitly. Reuse the phase13 public execution sequence at crates/cadence/tests/support/phase13.rs:715 and phase14 native verification fixture (natively_completed), adapting to four task completions rather than asserting the existing two-task fixture already contains three task commits plus a docs commit.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P15-T6-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase15_landing phase15_undo_reverts_exact_hashes_and_marks_the_record",
        "expected": {
          "kind": "literal",
          "value": "Native committed: exactly four revert commits, chronological subjects naming the four original full hashes in [docs, third, second, first] order; no log-guessed extra commits. The execution occurrence has an undone marker bound to this undo/manifest; progress derives planned despite retained completion evidence, and STATE identifies that planned phase with a next action consistent with the binary's selector, preserved after restart. Staged: HEAD/log unchanged, real index contains the reverse reverts, original execution marker/lifecycle/cursor and authored phase documents unchanged. Conflict: only the first reverse hash is recorded completed, the second is named with real conflict paths, later two never run, no undone marker or phase reset. Legacy: exactly the SUMMARY manifest's full hashes are used in reverse order, with provenance SUMMARY and no invented native completion."
        },
        "test": {
          "file": "crates/cadence/tests/phase15_landing.rs",
          "function": "phase15_undo_reverts_exact_hashes_and_marks_the_record"
        },
        "setup": "Use the actual Client::open stdio launch at crates/cadence/tests/support/phase13.rs:22; compare authored document bytes with crates/cadence/tests/support/phase14.rs:225 where required. Adapt phase13 Client/Completed's real publication/admission/authorize/dispatch/run/task-close flow at support/phase13.rs:715 into support/phase15.rs: three implementation task completions plus a fourth docs-task completion, all actual distinct commits and public close records, then real verification completion following support/phase14.rs natively_completed. Preserve four expected full hashes from fixture git rev-parse, handwritten expected order [docs, third, second, first], and make SUMMARY disagree so it cannot be the native source. Build fresh independent copies for staged and conflict cases; in the conflict fixture an unrelated later edit makes the second exact reverse revert conflict while the first succeeds. Build a separate legacy fixture with no native execution and a literal SUMMARY manifest of known real hashes.",
        "call": "undo-read then undo-phase committed; inspect Git log/trace, execution record, progress and STATE, restart/read again. Repeat with --no-commit on the independent clean fixture. Run committed undo on the conflict fixture and inspect real unmerged entries and stored completed set. Run undo from the legacy SUMMARY manifest and inspect actual revert argv.",
        "boundary": "Real cadence serve over stdio; actual store journal, filesystem, Git child processes and local bare repository; forge effects, when present, cross an executable on PATH.",
        "fakes": [
          "Caller inputs and fixed clock/Git date inputs",
          "Caller-authored commits, SUMMARY and real conflicting file contents",
          "Fixed Git dates/clock window"
        ]
      },
      "reason": "Causes the trigger of approved T6 version 1 and observes its stated outcome; this is its only check.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "Causes the trigger of approved T6 version 1 and observes its stated outcome; this is its only check."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P15-T6-A1",
      "spec": {
        "locators": [
          "crates/cadence/src/undo/manifest.rs",
          "crates/cadence/src/undo/model.rs",
          "crates/cadence/src/execution/history.rs"
        ],
        "substance": "Immutable exact-hash manifest from native accepted task completions, else explicit SUMMARY manifest only; durable source provenance and order."
      },
      "reason": "This artifact implements the owner-visible T6 outcome, including the named durable boundary.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "This artifact implements the owner-visible T6 outcome, including the named durable boundary."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P15-T6-A2",
      "spec": {
        "locators": [
          "crates/cadence/src/undo/revert.rs",
          "crates/cadence/src/undo_service.rs",
          "crates/cadence/src/rail/commit.rs"
        ],
        "substance": "Binary-owned reverse-order Git writer, committed and --no-commit modes, exact per-hash progress receipts and conflict stop retaining the completed set without forced continuation."
      },
      "reason": "This artifact implements the owner-visible T6 outcome, including the named durable boundary.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "This artifact implements the owner-visible T6 outcome, including the named durable boundary."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P15-T6-A3",
      "spec": {
        "locators": [
          "crates/cadence/src/execution/model.rs",
          "crates/cadence/src/store/transaction.rs",
          "crates/cadence/src/derivation/mod.rs",
          "crates/cadence/src/verification/completion.rs",
          "crates/cadence/src/next_action_service.rs"
        ],
        "substance": "Journaled execution undone marker and matching native lifecycle/verification suppression so committed undo derives planned; binary cursor/projection repair. Staged/conflicted runs leave completion and cursor unchanged."
      },
      "reason": "This artifact implements the owner-visible T6 outcome, including the named durable boundary.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "This artifact implements the owner-visible T6 outcome, including the named durable boundary."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P15-T6-A4",
      "spec": {
        "locators": [
          "crates/cadence/src/undo/instructions.rs",
          "crates/cadence/src/main.rs",
          "skills/cad-undo/SKILL.md",
          "crates/cadence/tests/mcp.rs"
        ],
        "substance": "Compiled cadence undo-instructions front door with exact rendered skill pin and manifest/mode/conflict presentation."
      },
      "reason": "This artifact implements the owner-visible T6 outcome, including the named durable boundary.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "This artifact implements the owner-visible T6 outcome, including the named durable boundary."
        }
      ]
    },
    {
      "kind": "link",
      "id": "P15-T6-L1",
      "spec": {
        "caller": "crates/cadence/src/undo/manifest.rs",
        "callee": "crates/cadence/src/undo/revert.rs",
        "value": "exact hash"
      },
      "reason": "T6 explicitly names the exact hash crossing from the recorded manifest into the binary's revert; the writer must consume that selected value without log inference.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "T6 explicitly names the exact hash crossing from the recorded manifest into the binary's revert; the writer must consume that selected value without log inference."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Deliver exact-hash undo, conflict progress and native lifecycle repair

- **ID:** P15-6-T1
- **Files:** crates/cadence/src/undo/mod.rs, crates/cadence/src/undo/model.rs, crates/cadence/src/undo/manifest.rs, crates/cadence/src/undo/revert.rs, crates/cadence/src/undo_service.rs, crates/cadence/src/lib.rs, crates/cadence/src/server.rs, crates/cadence/src/recall/mod.rs, crates/cadence/src/execution/model.rs, crates/cadence/src/execution/history.rs, crates/cadence/src/execution/receipts.rs, crates/cadence/src/execution_service.rs, crates/cadence/src/execution/patch.rs, crates/cadence/src/execution/render.rs, crates/cadence/src/store/writer.rs, crates/cadence/src/store/transaction.rs, crates/cadence/src/store/filesystem.rs, crates/cadence/src/rail/commit.rs, crates/cadence/src/rail/git.rs, crates/cadence/src/derivation/mod.rs, crates/cadence/src/derivation_service.rs, crates/cadence/src/verification/completion.rs, crates/cadence/src/next_action/select.rs, crates/cadence/src/next_action_service.rs, crates/cadence/tests/phase7_lease.rs, crates/cadence/tests/phase15_landing.rs, crates/cadence/tests/support/phase15.rs
- **Action:** Deliver P15-T6-C, A1/A2/A3 and L1 red then green. Expose undo-read and undo-phase with integer phase, request identity, exact manifest binding and committed/--no-commit mode; route through the bound resident/writer. Build an immutable native manifest from the current admitted execution's accepted task-close completion hashes (including the docs-task completion), preserving chronological order and provenance. Resolve each full commit object once, deduplicate identical hashes without changing order, and refuse absent/ambiguous/malformed or unsupported merge inputs by identity before mutation. Only when native execution is absent parse the explicit SUMMARY commit manifest; never search log subjects or widen the hash set. Persist intent then invoke real Git revert by exact full hash in reverse manifest order. For committed mode use a real per-hash revert/stage plus the binary committer so each of the four revert commit subjects names the original full hash; honor existing commit/protected-branch rails. After each success record that hash and resulting commit/index identity; on conflict preserve the real conflict state and exact completed set and stop, with no later hash, reset, abort or forced continuation. Recognize persisted successful work on retry. For --no-commit use actual staged reverts, create no commit, never mark undone or repair phase documents/cursor. For complete committed undo, atomically journal the undo receipt and an optional backward-compatible execution.occurrences[phase].undone marker bound to occurrence/manifest/undo id; initialize None in every ExecutionOccurrence constructor (execution_service, store/writer, execution/patch and phase7_lease fixture). Add a typed undo intent/validator permitted to change this exact execution marker plus its owned projections without relaxing unrelated namespace guards. In acceptance_overlay honor the marker before retained completion/adoption authority; applicable verification completion must no longer re-complete an undone execution. Keep published plans so derived state is planned, update the memo through existing derivation service and repair the phase's roadmap tick/status projections and STATE cursor mirror to the resulting lifecycle. For SUMMARY-only legacy undo retain explicit undo provenance and suppress the obsolete completed SUMMARY/UAT state while keeping its plan inputs. Do not revive retired cursor authority. Couple final document repairs to the final revert step/commit when tracked, adding no fifth bookkeeping commit. Preserve all native history and evidence. The one test includes native committed, staged, second-revert conflict and legacy fallback arms plus restart readback.
- **Verify:**
  - cargo nextest run -p cadence --test phase15_landing phase15_undo_reverts_exact_hashes_and_marks_the_record

### Task 2: Compile the undo front door and expose the recorded manifest

- **ID:** P15-6-T2
- **Files:** crates/cadence/src/undo/instructions.rs, crates/cadence/src/main.rs, crates/cadence/src/execution/render.rs, crates/cadence/tests/mcp.rs, skills/cad-undo/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** Deliver P15-T6-A4. Add cadence undo-instructions with the compiled cad-undo skill and RENDERED_PROJECT_FILES entry. Show the binary's source/provenance, exact ordered hash manifest and selected committed/--no-commit mode; pass the identified request through the binary and report the actual completed set/conflict. No shell Git, scope-message fallback, raw phase-done --undo or cursor set is delegated to the model. Pin rendered bytes, mode wording and allowed MCP tools in the existing mcp.rs skill test; update only the skill budget.
- **Verify:**
  - cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions

### Task 3: Remove the replaced undo workflow and its old prose pins

- **ID:** P15-6-T3
- **Files:** cadence-core/workflows/undo.md, cadence-core/bin/prose-agreement.test.mjs, cadence-core/bin/weight-budgets.json
- **Action:** Delete the frozen undo workflow, remove its obsolete git-log/prose-reset agreement assertions if present, and remove its budget entry. Retain shared planning helpers still called by other frozen surfaces; this phase replaces cad-undo's writer, not every remaining phase-done/cursor consumer. No absence truth is added.
- **Verify:**
  - cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions

## Notes

The native fixture explicitly closes three implementation tasks and one documentation task through execution-task-close. Their four completion hashes form the native undo manifest; the docs-task hash is not invented from a guessed log or nonexistent phase-level docs field. Evidence-only red commits are retained evidence, not extra task completion entries. Native history takes precedence even if the on-disk SUMMARY lies. SUMMARY fallback is used only when there is no native execution record, never on an unreadable/malformed native record. Committed success adds an undone marker without deleting admissions, completions, verdicts or evidence; --no-commit adds only the undo attempt/progress record and stages source reverts, leaving phase status, execution marker and cursor untouched. Phase 21's deferred semantics and execution re-dispatch policy are not expanded by this plan.

Execute plans 1 through 7 in order, never concurrently. Repeated file leases are sequential: retain earlier operations/tests and edit only this plan's named surface. New Rust paths and test functions are creation specifications, not claims about HEAD. The suite field renders execution.schema=1 and execution.suite; task ids and verify arrays render its task contract. Every task that delivers the one check commits its failing test first, records the real failing run, implements the behavior, then records the same narrow command passing. Do not add another evidence check for this truth. No observation items. All phase records and refusal/step receipts use the existing store writer and its sole journal; no separate authority or sidecar journal. Inputs are root-bound and versioned; retries bind the same request and exact inputs, and changed inputs refuse. Keep tracker writes, deferred-member ruling, generic absence proofs and manifest selection in their parked phases.
