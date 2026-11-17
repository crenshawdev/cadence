# Portability seam: spawn-agent

## Seam: spawn-agent

How a workflow dispatches work to a fresh-context subagent.

**Claude Code binding:**
- Dispatch via the agent/Task mechanism with `(agent_name, prompt, model?)`.
- `model` is per-dispatch overridable; use it as the primary auto-routing lever.
- Effort is NOT per-dispatch overridable: it is fixed in agent frontmatter per
  FILE, so varying it means varying the file. The roles block names the rung and
  `cadence-core/bin/lib/rung-agent.mjs` names the file that carries it
  (`cad-plan-checker` at `medium` -> `cad-plan-checker-medium`); the map is
  stated per role rather than derived, because the unsuffixed `agents/<role>.md`
  is one rung among the others rather than the lowest. Self-verify fails in both
  directions: a rung with no file, and a rung file no role maps.
- A turn bound, but no timeout and no cancel. Every `agents/*.md` carries
  `maxTurns: 200` in its frontmatter, one uniform value across all 35 rung
  files, so that is the bound a dispatch runs under - and it is the only one
  this seam has: no wall-clock kill, and no way to cancel a dispatch already
  running. Plan size is still the real
  lever on what one dispatch costs, which is what `workflow.max_plan_tasks` is
  for. So a dispatch that comes back unusable has exactly two producers:
  the turn cap cut the dispatch, or the return is missing or unparseable. A
  coordinator's recovery arm names those two rather than a wall-clock kill this
  seam cannot produce (`cadence-core/workflows/execute.md`).
- Every dispatch is fresh-context and self-contained; there is no resume or
  "continue the same agent". A re-dispatch (revision, continuation, escalation)
  is a NEW spawn that reads the prior artifact from disk - never a
  resume/continuation of a prior run, which this seam does not provide.

**Routing (the quality bundle).** Before every dispatch, resolve the role
through the routing seam - never hardcode a model. The seam decides whether a
model parameter is sent AT ALL: `model: null` on the envelope means send none,
and the dispatch runs at the session's model, which is a resolved answer and
not a fallback (D-04):

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/route.mjs" resolve --role <agent_name> \
  [--attempt <N>] [--phase <N>] [--plan <k>] --bracket-read "<csv>" [--bracket-plan <key>]
```

**The bracket rides the resolve.** `--bracket-read` (the read-set this SITE
causes the worker to read, one comma-separated value) makes the resolve write
the worker's lifecycle `dispatch` event itself - one seam call where dispatch
sites used to pay two. `--bracket-plan` is the worker key when it is not the
role name (an executor's plan number). The CLOSE half is the CALLER's to
write, because the caller alone sees the return: ONE `trace close` per dispatch
moment, keyed
`--plan <the worker key>` and `--role <name>`, carrying
`--tokens <the figure on the subagent return>`,
`--turns <the tool-call count on that same return>` and
`--duration-ms <the wall clock on that same return>`. The seam fixes the family and
picks the arm off the DETAIL, whichever flag carried it (`--detail`, or
`--detail-file <path>` when the text is the worker's own): absent means
`return`, present means `checkpoint` (the worker came back empty, unmarked or
unusable). `escalation` on a path
change is NOT inferred and stays on `trace append`. OMIT `--tokens` when the
return carries no figure - never `--tokens 0`, which would claim a dispatch
that cost nothing - OMIT `--turns` on the same rule when the return carries
no tool-call count, never `--turns 0`, which would claim a dispatch that used
no tools - and OMIT `--duration-ms` when the return carries no wall clock,
never `--duration-ms 0`, which would claim a dispatch that took no time.
`--duration-ms` takes the host's OWN spelling (`1m 23s`, `450ms`) or a plain
millisecond count, so the figure is copied rather than converted; the standing
exposure all three create is stated in `docs/rationale/spawn-agent.md`.
`--agent-id <the id on the subagent return>` rides that same line and is its one
non-figure field. The CALLER is its only possible writer - the `dispatch` half is
written before the subagent exists, so it has no id to carry - and it is what
lets the `SubagentStop` hook know a worker whose bracket is already closed and
write nothing, rather than land a late stop on whatever else is open
(`lib/subagent-trace.mjs`). OMIT it when the host returned none: with two
dispatches of one role open and no id, that hook refuses rather than guess.
A
figureless return is ROUTINE (`lib/trace.mjs` holds the provenance), and the
`unrecorded` it produces names a silent return, never a skipped bracket. A
turn-figureless return is routine in the same way and renders under a counter
of its OWN, `turns_unrecorded`, distinct from the token `unrecorded`, so a
dispatch that reported tokens but no turns stays readable apart from one that
reported turns but no tokens. This
paragraph is the ONE statement of that rule; dispatch sites point here rather
than restating it.

One resolve returns FOUR knobs, not a model: `model` and `effort` for this
dispatch, `review` (the whole trigger -> gate map, which
`references/review-triggers.md` step 1 reads), and `verify` (whether the
deep-verify pass runs, which `workflows/verify.md` reads). Quality is not one
dial, and effort alone cannot express "fire a blocking cross-model review".

**The plan-time risk floor.** The resolve reads it off the phase's declared PLAN
`files:`; `docs/INTERNALS.md`'s Model routing says what it raises and that it fails
closed. `--phase <N>` decides which phase the floor reads, the `.planning/STATE.md`
cursor decides it when the flag is absent, and a MALFORMED `--phase` is refused
- the alternative is a floor off another phase's files. `--plan <k>` narrows the
scope to ONE plan, which is what an executor floors on, so a clean plan in a
mixed phase is not raised by its risky sibling; a key naming no plan file takes
the fail-closed arm rather than widening back to the union. `cad-planner` and
`cad-assumptions-analyzer` are exempt and always have been - dispatched before a
plan exists, they read none, so the floor computes nothing for them and says
so. `cad-mapper` is exempt too: a reader works from no plan, and the cursor's
phase would give it a floor from another phase's file list.

- Pass `--attempt 2` (3, ...) when re-dispatching the SAME role after its prior
  run failed: with `model.escalate_on_failure: true` (an opt-in - the default
  holds the rung, because a retry is usually a narrower job than the pass that
  failed it) the re-dispatch climbs ONE rung on the `low, medium, high, xhigh,
  max` ladder from wherever this dispatch started, and swaps to that rung's
  file. One step, never a jump, and a rung this role files no agent for is
  stepped over rather than dispatched. At the top rung there is nowhere to
  climb: `reason` says the rung was held and `escalated` stays false - a held
  retry is never reported as an escalation.
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
across the batch - the payloads differ, the routing does not, so calling
`route.mjs resolve` again per dispatch is wasted. Serialize dispatches only when
one consumes another's returned artifact.

The EXECUTOR is the stated exception, and not because payloads differ: the plan
scope is a routing INPUT once the risk floor reads it, so the per-plan executors
of a parallel phase can resolve DIFFERENT bundles off one (role, attempt) - a
risky plan gets the blocking plan review and the deep pass, its clean sibling
does not. Each resolves its own, carrying its `--plan <k>`; every other role
keeps the rule.

**Workflow dispatch.** A fire may hand its agents to a script: the `Workflow`
tool, started by a named entry (`cadence:review-panel`) or a `scriptPath`, with
`args`. The launch result prints `Transcript dir` and `Run ID`. The host leaves
the run at `<session>/workflows/<Run ID>.json` with `status`, `result` and
`workflowProgress[]`, one row per agent carrying `label`, `agentId`, `agentType`,
`model`, `state`, `tokens`, `toolCalls` and `durationMs`. The completion notice
holds run totals only and cuts a long result short. That file is undocumented,
the standing exposure `docs/rationale/spawn-agent.md` states, so a host
release can change it unannounced; a read that finds it gone or wrong falls back
to the notice's totals and never a made-up figure. A workflow agent has no
`CLAUDE_PLUGIN_ROOT`, so every path it is told to run is spelled absolute.

**Dispatch prompts.** Order one stable-first and never restate the agent's
own rules; pass a file's path, not its bytes, when the agent reads that file
whole. `references/dispatch-shape.md` says why.
