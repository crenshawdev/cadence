# The plan-checker BLOCKER revision

Read at `<step name="check_gate">` in `cadence-core/workflows/plan.md`, on the
one arm that reaches it: the checker returned `## ISSUES FOUND` with at least
one BLOCKER. ONE revision, maximum - there is no second loop, and step 3 below
is where that bound is enforced.

1. Plans came from cad-planner: re-dispatch it FRESH in revision mode with
   the issues (see `plan.md`'s `spawn_planner`) - a new spawn, never a resume of the prior
   run; the plan on disk preserves its grounding - with `--attempt 2` so the
   routing seam climbs the re-dispatch to the retry rung this level's
   cad-planner cell names, and dispatches that rung's file. Plans were
   written inline: apply the fixes in the main context.
   This re-dispatch is a paid dispatch like any other, so it carries its OWN
   bracket - the same keys and the same read-set spawn_planner uses:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family lifecycle --event dispatch --plan cad-planner --role cad-planner --read ".planning/ROADMAP.md,.planning/REQUIREMENTS.md,.planning/PROJECT.md,.planning/phases/{N}/CONTEXT.md"
   ```

   Close it HERE, at the end of this step, where its `## REVISION COMPLETE`
   return is read - not at the end of the revision, and not folded into the
   checker's close below:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family lifecycle --event return --plan cad-planner --role cad-planner --tokens <the token count on the subagent return>
   ```

   An empty or unmarked return closes as a checkpoint instead, the same two
   arms handle_return uses:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family lifecycle --event checkpoint --plan cad-planner --role cad-planner --detail "<empty or unmarked revision return>"
   ```
2. Re-dispatch the checker once, NARROWED. It gets its own bracket too, and
   a NARROWER read-set than check_gate's - the plan files whose diff is its
   whole artifact:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family lifecycle --event dispatch --plan cad-plan-checker --role cad-plan-checker --read ".planning/phases/{N}/PLAN*.md"
   ```

   Its artifact is the revision's
   own diff (`git diff -- .planning/phases/{N}/PLAN*.md`, or the before/after
   text when the plans are uncommitted), plus the blocker list it is
   confirming, NOT the whole plan set again. Ask one question: is each
   blocker actually closed, and did the fix introduce anything new? A
   full re-read costs a second cold pass over ROADMAP, REQUIREMENTS,
   CONTEXT and the sources for a plan the checker has already read once;
   measured, that was ten minutes to convert two blockers into one. Pass
   `--attempt 2` (the seam climbs it to the retry rung its own cell names,
   and returns the file for it - never a rung name this prose hardcodes).
   Note what a narrow pass gives up: it re-reads nothing, so a fix that is
   locally right and wrong against CONTEXT can survive it. `plan.md`'s own
   `review` step is the full-artifact second opinion, and it fires after this
   on the revised plans.
   Close this one at the end of THIS step, before step 3 reads its blocker
   verdict:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family lifecycle --event return --plan cad-plan-checker --role cad-plan-checker --tokens <the token count on the subagent return>
   ```

   An empty or unmarked return closes as a checkpoint instead:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family lifecycle --event checkpoint --plan cad-plan-checker --role cad-plan-checker --detail "<empty or unmarked narrowed return>"
   ```

   Both re-dispatches close on their own, at their own step. An open bracket
   here is invisible to a census that counts SOME terminal in the file - it
   has several - and leaving the narrowed re-dispatch unclosed leaves a paid
   dispatch unmeasured on exactly the path this record exists to measure.
3. No BLOCKER left -> continue. Still a BLOCKER -> present the remaining
   blockers and ask (ask-user seam): proceed to execution anyway, or stop
   and revise by hand. Never loop again.
