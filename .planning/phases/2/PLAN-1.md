---
phase: 2
plan: 1
requirements:
  - STK-01
files:
  - cadence-core/config.schema.json
  - cadence-core/templates/config.json
  - cadence-core/route-table.json
  - cadence-core/bin/lib/retired-keys.mjs
  - cadence-core/bin/retired-keys.test.mjs
  - cadence-core/bin/route.mjs
  - cadence-core/bin/route.test.mjs
  - cadence-core/bin/config.mjs
  - cadence-core/bin/config.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/workflows/config.md
  - cadence-core/workflows/plan.md
  - cadence-core/references/seams.md
  - cadence-core/references/review-triggers.md
  - skills/cad-config/SKILL.md
  - INTERNALS.md
---

# Phase 2: The stakes axis - Plan

## Goal

The routing question changes from what a dispatch costs to what it costs if it
is wrong. This is the breaking change, and the whole reason the release is
major.

## Must be true when done

- A user's config answers "what does a break cost": a bare top-level `stakes`
  key taking exactly `solo`, `shipped`, `critical`, defaulting to `shipped`.
  No `model.profile` key exists in the schema, the template, or the resolver,
  and no back-compat alias resolves one.
- Setting or checking a retired name is refused before anything is read or
  written, with a message that names its replacement rather than the generic
  `unknown key`.
- A config still holding `model.profile` is never silently ignored: both live
  read faces (`config.mjs get`, `route.mjs resolve`) emit a warning naming the
  old key and pointing at `stakes`, and route's reason string does not claim a
  configured layer for a value it never read.
- Phase 1's rung ladder is reachable out of the box: with no `stakes` key set
  anywhere, a second attempt at `cad-plan-checker` resolves the agent
  `cad-plan-checker-high` with `escalated: true`.
- No live surface still describes routing as a spend ladder - `route-table.json`,
  the config template, `INTERNALS.md`'s "Model routing" section,
  `references/seams.md`, `references/review-triggers.md` and the workflow prose
  all read as the stakes question.
- `node --test cadence-core/bin/*.test.mjs`, `npx tsc -p tsconfig.ci.json` and
  `node cadence-core/bin/self-verify.mjs` are all green, and every budgeted
  surface this plan edits has a `weight-budgets.json` entry equal to its exact
  new byte count.

## Context

CONTEXT.md decisions bind this plan: D-01 (three values `solo`/`shipped`/`critical`),
D-02 (rename to a bare top-level `stakes`, not a revalue of `model.profile`),
D-03 (`fable` stays pin-only, on the three operational facts - NOT the stale
"ranking not established" reason), D-04/D-11/D-12 (the `auto` mode, its
difficulty signals, its `ceiling` and `crossWarnings` all die;
`escalate_on_failure` is promoted and honoured unconditionally), D-05 (four
orthogonal axes - never sweep `balanced` as a regex; `review.providers.*.tiers.*`,
`tier_order` and `rung_order` are untouchable), D-06 (default `shipped` in three
places), D-07/D-08/D-09 (the write face is `checkPairs`; the read faces are
`route.mjs resolve` and `config.mjs get`, NOT `validate`), D-10 (prose writes
`stakes: critical` or backticked bare values, never `stakes.critical`), D-15
(budgets are exact-fit; regenerate in the same change), D-16 (three test files
encode the retired vocabulary and must be re-derived, not search-and-replaced).

Out of scope here: the `(stakes, role)` bundle cell (phase 3), risk-driven rung
floors (phase 4), issue #63's `base_effort` rebase (phase 3). `CHANGELOG.md` and
`DESIGN.md` belong to PLAN-2.

## Tasks

### Task 1: State the retired vocabulary once, in a lib both faces read

- **Files:** cadence-core/bin/lib/retired-keys.mjs, cadence-core/bin/retired-keys.test.mjs
- **Action:** Create `lib/retired-keys.mjs` as a zero-dep `// @ts-check` module
  following the shape of `lib/config-merge.mjs` (the existing precedent for one
  implementation shared by the read faces). Export a frozen `RETIRED_KEYS` object
  mapping each retired dotted config key to `{ replacement, detail }`:
  `model.profile` -> replacement `stakes`, detail naming the three values
  `solo, shipped, critical`; `model.auto.escalate_on_failure` -> replacement
  `model.escalate_on_failure`; `model.auto.ceiling` -> replacement `null`, detail
  saying it was removed with the `auto` mode because escalation no longer steps
  a spend ladder; `model.auto.max_escalations` -> replacement `null`, detail
  saying it was removed with the `auto` mode because a role escalates to exactly
  one rung (`escalate_to`), so there is no second step to cap. Export
  `retiredKeyError(key)` returning the write-face error string for a retired key
  and `null` otherwise - phrase it so it names its own fix, matching the
  `cannot set through "..."` precedent in `config.mjs`: for a replaced key,
  `retired in v2.0.0: use "<replacement>" instead (<detail>)`; for a removed key,
  `retired in v2.0.0: <detail>`. Export `retiredKeysIn(config)` taking a MERGED
  config object and returning one warning string per retired dotted path actually
  present in it (value-agnostic - the key's presence is the fault, per D-09),
  each naming the old key and its replacement or removal; walk each dotted path
  defensively so a scalar or array at an intermediate segment yields no match and
  no throw, and return `[]` for a null/non-object input. Do NOT derive this map
  from `config.schema.json`: a key is retired precisely because the schema no
  longer holds it, so a schema-derived list would name nothing. Do NOT import
  anything from `route-table.json` here - the file-boundary read is what made
  `crossWarnings` fire wrongly (D-12).
- **Verify:** `node --test cadence-core/bin/retired-keys.test.mjs` passes with a
  row per retired key at both faces: `retiredKeyError('model.profile')` matches
  `/use "stakes"/` and mentions all three of solo, shipped, critical;
  `retiredKeyError('model.auto.ceiling')` and
  `retiredKeyError('model.auto.max_escalations')` each name removal with no
  replacement key; `retiredKeyError('stakes')` and
  `retiredKeyError('workflow.research')` both return `null`;
  `retiredKeysIn({model:{profile:'balanced'}})` returns exactly one string
  matching `/model\.profile/` and `/stakes/`;
  `retiredKeysIn({model:{auto:{ceiling:'quality',max_escalations:1}}})` returns
  two strings; `retiredKeysIn({stakes:'shipped'})`, `retiredKeysIn({model:5})`,
  `retiredKeysIn(null)` and `retiredKeysIn([1,2])` each return `[]`.

### Task 2: Rename the axis in the schema and the template, and re-derive the tests that pin the schema

- **Files:** cadence-core/config.schema.json, cadence-core/templates/config.json, cadence-core/bin/config.test.mjs, cadence-core/bin/self-verify.test.mjs
- **Action:** In `config.schema.json`, delete the four keys `model.profile`,
  `model.auto.ceiling`, `model.auto.escalate_on_failure` and
  `model.auto.max_escalations`. Add a bare top-level `stakes` key immediately
  after `granularity` (the working precedent for a bare key, D-02):
  `{"type":"enum","values":["solo","shipped","critical"],"default":"shipped","src":"repo","purpose":...}`
  whose purpose states the question the value answers - what a break costs, not
  what a dispatch costs - and spells each value in one clause: solo = nobody else
  runs this, a break costs only my time; shipped = other people run this, a break
  comes back as a bug report; critical = a break is not a bug report. Add
  `model.escalate_on_failure` as `{"type":"bool","default":true,...}` in the
  `model` block, its purpose naming what it does now: re-dispatch a failed
  attempt at the role's `escalate_to` rung. Rewrite the `purpose` string on the
  four `model.overrides.<role>` lines (`:14-17`), which today read "bypassing the
  profile matrix (null = route normally). The only way to reach `fable`, which
  sits on no profile rung" - the bare word `profile` that AC3's grep cannot
  match, carrying the stale fable rationale D-03 retires. They must read as the
  stakes matrix, and the fable clause must give a real reason (pin-only because
  it is a user assertion, not a rung on this ladder) rather than the withdrawn
  ranking claim. `config.mjs keys` is what `workflows/config.md:127` documents as
  the source the `/cad-config` menu derives its per-key explanations from, so a
  purpose left as-is prints the retired vocabulary straight at a user whose
  config has no `profile` key anywhere. Leave every
  `review.providers.*.tiers.*` line, every `review.triggers.*.tier` line and
  every other `flagship|balanced|cheap` occurrence byte-identical - those are the
  cross-model PROVIDER tier axis, a different axis from this one (D-05). The
  schema holds 18 occurrences of the word `balanced` across 12 lines; exactly
  three of them (two on the `model.profile` line, one on the
  `model.auto.ceiling` line) belong to the axis this phase deletes, and every
  remaining one must survive the edit untouched. In
  `templates/config.json`, add `"stakes": "shipped"` as a top-level key beside
  `granularity` and replace the whole `"model"` block with
  `"model": { "escalate_on_failure": true }` - the default must read identically
  in the schema, the template and `route.mjs` DEFAULTS (D-06; `route.mjs` moves
  in task 3). In `config.test.mjs`, re-derive the assertions rather than
  search-and-replacing the string `model.profile`, which is how a test encodes a
  defect as a passing assertion (D-16): at `:212` assert
  `r.keys['stakes'].values` deep-equals `['solo','shipped','critical']` and
  `r.keys['stakes'].default === 'shipped'`, assert
  `r.keys['model.escalate_on_failure'].default === true`, and add all four
  deleted keys to that test's `gone` list so their absence is pinned. Every other
  row using `model.profile` merely needed A key: repoint each one by what it
  actually tests - a row exercising a DOTTED write path, auto-vivified parent or
  null-parent container (`:41`, `:60`, `:132`, `:162`) must use a key that is
  still dotted (`model.escalate_on_failure` or
  `model.overrides.cad-planner`), because bare `stakes` has no parent to walk and
  the row would stop testing what its name claims; the layering/get rows
  (`:227-`, `:281-`, `:296-`, `:308-`, `:323-`, `:339-`, `:410`, `:421`) may use
  bare `stakes` with values drawn from the new enum. Five further rows break on
  the schema deletion and are NOT optional repoints - each currently asserts a
  success this task makes impossible: `:27-36` (`set --global
  model.profile=quality` asserting `ok:true` and the written value) and `:51-58`
  (`set --global model.profile=nonsense` asserting `/must be one of/`) both move
  to `stakes`, the second keeping its `must be one of` assertion against the new
  enum, since a LIVE bad value must still read as a value error and not as the
  retired-key error task 4 adds; `:66-74` (the `validate --global` row whose
  fixture is `{model:{profile:'balanced'},granularity:'fine'}` asserting
  `ok:true` and `checked === 2`) must have its FIXTURE re-derived to two live
  keys (e.g. `{stakes:'shipped',granularity:'fine'}`), because D-07 deliberately
  keeps the retired-key diagnostic out of `validate`, so a fixture left holding
  the old key would take the plain `unknown key` arm and turn the row red with
  no task anywhere covering it; and `:347-365` (the absent-vs-torn-layer row)
  passes `model.profile` as the REQUESTED key to `get` three times, which now
  hits `fail('unknown-key', ...)` at `config.mjs:233` and returns `ok:false` with
  no `warnings`, so `rTorn.warnings.length` throws a TypeError - repoint all
  three `get` calls to `stakes`, keeping what the row pins (an absent layer is
  silent, a torn one warns exactly once). Also DELETE the two `crossWarnings`
  rows at `:427-445` together with their `--- cross-key warnings ---` heading in
  THIS task, not in task 4: both exercise `model.auto.ceiling` (`:429` runs
  `check model.auto.ceiling=fast` asserting `ok:true` and one warning, `:441`
  runs `set --global model.auto.ceiling=fast` asserting `ok:true` and the written
  value), so deleting the key here makes them take the `!spec` branch and report
  `ok:false` with `warnings` undefined. Task 4 deletes the crossWarnings CODE;
  the rows have to go with the key that feeds them or this task's Verify cannot
  pass. In `self-verify.test.mjs`, edit the
  schema-coverage fixture at `:168-169`: drop the four retired key tokens and add
  backticked `stakes` and `model.escalate_on_failure`, keeping `model.overrides`
  as-is. That fixture must name every schema key or the reverse check reports
  `inert-config-key` and the test's own `assert.equal(r.ok, true)` fails. Spell
  the new key as bare backticked `stakes`, never `stakes.<something>`: `stakes`
  becomes a schema FAMILY, so a dotted spelling is reported as
  `unknown-config-key` (D-10).
- **Verify:** `node cadence-core/bin/config.mjs keys` shows `stakes` with values
  `["solo","shipped","critical"]`, default `"shipped"`, shows
  `model.escalate_on_failure`, and shows no `model.profile`,
  `model.auto.ceiling`, `model.auto.escalate_on_failure` or
  `model.auto.max_escalations` (AC5).
  `node cadence-core/bin/config.mjs validate --file cadence-core/templates/config.json`
  prints `ok:true` with `errors: []`. `node --test cadence-core/bin/config.test.mjs`
  passes. `node --test cadence-core/bin/self-verify.test.mjs` reports the
  `placeholder keys expand` row passing (the whole-repo drift row at `:110` is
  expected red until task 6 - it is the phase gate, not this task's check).

### Task 3: Resolve stakes in route.mjs, retire auto, and make escalation unconditional

- **Files:** cadence-core/route-table.json, cadence-core/bin/route.mjs, cadence-core/bin/route.test.mjs
- **Action:** In `route-table.json`: delete `profile_order` and the whole `auto`
  block (`base_profile`, `signals.files`, `signals.ambiguity`, `max_tier_bump`) -
  D-11, that half has never run in production. Rename the `profiles` object to
  `stakes`, keyed `solo` / `shipped` / `critical`, each carrying the former
  `fast` / `balanced` / `quality` row VERBATIM in that order, so `shipped` (the
  new default) resolves byte-identically to what `balanced` resolved to. Update
  `_meta.note` to say stakes->model matrix instead of profile->model matrix.
  Rewrite `_meta.tiers` too: it reads "light < standard < heavy (order used for
  difficulty bumps and clamping)", and this task deletes `clampIdx` and
  `bumpTier`, so the parenthetical would be left describing two operations that
  no longer exist. `TABLE.tier_order` is read only inside `bumpTier`
  (`route.mjs:67`), so after this task the ARRAY has no code reader either - the
  unread-key shape this same task refuses `stakes_order` over. Keep the array
  (D-05 names it untouchable, `route.test.mjs:185` pins it, and phase 3's bundle
  cell is its next reader) and make `_meta.tiers` say what is true today: it
  states the role-tier vocabulary the `roles` block draws from, and no code
  orders it. Then rewrite `_meta.aliases` to give the REAL reason `fable` is
  pin-only (D-03):
  delete the "ranking is not established" claim, which is stale, and state the
  three operational facts - it requires 30-day data retention and returns
  `400 invalid_request_error` for every zero-data-retention org, its safety
  classifiers return a refusal stop reason on cyber-adjacent content and Cadence
  reviews its own git rails, secrets handling and shell tokenizer, and its
  multi-minute turns push against the configured provider request timeout inside
  the host's Bash ceiling. Do NOT touch the `tier_order`, `rung_order` or `roles`
  lines, and do NOT add a `stakes_order` key: nothing this phase reads one, and
  an unread key is exactly the resolved-then-dropped shape CFG-01 exists to close -
  phase 4 adds it with its reader. In `route.mjs`: rewrite the header comment
  block (`:3-23`) so the "Config keys read" list names `stakes`,
  `model.escalate_on_failure` and `model.overrides.<role>` and the opening
  paragraph describes a stakes matrix rather than a profile matrix. Change
  `DEFAULTS` to `{ stakes: 'shipped', escalate_on_failure: true }`, keeping the
  comment that says it mirrors the schema (D-06). Rewrite `readConfig(file)` to
  destructure `warnings` off `mergeLayers` (today it is dropped on the floor -
  the phase-1 gap CAPTURE.md recorded for six of seven callers) and return
  `{ stakes, stakesSet, escalate_on_failure, overrides, _source, _warnings }`,
  where `stakes` is the merged config's top-level `stakes` or the default,
  `stakesSet` is whether any layer actually carried that key,
  `escalate_on_failure` reads `c.model?.escalate_on_failure`, and `_warnings` is
  the mergeLayers warnings concatenated with `retiredKeysIn(c)` from
  `lib/retired-keys.mjs`. Delete `clampIdx`, `bumpTier` and `stepProfile` outright
  along with the `profile === 'auto'` branch, the tier-bump arm and the
  ceiling/`max_escalations` arithmetic. In `resolve`, build `reason[0]` honestly
  (AC2): when `stakesSet` is true it stays `config:<_source>`; when false it is
  `stakes default "<value>" (unset in layers: <_source>)` and the token
  `config:` must NOT appear in it, because reporting `config:repo` for a value no
  layer supplied is the exact defect D-09 names. Compute escalation
  unconditionally at every stakes level (D-04): when `escalate_on_failure` is
  true and `attempt > 1`, take `role.escalate_to` and, if it differs from
  `role.base_effort`, set `escalated = true`, resolve the agent through
  `agentForRung` and push `rung <base>-><target> (<agent>)`; when it equals the
  base rung push `rung held at <effort> (escalate_to <target or unset>)`, keeping
  phase 1's honest no-op report. When `escalate_on_failure` is false and
  `attempt > 1`, push a reason naming `model.escalate_on_failure` as the thing
  that disabled it, so a held retry is diagnosable. Do NOT add any direction
  check comparing `escalate_to` against `rung_order` - the missing-check finding
  is phase 1's open UAT item 11 and belongs to its owner
  (`.planning/phases/1/UAT.md:93-100`); inventing it here would silently widen
  this phase. Resolve the model as `TABLE.stakes[cfg.stakes][tier]` with `tier`
  always `role.tier`, and keep the existing `{ok:false, reason:'unresolved'}`
  degradation, reporting `stakes` where it reported `profile`. Rename the emitted
  `profile` field to `stakes`, and change the single `warning` string field to a
  `warnings` array emitted only when non-empty, folding the unknown-alias message
  into it - two warnings can now co-occur (a torn layer AND a retired key), and
  the array matches `config.mjs get`'s existing shape. Delete the `--files` and
  `--ambiguity` arms from `parseArgs` and from the usage string (D-11); leave
  `--role`, `--attempt` and `--file`. In `route.test.mjs`, re-derive the ~45
  configs the `cfg({profile: ...})` helper builds rather than substituting
  strings: the helper writes a `model` block, so a bare `stakes` key needs a
  helper that writes the top level - give `cfg` a shape that can write both
  (`stakes` at top level, `model.escalate_on_failure` and `model.overrides`
  nested) and rewrite each row for what it pins. Account for EVERY row - a row
  in neither list below is the defect this enumeration exists to prevent.
  Delete the rows whose premise this phase reverses or whose machinery no longer
  exists: the tier-bump/signal rows at `:81-88`, the ceiling rows at `:97-118`,
  the escalation-arithmetic rows at `:132-152`, plus `:66-71` ("fixed profile
  never escalates even at attempt 3", the exact claim D-04 reverses) and
  `:73-79` ("auto: clean run uses base profile", which pins a mode that no
  longer exists). Keep and re-point the rows that pin live behaviour: the matrix
  row (`:42`), the unresolved-enum row (`:154`), the `--attempt` validation row
  (`:161`), the `table` row (`:180-188`, whose
  `assert.ok(r.table.profiles.balanced)` becomes `r.table.stakes.shipped` - left
  as-is it reads a property of `undefined` and throws), the unknown-role row
  (`:190-195`, whose `cfg({profile:'balanced'})` becomes a stakes config), the
  missing-config-file row (`:199-203`, which must now assert
  `r.stakes === 'shipped'` and a `reason[0]` matching the new unset spelling -
  its current `assert.match(r.reason.join(' '), /config:defaults/)` is
  guaranteed red against the honest reason string this same task mandates, so
  re-derive it rather than keeping it), the layering rows (`:206-230`), the whole
  override block (`:234-292`), the bad-table rows, and the ladder-consistency
  rows at `:332-408`. Those last rows read the SHIPPED table and what they
  assert (agent, effort, `escalated`, `rung held at`) stays true, but they are
  not literally untouched: `:387` and `:403` build
  `cfg({ profile: 'auto', auto: {...} })`, so they must be re-derived onto the
  new `cfg` shape like every other row. Left alone they would pass while
  building an inert config `route.mjs` no longer reads - a row that has stopped
  testing its own premise, which is what D-16 forbids. Re-derive their configs;
  do not change what they assert.
  Add rows for the new behaviour: escalation fires at the DEFAULT with no stakes
  key set; `model.escalate_on_failure: false` holds the rung and names the key in
  `reason`; a config holding `model.profile` produces a `warnings` entry naming
  it and a `reason[0]` that does not contain `config:`.
- **Verify:** `node --test cadence-core/bin/route.test.mjs` passes.
  `node cadence-core/bin/route.mjs resolve --role cad-plan-checker --attempt 2 --file /nonexistent.json`
  run with `CADENCE_GLOBAL_CONFIG` pointed at a nonexistent path prints
  `agent: "cad-plan-checker-high"`, `escalated: true` and `stakes: "shipped"`
  (AC4). With a scratch repo config holding only `{"model":{"profile":"balanced"}}`,
  `node cadence-core/bin/route.mjs resolve --role cad-planner --file <that file>`
  prints one `warnings` entry naming `model.profile` and pointing at `stakes`,
  and its `reason[0]` contains neither `config:repo` nor `config:global+repo`
  (AC2, route arm). `grep -c "profile_order\|max_tier_bump\|base_profile" cadence-core/route-table.json cadence-core/bin/route.mjs`
  reports 0 for both files, and `git diff cadence-core/route-table.json` shows no
  changed `tier_order` or `rung_order` line. The `_meta` rewrite is checked
  directly, not inferred: `node -e` reading `route-table.json` shows
  `TABLE.stakes` present with keys `solo`/`shipped`/`critical`, `TABLE.profiles`
  undefined, and `_meta.tiers` plus `_meta.aliases` matching none of
  `/difficulty bumps|clamping|not established|profile/i` - without this arm a
  patch can strip the deleted identifiers while leaving the matrix keyed
  `profiles` and the stale fable rationale in place, and every other clause here
  still passes.

### Task 4: Refuse a retired key at the write face and speak it at the config read face

- **Files:** cadence-core/bin/config.mjs, cadence-core/bin/config.test.mjs
- **Action:** In `config.mjs`, import `retiredKeyError` and `retiredKeysIn` from
  `./lib/retired-keys.mjs`. In `checkPairs`, after `splitPair` succeeds and
  BEFORE the `SCHEMA[key]` lookup, call `retiredKeyError(key)` and, when it
  returns a string, push `{ key, error: <that string> }` and continue - placing
  it before the lookup is the whole point, since once the schema drops the key
  the `!spec` branch would emit the generic `unknown key` D-08 names as the
  defect. `checkPairs` is reached by both `set` and `check` and runs before any
  read or write, so the refusal stays atomic. Change the `check` dispatch arm to
  emit the same failure contract `set` already speaks and
  `workflows/config.md:161-175` already documents:
  `{ok:false, reason:"invalid", detail:[{key,error,value}]}` on failure and
  `{ok:true}` on success, replacing today's `{ok, errors}` shape (AC1 asks for
  `reason:"invalid"` and `detail[].error` from `check`). In `get`, concatenate
  `retiredKeysIn(config)` onto the `warnings` array `mergeLayers` returns, so a
  repo config still holding a retired key warns instead of resolving silently at
  the schema default. Delete `crossWarnings` entirely along with its
  `route-table.json` read and both call sites (D-12): it keys on
  `model.auto.ceiling`, which no longer validates, and its `profile_order` read
  is gone - left in place it would fire unconditionally, since `[].indexOf(x)` is
  `-1` on both sides and `-1 <= -1` holds. `set` then emits
  `{ok:true, file, changed}` with no `warnings`. Do NOT add the retired-key
  diagnostic to `validate`: no skill or workflow invokes it (its only mention is
  `workflows/config.md:130`), so a diagnostic placed there is never seen, and
  D-07 fixes the read faces at `resolve` and `get` deliberately. In
  `config.test.mjs`, update the `check` row at `:200-207` to
  the new `{ok, reason, detail}` shape, and add rows: `check model.profile=balanced`
  returns `ok:false`, `reason:"invalid"`, and `detail[0].error` matching
  `/stakes/` and naming solo, shipped and critical; `check stakes=quality`
  returns `ok:false` with an error matching `/must be one of: solo, shipped, critical/`;
  `set model.auto.ceiling=quality` fails `reason:"invalid"` with a detail naming
  the removal and writes nothing; `get` against a repo file holding
  `{"model":{"profile":"balanced"}}` returns `ok:true` with a `warnings` entry
  naming `model.profile` and `stakes`.
- **Verify:** `node cadence-core/bin/config.mjs check model.profile=balanced`
  prints `{"ok":false,"reason":"invalid","detail":[...]}` whose `detail[0].error`
  names `stakes` and the three values, and
  `node cadence-core/bin/config.mjs check stakes=quality` prints `ok:false` with
  an error reading `must be one of: solo, shipped, critical` (AC1).
  `node cadence-core/bin/config.mjs get stakes --file <a scratch file holding
  {"model":{"profile":"balanced"}}>` prints `ok:true`, `values.stakes` of
  `"shipped"`, and one `warnings` entry naming `model.profile` and `stakes`
  (AC2, config arm). `node --test cadence-core/bin/config.test.mjs` passes and
  `grep -c crossWarnings cadence-core/bin/config.mjs cadence-core/bin/config.test.mjs`
  reports 0 for both.

### Task 5: Sweep the budgeted prose surfaces and regenerate their budgets

- **Files:** cadence-core/workflows/config.md, cadence-core/workflows/plan.md, skills/cad-config/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** In `workflows/config.md`, replace the four `**Model**` catalog rows
  (`:76-79`) with two: a `stakes` `[repo]` enum row whose Purpose is the question
  itself (what does a break here cost?) and whose Value column gives one clause
  per value - solo = nobody else runs this, a break costs only my time; shipped =
  other people run this, a break comes back as a bug report; critical = a break
  is not a bug report - defaulting to shipped; and a
  `model.escalate_on_failure` bool row (re-dispatch a failed attempt at the
  role's harder rung / leave it at its base rung), defaulting to true. Keep the
  row order and table shape so the menu walk still pages 4 knobs at a time. At
  `:153` replace the parenthetical `model.profile` example with `stakes`. Add one
  sentence to the **Direct set** section stating that `check` speaks the same
  `{ok:false, reason:"invalid", detail:[...]}` contract `set` does, and that a
  retired key's detail names its replacement so the remediation needs no lookup.
  In `workflows/plan.md` at `:204` and `:207`, drop "under `auto`" - escalation
  on a second attempt is now unconditional - so the two lines read that the
  routing seam escalates the re-dispatch to the role's `escalate_to` rung file.
  In `skills/cad-config/SKILL.md:3`, change the description's "model profile" to
  "routing stakes". Everywhere in these three files write the values as
  backticked bare words or as `stakes: critical`, NEVER as `stakes.critical`:
  `stakes` is now a schema family, and a dotted spelling is reported as
  `unknown-config-key` by self-verify's prose walk (D-10). Do not touch any
  `review.providers`, `flagship`/`balanced`/`cheap` tier row or
  `review.triggers.<t>.tier` line in `config.md` - that is the cross-model
  provider axis, not this one (D-05). Then regenerate
  `cadence-core/bin/weight-budgets.json`: every budget is exact-fit today (all 63
  entries equal their file byte-for-byte), so set each edited surface's entry to
  the exact byte count `node cadence-core/bin/weight.mjs` reports for it - the
  current values are `cadence-core/workflows/config.md` 16681,
  `cadence-core/workflows/plan.md` 13872, `skills/cad-config/SKILL.md` 1335 - and
  change no other entry. Under-setting a budget is not the only failure: leaving
  an entry ABOVE the file's real size pre-approves unaudited growth, which is
  what commit 994761d had to correct (D-15).
- **Verify:** A one-liner comparing every surface `node cadence-core/bin/weight.mjs`
  reports against `cadence-core/bin/weight-budgets.json` shows all 63 entries
  equal, with no surface missing and none over. `grep -c "model\.profile\|model\.auto\." cadence-core/workflows/config.md cadence-core/workflows/plan.md skills/cad-config/SKILL.md`
  reports 0 for all three, and `grep -n "stakes" cadence-core/workflows/config.md`
  shows the catalog row with all three values and no `stakes.` dotted spelling.

### Task 6: Sweep the reference and internals prose, and close the route flag contract

- **Files:** cadence-core/references/seams.md, cadence-core/references/review-triggers.md, INTERNALS.md, cadence-core/bin/self-verify.mjs
- **Action:** In `self-verify.mjs`, remove `--files` and `--ambiguity` from
  `CONTRACTS['route.mjs'].resolve`, leaving `--role`, `--attempt` and `--file`.
  This must land in the SAME change as the `seams.md` edit below: the flag check
  reads prose against the contract, so dropping the flags from the contract while
  `seams.md:92-98` still documents them reports `unknown-flag`. In
  `references/seams.md`, rewrite the **Routing** block (`:87-119`): drop
  `[--files <N>]` and `[--ambiguity <0..1>]` from the command block at `:92-94`;
  at `:89` change "when a profile is set" to a stakes spelling; rewrite the
  `--attempt` bullet so it says a re-dispatch after a failed run swaps to the
  role's `escalate_to` rung file, that this happens at every stakes level, and
  that `model.escalate_on_failure: false` is the off switch - and delete the
  `--files`/`--ambiguity` sentence; delete the "Fixed profiles
  (`fast`/`balanced`/`quality`) never escalate" bullet at `:103-104` and put in
  its place a bullet saying the stakes level selects the model matrix column and
  never reacts to `--attempt` by itself; at `:106` change "the whole profile/tier
  matrix" to the stakes/tier matrix and drop "including an `auto` escalation";
  at `:109` change the singular `warning` to the `warnings` array route.mjs now
  emits; and rewrite the `fable` sentences at `:110-113` to carry D-03's three
  operational facts (zero-data-retention orgs get a hard `400`, its safety
  classifiers refuse cyber-adjacent content and Cadence reviews its own git
  rails and secrets handling, and its multi-minute turns press against
  `review.request_timeout_ms` inside the host's Bash ceiling) instead of the
  stale "ranking that is not established" claim. In
  `references/review-triggers.md`, add two or three sentences to the
  `risk_surface detection` section (`:140-145`) stating that this list is the
  operative definition of the `critical` stakes value - a diff touching one of
  these surfaces is a break that does not come back as a bug report - and say
  plainly what is true TODAY: the list fires the review trigger, and nothing here
  reads the stakes value yet. Do not promise the computed floor; that is phase 4.
  In `INTERNALS.md`, rewrite the `auto` sentence in the "Model routing"
  paragraph at `:11` so the cheap gate escalates on a failed attempt rather than
  when `auto` decides; replace the whole paragraph at `:13` - the three canned
  profiles become the one stakes question with its three answers, each mapping a
  role's tier to a Claude alias, and the difficulty-signal story goes with `auto`
  (delete file-count and ambiguity entirely, D-11), leaving the guardrails that
  are still true: role tiers act as floors, an explicit pin always wins,
  escalation is recorded in the reason rather than done behind your back; and at
  `:17` change "roles, profiles, and auto signals" to roles, the stakes matrix
  and the per-role rung ladder. `INTERNALS.md` is inside self-verify's prose
  walk, so write `stakes: critical` or backticked bare values, never
  `stakes.critical` (D-10). `references/*.md` are NOT in the weight manifest, so
  no budget entry changes here (D-15); `INTERNALS.md` is not measured either.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `ok:true` with an
  empty `problems` array - no `unknown-config-key`, no `inert-config-key`, no
  `unknown-flag`, no `budget-overrun` (AC7, self-verify arm).
  `node --test cadence-core/bin/*.test.mjs` exits 0 and
  `npx tsc -p tsconfig.ci.json` exits 0 (AC6).
  `grep -rn "model\.profile\|profile_order\|model\.auto\." --include="*.md" --include="*.json" --include="*.mjs" .`
  run from the repo root returns matches ONLY in this closed list, and the check
  is that every hit falls inside it - not that the grep is empty, which this
  phase's own artifacts make impossible. The retired vocabulary legitimately
  survives in exactly the surfaces whose job is to name it: (a)
  `cadence-core/bin/lib/retired-keys.mjs`, whose `RETIRED_KEYS` map is keyed by
  those dotted strings because `checkPairs` looks a key up by that exact token;
  (b) `cadence-core/bin/retired-keys.test.mjs`, which calls `retiredKeyError`
  with each of them; (c) `cadence-core/bin/config.test.mjs`, whose refusal rows
  run `check model.profile=balanced` and `set model.auto.ceiling=quality` as
  literal CLI tokens; (d) `cadence-core/bin/route.test.mjs`, whose retired-key
  warning row writes a `{"model":{"profile":...}}` fixture; (e) everything under
  `.planning/`; (f) `CHANGELOG.md`, where PLAN-2 states the break; and (g)
  `DESIGN.md` in TWO places - PLAN-2's new dated marker, and the pre-existing
  2026-07-10 IMPLEMENTED bullet at `:357` ("`model.profile` gains `auto`"),
  which is a dated historical record PLAN-2 task 2 explicitly forbids editing.
  A hit anywhere else - any workflow, reference, skill, template, `INTERNALS.md`,
  `config.schema.json`, `route-table.json`, `route.mjs`, `config.mjs`,
  `self-verify.mjs` - fails this arm and names the missed surface. Ignore any hit
  under an untracked, gitignored path (`design-notes/`, `node_modules/`), the
  same allowance phase 1's UAT recorded for this grep at
  `.planning/phases/1/UAT.md:29` (AC3, grep arm). `git diff` touches no
  `review.providers.*.tiers.*` line, no `tier_order` line and no `rung_order`
  line (AC3, diff arm).

## Notes

- **Structure deviates from the CONTEXT `Plan shape` sketch, deliberately.** The
  sketch proposed three plans (schema+route core / prose sweep + budgets /
  CHANGELOG + DESIGN). The first two fail the independence test and are merged
  here into one plan: `self-verify.test.mjs:110` asserts the whole shipped repo
  is drift-free, so a schema-only slice reports `inert-config-key: stakes` (no
  prose names the new key) and a prose-only slice reports
  `inert-config-key: model.profile` (the schema still holds a key no prose
  names) - each slice is red in BOTH orders, so neither is independently
  verifiable and a split would feed the parallel path two slices that can only
  be checked after they merge. The third slice IS independent (CHANGELOG.md and
  DESIGN.md share no file with this plan and are deliberately excluded from
  self-verify's prose walk) and is PLAN-2. Tasks 2 through 5 leave the whole-repo
  drift row red on purpose; each of their Verify clauses is scoped to a targeted
  command for that reason, and task 6 is the phase gate.
- **Planner's call on `max_escalations` (CONTEXT flagged it Unclear).** The key
  is dropped, not renamed to `model.max_escalations`. After `auto` retires, the
  only escalation left is the single rung swap to `role.escalate_to`, so attempts
  2, 3 and 4 all resolve the same rung and there is no second step for a cap to
  bound. Carrying it forward would ship a key that is read and then thrown away -
  the exact resolved-then-dropped shape CFG-01 exists to close. AC5 already
  requires `model.auto.max_escalations` gone; this decides it does not come back
  under a new name, and PLAN-2's CHANGELOG entry states the removal in those
  terms.
- **Route's `warning` becomes `warnings`.** A retired key and a torn config layer
  can now both be true at once, and `config.mjs get` already carries an array, so
  the two read faces speak one shape. No script consumes route's `warning` today;
  the only consumer is `references/seams.md:109`, which task 6 updates.
- **A phase-1 finding gets louder here, and is not fixed here.** `.planning/phases/1/UAT.md:93-100`
  and CAPTURE.md record that `route.mjs` accepts any `escalate_to` without
  comparing it against `rung_order`, so a data-only edit can resolve DOWN the
  ladder while reporting `escalated: true`. Until now the `auto` gate meant that
  arm never fired on a default install; D-04 makes it fire for every user. The
  fix belongs to its own owner - task 3 says explicitly not to invent it - but
  the blast radius change is worth a CAPTURE note at verify time.
- **A typo in bare `stakes` prose is still caught by nothing**, the same hole
  `granularity` has carried since v1.0.0 (D-10 states the consequence; this phase
  does not close it). Worth a CAPTURE item rather than scope growth.
- **The `plan` review trigger fired on this plan and four blockers were applied**
  (adjudicated gate, `cad-reviewer` + `openai/gpt-5.4-mini`, both grounded
  against the repo). All four were verify steps that could not pass on a
  correctly executed phase: task 6's AC3 grep was unsatisfiable by task 1's own
  `retired-keys.mjs` and by `DESIGN.md:357`; task 2 claimed the `crossWarnings`
  rows "still pass here" when deleting `model.auto.ceiling` breaks them; task 2's
  `config.test.mjs` enumeration omitted `:27-36`, `:51-58`, `:66-74` and
  `:347-365` (the `validate` fixture among them, which D-07 leaves uncovered by
  design); and task 3's `route.test.mjs` enumeration omitted `:66-79`, `:180-188`,
  `:190-195` and `:199-203`, the last of which contradicted the honest-reason
  format task 3 itself mandates. The `:332-408` "untouched" instruction was
  corrected in the same pass - `:387` and `:403` build `profile:'auto'` configs
  and must be re-derived. Two further findings were folded in at the user's
  call: `config.schema.json:14-17`'s `model.overrides.<role>` purposes still
  spelled the profile matrix and the withdrawn fable ranking (task 2), and
  `route-table.json`'s `_meta.tiers` described the bump/clamp machinery task 3
  deletes, with `tier_order` losing its only code reader (task 3, plus a Verify
  arm that checks the `_meta` rewrite directly). One finding was declined: task
  5's Verify still does not prove the `workflows/plan.md` "under `auto`" edit
  landed, since its grep bans only `model.profile|model.auto.`.
- **The upstream artifacts still describe a revalue, not a rename.**
  `.planning/ROADMAP.md:61` and `.planning/PROJECT.md:143` both still say
  `model.profile`'s enum values change. REQUIREMENTS.md STK-01 was corrected, so
  the audit source of truth is accurate; the other two were reported and left
  by the user's choice. `/cad-verify 2` will otherwise walk a criterion naming a
  key this phase deleted.
