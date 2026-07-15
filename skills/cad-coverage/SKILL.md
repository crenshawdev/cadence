---
name: cad-coverage
description: "Find which of a completed phase's requirements have zero failing-capable test coverage, then generate tests to close the gaps - using the project's own test framework, not a fixed one"
argument-hint: "[phase number]"
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
Close the test-coverage gaps for a completed phase. One question drives it:
which phase requirements have NO test that would fail if that requirement
regressed? Those are the gaps. Audit them, then generate real tests to cover
them, in the project's own test framework.

Audit and generate in one un-duplicated flow. No fixed stack, no Playwright/E2E
default - the test kind and runner follow the code and `workflow.test_command`.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/coverage.md
</execution_context>

<process>
Run the coverage workflow end-to-end. Coverage means a test that would FAIL if
the requirement broke - not a test that merely runs the code. Get user approval
on the gap test plan before generating, and verify generated tests actually run.
</process>
