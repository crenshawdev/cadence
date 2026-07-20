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

**Recommended option.** For a structured choice, put the option the workflow
recommends FIRST and label it `(recommended)` - unless the choice is one of the
deliberate no-default decisions below. This is a display convention (a nudge),
never a pre-selection: the user still chooses and the seam still blocks.

No research tax: the recommendation must fall out of analysis the step ALREADY
does - the analyzer's ranked alternatives, the sweep's severity order, the
config value in hand. Never add a reasoning or research pass just to produce
one. When no best option is already evident - a plain confirm ("Yes" /
"Correct some"), or genuinely equal alternatives - order them naturally and
omit the label rather than inventing a recommendation.

**Deliberate no-default decisions (never mark a recommendation).** A few choices
are consequential either/ors the tool must not steer: present them plainly, no
recommended option, no reordering toward one -
- the publish mechanism in /cad-land (push / MR or PR / tag / leave local), and
- the protected-branch guard when work would land on a protected branch
  (references/git.md rail 1).
These stay undefaulted by design; a nudge there is a bug, not a convenience.

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
- Every dispatch is fresh-context and self-contained; there is no resume or
  "continue the same agent". A re-dispatch (revision, continuation, escalation)
  is a NEW spawn that reads the prior artifact from disk - never a
  resume/continuation of a prior run, which this seam does not provide.

**Routing (which model + which agent file).** Before every dispatch, resolve the
role through the routing seam - never hardcode a model, never dispatch a role at
the session default when a profile is set:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/route.mjs" resolve --role <agent_name> \
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
- **Per-role pin.** `model.overrides` maps one role to one model alias
  (`opus`/`sonnet`/`haiku`/`fable`) and wins over the whole profile/tier matrix,
  including an `auto` escalation. The resolver reports `pinned: true` and names
  the swap in `reason`; effort is untouched, so a pinned role still gets its
  effort-variant agent file. An unrecognized alias returns a `warning` and the
  routed model stands - a typo must not silently redirect the spend. `fable` is
  reachable ONLY this way: it sits on no profile rung, because placing it on the
  capability ladder would assert a ranking against the others that is not
  established. Pinning it is the user's assertion to make, not the table's.
- **Tell the user when a pin fires.** A dispatch is approved through a UI that
  generally shows the agent name and not the model, so a pinned dispatch looks
  identical to a routed one at the moment of approval. When `pinned` is true,
  say so on its own line before spawning - "dispatching cad-planner on fable
  (pinned, routing would have picked opus)". Burying it in a preamble does not
  count; the user cannot verify what the dialog does not show.

**Prompt shape (cache discipline).** Order every dispatch prompt stable-first:
context that repeats across dispatches of the same role (phase/goal, shared
files to read) goes BEFORE the volatile per-dispatch specifics (this plan, this
scope, a continuation's completed-task table). The prompt cache matches the
longest identical prefix, so a stable preamble lets the 2nd..Nth dispatch of a
role read most of its prompt from cache instead of paying fresh. And never
restate rules the agent's own definition already carries - the definition is a
cached prefix; the dispatch prompt is billed fresh each time, so repeating
stable rules in it pays for them twice.

**Return shape (bounded handoff).** A subagent's return is the load-bearing
thing the orchestrator ingests back into the main context, so keep it bounded.
When the agent produced a durable artifact (a written file, commits), return a
slim summary plus the path/hashes and let the orchestrator open the artifact
only if it must - never echo the artifact's contents back. When there is no
artifact, cap the structured return to what the orchestrator will act on and
push raw evidence to a file rather than inline. This is what keeps the
orchestrator context flat across a long run of dispatches.

## Seam: call-review-provider

How the review subsystem reaches a cross-model reviewer. A cross-model review
is a direct provider HTTPS call (OpenAI / Gemini), NOT a CLI subprocess: review
is a pure function (artifact in -> structured findings out), and the provider
API enforces the finding schema. All provider specifics live in one bundled
script; workflows invoke the script and never inline HTTP or provider bytes.

**Claude Code binding:**
- Run `cadence-core/bin/review-provider.mjs` via the shell (installed at
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/review-provider.mjs`):
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
  `no-key | transport | http | no-output | bad-json | bad-shape` (call-shape
  problems surface as `bad-payload | bad-provider | bad-args | bad-command`,
  and an unforeseen bug as `internal`). On `no-key`
  the review subsystem falls back to `claude-subagent` and does not offer a
  consult; a `blocking` trigger reports the failure rather than silently pass.
- The default backend `claude-subagent` does NOT use this seam - it goes
  through spawn-agent with a fresh-context, refute-prompted reviewer.
- Model, effort, and per-provider endpoint/key-file path come from config
  (`review.providers.<name>`; per-trigger `review.triggers.<t>.tier` resolves
  the model id, `.effort` the reasoning level).
  A future non-HTTP reviewer backend replaces this script, not the workflows.
