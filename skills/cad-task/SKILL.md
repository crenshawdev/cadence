---
name: cad-task
description: "Execute a small off-roadmap task with atomic commits - inline by default, --plan for multi-step work"
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

Cadence serves the project's process records; the project's source is read with the host's own tools. Search and read code with the host's file, search and shell tools: locate first, then read only the lines the work needs rather than whole files. Use `cadence_query` with `document` and `document-search` for Cadence's own records: contexts, plans, roadmap rows, dispatches, verification attempts and task summaries.

Process records never use file paths. Call `document` with an identity such as `{"kind":"phase-context","phase":31}`, `{"kind":"phase-plan","phase":31,"plan":2}` or `{"kind":"dispatch","id":"<issued id>"}` and no `part` to get its bounded index, then repeat the identity with a returned part such as `truth:T1`, `task:P31-2-T1`, or `row`. Dispatches serve identity, goal, context, notes, tasks, allocated checks, completed history, continuation, suite, lease, commands, policy and route. Phase plans also serve their typed goal, context, notes and `evidence:<item id>` parts. When native execution records exist, their `execution` part serves the same plan state as `execution-history`, including `round` (dispatch_id, host, tokens, wire_bytes, owner, at and request_id) and `completion` (suite_run, request_id and the settlement material base/head). The `round` and `completion` fields are omitted until their events are recorded. Follow numbered continuation parts such as `notes:2` in index order; each is at most 24,576 bytes. A `dispatch-superseded` refusal identifies the changed slot and current issued id. `document-search` takes a `phase` and a `pattern` and returns which parts of that phase's records match, as identities and parts for `document`, without bodies. A refusal's issued identity is the only address for inspecting the named fault. Main threads and workers use this same contract on the already configured Cadence MCP connection; a worker must not define or launch another server.

Drafts use `{"kind":"plan-draft","phase":N,"plan":k,"digest":"<submission_digest>"}` or `{"kind":"context-draft","phase":N,"digest":"<submission_digest>"}`. Compose each plan identity from the `phase` and `plan` of each identity in the draft answer's `documents` array and the answer's `submission_digest`; compose a context identity from its phase and `submission_digest`. No extra draft-identity field is returned. Call `document` without `part`, then read every returned part in index order and show those rendered parts to the owner before approval. Draft parts concatenate byte for byte to the rendered document. After explicit approval, send `plan-submit` or `context-submit` with `phase` and `approval: {approved: true, owner, at, submission_digest}`, with no `submission`. Drafts live only in the resident's memory and are lost on restart. A `stale-draft` refusal names the newest draft `identity` and changed `part`; read that location and obtain fresh approval of the complete newest draft. An `unknown-draft` refusal names the phase identity; create and read a fresh draft before requesting approval again.

**Executor.** For each check your task delivers: write the test first, run it, record the commit where it failed; then implement, run it, record the commit where it passed. Run only what the task names while working. Close the last task, report, and stop; the orchestrator requests the full suite. Every test you write, the checks included, exercises one unit through what it exposes and fakes the outside world: files, clock, other programs, network. Never start a program to get an answer, not this project's binary, not git, not gpg. Naming a fake is not permission to script one: build the values the test needs and assert the rule over them, because a test that supplies the answer the code reaches for cannot fail. If a unit asks the outside world in the middle of deciding, say so and stop; do not fake your way around it. Skip trivial code, write the expected value by hand.

Classical default, given because the project has set no test style; it is guidance and never a gate, and nothing about style changes task eligibility or adds a count: test a unit through what it exposes, not its insides; fake only files, clock, other programs and network; never start a program to get an answer, the project's own binary, git and gpg included; skip trivial code such as getters, forwarding and constructors that only store; write the expected value by hand.

## Task protocol

There is no dispatch, no phase and no lease: the task is its own identity,
inline or planned, opened and closed through `mcp__cadence__cadence_apply`.

1. `task-open` `{request_id, slug, mode, description}`: `slug` is the
   kebab-case name of the task, `mode` is `inline` or `planned`. The binary
   reads the branch policy from the effective configuration and observes the
   repository through the shared branch observation. A protected starting
   branch is answered `protected-branch` with the policy's own disposition
   (`permission` `ask` with the gate's options, or `refuse`); there is no
   bypass and no recorded proceed for a task, so create and switch to an
   authorized work branch, then open again with a fresh `request_id`. The
   accepted answer carries answer field `task.token` (the per-run token every later call
   echoes), answer field `task.start` (HEAD at open) and `root`: `absent` means the run is
   ephemeral, held in the resident's memory, and its record will be called
   unrecorded; `present` means the record is written under the planning root
   before done.
2. Do the work: read through `cadence_query`, change files, verify by observed
   behavior, and commit each logical change as one conventional commit of
   specific files. The binary makes no commits for a task.
3. `task-close` `{request_id, slug, token, report, surfaces}`: `report` is
   what shipped, `{"kind":"text","text":"..."}` or `{"kind":"file","path":
   "<absolute path>"}`; a file that does not exist is refused `missing-file`
   naming that path, never read as an absent planning root. `surfaces` is
   this run's risk surface answer, a subset of the eight categories; a
   treeless run persists no answer, so ask the owner once per run when the
   project has none and pass it here. The binary reads the commits and files
   of `start..HEAD` from git, scans that range against the surfaces with the
   shared risk classifier, and answers:
   - `outcome: done` with answer field `record.risk` `skipped` (HEAD did not move),
     `clear`, or `advisory` under a non-blocking gate, and answer field `record.recording`
     `unrecorded` with its reason or `recorded` with the path;
   - `risk-blocked` when a surface matched or the scan was inconclusive under
     a blocking gate: the task is not done, answer field `details.record` names the matched
     surfaces and signals, and the matched material was held per run in
     temporary storage that is gone with the answer. Fix, commit, and close
     again with a fresh `request_id`; the token stays open.
   - `unanswered-surfaces` when commits landed and no surfaces were given.
4. Report done only from a `done` answer: what changed, the commit ids,
   the files, the risk disposition in the answer's words, and the recording
   disposition (`unrecorded because <reason>` or the record path). A blocked
   or refused close is reported as such, never as done.

A replayed request with the identical body returns its retained answer; the
same `request_id` with a different body is refused `request-reused`. The
resident forgets a treeless episode when it exits.

Work on the current branch;
do not push, reset, amend, revert or force-push.
