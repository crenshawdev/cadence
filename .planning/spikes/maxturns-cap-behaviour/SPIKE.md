# Spike: what does a `maxTurns`-capped dispatch actually return?

**Status:** open 2026-08-08. Criteria written; experiment not yet run.

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

<!-- Filled after the experiment runs, per criterion, verbatim. Nothing here is
     written before the dispatch: the criteria above are what the result is
     judged against, and filling this in advance is the rationalization spike.md
     step 2 exists to prevent. -->

---

VERDICT:

RECOMMENDATION:

<!-- VERDICT is exactly one of: validated | invalidated | inconclusive.
     RECOMMENDATION is the single line phase 2 task 5 executes VERBATIM - either
     a `maxTurns` value per role family with the observed turn count it clears,
     or "ship no value" with the reason. Task 5 asserts both lines are filled
     and halts `blocked` if either is empty: an empty slot means the experiment
     was never run, and defaulting to the inconclusive arm there would report
     "no value ships" as a finding nobody actually established. -->
