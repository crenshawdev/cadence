# Roadmap: Cadence v1.1.0

## Overview

Three vertical slices from write-only memory to a closed loop, plus measured
context weight. Phase 1 builds the recall engine as a standalone, fully
testable seam — after it, a human can query project memory from the CLI even
though no skill uses it yet. Phase 2 wires the three consumers (context,
planner, debug) so recall happens without being asked, which is the core
value. Phase 3 is independent of recall and lands the context-weight seam and
the two new blocking self-verify checks. Recall ships before measurement
because it is the headline; measurement closes the cycle by putting Cadence's
own prose surfaces — now slightly heavier — under a CI budget.

## Phases

- [x] **Phase 1: Recall engine** - BM25 over `.planning/` as a `planning.mjs recall` subcommand, backend-gated, contracted, tested
- [ ] **Phase 2: Recall consumers** - cad-context, cad-planner, cad-debug inject recall results with cited sources
- [ ] **Phase 3: Context weight** - prose-surface weight seam, blocking CI budget check, tools-declaration lint

## Phase Details

### Phase 1: Recall engine
**Goal:** Project memory is queryable: a zero-dep, deterministic BM25 recall subcommand over `.planning/` artifacts, honoring `memory.backend`, drift-linted and tested like every other seam
**Depends on:** Nothing (first phase)
**Requirements:** RCL-01, RCL-02, RCL-03, RCL-05
**Success Criteria:**
1. On a project with populated SUMMARYs/CAPTURE, `node planning.mjs recall "<term from a deviation>"` returns that deviation's snippet ranked first, as one-line JSON with source file and phase
2. Running the same recall query twice on the same corpus returns byte-identical output
3. On a project with an empty or absent `.planning/` corpus, recall exits 0 with `{ok: true, results: []}`
4. With `memory.backend` set to `none`, recall reports the backend is off in its JSON rather than returning results
5. `node --test` passes with new recall tests covering ranking, empty corpus, and determinism; self-verify passes with the recall CONTRACTS entry present

### Phase 2: Recall consumers
**Goal:** Recall happens without being asked: the three judgment moments (assumptions, task breakdown, hypotheses) start from what the project already learned
**Depends on:** Phase 1
**Requirements:** RCL-04
**Success Criteria:**
1. Running /cad-context on a phase whose goal shares terms with a past SUMMARY deviation produces a CONTEXT.md that cites that deviation with its source (file + phase)
2. cad-planner's prompt assembly includes recall results for the phase goal when `memory.backend` is `builtin`, and omits the recall step entirely when it is `none`
3. cad-debug's hypothesis step surfaces recalled past deviations/UAT findings matching the bug description, cited by source
4. self-verify passes: every recall invocation in skill/workflow prose matches the CONTRACTS table

### Phase 3: Context weight
**Goal:** Cadence's context claims are measured and enforced: prose-surface weight is a deterministic seam output, and CI blocks both budget overruns and undeclared-tool references
**Depends on:** Nothing (independent of recall)
**Requirements:** CWT-01, CWT-02, CWT-03
**Success Criteria:**
1. The weight subcommand emits one-line JSON listing every agent/skill/workflow prose surface with byte and estimated-token counts, and two runs on the same tree are byte-identical
2. Adding prose that pushes a surface past its declared budget makes self-verify exit 1 naming the surface and the overage
3. Adding a tool name to an agent's prose that is absent from its frontmatter `tools:` list makes self-verify exit 1 naming the agent and the tool
4. `node --test` and the full self-verify suite pass on the unmodified tree (current surfaces fit their initial budgets)
