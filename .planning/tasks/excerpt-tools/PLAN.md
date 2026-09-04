# Task: excerpt tools on every agent

Source: the excerpt session's 2026-09-04 probe. Every cadence agent declares an
explicit `tools:` line, so MCP tools are not inherited and no agent can see
`mcp__excerpt__excerpt_read` or `mcp__excerpt__excerpt_search`. excerpt
v0.0.2 makes its Read/Grep hook step aside inside subagents; cadence's side is
to name the two tools so agents that have excerpt can prefer it.

## Tasks

### 1. Probe: an uninstalled MCP tool name on a `tools:` line

files: agents/cad-plan-checker.md (temporary edit, reverted)
action: add `mcp__excerpt__excerpt_read, mcp__nonexistent__tool` to the low
plan-checker rung's `tools:` line, spawn it with a prompt that only reports its
tool list, revert the edit.
verify: the spawn returns a tool list. Excerpt's read present proves the
frontmatter was re-read at spawn. The bogus name absent with the agent launched
proves an unknown name is ignored; a launch failure proves it breaks, and tasks
2 and 3 do not run.

### 2. Name the two excerpt tools on all 19 agents

files: agents/*.md (19), cadence-core/bin/weight-budgets.json
action: append `mcp__excerpt__excerpt_read, mcp__excerpt__excerpt_search` to
each `tools:` line; re-pin each agent's byte ceiling in the same commit.
verify: `grep -L mcp__excerpt__excerpt_search agents/*.md` prints nothing;
`node cadence-core/bin/self-verify.mjs` reports ok with no budget-overrun.

### 3. State the preference in the six contract skills

files: skills/cad-*-contract/SKILL.md (6)
action: one sentence beside each contract's read guidance: when
`mcp__excerpt__excerpt_read` and `mcp__excerpt__excerpt_search` are on your
tool list, prefer them over built-in Read and Grep; when absent, the built-ins
are the path.
verify: `grep -l mcp__excerpt__excerpt_read skills/cad-*-contract/SKILL.md`
lists all six; self-verify and the test suite stay green.

## Outcome

Task 1 ran twice. Inside this session the low plan-checker rung launched with
the bogus name on its line but saw neither it nor excerpt's installed read tool,
so agent frontmatter is read at session start. A fresh `claude -p --agents`
process settled it: the agent launched, received `mcp__excerpt__excerpt_read`
by name, and dropped `mcp__nonexistent__tool` silently. Task 2 shipped as
12acacf5 (19 agents, 19 ceilings). Task 3 shipped as 11598475 (six
contracts, six ceilings). Suite 3805 pass, self-verify clean, tsc clean. The
change reaches live agents only after a Claude Code restart.
