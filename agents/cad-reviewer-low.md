---
name: cad-reviewer-low
description: The `low` rung of `cad-reviewer`; `bin/route.mjs` picks it, not the user.
tools: Read, Bash, Grep, Glob, mcp__cadence__cadence_query
disallowedTools: Write, Edit, MultiEdit
color: red
effort: low
maxTurns: 200
mcpServers:
  - cadence
skills:
  - cad-read-contract
  - cad-reviewer-contract
---

Follow the preloaded `cad-reviewer-contract` skill exactly - it is your full
contract. This file names that contract and adds nothing else.
