---
phase: 9
plan: 8
requirements:
  - AC151
  - AC152
  - AC153
  - AC154
  - AC155
  - AC156
  - AC157
  - AC158
files:
  - crates/cadence/src/execution_service.rs
  - crates/cadence/src/review_service.rs
execution:
  schema: 1
  suite: "TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --bin cadence gap158_"
  tasks:
    - id: P9-8-T1
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --bin cadence gap158_"
---

# Phase 9: Review delivery and identity — Gap closure plan 8

## Goal

Reviewers return raw findings, the binary persists them before completion, and every fire has durable artifact identity and one configured gate meaning. Close only truth 158: the execution handoff's one resolved diff gate and routing answer remain authoritative through admission.

## Must be true when done

- A completed execution receipt without a saved review binding resolves its diff gate and route once, and admission persists that exact gate and routing evidence without refreshing configuration.
- A concurrent config apply after the execution-boundary resolution cannot turn an applicable advisory review into an off-gate skip.
- A fresh off diff gate skips before `risk_material` or any other review-only material work can fail.
- Saved admission replay still precedes every config, routing and material read, while all non-handoff admission callers retain their current request JSON and refresh behavior.

## Context

Phase 9 goal-backward verification returned 7/8 because truth 158 failed. In `review_handoff`, the execution boundary currently resolves `route_at` and derives the diff gate, but its JSON request omits both; `admit` then refreshes config, resolves a second route and derives a second gate. The same outer function also invokes `risk_material` before its off-gate decision. The shipped `gap151_` decision and handler tests cover already-supplied values, not the production `review_handoff` to `admit` seam.

This is one sequential gap task under locked C01, D-58 through D-65 and H1 through H5; it changes no policy meaning or durable record contract. Plans 1–7, AC1–AC150 and the four `MANUAL.md` items remain closed inputs, not work to reopen or duplicate.

## Tasks

### Task 1: Carry the execution boundary's resolved review authority into admission (P9-8-T1)

- **Files:** `crates/cadence/src/execution_service.rs` (`review_handoff`), `crates/cadence/src/review_service.rs` (`admit`, `execute_inner`).
- **Action:** In `review_handoff`, preserve the existing saved-binding lookup before any current config or routing read. For a fresh completed receipt, retain the single `Generation` used by `route_at`, the resulting `Route`, and the `Gate` derived from that route's diff policy as one internal typed resolution. Decide `Gate::Off` immediately after that resolution and continue without calling `risk_material`; only a non-off gate may validate the retained execution basis and build the committed-range request.

  Extend the internal call contract of `admit` so `review_handoff` supplies that captured generation, route and gate directly. In the supplied arm, consume those values for the ordinary request, selection, requested voices/provider tier lookup, saved routing evidence and durable admission gate; do not call `session.config`, `route_at`, or the final current-generation comparison. The supplied snapshot is intentionally the boundary authority even if a config apply commits before admission. Accept this arm only for the internal execute/diff/non-specialist handoff; persist the same full route evidence already saved for ordinary admissions, and keep all H1 identity, material, attempt, acknowledgment and continuation behavior unchanged.

  Keep the existing refresh arm of `admit` for an ordinary request that has no supplied resolution. `execute_inner` must select that arm for public `review-admit`, so unchanged requests from `manual-plan`, `automatic-plan`, `task`, `debug`, `verify`, direct `pause`, and `modern_admission` continue to decode and resolve current configuration exactly as before; an ordinary external `execute` request also does not gain caller-selected authority. Do not add a required or user-decodable resolution field to `AdmissionRequest`, relax `deny_unknown_fields`, alter specialist admission, or add a production helper function outside the three functions inventoried in Coverage. Inside `admit`, durable replay by `replay_key` must return before either the supplied or refresh arm examines config, route, gate or material.
- **Verify:** Pending until implemented. Add direct child-unit tests in the leased source files and select them with `TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --bin cadence gap158_`. For AC151, construct accepted execution state with completed `d1`, no saved review binding, an off diff route and deliberately absent review-only material; call `review_handoff` and assert the exact pending-false envelope, proving the off decision precedes `risk_material`. For AC152, call `admit` with a supplied advisory resolution whose route answer is `cad-reviewer-xhigh`, forbid current config/routing reads, and record the contribution passed to stubbed durable persistence; assert the literal response and saved advisory gate/route. For AC153 and AC154, independently test the public admission branch and the saved replay response against stubbed boundaries; do not first run execution to manufacture any input.

  Add the four Rule 8 tests named by AC155–AC158. Each caller runs for real from constructed state, the named callee alone is stubbed, and the assertion is only the literal command or resolution value crossing that one seam; use no handler, workflow or end-to-end chain. Stub filesystem/session records, config/routing, material, persistence and clock (`100`) only where the directly tested function needs that boundary. Existing `gap151_` tests remain unchanged; no live executor, subprocess, network, model, config race or manual episode is a substitute for these units.

## Coverage

| function | unit ACs | wiring ACs |
|---|---|---|
| `execution_service::review_handoff` | AC151 | AC156 |
| `review_service::admit` | AC152, AC154 | AC157, AC158 |
| `review_service::execute_inner` | AC153 | AC155 |

## Notes

The public decode path is deliberately uncovered: this plan does not modify `decode_admission` or `AdmissionRequest`, so under rule 1 a criterion asserting its unchanged caller matrix would test code the phase does not touch. The unchanged-decode obligation is stated in the Action as a constraint on the change, not as a criterion.

The typed internal resolution is chosen instead of a JSON extension because the public admission request is caller-controlled; only the execution boundary may supply already-resolved authority. Carrying the captured `Generation` with `Route` preserves the existing provider-model lookup without a live second config read, while the separately captured `Gate` is the one value persisted and enforced. No third source file, manifest, lockfile, manual item or new dependency is required.

The frontmatter lease is exactly the union of the task's Files line. New tests remain inline child modules in their owning leased sources. Every verification obligation is pending until its production change exists, and no command in this plan is run during planning.

## PLANNING COMPLETE

`.planning/phases/9/PLAN-8.md` — 1 task.
