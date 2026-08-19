# Roadmap

## Overview

**`v3.5.5 - a seam that accepts what it should refuse`, opened 2026-08-18.**
Scoped from the tracker milestone `v3.5.5`, which holds twelve issues: #137,
#142, #144, #147, #182, #183, #219, #220, #221, #222, #223 and #224. Six of
those (#219 through #224) were filed at the open, from a full audit of the
capture queue that re-verified each defect live rather than trusting its note.

**The theme is one sentence: an argument face that says yes to input it has a
rule against.** `v3.5.4` closed the shape for a control that reaches its path
and mis-answers. This cycle takes the door: a reader that accepts a malformed
value and answers as if it were well-formed, a guard that reads an empty string
as a configured one, a gate that cannot be satisfied by the key its own seam
document permits.

The first four phases are ordered by what a wrong answer costs, not by where the
code lives. Phase 1 carries the two that REMOVE a protection - one unprotects every
branch, the other lets one repository answer another's blocking gate. Phase 2
carries the readers that accept malformed input and answer anyway. Phase 3
carries the gates that fire on themselves or cannot be satisfied at all. Phase 4
is the structural form of phase 2, and goes last on purpose: a declarative
argument contract is only worth writing once the case-by-case fixes have said
what it has to express.

Phase 5 is not part of that theme and does not pretend to be. It is the README
restructure decided 2026-08-18, promoted into this cycle from the capture queue
rather than held for a docs milestone. It shares no code with the four defect
phases and depends on none of them.

The prune left the Overview describing `v3.5.4`; it now describes this cycle.

## Phases

- [ ] **Phase 1: The re-run that overwrites its own evidence** - `/cad-execute` refuses a phase that already executed, and a plan's per-task report becomes run-scoped so a second run cannot destroy the first run's record

## Phase Details

### Phase 1: The re-run that overwrites its own evidence
**Goal:** Re-running an executed plan stops being both unguarded and
destructive: the locate step refuses a phase whose derived status is `executed`
and names the supported path, and `reports/plan-<k>.md` becomes run-scoped by
the correlation id that already exists, so two runs of one plan leave two
readable records instead of one.
**Depends on:** Nothing
**Requirements:** (seeded at /cad-context)

`#195` is two halves with one fix site each, and the pair is what makes it the
first phase of this cycle. Every other item scoped to `v3.5.6` costs a partial
mutation reported as success, which `/cad-audit` reports and a re-run repairs.
This one costs the evidence itself.

The first half: `cadence-core/workflows/execute.md`'s locate step stops on
unplanned and on missing plan files, and on nothing else. A phase whose cursor
status is `executed` is dispatched again exactly like a fresh one, a new
executor starting at task 1 against a plan whose tasks are already committed.
The within-run protections already read `reports/plan-<k>.md` for completed task
numbers so a continuation cannot repeat a finished task; that reasoning is
simply not applied across runs.

The second half: `skills/cad-executor-contract/SKILL.md` rewrites
`<plandir>/reports/plan-<k>.md` after every task commit and fixes the path with
no run component, so the second run's FIRST task commit overwrites the first
run's report before anything has read it. That report is the only per-task
record of what ran and what it printed. SUMMARY maps task to hash, the
risk-check record is keyed to the run, and the trace brackets carry the token
figure - every one of those is run-scoped or append-only EXCEPT the most
detailed one.

The correlation id is already unique per run and already derives from
`PHASE_START`, so the scoping key is in hand and costs nothing to adopt. The
blast radius is five sites that must move together: three read sites in
`execute.md` and two declarations in the executor contract, which is a preloaded
surface under a weight budget, so the shorter spelling is the cheaper one.

**Success Criteria:**

1. The suffix-picker's tests pass across three fixture states - no report
   present, one present, several already rotated - and mutating the picker to
   return the base name unchanged fails at least one case.
2. In a fixture plan directory, rotating twice leaves three readable reports,
   and the earliest one is byte-identical to its pre-rotation content.
3. A prose-agreement test asserts that `execute.md`'s locate step refuses derived
   status `executed` and `complete`, and that its `status` call is not under the
   `else` branch; the test fails when either is reverted.
4. `/cad-execute <N>` against a phase whose derived status is `executed` refuses,
   names `/cad-undo <N>` then `/cad-execute <N>`, and the phase trace records no
   executor dispatch for that invocation.
5. `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an
   empty `problems` array, with `cadence-core/bin/weight-budgets.json` re-pinned
   in the same commit as the prose edits.
6. `/cad-report <N>` on a phase carrying a rotated report lists both reports.
