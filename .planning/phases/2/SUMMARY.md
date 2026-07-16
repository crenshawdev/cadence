---
phase: 2
status: complete
completed: 2026-07-16
---

# Phase 2: Recall consumers - Summary

Wired the shipped Phase 1 BM25 recall engine into the three consumer surfaces (cad-context, cad-plan, cad-debug) so recall fires automatically at each judgment moment, gated on `memory.backend` and citing the recalled `source` file + optional `phase`.

## What shipped

- Gated recall in the /cad-context assumptions pass - `cadence-core/workflows/context.md` reads `memory.backend`, runs `planning.mjs recall` on `builtin`, and injects a `<recalled_memory>` block after `<search_terms>` in the cad-assumptions-analyzer payload; stable consume-and-cite clause added to `agents/cad-assumptions-analyzer.md` `<input>`.
- Gated recall in the /cad-plan planning context - `cadence-core/workflows/plan.md` adds `memory.backend` to the existing `config.mjs get` batch in `parse` and appends a gated `<recalled_memory>` block to the end of `<planning_context>` in `spawn_planner`, with the `inline_plan` path covered too; stable prior-art clause added to `agents/cad-planner.md` `<methodology>`.
- Gated inline recall at the /cad-debug Hypothesize step - `cadence-core/workflows/debug.md` extends the Consult config read to `config.mjs get memory.backend review.consult.attempt_threshold`, read on every route into the method loop (new symptom and `continue <slug>` resume), and runs gated inline recall at Hypothesize folding matched deviations/UAT findings into the candidate set.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 09705da | Gate and inject recall into the /cad-context assumptions pass |
| 1 | 2 | 0b3b734 | Gate and inject recall into the /cad-plan planning context |
| 1 | 3 | ce95d3f | Gate and run recall inline at the /cad-debug Hypothesize step |

## Deviations

None - plans executed as written. Every Verify gate matched its prediction: `self-verify.mjs` stayed exit 0 with an empty `problems` array and no CONTRACTS/TWO_WORD edit, all grep counts met their thresholds, and `node --test cadence-core/bin/*.test.mjs` passed (142 tests).

## Open items

- (phase 2) debug.md recall-gate cross-references are inverted: the Hypothesize gate at `cadence-core/workflows/debug.md:59` says `memory.backend` was "(read above)", but the read is documented *below* it in the Consult section (`debug.md:103`); the Consult note at `debug.md:107` conversely calls the Hypothesize gate "(below)" when it is above. The operative instruction (read on every method-loop entry, including the `continue <slug>` resume route) is present and correct, so the design holds, but the inverted pointers are a confusion hazard for a model executing the prose top-to-bottom on resume - the exact route Task 3 set out to cover. Surfaced by the advisory `diff` review trigger (medium). Cheapest fix: move the `config.mjs get memory.backend ...` read to method-loop entry (before Hypothesize) and correct the two directional pointers. Verify with the /cad-debug `continue <slug>` human-verify case below.

## Human-verify (carried to UAT)

These three behavioral acceptance criteria need a live slash-command run with a model on a repo with populated SUMMARYs and cannot be observed in the executor environment:

- With `memory.backend: builtin`, /cad-context on a phase whose goal shares a term with a prior SUMMARY deviation writes a CONTEXT.md citing that deviation's source file + phase in an evidence/flagged line; with `none`, no recall call fires and no recalled citation appears.
- With `builtin`, the cad-planner dispatch prompt carries a `<recalled_memory>` block citing source file + phase and a `planning.mjs recall` Bash call is visible; with `none`, neither appears.
- With `builtin`, /cad-debug surfaces a matching past deviation/UAT finding in the Hypotheses list cited by source file (and phase); with `none`, no recall Bash call fires. This case also exercises the resume-route gate named in the open item above.

## Goal check

The three commits plausibly deliver the phase goal - recall now fires without being asked at each of the three judgment moments, gated on `memory.backend`. Each surface reads the effective backend and omits the `planning.mjs recall` call entirely on `none` (context.md:26-35, plan.md parse+spawn_planner, debug.md:58-66), with the D-03 rationale stated inline that the backend-off return is a backstop, not the gate; the volatile snippets ride the dispatch prompts while the stable cite instruction lives in the cached agent files per cache discipline (D-01), evidenced by the `<recalled_memory>` clause landing in `agents/cad-assumptions-analyzer.md` and `agents/cad-planner.md`. All machine-checkable guarantees are green: `self-verify.mjs` exits 0 with an empty `problems` array and no CONTRACTS/TWO_WORD change, and `node --test` reports 142 passing. What is NOT yet proven: the three behavioral criteria are human-verify (they need live runs), and the advisory diff review surfaced one real prose defect in debug.md - inverted "(read above)"/"(below)" cross-references at debug.md:59 and debug.md:107 - which could weaken the recall gate on the `continue <slug>` resume route that Task 3 targeted. The design intent is correct (debug.md:104-107 explicitly ties the read to every method-loop entry and names the resume route), so this is a confusion hazard, not a broken instruction, but it is carried as an open item and should be resolved before /cad-verify's live debug run.
