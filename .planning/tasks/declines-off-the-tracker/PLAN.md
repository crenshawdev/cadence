# Task: declines off the tracker

A declined gate finding currently becomes a public issue on the tracker,
because that label is the only place a decline is remembered. This moves the
decline record to `.planning/DECLINED.md` and stops the forge create.

**Why now:** 49 issues were deleted from `crenshawdev/cadence` on 2026-08-30 -
23 closed declines and 26 open ones still carrying the label. The board went
from 48 open to 22. Nothing stops it regrowing on the next gate fire.

**Already on disk:** `.planning/DECLINED.md` exists, hand-written during that
cleanup, holding 41 fingerprint rows in the `FILED.md` grammar plus 8 human
declines with their bodies. This task makes the seam read and write it.

## Task 1: the DECLINED.md grammar

**Files:** `cadence-core/bin/lib/planning-files.mjs`,
`cadence-core/bin/planning-files.test.mjs`

**Action:** Add `DECLINED_PREAMBLE`, `parseDeclinedRows(text)` and
`appendDeclinedRow(text, row)` beside the `FILED.md` trio. The row grammar is
`FILED_ROW` unchanged - a decline row is the same five fields - so factor the
shared body rather than copying it, and give the parsed rows
`source: 'DECLINED.md'`. Then rewrite `FILED_PREAMBLE`'s sentence "A declined
finding is never written here; its only record is the decline label on the
forge" to point at `DECLINED.md`, keeping the accepted-only rule it states.

`DECLINED_PREAMBLE` says what the file is for in its own words: the dedup key
`issue-filing.mjs unfixed` reads, not a queue, and deliberately NOT part of the
recall corpus - `cmdRecall` reads `CAPTURE.md`, `ARCHIVE.md`, tasks and
`FILED.md` by explicit path, so a new file stays out unless someone adds it.

**Verify:** `node --test cadence-core/bin/planning-files.test.mjs` passes,
including a new case that `appendDeclinedRow` on empty text emits
`DECLINED_PREAMBLE` plus the row, that `parseDeclinedRows` reads that row's
fingerprint back, and that a row whose fields break the grammar returns the
text unchanged. And `grep -c "only record is the decline label on the forge"
cadence-core/bin/lib/planning-files.mjs` prints `0`.

## Task 2: the seam stops touching the forge for a decline

**Files:** `cadence-core/bin/issue-filing.mjs`,
`cadence-core/bin/issue-filing.test.mjs`

**Action:** Three changes, one commit, because a partial leaves the seam
writing declines to a tracker it no longer reads.

1. `readDeclines(dir, forge)` becomes `readDeclines(dir)`: read
   `.planning/DECLINED.md`, parse with `parseDeclinedRows`, return the
   fingerprint set. A missing file is an empty set, not a refusal - nothing
   declined yet is a real state. An unreadable file still refuses, keeping the
   posture that a fire which cannot tell what was declined does not guess.
   The `lookup-failed` and `incomplete-lookup` arms go, and `LOOKUP_TIMEOUT_MS`
   with them: a local file has no page limit, so the criterion-12 refusal has
   nothing left to guard. Say that in the comment rather than deleting the
   reasoning - the loop it protected against is still the loop this file exists
   to end, it is just structurally unreachable now.
2. `cmdUnfixed` calls `readDeclines(dir)` BEFORE `resolveForge`, since the
   decline set no longer needs a forge. Keep `already_declined` counting the
   same thing; its comment saying the figure is "tracker-derived" is now false
   and must change with it.
3. `cmdFile`'s loop skips the forge `create` entirely when
   `disposition === 'decline'`, and `mirrorFiled` writes both files under the
   one `withPlanningFileLock` it already takes: accepts to `FILED.md`, declines
   to `DECLINED.md`. A decline can no longer fail to land on a forge, so the
   `unfiled` refusal path narrows to accepts.

**Verify:** `node --test cadence-core/bin/issue-filing.test.mjs` passes, with a
new case proving a payload of two entries - one `accept`, one `decline` - makes
exactly ONE forge `create` call, and that the declined fingerprint is in
`.planning/DECLINED.md` and absent from `.planning/FILED.md` afterwards. And a
second run of `unfixed` over the same payload reports that finding under
`already_declined` with no forge call made for the lookup.

## Task 3: the workflow stops saying declines become issues

**Files:** `cadence-core/references/triage-gate.md`

**Action:** Rewrite the filing block at `:275-325`. The bullet "a finding the
user does NOT name is filed carrying the decline label" becomes: it is written
to `.planning/DECLINED.md`, which is what stops a later fire asking again. The
paragraph above it that says "every answer becomes an issue on this
repository's own tracker" becomes: an ACCEPTED answer does. Leave the ask shape,
the caps and the one-call discipline alone - those are right and unaffected.

**Verify:** `grep -n "decline label" cadence-core/references/triage-gate.md`
returns nothing that claims a decline reaches the tracker, and
`node --test cadence-core/bin/self-verify.test.mjs` passes, since that check
walks the reference set for weight and reachability.

## Outcome

All three tasks shipped, on `task/declines-off-the-tracker` off `ecaf2fd0`.

- `e1b04895` feat(planning-files): DECLINED.md gets the FILED.md row grammar
- `5f4bcb97` fix(issue-filing): a declined finding never reaches the forge
- `1f439167` docs(triage-gate): the gate stops sending declines to the tracker

Full suite 3649 pass / 0 fail, `self-verify` clean. Eight tests in
`issue-filing.test.mjs` asserted the removed forge lookup and now assert the
local read, including the case that used to REFUSE: 500 declines are read whole
where a 200-row page once made the fire unanswerable.

**Deviation, accepted:** `triage-gate.md` grew 460 bytes past its
`weight-budgets.json` ceiling and the ceiling was raised to 24693 in the same
commit, per that manifest's own rule. The file has to name two destinations
where it named one. The added prose was cut twice before the growth was taken.

**Not in scope and still true:** the 22 issues left open on the tracker include
6 `[cadence <hash>]` findings that were ACCEPTED, not declined. Those are real
work and this task does not touch them.
