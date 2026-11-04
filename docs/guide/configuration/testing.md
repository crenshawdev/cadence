# Testing settings

Accept or adjust the project's policy through:

```text
/cadence:cad-config --testing
```

The [testing chapter](../testing/policy.md) explains the decisions behind these settings. All nine `testing.*` keys are repository-only. A user-global write is refused, and a hand-edited global testing section is ignored during the merge.

Defaults alone don't activate the policy: `testing.scope` must name an accepted scope. Policy acceptance records the source scope, thresholds, commands and required jobs together. Change them through that policy discussion rather than treating a failing gate as permission to loosen them.

The accepted coverage commands describe what CI runs. Cadence compares them as text against workflow files; they are separate from `workflow.test_command`, the user-global command for local test execution.

## Policy settings

### `testing.scope`

**Default:** `null` · **Type:** enum · **Scope:** repository only.

**Allowed values:** `"focused"`, `"integrated"`, `"thorough"`, `null`.

Accept a project policy: `focused` covers units/components and necessary interactions; `integrated` adds main-path integration; `thorough` adds justified deeper failure/limit checks. `null` leaves the policy inactive.

### `testing.coverage.lines`

**Default:** `85` · **Type:** integer · **Scope:** repository only.

**Range:** 0–100.

Aggregate line-coverage threshold. `0` explicitly disables this metric; it is never reported as satisfied by that choice.

### `testing.coverage.branches`

**Default:** `85` · **Type:** integer · **Scope:** repository only.

**Range:** 0–100.

Aggregate branch-coverage threshold, checked separately from lines. `0` disables enforcement. A valid zero-branch measurement is a different outcome.

### `testing.coverage.statements`

**Default:** `0` · **Type:** integer · **Scope:** repository only.

**Range:** 0–100.

Separate statement-coverage threshold for tools such as Go. It is not used as a line threshold. `0` disables it.

### `testing.coverage.include`

**Default:** `[]` · **Type:** list of strings · **Scope:** repository only.

Globs naming the production files to measure. An empty list leaves selection to the accepted command's defaults; review that scope during acceptance.

### `testing.coverage.exclude`

**Default:** `[]` · **Type:** list of strings · **Scope:** repository only.

Accepted exclusions from measurement, such as generated code, bundled output and test code. Expanding this list is a policy adjustment.

### `testing.coverage.commands`

**Default:** `[]` · **Type:** list of strings · **Scope:** repository only.

Accepted CI coverage commands. Threshold placeholders are `{lines}`, `{branches}` and `{statements}`. The policy check matches filled-in commands against workflow text; it does not execute them.

### `testing.strong_areas`

**Default:** `[]` · **Type:** list of strings · **Scope:** repository only.

Project paths that justify deeper testing because of a concrete requirement or plausible consequential defect. The stopping rule still applies.

### `testing.required_jobs`

**Default:** `[]` · **Type:** list of strings · **Scope:** repository only.

GitHub Actions job names that must succeed for a commit to be recorded as CI-verified. The active policy needs at least one required job; `[]` cannot establish a CI pass.
