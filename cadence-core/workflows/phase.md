# cad-phase workflow

CRUD the ROADMAP `## Phases` list. The renumbering ops (insert/remove) are the
reason this is a skill: a phase number appears in FOUR places (ROADMAP list,
`.planning/phases/<N>/` dirs, the REQUIREMENTS `Phase` column, the STATE
cursor) and renumbering keeps them in step. One exception: insert and remove
shift the REQUIREMENTS column only on Pending `## Traceability` rows and leave
Complete and Deferred rows as written, since they record where work shipped. The
mechanics live in the planning seam's `renumber` subcommand - this workflow
gathers the judgment inputs, shows the dry-run at the confirmation gate, and
repairs what the seam deliberately leaves to judgment.

## Route on $ARGUMENTS

### add
Append a new phase after the last one (number = current total + 1). Get its
name, one-line description, and success criteria (from args or the ask-user
seam). No renumbering. Write the ROADMAP list line and detail section; update
the cursor's total: read the current cursor first (`cursor get`), then re-write
it via `cursor set` with that same phase/status/next (the new total is
re-derived from ROADMAP). `cursor set` requires `--phase` and does not preserve
the prior one, so the get is not optional.

### edit <N>
Change phase N's name, description, or success criteria in ROADMAP.md only. A
plain markdown edit - no renumbering, no dir change.

### insert <N>
1. Dry-run first - this is what the user confirms:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" renumber insert --at <N> --dry-run
   ```

   Show the returned `ops` (dir moves, file edits), any `in_text_refs`
   (lowercase prose references the seam will NOT rewrite), and any `warn`.
   Show every `req_row_changes` entry verbatim, with its `line`, `before` and
   `after` text, never as a summary: those are the REQUIREMENTS rows the user
   is confirming.
   Require an explicit yes (ask-user seam).
2. Re-run without `--dry-run`. The seam moves dirs high-to-low (collision-
   safe, `git mv` so history follows), shifts every `Phase K` token and
   `phases/K/` path >= N in ROADMAP, and re-points the cursor's `Phase:` line
   and the phase numbers in its `Next:` command. In REQUIREMENTS it shifts
   only `## Traceability` rows whose Status is `Pending`; Complete and
   Deferred rows, `## Shipped` and every other REQUIREMENTS line stay
   byte-identical.
3. The seam leaves the numbered slot empty (`slot` in its output): write the
   new `- [ ] **Phase N: Name**` line and its detail section from the
   gathered name/description/criteria.
4. Repair any reported `in_text_refs` by hand - they need judgment (a prose
   "phase 3" may or may not mean the renumbered phase).

### remove <N>
1. If `.planning/phases/<N>/` has real work (PLAN/SUMMARY), warn that removal
   is destructive to that phase's planning docs (git still holds them). (This
   dir inspection and the step-2 `--dry-run` are independent read-only probes -
   batch them in one message; only a call that consumes a prior call's output
   is serialized.)
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
4. Reassign each orphaned requirement, all Pending rows, via the ask-user seam
   (a new phase, or Deferred), and repair reported `in_text_refs` by hand.

## Finish
- A failed apply (`ok:false` with a `completed` list) leaves the tree partly
  renumbered - the seam is not transactional - reconcile those ops by hand
  before committing anything.
- Sanity: spot-check `planning.mjs status` runs clean.
- Commit atomically (`chore: <op> phase N`) honoring the protected-branch
  guard (references/git-guard.md). Cursor committed with it; never leave the tree
  dirty.
