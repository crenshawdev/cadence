---
phase: 1
plan: 1
requirements:
  - RCL-07
files:
  - cadence-core/bin/lib/planning-files.mjs
  - cadence-core/bin/planning-files.test.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/milestone-prune.test.mjs
  - cadence-core/workflows/milestone.md
  - cadence-core/references/recall.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 1: The controls that never reached their path - Plan 1 (RCL-07)

## Goal

The recall corpus survives a milestone close: a decision, UAT item or deviation
from a CLOSED milestone comes back from `planning.mjs recall` on both prune
arms, with the corpus source naming the artifact it came from.

## Must be true when done

- After `milestone-prune --mode delete` over a phase, `planning.mjs recall` for
  a term that appeared only in that phase's SUMMARY deviation returns it.
- The same query returns the same hit after a `--mode archive` prune.
- Each archived hit's `source` names the origin artifact - a SUMMARY deviation,
  a UAT item and a CONTEXT decision stay distinguishable in the result - and
  names the milestone that retired it, rather than a flat residue filename.
- Re-running a prune that already ran adds no second copy of any row, and a
  close that only half ran writes its remaining phases' rows exactly once when
  it is re-run.
- `.planning/ARCHIVE.md` is a tracked file that `/cad-milestone`'s prune step
  stages and commits.
- `node --test cadence-core/bin/*.test.mjs` and `node
  cadence-core/bin/self-verify.mjs` both exit 0.

## Context

Locked: the residue is written at prune time BEFORE the directories go, and the
corpus walk gains no `_archive-*` arm (D-01). It is a new tracked top-level
`.planning/ARCHIVE.md` read beside `CAPTURE.md`, never a fourth `CAPTURE.md`
section (D-02). Its rows are the SAME snippets the walker already indexes,
produced by the same three parsers inside the `milestone-prune` seam over the
`applied` set, never a model-authored distillation (D-03). Each row names its
ORIGIN artifact (D-04). Recall keeps ONE flat BM25 ranking with no recency term
and no per-source cap (D-05). Out of scope: stemming in `lib/bm25.mjs`,
multi-phrasing union, folding `reports/plan-<k>.md` and `REVIEW-*.md` into the
walk, the absent-vs-unmatched corpus marker, and any `_archive-*` walk arm.

## Tasks

**Before task 1, and before ANY commit in this plan:** run `git rev-parse
--short HEAD` and hold that SHA - it is this plan's unpatched baseline, and the
watched FAIL in task 4 is recorded against it. Run it here rather than inside
task 4, because by the time task 4 executes, HEAD already carries tasks 1-3 and
the literal command names a patched revision. Also run the live observation that
FAIL is watched for at this same point (a `recall` for a term that exists only
in a pruned phase's SUMMARY, returning nothing) and carry both into task 4's
header comment.

### Task 1: State the ARCHIVE.md residue grammar, once

- **Files:** cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/planning-files.test.mjs
- **Action:** Start reading at `parseSummarySnippets`, `parseCaptureSnippets`
  and `parseContextDecisions`. Give the residue file a stated grammar with ONE
  home, in the module that already owns every other corpus parser - the
  `CAPTURE_WALK_SECTIONS` comment in this same file records what happens when
  the writer and the reader of one walk keep the fact in two places, and the
  residue has exactly that writer/reader pair. Export two pure functions: a
  PARSER turning ARCHIVE.md text into the same `{text, source, phase}` rows
  `cmdRecall` already builds its corpus from, and an APPENDER landing new rows
  into that text. The grammar: a column-0 `## ` heading opens a milestone
  section whose label is the rest of the line, trimmed; a row inside a section
  is a column-0 `- `, then the origin path inside backticks - `phases/<n>/`
  followed by `SUMMARY.md`, `UAT.md` or `CONTEXT.md`, with `<n>` an integer or a
  decimal `N.M`, the same phase-number shape `cmdRecall`'s directory filter
  already admits - then a colon, a space, and the snippet to end of line. A line
  that does not match is not a row and is skipped, the posture
  `parseContextDecisions` already takes on a non-`D-NN` line, so a human note in
  the file cannot mint a corpus entry. The parser composes `source` as the label
  and the origin path joined by a slash and sets `phase` to the number, which
  keeps the `{score, source, phase?, snippet}` contract exactly four fields wide
  while naming both the origin artifact and the milestone that retired it -
  that is the planner's call on CONTEXT's open question about the row format:
  the milestone label rides `source`, and the `phase` slot keeps the meaning
  every live row gives it. The appender lands rows under an existing section
  with the same label when the text already carries one, after that section's
  last row, and otherwise appends a new section at end of text; text that is
  empty gets a short preamble first, naming the writer and the reader, carrying
  no column-0 `## ` heading of its own so the preamble can never read as a
  section. Pure and total like the rest of this module: no I/O, no throw on
  malformed input, everything not explicitly inserted byte-preserved.
- **Verify:** `node --test cadence-core/bin/planning-files.test.mjs` exits 0
  with new per-row cases covering: a row written by the appender and read back
  by the parser round-trips its snippet byte-identically; each of the three
  origin filenames yields its own `source`; a decimal phase number parses to
  the decimal; a snippet containing a colon, a backtick and a pipe survives
  intact; a non-matching line under a section yields no row; a second append
  under the same label lands under the existing heading rather than creating a
  duplicate one; an append into empty text produces a preamble carrying no
  column-0 `## ` heading.

### Task 2: Fold ARCHIVE.md into the recall corpus

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs
- **Action:** `cmdRecall` walks `.planning/ARCHIVE.md` beside `CAPTURE.md`
  through the parser task 1 added, appending its rows to `corpus` AFTER the
  `CAPTURE.md` rows. The position is load-bearing: `search()` returns hits in
  (score desc, corpus position asc) order, so appending at the end leaves every
  existing corpus index unchanged and the byte-stability assertions keep passing
  unchanged on a tree with no ARCHIVE.md. Read it with the same guarded `read()`
  the CAPTURE walk uses - an absent file is empty data, never an ENOENT throw,
  which is what the empty-corpus contract rests on. ONE flat BM25 ranking with
  the live rows: no recency term, no per-source cap, archived rows competing on
  score alone (D-05 - measured 2026-08-16 over a 265-to-986-snippet rebuild,
  archived rows took 2, 1, 3 and 3 of the top 5 on four representative queries
  and displaced the live `CAPTURE.md` hit from rank 1 twice; that crowding is
  the accepted cost and a cap's N has no measured basis). Nothing else about the
  envelope, the `--top` bound, the `memory.backend` gate or the `warnings[]`
  tail changes.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` exits 0 with new
  cases: a fixture carrying an ARCHIVE.md row returns that row with `source`
  naming the milestone label and the origin artifact and `phase` the number; a
  fixture with no ARCHIVE.md returns output byte-identical to the same query
  before this task; two runs over a corpus holding both live and archived rows
  are byte-identical to each other; `memory.backend` set to `none` still returns
  empty results with no ARCHIVE.md read.

### Task 3: milestone-prune writes the residue before the directories go

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/milestone-prune.test.mjs
- **Action:** `cmdMilestonePrune` reads each completed phase's `SUMMARY.md`,
  `UAT.md` and `CONTEXT.md` and runs `parseSummarySnippets`, `parseUat` and
  `parseContextDecisions` over them - the SAME three parsers `cmdRecall`'s live
  walk uses, never a model-authored distillation, because a prose-authored write
  puts the residue in the fallible coordinator's hands and an interrupted close
  then writes nothing while the reachability hole reopens silently (D-03). The
  READ happens BEFORE the directory loop, because under `--mode delete` those
  files do not exist after it; this is the same split the REQUIREMENTS.md half
  three paragraphs above already states in its own comment - read before,
  transform after. The APPEND happens before that loop too, not after it: D-01
  locks the residue as written BEFORE the directories go, and emitting for the
  post-loop `applied` set would put the write after the removal, where an
  interrupt between the two deletes the dirs, writes nothing, and leaves the
  reachability hole reopened with no live artifact left to recover it from. So
  the rows are emitted for the CANDIDATE set - the completed phases this
  invocation resolved to prune, before any of them is touched - in the same
  fixed order the recall walk uses (phases ascending, and SUMMARY then UAT then
  CONTEXT within a phase), and appended to `.planning/ARCHIVE.md` through
  `atomicWrite` and the appender from task 1. Zero rows writes no file at all,
  the way the roadmap and requirements writes already skip on an empty set. The
  cost of moving the write ahead of the loop is that a phase whose removal then
  FAILS is still live on a re-run and would be read again, so idempotence is no
  longer free: the appender skips a phase whose rows are already present under
  this milestone's heading, reusing the `--label` CONTAINMENT term this seam
  already runs rather than adding a dedup pass or a written-labels file. That
  containment check is the only guard added, and it is the same term named
  below. The envelope gains a field stating how many residue
  rows were written, so a silent no-op is distinguishable from a write - absence
  and silence are different answers at this seam as everywhere. The `--label`
  table term and containment term still run first, before any read, mkdir or
  rename, in both modes: that ordering is load-bearing and must not move.
- **Verify:** `node --test cadence-core/bin/milestone-prune.test.mjs` exits 0
  with new seam cases: a `--mode delete` prune over a phase carrying a SUMMARY
  deviation, a UAT item and a CONTEXT durable decision writes three rows under
  one milestone heading in `.planning/ARCHIVE.md` and the envelope states the
  count; the same fixture under `--mode archive` writes the same three rows; a
  second identical run adds no rows and leaves ARCHIVE.md byte-identical; a
  partial prune whose one failed phase clears on a re-run has that phase's rows
  present exactly once; a prune interrupted between the append and the removal
  (the failed-removal fixture, where the phase dir is still live) leaves that
  phase's rows already on disk and a re-run neither duplicates nor drops them;
  a prune over phases holding no readable artifacts writes no ARCHIVE.md at all.

### Task 4: The end-to-end falsifier, with its watched FAIL

- **Files:** cadence-core/bin/milestone-prune.test.mjs
- **Action:** One test that runs RCL-07 end to end rather than either half:
  build a `.planning` fixture holding a completed phase whose SUMMARY deviation
  carries a nonsense term appearing nowhere else in the fixture, invoke
  `planning.mjs milestone-prune` over it, then invoke `planning.mjs recall` for
  that term and assert the hit comes back with the SUMMARY origin and the
  milestone label in its `source`. Repeat the whole sequence on the `--mode
  archive` arm, and add the two sibling assertions the requirement is stated in:
  a CONTEXT durable decision and a UAT item from the same closed phase come back
  with sources that are distinguishable from each other and from the SUMMARY
  one. Reach both seams through the CLI ONLY - no import of anything task 1
  added - so that against the unpatched tree this test fails on its assertion
  rather than on a missing export, which is the difference between a watched
  FAIL and a broken file. Carry a header comment naming the short SHA the FAIL
  was watched at, beside the check permanently, matching this tree's habit of
  documenting derived facts in the test file's own header (D-17): capture that
  SHA with `git rev-parse --short HEAD` BEFORE task 1's commit lands, and state
  in the comment what was observed there (a live `recall` for the pruned term
  returning nothing).
- **Verify:** `node --test cadence-core/bin/milestone-prune.test.mjs` exits 0 on
  this tree. Against the unpatched tree it exits non-zero: `git worktree add
  --detach` a temporary checkout of the SHA named in the header, copy this test
  file into that checkout's `cadence-core/bin/`, run `node --test` on it there,
  observe a non-zero exit naming the new end-to-end cases, then remove the
  worktree.

### Task 5: The close stages the residue it just wrote

- **Files:** cadence-core/workflows/milestone.md,
  cadence-core/bin/weight-budgets.json
- **Action:** Step 3 states that the prune seam writes `.planning/ARCHIVE.md`,
  relays the row count the envelope now carries, and stages that file alongside
  ROADMAP.md, REQUIREMENTS.md and any `_archive-<label>/` move in the `chore:
  prune <label> completed phases` commit. Say in one clause WHY it is committed
  where the `risk_surface` carry-forward file two paragraphs above is
  deliberately transient: the carry-forward exists to be consumed and deleted by
  step 7, while the residue IS the recall corpus for every milestone this
  project has closed and dies with the working tree if it is not tracked. Do not
  touch the carry-forward paragraph, its TRANSIENT rule, or step 7's deletion -
  a committed survivor still halts every later land, and that reasoning is
  unchanged. Re-pin the `cadence-core/workflows/milestone.md` row in
  `weight-budgets.json` to the new byte count in the SAME commit: the surface
  sits at 10797 against a 10797 budget with zero headroom, so any growth is a
  `budget-overrun` self-verify failure and an uncommittable tree.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 with no
  `budget-overrun`, and `grep -n 'ARCHIVE.md' cadence-core/workflows/milestone.md`
  shows both the write and the staging inside step 3.

### Task 6: The recall contract names an archived row

- **Files:** cadence-core/references/recall.md,
  cadence-core/bin/weight-budgets.json
- **Action:** `## The return` gains the one new thing a caller can now see: a
  `source` whose leading segment is a milestone label names an artifact from a
  CLOSED milestone, so the caller weighs it as retired work itself. State that
  this is why there is no recency term and no per-source cap (D-05) - the
  discounting is the caller's, deliberately, and a reader who does not know what
  the leading segment means cannot do it. Keep it to the file's existing voice
  and length; this reference is read at one step by `/cad-context` and
  `/cad-debug` and every byte rides that step. Do not restate the corpus walk,
  do not add a fifth result field, and do not touch `workflows/plan.md`, which
  restates only the field shape and is unaffected. Re-pin the
  `cadence-core/references/recall.md` row in `weight-budgets.json` in the SAME
  commit - it sits at 2831 against a 2831 budget with zero headroom.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 and `node --test
  cadence-core/bin/*.test.mjs` exits 0, with the recall.md and milestone.md
  budget rows re-pinned.

## Notes

- CONTEXT's first flagged assumption (the residue row format beyond naming its
  origin) is answered in task 1: the milestone label rides the `source` string
  as a leading path segment, and the `phase` slot keeps the meaning every live
  row gives it. This keeps the `{score, source, phase?, snippet}` contract four
  fields wide, so `/cad-debug`'s and `/cad-context`'s renderers need no change,
  and it makes two milestones' phase-1 rows distinguishable in one result list.
- CONTEXT's second flagged assumption (idempotence across a re-run and a
  `partial-prune` return) is answered structurally in task 3 rather than by a
  dedup pass: a pruned phase's directory is gone, so the read that feeds the
  rows finds nothing for it on the second run. The regression case is in task
  3's Verify.
- This plan shares `cadence-core/bin/planning.mjs` and
  `cadence-core/bin/weight-budgets.json` with PLAN-2, and
  `weight-budgets.json` with PLAN-3. That is the CONTEXT `Plan shape`
  directive's explicit instruction (shared surfaces get explicit `files:` leases
  per plan) and it means `plan-overlap` will report overlaps and `/cad-execute`
  will run the three plans SEQUENTIALLY, which is also what the required
  ordering needs. See PLAN-3 Notes for the full deviation record.
