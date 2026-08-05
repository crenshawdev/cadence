---
phase: 2
status: complete
completed: 2026-08-05
---

# Phase 2: References load where they are used - Summary

`references/git.md` is split into a 6,166 B guard and a 4,611 B publish half, the
15.7 KB `review-triggers.md` no longer loads at three workflow sites that only
needed its 3,050 B triage gate, and `conventions.md` is `@`-included nowhere in
the plugin - each move judged per site against the break-even rule, which now
covers a deferred read rather than only a subagent round-trip.

## What shipped

- The git rail split - `cadence-core/references/git-guard.md` (rails 1, 2, 4) and
  `cadence-core/references/git-publish.md` (rail 3 + `git.auto_close`);
  `cadence-core/references/git.md` deleted in the same commit that repointed its
  last citation
- The eager map - `/cad-phase`, `/cad-pause`, `/cad-undo`, `/cad-milestone` take
  the guard only; `/cad-land` keeps the guard eager and reads the publish rails
  at the step that publishes
- The triage gate as its own reference - `cadence-core/references/triage-gate.md`,
  with the adjudicated arm restated as a tapped multi-select (`ceil(N/3)`
  questions, NONE first and default) and the `git.auto_close` carve-out scoped to
  `pre_ship` inside `/cad-land`; `review-triggers.md` § 6 is now a pointer
- The `conventions.md` phantoms resolved - the Parallel-work rule inlined whole at
  thirteen workflow sites, batch-asks and lazy-create at four more, and
  `skills/cad-pause/SKILL.md`'s 5,115 B include dropped
- The `/cad-config` catalog decision on the record - `config.md` states the table
  is deliberately transcribed, not derived from `config.mjs keys`, with the
  run-count evidence in `CHANGELOG.md`
- The break-even rule extended to cover any deferred read, and all 26 `@`-include
  lines across 21 skills recorded with a keep-or-move reason

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 0b63057 | Split the git rails into guard and publish references |
| 1 | 2 | 43a55f2 | Four skills take the guard only, cad-land reads publish where it publishes |
| 1 | 3 | 697503a | Every rail citation names the file that holds it, git.md is deleted |
| 1 | 4 | 3eadf10 | The triage gate is its own reference, tapped rather than typed |
| 1 | 5 | 3bcbb70 | The triage sites read the 3 KB gate, not the 15.7 KB trigger file |
| 1 | 6 | 0f2824c | The Parallel-work rule reads where it is used, in thirteen workflows |
| 1 | 7 | bb1bc24 | Batch-asks and lazy-create read at their sites, cad-pause drops the include |
| 1 | 8 | a42d113 | The /cad-config catalog is decided on the record and says so |
| 1 | 9 | 4618237 | The break-even rule covers a deferred read, every eager include has a reason |

## Deviations

- [deviation] Task 3, `cadence-core/bin/git-publish.mjs:147` - the plan said to
  reword the stale "rail 5" citation to name the Bash `git push` guard it
  "actually means". False at that line: the site is the reap (`git branch -D`),
  which no rail sees since TOK-02 deleted the destructive rail. Wrote what is
  true at that line instead. `grep -rn "rail 5" cadence-core/` returns nothing
  either way.
- [deviation] Task 6 verify - `grep -c "one message" cadence-core/workflows/plan.md`
  returned 1 against an expected 2, caused by a pre-existing line wrap at
  `plan.md:54` splitting "in one / message", not a missing rule. Reflowed; now 2.
- [deviation] Task 8 verify - the plan's Action spells the word `TRANSCRIBED`
  while its own verify greps case-sensitively for `transcribed`. Changed the
  emphasis to "deliberately transcribed, NOT derived", satisfying the check as
  written.
- [deviation] Task 9 counts - the plan and D-19 say "all twenty `@`-include lines"
  and "the twelve workflow includes". The tree carries 26 include lines across 21
  skills, 17 of them workflow includes; D-19's inventory also omits `cad-verify`'s
  `templates/UAT.md`. The CHANGELOG bullet records the real numbers. No judgment
  changed.
- [deviation] Task 7, `skills/cad-pause/SKILL.md:43` - the plan calls this a
  batch-asks citation; it is a Parallel-work citation on a `cursor get` batched
  with git probes. Inlined the rule the site actually uses.
- [deviation] `cadence-core/references/triage-gate.md` is 3,050 B against the
  plan's "~2 KB" phrasing; the mandated additions (two-caps arithmetic,
  contradictory re-ask, carve-out scope rationale) account for the difference.

## Open items

- ~~**The `/cad-land` publish-rails Read is under the wrong arm.**~~ CLOSED by
  `2995dfb`. It sat inside arm (b) `git.auto_close: true` under a lead scoped
  "On GitHub", with three consequences: arm (a) - the DEFAULT manual path with
  four publishing options - never read `references/git-publish.md` at all; the
  GitLab sub-arm of (b) reached `glab mr create`, which publishes the source
  branch, without loading rail 3 either; and the bullet's own rationale ("step
  4a ends the turn on the publish-mechanism ask") was false where it sat, since
  arm (b) explicitly skips the 4a ask. Found by the `diff` review trigger.
  Fixed per-arm rather than by hoisting to the top of step 4: a top-of-step read
  would also be reached by leave-local and by a tag left unpushed, and under this
  phase's own break-even rule a reference reached on every branch belongs eager -
  so hoisting would have argued the include back. (a) now reads it only when the
  answer is direct push, open MR/PR or a pushed tag; (b) reads it ahead of its
  first publishing bullet, explicitly covering GitLab as well as GitHub, and
  states that this arm's read does not fold into an ask-ended turn. Each arm
  carries the rationale that is true for it. AC2 is delivered.
- CONTEXT AC2 names `land.md` as the file that should read `git-publish.md`. No
  `cadence-core/workflows/land.md` exists; `/cad-land`'s process lives entirely in
  `skills/cad-land/SKILL.md`, which is where the read went. Flagged so verification
  does not read the missing file as a miss.
- `land-cleanup.mjs:100` and `land-cleanup.test.mjs:140` cite
  `references/triage-gate.md:34`. Accurate today, but a line-number citation into
  a file nothing pins - the same species of staleness that
  `review-triggers.md:146` had before this phase.

## Goal check

The nine commits deliver the goal. `cadence-core/references/git.md` no longer
exists and both the prefixed and bare citation sweeps return zero across
`cadence-core/`, `skills/`, `agents/`, `INTERNALS.md` and `METHOD.md` (AC1);
`grep -rn "conventions.md" cadence-core/workflows/` returns nothing at all, so
every one of the seventeen phantoms is resolved by inlining rather than left as a
dangling pointer (AC4); `triage-gate.md` is 3,050 B and the three workflow sites
cite it instead of the 15.7 KB file (AC3); and `config.md` carries the transcribed-
not-derived decision with its evidence in `CHANGELOG.md` (AC5). `node --test
cadence-core/bin/*.test.mjs` reports 1151 pass / 0 fail, `node
cadence-core/bin/self-verify.mjs` prints `"problems":[]` across all sixteen
checks, `npx tsc -p tsconfig.ci.json` exits 0, and the budget-equality one-liner
prints `budgets exact` tree-wide - so no commit left a surface unbudgeted and no
`@`-include or backticked repo path resolves to a deleted file. The one gap is
AC2, and it is a placement error rather than a missing edit: the deferred publish
read landed inside the `git.auto_close` arm instead of ahead of the (a)/(b)
branch, so the default manual publish path and the GitLab auto-close path both
still publish without loading rail 3. That is the first open item above and the
thing verification should press on.
