---
phase: 3
status: complete
completed: 2026-08-20
---

# Phase 3: The machinery that still assumes one report - Summary

The risk gate now tells an EMPTY committed range from an unjudged one and reads
that range through a diff no git config can silence, and `lease-check`'s report
exemption is a grammar over the rotated sibling instead of a byte compare
against `plan-<k>.md`.

## What shipped

- `scanDiff`'s two-state split - a non-string body stays `checked:false,
  inconclusive:true`; a string body that trims to nothing is `checked:true,
  inconclusive:false, matches:[], empty:true` - `cadence-core/bin/lib/risk-diff.mjs:305`
- `empty` on every `scanDiff` return and on the trace record, so its ABSENCE
  marks a pre-split record rather than a fresh honest `false`
- `risk-check status` admits the empty record through the existing `recorded`
  arm, with no new state string and no new predicate clause - `cadence-core/bin/planning.mjs`
- The risk range is read with `--no-ext-diff --no-textconv`, so a `diff=<driver>`
  attribute cannot present a risky range as an empty one - `cadence-core/bin/planning.mjs:3982`
- `rotatedSource(k)` and `isReportName(k, name)`, the rotated-report name test
  stated once - `cadence-core/bin/lib/report-rotation.mjs`
- `lease-check`'s report exemption widened to `<pdir>/reports/plan-<k>.<n>.md`,
  still refusing `plan-<k>-risk.diff`, `plan-<k>-risk-task-<n>.diff`, another
  plan's report, a case variant and a nested path - `cadence-core/bin/planning.mjs`
- A `HELPERS` census row keyed on the pattern SOURCE, so a second spelling of
  the rotated-report grammar fails the census - `cadence-core/bin/helper-census.test.mjs`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 25b9719 | Record an empty diff body as a completed EMPTY check |
| 1 | 2 | b5e9c15 | Admit the empty record at `risk-check status` through the `recorded` arm |
| 1 | 3 | 37fd169 | State the rotated-report name test once, in the rotation module |
| 1 | 4 | 3ee5898 | Widen `lease-check`'s report exemption to the rotated sibling |
| 1 | 5 | 31c2085 | Pin the one-statement rule with a helper-census row |
| 1 | gate | f5efcb4 | Read the risk range with `--no-ext-diff --no-textconv` (`risk_surface` survivor) |

## Deviations

- [deviation] Task 5's Verify asserts `node cadence-core/bin/test.mjs other`
  passes. It does not: `milestone-prune.test.mjs:557` `corpus: pruning this
  repository's own REQUIREMENTS.md needs no hand repair` fails because the live
  ROADMAP names completed phases while `.planning/REQUIREMENTS.md`'s `## Active`
  reads "No cycle open", so `archiveRequirements` moves nothing and the row's
  `moved.length > 0` assertion fires. Proven pre-existing rather than caused
  here: `git diff dc4c4b1..HEAD --name-only` lists only the seven files this
  plan declares, so the row's code and both its inputs are byte-identical to the
  phase's base commit. It is CONTEXT's fourth flagged assumption - no requirement
  id seeded for v3.5.6 - which CONTEXT deliberately left uncorrected, and
  `REQUIREMENTS.md` is outside this plan's lease. The full suite is 2464/2465
  with this as the only failure.
- [deviation] The `risk_surface` gate FAILED on the plan's committed range with
  one `high` finding from the `openai` voice: the empty arm task 1 added treats
  any whitespace-only body as a completed empty range, and a `diff=<driver>`
  attribute in a checked-in `.gitattributes` binds to a `diff.<driver>.command`
  or `.textconv` in the READER's own git config, so `git diff <base> <head> --`
  can emit zero bytes for a range that changed a file. Confirmed empirically
  before ruling: in a scratch repo with `f.txt diff=silent` and
  `diff.silent.command=/bin/true`, that command emitted 0 bytes across a commit
  whose changed line was a recursive delete, and `--no-ext-diff` emitted 109.
  Ruled `survived` at `high` - no attacker is needed, since a `textconv` for pdf
  or docx in a developer's own `~/.gitconfig` produces the same silent clear on
  the one trigger that blocks at every stakes level. Fixed in `f5efcb4` with a
  regression row in `risk-diff.test.mjs` that reddens when either flag is
  removed. The capped narrowed re-arm (round 2, `31c2085..f5efcb4`) returned
  zero findings; `gate_pass` recorded, `risk-check status` is `ok:true`.
- [deviation] `ADJUDICATION-risk_surface-plan-1.json` names `fix_commit
  95ba7b2`, a sha that no longer resolves: that commit was amended to `f5efcb4`
  to drop a literal from a comment that the destructive detector matched, and
  the adjudication seam correctly refuses to overwrite a round-1 record. The
  ruling and its finding are otherwise accurate; read `f5efcb4` wherever the
  record says `95ba7b2`.

## Open items

- The pre-existing `milestone-prune.test.mjs:557` corpus failure needs
  `.planning/REQUIREMENTS.md`'s `## Active` to carry this cycle's rows, or the
  row to skip on that state the way its own header already does for the
  between-milestones case. It keeps `test.mjs` and `test.mjs other` red until
  then.
- Observed once in six runs of `planning.test.mjs`: `renumber remove: cuts line
  + detail, orphans reqs, shifts down, reports prose refs` failed in a single
  run and passed in the five others, including two under a mutated tree. A flaky
  row unrelated to this range, not reproduced.
- AC3 is unverified here by design: it needs a live `/cad-execute <N> --rerun`,
  which an executor cannot make, and its transcription belongs in
  `.planning/phases/3/UAT.md` at `/cad-verify` (D-11).
- `cadence-core/workflows/execute.md` writes the `risk_surface` payload with a
  bare `git diff {pre-plan HEAD}..HEAD`, which the same diff-driver mechanism
  can silence. The payload composer fails closed on an empty artifact
  (`scratch-unreadable`), so this is a stall rather than a false clear, but the
  workflow's own read should carry `--no-ext-diff --no-textconv` too. Outside
  this plan's `files:` lease.

## Goal check

The commits deliver the goal. The deadlock half is closed at both ends: a range
whose diff body trims to nothing now answers `checked:true, inconclusive:false,
matches:[], empty:true` rather than the old `checked:false` that `risk-check
status` filtered on before its fire predicate ran (`risk-diff.mjs:305`, 74/74 in
`risk-diff.test.mjs`, and the end-to-end row drives the seam rather than writing
the record by hand), while a body that could not be READ keeps `checked:false,
inconclusive:true` and a range that contains commits but cannot be judged stays
`inconclusive:true` and still fires. Emptiness is decided from the BODY and never
from `base_id === head_id`, so a revert pair with two distinct ids and a zero net
diff takes the empty arm too. The exemption half is closed as a grammar rather
than a name list: `isReportName(k, name)` is stated once in
`lib/report-rotation.mjs` and imported by `lease-check`, the census row fails if
it is spelled twice, and `planning.test.mjs` is 427/427 with rows for
`plan-1.1.md` and `plan-1.12.md` admitted beside `plan-1.md` and for
`plan-2.md`, `plan-11.md`, both risk diffs, `PLAN-1.1.MD` and a nested
`old/plan-1.1.md` refused. What the phase did NOT close by itself: the
`risk_surface` gate found that the new empty arm was only as honest as the read
feeding it, and `f5efcb4` closes that with `--no-ext-diff --no-textconv` plus a
regression row that reddens on removal of either flag. AC3 is the one acceptance
criterion no commit here can evidence - a live `--rerun` is human-verify and
belongs to `/cad-verify` - and the full suite is 2464/2465, the single failure
being the pre-existing corpus row named above, whose code and inputs are
byte-identical to `dc4c4b1`.
