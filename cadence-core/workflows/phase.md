# cad-phase workflow

CRUD the ROADMAP `## Phases` list. The list, the REQUIREMENTS `## Traceability`
table and the STATE cursor are generated from the state file: change them
through seams, never by hand. A phase's `### Phase N:` detail section is
hand-written.

## Route on $ARGUMENTS
Any `$ARGUMENTS` carrying `--brief`: Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/phase-design.md` and follow it instead of the routes below.

### add
Append a new phase after the last one (number = current total + 1). Get its
name, one-line description, and success criteria (from args or the ask-user
seam). No renumbering. Enter the list entry, then hand-write its
`### Phase N:` detail section with the criteria:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" phase-entry add --phase <N> --name <name> --description <one line>
```

Text carrying quotes goes in a scratch file passed as `--name-file` or
`--description-file`. When the add leaves no other unfinished phase, the seam
points the cursor at the new phase itself, in the same write, unless the cursor
is paused, which stays as the user left it; never run `cursor set` after it.
When the answer carries `opened_cycle: true`, rewrite the
ROADMAP Overview's sentence that says no cycle is open so it names the cycle
this add opened, and the "no cycle open" sentences a milestone close wrote in
PROJECT.md `### Active` and REQUIREMENTS.md `## Active` the same way; no script
edits the Overview or those sections.

### edit <N>
A name or description change goes through the seam, no renumbering, no dir
change:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" phase-entry edit --phase <N> [--name <name>] [--description <one line>]
```

A success-criteria change is a plain edit to the `### Phase N:` section.

### insert <N>
1. Get the new phase's name, one-line description, and success criteria as
   `### add` does (from args or the ask-user seam), then dry-run first - this is
   what the user confirms:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" renumber insert --at <N> --dry-run
   ```

   Show the returned `ops` (dir moves, file edits), any `in_text_refs`
   (lowercase prose references the seam will NOT rewrite), and any `warn`.
   Show every `req_row_changes` entry verbatim, with its `line`, `before` and
   `after` text, never as a summary.
   Require an explicit yes (ask-user seam).
2. Re-run without `--dry-run`. The seam moves dirs high-to-low (collision-
   safe, `git mv` so history follows), shifts every `Phase K` token and
   `phases/K/` path >= N in ROADMAP, and re-points the cursor's `Phase:` line
   and the phase numbers in its `Next:` command. In REQUIREMENTS it shifts
   only `## Traceability` rows whose Status is `Pending`; Complete and
   Deferred rows, `## Shipped` and every other REQUIREMENTS line stay
   byte-identical.
3. The seam leaves the numbered slot empty (`slot` in its output): fill it with
   `phase-entry add --phase <N>`, the same `--at` number, and the gathered
   name and description, then hand-write that phase's detail section.
4. Repair any reported `in_text_refs` by hand, judging each one.

### remove <N>
1. If `.planning/phases/<N>/` has real work (PLAN/SUMMARY), warn that removal
   is destructive to that phase's planning docs (git still holds them). Batch
   this dir inspection and the step-2 `--dry-run` in one message.
2. Dry-run (`renumber remove --n <N> --dry-run`), show `ops`, the
   `orphaned_reqs` (Pending requirements that pointed at the removed phase),
   any `in_text_refs` and `warn`. Show every `req_row_changes` entry verbatim,
   with its `line`, `before` and `after` text, never as a summary. Require an
   explicit yes.
3. Re-run without `--dry-run`. The seam removes the list line and detail
   section, `git rm`s the dir, renumbers low-to-high, and re-points the
   cursor's `Phase:` line and the phase numbers in its `Next:` command. In
   REQUIREMENTS it changes only Pending `## Traceability` rows, blanking the
   Pending orphans' Phase cells (they surface as `no-phase` in /cad-audit -
   never silently dropped); Complete and Deferred rows, `## Shipped` and every
   other line stay byte-identical.
4. Ask (ask-user seam) where each orphaned requirement goes, a phase the state
   holds or Deferred, and apply the answer with
   `req-row --id <id> --phase <N>` or `req-row --id <id> --defer`. Repair
   reported `in_text_refs` by hand, judging each one.

## Finish
- A failed apply (`ok:false`, `partial-apply`, with a `completed` list) leaves
  the tree partly renumbered, and the state file, written last, still holds the
  old numbering unless the detail says it was written. Reverse the completed
  directory moves and text edits until `status` is clean, before committing
  anything; never edit the list, the table, `STATE.md` or
  `.planning/records/state.json` to match a half-moved tree.
- Sanity: spot-check `planning.mjs status` runs clean.
- Commit atomically (`chore: <op> phase N`) honoring the protected-branch
  guard (references/git-guard.md). Cursor and `.planning/records/state.json`
  committed with it; never leave the tree
  dirty.
