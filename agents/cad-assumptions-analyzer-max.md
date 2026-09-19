---
name: cad-assumptions-analyzer-max
description: The `max` rung of `cad-assumptions-analyzer`; `bin/route.mjs` picks it, not the user.
tools: Bash, mcp__cadence__cadence_query
disallowedTools: Write, Edit, MultiEdit
color: cyan
effort: max
maxTurns: 200
mcpServers:
  - cadence
skills:
  - cad-read-contract
  - cad-assumptions-analyzer-contract
---

Follow the preloaded `cad-assumptions-analyzer-contract` skill exactly - it is your full
contract. This file names that contract and adds nothing else.
