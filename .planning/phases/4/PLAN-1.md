---
phase: 4
plan: 1
requirements:
  - ENF-01
files:
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/lib/trace.mjs
  - cadence-core/bin/lib/read-trace.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/read-trace.test.mjs
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/fixtures/join.trace.jsonl
  - cadence-core/bin/fixtures/join.reads.jsonl
  - cadence-core/references/plan-revision.md
  - cadence-core/references/review-triggers.md
  - cadence-core/references/seams.md
  - cadence-core/workflows/context.md
  - cadence-core/workflows/decision-review.md
  - cadence-core/workflows/execute.md
  - cadence-core/workflows/minimalism-review.md
  - cadence-core/workflows/plan.md
  - cadence-core/workflows/report.md
  - cadence-core/workflows/verify-deep.md
  - skills/cad-executor-contract/SKILL.md
---

# Phase 4: Suggestions become seams - Plan 1

## Goal

The restated bracket close becomes one `trace close` subcommand every dispatch
site calls, the oversized `trace render` default carries a bound, the shipped
read instrumentation joins to the fire that caused it, and a `cad-executor` is
told the risk surfaces it will be judged on.

## Must be true when done

- Every one of the eight files that restated the return/checkpoint close now
  calls one `trace close` subcommand, and putting a raw
  `trace append --event return` back into any of them reddens the test suite.
- `trace render`'s default response for `--phase 3` on this repo's own record is
  at least 3x smaller than the 36,916 B it returns today, carries no `events`
  array, and still carries every `outcome` event plus one row per
  dispatch/return bracket - so `triage-gate`'s `rearm` lookup still finds its
  event in the default response.
- The full event array is still reachable, behind an explicit flag that carries
  its own `CONTRACTS` row.
- A `reads.jsonl` record joins to the `trace.jsonl` bracket that caused it by
  role normalization and timestamp containment, proved on committed fixtures;
  two overlapping same-role brackets report ambiguous rather than picking one;
  and the permanently unjoinable host types are reported as a count.
- `workflows/report.md` reads the shapes the two changed seams actually return -
  no `events` array, and no claim that the reads seam takes no flag.
- A `cad-executor` dispatch prompt carries the answered `surfaces` from its own
  `route.mjs resolve`, and the executor contract states what to do with them.

## Context

Locked decisions binding this plan: D-05 (the close prose is EIGHT files, twenty
lines, ten dispatch moments), D-06 (the inference may not key on `--tokens`;
`--detail` is the only discriminator), D-07 (`trace close` lives in
`planning.mjs`, never folded onto `route.mjs resolve`), D-13 (`escalation` stays
outside the inference), D-14 (the `BRACKETING` census is re-expressed in the
same work), D-08/D-09 (the bound is in the CLI arm, and is bracket rows plus
every `outcome` event, never a tail-N), D-10/D-11 (read-time join, ambiguous on
overlapping same-role brackets), D-12 (executor surfaces get their own
criterion), D-19 (seven edited surfaces are at zero weight-budget headroom),
D-20 (a new flag needs its `CONTRACTS` row), D-21 (`report.md`'s prose moves
with the reads flag), D-22 (the join's regression test runs on committed
fixtures).

Out of scope here: making `corr` fire-scoped (phase 2 D-02 locked it
phase-scoped), a `trace-suggest.mjs` rule for the reads join (phase 2 D-11
locked the reader as prose), `execute.md`'s twice-instructed `triage-gate.md`
re-read (D-16), and the criteria ceilings and round-trip batching, which are
PLAN-2.

PLAN-2 is SEQUENTIAL after this plan: it shares `workflows/context.md`,
`workflows/plan.md`, `planning.mjs`, `self-verify.mjs` and `weight-budgets.json`
with it, and its seam-invocation census (PLAN-2 task 6) counts the calls this
plan's task 2 rewrites.

## Tasks

### Task 1: Add the `trace close` subcommand

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/self-verify.mjs, cadence-core/bin/trace.test.mjs
- **Action:** Add a `close` arm to `cmdTrace`, beside the existing `append`
  arm, that writes a lifecycle terminal through the same `appendEvent` path
  `append` already uses. It takes the flags the twenty shipped close lines
  carry - `--phase`, `--plan`, `--role`, `--tokens`, `--detail`, `--reviewer` -
  and fixes the family to `lifecycle` itself, so no caller states it again. The
  arm it chooses is inferred from `--detail`: present and non-empty means
  `checkpoint`, absent means `return`. It may NOT key on `--tokens` (D-06):
  measured across all 20 close lines, 6 of the 10 checkpoint sites DO carry
  `--tokens` (`decision-review.md:68`, `execute.md:203`,
  `review-triggers.md:140`, `minimalism-review.md:94`, `verify-deep.md:67`)
  while every checkpoint carries `--detail` and no return does, so a
  token-presence classifier would write `return` for four shipped checkpoint
  sites and bill an unusable worker as a clean close. `escalation` stays OUTSIDE
  this inference (D-13) - it is a `TERMINAL` member with zero prose producers,
  it stays reachable through `trace append`, and the seam's header comment says
  so. Reuse `append`'s existing validation for every shared flag, including its
  comma-grouped three-digit `--tokens` exception and its rule that a malformed
  value is a malformed CALL with nothing appended. Keep it in `planning.mjs`
  beside `trace append` and never fold it onto `route.mjs resolve` (D-07): the
  resolve happens BEFORE the worker returns, `route.mjs:20-23` states that
  shipped position, and folding would collapse every measured duration to zero.
  Add the `'trace close'` row to the `CONTRACTS` table beside `'trace append'`
  and `'trace render'`, or `self-verify` check 2 reports `unknown-subcommand` on
  correct prose.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` passes with new
  cases proving: a close with no `--detail` writes an event `trace render` shows
  as `return`; a close with `--detail "x"` writes one it shows as `checkpoint`;
  a close carrying `--tokens` and no `--detail` still writes `return`; a
  malformed `--tokens` value writes nothing at all; and a close pairs with a
  dispatch of the same `--plan` so `trace render` reports no `unpaired` entry.
  `node cadence-core/bin/self-verify.mjs` reports no `unknown-subcommand` and no
  `unknown-flag`.

### Task 2: Convert all eight close sites and re-express the census on the new spelling

- **Files:** cadence-core/references/plan-revision.md, cadence-core/references/review-triggers.md, cadence-core/references/seams.md, cadence-core/workflows/context.md, cadence-core/workflows/decision-review.md, cadence-core/workflows/execute.md, cadence-core/workflows/minimalism-review.md, cadence-core/workflows/plan.md, cadence-core/workflows/verify-deep.md, cadence-core/bin/trace.test.mjs, cadence-core/bin/weight-budgets.json
- **Action:** Replace every raw `trace append --family lifecycle --event
  return|checkpoint` line with one `trace close` call at all twenty measured
  sites across the eight files - `plan-revision.md:23,30,54,60`,
  `review-triggers.md:131,140`, `context.md:179,193`,
  `decision-review.md:61,68`, `execute.md:202,203`,
  `minimalism-review.md:87,94`, `plan.md:194,202,297,303`,
  `verify-deep.md:24,67` (D-05, measured 2026-08-14; a plan scoped to the six
  both shipped statements claimed would leave two files writing the raw form and
  redden the census). Each of the ten dispatch moments ends with ONE close line
  rather than two alternative event spellings: the site passes `--detail` when
  the worker came back empty, unmarked or unusable and omits it otherwise, and
  the seam picks the terminal. Keep every existing key on each line -
  `--plan`, `--role`, `--tokens`, and `review-triggers.md`'s `--reviewer` - and
  keep the standing rule to OMIT `--tokens` on a figureless return. Then
  re-express `trace.test.mjs`'s per-FILE `BRACKETING` census in the SAME work
  (D-14): its three assertions today count `--event return` and `--event
  checkpoint` occurrences per file (`:1042-1068`) and all eight rows go red on
  the converted tree. The re-expressed census keeps the same eight rows and the
  same dispatch counts, and asserts per file that the close count EQUALS the
  dispatch count - exactly one close per dispatch moment, never "at least",
  which passes on a mechanical two-closes-per-moment conversion of all twenty
  sites and leaves a runtime branch able to append duplicate terminals - AND
  that the file contains ZERO raw
  `trace append --family lifecycle --event return|checkpoint` invocations - that
  second assertion is what AC2 means by a raw append reddening the suite, and it
  is what replaces the deleted per-arm counts. The lifecycle-vocabulary
  assertions above it (`:1014-1018`, which require some prose producer to write
  a `TERMINAL` event) must move to the close spelling too or they fail on a
  correct tree; do not delete them, and do not delete the failure-arm coverage
  argument - restate it as the seam's guarantee, since the checkpoint arm is now
  chosen by `trace close` rather than by a second prose line. `references/seams.md:113-127`
  is the ONE statement of the bracket rule and names the raw event spellings the
  eight files point at; update that sentence to name `trace close` in the same
  work, or the canonical rule statement is false the moment the eight stop
  writing the raw form. Every surface whose byte count moves carries its
  `weight-budgets.json` row change here (D-19/phase 1 D-10): `review-triggers.md`
  (28,012), `decision-review.md` (10,993), `minimalism-review.md` (8,244) and
  `seams.md` (19,003) are at ZERO headroom, `execute.md` has 59 B, `context.md`
  and `plan.md` 627 B each. Re-pin a row because the surface deliberately
  changed size, never to make a growth you did not intend go quiet.
- **Verify:** `grep -rn "trace append" cadence-core skills agents` returns no
  line carrying `--event return` or `--event checkpoint`;
  `node --test cadence-core/bin/trace.test.mjs` passes; putting one raw
  `trace append --family lifecycle --event return` line back into any one of the
  eight files makes that file's census row FAIL, and removing it again makes the
  suite pass; `node cadence-core/bin/self-verify.mjs` reports no
  `budget-overrun`, `unbudgeted-surface` or `unknown-flag`.

### Task 3: Bound `trace render`'s default response

- **Files:** cadence-core/bin/lib/trace.mjs, cadence-core/bin/planning.mjs, cadence-core/bin/self-verify.mjs, cadence-core/bin/trace.test.mjs
- **Action:** The bound belongs in `planning.mjs`'s `render` CLI arm
  (`:2747-2775`), NOT inside `renderTrace` (D-08): `trace suggest` calls
  `renderTrace` then reads `r.events.length` (`:2737-2741`) and
  `lib/trace-suggest.mjs:122` reads `render.events` directly, so bounding the
  function would make every evidence-backed retune suggestion price a fraction
  of the run. `renderTrace` already computes the dispatch/terminal pairing
  internally (its `open` map and `seenTerminals` set) but exposes only
  `unpaired`; expose the paired brackets as an ADDITIONAL key on its return so
  the CLI arm can print rows without re-deriving the pairing, leaving every key
  the two in-process consumers already read byte-identical. The CLI arm's
  default response then carries, in place of `events`: one row per
  dispatch/return bracket, and EVERY `outcome` family event verbatim. It is NOT
  a tail-N of `events` (D-09): `references/triage-gate.md:38-43` reads
  `trace render --phase <N>` to find a prior `rearm` outcome under the current
  `corr` before firing the narrowed round, and a truncated payload makes that
  lookup miss, so the one-re-arm cap on the only BLOCKING trigger fails open -
  the uncapped-re-arm loop `.planning/CAPTURE.md:291` records as measured
  damage. The second reader, `workflows/report.md:41-42`, needs one row per
  dispatch/return pair and one line per review fire, which is the same shape.
  Leave `file`, `corr`, `capped`, `counts`, `roles`, `coordinator`, `malformed`,
  `unpaired` and `mismatched` exactly as they are. Put the full event array
  behind an explicit flag on this arm and add that flag to the `'trace render'`
  `CONTRACTS` row, which declares `['--phase']` only today
  (`self-verify.mjs:253`) - `.planning/CAPTURE.md:38` records `weight.mjs
  --root` shipping without its row and check 2 reporting `unknown-flag` on
  correct prose (D-20).
- **Verify:** `node cadence-core/bin/planning.mjs --dir .planning trace render
  --phase 3 | wc -c` prints a number under 12,305 (the 36,916 B it returns today
  divided by three) and the output contains no `"events"` key; the same command
  still contains the phase's `rearm` outcome event and one row per bracket; the
  same command with the new flag carries the full array again;
  `node --test cadence-core/bin/trace.test.mjs` passes, including the committed
  `verbatim.trace.jsonl` fixture test at `:1150`, which must report the same
  `corr`, `counts`, `roles` and `unpaired` figures as before;
  `node cadence-core/bin/self-verify.mjs` reports no `unknown-flag`.

### Task 4: Point `report.md` at the bounded render

- **Files:** cadence-core/workflows/report.md, cadence-core/bin/weight-budgets.json
- **Action:** `read_record`'s sentence at `:25-27` tells the reader that
  "everything below reads from the first return: `events`, `roles`, ..." and
  `compose`'s shape at `:45-46` builds the `Dispatches:` table and the `Gates:`
  line off that array. Restate both against what the bounded default now
  returns: the per-bracket rows for the dispatch table, the `outcome` events for
  the gates line, `roles`/`coordinator`/`unpaired`/`mismatched`/`capped`/
  `malformed` unchanged. Do NOT instruct the report to pass the full-array
  flag - this command has no reader for the raw array, and re-adding it re-buys
  the bytes task 3 removed on the one path that reads them into a model's
  context. Every existing rule in the step stays: numbers come from the record,
  a dispatch with no token figure reports `unrecorded`, the residue is reported
  AS GIVEN, an absent `coordinator` block means say nothing. `report.md` is at
  ZERO headroom (5,850/5,850, measured 2026-08-14), so its
  `weight-budgets.json` row moves with any growth (D-19).
- **Verify:** `grep -n "events" cadence-core/workflows/report.md` shows no
  instruction to read an `events` array from the render, and the `Dispatches:`
  and `Gates:` rows of the compose shape name the bracket rows and the outcome
  events; `node cadence-core/bin/self-verify.mjs` reports no `budget-overrun`,
  `unbudgeted-surface` or `unknown-flag`.

### Task 5: Join a read record to its bracket, as a pure function

- **Files:** cadence-core/bin/lib/read-trace.mjs, cadence-core/bin/read-trace.test.mjs
- **Action:** Add a pure exported function beside `summarizeReads` that joins
  `reads.jsonl` records to `trace.jsonl` dispatch brackets by read-time
  inference (D-10): normalize a record's `agent` value - the corpus carries
  `cadence:cad-executor`, `cadence:cad-assumptions-analyzer-high`,
  `cadence:cad-planner`, `cadence:cad-verifier-medium` (measured 2026-08-14) -
  to the role spelling `trace.jsonl`'s dispatch events carry, then test the
  record's `ts` for containment inside a closed dispatch/terminal bracket of
  that role. NEVER a corr stamped at hook time: a hook-time stamp gives a read
  running inside a subagent the coordinator's current corr, making the join
  confidently wrong rather than honestly absent, against a hook whose stated
  contract (this file's header, and `lib/read-trace.mjs:26-29`) is that it never
  disturbs normal work. A record whose timestamp falls inside MORE THAN ONE
  bracket of the same role reports AMBIGUOUS and picks none (D-11): measured
  over all 100 closed brackets in `.planning/trace.jsonl` there are 2
  overlapping same-role pairs, both `cad-executor` (phase 4 plans 1 and 2, phase
  3 plans 2 and 1), and `cad-executor` is the largest subagent share of the
  corpus at 440 records, so guessing is wrong exactly on the highest-cost path -
  `lib/trace.mjs:370-375` keys pairing on `(corr, phase, plan)` for this same
  reason. `fork` and `general-purpose` are HOST agent types, not Cadence roles,
  so their records have no dispatch event to join to and never will: count them
  as a stated unjoinable FLOOR (32% of subagent reads), never as a failure. A
  record missing `agent` or `agent_id` STATES the field as absent rather than
  assuming it - the host guarantees neither field, and the file's own comment at
  `:242-246` already takes that posture for `tool_response`. Pure by injection,
  the way `filesOf` is: the caller supplies the bracket rows, the lib does no
  I/O.
- **Verify:** `node --test cadence-core/bin/read-trace.test.mjs` passes with one
  case each for: a `cadence:cad-verifier-medium` record whose `ts` falls inside
  one `cad-verifier` bracket joining to that bracket; the same record outside
  every bracket reported unjoined; a record inside two overlapping
  `cad-executor` brackets reported ambiguous and joined to neither; `fork` and
  `general-purpose` records counted in the floor and never joined; and a record
  with no agent field reported with the field named absent rather than defaulted.

### Task 6: Wire the join into the `reads` seam, on committed fixtures

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/self-verify.mjs, cadence-core/bin/fixtures/join.trace.jsonl, cadence-core/bin/fixtures/join.reads.jsonl, cadence-core/bin/read-trace.test.mjs
- **Action:** `cmdReads` gains one explicit flag that runs task 5's join,
  feeding it the bracket rows task 3 exposed on `renderTrace`. Without the flag
  the envelope is byte-identical to what it returns today, including its
  `no reads recorded yet` arm. With it, the envelope also reports the joined
  count, the unjoined count, the ambiguous count and the unjoinable floor as its
  own count - four separate figures, because collapsing them hides exactly the
  distinction the join exists to make. The `reads` row in `CONTRACTS` declares
  `[]` today (`self-verify.mjs:234`), so the row moves with the flag or check 2
  reports `unknown-flag` on correct prose (D-20). Both `.planning/trace.jsonl`
  and `.planning/reads.jsonl` are gitignored (`.gitignore:29-30`, neither in
  `git ls-files`), so the regression test runs on COMMITTED fixtures (D-22)
  written into `cadence-core/bin/fixtures/` beside `verbatim.trace.jsonl`: a
  trace fixture carrying at least one ordinary role bracket plus the overlapping
  same-role pair, and a reads fixture carrying records that land inside one
  bracket, inside both, outside all of them, and under the `fork` /
  `general-purpose` host types. The live corpus alone would leave the
  overlapping case untested. Any live-corpus figure quoted in a test is a string
  literal, the `trace-suggest.test.mjs:63-81` precedent phase 2 D-09 locked.
- **Verify:** running the `reads` seam with the new flag against a planning root
  holding the two committed fixtures reports a nonzero joined count, exactly one
  ambiguous record, an unjoined count matching the out-of-bracket records, and a
  floor count equal to the fixture's `fork` plus `general-purpose` records;
  running it WITHOUT the flag returns the same envelope it returns today;
  `node --test cadence-core/bin/read-trace.test.mjs` passes;
  `node cadence-core/bin/self-verify.mjs` reports no `unknown-flag`.

### Task 7: Move `report.md`'s reads prose with the flag

- **Files:** cadence-core/workflows/report.md, cadence-core/bin/weight-budgets.json
- **Action:** `:24-26` states the reads seam "takes no phase scoping and no
  flag" and `:78-85` carries the whole-corpus caveat on the reading line - both
  become false the moment task 6 ships (D-21). Name the flag at the call, and
  replace the whole-corpus caveat with what the join now attributes: the joined
  and ambiguous counts, and the permanent unjoinable floor stated as a floor -
  `fork` and `general-purpose` are HOST agent types with no dispatch event to
  join to, which is a statable limit rather than a gap to close. Keep the
  silence rule intact: `calls: 0` or the `no reads recorded yet` note still
  means say nothing about reading at all. Keep the standing prohibition on
  recomputing any returned figure. `report.md` is at ZERO headroom, so its
  `weight-budgets.json` row moves with any growth (D-19).
- **Verify:** `grep -n "no phase scoping and no flag"
  cadence-core/workflows/report.md` returns nothing, the step names the new flag
  at its call, and the reading line names the unjoinable floor;
  `node cadence-core/bin/self-verify.mjs` reports no `unknown-flag`,
  `budget-overrun` or `unbudgeted-surface`.

### Task 8: Hand the executor the surfaces it will be judged on

- **Files:** cadence-core/workflows/execute.md, skills/cad-executor-contract/SKILL.md, cadence-core/bin/prose-agreement.test.mjs, cadence-core/bin/weight-budgets.json
- **Action:** `route.mjs resolve` already returns `surfaces` and
  `surfaces_answered` on every dispatch (its final `out({...})` call), and a
  `--role cad-executor` resolve on this repo returned six answered surfaces on
  2026-08-14 - the answered set is in hand at the dispatch and is simply not
  handed to the worker. Add it to the executor dispatch prompt's ordered list at
  `execute_sequential` (`:164-170`), on the phase-level stable-first half since
  it is identical across the phase's plans; `references/execute-parallel.md:15`
  says the parallel path uses the same prompt except the mode line, so it
  inherits. State what an unanswered resolve means: `surfaces_answered: false`
  means all of the table's categories stand, not none. In
  `skills/cad-executor-contract/SKILL.md` - which has zero occurrences of
  `concurrency`, `untrusted_input` or `risk_surface` today - state what the
  executor DOES with them: they are the bar the work is WRITTEN to, so a task
  touching one is built against it rather than discovering it after the review
  fires. Do NOT add a halt condition: `:154-157` says a risky diff is not a
  checkpoint because risk review fires once against the plan's whole committed
  range after the executor returns, and that stays true. Both surfaces are at or
  near zero headroom (`execute.md` 59 B, the contract skill 11,662/11,662), so
  their `weight-budgets.json` rows move with the growth (D-19). Add a check to
  `prose-agreement.test.mjs`, whose subject is exactly this - prose that copies
  a machine-readable fact must still match it - asserting the executor dispatch
  block names the resolve's `surfaces` and the contract names them too.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` passes;
  deleting the surfaces line from `execute.md`'s dispatch prompt makes that
  check FAIL and restoring it makes it pass; `grep -c "surfaces"
  skills/cad-executor-contract/SKILL.md` is nonzero;
  `node cadence-core/bin/self-verify.mjs` reports no `budget-overrun` or
  `unbudgeted-surface`.

## Notes

- **Deviation from the CONTEXT `Plan shape` directive, stated rather than
  silent.** The directive asks for multiple plans across "five independent fix
  sites". The sites are NOT file-independent: AC1, AC2, AC3 and AC5 all land in
  `cadence-core/bin/planning.mjs` and `cadence-core/bin/self-verify.mjs`; AC2
  and AC4 both edit `workflows/context.md` and `workflows/plan.md`; AC2 and AC6
  both edit `workflows/execute.md`; AC3 and AC5 both edit `workflows/report.md`;
  and nearly every task moves `weight-budgets.json`. The phase is therefore
  split for CAPACITY (14 tasks against an 8-task-per-plan ceiling) into two
  SEQUENTIAL plans that share declared files, not into parallel slices. PLAN-2
  must run after this plan: its seam-invocation census counts the calls task 2
  rewrites.
- **One file beyond the locked eight.** Task 2 also edits
  `references/seams.md:113-127`. D-05 measured EIGHT files carrying close
  INVOCATIONS; `seams.md` carries none, but it is the single canonical statement
  of the bracket rule ("This paragraph is the ONE statement of that rule;
  dispatch sites point here rather than restating it") and it names the raw
  `return`/`checkpoint`/`escalation` event spellings. Left alone it states a
  mechanism no site uses any more. Flagged here because it is one surface past
  what AC2 enumerates.
- `escalation` keeps no producer in the tree after task 2 (D-13). The
  `TERMINAL` list in `lib/trace.mjs:111` is unchanged and the event stays
  reachable through `trace append`; only the inference excludes it.
