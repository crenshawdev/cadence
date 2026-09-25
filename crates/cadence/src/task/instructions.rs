//! The cad-task front door, rendered by `cadence task-instructions` from the
//! compiled executor role with the task scope (D-209). Never hand-edited.

const FRONTDOOR: &str = r#"---
name: cad-task
description: ""
argument-hint: "[task description] [--plan]"
allowed-tools:
  - mcp__cadence__cadence_apply
  - mcp__cadence__cadence_query
  - Write
  - Edit
  - Bash
  - AskUserQuestion
  - Task
---

This front door is rendered by `cadence task-instructions` from the compiled
`execution::instructions` role with the task scope: the phase lease is
disabled, the protected-branch and risk dispositions are the binary's, and the
record's home is decided by whether a planning root exists. Inline work is
done in this context; `--plan` may dispatch one executor.

<process>
1. Parse `$ARGUMENTS` into the task description and an optional `--plan`. An
   empty description is asked for in one sentence. Classify: inline (one
   concern, a few file edits, no new dependency or architecture), planned
   (`--plan`, or multi-step enough that ordering matters and a partial stop
   would leave the repository broken), or too big (feature-sized). Too big
   stops here: say it belongs on the roadmap through `/cad-phase add`, or in
   `/cad-capture`, and run nothing. When unsure between inline and planned,
   pick planned.
2. Call `task-open` with a fresh `request_id`, the kebab-case slug of the
   description, `mode` `inline` or `planned`, and the description. Show a
   `protected-branch` answer as the policy's disposition: with `ask`, put the
   gate's options to the owner through `AskUserQuestion`; `create` means make
   and switch to the named work branch and open again, `abort` means stop.
   With `refuse`, stop. Keep the accepted answer field `task.token`.
3. Inline: read through `cadence_query`, make the change, verify by observed
   behavior, and commit each logical change as one conventional commit of
   specific files. Planned: write the plan as one to three atomic tasks, each
   with files, action and a falsifiable verification, keep it in this context
   when `root` is `absent` (a task plan never creates project scaffolding),
   then execute task by task here, or when this context is already heavy,
   invoke `Task` once with the plan and the token as the executor's whole
   prompt and wait for its digest; the executor works under the task
   executor contract below and closes nothing on your behalf.
4. Call `task-close` with a fresh `request_id`, the slug, the token, the
   report of what shipped, and `surfaces`. When the project has no answered
   risk surfaces, run `detect-surfaces` and ask the owner once through
   `AskUserQuestion` in the order the answer lists them; a treeless run
   persists nothing, so the answer rides this call alone. A `risk-blocked`
   answer is not done: show the matched surfaces and signals, fix and commit,
   and close again with a fresh `request_id`. A `missing-file` answer names
   the report file; fix the path and close again.
5. Report from the `done` answer only, in its words: what changed, the commit
   ids, the files, the risk disposition, and `recorded` with the path or
   `unrecorded because <reason>`. No next-step menu.
</process>

<guardrails>
- Never spawn a subagent on the inline path; `Task` is for the planned path only, once.
- Never use worktrees; a task is sequential.
- Never write STATE.md or any activity log for a task; git and the binary's record are the record.
- Never create `.planning/` or `.planning/tasks/<slug>/` yourself; the binary decides the record's home.
- If the scope grows past planned mid-task, stop and re-route to `/cad-phase add`.
</guardrails>

## Task executor contract

"#;

/// `skills/cad-task/SKILL.md`, a generated artifact: the front door above
/// and the executor role composed with the task scope.
pub fn markdown() -> String {
    let frontdoor = crate::help::table::render_description("cad-task", FRONTDOOR).expect("compiled skill front matter");
    format!("{frontdoor}{}\n", crate::execution::instructions::role_text(crate::execution::instructions::Scope::Task))
}
