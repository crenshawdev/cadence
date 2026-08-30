# Task: the executor's report says what actually happened

Closes GH-231 (S1) and GH-148. Both are the same defect wearing two faces: the
executor's report and digest carry a completion marker the orchestrator parses,
and neither can express two states that really occur.

- **GH-231.** `skills/cad-executor-contract/SKILL.md:237` writes `PLAN COMPLETE`
  after the LAST TASK'S COMMIT, and `:84` runs the project's full suite after
  that. `cadence-core/bin/planning/replay-check.mjs:50,60,62` parses that exact
  string: a report carrying it is dropped from `dispatch_set` and counted toward
  `replay`. So a red final suite - a cross-task regression no per-task gate can
  see - plus a crash or a cleared session leaves durable evidence claiming the
  plan completed, and the next `/cad-execute` reports the phase replayable.
- **GH-148.** The five-field digest has no way to say "I committed nothing
  because the work was already in HEAD". Two real executors hit this and each
  improvised: one returned the PRIOR run's hashes in the field for its own, the
  other rewrote the field to `none new this dispatch (44d9725, 3bc53a7
  pre-existing in HEAD)`. Neither is a value anything parses, and the two
  dispatches charged 30,588 and 24,570 tokens that a cost read over
  `trace.jsonl` counts as execution.

## Task 1 - a green suite completes the plan, not the last commit

**Files:** `skills/cad-executor-contract/SKILL.md`,
`cadence-core/workflows/execute.md`

**Action:**

- `:237`'s rule becomes: the report is `PLAN PARTIAL` after every task commit
  INCLUDING the last. The suite runs next, and only its green result rewrites
  the file `PLAN COMPLETE`. Nothing about writing after every commit changes -
  `:238-240` explains that a timed-out executor returns nothing and the
  orchestrator's timeout branch can only read the FILE, and a `PLAN PARTIAL`
  sitting there during the suite is the correct answer to a timeout, because
  `replay-check` treats it as outstanding and re-dispatches.
- A RED final suite gets a named state and stated authority, which is the whole
  of what `:101`'s "Then return the digest" leaves to improvisation. ONE repair
  round, bounded the way `references/triage-gate.md` bounds a blocking re-arm:
  fix the regression, commit it under the same lease and commit rules, and
  re-run the suite ONCE to confirm. That widens the one-run allowance at `:84`
  by exactly one run and only for confirming a repair - never as a probe, never
  between tasks. Still red after it, or a repair that needs a file outside the
  lease: write `PLAN CHECKPOINT: suite-red` and return the checkpoint digest.
- `suite-red` joins the checkpoint vocabulary at `:193` and `:246`, and
  `<checkpoints>`'s opening list gains the condition, so the type is not a
  fifth value the routing block cannot explain.
- `execute.md`'s `handle_checkpoint` routes it: the report file names the
  failing suite output, and the continuation dispatch carries that path.

**Verification (falsifiable):** `node cadence-core/bin/test.mjs prose` green -
`prose-agreement` and `self-verify` read this tree and the checkpoint
vocabulary appears in both files - and `grep -n 'suite-red'` returns the type in
the contract's two vocabulary lines, its condition list, and execute.md's
routing table. `replay-check` is UNCHANGED and its tests still pass: this task
moves when the string is written, never what the string means.

## Task 2 - the digest can say it committed nothing because the work was there

**Files:** `skills/cad-executor-contract/SKILL.md`,
`cadence-core/workflows/execute.md`

**Action:** `Commits:` gains a THIRD value beside a hash range and `none`:
`none (already applied)`, for a dispatch whose tasks were satisfied in HEAD
before it ran. Not a sixth field - `<report>`'s own rule is that a sixth would
be a value the orchestrator already has, and this one is not a new quantity but
a distinction inside a quantity already reported. `Tasks: {n} of {m}` keeps
counting tasks SATISFIED, which is why it reads `2 of 2` truthfully and
misleadingly at once, and the note saying so goes beside it so the two fields
are read together.

`execute.md`'s return handling reads the value: a `PLAN COMPLETE` carrying it is
still complete - the work IS applied - but the close marks it (task 3) so the
tokens are subtractable rather than indistinguishable.

**Verification (falsifiable):** `grep -n 'already applied'` returns the value in
the contract's `<report>` block, in `<report_file>`'s table, and in execute.md's
complete arm; `node cadence-core/bin/test.mjs prose` green.

## Task 3 - a replay is subtractable from the run record

**Files:** `cadence-core/bin/planning/trace.mjs`,
`cadence-core/bin/lib/arg-contract.mjs`, `cadence-core/bin/lib/trace.mjs`,
`cadence-core/workflows/execute.md`, `cadence-core/bin/trace.test.mjs`,
`cadence-core/bin/arg-contract.test.mjs`

**Action:** `trace close` gains `--replay`, a structured flag that puts
`replay: true` on the `return` event.

It CANNOT ride `--detail`: `planning/trace.mjs:576` infers the close arm from
that flag - `detail.trim() ? 'checkpoint' : 'return'` - so a detail on a
complete return would record a checkpoint, billing a finished dispatch as an
unusable one. `:627` already states the rule this follows: structured, and never
parsed back out of the free-text slot.

`execute.md`'s close line carries it when the digest said `none (already
applied)`. The field rides the event only when true, the shape
`config_warnings` and `redactions` already use, so an ordinary close writes
byte-for-byte the event it wrote before.

**Verification (falsifiable):** a new `trace.test.mjs` arm closes a bracket with
`--replay` and asserts the appended event is `return` (not `checkpoint`) and
carries `replay: true`; a second closes without it and asserts no `replay` key
appears; a third asserts `--replay` with a `--detail` still records a
`checkpoint`, so the two flags do not fight. The arg-contract flag-entry census
is re-pinned in the same commit.

## Gates this task owes

`npx tsc -p tsconfig.ci.json` and `node cadence-core/bin/self-verify.mjs`
alongside the suite - CI runs both as their own jobs and the suite runner
reaches neither, which is how PR #234 went green locally and red on typecheck.
Prose growth in the two workflow files will need its `weight-budgets.json` row
re-pinned.

## Outcome

Both issues closed in two commits.

`c625d9ba` (GH-231, S1): every task report write is `PLAN PARTIAL` now, the last
included, and only a green full suite rewrites the file `PLAN COMPLETE`. A red
suite gets one bounded repair round - fix under the same lease, re-run the suite
once to confirm, which is the only widening of the one-run allowance - and then
`PLAN CHECKPOINT: suite-red`, a new type `execute.md` routes as a continuation
rather than an ask, because its cause is a regression and not a decision.
`replay-check.mjs` is untouched: this moved WHEN the string is written, never
what it means.

`a35478df` (GH-148): `Commits:` gains `none (already applied)`, and `trace close`
gains `--replay` so the bracket is subtractable from a cost read. The flag is
structured rather than a `--detail` note because the close arm infers
`checkpoint` from a non-blank detail, so a replay written there would have
billed a finished dispatch as an unusable one.

**Deviation:** task 2's plan said the report FILE block would carry the new
`Commits:` value too. It does not - that block already has a per-task table with
a `Note` column, which is where both observed executors put the truth, so a
`Commits:` line there would duplicate the table on a file loaded into every
dispatch. The digest carries it; the file's table already did.

Prose grew on two weight-budgeted surfaces and both rows are re-pinned. The
executor contract took +1,719B, which is real cost on a file that rides every
dispatch - it was trimmed twice before re-pinning, and what remains is the state
machine an S1 needed.

`risk-check run` matched nothing on the range, so no `risk_surface` fire.
Full suite 3674 passing, `tsc` clean, `self-verify` ok.
