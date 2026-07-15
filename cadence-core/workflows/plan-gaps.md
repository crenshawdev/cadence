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

3. Continue to plan.md `spawn_planner` with:
   - Mode: gaps
   - The planner's read list additionally includes phases/<N>/UAT.md plus
     the existing PLAN* and SUMMARY* files.
   - The gap items (with their evidence and causes) go into the prompt as
     the work to close; the phase goal stays the ROADMAP goal.
