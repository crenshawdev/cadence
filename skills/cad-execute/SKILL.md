---
name: cad-execute
description: "Execute a native phase: the binary composes each executor dispatch from state and owns every task, run and suite receipt."
argument-hint: "[phase number]"
allowed-tools:
  - mcp__cadence__cadence_query
  - mcp__cadence__cadence_apply
  - Task
---

This front door is rendered by `cadence executor-instructions --frontdoor`
from the compiled `execution::instructions` role. The binary is the only
continuation authority: keep no local execution state, inspect no project
files, reconstruct no task list and approve no evidence on the owner's behalf.

<process>
1. Call `mcp__cadence__cadence_query` with `operation: "execute-next"` and the user's phase spelling unchanged as `phase`. Do not normalize, round, infer, default or repair it; the binary validates it.
2. Read the structured envelope. For `complete`, report completion and stop. For `judgment-stop`, display the stop identifiers and stop. For `refused`, `unknown` or `not-applicable`, display `code` and `reason`; when the code is `continuation-refusal` or `reconciliation-required` continue at step 3; when it is `suite-failed`, the plan's suite reported a failure and its repair is a newly approved gap plan admitted through `execution-extend`, never a rerun, so stop and say so; otherwise stop. For `dispatch`, continue at step 4.
3. Collect the owner's actual answer in the conversation and submit exactly what the owner states, then repeat from step 1: an unanswered task checkpoint is answered through `execution-task-answer`; a retained Stop is continued or declined through `execution-authorize` naming that `checkpoint`; unacknowledged commits are reconciled through `execution-task-progress`. A restart, a summary or an old report is never an answer.
4. Invoke `Task` with `dispatch.route.choice.agent` and exactly the returned prompt, unchanged. Pass `dispatch.route.choice.model` only when present; otherwise omit the model argument for session inheritance. Use this admitted selection and issue no fresh route query. Add no instructions or context: the prompt already carries the admitted checks, the current task state and the compiled executor instructions.
5. Read the executor's digest without interpreting it. The binary holds the closed tasks and receipts; the executor's reply is a digest, not a patch, and a refusal or an Unknown run it reports is displayed and retained, never converted into completion.
6. Owner records are actual round trips through `mcp__cadence__cadence_apply`, each submitted exactly as the owner states it and shown with the retained bytes it names: the no-subject-stub inspection (`execution-owner-attest`), the separate classification of an Unknown custom-check run (`execution-classify-run`), and the dead-launch absence attestation for a suite launch with no recognized result (`execution-suite-relaunch`). The owner's interpretation is shown beside the binary's observation class and never replaces it.
7. When the executor reports the plan's suite receipt, request `execution-plan-complete` with the plan identity and version that `execution-history` reports under `plans`; it needs both the passing suite receipt and the existing exact risk settlement (`risk-check` on the plan's dispatch), and passing one does not erase a pending other. Then repeat from step 1.
</process>

The old whole-plan executor patch, and the old rule to run the suite before
committing the final task, are gone: tasks close one at a time through the
binary, and the suite is available only after the last task is acknowledged.

<review_delivery>
Handle a grouped review response before any execution response: run the saved review dispatch through cad-review-delivery and wait for durable return/enqueue acknowledgment. Then retry the original execution query; retain its original bytes. Review dispatch is the only additional agent permitted by this skill. A delivered review is findings, never proof that its fixes are complete; use execute-completion and supplied execute-fix consumer inputs.

@${CLAUDE_PLUGIN_ROOT}/skills/cad-review-delivery/SKILL.md
</review_delivery>
