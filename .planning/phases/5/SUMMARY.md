---
phase: 5
status: complete
completed: 2026-09-07
---

# Phase 5: The evidence record and what comes next - Summary

The three evidence classes phase 4 found undurable now have a home in the store,
next-action selection reads them and answers from the frozen nine-rule table,
and `/cad-pause`'s guarded WIP-plus-resume-record behaviour is native to the
binary rather than assembled in markdown.

## What shipped

- **The evidence module** - `crates/cadence/src/evidence/` plus
  `evidence_service.rs`. Checkpoint payloads with byte-exact `Need` (E24),
  checker verdicts with their disposition and revision budget (E37-E38), and
  operator answers bound to the question that asked them (E65). Each record
  survives process death and reads back in a fresh process.
- **One override contract covering four spellings.** Permission is scoped to its
  pending occurrence, expires with it, and a restart does not refund a spent
  revision.
- **Changed material invalidates authority.** A checker verdict stops
  authorizing continuation once the material it examined changes; the verdict
  stays as history. D-06.
- **Evidence required for acceptance.** A contracted result carries a commit
  SHA, a `file:line` or a criterion id, or it is refused. D-10, AC7.
- **`crates/cadence/src/next_action/`** - observations captured separately from
  selection, and the nine frozen progress answers returned in first-match order
  with all eight adjacent-rule precedence pairs pinned to
  `cadence-core/workflows/progress.md:194-202` rather than to the selector under
  test.
- **`crates/cadence/src/pause/`** - the pause domain, a read-only Git adapter,
  durable branch gates, the commit-side risk gate, the authorized WIP commit and
  the committed resume record. A dirty start produces WIP plus a docs commit; a
  clean start produces only the docs commit. Killing the process at each of
  three barriers leaves the same two commits and no duplicates on retry.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | `44ab83ea` | define recoverable checkpoint evidence |
| 1 | 2 | `0ab3b79c` | commit evidence with guarded transaction |
| 1 | 3 | `724b8220` | wire checkpoint evidence through resident service |
| 1 | 4 | `bf4fc3a6` | retain checker results and revision budget |
| 1 | 5 | `13e9b9fa` | persist gate questions and operator answers |
| 1 | 6 | `a2b02a47` | require evidence for contracted acceptance |
| 1 | 7 | `037f854d` | prove evidence recovery after process death |
| 2 | 1 | `74cf4797` | record four override meanings through one contract |
| 2 | 2 | `d81a06ee` | preserve review receipt identity and finding references |
| 2 | 3 | `cf1afcb0` | limit override permission to its pending occurrence |
| 2 | 4 | `18b9c2cd` | invalidate checker authority when checked material changes |
| 2 | 5 | `a90a2f3d` | prove override authority survives restart without widening |
| 3 | 1 | `5911fa4d` | capture separate next-action routing observations |
| 3 | 2 | `8a010326` | select the nine frozen progress answers in order |
| 3 | 3 | `528b342e` | select next action through verified resident inputs |
| 3 | 4 | `a9facd3d` | recover the recorded continuation of named work |
| 3 | 5 | `cd20b793` | prove authored next-action answers in fresh processes |
| 4 | 1 | `c47d1fb9` | capture the exact authorized pause work |
| 4 | 2 | `e59a725c` | guard pause branches with durable operator answers |
| 4 | 3 | `01828c91` | preserve the pause risk gate |
| 4 | 4 | `8c292297` | preserve authorized work in a WIP commit |
| 4 | 5 | `c7ed9ad7` | commit the durable pause resume record |
| 4 | 6 | `288ec20c` | connect committed pauses to resume selection |
| 4 | 7 | `69381b13` | prove pause recovery across process loss |
| 4 | 8 | `eefa03a3` | pin phase acceptance evidence |

Planning-doc commits in the same range, not task work: `0d874c56` (the plan 1
run record), `e5c213ea` (the D-14 ruling plus the plan 2 and 3 run records).
`b1850af0` is unrelated to the phase and records the zero-JavaScript constraint.

Every commit is GPG-signed as `John Crenshaw <john@jcrenshaw.dev>` with key
`693AB15F91734B0C`, verified `G`. `cadence-core/` is byte-identical to
`v3.7.12` throughout.

## Deviations

- [deviation] **PLAN-4 task 3 checkpointed on a real loop, and the resolution
  became D-14.** Recording a review result writes `items.jsonl`,
  `decisions.jsonl` and `state.json`, which live inside the working tree
  (`crates/cadence/src/store/filesystem.rs:48`) and are transaction participants
  on every write (`crates/cadence/src/store/writer.rs:328-333`). So the
  commit-side risk gate reviewed a tree, and recording the review dirtied the
  tree it had just reviewed. D-14 rules the gate off the binary's own receipts
  by rule rather than by a filename list, and
  `crates/cadence/src/pause_service_tests.rs:528-540` proves an arbitrary future
  store participant is covered without another ruling. The precedent was exact:
  `cadence-core/references/risk-surface.md:37-42` had already solved the same
  loop once for four review-artifact filename shapes.

- [deviation] **Two Codex sessions raced the same worktree.** An executor
  believed stopped was still alive and writing PLAN-4 task 5 while a second
  dispatch was launched against the same five files. The second dispatch
  detected the collision and checkpointed `blocked` rather than proceeding,
  which was the correct call and cost nothing. The first session went on to
  finish tasks 5 through 8 and committed all four before it was terminated.

- [deviation] **The `gpt-5.6-sol` at xhigh trial did not happen.** It was
  dispatched and refused on the worktree collision above, so tasks 5-8 ran on
  the standing model. The trial and its baseline stand for a future cycle;
  nothing here measures the new model.

## Open items

- **Phase 5 has no UAT.** Phases 3 and 4 each carry one. Conversational UAT
  needs the operator, so the phase is complete on its plan criteria and its
  acceptance inventory, not on a human pass. Note that the frozen truth table
  derives `complete` only with a qualifying UAT, so this phase will derive
  `executed` until one exists.

- **Task 8's acceptance inventory is executable, not a substitute for UAT.** It
  names existing tests for the seven obligations and asserts the unit-test
  modules stay registered. It proves the evidence is present; it does not prove
  a person agreed the phase met its goal.

- **`/cad-execute` was bypassed again**, on the standing order to route
  execution to Codex. Receipts were written per plan as each landed. The gates
  `/cad-execute` would have fired did not run.

- **The tool surface is still `cadence_version` alone.** Every criterion in this
  phase is proven in-process. Phase 6 owns the external boundary, and until it
  lands no skill can reach any of this.

- **No phase owns the documentation rewrite.** Carried unchanged from phases 3
  and 4.

## Goal check

The goal was "the facts routing depends on written down when they happen, and
the binary selecting the next action from them". The twenty-five task commits
deliver all three evidence classes durably, an override contract that expires
with its occurrence, the nine-answer selector proven against the frozen table
rather than against itself, and a native pause that survives being killed at
three separate barriers.

Verified at `eefa03a3`, independently of the executor's own report: 237
workspace tests passing, 0 failing; `cargo clippy --all-targets -- -D warnings`
exit 0; `npx tsc -p tsconfig.ci.json` exit 0; `cadence-core/` unchanged against
`v3.7.12`; STATE, ROADMAP, REQUIREMENTS and this phase's CONTEXT untouched by
the task commits.

What is NOT established: none of this is reachable from a skill. The binary
answers "what comes next" to itself and to its tests, and to nothing else, until
phase 6 puts the typed tool surface in front of it.
