---
phase: 15
plan: 3
requirements: ["T3"]
files: ["crates/cadence/src/landing/model.rs","crates/cadence/src/landing/authorization.rs","crates/cadence/src/landing/effects.rs","crates/cadence/src/landing/forge.rs","crates/cadence/src/landing/report.rs","crates/cadence/src/landing/mod.rs","crates/cadence/src/landing_service.rs","crates/cadence/src/rail/git.rs","crates/cadence/src/server.rs","crates/cadence/src/recall/mod.rs","crates/cadence/src/store/writer.rs","crates/cadence/src/store/transaction.rs","crates/cadence/tests/phase15_landing.rs","crates/cadence/tests/support/phase15.rs","crates/cadence/src/landing/instructions.rs","crates/cadence/src/main.rs","crates/cadence/src/execution/render.rs","crates/cadence/tests/mcp.rs","skills/cad-land/SKILL.md","cadence-core/bin/prose-agreement.test.mjs","cadence-core/bin/lib/deferred-reads.mjs","cadence-core/bin/deferred-reads.test.mjs","cadence-core/bin/self-verify.test.mjs","cadence-core/bin/weight-budgets.json","cadence-core/bin/git-publish.mjs","cadence-core/bin/git-publish.test.mjs","cadence-core/bin/lib/publish-decision.mjs","cadence-core/bin/publish-decision.test.mjs","cadence-core/bin/lib/repo-auto-close.mjs","cadence-core/bin/repo-auto-close.test.mjs","cadence-core/bin/test.mjs","cadence-core/bin/lib/arg-contract.mjs","cadence-core/bin/arg-contract.test.mjs","cadence-core/bin/arg-contract-adoption.test.mjs","cadence-core/bin/lib/refusal-hints.mjs","cadence-core/bin/config-seams.test.mjs","cadence-core/bin/helper-census.test.mjs","cadence-core/bin/lib/census-registry.mjs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P15-3-T1","verify":["cargo nextest run -p cadence --test phase15_landing phase15_publish_steps_refuse_without_a_landing_authorization"]},{"id":"P15-3-T2","verify":["cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions"]},{"id":"P15-3-T3","verify":["node --test --test-name-pattern='every flag in every row declares a complete grammar' cadence-core/bin/arg-contract.test.mjs","cargo nextest run -p cadence --test phase15_landing phase15_publish_steps_refuse_without_a_landing_authorization"]}]}
---
## Goal

Require an exact landing-and-step authorization before push, PR creation or merge, regardless of imported git.auto_close.

## Must be true when done

- T3. When a landing reaches an external step (push, PR create, merge), the owner sees the step refused until an authorization record names that landing and that step, refused while any deferred member is unruled, and git.auto_close granting nothing.

## Context

Extend the landing record and early deferred gate from plan 1, after plan 2's close/prune record exists. D-196 grants permission only through an explicit authorization record. crates/cadence/src/config/mod.rs:14 already lists git.auto_close as retired; use the effective configuration and preserve raw imported evidence without reading it as permission. crates/cadence/src/rail/branch.rs:30 is the protected-branch permission function, not a blanket publish authorization. The frozen git-publish helper directly depends on repo-auto-close, which this plan removes. The compiled skill pattern and rendered registry are in crates/cadence/src/execution/render.rs:119 and the exact pin begins at crates/cadence/tests/mcp.rs:1545. Every external subprocess belongs to the binary, with explicit argv and bounded output.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P15-T3-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase15_landing phase15_publish_steps_refuse_without_a_landing_authorization",
        "expected": {
          "kind": "literal",
          "value": "Each unauthorized call is refused with the actual landing id and exact step push/open/merge named; local and remote refs are identical to before, and forge create/merge invocation count is zero. Imported git.auto_close=true changes none of these answers. Wrong landing/step grants nothing. Every authorized request with an unruled member is refused naming that member, with no external mutation. The matching clear push is ok; the bare origin branch equals the fixture HEAD and there is exactly one durable push receipt naming its landing and authorization."
        },
        "test": {
          "file": "crates/cadence/tests/phase15_landing.rs",
          "function": "phase15_publish_steps_refuse_without_a_landing_authorization"
        },
        "setup": "Use the actual Client::open stdio launch at crates/cadence/tests/support/phase13.rs:22; compare authored document bytes with crates/cadence/tests/support/phase14.rs:225 where required. Build land-start inputs on a real feature branch with a known commit and actual local bare origin. Put logging gh/glab/tea stand-ins on this child's PATH, with deterministic read responses and a real append-only invocation file. Make one fresh fixture without auto_close and another whose legacy repository .planning/config.json contains git.auto_close=true before native import; ensure imported raw evidence still carries the key. Snapshot local and remote refs. Make a further native unruled deferred fixture through the plan-1 helper.",
        "call": "For both configuration fixtures request land-publish, land-open and land-merge before authorization; repeat with an authorization for another landing or another step. In the deferred fixture authorize each step then request it. In the clear fixture record an exact push authorization and publish; read back the authorization/receipt and remote ref from a new server.",
        "boundary": "Real cadence serve over stdio; actual store journal, filesystem, Git child processes and local bare repository; forge effects, when present, cross an executable on PATH.",
        "fakes": [
          "Caller inputs and fixed clock/Git date inputs",
          "Real local bare remote",
          "Real executable forge CLI stand-ins on PATH with literal JSON responses and invocation logs"
        ]
      },
      "reason": "Causes the trigger of approved T3 version 1 and observes its stated outcome; this is its only check.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "Causes the trigger of approved T3 version 1 and observes its stated outcome; this is its only check."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P15-T3-A1",
      "spec": {
        "locators": [
          "crates/cadence/src/landing/model.rs",
          "crates/cadence/src/landing/authorization.rs",
          "crates/cadence/src/landing_service.rs"
        ],
        "substance": "Journaled authorization naming landing and exact external step; refused push/open/merge/tag-push when absent or mismatched; unruled members refuse even with authorization; imported git.auto_close grants no authority."
      },
      "reason": "This artifact implements the owner-visible T3 outcome, including the named durable boundary.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "This artifact implements the owner-visible T3 outcome, including the named durable boundary."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P15-T3-A2",
      "spec": {
        "locators": [
          "crates/cadence/src/landing/effects.rs",
          "crates/cadence/src/landing/forge.rs",
          "crates/cadence/src/landing/report.rs"
        ],
        "substance": "Binary-owned actual Git and forge subprocesses with per-step intent/receipt identity and read-only tracker report; no mutating action can bypass the stored authorization."
      },
      "reason": "This artifact implements the owner-visible T3 outcome, including the named durable boundary.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "This artifact implements the owner-visible T3 outcome, including the named durable boundary."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P15-T3-A3",
      "spec": {
        "locators": [
          "crates/cadence/src/landing/instructions.rs",
          "crates/cadence/src/main.rs",
          "skills/cad-land/SKILL.md",
          "crates/cadence/tests/mcp.rs"
        ],
        "substance": "Compiled cadence land-instructions front door and exact mcp.rs skill pin, with explicit owner choice and binary authorization before external effects."
      },
      "reason": "This artifact implements the owner-visible T3 outcome, including the named durable boundary.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "This artifact implements the owner-visible T3 outcome, including the named durable boundary."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Deliver the authorization check and gated external operations

- **ID:** P15-3-T1
- **Files:** crates/cadence/src/landing/model.rs, crates/cadence/src/landing/authorization.rs, crates/cadence/src/landing/effects.rs, crates/cadence/src/landing/forge.rs, crates/cadence/src/landing/report.rs, crates/cadence/src/landing/mod.rs, crates/cadence/src/landing_service.rs, crates/cadence/src/rail/git.rs, crates/cadence/src/server.rs, crates/cadence/src/recall/mod.rs, crates/cadence/src/store/writer.rs, crates/cadence/src/store/transaction.rs, crates/cadence/tests/phase15_landing.rs, crates/cadence/tests/support/phase15.rs
- **Action:** Deliver P15-T3-C, A1 and A2 red then green. Expose land-authorize, land-publish, land-open, land-merge and land-tag-push, with schemas, root-resident dispatch and readback. Authorization is a durable owner-attributed record naming landing id/version and one exact step, frozen source commit/remote/ref/base and PR/tag inputs as relevant; another landing, changed head or a different step cannot borrow it. Evaluate the all-home deferred gate before Git/forge work, then matching authorization and branch protection before mutation; typed refusals name landing and step or every unruled member. Do not consult raw imported git.auto_close for permission. Persist step intent before launching, one successful receipt per step afterwards, retain failures and refuse ambiguous replay pending plan-4 reconciliation. Run actual push with explicit source/destination refs; open a confirmed-title/body PR/MR using a configured gh/glab/tea adapter; merge the recorded PR identity without deleting/reaping the local branch (plan 5 owns cleanup). Extend land-read with actual branch/ahead/dirty/remote and read-only tracker reporting; never create/update/close an issue or write FILED. New tests use a real bare remote and executable forge stand-ins that record argv and return literal state; they do not replace the binary's authorization, Git or store paths. Test imported repo-layer auto_close=true via first touch, not config-apply on a retired key. Include wrong-landing/step authorization and authorized-but-unruled cases inside the one check.
- **Verify:**
  - cargo nextest run -p cadence --test phase15_landing phase15_publish_steps_refuse_without_a_landing_authorization

### Task 2: Compile the land front door and pin its exact instructions

- **ID:** P15-3-T2
- **Files:** crates/cadence/src/landing/instructions.rs, crates/cadence/src/main.rs, crates/cadence/src/execution/render.rs, crates/cadence/tests/mcp.rs, skills/cad-land/SKILL.md, cadence-core/bin/prose-agreement.test.mjs, cadence-core/bin/lib/deferred-reads.mjs, cadence-core/bin/deferred-reads.test.mjs, cadence-core/bin/self-verify.test.mjs, cadence-core/bin/weight-budgets.json
- **Action:** Deliver P15-T3-A3. Add cadence land-instructions and its RENDERED_PROJECT_FILES entry; render skills/cad-land/SKILL.md from the binary and pin exact bytes and allowed MCP tools. The skill requests land-read, shows the exact identified landing/step and proposed inputs, records the owner's explicit authorization only after their choice, invokes the returned operation and prints refusals/receipts. It does no raw push/PR/merge, shell branching, auto_close default, tracker mutation or local reap. Remove the replaced land prose assertions and the cad-land deferred-read registry row/real-skill pins whose old inline workflow is gone; preserve generic deferred-read tests using synthetic text and other skills. Update affected self-verify and budget pins honestly. Plans 4/5 extend this same front door for resume and merge confirmation.
- **Verify:**
  - cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions

### Task 3: Delete the frozen publishing helper and permission tests

- **ID:** P15-3-T3
- **Files:** cadence-core/bin/git-publish.mjs, cadence-core/bin/git-publish.test.mjs, cadence-core/bin/lib/publish-decision.mjs, cadence-core/bin/publish-decision.test.mjs, cadence-core/bin/lib/repo-auto-close.mjs, cadence-core/bin/repo-auto-close.test.mjs, cadence-core/bin/test.mjs, cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/arg-contract.test.mjs, cadence-core/bin/arg-contract-adoption.test.mjs, cadence-core/bin/lib/refusal-hints.mjs, cadence-core/bin/config-seams.test.mjs, cadence-core/bin/self-verify.test.mjs, cadence-core/bin/helper-census.test.mjs, cadence-core/bin/lib/census-registry.mjs
- **Action:** Delete git-publish and its dedicated tests, publish-decision and its tests, repo-auto-close and its tests. Remove executable contracts, runner/census rows and the helper-specific assertions in config-seams, including mixed cases that would invoke the deleted command. Update the mergeLayers live-callsite census and its registry subjects/count after the actual removal; preserve surviving config behavior tests and land-cleanup cases until plan 5 removes that surface. Keep historical path references that are not executable dependencies. This task retires frozen behavior; it adds no truth or broad absence check.
- **Verify:**
  - node --test --test-name-pattern='every flag in every row declares a complete grammar' cadence-core/bin/arg-contract.test.mjs
  - cargo nextest run -p cadence --test phase15_landing phase15_publish_steps_refuse_without_a_landing_authorization

## Notes

Plan 1 defined the record and deferred precedence; this plan adds the authorization record and effects. Plans 4 and 5 extend receipts/reconciliation and cleanup in order without replacing this contract. land-read reports actual Git and read-only tracker state; issue-check.mjs remains because D-200 assigns tracker writes/fingerprint/FILED to phase 20. No auto-close compatibility exception survives in the Rust consumer or compiled prose. A step in uncertain in-flight state refuses/requires reconciliation until plan 4 is in place; do not implement blind retries as an interim default. Task verification uses the one T3 check plus the existing narrow rendered-skill pin; those existing pins are not a second evidence-map check.

Execute plans 1 through 7 in order, never concurrently. Repeated file leases are sequential: retain earlier operations/tests and edit only this plan's named surface. New Rust paths and test functions are creation specifications, not claims about HEAD. The suite field renders execution.schema=1 and execution.suite; task ids and verify arrays render its task contract. Every task that delivers the one check commits its failing test first, records the real failing run, implements the behavior, then records the same narrow command passing. Do not add another evidence check for this truth. No observation items. All phase records and refusal/step receipts use the existing store writer and its sole journal; no separate authority or sidecar journal. Inputs are root-bound and versioned; retries bind the same request and exact inputs, and changed inputs refuse. Keep tracker writes, deferred-member ruling, generic absence proofs and manifest selection in their parked phases.
