---
phase: 2
plan: 1
requirements: [JRN-02]
files:
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
---

# Phase 2: Both callers on the journal - Plan 1 (`phase-done`)

## Goal

`phase-done` stops claiming an all-or-nothing it does not have: it writes
nothing until every edit it will make is validated, its success envelope states
whether both documents moved or only the roadmap, and a present-but-unreadable
REQUIREMENTS.md stops being answered as an absent one.

## Must be true when done

- `planning.mjs phase-done --n <N>` against a fixture whose `REQUIREMENTS.md`
  is a DIRECTORY prints `{"ok":false}` at exit 1 with a machine `reason` naming
  the unreadable requirements file, and `ROADMAP.md`'s sha256 is identical
  before and after the run - the box is not flipped, not "flipped and then
  reported as an error".
- The same command against a fixture with NO `REQUIREMENTS.md` at all prints
  `{"ok":true}` at exit 0 with the roadmap line boxed. Absent and unreadable
  produce two different envelopes, where today they produce one.
- The success envelope carries a field naming which of the two documents were
  written, on BOTH shapes - both-documents and roadmap-only - and
  `roadmap.{line,now}` and `reqs[]` are byte-for-byte the fields they are today.
- A step failure the pre-flight could not see is reported as a partial with the
  document that did land named, never as `{"ok":false,"reason":"internal"}`
  carrying no record of what moved.
- `sed -n '/^function cmdPhaseDone/,/^}/p' cadence-core/bin/planning.mjs | grep
  -c "all-or-nothing"` prints `0`, or every hit sits below the pre-flight
  refusal - the comment and the behaviour agree.
- `node --test cadence-core/bin/planning.test.mjs` passes with every
  PRE-EXISTING `phase-done` case unedited: `git diff -U0 --
  cadence-core/bin/planning.test.mjs | grep -c '^-[^-]'` prints `0` against the
  phase's base commit, so the file grew and nothing in it was rewritten.
- At the last commit `node cadence-core/bin/self-verify.mjs --root .` returns
  `ok:true` with `problems: []` and `./node_modules/.bin/tsc -p
  tsconfig.ci.json` exits 0.

## Context

Locked: D-01 (the honest guarantee is a PRE-FLIGHT REFUSAL, not a rollback -
phase 1's primitive has no undo, so "ROADMAP.md unchanged afterwards" is
reachable only by refusing before the first `atomicWrite`), D-03 (a
present-but-UNREADABLE `REQUIREMENTS.md` becomes that refusal; a genuinely
ABSENT one keeps today's roadmap-only write - the three-state precedent is
`readManifest` in `cadence-core/bin/release-bump.mjs`), D-04 (the two documents'
disposition is reported through a NEW field; `roadmap.{line,now}` and `reqs[]`
keep their current shape and meaning, because
`cadence-core/bin/planning.test.mjs` asserts both across nine cases and
`.planning/DOCS-CLAIMS.md` rows UNDO-06 and VERIFY-41 pin the prose that reads
them), D-05 (`stop-at-first-failure` discipline, and a step failure the
pre-flight could not see emits its own partial envelope directly rather than
through `fail()` - `fail()` carries only reason/detail/hint, which is why
`cmdRenumber` bypasses it for the same job), D-12 (every pre-flight condition
catches its own I/O so `satisfied()` cannot throw; `runTransition` gains NO new
result arm and `cadence-core/bin/lib/file-transition.mjs` is NOT edited by this
plan), D-13 (no new `HELPERS` census row, no `CONTRACTS` row, no arg-contract
row - `cadence-core/bin/lib/arg-contract.mjs`'s `phase-done` rows are unaffected
by a write-ordering change).
Existing facts to build on: `runTransition` is ALREADY imported at
`cadence-core/bin/planning.mjs` (the `lib/file-transition.mjs` import beside
`requirePlanKey`), so this plan adds no import; `read()` in the same file is the
collapse to fix (`try { return readFileSync(...) } catch { return null }` -
absence and EISDIR/EACCES are one answer); `setPhaseBox` and `setReqStatus` in
`cadence-core/bin/lib/planning-files.mjs` are pure text rewrites and are not
touched.
Out of scope: `release-bump.mjs` (plan 2); any journal, marker, resume path or
rollback; any edit to `cadence-core/bin/lib/file-transition.mjs`,
`cadence-core/bin/lib/planning-files.mjs` or `cadence-core/bin/lib/seam-input.mjs`;
any workflow-prose edit - `cadence-core/workflows/verify.md`,
`cadence-core/workflows/undo.md` and `cadence-core/references/req-traceability.md`
each describe only the box-and-rows behaviour that is unchanged here, so no
`weight-budgets.json` re-pin and no `.planning/DOCS-CLAIMS.md` row is owed by
this plan; widening the pre-flight to the WRITE-ability of `.planning` itself
(the phase's own flagged assumption - `planning.test.mjs` forces an unrelated
failure by `chmodSync` on that root, and no readability check sees it).

## Tasks

### Task 1: `cmdPhaseDone`'s two writes become one ordered transition

- **Files:** cadence-core/bin/planning.mjs (`cmdPhaseDone`)
- **Action:** Replace the two bare `atomicWrite` calls at the foot of
  `cmdPhaseDone` with a single `runTransition` call under the
  `'stop-at-first-failure'` discipline. Each step pairs the DOCUMENT NAME as its
  key - the bare file name, `ROADMAP.md` and `REQUIREMENTS.md`, not the joined
  path, because that key is what task 3 puts in the envelope and a caller
  reading it wants the document, not the fixture's temp directory - with a thunk
  that performs exactly the write it performs today. The REQUIREMENTS.md step is
  built only when the requirements text was read and rewritten, i.e. exactly
  where the current `if (newReqText !== null)` guard fires, so an absent
  REQUIREMENTS.md yields a one-step transition and today's behaviour. Order is
  load-bearing and is today's: ROADMAP.md first, REQUIREMENTS.md second. Nothing
  else moves in this task: the `requirePhaseArg` guard, the `--reqs` shape
  refusals, the `no-roadmap` and `unknown-phase` arms, the `setPhaseBox` /
  `parseRequirements` / `setReqStatus` calls and the `ok({roadmap, reqs})` emit
  all stay exactly as they are, and the result of the call is not yet rendered
  (tasks 2 and 4 do that) - this task is the wiring, proven by the suite not
  moving. DELETE the "Both edits validated before either write - all-or-nothing"
  comment in this same edit rather than leaving it above the new call: an atomic
  rename protects one file from torn bytes and cannot make a transaction across
  two, so the sentence is false at this commit and stays false until task 2
  lands the pre-flight (AC6). Put in its place a comment saying what the code
  now does - one ordered step list, stop at the first failure - and do not
  re-state a guarantee this commit does not yet give.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` exits 0 reporting
  452 tests and 0 failures, with `git status --porcelain --
  cadence-core/bin/planning.test.mjs` printing nothing (this task edits no
  test). `sed -n '/^function cmdPhaseDone/,/^}/p' cadence-core/bin/planning.mjs
  | grep -c "all-or-nothing"` prints `0`, and the same `sed` range piped to
  `grep -c "runTransition"` prints `1`. `./node_modules/.bin/tsc -p
  tsconfig.ci.json` exits 0.

### Task 2: absent and unreadable stop being the same answer, and the unreadable one refuses before the first write

- **Files:** cadence-core/bin/planning.mjs (`cmdPhaseDone`),
  cadence-core/bin/planning.test.mjs
- **Action:** Read `REQUIREMENTS.md` as a THREE-state fact inside `cmdPhaseDone`
  - absent, present-but-unreadable, present-and-read - instead of through
  `read()`, whose single `null` is what makes a directory at that path
  indistinguishable from no file at all (measured 2026-08-22: the run returned
  `{"ok":true,...,"reqs":[]}` at exit 0 with the roadmap boxed and the rows
  silently unwritten). Model it on `readManifest` in
  `cadence-core/bin/release-bump.mjs`, which already carries this exact
  three-state shape and its reasoning, and keep it local to this file - do NOT
  edit `read()` itself, which has callers throughout `planning.mjs` that
  legitimately treat absence as data, and do NOT paste `readText`'s body from
  `cadence-core/bin/lib/seam-input.mjs`, which `helper-census.test.mjs` pins as
  a single definition. ABSENT keeps today's path exactly: no REQUIREMENTS step,
  `reqs: []`, `ok:true` (D-03 rejected refusing on absence - `verify.md`'s
  phase-done step is a hard step and a project that never kept a REQUIREMENTS.md
  must still be able to close a phase). UNREADABLE becomes a whole-transition
  refusal, expressed as a pre-flight CONDITION passed to `runTransition`'s
  `preflight` list, so the refusal happens before the ROADMAP.md thunk runs and
  ROADMAP.md is untouched on disk. This is the production caller phase 1's
  `preflight` stage was built for and has not had. The condition's `satisfied`
  thunk must not throw (D-12): the state is already in hand from the read above,
  so the thunk answers from that value and performs no I/O of its own -
  `runTransition` gains no catch arm and `lib/file-transition.mjs` is not
  edited. Render the refusal through the existing `fail()` helper with the
  machine reason `unreadable-requirements` (a new code, sibling to the existing
  `no-roadmap` / `unknown-phase` / `bad-args` set, and the same vocabulary
  `release-bump.mjs`'s `unreadable-manifest` uses) and let the condition's own
  description supply the detail sentence, which must name the path so an
  operator knows which file to repair. Keep the comment that replaced the
  all-or-nothing sentence current: the pre-flight is now what makes the
  "nothing is written" claim true, and the comment should say that and say why a
  rollback was not the answer (phase 1's primitive has no undo).
- **Verify:** two new cases in `cadence-core/bin/planning.test.mjs`, added below
  the existing `--- phase-done ---` block without editing any case above it.
  (a) A fixture built by `makeTree` with a roadmap and reqs, then
  `REQUIREMENTS.md` replaced by a DIRECTORY (`rmSync` then `mkdirSync`, or the
  fixture written with the directory in place - no `chmodSync` anywhere, which
  is a silent no-op under a root test runner, D-02): the run returns `ok:false`
  with `reason` `unreadable-requirements`, `_exit` is 1, and `ROADMAP.md`'s
  sha256 (`createHash('sha256')` over the file bytes) is EQUAL to the sha256
  taken before the run. (b) A fixture with a roadmap and no `reqs` at all so no
  `REQUIREMENTS.md` is written: the run returns `ok:true`, `_exit` 0,
  `r.roadmap.now` is `'[x]'`, `r.reqs` deep-equals `[]`, and reading ROADMAP.md
  back matches the boxed phase line. `node --test
  cadence-core/bin/planning.test.mjs` exits 0 at 454 tests, 0 failures. `git
  diff -U0 -- cadence-core/bin/planning.test.mjs | grep -c '^-[^-]'` prints `0`.
  `./node_modules/.bin/tsc -p tsconfig.ci.json` exits 0.

### Task 3: the success envelope says which documents moved

- **Files:** cadence-core/bin/planning.mjs (`cmdPhaseDone`),
  cadence-core/bin/planning.test.mjs
- **Action:** Add ONE new field to `cmdPhaseDone`'s success envelope, `wrote`,
  carrying the transition's completed keys - the document names, in write order:
  `["ROADMAP.md","REQUIREMENTS.md"]` when both moved, `["ROADMAP.md"]` when only
  the roadmap did. The name and the array shape are this plan's choice inside
  D-04, which fixed only that a NEW field carries this and that nothing existing
  changes; the array is the primitive's own `completed` record rendered into the
  caller's envelope, which is the D-02 shape phase 1 shipped for exactly this.
  Add it AFTER `reqs` in the emitted object so the existing key order is
  undisturbed. `roadmap.{line,now}` and `reqs[]` keep their current shape,
  meaning and contents: `reqs` stays the ids `setReqStatus` reported changed and
  must NOT become `null`, empty-vs-absent or anything else on the roadmap-only
  path - `cadence-core/bin/planning.test.mjs` deep-equals it across nine cases
  and `.planning/DOCS-CLAIMS.md` rows UNDO-06 and VERIFY-41 pin the two prose
  surfaces that read it, and this cycle has no docs-verify pass to catch a
  silent change to either.
- **Verify:** one new case in `cadence-core/bin/planning.test.mjs` asserting
  `wrote` on BOTH shapes from the SAME assertions style the file already uses:
  against a fixture carrying REQUIREMENTS.md, `assert.deepEqual(r.wrote,
  ['ROADMAP.md', 'REQUIREMENTS.md'])`; against a fixture with none,
  `assert.deepEqual(r.wrote, ['ROADMAP.md'])` - and in the second case
  `assert.deepEqual(r.reqs, [])` and `assert.equal(r.roadmap.now, '[x]')` in the
  same assertion block, so a future change that expresses "not written" by
  mutating `reqs` reddens here. `node --test
  cadence-core/bin/planning.test.mjs` exits 0 at 455 tests, 0 failures, with the
  pre-existing case `phase-done: flips the box and the phase rows; Deferred
  untouched; --undo reverses` passing by name. `git diff -U0 --
  cadence-core/bin/planning.test.mjs | grep -c '^-[^-]'` prints `0`.
  `./node_modules/.bin/tsc -p tsconfig.ci.json` exits 0.

### Task 4: a step failure the pre-flight could not see is reported, not flattened

- **Files:** cadence-core/bin/planning.mjs (`cmdPhaseDone`)
- **Action:** Render the transition's FAILURE result into `cmdPhaseDone`'s own
  partial envelope rather than letting the throw reach the dispatch-level catch,
  which flattens everything to `{"ok":false,"reason":"internal"}` with no record
  of which document moved - the undifferentiated envelope this phase exists to
  remove. Emit it directly, bypassing `fail()`, for the reason `cmdRenumber`
  already records in this file for its own partial arm: `fail()` carries only
  reason, detail and hint, and this arm has to carry the write record too (D-05).
  Use the machine reason `partial-flip` - this plan's choice, in the family
  `cmdRenumber`'s `partial-apply` and `cmdMilestonePrune`'s `partial-prune`
  already form, and named for the vocabulary this section's own header uses ("the
  two status flips verify.md owns"). Carry the completed document names in the
  same `wrote` field task 3 added, so one field answers "what moved" on every
  shape; carry the thrown error's message in `detail` through the same
  `e && e.message ? e.message : String(e)` expression `cmdRenumber` uses; and give
  it a two-armed `hint` selected on whether anything completed - one arm for
  nothing written (the tree is unchanged and the command is safe to re-run once
  the cause is fixed), one for ROADMAP.md boxed with the traceability rows not
  flipped (name the re-run as the repair and say it is idempotent, because
  `setPhaseBox` and `setReqStatus` both rewrite the same value on a second pass).
  Do NOT add a pre-flight condition for the shapes that produce this arm: they
  are the ones no readability check can see - an EACCES on the `.planning`
  directory, a symlink planted at `atomicWrite`'s derived temp path, ENOSPC - and
  a pre-flight that advertised a refusal it cannot deliver for them would talk
  callers out of checking the tree, which is the failure mode
  `lib/file-transition.mjs`'s own header names.
- **Verify:** the arm is proven live with a throwaway copy, never a committed
  test, because no uid-independent fixture can force it: every filesystem shape
  that WOULD fail the second write - a directory or an unreadable file at
  `REQUIREMENTS.md` - is now converted to task 2's pre-flight refusal, and D-02
  forbids `chmodSync`. Run `cp cadence-core/bin/planning.mjs
  cadence-core/bin/planning-probe.mjs`, edit ONLY the copy so the REQUIREMENTS.md
  step's thunk throws (its `./lib/...` imports resolve unchanged from the same
  directory), drive it against a two-document fixture with `phase-done --n 1
  --dir <fixture>`, and observe one JSON line reading `ok:false`, `reason`
  `partial-flip`, `wrote` deep-equal to `["ROADMAP.md"]`, a `detail` carrying the
  thrown message and a `hint` naming the re-run - at exit 1. Then `rm -f
  cadence-core/bin/planning-probe.mjs` and confirm `git status --porcelain`
  lists only `cadence-core/bin/planning.mjs`; the probe file is never staged and
  must be gone before the commit, since a second copy of every censused helper
  body under `cadence-core/bin/` reddens
  `node --test cadence-core/bin/helper-census.test.mjs` while it exists.
  Finally `node --test cadence-core/bin/planning.test.mjs` exits 0 at 455 tests,
  `node --test 'cadence-core/bin/*.test.mjs'` exits 0, `node
  cadence-core/bin/self-verify.mjs --root .` prints `ok:true` with an empty
  `problems` array, and `./node_modules/.bin/tsc -p tsconfig.ci.json` exits 0.

## Notes

- Two plans this phase, matching the CONTEXT `Plan shape` directive, and the
  independence test agrees rather than merely permitting it: this plan's
  declared files (`cadence-core/bin/planning.mjs`,
  `cadence-core/bin/planning.test.mjs`) and plan 2's
  (`cadence-core/bin/release-bump.mjs`, `cadence-core/bin/release-bump.test.mjs`,
  `cadence-core/workflows/milestone.md`, `cadence-core/bin/weight-budgets.json`,
  `.planning/DOCS-CLAIMS.md`) do not intersect, the two test suites are
  separate, and neither plan's tasks depend on the other's. AC7 (`self-verify`
  `ok:true`) is the whole-phase gate and each plan's last task asserts it
  independently - plan 2's only self-verify-visible change, milestone.md's byte
  count, is re-pinned inside the same task that grows it, so no commit in either
  plan leaves the check red.
- Three names here are the planner's choice, not decisions carried from
  CONTEXT, which is why each is pinned by a Verify rather than left to taste:
  the envelope field `wrote` (D-04 fixed only that a NEW field carries this and
  the phase's flagged assumption states the name is the planner's call), the
  refusal code `unreadable-requirements` and the partial code `partial-flip`. An
  executor that picks different spellings owes a deviation note, not a re-plan,
  provided the new cases in `planning.test.mjs` move with them.
- `cadence-core/bin/planning.test.mjs` IS in this plan's lease, unlike phase 1's
  plan, and the enforcement moved with it: AC3 requires the pre-existing
  `phase-done` cases be UNEDITED, not the file be untouched, so the mechanical
  check is `git diff -U0 -- cadence-core/bin/planning.test.mjs | grep -c
  '^-[^-]'` printing `0` - the file grew and nothing in it was rewritten. An
  executor that finds itself needing to change an existing assertion has
  contradicted D-04 rather than found a better shape.
- Baselines measured on this branch at planning time, so a Verify figure that
  moves is a signal rather than a surprise: `planning.test.mjs` 452 tests / 452
  pass, `self-verify.mjs --root .` `ok:true` with `problems: []`,
  `./node_modules/.bin/tsc -p tsconfig.ci.json` exit 0. The task counts (454,
  455) assume the case counts this plan names; a differently-grouped test file
  is fine as long as the named assertions exist and nothing pre-existing was
  edited.
- The partial arm (task 4) ships implemented and probe-proven but with no
  committed regression test, and that is the deliberate consequence of D-01 plus
  D-02 rather than a gap: the pre-flight converts every forcible failure shape
  into a refusal, and the residual failures (EACCES on `.planning`, a planted
  symlink at `atomicWrite`'s `${file}.${pid}.${seq}.tmp` path, ENOSPC) cannot be
  produced from a fixture without `chmodSync`, which D-02 refuses because it is a
  silent no-op under a root test runner. A verifier seeing no test named for
  `partial-flip` should read this note, not file a coverage gap.
- Recalled prior art, weighed and not acted on: `v3.5.5` phase 4's SUMMARY
  records `release-bump.test.mjs:424-428` still naming a retired `optionalFlag`
  in a comment because the file sat outside that plan's lease. Same species of
  residue is possible here in reverse - this plan holds the lease on
  `planning.test.mjs` and must not leave a comment describing the pre-fix seam
  behind. Nothing in the existing `phase-done` block describes the collapse this
  plan fixes, so there is nothing to sweep; the note exists so the executor does
  not add one.
