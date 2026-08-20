---
phase: 3
plan: 1
requirements:        # none seeded for v3.5.6 - planned against CONTEXT.md AC1-AC7, see Notes
files:
  - cadence-core/bin/lib/risk-diff.mjs
  - cadence-core/bin/lib/report-rotation.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/risk-diff.test.mjs
  - cadence-core/bin/report-rotation.test.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/helper-census.test.mjs
---

# Phase 3: The machinery that still assumes one report - Plan

## Goal

The two seams that still assume the pre-rotation shape stop misreporting: the
risk gate tells an EMPTY committed range from an unjudged one instead of
deadlocking on it, and `lease-check` exempts the rotated report phase 1 made
real without exempting anything else in that directory.

## Must be true when done

- `risk-check run` over a range whose DIFF BODY is empty answers a completed
  check that matched nothing - `checked: true`, `inconclusive: false`,
  `matches: []` - and its record carries a positive field saying the range was
  empty, whether or not `base_id` equals `head_id`.
- A range whose diff could not be READ still answers `checked: false,
  inconclusive: true`, and a range that contains commits but cannot be judged
  (binary-only, gitlink) still answers `inconclusive: true` and still fires.
- `risk-check status` over an empty-range record returns `ok: true` with that
  row's state `recorded`, while a record written under the pre-fix shape - no
  empty field, `checked: false` - still refuses `risk-record-missing`.
- `/cad-execute <N> --rerun` against a phase whose tasks are all already
  satisfied runs to completion with no user override of a blocking gate.
- `lease-check` returns `ok: true` when a task commit stages
  `plan-<k>.<n>.md` beside `plan-<k>.md` for plan `k`, and still reports
  `undeclared-files` for `plan-<k>-risk.diff`, `plan-<k>-risk-task-<n>.diff`,
  another plan's report, `plan-11.md` under plan 1, and `PLAN-1.1.MD`.
- The rotated-report name grammar is stated in exactly one place,
  `cadence-core/bin/lib/report-rotation.mjs`, with `cmdLeaseCheck` consulting it
  and a pasted-back second copy reddening a test.
- `node cadence-core/bin/self-verify.mjs --root .` returns `ok: true` with an
  empty `problems` array at every commit in this phase.

## Context

Locked by `.planning/phases/3/CONTEXT.md`: D-01 EMPTY is decided from the DIFF
BODY and written as a positive field, never inferred from `base_id === head_id`;
D-02 the empty record is `checked: true, inconclusive: false, matches: []`,
because `cmdRiskCheckStatus` refuses on `checked` at `planning.mjs:4438` BEFORE
its `fired` predicate at `:4465` is consulted - clearing `inconclusive` alone
changes nothing at the gate; D-04 that record is admitted through the EXISTING
`recorded` state, since `offending` is `rows.filter((row) => row.state !==
'recorded')` at `:4486` and a fifth state name is an automatic `ok:false`; D-03
the reader tests the new field `=== true`, so the 69 old-shape records already on
this repo's trace cannot read as empty; D-06/D-08 the lease exemption widens to
`plan-<k>.<n>.md` for THAT `k` only, byte-exact on the canonical lowercase
spelling and never a directory lease; D-07 the rotated-name grammar keeps one
statement, in `lib/report-rotation.mjs`, consulted rather than copied.
Out of scope: prose control-flow edits (D-05 - `workflows/execute.md:284-316`
and `workflows/task.md:73-105` inherit the fix unedited), splitting
`inconclusive` into its causes, and repairing the trigger-less receipt join
(D-11 routes around it: the live re-run passes by NOT firing).

## Tasks

### Task 1: Record an empty diff body as a completed EMPTY check

- **Files:** cadence-core/bin/lib/risk-diff.mjs (its `scanDiff`),
  cadence-core/bin/planning.mjs (its `cmdRiskCheckRun`),
  cadence-core/bin/risk-diff.test.mjs
- **Action:** `scanDiff` collapses two different states into one answer: it
  coerces a non-string body to `''` and then returns `checked: false,
  inconclusive: true` for anything that trims to nothing, so "git handed back a
  zero-byte diff" and "there was no body to read at all" are byte-identical.
  Separate them (D-01). A body that IS a string and trims to nothing is a
  COMPLETED read of an empty range: `checked: true`, `inconclusive: false`,
  `matches: []`, plus a positive boolean field - spell it `empty` - that is true
  only on that arm. A body that is not a string, which is the `null`
  `cmdRiskCheckRun` leaves when `resolveRange` refused or the `git diff` threw,
  keeps today's `checked: false, inconclusive: true` and carries that same field
  as `false`. Put the field on EVERY return of `scanDiff`, including the normal
  scanned one, so its absence marks a pre-fix record rather than a fresh false
  (D-03) - the always-report convention `cmdDetectSurfaces` states in its own
  `ok({...})` block in planning.mjs. `checked: true` is the load-bearing half and
  `inconclusive: false` is not: `cmdRiskCheckStatus` computes `usable` by
  filtering on `checked` at `planning.mjs:4438`, before the `fired` predicate at
  `:4465` is ever consulted, which is why D-02 corrects the roadmap's stated
  diagnosis. Never decide emptiness by comparing the resolved ids: a revert pair
  has `base_id !== head_id` and a zero net diff, and D-01 measured both shapes
  producing identical records today. In `cmdRiskCheckRun`, carry the new field
  onto BOTH the `appendEvent` record and the returned envelope, beside `checked`
  and `inconclusive` in each, so the record a later `status` reads and the
  envelope the coordinator reads say the same thing. Update `scanDiff`'s JSDoc
  return type and the sentence above it that reads "`checked` is FALSE only when
  there was no diff body to read at all" - that clause becomes exactly true
  instead of approximate. Leave `parseDiff`'s `hunks === 0` arm alone: a
  binary-only or rename-only body is a NON-empty body the scanner could not
  judge, and it must keep `inconclusive: true` (AC4). Rewrite the pure-lib row
  `an empty body is 'checked: false', and that implies inconclusive`
  (risk-diff.test.mjs:91), which asserts exactly the collapse being removed; the
  null-body and scalar-body rows keep `checked: false` and gain the new field as
  false. Add repo-level rows through the existing `riskRepo`, `commitFile` and
  `riskCheck` helpers: a same-commit range, and a revert pair whose base is the
  commit before an addition and whose head restores that earlier content, so
  `base_id !== head_id` with an empty net diff - both must answer the empty shape
  and leave exactly one record carrying the field.
- **Verify:** `node --test cadence-core/bin/risk-diff.test.mjs` passes, its
  output naming a same-commit row, a revert-pair row whose ids differ, and the
  unchanged `an unreadable range is ok:false, and STILL leaves its record` row.
  AC4's non-empty unjudged rows stay green and are named in that same output -
  `a binary-only range is inconclusive, never collapsed into a clean answer`
  (risk-diff.test.mjs:79) and `a gitlink bump is inconclusive: git emitted a
  hunk, the nested code is not in it` (:140) - because a range that CONTAINS
  commits it could not judge is the case AC4 protects, and it is distinct from
  the unreadable-body row above it.
  In a scratch git repo, `risk-check run --phase 1 --plan 1 --base HEAD --head
  HEAD` prints `checked: true`, `inconclusive: false`, `matches: []` and the
  empty field true, and the appended `.planning/trace.jsonl` line carries the
  same four. Mutation, then restored: collapse the two arms back so a non-string
  body reaches the empty arm, and the same-commit and revert-pair rows fail while
  the unreadable-range row also fails; restore and all pass. `npx tsc -p
  tsconfig.ci.json` reports no errors and `node cadence-core/bin/self-verify.mjs
  --root .` returns `ok: true` with `problems: []`.

### Task 2: Admit the empty record at `risk-check status` through the existing `recorded` arm

- **Files:** cadence-core/bin/planning.mjs (`cmdRiskCheckStatus`'s per-record
  shape), cadence-core/bin/risk-diff.test.mjs
- **Action:** Add NO new state string and no new predicate clause (D-04):
  `offending` is `rows.filter((row) => row.state !== 'recorded')` at
  `planning.mjs:4486`, so a fifth name is an automatic `ok:false` with the row
  output looking correct, and `risk-fire-missing` / `risk-record-missing` would
  then name a step that is not missing. Task 1's `checked: true` already carries
  the record into `usable` at `:4438`, and `fired` at `:4465` is false for
  `matches: []` with `inconclusive: false`, so the row reaches `recorded`
  unaided. The one reader change is the per-record object built in the
  `outcome`/`risk_check` loop, the one already reading `checked: e.checked ===
  true` and `inconclusive: e.inconclusive === true` at `:4306-4309`: carry the
  new field there and read it `=== true` for the reason that block states - an
  absent verdict is not a passing one - so a record written before this phase
  cannot read as empty (D-03, measured against 69 old-shape events on this
  repo's trace). It then rides the reported `records` array through the existing
  `pub` mapping, which is what lets an auditor see WHY a row is `recorded` with
  nothing matched. Because `pub` reports every field of that object, the
  deep-equal in the row `risk-check status: appending the plan-1 record makes
  the identical call pass` (risk-diff.test.mjs:445) pins the full record shape
  and must gain the field. Tests for AC2: an END-TO-END row over
  `repoFixture(FROZEN_PHASE_1)` that runs `risk-check run` for an empty range in
  that repo, so a real record lands under the fixture's own correlation id, and
  then asserts `risk-check status --phase 1` returns `ok: true` with the row
  `recorded` - AC2's "reverting the run-side fix reddens the test" clause is
  judged on this row, so it must drive the seam rather than a hand-written
  `recordLine`. Beside it, a `recordLine` row carrying the PRE-FIX empty-range
  shape (`checked: false, inconclusive: true`) that still refuses
  `risk-record-missing` with state `unchecked` and reports the new field false.
  Touch neither the receipt vocabulary nor the `settles` join (D-11): an empty
  range is not fired, so no `gate_pass` or `adjudication` receipt is required for
  it, and the existing rows `an INCONCLUSIVE record satisfies the RECORD half`
  and `a record whose git read FAILED is not a check, and does not satisfy` must
  stay green - they are AC4's status half.
- **Verify:** `node --test cadence-core/bin/risk-diff.test.mjs` passes, naming
  the end-to-end empty-range status row and the old-shape refusal row. Revert
  task 1's split in `cadence-core/bin/lib/risk-diff.mjs` and that end-to-end row
  FAILS with `risk-record-missing`; restore it and it passes. `npx tsc -p
  tsconfig.ci.json` reports no errors and `node cadence-core/bin/self-verify.mjs
  --root .` returns `ok: true` with `problems: []`. human-verify (AC3, needs a live run the
  executor cannot make): run `/cad-execute <N> --rerun` against a phase whose
  tasks are all already satisfied and observe that it runs to completion with no
  user override of a blocking gate - the `risk-check run` over the empty range
  answers the empty shape and the following `risk-check status` returns
  `ok: true` rather than `risk-record-missing`. The transcription of that run
  belongs in `.planning/phases/3/UAT.md` at `/cad-verify` (D-11), because
  `.planning/trace.jsonl` is gitignored and the two `gate_pass` events from the
  observed deadlock carry no `trigger` field.

### Task 3: State the rotated-report name test once, in the rotation module

- **Files:** cadence-core/bin/lib/report-rotation.mjs (beside its
  `rotationTarget` export), cadence-core/bin/report-rotation.test.mjs
- **Action:** Add a second export beside `rotationTarget` answering, for one plan
  number and one directory-entry NAME, whether that name is that plan's report -
  the canonical `plan-<k>.md` or a rotated `plan-<k>.<n>.md` for the SAME `k`.
  It is the LEASE side's question, so it is byte-exact on the canonical
  lowercase spelling and must NOT inherit `rotationTarget`'s `'i'` flag (D-08):
  the case-insensitivity there exists only so the rename scan cannot destroy an
  existing file, the name PRODUCED is always canonical lowercase, and a staged
  `PLAN-1.1.MD` that no executor wrote must not be exempted from a
  parallel-safety gate. The grammar keeps exactly one statement (D-07, AC7): the
  rotated pattern source already built inside `rotationTarget` is the only place
  `plan-<k>.<suffix>.md` is spelled, so share that one construction rather than
  writing a second regex anywhere. Its anchors are load-bearing and must survive
  the move - the trailing `.md` and the dot before the suffix are what keep
  `plan-11.md` from reading as plan 1's rotation 1, and the `[1-9][0-9]*` suffix
  class is what keeps `plan-1.0.md` and `plan-1.01.md` out. Take the plan number
  through the module's own `planDigits`, so `08` and a non-integer are refused
  with the same TypeError rather than answering about plan 8. Keep the module
  pure in the sense its header states - names only, no fs, no path joining, the
  caller owns the directory read - which is what keeps it free of a CONTRACTS row
  under self-verify check 14. Add rows to the existing test file: `plan-1.md`,
  `plan-1.1.md` and `plan-1.12.md` are that plan's report; `plan-11.md`,
  `plan-1.md.bak`, `plan-1.0.md`, `plan-1..md`, `plan-2.1.md` under `k=1`,
  `plan-1-risk.diff`, `plan-1-risk-task-2.diff` and `PLAN-1.1.MD` are not; a
  malformed plan number throws.
- **Verify:** `node --test cadence-core/bin/report-rotation.test.mjs` passes with
  the seven existing rows still green and the new rows named in its output.
  Mutations, each restored: dropping the trailing `.md` anchor from the shared
  pattern fails the `plan-1.md.bak` row; dropping the dot before the suffix fails
  the `plan-11.md` row; adding `'i'` to the new predicate's use of the pattern
  fails the `PLAN-1.1.MD` row. `npx tsc -p tsconfig.ci.json` reports no errors and
  `node cadence-core/bin/self-verify.mjs --root .` returns `ok: true` with
  `problems: []`.

### Task 4: Widen `lease-check`'s report exemption to the rotated sibling

- **Files:** cadence-core/bin/planning.mjs (`cmdLeaseCheck`'s `reportFile`
  exemption), cadence-core/bin/planning.test.mjs
- **Action:** The exemption is one name by byte equality - `reportFile` is
  `repoRel(top, join(pdir, 'reports', 'plan-<k>.md'))` and the staged set is
  filtered with `p !== reportFile`. That was correct when a plan had exactly one
  report; after phase 1 an executor holds `plan-<k>.md` and `plan-<k>.<n>.md` at
  once and staging the rotated one during a task commit reports
  `undeclared-files`, blocking the executor for obeying its own contract - the
  collision `.planning/phases/1/SUMMARY.md` named as the one place the two halves
  could later meet. Replace the single-name test with: a staged path is exempt
  when it sits DIRECTLY in that plan directory's `reports/` directory - derived
  with the same `repoRel`/`join` construction `reportFile` already uses - and its
  final component satisfies task 3's predicate for THIS `k`. Directly means a
  remaining path segment separator disqualifies it, so a nested
  `reports/old/plan-1.1.md` no executor writes stays refused. Import the
  predicate; do NOT write a second regex here (D-07, AC7) - the block comment
  already in this function states the rule for exactly this situation, and the
  neighbouring `covers` import from `lib/lease-grammar.mjs` is the shape to
  follow. The bound must not become a directory lease (D-06):
  `plan-<k>-risk.diff` and `plan-<k>-risk-task-<n>.diff` live in that same
  directory and a `risk_surface` checkpoint deliberately leaves flagged changes
  staged, so a directory exemption would let a blocking gate's own evidence ride
  into a task commit - the failure `references/worktree-executor.md`'s bounded
  `git add` was just fixed to prevent. Do not move the `staged` count: it is
  computed before the exemption filter, so widening the exemption moves no
  reported number (D-09) and the existing `staged: 2` assertions must still read
  2. Leave the both-sides-of-a-rename handling alone: measured 2026-08-20,
  rotation stages as an ADD of `plan-<k>.<n>.md` plus a MODIFY of `plan-<k>.md`
  and not as a rename pair, so the destination needs its own exemption and that
  block is not the load-bearing path here (D-09). Add rows beside the existing
  `lease-check: the plan's OWN report file is the one exemption` test, through
  the existing `leaseRepo`, `leaseCheck` and `stage` helpers: staging
  `.planning/phases/1/reports/plan-1.1.md` beside `plan-1.md` for plan 1 is
  `ok: true` (AC5); `plan-2.md` and `plan-11.md` under plan 1 stay
  `undeclared-files` and are NAMED in the list (AC5); `plan-1-risk.diff`,
  `plan-1-risk-task-2.diff`, `PLAN-1.1.MD` and a nested `reports/old/plan-1.1.md`
  stay `undeclared-files` (AC6, D-08). Keep that existing row's second half - a
  staged `plan-2.md` is undeclared for plan 1 - exactly as it reads.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes, naming the
  rotated-report exemption row and the flagged-diff refusal rows. Revert the
  exemption to `p !== reportFile` and the AC5 row FAILS with `undeclared-files`
  naming `.planning/phases/1/reports/plan-1.1.md`; restore it and it passes.
  `npx tsc -p tsconfig.ci.json` reports no errors and `node
  cadence-core/bin/self-verify.mjs --root .` returns `ok: true` with
  `problems: []`.

### Task 5: Pin the one-statement rule with a helper-census row

- **Files:** cadence-core/bin/helper-census.test.mjs (its `HELPERS` table)
- **Action:** AC7's "exactly one statement" is a property, and nothing currently
  holds it: a future contributor can paste the rotated-name pattern back into
  `cmdLeaseCheck` and every test stays green. Add one row to the `HELPERS` table
  whose `home` is `lib/report-rotation.mjs` and whose `re` matches the BODY IDIOM
  of the rotated-name pattern - the pattern source itself, never the exported
  name, per the file's stated rule that matching the body is what makes a
  paste-back under a new name fail. Build the pattern from an ESCAPED string, as
  every other row does and for the reason the header states: the rules are
  lexical and tree-wide, so text a rule matches must not appear verbatim in this
  file or the census reddens on itself. Write the `note` so a contributor who
  trips it is told to import the predicate task 3 added, and why a second copy is
  the defect and not a style point - `lease-check` and the rotation module would
  then disagree about which staged name is a report, which is the same failure
  the `covers` row records for `plan-overlap` and `lease-check`. Add nothing
  else to the table: this row is AC7's mechanical form, not a sweep.
- **Verify:** `node --test cadence-core/bin/helper-census.test.mjs` passes with
  the new row named in the output and its `found` list equal to
  `['lib/report-rotation.mjs (x1)']`. Paste that pattern's source into
  `cadence-core/bin/planning.mjs`, re-run, and the row FAILS naming both files;
  remove it and it passes. `node cadence-core/bin/test.mjs other` passes, and
  `node cadence-core/bin/self-verify.mjs --root .` returns `ok: true` with
  `problems: []`.

## Notes

- **No requirement ids exist for this phase.** `.planning/ROADMAP.md`'s phase 3
  entry reads `**Requirements:** (seeded at /cad-context)` and none were seeded;
  `.planning/REQUIREMENTS.md`'s `## Active` records no open cycle. This plan is
  written against `.planning/phases/3/CONTEXT.md`'s AC1-AC7, and the frontmatter
  `requirements:` list is deliberately empty rather than filled with AC ids,
  which are not requirement ids and would trace to nothing at `/cad-audit` -
  the same call phase 1 and phase 2 made. Coverage: AC1 by task 1, AC2 by task 2,
  AC3 by task 2's human-verify arm, AC4 by the rows tasks 1 and 2 keep green,
  AC5 and AC6 by task 4, AC7 by tasks 3 and 5 plus the self-verify checks in
  tasks 4 and 5.
- **`--rerun` is the shipped spelling, so CONTEXT's third flagged assumption
  resolves.** `skills/cad-execute/SKILL.md:4` carries `argument-hint: "[phase
  number] [--rerun]"` and `cadence-core/workflows/execute.md:21-30` reads the
  token off `$ARGUMENTS` and names it in the refusal. AC3's command is spelled
  correctly as written.
- **No prose surface is edited and no weight-budget row moves.** D-05 keeps the
  fix in the two seams, and the only live prose naming the envelope's verdict
  fields - `cadence-core/references/review-triggers.md:514`, `{checked,
  categories, matches, inconclusive}` - is a summary that already omits
  `base_id`, `head_id` and `trace`, while the fire rule twelve lines below it
  stays true because an EMPTY range answers `inconclusive: false`. Naming the
  new field there is a judgement call for the human, recorded in the return
  marker rather than taken here; if it is taken later, that surface measures
  39268 B against a 39268 B budget, so D-10's same-commit re-pin applies.
- **Prior art carried in.** `.planning/phases/1/SUMMARY.md` recorded the lease
  exemption as deliberately not-reached and named it the one place the two
  halves could collide (task 4); phase 1's UAT confirmed rotation survives the
  commit transports and that `/cad-report`'s `plan-*.md` glob lists both
  reports, so nothing in this phase needs to re-prove the transports; the
  `v3.5.3` phase-1 UAT note about a fired range needing a receipt describes the
  `unfired` arm at `:4465-4472`, which an empty record never reaches - task 2
  deliberately leaves that join untouched.
