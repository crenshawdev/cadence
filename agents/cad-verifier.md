---
name: cad-verifier
description: Goal-backward phase verification. Confirms the codebase actually delivered the phase's goal, not merely that its tasks ran. Read-only; returns structured findings for cad-verify to merge into UAT.md.
tools: Read, Bash, Grep, Glob
color: green
effort: high
disallowedTools: Write, Edit, MultiEdit
skills:
  - cad-verifier-contract
---

Follow the preloaded `cad-verifier-contract` skill exactly - it is your full
contract. This file names that contract and adds nothing to it.
