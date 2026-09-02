---
phase: 3
plan: 1
requirements:
  - TRC-13
files:
  - .planning/spikes/host-effort-downgrade/SPIKE.md
  - cadence-core/bin/lib/subagent-transcript.mjs
  - cadence-core/bin/subagent-transcript.test.mjs
  - cadence-core/bin/lib/read-trace.mjs
  - cadence-core/bin/read-trace.test.mjs
  - cadence-core/bin/lib/subagent-trace.mjs
  - cadence-core/bin/subagent-trace.test.mjs
---

# Phase 3: The record states the effort that actually ran - Plan 1

## Goal

The `SubagentStop` hook states, on every event it writes, the effort the worker
actually ran at and the rung it was dispatched under. This plan lands the
evidence and the writer: the OQ-2 observation written down before any code, the
reader that takes the effort off the worker's own transcript, the lookup that
turns the host's agent type back into a rung, and both hook writes carrying the
pair.

## Must be true when done

- A spike record under `.planning/spikes/` states the OQ-2 observation, and its
  commit is the first commit of this phase - no file under `cadence-core/`
  changed in it or before it.
- Handed a worker transcript whose assistant lines all report `high`, the
  transcript rule answers `high` verbatim; handed one whose lines disagree, or
  one where no line reports an effort at all, it answers absent.
- Handed `cadence:cad-assumptions-analyzer` the agent-type rule answers `xhigh`
  and handed `cadence:cad-assumptions-analyzer-high` it answers `high`, so no
  filename suffix is being read as a rung.
- A stop whose transcript reports an effort produces an event carrying that
  string verbatim and the dispatched rung beside it, whether the rule wrote a
  `return` or a `worker_cache` fact.
- A stop whose transcript reports no effort produces an event carrying neither
  key, and the existing exact key-set assertions in
  `cadence-core/bin/subagent-trace.test.mjs` pass unedited.
- A stop whose transcript reports an effort but neither cache figure still
  produces a `worker_cache` fact under a withholding gate.
- `node cadence-core/bin/test.mjs` and `npx tsc -p tsconfig.ci.json` pass.

## Context

CONTEXT.md's decisions bind every task here. The load-bearing ones: the effort
is read off the WORKER's own transcript and never off the hook payload, not even
as a fallback (D-01); it rides EVERY write the hook makes, because 114
`worker_cache` facts stand against 2 hook-written returns on this record (D-02);
the routed side is the payload's `agent_type` stem mapped back through
`RUNG_FILES` (D-03); the string is recorded verbatim with no validation against
Cadence's rung enum, and absent OMITS the key (D-04); the reader is a third pure
function beside `cacheOf` and `terminalOf` (D-06); it answers a string only when
the transcript is unambiguous (D-07); and an effort counts as a figure in the
fact's "nothing to give" test (D-08).

Out of scope here: everything downstream of the written event - the render fold,
the bracket row and the `/cad-report` column are PLAN-2; the prose, budget rows,
DOCS-CLAIMS anchors and the `TRC-13` text are PLAN-3. Also out: repairing the
dead `return` path (D-18), reading effort off the payload, and validating the
host's string against any enum.

## Tasks

### Task 1: Write the OQ-2 spike record, before any code

- **Files:** .planning/spikes/host-effort-downgrade/SPIKE.md
- **Action:** Write the OQ-2 evidence as a spike record in the shape
  `.planning/spikes/maxturns-cap-behaviour/SPIKE.md` already uses - a title
  naming the question, a `**Status:**` line, `## Question`, `## Decision that
  hinges on it`, `## Observation` and a verdict. The question is ROADMAP.md:78-82's:
  whether Claude Code silently downgrades an `xhigh`/`max` dispatch to `high`
  when thinking is off, or still hard-errors. The decision that hinges on it is
  this whole phase: a negative answer voids it and closes `GH-226`. The
  observation is CONTEXT.md D-01's four measured runs on host 2.1.258 with Opus
  5 - a headless `--effort max` session and a `max`-declared subagent, each with
  `MAX_THINKING_TOKENS=0` and with thinking on, recording `"effort":"high"` and
  `"max"` respectively on their own assistant lines, while the `Stop` and
  `SubagentStop` payloads carried `"effort":{"level":"max"}` in all four. The
  verdict states the downgrade is real, silent, and invisible on the payload, so
  the transcript is the source and `GH-226`, `REQUIREMENTS.md:21` and
  `ROADMAP.md:170-176` are corrected rather than followed. State the two corpus
  figures D-04 rests on - 5,701 of 5,701 recent assistant lines carrying a
  top-level `effort` string and 0 under `message`, and 6 of 368 transcripts
  carrying none at all - because they are what makes the absent arm a measured
  case and not a defensive one. This commit lands ALONE: AC1 requires it to
  precede every code commit of the phase in `git log`.
- **Verify:** `git show --stat HEAD` names
  `.planning/spikes/host-effort-downgrade/SPIKE.md` and no file under
  `cadence-core/`, so the record lands alone and first. Then the record's own
  CONTENT is checked against AC1 rather than counted: `grep -c` on
  `.planning/spikes/host-effort-downgrade/SPIKE.md` returns non-zero for EACH of
  `2\.1\.258`, `MAX_THINKING_TOKENS=0`, `"effort":{"level":"max"}`,
  `5,701`, `368` and `## Verdict`, and `grep -c '"effort":"high"'` and
  `grep -c '"effort":"max"'` each return at least 2 - the session and the
  subagent arm of both thinking states. A heading count cannot fail on a
  skeleton carrying none of those, which is the shape AC1 exists to refuse.

### Task 2: The transcript rule answers the effort the worker ran at

- **Files:** cadence-core/bin/lib/subagent-transcript.mjs (`assistantEntries`,
  and the `cacheOf` / `terminalOf` pair it feeds),
  cadence-core/bin/subagent-transcript.test.mjs
- **Action:** Add a third exported pure function beside `cacheOf` and
  `terminalOf`, taking the same injected transcript text and walking the same
  `assistantEntries` generator, that answers the effort the worker ran at.
  The value is the TOP-LEVEL `effort` string on an assistant line, never
  anything under `message` - measured 2026-09-02, 5,701 of 5,701 recent
  assistant lines carry it at the top level and 0 under `message` (D-04). It is
  recorded VERBATIM in the host's own spelling with no validation against
  Cadence's rung enum: the enum is a CONFIG rule (`config.schema.json:19-23`),
  and validating here would erase a renamed host rung at exactly the moment it
  is the signal (D-04). The answer is the one value when every line that carried
  a non-empty string carried the SAME one, and absent when two of them differ -
  TRC-06's "unambiguous or nothing", never last-line-wins and never
  first-line-wins (D-07); 0 of 368 measured transcripts mix values, so the
  disagreement arm is a refusal and not a merge. A line carrying no readable
  effort is SKIPPED rather than treated as disagreement, the same posture
  `cacheOf` takes for an entry with no usable `usage` - a missing value is not
  an ambiguity, and this case is unmeasured, so losing a real observation to it
  would be the worse direction. Absent is the answer for anything that is not a
  non-empty string, which is what an absent, empty or over-cap file arrives as.
  Never throws: the only caller is a hook contractually forbidden to speak on
  any stream. Add the reasoning to the file's header comment block the way the
  cache and termination rules already state theirs - the comments in this file
  are the design record.
- **Verify:** `node --test cadence-core/bin/subagent-transcript.test.mjs` passes,
  including new cases showing: three assistant lines all carrying `high` answer
  `high`; two lines carrying `high` and `max` answer absent; a transcript whose
  lines carry no effort answers absent; a line carrying `effort: ""` or a
  non-string answers absent; a line carrying no effort beside two agreeing lines
  still answers the agreed string; an effort nested under `message` and absent at
  the top level answers absent; and the rule answers absent rather than throwing
  for `undefined`, `null`, `{}` and a truncated final line.

### Task 3: The rung a host agent type names, read off the one rung map

- **Files:** cadence-core/bin/lib/read-trace.mjs (`ROLE_OF_STEM` and
  `roleOfAgent`, and the `RUNG_FILES` import they read),
  cadence-core/bin/read-trace.test.mjs
- **Action:** Add a second exported function beside `roleOfAgent`, answering the
  RUNG that `RUNG_FILES` files the agent type's stem under, and null for
  anything the map does not name - the host's own types, `coordinator`, a
  non-string. It reads the SAME `RUNG_FILES` import already at `:45` and sits
  beside the `ROLE_OF_STEM` map at `:1107`, so the two answers about one
  spelling come from one statement of the table; a stem->rung map built the way
  `ROLE_OF_STEM` is built is the shape to follow. Factor the
  `<plugin>:<agent-file-stem>` split that `roleOfAgent` performs so BOTH
  functions call one copy of it - do not paste the expression a second time:
  `helper-census.test.mjs` matches shared-contract BODY IDIOMS tree-wide, and a
  copy under a new name is exactly what that census exists to catch. Never
  derive a rung from a filename suffix: `cad-assumptions-analyzer` is that
  role's `xhigh` rung while `cad-assumptions-analyzer-high` is its lower one, so
  no suffix convention is true of all 19 files (`read-trace.mjs:37-45`,
  `lib/rung-agent.mjs:21-36`). Export it for `lib/subagent-trace.mjs` and say so
  in the doc comment, the way `roleOfAgent`'s already names its caller.
- **Verify:** `node --test cadence-core/bin/read-trace.test.mjs` passes,
  including new cases showing: `cadence:cad-assumptions-analyzer` answers
  `xhigh` while `cadence:cad-assumptions-analyzer-high` answers `high`;
  `cadence:cad-executor` answers `high`; the bare stem with no `cadence:` prefix
  answers the same as the prefixed spelling; `fork`, `general-purpose`,
  `coordinator`, `""`, `null` and a non-string all answer null; and a loop over
  every role and rung in `RUNG_FILES` shows each filed stem answering the rung it
  is filed under, so the function and the map cannot drift apart.

### Task 4: Both hook writes carry the observed effort and the dispatched rung

- **Files:** cadence-core/bin/lib/subagent-trace.mjs (`closeForStop` and
  `cacheFact`), cadence-core/bin/subagent-trace.test.mjs
- **Action:** In `closeForStop`, take the observed effort off the injected
  transcript with task 2's reader, beside the existing `cacheOf` and `terminalOf`
  calls at `:451-452`, and the dispatched rung off `payload.agent_type` with task
  3's function. NEVER read `effort` off the payload, not even as a fallback: the
  payload carries the CONFIGURED level (`{"level":"max"}` measured 2026-09-02 on
  a run whose transcript records `high`), which is the exact downgrade this phase
  exists to expose, and the file's own "NO FALLBACK to `transcript_path`" posture
  in `bin/subagent-trace.mjs:100-104` is the same rule about the same hazard
  (D-01). Both values ride BOTH writes - the `return` built at `:532-542` and the
  `worker_cache` fact `cacheFact` builds at `:313-325` - because 114 facts stand
  against 2 hook-written returns on this record and putting the effort on
  `return` alone records it on zero live dispatches (D-02). THE TWO KEY NAMES ARE
  FIXED HERE and PLAN-2 reads them: the observed effort rides as `effort`, which
  AC2 pins by name, and the dispatched rung rides as `rung`, which is the
  planner's choice so that `/cad-report`'s existing `rung` column has a source
  with its own name. They are ONE PAIR:
  spread both keys when the observed effort is a non-empty string, and OMIT BOTH
  when it is absent, on the omit-never-null rule `ts` and `agent_id` already
  follow at `:539-540` (D-04). The pair is why the rung is not written alone -
  the rung exists to be compared against an observed effort, and D-15 pins the
  exact key-set assertions at `:429-451` and `:501-512` green unedited, whose
  payloads carry an `agent_type` and whose transcripts carry no effort. Gate 1 at
  `:444-445` already refuses every type `RUNG_FILES` does not name, so on any
  event this rule writes the rung is resolvable; do not add a second arm for a
  rung that could not be resolved. Widen `cacheFact`'s "nothing to give" guard at
  `:314` so an effort counts as a figure: a transcript reporting an effort and
  neither cache key still writes the fact (D-08), while a transcript reporting
  nothing at all still writes nothing. Grow `cacheFact`'s parameters rather than
  reaching around it, and keep the `id`/`source` guards on that line exactly as
  they are - `corr` plus `agent_id` is the fold's only key and an id-less fact
  can never reach a bracket (D-10). Update the `@returns` typedef at `:432-435`
  and the header block's account of what each write carries.
- **Verify:** `node --test cadence-core/bin/subagent-trace.test.mjs` passes, with
  the two exact key-set assertions at `:429-451` and `:501-512` unedited, and
  new cases showing: a terminal stop whose transcript reports `high` on every
  assistant line produces a `return` carrying `effort: "high"` and
  `rung: "high"` for a `cadence:cad-executor` type, and `rung: "xhigh"` for a
  `cadence:cad-executor-xhigh` one; each withholding gate produces a
  `worker_cache` fact carrying the same two; a transcript reporting `xhigh` records `xhigh` verbatim rather
  than any Cadence spelling; a transcript with no effort produces an event with
  neither key present; a transcript reporting an effort and carrying no `usage`
  at all still produces a `worker_cache` fact under a withholding gate; and a
  payload with no `agent_id` still writes no fact.

## Notes

- Plans 1, 2 and 3 of this phase are SEQUENTIAL, not parallel. PLAN-2 folds the
  event shape this plan writes, and PLAN-2 and PLAN-3 both re-pin rows in
  `cadence-core/bin/weight-budgets.json`. The CONTEXT `Plan shape` directive asked
  for these three slices and they are three plans, but they are not independent
  and must not be dispatched in parallel.
- Task 3 places the agent-type -> rung lookup in `lib/read-trace.mjs` rather than
  `lib/rung-agent.mjs`. CONTEXT D-03 names `RUNG_FILES` as the map without naming
  a home for the lookup, so this is the planner's choice: `read-trace.mjs`
  already imports `RUNG_FILES`, already owns the `<plugin>:<stem>` split, and
  already exports `roleOfAgent` to `lib/subagent-trace.mjs` for the same question
  about the same spelling. Putting the sibling anywhere else would mean a second
  copy of the split.
- **DIVERGENCE from D-07, recorded rather than taken silently.** D-07's wording
  is "the reader answers a string only when EVERY assistant line agrees"; read
  literally, a line carrying no effort has not agreed, so a partially observed
  transcript would answer absent. Task 2 instead SKIPS such a line and answers
  the agreed string. The reason: D-07's rejected alternatives are "last line
  only" and "first line only", both about lines that carry a value, and its
  evidence is TRC-06's "unambiguous or nothing" - a rule about ambiguity, which a
  missing value is not. `cacheOf` already takes the same posture for an entry
  with no usable `usage`. The corpus D-04 rests on measured 5,701 of 5,701 recent
  assistant lines carrying a top-level effort string and 0 of 368 transcripts
  mixing values, so the mixed-PRESENCE case is unmeasured in both directions. The
  cost of the divergence is stated: under a host format transition where some
  lines lose the field, this reader reports the observed string where the literal
  reading would report absent. Task 2's test set pins the case either way (a line
  carrying no effort beside two agreeing lines still answers the agreed string),
  so flipping it is one assertion. If a UAT finds this wrong the direction to
  flip is toward absent, which loses an observation rather than inventing one.
