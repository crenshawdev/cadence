PLAN COMPLETE
Plan: .planning/phases/4/PLAN-4.md
Tasks: 1 of 1
| Task | Commit | Note |
|---|---|---|
| 1. The arguments section and its budget row | 6985052 | New `## Seam arguments` section in `references/conventions.md`, placed between Config resolution and Caller-derived text; `weight-budgets.json` re-pinned 12082 -> 14556 in the same commit against a MEASURED `weight.mjs --root .` figure, not an estimate. self-verify `{"ok":true,...,"problems":[]}`; `npx --no-install tsc -p tsconfig.ci.json` exit 0; `node cadence-core/bin/test.mjs` 2373 tests, 2373 pass, 0 fail. |

Deviations:
- [deviation] Task 1's Verify asserts `node cadence-core/bin/test.mjs` reports 0
  failures. Predicted 0 of 2373; observed 1 failure on the FIRST draft of the
  section, and it was the prose's own doing rather than a pre-existing break.
  `trace.test.mjs:1599`'s producer census reads any prose LINE that names both
  `planning.mjs` and `trace append` as a real invocation, and the draft's
  sentence "`planning.mjs`'s shared `trace append|close` body" put both on one
  line, so the census asserted a `trace append` with no `--family`. The plan
  anticipated only self-verify check 2's `unknown-flag` as the prose-lint hazard
  ("Any command spelling the section uses must be one the contract's own row
  already allows"); the census is a SECOND prose lint over the same file and the
  plan does not name it. Reworded so `planning.mjs` and the two trace
  subcommands sit on different lines, keeping both named for the reader, and the
  suite is 2373/2373 green. Nothing about the rule the section states changed.

Open items:
- No lint command exists for this repo: `workflow.lint_command` is null and
  `planning.mjs detect-commands --root /code/cadence` reports `lint:null` with
  `typecheck:"npx tsc -p tsconfig.ci.json"`. Typecheck is the whole
  static-analysis surface and it is clean (exit 0) on the committed tree. Same
  finding plan 2 recorded.
- The section's `--branch`/`--dir` example ("the token after it is never
  consulted") describes the shipped `fallback` arm, which is what plan 3's first
  deviation measured: `git-branch.mjs decide --branch --dir <p>` answered
  `branch:"--dir"` before and answers the derived branch now. The prose states
  the RULE and does not enumerate plan 3's four measured spelling changes -
  those live in `.planning/phases/4/reports/plan-3.md` and in the seams' own
  headers, and a reference that listed them would be a changelog rather than a
  convention.
- `--version`'s two axes are cited as the example that `value` and `bare` differ
  on an ordinary flag (`refuse` on a blank value, `fallback` on a bare one).
  That is the row as shipped in `lib/arg-contract.mjs:647`, and it is the row
  behind plan 3's `release-bump.mjs bump --version "   "` reason-code move to
  `missing-flag-value`.
- The section states the disposition vocabulary, the two axes and the one
  declaration home, and stops there. The four-field grammar's per-field
  semantics, the two entry points (`evaluateFlag` returning versus `requireFlag`
  throwing) and the per-bin choice between them stay in the module header, which
  is where the D-08 reasoning already lives in full. Declined to restate them in
  the reference: the Must-be-true names three statements and a home, and a
  fourth copy of the header is the drift ARG-06 exists to end.
