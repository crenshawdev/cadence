# Spike: does an `xhigh` cad-executor truncate mid-phase?

**Status:** closed 2026-07-28. Verdict: invalidated - the executor row survives,
the gate does not.

## Question

Does a `cad-executor` dispatched at `effort: xhigh` truncate before completing
its phase and returning its report?

## Decision that hinges on it

The `cad-executor` row of #63's rung table. #63 states the failure mode as the
one thing worse than doing nothing: a truncated executor is a partial commit and
a corrupted phase, not a degraded answer. If this invalidates, the executor row
dies and #63 ships smaller.

## Why the question exists

The effort docs say `xhigh`/`max` need a large `max_tokens` because it caps
thinking and response text together. The subagent frontmatter field list carries
`maxTurns` and no `max_tokens`, and the spawn-agent seam has no way to set one.

## Criteria, risk-first

Ordered for fastest disproof. Stop the moment one invalidates.

### C1 — Is `max_tokens` controllable for a Claude Code subagent?

Given the subagent frontmatter reference, the settings schema, and the Agent
tool's own parameters, when I enumerate every documented control, then finding
any way to raise a subagent's output cap -> **the risk is mitigable**, and C3
becomes a tuning question rather than a gate. Finding none -> continue to C2.

### C2 — Does the cap actually bind thinking and response together?

Given Anthropic's effort and `max_tokens` documentation for Opus 5, when I read
what `max_tokens` bounds, then a cap covering thinking + visible output ->
**the risk is real** and C3 must run. A cap covering visible output only ->
thinking cannot consume the executor's report budget and the risk is
**invalidated at the premise**, no dispatch needed.

### C3 — Does a real `xhigh` agent truncate on a long multi-file task?

Given a throwaway agent definition pinned to `effort: xhigh` carrying the
executor's report contract, when dispatched against a task that writes several
files and must close with a complete structured report, then a final message
containing the whole report block -> **validated**; a response cut off
mid-token, or missing the report entirely -> **invalidated**.

## Observations

### C1 — no control exists. Confirmed.

The supported-frontmatter table in `code.claude.com/docs/en/sub-agents` lists
sixteen fields: `name`, `description`, `tools`, `disallowedTools`, `model`,
`permissionMode`, `maxTurns`, `skills`, `mcpServers`, `hooks`, `memory`,
`background`, `effort`, `isolation`, `color`, `initialPrompt`. None sets an
output cap, and the page contains zero occurrences of `max_tokens`,
`maxTokens`, "output token", "token budget", or "token limit".

Nor is it reachable elsewhere. The Agent tool exposes `description`, `prompt`,
`subagent_type`, `model`, `isolation`, and `run_in_background` and no token
parameter. `~/.claude/settings.json` carries no token key. `env-vars` documents
no `CLAUDE_CODE_MAX_OUTPUT_TOKENS`; the only token variable is
`MAX_THINKING_TOKENS`, which bounds a fixed thinking budget on Opus 4.6 /
Sonnet 4.6 and is inert on Opus 5's adaptive reasoning.

So `max_tokens` for a subagent is whatever the host chooses, unobservable and
unsettable from a plugin. #63's statement of the constraint is accurate.

`references/seams.md` describes the dispatch surface as `(agent_name, prompt,
model?)`, which matches: agent file, prompt, and model override are everything
Cadence controls. Worth noting separately from this spike - `maxTurns` IS a
supported frontmatter field and Cadence sets it on no agent. It is not a
truncation mitigation (truncation is per-response, turns are not), but it is
the one runaway-loop guard the host offers and the repo leaves unused.

### C2 — the cap binds thinking and response together. Confirmed.

Anthropic's Opus 5 migration reference states it directly: `max_tokens` is a
hard cap on thinking plus response text, and a workload that sized it tightly
around its answer can truncate mid-response now that thinking is on by default.
Its guidance for `xhigh`/`max` is to set a large `max_tokens`, starting at 64K.

Two Opus 5 facts compound this for the executor row. Thinking is on by default,
and it cannot be disabled at `xhigh` or `max` at all - that combination returns
a 400. So an `xhigh` executor necessarily spends thinking tokens against the
same cap as its output, with no opt-out.

One further fact from the subagents reference, not in #63: as of v2.1.198 a
subagent inherits the main conversation's extended-thinking configuration and
there is no per-subagent thinking setting. Thinking is session-scoped; effort
is per-agent. The two dials are owned by different layers.

### The reframing C1 and C2 together produce

`max_tokens` bounds **one API response**, not an agentic run. An executor does
not emit a phase in a single response - it emits many turns, each its own
request, bounded in count by `maxTurns` and in size, individually, by the
host's `max_tokens`.

That narrows the failure mode considerably. The question is not whether a whole
phase fits in the cap; it is whether any single turn's thinking plus text
overflows it. And the consequence of that overflow is not obviously a partial
commit: commits are Bash tool calls, and a truncated response is one whose tool
call never issued. A stalled turn, not a corrupted tree.

#63 states the risk as "a truncated executor is a partial commit and a
corrupted phase." That framing may be wrong, and it is the framing that makes
this the gating question for the whole proposal. C3 should be redefined to test
the per-turn shape before it is worth dispatching.

### C3 — empirical. Two probes, plus a corpus scan that settled the ceiling.

Both probes ran as `general-purpose` subagents inheriting the session's `xhigh`
effort (the frontmatter default is "inherits from session", and the session was
set to `xhigh` before dispatch).

**Probe A - raw output ceiling, minimal thinking.** Asked for 12,000 zero-padded
integers directly in the final message, with a terminator line, and explicitly
told to keep going until physically cut off. Result: all 12,000 lines present,
`TERMINATOR-OK 12000` intact, no truncation. The transcript records the response
as **36,015 output tokens, `stop_reason: end_turn`** - it stopped because it was
finished, not because it was cut. A floor, not the ceiling - 12,000 lines was
not enough to find the limit.

**Probe B - the realistic executor shape, heavy thinking.** Asked for a
non-repetitive 900+ line shell tokenizer written in ONE Write tool call, with
recursive descent, quote-state handling, and a 60-case table-driven test block.
This is the shape that would truncate if #63's fear held: one turn carrying both
a large output payload and genuine reasoning load.

Result: no truncation. Verified independently rather than taken from the agent's
self-report - 1,687 lines, 60,703 bytes in a single Write, `node --check` clean,
the file executes and reports 90/90 of its own tests passing, it ends on a
complete block, and it contains exactly one `export function tokenize`, which
rules out a split-and-retry masquerading as a single call. The transcript
records that response as **26,521 output tokens, `stop_reason: tool_use`** - the
tool call issued intact. Across the agent's whole 8-response run, not one
response stopped on the cap.

So the realistic worst case for a Cadence executor turn - a large source file
written in one call while reasoning hard - completed with room to spare.

**Probe C never ran.** It was dispatched at 40,000 lines and killed by the
context clear before emitting a single token; its transcript holds the prompt
and no assistant response. It was not re-dispatched, because a cheaper and
strictly better measurement was available on disk.

**The corpus scan - what probe C was actually for.** Truncation has an
unambiguous signature: `stop_reason: "max_tokens"` on the response record. Every
Claude Code transcript stores it. So rather than manufacture one truncation
event, scan for every truncation that has ever happened here:

> 668 transcript files, 33,165 assistant responses carrying a `stop_reason`,
> spanning Opus 5, Opus 4.8 and Haiku 4.5, main sessions and subagents alike.
> **`stop_reason: "max_tokens"` occurs zero times.**

The largest naturally-terminated response in the entire corpus is probe A's own
36,015 tokens. Nothing else has come close, and nothing has ever been cut.

That bounds the cap at **≥36,015 output tokens** and establishes that no real
workload in this project's history - including every Cadence agent run to date -
has ever reached it. It does not reveal the exact cap; a ceiling that has never
been touched cannot be read off a corpus of untruncated responses. The decision
does not need the exact number.

## Verdict

**Invalidated.** An `xhigh` `cad-executor` does not truncate mid-phase, and the
failure mode #63 gates on cannot occur the way #63 describes it.

The invalidation is in two parts, because #63 makes two separate claims and only
one of them is wrong.

**#63's constraint is correct.** `max_tokens` is genuinely unsettable and
unobservable for a subagent. Sixteen supported frontmatter fields, none of them
an output cap; no Agent-tool parameter, no settings key, no env var. Cadence
controls `(agent_name, prompt, model?)` and nothing about the token budget. C1
found no lever and C2 confirmed the cap binds thinking and response text
together, with no way to disable thinking at `xhigh` or `max`. That much of the
issue stands as written.

**#63's failure mode does not follow from it.** `max_tokens` bounds one API
response; a phase is many responses. The stated consequence - "a truncated
executor is a partial commit and a corrupted phase" - inverts what truncation
does. Commits are Bash tool calls, and a truncated response is one whose tool
call never issued. The tree is not half-written; the turn simply stops. The
recoverable failure was written up as the unrecoverable one, and that framing is
the only reason this became the gating question for the whole proposal.

**And empirically the cap is not close.** The realistic executor shape - a
1,687-line file written in a single call under genuine reasoning load - cost
26,521 output tokens and issued its tool call intact. A deliberately maximal
response reached 36,015 and ended naturally. Across 33,165 assistant responses
in this project's entire history, `stop_reason: "max_tokens"` appears zero
times. The margin is real, measured, and never once been spent.

## Recommendation for the plan

1. **Keep the `cad-executor` row in #63, and remove its gate.** The row survives
   on the constraint being true; it does not survive as a blocker, because the
   consequence it warns about is not the consequence that occurs. #63 ships with
   the executor row intact and one fewer thing standing in front of it.
2. **Correct the hard-constraint section.** Keep "`max_tokens` is uncontrollable
   for a subagent" - it is accurate and worth stating. Replace "a truncated
   executor is a partial commit and a corrupted phase" with the per-response
   framing: a truncated response is a stalled turn whose tool call never issued,
   recoverable by re-dispatch, not a corrupted tree.
3. **Add the thinking-ownership fact.** As of v2.1.198 a subagent inherits the
   main conversation's extended-thinking configuration, and there is no
   per-subagent thinking setting. Effort is per-agent; thinking is
   session-scoped. Cadence controls how hard its agents think, not whether they
   think, and the two dials belong to different layers. Not currently in #63.
4. **File `maxTurns` separately.** It is a supported frontmatter field that
   Cadence sets on no agent. It is not a truncation mitigation - truncation is
   per-response, turns are not - but it is the only runaway-loop guard the host
   offers, and the repo leaves it unused. Its own issue, not this one.

**Cheap standing check.** The corpus scan is a one-off script over
`~/.claude/projects/**/*.jsonl` counting `stop_reason: "max_tokens"`. If the
executor's token appetite ever grows enough to make this a live question again,
re-running it answers the question in seconds against real traffic - no probe
agent, no synthetic task. Zero hits means the ceiling still has not been touched.

---

## Next action

Update #63's `cad-executor` row and its "hard constraint" section per the four
recommendations above, then resume 2.0 scoping (milestone holds #63, #64, #68,
#70). `maxTurns` gets its own issue.
