---
name: cad-mapper-medium
description: The `medium` rung of `cad-mapper` (code map reader); `bin/route.mjs` picks it, not the user.
tools: Read, Bash, Grep, Glob, LSP
disallowedTools: Write, Edit, MultiEdit
color: cyan
effort: medium
maxTurns: 200
skills:
  - cad-mapper-contract
---

Follow the preloaded `cad-mapper-contract` skill exactly - it is your full
contract. This file names that contract and adds nothing else.
