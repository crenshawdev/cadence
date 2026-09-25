---
phase: 15
plan: 5
requirements: ["T5"]
files: ["crates/cadence/src/landing/model.rs","crates/cadence/src/landing/cleanup.rs","crates/cadence/src/landing/mod.rs","crates/cadence/src/landing_service.rs","crates/cadence/src/landing/report.rs","crates/cadence/src/rail/git.rs","crates/cadence/src/store/writer.rs","crates/cadence/src/store/transaction.rs","crates/cadence/src/server.rs","crates/cadence/src/recall/mod.rs","crates/cadence/tests/phase15_landing.rs","crates/cadence/tests/support/phase15.rs","crates/cadence/src/landing/instructions.rs","skills/cad-land/SKILL.md","crates/cadence/tests/mcp.rs","cadence-core/bin/land-cleanup.mjs","cadence-core/bin/land-cleanup.test.mjs","cadence-core/bin/lib/close-decision.mjs","cadence-core/bin/close-decision.test.mjs","cadence-core/bin/test.mjs","cadence-core/bin/lib/arg-contract.mjs","cadence-core/bin/arg-contract.test.mjs","cadence-core/bin/arg-contract-adoption.test.mjs","cadence-core/bin/lib/refusal-hints.mjs","cadence-core/bin/config-seams.test.mjs","cadence-core/bin/self-verify.test.mjs","cadence-core/bin/helper-census.test.mjs","cadence-core/bin/lib/census-registry.mjs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P15-5-T1","verify":["cargo nextest run -p cadence --test phase15_landing phase15_confirmed_merge_orders_cleanup_and_reap_checks_containment"]},{"id":"P15-5-T2","verify":["cargo nextest run -p cadence --test phase15_landing phase15_confirmed_merge_orders_cleanup_and_reap_checks_containment","cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions"]},{"id":"P15-5-T3","verify":["node --test --test-name-pattern='every flag in every row declares a complete grammar' cadence-core/bin/arg-contract.test.mjs","cargo nextest run -p cadence --test phase15_landing phase15_confirmed_merge_orders_cleanup_and_reap_checks_containment"]}]}
---
## Goal

Gate checkout, pull, tag and reap on an owner merge-confirmation record and enforce their order and branch containment.

## Must be true when done

- T5. When the owner confirms the merge, the owner sees checkout of base, pull, tag and reap run in that order, none of them before the confirmation, and reap refuse a branch the base does not contain.

## Context

D-196 is stricter than a forge saying MERGED: the owner confirms through a binary record, after plan 4 can reconcile the remote effect. Plan 3 deliberately avoids forge flags that reap a local branch during merge. The frozen helpers had separate decision and deletion steps; the new coordinator must enforce the order and recheck actual Git ancestry itself. Use the existing protected-branch policy at crates/cadence/src/rail/branch.rs:30 in addition to containment. The store persists every confirmation and successful cleanup receipt through the same writer.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P15-T5-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase15_landing phase15_confirmed_merge_orders_cleanup_and_reap_checks_containment",
        "expected": {
          "kind": "literal",
          "value": "Before confirmation all four operations are refused naming the missing merge confirmation; no checkout/pull/tag/branch-delete command occurs and refs/HEAD stay unchanged. The out-of-order tag is refused naming its missing predecessor. After confirmation, the real Git trace has the four successful mutation commands in exact order checkout, pull, tag, branch deletion; receipts name that confirmation and precede no required earlier receipt. HEAD ends on base, base equals the pulled remote commit, the annotated tag peels to that commit, and the contained feature branch is absent. The uncontained reap is refused naming branch and base, emits no branch deletion, and the branch remains at its exact original tip."
        },
        "test": {
          "file": "crates/cadence/tests/phase15_landing.rs",
          "function": "phase15_confirmed_merge_orders_cleanup_and_reap_checks_containment"
        },
        "setup": "Use the actual Client::open stdio launch at crates/cadence/tests/support/phase13.rs:22; compare authored document bytes with crates/cadence/tests/support/phase14.rs:225 where required. Build a real bare remote whose base contains the landing feature tip through an actual Git merge, and a working repository still on the feature with a stale local base. Establish authorized landing/merge-effect records through stdio, but no owner confirmation. Choose a new annotated tag name; use GIT_TRACE2_EVENT to retain actual Git child argv in invocation order. A second fixture has a branch tip that the pulled base does not contain and an explicit owner confirmation input; no mocked merge-base result.",
        "call": "Request checkout/pull/tag/reap before confirmation. Record land-confirm-merge through stdio; request an out-of-order tag, then checkout, pull, tag and reap in order. Restart/read receipts. In the uncontained fixture reach the reap step after checkout/pull and explicit tag skip, and request reap; inspect actual branch/base refs.",
        "boundary": "Real cadence serve over stdio; actual store journal, filesystem, Git child processes and local bare repository; forge effects, when present, cross an executable on PATH.",
        "fakes": [
          "Caller inputs and fixed clock/Git date inputs",
          "Local bare remote whose merge and divergent histories are real fixture commits",
          "Real Git trace output, without replacing Git"
        ]
      },
      "reason": "Causes the trigger of approved T5 version 1 and observes its stated outcome; this is its only check.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "Causes the trigger of approved T5 version 1 and observes its stated outcome; this is its only check."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P15-T5-A1",
      "spec": {
        "locators": [
          "crates/cadence/src/landing/model.rs",
          "crates/cadence/src/landing_service.rs"
        ],
        "substance": "Durable owner-attributed merge-confirmation record bound to the landing and exact merge identity; remote reconciliation alone cannot supply it."
      },
      "reason": "This artifact implements the owner-visible T5 outcome, including the named durable boundary.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "This artifact implements the owner-visible T5 outcome, including the named durable boundary."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P15-T5-A2",
      "spec": {
        "locators": [
          "crates/cadence/src/landing/cleanup.rs",
          "crates/cadence/src/landing/report.rs",
          "crates/cadence/src/landing/instructions.rs"
        ],
        "substance": "Ordered checkout/pull/tag/reap operations and receipts; explicit skips, local-effect replay checks and an actual ancestry/containment refusal immediately before reap, exposed through the compiled land door."
      },
      "reason": "This artifact implements the owner-visible T5 outcome, including the named durable boundary.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "This artifact implements the owner-visible T5 outcome, including the named durable boundary."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Deliver confirmation and ordered-cleanup behavior

- **ID:** P15-5-T1
- **Files:** crates/cadence/src/landing/model.rs, crates/cadence/src/landing/cleanup.rs, crates/cadence/src/landing/mod.rs, crates/cadence/src/landing_service.rs, crates/cadence/src/landing/report.rs, crates/cadence/src/rail/git.rs, crates/cadence/src/store/writer.rs, crates/cadence/src/store/transaction.rs, crates/cadence/src/server.rs, crates/cadence/src/recall/mod.rs, crates/cadence/tests/phase15_landing.rs, crates/cadence/tests/support/phase15.rs
- **Action:** Deliver P15-T5-C and A1/A2 red then green. Add land-confirm-merge with attributed owner input binding landing version, source/base and merged PR/commit identity, independently of the remote-effect receipt. Expose land-checkout, land-pull, land-tag and land-reap; require the confirmation and all preceding done/explicit-skip receipts. Before confirmation every operation refuses and no corresponding Git mutation runs. On the confirmed path checkout the recorded base, pull the exact recorded remote/base with safe fast-forward behavior, create the requested annotated tag on that pulled base only after validating its identity/collision, then reap the recorded source branch. Immediately before reap resolve current branch/base tips and require source to be an ancestor of the current base; refuse with branch/base identities if not contained, protected, currently checked out or changed incompatibly. No unconditional -D fallback. Record intended and actual ref identities around each real Git subprocess and one receipt per step; on retry inspect local refs/index/branch state before repeating an uncertain local effect. Gate tag push through plan-3 authorization and deferred checks. Keep local cleanup separate from tracker writes.
- **Verify:**
  - cargo nextest run -p cadence --test phase15_landing phase15_confirmed_merge_orders_cleanup_and_reap_checks_containment

### Task 2: Compile merge confirmation and cleanup reporting into cad-land

- **ID:** P15-5-T2
- **Files:** crates/cadence/src/landing/instructions.rs, skills/cad-land/SKILL.md, crates/cadence/tests/mcp.rs, crates/cadence/tests/phase15_landing.rs, crates/cadence/tests/support/phase15.rs
- **Action:** Extend the compiled door to display the merged landing identity and request the owner's explicit confirmation before calling land-confirm-merge; then follow the returned ordered next operations. Render the exact refusal naming the uncontained branch and base rather than suggesting forced deletion. Update the existing skill byte pin. Retain the already-green T5 check's restarted readback and process trace assertions, including an out-of-order request after confirmation and the uncontained-branch fixture. Do not equate a remote merge receipt with the owner confirmation.
- **Verify:**
  - cargo nextest run -p cadence --test phase15_landing phase15_confirmed_merge_orders_cleanup_and_reap_checks_containment
  - cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions

### Task 3: Delete land-cleanup and the frozen cleanup/gate tests

- **ID:** P15-5-T3
- **Files:** cadence-core/bin/land-cleanup.mjs, cadence-core/bin/land-cleanup.test.mjs, cadence-core/bin/lib/close-decision.mjs, cadence-core/bin/close-decision.test.mjs, cadence-core/bin/test.mjs, cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/arg-contract.test.mjs, cadence-core/bin/arg-contract-adoption.test.mjs, cadence-core/bin/lib/refusal-hints.mjs, cadence-core/bin/config-seams.test.mjs, cadence-core/bin/self-verify.test.mjs, cadence-core/bin/helper-census.test.mjs, cadence-core/bin/lib/census-registry.mjs
- **Action:** Delete land-cleanup.mjs and its dedicated test, and its now-unreferenced close-decision module/test. Remove contracts, test runner entries, config-seams cases that execute cleanup/gate, and corresponding helper/callsite census pins. Retain all unrelated configuration and gate tests. The old malformed-stdin/auto_close gate, name-only reap semantics and cleanup selection tests belong to the removed surface; do not preserve them as requirements for the Rust coordinator or silently leave them invoking a missing file.
- **Verify:**
  - node --test --test-name-pattern='every flag in every row declares a complete grammar' cadence-core/bin/arg-contract.test.mjs
  - cargo nextest run -p cadence --test phase15_landing phase15_confirmed_merge_orders_cleanup_and_reap_checks_containment

## Notes

Plans 3/4 own external authorization and reconciliation; this plan adds merge-confirmation and local cleanup fields without redefining prior receipts. The test uses real Git trace argv order, ref targets and reflog checks together; Git reflogs do not provide a complete tag/reap command trace. A requested tag is a local annotated tag after pull; tag push remains a separate authorized external step. If tagging or cleanup was explicitly not selected, store an explicit skipped step so later steps cannot silently jump a required operation. Preserve risk/deferred records after cleanup; no carried-risk directory deletion.

Execute plans 1 through 7 in order, never concurrently. Repeated file leases are sequential: retain earlier operations/tests and edit only this plan's named surface. New Rust paths and test functions are creation specifications, not claims about HEAD. The suite field renders execution.schema=1 and execution.suite; task ids and verify arrays render its task contract. Every task that delivers the one check commits its failing test first, records the real failing run, implements the behavior, then records the same narrow command passing. Do not add another evidence check for this truth. No observation items. All phase records and refusal/step receipts use the existing store writer and its sole journal; no separate authority or sidecar journal. Inputs are root-bound and versioned; retries bind the same request and exact inputs, and changed inputs refuse. Keep tracker writes, deferred-member ruling, generic absence proofs and manifest selection in their parked phases.
