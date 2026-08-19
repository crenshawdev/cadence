PLAN COMPLETE
Plan: .planning/phases/4/PLAN-2.md
Tasks: 6 of 6
| Task | Commit | Note |
|---|---|---|
| 1: `planning.mjs --dir` refuses empty, bare and flag-shaped | c1eecd5 | `--dir` read through its declared `arg-contract.mjs` row off raw argv, before any `existsSync`; refusal is `fail('bad-args', '--dir needs a path after it: --dir <planning dir>')`, exit 1, zero bytes on stderr (verified against a file, not a pipe). Absent `--dir` still defaults to `.planning`. |
| 2: trace bare-flag dispositions from the declaration | 2306cfa | Seven string flags read through the unioned `trace append` + `trace close` rows. `--plan`/`--sha`/`--base` keep `fallback` and keep omitting their key; `--step`/`--reviewer`/`--trigger`/`--role` refuse. `--role` MOVED to refuse. `trace.test.mjs:640` rewritten from pinning the drop to pinning the refusal, plus a new row pinning the fallback half so the two dispositions cannot collapse into each other. |
| 3: `route.mjs` stops swallowing the next flag as a value | 1599223 | The five value-carrying `resolve` flags read through their declared rows; `--role --attempt 2` now refuses `usage` naming `--role` instead of `unknown-role: "--attempt"`. Five `else if` usage arms collapsed to one. Absent `--role` still prints the synopsis. ok:true bundle byte-identical to the pre-change binary. |
| 4: `route.mjs --phase` warns and still resolves | cb7da4f | `--phase` read through its `warn` row; a malformed or valueless spelling reaches `warnings[]` and the resolution is unchanged (cursor fallback, same bundle stripped of `warnings`). Seeded ahead of the config layer's warnings so it rides the `unknown-role` and `unresolved` arms too. `requirePhaseArg` no longer called directly from route.mjs. |
| 5: `review-provider.mjs` stops swallowing the next flag | 9641b9e | The six declared flags read through their rows; `consult --payload --provider openai` now refuses `bad-args` naming `--payload` instead of `bad-provider: "unknown provider: undefined"`. `parseArgs` stays pure and exported, `{cmd, opts}` intact, refusal rides back as a third `badArg` field. `references/seams.md` unchanged. |
| 6: `config.mjs` reads `--file` through the declaration | 1cd36c9 | All three spellings (bare, empty, flag-shaped) refused by one rule; `validate --file --nonsense` is now `usage` naming `--file` instead of `read: "cannot read/parse --nonsense"`. Wording verbatim, `--global` still short-circuits first, consumed tokens still filtered out. |

Final state: `node cadence-core/bin/test.mjs` 2377 tests, 2377 pass, 0 fail.
`npx tsc -p tsconfig.ci.json` exit 0. `node cadence-core/bin/self-verify.mjs`
`{"ok":true,...,"problems":[]}`. `git diff 983c143..HEAD` touches only the nine
leased files; `cadence-core/references/seams.md` unchanged.

Deviations: none.

Open items:
- No lint command exists for this repo: `workflow.lint_command` is null and
  `planning.mjs detect-commands --root /code/cadence` reports `lint:null`.
  Typecheck (`npx tsc -p tsconfig.ci.json`) is the whole static-analysis surface
  and it is clean at every step.
- Task 1 also refuses a WHITESPACE-ONLY `--dir "   "`, which the declared row's
  `string` classifier judges (trim clause included). Baseline answered ok:true
  about `./.planning` for that spelling too; it is the same defect, so it is
  closed rather than carved out.
- Task 2 narrows two spellings the task did not name, both on `fallback` rows:
  a whitespace-only `--plan "  "` / `--sha "  "` / `--base "  "` now omits its
  key where it previously stored the blank string (the `string` classifier's
  trim clause reaching a `fallback` disposition), and a REPEATED flag now reads
  its FIRST occurrence rather than its last, because `flagValue` uses `indexOf`
  where `parseArgs` overwrote. Neither is exercised by any test or any shipped
  call site in the tree.
- Task 3 carries the same first-occurrence-wins change on route.mjs's five
  `resolve` flags, for the same reason.
- Task 5 reads the VALUE door only: `review-provider.mjs`'s rows declare
  `required: true` for `--provider` and `--model`, and that half is deliberately
  left to `resolveProvider`, which owns the wording `references/seams.md`
  publishes. Moving presence into the door would change which reason a caller
  sees for an absent `--provider` (`bad-provider` -> `bad-args`), with no
  acceptance criterion behind it. Also narrowed there: an UNDECLARED flag is now
  dropped rather than stored on `opts`, which nothing reads.
- `config.mjs`'s `get` row in `lib/arg-contract.mjs` declares no `--global`,
  though `config.mjs get <key> --global` works and is exercised. That table is
  plan 1's lease, not this plan's, and nothing goes red today because no prose
  invocation spells it - self-verify check 2 lints prose, and none carries that
  pair. Worth a row on a later pass.
