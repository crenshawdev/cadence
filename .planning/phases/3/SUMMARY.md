---
phase: 3
status: complete
completed: 2026-09-02
---

# Phase 3: The record states the effort that actually ran - Summary

The `SubagentStop` hook now reads the effort a worker ACTUALLY ran at off that
worker's own transcript (`agent_transcript_path`), carries it beside the rung it
was DISPATCHED under on both of its writes, and `/cad-report` prints the two as
separate columns and names their disagreement on the row it happened on.

## What shipped

- OQ-2 answered against the installed host, before any code - `.planning/spikes/host-effort-downgrade/SPIKE.md` (Claude Code 2.1.258 downgrades silently; the hook payload cannot see it, the worker's transcript can)
- `effortOf(text)` - the pure transcript rule, beside `cacheOf`/`terminalOf` in `cadence-core/bin/lib/subagent-transcript.mjs`: top-level key only, verbatim, unambiguous-or-nothing, a line reporting nothing is skipped
- `rungOfAgent(agent_type)` - the reverse map off the one `RUNG_FILES` table, beside `roleOfAgent` in `cadence-core/bin/lib/read-trace.mjs`
- Both hook writes (`return` and the `worker_cache` fact) carry `effort` + `rung` - `cadence-core/bin/lib/subagent-trace.mjs`; the payload's own `effort` is never read
- Bracket rows carry both strings by two routes - the close and the post-pass `worker_cache` fold - in `cadence-core/bin/lib/trace.mjs`, omitted independently when absent, fill-only-empty on a repeat close
- `/cad-report`'s Dispatches table gains a `ran` column beside `rung`, plus the `TWO EFFORTS` rule - `cadence-core/workflows/report.md`
- Reference and ledger caught up - `cadence-core/references/seam-spawn-agent.md`, `cadence-core/workflows/execute.md`, four re-pinned `REPORT-*` claim anchors, `TRC-13` and ROADMAP Phase 3 now name the worker transcript

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 3927ef1d | Write the OQ-2 spike record, before any code |
| 1 | 2 | f00d4f6a | The transcript rule answers the effort the worker ran at |
| 1 | 3 | b43574c1 | The rung a host agent type names, read off the one rung map |
| 1 | 4 | 0d461af6 | Both hook writes carry the observed effort and the dispatched rung |
| 2 | 1 | ffad7d0c | The bracket row carries both strings off a close |
| 2 | 2 | db164e84 | The post-pass fold lands both strings off a `worker_cache` fact |
| 2 | 3 | 7901d543 | `/cad-report` prints ran beside routed and names the disagreement |
| 2 | 3v | (no commit) | human-verify clause of task 3 - performed by the coordinator, PASSED |
| 3 | 1 | 5bc050e6 | The seam reference states what both hook writes now carry |
| 3 | 2 | b305b376 | `execute.md` states what the hook cannot see, not that it carries nothing |
| 3 | 3 | b0f02af8 | Re-pin the four claim-ledger anchors this phase moved |
| 3 | 4 | dd6f79e1 | `TRC-13` and the roadmap name the worker transcript, not the payload |

Range: `00d4cf02..dd6f79e1`, 11 commits.

## Deviations

- [deviation] plan-3: The plan asserted `EXECUTE-41` and every `EXECUTE-*` row anchored at or past `execute.md:277` would shift by whatever task 2 added. It did not: task 2's net insertion is one line at `:606`, past every `EXECUTE-*` anchor (the highest is `EXECUTE-30` at 438-439), and the `:283-284` edit replaced two lines with two. No `EXECUTE-*` row shifted and none was re-pinned; all 47 anchors were re-read to confirm. (b0f02af8)
- [deviation] plan-3: The plan's `## Must be true when done` reads "every row anchored in a file this phase changed still names the lines its claim describes". Not achievable within D-13's rule, and not this phase's doing - the run-2-era anchors in `workflows/report.md` (REPORT-03..11, REPORT-16..23) and `workflows/execute.md` (nearly every `EXECUTE-*` row) already named lines 30-150 off BEFORE this phase, because those files grew across v3.7.x while the rows kept their sweep-era numbers. D-13's rule is "anchors that SHIFT re-pin", and the four `REPORT-*` rows were the ones this phase shifted. The pre-existing set is carried as an open item below rather than swept here. (b0f02af8)

## Review gates

| Plan | Trigger | Gate | Raised | Outcome |
|---|---|---|---|---|
| 1 | risk_surface | blocking | 1 (high) | PASS - 0 survivors, 1 refuted; declined |
| 1 | diff | blocking | 1 (blocker) | PASS - 0 survivors, 1 refuted; declined |
| 2 | risk_surface | - | - | not fired (detector matched nothing on the range) |
| 2 | diff | blocking | 1 (medium) | PASS - 1 survivor, below the halting severities; filed as GH-241 |
| 3 | risk_surface | - | - | not fired (detector matched nothing on the range) |
| 3 | diff | blocking | 0 | PASS - the review RAN and raised nothing |

Plan 1's two findings were the SAME phantom `SyntaxError` at
`cadence-core/bin/subagent-transcript.test.mjs:294-295`, raised independently by
two voices. Both were refuted against ground truth: `node --check` exits 0 and
`node --test` on that file reports 22 pass / 0 fail at `0d461af6`. Both provider
envelopes reported `redactions: 1`, so the span both voices judged unparseable
is the outbound credential fence's replacement inside the TRANSMITTED artifact,
not the committed source. Fingerprints `112e2c2d56f04b46` and `c4d403f3c2f3f4eb`
are in `.planning/DECLINED.md`.

## Open items

- No lint command for this project: `workflow.lint_command` is null and `detect-commands` returns `lint: null`. Typecheck is `npx tsc -p tsconfig.ci.json` and ran before every commit. Raised by all three plans, stated once and skipped.
- Roughly 21 `REPORT-*` and 45 `EXECUTE-*` claim-ledger rows carry run-2-era line numbers that no longer name their claim, by 30-150 lines. Pre-existing, not caused by this phase. Re-pinning them is a ledger sweep of its own (the `/cad-docs-verify` run-3 job) and needs scheduling.
- `plan-2`'s collection gate admits a `worker_cache` fact carrying a `rung` and no `effort`. The hook writes the two as a pair or not at all, so the arm is unreachable from Cadence's own writer; it exists because the close route already answers the two keys independently, and two rules for one pair is the worse outcome. Sixteen characters, one `||` term.
- `plan-1`'s task 4 `Verify:` cites two "exact key-set assertions" at `:429-451` and `:501-512`. The first is real (it sits at `:445`); `:501-512` is the `billedStop` fixture helper, not an assertion. All three `Object.keys(...)` pins (`:78`, `:92`, `:445`) are unedited and green, so the criterion is met in a stronger form than written.
- `plan-1` declined the fuller `effortOf` reader shape a literal reading of D-07 would give (answer absent whenever ANY assistant line lacks an effort). The plan's own DIVERGENCE note authorizes the skip and names the flip direction; one assertion and the `continue` beside it are the whole change if UAT disagrees.
- `cadence-core/bin/issue-filing.mjs file` is idempotent on the TRACKER but not on `.planning/FILED.md`: a repeated call for one fingerprint created no duplicate GitHub issue but appended a second identical ledger row. Hit during this run (the duplicate row was removed by hand before the docs commit). Not filed - raised here for triage.

## Goal check

The sum of these eleven commits delivers the phase goal. Every success criterion
in ROADMAP.md's Phase 3 entry is met and evidenced: OQ-2 was answered against
the installed host BEFORE any code, in the first commit of the phase and alone
(`3927ef1d`; `git show --name-only` counts 0 files under `cadence-core/`), with
the finding written to `.planning/spikes/host-effort-downgrade/SPIKE.md`. A
`lifecycle/return` now carries the effort the host actually served
(`0d461af6` puts `effortOf(transcript)` on both hook writes; `ffad7d0c` and
`db164e84` land it on the bracket row by both routes), beside the routed effort
already on `routing/resolve`. A dispatch whose transcript reported no effort is
recorded as unrecorded and never as a match - the key is OMITTED rather than
placeheld (`subagent-transcript.mjs`'s `effortOf` returns null for absent AND
for disagreement), and the coordinator's live human-verify exercised exactly
that row: `{plan 3, no effort key, no rung key}` rendered `unrecorded` under
`ran` and was never shown as agreeing. `/cad-report` states a routed/ran
disagreement rather than smoothing it over (`7901d543` adds the `ran` column and
the `TWO EFFORTS` rule at `workflows/report.md:114,139-155`; the minted record's
middle row printed `| cad-executor | xhigh | high | ... |  <- ran high,
dispatched xhigh: DISAGREEMENT` on the row itself, not in a summary line).
`GH-226` traces to `TRC-13`, which `dd6f79e1` rewrote to name the worker
transcript and which `REQUIREMENTS.md:494` already carries as
`| TRC-13 | Phase 3 | Pending |`. Nothing looks missing against the goal. What
is NOT delivered and was never in scope: what to DO about a mismatch - warn,
refuse, re-dispatch - which the roadmap entry explicitly defers as a separate
decision. The suite is green at HEAD (3,747 pass, 0 fail), `npx tsc -p
tsconfig.ci.json` exits 0, and `self-verify` reports `problems: []`.
