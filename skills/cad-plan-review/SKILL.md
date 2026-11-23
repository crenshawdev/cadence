---
name: cad-plan-review
description: "On-demand adversarial plan review of a phase PLAN.md before code - for a hand-written, imported or just-edited plan (/cad-plan fires this itself)"
argument-hint: "[phase number | path/to/PLAN.md]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Task
  - AskUserQuestion
  - PushNotification
  - Workflow
  - Workflow(cadence:review-panel)
---

<objective>
Run the review subsystem's `plan` trigger on demand against a chosen plan the
automatic review does not cover: one written by hand, imported from elsewhere,
or edited after its first review. When /cad-plan writes a plan it fires this
trigger itself.

There is no separate reviewer here and no convergence loop: this delegates to
`fire(plan)` once, and the resolved gate decides what happens to the findings.
</objective>

<process>
1. **Resolve the target plan** from `$ARGUMENTS`:
   - a number `N` -> `.planning/phases/<N>/PLAN*.md` (all slices of that phase).
   - a path -> that file.
   - empty -> the current phase from the STATE.md cursor; if that is ambiguous,
     ask (ask-user seam) which phase.
   If no plan file is found, report it and stop - there is nothing to review.
   (Resolve the plan path and, for the empty-args case, the cursor read as one
   batched step - independent; conventions.md Parallel work.)

2. **Fire the `plan` trigger** with the resolved PLAN file(s) as the artifact -
   Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/review-triggers.md` here,
   not preloaded (one site). Honor `review.triggers.plan.gate`
   (default advisory) always; its `tier` and `effort` reach cross-model
   reviewers only. This resolves the reviewer set
   (claude-subagent and/or a configured cross-model reviewer), runs them, and -
   for an adjudicated gate - grounds each finding against the real repo, kills
   false positives, and merges convergent findings. On the workflow path a fire
   over more than one PLAN file runs one reviewer per plan and one cross-plan
   reviewer, and today's path one reviewer over all of them; a single PLAN path
   gets one reviewer.

3. **Report** the outcome: for advisory, the findings; for blocking, the
   PASS/FAIL and surviving blocker/high findings; for adjudicated, the grounded
   survivor list. Do NOT auto-apply changes to the plan - present the survivors
   and let the user decide what to fix (the plan-creation flow triages the same
   way).

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
