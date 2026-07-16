---
phase: 2
plan: 1
requirements: [RCL-04]
files:
  - cadence-core/workflows/context.md
  - cadence-core/workflows/plan.md
  - cadence-core/workflows/debug.md
  - agents/cad-assumptions-analyzer.md
  - agents/cad-planner.md
---

# Phase 2: Recall consumers - Plan

## Goal

Recall happens without being asked: the three judgment moments - assumptions in
/cad-context, task breakdown in /cad-plan, hypotheses in /cad-debug - each start
from what the project already learned, gated on `memory.backend` and citing the
recalled source (file + phase).

## Must be true when done

- With `memory.backend: builtin`, /cad-context reads the effective backend and
  runs `planning.mjs recall` for the phase goal before dispatching
  cad-assumptions-analyzer, and the CONTEXT.md it writes cites at least one
  recalled deviation by source file and phase in an evidence or flagged line.
- With `builtin`, the cad-planner dispatch prompt that /cad-plan assembles
  carries a `<recalled_memory>` block of cited snippets (source file + phase) for
  the phase goal, and the recall Bash call is visible in the run.
- With `builtin`, /cad-debug runs `planning.mjs recall` inline at its Hypothesize
  step and folds matching past deviations/UAT findings into the candidate
  hypotheses, each cited by source file (and phase when present).
- With `memory.backend: none`, none of the three surfaces issues a
  `planning.mjs recall` call and no recall block or recalled citation appears in
  their output - the gate omits the call, it does not rely on recall's own
  backend-off return.
- `node cadence-core/bin/self-verify.mjs` exits 0 with every new recall and
  config invocation matching the CONTRACTS table (no CONTRACTS edit), and
  `node --test cadence-core/bin/*.test.mjs` passes unchanged.

## Context

Locked decisions (phases/2/CONTEXT.md): D-01 the parent workflow runs recall and
injects cited snippets into the subagent dispatch prompt (context -> analyzer
payload, plan -> cad-planner `<planning_context>`); volatile per-phase recall
data rides the dispatch prompt, never the cached agent definitions. D-02
cad-debug runs recall inline via Bash at Hypothesize - there is no debug
subagent. D-03 each surface reads effective `memory.backend` first and runs
recall only when `builtin`; on `none` the call is omitted entirely (recall's own
backend-off return is a backstop, not the gate). D-04 each recalled item is
carried into the artifact cited by its `source` file and `phase` fields from
recall's JSON. D-05 the new mentions stay drift-green with no CONTRACTS change.

Recall's contract (Phase 1, shipped): `planning.mjs recall "<query>"` prints one
JSON line `{ok:true, results:[{score, source, phase?, snippet}]}`; positional
query, optional `--dir`, no other flags. `config.mjs get memory.backend` reads
the effective value (schema default `builtin`, enum `["none","builtin"]`).

Cache discipline (references/seams.md, cited by D-01): the volatile snippets go
in the dispatch prompt; the stable "consume and cite recalled memory"
instruction goes in the cached agent definition, not the prompt. cad-debug has
no agent definition, so its instruction lives in the workflow prose.

Out of scope: any change to recall's output contract or corpus (Phase 1), the
CONTRACTS table or TWO_WORD set in self-verify.mjs (D-05 keeps them unchanged),
context-weight work (Phase 3), external backends (v2).

Drift-safety rule for every recall/config line added below: write
`planning.mjs recall "<query>"` with the query quoted and no flag other than an
optional `--dir`, one recall invocation per prose line, nothing that reads as
`--flag` trailing it on the same line; write the gate read as
`config.mjs get memory.backend`. These shapes pass self-verify with no CONTRACTS
change.

## Tasks

### Task 1: Gate and inject recall into the /cad-context assumptions pass

- **Files:** cadence-core/workflows/context.md, agents/cad-assumptions-analyzer.md
- **Action:** In context.md's `analyze` step, before the cad-assumptions-analyzer
  dispatch, add a recall substep: read the effective backend with
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get memory.backend`;
  when it is `builtin` (the default - skip this substep entirely when `none`),
  run `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" recall "<key terms from the phase goal>"`
  and inject a `<recalled_memory>` block into the analyzer dispatch payload
  (place it in the payload after `<search_terms>`), rendering each top result as
  a line carrying its `snippet`, `source` file, and `phase` from recall's JSON
  (`phase` is optional - a phaseless CAPTURE.md item omits it; render it only
  when present, matching the omit-optionals convention).
  State WHY the gate precedes the call (D-03: recall's backend-off return is a
  backstop, not the gate) and WHY the snippets live in the dispatch prompt not
  the agent file (D-01 / cache discipline: they are volatile per-phase data). Do
  not add any flag to the recall call beyond an optional `--dir`. In
  cad-assumptions-analyzer.md, add one stable clause to the `<input>` section:
  the prompt MAY include a `<recalled_memory>` block of prior-project snippets,
  each tagged with a source file and phase; treat them as prior evidence to
  weigh, and when one informs an assumption cite that source file and phase in
  the assumption's Evidence line (or raise it as a flagged assumption). Do not
  restate the volatile data-handling rule in the workflow's dispatch prompt - the
  clause is the cached instruction.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 with an empty
  `problems` array. `grep -c 'planning.mjs" recall' cadence-core/workflows/context.md`
  is >= 1 and `grep -c 'memory.backend\|recalled_memory' cadence-core/workflows/context.md`
  is >= 2; `grep -c recalled_memory agents/cad-assumptions-analyzer.md` is >= 1.
  human-verify (needs a live /cad-context run): on a repo with populated
  SUMMARYs and `memory.backend: builtin`, run /cad-context on a phase whose goal
  shares a term with a prior SUMMARY deviation and confirm the written CONTEXT.md
  cites that deviation's source file and phase in an evidence or flagged line;
  then set `memory.backend: none`, re-run, and confirm no recall call fires and
  no recalled citation appears.

### Task 2: Gate and inject recall into the /cad-plan planning context

- **Files:** cadence-core/workflows/plan.md, agents/cad-planner.md
- **Action:** In plan.md's `parse` step, add `memory.backend` to the existing
  `config.mjs get` batch (the multi-key call reading workflow.plan_check et al.)
  so the effective backend is read through the touchpoint already there. In the
  `spawn_planner` step, after routing and while assembling the cad-planner
  prompt, add: when the effective `memory.backend` is `builtin` (skip entirely
  when `none`), run
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" recall "<key terms from the phase goal>"`
  and append a `<recalled_memory>` block at the end of the `<planning_context>`
  prompt (the volatile region), each top result rendered with its `snippet`,
  `source` file, and `phase` when present (optional field - phaseless CAPTURE
  items omit it). State the D-03 gate rationale and the D-01
  volatile-in-prompt rationale. Keep the recall call to a positional query plus
  an optional `--dir`, no other flag. In cad-planner.md, add one stable clause
  (in `<methodology>` or a short input note) that the `<planning_context>` MAY
  carry a `<recalled_memory>` block of cited prior-project snippets (source file
  + phase); treat them as prior art when deriving truths and tasks, and when one
  informs a task or decision cite that source file and phase in the task's Action
  or the plan's Notes. Also cover the `inline_plan` step (the `--inline`
  under-threshold path is a real task-breakdown moment with no cad-planner
  dispatch): instruct that the same gated recall results - already fetched in
  `parse`/route when the backend is `builtin` - are folded into the inline plan's
  truths and tasks with the same source-file + phase citations; on `none` the
  inline path, like spawn_planner, issues no recall call.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 with an empty
  `problems` array. `grep -c 'memory.backend' cadence-core/workflows/plan.md` is
  >= 1, `grep -c 'planning.mjs" recall\|planning.mjs recall' cadence-core/workflows/plan.md`
  is >= 1, `grep -c recalled_memory cadence-core/workflows/plan.md` is >= 1, and
  `grep -c recalled_memory agents/cad-planner.md` is >= 1. human-verify (needs a
  live /cad-plan run): with `memory.backend: builtin`, run /cad-plan on a phase
  whose goal shares a term with a prior deviation and confirm a
  `planning.mjs recall` Bash call is visible in the transcript and the planner's
  dispatch prompt carries a `<recalled_memory>` block citing source file + phase;
  with `memory.backend: none`, confirm no recall Bash call fires and no block
  appears.

### Task 3: Gate and run recall inline at the /cad-debug Hypothesize step

- **Files:** cadence-core/workflows/debug.md
- **Action:** In debug.md, read the effective backend once per invocation by
  extending the existing config read named in the Consult section to
  `config.mjs get memory.backend review.consult.attempt_threshold`, and state
  explicitly that this read happens on EVERY route into the method loop - a new
  symptom AND `continue <slug>` (the resume route enters the method loop
  directly, bypassing the New session steps, so a read anchored only to new
  sessions would leave the Hypothesize gate unread on resume). In the
  Hypothesize step of "The method loop", add: when the effective
  `memory.backend` is `builtin` (skip entirely when `none`), run
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" recall "<key terms from the symptom / bug description>"`
  inline via Bash (D-02: no debug subagent, the main model runs it inline) and
  fold any matching past deviations or UAT findings into the candidate
  hypotheses, each noted in the Hypotheses list with its `source` file and
  `phase` (when present) from recall's JSON. State that recall runs at
  Hypothesize because that is the judgment moment, and the D-03 gate rationale.
  Keep the recall call to a positional query plus an optional `--dir`, no other
  flag, on its own line.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 with an empty
  `problems` array, and `node --test cadence-core/bin/*.test.mjs` passes.
  `grep -c 'memory.backend' cadence-core/workflows/debug.md` is >= 1 and
  `grep -c 'planning.mjs" recall\|planning.mjs recall' cadence-core/workflows/debug.md`
  is >= 1. human-verify (needs a live /cad-debug run): with
  `memory.backend: builtin`, run /cad-debug on a bug description that shares a
  term with a prior SUMMARY deviation or UAT finding and confirm the Hypotheses
  list surfaces that item cited by source file (and phase); with
  `memory.backend: none`, confirm no recall Bash call fires.

## Notes

The three behavioral acceptance criteria (recalled citation in CONTEXT.md, the
recall block in the cad-planner dispatch prompt, the recalled item at the debug
Hypothesize step) can only be observed by running the live slash commands with a
model, so each is carried as a human-verify in its task. The machine-checkable
guarantees - self-verify staying green with no CONTRACTS change, and the test
suite passing - are falsifiable in the executor's environment and gate every
task.
