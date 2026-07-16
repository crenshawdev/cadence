# Phase 2: Recall consumers - Context

Gathered: 2026-07-16
Feeds: /cad-plan 2

## Scope boundary

In: Wire the three recall consumers so recall happens without being asked. The parent workflow runs `planning.mjs recall` and injects cited results into cad-context's assumptions pass (via the cad-assumptions-analyzer dispatch prompt) and cad-plan's planning context (via the cad-planner dispatch prompt); cad-debug runs recall inline at its Hypothesize step. Each surface gates on effective `memory.backend`, running recall only when `builtin`. Serves RCL-04.
Out: The recall engine itself (Phase 1, shipped). Context-weight measurement and its self-verify checks (Phase 3). External backends (mem-*/MCP) - v2 (RCL-06). Any change to recall's output contract or corpus.
Deferred: None
Plan shape: one plan

## Decisions

- D-01 (injection): The parent workflow runs `planning.mjs recall` and injects the cited snippets into the subagent dispatch prompt - cad-context into the cad-assumptions-analyzer payload, cad-plan into the cad-planner `<planning_context>`. Volatile per-phase recall data stays out of the cached agent definitions. Evidence: cadence-core/workflows/context.md analyze step (79-87), cadence-core/workflows/plan.md spawn_planner (60-96), cadence-core/references/seams.md cache discipline.
- D-02 (injection): cad-debug runs recall inline via `Bash` at its Hypothesize step - there is no debug subagent to carry it; the main model runs the method inline. Evidence: cadence-core/workflows/debug.md (opening "main model runs the method inline"; Hypothesize step lists Read/Grep/Bash checks).
- D-03 (gating): Each surface reads effective `memory.backend` first (piggybacking the config/state Bash touchpoint each workflow already has) and runs recall only when `builtin`; on `none` the call is omitted entirely. Recall's own backend-off return is a backstop, not the gate. Evidence: plan.md config.mjs get batch (31-36), debug.md config read (86), context.md cursor calls (24, 255); planning.mjs self-gate (511-512).
- D-04 (citation): A recalled item is carried into the written artifact cited by its `source` file and `phase` fields from recall's JSON - CONTEXT.md assumption evidence / flagged lines, cad-planner prior-art, cad-debug hypothesis notes. Evidence: Phase 1 recall output contract (source + phase per snippet); ROADMAP criteria 1/3.
- D-05 (drift-lint): New `planning.mjs recall` mentions in the three prose surfaces stay green with no CONTRACTS change - positional query plus at most `--dir`, one recall invocation per prose line, `recall` stays out of TWO_WORD. Evidence: self-verify.mjs CONTRACTS ('*': ['--dir'] line 35, recall: [] line 49), invocation regex (160), TWO_WORD (75); Phase 1 D-04.

## Acceptance criteria

- [ ] With `memory.backend: builtin`, running /cad-context on a phase whose goal shares a term with a prior SUMMARY deviation produces a CONTEXT.md that cites that deviation's source file and phase number in an evidence or flagged-assumption line
- [ ] With `memory.backend: builtin`, the cad-planner dispatch prompt assembled by /cad-plan contains a recall block carrying cited snippets (source file + phase) for the phase goal
- [ ] With `memory.backend: builtin`, running /cad-debug on a bug description that shares a term with a prior SUMMARY deviation or UAT finding surfaces that item at the Hypothesize step, cited by source file (and phase when present)
- [ ] With `memory.backend: none`, none of the three surfaces issues a `planning.mjs recall` call and no recall block or recalled citation appears in their output
- [ ] `node cadence-core/bin/self-verify.mjs` exits 0 after the recall mentions are added to the three surfaces' prose, with every recall invocation matching the CONTRACTS table
- [ ] `node --test cadence-core/bin/*.test.mjs` passes

## Flagged assumptions

None - all assumptions confirmed
