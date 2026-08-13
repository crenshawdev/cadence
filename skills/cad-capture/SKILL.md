---
name: cad-capture
description: "Capture a phase-linked todo, a seed idea for a future milestone, or a note, without losing your place - .planning/CAPTURE.md, or --cadence for friction with Cadence itself"
argument-hint: "[todo | seed | note] <text> [--phase N] [--cadence]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - AskUserQuestion
---

<objective>
Get a thought out of your head and into the right place without derailing. Three
kinds, landing in `.planning/CAPTURE.md` - or, with `--cadence`, in Cadence's own
queue (step 5), because friction with CADENCE noticed while working on somebody
else's project has to leave that project to reach Cadence:
- **todo** - an actionable item, tagged to a phase, so it resurfaces where it
  matters. This is the phase-linked queue mem-* lacks and the reason this exists.
- **seed** - an idea for a future phase or milestone, parked in the backlog.
- **note** - a free note; lands in the file like the rest. With
  `memory.backend: builtin` (the default) the note becomes recallable - it is
  still written here, `builtin` only reads `.planning/` back, never relocates
  the write.
</objective>

<process>
1. **Parse** `$ARGUMENTS`: leading `todo | seed | note` (default `todo` if
   omitted), the text, an optional `--phase N`, and an optional `--cadence` -
   this note is about CADENCE, not about the project you are in, so it goes to
   step 5 instead of steps 2-4. If a todo has no `--phase`, default to the
   current phase from the STATE cursor (`cursor get`); if the cursor is absent
   or unparseable, capture it unphased - `- [ ] <text>` with no phase tag -
   rather than guessing a phase or stopping. Under `--cadence` skip the cursor:
   a phase number belongs to this project's roadmap and means nothing in
   Cadence's queue.

2. **Ensure the file.** If `.planning/CAPTURE.md` is absent, create it with three
   headings: `## Todos`, `## Seeds`, `## Notes`. (When step 1 needs `cursor get`,
   batch it with this existence check in one message - independent;
   conventions.md Parallel work.)

3. **Append by kind:**
   - todo -> `- [ ] (phase N) <text>` under `## Todos`.
   - seed -> `- <text>` under `## Seeds`.
   - note -> `- <YYYY-MM-DD> <text>` under `## Notes`. (CAPTURE.md is always
     the write path; `memory.backend: builtin` makes these notes recallable
     via `planning.mjs recall`, and `none` turns that recall off.)

4. **Persist** - the project-directed arm only, never under `--cadence`. Stage
   ONLY `.planning/CAPTURE.md` and commit `docs: capture <kind>`
   (protected-branch guard applies) - this never touches the user's in-flight
   changes. Report the one line captured and where.

5. **`--cadence`: the note is about Cadence itself.** REPLACES steps 2-4.
   - **The queue** sits beside the global config layer: `CAPTURE.md` in the
     directory part of `CADENCE_GLOBAL_CONFIG` when that variable is set, in
     `~/.claude/cadence/` otherwise - the resolution
     `cadence-core/bin/lib/config-merge.mjs` performs for the config file. Never
     `${CLAUDE_PLUGIN_ROOT}`: the next upgrade orphans a write there. Create it
     with step 2's three headings when absent, so one reader serves both files.
   - **The entry** is the user's own sentence plus two fields, appended under the
     kind's heading as in step 3 minus the phase tag:
     `- <YYYY-MM-DD> <text> (host: <host>, command: /cad-<name>)`. HOST: this
     repo's `origin` URL (`git remote get-url origin`), else the basename of the
     root from `git rev-parse --show-toplevel`, else the absolute working
     directory when this is not a repo - `origin` first because a worktree and a
     detached checkout both still resolve through it. COMMAND: the `/cad-*` whose
     behaviour caused the friction, from the invocation when the user names one,
     asked for once when not.
   - **Quote nothing else from this tree** - no diff, no file contents, no path
     out of the user's own work. There is no redaction machinery here, and this
     rule stands in for it.
   - **Three rails.** (a) NO commit - not in this repo, not in the global
     directory, which is not a working tree at all - so step 4 does not run. (b)
     Nothing is transmitted; a note meant for a maintainer who is not the user
     stays a manual export the user makes. (c) If that directory cannot be
     resolved or written (`homedir()` throws under an arbitrary UID), say so and
     STOP - NEVER fall back to `.planning/CAPTURE.md`, since a note landing in
     the host repo is the failure this arm exists to close.
   Report the one line captured and the file it landed in.
</process>

<guardrails>
- Do not act on the item now - capture is parking, not doing. A todo is queued,
  not executed.
- Stage only CAPTURE.md; never sweep the user's working changes into the commit.
</guardrails>
