# Roadmap: v3.7.4 - cut the cost the record can now measure

## Overview

**`v3.7.4`, opened 2026-08-26.** Four phases against the `Dispatch cost`
milestone, which `v3.7.3` opened and did not finish. That cycle fixed the
instruments and closed at phase 1; this one spends what they measure - and, at
phase 2 planning, discovered it has to finish one instrument first.

**Why this scope and not the rest of the tracker.** The 31 open issues were
triaged 2026-08-26 against one question: would a user running Cadence on their
own project ever feel this, or does it only bite while Cadence is being
developed on Cadence? Three issues answered the second way and were declined
(GH-109, GH-111, GH-139). Everything in this cycle answers the first way, and
the first three are felt as money on every dispatch a user makes.

**The measured state.** `cad-executor` is 25,587,266 of 50,145,905 recorded
tokens, 51% of the whole record, and its dispatches re-read 3.52 times per
distinct file, worst case `cadence-core/bin/planning.mjs` opened 57 times inside
one dispatch. 39 checkpoint returns say plans exceed one context. 233 of 239
executor dispatches across cadence and verbatim ran opus at `shipped`, and the
routing discount fired 6 times in total.

**What changed since that was written.** `TRC-05` shipped in `v3.7.3`, so a
bracket CAN record cache traffic. `RNG-03` declared itself blocked on exactly
that, and its layout half is now unblocked. Its measurement half is not: phase 2
planning replayed the `SubagentStop` hook's own rule against the live record and
found 399 brackets carrying 0 cache figures, refused two gates earlier than the
recording path. That is `TRC-07`, promoted out of deferral on 2026-08-26 as
phase 3. The cycle grew a phase rather than shipping a claim it could not check.

**What this cycle is not.** It is not the worktree question (`Worktree verdict`,
blocked on GH-119 and GH-120), it is not reviewer calibration (`Finding flood`,
GH-100), and it is not GH-137, which is the highest-severity user-facing bug on
the tracker but belongs to the execute path rather than to dispatch cost. It is
filed and named here so the next cycle does not have to rediscover it.

## Open Questions

- **OQ-1 - what a byte bound actually bounds.** `BUD-03` can bound the declared
  bytes, the estimated tokens, or refuse at plan time versus warn. The measured
  case (four files, 252,473 B, ~63,000 estimated tokens inside a 70,554-token
  dispatch) says the ratio is stable enough to bound either way. Decided at
  phase 1 planning against the actual `files:` declarations in the archive.

- **OQ-2 - whether the risk floor can read a diff at plan time.** `RSK-05` wants
  the floor to stop inheriting a whole file's matches, but at `check_census`
  time there is no diff yet, because the plan has not run. Whether the fix is a
  narrower read, a waiver key, or a planner-contract line telling planners to
  declare narrow files is decided at phase 1 planning by reading what
  `planning/risk-check.mjs` actually has in hand at that moment.

## Phases

- [x] **Phase 1: Bound what a dispatch is handed** - bound a plan by the bytes its `files:` declares, and stop the risk floor inheriting a whole file's matches
- [x] **Phase 2: Unforeclose the shared rung prefix** - delete the rung sentence from every agent body so a role's rungs share a cached prefix, with a check that fails when a future rung file breaks it
- [ ] **Phase 3: Make the cache figures reach the record** - the two prompt-cache figures reach the bracket for every worker that stopped, so phase 2's recovery can be measured instead of asserted
- [ ] **Phase 4: Keep the record writable** - rotate `trace.jsonl` before the 1 MiB cap makes it permanently write-dead

## Phase Details

### Phase 1: Bound what a dispatch is handed
**Goal:** A plan cannot silently hand its executor an unbounded read set, and a plan declaring a large file can still earn the routing discount. Both are paid by every user on every phase, and neither is visible to them until the bill arrives.
**Depends on:** nothing
**Requirements:** BUD-03, RSK-05
**Success Criteria:**
1. A plan whose `files:` frontmatter declares more than the configured byte ceiling is reported at plan time, naming the plan, its declared bytes and the ceiling, in the same shape `plan-size` reports `plan-too-many-tasks`.
2. The ceiling has a config key with a stated default, and a plan under it is not reported at all.
3. The risk-routing floor no longer counts import lines or constant declarations as evidence of a risk surface for a path a plan merely declares: at least one scope drawn from `.planning/_archive-*` cites different evidence for its raise than it does today, naming in its `reason` the file whose body match no longer counts. Measured 2026-08-26 over all 28 archived phase directories: no scope on this corpus drops a rung, because every raising scope retains a genuine call site; the narrowing changes which evidence is cited, and a level drop is available only to a corpus whose raises rest on imports alone.
4. A plan that genuinely touches a risk surface still floors at the same rung it does today, so criterion 3 did not buy the discount by weakening the floor.
5. `node cadence-core/bin/test.mjs` is green, `self-verify` reports no problems, and any new config key is registered in `config.schema.json` and `config-catalog.md`.

### Phase 2: Unforeclose the shared rung prefix
**Goal:** A role's rung files share a cached prefix instead of diverging at body line 2. Whether that recovers anything on the record is phase 3's question, because the hook that would write the cache figures cannot reach its write path until `TRC-07` ships.
**Depends on:** nothing
**Requirements:** RNG-03
**Success Criteria:**
1. Every rung file for one role shares a byte-identical prefix up to the first point where the rungs genuinely differ, verified by a check that fails when a future rung file breaks it.
2. `route.mjs resolve` returns the same agent, model and effort for every rung as it does today, so the move changed layout and not routing.
3. `node cadence-core/bin/test.mjs` is green and `self-verify` reports no problems.

### Phase 3: Make the cache figures reach the record
**Goal:** The two prompt-cache figures reach the bracket for every worker that STOPPED, not only the ones the `SubagentStop` hook could both identify and call terminal. Until they do, phase 2's prefix recovery cannot be measured and every cost claim this milestone makes is denominated in a figure the record cannot carry. Baseline 2026-08-26: 399 brackets, 0 carrying a cache figure.
**Depends on:** nothing (phase 2 can land before or after; only its MEASUREMENT waits on this)
**Requirements:** TRC-07
**Success Criteria:**
1. All three withholding gates record the worker's cache figures and still write no `return` - not-terminal, already-closed, and two-open-dispatch - with the termination gate itself unchanged rather than relaxed.
2. `trace render` folds a cache-only fact onto the bracket for the same worker, joined by `corr` and `agent_id`. The fold never overwrites a bracket's `tokens`, `turns`, `duration_ms` or `agent_id`; for `cache_read_input_tokens` and `cache_creation_input_tokens` the LARGER value wins, per key and independently, because those two keys have exactly one writer and two values for one worker are two reads of a transcript that only grows - so a short read can never freeze a bracket and re-rendering the same file is idempotent. AMENDED 2026-08-26, in the same commit as the code that moved it (phase 3 plan 3 task 4).
3. A fixture holding an unpaired dispatch of one role from an EARLIER `corr` plus one open dispatch in the current `corr` closes the current one; the same fixture refuses today. Measured 2026-08-26: 11 stale `unpaired` rows spanning 2026-08-09 to 2026-08-26 make this gate permanently dead for five of six roles, and give `cad-verifier` a stale row it would MIS-ATTRIBUTE to rather than abstain from.
4. Every `trace close` prose site passes `--agent-id`, so a non-executor bracket is joinable at all.
5. After the change, a terminal stop, a not-terminal stop and a two-open pair each produce a bracket carrying both cache keys, each equal to the sum `subagent-transcript.mjs` reports for that worker's own transcript.
6. Phase 2's prefix recovery is compared across a before and after run of the same role off those figures, and recorded with its method, including the case where the recovery is zero.
7. `node cadence-core/bin/test.mjs` is green, `self-verify` reports no problems, and any new event name is registered in the trace producer census.

### Phase 4: Keep the record writable
**Goal:** `.planning/trace.jsonl` stops being able to reach a state where every subsequent append fails forever. Today it silently write-deads at 1 MiB and sits at 54.1%.
**Depends on:** nothing
**Requirements:** TRC-08
**Success Criteria:**
1. A trace at or over the cap is rotated rather than refused, and an append after rotation succeeds.
2. The rotated content is still readable by whatever reads the trace, or the rule for what is dropped is stated where a reader will find it.
3. A rotation is visible: a caller can tell that one happened rather than inferring it from missing events.
4. The 1 MiB cap still bounds any single file, so rotation did not remove the bound it replaces.
5. `node cadence-core/bin/test.mjs` is green and `self-verify` reports no problems.
