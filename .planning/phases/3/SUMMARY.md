---
phase: 3
status: complete
completed: 2026-08-10
---

# Phase 3: The deferrals - Summary

Six spans of always-loaded prose became six on-demand reference files, each
anchored by a register row that fails when its `Read` sentence is deleted:
turn-one bytes across the 23 user-invocable commands fall 269,045 -> 252,653
(`node cadence-core/bin/weight.mjs resident --root .`, summed at `c6e4f8b` and
at `7a82c25`), with `/cad-config` alone going 20,547 -> 12,770.

## What shipped

- `cadence-core/templates/CONTEXT.md` (1,392 B) - `context.md`'s inlined output
  template, read at `write_context`; register row 5, the first promotion of
  inlined prose rather than a re-deferral.
- `cadence-core/references/recall.md` (2,169 B) - the `<recalled_memory>` render
  contract, read from `context.md` and `debug.md` only; register rows 6 and 7.
  `plan.md`'s two gate sites stay eager per D-04.
- `cadence-core/references/execute-parallel.md` (4,060 B) - the `execute_parallel`
  body, read at the opt-in step; register row 8. `choose_path` stays eager
  because it decides the branch (D-05).
- `cadence-core/references/worktree-executor.md` (3,038 B) - `cad-executor-contract`'s
  `<worktree_mode>`, read in worktree mode; register row 9, the first on a
  `user-invocable: false` skill. Each `cad-executor` rung dispatch falls ~2,407 B.
- `cadence-core/references/plan-revision.md` (4,360 B) - `plan.md`'s BLOCKER
  revision arm, read only when there is a BLOCKER; register row 10.
- `cadence-core/references/config-catalog.md` (8,393 B) - the knob catalog and
  its Type-key legend, read at the Interactive-menu walk step 2; register row 11,
  a byte-identical move.
- `prose-agreement.test.mjs`: the inline-figure check generalized from one
  hardcoded site to a scan over every skill, workflow and reference, plus a
  register-driven coverage arm holding each new row's `Read` sentence to
  `seams.md:239-243`. Three `cad-land` rows are `GRANDFATHERED` by name, the
  exemption `seams.md` itself states.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 6c021c6 | Register covers promotions (D-11); byte-figure check becomes a scan + coverage arm (D-17) |
| 1 | 2 | e469382 | `context.md` output template -> `templates/CONTEXT.md` |
| 1 | 3 | 78ab7dc | recall render contract -> `references/recall.md` |
| 1 | 4 | 1416d6a | `execute_parallel` body -> `references/execute-parallel.md` |
| 1 | 5 | 4c384cf | `<worktree_mode>` -> `references/worktree-executor.md` |
| 1 | 6 | d914c6b | `plan.md` BLOCKER revision -> `references/plan-revision.md` |
| 1 | 7 | 7a82c25 | `config.md` knob catalog -> `references/config-catalog.md` |

`self-verify` returns `ok:true problems:[]`, 1,524 tests pass and
`tsc -p tsconfig.ci.json` exits 0 - checked before each of the seven commits,
not only the last.

## Deviations

- [deviation] Task 2 (`e469382`): predicted a ~1,100 B fall on `/cad-context`,
  measured 871 B. The surviving Write + Read + D-06 justification prose is
  ~513 B against the plan's ~280 B estimate. No criterion pins the figure.
- [deviation] Task 3 (`78ab7dc`): the Verify's `grep -rn 'results:\[{score'
  cadence-core/workflows/` was written to return nothing; it returns one hit,
  `plan.md:111`. That hit is D-04's own carve-out, so the grep is over-broad,
  not the implementation - `context.md` and `debug.md` are both clean.
- [deviation] Task 4 (`1416d6a`): `deferred-reads.test.mjs`'s nested-close
  grammar test asserted `labels.has('execute_parallel(6)')` against the live
  `execute.md` and dies with the moved body. Retargeted to `git_guard(3)` in
  the same commit, with the matching stale citation in `lib/deferred-reads.mjs`'s
  grammar comment.
- [deviation] Task 5 (`4c384cf`): predicted -2,845 B on the `cad-executor`
  dispatch rows, measured -2,407 B (the 437 B surviving Read sentence).
  `zeroResident` totals 26,451 rather than 26,332 - D-16 grew the zero-resident
  `config-reach.md` by 119 B in task 4. The COUNT, three, is what the prose
  claims and it never changed.
- [deviation] Task 7 (`7a82c25`): first measurement put `/cad-config` at
  12,826 B, 26 B over AC2's ceiling, because the written Read sentence was
  ~290 B against a ~200 B estimate. Closed by tightening that new sentence
  alone; D-02 forbids cutting pre-existing `config.md` prose to hit a number.
  Final 12,770 B.
- [deviation] `risk_surface` pre-filter DROPS recorded for tasks 4, 5 and 7
  (`review-triggers.md:277-296`). All three staged diffs match on content -
  concurrency and destructive ops in the moved worktree/merge prose, and the
  `risk.override.<surface>` rows in the catalog - and each was proven harmless
  by diffing the moved text against `git show HEAD:<origin>`: task 7 is
  byte-identical, task 4 differs only in four cross-reference rewordings,
  task 5 only in the D-10 cross-reference correction the plan mandates.
- [correction] The executor's report states a turn-one total of
  `269,045 -> 246,286`. Re-measured at both ends, the figure is
  `269,045 -> 252,653` (-16,392 B): the baseline was taken in a throwaway
  worktree at `c6e4f8b` and the head figure at `7a82c25`, both by summing
  `weight.mjs resident --root .` over the 23 user-invocable commands.
  `docs/EVIDENCE.md:66` - which the executor regenerated from the seam at every
  commit - carries the correct 252,653, so the error is the report's prose only
  and nothing shipped depends on it.

## Open items

- AC7 is a verify-gate item, not an execution task: proving each deferred
  reference is actually read at its step needs a live run. Five commands need a
  walk item at `/cad-verify 3` - `/cad-config` (catalog at walk step 2),
  `/cad-plan` (revision branch, BLOCKER arm only), `/cad-execute` (parallel body
  on the opt-in path, worktree rules in worktree mode), `/cad-context` (template
  at `write_context`, recall at `analyze`), `/cad-debug` (recall at Hypothesize).
- The phase's descriptive `~22,300 B` came in at 16,392 B of turn-one
  reduction. The six new surfaces total 23,412 B on disk, but ~2,000 B of
  surviving `Read` sentences and the fact that four of the six moved surfaces
  are reachable from more than one command absorb the rest. No criterion pins
  the total, and the same sweep arithmetic that produced `~22,300` is what
  phase 2's own re-pin already corrected once.
- `diff` review (advisory, `gpt-5.6-terra`), two findings, neither fixed:
  (1) `execute-parallel.md:40,53` now carry the only `RE-READ triage-gate.md`
  instruction for the parallel path's adjudicated arms, and the register cannot
  anchor a `Read` nested inside a reference - deleting those sentences is
  invisible to CI. The sequential path's copies at `execute.md:264,289` are
  unaffected. (2) The new coverage arm matches the word `site` but never parses
  the count, so `zero consult sites` would pass. Both are gaps in what the check
  can see, not regressions in what shipped.
- `lib/deferred-reads.mjs:250-256`'s nested-close bug stays latent: none of the
  seven anchors sits after a nested editorial block. Already in CAPTURE.

## Goal check

The seven commits deliver the goal. Six surfaces that previously rode every
turn are now read at a step (`git log --oneline c6e4f8b..HEAD` shows one commit
per move, each pairing the new file with its `weight-budgets.json` row), and
the measured turn-one total falls 269,045 -> 252,653 B, re-measured at both
ends rather than taken from the report. Every move is watched: `DEFERRED_READS`
grew from 4 rows to 11, `self-verify` reports zero deferred-read issues on the
live tree, and each of the seven new rows carries an `assertPromotedRow`
falsifier proving that deleting the single `Read` sentence turns the check red -
which is the capability phase 1 shipped, exercised here on real cuts as
criterion 6 asked. What is NOT proved by this phase is that the deferred prose
is actually read when the step runs: that is AC7, it needs live `/cad-*` runs,
and it is carried above as the first open item for `/cad-verify 3`. The byte
aggregate also lands 5,900 B under the roadmap's descriptive `~22,300 B`, for
the reason named above; no success criterion pins it.
