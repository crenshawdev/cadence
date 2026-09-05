---
phase: 2
plan: 1
requirements:
  - ROL-01
files:
  - cadence-core/config.schema.json
  - cadence-core/references/config-reach.md
  - cadence-core/references/seam-spawn-agent.md
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/lib/rung-agent.mjs
  - cadence-core/bin/rung-agent.test.mjs
  - cadence-core/bin/route.mjs
  - cadence-core/bin/route.test.mjs
  - cadence-core/bin/weight-budgets.json
---

# Phase 2: Routing resolves from the roles block - Plan

## Goal

Config names each role's model and effort directly, and `route.mjs resolve`
answers from that block while the `stakes` key still answers wherever the block
is silent - so no commit in this phase strands a config that exists today,
including this repository's own.

## Must be true when done

- A config naming only `roles.cad-planner.model` and `roles.cad-planner.effort`
  makes `node cadence-core/bin/route.mjs resolve --role cad-planner` return that
  model and that effort, with `agent` naming that role's file for that rung.
- A config carrying only `stakes` and no `roles` block resolves the same model,
  effort and agent it does at HEAD for all eighteen (level, role) cells.
- A `roles.<role>.model` outside the four aliases the host accepts still
  resolves `ok: true`, carries the routed cell's model, and adds a `warnings[]`
  entry naming the rejected string - a typo never drops a dispatch to the
  session default.
- Setting a roles key and its older `model.effort.<role>` / `model.overrides.<role>`
  sibling for one role resolves the roles value, and a `warnings[]` entry names
  which key won.
- A raised risk floor still clamps a below-floor rung the user pinned, whichever
  of the two keys pinned it, and `reason` names the surface that raised it.
- `node cadence-core/bin/config.mjs get` and `set` reach all twelve roles keys,
  `validate` calls `roles.<role>.retry` an unknown key, and
  `node cadence-core/bin/self-verify.mjs` reports `ok: true`.
- A caller can tell where the resolved model came from without inferring it, and
  the pin announcement `seam-spawn-agent.md` requires still fires only for a
  `model.overrides` pin.

## Context

Locked by `.planning/phases/2/CONTEXT.md`: D-01 (no `retry` field in the block),
D-02 (an unknown model warns and the routed model stands, never `ok: false`),
D-03 (roles wins over the older keys, which stay live as the fallback, and the
winner is named), D-04 (a roles `effort` is clamped by a raised floor on exactly
today's terms), D-05 (read in `readConfig`, applied inside `resolve` AFTER the
cell lookup, never instead of it), D-06 (twelve flat dotted keys, no wildcard),
D-07 (`config.mjs` reaches them for free once the schema holds them), D-08 (the
fallback is proved against the hand-written `CELLS` fixture), D-09 (fallback per
KEY, not per role), D-10 (types, and the drift guard extended), D-11 (`pinned`
keeps its meaning and a separate field names the model's source).

Out of this phase entirely: the `stakes` key, the cells grid, `RAISE_TARGET`,
`route.mjs replay`, `model_aliases`, the six `model.overrides.*` enums, the
cell-vs-alias check in `route-cells.mjs`, the thirteen-question interview, and a
Codex host adapter. The `retry` field survives inside the grid that carries it
and dies with that grid in phase 3. Nothing in this phase edits this
repository's own `.planning/config.json`.

## Tasks

### Task 1: Land the twelve roles keys as config surface, with every schema-key guard answering for them

- **Files:** cadence-core/config.schema.json, cadence-core/references/config-reach.md,
  cadence-core/references/seam-spawn-agent.md, cadence-core/bin/self-verify.mjs,
  cadence-core/bin/self-verify.test.mjs
- **Action:** Add twelve flat dotted keys to the `keys` map of
  `config.schema.json` - `roles.<role>.model` and `roles.<role>.effort` for each
  of the six roles `lib/rung-agent.mjs` files rungs for - never a wildcard or a
  `roles.*` pattern, because `bin/config.mjs`'s `flatten` looks each leaf up with
  `Object.hasOwn(SCHEMA, path)` and the file's only pattern machinery (`LEVEL_KEY`)
  shapes a warning rather than admitting a key (D-06). `model` is typed
  `string_or_null` with `default: null` and NO `grammar` marker; `effort` is an
  `enum` whose `values` are that role's own rung keys in `RUNG_FILES` declared
  order followed by `null`, which is the same list its `model.effort.<role>`
  sibling already carries and the shape check 8b holds to the map (D-10). No
  `src` and no `repo_only`, matching the `model.effort.<role>` rows. No third
  field of any kind: `roles.<role>.retry` must stay an unknown key (D-01).
  Add one row per new key to the `## Reach rows` table of `config-reach.md` -
  reach `universal`, honoured by `bin/route.mjs`, following the wording of the
  `model.effort.<role>` rows at :114-119 - or `reachIssues` files
  `missing-reach-row` for every key with none. Then close the reverse arm:
  check 1b (`self-verify.mjs:781-785`) files `inert-config-key` for a schema key
  no prose token covers, and the token that would cover these keys cannot be
  written today. Measured 2026-09-04 against `self-verify.mjs:577-601`: the
  tokenizer's segment class is `[a-z_0-9<>]`, so a literal
  `roles.cad-planner.model` in prose tokenizes to `roles.cad`, which covers no
  key under 1b's prefix rule; and `expand` substitutes only `<t>/<trigger>` and
  `<name>/<provider>`, so a written `roles.<role>.model` reports
  `unknown-config-key` instead. Fix it the way the two existing placeholders are
  handled: build a ROLES list off the schema's own `roles.` keys beside the
  `TRIGGERS` and `PROVIDERS` lists at `self-verify.mjs:515-518`, add a third
  `subst` call to `expand` for the `<role>` placeholder, and write
  `roles.<role>.model` and `roles.<role>.effort` once each in prose in
  `seam-spawn-agent.md`, beside its existing **Per-role start rung** bullet.
  The reach doc cannot supply that coverage - `self-verify.mjs:591` excludes its
  own tokens from `seenTokens` on purpose. Add no `config-catalog.md` row: the
  twelve existing per-role keys carry none and stay covered by their bare family
  tokens (D-07). `route.mjs` is not touched in this task - the keys are settable
  and unread until tasks 3 and 4.
- **Verify:** `node cadence-core/bin/config.mjs keys` lists all twelve; one
  `node cadence-core/bin/config.mjs get` call naming all twelve returns
  `ok: true` with `null` for each; `node cadence-core/bin/config.mjs set --file
  <a scratch config> roles.cad-executor.model=fable roles.cad-executor.effort=low`
  writes both and the same `set` with `roles.cad-executor.effort=ludicrous` is
  refused naming that role's rungs; `node cadence-core/bin/config.mjs validate
  --file <a scratch config carrying roles.cad-planner.retry>` reports
  `unknown key` for it; `node cadence-core/bin/self-verify.mjs` reports
  `ok: true` with no `missing-reach-row`, no `inert-config-key` and no
  `unknown-config-key`; and `node --test cadence-core/bin/self-verify.test.mjs`
  passes with a new case proving the placeholder both ways - a `fixture()` prose
  file writing `roles.<role>.effort` yields no `unknown-config-key` for that
  token and no `inert-config-key` for `roles.cad-planner.effort`, and a prose
  file omitting it yields that `inert-config-key`.

### Task 2: Extend the schema-vs-RUNG_FILES effort drift guard to the roles spelling

- **Files:** cadence-core/bin/lib/rung-agent.mjs, cadence-core/bin/rung-agent.test.mjs
- **Action:** `effortEnumIssues` today keys on `EFFORT_PREFIX = 'model.effort.'`
  in both directions - a forward walk over `RUNG_FILES` roles and a reverse walk
  filing `unknown-effort-role` for a prefixed key naming a role the map does not
  hold. Extend it to hold `roles.<role>.effort` to the same rules (D-10): the key
  must be present, `type` must be `"enum"` and be checked BEFORE its values for
  the reason stated at :304-306, `values` must be that role's `RUNG_FILES` rungs
  in declared order followed by `null`, and no offered rung may sit outside the
  caller's `rungOrder`. The reverse walk must file `unknown-effort-role` for a
  `roles.<name>.effort` key whose `<name>` the map does not carry. Leave the
  `model.effort.` arm and its detail strings exactly as they are, keep every new
  detail naming the key a maintainer would edit, and keep tolerating an empty or
  absent `rungOrder` by skipping only the vocabulary arm - `self-verify.mjs:1179-1191`
  calls this outside both of check 8's table guards and passes `[]` when there is
  no table. Do not extend the guard to `roles.<role>.model`: D-10 types it
  `string_or_null` with nothing to drift against.
- **Verify:** `node --test cadence-core/bin/rung-agent.test.mjs` passes with new
  cases beside the existing `effortEnumIssues` section at :268 - the shipped
  schema returns `[]`; a schema whose `roles.cad-planner.effort` drops a rung
  returns one `effort-enum-drift` naming `roles.cad-planner.effort`; one whose
  `type` is `"string"` returns `effort-enum-drift`; one with the key absent
  returns `missing-effort-key`; and one carrying `roles.cad-nobody.effort`
  returns `unknown-effort-role`. `node cadence-core/bin/self-verify.mjs` still
  reports `ok: true`.

### Task 3: Resolve the start rung from the roles block, with the older key as the fallback

- **Files:** cadence-core/bin/route.mjs, cadence-core/bin/route.test.mjs
- **Action:** In `readConfig`, add a `roles` entry read off the merged config
  beside the existing `overrides` and `effort` entries at :249-260, defensive in
  the shape `providersIn` uses - a value that is not a plain object contributes
  nothing rather than throwing. Keep it as its own map: folding it into
  `overrides` or `effort` gives two writers one entry, which is the reason the
  `effort` map got its own field in the first place (:255-259). Per-KEY fallback
  is free - `lib/config-merge.mjs:75-86` recurses nested objects key by key - so
  write no per-role merge of your own (D-09). In `resolve`, leave the cell lookup
  and the torn-table guard at :958-972 exactly where they are and change nothing
  above them (D-05). Generalize the configured-START-rung block at :987-1048: the
  rung it considers comes from this role's roles entry when that entry names an
  `effort`, and from `cfg.effort[opts.role]` otherwise, and the key name
  interpolated into all four arms' `reason` and `warnings` text is whichever key
  supplied the rung - a record naming a key that did not decide is the
  resolved-then-dropped shape those four arms exist to prevent. When BOTH keys
  name a rung for one role, the roles value wins and a `warnings[]` entry names
  the winner (D-03). The floor clamp keeps its terms unchanged (D-04): still
  gated on `floor.raised` rather than on a floor merely being computed, still
  compared against `cell.effort` through `rung_order`, still holding the
  configured rung and warning when `rung_order` cannot place either side. The two
  `reason` strings in the retry block at :1096 and :1105 that hard-code
  `model.effort.${opts.role}` must name the winning key as well, for the same
  reason. Add no `retry` field and no new escalation behaviour (D-01).
- **Verify:** `node --test cadence-core/bin/route.test.mjs` passes with new cases
  beside the RNG-02 section at :1085 and the clamp section at :2324: a config
  setting only `roles.cad-verifier.effort` resolves that rung with `agent` naming
  that rung's file; a config setting `roles.cad-verifier.effort` and
  `model.effort.cad-verifier` to DIFFERENT rungs resolves the roles rung and a
  `warnings[]` entry names `roles.cad-verifier.effort` as the winner; and a
  `clampFx`-shaped fixture that pins `roles.cad-plan-checker.effort` to `low` on
  a phase whose declared file carries `SECRET_BODY` resolves at `stakes: shipped`
  and `effort: "medium"` with a `reason` entry matching `/does not apply/` that
  names `roles.cad-plan-checker.effort`, `touches secrets` and the floored rung.

### Task 4: Resolve the model from the roles block, and say in the envelope where it came from

- **Files:** cadence-core/bin/route.mjs, cadence-core/bin/route.test.mjs,
  cadence-core/references/seam-spawn-agent.md
- **Action:** At the per-role pin block that starts `let model = cell.model`
  (:1322-1338), make `roles.<role>.model` win over both `model.overrides.<role>`
  and the cell's model, naming the swap in `reason` the way the pin arm already
  does (D-03); when both are set for one role and the roles model is accepted, a
  `warnings[]` entry names the winner. A roles model outside `TABLE.model_aliases`
  resolves `ok: true` with a `warnings[]` entry naming the rejected string, and
  the routed cell's model stands, even when `model.overrides.<role>` is set for
  that role - a rejected roles string does NOT fall through to the pin, because
  D-02 and ROL-01 both fix the answer at the routed cell's model. `model_source`
  is `cell` in that case. The warn-and-stand SHAPE is byte-for-byte the existing
  unknown-alias arm's, which is what D-02's evidence cites; what this adds is
  that a roles key, once set, owns the answer for that role whether or not the
  host accepts its value, so a typo cannot silently hand the role back to an
  older pin. D-03's "the older keys stay live as the narrower fallback" is
  unharmed: the pin still decides for every role whose roles key is absent
  (D-02). Never `ok: false` and never a pass-through: `route.mjs:14-15,86-93`
  turn a refusal into a base-agent dispatch at the session default, below every
  risk floor, and the host's dispatch `model` parameter is an enum of exactly
  `sonnet`, `opus`, `haiku`, `fable`, so an unknown string fails input validation
  on every dispatch rather than erroring gracefully. `pinned` keeps meaning
  "`model.overrides` chose this model", so it is FALSE when a roles-block model
  won (D-11), and the `out({ ok: true, ... })` envelope at :1386 grows one new
  always-present field beside it. Planner's choice, recorded here: call it
  `model_source`, carrying the exact dotted config key that chose the model
  (`roles.<role>.model` or `model.overrides.<role>`) and the string `cell` when
  the routed cell's model stands, including when a roles model was rejected.
  Always present, never a dropped key, for the reason :1239-1241 states about the
  reviewer maps. Then extend `seam-spawn-agent.md`'s dispatch bullets: a
  **Per-role model** bullet stating that the roles block wins over the pin and
  over the cell and that an unaccepted string warns and stands down, and the new
  field named where a caller reads it. Leave the **Tell the user when a pin
  fires** rule at :309-314 keyed on `pinned` - announcing every roles-block
  dispatch is exactly the warning fatigue :276-283 legislates against.
- **Verify:** `node --test cadence-core/bin/route.test.mjs` passes with new cases:
  a config naming ONLY `roles.cad-planner.model` and `roles.cad-planner.effort`
  resolves that model, that effort and that rung's `agent`, with `pinned: false`
  and `model_source: "roles.cad-planner.model"`; a config whose
  `roles.cad-planner.model` is a string outside the four aliases resolves
  `ok: true` with `model` equal to the shipped cell's model for that level,
  `model_source: "cell"`, and a `warnings[]` entry containing the rejected
  string; a config whose `roles.cad-verifier.model` is a string outside the four
  aliases WHILE `model.overrides.cad-verifier` names an accepted alias resolves
  `ok: true` with `model` equal to the shipped cell's model for that level and
  never the pin's, `pinned: false`, `model_source: "cell"`, and a `warnings[]`
  entry containing the rejected string; and a config setting both
  `roles.cad-executor.model` and
  `model.overrides.cad-executor` resolves the roles value with `pinned: false`
  and a `warnings[]` entry naming the winner. `node cadence-core/bin/self-verify.mjs`
  reports `ok: true`.

### Task 5: Pin the stakes-only fallback across all eighteen cells

- **Files:** cadence-core/bin/route.test.mjs
- **Action:** Add a case per cell holding the hand-written `CELLS` fixture at
  :86-107 against a config that carries `stakes` and NO `roles` block, asserting
  `model`, `effort` and `agent`, plus an assertion on the fixture file's own
  parsed contents that it holds no `roles` key - otherwise a roles block that
  happened to agree would satisfy the proof (D-08). Expectations stay
  hand-written and are never read, derived or spread from
  `cadence-core/route-table.json`: that file is the subject under test, and the
  rule with its two mutation-proved losses is stated at :81-85. One test case per
  cell, never one case walking all eighteen, for the reason stated at :109-112 -
  node:test aborts a case at its first throwing assertion, so a single case would
  report one failure and skip every later row.
- **Verify:** `node --test cadence-core/bin/route.test.mjs` passes; changing one
  `CELLS` row's `effort` to a different rung makes exactly that one new case fail
  and the others pass (revert the edit after). Then the whole tree:
  `node cadence-core/bin/test.mjs` passes and
  `npx tsc -p tsconfig.ci.json` is clean.

## Notes

- CONTEXT's D-07 names the reach work as "at least one two-segment prose token
  per role in a walked markdown file". Measured against `self-verify.mjs:577-601`
  on 2026-09-04, no such token can be written: the tokenizer's segment class
  stops at the hyphen in every role name, so `roles.cad-planner` reduces to
  `roles.cad` and check 1b's prefix rule does not accept it. Task 1 therefore
  adds the `<role>` placeholder to `expand`, which is what makes D-07's token
  reachable rather than new scope - it is the same substitution `<trigger>` and
  `<provider>` already get.
- `model_source` and its three values are the planner's choice under D-11, which
  fixes the requirement (a separate field naming where the resolved model came
  from) and not the spelling.
- The uniform per-role `effort` enum is safe because phase 1 closed the ladder:
  `.planning/phases/1/UAT.md` records that all six `model.effort.<role>` keys
  carry the same five rungs, so the roles `effort` enums are the same list per
  role rather than six different ones.
- Plan shape honours CONTEXT's `one plan` directive; no deviation. All five
  tasks share `route.mjs`, `route.test.mjs` or `self-verify.mjs` with at least
  one other, so no independent slice exists to split out.
