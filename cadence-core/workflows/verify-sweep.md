# cad-verify --sweep (cold branch)

Cross-phase audit of outstanding verification work. Loaded only when
`--sweep` was passed; return to verify.md's `build_or_resume` on resume.

1. Run the planning seam once:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" status
   ```

   The `phases[]` array already carries each phase's derived state and UAT
   counts. A phase with status `executed` and no `uat` field was built and
   never verified - list it as untested.

2. Report one cross-phase table from that output:

   | Phase | Status | Pass | Fail | Pending | Skipped/Blocked |

   For phases with open failures, read those phases' `.planning/phases/<N>/UAT.md`
   in ONE parallel batch (the paths are already known from the status output;
   conventions.md Parallel work) and list them: phase, item, severity.

3. Pick the most consequential phase to resume: open failures of the
   highest severity first, then most pending items, then lowest phase
   number. Offer via the ask-user seam:
   1. Resume UAT for phase <N> (recommended)
   2. Pick a different phase
   3. Stop here

   On resume, continue at verify.md `build_or_resume` with the chosen phase.

If nothing is outstanding anywhere, say so and stop.
