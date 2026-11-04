# Install

Cadence runs inside Claude Code. You'll need Claude Code with plugin support, Node.js and Git on your path, plus the CLI for the forge that hosts your repository:

| Forge | CLI |
|---|---|
| GitHub | `gh` |
| GitLab | `glab` |
| Forgejo | `tea` |

Sign in through your chosen CLI before setting up a project. Cadence uses that identity for forge operations. The testing policy's CI enforcement currently supports GitHub Actions only.

## Add the plugin

Run these commands in Claude Code:

```text
/plugin marketplace add https://github.com/crenshawdev/cadence.git
/plugin install cadence@cadence
```

Cadence's scripts have no runtime package dependencies. Installing Cadence doesn't require an `npm install`. The project you build with it will still need its own tools and dependencies.

To see the commands:

```text
/cadence:cad-help
```

This guide writes the full `/cadence:cad-` names so you can use the examples directly.

## Permissions

Cadence's shell commands go through Claude Code's permission checks. Your permission mode and allowed-command rules determine when it asks. An unattended workflow still needs permission to run its commands.

Publishing has additional controls. Accepting a testing policy doesn't authorize verification pushes; you make that choice separately through `/cadence:cad-config --testing`.

The [permissions and data reference](https://github.com/crenshawdev/cadence/blob/main/docs/PERMISSIONS.md) describes provider calls, credentials and files outside your project.

## Update or remove

```text
/plugin update cadence@cadence
```

```text
/plugin uninstall cadence@cadence
```

Once installed, [start or adopt a project](start.md).
