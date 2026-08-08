---
phase: 3
plan: 1
requirements: [REC-01, REC-02]
files:
  - .gitignore
  - .planning/CAPTURE.md
---

# Phase 3: Queue triage - Plan

## Goal

`.planning/CAPTURE.md` stops being an append-only log and becomes the set of
things still true, with every item's verdict backed by the tree rather than by
its own wording.

## Must be true when done

- `## Todos` holds only current-cycle open items, each carrying one dated verdict
  clause. Every non-current-cycle open item present at the baseline sits under
  `## Archive`.
- The archive is invisible to the reader: a token occurring ONLY in archived text
  returns zero results from `planning.mjs recall`, and the same token against a
  control copy whose `## Archive` heading is renamed into the walked set returns
  the bullet - so the zero is invisibility, not absence.
- Closed `- [x]` items stay in `## Todos` and stay in the corpus: `git guard
  tokenizer` still returns the "Six pre-existing `git-guard` rail-3 holes" item.
- No bullet the reader can still see carries a bare `(phase N)` tag naming a
  pre-v2.5.0 milestone.
- Phases 4 and 5 take their inputs from the kept-item assignment list, which
  reaches `SUMMARY.md` through the executor report.

## Context

This plan is written against the 2026-08-08 SCOPE CUT recorded in
`.planning/phases/3/CONTEXT.md`, `.planning/REQUIREMENTS.md` REC-01/REC-02 and
`.planning/ROADMAP.md` phase 3. The prior two plans (10 tasks, then 15) tried to
give each of 213 open items a tree-backed verdict; both failed review. The
premise now: an open item carried unread across nine milestones is presumptively
dead, and proving that one at a time costs more than it returns.

Binding decisions: D-01 (queue and archive stay gitignored and untracked; no task
may cite a commit of `CAPTURE.md` as evidence - `git show`/`git restore`/`git
stash` reach NO state of this file), D-02 as amended (`- [x]` CLOSED items stay
in `## Todos` and stay in the corpus; they are never archived), D-03 (the archive
is a `## Archive` section inside the same file - a sibling would be tracked by
default), D-04 (a closure names a sha OR `verified live <date> against
<repo-rooted file:line>`), D-05 (historical tags requalify to `(vX.Y.Z phase N)`),
D-12 (targets are phase 4, phase 5 or `unassigned` - never phase 2).
D-06 and D-07 are SUPERSEDED - no citation normalization, no before/after
measurement.

Out of scope, touched by no task: fixing any defect the triage confirms;
`parseCaptureSnippets` or any recall behaviour; `skills/cad-capture/SKILL.md` and
`cadence-core/workflows/execute.md` (D-10).

**Two consequences of the cut that shrink the work, stated so no task rebuilds
them.** First, archived items leave the corpus entirely
(`cadence-core/bin/lib/planning-files.mjs:614` walks only `Todos`/`Seeds`/
`Notes`), so their bare `(phase N)` tags can no longer collide with this cycle in
recall. AC6's requalification therefore applies ONLY to bullets that remain
visible: the historical `- [x]` items staying in `## Todos`, measured at 34, not
the 183 the previous plans carried. Second, the archive move is one block
operation, so nothing needs a per-item identity scheme - no fingerprint manifest,
no line-number invariant, no bespoke checker. If a task cannot be verified by a
plain grep or a short `node -e`, it does not belong in this phase.

Measured live 2026-08-08 (re-derive, do not trust these as inputs - see task 1):
213 open `- [ ]`, 51 checked `- [x]`. The current-cycle set is 38 bullets, 28 of
them open, leaving 185 historical open items to archive. 44 checked bullets carry
a bare tag, 10 current-cycle, so 34 require requalification. `.gitignore:23`
ignores `/.planning/CAPTURE.md` exactly.

## Tasks

### Task 1: Pin the baseline and make the work recoverable

- **Files:** `.gitignore`
- **Action:** Runs before any edit. Record the live counts (`grep -c '^- \[ \]'`,
  `grep -c '^- \[x\]'`, `wc -l`) into the executor report as this phase's pinned
  baseline. Do NOT hardcode the numbers above: the queue grows between planning
  and execution (this plan's own capture seed moved lines after `:304`), so
  measure and carry what you measure.
  Create `.planning/phases/3/triage-work/` holding `baseline/CAPTURE.md`, a
  byte-identical copy of the live queue. Add `/.planning/phases/*/triage-work/`
  to `.gitignore` with a comment giving the reason: the directory holds copies of
  the queue, which is the same candid text `.gitignore:23` withholds, so tracking
  it would republish exactly what that line exists to keep out.
  This copy is the ONLY recovery point for the rest of the phase - the queue is
  untracked, so no git command can reach any state of it. Refresh a
  `triage-work/rolling/CAPTURE.md` copy at the end of each later task so an
  interrupted task rolls back one task rather than the whole phase.
  Derive the current-cycle set BY CONTENT, not by line number: a bullet is
  current-cycle iff its bare tag names a phase 1-6 AND it was captured this
  milestone. Write the derived list of current-cycle bullet line numbers to
  `triage-work/current-cycle.txt` and state in the report how the boundary was
  drawn, so a reviewer can check the split rather than take it on faith.
- **Verify:** `sha256sum .planning/CAPTURE.md .planning/phases/3/triage-work/baseline/CAPTURE.md`
  prints the same digest twice. `git status --porcelain .planning/phases/3/`
  lists no `triage-work` path. `git check-ignore -q .planning/phases/3/triage-work/baseline/CAPTURE.md`
  exits 0. `wc -l < .planning/phases/3/triage-work/current-cycle.txt` prints the
  current-cycle count stated in the report.

### Task 2: Archive every historical open item as one block

- **Files:** `.planning/CAPTURE.md`
- **Action:** Append a `## Archive` section at the END of the file (D-03: inside
  this file, never a sibling). Open it with ONE dated block reason - not a
  per-item verdict - stating the premise in full: these items were open across
  nine milestones without being read, the queue is `/cad-plan`'s recall input, and
  carrying them costs every future planning pass while proving each one dead
  individually costs more than it returns. Name the date and the count.
  Move every open `- [ ]` bullet that is NOT in `triage-work/current-cycle.txt`
  under that heading, preserving each bullet's text verbatim. Do not reword, do
  not add per-item verdicts, do not touch any `- [x]` bullet (D-02: closed items
  stay in `## Todos` and stay in the corpus).
  A moved bullet keeps its `- [ ]` checkbox: it is archived, not resolved, and
  claiming otherwise would be the "verdict backed by its own wording" the phase
  goal rejects.
- **Verify:** Every open bullet remaining above `## Archive` is in
  `current-cycle.txt`, and every baseline open bullet not in that list appears
  once under `## Archive` - proved by comparing sorted bullet text against
  `triage-work/baseline/CAPTURE.md`, so a dropped or duplicated item fails.
  `grep -c '^- \[x\]'` is unchanged from the task-1 baseline (no closed item
  moved). The count of `- [ ]` bullets above `## Archive` equals the
  current-cycle open count.

### Task 3: Prove the archive is invisible and the corpus still carries closed items

- **Files:** `.planning/CAPTURE.md`
- **Action:** Build a control copy in `triage-work/` with ONE `sed` pass:
  `sed 's/^## Notes$/## Notes-orig/; s/^## Archive$/## Notes/'`. The order matters
  and the single pass is required - renaming `## Archive` to `## Notes` while a
  `## Notes` already exists creates a duplicate heading, and `sectionBody`
  (`cadence-core/bin/lib/planning-files.mjs:565-569`) splits on the next `^## `
  and returns the FIRST heading's body only, so the control would return zero
  exactly like the live file and prove nothing. Renaming the original out of the
  way first is what makes the control a real control.
  Pick a token that occurs ONLY in archived text and state it in the report.
- **Verify:** `grep -c '^## Notes$'` on the control copy prints 1.
  `planning.mjs recall --dir <snapshot of the live file>` for the chosen token
  returns zero results; the same query against the control copy returns the
  archived bullet (AC2 - a zero that is invisibility, not absence).
  `planning.mjs recall` for `git guard tokenizer` still returns the
  "Six pre-existing `git-guard` rail-3 holes" item: `grep -c 'Six pre-existing'`
  over the raw result JSON prints 1 (AC3). That string occurs exactly once in the
  file, so it identifies the item unambiguously; its absence fails this task at
  any rank, while a rank change alone does not.

### Task 4: Triage the current-cycle open items individually

- **Files:** `.planning/CAPTURE.md`
- **Action:** For each open bullet listed in `triage-work/current-cycle.txt`, read
  the item, resolve its claim against the live tree, and append exactly one dated
  verdict clause in one of the four D-04 shapes: `CLOSED <date> by <sha>`,
  `CLOSED <date> verified live against <repo-rooted file:line>`,
  `MOOT <date>, <reason>`, or `KEPT <date>, re-verified against <repo-rooted
  file:line>`. A KEPT item also takes its phase-4 / phase-5 / `unassigned` target
  (D-12 - never phase 2).
  Set the verdict from what the tree says, not from what the item says. Where the
  item's own citation has moved, cite the line you actually read.
  Requalify the bare `(phase N)` tag on every historical `- [x]` bullet still in
  `## Todos` to `(vX.Y.Z phase N)`, taking the milestone from tree evidence.
  Where the milestone cannot be established from the tree, leave the bullet's tag
  alone and name it in the report rather than inventing a version or inventing a
  fallback tag shape - AC6 admits only the `(vX.Y.Z phase N)` form, so a guess is
  a permanent wrong answer and an unrequalified item is a stated exception.
  Do not leave any `- [x]` bullet with empty text: `if (!raw) continue;`
  (`planning-files.mjs:621`) runs BEFORE the checkbox strip, so a text-less
  checked bullet becomes a one-token `[closed] ` document that short-doc
  normalization floats to the top of recall.
- **Verify:** Every `- [ ]` bullet above `## Archive` that is also present in
  `triage-work/baseline/CAPTURE.md` carries one of the four verdict shapes; zero
  carry none. The check compares against the baseline copy on purpose: /cad-execute's
  own summary step appends fresh `- [ ] (phase 3)` bullets after this task and
  before /cad-verify (`cadence-core/workflows/execute.md:299-301`), so an
  unscoped grep would fail on correct work.
  No bullet visible to the reader carries a bare `(phase N)` naming a pre-v2.5.0
  milestone, except any exception the report names (AC6).
  `node -e` loading `parseCaptureSnippets` against the live file prints zero
  snippets whose text is the bare string `[closed] `.

### Task 5: Route the assignment list to SUMMARY

- **Files:** `.planning/CAPTURE.md`
- **Action:** Close `.planning/phases/3/reports/plan-1.md` with the heading
  `## For SUMMARY.md - kept-item assignment list (paste verbatim, do not paraphrase)`
  followed by a table of one row per KEPT item: a short technical restatement, its
  re-verified citation, and its target (phase 4, phase 5, or `unassigned`).
  The report is the route because `cadence-core/workflows/execute.md:375` is the
  only input the summary step is told to read, and `cadence-core/templates/SUMMARY.md`
  has no assignment section to fill. The report needs no `files:` entry - it is
  the single `lease-check` exemption at `cadence-core/bin/planning.mjs:1604`.
  Keep the restatements technical: this report is TRACKED and public, while the
  queue it summarizes is not (D-01). Do not transcribe candid queue prose into it.
  Add one extra row, below the table under a `## Notes-section carry-over`
  heading, for the `## Notes` recall item (recall's cwd-relative `dir` default).
  It is not a `- [ ]` bullet so no verdict reaches it, but it is real work for a
  later phase and would otherwise be orphaned by the cycle that read it. Re-read
  its citation live rather than copying one - the line has moved twice already.
- **Verify:** The heading exists in `reports/plan-1.md` and the row count beneath
  it equals the KEPT count from task 4, plus the one carry-over row. Every target
  is `phase 4`, `phase 5` or `unassigned` - a grep for `phase 2` in the target
  column returns zero (D-12). `git check-ignore -q .planning/phases/3/reports/plan-1.md`
  exits non-zero, confirming the list is actually tracked and will survive.

## Notes

**Plan shape.** CONTEXT now directs ONE plan of few tasks, and this is five. All
five write `.planning/CAPTURE.md` or depend on task 1's derived split, and the
ordering is total (archive before triage, both before the assignment list), so a
split into independent plans is not constructible - `plan-overlap` refuses two
plans declaring the same path, correctly.

**What was deleted, so a later reader does not restore it.** Three artifacts from
the superseded plans are gone deliberately: a ~300-line bespoke
`triage-check.mjs`, an `entitled-38.json` fingerprint manifest with its own
reduction rule, and a before/after recall measurement harness with a tracked
`MEASUREMENTS.md`. Each existed to police a per-item triage of 213 items. The
scope cut removed the thing they policed. Rebuilding any of them is a signal that
the scope has crept back.
