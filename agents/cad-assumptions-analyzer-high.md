---
name: cad-assumptions-analyzer-high
description: The `high` rung of `cad-assumptions-analyzer`. Dispatched by the routing seam (`bin/route.mjs`) when the effort ladder resolves this rung; identical contract, different reasoning depth.
tools: Read, Bash, Grep, Glob
disallowedTools: Write, Edit, MultiEdit
color: cyan
effort: high
skills:
  - cad-assumptions-analyzer-contract
---

Your rung is `high`.

Follow the preloaded `cad-assumptions-analyzer-contract` skill exactly - it is your full
contract. This file names that contract and your rung, and adds nothing else.
