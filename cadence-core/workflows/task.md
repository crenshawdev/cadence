<purpose>
Execute a small, off-roadmap task with Cadence's two guarantees - atomic
conventional commits and the protected-branch guard - and nothing else.
Inline by default (no subagents, no plan files). `--plan` opts into a written
PLAN.md for genuinely multi-step work.

Replaces GSD's fast + quick pair: one command, the skill classifies the task
instead of making the user pick a lane.
</purpose>

<process>

<step name="parse">
Parse `$ARGUMENTS`: task description plus optional `--plan` flag.
If the description is empty, ask: "What's the task? (one sentence)"
Store as $TASK.
</step>

<step name="git_guard">
Apply the protected-branch guard from
`$HOME/.claude/cadence-core/references/git.md` before any work.
</step>

<step name="scope">
Classify $TASK before touching anything:

- **Inline** (default): single concern, roughly <= 3 file edits, no research,
  no new dependencies or architecture changes.
- **Planned**: `--plan` was passed, OR the task is multi-step enough that you
  would want a written breakdown (4+ edits, ordering matters, partial
  completion would leave the repo broken).
- **Too big**: feature-sized, belongs on the roadmap. Say so and stop:
  "This is phase-sized. Route it through /cad-context -> /cad-plan, or
  /cad-capture it for later."

When unsure between inline and planned, pick planned.
</step>

<step name="inline_path">
(Inline scope only.)

1. Read the relevant files.
2. Make the change.
3. Verify: run `workflow.test_command` from config if set and relevant,
   otherwise do a direct sanity check of the changed behavior.
4. Commit per references/git.md rail 2 (specific files, conventional message).

No PLAN.md, no SUMMARY.md, no state writes.
</step>

<step name="planned_path">
(Planned scope only.)

1. Write `.planning/tasks/{slug}/PLAN.md`: 1-3 atomic tasks, each with files,
   action, and a falsifiable verification ("running X shows Y", not "X works").
   If `.planning/` does not exist, put the plan nowhere - keep it in-context
   and say so; a task plan does not justify creating project scaffolding.
2. Execute task-by-task in the current context: change, verify, commit
   atomically per task.
   Exception: if the current context is already heavy or the work benefits
   from a fresh context, dispatch cad-executor with the plan via the
   spawn-agent seam instead, and wait for its result.
3. Append a 3-5 line "Outcome" section to the PLAN.md (what shipped, commit
   hashes, deviations). No separate SUMMARY.md for tasks.
4. If `planning.commit_docs` is true and the plan file exists, commit it
   (`docs: task plan {slug}`).
</step>

<step name="risk_check">
If any commit's diff touched a risk surface, fire the `risk_surface` review
trigger per references/review-triggers.md before reporting done.
</step>

<step name="done">
Report:

```
Done: {what changed}
Commit(s): {hashes}
Files: {list}
```

No next-step menu.
</step>

</process>

<guardrails>
- Never spawn a subagent on the inline path.
- Never use worktrees - cad-task is always sequential.
- Never push (references/git.md rail 3).
- Never write STATE.md or any activity log for a task - git is the record.
- If mid-task the scope grows past "planned", stop and re-route to
  /cad-context rather than improvising a phase inline.
</guardrails>

<success_criteria>
- [ ] Protected-branch guard applied before the first commit
- [ ] Each logical change is one conventional commit of specific files
- [ ] Verification was observed behavior, not assumption
- [ ] Zero planning artifacts for inline tasks; at most PLAN.md for planned ones
</success_criteria>
