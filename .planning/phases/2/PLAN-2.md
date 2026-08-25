---
phase: 2
plan: 2
requirements: [CEN-02]
files:
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/arg-contract.test.mjs
  - cadence-core/bin/planning/lease-check.mjs
  - cadence-core/bin/planning-lease-check.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/workflows/plan.md
  - cadence-core/bin/weight-budgets.json
  - .planning/DOCS-CLAIMS.md
  - cadence-core/bin/citation-census.test.mjs
  - .planning/phases/2/census-replay.md
---

# Phase 2: Census registry and plan-time lease check - Plan 2 (the plan-time arm)

## Goal

A plan that will change a hand-maintained census count declares the file holding
it BEFORE an executor starts. `lease-check` gains a plan-time arm that reads a
PLAN's `files:` lease against the registry and REFUSES when the declared work
would invalidate a census the lease does not declare, and `/cad-plan` fires it
after PLAN.md is written and before any executor is dispatched.

## Must be true when done

- Running `lease-check` with the plan-time flag against phase 5's PLAN-1 lease
  exactly as that plan was written names `cadence-core/bin/trace.test.mjs` and
  `cadence-core/bin/self-verify.test.mjs`, before any execution, and the run
  spawns no `git` subprocess and executes nothing from the plan.
- The refusal names each missing file beside the census it holds, so the fix is
  to amend the lease rather than to guess.
- `/cad-plan` fires the check after PLAN.md is written and before any executor
  is dispatched, on the dispatched path and the `--inline` path both, and does
  not continue past a refusal.
- Replayed over every historical PLAN in this repository that declares a path
  under `cadence-core/bin/`, no single registry entry refuses more than half of
  them, and the per-entry counts are on the phase record.
- A commit-time `lease-check` refusal on a registered census file carries a
  different reason code than an ordinary `undeclared-files` refusal and appends
  an event to `.planning/trace.jsonl`; a refusal on an unregistered file carries
  the old reason and appends nothing.
- `node cadence-core/bin/test.mjs` reports 0 failures,
  `node cadence-core/bin/self-verify.mjs` reports zero problems, and
  `npx tsc -p tsconfig.ci.json` exits 0.

## Context

Runs AFTER plan 1 and READS the module plan 1 creates
(`cadence-core/bin/lib/census-registry.mjs`); it never edits that module. Locked
decisions that bind this plan: D-07 (the plan-time gate REFUSES rather than
reports, deliberately breaking with `plan-size` and `criteria-size`, because a
soft report reproduces exactly the failure CEN-02 names and this repository's
own record shows two `undeclared-files` refusals committed rather than obeyed),
D-09 (a FLAG on `lease-check`, never a `lease-check plan` two-word subcommand),
D-10 (path intersection through `lib/lease-grammar.mjs` is the only relation
available at plan time; reading a plan's Action prose or opening a census test
is out of bounds), D-11 (no `git` call and no staged set, so no `no-staged-set`
fail-closed rule on this arm), D-12 (the gate fires between `check_size` and
`check_gate`, with the `--inline` step POINTING at the written step rather than
restating the call), D-13 (criterion 6 is carried BOTH ways - a distinct reason
on the envelope AND an `appendEvent`, on the `planning/risk-check.mjs` pattern
where the append may not change the verdict), D-14 (this phase's own exposure:
four census files that must be leased, all four declared above).

Out of scope: what `lease-check` does at commit time on an UNREGISTERED file -
that verdict, its `no-staged-set` fail-closed rule and its envelope are
unchanged. No census is removed, re-pinned as a value or converted to a derived
measurement. No config key is added.

## Tasks

### Task 1: Declare the plan-time flag and re-pin the flag-entry count

- **Files:** cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/arg-contract.test.mjs
- **Action:** Add one flag row to the existing `'lease-check'` entry in
  `CONTRACTS` (the row today declares `--phase` and `--plan`, both required),
  spelled `--plan-time`, optional, boolean-typed, with the same value and bare
  dispositions the other boolean flags in that table already carry. A FLAG and
  never a second word: this file's own header states that `subcommandKey`
  consumes a second word only for the families in `TWO_WORD` and names
  `lease-check` among the one-word precedents, and one operation does not earn
  widening that Set. Say in a comment beside the row why the arm is a flag and
  not a subcommand, and that `--plan` stays required on both arms because both
  name a plan FILE on disk.
  This moves the census `arg-contract.test.mjs` holds: its
  `every flag in every row declares a complete grammar` test asserts the table
  declares 184 flag entries (verified at 184 on 2026-08-24). Re-pin it to the
  new measured value in the SAME commit - this is the identical failure
  `.planning/_archive-v3.7.0` records for that census at 178 to 179, and it is
  the first of the four D-14 exposures this plan leases against. The top-level
  row count (18) does not move: no new script row is added.
- **Verify:** `node --test cadence-core/bin/arg-contract.test.mjs` reports 0 failures with the entry count at its new value, and `node cadence-core/bin/planning.mjs lease-check --phase 2 --plan 2 --plan-time` no longer refuses with a `bad-args` complaint about an unknown flag.

### Task 2: Add the plan-time arm to lease-check

- **Files:** cadence-core/bin/planning/lease-check.mjs
- **Action:** In `cmdLeaseCheck`, branch on the new flag BEFORE the
  `execFileSync` block that reads `rev-parse --show-toplevel` and the staged
  set, so the plan-time path shares nothing below `parsePlanFiles` with the
  commit-time path (D-11). The arm keeps the existing `requirePhaseArg` /
  `requireInt` argument validation and the existing plan-file resolution (the
  caller's own phase-directory spelling, `PLAN-<k>.md` falling back to `PLAN.md`
  when `k` is 1, `no-plan` when neither is there), then reads the declared set
  through `parsePlanFiles` exactly as the commit-time arm does, and asks the
  lease predicate exported by `cadence-core/bin/lib/census-registry.mjs` - read
  that module for its export names - which registered censuses the declared set
  puts at risk without declaring their holding file.
  No `git` call on this path, no staged set, and NO `no-staged-set` fail-closed
  rule: that rule is a statement about the STAGED side and has no plan-time
  analogue, and inheriting it would halt planning in any tree where
  `git diff --cached` fails, on a condition this arm does not measure. Because
  `top` is not resolved here, report the plan file by a path this arm can build
  without git; registry subjects and lease declarations are both already
  repo-relative strings, so `repoRel` has no input on this path.
  Empty result: `ok` with the phase, the plan, the plan file and the declared
  count, so a clean lease is a pass and not a silence. Non-empty result: emit
  directly with `ok:false` and a refusal reason of its own, distinct from
  `undeclared-files` - the existing refusal emits directly for the same reason,
  that `fail()`'s reason/detail/hint shape has no channel for the offending
  list, and the list is the whole point. The payload names, per entry, the FILE
  the lease is missing beside what that census counts and where it is asserted,
  which is what makes the refusal actionable, plus a `hint` telling the caller
  to add those paths to that plan's `files:` list and re-run - `self-verify`'s
  refusal-hint check requires a `hint` on every in-scope refusal site under
  `cadence-core/bin/`. Carry `frontmatter_issues` onto the envelope when
  `parsePlanFiles` reports any, as the commit-time arm already does.
  Add no `e && e.message ? e.message : String(e)` site on this path:
  `planning-lease-check.test.mjs` censuses that idiom across the whole planning
  seam at 14, and this arm makes no call that can throw a git or fs error.
- **Verify:** `node cadence-core/bin/planning.mjs lease-check --dir <a scratch .planning holding a phase whose PLAN.md declares only cadence-core/bin/planning/> --phase 1 --plan 1 --plan-time` returns one JSON line with `ok:false`, a reason that is not `undeclared-files`, and a payload naming `cadence-core/bin/trace.test.mjs`; the same call against a plan whose lease also declares `cadence-core/bin/trace.test.mjs` returns `ok:true`.

### Task 3: Prove the arm against phase 5's PLAN-1 lease and prove it touches no git

- **Files:** cadence-core/bin/planning-lease-check.test.mjs
- **Action:** Add the plan-time arm's tests. The regression fixture is phase 5's
  PLAN-1 as that plan was actually written - the run that halted at task 1 with
  0 of 8 tasks - whose `files:` block declared exactly five paths:
  `cadence-core/bin/planning.mjs`, `cadence-core/bin/planning/`,
  `cadence-core/bin/helper-census.test.mjs`,
  `cadence-core/bin/prose-agreement.test.mjs`,
  `cadence-core/bin/planning.test.mjs`. Write those five into a fixture plan file
  rather than shelling out to `git show`, and cite
  `git show 6645ce4b:.planning/phases/4/PLAN-1.md` in a comment as where they
  came from, so a shallow clone still runs this test. Assert the arm refuses and
  names exactly THREE files: `cadence-core/bin/trace.test.mjs`,
  `cadence-core/bin/self-verify.test.mjs` and
  `cadence-core/bin/planning-lease-check.test.mjs`. The third follows from plan
  1's row (i), whose subject pair is the same `planning.mjs` + `planning/` union
  row (c) carries: that lease declared both subjects and neither holding file,
  so all three qualify. Criterion 3 names the first two and does not say ONLY
  those two - a third grounded name is the arm working. Assert the SET, so a
  fourth name or a missing one both redden.
  Three more arms. (a) NO GIT: run the same call from a `mkdtemp` directory that
  is not inside a git repository and assert the answer is still the census
  refusal rather than `no-staged-set` - the commit-time arm cannot answer at all
  there, so this settles that the plan-time arm reads no repository. Reinforce
  it with a `git` stub on the child's PATH that records its argv, the pattern
  `issue-check.mjs` already uses, and assert it recorded nothing. (b) EXECUTES
  NOTHING FROM THE PLAN: run the same fixture again with its task Action prose
  replaced by arbitrary text and assert the result is byte-identical, so the arm
  provably reads paths and not instructions. (c) CLEAN: a lease that declares
  both holding files returns `ok:true` with the declared count, and a phase with
  no PLAN file at all still returns the existing `no-plan` refusal on this arm.
- **Verify:** `node --test cadence-core/bin/planning-lease-check.test.mjs` reports 0 failures, with the phase-5 fixture arm asserting exactly the three named files and the argv-recording stub arm asserting zero `git` invocations.

### Task 4: Replay the arm over every historical plan and record the per-entry counts

- **Files:** cadence-core/bin/planning-lease-check.test.mjs, .planning/phases/2/census-replay.md
- **Action:** Add a replay arm that walks every `PLAN.md` / `PLAN-<k>.md` under
  `.planning/` in this repository - the live `phases/`, every `_archive-v*/` and
  `tasks/<slug>/` - parses each one's declared set with `parsePlanFiles`, keeps
  the plans declaring at least one path under `cadence-core/bin/`, and runs the
  registry's lease predicate over each. Assert the walk is non-vacuous (it must
  find well over thirty such plans; measured 41 on 2026-08-24, against the 40
  CONTEXT measured before phase 1's own plan landed) and assert that NO single
  registry entry refuses more than half of them. That bound is the flagged
  assumption D-03 accepts: an entry that exceeds it is narrowed again or
  removed, never tuned, because `planning/lease-check.mjs`'s own header says a
  rail that fires wrong gets deleted.
  Then write `.planning/phases/2/census-replay.md` as the phase record: the
  measurement date, the number of plans walked and the number declaring under
  `cadence-core/bin/`, and one row per registry entry giving its refusal count
  and share. Measured 2026-08-24 while planning, over 41 such plans: the
  `self-verify.test.mjs` entry refuses 6 (15%), `trace.test.mjs` 6 (15%),
  `weight-budgets.json` 2 (5%) and `arg-contract.test.mjs` 0 - re-measure rather
  than transcribing these, and record what the run actually returns.
- **Verify:** `node --test cadence-core/bin/planning-lease-check.test.mjs` reports 0 failures including the replay arm, and `.planning/phases/2/census-replay.md` carries one row per registry entry with a refusal count, each under half the walked total.

### Task 5: Make a commit-time census refusal distinguishable on the record

- **Files:** cadence-core/bin/planning/lease-check.mjs, cadence-core/bin/planning-lease-check.test.mjs, cadence-core/bin/trace.test.mjs
- **Action:** On the commit-time path, when the `undeclared` list is non-empty,
  split it: paths that are a registered census's holding file get a refusal
  reason of their own, distinct from `undeclared-files`; a refusal carrying no
  registered census file keeps `undeclared-files` exactly as it is today. Both
  refusals keep the existing envelope fields and both keep a `hint`.
  `prose-agreement.test.mjs`'s lockfile-lease row asserts this file still emits
  the literal `undeclared-files`, so that reason must remain spelled here.
  On the census arm only, append one event to `.planning/trace.jsonl` through
  `appendEvent` from `../lib/trace.mjs`, on the `planning/risk-check.mjs`
  pattern: appended before the envelope is emitted, its `{written, reason}`
  riding the envelope so a trace that could not be written is reported rather
  than silently dropped, and it may NOT change the verdict. Family `outcome`,
  like `risk_check`. The record and the envelope carry DIFFERENT halves - the
  record carries the census identity, the envelope carries the file list and the
  hint. Do not append on the ordinary `undeclared-files` arm and do not append
  on the plan-time arm: the append IS the distinguishing signal, and widening it
  to every refusal destroys the distinction criterion 6 asks for.
  Two fixtures in the test file, one each: a staged undeclared path that is a
  registered census file gets the new reason and leaves exactly one trace line;
  a staged undeclared path that is not gets `undeclared-files` and leaves the
  trace file untouched. `cadence-core/bin/trace.test.mjs` is declared because
  its four-refusal-sentence census reads this whole seam's source - confirm this
  task wrote none of those four sentences and that the census still passes; do
  not re-pin it.
- **Verify:** `node --test cadence-core/bin/planning-lease-check.test.mjs cadence-core/bin/trace.test.mjs cadence-core/bin/prose-agreement.test.mjs` reports 0 failures, with the two fixture arms asserting different reason strings and a trace file that has one line in the first case and none in the second.

### Task 6: Fire the check from /cad-plan on both paths

- **Files:** cadence-core/workflows/plan.md, cadence-core/bin/weight-budgets.json
- **Action:** Add a step to `cadence-core/workflows/plan.md` between the
  `check_size` step and the `count_planned` step - after the plan is on disk and
  before any executor could be dispatched, and ahead of `count_planned` so a
  short lease is caught before the workflow pays a seam call and long before
  `check_gate` pays a `cad-plan-checker` dispatch to review a lease the check
  already knows is short. The step invokes
  `planning.mjs lease-check --phase {N} --plan <k> --plan-time` once per PLAN
  file the phase has, since `--plan` names one plan file.
  It REFUSES, deliberately unlike `plan-size` and `criteria-size` (D-07): state
  in the step that this is not a report and not a `too_big`-style ask, and say
  why - a soft report reproduces exactly the failure this exists against, the
  planner is told and continues, and `.planning/_archive-v3.7.1` records two
  `undeclared-files` refusals on this project committed rather than obeyed. The
  remedy the step prescribes: add each named file to that plan's `files:` list
  and re-run the check until it answers `ok:true`; do not continue to
  `count_planned` or dispatch anything while it refuses. Say the missing files
  out loud with the census each holds, the way `check_size` makes the overrun
  stop being silent.
  Then add ONE sentence to the `inline_plan` step naming this step alongside the
  `count_planned` / `count_committed` pointer that step already carries, for the
  reason that step already states: criterion 2 names `/cad-plan`, not a dispatch
  mode, and leaving the cheap path out would make it the one path with no
  citation data. Do NOT restate the call there - a second spelling is a second
  seam invocation and a second copy that can drift.
  This edit trips the budget: `cadence-core/bin/weight-budgets.json` pins
  `cadence-core/workflows/plan.md` at 29737 and the file is exactly 29,737 bytes
  today, so `self-verify`'s `budget-overrun` arm fires on the first byte added.
  Re-pin that ONE key to the file's new measured UTF-8 byte size in the same
  commit. Do not regenerate the whole budgets file, which would silently re-pin
  unrelated surfaces this plan never touched.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports zero problems - proving both that the new `--plan-time` invocation passes the script-invocation lint and that the re-pinned budget row matches the file. Then three POSITION assertions over `cadence-core/workflows/plan.md`, each falsifiable by line number rather than by presence, because a call written anywhere in the file satisfies a bare `grep -c`: (a) `grep -n` reports the `--plan-time` invocation exactly once and its line number falls strictly between the `<step name="check_size">` line and the `<step name="count_planned">` line, so the step provably sits after the plan is on disk and before any dispatch; (b) `grep -n` inside the new step's own line range finds the words that make it a refusal rather than a report - the remedy sentence naming `files:` and the instruction not to continue while it refuses - and finds no `AskUserQuestion` or `too_big`-style ask; (c) `grep -n` inside the `<step name="inline_plan">` line range finds this step named exactly once and finds no second `--plan-time` command spelling, so the inline path is covered by a pointer and not by a copy.

### Task 7: Re-pin the EXECUTE-10 citation the new arm moved

- **Files:** .planning/DOCS-CLAIMS.md, cadence-core/bin/citation-census.test.mjs
- **Action:** LAST, after tasks 2 and 5 have both landed: their insertions into
  `cadence-core/bin/planning/lease-check.mjs` shift the `undeclared-files` emit
  that `.planning/DOCS-CLAIMS.md`'s `EXECUTE-10` row pins at `331-334` and that
  `citation-census.test.mjs`'s `DOCS_CLAIMS_CITATIONS` table pins with the same
  range and the symbol `'undeclared-files'`. Open the file, find the line range
  that now holds that emit, and update both sides to it - the `line` cell in the
  claim row and the `line`, `start` and `end` fields in the pinned row - leaving
  the `symbol` alone. Sequencing matters and is the reason this is the last
  task: the new range is only knowable after the code that shifted it exists, so
  re-pinning earlier fails against a range that does not yet hold that emit.
  Change no other claim row and no other pinned row.
- **Verify:** `node --test cadence-core/bin/citation-census.test.mjs` reports 0 failures, and `sed -n '<the new start>,<the new end>p' cadence-core/bin/planning/lease-check.mjs` shows the `undeclared-files` emit.

## Notes

- Sequential after plan 1, on two counts: this plan IMPORTS the module plan 1
  creates, and the two plans share THREE declared paths -
  `cadence-core/bin/arg-contract.test.mjs` (plan 1 marks its census site, this
  plan re-pins the count the new flag row moves),
  `cadence-core/bin/trace.test.mjs` (plan 1 marks its census site, this plan
  must declare it because its own edit to `cadence-core/bin/planning/lease-check.mjs`
  lands inside that census's subject) and
  `cadence-core/bin/planning-lease-check.test.mjs` (plan 1 marks its census site
  under row (i), this plan writes every fixture arm into it). `plan-overlap`
  will report all three paths; that is expected and means sequential, not a
  defect.
- This plan is itself one of the plans the new check would refuse. Measured
  2026-08-24 against the registry as plan 1 states it, the declared path
  `cadence-core/bin/planning/lease-check.mjs` intersects the `trace.test.mjs`
  entry's `cadence-core/bin/planning/` subject, so that file is declared above
  even though this plan's edits do not actually move that count. The same is now
  true of row (i): `cadence-core/bin/planning-lease-check.test.mjs` is declared
  above and is the holding file of a census over that same subject pair. That is
  the narrow-subject cost D-03 accepts, paid here rather than argued away.
- All four D-14 exposures are declared: `cadence-core/bin/arg-contract.test.mjs`
  (task 1), `cadence-core/bin/weight-budgets.json` (task 6),
  `.planning/DOCS-CLAIMS.md` and `cadence-core/bin/citation-census.test.mjs`
  (task 7).
