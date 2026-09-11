---
name: cad-plan-review
description: "On-demand adversarial plan review of a phase PLAN.md before code - for a hand-written, imported or just-edited plan (/cad-plan fires this itself)"
argument-hint: "[phase number | path/to/PLAN.md]"
allowed-tools:
  - mcp__cadence__cadence_apply
  - mcp__cadence__cadence_query
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
this delegates to native ordinary admission; phase 10 owns settlement.
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

2. **Admit the plan review** through cad-review-delivery, ordinary caller
   manual-plan and trigger plan. Use the binary's configured gate (default
   advisory), retained target and saved routing. Wait for exact raw delivery and
   durable acknowledgment; deferred requires durable enqueue before continuation.

3. **Report** the outcome: for advisory, the findings; for blocking, the
   PASS/FAIL and surviving blocker/high findings; for adjudicated, the grounded
   survivor list. Do NOT auto-apply changes to the plan - present the survivors
   and let the user decide what to fix (the plan-creation flow triages the same
   way).
</process>

<review_delivery>
At the review boundary follow cad-review-delivery for native retained admission, saved dispatch, unchanged raw return and durable acknowledgment. This contract takes precedence over frozen reviewer resolution, writes and lifecycle closes. Keep the remaining specialist/reporting workflow.

@${CLAUDE_PLUGIN_ROOT}/skills/cad-review-delivery/SKILL.md
</review_delivery>
