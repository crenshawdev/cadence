---
phase: 1
plan: 4
requirements:
  - DOC-05
files:
  - README.md
  - skills/cad-progress/SKILL.md
  - skills/cad-pause/SKILL.md
  - cadence-core/references/COMMANDS.md
  - cadence-core/workflows/progress.md
  - cadence-core/bin/weight-budgets.json
  - .planning/DOCS-CLAIMS.md
---

# Phase 1: The next step it names is one you can take - Plan 4

# SEQUENTIAL: run last, after PLAN-3

## Goal

Every shipped Cadence document describes `/cad-progress` as what it is - a
command that finds incomplete or paused work and OFFERS to resume it - instead
of promising an auto-resume the code deliberately refuses.

## Must be true when done

- No shipped Cadence surface claims `/cad-progress` auto-resumes anything.
- All five sites - `README.md`, `skills/cad-progress/SKILL.md`,
  `cadence-core/workflows/progress.md`, `cadence-core/references/COMMANDS.md`
  and `skills/cad-pause/SKILL.md` - say the command finds incomplete or paused
  work and offers to resume it.
- No behaviour changed: no new flag, no routing change.
- `.planning/DOCS-CLAIMS.md`'s `README-32` row carries the live line and a
  resolution recording the correction, so the next `/cad-docs-verify` sweep
  cannot re-bless the claim this plan removes.
- `node cadence-core/bin/self-verify.mjs` reports no `budget-overrun`.

## Context

CONTEXT.md D-11 (all five sites, not the three the roadmap names), D-12 (the
byte pins are several rows, not one) and D-13 (the claim ledger) bind this
plan. Run it LAST: it shares `cadence-core/workflows/progress.md` and
`cadence-core/bin/weight-budgets.json` with PLAN-3 and
`cadence-core/bin/weight-budgets.json` with PLAN-1, so it must measure a
`progress.md` that already carries PLAN-3's route row.

`cadence-core/workflows/progress.md`, `skills/cad-progress/SKILL.md` (1129 B),
`skills/cad-pause/SKILL.md` (2155 B) and `cadence-core/references/COMMANDS.md`
(5393 B) are all weighed surfaces on `lib/surface-weight.mjs`'s walk and their
budget rows are ceilings pinned at their current sizes. `README.md` is NOT on
that walk and takes no pin.

Out of scope: a real `--resume` flag, which CONTEXT names as a separate
decision and not this phase.

## Tasks

### Task 1: Restate the five auto-resume claims as the offer the command makes

- **Files:** README.md, skills/cad-progress/SKILL.md,
  skills/cad-pause/SKILL.md, cadence-core/references/COMMANDS.md,
  cadence-core/workflows/progress.md, cadence-core/bin/weight-budgets.json,
  .planning/DOCS-CLAIMS.md
  (anchors: the `/cad-progress tells you where you stand` sentence in
  `README.md`; the frontmatter `description` field in
  `skills/cad-progress/SKILL.md`; the `<purpose>` block in
  `cadence-core/workflows/progress.md`; the `/cad-progress` row of the command
  table in `cadence-core/references/COMMANDS.md`; the `<objective>` block in
  `skills/cad-pause/SKILL.md`; the `README-32` row in
  `.planning/DOCS-CLAIMS.md`)
- **Action:** Rewrite each of the five sentences so it describes an OFFER:
  `/cad-progress` finds incomplete or paused work and offers to resume it. That
  is what the workflow actually does - its `route` step makes exactly one
  suggestion through the ask-user seam and its `handoff` step invokes nothing
  unless the user accepts - and it is the half the current wording gets wrong,
  since the routing is derived automatically while the invocation deliberately
  is not. Change NO behaviour: no `--resume` flag, no routing change, no edit
  to any step body. Fix all FIVE, not the three the roadmap names: fixing three
  would leave `cad-pause`'s description, which rides every session's prompt,
  saying what the corrected `cad-progress` description denies, and
  `COMMANDS.md` is the text `/cad-help` prints (D-11). Leave
  `skills/cad-progress/SKILL.md`'s `<objective>` sentence "Detects incomplete
  or paused work and offers to resume at the right step" exactly as it is - it
  already says the right thing, and the defect is the frontmatter `description`
  above it. Both frontmatter `description` fields must keep the routing trigger
  words they already carry, "resume" among them: those descriptions were cut to
  one routing line each with zero trigger words dropped, and this is a wording
  fix, not a second cut. Restate the `README.md` sentence IN PLACE rather than
  deleting its line, so the line numbers the other `README` rows in
  `.planning/DOCS-CLAIMS.md` carry do not shift. Then correct that ledger's
  `README-32` row, which today records the claim at `README.md` line 34 with
  verdict and resolution both `accurate`, so the next `/cad-docs-verify` sweep
  would re-bless exactly the claim this task removes (D-13). Follow the
  ledger's own stated convention for a row whose claim TEXT was invalidated
  rather than merely moved: rewrite the claim cell to what the live file now
  states, re-pin the `line` cell to where it states it, set the verdict to
  `stale`, and write the resolution as a `corrected - ...` entry naming this
  milestone and phase in the form the `README-85` row already uses. The ledger
  joins on `doc` plus claim text, so a silently rewritten claim would join to
  nothing next sweep and report as a brand-new extraction where a fix happened.
  Do not re-pin or re-verdict any other `README` row - D-13 scopes this to
  `README-32`. Finally re-pin the four weighed surfaces in
  `weight-budgets.json` - `cadence-core/workflows/progress.md`,
  `skills/cad-progress/SKILL.md`, `skills/cad-pause/SKILL.md` and
  `cadence-core/references/COMMANDS.md` - to their new `wc -c` byte counts in
  this same commit, since those rows are ceilings pinned at the current sizes
  and a longer sentence overruns. `README.md` is not a weighed surface and gets
  no row.
- **Verify:** `grep -rn -iE 'auto[- ]?resum|automatic(ally)? resum|resumes automatically'
  README.md skills cadence-core .planning/DOCS-CLAIMS.md` prints
  nothing - the pattern is a stem rather than three literal spellings, because
  the `plan` review found that a paraphrase such as "automatically resumes"
  survived the literal list while every other check here still passed;
  `grep -n -i 'offers\? to resume' README.md skills/cad-progress/SKILL.md
  skills/cad-pause/SKILL.md cadence-core/references/COMMANDS.md
  cadence-core/workflows/progress.md` prints a match in each of the five files;
  `grep -n 'README-32' .planning/DOCS-CLAIMS.md` shows the row's line cell
  matching the line `grep -n` finds the restated sentence on in `README.md`,
  with a `stale` verdict and a `corrected` resolution;
  `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`;
  `node cadence-core/bin/test.mjs` reports 0 failures.

## Notes

**Requirements.** This plan declares `DOC-05` - "the shipped auto-resume claims
describe what the command does" (`GH-218`), widened by D-11 from three sites to
five. The id was minted into `REQUIREMENTS.md`'s `## Active` at plan time, after
the `plan` review raised as a blocker that the ROADMAP success criterion
"`GH-233`, `GH-232` and `GH-218` each trace to a REQUIREMENTS row pointing at
Phase 1" was served by no task in any of these plans. This task edits
`REQUIREMENTS.md` not at all - the doc sites it corrects are the five named in
its Action, and `REQUIREMENTS.md` is not one of them.

**One task, seven files, on purpose.** Every edit here is the same one-sentence
correction plus the pins and the ledger row that D-13 requires in the same
commit; splitting them would put a ledger row in a different commit from the
prose it records, which is the drift the ledger exists to prevent.

**Numbered 4, not 3.** This plan was PLAN-3 until the seam plan overran the
declared-bytes ceiling and split into PLAN-2 (the seam) and PLAN-3 (the
workflow prose). It is renumbered so sequential order still reads in number
order; nothing about its scope changed.
