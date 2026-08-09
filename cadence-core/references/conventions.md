# Cadence conventions

The reference a skill or workflow reads when one of these rules applies to
what it is doing. Loaded on demand, not preloaded: cite it by path where a
rule is relevant, or `@`-include it where a workflow needs the whole set.
Nothing here reaches an agent that has not read it.

## Paths

- Engine: `${CLAUDE_PLUGIN_ROOT}/cadence-core/` - the single canonical engine root,
  resolved by the Claude Code plugin runtime. No host probing, no locator shim.
  Skills @-include workflows from here.
- Project state: `.planning/` in the repo root - the SAME git repo as the code
  it plans (see DESIGN.md canonical set: PROJECT.md, REQUIREMENTS.md,
  ROADMAP.md, STATE.md, phases/<N>/{PLAN,SUMMARY,UAT}.md). Cadence assumes one
  repo holds both plans and code: the protected-branch guard, diffs, and
  goal-check all run where `.planning/` is, so a phase whose code lives in a
  different repo is NOT a supported mode. Keep `.planning/` in the code repo;
  driving a separate code repo from here is the steerer's responsibility, not
  the tool's. (execute.md guards and warns if it detects the split, but does
  not make it work.)
- Phase directory: `.planning/phases/<N>/` where `<N>` is the bare phase integer
  from ROADMAP.md or an `N.M` sub-phase insertion (`phases/1/`, `phases/2/`,
  `phases/2.1/`) - no zero-padding, no slug suffix. That is the WHOLE grammar:
  Cadence resolves no other spelling, ships no second legal form, and migrates
  nothing. The guarantee it makes is that no spelling is ever silently
  redirected to a DIFFERENT phase's directory - every seam builds its path from
  the string the caller typed, so `--phase 08` addresses `phases/08` literally,
  reading it when it exists and reporting a not-found naming it when it does
  not. Anything outside the grammar is unsupported: `/cad-health` REPORTS such a
  directory (a `phase-dir-grammar` entry from `planning.mjs status`) and
  renaming it is the user's call, never an auto-fix.
  Created lazily by the first skill that needs it (cad-context or cad-plan).

## Deliberate shortcuts

A corner cut on purpose is marked at the line it was cut, in whatever comment
syntax the file already uses, on ONE line. The marker is the token
`CADENCE-DEBT` followed immediately by a colon, then three fields in order,
separated by ` | `:

1. the one-line description of what was cut;
2. `ceiling` and a colon, then what it does not handle;
3. `trigger` and a colon, then what should prompt revisiting it.

Both named fields are REQUIRED. A marker missing one is named by the harvest
rather than dropped, so an incomplete marker is visible instead of silent.

`node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" debt-harvest --root .`
collects every marker in the tracked tree into `.planning/CAPTURE.md`'s own
`## Debt markers` section, rewritten wholesale on each run. The MARKER in
tracked code is the durable record; that section is a regenerable view of it, so
deleting a marker from source removes its bullet on the next run. The harvest
does not add its section to the recall walk, so a harvested marker reaches
`/cad-plan`'s recall only when it is promoted by hand.

The token is namespaced so it cannot collide with a marker another tool or
another contributor introduces, and it is not negotiable later: once markers are
planted across a tree, changing the token means editing every one of them.
Measured over this tree with `git grep -w` on 2026-08-09, `SHORTCUT`, `DEBT`,
`CORNER`, `TRIPWIRE`, `CADENCE-DEBT` and `CAD-DEBT` all returned zero, while
`CUT` returned 9 and `CEILING` 1 - so those two were never candidates.

Documentation ABOUT this convention describes the fields in prose, as this
section does, and never writes a literal marker line: the harvest scans tracked
source, so a documented example would be ingested as a real marker.

## Config resolution

The only correct read is the seam - one call for every key the workflow uses:
`node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get <key> ...`.
It layers repo (.planning/config.json) over the user-global file over the
schema defaults, so a raw file read sees at most one layer and lies about the
rest. Read only the keys you need. Unknown keys are ignored, never fatal.

## Parallel work

The coordinator walks a workflow's steps in order, but ordering the STEPS does
not mean serializing the CALLS inside them. When a step's inputs are known-path,
read-only, and mutually independent - several file Reads, a `git` probe, a seam
`get` whose result nothing else in the batch consumes - issue them as parallel
tool calls in ONE message. Serialize only a call that consumes a prior call's
output (a `git diff <a>..<b>` that needs hashes a SUMMARY read just produced, a
follow-up read whose path a first call computed). A numbered list in a workflow
is evaluation order, not a one-call-per-turn mandate.

The same holds for the ask-user seam: independent questions over an independent
set batch into `ceil(N/4)` AskUserQuestion calls (up to 4 questions per call),
not one blocking turn per item. Only questions whose wording depends on an
earlier answer stay sequential.

## State

- `STATE.md` is a 4-line cursor. It is overwritten in place, never appended.
  The only correct writer is the seam (`planning.mjs cursor set` - it derives
  name/total from ROADMAP, validates the status, stamps the date, and writes
  atomically); read it with `cursor get`. Never hand-edit the file. NO audit
  logs, no activity tables, no session narratives - git history is the log.
  Derive views from `git log` on demand.
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
- `paused` adds no extra lines: `Status: paused` with the `Next:` line holding
  cad-pause's one-line resume pointer. The cursor is always exactly these
  four lines - there is no fifth.
- `cad-progress` treats the cursor as a hint: if it disagrees with the derived
  state it rewrites it in this schema. Any skill that changes phase state
  overwrites the cursor and commits it with that step's docs commit - never
  leave it dirty.

## Subagents and reviews

- Spawn agents only through the spawn-agent seam (references/seams.md).
- Every second opinion goes through the review trigger interface
  (references/review-triggers.md). No skill embeds its own reviewer loop.

## Reporting style

- The "safe to /clear first" closer: when a command's durable output is on
  disk (and committed where config says so), its done-report says so in one
  line naming WHAT survives the clear. One line, per-command specifics, no
  ceremony.

- Terse completion reports: what changed, commit hash(es), files touched.
- No next-step menus unless the workflow genuinely forks. One suggestion max.

## Authoring style (for new workflows)

- Structure: `<purpose>`, `<process>` with named `<step>`s, `<guardrails>`,
  `<success_criteria>`. Match the tone and density of workflows/task.md.
- No multi-runtime branches, no CC-bug-number workaround prose, no ASCII
  banner variants. Plain instructions.
