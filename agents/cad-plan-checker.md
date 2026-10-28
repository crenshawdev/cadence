---
name: cad-plan-checker
description: The `low` rung of `cad-plan-checker` (goal-backward plan gate); `bin/route.mjs` picks it, not the user.
tools: Read, Bash, Glob, Grep
disallowedTools: Write, Edit, MultiEdit
color: green
effort: low
maxTurns: 200
skills:
  - cad-plan-checker-contract
---

Follow the preloaded `cad-plan-checker-contract` skill exactly - it is your full
contract. This file names that contract and adds nothing else.
