---
phase: 2
plan: 1
requirements:
  - RSK-11
files:
  - cadence-core/bin/planning-task-record.test.mjs
  - cadence-core/workflows/task.md
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/weight-budgets.json
---

# Phase 2: A treeless task can finish honestly - Plan

## Goal

`GH-246`. `cadence-core/workflows/task.md` states ONE rule for reporting done
when a run's record cannot reach the trace, and an inline `/cad-task` on a
repository with no `.planning/` completes under it: the risk check genuinely
runs, its disposition is stated in the done block, the receipt is called
unrecorded because there is no planning root, and the run creates no
`.planning/` and no `tasks/<slug>/`.

## Must be true when done

- `task.md` states the completion rule once, in the `risk_check` step: a
  `written: false` whose reason is the absent planning root (`ENOENT` from the
  trace seams, "no planning root" from `task-record`) reports done with the
  check's disposition stated; a `written: false` for any other reason withholds
  done. The skip arm, the `record` step and the `done` step point at that rule
  rather than restating it, and no `[ -d .planning ]` check stands beside it.
- A `prose-agreement.test.mjs` pin goes red when either half of the rule is
  deleted from `task.md`, and a second pin goes red when the
  `surfaces-unanswered` arm (ask the one-time question, re-run with
  `--surfaces`) is deleted from the `risk_check` step.
- A seam test on `taskRepo(commits, {planning:false})` shows `trace append`,
  `trace close`, `task-record` and `risk-check run` each answering `ok:true`
  with `written:false` and the absent-root reason, the bare `risk-check run`
  refusing `surfaces-unanswered` while the `--surfaces` re-run reaches a
  verdict, and no `.planning/` existing afterwards.
- An inline `/cad-task` on a scratch repo with no `.planning/` completes; its
  done block carries a line naming the risk check's verdict and that its record
  is unrecorded because there is no planning root, and no `Record:` line
  (human-verify: needs a live `/cad-task` session).
- After that run, `ls -a` on the scratch repo shows no `.planning/` and no
  `tasks/<slug>/` (human-verify: needs a live `/cad-task` session).
- `node cadence-core/bin/test.mjs`, `npx tsc -p tsconfig.ci.json` and
  `node cadence-core/bin/self-verify.mjs` pass, and `weight-budgets.json`'s
  `cadence-core/workflows/task.md` row is at or above the file's measured size.
- `GH-246` has a REQUIREMENTS row, `RSK-11`, pointing at Phase 2, and the
  Phase 2 ROADMAP entry names it.

## Context

- CONTEXT D-01/D-02 are locked: the treeless run finishes; done is reported on
  `written:false` ONLY when the envelope's own `reason` is the absent planning
  root, told apart on that reason and never on a directory check. D-03: the
  `surfaces-unanswered` refusal is answered in the run and the seam is re-run
  with `--surfaces`; on a treeless repo nothing is persisted. D-04: three sites
  in `task.md` state the rule today (the skip arm, the `risk_check` rule, the
  `record` step's seam sentence); the rule lives once and the others point at
  it. D-05: the done line reuses the envelope's words - `checked:false` plus its
  cause, `checked:true, empty:true`, `matches` / `inconclusive:true`, the
  `risk_check_skipped` event, and `trace:{written:false, reason}` rendered as
  "unrecorded". D-06: the done block gains that one line. D-07: no
  `risk-check status` call is added. D-09: the pin at
  `prose-agreement.test.mjs` "ENFORCEMENT, task.md: done is withheld on
  `written: false`" is rewritten with the rule, never weakened; the five pins it
  names stay green untouched. D-10: `weight-budgets.json`'s `task.md` row is
  17348 against a measured 17348 bytes - every task that grows `task.md`
  re-pins the row in the same commit. D-11: the seam test extends the existing
  `taskRepo` / `runIn` fixture, no second fixture. D-12: `RSK-11` was minted
  at `/cad-plan`, before `seed-reqs` seeded its Traceability row; no task
  touches REQUIREMENTS.md or ROADMAP.md.
- Flagged assumption, confirmed: `lib/trace.mjs` `tracePath` is
  `join(planningRoot, TRACE_FILE)` with no intermediate directory, and
  `appendEvent` swallows the stat `ENOENT` (ordinary first write), so the only
  `ENOENT` an append can return is `appendFileSync`'s - the planning root
  itself is absent. A "trace parent removed on an adopted repo" IS an absent
  planning root; there is no third reading, and `task-record` names the same
  condition in words. Measured 2026-09-02 on a scratch repo: `trace append`
  (`phase_start`, `dispatch`, `risk_check_skipped`), `trace close` and
  `risk-check run --surfaces auth` all answer `written:false, reason:"ENOENT"`;
  `task-record` answers `written:false, reason:"no planning root at .planning,
  and this command creates neither it nor tasks/"`; the bare `risk-check run`
  answers `ok:false, reason:"surfaces-unanswered"`; nothing is created.
- Out of scope, do not touch: `planned_path`'s refusal to scaffold, the inline
  path's `risk_surface` settle (D-08), any seam module (`task-record.mjs`,
  `risk-check.mjs`, `lib/trace.mjs`), persisting a surfaces answer on a
  treeless repo, and the `risk-surface.md` vs `review-record.md` disagreement
  CONTEXT defers.

## Tasks

### Task 1: Seam test - every seam a treeless task calls answers written:false with the absent-root reason and creates nothing

- **Files:** cadence-core/bin/planning-task-record.test.mjs (`taskRepo`, `runIn`, the treeless row "no planning root means nothing is created")
- **Action:** Add one test row beside the existing treeless row, built on
  `taskRepo(TASK_COMMITS, { planning: false })` and `runIn` - no second fixture
  (D-11). The row runs, in the order `task.md` runs them and with the `--dir`
  argument `runIn` already appends: `trace append --phase 0 --family lifecycle
  --event phase_start --sha <shas[0]-token>`; `trace append --phase 0 --family
  lifecycle --event dispatch --plan <slug> --role cad-task --read-file <a file
  written inside the fixture root>`; `trace append --phase 0 --family outcome
  --event risk_check_skipped --plan <slug> --sha <shas[0]>`; `risk-check run
  --phase 0 --base <shas[0]> --head HEAD` bare; the same call with `--surfaces
  auth`; `task-record --slug <slug> --base <shas[0]> --head HEAD --text <text>`;
  and `trace close --phase 0 --plan <slug> --role cad-task --agent-id <id>`.
  It asserts: each `trace append` and the `trace close` answer `ok:true,
  written:false, reason:'ENOENT'` (the trace seams' spelling of the absent
  root - `lib/trace.mjs` `tracePath` puts `trace.jsonl` directly under the
  root, so nothing else raises it); the bare `risk-check run` answers `ok:false,
  reason:'surfaces-unanswered'`; the `--surfaces auth` re-run answers `ok:true,
  checked:true` with `trace.written === false` and `trace.reason === 'ENOENT'`;
  `task-record` answers `ok:true, written:false` with a `reason` matching
  `/no planning root/`; and afterwards `existsSync(dir)` is false and
  `existsSync(join(root, 'tasks'))` is false. The bare call's refusal must be
  the seam's and not the developer's machine's: run every call in this row with
  `CADENCE_GLOBAL_CONFIG` pointed at a path under the fixture root that does not
  exist, the way `git-branch.test.mjs` does with its `NO_GLOBAL` - extend `runIn`
  with an optional trailing env-overrides argument (defaulting to nothing, so
  `planning-recall.test.mjs`'s import is untouched) rather than copying the
  spawn. Assert the reasons by exact string on the trace side and by the
  `/no planning root/` match on the record side, because those two spellings are
  what `task.md`'s rule (task 2) names as the discriminator; a looser assertion
  would let the rule rest on words the seam does not emit. Do not edit any seam
  module.
- **Verify:** `node cadence-core/bin/planning-task-record.test.mjs` passes with
  the new row listed; temporarily changing the `'ENOENT'` expectation or the
  `/no planning root/` match to any other string makes exactly that row fail;
  restored, `node cadence-core/bin/test.mjs planning` passes.

### Task 2: task.md states the completion rule once and its three sites point at it, with the pin rewritten

- **Files:** cadence-core/workflows/task.md (`risk_check` step, the skip arm paragraph and the `written: true` paragraph; `record` step, last paragraph), cadence-core/bin/prose-agreement.test.mjs (test "ENFORCEMENT, task.md: done is withheld on `written: false`"), cadence-core/bin/weight-budgets.json (`cadence-core/workflows/task.md` row)
- **Action:** In the `risk_check` step of `task.md`, replace the paragraph that
  begins "Done is reported only on an `ok:true` run whose record actually
  REACHED the trace" (the one ending "say the check is unrecorded rather than
  reporting done on it") with the ONE completion rule, stated in two halves the
  pin can hold separately. Half one: on `ok:true`, done is reported when the
  record reached the trace (`written: true`), AND on a `written: false` whose
  `reason` is the absent planning root - the trace seams spell it `ENOENT`
  (`trace.jsonl` sits directly under `.planning/`, so nothing else raises it)
  and `task-record` spells it "no planning root" - in which case the run
  reports done with the check's disposition stated and the record called
  unrecorded, because git is the code record and the only thing a treeless run
  cannot deliver is the durable Cadence receipt. Half two: a `written: false`
  for ANY OTHER reason - `symlinked-trace`, a failed stat, `EACCES` or `ENOSPC`
  on the append, `oversized-event`, a rotation that failed, an unwritable or
  symlinked `tasks/{slug}/` - does not report done: state the reason and re-run
  once a record can land. Spell half two's discriminator with the literal words
  "any other reason", because the pin and this task's Verify read that phrase
  and it must occur once in the file. Keep the existing sentence that this path has no
  `risk-check status` call and the flag is its whole guard (D-07), and say the
  two cases are told apart on the envelope's own `reason`, never on a
  `[ -d .planning ]` check beside the seam (D-02; the `scope` step already
  states why two ways of asking drift). Delete the old closing sentence's
  "create it, or say the check is unrecorded" - creating `.planning/` is the
  scaffolding the success criterion forbids. Then make the other two sites
  POINT at this rule instead of restating it: in the skip-arm paragraph, keep
  "Done is reported on that append's" but replace "`written: true` under the
  same rule as below" with a pointer to the completion rule below that says the
  skip append's `written: false` with the absent-root reason takes the same
  reporting arm; in the `record` step's last paragraph, keep the seam's
  behaviour sentence ("creates NOTHING where `.planning/` is absent ... answers
  `written: false` with a reason") and add that this is the absent-root reason
  the `risk_check` step's completion rule reports done on, so the inline task
  scaffolds nothing AND still finishes. The `done` step's paragraph after the
  report block already says "This is the same discipline the `risk_check` step
  applies to its own flag" - leave it for task 4. Rewrite the pin
  "ENFORCEMENT, task.md: done is withheld on `written: false`" in
  `prose-agreement.test.mjs` (the one currently requiring a negation between
  `` `written: false` `` and "report done" in one sentence) so it reads the
  `risk_check` step through the existing `stepBody(doc(...TASK_WF),
  'risk_check', ...)` helper and asserts BOTH halves as two separate
  `assert.match` calls with their own failure messages: one sentence carrying
  `` `written: false` ``, the absent-root spelling (`ENOENT` and "no planning
  root" both), and "report(s) done" with no negation between them; and one
  sentence carrying `` `written: false` ``, "any other" reason, and a negated
  "report done" (do not / does not / never / withhold). Add a third assertion
  that the whole file states the discriminator once by asserting the `record`
  step body and the skip paragraph each name the rule (a pointer phrase the
  executor chooses and pins by the same string in both places) and neither
  carries its own "report done" verdict on `written: false`. Keep every other
  pin D-09 lists green untouched: the transient `.diff` rails, `risk-check run
  --phase 0`, the "Too big" arm and its `no-planning-dir` slice, the step order
  with one `git_guard`, and the `risk_check_skipped` append that
  `SKIP_SITES`/`sentenceAround` read from the `risk_check` step with the
  condition "landed no commits" and the end `` `$S` `` in one sentence - the
  skip paragraph's first sentences stay as they are. `task.md` grows: measure
  it with `wc -c cadence-core/workflows/task.md` and set the
  `cadence-core/workflows/task.md` row in `weight-budgets.json` to that number
  in this same commit (D-10). Do not buy room by cutting any pinned rail.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` passes;
  with the half-one sentence deleted from `task.md` (working tree only, then
  restored) the rewritten pin fails on its own message, and the same with the
  half-two sentence deleted; `grep -n 'any other reason' cadence-core/workflows/task.md`
  prints exactly one line and it lies between `<step name="risk_check">` and
  that step's `</step>` (the withholding half is stated once; the `scope`
  step's "any other `ok:false`" is a different phrase and does not match); `grep -n '\[ -d .planning \]' cadence-core/workflows/task.md`
  prints two lines, the existing `scope`-step prohibition and the rule's own
  "never on" sentence, and no third; `node cadence-core/bin/self-verify.mjs`
  reports no `budget-overrun` for `cadence-core/workflows/task.md`.

### Task 3: task.md's risk_check step answers surfaces-unanswered in the run and re-runs with --surfaces, pinned

- **Files:** cadence-core/workflows/task.md (`risk_check` step, directly after the `risk-check run --phase 0` command block and its `--phase 0` paragraph), cadence-core/bin/prose-agreement.test.mjs, cadence-core/bin/weight-budgets.json (`cadence-core/workflows/task.md` row)
- **Action:** Add the arm D-03 locks, as one paragraph placed after the
  "`--phase 0` because a task sits outside the phase spine" paragraph and
  before "A non-empty `matches` OR `inconclusive: true` fires": when
  `risk-check run` answers `ok:false` with reason `surfaces-unanswered`, that is
  not a verdict and not a skip - the seam is refusing to scan on the all-eight
  set nobody chose. Run `detect-surfaces --root .` and put the one-time
  surface question exactly as `references/risk-surface.md` states it (the
  envelope's `options` rendered in the order they arrive, the eight-line legend
  beside them, the ask-user seam), then re-run the same `risk-check run
  --phase 0` line with `--surfaces <the chosen set, comma-separated>` and
  carry on from its envelope. Persisting the answer is what that reference's
  `config.mjs set` line already does and is not restated here; but there is no
  repo layer to persist into when the run's own `bracket` append answered the
  absent-root reason - `config.mjs set` writes `.planning/config.json` and
  creating it is the scaffolding the success criterion forbids - so on a
  treeless repo the answer rides `--surfaces` for this run alone and the
  question is asked per run (D-03). Name the seam's own reason string
  `surfaces-unanswered` and the flag `--surfaces` literally, because the pin
  reads them. Add a pin in `prose-agreement.test.mjs`, beside the rewritten
  ENFORCEMENT pin, that reads the `risk_check` step through `stepBody` and
  asserts (a) the step names `surfaces-unanswered`, (b) the sentence around it
  (`sentenceAround`) names `detect-surfaces` and the ask, and (c) the step
  carries a `risk-check run` line or sentence naming `--surfaces` as the
  re-run - each with a failure message saying what a coordinator does without
  it (stops at the refusal, so the blocking gate never runs for the fresh
  user the inline arm exists for). Do not add a `risk-check status` call
  (D-07). Keep `SKIP_SITES`' read of the step green: the new paragraph must not
  contain the string "landed no commits". Re-measure `task.md` with `wc -c`
  and set its `weight-budgets.json` row to the new size in this commit (D-10).
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` passes;
  with the new paragraph deleted from `task.md` (working tree only, then
  restored) the new pin fails on its own message;
  `grep -n 'surfaces-unanswered' cadence-core/workflows/task.md` prints one line
  inside the `risk_check` step and `grep -c -- '--surfaces' cadence-core/workflows/task.md`
  is at least 1; `grep -c 'risk-check status' cadence-core/workflows/task.md`
  is unchanged from before the task; `node cadence-core/bin/self-verify.mjs`
  reports no `budget-overrun` for `cadence-core/workflows/task.md`.

### Task 4: task.md's done block names the risk check's disposition and calls an unlanded record unrecorded

- **Files:** cadence-core/workflows/task.md (`done` step, the `Report:` block and the paragraph after it), cadence-core/bin/weight-budgets.json (`cadence-core/workflows/task.md` row)
- **Action:** Add one line to the four-line `Report:` block in the `done`
  step, between `Files:` and `Record:`, that names the risk check's
  disposition in the envelope's own words and nothing minted (D-05): the
  `risk_check_skipped` event when nothing landed; `checked: false` plus the
  row's cause when the range could not be read; `checked: true, empty: true`
  when the range was read and held nothing; the `matches` list or
  `inconclusive: true` and the review's outcome when the trigger fired; and,
  after that verdict, whether the record landed - `trace: {written: true}`
  rendered as recorded, `trace: {written: false, reason}` rendered as
  "unrecorded" with the reason in words (the absent planning root when the
  reason is `ENOENT`). Rewrite the paragraph after the block so it covers
  both lines: `Record:` still rides only a `task-record` envelope that said
  `written: true`, and on `written: false` the line is dropped and the
  envelope's reason stated in its place, as now; the new disposition line is
  never dropped, because a verdict that ran is reported whether or not its
  receipt landed, and its "unrecorded" is what tells a treeless run's done
  block apart from an adopted one's. Keep the pointer sentence to the
  `risk_check` step's completion rule (the rule task 2 wrote decides whether
  this block is reached at all; this step only renders). Preserve the one
  `trace close` line and its `--role cad-task` unchanged - `trace.test.mjs`'s
  `COORDINATOR_BILLED_CLOSE` and `BRACKETING` pins read them. Keep "No
  next-step menu." Re-measure `task.md` with `wc -c` and set its
  `weight-budgets.json` row to the new size in this commit (D-10).
- **Verify:** `sed -n '/<step name="done">/,/<\/step>/p' cadence-core/workflows/task.md`
  shows a report block of five lines whose new line names `risk_check_skipped`,
  `checked: false`, `checked: true, empty: true`, `matches`, `inconclusive` and
  "unrecorded" between `Files:` and `Record:`; `grep -c 'trace close' cadence-core/workflows/task.md`
  is 1; `node cadence-core/bin/test.mjs` passes in full, `npx tsc -p tsconfig.ci.json`
  exits 0, and `node cadence-core/bin/self-verify.mjs` passes with the
  `cadence-core/workflows/task.md` budget row equal to
  `wc -c cadence-core/workflows/task.md`.

## Notes

- Plan shape honoured: one plan, as CONTEXT directs. Tasks 2, 3 and 4 all edit
  `task.md` and `weight-budgets.json`, so they are sequential; each re-pins the
  budget row in its own commit so no intermediate commit is red on
  `self-verify` (D-10).
- AC3 and AC4 are human-verify: they need a live inline `/cad-task` on a
  scratch repository with no `.planning/`, with no global surfaces answer so
  the `surfaces-unanswered` arm is exercised. Observe the done block's
  disposition line, no `Record:` line, and `ls -a` showing no `.planning/` and
  no `tasks/<slug>/`. The seam test (task 1) is the mechanical half of the same
  claim.
- Recalled prior art applied: the phase 1 UAT finding that
  `risk_check_skipped` was prose-only until `bc2f9212` is why task 1 exercises
  the skip append on the treeless fixture rather than trusting the prose; the
  v3.6.0 UAT observation that a `/cad-task` done block prints a `Record:` line
  is what task 4 preserves for the adopted case and drops for the treeless one.
- Plan review (openai, adjudicated): the original task 1 minted `RSK-11` at
  execute time, after this plan's own `seed-reqs` had run, so the id would have
  seeded nothing. It was dropped and the minting done at plan time instead -
  the `RSK-11` bullet, the overview sentence, the Phase 2 `**Requirements:**`
  line and OQ-2's answer (D-01) all landed in the plan commit, as phase 1's
  `d2118500` did for its ids and OQ-1. The survivor on the D-06 disposition
  line's check (a `sed -n` inspection, nothing fails when the line is absent)
  was recorded and not applied.
- No pin is added for the D-06 disposition line: AC3 verifies it live and the
  decision names no pin. If the human wants it held by a test, that is one
  extra `assert.match` on the `done` step body, not a scope change.
- `config.mjs set` refuses `reason:"read"` on any missing `.planning/config.json`,
  adopted or not (measured 2026-09-02); its `--create` arm is not reachable
  from the flag spelling `risk-surface.md` shows. Outside this phase; captured
  here so the coordinator can file it.
