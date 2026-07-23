---
name: cad-decision-review
description: "On-demand adversarial refute-then-adjudicate pass over one load-bearing decision - a CONTEXT.md D-NN line or a PROJECT.md Key Decisions row - grounded against Context7 and the codebase. Per-objection survives/partial/refuted ruling plus an amendment list; never auto-fires"
argument-hint: "[path/to/decision doc]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
  - mcp__context7__resolve-library-id
  - mcp__context7__query-docs
---

<objective>
Stress-test ONE decision the user names, rather than take it on faith. The
review capability lives entirely in cadence-core/workflows/decision-review.md:
`cad-reviewer` (and, when configured, a cross-model provider) refutes the
decision through the review subsystem's reviewer resolution; the main model
then grounds each objection against Context7 (library/API claims) and the
real codebase (factual claims) and rules it `survives | partial | refuted`
with a concrete amendment where the decision needs one.

This is a manual, on-demand entry point only - it never auto-fires and there
is no review-trigger wiring for it. Durability (cad-context's `## Durable
decisions` filter) names candidates worth this deeper pass; picking one and
invoking this skill is the user's call, not a mechanical handoff.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/decision-review.md
</execution_context>

<process>
1. **Resolve the target** from `$ARGUMENTS` - a path to a CONTEXT.md (naming
   which `- D-NN (...)` line) or a PROJECT.md (naming which Key Decisions
   row). If `$ARGUMENTS` is empty or ambiguous, ask (ask-user seam) for the
   path and the specific decision.

2. **Run the workflow** end-to-end: refute (the review subsystem's reviewer
   resolution), then adjudicate (Context7 + codebase grounding, per-objection
   ruling and amendments), then the qualitative cost report.

3. **Present** the per-objection rulings, groundings, and amendments, plus
   which providers/models/tier/effort ran. Do NOT auto-apply any amendment -
   this is a review, not an edit; the user decides what to change and does it
   themselves.
</process>
