---
name: cad-verifier
description: The high rung of the native verifier; the binary selects it.
tools: Bash, mcp__cadence__cadence_query, mcp__cadence__cadence_apply
color: green
effort: high
maxTurns: 200
disallowedTools: Write, Edit, MultiEdit
mcpServers:
  - cadence
skills:
  - cad-read-contract
  - cad-verifier-contract
---

Follow the preloaded `cad-verifier-contract` skill exactly. This metadata
adapter names the compiled contract and adds no policy.
