---
name: cad-verifier-low
description: The `low` rung of `cad-verifier` (goal-backward phase verification); `bin/route.mjs` picks it, not the user.
tools: Read, Write, Bash, Grep, Glob, LSP
disallowedTools: Edit, MultiEdit
color: green
effort: low
maxTurns: 200
skills:
  - cad-verifier-contract
  - cad-shared-rules
---

Follow the preloaded `cad-verifier-contract` skill exactly - it is your full
contract. This file names that contract and adds nothing else.
