---
phase: 3
status: complete
completed: 2026-08-23
---

# Phase 3: The fast path leaves a record - Summary

`/cad-task` now writes `.planning/tasks/<slug>/RECORD.md` through a `task-record`
seam, the recall corpus and `/cad-why`'s commit index both read it, and the run
brackets itself under a per-run phase-0 correlation anchor so `cad-task` appears
in the per-role accounting.

## What shipped

- The record's one home and grammar - `cadence-core/bin/lib/task-record.mjs`
  (`TASKS_DIR`, `RECORD_FILE`, `isTaskSlug`, `insideRoot`, `taskRecordsIn`,
  `renderTaskRecord`)
- The writer - `planning.mjs task-record --slug --base --head --text-file`,
  deriving every figure from the range
- The recall tier - `parseTaskRecordSnippets` plus the tasks walk in `cmdRecall`
- The `/cad-why` tasks tier - `buildTaskIndex` in `lib/why-corpus.mjs`, merged
  third of four tiers, rendered as an off-roadmap task by `lib/why-render.mjs`,
  with `RECORD.md` read as the declaration source
- The bracket and the record call in `cadence-core/workflows/task.md`, pinned by
  `trace.test.mjs` and `prose-agreement.test.mjs`
- This repository's own first record - `.planning/tasks/bound-plan-size/RECORD.md`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 9d52efd5 | lib/task-record.mjs - constants, slug grammar, contained lister, pure renderer |
| 1 | 2 | acbd00fe | `task-record` subcommand, CONTRACTS row, COMMANDS entry |
| 1 | 3 | 20884d63 | the recall corpus reaches the tasks tier |
| 1 | 4 | a2f7f633 | the `bound-plan-size` record, written by running the seam |
| 1 | gate | 71234385 | fix: the record writer is contained the way the record reader is |
| 2 | 1 | b680a372 | `buildTaskIndex` - a task record's commits as a tier of its own |
| 2 | 2 | 335a590e | the tier merged after the phase spine, ahead of recovery |
| 2 | (repair) | b6c6ebf5 | fix: unterminated assertion message in why-corpus.test.mjs |
| 2 | 3 | b871829c | a resolved task renders as a task, never as a phase |
| 2 | 4 | 72aeb59c | `RECORD.md` read as the declaration source |
| 3 | 1 | 4ede0907 | pin `--phase 0` on task.md's risk-check invocation |
| 3 | 2 | 7c071320 | the per-run phase-0 correlation anchor and its bracket |
| 3 | 3 | 82135d76 | the run writes its record and reports where it landed |
| 3 | 4 | none | the hand walk found the prose correct - its Action makes a correction conditional on the walk failing |

## Deviations

Two acceptance criteria were delivered as re-read rather than as written, and
CONTEXT.md has been amended to match (UAT, 2026-08-23). PLAN-3.md's Notes hold
the full reasoning for both:

- AC3's third clause ("that arm's trace holds zero `lifecycle/dispatch` events")
  contradicts its own first clause - a paired bracket and a `roles.cad-task` row
  exist only because a dispatch event does. Delivered as ROADMAP criterion 5
  states it: no dispatch on the inline arm names any role but `cad-task`.
- AC5's grep already failed against the shipped `cadence-core/workflows/task.md`,
  which names `/cad-context` at `:35` and `:254` and which this phase never
  touched on those lines. Both sentences route work OUT to the phase spine.
  Delivered as: `cad-plan-checker` and `cad-verify` appear nowhere and the
  `cad-context` count stays at exactly 2, byte-identical.

Otherwise plans executed as written. Two in-plan repairs are recorded above
rather than as deviations: `b6c6ebf5` fixed a syntax error plan 2's own task 2
shipped (the suite loaded the file and 0 of 40 cases ran), and `71234385` is the
fix the blocking `risk_surface` gate required of plan 1.

## Open items

- `lib/why-render.mjs` says "phase" about a directory that is not one: a resolved
  TASK entry renders `deviation: PHASE-SCOPED - ...` and `review: no adjudication
  record in this phase's directory`. The ANSWERS are correct (CONTEXT D-02
  anticipates the state); only the noun is wrong, and rewording moves bytes on
  every phase entry too, so it is its own decision.
- `lib/why-render.mjs` renders `decision: not yet joined` on a task entry, because
  `fieldDecision` returns `undefined` for a directory with no CONTEXT.md and the
  absent-placeholder is worded as not-yet-joined rather than this-record-carries-none.
- `taskRecordsIn` never applies `isTaskSlug` to the directory names it walks, so a
  hostile `tasks/` entry name (a newline, a terminal escape) reaches `/cad-why`'s
  rendered output verbatim. Raised `medium` by the plan 2 `risk_surface` review and
  ruled down to `low`: it needs a planning tree cloned from someone else and forges
  lines only in a diagnostic. The module already exports the predicate the lister
  would use.

Plan 3's report also notes task 4 produced no commit by design. That is
informational, not queued - the walk found nothing to correct.

## Goal check

The phase goal has three legs and each is met by evidence rather than by
assertion. RECALL: `planning.mjs recall "plan size ceiling max_plan_tasks task
count"` returns `tasks/bound-plan-size/RECORD.md` at rank 4 of 5, so a query
naming what a task did reaches that task's record. JOIN: `node
cadence-core/bin/why.mjs cadence-core/templates/config.json` renders commit
`093408c9` as `off-roadmap task bound-plan-size - a /cad-task run, not a roadmap
phase (tasks/bound-plan-size)`, where the pre-tier tree printed a gap block for
that commit, and it prints no phase number for it. PRICING:
`cadence-core/workflows/task.md:52-53` carries the `phase_start` anchor and the
`--event dispatch --role cad-task` open, `:219` the matching `trace close`, and
`:199` the `task-record` call whose landing site `:234` reports back - with
`trace.test.mjs`'s BRACKETING census now requiring that file to hold one written
dispatch, so the wiring cannot be removed silently.

Nothing in the goal looks missing. Two honest limits: the trace bracket is proved
against an isolated planning root rather than the live `.planning/` (plan 3 task
4's own reasoning - a proof that deliberately abandons a run would otherwise leave
a permanent `unpaired` `cad-task` entry mis-pricing this milestone forever), so
what is pinned is the prose and the census rather than a live-tree run; and the
renderer's "phase"-worded strings above mean a task entry reads correctly but not
yet idiomatically. Full suite `node --test cadence-core/bin/*.test.mjs` 2903 pass
/ 0 fail; `self-verify.mjs --root .` `ok:true` with `problems: []`.
