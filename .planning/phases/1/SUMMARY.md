---
phase: 1
status: complete
completed: 2026-08-25
---

# Phase 1: Cold-split the eager references - Summary

`references/seams.md` (25,068 B) and `references/review-triggers.md` (40,413 B)
are now routers of 2,323 B and 20,153 B over six cold branch files, with a
`self-verify` check that reddens when a branch loses its cold file or its Read.

## What shipped

- Seam router plus one cold file per seam - `cadence-core/references/seams.md`
  (2,323 B) over `seam-ask-user.md` (1,902), `seam-spawn-agent.md` (19,863) and
  `seam-review-provider.md` (3,095)
- Review-subsystem router plus three cold branches -
  `cadence-core/references/review-triggers.md` (20,153 B) over
  `risk-surface.md` (9,188), `review-cross-model.md` (9,383) and
  `review-record.md` (5,977)
- The branch register and its check - `cadence-core/bin/lib/reference-routers.mjs`,
  wired as self-verify check `reference-routers`, with a `CADENCE-CENSUS` row
  pinning the seven register rows
- 42 re-pointed citations across 18 surfaces, so no prose surface cites the
  seam family where it means one seam
- Sixteen re-pinned rows in `cadence-core/bin/weight-budgets.json`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | eefdf70f | Split `seams.md` into a router plus one cold file per seam |
| 1 | 2 | 73e573c7 | Pin every router branch with a self-verify check and a census row |
| 1 | 3 | 0b83858f | Re-point every `seams.md` citation at the file that holds the rule |
| 1 | 4 | 9fa39dc4 | Cold-split the `risk_surface` trigger contract out of `review-triggers.md` |
| 1 | 5 | 3124ae9b | Cold-split the cross-model reviewer arm out of step 4 |
| 1 | 6 | df67210d | Cold-split the outcome record out of step 5 |
| 1 | gate | caa07bfb | `risk_surface` round-1 fix: read the router's prose, not its fences, when checking a branch's Read |

## Deviations

- [deviation] Task 1. The Action named four `prose-agreement.test.mjs` reads that
  resolve to nothing after the move; there are five. IVW-01's `section(doc(...
  'seams.md'), '## Seam: ask-user', ...)` is the fifth and followed the seam into
  `seam-ask-user.md`. Re-pointed with the other four. (eefdf70f)
- [deviation] Task 2. The Action assumed `review-triggers.md`'s triage-gate branch
  already carried a `${CLAUDE_PLUGIN_ROOT}` path after task 1. All five triage-gate
  citations were bare `references/triage-gate.md`. Step 6's RE-READ sentence now
  spells the plugin-root path as the branch's own Read; the other four stay bare
  prose citations. +35 B, so that file's budget was re-pinned in the same commit.
  (73e573c7)
- [deviation] Task 2. The Action named `cadence-core/references/` as the census
  row's subjects; that directory lease trips the half-the-plans rail
  `planning-lease-check.test.mjs` asserts (21 of 37 plans refused on replay).
  Narrowed to `cadence-core/bin/lib/reference-routers.mjs`, the file both census
  numbers are read off. (73e573c7)
- [deviation] Task 4. The Action named one `## risk_surface detection` read in
  `prose-agreement.test.mjs`; there are three. All re-pointed at
  `references/risk-surface.md`. (9fa39dc4)
- [deviation] Task 6. The Action did not name `prose-agreement.test.mjs`, but
  GAT-04's fenced-receipt scan reads `review-triggers.md` for the `adjudication`
  receipt command, which moved. That test's file list followed it to
  `review-record.md`. (df67210d)
- [deviation] Task 6 / the plan's Notes. The Note predicted a ~17 KB router; as
  first written it measured 21,295 B, over criterion 3's 20,206 line, because the
  Note's arithmetic subtracts the moved regions and adds nothing back for the
  branch decisions and the discriminator grammar the criterion requires HOT. It
  came under at 20,153 only after dropping four things from the router that a cold
  file already states verbatim. 53 bytes of margin. (df67210d)
- [deviation] Gate. The `risk_surface` fire on the committed range raised one
  `high` finding against `lib/reference-routers.mjs`: arm 2 tested the raw router
  text where arm 3 read prose only, so a cold path appearing solely inside a fenced
  example satisfied the Read check. Confirmed against the code, fixed, and the
  narrowed re-arm round came back clean. (caa07bfb)

## Open items

- Comments under `cadence-core/bin/` still cite `references/seams.md` for prose
  that moved: `lib/surface-scan.mjs:251-255`, `lib/route-relay.mjs:9,31,41`,
  `lib/deferred-reads.mjs:37,102`, `lib/dispatch-phrasing.mjs:79`,
  `lib/window-budget.mjs:16`, `planning/core.mjs:368`, `review-provider.mjs:5,189,196`,
  plus five `config.schema.json` `max_dispatch_tokens` purposes. Task 3's lease
  stopped at `workflows`, `references`, `skills`, `agents`, `METHOD.md` and
  `DESIGN.md`. Each still lands on a router that indexes where the rule went.
- Five weight-budget rows are pinned ABOVE their live size by prose edits predating
  this plan: `workflows/debug.md` 6920/6911, `skills/cad-capture/SKILL.md` 5850/5751,
  `skills/cad-executor-contract/SKILL.md` 12970/12811, `skills/cad-plan-review/SKILL.md`
  2353/2343, `skills/cad-verifier-contract/SKILL.md` 10805/10792. The check is a
  ceiling, so nothing reddens.
- No prose surface now cites `references/seams.md` at all - every citation named a
  specific seam. The router is reachable by name and held honest by the register,
  but nothing points a reader at it. Whether the seam FAMILY deserves a citation
  (`references/conventions.md`'s `## Subagents and reviews` is the obvious host) is
  a call for the human.
- `weight.mjs resident` reports all six new references as `zeroResident`: a file
  cited only by another reference does not count as reached. Pre-existing behaviour,
  unchanged by this phase.
- `review-triggers.md` has 53 bytes of margin under criterion 3's line. The next
  sentence added to that router breaks the budget check.

## Goal check

The six commits deliver the goal. The split is measured, not asserted: `wc -c`
puts `seams.md` at 2,323 B against 25,068 before and `review-triggers.md` at
20,153 against 40,413, with the removed prose living in six cold files
(`seam-ask-user.md` 1,902, `seam-spawn-agent.md` 19,863, `seam-review-provider.md`
3,095, `risk-surface.md` 9,188, `review-cross-model.md` 9,383, `review-record.md`
5,977). The branch decision is unambiguous at both entrypoints - `seams.md`'s
`## The three seams` names each seam and the one file it Reads, and
`review-triggers.md` ends on a `TWO ways in, one file` sentence for
`risk-surface.md` - which criterion 1 asks for. Criteria 4 and 6 are one
mechanism: `cadence-core/bin/lib/reference-routers.mjs:96-133` holds seven
register rows and `self-verify.mjs` reports `reference-routers` in its `checked`
list with `problems: []`, and the executor observed both negative arms live
(`reference-router-missing-cold`, `reference-router-branch-unread`). That check
is also what this phase's own blocking gate found a hole in: arm 2 read the raw
router text while arm 3 read prose only, so a cold path inside a fenced example
satisfied it - fixed at caa07bfb with a test that fails on the old code, and the
full suite is 3287 pass / 0 fail / 1 skip. What the criteria do NOT establish:
criterion 2 ("no caller loads a branch it did not select") is a property of the
prose that no check enforces, since nothing measures what a running command
actually opened - `weight.mjs resident` reports all six cold files
`zeroResident`, which is the same silence for a correctly deferred file and an
unreachable one. Criterion 3's "no safety rule lives solely in a cold file" is
likewise a reading, though the two named cases hold: the one-round re-arm cap is
stated in `triage-gate.md` and `review-triggers.md` step 6 orders a RE-READ of it
before ANY gate including `blocking`, and this run obeyed that path.
