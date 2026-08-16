---
phase: 2
status: complete
completed: 2026-08-16
---

# Phase 2: The record learns to see the run - Summary

`trace close` now persists the tool-call count its return already carried, `trace render` reports turns per dispatch and per role beside a `turns_unrecorded` counter of their own, and the three surfaces that priced a run from worker-return tokens (`/cad-report`, `planning.mjs trace suggest`, `/cad-progress --trace`) now name the three sources that figure excludes instead of presenting it as the run's cost.

## What shipped

- `--turns` on the shared `trace append|close` body, validated beside `--raised` and omitted rather than zeroed when absent - `cadence-core/bin/planning.mjs`
- `brackets[].turns` and `roles[].turns` / `roles[].turns_unrecorded`, with their own recorded/figures/funded triple so tokens-without-turns stays distinguishable from turns-without-tokens - `cadence-core/bin/lib/trace.mjs`
- The close-half turn rule stated once, in the paragraph that already owned the bracket rule - `cadence-core/references/seams.md`
- `--turns` on all ten `trace close` invocations, bound by the producer census so a close site that drops it fails CI - eight workflow/reference files plus `cadence-core/bin/prose-agreement.test.mjs`
- `SPEND_EXCLUDES`, a frozen export naming the orchestrator's own turns, cross-model provider calls and figureless returns - `cadence-core/bin/lib/trace-suggest.mjs`
- The gap printed as its TERMS (dispatches, turns, per-dispatch window as a stated proxy, unmeasured count) against `burnrate` as a comparator the user runs, with no stored multiplier - `cadence-core/workflows/report.md`
- The `--phase` scoping fact stated: the filter reads `phase` alone and never `corr`, so one phase's figures can pool several runs - `cadence-core/workflows/report.md`
- The `roles` block described by what it carries rather than as a cost - `cadence-core/workflows/progress.md`
- Seventeen `DOCS-CLAIMS.md` ledger rows settled against the live files, three claims rewritten - `.planning/DOCS-CLAIMS.md`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 5924de4 | `--turns` records the tool-call count on a trace close |
| 1 | 2 | 38f5670 | the render reports turns per bracket and per role |
| 1 | 3 | c20d377 | the close-half rule governs the turn count too |
| 1 | 4 | b118576 | every close site names the turn count |
| 1 | 5 | fe62ebd | the producer census binds the turn flag to every close |
| 1 | 6 | 4b1d659 | the watched FAIL for MSR-01 |
| 2 | 1 | 6c4e8ac | the spend receipt names what its figure excludes |
| 2 | 2 | 8e2ee9f | the report states what its figure excludes and prints the gap as terms |
| 2 | 3 | 059493f | the trace step stops calling the roles block a cost |
| 2 | 4 | cf00dcc | the watched FAIL for MSR-02's seam half |
| 2 | 5 | be04f89 | the watched FAIL for MSR-02's prose half |
| 2 | 6 | 15610c8 | seventeen ledger rows settled against the live files |

Range `97eaf03..15610c8`, 12 commits. `risk-check run` answered `matches: []`, `inconclusive: false` on both plan ranges across all eight surfaces, and `risk-check status` reports `state: recorded` for both, so the blocking `risk_surface` gate did not fire and the record says so rather than leaving its absence to be inferred. The `diff` trigger resolved `off` at `shipped`.

## Deviations

None - plans executed as written.

## Open items

- Six close-site sentences reading `OMIT --tokens on a figureless return (seams.md's bracket rule)` still name `--tokens` alone rather than generalizing to `--turns`. Task 4's `Verify:` pins `grep -c -- --turns <file>` to an exact per-file census (1/2/2/1/1/1/1/1), and a prose mention would push `plan.md` to 4 and the others past their count, so naming the flag on the command line only is the shape that satisfies it. The omit rule for turns is stated once in `seams.md`, which those sites point at by design (D-04). Generalize the six sentences if a later task states a count that admits them.
- `detect-commands` reports `lint: null` for this repo, so there is no lint command Cadence can find. The static-analysis step for every task in this phase was `npx tsc -p tsconfig.ci.json` plus `node cadence-core/bin/self-verify.mjs`.
- Pre-existing, out of scope: `self-verify.mjs`'s budget-check comment states the budgets are an equality ("a shrink is as much a mismatch as a growth") directly above an implementation that makes it a ceiling (`if (bytes > budget)`). Three untouched surfaces currently sit under their pins - `cadence-core/workflows/debug.md` (6911 vs 6920), `skills/cad-capture/SKILL.md` (5751 vs 5850), `skills/cad-plan-review/SKILL.md` (2343 vs 2353) - which is legal under the code and contradicted by the sentence.

## Goal check

The phase goal was that turns and window stop being absent from `trace.jsonl` so a run's price can be argued from the record rather than from a figure that structurally cannot include the orchestrator, and the twelve commits deliver the turns half outright and the window half as stated terms rather than as a recorded number. Turns are live and self-demonstrating: `planning.mjs trace render --phase 2` reports `cad-executor` at `turns: 204, turns_unrecorded: 17`, and 204 is exactly this phase's two executor closes (127 + 77 tool calls), with the 17 being older dispatches that predate the flag, which is the AC2 property - a dispatch that reported no figure is counted separately rather than priced as free. The writer half is enforced rather than documented: `prose-agreement.test.mjs`'s producer census fails naming the offending file when `--turns` is deleted from any of the ten close lines (watched red against `cadence-core/workflows/context.md`, per plan 1 task 5), and the MSR-01 falsifier was watched failing at `97eaf03` with its unpatched output recorded verbatim in the test header. The reader half no longer asserts a multiplier: `SPEND_EXCLUDES` is one frozen export that both `trace suggest`'s receipt and `workflows/report.md` read, both watched failing at `4b1d659`, and the gap now prints as dispatches, turns, a per-dispatch window figure stated as a proxy, and the unmeasured count, against `burnrate` as a comparator the user runs rather than a ratio Cadence stores. Suite is 2083 pass / 0 fail, `self-verify --root .` returns `problems: []`, `tsc -p tsconfig.ci.json` exits 0. What is honestly NOT delivered is a recorded window size: the record still holds no per-message context figure, so `cost ~= turns x window x 0.10` remains an argument the reader assembles from a proxy rather than an arithmetic the file supports, which is the boundary MSR-03 was always going to own. The `--phase` pooling fact is now stated rather than fixed, so a phase-scoped figure can still span several runs' events - documented in `workflows/report.md`, not closed.
