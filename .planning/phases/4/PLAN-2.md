---
phase: 4
plan: 2
requirements: [LOD-02]
files:
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/planning-status.test.mjs
  - cadence-core/bin/planning-cursor.test.mjs
  - cadence-core/bin/planning-phase-done.test.mjs
  - cadence-core/bin/planning-uat.test.mjs
  - cadence-core/bin/planning-audit.test.mjs
  - cadence-core/bin/planning-criteria-coverage.test.mjs
  - cadence-core/bin/planning-criteria-size.test.mjs
  - cadence-core/bin/planning-plans.test.mjs
  - cadence-core/bin/planning-renumber.test.mjs
  - cadence-core/bin/planning-seed-reqs.test.mjs
  - cadence-core/bin/planning-recall.test.mjs
  - cadence-core/bin/planning-detect.test.mjs
  - cadence-core/bin/planning-lease-check.test.mjs
  - cadence-core/bin/planning-trace-ignore.test.mjs
  - cadence-core/bin/planning-debt-harvest.test.mjs
  - cadence-core/bin/planning-milestone-prune.test.mjs
  - cadence-core/bin/planning-capture-sections.test.mjs
  - cadence-core/bin/planning-adjudication.test.mjs
  - cadence-core/bin/planning-deferred.test.mjs
  - cadence-core/bin/planning-cite-count.test.mjs
  - cadence-core/bin/planning-task-record.test.mjs
  - cadence-core/bin/test.mjs
---

# Phase 4: Split planning.mjs by command - Plan 2 (the test split)

## Goal

`planning.test.mjs` stops reproducing the read cost the source split just
removed: its 8,458 lines split along the command banners that already partition
them, so an agent verifying one command reads that command's tests instead of a
105k-token file.

## Must be true when done

- Every `// --- <command>: ... ---` banner region except the cross-command ones
  lives in a `cadence-core/bin/planning-<command>.test.mjs` file, and
  `planning.test.mjs` holds the shared fixture harness plus the regions that
  span several commands.
- `node cadence-core/bin/test.mjs` reports the same total test count it reported
  before the split, so nothing was dropped, duplicated or left unrun.
- Importing the harness from another test file registers no test twice: the
  count above is the proof.
- `node cadence-core/bin/test.mjs planning` still runs the planning seam's tests
  rather than a residue of them.
- No test's assertions change - this is a move, not a rewrite.

## Context

- D-08: split test files stay at `cadence-core/bin/*.test.mjs`. `test.mjs`
  discovers stems with a non-recursive `readdirSync(HERE)`, so a subdirectory
  would look organised and never run. A new stem falls into the `other` group,
  which the default run and CI both execute.
- D-09: the cut lines are the existing `// --- <command>: ... ---` banners -
  D-09 counted 53, `grep -c '^// --- '` finds 51 in the file today, and 48 of
  those move while 3 cross-command ones stay.
  The file is black-box - it spawns `planning.mjs` through
  `execFileSync`/`spawnSync` - so plan 1's source split does not force any change
  here beyond the two `source:` byte-reading tests plan 1 already repointed.
- The baseline this plan is measured against: `node cadence-core/bin/test.mjs`
  reports `tests 3071`, `pass 3071`, `fail 0`, and `node --test
  cadence-core/bin/planning.test.mjs` alone reports 477. The suite measured
  `fail 1` on 2026-08-24 when this plan was written; that failure is fixed before
  this phase executes (see Notes). Plan 1 adds no test, so 3,071 is the number
  every task below re-checks.
- Out of scope: any change to what a test asserts, and any new test.

## Tasks

### Task 1: Export the fixture harness and move the status banners out

- **Files:** cadence-core/bin/planning.test.mjs,
  cadence-core/bin/planning-status.test.mjs
- **Action:** Export `PLANNING`, `makeTree`, `run` and `today` from
  `planning.test.mjs`, and give that file the entry-file guard this repo already
  uses for shared test harnesses: an `isEntryFile()` that compares
  `process.argv[1]` against `import.meta.url` with `realpathSync` on both sides,
  and a `test` binding that is `node:test`'s `test` when the module IS the entry
  file and a no-op when it is imported. Copy the mechanism and its reason from
  `issue-check.test.mjs` (which exports `stub` for `git-publish.test.mjs`) rather
  than inventing a second shape - without the guard, importing the harness
  registers every remaining `planning.test.mjs` arm inside each importing
  process and the run count multiplies.
  Then create `planning-status.test.mjs` carrying the four banner regions whose
  subject is `status` - `status: failure shapes`, `status: derivation`, `status:
  drift`, and `status: the phase-directory grammar, reported and never resolved`
  - moved verbatim with their banners and comments, importing the harness from
  `./planning.test.mjs` and carrying the same entry-file guard so it too can be
  imported by a sibling later. Delete the moved regions from `planning.test.mjs`.
  This is the tracer for the five move tasks after it: discovery, the harness
  import, the guard and the count parity are all exercised on one command first.
- **Verify:** `node cadence-core/bin/test.mjs 2>&1 | grep -E '^ℹ (tests|pass|
  fail)'` prints `tests 3071` with `fail 0` - any other number means an arm was
  dropped or double-registered; `node --test
  cadence-core/bin/planning-status.test.mjs` passes on its own.

### Task 2: Move the cursor, phase-done and uat banners out

- **Files:** cadence-core/bin/planning.test.mjs,
  cadence-core/bin/planning-cursor.test.mjs,
  cadence-core/bin/planning-phase-done.test.mjs,
  cadence-core/bin/planning-uat.test.mjs
- **Action:** Same pattern as task 1. `planning-cursor.test.mjs` takes `cursor
  get / set`, `cursor set: the closed-milestone derivation (D-10)` and `cursor
  set --next-file: the path transport for a COMPOSED resume pointer`;
  `planning-phase-done.test.mjs` takes `phase-done`; `planning-uat.test.mjs`
  takes `uat`, `uat record --fields-file: the free-text fields through the path
  transport`, `uat: the criterion / origin carrier`, `FINDINGS.json: the
  discarded half of the merge, made recoverable` and `uat merge --payload
  <file>: the envelope refusals (D-07)`. A fixture builder declared just above a
  moved banner (`uatTree`, `linkedTree`, `payloadFile`, `refusedMerge` and their
  constants) travels with the region it serves; one used by a region that stays
  behind is exported from its new home and imported by name, the way
  `git-publish.test.mjs` imports `gitLayers` from `config-seams.test.mjs` -
  never copied, which is how two fixtures drift apart.
- **Verify:** `node cadence-core/bin/test.mjs 2>&1 | grep -E '^ℹ (tests|pass|
  fail)'` still prints `tests 3071` with `fail 0`; `grep -c '^// --- ' cadence-core/bin/planning.test.mjs` prints 38 -
  the file carries 51 banners today and 13 have moved after this task.

### Task 3: Move the audit, criteria and plan-file banners out

- **Files:** cadence-core/bin/planning.test.mjs,
  cadence-core/bin/planning-audit.test.mjs,
  cadence-core/bin/planning-criteria-coverage.test.mjs,
  cadence-core/bin/planning-criteria-size.test.mjs,
  cadence-core/bin/planning-plans.test.mjs
- **Action:** Same pattern. `planning-audit.test.mjs` takes `audit`, `audit:
  unseeded/unpicked (D-01..D-07) and nonconforming_plans (D-13)`, `audit:
  version_drift (FRI-03)`, `DRF-02: the sanctioned rolled-over phase` and
  `TAG-01: the tag list has to belong to THIS project`, with `taggedTree`,
  `GIT_FIXTURE_ENV`, `auditSpec`, `cycleSpec` and `rolledSpec`.
  `planning-criteria-coverage.test.mjs` takes `criteria-coverage: the CONTEXT
  criterion -> UAT item trace` with `coverageTree`, the `P1_*`/`P6_*` fixtures,
  `REFUSED_ID_SHAPES` and `REPO_MANIFEST`.
  `planning-criteria-size.test.mjs` takes `criteria-size: the criteria ceilings
  three workflows only stated` with `criteriaTree` and `BOTH_SPELLINGS`.
  `planning-plans.test.mjs` takes the three regions whose subject is the plan
  file itself - `plan-size: the two counts that were soft until v2.7.0`,
  `plan-overlap: the parallel-safety gate`, `frontmatter grammar: normalization +
  the diagnostic's both envelopes` and `the refused lease spellings, through BOTH
  declaration doors` - with `sizeTree`, `blockPlanTree`, `oneIdPlanTree`,
  `overlapTree` and `refusalTree`. The frontmatter-grammar region drives its
  subject through `audit` and `plan-overlap` calls; it goes with the plan-file
  file because the plan frontmatter is what it is about, and its banner says so.
- **Verify:** `node cadence-core/bin/test.mjs 2>&1 | grep -E '^ℹ (tests|pass|
  fail)'` still prints `tests 3071` with `fail 0`; each of the four new files passes when run alone with `node --test`.

### Task 4: Move the renumber, seed-reqs, recall, detect and lease-check banners out

- **Files:** cadence-core/bin/planning.test.mjs,
  cadence-core/bin/planning-renumber.test.mjs,
  cadence-core/bin/planning-seed-reqs.test.mjs,
  cadence-core/bin/planning-recall.test.mjs,
  cadence-core/bin/planning-detect.test.mjs,
  cadence-core/bin/planning-lease-check.test.mjs
- **Action:** Same pattern. `planning-renumber.test.mjs` takes `renumber`,
  `renumber vs CONTEXT acceptance-criteria ids: a NON-event` and `decimal phases
  under renumber (the desync fix)` - including the two `source:` tests plan 1
  repointed at `cadence-core/bin/planning/renumber.mjs`, which move unchanged.
  `planning-seed-reqs.test.mjs` takes `seed-reqs: /cad-plan's Traceability
  row-insert seam`. `planning-recall.test.mjs` takes `recall: BM25 over the
  .planning corpus`, `capture -> recall: the walk-membership round trip (AC1)`,
  `recall: the archived corpus a closed milestone leaves behind (RCL-07)` and
  `recall: the tasks tier (D-09)`. `planning-detect.test.mjs` takes both
  `detect-commands` regions and `a blank --root is refused by BOTH --root
  subcommands (COR-01)`. `planning-lease-check.test.mjs` takes `lease-check: the
  declared file lease, enforced (QW-03)` and EXPORTS `leaseRepo` and
  `leaseCheck`: the `--phase carries the caller's spelling` region stays in
  `planning.test.mjs` and calls them, so they are imported by name rather than
  duplicated.
- **Verify:** `node cadence-core/bin/test.mjs 2>&1 | grep -E '^ℹ (tests|pass|
  fail)'` still prints `tests 3071` with `fail 0`; `node --test cadence-core/bin/planning.test.mjs` passes on its own,
  which is what proves the cross-file `leaseCheck` import resolves.

### Task 5: Move the trace-ignore, debt-harvest, milestone-prune and capture-sections banners out

- **Files:** cadence-core/bin/planning.test.mjs,
  cadence-core/bin/planning-trace-ignore.test.mjs,
  cadence-core/bin/planning-debt-harvest.test.mjs,
  cadence-core/bin/planning-milestone-prune.test.mjs,
  cadence-core/bin/planning-capture-sections.test.mjs
- **Action:** Same pattern, one file per banner subject: `trace ignore: the run
  record stays out of git by itself (FLD-02)` with `ignoreRoot`, `traceIgnore`
  and `gitignoreOf`; `debt-harvest: markers in tracked code reach the queue
  (DBT-01)` with `debtLine`, `debtRepo`, `debtAdd`, `harvest` and `captureOf`;
  `milestone-prune: the --label guard` with `pruneTree`; `capture-sections: the
  out-of-walk census (AC4)` with `QUEUE`. Name the milestone-prune file
  `planning-milestone-prune.test.mjs`: the existing `milestone-prune.test.mjs`
  covers `lib/milestone-prune.mjs`, and these are the seam's own arms, so the two
  stems stay distinct rather than merging.
- **Verify:** `node cadence-core/bin/test.mjs 2>&1 | grep -E '^ℹ (tests|pass|
  fail)'` still prints `tests 3071` with `fail 0`; `ls cadence-core/bin/planning-*.test.mjs | grep -v planning-files |
  wc -l` prints 17 (the pre-existing `planning-files.test.mjs` covers
  `lib/planning-files.mjs` and is not part of this split).

### Task 6: Move the fire-record and read-back banners out

- **Files:** cadence-core/bin/planning.test.mjs,
  cadence-core/bin/planning-adjudication.test.mjs,
  cadence-core/bin/planning-deferred.test.mjs,
  cadence-core/bin/planning-cite-count.test.mjs,
  cadence-core/bin/planning-task-record.test.mjs
- **Action:** Same pattern. `planning-adjudication.test.mjs` takes `adjudication:
  the record a gate fire leaves (phase 2)` and `FIRE_RECEIPTS: 'deferral', the
  fifth name a fire can settle at`, with `adjRepo`, `adjRun`, `adjPayload`,
  `adjPayloadFile`, `adjFiles`, `deferralRepo` and `plRun`.
  `planning-deferred.test.mjs` takes `deferred record`, `deferred list`,
  `deferred carry` and `a carried member stays adjudicable AND re-armable
  (D-10)`, with `defRun`, `defPayload`, `phaseFiles`, `defList`, `defCarry` and
  `putMember`. `planning-cite-count.test.mjs` takes `cite-count: the read-back
  count` with `citeCount`, `citePayload`, `citePlanBody` and `citeTree`.
  `planning-task-record.test.mjs` takes `task-record: the artifact a /cad-task
  run leaves (FST-01)` with `taskRepo`, `runIn` and `TASK_COMMITS`; the `recall:
  the tasks tier` region already moved to `planning-recall.test.mjs` in task 4,
  so import `taskRecordIn`'s dependencies across rather than splitting a fixture
  in two.
  What remains in `planning.test.mjs` afterwards is the harness plus the three
  cross-command regions that belong to no single command: `line endings at the
  seam`, `the GLOBAL --dir refuses the empty, bare and flag-shaped spellings`,
  and `--phase carries the caller's spelling, at every shape site (D-02)`.
- **Verify:** `node cadence-core/bin/test.mjs 2>&1 | grep -E '^ℹ (tests|pass|
  fail)'` still prints `tests 3071` with `fail 0`; `grep -c '^// --- ' cadence-core/bin/planning.test.mjs` prints 3;
  `wc -l cadence-core/bin/planning.test.mjs` prints a number under 700.

### Task 7: Declare the new stems in the test runner's planning group

- **Files:** cadence-core/bin/test.mjs
- **Action:** Add the 21 new `planning-*` stems to the `planning` group in
  `GROUPS`, beside `planning` and `planning-files`. Without this they land in
  `other` and `node cadence-core/bin/test.mjs planning` - the documented way to
  run this seam's tests, and the CI matrix cell named `planning` - would run only
  the residue left in `planning.test.mjs` while the bulk ran in a different cell
  (D-08). The group comment already says the `planning` group exists because
  `planning` alone is ~11s and gets cheap company; update that sentence to
  describe the group as it now is rather than leaving a comment about a file
  that no longer holds most of it.
- **Verify:** `node cadence-core/bin/test.mjs --list` shows all 21 new stems
  under `planning` and none under `other`; `node cadence-core/bin/test.mjs
  planning 2>&1 | grep '^ℹ tests'` prints a count at least 477 (the whole
  pre-split planning surface, not a residue); `node cadence-core/bin/test.mjs
  2>&1 | grep -E '^ℹ (tests|pass|fail)'` still prints `tests 3071` with `fail 0`.

## Notes

- The one failing test in the baseline is PRE-EXISTING and outside this phase:
  `cadence-core/bin/milestone-prune.test.mjs:557`, `corpus: pruning this
  repository's own REQUIREMENTS.md needs no hand repair`. It reads the LIVE
  `.planning/REQUIREMENTS.md`, whose `## Active` bullets this milestone wrote as
  `- **FRG-01** - text` while both the seam and that test's `activeSpan` helper
  expect `- **FRG-01**: text`, so the archived row comes out as `| FRG-01 |`
  with an empty parenthetical instead of carrying the bullet's text. Do not fix
  it here and do not let it absorb a task: every Verify above names it so a
  second failure is visible immediately. It is reported for the human as an open
  item.
- Plan 1 and this plan both declare `cadence-core/bin/planning.test.mjs`, so they
  run in sequence and never in parallel. Nothing in this plan touches
  `cadence-core/bin/planning.mjs` or the new `cadence-core/bin/planning/`
  modules.
