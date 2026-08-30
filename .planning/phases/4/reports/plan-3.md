PLAN COMPLETE
Plan: .planning/phases/4/PLAN-3.md
Tasks: 3 of 3
| Task | Commit | Note |
|---|---|---|
| 1 - The carry seam | 74bf90f3 | `planning.mjs risk-carry --phase <N>` COPIES every `REVIEW-risk_surface*.md` and `ADJUDICATION-risk_surface*.json` from `phases/<N>/` to `risk-carry/<N>/`, basenames preserved, originals left. Refusal order mirrors `deferred carry`. `arg-contract-flag-entries` re-pinned 194 -> 195. |
| 2 - Its tests, and the planning-seam censuses it moves | c16d7254 | 9 arms in `planning-risk-carry.test.mjs`; stem added to `GROUPS.planning`; `phase-spelling-callsites` re-pinned 22 -> 23 and tree-aware 11 -> 12 with a `risk-carry.mjs cmdRiskCarry #1` row. `planning-detail-sites` (15/6) and `trace-refusal-sentences` unmoved - the new module carries neither idiom. `citation-census` green with no repair: all four pinned this-seam rows name modules under `planning/`, none names `planning.mjs` itself, so no `.planning/DOCS-CLAIMS.md` row moved. |
| 3 - Prove the ruling survives the prune | 7984ea96 | End-to-end arm: both rounds unioned (an entry only round one names is asserted present), gate halts, `risk-carry` runs, `milestone-prune --label v9.9.9 --mode delete` removes `phases/3/`, the union rebuilt from `risk-carry/3/` alone gives a byte-identical payload and an identical decision (action, reason, findings, overridden). Falsifier run: with the `risk-carry` call removed the arm goes red at `carried(dir, 3)` returning `[]` after the prune; restored, 10/10 green. |
| fix - `risk_surface` :141 (high) | 1b4f1407 | The per-entry destination check `lstat`ed only for presence and then compared bytes with `readFileSync`, which FOLLOWS: a symlink under a carried name pointing back at `phases/<N>/<name>` compared equal to its own target and was marked `skipped`, and the prune then left it dangling. Reproduced first - the seam answered `{ok:true, copied:0, skipped:1}` on that fixture. Not a regular file now refuses `carry-dest-unusable` before any copy; 11 of 11 arms green. |
| fix - `risk_surface` :160 (high) | 35dd11a5 | `readdirSync` and `copyFileSync` both follow, so nothing on the SOURCE side was checked to be what it looked like. Reproduced first: a `REVIEW-risk_surface-plan-1.md` symlinked at a file outside the planning root was copied into `risk-carry/3/` under `ok:true, copied:2`. Both source components are now `lstat`ed as real directories and every matching entry as a regular file, before the first write, refusing `carry-src-unusable` for the whole carry; the absent-phase answer reads `lstat` so a dangling link refuses rather than reading as nothing-to-carry. 14 of 14 arms green. |

Suite: `node cadence-core/bin/test.mjs` - 3616 of 3616 pass, 0 fail
(`workflow.test_command` is null and this repository has no root `package.json`;
`cadence-core/bin/test.mjs` is the entrypoint its own header names). Typecheck
`npx tsc -p tsconfig.ci.json` clean at every commit; `detect-commands` reports
`lint: null`, so there is no lint command to run.

Deviations:
- [deviation] Task 1's `Verify:` asserts a bare `--phase` prints `ok:false` /
  `missing-flag-value`. The same Action requires the row mirror `'deferred
  carry'` exactly, and that row's bare-flag refusal is answered at
  `planning.mjs`'s dispatch door as `{"ok":false,"reason":"bad-args","detail":
  "risk-carry --phase needs a phase number: --phase <N>"}` - the same envelope
  `deferred carry --phase` returns today, measured. `missing-flag-value` is
  `lib/seam-input.mjs`'s vocabulary and `planning.mjs` deliberately carries one
  refusal vocabulary with no `e.seam` catch arm (`planning.mjs`'s dispatch
  comment). Took the mirror: `ok:false` holds, no `risk-carry` directory is
  created, and the reason is the one every sibling `--phase` row already gives.
- [deviation] Expected the full suite green, observed 9 failures in
  `planning-renumber.test.mjs`. Not this plan's code and not any code: an EMPTY
  `/tmp/.git` directory exists on this machine (created 2026-08-29 21:47, during
  plan 1 or 2's run, before this dispatch), so every fixture built under
  `os.tmpdir()` reads as sitting under a git repository whose state cannot be
  read, and `PHS-01`'s "a tree with no repository must still remove" arm
  refuses. Falsified against the code: the same file run with `TMPDIR` pointed
  outside `/tmp` is 25 of 25 green, and the whole suite is 3616 of 3616. Left
  the stray directory in place - it is not this plan's to delete.

Open items:
- `/tmp/.git` (empty, owned by john, 2026-08-29 21:47) makes 9
  `planning-renumber` arms fail for anyone running the suite on this machine
  with a default `TMPDIR`. Removing it is a one-line fix nobody in this plan's
  lease owns.
- The seam copies with a plain loop rather than staging into the destination
  and renaming in, so a failure part-way through leaves some rulings carried
  and some not. The lean shape meets the `Verify:` because the skip-identical
  rule makes a re-run finish the job rather than refuse it, which is the same
  recovery staging would have bought and one fewer transient directory inside
  the destination the gate's caller globs.
- Nothing yet CALLS `risk-carry`, and nothing yet deletes `risk-carry/` when a
  close resolves. Both are Plan 4's prose (`cadence-core/workflows/milestone.md`
  and `skills/cad-land/SKILL.md`), which is why this plan's lease holds neither
  file.

FIX PASS (`REVIEW-risk_surface-plan-3.md`), 2026-08-29. Both `high` findings
fixed at `cadence-core/bin/planning/risk-carry.mjs`; the `medium` at `:158`
(the check/use race) was left standing by instruction, and no staging directory
or rename was introduced - the no-staging decision in that file's comment
stands. New refusal token `carry-src-unusable`; `reason-census.test.mjs` is
one-directional so a new token passes by construction, and `self-verify`'s
`refusal-hints` check is green over both new sites. Suite after the fix:
`node cadence-core/bin/test.mjs` 3611 of 3620 (four new arms), the 9 failures
being the same `/tmp/.git` artifact this report already records - the whole of
`planning-renumber.test.mjs` is 25 of 25 with `TMPDIR` outside `/tmp`.
`node cadence-core/bin/self-verify.mjs` `ok:true`, 30 checks, 0 problems.
`npx tsc -p tsconfig.ci.json` clean at both commits; `detect-commands` still
reports `lint: null`.
