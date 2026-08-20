---
phase: 2
status: complete
completed: 2026-08-20
---

# Phase 2: The adjudication record nobody can recount - Summary

A gate fire now writes `ADJUDICATION-<trigger>-<discriminator>.json` beside its
sibling REVIEW file - one entry per finding raised per raising voice, verbatim
claim and failure scenario, full 40-character `base_id`/`head_id`, citations
grounded at the head commit - and the settle receipt's survivor count is
recounted against those rulings before it is allowed onto the trace.

## What shipped

- The record grammar as a pure classifier - `cadence-core/bin/lib/adjudication-record.mjs`
  (`buildEntries`, `deriveCounts`, `RULINGS` with deliberately no fourth value,
  convergence derived per distinct voice and never collapsed)
- The validating write seam - `planning.mjs adjudication`, which resolves the
  range to 40-char ids, refuses a paraphrased ruling, refuses an existing
  record rather than overwriting it, and grounds every citation with
  `git cat-file -e <head_id>:<file>`
- The recount - `trace append`'s `--survivors`/`--downgraded`/`--refuted`, each
  cross-checked by `recountReceipt` against the record's own rulings, refusing
  `count-disagreement` or `bad-record` and appending nothing
- The record obligation in prose - `references/review-triggers.md` step 5 (rule
  per voice, THEN merge) and `references/triage-gate.md`'s blocking arm
- The render rule - `workflows/report.md`'s Gates line counts the record rather
  than narrating a figure, names a disagreement, and reads a fire with no
  record as `unrecorded`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 0387268 | State the record's grammar as a pure module |
| 1 | 2 | 563027c | Add the validating seam that writes the record |
| 1 | 3 | 6bf8760 | Ground every citation at the head commit |
| 1 | 4 | 3212db3 | Rule per voice, then merge, so attribution survives |
| 1 | 5 | b610021 | Make step 5 write the record |
| 1 | 6 | 7028a81 | Put the same obligation on the blocking arm |
| 2 | 1 | 697743f | Give `trace append` the three structured count flags |
| 2 | 2 | d1d6e0a | Make the settle receipts carry the derived counts |
| 2 | 3 | d3a1494 | Render the Gates line from the record |
| 2 | 4 | b4d00eb | Pin the recount and the render rule with tests |
| 2 | gate | 9d10919 | Refuse a symlinked record on the no-plan resolver arm |

## Deviations

- [deviation] Plan 1 task 2's `Verify:` named `arg-contract-adoption.test.mjs`,
  but the row's arrival reddens `cadence-core/bin/arg-contract.test.mjs:297`,
  which pins the whole-table entry count as a literal - and that file was in
  neither plan's `files:` lease. Raised as a structural checkpoint, the user
  approved widening both leases, and the literal moved 145 -> 152 (plan 1) ->
  156 (plan 2). The lease, a locked and gate-proved declaration, was wrong as
  written.
- [deviation] `9d10919` is a gate fix, not a plan task: the `risk_surface` fire
  on plan 2's range raised a medium the adjudication showed was real, and the
  record's schema has no ruling for a survivor left unfixed - `survived`
  requires a `fix_commit`. The user chose the fix over deferring it.

## Open items

- AC5's human-verify half is now partly met by this run's own two live
  cross-model fires, but the auditor walk - `git checkout <head_id>`, open the
  cited `file:line` - has not been performed by a human.
- AC6's render half is unexercised: no `/cad-report 2` run has rendered a Gates
  line from a record, and no `/cad-report 1` has shown a pre-format phase as
  `unrecorded`.
- Plan 1's `gate_pass` receipt carries no counts - the three flags did not exist
  until plan 2 - so that fire reads as uncounted while its record holds one
  ruling. The trace is append-only, so it stays that way.
- `lib/trace-suggest.mjs`'s `parseAdjudication` still reads survivors out of
  `--detail` and ignores the three structured counts. CONTEXT's D-03 puts that
  reader out of scope.
- `groundCitations`' `checked: false` arm is implemented and untested - reaching
  it needs git or the repository to vanish mid-walk, which the harness cannot
  stage in-process.
- PRE-EXISTING: `cadence-core/bin/milestone-prune.test.mjs:557` is the one
  failure in the full suite (2451 pass / 1 fail) - the roadmap names a completed
  phase while `.planning/REQUIREMENTS.md`'s `## Active` still reads "No cycle
  open". CONTEXT's fourth flagged assumption, deliberately uncorrected. No file
  this phase touched is read by that test.

## Goal check

The commits plausibly deliver the goal, and the strongest evidence is that the
phase's own gates ran on it. Two live `risk_surface` fires against
`openai/gpt-5.6-terra` left `.planning/phases/2/ADJUDICATION-risk_surface-plan-1.json`
and `-plan-2.json`, each carrying `base_id`/`head_id` at full 40 characters
(`7028a81b...` / `b4d00ebb...` on plan 2) from a 7-char base and a literal
`HEAD` on the command line, one entry per finding raised with the reviewer's own
claim and failure scenario stored byte-for-byte, and `citations: {checked: true,
missing: 0}` - so the refuted `high` on plan 2 can be audited by checking out
`b4d00ebb` and opening `cadence-core/bin/planning.mjs:4705` against the
counter-evidence at `cadence-core/bin/lib/adjudication-record.mjs:156`, which is
exactly the walk the goal names. The recount is live rather than asserted: the
plan-2 `gate_pass` was appended with `--survivors 1 --downgraded 0 --refuted 1`
and `recountReceipt` re-derived those three from the stored rulings before
allowing the append, and `risk-check status` now answers `state: "recorded"` for
both plans. What is NOT proven from here: no `/cad-report` run has rendered a
Gates line off a record, so the render half of the claim is tested only by
`prose-agreement.test.mjs`'s reading of `workflows/report.md` and not by a live
render; and `trace-suggest` still parses survivors out of `--detail`, so one
reader in the tree continues to trust the prose the phase set out to replace.
