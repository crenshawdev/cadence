# Roadmap: v3.7.9 - progress not perfection

## Overview

**`v3.7.9`, opened 2026-08-31.** The source is the open tracker after the
v3.7.8 close: nine `S2-real` issues, minus the two closed as tasks and merged in
`#235` (`GH-231`, the plan marked complete before the suite ran, and `GH-148`,
the digest that could not say a dispatch committed nothing).

**The thread.** Cadence names a next step and the step is wrong. Not missing,
not unimplemented - named, printed, and either unreachable or not the work that
is actually outstanding. `/cad-task` classifies a task as phase-sized and sends
you to `/cad-phase add` in a repository that may have no roadmap to add to,
after making you answer branch questions for work it was never going to do.
`/cad-progress` re-derives `executed` from a SUMMARY on disk and routes to
`/cad-verify` while a gap plan sits unexecuted beside it, because it never
learned the fact `/cad-execute` already asks the replay seam for. And three
shipped documents, one of them riding every session's prompt, promise an
auto-resume that `progress.md:236` exists to refuse.

**What is broken.**

`cadence-core/workflows/task.md:21` runs the protected-branch guard "before any
work", and the `scope` step that decides inline / planned / too-big does not run
until `:26`. Classification reads the task description and nothing else, so the
guard is charging an engineer branch questions for work that stops one step
later. The same file's `:37` then takes `total + 1` off `planning.mjs status`
unconditionally, in a workflow that says four separate times it supports a
repository with no `.planning/` tree at all.

`cadence-core/workflows/progress.md:23-24` derives **executed** from the
presence of a SUMMARY, and `:188` routes every executed phase to `/cad-verify`.
The string `replay-check` appears nowhere in that file, while
`cadence-core/workflows/execute.md:56,66,74` reads `dispatch_set` off that
exact seam to decide what is still outstanding. `/cad-plan --gaps` writes a
plan, sets the cursor to `planned`, and a cleared session between that command
and `/cad-execute` loses the plan to progress's own re-derivation.

`README.md:49`, `skills/cad-progress/SKILL.md:3` and
`cadence-core/workflows/progress.md:6` all claim auto-resume. The routing is
derived automatically; the invocation is deliberately not. The docs name the
half that is manual.

**The standard.** Would a user on their own project feel it. All three would.
The `/cad-task` dead end fires on any repository without a planning tree, which
is the case that command exists to serve. The gap-plan skip fires on the
healthy verify -> gap -> plan -> execute loop, at the handoff a cleared session
is most likely to land on. The doc claim rides every session's prompt.

**Out of scope, deliberately.** The receipts cluster (`GH-226`, `GH-227`,
`GH-220`, `GH-221`, `GH-228`) and the unresolved-input guards (`GH-229`,
`GH-202`, `GH-196`) are real and stay open. They are a different thread and
mostly bite Cadence-on-Cadence; naming them here would make this cycle a queue
rather than a theme.

## Open Questions

- **OQ-1 - where progress learns about outstanding work.** `GH-232` names two
  fixes and prefers the first: `planning.mjs status` exposes the outstanding
  executable plan set, so progress reads it off the envelope it already fetches,
  and every other consumer of `status` sees it too. The alternative is
  `progress.md` consulting `replay-check` itself before routing an executed
  phase. Either way the derived-status table stops treating "has a SUMMARY" as
  "has nothing left to run", and that is the part that is not optional.

## Phases

- [ ] **Phase 1: The next step it names is one you can take** - the three sites where Cadence prints a next action that is unreachable, stale, or not the outstanding work
  - Requirements: `PHS-03`, `RTE-01`, `DOC-05`

## Phase Details

### Phase 1: The next step it names is one you can take

Close the three routing defects together, because they are one claim: the
command that tells you where to go next must name something you can actually
do.

`/cad-task` classifies before it guards, and its phase-sized arm stops assuming
a planning tree. Classification costs a read of the task description, so it
runs first and the protected-branch and integration-branch guards move onto the
inline and planned arms only - which is where `task.md:48` already puts the
trace bracket, for the same reason. The arm's route then branches on what is
actually on disk: an initialised project goes to `/cad-phase add`, existing code
with no `.planning/` goes to `/cad-adopt`, and a blank repository goes to
`/cad-new-project`.

`/cad-progress` stops reading a SUMMARY as the end of the work. It gets the
outstanding executable plan set from the seam rather than inferring absence, and
an executed phase with outstanding dispatches routes to `/cad-execute`, not
`/cad-verify`. OQ-1 decides whether that fact arrives through `status` or
through a direct `replay-check` call; the routing change is the same either way.

The three auto-resume claims get restated as what the command does: finds
incomplete work and offers to resume it. No behaviour changes. A real
`--resume` flag is a separate decision and is not this phase.

**Success criteria**

- A `/cad-task` invocation that classifies as phase-sized asks no
  protected-branch or integration-branch question before it stops.
- `/cad-task`'s phase-sized arm, run in a repository with no `.planning/`
  directory, routes to `/cad-adopt` or `/cad-new-project` and never to
  `/cad-phase add`.
- With a `/cad-plan --gaps` plan unexecuted beside an existing SUMMARY,
  `/cad-progress` routes to `/cad-execute N`. A test pins this against a
  fixture, so the case survives a future re-derivation.
- A phase whose outstanding dispatch set is empty still routes to
  `/cad-verify N` - the fix narrows the executed row, it does not invert it.
- `README.md:49`, `skills/cad-progress/SKILL.md:3` and
  `cadence-core/workflows/progress.md:6` describe an offer, not an auto-resume,
  and the SKILL.md byte pin in `weight-budgets.json` is re-pinned in the same
  commit.
- `GH-233`, `GH-232` and `GH-218` each trace to a REQUIREMENTS row pointing at
  Phase 1.
