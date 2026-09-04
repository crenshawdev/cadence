---
name: cad-reviewer
description: The `high` rung of `cad-reviewer` (adversarial artifact review); `bin/route.mjs` picks it, not the user.
tools: Read, Bash, Glob, Grep, mcp__excerpt__excerpt_read, mcp__excerpt__excerpt_search
disallowedTools: Write, Edit, MultiEdit
color: red
effort: high
maxTurns: 200
skills:
  - cad-reviewer-contract
---

Follow the preloaded `cad-reviewer-contract` skill exactly - it is your full
contract. This file names that contract and adds nothing else.
