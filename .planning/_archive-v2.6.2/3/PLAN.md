---
phase: 3
plan: 1
requirements:
  - CTW-04
files:
  - cadence-core/references/config-catalog.md
  - cadence-core/references/plan-revision.md
  - cadence-core/references/execute-parallel.md
  - cadence-core/references/worktree-executor.md
  - cadence-core/references/recall.md
  - cadence-core/templates/CONTEXT.md
  - cadence-core/workflows/config.md
  - cadence-core/workflows/plan.md
  - cadence-core/workflows/execute.md
  - cadence-core/workflows/context.md
  - cadence-core/workflows/debug.md
  - cadence-core/references/config-reach.md
  - skills/cad-executor-contract/SKILL.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/lib/deferred-reads.mjs
  - cadence-core/bin/deferred-reads.test.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/trace.test.mjs
  - docs/EVIDENCE.md
  - .planning/DOCS-CLAIMS.md
---

# Phase 3: The deferrals - Plan

## Goal

~22,300 B of branch-local prose is read at the step that needs it instead of
riding every turn, and every move is watched by phase 1's register.

## Must be true when done

- `node cadence-core/bin/weight.mjs resident --root .` prints `/cad-config`
  eager at or below 12,800 B, and none of the six moved spans is on its old
  surface any more: `cadence-core/workflows/config.md` carries no knob-catalog
  table and no Type-key legend, `plan.md` no BLOCKER-revision branch,
  `execute.md` no `execute_parallel` body, `skills/cad-executor-contract/SKILL.md`
  no `<worktree_mode>` rules, `context.md` no CONTEXT output template and no
  recall render contract, `debug.md` no recall fold contract.
- What stays eager is still eager: `choose_path` and `handle_checkpoint` inline
  in `execute.md`, `plan.md`'s two recall gate sites inline, the
  `builtin`/`none` decision sentence inline at all four of its sites, and the
  "never hand-validate against this table; call the seam" rule inline in
  `config.md`.
- `node cadence-core/bin/self-verify.mjs` returns `ok:true` with `problems:[]`
  and `node --test cadence-core/bin/*.test.mjs` passes at EVERY commit this
  phase creates, not only the last.
- `DEFERRED_READS.length === 11`, the live tree reports zero deferred-read
  issues, and for each of the seven new rows a fixture copy with that one `Read`
  sentence deleted reports exactly one `deferred-read-unread` naming that row's
  anchor.
- Every new `Read` sentence states its reference's measured bytes and its
  consult-site count, and `cadence-core/bin/prose-agreement.test.mjs` fails when
  any one of those figures is mutated away from the measured value.
- `docs/EVIDENCE.md`'s six tables all reproduce from a fresh
  `node cadence-core/bin/weight.mjs --root .` and
  `node cadence-core/bin/weight.mjs resident --root .`: 99 budgeted surfaces,
  `cadence-core/references/` 21, `cadence-core/templates/` 9, the twelve-largest
  table with `cadence-core/workflows/audit.md` in it and
  `cadence-core/workflows/config.md` out of it, and still exactly three
  zero-resident reference files.
- `cadence-core/bin/trace.test.mjs`'s `BRACKETING` map lists
  `cadence-core/workflows/plan.md` at 2 and
  `cadence-core/references/plan-revision.md` at 2, with
  `cadence-core/workflows/execute.md` unchanged at 1.

## Context

CONTEXT.md D-01..D-19 are locked and every one of them is implemented below.
D-13 fixes the commit shape: one commit per move carrying the new file, its
`weight-budgets.json` row, the source re-pin, the `docs/EVIDENCE.md` edits, the
register row and the test rework together, because `self-verify.mjs:713-728`
files `unbudgeted-surface` on a measured surface with no entry and
`budget-undershoot` on any shrink, so any smaller commit is red. D-14 sequences
`config.md` last. Out of scope: `choose_path` and `handle_checkpoint` (D-05),
`plan.md`'s two recall gates (D-04), any further trimming of `config.md`'s
surviving eager prose (D-02), and any new self-verify check - phase 1 shipped
the capability this phase exercises.

## Tasks

### Task 1: Make the register's meaning and the byte-figure check cover what this phase is about to ship

- **Files:** cadence-core/bin/lib/deferred-reads.mjs,
  cadence-core/bin/prose-agreement.test.mjs
- **Action:** Two edits, both landing before any prose moves, because they are
  what the six moves are graded by. (a) D-11: widen the header's "Why the
  register is HAND-MAINTAINED" paragraph (`:9-16`) to state that a row also
  covers prose PROMOTED out of an inlined surface into a file of its own, where
  no `@`-include ever existed and the `stillEager` arm is therefore vacuous -
  such a row's whole protection is its anchor, and deleting it because "no
  include was removed" is exactly the silent unwatching the register exists
  against. Keep the existing removal narrative; add the promotion arm beside it,
  and say that `skill` still names the command whose SKILL.md the include arms
  test even when `file` points at a workflow. (b) D-17: replace the hardcoded
  `const REF = 'cadence-core/references/review-triggers.md'` /
  `for (const skill of ['cad-land', 'cad-plan-review'])` body of the test
  `every site copying a measured byte count states the measured number` with a
  SCAN, so a new deferral cannot ship an unchecked figure. Walk every
  `skills/*/SKILL.md`, `cadence-core/workflows/*.md` and
  `cadence-core/references/*.md`; for each line naming a
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/<references|templates>/<file>` path AND
  carrying a byte figure of the shape `\d{1,3}(,\d{3})* B` in the same sentence -
  the `toLocaleString('en-US')` form the file's own `commas()` helper emits,
  which admits `912 B` as well as `17,837 B`; the narrower `N,NNN B` shape steps
  straight over any reference measuring under 1,000 B and leaves its figure
  unchecked, which is the drift this scan exists to close (split sentences the
  same way `lib/deferred-reads.mjs` does - terminator followed by whitespace) -
  assert the figure equals `weighAll(REPO)`'s measured bytes for that surface and
  that `weight-budgets.json` carries the same number. Then assert COVERAGE off
  the register itself: import `DEFERRED_READS` and require that every row's
  `file` (defaulting to `skills/<skill>/SKILL.md`) contains, inside EACH of that
  row's anchored regions, at least one sentence naming that row's reference and
  carrying both a figure of the same shape and the word `site`, resolving regions
  with the register's own `regionLabels` so the arm reads an anchor exactly as
  the check does. EXEMPT the three `cad-land` rows
  (`references/review-triggers.md`, `references/git-publish.md`,
  `references/triage-gate.md`) through an explicit `GRANDFATHERED` set of
  `skill|reference` keys whose stated reason is
  `cadence-core/references/seams.md:239-243`: the inline figure binds deferrals
  made "from this point forward" and that same sentence releases by name "the
  deferrals already in `cad-land`". Not a convenience - the triage-gate row's
  sentence at `skills/cad-land/SKILL.md:52-55` states no bytes and no site count,
  so an unexempted arm is red on the untouched tree and commit 1 fails AC1 before
  any prose moves; and holding the other two `cad-land` sentences to a rule
  seams.md exempts them from would make the test contradict the reference it
  enforces. `cad-plan-review`'s row is NOT exempt -
  `skills/cad-plan-review/SKILL.md:38-39` states `17,837 B, one site` inside
  region `2` - so the arm ships against a live shipped row, and every row this
  phase adds is covered from the commit that adds it. Keep measuring
  through `weighAll` rather than `statSync`, for the reason the existing comment
  gives. Do not delete the comment block explaining the drift class; extend it
  to say the check is now a scan because `references/seams.md:239-243` makes the
  figure mandatory for every future deferral.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` passes on
  the untouched tree (the two `cad-land` / `cad-plan-review` 17,837 B sentences
  are found and checked; of the four shipped register rows the three `cad-land`
  ones are exempt and `cad-plan-review`'s satisfies the coverage arm); editing
  `skills/cad-land/SKILL.md`'s `17,837 B` to `17,838 B` makes it fail naming that
  file, and reverting makes it pass; deleting `one site` from
  `skills/cad-plan-review/SKILL.md:39` makes the coverage arm fail naming that
  row, and reverting makes it pass. `tsc -p tsconfig.ci.json` exits 0.

### Task 2: Move context.md's CONTEXT output template to cadence-core/templates/CONTEXT.md

- **Files:** cadence-core/templates/CONTEXT.md,
  cadence-core/workflows/context.md, cadence-core/bin/weight-budgets.json,
  cadence-core/bin/lib/deferred-reads.mjs, cadence-core/bin/deferred-reads.test.mjs,
  cadence-core/bin/self-verify.test.mjs, docs/EVIDENCE.md
- **Action:** Move `cadence-core/workflows/context.md:299-343` (1,384 B; the
  fenced markdown template alone is 1,186 B at `:301-340`) into a new
  `cadence-core/templates/CONTEXT.md` holding the template body exactly as the
  fence carries it today, plus the "Five sections, nothing else" sentence as the
  file's own closing rule. Do NOT wrap the template in a fence inside the
  template file - it IS the file, the same shape `templates/SUMMARY.md` and
  `templates/PLAN.md` already ship. `<step name="write_context">` keeps the
  `Write {phase_dir}/CONTEXT.md (create the directory if needed)` instruction
  and gains one `Read` sentence naming
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/CONTEXT.md` with its measured
  bytes and `one consult site - this step`, written in the form
  `skills/cad-land/SKILL.md:41-43` uses. Justify it on seams.md's SIZE term, not
  on branch-locality (D-06): the sentence says the step is unconditional and the
  file is read here rather than carried on every turn of the run. That
  `${CLAUDE_PLUGIN_ROOT}` path must appear NOWHERE else in `context.md` -
  `deferred-reads.test.mjs:192-205` asserts every line naming it sits in the
  row's anchored region. Add the register row FIFTH in `DEFERRED_READS`:
  `{skill: 'cad-context', reference: 'templates/CONTEXT.md', anchors: ['write_context'],
  read_paragraphs: 1, file: 'cadence-core/workflows/context.md'}`. Rework the
  three assertions that pin the register at four (D-12): extend
  `deferred-reads.test.mjs`'s byte-exact `REGISTER_SOURCE` literal with the new
  row verbatim, change its `DEFERRED_READS.length` to 5 and rename that test to
  say the four shipped rows are byte-identical AND the register is exactly the
  rows the cuts made, and change `self-verify.test.mjs:1686`'s
  `assert.equal(DEFERRED_READS.length, 4)` to 5. Add the AC4 falsifier to
  `deferred-reads.test.mjs`: `copyReal` the real `workflows/context.md` with that
  one `Read` sentence deleted, run `deferredReadIssues` against the SHIPPED row
  (found in `DEFERRED_READS` by reference, never a synthetic copy), and assert
  exactly one `deferred-read-unread` whose file is
  `cadence-core/workflows/context.md` and whose detail names `write_context`;
  assert the unedited copy is clean. Add the budget row and re-pin `context.md`'s
  in `weight-budgets.json` from measurement. Re-pin `docs/EVIDENCE.md` by
  REGENERATING each affected table from the two `weight.mjs` commands rather
  than hand-editing figures: turn-one `/cad-context` and its 23-command total,
  the eager/reachable pair, the per-directory table
  (`cadence-core/templates/` 8 -> 9 surfaces, grand total 93 -> 94) and its
  prose sentence "93 budgeted surfaces", and the twelve-largest table, whose
  ORDER changes when `context.md` shrinks past `verify.md`.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `ok:true` with
  `problems:[]`; `node --test cadence-core/bin/*.test.mjs` passes;
  `node cadence-core/bin/weight.mjs resident --root .` shows `/cad-context`
  eager fallen by ~1,100 B from 19,029; `grep -c 'templates/CONTEXT.md'
  cadence-core/workflows/context.md` returns 1.

### Task 3: Move the recall render contract to cadence-core/references/recall.md

- **Files:** cadence-core/references/recall.md,
  cadence-core/workflows/context.md, cadence-core/workflows/debug.md,
  cadence-core/bin/weight-budgets.json, cadence-core/bin/lib/deferred-reads.mjs,
  cadence-core/bin/deferred-reads.test.mjs, cadence-core/bin/self-verify.test.mjs,
  docs/EVIDENCE.md, .planning/DOCS-CLAIMS.md
- **Action:** Create `cadence-core/references/recall.md` carrying, once, what
  `context.md:90-99` (698 B) and `debug.md:88-92` (the fold half of the 514 B
  block at `:86-92`) both say: recall's JSON line shape
  `{ok, results:[{score, source, phase?, snippet}]}`, that the top results render
  one line per result carrying `snippet`, `source` and `phase`, that `phase` is
  optional and rendered only when present per the omit-optionals convention,
  that `/cad-context` renders them into a `<recalled_memory>` block placed right
  after `<search_terms>` in the analyzer payload and omits the block entirely on
  empty results, that those snippets ride the DISPATCH PROMPT and never the
  `cad-assumptions-analyzer` definition (D-01 / cache discipline: volatile
  per-phase data against a cached stable instruction), and that `/cad-debug`
  instead folds matching past deviations and UAT findings into the Hypotheses
  list, each noted with its `source` and `phase`. Delete exactly those spans from
  the two workflows. What must stay eager at BOTH sites, verbatim in force: the
  `builtin`/`none` decision sentence and the "gate precedes the call on purpose
  (D-03)" clause - a command must learn the step is skipped without reading
  anything (D-04). Add one `Read` sentence per site naming
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/recall.md` with its measured
  bytes - written in the same `toLocaleString('en-US')` form task 1's scan
  matches, and this is the file that tests it: `recall.md` is built from a 698 B
  span plus the 356 B fold half deduplicated, so it may measure under 1,000 B, in
  which case both sentences read e.g. `912 B` with no comma and never a padded
  `0,912 B` or a rounded figure - and `one consult site - this step`, placed
  AFTER the gate sentence so
  the `none` path never reaches it: in `context.md` inside `<step name="analyze">`,
  in `debug.md` inside the `1. **Hypothesize.**` item under `## The method loop`.
  Do not touch `plan.md` (D-04) and do not touch the `<recalled_memory>`
  placeholder lines inside the two payload fences (`context.md:133`,
  `plan.md:149`) - those are the prompts themselves. Add TWO register rows, sixth
  and seventh: `{skill: 'cad-context', reference: 'references/recall.md',
  anchors: ['analyze'], read_paragraphs: 1, file: 'cadence-core/workflows/context.md'}`
  and `{skill: 'cad-debug', reference: 'references/recall.md',
  anchors: ['The method loop/1'], read_paragraphs: 1, file: 'cadence-core/workflows/debug.md'}`,
  with a row comment recording that seams.md's one-site rule is per COMMAND -
  two commands consulting the same reference at one step each are two
  independent deferrals, not a two-site reference that must stay eager. Update
  `REGISTER_SOURCE`, both length assertions to 7, and add an AC4 falsifier per
  row (delete that site's `Read` sentence from a `copyReal` fixture, expect
  exactly one `deferred-read-unread` naming `analyze` / `The method loop/1`
  respectively). Retarget the `.planning/DOCS-CLAIMS.md` rows whose claim TEXT
  now lives in the new file - CONTEXT-05 and DEBUG-04 both assert recall's JSON
  shape with `phase` optional - setting their `doc` cell to
  `cadence-core/references/recall.md` and their `line` cell to the claim's lines
  there, and leaving CONTEXT-03/04 and DEBUG-02/05 (the gate claims) pointed at
  the workflows. Add the budget row, re-pin both workflows' budgets, and
  regenerate every affected `docs/EVIDENCE.md` table
  (`cadence-core/references/` 16 -> 17, grand total 94 -> 95, `/cad-context` and
  `/cad-debug` turn-one and reachable, the twelve-largest order).
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `ok:true` with
  `problems:[]`; `node --test cadence-core/bin/*.test.mjs` passes;
  `grep -c 'memory.backend' cadence-core/workflows/plan.md` still returns 5 and
  `grep -n 'builtin' cadence-core/workflows/context.md cadence-core/workflows/debug.md`
  still shows the gate sentence at both sites;
  `grep -rn 'results:\[{score' cadence-core/workflows/` returns nothing.

### Task 4: Move execute.md's execute_parallel body to cadence-core/references/execute-parallel.md

- **Files:** cadence-core/references/execute-parallel.md,
  cadence-core/workflows/execute.md, cadence-core/references/config-reach.md,
  cadence-core/bin/weight-budgets.json, cadence-core/bin/lib/deferred-reads.mjs,
  cadence-core/bin/deferred-reads.test.mjs, cadence-core/bin/self-verify.test.mjs,
  docs/EVIDENCE.md
- **Action:** Move `cadence-core/workflows/execute.md:325-379` - numbered items 1
  through 6 plus the closing lifecycle-bracket paragraph and the
  checkpoint-routing sentence - into a new
  `cadence-core/references/execute-parallel.md`, keeping every rule intact
  (batching on `parallelization.max_concurrent_agents`, one route resolved per
  batch, the pre-merge/post-merge HEAD recording and WHY both ends are recorded
  here, `workflow.test_command` read at its only consumer, the concurrent `diff`
  fires, the `phase_diff` fire, the triage-gate RE-READs, the per-worker bracket
  and that the worktree executor writes none of them itself). The step keeps its
  preamble at `:320-324` (the opt-in-path sentence and the `choose_path` /
  `worktree.baseRef` note, which is what makes a `blocked` halt here a real
  defect) and gains, inside that preamble and before any numbered item, one
  `Read` sentence naming
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/execute-parallel.md` with its
  measured bytes and `one consult site - this step` (D-09: the anchor is the bare
  frame label `execute_parallel`, and a sentence inside a numbered item would
  label `execute_parallel(1)` and never satisfy it). `handle_checkpoint` and
  `choose_path` are untouched (D-05). Add the register row eighth:
  `{skill: 'cad-execute', reference: 'references/execute-parallel.md',
  anchors: ['execute_parallel'], read_paragraphs: 1,
  file: 'cadence-core/workflows/execute.md'}`; update `REGISTER_SOURCE` and both
  length assertions to 8; add the AC4 falsifier for it. Rework the fixtures this
  move invalidates, in this same commit: `deferred-reads.test.mjs`'s
  `PARALLEL_ITEM_2` needle (`2. Wait for every executor in the batch...`) no
  longer exists in `execute.md`, so `executeRoot('item1')` would silently become
  a no-op and the `execute_parallel(1)` assertion at `:267` would fail against an
  unedited file. Retarget the AC1/AC4 named-step fixtures to `execute.md`'s
  surviving `<step name="git_guard">`, whose body runs `:42-63` and whose column-0
  items 1-3 sit at `:64-66`: `PARALLEL_OPEN` becomes `<step name="git_guard">`,
  the item needle becomes `\n2. Commit it now as the user's own commit, message
  theirs, then continue`, and the "item 1 does not satisfy item 6" case becomes
  item 1 against `git_guard(3)`, with the test names and comments updated to say
  `git_guard`. Keep the tests' intent word for word: a body-placed sentence
  satisfies the bare frame label, a sentence in item 1 does not, and the frame
  label is never a prefix match for its own items. Correct the now-stale example
  in `lib/deferred-reads.mjs:240-245` the same way - it cites
  `execute.md:343-402` and `1.`-`6.` inside `execute_parallel`, both gone; state
  the same rule against `execute.md`'s `git_guard` items 1-3 and `verify.md` /
  `new-project.md`'s remaining column-0 lists. D-16: update
  `cadence-core/references/config-reach.md:136`
  (`parallelization.max_concurrent_agents`) and `:133`
  (`workflow.test_command`) so their third column names
  `references/execute-parallel.md` as the reach site - the third column is
  unchecked free text (`lib/config-reach.mjs:148-174` validates key membership
  and reach breadth only), which is why it drifts and why it is corrected by
  hand here; `test_command`'s cell keeps `workflows/task.md` and
  `workflows/coverage.md` and the executor contract and ADDS the parallel path,
  closing the `.planning/CAPTURE.md:4` omission. Add the budget row, re-pin
  `execute.md`'s and `config-reach.md`'s, and regenerate the affected
  `docs/EVIDENCE.md` tables (`references/` 17 -> 18, total 95 -> 96,
  `/cad-execute` turn-one and reachable, the twelve-largest figures for
  `execute.md`).
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `ok:true` with
  `problems:[]`; `node --test cadence-core/bin/*.test.mjs` passes;
  `grep -n 'execute_parallel' cadence-core/workflows/execute.md` shows only the
  step tag and the preamble;
  `grep -c 'trace append' cadence-core/workflows/execute.md` still returns 4 and
  `node --test cadence-core/bin/trace.test.mjs` passes with `execute.md` still at
  1 in `BRACKETING`;
  `grep -n 'execute-parallel' cadence-core/references/config-reach.md` shows both
  the `workflow.test_command` and the `parallelization.max_concurrent_agents`
  rows.

### Task 5: Move cad-executor-contract's worktree_mode to cadence-core/references/worktree-executor.md

- **Files:** cadence-core/references/worktree-executor.md,
  skills/cad-executor-contract/SKILL.md, cadence-core/workflows/execute.md,
  cadence-core/bin/weight-budgets.json, cadence-core/bin/lib/deferred-reads.mjs,
  cadence-core/bin/deferred-reads.test.mjs, cadence-core/bin/self-verify.test.mjs,
  docs/EVIDENCE.md
- **Action:** Move the body of `skills/cad-executor-contract/SKILL.md:151-193`
  (2,845 B) into a new `cadence-core/references/worktree-executor.md`, keeping
  all five rules and their reasons whole: the pre-task-1 PLAN assertion and the
  `worktree.baseRef` `fresh` history behind it, the per-commit branch check, the
  stay-inside-the-worktree rule, the commit-the-report-by-pathspec rule with the
  `risk_surface` staging hazard and the never-commit-the-`.diff` clause, and the
  forbidden git verbs. Correct the block's stale cross-reference as it moves
  (D-10): it cites `workflows/execute.md:159-160` for the serialized merge, which
  task 4 relocated - point it at `references/execute-parallel.md`'s merge step
  instead of any line number, so it cannot go stale again. The
  `<worktree_mode>` tags STAY in the contract skill, now holding the
  `Only when your dispatch prompt says worktree mode:` line plus one `Read`
  sentence naming
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/worktree-executor.md` with its
  measured bytes and `one consult site - this step`; the row anchors at label
  `worktree_mode` on the row's DEFAULT `file` (D-10), so the row carries no
  `file` field. Add it ninth:
  `{skill: 'cad-executor-contract', reference: 'references/worktree-executor.md',
  anchors: ['worktree_mode'], read_paragraphs: 1}`; update `REGISTER_SOURCE` and
  both length assertions to 9; add the AC4 falsifier. D-19: in
  `cadence-core/workflows/execute.md`'s `handle_checkpoint` remedy paragraph
  (`:299-302`), which today names only the `<worktree_mode>` TAG, name the FILE
  `references/worktree-executor.md` in the bare citation form - `citedSurfaces`
  in `lib/resident-weight.mjs:221-230` matches that form, and without it the new
  reference reaches no command, `zeroResident` grows to four entries, its total
  moves 26,332 -> ~29,177 and `docs/EVIDENCE.md:95` ("Three reference files") is
  wrong. Add the budget row, re-pin the contract SKILL.md's and `execute.md`'s,
  and regenerate the affected `docs/EVIDENCE.md` tables: `references/` 18 -> 19,
  `skills/` bytes, total 96 -> 97, the whole DISPATCH table (the `cad-executor`
  rows fall ~2,845 B each, and every role that preloads this contract moves), and
  `/cad-execute`'s reachable figure.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `ok:true` with
  `problems:[]`; `node --test cadence-core/bin/*.test.mjs` passes;
  `node cadence-core/bin/weight.mjs resident --root .` shows the `cad-executor`
  dispatch rows fallen from 13,050 / 13,063 by ~2,845 B and `zeroResident`
  still exactly three surfaces totalling 26,332;
  `grep -n 'worktree-executor' cadence-core/workflows/execute.md` returns the
  remedy line.

### Task 6: Move plan.md's BLOCKER-revision branch to cadence-core/references/plan-revision.md

- **Files:** cadence-core/references/plan-revision.md,
  cadence-core/workflows/plan.md, cadence-core/bin/weight-budgets.json,
  cadence-core/bin/lib/deferred-reads.mjs, cadence-core/bin/deferred-reads.test.mjs,
  cadence-core/bin/self-verify.test.mjs, cadence-core/bin/trace.test.mjs,
  docs/EVIDENCE.md, .planning/DOCS-CLAIMS.md
- **Action:** Move `cadence-core/workflows/plan.md:265-334` (4,315 B) - the
  `Any BLOCKER -> ONE revision, maximum:` arm with its sub-items 1, 2 and 3 -
  into a new `cadence-core/references/plan-revision.md`, carrying both
  re-dispatches whole: the fresh revision-mode planner spawn with `--attempt 2`
  and its own bracket, the narrowed checker re-dispatch with its narrower
  read-set and the measured ten-minutes-for-two-blockers argument, what a narrow
  pass gives up, the both-close-at-their-own-step rule, and the final
  no-BLOCKER-left / still-a-BLOCKER ask. All six `trace append` lines move with
  it verbatim (`:276`, `:284`, `:291` for the planner; `:298`, `:319`, `:325` for
  the checker). `check_gate` keeps `Handle the return:`, the
  `## VERIFICATION PASSED` arm, the WARNING-only arm, the empty-or-unmarked arm,
  and its own dispatch/return/checkpoint bracket at `:216-256`; the
  `Any BLOCKER` bullet becomes one `Read` sentence naming
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/plan-revision.md` with its
  measured bytes and `one consult site - this step`. The anchor is the whole-step
  label `check_gate`, never `check_gate(1)` (D-08: the `1.`/`2.`/`3.` are
  indented four spaces and take no item label), so the row is
  `{skill: 'cad-plan', reference: 'references/plan-revision.md',
  anchors: ['check_gate'], read_paragraphs: 1,
  file: 'cadence-core/workflows/plan.md'}`, tenth; update `REGISTER_SOURCE` and
  both length assertions to 10; add the AC4 falsifier. Do not touch
  `spawn_planner` or `inline_plan` - `plan.md`'s two recall gate sites stay eager
  (D-04). D-15: in `cadence-core/bin/trace.test.mjs`'s `BRACKETING` map change
  `cadence-core/workflows/plan.md` from 4 to 2 and add
  `cadence-core/references/plan-revision.md` -> 2, leaving
  `cadence-core/workflows/execute.md` at 1; the map drives per-file closure and a
  file absent from it is unchecked, while leaving `plan.md` at 4 fails the
  `>= minDispatch` assertion outright. Retarget the ONE
  `.planning/DOCS-CLAIMS.md` row whose claim text moved - PLAN-26 (`--attempt 2`
  climbs the routing seam to the retry rung), whose `:269-271,309` sit inside the
  moved span - to `cadence-core/references/plan-revision.md` with the claim's new
  lines. PLAN-25 (`WARNING means quality is degraded but execution can proceed`)
  does NOT move and its row is left exactly as it stands:
  `.planning/DOCS-CLAIMS.md:572` pins it at `plan.md:260-261`, the WARNING-only
  arm, which sits ABOVE the moved span's first line `:265`
  (`- Any BLOCKER -> ONE revision, maximum:`), so neither its `doc` cell nor its
  `line` cell changes. D-18's row list names PLAN-25 beside PLAN-26 and therefore
  over-counts by one; that is settled here as a correction to the decision, not
  left to the executor as a runtime deviation. Add the budget row,
  re-pin `plan.md`'s, and regenerate the affected `docs/EVIDENCE.md` tables
  (`references/` 19 -> 20, total 97 -> 98, `/cad-plan` turn-one and reachable,
  and the twelve-largest table, where `plan.md` falls from third to below
  `review-triggers.md`).
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `ok:true` with
  `problems:[]`; `node --test cadence-core/bin/*.test.mjs` passes;
  `grep -c 'trace append' cadence-core/workflows/plan.md` returns 6 (three
  bracket lines each for `spawn_planner` and `check_gate`) and the same grep on
  `cadence-core/references/plan-revision.md` returns 6;
  `node --test cadence-core/bin/trace.test.mjs` passes with the new map.

### Task 7: Move config.md's knob catalog and Type-key legend to cadence-core/references/config-catalog.md

- **Files:** cadence-core/references/config-catalog.md,
  cadence-core/workflows/config.md, cadence-core/bin/weight-budgets.json,
  cadence-core/bin/lib/deferred-reads.mjs, cadence-core/bin/deferred-reads.test.mjs,
  cadence-core/bin/self-verify.test.mjs, docs/EVIDENCE.md,
  .planning/DOCS-CLAIMS.md
- **Action:** Sequenced LAST (D-14). Move `cadence-core/workflows/config.md:71-133`
  (8,052 B) - the Type-key legend, the whole knob table, and the closing
  `<t> ∈ {plan, diff, risk_surface, phase_diff, pre_ship}` paragraph, which the
  table's last three rows are unreadable without - into a new
  `cadence-core/references/config-catalog.md`. Move it, never trim it (AC6): the
  `risk.override.<surface>` row and the three `review.triggers.<t>.*` rows are
  the only prose naming those keys, so dropping any of them orphans a config key.
  `config.md` keeps `### Catalog` and its paragraph at `:61-70` with all three
  rules intact - source of truth is `cadence-core/config.schema.json`, never
  hand-validate against the catalog and call the seam instead, and the catalog is
  deliberately transcribed rather than derived from `config.mjs keys` because the
  schema carries no per-value explanation - rewording "this table" to name
  `references/config-catalog.md` in the BARE citation form. The
  `${CLAUDE_PLUGIN_ROOT}` form must appear exactly once in `config.md`, inside
  walk step 2, because `deferred-reads.test.mjs:192-205` fails on any line naming
  it outside the anchored region. That single `Read` sentence goes at the end of
  `Interactive menu (no args)/The walk/2` - after the four bullets, before
  `3. A page whose knobs...` - with the reference's measured bytes and
  `one consult site - this step`; the anchor is the VERBATIM heading path
  `Interactive menu (no args)/The walk/2`, parenthetical included (D-07), since
  `regionLabels` takes heading text verbatim and the shorthand
  `Interactive menu/The walk/2` resolves to no region and files
  `deferred-read-unread` from the commit that adds it. While editing step 2,
  reword `Walk the catalog below **in order, 4 knobs per` to drop `below` (the
  catalog is no longer below) and reword `every knob the catalog below carries`
  at `:27` the same way; both are fixture needles, so update
  `deferred-reads.test.mjs`'s `WALK_STEP_2` constant in the same commit or
  `configRoot('step1')` silently becomes a no-op and its `Interactive menu (no
  args)/The walk/1` assertion fails on an unedited file. Leave `WALK_STEP_3` and
  `DIRECT_SET` needles intact. Add the register row eleventh:
  `{skill: 'cad-config', reference: 'references/config-catalog.md',
  anchors: ['Interactive menu (no args)/The walk/2'], read_paragraphs: 1,
  file: 'cadence-core/workflows/config.md'}`; update `REGISTER_SOURCE` and both
  length assertions to 11; add the AC4 falsifier. Retarget the ~29
  `.planning/DOCS-CLAIMS.md` rows whose claims now describe the new file (D-18):
  CONFIG-02 and CONFIG-09 through CONFIG-36, setting each `doc` cell to
  `cadence-core/references/config-catalog.md` and each `line` cell to the claim's
  lines there, and leaving CONFIG-01, CONFIG-03..08 and CONFIG-37..39 pointed at
  `config.md`; add one sentence to the ledger's "`line` column is run 1's
  location" paragraph recording that phase 3 re-pointed rows to files that did
  not exist at run 1, so the doc+text join rule still reads. Add the budget row,
  re-pin `config.md`'s, and regenerate `docs/EVIDENCE.md`: `/cad-config` turn-one
  and reachable, `references/` 20 -> 21, total 98 -> 99 and the "93 budgeted
  surfaces" prose sentence, and the twelve-largest table, which changes
  MEMBERSHIP as well as order - `config.md` falls to ~11,400 and leaves it,
  `cadence-core/workflows/audit.md` (12,912) enters, and the whole table must be
  rebuilt from the sorted `weight.mjs --root .` output rather than edited in
  place, because `prose-agreement.test.mjs:231-237` asserts twelve parsed rows
  and then `deepEqual` over the ordered names.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `ok:true` with
  `problems:[]`; `node --test cadence-core/bin/*.test.mjs` passes;
  `node cadence-core/bin/weight.mjs resident --root .` shows `/cad-config` eager
  at or below 12,800 B; `grep -c '^| \*\*Core\*\*' cadence-core/workflows/config.md`
  returns 0 and `grep -c 'Type key:' cadence-core/workflows/config.md` returns 0,
  while both return 1 in `cadence-core/references/config-catalog.md`;
  `grep -n 'never hand-validate' cadence-core/workflows/config.md` returns the
  surviving rule; `grep -c 'risk.override' cadence-core/references/config-catalog.md`
  and `grep -c 'review.triggers' cadence-core/references/config-catalog.md` are
  both non-zero.

## Notes

**Plan shape deviation, recorded per the contract.** CONTEXT's `Plan shape` says
"multiple plans, same phase - /cad-plan breaks it down", one per move commit.
This is ONE plan. Every one of the six moves writes
`cadence-core/bin/weight-budgets.json`, `cadence-core/bin/lib/deferred-reads.mjs`,
`cadence-core/bin/deferred-reads.test.mjs`, `cadence-core/bin/self-verify.test.mjs`
and `docs/EVIDENCE.md`, and four of them write
`.planning/DOCS-CLAIMS.md`; `planning.mjs plan-overlap` refuses two plans
declaring the same path, and D-13's green-at-every-commit requirement makes the
shared files a strict ordering constraint rather than an incidental collision
(each commit's `docs/EVIDENCE.md` figures depend on every prior commit's cut).
The six moves survive as the six commits D-13 asks for - tasks 2 through 7 - so
the commit shape is honored exactly; only the file split is not.

**Task size.** Tasks 2-7 each touch 7-9 files, above the usual ~5-file
guideline. That is D-13's commit shape, not a merged concern: `self-verify.mjs`
files `unbudgeted-surface` on a new measured surface with no budget row and
`budget-undershoot` on a shrink, and `prose-agreement.test.mjs` asserts every
`docs/EVIDENCE.md` figure against a live measurement, so a commit that moves
prose without its budget row, its EVIDENCE re-pin and its register row is red by
construction. Splitting any move further produces a non-committable state, which
AC1 forbids.

**The `Read` sentence figure is measured, not estimated.** In each move task:
write the new file first, run `node cadence-core/bin/weight.mjs --root .`, take
that surface's bytes, and only then write the `Read` sentence and the
`weight-budgets.json` row from the same number. Task 1's generalized scan fails
the build if the two disagree.

**Flagged assumption to watch while executing (CAPTURE.md, phase-1 diff
review).** `lib/deferred-reads.mjs:250-256` clears `item`/`arm` when a NESTED
tag closes rather than restoring the enclosing frame's, so a `Read` sentence
placed after an editorial nested block inside a numbered process item labels
`null` and files a false `deferred-read-unread`. None of the seven anchors above
sits after a nested block today. If a `Read` sentence lands clean by inspection
and self-verify still reports `deferred-read-unread` for it, that is this bug and
not the sentence - report it as a deviation rather than moving the sentence
somewhere the rule accepts by accident.

**AC7 is a verify-gate item, not an execution task.** The UAT checklist is
written by `/cad-verify`, and the five commands needing their own walk item are
`/cad-config` (the catalog is read at walk step 2), `/cad-plan` (the revision
branch is read only on a BLOCKER), `/cad-execute` (the parallel body is read only
on the opt-in path, and the executor contract reads its worktree rules only in
worktree mode), `/cad-context` (the template at `write_context`, recall at
`analyze`) and `/cad-debug` (recall at Hypothesize). Each needs numbered steps -
cd, the exact command, the exact expected observation - not a prose paragraph.
