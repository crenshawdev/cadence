---
phase: 4
plan: 3
requirements:
  - PLN-01
files:
  - design-notes/dd-plan-task-ceiling.md
  - cadence-core/config.schema.json
  - cadence-core/references/config-catalog.md
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/weight-budgets.json
  - .planning/phases/4/SUMMARY.md
---

# Phase 4: Costs argued from the new record - Plan 3 (PLN-01, the ceiling re-decided against both forces)

## Goal

`workflow.max_plan_tasks` stops being a number set against one of its two
forces: it carries a written decision naming cold-prefix cost AND context risk,
with the measured figure behind each and the value it lands on, on surfaces a
check already binds rather than in a phase SUMMARY a milestone close deletes.

## Must be true when done

- Both forces are named with a measured figure behind each, in shipped prose: the
  `checkpoint` count from `.planning/trace.jsonl` for context risk, and the
  per-role `dispatchBytes` from `weight.mjs resident` for cold-prefix cost.
- The decision states the value it lands on and why, and the schema `default`,
  the catalog row's Default column and the value the prose argues all agree.
- The cold-prefix argument says what the REST of a dispatch's window is rather
  than resting on the prefix alone, because the prefix is about 2% of a measured
  executor dispatch.
- The decision survives a milestone close: it lives on the schema `purpose` and
  the `config-catalog.md` row - both bound by checks - with the dated arithmetic
  in tracked `design-notes/`, and nowhere that `milestone-prune` removes.
- Nothing in the seam changes: `planning.mjs plan-size` still takes the ceiling
  as the caller's resolved number and still reads no config for it.
- Each of MSR-03, TRN-02 and PLN-01 has a falsifier carrying a `WATCHED FAILING
  AT <sha>` header, the phase SUMMARY records all three, and the audit EXTRACTS
  each SHA per line rather than counting occurrences.

## Context

CONTEXT D-16 makes PLN-01 a written decision rather than necessarily a value
change - 8 is a legitimate landing point if the reason is stated. D-09 fixes the
cold-prefix figure as `weight.mjs resident`'s per-role `dispatchBytes` and
requires the argument to account for the rest of the window, since that term is
~2% of a dispatch. D-17 supplies the context-risk mechanism and figure - executor
checkpoint pressure, R4 in `trace suggest`. D-18 records that re-deciding changes
nothing in the seam. D-10 puts the decision on surfaces a check binds. D-12
requires any estimate to use the tree's single `chars/4` estimator and CITE it
rather than restate a ratio. D-21 requires the per-line SHA extraction the
phase-3 deviation replaced `grep -c` with.

Ordering: this plan runs LAST. Plan 1 edits `cadence-core/config.schema.json` and
Plan 2 appends to `cadence-core/bin/prose-agreement.test.mjs` before this plan
does, and task 4 here can only be written once both of their falsifier headers
exist.

## Tasks

### Task 1: The dated arithmetic, written down where a milestone close cannot reach it

- **Files:** `design-notes/dd-plan-task-ceiling.md`
- **Action:** Write the derivation this decision rests on, dated 2026-08-17, with
  the command behind every figure so a later reader can re-run it rather than
  trust it. Cold-prefix cost: `node cadence-core/bin/weight.mjs resident` reports
  `dispatchBytes` 12,488 for `agents/cad-executor.md`, 11,664 for `cad-planner`,
  11,277 for `cad-verifier` and 5,986 for `cad-assumptions-analyzer`, with
  `zeroResidentBytes` 38,492; converted with the tree's single estimator, which
  this note CITES at `cadence-core/bin/lib/surface-weight.mjs` rather than
  restating as a ratio, the executor's fixed prefix is about 3,122 estimated
  tokens - roughly 2% of the 144,752-token measured executor mean return. So the
  note must then say what the OTHER 98% is: a fresh executor's cold pass over the
  plan file and the phase's own artifacts plus its in-dispatch reading, measured
  in CONTEXT D-06 at 26-47% of the live window for the declared read-set alone on
  the three phase-3 plans, which is the term an extra plan actually re-buys.
  Context risk: `.planning/trace.jsonl` holds 20 `checkpoint` events, 14 of them
  `cad-executor`. The dispatch and return denominators are LIVE - CONTEXT D-17
  recorded 177/153 and the count had already moved to 178/155 by the time this
  plan was written - so re-count them at write time over `.planning/trace.jsonl`,
  publish the figures with the date they were taken, and say in the note that the
  denominators move while the checkpoint numerator is what the decision rests on.
  Do not copy a stale pair from D-17 or from this task. And
  `cadence-core/bin/lib/trace-suggest.mjs`'s R4 rule fires on two of them with
  `action: 'workflow.max_plan_tasks'`. Record the falsifying observation beside
  it: phase 2's plans carried 6 and 6 tasks against a ceiling of 8, so those
  checkpoints happened entirely UNDER the ceiling and the rule fired on a
  constraint that was not binding. Then state the landing - the ceiling stays 8 -
  and the reason both forces produce it: cold-prefix cost argues for fewer,
  larger plans because each additional plan re-buys a whole cold dispatch, and
  context risk argues for smaller ones because executor returns sit at a measured
  75th percentile of 185,999 tokens; 8 is where they meet, and lowering it would
  multiply the cold pass without evidence that the ceiling produced any of the 14
  executor checkpoints. Say plainly that this is a re-decision landing on the
  same number, not a change. Do not restate the estimator's ratio anywhere in the
  file, and invent no figure the named commands do not produce.
- **Verify:** `design-notes/dd-plan-task-ceiling.md` exists, is tracked by git,
  and `grep -n "12,488\|dispatchBytes\|checkpoint\|2026-08-17"` over it shows
  each force's figure, its source command and the date. Re-running `node
  cadence-core/bin/weight.mjs resident` reproduces the `dispatchBytes` figures the
  note quotes.

### Task 2: The decision lands on the two surfaces a check binds

- **Files:** `cadence-core/config.schema.json`,
  `cadence-core/references/config-catalog.md`,
  `cadence-core/bin/weight-budgets.json`
- **Action:** Extend `workflow.max_plan_tasks`'s `purpose` in
  `cadence-core/config.schema.json` and its row in
  `cadence-core/references/config-catalog.md` so both carry the decision itself
  rather than only the key's meaning: re-decided 2026-08-17 against both forces,
  the cold-prefix figure (`dispatchBytes` 12,488 for `agents/cad-executor.md`,
  about 2% of a measured executor dispatch, with the rest of the window being the
  cold pass an extra plan re-buys), the context-risk figure (20 `checkpoint`
  events, 14 of them `cad-executor`), the landing value 8, and a pointer to
  `design-notes/dd-plan-task-ceiling.md` for the arithmetic. Both surfaces must
  carry the SAME three numbers in the same spelling, because task 3's falsifier
  extracts them from each and compares them to each other. Keep the existing
  meaning of the row intact - the ceiling is PER PLAN, a phase needing more
  capacity gets more plans, and `planning.mjs plan-size` counts the written plan
  against it at `check_size` - and change no `default`: the value stays 8, so the
  schema's `"default": 8` and the catalog's Default column are both untouched. Do
  not add a `|` character inside the catalog's Purpose cell, which would split the
  row. Re-pin `config-catalog.md` in `cadence-core/bin/weight-budgets.json` from
  `node cadence-core/bin/weight.mjs` in this same commit.
- **Verify:** `node cadence-core/bin/config.mjs get workflow.max_plan_tasks`
  still returns 8. `node cadence-core/bin/self-verify.mjs` exits 0 - which is what
  proves the catalog row still parses, the reach row still agrees with the purpose
  and the re-pin is in place. `grep -n "12,488" cadence-core/config.schema.json
  cadence-core/references/config-catalog.md` returns a line from each file.

### Task 3: The PLN-01 falsifier, watched failing at a named SHA

- **Files:** `cadence-core/bin/prose-agreement.test.mjs`
- **Action:** Append one falsifier that EXTRACTS from both surfaces and compares
  the extractions to each other, never asserting that some expected phrase
  appears in each: pull the landed value, the `dispatchBytes` figure and the
  checkpoint count out of `workflow.max_plan_tasks`'s `purpose` in
  `cadence-core/config.schema.json`, pull the same three out of that key's row in
  `cadence-core/references/config-catalog.md`, and assert the three pairs agree
  and that the landed value equals the schema's own `default` and the catalog's
  Default column. A surface that carries none of them extracts null and fails,
  which is what makes this fail against the unpatched tree on an ASSERTION rather
  than on a missing file. Carry the header comment in the shape this file's WIR-01
  falsifier already uses: `WATCHED FAILING AT <sha>` naming the tip of the
  unpatched tree (`37796d0` is the tip as this plan is written; use the commit
  immediately preceding this plan's first implementation commit if it has moved),
  the observed unpatched output quoted verbatim, and the re-watch recipe (`git
  worktree add --detach <tmp> <sha>`, copy this file into that checkout's
  `cadence-core/bin/`, `node --test` it there, remove the worktree).
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` exits 0 on
  this tree. Deleting the checkpoint figure from the catalog row alone makes it
  FAIL naming the two unequal extractions (restore it afterwards). Following the
  header's own re-watch recipe against the SHA the header names, the same command
  exits NON-ZERO, and the header quotes that observed output.

### Task 4: AC6's watched-FAIL record reaches the SUMMARY

- **Files:** `.planning/phases/4/SUMMARY.md`
- **Action:** Append an `## AC6: watched failures` section carrying exactly three
  lines, one per requirement - `MSR-03`, `TRN-02`, `PLN-01` - each naming the test
  file holding that requirement's falsifier, the SHA its `WATCHED FAILING AT
  <sha>` header names, and the command that re-watches it. Quote each SHA from
  the header as it stands at execution time rather than from this plan: `37796d0`
  is the tip as the plans are written, and each header is instructed to use the
  commit immediately preceding its own plan's first implementation commit, so the
  three may differ from each other and from this sentence. APPEND to whatever
  `/cad-execute` has already written to this file - the executor owns the
  SUMMARY's commit manifest and task record, this task owns one additional
  section, and neither rewrites the other. Run this task LAST in the phase: two of
  the three headers are written by Plans 1 and 2 and do not exist to be quoted
  before those plans execute.
- **Verify:** `.planning/phases/4/SUMMARY.md` contains an `## AC6: watched
  failures` heading followed by three lines naming `MSR-03`, `TRN-02` and
  `PLN-01`. For each line, the SHA it quotes matches the `WATCHED FAILING AT`
  header in the test file that same line names - proved by EXTRACTING the SHA from
  the line and the SHA from that file's header and comparing the two, per
  requirement, never by counting occurrences of the phrase.

## Notes

- The landing value is settled here rather than left open: 8 stands. D-16 makes
  that a legitimate outcome when the reason is stated, and the reason is the
  falsifying observation in task 1 - phase 2's checkpoints fired at 6 tasks
  against a ceiling of 8, so the ceiling was not the binding constraint that
  produced them, and lowering it would buy an extra cold dispatch per plan against
  no evidence.
- This plan writes no `.planning/ROADMAP.md` correction. CONTEXT's last flagged
  assumption records that the ROADMAP's phase-4 phrase "fails self-verify on a
  crossing in either direction" is falsified by D-11, and puts that line outside
  this workflow's write set.
