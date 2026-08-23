---
phase: 3
plan: 1
requirements:
  - FST-01
files:
  - cadence-core/bin/lib/task-record.mjs
  - cadence-core/bin/task-record.test.mjs
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/arg-contract.test.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/lib/planning-files.mjs
  - cadence-core/bin/planning-files.test.mjs
  - .planning/tasks/bound-plan-size/RECORD.md
---

# Phase 3: The fast path leaves a record - Plan 1

## Goal

A `/cad-task` run's record exists as a written artifact and the recall corpus
reaches it: one `planning.mjs` subcommand writes
`.planning/tasks/<slug>/RECORD.md` in the corpus's own grammar, and a query
naming what a task did returns that file. The `/cad-why` join is plan 2 and the
`workflows/task.md` wiring is plan 3.

## Must be true when done

- `node cadence-core/bin/planning.mjs task-record --slug <s> --base <ref>
  --head <ref> --text-file <f>` writes `.planning/tasks/<s>/RECORD.md` carrying
  a `## Commits` table and a `- **Files:**` line, both derived from the range by
  the seam rather than retyped onto a flag.
- Running that command twice over an unchanged range and text leaves a
  byte-identical file and a byte-identical envelope apart from the trace line.
- On a tree with no `.planning/` the command creates none, writes no record,
  and its envelope carries `written: false` with a reason naming why.
- A `--slug` that is not one safe path segment is refused with nothing written,
  so a slug can never name a path outside `.planning/tasks/`.
- `node cadence-core/bin/planning.mjs recall "<terms naming what a task did>"`
  returns that task's `RECORD.md` among its results, and a run against a tree
  with no `tasks/` directory emits the bytes it emitted before this walk existed.
- `.planning/tasks/bound-plan-size/RECORD.md` exists in this repository, written
  by the seam over that task's real committed range, and recall returns it.
- `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
  `problems: []` and `node cadence-core/bin/test.mjs` reports 0 failures.

## Context

Locked by `phases/3/CONTEXT.md`: D-01 puts the record at
`.planning/tasks/<slug>/RECORD.md`, a tracked tree, never `CAPTURE.md` (which
`.gitignore` withholds) and never `phases/0/`. D-07 makes CODE the writer,
reached as a `planning.mjs` subcommand that appends its own `outcome` trace
event and reports `{written, reason}` on its envelope - the `cmdCiteCount` and
`cmdRiskCheckRun` precedents - because `lib/capture-file.mjs`'s header records
what a model holding `Write` cost this queue. D-09 requires `cmdRecall`'s walk
to gain the tasks tier EXPLICITLY and the record's indexed text to sit under a
heading that walk visits. D-10 fixes the grammar: the record carries its OWN
`## Commits` table and its own `- **Files:**` line, because 0 of 3 shipped task
plans parse with either reader.

Out of scope here: every `workflows/task.md` edit (plan 3), the `/cad-why` tier
(plan 2), and any change to what recall returns for the tiers it already walks.

## Tasks

### Task 1: The record's one home and one grammar

- **Files:** cadence-core/bin/lib/task-record.mjs, cadence-core/bin/task-record.test.mjs
- **Action:** A new module carrying every fact about where a task record lives
  and what it looks like, so the writer in task 2, the recall walk in task 3 and
  plan 2's `/cad-why` tier cannot disagree about it - the split-brain
  `CAPTURE_WALK_SECTIONS` in `lib/planning-files.mjs` exists to prevent, and the
  one D-07 cites `lib/capture-file.mjs`'s header for. Carry `// @ts-check` like
  its siblings. It owns four things. (1) The directory and file names -
  `tasks` under the planning root and `RECORD.md` inside a slug directory - as
  exported constants, never re-spelled by a caller. (2) A slug predicate: a slug
  is one path segment of lowercase letters, digits and single hyphens, bounded in
  length, and anything else is refused. This is the `milestone-prune --label`
  lesson from VAL-01 - that label was only trimmed before being joined onto a
  directory path and escaped the tree - so the predicate refuses `.`, `..`, any
  separator and any absolute form rather than sanitising them. (3) A guarded
  lister that returns, sorted by slug, every `<planningRoot>/tasks/<slug>/`
  holding a readable `RECORD.md`, each as `{slug, path}`. Fail OPEN exactly as
  `phaseDirsIn` in `lib/phase-plans.mjs` does - an absent planning root and an
  unreadable directory are both an empty list and never a throw - and CONTAIN
  the walk the same way it does, resolving the group and each entry with
  `realpathSync` and skipping anything that resolves outside the planning root,
  because `readdirSync` follows a symlinked directory. Resolve `RECORD.md`
  ITSELF the same way and require it to land inside the planning root too, and
  require it to be a regular file. `phaseDirsIn` contains DIRECTORY entries and
  this lister returns a FILE path, so a walk that stopped at the slug directory
  would still hand back `tasks/<slug>/RECORD.md` symlinked out of the tree - and
  task 3's recall tier reads snippets straight from the path this returns, so a
  cloned repository carrying one would surface an arbitrary readable file
  through `planning.mjs recall`. Same VAL-01 lesson as the slug predicate, one
  level further in. (4) A pure renderer
  turning `{slug, title, body, commits, files}` into the record's bytes, with no
  disk, no `Date` and no randomness so the same inputs give the same file. The
  sections, in this order and no other, because each one is read by a shipped
  reader: `# Task: <slug>`; `## What shipped` holding the body as `- ` bullets,
  one per non-empty input line, which is the heading task 3's walk visits;
  `## Commits` holding a three-column `| Task | Commit | Description |` table -
  `parseCommitRows` in `lib/why-record.mjs` maps columns by header NAME and
  already reads the three-column era, a task has no plan number, and the commit
  cell must be a full 40-character sha because `HEX` refuses anything not
  hexadecimal and `shaMatches` prefix-matches; and finally `## Files` holding a
  single `### Task 1: <title>` heading with a `- **Files:**` line under it,
  because `planTaskBodies` anchors on `^### Task` and `taskDeclaredFiles`
  requires that exact bold-field spelling, and this section is LAST so the task
  body runs to end of file. Escape a `|` inside a description cell the way
  `parseCommitRows`' `cells()` expects it, so a subject line carrying a pipe
  cannot split into two cells and attach to the wrong commit.
- **Verify:** `node --test cadence-core/bin/task-record.test.mjs` passes with
  cases proving: the slug predicate refuses `..`, `a/b`, `/abs`, an empty
  string and an over-long value while accepting `bound-plan-size`; the lister
  returns `[]` for an absent planning root, for a `tasks/` holding a directory
  with no `RECORD.md`, for a slug directory that is a symlink out of the
  root, AND for an in-root slug directory whose `RECORD.md` is itself a symlink
  to a readable file outside the planning root - the directory case passing does
  not imply the file case does, and the second is the one the recall tier reads
  through - and returns the slugs sorted otherwise; and rendering the same inputs
  twice returns byte-identical text whose `## Commits` table `parseCommitRows`
  reads back to the same rows, whose `- **Files:**` line `taskDeclaredFiles`
  reads back to the same paths, and whose description cell survives a subject
  containing `|` as one cell.

### Task 2: `task-record`, the subcommand that writes it

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/arg-contract.test.mjs, cadence-core/bin/planning.test.mjs
- **Action:** Add a one-word `task-record` subcommand - one word and not two,
  the reason the `adjudication` arm in the `COMMANDS` table already states:
  `subcommandKey` consumes a second word only for the `TWO_WORD` families and
  one operation does not earn widening that Set. Declare its row in
  `CONTRACTS['planning.mjs']` in `lib/arg-contract.mjs` with five flags -
  `--slug`, `--base`, `--head` (each `required: true`, `refuse` on both axes)
  and the `--text` / `--text-file` pair the `capture` row already models, with
  `--text` the inline form and `--text-file` its path transport - then move
  `arg-contract.test.mjs`'s pinned entry count from 173 to the new total in the
  same commit, since that assertion is what makes the walk non-vacuous. Add the
  handler to `COMMANDS` and a usage block to the file header beside `recall`'s,
  and correct that `recall` block's parenthetical, which still names the corpus
  as SUMMARY/CAPTURE/UAT/CONTEXT. The command: refuse a slug the task-1
  predicate refuses, with nothing written; resolve the range through the
  existing `resolveRange`, which returns the repository top and both resolved
  ids and whose failure is already redacted through `redactUrl`; read the
  commits with one `git log` over `<base>..<head>` under `-C <top>`, oldest last
  or newest first as the renderer states, using a `%x1f`-separated format so a
  subject carrying the separator cannot split a record, and read the touched
  paths with one `git diff --name-only` over the same resolved ids - never one
  git call per commit, and never a figure retyped onto a flag, which is the
  transcription surface D-07 names. Resolve the prose through
  `resolveTextFlag(opts, 'text', 'task-record')`, the reader every `--<field>-file`
  flag already goes through. If the planning root does not exist, create NOTHING
  - not the root, not `tasks/` - and answer `ok:true` with `written: false` and a
  reason naming the absent root; if it does, create the slug directory and write
  the record through `atomicWrite`, which is the symlink-refusing writer FSW-01
  put in place. Overwriting an existing record is correct here and is the
  opposite of `cmdAdjudication`'s refusal: that seam refuses because a second
  round's rulings must not replace a first, while this record is derived wholly
  from the range and the text, so a re-run over an unchanged range rewrites the
  same bytes and a re-run over a wider range is the correction the caller
  intended. Append one `outcome` family event named `task_record` BEFORE the
  envelope is emitted and on every path past argument validation, exactly as
  `cmdRiskCheckRun` does, carrying the slug, both range spellings, both resolved
  ids and the commit and file counts; hardcode its `phase` to `0`, the number
  `workflows/task.md` already states no roadmap phase carries, rather than
  taking a `--phase` a caller could misstate. Carry no `role` and no `tokens` on
  it: it opens no bracket and bills no worker, and a token figure is read off a
  subagent return this seam does not have. The append may not change the verdict
  - `appendEvent` never throws and never speaks - so its `{written, reason}`
  rides the envelope as `trace: {...}` beside the record's own top-level
  `{written, reason}`.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` and
  `node --test cadence-core/bin/arg-contract-adoption.test.mjs` pass, with new
  cases in the first proving: a run against a scratch repository writes
  `<dir>/tasks/<slug>/RECORD.md` whose `## Commits` table names exactly the
  commits in the range and whose `- **Files:**` line names exactly the paths the
  range touched; a second identical run leaves the file byte-identical; a run
  with `--dir` pointing at a path that does not exist creates nothing on disk
  and answers `written: false` with a reason; `--slug ../escape` is refused with
  no file anywhere; and a `--base` this repository cannot resolve answers
  `ok:false` with nothing written. `node cadence-core/bin/self-verify.mjs --root .`
  still returns `ok:true` with `problems: []`.

### Task 3: The recall corpus reaches the tasks tier

- **Files:** cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/planning-files.test.mjs, cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs
- **Action:** Add a reader beside `parseSummarySnippets` in
  `lib/planning-files.mjs`, in the same block and using the same private
  `sectionBody` helper, that returns a task record's `## What shipped` bullets
  as corpus snippets under the same rules its sibling applies: a `^-\s+` bullet,
  skipping a placeholder line starting `None` or `<`, absence of the section
  being data and never a throw. It must be its own reader and not a call to
  `parseSummarySnippets`, because that one indexes `## Deviations` and
  `## Open items` alone and D-09 measured that even a SUMMARY-shaped record's
  headline and `## What shipped` lines are invisible through it. Then extend
  `cmdRecall`'s corpus assembly in `planning.mjs` to walk the tasks tier through
  task 1's lister, pushing one entry per snippet with
  `source: "tasks/<slug>/RECORD.md"` and NO `phase` key - a task sits outside
  the phase spine, `references/recall.md` states `phase` is optional and that a
  reader must never substitute an inferred one, and `phase: 0` here would be an
  inferred one. Append this tier AFTER the `ARCHIVE.md` walk, and say why in the
  comment: `search()` orders hits by score then corpus position, so appending
  leaves every existing corpus index where it was and a tree with no `tasks/`
  emits the bytes it emitted before this walk existed - the identical argument
  the `ARCHIVE.md` walk's own comment makes for its position. Change nothing
  about the phase, CAPTURE or ARCHIVE arms.
- **Verify:** `node --test cadence-core/bin/planning-files.test.mjs` and
  `node --test cadence-core/bin/planning.test.mjs` pass, with new cases proving:
  the new reader returns the `## What shipped` bullets and skips a `None yet`
  placeholder; `recall` over a fixture tree carrying a task record returns that
  record with `source` `tasks/<slug>/RECORD.md` and no `phase` field; `recall`
  over the same fixture with the `tasks/` directory removed emits stdout
  byte-identical to the pre-change baseline for the same query; and two runs
  over a corpus containing a task record are byte-identical to each other.

### Task 4: The real record for `bound-plan-size`, on disk

- **Files:** .planning/tasks/bound-plan-size/RECORD.md
- **Action:** Produce this repository's first real task record by RUNNING task
  2's subcommand - never by hand-writing the file, which would prove nothing
  about the writer and would be the model-holding-`Write` shape D-07 rejects.
  The subject is the shipped `/cad-task` run recorded in
  `.planning/tasks/bound-plan-size/PLAN.md`'s `## Outcome`: three commits,
  `093408c9`, `2c2b1eef` and `6ed57a7a`, which form the contiguous range
  `093408c9^..6ed57a7a` and touch eight files including
  `cadence-core/templates/config.json` and
  `skills/cad-plan-checker-contract/SKILL.md`. Invoke the subcommand with
  `--slug bound-plan-size`, that range, and a `--text-file` whose contents are
  drawn from that `## Outcome` section in its own words - what shipped, not a
  fresh paraphrase - so the indexed text is the record's, not a new claim about
  it. This record is what plan 2's AC2 check resolves against and what makes
  AC1's recall check a statement about the corpus rather than about a fixture.
  Commit the resulting `RECORD.md` and nothing else from the run: the trace
  event it appends lands in the gitignored `.planning/trace.jsonl`.
- **Verify:** `node cadence-core/bin/planning.mjs recall "plan size ceiling
  max_plan_tasks task count"` returns
  `tasks/bound-plan-size/RECORD.md` among its `results` sources, and
  `git status --porcelain .planning/tasks/bound-plan-size/` is empty after the
  commit. Re-running the same `task-record` invocation leaves
  `git diff --stat .planning/tasks/bound-plan-size/RECORD.md` empty, proving the
  record is derived rather than accumulated.

## Notes

- **Execution order across the phase.** Plan 1 lands FIRST. Plan 2 imports task
  1's module for its `/cad-why` tier and reads task 4's record; plan 3's
  `workflows/task.md` invocation is only legal prose once task 2's `CONTRACTS`
  row exists, or self-verify check 2 files `unknown-subcommand`. No two plans in
  this phase declare the same file, so `plan-overlap` will report none - the
  dependency is on this plan's OUTPUT, not on a shared file, and it is the
  reason this phase is sequential. Plans 2 and 3 are independent of each other
  and may run in either order once this one is done.
- No `weight-budgets.json` entry is touched here: budgets cover `agents/`,
  `skills/`, `cadence-core/workflows/`, `cadence-core/references/` and
  `cadence-core/templates/`, and every file this plan writes is under
  `cadence-core/bin/` or `.planning/`.
- `references/recall.md` is deliberately NOT edited. It documents the return
  SHAPE and its statement about a milestone-labelled leading segment stays true;
  the corpus composition is stated in `planning.mjs`'s own header and in
  `cmdRecall`'s comment, both of which task 2 and task 3 correct, and both of
  which sit under `cadence-core/bin/`, which the budget check does not weigh.
