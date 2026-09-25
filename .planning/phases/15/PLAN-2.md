---
phase: 15
plan: 2
requirements: ["T2"]
files: ["crates/cadence/src/milestone/model.rs","crates/cadence/src/milestone/prune.rs","crates/cadence/src/milestone/mod.rs","crates/cadence/src/milestone_service.rs","crates/cadence/src/store/mod.rs","crates/cadence/src/store/model.rs","crates/cadence/src/store/writer.rs","crates/cadence/src/store/transaction.rs","crates/cadence/src/store/filesystem.rs","crates/cadence/src/rail/mod.rs","crates/cadence/src/rail/commit.rs","crates/cadence/src/rail/git.rs","crates/cadence/src/milestone/instructions.rs","skills/cad-milestone/SKILL.md","crates/cadence/tests/phase15_landing.rs","crates/cadence/tests/support/phase15.rs","crates/cadence/src/milestone/documents.rs","crates/cadence/src/why/corpus.rs","crates/cadence/src/why/render.rs","crates/cadence/tests/mcp.rs","cadence-core/bin/planning/milestone-prune.mjs","cadence-core/bin/lib/milestone-prune.mjs","cadence-core/bin/milestone-prune.test.mjs","cadence-core/bin/planning-milestone-prune.test.mjs","cadence-core/bin/planning.mjs","cadence-core/bin/test.mjs","cadence-core/bin/lib/arg-contract.mjs","cadence-core/bin/arg-contract.test.mjs","cadence-core/bin/arg-contract-adoption.test.mjs","cadence-core/bin/lib/refusal-hints.mjs","cadence-core/bin/helper-census.test.mjs","cadence-core/bin/lib/census-registry.mjs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P15-2-T1","verify":["cargo nextest run -p cadence --test phase15_landing phase15_prune_retries_to_one_result_from_every_write_point"]},{"id":"P15-2-T2","verify":["cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions"]},{"id":"P15-2-T3","verify":["node --check cadence-core/bin/planning.mjs","node --test --test-name-pattern='every flag in every row declares a complete grammar' cadence-core/bin/arg-contract.test.mjs"]}]}
---
## Goal

Make a milestone prune recover to one document tree and one single-parent commit after every write interruption.

## Must be true when done

- T2. When a prune is interrupted at any of its write points and retried, the owner sees one end state: the phase directories gone, ROADMAP and REQUIREMENTS rewritten once, no ARCHIVE.md, and a single-parent prune commit cad-why recovers; an unreadable input is refused before the first delete.

## Context

Build on plan 1's accepted close and retained records (D-194/D-195). The current ExternalChange in crates/cadence/src/store/transaction.rs:214 represents byte replacement, not deletion; commit at :1812 prepares and installs participants under the store intent. Extend that journal's typed participant/recovery rules, rather than putting a second transaction beside it. The filesystem adapter currently has file removal, not a contained directory-prune transaction. Recovery currently labels a prune from ARCHIVE headings in crates/cadence/src/why/corpus.rs:612, and its single-parent recovery/fallback is at :637 and :651. New deletes and the Git commit must be performed by the binary. The phase14 tracked-history fixture at crates/cadence/tests/support/phase14.rs:88 supplies the useful Git fixture pattern; use literal local documents whose whole before/after bytes are authored in the new test.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P15-T2-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase15_landing phase15_prune_retries_to_one_result_from_every_write_point",
        "expected": {
          "kind": "property",
          "value": "Every completed/retried run has exactly the handwritten ROADMAP/REQUIREMENTS bytes; both phase directories absent, open phase unchanged, ARCHIVE.md absent, original risk/receipt/deferred records retained. Exactly one new prune commit has the frozen original HEAD as its only parent and the expected tree, and retries add zero commits or document rewrites. All stop points converge to that same commit and tree. why recovers the native-completion SUMMARY's known Plan/Task/Commit rows, evidence and source pointer from the parent tree, with label 'an unlabelled close (<actual prune sha8>)', then the literal containing release tag. Unreadable REQUIREMENTS yields status refused naming that path before any delete, document rewrite or commit; all documents/directories remain byte-identical."
        },
        "test": {
          "file": "crates/cadence/tests/phase15_landing.rs",
          "function": "phase15_prune_retries_to_one_result_from_every_write_point"
        },
        "setup": "Use the actual Client::open stdio launch at crates/cadence/tests/support/phase13.rs:22; compare authored document bytes with crates/cadence/tests/support/phase14.rs:225 where required. New support/phase15.rs builds identical real repositories with fixed authors/dates, tracked SUMMARY/UAT for two completed phases and handwritten ROADMAP/REQUIREMENTS including one open phase, a Deferred row and fenced examples. A legitimate native completion emits each SUMMARY with ## Plan {number} task tables (Plan | Task | Status | Commit | Verification) before close; those emitted SUMMARYs, UAT and Git objects exist in the actual parent tree. The store and runtime logs are ignored. Use the plan-1 accepted close request. Build a separate mode-000 REQUIREMENTS fixture; ensure the serve child actually lacks read permission (run it unprivileged when the test runner is root), and verify open fails rather than assuming chmod worked.",
        "call": "For a fresh copy at each registered prune write boundary, inject an actual process exit/refusal, call milestone-close, restart the real server and retry the identical close. Also run an uninterrupted control and retry it. Compare resulting document bytes, tree and prune commit ids. Query why for the recorded source path without a release tag and with a real later containing release tag. In the unreadable fixture call close and inspect files/Git.",
        "boundary": "Real cadence serve over stdio; actual store journal, filesystem, Git child processes and local bare repository; forge effects, when present, cross an executable on PATH.",
        "fakes": [
          "Caller inputs and fixed clock/Git date inputs",
          "Caller-selected real process exit/refusal at each journal/file/ref write point",
          "Real filesystem permissions and an unprivileged child when necessary"
        ]
      },
      "reason": "Causes the trigger of approved T2 version 1 and observes its stated outcome; this is its only check.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "Causes the trigger of approved T2 version 1 and observes its stated outcome; this is its only check."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P15-T2-A1",
      "spec": {
        "locators": [
          "crates/cadence/src/milestone/prune.rs",
          "crates/cadence/src/store/transaction.rs",
          "crates/cadence/src/store/filesystem.rs",
          "crates/cadence/src/store/writer.rs"
        ],
        "substance": "The sole-journal prune transaction, complete preflight, explicit delete/document/record/ref write points, sealed input/output bytes and idempotent recovery. No ARCHIVE write and no risk/deferred record loss."
      },
      "reason": "This artifact implements the owner-visible T2 outcome, including the named durable boundary.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "This artifact implements the owner-visible T2 outcome, including the named durable boundary."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P15-T2-A2",
      "spec": {
        "locators": [
          "crates/cadence/src/rail/commit.rs",
          "crates/cadence/src/milestone/documents.rs"
        ],
        "substance": "Binary-owned committer with frozen exact parent/tree/commit identity and compare-and-swap ref update; one single-parent commit contains phase removal and both document changes, guarded by existing commit permission."
      },
      "reason": "This artifact implements the owner-visible T2 outcome, including the named durable boundary.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "This artifact implements the owner-visible T2 outcome, including the named durable boundary."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P15-T2-A3",
      "spec": {
        "locators": [
          "crates/cadence/src/why/corpus.rs",
          "crates/cadence/src/why/render.rs"
        ],
        "substance": "Pruned-phase recovery labels from actual containing release tags rather than ARCHIVE headings; deterministic 'an unlabelled close (<sha8>)' fallback and retained single-parent history recovery. The commit-row parser accepts native SUMMARY per-plan task tables (## Plan {number}, columns Plan | Task | Status | Commit | Verification) in addition to legacy ## Commits, so recovered indexing sees native commit rows."
      },
      "reason": "This artifact implements the owner-visible T2 outcome, including the named durable boundary.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "This artifact implements the owner-visible T2 outcome, including the named durable boundary."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Deliver the prune interruption check and extend the sole journal

- **ID:** P15-2-T1
- **Files:** crates/cadence/src/milestone/model.rs, crates/cadence/src/milestone/prune.rs, crates/cadence/src/milestone/mod.rs, crates/cadence/src/milestone_service.rs, crates/cadence/src/store/mod.rs, crates/cadence/src/store/model.rs, crates/cadence/src/store/writer.rs, crates/cadence/src/store/transaction.rs, crates/cadence/src/store/filesystem.rs, crates/cadence/src/rail/mod.rs, crates/cadence/src/rail/commit.rs, crates/cadence/src/rail/git.rs, crates/cadence/src/milestone/instructions.rs, skills/cad-milestone/SKILL.md, crates/cadence/tests/phase15_landing.rs, crates/cadence/tests/support/phase15.rs, crates/cadence/src/milestone/documents.rs, crates/cadence/src/why/corpus.rs, crates/cadence/src/why/render.rs
- **Action:** Deliver P15-T2-C and A1/A2 red then green. Extend the existing store intent with an explicit prune kind whose sealed write set contains selected contained regular files/directories, exact preimages, desired ROADMAP/REQUIREMENTS bytes, expected Git parent/ref/index, fixed commit metadata, intended tree and commit identity, and progress/receipt identity. Preserve old transaction serde and replay contracts; add default-refusing Storage support for the new prune participant so unrelated adapters need no fabricated delete behavior. Before intent or any destructive write, validate every selected document and directory recursively, readability and containment/no symlink traversal, all required source rows, real Git history availability of the selected SUMMARY/UAT, clean affected index/worktree and the branch commit rail. Missing required ROADMAP/REQUIREMENTS or phase input is a named refusal, never empty content; existing immutable prune replay may accept its already-installed absence. Persist the complete intent before removing anything. Delete only manifested phase files/directories, replace both documents with the frozen bytes, and make/update exactly one single-parent commit with the binary's committer; do not stage unrelated paths. Freeze the commit object/ref CAS inputs so a restart after ref update recognizes the intended commit rather than committing again. Guard every write and recover exact pre/post states through the same journal; interference refuses by path/ref. Add named test-only process-stop points before/after every destructive file/dir install, each document replacement, intent/record persistence and commit/ref write boundary. Stops exit the actual serve process or refuse at the actual write point; no mocked filesystem/committer. The single check iterates all write points on fresh equivalent repositories and restarts with the same request. Keep all review/risk data byte-identical within the store payload.

Complete the literal transformations exercised inside the same P15-T2-C function; do not introduce another check. Remove only selected integer phase roadmap rows and their associated detail spans, and the selected active/traceability requirement rows, preserving unrelated/open phases, Deferred sections, wrapped bullet boundaries and fenced examples. Record the entire desired bytes in the prune intent before deletion. No regeneration from already-pruned input during retry, no duplicate Shipped/ARCHIVE append and no rewriting other documents. The test's expected ROADMAP and REQUIREMENTS are handwritten full strings rather than output from the transform under test; compare every successful and recovered result against those same bytes.

Deliver P15-T2-A3 and the recovery arm of the existing T2 check. Replace ARCHIVE heading lookup in prune_labels with actual release tag/peeled commit ancestry lookup, with the containing-tag rule in Notes. Retain the refusal on zero/multiple-parent closes. Extend the commit-row parser in crates/cadence/src/why/corpus.rs:149 to read the native SUMMARY's per-plan task tables (crates/cadence/src/execution/render.rs:63: ## Plan {number}, columns Plan | Task | Status | Commit | Verification) in addition to the legacy ## Commits section, so recovered indexing at crates/cadence/src/why/corpus.rs:676 sees native commit rows. Read SUMMARY and UAT evidence from the actual single parent tree through the extended recovery, retain source pointers, and return the exact unlabelled fallback when no containing release tag exists. In the same T2 function query why for a source path documented by the pruned SUMMARY emitted by native completion before a later release tag, then create a real containing release tag as fixture input and query again after restart. Assert the selected source, evidence text, parent identity and literal label; do not claim why currently indexes UAT if its tier only consumes SUMMARY.

All transformation and why-recovery work above belongs to this check-delivering task, so its red run can become green before task completion.
- **Verify:**
  - cargo nextest run -p cadence --test phase15_landing phase15_prune_retries_to_one_result_from_every_write_point

### Task 2: Expose the committed prune in the milestone front door

- **ID:** P15-2-T2
- **Files:** crates/cadence/src/milestone/instructions.rs, skills/cad-milestone/SKILL.md, crates/cadence/src/milestone_service.rs, crates/cadence/tests/mcp.rs
- **Action:** Extend the compiled milestone report/door to show the exact selected phase set, durable prune id, single-parent commit and recovery/next action, and to retry the same identified close after interruption. It must not delegate deletion or commit to the model, create an ARCHIVE workflow or automatically authorize landing. Regenerate the skill and extend the existing rendered-byte pin.
- **Verify:**
  - cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions

### Task 3: Delete the frozen prune implementation and its tests

- **ID:** P15-2-T3
- **Files:** cadence-core/bin/planning/milestone-prune.mjs, cadence-core/bin/lib/milestone-prune.mjs, cadence-core/bin/milestone-prune.test.mjs, cadence-core/bin/planning-milestone-prune.test.mjs, cadence-core/bin/planning.mjs, cadence-core/bin/test.mjs, cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/arg-contract.test.mjs, cadence-core/bin/arg-contract-adoption.test.mjs, cadence-core/bin/lib/refusal-hints.mjs, cadence-core/bin/helper-census.test.mjs, cadence-core/bin/lib/census-registry.mjs
- **Action:** Delete both milestone-prune implementation files and both dedicated test files with the surface they pin, including their former ARCHIVE, archive-mode and unreadable-as-empty semantics. Remove planning dispatcher imports/help/handlers, runner entries, argument/refusal/census rows and their affected numeric pins. Keep historical why tests that merely query the old helper's path; a historical path query is not an executable dependency. No general absence criterion or test is added; phase 18 owns that gate.
- **Verify:**
  - node --check cadence-core/bin/planning.mjs
  - node --test --test-name-pattern='every flag in every row declares a complete grammar' cadence-core/bin/arg-contract.test.mjs

## Notes

Plan 1 owns record eligibility; this plan adds the prune on accepted milestone-close. New close calls recheck preconditions; retries recover the frozen accepted transaction before reinterpreting changed ROADMAP rows. No archive mode, carry directory or ARCHIVE write is ported. A pre-existing historical ARCHIVE.md is left untouched; the T2 fixture starts without one. Release tags are created after merge: interpret D-195's reachable release label as a release tag whose peeled commit contains the prune in its ancestry, selecting the nearest containing release tag deterministically (tag name breaks a tie); an earlier ancestor release tag must not label a later close. Untagged fallback includes the prune's first eight hex digits. Stable commit metadata and expected parent are frozen before installation so cross-stop fixtures yield the same commit object. This plan does not ship a release tag.

Execute plans 1 through 7 in order, never concurrently. Repeated file leases are sequential: retain earlier operations/tests and edit only this plan's named surface. New Rust paths and test functions are creation specifications, not claims about HEAD. The suite field renders execution.schema=1 and execution.suite; task ids and verify arrays render its task contract. Every task that delivers the one check commits its failing test first, records the real failing run, implements the behavior, then records the same narrow command passing. Do not add another evidence check for this truth. No observation items. All phase records and refusal/step receipts use the existing store writer and its sole journal; no separate authority or sidecar journal. Inputs are root-bound and versioned; retries bind the same request and exact inputs, and changed inputs refuse. Keep tracker writes, deferred-member ruling, generic absence proofs and manifest selection in their parked phases.

Falsification finding 5 of .codex-analysis/phase15-falsification.md corrected this plan on 2026-09-19.
