# Portability seam: spawn-agent

## Seam: spawn-agent

How a workflow dispatches work to a fresh-context subagent.

**Claude Code binding:**
- Dispatch via the agent/Task mechanism with `(agent_name, prompt, model?)`.
  `model` is per-dispatch overridable and is the primary auto-routing lever.
- Effort is NOT per-dispatch overridable: it is fixed per agent FILE, so varying
  it means varying the file. The roles block names the rung and
  `cadence-core/bin/lib/rung-agent.mjs` names the file that carries it
  (`cad-plan-checker` at `medium` -> `cad-plan-checker-medium`); the unsuffixed
  `agents/<role>.md` is one rung among the others, not the lowest.
- Every `agents/*.md` carries `maxTurns: 200` in its frontmatter, and that turn
  bound is the only one: no timeout, no wall-clock kill, no way to cancel a
  running dispatch. Plan size (`workflow.max_plan_tasks`) is the lever on what
  one dispatch costs. So a dispatch that comes back unusable has exactly two
  producers: the turn cap cut the dispatch, or the return is missing or
  unparseable. A recovery arm names those two
  (`cadence-core/workflows/execute.md`).
- Every dispatch is fresh-context and self-contained. A re-dispatch (revision,
  continuation, escalation) is a NEW spawn that reads the prior artifact from
  disk, never a resume of a prior run.

**Routing (the quality bundle).** Before every dispatch, resolve the role
through the routing seam - never hardcode a model. `model: null` on the
envelope means send no model parameter: the dispatch runs at the session's
model, which is a resolved answer, not a fallback:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/route.mjs" resolve --role <agent_name> \
  [--attempt <N>] [--phase <N>] [--plan <k>] --bracket-read "<csv>" [--bracket-plan <key>]
```

**The bracket rides the resolve.** `--bracket-read` (the read-set this SITE
causes the worker to read, one comma-separated value) makes the resolve write
the worker's lifecycle `dispatch` event itself. `--bracket-plan` is the worker
key when it is not the role name (an executor's plan number). The CLOSE half is
the CALLER's, because only the caller sees the return: ONE `trace close` per
dispatch moment, keyed `--plan <the worker key>` and `--role <name>`, carrying
`--tokens <the figure on the subagent return>`,
`--turns <the tool-call count on that same return>` and
`--duration-ms <the wall clock on that same return>`. The seam fixes the family
and picks the arm off the DETAIL, whichever flag carried it (`--detail`, or
`--detail-file <path>` when the text is the worker's own): absent means
`return`, present means `checkpoint` (the worker came back empty, unmarked or
unusable). `escalation` on a path change is NOT inferred and stays on
`trace append`. OMIT `--tokens` when the return carries no figure, never
`--tokens 0`; OMIT `--turns` when it carries no tool-call count, never
`--turns 0`; OMIT `--duration-ms` when it carries no wall clock, never
`--duration-ms 0` - each zero would claim a dispatch that cost, used or took
nothing. `--duration-ms` takes the host's own spelling (`1m 23s`, `450ms`) or a
plain millisecond count, so the figure is copied, not converted
(`docs/rationale/spawn-agent.md` states the standing exposure).
`--agent-id <the id on the subagent return>` rides the same line; only the
caller can write it, and the `SubagentStop` hook uses it to write nothing for a
worker whose bracket is already closed (`lib/subagent-trace.mjs`). OMIT it when
the host returned none: with two dispatches of one role open and no id, that
hook refuses rather than guess. A figureless return is ROUTINE (`lib/trace.mjs`
holds the provenance), and the `unrecorded` it produces names a silent return,
never a skipped bracket. A turn-figureless return renders under a counter of its
OWN, `turns_unrecorded`, distinct from the token `unrecorded`. This paragraph is
the ONE statement of that rule; dispatch sites point here rather than restating
it.

One resolve returns FOUR knobs: `model` and `effort` for this dispatch, `review`
(the whole trigger -> gate map, which `references/review-triggers.md` step 1
reads), and `verify` (whether the deep-verify pass runs, which
`workflows/verify.md` reads).

**The plan-time risk floor.** The resolve reads it off the phase's declared PLAN
`files:`; `docs/INTERNALS.md`'s Model routing says what it raises and that it
fails closed. `--phase <N>` decides which phase the floor reads, the
`.planning/STATE.md` cursor decides it when the flag is absent, and a MALFORMED
`--phase` is refused. `--plan <k>` narrows the scope to ONE plan, which is what
an executor floors on, so a clean plan in a mixed phase is not raised by its
risky sibling; a key naming no plan file takes the fail-closed arm rather than
widening back to the union. `cad-planner`, `cad-assumptions-analyzer` and
`cad-mapper` are exempt: they work from no plan, so the floor computes nothing
for them and says so.

- Pass `--attempt 2` (3, ...) when re-dispatching the SAME role after its prior
  run failed. With `model.escalate_on_failure: true` (opt-in; the default holds
  the rung) the re-dispatch climbs ONE rung on the `low, medium, high, xhigh,
  max` ladder from wherever this dispatch started and swaps to that rung's
  file; a rung this role files no agent for is stepped over. At the top rung
  `reason` says the rung was held and `escalated` stays false - a held retry is
  never reported as an escalation.
- Dispatch the returned `agent_type` with `model` - a bare name can be the user's
  own agent. `agent` is the bare stem the trace and any mismatch line name;
  `escalated`/`reason` are for logging why.
- `{ok:false}` (unknown role) → dispatch the **base** `agent_name` with
  no `model` override (session default). Routing never blocks a spawn.
- **Relay every `warnings[]` entry to the user before dispatching**, each
  DISTINCT warning once per workflow run - not once per dispatch. A warning
  that reaches JSON and no human is a resolved-then-dropped value wearing a
  diagnostic's clothes; but `route.mjs` runs per role per spawn, so an unscoped
  rule turns one deliberate config gate into a notice on every planner,
  executor, verifier and checker dispatch for the life of the project, and
  warning fatigue degrades the same channel the torn-layer and retired-key
  warnings depend on. ONE warning is not relayed and moved past: an
  entry saying a RETIRED routing key was ignored means a config layer still
  carries the single level that used to decide every role's model and effort,
  so before dispatching the workflow must Read
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/config-roles.md` (one consult
  site - this bullet), run its **Stakes migration** arm and re-resolve after it.

**Concurrent dispatch.** Independent dispatches over disjoint payloads (the
per-plan executors of a parallel phase, per-doc verifiers, the two reviewers of
one artifact) fire concurrently in ONE message, bounded by the host's
max-concurrent-agents. Resolve the route ONCE per (role, attempt) and reuse it
across the batch. Serialize dispatches only when one consumes another's
returned artifact.

The EXECUTOR is the exception: the risk floor reads its plan scope, so the
per-plan executors of a parallel phase can resolve DIFFERENT bundles off one
(role, attempt). Each resolves its own, carrying its `--plan <k>`; every other
role keeps the rule.

**Workflow dispatch.** A fire may hand its agents to a script: the `Workflow`
tool, started by a named entry (`cadence:review-panel`) or a `scriptPath`, with
`args`. The launch result prints `Transcript dir` and `Run ID`. The host leaves
the run at `<session>/workflows/<Run ID>.json` with `status`, `result` and
`workflowProgress[]`, one row per agent carrying `label`, `agentId`, `agentType`,
`model`, `state`, `tokens`, `toolCalls` and `durationMs`. The completion notice
holds run totals only and cuts a long result short. That file is undocumented
(`docs/rationale/spawn-agent.md`), so a read that finds it gone or wrong falls
back to the notice's totals, never a made-up figure. A workflow agent has no
`CLAUDE_PLUGIN_ROOT`, so every path it is told to run is spelled absolute.

**Dispatch prompts.** Order one stable-first and never restate the agent's
own rules; pass a file's path, not its bytes, when the agent reads that file
whole. `references/dispatch-shape.md` says why.
