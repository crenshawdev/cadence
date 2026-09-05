---
name: cad-config
description: "Configure Cadence's config.json - workflow toggles, the per-role model and effort interview, and interactive cross-model review provider setup"
argument-hint: "[--review [redetect] | --surfaces | --roles [--global] | <key>=<value> ...]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - AskUserQuestion
---

<objective>
Manage `.planning/config.json` (template in
`cadence-core/templates/config.json`). One skill for the whole config; its
substantive part is review-provider model assignment, which needs live
detection (call the provider models endpoint, classify, assign per tier).

Routing:
- **--review [redetect]**: run the cross-model review-provider setup - detect
  each provider's accessible models and assign them to the flagship/balanced/
  cheap tiers.
- **--surfaces**: re-open the one-time risk-surface question - the answered set
  beside what the structure evidences now, re-answerable or declinable.
- **--roles [--global]**: the thirteen questions that say what each of the six
  roles costs - a model and a start rung per role, then the risk floor. Writes
  repo-layer diffs by default; `--global` re-enters the full thirteen against
  the user-global layer.
- **`<key>=<value>` ...**: set config keys directly (validated against the config schema).
- **default** (no args): walk every knob as a selectable list (batched pages),
  each preselected to its current value.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/config.md
</execution_context>

<process>
Parse `$ARGUMENTS`, then execute the matching branch of the config workflow
end-to-end. Never write an invalid config; never block the spine on a network
call (detection degrades to claude-subagent).
</process>
