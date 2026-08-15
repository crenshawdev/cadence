---
phase: 5
plan: 3
requirements: [DOC-02]
files:
  - .planning/DOCS-CLAIMS.md
---

# Phase 5: What Cadence claims about itself is true - Plan 3 (the ledger)

## Goal

`.planning/DOCS-CLAIMS.md` stops being a run-1 artifact: every row is dated by
the run that last verdicted it, the rows phase 4's `trace close` invalidated say
what the live files say, every doc that moved since `a6b8931` is re-pinned, and
`/cad-capture --cadence` finally has a row.

## Must be true when done

- Every data row in both of the ledger's claim tables carries a `run` cell whose
  value is `1` or `2`, and no cell in any row is empty or reads `pending`. No row
  reads `1` because its file went unswept - every ledgered `doc` is inside run 2's
  surface.
- The ledger's header records a `## Run 2` section, positioned after `## Run 1`,
  naming FIVE invocations - the three run-1 strings unchanged, a fourth over
  `adopt.md`, `minimalism-review.md`, `report.md` and `suggest.md`, and a fifth
  over `references/config-catalog.md`, `references/recall.md` and
  `references/plan-revision.md` - plus the targeted `.mjs` pass, the two run-2
  report paths, and run 2's counts.
- Opening any row of any doc that changed since `a6b8931` at its cited line shows
  that row's claim text, except for rows explicitly verdicted `stale` with a
  resolution stating the claim is no longer made anywhere in the file.
- The seven rows task 3 rewrote still carry a `stale` verdict at the phase's
  close - no later task imported an `accurate` verdict over them.
- `grep -c -- "--event return\|--event checkpoint" .planning/DOCS-CLAIMS.md`
  returns 0, and rows `PLAN-18`, `PLAN-19`, `CONTEXT-14`, `EXECUTE-17`,
  `EXECUTE-18`, `VERIFY-DEEP-05` and `VERIFY-DEEP-12` each carry a `stale` verdict
  and a resolution naming the rewrite.
- At least one row's claim text names `/cad-capture --cadence`.
- No file outside `.planning/DOCS-CLAIMS.md` is modified by this plan.

## Context

Locked by `phases/5/CONTEXT.md`. D-02: "a verdict dated this cycle" is carried by
a `run` column holding `1` or `2` per row, GENERATED rather than typed - not a
date cell and not a section split, because a section split dates only NEW claims
and leaves the 548 existing rows uncovered. D-03: phase 4's `trace close`
invalidated seven rows by claim TEXT, so they are re-verdicted `stale` and their
text REWRITTEN under the ledger's own call-it-out rule at `:130-137` - a silent
re-pin makes next cycle's diff report seven brand-new extractions where seven
fixes happened. D-08: line re-pinning is scoped to the docs that actually moved;
the eight byte-identical workflow files' 55 rows are NOT re-read. Its enumeration
was taken against `81bdb5d` while AC2 states the `a6b8931` baseline, and the
user's 2026-08-14 triage of the `plan` review bound task 4 to the criterion's
baseline - 23 docs, 493 rows - which keeps D-08's actual saving, since the eight
byte-identical files are the same eight under either baseline (see Notes).
D-11: both
`--cadence` user surfaces already shipped in `bd231ec`, so the outstanding work
is one row plus verification of the two surfaces, never a re-edit. The join rule
is `doc` plus claim TEXT (`:70-73`) and the resolution vocabulary is fixed at
`:146-152`. Out of scope: correcting any newly stale prose the sweep found -
`phases/5/CONTEXT.md` names `README.md:97`'s `trace suggest` mention explicitly as
a claim the sweep may extract and that no criterion here requires fixed.

This plan consumes `.planning/phases/5/docs-verify-run-2-a.md` and
`-b.md`, produced by plans 1 and 2, and runs after both.

## Tasks

### Task 1: Record the Run 2 section in the ledger header

- **Files:** .planning/DOCS-CLAIMS.md
- **Action:** Add a `## Run 2` section immediately AFTER the existing `## Run 1`
  section - that is, after its last line at `:52` and before whatever heading
  follows, never above it - written in the same shape. Inserting it after is what
  keeps this task's own `:28-30` citations valid while the task is running: those
  three lines are inside `## Run 1`, and an insertion above would move them mid-task
  and break both the transcription source and this task's verify. It states: the
  sweep date and the sha run 2 read at; the surface (32 files with their byte
  total, against run 1's 25 files / 268,992 B); the FIVE invocation strings, the
  first three transcribed byte-identically from `:28-30`, the fourth naming
  `adopt.md`, `minimalism-review.md`, `report.md`, `suggest.md` and the fifth
  naming `references/config-catalog.md`, `references/recall.md` and
  `references/plan-revision.md`, with the D-01 reason a new invocation was added
  in each case rather than an existing glob widened; the targeted `.mjs` pass that
  verdicted the ten rows citing `lib/trace.mjs`, `planning.mjs` and
  `self-verify.mjs` by reading each cited site, and why it is a targeted pass
  rather than a sixth invocation (298,480 B of code to decide ten claims); the
  two report paths `.planning/phases/5/docs-verify-run-2-a.md` and
  `-b.md`; run 2's counts, given separately for the three re-run invocations (the
  set comparable against run 1's 509/18/20 = 547), for the new fourth, for the new
  fifth, and for the targeted `.mjs` pass, with only the first comparable to run
  1; and the re-pin scope this cycle applied - every ledgered doc that changed
  since `a6b8931`, which measured is 23 of the 31 docs the ledger cites and 493 of
  its 548 rows, against the eight byte-identical whose 55 rows were not re-read
  (`config-review` 10, `coverage` 8, `docs-verify` 4, `phase` 13, `plan-gaps` 4,
  `spike` 2, `undo` 8, `verify-sweep` 6). State the reason the scope is the
  `a6b8931` baseline rather than D-08's seven: D-08 enumerated the docs that moved
  since `81bdb5d`, this cycle's own commits, while phase success criterion 1 is
  written against `a6b8931` and asks that no row cite a line that has moved at
  all. Where the two disagree the criterion wins, and the eight byte-identical
  files are the same eight under either baseline, which is what makes the wider
  scope cost nothing in re-read surface it could have skipped. Also state, so the
  next cycle is not misled, that NO ledgered `doc` sits outside run 2's reach:
  invocation 5 and the targeted `.mjs` pass closed the 42 rows across six files
  that run 2's first four invocations could not reach, so every row in the ledger
  carries a run-2 verdict rather than a run-1 one carried forward. Do not touch
  the `## Run 1` section's numbers - they are the record of what run 1 read.
- **Verify:** `grep -n "^## Run 1" .planning/DOCS-CLAIMS.md` and
  `grep -n "^## Run 2" .planning/DOCS-CLAIMS.md` each return one line and the Run
  1 line number is the SMALLER of the two; the section quotes five invocation
  strings and the first three are byte-identical to the strings at `:28-30` with
  their numbering prefix stripped; `grep -c "509 accurate"
  .planning/DOCS-CLAIMS.md` still returns 1; and the section names all three
  `.mjs` files of the targeted pass.

### Task 2: Add the generated `run` column to both claim tables

- **Files:** .planning/DOCS-CLAIMS.md
- **Action:** Add a seventh column, `run`, to the `## Claims` table (header at
  `:195`, separator at `:196`, 547 data rows) and to the `## Claims added after
  run 1` table (header at `:757`), appended as the LAST column so no existing
  column's position moves and any reader indexing from the left still reads
  correctly. Every data row gets a non-empty value. GENERATE the values, never
  type them: write a throwaway script outside the repo (the scratchpad, so it
  cannot land as an undeclared file) that reads the ledger and both run-2 reports
  and joins on `doc` plus claim TEXT - the ledger's own join rule at `:70-73` -
  emitting `2` where the run-2 reports carry a matching claim for that doc and
  `1` where they do not. Run 2's surface reaches every ledgered `doc` - invocation
  5 and the targeted `.mjs` pass exist precisely so that no row reads `1` merely
  because nothing looked at its file - so a `1` here means the join found no
  matching claim TEXT for a doc that WAS swept, which is a real signal and not a
  coverage hole: the claim was removed, reworded, or is one task 4 must repair.
  Report the count of `1` rows and their docs when the script runs, rather than
  letting them pass silently. Then add a
  short paragraph to `## Reading this ledger` stating what the column means - the
  run that last verdicted the row - and why it is a run number rather than a date
  cell or a run-scoped section: a section split covers only new claims, so the
  548 existing rows would carry no this-cycle verdict, and a run number survives
  a third cycle without another schema change (D-02). Do not update the seven
  rows named in task 3 here; task 3 re-derives their cells after their text
  changes.
- **Verify:** `awk -F'|' '/^\| [A-Z]/ {print NF}' .planning/DOCS-CLAIMS.md | sort
  -u` returns a single value (every data row has the same cell count), and
  `awk -F'|' '/^\| [A-Z]/ {gsub(/ /,"",$8); print $8}' .planning/DOCS-CLAIMS.md |
  sort | uniq -c` shows only `1` and `2` with no empty value, over 548 rows.

### Task 3: Re-verdict and rewrite the seven rows phase 4's `trace close` invalidated

- **Files:** .planning/DOCS-CLAIMS.md
- **Action:** Seven rows state the superseded `trace append ... --event
  return/checkpoint` spelling against workflow files that now make a single
  `trace close` call: `PLAN-18` (`:625`), `PLAN-19` (`:626`), `CONTEXT-14`
  (`:486`), `EXECUTE-17` (`:539`), `EXECUTE-18` (`:540`), `VERIFY-DEEP-05`
  (`:686`) and `VERIFY-DEEP-12` (`:693`). For each: set the verdict to `stale`,
  rewrite the claim text to what the LIVE file states, re-pin the `line` cell to
  where the live file states it, and write a resolution naming the rewrite and
  the phase-4 change behind it. The live calls are
  `cadence-core/workflows/plan.md:196` and `:293`,
  `cadence-core/workflows/context.md:188`,
  `cadence-core/workflows/execute.md:206` and
  `cadence-core/workflows/verify-deep.md:19`; the surrounding prose is what states
  the checkpoint-versus-return rule (`--detail` present closes a `checkpoint`,
  omitted closes a `return`; `--tokens` omitted on a figureless return) so read
  each site before writing its claim rather than paraphrasing this task. Then add
  a paragraph to `## Reading this ledger` calling the rewrite out, in the same
  shape as the README-44 callout at `:130-144`: the join is `doc` plus claim text,
  so a silently rewritten claim joins to nothing next cycle and reports as a new
  extraction rather than as a fix. Re-derive each of the seven rows' `run` cell
  against the run-2 reports after the rewrite.
- **Verify:** `grep -c -- "--event return\|--event checkpoint"
  .planning/DOCS-CLAIMS.md` returns 0; `grep -- "^| PLAN-18 \|^| PLAN-19 \|^|
  CONTEXT-14 \|^| EXECUTE-17 \|^| EXECUTE-18 \|^| VERIFY-DEEP-05 \|^|
  VERIFY-DEEP-12 " .planning/DOCS-CLAIMS.md` returns seven lines, each carrying a
  `stale` verdict cell and a resolution naming the rewrite; and opening each of
  those seven rows' cited lines in its `doc` file shows the row's claim text.

### Task 4: Re-pin every row whose doc moved since `a6b8931`

- **Files:** .planning/DOCS-CLAIMS.md
- **Action:** Re-pin the `line` cell of every row whose `doc` changed since
  `a6b8931`. Measured with
  `git diff --quiet a6b8931 HEAD -- <doc>` per distinct `doc` value, that is 23 of
  the 31 docs the ledger cites and 493 of its 548 rows, less the seven task 3
  already re-pinned. The eight byte-identical files - `config-review.md`,
  `coverage.md`, `docs-verify.md`, `phase.md`, `plan-gaps.md`, `spike.md`,
  `undo.md`, `verify-sweep.md`, 55 rows - are NOT re-read, which is D-08's saving
  and it survives the wider baseline unchanged because those same eight are
  byte-identical under `a6b8931` too. Run that per-doc `git diff --quiet` check
  yourself rather than trusting this list; it is a measurement, and a doc that
  moved after this plan was written must be re-pinned like any other.
  GENERATE these re-pins, do not hand-read 486 rows: the two run-2 reports already
  record a live `location` for every claim they extracted (the
  `claim | location | verdict | correct value (if stale)` shape
  `cadence-core/workflows/docs-verify.md:46` states), so extend the task-2 join
  script to emit each joined row's `line` cell from its report location. The join
  is `doc` plus claim TEXT, the ledger's own rule at `:70-73`. This is why the
  wider scope is affordable at all: it costs a script change, not 486 file reads.
  Two classes need a HUMAN read rather than the script, and they are small:
  1. A row the join could not match - its claim text is no longer stated in its
     file. Do NOT leave it silently: open the live file, and if the claim is
     stated in changed words, re-pin to that line and record the row id for task
     5, which sets its verdict. If it is not stated anywhere, leave the `line`
     cell alone and record the row id for task 5 as an orphan. Either way the row
     leaves this task on a list task 5 consumes, never on a cited line that no
     longer shows its claim - a re-pin is a location fix and must not become a
     silent claim rewrite, which is the failure D-03 exists to prevent.
  2. The rows of the six files run 2 reached through invocation 5 and the targeted
     `.mjs` pass, whose report locations are equally live and join the same way -
     no special handling, named here only so they are not mistaken for out of
     scope.
  Write the two lists task 5 needs (re-pinned-with-changed-wording, and orphaned)
  into the task's report to the user. Do not touch any row's `claim`, `verdict` or
  `resolution` cell in this task.
- **Verify:** `node -e` over the ledger and the two run-2 reports asserts that for
  every row whose `doc` is one of the moved docs and whose claim text the reports
  carry, the row's `line` cell equals that claim's report location - printing any
  mismatch, and printing nothing when they all agree; the orphan list is stated
  explicitly (an empty list stated as empty, never omitted); a spot read of at
  least one row per moved doc at its cited line shows that row's claim text; and
  `git diff .planning/DOCS-CLAIMS.md` for this task shows changes only in `line`
  cells.

### Task 5: Land run 2's verdicts on the rows it joined

- **Files:** .planning/DOCS-CLAIMS.md
- **Action:** For every row carrying `run` `2`, set its `verdict` cell to the
  verdict run 2's report gave that claim, EXCEPT the seven rows task 3 rewrote.
  Those seven - `PLAN-18`, `PLAN-19`, `CONTEXT-14`, `EXECUTE-17`, `EXECUTE-18`,
  `VERIFY-DEEP-05`, `VERIFY-DEEP-12` - keep the `stale` verdict and the rewrite
  resolution task 3 gave them, and this task must not touch their verdict or
  resolution cells. The carve-out is not a special case, it is the point of D-03:
  task 3 rewrote their claim text to what the live file states, so run 2 verdicts
  that rewritten text `accurate`, and importing that verdict here would erase the
  record that these seven were the rows phase 4's `trace close` invalidated. The
  `stale` verdict is the finding; the resolution is the fix. Check the seven by id
  before writing any verdict, since after task 3 their text no longer distinguishes
  them from any other accurate row.
  A row whose verdict run 2 confirms as
  `accurate` and whose resolution already reads `accurate` needs no other change;
  a row run 2 finds `stale` or `unverifiable` gets that verdict and a resolution
  from the ledger's fixed vocabulary at `:146-152` - `divergence - <reason>` where
  the claim is knowingly left standing, naming the run-2 report and the reason.
  Then close task 4's two lists, which are the rows the join could not match and
  which no other task reaches. A row whose claim is stated in changed words gets
  the verdict run 2 gave the claim at its re-pinned line. A row whose claim is
  stated nowhere in its file gets `stale` with `divergence - <reason>` naming the
  run-2 report and the fact that the claim is no longer made; its `line` cell
  stays where task 4 left it, and the resolution says so, because a citation to a
  claim that no longer exists is a finding to record rather than a location to
  invent. Neither list may end this task empty-by-omission: state each list's size
  and that every row on it was closed.
  Leaving a newly stale claim standing IS this phase's scope boundary and not an
  oversight: `phases/5/CONTEXT.md` puts every prose correction beyond AC3, AC4 and
  AC5 out of scope and names `README.md:97`'s `trace suggest` mention as its own
  example, and phase 6 re-voices this same surface. Never write `pending` as a
  final value - it is a transient placeholder and zero rows may read it at the
  phase's close. Rows carrying `run` `1` keep the verdict run 1 recorded, which is
  what their run cell already says; do not re-judge them.
- **Verify:** `grep -c "| pending |" .planning/DOCS-CLAIMS.md` returns 0; a
  `node -e` pass over the ledger and the two run-2 reports asserts for EVERY `run`
  `2` row - not a sample - that its verdict cell equals the verdict its claim
  carries in the report, excluding exactly the seven ids named above, and prints
  every mismatch (nothing printed means they all agree);
  `grep -- "^| PLAN-18 \|^| PLAN-19 \|^| CONTEXT-14 \|^| EXECUTE-17 \|^| EXECUTE-18 \|^| VERIFY-DEEP-05 \|^| VERIFY-DEEP-12 " .planning/DOCS-CLAIMS.md`
  still returns seven lines each carrying `stale`, unchanged from task 3; and
  every row's resolution cell is non-empty and drawn from `accurate`,
  `corrected - <sha>`, `divergence - <reason>` or a form naming a `DFC-0k` id.

### Task 6: File run 2's new claims, including the `/cad-capture --cadence` row

- **Files:** .planning/DOCS-CLAIMS.md
- **Action:** Transcribe into `## Claims added after run 1` every run-2 claim that
  joined to no existing row - the four newly swept workflows' claims from
  invocation 4 first, then any claim the three re-run invocations extracted that
  the run-1 table does not carry. Give each an id in the ledger's positional form
  (doc basename uppercased plus a two-digit ordinal), a `doc`, a live `line`, the
  claim text, a verdict and a resolution, and `2` in the `run` column. One of
  those rows MUST name `/cad-capture --cadence` in its claim text: the arm is
  registered at `README.md:124` and `cadence-core/references/COMMANDS.md:48`,
  landed in `bd231ec`, whose message explicitly deferred the ledger row to this
  sweep - verify both surfaces still describe the arm before writing the row, and
  do not edit either file, since D-11 makes a re-edit a wasted budget re-pin on
  both for no change in what a user reads. Update the section preamble at
  `:747-755` so it states that run 2's new extractions live here too and why run
  1's 547 stays a record of what run 1 read.
- **Verify:** `grep -c -- "/cad-capture --cadence" .planning/DOCS-CLAIMS.md`
  returns at least 1; the `## Claims added after run 1` table carries a row for
  every file named in invocation 4 (`ADOPT-`, `MINIMALISM-REVIEW-`, `REPORT-`,
  `SUGGEST-` prefixed ids present); every new row has seven non-empty cells; and
  a `node -e` pass asserts the transcription is COMPLETE rather than merely
  present - for every claim in the two run-2 reports, either the ledger's run-1
  table carries that `doc` plus claim text or the post-run-1 table now does,
  printing every claim it finds in neither and nothing when all are accounted for.
  That check is the task's real gate: the id-prefix greps prove four files were
  touched, and only this one proves no extracted claim was dropped.

### Task 7: Close the ledger out consistent with itself

- **Files:** .planning/DOCS-CLAIMS.md
- **Action:** Final consistency pass over the whole file: every data row in both
  tables has the same cell count as its header, no cell is empty, no cell reads
  `pending`, every `run` value is `1` or `2`, every verdict is one of `accurate`,
  `stale`, `unverifiable`, and every resolution is drawn from the vocabulary at
  `:146-152`. Then reconcile the prose against the tables: the row totals stated
  in the `## Run 2` section match what the tables actually hold, and any sentence
  in `## Reading this ledger` that describes the table's column set names the
  `run` column too. Fix the prose to match the tables, never the tables to match
  the prose - the rows are the record, which is what `:19-23` already says about
  run 1's headline discrepancy.
- **Verify:** `awk -F'|' '/^\| [A-Z]/ {print NF}' .planning/DOCS-CLAIMS.md | sort
  -u` returns one value; `grep -c "| pending |" .planning/DOCS-CLAIMS.md` returns
  0; `grep -cE "\|[[:space:]]*(accurate|stale|unverifiable)[[:space:]]*\|"
  .planning/DOCS-CLAIMS.md` equals the data-row count; and the counts stated in
  `## Run 2` match the counts computed from the tables.

## Notes

Runs after plans 1 and 2, whose reports it reads. It shares no file with them or
with plans 4 and 5.

Two things surfaced while planning and were recorded rather than acted on. The
`plan` review trigger then raised both independently, and the user's triage on
2026-08-14 chose to act on them, so both are now in scope and this note records
what changed and why.

First, 42 ledgered rows across six files sat outside every invocation's target
set and could therefore never carry a run-2 verdict: 29 rows re-pointed at
`cadence-core/references/config-catalog.md`, 2 at `references/recall.md`, 1 at
`references/plan-revision.md`, and 10 whose `doc` is a `.mjs` file
(`lib/trace.mjs` 5, `planning.mjs` 4, `self-verify.mjs` 1 - the last four more
than the planning note's original count, found when the doc cells were
enumerated). Plan 2 now closes them with a fifth invocation over the three
reference docs and a targeted per-row pass over the ten `.mjs` rows. This does
not violate D-01 or D-04: D-01 freezes the three RECORDED invocation strings and
plan 2's own fourth invocation already established that new surface is reached by
adding a named invocation, and D-04 governs `docs-verify.md`'s DEFAULT target set,
which an explicit-path invocation does not touch.

Second, `phases/5/CONTEXT.md`'s AC2 says "the seven ledgered docs that changed
since `a6b8931`" while D-08 enumerates seven docs measured against `81bdb5d`.
Measured, 23 ledgered docs changed since `a6b8931`, carrying 493 rows. Task 4 is
now bound to the `a6b8931` baseline the criterion states rather than to D-08's
seven, and it re-pins by extending the task-2 join script to read each claim's
live location out of the run-2 reports rather than by hand-reading rows - which is
what makes 486 rows cost a script change instead of 486 file reads. D-08's real
saving survives intact: the eight byte-identical files are the same eight under
either baseline and their 55 rows are still not re-read.
