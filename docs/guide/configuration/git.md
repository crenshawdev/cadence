# Git and publishing

Branch choices and authorization are related, but they answer different questions. Choosing a forge or an integration branch doesn't authorize unattended publishing.

## Two separate publishing permissions

`git.auto_close` authorizes the unattended milestone/landing path only when both the repository and user-global configuration set it to `true`. Either layer alone is insufficient. Required checks and the host's command permissions still apply.

Verification publishing uses a different permission: `cadence.publishForVerification` in this clone's own `.git/config`. It starts off and is enabled or disabled through `/cadence:cad-config --testing`. Global Git configuration, command-line overrides and `git.auto_close` don't supply it. Verification publishing refuses protected branches.

That local Git setting isn't a Cadence schema key and doesn't travel with a clone. See [required CI jobs](../testing/ci.md) for the pending-CI workflow.

## Branch and forge choices

A milestone integration branch gives the cycle a shared destination for completed work. Trunk mode uses the base branch, subject to the protected-branch rule. Worktree starting points remain a separate host setting, explained under [execution](execution.md).

Forge setup records the provider and the repository it should address. For Forgejo, the host is the web/API host, optionally with its port; an SSH endpoint may be different. `git.forge_repo` is repository-only because a global repository identity would point unrelated projects at the same target.

## Settings

### `git.protected_branches`

**Default:** `["main", "master"]` · **Type:** list of strings · **Scope:** repository or user-global.

Branch names governed by `git.on_protected` for direct commits. Verification publishing refuses protected branches regardless of that commit setting.

### `git.on_protected`

**Default:** `"ask"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"ask"`, `"refuse"`, `"allow"`.

`ask` requests a decision for a protected-branch commit, `refuse` blocks it and `allow` permits it. This does not authorize publishing.

### `git.integration_branch`

**Default:** `"milestone"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"milestone"`, `"trunk"`.

`milestone` uses a per-milestone integration branch. `trunk` creates no integration branch and places work on the base, subject to the protected-branch rule.

### `git.auto_branch`

**Default:** `"ask"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"ask"`, `"auto"`, `"off"`.

`ask` prompts before creating or switching to the integration branch at cycle start. `auto` does so without that prompt. `off` stays on the current branch.

### `git.integration_branch_name`

**Default:** `null` · **Type:** string or null · **Scope:** repository only.

**Format:** letters, digits, `.`, `_`, `-` and `/`, starting with a letter or digit. No `..`, no trailing `/` and no `.lock` ending. `null` leaves it unset.

The whole name of the integration branch, such as `seldon/hardin`. `null` keeps `cadence/<version>`. A version that is already tagged still asks instead of creating a branch under either name. It stops applying after the land, so the next cycle cannot reuse the name. User-global config cannot set it, because that value would name every repository's branch.

### `git.base_branch`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

Base branch for new work. `null` uses the current branch.

### `git.create_tag`

**Default:** `true` · **Type:** boolean · **Scope:** repository or user-global.

Create the release tag at landing, on the pulled base after the merge is confirmed. It does not govern manifest version bumps.

### `git.on_land_cleanup`

**Default:** `true` · **Type:** boolean · **Scope:** repository or user-global.

After a successful merge, return to the base branch, pull and remove the merged integration branch.

### `git.issue_check`

**Default:** `true` · **Type:** boolean · **Scope:** repository or user-global.

Show the read-only issue report at the start of landing: issues referenced by this branch and which remain open. This setting does not close or modify issues.

### `git.forge_provider`

**Default:** `null` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"forgejo"`, `"github"`, `"gitlab"`, `null`.

The forge selected at setup. `null` means it has not been answered. The configured provider is used instead of inferring it anew from the remote.

### `git.forge_repo`

**Default:** `null` · **Type:** string or null · **Scope:** repository only.

**Format:** two or more slash-separated segments containing letters, digits, `.`, `_` or `-`. No segment may begin with `-` or equal `.` or `..`. `null` leaves it unset.

The repository identity used for forge calls, such as `owner/name`; nested GitLab groups are supported. `null` means it has not been answered. Setup offers a remote-derived value for confirmation.

### `git.forge_host`

**Default:** `null` · **Type:** string or null · **Scope:** repository or user-global.

**Format:** a hostname with an optional decimal port from 1–65535 (no leading zero). Host labels contain letters, digits and internal hyphens. `null` leaves it unset.

The confirmed Forgejo web/API hostname, optionally with a port. It is asked separately from the SSH remote. Leave it `null` for GitHub and GitLab.

### `git.auto_close`

**Default:** `false` · **Type:** boolean · **Scope:** repository or user-global.

Authorize unattended closing and landing only when explicitly true in both configuration layers. Surviving blocker/high risk-surface findings and other required gates can still stop it. This does not authorize verification publishing.
