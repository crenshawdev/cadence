# Roadmap: v3.7.3 - the record has to be right before it can be cut

## Overview

**`v3.7.3`, opened 2026-08-26.** Three phases against the `Dispatch cost`
milestone. The subject is what a dispatch costs, and the cycle opens by fixing
the instruments rather than the cost, because every argument for cutting the
cost is denominated in figures this repository records about itself.

**The measured state.** `cad-executor` is 25,587,266 of 50,145,905 recorded
tokens, 51% of the whole record, and its dispatches re-read 3.52 times per
distinct file, worst case `cadence-core/bin/planning.mjs` opened 57 times inside
one dispatch. 39 checkpoint returns say plans exceed one context. 233 of 239
executor dispatches across cadence and verbatim ran opus at `shipped`, and the
routing discount fired 6 times in total.

**Why the instruments come first.** Three of those figures cannot be trusted or
extended today. `renderTrace`'s close dedup pairs a delayed repeat close with
the NEXT dispatch of the same worker key, so on a retry the bracket carries the
wrong figures and the role is billed for all three terminals - reproduced
2026-08-26 on a six-line fixture, brackets `[1000, 9999]` where the second
should be 2222 and `roles.tokens` 13221 for two dispatches. `duration_ms` is
written onto every bracket by `planning/trace.mjs:795` and read by nothing, so
the worker's own wall clock has no consumer and `/cad-suggest`'s wall-time
figure comes from the bracket's `ms`, which includes the orchestrator's own
time. And no cache figures are recorded at all, which is why GH-91 declares
itself blocked.

**Then the cost itself.** `workflow.max_plan_tasks` bounds a plan by task count
and nothing bounds the bytes its `files:` frontmatter declares, which on one
measured `PLAN-1.md` was about 90% of a 70,554-token dispatch. The risk-routing
floor reads whole-file BODY lines rather than the diff, so any plan declaring a
large file inherits its matches and can never earn the discount.

**What this cycle is not.** It is not the worktree question and it is not a
reviewer-calibration cycle. The `risk_surface` reviewer set looked miscalibrated
in the v3.7.2 retune (4 of 22 adjudicated fires, 0 survivors of 2 raised); that
belongs to `Finding flood` with GH-100 and GH-135, not here.

## Open Questions

- **OQ-1 - what a byte bound actually bounds.** BUD-03 can bound the declared
  bytes, the estimated tokens, or refuse at plan time versus warn. The measured
  case (four files, 252,473 B, ~63,000 estimated tokens inside a 70,554-token
  dispatch) says the ratio is stable enough to bound either way. Decided at
  phase 2 planning against the actual `files:` declarations in the archive, not
  now.

- **OQ-2 - whether the risk floor can read a diff at plan time.** RSK-05 wants
  the floor to stop inheriting a whole file's matches, but at `check_census`
  time there is no diff yet - the plan has not run. Whether the fix is a
  narrower read, a waiver key, or a planner-contract line telling planners to
  declare narrow files is decided at phase 2 planning by reading what
  `planning/risk-check.mjs` actually has in hand at that moment.

## Phases

- [ ] **Phase 1: Make the record say what happened** - fix the close dedup on a repeat, land the stop close on the right worker, give `duration_ms` a reader, record cache figures
- [ ] **Phase 2: Bound what a dispatch is handed** - bound a plan by declared bytes, stop the risk floor inheriting a whole file's matches, unforeclose the shared rung prefix
- [ ] **Phase 3: Close the coverage and detector gaps** - walk `planning/` in the skim test, stop the risk detector re-tripping on stored reviewer text, home `DISPATCH_WINDOW_DEFAULTS` with its reader

## Phase Details

### Phase 1: Make the record say what happened
**Goal:** The three figures the rest of this cycle argues from are correct, consumable, and complete: a repeat close never steals the next dispatch's bracket, the worker's own duration has a reader, and a bracket records cache figures.
**Depends on:** Nothing (first phase)
**Requirements:** TRC-04, TRC-06, MSR-05, TRC-05
**Success Criteria:**
1. Replaying `dispatch A, close A, dispatch B, A's delayed repeat, close B` for one worker key renders two brackets carrying A's and B's OWN figures, and `roles.tokens` equals the sum of those two brackets, not of all three terminals.
2. With two open dispatches of one role, a `SubagentStop` payload closes the dispatch that actually stopped rather than the newest one, demonstrated against a fixture holding both; and a payload arriving while another stop hook is still blocking termination writes no `return` at all.
3. The ordinary two-writer case is unchanged: one dispatch, a figureless hook close, then the hand-written close with figures renders one bracket and `dispatches: 1`.
4. `/cad-report` and `/cad-suggest` each print a figure sourced from a bracket's `duration_ms`, labelled distinctly from the bracket's `ms`, and say `unrecorded` rather than `0` when the close carried no wall clock.
5. A bracket close records cache figures, and `trace render` reports them; a close carrying none omits the keys rather than writing zeros.
6. `node cadence-core/bin/test.mjs` is green and `self-verify` reports no problems.

### Phase 2: Bound what a dispatch is handed
**Goal:** A plan cannot silently hand its executor an unbounded read set, a plan declaring a large file can still earn the routing discount, and a role's rungs can share a cached prefix.
**Depends on:** Phase 1
**Requirements:** BUD-03, RSK-05, RNG-03
**Success Criteria:**
1. A plan whose `files:` frontmatter declares more than the configured byte bound is refused (or warned, per OQ-1) at plan time, naming the total and the bound; a plan under it passes unchanged.
2. The bound is a config key present in `config.schema.json` with a stated default, and `self-verify`'s config-reach check sees it.
3. A plan declaring one large file that matches a risk category only in lines its own change never touches resolves BELOW `shipped`, where the same plan resolves at `shipped` today.
4. No two rungs of one role diverge before their shared contract prose, demonstrated by a byte comparison of two rung files, and phase 1's cache figures show what the change recovered.
5. `node cadence-core/bin/test.mjs` is green.

### Phase 3: Close the coverage and detector gaps
**Goal:** The three known one-change gaps are shut: the skim test covers `planning/`, the risk detector stops re-tripping on its own stored reviewer text, and `DISPATCH_WINDOW_DEFAULTS` sits with its only reader.
**Depends on:** Phase 1
**Requirements:** COV-02
**Success Criteria:**
1. `skim.test.mjs` walks `cadence-core/bin/planning/` and its 30 modules appear in that test's covered set; deleting a line from one of them fails the test.
2. A docs commit landing an `ADJUDICATION-*.json` whose `failure_scenario` quotes a destructive command does not trip the `destructive` category, while a real destructive change in code still does.
3. `DISPATCH_WINDOW_DEFAULTS` is defined in the module that reads it and `planning/core.mjs` no longer exports it.
4. `node cadence-core/bin/test.mjs` is green and `self-verify` reports no problems.
