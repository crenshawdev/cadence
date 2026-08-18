---
phase: 5
plan: 1
requirements:
  - MSR-04
files:
  - cadence-core/bin/lib/trace.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/lib/trace-suggest.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/workflows/report.md
  - cadence-core/bin/weight-budgets.json
  - .planning/DOCS-CLAIMS.md
---

# Phase 5: The retune says what to change - Plan 1 (MSR-04, the coordinator figure is one run's)

## Goal

The coordinator residue stops pairing one run's last marker with a different
run's last event, so the figure `/cad-report` and `/cad-suggest` print is the
coordinator time it claims to be - and every shipped surface that describes it
says it spans a RUN rather than a phase. The name "coordinator time" does not
change; the arithmetic under it does.

## Must be true when done

- In a `trace render`, no marker's window ends at an event carrying a different
  `corr` than the marker that opened it.
- On this repository's own record, `trace render --phase 2` reports a
  `coordinator.residue_ms` different from the one the same command reports at
  the pre-change SHA, and its largest `steps[]` window is a different span.
- Every shipped surface describing the residue says it is one run's, never a
  phase's: `cadence-core/workflows/report.md`'s residue rules, R6's comment in
  `cadence-core/bin/lib/trace-suggest.mjs`, and the `trace render` usage header
  in `cadence-core/bin/planning.mjs`.
- The words "coordinator time" and the `coordinator` envelope key are unchanged
  everywhere, and `coordinator.wall_ms` / `bracket_ms` / `residue_ms` /
  `steps[]` keep their names and shapes.
- `.planning/DOCS-CLAIMS.md` rows REPORT-13, REPORT-14 and REPORT-15 point at
  the lines that actually carry those sentences and state the claim the prose
  now makes.
- A check carrying a `WATCHED FAILING AT <sha>` header exits non-zero when run
  against the SHA it names and exits 0 on this tree.
- `node --test cadence-core/bin/*.test.mjs` and
  `node cadence-core/bin/self-verify.mjs` both exit 0, with
  `cadence-core/workflows/report.md` re-pinned in
  `cadence-core/bin/weight-budgets.json`.

## Context

- D-01 locks the change: the residue accumulators key on `corr`, not phase, so
  each run's last marker closes at its OWN run's last event. This REFUTES the
  roadmap's stated cause - the figure is wrong, not unattributable.
- D-02 keeps the name "coordinator time". D-03 leaves
  `MIN_RESIDUE_MS_FOR_COORDINATOR_INFO` untouched and introduces no length
  threshold. D-04 keeps `.planning/reads.jsonl` out of it entirely.
- D-17 requires ONE computation site and its three shipped readers moving in the
  SAME commit. D-19 requires every pin and claim row to travel with its edit.
- Out: any new capture mechanism for a user-turn boundary, any cutoff constant,
  any rename of the quantity.

## Tasks

### Task 1: The residue is scoped to one run, and every surface that describes it says so

- **Files:** `cadence-core/bin/lib/trace.mjs`, `cadence-core/bin/trace.test.mjs`,
  `cadence-core/bin/lib/trace-suggest.mjs`, `cadence-core/bin/planning.mjs`,
  `cadence-core/workflows/report.md`, `cadence-core/bin/weight-budgets.json`,
  `.planning/DOCS-CLAIMS.md`
- **Action:** In `renderTrace`, re-key the coordinator accumulators - the `coord`
  Map and its `coordRow` helper - on the event's `corr` rather than on
  `key(e.phase)`, at all three sites that touch them: the end-of-record `last`
  update that runs over every family, the `COORDINATOR` marker collection, and
  the `spans.push` inside the paired-bracket arm. The comment block above `coord`
  states the OPPOSITE choice today and its reason; rewrite it to state D-01's
  reason instead, including the measurement that refuted it (phase "2" holds 9
  distinct `corr` ids spanning 2026-08-08 to 2026-08-17, and the 4,677-minute
  `commit` window was opened by a run whose own last event is 25 seconds later),
  and keep the sentence saying why the residue is computed once. Because the
  accumulator key is no longer a phase, the `phase` each `steps[]` row reports
  must come from the marker's own event rather than from the row - do not drop
  the field and do not change the row's key set, since `workflows/report.md` and
  R6 both read it. `mergeSpans` and the clip-and-subtract arithmetic inside a
  window are unchanged; what changes is which markers and which brackets land in
  one row and where the LAST marker's window ends. SETTLED HERE under CONTEXT's
  third flagged assumption: a marker whose `corr` has no later event at all gets
  NO fallback end - its window is zero-length and contributes zero, because the
  record holds no evidence the coordinator kept working after its own last act,
  and inventing an end is the class of guess D-01 exists to remove. An event
  carrying no `corr` at all groups under whatever `key()` yields for it, exactly
  as the existing worker key already handles that case; do not add a second
  rule for it. Then move the three readers D-17 names, in this same commit:
  `workflows/report.md`'s residue rules (the `Record health:` line's residue
  clause and the two residue bullets) must say the figure spans one RUN, joined
  on `corr`, and must keep saying it is TIME between worker brackets and never
  tokens - this file already carries the neighbouring warning that a
  phase-scoped render pools several cycles, so state the residue as the
  exception to it rather than restating the warning; R6's comment block in
  `lib/trace-suggest.mjs` must say the residue it relays is corr-scoped, while
  its `evidence` STRING and its `action: null` stay byte-for-byte as they are
  (D-02 keeps the name and the committed fixture's `deepEqual` must not move);
  and the `trace render` usage header in `planning.mjs` must stop implying the
  residue spans a phase. The `trace render` envelope in `planning.mjs` is a
  pass-through of `r.coordinator` and is expected to need no change - it is
  leased so a same-commit correction there is not blocked at the lease, not as
  an invitation to edit it. Update the shipped test named "coordinator: one
  phase spanning two corr ids is still ONE coordinator stream" in
  `trace.test.mjs`: its assertion and its comment both state the rule D-01
  reverses, so the test's NAME, its comment and its arithmetic all change
  together. Carry the arithmetic in the comment the way phase 2's D-12 re-pin
  did - state what the figure was, what it is now and which pairing rule moved
  it - rather than editing the number until it agrees. The other coordinator
  tests in that file (overlap subtracted once, unpaired dispatch subtracts
  nothing, unparseable `ts`, no marker means no block) are single-run fixtures
  and must keep passing unedited; if one of them moves, that is a signal the
  change reached further than the pairing rule. Finally re-pin
  `cadence-core/workflows/report.md` in `cadence-core/bin/weight-budgets.json`
  and move `.planning/DOCS-CLAIMS.md` rows REPORT-13, REPORT-14 and REPORT-15 -
  REPORT-13's anchor is ALREADY stale (it cites `report.md` 67-69, whose bytes
  are the no-`cat` transport rule) so it is re-anchored rather than merely
  shifted, and each row's claim text must state what the prose now claims.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` and
  `node --test cadence-core/bin/trace-suggest.test.mjs` both exit 0. Against a
  scratch `.planning` holding ONE phase with two runs - a marker and a bracket
  under corr A, then hours of clock, then a `phase_start` with a new sha and its
  events under corr B - `node cadence-core/bin/planning.mjs --dir <scratch>
  trace render --phase 1` reports corr A's last marker window ending at corr A's
  own last event: its `residue_ms` equals the within-A gap and does NOT include
  the hours before B's first event. On this repository,
  `node cadence-core/bin/planning.mjs trace render --phase 2` reports a
  `coordinator.residue_ms` and a largest `steps[]` `residue_ms` that both differ
  from the figures the UNPATCHED code produces over the SAME record. Capture the
  before/after against one record rather than one worktree: `.planning/trace.jsonl`
  is gitignored (`.gitignore:29`) and untracked, so a `git worktree add --detach`
  checkout carries no trace at all and `trace render` there reports nothing to
  compare. Run the before figures first - `git stash` the working change, or copy
  the live `.planning/trace.jsonl` into a scratch `--dir` and run the predecessor
  commit's `planning.mjs` against that same copied record - and record both
  numbers in the task's commit message. `grep -n "residue" cadence-core/workflows/report.md`
  returns no sentence describing the figure as a phase's span, and
  `grep -c "coordinator time" cadence-core/bin/lib/trace-suggest.mjs` is
  unchanged from before this task. The `cadence-core/workflows/report.md` value
  in `cadence-core/bin/weight-budgets.json` equals
  `wc -c < cadence-core/workflows/report.md`. Each of REPORT-13/14/15 names a
  line range in `.planning/DOCS-CLAIMS.md` whose bytes in
  `cadence-core/workflows/report.md` contain that row's claim, checked by
  reading those exact lines. `node cadence-core/bin/self-verify.mjs` exits 0.

### Task 2: The MSR-04 falsifier, watched failing at a named SHA

- **Files:** `cadence-core/bin/trace.test.mjs`
- **Action:** Add one test to `trace.test.mjs` that fails against the unpatched
  tree and passes here: build a trace where a single phase holds two runs and the
  first run's LAST marker is followed, after a long gap, by the second run's
  events, then assert the property AC5 pins rather than a figure - that every
  `steps[]` window closes inside the `corr` of the marker that opened it, so the
  first run's last window contributes only its own run's gap. Assert the
  invariant, not the 324-minute simulation: the record grows while this phase
  runs and no figure is stored. Reuse the file's existing `at`, `mark` and
  `bracket` helpers and the exported `COORDINATOR` / `ANCHOR` / `DISPATCH`
  constants rather than writing new ones. Carry the header comment in the shape
  the falsifiers already in this tree use (`trace.test.mjs`'s MSR-01 falsifier,
  `window-budget.test.mjs`, `prose-agreement.test.mjs`): `WATCHED FAILING AT
  <sha>` naming the tip of the unpatched tree - use the commit immediately
  preceding this plan's first implementation commit, which is task 1's - the
  observed unpatched output quoted verbatim, and the re-watch recipe
  (`git worktree add --detach <tmp> <sha>`, copy this file into that checkout's
  `cadence-core/bin/`, `node --test cadence-core/bin/trace.test.mjs` there,
  `git worktree remove <tmp>`). Write the header's SHA from what git reports at
  execution time, never from a SHA typed into this plan.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` exits 0 on this tree.
  Following the header's own re-watch recipe against the SHA the header names,
  the same command exits NON-ZERO with this test failing, and the header quotes
  that observed output. The SHA is read by EXTRACTING it from the
  `WATCHED FAILING AT` line, not by counting occurrences of the phrase, and
  `git cat-file -t <extracted sha>` returns `commit` for a commit that precedes
  task 1's commit in `git log`.

## Notes

- The phase-level `## AC7: watched failures` record belongs in `SUMMARY.md`,
  which the executor contract's `<never>` list forbids an executor writing -
  phase 4 planned that as a task and it halted at a checkpoint. It is the
  orchestrator's to append after both falsifier tasks land, quoting the SHAs
  extracted from the two headers.
- CONTEXT's third flagged assumption (a marker whose `corr` has no later event)
  is settled in task 1's Action: no fallback, the window contributes zero.
- `cadence-core/bin/planning.mjs` is leased for the `trace render` usage header
  at the top of the file and for D-17's pass-through envelope; PLAN-2 rewrites
  the `sub === 'suggest'` arm of the same file, so these two plans are
  SEQUENTIAL and must not be run in parallel.
