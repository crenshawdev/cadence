---
phase: 2
status: complete
completed: 2026-08-18
---

# Phase 2: Readers that accept what they have a rule against - Summary

Five argument and value faces now refuse malformed input at the door: `--dir`
through `flagValue` at all six seams that read it, `--date` validated against
`YYYY-MM-DD` before `bump()` is entered, the safe-integer range inside the
shared numeric guard, a phase spelling that cannot round-trip refused at the two
write faces that would merge it into another phase, and every `Object.prototype`
member reported by `config.mjs` as the unknown key it is.

## What shipped

- `--dir` refuses empty and valueless at all six seams - `git-publish.mjs`,
  `release-bump.mjs`, `land-cleanup.mjs`, `git-branch.mjs`, `worktree-base.mjs`,
  `issue-check.mjs`, each with its own `e.seam` catch arm; an ABSENT `--dir`
  still resolves to the process cwd. Measured after the change:
  `git-branch.mjs tags --dir ''` answers
  `{"ok":false,"reason":"missing-flag-value","detail":"--dir"}` where it printed
  this repo's 33 tags.
- `release-bump.mjs bump --date` validated at the dispatch under a new
  seam-level `bad-date` code, newline arm first - `cadence-core/bin/release-bump.mjs:236-267`.
  The EMPTY and the VALUELESS spellings both refuse; an absent `--date` still
  dates today.
- The safe-integer range in `lib/require-int.mjs` and the tracker readers -
  `requireInt`, `requireCursorNumber`, `normalizeNumber`, `scanIssueRefs` - so a
  400-digit or `9007199254740993` value is refused rather than rounded or
  yielded as `Infinity`.
- The round-trip phase-spelling predicate at `seed-reqs` and `cursor set`, plus
  `parseCaptureSnippets` and `parseArchiveRows` - `cadence-core/bin/lib/planning-files.mjs`.
- `Object.hasOwn` at all four bare index reads in `config.mjs` and
  `lib/retired-keys.mjs`, so `check '__proto__=1'` reports `unknown key` rather
  than the fabricated `retired in v2.0.0: undefined`.
- The stated contracts moved with the code: `lib/seam-input.mjs`'s two-reader
  header, `worktree-base.mjs`'s and `land-cleanup.mjs`'s "exit 0" claims, and
  `workflows/milestone.md`'s halt bullet.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 50b4486 | the two-reader contract stops telling `--dir` to stay permissive |
| 1 | 2 | 810c692 | `--dir` refuses at the two seams that write |
| 1 | 3 | 9666b74 | `--dir` refuses at the two advisory readers too |
| 1 | 4 | 04d97ae | `--dir` refuses at land-cleanup and issue-check |
| 1 | 5 | 42e16ae | release-bump validates `--date` before it reads or writes anything |
| 1 | - | bebd5a5 | plan 1 executor report |
| 2 | 1 | fc96026 | the safe-integer range enters the shared numeric flag guard |
| 2 | 2 | 45be702 | the tracker readers stop answering about a different issue |
| 2 | 3 | 6c4e618 | the two phase-number readers stop minting a phase nobody wrote |
| 2 | 4 | 6c43389 | seed-reqs and cursor set refuse a spelling that cannot round-trip |
| 2 | - | b32d302 | plan 2 executor report |
| 3 | 1 | ad56095 | the config read face refuses a prototype member as an unknown key |
| 3 | 2 | ac8dca0 | the config write face stops fabricating a retirement |
| 3 | - | fe301c1, 910aaba | plan 3 executor report |
| - | - | 8b94a5d, 3134ce7 | worktree merges (plans 2 and 3) |
| 1 | gate | 5076375 | a valueless `--date` refuses instead of dating today (`risk_surface` fix) |

## Deviations

- [deviation] Plan 2 task 4's `Verify:` line ran the accepted arm as
  `cursor set --phase 2.1 --status planning`. `planning` is not in
  `CURSOR_STATUSES`, so that literal can only ever answer `bad-status`. The
  refusal arm is unaffected - the phase spelling is refused ahead of the status
  check - and the accepted arm was re-run with `--status planned`, which
  succeeds at both faces for `2` and `2.1`. Commit 6c43389. No numbered CONTEXT
  decision is refuted: the error is in the plan's verify line, not in a D-NN.
- [deviation] The blocking `risk_surface` gate on plan 1's range raised one
  `high` finding that survived adjudication: a bare TRAILING `--date` still read
  as absent through `optionalFlag` and dated today, so
  `bump --version 1.1.0 --date` wrote the manifest and a `## [1.1.0] - <today>`
  heading at `ok:true`. Plan 1's report had named this and deferred it to phase
  4 on the reasoning that closing it meant giving the seam a second reason code
  (`missing-flag-value` beside `bad-date`). That reasoning did not hold: testing
  the flag's OWN appearance in argv and routing a valueless value into the
  existing `badDateDetail` closes it under `bad-date` alone. Fixed in 5076375;
  the narrowed re-arm round returned no findings.

## Open items

- `cadence-core/workflows/milestone.md` sits under a byte-exact weight budget
  (`cadence-core/bin/weight-budgets.json`, 13307 B, zero headroom), which was
  outside plan 1's lease. The halt bullet therefore names `bad-date` with no
  gloss and does not name `missing-flag-value`, which that same invocation can
  now also return. The fuller wording needs the budget entry regenerated.
- `cadence-core/references/capture-grammar.md` is the stated prose home of the
  capture-tag grammar, and its `## Out of grammar` table has no row for a phase
  number that does not round-trip. The four new cases are pinned in
  `planning-files.test.mjs` only, and nothing binds the two mechanically - no
  `self-verify` check references that file. The file was outside plan 2's lease.
- Not queued, recorded here: the `bad-date` detail names the flag and the
  grammar but does not echo the offending value. Declined deliberately - the
  newline arm exists because a `--date` can carry a forged
  `## [9.9.9] - forged` release section, and echoing it would put those bytes on
  a line the closing workflow prints.
- Not queued, already roadmapped: `planning.mjs`'s own `parseArgs` `--dir`
  remains permissive (CONTEXT D-03), which phase 4's shared argument contract
  covers.

## Goal check

The phase goal asked that five argument and value faces refuse malformed input
at the door, each with the diagnostic its caller needs. The eighteen commits
above deliver all five, and each face was exercised directly rather than
inferred from its tests: `git-branch.mjs tags --dir ''` now answers
`{"ok":false,"reason":"missing-flag-value","detail":"--dir"}` where it printed
this repository's 33 tags; `release-bump.mjs bump --version 1.1.0 --date`
answers `{"ok":false,"action":"refuse","reason":"bad-date",...}` at exit 1;
`config.mjs get __proto__` and `get stakes __proto__` both answer
`{"ok":false,"reason":"unknown-key","detail":["__proto__"]}` where the first
printed `{"ok":true,"values":{}}` and the second silently dropped one key of
two; `config.mjs check '__proto__=1'` reports `unknown key` in place of the
fabricated `retired in v2.0.0: undefined`. The numeric half (ARG-03/ARG-04) is
evidenced by its tests rather than by a hand run, since its faces write:
plan 2's report records both guards watched failing against a reverted copy
before being restored. `node --test 'cadence-core/bin/*.test.mjs'` passes
2321/2321 with zero failures and `node cadence-core/bin/self-verify.mjs`
answers `{"ok":true,...,"problems":[]}` on the merged tree, which is the check
the three worktrees could not perform on each other's work. Nothing in the
goal is missing. The two honest gaps are both prose, both named above, and both
sit in files no plan held a lease on: `milestone.md`'s halt bullet is thinner
than the vocabulary it now has to describe, and `capture-grammar.md` does not
yet state the round-trip rule its own grammar acquired.
