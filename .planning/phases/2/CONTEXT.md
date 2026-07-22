# Phase 2: Planner separation-of-concerns heuristic - Context

Gathered: 2026-07-22
Feeds: /cad-plan 2

## Scope boundary

In: Add a standing separation-of-concerns heuristic as prose in
`agents/cad-planner.md` - a nudge (not a hard rule) that prefers small
single-purpose tasks over a shared core and splits responsibilities differing
on trigger / size / lifecycle / failure-resume / freshness / ownership, applied
to every plan with no per-phase restatement and never forcing a split that does
not earn itself. Rebudget the `agents/cad-planner.md` entry in
`cadence-core/bin/weight-budgets.json` to admit the new prose. Serves SOC-01
(#32).

Out: No changes to the plan-checkers (`cad-plan-checker.md`, `-high.md`) - the
heuristic stays a planner nudge, not a checker gate; no per-phase injection into
the cad-plan workflow dispatch payload or CONTEXT/PLAN templates; no new config
keys, subcommands, seams, or scripts; no change to the existing `<plan_output>`
PLAN-file split guidance (parallel PLAN-1/PLAN-2 slices).

Deferred: None.

Plan shape: one plan (right-sized).

## Decisions

- D-01 (Home & standing shape): The heuristic lives as standing prose inside
  `agents/cad-planner.md`, carried on the cached agent definition - not injected
  per-phase by the cad-plan workflow and not written into any CONTEXT/PLAN.
  Evidence: `cadence-core/workflows/plan.md:84-88`, `:120-121` (cache discipline
  D-01: stable instruction lives in the cached file, never restated in the
  dispatch tail); `.planning/REQUIREMENTS.md` SOC-01 ("applies to every plan
  with no per-phase restatement").
- D-02 (Budget must move in-phase): `agents/cad-planner.md` sits at exactly its
  context-weight budget (7714 B file == 7714 B budget, zero headroom), so this
  phase must move the CWT-02 budget for cad-planner in the same change or
  self-verify blocks CI. Evidence: `cadence-core/bin/weight-budgets.json:8`;
  `wc -c agents/cad-planner.md` = 7714 (verified this session);
  `cadence-core/bin/self-verify.mjs:246-259` (budget-overrun check).
- D-03 (Rebudget, not trim): Make room by raising the `agents/cad-planner.md`
  entry in `weight-budgets.json` (rebudget) rather than compressing existing
  planner prose to stay at 7714 B. Evidence: `weight-budgets.json:2` `_comment`
  ("Regenerate when intentional surface growth is accepted"); prior
  rebudget-in-same-phase commits `24b58c6`, `e42d09c`.
- D-04 (Scope - checkers untouched): Confine the change to
  `agents/cad-planner.md`; do not add a granularity/split rule to
  `agents/cad-plan-checker.md` or `-high.md`, keeping the heuristic a nudge
  rather than a gate. Evidence: `agents/cad-plan-checker.md:34-54` (five
  dimensions, none checks task single-purpose/granularity); SOC-01 ("a nudge,
  not a hard rule ... never forces a split that does not earn itself").
- D-05 (Binding - task/artifact level): The heuristic governs task/artifact-level
  decomposition (small single-purpose tasks over a shared core), distinct from
  the existing `<plan_output>` PLAN-file "split" guidance (parallel PLAN-1/PLAN-2
  slices). Evidence: `agents/cad-planner.md:96-98` (`<task_anatomy>`: "Atomic
  means: one concern, independently verifiable"); `:108-125` (`<plan_output>`
  split = independent PLAN files for parallel execution).

## Acceptance criteria

- [ ] `agents/cad-planner.md` contains a separation-of-concerns heuristic block
      that names all six split axes - trigger, size, lifecycle, failure-resume,
      freshness, ownership - and frames splitting as a nudge, explicitly stating
      it never forces a split that does not earn itself.
- [ ] The heuristic prose appears only in `agents/cad-planner.md`: a grep for
      its distinctive phrasing finds nothing in `cadence-core/workflows/plan.md`'s
      dispatch payload nor in any CONTEXT/PLAN template, so it applies to every
      plan with no per-phase restatement.
- [ ] Neither `agents/cad-plan-checker.md` nor `agents/cad-plan-checker-high.md`
      gains a rule that flags or blocks a plan for insufficient task splitting
      (the heuristic stays a planner nudge, not a checker gate).
- [ ] `node cadence-core/bin/self-verify.mjs` exits 0 with the change in place -
      the `agents/cad-planner.md` entry in `weight-budgets.json` equals the new
      file byte size (rebudgeted, no `budget-overrun`) and no CONTRACTS/tools
      drift is reported - and `node --test cadence-core/bin/` plus
      `node_modules/.bin/tsc --checkJs` stay green.
- [ ] A live `/cad-plan` run on a phase whose goal bundles responsibilities
      differing on at least one of the six axes produces a PLAN.md that separates
      them into distinct single-purpose tasks, while a genuinely single-concern
      phase is not force-split. (human-verify: needs a live /cad-plan run +
      judgment on whether the split earned itself)

## Flagged assumptions

None - all assumptions confirmed. The analyzer surfaced no Unclear items and no
research topics; every decision above is user-confirmed with codebase evidence.
