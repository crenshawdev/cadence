# Phase 37: What a rejected check leaves behind

## Scope boundary

A check that verification rejected stays owned and current. The release projection (plan/associations.rs:51-76) releases a check only when its plan is Blocked and its owning task never closed; a rejected verdict in a retained accepted patch (verification/verdicts.rs:32-35) releases nothing. So after phase 36's verification rejected P36-T1-C on a completed plan, a gap plan republishing the id with a changed spec is refused evidence-item-conflict, a gap plan claiming it is refused allocation-owner (execution/allocation.rs:52), replacing the plan is refused admitted-plan (plan/validation.rs:56-57), and a second check id for the truth is refused truth-check-limit. The design says a rejected item is shown with why so the next planner sees what did not count (docs/architecture/acceptance.md:256-258); the next planner cannot act on it. A rejected verdict releases the check the way a retirement does, through the same projection. Lease: crates/cadence/src/plan/associations.rs and its tests. No new records; the rejected verdict is already retained. Phase 36 plan 3 is the first consumer.

## Durable decisions

- D-161. A check whose definition a retained accepted verification patch rejected is released from the task that owned it, exactly as a retirement releases it: the allocation row stays in the contract as history but no longer counts as an owner, the definition leaves the current union and is retained as superseded, and a later plan may republish the id, changed or not, and own it. The release is derived from the retained verdict; nothing writes a status, and a rejected verdict is never erased.

## Decisions


## Truths

- T1. When verification rejected a check and a later plan publishes that check id with a changed spec, the owner sees the preview accepted.
- T2. When a later plan's task claims a check that verification rejected, the owner sees the extension admitted.
- T3. When verification rejected a check, the owner sees its rejected definition in evidence-read as retained, not current.
- T4. When a later plan that re-proved a rejected check has completed, the owner gets a fresh verification attempt whose map carries only the later definition.

## Flagged assumptions

