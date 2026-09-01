---
phase: 2
plan: 3
requirements:
  - AUT-03
files:
  - cadence-core/bin/lib/trace-suggest.mjs
  - cadence-core/bin/trace-suggest.test.mjs
  - cadence-core/bin/weight-budgets.json
---

# Phase 2: A receipt can name its home and its authorization - Plan 3

## Goal

One human answer is distinguishable from two everywhere the record is read.
This plan lands the reader half: `/cad-suggest` counts the DECISIONS behind a
trigger's override receipts rather than the writes, and the phase closes with
its three gates green.

## Must be true when done

- A run whose overrides were two writes on one authorization is reported by
  `trace suggest` as one decision from two writes, naming the trigger; a run
  whose overrides were two writes on two authorizations produces no such line.
- A trace holding no `outcome/override` event, and a trace whose override
  receipts carry no authorization id at all, both produce exactly the
  suggestions they produce today - the committed
  `cadence-core/bin/fixtures/verbatim.trace.jsonl` render is unchanged.
- The new receipt asks for nothing: it names no config key and proposes no
  change, the disposition every rule with no schema key behind it already takes.
- `node cadence-core/bin/test.mjs`, `npx tsc -p tsconfig.ci.json` and
  `node cadence-core/bin/self-verify.mjs` all pass over the whole phase's work,
  with every edited prose file's `weight-budgets.json` row re-pinned.

## Context

CONTEXT.md's decisions bind this plan. The load-bearing ones: the suggest reader
is NEW work and not a retarget - `lib/trace-suggest.mjs` reads exactly four
event shapes today (`outcome/adjudication`, `outcome/rearm`, `routing/resolve`,
`lifecycle/checkpoint`), its only other `override` string is the unrelated
`model.overrides.*` config key, and `override` reaches one consumer in the whole
tree, `FIRE_RECEIPTS` in `planning/risk-check.mjs` (D-12); the authorization id
is minted per answer and shared across every receipt written on it (D-02); it
labels and never widens (D-03). The field this rule reads is
`authorization_id`, written by PLAN-2's task 2.

Out of scope: any change to what a suggestion DOES - this file's posture is that
suggestions are input to a decision the user makes, never applied by anything -
and any change to `risk-check.mjs`, which is the other `override` reader and
keeps its own rules (D-03).

## Tasks

### Task 1: `/cad-suggest` counts decisions rather than writes

- **Files:** cadence-core/bin/lib/trace-suggest.mjs (`suggestFromRender`'s
  gather loop and its evidence-floor constants),
  cadence-core/bin/trace-suggest.test.mjs
- **Action:** Nothing in the tree counts `override` events except the blocking
  gate, so a reader cannot today tell a duplicate write from one decision
  applied to a second range - which is the whole of what `AUT-03` asks the
  record to state. Add a rule to `suggestFromRender` that reads
  `outcome/override` events in the SAME single pass over `events` the four
  existing shapes are read in, groups them by their `trigger`, and counts
  DECISIONS against WRITES: two events sharing an `authorization_id` are one
  decision, and an event carrying no id at all counts as its own decision. That
  last half is the load-bearing one: an unlabelled receipt is an unknown, not a
  shared answer, so every trace written before the flag existed keeps reading
  "N decisions from N writes" and the rule stays silent on it - the same
  unrecorded-is-never-a-match rule the token and turn totals follow. Emit
  `kind: 'info'` with `action: null`, the disposition of every rule with no
  `config.schema.json` key behind it, and this file's own test refuses an action
  naming a key the schema lacks. `subject` is the trigger, as R1's and R2's are.
  The evidence names both figures, drawn from the record and not adjectives -
  how many authorizations stood behind how many override receipts for that
  trigger. SILENT where writes and decisions are equal, and silent below any
  override at all: a receipt saying "2 decisions from 2 writes" is a line added
  to every trace that says nothing about the run it read, which is the disposition
  R6 states for a render with no coordinator block. Give it an evidence floor in
  the `MIN_*` group above with a comment saying what it is counted in, the way
  `MIN_FIRES_FOR_GATE_SUGGESTION`'s does. Keep the file pure - no I/O, every
  rule a function of the render - and read the id off the event with the same
  string guard `corrOf` applies to `corr`, so a non-string value cannot become a
  group key.
- **Verify:** `node --test cadence-core/bin/trace-suggest.test.mjs` passes with
  new cases: a render holding two `outcome/override` events on one trigger
  sharing an `authorization_id` yields exactly one `info` whose subject is that
  trigger, whose `action` is null, and whose evidence names one decision and two
  writes; the same two events carrying different ids yield no such suggestion;
  two events carrying no id yield none; and a render holding no override event
  yields the suggestion list it yields today. The existing committed-fixture
  `deepEqual` over `cadence-core/bin/fixtures/verbatim.trace.jsonl` passes
  unchanged - that fixture holds zero `outcome/override` events, so a line
  appearing there is the rule firing where it must not.
  `npx tsc -p tsconfig.ci.json` passes.

### Task 2: Close the phase on its three gates

- **Files:** cadence-core/bin/weight-budgets.json
- **Action:** Run the phase's three gates over the whole tree, not over this
  plan alone: `node cadence-core/bin/test.mjs`, `npx tsc -p tsconfig.ci.json`
  and `node cadence-core/bin/self-verify.mjs`. Every prose file this phase
  edited sits at its byte ceiling by construction - `references/triage-gate.md`
  was 24,693/24,693 measured 2026-09-01 - and `self-verify`'s budget check is a
  CEILING, so a file that grew and was not re-pinned reports `budget-overrun`
  and a file that shrank needs nothing (D-13). Re-pin any row still over its
  entry here; change no other row, and do not lower a row to a file's current
  size as tidiness - the check taxes growth, not headroom. If a gate fails for
  any reason other than a budget row, fix it at its source rather than by
  loosening the check: an assertion re-pinned to make a suite green is the
  failure this phase exists to stop the record making elsewhere.
- **Verify:** `node cadence-core/bin/test.mjs` exits 0,
  `npx tsc -p tsconfig.ci.json` exits 0, and
  `node cadence-core/bin/self-verify.mjs` reports no `budget-overrun`, no
  `unbudgeted-surface` and no `unknown-flag`.

## Notes

**Plan order.** This plan runs LAST. It shares
`cadence-core/bin/weight-budgets.json` with PLAN-2, so `plan-overlap` reports
the overlap and `/cad-execute` routes the three plans sequential on its own. The
order is a real dependency and not a preference: task 1 reads
`authorization_id`, the field PLAN-2's task 2 defines, and task 2 is the phase's
close-out gate.

**Why this slice is separate from PLAN-2 at all.** It is the one genuinely
file-disjoint piece of the phase - `lib/trace-suggest.mjs` and its test share no
path with the two flag surfaces - and folding it into PLAN-2 would push that
plan's declared read set from 575,016 to 683,657 bytes, past the 675,000
`workflow.max_plan_bytes` ceiling.
