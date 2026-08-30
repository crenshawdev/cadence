---
phase: 4
status: complete
completed: 2026-08-30
---

# Phase 4: Land reads rulings, not raw findings - Summary

`land-cleanup.mjs gate` now halts an autonomous close from adjudicated state
through one shared predicate (`lib/filing-decision.mjs`'s `unfixedFromEntries`),
and `/cad-milestone` carries those rulings out of the phase directories it
prunes so the close can still read them.

## What shipped

- The genuinely-unfixed predicate, one definition for filing and for the close -
  `cadence-core/bin/lib/filing-decision.mjs` (`unfixedFromEntries` returning
  `{filing, haltingSurvivors, halting}`, plus `usableFixCommit`), pinned to a
  single home by a `helper-census.test.mjs` row
- The close decision, stating no severity of its own -
  `cadence-core/bin/lib/close-decision.mjs`, with the `unruled-review` fifth
  state and an additive `overridden` envelope key that never moves `action`
- The gate rewired to classify at the seam -
  `cadence-core/bin/land-cleanup.mjs` `gate`, reading `{findings, unruled}` off
  stdin alone, with the v3.7.7 close reproduced as its fixture
- The carry seam that outlives the prune - `cadence-core/bin/planning/risk-carry.mjs`
  (`planning.mjs risk-carry --phase <N>`), copying every
  `REVIEW-risk_surface*.md` and `ADJUDICATION-risk_surface*.json` to
  `.planning/risk-carry/<N>/`
- The prose that wires it - `cadence-core/workflows/milestone.md` (carry before
  prune), `skills/cad-land/SKILL.md` (union the rulings, pair each review with
  its adjudication sibling, clear the carry only on a confirmed merge), and
  `references/risk-surface.md` + `references/triage-gate.md` agreeing with both

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | cdd99a03 | The unfixed predicate reads the fix commit and answers what halts |
| 1 | 2 | 5fe59741 | Issue filing stops re-deciding what is already fixed |
| 1 | 3 | 2ca18f21 | Pin the genuinely-unfixed test to one definition |
| 1 | 4 | 74e2b57f | The two faces still agree, and a fixed override settles clean |
| 1 | fix | 3d8bae48 | The fail-closed rail asks whether the fix commit could be one |
| 2 | 1 | f03d1340 | The close gate halts on a list it was handed, not a severity it reads |
| 2 | 2 | 4f12dc5e | The gate classifies from adjudication entries, not raw findings |
| 2 | 3 | fafda199 | Reproduce the v3.7.7 close as the gate's fixture |
| 2 | 4 | 0c27c2b6 | The gate's header states the adjudicated input it now reads |
| 2 | 4 | 5ff96919 | The config layer arm halts on a ruling, not a raw finding |
| 2 | fix | 0e52963b | A malformed `unruled` halts instead of reading as none |
| 3 | 1 | 74bf90f3 | The rulings get carried out before the prune deletes them |
| 3 | 2 | c16d7254 | Pin the carry set, the rounds, and the two symlinked destinations |
| 3 | 3 | 7984ea96 | The prune deletes the phase and the verdict is unchanged |
| 3 | fix | 1b4f1407 | A symlink at a carried name is refused, not read as already carried |
| 3 | fix | 35dd11a5 | The source side gets the rail the destination already had |
| 4 | 1 | 2f75f5d0 | The close carries the rulings out before the prune deletes them |
| 4 | 2 | 9a787f83 | The unattended gate is fed rulings, and told what nothing ruled |
| 4 | 3 | fc4fc220 | Both references name the ruling as what the close reads |
| 4 | fix | 9018c4af | The halt keeps the rulings it rests on |
| 4 | fix | 4e6f2f3b | State the pairing rule a filename pair can satisfy |
| 4 | fix | c9cf59b3 | The legacy aggregate halts once, with the remedy stated |

## Review gates

Every plan fired `risk_surface` and `diff`, both `blocking` at `critical`
stakes. Five of the eight fires FAILed and were fixed under a capped re-arm;
one range needed a third fire because the `diff` fix widened it past the head
`risk_surface` had cleared. Adjudicated: 16 findings raised, 6 sustained and
fixed, 4 downgraded, 6 refuted. `risk-check status` reads `recorded` for all
four plans at their own ranges. Two findings were filed as issues on
`crenshawdev/cadence` (`close-decision.mjs:91`'s unbounded name, and
`risk-carry.mjs:119`'s EACCES probe); the remaining 8 were filed carrying the
decline label.

## Deviations

- [deviation] Plan 1, task 1: the Action forbade validating the `fix_commit`
  value, reasoning that `lib/adjudication-record.mjs` refuses a malformed one at
  composition time. That premise is false for the one set the constraint
  governs - `halting` is a rail over records that module never saw. The
  `risk_surface` fire found the hole and the fix added the shape check the
  Action forbade, kept to one grammar by pinning it behaviourally against the
  composer (3d8bae48).
- [deviation] Plan 2, task 2: the Action stated `unruled` "absent, or present
  but not an array, reads as `[]`". The `risk_surface` fire ruled that a
  fail-open `high` - a present-but-malformed value carries evidence of a review
  nothing ruled, and reading it as none throws the halt away. Split at the
  seam: absent reads as `[]`, present-and-not-a-list halts (0e52963b).
- [deviation] Plan 2, structural checkpoint: `config-seams.test.mjs` needed a
  lease grant no phase 4 plan declared. Its `BLOCKER` fixture was a raw finding
  with no ruling, so under the new gate it no longer halts. The user approved
  the grant; `PLAN-2.md`'s `files:` was amended and the fixture given
  `"ruling": "survived"`, keeping that arm about the config layer (5ff96919).
- [deviation] Plan 3, task 1: the Verify asked for a `missing-flag-value`
  refusal on a bare `--phase`. The same Action required mirroring
  `deferred carry`, whose door answers `bad-args`. Took the mirror -
  `planning.mjs` deliberately carries one refusal vocabulary.
- [deviation] All four plans reported the suite red against a green `Verify:`.
  Cause found by plan 4 and confirmed here: a stray empty `/tmp/.git` made every
  fixture under `tmpdir()` read as sitting inside an unreadable repository. It
  was removed during this run; the suite is now 3622 of 3622.

## Open items

- `gitDirAbove` (`cadence-core/bin/planning/renumber.mjs:65-76`) asks only
  whether a `.git` entry exists above the fixture, never whether git agrees it
  is usable from there, so any machine or CI runner carrying a stray `/tmp/.git`
  sees 9 red `renumber remove` / `PHS-01` tests with no local cause. Removing
  the directory is the workaround; the probe is the fix. Out of LND-02's scope.
- Something in the suite creates `/tmp/.git` and does not clean it up - it was
  removed once during this run and reappeared before the next dispatch. A test
  writing `.git` at the tmpdir root rather than inside its own fixture.
- The carry copies with a plain loop rather than staging and renaming, so an
  interrupted carry leaves some rulings moved and some not. Accepted: the
  skip-identical rule makes a re-run finish the job, which is the recovery
  staging would have bought.
- Accepted residue: a hand-rolled caller that pipes raw review findings and
  names nothing on `unruled` now gets `proceed` where it used to get `halt`.
  Pinned as a test arm so it is a recorded choice; the only shipped caller moved
  in plan 4.
- `already_fixed` on the issue-filing envelope now reports 0 rather than a live
  count, because the exclusion moved into the predicate. Truthful as a count of
  that face's own removals; widen `unfixedFromEntries` with a fourth array if a
  task ever needs the figure visible at the seam again.
- Two findings were filed as issues and remain open on the tracker:
  `close-decision.mjs:91` (the five-name cap bounds the count, not each name's
  length) and `risk-carry.mjs:119` (the `lstat` probes sit outside any `try`, so
  EACCES throws instead of refusing structurally).

## Goal check

The sum of these commits delivers the goal. The gate's halt now consumes
adjudicated state rather than raw findings: `land-cleanup.mjs`'s `gate` runs
`unfixedFromEntries` over what it is piped and hands `decideGateHalt` the
`halting` list, and `grep -n "'blocker'\|'high'" lib/close-decision.mjs` returns
nothing, so criterion 1's no-second-classifier holds and is proved by the
`helper-census.test.mjs` row that reddens if a second copy of the test body
appears (plan 1 task 3, redden-on-demand exercised). Criterion 3's v3.7.7
reproduction is a real fixture inlined verbatim from `220f99d3`: the actual
entries proceed, and the same array with that one `fix_commit` key removed halts
on that entry alone. Criterion 2 is met by `risk-carry` plus the prose that runs
it before the prune - `milestone.md:110` invokes it and a `prose-agreement`
assertion pins carry-before-prune by file position - and the end-to-end arm
prunes `phases/3/` and rebuilds a byte-identical payload from `risk-carry/3/`
alone. Criteria 4 and 5 are pinned by `land-cleanup.test.mjs` arms covering the
four unreadable states and the `overridden` surfacing. Criterion 6 is met as of
this run: 3622 of 3622 tests pass and `self-verify` reports `ok:true` with 0
problems, though only after removing a stray `/tmp/.git` that is not this
phase's to own and whose underlying probe defect is an open item above. Nothing
in the goal is missing. The one thing a reader should not over-read: the gate is
correct for the caller `/cad-land` now is, and a caller that pipes raw findings
with no `unruled` gets `proceed` where it once got `halt` - deliberate, pinned
by a test, and the only shipped caller was moved in the same phase.
