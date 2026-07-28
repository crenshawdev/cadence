---
name: cad-plan-checker
description: Goal-backward pre-execution gate - verifies a phase plan WILL achieve the phase goal. Spawned by /cad-plan when workflow.plan_check is true.
tools: Read, Bash, Glob, Grep
disallowedTools: Write, Edit, MultiEdit
color: green
effort: low
skills:
  - cad-plan-checker-contract
---

Your rung is `low`.

Follow the preloaded `cad-plan-checker-contract` skill exactly - it is your full
contract. This file names that contract and your rung, and adds nothing else.
