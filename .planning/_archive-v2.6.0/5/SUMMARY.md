---
phase: 5
status: complete
completed: 2026-08-09
---

# Phase 5: Doc sweep - Summary

547 documentation claims across 25 files verified against the live tree, all 38
unresolved ones closed to `corrected` or `divergence` in a committed ledger the
next cycle diffs against, four genuine code defects filed as `DFC-01..04` rather
than reworded away, and a measured runtime-evidence artifact published under
`docs/` and linked from the README.

## What shipped

- `.planning/DOCS-CLAIMS.md` - the claim ledger, 547 rows
  (`id | doc | line | claim | verdict | resolution`) at the `.planning/` root so
  it survives the milestone close that archives `phases/5/`. Final resolutions:
  509 `accurate`, 19 `corrected - <sha>`, 19 `divergence - <reason>`, zero
  `pending`, zero empty cells.
- `.planning/phases/5/docs-verify-run-1.md` - the sweep record. Three
  invocations over an explicit path list, their strings recorded verbatim; 547
  claims, 509 accurate, 18 stale, 20 unverifiable.
- `.planning/phases/5/docs-verify-run-2.md` - the confirmation pass over the
  ledger's ids (not a second extraction), carrying the delta line
  `run-1 stale 18 -> run-2 stale 0 + 19 divergences`.
- 18 stale claims corrected in place across `README.md`, `METHOD.md`,
  `INTERNALS.md`, `CONTRIBUTING.md` and six `cadence-core/workflows/*.md`, each
  re-checked against its own evidence, with `weight-budgets.json` regenerated
  for the six edited workflow surfaces in the same commit.
- `DFC-01..DFC-04` under `## Deferred` in `.planning/REQUIREMENTS.md` - the
  NUL bytes at `cadence-core/bin/lib/trace.mjs:336`; the `phase_diff` wiring row
  at `references/review-triggers.md:244` that is the source of four of the stale
  rows; `cad-plan-checker-contract`'s five-vs-six self-contradiction; and the
  `risk_surface` wiring row omitting shape (a) for `/cad-task`, the one
  already-committed fire site.
- `docs/EVIDENCE.md` - turn-one bytes for all 23 user-invocable commands
  (279,064 B total), eager-vs-reachable for the ten heaviest, dispatch bytes for
  all 19 rung agents, each table beside the exact `weight.mjs` command that
  regenerates it. Linked from `README.md:38`; `README.md:132`'s v2.3.0 paragraph
  re-anchored as a measurement taken then, pointing here for current figures.
- `skills/cad-land/SKILL.md:44` and `skills/cad-plan-review/SKILL.md:39` both
  moved from `15,376 B` to `17,733 B`, the figure `weight.mjs` reports.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| - | - | 53011b8 | docs-verify run 1 - 547 claims across the 25-file surface (orchestrator) |
| 1 | 1 | 1154790 | publish measured byte figures under `docs/` and re-anchor README's v2.3.0 paragraph |
| 1 | 2 | 3a00092 | transcribe run 1 into the claim ledger - 547 rows |
| 1 | 3 | 2d51c97 | file DFC-01..03 under Deferred |
| 1 | 4 | b2bad1a | correct the eight stale root-doc claims, resolve every root-doc row |
| 1 | 5 | 044806c | correct the ten stale workflow claims and regenerate six budgets |
| 1 | 6 | c0a7326 | one byte figure for `review-triggers.md` in both skills that cite it |
| 1 | 7 | eddf79c | confirmation run over the 547 ledger ids |
| 1 | 8 | 33c1012 | re-measure the evidence artifact after this phase's workflow edits |
| - | - | f8f22cf | close the five factual defects the diff review found, file the sixth as DFC-04 |
| - | - | 6558e0d | resolution tally follows README-50 moving to divergence |
| - | - | 3f2c48e | carry the divergence count through the delta line and its narrative |

## Deviations

- [deviation] Task 2's and Task 7's Verify both name `grep -nE '\|\s*$'` as the
  empty-trailing-cell check; it matches every well-formed markdown row, 549 of
  them. Ran the check the prose describes, `grep -cE '\|\s*\|\s*$'`, which
  returns 0. (3a00092, eddf79c)
- [deviation] Task 7's `grep -c 'pending'` returning 0 is unreachable: 6 of the
  8 hits are claim rows quoting `verify.md`'s own UAT vocabulary
  (`--result pending`, `first_pending`) and 2 are the header sentence explaining
  the placeholder. Used the row-scoped `grep -cE '\| pending \|$'`, which
  returns 0. (eddf79c)
- [deviation] Task 3 expected the sweep to surface code-defect claims; it
  surfaced none. All 18 stale rows are stale PROSE with the code correct, so no
  ledger row took a `divergence - code defect` resolution and the correction
  tasks inherited all 38 unresolved rows. (2d51c97)
- [deviation] Task 3's no-defect branch prescribes writing "no DFC id filed"
  verbatim; the same task mandates the NUL-bytes filing unconditionally, so that
  clause would have been false. The header states the true first clause and then
  names the ids filed and why each is not a sweep finding. (2d51c97)
- [deviation] Two out-of-surface drifts named in run 1's cross-group notes were
  filed as DFC-02 and DFC-03 rather than left as report-only open items. Neither
  file is in the plan's lease, and correcting `review-triggers.md:244` in scope
  would have moved a zero-slack budget and invalidated the 17,733 B figure AC6
  fixes in the same phase. (2d51c97)
- [deviation] Task 4's METHOD `:91` correction moved every `METHOD.md` row below
  it, so the ledger's `line` column is provenance from run 1's sha rather than a
  live address. A header paragraph says so and points at the doc-plus-claim-text
  join rule that exists for this reason. (b2bad1a, corrected in f8f22cf after the
  diff review found the stated offset wrong for 40 of 82 rows)
- [deviation] `planning.mjs detect-commands` returns `typecheck:null` - the repo
  has no `package.json`. Ran `npx tsc -p tsconfig.ci.json` as the static-analysis
  step anyway, since the plan and `CONTRIBUTING.md` both name it as this repo's
  real typecheck; exit 0 before every commit.
- [deviation] The advisory `diff` review returned six findings, all six confirmed
  against the tree, and they were acted on rather than only reported. Five were
  factual errors this phase introduced - a `/cad-trace` command that exists
  nowhere, named in the evidence artifact; a `CONTRIBUTING.md` correction that
  replaced one false dependency claim with another; a 529-vs-509 ledger tally; a
  wrong single line-offset; and `README-50` resolved `corrected` against a commit
  that never touched it. The sixth was a real defect and went to `DFC-04`.
  (f8f22cf, 6558e0d, 3f2c48e)

## Open items

None.

## Goal check

The eleven commits do deliver the goal, and the evidence is checkable rather
than asserted. `.planning/DOCS-CLAIMS.md` holds 547 rows against the run-1
report's 547 claim rows (`572` table lines minus `25` header rows), with zero
resolutions reading `pending` (`grep -cE '\| pending \|$'` returns 0) - so every
claim the sweep raised has a stated disposition, which is DOC-02's whole
requirement. The 18 stale claims were corrected against their own evidence, not
reworded: `METHOD.md:91` now says six dimensions because
`skills/cad-plan-checker-contract/SKILL.md:42` says six, and `config.md`'s
`parallelization.enabled` says `true` because `config.schema.json` ships `true`.
DOC-03 held under pressure - the sweep found four things where the CODE was
wrong or the source-of-truth row was wrong, and all four went to
`## Deferred` as `DFC-01..04` with `planning.mjs audit --dir .planning`
reporting zero `unpicked` breaks, rather than being smoothed into prose. EVD-02
landed as `docs/EVIDENCE.md`, re-measured at task 8 after the workflow edits
moved the very bytes it counts (turn-one total 278,315 -> 279,064), linked twice
from `README.md`; its contingent trace half is closed, not dangling - no
non-Cadence project on this machine has a `trace.jsonl`. All three gates are
green at HEAD: `tests 1455 / pass 1455 / fail 0`, `npx tsc -p tsconfig.ci.json`
exit 0, and `self-verify --root .` `"problems":[]`.

Two things are named honestly rather than claimed. First, the phase introduced
five factual errors of its own and the advisory diff review is what caught them
- including a `/cad-trace` command that exists nowhere in the tree, shipped in
the artifact built to be the trustworthy one, on a `docs/` surface D-07 chose
precisely because no linter walks it. They are fixed in `f8f22cf`, but the
lesson stands: the one new surface this phase added is the one surface with no
mechanical check behind it, and nothing but a review would have caught it.
Second, AC3's delta is honest but weaker than it reads - `run-2 stale 0` means
every stale row was re-checked against the tree and its correction confirmed, not
that an independent second extraction found less drift. That is what D-03 chose
deliberately, and the run-2 record says so in its own words.
