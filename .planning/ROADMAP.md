# Roadmap: v3.7.4 - cut the cost the record can now measure

## Overview

**`v3.7.4`, opened 2026-08-26.** Three phases against the `Dispatch cost`
milestone, which `v3.7.3` opened and did not finish. That cycle fixed the
instruments and closed at phase 1; this one spends what they measure.

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
bracket now records cache traffic. `RNG-03` declared itself blocked on exactly
that, and is no longer blocked: the prefix claim can be measured before and
after rather than asserted.

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
- [ ] **Phase 2: Unforeclose the shared rung prefix** - move the rung label off body line 2 so a role's rungs share a cached prefix, proved with the cache figures v3.7.3 shipped
- [ ] **Phase 3: Keep the record writable** - rotate `trace.jsonl` before the 1 MiB cap makes it permanently write-dead

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
**Goal:** A role's rung files share a cached prefix instead of diverging at body line 2, and the recovery is measured rather than asserted. `RNG-03` declared itself blocked on cache figures; `TRC-05` shipped them in v3.7.3, so the claim is now checkable.
**Depends on:** nothing
**Requirements:** RNG-03
**Success Criteria:**
1. Every rung file for one role shares a byte-identical prefix up to the first point where the rungs genuinely differ, verified by a check that fails when a future rung file breaks it.
2. `route.mjs resolve` returns the same agent, model and effort for every rung as it does today, so the move changed layout and not routing.
3. The cache-read figures on the bracket are compared across a before and after run of the same role, and the result is recorded with its method, including the case where the recovery is zero.
4. `node cadence-core/bin/test.mjs` is green and `self-verify` reports no problems.

### Phase 3: Keep the record writable
**Goal:** `.planning/trace.jsonl` stops being able to reach a state where every subsequent append fails forever. Today it silently write-deads at 1 MiB and sits at 54.1%.
**Depends on:** nothing
**Requirements:** TRC-08
**Success Criteria:**
1. A trace at or over the cap is rotated rather than refused, and an append after rotation succeeds.
2. The rotated content is still readable by whatever reads the trace, or the rule for what is dropped is stated where a reader will find it.
3. A rotation is visible: a caller can tell that one happened rather than inferring it from missing events.
4. The 1 MiB cap still bounds any single file, so rotation did not remove the bound it replaces.
5. `node cadence-core/bin/test.mjs` is green and `self-verify` reports no problems.
