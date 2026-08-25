---
phase: 4
plan: 1
requirements: [SPL-01, SPL-02]
files:
  - cadence-core/bin/planning/core.mjs
  - cadence-core/bin/planning/status.mjs
  - cadence-core/bin/planning/recall.mjs
  - cadence-core/bin/planning/criteria-size.mjs
  - cadence-core/bin/planning/plan-size.mjs
  - cadence-core/bin/planning/plan-overlap.mjs
  - cadence-core/bin/planning/cite-count.mjs
  - cadence-core/bin/planning/lease-check.mjs
  - cadence-core/bin/planning/uat.mjs
  - cadence-core/bin/planning/deferred-carry.mjs
  - cadence-core/bin/planning/deferred-list.mjs
  - cadence-core/bin/planning/trace.mjs
  - cadence-core/bin/planning/capture.mjs
  - cadence-core/bin/planning/adjudication.mjs
  - cadence-core/bin/planning/deferred-record.mjs
  - cadence-core/bin/lib/census-registry.mjs
  - cadence-core/bin/phase-spelling.test.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/planning-status.test.mjs
  - cadence-core/bin/planning-recall.test.mjs
  - cadence-core/bin/citation-census.test.mjs
  - cadence-core/bin/planning-lease-check.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/references/roadmap-phases.md
  - cadence-core/references/conventions.md
  - cadence-core/workflows/progress.md
  - cadence-core/workflows/new-project.md
  - cadence-core/workflows/adopt.md
  - skills/cad-health/SKILL.md
  - skills/cad-verifier-contract/SKILL.md
  - .planning/REQUIREMENTS.md
  - .planning/DOCS-CLAIMS.md
---

# Phase 4: One spelling, one phase - Plan

## Goal

A phase spelling that would be silently normalized is refused where it is
written, and a phase directory whose name would collide with another phase is
reported as drift.

## Must be true when done

- On a tree carrying `phases/1`, `phases/1.00`, `phases/1.01`, `phases/2` and
  `phases/2.0`, `planning.mjs status` reports a `phase-dir-grammar` drift entry
  naming each illegal name and naming the legal directory it collides with.
  `phases/1.1`, `phases/1.10` and `phases/8` stay legal and produce no entry.
- On a closed-milestone tree carrying both `phases/8` and `phases/08`,
  `planning.mjs status` emits exactly ONE `phase-dir` drift entry carrying
  `phase: 8`, and `planning.mjs recall` returns no snippet sourced from
  `phases/08/`.
- Every `planning.mjs` command that resolves `--phase` to a `phases/<N>/` path
  answers `ok:false` with a `bad-args` reason naming both fixes when the
  normalized spelling names a directory that exists on that tree, and resolves
  the caller's own spelling when it does not. `cursor set` and `seed-reqs` still
  refuse a lossy spelling regardless of what is on disk, and
  `capture --phase 1.10` still writes the tag `(phase 1.10)`.
- `cadence-core/references/roadmap-phases.md` is the only file under `skills/`,
  `cadence-core/workflows/` and `cadence-core/references/` that states the
  phase-directory grammar, and it states that `2.0` is not a legal spelling of
  phase 2.
- Adding a `requirePhaseArg` callsite under `cadence-core/bin/planning/` that
  resolves a `phases/<N>/` path without the tree-aware check fails
  `node cadence-core/bin/test.mjs` with a message naming that file and line, and
  the registry row watching that count leaves `planning-lease-check.test.mjs`'s
  half-the-plans rail passing.
- `node cadence-core/bin/test.mjs` runs green, `npx tsc -p tsconfig.ci.json`
  exits 0, and `cadence-core/bin/self-verify.mjs` reports `problems []`.

## Context

CONTEXT.md's decisions bind every task below. The grammar fix is an explicit
fraction grammar and never a round-trip predicate (D-01), `2.0` is not a synonym
for phase 2 (D-02), the drift grouping key stays the leading digit run (D-03),
and both `phases/` listing filters are tightened rather than commented (D-04).
`phaseSpellingRefusal` (`planning/core.mjs:77`) stays pure and unconditional at
`cursor set` and `seed-reqs`; the reach at the path-resolving callsites is a
SEPARATE tree-aware check (D-07), and `capture` is the standing exception that
takes a comment rather than a wire (D-08).
Out of scope: making `2.0` addressable, changing the two existing write faces,
rewriting citations under `.planning/_archive-v*` or `.planning/trace.jsonl`,
and any callsite outside `cadence-core/bin/planning/` (D-05).
Two censuses break by construction and are handled where they break: the
citation census pins `status.mjs:28` and `core.mjs:77` by exact line (D-13), and
its `CITATIONS.length >= 3` floor retires with SPL-01 and SPL-02 (D-12).

## Tasks

### Task 1: The phase-directory grammar rejects a zero-padded fraction

- **Files:** cadence-core/bin/planning/status.mjs,
  cadence-core/bin/planning/core.mjs, cadence-core/bin/planning-status.test.mjs,
  .planning/REQUIREMENTS.md, cadence-core/bin/citation-census.test.mjs
- **Action:** Start at `PHASE_DIR_NAME` and `phaseDirGrammarDrift` in
  `planning/status.mjs`, `phaseSpellingRefusal` in `planning/core.mjs`, the
  `SPL-01` bullet in REQUIREMENTS.md's `## Active`, and the `CITATIONS` table in
  `citation-census.test.mjs`.
  Move `PHASE_DIR_NAME` out of `planning/status.mjs` into
  `planning/core.mjs`, add it to core.mjs's single `export {` list, import it
  back into `status.mjs`, and tighten its fractional part so the whole grammar
  is `/^[1-9]\d*(?:\.[1-9]\d*)?$/`. The move is what core.mjs's own header rule
  requires once task 2 gives the constant a second reader in `recall.mjs`: a
  constant two families reach is core, and a second copy of a grammar is what
  `helper-census.test.mjs` exists to stop. Do NOT reuse
  `phaseSpellingRefusal`'s `String(Number(x)) === x` round trip (D-01): measured
  2026-08-25 against the live regexes, `1.01` round-trips and `1.10` does not, so
  a round-trip rule inverts two of the six cases this criterion names.
  `2.0` is illegal for the reason D-02 states - the fraction is the sub-phase
  ordinal and obeys the same no-padding rule as the integer part, so `.0` is not
  a fraction at all - and nothing learns to resolve it. Leave the grouping key in
  `phaseDirGrammarDrift` alone: it is the leading digit run `/^\d+/`, which is
  what groups `1.01` and `1.00` against `phases/1` while leaving `1.10` out of
  the report entirely (D-03); grouping by `Number(name)` would group `1.10` with
  `1.1` and produce an entry this criterion forbids. Reword only the parenthetical
  in that function's `detail` so it states the fraction rule too - no test asserts
  that parenthetical today, while three assert the surrounding sentences. Carry
  the constant's header comment with it and correct the false sentence in it: the
  claim that the listing filters "keep a zero-padded directory out of the corpus"
  is untrue, measured 2026-08-25 - `/^\d+(\.\d+)?$/` matches `08`, `0`, `1.01`,
  `1.00` and `2.0` (task 2 closes that half). Place the constant AFTER
  `phaseSpellingRefusal`'s closing brace so nothing at or above `core.mjs:82`
  shifts; `citation-census.test.mjs` pins `core.mjs:77` by exact line and asserts
  `phaseSpellingRefusal` appears on it (D-13). `PHASE_DIR_NAME`'s own citation
  DOES move: re-pin `SPL-01`'s `cadence-core/bin/planning/status.mjs:28`
  reference in `.planning/REQUIREMENTS.md`'s `## Active` section and the matching
  `CITATIONS` row to the file and line the constant now sits on, in this same
  commit - LOD-01's discipline, that every citation moves with the code it names.
- **Verify:** `node --test cadence-core/bin/planning-status.test.mjs
  cadence-core/bin/citation-census.test.mjs` passes, and on a scratch planning
  tree whose `phases/` holds `1`, `1.00`, `1.01`, `1.1`, `1.10`, `2`, `2.0` and
  `8`, `node cadence-core/bin/planning.mjs status --dir <tree>` returns exactly
  two `phase-dir-grammar` drift entries: one with `entries` `["1.00","1.01"]`
  whose detail names `phases/1`, and one with `entries` `["2.0"]` whose detail
  names `phases/2`. No entry mentions `1.1`, `1.10` or `8`.

### Task 2: The two `phases/` listing filters read that same grammar

- **Files:** cadence-core/bin/planning/status.mjs,
  cadence-core/bin/planning/recall.mjs,
  cadence-core/bin/planning-status.test.mjs,
  cadence-core/bin/planning-recall.test.mjs
- **Action:** The two sites are the surviving-directory filter inside `cmdStatus`
  and the `phasesDir` corpus walk in `cmdRecall`.
  Replace the `/^\d+(\.\d+)?$/` test at both with the
  constant task 1 put in `planning/core.mjs`, importing it in `recall.mjs`
  alongside the helpers it already takes from that module. Both are tightened
  rather than left with a corrected comment (D-04), because the cost of leaving
  them loose is measured and live: a tree holding `phases/8` and `phases/08`
  emits TWO `phase-dir` drift entries both carrying `phase: 8`, and `recall`
  indexes `phases/08/SUMMARY.md` snippets under `phase: 8`, which returns a
  different phase's evidence as this phase's. Leave everything downstream of the
  filters alone: the surviving-directory sort and the corpus's `Number(n)` phase
  key are unchanged, and `phases/1.10/` stays a legal corpus member because the
  grammar still admits it. Do not widen this to any other `phases/` reader -
  `lib/phase-plans.mjs` and `lib/planning-files.mjs` are outside this phase.
- **Verify:** On a closed-milestone tree (a `## Phases` heading with nothing
  under it) whose `phases/` holds `8` and `08`, `planning.mjs status` returns
  exactly one `phase-dir` drift entry and its `phase` is `8`; and with a
  `SUMMARY.md` under each of `phases/8/` and `phases/08/`, `planning.mjs recall
  --query <a term only the 08 summary carries>` returns no result whose `source`
  starts `phases/08/`. `node --test cadence-core/bin/planning-status.test.mjs
  cadence-core/bin/planning-recall.test.mjs` passes.

### Task 3: A tree-aware spelling check, wired at the shared fire identity

- **Files:** cadence-core/bin/planning/core.mjs,
  cadence-core/bin/planning/adjudication.mjs,
  cadence-core/bin/planning/deferred-record.mjs,
  cadence-core/bin/phase-spelling.test.mjs
- **Action:** Start at `phaseSpellingRefusal`, `fireIdentity` and `fireHome` in
  `planning/core.mjs`, and at `cmdAdjudication` and `cmdDeferredRecord`, the two
  functions that call `fireIdentity`.
  Add a SECOND spelling check beside `phaseSpellingRefusal` in
  `planning/core.mjs`, exported from the same `export {` list, taking the
  planning directory and a `requirePhaseArg` success and answering a refusal
  detail or nothing. It refuses exactly when the caller's spelling is not the
  canonical one AND `phases/<canonical>/` is an existing directory under that
  planning directory, so `--phase 1.10` refuses against a tree holding
  `phases/1.1/` and resolves against a tree holding only `phases/1.10/`. The
  detail names BOTH fixes the way `phaseSpellingRefusal`'s does, because the
  caller's remedy is exactly one of two things and nothing else in the envelope
  says which. `phaseSpellingRefusal` itself is left byte-unchanged: it stays pure
  and unconditional at `cursor set` and `seed-reqs` (D-07), which v3.5.5's UAT
  pinned, and wiring it everywhere instead would make `phases/1.10/` a legal
  directory name no command can address - the cost `core.mjs:67-71` already
  states for two callsites, generalized to twenty-two. Place the new function
  after `phaseSpellingRefusal`'s closing brace so `core.mjs:77` does not shift
  (D-13). Then wire it at `fireIdentity`, the one callsite `adjudication` and
  `deferred record` share: give `fireIdentity` the planning directory both
  callers already hold in scope, and refuse `bad-args` immediately after
  `requirePhaseArg` succeeds, ahead of the `--trigger`/`--discriminator` token
  rails and well ahead of `fireHome`. `fireHome`'s existing `no-phase-dir`
  refusal is not a substitute: it names the right directory but not the two
  fixes, which is exactly the pre-change behaviour D-06 warns a plan against
  mistaking for the new one. Create
  `cadence-core/bin/phase-spelling.test.mjs` to hold both arms for these two
  faces; the stem is deliberately not a `planning-*` one, so it lands in
  `test.mjs`'s `other` group with no `GROUPS` edit, the same disposition
  `census-registry.test.mjs:19` states for itself.
- **Verify:** `node --test cadence-core/bin/phase-spelling.test.mjs` passes with
  arms proving, for both `adjudication` and `deferred record`: against a tree
  holding `phases/1.1/`, `--phase 1.10` returns `ok:false` with
  `reason: "bad-args"` and a detail naming both `1.10` and `1.1`; against a tree
  holding only `phases/1.10/`, the same argv gets past the phase check (it
  reaches a later refusal or succeeds, and never answers `bad-args` about the
  spelling). `node --test cadence-core/bin/planning-adjudication.test.mjs
  cadence-core/bin/planning-deferred.test.mjs` still passes.

### Task 4: The six phase-artifact readers refuse a colliding spelling

- **Files:** cadence-core/bin/planning/criteria-size.mjs,
  cadence-core/bin/planning/plan-size.mjs,
  cadence-core/bin/planning/plan-overlap.mjs,
  cadence-core/bin/planning/cite-count.mjs,
  cadence-core/bin/planning/lease-check.mjs,
  cadence-core/bin/planning/uat.mjs, cadence-core/bin/planning.test.mjs,
  cadence-core/bin/phase-spelling.test.mjs
- **Action:** The six functions are `cmdCriteriaSize`, `cmdPlanSize`,
  `cmdPlanOverlap`, `cmdCiteCount`, `cmdLeaseCheck` and `cmdUat`.
  Wire task 3's check at each of the six `requirePhaseArg` callsites
  that address `phases/<N>/` from the caller's spelling - `criteria-size.mjs:77`
  inside the `--phase` branch, `plan-size.mjs:27`, `plan-overlap.mjs:26`,
  `cite-count.mjs:57`, `lease-check.mjs:198` and `uat.mjs:62` - each refusing
  `bad-args` immediately after the parse succeeds and before any read of the
  phase directory, which is the `#42`/`#45` rail these files already hold. Wire
  every one of them, not only the ones that echo `.value`: a pure `.raw` reader
  left addressable is the half D-06 rejects. Then re-fixture the five pinned rows
  in `planning.test.mjs` this reverses, which today assert the pre-change
  behaviour on trees that now refuse: `:391` (`lease-check --phase 1.10` on a
  tree holding both `phases/1.1/` and `phases/1.10/`, asserting `ok:true`),
  `:407` (`lease-check --phase 08` on a tree holding `phases/8/`, asserting
  `no-plan`), `:417` (`plan-overlap --phase 08` on a tree holding `phases/8/`,
  asserting `no-phase-dir`), `:427` (`plan-overlap --phase 1.10` on a tree
  holding both) and `:446` (`uat --phase 1.10` on a tree holding `phases/1.1/`,
  asserting `no-uat`). Split each: keep the "acts on the caller's own spelling"
  half on a tree that does NOT hold the normalized directory, which is the
  capability `lib/require-int.mjs` deliberately built and which this phase keeps,
  and assert the new `bad-args` refusal on the tree that does. Correct the
  comment at `planning.test.mjs:478`, which claims the sibling
  `plan-overlap --phase 08` row still answers `no-phase-dir` - after this task it
  does not, and a stale comment beside a rewritten fixture is what makes the next
  reader re-derive the wrong rule.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs
  cadence-core/bin/phase-spelling.test.mjs` passes, with `phase-spelling.test.mjs`
  carrying both arms for all six commands: `--phase 1.10` against a tree holding
  `phases/1.1/` returns `ok:false` with `reason: "bad-args"` and a detail naming
  both spellings, and against a tree holding only `phases/1.10/` the same argv
  acts on `phases/1.10/`.

### Task 5: The queue and record commands refuse it too, and `capture` states its exemption

- **Files:** cadence-core/bin/planning/deferred-carry.mjs,
  cadence-core/bin/planning/deferred-list.mjs,
  cadence-core/bin/planning/trace.mjs,
  cadence-core/bin/planning/capture.mjs,
  cadence-core/bin/phase-spelling.test.mjs,
  cadence-core/bin/trace.test.mjs
- **Action:** Start at `cmdDeferredCarry`, `cmdDeferredList`, `cmdTrace`'s shared
  `append`/`close` arm with `recountReceipt` and `recordForFire` behind it, and
  the `--phase` branch of `cmdCapture`.
  Wire task 3's check at the three remaining path-resolving callsites:
  `deferred-carry.mjs:42`, `deferred-list.mjs:47` inside its `'phase' in opts`
  branch, and `trace.mjs:376`, the body `append` and `close` share. `deferred
  list` earns the wire even though it echoes nothing numeric, because its
  `wantPhase` selects a directory under `phases/` by exact name in `readQueue`;
  `trace append`/`close` earns it because its `.raw` reaches `recountReceipt` and
  then `recordForFire`'s `join(dir, 'phases', ...)`. Refuse `bad-args` right after
  the parse succeeds in each. Do NOT wire `trace`'s `suggest`, `render` and
  `window` arms or `checkpointPlanTasks`: those scope a `.planning/trace.jsonl`
  filter and resolve no `phases/<N>/` path, and `checkpointPlanTasks` reads a
  phase off a record line rather than off a flag. Then give `capture.mjs:85` the
  one-line comment D-08 requires instead of a wire, naming why: `parsed.raw` is a
  TAG written into CAPTURE.md at `:92`, the command resolves no `phases/<N>/`
  path at all, and `capture-file.test.mjs:93-98` pins that `--phase 1.10` produces
  `(phase 1.10)`. `trace.test.mjs:365` builds its tree with no `phases/`
  directories at all, so its `1.1`/`1.10` rows should survive unchanged; if the
  fixture proves otherwise, re-fixture it the way task 4 re-fixtures its five,
  never by weakening the assertion.
- **Verify:** `node --test cadence-core/bin/phase-spelling.test.mjs
  cadence-core/bin/trace.test.mjs cadence-core/bin/planning-deferred.test.mjs
  cadence-core/bin/capture-file.test.mjs` passes, with `phase-spelling.test.mjs`
  carrying both arms for `deferred carry`, `deferred list` and `trace append`, and
  with arms proving the three exemptions still answer: `capture --phase 1.10`
  writes the tag `(phase 1.10)`, and `trace render --phase 1.10` still renders on
  a tree holding `phases/1.1/`.

### Task 6: A registered census pins the guarded-callsite count

- **Files:** cadence-core/bin/phase-spelling.test.mjs,
  cadence-core/bin/lib/census-registry.mjs
- **Action:** The registry table is `CENSUSES` in `lib/census-registry.mjs`, and
  the marker grammar it reads is stated in that file beside `CENSUS_TOKEN`.
  Add the census to `phase-spelling.test.mjs`. It walks every `.mjs`
  under `cadence-core/bin/planning/`, finds every `requirePhaseArg` invocation,
  and asserts set-equality against a hand-written table carrying one row per
  callsite with its disposition and a one-line reason. Key each row by file plus
  enclosing function plus the call's ordinal within that function, never by line
  number: a line-keyed table would redden the suite on every unrelated edit to
  those fifteen modules, and a rail that fires wrong gets deleted rather than
  tuned. Name each unmatched callsite as `<file>:<line>` in the assertion message
  so the reader is sent to the line. For every row dispositioned as resolving a
  `phases/<N>/` path, assert the enclosing function actually calls the check -
  task 3's tree-aware one, or `phaseSpellingRefusal` for `cursor set` and
  `seed-reqs`. Measured 2026-08-25 and re-derived by the walk: 21 callsites, 12
  of them path-resolving (10 through the tree-aware check, 2 through the
  unconditional one) and 9 exempt - `capture.mjs:85` (a CAPTURE.md tag, D-08),
  `phase-done.mjs:30` (`.value` only, no phase directory), `core.mjs:744`
  (`decimalRefusal`, wording over a raw token), `risk-check.mjs:70` and `:326`
  and `trace.mjs:741`, `:788`, `:844` (the raw spelling scopes a
  `.planning/trace.jsonl` filter and reaches no path), and `trace.mjs:270` (the
  phase comes off a record line, not a flag). `lib/arg-contract.mjs:184` is
  deliberately outside the walk and named in the table's prose rather than as a
  row: it is the reader that PRODUCES a parse result rather than a consumer that
  resolves a path, and scoping the walk to exactly what the registry row's
  subjects cover is what keeps the count from moving in a file no lease refusal
  watches. Mark the count assertion with the `CADENCE-CENSUS` marker, and add the
  matching `CENSUSES` row with this test file as `holder` and subjects exactly
  `['cadence-core/bin/planning/']`. Do NOT add `cadence-core/bin/planning.mjs`
  to the subjects for symmetry with the two existing wide rows: D-11 measured
  that at 18 of 46 plans refused against a rail bound of 23, and no callsite
  lives there.
- **Verify:** `node --test cadence-core/bin/phase-spelling.test.mjs
  cadence-core/bin/census-registry.test.mjs
  cadence-core/bin/planning-lease-check.test.mjs` passes - the last one is the
  half-the-plans rail, which must still pass with the new row registered. Then
  falsify it: add a throwaway `requirePhaseArg` call that builds a `phases/<N>/`
  path in one `cadence-core/bin/planning/` module, re-run
  `node cadence-core/bin/test.mjs`, and confirm it fails with a message naming
  that file and line; revert the throwaway before committing.

### Task 7: The grammar is stated once, in `roadmap-phases.md`

- **Files:** cadence-core/references/roadmap-phases.md,
  cadence-core/references/conventions.md,
  skills/cad-health/SKILL.md,
  cadence-core/workflows/new-project.md,
  cadence-core/workflows/adopt.md,
  cadence-core/bin/planning/core.mjs, cadence-core/bin/weight-budgets.json,
  .planning/DOCS-CLAIMS.md
- **Action:** The five prose sites are `conventions.md`'s `- Phase directory:`
  bullet, `cad-health`'s consistency rule 5, the phase-directory note in
  `new-project.md`'s roadmap-writing step, the same note in `adopt.md`, and the
  `PHASE_DIR_NAME` header comment task 1 moved into `planning/core.mjs`; the two
  ledger rows are `NEW-PROJECT-21` and `ADOPT-25` in DOCS-CLAIMS.md, whose `line`
  cells are already stale against the prose they name.
  MOVE the statement rather than add one (D-09): it is stated in full
  in `conventions.md` today and paraphrased on three more live surfaces, and
  adding a fifth statement is the failure this criterion names. Give
  `roadmap-phases.md` a section stating the whole phase-directory grammar - the
  bare phase integer or an `N.M` sub-phase insertion, neither part zero-padded
  and no slug suffix, Cadence resolving no other spelling and migrating nothing,
  a directory outside it REPORTED as `phase-dir-grammar` drift with renaming left
  to the user - and state there, in its own sentence, that `2.0` is NOT a legal
  spelling of phase 2 because the fraction is the sub-phase ordinal and obeys the
  same no-padding rule, so `.0` is not a fraction at all. Then retire the other
  four: `conventions.md`'s bullet keeps the path and the created-lazily clause and
  points at `references/roadmap-phases.md` for the grammar; `cad-health`'s
  consistency rule keeps its instruction to report every `phase-dir-grammar`
  entry as an issue and cites `references/roadmap-phases.md` instead of restating
  the grammar; both workflow notes keep "create no `phases/` directory" and drop
  the grammar clause for the same pointer. Repoint the `PHASE_DIR_NAME` comment's
  `references/conventions.md` citation in `planning/core.mjs` with them. Update
  `.planning/DOCS-CLAIMS.md`'s `NEW-PROJECT-21` and `ADOPT-25` rows - their
  `claim` and `line` cells both, since a row verdicted `accurate` against text
  that no longer exists is worse than no row - and leave the verdict columns
  alone, because what the prose now claims is still true. Re-pin every budgeted
  surface this task edits in `cadence-core/bin/weight-budgets.json` in this SAME
  commit (D-10): all five entries are the files' exact current byte sizes, so one
  added character fires `budget-overrun`, and `self-verify`'s check is a ceiling
  test that a shrunk file passes silently and a grown one does not.
- **Verify:** `grep -rn "no zero-padding" skills/ cadence-core/workflows/
  cadence-core/references/` returns exactly one line, in `roadmap-phases.md`, and
  `grep -rn "bare integer" skills/ cadence-core/workflows/
  cadence-core/references/` returns exactly one line, also in
  `roadmap-phases.md` (four each today). `node cadence-core/bin/self-verify.mjs`
  reports `problems []`, with no `budget-overrun` and no `unbudgeted-surface`.
  `node --test cadence-core/bin/citation-census.test.mjs` passes.

### Task 8: The citation census survives its own requirements retiring

- **Files:** cadence-core/bin/citation-census.test.mjs
- **Action:** `CITATIONS.length >= 3` is a hand-written floor that becomes a
  landmine at the close: `SPL-01` and `SPL-02` supply two of the table's three
  rows, and when they move from `.planning/REQUIREMENTS.md`'s `## Active` to
  `## Shipped` both citations leave the walked surface at once - Shipped rows are
  one-line summaries carrying no line citations, `FLD-01` being the precedent -
  so the floor and the set-equality arm red together in the close commit, the most
  expensive place to find it (D-12). Replace the fixed floor with a non-vacuity
  floor of one and state in the comment why the number cannot be a count: rows
  retire with the requirement that carried them, and the arm that already
  guarantees this census is not measuring nothing is the separate
  `grammarOneCount > 0` assertion at the foot of the file. Extend the
  set-equality failure message so it names deleting the row as the remedy when a
  citation retires with its requirement, beside the two remedies it already
  names. Leave `DOCS_CLAIMS_CITATIONS`'s own `>= 4` floor exactly as it is: its
  rows are pinned to `.planning/DOCS-CLAIMS.md`, which no close empties, so the
  same reasoning does not reach it.
- **Verify:** `node --test cadence-core/bin/citation-census.test.mjs` passes, and
  a throwaway edit deleting both `SPL` citations from
  `.planning/REQUIREMENTS.md`'s `## Active` section together with their two
  `CITATIONS` rows leaves it still passing; revert the throwaway before
  committing. Then the whole-tree gate: `node cadence-core/bin/test.mjs` runs
  green, `npx tsc -p tsconfig.ci.json` exits 0, and
  `node cadence-core/bin/self-verify.mjs` reports `problems []`.

## Notes

- Plan shape follows the CONTEXT directive: one plan. The eight tasks share
  `planning/core.mjs`, `phase-spelling.test.mjs` and `citation-census.test.mjs`,
  so no independent slice exists to split out.
- The lease declares four census holders this plan may not otherwise edit -
  `self-verify.test.mjs`, `trace.test.mjs`, `planning-lease-check.test.mjs` and
  `weight-budgets.json`. `censusesAtRisk` refuses at plan time on subject
  intersection alone, and this plan declares files under
  `cadence-core/bin/planning/` and under `cadence-core/references/`, which
  intersects all four rows' subjects. Declaring the holder is the remedy the
  refusal names; the counts those three tests hold are not expected to move,
  since none of them counts a `fail(...)` detail or a `mergeLayers` callsite.
- Not touched, and deliberately: `.planning/phases/2/census-replay.md`. The
  half-the-plans rail only asks for it to be updated when it FAILS, and D-11
  measured the new row at 4 of 46 plans refused against a bound of 23.
- `cadence-core/bin/route.mjs` is outside this phase by D-05, and its exclusion
  is not merely a scope call: measured 2026-08-25, it resolves no `phases/<N>/`
  path at all and reaches `requirePhaseArg` only through
  `lib/arg-contract.mjs`'s declared `phase` row.
