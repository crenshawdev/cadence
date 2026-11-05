# How settings resolve

You don't need to tune every setting to start using Cadence. Setup asks about the choices the project needs, and `/cadence:cad-config` lets you revisit them. This reference covers every key in the 3.11.0 schema, including older fallback keys and settings outside the interactive menu.

## Choose the right entry point

| Command | Use it for |
|---|---|
| `/cadence:cad-config` | Walk the configuration menu. |
| `/cadence:cad-config --roles` | Choose each role's model and effort for this project. Add `--global` for machine-wide answers. |
| `/cadence:cad-config --review` | Configure review providers and detect models. |
| `/cadence:cad-config --surfaces` | Revisit the project's risk surfaces. |
| `/cadence:cad-config --testing` | Accept or adjust the testing policy and separately choose verification-publishing authorization. |
| `/cadence:cad-config parallelization.enabled=false` | Set a known repository option directly. |

The menu doesn't expose every key. Provider model settings use their guided setup; older role fallbacks and other advanced keys can be set through the validated configuration command.

## Repository, user-global, then defaults

The normal read order is:

1. The repository's `.planning/config.json`.
2. Your user-global `~/.claude/cadence/config.json`.
3. The built-in default for that key.

`CADENCE_GLOBAL_CONFIG` can relocate the user-global file. Nested objects merge by key. Lists replace the lower layer's list in full; they aren't appended.

An absent setting can inherit a value. An explicit `null` replaces the lower layer's value and has the meaning documented for that key. It isn't a general synonym for removing the setting. For role settings, the older fallback keys can still participate after a `null`; see [roles and models](roles.md).

## Scope and authorization exceptions

| Setting | Rule |
|---|---|
| `workflow.test_command`, `workflow.lint_command`, `review.key_file` | Honored only from your user-global configuration. Repository values are ignored. |
| `testing.*` | Repository-only. Global writes are refused and a hand-edited global testing section is ignored. |
| `git.forge_repo` | Must be set for this repository; the validated write refuses a global value. |
| `git.auto_close` | Must be explicitly true in both layers to authorize unattended closing. |
| `workflow.use_workflows`, `workflow.multi_workflow` | Each counts only when explicitly true in both layers; either alone leaves the old, single-session path. |
| External entries in `review.reviewers` | Must also be authorized in your user-global reviewer list. |
| `cadence.publishForVerification` | Local Git authorization, outside the schema. Stored only in this clone's `.git/config`. |
| `worktree.baseRef` | Claude Code host setting, outside the schema. Governs where subagent worktrees start. |

The pages below use **repository or user-global** for ordinary settings, **repository only** for project-bound settings and **user-global only** for machine-owned settings. The publishing and provider checks above still apply after values have been merged.

## Inspect and change values

Cadence's `config.mjs` command is the validated interface. In the examples below, `CLAUDE_PLUGIN_ROOT` must point to your installed Cadence plugin; run from the project directory.

```sh
# Read effective values, including inherited settings.
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get parallelization.enabled

# Check a proposed change without writing it.
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" check parallelization.enabled=false

# Set a machine-wide default.
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" set --global parallelization.enabled=false

# Remove a repository override so inheritance applies again.
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" unset parallelization.enabled
```

`set` validates all supplied pairs before writing them together. `unset` removes keys from one layer; it doesn't erase an inherited value. Add `--global` when removing a user-global setting. `keys` lists the schema, and `validate` checks the selected configuration file.

For a simple inheritance example, suppose your global setting disables parallelization and this repository enables it. The repository runs with `true`. Removing its override exposes the global `false`; removing both returns to the built-in `true`. Execution still checks whether the plans can safely run in parallel.

## Find a setting

- [Roles and models](roles.md)
- [Reviews](reviews.md)
- [Testing](testing.md)
- [Execution and parallelism](execution.md)
- [Git and publishing](git.md)
- [Project records](records.md)
