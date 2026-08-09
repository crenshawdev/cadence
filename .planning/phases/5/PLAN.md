---
phase: 5
plan: 1
requirements: [DOC-02, DOC-03, EVD-02]
files:
  - docs/EVIDENCE.md
  - README.md
  - METHOD.md
  - INTERNALS.md
  - CONTRIBUTING.md
  - cadence-core/workflows/
  - cadence-core/bin/weight-budgets.json
  - skills/cad-land/SKILL.md
  - skills/cad-plan-review/SKILL.md
  - .planning/DOCS-CLAIMS.md
  - .planning/REQUIREMENTS.md
  - .planning/phases/5/docs-verify-run-2.md
---

# Phase 5: Doc sweep - Plan

## Goal

What Cadence claims about itself matches what it does, and the next cycle
starts from a diff rather than a fresh sweep.

## Must be true when done

- `.planning/DOCS-CLAIMS.md` is committed at the `.planning/` root, every claim
  in the run-1 report has a row there carrying a stable id, doc, line, claim and
  verdict, and no row's resolution cell is empty or still reads `pending`.
- Running `node cadence-core/bin/weight.mjs resident --root .` at the phase's
  LAST commit reproduces every turn-one byte figure printed in
  `docs/EVIDENCE.md`, and `README.md` links that file. The figures are
  re-measured after the last prose edit lands, never only at the commit that
  created the artifact.
- `README.md`'s v2.3.0 byte paragraph reads as a measurement taken at v2.3.0 and
  points at `docs/EVIDENCE.md` for current figures, with its before/after intact.
- `skills/cad-land/SKILL.md` and `skills/cad-plan-review/SKILL.md` both name the
  byte figure `node cadence-core/bin/weight.mjs --root .` reports for
  `cadence-core/references/review-triggers.md`.
- Every claim the sweep found to describe a code defect rather than stale prose
  has its own id under `## Deferred` in `.planning/REQUIREMENTS.md`, and
  `node cadence-core/bin/planning.mjs audit --dir .planning` reports zero
  `unpicked` breaks.
- `.planning/phases/5/` holds both run records, and the run-2 record states the
  delta in the form `run-1 stale N -> run-2 stale M + K divergences` with M < N.
- `node --test cadence-core/bin/*.test.mjs`,
  `node cadence-core/bin/self-verify.mjs --root .` and
  `npx tsc -p tsconfig.ci.json` are green, with `weight-budgets.json`
  regenerated for every surface this phase edited.

## Context

Locked by `phases/5/CONTEXT.md`: the sweep itself is ORCHESTRATOR work (D-13) -
no task here invokes `/cad-docs-verify`, and every task that consumes sweep
output reads it off disk. The ledger lives at `.planning/DOCS-CLAIMS.md`, not in
the phase dir, because `/cad-milestone` archives `phases/5/` (D-04); `divergence`
is a ledger RESOLUTION value and must not be added to `docs-verify.md`'s verdict
vocabulary (D-05); DOC-03 defects file under `## Deferred`, never `## Active`
(D-06); the evidence artifact lives under `docs/` (D-07) and carries the byte
figures only, with the trace half closed as not-fired (D-09). All 93 budgeted
surfaces sit at exactly their byte count, so any edit under
`cadence-core/workflows/` regenerates `weight-budgets.json` in the same task
(D-12). Out of scope: widening the sweep to `skills/**` or
`cadence-core/references/*.md` beyond D-11's two figures, changing
`docs-verify.md`'s default target set (D-01), and re-measuring `README.md:132`'s
v2.3.0 figures as current numbers (D-10).

### Orchestrator-produced inputs (present before this plan executes)

- `.planning/phases/5/docs-verify-run-1.md` - the committed run-1 report,
  covering all 25 AC1-surface files by name, each with its claim table, produced
  by three `/cad-docs-verify` invocations over the explicit path list: the four
  root docs, `cadence-core/workflows/` A-M, `cadence-core/workflows/` N-Z (D-01,
  D-02). The three invocation strings are recorded verbatim so the next cycle
  re-runs them unchanged.
- Two constraints the sweep ran under, to be transcribed into the ledger header:
  `CONTRIBUTING.md` was swept by hand end to end because no mechanical check
  covers it (D-15), and `CONTRIBUTING.md:17-21`'s "the same three checks CI runs"
  is verified accurate against `.github/workflows/test.yml` rather than left
  unverifiable, while the adjacent "no dependencies / no `npm install`" claim is
  judged on its own merits (D-14).

## Tasks

### Task 1: Runtime-evidence artifact under `docs/`, linked and anchored from README

- **Files:** docs/EVIDENCE.md, README.md
- **Action:** Create `docs/EVIDENCE.md` as the phase's runtime-evidence artifact
  (EVD-02). Run `node cadence-core/bin/weight.mjs resident --root .` and
  `node cadence-core/bin/weight.mjs --root .` and publish, with the measurement
  date and the HEAD sha stated: a turn-one table of all 23 user-invocable
  commands with each command's `eagerBytes` and their total (278,315 B as
  measured 2026-08-09), the resident composition for the heaviest commands
  (eager / reachable / dispatch, defined as `lib/resident-weight.mjs` defines
  them - EAGER is the bytes the host injects before the command's first turn),
  and the per-surface totals from the bare form. Every figure this task prints
  is PROVISIONAL and Task 8 re-measures it: Task 5 edits the 21 workflow files,
  whose bytes are exactly what `eagerBytes` counts (a command's eager bytes are
  its `skills/<cmd>/SKILL.md` plus the workflow file it `@`-includes), so one
  corrected byte moves this table. Print the artifact with its measurement date
  and HEAD sha so the staleness is visible if Task 8 ever fails to run. Print the
  exact regenerating command beside each table, and use D-08's definitions and
  nothing else:
  "resident" is `weight.mjs resident`, "turn-one" is that output's per-command
  `eagerBytes`, per-surface is the bare `weight.mjs` - never reachable bytes or
  an all-surfaces total under a "turn one" label, because `README.md:132`
  already fixes that term's meaning and two incomparable numbers under one label
  is the defect this artifact exists to prevent. Carry NO trace evidence: the
  contingent half did not fire (D-09). Then edit `README.md` twice, and only
  twice: add a link to `docs/EVIDENCE.md` beside the existing `docs/WORKFLOW.md`
  pointer (`:38`) naming it as the measured byte figures with the command that
  regenerates them; and re-anchor the v2.3.0 paragraph at `:132` - keep the
  `231,422 -> 199,687` before/after and both named commands exactly as written,
  add an explicit "measured at v2.3.0" frame, and point at `docs/EVIDENCE.md`
  for current figures. Do NOT restate the v2.3.0 numbers as current and do NOT
  delete the before/after: correcting them destroys the paragraph's point and
  goes stale again next cycle (D-10).
- **Verify:** `node cadence-core/bin/weight.mjs resident --root .` reproduces
  every per-command figure printed in `docs/EVIDENCE.md` (spot-check at least
  `cad-execute`, `cad-land` and `cad-pause` byte-for-byte);
  `grep -c 'docs/EVIDENCE.md' README.md` returns at least 2;
  `grep -c '231,422' README.md` still returns 1; and
  `node cadence-core/bin/self-verify.mjs --root .` prints `"problems":[]`.

### Task 2: Build the claim ledger from the run-1 report

- **Files:** .planning/DOCS-CLAIMS.md
- **Action:** Read `.planning/phases/5/docs-verify-run-1.md`. BEFORE transcribing
  anything, prove the report actually covers the surface: each of the 25
  AC1-surface filenames must appear in it (the four root docs and all 21
  `cadence-core/workflows/*.md`). A sweep group that truncated under context
  pressure produces a short report that every downstream verify in this plan
  would otherwise agree with, because they all compare the ledger against
  itself - stop and report the missing files rather than transcribing a partial
  surface. Then transcribe it
  into `.planning/DOCS-CLAIMS.md`, the diff base the next cycle re-verifies
  against (DOC-02, D-03). Header records: the sweep date, the THREE
  `/cad-docs-verify` invocation strings verbatim so the next cycle re-runs them
  unchanged (D-01, D-02), the surface (25 files, 268,992 B), the run-1 counts in
  the form `N accurate, M stale, K unverifiable`, the two sweep constraints from
  the Orchestrator inputs section above (D-14, D-15), and one sentence stating
  that `divergence` is a RESOLUTION value in this ledger and is deliberately NOT
  a fourth `docs-verify.md` verdict - a divergence is a property of the
  resolution, not of the reading, and adding it to the workflow's vocabulary
  would re-emit it for every other project and cost a budget regeneration on a
  zero-slack file (D-05). Do not edit
  `cadence-core/workflows/docs-verify.md`. Then one table row per claim in the
  report, columns `id | doc | line | claim | verdict | resolution`. Ids are the
  doc's basename uppercased, a dash, and a two-digit ordinal in report order
  (`README-01`, `CONTRIBUTING-03`, `PLAN-02` for
  `cadence-core/workflows/plan.md`). Those ids are POSITIONAL, which makes them
  stable within a run and NOT across runs - one claim added or dropped shifts
  every id below it, so next cycle's `README-02` need not be this cycle's. State
  that in the header, and state the join rule that follows from it: the next
  cycle's diff matches rows on `doc` plus claim text, and carries an id forward
  only when that text matches. A diff joined on the id alone would report a
  resolved claim as regressed and a newly drifted one as already corrected.
  Resolution is `accurate` on every accurate
  row and `pending` on every `stale` and `unverifiable` row - never an empty
  cell at any point in the phase. The ledger goes at the `.planning/` root, NOT
  under `phases/5/`, because `/cad-milestone` moves the phase dir into
  `_archive-v2.6.0/5/` at the close and a diff base inside the archive is
  findable only by someone who already knows the archive label (D-04).
- **Verify:** Each of the 25 AC1-surface filenames appears in
  `.planning/phases/5/docs-verify-run-1.md` (loop the 25 names through
  `grep -c`; every one returns at least 1). The ledger's row count equals the
  claim count counted IN THE RUN-1 REPORT ITSELF - count the report's own claim
  rows, not the ledger's header, because the header is transcribed by this same
  task and comparing it against the rows it was written beside cannot detect a
  claim dropped in transcription. And `grep -nE '\|\s*$' .planning/DOCS-CLAIMS.md`
  returns no table row with an empty trailing cell.

### Task 3: File every code defect the sweep found as its own requirement id

- **Files:** .planning/REQUIREMENTS.md, .planning/DOCS-CLAIMS.md
- **Action:** For every ledger row where the run-1 report shows the CODE is
  wrong rather than the prose stale, add one new id under `## Deferred` in
  `.planning/REQUIREMENTS.md` (DOC-03). Ids are `DFC-01`, `DFC-02`, ...
  sequential in ledger order; each bullet names the claim's `doc:line`, what the
  prose asserts, what the code actually does, and why that is a defect rather
  than a wording problem. `## Deferred`, never `## Active`: `req-traceability.md`
  states an `## Active` id has exactly two exits - planned into a phase, or moved
  out of Active - so a new Active id with no phase row becomes an `unpicked`
  break in `/cad-audit`, the pre-ship gate, turning a documentation finding into
  roadmap surgery at the close (D-06). `.planning/CAPTURE.md` cannot be the sole
  home: it is gitignored here, so a filing there exists on one machine only. Set
  EVERY such ledger row's resolution to `divergence - code defect, filed as
  DFC-0k`, whether or not that row's prose also needs an edit. This task edits
  no doc prose at all - the two files named above are the whole of its
  territory, and a defect row whose prose is ALSO wrong takes that prose edit,
  and an upgrade of its resolution to `corrected (task 4) + DFC-0k` or
  `corrected (task 5) + DFC-0k`, from whichever doc-group task owns that file
  under those tasks' two-exit rule. The filing runs BEFORE both correction tasks
  precisely so no code-defect row is still reading `pending` when their verifies
  demand a resolved column. If the sweep found no claim describing a code
  defect, file nothing and instead state that verbatim in the ledger header
  ("run 1 found no claim describing a code defect; no DFC id filed") - do not
  invent one. ONE filing is named in advance and is filed whether or not run 1
  surfaces it: `cadence-core/bin/lib/trace.mjs:336` carries two literal NUL bytes
  in the composite worker key, written as raw U+0000 rather than the `\0` escape,
  so `file(1)` reports the source as `data` and every `grep`/`rg` over
  `cadence-core/bin/**` silently skips the whole file without `-a`. It is a
  one-character fix, it has cost a debugging detour in phase 4's UAT, and its
  only record is `.planning/CAPTURE.md`, which is gitignored here - so the same
  argument that sends every other defect to `## Deferred` sends this one there
  too, rather than leaving each future pass to rediscover it and work around it.
  Record every filed id, or the explicit none, in this task's report
  Note so the orchestrator's summary step carries it into `SUMMARY.md` (AC4);
  the executor never writes `SUMMARY.md`.
- **Verify:** `node cadence-core/bin/planning.mjs audit --dir .planning` returns
  `"ok":true` with zero `unpicked` breaks; each new id appears exactly once
  under `## Deferred` (`grep -n 'DFC-' .planning/REQUIREMENTS.md` shows every
  hit below the `## Deferred` heading's line number and none above it);
  `git status --porcelain -- README.md METHOD.md INTERNALS.md CONTRIBUTING.md
  cadence-core/` returns nothing, proving the filing touched no doc prose (this
  runs before the task's commit, so it reads the working tree, not `HEAD`); and
  `node --test cadence-core/bin/planning.test.mjs` stays green.

### Task 4: Correct the stale claims in the four root docs

- **Files:** README.md, METHOD.md, INTERNALS.md, CONTRIBUTING.md,
  .planning/DOCS-CLAIMS.md
- **Action:** For every ledger row whose doc is `README.md`, `METHOD.md`,
  `INTERNALS.md` or `CONTRIBUTING.md` and whose verdict is `stale` or
  `unverifiable`, take one of exactly two exits and take it explicitly: edit the
  prose to the correct value the run-1 report names, or leave the prose standing
  and record it as a known divergence with the reason it stands. Edit prose to
  what the code does, never the reverse - no code is touched here. A row Task 3
  already resolved to `divergence - code defect, filed as DFC-0k` keeps that
  resolution and its prose as they stand, UNLESS that prose is also wrong
  independent of the defect, in which case correct it and upgrade the row to
  `corrected (task 4) + DFC-0k` - never reword a claim into a description of the
  defect, which documents the bug instead of leaving it filed. Do not touch
  `README.md:132`'s v2.3.0 figures (D-10, already re-anchored in Task 1) and do
  not re-run the extraction. In the same commit set each of those rows'
  resolution to `corrected (task 4)` or `divergence - <reason it stands>`;
  Task 7 replaces the `(task 4)` marker with this task's commit sha. The row (or
  rows) covering `README.md:132` take a THIRD value, `corrected (task 1)`,
  because Task 1 already re-anchored that paragraph: `corrected (task 4)` would
  make Task 7 name a commit whose diff does not contain the change, and
  `divergence` would record that prose as standing when it was rewritten a
  commit earlier. Neither is true, so neither is written.
- **Verify:** `grep -n 'pending' .planning/DOCS-CLAIMS.md` returns no row whose
  doc column is one of the four root docs - every such row is resolvable here,
  because Task 3 has already cleared the code-defect rows to `divergence - code
  defect, filed as DFC-0k`; `node cadence-core/bin/self-verify.mjs --root .`
  prints `"problems":[]` (the three root docs are linted surfaces); and each
  corrected claim's new value matches what the report named as correct, checked
  by re-running that claim's own check (the `Glob`/`Grep`/`Read` the report
  cites) for at least every `stale` row edited.

### Task 5: Correct the stale claims in `cadence-core/workflows/` and regenerate budgets

- **Files:** cadence-core/workflows/, cadence-core/bin/weight-budgets.json,
  .planning/DOCS-CLAIMS.md
- **Action:** Apply the same two-exit rule as Task 4 to every ledger row whose
  doc is one of the 21 `cadence-core/workflows/*.md` files, including its
  handling of the rows Task 3 already resolved as code defects, and set each
  row's resolution to `corrected (task 5)`, `corrected (task 5) + DFC-0k` or
  `divergence - <reason it stands>`. Then,
  in the SAME task and the SAME commit, regenerate every edited surface's entry
  in `cadence-core/bin/weight-budgets.json` from
  `node cadence-core/bin/weight.mjs --root .`, setting each entry to the byte
  count that command reports. This is not optional bookkeeping: all 93 budgeted
  surfaces sit at exactly their byte count with total slack 0, so one added byte
  anywhere is a hard `budget-overrun` on the introducing commit (D-12, carrying
  phase 2's D-18 forward). Until the NUL-bytes defect Task 3 filed is fixed, a
  `grep`/`rg` over `cadence-core/bin/**` run while verifying a claim needs `-a`
  or it silently skips `cadence-core/bin/lib/trace.mjs` whole; that is a filed
  defect being worked around, not a standing convention, and the workaround
  leaves with the filing.
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` prints
  `"problems":[]` - no `budget-overrun`, no `unbudgeted-surface`; for every
  workflow file edited, its `weight-budgets.json` entry equals the `bytes` value
  `node cadence-core/bin/weight.mjs --root .` reports for that surface; every
  ledger row this task resolved `corrected (task 5)` or `corrected (task 5) +
  DFC-0k` names a doc that this task actually EDITED (`git status --porcelain --
  cadence-core/workflows/` lists it before the commit) - a `corrected` row whose
  file was never touched is a false pass, and both of this task's other clauses
  are already true on an untouched tree; and each corrected claim's new value
  matches what the report named as correct, checked by re-running that claim's
  own check for at least every `stale` row edited.

### Task 6: One byte figure for `review-triggers.md` in both skills

- **Files:** skills/cad-land/SKILL.md, skills/cad-plan-review/SKILL.md
- **Action:** Replace `15,376 B` with `17,733 B` at `skills/cad-land/SKILL.md:44`
  and `15,376 B` at `skills/cad-plan-review/SKILL.md:39` - phase 4 of this cycle
  grew `cadence-core/references/review-triggers.md` and updated only the budget,
  leaving both inline figures stale (AC6, D-11). Both are equal-length
  six-character replacements that move neither file's byte count, so do NOT edit
  `weight-budgets.json` for them. This is a stated exception and nothing more:
  `skills/**` is NOT added to the sweep surface, and no other figure in those
  files is touched.
- **Verify:** `grep -rn '15,376' skills/` returns nothing; `grep -c '17,733 B'`
  returns 1 for each of the two files;
  `node cadence-core/bin/weight.mjs --root .` reports `17733` bytes for
  `cadence-core/references/review-triggers.md`; and
  `node cadence-core/bin/self-verify.mjs --root .` prints `"problems":[]`.

### Task 7: Confirmation pass over the ledger ids, and close every resolution

- **Files:** .planning/phases/5/docs-verify-run-2.md, .planning/DOCS-CLAIMS.md
- **Action:** Produce the confirmation record. If
  `.planning/phases/5/docs-verify-run-2.md` already exists (the orchestrator ran
  the confirmation sweep between plans), read it and skip to the ledger close.
  Otherwise re-verify EVERY ledger id against the live tree - the ids, not a
  fresh extraction, which is exactly what D-03 defines the confirmation run to
  be, and which is why the delta is a set difference rather than a comparison of
  two independently extracted claim sets. Do NOT invoke `/cad-docs-verify`: that
  command is the orchestrator's (D-13) and `agents/cad-executor.md` declares no
  `Task` or skill-invocation tool, so a task that called it would return blocked;
  re-check each claim directly with `Read`, `Grep`, `Glob` and read-only `Bash`,
  the same checks the run-1 report cites per claim. Write
  `.planning/phases/5/docs-verify-run-2.md`: one row per ledger id with its
  run-2 verdict, the stale rows first, and the delta line in exactly the form
  `run-1 stale N -> run-2 stale M + K divergences`. Then close the ledger:
  replace every `pending` resolution and every `(task k)` marker with
  `corrected - <sha>` (the sha of the task-k commit, read from
  `git log --oneline`) or `divergence - <reason it stands>`, so zero rows read
  `pending` and zero cells are empty (AC2). `(task 1)`, `(task 4)` and
  `(task 5)` are all live markers and each resolves to ITS OWN task's commit -
  the `README.md:132` row carries `(task 1)` on purpose. Keep any `+ DFC-0k`
  suffix Task 3 wrote: the marker being replaced is the `(task k)` parenthetical
  alone, and the id is the row's only link to its filing. A run-2 verdict that is still
  `stale` on a row resolved `corrected` means the correction did not land -
  fix the prose and re-check rather than recording the row as a divergence.
- **Verify:** `grep -c 'pending' .planning/DOCS-CLAIMS.md` returns 0;
  `grep -nE 'run-1 stale [0-9]+ -> run-2 stale [0-9]+ \+ [0-9]+ divergences' .planning/phases/5/docs-verify-run-2.md`
  matches exactly one line, and in it M is strictly less than N (AC3); and
  `grep -nE '\|\s*$' .planning/DOCS-CLAIMS.md` returns no table row with an
  empty trailing cell.

### Task 8: Whole-tree gate sweep

- **Files:** cadence-core/bin/weight-budgets.json, docs/EVIDENCE.md
- **Action:** Run the three gates over the whole tree and settle any residual
  budget drift from this phase's edits (AC7). Compare every surface's reported
  bytes from `node cadence-core/bin/weight.mjs --root .` against its
  `weight-budgets.json` entry and correct any entry this phase's edits left
  stale. If zero entries are stale, change nothing there - a gate-only check
  with nothing to change is a clean pass, not a reason to touch the manifest
  (the same call phase 4's task 7 made). Then RE-MEASURE `docs/EVIDENCE.md`:
  re-run both `weight.mjs` forms and rewrite every figure and the measurement
  date and HEAD sha in that file to what they report now. This is the task that
  makes the artifact true. Task 1 published provisional figures and Task 5 then
  edited the 21 workflow files those figures count, so without this step the
  phase closes with its own evidence artifact contradicting the command printed
  beside it - which is the exact defect `README.md:132` is being re-anchored for,
  reintroduced in the file that replaces it. Keep the D-08 definitions and the
  regenerating commands exactly as Task 1 wrote them; only the numbers, the date
  and the sha change. Record all three gate
  outputs verbatim in this task's report Note, and record there as well the
  sentence AC5 requires the summary to carry: no non-Cadence project had a phase
  trace, so EVD-02's contingent trace half did not fire and is closed rather than
  left dangling (D-09; checked 2026-08-09 across `/code/*` and `/data/code/*` -
  eight projects with `.planning/`, none with a `trace.jsonl`).
- **Verify:** `node --test cadence-core/bin/*.test.mjs` reports `fail 0`;
  `npx tsc -p tsconfig.ci.json` exits 0 with no output;
  `node cadence-core/bin/self-verify.mjs --root .` prints `"problems":[]`;
  `node cadence-core/bin/weight.mjs resident --root .` reproduces every
  per-command figure now printed in `docs/EVIDENCE.md`, spot-checked byte-for-byte
  on `cad-execute`, `cad-land` and `cad-pause`, and the eager total in the file
  equals the total that command reports; and
  `git status --porcelain -- docs/ README.md METHOD.md INTERNALS.md
  CONTRIBUTING.md cadence-core/ skills/ .planning/DOCS-CLAIMS.md
  .planning/REQUIREMENTS.md` returns nothing after the commit. The pathspec is
  scoped on purpose: `<plandir>/reports/plan-1.md` is untracked at exactly this
  moment by the executor contract's own rule, so a bare `git status --short`
  would fail this gate on a file the contract requires to be dirty.

## Notes

**Plan shape deviation.** `phases/5/CONTEXT.md` asks for three plans in the same
phase. This is ONE plan, because the file-independence test the planner contract
makes the hard constraint fails on both of its clauses: the proposed slices share
files (`.planning/DOCS-CLAIMS.md` is written by the ledger slice and rewritten by
both the corrections slice and the close; `README.md` carries both the D-10
re-anchor and the run-1 corrections; `cadence-core/bin/weight-budgets.json` is
touched by the workflow corrections and by the gate sweep), and they carry hard
cross-slice ordering (ledger before resolutions, corrections before the
confirmation pass, gates last). Split into PLAN-1/2/3 they would be eligible for
`/cad-execute`'s parallel path, where that ordering breaks and the lease check
refuses the overlap. The CONTEXT rationale for splitting - staying inside the
resolved `workflow.max_plan_tasks` ceiling of 8 - is satisfied anyway: this plan
is exactly 8 tasks.

**Sequencing the defect filings before the corrections.** Task 3 files the
DOC-03 defect ids ahead of both correction tasks rather than after them, because
Task 4's verify requires that no root-doc ledger row still read `pending` and a
code-defect row is one Task 4 is forbidden to resolve on its own: filing first is
what makes that verify satisfiable without an exception clause. The split of
territory is strict and follows from it - Task 3 files ids and writes
resolutions, never doc prose (its two `.planning/` files are its whole Files
list); Tasks 4 and 5 own every prose edit in their doc groups, including the
prose edit on a row already filed as a defect, which they take as a `corrected
(task k) + DFC-0k` upgrade of the resolution Task 3 wrote. No task edits a file
another task's Files list claims for prose.

**Sequencing the confirmation run.** The orchestrator owns `/cad-docs-verify`
(D-13). Run 1 must be committed at `.planning/phases/5/docs-verify-run-1.md`
before this plan executes. For run 2 there are two paths and both are supported
by Task 7: the orchestrator runs the confirmation sweep scoped to the ledger's
ids and writes `.planning/phases/5/docs-verify-run-2.md` itself, in which case
Task 7 reads it and only closes the ledger; or, absent that file, Task 7 performs
the re-verification directly against the tree, id by id, without invoking the
command.

**Two sentences the orchestrator's summary step must carry.** The executor never
writes `SUMMARY.md`, so both land through the task report Notes named in Tasks 3
and 8: every `DFC-0k` id filed this phase (or the explicit none), for AC4; and
"no non-Cadence project had a phase trace, closing EVD-02's contingent half", for
AC5.

**Reading applied to AC2's resolution column.** AC2 requires that no row have an
empty resolution and that a resolution be `corrected` or `divergence`. Those two
bind together only on the rows that need resolving, so this plan fills the
column on every row and uses `accurate` for rows the sweep confirmed - the
`corrected`/`divergence` binary governs every `stale` and `unverifiable` row,
which is the same scope DOC-02 and ROADMAP criterion 2 give it. No cell is left
empty at any point, including between tasks, where `pending` holds the place.

**Nine `plan`-review findings applied 2026-08-09,** all nine adjudicated in by
the user: the evidence artifact is re-measured at Task 8 rather than left as
Task 1 published it; Task 5's verify gained a clause no untouched tree can
satisfy; Task 2 proves the run-1 report covers all 25 files and counts claims in
the report rather than in its own header; the ledger's positional ids are
declared per-run with the diff joining on doc plus claim text; `README.md:132`
takes a `corrected (task 1)` resolution; the surface figure is 268,992 B, not
268,982 (measured); the NUL-bytes defect is filed by Task 3 at its real location
`:336` rather than worked around forever at a stale `:296`; and Task 8's final
`git status` is pathspec-scoped so the executor contract's own untracked report
file cannot fail the phase's last gate.

**Prior art carried in.** The only previous `/cad-docs-verify` run (v2.0.0 phase
3, 2026-07-29: 32 claims, 30 accurate, 1 stale) left one judgment call open and
never resolved - `INTERNALS.md:17` points at a `DESIGN.md` heading whose title
still names the `auto` mode deleted in v2.0.0 (`.planning/CAPTURE.md`). That is
exactly the shape D-05 now calls a divergence, so it should appear in run 1 as an
`INTERNALS-0k` row and be resolved rather than carried a third time.
