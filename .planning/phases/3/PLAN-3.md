---
phase: 3
plan: 3
requirements: [SHP-01]
files:
  - cadence-core/bin/lib/planning-files.mjs
  - cadence-core/bin/planning-files.test.mjs
  - cadence-core/bin/lib/milestone-prune.mjs
  - cadence-core/bin/milestone-prune.test.mjs
---

# Phase 3: Gates that fire on themselves or cannot be satisfied - Plan 3

## Goal

Every locator for the two requirement-table sections finds its heading OUTSIDE a
fenced block: the `## Shipped` lookup that sits five lines below a fence-aware
`## Active` read, and the four sibling `## Traceability` locators in the same two
files, so a milestone close can no longer edit a document's own fenced example.

## Must be true when done

- On a REQUIREMENTS fixture whose only `## Traceability` heading sits inside a
  fenced block, `parseRequirements` returns no rows, `setReqStatus` changes
  nothing and returns byte-identical text, and `insertReqRows` returns
  byte-identical text with its `no-traceability-table` error rather than
  fabricating a table.
- On a fixture whose `## Shipped` and `## Traceability` headings appear only
  inside a fenced block, `milestone-prune` leaves the fenced content unedited,
  moves no rows and creates no section - REQUIREMENTS.md is byte-identical after
  the call.
- On the same fixture with real headings BELOW the fence, the shipped rows are
  archived under the real `## Shipped` and the fenced example is untouched.
- The append-after-last-row path inside an existing `## Shipped` takes its END
  from the same fence-aware read as its start, so a fenced `## ` line inside the
  section cannot cut the search short.
- `node cadence-core/bin/test.mjs` passes, this repository's own
  REQUIREMENTS.md corpus row included.

## Context

D-08 sets the scope: every `## Traceability` locator routes through
`sectionSpan` alongside the `## Shipped` fix - `lib/milestone-prune.mjs`'s own
line-based filter plus the three in `lib/planning-files.mjs` - because closing
`## Shipped` alone satisfies the requirement's wording while leaving four sibling
locators for the ADJACENT section fence-blind in the same files, which is the
defect class rather than the defect. D-13 extends it to the append loop inside an
existing section, on the rule `lib/milestone-prune.mjs`'s own header states: "a
start found fence-aware cannot be repaired by a fence-blind end". D-14 accepts
the widening `sectionSpan` brings - a heading matched by TRIMMED equality, so an
indented one begins counting - which `lib/planning-files.mjs` already names as
accepted in its own header. D-15 records that this is a latent defect closed by
symmetry rather than a live reproduction, and that the fixture is built by
mirroring the existing fenced-`## Active` row in `milestone-prune.test.mjs`.

## Tasks

### Task 1: The three `## Traceability` locators in `lib/planning-files.mjs`

- **Files:** cadence-core/bin/lib/planning-files.mjs (`parseRequirements` /
  `setReqStatus` / `insertReqRows`), cadence-core/bin/planning-files.test.mjs
- **Action:** Three readers of one table each locate it their own fence-blind
  way: `parseRequirements` splits the text on an anchored `## Traceability`
  regex and then on the next `## `, while `setReqStatus` and `insertReqRows` each
  walk the lines with their own anchored heading test plus a `/^## /` bound.
  Route all three through `sectionSpan(lines, '## Traceability')` - the
  fence-aware reader this same file already exports and already uses for
  `## Phases` and for `## Active` - taking BOTH ends from that one call, per the
  rule stated at the top of the file: a start found fence-blind cannot be
  repaired by a fence-aware end. Behaviour to keep byte-identical when the
  heading is absent OUTSIDE a fence, which is now also the fenced-only case:
  `parseRequirements` returns an empty list, `setReqStatus` reports nothing
  changed and returns the text unchanged, and `insertReqRows` returns the text
  unchanged carrying its `no-traceability-table` error - it must never fabricate
  a table. Change the LOCATOR only: the row regex, the dashes-and-colons
  separator blacklist, the `Pending` literal, the anchor-line rule and the
  preserved line ending all stay exactly as they are. State the D-14 widening at
  the change - a trimmed-equality heading match now admits an indented heading
  the anchored regex refused - rather than leaving a reader to discover it.
- **Verify:** `node --test cadence-core/bin/planning-files.test.mjs
  cadence-core/bin/planning.test.mjs cadence-core/bin/milestone-prune.test.mjs`
  passes; new rows in `planning-files.test.mjs` show that a REQUIREMENTS fixture
  whose only `## Traceability` heading is inside a fenced block yields no parsed
  rows, no status change with byte-identical text, and the
  `no-traceability-table` error with byte-identical text - and that the same
  fixture carrying a REAL section below the fence parses only the real rows and
  inserts under the real separator.

### Task 2: `## Shipped` and the Traceability filter in `lib/milestone-prune.mjs`

- **Files:** cadence-core/bin/lib/milestone-prune.mjs (in `archiveRequirements`:
  its Traceability row filter / its `## Shipped` heading lookup / the
  append-after-last-row loop under an existing section),
  cadence-core/bin/milestone-prune.test.mjs
- **Action:** `archiveRequirements` takes both ends of `## Active` from
  `sectionSpan` and then, a few lines below, locates `## Shipped` with a bare
  `findIndex` over an anchored regex - one function, two locators, one
  fence-blind. Take the `## Shipped` span from `sectionSpan` too. The
  append-after-last-row loop under an existing section scans forward from the
  heading breaking on `/^## /` with no fence state; take its END from that same
  span (D-13). The `## Traceability` row filter above it is a line-based walk
  with a boolean flag and the same defect - bound it with `sectionSpan` as well
  (D-08), so the removal and `parseRequirements`'s read cannot disagree about
  where that table is. The created-section arm already re-reads `## Active`
  through `sectionSpan` and stays as it is, including its re-run comment
  explaining why the second read exists. Change nothing about WHAT is removed or
  what a row renders as: the narrow escaped-id bullet form, the whole-span
  capture and its whitespace join, the pipe escape at the interpolation and the
  section preamble are all untouched. A fenced `## Shipped` is then not the
  section, so a document whose only one is fenced creates a new section by the
  existing absent-heading arm rather than appending inside somebody's code block.
- **Verify:** `node --test cadence-core/bin/milestone-prune.test.mjs` passes,
  the existing fenced-`## Active` row included; new rows extend that file's
  `FENCED` fixture with fenced `## Shipped` and `## Traceability` examples above
  the real sections and assert that the fenced example's bytes survive
  untouched, that the archived row lands under the REAL `## Shipped`, and that
  no row is removed from the fenced table.

### Task 3: The seam's own answer on a document whose sections are only fenced

- **Files:** cadence-core/bin/milestone-prune.test.mjs (its seam-test section)
- **Action:** Prove AC7 at the SEAM, where a close actually runs. No
  `planning.mjs` edit is authorized here and none is needed: `cmdMilestonePrune`
  already writes REQUIREMENTS.md only when the transform moved at least one row,
  and already reports the moved list and the created-section flag on its
  envelope, so "no section found" is expressible as the answer it already gives.
  Add two seam rows using this file's existing seam fixture builder rather than a
  new one. First: a REQUIREMENTS.md whose `## Shipped` and `## Traceability`
  headings appear ONLY inside a fenced block, with the roadmap half normal - the
  command answers ok:true, reports no rows moved and no section created, and
  leaves REQUIREMENTS.md byte-identical, fenced content included. Second: the
  same fixture with real sections below the fence - the shipped row lands under
  the real `## Shipped` and the fenced example is untouched. Mirror the shipped
  `templates/REQUIREMENTS.md`, whose whole body sits inside a markdown fence
  carrying `## Active`, `## v2 Requirements`, `## Out of Scope` and
  `## Traceability` (D-15): that template is why this defect is latent rather
  than reproduced, and it is the document shape a template-seeded project
  actually has.
- **Verify:** `node --test cadence-core/bin/milestone-prune.test.mjs` passes;
  and the two new seam rows are shown to be falsifiable - run them once against
  the pre-phase content of both `lib/planning-files.mjs` and
  `lib/milestone-prune.mjs` (via `git show <pre-phase sha>:<path>`) and observe
  the first one archiving rows INTO the fenced table there.

## Notes

- These four files are shared with no other plan in this phase. Task 1 runs
  `planning.test.mjs` as a check but does not edit it, and PLAN-1 holds its
  lease: every `## Traceability` fixture in that file sits at column 0 outside
  any fence, so the change should not reach it. If it does redden, that is a
  deviation to report rather than an undeclared edit.
- AC7's "reports no section found" maps onto the envelope the seam already
  emits - an empty moved list with no section created, and REQUIREMENTS.md
  untouched - rather than a new field, which is why no seam edit appears here.
