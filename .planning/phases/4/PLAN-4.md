---
phase: 4
plan: 4
requirements: [ARG-06]
files:
  - cadence-core/references/conventions.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 4: One argument contract instead of nine - Plan 4

## Goal

The rule the contract now carries out is stated once in prose, so a tenth seam's
author reads what a flag must declare instead of inferring it from eight
existing seams.

## Must be true when done

- `references/conventions.md` carries an arguments section stating the three
  dispositions and the bare-flag-versus-empty-value split as a separate axis,
  and naming the one module a new seam declares in.
- The section states that the contract classifies while the CALLER owns its own
  `reason` string, which is why the same `--dir` rule surfaces as `bad-args` in
  one bin and `missing-flag-value` in another.
- `cadence-core/references/conventions.md`'s `weight-budgets.json` row equals
  its new byte size, changed in the same commit as the section.
- `node cadence-core/bin/self-verify.mjs` returns `{"ok":true,...,"problems":[]}`
  with no `budget-overrun` and no `unknown-flag` from the new prose.
- `npx tsc -p tsconfig.ci.json` reports zero errors and `node
  cadence-core/bin/test.mjs` reports 0 failures across the whole phase's work.

## Context

D-15 binds the home: there is no existing one. `conventions.md`'s headings are
Paths, Deliberate shortcuts, Config resolution, Caller-derived text, Bulk tool
output, Parallel work, State, Subagents and reviews, Reporting style and
Authoring style, none of them arguments; and `references/seams.md` names only
`ask-user`, `spawn-agent` and `call-review-provider` as seams, the bin-CLI
family not among them. D-16 binds the budget mechanics: the weight check is a
documented CEILING and only growth needs a re-pin, but `conventions.md` sits at
exactly 0 B of headroom (12082/12082, verified 2026-08-19), so the section
cannot land without its row moving in the same commit. This plan runs LAST on
purpose: prose written before the adopters exist would state a reach the tree
does not have, which is the `#67` failure this repository has already paid for
once.

## Tasks

### Task 1: The arguments section and its budget row

- **Files:** cadence-core/references/conventions.md, cadence-core/bin/weight-budgets.json
- **Action:** Add a new arguments section to `references/conventions.md` stating
  three things and no more. First, a flag declares a DISPOSITION and not merely
  a type, and there are exactly three - refuse, warn, fall back - each of which
  is a reasoned position somewhere in this tree: `issue-check.mjs` falls back to
  a constant on a malformed `--timeout-ms` because that seam's whole contract is
  that it never fails a land, `route.mjs` warns on a `--phase` outside the
  accepted shape because a refusal would route the phase lower than its own
  baseline, and the `--dir` family refuses. Second, the bare-flag disposition is
  declared SEPARATELY from the value disposition, because one function body in
  `planning.mjs` runs both side by side: a bare `--step` refuses while a bare
  `--plan` is dropped, and collapsing the two would either start refusing every
  shipped `trace close` or would silence a refusal written against a
  complete-looking event that defeats attribution. Third, a new seam DECLARES
  its flags in the shared module rather than restating the rules, and the module
  classifies while the CALLER owns its own `reason` string - which is why one
  `--dir` rule surfaces as `bad-args` in `planning.mjs` and as
  `missing-flag-value` in the seams that hold an `e.seam` catch arm. Follow the
  file's existing form: short bulleted rules, the rule first and its reason
  second, no fenced code blocks, and the module cited by path the way the
  Caller-derived text section cites `lib/text-transport.mjs`. Any command
  spelling the section uses must be one the contract's own row already allows,
  or self-verify check 2 reports `unknown-flag` against this very file. Re-pin
  `cadence-core/references/conventions.md` in
  `cadence-core/bin/weight-budgets.json` in the SAME commit, to the file's new
  exact byte size: the row is 12082 against a measured 12082 B, exactly 0 B of
  headroom, so the section cannot land without it (D-16).
- **Verify:** `wc -c < cadence-core/references/conventions.md` equals the
  `"cadence-core/references/conventions.md"` value in
  `cadence-core/bin/weight-budgets.json`; `node
  cadence-core/bin/self-verify.mjs` returns `{"ok":true,...,"problems":[]}` with
  no `budget-overrun` and no `unknown-flag` naming
  `cadence-core/references/conventions.md`; `npx --no-install tsc -p
  tsconfig.ci.json` reports zero errors; `node cadence-core/bin/test.mjs`
  reports 0 failures.

## Notes

Depends on plan 1, and is written to be executed after plans 2 and 3 so the
prose describes the reach that shipped rather than the reach that was intended.
Shares no file with any other plan in this phase.

`npx tsc` resolves offline here: `typescript` is present in `node_modules` and
`npx --no-install tsc --version` reports 7.0.2, so the `--no-install` form is
the one to run rather than the bare `npx tsc` that would try to fetch.
