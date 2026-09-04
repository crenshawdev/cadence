# Task: excerpt-tools

## What shipped

- Every rung agent now names mcp__excerpt__excerpt_read and mcp__excerpt__excerpt_search on its tools: line, and each of the six contract skills says to prefer them over built-in Read and Grep when present. Probed in a fresh process first: an uninstalled MCP tool name on a tools: line launches fine and is dropped silently, so the names are safe in the public plugin. Agent frontmatter is read at session start, so the change reaches live agents after a restart.

## Commits

| Task | Commit | Description |
| --- | --- | --- |
| 1 | 12acacf50ee19cbe161ccef15bb837a4f247d605 | feat(agents): name excerpt's read and search tools on every rung |
| 1 | 115984752fb3c670d97732806a34a15b8e1663e6 | docs(contracts): prefer excerpt's read and search when they are on the tool list |
| 1 | 7759a446dcb80be68608d01d5d89e0e9104e7a1d | docs: task plan excerpt-tools |

## Files

### Task 1: excerpt-tools

- **Files:** .planning/tasks/excerpt-tools/PLAN.md, agents/cad-assumptions-analyzer-high.md, agents/cad-assumptions-analyzer.md, agents/cad-executor-xhigh.md, agents/cad-executor.md, agents/cad-plan-checker-high.md, agents/cad-plan-checker-medium.md, agents/cad-plan-checker-xhigh.md, agents/cad-plan-checker.md, agents/cad-planner-max.md, agents/cad-planner-xhigh.md, agents/cad-planner.md, agents/cad-reviewer-max.md, agents/cad-reviewer-medium.md, agents/cad-reviewer-xhigh.md, agents/cad-reviewer.md, agents/cad-verifier-max.md, agents/cad-verifier-medium.md, agents/cad-verifier-xhigh.md, agents/cad-verifier.md, cadence-core/bin/weight-budgets.json, skills/cad-assumptions-analyzer-contract/SKILL.md, skills/cad-executor-contract/SKILL.md, skills/cad-plan-checker-contract/SKILL.md, skills/cad-planner-contract/SKILL.md, skills/cad-reviewer-contract/SKILL.md, skills/cad-verifier-contract/SKILL.md
