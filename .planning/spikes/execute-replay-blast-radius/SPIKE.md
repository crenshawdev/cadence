# Spike: what does a re-dispatched, already-committed plan do to the code?

**Status:** closed 2026-08-26. Verdict: validated - the window is real and the
blast radius is noisy. GH-137 wants a guard, not a resume path.

## Question

When `/cad-execute <N>` re-dispatches a plan whose tasks are already implemented
and committed, what happens to the already-applied edits: noisy no-op work, or
duplicated / destructive rewrites?

## Decision that hinges on it

GH-137's remedy. The issue explicitly refuses to assert its own blast radius.
- Noisy -> the fix is a GUARD: teach the derivation (or execute's stop step) to
  notice committed work without a `SUMMARY.md` and refuse.
- Destructive -> a guard is not enough. The fix is a RESUME PATH: the executor
  has to be told which tasks already landed and start after them.

Those are different sizes of work, so the answer decides the phase.

## Why the question exists

`cadence-core/bin/planning/core.mjs:200-203` derives status from
`SUMMARY.md`'s existence alone; committed work moves nothing. A session that
dies between the last task's commit and the summary write leaves the phase
`planned` with real commits on the branch, and `execute.md:31` only stops on
`executed` / `complete`. Neither `workflows/execute.md` nor
`skills/cad-executor-contract/SKILL.md` contains any handling for "this task's
change is already present" - greps for `already` / `idempot` /
`nothing to commit` return nothing relevant in either file.

## Criteria, risk-first

Ordered for fastest disproof. Stop the moment one invalidates.

### C1 - Is the window real? (precondition, cheap)

Given a throwaway project whose phase 1 has `PLAN.md`, its tasks' changes
committed, and no `SUMMARY.md`, when `planning.mjs status` runs, then a derived
status of `planned` -> the window is real, continue to C2. Any other status ->
**invalidated at the premise**: the issue misreads the code and no fix is owed.

### C2 - What does a real executor do to committed work? (decides the fix)

Given that phase, when one real `cad-executor` is dispatched on `PLAN.md`
exactly as `execute.md`'s sequential path dispatches it, then compare the
worktree and the log against the pre-dispatch state:

- **Noisy** -> every file the plan touches is byte-identical to its
  pre-dispatch content AND no commit lands that rewrites them (a zero-commit
  return, a `blocked` checkpoint, or a report-only commit all count). Guard is
  sufficient.
- **Destructive** -> any tracked file's content differs from pre-dispatch, or a
  commit lands that re-applies / conflicts with the existing work. Resume path
  required.

### C3 - Does the return lie? (only if C2 is noisy)

Given a noisy C2, when the executor's digest is read, then a return that
distinguishes "already done" from real work -> the orchestrator can be trusted
to not write a false `SUMMARY.md`. A `PLAN COMPLETE` claiming tasks it did not
commit -> the guard must live BEFORE the dispatch, not after it, because the
summary written from that digest would assert work this run never did.


### C2b - Does "noisy" survive a NON-idempotent task? (added before running, after C2)

C2's plan was two guard clauses: a replayed edit is a no-op because the guard
either is or is not present. That is the easy case, and generalizing from it
would be exactly the overclaim GH-137 refused to make. Given a second probe
whose committed task APPENDS (a changelog row, a version bump - a task whose
second application is visible), when the same dispatch is replayed, then the
appended content appearing twice, or a commit landing that re-applies it ->
**destructive**, and C2's reading is overturned. Content unchanged and no new
commit -> **noisy** stands as the general answer.

## Observations

Throwaway probes, both under
`/tmp/claude-1000/-code-cadence/4a3cb8b1-8421-4c10-a637-844f2482b2a2/scratchpad/`
(`replay-probe`, `replay-probe2`), discarded with the scratchpad. Each is a git
repo with a `.planning/`, a two-task `PLAN.md`, both tasks implemented and
committed atomically under scope `1-1`, the dead run's `reports/plan-1.md` on
disk untracked, and no `SUMMARY.md` - the exact state GH-137 describes.

### C1 - the window is real. Validated.

`planning.mjs status` in the probe answers, with both task commits on the
branch:

```
{"ok":true,"current":1,"total":1,
 "phases":[{"n":1,"name":"Guard the helpers","status":"planned"}],
 "cursor":{"phase":1,"status":"planned","next":"/cad-execute 1","agrees":true}}
```

`planned`, so `execute.md:31` (which stops only on `executed` / `complete`)
does not fire and the run proceeds to dispatch. The cursor `agrees`, so the
disagreement check catches nothing either. Reproduced identically in the second
probe.

### C2 - noisy, not destructive. One real `cad-executor`, dispatched exactly as `execute.md`'s sequential path dispatches it.

Against the pre-dispatch snapshot:

- `HEAD` unchanged (`1cfa3047`), `git log --oneline` byte-identical.
- Every source file byte-identical by `sha256sum`. Nothing was re-applied,
  reverted, or rewritten.
- The only filesystem change is the contract's own `<report_file>` rotation:
  the dead run's `reports/plan-1.md` preserved as `plan-1.1.md`, a new
  `plan-1.md` written.
- Cost: 30,588 tokens, 13 tool calls, 166 s.

The executor opened each task's files, found the change already present, and
declined to redo it. It did not stop at the discovery - it re-verified: it ran
both task `Verify:` commands, and stripped each guard in a copy OUTSIDE the repo
to confirm the tests were load-bearing rather than vacuous. It also refuted one
plan-level criterion (`node --test src/` cannot be green on Node v26.7.0, which
resolves a bare directory as a module entry point), and left it alone because
the fix needs a file outside the plan's declared lease.

Nothing in `skills/cad-executor-contract/SKILL.md` or `workflows/execute.md`
asked for any of that - greps for `already`, `idempot`, `nothing to commit`
return nothing relevant in either file. The good behavior is the model's
diligence at this rung, not a guarantee the contract makes. See C2b.

### C2b - noisy holds for a non-idempotent task, but not for the reason C2 suggested.

Second probe, `replay-probe2`: a release cut. Task 1 writes `0.2.0` into
`VERSION`; Task 2 INSERTS a `## v0.2.0` section into `CHANGELOG.md`. A literal
re-application of Task 2 appends a second section - visible, and the case C2
could not see.

Against the pre-dispatch snapshot: `HEAD` unchanged (`3bc53a7`), log
byte-identical, `CHANGELOG.md` byte-identical, `grep -c '^## v0.2.0'` still `1`,
`VERSION` still `0.2.0`. Only the report rotation again. 24,570 tokens, 11 tool
calls, 84 s.

**What actually stopped the duplicate.** The executor's own words: re-running
Task 2 as written "would have appended a second `## v0.2.0` section and violated
the plan's own 'Must be true when done' (exactly one such heading)". It was
caught by the PLAN's end-state criterion, not by anything in the contract and
not by any awareness that this was a replay at dispatch time.

That is the load-bearing qualifier on the whole spike. Replay is safe to the
extent a plan's `Verify:` and `## Must be true when done` are written as
END-STATE assertions ("exactly one heading", "cat VERSION prints 0.2.0") rather
than as actions ("append a row"). Both probes' plans happened to be written that
way, because `references/` teaches criteria in that shape. A plan whose criteria
assert only that an action was performed has nothing to catch the second
application, and the contract would not catch it either. Noisy is the measured
answer for well-formed plans; it is not a property of the execute path.

### C3 - the digest cannot tell the orchestrator this was a replay.

The five-field return was:

```
PLAN COMPLETE
Tasks: 2 of 2
Commits: 32e958c..1cfa304
Deviations: 1
Open items: 4
```

Those two hashes are the PRIOR run's commits. A `PLAN COMPLETE` naming a commit
range it did not create is indistinguishable, in the digest alone, from a run
that did the work - and the digest is what the orchestrator brackets, traces and
counts.

The report FILE was honest where the digest could not be: both rows read
`Replay: already committed by the prior run, not redone`, and an open item
states `No new commits this dispatch`. So a `SUMMARY.md` written from the file
would carry the truth. But the report's shape is fixed by the contract and has
no field for "this was a replay" - the honesty rode in a free-text Note column
because this executor chose to put it there. The trace record gets nothing at
all: a full dispatch bracket with 30,588 tokens against a run that produced no
work, indistinguishable from a real one.

## Verdict

**validated** - the window is real (C1) and the blast radius is NOISY, not
destructive, under both an idempotent plan (C2) and a non-idempotent one (C2b).
Two real executor dispatches against already-committed work produced zero
commits and zero byte changes to any source file.

GH-137's remedy is therefore a **guard**, not a resume path. The executor
already resumes correctly on its own: it detects applied work per task, declines
to redo it, re-verifies rather than trusting, and would extend naturally to a
PARTIAL crash by simply executing the tasks that have not landed. Building a
"start after task k" mechanism would be building something the measured behavior
already provides.

**What the bug actually costs, since it is not the code.** Two things, and
neither is a corrupted worktree:

1. **Money.** 30,588 and 24,570 tokens for two dispatches that produced nothing.
   A real phase is larger.
2. **A false record.** The digest returns `PLAN COMPLETE` naming a commit range
   this run did not create, and the trace stores a full dispatch bracket
   indistinguishable from a real one. A `SUMMARY.md` written from it asserts
   this run did the work.

Worth putting to the label: `sev/S1-blocker` reads "a user's run breaks or
silently produces a wrong result". The run does not break and the code is not
wrong - the RECORD is, and the user pays for a no-op. That is closer to
`sev/S2-real`. The severity call is John's; this spike only supplies the
measurement it was missing.

**One limit, stated rather than papered over.** Two probes, two-task plans, one
model rung, tasks fully committed. The PARTIAL case (some tasks committed, some
not) was not run - it is the case the executor should handle best, but "should"
is not "measured".

## Recommendation for the plan

1. **Guard before the dispatch, in `execute.md`'s `locate` step.** The evidence
   is already on disk and already free: a dead run leaves
   `.planning/phases/<N>/reports/plan-<k>.md` reading `PLAN COMPLETE`, which
   both probes had. Stop when a `planned` phase has a report file claiming
   completion, and say what to do (`/cad-undo <N>`, or write the SUMMARY).
   `derivePhases` at `bin/planning/core.mjs:191-206` is pure over the
   filesystem, so the report file is legible to it - but minting a new derived
   status there touches `status`, `audit`, `phase-done` and the cursor at once,
   and that is a plan-level decision this spike does not make. Guarding in
   `execute.md` alone is the smaller change and covers the reported bug.
2. **Do not build a resume path.** C2 and C2b measured the behavior it would
   duplicate.
3. **Give the digest somewhere to say it.** `<report>`'s five fields cannot
   express "no new commits"; both executors said it anyway, one in a Note
   column, one by improvising the `Commits:` field into
   `none new this dispatch (... pre-existing in HEAD)`. Neither is a field the
   orchestrator can read. This is a second, smaller issue than GH-137 and
   should be filed as one rather than folded in.
4. **Write plan criteria as end-state assertions.** C2b shows this is what makes
   a replay safe. `references/` already teaches it; worth an explicit line in
   the planner contract that a criterion asserting an ACTION rather than an
   END STATE is what makes a plan unsafe to re-run.

## Throwaway code

`replay-probe` and `replay-probe2` under this session's scratchpad. Not project
source; discarded with the scratchpad. Nothing was written into `cadence-core/`.
