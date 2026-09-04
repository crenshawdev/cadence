---
name: cad-assumptions-analyzer
description: The `xhigh` rung of `cad-assumptions-analyzer` (codebase assumption gathering); `bin/route.mjs` picks it, not the user.
tools: Read, Bash, Grep, Glob, mcp__excerpt__excerpt_read, mcp__excerpt__excerpt_search
disallowedTools: Write, Edit, MultiEdit
color: cyan
effort: xhigh
maxTurns: 200
skills:
  - cad-assumptions-analyzer-contract
---

Follow the preloaded `cad-assumptions-analyzer-contract` skill exactly - it is your full
contract. This file names that contract and adds nothing else.
