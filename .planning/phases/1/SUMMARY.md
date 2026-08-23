---
phase: 1
status: complete
completed: 2026-08-23
---

# Phase 1: Every refusal names its next step - Summary

Every in-scope refusal under `cadence-core/bin/` now carries a plain-language
`hint`, and `self-verify.mjs`'s new check 22 (`refusal-hints`) is what keeps it
that way: **243 in-scope refusal sites, 0 hintless**, down from 215 hintless
when the check first went in.

## What shipped

- The `hintless-refusal` rule and its exclusion register - `cadence-core/bin/lib/refusal-hints.mjs`, exporting `CODES`, `REGISTER`, `refusalSites(root, register)` and `refusalHintIssues(root, register)`; the register is a parameter, so a test can hand the check a substitute and the reported set changes
- The rule wired as self-verify check 22 - `cadence-core/bin/self-verify.mjs`, `refusal-hints` in its `checked` list
- Fixture tests for the rule and its injected register - `cadence-core/bin/refusal-hints.test.mjs` (23 tests), plus two CLI-wiring assertions in `cadence-core/bin/self-verify.test.mjs`
- Hint-carrying `fail` wrappers - `config.mjs`, `route.mjs`, `review-provider.mjs` widened from `(reason, detail)` to `(reason, detail, hint)`
- Hints at every in-scope refusal in twelve seam CLIs - `config.mjs` (10 sites), `review-provider.mjs` (19), `git-publish.mjs` (8), `release-bump.mjs` (8), `route.mjs` (4), `skim.mjs` (4), `why.mjs` (4), and one each in `git-branch.mjs`, `issue-check.mjs`, `land-cleanup.mjs`, `weight.mjs`, `worktree-base.mjs`, `self-verify.mjs`
- Hints at all 154 in-scope refusals in `cadence-core/bin/planning.mjs`, the largest user-facing refusal surface in the plugin (180 in-scope sites total there)

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | afb07999 | The refusal-hint rule and its exclusion register |
| 1 | 2 | 3425165e | Wire the refusal-hint rule into self-verify as check 22 |
| 1 | 3 | 47feb84f | Fixture tests for the rule and its injected register |
| 1 | 4 | 1dc3b577 | CLI-wiring assertions for self-verify check 22 |
| 2 | 1 | 566be152 | Widen the three two-argument `fail` wrappers to carry a hint |
| 2 | 2 | 14f003da | One hint on the seam-relay catch arm, verbatim at all nine CLIs |
| 2 | 3 | dd4b069e | `config.mjs`'s remaining refusals name their next step |
| 2 | 4 | 6c67c448 | `review-provider.mjs`'s remaining refusals name their next step |
| 2 | 5 | 08d20942 | The publish and release seams name their next step |
| 2 | 6 | 8d2e3972 | The read-side seams name their next step |
| 3 | 1 | cd4db472 | The cursor and phase-close refusals name their next step |
| 3 | 2 | 084610c8 | The UAT and payload-reading refusals name their next step |
| 3 | 3 | 3f72b7a0 | The audit, sizing and seeding refusals name their next step |
| 3 | 4 | be9af058 | The lease, detection and trace refusals name their next step |
| 3 | 5 | 07064619 | The risk, task-record, adjudication and deferred refusals name their next step |
| 3 | 6 | feb0b1b7 | The renumber, capture, debt and milestone-close refusals name their next step |
| 3 | 7 | none | No residue after task 6; the task changed no file |

## Deviations

- [deviation] Plan 1 predicted that after its sweep the ONLY failing test would be `self-verify.test.mjs`'s `the repo itself passes self-verification`. TWO tests in that file assert the live tree is clean - the named one, and `entry: a valueless or empty --root refuses instead of linting the cwd` (`self-verify.test.mjs:2261-2262`). Both failed for the identical reason and both closed when plan 3 landed. The second was left as written rather than filtered, on the plan's own stated reason for not weakening the first (afb07999..1dc3b577)
- [deviation] Plan 1 task 4's Verify asked `grep -c "^not ok"` to print `1`. Node's default reporter emits no `^not ok` lines at all, so that command prints `0` regardless of outcome; under `--test-reporter=tap` it prints `2`. The substantive half held - the failures were only ever `hintless-refusal` entries (1dc3b577)
- [deviation] Plan 2 task 3's Verify named `config.mjs check` against an unparseable config as a probe; `check` reads no config file at all, so it answers `{"ok":true}` and never refuses. The same two arms were verified through `config.mjs check nosuchkey=1` and `config.mjs validate --file <unparseable>` (dd4b069e)
- [deviation] Plan 2 task 5's Verify named `release-bump.mjs --version 0.0.1 --date notadate`; that spelling has no subcommand and answers `usage`. Ran `release-bump.mjs bump --version 0.0.1 --date notadate`, which reaches `bad-date` as intended (08d20942)
- [deviation] Plan 3 task 6's Verify named `recall --query --dir .planning` as the dispatch-level `argRefusal` path; `--query` is not a declared row for `recall`, so it falls through to `cmdRecall`'s own refusal. The door path was verified separately at `renumber remove --n 2.1` and `recall foo --top` (feb0b1b7)

## Open items

- `refusal-hints` is named by no row in `cadence-core/bin/test.mjs`'s `GROUPS`, so it runs in the derived `other` group rather than in `prose` beside its sibling `include-consumers`. It does run in a full `test.mjs` invocation, so nothing is unverified; `test.mjs` was outside plan 1's `files:` lease
- The rule consumes a template literal whole, exactly as `lib/skim.mjs` does, so a refusal written inside a `${...}` interpolation would not be seen. This tree has none and the module header states the limit
- Several `--<name>-file` transport hints in `planning.mjs` repeat guidance `cadence-core/references/conventions.md` already carries in prose. AC5 forbids touching `references/`, so the duplication was accepted rather than reconciled

## Goal check

The phase goal was that a user hitting a seam refusal is told what to do next in
their own terms, and that the invariant is enforced by a check rather than by
remembering. Both halves land, and the check is what proves the first.
`node cadence-core/bin/self-verify.mjs --root .` returns `{"ok":true,...,"problems":[]}`
with `refusal-hints` last in its `checked` list, and `refusalSites('.')` returns
243 in-scope sites against 0 hintless - the pair AC2 asked this SUMMARY to
state, measured by the same module the check calls. The enforcement half is not
self-asserting: `cadence-core/bin/refusal-hints.test.mjs` reddens exactly two
tests when the register is hard-coded instead of injected (AC6), and
`cadence-core/bin/test.mjs` reports 2959 pass / 0 fail / 1 skipped over 2960
tests, including `self-verify.test.mjs`'s live-tree assertions. The four
promised non-changes hold: `weight.mjs` returns `ok:true` with no budgeted
surface over its pin; `git diff --name-only 44fead5b..HEAD` lists 17 files, all
under `cadence-core/bin/`, and none under `cadence-core/workflows/`,
`cadence-core/references/` or `skills/cad-*-contract/` (AC5); and the multiset
of `reason:` literals and positional `fail(...)` first arguments over
`cadence-core/bin` has an empty REMOVED set between 44fead5b and HEAD - the only
deltas are additions, five of them fixture tokens in the new test file and
count increases in `internal` (20->21), `usage` (18->19) and `write-failed`
(4->6) (AC4). What the phase does NOT prove is hint QUALITY: the check tests for
a non-empty string, so "reads as an instruction to the person at the terminal"
rests on the executors' per-task reports and on the reviewer, not on an
assertion. That is the one gap worth naming, and it is the right place for
`/cad-verify` to push.
