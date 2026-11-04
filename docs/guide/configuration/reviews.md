# Reviews

Three choices shape a review: who reviews, how their findings are combined, and what happens to those findings. Keep those choices separate when tuning the cost or interruption level.

```text
/cadence:cad-config --review
```

This configures providers and detects their available models. The default reviewer is a fresh-context Claude subagent and needs no separate API key.

## Providers and authorization

External providers run only when they are in the effective reviewer list and your user-global `review.reviewers` also names them. A repository list can narrow your authorized set, but cannot add a provider you haven't authorized globally. A provider also needs a configured model and an available credential.

Provider model tiers and trigger effort affect external API reviewers. They don't choose the Claude subagent's model or effort; those come from its [role settings](roles.md). Decision review has its own provider settings and a separate Claude-subagent path.

Store model IDs and credential-file paths in configuration, never API keys. Credentials come from the environment first, then the provider env file. `review.key_file` changes that file's path only from your user-global configuration.

## What a gate does

| Gate | Consequence |
|---|---|
| `off` | The trigger runs no review. |
| `advisory` | Report findings and continue. |
| `deferred` | Continue the work; unresolved queued reviews stop landing. |
| `blocking` | Stop on surviving blocker or high findings. An unavailable review cannot silently pass. |
| `adjudicated` | Evaluate findings against the cited code and present the surviving findings for your triage. |

`review.mode` controls how reviewers combine; a gate set to `adjudicated` requires adjudication regardless of the mode.

## Risk surfaces

Use `/cadence:cad-config --surfaces` to revisit which risk surfaces the project contains. The plan-time risk floor can raise the default plan review to blocking and turn on deep verification. The resolver preserves a valid explicitly configured plan gate, including an explicitly configured `advisory` value. It doesn't change role models or effort.

Waiving a surface's routing floor withholds those plan-time effects for that surface. It doesn't disable review of a matching actual diff. Keep the waiver distinct from changing which surfaces the detector watches.

## Settings

### `review.mode`

**Default:** `"adjudicated"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"single"`, `"panel"`, `"adjudicated"`.

`single` uses the first available reviewer. `panel` combines and deduplicates findings. `adjudicated` runs reviewers independently, then evaluates their findings against the cited code before merging survivors.

### `review.reviewers`

**Default:** `["claude-subagent"]` · **Type:** list of allowed values · **Scope:** repository or user-global.

**Allowed items:** `"claude-subagent"`, `"openai"`, `"gemini"`, `"deepseek"`.

Reviewer backends to request. Lists replace across layers. External providers also need explicit user-global authorization, a model and a credential; the repository alone cannot enable them.

### `review.key_file`

**Default:** `null` · **Type:** string or null · **Scope:** user-global only.

Override the provider credential env-file path, never the key itself. `null` uses `providers.env` under the Cadence XDG config directory, normally `~/.config/cadence/providers.env`. Environment credentials take precedence.

### `review.request_timeout_ms`

**Default:** `540000` · **Type:** integer · **Scope:** repository or user-global.

**Range:** 1–600000.

Timeout in milliseconds for an external review-provider HTTPS request. It does not set a Claude-subagent execution timeout.

### `review.max_prompt_tokens`

**Default:** `120000` · **Type:** integer · **Scope:** repository or user-global.

**Range:** 1 or greater.

Estimated token ceiling for external review and consult payloads, using characters divided by four. An over-cap request is refused before transmission. It does not limit the Claude subagent.

### `review.providers.openai.tiers.flagship`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

**Format:** 1–128 letters, digits, `.`, `_`, `:` or `-`, beginning with a letter or digit; or `null`.

The `openai` model ID used when a review or consult requests the `flagship` tier. Configure it through `--review`. `null` leaves this provider/tier without a model.

### `review.providers.openai.tiers.balanced`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

**Format:** 1–128 letters, digits, `.`, `_`, `:` or `-`, beginning with a letter or digit; or `null`.

The `openai` model ID used when a review or consult requests the `balanced` tier. Configure it through `--review`. `null` leaves this provider/tier without a model.

### `review.providers.openai.tiers.cheap`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

**Format:** 1–128 letters, digits, `.`, `_`, `:` or `-`, beginning with a letter or digit; or `null`.

The `openai` model ID used when a review or consult requests the `cheap` tier. Configure it through `--review`. `null` leaves this provider/tier without a model.

### `review.providers.gemini.tiers.flagship`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

**Format:** 1–128 letters, digits, `.`, `_`, `:` or `-`, beginning with a letter or digit; or `null`.

The `gemini` model ID used when a review or consult requests the `flagship` tier. Configure it through `--review`. `null` leaves this provider/tier without a model.

### `review.providers.gemini.tiers.balanced`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

**Format:** 1–128 letters, digits, `.`, `_`, `:` or `-`, beginning with a letter or digit; or `null`.

The `gemini` model ID used when a review or consult requests the `balanced` tier. Configure it through `--review`. `null` leaves this provider/tier without a model.

### `review.providers.gemini.tiers.cheap`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

**Format:** 1–128 letters, digits, `.`, `_`, `:` or `-`, beginning with a letter or digit; or `null`.

The `gemini` model ID used when a review or consult requests the `cheap` tier. Configure it through `--review`. `null` leaves this provider/tier without a model.

### `review.providers.deepseek.tiers.flagship`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

**Format:** 1–128 letters, digits, `.`, `_`, `:` or `-`, beginning with a letter or digit; or `null`.

The `deepseek` model ID used when a review or consult requests the `flagship` tier. Configure it through `--review`. `null` leaves this provider/tier without a model.

### `review.providers.deepseek.tiers.balanced`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

**Format:** 1–128 letters, digits, `.`, `_`, `:` or `-`, beginning with a letter or digit; or `null`.

The `deepseek` model ID used when a review or consult requests the `balanced` tier. Configure it through `--review`. `null` leaves this provider/tier without a model.

### `review.providers.deepseek.tiers.cheap`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

**Format:** 1–128 letters, digits, `.`, `_`, `:` or `-`, beginning with a letter or digit; or `null`.

The `deepseek` model ID used when a review or consult requests the `cheap` tier. Configure it through `--review`. `null` leaves this provider/tier without a model.

### `review.triggers.plan.gate`

**Default:** `"advisory"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"off"`, `"advisory"`, `"deferred"`, `"blocking"`, `"adjudicated"`.

Consequence of reviewing a written plan. Gate values are explained above.

### `review.triggers.plan.tier`

**Default:** `"cheap"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"flagship"`, `"balanced"`, `"cheap"`.

External-provider model tier for reviewing a written plan. The Claude subagent uses its own role model.

### `review.triggers.plan.effort`

**Default:** `"low"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"minimal"`, `"low"`, `"medium"`, `"high"`, `"xhigh"`.

Requested external-provider reasoning effort for reviewing a written plan. The Claude subagent uses its agent file's effort.

### `review.triggers.diff.gate`

**Default:** `"off"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"off"`, `"advisory"`, `"deferred"`, `"blocking"`, `"adjudicated"`.

Consequence of reviewing a per-task diff. Gate values are explained above.

### `review.triggers.diff.tier`

**Default:** `"cheap"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"flagship"`, `"balanced"`, `"cheap"`.

External-provider model tier for reviewing a per-task diff. The Claude subagent uses its own role model.

### `review.triggers.diff.effort`

**Default:** `"minimal"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"minimal"`, `"low"`, `"medium"`, `"high"`, `"xhigh"`.

Requested external-provider reasoning effort for reviewing a per-task diff. The Claude subagent uses its agent file's effort.

### `review.triggers.risk_surface.gate`

**Default:** `"blocking"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"off"`, `"advisory"`, `"deferred"`, `"blocking"`, `"adjudicated"`.

Consequence of reviewing a detected risk-surface match. Gate values are explained above.

### `review.triggers.risk_surface.tier`

**Default:** `"cheap"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"flagship"`, `"balanced"`, `"cheap"`.

External-provider model tier for reviewing a detected risk-surface match. The Claude subagent uses its own role model.

### `review.triggers.risk_surface.effort`

**Default:** `"low"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"minimal"`, `"low"`, `"medium"`, `"high"`, `"xhigh"`.

Requested external-provider reasoning effort for reviewing a detected risk-surface match. The Claude subagent uses its agent file's effort.

### `review.triggers.risk_surface.surfaces`

**Default:** `null` · **Type:** list of allowed values · **Scope:** repository or user-global.

**Allowed items:** `"auth"`, `"migrations"`, `"billing"`, `"concurrency"`, `"destructive"`, `"secrets"`, `"api_contract"`, `"untrusted_input"`. `null` is also accepted as the unanswered state.

Risk categories the detector watches. `null` means unanswered and keeps all eight; an explicit list selects the categories. Use `--surfaces` to revisit the answer.

### `review.triggers.risk_surface.waive_routing_floor`

**Default:** `null` · **Type:** list of allowed values · **Scope:** repository or user-global.

**Allowed items:** `"auth"`, `"migrations"`, `"billing"`, `"concurrency"`, `"destructive"`, `"secrets"`, `"api_contract"`, `"untrusted_input"`. `null` is also accepted as the unanswered state.

Surfaces that may not raise the plan-time review/deep-verification floor. `null` waives none. A waiver does not disable review on an actual diff or change any role's model or effort.

### `review.triggers.phase_diff.gate`

**Default:** `"off"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"off"`, `"advisory"`, `"deferred"`, `"blocking"`, `"adjudicated"`.

Consequence of reviewing the merged phase diff after parallel execution. Gate values are explained above.

### `review.triggers.phase_diff.tier`

**Default:** `"cheap"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"flagship"`, `"balanced"`, `"cheap"`.

External-provider model tier for reviewing the merged phase diff after parallel execution. The Claude subagent uses its own role model.

### `review.triggers.phase_diff.effort`

**Default:** `"low"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"minimal"`, `"low"`, `"medium"`, `"high"`, `"xhigh"`.

Requested external-provider reasoning effort for reviewing the merged phase diff after parallel execution. The Claude subagent uses its agent file's effort.

### `review.consult.enabled`

**Default:** `false` · **Type:** boolean · **Scope:** repository or user-global.

Allow an offer of a second-model consult at a dead end. Each consult still needs your acceptance of the named provider and model.

### `review.consult.tier`

**Default:** `"flagship"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"flagship"`, `"balanced"`, `"cheap"`.

Provider model tier for a consult.

### `review.consult.effort`

**Default:** `"high"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"minimal"`, `"low"`, `"medium"`, `"high"`, `"xhigh"`.

Requested provider reasoning effort for a consult.

### `review.consult.attempt_threshold`

**Default:** `3` · **Type:** integer · **Scope:** repository or user-global.

**Range:** 1 or greater.

Failed fix attempts or red-test iterations on one bug before `/cad-debug` offers a consult. It is not an automatic permission to call a provider.

### `review.decision_review.tier`

**Default:** `"flagship"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"flagship"`, `"balanced"`, `"cheap"`.

Provider model tier for `/cad-decision-review`. It affects external reviewers only; that command's Claude-subagent path uses the session model.

### `review.decision_review.effort`

**Default:** `"high"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"minimal"`, `"low"`, `"medium"`, `"high"`, `"xhigh"`.

Requested provider reasoning effort for `/cad-decision-review`. It does not override the Claude reviewer agent file's effort.
