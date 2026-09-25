---
phase: 15
plan: 1
requirements: ["T1"]
files: ["crates/cadence/src/milestone/mod.rs","crates/cadence/src/milestone/model.rs","crates/cadence/src/milestone/preflight.rs","crates/cadence/src/milestone_service.rs","crates/cadence/src/landing/mod.rs","crates/cadence/src/landing/model.rs","crates/cadence/src/landing_service.rs","crates/cadence/src/review/consumers.rs","crates/cadence/src/review_service.rs","crates/cadence/src/store/writer.rs","crates/cadence/src/store/transaction.rs","crates/cadence/src/lib.rs","crates/cadence/src/server.rs","crates/cadence/src/recall/mod.rs","crates/cadence/tests/phase15_landing.rs","crates/cadence/tests/support/phase15.rs","crates/cadence/tests/support/phase13.rs","crates/cadence/src/milestone/instructions.rs","crates/cadence/src/main.rs","crates/cadence/src/execution/render.rs","crates/cadence/tests/mcp.rs","skills/cad-milestone/SKILL.md","cadence-core/workflows/milestone.md","cadence-core/bin/prose-agreement.test.mjs","cadence-core/bin/weight-budgets.json","cadence-core/bin/planning/risk-carry.mjs","cadence-core/bin/planning/deferred-carry.mjs","cadence-core/bin/planning-risk-carry.test.mjs","cadence-core/bin/planning-deferred.test.mjs","cadence-core/bin/planning.mjs","cadence-core/bin/test.mjs","cadence-core/bin/lib/arg-contract.mjs","cadence-core/bin/arg-contract.test.mjs","cadence-core/bin/arg-contract-adoption.test.mjs","cadence-core/bin/lib/refusal-hints.mjs","cadence-core/bin/helper-census.test.mjs","cadence-core/bin/lib/census-registry.mjs","cadence-core/bin/phase-spelling.test.mjs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P15-1-T1","verify":["cargo nextest run -p cadence --test phase15_landing phase15_close_refuses_unsettled_records_and_land_refuses_unruled_deferred"]},{"id":"P15-1-T2","verify":["cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions"]},{"id":"P15-1-T3","verify":["node --check cadence-core/bin/planning.mjs","node --test --test-name-pattern='every flag in every row declares a complete grammar' cadence-core/bin/arg-contract.test.mjs"]}]}
---
## Goal

Refuse milestone close on every named unsettled record before touching documents; establish the durable close and landing identities.

## Must be true when done

- T1. When a milestone close names a phase whose records are unsettled (a confirmed risk observation without a settlement receipt, an unruled deferred member), the owner sees the prune refused with each unsettled record named by identity, and every document byte unchanged.

## Context

D-194 and the owner's 2026-09-19 correction govern. crates/cadence/src/review/deferred.rs:13 has only InitialState::Unruled; enqueue_deferred at :117 retains durable members, while the landing/milestone consumers currently inspect saved review views. A rendered adjudication is not a settlement writer. crates/cadence/src/rail/receipts.rs:418 exposes risk-consequence; crates/cadence/tests/mcp.rs:2007 starts the real stdio risk-fire/consequence fixture. Read all targeted confirmed observations and their exact bound settlement receipts, not just the newest scan or permits_continuation. Refusals must identify retained observation/member identities. Writer::persist in crates/cadence/src/store/writer.rs:1868, the private writer behind the public Store handle at :183, calls transaction::commit; callers go through the Store request interface. Add typed server schemas AND dispatch/response routes and resident mailbox wiring (crates/cadence/src/recall/mod.rs:211). All checks run the actual cadence serve executable over stdio using crates/cadence/tests/support/phase13.rs:22 and a new tests/support/phase15.rs that composes its Client, git, git_value, tree, query, apply and reopened helpers. Add an environment-aware Client constructor for isolated PATH, Git trace and process-stop inputs without changing existing callers. Use real files, the real store journal, actual Git repositories and child processes. Native records are made through public operations, never inserted into snapshots. crates/cadence/tests/support/phase14.rs:225 supplies document-byte snapshots distinct from changing journals. The tracked-history fixture follows crates/cadence/tests/support/phase14.rs:88; the unmodified phase13 fixture ignores .planning and is not sufficient for prune recovery. After interruption start a real new server to recover before using reopened. Only clock windows/fixed Git dates, caller inputs, the local bare remote and the specified forge executable responses are controlled; expectations are handwritten.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P15-T1-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase15_landing phase15_close_refuses_unsettled_records_and_land_refuses_unruled_deferred",
        "expected": {
          "kind": "literal",
          "value": "First close: status refused, code milestone-unsettled, unsettled identities exactly [risk confirmation id on the risk phase, deferred member id on the deferred phase], with all authored document bytes unchanged. The later clear scan is not an unsettled identity and does not erase the earlier unresolved risk obligation. The correctly settled risk-only close is ok. The deferred close is still refused naming the same member; no rule-member request exists. land-publish is refused naming that member; zero Git subprocesses for the refused step, local and remote refs unchanged. Restart preserves the original risk/member records and refusal identities."
        },
        "test": {
          "file": "crates/cadence/tests/phase15_landing.rs",
          "function": "phase15_close_refuses_unsettled_records_and_land_refuses_unruled_deferred"
        },
        "setup": "Use the actual Client::open stdio launch at crates/cadence/tests/support/phase13.rs:22; compare authored document bytes with crates/cadence/tests/support/phase14.rs:225 where required. Use the new tracked native two-phase fixture and the public calls specified in task 1. Capture the risk observation confirmation identity and the enqueued deferred member id from their actual replies. The risk observation requires review (Checked with a checked scan containing matches or marked inconclusive) and has no valid bound settlement receipt; record a later conclusive clear scan with matches empty before close. Both phases otherwise meet close preconditions. Snapshot every authored document via support/phase14.rs:225. Use a second risk-only fixture for successful settlement, and a third landing fixture with a real bare origin and one native deferred member. Git tracing starts only after land-start/setup so the refused step can be proved to spawn no Git.",
        "call": "milestone-close naming both phases; compare document bytes; in the separate risk-only fixture submit the exact risk-consequence gate-pass receipt for the risk-fire and close again. Repeat close on the deferred fixture, restart and read identities. In the third fixture call land-publish with the unruled member and read local/bare refs and the per-call Git trace.",
        "boundary": "Real cadence serve over stdio; actual store journal, filesystem, Git child processes and local bare repository; forge effects, when present, cross an executable on PATH.",
        "fakes": [
          "Caller inputs and fixed clock/Git date inputs",
          "Local bare origin owned by the test"
        ]
      },
      "reason": "Causes the trigger of approved T1 version 1 and observes its stated outcome; this is its only check.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "Causes the trigger of approved T1 version 1 and observes its stated outcome; this is its only check."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P15-T1-A1",
      "spec": {
        "locators": [
          "crates/cadence/src/milestone/model.rs",
          "crates/cadence/src/milestone/preflight.rs",
          "crates/cadence/src/milestone_service.rs"
        ],
        "substance": "Journaled milestone close identity and root-bound selection; the preflight refusal lists each selected confirmed risk observation requiring review (Checked with a checked scan containing matches or marked inconclusive) without a valid bound settlement receipt and each selected unruled deferred member by exact identity before any document mutation. A conclusive clear scan (matches empty) creates no obligation and does not erase an earlier unresolved obligation. Existing store records survive unchanged."
      },
      "reason": "This artifact implements the owner-visible T1 outcome, including the named durable boundary.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "This artifact implements the owner-visible T1 outcome, including the named durable boundary."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P15-T1-A2",
      "spec": {
        "locators": [
          "crates/cadence/src/landing/model.rs",
          "crates/cadence/src/landing_service.rs",
          "crates/cadence/src/review/consumers.rs"
        ],
        "substance": "Durable landing identity and per-step receipt slots; all-home deferred preflight refuses land-publish before any Git invocation, without inventing deferred settlement."
      },
      "reason": "This artifact implements the owner-visible T1 outcome, including the named durable boundary.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "This artifact implements the owner-visible T1 outcome, including the named durable boundary."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P15-T1-A3",
      "spec": {
        "locators": [
          "crates/cadence/src/milestone/instructions.rs",
          "crates/cadence/src/main.rs",
          "skills/cad-milestone/SKILL.md",
          "crates/cadence/tests/mcp.rs"
        ],
        "substance": "Compiled cadence milestone-instructions front door with per-integer-phase audit reads, exact rendered skill pin and close refusal/report presentation."
      },
      "reason": "This artifact implements the owner-visible T1 outcome, including the named durable boundary.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "This artifact implements the owner-visible T1 outcome, including the named durable boundary."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Deliver the unsettled-record check and close/landing records

- **ID:** P15-1-T1
- **Files:** crates/cadence/src/milestone/mod.rs, crates/cadence/src/milestone/model.rs, crates/cadence/src/milestone/preflight.rs, crates/cadence/src/milestone_service.rs, crates/cadence/src/landing/mod.rs, crates/cadence/src/landing/model.rs, crates/cadence/src/landing_service.rs, crates/cadence/src/review/consumers.rs, crates/cadence/src/review_service.rs, crates/cadence/src/store/writer.rs, crates/cadence/src/store/transaction.rs, crates/cadence/src/lib.rs, crates/cadence/src/server.rs, crates/cadence/src/recall/mod.rs, crates/cadence/tests/phase15_landing.rs, crates/cadence/tests/support/phase15.rs, crates/cadence/tests/support/phase13.rs
- **Action:** Deliver P15-T1-C and A1/A2. Create milestone-read and milestone-close with an explicit phase set, occurrence, request id, expected record generation and display label. Read existing audit results by integer phase; collect all confirmed risk observations requiring review under requires_review (crates/cadence/src/rail/receipts.rs:197: outcome Checked with a checked scan containing matches or marked inconclusive) and without a valid bound settlement receipt for selected phases, and all selected unruled deferred identities from enumerate_deferred, deduplicating member ids across attempts. A conclusive clear scan (matches empty) creates no obligation and does not erase earlier unresolved obligations; deferred consequence/continuation is not settled. Fail closed on unreadable/bad bindings. Return code milestone-unsettled and a deterministic array naming each kind, phase and exact identity before any document write/delete. Journal the ready close and immutable inputs only on success. Establish landing identity, frozen source/base/remote inputs, version, ordered step definitions and one receipt slot per step in the store; expose land-start and land-read, and land-publish with an early all-home deferred refusal before invoking any Git command. Do not synthesize authorization or execute the step here. Register and route through server.rs and recall/mod.rs to the same root session. In support/phase15.rs adapt the public native completion/verification sequence of phase13 and phase14 for two distinct integer phases without republishing an incompatible phase13 context; keep planning docs tracked and committed. Make deferred admission with a deferred configured gate, an actual admitted manifest and recorded attempt through review-admit/review-next or the existing observation/return contract, then review-enqueue; never fabricate a snapshot. Make the confirmed committed risk observation, risk-status binding and risk-fire through stdio. The successful control contains only the risk phase. Commit the one test red then green; keep document snapshots separate from store journal growth.
- **Verify:**
  - cargo nextest run -p cadence --test phase15_landing phase15_close_refuses_unsettled_records_and_land_refuses_unruled_deferred

### Task 2: Compile the milestone front door and the per-phase audit read

- **ID:** P15-1-T2
- **Files:** crates/cadence/src/milestone/instructions.rs, crates/cadence/src/milestone_service.rs, crates/cadence/src/main.rs, crates/cadence/src/execution/render.rs, crates/cadence/tests/mcp.rs, skills/cad-milestone/SKILL.md, cadence-core/workflows/milestone.md, cadence-core/bin/prose-agreement.test.mjs, cadence-core/bin/weight-budgets.json
- **Action:** Deliver P15-T1-A3. Add cadence milestone-instructions rendering the compiled cad-milestone skill; register it in RENDERED_PROJECT_FILES and extend the exact rendered-byte/tool-permission pin. The front door reads the milestone report, displays the concrete close/version/phase selection and calls only the binary's returned typed operations after the required owner choice; it never instructs shell pruning, carry moves or raw Git. Encode the P4 settlement from Notes and separate close-only from later landing; suggest output grants no permission. Delete the replaced milestone workflow and its specific frozen prose assertions, remove its budget entry and update only this skill's budget/pin. Add future release/prune operations to this same compiled door in their owning plans, not a second workflow.
- **Verify:**
  - cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions

### Task 3: Remove carry writers and the tests that pin their file moves

- **ID:** P15-1-T3
- **Files:** cadence-core/bin/planning/risk-carry.mjs, cadence-core/bin/planning/deferred-carry.mjs, cadence-core/bin/planning-risk-carry.test.mjs, cadence-core/bin/planning-deferred.test.mjs, cadence-core/bin/planning.mjs, cadence-core/bin/test.mjs, cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/arg-contract.test.mjs, cadence-core/bin/arg-contract-adoption.test.mjs, cadence-core/bin/lib/refusal-hints.mjs, cadence-core/bin/helper-census.test.mjs, cadence-core/bin/lib/census-registry.mjs, cadence-core/bin/phase-spelling.test.mjs
- **Action:** Delete risk-carry.mjs, deferred-carry.mjs and planning-risk-carry.test.mjs; delete only deferred-carry cases from the mixed planning-deferred tests, retaining deferred-list/deferred-record and their surviving tests. Remove their planning.mjs imports, handlers/help, test runner entries, argument/refusal contracts and helper census entries/counts at the same time. In cadence-core/bin/phase-spelling.test.mjs remove the deferred-carry and risk-carry rows from CALLSITES, change the pinned counts from 23 to 21 total and 12 to 10 tree-aware, retain the unconditional count 2, and update the CADENCE-CENSUS comment above them to 21 total and 12 path-resolving (10 tree-aware and 2 unconditional). Update matching arg-contract pins rather than leave references to deleted executables. Carry now means retention of the original store records; this task introduces no directory-copy replacement and no absence truth. Do not delete issue-check.mjs.
- **Verify:**
  - node --check cadence-core/bin/planning.mjs
  - node --test --test-name-pattern='every flag in every row declares a complete grammar' cadence-core/bin/arg-contract.test.mjs

## Notes

P4 settlement: a milestone label is display text, never cad-audit's phase argument. milestone-read takes an explicit, validated set of positive integer phase ids, invokes the existing verification-audit read for each id and presents the existing audit outcomes with their phase identities; no label parser, new audit verdict or bypass is introduced. Close-only stops at the local milestone close; landing is a separate explicit action; existing suggest remains advisory. P2/D-78 stays in phase 21: no deferred ruling operation and no fabricated Settled view. T1's risk-only fixture is the successful post-settlement close; the deferred fixture remains refused. Before plan 2, an accepted milestone-close records its ready close identity and immutable selection only; plan 2 completes its prune. Shared landing code here owns identities and the early deferred gate, leaving external authorization/effects to plan 3.

Execute plans 1 through 7 in order, never concurrently. Repeated file leases are sequential: retain earlier operations/tests and edit only this plan's named surface. New Rust paths and test functions are creation specifications, not claims about HEAD. The suite field renders execution.schema=1 and execution.suite; task ids and verify arrays render its task contract. Every task that delivers the one check commits its failing test first, records the real failing run, implements the behavior, then records the same narrow command passing. Do not add another evidence check for this truth. No observation items. All phase records and refusal/step receipts use the existing store writer and its sole journal; no separate authority or sidecar journal. Inputs are root-bound and versioned; retries bind the same request and exact inputs, and changed inputs refuse. Keep tracker writes, deferred-member ruling, generic absence proofs and manifest selection in their parked phases.

Falsification findings 1, 2 and 4 of .codex-analysis/phase15-falsification.md corrected this plan on 2026-09-19.
