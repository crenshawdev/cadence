---
phase: 3
plan: 3
requirements:
  - FST-02
  - FST-03
files:
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/workflows/task.md
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/weight-budgets.json
---

# Phase 3: The fast path leaves a record - Plan 3

## Goal

`/cad-task` prices itself and pins what it already guarantees: the run opens and
closes one real trace bracket under a per-run correlation id, it calls the
record writer on both paths and reports where the record landed, and the
risk-surface step that shipped in `v3.5.x` can no longer be removed silently.

## Must be true when done

- A `/cad-task` run writes a phase-0 correlation anchor, one
  `lifecycle/dispatch` for `cad-task` and exactly one `trace close` for it, so
  `trace render --phase 0` shows the bracket paired with `cad-task` in `roles`
  and nothing in `unpaired`; two runs of the same slug produce two paired
  brackets.
- That bracket claims no figure it cannot read: its close carries no `--tokens`
  and no `--turns`, so the role renders with a token `unrecorded` count and no
  turn total at all.
- `cadence-core/bin/trace.test.mjs`'s census admits that close by a STATED
  exception naming the file and the role, and still fails a `--turns`-less close
  anywhere else; `workflows/task.md` joins the census's `BRACKETING` map, so its
  bracket cannot be edited away with the suite green.
- `/cad-task` calls `planning.mjs task-record` on both the inline and the
  planned path, reports the record's path in its `done` block, and withholds
  that report when the seam answers `written: false`.
- `node cadence-core/bin/test.mjs` fails, naming which sentence is missing, when
  either the `risk-check run --phase 0` line or the `written: false` withholding
  sentence is removed from `cadence-core/workflows/task.md`.
- `/cad-task` still buys no phase machinery: no `cad-plan-checker` and no
  `cad-verify` anywhere in `workflows/task.md`, and the two existing
  `/cad-context` mentions - both of which route work OUT to the phase spine -
  are unchanged and still the only two.
- `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
  `problems: []` and `node cadence-core/bin/test.mjs` reports 0 failures.

## Context

Locked by `phases/3/CONTEXT.md`: D-03 puts a REAL bracket on BOTH paths and buys
it with a stated census exception for a coordinator-billed close carrying no
`--turns`; inventing a `--turns` is rejected outright because `lib/trace.mjs`
names a fabricated figure as strictly worse than an absent one. D-04 requires a
per-run correlation anchor, because `correlationId` returns the bare `<phase>`
with no `lifecycle/phase_start` to derive from and all 8 live phase-0 events
carry `corr: "0"` across four dates. D-05 settles close-exactly-once by PROSE
PLACEMENT, since no code can close a bracket the coordinator walked away from.
D-06 puts the FST-02 pin in `prose-agreement.test.mjs`, which already asserts
two of its three parts. D-08 keeps `cad-task` an undeclared role, so no
`workflow.max_dispatch_tokens.cad-task` key is added. D-11: this is new
construction - `task.md` carries exactly one seam invocation today and zero
trace calls. D-12: both re-pins travel in the commits that grow the file.

Depends on plan 1 for the `task-record` subcommand and its `CONTRACTS` row -
without that row, self-verify check 2 files `unknown-subcommand` against this
file's new invocation.

## Tasks

### Task 1: Pin FST-02's shipped bytes before anything edits the file

- **Files:** cadence-core/bin/prose-agreement.test.mjs
- **Action:** Extend the existing assertions rather than adding a test file of
  its own - two of the three facts already live here and a second home for one
  fact is the drift shape `lib/capture-file.mjs`'s header condemns (D-06). The
  test that already asserts `risk-check run` against
  `cadence-core/workflows/task.md` gains an assertion that the file names
  `risk-check run --phase 0`, with a failure message saying that a task's range
  must be recorded against phase 0 because it sits outside the phase spine and 0
  is the one number no roadmap phase carries. Verify in passing that the
  `ENFORCEMENT, task.md` test's two assertions still name their own subject in
  their messages, so the pair satisfies AC4's "the failure message names which
  one is missing" in both directions. Pin the SHIPPED bytes, which are the
  negative form `written: false`, not the ROADMAP's `written: true` wording -
  the shipped sentence withholds done ON a false flag. Add nothing about the
  transient `.diff` rails or the `risk_surface` wiring row: the DFC-04 test
  above already pins those three, and a fourth copy would be the duplication
  this decision exists to avoid. This task lands FIRST in the plan so the two
  `workflows/task.md` edits below run against a file whose FST-02 bytes are
  already held by a check.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` passes.
  Deleting `--phase 0` from the `risk-check run` line in
  `cadence-core/workflows/task.md` makes `node cadence-core/bin/test.mjs` fail
  with a message naming that flag; deleting the `written: false` sentence makes
  it fail with a message naming the withholding; restoring each returns the
  suite to 0 failures. Prove both by editing, running, and reverting - do not
  commit either edit.

### Task 2: The run opens and closes one bracket, and the census watches it

- **Files:** cadence-core/workflows/task.md, cadence-core/bin/trace.test.mjs, cadence-core/bin/weight-budgets.json
- **Action:** Add a bracket step to `workflows/task.md` between `scope` and
  `inline_path`, so the "too big" arm - which says so and stops - never opens a
  bracket it would have to close. The step runs on both work paths and holds
  three things. First, make this run's own directory with `mktemp -d` and mint
  its run token there - `$$-$(date +%s)`, the idiom this file already uses for
  its transient diff and the one `references/conventions.md` requires of a
  scratch path - then record `git rev-parse --short HEAD` as this run's start
  sha and anchor the record with
  `trace append --phase 0 --family lifecycle --event phase_start --sha <the start sha>-<the run token>`,
  the precedent `workflows/execute.md` already sets at its own `phase_start`:
  the correlation id is DERIVED from that value, so without it every phase-0
  event keys to the bare `0` and two runs fund one worker. The TOKEN half is
  what makes the anchor PER-RUN rather than per-commit, and it is the fix for
  the one case the start sha alone does not cover: a run that ends without
  committing leaves HEAD where it was, so a re-run of the same slug from the
  same commit would mint a byte-identical anchor, and `correlationId` returns
  `<phase>-<sha>` with the worker key `corr\0phase\0plan` pairing FIFO - the
  second run's close would then pair against the first run's unclosed dispatch.
  That is exactly the same-slug collision D-04 REJECTED `--plan <slug>` keying
  for, so an anchor that reproduces it does not satisfy D-04. `--sha` is a
  free-form string flag on `trace append`
  (`cadence-core/bin/planning.mjs:3747` lists it among `TRACE_STRING_FLAGS`,
  and nothing validates it as hex), so carrying the token in it costs no seam
  change. Say in the step that the START SHA ALONE - not the anchor value - is
  what the `risk_check` step's `--base` and task 3's `--base` want, so the two
  are named apart and the sha is still measured once; change no byte of the
  `risk_check` step. Second, write
  the paths this task will open into a file inside that directory, and open the bracket with
  `trace append --phase 0 --family lifecycle --event dispatch --plan <the task's
  slug> --role cad-task --read-file <that file>`. The read-set rides a path and
  not an inline `--read` because it is caller-derived text and
  `references/conventions.md` binds that to a file transport; `--read-file` is
  the spelling `workflows/decision-review.md` and `workflows/minimalism-review.md`
  already use for the same flag. Third, state where the close lives. There must
  be EXACTLY ONE `trace close` line in this file - the census asserts closes
  equal dispatches, and two closes on one moment append a duplicate terminal
  that funds a dispatch twice or strands the next worker - so put
  `trace close --phase 0 --plan <the task's slug> --role cad-task` in the `done`
  step, with an optional `--detail-file <path>` naming why on a run that ends
  without reporting done, and state that every path which terminates the run
  after the bracket opened routes through that one line: a blocking
  `risk_surface` FAIL that survives its one narrowed re-arm included. State the
  two figures the close does NOT carry and why: `--tokens` and `--turns` are
  read off a SUBAGENT's return and this bracket bills the coordinator, which has
  no return to read, so the role renders `unrecorded` rather than claiming a
  number - a fabricated figure lands in `trace suggest`'s share denominator. In
  the same commit, edit `cadence-core/bin/trace.test.mjs`: the census's
  per-close `--turns` assertion gains a stated exception keyed on the file AND
  the role, admitting a coordinator-billed `cad-task` close in
  `cadence-core/workflows/task.md` and nothing else, with a comment saying why a
  coordinator has no figure to report; make the exception self-limiting by
  asserting that an exempted close carries no `--tokens` either, the way the
  `COORDINATOR` marker block below it already does; and update the assertion
  message that currently says all ten close sites carry the flag so it names the
  exception instead of a count it no longer describes. Add
  `cadence-core/workflows/task.md` to the `BRACKETING` map with one dispatch
  moment - the map's own comment says a file absent from it is checked by
  nothing, and the bracket prose is exactly what it exists to pin (CONTEXT
  flagged assumption). All three edits are one commit: the census refuses a
  `--turns`-less close, so landing the prose without the exception reddens the
  suite, and landing `BRACKETING` without the prose fails its dispatch floor.
  Re-pin `weight-budgets.json`'s `cadence-core/workflows/task.md` row to the
  measured size in the same commit - the file sits exactly at 7822 B today and
  `self-verify` files `budget-overrun` on any growth.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` passes and
  `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
  `problems: []`. `grep -c 'trace close' cadence-core/workflows/task.md` returns
  1 and `grep -c 'event dispatch' cadence-core/workflows/task.md` returns 1.
  Temporarily dropping `--turns` from another file's close - for example
  `cadence-core/workflows/execute.md`'s - still fails the census, proving the
  exception did not widen; revert it. Temporarily removing the
  `--event dispatch` line from `task.md` fails the `BRACKETING` floor by name;
  revert it. `grep -n 'cad-plan-checker\|cad-verify' cadence-core/workflows/task.md`
  returns nothing and `grep -c 'cad-context' cadence-core/workflows/task.md`
  returns 2.

### Task 3: The run writes its record and says where it landed

- **Files:** cadence-core/workflows/task.md, cadence-core/bin/weight-budgets.json
- **Action:** Add a record step to `workflows/task.md` after `risk_check` and
  before `done`, calling
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" task-record
  --slug <the task's slug> --base <this run's start sha> --head HEAD
  --text-file <path>` on BOTH the inline and the planned path - the fast path is
  where the majority of real commits land and the hole in the corpus is
  precisely there. The prose the record indexes is caller-derived, so it rides
  `--text-file` written into this run's own directory, never an inline
  `--text "..."`, for the reason `references/conventions.md` states once. State
  that the seam creates the slug directory under an EXISTING `.planning/` and
  creates NOTHING where `.planning/` is absent, answering `written: false` with
  a reason instead - so an inline task in a repository with no planning tree
  still writes no scaffolding, which is what this workflow's success criterion
  actually protects. Then extend the `done` block to report the record's path
  from the envelope, and withhold that line on `written: false` by stating the
  reason instead - the same discipline the `risk_check` step already applies to
  its own flag, and the reason a record that never landed must not read as one
  that did. In the same edit, reword the success criterion `Zero planning
  artifacts for inline tasks; at most PLAN.md for planned ones` to what it now
  protects: no PLAN.md and no SUMMARY.md for an inline task, and no `.planning/`
  tree created where none exists. That reword is the CONTEXT's user-confirmed
  reading of the one place the ROADMAP entry and D-01 cannot both hold as
  written; leave every other success-criterion line alone. Re-pin
  `weight-budgets.json`'s `cadence-core/workflows/task.md` row again in this
  commit.
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
  with `problems: []` - which is what proves the new invocation's subcommand and
  every flag on it are declared in `CONTRACTS` and that the file is back inside
  its budget - and `node cadence-core/bin/test.mjs` reports 0 failures.
  `grep -n 'task-record' cadence-core/workflows/task.md` shows the invocation
  and `grep -n 'written: false' cadence-core/workflows/task.md` shows the
  withholding stated for both the risk record and the task record.
  `grep -n 'Zero planning artifacts' cadence-core/workflows/task.md` returns
  nothing and the criteria list still has four items.

### Task 4: The bracket, proved on a real run

- **Files:** cadence-core/workflows/task.md
- **Action:** Nothing in this task is a new mechanism: it is the walk that
  proves the prose the two tasks above wrote actually produces a paired bracket
  and a record, and the one place `workflows/task.md` is corrected if it does
  not. Run the bracket, record and close lines by hand against this repository
  in the order the workflow states them, using a throwaway slug and a range this
  repository already has, and read `trace render --phase 0` back. If the bracket
  does not pair, or two runs of one slug collide into one, or the role does not
  appear, the defect is in the prose's ordering or in a flag it names, and this
  task fixes that prose - it never adds a flag the seam does not declare and
  never invents a figure to make a total look complete. AC7's end-to-end
  `/cad-task` session is a human check and is not this task; this is the
  mechanical half a session cannot be asked to discover.
- **Verify:** After running the anchor, dispatch and close lines twice with one
  slug AND FROM ONE UNCHANGED HEAD, `node cadence-core/bin/planning.mjs trace
  render --phase 0` shows two entries in `brackets` for that slug, an empty
  `unpaired`, a `roles` block whose `cad-task` row carries `dispatches: 2` and
  `unrecorded: 2` and NO `tokens` and NO `turns` key, and the six events carry
  exactly TWO DISTINCT correlation ids, three to a run, neither of them the bare
  `0` - read them off the rendered events and assert the inequality, because an
  id that is merely non-`0` is what a per-COMMIT anchor also produces and the
  same-HEAD re-run is the one case this check exists to catch. Then run the
  third proof: repeat the two runs but OMIT the first run's close, and confirm
  the second run's close pairs with the second run's own dispatch, leaving
  exactly one `unpaired` dispatch from run one rather than a mis-funded pair.
  `node cadence-core/bin/planning.mjs risk-check status --phase 0`
  is unaffected by the new events.

## Notes

- Runs after plan 1 (the `task-record` subcommand and its `CONTRACTS` row).
  Independent of plan 2 - no file is shared with it - so the two may run in
  either order once plan 1 has landed.
- **AC3's third clause, read literally, contradicts its first.** "That arm's
  trace holds zero `lifecycle/dispatch` events" cannot hold beside "shows the
  run's bracket paired ... with `cad-task` in the `roles` block": `renderTrace`
  pairs a terminal only against a `dispatch`, and a role row is created only by
  a dispatch or by a figure on a terminal, so an inline arm with zero dispatch
  events has no bracket and no role at all. D-03 is a durable decision and says
  a REAL bracket opens on both paths, so it wins. The clause is delivered as
  what it was reaching for and as ROADMAP criterion 5 states it: no dispatch
  event on the inline arm names any role but `cad-task`, because the record
  costs no subagent there.
- **AC5's grep, read literally, already fails against the shipped file.**
  `cadence-core/workflows/task.md` names `/cad-context` twice today - at the
  `scope` step's "This is phase-sized. Route it through /cad-context -> /cad-plan"
  and in the guardrail about a task that outgrows its lane - and both sentences
  route work OUT to the phase spine, which is the opposite of adding a context
  step to `/cad-task`. Delivered as: `cad-plan-checker` and `cad-verify` appear
  nowhere, and the `cad-context` count stays at exactly 2 with both sentences
  byte-identical.
- **The `--turns` census exception is scoped to a file and a role on purpose.**
  D-03 keeps `--turns` mandatory wherever a subagent returned, and the planned
  path's `cad-executor` exception still dispatches one; this phase does not
  bracket that subagent, so nothing here relaxes the rule for it.
