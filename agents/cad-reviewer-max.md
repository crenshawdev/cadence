---
name: cad-reviewer-max
description: The `max` rung of `cad-reviewer` (adversarial artifact review); `bin/route.mjs` picks it, not the user.
tools: Read, Bash, Grep, Glob, LSP
disallowedTools: Write, Edit, MultiEdit
color: red
effort: max
maxTurns: 200
skills:
  - cad-reviewer-contract
  - cad-shared-rules
---

Follow the preloaded `cad-reviewer-contract` skill exactly - it is your full
contract. This file names that contract and adds nothing else.
