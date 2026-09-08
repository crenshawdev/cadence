---
phase: 9
status: complete
completed: 2026-09-08
---

# Phase 9: Review delivery and identity - Summary

Reviewers now return raw findings and nothing else. The binary admits the fire,
retains the material, issues the attempt, persists the return and closes the
attempt, so every review episode has durable artifact identity that survives
replay, interruption and a lost acknowledgment. One configured gate carries one
meaning across every ordinary caller. Reviewers write no artifacts and append no
trace; the invoking skill forwards their raw JSON unchanged.

## What shipped

- Plan 1: saved review records and the findings envelope, with scalar-text and
  exact line-bound admission. Malformed envelopes refuse without partial writes.
- Plan 2: typed material retention with content identity, recovery of retained
  bytes and directory membership, diffs bound to their source sides, and
  appended context and specialist targets.
- Plan 3: resolved policy preserved across ordinary callers, delivery permission
  separated from settlement, FIRST selection stopping at the first usable
  return, every admitted panel slot required to finish, and minimalism
  specialist admission preserved.
- Plan 4: pending admission committed with durable occurrence identity, returns
  bound to saved attempts and host identity, replay-safe and late host
  observations persisted, originals accepted atomically with attempts closed
  exactly once, and interrupted attempts recovered per voice.
- Plan 5: raw consumer and specialist inputs recovered, supplied consumer
  selections transported, risk consumer inventories preserved, and deferred
  members persisted across all homes.
- Plan 6: native delivery operations and saved inventory exposed, retained local
  dispatch with a durable wait contract, modern pause admission routed through
  ordinary delivery, and historical pause origin exposed without promotion.
- Plan 7: the seven goal-backward gaps below, none of which any acceptance
  criterion had asked about.

## The seven gaps, and why they needed plan 7

All 150 acceptance criteria passed before plan 7 existed. The goal-backward pass
then found seven production defects the criteria did not reach - items 151-157
in [UAT.md](UAT.md), each confirmed against the code rather than taken from the
verifier's report:

- **Blocker.** `pending_execution` only filtered existing admissions; nothing
  ever admitted a required review, so execution could expose the next dispatch
  without creating a fire. Closed as a thin boundary only, not the phase-12
  workflow.
- A submission with an unbound launch was rejected even when `host_failure` was
  supplied, leaving a known failed launch pending forever.
- Delivery compared view IDs but never membership, so appended evidence could
  retrofit a completed attempt's original view.
- `risk_review_action` had exactly zero production callers.
- The minimalism specialist dispatch copied ordinary routing's pinned model.
- Directory listing called `entry(...)` on every member as a file, so a nested
  directory failed manifest admission.
- The 4 MiB cap bounded a `String` the MCP request had already allocated and
  parsed, so it was not enforced at the real input boundary.

## What this phase does not claim

Four live observations remain in [MANUAL.md](MANUAL.md) under the Overflow rule:
they need a running host and are not acceptance criteria. Binary tests establish
admission, retention, identity, persistence, closure and bounds. They do not
establish host loading, reviewer compliance, or anything about model-generated
output.

Plan 7's task 1 admits review at the execution boundary; it does not implement
task scheduling, execution workflow migration or settlement. Task 7 bounds local
MCP input; it is not phase-10 provider transport.

## Deviations

- **The testing methodology changed mid-phase.** Rule 4 of
  `docs/rationale/acceptance-criteria.md` was replaced (`f2e69bfd`) with the
  unit-level methodology: functions and methods tested against inputs and return
  values, receivers constructed as inputs, no test walking the call chain,
  recursion isolated behind a thin orchestrator with a stubbed resolver, and
  module-level tests only where composition itself can fail. It binds forward
  only. The 215 phase 9 tests predating it were not reshaped, and two known
  divergences are recorded in that document so they are not copied.
- Plan 2 spent its single clippy invocation before its last task, so that task's
  code shipped unlinted and plan 3 blocked on the lint it left. Resolved by one
  authorized bounded commit (`f110bb92`) and a second clippy run. The constraint
  now states where the invocation goes, not only how many are permitted.
- Plan 7's first dispatch checkpointed at task 0 of 7 with no source written.
  The dispatch had reinstated the superseded rule 4 text alongside the current
  one, making the plan's two thin composition cases unsatisfiable. The executor
  cited the conflict rather than assuming an exception or rewriting a criterion.
  The added text was struck and the plan executed unchanged.
- `/cad-verify` recorded 150 passed and 7 failed across 157 items; all seven
  were routed to plan 7 and closed there.

## Verification at HEAD

`TMPDIR=/tmp CARGO_NET_OFFLINE=true RUSTC_WRAPPER= cargo test -p cadence
--no-fail-fast` reports **1160 passed, 0 failed, 0 ignored** across 45 targets.
`RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings` exits 0 with no
diagnostics. Plan 7 added 43 tests, distributed 7/7/8/4/2/5/10 across its seven
tasks. Every commit below verifies under `693AB15F91734B0C`.

## Commits

The evidence record is [plan-1](reports/plan-1.md), [plan-2](reports/plan-2.md),
[plan-3](reports/plan-3.md), [plan-4](reports/plan-4.md),
[plan-5](reports/plan-5.md), [plan-6](reports/plan-6.md) and
[plan-7](reports/plan-7.md).

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | `93e56a9c` | feat(review): define saved records and findings envelope admission |
| 1 | 2 | `adf00344` | feat(review): enforce scalar text and exact line bounds |
| 1 | 3 | `34b80fe2` | feat(review): bound raw return stream acquisition |
| 2 | 1 | `a74a7452` | feat(review): retain typed material and content identity |
| 2 | 2 | `e2c7f822` | feat(review): recover retained bytes and directory membership |
| 2 | 3 | `e9728abb` | feat(review): bind retained diffs to source sides |
| 2 | 4 | `cf6e1600` | feat(review): append retained context and specialist targets |
| 3 | 1 | `bcdc1374` | feat(review): preserve resolved policy across ordinary callers |
| 3 | 2 | `e47ad8ba` | feat(review): separate delivery permission from settlement |
| 3 | 3 | `b5ab9034` | feat(review): stop FIRST selection at the first usable return |
| 3 | 4 | `035a04d8` | feat(review): require every admitted panel slot to finish |
| 3 | - | `f110bb92` | fix(review): collapse nested if flagged by Clippy |
| 3 | 5 | `1ceb3be8` | feat(review): preserve minimalism specialist admission |
| 4 | 1 | `241c5cec` | feat(review): commit pending admission and durable occurrence identity |
| 4 | 2 | `20cd68d1` | feat(review): bind returns to saved attempts and host identity |
| 4 | 3 | `78b82704` | feat(review): persist replay-safe and late host observations |
| 4 | 4 | `27a14437` | feat(review): atomically accept originals and close attempts once |
| 4 | 5 | `81eadadb` | feat(review): recover interrupted attempts and per-voice originals |
| 5 | 1 | `3d019984` | feat(review): recover raw consumer and specialist inputs |
| 5 | 2 | `46f81faa` | feat(review): transport supplied consumer selections |
| 5 | 3 | `6ba2a383` | feat(review): preserve risk consumer inventories |
| 5 | 4 | `c8f07ddd` | feat(review): persist deferred members across all homes |
| 5 | - | `f3a8f533` | fix(review): preserve absent model for session inheritance |
| 6 | 1 | `0af835df` | feat(review): expose native delivery operations and saved inventory |
| 6 | 2 | `e7e9910c` | feat(review): ship retained local dispatch and durable wait contract |
| 6 | 3 | `3cb467cc` | feat(review): route modern pause admission through ordinary delivery |
| 6 | 4 | `a063ab55` | feat(review): expose historical pause origin without promotion |
| 6 | - | `7b52136d` | test(guard): assert binary-owned SubagentStop instead of frozen command parity |
| 7 | 1 | `deef05dd` | fix(review): admit completed execution reviews before continuation |
| 7 | 2 | `0e0c203c` | fix(review): close definite launch failures without invented identity |
| 7 | 3 | `2ff85d38` | fix(review): authorize supporting evidence from saved delivery membership |
| 7 | 4 | `cbc2ad24` | fix(review): consume confirmed risk evidence before ordinary admission |
| 7 | 5 | `1924bfe1` | fix(review): build the minimalism voice independently of ordinary routing |
| 7 | 6 | `42fb7908` | fix(review): retain nested directory file membership and bytes |
| 7 | 7 | `6873ea6b` | fix(review): bound raw returns before transport deserialization |
