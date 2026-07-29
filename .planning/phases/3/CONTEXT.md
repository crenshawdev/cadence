# Phase 3: The bundle cell - Context

Gathered: 2026-07-28
Feeds: /cad-plan 3

## Scope boundary

In: the routing bundle as three grids of data - `(level, role) -> {model,
effort, retry effort}`, `(level, trigger) -> gate`, `level -> verify`;
`route.mjs` returning `{model, effort, review, verify}`; `base_effort`,
`escalate_to` and the tier-driven model lookup deleted; 6 new agent rung files
with exact-fit weight budgets; four self-verify cell-validation checks;
`fire(trigger)` dispatching the reviewer rung its cell names; the
config-gate-wins precedence with a named warning; 18 literal `route.test.mjs`
rows; and the test, prose and budget lockstep those edits force.
Out: risk-driven rung floors (phase 4); acceptance-criteria ids (phase 5); the
remaining silent config drops (phase 6); making `fable` routable (closed by
phase 2's D-03 and not re-opened here).
Deferred: user-editable routing - a `routing` block in `.planning/config.json`
overlaying the shipped grids, so a user changes a cell without editing plugin
files. Wanted, moved to a later release by explicit user choice this pass. The
hard part is not the schema key: an overlay moves rung-file existence
validation out of CI and into runtime on someone else's machine, where the only
choices are failing the spawn or silently falling back.
Plan shape: multiple plans, same phase - /cad-plan decides the split. The work
spans routing resolution, the route table, 6 new agent files, self-verify
checks, the review-trigger wiring and three test files, but every arm stays red
until the grids and `route.mjs` core land, so ordering is forced even though
the work divides.

## Durable decisions

- D-01 (Routing shape): The bundle is THREE grids, not one. `model` and
  `effort` key on `(level, role)`; `review` keys on `(level, trigger)`;
  `verify` keys on level alone. Evidence: `cadence-core/bin/route.mjs` is
  invoked per-dispatch per-role (`cadence-core/references/seams.md:92-96`),
  while `cadence-core/workflows/verify.md:97-101`'s deep_check runs once per
  phase with no role in hand, and
  `cadence-core/references/review-triggers.md:132-138` keys every gate on a
  trigger rather than an agent. A single `(level, role)` grid carrying all four
  knobs was considered and rejected: 12 of 18 cells would carry `review` and
  `verify` values nothing reads, while criterion 1's one-row-per-cell test read
  as full coverage - the same fixture-that-cannot-fail shape phase 2's SUMMARY
  recorded twice. If wrong: the phase ships a four-field return where two
  fields are inert for most roles.
- D-02 (Effort): Effort comes from the `(level, role)` grid, and `base_effort`
  and `escalate_to` are both DELETED. A retry resolves to the retry rung the
  same grid row names. Evidence: verified live this session across all six
  roles - `route.mjs resolve --role <any> --attempt 2` returns
  `escalated:false` for five of six, because `route-table.json` sets
  `escalate_to === base_effort` for every role but `cad-plan-checker`, so
  `route.mjs:96` takes the no-op arm and 6 of the 13 shipped rung files are
  reachable by no config and no attempt count. Keeping `escalate_to` beside a
  cell that also sets effort was rejected: two mechanisms writing one value is
  exactly how that no-op arose. This reverses phase 1's D-03 (`escalate_to` as
  a fixed per-role target), and the reason it can be reversed is new - a fixed
  target can now point BELOW what the grid set, which would make a retry think
  less hard while reporting an escalation. It also closes the open phase-2 HIGH
  by making `CHANGELOG.md:52`'s ladder claim true rather than correcting the
  sentence. If wrong: the rung ladder stays unreachable a second release
  running and `model.escalate_on_failure` remains a key that is honoured and
  has no effect.
- D-03 (Models): The `(stakes, tier)` 3x3 model matrix is replaced by
  per-`(level, role)` model cells, and `tier` stops driving model resolution.
  Evidence: `cadence-core/route-table.json`'s `roles` block carries no `model`
  key - `route.mjs:80,112,121` reads `role.tier` and indexes
  `TABLE.stakes[stakes][tier]`, so `cad-executor`'s `tier: "standard"` IS the
  pin criterion 4 names. Keeping tier as a compression device (9 model cells
  instead of 18) was considered and rejected: it re-creates the exact
  indirection the criterion exists to remove, and 18 cells still read in one
  screen. If wrong: the executor's model stays pinned by a field named after
  something else.
- D-04 (Review): A `review.triggers.<t>.gate` set in config WINS over the
  level's gate, and the disagreement is reported in `route.mjs`'s `warnings`
  array rather than resolved silently. Evidence:
  `cadence-core/references/review-triggers.md` step 1 reads that config key as
  the sole gate source today; `route.mjs:140-142` already carries a `warnings`
  array built for exactly this shape (a torn layer, a retired key and an
  unknown pin alias can all be true at once). Level-wins was rejected because
  it makes a key the user explicitly set stop doing anything - the
  resolved-then-dropped defect class this whole milestone closes.
  Stricter-of-the-two was rejected because it applies phase 4's floor idea a
  phase early on a different axis and leaves no way to turn a review off. If
  wrong: a gate resolves to `off` at the top level with nothing said, which is
  a review failing open.
- D-05 (Files): No existing agent file is renamed. With `base_effort` gone the
  unsuffixed `agents/<role>.md` stops being the base rung and becomes one rung
  among the others; the rung-to-filename mapping becomes an explicit per-role
  table in `cadence-core/bin/lib/rung-agent.mjs`. Evidence:
  `agents/cad-assumptions-analyzer.md` is already `xhigh` with an
  `-high` sibling, so "the unsuffixed file is the lowest rung" is already not
  the convention. Normalizing was rejected: it renames five of six files,
  invalidates every one of their exact-fit `weight-budgets.json` entries, and
  buys a convention no code reads. This reverses phase 1's D-01, which was
  written when `base_effort` still existed to give the unsuffixed name a
  meaning. If wrong: a rename storm lands inside a routing phase for no
  behavioural gain.

## Decisions

- D-06 (Verify): `verify` is two-state per level - `off` at level 1, `on` at
  levels 2 and 3. Its depth dimension is already carried by the effort grid's
  `cad-verifier` row (`high` / `medium` / `xhigh`). Evidence: the only
  verification dials in the tree are `workflow.verifier`
  (`cadence-core/config.schema.json`, read at
  `cadence-core/workflows/verify.md:97-99`) and the `--deep` flag
  (`verify.md:19,25`), both feeding the single `cad-verifier` dispatch at
  `cadence-core/workflows/verify-deep.md:6`. Accepted knowingly as the thinnest
  of the four knobs.
- D-07 (Files): Six new agent rung files, 19 total: `cad-planner-max`,
  `cad-verifier-medium`, `cad-verifier-max`, `cad-reviewer-max`,
  `cad-plan-checker-medium`, `cad-plan-checker-xhigh`. Each needs an exact-fit
  `cadence-core/bin/weight-budgets.json` entry or
  `cadence-core/bin/self-verify.mjs:387-391` reports `unbudgeted-surface`.
- D-08 (Review): `fire(trigger)`'s claude-subagent arm dispatches the reviewer
  rung the level's cell names - `medium` at level 1, `high` at 2, `xhigh` at 3,
  `max` on a level-3 retry - closing phase 1's D-13 deferral. Evidence:
  `cadence-core/references/review-triggers.md:23-30, 57-69` currently states
  the reviewer runs at its own file's `effort` whatever the config says, and
  `cadence-core/bin/route.test.mjs:322` pins that literal.
- D-09 (Self-verify): Cell validation is new problem kinds inside self-verify's
  existing route-table walk, not a new seam script, so it needs no `CONTRACTS`
  entry. Evidence: `cadence-core/bin/self-verify.mjs:565-643` already reads and
  guards the route table root-relative and iterates `roles`; phase 1's D-10 set
  this precedent for checks 7 and 8.
- D-10 (Self-verify): The trigger-name check derives its valid set from
  `cadence-core/config.schema.json`'s `review.triggers.<t>` keys rather than
  parsing `review-triggers.md`'s Wiring table. Evidence:
  `cadence-core/bin/self-verify.mjs:234-235` already builds a `TRIGGERS` list
  from those schema keys; parsing the markdown table would grow a reader for a
  file with no stated grammar, the class `v1.4.0`'s GRM-01 spent a phase making
  safe.
- D-11 (Test shape): `route.test.mjs` pins all 18 cells with LITERAL expected
  values, never a walk that derives its expectations from
  `route-table.json`. Evidence: `.planning/phases/2/SUMMARY.md` records two
  mutation-proved coverage losses in exactly this family
  (`config.test.mjs:41`, `route.test.mjs:208`), both a fixture that no longer
  discriminates. The existing whole-table walk at `route.test.mjs:327-353` is
  legitimate only because it compares two independent sources (table vs agent
  frontmatter) and should stay that way.
- D-12 (Models): `haiku` is reachable by no cell at any level - the routed
  vocabulary is `sonnet` and `opus`. Both `haiku` and `fable` stay valid
  `model.overrides.<role>` pins and stay in `route-table.json`'s
  `model_aliases`.
- D-13 (Lockstep): Every prose edit inside a budgeted surface regenerates
  `cadence-core/bin/weight-budgets.json` in the same change; all entries are
  exact-fit. `cadence-core/references/*.md` are NOT in the manifest, so
  `seams.md` and `review-triggers.md` edits are unbudgeted.

### The three grids

`(level, role) -> model, effort, retry effort`

| Level 1 | model | effort | retry |
|---|---|---|---|
| cad-planner | sonnet | high | xhigh |
| cad-assumptions-analyzer | sonnet | high | xhigh |
| cad-verifier | sonnet | high | xhigh |
| cad-reviewer | sonnet | medium | high |
| cad-executor | sonnet | high | xhigh |
| cad-plan-checker | sonnet | low | high |

| Level 2 | model | effort | retry |
|---|---|---|---|
| cad-planner | opus | high | xhigh |
| cad-assumptions-analyzer | opus | high | xhigh |
| cad-verifier | opus | medium | high |
| cad-reviewer | opus | high | xhigh |
| cad-executor | opus | high | xhigh |
| cad-plan-checker | sonnet | medium | high |

| Level 3 | model | effort | retry |
|---|---|---|---|
| cad-planner | opus | xhigh | max |
| cad-assumptions-analyzer | opus | xhigh | xhigh |
| cad-verifier | opus | xhigh | max |
| cad-reviewer | opus | xhigh | max |
| cad-executor | opus | xhigh | xhigh |
| cad-plan-checker | opus | high | xhigh |

`(level, trigger) -> gate`

| Trigger | Level 1 | Level 2 | Level 3 |
|---|---|---|---|
| plan | advisory | adjudicated | adjudicated |
| diff | off | advisory | blocking |
| risk_surface | blocking | blocking | blocking |
| phase_diff | off | off | adjudicated |
| pre_ship | advisory | adjudicated | adjudicated |

`level -> verify`

| Level 1 | Level 2 | Level 3 |
|---|---|---|
| off | on | on |

Levels are `solo` / `shipped` / `critical` (phase 2's D-01). `risk_surface`
stays `blocking` at every level on purpose: it fires only on a detection match,
and phase 4 builds its computed floor on that same signal.

## Acceptance criteria

- [ ] AC1: `node cadence-core/bin/route.mjs resolve --role <role>` returns
      `model`, `effort`, `review` and `verify` for all 18 level-and-role pairs,
      and `cadence-core/bin/route.test.mjs` carries one row per pair with
      literal expected values rather than values derived from the table under
      test
- [ ] AC2: With `--attempt 2`, each cell resolves to the retry rung its grid
      row names and returns that rung's agent file; where retry equals the
      starting rung (level 3 analyzer and executor) the `reason` string says the
      rung was held; and `escalate_to` appears in no shipped `.json`, `.mjs` or
      `.md`
- [ ] AC3: `agents/` holds the 19 files the grids name, each file's frontmatter
      `effort` equals the rung in its name, each has a `weight-budgets.json`
      entry, and `node cadence-core/bin/self-verify.mjs` names the cell when a
      grid names a rung with no file
- [ ] AC4: `node cadence-core/bin/self-verify.mjs` reports `ok:false` naming
      the offending cell for each of four bad-value classes - a model outside
      `model_aliases`, a rung outside `rung_order`, a gate outside
      `off|advisory|blocking|adjudicated`, and a trigger name
      `config.schema.json` does not define
- [ ] AC5: `model.overrides.<role>` replaces a cell's model and leaves its
      effort unchanged; no cell at any level holds `fable`; and
      `cad-executor`'s model comes from its own cells (sonnet / opus / opus)
      rather than from a tier lookup
- [ ] AC6: A config whose `review.triggers.<t>.gate` disagrees with the level's
      gate resolves to the CONFIG value and emits one warning naming the
      trigger, the config value and the level value
- [ ] AC7: `node --test cadence-core/bin/*.test.mjs` exits 0,
      `npx tsc -p tsconfig.ci.json` exits 0, and
      `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no budget
      overage and no `unknown-config-key`

## Flagged assumptions

- The 18 cells' values are a first design pass, reasoned rather than measured -
  Likely; the executor-model claim behind level 2 and 3's opus executor ("a
  heavier model on the executor produced fewer review cycles") is informal,
  `.planning/PROJECT.md` flags it, and the telemetry lives outside this repo. If
  wrong the values move in a later minor, which is cheap because they are data.
  No spike is run inside this phase.
- Issue #81's kill criterion for the verify knob - whether UNCERTAIN verifier
  findings actually fall at higher rungs - has no data anywhere in the tree -
  Unclear; D-06 ships the knob at two states regardless, so an unmet criterion
  shrinks the knob later rather than failing the phase.
- ROADMAP criterion 3 words the trigger check as "a trigger name no
  `review-triggers.md` row defines" while D-10 derives the valid set from
  `config.schema.json` - Likely equivalent; both list the same five names
  today. If they drift, the check passes a name the doc omits.
- `.planning/ROADMAP.md`'s phase 1 checkbox is still unchecked though
  `.planning/phases/1/SUMMARY.md` reports `status: complete` and its UAT is
  13 of 14 - Confident; reported, not edited, since it is outside this
  workflow's write scope.
- This repo's own `.planning/config.json` still holds retired
  `model.auto.escalate_on_failure` and `model.auto.max_escalations`, so every
  `route.mjs resolve` on this tree emits two warnings - Confident; a /cad-task,
  not phase scope.
