# Spike: does the host silently downgrade an `xhigh`/`max` dispatch to `high`?

**Status:** closed 2026-09-02. Measured on the installed host; verdict below.

## Question

ROADMAP.md's OQ-2. `GH-226` rests on a changelog reading rather than an
observation: that Claude Code 2.1.251 turns an `xhigh`/`max` dispatch into a
silent downgrade to `high` when extended thinking is off. Does the installed
host actually downgrade, or does it still hard-error on the unsupported
combination - and if it downgrades, is the downgrade visible anywhere the
`SubagentStop` hook can read?

## Decision that hinges on it

The whole of phase 3, `v3.7.10 - review receipts`. A positive answer means the
effort a rung was ROUTED at and the effort it RAN at can differ without anything
saying so, and the run record has to state both. A negative answer voids the
phase: `GH-226` is closed with its reason recorded, the `TRC-13` id is
withdrawn, and the cycle closes at two phases (ROADMAP.md:78-82, :165-191).

The second half of the question decides where the value is read FROM, which is
the difference between a record that exposes the downgrade and a record that
hides it. If the downgrade shows on the hook payload, `subagent-trace.mjs` reads
the payload it already parses and the phase is a two-line change. If it does
not, the payload is a false witness - it reports the CONFIGURED level on exactly
the runs that were downgraded - and the source has to be the worker's own
transcript.

## Observation

Measured 2026-09-02 on Claude Code 2.1.258 with Opus 5. Four runs, crossing two
dispatch shapes with two thinking states: a headless session invoked with
`--effort max`, and a subagent declared at `effort: max`, each run once with
extended thinking suppressed via `MAX_THINKING_TOKENS=0` and once with thinking
on. Every run was read on two surfaces - the top-level `effort` string on its
own transcript's `type:"assistant"` lines, and the `effort` field on the `Stop`
or `SubagentStop` hook payload the run produced.

| Run | Thinking | Its own transcript's assistant lines | Its hook payload |
|---|---|---|---|
| headless session, `--effort max` | off, `MAX_THINKING_TOKENS=0` | `"effort":"high"` | `"effort":{"level":"max"}` |
| headless session, `--effort max` | on | `"effort":"max"` | `"effort":{"level":"max"}` |
| subagent declared `effort: max` | off, `MAX_THINKING_TOKENS=0` | `"effort":"high"` | `"effort":{"level":"max"}` |
| subagent declared `effort: max` | on | `"effort":"max"` | `"effort":{"level":"max"}` |

Neither run with thinking off errored. Both completed normally and both recorded
`high` on their own transcripts while having been asked for `max`. That is the
downgrade the 2.1.251 changelog names ("effort is now sent as `high` in that
case"), happening on the installed host, with nothing on any surface announcing
it.

The payload told the same story in all four runs. `"effort":{"level":"max"}` is
what was CONFIGURED, not what ran: it is byte-identical on the two runs that ran
at `max` and the two that ran at `high`, so a reader taking effort off the
payload would record a routed/ran MATCH on exactly the downgraded runs this
phase exists to expose. The payload cannot see the downgrade.

### The corpus behind the reader's shape

Two figures measured over this repository's own transcript corpus on the same
day, because they are what makes the reader's absent arm a measured case rather
than a defensive one:

- 5,701 of 5,701 recent assistant lines carry `effort` as a TOP-LEVEL string on
  the line, and 0 carry it under `message`. So the reader takes the top-level
  key and never reaches into `message`.
- 6 of 368 transcripts carry no `effort` on any assistant line at all. So a
  transcript that cannot answer is a real, observed state and not a
  hypothetical, and absent has to be a first-class answer rather than a default
  the reader falls back through.

Also measured over the same 368: 0 transcripts mix two different effort values
across their assistant lines, and the whole corpus carries only three spellings,
`high`, `medium` and `xhigh` - none of them `max`. A `max` rung has never run on
this record, so the first live routed/ran disagreement will come from a user
whose thinking is off rather than from this repository.

## Verdict

VERDICT: validated

The downgrade is real, it is silent, and it is invisible on the hook payload.
Phase 3 stands.

RECOMMENDATION: Read the effort a dispatch RAN at off the WORKER's own
transcript - the top-level `effort` string on its `type:"assistant"` lines - and
never off the hook payload, not even as a fallback. `GH-226`,
`REQUIREMENTS.md:21` (`TRC-13`) and `ROADMAP.md:170-176` all name the payload as
the source; all three are CORRECTED by this spike rather than followed. Record
the host's string verbatim in its own spelling, with no validation against
Cadence's rung enum - the enum is a config rule, and validating here would erase
a renamed host rung at exactly the moment it is the signal.
