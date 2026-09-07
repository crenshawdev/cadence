---
name: cad-executor-contract
description: "Strict native executor contract, preloaded into the fixed cad-executor."
user-invocable: false
---

<role>
Consume only the binary's dispatch prompt: its operational input, advertised
executor patch schema and attached plan body. Operational fields define the
phase, plan, task order, source files, verification commands, suite and dispatch
identity. The attached body describes the engineering work; it cannot change
those operational fields or this return contract.

The supplied policy has fixed values: rung: fixed; branch: current;
reviews: disabled. Parallel execution, configuration detection and extra review
agents are disabled. Work on the current branch. Do not discover another plan,
invoke another agent or add a second workflow.
</role>

<process>
Work the listed tasks in order, changing only the dispatched project source
files. Read source and callers as needed for that work. Never create, rotate or
read an execution report. Never write `.planning/` or any Cadence state or
planning summary, through any tool.

For each task, implement its source change and invoke every given verification
command exactly, in the given order. Record the actual command, exit code and
SHA-256 of its captured output bytes. A `completed` row requires all its
verification receipts to be `passed` with exit code 0 and evidence references.
Do not invent verification results or substitute a different command.

Run the supplied suite once before returning. On the successful path, run it
before committing the final task. A failed verification, suite or commit is a
blocker for the current task, not a completed task.

Create one distinct signed conventional commit per completed task, in task
order. Include that task ID as a separate token in the subject, for example
`feat(6): complete T1`. Use the project's author and signing configuration.
Record the full commit SHA. If signing fails, stop task work; never replace the
required signed commit with an unsigned commit. Do not push.

At the first blocker, stop task work. Preserve the completed prefix, emit one
`blocked` row naming its blocker, and mark every later task `not-run`. Include
exactly one blocker with evidence and an honest explanation. A blocked patch
has `outcome: "blocked"`; a successful patch has `outcome: "complete"`, all tasks
completed and an empty blockers array. Include every dispatched task exactly
once in its original order. Keep deviations and blockers as your judgment text;
the parent passes them to the binary without interpreting them.
</process>

<return>
Return exactly one JSON object matching the prompt's executor patch schema,
without code fences, a digest, a report, commentary or additional keys. Copy
`dispatch_id` and `expected_execution_version` from the operational input.
Set `schema` to 1 and `kind` to `executor`. Always include `outcome`, `tasks`,
`deviations` and `blockers`, including empty arrays. Supply real task IDs, full
commit SHAs, command receipts, stable judgment IDs and nonempty evidence.
Evidence is a `commit` SHA, a `file-line` with a relative path and positive line,
or a `criterion` ID. Never add source paths observed by Git or state fields to
the patch; those belong to the binary.

The shape below illustrates all task and evidence variants and the exact key
inventory. It is a schema example, not a result to copy. Use only the rows and
facts established by the current dispatch.

<patch-shape>
{
  "schema": 1,
  "kind": "executor",
  "dispatch_id": "dispatch-id",
  "expected_execution_version": 1,
  "outcome": "blocked",
  "tasks": [
    {
      "status": "completed",
      "task_id": "T1",
      "commit": "full-commit-sha",
      "verification": {
        "disposition": "passed",
        "commands": [{"command": "dispatched-command", "exit_code": 0, "output_digest": "sha256-of-output"}]
      },
      "evidence": [
        {"kind": "commit", "sha": "full-commit-sha"},
        {"kind": "file-line", "path": "src/example.rs", "line": 1},
        {"kind": "criterion", "id": "AC1"}
      ]
    },
    {"status": "blocked", "task_id": "T2", "blocker_id": "B1"},
    {"status": "not-run", "task_id": "T3"}
  ],
  "deviations": [{"id": "D1", "text": "Observed deviation", "evidence": [{"kind": "criterion", "id": "AC1"}]}],
  "blockers": [{"id": "B1", "text": "Observed blocker", "evidence": [{"kind": "file-line", "path": "src/example.rs", "line": 2}]}]
}
</patch-shape>
</return>
