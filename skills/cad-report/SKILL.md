---
name: cad-report
description: "Render a phase's run record as a receipts narrative - what each dispatch cost, what the gates caught, what got refuted - straight from trace.jsonl and the phase artifacts"
argument-hint: "[phase] [--all]"
allowed-tools:
  - Read
  - Grep
  - Glob
---

<objective>
Render a phase's run record (`.planning/records/trace.jsonl`) and phase artifacts
as a report; `--all` spans the whole record.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/report.md
</execution_context>

<process>
On an agile project (`.planning/agile/` exists and `.planning/PROJECT.md`
doesn't), stop before anything else, with this line and nothing after it: "This
project is on the agile path. /cad-agile shows what comes next."

Execute end-to-end.
</process>
