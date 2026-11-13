---
name: cad-reviewer-medium
description: The `medium` rung of `cad-reviewer` (adversarial artifact review); `bin/route.mjs` picks it, not the user.
tools: Read, Bash, Grep, Glob
disallowedTools: Write, Edit, MultiEdit
color: red
effort: medium
maxTurns: 200
skills:
  - cad-reviewer-contract
---

Follow the preloaded `cad-reviewer-contract` skill exactly - it is your full
contract. This file names that contract and adds nothing else.
