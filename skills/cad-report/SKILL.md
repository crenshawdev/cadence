---
name: cad-report
description: "Render a phase's run record as a receipts narrative - what each dispatch cost, what the gates caught, what got refuted - straight from trace.jsonl and the phase artifacts"
argument-hint: "[phase] [--all]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
---

<objective>
Turn `.planning/trace.jsonl` and a phase's artifacts into the story of what
your tokens bought: every dispatch priced, every gate's outcome named, every
refuted assumption cited. Read-only - it renders the record, it never writes
it. `--all` spans the whole record for a milestone-shaped view.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/report.md
</execution_context>

<process>
Execute end-to-end.
</process>
