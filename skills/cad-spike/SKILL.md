---
name: cad-spike
description: "Time-boxed experiment to resolve a specific unknown before betting on it - falsifiable Given/When/Then criteria tested risk-first (fail fast), a clear validated | invalidated | inconclusive verdict, throwaway code. One slim SPIKE.md, not a five-artifact wrap-up"
argument-hint: "<the question or hypothesis to resolve>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
---

<objective>
Answer one unknown with evidence before a plan commits to it - "will this
approach work", "is this library fast enough", "does this API do what we need".
The discipline is what makes it useful: falsifiable criteria written BEFORE the
experiment, the riskiest assumption tested first so a dead end dies fast, and an
honest verdict. The code is throwaway; the SPIKE.md verdict is the deliverable.
</objective>

<execution_context>
@$HOME/.claude/cadence-core/workflows/spike.md
</execution_context>

<process>
Run the spike workflow end-to-end. Write the Given/When/Then criteria before
building anything, order them risk-first, and stop the moment a risk-first
criterion invalidates the approach. Never soften an invalidated result into
"inconclusive" to save the idea - a spike that kills a bad approach is a success.
</process>
