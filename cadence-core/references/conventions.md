# Cadence conventions

Shared rules every skill and workflow follows. Referenced, not repeated.

## Paths

- Engine: `$HOME/.claude/cadence-core/` - the ONE hardcoded location. No host
  probing, no locator shim. Skills @-include workflows from here.
- Project state: `.planning/` in the repo root (see DESIGN.md canonical set:
  PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, phases/<N>/{PLAN,SUMMARY,UAT}.md).
- Phase directory: `.planning/phases/<N>/` where `<N>` is the bare phase integer
  from ROADMAP.md (`phases/1/`, `phases/2/`, ... no zero-padding, no slug suffix).
  Created lazily by the first skill that needs it (cad-context or cad-plan).
  Match an existing directory's name if one is already present.

## Config resolution

1. `.planning/config.json` if present.
2. Else the defaults in `$HOME/.claude/cadence-core/templates/config.json`.
Read only the keys you need. Unknown keys are ignored, never fatal.

## State

- `STATE.md` is a 4-line cursor. It is overwritten in place, never appended. NO
  audit logs, no activity tables, no session narratives - git history is the
  log. Derive views from `git log` on demand.
- Canonical cursor schema - every writer emits exactly these four lines under a
  `# State` heading, in this order:

  ```
  Phase: <N> of <total> (<phase name>)
  Status: <lifecycle value>
  Next: <the one command to run next>
  Updated: <YYYY-MM-DD>
  ```

- Status lifecycle (the only permitted values, one per spine step):
  `ready to plan` (new-project) -> `context gathered` (context) -> `planned`
  (plan) -> `executed` (execute) -> `phase complete` (verify). `paused`
  (cad-pause) is allowed at any point. Do not invent other values.
- `cad-progress` treats the cursor as a hint: if it disagrees with the derived
  state it rewrites it in this schema. Any skill that changes phase state
  overwrites the cursor and commits it with that step's docs commit - never
  leave it dirty.

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
