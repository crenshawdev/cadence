---
phase: 1
status: complete
completed: 2026-08-05
---

# Phase 1: The orchestrator stops holding what its children returned - Summary

Executor reports, verifier findings and review artifacts stopped riding the
parent context: each now moves as a file or a reference, and `seams.md` states
the break-even rule that says when the extra turn pays.

## What shipped

- The file round-trip break-even rule - `cadence-core/references/seams.md:207`,
  `## Seam: spawn-agent`, between **Handoff read discipline** and
  `## Seam: call-review-provider`.
- Executor report file + five-field digest - `<plandir>/reports/plan-<k>.md`,
  derived not dispatched, rewritten after every task commit
  (`skills/cad-executor-contract/SKILL.md:202`).
- Both orchestrators read the file, not the return - `execute.md` (7 sites:
  complete/partial/timeout/checkpoint/summary/state/parallel), `task.md`.
- A narrow `Write` grant on all four `cad-verifier` rungs, with blocking check
  `verifier-write-grant` behind it - `cadence-core/bin/self-verify.mjs:686-712`,
  now named in the `checked:` string.
- One verifier findings file in the merge payload shape -
  `.planning/phases/<N>/verifier-findings.json`, deliberately NOT `FINDINGS.json`
  (`planning.mjs:670-675` overwrites that name).
- `uat merge --payload <file>` with `no-payload` / `bad-payload` refusals that
  land before `loadUat` and before any write; the `null`-sentinel collision in
  the shared reader is fixed.
- `verify-deep.md` restructured into `dispatch` / `merge` / `fall_through`, both
  failure arms citing one named step; the hand-transcription step is deleted.
- Review artifacts pass by reference in three shapes - `{base_ref, head_ref}`,
  a staged-diff scope, or a path - across every fire site.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | eff04e3 | state the file round-trip break-even rule in the spawn-agent seam |
| 1 | 2 | 12a5aad | executor writes its report to a file and returns a five-field digest |
| 1 | 3 | 596b24c | orchestrators read the executor report file instead of the return |
| 1 | 4 | 0dd055f | grant cad-verifier a narrow Write, backed by a blocking check |
| 1 | 5 | ab57a9b | verifier writes one findings file and returns a digest |
| 1 | 6 | 2816b17 | uat merge takes a payload file and refuses a bad envelope |
| 1 | 7 | 7c6b041 | deep pass reads the findings file and falls through on one named step |
| 1 | 8 | 7ff1e16 | review subsystem takes references, not inlined artifact bytes |
| 1 | 9 | 4a6abb3 | every review fire site hands a reference, never artifact bytes |
| 1 | 10 | 8ccb5b3 | record the resident-bytes cycle under Unreleased |

Range `eff04e3..8ccb5b3`, 10 commits. Full task table in
`.planning/phases/1/reports/plan-1.md`.

## Deviations

15 recorded in `reports/plan-1.md`. The ones that change what a reader should
believe:

- [deviation] Task 4, from the blocking `risk_surface` review: check 7c's name
  regex captured the RAW scalar, so `name: "cad-verifier"` matched neither
  branch and the grant check skipped SILENTLY while `lib/rung-agent.mjs` kept
  routing the file. Fixed by stripping one matched quote pair; the comment's
  wrong claim that the rung map routes by `name:` was corrected to FILENAME.
- [deviation] Task 4, same review: `verifierFixture()` hardcoded
  `cad-verifier-max`, so narrowing the check's predicate to that one name passed
  the whole suite. Fixed; the mutation now fails 4 rows where it failed 0.
- [deviation] Task 4 adjudication: the review's two headline findings (new
  capability class, unbounded write surface) were killed on one fact - `Bash`
  was ALREADY in `tools:` pre-diff (`git show HEAD:agents/cad-verifier.md`), so
  a Bash-capable agent could already write any file by redirection. The grant
  does not enlarge the reachable filesystem states.
- [deviation] Task 6: the envelope disjunction was unpinned by any new row, so
  an `&&`->`||` mutation passed all of them. Fixed with three single-array
  positive rows. Falsification surprise recorded: the mutation actually failed
  14 rows, not the predicted 3 - 11 pre-existing rows were already sensitive.
- [deviation] Task 6: `[null]` on stdin threw a TypeError that surfaced as
  `reason:"internal"` - a crash dressed as a diagnostic, in the reader being
  fixed. Now a plain `bad-payload`.
- [deviation] Task 8: `review-triggers.md` grew 13224 -> 15436 (+16.7%) against
  the plan's "keep the net growth small", every added sentence mandated by the
  task's own Action text. It is `@`-preloaded into `/cad-land` and
  `/cad-plan-review` on every invocation.
- [deviation] Task 10: `.planning/CAPTURE.md` is gitignored here
  (`.gitignore:23`), so the closure landed on disk only and that commit carries
  `CHANGELOG.md` alone rather than force-adding past a standing ignore rule.

## Open items

- **AC2, AC3 and task 7's Verify step (5) are human-verify** - each needs a LIVE
  cad-executor or cad-verifier dispatch and cannot be proved from this tree.
- **Task 7's merge-refusal arm is not live-reachable** - `dispatch` precedes
  `merge`, so a pre-seeded malformed findings file is overwritten before the
  merge reads it. Proved instead by task 6's seven refusal rows plus the
  `fall_through` convergence grep. Read SC4 against this split.
- **`agents/cad-verifier.md`'s `description:` still says "Read-only"**, which
  task 4's grant makes false. Left for phase 3 per CONTEXT's scoping; a one-line
  edit if two phases is too long to carry a false claim.
- **Two preloaded surfaces moved upward in a resident-bytes milestone** -
  `cad-executor-contract` 6954 -> 10891 (+57%), `review-triggers.md` 13224 ->
  15436. Phase 2 owns load order, phase 3 the budget.
- **`.planning/CAPTURE.md`'s over-cap closure will not survive a fresh clone.**
- ~~Two highs from the advisory `diff` review~~ - **both FIXED after the phase
  closed**, in `189ac2a` and `abe0a00`: check 7c keyed on `name:` while routing
  resolves by FILENAME (now keyed on the union of both identities, with a test
  row that fails if the union is reverted), and the single cross-model payload
  command hardcoded the scratch file so shape (c) had no command at all (now
  takes the artifact path as `argv[2]`, verified live with quotes and
  backslashes round-tripping byte-identically).
- **Three mediums from the same review**: the envelope validates only that ONE
  of the three lists is an array, so a sibling non-array iterates as characters
  and inflates `rejected` (no phantom items - the `usableName` guard catches
  them); `execute_parallel` step 5 names a post-merge HEAD that step 3 never
  records; an abandoned `risk_surface` checkpoint leaves its untracked `.diff`
  behind, which `git worktree remove` refuses.

## Goal check

The phase goal is that no subagent's full output stays resident in a parent
context after the turn it arrived on, and the sum of these ten commits
plausibly delivers it. All three transports exist and are wired at both ends:
the executor's terminal message is "exactly these five fields, and nothing else"
(`skills/cad-executor-contract/SKILL.md:202`) with the table in
`<plandir>/reports/plan-<k>.md`, which `execute.md` names at 7 sites and
`task.md` at 1; the verifier writes one `verifier-findings.json`, named in the
contract 4 times and across `verify-deep.md` (3) and `verify.md` (2), and
`verify-deep.md`'s `fall_through` grep returns exactly the 3 lines the plan
predicted - one definition and one citation per failure arm; and every fire site
hands a reference, with the completeness sweep accounting for all 13 files the
plan's own command returns. The cycle is green as claimed: I ran
`node --test cadence-core/bin/*.test.mjs` (1146/1146),
`node cadence-core/bin/self-verify.mjs` (`"ok":true`, zero problems, with
`verifier-write-grant` present in the `checked:` string) and
`npx tsc -p tsconfig.ci.json` (exit 0) directly rather than taking the report's
word. What is NOT proved from this tree is the behaviour under a live dispatch -
AC2's "a continuation re-runs no completed task" and AC3's checkpoint artifacts
are prose contracts plus test rows, not observed runs, and they are carried as
human-verify rather than counted. Two honest gaps against the goal's spirit: the
grant's compensating check is still evadable by renaming `name:` in the very
file it guards, and this transport-only phase left two eagerly-preloaded
surfaces measurably heavier than it found them, in a milestone whose subject is
resident bytes - phase 2 and phase 3 own those, but the phase moved the number
in the wrong direction on its way to moving it in the right one elsewhere.
