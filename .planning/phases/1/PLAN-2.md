---
phase: 1
plan: 2
requirements:
  - WHY-01
files:
  - cadence-core/bin/lib/why-record.mjs
  - cadence-core/bin/why-record.test.mjs
  - cadence-core/bin/lib/why-corpus.mjs
  - cadence-core/bin/why-corpus.test.mjs
  - cadence-core/bin/lib/why-render.mjs
  - cadence-core/bin/why.mjs
  - cadence-core/bin/why.test.mjs
---

# Phase 1: The corpus, read back at a file and line - Plan 2

## Goal

Each commit in the chain is joined to the record that explains it - its phase,
its plan task, the D-NN decision behind it, the deviation record and the
surviving review finding - each quoted in the record's own words, over the two
storage tiers a milestone close leaves on disk.

## Must be true when done

- Each chain entry names its phase, plan task, D-NN decision, deviation and
  surviving review finding, each quoted verbatim from the artifact it came from.
- A join that is phase-level rather than task-level says so, labelled
  phase-scoped, instead of presenting itself as a task-level fact.
- The absent `corrected by plan-<k> deviation:` marker is NAMED as a gap in the
  output, never reported as "none".
- A commit whose phase directory was archived under `_archive-v<ver>/<N>/` joins
  exactly as one under a live `phases/<N>/` does, and never to a live directory
  that merely reuses the same phase number.
- A path in history with no `.planning/` join returns its chain with each join
  field stated absent, not an empty chain.
- `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
  `problems: []`, and `node cadence-core/bin/test.mjs` reports 0 failures.

## Context

Locked by `phases/1/CONTEXT.md`: D-08 makes the SUMMARY `## Commits` table the
authoritative commit-to-plan-task edge and says it needs a NEW reader; D-10,
D-09, D-11 and D-12 fix the decision, deviation, review and declared-files
edges; D-03 says the join reads live `phases/<N>/` and `_archive-v<ver>/<N>/`;
D-06 forbids reading the conventional-commit scope as the phase key; D-17 fixes
sha matching as a prefix test in either direction. This plan changes nothing on
the write side - not `parsePlanFiles`, which `plan-overlap` depends on, and not
any artifact grammar. It builds on plan 1's seam and renderer, and the
git-history tier for pruned milestones is plan 3.

## Tasks

### Task 1: The SUMMARY commits-table reader

- **Files:** cadence-core/bin/lib/why-record.mjs, cadence-core/bin/why-record.test.mjs
- **Action:** A new pure module - text in, data out, no disk, no emit, no exit -
  in the mold `lib/adjudication-record.mjs` states for a classifier that a seam
  calls. Its first reader parses a SUMMARY.md's `## Commits` table into rows
  carrying the plan cell, the task cell, the commit cell and the description
  cell, each verbatim. Bound the section with `sectionSpan` from
  `lib/planning-files.mjs`, which is fence-aware; the `split(/^## /m)` idiom
  that module's private `sectionBody` uses is fence-blind and a fenced `## ` in
  a summary would end the table early - the defect class SHP-01 closed for
  `## Shipped`. Nothing in `lib/planning-files.mjs` parses this table today and
  `cadence-core/workflows/undo.md` reads it by model, which is why this is a new
  reader rather than a call (D-08). Two measured grammar facts bind it: the
  Task cell is NOT an integer - `fix`, `fix 1` and `fix 2` all appear in shipped
  summaries - so it is carried as the record's own string and never passed
  through `Number()`; and the abbreviation width varies by era, 7 characters
  across every archived summary on disk and 8 in v3.5.9's, so a commit match is
  a case-insensitive PREFIX test in either direction against a full 40-character
  sha (D-17) and never a fixed-width slice. A row whose commit cell is not
  hexadecimal is skipped, the disposition `parseArchiveRows` takes on a line
  that does not match.
- **Verify:** `node --test cadence-core/bin/why-record.test.mjs` passes over the
  verbatim `## Commits` section of `.planning/_archive-v3.4.0/1/SUMMARY.md`: all
  ten rows return with their four cells byte-exact, the `fix 1`, `fix 2` and
  `fix 3` task cells survive as strings, the 7-character `0053735` matches the
  full sha `00537356...` by prefix and does not match `0053736...`, a synthetic
  8-character row matches its own full sha and not a 7-character neighbour's,
  the separator row `|---|---|---|---|` yields no entry, and a fixture whose
  table is followed by a fenced `## ` line still returns every row.

### Task 2: The storage-tier locator

- **Files:** cadence-core/bin/lib/why-corpus.mjs, cadence-core/bin/why-corpus.test.mjs
- **Action:** A second new module, this one the DISK half - guarded I/O against
  `.planning/`, failing open with warnings rather than throwing, the split
  `lib/phase-plans.mjs` already states against `lib/risk-diff.mjs`. It builds
  the commit-to-phase index over the two tiers a close can leave on disk (D-03):
  the live `phases/<N>/` and the `_archive-v<ver>/<N>/` trees the
  `--mode archive` closes wrote (27 complete phase directories, 9 archive
  groups). Enumerate them through `phaseDirsIn` from `lib/phase-plans.mjs`,
  which already walks `phases` plus every `_archive-` prefixed group, already
  contains its walk against symlink escapes and already returns a stable
  `{label, path}` sorted by label - a second enumerator beside it is the
  split-brain `CAPTURE_WALK_SECTIONS` records the cost of. For each directory,
  read its SUMMARY.md and index every row task 1 returns under the row's commit
  cell, carrying the directory's own label and path with it. The index is what
  makes the phase a READ fact rather than a guess: the conventional-commit scope
  `<type>(<phase>-<plan>)` is corroboration and a named fallback only, never the
  key, because phase numbers reset every milestone - `feat(1-1)` exists in seven
  cycles and both candidate directories legitimately exist, so the failure is
  invisible (D-06). Two abbreviations that both prefix-match one full sha is an
  AMBIGUOUS answer that is reported as such, never resolved by picking one.
- **Verify:** `node --test cadence-core/bin/why-corpus.test.mjs` passes with:
  the index built over this repository's own `.planning` resolving the full sha
  of `00537356` to the `_archive-v3.4.0/1` directory with plan `1` and task `2`;
  the same index NOT resolving it to the live `phases/1`, which holds a
  different milestone's phase 1; a temp-fixture planning root with two archive
  groups both carrying a `phases/1` returning both directories from
  `phaseDirsIn` and indexing each summary's rows under its own label; a
  fixture whose SUMMARY.md is unreadable contributing no rows and one warning
  rather than throwing; and a fixture where two summaries name abbreviations
  that both prefix one full sha returning an ambiguous answer naming both.

### Task 3: Wire the phase and plan-task edge into the chain

- **Files:** cadence-core/bin/why.mjs, cadence-core/bin/lib/why-render.mjs, cadence-core/bin/why.test.mjs
- **Action:** Call task 2's locator from the seam once per invocation - one
  index build for the whole chain, never one per entry - and place each entry's
  phase directory, milestone label, plan cell, task cell and the commits-table
  description on the entry. Replace the stated-absent phase and plan-task lines
  plan 1 rendered with the record's own cells, quoted verbatim, and keep the
  stated-absent form for an entry the index does not resolve, because AC5
  requires a path in history with no `.planning/` join to come back as a chain
  with each field stated absent. Establish here the ONE place on the entry where
  the remaining edges attach, so tasks 4 through 7 add a reader and a field
  rather than a second traversal. The phase number printed must be the one read
  off the resolved directory's own name - no phase number may appear in output
  that was not read from an artifact (D-06), and a resolved directory under
  `_archive-v3.4.0/` prints that milestone, never the live `phases/1`.
- **Verify:** `node --test cadence-core/bin/why.test.mjs` passes with: running
  the seam against `cadence-core/bin/lib/issue-decision.mjs` in this repository
  returning a chain whose entry for `00537356` names the `_archive-v3.4.0`
  milestone, phase 1, plan 1, task 2, and carries that row's description text
  verbatim - `The pure issue-decision core + 15 tests` is a substring of the
  rendered entry;
  running it against a file created by a commit no summary names returning that
  entry with its phase and plan-task fields stated absent rather than dropped;
  and the two-run byte-identity test from plan 1 still passing with the index in
  place.

### Task 4: The decision edge

- **Files:** cadence-core/bin/lib/why-record.mjs, cadence-core/bin/why-record.test.mjs, cadence-core/bin/lib/why-render.mjs, cadence-core/bin/why.mjs, cadence-core/bin/why.test.mjs
- **Action:** Add the reader that reaches a D-NN, and wire it. An entry reaches
  its decision by EXPLICIT textual cite when the resolved phase's plan file names
  a `D-NN` token in its `## Context` section or inside the body of the task the
  commits table attributed the commit to; otherwise the output prints the
  resolved phase's decisions labelled phase-scoped (D-10). Never silent and
  never inventing a task-level edge: nothing in a PLAN.md or SUMMARY.md
  structurally references a D-NN, the template's `## Context` is free prose, and
  a structured cite on the write side is work this phase excludes. The
  decisions themselves come from `parseContextDecisions` in
  `lib/planning-files.mjs`, which already reads `## Durable decisions` first with
  the documented `## Decisions` fallback and whose header states why the
  fallback must test `durable === null` rather than falsiness - do not restate
  that grammar here. Plan files in the resolved directory are the conforming set
  `lib/phase-plans.mjs` already defines, `PLAN.md` reading as plan 1 spelled
  bare, and `planTaskTitles` from `lib/planning-files.mjs` supplies the anchored
  `### Task <n>:` boundaries a task body is cut on.
- **Verify:** `node --test cadence-core/bin/why-record.test.mjs` passes with the
  verbatim `.planning/_archive-v2.2.0/3/PLAN.md` and its sibling CONTEXT.md:
  a task body citing `D-08` yields a task-level cite carrying that CONTEXT
  line's own text, the `## Context` section's `D-01`/`D-05` cites yield
  plan-level cites, and a plan naming no D-NN at all yields every decision
  `parseContextDecisions` returns for that CONTEXT with a phase-scoped label
  rather than an empty result. `node --test cadence-core/bin/why.test.mjs`
  passes with a seam run whose rendered `text` carries the cited decision's
  line verbatim and, on the fallback arm, carries the phase-scoped label.

### Task 5: The deviation edge, and the gap it has to name

- **Files:** cadence-core/bin/lib/why-record.mjs, cadence-core/bin/why-record.test.mjs, cadence-core/bin/lib/why-render.mjs, cadence-core/bin/why.mjs, cadence-core/bin/why.test.mjs
- **Action:** Add a reader for a SUMMARY's `## Deviations` bullets ALONE -
  `parseSummarySnippets` in `lib/planning-files.mjs` merges `## Deviations` with
  `## Open items` for the BM25 corpus and cannot tell them apart afterwards, so
  this reader is separate and strips the same leading `[deviation]` tag that one
  does. The deviation-refutes-a-decision edge does not exist in machine-readable
  form, and the output says so BY NAME: `cadence-core/workflows/execute.md` at
  the "A deviation that REFUTES a numbered context decision" paragraph
  prescribes appending ` [corrected by plan-<k> deviation: ...]` to the refuted
  D-NN line, and 0 of 792 D-NN lines across the archived and git-recovered
  CONTEXT files carry it while only 6 of 123 `## Deviations` bullets name any
  D-NN at all. So the entry prints the phase's deviation bullets unjoined and
  labelled phase-scoped, plus a named statement that the marker the write side
  prescribes is absent from the record (D-09). Reporting this edge as "none"
  is refused: that would hide the write-side gap this phase exists to expose,
  and fixing the write side is explicitly out of scope here.
- **Verify:** `node --test cadence-core/bin/why-record.test.mjs` passes with the
  verbatim `.planning/_archive-v2.2.0/3/SUMMARY.md`: the reader returns its three
  `## Deviations` bullets and none of its `## Open items` bullets, with the
  `[deviation]` tag stripped and the rest byte-exact. `node --test
  cadence-core/bin/why.test.mjs` passes with a seam run over a path that phase
  touched, whose rendered `text` carries those deviation bullets under a
  phase-scoped label and carries a sentence naming the `corrected by plan-`
  marker as absent from the record. A second seam run over a phase whose
  CONTEXT decisions no deviation cites shows the same named-gap sentence rather
  than a "none" or an empty deviation field.

### Task 6: The surviving review finding edge

- **Files:** cadence-core/bin/lib/why-record.mjs, cadence-core/bin/why-record.test.mjs, cadence-core/bin/lib/why-corpus.mjs, cadence-core/bin/why-corpus.test.mjs, cadence-core/bin/lib/why-render.mjs, cadence-core/bin/why.mjs
- **Action:** Surviving review findings come from the phase directory's
  `ADJUDICATION-<trigger>-<discriminator>[-rN].json` records - the filename rule
  is `recordName` in `lib/adjudication-record.mjs` and the ruling vocabulary is
  its `RULINGS`, neither restated here - taking only entries whose `ruling` is
  `survived`, and quoting that entry's own `claim`, `failure_scenario` and
  `counter_evidence` verbatim (D-11). SUMMARY prose is not a viable source:
  review sections appear under five different one-off spellings, one file each,
  against `## Commits` at 26 of 26. An entry is joined to a commit when that
  commit is inside the record's `base_id`..`head_id` range; decide membership
  with one `git rev-list` over the range per distinct range, not per entry, and
  when either id does not resolve in this clone - a shallow clone, a dropped
  commit - state the join as unresolvable rather than dropping the finding or
  claiming it applies. A record file that will not parse as JSON, or an entry
  missing `base_id`/`head_id`, contributes a stated absence and a warning, never
  a throw: CONTEXT flags the both-fields-present assumption as verified on one
  git-recovered record rather than across the corpus, so the degradation path is
  the one that must exist. No such record survives on disk in any
  `_archive-*` tree in this repository - they postdate the last archive-mode
  close - so the on-disk arm is proved on a built fixture here and the corpus
  arm is proved in plan 3.
- **Verify:** `node --test cadence-core/bin/why-record.test.mjs` passes with a
  fixture record built from the verbatim bytes of
  `git show a34b0c8a^:.planning/phases/2/ADJUDICATION-risk_surface-plan-2.json`:
  its one `survived` entry returns with `claim`, `failure_scenario` and
  `counter_evidence` byte-exact, its non-survived entries do not return, and a
  copy with `base_id` deleted returns a stated-unresolvable join plus a warning
  rather than throwing. `node --test cadence-core/bin/why-corpus.test.mjs`
  passes with a temp repository where a record's `base_id`..`head_id` range
  contains commit A and not commit B, and the join attaches the finding to A
  alone; and with a record whose `head_id` names an object the repository does
  not have, returning the unresolvable state rather than an empty finding list.
  `node --test cadence-core/bin/why.test.mjs` passes with a seam run over that
  same on-disk fixture whose rendered `text` carries the survived entry's
  `claim` and `failure_scenario` verbatim on the chain entry for commit A and
  on no other entry - this task edits `why.mjs` and `lib/why-render.mjs`, so a
  correct reader whose finding never reaches the rendered chain must fail here
  rather than pass the two module tests above. Plan 3 proves the recovered
  arm; this line is the live-and-archive on-disk tier's own seam proof.

### Task 7: The task-attributed declared-files edge

- **Files:** cadence-core/bin/lib/why-record.mjs, cadence-core/bin/why-record.test.mjs, cadence-core/bin/lib/why-render.mjs, cadence-core/bin/why.mjs, cadence-core/bin/why.test.mjs
- **Action:** Add a reader returning, per `### Task <n>: <title>` heading in a
  PLAN file, the paths that task's `- **Files:**` line declares INCLUDING its
  continuation lines, so the queried path can be attributed to the task that
  declared it even where the commits table's task cell is coarse. It goes
  BESIDE `parsePlanFiles` in this new module and does not change it, because
  `plan-overlap` depends on that function's current behaviour and this phase
  changes nothing on the write side (D-12). The existing task-line arm is
  single-line and returns one flat array with no task attribution; 92 of 251
  task `Files:` lines across the 27 archived plans wrap onto a continuation
  line, so 37% of declared task paths would never match a single-line reader.
  Task boundaries come from `planTaskTitles` in `lib/planning-files.mjs` - the
  anchored `### Task` grammar already exists, and a second spelling of it is the
  drift that rule was written against. Containment between a declaration and
  the queried path is `covers` from `lib/lease-grammar.mjs`, the ONE containment
  predicate LSE-01 put in place so the pre-flight gate and the commit-time
  enforcement read one grammar; never a fresh string comparison here.
- **Verify:** `node --test cadence-core/bin/why-record.test.mjs` passes with the
  verbatim `.planning/_archive-v2.1.0/1/PLAN.md`, whose Task 6 `Files:` line
  wraps: that task's declared set contains both
  `cadence-core/bin/planning.test.mjs` from the first line and
  `cadence-core/bin/self-verify.mjs` from the indented continuation, and every
  other task's set is attributed to its own heading rather than merged. A
  containment test shows a declaration `src/` claiming a queried `src/auth.js`
  through `covers` while a sibling task declaring `src/auth.js` alone does not
  claim `src/other.js`. `node --test cadence-core/bin/why.test.mjs` passes
  with a seam run whose entry names the declaring task, and with the two-run
  byte-identity assertion still holding.

## Notes

- This plan and plan 3 both extend `cadence-core/bin/lib/why-corpus.mjs`,
  `lib/why-render.mjs`, `why.mjs` and `why.test.mjs`, and all three plans of the
  phase share files by design, so `plan-overlap` reports overlaps and the phase
  runs sequentially in plan order. That is the intent, not an oversight.
- D-04 (ARCHIVE.md carries no commit-to-phase edge) binds plan 3, where the
  pruned-milestone arm needs it; nothing in this plan reads ARCHIVE.md.
- Tasks 4 and 5 are also grounded in two recalled `.planning/CAPTURE.md` items
  measured 2026-08-22 during this phase's context: that nothing in a PLAN.md or
  SUMMARY.md structurally references a D-NN, which is why task 4's fallback is
  phase-scoped rather than task-level; and that `/cad-execute` has never emitted
  the `corrected by plan-<k> deviation:` marker `workflows/execute.md`
  prescribes, 0 of 792 D-NN lines, which is why task 5 names the gap instead of
  joining the edge. Both fixes are write-side work this phase excludes.
- The 8-character abbreviation case has no on-disk fixture in this repository -
  every archived summary uses 7 - so task 1 proves it synthetically and plan 3
  proves it against the real v3.5.9 record recovered from git.
