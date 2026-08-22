---
phase: 1
plan: 1
requirements: [JRN-01]
files:
  - cadence-core/bin/lib/file-transition.mjs
  - cadence-core/bin/file-transition.test.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/helper-census.test.mjs
---

# Phase 1: The transaction that was never there - Plan

## Goal

One shared primitive expresses a multi-file state transition - its step
ordering, its pre-flight validation and its completed/failed record - and the
two operations that already refuse honestly, `renumber` and `milestone-prune`,
report their partial state through it rather than each through its own
hand-written loop, with neither operation's observable envelope changing.

## Must be true when done

- `cadence-core/bin/lib/file-transition.mjs` exists and is the ONE place under
  `cadence-core/bin/` where an ordered step list is run with a completed/failed
  record kept: `node --test cadence-core/bin/helper-census.test.mjs` reports 10
  cases and reddens when that module's body is copied into a second file under
  any name.
- `cmdRenumber`'s apply block and `cmdMilestonePrune`'s directory pass both run
  their steps through that module. Neither function still contains its own
  try/catch-per-step loop over an ordered list: `grep -n "for (const [op,
  runStep] of steps)" cadence-core/bin/planning.mjs` and `grep -n "for (const n
  of completed) {" cadence-core/bin/planning.mjs` each print nothing.
- `renumber remove` against a `.planning` root at `0o555` still returns
  `reason:"partial-apply"` with the same three-element `completed` list, the
  same `failed` op object `{edit:'ROADMAP.md'}` and the same two-armed hint
  wording, and `node --test cadence-core/bin/planning.test.mjs` reports 452
  tests and 0 failures with that file unedited.
- A `partial-prune` still returns the same `reason`, `action`, `failed` array,
  `phases`, `dirs`, `residue_rows`, `warnings` and three-line hint, and `node
  --test cadence-core/bin/milestone-prune.test.mjs` reports 46 tests and 0
  failures with that file unedited.
- The primitive refuses a transition WHOLE when a declared pre-flight condition
  is unsatisfied: the refusal names that condition, no step thunk ran, every
  file in the planned write set is byte-identical to what it held before the
  call, and a full recursive listing of the fixture `.planning/` root is
  identical before and after - so the arm that shipped writes no journal, no
  marker and no resume file anywhere.
- The module's own header records the refusal-protocol-not-journal decision
  with the evidence behind it, and the listing test above is what pins that arm
  in code rather than in prose.
- At the last commit `node --test 'cadence-core/bin/*.test.mjs'` exits 0, `node
  cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with `problems:
  []`, and `./node_modules/.bin/tsc -p tsconfig.ci.json` exits 0.

## Context

Locked: D-01 (REFUSAL PROTOCOL, not a journal - validate before the first
write, refuse whole, report what completed; no on-disk state, no replay, no
resume path, and #145's journal ask does not govern because its own code
citation is stale), D-02 (the primitive owns step ordering, pre-flight
validation and the completed/failed record and does NOT own the envelope - each
caller keeps its `emit()`, its reason string and its key names, on the
`withPlanningFileLock` precedent at `cadence-core/bin/lib/capture-file.mjs`),
D-03 (both callers keep the loop discipline they ship with - renumber stops at
the first throw, prune catches per phase and continues - and the primitive must
express both rather than force one on the other), D-04 (the whole-refusal
pre-flight is a NEW stage the primitive adds, never a retrofit of either
existing site: `milestone-prune`'s `partial-prune` deliberately DOES write for
the phases that cleared, and that stays), D-05 (a `HELPERS` census row makes
"one, not four" mechanical), D-06 (a new `cadence-core/bin/lib/*.mjs` module
with a sibling `*.test.mjs`; no `CONTRACTS` row, no subcommand, no arg-contract
entry - `self-verify.mjs` check 14 is top-level-only, and a new `<stem>.test.mjs`
runs automatically in `test.mjs`'s `other` group), D-07 (the re-derived
reference sites: renumber's apply block opens at `planning.mjs:5957`, its step
loop is `:6018-6038` and its `partial-apply` emit `:6024-6035`;
`cmdMilestonePrune` is declared at `:6281` and its `partial-prune` branch is
`:6534-6539`, three hint lines included), D-08 (workflow prose stays
byte-identical, so no `weight-budgets.json` re-pin and no `.planning/DOCS-CLAIMS.md`
edit is owed this phase).
Out of scope: `cmdPhaseDone` and `release-bump.mjs` (phase 2); any journal
file, resume path, `/cad-health` reader, new subcommand or `CONTRACTS` row; any
change to either operation's observable envelope; retrofitting renumber's
existing collision and `uncommitted-work` gates or prune's `archive-root-unusable`
and label gates into the new pre-flight stage; making prune all-or-nothing;
editing `cadence-core/workflows/phase.md` or `cadence-core/workflows/milestone.md`.

## Tasks

### Task 1: The transition module and its step-ordering contract

- **Files:** cadence-core/bin/lib/file-transition.mjs,
  cadence-core/bin/file-transition.test.mjs
- **Action:** Add a new zero-dependency module at
  `cadence-core/bin/lib/file-transition.mjs` (the file name is the planner's
  choice; D-06 fixes only the directory and the sibling-test shape) exporting
  one entry point that runs an ordered list of steps. Each step pairs a
  caller-owned KEY - the value that caller will put in its own envelope, an op
  object for renumber and a phase number for prune - with a zero-argument thunk
  that performs the step. The call also takes the loop DISCIPLINE, and both
  arms D-03 names must be expressible: stop-at-first-failure, where the loop
  halts, the remaining thunks never run and at most one failure is recorded;
  and continue-past-failure, where every thunk is attempted and failures are
  collected in loop order. It returns a discriminated result carrying which
  keys completed, in order, and which failed with the error each one threw. The
  result carries NO envelope - no `reason` string, no `hint`, no `emit` call,
  no `process.exitCode` - because each caller renders its own and the two
  envelopes are structurally incompatible (D-02); the house precedent to follow
  is `withPlanningFileLock` in `cadence-core/bin/lib/capture-file.mjs`, which
  returns a discriminated result for `planning.mjs` to render. The module
  touches no filesystem and spawns nothing: every I/O stays inside the caller's
  thunks, which is exactly what lets renumber keep its `git rm`, `gitMv` and
  `atomicWrite` calls and prune keep its `rmSync`, `mkdirSync`, `lstatSync` and
  `renameSync` calls where they already are. Two properties are load-bearing
  rather than incidental. Keys come back by IDENTITY, never copied or
  normalized: `cadence-core/bin/planning.test.mjs` deep-equals renumber's
  `completed` against op OBJECTS, and a structural clone would pass that
  assertion while quietly changing what the envelope carries. And a caught
  error is carried as THROWN, never stringified inside the module: renumber
  renders `e && e.message ? e.message : String(e)` into `detail` while prune
  renders `e && e.message ? e.message : e` into a warning sentence, and those
  two wordings must both stay reachable at their call sites. Put the reasoning
  in the module header, the convention `lib/lease-grammar.mjs` and
  `lib/require-int.mjs` follow rather than restating it per call site: what a
  multi-file transition is, why this is a refusal protocol and not a journal
  with D-01's evidence transcribed (renumber's `remove` destroys `phases/<at>`
  before the first move so step one can never be undone; prune is already
  resumable with zero on-disk state by recomputing its candidate set; a journal
  written under `.planning` fails EACCES first in the very fixture that produces
  `partial-apply`, which would redden the assertions AC1 names as its pin), and
  why the envelope stays with the caller. Carry `// @ts-check` at the top like
  every sibling under `lib/`. Do not touch `cadence-core/bin/planning.mjs` in
  this task: the module lands and is proven on its own first.
- **Verify:** `node --test cadence-core/bin/file-transition.test.mjs` exits 0
  with a table covering, over a three-step list whose second thunk throws:
  under the stop discipline, step 1's key completed, step 2 reported failed
  carrying the thrown error, and a side-effect counter proving step 3's thunk
  never ran; under the continue discipline, steps 1 and 3 completed and step 2
  failed; an all-succeeding three-step list reporting every key completed and
  no failure under BOTH disciplines; an empty step list succeeding with nothing
  completed; and an object step key returned by identity, asserted with
  `assert.strictEqual` rather than `deepEqual` so a clone fails the case. Also
  `./node_modules/.bin/tsc -p tsconfig.ci.json` exits 0, and `git status
  --porcelain` lists only the two files this task declares.

### Task 2: The pre-flight stage, and the refusal that writes nothing

- **Files:** cadence-core/bin/lib/file-transition.mjs,
  cadence-core/bin/file-transition.test.mjs
- **Action:** Extend the entry point with an ordered list of caller-declared
  PRE-FLIGHT CONDITIONS, evaluated before the first step's thunk runs. Each
  condition answers satisfied-or-not and carries its own description; the first
  unsatisfied one ends the call, no thunk runs, nothing is written, and the
  result names that condition and is distinguishable at the result level from a
  step failure - the caller has to be able to tell "nothing was attempted"
  from "step one failed", which is the same distinction renumber's two-armed
  hint already makes and would otherwise have to re-derive. Conditions after
  the refusing one are not evaluated: pre-flight ordering is the guarantee this
  stage exists to give, and a caller that declares a cheap readability check
  ahead of an expensive one must get that order. The module declares NO
  built-in conditions and probes no filesystem of its own. That is deliberate
  and is the phase's flagged assumption made structural: a "planned write" here
  means a condition the caller can genuinely pre-check, and a primitive that
  advertised a whole-transaction refusal it can only deliver for the failures
  it happens to be able to see would talk callers out of hand-checking the
  tree - the exact failure mode renumber's own D-03 comment names. No on-disk
  state of any kind is created on any path through this module: no journal, no
  marker file, no lock, no temp path (D-01). Do NOT retrofit this stage onto
  either existing caller (D-04): prune's shipped `partial-prune` deliberately
  writes for the phases that cleared, renumber's collision and
  `uncommitted-work` gates stay where they sit above its dry-run return, and
  moving either is a different change with its own blast radius. Keep the
  header's reasoning current in the same edit.
- **Verify:** `node --test cadence-core/bin/file-transition.test.mjs` exits 0
  with, in addition to task 1's table: (a) a fixture case building a temp
  `.planning/`-shaped tree of three files and a step list whose thunks would
  rewrite all three, with three declared conditions of which the SECOND is
  unsatisfied - the result is a refusal naming that second condition, all three
  files read back byte-identical to what they held before the call, a
  side-effect counter proves no thunk ran, and another proves the third
  condition was never evaluated; (b) the same refused call with a full
  recursive listing of the fixture root (sorted relative paths) taken before
  and after, asserted `deepEqual`, so a journal, marker or temp path anywhere
  under it reddens the case; (c) all conditions satisfied runs the steps
  normally under both disciplines; (d) an empty condition list behaves exactly
  as no pre-flight at all. `./node_modules/.bin/tsc -p tsconfig.ci.json` exits
  0.

### Task 3: `cmdRenumber`'s apply loop through the primitive

- **Files:** cadence-core/bin/planning.mjs (`cmdRenumber` apply block)
- **Action:** Replace the hand-written `for (const [op, runStep] of steps)`
  try/catch loop with one call through the new module under the
  stop-at-first-failure discipline. The `steps` array construction stays
  exactly where it is and in exactly its current order - the rm first, then the
  directory moves, then ROADMAP.md, REQUIREMENTS.md and STATE.md - and the
  comment above it explaining why that order differs from the `ops` array the
  dry-run prints is load-bearing and stays with it. The failure arm keeps every
  byte of its envelope: `reason:'partial-apply'`, `completed` as the op objects
  in order, `failed` set to the failing op OBJECT itself rather than an array
  or a wrapper, `detail` derived from the thrown error through the same `e &&
  e.message ? e.message : String(e)` expression, and the two-armed `hint`
  selected on whether anything completed, both sentences unchanged. Those hint
  sentences are pinned, not stylistic: `planning.test.mjs` asserts
  `doesNotMatch(r.hint, /by hand,\s*then re-run/)` and `match(r.hint,
  /destroy/)` on the partial arm and `match(r.hint, /nothing was written/)`
  plus `doesNotMatch(r.hint, /partly renumbered/)` on the nothing-written arm,
  and a paraphrase reddens them. Keep the D-11 note recording why this arm
  bypasses `fail()`. The emit still `return`s, so the sanity recount below it -
  `parseRoadmapPhases(read(roadmapFile) || '')` feeding `ok({...result,
  total})` - is reached only on success, as today. Do not touch anything above
  the dry-run return: the destination-collision check with its `vacated` set,
  the `uncommitted-work` / `unreadable-git-state` gate and the `git rm` residue
  refusal all stay where they are (D-04). `cadence-core/bin/planning.test.mjs`
  is deliberately NOT in this plan's declared `files:`, so an edit to it is
  refused by `lease-check` at the commit step - AC1 requires those cases pass
  unmodified, and the lease is what makes "unmodified" mechanical rather than
  remembered.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` exits 0
  reporting 452 tests and 0 failures, with the cases `renumber remove: a
  partial apply reports which ops completed (#49.2)` and `renumber remove: a
  failure before ANY step says so, rather than claiming a half-renumbered tree`
  both passing by name and `git status --porcelain --
  cadence-core/bin/planning.test.mjs` printing nothing. `grep -n "for (const
  [op, runStep] of steps)" cadence-core/bin/planning.mjs` prints nothing. Both
  hint sentences pinned BYTE-EXACT, since the shipped assertions
  (`match(/destroy/)`, `match(/nothing was written/)` and the two
  `doesNotMatch`) pass on a paraphrase that keeps those keywords and AC2 asks
  for a pin that reddens on one: `grep -c -F 'the tree is partly renumbered and
  no longer matches ROADMAP - reconcile the completed ops by hand before any
  further renumber; re-running this command against the half-applied tree can
  destroy a phase directory' cadence-core/bin/planning.mjs` prints `1`, and
  `grep -c -F 'nothing was written - the first step failed, so the tree is
  unchanged and safe to re-run once the cause is fixed'
  cadence-core/bin/planning.mjs` prints `1`. The check lives HERE rather than as
  a new assertion because `planning.test.mjs` is outside this plan's declared
  `files:` and `lease-check` refuses an edit to it.
  `./node_modules/.bin/tsc -p tsconfig.ci.json` exits 0.

### Task 4: `cmdMilestonePrune`'s directory pass through the primitive

- **Files:** cadence-core/bin/planning.mjs (`cmdMilestonePrune` directory pass)
- **Action:** Route the directory pass through the same module under the
  continue-past-failure discipline, one step per completed phase keyed by the
  phase NUMBER. Each thunk keeps everything the loop body does today, in the
  same order: the `existsSync` miss that records `dirs.missing` and attempts
  nothing (a missing directory is already gone, which is what makes a re-run
  idempotent, and it is NOT a failure), the `rmSync` on delete mode, and on
  archive mode the `mkdirSync(archiveRoot, {recursive:true})`, the `lstatSync`
  destination check that throws `already exists - a previous close left it
  there` rather than letting `renameSync` decide, and the `renameSync` itself.
  `dirs.archived`, `dirs.deleted` and `dirs.missing` keep filling in loop
  order. After the call, derive the envelope's `failed` as the failing phase
  numbers in loop order - it is a bare number array and
  `cadence-core/bin/milestone-prune.test.mjs` deep-equals it to `[1]` - and
  append one warning per failure using today's wording character for character,
  `phase <n>: directory <mode> failed: <message>`, appended immediately after
  the call so warning ORDER is unchanged: the REQUIREMENTS.md-missing warning
  still precedes them and the `pruned.missingSections` warnings still follow.
  Everything downstream is untouched: `applied = completed.filter((n) =>
  !failed.includes(n))`, `pruneRoadmap`, `archiveRequirements`, the `if
  (applied.length)` guarded document writes, the envelope's field order and the
  `partial-prune` emit with all three of its hint lines. The ARCHIVE.md residue
  write stays exactly where it is, ABOVE this pass and under its
  `withPlanningFileLock` guard - the RCL-07/D-01 comment explains that moving
  it after the loop reopens the reachability hole, and this task must not move
  it. Do not make prune all-or-nothing (D-04): a partial prune writing the
  documents for the phases that cleared is asserted behaviour, not a defect -
  the tree and the documents agreeing is what that ordering was built to fix.
  `cadence-core/bin/milestone-prune.test.mjs` is deliberately outside this
  plan's lease for the same reason task 3 keeps `planning.test.mjs` outside it.
- **Verify:** `node --test cadence-core/bin/milestone-prune.test.mjs` exits 0
  reporting 46 tests and 0 failures - 45 passing with `corpus: pruning this
  repository's own REQUIREMENTS.md needs no hand repair` skipping while the
  live roadmap carries no completed phase, or 46 passing once it does - with
  the cases `seam: a phase whose directory move fails is refused, and keeps its
  docs`, `seam: when every phase fails, neither document is written at all` and
  `seam: an interrupted close keeps its rows, and the re-run neither duplicates
  nor drops them` passing by name, and `git status --porcelain --
  cadence-core/bin/milestone-prune.test.mjs` printing nothing. `node --test
  cadence-core/bin/planning.test.mjs` still exits 0 at 452 tests. `grep -n "for
  (const n of completed) {" cadence-core/bin/planning.mjs` prints nothing,
  while the residue loop `for (const n of [...completed].sort(...))` above it is
  still there. `./node_modules/.bin/tsc -p tsconfig.ci.json` exits 0.

### Task 5: The census row that makes "one, not four" mechanical

- **Files:** cadence-core/bin/helper-census.test.mjs
- **Action:** Add a ninth entry to the `HELPERS` list whose `home` is the new
  module and whose `re` is the BODY IDIOM of its step loop - never an export
  name and never a call site, because `cmdRenumber` and `cmdMilestonePrune`
  legitimately CALL the module after tasks 3 and 4 and a call-site census would
  redden on every correct use, while a paste-back under a new name is still a
  copy of the body. Build the pattern from an escaped string the way all eight
  existing entries do, so this file stays censused by its own `everyModule`
  walk and needs no exemption; the text the rule matches must not appear
  verbatim in this file. If the natural idiom is not unique in the tree, tighten
  the module's own expression rather than adding an exclusion list - the
  discipline this file's header states and `lib/merge-warnings.mjs` owns. Keep
  the existing assertion shape, `deepEqual(found, ['<home> (x1)'])`, so a dead
  pattern and a second copy both redden, and write the `note` to name the
  module to import from and what a second copy costs: two operations each
  writing their own ordered step loop with their own completed/failed record IS
  the JRN-01 defect, and without this row a fifth hand-written approximation
  lands in a sixth file with no test able to see it (D-05). Add the module to
  the named-file list in the `the census walks the whole bin tree, lib/ and test
  files included` case, which already pins that the walk reaches `lib/`, so a
  rename or a move fails loudly instead of making the new arm vacuous.
- **Verify:** `node --test cadence-core/bin/helper-census.test.mjs` exits 0
  with 10 cases - the walk case plus nine `exactly one definition of ...`.
  Then run `cp cadence-core/bin/lib/file-transition.mjs
  cadence-core/bin/lib/census-probe.mjs && node --test
  cadence-core/bin/helper-census.test.mjs; rm -f
  cadence-core/bin/lib/census-probe.mjs`: the middle run exits non-zero and the
  failing assertion names both `lib/census-probe.mjs` and the module, proving
  the pattern is live rather than dead; the probe file is never staged.
  Finally `node --test 'cadence-core/bin/*.test.mjs'` exits 0, `node
  cadence-core/bin/self-verify.mjs --root .` prints `ok:true` with an empty
  `problems` array, and `./node_modules/.bin/tsc -p tsconfig.ci.json` exits 0.

## Notes

- One plan, matching the CONTEXT `Plan shape` directive, and the independence
  test agrees rather than merely permitting it: tasks 1 and 2 share both new
  files, tasks 3 and 4 share `cadence-core/bin/planning.mjs`, and tasks 3-5 all
  depend on the module task 1 creates. There is no slice here with no shared
  files and no cross-slice ordering.
- The lease is doing enforcement work, not just declaration.
  `cadence-core/bin/planning.test.mjs` and
  `cadence-core/bin/milestone-prune.test.mjs` are deliberately absent from
  `files:` so that staging an edit to either is refused by `planning.mjs
  lease-check` at the commit step. AC1 and AC2 both require those files pass
  UNMODIFIED, and an executor that widens the lease to reach them has
  contradicted the phase's own acceptance rather than unblocked itself - new
  cases belong in `cadence-core/bin/file-transition.test.mjs`.
- Two names in this plan are the planner's choice inside decisions that fixed
  only the shape: the module file `cadence-core/bin/lib/file-transition.mjs`
  and its sibling `cadence-core/bin/file-transition.test.mjs` (D-06 fixed the
  directory, the sibling-test convention and that no `CONTRACTS` row is owed).
  Every export name inside the module is likewise the executor's, since no
  decision fixes one - an executor that picks differently owes a deviation
  note, not a re-plan, provided the census `home`, the walk case's named-file
  list and both call sites move with it. The stem must stay unnamed by any
  group in `cadence-core/bin/test.mjs`, which is what puts it in `other` and
  runs it by default.
- No prose surface moves this phase (D-08). The two claims that would have -
  `cadence-core/workflows/phase.md:62-64`, pinned as row PHASE-11 in
  `.planning/DOCS-CLAIMS.md`, and `cadence-core/workflows/milestone.md:150-153`
  - both stay true byte for byte, because neither envelope changes and renumber
  is still not transactional. So no `weight-budgets.json` re-pin and no
  `DOCS-CLAIMS.md` edit is owed, and neither file is in the lease.
- Baselines measured on this branch at planning time, so a Verify figure that
  moves is a signal rather than a surprise: `planning.test.mjs` 452 tests / 452
  pass, `milestone-prune.test.mjs` 46 tests / 45 pass / 1 skip,
  `helper-census.test.mjs` 9 tests / 9 pass, `self-verify.mjs --root .`
  `ok:true` with `problems: []`, and `./node_modules/.bin/tsc -p
  tsconfig.ci.json` exit 0. `tsc` resolves from this repo's `node_modules/.bin`
  even though the repo carries no `package.json`; if it is absent in the
  execution environment, CI's typecheck step is the same check and the local
  run may be reported as unavailable rather than passed.
- The phase's second flagged assumption stays open by design: nothing here
  tests that the primitive's shape suits phase 2's `cmdPhaseDone` and
  `release-bump.mjs`. The import path is already proven -
  `cadence-core/bin/release-bump.mjs` imports `atomicWrite` from
  `lib/planning-files.mjs` - but the shape adequacy is not, and phase 2 is
  where it is paid for if it is wrong. That is a reason to keep the result
  discriminated and envelope-free (D-02), not a reason to add speculative
  fields here.
- A recalled `risk_surface` survivor from `v3.5.4` phase 1 bears on this
  surface without being in scope: `gitDirUnder` recurses without a depth bound,
  and a deep chain exhausts the stack and surfaces as a `partial-apply`
  refusal. It fails safe, and it reaches renumber's rm step through the thunk
  this phase moves rather than rewrites, so routing that step through the
  primitive neither fixes nor worsens it. Named here so a verifier seeing
  `partial-apply` on a deep tree knows it is a carried medium, not a
  regression this phase introduced.
