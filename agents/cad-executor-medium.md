---
name: cad-executor-medium
description: The `medium` rung of `cad-executor` (plan task execution); `bin/route.mjs` picks it, not the user.
tools: Read, Write, Edit, Bash, Grep, Glob, LSP
color: yellow
effort: medium
maxTurns: 200
skills:
  - cad-executor-contract
  - cad-shared-rules
---

Follow the preloaded `cad-executor-contract` skill exactly - it is your full
contract. This file names that contract and adds nothing else.
