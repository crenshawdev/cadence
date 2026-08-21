# Phase 3: Ceremony the change pays for - Context

Gathered: 2026-08-20
Feeds: /cad-plan 3

## Scope boundary

In: `stakes` read as an explicit floor rather than the level every phase pays;
a plan-time detector over a phase's declared `files:` (path signals plus a
content pass scoped to the answered surfaces) that raises the resolved level; a
fail-closed arm for an unreadable plan; a lowering override keyed inside
`review.triggers.risk_surface`; a replay of this project's shipped phases
through both resolvers; the prose and claims-ledger rows that currently state
"detection sets no floor".

Out: the level vocabulary and the five grids in `route-table.json` - the
computed level still selects an existing row; the `retired-keys.mjs` rail,
which stays byte-identical; the commit-time `risk_surface` trigger and its
re-arm cap; `git-guard.mjs` (phase 2 D-11's census stands).

Deferred: None.

Plan shape: multiple plans, same phase - the detector + floor resolve
(AC1/AC2/AC5), the replay + override rail (AC3/AC4), and the prose +
measurement close (AC6/AC7).

## Durable decisions

- D-01 (Detector): the plan-time detector reads a phase's declared `files:`
  through `lib/risk-diff.mjs`'s PATH signals plus a content pass over the
  declared files' current bodies, scoped to the project's ANSWERED surfaces
  only, with the signal-table files themselves exempt from self-matching.
  Measured on all 48 PLAN files in this repo: path signals alone match 0/48
  (`destructive` and `untrusted_input` carry no path signal at all), a full
  eight-category body scan matches 39/48 including self-referential hits.
  Diff-based scanning was rejected because no diff exists at plan/resolve time.
  Evidence: `cadence-core/bin/lib/risk-diff.mjs:65-167`,
  `.planning/config.json` (answered set: secrets, destructive,
  untrusted_input).

- D-02 (Floor semantics): an EXPLICIT `stakes` key is the floor - a phase
  resolves at or above it, never below. UNSET `stakes` now means floor `solo`,
  and the computed raise does the work; today's unset-means-`shipped` default
  is what criterion 2's demonstration resolves below. Evidence:
  `cadence-core/bin/route.mjs:117` (`DEFAULTS.stakes = 'shipped'`),
  `.planning/config.json` (no `stakes` key set),
  `.planning/ROADMAP.md:205-211`.

- D-03 (Override key): the lowering override is a NEW key inside
  `review.triggers.risk_surface`, naming the surface it waives (STK-03's
  shape). The eight retired `risk.override.<surface>` keys stay retired:
  `retired-keys.mjs` is not edited, and criterion 4's "byte-identical" is that
  rail staying untouched, pinned by a test. Un-retirement was rejected because
  a key cannot live in the schema and the retired registry at once. Evidence:
  `cadence-core/bin/lib/retired-keys.mjs:66-122`, `cadence-core/config.schema.json`,
  `cadence-core/bin/self-verify.mjs:532,703`.

- D-04 (Fail closed): a PLAN the resolve cannot read yields `ok:true` at the
  CONFIGURED stakes (default `shipped` when unset), never below it and never
  `ok:false` - an `ok:false` drops the dispatch to the host session default,
  below every floor (`references/seams.md:190-191`). The unset->`solo`
  discount applies only when a plan was READ and showed no answered surface;
  an unreadable plan never earns it. Aggregation over a multi-plan scope
  (decision-review amendment): the discount requires EVERY `PLAN*.md` in the
  scope read successfully and clean - one unreadable member forces the
  configured stakes for the whole scope, so a mixed phase whose unreadable
  plan is the risky one can never resolve below today. Evidence:
  `cadence-core/references/seams.md:190-191`, `cadence-core/bin/route.mjs:254-261`.

- D-05 (Files source): the floor reads the frontmatter `files:` list alone,
  never `parsePlanFiles`'s union with task `- **Files:**` lines - task prose
  must not floor a phase. The union's over-approximation is safe for
  parallel-overlap checks and unsafe as a raise. Evidence: recovered
  `declaredPhaseFiles` doc comment at `8063832^:cadence-core/bin/lib/phase-plans.mjs`,
  `cadence-core/bin/lib/planning-files.mjs:2186-2252`.

- D-06 (Floor scope, amended by /cad-decision-review): the floor is per PLAN
  for executor dispatches and per PHASE for phase-scoped callers. Executors
  already resolve once per dispatch with the plan number on the command line
  (`execute.md`'s `--bracket-plan <k>` on each executor's own resolve), so the
  resolve reads THAT plan's `files:` and a clean plan in a mixed phase routes
  below its auth sibling. Phase-scoped roles (`cad-plan-checker`,
  `cad-verifier`, reviewer resolution) floor on the union of every `PLAN*.md`
  in `.planning/phases/<N>/`, subject to D-04's aggregation rule. The original
  per-phase-only form rested on two contradicted premises: `seams.md:233-239`'s
  resolve-once rule does not describe the executor caller, and a plan key
  already exists at `arg-contract.mjs:930`. Evidence:
  `cadence-core/workflows/execute.md:216-221`,
  `cadence-core/bin/route.mjs:788-796`,
  `cadence-core/bin/lib/arg-contract.mjs:922-933`.

## Decisions

- D-07 (Grids stay): the computed level selects a ROW of the five existing
  grids; level vocabulary (`solo|shipped|critical`) and the grid cells do not
  move. Anything else breaks `gate-agreement.mjs`'s forced `<gate> at <level>`
  clauses and stales four quoting docs plus the claims ledger. Evidence:
  `cadence-core/bin/lib/gate-agreement.mjs:71-140`,
  `cadence-core/bin/lib/route-cells.mjs:106-127`.

- D-08 (Effort clamp): `model.effort.<role>` still wins over the cell but is
  clamped by the computed floor for POST-PLAN roles only; `cad-planner` and
  `cad-assumptions-analyzer` are exempt, dispatched before a PLAN exists. This
  makes `config-reach.md:113-118` - stale since the v2.7.0 deletion - true
  again. Evidence: `cadence-core/references/config-reach.md:113-118`,
  `cadence-core/workflows/plan.md:96,267`.

- D-09 (Phase flag): the resolve keys off `--phase` when passed and the
  STATE.md cursor otherwise; the `cad-plan-checker` call site passes an
  explicit `--phase` because it resolves while the cursor still names N-1. A
  malformed `--phase` is REFUSED once the flag decides a floor - the current
  warn-and-continue disposition answers a typo with a different phase's floor.
  Evidence: `cadence-core/bin/route.mjs:820-828`,
  `cadence-core/bin/lib/arg-contract.mjs:928`, `.planning/CAPTURE.md:432`.

- D-10 (Answered scope): the floor is scoped by
  `review.triggers.risk_surface.surfaces` - a project that answered the
  surface question narrowed what can raise it, on the same terms the
  commit-time trigger already uses. Evidence:
  `cadence-core/bin/route.mjs:647-683`,
  `cadence-core/bin/lib/surface-scan.mjs:79-99`.

- D-11 (Prose surfaces): the statements that must move are
  `cadence-core/references/seams.md:177-179` ("the level, full stop"),
  `METHOD.md:423-428` ("Detection sets no floor"), `INTERNALS.md:13`,
  `README.md`, `cadence-core/references/config-reach.md:113-118`, plus
  `.planning/DOCS-CLAIMS.md` rows re-reversing METHOD-59 and INTERNALS-13;
  every budgeted file edited gets its `weight-budgets.json` row re-pinned in
  the same change (phase 2 D-12). Evidence: `.planning/DOCS-CLAIMS.md:629,665`,
  `cadence-core/bin/weight-budgets.json`.

- D-12 (Measurement): criterion AC6's per-phase token comparison reads off
  `trace.jsonl` as it already ships - 247 events carry a numeric `tokens`
  field today; no new instrumentation. Evidence:
  `cadence-core/bin/lib/trace.mjs:641-746`.

- D-13 (Not a revival): the detector is not the deleted `lib/risk-surfaces.mjs`
  token matcher; that mechanism's measured failure (15/16 resolves floored on
  opus) is why CER-01 exists. Evidence: `DESIGN.md:478-494`, commit `8063832`,
  `METHOD.md:423-428`.

## Acceptance criteria

- [ ] AC1: with `stakes=critical` set explicitly, `route.mjs resolve` returns
      level `critical` for a phase whose declared files touch no surface; a
      test pins that an explicit floor is never resolved below.
- [ ] AC2: with `stakes` unset, resolve for a real phase of this repo whose
      declared `files:` touch no answered surface returns `solo`, while
      today's resolver returns `shipped` - both outputs shown.
- [ ] AC3: replaying this project's shipped phases through both resolvers, no
      phase whose declared files touch an answered surface resolves lower than
      today; the level diff is printed per phase.
- [ ] AC4: lowering below the computed floor requires the new
      `review.triggers.risk_surface` override key naming the surface; a
      lowering without it is refused, and a test pins `retired-keys.mjs`
      byte-identical.
- [ ] AC5: resolve with an absent or unreadable PLAN returns `ok:true` at the
      configured stakes (default `shipped` when unset), never below and never
      `ok:false` - the unset->`solo` floor applies only when a plan was read
      and showed no surface.
- [ ] AC6: the same milestone replayed at the fixed level and the computed
      one, per-phase `tokens` compared from `trace.jsonl`, with the no-surface
      phases demonstrably cheaper. (human-verify: needs a live milestone run)
- [ ] AC7: a `/cad-decision-review` ruling on "the resolve reads planning
      state" exists dated before PLAN.md is written, and
      `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
      `problems: []`.

## Flagged assumptions

- AC6's live milestone replay is not dispatchable by any executor - Likely;
  if wrong, a plan declares it as an executor task and the executor
  checkpoints `structural`. Phase 1's and phase 2's SUMMARY record the same
  shape; the orchestrator or the user runs it.
- ROADMAP criterion 1's phrase "a project floor of `high`" names a member of
  `rung_order`, not `stakes_order`; AC1 rewords it as the level `critical` -
  Likely the intended reading; if wrong, the intent was a RUNG floor and AC1
  under-tests it (D-08's clamp is where rung flooring lives).
- Reading the existing `--bracket-plan` as the executor resolve's floor key
  needs no new flag; if the planner instead adds a dedicated `--plan`, the
  `arg-contract.test.mjs:297` entries pin bumps (the phase 1 deviation shape) -
  Likely; planner's call which spelling to use.
