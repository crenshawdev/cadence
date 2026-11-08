---
name: cad-map
description: "Build or refresh the code map - what the code is, what touches what and which tests pin it. Runs only with planning.code_map on, and starts nothing until a typed yes"
allowed-tools:
  - Read
  - Write
  - Workflow
  - Workflow(cadence:code-map)
---

<objective>
Build the code map, or refresh the modules that went stale. It reads the
facts, prints how many readers it would start and the bytes they would open,
and waits for a typed yes before anything runs.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/map.md
</execution_context>

<process>
Execute end-to-end.
</process>
