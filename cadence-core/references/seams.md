# Portability seams

Cadence runs on Claude Code only. These three seams are the ONLY places where
host-runtime specifics may appear. Workflows and skills reference the seam by
name and follow its binding; they never inline host-specific alternatives.
A future runtime port edits this file, not the workflows.

## Seam: ask-user

How a workflow asks the human a question and blocks on the answer.

**Claude Code binding:**
- Structured choice (2-4 mutually exclusive options): the `AskUserQuestion` tool.
- Open-ended question: end the turn with the question in plain prose.
- Never fabricate or default an answer the seam was supposed to collect.

## Seam: spawn-agent

How a workflow dispatches work to a fresh-context subagent.

**Claude Code binding:**
- Dispatch via the agent/Task mechanism with `(agent_name, prompt, model?)`.
- `model` is per-dispatch overridable; use it as the primary auto-routing lever.
- Effort is NOT per-dispatch overridable: it is fixed in agent frontmatter per
  role. Runtime effort escalation swaps to an effort-variant agent file
  (`cad-planner-high`, `cad-planner-low`, ...) - these exist only for the
  heavy-reasoner roles.
- Timeout: `workflow.subagent_timeout` from config.

## Seam: review-cli

How the review subsystem invokes an external reviewer CLI (cross-model review).

**Claude Code binding:**
- Look up the command template in config `review.models.<name>`
  (e.g. `codex exec {prompt}`), substitute `{prompt}`, run via shell.
- Capture stdout as the reviewer's verdict; non-zero exit = reviewer
  unavailable (report, do not silently skip a blocking trigger).
- The default backend `claude-subagent` does NOT use this seam - it goes
  through spawn-agent with a fresh-context, refute-prompted reviewer.
