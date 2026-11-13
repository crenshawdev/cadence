---
name: cad-verifier-medium
description: The `medium` rung of `cad-verifier` (goal-backward phase verification); `bin/route.mjs` picks it, not the user.
tools: Read, Write, Bash, Grep, Glob
disallowedTools: Edit, MultiEdit
color: green
effort: medium
maxTurns: 200
skills:
  - cad-verifier-contract
---

Follow the preloaded `cad-verifier-contract` skill exactly - it is your full
contract. This file names that contract and adds nothing else.
