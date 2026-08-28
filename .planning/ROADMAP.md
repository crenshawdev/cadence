# Roadmap: v3.7.6 - the coordinator stays the coordinator

## Overview

**`v3.7.6`, opened 2026-08-28.** Two phases, two ids, one source: the run
record of the first foreign project Cadence executed end to end
(`/code/smithers`, 2.5 phases, 27 dispatches, 2026-08-27 to 2026-08-28), read
for operational waste on the executor path with tokens deliberately out of
scope.

**What the record showed.** The executor's own contract is lean. The waste sits
around it, and two items account for nearly all of it. First, the coordinator
does the risk-fix pass itself: when the blocking `risk_surface` gate fails,
`workflows/execute.md` says "the findings are fixed" with no owner, and in every
smithers phase the main session picked up the editor - fifteen edits across
eight files in one 21:25-21:27 window, then again at 22:09, 12:02, 12:20, 12:50
and 13:14. In the phase-2 execute window the coordinator made 156 tool calls and
read 52 source and test files, more than any single executor. Every one of those
edits is unreviewed by construction, since the one-round re-arm cap is already
spent, and every one of those reads sits in the main context for the rest of the
run. Second, the executor runs the full test suite per task and then again
inside the commit compound: 6 to 29 bare `pytest -q` invocations per dispatch
against a suite that takes 0.6 s, so the cost is turns, not seconds. Run 6 (7
tasks, `xhigh`) ran it up to 29 times in 27 minutes.

**Why these two and not the other four.** Four smaller items from the same read
- `detect-commands` asked per dispatch, an executor hunting for a plan file it
was handed, a duplicate `risk-check run` and a runtime `--help` in the
coordinator, and STATE/ROADMAP/REQUIREMENTS re-read past the `status` envelope -
are filed in `.planning/CAPTURE.md` and are tidy-ups. These two are the cost,
and both change who does what rather than how much is read.

**The standard.** Would a user on their own project feel it. Both do: the fix
pass ships unreviewed code into their tree under their name, and the per-task
suite runs are the turns their executor bill is made of.

## Open Questions

- **OQ-1 - what the continuation prompt carries.** The fix dispatch is a second
  dispatch under the same worker key (`execute.md:335-340` already names it).
  Whether it carries the adjudication file path, the surviving findings
  distilled, or both is phase 1 planning's call; the rail is that the
  coordinator distills nothing it would otherwise not read.
- **OQ-2 - where the full-suite run lives.** Once per task inside the commit
  compound, or once per dispatch before the digest. The contract's step 2 owns
  the targeted run either way; phase 2 planning picks the suite site against the
  smithers record.

## Phases


## Phase Details
