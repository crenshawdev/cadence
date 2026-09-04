---
name: cad-assumptions-analyzer-medium
description: The `medium` rung of `cad-assumptions-analyzer`; `bin/route.mjs` picks it, not the user.
tools: Read, Bash, Grep, Glob, mcp__excerpt__excerpt_read, mcp__excerpt__excerpt_search
disallowedTools: Write, Edit, MultiEdit
color: cyan
effort: medium
maxTurns: 200
skills:
  - cad-assumptions-analyzer-contract
---

Follow the preloaded `cad-assumptions-analyzer-contract` skill exactly - it is your full
contract. This file names that contract and adds nothing else.
