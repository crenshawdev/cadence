# Roles and models

Choose the model and starting reasoning effort for each role. You don't need to make every role equally expensive: planning, implementation and review do different jobs.

```text
/cadence:cad-config --roles
```

Use `--roles --global` to set your machine-wide answers. The interview explains each role before asking what it should use. Repository settings override those answers per key.

## How the choices resolve

For a model, Cadence uses `roles.<role>.model`. If it is unset, Cadence sends no model parameter and the role uses the session's model. An unsupported model name warns and also uses the session's model; it doesn't quietly select a replacement.

The 3.11.0 resolver recognizes `opus`, `sonnet`, `haiku` and `fable`. The configuration accepts a string, but a string outside that set isn't dispatched as a model. Availability still depends on your Claude Code environment.

| Role | Job | Default effort |
|---|---|---|
| `cad-planner` | Turn the phase's decisions into executable plans. | `high` |
| `cad-assumptions-analyzer` | Examine assumptions before planning. | `high` |
| `cad-executor` | Implement a plan and run its checks. | `high` |
| `cad-reviewer` | Review a plan, diff or decision. | `medium` |
| `cad-verifier` | Check whether the phase achieved its goal. | `high` |
| `cad-plan-checker` | Check a plan against its context before implementation. | `low` |

For effort, the order is `roles.<role>.effort`, then the role's schema default. Setting the key to `null` removes its answer, so the schema default applies.

The five effort levels are `low`, `medium`, `high`, `xhigh` and `max`. A role's effort selects an agent file carrying that effort. Review-provider effort is a separate setting on the [reviews page](reviews.md).

All settings on this page can be set in either configuration layer. The older per-role model and effort keys are retired; a config that still holds one warns and names its `roles.*` replacement.

## Settings

### `roles.cad-planner.model`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

Model for `cad-planner`. With it unset, use the session model.

### `roles.cad-assumptions-analyzer.model`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

Model for `cad-assumptions-analyzer`. With it unset, use the session model.

### `roles.cad-verifier.model`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

Model for `cad-verifier`. With it unset, use the session model.

### `roles.cad-reviewer.model`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

Model for `cad-reviewer`. With it unset, use the session model.

### `roles.cad-executor.model`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

Model for `cad-executor`. With it unset, use the session model.

### `roles.cad-plan-checker.model`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

Model for `cad-plan-checker`. With it unset, use the session model.

### `roles.cad-planner.effort`

**Default:** `"high"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`, `null`.

Starting effort for `cad-planner`. See the resolution order above for `null`.

### `roles.cad-assumptions-analyzer.effort`

**Default:** `"high"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`, `null`.

Starting effort for `cad-assumptions-analyzer`. See the resolution order above for `null`.

### `roles.cad-verifier.effort`

**Default:** `"high"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`, `null`.

Starting effort for `cad-verifier`. See the resolution order above for `null`.

### `roles.cad-reviewer.effort`

**Default:** `"medium"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`, `null`.

Starting effort for `cad-reviewer`. See the resolution order above for `null`.

### `roles.cad-executor.effort`

**Default:** `"high"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`, `null`.

Starting effort for `cad-executor`. See the resolution order above for `null`.

### `roles.cad-plan-checker.effort`

**Default:** `"low"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`, `null`.

Starting effort for `cad-plan-checker`. See the resolution order above for `null`.

### `model.escalate_on_failure`

**Default:** `false` · **Type:** boolean · **Scope:** repository or user-global.

On a failed-attempt retry, dispatch one effort level above the configured starting level, holding at the top level. With this off, the retry keeps its starting effort.
