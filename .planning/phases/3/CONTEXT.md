# Phase 3: The stakes key is gone and an interview replaces it - Context

Gathered: 2026-09-05
Feeds: /cad-plan 3

## Scope boundary

In: the deletion of `stakes` and everything keyed on it - the cells grid, the
`review` / `verify` / `tiers` / `efforts` grids beside it, `RAISE_TARGET`,
`route.mjs replay`, `model_aliases`, the six `model.overrides.*` enums and the
cell-vs-alias check in `route-cells.mjs`; real defaults in
`cadence-core/config.schema.json` for the keys those grids used to answer for; a
new `config.mjs unset` subcommand and a `retired-keys.mjs` entry for `stakes`;
the thirteen-question interview as a `--roles` arm of `/cad-config`, with
catalog rows for the twelve `roles.*` keys; the risk floor re-pointed at the
plan review and the deep-verify pass; and the prose, ledger and test sweep the
deletion forces across 15 non-test `.mjs` files, 18 prose surfaces under
`cadence-core/` and `skills/`, 9 tracked prose files outside them, and
`route.test.mjs` / `config.test.mjs` / `prose-agreement.test.mjs`.

Out: a Codex host adapter (`GH-140`), the worktree spike (`GH-119`) and cache
read growth (`GH-230`) - all three out of the cycle entirely. Editing
`.planning/ROADMAP.md` is also Out: this workflow does not write it. See D-02 -
the roadmap's phase 3 entry and its fourth success criterion both state a
premise the code refutes, and correcting them is /cad-plan's or /cad-phase's
call, not this file's.

Deferred: None.

Plan shape: multiple plans, same phase. The deletion, the `unset` seam, the
interview and the docs/test sweep are separable with a natural order; phase 2
landed as one plan of seven tasks and this is visibly larger.

## Durable decisions

- D-01 (orphan grids): The three non-cell grids keyed on the level -
  `review`, `verify`, and `tiers`/`efforts` - are answered by real defaults in
  `config.schema.json`, on the keys that today sit at `null` meaning "the stakes
  level decides". With `cells` and `model_aliases` gone too, `route-table.json`
  holds nothing but `rung_order` and is deleted. Evidence:
  `cadence-core/route-table.json:53-75` keys `review`, `tiers`, `efforts` and
  `verify` on `solo|shipped|critical`; `cadence-core/bin/route.mjs:997-1003`
  reads `TABLE.review[stakes]` and `TABLE.verify[stakes]` and returns
  `unresolved` when either is missing; `:1260-1266` indexes the same level for
  `levelRow('tiers')` and `levelRow('efforts')`. The thirteen questions cover
  roles only - none asks about a gate, the deep-verify pass or a reviewer tier -
  so without this the grids have no answer at all. Keeping one level-free
  defaults row in `route-table.json` was the alternative and it leaves defaults
  in two places for one surviving row. Growing the interview past thirteen was
  the other and it breaks the count the roadmap and REQUIREMENTS both state.
  If wrong: `route.mjs resolve` returns `{ok:false, reason:"unresolved"}` for
  every role on every dispatch, and `workflows/plan.md:61`,
  `workflows/verify.md:106-127` and `references/review-triggers.md:38-55`
  degrade together.
- D-02 (risk floor): A detected risk surface makes the plan review blocking and
  turns the deep-verify pass on, and leaves every role's model and effort where
  the user set them. Evidence: measured 2026-09-05 by resolving
  `--role cad-executor --phase 1` over a hermetic repo whose one plan declares a
  file matching `destructive`. With `stakes` unset the resolve moved
  `solo -> shipped` and returned `model: opus` (from `sonnet`), `effort: high`
  (unchanged), `review.plan: blocking` (from `advisory`), `review.diff: off`
  (UNCHANGED), `review.risk_surface: blocking` (unchanged), `verify: on` (from
  `off`). `route-table.json:54-56` has `diff` off at both `solo` and `shipped`
  and blocking only at `critical`, and `route.mjs:191` pins
  `RAISE_TARGET = 'shipped'`, so the raise cannot reach the level where `diff`
  changes. THIS REFUTES the roadmap's phase 3 entry, which states "the diff
  review becomes blocking and nothing else moves, because ... the diff gate is
  the only thing the old floor added", and its fourth success criterion, which
  states the same. Both are wrong on both halves and need correcting outside
  this file. Shipping the roadmap's stated default was the alternative: it is a
  new behaviour rather than a preserved one, and every project relying on the
  raise silently loses its blocking plan review and its deep-verify pass. The
  model swap is deliberately NOT preserved - under this cycle the model is the
  user's own typed string.
- D-03 (D-04 retired): Phase 2's D-04 - a roles-block `effort` clamped up by a
  raised risk floor - retires with this phase. Evidence: D-02 leaves model and
  effort untouched by the floor, so there is no raise left to clamp against;
  `route.mjs:1009-1046` gates the clamp on a raise rather than on a floor being
  computed, so the arm becomes unreachable rather than merely unused.
  `cadence-core/references/config-reach.md:114-119`'s "floored by any detected
  risk surface" clause is false after this and is part of the prose sweep.
- D-04 (unknown model): A `roles.<role>.model` the host does not accept
  dispatches the resolved rung agent with the model parameter OMITTED, and adds
  the `warnings[]` entry naming the rejected string. Evidence: phase 2's D-02
  stood down onto "the routed cell's model" (`route.mjs:1404-1445`, where
  `let modelSource = 'cell'` and both unknown-value arms fall back to
  `cell.model`), and this phase deletes the cell, so that fallback names an
  object that no longer exists. Refusing with `ok:false` was rejected in phase 2
  on the evidence that the caller contract turns it into a dispatch of the base
  agent at the session default. A named constant in `route.mjs` was rejected
  here: it reintroduces the last hand-copied model name the cycle set out to
  delete. OPEN FOR THE PLANNER: whether the rung agent files carry their own
  `model:` line, which decides what the host actually falls back to - verify
  before task 1.
- D-05 (model_source on the record): `model_source`'s `cell` token is replaced,
  and the field joins the `routing.resolve` trace event. Evidence: measured
  2026-09-05 over `.planning/trace.jsonl` (3,522 lines, 0 parse failures, 921
  `routing.resolve` events): 921 of 921 carry a `stakes` string (`shipped` 747,
  `critical` 166, `solo` 8) and 0 of 921 carry `model_source`. The event body at
  `route.mjs:1458-1471` lists `stakes`, `agent`, `model`, `effort`, `escalated`,
  `pinned`, `attempt` and no `model_source`; the envelope emits it at `:1501`
  and `references/seam-spawn-agent.md:323-326` documents the `cell` string.
  Dropping `stakes` from the event without adding `model_source` leaves the
  record with no field naming what decided a dispatch, and
  `bin/planning/trace.mjs:430-452` plus `lib/trace-suggest.mjs:180-185` would
  render "the stakes level (X) decides it" off historical rows only.
- D-06 (migration write path): `config.mjs` grows `unset <key> [--global]`, and
  `stakes` gets a `retired-keys.mjs` entry naming the roles block. Evidence:
  `config.mjs:5-16` declares the whole surface as
  `validate | check | set | get | keys` - there is no way to remove a key, and
  `workflows/config.md:100-101` forbids the alternative ("Never write config
  JSON by hand; go through the seam"). Measured 2026-09-05: a file with an
  unknown top-level key fails `validate` with `"unknown key"` and exit 1 while
  `set`, `get` and `route.mjs resolve` all keep working and preserve the key;
  a config carrying the already-retired `risk.override.auth` still fails
  `validate` the same way, so retirement alone does NOT satisfy "the key is gone
  from the file afterwards". Both halves are needed: `unset` makes the criterion
  true, the retirement entry gives a config that skipped the migration a message
  naming its replacement instead of `"unknown key"`. Cost: `retired-keys.mjs` is
  sha256-pinned byte-for-byte at `retired-keys.test.mjs:15-47`
  (`a9b330531fb0ce70a51879c0ca39a582de9616c9004ffa4085d8efeb49429c8a`), so the
  baseline is re-cut in the same commit.
- D-09 (interview home): The interview is a `--roles` arm of `/cad-config`,
  beside `--review` and `--surfaces`, and the twelve `roles.*` keys gain catalog
  rows so the plain walk reaches them. Evidence: `workflows/config.md:30-36`
  excludes the six `model.overrides` pins and six `model.effort` rungs from the
  catalog for one stated reason - "which override a decision the routing cells
  otherwise make" - and this phase deletes the cells, so the exclusion's reason
  dies with them; `workflows/config.md:195-259` is the `--surfaces` interview
  precedent this arm reuses. The roadmap says "on demand as its own command",
  which reads literally as a new `skills/<name>/SKILL.md`; that was rejected on
  cost - the full registration set spans `references/COMMANDS.md`, `README.md`,
  `docs/EXAMPLE.md`, `skills/cad-help/SKILL.md`, `.planning/DOCS-CLAIMS.md` and
  a `weight-budgets.json` byte row, every one of them self-verify-enforced, for
  a surface `/cad-config` already owns.
- D-12 (waiver key): `review.triggers.risk_surface.waive_routing_floor`
  survives with its meaning re-pointed - naming a surface there stops that
  surface making the plan review blocking and turning the deep-verify pass on.
  Evidence: `route.mjs:220` (`WAIVER_KEY`), `:524-541` (`waivedSurfaces`),
  `:768-784` and `:866-870`; `config.schema.json:106` defines it as "Which
  surfaces may NOT raise this project's plan-time ROUTING floor ... it waives a
  LEVEL, never a review", which is false the moment the level is gone.
  Retiring it outright was the alternative and it costs the same sha256
  re-baseline as `stakes` while removing per-surface granularity from anyone
  using it; leaving it untouched is the resolved-then-dropped shape this repo
  has closed twice (`CFG-01`, `CFG-02`).

## Decisions

- D-07 (dead retirement pointer): `model.profile`'s retirement entry is
  re-pointed at the roles block. Evidence: `lib/retired-keys.mjs:38-42` holds
  `'model.profile': { replacement: 'stakes', ... }` and `:174-176` renders it as
  `use "stakes" instead`, so after this phase a user hitting the `model.profile`
  refusal is told to set a key `config.mjs set` then refuses as unknown. Rides
  the same sha256 re-baseline D-06 already pays for.
- D-08 (silently disabled checks): Removing `stakes` from the schema DISABLES
  three self-verify checks rather than failing them, so they must be re-keyed or
  deleted deliberately. Evidence: `self-verify.mjs:1108-1140` feeds
  `schema.stakes.values` in as `levels` to `cellIssues`, `vocabularyIssues` and
  `gateAgreementIssues`; `lib/route-cells.mjs:213-222` gates every check on
  `if (levels.length && ...)` and iterates `for (const level of levels)`;
  `lib/gate-agreement.mjs:132` returns an empty issue list outright on
  `!levels.length`. Left alone, self-verify reports `routing-cells` and
  `gate-agreement` green while checking nothing.
- D-10 (question mechanics): Thirteen questions cost four `AskUserQuestion`
  calls, and the effort question exceeds the option cap. Evidence:
  `references/seam-ask-user.md:8-13` - "at most four options per question ... the
  questions batch at most four per call. Two caps, not one." Effort is six
  values after phase 1 (`low, medium, high, xhigh, max, null`,
  `config.schema.json:33-38`), so it takes the show-three-plus-`Other` rule
  `workflows/config.md:63-68` already states for `review.triggers.<t>.gate`.
- D-11 (no new write machinery): The interview needs no new write path.
  Evidence: measured 2026-09-05 in a hermetic tree with `CADENCE_GLOBAL_CONFIG`
  relocated - `config.mjs set --global roles.cad-planner.model=opus
  roles.cad-planner.effort=xhigh` returned `ok:true` naming the global file and
  wrote a nested `roles` block there; the same `set` with no flag wrote only
  `.planning/config.json`. `config.mjs:494-500` short-circuits `--global` to
  `GLOBAL_CONFIG`. The file on disk is what answers "which layer received the
  write".
- D-13 (blast radius): The code footprint is 18 prose surfaces (matching the
  roadmap) but 15 non-test `.mjs` files, not 13, and 8 of those 15 mention the
  level in a COMMENT rather than reading the key. Evidence: measured 2026-09-05.
  Functional readers: `route.mjs`, `config.mjs:467-471`,
  `self-verify.mjs:1108-1140`, `lib/route-cells.mjs`,
  `lib/gate-agreement.mjs:150-243`, `bin/planning/trace.mjs:430-452`,
  `lib/trace-suggest.mjs:180-185`. Comment-only: `lib/arg-contract.mjs:882`,
  `lib/close-decision.mjs:111`, `lib/plan-key.mjs:12`,
  `lib/risk-diff.mjs:35,113`, `lib/phase-plans.mjs:25,110,266`, and all five
  hits in `bin/planning/risk-check.mjs`. A verify step written as
  `grep -c stakes` therefore reports failure on lines that were never the
  target - the shape of phase 1's recorded `\b19\b` deviation. Nine more tracked
  prose files carry the word outside `cadence-core/` and `skills/`: `README.md`,
  `METHOD.md`, `INTERNALS.md`, `DESIGN.md`, `CHANGELOG.md`, `docs/WORKFLOW.md`,
  `docs/rationale/plan.md`, `docs/rationale/verify.md`,
  `design-notes/design-reversals-2026-07-17.md`.
- D-14 (replay deletes cleanly): `route.mjs replay` has no prose caller and
  orphans no shared helper. Evidence: a whole-tree `git grep replay` outside
  `.planning` finds no workflow or SKILL invocation; the live references are the
  CONTRACTS row at `lib/arg-contract.mjs:1304-1311`, the implementation at
  `route.mjs:1534-1594`, and comments in `lib/phase-plans.mjs:19,256`,
  `lib/why-corpus.mjs:212` and `lib/task-record.mjs:44`. `phaseDirsIn` keeps a
  live consumer at `lib/why-corpus.mjs:173` and `declaredFilesIn` is still
  called at `lib/phase-plans.mjs:336,350`. [corrected by plan-1 deviation: `route.mjs
  replay` DID have a prose caller - `references/seam-spawn-agent.md:251` named
  the subcommand, which the evidence missed by searching only for a workflow or
  SKILL invocation and never covering `references/`]
- D-15 (test rewrite): Three test files are rewritten in-phase, and one of them
  throws before any assertion if the schema key goes first. Evidence:
  `prose-agreement.test.mjs:109-168` asserts the README literally contains
  "leaving `stakes` unset is what lets a phase touching none of them route below
  the old default" and reads `config.schema.json`'s `keys.stakes.default` at
  `:154-155`; `route.test.mjs:82-132` is the hand-typed 18-cell `CELLS` fixture
  phase 2's D-08 pinned, each row keyed on `stakes:` and driven by
  `cfg({ stakes: c.stakes, escalate_on_failure: true })` at `:120`, so the grid,
  the level and the retry rung all leave together. `route.test.mjs` carries 246
  `stakes` matches and `config.test.mjs` 99.
- D-16 (floor reach unchanged): The floor still cannot reach `cad-planner` or
  `cad-assumptions-analyzer`, so two of the six roles the interview configures
  are unaffected by the floor question whatever it does. Evidence:
  `route.mjs:229` (`PRE_PLAN_ROLES`), `:602-604` returns `notComputed` for them;
  `references/config-reach.md:114-115,126-127` state "no floor reaches it
  (pre-plan role, dispatched before the PLAN the floor reads)".
- D-17 (docs ledger): `.planning/DOCS-CLAIMS.md`'s level-keyed rows are
  REWRITTEN in this phase, not marked stale for a later sweep. Evidence: at
  least ten rows are marked `accurate` and keyed on the level, including
  `README-17` (line 536), `METHOD-46` (616), `INTERNALS-08` (660), `CONFIG-10`
  (749), `CONFIG-14` (753), `VERIFY-16` (1032) and `VERIFY-20` (1036). The nine
  prose files behind them are being edited anyway (D-13), so the ledger would
  otherwise state something false about HEAD for the length of the cycle.

## Acceptance criteria

- [ ] AC1: On a config with no `stakes` key and no `roles` block,
      `node cadence-core/bin/route.mjs resolve --role cad-executor` returns
      `ok:true` carrying `model`, `effort`, `review`, `verify`, `reviewer_tiers`
      and `reviewer_efforts`, and the envelope has no `stakes` field.
- [ ] AC2: A config still carrying `stakes` meets the migration on the next
      command - the level's values are shown as explicit per-role values,
      confirmed, and `stakes` is absent from the file afterwards. A config with
      no `stakes` key never sees the migration. (human-verify: needs an
      interactive session - the AskUserQuestion seam cannot be driven by a
      script)
- [ ] AC3: `node cadence-core/bin/config.mjs unset stakes` removes the key from
      `.planning/config.json`, `--global` removes it from the user-global file,
      and `unset` on a key the file does not hold returns `ok:true` and changes
      no bytes.
- [ ] AC4: `/cad-config --roles` asks thirteen questions, every one with a
      default, and writes to the global layer on a first run and the repo layer
      for a per-project adjustment. Which file received the write is checkable
      on disk. (human-verify: needs an interactive session)
- [ ] AC5: A plan touching a risk surface makes the plan review blocking and
      `verify` on, leaves every role's model and effort at their configured
      values, and names the surface in `reason`. Naming that surface in
      `review.triggers.risk_surface.waive_routing_floor` withholds both.
- [ ] AC6: `node cadence-core/bin/self-verify.mjs` reports `ok:true`;
      `config.schema.json` carries no `stakes`, no `model_aliases` and no
      `model.overrides.*` enum; `route-table.json` does not exist; and a seeded
      fault in the shipped review defaults is reported rather than passing
      green.
- [ ] AC7: A `roles.<role>.model` the host does not accept resolves `ok:true`,
      dispatches with no model override, adds a `warnings[]` entry naming the
      string, and the `routing.resolve` trace event carries `model_source`.

## Flagged assumptions

- The host's agent-dispatch `model` parameter accepts exactly `sonnet`, `opus`,
  `haiku` and `fable` - Confident for this host version, verified 2026-09-04
  against the live tool schema. This phase deletes `model_aliases`, the only
  in-repo copy of that list, so nothing under `/code/cadence` can answer it
  afterwards. If wrong, or once a host release widens it, the interview's
  offered model options are stale and D-04's warn-and-stand arm fires on names
  the host would in fact have accepted. Re-verify against the live tool schema
  at plan time.
- Whether a Claude Code `AskUserQuestion` free-type `Other` answer round-trips a
  model identifier unmodified - Unclear. `references/seam-ask-user.md:8-14`
  documents the option and batch caps but says nothing about the free-type
  value's fidelity, and with the enum gone the typed string goes straight into
  config. If wrong, the interview writes a mangled model name that resolves
  through D-04's warn-and-stand arm and the user is never told their answer was
  altered.
- Whether the rung agent files under `agents/` carry their own `model:` line -
  Unclear, and it decides what the host actually falls back to under D-04. Check
  before task 1.
