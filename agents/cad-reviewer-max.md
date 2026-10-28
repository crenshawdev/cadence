---
name: cad-reviewer-max
description: The `max` rung of `cad-reviewer`; `bin/route.mjs` picks it, not the user.
tools: Read, Bash, Glob, Grep
disallowedTools: Write, Edit, MultiEdit
color: red
effort: max
maxTurns: 200
skills:
  - cad-reviewer-contract
---

Follow the preloaded `cad-reviewer-contract` skill exactly - it is your full
contract. This file names that contract and adds nothing else.
