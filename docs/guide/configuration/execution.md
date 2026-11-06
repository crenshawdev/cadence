# Execution and parallelism

These settings control planning, execution and reporting. Some are limits the workflow works within; others report measurements after the work. A setting named a ceiling isn't necessarily an execution cutoff.

For example, to keep plans sequential:

```text
/cadence:cad-config parallelization.enabled=false
```

## Parallel work needs independent plans

Enabling parallelization doesn't force a parallel run. Plans must be independent, with non-overlapping declared files, and the host must support the required worktree behavior. If Cadence can't establish that, it runs sequentially.

The host's `worktree.baseRef` setting must resolve to `head` for this path. It belongs in Claude Code's settings, outside Cadence's schema. `/cadence:cad-config` offers to configure it when worktrees are enabled and asks which settings file to update. Disabling worktrees leaves parallel execution unavailable.

## Reported limits

`workflow.max_plan_bytes` reports the size of a plan's declared files; exceeding it doesn't itself refuse planning or execution. The six `workflow.max_dispatch_tokens.*` settings report a dispatch's final recorded context-window figure after it returns. They aren't token budgets enforced by the host, and they aren't cumulative token spend.

## Local commands

`workflow.test_command` and `workflow.lint_command` are user-global only. Repository values are ignored. When no override is configured, the workflows use their documented project-manifest detection or fallback. The lint override covers lint, not a separately configurable typecheck command.

## Settings

### `workflow.research`

**Default:** `false` · **Type:** boolean · **Scope:** repository or user-global.

Enable the research pass during new-project setup. Other workflows do not read this switch.

### `workflow.plan_check`

**Default:** `false` · **Type:** boolean · **Scope:** repository or user-global.

Add the optional plan-checker pass before implementation. This is separate from the standing plan-review trigger.

### `workflow.verifier`

**Default:** `true` · **Type:** boolean · **Scope:** repository or user-global.

Enable the goal-backward deep-verification path. The risk floor can request it and `--deep` requests it explicitly; `false` is the workflow's off switch. This does not disable the ordinary verification walk.

### `workflow.skip_discuss`

**Default:** `false` · **Type:** boolean · **Scope:** repository or user-global.

Change the next-step suggestion for an unplanned phase in `/cad-progress`. It suggests planning instead of context gathering; it does not skip a workflow step.

### `workflow.inline_plan_threshold`

**Default:** `3` · **Type:** integer · **Scope:** repository or user-global.

**Range:** 0 or greater.

Task count at or below which the plan can use the inline path rather than its own plan document.

### `workflow.max_plan_tasks`

**Default:** `8` · **Type:** integer · **Scope:** repository or user-global.

**Range:** 1 or greater.

Maximum tasks per plan. A larger phase needs more plans, not fewer requirements. Plans that share files remain sequential.

### `workflow.max_plan_bytes`

**Default:** `675000` · **Type:** integer · **Scope:** repository or user-global.

**Range:** 1 or greater.

Reporting threshold for the summed on-disk sizes of a single plan's declared files. A crossing is reported by plan-size; it does not block dispatch or execution.

### `workflow.max_dispatch_tokens.cad-planner`

**Default:** `200000` · **Type:** integer · **Scope:** repository or user-global.

**Range:** 1 or greater.

Reporting threshold for `cad-planner`'s final recorded context-window size. Read after dispatch; it neither stops the agent nor caps total token spend.

### `workflow.max_dispatch_tokens.cad-assumptions-analyzer`

**Default:** `150000` · **Type:** integer · **Scope:** repository or user-global.

**Range:** 1 or greater.

Reporting threshold for `cad-assumptions-analyzer`'s final recorded context-window size. Read after dispatch; it neither stops the agent nor caps total token spend.

### `workflow.max_dispatch_tokens.cad-verifier`

**Default:** `100000` · **Type:** integer · **Scope:** repository or user-global.

**Range:** 1 or greater.

Reporting threshold for `cad-verifier`'s final recorded context-window size. Read after dispatch; it neither stops the agent nor caps total token spend.

### `workflow.max_dispatch_tokens.cad-reviewer`

**Default:** `150000` · **Type:** integer · **Scope:** repository or user-global.

**Range:** 1 or greater.

Reporting threshold for `cad-reviewer`'s final recorded context-window size. Read after dispatch; it neither stops the agent nor caps total token spend.

### `workflow.max_dispatch_tokens.cad-executor`

**Default:** `200000` · **Type:** integer · **Scope:** repository or user-global.

**Range:** 1 or greater.

Reporting threshold for `cad-executor`'s final recorded context-window size. Read after dispatch; it neither stops the agent nor caps total token spend.

### `workflow.max_dispatch_tokens.cad-plan-checker`

**Default:** `75000` · **Type:** integer · **Scope:** repository or user-global.

**Range:** 1 or greater.

Reporting threshold for `cad-plan-checker`'s final recorded context-window size. Read after dispatch; it neither stops the agent nor caps total token spend.

### `workflow.test_command`

**Default:** `null` · **Type:** string or null · **Scope:** user-global only.

Override the local test command. `null` means no override; the executor and verifier use their project-manifest fallback. Set this in the user-global layer.

### `workflow.lint_command`

**Default:** `null` · **Type:** string or null · **Scope:** user-global only.

Override the executor's pre-commit lint command. With no override, command detection reads the project manifests. There is no companion typecheck setting.

### `workflow.use_workflows`

**Default:** `false` · **Type:** boolean · **Scope:** repository or user-global.

Run reviews as workflows, with one agent per reviewer and one per finding, rather than one main session opening the file. Workflows burn usage fast, so this is off by default. It counts only when both the repository's `.planning/config.json` and your user-global configuration set it to `true`; either alone leaves the old path, so a value committed to a repository can't turn it on for whoever clones it. Each run takes exactly one path.

### `workflow.multi_workflow`

**Default:** `false` · **Type:** boolean · **Scope:** repository or user-global.

Allow more than one workflow at a time. Several at once multiply the usage burn of each, so with this off a second workflow waits for the first to finish. It counts only when both the repository and user-global configuration set it to `true`.

### `workflow.config_menu`

**Default:** `false` · **Type:** boolean · **Scope:** repository or user-global.

Turn on the new `/cadence:cad-config` menu. With it on, no arguments opens six groups of settings, and you can pick a setting by number or say what you want to change in a sentence. Each change is previewed and written only after you say yes. With it off, no arguments opens the full walk as it did before the menu, and a sentence is answered with the command that turns this on. `--walk`, `key=value` and the guided flags work either way.

### `parallelization.enabled`

**Default:** `true` · **Type:** boolean · **Scope:** repository or user-global.

Allow independent plans to execute concurrently when the worktree and independence checks pass. Otherwise execution remains sequential.

### `parallelization.max_concurrent_agents`

**Default:** `3` · **Type:** integer · **Scope:** repository or user-global.

**Range:** 1 or greater.

Maximum simultaneous agents for parallel execution.

### `parallelization.min_plans_for_parallel`

**Default:** `2` · **Type:** integer · **Scope:** repository or user-global.

**Range:** 1 or greater.

Minimum number of plans needed before considering parallel execution.

### `parallelization.use_worktrees`

**Default:** `true` · **Type:** boolean · **Scope:** repository or user-global.

Use separate Git worktrees for parallel writes. Turning this off prevents the parallel path from establishing the isolation it requires.
