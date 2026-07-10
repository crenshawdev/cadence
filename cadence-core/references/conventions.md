# Cadence conventions

Shared rules every skill and workflow follows. Referenced, not repeated.

## Paths

- Engine: `$HOME/.claude/cadence-core/` - the ONE hardcoded location. No host
  probing, no locator shim. Skills @-include workflows from here.
- Project state: `.planning/` in the repo root (see DESIGN.md canonical set:
  PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, phases/<N>/{PLAN,SUMMARY,UAT}.md).

## Config resolution

1. `.planning/config.json` if present.
2. Else the defaults in `$HOME/.claude/cadence-core/templates/config.json`.
Read only the keys you need. Unknown keys are ignored, never fatal.

## State

- `STATE.md` is a ~4-line cursor (current phase / status / next action). It is
  overwritten, never appended. NO audit logs, no activity tables, no session
  narratives - git history is the log. Derive views from `git log` on demand.

## Subagents and reviews

- Spawn agents only through the spawn-agent seam (references/seams.md).
- Every second opinion goes through the review trigger interface
  (references/review-triggers.md). No skill embeds its own reviewer loop.

## Reporting style

- Terse completion reports: what changed, commit hash(es), files touched.
- No next-step menus unless the workflow genuinely forks. One suggestion max.

## Authoring style (for new workflows)

- Structure: `<purpose>`, `<process>` with named `<step>`s, `<guardrails>`,
  `<success_criteria>`. Match the tone and density of workflows/task.md.
- No multi-runtime branches, no CC-bug-number workaround prose, no ASCII
  banner variants. Plain instructions.
