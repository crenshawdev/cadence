---
phase: 3
plan: 1
requirements: [MIN-01, CTW-06]
files:
  - cadence-core/references/lean-build.md
  - skills/cad-executor-contract/SKILL.md
  - skills/cad-land/SKILL.md
  - cadence-core/bin/lib/deferred-reads.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/deferred-reads.test.mjs
  - cadence-core/bin/self-verify.test.mjs
---

# Phase 3: The lens and the loop back - Plan 1 (the executor's posture, and the two prose cuts)

## Goal

`cad-executor` ships the lean shape and records the fuller one instead of
building it speculatively, with that posture riding behind a `Read` at the step
that needs it, and the two surfaces this phase re-opens - the executor contract
and `cad-land` - each state their duplicated rule once and are re-pinned to
their new measured weight in the same commit.

## Must be true when done

- A new `cadence-core/references/lean-build.md` states the lean-first build
  posture, and `skills/cad-executor-contract/SKILL.md` reaches it by a `Read`
  at process step 1 rather than by an `@`-include or inline contract prose.
- `cadence-core/bin/lib/deferred-reads.mjs` carries a register row anchoring
  that Read, so deleting the sentence turns CI red instead of silently
  unreaching the file.
- The executor contract's deviation rules say a declined fuller option is an
  `Open items:` line in the report file, and its return digest is still exactly
  five fields.
- `skills/cad-land/SKILL.md`'s `<guardrails>` no longer re-derives the
  `git.auto_close` mechanic, while the no-preselected-default sentence and the
  not-scoped-to-GitHub clause both survive verbatim.
- The executor contract states the static-analysis carve-out once, with the
  step-3 copy replaced by a pointer at `<deviation_rules>`.
- `node cadence-core/bin/self-verify.mjs` reports an empty `problems` array
  after every task, and both edited skills' rows in
  `cadence-core/bin/weight-budgets.json` equal their measured byte counts.

## Context

- D-01 locks the placement: a NEW `cadence-core/references/*` file, Read at one
  named step, registered as a PROMOTION row in `DEFERRED_READS` - never an
  `@`-include (check 16 has no row watching it) and never inline prose (the
  contract sits at its budget row, so inline prose is a `budget-overrun`).
- D-02 locks the record shape: an `Open items:` line in
  `<plandir>/reports/plan-<k>.md`, not a `[deviation]` line, and no sixth
  digest field. D-03 locks the form: a boundary inside the existing rules,
  never a new taxonomy of change shapes.
- D-10 and D-11 lock the cuts: prose deleted and replaced by a pointer, both
  `weight-budgets.json` rows re-pinned in the SAME commit even though check 4
  is a ceiling, and the `cad-land` cut scoped to the `<guardrails>` block at
  SENTENCE granularity.
- Out: no widening of the deviation definition, no sixth return-digest field,
  no new change-shape taxonomy, no edit near `cad-land` steps 3, 4(a) or 4(b).

## Tasks

### Task 1: State the lean-first build posture in its own reference

- **Files:** cadence-core/references/lean-build.md, cadence-core/bin/weight-budgets.json
- **Action:** Create `cadence-core/references/lean-build.md` as the executor's
  lean-first build posture: where a task's `Verify:` can be met by a lean shape
  and by a fuller one, the executor builds the lean shape and records the fuller
  one. Name what "fuller" means concretely - configurability the task's
  `Verify:` does not ask for, an abstraction with one implementation today, a
  flag or key nothing sets, a generalized interface for a single caller - and
  state the counter-rail just as plainly: leanness never trades away anything the
  task's `Verify:`, the plan's `## Must be true when done`, or a locked CONTEXT
  decision states, so this is a choice between two shapes that both pass, never a
  licence to pass less. State HOW the declined option is written down: one
  `Open items:` line in the executor's report file naming the fuller shape and
  the reason the lean one met the `Verify:` - the contract owns the RULE that it
  is an open item (task 4), this file owns the wording, so neither restates the
  other. Write it as a boundary inside the executor's existing authority
  ("Your authority is the task's `Verify:`", `skills/cad-executor-contract/SKILL.md:81`),
  NEVER as a bucket list of change shapes: `cadence-core/bin/prose-agreement.test.mjs:219-226`
  asserts the executor surface never re-grows `**Trivial` and never re-carries
  "input validation, error handling", and a lean-versus-fuller taxonomy is that
  same defect in a new spelling (D-03). Add the file's exact measured byte count
  as a row in `cadence-core/bin/weight-budgets.json` in this same commit -
  `cadence-core/references/**` is a budgeted branch, so an unrowed new file is an
  `unbudgeted-surface`. Do not `@`-include the file anywhere and do not cite it
  from any skill yet; task 3 makes the one Read that reaches it.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`,
  and `node cadence-core/bin/weight.mjs` reports a byte count for
  `cadence-core/references/lean-build.md` equal to that surface's row in
  `cadence-core/bin/weight-budgets.json`. `grep -n 'Trivial' cadence-core/references/lean-build.md`
  returns nothing.

### Task 2: Cut the executor contract's duplicated static-analysis carve-out

- **Files:** skills/cad-executor-contract/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** `skills/cad-executor-contract/SKILL.md` states the static-analysis
  carve-out twice: process step 3 ends with "A failure gets the same three
  bounded fix attempts as any blocker, and surviving the third is a `blocked`
  checkpoint, never the move-on arm", and `<deviation_rules>`' Boundaries bullet
  states the same carve-out in full. Delete the step-3 restatement and leave a
  pointer at `<deviation_rules>` in its place, so the rule is stated once and the
  step still tells the model where it lives (CTW-06's "the step copy becomes a
  pointer"). Keep step 3's own content that lives nowhere else - the
  `detect-commands` invocation, the both-null answer, and the LSP-versus-subprocess
  preference. Do not touch `<deviation_rules>`' copy: it is the surviving
  statement, and the carve-out's own wording ("ONE carve-out ... because moving
  on there means committing the failure") is what makes the rule readable
  without the step beside it. Re-pin
  `skills/cad-executor-contract/SKILL.md` in `cadence-core/bin/weight-budgets.json`
  to the newly measured byte count in this same commit (D-10): check 4 is a
  ceiling and would stay green on the shrink, and the re-pin is the only thing
  that stops the bytes coming back.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`;
  `node --test cadence-core/bin/prose-agreement.test.mjs` passes with 0 failures;
  `grep -c 'three bounded fix attempts' skills/cad-executor-contract/SKILL.md`
  returns 1; and `node cadence-core/bin/weight.mjs` reports
  `skills/cad-executor-contract/SKILL.md` at exactly its
  `cadence-core/bin/weight-budgets.json` row.

### Task 3: Read the posture at process step 1, anchored by a register row

- **Files:** skills/cad-executor-contract/SKILL.md, cadence-core/bin/lib/deferred-reads.mjs, cadence-core/bin/weight-budgets.json
- **Action:** Add to `skills/cad-executor-contract/SKILL.md` process step 1
  ("Implement the task's change.") a sentence instructing the executor to Read
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/lean-build.md` and hold its
  posture for the dispatch, stating the consult-site count inline in the SAME
  sentence that names the path - "(one consult site - this step)", the shape
  `<worktree_mode>` already uses at `:155-157`. `cadence-core/references/seams.md:243-248`
  mandates that count at the Read and forbids restating the file's byte size, and
  `cadence-core/bin/prose-agreement.test.mjs`' coverage arm asserts a sentence
  naming the full path also carries the word `site`. The sentence MUST sit
  between the `1.` line and the `2.` line: `regionLabels` labels a numbered item
  of a `<process>` frame by its bare number, so a sentence outside those lines
  answers for a different region and leaves the anchor unsatisfied. Add the
  matching PROMOTION row to `DEFERRED_READS` in
  `cadence-core/bin/lib/deferred-reads.mjs` - `skill: 'cad-executor-contract'`,
  `reference: 'references/lean-build.md'`, one anchor, `read_paragraphs: 1`, no
  `file` key (it defaults to the SKILL.md) - beside the existing
  `worktree-executor.md` row, and do not disturb that row. The header's promotion
  doctrine at `:18-34` is the reason the row exists even though no include was
  ever removed: the `unread` arm is this deferral's entire protection. Re-pin
  `skills/cad-executor-contract/SKILL.md` in
  `cadence-core/bin/weight-budgets.json` to the newly measured count in this same
  commit - the surface grows here, and its row was re-pinned tight by task 2, so
  without this the commit is a `budget-overrun`.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"problems":[]` -
  in particular no `deferred-read-unread`, no `unbudgeted-surface` and no
  `budget-overrun` - and `node --test cadence-core/bin/prose-agreement.test.mjs`
  passes with 0 failures, which is what proves the anchor resolves to a real
  region carrying a path-naming, site-counting `Read` sentence.

### Task 4: Route a declined fuller option to `Open items:`, not to a deviation

- **Files:** skills/cad-executor-contract/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** In `skills/cad-executor-contract/SKILL.md`'s `<deviation_rules>`,
  state that a fuller shape the executor declined to build is an `Open items:`
  entry in the report file, not a `[deviation]` line. Attach it to the existing
  "Everything else you find while working is either part of the task or an open
  item" clause at `:98-101` so it reads as an instance of the rule already
  there. Change NOTHING else about the deviation definition: it stays "exactly
  ONE thing - an acceptance criterion or a locked decision turned out wrong or
  unachievable", because its narrowness is the signal `:95-96` names (D-02).
  `<report_file>` already carries the `Open items:` line at `:190`, so add no
  new report field there, and `<report>`'s digest stays at exactly five fields -
  `:211-213` states why a sixth is a value the orchestrator already has. Re-pin
  `skills/cad-executor-contract/SKILL.md` in
  `cadence-core/bin/weight-budgets.json` to the newly measured count in the same
  commit.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` passes with
  0 failures; `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`;
  the fenced digest block under `<report>` in
  `skills/cad-executor-contract/SKILL.md` still lists exactly five fields
  (`PLAN`, `Tasks:`, `Commits:`, `Deviations:`, `Open items:`); and
  `grep -n 'Open items' skills/cad-executor-contract/SKILL.md` shows the new
  rule inside `<deviation_rules>` as well as the existing report-file line.

### Task 5: Cut `cad-land`'s guardrails re-derivation of the `git.auto_close` mechanic

- **Files:** skills/cad-land/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** In `skills/cad-land/SKILL.md`'s `<guardrails>` block, delete the
  first bullet's re-derivation of the mechanic - the clause running from "it
  SKIPS the 4a ask rather than preselecting a default in it" through "and it
  still halts on a blocking `pre_ship` finding" (`:200-201`), which restates
  step 4(b) at `:104-109` and the triage rule at `:67-75` - and replace it with a
  pointer to steps 3 and 4(b), where the mechanic is stated at the code that
  runs it. The named keeps stand VERBATIM (D-11): the sentence "No preselected
  publish default, ever. No auto-push. No auto-commit." at `:198` and the "so
  this read is NOT scoped to the GitHub arm" clause at `:113-115`. Do not edit
  anywhere near `:104-117`: `cadence-core/bin/lib/deferred-reads.mjs:161-180`
  anchors regions `3`, `4(a)` and `4(b)`, `:88-104` records that the matching
  unit is the SENTENCE, and merging or splitting the 4(b) Read sentence drops
  `deferred-read-unread` on the unattended arm - the reproduced defect where
  `gh pr merge` is reached with `references/git-publish.md` never loaded. Re-pin
  `skills/cad-land/SKILL.md` in `cadence-core/bin/weight-budgets.json` to the
  newly measured byte count in the same commit (D-10).
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"problems":[]` with
  no `deferred-read-unread`; `grep -c 'No preselected publish default, ever'
  skills/cad-land/SKILL.md` returns 1 and `grep -c 'NOT scoped to the GitHub arm'
  skills/cad-land/SKILL.md` returns 1; `grep -c 'SKIPS the 4a ask'
  skills/cad-land/SKILL.md` returns 0; `node --test cadence-core/bin/prose-agreement.test.mjs`
  passes with 0 failures; and `node cadence-core/bin/weight.mjs` reports
  `skills/cad-land/SKILL.md` at exactly its budgets row.

## Notes

- This plan runs BEFORE plans 2-4 and shares `cadence-core/bin/weight-budgets.json`
  with all of them, so the phase's plans execute sequentially - the file lists
  overlap by design and `plan-overlap` will report it.
- The reference file's name (`lean-build.md`) was the planner's call under the
  CONTEXT flagged assumption; D-01 constrains only that it is a new
  `cadence-core/references/*` file behind a promotion row.
- The step-1 anchor was chosen over `<deviation_rules>` because step 1 is where
  the shape is actually chosen. It is an every-path read, which
  `cadence-core/references/seams.md:233-238` explicitly still admits: an eager
  include costs its bytes on every remaining turn, a deferred read costs one
  tool call inside a turn the executor was already taking.
- For the human, not built here: `.planning/ROADMAP.md`'s phase-3 criterion 1
  still says the fuller option is recorded "in its deviation record", the wording
  D-02 contradicts and `.planning/REQUIREMENTS.md`'s MIN-01 row was corrected
  away from. `/cad-verify 3` will read that criterion against an AC2 that forbids
  the shape it names.
