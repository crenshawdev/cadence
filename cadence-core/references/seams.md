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
  (`cad-plan-checker-high`, ...) - these exist only for roles whose base effort
  is below the escalation target.
- Timeout: `workflow.subagent_timeout` from config.

**Routing (which model + which agent file).** Before every dispatch, resolve the
role through the routing seam - never hardcode a model, never dispatch a role at
the session default when a profile is set:

```
node "$HOME/.claude/cadence-core/bin/route.mjs" resolve --role <agent_name> \
  [--attempt <N>] [--files <N>] [--ambiguity <0..1>]
```

- Pass `--attempt 2` (3, ...) when re-dispatching the SAME role after its prior
  run failed - that is the signal `auto` uses to escalate. Pass `--files` /
  `--ambiguity` when you have them (auto tier bump); omit otherwise.
- Use the returned `agent` (may be an effort-variant) and `model` in the
  dispatch. `escalated`/`reason` are for logging why.
- `{ok:false}` (unknown role, no table) → dispatch the **base** `agent_name` with
  no `model` override (session default). Routing never blocks a spawn.
- Fixed profiles (`fast`/`balanced`/`quality`) never escalate - explicit pick
  wins. Only `model.profile: auto` reacts to `--attempt`/signals.

## Seam: call-review-provider

How the review subsystem reaches a cross-model reviewer. A cross-model review
is a direct provider HTTPS call (OpenAI / Gemini), NOT a CLI subprocess: review
is a pure function (artifact in -> structured findings out), and the provider
API enforces the finding schema. All provider specifics live in one bundled
script; workflows invoke the script and never inline HTTP or provider bytes.

**Claude Code binding:**
- Run `cadence-core/bin/review-provider.mjs` via the shell (installed at
  `$HOME/.claude/cadence-core/bin/review-provider.mjs`):
  - Review: `review --provider <openai|gemini> --model <id> [--effort <level>]`,
    the `{instruction, artifact}` payload on stdin. Stdout is one JSON object:
    `{ok:true, findings:[...]}` or `{ok:false, reason, detail}`.
  - Consult: `consult --provider <name> --model <id> [--effort <level>]`, the
    `{situation}` payload on stdin -> `{ok:true, angles:[...]}` (dead-end help;
    see references/consult.md). Same key resolution and degradation as review.
  - Model detection: `detect-models --provider <name>` -> `{ok:true, models:[...]}`.
  - Pass `--key-file <path>` from config `review.key_file` when set (else omit;
    the script uses the XDG default). Never pass a key itself.
- The script resolves the key itself (env first, then the shared providers.env)
  and NEVER logs it; the workflow passes no key.
- Degradation is structured, not exceptional: `ok:false` with `reason` one of
  `no-key | transport | http | no-output | bad-json | bad-shape`. On `no-key`
  the review subsystem falls back to `claude-subagent` and does not offer a
  consult; a `blocking` trigger reports the failure rather than silently pass.
- The default backend `claude-subagent` does NOT use this seam - it goes
  through spawn-agent with a fresh-context, refute-prompted reviewer.
- Model, effort, and per-provider endpoint/key-file path come from config
  (`review.providers.<name>`, per-trigger `review.triggers.<t>.model/effort`).
  A future non-HTTP reviewer backend replaces this script, not the workflows.
