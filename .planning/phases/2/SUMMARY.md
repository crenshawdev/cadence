---
phase: 2
status: complete
completed: 2026-09-02
---

# Phase 2: A receipt can name its home and its authorization - Summary

Settlement receipts gained two structured flags and the record gained a task
home: `--anchor` names the window a receipt settles, `--authorization-id` names
the human answer it descends from, and `planning.mjs adjudication` writes a
task's record beside its own artifacts instead of into a `phases/0/` that does
not exist.

## What shipped

- A task fire's record names the slug it settles - `task` on the record body,
  `--task <slug>` required at `--phase 0` and refused beside a real phase
  (`cadence-core/bin/planning/adjudication.mjs`)
- The one hand-written settlement replaced by a record the seam produced
  (`.planning/tasks/declines-off-the-tracker/`)
- A task settlement's counts are recounted rather than trusted - the home
  resolver walks every real directory under `tasks/` and answers `''` on two
  matching records (`cadence-core/bin/planning/trace.mjs`)
- `--anchor` on `trace append`: the earlier window's own SHA, derived through
  `correlationId` so a receipt can only name a window of the phase it declares
  (`cadence-core/bin/lib/arg-contract.mjs`, `cadence-core/bin/planning/trace.mjs`)
- `--authorization-id` on `trace append`: the coordinator-minted id of the human
  answer, so one authorization over two ranges is two receipts that say so
- `/cad-suggest` rule R9 counts DECISIONS rather than override writes, grouped
  on the structured trigger field (`cadence-core/bin/lib/trace-suggest.mjs`)

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 28c0819c | The record body names the task it settles |
| 1 | 2 | 346c9743 | The one hand-written settlement is a record the seam produced |
| 1 | 3 | b8e7e374 | `--task` beside a real phase is refused, not filed under the slug |
| 1 | 4 | c59e0e26 | A task settlement's counts are recounted, not taken on trust |
| 2 | 1 | c170ab34 | A receipt can name the window it settles |
| 2 | 2 | 9101440d | An override receipt names the authorization it descends from |
| 2 | 3 | 6406b3ff | Pin that an authorization id labels a pair and never widens a settle |
| 2 | repair | 04655c44 | Keep the trace.mjs import on one line so a pinned citation holds |
| 3 | 1 | 9241b17c | `/cad-suggest` counts decisions rather than override writes |
| 3 | 2 | none | Gate task - suite, typecheck and self-verify over the whole tree |

## Deviations

None - plans executed as written.

## Open items

- No lint step ran on any task. `workflow.lint_command` is unset and
  `detect-commands` reports `lint: null`, so there is no lint command Cadence
  can find for this project. Typecheck resolved and ran on every task.
- Plan 1 declined a slug-carrying flag on the `trace append` receipt. The task
  home is resolved from `--phase 0` alone and the four live `gate_pass` receipts
  carry no slug, so the walk over `tasks/` meets it. Add the flag when a
  repository holds two task records the head SHA cannot tell apart.
- Two review findings were confirmed and not fixed, both declined to
  `.planning/DECLINED.md` rather than the tracker. Plan 2's: `--anchor` accepts
  any non-blank string, so a malformed value produces a correlation id that
  joins nothing. It is visible rather than corrupt - `risk-check status` reports
  the range unfired - and `--sha` on `phase_start`, which every ordinary run's
  id derives from, carries the identical latitude, so validating one and not the
  other would refuse the derived spelling while accepting its source. Plan 3's
  was refuted outright.

## Goal check

The phase goal is a settlement written through the seam instead of by hand, and
one human answer distinguishable from two. Both halves are delivered. The
hand-written half is gone: `.planning/tasks/declines-off-the-tracker/` now holds
a record the seam produced (346c9743), and the refusal that made a hand-append
necessary is closed in both directions - `--task <slug>` is required at
`--phase 0` and refused beside a real phase (b8e7e374), with the counts
recounted against the record rather than accepted from the caller (c59e0e26).
The authorization half is `--authorization-id` (9101440d), declared on the
`trace append` row at `cadence-core/bin/lib/arg-contract.mjs:993` and stored as
a trimmed join key, with 6406b3ff pinning the property that matters: an id
shared across two disjoint ranges LABELS the pair and does not settle the second
one, so `risk-check status` still answers `unfired` until that range carries its
own receipt. `--anchor` (c170ab34, contract row at line 992) closes the other
half of GH-227 - a settlement written after a phase re-anchored can now name the
window it belongs to. What is NOT in this phase: nothing validates that an
anchor is well-formed or that the window it names exists, which is the stated
accepted cost under D-01 and the open item above. The three gates are green over
the whole tree: 3723 pass / 0 fail, `npx tsc -p tsconfig.ci.json` exit 0, and
`self-verify` `ok:true` with an empty `problems` list.
