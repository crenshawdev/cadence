PLAN COMPLETE
Plan: .planning/phases/1/PLAN-3.md
Tasks: 2 of 2
| Task | Commit | Note |
|---|---|---|
| 1 - Declare the settle-receipt figure requirement and enforce it at the door | 0ad99a98 | `PRESENCE_RULES` + `evaluatePresence` added to `lib/arg-contract.mjs` as a second structure beside `CONTRACTS`, keyed the same way; wired as the SECOND arm of `planning.mjs`'s existing if/else chain so a malformed value keeps naming its own flag. 14 new `PRESENCE_ROWS` + a declaration arm in `arg-contract.test.mjs` (13/13 green); `arg-contract-adoption.test.mjs` green unedited (323 refusals across 194 table entries - the flag-entry census did not move). `trace.test.mjs` 171/171 green with the layer comment corrected. Scratch-dir probe matched every prediction: figureless `gate_pass`/`adjudication`/`override` refuse `bad-args` on ONE stdout line carrying a `hint` and write no `trace.jsonl`; all three figures accept and write one line; figureless `rearm` and `deferral` accept; `--event gate_pass --event rearm` and `--event rearm --event gate_pass` both refuse; a padded ` gate_pass ` is not this rule's business and appends. `self-verify.mjs` `ok:true`, `problems: []`. D-15's citations re-pinned 752 -> 823 and 835 -> 906 in the same commit. |
| 2 - Prove the cleared halt cannot be settled by a figureless receipt | 3f68cf78 | One arm added beside the shipped `RSK-08:` set, on the file's own harness (`deferralRepo`, `plRun`, `survivedPayload('blocker', {overridden:true})`, `survivedPayloadFile`, `traceLines`) - no new fixture. `risk-check run` -> `adjudication` -> figureless `gate_pass` refused `bad-args` naming all three flags and the event, `traceLines` unchanged, `risk-check status` still `ok:false` / `risk-fire-missing` / `unfired`; the `override --detail-file` receipt with its three figures over the same record still `ok:true` and still leaves the range `recorded`. Every shipped `RSK-08:` arm left untouched, including the two partial-settle ones that still reach `overrideAccounted` and `bad-record`. `planning-adjudication.test.mjs` 28/28. Redden-on-demand executed: with `is: []` in the declared rule and nothing else changed, the arm fails on `receipt.ok` actual `true` expected `false`; restored via `git checkout` and green again. Full suite after the last commit: 3566 tests, 3565 pass, 0 fail, 1 skipped (3563/3562/0/1 at the dispatch base, +3 arms). |

Deviations: none

Open items:
- Per-task full-suite runs were NOT spent. Both tasks' `Verify:` name `node
  cadence-core/bin/test.mjs`, and the contract allows the suite exactly one
  site per dispatch, immediately before the digest. Each task was verified by
  its targeted files instead (`arg-contract.test.mjs`,
  `arg-contract-adoption.test.mjs`, `trace.test.mjs`,
  `planning-adjudication.test.mjs`, plus `planning-lease-check.test.mjs`,
  `citation-census.test.mjs` and `helper-census.test.mjs` as the census
  holders in the lease), with the one full-suite run covering both tasks'
  green claim.
- Declined a general presence-rule shape: `PRESENCE_RULES` holds ONE rule per
  subcommand key rather than an array of them, and `evaluatePresence` answers
  the one `when`/`is`/`requires` form. Nothing in the plan names a second rule
  on any subcommand; make it a list when a task states one.
- `evaluatePresence` is called unconditionally in `planning.mjs`'s dispatch
  and its refusal is the second arm of the if/else chain. That is what makes
  it fire "only when `evaluateRow` returned ok" observably, without a ternary
  fabricating a pass object on the branch that never reads it. Measured:
  `--survivors abc` on a figureless `gate_pass` still answers
  `trace append --survivors needs a non-negative integer`.
- `npx tsc -p tsconfig.ci.json` clean at both commits; `detect-commands`
  reports `lint: null`, so there is no lint command Cadence can find - stated
  once and skipped.
- Untracked and not mine, present before this dispatch and left alone:
  `.planning/phases/1/ADJUDICATION-diff-plan-2.json`,
  `.planning/phases/1/REVIEW-risk_surface-plan-1.md`,
  `.planning/phases/1/reports/plan-2.md` and
  `.planning/tasks/gh-179-gaps-execute/`.
