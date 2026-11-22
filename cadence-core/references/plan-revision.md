# The plan-checker BLOCKER revision

Read at `<step name="check_gate">` in `cadence-core/workflows/plan.md`, on the
one arm that reaches it: the checker returned `## ISSUES FOUND` with at least
one BLOCKER.

1. Plans came from cad-planner: dispatch a fresh revision-mode cad-planner
   with the issues (`plan.md`'s `spawn_planner`; a new spawn per
   seam-spawn-agent.md) on an `--attempt 2` resolve, which climbs one rung only
   with `model.escalate_on_failure` on and holds it otherwise; dispatch the
   file the resolve returns. Plans were written inline: apply the fixes in the
   main context.
   The re-dispatch carries its OWN bracket on that resolve.
   With the phase input composed, that resolve's `--bracket-read` value is
   `<the phase input path>` `spawn_planner`'s stretch kept. A refused or
   unreadable compose dispatches with this read-set instead:
   `--bracket-read ".planning/ROADMAP.md,.planning/REQUIREMENTS.md,.planning/PROJECT.md,.planning/phases/{N}/CONTEXT.md"`.

   Close it HERE, where its `## REVISION COMPLETE` return is read, not at the
   end of the revision and not folded into the checker's close below:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace close --phase <N> --plan cad-planner --role cad-planner --agent-id <the id on the subagent return> --tokens <the token count on the subagent return> --turns <the tool-call count on the subagent return> --duration-ms <the wall clock on the subagent return>
   ```

   An empty or unmarked return goes to a scratch file and rides
   `--detail-file <path>`, per seam-spawn-agent.md's bracket rule.
2. Re-dispatch the checker once, NARROWED: its bracket rides its own resolve
   with the plan files alone, narrower than check_gate's:
   `--bracket-read ".planning/phases/{N}/PLAN*.md"`.
   Its artifact is the revision's own diff
   (`git diff -- .planning/phases/{N}/PLAN*.md`, or the before/after text when
   the plans are uncommitted) plus the blocker list it is confirming, NOT the
   whole plan set again. Ask one question: is each blocker actually closed, and
   did the fix introduce anything new? `plan.md`'s `review` step, which fires
   after this on the revised plans, is the full-artifact second opinion.
   Pass `--attempt 2` (step 1's rung rule) and dispatch the file it returns.
   Name its rung in the prompt - `Rung: {the effort THIS resolve returned}`.
   Close it at the end of THIS step, before step 3 reads its blocker verdict:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace close --phase <N> --plan cad-plan-checker --role cad-plan-checker --agent-id <the id on the subagent return> --tokens <the token count on the subagent return> --turns <the tool-call count on the subagent return> --duration-ms <the wall clock on the subagent return>
   ```

   An empty or unmarked return goes to a scratch file and rides
   `--detail-file <path>`, per seam-spawn-agent.md's bracket rule.

   Both re-dispatches close on their own, at their own step.
3. No BLOCKER left -> continue. Still a BLOCKER -> present the remaining
   blockers and ask (ask-user seam): proceed to execution anyway, or stop
   and revise by hand. Never loop again.
