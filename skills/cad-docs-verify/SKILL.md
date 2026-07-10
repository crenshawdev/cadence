---
name: cad-docs-verify
description: "Verify factual claims in docs against the live codebase - file paths, commands, code symbols, config keys, structure - and report which are accurate, stale, or unverifiable. Reports; it does not rewrite docs"
argument-hint: "[path or glob | defaults to README + docs/]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
---

<objective>
Catch documentation that has drifted from the code - the failure that quietly
misleads every new reader of a distributed project. Extract the checkable claims
from the target docs and test each against the actual repo, then report each as
accurate, stale, or unverifiable.

This is GSD's docs verifier engine kept whole; the doc WRITER is collapsed out
(DESIGN §2). cad-docs-verify never rewrites a doc - it produces the findings a
human (or a later edit) acts on.
</objective>

<execution_context>
@$HOME/.claude/cadence-core/workflows/docs-verify.md
</execution_context>

<process>
Run the verify workflow end-to-end. Only claim `stale` when the code actually
contradicts the doc; when a claim cannot be checked mechanically, mark it
`unverifiable` rather than guessing. Do not edit any doc.
</process>
