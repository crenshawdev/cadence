---
phase: 3
status: partial
completed: 2026-08-26
---

# Phase 3: Make the cache figures reach the record - Summary

A `worker_cache` lifecycle fact written on all three of the `SubagentStop` hook's withholding gates, folded onto its bracket at render time by `corr` plus `agent_id`, with `--agent-id` now on every `trace close` site in the prose so a non-executor bracket has something to join on.

## What shipped

- `worker_cache`, a fifth lifecycle event name that funds nothing - `cadence-core/bin/lib/trace.mjs:172`, registered in the trace producer census
- The cache-only fact written on all three withholding gates (not-terminal, already-closed, two-open-dispatch), the termination gate itself unchanged - `cadence-core/bin/lib/subagent-trace.mjs:280`
- A post-pass fold joining the fact to its bracket on `corr` + `agent_id`, fill-only-empty, first match only - `cadence-core/bin/lib/trace.mjs:1067`
- `closeForStop` answering a LIST rather than one event, so a gate can withhold a `return` and still state a fact - `cadence-core/bin/lib/subagent-trace.mjs`
- Gate 2b's candidate set scoped to the current run, so stale `unpaired` rows stop killing the gate - `cadence-core/bin/lib/subagent-trace.mjs` (`currentRun()`)
- `--agent-id` on all 11 `trace close` prose sites, and the seam's hook paragraph rewritten to distinguish the hook's two kinds of write - `cadence-core/references/seam-spawn-agent.md`
- The before-side prefix-recovery measurement for `cad-verifier`, with its method - `.planning/spikes/agent-prefix-cache-fragmentation/SPIKE.md`

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

Executed in parallel worktrees; both branches merged clean with no conflicts.

## Deviations

None - both plans executed as written.

## Open items

- **AC6's AFTER figure is unwritten, by construction.** `.planning/spikes/agent-prefix-cache-fragmentation/SPIKE.md` names the exact command and holds a PENDING placeholder. It needs at least two live `cad-verifier` dispatches that stop on the MERGED code. `/cad-verify 3` is the natural next producer.
- **AC5 has no live proof yet, for the same reason.** The three gate behaviours were proven end-to-end against a temp `.planning/` with piped `SubagentStop` payloads, but the live record still reads 0 cache keys over 87 phase-3 brackets, because no subagent has stopped since the merge landed.
- **`trace.mjs`'s NUL-joined composite key can collide in principle** (`cadence-core/bin/lib/trace.mjs:806`). Raised `high` by the `risk_surface` review, adjudicated down to `low`: the `\0` join is the file's pre-existing convention (line 811, unchanged), `corr` is machine-derived and argv cannot carry a NUL, so the only producer is a hand-edited gitignored `trace.jsonl`. Filed as an issue on `crenshawdev/cadence`.
- Task 3's and task 5's end-to-end checks ran as scratch scripts rather than committed tests - `subagent-trace.test.mjs` states in its own header that it drives the pure rule with no hook and no filesystem, and nothing in the plan asked for a hook-to-disk-to-render test file.
- Declined a `plan` field on the `worker_cache` fact and a second overwrite rule in the fold - both named out by the plan (D-11; the two-open case has no single plan to name). Recorded only so a reader who expected them knows they were considered.

## Goal check

The eleven commits deliver the phase's mechanism but not yet its measurement. The withholding-gate half is in and specific: `WORKER_CACHE` is exported at `cadence-core/bin/lib/trace.mjs:172` and consumed by the hook at `subagent-trace.mjs:280`, `closeForStop` now answers a list so a gate can withhold a `return` and still state a fact, and the render-time fold at `trace.mjs:1067` joins on `corr` + `agent_id` under a fill-only-empty clause with `break` on first match - which is AC2 as written. AC4 is met and checkable: `--agent-id` appears at 12 of the 15 `trace close` occurrences in the prose (the 11 command sites plus the seam's own rule statement; the remaining 3 are prose references, not command lines), against the 0-of-11 the phase started from. The suite is green on the merged tree (3410/3410) and `self-verify --root .` reports `problems: []`. What is NOT delivered is the thing the phase exists to prove: `trace render --phase 3` still reports 87 brackets with 0 carrying a cache key, because the instrument is a host firing `SubagentStop` against the merged code and no worker has stopped since the merge. AC5 and AC6 are therefore both outstanding, and AC6's `### After` section is a committed PENDING placeholder rather than a number. That is honest rather than fixable here - a continuation executor cannot manufacture a live stop either - so the first `/cad-verify 3` dispatches are what will produce the figures, and the phase should be read as partial until they do.
