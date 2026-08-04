---
phase: 4
plan: 1
requirements:
  - DOC-01
  - RNG-02
files:
  - cadence-core/config.schema.json
  - cadence-core/bin/config.mjs
  - cadence-core/bin/config.test.mjs
  - cadence-core/bin/route.mjs
  - cadence-core/bin/route.test.mjs
  - cadence-core/bin/lib/rung-agent.mjs
  - cadence-core/bin/lib/route-cells.mjs
  - cadence-core/bin/rung-agent.test.mjs
  - cadence-core/bin/lib/route-relay.mjs
  - cadence-core/bin/route-relay.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/route-table.json
  - cadence-core/references/config-reach.md
  - cadence-core/references/seams.md
  - cadence-core/references/review-triggers.md
  - cadence-core/workflows/config.md
  - cadence-core/workflows/verify.md
  - skills/cad-plan-checker-contract/SKILL.md
  - CHANGELOG.md
  - README.md
  - INTERNALS.md
  - METHOD.md
  - .planning/phases/4/ladder-claims.md
---

# Phase 4: The ladder is what it says it is - Plan

## Goal

The rung ladder becomes a dial the user can actually turn and a claim the repo
can actually keep. Per-role effort is settable from the config layers, floored
by the risk surface, never demoted by a retry, and refused by key when it names
a rung the role does not have; `route.mjs`'s `warnings` array stops sitting
unread in JSON; and every live claim about the ladder is verified against
`route-table.json` after the two cells that should start where they used to
climb are retuned.

## Must be true when done

- A repo-layer `model.effort.cad-verifier=xhigh` makes
  `route.mjs resolve --role cad-verifier` at the default `shipped` level report
  `effort: "xhigh"` and `agent: "cad-verifier-xhigh"` instead of the cell's
  `medium`/`cad-verifier-medium`, and no file under the plugin root changed -
  the setting survives a plugin update because it never lived there.
- `config.mjs set model.effort.cad-executor=max` is refused, naming the key and
  the rungs `cad-executor` actually has, and writes nothing; `self-verify`
  fails naming the key when a shipped `model.effort.<role>` enum stops matching
  that role's rungs in `lib/rung-agent.mjs`, and reports `ok:true` on the
  shipped tree.
- A configured start rung below a computed risk floor resolves AT the floor
  with the surface holding that floor named in the output - including on a
  project whose own `stakes` already sits at the surface's floor, where nothing
  was raised - and adding that surface's `risk.override.<surface>` - and
  nothing else - is what lets it sit lower.
- `--attempt 2` never resolves below the rung the first attempt ran at: a
  configured start at or above the cell's retry rung holds and says which cell
  rung it out-ranks, a start below it climbs exactly as it does today.
- An `ok:false` resolve carries what the config read found wrong: an
  unknown-role and an unresolvable-stakes return both report `warnings[]` for a
  config holding a retired key, where today both drop it.
- Every shipped prose block that issues `route.mjs resolve` as a
  `${CLAUDE_PLUGIN_ROOT}` command carries the relay rule for `warnings[]`, and
  `self-verify` names the file when one does not.
- Every live claim about the rung ladder matches `route-table.json` after the
  retune - `critical`/`cad-plan-checker` and `shipped`/`cad-reviewer` start at
  `xhigh` - with each audited claim listed in the SUMMARY by `file:line` and
  verdict, and the retune's forward correction under `## [Unreleased]`.

## Context

CONTEXT.md's decisions are locked and each has a task: D-01 floor-wins (task 3),
D-02 retry rule (task 4), D-03 six explicit schema keys (task 2), D-04 warnings
structural (tasks 5 and 7), D-05 and D-06 the audit and its surface (tasks 1 and
9), D-07 the retune (task 8), D-08 refusal faces split across `config.mjs` and
`self-verify` (tasks 2 and 6), D-09 reach rows but no interactive-catalog rows
(task 2), D-10 relay presence not repetition (task 7). D-11 is settled research
and needs no task: the host does return a Bash subprocess's stderr, and D-04's
chosen mechanism deliberately does not use it.

Follow the house split every seam here already uses: a PURE lib returning
`{code, detail}` entries, and the caller (`self-verify.mjs`) doing the I/O and
the envelope - `lib/route-cells.mjs`, `lib/config-reach.mjs` and
`lib/dispatch-phrasing.mjs` are the three worked examples. Baseline before task
1: 1067 tests pass, `self-verify` is `ok:true`, and every budgeted surface sits
exactly at its budget, so any edit to `cadence-core/workflows/*` or
`skills/*/SKILL.md` needs `weight-budgets.json` regenerated in the same commit.
`cadence-core/references/` carries no budget.

Out: agent frontmatter, new dispatch machinery, `model.escalate_on_failure`
semantics, interactive-catalog rows, and the four phase-3 open `route.mjs`
items (see Notes).

## Tasks

### Task 1: Pin the current ladder claims before anything moves

- **Files:** `.planning/phases/4/ladder-claims.md`
- **Action:** Write the audit roster FIRST, against HEAD, so the later tasks
  are checked against a list nobody assembled after the fact. Run a path-scoped
  grep for ladder vocabulary (`rung`, `retry`, `escalat`, `effort`, `ladder`,
  `climbs`) over the LIVE surfaces only - `README.md`, `INTERNALS.md`,
  `METHOD.md`, `cadence-core/references/`, `cadence-core/workflows/`,
  `agents/`, `skills/` - plus `CHANGELOG.md`'s `## [Unreleased]` section.
  `DESIGN.md`, `LINEAGE.md` and every dated `CHANGELOG.md` section are OUT by
  D-06: they are append-only records corrected forward, and a repo-wide grep
  over them is the failure `.planning/CAPTURE.md:143` records from phase 3.
  Record one row per hit: `file:line`, the claim in the author's own words, and
  a verdict of `true` / `contradicts the table` / `stale`, each verdict backed
  by a `route.mjs table` read or a `route.mjs resolve` run rather than by
  reading the JSON by eye. The known-live hits this file must at minimum
  account for: `README.md:39` (the planner's `critical` cell and its `max`
  retry), `README.md:43` (escalation is one key), `README.md:130` ("6 agent
  roles across 19 rung files"), `INTERNALS.md:11` (19 files, six roles, the
  three CI guarantees), `INTERNALS.md:13` (the retry-climbs sentence and the
  demotion refusal), `INTERNALS.md:17` ("18 cells"),
  `cadence-core/references/seams.md:112-117` (the retry bullet),
  `cadence-core/references/review-triggers.md:75-84` (the reviewer rung PER
  LEVEL - "`cad-reviewer-medium` at solo, `cad-reviewer` at shipped,
  `cad-reviewer-xhigh` at critical" - and the worked example on line 83, "the
  shipped level dispatches `cad-reviewer`, pinned at `high`"; this is the one
  live claim task 8's retune actually falsifies, and the enumeration lines
  themselves carry none of the grep tokens, so a token-only sweep can verdict
  the bullet `true` off a neighbouring line),
  `cadence-core/workflows/config.md:29-32` ("Three sets stay edit-the-file-only
  and have no catalog row"), `cadence-core/workflows/config.md:80` (the
  `model.escalate_on_failure` catalog row), and
  `skills/cad-plan-checker-contract/SKILL.md:19-26` (the `<rung>` block). This
  file is the phase's DURABLE audit record: task 9 finalizes it in place and
  states it verbatim in the executor report for the execute workflow's `summary`
  step to carry into SUMMARY.md - executors never write SUMMARY.md
  (`cadence-core/workflows/execute.md:276`).
- **Verify:** `.planning/phases/4/ladder-claims.md` carries a row for each of
  the eleven `file:line` citations above plus every other grep hit that states
  a ladder claim; each of the eleven citations greps out of the roster
  individually (`grep -c 'README.md:39' ...` and so on, at least 1 each - the
  count floor alone passes with eleven arbitrary rows);
  `grep -c '^|' .planning/phases/4/ladder-claims.md` is at least 11. The raw
  grep returns on the order of 170 hits, most of them not claims (rung-file
  `effort:` frontmatter, incidental vocabulary like "does not retry"), so the
  roster's header must state the raw hit count and the count classified as
  non-claims - the filtering is recorded, never silent. The grep command used
  is recorded at the top of the file so task 9 can re-run it verbatim.

### Task 2: The six `model.effort.<role>` keys, refused by key at the write face

- **Files:** `cadence-core/config.schema.json`, `cadence-core/bin/config.mjs`,
  `cadence-core/references/config-reach.md`,
  `cadence-core/references/seams.md`, `cadence-core/workflows/config.md`,
  `cadence-core/bin/weight-budgets.json`, `cadence-core/bin/config.test.mjs`,
  `cadence-core/bin/self-verify.test.mjs`
- **Action:** Add six keys to `config.schema.json` beside the
  `model.overrides.<role>` block, spelled out one per role in the same order
  (D-03): `model.effort.cad-planner`, `model.effort.cad-assumptions-analyzer`,
  `model.effort.cad-verifier`, `model.effort.cad-reviewer`,
  `model.effort.cad-executor`, `model.effort.cad-plan-checker`. Each is
  `"type": "enum"` with `"default": null` and `values` set to EXACTLY that
  role's rungs from `lib/rung-agent.mjs`'s `RUNG_FILES`, in that map's declared
  order, with `null` last: planner `["high","xhigh","max",null]`, analyzer
  `["high","xhigh",null]`, verifier `["medium","high","xhigh","max",null]`,
  reviewer `["medium","high","xhigh","max",null]`, executor
  `["high","xhigh",null]`, plan-checker `["low","medium","high","xhigh",null]`.
  NO `src` field: D-03 puts the value in either config layer, unlike the
  repo-scoped `risk.override.*` family. Each `purpose` says the key names the
  rung this role STARTS at, that null routes normally off the cell, that a rung
  the role does not have is refused, and that a value below a computed risk
  floor resolves at the floor. In `config.mjs`, render `null` as the literal
  `null` in `checkValue`'s enum error (`spec.values.map(v => v === null ?
  'null' : v).join(', ')`) - the refusal AC2 is about currently ends in a
  dangling `", "` where the null sits, which reads as a truncated message
  rather than as a settable value. Add six `## Reach rows` rows to
  `references/config-reach.md` with reach `universal` and an `Honoured by` cell
  naming `bin/route.mjs` and what the value selects (check 9 fails without
  them), and in the same file drop the stale "all 72 keys" count at line 28 to
  a count-free phrasing - the doc's own rule at lines 58-62 is that a stated
  count goes stale, and it already has. In `references/seams.md`'s spawn-agent
  Routing section add a `**Per-role start rung.**` bullet beside the existing
  per-role-pin bullet stating what this task ships and nothing more: the family
  token `model.effort` names the rung a role starts at, one key per role
  (`model.effort.cad-verifier` and so on), the accepted values are that role's
  own rungs, and `config.mjs` refuses any other. Write the FAMILY token
  `model.effort` in that prose, never `model.effort.<role>`: `expand()` in
  `self-verify.mjs` has no `<role>` placeholder, so the angle-bracket spelling
  reports `unknown-config-key` while the two-segment family token satisfies
  check 1 in both directions. In `cadence-core/workflows/config.md` change the
  "Three sets stay edit-the-file-only and have no catalog row" sentence to name
  four sets, adding the six `model.effort` per-role start rungs beside the
  `model.overrides` pins - no catalog rows (D-09), just the carve-out, because
  the sentence becomes false the moment six catalog-less keys ship. The six new
  keys break ONE existing self-verify fixture: the `placeholder keys expand:
  <t> prose covers every trigger key` row
  (`cadence-core/bin/self-verify.test.mjs:263`) enumerates every key and family
  in its fixture prose and asserts `ok:true` at line 285, so once the six keys
  land check 1b reports six `inert-config-key` problems inside it. Add the
  two-segment family token `model.effort` to that fixture's prose - the single
  token clears all six (verified: six keys, six reach rows and one
  `model.effort` prose mention returns `ok:true, problems:[]`). This is the
  only existing test row this task edits. Then run
  `node cadence-core/bin/weight.mjs` and update `weight-budgets.json`'s
  `cadence-core/workflows/config.md` entry to the reported bytes.
- **Verify:** `node cadence-core/bin/config.mjs check
  model.effort.cad-executor=max` prints `ok:false` with a detail entry whose
  `key` is `model.effort.cad-executor` and whose `error` reads `must be one of:
  high, xhigh, null`; `node cadence-core/bin/config.mjs check
  model.effort.cad-verifier=xhigh` prints `{"ok":true}`; `node
  cadence-core/bin/self-verify.mjs` prints `ok:true` with an empty `problems`
  array (proving the six keys are neither inert nor missing a reach row and no
  budget overran); `node --test cadence-core/bin/*.test.mjs` exits 0 with new
  `config.test.mjs` rows covering the accepted rung, the refused rung, the
  `null` rendering, and the WRITE face the AC names: `set
  model.effort.cad-executor=max` against a repo config file returns the same
  by-key refusal and leaves the file byte-identical (snapshot before, compare
  after) - `check` alone cannot prove `set` writes nothing.

### Task 3: `route.mjs` starts a role at the configured rung, floored

- **Files:** `cadence-core/bin/route.mjs`, `cadence-core/bin/route.test.mjs`,
  `cadence-core/references/seams.md`
- **Action:** In `readConfig`, add `effort: m.effort ?? {}` beside `overrides`,
  with the same comment reason the `riskOverrides` field carries - it is a
  separate map so a config holding both a pin and a start rung has one writer
  each. Change `riskFloor` to return `{level, floorSurfaces}` instead of a bare
  level string, where `level` is the `effective` it already computes and
  `floorSurfaces` is the NAMES of the unwaived DETECTED surfaces that HOLD that
  level - the `matches` list already in hand, filtered by
  `raiseTo(effective, m.floor, order) === m.floor`, which says "this surface's
  own floor sits at or above the level being returned" through the one
  comparison helper every level test in this seam goes through - and is `[]` on
  all four early returns (pre-plan role, out-of-shape `--phase`, no cursor, no
  unwaived match). Update `riskFloor`'s JSDoc at `route.mjs:200` in the same
  edit: `@returns {string} the effective level` becomes the two-field
  `{level, floorSurfaces}` shape, and the sentence above it naming "the
  effective level" follows - the file is under `// @ts-check`, so the stale
  annotation is a hard `tsc -p tsconfig.ci.json` error (TS2322), and only task
  9 runs tsc, eight tasks late. NOT "the surfaces that moved the baseline": every surface in
  `cadence-core/route-table.json` declares `"floor": "critical"`, so on a
  project already at `stakes: critical` a detected, unwaived `auth` moves
  nothing, a moved-the-baseline test yields `[]`, and
  `model.effort.cad-executor=high` would resolve at `high` on an auth/secrets/
  migrations phase with no `risk.override.<surface>` named and no hold - the
  second, unnamed way down D-01 rejects, handed to the exact population STK-03
  exists to protect, while a `shipped` project with the identical phase is held
  at `xhigh`. The existing reason loop keeps its own
  `raiseTo(baseline, m.floor, order) !== baseline` test untouched: that one
  picks the PHRASING (moved the baseline vs the raise-never-caps line), this one
  decides whether a floor is in force. A detected surface whose floor sits below
  the returned level is correctly absent from `floorSurfaces` - it changes no
  knob today either, and what holds the level there is the baseline, which is
  not a floor. In `resolve`, destructure it and apply the configured start
  rung AFTER the cell lookup and BEFORE `agentFor`: read `cfg.effort[opts.role]`,
  and when it is neither null nor undefined take exactly one of four arms.
  (a) `rungFile(opts.role, wanted)` is null - the value names a rung this role
  has no file for, which only a hand-edited config reaches past the schema
  enum: keep the cell's rung, and push a `warnings` entry naming
  `model.effort.<role>`, the value, that role's rungs from `RUNG_FILES`, and
  the cell rung that stands. Do NOT hand an unmapped rung to `agentFor`: its
  fail-open dispatches the base file while reporting the requested rung, which
  is the report-a-rung-nothing-ran-at shape `rungEffortIssue` exists to close.
  (b) `floorSurfaces` is non-empty and `wanted` sits BELOW `cell.effort` in the
  table's `rung_order` - hold at `cell.effort` and push a `reason` entry naming
  the key, its value, the floor rung, and every name in `floorSurfaces`,
  because AC3 requires the surface to be named in the output and
  `risk.override.<surface>` stays the only way below a floor (D-01). When
  `floorSurfaces` is non-empty but `rung_order` cannot compare the two rungs
  (either index is `-1`), hold at `cell.effort` too and name `rung_order` in
  `warnings` - a floor that cannot be proven is never lowered.
  (c) `wanted === cell.effort` - push a `reason`
  entry saying it is already the routed rung, matching the pin arm's own
  already-the-routed-model line. (d) otherwise the configured rung wins: set
  `effort = wanted` and push a `reason` entry naming the key, the value and the
  `<stakes>/<role>` cell rung it replaces. `agentFor(effort)` then picks the
  file, unchanged. Note in the header comment's `Config keys read:` block that
  `model.effort.<role>` is read. In `references/seams.md`, extend the
  `**Per-role start rung.**` bullet with the floor rule only - a configured
  rung is raised to the floored cell's rung when a risk surface fired, and
  `risk.override.<surface>` is the only way under it.
- **Verify:** `node --test cadence-core/bin/route.test.mjs` exits 0 with new
  rows proving each arm, every one written so it FAILS if the config value is
  dropped: a `shipped` config setting `model.effort.cad-verifier=xhigh`
  resolves `effort:"xhigh"`, `agent:"cad-verifier-xhigh"` (the shipped cell is
  `medium`/`cad-verifier-medium`, so the row discriminates); a `solo` config
  setting `model.effort.cad-planner=max` resolves `agent:"cad-planner-max"`; a
  LAYERED row in `route.test.mjs:394`'s deep-merge family: a global layer file
  WITHOUT the key plus a repo layer file setting
  `model.effort.cad-verifier=xhigh` resolves `xhigh` - pinning that the key is
  read from the merged config layers (the update-survival claim itself), never
  from a plugin-root file; a
  hand-written `model.effort.cad-executor="max"` keeps `effort:"high"` and adds
  a warning naming the key; and THREE floor rows, not two - (i) a `shipped`
  config plus a phase PLAN declaring an `auth` path with
  `model.effort.cad-executor=high` resolves `effort:"xhigh"` with a `reason`
  entry naming `auth`; (ii) the same fixture plus `risk.override.auth=true` in
  the repo layer resolves `effort:"high"`; (iii) a `stakes: critical` config
  over that same `auth`-declaring PLAN with `model.effort.cad-executor=high`
  ALSO resolves `effort:"xhigh"` with `auth` named, and drops to `effort:"high"`
  only once `risk.override.auth=true` is added. Row (iii) is the one that fails
  if `floorSurfaces` is computed as "moved the baseline"; rows (i) and (ii) pass
  either way, so neither can stand in for it. `npx tsc -p tsconfig.ci.json`
  exits 0 - the `riskFloor` return-shape change and its JSDoc land in THIS
  task, so this task proves the type contract rather than deferring it eight
  tasks to task 9.

### Task 4: A retry never resolves below the rung that failed

- **Files:** `cadence-core/bin/route.mjs`, `cadence-core/bin/route.test.mjs`,
  `cadence-core/references/seams.md`
- **Action:** Rewrite the `(opts.attempt || 1) > 1` arm's target selection so
  attempt 2 resolves at `max(cell.retry, resolved start)` in `rung_order`
  (D-02): compute both indices, take whichever rung sits LATER, and fall back
  to `cell.retry` verbatim when either index is `-1` so a torn table behaves
  exactly as it does today. Three outcomes, three messages. Target differs from
  the start rung: unchanged - `escalated = true`, `agent = agentFor(target)`,
  and the existing `rung <from>-><to> (<agent>)` reason. Target equals the
  start rung AND `cell.retry` equals it too: the existing honest no-op line.
  Target equals the start rung because the CONFIGURED start out-ranks the
  cell's retry: a new reason line naming the configured start and the lower
  `<stakes>/<role>` retry rung it out-ranks, with `escalated` false - a retry
  that thought less while reporting an escalation is the `rung-demotion` defect
  `lib/route-cells.mjs:284-290` refuses in the table, and the config layer is
  the second door onto it (`.planning/CAPTURE.md`, phase 1, on `escalate_to`
  accepted without a direction check). `model.escalate_on_failure: false` keeps
  its own arm ahead of all three, unchanged. Extend the
  `**Per-role start rung.**` bullet in `references/seams.md` with the retry
  rule in one sentence.
- **Verify:** `node --test cadence-core/bin/route.test.mjs` exits 0 with rows
  proving: a `shipped` config setting `model.effort.cad-verifier=xhigh` at
  `--attempt 2` resolves `effort:"xhigh"`, `escalated:false` and a `reason`
  matching `/retry rung "high"/` (the cell's retry is `high`, so this row fails
  if `max()` is dropped); a `shipped` config setting
  `model.effort.cad-verifier=medium` at `--attempt 2` still resolves
  `effort:"high"` with `escalated:true`; and every existing cell row in the
  `CELLS` loop still passes untouched.

### Task 5: An `ok:false` resolve carries what the config read found wrong

- **Files:** `cadence-core/bin/route.mjs`, `cadence-core/bin/route.test.mjs`
- **Action:** Make `warnings[]` complete in the envelope (D-04). Move the
  `readConfig(opts.file)` call ABOVE the `roles.includes(opts.role)` check and
  include `...(cfg._warnings.length ? { warnings: cfg._warnings } : {})` in the
  `unknown-role` return, which today returns before config is read at all; add
  the live `warnings` array to the `unresolved` return the same way, where it
  already carries the retired-key, torn-layer, global-waiver and floor
  diagnostics and drops every one of them. Leave the three `usage` refusals
  alone and say why in a comment: they fail on argument shape before any file
  is named, so there is no layer whose diagnostics could ride along. The
  observable this closes is the one `.planning/CAPTURE.md` (phase 2) filed - a
  breaking-change notice sitting unread in JSON while a stale config redirects
  every dispatch.
- **Verify:** `node --test cadence-core/bin/route.test.mjs` exits 0 with two
  rows that fail when the warning is dropped: `resolve --role cad-nonesuch`
  against a config carrying a retired key returns `ok:false`,
  `reason:"unknown-role"` AND a `warnings` array naming that key; `resolve
  --role cad-planner` against a config whose `stakes` is a value no cells row
  holds returns `ok:false`, `reason:"unresolved"` AND the same warning.

### Task 6: `self-verify` proves each shipped effort enum is that role's rung set

- **Files:** `cadence-core/bin/lib/rung-agent.mjs`,
  `cadence-core/bin/self-verify.mjs`, `cadence-core/bin/rung-agent.test.mjs`,
  `cadence-core/bin/self-verify.test.mjs`
- **Action:** Add a pure `effortEnumIssues(schema, rungOrder)` export to
  `lib/rung-agent.mjs` - it belongs there because `RUNG_FILES` is the statement
  it checks against, and the file already exports problem codes for a caller to
  wrap. It returns `{code, detail}` entries, every detail NAMING THE KEY (D-08:
  self-verify's half of AC2 is proving the shipped schema agrees with
  `RUNG_FILES` and `route-table.json`, since it never reads a user config and
  cannot refuse a user value). Three codes: `missing-effort-key` for a role in
  `RUNG_FILES` with no `model.effort.<role>` schema key;
  `unknown-effort-role` for a `model.effort.<X>` key naming a role `RUNG_FILES`
  does not hold; `effort-enum-drift` for a key whose `values` are not exactly
  that role's rungs in declared order followed by `null`, or that hold a rung
  absent from the caller's `rungOrder` - the detail states what the key holds
  and what the map says. An empty or absent `rungOrder` skips only that last
  arm, matching how `cellIssues` tolerates an absent vocabulary. Call it from
  `self-verify.mjs` OUTSIDE both of check 8's table guards, as its own step
  after check 8's `} else if (isFullTree) {` arm closes - number it `8b` in the
  house style check `7b` already uses (`self-verify.mjs:648`): hoist `let table =
  null;` above the `if (existsSync(routeTablePath))` line - the same hoist, for
  the same stated reason, that `agentFiles` already carries at
  `self-verify.mjs:542-546` - leave the read and the parse exactly where they
  are, and call `effortEnumIssues(schema, table && Array.isArray(table.rung_order)
  ? table.rung_order : [])`, where `schema` is the `keys` map the run already
  holds (`self-verify.mjs:271-273`). Nesting the call under
  `if (table && typeof table === 'object' ...)` would make a schema-vs-
  `RUNG_FILES` proof conditional on `cadence-core/route-table.json` existing AND
  parsing - the two trees where a drifted enum is likeliest and least noticed -
  and would contradict this function's own tolerance of an absent `rungOrder`,
  which exists so it can run without a table. File each issue with
  `file: 'cadence-core/config.schema.json'` (the file a maintainer edits to fix
  it, not the table), and add `effort-enums` to the `checked:` string the entry
  point emits. Expect this to add six `missing-effort-key` entries to
  `reachFixture`'s trees (`self-verify.test.mjs:40-56` writes a synthetic
  three-key schema): every assertion over those trees filters by `kind`. The
  `ok:true` row on the real repo (`self-verify.test.mjs:196-200`) is
  unaffected; the `:263-286` fixture is repaired in TASK 2 (its prose gains the
  `model.effort` family token when the six keys land) - so by this task the
  suite exits 0 with one existing row edited back in task 2 and none here.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `ok:true` on the
  shipped tree; `node --test cadence-core/bin/rung-agent.test.mjs` exits 0 with
  one row per code, including a mutation row that drops `max` from the
  planner's enum and asserts `effort-enum-drift` naming
  `model.effort.cad-planner`; `node --test
  cadence-core/bin/self-verify.test.mjs` exits 0 with a `--root` fixture that
  writes its own `config.schema.json` carrying a drifted effort enum and ships
  NO `cadence-core/route-table.json` at all - the tree that proves the check is
  not conditional on the table - whose `problems` include `effort-enum-drift`
  naming the drifted key.

### Task 7: Every prose site that issues a resolve carries the relay rule

- **Files:** `cadence-core/bin/lib/route-relay.mjs` (new),
  `cadence-core/bin/route-relay.test.mjs` (new),
  `cadence-core/bin/self-verify.mjs`, `cadence-core/bin/self-verify.test.mjs`,
  `cadence-core/workflows/verify.md`, `cadence-core/bin/weight-budgets.json`
- **Action:** Write `lib/route-relay.mjs` as a pure lib in the shape
  `lib/dispatch-phrasing.mjs` established - a `CODE` export
  (`unrelayed-route-resolve`), one `relayIssues(text)` function, a header
  comment stating the rule and its accepted cost, no fs/emit/process. The rule:
  a prose file that ISSUES a resolve must carry the relay rule somewhere in it.
  An ISSUE is the `${CLAUDE_PLUGIN_ROOT}` invocation form
  (`/\$\{CLAUDE_PLUGIN_ROOT\}\/\S*route\.mjs"?\s+resolve\b/`), never a
  backticked inline mention - `references/config-reach.md`, `workflows/plan.md`
  and `workflows/execute.md` all name `route.mjs resolve` in prose while
  issuing nothing, and a rule that could not tell those apart would demand a
  relay rule in a reach table. The RELAY statement is a paragraph (a run of
  non-blank lines, whitespace-collapsed) carrying both `\brelay\b`
  case-insensitively and `warnings` - both in ONE paragraph, so a `relay` in
  one section and a `warnings` in another cannot satisfy each other. Presence
  only, never per-dispatch repetition (D-10): the once-per-workflow-run scoping
  `references/seams.md:122-129` states is the rule being kept, not a phrasing
  to enforce per call. A non-string input returns `[]`. Each issue's detail
  names the 1-based line the invocation starts on. Call it from
  `self-verify.mjs` inside the existing `mdFiles(root)` loop, over EVERY
  surface that walk yields rather than check 10's two directories - a call site
  in `skills/` would relay nothing just as loudly - and add `route-relay` to
  the `checked:` string. Pin the CALL SITE's scope in `self-verify.test.mjs`
  with real rows, the way check 10's precedent does
  (`self-verify.test.mjs:1160`, "the references half of the scope is checked
  too"): a fixture tree whose `workflows/x.md` issues the
  `${CLAUDE_PLUGIN_ROOT}` resolve with no relay paragraph yields exactly one
  `unrelayed-route-resolve` naming that file; the same text plus the relay
  paragraph yields none; and a tree carrying the same resolve-issuing prose in
  `skills/a/SKILL.md` proves the walk reaches `skills/` - the widening over
  check 10's two directories this action argues for, pinned rather than left
  to a manual revert-and-re-run step. This check FAILS on the shipped tree the
  moment it lands: `cadence-core/workflows/verify.md` issues a resolve at its
  `deep_check` step and the file contains no `relay` at all. Fix it there, in
  one sentence beside that fenced command, telling the reader to relay any
  `warnings[]` entry the resolve returns before running the pass, citing
  `seams.md`, each distinct warning once per run. Then run `node
  cadence-core/bin/weight.mjs` and update `weight-budgets.json`'s
  `cadence-core/workflows/verify.md` entry.
- **Verify:** `node --test cadence-core/bin/route-relay.test.mjs` exits 0 with
  rows for: a text issuing the plugin-root resolve with no relay paragraph
  (one issue, naming the line), the same text plus the relay paragraph (no
  issue), a text that only mentions `route.mjs resolve` inline (no issue), a
  text whose `relay` and `warnings` sit in different paragraphs (one issue),
  and a non-string input (`[]`); `node --test
  cadence-core/bin/self-verify.test.mjs` exits 0 with the three call-site scope
  rows above (workflows tree fails, fixed tree passes, skills tree fails).
  `node cadence-core/bin/self-verify.mjs` prints
  `ok:true` on the shipped tree after `verify.md` is fixed, and reverting only
  that sentence makes it print a problem with
  `kind: "unrelayed-route-resolve"` and `file:
  "cadence-core/workflows/verify.md"`.

### Task 8: The retune - two cells start where they used to climb

- **Files:** `cadence-core/route-table.json`, `cadence-core/bin/route.test.mjs`,
  `cadence-core/bin/lib/route-cells.mjs`, `CHANGELOG.md`
- **Action:** Take the retune D-07 locks, from `.planning/CAPTURE.md` (phase
  4): set `cells.critical["cad-plan-checker"].effort` to `xhigh` (its `retry`
  already is) and `cells.shipped["cad-reviewer"].effort` to `xhigh` (same).
  Nothing else in the table moves. The rationale to carry into the CHANGELOG
  entry is the measured one: a retry rewrites the whole subagent prompt at the
  2x cache-write tier and re-runs every turn while effort costs only output
  tokens, so winning on attempt one is cheaper than climbing, and the plan
  checker is the case that matters most - one gate turn, and a plan waved
  through costs dozens of executor turns plus a revert. Update
  `route.test.mjs`'s hand-written `CELLS` rows for those two cells (`effort`
  and `agent`; `retry` and `retryAgent` are unchanged) - keep them
  hand-written, never derived from the table, for the reason the file's own
  comment states. TWO MORE existing rows fail under the retune and are named
  here so the executor repairs them deliberately instead of discovering them:
  (1) the `escalation fires at every stakes level, not just the default` row
  (`route.test.mjs:263`) asserts `escalated:true` at every level and
  `critical`/`cad-plan-checker` now holds - switch the row's role to
  `cad-planner` (solo -> `cad-planner-xhigh`, shipped -> `cad-planner-xhigh`,
  critical -> `cad-planner-max`, all `escalated:true`), a semantic repair that
  keeps a pinned per-level proof of the escalation claim rather than
  mechanically flipping the `critical` assertion to `false`; (2) the `layers
  deep-merge: a global model block and a repo stakes key combine` row
  (`route.test.mjs:394`) asserts `agent === 'cad-plan-checker-high'` at line
  402 for the critical cell's STARTING rung under `escalate_on_failure: false`,
  which the retune makes `cad-plan-checker-xhigh` - a one-literal update. Also
  correct the count the retune falsifies OUTSIDE task 1's audit scope: the
  rule comment at `cadence-core/bin/lib/route-cells.mjs:212` reads "two
  shipped cells hold their rung" and four hold after the retune - and do not
  just swap the number: three of the four are `critical` cells and one is
  `shipped`, so drop the ambiguous noun ("four cells in the shipped table hold
  their rung" or equivalent). DOC-01 is
  every shipped ladder claim true, and the path-scoped grep never reaches
  `bin/`. Then widen the `the two held retries say the rung was held`
  test to FOUR held cells: `critical`/`cad-assumptions-analyzer`,
  `critical`/`cad-executor`, `critical`/`cad-plan-checker` and
  `shipped`/`cad-reviewer` - it currently builds one config for `critical`
  only, so it needs a `(stakes, role)` pair list; all four hold at `xhigh`.
  Add the forward correction to `CHANGELOG.md` under `## [Unreleased]`,
  never inside the dated `[2.0.0]` section (D-06): name the two retuned cells,
  and state that `[2.0.0]`'s "the two cells whose retry deliberately equals
  their starting rung" now reads four. Confirm no rung file goes stale -
  `cad-plan-checker-high` stays reachable through solo's and shipped's retry,
  and `cad-reviewer`'s unsuffixed `high` file through solo's retry - which is
  what `undeclared-rung-agent` would otherwise catch.
- **Verify:** `node --test cadence-core/bin/route.test.mjs` exits 0; `node
  cadence-core/bin/self-verify.mjs` prints `ok:true` with an empty `problems`
  array (no `undeclared-rung-agent`, no `rung-demotion`); `node
  cadence-core/bin/route.mjs resolve --role cad-plan-checker --file
  <a config with stakes critical> --attempt 2` reports `effort:"xhigh"`,
  `escalated:false` and a `reason` matching `/rung held at xhigh/`.

### Task 9: Close the audit - every ladder claim true, corrected or gone

- **Files:** `.planning/phases/4/ladder-claims.md`, `README.md`,
  `INTERNALS.md`, `METHOD.md`, `cadence-core/references/seams.md`,
  `cadence-core/references/review-triggers.md`,
  `cadence-core/workflows/config.md`,
  `skills/cad-plan-checker-contract/SKILL.md`, `CHANGELOG.md`,
  `cadence-core/bin/weight-budgets.json`
- **Action:** Re-run task 1's recorded grep against the post-retune tree and
  reconcile it with the roster: every row gets a final verdict of `true`,
  `corrected` or `removed`, and any hit the re-run finds that the roster does
  not hold is added. Correct only claims the table CONTRADICTS - documenting
  the new `model.effort` key is task 2's job and is already done, and this task
  must not turn into a second documentation pass. The first of the two
  confirmed contradictions is
  `skills/cad-plan-checker-contract/SKILL.md:19-26`, stale on three counts:
  it says the rung differs "between the two files preloading this contract"
  when four agent files preload it (`cad-plan-checker`, `-medium`, `-high`,
  `-xhigh`), it names `low` and `high` as the only rungs when the map carries
  four, and it cites "auto mode", the `model.profile: auto` mode v2.0.0
  retired. The SAME file's frontmatter `description` (line 3) repeats the
  two-files claim - "preloaded into the cad-plan-checker and cad-plan-checker-high
  subagents" - and carries none of the grep tokens, so only this named fix
  catches it: reword to "preloaded into every cad-plan-checker rung agent",
  the phrasing every other role's contract description already uses, and add a
  roster row for it. Rewrite that block to name the role's four rungs, drop the retired
  mode, and keep its one real instruction - reason harder and be stricter on
  borderline BLOCKER vs WARNING calls at a higher rung, with what is checked
  and how it is reported identical at every rung. The second is
  `cadence-core/references/review-triggers.md:75-84`, which task 8's retune is
  what falsifies: its enumeration names `cad-reviewer` as the shipped level's
  reviewer rung and line 83's worked example says "the shipped level dispatches
  `cad-reviewer`, pinned at `high`", and after the retune shipped resolves
  `xhigh`. Rewrite the enumeration to `cad-reviewer-medium` at solo,
  `cad-reviewer-xhigh` at shipped AND critical, and `cad-reviewer-max` when a
  critical-level fire is re-dispatched with `--attempt 2` - the unsuffixed
  `cad-reviewer` (its `high` rung) is then reachable only through solo's retry.
  Rewrite line 83's example to a level whose reviewer rung still DIFFERS from
  the configured trigger effort, so it keeps teaching the rule it exists for:
  `diff` configured at effort `medium` while the shipped level dispatches
  `cad-reviewer-xhigh`, pinned at `xhigh`. That stays true permanently -
  `review.triggers.diff.effort`'s enum tops out at `high`
  (`cadence-core/config.schema.json:76`), so no configured value can ever equal
  `xhigh` and make the example self-cancel. `cadence-core/references/` carries
  no byte budget, so this edit needs no `weight.mjs` run. Then re-check
  `cadence-core/references/seams.md:112-117` and `README.md:39` against the
  retuned table specifically, since the retune is what could have falsified
  them too. Any edit to a budgeted surface (`skills/*/SKILL.md`,
  `cadence-core/workflows/*`) means running `node cadence-core/bin/weight.mjs`
  and updating `weight-budgets.json` in the same commit. Then add THREE roster
  rows the path-scoped grep cannot produce - one for the rule comment at
  `cadence-core/bin/lib/route-cells.mjs:212` task 8 corrected (verdict
  `corrected`, noting `bin/` sits outside the audit grep), and, because ROADMAP
  SC2 names the next claim explicitly and a verifier reading SC2 against the
  roster must find it: one for
  `CHANGELOG.md:191-198`, the rung-ladder paragraph the phase goal and SC2 both
  cite as `CHANGELOG.md:52` (entries prepend, so it moved down as the file grew;
  line 52 today is unrelated tokenizer prose), at verdict `corrected forward`,
  pointing at the `## [Unreleased]` entry task 8 wrote and stating that "the two
  cells whose retry deliberately equals their starting rung" now reads four; and
  one for the pre-`5b8728d` "reachable on a default install" wording (D-05) at
  verdict `corrected at 5b8728d, re-verified`, naming the live `route.mjs
  resolve` walk over all 18 cells that settled it and the post-retune count it
  produced (14 escalate, 4 hold). Neither row rewrites a dated section - D-06
  stands; the roster RECORDS what the dated text says and where it was corrected
  forward. Finalize the roster IN PLACE in
  `.planning/phases/4/ladder-claims.md` - it is the phase's durable audit
  record and stays on disk. Executors never write SUMMARY.md
  (`cadence-core/workflows/execute.md:276`; the workflow's own `summary` step
  is SUMMARY.md's only writer, from the executor reports). So: state the
  finished roster - `file:line`, claim, verdict, every row - verbatim in this
  task's section of the executor report, the way phase 3's plan did ("Record
  in this phase's SUMMARY, as SC3/AC5 require"), so the `summary` step carries
  it into SUMMARY.md and AC6/SC2 are met without a second writer.
- **Verify:** `.planning/phases/4/ladder-claims.md` carries a roster row for
  every hit of the re-run grep, each with a `file:line` and one of the three
  final verdicts, and no row's final verdict reads `contradicts the table`; it
  also carries the two grep-less rows - `grep -c 'CHANGELOG.md:191-198'
  .planning/phases/4/ladder-claims.md` is at least 1, and a row records the
  pre-`5b8728d` claim as re-verified against a live resolve; the executor
  report states the full roster verbatim (never assert on SUMMARY.md - it does
  not exist while the executor runs);
  `grep -n 'pinned at' cadence-core/references/review-triggers.md` returns
  exactly one line, naming `cad-reviewer-xhigh` pinned at `xhigh`;
  `grep -rn "auto
  mode" skills/ cadence-core/ agents/` returns nothing; `node --test
  cadence-core/bin/*.test.mjs` exits 0, `npx tsc -p tsconfig.ci.json` exits 0,
  and `node cadence-core/bin/self-verify.mjs` prints `ok:true` with an empty
  `problems` array.

## Notes

- **Plan shape.** CONTEXT's directive is one plan, and the file-independence
  test agrees: seven of the nine tasks touch `route.mjs`, `self-verify.mjs` or
  `route-table.json`, and the audit reads the table the retune changes. No
  deviation.
- **AC1 is satisfied but not falsifiable as written.** `shipped`/`cad-verifier`
  is ALREADY `medium`, so `model.effort.cad-verifier=medium` at `shipped`
  reports `effort:"medium"` whether or not the key is read. The AC1 command
  stays exactly as CONTEXT states it for the UAT walk; task 3's pinned tests
  deliberately use a value that DIFFERS from the cell (`xhigh`) so they fail
  when the config value is dropped. Both are required, neither replaces the
  other.
- **Task 1 runs before the code moves on purpose.** DOC-01's audit half is a
  claim about the tree at HEAD; assembling the roster after the retune and the
  new prose would audit this phase's own output and miss whatever it silently
  fixed.
- **`<role>` is not a self-verify placeholder.** `expand()` handles `<t>`,
  `<name>/<provider>` and `<surface>` only, so prose writing
  `model.effort.<role>` reports `unknown-config-key`. Adding a `<role>`
  placeholder was considered and left out: the two-segment family token
  `model.effort` already satisfies check 1 in both directions for all six keys,
  and widening `expand()` is scope neither requirement asks for. This is the
  same constraint `model.overrides` already lives under.
- **The four phase-3 open `route.mjs` items stay open** (`.planning/CAPTURE.md`,
  phase 4): the raw `cfg.stakes` index into `TABLE.cells`, `roles[]` unchecked
  by the cell walk, the unmapped-rung fail-open at the `agentFor` helper, and
  rung frontmatter `effort` unverified against its rung. The last one is
  already closed - `rungEffortIssue` and check 7b shipped - so CONTEXT's
  flagged assumption about it is stale and the SUMMARY should say so. The other
  three are separate defects with their own decisions; task 3 works next to the
  fail-open and deliberately routes AROUND it (an unmapped configured rung is
  refused rather than handed to it) rather than changing it, which would widen
  the diff on this phase's most-reviewed file for no requirement.
- **SC1's "fails self-verify by key" is satisfied in the D-08 split form, and
  the verifier must read it that way.** `self-verify` never reads a user
  config, so no task can make a USER's bad value fail it. The split: `config.mjs
  check/set` refuses a user value by key at the write face (task 2), and
  `self-verify` proves the SHIPPED schema enums match `RUNG_FILES` by key (task
  6), with `route.mjs` arm (a) warning on a hand-edited value at resolve time
  (task 3). All three name the offending key. A /cad-verify pass that reads SC1
  literally - write a bad value into a user config, run self-verify, expect
  `ok:false` - is testing a criterion no task promises; CONTEXT D-08 is the
  locked decision that split it.
- **The relay check's accepted limit.** `unrelayed-route-resolve` fires on
  ISSUING sites only (the `${CLAUDE_PLUGIN_ROOT}` invocation form). Prose that
  DELEGATES to the seam without issuing the command - `workflows/plan.md`'s and
  `workflows/execute.md`'s routing steps - is out of its reach by construction;
  those sites are governed by `seams.md`'s own relay rule, which their
  delegation points at. Widening the trigger to delegation phrasing would
  re-open the unbounded-grammar problem phase 2 just closed. Accepted cost,
  stated here so nobody reads the check as covering what it does not.
- **`#72 maxTurns` stays deferred** per CONTEXT: this phase edits no agent
  frontmatter, which was the premise that made it cheap here.
- **This repo's own config currently sets `review.triggers.diff.gate`**, so
  every local `route.mjs resolve` emits a gate-disagreement warning
  (`.planning/CAPTURE.md`, phase 3). Task 5's fixtures must build their own
  config files under a temp dir with `CADENCE_GLOBAL_CONFIG` pointed at a
  non-existent path, the way `route.test.mjs` already does - never assert
  against this repo's live layers.
