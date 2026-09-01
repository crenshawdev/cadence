# cad-plan --gaps (cold branch)

Plan closure tasks for unresolved UAT items instead of planning the phase
from scratch. Loaded from plan.md when `--gaps` was passed; rejoin plan.md
at `spawn_planner` with Mode: gaps.

1. Read the outstanding items:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" uat status --phase <N>
   ```

   `no-uat`, or counts showing nothing failed/pending -> report that and
   stop ("Nothing unresolved in phase <N>'s UAT").

2. Read `.planning/phases/<N>/UAT.md` for the failed/blocked/pending items'
   detail (name, expected, reported evidence, cause where diagnosed).

3. Resolve the WRITE TARGET, which is a new numbered plan and never an
   overwrite of the plan already there:

   ```
   ls .planning/phases/<N>/PLAN*.md
   ```

   Take the next free plan number, counting a bare `PLAN.md` as plan 1 - so a
   phase holding `PLAN.md` alone gets `PLAN-2.md`, and one holding `PLAN-1.md`
   through `PLAN-3.md` gets `PLAN-4.md`. Carry that exact filename forward.

   Why a new file. Measured on a fixture 2026-08-31: with the gap plan written
   OVER `PLAN.md`, the prior run's `reports/plan-1.md` still read
   `PLAN COMPLETE` and `replay-check` answered `dispatch_set: []`, so nothing
   routing off the seam could see the gap plan at all. Renaming it `PLAN-2.md`
   in that same fixture returned `dispatch_set: ["PLAN-2.md"]` - which is what
   makes /cad-execute reach it and /cad-progress route to it. An mtime
   comparison was rejected: it does not survive a fresh clone or a checkout.

4. Continue to plan.md `spawn_planner` with:
   - Mode: gaps
   - Write target: the filename step 3 resolved, never `PLAN.md`.
   - The planner's read list additionally includes phases/<N>/UAT.md plus
     the existing PLAN* and SUMMARY* files.
   - The gap items (with their evidence and causes) go into the prompt as
     the work to close; the phase goal stays the ROADMAP goal.
