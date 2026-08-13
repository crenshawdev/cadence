---
phase: 3
plan: 3
requirements: [XCP-01]
files:
  - skills/cad-capture/SKILL.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 3: The lens and the loop back - Plan 3 (the loop back to Cadence)

## Goal

Friction with Cadence itself, noticed while using Cadence on somebody else's
project, lands in Cadence's own queue outside every project boundary - carrying
the host project and the command that provoked it, writing nothing into the host
repo and transmitting nothing anywhere.

## Must be true when done

- `/cad-capture` has a Cadence-directed arm that appends to the user-global
  Cadence queue beside the global config layer, never to the host project's
  `.planning/CAPTURE.md`.
- A Cadence-directed entry names the host project and the command that provoked
  it, and quotes nothing else from the host tree.
- The arm makes no commit anywhere and sends nothing over a network; the host
  repo's working tree and index are untouched by it.
- When the global queue's location cannot be resolved, the arm says so and stops
  rather than falling back to the host project's queue.
- The default (project-directed) arm of `/cad-capture` behaves exactly as it
  does today, commit step included.

## Context

- D-07 locks the target: the user-global Cadence directory beside the global
  config layer - `~/.claude/cadence/`, relocated with the config file by
  `CADENCE_GLOBAL_CONFIG` (`cadence-core/bin/lib/config-merge.mjs:11-26`), and
  explicitly NOT under `${CLAUDE_PLUGIN_ROOT}`, whose every cache version is
  orphaned by the next plugin upgrade.
- D-08 locks the posture: no commit in the target, no transmission, delivery to
  a maintainer who is not the user stays a manual export.
  `README.md:132`'s "ships no instrumentation and phones nothing home" is
  CI-adjacent prose carried as ledger row `README-41`.
- D-09 locks the content: the author's own sentence plus two mechanically-known
  fields, host project and provoking command. No redaction machinery is built -
  `EVD-01` stays deferred - and host identity comes from the repo, since no seam
  returns a project name.
- Out of scope here: the `/cad-capture` rows in
  `cadence-core/references/COMMANDS.md` and `README.md` are not edited - the
  CONTEXT scope boundary names those surfaces for this phase's two NEW commands
  only.

## Tasks

### Task 1: Add the Cadence-directed arm to `/cad-capture`

- **Files:** skills/cad-capture/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** Give `skills/cad-capture/SKILL.md` a second write target, selected
  by an explicit flag in `$ARGUMENTS` (the skill's step 1 already parses a leading
  kind and an optional `--phase N`; add the flag beside them and name it in the
  frontmatter `argument-hint`). Its meaning: this note is about CADENCE, not about
  the project you are in. The arm writes to the user-global Cadence queue - the
  directory holding the global config layer, which is the directory part of
  `CADENCE_GLOBAL_CONFIG` when that variable is set and `~/.claude/cadence/`
  otherwise, exactly the resolution `cadence-core/bin/lib/config-merge.mjs:11-26`
  performs - as a `CAPTURE.md` in that directory, created with the same three
  headings (`## Todos`, `## Seeds`, `## Notes`) as a project queue when absent, so
  one reader serves both files. The entry is the author's own sentence plus two
  fields and nothing else: the HOST PROJECT, identified as the current repo's
  `origin` remote URL when it has one, else the basename of the repo root from
  `git rev-parse --show-toplevel`, else the absolute working directory when this
  is not a repo at all - a worktree and a detached checkout both still resolve
  through `origin`, which is why it is preferred; and the PROVOKING COMMAND, the
  `/cad-*` command whose behaviour caused the friction, taken from the invocation
  when the user names one and otherwise asked for once. State as prose, at the arm,
  that nothing else from the host tree is quoted - no diff, no file contents, no
  path from the user's own work - because there is no redaction machinery in this
  tree and this rule is what stands in for it (D-09). Three rails, stated
  explicitly because each is a way this arm could become the thing XCP-01 exists
  against: it makes NO commit - not in the host repo, not in the global directory
  (which is not a working tree at all) - so the existing step-4 commit belongs to
  the project-directed arm only and must be scoped to it rather than left reading
  as unconditional; it sends nothing anywhere, and a note meant for a maintainer
  who is not the user stays a manual export the user makes; and if the global
  directory cannot be resolved or cannot be written - `homedir()` throws under an
  arbitrary UID, which is why the seam degrades to an empty path - it says so and
  stops, and NEVER falls back to the host's `.planning/CAPTURE.md`, since a note
  landing in the host repo is precisely the failure this arm exists to close.
  Leave the project-directed arm's behaviour byte-for-byte as it is, commit step
  included. Re-pin `skills/cad-capture/SKILL.md` in
  `cadence-core/bin/weight-budgets.json` to the newly measured byte count in the
  same commit - the surface sits at its row today, so new prose is a
  `budget-overrun` without it.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`;
  `node cadence-core/bin/weight.mjs` reports `skills/cad-capture/SKILL.md` at
  exactly its `cadence-core/bin/weight-budgets.json` row; and
  `grep -n 'CADENCE_GLOBAL_CONFIG' skills/cad-capture/SKILL.md` shows the arm
  resolving the queue through the same variable the config layer uses.
  human-verify: from inside a host project that is not Cadence, run
  `/cad-capture` with the Cadence-directed flag and a one-sentence note, then
  observe (1) the note appended to the global Cadence `CAPTURE.md` with the host
  project and the provoking command named, (2) that host's
  `.planning/CAPTURE.md` unchanged, and (3) `git status --short` in the host repo
  identical before and after the run.

## Notes

- How the host is identified was left unsettled by CONTEXT and is decided here:
  `origin` URL first, repo-root basename second, absolute working directory
  last. The ordering answers the worktree/detached-checkout case the flagged
  assumption raised, because both still carry `origin`.
- The queue file is a plain `CAPTURE.md` in the global directory rather than a
  new format: `planning.mjs recall` reads a project's `.planning/` only, so the
  global queue is deliberately outside the recall corpus, exactly as the
  maintainer's own gitignored queue already is.
- This plan shares `cadence-core/bin/weight-budgets.json` with plans 1, 2 and 4,
  so the phase's plans run sequentially; it has no ordering constraint against
  any of them beyond that.
