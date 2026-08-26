---
name: cad-verifier
description: The `high` rung of `cad-verifier` (goal-backward phase verification); `bin/route.mjs` picks it, not the user.
tools: Read, Write, Bash, Grep, Glob
color: green
effort: high
maxTurns: 200
disallowedTools: Edit, MultiEdit
skills:
  - cad-verifier-contract
---

Follow the preloaded `cad-verifier-contract` skill exactly - it is your full
contract. This file names that contract and adds nothing else.
