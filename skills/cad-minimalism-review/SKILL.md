---
name: cad-minimalism-review
description: "Ranked delete-list over code that works and should not exist - reinvented stdlib, one-implementation abstractions, dead flexibility, config nobody sets"
argument-hint: "[path | directory | phase number]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---

<objective>
Ask whether the code the user names needs to exist, rather than whether it
works. The capability lives entirely in
cadence-core/workflows/minimalism-review.md: the base `cad-reviewer` is
dispatched with a minimalism instruction that retargets its subject off
correctness and onto four species of over-building - reinvented standard library
or dependency, an abstraction with one implementation, dead flexibility nothing
exercises, and config nobody sets - and the list comes back in the review
subsystem's shared findings schema, with `severity` carrying the rank.

This pass APPLIES NOTHING. The delete-list is input to the user's decision: no
file is edited, deleted, staged or committed, and there is no fix arm to skip.
It is a manual, on-demand entry point only - it never auto-fires, and there is
no wiring, no gate and no verdict behind it, because a delete-list cannot PASS
or FAIL anything.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/minimalism-review.md
</execution_context>

<process>
1. **Resolve the target** from `$ARGUMENTS` - a path, a directory, or a phase
   number whose committed range is the target. If `$ARGUMENTS` is empty or
   resolves to more than one of those, ask once (ask-user seam). A target that
   does not resolve STOPS the run rather than widening to its parent.

2. **Run the workflow** end-to-end: bracket and dispatch the one `cad-reviewer`
   worker at the session default, then close its bracket the moment the findings
   are in hand - as a checkpoint when the dispatch came back unusable, which
   reports NO list rather than an empty one.

3. **Present** the delete-list ranked by `severity`, each entry carrying the
   reviewer's own `file`, `line`, `claim` and `failure_scenario` unedited; a
   clean sweep is reported as a result naming the target that was read, never as
   a bare "no findings". Do NOT delete, edit or apply any of it - the user
   decides what goes and does it themselves.
</process>
