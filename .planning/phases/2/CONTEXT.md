# Phase 2: Routing resolves from the roles block - Context

Gathered: 2026-09-04
Feeds: /cad-plan 2

## Scope boundary

In: the twelve `roles.<role>.{model, effort}` keys in
`cadence-core/config.schema.json`; the arm in `cadence-core/bin/route.mjs` that
resolves a dispatch from them with `stakes` still answering where they are
silent; one `cadence-core/references/config-reach.md` row per new key; the
two-segment prose token per role that keeps `inert-config-key` quiet; and the
tests each acceptance criterion names.
Out: everything phase 3 deletes - the `stakes` key, the cells grid,
`RAISE_TARGET`, `route.mjs replay`, `model_aliases`, the six
`model.overrides.*` enums, and the cell-vs-alias check in `route-cells.mjs` -
plus the thirteen-question interview itself. The `retry` field is also Out: it
survives this phase inside the grid that carries it and dies with that grid in
phase 3 (D-01 decides only that the roles block never grows the field). A Codex
host adapter (`GH-140`) is out of the cycle entirely.
Deferred: None.
Plan shape: one plan.

## Durable decisions

- D-01 (retry rung): The roles block carries `model` and `effort` and never a
  third `retry` field, so retry escalation retires with the grid in phase 3
  rather than being carried forward. Evidence: measured on
  `.planning/trace.jsonl` 2026-09-04 over 904 `routing.resolve` events - 30
  carry `attempt: 2`, 12 carry `escalated: true`, and all twelve are dated on or
  before 2026-08-17, none after `e40c9c30` (2026-08-23) pinned
  `model.escalate_on_failure` false; six of the twelve are one 50 ms burst
  across all six roles, which reads as a sweep rather than six real failures.
  Nothing in the record can join a climb to an outcome: 0 of 569
  `lifecycle.dispatch` and 0 of 512 `lifecycle.return` events carry an
  `attempt` field, and the only verdict event `outcome.uat_verdict` is per phase
  and carries no role. Growing the block a third field was the alternative, and
  it costs a third schema key per role plus a fourteenth interview question in
  phase 3 to keep a mechanism no evidence shows changing an outcome. Retires
  `route.mjs:1058-1120`, `route-cells.mjs:60,241-259` and rule R3's subject in
  `trace-suggest.mjs:399-410,508-525` when phase 3 lands; `--attempt` stays as a
  trace label.
- D-02 (unknown model): A `roles.<role>.model` the host does not accept resolves
  with `ok: true`, the routed cell's model in the envelope, and a `warnings[]`
  entry naming the rejected string. Evidence: this is byte-for-byte what
  `route.mjs:1324-1338` already does for an unrecognized `model.overrides`
  alias, and `cadence-core/references/seam-spawn-agent.md:290-292` already
  documents it, so the branch costs no new behaviour. Refusing with `ok:false`
  was rejected because the caller contract turns that into a dispatch of the
  base agent at the session default, which is BELOW every risk floor
  (`route.mjs:14-15,86-93`), so a typo would silently drop a secrets-touching
  phase off its floor. Pass-through was rejected on measured evidence: the
  host's agent-dispatch `model` parameter is an enum of exactly `sonnet`,
  `opus`, `haiku`, `fable`, verified 2026-09-04 against this session's own tool
  schema, so an unknown string fails input validation on every dispatch rather
  than erroring gracefully. That same measurement answers the analyzer's first
  research flag and confirms `route-table.json:20`'s hand-copied
  `model_aliases` is accurate at this host version.
- D-03 (precedence): Where a roles entry and the older
  `model.overrides.<role>` / `model.effort.<role>` name the same role, the roles
  block wins, the older keys stay live as the narrower fallback, and setting
  both for one role emits a `warnings[]` entry naming the winner. Evidence:
  `/code/cadence/.planning/config.json` sets four `model.effort.*` values AND
  `model.overrides.cad-planner: "fable"` AND `stakes: critical` at once, and a
  live resolve on 2026-09-04 returns `model: "fable"`, `effort: "xhigh"`,
  `pinned: true` for `cad-planner`. Winning silently was rejected: it would
  change what Cadence-on-Cadence runs at with no notice, and the four
  `model.effort` `reason` lines at `route.mjs:987-1048` would become claims
  about a rung that did not apply - the resolved-then-dropped shape the `reason`
  array exists to prevent.
- D-04 (floor clamp): A roles-block `effort` is clamped up by a raised risk
  floor on exactly the terms `model.effort.<role>` is clamped today. Evidence:
  `route.mjs:1009-1046` gates the clamp on a raise rather than on a floor merely
  being computed, and `cadence-core/references/config-reach.md:114-119` states
  the "floored by any detected risk surface" claim for the key that decides the
  rung. Leaving the user's rung absolute was considered and rejected: it would
  let a phase touching the `secrets` surface run at whatever cheap rung was
  pinned once, and would make that config-reach clause false.
- D-05 (resolve shape): The roles block is read in `readConfig` beside the
  existing `model.*` family and applied inside `resolve()` AFTER the cell
  lookup, never instead of it. Evidence: `route.mjs:247-296`, `:958-972`,
  `:1194-1267`, `:1386` - `review`, `verify`, `reviewer_tiers` and
  `reviewer_efforts` all come off the same stakes level, and the torn-table
  guard refuses the whole bundle when the cell is missing. Bypassing the cell
  lookup was the alternative and it makes the `unresolved` arm unreachable and
  drops the entire cross-model review wiring from every dispatch.
- D-11 (pin reporting): `pinned: true` keeps meaning "`model.overrides` chose
  this model" and the envelope grows a SEPARATE field naming where the resolved
  model came from. Evidence: `route.mjs:1322-1338`, `:1349-1365`, and
  `seam-spawn-agent.md:309-317`, which requires a caller to announce a pinned
  dispatch on its own line before spawning because the approval dialog shows the
  agent and not the model. Setting `pinned` for every roles-block dispatch was
  rejected: the announcement would fire on every spawn, which is the
  warning-fatigue failure `seam-spawn-agent.md:276-283` already legislates
  against; leaving it unset with no replacement field silently retires the
  approval-dialog rule at exactly the moment a user can name any model.

## Decisions

- D-06 (schema shape): The block lands as flat dotted schema keys named per
  role - `roles.cad-planner.model`, `roles.cad-planner.effort` and so on,
  twelve in all - never a wildcard or a `roles.*` pattern. Evidence:
  `cadence-core/config.schema.json:6-103` is one flat `keys` map of dotted
  strings, and `cadence-core/bin/config.mjs:216-226` flattens the file to dotted
  leaves and looks each up with `Object.hasOwn(SCHEMA, path)`; the only pattern
  machinery in the file, `LEVEL_KEY` at `:379`, shapes a warning and does not
  admit a key.
- D-07 (reach work): `config.mjs get`/`set` reach the new keys for free once the
  schema holds them, so the work behind that criterion is the schema entries, a
  `config-reach.md` row per key, and at least one two-segment prose token per
  role in a walked markdown file. Evidence: `config.mjs:394-473`, `:237-290`,
  `:298-331`; `lib/config-reach.mjs:148-173` files `missing-reach-row` per
  schema key with no row; `self-verify.mjs:781-785` files `inert-config-key`,
  `:368-381` names the walked dirs, and `:591` excludes the reach doc's own
  tokens. Precedent: `config-catalog.md:26` - the twelve existing per-role keys
  carry no catalog row and stay covered by the bare tokens `model.effort` and
  `model.overrides`. Tokenizer trap to avoid: `self-verify.mjs:577-601` expands
  only `<t>/<trigger>` and `<name>/<provider>`, so writing `roles.<role>.model`
  in a walked markdown file produces an `unknown-config-key` problem.
- D-08 (fallback proof): The `stakes`-only fallback is proved by holding the
  existing hand-typed 18-cell `CELLS` fixture against a config carrying no roles
  block; expectation data stays hand-written and is never derived from
  `route-table.json`. Evidence: `cadence-core/bin/route.test.mjs:80-130`, whose
  stated rule is that a fixture deriving expectations from its subject cannot
  fail, with the mutation-proved loss recorded at `:83-84`.
- D-09 (fallback granularity): Silence in the roles block falls back per KEY,
  not per role. Evidence: `cadence-core/bin/lib/config-merge.mjs:75-86` recurses
  nested objects key by key while arrays and scalars replace wholesale, and
  `route.mjs:247-296` reads leaves. Per-role fallback was the alternative and it
  would stop a global layer naming only `roles.cad-planner.model` from composing
  with a repo layer naming only `roles.cad-planner.effort`.
- D-10 (types and drift guard): `model` is typed `string_or_null` with no
  `grammar` marker, `effort` is a per-role `enum` over that role's own rung keys
  plus `null`, and the schema-vs-`RUNG_FILES` drift guard is extended to the new
  key prefix. Evidence: `config.mjs:64-94` already has both shapes and
  `:116-149` errors on an unknown grammar marker; `lib/rung-agent.mjs:286-341`
  keys `effortEnumIssues` on `EFFORT_PREFIX = 'model.effort.'` in both
  directions including the `unknown-effort-role` reverse walk;
  `self-verify.mjs:1179-1191` runs check 8b outside the table guards on purpose.
  A single shared enum over `rung_order` was the alternative and it costs the
  per-role refusal message naming the rungs that role actually has.

## Acceptance criteria

- [ ] AC1: A config naming only `roles.cad-planner.model` and
      `roles.cad-planner.effort` makes
      `node cadence-core/bin/route.mjs resolve --role cad-planner` return that
      model and that effort, and `agent` names that role's rung file for that
      effort.
- [ ] AC2: A config carrying only `stakes` and no `roles` block resolves
      identically to HEAD across all eighteen cells, checked against the
      hand-written `CELLS` fixture in `cadence-core/bin/route.test.mjs:80-130`.
- [ ] AC3: A `roles.<role>.model` outside the four aliases resolves with
      `ok: true`, carries the routed cell's model in the envelope, and adds a
      `warnings[]` entry naming the rejected string.
- [ ] AC4: A config setting both `roles.cad-planner.effort` and
      `model.effort.cad-planner` resolves to the roles value and emits a
      `warnings[]` entry naming which key won.
- [ ] AC5: With a raised risk floor, a `roles.<role>.effort` below the floored
      rung does not apply and `reason` names the raise.
- [ ] AC6: `node cadence-core/bin/config.mjs get` and `set` succeed for all
      twelve roles-block keys, and `node cadence-core/bin/self-verify.mjs`
      reports `ok: true` with no `missing-reach-row`, no `inert-config-key` and
      no `unknown-config-key`.
- [ ] AC7: The block carries exactly `model` and `effort` per role -
      `node cadence-core/bin/config.mjs validate` reports `unknown key` for
      `roles.<role>.retry`.

## Flagged assumptions

- The host's agent-dispatch `model` parameter is an enum of exactly `sonnet`,
  `opus`, `haiku`, `fable` - Confident for this host version, verified
  2026-09-04 against the live tool schema; if wrong, or once a host release
  widens it, D-02's warn-and-stand arm starts rejecting model names the host
  would in fact have accepted, and the four-name list in `route.mjs:1324-1338`
  becomes the new hand-copied mirror the cycle set out to delete.
