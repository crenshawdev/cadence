---
name: cad-plan-checker-max
description: The `max` rung of `cad-plan-checker` (goal-backward plan gate); `bin/route.mjs` picks it, not the user.
tools: Read, Bash, Grep, Glob, LSP
disallowedTools: Write, Edit, MultiEdit
color: green
effort: max
maxTurns: 200
skills:
  - cad-plan-checker-contract
  - cad-shared-rules
---

Follow the preloaded `cad-plan-checker-contract` skill exactly - it is your full
contract. This file names that contract and adds nothing else.
