# Roadmap: v3.7.3 - the record has to be right before it can be cut (CLOSED at phase 1)

## Overview

**`v3.7.3`, opened and closed 2026-08-26.** Opened with four phases against
the `Dispatch cost` milestone; CLOSED at phase 1. The subject was what a
dispatch costs, and the cycle opened by fixing the instruments rather than the
cost, because every argument for cutting the cost is denominated in figures this
repository records about itself.

**Why it closed early.** Half this cycle's code commits were fixing the other
half - 7 fix against 7 feat, where `v3.7.1` ran 27% and `v3.7.2` 22%. Four of
those seven fixes were four passes at one question: which in-flight dispatch an
async `SubagentStop` callback belongs to. And one real defect (`1b123d20`,
the bracket span ending at the first close rather than the later one) landed
after phase 1's UAT reported 8 passed and 0 failed, so the phase gate did not
catch the class. Phases 2, 3 and 4 all sat on that same subsystem, so the rate
would have carried rather than settled. Phase 1 shipped and is verified; the
five ids the other three phases carried are under `## Deferred` in
REQUIREMENTS.md, intact, each with its own promote condition.

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

Both of this cycle's open questions belonged to phase 3 (`BUD-03`, `RSK-05`) and
were deferred with it. They are recorded on those ids in REQUIREMENTS.md's
`## Deferred` section and are not live scope until a phase picks one up.

## Phases


## Phase Details
