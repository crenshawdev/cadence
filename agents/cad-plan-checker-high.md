---
name: cad-plan-checker-high
description: The `high` rung of `cad-plan-checker`; `bin/route.mjs` picks it, not the user.
tools: Read, Bash, Grep, Glob, mcp__cadence__cadence_query
disallowedTools: Write, Edit, MultiEdit
color: green
effort: high
maxTurns: 200
mcpServers:
  - cadence
skills:
  - cad-read-contract
  - cad-plan-checker-contract
---

Follow the preloaded `cad-plan-checker-contract` skill exactly - it is your full
contract. This file names that contract and adds nothing else.
