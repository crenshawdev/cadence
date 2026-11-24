---
name: cad-config
description: "Configure Cadence's config.json - workflow toggles, the per-role model and effort interview, and interactive cross-model review provider setup"
argument-hint: "[--walk | --review [redetect] | --surfaces | --testing | --roles [--global] | <key>=<value> ... | what you want to change]"
allowed-tools:
  - Read
  - Write
  - Edit
  - AskUserQuestion
  - PushNotification
---

<objective>
Manage `.planning/config.json`. config.md's Route picks the arm from the argument.
`workflow.config_menu` is off by default; `/cad-config workflow.config_menu=true`
turns the menu on.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/config.md
</execution_context>

<process>
Parse `$ARGUMENTS`, then execute the matching branch of the config workflow
end-to-end.

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
