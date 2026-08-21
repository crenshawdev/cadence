---
phase: 3
plan: 3
requirements:
  - CER-01
files:
  - cadence-core/bin/lib/phase-plans.mjs
  - cadence-core/bin/phase-plans.test.mjs
  - cadence-core/bin/route.mjs
  - cadence-core/bin/route.test.mjs
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/arg-contract.test.mjs
  - cadence-core/bin/retired-keys.test.mjs
  - cadence-core/config.schema.json
  - cadence-core/references/config-reach.md
  - cadence-core/references/config-catalog.md
  - cadence-core/references/seams.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 3: Ceremony the change pays for - Plan 3 (the replay, the waiver and the clamp)

## Goal

What the floor does to a real project is printable rather than asserted, and the
one way to route below it is an explicit per-surface waiver: replaying this
project's shipped phases through both resolvers prints the level diff per phase
and shows no surface-touching phase resolving lower than it does today, while a
lowering without the new `review.triggers.risk_surface` key is refused.

## Must be true when done

- `route.mjs replay` prints one row per phase directory this project holds -
  live and archived - carrying today's level, the computed one, and the surface
  and file behind any raise; no phase whose declared files touch an answered
  surface prints a computed level below today's (AC3).
- Lowering below the computed floor takes the new
  `review.triggers.risk_surface` waiver key naming the surface: without it the
  raise stands and `reason` names the key and the surface that would have to be
  named in it; with it the raise is withheld and the level holds at the
  configured `stakes`, never below it (AC4).
- `cadence-core/bin/lib/retired-keys.mjs` is byte-identical: a test fails on a
  one-byte change, so the eight `risk.override.*` keys stay retired while a new
  key does the waiving (AC4, D-03).
- Once a surface has raised the level, a configured `model.effort.<role>` below
  the floored cell's rung does not apply and the resolve says the floor held it -
  for post-plan roles only, `cad-planner` and `cad-assumptions-analyzer` exempt
  (D-08), which makes `references/config-reach.md`'s standing claim true again.
- `cadence-core/references/seams.md` states the waiver, the clamp and the replay
  once, and `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
  with an empty `problems` array (which covers the reach table, the flag lint
  over the edited prose and the byte budgets in one run).

## Context

Closes UAT items 3 (AC3, the replay - PLAN-2 scope in CONTEXT's shape, never
written) and 4 (AC4, the override key, the lowering arm and the byte-identical
pin), and implements D-08, the effort clamp whose absence is half of UAT item
12's stale `config-reach.md` claim.

Locked decisions: D-03 (the override is a NEW key inside
`review.triggers.risk_surface` naming the surface it waives; `retired-keys.mjs`
is NOT edited and the eight `risk.override.*` keys stay retired), D-08 (the
clamp, post-plan roles only), D-07 (the level vocabulary and the five grids do
not move), D-10 (the answered surface set scopes the floor), D-04 (never
`ok:false`, never below the configured stakes).

Sequential after PLAN-2, which fixes what the raise fires on - the replay
measures that result - and before PLAN-4, which records the measurement and
corrects the narrative documents. Shares `route.mjs`, `route.test.mjs` and
`lib/phase-plans.mjs` with PLAN-2 and `weight-budgets.json` with nothing else in
this round.

## Tasks

### Task 1: A phase directory, wherever the project keeps it

- **Files:** cadence-core/bin/lib/phase-plans.mjs (`planFilesIn`, `readOnePlan`,
  `declaredPhaseFiles`, `declaredPlanFiles`), cadence-core/bin/phase-plans.test.mjs
- **Action:** Both readers here locate a phase directory by joining
  `phases/<phase>` under the planning root, so a phase that has been ARCHIVED at
  a milestone close - `_archive-<label>/<N>/`, where `milestone-prune --mode
  archive` moves it - is unreachable, and the replay in task 2 has 3 phase
  directories to measure on this repository instead of 30. Split the locating
  from the reading: expose the same answer (`files`, `warnings`, `found`,
  `clean`, and PLAN-2's declared-nothing report) for ONE phase directory given by
  PATH, and have `declaredPhaseFiles` and `declaredPlanFiles` delegate to it so
  there is exactly one reader and one set of failure rules. Beside it, expose a
  locator listing every directory under the planning root that HOLDS a
  conforming plan file - `phases/<name>` and `_archive-*/<name>` - each with the
  path a reader takes and a stable label a report can print, sorted so two runs
  print the same order. The locator's test for "is this a phase" is that the
  directory holds a file matching the already-present `PLAN_FILE` regex, NOT a
  phase-name grammar: `PHASE_DIR_NAME` lives in `bin/planning.mjs`, a top-level
  script this lib may not import, and restating that grammar here would be the
  second copy this file's header refuses to carry - a directory with no plan
  contributes nothing to a floor anyway, so the question it can answer from disk
  is the question worth asking. Everything keeps failing OPEN: an unreadable
  planning root, an unreadable archive directory or an unreadable phase
  directory yields no entries and no throw, and an absent planning root stays the
  ordinary pre-project state with no warning.
- **Verify:** `node --test cadence-core/bin/phase-plans.test.mjs` passes with
  cases pinning: the by-path reader returns the same `files`/`found`/`clean`
  answer for a phase directory as `declaredPhaseFiles` does for the same phase,
  including the out-of-grammar and unreadable arms; the locator over a fixture
  holding `phases/1`, `phases/2`, `_archive-v1.0.0/1` and `_archive-v1.0.0/2`
  returns all four in a stable order and omits a `phases/notes` directory that
  holds no plan file; an unreadable archive directory is skipped without a throw;
  and an absent planning root returns an empty list. Run live:
  `node -e` over this repository's own planning root through the locator returns
  30 entries (3 live phases plus 27 archived).

### Task 2: The replay, off the one floor implementation

- **Files:** cadence-core/bin/route.mjs (`riskFloor`, `SYNOPSIS`, the subcommand
  dispatch at the foot of the file), cadence-core/bin/lib/arg-contract.mjs (the
  `route.mjs` block), cadence-core/bin/arg-contract.test.mjs (the census count),
  cadence-core/bin/route.test.mjs
- **Action:** Give `route.mjs` a `replay` subcommand that answers what the floor
  does to a project's own phases, in one JSON line through the existing `out`
  emitter like every other seam answer. One row per directory task 1's locator
  finds, each carrying: the directory's label, TODAY's level, the COMPUTED level,
  and - whenever the floor RAISED at all, whether or not the computed column
  differs from today's - the surface, the signal and the declared file that
  evidenced it, plus the plan counts the discount predicate read. The raise is
  the trigger for that evidence, never the diff between the two columns:
  `RAISE_TARGET` is `shipped` and the configured default is `shipped`, so on this
  repository most raises land ON today's level and a diff-triggered evidence
  column would be empty for exactly the rows whose surface a reader needs -
  leaving "matched an answered surface, already at target" and "touched nothing"
  spelled identically. A row that did not raise carries no evidence and says so.
  TODAY's level is the CONFIGURED `stakes` (the schema default `shipped` when no
  layer set it): before CER-01 `resolve` returned exactly that for every phase,
  so it is the honest second resolver and the row must not pretend a second code
  path ran. Beside the rows, an ALWAYS-PRESENT list of regressions - a phase
  whose declared files touched an answered surface and whose computed level is
  nonetheless below today's - empty on a healthy tree, which is the record shape
  `risk-check` already established: the answer is written whether or not
  anything matched, so "nothing regressed" and "nothing looked" stay apart. The
  computed column may NOT be a second implementation of the level arithmetic:
  factor the scope-to-level half of `riskFloor` - the discount predicate, the
  `stakes_order` comparison, the raise to `RAISE_TARGET`, and the reason
  vocabulary - into one helper that both `resolve` and `replay` call, so a rule
  added on one side (task 3's waiver) reaches the other by construction rather
  than by a second edit. `resolve`'s own behaviour, envelope and reason strings
  do not move. Declare the subcommand in `CONTRACTS['route.mjs']` with its
  `--file` row spelled exactly as `resolve`'s is (`string`, refusing both a bad
  value and a bare flag, defaulting to `.planning/config.json`), take no other
  flag - there is no `--role`, the floor differs by role only through the
  pre-plan exemption and a replay is a question about phases - and add the
  subcommand to `SYNOPSIS` and to the usage string that today reads `subcommand:
  resolve | table`. A planning root holding no phase directory answers `ok:true`
  with an empty row list, never a refusal.
- **Verify:** `node --test cadence-core/bin/route.test.mjs
  cadence-core/bin/arg-contract.test.mjs` passes with cases pinning: a fixture
  planning root with one surfaceless phase and one phase declaring a file on an
  answered surface returns two rows, the first with a computed level below
  today's and carrying no evidence, and the second AT today's level - the raise
  that does not move the column - still naming the surface, the signal and the
  file, with `regressions` present and empty; an archived phase directory under
  `_archive-<label>/` appears in the same run; a phase whose plan cannot be read
  prints today's level and says the discount was withheld; a bare `--file` is
  refused; and the arg-contract census assertion passes with its entry count
  updated from 167 to the new total. Live on this repository:
  `node cadence-core/bin/route.mjs replay` returns `ok:true` with 30 rows,
  `regressions: []`, and every row whose computed level is below today's naming
  no surface.

### Task 3: Lowering below the computed floor takes a named waiver

- **Files:** cadence-core/config.schema.json (beside
  `review.triggers.risk_surface.surfaces`), cadence-core/bin/route.mjs
  (`readConfig`'s `triggerFieldIn` reads and the raise arm of the floor),
  cadence-core/bin/route.test.mjs, cadence-core/references/config-reach.md (the
  reach row), cadence-core/references/config-catalog.md (the review rows),
  cadence-core/bin/weight-budgets.json
- **Action:** There is no way to route below the computed floor at all today, so
  "a lowering without the override is refused" is vacuous. Add ONE new key inside
  `review.triggers.risk_surface` - the block D-03 names, never a revival of the
  eight retired `risk.override.<surface>` keys - listing the surfaces whose RAISE
  this project waives, typed `array_enum` over the same eight categories the
  `surfaces` sibling enumerates, defaulting to `null` so "waived nothing" and
  "never answered" stay one honest state. Spell the name so it cannot be read as
  waiving the REVIEW: this key lowers the plan-time routing floor and touches
  nothing about the blocking commit-time `risk_surface` gate, which still fires
  on the actual diff, and the schema `purpose` says so in its own words. Read it
  through the existing `triggerFieldIn` reader, which already answers exactly
  this shape for `surfaces`, `gate`, `tier` and `effort` and reads only what a
  LAYER wrote. In the floor: a matched category named in the waiver raises
  nothing, and each waiver applied is stated in `reason` naming the key, the
  surface and the file it would have raised on - a silent waiver is the shape
  this seam's every other arm exists to refuse. When a waiver takes the top
  match, the next unwaived match still raises, so waiving `secrets` on a phase
  that also touches `destructive` still routes at the raise. When EVERY match is
  waived the level is the CONFIGURED `stakes` and NOT the unset-`solo` discount:
  the waiver lowers from the computed floor to the level the project stated, and
  no further - a scope that matched a surface it waived is not a scope that
  matched nothing. And the refusal is the paired arm: when a match is NOT waived
  and the configured `stakes` sits below the raise, the raise stands and the
  reason states that the lowering was refused, naming the key and the surface to
  name in it. It is never an `ok:false` and never a level below the configured
  stakes - an `ok:false` drops the caller to the host session default, below
  every floor, so "refused" here means the lowering does not take effect and the
  record says why. A waiver value outside the table's
  `risk_surface_categories` is named in `warnings` and waives nothing, matching
  how this file already treats a gate, tier or effort outside its vocabulary.
  Add the key's row to `references/config-reach.md`'s reach table (reach
  `universal`, honoured by `bin/route.mjs resolve`) - self-verify check 9 fails
  in both directions without it - and one row to
  `references/config-catalog.md` beside the `surfaces` row, since a key
  `/cad-config`'s menu cannot reach is a key most users will never find. Re-pin
  the byte row for both budgeted files in `weight-budgets.json` in this same
  commit, from `node cadence-core/bin/weight.mjs`'s measurement rather than by
  hand.
- **Verify:** `node --test cadence-core/bin/route.test.mjs` passes with cases
  pinning, all on a phase declaring a file on an answered surface: with the
  waiver naming that surface and `stakes` unset, the resolve returns the
  configured `shipped` - not `solo` - with a reason naming the key, the surface
  and the file; with the waiver naming that surface and `stakes: solo`, it
  returns `solo`; with NO waiver and `stakes: solo`, it returns `shipped` with a
  reason stating the lowering was refused and naming the key and the surface;
  with the waiver naming a DIFFERENT surface than the one matched, it still
  raises; on a phase matching two answered surfaces with only one waived, it
  raises on the unwaived one; and a waiver value outside the eight categories
  rides `warnings` and waives nothing. `node cadence-core/bin/self-verify.mjs
  --root .` returns `ok:true` with `problems: []`, and `node
  cadence-core/bin/config.mjs check` accepts the key and refuses a value outside
  its enum.

### Task 4: The retired rail, pinned byte for byte

- **Files:** cadence-core/bin/retired-keys.test.mjs
- **Action:** Criterion 4's "that rail is byte-identical" is a claim nothing
  currently checks: `retired-keys.test.mjs` asserts message content and never the
  file's bytes, so the eight `risk.override.*` rows could be edited, re-worded or
  un-retired with every test still green. Pin the file: read
  `cadence-core/bin/lib/retired-keys.mjs`'s bytes and compare a digest of them to
  a constant recorded in the test, with the comment saying what the pin protects
  and why - D-03 keeps the retired family retired because a key cannot live in
  the schema and the retired registry at once, and CER-01 gives the floor back
  through a NEW key in `review.triggers.risk_surface` (task 3) rather than by
  reviving these. Compute the digest from the file as it stands; do not edit
  `lib/retired-keys.mjs` in this task or any other in this phase. Say in the
  comment what a maintainer should do when this test goes red - re-read D-03
  before re-pinning, because a deliberate edit to that file is a decision and not
  a refresh - and record beside it that the eight `detail` strings still say
  "there is no floor for a waiver to lower", which stopped being true when the
  floor landed and which D-03 locks in place regardless. Node builtins only,
  matching this file's stated rule.
- **Verify:** `node --test cadence-core/bin/retired-keys.test.mjs` passes; and
  appending a single byte to `cadence-core/bin/lib/retired-keys.mjs` makes that
  one test fail with a message naming the file and D-03, with the byte removed
  and the suite green again before the commit.

### Task 5: A detected surface floors the configured rung too

- **Files:** cadence-core/bin/route.mjs (the floor's return and the
  `model.effort.<role>` block beneath the cell lookup),
  cadence-core/bin/route.test.mjs
- **Action:** D-08: `model.effort.<role>` still wins over the cell, but a
  DETECTED risk surface floors it, for post-plan roles only. Today the configured
  rung wins unconditionally, so a project that pinned a cheap rung for a role
  keeps it on the one phase the floor just raised - and
  `references/config-reach.md` has claimed the clamp exists since the v2.7.0
  deletion, which is half of UAT item 12. The floor already picks the ROW before
  the cell lookup runs, so the clamp is against `cell.effort` - the rung the
  FLOORED cell names: when a surface raised the level, a configured rung below
  that cell's rung in `TABLE.rung_order` does not apply, the cell's rung stands,
  and `reason` says the floor held it and names the surface, in the same voice
  the four existing arms of that block already use (each of them SAYS what it
  did; a rung that silently did not apply is the resolved-then-dropped shape this
  block exists to close). Gate it on a RAISE having fired, not merely on a floor
  having been computed: a scope that read clean and matched nothing has taken a
  discount, and clamping the user's rung against a discounted cell would take
  away the dial in the cheap case, which is the opposite of what CER-01 buys.
  The two pre-plan roles are exempt for free - no floor is computed for them at
  all - and a waived surface (task 3) raised nothing, so it clamps nothing. This
  needs the floor to report whether a raise fired, which the resolve does not
  know today; carry it back beside the level without disturbing the `reason` and
  `warnings` arrays the floor already writes into. When `rung_order` cannot place
  both rungs, keep the configured rung and say so in `warnings` rather than
  clamping on an unprovable comparison - the precedent is the retry block
  directly below, which holds a configured start rung for exactly that reason. No
  `config-reach.md` edit: the four `model.effort.<role>` rows already state the
  clamp and the planner/analyzer rows already state their exemption, and this
  task is what makes both true.
- **Verify:** `node --test cadence-core/bin/route.test.mjs` passes with cases
  pinning: with `model.effort.cad-plan-checker: "low"` and a phase whose declared
  files touch an answered surface, the resolve returns effort `medium` - the
  `shipped`/`cad-plan-checker` cell's rung - with a reason naming the clamp and
  the surface; the same config on a surfaceless phase returns `low`; the same
  config with the surface WAIVED returns `low`; `cad-planner` with a configured
  rung below its cell's is never clamped and its reason carries no clamp entry;
  and an injected table whose `rung_order` cannot place the two rungs keeps the
  configured rung with a warning.

### Task 6: The seam states the waiver, the clamp and the replay

- **Files:** cadence-core/references/seams.md (the routing block's floor
  paragraphs), cadence-core/bin/weight-budgets.json
- **Action:** One statement, in the seam, cited from the sites - the rule PLAN-1
  set when it rewrote this block, so nothing here is restated in a workflow file.
  The floor paragraph gains the waiver: lowering below the computed floor takes
  the `review.triggers.risk_surface` waiver key naming the surface, it lowers to
  the configured `stakes` and never below it, every waiver applied is named in
  `reason`, and it waives the ROUTING floor only - the blocking commit-time
  `risk_surface` review still fires on the diff. Beside it the clamp: once a
  surface has raised the level, a configured `model.effort.<role>` below the
  floored cell's rung does not apply, for post-plan roles only. And the replay:
  `route.mjs replay` answers what the floor does to this project's own phases -
  today's level against the computed one, per phase directory, live and archived
  - with the regression list always present. Keep it to the block's existing
  register and length; the eight retired `risk.override.*` keys are not mentioned
  as an alternative anywhere, since naming them beside a live waiver is how a
  user would try to set one. Re-pin `seams.md`'s byte row in
  `weight-budgets.json` in this same commit, from `node
  cadence-core/bin/weight.mjs`'s measurement.
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
  with an empty `problems` array - which is what proves the new invocation
  matches the declared contract (check 2), the new config key is reached by prose
  (check 1b) and the budget row is re-pinned (check 4) - and `node
  cadence-core/bin/test.mjs routing prose` passes.

## Notes

- Plan mapping: this plan closes UAT items 3 (AC3) and 4 (AC4) and implements
  D-08, the decision UAT item 12 names as the reason `config-reach.md:113-118` is
  stale. PLAN-2 closes items 13, 14, 11 and the `declaredBodies` symlink open
  item; PLAN-4 closes item 12's prose half and carries AC6/AC7.
- STRUCTURE DEVIATION, same as PLAN-2's: this round writes three plans where
  CONTEXT.md's `Plan shape` declared two remaining groupings, because four gap
  items belong to the executed PLAN-1's grouping and cannot be folded into a
  committed plan. Every plan in this phase shares declared files, so all of them
  are SEQUENTIAL in number order and none may run in parallel.
- The replay is a shipped subcommand rather than a one-off script or a test that
  prints, and that is a planner's choice worth naming. AC6 needs the same table
  to say which phases the computed level even moves, the next milestone's close
  needs to re-run it rather than re-derive it, and a project deciding whether to
  let the floor discount its phases wants to see what it would do BEFORE it takes
  effect - none of which a Cadence-only self-test can give. The leaner option
  considered and rejected: a `route.test.mjs` case that walks this repo's own
  phase directories and console.logs the table.
- The waiver key is settable in either config layer, like its `surfaces`
  sibling. A user-global waiver therefore applies to every project, which is
  bounded by what the key can do - it lowers a routing level and never a gate,
  and the blocking `risk_surface` review still judges the diff - and is made
  visible by the reason naming every waiver it applied. Flagged for the human
  rather than closed with new layer machinery, which no decision in CONTEXT.md
  calls for.
- `lib/retired-keys.mjs` is not edited by any plan in this phase (D-03). Task 4's
  pin freezes eight `detail` strings that say "there is no floor for a waiver to
  lower", which the floor made false at b87d5e2 and which this plan's waiver key
  makes false twice over. The decision locks the file; the sentence stands.
  Flagged for the human, not for the executor.
