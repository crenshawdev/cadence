---
phase: 1
plan: 1
requirements: [GAT-02, GAT-03, ENF-02]
files:
  - cadence-core/bin/lib/gate-agreement.mjs
  - cadence-core/bin/gate-agreement.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/config.schema.json
  - cadence-core/bin/config.mjs
  - cadence-core/bin/config.test.mjs
  - cadence-core/workflows/execute.md
  - cadence-core/workflows/plan.md
  - cadence-core/references/config-catalog.md
  - cadence-core/bin/weight-budgets.json
  - .planning/DOCS-CLAIMS.md
---

# Phase 1: What the config says is what routing does - Plan

## Goal

For every review trigger at every stakes level, `config.schema.json`'s default
and prose, `config.mjs get` and `route-table.json` give one answer, and
`self-verify.mjs` fails when they stop doing so.

## Must be true when done

- Before any schema edit lands, `node cadence-core/bin/self-verify.mjs` on the
  unpatched tree exits 1 with problems naming `plan`, `diff` and `phase_diff`,
  at least one of them naming `phase_diff` together with `shipped`, and that
  JSON line is recorded rather than asserted.
- After the phase, `node cadence-core/bin/self-verify.mjs` exits 0 with
  `problems: []`, and its `checked` string names the new gate-agreement check.
- Each of the four `review.triggers.*.gate` `purpose` strings names a gate for
  `solo`, `shipped` and `critical`, each named gate equals `route-table.json`'s
  `review[level][trigger]`, and deleting one level clause from any of the four
  makes `self-verify.mjs` report a problem naming that trigger and level.
- On a repo with no gate set,
  `node cadence-core/bin/config.mjs get review.triggers.<t>.gate` answers `null`
  with one `warnings[]` entry naming `route.mjs resolve`, for all four triggers;
  after `config.mjs set review.triggers.diff.gate=blocking` the same command
  answers `blocking` with no such warning; a keyless `config.mjs get` carries no
  gate-related warning at all; and
  `config.mjs check review.triggers.diff.gate=null` still returns `ok:false`
  with `must be one of: off, advisory, blocking, adjudicated`.
- A repo-wide grep for the workaround wording returns nothing: neither
  `cadence-core/workflows/execute.md` nor `cadence-core/workflows/plan.md`
  states that a `get` of a gate returns the schema default, and
  `cadence-core/references/config-catalog.md`'s gate row publishes no per-key
  scalar default.
- `node --test cadence-core/bin/*.test.mjs` passes at every commit, with no test
  file removed and no count-pin assertion loosened.

## Context

CONTEXT.md decisions D-01..D-12 are locked and bind every task below;
`route-table.json`'s `review` grid is the authority and does not move (D-04),
and no key, flag or command is added anywhere in this phase.

Existing patterns to follow: `cadence-core/bin/lib/route-cells.mjs` and
`cadence-core/bin/lib/global-only-keys.mjs` for a pure `{code, detail}` rule and
its header discipline; `self-verify.mjs:1046-1083` for the caller half, where
`schema`, `table`, `TRIGGERS`, `gateSpec` and `stakesSpec` are already in hand.

Out of scope, and no task may do it: the two prototype-getter faces at
`config.mjs:258`/`:261` recorded in CAPTURE.md; `route-table.json`'s stale "five
triggers" `_meta.review` count; `config.mjs set`/`check` behaviour;
`references/conventions.md:71-76`, which D-11 rules is not a criterion-4 hit.

`cadence-core/workflows/execute.md`, `cadence-core/workflows/plan.md` and
`cadence-core/references/config-catalog.md` each sit at EXACTLY their
`cadence-core/bin/weight-budgets.json` row (25289 / 22041 / 8824 bytes, verified
2026-08-15); self-verify's budget check fails on shrink as well as growth, so
any edit to those three re-pins its own row in the same commit.
`config.schema.json` and `route-table.json` are not weighed surfaces.

## Tasks

### Task 1: The gate-agreement rule as a pure lib, unit-tested from fixtures

- **Files:** cadence-core/bin/lib/gate-agreement.mjs,
  cadence-core/bin/gate-agreement.test.mjs
- **Action:** Write the ONE statement of what makes a `review.triggers.<t>.gate`
  schema row agree with `route-table.json`'s `review[level][trigger]` grid, as a
  pure lib under `cadence-core/bin/lib/` with the same shape and header
  discipline `lib/route-cells.mjs` and `lib/global-only-keys.mjs` already carry
  (D-08): no fs, no emit, no process, no Date, returning `{code, detail}` entries
  the caller wraps in its own envelope. It takes the parsed `config.schema.json`
  key map, the parsed route table and the level list, all trusted for nothing,
  and reports two DISTINGUISHABLE failure classes per trigger, under different
  `code` values so a maintainer can tell them apart: (a) the row's `default` is
  one of the gate names but disagrees with what the grid fires at some level;
  (b) the row's `purpose` does not carry a stated `<gate> at <level>` clause for
  each of `solo`, `shipped` and `critical`, or carries one naming a gate the grid
  does not fire at that level. The prose clause is MANDATORY, never opt-in
  (D-03): a missing clause is itself a problem, because an opt-in rule lets a
  maintainer silence the prose half by deleting one sentence, the hole check 14
  was written to close for CONTRACTS rows. Derive the trigger list from the
  schema's own `review.triggers.*` key names (D-09), never a hand-kept array, so
  a fifth trigger is walked the day its key lands. Every `detail` names the
  trigger AND the level, the locating convention `lib/route-cells.mjs`'s header
  already states for an 18-cell grid. A missing grid, a non-object row, a
  `purpose` that is not a string and a two-fault row all report under a code
  rather than throwing or short-circuiting, because this runs on a table nothing
  has validated yet. Exempt `null` SPECIFICALLY, and nothing else: a `null`
  `default` is "no scalar claim to check" and only the prose half is held, or the
  whole check goes quiet the moment task 3 lands - but any OTHER non-gate
  `default` (a typo'd `"adivsory"`, a `false`, a number) is its own problem under
  its own code, naming the trigger and the value. Nothing in the tree validates a
  schema `default` against its own key's `values` enum today
  (`effortEnumIssues` in `bin/lib/rung-agent.mjs:186` never reads `default`),
  while `config.mjs get` reports whatever is written there, so a blanket
  non-gate exemption would let exactly the schema-default drift ENF-02 names
  pass both surfaces. Do not import from or read `route.mjs`; the grid arrives as a
  parsed argument. The test is the AC1 half: hold the four schema rows exactly as
  they ship TODAY - defaults `plan: adjudicated`, `diff: advisory`,
  `risk_surface: blocking`, `phase_diff: advisory`, with their current `purpose`
  strings - as a FROZEN literal fixture inside the test file rather than a read
  of the live schema, so the failing run stays re-runnable after task 3 lands
  (D-08).
- **Verify:** `node --test cadence-core/bin/gate-agreement.test.mjs` passes and
  contains: an arm handing the rule the frozen pre-patch fixture against the
  shipped `review` grid that asserts problems naming `plan`, `diff` and
  `phase_diff`, with at least one `detail` naming both `phase_diff` and
  `shipped`; an arm where deleting one level clause from one `purpose` yields a
  problem naming that trigger and that level; an arm where a row whose
  `default` is `null` but whose prose is complete and correct yields no problem;
  and an arm where a row whose `default` is a non-gate NON-null value
  (`"adivsory"`) yields a problem naming that trigger and that value, even when
  its prose is complete and correct.
  `node cadence-core/bin/self-verify.mjs` still exits 0 - the lib is not wired
  yet - and `node --test cadence-core/bin/*.test.mjs` passes.

### Task 2: Wire the check into self-verify and record its failing run against the unpatched tree

- **Files:** cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs
- **Action:** Call the task-1 rule from the block that already has both files
  parsed - the `route-table.json` arm at `self-verify.mjs:1046-1083`, where
  `cellIssues` and `vocabularyIssues` are already called this way and `schema`,
  `table`, `TRIGGERS`, `gateSpec` and `stakesSpec` are all in hand (D-08) -
  pushing each returned `{code, detail}` onto `problems` with `file` naming
  `cadence-core/config.schema.json`, since the schema is the side that moves and
  the grid is the authority (D-04). Name the check in the `checked` string at the
  `emit` call at the foot of the run, and add its numbered entry to the header
  check list, which runs 1..17 today. It takes no CONTRACTS row, for the reason
  check 14 states about `lib/*.mjs`. Add the CLI-level test to
  `self-verify.test.mjs` on a synthetic root that writes its OWN
  `config.schema.json` and `route-table.json` - never the live ones, in the shape
  the `includeRoot` helper already uses for check 16 - asserting that `checked`
  names the new check, that a disagreeing default reaches `problems` with the
  trigger and level in `detail`, and that deleting one level clause from one of
  the four purposes files exactly one problem (AC6's second half, proved through
  the CLI rather than the lib alone). This commit deliberately leaves
  `node cadence-core/bin/self-verify.mjs` RED against the unpatched schema: that
  failing run is the phase's evidence and task 3 is what clears it. Do not fix
  the schema here, and do not add any live-tree assertion to the test file, which
  would turn `node --test` red at this commit and destroy the checkpoint the next
  task depends on.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 1, and its
  `problems` include entries naming `plan`, `diff` and `phase_diff`, with at
  least one naming both `phase_diff` and `shipped`; that one JSON line is
  recorded verbatim in this task's entry of the executor's report file, not
  paraphrased. `node --test cadence-core/bin/*.test.mjs` still passes, and
  `node cadence-core/bin/self-verify.test.mjs`'s new arm asserts `checked` names
  the check.

### Task 3: Move the four schema gate rows onto the route table

- **Files:** cadence-core/config.schema.json
- **Action:** Make `config.schema.json` state what `route-table.json` fires.
  Set all four `review.triggers.*.gate` defaults to the `null` sentinel,
  `risk_surface` included even though its `blocking` default agrees at every
  level today (D-01): a scalar default that is legal only while every level's
  cell equals it passes today and goes quiet the first time a `risk_surface` cell
  moves, which is the re-drift ENF-02 exists to catch. The
  `null`-outside-the-enum shape already ships at
  `review.triggers.risk_surface.surfaces`. Leave every `values` array
  four-membered - `null` is NOT added (D-05) - so `set` and `check` behave
  byte-identically and `check review.triggers.diff.gate=null` still refuses with
  `must be one of: off, advisory, blocking, adjudicated`. Then give each of the
  four `purpose` strings the mandatory `<gate> at <level>` clause for `solo`,
  `shipped` and `critical`, reading each value out of `route-table.json`'s
  `review` grid at edit time rather than from this plan; as of 2026-08-15 that
  grid holds plan `advisory / blocking / adjudicated`, diff `off / off /
  blocking`, risk_surface `blocking / blocking / blocking`, phase_diff `off / off
  / adjudicated`. `review.triggers.phase_diff.gate`'s existing clause "writing
  any value pins it at every level and warns" stays VERBATIM (D-10) - it is true
  of shipped code at `route.mjs:435-468` - and only its `advisory at shipped`
  claim is wrong. Change nothing in `route-table.json`: the grid is the authority
  (D-04), and its stale `_meta.review` "five triggers" count is out of scope.
  Touch no other schema key, no `type`, no `src`, and no `values` array.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 with
  `problems: []` and `checked` naming the gate-agreement check - the same command
  that exited 1 in task 2, now green with no change to the check itself. As the
  structural checkpoint the CONTEXT's second flagged assumption asks for, run
  `node --test cadence-core/bin/*.test.mjs` immediately after this edit and
  before anything else: it passes, with no test file removed and no count-pin
  assertion loosened. `node cadence-core/bin/config.mjs check
  review.triggers.diff.gate=null` returns `ok:false` carrying
  `must be one of: off, advisory, blocking, adjudicated`. The audit is RECORDED,
  not merely performed (ROADMAP criterion 2): this task's commit message names
  all twelve cells - each of `plan`, `diff`, `risk_surface` and `phase_diff` at
  `solo`, `shipped` and `critical` - whether or not the cell moved, so
  `/cad-execute` carries them into the phase SUMMARY rather than reporting that
  the schema was reconciled.

### Task 4: `config.mjs get` reports an unset gate as unset

- **Files:** cadence-core/bin/config.mjs, cadence-core/bin/config.test.mjs
- **Action:** Make the read face say which of the two states a gate is in.
  `get`'s value line at `config.mjs:261` -
  `layered[k] !== undefined ? layered[k] : SCHEMA[k].default` - is UNCHANGED
  (D-06): task 3's data edit already does the work, so an unset gate reads back
  `null` and a pinned one reads back byte-identical. What this task adds is the
  warning half. Fold one entry per offending key into the `allWarnings` array
  `get` already composes beside `retiredKeysIn(config)` and `scopeWarnings`,
  naming the key and pointing the reader at `route.mjs resolve` as where the
  level's gate is answered. Emit it ONLY when all three hold (D-02): the caller
  named keys explicitly rather than taking the keyless full read - `wanted` at
  `config.mjs:257` is `keys.length ? keys : Object.keys(SCHEMA)`, so the
  `keys.length` arm is the discriminator - the named key is a
  `review.triggers.<t>.gate`, and `layered[k]` is `undefined`. A warning on every
  read appends four lines to prose `workflows/milestone.md:104` and
  `verify.md:111` relay to the user, and a bare `null` alone under-serves GAT-02.
  The warning must NOT state what the level's gate is and must not read
  `route-table.json` (D-07): the seam does not know, and pretending it does is
  the defect in the other direction. Do not edit `config.mjs:258`'s
  `wanted.filter((k) => !SCHEMA[k])` or the `SCHEMA[k].default` read beside it -
  CAPTURE.md records a prototype-getter hazard on both faces and CONTEXT's scope
  boundary puts it OUT of this phase; if an edit lands on either line, log it as a
  deviation rather than fixing it here. Add the test arms to `config.test.mjs`
  beside the existing layered-read tests: both states of every one of the four
  triggers, the keyless read, and the `check ... =null` refusal.
- **Verify:** On a repo with no gate set,
  `node cadence-core/bin/config.mjs get review.triggers.plan.gate` (and the same
  for `diff`, `risk_surface`, `phase_diff`) returns the value `null` plus exactly
  one `warnings[]` entry naming `route.mjs resolve`; after
  `config.mjs set review.triggers.diff.gate=blocking`,
  `config.mjs get review.triggers.diff.gate` returns `blocking` with no such
  warning. `node cadence-core/bin/config.mjs get` with no key names emits no
  gate-related warning. `node --test cadence-core/bin/config.test.mjs` passes and
  contains an arm for each of those three shapes plus the `check
  review.triggers.diff.gate=null` refusal.

### Task 5: Retire the workaround paragraph from both workflow files

- **Files:** cadence-core/workflows/execute.md, cadence-core/workflows/plan.md,
  cadence-core/bin/weight-budgets.json, .planning/DOCS-CLAIMS.md
- **Action:** The criterion-4 sweep has two live hits, not one (D-11):
  `workflows/execute.md:35-39` and `workflows/plan.md:58-62` carry the same
  warning paragraph, each telling a caller not to pre-fetch a gate through
  `config.mjs get` BECAUSE that seam would answer the schema default. The
  instruction stays - `fire(trigger)` must still take every gate from the routing
  bundle so the stakes level reaches the fire site rather than only the seam -
  and the false reason goes: after task 4 a `get` of an unset gate answers `null`
  and names `route.mjs resolve`, so it is not a source for a gate at all. Rewrite
  both paragraphs to state that shipped behaviour; no surface may be left saying
  a `get` of a gate returns the schema default or that it lies. Leave
  `references/conventions.md:71-76` alone - D-11 rules it is not a hit and it is
  a budgeted surface. Both files sit at EXACTLY their `weight-budgets.json` rows
  (25289 and 22041 bytes) and the budget check fails on shrink as well as growth,
  so re-measure both with `node cadence-core/bin/weight.mjs --root .` and update
  exactly those two rows in the same commit - no other row moves. In
  `.planning/DOCS-CLAIMS.md`, both `EXECUTE-07` and its plan.md twin `PLAN-09`
  quote the retired sentence and stand at `accurate`; move both to the ledger's
  stale-then-corrected form the `CONFIG-02` row already models, citing this
  phase. Address the rows by ID, never by the line numbers in their `Lines`
  column, which have already drifted.
- **Verify:** `grep -rniE "schema default|schema DEFAULT" cadence-core docs
  README.md skills` is assessed over its WHOLE output, not only the two edited
  files (AC5 is a repo-wide sweep): every remaining hit is enumerated in the task
  commit message and each is either a legitimate use of the phrase - describing
  what a schema default IS, or the new `null`-means-unset copy - or it is fixed
  in this task. No hit anywhere claims that a `get` of a GATE returns the schema
  default, and neither `cadence-core/workflows/execute.md` nor
  `cadence-core/workflows/plan.md` appears in the output at all.
  `node cadence-core/bin/self-verify.mjs` exits
  0 with `problems: []`, which is what proves both budget rows were re-pinned
  correctly. `node --test cadence-core/bin/*.test.mjs` passes.
  `.planning/DOCS-CLAIMS.md` rows `EXECUTE-07` and `PLAN-09` no longer read
  `accurate`.

### Task 6: The catalog's gate row stops publishing a default routing never fires

- **Files:** cadence-core/references/config-catalog.md,
  cadence-core/bin/weight-budgets.json, .planning/DOCS-CLAIMS.md
- **Action:** `references/config-catalog.md`'s `review.triggers.<t>.gate` row
  publishes `adjudicated for plan · advisory for diff/phase_diff · blocking for
  risk_surface` in its Default column - three defaults the router resolves at no
  stakes level. It is in scope (D-12) precisely because it is transcribed by
  hand: `workflows/config.md:65-72` states the catalog is deliberately
  transcribed and not derived, so no schema edit reaches it, and it is the
  surface a user reads during `/cad-config`. Replace that Default cell with a
  statement that the key is unset by default and the stakes level decides,
  naming where the per-level answer is resolved; do not transcribe the twelve
  per-level values into the cell, which would create a fourth hand-kept copy for
  the next cycle to reconcile. Keep the row's per-value Explanation copy
  (`off`/`advisory`/`blocking`/`adjudicated`) intact - `workflows/config.md`'s
  walk requires each option to carry it. The `.tier` and `.effort` rows below it
  are accurate against `route-table.json`'s `tiers` grid and do not move. The
  file sits at EXACTLY its `weight-budgets.json` row (8824 bytes) and the budget
  check fails on shrink as well as growth, so re-measure with
  `node cadence-core/bin/weight.mjs --root .` and update exactly that one row in
  the same commit. In `.planning/DOCS-CLAIMS.md`, move the `CONFIG-CATALOG-08`
  row off `accurate` in the same stale-then-corrected form task 5 used, closing
  the standing CAPTURE.md phase-5 item that named this exact row; address it by
  ID, not by its `Lines` column.
- **Verify:** `grep -n "triggers.<t>.gate" cadence-core/references/config-catalog.md`
  shows a row whose Default column names no per-key scalar gate.
  `node cadence-core/bin/self-verify.mjs` exits 0 with `problems: []` and
  `checked` naming the gate-agreement check, which is what proves the budget row
  was re-pinned. `node --test cadence-core/bin/*.test.mjs` passes.
  `.planning/DOCS-CLAIMS.md` row `CONFIG-CATALOG-08` no longer reads `accurate`.

## Notes

One plan, matching CONTEXT's `Plan shape: one plan` directive. The independence
test agrees: tasks 1-3 share `self-verify.mjs` and the schema through a strict
ordering, tasks 5 and 6 both write `cadence-core/bin/weight-budgets.json` and
`.planning/DOCS-CLAIMS.md`, and task 4's AC3 result depends on task 3's data
edit, so no slice here is file-independent.

Ordering is load-bearing and not a preference. Task 1 leaves the rule unwired so
the repo stays green; task 2's commit is deliberately RED on
`node cadence-core/bin/self-verify.mjs` and its recorded failing JSON is AC1's
evidence and the phase's whole point; task 3 is the only thing that clears it.
`node --test cadence-core/bin/*.test.mjs` must stay green at every one of the
six commits, which is why task 2 adds no live-tree assertion.

Recalled prior art bearing on this phase, from `.planning/CAPTURE.md`: the
CONFIG-CATALOG gate row publishing per-key defaults `route-table.json` resolves
at no stakes level is a standing unrouted ledger item, closed here by task 6;
and the prototype-getter faces at `config.mjs:258`/`:261` sit inside the function
task 4 edits and are explicitly out of scope, called out in that task so an edit
landing on either line is logged rather than silently fixed.

`route-table.json`'s `_meta.review` still says "the five triggers
config.schema.json defines" while four remain. CONTEXT's third flagged
assumption offers it as the planner's call; its scope boundary lists it under
`Out`. The boundary wins, so no task corrects it and it stays a one-line
staleness beside a block this phase reads.
