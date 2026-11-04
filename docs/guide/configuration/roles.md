# Roles and models

Choose the model and starting reasoning effort for each role. You don't need to make every role equally expensive: planning, implementation and review do different jobs.

```text
/cadence:cad-config --roles
```

Use `--roles --global` to set your machine-wide answers. The interview explains each role before asking what it should use. Repository settings override those answers per key.

## How the choices resolve

For a model, an explicit `roles.<role>.model` takes precedence over the older `model.overrides.<role>`. If neither supplies one, Cadence sends no model parameter and the role uses the session's model. An unsupported model name warns and also uses the session's model; it doesn't quietly select a replacement.

The 3.11.0 resolver recognizes `opus`, `sonnet`, `haiku` and `fable`. The configuration accepts a string, but a string outside that set isn't dispatched as a model. Availability still depends on your Claude Code environment.

| Role | Job | Default effort |
|---|---|---|
| `cad-planner` | Turn the phase's decisions into executable plans. | `high` |
| `cad-assumptions-analyzer` | Examine assumptions before planning. | `high` |
| `cad-executor` | Implement a plan and run its checks. | `high` |
| `cad-reviewer` | Review a plan, diff or decision. | `medium` |
| `cad-verifier` | Check whether the phase achieved its goal. | `high` |
| `cad-plan-checker` | Check a plan against its context before implementation. | `low` |

For effort, the order is `roles.<role>.effort`, then the older `model.effort.<role>`, then the role's schema default. Setting the newer key to `null` removes its answer, so a configured older fallback can still apply. Remove that fallback too if you want the schema default.

The five effort levels are `low`, `medium`, `high`, `xhigh` and `max`. A role's effort selects an agent file carrying that effort. Review-provider effort is a separate setting on the [reviews page](reviews.md).

All settings on this page can be set in either configuration layer. The older model and effort families remain supported for compatibility; use the `roles.*` settings for new configuration.

## Settings

### `roles.cad-planner.model`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

Model for `cad-planner`. A non-null value takes precedence over `model.overrides.cad-planner`. With neither set, use the session model.

### `roles.cad-assumptions-analyzer.model`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

Model for `cad-assumptions-analyzer`. A non-null value takes precedence over `model.overrides.cad-assumptions-analyzer`. With neither set, use the session model.

### `roles.cad-verifier.model`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

Model for `cad-verifier`. A non-null value takes precedence over `model.overrides.cad-verifier`. With neither set, use the session model.

### `roles.cad-reviewer.model`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

Model for `cad-reviewer`. A non-null value takes precedence over `model.overrides.cad-reviewer`. With neither set, use the session model.

### `roles.cad-executor.model`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

Model for `cad-executor`. A non-null value takes precedence over `model.overrides.cad-executor`. With neither set, use the session model.

### `roles.cad-plan-checker.model`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

Model for `cad-plan-checker`. A non-null value takes precedence over `model.overrides.cad-plan-checker`. With neither set, use the session model.

### `roles.cad-planner.effort`

**Default:** `"high"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`, `null`.

Starting effort for `cad-planner`. A non-null value takes precedence over `model.effort.cad-planner`. See the resolution order above for `null`.

### `roles.cad-assumptions-analyzer.effort`

**Default:** `"high"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`, `null`.

Starting effort for `cad-assumptions-analyzer`. A non-null value takes precedence over `model.effort.cad-assumptions-analyzer`. See the resolution order above for `null`.

### `roles.cad-verifier.effort`

**Default:** `"high"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`, `null`.

Starting effort for `cad-verifier`. A non-null value takes precedence over `model.effort.cad-verifier`. See the resolution order above for `null`.

### `roles.cad-reviewer.effort`

**Default:** `"medium"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`, `null`.

Starting effort for `cad-reviewer`. A non-null value takes precedence over `model.effort.cad-reviewer`. See the resolution order above for `null`.

### `roles.cad-executor.effort`

**Default:** `"high"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`, `null`.

Starting effort for `cad-executor`. A non-null value takes precedence over `model.effort.cad-executor`. See the resolution order above for `null`.

### `roles.cad-plan-checker.effort`

**Default:** `"low"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`, `null`.

Starting effort for `cad-plan-checker`. A non-null value takes precedence over `model.effort.cad-plan-checker`. See the resolution order above for `null`.

### `model.escalate_on_failure`

**Default:** `false` · **Type:** boolean · **Scope:** repository or user-global.

On a failed-attempt retry, dispatch one effort level above the configured starting level, holding at the top level. With this off, the retry keeps its starting effort.

### `model.overrides.cad-planner`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

Older model fallback for `cad-planner`, used only when `roles.cad-planner.model` supplies no value. Prefer the newer role key.

### `model.overrides.cad-assumptions-analyzer`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

Older model fallback for `cad-assumptions-analyzer`, used only when `roles.cad-assumptions-analyzer.model` supplies no value. Prefer the newer role key.

### `model.overrides.cad-verifier`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

Older model fallback for `cad-verifier`, used only when `roles.cad-verifier.model` supplies no value. Prefer the newer role key.

### `model.overrides.cad-reviewer`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

Older model fallback for `cad-reviewer`, used only when `roles.cad-reviewer.model` supplies no value. Prefer the newer role key.

### `model.overrides.cad-executor`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

Older model fallback for `cad-executor`, used only when `roles.cad-executor.model` supplies no value. Prefer the newer role key.

### `model.overrides.cad-plan-checker`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

Older model fallback for `cad-plan-checker`, used only when `roles.cad-plan-checker.model` supplies no value. Prefer the newer role key.

### `model.effort.cad-planner`

**Default:** `null` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`, `null`.

Older effort fallback for `cad-planner`, below `roles.cad-planner.effort` and above that role's schema default. `null` supplies no fallback.

### `model.effort.cad-assumptions-analyzer`

**Default:** `null` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`, `null`.

Older effort fallback for `cad-assumptions-analyzer`, below `roles.cad-assumptions-analyzer.effort` and above that role's schema default. `null` supplies no fallback.

### `model.effort.cad-verifier`

**Default:** `null` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`, `null`.

Older effort fallback for `cad-verifier`, below `roles.cad-verifier.effort` and above that role's schema default. `null` supplies no fallback.

### `model.effort.cad-reviewer`

**Default:** `null` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`, `null`.

Older effort fallback for `cad-reviewer`, below `roles.cad-reviewer.effort` and above that role's schema default. `null` supplies no fallback.

### `model.effort.cad-executor`

**Default:** `null` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`, `null`.

Older effort fallback for `cad-executor`, below `roles.cad-executor.effort` and above that role's schema default. `null` supplies no fallback.

### `model.effort.cad-plan-checker`

**Default:** `null` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`, `null`.

Older effort fallback for `cad-plan-checker`, below `roles.cad-plan-checker.effort` and above that role's schema default. `null` supplies no fallback.
