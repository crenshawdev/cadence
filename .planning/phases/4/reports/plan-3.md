PLAN COMPLETE
Plan: .planning/phases/4/PLAN-3.md
Tasks: 4 of 4
| Task | Commit | Note |
|---|---|---|
| 1. The four `--dir`-only seams re-declare their flags | 1963c8e | Includes the repinned `git-publish.test.mjs` assertion the checkpoint authorized. |
| 2. `issue-check.mjs` and `weight.mjs` re-declare | 6bd11ea | 20-row before/after matrix byte-identical; one flag-swallow closes (see deviations). |
| 3. `release-bump.mjs` re-declares | df718c6 | The `datePresent` probe is gone; 15 of 18 measured spellings byte-identical. |
| 4. `optionalFlag` collapses into the contract | 2351d5f | Census reddened on a paste-back probe and went green on removal; suite 2377 -> 2373 tests, 0 failures. |

Deviations:
- [deviation] The plan asserts "no subcommand's output changes". Two spellings do
  change, both because the declared `fallback` disposition means "reads as
  absent" where the permissive reader returned the next token positionally.
  Measured before/after: `git-branch.mjs decide --branch --dir <p>` answered
  `branch:"--dir"` (the flag-swallow D-13 names) and now answers with the derived
  branch; `land-cleanup.mjs cleanup --dir <p> --base ''` answered `base:""` and
  now answers `base:"main"`. Everything else in a 60-row before/after matrix over
  the four seams is byte-identical.
- [deviation] Task 1's Verify (`node cadence-core/bin/test.mjs git` reports 0
  failures) initially could not be met: `git-publish.test.mjs:224-231` pinned
  `reap --dir <d> --branch --force` at `bad-branch`, and reading `--branch`
  through its declared `fallback` row makes it refuse `no-branch` one layer
  earlier. Checkpointed; the user ruled the refusal STANDS and added
  `cadence-core/bin/git-publish.test.mjs` to this plan's `files:` lease. The
  assertion and its comment now pin `no-branch`, in the same commit as the task-1
  change. The safety property is unchanged and asserted: `ok:false`, exit 1, no
  argv built, the branch still present, nothing deleted.
  `publish-decision.test.mjs:253-261` keeps testing the SAFE_BRANCH rule against
  `decideReap` directly and is green (34/34).

- [deviation] Same "no subcommand's output changes" assertion, same cause, one
  more spelling: `issue-check.mjs check --base --dir <p>` answered the
  log-failed skip because `--base` swallowed `--dir` as the base branch, and now
  answers exactly as the same call without `--base` does. Measured on a scratch
  repo with a github origin. The other 20 rows of the before/after matrix over
  `issue-check.mjs` and `weight.mjs` are byte-identical, including every
  `--timeout-ms` fallback (`abc`, `''`, bare, `0`, `500`), every `--dir` refusal,
  and `weight.mjs`'s `unknown-command`/`unknown-role`.

- [deviation] `release-bump.mjs bump --version "   "` answered
  `no-target-version` (the blank reached `normalizeTargetVersion`, which trims
  to null) and now answers `{"ok":false,"reason":"missing-flag-value",
  "detail":"--version"}`. The row plan 1 declared is
  `{type:'string', value:'refuse', bare:'fallback'}`, and the `string` type's
  non-blank clause fires on the value axis. Both refuse, exit 1, and write
  nothing; only the reason code moved, from a lib/release-decision.mjs verdict
  code to the seam code this file already published for `--dir`. Softening it at
  the call site would have re-spelled the rule outside the declaration, which is
  the drift ARG-06 exists to end, so the row was honoured and the header's
  `missing-flag-value` line widened to name `--version`. Two further rows change
  as the D-13 flag-swallow closes: `bump --version --dir <p>` and
  `bump --version --date <d>` answered `unparseable-version` with the swallowed
  flag as the target and now answer `no-target-version`. The other 15 of 18
  measured spellings are byte-identical, including every `bad-date` refusal with
  its full sentence, a trailing bare `--date`, and the successful bump.

Open items:
- `--dir "   "` (whitespace-only) now refuses `missing-flag-value` at all four
  seams instead of reaching git with a blank path. That is the shared `string`
  type's trim clause, declared in plan 1's table, arriving at these seams.
- `release-bump.mjs`'s header carried a stale residue note claiming a BARE
  trailing `--date` "is indistinguishable from an absent one and still dates
  today". The `argv.includes('--date')` probe had already made that false;
  measured before the change, a trailing bare `--date` refused `bad-date`. The
  note is corrected in the same commit, since it describes exactly the rule that
  moved into the declaration.
- The plan's task 4 says the contract module "stops importing the reader it now
  owns" and that `optionalFlag`'s BODY "moves to the contract module's fallback
  arm". Neither is literally available: plan 1 built `evaluateFlag` on
  `flagValue`'s throw, so `lib/arg-contract.mjs` never imported the permissive
  reader and its fallback arm needs no positional read - reading the token at
  all is the D-13 defect tasks 1-3 closed. What collapsed is the CONTRACT, not
  the body: the census row now matches `dispose`'s fallback arm in
  `lib/arg-contract.mjs`, which is the one place that rule is spelled, and the
  Must-be-true's "fallback reader's row pointing at its new home" is met that
  way.
- Coverage the collapse costs, stated rather than absorbed: the census can no
  longer catch a hand-written positional flag reader pasted into a bin under a
  new name. That idiom stopped being a shared contract with one home and is now
  just an expression; what refuses it is the declaration the contract requires.
  Recorded in `dispose`'s JSDoc and in the census row's `note`.
- `cadence-core/bin/release-bump.test.mjs:424-428` still names `optionalFlag` in
  a comment explaining why the valueless-`--date` test exists. It is historical
  narrative about the pre-fix seam, not a claim about current behavior, and that
  file is outside this plan's lease.
