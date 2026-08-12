---
name: cad-adopt
description: "Initialize .planning/ from a repo that already exists - PROJECT.md, REQUIREMENTS.md and a remaining-work ROADMAP.md derived from the code and the git history"
argument-hint: ""
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
---

<objective>
The second front door. A project that already has code and history enters
Cadence as itself instead of as a blank page: the README, the manifests, the
tree and `git log` are read here, shipped capability lands in PROJECT.md as
Validated, the roadmap covers what is LEFT, and the only questions asked are
the ones the repo cannot answer. What it writes is the same `.planning/` shape
/cad-new-project writes, so every downstream command works unchanged.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/adopt.md
</execution_context>

<process>
Execute end-to-end.
</process>
