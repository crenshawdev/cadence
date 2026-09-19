# Phase 34: The blocked path

## Scope boundary

The two exits the execution model lacks, found by running the D-120 gap path end to end on phase 31. One: an owner retirement, execution-task-retire, records owner, time and reason against an unfinished task; the plan ends blocked exactly as a failed suite does (end_dispatch Blocked: receipts kept, active dispatch cleared, no phase-level stop) and the next admitted plan dispatches. Two: the derivation of executed follows phase_complete: a blocked plan counts when a later-admitted plan completed, and task closure is demanded only of completed plans. Lease: crates/cadence/src/execution/history.rs, crates/cadence/src/execution_service.rs, crates/cadence/src/server.rs, crates/cadence/src/derivation/mod.rs and their tests. No new records beyond the retirement. Phase 31 resumes on this: P31-3-T1 retired, plans 4 to 6 run, T6 waived at verification and re-specified in phase 32 without the Codex worker leg.

## Durable decisions

- D-152. A retired task is never satisfied and never rerun; its truth is proven by a later plan or waived at verification, and the owner's reason stays on the record.
- D-153. Executed is derived by phase_complete's rule and nowhere else: every admitted plan has an outcome, and a blocked plan is satisfied by a later-admitted plan that completed.
- D-154. Amends D-149. A Codex worker spawned inside a Codex session reaches the read layer over its own server process; one surface means the same three calls, not one process. Measured 2026-09-13 on Codex 0.154.0: the root's rollout carries spawn_agent and wait_agent, the worker's rollout carries parent_thread_id and its own cadence call, and a second cadence serve process lived while the worker ran.

## Decisions


## Truths

- T1. When the owner retires an unfinished task with a reason, the executor sees the plan end blocked with that reason and the next admitted plan dispatched.
- T2. When a blocked plan is followed by a later-admitted plan that completed, the owner sees the phase derived as executed.

## Flagged assumptions

