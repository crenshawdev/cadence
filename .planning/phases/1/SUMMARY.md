---
phase: 1
status: complete
completed: 2026-08-18
---

# Phase 1: The guards that remove a protection - Summary

Both protections that were being removed are back: `git.protected_branches`
resolves through one non-empty grammar so a string `""` protects `main` again,
and all six bulk-output scratch sites write inside a `mktemp -d` directory made
for that run, with every read-back refusing a truncated or wrong-shaped file by
name.

## What shipped

- One non-empty resolver for `git.protected_branches` - `cadence-core/bin/lib/protected-branches.mjs`, a single `namesABranch` predicate over the string and list spellings
- Guard-decision coverage that reaches the DECISION, not only the helper - `cadence-core/bin/git-guard.test.mjs`, plus base-resolution rows in `land-cleanup.test.mjs` and `issue-check.test.mjs`
- A per-run scratch transport at all six sites - `cadence-core/references/{conventions,triage-gate,review-triggers}.md` and `cadence-core/workflows/{progress,report,task}.md`, each writing into its own `mktemp -d`
- Read-backs that refuse rather than answer - `scratch-unreadable` on an unreadable or unparseable file, `scratch-shape` naming the absent field, `scratch-stale` on a carried directory that is not this run's
- The rule as an executable check - `cadence-core/bin/lib/scratch-path.mjs`, wired into `self-verify.mjs` as check 21 (`scratch-path`)
- Read-backs proved by running them - `cadence-core/bin/scratch-readback.test.mjs` extracts the four shipped `node -e` scripts out of prose and executes them, with a negative control that pins the unguarded form printing `{}` and exiting 0

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 567b69e | Resolve `protected_branches` through one non-empty grammar |
| 1 | 2 | 064b479 | Prove the coercion reaches a guard DECISION, not only the helper |
| 1 | 3 | 5e7006e | `land-cleanup` reaps against a real base under a string `""` |
| 1 | 4 | d1f9bf3 | `issue-check` reports referenced issues under a string `""` |
| 1 | 5 | b4c8026 | The `protected_branches` reach row names all five readers |
| 2 | 1 | 879b576 | The per-run scratch rule becomes a check |
| 2 | 2 | bc8f594 | The blocking re-arm cap reads this run's own count |
| 2 | 3 | 0b04396 | `/cad-progress --trace` stops printing `{}` as a success |
| 2 | 4 | 3a21971 | `/cad-report` carries its run directory between its two steps |
| 2 | 5 | 32cc5af | The cross-model payload rides this run's own artifact |
| 2 | 6 | 7816487 | The inline task risk diff is this run's own |
| 2 | 7 | 941a74d | Prove each scratch read-back refuses by running it |
| 2 | 8 | 34e36e4 | `self-verify` holds the per-run scratch rule as check 21 |

## Deviations

None - plans executed as written. One in-lease correction rode task 2-8: the
task-1 rewrite of `conventions.md` had dropped the redirect form out of the rule
sentence that `prose-agreement.test.mjs`'s `TRN-02` row extracts its prefix
from, so the row failed; the sentence now states `> "$D/<name>"` and `TRN-02`
re-arms on the per-run prefix. `prose-agreement.test.mjs` was not touched - it
is not in plan 2's lease.

## Open items

- The four shipped read-backs dereference `r` after a successful parse, so a scratch file holding literal `null` throws a TypeError outside the catch instead of the promised `scratch-shape` refusal (`workflows/progress.md:101`, `references/triage-gate.md`'s re-arm count). Adjudicated survivor of the `risk_surface` review, medium.
- `scratchPathIssues` clears a whole LINE once `mktemp` appears anywhere on it, and `FIXED_TARGET_RE` requires an absolute literal, so a single line that both makes a run directory and redirects into `${TMPDIR:-/tmp}/<fixed>` passes check 21 (`cadence-core/bin/lib/scratch-path.mjs:85`). Adjudicated survivor, medium.
- No `scratch-stale` fixture in `scratch-readback.test.mjs`. The stale arm was proved by running it at tasks 2-4 and 2-5 rather than pinned, and it is the one arm no shape guard can reach.
- `.planning/DOCS-CLAIMS.md` rows TASK-13, TASK-14, TASK-15 and TASK-16 cite line spans in `workflows/task.md` that had rotted before this phase (TASK-16's bullet now opens at 122). Only TASK-17 was in plan 2's scope.

## Goal check

The sum of these thirteen commits delivers the phase goal. On GRD-01 the
resolver's six-value behaviour was measured directly rather than asserted:
`""`, `" "`, `[""]` and `["","main"]` all resolve to a list of real branch
names, while `[]` stays empty and `"release"` stays `['release']`
(`cadence-core/bin/protected-branches.test.mjs`), and the two coercion-sensitive
readers now assert against a decision rather than a helper - `git-guard.test.mjs`
returns a protected-branch decision naming `main` under a string `""`, and
`land-cleanup.test.mjs` reports `base: "main"` where it previously reported
`''`. Each of those rows was watched going red against the reverted resolver, so
they are falsifying rather than confirming. On SCR-01 the stronger evidence is
that the rule is now executable: `node cadence-core/bin/self-verify.mjs` exits 0
with `problems: []` and `scratch-path` in its `checked` list, and
re-introducing a fixed shared path at `references/triage-gate.md` was watched
exiting 1 and naming that file. `scratch-readback.test.mjs` executes the four
shipped read-back scripts rather than reading them, with a negative control
pinning the unguarded form printing `{}` and exiting 0. The whole suite is 2250
tests, 2249 pass, 0 fail, 1 skipped (pre-existing). What is NOT closed, and the
`risk_surface` review found it rather than the plans: those same read-backs
still crash on a scratch file that parses to `null`, and check 21's line-local
rule can be defeated by putting the `mktemp` and the fixed redirect on one line.
Both are gaps in the new guards rather than the old defect returning, and both
are queued above.
