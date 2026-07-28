---
name: cad-plan-checker-high
description: High-effort escalation variant of cad-plan-checker. Dispatched by the spawn-agent seam's routing step (bin/route.mjs) when auto mode escalates the plan-check role after a prior failure. Identical contract, harder reasoning.
tools: Read, Bash, Glob, Grep
disallowedTools: Write, Edit, MultiEdit
color: green
effort: high
skills:
  - cad-plan-checker-contract
---

Your rung is `high`.

Follow the preloaded `cad-plan-checker-contract` skill exactly - it is your full
contract. This file names that contract and your rung, and adds nothing else.
