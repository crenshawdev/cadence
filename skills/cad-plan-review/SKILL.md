---
name: cad-plan-review
description: "On-demand adversarial review of a phase PLAN before code, through the review subsystem's plan trigger. For a hand-written, imported, or just-edited plan - /cad-plan already fires this automatically when it writes one"
argument-hint: "[phase number | path/to/PLAN.md]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---

<objective>
Manually run the review subsystem's `plan` trigger against a chosen plan. The
review capability lives entirely in the subsystem (references/review-triggers.md);
this skill is just the on-demand entry
point for cases the automatic review does not cover - a plan written by hand,
imported from elsewhere, or edited after its first review. When /cad-plan
writes a plan it already fires this trigger, so you do not need this skill in the
normal flow.

There is no separate reviewer here and no convergence loop (cut in DESIGN §6):
this delegates to `fire(plan)`, which grounds and adjudicates once.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/references/review-triggers.md
</execution_context>

<process>
1. **Resolve the target plan** from `$ARGUMENTS`:
   - a number `N` -> `.planning/phases/<N>/PLAN*.md` (all slices of that phase).
   - a path -> that file.
   - empty -> the current phase from the STATE.md cursor; if that is ambiguous,
     ask (ask-user seam) which phase.
   If no plan file is found, report it and stop - there is nothing to review.
   (Resolve the plan path and, for the empty-args case, the cursor read as one
   batched step - independent; conventions.md Parallel work.)

2. **Fire the `plan` trigger** per references/review-triggers.md with the
   resolved PLAN file(s) as the artifact. Honor `review.triggers.plan` (gate,
   tier, effort); default gate is adjudicated. This resolves the reviewer set
   (claude-subagent and/or a configured cross-model reviewer), runs them, and -
   for an adjudicated gate - grounds each finding against the real repo, kills
   false positives, and merges convergent findings.

3. **Report** the outcome: for advisory, the findings; for blocking, the
   PASS/FAIL and surviving blocker/high findings; for adjudicated, the grounded
   survivor list. Do NOT auto-apply changes to the plan - present the survivors
   and let the user decide what to fix (this is a manual review, not the
   plan-creation flow where cad-plan applies them).
</process>
