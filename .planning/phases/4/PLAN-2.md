---
phase: 4
plan: 2
requirements:
  - ENF-01
files:
  - cadence-core/bin/lib/planning-files.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/planning-files.test.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/seam-calls.test.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/workflows/context.md
  - cadence-core/workflows/new-project.md
  - cadence-core/workflows/adopt.md
  - cadence-core/workflows/plan.md
  # Task 7 only - the AC7 repair lease over PLAN-1's files (see that task)
  - cadence-core/bin/lib/trace.mjs
  - cadence-core/bin/lib/read-trace.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/read-trace.test.mjs
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/fixtures/join.trace.jsonl
  - cadence-core/bin/fixtures/join.reads.jsonl
  - cadence-core/references/plan-revision.md
  - cadence-core/references/review-triggers.md
  - cadence-core/references/seams.md
  - cadence-core/workflows/decision-review.md
  - cadence-core/workflows/execute.md
  - cadence-core/workflows/minimalism-review.md
  - cadence-core/workflows/report.md
  - cadence-core/workflows/verify-deep.md
  - skills/cad-executor-contract/SKILL.md
---

# Phase 4: Suggestions become seams - Plan 2

# SEQUENTIAL: run after PLAN-1

## Goal

The criteria ceilings three workflows state in prose are counted by a seam that
reports an out-of-range surface, and the two measured unbatched round-trips are
batched with the resulting per-workflow seam-call count pinned by a census.

## Must be true when done

- A seam counts a phase's declared criteria against ceilings the CALLER
  supplies: CONTEXT's `## Acceptance criteria` against 3-7 and ROADMAP's
  per-phase criteria against 2-5, with an out-of-range phase named.
- Both live spellings of the roadmap criteria heading - `**Success Criteria:**`
  and bare `Success criteria:` - are admitted, each with its own test row.
- A surface that declared no criteria reports `*_found:false` with
  `within: null`, and never a pass.
- `workflows/context.md`, `workflows/new-project.md` and `workflows/adopt.md`
  each call the seam at the moment they present a criteria count, so an
  out-of-range phase is reported to the user rather than only computable.
- `context.md` reads `memory.backend` and `planning.commit_docs` in one call,
  and `plan.md` issues `seed-reqs` and `cursor set` in one message.
- A census test asserts the per-workflow seam-invocation count for
  `context.md` and `plan.md`, and reddens when a call is added back.
- `node --test cadence-core/bin/*.test.mjs` passes and
  `node cadence-core/bin/self-verify.mjs` reports no `unbudgeted-surface`,
  `budget-overrun`, `unknown-flag` or config-key failure.

## Context

Locked decisions binding this plan: D-01 (two grammars in two files, only one
has a parser today), D-02 (both roadmap heading spellings are live and the
parser admits both), D-03 (reuse `plan-size`'s conditional-comparison
envelope), D-04 (ceilings are literal numbers in the seam's flags, never new
config keys), D-15 (`context.md`'s two config keys), D-16 (`execute.md`'s
twice-instructed `triage-gate.md` re-read is explicitly OUT), D-17 (`plan.md`'s
batch is a prose-only change), D-18 (the per-workflow count is pinned by a
census test, not by a prose sentence or a `DOCS-CLAIMS.md` row), D-19 (zero
weight-budget headroom on several surfaces), D-20 (a new flag or subcommand
needs its `CONTRACTS` row).

This plan is SEQUENTIAL after PLAN-1: it shares `planning.mjs`,
`self-verify.mjs`, `workflows/context.md`, `workflows/plan.md` and
`weight-budgets.json` with it, and task 6's census counts the calls PLAN-1 task
2 rewrites.

## Tasks

### Task 1: A reader for the roadmap's per-phase criteria list

- **Files:** cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/planning-files.test.mjs
- **Action:** ROADMAP.md's per-phase criteria list has NO reader at all today:
  `phaseRequirements` reads only `**Requirements:**` and `**Goal:**` out of a
  `### Phase N:` block (`:355-376`). Add a pure exported reader beside it that
  returns the criteria COUNT a phase's detail block declares. It must admit BOTH
  live spellings of the heading (D-02): `**Success Criteria:**` (bold, capital
  C, what `cadence-core/templates/ROADMAP.md:28` and `:36` write) and bare
  `Success criteria:` (what `.planning/ROADMAP.md` writes at all five of its
  phase blocks, `:68,91,118,139,163`; 10 hits tree-wide measured 2026-08-14). A
  parser anchored to the template alone reports "no criteria declared" for every
  phase of the repo whose dogfooding proves the seam, and under the
  absence-is-not-zero rule it reports nothing rather than failing, so the
  regression would be invisible. Reuse `phaseRequirements`'s block extraction
  exactly - `normalizeCrlf` first, the `^### Phase <N>:` anchor with its `.`
  escape, the search from AFTER the heading line, the bound at the next
  `^#{1,3} ` heading - so the two readers cannot disagree about where a phase
  block ends. The items are the numbered list under the heading. Pure and total:
  no I/O, no throw. Absence is not zero: a block with no criteria heading yields
  a not-found result, the same contract `phaseRequirements` states at
  `:346-349`, because a phase nobody wrote criteria for is not a phase with zero
  criteria. Fence handling stays exactly as `phaseRequirements` has it - phase
  3's D-02 left the roadmap paths fence-blind and widening that here is out of
  scope.
- **Verify:** `node --test cadence-core/bin/planning-files.test.mjs` passes with
  one row per heading spelling proving the same count is read from each, one row
  proving a block with no criteria heading reports not-found rather than zero,
  and one row proving a phase's block is bounded at the next heading so the
  following phase's criteria are not counted into it.

### Task 2: The criteria-ceilings seam

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/self-verify.mjs, cadence-core/bin/planning.test.mjs
- **Action:** Add a subcommand beside `plan-size` that counts BOTH grammars in
  one call (D-01): CONTEXT's `## Acceptance criteria` through the shipped
  `classifyAcceptanceCriteria` (`lib/planning-files.mjs:1037`, already the
  reader `criteria-coverage` counts per phase) against the caller's CONTEXT
  ceilings, and ROADMAP's per-phase criteria through task 1's reader against the
  caller's roadmap ceilings. A single-parser design silently reports not-found
  for every roadmap phase and ships the `new-project`/`adopt` half with no
  enforcement - the exact silent no-op this phase exists to remove. The ceilings
  arrive as literal numbers in this seam's FLAGS, supplied by the caller, and
  are NOT new config keys (D-04): `plan-size`'s header at `:1506-1509` states
  "the CALLER's resolved values; this seam reads no config", and two new keys
  would each need a `config.schema.json` entry, a `references/config-catalog.md`
  row and a `references/config-reach.md` row. Reuse `plan-size`'s
  conditional-comparison envelope rather than a bare boolean (D-03): a
  `compared` list naming the ceilings that actually ran, `within: null` when
  nothing was compared, and `*_found:false` for a source that declared nothing -
  `ok:true` having compared nothing reproduces the scan's own measured defect
  inside the seam built to fix it, and the comment at `:1543-1547` states why
  `within:true` beside `requirements_found:false` was wrong. `--phase` present
  scopes to one phase; absent walks every phase the roadmap declares, through
  the same `parseRoadmapPhases` list `cmdCriteriaCoverage` walks, so a caller
  that just wrote a whole roadmap checks it in one call. An out-of-range phase
  is named with its measured count and the ceiling it broke, the way
  `plan-size`'s `over` entries are. Add the subcommand's `CONTRACTS` row with
  its flags, or check 2 reports `unknown-subcommand` on correct prose (D-20).
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes with cases
  proving: a fixture phase whose roadmap block declares 1 criterion against a
  floor of 2 is named out of range and the envelope reports `within` false; a
  fixture phase declaring 6 against a ceiling of 5 is named the same way; a
  phase whose CONTEXT.md is absent reports `*_found:false` for the CONTEXT half,
  is never compared, and never contributes a pass; a call carrying no ceiling
  flags reports `within: null` with an empty compared list; and both roadmap
  heading spellings produce the same verdict. `node
  cadence-core/bin/self-verify.mjs` reports no `unknown-subcommand` and no
  `unknown-flag`.

### Task 3: Call the seam where each workflow presents a criteria count

- **Files:** cadence-core/workflows/context.md, cadence-core/workflows/new-project.md, cadence-core/workflows/adopt.md, cadence-core/bin/weight-budgets.json
- **Action:** In `context.md`, call the seam after `write_context` (the criteria
  must be on disk to be parsed) and before `update_cursor`, scoped to this phase
  with the 3-7 ceilings its own prose states at `:287`, and report an
  out-of-range count to the user in one line. It is a REPORT, not a gate -
  `plan-size`'s `phase-too-big` is presented and the workflow decides, and this
  mirrors it. In `new-project.md`, call it after `.planning/ROADMAP.md` is
  written and BEFORE the roadmap approval gate at `:305`, with the 2-5 ceilings
  `:292-294` states, so the "criteria count" column already presented at `:302`
  is the seam's count and an out-of-range phase is named in that same
  presentation. In `adopt.md`, the same call at the same moment, before the
  approval gate at `:198`, with the 2-5 ceilings `:192-193` states. One call per
  workflow, no config keys, and no second check beside the count. Every surface
  this grows carries its `weight-budgets.json` row change in the same work
  (phase 1 D-10, D-19): `new-project.md` and `adopt.md` sit at ZERO headroom
  (17,858/17,858 and 14,966/14,966 measured 2026-08-14) and `context.md` at
  627 B. Re-pin a row because the surface deliberately changed size, never to
  make a growth you did not intend go quiet.
- **Verify:** each of the three workflows contains exactly one invocation of the
  new subcommand carrying its ceiling flags, and in `new-project.md` and
  `adopt.md` that invocation appears before the roadmap approval gate;
  `node cadence-core/bin/self-verify.mjs` reports no `unknown-subcommand`, no
  `unknown-flag`, no `budget-overrun` and no `unbudgeted-surface`.

### Task 4: `context.md` reads both its config keys in one call

- **Files:** cadence-core/workflows/context.md, cadence-core/bin/weight-budgets.json
- **Action:** `context.md` reads exactly two config keys - `memory.backend` at
  `:84` and `planning.commit_docs` at the `commit` step, `:359` - and they are
  its only two (D-15). Read both in the ONE call at `:84`, using the batched
  multi-key form already shipped at seven other sites (`plan.md:32-39`,
  `execute.md:27-33`, `debug.md:59`, `adopt.md:42`, `new-project.md:66`,
  `milestone.md:9`, `skills/cad-land/SKILL.md:24`); `context.md` is the outlier.
  Say at the read that `planning.commit_docs` is carried forward to the commit
  step, and at `:359` that the value came from that batch, so nothing re-reads
  it. Do not add a third key, and do not move the `memory.backend` gate: it
  still precedes the recall call, because recall's own backend-off return is a
  backstop for a direct caller and not this workflow's gate. `context.md`'s
  `weight-budgets.json` row moves with any growth (D-19).
- **Verify:** `grep -c 'config.mjs' cadence-core/workflows/context.md` is 1, and
  that one invocation names both `memory.backend` and `planning.commit_docs`;
  the commit step no longer implies a second read;
  `node cadence-core/bin/self-verify.mjs` reports no config-key failure,
  `budget-overrun` or `unbudgeted-surface`.

### Task 5: `plan.md` issues seed-reqs and cursor set in one message

- **Files:** cadence-core/workflows/plan.md, cadence-core/bin/weight-budgets.json
- **Action:** The `commit` step's substeps 1 and 2 (`:367-392`) are two seam
  calls in two messages and NO value flows from the first into the second, so
  they batch. This is a PROSE-only change (D-17) - no seam change is planned for
  what a two-line prose edit closes. Instruct both calls in ONE message and keep
  every reporting rule attached to each intact: `orphan_ids` reported to the
  user, `no_active_section: true` reported as the DIFFERENT thing it is, and
  `ok:false` on `seed-reqs` reported while the workflow continues because
  seeding is not a gate. Do not fold them into one seam call, do not reorder
  substep 3, and do not touch `execute.md`'s twice-instructed `triage-gate.md`
  re-read, which D-16 declines explicitly because both of its sites sit on
  conditional failure arms that never fire on a happy path. `plan.md`'s
  `weight-budgets.json` row moves with any growth (D-19).
- **Verify:** the `commit` step instructs one message carrying both the
  `seed-reqs` and the `cursor set` call, and both blocks' reporting rules are
  still present; task 6's census counts `plan.md`'s invocations at the number it
  asserts; `node cadence-core/bin/self-verify.mjs` reports no `unknown-flag`,
  `budget-overrun` or `unbudgeted-surface`.

### Task 6: Pin the per-workflow seam-invocation count with a census

- **Files:** cadence-core/bin/seam-calls.test.mjs
- **Action:** Add a census test that counts seam invocations per workflow file
  and ASSERTS the number for `cadence-core/workflows/context.md` and
  `cadence-core/workflows/plan.md`, so a call added back reddens (D-18). The
  count is pinned by a census rather than by a prose sentence or a
  `DOCS-CLAIMS.md` row: nothing in the tree states such a count today - a grep
  for `seam call` / `round-trip` returns only single-call mentions
  (`references/req-traceability.md:89`, `workflows/suggest.md:32`,
  `workflows/verify.md:199,299`, `references/acceptance-criteria.md:346`) - and
  this repo treats a stale self-claim as a defect, which is phase 5's whole
  premise. Follow `cadence-core/bin/helper-census.test.mjs`'s shape: assert the
  walk itself is non-vacuous first so no row can pass on an empty read, then one
  named row per file carrying its expected count and a message saying what a
  failure means and where the call was added. Count the shipped invocation
  spelling (`node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/<script>.mjs" <sub>`),
  joining shell line continuations before counting the way
  `trace.test.mjs`'s `traceAppends` does at `:940`, so a wrapped multi-key
  `config.mjs get` counts as ONE call and not several. The expected counts are
  STATED here, not read off the tree - a census that baselines whatever it finds
  pins the bug as correct and can never show the drop ROADMAP AC4 asks for.
  Measured on this branch at plan time (2026-08-14, that same joined spelling):
  `context.md` 6 invocations, `plan.md` 11. Expected after this phase:
  `context.md` **5** - its one dispatch moment's two alternative close lines
  (`:179,193`) collapse to one `trace close`, while folding `planning.commit_docs`
  into the existing `config.mjs get` at `:84` adds a KEY and no call - and
  `plan.md` **9** - its two dispatch moments' four close lines
  (`:194,202,297,303`) collapse to two. Batching `seed-reqs` with `cursor set`
  puts two calls in ONE MESSAGE and does not reduce the count, so `plan.md`
  keeps both invocations; the round-trip saving is real and the census is not
  where it shows. Assert those two numbers. A tree that disagrees with them is a
  finding to explain in the executor report, never a number to copy into the
  test.
- **Verify:** `node --test cadence-core/bin/seam-calls.test.mjs` passes with the
  rows asserting `context.md` 5 and `plan.md` 9; adding
  a second `config.mjs get` invocation to `context.md` makes exactly that row
  FAIL with a message naming the file and the expected count, and removing it
  again makes the suite pass.

### Task 7: Close the phase gate

- **Files:** cadence-core/bin/weight-budgets.json, plus - for this task ONLY,
  because AC7 is a gate over BOTH plans and a failure it surfaces can originate
  in a file PLAN-1 owns - every file declared by PLAN-1: cadence-core/bin/lib/trace.mjs,
  cadence-core/bin/lib/read-trace.mjs, cadence-core/bin/planning.mjs,
  cadence-core/bin/self-verify.mjs, cadence-core/bin/trace.test.mjs,
  cadence-core/bin/read-trace.test.mjs, cadence-core/bin/prose-agreement.test.mjs,
  cadence-core/bin/fixtures/join.trace.jsonl, cadence-core/bin/fixtures/join.reads.jsonl,
  cadence-core/references/plan-revision.md, cadence-core/references/review-triggers.md,
  cadence-core/references/seams.md, cadence-core/workflows/context.md,
  cadence-core/workflows/decision-review.md, cadence-core/workflows/execute.md,
  cadence-core/workflows/minimalism-review.md, cadence-core/workflows/plan.md,
  cadence-core/workflows/report.md, cadence-core/workflows/verify-deep.md,
  skills/cad-executor-contract/SKILL.md. This is a REPAIR lease, not a licence to
  do PLAN-1's work: touch one of these only to close a failure the full suite or
  the linter actually reports, and state each such edit in the executor report.
  The plans are sequential and PLAN-1 has already returned when this task runs,
  so there is no concurrent writer.
- **Action:** Run the full suite and the linter and close what they report at
  the source. Re-pin every `weight-budgets.json` row whose surface changed size
  across both plans of this phase, stating the change rather than reflexively
  raising a ceiling: seven of the surfaces this phase edits sit at ZERO headroom
  (`report.md` 5,850, `new-project.md` 17,858, `adopt.md` 14,966,
  `decision-review.md` 10,993, `minimalism-review.md` 8,244,
  `references/review-triggers.md` 28,012, `progress.md` 8,749) with
  `execute.md` at 59 B and `context.md`/`plan.md` at 627 B each, and the reflex
  fix is exactly the drift this check exists to catch (D-19). Any `unknown-flag`
  or `unknown-subcommand` is fixed by adding the missing `CONTRACTS` row for the
  flag or subcommand this phase added (D-20; `.planning/CAPTURE.md:38` records
  the same failure happening to `weight.mjs --root`), never by relaxing the
  check or deleting a row.
- **Verify:** `node --test cadence-core/bin/*.test.mjs` exits 0 with zero
  failing tests, and `node cadence-core/bin/self-verify.mjs` reports no
  `unbudgeted-surface`, no `budget-overrun`, no `unknown-flag` and no
  config-key failure.

## Notes

- **Deviation from the CONTEXT `Plan shape` directive, stated rather than
  silent.** The directive asks for multiple plans across "five independent fix
  sites", but the sites share files: this plan and PLAN-1 both touch
  `cadence-core/bin/planning.mjs`, `cadence-core/bin/self-verify.mjs`,
  `cadence-core/workflows/context.md`, `cadence-core/workflows/plan.md` and
  `cadence-core/bin/weight-budgets.json`. The phase is split for CAPACITY (14
  tasks against an 8-task-per-plan ceiling) into two SEQUENTIAL plans that share
  declared files, never into parallel slices. `/cad-execute` must run PLAN-1
  first: task 6's census counts calls PLAN-1 task 2 rewrites.
- **Expected finding on this repo's own roadmap, not a defect.** Measured
  2026-08-14, `.planning/ROADMAP.md` declares 4 / 6 / 4 / 5 / 6 criteria for
  phases 1-5 and none for phase 6, so a run of task 2's seam over this repo
  reports phases 2 and 5 out of the 2-5 roadmap range and phase 6 as not-found.
  That is the seam working. Do not "fix" the roadmap to make the seam quiet, and
  do not weaken the ceilings to match it - both would be editing shipped
  planning docs to satisfy a report.
- `tsconfig.ci.json` typechecks every non-test file, so `tsc -p
  tsconfig.ci.json` is the CI companion to task 7's two commands. AC7 names only
  those two, so it is the gate; the typecheck is the thing that will break CI
  next if a new envelope is shaped past what `@ts-check` accepts.
