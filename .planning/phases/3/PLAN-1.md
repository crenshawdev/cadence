---
phase: 3
plan: 1
requirements:
  - ROL-02
files:
  - cadence-core/config.schema.json
  - cadence-core/bin/route.mjs
  - cadence-core/bin/route.test.mjs
  - cadence-core/bin/lib/rung-agent.mjs
  - cadence-core/bin/rung-agent.test.mjs
  - cadence-core/bin/lib/gate-agreement.mjs
  - cadence-core/bin/gate-agreement.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/config.mjs
  - cadence-core/bin/config.test.mjs
  - cadence-core/bin/config-seams.test.mjs
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/lib/test-seam.mjs
  - cadence-core/bin/planning/trace.mjs
  - cadence-core/bin/planning/core.mjs
  - cadence-core/bin/lib/trace-suggest.mjs
  - cadence-core/bin/trace-suggest.test.mjs
  - cadence-core/references/review-triggers.md
  - cadence-core/bin/arg-contract.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/planning-lease-check.test.mjs
  - cadence-core/bin/phase-spelling.test.mjs
  - cadence-core/references/seam-spawn-agent.md
  - cadence-core/bin/reason-census.test.mjs
---

# Phase 3: The stakes key is gone and an interview replaces it - Plan 1 of 3

Sequential plans. This plan runs FIRST; PLAN-2 and PLAN-3 share declared paths
with it (`config.schema.json`, `config.mjs`, `config.test.mjs`,
`config-seams.test.mjs`, `self-verify.mjs`, `self-verify.test.mjs`,
`prose-agreement.test.mjs`, `lib/arg-contract.mjs`, `review-triggers.md`) and
must not start until this plan's last task has committed.

## Goal

`route.mjs resolve` answers every field of the bundle without a stakes level:
model and effort from the roles block and the schema's own per-role defaults,
gates, tiers and efforts from real schema defaults, and the plan gate and the
deep-verify switch from a risk floor that does exactly two things - so that by
the end of this plan `route-table.json` is a file nothing in the resolver reads.

## Must be true when done

- On a config with no `stakes` key and no `roles` block,
  `node cadence-core/bin/route.mjs resolve --role cad-executor` returns
  `ok:true` carrying `model: null`, `model_source: "session"`, the role's
  schema-default `effort` and that rung's `agent`, plus `review`, `verify`,
  `reviewer_tiers` and `reviewer_efforts`, and the envelope has no `stakes`
  and no `stakes_set` field.
- A phase whose one plan declares a file touching a risk surface resolves
  `review.plan: "blocking"` and `verify: "on"`, leaves every role's `model` and
  `effort` exactly what the same role resolves on a clean phase, and names the
  surface in `reason`; naming that surface in
  `review.triggers.risk_surface.waive_routing_floor` withholds both.
- A `roles.<role>.model` outside the four names the host accepts resolves
  `ok:true`, `model: null`, `model_source: "session"`, a `warnings[]` entry
  naming the string, and the `routing.resolve` trace event carries
  `model_source` and no `stakes`.
- `node cadence-core/bin/config.mjs get review.triggers.plan.gate` on a config
  setting no gate answers `"advisory"` with no warning about a level, and a
  schema whose `review.triggers.plan.gate` default is `null` or outside its
  `values`, or whose purpose names a different gate, makes
  `node cadence-core/bin/self-verify.mjs` report it rather than pass green.
- With `model.escalate_on_failure: true`, `--attempt 2` resolves one rung above
  the rung the first attempt started at and `escalated: true`; at `max` the
  rung is held and `escalated` stays false.
- `git grep -n "route-table" cadence-core/bin/route.mjs` prints nothing, and
  the whole suite plus `npx tsc -p tsconfig.ci.json` are green after every task.

## Context

Locked by `.planning/phases/3/CONTEXT.md`: D-01 (the review, verify, tiers and
efforts grids are answered by real defaults in `config.schema.json`, and
`route-table.json` is deleted), D-02 (a detected surface makes the plan review
blocking and turns the deep-verify pass on, nothing else moves), D-03 (the
raised-floor rung clamp retires), D-04 (an unaccepted model string dispatches
with the model parameter omitted and a warning), D-05 (`model_source` replaces
`cell` and joins the trace event; `stakes` leaves it), D-12 (the waiver key
survives, re-pointed), D-14 (`replay` deletes cleanly), D-15 (the three test
files are rewritten in-phase, in an order that keeps the suite green), D-16
(the floor still does not reach the two pre-plan roles). The planner's
choices this plan fixes - which row the defaults come from, `model: null` as
the no-parameter answer, where the host vocabulary lives, what `--attempt 2`
climbs to, that an unread scope raises - are stated in the Notes and bind the
executor. Out of this plan: the `stakes` schema row and its retirement, the
`unset` subcommand, `self-verify`'s check 8, the deletion of
`route-table.json` itself, every prose surface (PLAN-2 and PLAN-3).

## Tasks

### Task 1: The rung ladder has one statement, beside the map it orders

- **Files:** cadence-core/bin/lib/rung-agent.mjs, cadence-core/bin/rung-agent.test.mjs
- **Action:** Export a frozen array from `lib/rung-agent.mjs` beside
  `RUNG_FILES` carrying the five rungs weakest-first - `low`, `medium`, `high`,
  `xhigh`, `max` - which is the order `route-table.json`'s `rung_order` states
  today and the order the file's own header comment already says `rungFiles`
  returns. Planner's choice, recorded here: call it `RUNG_ORDER`; PLAN-2 and
  the later tasks of this plan import it by that name. Leave
  `effortEnumIssues(schema, rungOrder)`'s signature alone - the caller still
  hands the ladder in, so self-verify and a test can pass a drifted one - but
  reword the two detail strings that say "route-table.json's rung_order" to
  name the rung ladder, because that file is deleted in PLAN-2 and a detail
  pointing a maintainer at a file that does not exist is worse than none.
  Add a guard that `RUNG_FILES` and `RUNG_ORDER` agree: every role's rung keys
  are exactly `RUNG_ORDER` in that order - the two exports are the two halves
  of one statement and nothing else holds them together once the table is
  gone. In `rung-agent.test.mjs`, the `rungOrder` the tests read off
  `cadence-core/route-table.json` becomes the export, and the detail-string
  expectations follow the reword. Add cases: the export is exactly the five
  rungs; a role whose map drops a rung or reorders one is reported by the new
  guard.
- **Verify:** `node --test cadence-core/bin/rung-agent.test.mjs` passes with the
  new cases; `node -e "import('./cadence-core/bin/lib/rung-agent.mjs').then(m=>console.log(JSON.stringify(m.RUNG_ORDER)))"`
  prints `["low","medium","high","xhigh","max"]`;
  `grep -c "route-table" cadence-core/bin/lib/rung-agent.mjs` prints `0`;
  `node cadence-core/bin/self-verify.mjs` reports `ok: true`.

### Task 2: Review gates, tiers and efforts carry real defaults, and self-verify checks them as defaults rather than as grid agreement

- **Files:** cadence-core/config.schema.json, cadence-core/bin/lib/gate-agreement.mjs,
  cadence-core/bin/gate-agreement.test.mjs, cadence-core/bin/self-verify.mjs,
  cadence-core/bin/self-verify.test.mjs, cadence-core/bin/config.mjs,
  cadence-core/bin/config.test.mjs, cadence-core/bin/prose-agreement.test.mjs
- **Action:** In `config.schema.json`, move the twelve
  `review.triggers.<t>.gate`, `.tier` and `.effort` rows off the `null`
  sentinel onto real defaults (D-01). The row they come from is the one a
  template-initialised project resolves at today when its plans read clean,
  which is `route-table.json`'s `solo` row (D-02's measured baseline was an
  unset `stakes`, which floors there): gates `plan` advisory, `diff` off,
  `risk_surface` blocking, `phase_diff` off; tiers `cheap` for all four; efforts
  `plan` low, `diff` minimal, `risk_surface` low, `phase_diff` low. Rewrite each
  purpose to state the default and what setting the key does; every
  `<gate> at <level>` clause goes, because there is no level. Keep
  `risk_surface.gate`'s sentence about why it is blocking. Then re-key
  `gateAgreementIssues` in `lib/gate-agreement.mjs` (D-08 - deleting `stakes`
  later would otherwise return this check empty on `!levels.length`): it takes
  the schema `keys` map alone, walks every `review.triggers.<t>.gate`, `.tier`
  and `.effort` row (triggers from `gateTriggers`, which already derives them
  from the key names), and holds two mandatory halves per row. Default half:
  `default` must be a non-null member of that row's own `values` - `null` is
  no longer exempt, since with no level to fall back to a null default is a
  value the resolver cannot answer - filed under `gate-default-invalid`. Prose
  half: the `purpose` must name the default in a clause whose grammar the
  lib's doc comment states and the test pins; a purpose naming a different
  member of `values` files `gate-prose-drift`, one naming none files
  `gate-prose-missing`. `gate-default-drift` and `gate-grid-missing` retire
  with the grid; `gate-row-malformed` stays. Nothing short-circuits: a row
  with both faults reports both. In `self-verify.mjs`, call the re-keyed lib
  OUTSIDE the `existsSync(routeTablePath)` block (the table goes in PLAN-2 and
  this check must keep running on a tree without one), still filed against
  `cadence-core/config.schema.json`, and keep `gate-agreement` in the
  `checked` string; leave the table block itself for PLAN-2. In `config.mjs`,
  delete `LEVEL_KEY`, `LEVEL_KEY_NOUN` and the "so the stakes level decides
  it" warning in `get`: a key with a real default is answered the way every
  other defaulted key is, and a warning saying a level decides beside a value
  that is the answer is a contradiction; leave the `k === 'stakes'` arm for
  PLAN-2. Rewrite `gate-agreement.test.mjs` for the new codes and the pinned
  clause grammar (an agreeing schema is clean; a null default, a default
  outside `values`, a purpose naming another member, a purpose naming none,
  a malformed row - each reported by name; a row with two faults reports two).
  Rewrite `self-verify.test.mjs`'s check 18 section so its fixture schema
  carries real defaults and no `review` grid, with one seeded-fault case per
  code. In `config.test.mjs`, the `GAT-02` and `RVW-03` sections now assert an
  unset gate, tier or effort reads as the schema default with no warning, and
  keep every other discrimination those sections make. In
  `prose-agreement.test.mjs`, re-key `DFC-02` whole onto its level-free form:
  the `phase_diff` purpose names the default, and a resolve on a config
  setting no gate answers `review.phase_diff` equal to that default. That
  holds at this commit by value - the resolver's default row fires `off` for
  `phase_diff` too - and Task 3 makes it hold by construction. Transitional, and stated so the executor does not chase it: until Task 3
  lands, `config.mjs get` answers `advisory` for an unset plan gate while
  `route.mjs` still fires the `shipped` row's `blocking`; Task 3 closes that
  window.
- **Verify:** `node cadence-core/bin/config.mjs get review.triggers.plan.gate review.triggers.diff.tier review.triggers.phase_diff.effort`
  on a scratch config setting none of them answers `"advisory"`, `"cheap"`,
  `"low"` and carries no `warnings`; `node --test cadence-core/bin/gate-agreement.test.mjs cadence-core/bin/config.test.mjs cadence-core/bin/self-verify.test.mjs`
  pass; `node cadence-core/bin/self-verify.mjs` reports `ok: true`, and the
  same run against a copy of the tree (`--root`) whose
  `review.triggers.plan.gate` default is `"adivsory"` reports
  `gate-default-invalid` naming that key, and whose default is `null`
  reports the same code; `node --test cadence-core/bin/prose-agreement.test.mjs`
  passes.

### Task 3: Gates, tiers, efforts and the deep-verify switch answer from the schema and a two-effect floor; the level stops moving

- **Files:** cadence-core/bin/route.mjs, cadence-core/bin/route.test.mjs,
  cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/prose-agreement.test.mjs,
  cadence-core/bin/config-seams.test.mjs, cadence-core/references/review-triggers.md
- **Action:** `route.mjs` reads `config.schema.json` - resolved beside `HERE`
  the way `TABLE_PATH` is today, with `CADENCE_CONFIG_SCHEMA` honoured only
  under `testSeamOpen()`, the exact shape `config.mjs`'s `SCHEMA_PATH` already
  has - and an unreadable schema is `fail('bad-schema', ...)`. The rule in
  `route-table.json`'s `_meta` that route.mjs never reads the schema existed to
  stop a schema default being reported as a user assertion; D-01 puts the
  defaults there and nowhere else, so the reason is gone with the sentinel.
  For every trigger the schema defines a `.gate` for (import `gateTriggers`
  from `lib/gate-agreement.mjs` - one derivation, not a second list),
  `review[trigger]` is the configured gate when a layer set one that is a
  member of that key's `values` (a non-member warns and the default stands,
  the existing unknown-gate arm's shape), otherwise the key's schema default,
  and `reason` says which. `reviewer_tiers` and `reviewer_efforts` resolve the
  same way off their keys, and the `tierFrom` string names the schema default
  instead of a table row. `DEFAULT_GATES`, `DEFAULT_TIER_NAMES` and
  `DEFAULT_EFFORT_NAMES` go - the vocabularies are the schema enums and the
  schema is fatal when unreadable. Rewrite `riskFloor` and `levelFor` (D-02,
  D-03, D-12, D-16): they return raised-or-not with the surface, signal, file
  and bytes, and no level - `UNSET_FLOOR`, `RAISE_TARGET`, `stakesOrder` and
  `higherLevel` are deleted. The floor is raised when a non-waived surface hit
  is found in the scope, or when the scope was not read clean - a plan that
  declares no files, a declared file that went unread, no plan found at all -
  which is the fail-closed rule `lib/phase-plans.mjs` already states for CER-01
  (an unreadable plan may never lower what fires); `reason` distinguishes a
  hit from an unread scope. `PRE_PLAN_ROLES` are not computed and not raised,
  and `reason` says so (D-16). Effects when raised, and only these two:
  `review.plan` becomes `blocking` when no VALID configured gate won
  resolution for `review.triggers.plan.gate` and the answer sits below
  `blocking` in that key's declared `values` order (a configured plan gate
  stands ONLY when its value is one of that key's declared `values`; a layer
  holding an out-of-enum string never won resolution, so it does not suppress
  the raise - test the ANSWER's validity, never the key's presence, or a
  hand-edited typo leaves a detected risk surface on an advisory plan review
  against AC5. This is the config-wins precedence `review-triggers.md` states,
  and `reason` says the floor did not move a pinned gate, naming the invalid
  string where one was found); `verify` becomes `on`. `verify` is `off`
  whenever the floor did not raise - the deep pass is what the floor turns on
  (D-02) and `workflow.verifier` stays the off switch `workflows/verify.md`
  reads. No role's model or effort moves: delete the clamp arm and the
  rung-comparison warning that fire on `floor.raised` (D-03 - the arm is
  unreachable, not merely unused). A surface named in
  `review.triggers.risk_surface.waive_routing_floor` raises nothing and is
  named in `reason`; a surface not named still raises (D-12). Delete `replay`,
  `parseReplayArgs`, its `SYNOPSIS` arm and the `replay` row under
  `CONTRACTS['route.mjs']` in `lib/arg-contract.mjs` (D-14 - `phaseDirsIn` and
  `declaredFilesIn` keep their other callers and stay). Keep the cells lookup
  for model, effort and retry THIS task, and keep `stakes` in `readConfig`,
  the envelope and the trace event: the level now selects a cells row and
  nothing else, and Task 4 removes that too. In `route.test.mjs`, rewrite the
  sections `the review and verify grids (D-01)`, `the gate-enum hole (AC6)`,
  `phase_diff resolves the same through all three surfaces`, `D-03: deferred
  is reachable by a CONFIG-SET gate only`, `what a TEMPLATE-INITIALISED
  project actually resolves to (RNG-04)` and every floor section from `the
  plan-time risk floor (CER-01)` through `a detected surface floors the
  configured rung too (D-08)`, using the existing `floorRoot`, `waiverFx` and
  `clampFx` fixture builders: a hit raises the two effects and nothing else,
  an unread or undeclared scope raises, a pre-plan role is exempt, `--plan`
  scopes to one plan, the waiver withholds both effects and is named, a
  configured `low` rung on a floored phase stays `low` and `reason` says the
  floor moved no rung. Delete the `replay:` section. Add: a schema injected
  through `CADENCE_CONFIG_SCHEMA` under `CADENCE_TEST_SEAM=1` whose plan-gate
  default is `deferred` resolves `review.plan: "deferred"` (the schema is
  read, not remembered), and the same env without the sentinel is ignored. In
  `prose-agreement.test.mjs`, delete the `RNG-04` README arm - the discount it
  measured no longer exists; `DFC-02` is already level-free after Task 2,
  and where it or any other arm pins a per-level statement in
  `review-triggers.md`, rewrite that statement level-free in the same commit
  (the pin asserts agreement, not the old words). In `config-seams.test.mjs`, the floor test
  with `stakes: solo` and a declared auth file asserts
  `review.plan === 'blocking'`, `verify === 'on'`, and `model` and `effort`
  equal to the same role resolved on a clean fixture.
- **Verify:** `node --test cadence-core/bin/route.test.mjs` passes, including
  a `floorRoot` fixture whose one plan declares a file whose body matches the
  `destructive` surface resolving `review.plan: "blocking"`, `verify: "on"`,
  `model` and `effort` equal to a clean-fixture resolve of the same role, and
  a `reason` entry containing `destructive`; the same fixture with
  `waive_routing_floor: ["destructive"]` resolving `review.plan: "advisory"`
  and `verify: "off"`; `node cadence-core/bin/route.mjs replay` returns
  `ok:false` with `reason: "usage"`; `node --test cadence-core/bin/prose-agreement.test.mjs cadence-core/bin/config-seams.test.mjs`
  pass; `node cadence-core/bin/self-verify.mjs` reports `ok: true`.

### Task 4: Model and effort come from the roles block and the schema; the cells, the alias list and the level leave the resolver

- **Files:** cadence-core/config.schema.json, cadence-core/bin/route.mjs,
  cadence-core/bin/route.test.mjs, cadence-core/bin/lib/rung-agent.mjs,
  cadence-core/bin/rung-agent.test.mjs, cadence-core/bin/config-seams.test.mjs
- **Action:** In `config.schema.json`: the six `roles.<role>.effort` defaults
  become the rung a template-initialised project starts that role at today,
  the `solo` row - planner `high`, assumptions-analyzer `high`, verifier
  `high`, reviewer `medium`, executor `high`, plan-checker `low` - with `null`
  kept in `values` as the way a repo layer un-pins a global one; purposes lose
  the cell and the clamp (D-03). `roles.<role>.model` keeps `default: null`
  and its purpose now says null means NO model parameter is sent - the
  dispatch runs at the session's model - and that a string the host does not
  accept is named in `warnings[]` and the parameter is omitted (D-04). The six
  `model.overrides.<role>` rows become `string_or_null` with `default: null`
  (the alias enum is the thing this phase deletes; `roles.<role>.model` is
  already that type), their purposes rewritten as the narrower fallback under
  `roles.<role>.model` with the same unaccepted-string behaviour; the six
  `model.effort.<role>` purposes lose "its routing cell" and become the
  fallback under `roles.<role>.effort`. `model.escalate_on_failure`'s purpose:
  a failed attempt re-dispatches one rung above the rung it started at,
  holding at the top rung. In `lib/rung-agent.mjs`, `effortEnumIssues` also
  files a drift code when a `roles.<role>.effort` row's `default` is not one
  of that role's rungs - a null default would hand `agentFor` no rung and it
  would dispatch the base file in silence - while `model.effort.<role>`
  defaults stay exempt (null is their legitimate fall-through). In
  `route.mjs`: the routable roles are `Object.keys(RUNG_FILES)`; effort is
  `roles.<role>.effort`, else `model.effort.<role>`, else the schema default,
  with the winner named in `reason` the way the existing arms name it and the
  both-keys-set warning kept; a value naming no rung of the role warns and
  the next source down answers; `agent` is `rungFile(role, effort)`. Model is
  `roles.<role>.model`, else `model.overrides.<role>`, else `null`, judged
  against a frozen constant in `route.mjs` holding the four names the host's
  dispatch parameter accepts - `opus`, `sonnet`, `haiku`, `fable`, verified
  2026-09-04 - with a comment saying it is the host's enum, when it was
  verified, and that it is the one in-repo copy once `model_aliases` goes; it
  names no default and is not the fallback D-04 rejected. A string outside it
  resolves `model: null`, a `warnings[]` entry naming the string and its key,
  and `model_source: "session"`; an accepted roles string sets `model_source`
  to `roles.<role>.model`, an accepted pin to `model.overrides.<role>` with
  `pinned: true`, and nothing set is `model: null`, `model_source: "session"`
  (D-05: `session` is the planner's replacement for `cell`). A rejected roles
  string does not fall through to the pin, for the reason phase 2's D-02
  fixed. Escalation: `--attempt N` above 1 with `model.escalate_on_failure`
  true climbs to the rung one above the start rung on `RUNG_ORDER`, `reason`
  names the climb and the file, `escalated` is true only when it moved, and
  at the top rung it holds with a reason; with the key false it holds with
  today's reason. `stakes`, `stakesSet` and `DEFAULTS.stakes` leave
  `readConfig`; `stakes` and `stakes_set` leave the envelope; the trace event
  drops `stakes` and gains `model_source` (D-05). After this task
  `TABLE.cells`, `TABLE.roles` and `TABLE.model_aliases` are unread. In
  `route.test.mjs`: delete the `CELLS` fixture and both per-cell sections and
  replace them with one case per role asserting the no-config resolve returns
  that role's schema-default effort, that rung's agent, `model: null` and
  `model_source: "session"`; rewrite `escalation, now unconditional` (one rung
  up, top holds), `set-ness of stakes on the envelope` (the envelope carries
  neither field), `per-role model overrides` (string fallback, `pinned`),
  `the model named outright` (wins; rejected string is `model: null` plus
  warning plus `session`; rejected string does not fall to a set pin), the
  two start-rung sections (precedence roles, then `model.effort`, then
  default), `a retry never resolves below the rung that failed` (one-up from
  the configured start), and `the routing family of the joined run record`
  (the event carries `model_source` and no `stakes`, using the existing
  `traceRoot` fixture). In `config-seams.test.mjs`, the two sections that
  held `config.mjs get` and `route.mjs resolve` to one answer for `stakes`
  across layers hold them to one answer for `roles.cad-executor.effort`
  instead.
- **Verify:** `node --test cadence-core/bin/route.test.mjs` passes, including:
  a config with no `roles` block and no `stakes` resolving `cad-executor` to
  `model: null`, `model_source: "session"`, `effort: "high"`,
  `agent: "cad-executor"` with no `stakes` key in the envelope; a config
  setting `roles.cad-planner.model` to `notamodel` resolving `ok: true`,
  `model: null`, `model_source: "session"` and a `warnings[]` entry containing
  `notamodel`, with the `traceRoot` fixture's `routing.resolve` event carrying
  `model_source` and no `stakes`; `model.escalate_on_failure: true` with
  `--attempt 2` on a role starting at `high` resolving `effort: "xhigh"`,
  `escalated: true`, and at `max` holding with `escalated: false`.
  `node --test cadence-core/bin/rung-agent.test.mjs` passes with a case where
  a `roles.cad-planner.effort` default of `null` is reported;
  `node cadence-core/bin/test.mjs routing` passes; `node cadence-core/bin/self-verify.mjs`
  reports `ok: true`.

### Task 5: The run record's consumers stop naming a level, and the suggest ladders stop reading the table

- **Files:** cadence-core/bin/planning/trace.mjs, cadence-core/bin/lib/trace-suggest.mjs,
  cadence-core/bin/trace-suggest.test.mjs, cadence-core/bin/planning/core.mjs
- **Action:** In `bin/planning/trace.mjs`, the resolution builder that walks
  `routing/resolve` events stops reading `e.stakes` and drops `stakes` from
  what it returns; in `lib/trace-suggest.mjs`, the `Resolution` typedef loses
  `stakes` and `unsetCurrent` says the schema default decides, with no level
  clause and no level interpolation - D-05's evidence is that every historical
  row carries a level the record no longer produces, so rendering it would
  name a decider that no longer decides. Leave `SUGGEST_KEY_DEFAULTS` exactly
  as it is (the `SGT-01` prose-agreement arm pins its contents against the
  schema). In `bin/planning/core.mjs`, `routeLadder` stops reading
  `route-table.json`: the gate ladder is the `values` array of the schema's
  `review.triggers.plan.gate` row, read off `config.schema.json` beside
  `HERE`, weakest-first as declared; the rung ladder is `RUNG_ORDER` from
  `lib/rung-agent.mjs`; the degraded no-ladder arm keeps its shape for an
  unreadable schema, and the `CADENCE_ROUTE_TABLE` remark in the doc comment
  goes. In `trace-suggest.test.mjs`, drop the `stakes` field from the
  `Resolution` fixtures, re-key the two assertions on the unset wording, and
  reword the two comments naming `route-table.json`'s ladder.
- **Verify:** `node cadence-core/bin/test.mjs planning` passes;
  `git grep -nw stakes -- cadence-core/bin/planning/trace.mjs cadence-core/bin/lib/trace-suggest.mjs cadence-core/bin/planning/core.mjs cadence-core/bin/trace-suggest.test.mjs`
  prints nothing; `grep -c "route-table" cadence-core/bin/planning/core.mjs`
  prints `0`.

### Task 6: route.mjs reads no table

- **Files:** cadence-core/bin/route.mjs, cadence-core/bin/route.test.mjs,
  cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/lib/test-seam.mjs
- **Action:** Delete `TABLE`, `TABLE_PATH`, the `CADENCE_ROUTE_TABLE` seam, the
  `bad-table` failure, the `table` subcommand and its `CONTRACTS['route.mjs']`
  row, and `riskCategories`. The surface vocabulary `answeredSurfaces` is
  handed is the schema's `review.triggers.risk_surface.surfaces` `values`;
  the rung ladder is `RUNG_ORDER`; every other vocabulary already comes off
  the schema after Task 3. The usage line names `resolve` alone. In
  `lib/test-seam.mjs`, the comment naming `CADENCE_ROUTE_TABLE` as a gated
  seam now names `CADENCE_CONFIG_SCHEMA` only. In `route.test.mjs`, re-key
  `shipped route-table.json absent/malformed (#40)` onto `config.schema.json`
  (absent and malformed both answer `bad-schema` with the hint naming the
  file) and `the injection is GATED behind CADENCE_TEST_SEAM (EXP-01)` onto
  `CADENCE_CONFIG_SCHEMA`; delete any remaining `opts.table` plumbing in the
  `resolve` helper.
- **Verify:** `node --test cadence-core/bin/route.test.mjs` passes;
  `git grep -n "route-table\|CADENCE_ROUTE_TABLE\|\bTABLE\b" cadence-core/bin/route.mjs`
  prints nothing; with `cadence-core/route-table.json` temporarily moved out
  of the tree, `node cadence-core/bin/route.mjs resolve --role cad-executor`
  returns `ok: true` (move it back - PLAN-2 deletes it); then the whole tree:
  `node cadence-core/bin/test.mjs` passes and `npx tsc -p tsconfig.ci.json`
  is clean.

## Notes

- Requirement id declared by this phase's plans: **ROL-02** - "The `stakes`
  key and every grid keyed on it are gone: `route.mjs resolve` answers model
  and effort from the roles block and the schema's per-role defaults, gates,
  tiers, efforts and the deep-verify pass from real schema defaults plus a
  two-effect risk floor, and a thirteen-question `/cad-config --roles`
  interview writes those keys - in full to the global layer on a first run,
  as a per-project confirmation to the repo layer after that, and as the
  migration that expands a lingering `stakes` level into per-role values and
  removes the key." `seed-reqs` will report it as an orphan until the
  coordinator opens its `## Active` bullet pointing at Phase 3; that is
  expected. All three plans declare the same id.
- Plan shape: CONTEXT asked for multiple plans and this phase needs more than
  one ceiling's worth of tasks, so it is three plans - but they are SEQUENTIAL,
  not independent: PLAN-2 and PLAN-3 share `config.schema.json`, `config.mjs`,
  `config.test.mjs`, `config-seams.test.mjs`, `self-verify.mjs`,
  `self-verify.test.mjs`, `prose-agreement.test.mjs`, `lib/arg-contract.mjs`
  and `review-triggers.md` with this one. File independence wins over the
  parallel reading of the directive; the deviation is recorded here and in the
  return marker. Execute 1, then 2, then 3.
- D-04's open item is closed: 0 of the 30 files under `agents/` carries a
  `model:` frontmatter line (measured 2026-09-05), so an omitted model
  parameter reaches the host's session default and nothing else. That is
  what `model: null` means on the envelope and in the trace event.
- Which row becomes the defaults (planner's choice under D-01): the `solo`
  row of `route-table.json`, because it is what every template-initialised
  project has resolved at since v3.5.7 when its plans read clean, and D-02's
  measured floor (plan advisory becomes blocking, verify off becomes on) is
  only observable from that row. The cross-model `tiers` and `efforts`
  defaults follow the same row and the floor does not move them; D-02's
  measured list did not include them and AC5 names only the two effects.
- `roles.<role>.model` keeps a `null` default meaning "send no model
  parameter" rather than a default model name: D-04 rejected a named
  fallback constant as "the last hand-copied model name the cycle set out to
  delete", and a schema default naming a model would be six of them. The host
  vocabulary constant Task 4 adds is a different object - the host's accepted
  enum, not a routing default - and it has to live somewhere for AC7's
  `warnings[]` entry to be producible at resolve time once `model_aliases`
  goes. The flagged assumption stands: that enum was verified against the
  live tool schema on 2026-09-04 and could not be re-verified from this seat
  (no host tool schema is readable here); the interview prose in PLAN-3 names
  the same four names.
- `--attempt 2` climbs one rung above the start (planner's choice): the cells
  grid was the only source of a retry rung and it is deleted; leaving
  `model.escalate_on_failure` inert would ship a key that does nothing, and
  retiring it would break every template-initialised config, which writes it.
  One rung up is what fourteen of the eighteen cells encoded. Flagged in the
  return marker for the human.
- An unread scope raises the floor (planner's choice): CER-01's fail-closed
  rule held an unreadable plan at the configured level, which for an unset
  `stakes` was the raised row. With no level, "held at the configured level"
  has no meaning; raising is the reading that keeps a broken plan file from
  silently dropping the blocking review and the deep pass.
- `verify` has no config key of its own after this plan: it is `on` when the
  floor raised and `off` otherwise, and `workflow.verifier` remains the off
  switch. A project that had "always on" through `stakes: shipped` reaches the
  deep pass through `--deep` or a risk hit only. Flagged in the return marker.
- `route.mjs` reads `config.schema.json` from this plan on. `bin/planning/
  trace.mjs`'s D-15 (an earlier milestone) says the schema is not parsed at
  runtime by the suggest seam; Task 5 keeps `SUGGEST_KEY_DEFAULTS` hand-copied
  as that decision requires and re-sources only the ladders, which never came
  from the schema before either.
- `.planning/config.json` in this repository carries `stakes: "critical"`,
  `model.overrides.cad-planner: "fable"` and four `model.effort.*` rungs. No
  task in any of the three plans edits it: after PLAN-2 it is the live fixture
  for AC2's human-verify, and Cadence-on-Cadence keeps resolving through the
  fallback keys until John runs the migration.
- The roadmap's phase 3 entry and its fourth success criterion state a floor
  default D-02 refutes (the diff review becoming blocking). No plan edits
  `ROADMAP.md`; the coordinator owns that correction (CONTEXT D-02).
