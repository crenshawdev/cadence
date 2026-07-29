---
phase: 3
plan: 1
requirements:
  - STK-02
files:
  - cadence-core/route-table.json
  - cadence-core/bin/route.mjs
  - cadence-core/bin/route.test.mjs
  - cadence-core/bin/lib/rung-agent.mjs
  - cadence-core/bin/rung-agent.test.mjs
  - cadence-core/bin/lib/route-cells.mjs
  - cadence-core/bin/route-cells.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/lib/retired-keys.mjs
  - cadence-core/bin/retired-keys.test.mjs
  - cadence-core/bin/weight-budgets.json
  - agents/cad-planner-max.md
  - agents/cad-verifier-medium.md
  - agents/cad-verifier-max.md
  - agents/cad-reviewer-max.md
  - agents/cad-plan-checker-medium.md
  - agents/cad-plan-checker-xhigh.md
  - cadence-core/config.schema.json
  - cadence-core/references/review-triggers.md
  - cadence-core/references/seams.md
  - cadence-core/workflows/verify.md
  - cadence-core/workflows/config.md
  - cadence-core/workflows/plan.md
  - INTERNALS.md
  - README.md
  - DESIGN.md
  - CHANGELOG.md
---

# Phase 3: The bundle cell - Plan

## Goal

One question in, four knobs out. A routing cell stops yielding a model and
starts yielding the whole quality bundle - `{model, effort, review, verify}` -
because quality is not one dial and effort alone cannot express "fire a
blocking cross-model review".

## Must be true when done

- `node cadence-core/bin/route.mjs resolve --role <role>` returns all four
  knobs for every one of the 18 (stakes level, role) pairs, and each value is
  the one the grids in `cadence-core/route-table.json` name for that pair.
- A retry (`--attempt 2`) resolves to the retry rung its own cell names and
  returns that rung's agent file; where the retry rung equals the starting rung
  the `reason` says the rung was held rather than reporting an escalation.
- `agents/` holds 19 rung files, each one's frontmatter `effort` equal to the
  rung in its name and each with an exact-fit `weight-budgets.json` entry; no
  rung a cell names lacks a file, and no rung file goes unnamed by the grids.
- `node cadence-core/bin/self-verify.mjs` names the offending CELL for a model
  outside `model_aliases`, a rung outside `rung_order`, a gate outside the four
  gate values, a trigger name `config.schema.json` does not define, a
  (level, role) pair with no cell, and a cell whose `retry` sits BELOW its
  `effort` - and reports `ok:true` on the shipped tree.
- `model.overrides.<role>` still replaces a cell's model and leaves its effort
  untouched; no cell at any level holds `fable` or `haiku`; `cad-executor`'s
  model comes from its own three cells rather than a tier lookup.
- A config whose `review.triggers.<t>.gate` disagrees with the level's gate
  resolves to the CONFIG value and emits one warning naming the trigger, the
  config value and the level value; `fire(trigger)` takes its gate from that
  resolved bundle and dispatches the reviewer rung the level names; and no
  workflow or skill still pre-fetches a `review.triggers.<t>.gate` of its own,
  so the level reaches every fire site rather than only the seam.
- Nothing in a live surface reads or names `base_effort`, `escalate_to`, a role
  `tier` or `tier_order`: the model, the starting rung and the retry rung all
  come from one cell, and every shipped surface says so.

## Context

Locked by `.planning/phases/3/CONTEXT.md`; read it before task 1. The bundle is
THREE grids, not one (D-01): `model`/`effort`/`retry` key on (level, role),
`review` keys on (level, trigger), `verify` keys on level alone. `base_effort`
and `escalate_to` are both DELETED and the retry rung comes from the same cell
(D-02). The (stakes, tier) model matrix is replaced by per-cell models and
`tier` stops driving resolution (D-03). A config `review.triggers.<t>.gate`
WINS over the level's gate, with the disagreement in `warnings` (D-04). No
agent file is renamed; the rung-to-filename mapping becomes an explicit
per-role table in `cadence-core/bin/lib/rung-agent.mjs` (D-05). Six new rung
files, 19 total, each needing an exact-fit budget entry (D-07). Cell validation
is new problem kinds inside self-verify's existing route-table walk, so no
`CONTRACTS` entry (D-09). `route.test.mjs` pins all 18 cells with LITERAL
expected values (D-11). Every prose edit inside a budgeted surface
(`agents/*.md`, `skills/**/SKILL.md`, `cadence-core/workflows/*.md`)
regenerates `weight-budgets.json` in the same change, exact-fit (D-13);
`cadence-core/references/*.md`, `INTERNALS.md`, `README.md`, `DESIGN.md` and
`CHANGELOG.md` are not in the manifest.

Out of scope: risk-driven rung floors (phase 4), acceptance-criteria ids (phase
5), the remaining silent config drops (phase 6), and making `fable` routable
(closed by phase 2's D-03).

### The three grids, as this plan will write them

`(level, role) -> model, effort, retry` - and the agent file each rung names.

| level | role | model | effort | retry | agent @1 | agent @2 |
|---|---|---|---|---|---|---|
| solo | cad-planner | sonnet | high | xhigh | cad-planner | cad-planner-xhigh |
| solo | cad-assumptions-analyzer | sonnet | high | xhigh | cad-assumptions-analyzer-high | cad-assumptions-analyzer |
| solo | cad-verifier | sonnet | high | xhigh | cad-verifier | cad-verifier-xhigh |
| solo | cad-reviewer | sonnet | medium | high | cad-reviewer-medium | cad-reviewer |
| solo | cad-executor | sonnet | high | xhigh | cad-executor | cad-executor-xhigh |
| solo | cad-plan-checker | sonnet | low | high | cad-plan-checker | cad-plan-checker-high |
| shipped | cad-planner | opus | high | xhigh | cad-planner | cad-planner-xhigh |
| shipped | cad-assumptions-analyzer | opus | high | xhigh | cad-assumptions-analyzer-high | cad-assumptions-analyzer |
| shipped | cad-verifier | opus | medium | high | cad-verifier-medium | cad-verifier |
| shipped | cad-reviewer | opus | high | xhigh | cad-reviewer | cad-reviewer-xhigh |
| shipped | cad-executor | opus | high | xhigh | cad-executor | cad-executor-xhigh |
| shipped | cad-plan-checker | sonnet | medium | high | cad-plan-checker-medium | cad-plan-checker-high |
| critical | cad-planner | opus | xhigh | max | cad-planner-xhigh | cad-planner-max |
| critical | cad-assumptions-analyzer | opus | xhigh | xhigh | cad-assumptions-analyzer | cad-assumptions-analyzer (held) |
| critical | cad-verifier | opus | xhigh | max | cad-verifier-xhigh | cad-verifier-max |
| critical | cad-reviewer | opus | xhigh | max | cad-reviewer-xhigh | cad-reviewer-max |
| critical | cad-executor | opus | xhigh | xhigh | cad-executor-xhigh | cad-executor-xhigh (held) |
| critical | cad-plan-checker | opus | high | xhigh | cad-plan-checker-high | cad-plan-checker-xhigh |

`(level, trigger) -> gate`

| trigger | solo | shipped | critical |
|---|---|---|---|
| plan | advisory | adjudicated | adjudicated |
| diff | off | advisory | blocking |
| risk_surface | blocking | blocking | blocking |
| phase_diff | off | off | adjudicated |
| pre_ship | advisory | adjudicated | adjudicated |

`level -> verify`: `solo` = off, `shipped` = on, `critical` = on.

The complete rung-to-file map (19 files, no renames): cad-planner
high/xhigh/max -> `cad-planner`, `cad-planner-xhigh`, `cad-planner-max`;
cad-assumptions-analyzer high/xhigh -> `cad-assumptions-analyzer-high`,
`cad-assumptions-analyzer`; cad-verifier medium/high/xhigh/max ->
`cad-verifier-medium`, `cad-verifier`, `cad-verifier-xhigh`,
`cad-verifier-max`; cad-reviewer medium/high/xhigh/max ->
`cad-reviewer-medium`, `cad-reviewer`, `cad-reviewer-xhigh`,
`cad-reviewer-max`; cad-executor high/xhigh -> `cad-executor`,
`cad-executor-xhigh`; cad-plan-checker low/medium/high/xhigh ->
`cad-plan-checker`, `cad-plan-checker-medium`, `cad-plan-checker-high`,
`cad-plan-checker-xhigh`.

## Tasks

### Task 1: resolve the review and verify grids into route.mjs's return

- **Files:** cadence-core/route-table.json, cadence-core/bin/route.mjs,
  cadence-core/bin/route.test.mjs
- **Action:** Add two new top-level blocks to `route-table.json` beside the
  existing `roles`/`stakes` blocks, which stay untouched in this task and are
  deleted in task 7. `review` is an object keyed `solo`/`shipped`/`critical`,
  each value an object mapping all five trigger names (`plan`, `diff`,
  `risk_surface`, `phase_diff`, `pre_ship`) to a gate, exactly as the
  (level, trigger) grid above. `verify` is an object keyed by the same three
  levels with the string values `off`, `on`, `on`. Add a `_meta.review` and
  `_meta.verify` sentence each stating what the grid keys on and that
  `risk_surface` is deliberately `blocking` at every level because it fires
  only on a detection match. In `route.mjs`: extend `readConfig` to also return
  `triggerGates`, the merged config's `review.triggers.<t>.gate` values for
  whatever triggers a layer actually set (never a schema default - a default no
  layer wrote must not read as a user assertion, the same rule `stakesSet`
  already encodes). In `resolve`, look up `TABLE.review[cfg.stakes]` and
  `TABLE.verify[cfg.stakes]`; if either is absent, return the existing
  `{ok:false, reason:'unresolved', role, stakes}` degradation rather than
  emitting a partial bundle, so a torn table fails open the same way a bad
  stakes value already does. Build the resolved `review` object by walking the
  level's row: when `triggerGates` carries that trigger and its value DIFFERS
  from the level's, take the CONFIG value and push one `warnings` entry naming
  the trigger, the config value and the level value (D-04) - for example
  `review.triggers.diff.gate="blocking" (config) wins over the shipped level
  gate "advisory"`; when the two agree, take the value and say nothing. Add
  `review` (the whole trigger->gate object) and `verify` (the level's string) to
  the `out({ok:true, ...})` payload. Do not add a `--trigger` flag: the whole
  map rides on one resolve, and adding a flag would change the `CONTRACTS`
  entry for no reader. Add test rows to `route.test.mjs` for: each level's
  review map and verify value resolved literally; a config gate that agrees
  emitting no warning; a config gate that disagrees winning and emitting exactly
  one warning matching the trigger, both values; and `verify` being `off` at
  solo and `on` at the other two.
- **Verify:** run every hand check with `CADENCE_GLOBAL_CONFIG=/nonexistent
  --file /nonexistent.json`, never a real or empty config path - this machine's
  user-global layer holds retired keys, and an EMPTY file parses as a torn layer,
  so either one adds warnings that make a warning-count assertion lie (phase 2's
  SUMMARY records that exact non-hermetic surprise). So invoked,
  `node cadence-core/bin/route.mjs resolve --role cad-planner` prints a line
  whose `review.risk_surface` is `blocking` and whose `verify` is `on`; a config
  file holding
  `{"stakes":"solo","review":{"triggers":{"diff":{"gate":"blocking"}}}}`
  resolves `review.diff` to `blocking` with exactly one `warnings` entry
  matching `/review\.triggers\.diff\.gate/` and naming `off` - the SOLO level's
  `diff` gate, which is what that config selects; the grid's `advisory` for
  `diff` is the shipped row, so asserting it here would fail a correct build and
  an executor "fixing" it would silently rewrite the locked grid; and
  `node --test cadence-core/bin/*.test.mjs` exits 0.

### Task 2: materialize the six new rung agent files with exact-fit budgets

- **Files:** agents/cad-planner-max.md, agents/cad-verifier-medium.md,
  agents/cad-verifier-max.md, agents/cad-reviewer-max.md,
  agents/cad-plan-checker-medium.md, agents/cad-plan-checker-xhigh.md,
  cadence-core/bin/weight-budgets.json, cadence-core/route-table.json,
  cadence-core/bin/route.test.mjs
- **Action:** Create the six files on the same template every existing rung
  file uses (copy the shape of `agents/cad-reviewer-medium.md` verbatim): the
  frontmatter carries `name` equal to the filename stem, a `description` of the
  form "The `<rung>` rung of `<role>`. Dispatched by the routing seam
  (`bin/route.mjs`) when the effort ladder resolves this rung; identical
  contract, different reasoning depth.", the same `tools`/`disallowedTools`/
  `color` values its sibling rung files carry for that role, `effort` equal to
  the rung in the filename, and `skills:` naming that role's contract skill;
  the body is exactly `rungBody(rung, skill)` from
  `cadence-core/bin/lib/rung-agent.mjs` and nothing else, or self-verify's
  check 7 fails the file. Then regenerate every affected
  `weight-budgets.json` entry from `node cadence-core/bin/weight.mjs`, taking
  the measured byte count verbatim - exact fit, never an estimate and never a
  rounded-up ceiling (phase 1 shipped one 2-byte-loose entry and it was the one
  finding CI could not see). In the same commit, widen the still-present
  `roles.<role>.rungs` arrays in `route-table.json` so each new file's rung is
  declared - `max` to cad-planner, `medium` and `max` to cad-verifier, `max` to
  cad-reviewer, `medium` and `xhigh` to cad-plan-checker. That widening is
  transitional and exists for one reason: self-verify's current reverse check
  (`undeclared-rung-agent`) fails a rung-suffixed file no role declares, so
  without it these six files turn CI red until task 7 deletes the block. Leave
  `base_effort` and `escalate_to` alone here. In the SAME commit bump
  `cadence-core/bin/route.test.mjs:348`'s `assert.equal(byName.size, 13, ...)`
  to 19: that walk counts routable agent names off the table, so the six new
  files turn it red the moment they land. Nothing else in the test file changes
  here - self-verify is green either way, so without this the task's own checks
  pass on a tree whose test suite fails, and the Notes' claim that each
  transitional commit is individually landable is false.
- **Verify:** `ls agents/*.md | wc -l` prints 19;
  `node cadence-core/bin/weight.mjs` and `cadence-core/bin/weight-budgets.json`
  agree byte-for-byte on all 19 agent entries;
  `node cadence-core/bin/self-verify.mjs` prints `"ok":true` with `problems: []`;
  and `node --test cadence-core/bin/*.test.mjs` exits 0 - run the suite, not
  just self-verify, or the red assertion above ships unnoticed.

### Task 3: replace the tier matrix with the (level, role) cell grid

- **Files:** cadence-core/route-table.json, cadence-core/bin/lib/rung-agent.mjs,
  cadence-core/bin/rung-agent.test.mjs, cadence-core/bin/route.mjs,
  cadence-core/bin/route.test.mjs
- **Action:** Add a `cells` block to `route-table.json`: an object keyed by the
  three levels, each holding one entry per role whose value is
  `{model, effort, retry}`, with the 18 rows of the grid above. Add a `roles`
  companion that is the declared ARRAY of the six role names - the old object
  named `roles` stays until task 7, so introduce the array under the key
  `role_order` in this task and rename it to `roles` in task 7 when the old
  object is deleted; state that two-step in a `_meta` sentence so a reader is
  not left guessing which key is live. Add to `rung-agent.mjs` an explicit
  per-role rung-to-filename table (D-05) as a frozen exported constant
  `RUNG_FILES`, plus `rungFile(role, rung)` returning the agent-file stem or
  `null` when the pair is not in the table, and `rungFiles(role)` returning
  every stem that role's map names in declared rung order. Populate it with the
  19 pairs listed in Context. The existing `agentForRung`/`rungAgents`/
  `rungIssues` exports stay for now (self-verify still walks the old `roles`
  object until task 5) and are deleted in task 7 - do NOT change their
  signatures here, because a signature change with live callers is the one edit
  that cannot be committed green. Rewrite `route.mjs`'s `resolve`: look up
  `TABLE.cells[cfg.stakes][opts.role]`, degrade to the existing `unknown-role`
  when the role is not in the declared role list and to `unresolved` when the
  level or the cell is absent; take `model` and `effort` from the cell; on
  `attempt > 1` with `model.escalate_on_failure` true, set the target to
  `cell.retry` and, when it differs from `cell.effort`, set `escalated: true`,
  resolve the agent with `rungFile(role, retry)` and push
  `rung <effort>-><retry> (<agent>)` onto `reason`; when `retry` equals
  `effort`, keep `escalated: false` and push `rung held at <rung> (retry rung
  is the same rung)`; when the key is false, keep today's
  `model.escalate_on_failure` reason. Resolve the attempt-1 agent through
  `rungFile(role, cell.effort)` too - with `base_effort` gone the unsuffixed
  file is one rung among the others and is no longer derivable by convention.
  DELETE the `role.tier` read, the `TABLE.stakes[stakes][tier]` lookup and the
  `tier` field from the emitted payload; nothing consumes it
  (`references/seams.md` documents only `agent`, `model`, `escalated`,
  `reason`), and leaving a field no reader uses is the resolved-then-dropped
  shape this milestone exists to close. Keep the `model.overrides.<role>` pin
  arm exactly as it is - it must still replace the model and leave `effort`
  untouched. Update `route.test.mjs` only as far as green requires: retarget or
  delete the rows that assert `tier`, `base_effort` or `escalate_to`, and
  retarget the whole-table walk at the end of the file so it iterates every
  cell's `effort` and `retry`, asserts `rungFile` names a file that exists, and
  asserts that file's frontmatter `effort` equals the rung - that row compares
  two independent sources (table vs disk) and must stay a walk (D-11).
- **Verify:** with `CADENCE_GLOBAL_CONFIG=/nonexistent` and
  `--file /nonexistent.json` (see task 1's hermeticity note),
  `node cadence-core/bin/route.mjs resolve --role cad-executor` prints
  `"model":"opus"` with no `tier` field; the same call against a
  `{"stakes":"solo"}` config prints `"model":"sonnet"`;
  `node cadence-core/bin/route.mjs resolve --role cad-verifier --attempt 2`
  prints `"agent":"cad-verifier"`, `"effort":"high"` and `"escalated":true`;
  and `node --test cadence-core/bin/*.test.mjs` exits 0.

### Task 4: pin all 18 cells and all 18 retries with literal expected values

- **Files:** cadence-core/bin/route.test.mjs
- **Action:** Add a LITERAL array of 18 rows - each row
  `{stakes, role, model, effort, retry, agent, retryAgent}` typed out from the
  grid in Context - and give EACH ROW ITS OWN test case (`test(\`cell
  ${stakes}/${role}\`, ...)` in a loop, or `t.test` subtests), never one
  `test()` walking all 18: `node:test` aborts a case at the first throwing
  assertion, so a single case reports one failure and skips every later row,
  and the per-cell discrimination D-11 exists to guarantee then goes unproven -
  the Verify mutation below cannot be observed at all. Each row asserts
  `resolve --role <role>` against a config holding only that stakes value
  returns exactly that `model`, `effort` and `agent`, then asserts `--attempt 2`
  returns exactly that `retry` effort and `retryAgent`. The array is hand-written data in the test file: never read,
  derived, or spread from `route-table.json`, which is the table under test - a
  fixture that derives its expectations from its subject cannot fail
  (`.planning/phases/2/SUMMARY.md` records two mutation-proved losses of exactly
  this shape, at `config.test.mjs:41` and `route.test.mjs:208`). Add three more
  rows beside it: the two held retries (critical/cad-assumptions-analyzer and
  critical/cad-executor) return `escalated:false` with a `reason` matching
  `/rung held at xhigh/`; no cell at any level holds `fable` or `haiku`, walked
  over the shipped table's `cells` (the routed vocabulary is `sonnet` and
  `opus`, D-12) while `model_aliases` still contains all four; and
  `model.overrides.cad-executor` set to `fable` replaces the model at every
  level while `effort` stays the cell's value.
- **Verify:** `node --test cadence-core/bin/route.test.mjs` exits 0; changing
  `cells.shipped.cad-executor.model` in `cadence-core/route-table.json` from
  `opus` to `sonnet` makes exactly the shipped/cad-executor row fail and leaves
  the other 17 passing, and changing `cells.critical.cad-planner.retry` from
  `max` to `xhigh` fails that row's retry assertion - revert both edits.

### Task 5: walk the cells in self-verify - missing cells and missing rung files

- **Files:** cadence-core/bin/lib/route-cells.mjs,
  cadence-core/bin/route-cells.test.mjs, cadence-core/bin/self-verify.mjs,
  cadence-core/bin/self-verify.test.mjs
- **Action:** Create `cadence-core/bin/lib/route-cells.mjs`, a pure zero-I/O
  lib in the same shape as `lib/rung-agent.mjs` (no fs, no emit, no process, no
  Date): export `cellIssues(table, { levels, triggers, gates })` returning an
  array of `{code, detail}` where every `detail` NAMES THE CELL as
  `<level>/<role>` or `<level>/<trigger>`, because the level and the key are the
  only things that locate a problem in an 18-cell grid. In this task implement
  the structural codes only: `missing-cell` for a (level, role) pair with no
  entry, for a level with no `review` row or no `verify` value, and for a
  trigger the level's review row omits; and `missing-rung-agent` for a cell
  whose `effort` or `retry` has no entry in `RUNG_FILES` - taking file existence
  itself as the caller's job, since the lib does no I/O. Export
  `routableAgents(table)`, the set of every agent-file stem the grids can
  produce, so the caller can check both directions from one statement of the
  rule (the reason `rung-agent.mjs` exists at all). Rewrite self-verify's
  check 8 to call it: derive `levels` from `config.schema.json`'s `stakes` enum
  values, `triggers` from the existing `TRIGGERS` list built off
  `review.triggers.<t>` schema keys (D-10 - never by parsing
  `review-triggers.md`'s Wiring table, which has no stated grammar), and gates
  from the `values` array of the `review.triggers.plan.gate` schema entry; file
  each returned issue as a problem against `cadence-core/route-table.json`;
  then check disk in both directions - every stem in `routableAgents` exists as
  `agents/<stem>.md` (`missing-rung-agent`, detail naming the cell that wants
  it), and every rung-suffixed file in `agents/` whose suffix is in `rung_order`
  and which `routableAgents` does not contain is `undeclared-rung-agent`. Keep
  the existing read/parse guard and the null-role tolerance verbatim: a
  malformed table stays ONE `unreadable-surface` problem with every earlier
  check's findings intact, and no code path may dereference a null cell (phase
  1's UAT recorded exactly that collapse at the old `spec.base_effort` deref).
  Delete the `rungIssues` call and its problem kinds from this check. Add
  `route-cells.test.mjs` with one row per structural code plus a null/malformed
  cell row, and update the `roleTable`/`fullFixture` helpers and the check-8
  rows in `self-verify.test.mjs` to build cell-shaped tables.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"ok":true` on the
  shipped tree; temporarily deleting the `cad-verifier` entry from
  `cells.critical` in `cadence-core/route-table.json` makes it print
  `"ok":false` with a `missing-cell` problem whose detail contains
  `critical/cad-verifier` (then revert); temporarily renaming
  `agents/cad-planner-max.md` produces a `missing-rung-agent` naming
  `critical/cad-planner` (then revert); and
  `node --test cadence-core/bin/*.test.mjs` exits 0.

### Task 6: fail self-verify on the four bad-value classes, naming the cell

- **Files:** cadence-core/bin/lib/route-cells.mjs,
  cadence-core/bin/route-cells.test.mjs, cadence-core/bin/self-verify.test.mjs
- **Action:** Extend `cellIssues` with the four value-vocabulary codes of AC4,
  each detail naming the cell and the accepted set: `unknown-model` for a cell
  `model` outside the table's `model_aliases`; `unknown-rung` for a cell
  `effort` or `retry` outside `rung_order`, naming which of the two it was, and
  the same code for a `verify` value outside `on`/`off`; `unknown-gate` for a
  review value outside the four gates the schema's gate enum declares; and
  `unknown-trigger` for a key in a level's review row that is not one of the
  trigger names `config.schema.json` defines. Add a FIFTH code the AC4 list
  does not name but task 7's deletion makes mandatory: `rung-demotion` for a
  cell whose `retry` sits BELOW its `effort` in `rung_order`, detail naming the
  cell and both rungs. Membership checks cannot see direction, and task 7
  deletes `rungIssues` - today the ONLY direction guard
  (`cadence-core/bin/lib/rung-agent.mjs:203-216`, which documents the hazard in
  full). Without a replacement, editing a cell's `retry` to a lower rung passes
  `unknown-rung`, passes `missing-rung-agent` (the file exists), keeps
  self-verify `ok:true`, and makes `route.mjs` dispatch a WEAKER rung on a
  failed attempt while reporting `escalated: true` - the retry thinks less and
  says it thought more. That is the exact hazard D-02 cites as the reason
  reversing phase 1's D-03 is safe, so the phase may not delete the check that
  made it safe. Equal is legal (the two held cells); only a strict demotion
  fires. A value of the wrong TYPE (a
  number, an object, null) reports under the same code rather than throwing -
  the lib is called on a table nothing has validated yet. Order the checks so a
  cell with two faults reports two problems rather than short-circuiting: a
  maintainer fixing one and re-running should not discover the second on the
  next pass. Add one `route-cells.test.mjs` row per code, each asserting the
  code AND that the detail names the offending cell, plus one row proving a
  table with a bad model and a bad gate in different cells reports both. Add
  one end-to-end row in `self-verify.test.mjs` per class, built on the
  cell-shaped fixture, asserting `ok:false` and the named cell. Cover
  `rung-demotion` in both files the same way, including one row proving equal
  rungs do NOT fire it.
- **Verify:** `node --test cadence-core/bin/*.test.mjs` exits 0; and with each
  of the five mutations applied one at a time to
  `cadence-core/route-table.json` (`cells.solo.cad-planner.model` set to
  `gpt-5`; `cells.solo.cad-planner.effort` set to `ludicrous`;
  `review.solo.diff` set to `maybe`; a `review.solo.frobnicate` key added;
  `cells.critical.cad-verifier.retry` set to `medium`, a rung that exists and
  has a file, so only the direction check can catch it),
  `node cadence-core/bin/self-verify.mjs` prints `"ok":false` with a problem
  whose detail names `solo/cad-planner` or `solo/diff` or `solo/frobnicate` or
  `critical/cad-verifier` - revert each mutation before the next.

### Task 7: delete the tier matrix, base_effort, escalate_to and the legacy lib

- **Files:** cadence-core/route-table.json, cadence-core/bin/lib/rung-agent.mjs,
  cadence-core/bin/rung-agent.test.mjs, cadence-core/bin/lib/retired-keys.mjs,
  cadence-core/bin/retired-keys.test.mjs, cadence-core/bin/route.mjs,
  cadence-core/bin/lib/route-cells.mjs, cadence-core/bin/route.test.mjs
- **Action:** From `route-table.json` delete the `roles` OBJECT (with every
  `tier`, `base_effort`, `rungs` and `escalate_to` in it), `tier_order`, and the
  whole `stakes` model matrix, then rename `role_order` to `roles` and rewrite
  `_meta` so `note`, `rungs` and `aliases` describe the three grids that are
  actually there - `_meta.tiers` goes with the key it described. **Update every
  READER of the renamed key in the same commit** - this rename is the one edit
  in the phase that silently breaks all six roles at once. Task 3 pointed
  `route.mjs`'s role check at the declared role list, i.e. `TABLE.role_order`;
  after this rename that key is `undefined`, so `resolve` returns
  `{ok:false, reason:'unknown-role'}` for EVERY role (or throws, if the check
  used `.includes`) and the whole spine silently falls back to the session
  default. Repoint it, and the `detail` string beside it, at the array now
  called `TABLE.roles` - and note `route.mjs:70`'s current
  `Object.keys(TABLE.roles).join(', ')` yields `0, 1, 2, 3, 4, 5` on an array,
  so that line must become a plain join of the array. Repoint
  `lib/route-cells.mjs` wherever it derives roles from the table. Delete
  `cadence-core/bin/route.test.mjs:10`'s
  `import { agentForRung, rungAgents } from './lib/rung-agent.mjs'` - task 3
  leaves it green because the exports still exist, but this task removes them
  and a stale import is a module-load `SyntaxError` that takes the ENTIRE route
  test file out of the suite, including the 18 literal cell rows AC1 rests on:
  a red file that reports as one error rather than eighteen. From
  `rung-agent.mjs` delete `agentForRung`, `rungAgents` and `rungIssues` and
  every `RoleSpec` typedef reference they carried; `rungBody`, `normalizeBody`
  and `rungBodyIssue` stay untouched (check 7 still uses them), and
  `RUNG_FILES`/`rungFile`/`rungFiles` become the file's whole mapping story -
  update the module header to say so. Delete the `rung-agent.test.mjs` rows for
  the deleted exports; the `rungFile`/`rungFiles` rows from task 3 stay. In
  `lib/retired-keys.mjs`, reword the `model.auto.max_escalations` removal reason
  so it names the cell's retry rung instead of `escalate_to` (a role escalates
  to exactly one rung, the one its own cell names, so there is no second step to
  cap) and update the matching assertion in `retired-keys.test.mjs`. Update
  `route.mjs`'s header comment block: the config-keys list, the
  `model.escalate_on_failure` line and the "role's tier picks the column"
  sentence all describe machinery this task removes. Do not touch `CHANGELOG.md`
  or `DESIGN.md` here - task 10 owns them.
- **Verify:** `git grep -In "escalate_to\|base_effort\|tier_order" --
  cadence-core/route-table.json cadence-core/bin agents` returns nothing (scoped
  to what this task owns - `config.schema.json` and the two workflow files still
  name the retired vocabulary until task 9, and `references/` until task 8);
  with `CADENCE_GLOBAL_CONFIG=/nonexistent --file /nonexistent.json`,
  `node cadence-core/bin/route.mjs resolve --role cad-planner` still prints
  `"ok":true` with a model and an agent - run this for all six role names, since
  a broken role list fails identically for every one of them and the test suite
  can pass while the live binary resolves nothing;
  `node --test cadence-core/bin/*.test.mjs` exits 0;
  `npx tsc -p tsconfig.ci.json` exits 0; and
  `node cadence-core/bin/self-verify.mjs` prints `"ok":true`.

### Task 8: wire the bundle into fire(trigger), the deep-verify pass and seams.md

- **Files:** cadence-core/references/review-triggers.md,
  cadence-core/references/seams.md, cadence-core/workflows/verify.md,
  cadence-core/workflows/execute.md, cadence-core/workflows/plan.md,
  skills/cad-land/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** In `review-triggers.md` step 1 (Gate), replace "Read
  `review.triggers.<trigger>` from `.planning/config.json`" with: resolve the
  bundle once through the routing seam (`route.mjs resolve --role cad-reviewer`)
  and take the gate from the resolved bundle's review map, keyed by trigger
  name. Write it that way in PROSE - do NOT write the dotted token
  `review.<trigger>` in any linted surface: `review` is a schema FAMILY, so
  self-verify's check 1 expands the placeholder across the five trigger names,
  finds no schema key `review.plan` / `review.diff` / ..., and files
  `unknown-config-key` (`cadence-core/bin/self-verify.mjs:277-288`) - which this
  task's own Verify forbids. The seam has already
  applied config-wins precedence, so a `review.triggers.<t>.gate` a user set
  still decides and any disagreement arrives as a `warnings` entry to relay.
  `tier` and `effort` under `review.triggers.<trigger>` keep their current
  meaning and still govern the cross-model backend only. In step 4's
  claude-subagent arm, replace the "runs at the `effort:` its own file pins
  (`high`), whatever the config says" paragraph with: dispatch the `agent` and
  `model` the same resolve returned, which is the reviewer rung the level names
  - `cad-reviewer-medium` at solo, `cad-reviewer` at shipped,
  `cad-reviewer-xhigh` at critical, and `cad-reviewer-max` when a critical-level
  fire is re-dispatched with `--attempt 2` (D-08, closing phase 1's D-13
  deferral). KEEP the one-line notice when `review.triggers.<t>.effort` differs
  from the rung actually dispatched, reworded to say the level sets the
  reviewer's rung and per-trigger `effort` reaches cross-model reviewers only -
  deleting it would re-open #64's resolved-then-dropped gap. Update the "Shipped
  gate" column of the Wiring table to name the level-dependent gates rather than
  a single value. In `seams.md`'s Routing section, document the four-knob return
  (`model`, `effort`, `review`, `verify`), state that a retry climbs to the
  cell's retry rung, remove the `escalate_to` sentences, and add one bullet
  requiring the orchestrator to relay every `warnings[]` entry to the user
  before dispatching - without it this phase's own gate-disagreement warning
  reaches JSON and no human, which is `.planning/phases/2/SUMMARY.md`'s open
  item 2 repeating one phase later. Scope that bullet to each DISTINCT warning
  once per workflow run, not once per dispatch: `route.mjs` is invoked per role
  per spawn, so an unscoped rule turns one deliberate config gate into a notice
  on every planner, executor, verifier and checker dispatch for the life of the
  project, and warning fatigue degrades the same channel the torn-layer and
  retired-key warnings depend on. In `workflows/verify.md`'s `deep_check`
  step, make the resolved `verify` knob the thing that decides, KEEPING the
  existing first-session term rather than dropping it: `--deep` or an explicit
  user ask always runs the pass; `workflow.verifier: false` always skips it;
  otherwise the pass runs when this is the first UAT session for the phase AND
  the level's `verify` is `on`, and a skip caused by `verify: off` prints one
  line naming the level and pointing at `--deep`. Preserving that first-session
  term is not optional: the rule at `cadence-core/workflows/verify.md:96-98`
  runs the pass once per phase today, and dropping it re-dispatches
  `cad-verifier` on the second, third and every later UAT session at shipped and
  critical - a behavior change for every user that no CONTEXT decision
  authorizes. `deep_check` holds no role and `route.mjs:173` refuses a resolve
  without one, so it resolves with `--role cad-verifier`, the role it is
  deciding whether to dispatch, and reads `verify` off that bundle. Then wire
  the level's gate into the surfaces that actually FIRE the triggers, or the
  grid decides nothing: today `cadence-core/workflows/execute.md:39` pre-fetches
  `review.triggers.diff.gate` and `review.triggers.phase_diff.gate`,
  `cadence-core/workflows/plan.md:38` pre-fetches `review.triggers.plan.gate`,
  and `skills/cad-land/SKILL.md:27` pre-fetches `review.triggers.pre_ship.gate`,
  each straight from `config.mjs get` - which returns the SCHEMA DEFAULT when no
  layer set the key. Task 1 deliberately treats an unset default as no
  assertion, so those three surfaces would go on firing at the default gate
  while `route.mjs` reports the level's: AC6 would pass at the seam and fail at
  every real fire site, which is the resolved-then-dropped shape this milestone
  exists to close. In each, drop the gate key from the `config.mjs get` batch
  and take the gate from the same `route.mjs resolve` the fire already needs.
  Regenerate the `weight-budgets.json` entries for
  `cadence-core/workflows/verify.md`, `cadence-core/workflows/execute.md`,
  `cadence-core/workflows/plan.md` and `skills/cad-land/SKILL.md` to their new
  exact byte counts from `node cadence-core/bin/weight.mjs` - all four are
  budgeted surfaces under D-13 (the two `references/` files are not in the
  manifest and need no entry).
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"ok":true` with no
  `budget-overrun` and no `unknown-config-key`; `git grep -n "escalate_to"
  cadence-core/references` returns nothing; `grep -n "cad-reviewer-max"
  cadence-core/references/review-triggers.md` shows the critical-retry rung
  named in the claude-subagent arm; and
  `git grep -n "review\.triggers\.[a-z_]*\.gate" -- cadence-core/workflows skills`
  returns nothing - every gate now comes from the resolved bundle, and a
  surviving match is a fire site the grid does not reach.

### Task 9: reconcile the config schema and the config/plan workflow prose

- **Files:** cadence-core/config.schema.json, cadence-core/workflows/config.md,
  cadence-core/workflows/plan.md, cadence-core/bin/weight-budgets.json
- **Action:** In `config.schema.json`, rewrite `model.escalate_on_failure`'s
  `purpose` so it names the retry rung the role's own cell declares rather than
  `escalate_to`, and rewrite `workflow.verifier`'s `purpose` to state its real
  reach after task 8 - it is the off switch, and when it is true the stakes
  level decides whether the deep pass runs. Do not add or remove any schema key
  in this phase: routing values live in `route-table.json`, and the
  user-editable `routing` config block is explicitly deferred by CONTEXT.
  Rewrite the `model.escalate_on_failure` row of `workflows/config.md`'s
  cheat-sheet table the same way, and `workflows/plan.md`'s two escalation
  sentences (around lines 204 and 208) so they name the cell's retry rung and
  the rung file it resolves to rather than `escalate_to` and a hardcoded
  `high`. Regenerate both workflow files' `weight-budgets.json` entries from
  `node cadence-core/bin/weight.mjs` to their new exact byte counts - exact fit
  both ways, including when an edit SHRINKS a file, since a loose entry
  pre-approves unaudited growth (phase 1's one loose entry is the finding this
  rule exists to prevent).
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"ok":true` with no
  `budget-overrun`, `unbudgeted-surface`, `inert-config-key` or
  `unknown-config-key`; `git grep -n "escalate_to" -- cadence-core` returns
  nothing; and `node cadence-core/bin/config.mjs keys` still lists exactly the
  keys it listed before this task (diff the key list against
  `git show HEAD:cadence-core/config.schema.json`).

### Task 10: state the bundle in the narrative docs and the release note

- **Files:** INTERNALS.md, README.md, DESIGN.md, CHANGELOG.md, LINEAGE.md
- **Action:** Rewrite `INTERNALS.md`'s "Model routing" section: effort is still
  frozen per file, but a routing cell now yields four knobs, the rung comes from
  the (level, role) cell rather than a per-role `base_effort`, and a retry
  climbs to the retry rung that same cell names. Delete the sentence mapping an
  agent's tier to an alias and the "role tiers act as floors" guarantee - both
  describe machinery this phase removed - and with them the `fable` claim that
  `.planning/phases/2/SUMMARY.md` open item 10 filed against `INTERNALS.md:13`:
  the routed vocabulary is `sonnet` and `opus`, and `fable` and `haiku` are
  reachable only by an explicit `model.overrides.<role>` pin (D-12). Update
  README.md's lineage line from "6 agent roles across 13 rung files" to 19, and
  any README sentence describing routing as a model lookup. Fix the same count
  at `LINEAGE.md:35` ("Cadence's 6 agent roles, materialized as 13 rung files"):
  it is one edit, this phase is what makes it wrong, and `LINEAGE.md` sits
  outside self-verify's linted walk (`cadence-core/bin/self-verify.mjs:164-168`)
  so nothing else will ever catch it. In DESIGN.md, do
  NOT rewrite the §6 history: append one dated marker in the same style phase 1
  and phase 2 used, recording that the per-role `base_effort`/`escalate_to`
  ladder and the (stakes, tier) matrix are superseded by the three grids, and
  why the reversal of phase 1's D-03 is safe (a fixed escalation target could
  point BELOW what the grid set, making a retry think less while reporting an
  escalation). That dated marker is the one legitimate surviving mention of the
  retired vocabulary in a `.md` file - phase 1's SUMMARY records the same
  collision between a grep-clean criterion and a historical record, so state it
  in the commit message rather than rediscovering it. In `CHANGELOG.md`'s
  `## [Unreleased]` section (still unreleased, so these are edits to this
  release's own note, not to history): rewrite the
  `model.auto.max_escalations` bullet and the "Escalate-on-failure is
  unconditional" bullet so neither names `escalate_to`, and so the claim about
  the rung ladder is TRUE rather than narrowed - a retry now climbs the retry
  rung its cell names, and the five roles that used to sit flat no longer do,
  which is what closes the HIGH that phase 2's SUMMARY opened as item 1. Add
  `### Added` and `### Changed` entries for the bundle cell: the four-knob
  return, the six new rung files (19 total), per-cell models with `tier`
  removed, the level-driven review gates with config still winning, and the
  level-driven deep-verify pass.
- **Verify:** `git grep -In "escalate_to\|base_effort\|tier_order" -- . ':!.planning'`
  returns matches ONLY in `DESIGN.md` - the untouched §6 history (`DESIGN.md:371`
  and `:395` name `escalate_to` today and this task deliberately leaves them:
  they are the record of a decision, and rewriting history to satisfy a grep is
  the one thing §6 forbids) plus the new dated marker. Every other path is
  clean. State this exception in the commit message, because CONTEXT AC2 as
  written ("`escalate_to` appears in no shipped `.json`, `.mjs` or `.md`") reads
  literally as a FAIL against a correct tree, and `/cad-verify 3` should judge
  the exception rather than rediscover the collision - phase 1's SUMMARY records
  the identical one. `grep -c "19 rung files" README.md` is at least 1;
  `node cadence-core/bin/self-verify.mjs` prints `"ok":true` (README.md and
  INTERNALS.md are linted surfaces, so an invented key or path fails here);
  `node --test cadence-core/bin/*.test.mjs` exits 0; and
  `npx tsc -p tsconfig.ci.json` exits 0.

## Notes

- **Plan shape deviation.** CONTEXT's `Plan shape` line asks for multiple plans
  in one phase; this is ONE plan. The independence test forbids the split: nine
  of the ten tasks touch `cadence-core/route-table.json`,
  `cadence-core/bin/route.mjs`, `cadence-core/bin/route.test.mjs` or
  `cadence-core/bin/self-verify.mjs`, and CONTEXT's own sentence says every arm
  stays red until the grids and the `route.mjs` core land. Splitting shared-file
  work would produce two plans that cannot run in parallel and cannot merge
  cleanly.
- **Sequencing is load-bearing, and two commits are deliberately transitional.**
  Task 2 widens the old `roles[*].rungs` arrays so the six new files do not turn
  the existing reverse check red, and task 3 introduces the role list under
  `role_order` beside the still-present `roles` object. Both are undone by
  task 7. The alternative - one commit swapping the table, the lib, the
  resolver, self-verify and three test files at once - is not committable in
  pieces and hides a five-file blast radius behind one green run.
- **ROADMAP criterion 2 ("computed from a table ... not enumerated by hand")
  is satisfied by CONTEXT's reading, not by compression.** D-03 explicitly
  considered and rejected keeping `tier` as a compression device: the 18 cells
  are data in one table read in one screen, and no code enumerates them.
- **`verify`'s consumer is wired in task 8 on planner judgment.** CONTEXT's
  scope list names the `level -> verify` grid and the four-knob return but not
  the `verify.md` read that consumes it. Shipping a fourth knob that no workflow
  reads would be the resolved-then-dropped defect this milestone exists to
  close, and D-01 rejected its own alternative design partly on that ground, so
  the `deep_check` wiring is planned in rather than deferred.
- **Two open findings this phase closes on its way past**, recorded so
  `/cad-verify 3` can trace them: phase 2's SUMMARY open item 1 (the CHANGELOG's
  reachable-ladder claim, closed by task 10 against a table that now makes it
  true) and open item 10 (`INTERNALS.md:13` listing `fable` as a stakes-matrix
  target, closed by task 10). Phase 2's open item 2 (nothing relays `warnings`)
  is closed by task 8's seams.md bullet.
- **Not closed here:** `.planning/ROADMAP.md`'s phase-1 checkbox and this
  machine's user-global config still holding `model.auto.*` keys - both outside
  this phase's write scope, and both recorded in CONTEXT's flagged assumptions.
  `LINEAGE.md`'s stale rung count is NOT one of them: CONTEXT's assumption list
  never mentions LINEAGE, this phase is what falsifies the number, and task 10
  now fixes it.
- **Review findings folded in (adjudicated `plan` trigger, 2026-07-29).** A
  four-reviewer panel ran; the `openai` voice was dropped (`http 401
  invalid_api_key`), so this is three voices, not four. Eleven findings survived
  grounding and are applied above. Two were killed: that the 18 literal cells
  violate ROADMAP criterion 2 (raised by two reviewers, but D-03 considered and
  rejected the compression alternative on exactly that ground, so the plan
  follows a locked decision - `/cad-verify 3` should expect the question), and
  that D-10's schema-derived trigger set drifts from ROADMAP criterion 3's
  wording (already recorded in CONTEXT's flagged assumptions). The load-bearing
  fix is task 7's: the `role_order` -> `roles` rename had no read-site update,
  which would have made every `resolve` return `unknown-role` for all six roles
  while the test suite stayed green.
