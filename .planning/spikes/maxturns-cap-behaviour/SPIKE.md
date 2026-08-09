# Spike: what does a `maxTurns`-capped dispatch actually return?

**Status:** closed 2026-08-08. Experiment run; verdict below.

## Question

When a subagent hits its frontmatter `maxTurns` cap, does the dispatch return
the partial work the agent produced, or does it fail as a dispatch error with
nothing usable - and is the count model turns or tool-use rounds?

## Decision that hinges on it

Phase 2 task 5, FRI-02's "every dispatched agent carries an explicit
runaway-loop bound". If a capped run returns the agent's partial output, a
`maxTurns` value is a cheap runaway guard and ships onto all 19 files in
`agents/`. If a capped run is a failed dispatch with nothing usable, then every
long executor run converts into a dispatch failure the moment it reaches the
cap, and the guard costs more than the runaway it prevents - no value ships this
phase, and AC5 is satisfied by naming the paths left unbounded instead.

## Why the question exists

`maxTurns` is a supported subagent-frontmatter field that Cadence sets on no
agent - filed as its own item by
`.planning/spikes/xhigh-executor-truncation/SPIKE.md:216-219`, which established
that it is "the only runaway-loop guard the host offers, and the repo leaves it
unused". That spike established the field EXISTS. It established nothing about
what happens at the cap, and the codebase cannot answer it: `maxTurns` appears
in no file under `agents/`, `skills/`, `cadence-core/` or the seams. Shipping a
number without knowing the cap's behaviour is guessing on the one axis that
decides whether the guard helps or harms.

## Criteria, risk-first

Ordered for fastest disproof. C1 is the kill test - if it invalidates, the spike
is over and C2 never needs to run.

### C1 - the kill test: is a capped return usable at all?

Given a throwaway agent file pinned at a deliberately tiny `maxTurns` (2),
dispatched on a task that provably needs more rounds than that, when the
dispatch returns, then a return carrying any of the agent's OWN text - the
partial work it produced before the cap - -> **validated**: the cap degrades a
run rather than destroying it, and a value is safe to ship. An error envelope
with no usable agent content -> **invalidated**: the cap converts a long run
into a failed dispatch, and no value ships this phase.

### C2 - what does the cap count?

Given the same capped run, when the observed work is counted, then the number of
`Bash` calls the run completed before stopping decides it: a count matching the
`maxTurns` number -> the cap counts TOOL-USE rounds; a count lower than it
(model turns spent on text between tools) -> the cap counts MODEL turns. Either
answer is usable; the value shipped in task 5 must be sized against whichever it
is, and the SPIKE records which.

### C3 - has a PER-DISPATCH turn cap appeared since 2026-07-28?

Given the current host's supported-subagent-frontmatter table and the Agent
tool's parameter set, when both are re-enumerated against the sixteen fields and
six parameters recorded at
`.planning/spikes/xhigh-executor-truncation/SPIKE.md:53-77`, then finding no
per-dispatch turn cap -> D-12 stands and the bound belongs in the 19 agent
FILES, because a per-file field cannot vary by dispatch the way `model` can.
Finding one -> **D-12 inverts**, and the RECOMMENDATION says the bound belongs
in `references/seams.md`'s dispatch binding instead, where it can be resolved
per role rather than frozen per file.

## Throwaway code

The capped agent definition is throwaway and lives OUTSIDE `agents/` - under
this spike directory or the host's own agent dir - so it can never be mistaken
for a Cadence rung file, be picked up by self-verify's rung checks, or be
dispatched by the router. It is deleted when the experiment closes; if it is
kept for any reason, its path is named here.

## Observation

**The rig.** A throwaway agent file `spike-maxturns-throwaway` (frontmatter
`tools: Bash`, `model: haiku`, `maxTurns: 2`) was written to the project's
`.claude/agents/`, dispatched once, and deleted. Its body ordered three steps,
each a SEPARATE Bash call (`echo STEP-<n>-DONE | tee <scratchpad>/spike-step-<n>.txt`),
with one sentence of plain text before each call and a three-line `RESULT:`
report at the end - so the run provably needs more than two rounds, and each
completed round leaves a file behind that survives however the dispatch returns.

The agent registry is loaded at session start, so a file written mid-session is
not dispatchable from that session (`Agent type 'spike-maxturns-throwaway' not
found`). The dispatch was therefore issued from a fresh headless session in the
same cwd: `claude -p "<dispatch the agent, print the raw return verbatim>"
--allowedTools "Agent" "Task" "Bash" --permission-mode acceptEdits`.

### C1 - the kill test: a capped return IS usable. Validated.

The dispatch returned, verbatim and complete:

```
Now running step 2.
<usage>subagent_tokens: 8714 tool_uses: 2 duration_ms: 8582</usage>
```

That is the agent's OWN text - the last thing it said before the cap - not an
error envelope. Nothing in the return announces the cap: there is no error, no
status field, no "stopped at maxTurns" marker. The cap degrades a run rather
than destroying it, so a value is safe to ship.

The degradation has a specific shape worth recording, because it is what sizing
must respect: what comes back is the last assistant TEXT, not the agent's
contracted final message. A capped `cad-executor` would return its running
commentary and NOT its five-field digest - while its commits and its rewritten
`reports/plan-<k>.md` remain on disk. `execute.md`'s "timeout or no report" arm
already handles exactly that state (read the report file, confirm against
`git log`, ask the user), so a capped executor lands on an existing recovery
path rather than an unhandled one.

### C2 - the cap counts agentic turns, one per tool-using round. Confirmed.

Two Bash calls completed against `maxTurns: 2`: `spike-step-1.txt`
(`STEP-ONE-DONE`) and `spike-step-2.txt` (`STEP-TWO-DONE`) exist,
`spike-step-3.txt` does not, and the return's own `tool_uses: 2` agrees. The
count MATCHES the `maxTurns` number, which is C2's tool-use-round arm: the
plain-text sentence the agent emitted before each call did not consume a turn of
its own, so text bundled with a tool call rides the same round. A value must
therefore be sized against a role's TOOL-CALL count, not its message count.

The sizing evidence in hand: the `cad-executor` dispatch that halted this very
plan at task 3 reported `tool_uses: 59` for 3 of 7 tasks (~20 calls per task,
so a full 7-task plan extrapolates to ~140 rounds). That is the largest observed
Cadence role and the one any uniform bound must clear.

### C3 - no per-dispatch turn cap has appeared. D-12 stands.

Re-enumerated 2026-08-08 against both surfaces:

- The supported-frontmatter table at `code.claude.com/docs/en/sub-agents` still
  lists the same sixteen fields recorded at
  `.planning/spikes/xhigh-executor-truncation/SPIKE.md:53-77` - `name`,
  `description`, `tools`, `disallowedTools`, `model`, `permissionMode`,
  `maxTurns`, `skills`, `mcpServers`, `hooks`, `memory`, `background`, `effort`,
  `isolation`, `color`, `initialPrompt` - with `maxTurns` described as "Maximum
  number of agentic turns before the subagent stops". No field was added or
  removed.
- The Agent tool exposes the same six parameters and no turn cap: `description`,
  `prompt`, `subagent_type`, `model`, `isolation`, `run_in_background`.

`--agents <json>` accepts the same frontmatter fields including `maxTurns`, but
that is a session-scoped agent DEFINITION, not a per-dispatch override, and it
is a CLI flag Cadence does not control. So the bound belongs in the 19 agent
FILES, exactly as D-12 says.

---

VERDICT: validated

RECOMMENDATION: Ship `maxTurns: 400` on all 19 files in `agents/` - one uniform value for every role family, clearing the largest observed Cadence run (`cad-executor` at 59 tool-use rounds for 3 of 7 tasks, ~140 extrapolated for a full plan) by roughly 3x, so it can only bind on a genuine runaway and never on a long legitimate run; no read-only role (planner, plan-checker, reviewer, verifier, assumptions-analyzer) has been observed anywhere near it, and a per-family split is not shipped because only the executor family has an observed turn count to size against.

<!-- VERDICT is exactly one of: validated | invalidated | inconclusive.
     RECOMMENDATION is the single line phase 2 task 5 executes VERBATIM - either
     a `maxTurns` value per role family with the observed turn count it clears,
     or "ship no value" with the reason. Task 5 asserts both lines are filled
     and halts `blocked` if either is empty: an empty slot means the experiment
     was never run, and defaulting to the inconclusive arm there would report
     "no value ships" as a finding nobody actually established. -->
