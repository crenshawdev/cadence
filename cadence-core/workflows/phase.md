# cad-phase workflow

CRUD the ROADMAP `## Phases` list. The renumbering ops (insert/remove) are the
reason this is a skill: a phase number appears in FOUR places and they must move
as one.

## The four places a phase number lives
1. **ROADMAP.md** `## Phases` - the `- [ ] **Phase N: Name**` lines.
2. **`.planning/phases/<N>/`** - the phase's directory (PLAN/SUMMARY/UAT/...).
3. **REQUIREMENTS.md** - the traceability table's `Phase` column.
4. **STATE.md** cursor - `Phase: N of <total>`.
Also scan for stray in-text references (`phase 3`, `phases/3/`) in live planning
docs and repair those too.

## Route on $ARGUMENTS

### add
Append a new phase after the last one (number = current total + 1). Get its
name, one-line description, and success criteria (from args or the ask-user
seam). No renumbering. Write ROADMAP; update the cursor's `of <total>`.

### edit <N>
Change phase N's name, description, or success criteria in ROADMAP.md only. A
plain markdown edit - no renumbering, no dir change.

### insert <N>
Insert a new phase at position N, shifting N and everything after it up by one.
1. Confirm N is in range (1..total+1).
2. **Renumber dirs high-to-low** to avoid collisions: for K from total down to
   N, `git mv .planning/phases/<K> .planning/phases/<K+1>` (git mv so history
   follows). Only dirs that exist.
3. Shift ROADMAP phase numbers >= N up by one; insert the new `- [ ]` phase at N
   with its name/description/criteria.
4. Repair references: REQUIREMENTS `Phase` column (every value >= N becomes +1),
   the cursor's `Phase`/`of total`, and any in-text `phase K` / `phases/K/`
   where K >= N.

### remove <N>
Delete phase N, shifting everything after it down by one.
1. Confirm. If `.planning/phases/<N>/` has real work (PLAN/SUMMARY), warn and
   require an explicit yes (ask-user seam) - removal is destructive to that
   phase's planning docs (git still holds them).
2. Remove the phase N line from ROADMAP and delete/`git rm` its dir.
3. **Renumber dirs low-to-high**: for K from N+1 up to total,
   `git mv .planning/phases/<K> .planning/phases/<K-1>`.
4. Shift ROADMAP phase numbers > N down by one.
5. Repair references: REQUIREMENTS `Phase` column (a value == N is now orphaned -
   flag it for reassignment via the ask-user seam, do not silently drop it;
   values > N become -1), the cursor, and in-text `phase K`/`phases/K/`.

## Finish
- Recount `of <total>` everywhere it appears.
- Sanity check: ROADMAP phase count == number of `phases/<N>/` dirs (allowing
  not-yet-created dirs for planned phases); every REQUIREMENTS `Phase` value
  points at an existing phase.
- Commit atomically (`chore: <op> phase N`) honoring the protected-branch guard
  (references/git.md). Cursor committed with it; never leave the tree dirty.
