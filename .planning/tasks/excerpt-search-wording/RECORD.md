# Task: excerpt-search-wording

## What shipped

- Every cad-*-contract skill now claims the shell channel for excerpt_search.
- The preference sentence named only the built-in Read and Grep tools, so it
- never reached shell grep and rg, which is where the searches actually go:
- mcp__excerpt__excerpt_search had been called 0 times in this project against
- 207 shell greps in one day. All six contracts now say to prefer
- excerpt_search over shell grep/rg for code search and that the shell channel
- is not an exemption, with the when-absent clause unchanged. The three
- contracts that also told the agent to "locate with grep -n" in the same file
- (assumptions-analyzer, executor, planner) route that paragraph through
- excerpt_search first, keeping grep -n as the named fallback along with the
- LOOSER PATTERN rule, the perl boundary-range tip and the -A40 tell. Six byte
- ceilings in weight-budgets.json moved with the added sentences after
- self-verify failed budget-overrun on all six. This is the contract-wording
- lever of a measurement experiment: excerpt's deny hook steps aside on
- agent_id and cannot see Bash arguments, so wording is the only lever that
- reaches a subagent. Contract wording is read at session start, so it reaches
- live agents only after a Claude Code restart.

## Commits

| Task | Commit | Description |
| --- | --- | --- |
| 1 | a4e118da8847d6da587b915617b4d00806f2d541 | docs(contracts): claim the shell channel for excerpt_search |
| 1 | 4a165b168aa148247eac53fc28bcb4327a44968d | docs(contracts): locate through excerpt_search before shell grep |
| 1 | 2ee67f857c66b777b3a5f9905bc95947c9764aa0 | docs: task plan excerpt-search-wording |

## Files

### Task 1: excerpt-search-wording

- **Files:** .planning/tasks/excerpt-search-wording/PLAN.md, cadence-core/bin/weight-budgets.json, skills/cad-assumptions-analyzer-contract/SKILL.md, skills/cad-executor-contract/SKILL.md, skills/cad-plan-checker-contract/SKILL.md, skills/cad-planner-contract/SKILL.md, skills/cad-reviewer-contract/SKILL.md, skills/cad-verifier-contract/SKILL.md
