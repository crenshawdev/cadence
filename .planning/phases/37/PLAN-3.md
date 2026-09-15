---
phase: 37
plan: 3
requirements: ["T3"]
files: ["crates/cadence/src/plan/associations.rs"]
directories: []
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P37-3-T1","verify":["cargo test -p cadence --lib native_admission_validates_authority_and_allocation -- --exact","cargo test -p cadence --test phase37_rejected_checks phase37_rejected_check_can_be_republished_with_changed_spec -- --exact","cargo test -p cadence --test phase37_rejected_checks phase37_extension_reassigns_rejected_check -- --exact","cargo test -p cadence --test phase37_rejected_checks phase37_evidence_read_retains_rejected_check_as_superseded -- --exact","cargo test -p cadence --test phase37_rejected_checks phase37_fresh_verification_uses_only_reproved_check_definition -- --exact","cargo test -p cadence --test phase13_verification"]}]}
---
# Phase 37: What a rejected check leaves behind - Plan 3

## Goal

Repair the blocked Plan 2 release projection so phases without a rejected verdict retain D-158's blocked-plan releases without resolving saved map bindings, while phases with a rejection keep the replacement gate and binding checks unchanged.

## Must be true when done

- T3. When verification rejected a check, the owner sees its rejected definition in evidence-read as retained, not current.

## Context

Plan 2 is the blocked plan this D-120 gap plan repairs. Its task P37-2-T1 landed in completion commit 45b1d559 and passed all five named verification runs, but its suite failed in `execution::tests::native_admission_validates_authority_and_allocation` at crates/cadence/src/execution/tests.rs:76. That unit fixture carries no verification patches, yet `released_check_revisions_with_submission` resolves every saved publication against map history at crates/cadence/src/plan/associations.rs:82 before it reads retained verdict patches at crates/cadence/src/plan/associations.rs:106. Its seeded current publication does not satisfy the strict binding check at crates/cadence/src/plan/associations.rs:92, so admission validation returns `Invalid("current map publication binding is inconsistent")` before the function knows that no rejected verdict exists.

The release projection for a phase with no rejected verdict must be exactly the blocked-plan release projection D-158 established. Compute the phase's rejected `(id, item_revision)` set first from `crate::verification::verdicts::patches`; if that set is empty, return the releases already derived by the blocked-plan loop at crates/cadence/src/plan/associations.rs:67. Only a phase with at least one rejected verdict proceeds to resolve saved publications and map history, collect candidate and saved replacements, and apply Plan 2's replacement gate. Behavior when a rejection exists is unchanged.

No test file changes are needed. The out-of-lease unit test already covers admission without verification patches, and the four phase-37 acceptance tests already cover the rejection paths.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "artifact",
      "id": "P37-A-REJECTION-FIRST",
      "spec": {
        "locators": [
          "crates/cadence/src/plan/associations.rs::released_check_revisions_with_submission"
        ],
        "substance": "The saved publication and map-history bindings are resolved only after a rejected verdict for the phase is found; without one the projection returns the blocked-plan releases alone."
      },
      "reason": "If saved publication bindings are resolved before rejection is known, a phase with no rejected verdict can fail admission on irrelevant map history instead of preserving the blocked-plan release projection.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "This ordering preserves the T3 replacement gate only for phases where a rejected verdict exists, while leaving rejection-free projections unchanged."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Resolve replacement bindings only after finding a rejection

- **ID:** P37-3-T1
- **Files:** crates/cadence/src/plan/associations.rs.
- **Action:** In `released_check_revisions_with_submission`, derive the phase's rejected `(id, item_revision)` set from `crate::verification::verdicts::patches` immediately after the blocked-plan loop. When the set is empty, return the blocked-plan releases without calling `persistence::saved` or `map_history::saved`. When it is nonempty, resolve saved publications and map history exactly as today, retain the previewed-check and later-saved-publication replacement tests exactly as today, and match admitted task checks against the precomputed rejected set before merging their release-through versions. Keep every other behavior and file byte-for-byte. This task owns no check: land one completion commit and pass the six named verify runs; there is no red/green pair to record.
- **Verify:**
  - cargo test -p cadence --lib native_admission_validates_authority_and_allocation -- --exact
  - cargo test -p cadence --test phase37_rejected_checks phase37_rejected_check_can_be_republished_with_changed_spec -- --exact
  - cargo test -p cadence --test phase37_rejected_checks phase37_extension_reassigns_rejected_check -- --exact
  - cargo test -p cadence --test phase37_rejected_checks phase37_evidence_read_retains_rejected_check_as_superseded -- --exact
  - cargo test -p cadence --test phase37_rejected_checks phase37_fresh_verification_uses_only_reproved_check_definition -- --exact
  - cargo test -p cadence --test phase13_verification

## Notes

This gap plan does not replace or mutate retained Plan 2. Plan 1's current evidence items continue to own all four phase checks, so P37-3-T1 republishes no check and adds only the rejection-first artifact for T3. The executor records one completion commit, runs the six named verification commands, records no red/green pair, and runs the configured suite once at close.
