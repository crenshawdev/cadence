---
phase: 2
plan: 3
requirements:
  - RBK-01
files:
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/planning.mjs
---

# Phase 2: The read-back gate - Plan 3

## Goal

The two readings this phase exists to separate are separated ON DISK: a run
whose memory backend was off, a run whose search surfaced nothing, and a run
whose non-empty surfaced set the plan cited zero of are three states a reader
tells apart from the recorded fields alone - and the whole tree still agrees
with itself afterwards.

## Must be true when done

- Three recorded runs - backend off, surfaced set empty, surfaced set non-empty
  and cited zero - are told apart by the fields on their records, with no
  reference to the session that produced them.
- A reader cannot mistake any one of the three for either of the others by
  reading a count alone: the off state and the empty state both count zero and
  are still distinct on the record.
- `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
  `problems: []`.
- `node cadence-core/bin/test.mjs` reports 0 failures.

## Context

Runs AFTER plans 1 and 2 and shares `cadence-core/bin/planning.mjs` and
`cadence-core/bin/planning.test.mjs` with both, so it is SEQUENTIAL. It must not
touch `cadence-core/workflows/plan.md`: plan 2's last task pins that file's byte
budget and its seam-invocation census against what plan 2 left there.
Locked by `phases/2/CONTEXT.md`: D-06 makes `memory.backend: none` a THIRD state
on the record, distinct from both "surfaced nothing" and "surfaced N, cited
zero", and notes that this repository sets no `memory.backend` and runs the
`builtin` default, so the off arm never occurs in its own dogfooding and has to
be CONSTRUCTED to be tested. The seam half of that state is plan 1's task 4 and
the event field is plan 2's task 1; what remains here is proving the three are
separable on disk, and closing the tree-wide agreement surfaces a new
subcommand and new prose disturb (D-13 on the naming rule, D-14 on the two
re-pinned rows).

## Tasks

### Task 1: Three runs, told apart by their records alone

- **Files:** cadence-core/bin/planning.test.mjs
- **Action:** Add the three-state case to the `cite-count` section, built on the
  same `makeTree` fixture builder and scratch trees the rest of the file uses.
  CONSTRUCT all three states in one test file rather than sampling whichever the
  repository happens to be in: one fixture whose `config.json` sets
  `memory.backend` to `none` and which passes no payload, one whose payload
  carries an empty result list, and one whose payload carries results the phase's
  plan cites none of. Read each run's RECORD - the appended `trace.jsonl` line,
  not the envelope alone, since "measurable across phases" is a claim about the
  record and criterion 4's separation has to hold for a reader who was not in the
  session - and assert that no two of the three carry the same combination of
  fields: the off run is marked as backend-off, the empty run counts zero
  surfaced without that mark, and the third counts a non-empty surfaced set
  against a cited count of zero. Assert the pairwise distinctness explicitly, so
  a change that collapsed the off state into the empty one fails here rather
  than passing on two tests that each look at one run. Do not add a field to
  make the assertion easier - the separation is the one D-06 locked, and a
  fourth marker restating it would be a second source for one fact.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` reports 0
  failures, and removing the backend-off mark from the appended event makes
  exactly this test fail with a message naming which two states became
  indistinguishable.

### Task 2: The tree agrees with itself

- **Files:** cadence-core/bin/planning.mjs
- **Action:** Close the agreement surfaces a new subcommand and new workflow
  prose disturb, and change only what they report. The ones that can move here:
  self-verify's prose lint resolves every `planning.mjs <word>` occurrence
  through `subcommandKey` against `CONTRACTS` and files `unknown-subcommand` or
  `unknown-flag` for anything the row does not declare, so the new subcommand's
  name and all three of its flags must read from the table exactly as the
  workflow spells them; `BULK_SHAPES` watches `/\brecall\b/g` scoped to lines
  containing `planning.mjs` and files `bulk-output-unregistered`, so no line of
  this file's header block or its handler comments may put those two words
  together (D-13, which is the OPPOSITE of phase 1's D-13 where the watcher did
  not see the new site); `lib/scratch-path.mjs`'s rules hold plan 2's blocks;
  the family census in `trace.test.mjs` walks the prose surfaces and route.mjs
  and review-provider.mjs for producers, so an in-code producer in this file is
  admitted without a census edit; and `arg-contract-adoption.test.mjs` walks the
  whole table, so the new row's refusal arms are exercised the moment it exists.
  This file's own header Subcommands block is prose about code in the same file
  and must name the new subcommand and its flags as they ship. Fix what the two
  gates report, and nothing they do not: a check that goes green by widening its
  scope or by adding an exemption has recorded the defect as correct.
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
  with `problems: []`, and `node cadence-core/bin/test.mjs` reports 0 failures
  across every group.

## Notes

- This plan is two tasks because the seam half of the three-state separation
  moved into plan 1 (its task 4) and the two re-pinned rows into plan 2 (its
  task 6). Both moves are ordering constraints, not scope changes: the seam has
  to accept a payload-less call before plan 2's prose prescribes one, and the
  byte-budget pin has to be the LAST edit that changes
  `cadence-core/workflows/plan.md`. The deviation from CONTEXT's stated
  three-way split is recorded in plan 1's Notes and in the planner's return.
- AC7's two commands are also the Verify on every other plan of this phase.
  They are a task here because a new subcommand and ~2 KB of new workflow prose
  reach five drift linters that no single earlier task owns, and leaving them
  to the last executor's discretion is how a phase ends with a red tree and no
  task to hang the fix on.
</content>
