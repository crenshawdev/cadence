---
phase: 9
plan: 9
requirements:
  - AC152
  - AC154
  - AC157
  - AC158
files:
  - crates/cadence/src/review_service.rs
execution:
  schema: 1
  suite: "TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --bin cadence gap158_"
  tasks:
    - id: P9-9-T1
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --bin cadence gap158_ac152_supplied_admission_persists_exact_gate_and_route"
        - "TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --bin cadence gap158_"
---

# Phase 9: Review delivery and identity — Gap closure plan 9

## Goal

Reviewers return raw findings, the binary persists them before completion, and every fire has durable artifact identity and one configured gate meaning. Close only truth 162: the supplied-resolution test must exercise the same durable commit boundary as release while preserving D-66's commit-time revalidation.

## Must be true when done

- `review_service::admit` reaches `persistence::commit` in test and release builds; no test-only branch fabricates a committed `View`.
- AC152 proves that the supplied advisory gate and `cad-reviewer-xhigh` route govern the built contribution, then reads those literal values from storage after real durable persistence and acknowledgment.
- The real commit still refreshes and validates current controlling inputs, while no current configuration or routing read occurs earlier on AC152's decision path from replay lookup through contribution construction.
- Every other Plan 8 test seam remains only where it stubs a collaborator the criterion is not about or the named Rule 8 callee, and AC151 through AC158 stay unchanged and green.

## Context

Plan 8 verification scored 3/5 because its AC152 test replaced the persistence boundary and therefore passed after making `config.v4.json` invalid even though release correctly refused that state. D-66 retires truth 159 and preserves binary-wide commit-time input revalidation. D-67 upholds truth 162: remove only the fabricated-commit seam and prove AC152 through real persistence without threading captured inputs into the store, substituting `refresh_expected` for `refresh`, or weakening policy validation.

## Seam audit

| seam | verdict | reason |
|---|---|---|
| `review_service::GAP158_EXECUTE_INNER_STUB` | permitted | AC155 stubs its named `execute_inner` callee and asserts only `caller = "task"` crossing that seam. |
| `review_service::GAP158_REVIEW_HANDOFF_STUB` | permitted | AC156 stubs its named `review_handoff` callee and asserts only `dispatch = "d1"` crossing that seam. |
| `review_service::GAP158_ADMIT_STUB` | permitted | AC153 isolates `execute_inner` from its admission collaborator, and AC157 stubs the named `admit` callee to record `resolution = "refresh"`. |
| `review_service::Gap158Clock` / `GAP158_ADMISSION_BOUNDARIES.now` | permitted | AC152 requires clock `100`, but clock behavior is not the criterion's subject. |
| `review_service::GAP158_ADMISSION_BOUNDARIES.acquisitions` | permitted | AC152 stubs acquired material, while its subject is the supplied-resolution decision path and durable contribution. |
| `review_service::GAP158_ADMISSION_BOUNDARIES.committed` and the `admit` early return | must be removed | This fabricates the committed `View` and replaces the durable persistence boundary AC152 expressly requires. |
| `execution_service::GAP158_ADMISSION_STUB` | permitted | AC158 stubs the named `admit` callee, and AC151 uses the same recorder to prove the off branch never calls admission. |
| `execution_service::GAP158_MATERIAL_STUB` | permitted | AC158 isolates material resolution from the admission wiring seam, and AC151 uses the recorder to prove the off branch never calls material work. |

## Tasks

### Task 1: Exercise AC152 through the real persistence boundary (P9-9-T1)

- **Files:** `crates/cadence/src/review_service.rs` (`Gap158AdmissionBoundaries`, `admit`, `gap158_service_tests::gap158_ac152_supplied_admission_persists_exact_gate_and_route`).
- **Action:** Delete the `#[cfg(test)]` branch in `admit` that copies the transaction snapshot into a fabricated committed `View` and returns through a ready future. Remove the now-unused committed-state capture from `Gap158AdmissionBoundaries`. Test and release builds must share the existing `commit_admission` call whose future is `persistence::commit(store, &view, transaction)`; do not alter `persistence::commit`, the writer or session policy, do not pass the captured generation into persistence, do not replace `refresh` with `refresh_expected`, and do not bypass or weaken commit-time validation.

  Rewrite AC152 so current configuration remains valid and unchanged from session priming through commit, but has a literal gate and reviewer route different from the independently supplied advisory / `cad-reviewer-xhigh` resolution. Construct its factory with the existing `SessionFactory::with_io` and a test-local `ConfigIo` implementation sharing a read counter across clones. Prime the session, reset the counter, call `admit` with the supplied resolution under only the permitted acquired-material and clock-`100` seams, and require the real call to succeed. Assert the existing literal response, then call `persistence::read` and `persistence::records` on the real review store and assert the saved contribution is exactly `{"gate":"advisory","routing":{"answer":"cad-reviewer-xhigh","evidence":"route:f1"}}`; do not inspect a captured transaction snapshot. Assert that exactly the commit-time configuration refresh crossed the recording boundary after priming, so an added decision-path refresh fails the test while D-66's real revalidation remains exercised. Keep AC152's current wording, retain its admitted-at clock assertion, and do not change AC151 or AC153 through AC158 to make the suite pass.
- **Verify:** Running `TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --bin cadence gap158_ac152_supplied_admission_persists_exact_gate_and_route` passes with the saved advisory/xhigh contribution read from durable storage, and running `TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --bin cadence gap158_` passes all eight Plan 8 criteria with their assertions unchanged except for AC152's boundary-correct setup and observation.

## Coverage

| function | unit ACs | wiring ACs |
|---|---|---|
| `review_service::admit` | AC152, AC154 | AC157, AC158 |

## Notes

AC152 remains provable after seam removal because a stable current configuration lets the store perform its mandatory refresh, a shared `ConfigIo` counter distinguishes that one commit-time read from an impermissible earlier read, and the post-commit store read proves the supplied values reached durable state. An unreadable or changed config must refuse under D-66 and is no longer an AC152 fixture.

`crates/cadence/src/execution_service.rs` is not leased because its two audited seams are permitted and require no edit. The frontmatter lease therefore equals the union of the task's Files line. No acceptance criterion is appended to `CONTEXT.md`.

## PLANNING COMPLETE

`.planning/phases/9/PLAN-9.md` — 1 task.
