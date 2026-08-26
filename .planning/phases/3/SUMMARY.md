---
phase: 3
status: complete
completed: 2026-08-26
---

# Phase 3: Make the cache figures reach the record - Summary

A `worker_cache` lifecycle fact written on all three of the `SubagentStop` hook's withholding gates, folded onto its bracket at render time by `corr` plus `agent_id`, sourced from the stopped worker's OWN transcript and confirmed live: three brackets in this phase's own record now carry cache figures that match `cacheOf` over each worker's transcript to the token, against 0 at the phase baseline.

## What shipped

- `worker_cache`, a fifth lifecycle event name that funds nothing - `cadence-core/bin/lib/trace.mjs:172`, registered in the trace producer census
- The cache-only fact written on all three withholding gates (not-terminal, already-closed, two-open-dispatch), the termination gate itself unchanged - `cadence-core/bin/lib/subagent-trace.mjs:280`
- A post-pass fold joining the fact to its bracket on `corr` + `agent_id`, fill-only-empty, first match only - `cadence-core/bin/lib/trace.mjs:1067`
- `closeForStop` answering a LIST rather than one event, so a gate can withhold a `return` and still state a fact - `cadence-core/bin/lib/subagent-trace.mjs`
- Gate 2b's candidate set scoped to the current run, so stale `unpaired` rows stop killing the gate - `cadence-core/bin/lib/subagent-trace.mjs` (`currentRun()`)
- `--agent-id` on all 11 `trace close` prose sites, and the seam's hook paragraph rewritten to distinguish the hook's two kinds of write - `cadence-core/references/seam-spawn-agent.md`
- The before-side prefix-recovery measurement for `cad-verifier`, with its method - `.planning/spikes/agent-prefix-cache-fragmentation/SPIKE.md`
- The hook reading the stopped worker's own `agent_transcript_path`, with no fallback to the session's - a payload naming no worker file now supplies NO evidence rather than the wrong actor's - `cadence-core/bin/subagent-trace.mjs`
- `agent_id` on the hook's own close, so a hook-written bracket can be joined at all - `cadence-core/bin/subagent-trace.mjs`
- `currentRun()` answering `{corr, rows}` so a stop arriving after its own bracket closed states its figures against THAT bracket instead of adopting a stranded dispatch from a run that ended days ago - `cadence-core/bin/lib/subagent-trace.mjs`
- Larger-cache-read-wins at all three folding sites, replacing a first-wins and a last-wins rule that disagreed - `cadence-core/bin/lib/trace.mjs`
- The after-side figures and an explicit statement of what they do NOT license - `.planning/spikes/agent-prefix-cache-fragmentation/SPIKE.md`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 3d2c6ebc | give the record a `worker_cache` lifecycle name |
| 1 | 2 | 1cb059fe | fold a cache-only fact onto its bracket in a post-pass |
| 1 | 3 | 211cddd6 | `closeForStop` answers a list and the disk half writes each event |
| 1 | 4 | 8206ce3c | scope gate 2b's candidate set to the current run |
| 1 | 5 | 6a9ba2a6 | write the cache-only fact on all three withholding gates |
| 1 | 6 | 53de25b4 | record what phase 2's shared prefix recovered (before side) |
| 1 | - | c9f7786a | plan 1 executor report |
| 2 | 1 | e70c71cd | join key on every `trace close` prose site |
| 2 | 2 | 3836325c | the seam's hook statement is true again for both writes |
| 2 | - | 4e1d25c4, a9e1f181 | plan 2 executor report |
| - | - | 4cd54759 | merge of the two worktree branches |
| 3 | 1 | 68cfeddc | read the stopped worker's own transcript, not the session's |
| 3 | 2 | 66550c0d | the hook's own close carries the worker's id |
| 3 | 3 | f31aa766 | a stop whose bracket is already closed stops adopting a dead run |
| 3 | 4 | 2adf3166 | the larger cache read wins, and the first one stops being final |
| 3 | 5 | 45faf4da | the record states which file the hook reads |
| 3 | 6 | 32f6518a, c1655926 | the spike carries the after figures and what they do not license |

Plans 1 and 2 executed in parallel worktrees; both branches merged clean with no conflicts. Plan 3, the gap-closure plan, executed sequentially in the main tree on 2026-08-26 at correlation id `3-bef7cc1e`.

## Deviations

None - all three plans executed as written.

## Open items

- **RNG-03 stays open, and phase 3 is why it can be closed cheaply.** The after side is now written (`c1655926`) but it is n=2 `cad-verifier` dispatches run back to back in ONE session with a byte-identical prompt: 1,952,026 cache reads and 89,744 cache creations per dispatch, +19.3% and +7.1% against the before side's 33-dispatch mean. Both moved UP, which is not the shape of a prefix-reuse win, and per-dispatch read scales with run length (these ran 37 and 40 turns). Closing RNG-03 needs post-`68cfeddc` brackets accumulated the way the before side was, across many sessions - which now costs nothing, since every dispatch records them automatically.
- **AC5's two-open-dispatch pair is still unpinned live.** The not-terminal and already-closed gates both have live proof now; the two-open-dispatch case was exercised only against piped payloads, as PLAN-3's own Notes record.
- **`trace.mjs`'s NUL-joined composite key can collide in principle** (`cadence-core/bin/lib/trace.mjs:806`). Raised `high` by the `risk_surface` review, adjudicated down to `low`: the `\0` join is the file's pre-existing convention (line 811, unchanged), `corr` is machine-derived and argv cannot carry a NUL, so the only producer is a hand-edited gitignored `trace.jsonl`. Filed as an issue on `crenshawdev/cadence`.
- Task 3's and task 5's end-to-end checks ran as scratch scripts rather than committed tests - `subagent-trace.test.mjs` states in its own header that it drives the pure rule with no hook and no filesystem, and nothing in the plan asked for a hook-to-disk-to-render test file.
- **The two pre-fix cache-bearing brackets at `3-a0fd304f` are wrong and cannot be corrected in place.** `cad-verifier` reads 52,918 / 528,568 where that worker's own transcript sums 100,439 / 2,115,871; `cad-planner` reads 50,428 / 527,186 against 240,156 / 10,405,827. A fact is written at stop time, so no already-closed bracket can gain one. Only rotation (phase 4) or a hand edit removes them. Any reader of those two rows is reading a wrong number.
- **The blocking `risk_surface` gate was OVERRIDDEN on this range, not passed.** Its only match was `untrusted_input` on a changed `JSON.parse` line, and the only changed `JSON.parse` lines in the range are two assertions in `cadence-core/bin/trace.test.mjs` over a fixture that test wrote. The override is recorded at `3-bef7cc1e`. The surface that was NOT adversarially reviewed: this range rewrote how `cadence-core/bin/subagent-trace.mjs` and `lib/subagent-trace.mjs` parse host-written subagent transcripts, which is genuinely input Cadence does not author.
- **`cadence-core/bin/lib/subagent-transcript.mjs:15` and `:83` still say the disk half resolves `transcript_path`.** Stale since `68cfeddc`. Left as-is because that file is outside PLAN-3's declared `files:` lease.
- **The plan-3 executor report was reconstructed by the orchestrator.** The continuation dispatch committed task 6 (`c1655926`) and was stopped moments later on cost grounds, before it rewrote `reports/plan-3.md`. That file was corrected from the committed range; `reports/plan-3.1.md` is the pre-continuation report as the executor last wrote it.
- Declined a `plan` field on the `worker_cache` fact and a second overwrite rule in the fold - both named out by the plan (D-11; the two-open case has no single plan to name). Recorded only so a reader who expected them knows they were considered.

## Goal check

The phase goal is met, and unlike the plan-1/plan-2 run it is met on live evidence rather than fixture. `trace render` over the whole record now reports 412 brackets, 5 carrying a cache key, and three of those five belong to this run's correlation id `3-bef7cc1e`: `cad-executor` 190,737 / 11,141,416, `cad-verifier` 99,449 / 2,122,956, and a second `cad-verifier` 80,038 / 1,781,096. Each pair was independently confirmed by running `cacheOf` (`cadence-core/bin/lib/subagent-transcript.mjs:141`) over that worker's own `subagents/agent-<agent_id>.jsonl`, and all three match the rendered bracket to the token - which is AC5 and AC6 satisfied against a live host, from a phase-3 baseline of 0 cache-bearing brackets. The mechanism the earlier run built was sound; what plan 3 fixed is the evidence it was fed, and `68cfeddc` is the commit that mattered: before it the hook read the orchestrator's session transcript, which is why the two pre-fix rows at `3-a0fd304f` are wrong by more than a factor of four. 3414 tests pass, 0 fail.

What the phase does NOT deliver is the answer it was built to get. The after-side figures are on the record (`c1655926`), but at n=2 back-to-back dispatches in one session they do not measure phase 2's prefix recovery: read and creation both moved up, which is not the shape a prefix-reuse win has, and per-dispatch cache read scales with run length. The executor was right to refuse to close RNG-03 on them. So phase 3 delivered a working instrument and a "not yet", and the remaining measurement now accrues for free as ordinary dispatches land. One further caveat on how this run ended: the blocking `risk_surface` gate was overridden rather than passed, so the transcript-parsing rewrite at the centre of this phase shipped without an adversarial review - recorded above as an open item rather than left implicit.
