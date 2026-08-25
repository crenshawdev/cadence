---
phase: 4
status: complete
completed: 2026-08-25
---

# Phase 4: One spelling, one phase - Summary

The phase-directory grammar now rejects a zero-padded fraction, 21 `--phase`
callsites refuse a spelling that would normalize onto a different phase's
directory on that tree, and the grammar is stated once in
`references/roadmap-phases.md` instead of five paraphrases.

## What shipped

- `PHASE_DIR_NAME`, tightened to `/^[1-9]\d*(?:\.[1-9]\d*)?$/` and moved to
  one home - `cadence-core/bin/planning/core.mjs:107`. `1.00`, `1.01` and `2.0`
  are drift; `1.1`, `1.10` and `8` stay legal.
- `phaseSpellingCollision(dir, parsed)` - `planning/core.mjs:139`, wired into
  `fireIdentity` ahead of the token rails, so the refusal reaches every face
  that resolves `--phase` to a path rather than each one wiring it by hand.
- The refusal itself, at 21 census-pinned callsites: `criteria-size`,
  `plan-size`, `plan-overlap`, `cite-count`, `lease-check`, `uat`,
  `deferred-carry`, `deferred-list` and `trace`'s shared append/close body.
  `capture` carries D-08's exemption as a comment rather than a silent gap.
- `phase-dir-collision` drift - `planning/status.mjs`. Two names that are BOTH
  legal and parse to one number are reported rather than resolved.
- `phase-spelling.test.mjs` - 37 arms plus a `CALLSITES` census (21 callsites,
  10 tree-aware, 2 unconditional, 9 exempt) registered as
  `phase-spelling-callsites`, so an unguarded path-resolving callsite fails the
  suite naming itself.
- `references/roadmap-phases.md` `## The phase directory` - the whole grammar
  and the `2.0` decision in one place; four paraphrases retired to pointers.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 687bcebc | The phase-directory grammar rejects a zero-padded fraction |
| 1 | 2 | b44febf6 | The two `phases/` listing filters read that grammar |
| 1 | 3 | 3975d813 | A tree-aware spelling check, wired at the shared fire identity |
| 1 | 4 | d46bdacf | The six phase-artifact readers refuse a colliding spelling |
| 1 | 4b | 049b26ee | Checkpoint fix: re-pin the verifier contract's `uat.mjs` citation |
| 1 | 5 | 5207717f | The queue and record commands refuse it too |
| 1 | 6 | 068aaed5 | A registered census pins the guarded-callsite count |
| 1 | 7 | 7fd1c28c | The grammar is stated once, in `roadmap-phases.md` |
| 1 | 8 | 53f5a1b6 | The citation census survives its own requirements retiring |
| 1 | gate | 0cbfe379 | `risk_surface` fix: two legal sub-phase names that parse to one number |

## Deviations

- [deviation] Task 1's Verify says "No entry mentions `1.1`, `1.10` or `8`",
  which contradicts D-03's leading-digit-run grouping key: the `1.00`/`1.01`
  entry's detail necessarily names the legal directories they collide with.
  Resolved in favour of D-03 and AC1's own wording - none of the three earns a
  drift entry of its own. 687bcebc.
- [deviation] CONTEXT D-13 names two line-pinned citations this plan would
  break. Measured against the live tables it breaks THREE more, because
  inserting a guard near the top of a module shifts every pin below it:
  `EXECUTE-10`, `VERIFY-11` and `cad-verifier-contract`'s `uat.mjs:489-491`.
  First two re-pinned in d46bdacf; the third forced the blocked checkpoint.
- [deviation] The plan's `files:` lease did not name
  `skills/cad-verifier-contract/SKILL.md`, so the third re-pin was out of lease.
  The orchestrator amended the lease; the re-pin landed as 049b26ee.
  `cadence-core/workflows/progress.md` was added the same way for 0cbfe379.
- [deviation] The first executor dispatch was cut down mid-task-1 by a host API
  error (403, org membership) before it committed anything or wrote a report.
  Its uncommitted edits were discarded on the user's instruction and the plan
  re-dispatched from task 1. No work was lost; nothing had landed.

## Open items

- Three planning-record citations of `references/conventions.md` by LINE are now
  8 lines stale, because task 7's retirement shrank the phase-directory bullet
  from 12 lines to 4: `conventions.md:49` (cited from
  `.planning/phases/3/SUMMARY.md:141` and `phases/3/reports/plan-3.md:11`),
  `conventions.md:38-66` (`phases/2/CONTEXT.md:117,251`) and
  `conventions.md:98`/`:136` (`.planning/ARCHIVE.md:233`,
  `phases/1/ADJUDICATION-risk_surface-plan-1.json`). Deliberately not repointed:
  these are records of what was true when written, the disposition phase 5's
  D-04 already gave archived citations, and no check reads them. Live surfaces
  cite `conventions.md` by line nowhere, measured 2026-08-25.
- The `risk_surface` gate's one narrowed re-arm round was declined by the user
  and remains UNSPENT. The fix commit 0cbfe379 was settled on an `override`
  receipt carrying that decision, with the suite, `self-verify` and `tsc` as the
  evidence standing in for the re-fire.

## Goal check

The ten commits deliver the goal, and both halves are demonstrable on one tree
rather than argued. On a scratch tree carrying `phases/1.1`, `phases/1.10`,
`phases/1.01` and `phases/2.0`, `planning.mjs status` returns two
`phase-dir-grammar` entries - `['1.01']` and `['2.0']`, each naming the legal
directory it collides with - and no entry for `1.1` or `1.10`, which is AC1
exactly. On that same tree `uat status --phase 1.10` answers `ok:false`,
`reason:"bad-args"`, with a detail naming both fixes ("send `--phase "1.1"` for
that one, or rename `phases/1.10/`"), which is AC3 at a real callsite rather
than in a unit test. AC4 is the `CALLSITES` census in
`phase-spelling.test.mjs`, pinned against the `requirePhaseArg` count and
falsified during the run: a throwaway callsite added to `cmdPlanSize` failed the
suite naming `plan-size.mjs:42 (cmdPlanSize #2)` before being reverted. AC2 is
`roadmap-phases.md`'s new `## The phase directory` section, with `grep -rn "no
zero-padding"` and `grep -rn "bare integer"` each returning exactly one line
tree-wide, both in that file, against four each before.

What the phase did NOT anticipate is what the `risk_surface` review caught, and
it is worth naming rather than burying in the commit list: the phase made `1.1`
and `1.10` legal AND different, while two readers still reported `Number(name)`
as the phase identity, so sub-phase ten's record came back labelled sub-phase
one - a violation of the guarantee `roadmap-phases.md` states two paragraphs
above, written by this same phase. A pre-existing test pinned the wrong identity
rather than preventing it. Fixed in 0cbfe379 by reporting the collision instead
of resolving it, on the phase's own report-never-migrate pattern. Whole-tree
gate at HEAD: 3265 pass / 0 fail, `self-verify --root .` `problems: []`,
`npx tsc -p tsconfig.ci.json` exit 0.
