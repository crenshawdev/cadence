---
phase: 2
status: complete
completed: 2026-08-25
---

# Phase 2: The host writes the bracket - Summary

A `SubagentStop` hook now closes the lifecycle bracket the orchestrator opened, so
a bracket survives the session that opened it; the hand-written `trace close` is
kept as the fallback that alone carries the figures, and `renderTrace`'s
worker-key dedup folds whichever writer arrives second into the first's row.

## What shipped

- `--duration-ms` on `trace append|close`, a closed digits-and-unit grammar that refuses a mistyped spelling with nothing appended - `cadence-core/bin/lib/arg-contract.mjs`, `cadence-core/bin/planning/trace.mjs`
- `duration_ms` on every bracket whose close reported one, read off the terminal under the same numeric guard `tokens`/`turns` carry - `cadence-core/bin/lib/trace.mjs`
- Close dedup on the `(corr, phase, plan)` worker key: two closes of one dispatch render as one bracket, no second `unpaired` row, no double coordinator span - `cadence-core/bin/lib/trace.mjs`
- `role` on every `unpaired[]` row, so an open dispatch names the role it was opened under - `cadence-core/bin/lib/trace.mjs`
- `closeForStop(payload, render)`, the pure rule deciding which bracket a stopped subagent closes: self-filter, adopt the newest open dispatch of that role, emit a figureless `return` - `cadence-core/bin/lib/subagent-trace.mjs`
- The `SubagentStop` hook itself, on `read-trace.mjs`'s contract (silent, exit 0 unconditionally), registered with no matcher and `timeout: 10` - `cadence-core/bin/subagent-trace.mjs`, `hooks/hooks.json:27`
- `self-verify` check 25: a hand-maintained `HOOK_EVENTS` register pinning the event names Cadence registers, so a host rename reddens a check - `cadence-core/bin/lib/hook-events.mjs`
- The host-return dependency stated where a reader finds it: which figures Cadence reads off a return, what each funds, and that the rendering can change with no deprecation - `cadence-core/references/seam-spawn-agent.md`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 04086a80 | `trace close` takes a duration in the spelling the host prints |
| 1 | 2 | 0750231b | a bracket carries the duration its close reported |
| 1 | 3 | 0683c108 | two closes of one dispatch render as one bracket |
| 1 | 4 | 96219875 | an open dispatch names the role it was opened under |
| 1 | 5 | 6fbf0efb | state the host-return dependency where a reader finds it |
| 2 | 1 | e9a7912c | the rule that decides which bracket a stopped subagent closes |
| 2 | 2 | 518728f6 | register `SubagentStop` and let it write the close |
| 2 | 3 | e8bd05c1 | `self-verify` pins the hook event names Cadence registers |
| 2 | 4 | b5a8aaf4 | the prose says who may write the trace, in all three places |

## Deviations

- [deviation] plan-1 task 3: the plan's Verify asked for a reversed-order fixture rendering "a deep-equal result", which no render can satisfy - `file` is a scratch path and `events` echoes the file's own line order, since the render reports the record rather than editing it. Compared everything the render DERIVES instead (`brackets`, `unpaired`, `mismatched`, `roles`, `counts`, `corr`), which is the whole of what the dedup decides. Observed as a test failure and fixed in the same task. Commit 0683c108.
- [deviation] plan-2 task 4: the seam-side correction first landed as its own paragraph and reddened `prose-agreement.test.mjs`'s MSR-01 arm, which reads the bracket rule as a single block terminated by the first blank line. Merged into the one paragraph instead, which is what the ONE-statement rule requires. Observed as a test failure and fixed in the same task. Commit b5a8aaf4.

## Open items

- AC2 and AC3 are UNVERIFIED live and belong to UAT. Every automated arm passed, including a synthetic-payload pipe against a scratch project, but the plan's human-verify clause needs a real Cadence dispatch that returns with NO hand-written `trace close` issued, then `trace render --phase 2` listing that worker under `brackets`. The executor's environment cannot produce a live subagent dispatch.
- Nine literal `trace close` command lines in `cadence-core/workflows/` and `cadence-core/references/` (`plan.md` twice, `context.md`, `verify-deep.md`, `decision-review.md`, `minimalism-review.md`, `review-triggers.md`, `plan-revision.md` twice) still spell `--tokens ... --turns ...` with no `--duration-ms`, so an orchestrator copying one verbatim records no wall clock for that role. Deliberately out of scope per CONTEXT's scope boundary and D-12.
- `risk_surface` fired on plan 2's range (`untrusted_input`, a changed `JSON.parse`). The cross-model reviewer's one `high` was adjudicated to `low` and filed to the tracker as fingerprint `55d0841ac5ee9c94`: `subagent-trace.mjs:62` trusts the hook payload's `cwd`, so a forged stdin could append one duplicate close to another project's gitignored trace. Gate passed - 0 survived, 1 downgraded, 0 refuted.

## Goal check

The nine commits deliver the phase goal. The host-side writer exists and is
registered: `hooks/hooks.json:27` declares `SubagentStop` running
`cadence-core/bin/subagent-trace.mjs` with `timeout: 10`, and the rule it calls
is `closeForStop` in `cadence-core/bin/lib/subagent-trace.mjs:93-127`, whose
three gates self-filter on the agent type, adopt the newest open dispatch of
that role, and emit a figureless `lifecycle`/`return`. The fallback is kept
rather than replaced - `execute.md`'s guardrails now enumerate all three writers
and name the hand-written close a deliberate fallback - and the dedup that lets
the first writer win is commit 0683c108's `pairedRows` map on the
`(corr, phase, plan)` key. `duration_ms` is live and was exercised in this run:
both of this phase's own closes were written with `--duration-ms` and accepted
(802630 and 739724). `self-verify` pins the event names as check 25, confirmed
by `hook-events` appearing in its `checked` list on a run I made myself.
Independent verification: 3321 pass / 0 fail, `tsc -p tsconfig.ci.json` exit 0,
`self-verify` `ok:true` with zero problems.

What is NOT proven: the hook has never fired. This session registered it mid-run,
so its own two executor dispatches were closed by the hand-written path and by
nothing else, and no bracket in the record was written by the host. AC2 and AC3
are UAT's to close, and until one live dispatch returns with no hand-written
close issued, "the bracket survives session death" is a claim the code supports
and the record does not yet witness.
