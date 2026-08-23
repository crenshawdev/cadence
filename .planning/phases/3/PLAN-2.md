---
phase: 3
plan: 2
requirements:
  - FST-01
files:
  - cadence-core/bin/lib/why-corpus.mjs
  - cadence-core/bin/why-corpus.test.mjs
  - cadence-core/bin/lib/why-render.mjs
  - cadence-core/bin/why-render.test.mjs
  - cadence-core/bin/why.mjs
  - cadence-core/bin/why.test.mjs
---

# Phase 3: The fast path leaves a record - Plan 2

## Goal

`/cad-why` on a file a `/cad-task` run touched answers with that task's slug
instead of reporting the gap, through a FOURTH tier in the commit index - so the
corpus's own reader reaches the record plan 1 taught the corpus to write.

## Must be true when done

- `node cadence-core/bin/why.mjs cadence-core/templates/config.json` resolves
  commit `093408c9` to the off-roadmap task `bound-plan-size` and prints no gap
  block for it, checked against the record on disk rather than a fixture.
- The rendered entry for that commit names the SLUG and says it is an
  off-roadmap task - it never prints a phase number, and never renders a task
  directory as a phase of a milestone.
- A commit named by both a phase SUMMARY and a task record still resolves to the
  phase, because the tiers are ordered and asked in order.
- A repository with no `.planning/tasks/` renders byte-identically to the way it
  rendered before this tier existed, and two runs over an unchanged tree are
  byte-identical to each other.
- `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
  `problems: []` and `node cadence-core/bin/test.mjs` reports 0 failures.

## Context

Locked by `phases/3/CONTEXT.md`: D-02 says `/cad-why` reaches the task record
through a FOURTH tier in `lib/why-corpus.mjs` and NEVER by widening
`phaseDirsIn` - that enumerator admits a directory only when it holds a PLAN
file, the inline path writes none, and widening it would hand every task
directory to `route.mjs`'s risk-floor replay and make `describe()` render
`tasks phase <slug>`, a WRONG join rather than a missing one. D-10 is why the
record parses at all: it carries its own `## Commits` table and its own
`- **Files:**` line. `mergeCommitIndexes` already models ordered tiers and
`resolveCommit` already asks `index.tiers` in order, so this is an added tier
and not a new resolution path.

Depends on plan 1: the tasks-directory lister and the record's grammar live in
`cadence-core/bin/lib/task-record.mjs`, and `.planning/tasks/bound-plan-size/RECORD.md`
is the real record the end-to-end check resolves against.

## Tasks

### Task 1: The tasks tier of the commit index

- **Files:** cadence-core/bin/lib/why-corpus.mjs, cadence-core/bin/why-corpus.test.mjs
- **Action:** Add a task-record index builder beside `buildCommitIndex`, taking
  a planning root and returning the same `{dirs, rows, warnings}` shape, so
  `resolveCommit` needs no change at all. Enumerate through plan 1's lister in
  `lib/task-record.mjs` and never through a second walk of `tasks/` written here
  - that module is the ONE home for where a task record lives, and this file's
  own header records what two homes for one walk cost. Read each `RECORD.md`
  through the existing `readArtifact`, which refuses a non-regular file before
  opening it and turns a failure into a warning naming the artifact and an errno
  CODE rather than raw error text, and parse it with the existing
  `parseCommitRows` - the record was given a `## Commits` table precisely so this
  reader works unchanged. Each row's `dir` must be a directory descriptor
  carrying the same keys `describe()` produces plus a marker naming the slug, so
  a consumer can tell a task directory from a phase directory without parsing
  the label: give it a label of the form `tasks/<slug>` (unique against every
  `phases/<n>` and `_archive-<label>/<n>` label the other tiers produce) and set
  the milestone and phase fields to values that cannot read as a phase number.
  An ABSENT record is impossible here because the lister only returns
  directories holding one; an unreadable one is a warning and contributes no
  rows, matching `buildCommitIndex`'s disposition exactly. Fixed order: the
  lister sorts by slug and `parseCommitRows` preserves the table's own order, so
  two runs see one order.
- **Verify:** `node --test cadence-core/bin/why-corpus.test.mjs` passes with new
  cases proving: a fixture planning root holding one task record yields one
  directory and its table's rows, each carrying the slug; an absent `tasks/`
  yields empty dirs, empty rows and no warning; an unreadable `RECORD.md` yields
  a warning naming the artifact and an errno code and contributes no rows; and
  the builder returns deep-equal results on two consecutive calls.

### Task 2: The tier is merged, ordered, and asked

- **Files:** cadence-core/bin/lib/why-corpus.mjs, cadence-core/bin/why.mjs, cadence-core/bin/why-corpus.test.mjs, cadence-core/bin/why.test.mjs
- **Action:** Widen `mergeCommitIndexes` to take the tasks index as well, and
  order the tiers `disk phases`, then `tasks`, then `git-recovered`. State the
  order's reason in the function's comment: the phase spine is the authority
  when a commit is named by both, and the tasks tier goes AHEAD of the recovered
  one on the same argument that comment already makes for the disk tier - both
  are records a reader can actually open, while the recovered tier reconstructs
  a directory that no longer exists. Keep `prunes` coming off the recovered
  argument alone, since the named-gap block reads it. Update `why.mjs`'s single
  call site to build all three indexes, and extend its header's "AND THAT INDEX
  IS THREE TIERS, NOT TWO" paragraph to state the fourth and what it costs -
  one directory listing plus one read per task record, which is what keeps the
  eager form cheap. Update `why-corpus.test.mjs`'s existing two-argument merge
  helper in the same change. Nothing about `resolveCommit` moves: it already
  takes the first tier that answers at all.
- **Verify:** `node --test cadence-core/bin/why-corpus.test.mjs` and
  `node --test cadence-core/bin/why.test.mjs` pass, with a case proving a sha
  present in BOTH a phase SUMMARY's commits table and a task record resolves to
  the phase directory and not to the task, and a case proving a sha present only
  in the task record resolves to it with state `resolved`.

### Task 3: A task entry renders as a task, never as a phase

- **Files:** cadence-core/bin/lib/why-render.mjs, cadence-core/bin/why-render.test.mjs
- **Action:** Give `fieldPhase` an arm for a resolved row whose directory
  carries task 1's slug marker, so the line names the off-roadmap task and its
  slug and the directory a reader can open, and prints NO phase number and NO
  milestone. This is the whole of AC2: the failure D-02 rejects is a task
  directory rendering as `tasks phase <slug>`, which reads as a phase and is a
  wrong answer rather than a missing one. Leave every other arm - ambiguous,
  unresolved-with-gap, recovered, resolved-phase - byte-identical, and leave the
  literal-string-wins rule at the top of the module untouched, since a caller
  holding a rendered `entry.phase` string still wins over the join. `fieldTask`
  needs no arm: a task record's table has no Plan column, so `j.plan` is `''`
  and it already renders `task <cell> - <description>` without a plan prefix.
- **Verify:** `node --test cadence-core/bin/why-render.test.mjs` passes with
  cases proving: an entry whose join carries the slug marker renders a phase
  line naming `bound-plan-size` and matching neither `phase <digit>` nor a
  milestone label; the same entry's `plan task:` line renders without a `plan `
  prefix; and every existing phase, ambiguous, recovered and gap rendering test
  still passes unchanged.

### Task 4: The record's own declaration reaches the join, end to end

- **Files:** cadence-core/bin/lib/why-corpus.mjs, cadence-core/bin/why-corpus.test.mjs, cadence-core/bin/why.test.mjs
- **Action:** Teach `readPhaseRecords` to take `RECORD.md` as the declaration
  source when the directory is a task directory, ahead of the `PLAN-<key>.md`
  and `PLAN.md` spellings it tries today, and return it as the `plan` text with
  `planFile` naming it. Without this the `declared by:` edge reads a task's
  `PLAN.md` when the planned path wrote one and nothing at all when the inline
  path did not, while D-10 put the `- **Files:**` line in the RECORD precisely so
  `taskDeclaredFiles` - and through it `declaringTasks`, which `why.mjs` calls
  for that edge - reaches it. `CONTEXT.md` and `SUMMARY.md` stay read exactly as
  they are: a task directory has neither, `artifactReader` treats absent as
  silent, and the decision and deviation edges then state their own absence,
  which is the true answer and is what the renderer already prints. Then confirm
  the whole join end to end against the record plan 1 committed.
- **Verify:** `node cadence-core/bin/why.mjs cadence-core/templates/config.json`
  prints, for commit `093408c9`, a phase line naming `bound-plan-size` and no
  `NOT RESOLVED` block, and a `declared by:` line naming
  `cadence-core/templates/config.json` as declared by that record's task 1 -
  where the same command on the pre-change tree prints the gap block for that
  commit. Running it twice returns byte-identical stdout.
  `node --test cadence-core/bin/why-corpus.test.mjs` and
  `node --test cadence-core/bin/why.test.mjs` pass, with a fixture case proving
  a task directory holding BOTH a `PLAN.md` and a `RECORD.md` returns the
  `RECORD.md` as its plan text.

## Notes

- Runs AFTER plan 1: task 1 imports `cadence-core/bin/lib/task-record.mjs` and
  task 4 verifies against `.planning/tasks/bound-plan-size/RECORD.md`, both of
  which plan 1 creates. No file is declared by both plans, so `plan-overlap`
  will report no overlap - the ordering is a dependency on plan 1's output and
  must not be read as a parallel-safe pair.
- The AC2 check names `cadence-core/templates/config.json` because `093408c9`
  sits at position 5 of that path's chain, inside `why.mjs`'s default entry cap
  of 10. Measured 2026-08-23: `shown 10, total 21`, and the same commit sits at
  position 16 of `cadence-core/bin/review-provider.mjs`'s chain, which is why
  that file is the wrong probe.
- `skills/cad-planner-contract/SKILL.md` is the wrong probe for a different and
  recorded reason: phase 1's SUMMARY measured that the bare-path arm inherits
  git's default history simplification, and the `token-burn-contract-edits`
  task's two commits are collapsed into merge `81bdb5d4` there, so no tier could
  ever reach them from that path (`phases/1/SUMMARY.md`, phase 1).
