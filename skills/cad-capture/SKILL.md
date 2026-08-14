---
name: cad-capture
description: "Capture a phase-linked todo, a seed idea for a future milestone, or a note, without losing your place - .planning/CAPTURE.md, or --cadence for friction with Cadence itself"
argument-hint: "[todo | seed | note] <text> [--phase N] [--cadence]"
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---

<objective>
Get a thought out of your head and into the right place without derailing. Three
kinds, landing in `.planning/CAPTURE.md` - or, with `--cadence`, in Cadence's own
queue (step 4), because friction with CADENCE noticed while working on somebody
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
   step 4 instead of steps 2-3. If a todo has no `--phase`, default to the
   current phase from the STATE cursor (`cursor get`); if the cursor is absent
   or unparseable, capture it unphased - pass no `--phase` at all - rather than
   guessing a phase or stopping. Under `--cadence` skip the cursor: a phase
   number belongs to this project's roadmap and means nothing in Cadence's
   queue.

2. **Capture through the seam** - one call, and the only way this command
   reaches `.planning/CAPTURE.md`:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" capture --kind <kind> --text "<text>" --phase <N>
   ```

   Pass `--phase` only with `--kind todo`, and leave it off entirely when step 1
   found no phase. The seam owns every byte: it creates the file with its
   headings when absent, puts the bullet under the one heading that kind owns,
   stamps a note's date itself, and holds a lock so a concurrent writer cannot
   erase the line. Do not compose the bullet yourself and do not reach that file
   with any other tool - a second statement of the format is how the queue's
   writer and its reader drifted apart, and five filed items were lost to it.

   An `ok:false` return STOPS the capture: report its `reason` back with the
   user's own sentence, so nothing is lost and they can re-run it, and skip
   step 3. A bullet that did not land is never reported as captured.
   `capture-locked` means another writer holds the queue at this instant, and
   running the call again is the whole fix.

3. **Persist** - the project-directed arm only, never under `--cadence`. Stage
   ONLY `.planning/CAPTURE.md` and commit `docs: capture <kind>`
   (protected-branch guard applies) - this never touches the user's in-flight
   changes. Report the one line captured and where.

4. **`--cadence`: the note is about Cadence itself.** REPLACES steps 2-3.
   - **The queue** sits beside the global config layer: `CAPTURE.md` in the
     directory part of `CADENCE_GLOBAL_CONFIG` when that variable is set, in
     `~/.claude/cadence/` otherwise - the resolution
     `cadence-core/bin/lib/config-merge.mjs` performs for the config file. Never
     `${CLAUDE_PLUGIN_ROOT}`: the next upgrade orphans a write there. Resolve
     that path yourself and hand it to the same seam, which creates the file and
     its directory when absent, so one writer serves both queues:

     ```
     node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" capture --kind <kind> --text "<text>" --file <resolved dir>/CAPTURE.md
     ```

   - **The entry** is the user's own sentence plus two fields, carried inside
     `--text` and never a phase: `<text> (host: <host>, command: /cad-<name>)`.
     HOST: this repo's `origin` URL (`git remote get-url origin`), else the
     basename of the root from `git rev-parse --show-toplevel`, else the
     absolute working directory when this is not a repo - `origin` first because
     a worktree and a detached checkout both still resolve through it. COMMAND:
     the `/cad-*` whose behaviour caused the friction, from the invocation when
     the user names one, asked for once when not.
   - **Quote nothing else from this tree** - no diff, no file contents, no path
     out of the user's own work. There is no redaction machinery here, and this
     rule stands in for it.
   - **Three rails.** (a) NO commit - not in this repo, not in the global
     directory, which is not a working tree at all - so step 3 does not run. (b)
     Nothing is transmitted; a note meant for a maintainer who is not the user
     stays a manual export the user makes. (c) If that directory cannot be
     resolved (`homedir()` throws under an arbitrary UID) or the seam refuses
     the path, say so and STOP - NEVER fall back to `.planning/CAPTURE.md`,
     since a note landing in the host repo is the failure this arm exists to
     close.
   Report the one line captured and the file it landed in.
</process>

<guardrails>
- Do not act on the item now - capture is parking, not doing. A todo is queued,
  not executed.
- Stage only CAPTURE.md; never sweep the user's working changes into the commit.
</guardrails>
