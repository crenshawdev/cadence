---
phase: 3
status: complete
completed: 2026-07-29
---

# Phase 3: The bundle cell - Summary

A routing cell stops yielding a model and starts yielding the whole quality
bundle: `route.mjs resolve --role <r>` now returns `{model, effort, review,
verify}` computed from an 18-cell `(stakes level, role)` grid in
`route-table.json`, the hand-enumerated tier matrix and the
`tier_order`/`base_effort`/`escalate_to` vocabulary are gone, and self-verify
walks the grid against `agents/` in both directions.

## What shipped

- **The four-knob bundle** - `cadence-core/bin/route.mjs` returns `model`,
  `effort`, `review` (a per-trigger gate map) and `verify` for every
  `(level, role)` pair, with `tier` gone from the payload. Verified live: all
  36 resolutions (18 cells x attempts 1 and 2) match `route-table.json`
  exactly under a hermetic config, 0 mismatches.
- **The cell grid** - `cadence-core/route-table.json` carries `cells`
  (3 levels x 6 roles), a `review` grid and a `verify` grid, replacing the
  enumerated matrix. The whole table's decision content reads in one screen:
  3 objects of 6 three-key rows, plus two flat grids.
- **Six new rung files** - `agents/cad-planner-max.md`,
  `cad-verifier-medium.md`, `cad-verifier-max.md`, `cad-reviewer-max.md`,
  `cad-plan-checker-medium.md`, `cad-plan-checker-xhigh.md`, bringing
  `agents/` to 19 files, each with an exact-fit `weight-budgets.json` entry.
- **The cell walk in self-verify** - new `cadence-core/bin/lib/route-cells.mjs`
  (`cellIssues`, `declaredRoles`, `routableAgents`) plus the `routing-cells`
  check in `self-verify.mjs`. Confirmed failing-capable: setting
  `review.shipped.diff = "maybe"` yields
  `{"ok":false,...,"kind":"unknown-gate","detail":"shipped/diff: gate
  \"maybe\" is not one of [off, advisory, blocking, adjudicated]"}`, naming the
  cell; the tree restored clean returns `ok:true` with `routing-cells` in
  `checked`.
- **The retired vocabulary deleted** - `tier_order`, `base_effort`,
  `escalate_to` and the legacy rung lib are gone; `role_order` became `roles`
  with every reader moved.
- **The bundle wired into the consumers** - `references/review-triggers.md`,
  `references/seams.md`, `workflows/verify.md`, `workflows/config.md`,
  `workflows/plan.md`, `workflows/execute.md` and `skills/cad-land/SKILL.md`:
  three `config.mjs get ...gate` pre-fetches dropped in favour of the bundle.
- **The prose and the release note** - `README.md`, `INTERNALS.md`,
  `DESIGN.md`, `LINEAGE.md`, `CHANGELOG.md`, `config.schema.json`.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 2de7239 | resolve the review and verify grids into route.mjs's return |
| 1 | 2 | de49d6a | materialize the six new rung agent files with exact-fit budgets |
| 1 | 3 | 6709a48 | replace the tier matrix with the (level, role) cell grid |
| 1 | 4 | 7749e47 | pin all 18 cells and all 18 retries with literal expected values |
| 1 | 5 | db25a51 | walk the routing cells in self-verify - missing cells and rung files |
| 1 | 6 | b7927dc | fail self-verify on the bad-value classes, naming the cell |
| 1 | 7 | 5e8b2a0 | delete the tier matrix, base_effort, escalate_to and the legacy lib |
| 1 | 8 | eecf144 | wire the bundle into fire(trigger), deep-verify and the fire sites |
| 1 | 9 | dacdc6a | reconcile the config schema and the config/plan workflow prose |
| 1 | 10 | 19c4dab | state the bundle in the narrative docs and the release note |

Range `f374d30..19c4dab`, 10 commits. Tree clean; 852 tests pass;
`tsc -p tsconfig.ci.json` exits 0; `self-verify.mjs` reports `ok:true`.

## Deviations

- [deviation] Task 3: the plan specified `rungFile` returning null but not what
  `route.mjs` does with one. Implemented per the file's stated fail-open
  contract - dispatch the unsuffixed `agents/<role>.md` and push
  `rung "<r>" maps to no agent file; dispatching <role>` onto `reason` - rather
  than emitting `agent: null`. (6709a48)
- [deviation] Task 3: deleted `route.test.mjs`'s `agentForRung, rungAgents`
  import here rather than in task 7, closing task 7's named
  module-load-SyntaxError hazard a commit early. (6709a48)
- [deviation] Task 3: deleted the `every role base_effort matches the agent file
  frontmatter` row, in-plan under "retarget or delete the rows that assert
  tier, base_effort or escalate_to". Its `cad-reviewer` = `high` literal is now
  carried by task 4's shipped/cad-reviewer row plus the table-vs-disk walk.
  (6709a48)
- [deviation] Task 5: `routableAgents(table)` returns a `Map` (stem ->
  `<level>/<role>`), not a `Set` - the plan required the disk-side
  `missing-rung-agent` detail to name "the cell that wants it", which a bare
  set of stems cannot supply. (db25a51)
- [deviation] Task 5: self-verify's `checked` string tail is now
  `routing-cells`, was `rung-agents`. Nothing reads it. (db25a51)
- [deviation] Tasks 5-6: `cellIssues` suppresses a SECOND code for ONE fault - a
  rung already reported `unknown-rung` is not also `missing-rung-agent`, and a
  key already reported `unknown-trigger` is not also `unknown-gate`. The plan's
  no-short-circuit rule (two faults -> two problems) is honoured and tested
  separately. (db25a51, b7927dc)
- [deviation] Task 6: an absent `rung_order`/`model_aliases` reports ONE problem
  naming the absent list rather than one per cell, following `rungIssues`'
  precedent. Not stated in the plan; tested. (b7927dc)
- [deviation] Task 7: the scoped grep returned 4 matches where none were
  expected - three were new comments explaining the retirement, one a
  `'tier_order' in r.table === false` assertion. Comments reworded; the
  assertion replaced with a full top-level key-set `deepEqual`, which is
  grep-clean and strictly stronger. (5e8b2a0)
- [deviation] Task 10: the repo-wide grep matched the new CHANGELOG bullet
  naming `tier_order` as removed; reworded to "the whole `tier` vocabulary".
  (19c4dab)
- [deviation] Task 10: self-verify flagged
  `unknown-config-key: model.overrides.<role` in INTERNALS.md - check 1 expands
  `<t>`/`<trigger>`/`<name>`/`<provider>` but not `<role>`. Written as
  `model.overrides`, matching seams.md's existing phrasing. (19c4dab)
- [deviation] Three files were edited outside the plan's declared `files:`
  list and this was not recorded by the executor:
  `cadence-core/workflows/execute.md` and `skills/cad-land/SKILL.md` in
  eecf144 (both are fire-trigger sites, in the spirit of task 8) and
  `LINEAGE.md` in 19c4dab. Found by diffing `--stat` against the frontmatter.

## Open items

Findings below are a list, not a work order. Nothing here was fixed; the `diff`
gate is advisory and none of it blocks `/cad-verify 3`.

- **Adjudicated finding (confirmed, strongest): a config gate reaches the bundle
  unvalidated, while the sibling model pin does not.** This diff made
  `route.mjs` the sole gate source (three `config.mjs get ...gate` pre-fetches
  were deleted in eecf144), but `route.mjs:182` writes
  `review.triggers.<t>.gate` through with no enum check. Verified live: a config
  of `{"stakes":"critical","review":{"triggers":{"risk_surface":{"gate":"blockign"},
  "diff":{"gate":["off"]},"plan":{"gate":0}}}}` resolves `ok:true` with
  `"risk_surface":"blockign"`, `"diff":["off"]`, `"plan":0` - a one-character
  typo silently replaces critical's deliberately-`blocking` risk_surface gate.
  Compare `route.mjs:199`, where an unknown model alias IS refused with a
  warning. This is the one finding introduced by this phase's own change of
  ownership.
- **Adjudicated finding (confirmed): `roles[]` is a blind spot for the whole
  cell walk.** `cellIssues` iterates `declaredRoles(t)`, so a role missing from
  `route-table.json`'s `roles` array is invisible to every check while
  `route.mjs` refuses to dispatch it. Verified on a `git archive` copy with
  `cad-reviewer` removed from `roles`: `self-verify --root <copy>` ->
  `{"ok":true,"problems":[]}`, `route.mjs resolve --role cad-reviewer` ->
  `{"ok":false,"reason":"unknown-role"}`. `routableAgents` iterates `cells`, not
  `roles`, so the reverse walk stays quiet too.
  Bundled with it: `route-cells.test.mjs:247` asserts this hole as correct
  behaviour ("With no declared roles there are no (level, role) pairs to
  miss"), so the fix would have to rewrite that row.
- **Adjudicated finding (confirmed): `fable` in a cell passes self-verify.**
  `cellIssues` checks a cell model against `model_aliases`, which contains
  `haiku` and `fable`, so setting `cells.shipped["cad-planner"].model = "fable"`
  gives `self-verify -> ok:true` and `route.mjs resolve --role cad-planner ->
  {"model":"fable","pinned":false}`. Success criterion 4's "reachable only by
  explicit pin" IS pinned by tests (`route.test.mjs:132`; 6 tests fail on the
  mutation), so CI catches it and the shipped linter does not. Raised by
  gemini-3.6-flash.
- **Adjudicated finding (plausible, reviewer-verified): the unmapped-rung
  fail-open reports a rung it could not reach.** `route.mjs:135` dispatches the
  unsuffixed `agents/<role>.md` but leaves `effort`/`escalated` naming the
  target rung, and the unsuffixed file is not a floor - `cad-plan-checker.md`
  is pinned `effort: low` while `cad-assumptions-analyzer.md` is its `xhigh`
  rung. So the bundle can claim `max` for a dispatch that runs `low`, the class
  `rung-demotion` was added to prevent. Not re-verified here.
- **Adjudicated finding (plausible, reviewer-verified): self-verify proves a
  rung file EXISTS but not that its frontmatter `effort` equals its rung.**
  Setting `agents/cad-verifier-medium.md` to `effort: max` (with a matching body
  line and a refreshed budget) leaves `self-verify -> ok:true` while
  `route.mjs` reports `effort: medium` for it. `route.test.mjs:472-493` is the
  only thing in the tree that checks this.
- **Adjudicated finding (plausible, reviewer-verified): a level the table
  declares but the stakes enum does not is checked for nothing.** Adding a
  `cells.enterprise` row with a bogus model, rung, trigger and verify value
  leaves self-verify green, and `route.mjs:115` indexes `TABLE.cells[cfg.stakes]`
  with the raw config string, so `"stakes":"enterprise"` resolves `ok:true`.
- **Adjudicated finding (downgraded to doc clarity): `--deep` vs
  `workflow.verifier: false`.** The reviewer read this as a three-way
  contradiction; on inspection `workflows/config.md:81` and
  `workflows/verify.md:96-99` agree unambiguously (false always skips, `--deep`
  forces only within the `true` arm). Only `config.schema.json:21`'s
  parenthetical "(--deep forces it either way)" can be misread as spanning both
  values. Worth one word, not a fix loop.
- **Latent (from the refuted deepseek blocker): the gate check fail-opens if its
  schema key moves.** `route-cells.mjs:186` guards on `gateNames.length &&`, and
  `self-verify.mjs:590` sources those names from
  `schema['review.triggers.plan.gate']`. That key exists
  (`config.schema.json:61`) so the check is live today - the blocker as filed is
  refuted - but renaming or removing that one key disables gate validation
  silently rather than erroring.
- Task 10's Verify exception stands as designed and is stated in 19c4dab:
  `git grep -In "escalate_to\|base_effort\|tier_order" -- . ':!.planning'`
  matches ONLY DESIGN.md - the untouched section 6 history at :371 and :395 plus
  the new 2026-07-29 marker. CONTEXT AC2 read literally ("`escalate_to` appears
  in no shipped .json, .mjs or .md") is a FAIL against a correct tree;
  `/cad-verify 3` should judge the exception, not rediscover it.
- Phase 2's SUMMARY open item 2 (nothing relays `warnings[]`) is closed by task
  8's seams.md bullet, scoped to one relay per distinct warning per workflow
  run. That is prose the orchestrator must follow; no seam enforces it.
- `cadence-core/references/*.md` remain unbudgeted by design (D-13), so
  `review-triggers.md` grew ~1.2KB and `seams.md` ~1.3KB with no manifest entry.
- Cross-model reviewer `openai` was unavailable for this phase's `diff` review:
  http 401 `invalid_api_key` on `gpt-5.6-terra`. The key in the environment is
  rejected by the provider, so that voice was dropped from an adjudicated panel
  of four. Worth fixing before the next gated trigger.

Two open items carried out of the executor's report were checked and are STALE,
so they are not repeated above: `~/.claude/cadence/config.json` holds no
`model.auto.*` keys (it is `{"overrides":{"cad-executor":"opus"},
"escalate_on_failure":false}`), and `.planning/ROADMAP.md:34` already shows
phase 1 as `- [x]`.

## Goal check

The phase delivers its goal. "One question in, four knobs out" is literally
true at the seam: `route.mjs resolve --role cad-planner` returns
`{"model":"opus","effort":"high","review":{...five triggers...},"verify":"on"}`,
and a hermetic sweep of every `(level, role)` pair at both attempts returned 36
of 36 values matching `route-table.json` with zero mismatches, which is
criterion 1 met more strongly than "one row per cell" required. Criterion 2
holds - `cells` is three objects of six three-key rows plus two flat grids, and
nothing is enumerated by hand. Criterion 3 is met for the classes the plan
named: a mutated gate produces `{"ok":false,...,"unknown-gate","shipped/diff:
gate \"maybe\" is not one of [...]"}`, naming the cell, and the restored tree
returns `ok:true` with `routing-cells` in `checked`. Criterion 4 holds - the
`cad-executor: opus` pin in the global config surfaces as
`"pinned":true,"reason":["...","override cad-executor=opus (already the routed
model)"]`, and `route.test.mjs:132` pins the no-fable-in-cells rule, with the
executor's model now derived from its cell rather than the roles table. What is
missing is not in the goal but around it: the adversarial review found, and I
confirmed live, that self-verify's grid walk is keyed off `roles[]` and the
stakes enum, so anything outside those two lists is checked by nothing, and
that `route.mjs` now owns the review gates without validating them the way it
validates a model pin. Those are gaps in the guard rather than in the bundle -
the bundle resolves correctly for every input the table declares - but the
guard is the thing criterion 3 exists to provide, so a later phase should
decide whether the enumeration source itself needs verifying.
