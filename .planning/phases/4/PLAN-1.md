---
phase: 4
plan: 1
requirements: ["#37", "#49"]
files: ["cadence-core/bin/planning.mjs", "cadence-core/bin/planning.test.mjs", "cadence-core/workflows/phase.md", "cadence-core/bin/weight-budgets.json"]
---

# Phase 4: renumber & git-guard hardening - Plan 1 (renumber)

## Goal

`renumber` applies the decimal carve-out to the STATE cursor - warning instead
of silently desyncing it - refuses a colliding destination before any write, and
names the ops that completed when an apply fails partway instead of collapsing
to a bare `reason:"internal"`.

## Must be true when done

- `planning.mjs renumber remove --n 1` (and `insert --at 2`) on a tree whose
  STATE cursor reads `Phase: 2.1 of 4 (Patch)` leaves the cursor's phase at
  `2.1`, moves the total by `delta` (to `3` on the remove, `5` on the insert),
  and returns a scalar `warn` telling the caller to re-point it; ROADMAP's
  `**Phase 2.1: Patch**` token and `phases/2.1/` are unchanged.
- With that same decimal cursor, `renumber remove --n 3` emits NO `warn` and
  leaves the cursor's phase untouched (the shift point sits above it, so nothing
  would have moved - D-10), and an integer cursor at or above the shift point
  still shifts exactly as it does today.
- `renumber insert --at 3` on a tree that already contains an out-of-roadmap
  `phases/4/` exits `ok:false` naming `phases/4` as the colliding destination,
  with no directory moved and ROADMAP.md byte-identical; no `phases/4/3/` is
  created. The same call with `--dry-run` refuses identically. A DANGLING
  SYMLINK at `phases/4` refuses the same way - `existsSync` alone reads it as
  free and the apply then dies `ENOTDIR` partway.
- A `renumber remove --n 1` whose file edits fail after the dir work succeeded
  exits `ok:false` with `reason:"partial-apply"`, a `completed` list naming the
  rm and both dir moves in the order they ran, and a `failed` op naming the edit
  that broke - never a bare `{ok:false,reason:"internal"}`.
- `cadence-core/workflows/phase.md` tells the model that a failed apply leaves a
  half-renumbered tree to reconcile by hand, and
  `node cadence-core/bin/self-verify.mjs` stays clean (its budget entry moved
  with it).
- #37 and #49.2 each have at least one test that fails on the pre-fix code and
  passes after it, and all three CI gates pass:
  `node --test cadence-core/bin/*.test.mjs`,
  `node cadence-core/bin/self-verify.mjs`, `npx tsc -p tsconfig.ci.json`.

## Context

Locked decisions bind this plan: D-01 (a non-integer `cursor.phase` is left
UNTOUCHED while `total` still moves by `delta` - the asymmetry is deliberate and
must be commented as such), D-02 (the warning rides the EXISTING scalar `warn`
key - no `cursor_warn`, no `warnings[]`; phase-3 D-14 stands), D-10 (the decimal
warn fires only when `cursor.phase >= shiftFrom`), D-03 (apply gains a partial
REPORT, never a rollback or a transaction - `remove` destroys `phases/<at>`
before any move, so the first step cannot be undone), D-04 (the collision arm is
a pre-flight destination-exists check that fails before any write; `git mv <dir>
<existing dir>` NESTS and exits 0, so a failure-keyed fix would never fire),
D-11 (the partial report is emitted directly, bypassing the dispatch catch and
`fail()`'s reason/detail/hint-only shape), D-12 (no new flag, so self-verify's
CONTRACTS table is untouched), D-14 (a touched prose surface bumps its
`weight-budgets.json` entry in the same change - `phase.md` sits at exactly
3224/3224), D-17 (#37's tests are net-new; `makeTree` writes the cursor
verbatim, so a decimal `phase: 2.1` fixture is expressible today). Out of scope:
a true transaction or rollback, a `warnings[]` channel, reopening #36's dir-move
ceiling (already shipped), and phase 4's other two slices (#49.1 in PLAN-2,
`git-guard` in PLAN-3) - this plan touches none of their files.

Every new test must be verified failing-capable against the pre-fix code (stash
or revert the source hunk, run the test, see it fail) - not merely passing. A
prior cycle shipped an assertion that passed unpatched (`.planning/CAPTURE.md`,
phase 2; `.planning/phases/2/SUMMARY.md`).

## Tasks

### Task 1: Carve decimal cursors out of the renumber shift, with a warn (#37)

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs
- **Action:** In `cmdRenumber`'s cursor block (planning.mjs:691-701) keep
  `newCursor = { ...cursor, total: total + delta }` exactly as it is - the
  roadmap genuinely gained or lost a phase, so the denominator is still true
  (D-01) - and gate the phase shift on integrality: inside the existing
  `if (cursor.phase >= shiftFrom)` branch, shift only when
  `Number.isInteger(cursor.phase)`; otherwise leave `newCursor.phase` alone and
  set the existing scalar `warn` to a message naming the decimal phase and
  telling the caller to re-point it, e.g. `cursor sits on decimal phase
  ${cursor.phase}, which renumber never shifts (its ROADMAP token and
  phases/${cursor.phase}/ did not move either); total is now ${total + delta} -
  re-point it (cursor set)`. Leave the `sub === 'remove' && cursor.phase === at`
  warn assignment below it untouched: the two causes are mutually exclusive
  (`cursor.phase === at` requires an integer `at`), which is exactly why ONE
  scalar key holds both (D-02) - do NOT add a `cursor_warn` key, a
  `warnings[]` array, or a second warn slot. Do NOT warn when
  `cursor.phase < shiftFrom`: that branch changes nothing today, so a warn there
  is noise about a no-op (D-10). Add a comment above the branch stating the
  asymmetry and its reason (phase number never shifted anywhere else, total
  still true), so the next reader does not "fix" it back. Add one test to
  `planning.test.mjs` beside the existing decimal block (:1181-1207) named for
  #37: build `makeTree({roadmap: [{n:1,name:'One'},{n:2,name:'Two'},
  {n:3,name:'Three'}], phases: {1:{plan:true},2:{plan:true},3:{plan:true}},
  cursor: {phase: 2.1, total: 4, name:'Patch', status:'planned',
  next:'/cad-execute 2.1', updated:'2026-01-01'}})`, then - mirroring the
  existing decimal test (:1189-1192) rather than passing `n: 2.1` to `makeTree`,
  whose `**Depends on:** Phase ${p.n - 1}` line would render a float artifact -
  rewrite ROADMAP.md raw to insert
  `- [ ] **Phase 2.1: Patch** - see phases/2.1/ notes` before the Phase 3 line,
  and `mkdirSync` `phases/2.1`. Assert on `renumber remove --n 1`: `ok:true`,
  `r.warn` matches both `/2\.1/` and `/re-point/`, `cursor get` returns
  `phase === 2.1` and `total === 3`, ROADMAP still matches
  `/\*\*Phase 2\.1: Patch\*\*/`, and `phases/2.1` still exists. Then on a fresh
  fixture assert `renumber insert --at 2` leaves `phase === 2.1` with
  `total === 5` and warns. Then on a third fresh fixture assert
  `renumber remove --n 3` returns `r.warn === undefined` with the cursor still
  `phase === 2.1` (D-10). Do not touch the shipped tests at :982-998 and
  :1017-1028 - they are the integer-cursor regression guard and must stay green.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes; the new
  test fails on pre-fix code, where `remove --n 1` rewrites STATE.md to
  `Phase: 1.1 of 3` with no `warn` (reproduced live) and `insert --at 2` writes
  `3.1`.

### Task 2: Refuse a colliding destination before any write (#49.2)

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs
- **Action:** In `cmdRenumber`, after `dirMoves` is computed (planning.mjs:
  653-660) and BEFORE the `--dry-run` return at :731, add a pre-flight
  destination check. Walk `dirMoves` in their computed order carrying a
  `const vacated = new Set()` seeded with `String(at)` when `sub === 'remove'`
  (the rm at :735-738 frees that number before any move runs); for each
  `[f, t]`, test occupancy with a module-local
  `function occupied(p) { return existsSync(p) || !!lstatSync(p, { throwIfNoEntry: false }); }`
  rather than `existsSync` alone - `existsSync` follows the link and returns
  FALSE for a dangling symlink, so a dangling `phases/<t>` reads as free, the
  pre-flight passes, and the apply then dies mid-flight (verified on this tree:
  `renameSync` onto a dangling symlink throws `ENOTDIR`) - the exact
  partial-apply class this slice exists to close, in the phase whose other half
  is dangling-symlink resilience. `lstatSync` needs importing from `node:fs` if
  not already imported. If `occupied(join(dir, 'phases', String(t)))` and
  `!vacated.has(String(t))`, return
  `fail('collision', `phases/${t} already exists and is not a phase this
  renumber vacates - move or delete it first`, 'ls .planning/phases')`; then
  `vacated.add(String(f))`. The vacated set is load-bearing, not defensive: on
  `insert --at 2` over dirs 1,2,3 the moves are `3->4` then `2->3`, and
  `phases/3` exists at check time - a naive `existsSync(dest)` test would refuse
  every ordinary renumber and turn the shipped test at :982-998 red. Run the
  check for BOTH the dry-run and the apply path (placing it above the `dry-run`
  return does both) so the confirmation gate shows the refusal instead of a plan
  that cannot execute. This must precede the `git rm` at :735 - on a remove, the
  rm destroys a phase directory before the first move, so a check placed after
  it would report the collision only once the data is gone (D-04, following
  phase-2 D-04's fail-before-any-write precedent). Do NOT key the fix on a move
  failure: `git mv <dir> <existing dir>` NESTS the source inside the destination
  and exits 0 in a real repo, so a failure-keyed arm never fires there. Add one
  test to `planning.test.mjs` beside the renumber block: from `renumberTree()`,
  `mkdirSync` `phases/4` with a `PLAN.md` reading `# stray`, capture
  ROADMAP.md's bytes, then assert `renumber insert --at 3 --dry-run` and
  `renumber insert --at 3` both return `ok:false` with `reason === 'collision'`
  and a `detail` matching `/phases\/4/`; assert ROADMAP.md is byte-identical to
  the capture, `readdirSync(phases).sort()` is `['1','2','3','4']`, no
  `phases/4/3` exists, and `phases/4/PLAN.md` still reads `# stray`. Add a
  second, smaller case in the same test file for the dangling-symlink occupant:
  from a fresh `renumberTree()`, `symlinkSync('nowhere', join(phases, '4'))`
  instead of the stray dir, and assert `renumber insert --at 3` returns
  `ok:false` with `reason === 'collision'` and that ROADMAP.md is byte-identical
  - this is the case an `existsSync`-only pre-flight lets through.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes; the new
  test fails on pre-fix code, where the apply exits
  `{"ok":false,"reason":"internal","detail":"ENOTEMPTY: ... rename ..."}`
  (tmpdir fixtures are not git repos, so `gitMv` falls back to `renameSync`) and
  the dry-run happily returns `ok:true` with the doomed plan. The dangling-link
  case also fails on an `existsSync`-only pre-flight (it exits
  `reason:"internal"` with `ENOTDIR`, not `reason:"collision"`), so it pins
  `occupied()` rather than merely re-testing the stray-dir arm.

### Task 3: Report the ops that completed when an apply fails partway (#49.2)

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs
- **Action:** Restructure `cmdRenumber`'s apply block (planning.mjs:733-746)
  into an ordered step list executed under one guard. Build
  `/** @type {Array<[Record<string, any>, () => void]>} */ const steps = []` in
  APPLY order - the rm first (when `sub === 'remove' && existingDir(at)`),
  keeping its inner `git rm` / `rmSync` try-catch fallback verbatim inside the
  step closure so only a genuine removal failure surfaces; then each
  `dirMoves` entry calling `gitMv`; then `ROADMAP.md`, then `REQUIREMENTS.md`
  (when `newReqText !== null`), then `STATE.md` (when `newCursor`), each
  `atomicWrite` as today. Do NOT reorder or rebuild the existing `ops` array at
  :715-721 from this list: `ops` lists moves before the rm and the shipped test
  at :1045-1050 pins `ops[0..2]` - `steps` is a second, apply-ordered list that
  happens to describe the same work. Pair each step with the op object it
  represents, using the same key shape as `ops` minus the `changes` counts
  (`{rm: 'phases/<at>'}`, `{git_mv: ['phases/<f>','phases/<t>']}`,
  `{edit: 'ROADMAP.md'}`) - a change count for a write that never landed would
  be a lie. Then run
  `const completed = []; for (const [op, runStep] of steps) { try { runStep(); }
  catch (e) { return emit({ ok: false, reason: 'partial-apply', completed,
  failed: op, detail: <e.message or String(e)>, hint: 'the tree is partly
  renumbered - reconcile the completed ops by hand, then re-run' }); }
  completed.push(op); }`, leaving the sanity recount and
  `ok({ ...result, total: after.length })` unchanged below it. Use `emit`
  directly (already imported at :44): the dispatch-level catch at :797-799
  flattens everything to `internal` and `fail()` carries only
  reason/detail/hint, so a completed list needs its own emit (D-11). Add a
  comment stating this is a REPORT, not a rollback, and why one is impossible:
  `remove` destroys `phases/<at>` before the first move, so step one cannot be
  undone, and advertising a rollback the code lacks is worse than today's
  generic failure because the caller stops checking the tree by hand (D-03).
  Add one test to `planning.test.mjs`: from `renumberTree()`, `chmodSync(dir,
  0o555)` - the `.planning` root read-only while `phases/` stays writable, so
  the rm and both moves succeed and `atomicWrite`'s `ROADMAP.md.tmp` create
  fails with EACCES (reproduced live) - then run `renumber remove --n 1` inside
  a `try/finally` that restores `chmodSync(dir, 0o755)`. Assert `ok:false`,
  `reason === 'partial-apply'`, `completed` deep-equals
  `[{rm:'phases/1'},{git_mv:['phases/2','phases/1']},
  {git_mv:['phases/3','phases/2']}]`, `failed` deep-equals
  `{edit:'ROADMAP.md'}`, and `detail` matches `/ROADMAP/`. Guard the test with
  node:test's options object -
  `{ skip: typeof process.getuid === 'function' && process.getuid() === 0 ?
  'root bypasses mode bits' : false }` - because a root test run would make the
  chmod inert and the assertion vacuously red. Import `chmodSync` from
  `node:fs` at the top of the test file.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes; the new
  test fails on pre-fix code, which returns
  `{"ok":false,"reason":"internal","detail":"EACCES: permission denied, open
  '<dir>/ROADMAP.md.tmp'"}` with no record that a phase directory was deleted
  and two more were moved (reproduced live).

### Task 4: Tell the phase workflow about a half-applied renumber, and bump its budget

- **Files:** cadence-core/workflows/phase.md, cadence-core/bin/weight-budgets.json
- **Action:** In `cadence-core/workflows/phase.md`, add ONE bullet as the first
  entry of `## Finish` (:60-64), above the `Sanity: spot-check` line: state that
  an apply exiting `ok:false` with a `completed` list left the tree partly
  renumbered - the seam is deliberately not transactional - so the listed ops
  must be reconciled by hand before anything is committed. Keep it to a single
  line: this surface is measured, and every byte is enforced. Do not restate the
  new `warn` cases anywhere in this file: :33-34 and :50-52 already tell the
  model to show "any `warn`" on both ops, which is precisely why #37 needs no
  prose edit (D-02). Do not introduce any dotted `family.key` token or any
  `<script>.mjs <sub> --flag` invocation in the new line - both are linted by
  self-verify. Then set `cadence-core/workflows/phase.md`'s entry in
  `cadence-core/bin/weight-budgets.json` (:22, currently 3224) to the file's
  exact new byte count, matching the repo's pinned-at-current-size convention;
  the surface sits at exactly zero headroom today, so the same-change bump is
  what keeps CI green (D-14, phase-3 D-13 precedent). Change no other budget
  entry.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 with
  `"problems":[]` (no `budget-overrun`, no `unbudgeted-surface`), and
  `node cadence-core/bin/weight.mjs` reports `cadence-core/workflows/phase.md`
  with a `bytes` value equal to its new `weight-budgets.json` entry.

## Notes

- The partial-apply fixture depends on `atomicWrite` writing `<file>.tmp` beside
  its target (`planning-files.mjs:565-569`), so a read-only `.planning` root
  fails the write while a writable `phases/` lets the dir work through. If that
  helper ever moves its temp file elsewhere, the fixture stops being partial and
  the test must be re-grounded, not relaxed.
- Task 4 edits `weight-budgets.json`, which PLAN-2's `self-verify.mjs` reads at
  runtime but never writes; the two plans share no file. If they are executed in
  parallel worktrees, PLAN-2's "the repo itself passes self-verification" test
  only sees this bump after both merge - it stays green either way because the
  prose edit and the bump land in the same commit.
- **ROADMAP goal reconciled at the `plan` review.** Phase 4's roadmap line read
  "reports/rolls back a partial apply", which promised a rollback D-03
  deliberately scopes OUT (the remove destroys `phases/<at>` before the first
  move, so the first step cannot be undone; a rollback that cannot undo step one
  advertises a guarantee the code lacks). No task delivered the rollback clause,
  so `/cad-verify 4` would have checked this phase against a promise nothing
  makes true. The roadmap line now states the report-not-rollback shape and
  cites D-03, and names the collision refusal Task 2 adds. Two reviewers raised
  this independently. The DECISION is unchanged - only the roadmap wording was
  brought in line with it.
