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

4. Continue to plan.md `spawn_planner` with:
   - Mode: gaps
   - Write target: the filename step 3 resolved, never `PLAN.md`.
   - The gap items (with their evidence and causes) go into the prompt as
     the work to close; the phase goal stays the ROADMAP goal.
