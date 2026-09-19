# Phase 36: What a blocked plan leaves behind

## Scope boundary

A plan blocked by an owner retirement or a failed suite stays admitted and can never be replaced (plan/validation.rs:56-57), yet every saved publication joins the current phase union whatever its execution outcome (plan/associations.rs:47-57), an extension must keep every allocation entry (execution/admission.rs:98-101) with one owner per check id (execution/allocation.rs:52), and verification demands every admitted plan completed and every task closed (verification/inputs.rs:113-118). Only phase_complete (execution/history.rs:541-553) accepts a blocked plan when a later-admitted plan completed. So the D-120 gap plan cannot carry a corrected check, cannot own it, and the phase cannot verify. The blocked plan's unfinished tasks release what they own, and verification asks of a phase exactly what phase_complete asks. Lease: crates/cadence/src/plan/associations.rs, crates/cadence/src/plan/limits.rs, crates/cadence/src/execution/admission.rs, crates/cadence/src/execution/allocation.rs, crates/cadence/src/verification/inputs.rs and their tests. No new records. Phase 34 plan 3 (published 1f32fd7e, unadmitted) is the first consumer.

## Durable decisions

- D-158. A task that ended without a close, retired or not run when its plan blocked, releases its checks: the allocation entry stays in the contract as history but no longer counts as an owner, and those check definitions leave the current union and are retained as superseded. Everything else the plan published stays current.
- D-159. Verification asks of a phase exactly what phase_complete asks: every plan completed, or blocked with a later-admitted completed plan; close proof is demanded only of closed tasks.

## Decisions


## Truths

- T1. When a plan is blocked and a later plan publishes a released check id with a changed spec, the owner sees the preview accepted.
- T2. When a later plan's task claims a released check, the owner sees the extension admitted.
- T3. When every blocked plan has a later-admitted completed plan, the owner gets a verification attempt for the phase.
- T4. When a check is released, the owner sees its old definition in evidence-read as retained, not current.

## Flagged assumptions

