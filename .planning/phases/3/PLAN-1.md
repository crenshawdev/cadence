---
phase: 3
plan: 1
requirements:
  - RVW-03
files:
  - cadence-core/route-table.json
  - cadence-core/bin/route.mjs
  - cadence-core/bin/route.test.mjs
  - cadence-core/bin/lib/route-cells.mjs
  - cadence-core/bin/route-cells.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/config.schema.json
  - cadence-core/bin/config.mjs
  - cadence-core/bin/config.test.mjs
  - cadence-core/references/review-triggers.md
  - cadence-core/references/config-reach.md
  - cadence-core/references/config-catalog.md
  - cadence-core/bin/weight-budgets.json
  - INTERNALS.md
  - .planning/DOCS-CLAIMS.md
---

# Phase 3: Flags that do more or less than they say - Plan 1 (RVW-03)

## Goal

Raising `stakes` moves BOTH halves of a cross-model review panel: the
per-trigger model tier and the per-trigger reasoning effort become level-
dependent, resolve in the seam, and ride the same envelope line the reviewer
set already rides - instead of the subagent reviewer upgrading while the
cross-model one stays on a fixed value nothing resolves.

## Must be true when done

- For `plan` and for `risk_surface`, `route.mjs resolve` answers a DIFFERENT
  cross-model tier and a DIFFERENT cross-model effort at `solo`, at `shipped`
  and at `critical`, and both ride the returned envelope beside `reviewers`.
- Every stakes level names every trigger in BOTH new grids: removing one cell
  from either makes `self-verify` report `missing-cell` naming the grid, the
  level and the trigger, and adding an entry for a trigger the schema does not
  define is reported too.
- On a repository where no layer sets it, `config.mjs get
  review.triggers.plan.tier` no longer answers a fixed `flagship`: it answers
  the unset sentinel with one warning naming what does answer it for a level,
  the way an unset gate already does.
- `references/review-triggers.md` step 4 takes the cross-model model tier and
  the cross-model effort from the step-1 resolve's own line; no prose anywhere
  tells a reader to resolve `trigger.tier` or `trigger.effort` from a config
  read the spine never makes.
- Every surface that states how many grids `route-table.json` carries states
  the same number, and the config catalog and reach rows describe the new
  resolution source.
- `node --test cadence-core/bin/*.test.mjs` and `node
  cadence-core/bin/self-verify.mjs` both exit 0.

## Context

Locked: D-01 (re-key the EXISTING `tiers` grid on (level, trigger); the tier
vocabulary is NOT mapped onto the cells grid's model aliases), D-02 (DENSE -
every level names every trigger; no base row, no per-level bump resolved in
code), D-03 (the resolved tier rides the `resolve` envelope beside `reviewers`,
as RVW-02 did for the reviewer set), D-04 (the `tier` schema `default` moves to
the `null` sentinel and its `purpose` gains per-level clauses, mirroring
GAT-02's `.gate`), D-05 (an `efforts` grid keyed the same way, in the same
envelope), D-06 (`review.consult.*` and `review.decision_review.*` stay OUT),
D-17 (a prose surface that GROWS carries its `weight-budgets.json` bump in the
same commit; all five surfaces this phase touches sit exactly at budget today),
D-18 (the tier rows are rewritten, not re-worded), D-19 (the contradictory
grid-count claims are settled here).

Out: `review.consult.tier|effort`, `review.decision_review.tier|effort`,
`workflows/decision-review.md`, `references/consult.md`.

## Tasks

### Task 1: Level-key the tier grid, add the effort grid, and return both from resolve

- **Files:** cadence-core/route-table.json, cadence-core/bin/route.mjs,
  cadence-core/bin/route.test.mjs
- **Action:** Re-key `route-table.json`'s existing `tiers` block on (stakes
  level, trigger) and add an `efforts` block beside it keyed identically, both
  DENSE - every level in `stakes_order` names every trigger the `review` rows
  name (D-01, D-02). Declare the accepted effort vocabulary in the table itself
  as a sibling array of `tier_names`, for the reason `_meta.tiers` already
  states: `route.mjs` must never read `config.schema.json`, so the resolver
  needs its own copy of any vocabulary it resolves against. The VALUES carry
  the ladder this requirement exists to make visible: `critical` names the
  strongest pair (`flagship` plus the strongest effort the schema's enum
  offers), `shipped` sits one step below it on both axes, `solo` one step below
  that, so the three levels are pairwise distinct for `plan` and for
  `risk_surface`; `tier_names` is declared strongest-first, so "a step down"
  means toward `cheap`. `diff` and `phase_diff` follow the same monotone shape
  from the values `config.schema.json` pins for them today, holding at the
  vocabulary's end rather than inventing a name outside it. Update `_meta`'s
  `tiers` note to say the row is now per level and add the `efforts` note
  beside it, keeping the existing statement of WHY the values are transcribed
  by hand rather than read from the schema.
  In `route.mjs`, read the per-trigger effort out of the config layers with the
  same generic reader `triggerFieldIn` already gives `gate`, `tier` and
  `surfaces`, and resolve BOTH fields per trigger from the level's row with the
  existing config-wins precedence: a layer that set `review.triggers.<t>.tier`
  or `.effort` still wins over the level's cell, and the existing `tierFrom`
  labelling inside the dropped-reviewer warning must name the level's row
  rather than a table row keyed on a trigger alone. Return both as their own
  top-level maps on the `out({ ok: true, ... })` envelope, beside `reviewers`
  and never folded into it (the reason D-05 of RVW-02 gives for `reviewers`
  itself: `review`'s values are gate strings and a reader of the wiring table
  would break). Name the per-trigger effort map so a reader cannot confuse it
  with the envelope's EXISTING top-level `effort`, which is the agent RUNG this
  dispatch runs at and is a different quantity entirely - that collision is the
  one real hazard in this task. The availability test that reads a trigger's
  tier keeps working off the resolved tier, so a provider with no model id at
  the level's tier is still dropped with its cause in `warnings[]`.
  `route.test.mjs` pins the table's whole top-level key set - both new keys
  join that list, and the `table` subcommand test name that calls it "the three
  grids" is corrected in the same edit.
- **Verify:** `node cadence-core/bin/route.mjs resolve --role cad-reviewer
  --file <a config setting stakes solo|shipped|critical>` run once per level
  prints, on one line beside `reviewers`, a per-trigger tier map and a
  per-trigger effort map whose `plan` and `risk_surface` values are all
  different across the three levels; `node --test
  cadence-core/bin/route.test.mjs` passes, and the new assertions carry a
  `WATCHED FAILING AT <sha>` header naming the commit that precedes this fix,
  observed failing against that tree.

### Task 2: Validate both grids in both directions

- **Files:** cadence-core/bin/lib/route-cells.mjs,
  cadence-core/bin/route-cells.test.mjs, cadence-core/bin/self-verify.mjs,
  cadence-core/bin/self-verify.test.mjs
- **Action:** `cellIssues` currently walks `tiers` as the ONE grid keyed on a
  trigger alone, locating a fault as `tiers/<trigger>`. Walk both re-keyed
  grids inside the same per-level loop the `review` rows are walked in, in BOTH
  directions - a (level, trigger) pair with no entry is `missing-cell`, an
  entry for a trigger the caller's list does not hold is `unknown-trigger`, a
  value outside the table's `tier_names` is `unknown-tier`, and a value outside
  the table's effort vocabulary gets its own code beside it. Three grids now
  key on (level, trigger), so every `detail` must locate the GRID as well as
  the cell: the bare `<level>/<trigger>` form the review rows use would send a
  maintainer to the wrong block. Keep the existing single-problem rules the
  file already states - an absent block or an absent vocabulary array is ONE
  problem naming it, never one per cell. Update the header comment that
  enumerates the grids and the `missing-cell` / `unknown-tier` code
  descriptions, and the `tiers is the ONE grid that does not key on a level`
  paragraph, which this task makes false. `self-verify.mjs` passes vocabulary
  from `config.schema.json` today (`levels`, `triggers`, `gates`); supply
  whatever the new checks need from the same source rather than letting this
  lib grow a second opinion about accepted names, and correct check 8's own
  "the three grids" line in its header index. `self-verify.test.mjs`'s fixture
  table carries the flat `tiers` shape and moves with it.
- **Verify:** `node --test cadence-core/bin/route-cells.test.mjs
  cadence-core/bin/self-verify.test.mjs` passes with new cases for a deleted
  cell in each grid, an unknown trigger key in each, and an out-of-vocabulary
  value in each, every `detail` naming the grid, the level and the trigger;
  `node cadence-core/bin/self-verify.mjs` on this repo reports `ok:true` with
  no `missing-cell` for either grid.

### Task 3: Move the tier and effort schema defaults onto the unset sentinel

- **Files:** cadence-core/config.schema.json, cadence-core/bin/config.mjs,
  cadence-core/bin/config.test.mjs
- **Action:** For every `review.triggers.<t>.tier` and every
  `review.triggers.<t>.effort` row, move `default` to `null` and rewrite
  `purpose` to carry a per-level clause for each stakes level, exactly as the
  sibling `.gate` rows do ("advisory at solo, blocking at shipped, adjudicated
  at critical") and matching the values Task 1 put in the grid (D-04). Each
  rewritten purpose MUST still carry the phrase `cross-model reviewers only`
  verbatim: `references/config-reach.md`'s rows declare these keys narrower
  than universal, and self-verify check 9 fails when the purpose stops
  repeating that phrase. In `config.mjs`, extend the explicit-read arm that
  already names an unset gate so an unset tier and an unset effort answer the
  same way - the value line stays the schema sentinel, and one warning per key
  names `route.mjs resolve` as what answers it for a level. Keep both existing
  constraints on that arm: only on an EXPLICIT read (a keyless `get` walks
  every schema key and must not grow eight more lines), and it never states
  what the level resolves and never reads `route-table.json`, because this seam
  does not know the stakes level. Match by key SHAPE the way `GATE_KEY` does,
  so a fifth trigger is covered the day its keys land.
- **Verify:** In a repository whose layers set none of them, `node
  cadence-core/bin/config.mjs get review.triggers.plan.tier
  review.triggers.plan.effort` prints `null` for both values - never `flagship`
  or `high` - plus one warning per key naming `route.mjs resolve`, while a
  layer that PINS one reads it back byte-identical with no warning; `node
  --test cadence-core/bin/config.test.mjs` passes and `node
  cadence-core/bin/self-verify.mjs` still reports `ok:true` (check 9 proves the
  reach phrase survived the rewrite).

### Task 4: Rewrite the tier and effort rows in the reach table and the catalog

- **Files:** cadence-core/references/config-reach.md,
  cadence-core/references/config-catalog.md,
  cadence-core/bin/weight-budgets.json
- **Action:** All four `review.triggers.<t>.tier` reach rows say the tier is
  resolved at `references/review-triggers.md` step 4 with a fallback to a
  `tiers` row keyed on a trigger alone, and all four `.effort` rows point only
  at `bin/review-provider.mjs --effort`. Rewrite both families to name the
  resolution source this plan ships - the seam resolving the level's cell and
  returning it in the envelope, which review-triggers.md step 4 TAKES - in the
  shape the `review.reviewers` row already uses for exactly this handoff
  (D-18). The reach COLUMN stays `cross-model reviewers only` and the schema
  purposes keep that phrase verbatim, so check 9 stays green. In
  `config-catalog.md`, the `review.triggers.<t>.tier` and `.effort` rows'
  Default column asserts `flagship, except balanced for diff` and `high, except
  medium for diff`, which Task 3 falsifies: replace both with the unset-decides
  form the `.gate` row directly above them already uses. Re-pin any surface
  whose byte count GREW in `weight-budgets.json` in this same commit (both
  files sit exactly at budget today, so any addition is an immediate
  `budget-overrun`); a surface that shrank is left alone (D-17).
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `config-reach` and no `budget-overrun` problem, and `grep -n
  "triggers.*tier\|triggers.*effort" cadence-core/references/config-reach.md
  cadence-core/references/config-catalog.md` shows no row still naming a
  trigger-keyed `tiers` row or a fixed `flagship`/`high` default.

### Task 5: review-triggers.md takes both fields off the resolve line

- **Files:** cadence-core/references/review-triggers.md,
  cadence-core/bin/weight-budgets.json
- **Action:** Step 1 tells the reader to take the gate, the reviewer set and
  the reviewer's `agent`/`model` from the one resolve; extend that sentence so
  the per-trigger cross-model tier and effort come off the same line, and
  correct the "Which fields reach which backend" paragraph, which today says
  those two fields come from config. In step 4's cross-model arm, replace the
  instruction to resolve `model = review.providers.<name>.tiers[trigger.tier]`
  and `effort = trigger.effort` with taking the resolved tier and effort from
  the step-1 envelope and indexing the provider's `tiers` map with the tier it
  returned - this is the same move RVW-02 made for the reviewer set, and it is
  what makes the level's values actually reach the provider call (D-03, D-05).
  The claude-subagent arm's existing "when the per-trigger effort differs from
  the rung actually dispatched, say so in one line" rule stays and now names
  the resolved effort rather than a configured one; a degraded resolve
  (`ok:false`) still falls back to the config value and says so, since that arm
  is the reader's only remaining path to these fields. Do not add tier or
  effort columns to the Wiring table - `prose-agreement.test.mjs` parses named
  rows of it and no decision asks for that. Re-pin this surface in
  `weight-budgets.json` in the same commit if it grew (D-17).
- **Verify:** `grep -n "trigger.tier\|trigger.effort"
  cadence-core/references/review-triggers.md` returns nothing outside a
  sentence describing the resolve envelope, `node
  cadence-core/bin/self-verify.mjs` reports `ok:true` (no `budget-overrun`, no
  `route-relay` problem), and `node --test
  cadence-core/bin/prose-agreement.test.mjs` still passes.

### Task 6: Settle the grid count everywhere it is stated

- **Files:** INTERNALS.md, .planning/DOCS-CLAIMS.md
- **Action:** `INTERNALS.md:17` describes `route-table.json` as "the three
  grids - 18 cells, the review gates, the verify switch", which omitted `tiers`
  before this phase and omits `efforts` after it. State the real count and name
  every grid (D-19). `.planning/DOCS-CLAIMS.md`'s INTERNALS-42 row records that
  sentence as accurate and the README rows beside it (README-19, README-63)
  describe the same table; update the ledger rows this change falsifies in the
  ledger's own default style - the Claim cell stays as the sweep recorded it
  and the Resolution cell names the correction and what the file now reads.
  A self-referential commit sha is unknowable while writing the row, so name
  the requirement and milestone (`RVW-03`, `v3.5.4`) where a prior row names a
  sha. Leave `DESIGN.md`'s sentence alone: it is a dated record of what the
  v2.0.0 decision replaced, not a claim about the current file.
- **Verify:** `grep -rn "three grids\|four grids" --include="*.md"
  --include="*.mjs" --include="*.json" cadence-core/ INTERNALS.md README.md
  .planning/DOCS-CLAIMS.md` returns no statement that contradicts the number of
  grids `route-table.json` now carries, and `node
  cadence-core/bin/self-verify.mjs` reports `ok:true`.

## Notes

- AC2 asks that `config.mjs get review.triggers.plan.tier` "reports the value
  the resolver actually uses at the effective stakes level rather than a fixed
  `flagship`". Task 3 delivers that the way D-04 binds it - the null sentinel
  plus a warning naming the resolver - because GAT-02's own locked decision is
  that this seam never reads `route-table.json` and does not know the stakes
  level. The criterion's literal "reports the value" is met in the same sense
  it is already met for an unset gate; a verifier walking AC2 should read it
  that way.
- The ladder Task 1 writes moves `plan` and `risk_surface` at `shipped` DOWN
  from the flagship/high pair the schema pins today, because `critical` must
  sit above `shipped` and flagship/high is the top of both vocabularies. Two
  consequences worth a human's eye at review: a blocking `risk_surface` fire at
  the default level resolves a cheaper model than it does today, and a user who
  configured only a `flagship` model id for their provider will see that
  provider dropped at the lower levels with the cause in `warnings[]` (the
  existing availability path, already reported). This repository configures no
  provider, so its own runs are unaffected.
