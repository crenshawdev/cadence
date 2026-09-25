---
phase: 37
plan: 2
requirements: ["T3"]
files: ["crates/cadence/src/plan/associations.rs","crates/cadence/tests/phase37_rejected_checks.rs"]
directories: []
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P37-2-T1","verify":["cargo test -p cadence --test phase37_rejected_checks phase37_rejected_check_can_be_republished_with_changed_spec -- --exact","cargo test -p cadence --test phase37_rejected_checks phase37_extension_reassigns_rejected_check -- --exact","cargo test -p cadence --test phase37_rejected_checks phase37_evidence_read_retains_rejected_check_as_superseded -- --exact","cargo test -p cadence --test phase37_rejected_checks phase37_fresh_verification_uses_only_reproved_check_definition -- --exact","cargo test -p cadence --test phase13_verification"]}]}
---
# Phase 37: What a rejected check leaves behind - Plan 2

## Goal

Repair the blocked Plan 1 projection so rejection alone leaves a check current and visible, while a previewed or saved later publication that republishes the check id releases the rejected definition for replacement.

## Must be true when done

- T3. When verification rejected a check, the owner sees its rejected definition in evidence-read as retained, not current.

## Context

Plan 1 is the blocked plan this D-120 gap plan repairs. Its task P37-1-T1 closed after four recorded red/green pairs at red 698f3e06 and green 8e8d5e82, but its required suite failed in phase13_verification because the rejected-check branch added at crates/cadence/src/plan/associations.rs:76 releases the rejected definition before any replacement exists. That removes the check from the current map at crates/cadence/src/plan/map_view.rs:188, changes the basis, and hides the retained verdict from verification status and audit. The acceptance design instead requires rejected evidence to stay visible with why it did not count at docs/architecture/acceptance.md:256.

Keep the blocked/unclosed source at crates/cadence/src/plan/associations.rs:61 unchanged. Gate only the rejected-verdict source at crates/cadence/src/plan/associations.rs:76 on a replacement of the rejected check id. In a complete plan-read preview, any attached check with that id in the submission is the replacement, regardless of whether its spec is changed or byte-identical. After publication, a current saved later publication qualifies only when its binding resolves through plan::persistence::saved at crates/cadence/src/plan/persistence.rs:11 and the corresponding later event in map_history::saved at crates/cadence/src/plan/map_history.rs:55 republishes that check id. A rejection with no such previewed or saved successor releases nothing.

Keep the change within associations.rs by retaining released_check_revisions(data, phase) as the saved-state entry point and adding the smallest preview-aware helper signature, released_check_revisions_with_submission(data, phase, submission: Option<&Submission>). The two-argument entry point delegates with None; associations::candidate at crates/cadence/src/plan/associations.rs:95 passes Some(submission). Thus map_view::assemble at crates/cadence/src/plan/map_view.rs:153 and execution::admission::validate at crates/cadence/src/execution/admission.rs:174 remain honest saved-state consumers without file edits. limits::checks at crates/cadence/src/plan/limits.rs:155 consumes the already-gated candidate union; map_history::view at crates/cadence/src/plan/map_history.rs:44 remains the immutable history serializer whose status map_view adjusts; and verification::inputs::observe at crates/cadence/src/verification/inputs.rs:90 continues consuming admission validation and map readback. No consumer file is leased.

Correct only the T3 fixture assertion at crates/cadence/tests/phase37_rejected_checks.rs:431. It must publish the file's changed_check through later_submission and publish_preview before evidence-read, then compare exact handwritten current items, aliases, associations and coverage: the artifact and changed check are current, without_check is empty, and T1 names check/rejected. History has the exact old publication items retained with superseded status and null superseded_by, followed by the changed later publication with current status. The other three phase-37 acceptance functions keep their outcomes unchanged. The phase-13 controls at crates/cadence/tests/phase13_verification.rs:528, crates/cadence/tests/phase13_verification.rs:736 and crates/cadence/tests/phase13_verification.rs:1366 prove that rejection without replacement stays on the applicable current basis.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "artifact",
      "id": "P37-A-REPLACEMENT-GATE",
      "spec": {
        "locators": [
          "crates/cadence/src/plan/associations.rs::released_check_revisions",
          "crates/cadence/src/plan/associations.rs::released_check_revisions_with_submission"
        ],
        "substance": "A rejected check definition enters the shared released-through projection only when an attached check in the candidate submission republishes its id, or when a current saved later publication cross-checked through its retained map event republishes that id. The exact rejected id and item revision still bind the owning admitted plan and preserve the maximum-through merge. Rejection alone releases nothing, so the definition and verdict remain current and visible; the blocked-plan/unclosed-task release source is unchanged."
      },
      "reason": "Without this replacement gate, a rejected check disappears from the current basis before a successor exists, making retained verification status pending and completion/audit structurally broken; without both preview and saved successor paths, one of changed-definition preview, execution extension, evidence history or fresh verification loses its replacement semantics.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "This artifact corrects when the rejected definition becomes retained rather than current: only the replacement publication releases it, while rejection alone leaves T3's evidence visible."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Gate rejected-check release on an actual replacement

- **ID:** P37-2-T1
- **Files:** crates/cadence/src/plan/associations.rs, crates/cadence/tests/phase37_rejected_checks.rs.
- **Action:** Preserve the blocked-plan loop byte-for-byte in behavior. Add a preview-aware internal release helper that derives current saved successor checks by cross-checking plan::persistence::saved publications with their current map_history events and accepts the optional submission's attached check ids for preview. For each exact rejected (id, item_revision) owned by an admitted plan, merge its admission version into released only when the submission republishes id or a current saved map event later than the owning publication republishes id; rejection alone does not add the revision. Keep released_check_revisions(data, phase) as the None wrapper used by map_view::assemble and execution::admission::validate, and change only associations::candidate to pass Some(submission); limits::checks continues over candidate contributions, map_history::view continues providing retained rows for map_view's release-derived status, and verification::inputs::observe continues through admission validation and map readback. In phase37_evidence_read_retains_rejected_check_as_superseded, publish changed_check with later_submission and publish_preview before evidence-read; assert exact handwritten current item, alias and association arrays for plan 1's artifact and plan 2's changed check, empty uncovered and without_check arrays, check/rejected as T1's sole coverage check, the old history publication superseded with its exact old items and null successor, and the later history publication current with its exact changed item. Do not alter any other phase-37 test outcome or any consumer file. This task owns no check: land one completion commit and pass every named verify run; there is no red/green pair to record.
- **Verify:**
  - cargo test -p cadence --test phase37_rejected_checks phase37_rejected_check_can_be_republished_with_changed_spec -- --exact
  - cargo test -p cadence --test phase37_rejected_checks phase37_extension_reassigns_rejected_check -- --exact
  - cargo test -p cadence --test phase37_rejected_checks phase37_evidence_read_retains_rejected_check_as_superseded -- --exact
  - cargo test -p cadence --test phase37_rejected_checks phase37_fresh_verification_uses_only_reproved_check_definition -- --exact
  - cargo test -p cadence --test phase13_verification

## Notes

This is the new approved plan identity required by D-120 at .planning/phases/12/CONTEXT.md:325; it does not replace or mutate admitted Plan 1. Plan 1's current evidence items, including P37-T1-C through P37-T4-C, continue to own all four truth checks, so this plan republishes none of them. P37-2-T1 owns only the replacement-gate artifact and therefore records one completion commit, no new check, and no red/green pair. The executor runs the five named verification commands and the configured suite at close.
